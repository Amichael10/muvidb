import { createClient } from '@supabase/supabase-js';

/**
 * Server-only Supabase client for route loaders.
 *
 * The `.server.ts` suffix is a React Router framework-mode convention: the
 * module (and the service-role key it reads) is stripped from the client
 * bundle, so this must never be imported from a component that renders in the
 * browser. Use `src/lib/supabase.js` (anon key) for that.
 *
 * Service role is deliberate — it mirrors what api/seo.ts used, and loaders
 * need to read tables where anon SELECT has been revoked for anti-scraping
 * (notably `credits`, used to build a film's cast).
 */
const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

if (!url) console.warn('CRITICAL: SUPABASE_URL is missing — loaders will fail.');
if (!key) console.warn('CRITICAL: Supabase key is missing — loaders will fail.');

export const supabaseServer = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});
