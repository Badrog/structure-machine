import { createHmac, timingSafeEqual, randomBytes, createHash } from 'node:crypto';

const TTL_MS = 12 * 60 * 60 * 1000; // session prof : 12 h

function secret(): string {
  const s = process.env.AUTH_SECRET;
  if (s && s.length >= 16) return s;
  if (process.env.VERCEL) throw new Error('AUTH_SECRET manquant (16 caractères minimum)');
  return 'dev-only-secret-change-me';
}
const b64 = (b: Buffer | string) => Buffer.from(b).toString('base64url');
const sign = (payload: string) => createHmac('sha256', secret()).update(payload).digest('base64url');

export function safeEqual(a: string, b: string): boolean {
  const ha = createHash('sha256').update(a).digest();
  const hb = createHash('sha256').update(b).digest();
  return timingSafeEqual(ha, hb);
}

export function checkTeacherPassword(pw: string): boolean {
  const expected = process.env.TEACHER_PASSWORD || (process.env.VERCEL ? '' : 'prof1234');
  if (!expected) throw new Error('TEACHER_PASSWORD manquant');
  return safeEqual(pw, expected);
}

export function issueTeacherToken(): { token: string; expiresAt: number } {
  const expiresAt = Date.now() + TTL_MS;
  const payload = b64(JSON.stringify({ role: 'teacher', exp: expiresAt }));
  return { token: `${payload}.${sign(payload)}`, expiresAt };
}

export function verifyTeacherToken(authHeader?: string): boolean {
  const m = /^Bearer (.+)$/.exec(authHeader || '');
  if (!m) return false;
  const [payload, sig] = m[1].split('.');
  if (!payload || !sig) return false;
  if (!safeEqual(sig, sign(payload))) return false;
  try {
    const { role, exp } = JSON.parse(Buffer.from(payload, 'base64url').toString());
    return role === 'teacher' && typeof exp === 'number' && exp > Date.now();
  } catch { return false; }
}

/** Jeton secret remis à l'étudiant ; seul son hash est stocké. */
export function newStudentToken(): { token: string; hash: string } {
  const token = randomBytes(24).toString('base64url');
  return { token, hash: hashToken(token) };
}
export const hashToken = (t: string) => createHash('sha256').update(t).digest('hex');
