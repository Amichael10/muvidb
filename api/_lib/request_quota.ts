import { createHash } from 'node:crypto';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from './supabase.js';

export async function requireRequestQuota(req: VercelRequest, res: VercelResponse, scope: string, identity?: string): Promise<boolean> {
  const forwarded = req.headers['x-forwarded-for'];
  const ip = (typeof forwarded === 'string' ? forwarded.split(',')[0].trim() : '') || req.socket?.remoteAddress || 'unknown';
  const subject = createHash('sha256').update(identity || ip).digest('hex');
  for (const [key, limit, seconds] of [
    [`${scope}:minute:${subject}`, 10, 60],
    [`${scope}:day:${subject}`, 50, 86400],
    [`${scope}:global:day`, 500, 86400],
  ] as const) {
    const { data, error } = await supabase.rpc('consume_request_quota', { p_subject: key, p_limit: limit, p_window_seconds: seconds });
    if (error) { res.status(503).json({ error: 'Request allowance service unavailable' }); return false; }
    if (!data) { res.setHeader('Retry-After', String(seconds)); res.status(429).json({ error: 'Request allowance exceeded' }); return false; }
  }
  return true;
}
