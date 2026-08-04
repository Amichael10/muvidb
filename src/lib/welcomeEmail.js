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

export async function requestWelcomeEmail(firstName) {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token || !session.user?.email) return;

    if (session.user.app_metadata?.welcome_email_sent) return;
    if (!isNewAccount(session.user)) return;

    // Per-tab guard so we don't spam the endpoint on rapid auth events.
    const key = `welcome_email_requested:${session.user.id}`;
    if (typeof sessionStorage !== 'undefined' && sessionStorage.getItem(key)) return;
    if (typeof sessionStorage !== 'undefined') sessionStorage.setItem(key, '1');

    const headers = await authHeaders();
    await fetch('/api/send-welcome-email', {
      method: 'POST',
      headers,
      body: JSON.stringify(firstName ? { firstName } : {}),
    });
  } catch (err) {
    // Welcome email must never block signup / login UX.
    console.warn('[welcome-email] request failed:', err);
  }
}
