// SQL — run once in the Supabase SQL editor to create the honeypot table:
//
// create table if not exists honeypot_hits (
//   id         uuid        default gen_random_uuid() primary key,
//   ip         text,
//   user_agent text,
//   path       text,
//   created_at timestamptz default now()
// );

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from '../_lib/supabase';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const ip =
    (req.headers['x-forwarded-for'] as string ?? '').split(',')[0].trim() || 'unknown';
  const user_agent = (req.headers['user-agent'] as string) ?? 'unknown';

  // Log the hit — fire-and-forget, never block the 403 response on this
  supabase
    .from('honeypot_hits')
    .insert({ ip, user_agent, path: '/api/data/all' })
    .then(({ error }) => {
      if (error) console.error('honeypot log error:', error);
    });

  return res.status(403).json({ error: 'Forbidden' });
}
