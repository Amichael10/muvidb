import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { service } = req.query;

  if (service === 'youtube') {
    const apiKey = process.env.YOUTUBE_API_KEY || process.env.VITE_YOUTUBE_API_KEY;
    if (!apiKey) return res.status(500).json({ status: 'missing_api_key', error: 'YouTube API key not found in environment' });
    try {
      const ytRes = await fetch(`https://www.googleapis.com/youtube/v3/videos?part=id&id=Ks-_Mh1QhMc&key=${apiKey}`);
      const data = await ytRes.json().catch(() => ({}));
      return res.status(ytRes.ok ? 200 : ytRes.status).json({ 
        status: ytRes.ok ? 'active' : 'error',
        code: ytRes.status,
        details: data.error || data
      });
    } catch (e) { return res.status(500).json({ status: 'unreachable', error: e.message }); }
  }

  if (service === 'tmdb') {
    const apiKey = process.env.TMDB_API_KEY || process.env.VITE_TMDB_API_KEY;
    if (!apiKey) return res.status(500).json({ status: 'missing_api_key', error: 'TMDB API key not found in environment' });
    try {
      const tmdbRes = await fetch(`https://api.themoviedb.org/3/configuration?api_key=${apiKey}`);
      const data = await tmdbRes.json().catch(() => ({}));
      return res.status(tmdbRes.ok ? 200 : tmdbRes.status).json({ 
        status: tmdbRes.ok ? 'active' : 'error',
        code: tmdbRes.status,
        details: data.error || data
      });
    } catch (e) { return res.status(500).json({ status: 'unreachable', error: e.message }); }
  }

  return res.status(200).json({ status: 'api_online' });
}
