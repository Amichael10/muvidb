import { supabase } from './lib/db';
import { dedupeAwards } from '../src/lib/awards';

async function pageTable(table: string, cols: string) {
  const pageSize = 1000;
  let from = 0;
  const all: any[] = [];
  for (;;) {
    const { data, error } = await supabase
      .from(table)
      .select(cols)
      .not('awards', 'eq', '[]')
      .range(from, from + pageSize - 1);
    if (error) throw error;
    if (!data?.length) break;
    all.push(...data);
    if (data.length < pageSize) break;
    from += pageSize;
  }
  return all;
}

async function reconcile() {
  console.log('--- RECONCILING AWARDS: WINS SUPERSEDE NOMINATIONS ---\n');

  // 1. Reconcile Films
  console.log('Fetching films with awards...');
  const films = await pageTable('films', 'id, title, awards');
  console.log(`Auditing ${films.length} films...`);

  let filmsUpdated = 0;
  for (const f of films) {
    const original = Array.isArray(f.awards) ? f.awards : [];
    const deduped = dedupeAwards(original);

    if (JSON.stringify(original) !== JSON.stringify(deduped)) {
      console.log(`\nReconciling Film: "${f.title}" (${f.id})`);
      console.log(`  Before (${original.length}):`, original.map((a: any) => `[${a.won ? 'WIN' : 'NOM'}] ${a.organization} ${a.year} - ${a.category}`).join(' | '));
      console.log(`  After  (${deduped.length}):`, deduped.map((a: any) => `[${a.won ? 'WIN' : 'NOM'}] ${a.organization} ${a.year} - ${a.category}`).join(' | '));

      const { error } = await supabase
        .from('films')
        .update({ awards: deduped })
        .eq('id', f.id);

      if (error) {
        console.error(`  Error updating film ${f.id}:`, error);
      } else {
        filmsUpdated++;
      }
    }
  }

  // 2. Reconcile People
  console.log(`\nFetching people with awards...`);
  const people = await pageTable('people', 'id, name, awards');
  console.log(`Auditing ${people.length} people...`);

  let peopleUpdated = 0;
  for (const p of people) {
    const original = Array.isArray(p.awards) ? p.awards : [];
    const deduped = dedupeAwards(original);

    if (JSON.stringify(original) !== JSON.stringify(deduped)) {
      console.log(`\nReconciling Person: "${p.name}" (${p.id})`);
      console.log(`  Before (${original.length}):`, original.map((a: any) => `[${a.won ? 'WIN' : 'NOM'}] ${a.organization} ${a.year} - ${a.category}`).join(' | '));
      console.log(`  After  (${deduped.length}):`, deduped.map((a: any) => `[${a.won ? 'WIN' : 'NOM'}] ${a.organization} ${a.year} - ${a.category}`).join(' | '));

      const { error } = await supabase
        .from('people')
        .update({ awards: deduped })
        .eq('id', p.id);

      if (error) {
        console.error(`  Error updating person ${p.id}:`, error);
      } else {
        peopleUpdated++;
      }
    }
  }

  console.log(`\n=== RECONCILIATION COMPLETE ===`);
  console.log(`Updated ${filmsUpdated} films and ${peopleUpdated} people.`);
}

reconcile();
