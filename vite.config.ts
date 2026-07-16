import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({ mode }) => {
  // loadEnv reads .env files; process.env catches Vercel-injected vars at build time.
  // We merge both so the build works locally (via .env) and on Vercel (via process.env).
  const env = { ...process.env, ...loadEnv(mode, '.', '') };
  return {
    plugins: [
      react(), 
      tailwindcss(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'mask-icon.svg'],
        workbox: {
          maximumFileSizeToCacheInBytes: 5 * 1024 * 1024, // 5MB
          cleanupOutdatedCaches: true, // purge old precaches so stale chunks don't linger
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
    ],
    define: {
      // Expose Supabase connection vars to the browser bundle.
      // Priority: VITE_-prefixed (explicit) > plain (Vercel Supabase integration).
      'process.env.SUPABASE_URL':      JSON.stringify(env.VITE_SUPABASE_URL      || env.SUPABASE_URL      || ''),
      'process.env.SUPABASE_ANON_KEY': JSON.stringify(env.VITE_SUPABASE_ANON_KEY || env.SUPABASE_ANON_KEY || ''),
    },
    build: {
      rollupOptions: {
        output: {
          // Split heavy, rarely-changing vendor code into cacheable chunks so the
          // main bundle (and main-thread parse/exec cost) stays small.
          manualChunks: {
            'react-vendor': ['react', 'react-dom', 'react-router-dom'],
            'supabase-vendor': ['@supabase/supabase-js'],
            'motion-vendor': ['motion'],
          },
        },
      },
    },
    server: {
      port: 3001,
      host: '0.0.0.0',
      proxy: {
        // In production, /storage is reverse-proxied to Supabase via vercel.json.
        // Mirror that locally so relative storage paths (from getProxiedImageUrl)
        // resolve during dev.
        '/storage': {
          target: 'https://pkenrmorywmuvnzfoylp.supabase.co',
          changeOrigin: true,
        },
        '/api/youtube': {
          target: 'https://www.googleapis.com/youtube/v3',
          changeOrigin: true,
          rewrite: (path) => {
            const url = new URL(path, 'http://localhost:3001');
            const endpoint = url.searchParams.get('endpoint');
            url.searchParams.delete('endpoint');
            url.searchParams.set('key', env.YOUTUBE_API_KEY || env.VITE_YOUTUBE_API_KEY || '');
            return `/${endpoint}?${url.searchParams.toString()}`;
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
        '/api/film-credits': {
          target: 'https://muvidb.com',
          changeOrigin: true,
          secure: true,
        },
        '/api/person-films': {
          target: 'https://muvidb.com',
          changeOrigin: true,
          secure: true,
        },
        '/api/person-credits': {
          target: 'https://muvidb.com',
          changeOrigin: true,
          secure: true,
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
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
  };
});
