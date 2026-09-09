import { serviceSupabase } from './lib/credit_consensus_verifier';

function normalizeNameKey(name: string): string {
  if (!name) return '';
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .sort()
    .join(' ');
}

function cleanExactKey(name: string): string {
  if (!name) return '';
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

async function findDuplicates() {
  console.log('🔍 Scanning people table for duplicates...');

  let allPeople: { id: string; name: string; film_count?: number; created_at?: string }[] = [];
  let page = 0;
  const pageSize = 1000;

  while (true) {
    const { data, error } = await serviceSupabase
      .from('people')
      .select('id, name, film_count, created_at')
      .range(page * pageSize, (page + 1) * pageSize - 1);

    if (error) {
      console.error('Error fetching people:', error);
      break;
    }
    if (!data || data.length === 0) break;
    allPeople = allPeople.concat(data);
    if (data.length < pageSize) break;
    page++;
  }

  console.log(`Total people loaded: ${allPeople.length}`);

  // 1. Exact Name Duplicates (case-insensitive)
  const exactMap = new Map<string, typeof allPeople>();
  for (const p of allPeople) {
    if (!p.name) continue;
    const key = cleanExactKey(p.name);
    if (!key) continue;
    if (!exactMap.has(key)) exactMap.set(key, []);
    exactMap.get(key)!.push(p);
  }

  const exactDuplicates: { name: string; records: typeof allPeople }[] = [];
  for (const [key, list] of exactMap.entries()) {
    if (list.length > 1) {
      exactDuplicates.push({ name: list[0].name, records: list });
    }
  }

  // 2. Order-insensitive & Near-Match Duplicates (e.g. "Abraham Toyin" vs "Toyin Abraham")
  const normMap = new Map<string, typeof allPeople>();
  for (const p of allPeople) {
    if (!p.name) continue;
    const key = normalizeNameKey(p.name);
    if (!key || key.split(' ').length < 2) continue; // only multi-word names
    if (!normMap.has(key)) normMap.set(key, []);
    normMap.get(key)!.push(p);
  }

  const reorderedDuplicates: { key: string; records: typeof allPeople }[] = [];
  for (const [key, list] of normMap.entries()) {
    if (list.length > 1) {
      // Check if names are actually spelled differently or just reordered
      const distinctNames = new Set(list.map(r => cleanExactKey(r.name)));
      if (distinctNames.size > 1) {
        reorderedDuplicates.push({ key, records: list });
      }
    }
  }

  console.log('\n======================================================');
  console.log(`1. EXACT DUPLICATES (Same name, multiple records): ${exactDuplicates.length} names`);
  console.log('======================================================');
  exactDuplicates.slice(0, 30).forEach((d, i) => {
    console.log(`${i + 1}. "${d.name}" -> ${d.records.length} records (IDs: ${d.records.map(r => r.id).join(', ')})`);
  });
  if (exactDuplicates.length > 30) {
    console.log(`... and ${exactDuplicates.length - 30} more exact duplicate groups.`);
  }

  console.log('\n======================================================');
  console.log(`2. REORDERED / ALIAS DUPLICATES (e.g. First Last vs Last First): ${reorderedDuplicates.length} groups`);
  console.log('======================================================');
  reorderedDuplicates.slice(0, 30).forEach((d, i) => {
    console.log(`${i + 1}. "${d.records.map(r => r.name).join('" vs "')}" (IDs: ${d.records.map(r => r.id).join(', ')})`);
  });
  if (reorderedDuplicates.length > 30) {
    console.log(`... and ${reorderedDuplicates.length - 30} more reordered groups.`);
  }

  console.log('\n======================================================');
  console.log(`SUMMARY: ${exactDuplicates.length} exact duplicate names | ${reorderedDuplicates.length} reordered/alias duplicate groups`);
  console.log('======================================================');
}

findDuplicates().catch(console.error);
