/** Preview + internal send — loaded only from api/data (same bundle as welcome email). */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { previewAuthEmailHtml, sendAuthEmail } from './auth_email_send.js';

export async function handleAuthEmailData(req: VercelRequest, res: VercelResponse) {
  const preview = typeof req.query.preview === 'string' ? req.query.preview : '';
  if (req.method === 'GET' && preview) {
    try {
      const html = await previewAuthEmailHtml(preview);
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.status(200).send(html);
    } catch (err: any) {
      console.error('[auth-email] preview failed:', err?.message || err, err?.stack);
      return res.status(500).json({ error: 'Preview failed', message: err?.message || String(err) });
    }
  }
  return res.status(404).json({ error: 'Use ?preview=signup on GET' });
}

export async function handleAuthEmailSend(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const expected = (process.env.CRON_SECRET || process.env.VITE_CRON_SECRET || '').trim();
  const auth = req.headers.authorization || '';
  if (!expected || auth !== `Bearer ${expected}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const payload = req.body?.payload;
  if (!payload?.user?.email || !payload?.email_data) {
    return res.status(400).json({ error: 'Missing payload' });
  }

  try {
    const result = await sendAuthEmail(payload);
    if (!result.ok) {
      return res.status(500).json({ error: result.error });
    }
    return res.status(200).json({ success: true, emailId: result.emailId, action: result.action });
  } catch (err: any) {
    console.error('[auth-email] send route failed:', err?.message || err);
    return res.status(500).json({ error: err?.message || 'Send failed' });
  }
}
