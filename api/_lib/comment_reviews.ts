/**
 * Mine a YouTube video's comments into review-quality entries + an audience
 * rating, for a film we already have.
 *
 * Pipeline:  fetch comments → cheap pre-filter → AI classify+score → store as
 * reviews (source='youtube') → likes-weighted audience_rating on the film.
 *
 * Everything is best-effort: if the video has comments disabled, the YouTube
 * quota is exhausted, or the AI is unavailable, we skip cleanly and leave the
 * film untouched (the daily sync just tries again next time).
 */
import { supabase } from './supabase.js';
import { ytGet } from './yt_service.js';
import { generateAIContent, parseJSON } from './ai_service.js';

interface RawComment {
  id: string;
  text: string;
  author: string;
  avatar: string | null;
  likes: number;
  publishedAt: string;
}

// Obvious junk we can drop for free, before spending an AI call.
const NOISE = [
  /^\s*(first|1st|early|who('|)?s watching|who is (here|watching)|anybody \d{4}|am i early)/i,
  /^\s*\d{1,2}:\d{2}/, // starts with a timestamp
  /^[\s\p{Emoji}\p{Emoji_Presentation}❤🔥😂🙏👍💯✨🥰😍]+$/u, // only emoji/symbols
];
const stripHtml = (html: string) =>
  html
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const isNoise = (t: string) => t.length < 60 || NOISE.some((re) => re.test(t.trim()));

/** More liked = more representative of the crowd (dampened, so one viral
 *  comment can't dominate). weight(0 likes)=1, weight(2000)≈4.3. */
const likeWeight = (likes: number) => 1 + Math.log10(1 + Math.max(0, likes));

// Never let a film show a near-perfect score — it reads as fake. Hard-cap the
// audience rating so nothing ever reaches 9.8/9.9/10.
const MAX_AUDIENCE_RATING = 9.7;
const capRating = (r: number) => Math.min(MAX_AUDIENCE_RATING, Math.round(r * 10) / 10);

async function fetchComments(videoId: string, max = 60): Promise<RawComment[]> {
  const data = await ytGet('commentThreads', {
    part: 'snippet',
    videoId,
    order: 'relevance',
    maxResults: '100',
    textFormat: 'plainText',
  });
  return (data.items ?? []).slice(0, max).map((it: any) => {
    const s = it.snippet.topLevelComment.snippet;
    return {
      id: it.snippet.topLevelComment.id,
      text: stripHtml(s.textDisplay ?? s.textOriginal ?? ''),
      author: s.authorDisplayName ?? 'YouTube viewer',
      avatar: s.authorProfileImageUrl ?? null,
      likes: Number(s.likeCount ?? 0),
      publishedAt: s.publishedAt,
    };
  });
}

// Ask the AI to keep only genuine film opinions and score each 1-10.
async function classify(comments: RawComment[]): Promise<Map<number, number>> {
  const numbered = comments.map((c, i) => `${i}. ${c.text.replace(/\n/g, ' ').slice(0, 400)}`).join('\n');
  const prompt = `You are curating viewer comments on a Nollywood/African movie to show as short audience reviews.
For each numbered comment decide keep=true ONLY if it is a genuine reaction or opinion about the FILM itself — its story, acting, characters, message, production, or emotional impact.
Reject (keep=false): greetings, "first", "who's watching", requests for where to watch, tagging/mentioning people, self-promotion or channel plugs, pure emoji, spam, and anything not about this film.
For kept comments also give score = how positively the viewer regards the film, 1-10 (10 = loved it, 5 = mixed, 1 = hated it).
Return ONLY a JSON array, no prose: [{"i":<number>,"keep":<true|false>,"score":<1-10>}]

Comments:
${numbered}`;

  const { text } = await generateAIContent(prompt);
  const parsed = parseJSON(text);
  const scores = new Map<number, number>();
  if (Array.isArray(parsed)) {
    for (const row of parsed) {
      const i = Number(row?.i);
      if (Number.isInteger(i) && row?.keep === true) {
        const s = Math.max(1, Math.min(10, Number(row.score) || 5));
        scores.set(i, s);
      }
    }
  }
  return scores;
}

export interface MineResult {
  status: 'ok' | 'skipped';
  reason?: string;
  kept?: number;
  rating?: number | null;
  samples?: { author: string; likes: number; score: number; text: string }[];
}

export async function mineFilmComments(
  filmId: string,
  videoId: string,
  opts: { maxKeep?: number; dryRun?: boolean } = {}
): Promise<MineResult> {
  const maxKeep = opts.maxKeep ?? 8;

  // 1. fetch (quota/comments-off/errors → skip)
  let raw: RawComment[];
  try {
    raw = await fetchComments(videoId);
  } catch (e: any) {
    return { status: 'skipped', reason: /quota|unusable/i.test(e.message) ? 'quota' : `fetch:${e.message.slice(0, 60)}` };
  }
  if (!raw.length) return { status: 'skipped', reason: 'no-comments' };

  // 2. cheap pre-filter → best-liked candidates
  const seen = new Set<string>();
  const candidates = raw
    .filter((c) => !isNoise(c.text) && !seen.has(c.text) && seen.add(c.text))
    .sort((a, b) => b.likes - a.likes)
    .slice(0, 30);
  if (!candidates.length) return { status: 'skipped', reason: 'no-quality-candidates' };

  // 3. AI classify + score (AI down → skip, try again next sync)
  let scores: Map<number, number>;
  try {
    scores = await classify(candidates);
  } catch (e: any) {
    return { status: 'skipped', reason: `ai:${e.message.slice(0, 60)}` };
  }
  const kept = candidates
    .map((c, i) => ({ c, score: scores.get(i) }))
    .filter((x): x is { c: RawComment; score: number } => x.score !== undefined)
    .sort((a, b) => b.c.likes - a.c.likes)
    .slice(0, maxKeep);
  if (!kept.length) return { status: 'skipped', reason: 'nothing-kept' };

  // dry run: prove the pipeline without touching the DB (weighted rating from
  // this batch only).
  if (opts.dryRun) {
    let n = 0, d = 0;
    for (const { c, score } of kept) { const w = likeWeight(c.likes); n += score * w; d += w; }
    return {
      status: 'ok',
      kept: kept.length,
      rating: d ? capRating(n / d) : null,
      samples: kept.map(({ c, score }) => ({ author: c.author, likes: c.likes, score, text: c.text.slice(0, 140) })),
    };
  }

  // 4. store the kept comments as external reviews (dedup on film+external_id)
  const rows = kept.map(({ c, score }) => ({
    film_id: filmId,
    user_id: null,
    source: 'youtube',
    external_id: c.id,
    author_name: c.author,
    author_avatar_url: c.avatar,
    source_url: `https://www.youtube.com/watch?v=${videoId}&lc=${c.id}`,
    body: c.text.slice(0, 2000),
    rating: score,
    sentiment_score: score,
    likes: c.likes,
  }));
  const { error: upErr } = await supabase
    .from('reviews')
    .upsert(rows, { onConflict: 'film_id,external_id', ignoreDuplicates: false });
  if (upErr) return { status: 'skipped', reason: `store:${upErr.message.slice(0, 60)}` };

  // 5. likes-weighted audience rating from ALL youtube reviews on this film
  const { data: allYt } = await supabase
    .from('reviews')
    .select('sentiment_score, likes')
    .eq('film_id', filmId)
    .eq('source', 'youtube');
  let rating: number | null = null;
  if (allYt && allYt.length) {
    let num = 0, den = 0;
    for (const r of allYt) {
      const w = likeWeight(Number(r.likes) || 0);
      num += (Number(r.sentiment_score) || 0) * w;
      den += w;
    }
    rating = den ? capRating(num / den) : null;
  }
  const { error: filmErr } = await supabase
    .from('films')
    .update({
      audience_rating: rating,
      audience_rating_count: allYt?.length ?? kept.length,
      comments_synced_at: new Date().toISOString(),
    })
    .eq('id', filmId);
  if (filmErr) console.warn(`[mine] film rating update failed for ${filmId}: ${filmErr.message}`);

  return { status: 'ok', kept: kept.length, rating };
}

/**
 * Daily pass: mine comments for films that have accumulated engagement but
 * haven't been mined recently. Fresh uploads have no comments yet, so we don't
 * mine at creation — we sweep here, prioritising films the site actually shows.
 *
 * Quota-aware: batch-checks comment counts first (cheap) and only spends an AI
 * call on films that actually have comments. Stamps comments_synced_at on every
 * film it checks so 0-comment films get retried later (once they've grown) but
 * not every run.
 */
export async function runCommentMining(opts: { scan?: number; aiCap?: number; minComments?: number } = {}) {
  const scan = opts.scan ?? Number(process.env.COMMENT_MINE_SCAN || 300);
  const aiCap = opts.aiCap ?? Number(process.env.COMMENT_MINE_AICAP || 150);
  const minComments = opts.minComments ?? 20;
  const staleBefore = new Date(Date.now() - 21 * 86400_000).toISOString();

  // Films needing a (re)check: never mined, or mined > 21 days ago. Recent
  // first — those are the ones surfaced on the site. Retry on a statement
  // timeout (57014) so a transient slow query doesn't abort the whole run.
  const selectFilms = async (attempt = 0): Promise<any[] | null> => {
    const { data, error } = await supabase
      .from('films')
      .select('id, source_video_id, comments_synced_at')
      .not('source_video_id', 'is', null)
      .or(`comments_synced_at.is.null,comments_synced_at.lt.${staleBefore}`)
      .order('created_at', { ascending: false })
      .limit(scan);
    if (error) {
      if (attempt < 3 && error.code === '57014') {
        await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
        return selectFilms(attempt + 1);
      }
      console.error(`[comment-mining] film selection failed: ${error.code} ${error.message}`);
      return null;
    }
    return data;
  };
  const films = await selectFilms();
  if (!films?.length) return { checked: 0, mined: 0, skipped: 0, message: 'nothing to mine' };

  let mined = 0, skipped = 0, aiUsed = 0;
  const nowIso = new Date().toISOString();

  // Process in chunks of 50 so we can batch the cheap comment-count lookup.
  for (let i = 0; i < films.length; i += 50) {
    const chunk = films.slice(i, i + 50);
    let counts = new Map<string, number>();
    try {
      const stats: any = await ytGet('videos', { part: 'statistics', id: chunk.map((f) => f.source_video_id).join(',') });
      counts = new Map((stats.items ?? []).map((v: any) => [v.id, Number(v.statistics?.commentCount ?? 0)]));
    } catch (e: any) {
      if (/quota|unusable/i.test(e.message)) { console.warn('[comment-mining] YouTube quota exhausted, stopping.'); break; }
      continue; // transient stats error — try next chunk
    }

    for (const f of chunk) {
      const c = counts.get(f.source_video_id) ?? 0;
      if (c >= minComments && aiUsed < aiCap) {
        aiUsed++;
        const res = await mineFilmComments(f.id, f.source_video_id);
        if (res.status === 'ok') { mined++; continue; }
        if (res.reason === 'quota') { console.warn('[comment-mining] quota hit during mine, stopping.'); return { checked: i, mined, skipped, aiUsed }; }
      }
      // checked but nothing to mine (or AI cap reached): stamp so we don't
      // recheck every run, but it'll be revisited after the 21-day window.
      skipped++;
      await supabase.from('films').update({ comments_synced_at: nowIso }).eq('id', f.id);
    }
  }

  return { checked: films.length, mined, skipped, aiUsed };
}
