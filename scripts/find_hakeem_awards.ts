import 'dotenv/config';
import { supabase } from './lib/db';

async function findAwards() {
  console.log('Searching films with awards mentioning Makeup / Hakeem / Effect / Bamgboye...');
  
  const { data: filmsWithAwards, error } = await supabase
    .from('films')
    .select('id, title, year, awards')
    .not('awards', 'eq', '[]');

  console.log(`Found ${filmsWithAwards?.length || 0} films with awards.`);

  for (const f of filmsWithAwards || []) {
    const awards = Array.isArray(f.awards) ? f.awards : [];
    for (const a of awards) {
      const aStr = JSON.stringify(a).toLowerCase();
      if (aStr.includes('makeup') || aStr.includes('make-up') || aStr.includes('hakeem') || aStr.includes('onilogbo') || aStr.includes('effect') || aStr.includes('bamgboye') || aStr.includes('bamigboye')) {
        console.log(`🎬 Film: "${f.title}" (${f.year}) | Award:`, a);
      }
    }
  }
}

findAwards();
