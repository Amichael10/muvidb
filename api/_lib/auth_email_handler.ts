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
  const secret = (process.env.CRON_SECRET || process.env.VITE_CRON_SECRET || '').trim();
  if (!secret) {
    return { ok: false as const, error: 'CRON_SECRET not configured for internal auth-email send' };
  }

  const res = await fetch(`${dataApiBase()}/api/data?_r=auth-email-send`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${secret}`,
    },
    body: JSON.stringify({ payload }),
  });

  const text = await res.text();
  let body: any = {};
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    body = { error: text || 'Invalid JSON from auth-email-send' };
  }

  if (!res.ok) {
    return { ok: false as const, error: body.error || body.message || `Send failed (${res.status})` };
  }

  return { ok: true as const, emailId: body.emailId, action: body.action };
}

export async function handleAuthEmailHook(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'GET') {
    const preview = typeof req.query.preview === 'string' ? req.query.preview : '';
    if (preview) {
      return res.redirect(302, `${dataApiBase()}/api/data?_r=auth-email&preview=${encodeURIComponent(preview)}`);
    }
    return res.status(200).json({
      ok: true,
      resend: resendConfigured(),
      hookSecret: Boolean(hookSecret()),
      previewUrl: `${SITE}/api/data?_r=auth-email&preview=signup`,
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
    return res.status(400).json({ error: 'Empty request body' });
  }

  let verified: AuthEmailPayload;
  try {
    verified = verifyStandardWebhook(payloadText, normalizeHeaders(req), secret) as AuthEmailPayload;
  } catch (err: any) {
    console.warn('[auth-email] webhook verify failed:', err?.message || err);
    return res.status(401).json({ error: 'Invalid hook signature', detail: err?.message || 'verify failed' });
  }

  try {
    const result = await delegateSend(verified);
    if (!result.ok) {
      return res.status(500).json({ error: result.error });
    }
    return res.status(200).json({});
  } catch (err: any) {
    console.error('[auth-email]', err?.message || err);
    return res.status(500).json({ error: err?.message || 'Send failed' });
  }
}
