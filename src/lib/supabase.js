import { createClient } from '@supabase/supabase-js'

// VITE_-prefixed vars are set in local .env and explicit Vercel env vars.
// process.env.SUPABASE_* are injected by vite.config.ts as a fallback for
// the Vercel Supabase integration, which sets SUPABASE_URL / SUPABASE_ANON_KEY
// without the VITE_ prefix.
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY
const supabaseProjectRef = (() => {
  try {
    return supabaseUrl ? new URL(supabaseUrl).hostname.split('.')[0] : 'muvidb'
  } catch (_) {
    return 'muvidb'
  }
})()

export const SUPABASE_AUTH_STORAGE_KEY = `sb-${supabaseProjectRef}-auth-token`

if (!supabaseUrl || !supabaseAnonKey) {
  console.error(
    'Missing Supabase environment variables (VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY). ' +
    'Add them to your Vercel project settings or .env file.'
  )
}

export const supabase = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storageKey: SUPABASE_AUTH_STORAGE_KEY,
      },
    })
  : null
