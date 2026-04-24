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
        manifest: {
          name: 'Lumi | African Cinema Database',
          short_name: 'Lumi',
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
    server: {
      port: 3001,
      host: '0.0.0.0',
      proxy: {
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
