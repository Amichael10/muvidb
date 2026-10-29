import type { VercelRequest, VercelResponse } from '@vercel/node';
import { isValidAuth } from './auth.js';
import { supabase } from './supabase.js';
import { generateAIContent, generateAIVisionContent, parseJSON } from './ai_service.js';
import { extractExplicitRating, selectCriticExcerpt } from './critic_review_extractor.js';
import { ytGet } from './yt_service.js';
import {
  applyCriticVideoTranscript,
  approveCriticVideoCandidate,
  criticVideoTitleCandidates,
  enqueueCriticVideoCandidate,
  identifyCriticVideoUrl,
  listCriticVideosAwaitingTranscript,
  matchFilmForVideoTitle,
  normalizeSpokenRatings,
  pollCriticChannels,
  rejectCriticVideoCandidate,
  type TranscriptSource,
} from './critic_video_candidates.js';

/**
 * Admin surface for the video critic review queue + instant YouTube & OCR extractors.
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

function normalizeStarRating(rawRating: unknown, fallbackText = ''): number | null {
  if (typeof rawRating === 'number' && Number.isFinite(rawRating) && rawRating > 0) {
    if (rawRating <= 5) return Math.max(1, Math.min(5, Math.round(rawRating)));
    if (rawRating <= 10) return Math.max(1, Math.min(5, Math.round(rawRating / 2)));
    if (rawRating <= 100) return Math.max(1, Math.min(5, Math.round(rawRating / 20)));
  }
  if (typeof rawRating === 'string' && rawRating.trim()) {
    const parsedFromStr = extractExplicitRating(rawRating);
    if (parsedFromStr !== null) return Math.max(1, Math.min(5, Math.round(parsedFromStr)));
    const num = Number(rawRating);
    if (Number.isFinite(num) && num > 0) return normalizeStarRating(num);
  }
  if (fallbackText) {
    const parsed = extractExplicitRating(normalizeSpokenRatings(fallbackText));
    if (parsed !== null) return Math.max(1, Math.min(5, Math.round(parsed)));
  }
  return null;
}

async function resolveMatchedFilm(filmTitleHint: string | null | undefined, fallbackVideoTitle = '') {
  const candidates: string[] = [];
  if (filmTitleHint && filmTitleHint.trim().length >= 2) {
    candidates.push(filmTitleHint.trim());
  }
  if (fallbackVideoTitle) {
    candidates.push(...criticVideoTitleCandidates(fallbackVideoTitle));
  }
  for (const candidate of candidates) {
    const { data } = await supabase
      .from('films')
      .select('id, title, year, poster_url')
      .ilike('title', candidate)
      .order('year', { ascending: false, nullsFirst: false })
      .limit(1);
    if (data?.[0]) return data[0];
  }
  if (filmTitleHint && filmTitleHint.trim().length >= 3) {
    const { data } = await supabase
      .from('films')
      .select('id, title, year, poster_url')
      .ilike('title', `%${filmTitleHint.trim()}%`)
      .order('year', { ascending: false, nullsFirst: false })
      .limit(1);
    if (data?.[0]) return data[0];
  }
  return null;
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

    // ── Instant Screenshot OCR Extractor ────────────────────────────────────
    if (action === 'extract-ocr') {
      if (req.method !== 'POST') return res.status(405).json({ error: 'Use POST for extract-ocr' });
      const rawImage = String(payload.image || payload.imageBase64 || '').trim();
      const rawOcrText = String(payload.rawOcrText || payload.text || '').trim();
      if (!rawImage && !rawOcrText) {
        return res.status(400).json({ error: 'Provide a screenshot image or OCR text to extract from' });
      }

      let base64Data = rawImage;
      let mimeType = String(payload.mimeType || 'image/png');
      const dataUrlMatch = rawImage.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
      if (dataUrlMatch) {
        mimeType = dataUrlMatch[1];
        base64Data = dataUrlMatch[2];
      }

      const ocrPrompt = `You are extracting a Nollywood / African film critic review from a screenshot (e.g. from YouTube, X/Twitter, Instagram, Letterboxd, or a blog).
Read ALL visible text in the image and return ONLY valid JSON in this exact shape:
{
  "rawText": "full verbatim transcription of all readable review text in the screenshot",
  "quote": "the sharpest, most impactful 1-2 sentence critical verdict or pull-quote from the review text (verbatim)",
  "rating": 4,
  "filmTitle": "detected movie title being reviewed, or null if not visible",
  "criticName": "detected critic name, handle, or channel name, or null if not visible"
}
Rules:
- For "rating", convert any visible score (e.g. "7/10", "4/5", "★★★★", "8 out of 10") to a 1 to 5 integer scale, or null if no rating is present.
- For "quote", keep the critic's exact wording without inventing text.`;

      let parsed: any = null;
      let engine = 'ocr';

      if (base64Data) {
        try {
          const visionRes = await generateAIVisionContent(ocrPrompt, base64Data, mimeType);
          parsed = parseJSON(visionRes.text);
          engine = visionRes.telemetry?.engine || 'ai-vision';
        } catch (visionErr: any) {
          console.warn('[critic-videos:extract-ocr] Vision fallback to text OCR:', visionErr?.message || visionErr);
        }
      }

      if (!parsed && rawOcrText) {
        try {
          const textPrompt = `${ocrPrompt}\n\nOCR TEXT FROM SCREENSHOT:\n${rawOcrText.slice(0, 12000)}`;
          const aiRes = await generateAIContent(textPrompt);
          parsed = parseJSON(aiRes.text);
          engine = aiRes.telemetry?.engine || 'ai-text';
        } catch {
          const excerpt = await selectCriticExcerpt(rawOcrText);
          parsed = {
            rawText: rawOcrText,
            quote: excerpt.excerpt,
            rating: excerpt.rating,
            filmTitle: null,
            criticName: null,
          };
          engine = 'deterministic-ocr';
        }
      }

      if (!parsed) {
        return res.status(422).json({ error: 'Could not extract text from the screenshot. Try another screenshot or let local OCR finish.' });
      }

      const fullText = String(parsed.rawText || rawOcrText || '').trim();
      const quote = String(parsed.quote || fullText).trim();
      const rating = normalizeStarRating(parsed.rating, `${quote}\n${fullText}`);
      const filmTitle = parsed.filmTitle ? String(parsed.filmTitle).trim() : null;
      const criticName = parsed.criticName ? String(parsed.criticName).trim() : null;
      const matchedFilm = await resolveMatchedFilm(filmTitle, fullText.split('\n')[0] || '');

      return res.status(200).json({
        ok: true,
        rawText: fullText,
        quote,
        rating,
        filmTitle,
        criticName,
        matchedFilm,
        engine,
      });
    }

    // ── Instant YouTube / Video Review Extractor ────────────────────────────
    if (action === 'extract-youtube') {
      if (req.method !== 'POST') return res.status(405).json({ error: 'Use POST for extract-youtube' });
      const rawUrl = String(payload.url || '').trim();
      const suppliedTranscript = String(payload.transcript || '').trim();
      const identified = identifyCriticVideoUrl(rawUrl);
      if (!identified) {
        return res.status(400).json({ error: 'Paste a valid YouTube, Instagram, or TikTok video URL' });
      }

      let videoTitle = String(payload.title || '').trim();
      let description = '';
      let channelTitle = '';
      let publishedAt: string | null = null;

      if (identified.platform === 'youtube') {
        try {
          const ytRes = await ytGet('videos', { part: 'snippet', id: identified.videoId });
          const item = ytRes?.items?.[0];
          if (item?.snippet) {
            videoTitle = item.snippet.title || videoTitle;
            description = item.snippet.description || '';
            channelTitle = item.snippet.channelTitle || '';
            publishedAt = item.snippet.publishedAt || null;
          }
        } catch (ytErr: any) {
          console.warn('[critic-videos:extract-youtube] ytGet warning:', ytErr?.message || ytErr);
        }
      }

      const sourceCorpus = [suppliedTranscript, description, videoTitle].filter(Boolean).join('\n\n').trim();
      let quote = '';
      let rating: number | null = null;
      let detectedFilmTitle: string | null = null;

      if (sourceCorpus.length > 20) {
        try {
          const prompt = `You are extracting a Nollywood film critic review from a video review's metadata/transcript.
VIDEO TITLE: ${videoTitle}
CHANNEL: ${channelTitle}
CONTENT / DESCRIPTION / TRANSCRIPT:
${sourceCorpus.slice(0, 14000)}

Return ONLY valid JSON:
{
  "quote": "the sharpest 1-2 sentence critical verdict or pull-quote summarizing the critic's review of the film (use verbatim sentences from the transcript/description when available)",
  "rating": 4,
  "filmTitle": "exact title of the movie being reviewed"
}
Rules:
- Convert any rating (e.g. 7/10, 4/5) to a 1-5 integer, or null if no rating is mentioned.
- Never return promotional channel links, social handles, or 'subscribe to my channel' boilerplate as the quote.`;
          const aiRes = await generateAIContent(prompt);
          const parsed = parseJSON(aiRes.text) as any;
          if (parsed?.quote) quote = String(parsed.quote).trim();
          rating = normalizeStarRating(parsed?.rating, sourceCorpus);
          if (parsed?.filmTitle) detectedFilmTitle = String(parsed.filmTitle).trim();
        } catch {
          const fallback = await selectCriticExcerpt(sourceCorpus);
          quote = fallback.excerpt;
          rating = normalizeStarRating(fallback.rating, sourceCorpus);
        }
      }

      const matchedFilm = await resolveMatchedFilm(detectedFilmTitle, videoTitle);

      if (payload.enqueue) {
        await enqueueCriticVideoCandidate({
          videoId: identified.videoId,
          sourcePlatform: identified.platform,
          videoUrl: identified.url,
          criticId: String(payload.critic_id || '').trim() || null,
          title: videoTitle || identified.url,
          publishedAt,
        });
      }

      return res.status(200).json({
        ok: true,
        platform: identified.platform,
        videoId: identified.videoId,
        videoUrl: identified.url,
        videoTitle,
        channelTitle,
        quote,
        rating,
        filmTitle: detectedFilmTitle || matchedFilm?.title || null,
        matchedFilm,
      });
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
        'assign-film', 'poll', 'extract-ocr', 'extract-youtube'],
    });
  } catch (error: any) {
    console.error('[critic-videos]', action, error?.message || error);
    return res.status(500).json({ error: error?.message || 'Critic video request failed' });
  }
}
