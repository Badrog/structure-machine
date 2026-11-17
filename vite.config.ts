import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv, type Plugin} from 'vite';

// En développement, l'API (dossier api/) tourne DANS le serveur Vite : un seul `npm run dev` suffit.
// En production, Vercel exécute api/[...path].ts comme fonction serverless.
function evalisDevApi(mode: string): Plugin {
  return {
    name: 'evalis-dev-api',
    apply: 'serve',
    configureServer(server) {
      // Rend .env.local (SUPABASE_URL, TEACHER_PASSWORD, ...) disponible pour l'API
      const env = loadEnv(mode, process.cwd(), '');
      for (const [k, v] of Object.entries(env)) if (process.env[k] === undefined) process.env[k] = v;

      server.middlewares.use('/api', async (req, res) => {
        try {
          const chunks: Buffer[] = [];
          for await (const c of req) chunks.push(c as Buffer);
          const text = Buffer.concat(chunks).toString();
          let body: any;
          try { body = text ? JSON.parse(text) : undefined; } catch { body = undefined; }
          const url = new URL(req.originalUrl || req.url || '/', 'http://localhost');
          const query: Record<string, string> = {};
          url.searchParams.forEach((v, k) => { query[k] = v; });
          const headers: Record<string, string | undefined> = {};
          for (const [k, v] of Object.entries(req.headers)) headers[k.toLowerCase()] = Array.isArray(v) ? v[0] : v;

          const { handle } = await server.ssrLoadModule('/api/_lib/handlers.ts');
          const out = await handle({ method: req.method || 'GET', path: url.pathname, query, headers, body });
          res.statusCode = out.status;
          res.setHeader('Content-Type', 'application/json');
          res.setHeader('Cache-Control', 'no-store');
          res.end(JSON.stringify(out.body));
        } catch (e) {
          console.error('[evalis] erreur API', e);
          res.statusCode = 500;
          res.end(JSON.stringify({ error: 'Erreur serveur' }));
        }
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  return {
    plugins: [react(), tailwindcss(), evalisDevApi(mode)],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
