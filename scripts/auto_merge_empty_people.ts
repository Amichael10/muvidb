/**
 * Auto-merge empty people stubs into the richer survivor.
 *
 * Targets:
 *  1) Admin-deduplicator HIGH confidence groups where non-survivors are empty stubs
 *  2) Exact normalized-name groups (including all-thin collapses)
 *
 * Stub = completeness <= 1/7, film_count 0, zero credits, not claimed/verified.
 * Uses merge_people_group RPC (safe rewiring).
 *
 *   npx tsx scripts/auto_merge_empty_people.ts
 *   npx tsx scripts/auto_merge_empty_people.ts --apply
 *   npx tsx scripts/auto_merge_empty_people.ts --apply --limit=100
 */
import fs from 'node:fs';
import path from 'node:path';
import { supabase } from './lib/db';
import { scanPeopleDuplicates, foldText } from '../src/lib/deduplicator.js';

const APPLY = process.argv.includes('--apply');
const HIGH_ONLY = !process.argv.includes('--include-medium');
const limitArg = process.argv.find((a) => a.startsWith('--limit='));
const LIMIT = limitArg ? parseInt(limitArg.split('=')[1], 10) : null;
const OUT = path.join('scratch', 'people-dedupe', 'empty-stub-merges.json');

type Person = Record<string, any>;

function foldName(value: string) {
  return foldText(value)
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function completeness(p: Person) {
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

function isProtected(p: Person) {
  return Boolean(p.claimed_by || p.is_verified || p.is_spotlight);
}

function hasIdConflict(survivor: Person, stub: Person) {
  if (stub.tmdb_id != null && survivor.tmdb_id != null && stub.tmdb_id !== survivor.tmdb_id) return true;
  if (stub.mubi_id != null && survivor.mubi_id != null && stub.mubi_id !== survivor.mubi_id) return true;
  const sY = String(stub.youtube_channel_id || stub.youtube_handle || '').toLowerCase();
  const vY = String(survivor.youtube_channel_id || survivor.youtube_handle || '').toLowerCase();
  if (sY && vY && sY !== vY) return true;
  return false;
}

function isStub(p: Person, creditCount: number) {
  if (isProtected(p)) return false;
  if (completeness(p) > 1) return false;
  if (Number(p.film_count || 0) > 0) return false;
  if (creditCount > 0) return false;
  return true;
}

async function fetchAllPeople(): Promise<Person[]> {
  const pageSize = 1000;
  let from = 0;
  const all: Person[] = [];
  for (;;) {
    const { data, error } = await supabase
      .from('people')
      .select(
        'id,name,photo_url,bio,date_of_birth,nationality,instagram_url,facebook_url,twitter_url,tmdb_id,mubi_id,youtube_channel_id,youtube_handle,film_count,claimed_by,is_verified,is_spotlight,source,slug',
      )
      .order('id')
      .range(from, from + pageSize - 1);
    if (error) throw error;
    if (!data?.length) break;
    all.push(...data);
    if (data.length < pageSize) break;
    from += pageSize;
    if (from % 10000 === 0) console.log(`  loaded ${all.length}...`);
  }
  return all;
}

async function creditCounts(ids: string[]): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  const chunk = 200;
  for (let i = 0; i < ids.length; i += chunk) {
    const slice = ids.slice(i, i + chunk);
    const { data, error } = await supabase.from('credits').select('person_id').in('person_id', slice);
    if (error) throw error;
    for (const row of data || []) {
      map.set(row.person_id, (map.get(row.person_id) || 0) + 1);
    }
  }
  return map;
}

type Plan = {
  reason: string;
  confidence: string;
  name: string;
  survivorId: string;
  survivorCompleteness: number;
  survivorFilms: number;
  duplicateIds: string[];
  stubNames: string[];
};

async function main() {
  console.log(`Empty-stub auto-merge dry=${!APPLY} highOnly=${HIGH_ONLY}${LIMIT ? ` limit=${LIMIT}` : ''}`);
  console.log('Loading people...');
  const people = await fetchAllPeople();
  console.log(`Loaded ${people.length}`);

  console.log('Scanning duplicates...');
  const report = scanPeopleDuplicates(people);
  const groups = report.groups || [];
  console.log('Groups:', report.summary);

  const idsInGroups = [...new Set(groups.flatMap((g: any) => g.records.map((r: any) => r.id)))];
  console.log(`Checking credits for ${idsInGroups.length} people in groups...`);
  const credits = await creditCounts(idsInGroups);

  const plans: Plan[] = [];
  const plannedStubIds = new Set<string>();

  for (const g of groups) {
    if (g.confidence === 'blocked') continue;
    if (HIGH_ONLY && g.confidence !== 'high') continue;

    const records: Person[] = g.records;
    const survivor =
      records.find((r) => r.id === g.recommendedPrimaryId) || records[0];
    const stubs = records.filter((r) => (
      r.id !== survivor.id
      && !plannedStubIds.has(r.id)
      && isStub(r, credits.get(r.id) || 0)
      && !hasIdConflict(survivor, r)
    ));
    if (!stubs.length) continue;

    // Survivor must be worth keeping as primary (has usage or richer profile)
    const sComp = completeness(survivor);
    const sCredits = credits.get(survivor.id) || 0;
    const survivorOk =
      isProtected(survivor)
      || sCredits > 0
      || Number(survivor.film_count || 0) > 0
      || sComp > Math.max(...stubs.map((s) => completeness(s)));
    if (!survivorOk) continue;

    for (const s of stubs) plannedStubIds.add(s.id);
    plans.push({
      reason: 'high-confidence-stub',
      confidence: g.confidence,
      name: survivor.name,
      survivorId: survivor.id,
      survivorCompleteness: sComp,
      survivorFilms: Number(survivor.film_count || 0),
      duplicateIds: stubs.map((s) => s.id),
      stubNames: stubs.map((s) => s.name),
    });
  }

  // Exact-name all-thin / into-richer for anything the scan missed
  const byFold = new Map<string, Person[]>();
  for (const p of people) {
    const key = foldName(p.name);
    if (!key) continue;
    const list = byFold.get(key) || [];
    list.push(p);
    byFold.set(key, list);
  }

  // Need credits for remaining exact-name candidates not already checked
  const extraIds = [...byFold.values()]
    .filter((list) => list.length >= 2)
    .flatMap((list) => list.map((p) => p.id))
    .filter((id) => !credits.has(id));
  if (extraIds.length) {
    const extra = await creditCounts(extraIds);
    for (const [id, n] of extra) credits.set(id, n);
  }

  for (const [, list] of byFold) {
    if (list.length < 2) continue;
    const sorted = [...list].sort((a, b) => {
      const protectedDelta = Number(isProtected(b)) - Number(isProtected(a));
      if (protectedDelta) return protectedDelta;
      const c = completeness(b) - completeness(a);
      if (c) return c;
      const films = Number(b.film_count || 0) - Number(a.film_count || 0);
      if (films) return films;
      return (credits.get(b.id) || 0) - (credits.get(a.id) || 0);
    });
    const survivor = sorted[0];
    const stubs = sorted.slice(1).filter((r) => (
      !plannedStubIds.has(r.id)
      && isStub(r, credits.get(r.id) || 0)
      && !hasIdConflict(survivor, r)
    ));
    if (!stubs.length) continue;

    const sComp = completeness(survivor);
    const sCredits = credits.get(survivor.id) || 0;
    const allThin = sorted.every((r) => isStub(r, credits.get(r.id) || 0) || r.id === survivor.id);
    const survivorOk =
      isProtected(survivor)
      || sCredits > 0
      || Number(survivor.film_count || 0) > 0
      || sComp > Math.max(...stubs.map((s) => completeness(s)))
      || allThin;
    if (!survivorOk) continue;

    for (const s of stubs) plannedStubIds.add(s.id);
    plans.push({
      reason: allThin && sComp <= 1 ? 'exact-all-thin' : 'exact-into-richer',
      confidence: 'exact-name',
      name: survivor.name,
      survivorId: survivor.id,
      survivorCompleteness: sComp,
      survivorFilms: Number(survivor.film_count || 0),
      duplicateIds: stubs.map((s) => s.id),
      stubNames: stubs.map((s) => s.name),
    });
  }

  const limited = LIMIT ? plans.slice(0, LIMIT) : plans;
  const stubCount = limited.reduce((n, p) => n + p.duplicateIds.length, 0);

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(
    OUT,
    JSON.stringify(
      {
        dryRun: !APPLY,
        generatedAt: new Date().toISOString(),
        highOnly: HIGH_ONLY,
        scanSummary: report.summary,
        groups: limited.length,
        stubsToMerge: stubCount,
        byReason: limited.reduce((acc: Record<string, number>, p) => {
          acc[p.reason] = (acc[p.reason] || 0) + p.duplicateIds.length;
          return acc;
        }, {}),
        sample: limited.slice(0, 40),
        plans: limited,
      },
      null,
      2,
    ),
  );

  console.log('\n────────────────────────────');
  console.log(`Mergeable groups: ${limited.length}`);
  console.log(`Stub records to absorb: ${stubCount}`);
  console.log(`Plan: ${OUT}`);
  for (const p of limited.slice(0, 20)) {
    console.log(
      `  [${p.confidence}] "${p.name}" (${p.survivorCompleteness}/7, films=${p.survivorFilms}) ← ${p.stubNames.join(' | ')}`,
    );
  }

  if (!APPLY) {
    console.log('\nDry-run only. Re-run with --apply to merge.');
    return;
  }

  let ok = 0;
  let fail = 0;
  for (let i = 0; i < limited.length; i++) {
    const plan = limited[i];
    // Avoid unique mubi_slug collisions during COALESCE in merge_people
    await supabase.from('people').update({ mubi_slug: null }).in('id', plan.duplicateIds);
    const { error } = await supabase.rpc('merge_people_group', {
      p_master_id: plan.survivorId,
      p_duplicate_ids: plan.duplicateIds,
      p_metadata: {},
    });
    if (error) {
      fail++;
      console.warn(`  ❌ ${plan.name}: ${error.message}`);
    } else {
      ok++;
      if ((i + 1) % 25 === 0 || i === limited.length - 1) {
        console.log(`  ✓ ${i + 1}/${limited.length} (ok=${ok} fail=${fail})`);
      }
    }
  }
  console.log(`\nDone. groups_ok=${ok} groups_fail=${fail} stubs≈${stubCount}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
