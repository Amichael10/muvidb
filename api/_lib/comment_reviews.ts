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
import { pctLiked, shrinkCommentScore } from './rating.js';

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

// Keep it short-but-real: a 20-char floor lets in terse criticism ("acting was
// wooden", "the story dragged") that the old 60-char floor silently dropped —
// exactly the commentary we WANT in the denominator, not just gushing praise.
const isNoise = (t: string) => t.length < 20 || NOISE.some((re) => re.test(t.trim()));

// Rating math (shrink-to-average + the 0-10 -> % liked curve) lives in
// ./rating.ts so the comment pipeline and the TMDB mapping stay in lockstep.
// Every kept opinion counts EQUALLY — we deliberately do NOT weight by likes.
// Likes over-represent the crowd-pleasing (usually positive) comments and bury
// dissent, which is precisely what inflated the old scores. Plain mean ->
// shrinkCommentScore (0-10) -> pctLiked (0-100).
function ratingFrom(rows: { score: number }[]): { pct: number; s10: number } {
  const mean = rows.length ? rows.reduce((a, r) => a + r.score, 0) / rows.length : 0;
  const s10 = shrinkCommentScore(mean, rows.length);
  return { pct: pctLiked(s10), s10: Math.round(s10 * 10) / 10 };
}

const mapComment = (it: any): RawComment => {
  const s = it.snippet.topLevelComment.snippet;
  return {
    id: it.snippet.topLevelComment.id,
    text: stripHtml(s.textDisplay ?? s.textOriginal ?? ''),
    author: s.authorDisplayName ?? 'YouTube viewer',
    avatar: s.authorProfileImageUrl ?? null,
    likes: Number(s.likeCount ?? 0),
    publishedAt: s.publishedAt,
  };
};

// Pull BOTH the most-relevant AND the newest comments. Relevance alone is a
// popularity ranking that surfaces upbeat, heavily-liked comments; adding the
// newest ones brings in unfiltered voices (including criticism) so the sample
// reflects the good AND the bad — the point of dropping likes-based selection.
async function fetchComments(videoId: string, max = 120): Promise<RawComment[]> {
  const byId = new Map<string, RawComment>();
  for (const order of ['relevance', 'time'] as const) {
    try {
      const data = await ytGet('commentThreads', { part: 'snippet', videoId, order, maxResults: '100', textFormat: 'plainText' });
      for (const it of data.items ?? []) { const c = mapComment(it); if (!byId.has(c.id)) byId.set(c.id, c); }
    } catch (e) {
      // If the first pass fails (quota/comments-off) there's nothing to salvage;
      // if the second fails, keep what the first returned.
      if (order === 'relevance') throw e;
    }
  }
  return [...byId.values()].slice(0, max);
}

// Ask the AI to keep only genuine film opinions and score each 1-10.
async function classify(comments: RawComment[]): Promise<Map<number, number>> {
  const numbered = comments.map((c, i) => `${i}. ${c.text.replace(/\n/g, ' ').slice(0, 400)}`).join('\n');
  const prompt = `You are curating viewer comments on a Nollywood/African movie to (a) show a few as short audience reviews and (b) gauge how the film was ACTUALLY received.

KEEP (keep=true) any comment that gives a genuine opinion or reaction about the FILM ITSELF — its story, acting, characters, pacing, ending, message, production, or emotional impact. This INCLUDES criticism, disappointment and mixed takes ("the story dragged", "the acting was wooden", "great plot but terrible sound"). We specifically WANT these — do NOT keep only praise.
REJECT (keep=false): greetings, "first"/"who's watching", requests for where to watch, tagging or shout-outs to people, self-promotion or channel plugs, pure emoji, spam, and anything not about this film.

For each kept comment, score 1-10 = how positively that viewer truly regards the film. Be strict and use the WHOLE range — most films are ordinary:
  9-10 = genuinely exceptional, specific, strong praise
  7-8  = clearly liked it
  5-6  = mixed / lukewarm / "it was okay" — THIS IS THE DEFAULT for generic positivity like "nice movie", "wow", "🔥"
  3-4  = disappointed / notable criticism
  1-2  = disliked / hated it
People who bother to comment are mostly fans, so treat vague hype as mild (5-6), not a 10.

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
  rating?: number | null;        // de-inflated 0-10 (kept for continuity)
  likedPercent?: number | null;  // unified 0-100 "% liked"
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

  // 2. cheap pre-filter → candidates. NO likes ranking: we keep the natural
  //    relevance+newest order so criticism isn't sorted out of the sample.
  const seen = new Set<string>();
  const candidates = raw
    .filter((c) => !isNoise(c.text) && !seen.has(c.text) && seen.add(c.text))
    .slice(0, 50);
  if (!candidates.length) return { status: 'skipped', reason: 'no-quality-candidates' };

  // 3. AI classify + score (AI down → skip, try again next sync)
  let scores: Map<number, number>;
  try {
    scores = await classify(candidates);
  } catch (e: any) {
    return { status: 'skipped', reason: `ai:${e.message.slice(0, 60)}` };
  }
  // EVERY classified opinion (praise AND criticism) feeds the rating — that
  // honest denominator is the core of the de-inflation.
  const opinions = candidates
    .map((c, i) => ({ c, score: scores.get(i) }))
    .filter((x): x is { c: RawComment; score: number } => x.score !== undefined);
  if (!opinions.length) return { status: 'skipped', reason: 'nothing-kept' };
  const { pct, s10 } = ratingFrom(opinions.map(({ score }) => ({ score })));

  // Display set: a representative spread, not a highlight reel. Order by score
  // and force-include a few critical takes so the shown reviews span good→bad.
  const byScore = [...opinions].sort((a, b) => b.score - a.score);
  const critical = byScore.filter((o) => o.score <= 4).slice(0, 3);
  const kept = [...new Set([...critical, ...byScore])].slice(0, maxKeep);

  // dry run: prove the pipeline without touching the DB.
  if (opts.dryRun) {
    return {
      status: 'ok',
      kept: opinions.length,
      rating: s10,
      likedPercent: pct,
      samples: kept.map(({ c, score }) => ({ author: c.author, likes: c.likes, score, text: c.text.slice(0, 140) })),
    };
  }

  // 4. store the display comments as external reviews (dedup on film+external_id)
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

  // 5. persist the unified rating. liked_percent (0-100) is what the site shows;
  //    audience_rating keeps the de-inflated 0-10 for continuity. Computed from
  //    ALL opinions classified this run, criticism included.
  const { error: filmErr } = await supabase
    .from('films')
    .update({
      liked_percent: pct,
      audience_rating: s10,
      audience_rating_count: opinions.length,
      comments_synced_at: new Date().toISOString(),
    })
    .eq('id', filmId);
  if (filmErr) console.warn(`[mine] film rating update failed for ${filmId}: ${filmErr.message}`);

  return { status: 'ok', kept: kept.length, rating: s10, likedPercent: pct };
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
  const minComments = opts.minComments ?? Number(process.env.COMMENT_MINE_MINCOMMENTS || 20);
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
