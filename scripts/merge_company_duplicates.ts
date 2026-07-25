/**
 * Auto-merge companies whose names are identical after normalization
 * (case / spacing / punctuation): "Larry Gee Films" ×2, "Ola-Oye Ventures" vs
 * "Ola Oye Ventures", "EMIRROR FILMS" vs "Emirror Films".
 *
 * Only EXACT-normalized matches — no fuzzy/edit-distance — so this can run
 * mechanically. Survivor = most films (real count from film_companies), then
 * has tmdb_id, then has a logo, then oldest.
 *
 *   npx tsx scripts/merge_company_duplicates.ts
 *   npx tsx scripts/merge_company_duplicates.ts --apply
 */
import { supabase } from './lib/db';

const APPLY = process.argv.includes('--apply');

// Same normalization idea as person_name_key, minus the honorific stripping
// (a studio really can be "The X Company"). Order preserved; only case/spacing/
// punctuation collapsed.
const norm = (s: string) =>
  String(s || '')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\b(ltd|limited|inc|nig)\b/g, ' ') // trailing incorporation noise
    .replace(/\s+/g, ' ')
    .trim();

async function main() {
  let all: any[] = []; let from = 0;
  for (;;) {
    const { data, error } = await supabase
      .from('companies')
      .select('id,name,tmdb_id,logo_url,created_at')
      .order('id')
      .range(from, from + 999);
    if (error) throw new Error(error.message);
    if (!data?.length) break;
    all.push(...data); if (data.length < 1000) break; from += 1000;
  }

  // Real film counts from the join table.
  const filmCount = new Map<string, number>();
  from = 0;
  for (;;) {
    const { data, error } = await supabase.from('film_companies').select('company_id').range(from, from + 999);
    if (error) throw new Error(error.message);
    if (!data?.length) break;
    for (const r of data as any[]) filmCount.set(r.company_id, (filmCount.get(r.company_id) || 0) + 1);
    if (data.length < 1000) break; from += 1000;
  }
  const nFilms = (c: any) => filmCount.get(c.id) || 0;
  console.log(`companies: ${all.length}`);

  const byKey = new Map<string, any[]>();
  for (const c of all) {
    const k = norm(c.name);
    if (!k) continue;
    (byKey.get(k) || byKey.set(k, []).get(k)!).push(c);
  }

  const plans: any[] = [];
  for (const [, members] of byKey) {
    if (members.length < 2) continue;
    const sorted = [...members].sort((a, b) =>
      nFilms(b) - nFilms(a)
      || (b.tmdb_id ? 1 : 0) - (a.tmdb_id ? 1 : 0)
      || (b.logo_url ? 1 : 0) - (a.logo_url ? 1 : 0)
      || String(a.created_at).localeCompare(String(b.created_at)));
    plans.push({ survivor: sorted[0], dups: sorted.slice(1) });
  }
  const absorbed = plans.reduce((n, p) => n + p.dups.length, 0);
  console.log(`\nduplicate company groups: ${plans.length}   companies absorbed: ${absorbed}`);
  console.log('\nsamples:');
  for (const p of plans.slice(0, 25))
    console.log(`  KEEP ${JSON.stringify(p.survivor.name)} (${nFilms(p.survivor)} films)  ←  ${p.dups.map((d: any) => `${JSON.stringify(d.name)} (${nFilms(d)})`).join('  ')}`);

  if (!APPLY) { console.log('\nDRY RUN — pass --apply to merge.'); return; }
  let ok = 0, fail = 0;
  for (let i = 0; i < plans.length; i++) {
    const { survivor, dups } = plans[i];
    const { error } = await supabase.rpc('merge_companies_group', {
      p_master_id: survivor.id, p_duplicate_ids: dups.map((d: any) => d.id), p_metadata: {},
    });
    if (error) { fail++; console.warn(`  ❌ ${survivor.name}: ${String(error.message).slice(0, 90)}`); } else ok++;
  }
  console.log(`\nDone. ok=${ok} fail=${fail} absorbed≈${absorbed}`);
}
main().catch((e) => { console.error(e); process.exit(1); });
