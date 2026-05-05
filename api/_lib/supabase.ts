import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!supabaseUrl) {
  console.warn('CRITICAL: SUPABASE_URL is missing.');
}

if (!supabaseServiceRoleKey) {
  console.warn('CRITICAL: SUPABASE_SERVICE_ROLE_KEY is missing. Backend operations will fail.');
}

let supabaseClient: any;

try {
  if (!supabaseUrl || !supabaseUrl.startsWith('http')) {
    throw new Error('Invalid or missing SUPABASE_URL');
  }
  supabaseClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
} catch (err: any) {
  console.error('CRITICAL: Supabase client failed to initialize:', err.message);
  // Provide a dummy client that fails gracefully instead of crashing on import
  supabaseClient = new Proxy({}, {
    get: (target, prop) => {
      return () => {
        throw new Error(`Supabase operation "${String(prop)}" failed because the client was not initialized. Check your environment variables.`);
      };
    }
  });
}

export const supabase = supabaseClient;
