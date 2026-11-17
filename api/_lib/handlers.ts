import { randomBytes, randomInt } from 'node:crypto';
import type { Quiz, Question, QuizVariant, ClassStudent, StudentSubmission } from '../../src/types/quiz';
import { getStore, normalizePin, type StoredSubmission, type Store } from './store.js';
import { checkTeacherPassword, issueTeacherToken, verifyTeacherToken, newStudentToken, hashToken, safeEqual } from './auth.js';
import { gradeQuiz, partialAnswers, sanitizeQuizForStudent, cleanRaw } from './grading.js';
import { generateQuestions } from './gemini.js';

export interface ApiRequest { method: string; path: string; query: Record<string, string>; headers: Record<string, string | undefined>; body: any }
export interface ApiResponse { status: number; body: unknown }

class HttpError extends Error { constructor(public status: number, msg: string) { super(msg); } }
const bad = (m: string) => new HttpError(400, m);

const GRACE_MS = 120_000; // tolérance réseau à la soumission finale

// ---------- utilitaires ----------
const nameKey = (n: string) =>
  n.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
const initials = (n: string) => n.split(/\s+/).filter(Boolean).map((w) => w[0]).join('').toUpperCase().slice(0, 2);
const clock = (d = new Date()) => d.toTimeString().slice(0, 8);
const str = (v: unknown, max: number, field: string, required = true): string => {
  if (typeof v !== 'string') { if (required) throw bad(`Champ invalide : ${field}`); return ''; }
  const t = v.trim();
  if (required && !t) throw bad(`Champ requis : ${field}`);
  return t.slice(0, max);
};

/** Retire les champs privés d'une soumission. */
function toPublic(s: StoredSubmission): StudentSubmission {
  const { tokenHash, raw, expiresAt, quizId, lockedUntil, ...pub } = s;
  return pub;
}

const QTYPES = ['direct_short', 'direct_open', 'single_choice', 'multiple_choice', 'true_false'];

function cleanTranslation(t: any, field: string) {
  if (!t || typeof t !== 'object') return undefined;
  return {
    title: str(t.title, 4000, `${field}.title`),
    options: Array.isArray(t.options) ? t.options.slice(0, 10).map((x: unknown) => String(x ?? '').slice(0, 1000)) : undefined,
    explanation: typeof t.explanation === 'string' ? t.explanation.slice(0, 4000) : undefined,
  };
}

function validateQuestions(questions: any[], label = 'questions'): Question[] {
  const seen = new Set<string>();
  return questions.map((q: any, i: number) => {
    const id = str(q?.id, 80, `${label}[${i}].id`);
    if (seen.has(id)) throw bad(`Identifiant de question en double : ${id}`);
    seen.add(id);
    if (!QTYPES.includes(q?.type)) throw bad(`Type de question invalide (question ${i + 1})`);
    const points = Number(q.points);
    if (!Number.isFinite(points) || points < 0 || points > 100) throw bad(`Points invalides (question ${i + 1})`);
    const options = Array.isArray(q.options)
      ? q.options.slice(0, 10).map((o: any, j: number) => ({
          id: str(o?.id, 80, `options[${j}].id`), text: str(o?.text, 1000, 'option', false), isCorrect: Boolean(o?.isCorrect) }))
      : undefined;
    const en = cleanTranslation(q.i18n?.en, `${label}[${i}].i18n.en`);
    return {
      id, type: q.type, title: str(q.title, 4000, `${label}[${i}].title`), points,
      options,
      correctAnswerText: q.correctAnswerText ? str(q.correctAnswerText, 4000, 'correctAnswerText', false) : undefined,
      acceptedKeywords: Array.isArray(q.acceptedKeywords) ? q.acceptedKeywords.map((k: unknown) => String(k).slice(0, 200)).slice(0, 50) : undefined,
      gradingCriteria: q.gradingCriteria ? str(q.gradingCriteria, 2000, 'gradingCriteria', false) : undefined,
      placeholder: q.placeholder ? str(q.placeholder, 500, 'placeholder', false) : undefined,
      explanation: typeof q.explanation === 'string' ? q.explanation.slice(0, 4000) : '',
      category: q.category ? str(q.category, 200, 'category', false) : undefined,
      i18n: en ? { en } : undefined,
      partialCredit: q.partialCredit === true ? true : undefined,
    } as Question;
  });
}

/** Variantes : mêmes ids de questions dans le même ordre (les réponses sont rangées par id de question). */
function validateVariants(input: unknown): QuizVariant[] {
  if (!Array.isArray(input) || input.length === 0) throw bad('Variantes invalides');
  if (input.length > 60) throw bad('Au plus 60 variantes par interrogation');
  const seen = new Set<string>();
  let sig = '';
  return input.map((v: any, i: number) => {
    const id = str(v?.id, 40, `variants[${i}].id`);
    if (seen.has(id)) throw bad(`Identifiant de variante en double : ${id}`);
    seen.add(id);
    const qs = Array.isArray(v?.questions) ? v.questions : [];
    if (qs.length === 0 || qs.length > 100) throw bad(`Variante ${id} : 1 à 100 questions`);
    const questions = validateQuestions(qs, `variants[${i}].questions`);
    const s = questions.map((q) => `${q.id}:${q.type}:${q.points}`).join('|');
    if (i === 0) sig = s; else if (s !== sig) throw bad(`Variante ${id} : les questions (ids, types, points) doivent être identiques à celles de la première variante`);
    return { id, label: str(v?.label, 100, 'variant.label', false) || `Variante ${i + 1}`, questions };
  });
}

/** Questions « squelette » du quiz : structure (ids, types, points) sans contenu ni corrigé des variantes. */
function skeletonQuestions(v: QuizVariant): Question[] {
  return v.questions.map((q, i) => ({
    id: q.id, type: q.type, title: `Question ${i + 1}${q.category ? ` — ${q.category}` : ''}`, points: q.points,
    options: q.options?.map((o) => ({ id: o.id, text: o.id.toUpperCase(), isCorrect: false })),
    explanation: '', category: q.category, partialCredit: q.partialCredit,
  }));
}

function validateQuiz(input: any, existing?: Quiz): Quiz {
  if (!input || typeof input !== 'object') throw bad('Corps invalide');
  let variants: QuizVariant[] | undefined;
  let qs: Question[];
  if (existing?.variantList?.length) {
    qs = existing.questions; // quiz à variantes : la structure n'est pas modifiable ici
  } else if (input.variants !== undefined) {
    variants = validateVariants(input.variants);
    qs = skeletonQuestions(variants[0]);
  } else {
    const questions = Array.isArray(input.questions) ? input.questions : [];
    if (questions.length === 0 || questions.length > 100) throw bad('Une interrogation doit contenir 1 à 100 questions');
    qs = validateQuestions(questions);
  }
  const totalPoints = Number(input.totalPoints) > 0 ? Number(input.totalPoints) : qs.reduce((s: number, q: any) => s + q.points, 0) || 20;
  const status = ['draft', 'active', 'completed'].includes(input.status) ? input.status : existing?.status ?? 'active';
  return {
    id: existing?.id ?? '',
    title: str(input.title, 200, 'title'),
    subject: str(input.subject, 200, 'subject'),
    level: str(input.level, 100, 'level', false),
    classGroup: str(input.classGroup, 200, 'classGroup', false),
    durationMinutes: Math.min(600, Math.max(1, Math.round(Number(input.durationMinutes) || 30))),
    totalPoints,
    pinCode: str(input.pinCode, 30, 'pinCode'),
    createdAt: existing?.createdAt ?? new Date().toISOString().split('T')[0],
    questions: qs,
    gradeScale: Number(input.gradeScale) > 0 ? Math.min(100, Number(input.gradeScale)) : existing?.gradeScale,
    variantList: variants ? variants.map((v) => ({ id: v.id, label: v.label })) : existing?.variantList,
    variants, // transitoire : retiré avant l'enregistrement du quiz
    status,
    instructions: input.instructions ? str(input.instructions, 4000, 'instructions', false) : undefined,
    showCorrection: Boolean(input.showCorrection),
    lockOnLeave: input.lockOnLeave === undefined ? existing?.lockOnLeave ?? true : Boolean(input.lockOnLeave),
    lockMinutes: Math.min(60, Math.max(1, Math.round(Number(input.lockMinutes) || existing?.lockMinutes || 5))),
  } as Quiz;
}

async function uniquePin(store: Store, wanted: string, selfId?: string): Promise<string> {
  let pin = wanted;
  for (let i = 0; i < 20; i++) {
    const other = await store.getQuizByPin(pin);
    if (!other || other.id === selfId) return pin;
    pin = `#EVAL-${Math.floor(1000 + Math.random() * 9000)}`;
  }
  throw new HttpError(409, 'Impossible de générer un PIN unique');
}

const lockSeconds = (sub: StoredSubmission) => Math.max(0, Math.ceil(((sub.lockedUntil || 0) - Date.now()) / 1000));
const canSeeCorrection = (q: Quiz) => q.status === 'completed' || Boolean(q.showCorrection);

// ---------- variantes ----------
/** Quiz tel que le voit une copie : pour un quiz à variantes, les questions de SA variante. */
async function effectiveQuiz(store: Store, quiz: Quiz, variantId?: string): Promise<Quiz> {
  if (!quiz.variantList?.length) return quiz;
  const v = variantId ? await store.getVariant(quiz.id, variantId) : null;
  if (!v) throw new HttpError(500, 'Variante introuvable pour cette copie.');
  return { ...quiz, questions: v.questions };
}

/** Attribue la variante la moins utilisée de l'interrogation (égalité : tirage aléatoire). */
async function pickVariant(store: Store, quiz: Quiz): Promise<{ id: string; label: string }> {
  const list = quiz.variantList!;
  const counts = new Map(list.map((v) => [v.id, 0] as [string, number]));
  for (const sub of await store.listSubmissions(quiz.id)) {
    if (sub.variantId && counts.has(sub.variantId)) counts.set(sub.variantId, counts.get(sub.variantId)! + 1);
  }
  const min = Math.min(...counts.values());
  const candidates = list.filter((v) => counts.get(v.id) === min);
  return candidates[randomInt(candidates.length)];
}

// ---------- routes publiques / étudiant ----------
async function studentJoin(store: Store, body: any) {
  const name = str(body?.name, 80, 'name');
  if (name.length < 3) throw bad('Veuillez saisir votre nom et prénom complets.');
  const pin = str(body?.pin, 30, 'pin');
  const quiz = await store.getQuizByPin(pin);
  if (!quiz || quiz.status === 'draft') throw new HttpError(404, `Code PIN "${pin}" incorrect ou expiré.`);

  const id = `${quiz.id}:${nameKey(name)}`;
  const existing = await store.getSubmission(id);

  if (existing?.status === 'completed') {
    const eq = await effectiveQuiz(store, quiz, existing.variantId);
    return {
      phase: 'completed',
      quiz: canSeeCorrection(quiz) ? eq : sanitizeQuizForStudent(eq),
      submission: toPublic(existing),
      correctionVisible: canSeeCorrection(quiz),
    };
  }
  if (quiz.status !== 'active') throw new HttpError(403, "Cette interrogation est clôturée.");

  const { token, hash } = newStudentToken();
  const now = Date.now();
  let sub: StoredSubmission;
  if (existing) {
    sub = { ...existing, tokenHash: hash }; // reprise (rechargement de page, changement d'appareil)
  } else {
    const variant = quiz.variantList?.length ? await pickVariant(store, quiz) : undefined;
    sub = {
      id, quizId: quiz.id, tokenHash: hash,
      ...(variant ? { variantId: variant.id, variantLabel: variant.label } : {}),
      studentId: `st-${nameKey(name).replace(/ /g, '-')}`,
      studentName: name, studentAvatar: initials(name), matricule: '',
      status: 'active', startedAt: clock(), answers: {}, currentQuestionIndex: 0,
      totalScore: 0, scoreOutOf20: 0, timeSpentSeconds: 0,
      raw: { selected: {}, text: {} },
      expiresAt: now + quiz.durationMinutes * 60_000,
    };
  }
  await store.saveSubmission(sub);
  const examQuiz = await effectiveQuiz(store, quiz, sub.variantId);
  return {
    phase: 'exam', token, submissionId: id,
    quiz: sanitizeQuizForStudent(examQuiz),
    submission: toPublic(sub), raw: sub.raw, lockSecondsRemaining: lockSeconds(sub),
    secondsRemaining: Math.max(0, Math.round((sub.expiresAt - now) / 1000)),
  };
}

async function loadAuthorizedSubmission(store: Store, body: any) {
  const id = str(body?.submissionId, 300, 'submissionId');
  const token = str(body?.token, 200, 'token');
  const sub = await store.getSubmission(id);
  if (!sub || !safeEqual(hashToken(token), sub.tokenHash)) throw new HttpError(401, 'Session étudiant invalide. Reconnectez-vous avec votre nom et le PIN.');
  const base = await store.getQuiz(sub.quizId);
  if (!base) throw new HttpError(404, 'Interrogation introuvable.');
  return { sub, quiz: await effectiveQuiz(store, base, sub.variantId) };
}

async function studentProgress(store: Store, body: any) {
  const { sub, quiz } = await loadAuthorizedSubmission(store, body);
  if (sub.status === 'completed') return { completed: true };
  const now = Date.now();
  if (now > sub.expiresAt + GRACE_MS) return { expired: true };
  const raw = cleanRaw(quiz, body);
  const idx = Math.min(quiz.questions.length, Math.max(0, Math.floor(Number(body?.currentQuestionIndex) || 0)));
  const durationMs = quiz.durationMinutes * 60_000;
  sub.raw = raw;
  sub.answers = partialAnswers(quiz, raw);
  sub.currentQuestionIndex = idx;
  sub.timeSpentSeconds = Math.max(0, Math.round((now - (sub.expiresAt - durationMs)) / 1000));
  await store.saveSubmission(sub);
  return { saved: true, lockSecondsRemaining: lockSeconds(sub), secondsRemaining: Math.max(0, Math.round((sub.expiresAt - now) / 1000)) };
}

const VIOLATIONS = ['blur', 'hidden', 'screenshot', 'print'] as const;

/** L'étudiant a quitté la fenêtre / tenté une capture : blocage de l'épreuve (durée fixée par l'enseignant). */
async function studentViolation(store: Store, body: any) {
  const { sub, quiz } = await loadAuthorizedSubmission(store, body);
  if (sub.status === 'completed' || quiz.lockOnLeave === false) return { lockSecondsRemaining: 0 };
  const type = VIOLATIONS.find((t) => t === body?.type);
  if (!type) throw bad('Type invalide');
  const now = Date.now();
  if (now < (sub.lockedUntil || 0)) return { lockSecondsRemaining: lockSeconds(sub) }; // déjà bloqué : pas de cumul
  sub.lockedUntil = now + (quiz.lockMinutes || 5) * 60_000;
  sub.violations = [...(sub.violations || []), { type, at: clock() }].slice(-200);
  await store.saveSubmission(sub);
  return { lockSecondsRemaining: lockSeconds(sub), count: sub.violations.length };
}

async function studentSubmit(store: Store, body: any) {
  const { sub, quiz } = await loadAuthorizedSubmission(store, body);
  if (sub.status === 'completed') {
    return { submission: toPublic(sub), quiz: canSeeCorrection(quiz) ? quiz : sanitizeQuizForStudent(quiz), correctionVisible: canSeeCorrection(quiz) };
  }
  const now = Date.now();
  // Au-delà de la durée + tolérance, seules les réponses déjà sauvegardées comptent.
  const raw = now > sub.expiresAt + GRACE_MS ? sub.raw : cleanRaw(quiz, body);
  const started = sub.expiresAt - quiz.durationMinutes * 60_000;
  const spent = Math.min(quiz.durationMinutes * 60, Math.max(0, Math.round((now - started) / 1000)));
  const graded = gradeQuiz(quiz, raw, spent);
  const done: StoredSubmission = {
    ...sub, raw, status: 'completed', submittedAt: clock(), currentQuestionIndex: quiz.questions.length,
    answers: graded.answers, totalScore: graded.totalScore, scoreOutOf20: graded.scoreOutOf20, timeSpentSeconds: spent,
  };
  await store.saveSubmission(done);
  return { submission: toPublic(done), quiz: canSeeCorrection(quiz) ? quiz : sanitizeQuizForStudent(quiz), correctionVisible: canSeeCorrection(quiz) };
}

// ---------- routes enseignant ----------
async function teacherState(store: Store, query: Record<string, string>) {
  const [quizzes, students] = await Promise.all([store.listQuizzes(), store.listStudents()]);
  const quizId = query.quizId && quizzes.some((q) => q.id === query.quizId) ? query.quizId : quizzes[0]?.id;
  const submissions = quizId ? (await store.listSubmissions(quizId)).map(toPublic) : [];
  return { quizzes, students, activeQuizId: quizId ?? null, submissions };
}

async function createQuiz(store: Store, body: any) {
  const q = validateQuiz(body);
  q.id = `quiz-${Date.now()}-${randomBytes(3).toString('hex')}`;
  q.pinCode = await uniquePin(store, q.pinCode);
  const { variants, ...stored } = q;
  await store.saveQuiz(stored as Quiz);
  if (variants?.length) await store.saveVariants(q.id, variants);
  return { quiz: stored };
}

async function updateQuiz(store: Store, id: string, body: any) {
  const existing = await store.getQuiz(id);
  if (!existing) throw new HttpError(404, 'Interrogation introuvable');
  // Mise à jour partielle du statut (ouvrir / clôturer / correction visible)
  const partial = body && !('questions' in body);
  const q = partial ? { ...existing } : validateQuiz(body, existing);
  if (partial) {
    if (['draft', 'active', 'completed'].includes(body.status)) q.status = body.status;
    if (typeof body.showCorrection === 'boolean') q.showCorrection = body.showCorrection;
  }
  q.pinCode = await uniquePin(store, q.pinCode, id);
  delete q.variants; // les variantes ne sont jamais modifiées par cette route
  await store.saveQuiz(q);
  return { quiz: q };
}

async function patchSubmission(store: Store, id: string, body: any) {
  const sub = await store.getSubmission(id);
  if (!sub) throw new HttpError(404, 'Copie introuvable');
  if (typeof body?.feedback === 'string') sub.teacherFeedback = body.feedback.slice(0, 4000);
  if (typeof body?.questionId === 'string') {
    const base = await store.getQuiz(sub.quizId);
    const quiz = base ? await effectiveQuiz(store, base, sub.variantId) : null;
    const q = quiz?.questions.find((x) => x.id === body.questionId);
    const ans = sub.answers[body.questionId];
    if (!quiz || !q || !ans) throw bad('Question ou réponse introuvable');
    const score = Number(body.score);
    if (!Number.isFinite(score)) throw bad('Note invalide');
    ans.scoreAwarded = Math.max(0, Math.min(q.points, score));
    ans.isCorrect = ans.scoreAwarded > 0;
    ans.isEvaluated = true;
    if (typeof body.comment === 'string') ans.teacherComment = body.comment.slice(0, 2000);
    sub.totalScore = Object.values(sub.answers).reduce((s, a) => s + (a.scoreAwarded || 0), 0);
    sub.scoreOutOf20 = Number(Math.min(20, (sub.totalScore / (quiz.totalPoints || 20)) * 20).toFixed(1));
  }
  await store.saveSubmission(sub);
  return { submission: toPublic(sub) };
}

async function addStudent(store: Store, body: any) {
  const s: ClassStudent = {
    id: `st-${Date.now()}-${randomBytes(2).toString('hex')}`,
    name: str(body?.name, 120, 'name'), matricule: str(body?.matricule, 40, 'matricule'),
    avatar: initials(str(body?.name, 120, 'name')), email: str(body?.email, 200, 'email', false),
    group: str(body?.group, 120, 'group', false), historicalAverage: Math.min(20, Math.max(0, Number(body?.historicalAverage) || 0)),
  };
  await store.saveStudent(s);
  return { student: s };
}

// ---------- routeur ----------
export async function handle(req: ApiRequest): Promise<ApiResponse> {
  try {
    const path = req.path.replace(/^\/api/, '').replace(/\/+$/, '') || '/';
    const m = req.method.toUpperCase();
    const seg = path.split('/').filter(Boolean);

    if (m === 'GET' && path === '/health') return { status: 200, body: { ok: true } };

    // Connexion enseignant
    if (m === 'POST' && path === '/teacher/login') {
      let okPw = false;
      try { okPw = checkTeacherPassword(String(req.body?.password ?? '')); } catch (e) { throw new HttpError(500, 'Serveur mal configuré (TEACHER_PASSWORD).'); }
      if (!okPw) { await new Promise((r) => setTimeout(r, 600)); throw new HttpError(401, 'Mot de passe incorrect.'); }
      return { status: 200, body: issueTeacherToken() };
    }

    // Étudiants (pas de session enseignant requise)
    if (seg[0] === 'student' && m === 'POST') {
      const store = await getStore();
      if (seg[1] === 'join') return { status: 200, body: await studentJoin(store, req.body) };
      if (seg[1] === 'progress') return { status: 200, body: await studentProgress(store, req.body) };
      if (seg[1] === 'violation') return { status: 200, body: await studentViolation(store, req.body) };
      if (seg[1] === 'submit') return { status: 200, body: await studentSubmit(store, req.body) };
    }

    // Enseignant : tout le reste exige un jeton valide
    if (seg[0] === 'teacher') {
      if (!verifyTeacherToken(req.headers['authorization'])) throw new HttpError(401, 'Session enseignant expirée. Reconnectez-vous.');
      const store = await getStore();
      if (m === 'GET' && seg[1] === 'session') return { status: 200, body: { ok: true } };
      if (m === 'GET' && seg[1] === 'state') return { status: 200, body: await teacherState(store, req.query) };
      if (m === 'POST' && seg[1] === 'quizzes' && seg.length === 2) return { status: 201, body: await createQuiz(store, req.body) };
      if (seg[1] === 'quizzes' && seg.length === 3) {
        if (m === 'PUT' || m === 'PATCH') return { status: 200, body: await updateQuiz(store, seg[2], req.body) };
        if (m === 'DELETE') { await store.deleteQuiz(seg[2]); return { status: 200, body: { ok: true } }; }
      }
      if (m === 'GET' && seg[1] === 'quizzes' && seg[3] === 'variants' && seg.length === 5) {
        const v = await store.getVariant(decodeURIComponent(seg[2]), decodeURIComponent(seg[4]));
        if (!v) throw new HttpError(404, 'Variante introuvable');
        return { status: 200, body: { variant: v } };
      }
      if (m === 'POST' && seg[1] === 'quizzes' && seg[3] === 'reset') {
        await store.deleteSubmissionsByQuiz(seg[2]); return { status: 200, body: { ok: true } };
      }
      if (m === 'PATCH' && seg[1] === 'submissions' && seg.length === 3) return { status: 200, body: await patchSubmission(store, decodeURIComponent(seg[2]), req.body) };
      if (m === 'POST' && seg[1] === 'students') return { status: 201, body: await addStudent(store, req.body) };
      if (m === 'POST' && seg[1] === 'generate') {
        const topic = str(req.body?.topic, 300, 'topic');
        const count = Math.min(15, Math.max(1, Math.round(Number(req.body?.questionCount) || 5)));
        return { status: 200, body: await generateQuestions({ topic, level: str(req.body?.level, 100, 'level', false), questionCount: count }) };
      }
    }

    throw new HttpError(404, 'Route introuvable');
  } catch (e) {
    if (e instanceof HttpError) return { status: e.status, body: { error: e.message } };
    console.error('[evalis] erreur serveur', e);
    return { status: 500, body: { error: 'Erreur serveur' } };
  }
}
