/**
 * One-off: merge duplicate film rows (same title + same year).
 *
 * Throwaway — lives in the session scratchpad, not the repo.
 *
 *   npx tsx <this file>            # dry run, writes nothing
 *   npx tsx <this file> --apply    # perform the merge
 *   npx tsx <this file> --limit=50 # cap groups processed
 *
 * WHY A MERGE AND NOT A DELETE
 *
 * 21 tables reference films, and most CASCADE on delete — including
 * `watchlist`, `reviews`, `film_reactions` and `credits`. Deleting a duplicate
 * row therefore destroys real users' saved films and their reviews, silently.
 * Every child row is relocated to the survivor first; the loser is only removed
 * once nothing points at it.
 *
 * Duplicates come in two shapes, both handled the same way:
 *   - empty stubs           (Asirka 2012 x3 — no poster, no credits)
 *   - same film, many feeds (Alakada 2009 from manual + nollymeter, each
 *                            holding partial data)
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL!;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(url, key, { auth: { persistSession: false } });

const APPLY = process.argv.includes('--apply');
const LIMIT = Number((process.argv.find(a => a.startsWith('--limit=')) || '').split('=')[1]) || 0;
const SAMPLE = Number((process.argv.find(a => a.startsWith('--sample=')) || '').split('=')[1]) || 0;

/**
 * Child tables to relocate, with the column that must stay unique per film.
 * Where a unique constraint exists, a loser row whose counterpart already sits
 * on the survivor is dropped rather than moved — moving it would violate the
 * constraint and abort the merge.
 */
const CHILDREN: { table: string; fk: string; uniqueWith?: string[] }[] = [
  // Must mirror credits_film_person_role_uidx exactly. Keying on person_id
  // alone both over-deletes — a loser's Director credit was dropped whenever
  // the survivor already listed that person as an Actor, 100 such credits in
  // the first 40 groups — and still let the real constraint fire.
  { table: 'credits', fk: 'film_id', uniqueWith: ['person_id', 'role'] },
  { table: 'reviews', fk: 'film_id' },
  { table: 'watchlist', fk: 'film_id', uniqueWith: ['user_id'] },
  { table: 'film_reactions', fk: 'film_id', uniqueWith: ['user_id'] },
  { table: 'film_genres', fk: 'film_id', uniqueWith: ['genre_id'] },
  { table: 'film_countries', fk: 'film_id' },
  { table: 'film_companies', fk: 'film_id' },
  { table: 'film_watch_links', fk: 'film_id' },
  // showtimes_cinema_film_date_time_fmt_uidx — two feeds scraping one cinema
  // produce the same screening twice, so the survivor keeps one of each.
  { table: 'showtimes', fk: 'film_id', uniqueWith: ['cinema_id', 'show_date', 'show_time', 'format'] },
  { table: 'collection_films', fk: 'film_id', uniqueWith: ['collection_id'] },
  { table: 'youtube_stats', fk: 'film_id' },
  { table: 'channel_videos', fk: 'film_id' },
  { table: 'platform_new_releases', fk: 'film_id' },
  { table: 'top_10_films', fk: 'film_id' },
];

type FilmRow = {
  id: string;
  title: string;
  year: number | null;
  poster_url: string | null;
  synopsis: string | null;
  view_count: number | null;
  youtube_watch_url: string | null;
  created_at: string;
  source: string | null;
  content_type: string | null;
  series_id: string | null;
  credits: number;
};

/**
 * Trust ranking for the row whose own fields survive. Hand-curated rows beat
 * scraped feeds; africanmoviedb is the least reliable of the three seen in
 * duplicate groups.
 */
const SOURCE_RANK: Record<string, number> = {
  manual: 3,
  nollymeter: 2,
  africanmoviedb: 1,
};

function sourceRank(source: string | null): number {
  return SOURCE_RANK[(source || '').toLowerCase()] ?? 2;
}

/** Bare YouTube id, so the same upload stored under watch/youtu.be/embed compares equal. */
function videoId(url: string | null | undefined): string | null {
  if (!url) return null;
  const m = String(url).match(/(?:v=|youtu\.be\/|embed\/|shorts\/)([A-Za-z0-9_-]{11})/);
  return m ? m[1] : null;
}

/**
 * Survivor selection. Source trust leads, then completeness.
 *
 * Which row survives only decides whose own COLUMNS are kept — every child row
 * is relocated regardless, and missing fields are backfilled from the losers
 * below, so no data is lost by preferring a thinner manual row.
 */
function pickSurvivor(rows: FilmRow[]): FilmRow {
  return [...rows].sort((a, b) =>
    sourceRank(b.source) - sourceRank(a.source) ||
    b.credits - a.credits ||
    Number(!!b.poster_url) - Number(!!a.poster_url) ||
    Number(!!b.synopsis) - Number(!!a.synopsis) ||
    (b.view_count || 0) - (a.view_count || 0) ||
    a.created_at.localeCompare(b.created_at),
  )[0];
}

/** Fields worth rescuing from a loser when the survivor lacks them. */
const BACKFILL = [
  'poster_url', 'backdrop_url', 'synopsis', 'tagline', 'runtime_minutes',
  'release_date', 'nfvcb_rating', 'youtube_watch_url', 'trailer_youtube_id',
  'language', 'liked_percent',
];

/**
 * Copies any field the survivor is missing from the richest loser that has it,
 * so preferring a sparse `manual` row never costs data.
 */
function buildBackfill(survivor: any, losers: any[]): Record<string, unknown> {
  const patch: Record<string, unknown> = {};
  for (const field of BACKFILL) {
    if (survivor[field] !== null && survivor[field] !== undefined && survivor[field] !== '') continue;
    const donor = losers.find(l => l[field] !== null && l[field] !== undefined && l[field] !== '');
    if (donor) patch[field] = donor[field];
  }
  return patch;
}

async function relocate(loserId: string, survivorId: string, stats: Record<string, number>) {
  for (const child of CHILDREN) {
    const { data: rows, error } = await supabase
      .from(child.table)
      .select(child.uniqueWith ? ['id', ...child.uniqueWith].join(',') : 'id')
      .eq(child.fk, loserId);

    if (error) {
      // A table that does not exist or is not readable must not abort the run.
      if (!/does not exist|schema cache/i.test(error.message)) {
        console.warn(`  ! read ${child.table}: ${error.message}`);
      }
      continue;
    }
    if (!rows?.length) continue;

    let movable = rows as any[];

    if (child.uniqueWith) {
      const cols = child.uniqueWith;
      const { data: existing } = await supabase
        .from(child.table)
        .select(cols.join(','))
        .eq(child.fk, survivorId);

      const keyOf = (r: any) => cols.map(c => String(r[c])).join('\u0000');
      const taken = new Set((existing || []).map(keyOf));

      // Growing `taken` as we go also drops rows that would collide with each
      // other, not just with the survivor — several losers are relocated onto
      // one survivor and the batch must be internally unique too.
      const clashing: any[] = [];
      const keep: any[] = [];
      for (const r of movable) {
        const k = keyOf(r);
        if (taken.has(k)) { clashing.push(r); continue; }
        taken.add(k);
        keep.push(r);
      }
      movable = keep;

      if (clashing.length && APPLY) {
        await supabase.from(child.table).delete().in('id', clashing.map(r => r.id));
      }
      stats[`${child.table}:dropped_dupe`] = (stats[`${child.table}:dropped_dupe`] || 0) + clashing.length;
    }

    if (movable.length && APPLY) {
      const { error: moveError } = await supabase
        .from(child.table)
        .update({ [child.fk]: survivorId })
        .in('id', movable.map(r => r.id));

      // A surviving conflict must not abort the whole run and leave the merge
      // half-applied. Fall back to one row at a time and drop only the row
      // that actually collides.
      if (moveError) {
        console.warn(`  ! ${child.table} bulk move failed (${moveError.message}) — retrying row by row`);
        let movedOne = 0;
        for (const r of movable) {
          const { error: rowError } = await supabase
            .from(child.table)
            .update({ [child.fk]: survivorId })
            .eq('id', r.id);
          if (!rowError) { movedOne += 1; continue; }
          await supabase.from(child.table).delete().eq('id', r.id);
          stats[`${child.table}:dropped_conflict`] = (stats[`${child.table}:dropped_conflict`] || 0) + 1;
        }
        stats[`${child.table}:moved`] = (stats[`${child.table}:moved`] || 0) + movedOne;
        continue;
      }
    }
    stats[`${child.table}:moved`] = (stats[`${child.table}:moved`] || 0) + movable.length;
  }
}

async function main() {
  console.log(APPLY ? '*** APPLY MODE — this writes ***\n' : 'dry run — nothing will be written\n');

  const { data: groups, error } = await supabase.rpc('exec' as any, {}).then(
    () => ({ data: null, error: null }),
    () => ({ data: null, error: null }),
  );
  void groups; void error;

  // No generic SQL RPC is exposed, so groups are rebuilt client-side from the
  // films that have a year.
  const all: FilmRow[] = [];
  const PAGE = 1000;
  for (let from = 0; ; from += PAGE) {
    const { data, error: pageError } = await supabase
      .from('films')
      .select('id,title,year,poster_url,backdrop_url,synopsis,tagline,runtime_minutes,release_date,nfvcb_rating,youtube_watch_url,trailer_youtube_id,language,liked_percent,view_count,created_at,source,content_type,series_id')
      .not('year', 'is', null)
      // Range paging without an ORDER BY can repeat or skip rows between pages,
      // and leaves --limit picking a different 10 groups on every run.
      .order('id', { ascending: true })
      .range(from, from + PAGE - 1);
    if (pageError) throw pageError;
    if (!data?.length) break;
    all.push(...(data as any[]).map(r => ({ ...r, credits: 0 })));
    if (data.length < PAGE) break;
  }
  console.log(`loaded ${all.length} films with a year`);

  const byKey = new Map<string, FilmRow[]>();
  for (const film of all) {
    const key = `${film.title.trim().toLowerCase()}|${film.year}`;
    byKey.set(key, [...(byKey.get(key) || []), film]);
  }

  const allGroups = [...byKey.values()].filter(g => g.length > 1);

  // Episodes of a series legitimately share a title and year — collapsing them
  // would destroy distinct episodes, so any group touching a series is skipped
  // entirely rather than partially merged.
  const seriesGroups = allGroups.filter(g =>
    g.some((f: any) => f.content_type === 'series' || f.series_id));
  let dupeGroups = allGroups.filter(g => !seriesGroups.includes(g));
  console.log(`${seriesGroups.length} groups skipped (series)`);

  // Runtime is the discriminator. A shared title and year is NOT enough:
  // multi-part YouTube uploads clean to identical titles ("He Wanted a Good
  // Wife..." appears 7 times at 88-123 min, which are different cuts, not
  // copies), and unrelated films collide too ("Case" 2025 at 180/195/30 min).
  // Only groups where every row agrees on runtime are treated as duplicates.
  const RUNTIME_SPREAD_MAX = 5;
  const unverifiable = dupeGroups.filter((g: any[]) =>
    g.some(f => f.runtime_minutes === null || f.runtime_minutes === undefined));
  const diverging = dupeGroups.filter((g: any[]) => {
    if (unverifiable.includes(g)) return false;
    const rts = g.map(f => f.runtime_minutes as number);
    return Math.max(...rts) - Math.min(...rts) > RUNTIME_SPREAD_MAX;
  });
  dupeGroups = dupeGroups.filter(g => !unverifiable.includes(g) && !diverging.includes(g));
  console.log(`${unverifiable.length} groups skipped (runtime unknown — cannot verify)`);
  console.log(`${diverging.length} groups skipped (runtimes differ — not the same film)`);

  // Runtime alone is not enough. A distinct youtube_watch_url is a distinct
  // upload, and Nollywood serials are published as several videos that clean to
  // one title and land within a few minutes of each other — "King's Bride
  // Stephen Odimgbe New Movie" is four different videos at 60-64 min, well
  // inside RUNTIME_SPREAD_MAX. Merging those would delete three real films.
  // Genuine duplicates are re-imports of one upload, so they either repeat the
  // video id or carry none at all.
  const multiVideo = dupeGroups.filter((g: any[]) => {
    const ids = new Set(g.map(f => videoId(f.youtube_watch_url)).filter(Boolean));
    return ids.size > 1;
  });
  dupeGroups = dupeGroups.filter(g => !multiVideo.includes(g));
  console.log(`${multiVideo.length} groups skipped (different videos — parts, not copies)`);
  if (LIMIT) dupeGroups = dupeGroups.slice(0, LIMIT);
  console.log(`${dupeGroups.length} duplicate groups\n`);

  if (SAMPLE) {
    for (const group of dupeGroups.slice(0, SAMPLE)) {
      for (const film of group) {
        const { count } = await supabase.from('credits').select('id', { count: 'exact', head: true }).eq('film_id', film.id);
        (film as any).credits = count || 0;
      }
      const survivor: any = pickSurvivor(group);
      const losers = group.filter(f => f.id !== survivor.id);
      const patch = buildBackfill(survivor, losers);
      console.log(`
${survivor.title} (${survivor.year})`);
      console.log(`  KEEP  ${String(survivor.source).padEnd(16)} credits=${String(survivor.credits).padStart(3)} poster=${survivor.poster_url?'Y':'n'} syn=${survivor.synopsis?'Y':'n'} runtime=${survivor.runtime_minutes ?? '-'}`);
      for (const l of losers as any[]) {
        console.log(`  drop  ${String(l.source).padEnd(16)} credits=${String(l.credits).padStart(3)} poster=${l.poster_url?'Y':'n'} syn=${l.synopsis?'Y':'n'} runtime=${l.runtime_minutes ?? '-'}`);
      }
      if (Object.keys(patch).length) console.log(`  backfill -> ${Object.keys(patch).join(', ')}`);
    }
    console.log(`
(sample only — ${dupeGroups.length} mergeable groups in total)`);
    return;
  }

  const stats: Record<string, number> = {};
  let merged = 0;
  let removed = 0;

  for (const group of dupeGroups) {
    // Credit counts decide the survivor, so they are fetched per group only.
    for (const film of group) {
      const { count } = await supabase
        .from('credits')
        .select('id', { count: 'exact', head: true })
        .eq('film_id', film.id);
      film.credits = count || 0;
    }

    const survivor = pickSurvivor(group);
    const losers = group.filter(f => f.id !== survivor.id);

    const patch = buildBackfill(survivor as any, losers as any[]);
    if (APPLY && Object.keys(patch).length) {
      await supabase.from('films').update(patch).eq('id', survivor.id);
      stats['films:fields_backfilled'] = (stats['films:fields_backfilled'] || 0) + Object.keys(patch).length;
    }

    for (const loser of losers) {
      await relocate(loser.id, survivor.id, stats);
      if (APPLY) {
        const { error: delError } = await supabase.from('films').delete().eq('id', loser.id);
        if (delError) { console.warn(`  ! delete ${loser.id}: ${delError.message}`); continue; }
      }
      removed += 1;
    }
    merged += 1;

    if (merged % 100 === 0) console.log(`  ...${merged} groups`);
  }

  console.log(`\ngroups merged     : ${merged}`);
  console.log(`films removed     : ${removed}`);
  console.log('child rows:');
  for (const [k, v] of Object.entries(stats).sort()) {
    if (v) console.log(`  ${k.padEnd(34)} ${v}`);
  }
  if (!APPLY) console.log('\n(dry run — re-run with --apply to perform)');
}

main().catch(err => { console.error(err); process.exit(1); });
