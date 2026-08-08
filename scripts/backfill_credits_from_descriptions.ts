/**
 * Backfill cast/crew credits for existing YouTube films from their OFFICIAL
 * YouTube description — no video downloading, no scraping.
 *
 * Replaces the OCR enricher's job for the common case: most Nollywood uploads
 * list the cast in the title/description, which the YouTube Data API serves
 * legitimately. We reuse the exact extraction + credit-writing code the channel
 * sync already runs on NEW films (`enrichFilmsFromAI` + `attachCreditsBatch`);
 * this script just applies it to films that are ALREADY in the database.
 *
 * Quota: videos.list costs 1 unit per call and takes 50 ids, so ~1000 films is
 * ~20 units of the 10,000/day budget. The AI calls are chunked 20 films each.
 *
 * DRY RUN by default — prints what it would write. Set BACKFILL_APPLY=1 to save.
 *
 *   npx tsx scripts/backfill_credits_from_descriptions.ts          # preview
 *   BACKFILL_APPLY=1 npx tsx scripts/backfill_credits_from_descriptions.ts
 *
 * Env:
 *   CREDITS_THRESHOLD  only enrich films with FEWER than this many credits (default 5)
 *   BACKFILL_LIMIT     cap how many films to process this run (default: all)
 *   BACKFILL_APPLY     "1" to actually write credits (default: dry run)
 */
import * as dns from 'dns';
dns.setDefaultResultOrder('ipv4first');
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config();

// Imported dynamically AFTER dotenv: api/_lib/supabase.ts reads process.env at
// module-evaluation time, and static imports would hoist above the config call.
const { supabase } = await import('../api/_lib/supabase.js');
const { ytGet } = await import('../api/_lib/yt_service.js');
const { enrichFilmsFromAI, attachCreditsBatch } = await import('../api/_lib/film_enrichment.js');

const THRESHOLD = Number(process.env.CREDITS_THRESHOLD || '5');
const LIMIT = Number(process.env.BACKFILL_LIMIT || '0'); // 0 = no cap
const APPLY = process.env.BACKFILL_APPLY === '1';

const YT_BATCH = 50; // videos.list accepts up to 50 ids per call
const PAGE = 1000;   // supabase default row cap

/** Pull the 11-char video id out of any YouTube URL shape we store. */
function videoIdFrom(url: string): string | null {
  if (!url) return null;
  const m =
    url.match(/[?&]v=([\w-]{11})/) ||
    url.match(/youtu\.be\/([\w-]{11})/) ||
    url.match(/\/(?:embed|shorts|live)\/([\w-]{11})/);
  return m ? m[1] : null;
}

/** Films that are YouTube-sourced, have a watch URL, and are under-credited. */
async function fetchUnderCreditedFilms() {
  const out: { id: string; title: string; url: string; credits_count: number }[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from('films')
      .select('id,title,youtube_watch_url,credits(id)')
      .eq('source', 'youtube')
      .not('youtube_watch_url', 'is', null)
      .order('created_at', { ascending: false })
      .range(from, from + PAGE - 1);

    if (error) throw new Error(`films query failed: ${error.message}`);
    if (!data?.length) break;

    for (const f of data as any[]) {
      const count = f.credits?.length ?? 0;
      if (count < THRESHOLD && f.youtube_watch_url) {
        out.push({ id: f.id, title: f.title, url: f.youtube_watch_url, credits_count: count });
      }
    }
    if (data.length < PAGE) break;
  }
  return out;
}

/** videoId -> {title, description} straight from the official API. */
async function fetchSnippets(ids: string[]) {
  const snippets = new Map<string, { title: string; description: string }>();
  for (let i = 0; i < ids.length; i += YT_BATCH) {
    const batch = ids.slice(i, i + YT_BATCH);
    try {
      const res = await ytGet('videos', { part: 'snippet', id: batch.join(',') });
      for (const item of res.items || []) {
        snippets.set(item.id, {
          title: item.snippet?.title || '',
          description: item.snippet?.description || '',
        });
      }
      console.log(`  [yt] fetched ${snippets.size}/${ids.length} descriptions...`);
    } catch (e: any) {
      console.warn(`  ⚠️ videos.list failed for batch ${i / YT_BATCH + 1}: ${e.message}`);
    }
  }
  return snippets;
}

async function main() {
  console.log(`\n🎬 Credit backfill from YouTube descriptions`);
  console.log(`   Mode: ${APPLY ? '🔴 APPLY (will write credits)' : '🟢 DRY RUN (no writes)'}`);
  console.log(`   Target: films with fewer than ${THRESHOLD} credits\n`);

  const films = await fetchUnderCreditedFilms();
  console.log(`[1/4] Found ${films.length} under-credited YouTube films.`);

  const queue = LIMIT > 0 ? films.slice(0, LIMIT) : films;
  if (LIMIT > 0) console.log(`      Capped to ${queue.length} for this run (BACKFILL_LIMIT).`);
  if (!queue.length) return console.log('✅ Nothing to do.');

  // Map video id -> film. Films whose URL has no parseable id are skipped.
  const filmByVideo = new Map<string, (typeof queue)[number]>();
  let unparseable = 0;
  for (const f of queue) {
    const vid = videoIdFrom(f.url);
    if (vid) filmByVideo.set(vid, f);
    else unparseable++;
  }
  if (unparseable) console.log(`      ⚠️ ${unparseable} films had an unparseable YouTube URL — skipped.`);

  console.log(`\n[2/4] Fetching descriptions via the official YouTube Data API...`);
  const snippets = await fetchSnippets([...filmByVideo.keys()]);
  const missing = filmByVideo.size - snippets.size;
  if (missing > 0) console.log(`      ℹ️ ${missing} videos returned nothing (deleted/private) — skipped.`);
  if (!snippets.size) return console.log('❌ No descriptions retrieved. Check YOUTUBE_API_KEY.');

  console.log(`\n[3/4] Extracting cast/director with AI (chunks of 20)...`);
  const aiMap = await enrichFilmsFromAI(
    [...snippets.entries()].map(([videoId, s]) => ({
      videoId,
      title: s.title,
      description: s.description,
    })),
  );
  console.log(`      AI returned metadata for ${aiMap.size} films.`);

  // Shape credits exactly like the channel sync does (roles: actor / director).
  const entries: { filmId: string; people: { name: string; role: string }[] }[] = [];
  for (const [videoId, ai] of aiMap) {
    const film = filmByVideo.get(videoId);
    if (!film) continue;
    const people = [
      ...(ai.cast || []).map((name) => ({ name, role: 'actor' })),
      ...(ai.director ? [{ name: ai.director, role: 'director' }] : []),
    ];
    if (people.length) entries.push({ filmId: film.id, people });
  }

  const totalPeople = entries.reduce((n, e) => n + e.people.length, 0);
  console.log(`\n[4/4] ${entries.length} films have extractable credits (${totalPeople} names).\n`);

  if (!APPLY) {
    for (const e of entries.slice(0, 25)) {
      const film = queue.find((f) => f.id === e.filmId);
      console.log(`  • ${film?.title ?? e.filmId}  (has ${film?.credits_count ?? '?'})`);
      console.log(`      ${e.people.map((p) => `${p.name} [${p.role}]`).join(', ')}`);
    }
    if (entries.length > 25) console.log(`  ... and ${entries.length - 25} more films.`);
    console.log(`\n🟢 DRY RUN — nothing written. Re-run with BACKFILL_APPLY=1 to save.`);
    return;
  }

  const added = await attachCreditsBatch(entries);
  console.log(`✅ Wrote ${added} new credits (duplicates and existing credits skipped).`);
}

main().catch((e) => {
  console.error(`❌ ${e.message}`);
  process.exit(1);
});
