// Serveur API local pour le développement : `npm run dev:api` (le front le proxifie via /api).
import { createServer } from 'node:http';
import { handle } from './api/_lib/handlers.js';

const PORT = Number(process.env.API_PORT || 3001);
createServer(async (req, res) => {
  const chunks: Buffer[] = [];
  for await (const c of req) chunks.push(c as Buffer);
  const text = Buffer.concat(chunks).toString();
  let body: any; try { body = text ? JSON.parse(text) : undefined; } catch { body = undefined; }
  const url = new URL(req.url || '/', 'http://localhost');
  const query: Record<string, string> = {}; url.searchParams.forEach((v, k) => { query[k] = v; });
  const headers: Record<string, string | undefined> = {};
  for (const [k, v] of Object.entries(req.headers)) headers[k.toLowerCase()] = Array.isArray(v) ? v[0] : v;
  const out = await handle({ method: req.method || 'GET', path: url.pathname, query, headers, body });
  res.writeHead(out.status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(out.body));
}).listen(PORT, () => console.log(`[evalis] API locale sur http://localhost:${PORT}`));
