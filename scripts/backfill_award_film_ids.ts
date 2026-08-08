/**
 * Backfill people.awards[].film_id by matching award.work → films.title.
 * Idempotent: only fills missing film_id. Does not clear existing links.
 *
 *   npx tsx scripts/backfill_award_film_ids.ts
 *   npx tsx scripts/backfill_award_film_ids.ts --dry
 */
import { supabase as db } from './lib/db';

const DRY = process.argv.includes('--dry');

function normalizeName(s: string) {
  return (s || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\([^)]*\)/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\b(the|a|an|jr|sr|ii|iii)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

async function loadAll(table: 'people' | 'films', cols: string) {
  const pageSize = 1000;
  let from = 0;
  const all: any[] = [];
  for (;;) {
    const { data, error } = await db.from(table).select(cols).range(from, from + pageSize - 1);
    if (error) throw error;
    if (!data?.length) break;
    all.push(...data);
    if (data.length < pageSize) break;
    from += pageSize;
  }
  return all;
}

async function main() {
  console.log(DRY ? 'DRY RUN' : 'APPLYING');
  const films = await loadAll('films', 'id, title');
  const byTitle = new Map<string, string>();
  for (const f of films) {
    const k = normalizeName(f.title);
    if (!k || byTitle.has(k)) continue;
    byTitle.set(k, f.id);
  }

  const people = await loadAll('people', 'id, name, awards');
  let updatedPeople = 0;
  let linked = 0;
  let already = 0;
  let unmatched = 0;

  for (const person of people) {
    const awards = Array.isArray(person.awards) ? person.awards : [];
    if (!awards.length) continue;

    let dirty = false;
    const next = awards.map((a: any) => {
      if (a?.film_id) {
        already++;
        return a;
      }
      const work = String(a?.work || a?.title || '').trim();
      if (!work) return a;
      const filmId = byTitle.get(normalizeName(work));
      if (!filmId) {
        unmatched++;
        return a;
      }
      linked++;
      dirty = true;
      return { ...a, film_id: filmId, work: a.work || work };
    });

    if (!dirty) continue;
    updatedPeople++;
    if (DRY) continue;

    const { error } = await db.from('people').update({ awards: next }).eq('id', person.id);
    if (error) console.warn(`fail ${person.name}: ${error.message}`);
  }

  console.log({ updatedPeople, linked, already, unmatched, dry: DRY });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
