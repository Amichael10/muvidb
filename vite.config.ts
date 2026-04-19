import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  // loadEnv reads .env files; process.env catches Vercel-injected vars at build time.
  // We merge both so the build works locally (via .env) and on Vercel (via process.env).
  const env = { ...process.env, ...loadEnv(mode, '.', '') };
  return {
    plugins: [react(), tailwindcss()],
    define: {
      // Expose Supabase connection vars to the browser bundle.
      // Priority: VITE_-prefixed (explicit) > plain (Vercel Supabase integration).
      'process.env.SUPABASE_URL':      JSON.stringify(env.VITE_SUPABASE_URL      || env.SUPABASE_URL      || ''),
      'process.env.SUPABASE_ANON_KEY': JSON.stringify(env.VITE_SUPABASE_ANON_KEY || env.SUPABASE_ANON_KEY || ''),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
  };
});
