import { supabase } from './supabase';
import { authHeaders } from './apiAuth';

/**
 * Ask the server to send the branded welcome email for the current session.
 * Safe to call repeatedly — server is idempotent via app_metadata.
 * Fire-and-forget from the client; never touches RESEND_API_KEY.
 */
function isNewAccount(user) {
  if (!user?.created_at) return false;
  const ageMs = Date.now() - new Date(user.created_at).getTime();
  // Only welcome accounts created in the last day (covers email-confirm + OAuth).
  return Number.isFinite(ageMs) && ageMs >= 0 && ageMs < 24 * 60 * 60 * 1000;
}

/**
 * @param {string} [firstName]
 * @param {{ force?: boolean }} [opts] — force retries after a failed attempt
 */
export async function requestWelcomeEmail(firstName, opts = {}) {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token || !session.user?.email) return { ok: false, reason: 'no_session' };

    if (session.user.app_metadata?.welcome_email_sent) {
      return { ok: true, skipped: 'already_sent' };
    }
    if (!isNewAccount(session.user)) {
      return { ok: false, reason: 'not_new' };
    }

    const key = `welcome_email_requested:${session.user.id}`;
    if (!opts.force && typeof sessionStorage !== 'undefined' && sessionStorage.getItem(key) === 'sent') {
      return { ok: true, skipped: 'client_guard' };
    }

    const headers = await authHeaders();
    // Brief retry — right after signup the access token can lag a tick.
    let res = null;
    let lastErr = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      if (attempt > 0) await new Promise((r) => setTimeout(r, 400 * attempt));
      try {
        res = await fetch('/api/send-welcome-email', {
          method: 'POST',
          headers,
          body: JSON.stringify(firstName ? { firstName } : {}),
        });
        if (res.ok || res.status === 401 || res.status === 429) break;
      } catch (err) {
        lastErr = err;
      }
    }

    if (!res) {
      console.warn('[welcome-email] request failed:', lastErr);
      return { ok: false, reason: 'network' };
    }

    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      console.warn('[welcome-email] server error:', res.status, body);
      return { ok: false, reason: 'server', status: res.status, body };
    }

    // Only suppress retries after a confirmed send / already_sent / intentional skip.
    if (typeof sessionStorage !== 'undefined' && (body.success || body.skipped === 'already_sent')) {
      sessionStorage.setItem(key, 'sent');
    }

    if (body.skipped === 'no_resend') {
      console.warn('[welcome-email] RESEND_API_KEY missing on server');
      return { ok: false, reason: 'no_resend' };
    }

    return { ok: true, ...body };
  } catch (err) {
    // Welcome email must never block signup / login UX.
    console.warn('[welcome-email] request failed:', err);
    return { ok: false, reason: 'exception' };
  }
}
