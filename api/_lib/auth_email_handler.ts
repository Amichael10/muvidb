/**
 * Supabase Auth "Send Email" hook — branded confirm / reset / magic-link via Resend.
 * POST https://muvidb.com/api/auth-email
 *
 * Dashboard: Authentication → Hooks → Send Email → HTTPS
 * Secret env: SEND_EMAIL_HOOK_SECRET (v1,whsec_… from Supabase)
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { verifyStandardWebhook } from './standard_webhook.js';
import { sendAuthEmail, type AuthEmailPayload } from './auth_email.js';
import { resendConfigured } from './resend.js';

function hookSecret(): string | null {
  const raw = (process.env.SEND_EMAIL_HOOK_SECRET || '').trim();
  if (!raw) return null;
  return raw.replace(/^v1,whsec_/, '');
}

export async function handleAuthEmailHook(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'GET') {
    return res.status(200).json({
      ok: true,
      resend: resendConfigured(),
      hookSecret: Boolean(hookSecret()),
      hint: 'Enable Send Email hook in Supabase → point here. Disable built-in SMTP templates.',
    });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const secret = hookSecret();
  if (!secret) {
    return res.status(503).json({ error: 'SEND_EMAIL_HOOK_SECRET not configured' });
  }
  if (!resendConfigured()) {
    return res.status(503).json({ error: 'RESEND_API_KEY not configured' });
  }

  const payloadText =
    typeof req.body === 'string'
      ? req.body
      : Buffer.isBuffer(req.body)
        ? req.body.toString('utf8')
        : JSON.stringify(req.body ?? {});

  const headers = Object.fromEntries(
    Object.entries(req.headers).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v ?? '']),
  );

  let verified: AuthEmailPayload;
  try {
    verified = verifyStandardWebhook(payloadText, headers, secret) as AuthEmailPayload;
  } catch (err: any) {
    console.warn('[auth-email] webhook verify failed:', err?.message || err);
    return res.status(401).json({ error: 'Invalid hook signature' });
  }

  try {
    const result = await sendAuthEmail(verified);
    if (!result.ok) {
      return res.status(500).json({ error: result.error });
    }
    // Supabase expects 200 — body can be empty JSON
    return res.status(200).json({ success: true, emailId: result.emailId, action: result.action });
  } catch (err: any) {
    console.error('[auth-email]', err?.message || err);
    return res.status(500).json({ error: err?.message || 'Send failed' });
  }
}
