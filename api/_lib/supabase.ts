import { createClient, type SupabaseClient } from '@supabase/supabase-js';

function readEnv(name: string): string {
  try {
    return String((process.env as Record<string, string | undefined>)[name] || '').trim();
  } catch {
    return '';
  }
}

function resolveUrl(): string {
  return readEnv('SUPABASE_URL') || readEnv('VITE_SUPABASE_URL') || 'https://pkenrmorywmuvnzfoylp.supabase.co';
}

function resolveKey(): string {
  return (
    readEnv('SUPABASE_SERVICE_ROLE_KEY') ||
    readEnv('VITE_SUPABASE_SERVICE_ROLE_KEY') ||
    readEnv('SUPABASE_ANON_KEY') ||
    readEnv('VITE_SUPABASE_ANON_KEY') ||
    'sb_publishable_fXxu9pH8yK8s6xEvEJWNgw_T3Nbbvdo'
  );
}

let _supabaseClient: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (_supabaseClient) return _supabaseClient;
  const url = resolveUrl();
  const key = resolveKey();

  _supabaseClient = createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
  return _supabaseClient;
}

export const supabase = new Proxy({} as SupabaseClient, {
  get(_t, prop, receiver) {
    const client = getSupabase();
    const value = Reflect.get(client, prop, receiver);
    return typeof value === 'function' ? value.bind(client) : value;
  },
});

