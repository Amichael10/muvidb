/**
 * Supabase Auth "Send Email" hook — branded confirm / reset / magic-link via Resend.
 * POST https://muvidb.com/api/auth-email
 *
 * Dashboard: Authentication → Hooks → Send Email → HTTPS
 * Secret env: SEND_EMAIL_HOOK_SECRET (v1,whsec_… from Supabase)
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { resendConfigured } from './resend.js';

/** Supabase docs: strip v1,whsec_ before passing to Standard Webhooks verifier. */
function hookSecret(): string | null {
  const raw = (process.env.SEND_EMAIL_HOOK_SECRET || '').trim();
  if (!raw) return null;
  return raw.replace(/^v1,whsec_/, '');
}

function normalizeHeaders(req: VercelRequest): Record<string, string> {
  return Object.fromEntries(
    Object.entries(req.headers).map(([k, v]) => [k.toLowerCase(), Array.isArray(v) ? v[0] : v ?? '']),
  );
}

export async function handleAuthEmailHook(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'GET') {
    const preview = typeof req.query.preview === 'string' ? req.query.preview : '';
    if (preview) {
      const { previewAuthEmailHtml } = await import('./auth_email.js');
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.status(200).send(previewAuthEmailHtml(preview));
    }
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

  if (!payloadText) {
    console.error('[auth-email] empty request body');
    return res.status(400).json({ error: 'Empty request body' });
  }

  const headers = normalizeHeaders(req);

  try {
    const { verifyStandardWebhook } = await import('./standard_webhook.js');
    const { sendAuthEmail } = await import('./auth_email.js');

    let verified: import('./auth_email.js').AuthEmailPayload;
    try {
      verified = verifyStandardWebhook(payloadText, headers, secret) as import('./auth_email.js').AuthEmailPayload;
    } catch (err: any) {
      console.warn('[auth-email] webhook verify failed:', err?.message || err);
      return res.status(401).json({ error: 'Invalid hook signature', detail: err?.message || 'verify failed' });
    }

    const result = await sendAuthEmail(verified);
    if (!result.ok) {
      console.error('[auth-email] send failed:', result.error);
      return res.status(500).json({ error: result.error });
    }

    // Supabase expects 200 with an empty JSON object on success.
    return res.status(200).json({});
  } catch (err: any) {
    console.error('[auth-email]', err?.message || err, err?.stack);
    return res.status(500).json({ error: err?.message || 'Send failed' });
  }
}
