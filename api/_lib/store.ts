import type { Quiz, QuizVariant, ClassStudent, StudentSubmission } from '../../src/types/quiz';

/** Soumission telle que stockée côté serveur (contient des champs privés). */
export interface StoredSubmission extends StudentSubmission {
  quizId: string;
  tokenHash: string;
  raw: { selected: Record<string, string[]>; text: Record<string, string> };
  expiresAt: number; // timestamp ms de fin autorisée (début + durée)
  lockedUntil?: number; // fin du blocage anti-triche (ms)
}

export interface Store {
  listQuizzes(): Promise<Quiz[]>;
  getQuiz(id: string): Promise<Quiz | null>;
  getQuizByPin(pin: string): Promise<Quiz | null>;
  saveQuiz(q: Quiz): Promise<void>;
  deleteQuiz(id: string): Promise<void>;
  listStudents(): Promise<ClassStudent[]>;
  saveStudent(s: ClassStudent): Promise<void>;
  listSubmissions(quizId: string): Promise<StoredSubmission[]>;
  getSubmission(id: string): Promise<StoredSubmission | null>;
  saveSubmission(s: StoredSubmission): Promise<void>;
  deleteSubmissionsByQuiz(quizId: string): Promise<void>;
  /** Variantes d'une interrogation (stockées à part : un étudiant ne charge que la sienne). */
  saveVariants(quizId: string, variants: QuizVariant[]): Promise<void>;
  getVariant(quizId: string, variantId: string): Promise<QuizVariant | null>;
}

export const normalizePin = (pin: string) => pin.trim().toUpperCase().replace(/^#/, '');

// ---------------------------------------------------------------------------
// Mémoire (tests / développement sans Supabase). Données perdues au redémarrage.
// ---------------------------------------------------------------------------
export function createMemoryStore(): Store {
  const quizzes = new Map<string, Quiz>();
  const students = new Map<string, ClassStudent>();
  const subs = new Map<string, StoredSubmission>();
  const variants = new Map<string, QuizVariant>(); // clé : "<quizId>|<variantId>"
  const clone = <T,>(x: T): T => JSON.parse(JSON.stringify(x));
  return {
    async listQuizzes() { return [...quizzes.values()].map(clone).sort((a, b) => b.createdAt.localeCompare(a.createdAt)); },
    async getQuiz(id) { const q = quizzes.get(id); return q ? clone(q) : null; },
    async getQuizByPin(pin) {
      const n = normalizePin(pin);
      const q = [...quizzes.values()].find((x) => normalizePin(x.pinCode) === n);
      return q ? clone(q) : null;
    },
    async saveQuiz(q) { quizzes.set(q.id, clone(q)); },
    async deleteQuiz(id) {
      quizzes.delete(id);
      for (const [k, v] of subs) if (v.quizId === id) subs.delete(k);
      for (const k of [...variants.keys()]) if (k.startsWith(`${id}|`)) variants.delete(k);
    },
    async listStudents() { return [...students.values()].map(clone); },
    async saveStudent(s) { students.set(s.id, clone(s)); },
    async listSubmissions(quizId) { return [...subs.values()].filter((s) => s.quizId === quizId).map(clone); },
    async getSubmission(id) { const s = subs.get(id); return s ? clone(s) : null; },
    async saveSubmission(s) { subs.set(s.id, clone(s)); },
    async deleteSubmissionsByQuiz(quizId) { for (const [k, v] of subs) if (v.quizId === quizId) subs.delete(k); },
    async saveVariants(quizId, list) { for (const v of list) variants.set(`${quizId}|${v.id}`, clone(v)); },
    async getVariant(quizId, variantId) { const v = variants.get(`${quizId}|${variantId}`); return v ? clone(v) : null; },
  };
}

// ---------------------------------------------------------------------------
// Supabase (production). Utilise la clé service_role, JAMAIS exposée au navigateur.
// ---------------------------------------------------------------------------
export async function createSupabaseStore(url: string, serviceKey: string): Promise<Store> {
  const { createClient } = await import('@supabase/supabase-js');
  const db = createClient(url, serviceKey, { auth: { persistSession: false } });
  const ok = <T,>(r: { data: T; error: { message: string } | null }): T => {
    if (r.error) throw new Error(`Supabase: ${r.error.message}`);
    return r.data;
  };
  return {
    async listQuizzes() {
      const rows = ok(await db.from('quizzes').select('data').order('created_at', { ascending: false }));
      return (rows ?? []).map((r: any) => r.data as Quiz);
    },
    async getQuiz(id) {
      const r = ok(await db.from('quizzes').select('data').eq('id', id).maybeSingle());
      return r ? (r as any).data : null;
    },
    async getQuizByPin(pin) {
      const r = ok(await db.from('quizzes').select('data').eq('pin', normalizePin(pin)).maybeSingle());
      return r ? (r as any).data : null;
    },
    async saveQuiz(q) {
      ok(await db.from('quizzes').upsert({ id: q.id, pin: normalizePin(q.pinCode), status: q.status, data: q }));
    },
    async deleteQuiz(id) { ok(await db.from('quizzes').delete().eq('id', id)); },
    async listStudents() {
      const rows = ok(await db.from('students').select('data').order('created_at', { ascending: true }));
      return (rows ?? []).map((r: any) => r.data as ClassStudent);
    },
    async saveStudent(s) { ok(await db.from('students').upsert({ id: s.id, data: s })); },
    async listSubmissions(quizId) {
      const rows = ok(await db.from('submissions').select('data').eq('quiz_id', quizId));
      return (rows ?? []).map((r: any) => r.data as StoredSubmission);
    },
    async getSubmission(id) {
      const r = ok(await db.from('submissions').select('data').eq('id', id).maybeSingle());
      return r ? (r as any).data : null;
    },
    async saveSubmission(s) {
      ok(await db.from('submissions').upsert({
        id: s.id, quiz_id: s.quizId, status: s.status, data: s, updated_at: new Date().toISOString(),
      }));
    },
    async deleteSubmissionsByQuiz(quizId) { ok(await db.from('submissions').delete().eq('quiz_id', quizId)); },
    async saveVariants(quizId, list) {
      if (!list.length) return;
      ok(await db.from('quiz_variants').upsert(list.map((v) => ({ quiz_id: quizId, variant_id: v.id, data: v }))));
    },
    async getVariant(quizId, variantId) {
      const r = ok(await db.from('quiz_variants').select('data').eq('quiz_id', quizId).eq('variant_id', variantId).maybeSingle());
      return r ? (r as any).data : null;
    },
  };
}

let cached: Store | null = null;
export async function getStore(): Promise<Store> {
  if (cached) return cached;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (url && key) cached = await createSupabaseStore(url, key);
  else {
    if (process.env.VERCEL) throw new Error('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY manquants');
    console.warn('[evalis] Supabase non configuré : stockage en MÉMOIRE (données perdues au redémarrage).');
    cached = createMemoryStore();
  }
  return cached;
}
export function setStoreForTests(s: Store | null) { cached = s; }
