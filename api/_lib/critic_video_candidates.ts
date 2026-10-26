/**
 * Video critic reviews, from a channel upload to a row in critic_reviews.
 *
 * critics_sync reads RSS feeds and scrapes article bodies, so it cannot see the
 * critics who only publish on video. This pipeline fills that gap and reuses
 * the extraction that already exists: once a video has a punctuated transcript,
 * selectCriticExcerpt() picks and verifies the pull quote exactly as it does
 * for an article.
 *
 * The fetch is the one step that cannot run here. YouTube blocks datacenter IPs
 * ("Sign in to confirm you're not a bot"), which is why services/local-clipper
 * exists and runs on the operator's residential connection. So discovery and
 * extraction run on the server, and the transcript is handed back in by the
 * clipper via applyCriticVideoTranscript().
 *
 * Nothing here writes to critic_reviews. A transcript quote is exact to the
 * transcript, not to the audio, so approval is a human step.
 */

import { supabase } from './supabase.js';
import { selectCriticExcerpt, extractExplicitRating } from './critic_review_extractor.js';
import {
  restorePunctuation,
  stripTimestampTags,
  timestampForWordIndex,
  wordIndexOfQuote,
} from './transcript_punctuation.js';
import { ytGet } from './yt_service.js';

/**
 * The values services/local-clipper /metadata actually reports. It also
 * reports 'none' and 'captions_unusable', but neither carries a transcript,
 * so neither reaches this pipeline.
 */
export type TranscriptSource = 'captions' | 'whisper';

export interface CriticChannelRow {
  id: string;
  youtube_channel_id: string;
  name: string;
  uploads_playlist_id?: string | null;
  baseline_at: string;
}

interface CriticCandidateRow {
  id: string;
  video_id: string;
  video_url: string | null;
  source_platform: CriticSourcePlatform;
  critic_id: string | null;
  critic_channel_id: string | null;
  film_id: string | null;
  quote: string | null;
  excerpt_context: string | null;
  rating: number | null;
  quote_start_seconds: number | null;
  critic_review_id: string | null;
}

/** The canonical critic record an approved review is attributed to. */
interface CriticAttribution {
  id: string;
  name?: string | null;
  title?: string | null;
  publication?: string | null;
  avatar_url?: string | null;
  handle?: string | null;
}

export type CriticSourcePlatform = 'youtube' | 'instagram' | 'tiktok' | 'other';

export interface CriticVideoCandidateInput {
  videoId: string;
  criticChannelId?: string | null;
  /** Attribution for a hand-submitted review with no channel behind it. */
  criticId?: string | null;
  title: string;
  publishedAt?: string | null;
  sourcePlatform?: CriticSourcePlatform;
  /** Overrides the derived URL, for a platform that is not YouTube. */
  videoUrl?: string | null;
}

/** Boilerplate that surrounds the film title in a review video's title. */
const REVIEW_NOISE =
  /\b(?:full\s+)?(?:movie|film)?\s*(?:review|recap|reaction|breakdown|explained|spoilers?|spoiler\s+talk)\b/gi;
const PLATFORM_NOISE = /\b(?:nollywood|netflix|prime\s*video|amazon|showmax|youtube|cinema|20\d{2})\b/gi;

/**
 * Plausible film titles inside a review video's title, best guess first.
 *
 * Real examples these have to survive:
 *   "TELE X ZIKORA - Nollywood Movie Review (2026 Nigerian YA Romance Film)"
 *   "The Herd Is... Unbelievable (Daniel Etim Effiong Nollywood Movie Review)"
 *   "AJOSEPO 2: THE GATHERING - Full Movie Recap/Review - Timini Egbuson"
 */
export function criticVideoTitleCandidates(videoTitle: string): string[] {
  const candidates: string[] = [];
  const push = (value: string | undefined | null) => {
    const cleaned = String(value || '')
      // Noise first: stripping it can expose a separator that then needs
      // trimming, which is how "TELE X ZIKORA -" used to survive.
      .replace(REVIEW_NOISE, ' ')
      .replace(PLATFORM_NOISE, ' ')
      .replace(/[|•/\\]/g, ' ')
      .replace(/\s+/g, ' ')
      .replace(/^[\s\-–—:,.]+|[\s\-–—:,.]+$/g, '')
      .trim();
    if (cleaned.length < 2 || cleaned.length > 120) return;
    // A comma in a review title separates cast names, not title words, and a
    // cast name is the one candidate that can confidently match the wrong
    // film. Titles themselves effectively never carry one here.
    if (cleaned.includes(',')) return;
    candidates.push(cleaned);
  };

  // Parentheticals carry the cast and the "Nollywood Movie Review" tag, never
  // the title, so the text before the first one is the strongest signal.
  const withoutParens = videoTitle.replace(/\([^)]*\)|\[[^\]]*\]/g, ' ');
  push(withoutParens);

  // A leading run of capitals is how most of these channels write the title.
  const shouted = withoutParens.match(/^\s*([A-Z0-9][A-Z0-9'’:!?\s]{2,})(?=\s*(?:[-–—:|]|$))/);
  if (shouted) push(shouted[1]);

  // Split on the separator the channel used between title and description.
  for (const part of withoutParens.split(/\s+[-–—|]\s+|:\s+/)) push(part);

  // "<TITLE> Is a Confusing Movie" — the verb starts the commentary.
  const beforeVerb = withoutParens.match(/^(.{2,60}?)\s+(?:is|was|has|really|finally|might|does|did|just)\b/i);
  if (beforeVerb) push(beforeVerb[1]);

  // Progressive prefixes, as critics_sync does for article headlines.
  const words = candidates[0]?.split(/\s+/) || [];
  if (words.length > 4) {
    push(words.slice(0, 3).join(' '));
    push(words.slice(0, 2).join(' '));
  }

  return [...new Set(candidates)];
}

/** First film whose title matches one of the candidates, or null. */
export async function matchFilmForVideoTitle(videoTitle: string): Promise<string | null> {
  for (const candidate of criticVideoTitleCandidates(videoTitle)) {
    const { data, error } = await supabase
      .from('films')
      .select('id')
      .ilike('title', candidate)
      .order('year', { ascending: false, nullsFirst: false })
      .limit(1);
    if (error) throw new Error(`Cannot match film for critic video: ${error.message}`);
    if (data?.[0]) return data[0].id;
  }
  return null;
}

/**
 * Record a review video, keyed on the video so a second pass enriches the same
 * row instead of queuing the review twice. A video whose film is not matched
 * yet is kept, not dropped: reviews often land before the film is published.
 */
export async function enqueueCriticVideoCandidate(input: CriticVideoCandidateInput): Promise<'inserted' | 'updated'> {
  const { data: existing, error: readError } = await supabase
    .from('critic_review_candidates')
    .select('id,film_id,status')
    .eq('video_id', input.videoId)
    .maybeSingle();
  if (readError) throw new Error(`Cannot read critic video candidate: ${readError.message}`);

  // Only look up the film when there is not one already: an operator may have
  // assigned it by hand, and that beats a title guess.
  const filmId = existing?.film_id || (await matchFilmForVideoTitle(input.title));

  const platform: CriticSourcePlatform = input.sourcePlatform || 'youtube';
  const payload = {
    video_id: input.videoId,
    critic_channel_id: input.criticChannelId || null,
    critic_id: input.criticId || null,
    source_platform: platform,
    film_id: filmId,
    video_title: input.title,
    video_published_at: input.publishedAt || null,
    video_url: input.videoUrl
      || (platform === 'youtube' ? `https://www.youtube.com/watch?v=${input.videoId}` : null),
    updated_at: new Date().toISOString(),
  };

  if (!existing) {
    const { error } = await supabase
      .from('critic_review_candidates')
      .insert({ ...payload, status: 'pending_transcript' });
    if (error) throw new Error(`Cannot queue critic video candidate: ${error.message}`);
    return 'inserted';
  }

  // A decided candidate keeps its verdict; re-discovery must not reopen a
  // review an operator already rejected or approved.
  const { error } = await supabase
    .from('critic_review_candidates')
    .update(payload)
    .eq('id', existing.id)
    .in('status', ['pending_transcript', 'pending_review', 'failed']);
  if (error) throw new Error(`Cannot update critic video candidate: ${error.message}`);
  return 'updated';
}

async function resolveUploadsPlaylistId(channel: CriticChannelRow): Promise<string | null> {
  if (channel.uploads_playlist_id) return channel.uploads_playlist_id;
  const response = await ytGet('channels', { part: 'contentDetails', id: channel.youtube_channel_id });
  const playlistId = response?.items?.[0]?.contentDetails?.relatedPlaylists?.uploads || null;
  if (playlistId) {
    await supabase.from('critic_channels').update({ uploads_playlist_id: playlistId }).eq('id', channel.id);
  }
  return playlistId;
}

/**
 * Walk each enabled critic channel's uploads playlist and queue anything newer
 * than its baseline.
 *
 * A playlistItems page costs 1 quota unit, against 100 for a search query, so
 * polling a few dozen channels hourly is a rounding error on a 10,000-unit
 * daily budget. WebSub would be cheaper still, but youtube_websub subscribes
 * from the `channels` table, which drives film ingestion — a critic channel
 * there would have its reviews ingested as films.
 */
export async function pollCriticChannels(input: { limit?: number } = {}) {
  const result = { channels: 0, discovered: 0, queued: 0, errors: [] as Array<{ channel: string; error: string }> };
  const { data: channels, error } = await supabase
    .from('critic_channels')
    .select('id,youtube_channel_id,name,uploads_playlist_id,baseline_at')
    .eq('is_enabled', true)
    .order('last_polled_at', { ascending: true, nullsFirst: true })
    .limit(input.limit ?? 20);
  if (error) throw new Error(`Cannot read critic channels: ${error.message}`);

  for (const channel of (channels || []) as CriticChannelRow[]) {
    result.channels++;
    try {
      const playlistId = await resolveUploadsPlaylistId(channel);
      if (!playlistId) throw new Error('Channel has no uploads playlist');

      const response = await ytGet('playlistItems', {
        part: 'snippet,contentDetails',
        playlistId,
        maxResults: '15',
      });
      const baseline = Date.parse(channel.baseline_at);
      let newestVideoId: string | null = null;

      for (const item of response?.items || []) {
        const videoId = item?.contentDetails?.videoId;
        const publishedAt = item?.contentDetails?.videoPublishedAt || item?.snippet?.publishedAt || null;
        const title = item?.snippet?.title || '';
        if (!videoId || !title) continue;
        if (!newestVideoId) newestVideoId = videoId;
        result.discovered++;
        // Adding a channel must not enqueue its whole back catalogue.
        if (publishedAt && Number.isFinite(baseline) && Date.parse(publishedAt) <= baseline) continue;
        await enqueueCriticVideoCandidate({
          videoId,
          criticChannelId: channel.id,
          title,
          publishedAt,
        });
        result.queued++;
      }

      await supabase
        .from('critic_channels')
        .update({
          last_polled_at: new Date().toISOString(),
          last_video_id: newestVideoId,
          last_error: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', channel.id);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      result.errors.push({ channel: channel.name, error: message });
      await supabase
        .from('critic_channels')
        .update({ last_polled_at: new Date().toISOString(), last_error: message })
        .eq('id', channel.id);
    }
  }

  return result;
}

/** Videos the clipper still needs to fetch a transcript for. */
export async function listCriticVideosAwaitingTranscript(limit = 10) {
  const { data, error } = await supabase
    .from('critic_review_candidates')
    .select('id,video_id,video_url,video_title,film_id,attempts')
    .eq('status', 'pending_transcript')
    .order('created_at', { ascending: true })
    .limit(limit);
  if (error) throw new Error(`Cannot read pending critic videos: ${error.message}`);
  return data || [];
}

/**
 * Spoken ratings, for rating detection only.
 *
 * extractExplicitRating matches "7/10" but video critics say it out loud —
 * "seven out of ten", "a solid six". The rewritten copy is never quoted from;
 * it exists so the digits are there for the existing regex to find.
 */
const NUMBER_WORDS: Record<string, string> = {
  zero: '0', one: '1', two: '2', three: '3', four: '4', five: '5',
  six: '6', seven: '7', eight: '8', nine: '9', ten: '10',
};

export function normalizeSpokenRatings(text: string): string {
  const words = Object.keys(NUMBER_WORDS).join('|');
  return text
    .replace(new RegExp(`\\b(${words})\\s+(?:and\\s+a\\s+half|point\\s+five)\\b`, 'gi'),
      (_m, word) => `${Number(NUMBER_WORDS[String(word).toLowerCase()]) + 0.5}`)
    .replace(new RegExp(`\\b(${words})\\b`, 'gi'), (_m, word) => NUMBER_WORDS[String(word).toLowerCase()])
    .replace(/\b(\d+(?:\.\d+)?)\s+(?:out\s+of|over|on)\s+(5|10|100)\b/gi, '$1/$2');
}

/**
 * Attach a transcript fetched by the clipper, extract the quote and rating, and
 * move the candidate to human review.
 *
 * Fails the candidate rather than quoting it when punctuation cannot be
 * restored verbatim: without sentence punctuation selectCriticExcerpt falls
 * through to its 280-character prefix, which on a review video is the channel
 * intro, not criticism.
 */
export async function applyCriticVideoTranscript(
  videoId: string,
  rawTranscript: string,
  source: TranscriptSource,
) {
  const { data: candidate, error: readError } = await supabase
    .from('critic_review_candidates')
    .select('id,status,attempts')
    .eq('video_id', videoId)
    .maybeSingle();
  if (readError) throw new Error(`Cannot read critic video candidate: ${readError.message}`);
  if (!candidate) throw new Error(`No critic video candidate for ${videoId}`);

  const attempts = (candidate.attempts || 0) + 1;
  const fail = async (reason: string) => {
    const { error } = await supabase
      .from('critic_review_candidates')
      .update({ status: 'failed', last_error: reason, attempts, updated_at: new Date().toISOString() })
      .eq('id', candidate.id);
    if (error) throw new Error(`Cannot record critic video failure: ${error.message}`);
    return { status: 'failed' as const, reason };
  };

  const { text: plain, marks } = stripTimestampTags(rawTranscript || '');
  if (plain.length < 300) return fail(`Transcript too short to quote from (${plain.length} characters)`);

  const punctuated = await restorePunctuation(plain);
  if (!punctuated.verified) return fail(`Punctuation could not be restored verbatim: ${punctuated.reason}`);

  const extracted = await selectCriticExcerpt(punctuated.text);
  // The rating is read from a spoken-number rewrite; the quote never is.
  const rating = extracted.rating ?? extractExplicitRating(normalizeSpokenRatings(punctuated.text));

  const wordIndex = wordIndexOfQuote(plain, extracted.excerpt);
  const quoteStartSeconds = wordIndex === null ? null : timestampForWordIndex(marks, wordIndex);

  const { error } = await supabase
    .from('critic_review_candidates')
    .update({
      status: 'pending_review',
      transcript: punctuated.text,
      transcript_source: source,
      quote: extracted.excerpt,
      excerpt_context: extracted.excerptContext,
      rating,
      quote_start_seconds: quoteStartSeconds,
      last_error: null,
      attempts,
      updated_at: new Date().toISOString(),
    })
    .eq('id', candidate.id);
  if (error) throw new Error(`Cannot save critic video extraction: ${error.message}`);

  return { status: 'pending_review' as const, quote: extracted.excerpt, rating, quoteStartSeconds };
}

/**
 * Deep link to the moment the quote is spoken, so a reader can verify it.
 *
 * Only YouTube takes a start offset. An Instagram or TikTok review links to
 * the post, which means its quote cannot be click-verified — the admin queue
 * says so rather than implying a precision that is not there.
 */
export function criticVideoReviewUrl(
  videoId: string,
  startSeconds: number | null,
  platform: CriticSourcePlatform = 'youtube',
  videoUrl?: string | null,
): string {
  if (platform !== 'youtube') return videoUrl || '';
  const base = `https://www.youtube.com/watch?v=${videoId}`;
  return startSeconds && startSeconds > 0 ? `${base}&t=${Math.floor(startSeconds)}` : base;
}

export function supportsQuoteDeepLink(platform: CriticSourcePlatform): boolean {
  return platform === 'youtube';
}

/**
 * Identify a pasted review URL. The id is what the candidate is keyed on, so
 * it has to be stable per post: a YouTube video id, or an Instagram shortcode.
 */
export function identifyCriticVideoUrl(
  rawUrl: string,
): { platform: CriticSourcePlatform; videoId: string; url: string } | null {
  const url = String(rawUrl || '').trim();
  if (!url) return null;

  const youtube = url.match(
    /(?:youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|live\/|embed\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/,
  );
  if (youtube) {
    return { platform: 'youtube', videoId: youtube[1], url: `https://www.youtube.com/watch?v=${youtube[1]}` };
  }

  const instagram = url.match(/instagram\.com\/(?:p|reel|reels|tv)\/([A-Za-z0-9_-]+)/);
  if (instagram) {
    return { platform: 'instagram', videoId: `ig_${instagram[1]}`, url: `https://www.instagram.com/reel/${instagram[1]}/` };
  }

  const tiktok = url.match(/tiktok\.com\/[^/]+\/video\/(\d+)/);
  if (tiktok) return { platform: 'tiktok', videoId: `tt_${tiktok[1]}`, url };

  return null;
}

/**
 * Publish an approved candidate into critic_reviews.
 *
 * Upserts on the review this candidate already produced, so approving twice
 * updates one row rather than adding a second review for the same video.
 */
export async function approveCriticVideoCandidate(candidateId: string) {
  // Read the channel and critic separately rather than as embedded selects:
  // these tables are not in the generated Supabase types yet, and a join
  // widens the inferred row type to an error shape.
  const { data: row, error: readError } = await supabase
    .from('critic_review_candidates')
    .select('id,video_id,video_url,source_platform,film_id,quote,excerpt_context,rating,'
      + 'quote_start_seconds,critic_review_id,critic_id,critic_channel_id')
    .eq('id', candidateId)
    .maybeSingle();
  if (readError) throw new Error(`Cannot read critic video candidate: ${readError.message}`);
  if (!row) throw new Error(`No critic video candidate ${candidateId}`);
  const candidate = row as unknown as CriticCandidateRow;
  if (!candidate.film_id) throw new Error('Assign a film before approving this review');
  if (!candidate.quote) throw new Error('This candidate has no extracted quote to publish');

  // A hand-set critic wins over the channel's, so a guest review on someone
  // else's channel is attributed to whoever actually said it.
  let criticId = candidate.critic_id;
  if (!criticId && candidate.critic_channel_id) {
    const { data: channel, error: channelError } = await supabase
      .from('critic_channels')
      .select('critic_id')
      .eq('id', candidate.critic_channel_id)
      .maybeSingle();
    if (channelError) throw new Error(`Cannot read critic channel: ${channelError.message}`);
    criticId = (channel as unknown as { critic_id?: string | null } | null)?.critic_id || null;
  }
  if (!criticId) throw new Error('Attribute this review to a critic before approving it');

  const { data: criticRow, error: criticError } = await supabase
    .from('critics')
    .select('id,name,title,publication,avatar_url,handle')
    .eq('id', criticId)
    .maybeSingle();
  if (criticError) throw new Error(`Cannot read critic: ${criticError.message}`);
  if (!criticRow) throw new Error(`Critic ${criticId} no longer exists`);
  const critic = criticRow as unknown as CriticAttribution;

  const platform = candidate.source_platform || 'youtube';
  const reviewUrl = criticVideoReviewUrl(
    candidate.video_id,
    candidate.quote_start_seconds,
    platform,
    candidate.video_url,
  );

  const review = {
    film_id: candidate.film_id,
    // Attribution comes from the canonical critics row, so an approved video
    // review also appears on that critic's own /critics/:slug page.
    critic_id: critic.id,
    critic_name: critic.name || 'Film critic',
    critic_title: critic.title || null,
    publication: critic.publication || null,
    social_handle: critic.handle || null,
    avatar_url: critic.avatar_url || null,
    quote: candidate.quote,
    excerpt_context: candidate.excerpt_context,
    rating: candidate.rating,
    review_type: 'video',
    review_url: reviewUrl,
    updated_at: new Date().toISOString(),
  };

  let reviewId = candidate.critic_review_id;
  if (reviewId) {
    const { error } = await supabase.from('critic_reviews').update(review).eq('id', reviewId);
    if (error) throw new Error(`Cannot update critic review: ${error.message}`);
  } else {
    const { data: inserted, error } = await supabase
      .from('critic_reviews')
      .insert(review)
      .select('id')
      .single();
    if (error) throw new Error(`Cannot publish critic review: ${error.message}`);
    reviewId = inserted.id;
  }

  const { error: markError } = await supabase
    .from('critic_review_candidates')
    .update({
      status: 'approved',
      critic_review_id: reviewId,
      reviewed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', candidateId);
  if (markError) throw new Error(`Cannot mark candidate approved: ${markError.message}`);

  return { criticReviewId: reviewId, reviewUrl };
}

export async function rejectCriticVideoCandidate(candidateId: string, reason?: string) {
  const { error } = await supabase
    .from('critic_review_candidates')
    .update({
      status: 'rejected',
      last_error: reason || null,
      reviewed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', candidateId);
  if (error) throw new Error(`Cannot reject candidate: ${error.message}`);
  return { status: 'rejected' as const };
}
