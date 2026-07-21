/**
 * Merge every remaining "Same normalized name" people group (hyphen/space/case).
 * Also collapses exact folded-name buckets.
 *
 *   npx tsx scripts/merge_same_normalized_people.ts --apply
 */
import fs from 'node:fs';
import path from 'node:path';
import { supabase } from './lib/db';
import { scanPeopleDuplicates, foldText } from '../src/lib/deduplicator.js';

const APPLY = process.argv.includes('--apply');
const OUT = path.join('scratch', 'people-dedupe', 'same-normalized-merges.json');

function foldName(value: string) {
  return foldText(value)
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function completeness(p: any) {
  return [
    p.photo_url, p.bio, p.date_of_birth, p.nationality,
    p.instagram_url || p.facebook_url || p.twitter_url,
    p.tmdb_id || p.mubi_id, p.youtube_channel_id || p.youtube_handle,
  ].filter(Boolean).length;
}

function isProtected(p: any) {
  return Boolean(p.claimed_by || p.is_verified || p.is_spotlight);
}

function hasIdConflict(a: any, b: any) {
  if (a.tmdb_id != null && b.tmdb_id != null && a.tmdb_id !== b.tmdb_id) return true;
  if (a.mubi_id != null && b.mubi_id != null && a.mubi_id !== b.mubi_id) return true;
  if (a.date_of_birth && b.date_of_birth && a.date_of_birth !== b.date_of_birth) return true;
  if (a.claimed_by && b.claimed_by && a.claimed_by !== b.claimed_by) return true;
  return false;
}

function rank(a: any, b: any) {
  const prot = Number(isProtected(b)) - Number(isProtected(a));
  if (prot) return prot;
  const c = completeness(b) - completeness(a);
  if (c) return c;
  return Number(b.film_count || 0) - Number(a.film_count || 0);
}

async function main() {
  console.log(`Same-normalized-name merge dry=${!APPLY}`);

  const people: any[] = [];
  let from = 0;
  for (;;) {
    const { data, error } = await supabase
      .from('people')
      .select(
        'id,name,photo_url,bio,date_of_birth,nationality,instagram_url,facebook_url,twitter_url,tmdb_id,mubi_id,youtube_channel_id,youtube_handle,film_count,claimed_by,is_verified,is_spotlight,source,slug',
      )
      .order('id')
      .range(from, from + 999);
    if (error) throw error;
    if (!data?.length) break;
    people.push(...data);
    if (data.length < 1000) break;
    from += 1000;
  }
  console.log('loaded', people.length);

  // Pass 1: exact folded-name buckets (catches hyphen vs space)
  const byFold = new Map<string, any[]>();
  for (const p of people) {
    const key = foldName(p.name);
    if (!key || key.length < 2) continue;
    const list = byFold.get(key) || [];
    list.push(p);
    byFold.set(key, list);
  }

  // Pass 2: scanner groups with "Same normalized name"
  const report = scanPeopleDuplicates(people);
  const scanGroups = (report.groups || []).filter((g: any) =>
    (g.reasons || []).some((r: string) => /Same normalized name/i.test(r))
    && g.confidence !== 'blocked',
  );

  type Plan = { key: string; primaryId: string; primaryName: string; duplicateIds: string[]; duplicateNames: string[] };
  const plans: Plan[] = [];
  const used = new Set<string>();

  for (const [, list] of byFold) {
    if (list.length < 2) continue;
    const sorted = [...list].sort(rank);
    const primary = sorted[0];
    const dups = sorted.slice(1).filter((p) => !hasIdConflict(primary, p) && !(isProtected(p) && !isProtected(primary)));
    if (!dups.length) continue;
    if (used.has(primary.id) || dups.some((d) => used.has(d.id))) continue;
    used.add(primary.id);
    for (const d of dups) used.add(d.id);
    plans.push({
      key: `fold:${foldName(primary.name)}`,
      primaryId: primary.id,
      primaryName: primary.name,
      duplicateIds: dups.map((d) => d.id),
      duplicateNames: dups.map((d) => d.name),
    });
  }

  for (const g of scanGroups) {
    const primary = g.records.find((r: any) => r.id === g.recommendedPrimaryId) || g.records[0];
    const dups = g.records.filter((r: any) => r.id !== primary.id && !used.has(r.id) && !hasIdConflict(primary, r));
    if (!dups.length || used.has(primary.id)) continue;
    // Prefer richer record if recommended is thinner
    const richer = [...g.records].sort(rank)[0];
    const survivor = completeness(richer) >= completeness(primary) ? richer : primary;
    const rest = g.records.filter((r: any) => r.id !== survivor.id && !hasIdConflict(survivor, r));
    if (!rest.length) continue;
    if (rest.some((r: any) => used.has(r.id)) || used.has(survivor.id)) continue;
    used.add(survivor.id);
    for (const r of rest) used.add(r.id);
    plans.push({
      key: `scan:${g.id}`,
      primaryId: survivor.id,
      primaryName: survivor.name,
      duplicateIds: rest.map((r: any) => r.id),
      duplicateNames: rest.map((r: any) => r.name),
    });
  }

  const absorb = plans.reduce((n, p) => n + p.duplicateIds.length, 0);
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify({
    dryRun: !APPLY,
    generatedAt: new Date().toISOString(),
    scanSummary: report.summary,
    groups: plans.length,
    peopleToAbsorb: absorb,
    sample: plans.slice(0, 40),
    plans,
  }, null, 2));

  console.log(`scan summary`, report.summary);
  console.log(`plans=${plans.length} absorb=${absorb}`);
  for (const p of plans.slice(0, 25)) {
    console.log(`  KEEP ${p.primaryName} ← ${p.duplicateNames.join(' | ')}`);
  }

  if (!APPLY) {
    console.log('Dry-run only.');
    return;
  }

  let ok = 0;
  let fail = 0;
  for (let i = 0; i < plans.length; i++) {
    const plan = plans[i];
    await supabase.from('people').update({ mubi_slug: null }).in('id', plan.duplicateIds);
    const { error } = await supabase.rpc('merge_people_group', {
      p_master_id: plan.primaryId,
      p_duplicate_ids: plan.duplicateIds,
      p_metadata: {},
    });
    if (error) {
      fail++;
      console.warn(`  ❌ ${plan.primaryName}: ${error.message}`);
    } else {
      ok++;
      if ((i + 1) % 50 === 0 || i === plans.length - 1) console.log(`  ✓ ${i + 1}/${plans.length} ok=${ok} fail=${fail}`);
    }
  }
  console.log(`Done ok=${ok} fail=${fail}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
