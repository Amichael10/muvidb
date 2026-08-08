/**
 * Remove pending candidates produced by the old flattened-text parser and
 * requeue only their films. Approved/rejected rows and evidence-backed rows are
 * never touched.
 *
 * Dry run:
 *   npx tsx scripts/cleanup_legacy_credit_candidates.ts
 *
 * Apply:
 *   npx tsx scripts/cleanup_legacy_credit_candidates.ts --apply
 */
import { supabase } from './lib/db';

const apply = process.argv.includes('--apply');
const filmIds = new Set<string>();

for (let from = 0; ; from += 1_000) {
  const { data, error } = await supabase
    .from('credit_candidates')
    .select('film_id')
    .eq('status', 'pending')
    .is('source_ocr_text', null)
    .range(from, from + 999);
  if (error) throw new Error(error.message);
  for (const row of data ?? []) filmIds.add(row.film_id);
  if (!data || data.length < 1_000) break;
}

const { count, error: countError } = await supabase
  .from('credit_candidates')
  .select('id', { count: 'exact', head: true })
  .eq('status', 'pending')
  .is('source_ocr_text', null);
if (countError) throw new Error(countError.message);

console.log(`${count ?? 0} legacy pending candidates across ${filmIds.size} films`);
if (!apply) {
  console.log('Dry run only. Pass --apply to requeue those films and delete the legacy pending rows.');
  process.exit(0);
}

const ids = [...filmIds];
for (let index = 0; index < ids.length; index += 200) {
  const { error } = await supabase
    .from('credit_harvest_jobs')
    .update({
      status: 'pending',
      outcome: null,
      candidates_found: 0,
      error: null,
      started_at: null,
      processed_at: null,
    })
    .in('film_id', ids.slice(index, index + 200));
  if (error) throw new Error(`requeue: ${error.message}`);
}

const { count: deleted, error: deleteError } = await supabase
  .from('credit_candidates')
  .delete({ count: 'exact' })
  .eq('status', 'pending')
  .is('source_ocr_text', null);
if (deleteError) throw new Error(`delete: ${deleteError.message}`);

console.log(`Requeued ${filmIds.size} films; deleted ${deleted ?? count ?? 0} legacy pending candidates.`);

