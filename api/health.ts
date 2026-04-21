import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { service } = req.query;

  if (service === 'youtube') {
    const apiKey = process.env.YOUTUBE_API_KEY;
    if (!apiKey) return res.status(500).json({ status: 'missing_api_key' });
    try {
      const ytRes = await fetch(`https://www.googleapis.com/youtube/v3/videos?part=id&id=Ks-_Mh1QhMc&key=${apiKey}`);
      return res.status(ytRes.ok ? 200 : ytRes.status).json({ status: ytRes.ok ? 'active' : 'error' });
    } catch (e) { return res.status(500).json({ status: 'unreachable' }); }
  }

  if (service === 'tmdb') {
    const apiKey = process.env.VITE_TMDB_API_KEY || process.env.TMDB_API_KEY;
    if (!apiKey) return res.status(500).json({ status: 'missing_api_key' });
    try {
      const tmdbRes = await fetch(`https://api.themoviedb.org/3/configuration?api_key=${apiKey}`);
      return res.status(tmdbRes.ok ? 200 : tmdbRes.status).json({ status: tmdbRes.ok ? 'active' : 'error' });
    } catch (e) { return res.status(500).json({ status: 'unreachable' }); }
  }

  return res.status(200).json({ status: 'api_online' });
}
