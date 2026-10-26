import type { VercelRequest, VercelResponse } from '@vercel/node';
import { isValidAuth } from './auth.js';
import { supabase } from './supabase.js';
import {
  applyCriticVideoTranscript,
  approveCriticVideoCandidate,
  enqueueCriticVideoCandidate,
  identifyCriticVideoUrl,
  listCriticVideosAwaitingTranscript,
  pollCriticChannels,
  rejectCriticVideoCandidate,
  type TranscriptSource,
} from './critic_video_candidates.js';

/**
 * Admin surface for the video critic review queue.
 *
 * The transcript fetch itself is not here and cannot be: YouTube blocks
 * datacenter IPs, so services/local-clipper does that from the operator's
 * residential connection. This handler is the two ends of that hop — `pending`
 * tells the clipper what to fetch, `transcript` takes the result back — plus
 * the approve/reject queue a human works through before anything reaches the
 * public critic_reviews table.
 */

const TRANSCRIPT_SOURCES: TranscriptSource[] = ['captions', 'whisper'];

function body(req: VercelRequest): Record<string, any> {
  if (!req.body) return {};
  if (typeof req.body === 'string') {
    try { return JSON.parse(req.body); } catch { return {}; }
  }
  return req.body as Record<string, any>;
}

function queryString(req: VercelRequest, name: string): string {
  const raw = req.query[name];
  return String((Array.isArray(raw) ? raw[0] : raw) || '');
}

export async function handleCriticVideos(req: VercelRequest, res: VercelResponse) {
  if (!(await isValidAuth(req)).valid) return res.status(401).json({ error: 'Unauthorized' });

  const payload = body(req);
  const action = queryString(req, 'action') || String(payload.action || '');

  try {
    // ── What the clipper should fetch next ──────────────────────────────────
    if (action === 'pending') {
      const limit = Math.min(50, Math.max(1, Number(queryString(req, 'limit')) || 10));
      return res.status(200).json({ candidates: await listCriticVideosAwaitingTranscript(limit) });
    }

    // ── A transcript coming back from the clipper ───────────────────────────
    if (action === 'transcript') {
      if (req.method !== 'POST') return res.status(405).json({ error: 'Use POST to submit a transcript' });
      const videoId = String(payload.video_id || payload.videoId || '').trim();
      const transcript = String(payload.transcript || '');
      const source = String(payload.source || 'captions') as TranscriptSource;
      if (!videoId) return res.status(400).json({ error: 'video_id is required' });
      if (!transcript.trim()) return res.status(400).json({ error: 'transcript is required' });
      if (!TRANSCRIPT_SOURCES.includes(source)) {
        return res.status(400).json({ error: `source must be one of ${TRANSCRIPT_SOURCES.join(', ')}` });
      }
      const result = await applyCriticVideoTranscript(videoId, transcript, source);
      // A failed extraction is a recorded outcome, not a server fault: the
      // transcript arrived, it just could not be quoted from safely.
      return res.status(200).json(result);
    }

    // ── The human review queue ──────────────────────────────────────────────
    if (action === 'review-queue') {
      const limit = Math.min(100, Math.max(1, Number(queryString(req, 'limit')) || 25));
      const status = queryString(req, 'status') || 'pending_review';
      const { data, error } = await supabase
        .from('critic_review_candidates')
        .select('id,video_id,video_url,video_title,film_id,status,quote,excerpt_context,rating,'
          + 'quote_start_seconds,transcript_source,last_error,video_published_at,created_at,'
          + 'source_platform,critic_id,critic_channel_id')
        .eq('status', status)
        .order('video_published_at', { ascending: false, nullsFirst: false })
        .limit(limit);
      if (error) throw new Error(error.message);
      return res.status(200).json({ candidates: data || [] });
    }

    if (action === 'approve') {
      if (req.method !== 'POST') return res.status(405).json({ error: 'Use POST to approve' });
      const id = String(payload.id || payload.candidate_id || '').trim();
      if (!id) return res.status(400).json({ error: 'id is required' });
      return res.status(200).json(await approveCriticVideoCandidate(id));
    }

    if (action === 'reject') {
      if (req.method !== 'POST') return res.status(405).json({ error: 'Use POST to reject' });
      const id = String(payload.id || payload.candidate_id || '').trim();
      if (!id) return res.status(400).json({ error: 'id is required' });
      return res.status(200).json(await rejectCriticVideoCandidate(id, String(payload.reason || '') || undefined));
    }

    if (action === 'submit') {
      if (req.method !== 'POST') return res.status(405).json({ error: 'Use POST to submit a review' });
      const identified = identifyCriticVideoUrl(String(payload.url || ''));
      if (!identified) {
        return res.status(400).json({
          error: 'Paste a YouTube, Instagram or TikTok video URL',
        });
      }
      const title = String(payload.title || '').trim();
      const outcome = await enqueueCriticVideoCandidate({
        videoId: identified.videoId,
        sourcePlatform: identified.platform,
        videoUrl: identified.url,
        criticId: String(payload.critic_id || '').trim() || null,
        // Without a title there is nothing to match a film on; the operator
        // assigns it from the queue instead.
        title: title || identified.url,
        publishedAt: null,
      });
      return res.status(200).json({ ...identified, outcome });
    }

    if (action === 'attribute') {
      if (req.method !== 'POST') return res.status(405).json({ error: 'Use POST to attribute' });
      const id = String(payload.id || payload.candidate_id || '').trim();
      const criticId = String(payload.critic_id || '').trim();
      if (!id || !criticId) return res.status(400).json({ error: 'id and critic_id are required' });
      const { error } = await supabase
        .from('critic_review_candidates')
        .update({ critic_id: criticId, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw new Error(error.message);
      return res.status(200).json({ ok: true, id, critic_id: criticId });
    }

    // Assigning the film by hand, for a review whose title did not match.
    if (action === 'assign-film') {
      if (req.method !== 'POST') return res.status(405).json({ error: 'Use POST to assign a film' });
      const id = String(payload.id || payload.candidate_id || '').trim();
      const filmId = String(payload.film_id || '').trim();
      if (!id || !filmId) return res.status(400).json({ error: 'id and film_id are required' });
      const { error } = await supabase
        .from('critic_review_candidates')
        .update({ film_id: filmId, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw new Error(error.message);
      return res.status(200).json({ ok: true, id, film_id: filmId });
    }

    // Discovery, also driven by the whatsapp-style cron task.
    if (action === 'poll') {
      if (req.method !== 'POST') return res.status(405).json({ error: 'Use POST to poll channels' });
      const limit = Math.min(50, Math.max(1, Number(payload.limit) || 20));
      return res.status(200).json(await pollCriticChannels({ limit }));
    }

    return res.status(400).json({
      error: 'Unknown action',
      actions: ['pending', 'transcript', 'review-queue', 'submit', 'attribute', 'approve', 'reject',
        'assign-film', 'poll'],
    });
  } catch (error: any) {
    console.error('[critic-videos]', action, error?.message || error);
    return res.status(500).json({ error: error?.message || 'Critic video request failed' });
  }
}
