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
  const { data: { session } } = await supabase.auth.getSession();
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${session?.access_token || ''}`,
    ...extra,
  };
}
