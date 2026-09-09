import { supabase } from './lib/db.js';

async function check() {
  const queries = [
    'bimpe', 'adedimeji', 'oyebade', 'aimakhu', 'abraham', 'faithia', 'balogun', 'williams', 
    'mercy aigbe', 'gentry', 'adeoti', 'biodun okeowo', 'omoborty', 'funke akindele', 'bello', 
    'sola sobowale', 'regina daniels', 'destiny etiko', 'zubby', 'patience ozokwor', 'mama g', 
    'chinedu ikedieze', 'osita iheme', 'nkem owoh', 'osuofia', 'mr ibu', 'john okafor', 
    'charles inojie', 'sam loco', 'pete edochie', 'yul edochie', 'odunlade', 'femi adebayo', 
    'muyiwa ademola', 'kunle afolayan', 'tunde kelani', 'iyabo ojo', 'lizzy anjorin', 'mide martins', 
    'afeez abiodun', 'saidi balogun', 'mo bimpe', 'ronke odusanya', 'flakky', 'kemi afolabi',
    'toyin afolayan', 'lola idije', 'taiwo hassan', 'ogogo', 'yinka quadri', 'jide kosoko',
    'sikiru adesina', 'aravamu', 'dele odule', 'bolaji amusan', 'mr latin', 'kareem adepoju',
    'baba wande', 'olaniyi afonja', 'sanyeri', 'adebayo salami', 'oga bello', 'eniola ajao',
    'bukunmi oluwasina', 'bimbo ademoye', 'kehinde bankole', 'tana adelana', 'stan nze'
  ];

  for (const q of queries) {
    const { data, error } = await supabase
      .from('people')
      .select('id, name, slug, film_count')
      .ilike('name', `%${q}%`)
      .limit(10);

    if (data && data.length > 0) {
      console.log(`\n=== QUERY: "${q}" (Count: ${data.length}) ===`);
      for (const d of data) {
        console.log(`  [${d.id}] "${d.name}" | films: ${d.film_count || 0}`);
      }
    }
  }
}

check().then(() => console.log('Done!')).catch(console.error);
