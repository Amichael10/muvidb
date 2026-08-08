/**
 * Merge near-empty STUB people into the rich record they're obviously a variant of.
 *
 * The fuzzy queue is full of pairs like:
 *    Kenneth Nwadike  45 credits, 5/7, photo, DOB
 *    Keneth  Nwadike   1 credit,  1/7, nothing          <- same man, missing an 'n'
 *    Emeka Odika      25 credits, 3/7, photo
 *    Emeka Odi / Emeka Od   1 & 4 credits, 1/7          <- truncations
 *
 * merge_ocr_variants refuses these because BOTH names are "clean" strings (a
 * dropped letter isn't OCR garbage). But the asymmetry is decisive: a
 * near-identical name attached to an empty stub is the same person, and if it
 * ever isn't, the cost is one orphan credit moving — versus thousands of manual
 * reviews. So we merge the stub into the rich record.
 *
 * Guards: the RICH side must be substantially richer, the stub must be genuinely
 * empty (few credits, no photo/tmdb, unclaimed, unverified), and the names must
 * either be >=0.88 similar or a clean prefix truncation.
 *
 *   npx tsx scripts/merge_stub_into_rich.ts
 *   npx tsx scripts/merge_stub_into_rich.ts --apply
 */
import { supabase } from './lib/db';
import { scanPeopleDuplicates } from '../src/lib/deduplicator.js';

const APPLY = process.argv.includes('--apply');
const MIN_SIM = 0.88;          // whole-name similarity floor
const STUB_MAX_CREDITS = 2;    // "empty" side
const RICH_MIN_CREDITS = 8;    // the keeper must be clearly established
const RICH_MULTIPLE = 5;       // ...and clearly richer than the stub

const fold = (s: string) =>
  String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]/g, '');

function sim(a: string, b: string): number {
  if (a === b) return 1; const m = a.length, n = b.length; if (!m || !n) return 0;
  const d: number[] = Array(n + 1); for (let j = 0; j <= n; j++) d[j] = j;
  for (let i = 1; i <= m; i++) { let prev = d[0]; d[0] = i;
    for (let j = 1; j <= n; j++) { const t = d[j]; d[j] = Math.min(d[j] + 1, d[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1)); prev = t; } }
  return 1 - d[n] / Math.max(m, n);
}

/** Same person? Either very close spelling, or the stub is a truncation. */
function nameMatches(rich: string, stub: string): boolean {
  const R = fold(rich), S = fold(stub);
  if (!R || !S) return false;
  if (S.length >= 5 && R.startsWith(S)) return true; // "emekaod" -> "emekaodika"
  return sim(R, S) >= MIN_SIM;
}

const completeness = (p: any) =>
  ['bio', 'photo_url', 'date_of_birth', 'nationality', 'tmdb_id', 'slug', 'gender']
    .reduce((n, k) => n + (p?.[k] ? 1 : 0), 0);

async function main() {
  let all: any[] = []; let from = 0;
  for (;;) {
    const { data, error } = await supabase.from('people').select('*').order('id').range(from, from + 999);
    if (error) throw new Error(error.message);
    if (!data?.length) break; all.push(...data); if (data.length < 1000) break; from += 1000;
  }
  // REAL credit counts — people.film_count is stale and cannot be trusted.
  const credits = new Map<string, number>();
  from = 0;
  for (;;) {
    const { data, error } = await supabase.from('credits').select('person_id').range(from, from + 999);
    if (error) throw new Error(error.message);
    if (!data?.length) break;
    for (const c of data as any[]) credits.set(c.person_id, (credits.get(c.person_id) || 0) + 1);
    if (data.length < 1000) break; from += 1000;
  }
  const nCredits = (p: any) => credits.get(p.id) || 0;
  console.log(`people ${all.length}, credit rows counted for ${credits.size} people`);

  const report: any = scanPeopleDuplicates(all);
  const byId = new Map(all.map((p) => [p.id, p]));
  const plans: any[] = [];

  for (const g of report.groups) {
    if (g.confidence === 'blocked') continue;
    const members = (g.records || []).map((r: any) => byId.get(r.id)).filter(Boolean);
    if (members.length < 2) continue;
    const sorted = [...members].sort((a, b) => nCredits(b) - nCredits(a) || completeness(b) - completeness(a));
    const rich = sorted[0];
    const richC = nCredits(rich);
    if (richC < RICH_MIN_CREDITS) continue;                       // no established keeper

    const stubs = sorted.slice(1).filter((m: any) => {
      const c = nCredits(m);
      if (c > STUB_MAX_CREDITS) return false;                     // not a stub
      if (richC < c * RICH_MULTIPLE) return false;                // not decisively richer
      // "Empty" = no REAL data. slug and nationality are auto-populated on every
      // record (the OCR upsert hardcodes nationality='Nigerian'), so counting
      // them made every stub look complete and rejected everything.
      if (m.photo_url || m.bio || m.date_of_birth || m.tmdb_id || m.mubi_id) return false;
      if (m.claimed_by || m.is_verified) return false;
      return nameMatches(rich.name, m.name);
    });
    if (stubs.length) plans.push({ rich, stubs, richC });
  }

  const absorbed = plans.reduce((n, p) => n + p.stubs.length, 0);
  console.log(`\nmergeable: ${plans.length} groups, absorbing ${absorbed} stub records`);
  console.log('\nsamples:');
  for (const p of plans.slice(0, 15))
    console.log(`  KEEP ${JSON.stringify(p.rich.name)} (${p.richC} credits, ${completeness(p.rich)}/7)\n       ← ${p.stubs.map((s: any) => `${JSON.stringify(s.name)} (${credits.get(s.id) || 0}cr)`).join('  ')}`);

  if (!APPLY) { console.log('\nDRY RUN — pass --apply to merge.'); return; }
  let ok = 0, fail = 0;
  for (let i = 0; i < plans.length; i++) {
    const p = plans[i];
    const dupIds = p.stubs.map((s: any) => s.id);
    const { error } = await supabase.rpc('merge_people_group', {
      p_master_id: p.rich.id, p_duplicate_ids: dupIds, p_metadata: {},
    });
    if (error) { fail++; console.warn(`  ❌ ${p.rich.name}: ${String(error.message).slice(0, 80)}`); } else ok++;
    if ((i + 1) % 25 === 0 || i === plans.length - 1) console.log(`  ${i + 1}/${plans.length} (ok=${ok} fail=${fail})`);
  }
  console.log(`\nDone. ok=${ok} fail=${fail} absorbed≈${absorbed}`);
}
main().catch((e) => { console.error(e); process.exit(1); });
