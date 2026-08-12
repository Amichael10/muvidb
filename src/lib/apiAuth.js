import { supabase } from './supabase';

/**
 * Builds fetch headers for calling authenticated /api endpoints.
 * Attaches the current Supabase session access token as a Bearer token
 * so the server-side isValidAuth() check can verify the admin/pro role.
 *
 * @param {Object} [extra] - Additional headers to merge in.
 * @returns {Promise<Record<string, string>>}
 */
export async function authHeaders(extra = {}) {
  let { data: { session } } = await supabase.auth.getSession();
  const expiresAtMs = session?.expires_at ? session.expires_at * 1000 : 0;

  if (expiresAtMs && expiresAtMs < Date.now() + 60_000) {
    try {
      const { data } = await supabase.auth.refreshSession();
      session = data.session || session;
    } catch (err) {
      console.warn('Could not refresh session before API request:', err);
    }
  }

  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${session?.access_token || ''}`,
    ...extra,
  };
}
