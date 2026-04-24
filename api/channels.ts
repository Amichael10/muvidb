import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from './_lib/supabase';
import { checkRateLimit } from './_lib/rateLimit';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  Object.entries(CORS_HEADERS).forEach(([k, v]) => res.setHeader(k, v));
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  if (checkRateLimit(req as unknown as Request)) {
    return res.status(429).json({ error: 'Too many requests' });
  }

  const { id, search, category, featured } = req.query;

  // ── Single Channel Detail ──────────────────────────────────────────────────
  if (id && !Array.isArray(id)) {
    // Fetch channel
    const { data: channel, error: channelErr } = await supabase
      .from('channels')
      .select('*')
      .eq('id', id)
      .single();

    if (channelErr?.code === 'PGRST116' || !channel) return res.status(404).json({ error: 'Channel not found' });
    if (channelErr) return res.status(500).json({ error: 'Failed to fetch channel' });

    // Fetch saved videos (most recent first)
    const { data: videos } = await supabase
      .from('channel_videos')
      .select('id, video_id, title, thumbnail_url, published_at, duration_seconds, film_id, match_status')
      .eq('channel_id', id)
      .order('published_at', { ascending: false })
      .limit(50);

    // Fetch owner person details if linked
    let owner = null;
    if (channel.owner_person_id) {
      const { data: person } = await supabase
        .from('people')
        .select('id, name, photo_url, known_for_department')
        .eq('id', channel.owner_person_id)
        .single();
      owner = person;
    }

    // Fetch flag count
    const { count: flagCount } = await supabase
      .from('channel_flags')
      .select('id', { count: 'exact', head: true })
      .eq('channel_id', id)
      .eq('status', 'pending');

    return res.status(200).json({
      channel,
      videos: videos ?? [],
      owner,
      flagCount: flagCount ?? 0,
    });
  }

  // ── Channel List ───────────────────────────────────────────────────────────
  const limit = Math.min(Number(req.query.limit) || 24, 100);
  const offset = Math.max(Number(req.query.offset) || 0, 0);

  let query = supabase
    .from('channels')
    .select(
      'id, name, channel_handle, channel_url, description, category, country, ' +
      'subscriber_count, thumbnail_url, banner_url, is_featured, ' +
      'owner_person_id, owner_name, videos_last_fetched_at'
    )
    .range(offset, offset + limit - 1)
    .order('subscriber_count', { ascending: false, nullsFirst: false });

  if (search) query = query.ilike('name', `%${search}%`);
  if (category && category !== 'All') query = query.eq('category', category);
  if (featured === 'true') query = query.eq('is_featured', true);

  const { data, error } = await query;

  if (error) {
    console.error('channels query error:', error);
    return res.status(500).json({ error: 'Failed to fetch channels' });
  }

  return res.status(200).json({ channels: data ?? [], limit, offset });
}
