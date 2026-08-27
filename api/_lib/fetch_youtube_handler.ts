import type { VercelRequest, VercelResponse } from '@vercel/node';
import { handleCors } from './cors.js';

function isYouTubeUrl(value: string) {
  try {
    const url = new URL(value);
    return /(^|\.)youtube\.com$/i.test(url.hostname) || /(^|\.)youtu\.be$/i.test(url.hostname) || /(^|\.)youtube-nocookie\.com$/i.test(url.hostname);
  } catch {
    return false;
  }
}

function extractYouTubeId(urlStr: string): string | null {
  try {
    const url = new URL(urlStr);
    if (url.hostname.includes('youtu.be')) {
      return url.pathname.slice(1).split('?')[0] || null;
    }
    if (url.pathname.includes('/embed/')) {
      return url.pathname.split('/embed/')[1]?.split('?')[0] || null;
    }
    return url.searchParams.get('v') || null;
  } catch {
    return null;
  }
}

function parseIsoDuration(duration: string): number {
  if (!duration) return 60;
  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 60;
  const hours = parseInt(match[1] || '0', 10);
  const minutes = parseInt(match[2] || '0', 10);
  const seconds = parseInt(match[3] || '0', 10);
  return hours * 3600 + minutes * 60 + seconds;
}

export async function handleFetchYoutube(req: VercelRequest, res: VercelResponse) {
  if (handleCors(req, res)) return;

  if (req.method === 'GET') {
    const jobId = req.query.jobId as string;
    if (!jobId) {
      return res.status(400).json({ error: 'jobId is required' });
    }
    return res.status(200).json({
      jobId,
      stage: 'ready',
      percent: 100,
      message: 'Video ready',
      done: true,
      result: {
        path: req.query.source || '',
        title: req.query.title || 'YouTube Video',
        duration: Number(req.query.duration) || 60,
        temporary: true,
      }
    });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { url } = req.body || {};
    if (!url || typeof url !== 'string') {
      return res.status(400).json({ error: 'Provide a valid video URL.' });
    }

    const trimmedUrl = url.trim();

    if (!isYouTubeUrl(trimmedUrl)) {
      const isDirectVideo = /\.(mp4|webm|mov|m4v)(\?|$)/i.test(trimmedUrl) || trimmedUrl.includes('supabase.co') || trimmedUrl.includes('cloudinary');
      if (isDirectVideo) {
        const jobId = `direct-${Date.now()}`;
        return res.status(200).json({
          jobId,
          stage: 'ready',
          percent: 100,
          message: 'Direct video loaded',
          done: true,
          result: {
            path: trimmedUrl,
            title: 'Direct Video',
            duration: null,
            temporary: false,
          }
        });
      }
    }

    const videoId = extractYouTubeId(trimmedUrl);
    if (!videoId) {
      return res.status(400).json({ error: 'Could not extract YouTube video ID from URL.' });
    }

    let title = `YouTube Clip (${videoId})`;
    let duration = 60;
    let thumbnail = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;

    // Try YouTube Data API first if API key is present
    const apiKey = process.env.YOUTUBE_API_KEY || process.env.VITE_YOUTUBE_API_KEY;
    if (apiKey) {
      try {
        const ytApiRes = await fetch(
          `https://www.googleapis.com/youtube/v3/videos?part=snippet,contentDetails&id=${videoId}&key=${apiKey}`
        );
        if (ytApiRes.ok) {
          const ytData = await ytApiRes.json();
          const item = ytData.items?.[0];
          if (item) {
            title = item.snippet?.title || title;
            duration = parseIsoDuration(item.contentDetails?.duration);
            thumbnail = item.snippet?.thumbnails?.high?.url || item.snippet?.thumbnails?.default?.url || thumbnail;
          }
        }
      } catch {
        // continue
      }
    }

    // Fallback to oEmbed if needed
    if (title.startsWith('YouTube Clip (')) {
      try {
        const oembedRes = await fetch(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`);
        if (oembedRes.ok) {
          const oembedData = await oembedRes.json();
          title = oembedData.title || title;
          thumbnail = oembedData.thumbnail_url || thumbnail;
        }
      } catch {
        // continue
      }
    }

    let directStreamUrl: string | null = null;
    let extractorSource = 'youtube-meta';
    let extractorError = '';

    // Option 4: Query existing Render media-extractor microservice for direct stream extraction
    const extractorBaseUrl = (process.env.MEDIA_EXTRACTOR_URL || process.env.RENDER_EXTRACTOR_URL || 'https://muvidb.onrender.com').replace(/\/$/, '');
    const extractorSecret = process.env.EXTRACTOR_SECRET || '';

    try {
      const extRes = await fetch(`${extractorBaseUrl}/extract`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(extractorSecret ? { Authorization: `Bearer ${extractorSecret}` } : {})
        },
        body: JSON.stringify({ url: trimmedUrl }),
        signal: AbortSignal.timeout(45000)
      });
      const extData = await extRes.json().catch(() => ({}));
      if (extRes.ok) {
        if (extData.success && extData.video_url) {
          directStreamUrl = extData.video_url;
          extractorSource = 'render-extractor';
          if (extData.title) title = extData.title;
          if (extData.duration) duration = Number(extData.duration);
          if (extData.image_url) thumbnail = extData.image_url;
        } else {
          extractorError = extData.error || 'The extractor returned no playable video stream.';
        }
      } else {
        extractorError = extData.error || extData.detail || `Render extractor returned ${extRes.status}.`;
      }
    } catch (error) {
      extractorError = error instanceof Error ? error.message : 'Render extractor request failed.';
    }

    if (!directStreamUrl) {
      throw new Error(`YouTube metadata was found, but the video could not be prepared for canvas playback. ${extractorError}`.trim());
    }

    const jobId = `yt-${videoId}-${Date.now()}`;

    return res.status(200).json({
      jobId,
      stage: 'ready',
      percent: 100,
      message: directStreamUrl ? 'Direct video stream resolved!' : 'Video metadata ready',
      done: true,
      result: {
        path: directStreamUrl,
        streamUrl: directStreamUrl,
        isDirectStream: true,
        extractorSource,
        videoId,
        title,
        duration,
        thumbnail,
        temporary: true,
      }
    });
  } catch (error: any) {
    return res.status(500).json({
      error: error.message || 'Failed to process YouTube request',
    });
  }
}
