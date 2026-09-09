import { serviceSupabase } from './lib/credit_consensus_verifier';

async function findSingleNames() {
  console.log('Querying people table for single-word names...');

  let allPeople: { id: string; name: string; film_count?: number }[] = [];
  let page = 0;
  const pageSize = 1000;

  while (true) {
    const { data, error } = await serviceSupabase
      .from('people')
      .select('id, name, film_count')
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

  console.log(`Total people in DB: ${allPeople.length}`);

  // Filter single-word names
  const singleNamePeople = allPeople.filter(p => {
    if (!p.name) return false;
    const parts = p.name.trim().split(/\s+/);
    return parts.length === 1 && p.name.trim().length >= 2;
  });

  singleNamePeople.sort((a, b) => a.name.localeCompare(b.name));

  console.log(`\nFound ${singleNamePeople.length} single-word name records in people table.\n`);

  // Common crew titles that were accidentally inserted as names
  const crewTitleWords = new Set([
    'gaffer', 'gaffers', 'sound', 'editor', 'director', 'producer', 'camera',
    'cinematographer', 'continuity', 'lighting', 'costume', 'costumier', 'makeup',
    'props', 'set', 'writer', 'screenplay', 'dop', 'audio', 'boom', 'light', 'cast',
    'crew', 'driver', 'welfare', 'location', 'production', 'post', 'music', 'score',
    'colorist', 'effects', 'vfx', 'stunt', 'electrician', 'art', 'caterer', 'artist',
    'still', 'photographer', 'bts', 'unit', 'manager', 'assistant', 'lead', 'star'
  ]);

  const crewRoleNames: typeof allPeople = [];
  const validOrTruncatedNames: typeof allPeople = [];

  for (const p of singleNamePeople) {
    const lower = p.name.toLowerCase().trim();
    if (crewTitleWords.has(lower)) {
      crewRoleNames.push(p);
    } else {
      validOrTruncatedNames.push(p);
    }
  }

  console.log('======================================================');
  console.log(`1. CREW JOB TITLES STORED AS NAMES (${crewRoleNames.length} items):`);
  console.log('======================================================');
  console.log(crewRoleNames.map(p => `"${p.name}" (id: ${p.id})`).join(', '));

  console.log('\n======================================================');
  console.log(`2. SINGLE FIRST NAMES / MONONYMS (${validOrTruncatedNames.length} items):`);
  console.log('======================================================');
  
  // Group by first letter
  const grouped: Record<string, string[]> = {};
  for (const p of validOrTruncatedNames) {
    const letter = p.name.charAt(0).toUpperCase();
    if (!grouped[letter]) grouped[letter] = [];
    grouped[letter].push(p.name);
  }

  for (const letter of Object.keys(grouped).sort()) {
    console.log(`[${letter}]: ${grouped[letter].join(', ')}`);
  }

  console.log('\n======================================================');
  console.log(`TOTAL SINGLE NAMES: ${singleNamePeople.length}`);
  console.log('======================================================');
}

findSingleNames().catch(console.error);
