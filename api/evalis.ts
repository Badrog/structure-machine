import type { VercelRequest, VercelResponse } from '@vercel/node';
import { handle } from './_lib/handlers.js';

// Toutes les requêtes /api/... sont redirigées ici par vercel.json (le chemin d'origine arrive dans ?__path=).
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const url = new URL(req.url || '/', 'http://localhost');
  const query: Record<string, string> = {};
  url.searchParams.forEach((v, k) => { query[k] = v; });
  const sub = String(query.__path ?? '').replace(/^\/+/, '');
  delete query.__path;
  const path = sub ? `/api/${sub}` : url.pathname;
  const headers: Record<string, string | undefined> = {};
  for (const [k, v] of Object.entries(req.headers)) headers[k.toLowerCase()] = Array.isArray(v) ? v[0] : v;

  const out = await handle({ method: req.method || 'GET', path, query, headers, body: req.body });
  res.setHeader('Cache-Control', 'no-store');
  res.status(out.status).json(out.body);
}
