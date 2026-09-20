/**
 * Supabase Send Email hook — webhook verify on api/auth-email, render/send via api/data.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { resendConfigured } from './resend.js';
import { verifyStandardWebhook } from './standard_webhook.js';
import type { AuthEmailPayload } from './auth_email_send.js';

const SITE = 'https://muvidb.com';

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

function dataApiBase() {
  return process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : SITE;
}

async function delegateSend(payload: AuthEmailPayload) {
  try {
    const { sendAuthEmail } = await import('./auth_email_send.js');
    return await sendAuthEmail(payload);
  } catch (err: any) {
    return { ok: false as const, error: err?.message || 'Send failed' };
  }
}

export async function handleAuthEmailHook(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'GET') {
    const preview = typeof req.query.preview === 'string' ? req.query.preview : '';
    if (preview) {
      try {
        const { previewAuthEmailHtml } = await import('./auth_email_send.js');
        const html = await previewAuthEmailHtml(preview);
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        return res.status(200).send(html);
      } catch (err: any) {
        console.error('[auth-email] preview failed:', err?.message || err);
        return res.status(500).json({ error: 'Preview failed', message: err?.message || String(err) });
      }
    }
    return res.status(200).json({
      ok: true,
      resend: resendConfigured(),
      hookSecret: Boolean(hookSecret()),
      previewUrl: `${SITE}/api/auth-email?preview=signup`,
    });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!resendConfigured()) {
    console.warn('[auth-email] RESEND_API_KEY not configured');
    return res.status(503).json({ error: 'RESEND_API_KEY not configured' });
  }

  const payloadText =
    typeof req.body === 'string'
      ? req.body
      : Buffer.isBuffer(req.body)
        ? req.body.toString('utf8')
        : JSON.stringify(req.body ?? {});

  if (!payloadText || payloadText === '{}') {
    return res.status(400).json({ error: 'Empty request body' });
  }

  const secret = hookSecret();
  let verified: AuthEmailPayload;
  if (secret) {
    try {
      verified = verifyStandardWebhook(payloadText, normalizeHeaders(req), secret) as AuthEmailPayload;
    } catch (err: any) {
      console.warn('[auth-email] webhook verify failed:', err?.message || err);
      return res.status(401).json({ error: 'Invalid hook signature', detail: err?.message || 'verify failed' });
    }
  } else {
    // If SEND_EMAIL_HOOK_SECRET is not configured on the server, safely parse payload from Supabase
    try {
      verified = typeof req.body === 'object' && req.body !== null ? (req.body as AuthEmailPayload) : JSON.parse(payloadText);
    } catch (err: any) {
      console.warn('[auth-email] payload JSON parse failed:', err?.message || err);
      return res.status(400).json({ error: 'Invalid JSON payload' });
    }
  }

  if (!verified?.user?.email || !verified?.email_data) {
    console.warn('[auth-email] payload missing user.email or email_data');
    return res.status(400).json({ error: 'Missing required auth email payload' });
  }

  try {
    const result = await delegateSend(verified);
    if (!result.ok) {
      console.error('[auth-email] send failed:', result.error);
      return res.status(500).json({ error: result.error });
    }
    return res.status(200).json({ success: true, emailId: result.emailId, action: result.action });
  } catch (err: any) {
    console.error('[auth-email]', err?.message || err);
    return res.status(500).json({ error: err?.message || 'Send failed' });
  }
}
