/**
 * Auto-merge people with the same name tokens in a different order.
 * e.g. "Stella Okochi" ↔ "Okochi Stella", "Adedayo Opeyemi" ↔ "OPEYEMI ADEDAYO"
 *
 * Safer than fuzzy merge: exact token multiset (sorted) must match.
 * Merges into the richest survivor even when both have credits.
 *
 *   npx tsx scripts/merge_name_order_swaps.ts
 *   npx tsx scripts/merge_name_order_swaps.ts --apply
 */
import fs from 'node:fs';
import path from 'node:path';
import { supabase } from './lib/db';

const APPLY = process.argv.includes('--apply');
const OUT = path.join('scratch', 'people-dedupe', 'name-order-swaps.json');

const PERSON_NOISE = new Set([
  'actor', 'actress', 'alhaji', 'alhaja', 'chief', 'comedian', 'director',
  'dr', 'engr', 'evangelist', 'hon', 'mr', 'mrs', 'ms', 'pastor', 'prince',
  'princess', 'producer', 'sir', 'official',
]);

type Person = Record<string, any>;

function foldText(value: string) {
  return String(value || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[’‘`]/g, "'")
    .toLowerCase();
}

function personTokens(name: string) {
  return foldText(name)
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .filter((t) => !PERSON_NOISE.has(t));
}

function sortedKey(name: string) {
  const tokens = personTokens(name);
  if (tokens.length < 2) return null;
  // Require stable multiset — sort + join with length prefix to avoid collisions
  return `${tokens.length}:${[...tokens].sort().join('|')}`;
}

function completeness(p: Person) {
  return [
    p.photo_url, p.bio, p.date_of_birth, p.nationality,
    p.instagram_url || p.facebook_url || p.twitter_url,
    p.tmdb_id || p.mubi_id, p.youtube_channel_id || p.youtube_handle,
  ].filter(Boolean).length;
}

function isProtected(p: Person) {
  return Boolean(p.claimed_by || p.is_verified || p.is_spotlight);
}

function hasIdConflict(a: Person, b: Person) {
  if (a.tmdb_id != null && b.tmdb_id != null && a.tmdb_id !== b.tmdb_id) return true;
  if (a.mubi_id != null && b.mubi_id != null && a.mubi_id !== b.mubi_id) return true;
  const aY = String(a.youtube_channel_id || a.youtube_handle || '').toLowerCase();
  const bY = String(b.youtube_channel_id || b.youtube_handle || '').toLowerCase();
  if (aY && bY && aY !== bY) return true;
  if (a.date_of_birth && b.date_of_birth && a.date_of_birth !== b.date_of_birth) return true;
  if (a.claimed_by && b.claimed_by && a.claimed_by !== b.claimed_by) return true;
  return false;
}

function rank(a: Person, b: Person, credits: Map<string, number>) {
  const prot = Number(isProtected(b)) - Number(isProtected(a));
  if (prot) return prot;
  const c = completeness(b) - completeness(a);
  if (c) return c;
  const films = Number(b.film_count || 0) - Number(a.film_count || 0);
  if (films) return films;
  return (credits.get(b.id) || 0) - (credits.get(a.id) || 0);
}

/** True if any two names in the group are not the same compact order (i.e. real swap). */
function hasReorder(list: Person[]) {
  const compacts = new Set(
    list.map((p) => personTokens(p.name).join('|')),
  );
  return compacts.size > 1;
}

async function creditCounts(ids: string[]) {
  const map = new Map<string, number>();
  for (let i = 0; i < ids.length; i += 80) {
    const slice = ids.slice(i, i + 80);
    const { data, error } = await supabase.from('credits').select('person_id').in('person_id', slice);
    if (error) throw error;
    for (const row of data || []) map.set(row.person_id, (map.get(row.person_id) || 0) + 1);
  }
  return map;
}

async function main() {
  console.log(`Name-order swap merge  dry=${!APPLY}`);

  const pageSize = 1000;
  let from = 0;
  const people: Person[] = [];
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

  const byKey = new Map<string, Person[]>();
  for (const p of people) {
    const key = sortedKey(p.name);
    if (!key) continue;
    const list = byKey.get(key) || [];
    list.push(p);
    byKey.set(key, list);
  }

  const groups = [...byKey.entries()]
    .map(([key, list]) => ({ key, list }))
    .filter(({ list }) => list.length >= 2 && hasReorder(list));

  console.log('token-swap groups:', groups.length);

  const ids = groups.flatMap((g) => g.list.map((p) => p.id));
  const credits = await creditCounts(ids);

  type Plan = {
    key: string;
    survivor: { id: string; name: string; films: number; credits: number; completeness: number };
    duplicates: Array<{ id: string; name: string; films: number; credits: number }>;
  };

  const plans: Plan[] = [];
  let skippedConflict = 0;

  for (const { key, list } of groups) {
    const sorted = [...list].sort((a, b) => rank(a, b, credits));
    const survivor = sorted[0];
    const dups = sorted.slice(1).filter((p) => {
      if (isProtected(p) && !isProtected(survivor)) {
        // don't absorb a protected profile into unprotected
        skippedConflict++;
        return false;
      }
      if (hasIdConflict(survivor, p)) {
        skippedConflict++;
        return false;
      }
      return true;
    });
    if (!dups.length) continue;

    plans.push({
      key,
      survivor: {
        id: survivor.id,
        name: survivor.name,
        films: Number(survivor.film_count || 0),
        credits: credits.get(survivor.id) || 0,
        completeness: completeness(survivor),
      },
      duplicates: dups.map((p) => ({
        id: p.id,
        name: p.name,
        films: Number(p.film_count || 0),
        credits: credits.get(p.id) || 0,
      })),
    });
  }

  const stubCount = plans.reduce((n, p) => n + p.duplicates.length, 0);
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(
    OUT,
    JSON.stringify(
      {
        dryRun: !APPLY,
        generatedAt: new Date().toISOString(),
        groups: plans.length,
        peopleToAbsorb: stubCount,
        skippedConflict,
        sample: plans.slice(0, 40),
        plans,
      },
      null,
      2,
    ),
  );

  console.log('\n────────────────────────────');
  console.log(`Mergeable swap groups: ${plans.length}`);
  console.log(`People to absorb: ${stubCount}`);
  console.log(`Skipped conflicts: ${skippedConflict}`);
  console.log(`Plan: ${OUT}`);
  for (const p of plans.slice(0, 25)) {
    console.log(
      `  KEEP "${p.survivor.name}" (${p.survivor.completeness}/7, ${p.survivor.credits} cr) ← ${p.duplicates.map((d) => d.name).join(' | ')}`,
    );
  }

  if (!APPLY) {
    console.log('\nDry-run only. Re-run with --apply to merge.');
    return;
  }

  let ok = 0;
  let fail = 0;
  for (let i = 0; i < plans.length; i++) {
    const plan = plans[i];
    await supabase.from('people').update({ mubi_slug: null }).in('id', plan.duplicates.map((d) => d.id));
    const { error } = await supabase.rpc('merge_people_group', {
      p_master_id: plan.survivor.id,
      p_duplicate_ids: plan.duplicates.map((d) => d.id),
      p_metadata: {},
    });
    if (error) {
      fail++;
      console.warn(`  ❌ ${plan.survivor.name}: ${error.message}`);
    } else {
      ok++;
      if ((i + 1) % 25 === 0 || i === plans.length - 1) {
        console.log(`  ✓ ${i + 1}/${plans.length} (ok=${ok} fail=${fail})`);
      }
    }
  }
  console.log(`\nDone. ok=${ok} fail=${fail} absorbed≈${stubCount}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
