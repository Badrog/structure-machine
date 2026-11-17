import type { VercelRequest, VercelResponse } from '@vercel/node';
import { handle } from './_lib/handlers.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const url = new URL(req.url || '/', 'http://localhost');
  const query: Record<string, string> = {};
  url.searchParams.forEach((v, k) => { query[k] = v; });
  const headers: Record<string, string | undefined> = {};
  for (const [k, v] of Object.entries(req.headers)) headers[k.toLowerCase()] = Array.isArray(v) ? v[0] : v;

  const out = await handle({ method: req.method || 'GET', path: url.pathname, query, headers, body: req.body });
  res.setHeader('Cache-Control', 'no-store');
  res.status(out.status).json(out.body);
}
