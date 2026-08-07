/**
 * One-off: restore the part number to serial episodes that cleaned down to a
 * single shared title.
 *
 * Throwaway — lives in the session scratchpad, not the repo.
 *
 *   npx tsx <this file>          # dry run, writes nothing
 *   npx tsx <this file> --apply  # rewrite the titles
 *
 * Only touches groups where EVERY row's raw upload title declares its own
 * distinct number, so the numbering is read off the source rather than guessed.
 * Groups with partial markers, or with byte-identical raw titles, are left for
 * a human — inventing an order there would be fiction.
 */
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL!;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(url, key, { auth: { persistSession: false } });

const APPLY = process.argv.includes('--apply');

function videoId(u: string | null | undefined): string | null {
  if (!u) return null;
  const m = String(u).match(/(?:v=|youtu\.be\/|embed\/|shorts\/)([A-Za-z0-9_-]{11})/);
  return m ? m[1] : null;
}

/** Marker kind decides the word we write back, so "EPS 6" reads as "Episode 6". */
const MARKER = /\b(EPISODE|EPS|EP\.|EP|PART|PT|VOLUME|VOL)\.?\s*(\d+)/i;
const WORD_NUMBERS: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5,
  six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
};
const WORD_MARKER = /\b(part|episode)\s+(one|two|three|four|five|six|seven|eight|nine|ten)\b/i;

function parseMarker(raw: string): { label: string; n: number } | null {
  const m = raw.match(MARKER);
  if (m) {
    const kind = m[1].toUpperCase().replace('.', '');
    const label = kind.startsWith('EP') ? 'Episode' : kind.startsWith('P') ? 'Part' : 'Volume';
    return { label, n: parseInt(m[2], 10) };
  }
  const w = raw.match(WORD_MARKER);
  if (w) {
    const n = WORD_NUMBERS[w[2].toLowerCase()];
    if (n) return { label: w[1].toLowerCase() === 'episode' ? 'Episode' : 'Part', n };
  }
  return null;
}

const all: any[] = [];
const PAGE = 1000;
for (let from = 0; ; from += PAGE) {
  const { data, error } = await supabase
    .from('films')
    .select('id,title,year,runtime_minutes,content_type,series_id,youtube_watch_url')
    .not('year', 'is', null)
    .order('id', { ascending: true })
    .range(from, from + PAGE - 1);
  if (error) throw error;
  if (!data?.length) break;
  all.push(...data);
  if (data.length < PAGE) break;
}
console.log(APPLY ? '*** APPLY MODE — this writes ***\n' : 'dry run — nothing will be written\n');
console.log(`loaded ${all.length} films with a year`);

/** Every title in use, so a rewrite can never collide with an existing film. */
const takenTitles = new Set(all.map(f => `${f.title.trim().toLowerCase()}|${f.year}`));

const byKey = new Map<string, any[]>();
for (const f of all) {
  byKey.set(`${f.title.trim().toLowerCase()}|${f.year}`, [...(byKey.get(`${f.title.trim().toLowerCase()}|${f.year}`) || []), f]);
}

const groups = [...byKey.values()].filter(g => g.length > 1)
  .filter(g => !g.some(f => f.content_type === 'series' || f.series_id))
  .filter(g => {
    const rts = g.map(f => f.runtime_minutes).filter(r => r !== null && r !== undefined);
    if (rts.length !== g.length) return false;
    return Math.max(...rts) - Math.min(...rts) <= 5;
  })
  .filter(g => new Set(g.map(f => videoId(f.youtube_watch_url)).filter(Boolean)).size > 1);

const filmIds = groups.flat().map(f => f.id);
const rawByFilm = new Map<string, { title: string; channel: string }>();
for (let i = 0; i < filmIds.length; i += 300) {
  const { data } = await supabase
    .from('channel_videos')
    .select('film_id,title,channel_id')
    .in('film_id', filmIds.slice(i, i + 300));
  for (const r of data || []) if (r.film_id) rawByFilm.set(r.film_id, { title: r.title, channel: r.channel_id });
}

let renamed = 0, skippedCollision = 0, groupsDone = 0;

for (const g of groups) {
  const raws = g.map(f => ({ film: f, raw: rawByFilm.get(f.id) })).filter(r => r.raw);
  if (raws.length !== g.length) continue;
  if (new Set(raws.map(r => r.raw!.channel)).size !== 1) continue;

  const marked = raws.map(r => ({ ...r, mark: parseMarker(r.raw!.title) }));
  if (marked.some(m => !m.mark)) continue;
  if (new Set(marked.map(m => m.mark!.n)).size !== marked.length) continue;

  groupsDone += 1;
  const base = g[0].title.trim();
  console.log(`\n${base} (${g[0].year})`);

  for (const m of marked.sort((a, b) => a.mark!.n - b.mark!.n)) {
    const label = `${m.mark!.label} ${m.mark!.n}`;
    // Leave the title alone if it already carries this exact marker.
    if (new RegExp(`\\b${m.mark!.label}\\s*${m.mark!.n}\\b`, 'i').test(base)) {
      console.log(`  = ${base}  (already numbered)`);
      continue;
    }
    const next = `${base} ${label}`;
    const key = `${next.trim().toLowerCase()}|${m.film.year}`;
    if (takenTitles.has(key)) {
      console.log(`  ! ${next}  — title already exists, skipped`);
      skippedCollision += 1;
      continue;
    }
    takenTitles.add(key);
    console.log(`  -> ${next}`);
    if (APPLY) {
      const { error } = await supabase.from('films').update({ title: next }).eq('id', m.film.id);
      if (error) { console.log(`     ! update failed: ${error.message}`); continue; }
    }
    renamed += 1;
  }
}

console.log(`\ngroups renumbered : ${groupsDone}`);
console.log(`films retitled    : ${renamed}`);
if (skippedCollision) console.log(`skipped (collision): ${skippedCollision}`);
if (!APPLY) console.log('\n(dry run — re-run with --apply to perform)');
