import { createClient } from '@supabase/supabase-js'

// VITE_-prefixed vars are set in local .env and explicit Vercel env vars.
// process.env.SUPABASE_* are injected by vite.config.ts as a fallback for
// the Vercel Supabase integration, which sets SUPABASE_URL / SUPABASE_ANON_KEY
// without the VITE_ prefix.
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)