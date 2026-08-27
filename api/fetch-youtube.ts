import type { VercelRequest, VercelResponse } from '@vercel/node';
import { handleCors } from './_lib/cors.js';

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

export default async function handler(req: VercelRequest, res: VercelResponse) {
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
    if (!url) {
      return res.status(400).json({ error: 'Provide a valid video URL.' });
    }

    if (!isYouTubeUrl(url)) {
      const isDirectVideo = /\.(mp4|webm|mov|m4v)(\?|$)/i.test(url) || url.includes('supabase.co') || url.includes('cloudinary');
      if (isDirectVideo) {
        const jobId = `direct-${Date.now()}`;
        return res.status(200).json({
          jobId,
          stage: 'ready',
          percent: 100,
          message: 'Direct video loaded',
          done: true,
          result: {
            path: url,
            title: 'Direct Video',
            duration: null,
            temporary: false,
          }
        });
      }
    }

    const videoId = extractYouTubeId(url);
    if (!videoId) {
      return res.status(400).json({ error: 'Could not extract YouTube video ID from URL.' });
    }

    let title = `YouTube Video (${videoId})`;
    let duration = 60;

    try {
      const oembedRes = await fetch(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`);
      if (oembedRes.ok) {
        const oembedData = await oembedRes.json();
        title = oembedData.title || title;
      }
    } catch {
      // ignore
    }

    const embedUrl = `https://www.youtube.com/embed/${videoId}?autoplay=1`;
    const jobId = `yt-${videoId}-${Date.now()}`;

    return res.status(200).json({
      jobId,
      stage: 'ready',
      percent: 100,
      message: 'Video metadata ready',
      done: true,
      result: {
        path: url,
        streamUrl: embedUrl,
        videoId,
        title,
        duration,
        temporary: true,
      }
    });
  } catch (error: any) {
    return res.status(500).json({
      error: error.message || 'Failed to process YouTube request',
    });
  }
}
