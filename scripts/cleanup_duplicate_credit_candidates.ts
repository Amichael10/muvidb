/**
 * Remove exact duplicate pending candidates for one film, keeping the
 * highest-confidence (then oldest) evidence-backed row in each group.
 *
 *   npx tsx scripts/cleanup_duplicate_credit_candidates.ts --film=<uuid>
 *   npx tsx scripts/cleanup_duplicate_credit_candidates.ts --film=<uuid> --apply
 */
import { supabase } from './lib/db';

const filmId = process.argv.find((value) => value.startsWith('--film='))?.slice('--film='.length);
const apply = process.argv.includes('--apply');
if (!filmId) throw new Error('Pass --film=<uuid>; broad cross-film deletion is intentionally disabled.');

const { data, error } = await supabase
  .from('credit_candidates')
  .select('id, raw_name, role_or_character, credit_type, confidence, created_at')
  .eq('film_id', filmId)
  .eq('status', 'pending')
  .order('confidence', { ascending: false })
  .order('created_at', { ascending: true });
if (error) throw new Error(error.message);

const keyOf = (value: string | null | undefined) => (value ?? '')
  .normalize('NFKD')
  .replace(/\p{M}/gu, '')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, ' ')
  .trim();

const seen = new Set<string>();
const duplicateIds: string[] = [];
for (const row of data ?? []) {
  const key = [
    row.credit_type,
    keyOf(row.raw_name),
    keyOf(row.role_or_character),
  ].join('|');
  if (seen.has(key)) duplicateIds.push(row.id);
  else seen.add(key);
}

console.log(`${data?.length ?? 0} pending rows; ${duplicateIds.length} exact duplicates`);
if (!apply) {
  console.log('Dry run only. Pass --apply to delete the duplicate rows.');
  process.exit(0);
}

for (let index = 0; index < duplicateIds.length; index += 200) {
  const { error: deleteError } = await supabase
    .from('credit_candidates')
    .delete()
    .in('id', duplicateIds.slice(index, index + 200));
  if (deleteError) throw new Error(deleteError.message);
}
console.log(`Deleted ${duplicateIds.length}; kept ${seen.size} unique pending candidates.`);

