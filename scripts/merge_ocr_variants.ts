/**
 * Merge OCR misreadings into the real person, WITHOUT ever merging two
 * genuinely different people.
 *
 * The fuzzy "Very similar spelling" bucket mixes two things:
 *   a) one person read badly by OCR   — "Gentle C. Obiagwu" / "Gcntle C.Obingwu"
 *   b) genuinely different people     — "Victoria Adeboye" / "Victoria Adebola"
 *
 * Discriminator: a CORRUPT name (stray symbols, 4+ consonant runs, vowel-less
 * tokens, digits) is an OCR artifact and can be folded into a CLEAN name.
 * Two CLEAN names are never merged. And if a group contains MORE THAN ONE clean
 * name the corrupt members are ambiguous, so the whole group is skipped for
 * human review.
 *
 *   npx tsx scripts/merge_ocr_variants.ts
 *   npx tsx scripts/merge_ocr_variants.ts --apply
 */
import { supabase } from './lib/db';
import { scanPeopleDuplicates } from '../src/lib/deduplicator.js';

const APPLY = process.argv.includes('--apply');
const VOWELS = /[aeiouy]/i;

/** Is this name an OCR artifact rather than a real, well-formed name? */
export function isCorruptName(raw: string): boolean {
  // A trailing "(nickname)" is legitimate annotation, NOT corruption — strip it
  // before judging, or real full names get folded into bare nicknames.
  const s = String(raw || '').replace(/\([^)]*\)/g, ' ').replace(/\s+/g, ' ').trim();
  if (!s) return true;
  // characters that never belong in a person's name
  if (/[^A-Za-z\s.'’\-]/.test(s)) return true;            // digits, ¢ € “ — etc.
  for (const tok of s.split(/[\s.'’\-]+/).filter(Boolean)) {
    if (tok.length === 1) continue;                        // initials are fine
    if (tok.length >= 4 && !VOWELS.test(tok)) return true;  // "MB", "Gcntl"-ish
    if (/[bcdfghjklmnpqrstvwxz]{4,}/i.test(tok)) return true; // 4+ consonant run
    if (/(.)\1\1/i.test(tok)) return true;                  // "aaa"
  }
  return false;
}
/** Meaningful name tokens, ignoring any "(nickname)" annotation. */
const nameTokens = (n: string) =>
  String(n || '').replace(/\([^)]*\)/g, ' ').split(/[\s.'’\-]+/).filter((t) => t.length > 1).length;

const completeness = (p: any) =>
  ['bio', 'photo_url', 'date_of_birth', 'nationality', 'tmdb_id', 'slug', 'gender']
    .reduce((n, k) => n + (p?.[k] ? 1 : 0), 0);

async function main() {
  let all: any[] = []; let from = 0;
  for (;;) {
    const { data, error } = await supabase.from('people').select('*').order('id').range(from, from + 999);
    if (error) throw new Error(error.message);
    if (!data?.length) break;
    all.push(...data); if (data.length < 1000) break; from += 1000;
  }
  console.log(`people loaded: ${all.length}`);
  const report: any = scanPeopleDuplicates(all);
  const byId = new Map(all.map((p) => [p.id, p]));

  const plans: any[] = [];
  let skippedMultiClean = 0, skippedNoClean = 0, skippedShorterSurvivor = 0;
  for (const g of report.groups) {
    if (g.confidence === 'blocked') continue;
    const members = (g.records || []).map((r: any) => byId.get(r.id)).filter(Boolean);
    if (members.length < 2) continue;
    const clean = members.filter((m: any) => !isCorruptName(m.name));
    const corrupt = members.filter((m: any) => isCorruptName(m.name));
    if (!clean.length) { skippedNoClean++; continue; }          // nothing trustworthy to keep
    if (clean.length > 1) { skippedMultiClean++; continue; }    // AMBIGUOUS → leave for a human
    if (!corrupt.length) continue;
    const survivor = clean[0];
    // NEVER absorb a fuller name into a shorter one — that's how
    // "Michael Olalekan (Erekere)" got eaten by "EREKERE" and
    // "Emmanuella" by "Emmanuel". The survivor must be at least as informative.
    const sTok = nameTokens(survivor.name);
    const duplicates = corrupt.filter((d: any) => nameTokens(d.name) <= sTok);
    if (!duplicates.length) { skippedShorterSurvivor++; continue; }
    plans.push({ survivor, duplicates });
  }
  const absorbed = plans.reduce((n, p) => n + p.duplicates.length, 0);
  console.log(`\nmergeable groups: ${plans.length}   OCR variants absorbed: ${absorbed}`);
  console.log(`skipped (>1 clean name, ambiguous): ${skippedMultiClean}   (no clean name): ${skippedNoClean}   (survivor shorter than dup): ${skippedShorterSurvivor}`);
  console.log('\nsamples:');
  for (const p of plans.slice(0, 12)) {
    console.log(`  KEEP ${JSON.stringify(p.survivor.name)} (${completeness(p.survivor)}/7)`);
    console.log(`       ← ${p.duplicates.map((d: any) => JSON.stringify(d.name)).join('  ')}`);
  }
  if (!APPLY) { console.log('\nDRY RUN — pass --apply to merge.'); return; }

  let ok = 0, fail = 0;
  for (let i = 0; i < plans.length; i++) {
    const plan = plans[i];
    const dupIds = plan.duplicates.map((d: any) => d.id);
    await supabase.from('people').update({ mubi_slug: null }).in('id', dupIds);
    const { error } = await supabase.rpc('merge_people_group', {
      p_master_id: plan.survivor.id, p_duplicate_ids: dupIds, p_metadata: {},
    });
    if (error) { fail++; console.warn(`  ❌ ${plan.survivor.name}: ${error.message}`); } else ok++;
    if ((i + 1) % 25 === 0 || i === plans.length - 1) console.log(`  ${i + 1}/${plans.length} (ok=${ok} fail=${fail})`);
  }
  console.log(`\nDone. ok=${ok} fail=${fail} absorbed≈${absorbed}`);
}
main().catch((e) => { console.error(e); process.exit(1); });
