import type { Quiz, QuizVariant, ClassStudent, StudentSubmission, Question } from '../types/quiz';

const TOKEN_KEY = 'evalis.teacherToken';
const store = {
  get: () => { try { return sessionStorage.getItem(TOKEN_KEY); } catch { return null; } },
  set: (v: string) => { try { sessionStorage.setItem(TOKEN_KEY, v); } catch { /* ignore */ } },
  clear: () => { try { sessionStorage.removeItem(TOKEN_KEY); } catch { /* ignore */ } },
};

export class ApiError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

let onUnauthorized: (() => void) | null = null;
export const setUnauthorizedHandler = (fn: (() => void) | null) => { onUnauthorized = fn; };

async function request<T>(method: string, path: string, body?: unknown, teacher = false): Promise<T> {
  const headers: Record<string, string> = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (teacher) {
    const t = store.get();
    if (t) headers['Authorization'] = `Bearer ${t}`;
  }
  let res: Response;
  try {
    res = await fetch(`/api${path}`, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined });
  } catch {
    throw new ApiError(0, 'Connexion au serveur impossible. Vérifiez votre réseau.');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (teacher && res.status === 401) { store.clear(); onUnauthorized?.(); }
    throw new ApiError(res.status, (data as any)?.error || `Erreur ${res.status}`);
  }
  return data as T;
}

// ---- Types des réponses ----
export interface StudentSession {
  phase: 'exam' | 'completed';
  token?: string;
  submissionId?: string;
  quiz: Quiz;
  submission: StudentSubmission;
  raw?: { selected: Record<string, string[]>; text: Record<string, string> };
  secondsRemaining?: number;
  lockSecondsRemaining?: number;
  correctionVisible?: boolean;
}
export interface SubmitResult { submission: StudentSubmission; quiz: Quiz; correctionVisible: boolean }
export interface TeacherState { quizzes: Quiz[]; students: ClassStudent[]; activeQuizId: string | null; submissions: StudentSubmission[] }

// ---- Étudiant ----
export const studentApi = {
  join: (name: string, pin: string) => request<StudentSession>('POST', '/student/join', { name, pin }),
  progress: (auth: { submissionId: string; token: string }, payload: {
    selected: Record<string, string[]>; text: Record<string, string>; currentQuestionIndex: number }) =>
    request<{ saved?: boolean; expired?: boolean; completed?: boolean; lockSecondsRemaining?: number }>('POST', '/student/progress', { ...auth, ...payload }),
  violation: (auth: { submissionId: string; token: string }, type: 'blur' | 'hidden' | 'screenshot' | 'print') =>
    request<{ lockSecondsRemaining: number }>('POST', '/student/violation', { ...auth, type }),
  submit: (auth: { submissionId: string; token: string }, payload: { selected: Record<string, string[]>; text: Record<string, string> }) =>
    request<SubmitResult>('POST', '/student/submit', { ...auth, ...payload }),
};

// ---- Enseignant ----
export const teacherApi = {
  hasToken: () => Boolean(store.get()),
  login: async (password: string) => {
    const r = await request<{ token: string; expiresAt: number }>('POST', '/teacher/login', { password });
    store.set(r.token);
  },
  logout: () => store.clear(),
  checkSession: () => request<{ ok: boolean }>('GET', '/teacher/session', undefined, true),
  state: (quizId?: string | null) =>
    request<TeacherState>('GET', `/teacher/state${quizId ? `?quizId=${encodeURIComponent(quizId)}` : ''}`, undefined, true),
  createQuiz: (quiz: Partial<Quiz>) => request<{ quiz: Quiz }>('POST', '/teacher/quizzes', quiz, true),
  updateQuiz: (id: string, patch: Partial<Quiz>) => request<{ quiz: Quiz }>('PATCH', `/teacher/quizzes/${encodeURIComponent(id)}`, patch, true),
  deleteQuiz: (id: string) => request<{ ok: boolean }>('DELETE', `/teacher/quizzes/${encodeURIComponent(id)}`, undefined, true),
  variant: (quizId: string, variantId: string) =>
    request<{ variant: QuizVariant }>('GET', `/teacher/quizzes/${encodeURIComponent(quizId)}/variants/${encodeURIComponent(variantId)}`, undefined, true),
  resetQuiz: (id: string) => request<{ ok: boolean }>('POST', `/teacher/quizzes/${encodeURIComponent(id)}/reset`, {}, true),
  gradeAnswer: (submissionId: string, questionId: string, score: number, comment?: string) =>
    request<{ submission: StudentSubmission }>('PATCH', `/teacher/submissions/${encodeURIComponent(submissionId)}`, { questionId, score, comment }, true),
  setFeedback: (submissionId: string, feedback: string) =>
    request<{ submission: StudentSubmission }>('PATCH', `/teacher/submissions/${encodeURIComponent(submissionId)}`, { feedback }, true),
  addStudent: (s: Partial<ClassStudent>) => request<{ student: ClassStudent }>('POST', '/teacher/students', s, true),
  generate: (p: { topic: string; level: string; questionCount: number }) =>
    request<{ questions: Question[]; source: 'gemini' | 'template' }>('POST', '/teacher/generate', p, true),
};
