import assert from 'node:assert/strict';
import { handle } from '../api/_lib/handlers.js';
import { setStoreForTests, createMemoryStore } from '../api/_lib/store.js';

setStoreForTests(createMemoryStore());
const call = (method: string, path: string, body?: any, token?: string, query: Record<string, string> = {}) =>
  handle({ method, path, query, headers: token ? { authorization: `Bearer ${token}` } : {}, body });

const quizBody = {
  title: 'Test', subject: 'Algo', level: 'L2', classGroup: 'A', durationMinutes: 20, totalPoints: 10, pinCode: '#TEST-1', status: 'active',
  questions: [
    { id: 'q1', type: 'direct_short', title: 'Complexité ?', points: 3, correctAnswerText: 'O(n²)', acceptedKeywords: ['quadratique'], explanation: 'x' },
    { id: 'q2', type: 'direct_open', title: 'Explique', points: 5, correctAnswerText: 'long', acceptedKeywords: ['collision', 'chaînage'], explanation: 'y' },
    { id: 'q3', type: 'single_choice', title: 'QCM', points: 2, options: [{ id: 'a', text: 'A', isCorrect: true }, { id: 'b', text: 'B', isCorrect: false }], explanation: 'z' },
  ],
};

// Le corrigé fuit-il ? (champs de correction présents dans le quiz renvoyé)
const keyLeaked = (b: any) => (b.quiz?.questions || []).some((q: any) => q.correctAnswerText || q.acceptedKeywords || q.gradingCriteria || q.explanation || (q.options || []).some((o: any) => o.isCorrect));
let n = 0; const ok = (name: string) => console.log(`  ✓ ${++n}. ${name}`);

// --- auth ---
assert.equal((await call('GET', '/api/teacher/state')).status, 401); ok('enseignant sans jeton => 401');
assert.equal((await call('GET', '/api/teacher/state', undefined, 'faux.jeton')).status, 401); ok('jeton falsifié => 401');
assert.equal((await call('POST', '/api/teacher/login', { password: 'mauvais' })).status, 401); ok('mauvais mot de passe => 401');
const login = await call('POST', '/api/teacher/login', { password: 'prof1234' });
assert.equal(login.status, 200);
const T = (login.body as any).token; ok('connexion enseignant');

// --- création quiz ---
const created = await call('POST', '/api/teacher/quizzes', quizBody, T);
assert.equal(created.status, 201);
const quiz = (created.body as any).quiz; ok('création quiz');
assert.equal((await call('POST', '/api/teacher/quizzes', { ...quizBody, questions: [] }, T)).status, 400); ok('quiz sans question => 400');
const dup = (await call('POST', '/api/teacher/quizzes', quizBody, T)).body as any;
assert.notEqual(dup.quiz.pinCode, quiz.pinCode); ok('PIN en double => régénéré');
await call('DELETE', `/api/teacher/quizzes/${dup.quiz.id}`, undefined, T);

// --- étudiant : join ne fuit aucune réponse ---
const j = await call('POST', '/api/student/join', { name: 'Youssef Amrani', pin: 'test-1' });
assert.equal(j.status, 200);
const jb = j.body as any;
const dump = JSON.stringify(jb);
assert.ok(!dump.includes('O(n²)') && !dump.includes('quadratique') && !keyLeaked(jb) && !dump.includes('tokenHash'), 'fuite de réponse');
ok('join (PIN insensible à la casse/#) sans fuite des bonnes réponses');
assert.equal((await call('POST', '/api/student/join', { name: 'X Y Z', pin: 'NOPE' })).status, 404); ok('mauvais PIN => 404');

// --- progression ---
const auth = { submissionId: jb.submissionId, token: jb.token };
assert.equal((await call('POST', '/api/student/progress', { ...auth, token: 'faux' })).status, 401); ok('progress avec faux jeton => 401');
const pr = await call('POST', '/api/student/progress', { ...auth, text: { q1: 'quadratique', FAKE: 'x' }, selected: { q3: ['a', 'zzz'] }, currentQuestionIndex: 1 });
assert.equal(pr.status, 200);
let st: any = (await call('GET', '/api/teacher/state', undefined, T, { quizId: quiz.id })).body;
assert.equal(st.submissions.length, 1);
assert.equal(Object.keys(st.submissions[0].answers).length, 2);
assert.ok(!('tokenHash' in st.submissions[0]) && !('raw' in st.submissions[0])); ok('suivi en direct côté prof (sans champs privés)');

// --- anti-triche : blocage ---
const v1 = (await call('POST', '/api/student/violation', { ...auth, type: 'blur' })).body as any;
assert.ok(v1.lockSecondsRemaining > 290 && v1.lockSecondsRemaining <= 300); ok('sortie de fenêtre => blocage de 5 min');
const v2 = (await call('POST', '/api/student/violation', { ...auth, type: 'screenshot' })).body as any;
assert.ok(v2.lockSecondsRemaining > 0 && !('count' in v2)); ok('incident pendant le blocage : pas de cumul');
assert.equal((await call('POST', '/api/student/violation', { ...auth, type: 'blur', token: 'faux' })).status, 401); ok('violation avec faux jeton => 401');
assert.equal((await call('POST', '/api/student/violation', { ...auth, type: 'nimporte' })).status, 400);
st = (await call('GET', '/api/teacher/state', undefined, T, { quizId: quiz.id })).body as any;
assert.equal(st.submissions[0].violations.length, 1); assert.equal(st.submissions[0].violations[0].type, 'blur'); ok('le professeur voit l\'incident');

// --- reprise ---
const j2 = (await call('POST', '/api/student/join', { name: 'youssef  AMRANI', pin: '#TEST-1' })).body as any;
assert.equal(j2.phase, 'exam'); assert.ok(j2.lockSecondsRemaining > 250, 'le blocage survit au rechargement'); assert.equal(j2.raw.text.q1, 'quadratique'); assert.notEqual(j2.token, jb.token);
assert.equal((await call('POST', '/api/student/progress', { ...auth })).status, 401); ok('reprise de session (ancien jeton invalidé)');

// --- soumission & correction serveur ---
const auth2 = { submissionId: j2.submissionId, token: j2.token };
const sb = await call('POST', '/api/student/submit', { ...auth2, text: { q1: 'quadratique', q2: 'une collision et le chaînage' }, selected: { q3: ['a'] } });
assert.equal(sb.status, 200);
const sbb = sb.body as any;
assert.equal(sbb.submission.totalScore, 10); assert.equal(sbb.submission.scoreOutOf20, 20);
assert.ok(!keyLeaked(sbb));
assert.equal(sbb.correctionVisible, false); ok('correction serveur (10/10) ; corrigé masqué tant que non autorisé');
const again = (await call('POST', '/api/student/submit', { ...auth2, text: { q1: '' } })).body as any;
assert.equal(again.submission.totalScore, 10); ok('re-soumission idempotente (pas de triche)');
assert.equal((await call('POST', '/api/student/progress', { ...auth2 })).status === 200, true);

// --- re-join après remise : pas de corrigé avant clôture ---
const rj = (await call('POST', '/api/student/join', { name: 'Youssef Amrani', pin: '#TEST-1' })).body as any;
assert.equal(rj.phase, 'completed'); assert.ok(!keyLeaked(rj)); ok('re-join après remise => résultat, sans corrigé');

// --- notation prof ---
const subId = sbb.submission.id;
const g = (await call('PATCH', `/api/teacher/submissions/${encodeURIComponent(subId)}`, { questionId: 'q2', score: 99, comment: 'ok' }, T)).body as any;
assert.equal(g.submission.answers.q2.scoreAwarded, 5); assert.equal(g.submission.answers.q2.isEvaluated, true); ok('note plafonnée au barème de la question');
await call('PATCH', `/api/teacher/submissions/${encodeURIComponent(subId)}`, { questionId: 'q2', score: 1 }, T);
st = (await call('GET', '/api/teacher/state', undefined, T, { quizId: quiz.id })).body;
assert.equal(st.submissions[0].totalScore, 6); assert.equal(st.submissions[0].scoreOutOf20, 12); ok('recalcul du total');

// --- clôture => corrigé visible ---
await call('PATCH', `/api/teacher/quizzes/${quiz.id}`, { status: 'completed' }, T);
const cj = (await call('POST', '/api/student/join', { name: 'Youssef Amrani', pin: '#TEST-1' })).body as any;
assert.ok(keyLeaked(cj)); ok('quiz clôturé => corrigé visible');
const late = await call('POST', '/api/student/join', { name: 'Nouveau Etudiant', pin: '#TEST-1' });
assert.equal(late.status, 403); ok('nouvel étudiant sur quiz clôturé => 403');

// --- reset + delete ---
await call('POST', `/api/teacher/quizzes/${quiz.id}/reset`, undefined, T);
st = (await call('GET', '/api/teacher/state', undefined, T, { quizId: quiz.id })).body; assert.equal(st.submissions.length, 0); ok('réinitialisation de session');
const gen = (await call('POST', '/api/teacher/generate', { topic: 'Thermodynamique', level: 'L2', questionCount: 3 }, T)).body as any;
assert.equal(gen.source, 'template'); assert.ok(gen.questions.length >= 3); ok('génération (modèle de secours sans clé Gemini)');
// --- interrogation à variantes (FR/EN, 30 variantes, 3 groupes) ---
{
  const { readFileSync } = await import('node:fs');
  const data = JSON.parse(readFileSync(new URL('../seed/interroNumeration.json', import.meta.url), 'utf8'));
  assert.equal(data.variants.length, 30);
  const mk = (g: number) => ({ ...data.meta, classGroup: `Groupe ${g}`, title: `${data.meta.title} — Groupe ${g}`, pinCode: `#SM1-G${g}`, status: 'active', gradeScale: 4, variants: data.variants });
  const groups: any[] = [];
  for (const g of [1, 2, 3]) {
    const r = await call('POST', '/api/teacher/quizzes', mk(g), T);
    assert.equal(r.status, 201); groups.push((r.body as any).quiz);
  }
  assert.equal(groups[0].variantList.length, 30); assert.equal(groups[0].gradeScale, 4); assert.equal(groups[0].questions.length, 12); assert.ok(!('variants' in groups[0]));
  assert.notEqual(groups[0].pinCode, groups[1].pinCode); ok('3 interrogations (une par groupe), 30 variantes chacune, squelette sans contenu');
  const bad = JSON.parse(JSON.stringify(mk(1))); bad.variants[3].questions.pop();
  assert.equal((await call('POST', '/api/teacher/quizzes', bad, T)).status, 400); ok('variantes de structures différentes => 400');
  const stV: any = (await call('GET', '/api/teacher/state', undefined, T, { quizId: groups[0].id })).body;
  assert.ok(JSON.stringify(stV).length < 60_000, 'le suivi en direct ne doit pas embarquer les variantes'); ok('suivi en direct léger (variantes non incluses)');

  // 30 étudiants du groupe 2 => 30 variantes distinctes
  const seen = new Set<string>(); let first: any;
  for (let i = 0; i < 30; i++) {
    const r = (await call('POST', '/api/student/join', { name: `Etudiant Numero${i}`, pin: '#SM1-G2' })).body as any;
    assert.equal(r.phase, 'exam'); seen.add(r.submission.variantId); if (i === 0) first = r;
    assert.ok(!keyLeaked(r)); assert.equal(r.quiz.questions.length, 12); assert.ok(r.quiz.questions[0].i18n.en.title); assert.ok(!('ar' in r.quiz.questions[0].i18n));
    assert.ok(!JSON.stringify(r).includes('partialCredit'));
  }
  assert.equal(seen.size, 30); ok('30 étudiants => 30 variantes distinctes (aucune répétition), FR+EN, sans fuite');
  const rj2 = (await call('POST', '/api/student/join', { name: 'etudiant numero0', pin: '#SM1-G2' })).body as any;
  assert.equal(rj2.submission.variantId, first.submission.variantId); assert.equal(rj2.quiz.questions[0].title, first.quiz.questions[0].title); ok('reprise : même variante');
  const r31 = (await call('POST', '/api/student/join', { name: 'Etudiant Trente-et-un', pin: '#SM1-G2' })).body as any;
  assert.ok(r31.submission.variantId); ok('31e étudiant : variante réutilisée sans erreur');

  // correction avec demi-point : on lit le corrigé de la variante de l'étudiant 0 via la route prof
  const vid = first.submission.variantId;
  const vr: any = (await call('GET', `/api/teacher/quizzes/${groups[1].id}/variants/${vid}`, undefined, T)).body;
  assert.equal(vr.variant.questions.length, 12);
  const key = (q: any) => q.options.filter((o: any) => o.isCorrect).map((o: any) => o.id);
  const selected: Record<string, string[]> = {};
  const text: Record<string, string> = {};
  vr.variant.questions.forEach((q: any) => { if (q.type === 'direct_short') text[q.id] = q.correctAnswerText; else selected[q.id] = key(q); });
  // Q1 (partie A) : on ne coche qu'une partie des bonnes réponses => 0,5 si >1 bonne réponse
  const q1 = vr.variant.questions[0]; const k1 = key(q1);
  selected[q1.id] = [k1[0]];
  // Q2 (partie A) : bonne + une fausse => 0
  const q2 = vr.variant.questions[1]; const wrong = q2.options.find((o: any) => !o.isCorrect).id;
  selected[q2.id] = [...key(q2), wrong];
  const a1 = { submissionId: first.submissionId, token: rj2.token };
  const sub = (await call('POST', '/api/student/submit', { ...a1, selected, text })).body as any;
  const expected = 11 + 1 - (k1.length > 1 ? 0.5 : 0) - 1; // 12 questions ; q1 partielle ; q2 fausse
  assert.equal(sub.submission.totalScore, expected); ok('barème partie A : exact=1, incomplet sans erreur=0,5, case fausse=0 ; bonus compté');
  assert.equal(sub.submission.scoreOutOf20, Math.min(20, Number(((expected / 11) * 20).toFixed(1)))); ok('note /20 plafonnée à 20 (bonus)');
  assert.ok(!keyLeaked(sub)); assert.ok(!JSON.stringify(sub).includes('"explanation":"a)'));
  // vue prof : la copie référence sa variante ; la route variante est protégée
  assert.equal((await call('GET', `/api/teacher/quizzes/${groups[1].id}/variants/${vid}`)).status, 401); ok('route variante réservée au prof');
  // correction manuelle d'une question : fonctionne avec les questions de la variante
  const pg = (await call('PATCH', `/api/teacher/submissions/${encodeURIComponent(sub.submission.id)}`, { questionId: q2.id, score: 1 }, T)).body as any;
  assert.equal(pg.submission.answers[q2.id].scoreAwarded, 1); ok('notation manuelle sur copie à variante');
  // modification du quiz (titre/durée) ne supprime pas les variantes
  const up = await call('PUT', `/api/teacher/quizzes/${groups[1].id}`, { ...groups[1], title: 'Renommé', durationMinutes: 30, questions: [] }, T);
  assert.equal(up.status, 200); assert.equal((up.body as any).quiz.variantList.length, 30);
  assert.equal(((await call('GET', `/api/teacher/quizzes/${groups[1].id}/variants/${vid}`, undefined, T)).body as any).variant.questions.length, 12); ok('édition du quiz : variantes conservées');
  await call('DELETE', `/api/teacher/quizzes/${groups[1].id}`, undefined, T);
  assert.equal((await call('GET', `/api/teacher/quizzes/${groups[1].id}/variants/${vid}`, undefined, T)).status, 404); ok('suppression : variantes supprimées');
}
console.log(`\n${n} tests OK`);
