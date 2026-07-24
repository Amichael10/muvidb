import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * Server-only Supabase client for route loaders.
 *
 * The `.server.ts` suffix is a React Router framework-mode convention: the
 * module (and the service-role key it reads) is stripped from the client
 * bundle, so this must never be imported from a component that renders in the
 * browser. Use `src/lib/supabase.js` (anon key) for that.
 *
 * IMPORTANT: read env via bracket access / lazy init. Vite `define` can replace
 * `process.env.SUPABASE_URL` with a build-time empty string, which broke SSR
 * when the server build was produced without secrets in the build environment.
 */
function readEnv(name: string): string {
  try {
    return String((process.env as Record<string, string | undefined>)[name] || '').trim();
  } catch {
    return '';
  }
}

function resolveUrl() {
  return readEnv('SUPABASE_URL') || readEnv('VITE_SUPABASE_URL');
}

function resolveKey() {
  return (
    readEnv('SUPABASE_SERVICE_ROLE_KEY') ||
    readEnv('SUPABASE_ANON_KEY') ||
    readEnv('VITE_SUPABASE_ANON_KEY')
  );
}

let _client: SupabaseClient | null = null;

export function getSupabaseServer(): SupabaseClient {
  if (_client) return _client;
  const url = resolveUrl();
  const key = resolveKey();
  if (!url) console.warn('CRITICAL: SUPABASE_URL is missing — loaders will fail.');
  if (!key) console.warn('CRITICAL: Supabase key is missing — loaders will fail.');
  // Placeholder URL avoids createClient throwing at import/boot; queries still fail clearly.
  _client = createClient(url || 'https://placeholder.supabase.co', key || 'placeholder', {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return _client;
}

/** @deprecated Prefer getSupabaseServer() — kept for existing loader imports. */
export const supabaseServer = new Proxy({} as SupabaseClient, {
  get(_t, prop, receiver) {
    const client = getSupabaseServer();
    const value = Reflect.get(client, prop, receiver);
    return typeof value === 'function' ? value.bind(client) : value;
  },
});
