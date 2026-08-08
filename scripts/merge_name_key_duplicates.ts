/**
 * Merge people that share a people.name_key.
 *
 * name_key is the order-insensitive, honorific-stripped token multiset
 * ("2:jide|kosoko"), so every row sharing one is the same person written
 * differently:
 *     "Jide Kosoko" / "Kosoko Jide" / "Prince Jide Kosoko" / "PRINCE JIDE KOSOKO"
 *
 * This is far stronger evidence than the fuzzy "Very similar spelling" bucket
 * (which mixes real duplicates with genuinely different people), so it can be
 * merged mechanically. Single-token names produce a NULL key and are excluded,
 * so "Davido" can never collapse into "David".
 *
 * Survivor = most films (film_count is now trigger-maintained and accurate),
 * then most complete, then oldest.
 *
 *   npx tsx scripts/merge_name_key_duplicates.ts
 *   npx tsx scripts/merge_name_key_duplicates.ts --apply
 */
import { supabase } from './lib/db';

const APPLY = process.argv.includes('--apply');

const completeness = (p: any) =>
  ['bio', 'photo_url', 'date_of_birth', 'nationality', 'tmdb_id', 'slug', 'gender']
    .reduce((n, k) => n + (p?.[k] ? 1 : 0), 0);

async function main() {
  let all: any[] = []; let from = 0;
  for (;;) {
    const { data, error } = await supabase
      .from('people')
      .select('id,name,name_key,film_count,bio,photo_url,date_of_birth,nationality,tmdb_id,slug,gender,is_verified,claimed_by,created_at')
      .not('name_key', 'is', null)
      .order('id')
      .range(from, from + 999);
    if (error) throw new Error(error.message);
    if (!data?.length) break;
    all.push(...data); if (data.length < 1000) break; from += 1000;
  }
  console.log(`people with a name_key: ${all.length}`);

  const byKey = new Map<string, any[]>();
  for (const p of all) {
    const k = p.name_key as string;
    (byKey.get(k) || byKey.set(k, []).get(k)!).push(p);
  }

  const plans: any[] = [];
  let skippedClaims = 0;
  for (const [, members] of byKey) {
    if (members.length < 2) continue;
    // Different owners must not be merged automatically.
    const claimants = new Set(members.map((m) => m.claimed_by).filter(Boolean));
    if (claimants.size > 1) { skippedClaims++; continue; }
    const sorted = [...members].sort((a, b) =>
      Number(b.film_count || 0) - Number(a.film_count || 0)
      || completeness(b) - completeness(a)
      || Number(Boolean(b.is_verified)) - Number(Boolean(a.is_verified))
      || String(a.created_at || '').localeCompare(String(b.created_at || '')));
    plans.push({ survivor: sorted[0], dups: sorted.slice(1) });
  }

  const absorbed = plans.reduce((n, p) => n + p.dups.length, 0);
  console.log(`\nduplicate name_key groups: ${plans.length}   people absorbed: ${absorbed}`);
  if (skippedClaims) console.log(`skipped (claimed by different users): ${skippedClaims}`);
  console.log('\nsamples:');
  for (const p of plans.slice(0, 20)) {
    console.log(`  KEEP ${JSON.stringify(p.survivor.name)} (${p.survivor.film_count || 0} films)`);
    console.log(`       ← ${p.dups.map((d: any) => `${JSON.stringify(d.name)} (${d.film_count || 0})`).join('  ')}`);
  }

  if (!APPLY) { console.log('\nDRY RUN — pass --apply to merge.'); return; }

  let ok = 0, fail = 0;
  for (let i = 0; i < plans.length; i++) {
    const { survivor, dups } = plans[i];
    const ids = dups.map((d: any) => d.id);
    // merge_people copies mubi_slug onto the survivor while the duplicate still
    // holds it (UNIQUE) — release it first. Same guard the other merge scripts use.
    await supabase.from('people').update({ mubi_slug: null }).in('id', ids);
    const { error } = await supabase.rpc('merge_people_group', {
      p_master_id: survivor.id, p_duplicate_ids: ids, p_metadata: {},
    });
    if (error) { fail++; console.warn(`  ❌ ${survivor.name}: ${String(error.message).slice(0, 90)}`); }
    else ok++;
    if ((i + 1) % 50 === 0 || i === plans.length - 1) console.log(`  ${i + 1}/${plans.length} (ok=${ok} fail=${fail})`);
  }
  console.log(`\nDone. ok=${ok} fail=${fail} absorbed≈${absorbed}`);
}
main().catch((e) => { console.error(e); process.exit(1); });
