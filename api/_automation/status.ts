import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from '../_lib/supabase';
import { checkRateLimit } from '../_lib/rateLimit';

import { handleCors } from '../_lib/cors.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handleCors(req, res)) return;
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  if (checkRateLimit(req as unknown as Request)) {
    return res.status(429).json({ error: 'Too many requests' });
  }

  const { data, error } = await supabase
    .from('automation_jobs')
    .select('*')
    .order('id', { ascending: true });

  if (error) {
    console.error('Error fetching automation jobs:', error);
    return res.status(500).json({ error: 'Failed to fetch automation status' });
  }

  return res.status(200).json({ jobs: data ?? [] });
}
