import { supabase } from './supabase';

// Supabase Auth serializes session reads with the browser's Web Lock API. The
// Social Studio loads several authenticated resources at once; without
// sharing the in-flight operation, those requests can race and surface
// "Lock broken by another request with the 'steal' option" to the UI.
let sessionReadPromise = null;
let refreshSessionPromise = null;

function readSession() {
  if (!sessionReadPromise) {
    sessionReadPromise = supabase.auth.getSession().catch(async error => {
      // A competing auth refresh can briefly break a Web Lock. Give the
      // winner a moment to finish, then perform one clean read before the API
      // request is allowed to fail.
      if (/lock broken|steal.?option|navigator\.locks/i.test(String(error?.message || error))) {
        await new Promise(resolve => setTimeout(resolve, 75));
        return supabase.auth.getSession();
      }
      throw error;
    }).finally(() => {
      sessionReadPromise = null;
    });
  }
  return sessionReadPromise;
}

function refreshSession() {
  if (!refreshSessionPromise) {
    refreshSessionPromise = supabase.auth.refreshSession().finally(() => {
      refreshSessionPromise = null;
    });
  }
  return refreshSessionPromise;
}

/**
 * Builds fetch headers for calling authenticated /api endpoints.
 * Attaches the current Supabase session access token as a Bearer token
 * so the server-side isValidAuth() check can verify the admin/pro role.
 *
 * @param {Object} [extra] - Additional headers to merge in.
 * @returns {Promise<Record<string, string>>}
 */
export async function authHeaders(extra = {}) {
  if (!supabase) {
    return { 'Content-Type': 'application/json', Authorization: '', ...extra };
  }

  let { data: { session } } = await readSession();
  const expiresAtMs = session?.expires_at ? session.expires_at * 1000 : 0;

  if (expiresAtMs && expiresAtMs < Date.now() + 60_000) {
    try {
      const { data } = await refreshSession();
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
