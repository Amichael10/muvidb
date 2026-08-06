import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { getCorsHeaders } from './cors.js';
import { checkRateLimit } from './rateLimit.js';
import { sendWelcomeEmail } from './welcome_email.js';

function cors(req: VercelRequest, res: VercelResponse) {
  const headers = getCorsHeaders(req);
  res.setHeader('Access-Control-Allow-Origin', headers['Access-Control-Allow-Origin']);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Vary', 'Origin');
}

/**
 * POST /api/send-welcome-email
 * Auth: Bearer Supabase access token for the newly signed-in user.
 * Email + user id come from the JWT — never trust a client-supplied address.
 */
export async function handleWelcomeEmail(req: VercelRequest, res: VercelResponse) {
  cors(req, res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  if (checkRateLimit(req as any)) {
    return res.status(429).json({ error: 'Too many requests' });
  }

  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authorization required' });
  }
  const token = authHeader.slice('Bearer '.length).trim();
  if (!token || token === 'undefined') {
    return res.status(401).json({ error: 'Invalid token' });
  }

  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
  const anon = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
  if (!url || !anon) {
    return res.status(500).json({ error: 'Auth not configured' });
  }

  const userClient = createClient(url, anon, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: userData, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userData.user?.email) {
    return res.status(401).json({ error: 'Invalid session' });
  }

  const user = userData.user;
  const rawName =
    (typeof req.body?.firstName === 'string' && req.body.firstName.trim())
    || String(user.user_metadata?.name || user.user_metadata?.full_name || '');
  const firstName = rawName.split(/\s+/).filter(Boolean)[0] || null;

  // Ops alert — dynamic import only when this route runs (keeps api/data lean).
  void import('./signup_notify.js')
    .then(({ notifySignupOnce }) => notifySignupOnce({
      userId: user.id,
      email: user.email,
      firstName,
      role: typeof user.user_metadata?.role === 'string' ? user.user_metadata.role : null,
      provider: typeof user.app_metadata?.provider === 'string' ? user.app_metadata.provider : null,
    }))
    .catch((err) => console.warn('[welcome-email] signup notify skipped:', err?.message || err));

  const result = await sendWelcomeEmail({
    userId: user.id,
    email: user.email,
    firstName,
  });

  if (result.ok === false) {
    const status = /RESEND_API_KEY/i.test(result.error || '') ? 503 : 500;
    console.error('[welcome-email] failed:', result.error);
    return res.status(status).json({ success: false, error: result.error });
  }

  return res.status(200).json({
    success: true,
    emailId: result.emailId ?? null,
    skipped: result.skipped ?? null,
  });
}
