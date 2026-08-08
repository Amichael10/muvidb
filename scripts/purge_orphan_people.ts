/**
 * Delete empty orphan people: completeness <= 1, unclaimed, unverified, 0 credits.
 *
 *   npx tsx scripts/purge_orphan_people.ts
 *   npx tsx scripts/purge_orphan_people.ts --apply
 *   npx tsx scripts/purge_orphan_people.ts --apply --source=manual
 *   npx tsx scripts/purge_orphan_people.ts --apply --max-completeness=0
 */
import fs from 'node:fs';
import path from 'node:path';
import { supabase } from './lib/db';

const APPLY = process.argv.includes('--apply');
const sourceArg = process.argv.find((a) => a.startsWith('--source='));
const SOURCE = sourceArg ? sourceArg.split('=')[1] : null;
const maxCompArg = process.argv.find((a) => a.startsWith('--max-completeness='));
const MAX_COMP = maxCompArg ? parseInt(maxCompArg.split('=')[1], 10) : 1;
const OUT = path.join('scratch', 'people-dedupe', 'orphan-purge.json');

function completeness(p: any) {
  return [
    p.photo_url,
    p.bio,
    p.date_of_birth,
    p.nationality,
    p.instagram_url || p.facebook_url || p.twitter_url,
    p.tmdb_id || p.mubi_id,
    p.youtube_channel_id || p.youtube_handle,
  ].filter(Boolean).length;
}

async function main() {
  console.log(`Purge orphan people dry=${!APPLY} maxComp=${MAX_COMP}${SOURCE ? ` source=${SOURCE}` : ''}`);

  const pageSize = 1000;
  let from = 0;
  const people: any[] = [];
  for (;;) {
    const { data, error } = await supabase
      .from('people')
      .select(
        'id,name,photo_url,bio,date_of_birth,nationality,instagram_url,facebook_url,twitter_url,tmdb_id,mubi_id,youtube_channel_id,youtube_handle,film_count,claimed_by,is_verified,is_spotlight,source',
      )
      .order('id')
      .range(from, from + pageSize - 1);
    if (error) throw error;
    if (!data?.length) break;
    people.push(...data);
    if (data.length < pageSize) break;
    from += pageSize;
  }
  console.log('loaded', people.length);

  let candidates = people.filter(
    (p) =>
      completeness(p) <= MAX_COMP
      && !(p.film_count > 0)
      && !p.claimed_by
      && !p.is_verified
      && !p.is_spotlight
      && (!SOURCE || p.source === SOURCE),
  );
  console.log('thin candidates', candidates.length);

  const hasCredit = new Set<string>();
  const ids = candidates.map((p) => p.id);
  for (let i = 0; i < ids.length; i += 80) {
    const slice = ids.slice(i, i + 80);
    const { data, error } = await supabase.from('credits').select('person_id').in('person_id', slice);
    if (error) throw error;
    for (const r of data || []) hasCredit.add(r.person_id);
  }

  // Also skip anyone with follows / claims / linked users / owner channels
  const orphans = candidates.filter((p) => !hasCredit.has(p.id));
  const orphanIds = orphans.map((p) => p.id);

  const blocked = new Set<string>();
  for (let i = 0; i < orphanIds.length; i += 80) {
    const slice = orphanIds.slice(i, i + 80);
    const [follows, claims, users, channels] = await Promise.all([
      supabase.from('follows').select('person_id').in('person_id', slice),
      supabase.from('profile_claims').select('person_id').in('person_id', slice),
      supabase.from('users').select('linked_profile_id').in('linked_profile_id', slice),
      supabase.from('channels').select('owner_person_id').in('owner_person_id', slice),
    ]);
    for (const r of follows.data || []) blocked.add(r.person_id);
    for (const r of claims.data || []) blocked.add(r.person_id);
    for (const r of users.data || []) if (r.linked_profile_id) blocked.add(r.linked_profile_id);
    for (const r of channels.data || []) if (r.owner_person_id) blocked.add(r.owner_person_id);
  }

  const deletable = orphans.filter((p) => !blocked.has(p.id));
  const bySource: Record<string, number> = {};
  for (const p of deletable) bySource[p.source || 'null'] = (bySource[p.source || 'null'] || 0) + 1;

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(
    OUT,
    JSON.stringify(
      {
        dryRun: !APPLY,
        generatedAt: new Date().toISOString(),
        totalPeople: people.length,
        deletable: deletable.length,
        blocked: blocked.size,
        bySource,
        sample: deletable.slice(0, 40).map((p) => ({
          id: p.id,
          name: p.name,
          source: p.source,
          completeness: completeness(p),
        })),
        ids: deletable.map((p) => p.id),
      },
      null,
      2,
    ),
  );

  console.log('\n────────────────────────────');
  console.log('Deletable orphans:', deletable.length);
  console.log('Blocked (follows/claims/etc):', blocked.size);
  console.log('By source:', bySource);
  console.log('Plan:', OUT);
  for (const p of deletable.slice(0, 15)) {
    console.log(`  - ${p.name} [${p.source}] ${completeness(p)}/7`);
  }

  if (!APPLY) {
    console.log('\nDry-run only. Re-run with --apply to delete.');
    return;
  }

  let deleted = 0;
  let failed = 0;
  for (let i = 0; i < deletable.length; i += 100) {
    const chunk = deletable.slice(i, i + 100).map((p) => p.id);
    // Clear unique slug fields that can block deletes via related constraints isn't needed;
    // people delete should cascade enrichment queue. Null conflicting unique cols first if needed.
    await supabase.from('people').update({ mubi_slug: null }).in('id', chunk);
    const { error } = await supabase.from('people').delete().in('id', chunk);
    if (error) {
      failed += chunk.length;
      console.warn(`  ❌ chunk ${i}: ${error.message}`);
    } else {
      deleted += chunk.length;
      console.log(`  ✓ deleted ${deleted}/${deletable.length}`);
    }
  }
  console.log(`\nDone. deleted=${deleted} failed≈${failed}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
