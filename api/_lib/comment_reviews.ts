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
import { pctLiked, shrinkCommentScore, MIN_RATING_SAMPLE } from './rating.js';

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
  /\bgather here\b/i, // "fans of X gather here" roll-calls
  /^\s*@[\w.-]+/, // starts by tagging someone
  /\b(who|anyone|anybody)\s+(is|are|dey|de)\s+watch/i,
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
async function fetchComments(videoId: string, max = 400): Promise<RawComment[]> {
  const byId = new Map<string, RawComment>();
  for (const order of ['relevance', 'time'] as const) {
    // Only ~1 comment in 12 is an actual assessment, so a 100-comment sample
    // yields single digits. Pages are 1 quota unit each — far cheaper than the
    // AI call they feed — so cast a wider net and let rankCandidates pick.
    let pageToken: string | undefined;
    for (let page = 0; page < 2 && byId.size < max; page++) {
      try {
        const data = await ytGet('commentThreads', {
          part: 'snippet', videoId, order, maxResults: '100', textFormat: 'plainText',
          ...(pageToken ? { pageToken } : {}),
        });
        for (const it of data.items ?? []) { const c = mapComment(it); if (!byId.has(c.id)) byId.set(c.id, c); }
        pageToken = data.nextPageToken;
        if (!pageToken) break;
      } catch (e) {
        // If the very first page fails (quota/comments-off) there's nothing to
        // salvage; later failures keep whatever we already have.
        if (order === 'relevance' && page === 0) throw e;
        break;
      }
    }
  }
  return [...byId.values()].slice(0, max);
}

// Concrete things a viewer judges. Used only to decide WHICH comments are worth
// paying the classifier for — deliberately aspect words, never sentiment words,
// so this doesn't tilt the sample toward praise or toward criticism.
const ASPECT_WORDS =
  /\b(movie|film|story|storyline|plot|script|acting|acted|actor|actress|cast|character|role|scene|ending|end|part|directing|director|production|picture|sound|subtitle|edit|pace|slow|length|lesson|message|performance)\b/i;

/**
 * Rank the noise-filtered pool so the classifier's 50 slots go to the comments
 * most likely to contain a verdict: ones that name something about the film,
 * longest first. Everything else keeps its natural order behind them.
 */
function rankCandidates(pool: RawComment[]): RawComment[] {
  const scored = pool.map((c, i) => ({
    c,
    i,
    tier: ASPECT_WORDS.test(c.text) ? 0 : 1,
  }));
  scored.sort((a, b) => a.tier - b.tier || b.c.text.length - a.c.text.length || a.i - b.i);
  return scored.map((s) => s.c);
}

interface Verdict {
  score: number;
  /** Gives a reason or concrete detail, rather than a bare thumbs-up. */
  specific: boolean;
}

// Ceiling for an opinion with nothing behind it ("nice movie", "wow"). The
// rubric already tells the model to score these 5-6 and it routinely returns 7+
// anyway, so the cap is enforced here rather than requested in the prompt.
const VAGUE_SCORE_CAP = 6;

// Ask the AI to keep only genuine film opinions and score each 1-10.
async function classify(comments: RawComment[]): Promise<Map<number, Verdict>> {
  const numbered = comments.map((c, i) => `${i}. ${c.text.replace(/\n/g, ' ').slice(0, 400)}`).join('\n');
  const prompt = `You are curating viewer comments on a Nollywood/African movie to (a) show a few as short audience reviews and (b) gauge how the film was ACTUALLY received.

KEEP (keep=true) ONLY comments that ASSESS the film or a performance — that judge it good, bad, moving, boring, well-acted, badly written, worth watching. Criticism, disappointment and mixed takes count and we specifically WANT them ("the story dragged", "the acting was wooden", "great plot but terrible sound"). Plain verdicts count too ("nice movie", "this was a waste of time").

REJECT (keep=false) everything else, including things that mention the film but assess nothing:
  - reactions to a character's antics or a catchphrase, with no judgement: "I like as oloye dey do", "see as this man dey behave 😂", "omoo as i see oloye for dis movie"
  - exclamations and running commentary in Pidgin/Yoruba/Igbo that carry no verdict: "kosi wahala 😂", "wahala waa ooo", "chai!", "na so e be"
  - ANTICIPATION rather than assessment — excitement about the cast, trailer or premise instead of what the film turned out to be: "since I see [actor] in the cast I know this will be interesting", "can't wait to watch this". The viewer must be judging what they SAW, not what they expect.
  - roll-calls and fan check-ins: "fans of X gather here", "who else is watching", "2026 anybody?"
  - tagging people, shout-outs, greetings, prayers, self-promotion, channel plugs
  - questions about where to watch, part 2, or the cast list
  - pure emoji or laughter, spam, anything not about this film
A comment being sincere or enthusiastic is NOT enough — if it does not say something IS good or bad, reject it.

For each kept comment also return specific=true if it gives a reason, an example, or names what worked/failed (acting, story, pacing, ending, sound, message). specific=false for a bare verdict with nothing behind it.

Score 1-10 = how positively that viewer truly regards the film. Be strict and use the WHOLE range — most films are ordinary:
  9-10 = genuinely exceptional, specific, strong praise
  7-8  = clearly liked it, and says why
  5-6  = mixed / lukewarm / "it was okay" — THIS IS THE DEFAULT for generic positivity like "nice movie", "wow", "🔥"
  3-4  = disappointed / notable criticism
  1-2  = disliked / hated it
People who bother to comment are mostly fans, so treat vague hype as mild (5-6), not a 10.

Return ONLY a JSON array, no prose: [{"i":<number>,"keep":<true|false>,"specific":<true|false>,"score":<1-10>}]

Comments:
${numbered}`;

  const { text } = await generateAIContent(prompt);
  const parsed = parseJSON(text);
  // A short response means the model stopped early rather than judging every
  // comment — that silently shrinks the sample and biases it toward whatever
  // sat at the top of the list, so it must not pass unnoticed.
  if (Array.isArray(parsed) && parsed.length < comments.length) {
    console.warn(`[mine] classifier returned ${parsed.length}/${comments.length} verdicts`);
  }
  const verdicts = new Map<number, Verdict>();
  if (Array.isArray(parsed)) {
    for (const row of parsed) {
      const i = Number(row?.i);
      if (Number.isInteger(i) && row?.keep === true) {
        const specific = row?.specific === true;
        const raw = Math.max(1, Math.min(10, Number(row.score) || 5));
        verdicts.set(i, { score: specific ? raw : Math.min(raw, VAGUE_SCORE_CAP), specific });
      }
    }
  }
  return verdicts;
}

export interface MineResult {
  status: 'ok' | 'skipped';
  reason?: string;
  screened?: number;             // candidates sent to the classifier
  kept?: number;
  rated?: boolean;               // false = mined, but under MIN_RATING_SAMPLE
  rating?: number | null;        // de-inflated 0-10 (kept for continuity)
  likedPercent?: number | null;  // unified 0-100 "% liked"
  samples?: { author: string; likes: number; score: number; specific: boolean; text: string }[];
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
  const pool = raw.filter((c) => !isNoise(c.text) && !seen.has(c.text) && seen.add(c.text));
  const candidates = rankCandidates(pool).slice(0, 50);
  if (!candidates.length) return { status: 'skipped', reason: 'no-quality-candidates' };

  // 3. AI classify + score (AI down → skip, try again next sync)
  let verdicts: Map<number, Verdict>;
  try {
    verdicts = await classify(candidates);
  } catch (e: any) {
    return { status: 'skipped', reason: `ai:${e.message.slice(0, 60)}` };
  }
  // EVERY classified opinion (praise AND criticism) feeds the rating — that
  // honest denominator is the core of the de-inflation.
  const opinions = candidates
    .map((c, i) => ({ c, ...(verdicts.get(i) ?? {}) }))
    .filter((x): x is { c: RawComment } & Verdict => typeof (x as Verdict).score === 'number');
  if (!opinions.length) return { status: 'skipped', reason: 'nothing-kept' };
  const rated = opinions.length >= MIN_RATING_SAMPLE;
  const { pct, s10 } = ratingFrom(opinions.map(({ score }) => ({ score })));

  // Display set: a representative spread, not a highlight reel. Comments that
  // say WHY come first, then force-include a few critical takes so the shown
  // reviews span good→bad.
  const byScore = [...opinions].sort(
    (a, b) => Number(b.specific) - Number(a.specific) || b.score - a.score,
  );
  const critical = byScore.filter((o) => o.score <= 4).slice(0, 3);
  const kept = [...new Set([...critical, ...byScore])].slice(0, maxKeep);

  // dry run: prove the pipeline without touching the DB.
  if (opts.dryRun) {
    return {
      status: 'ok',
      screened: candidates.length,
      kept: opinions.length,
      rated,
      rating: rated ? s10 : null,
      likedPercent: rated ? pct : null,
      samples: kept.map(({ c, score, specific }) => ({ author: c.author, likes: c.likes, score, specific, text: c.text.slice(0, 140) })),
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

  // Drop mined reviews this pass did NOT keep. Without this, comments a looser
  // earlier run accepted stay on the page forever — a re-mine only ever adds.
  // Scoped to source='youtube', so member-written reviews are never touched.
  const { error: pruneErr } = await supabase
    .from('reviews')
    .delete()
    .eq('film_id', filmId)
    .eq('source', 'youtube')
    .not('external_id', 'in', `(${kept.map(({ c }) => c.id).join(',')})`);
  if (pruneErr) console.warn(`[mine] prune failed for ${filmId}: ${pruneErr.message}`);

  // 5. persist the unified rating. liked_percent (0-100) is what the site shows;
  //    audience_rating keeps the de-inflated 0-10 for continuity. Computed from
  //    ALL opinions classified this run, criticism included.
  //
  //    Under MIN_RATING_SAMPLE we publish NOTHING and clear any rating a looser
  //    earlier run left behind — a handful of comments is not a measurement, and
  //    the film page has a "Be the first to rate" state for exactly this.
  const { error: filmErr } = await supabase
    .from('films')
    .update({
      liked_percent: rated ? pct : null,
      audience_rating: rated ? s10 : null,
      audience_rating_count: opinions.length,
      comments_synced_at: new Date().toISOString(),
    })
    .eq('id', filmId);
  if (filmErr) console.warn(`[mine] film rating update failed for ${filmId}: ${filmErr.message}`);

  return { status: 'ok', screened: candidates.length, kept: kept.length, rated, rating: rated ? s10 : null, likedPercent: rated ? pct : null };
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
