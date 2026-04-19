import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from '../_lib/supabase';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  Object.entries(CORS_HEADERS).forEach(([k, v]) => res.setHeader(k, v));
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { id } = req.query;
  if (!id || Array.isArray(id)) return res.status(400).json({ error: 'Invalid channel id' });

  // Fetch channel
  const { data: channel, error: channelErr } = await supabase
    .from('channels')
    .select('*')
    .eq('id', id)
    .single();

  if (channelErr?.code === 'PGRST116' || !channel) {
    return res.status(404).json({ error: 'Channel not found' });
  }
  if (channelErr) {
    console.error('channel query error:', channelErr);
    return res.status(500).json({ error: 'Failed to fetch channel' });
  }

  // Fetch saved videos from channel_videos table (most recent first)
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

  // Fetch flag count for admin awareness
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
