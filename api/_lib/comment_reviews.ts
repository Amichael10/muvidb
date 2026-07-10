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

// Turn a likes-weighted sentiment mean into the stored rating.
//
// Bayesian shrinkage first: a handful of glowing comments must NOT yield a 9.7
// — 3 happy commenters aren't evidence a film is near-perfect. We blend the
// film's own mean with a global prior, weighted by how many comments backed it,
// so low-sample ratings pull toward the average and only genuine volume earns an
// extreme score. Then a hard cap so nothing ever reads as a fake 9.8/9.9/10.
const MAX_AUDIENCE_RATING = 9.7;
const PRIOR_MEAN = 8.0;    // global average audience rating (comments skew positive)
const PRIOR_WEIGHT = 10;   // the prior is worth ~10 comments of evidence
function scoreRating(weightedMean: number, count: number): number {
  const n = Math.max(0, count);
  const adjusted = (n * weightedMean + PRIOR_WEIGHT * PRIOR_MEAN) / (n + PRIOR_WEIGHT);
  return Math.min(MAX_AUDIENCE_RATING, Math.round(adjusted * 10) / 10);
}

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
      rating: d ? scoreRating(n / d, kept.length) : null,
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
    rating = den ? scoreRating(num / den, allYt.length) : null;
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

  // Retry any selection on a transient failure — statement timeout (57014) or a
  // network blip ("fetch failed" / socket hang up) — so one hiccup doesn't
  // abort the whole run.
  const withRetry = async <T>(
    run: () => Promise<{ data: T | null; error: any }>,
    label: string,
    attempt = 0,
  ): Promise<T | null> => {
    try {
      const { data, error } = await run();
      if (error) throw error;
      return data;
    } catch (e: any) {
      if (attempt < 4) {
        await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)));
        return withRetry(run, label, attempt + 1);
      }
      console.error(`[comment-mining] ${label} failed after retries: ${e.code || ''} ${e.message}`);
      return null;
    }
  };

  const COLS = 'id, source_video_id, comments_synced_at';
  // Needs a (re)check: never mined, or mined > 21 days ago.
  const needsMining = (q: any) =>
    q.not('source_video_id', 'is', null)
      .or(`comments_synced_at.is.null,comments_synced_at.lt.${staleBefore}`);

  // 1. Mine the films the site actually surfaces FIRST (Top 10 / trending /
  //    featured). Newest-first alone buries ratings on obscure fresh uploads
  //    that have no comments yet and that nobody browses.
  const priorityFilms: any[] = [];
  const top10 = await withRetry<any[]>(
    () => supabase.from('top_10_films').select('film_id'),
    'top-10 lookup',
  );
  const top10Ids = [...new Set((top10 || []).map((t: any) => t.film_id).filter(Boolean))];
  if (top10Ids.length) {
    const rows = await withRetry<any[]>(
      () => needsMining(supabase.from('films').select(COLS)).in('id', top10Ids).limit(50),
      'top-10 films',
    );
    if (rows) priorityFilms.push(...rows);
  }
  const flagged = await withRetry<any[]>(
    () =>
      needsMining(supabase.from('films').select(COLS))
        .or('is_trending.eq.true,is_featured.eq.true')
        .limit(Math.min(scan, 200)),
    'trending/featured films',
  );
  if (flagged) priorityFilms.push(...flagged);

  // 2. Then the most-watched unmined films (view_count is backfilled below as
  //    we go, so this gets better every run). These are what users browse.
  const popular = await withRetry<any[]>(
    () =>
      needsMining(supabase.from('films').select(COLS))
        .gt('view_count', 0)
        .order('view_count', { ascending: false })
        .limit(scan),
    'popular films',
  );

  // 3. Fill the remaining budget with the most recently added films.
  const recent = await withRetry<any[]>(
    () =>
      needsMining(supabase.from('films').select(COLS))
        .order('created_at', { ascending: false })
        .limit(scan),
    'recent films',
  );

  // Priority, then popular, then recent; dedupe and cap at the scan budget.
  const byId = new Map<string, any>();
  for (const f of [...priorityFilms, ...(popular || []), ...(recent || [])]) {
    if (f?.id && !byId.has(f.id)) byId.set(f.id, f);
  }
  const films = [...byId.values()].slice(0, scan);
  if (!films.length) return { checked: 0, mined: 0, skipped: 0, message: 'nothing to mine' };

  let mined = 0, skipped = 0, aiUsed = 0;
  const nowIso = new Date().toISOString();

  // Process in chunks of 50 so we can batch the cheap stats lookup (1 quota
  // unit per 50 films) — it gives us BOTH the comment count and the view count.
  let viewsBackfilled = 0;
  for (let i = 0; i < films.length; i += 50) {
    const chunk = films.slice(i, i + 50);
    const counts = new Map<string, number>();
    const views = new Map<string, number>();
    try {
      const stats: any = await ytGet('videos', { part: 'statistics', id: chunk.map((f) => f.source_video_id).join(',') });
      for (const v of stats.items ?? []) {
        counts.set(v.id, Number(v.statistics?.commentCount ?? 0));
        views.set(v.id, Number(v.statistics?.viewCount ?? 0));
      }
    } catch (e: any) {
      if (/quota|unusable/i.test(e.message)) { console.warn('[comment-mining] YouTube quota exhausted, stopping.'); break; }
      continue; // transient stats error — try next chunk
    }

    // Spend the AI budget on the most-watched comment-rich films first — those
    // are the ones users actually browse.
    const ordered = [...chunk].sort(
      (a, b) => (views.get(b.source_video_id) ?? 0) - (views.get(a.source_video_id) ?? 0),
    );

    for (const f of ordered) {
      const c = counts.get(f.source_video_id) ?? 0;
      const v = views.get(f.source_video_id);
      // Backfill the real YouTube view count while we're here — it's free, and
      // the rest of the app (rails, ranking) has been flying blind without it.
      const patch: Record<string, unknown> = { comments_synced_at: nowIso };
      if (typeof v === 'number' && v > 0) { patch.view_count = v; viewsBackfilled++; }

      if (c >= minComments && aiUsed < aiCap) {
        aiUsed++;
        const res = await mineFilmComments(f.id, f.source_video_id);
        if (res.status === 'ok') {
          mined++;
          // mineFilmComments already stamped comments_synced_at + rating; just
          // persist the view count.
          if (patch.view_count) await supabase.from('films').update({ view_count: patch.view_count }).eq('id', f.id);
          continue;
        }
        if (res.reason === 'quota') { console.warn('[comment-mining] quota hit during mine, stopping.'); return { checked: i, mined, skipped, aiUsed, viewsBackfilled }; }
      }
      // Checked but nothing to mine (or AI cap reached): stamp so we don't
      // recheck every run, but it'll be revisited after the 21-day window.
      skipped++;
      await supabase.from('films').update(patch).eq('id', f.id);
    }
  }

  return { checked: films.length, mined, skipped, aiUsed, viewsBackfilled };
}
