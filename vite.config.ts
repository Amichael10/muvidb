import { reactRouter } from '@react-router/dev/vite';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({ mode, isSsrBuild }) => {
  // loadEnv reads .env files; process.env catches Vercel-injected vars at build time.
  // We merge both so the build works locally (via .env) and on Vercel (via process.env).
  const env = { ...process.env, ...loadEnv(mode, '.', '') };
  return {
    plugins: [
      // reactRouter() supplies React/JSX handling and Fast Refresh itself, so
      // @vitejs/plugin-react must NOT also be registered — two React plugins
      // conflict.
      tailwindcss(),
      reactRouter(),
      // The service worker is built from the client bundle only; running the
      // PWA plugin over the SSR build has nothing to precache.
      !isSsrBuild && VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'mask-icon.svg'],
        workbox: {
          maximumFileSizeToCacheInBytes: 5 * 1024 * 1024, // 5MB
          cleanupOutdatedCaches: true, // purge old precaches so stale chunks don't linger
          // SSR has no static index.html navigate target — never fall back to a SPA shell.
          navigateFallback: null,
          runtimeCaching: [
            {
              urlPattern: ({ url }) => url.pathname.startsWith('/api/'),
              handler: 'NetworkOnly',
            },
          ],
        },
        manifest: {
          name: 'MuviDB | African Cinema Database',
          short_name: 'MuviDB',
          description: 'The ultimate destination for African cinema, showtimes, and industry professionals.',
          theme_color: '#FF5C00',
          background_color: '#0A0A0B',
          display: 'standalone',
          orientation: 'portrait',
          icons: [
            {
              src: 'pwa-192x192.png',
              sizes: '192x192',
              type: 'image/png'
            },
            {
              src: 'pwa-512x512.png',
              sizes: '512x512',
              type: 'image/png'
            },
            {
              src: 'pwa-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any maskable'
            }
          ]
        }
      })
    ].filter(Boolean),
    define: {
      // Expose Supabase connection vars to the browser bundle.
      // Priority: VITE_-prefixed (explicit) > plain (Vercel Supabase integration).
      'process.env.SUPABASE_URL':      JSON.stringify(env.VITE_SUPABASE_URL      || env.SUPABASE_URL      || ''),
      'process.env.SUPABASE_ANON_KEY': JSON.stringify(env.VITE_SUPABASE_ANON_KEY || env.SUPABASE_ANON_KEY || ''),
    },
    // NOTE: the previous manualChunks vendor-splitting is deliberately gone.
    // Framework mode does its own route-level code splitting and shares a
    // common chunk across routes; forcing manualChunks fights that and breaks
    // the SSR build (the server bundle must stay a single module graph).
    server: {
      port: 3001,
      host: '0.0.0.0',
      // Harvest workers append progress continuously. Keeping those files out
      // of Vite's watcher prevents the approval UI from being starved by
      // needless rescans while multiple workers are active.
      watch: {
        ignored: ['**/.codex-harvest-worker-*.log'],
      },
      proxy: {
        // In production, /storage is reverse-proxied to Supabase via vercel.json.
        // Mirror that locally so relative storage paths (from getProxiedImageUrl)
        // resolve during dev.
        '/storage': {
          target: 'https://pkenrmorywmuvnzfoylp.supabase.co',
          changeOrigin: true,
        },
        '/api/external': {
          target: 'http://localhost:3001',
          bypass: async (req, res) => {
            try {
              const url = new URL(req.url, 'http://localhost:3001');
              const { default: handler } = await import('./api/external.js');
              await handler(
                { query: Object.fromEntries(url.searchParams), method: req.method },
                {
                  status: (code) => ({
                    json: (data) => {
                      res.statusCode = code;
                      res.setHeader('Content-Type', 'application/json');
                      res.end(JSON.stringify(data));
                    },
                  }),
                }
              );
            } catch (err) {
              res.statusCode = 500;
              res.end(JSON.stringify({ error: err.message }));
            }
            return false;
          },
        },
        '/api/tmdb': {
          target: 'https://api.themoviedb.org/3',
          changeOrigin: true,
          rewrite: (path) => {
            const url = new URL(path, 'http://localhost:3001');
            const endpoint = url.searchParams.get('endpoint');
            url.searchParams.delete('endpoint');
            url.searchParams.set('api_key', env.TMDB_API_KEY || env.VITE_TMDB_API_KEY || '');
            return `${endpoint}?${url.searchParams.toString()}`;
          },
        },
        '/api/health': {
          target: 'http://localhost:3001',
          bypass: (req, res) => {
            res.statusCode = 200;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ status: 'ok', local: true }));
            return false;
          }
        },
        '/api/cron/refresh-videos': {
          target: 'http://localhost:3001',
          bypass: async (req, res) => {
            try {
              const url = new URL(req.url, 'http://localhost:3001');
              const channelId = url.searchParams.get('channelId');
              
              // We simulate the cron behavior locally
              res.statusCode = 200;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ 
                success: true, 
                message: 'Local sync simulated. For full production sync, use Vercel deployment.',
                videos_upserted: 0,
                channels_processed: channelId ? 1 : 0,
                local: true
              }));
            } catch (err) {
              res.statusCode = 500;
              res.end(JSON.stringify({ error: err.message }));
            }
            return false;
          }
        },
        // Vercel functions don't run under `vite dev`, and once anon SELECT is
        // revoked on `credits` (anti-scraping) the browser can't read the table
        // directly either — so local dev talks to the deployed endpoint.
        '/api/content': {
          target: 'https://muvidb.com',
          changeOrigin: true,
          secure: true,
        },
        // Cohere film/people rerank — Vercel function in prod; call Cohere
        // directly in vite so OCR + search name matching work locally.
        '/api/semantic-search': {
          target: 'http://localhost:3001',
          bypass: async (req, res) => {
            const send = (code, payload) => {
              res.statusCode = code;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify(payload));
            };
            if (req.method === 'OPTIONS') {
              send(204, {});
              return false;
            }
            try {
              const chunks = [];
              for await (const chunk of req) chunks.push(chunk);
              const body = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
              const q = String(body.q || '').trim();
              const entity = String(body.entity || 'films').toLowerCase() === 'people' ? 'people' : 'films';
              const candidates = Array.isArray(body.candidates) ? body.candidates : [];
              if (q.length < 2) {
                send(400, { error: 'q too short', films: [], people: [] });
                return false;
              }
              if (candidates.length < 2) {
                send(200, {
                  [entity]: [],
                  engine: 'cohere-rerank',
                  note: 'need >=2 candidates',
                  local: true,
                });
                return false;
              }
              const key = env.COHERE_API_KEY || '';
              if (!key) {
                send(503, { error: 'Cohere not configured', films: [], people: [], local: true });
                return false;
              }
              const query =
                entity === 'people'
                  ? `Match this person name (order, nicknames in parentheses, and minor typos allowed): ${q}`.slice(0, 500)
                  : q.slice(0, 500);
              const documents = candidates.map((c) =>
                String(c.name || c.title || c.id).slice(0, 500),
              );
              const model = env.COHERE_RERANK_MODEL || 'rerank-v4.0-pro';
              const topN = Math.min(candidates.length, Number(body.limit) || 24);
              const cr = await fetch('https://api.cohere.com/v2/rerank', {
                method: 'POST',
                headers: {
                  Authorization: `Bearer ${key}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({ model, query, documents, top_n: topN }),
              });
              if (!cr.ok) {
                const errText = await cr.text();
                send(502, { error: `Cohere rerank failed: ${errText.slice(0, 200)}`, films: [], people: [] });
                return false;
              }
              const data = await cr.json();
              const rows = (data.results || [])
                .map((r) => {
                  const c = candidates[r.index];
                  if (!c?.id) return null;
                  const score = r.relevance_score ?? r.relevanceScore ?? 0;
                  return {
                    id: c.id,
                    title: c.title,
                    name: c.name || c.title,
                    _score: Math.round(score * 500),
                    _semantic: score,
                  };
                })
                .filter(Boolean);
              send(200, { [entity]: rows, engine: 'cohere-rerank', local: true });
            } catch (err) {
              send(500, { error: err?.message || 'semantic-search local failed', films: [], people: [] });
            }
            return false;
          },
        },
        '/api/editorial': {
          target: 'http://localhost:3001',
          bypass: async (req, res) => {
            try {
              const url = new URL(req.url, 'http://localhost:3001');
              const task = url.searchParams.get('task') || '';
              
              let body = {};
              if (req.method === 'POST') {
                const chunks = [];
                for await (const chunk of req) chunks.push(chunk);
                body = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
              }

              // Dynamically import handler
              const { default: handler } = await import('./api/social.js');
              await handler({ query: Object.fromEntries(url.searchParams), body, method: req.method }, {
                status: (code) => ({
                  json: (data) => {
                    res.statusCode = code;
                    res.setHeader('Content-Type', 'application/json');
                    res.end(JSON.stringify(data));
                  },
                  end: () => {
                    res.statusCode = code;
                    res.end();
                  }
                }),
                setHeader: (k, v) => res.setHeader(k, v),
              });
            } catch (err) {
              res.statusCode = 500;
              res.end(JSON.stringify({ error: err.message }));
            }
            return false;
          }
        },
        '/api': {
          target: 'http://localhost:3001',
          bypass: (req, res) => {
            // Only handle if it's actually an API call that hasn't been caught above
            if (req.url.startsWith('/api')) {
              res.statusCode = 404;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ 
                error: 'API route not implemented in local dev proxy', 
                message: 'This route exists in Vercel but is not proxied in vite.config.ts',
                path: req.url 
              }));
              return false;
            }
          }
        }
      }
    },
    resolve: {
      dedupe: ['react', 'react-dom'],
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
  };
});
