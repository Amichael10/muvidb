import { createClient, SupabaseClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Load .env / .env.local from project root if running locally
try {
  dotenv.config();
  dotenv.config({ path: '.env.local' });
} catch {
  // Ignore in standalone packaged environments
}

const DEFAULT_SUPABASE_URL = 'https://pkenrmorywmuvnzfoylp.supabase.co';
// Default public key for read-only metadata queries if not specified in environment
const DEFAULT_ANON_KEY =
  process.env.SUPABASE_ANON_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBrZW5ybW9yeXdtdXZuemZveWxwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MTM1NjQyNjUsImV4cCI6MjAyOTE0MDI2NX0.5zXG0o6rF-wD4B8M9wXv7jJ3vGZ-7yYv6jG6r8qXbZk';

export function getSupabaseClient(): SupabaseClient {
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

  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
}

export async function withRetry<T>(fn: () => Promise<T>, retries = 3, delay = 800): Promise<T> {
  let lastErr: any;
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res: any = await fn();
      if (res && res.error) throw new Error(res.error.message || JSON.stringify(res.error));
      return res;
    } catch (err: any) {
      lastErr = err;
      if (attempt === retries) break;
      await new Promise(resolve => setTimeout(resolve, delay * attempt));
    }
  }
  throw lastErr;
}
