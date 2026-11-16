/**
 * CSV export of the Rewind 2026 cohort, for outreach and for profile cleanup.
 *
 * Usage:
 *   npx tsx scripts/rewind-export.ts                  # rendered actors only (outreach list)
 *   npx tsx scripts/rewind-export.ts --all            # every eligible actor, rendered or not
 *   npx tsx scripts/rewind-export.ts --out list.csv   # write to a file instead of stdout
 *
 * Sorted by total_views descending, so the names worth a personal message are
 * at the top.
 *
 * The --all form is the one to use before launch: it lists everybody who will
 * get a Rewind, with the fields that decide how good their card looks, so
 * thin profiles can be fixed while the data is still being updated.
 */
import fs from 'node:fs';
import { supabase } from './lib/db';

const SITE = 'https://muvidb.com';

const COLUMNS = [
  'slug', 'display_name', 'films_count', 'plays_count', 'total_views',
  'hours_on_screen', 'archetype', 'portrait_url', 'poster_urls',
  'top_film_title', 'top_costar_name', 'top_costar_films',
  'top_director_name', 'top_director_films', 'box_office_total',
  'lead_known_count', 'followers', 'video_url', 'rendered_at',
].join(',');

/** RFC 4180: quote everything, double any embedded quote. */
const cell = (v: unknown): string => {
  if (v === null || v === undefined) return '""';
  return `"${String(v).replace(/"/g, '""')}"`;
};

async function main() {
  const argv = process.argv.slice(2);
  const all = argv.includes('--all');
  const outIndex = argv.indexOf('--out');
  const outPath = outIndex === -1 ? null : argv[outIndex + 1];

  let query = supabase.from('rewind_2026').select(COLUMNS).eq('eligible', true);
  if (!all) query = query.not('video_url', 'is', null);
  query = query.order('total_views', { ascending: false }).order('slug', { ascending: true });

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as unknown as Record<string, any>[];

  const header = [
    'name', 'profile_url', 'rewind_url', 'gaps', 'films_2026', 'plays_2026',
    'total_views', 'hours_on_screen', 'archetype', 'has_portrait',
    'posters_in_video', 'top_film', 'top_costar', 'top_director',
    'box_office_ngn', 'billing_known', 'followers', 'rendered',
    'instagram',
  ];

  /**
   * What is thin about this actor's card, in one column.
   *
   * Eligibility already guarantees a portrait and 80% poster coverage, so the
   * useful signal is what the card has to HIDE: a missing billing_order makes
   * the lead/supporting pills vanish, a one-off director drops that row, and
   * no view count leaves the hero number at zero.
   */
  const gapsFor = (r: Record<string, any>): string => {
    const gaps: string[] = [];
    if (!r.portrait_url) gaps.push('no portrait');
    if (Number(r.total_views ?? 0) === 0) gaps.push('no view counts');
    if (Number(r.hours_on_screen ?? 0) === 0) gaps.push('no runtimes');
    if (Number(r.lead_known_count ?? 0) === 0) gaps.push('no billing order');
    if (!r.top_film_title) gaps.push('no top film');
    if (Number(r.top_costar_films ?? 0) < 2) gaps.push('no repeat co-star');
    if (Number(r.top_director_films ?? 0) < 2) gaps.push('no repeat director');
    return gaps.join('; ');
  };

  // We hold Instagram handles on people, not on the snapshot, so fetch them
  // for exactly these slugs rather than denormalising another column.
  const handles = new Map<string, string>();
  for (let i = 0; i < rows.length; i += 200) {
    const slugs = rows.slice(i, i + 200).map((r) => r.slug);
    const { data: people } = await supabase
      .from('people')
      .select('slug,instagram_url')
      .in('slug', slugs);
    for (const p of people ?? []) {
      if (p.instagram_url) handles.set(p.slug, p.instagram_url);
    }
  }

  const lines = [header.join(',')];
  for (const r of rows) {
    // poster_urls is capped at 14 for the burst, so its length is NOT the
    // actor's poster coverage — the 80% gate lives in build_rewind_2026().
    const posters = Array.isArray(r.poster_urls) ? r.poster_urls.length : 0;
    lines.push(
      [
        cell(r.display_name),
        cell(`${SITE}/people/${r.slug}`),
        cell(`${SITE}/rewind/2026/${r.slug}`),
        cell(gapsFor(r)),
        cell(r.films_count),
        cell(r.plays_count),
        cell(r.total_views),
        cell(r.hours_on_screen),
        cell(r.archetype),
        cell(r.portrait_url ? 'yes' : 'NO'),
        cell(posters),
        cell(r.top_film_title),
        cell(r.top_costar_films >= 2 ? `${r.top_costar_name} (${r.top_costar_films})` : ''),
        cell(r.top_director_films >= 2 ? `${r.top_director_name} (${r.top_director_films})` : ''),
        cell(r.box_office_total ?? ''),
        cell(r.lead_known_count > 0 ? r.lead_known_count : 'NONE'),
        cell(r.followers),
        cell(r.rendered_at ? 'yes' : 'no'),
        cell(handles.get(r.slug) ?? ''),
      ].join(',')
    );
  }

  const csv = lines.join('\n') + '\n';
  if (outPath) {
    fs.writeFileSync(outPath, csv, 'utf8');
    console.log(`${rows.length} actor(s) -> ${outPath}`);
  } else {
    process.stdout.write(csv);
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.stack : e);
  process.exit(1);
});
