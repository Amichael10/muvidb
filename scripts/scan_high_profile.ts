import { supabase } from './lib/db.js';
import fs from 'fs';

async function scanMore() {
  const queries = [
    'funke akindele', 'jenifa', 'sola sobowale', 'destiny etiko', 'zubby michael',
    'patience ozokwor', 'nkem owoh', 'osuofia', 'mr ibu', 'john okafor',
    'sam loco', 'pete edochie', 'yul edochie', 'odunlade', 'femi adebayo', 'muyiwa ademola',
    'kunle afolayan', 'iyabo ojo', 'lizzy anjorin', 'mide martins',
    'afeez abiodun', 'afeez owo', 'saidi balogun', 'ronke odusanya', 'flakky',
    'kemi afolabi', 'toyin afolayan', 'lola idije', 'taiwo hassan', 'ogogo', 'yinka quadri',
    'jide kosoko', 'sikiru adesina', 'aravamu', 'dele odule', 'bolaji amusan', 'mr latin',
    'kareem adepoju', 'baba wande', 'olaniyi afonja', 'sanyeri', 'adebayo salami', 'oga bello',
    'eniola ajao', 'bukunmi oluwasina', 'bimbo ademoye', 'kehinde bankole', 'tana adelana',
    'stan nze', 'mercy johnson', 'regina daniels', 'chacha eke', 'ruth kadiri', 'eve esin',
    'ken erics', 'uchenna mbunabo', 'stephen odimgbe', 'flashboy', 'jerry williams',
    'luchy donalds', 'sonia uche', 'maurice sam', 'ebere okaro', 'ngozi ezeonu', 'chiwetalu agu',
    'kanayo', 'chika ike', 'ini edo', 'genevieve nnaji', 'omotola jalade', 'rita dominic',
    'ramsey nouah', 'jim iyke', 'desmond elliot', 'richard mofe', 'rmd', 'yemi blaq',
    'kolawole ajeyemi', 'segun ogungbe', 'omowunmi dada', 'rotimi salami', 'peju johnson',
    'victoria kolawole', 'jumoke odetola', 'biola bayo', 'abiodun jimoh',
    'yomi fabiyi', 'kemi korede', 'dayo amusa', 'ronke oshodi', 'ronke ojo', 'foluke daramola',
    'tayo sobabola', 'sotayo gaga', 'habeeb alagbe', 'ibrahim chatta', 'adeniyi johnson',
    'seyi edun', 'lateef adedimeji', 'wunmi toriola', 'kiki bakare', 'damola olatunji',
    'bukky wright', 'binta ayo mogaji', 'ayo mogaji', 'peju ogunmola', 'sunday omobolanle',
    'aluwe', 'kayode olaiya', 'apsen', 'lanre hassan', 'iya awero',
    'idowu philips', 'iya rainbow', 'margaret bandele', 'iya gbokan', 'grace oyin adejobi',
    'iya osogbo', 'fasasi omo bankole'
  ];

  console.log(`Checking ${queries.length} high-profile Nollywood figures...`);
  const results: Record<string, any[]> = {};

  // Run in parallel chunks of 15
  const chunkSize = 15;
  for (let i = 0; i < queries.length; i += chunkSize) {
    const chunk = queries.slice(i, i + chunkSize);
    await Promise.all(
      chunk.map(async (q) => {
        try {
          const { data } = await supabase
            .from('people')
            .select('id, name, slug, film_count, photo_url')
            .ilike('name', `%${q}%`);
          if (data && data.length > 0) {
            results[q] = data;
          }
        } catch (e: any) {
          console.error(`Error querying ${q}:`, e.message);
        }
      })
    );
  }

  console.log(`Matched ${Object.keys(results).length} queries. Writing results...`);
  fs.writeFileSync('scratch/high_profile_scan.json', JSON.stringify(results, null, 2));
  console.log('Saved scratch/high_profile_scan.json');
}

scanMore().catch(console.error);
