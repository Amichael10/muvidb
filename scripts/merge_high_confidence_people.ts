/**
 * Auto-merge ALL high-confidence people duplicate groups from the live scanner.
 * (Not just empty stubs — full group merge into recommended primary.)
 *
 *   npx tsx scripts/merge_high_confidence_people.ts
 *   npx tsx scripts/merge_high_confidence_people.ts --apply
 *   npx tsx scripts/merge_high_confidence_people.ts --apply --include-medium
 */
import fs from 'node:fs';
import path from 'node:path';
import { supabase } from './lib/db';
import { scanPeopleDuplicates, foldText } from '../src/lib/deduplicator.js';

const APPLY = process.argv.includes('--apply');
const INCLUDE_MEDIUM = process.argv.includes('--include-medium');
const AGGRESSIVE = process.argv.includes('--aggressive'); // skip safety filter
const OUT = path.join('scratch', 'people-dedupe', 'high-confidence-merges.json');

const PERSON_NOISE = new Set([
  'actor', 'actress', 'alhaji', 'alhaja', 'chief', 'comedian', 'director',
  'dr', 'engr', 'evangelist', 'hon', 'mr', 'mrs', 'ms', 'pastor', 'prince',
  'princess', 'producer', 'sir', 'official',
]);

function personTokens(name: string) {
  return foldText(name)
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .filter((t) => !PERSON_NOISE.has(t));
}

function isSafePair(primaryName: string, dupName: string, reasons: string[]) {
  const strong = (reasons || []).some((r) =>
    /Same normalized name|Same name tokens in a different order|Same TMDB|Same MUBI|Same YouTube/i.test(r),
  );
  const p = personTokens(primaryName);
  const d = personTokens(dupName);
  if (!p.length || !d.length) return false;

  // Exact same tokens (any order) — always safe
  if ([...p].sort().join('|') === [...d].sort().join('|')) return true;

  // Strong identity evidence
  if (strong && Math.min(p.length, d.length) >= 2) return true;

  // Never absorb bare single-token names into longer names (Tony→Chief Tony, Moses→Dr Moses)
  if (Math.min(p.length, d.length) === 1 && Math.max(p.length, d.length) >= 2) return false;

  // Both multi-token + high score path handled by caller confidence
  return Math.min(p.length, d.length) >= 2;
}

async function main() {
  console.log(`High-confidence merge dry=${!APPLY} includeMedium=${INCLUDE_MEDIUM}`);

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

  const report = scanPeopleDuplicates(people);
  console.log('summary', report.summary);

  const groups = (report.groups || []).filter((g: any) => {
    if (g.confidence === 'blocked') return false;
    if (g.confidence === 'high') return true;
    if (INCLUDE_MEDIUM && g.confidence === 'medium') return true;
    return false;
  });

  const plans = groups.map((g: any) => {
    const primaryId = g.recommendedPrimaryId;
    const primary = g.records.find((r: any) => r.id === primaryId) || g.records[0];
    const dupRecords = g.records.filter((r: any) => r.id !== primaryId);
    const safeDups = AGGRESSIVE
      ? dupRecords
      : dupRecords.filter((r: any) => isSafePair(primary?.name || '', r.name, g.reasons || []));
    return {
      confidence: g.confidence,
      score: g.score,
      reasons: g.reasons,
      primaryId,
      primaryName: primary?.name,
      duplicateIds: safeDups.map((r: any) => r.id),
      duplicateNames: safeDups.map((r: any) => r.name),
      skippedUnsafe: dupRecords.length - safeDups.length,
    };
  }).filter((p: any) => p.duplicateIds.length);

  const skippedUnsafe = groups.reduce((n: number, g: any) => {
    const primary = g.records.find((r: any) => r.id === g.recommendedPrimaryId) || g.records[0];
    const dupRecords = g.records.filter((r: any) => r.id !== primary.id);
    if (AGGRESSIVE) return n;
    return n + dupRecords.filter((r: any) => !isSafePair(primary?.name || '', r.name, g.reasons || [])).length;
  }, 0);

  const absorb = plans.reduce((n: number, p: any) => n + p.duplicateIds.length, 0);
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

  console.log(`\nMergeable groups: ${plans.length}`);
  console.log(`People to absorb: ${absorb}`);
  console.log(`Skipped unsafe pairs: ${skippedUnsafe}`);
  for (const p of plans.slice(0, 15)) {
    console.log(`  [${p.confidence}] ${p.primaryName} ← ${p.duplicateNames.join(' | ')}`);
  }

  if (!APPLY) {
    console.log('\nDry-run only. Re-run with --apply.');
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
      if ((i + 1) % 50 === 0 || i === plans.length - 1) {
        console.log(`  ✓ ${i + 1}/${plans.length} (ok=${ok} fail=${fail})`);
      }
    }
  }
  console.log(`\nDone. ok=${ok} fail=${fail} absorbed≈${absorb}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
