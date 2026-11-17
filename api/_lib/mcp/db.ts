import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

try {
  dotenv.config();
  dotenv.config({ path: '.env.local' });
} catch {
  // Ignore in serverless / production where env is injected by platform
}

const DEFAULT_SUPABASE_URL = 'https://pkenrmorywmuvnzfoylp.supabase.co';
const DEFAULT_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBrZW5ybW9yeXdtdXZuemZveWxwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MTM1NjQyNjUsImV4cCI6MjAyOTE0MDI2NX0.5zXG0o6rF-wD4B8M9wXv7jJ3vGZ-7yYv6jG6r8qXbZk';

let _client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (_client) return _client;

  const url =
    process.env.SUPABASE_URL ||
    process.env.VITE_SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    DEFAULT_SUPABASE_URL;

  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY ||
    DEFAULT_ANON_KEY;

  _client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
  return _client;
}

export const supabase = new Proxy({} as SupabaseClient, {
  get(_t, prop, receiver) {
    const client = getSupabase();
    const value = Reflect.get(client, prop, receiver);
    return typeof value === 'function' ? value.bind(client) : value;
  }
});

export async function withRetry<T = any>(fn: () => any, retries = 3, delay = 800): Promise<T> {
  let lastErr: any;
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res: any = await fn();
      if (res && res.error) throw new Error(res.error.message || JSON.stringify(res.error));
      return res;
    } catch (err: any) {
      lastErr = err;
      if (attempt === retries) break;
      await new Promise((resolve) => setTimeout(resolve, delay * attempt));
    }
  }
  throw lastErr;
}
