import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function inspectPeople() {
  const queryTerms = [
    'Kemi Apesin',
    'Kemity',
    'Londoner',
    'Muyiwa Adegoke',
    'Ade-Love',
    'Adeyemi Afolayan',
    'Ogboluke',
    'Saliu Gbolagade',
    'Baba Suwe',
    'Iya Gbonkan',
    'Layi Wasabi',
    'Lilwin',
    'Itele',
    'KieKie',
    'Ijebu',
    'Baba Sala',
    'BamBam',
    'Arinaja',
    'Lola Idije',
    'Woli Agba',
    'Akabenezer',
    'Apankufor',
    'Baba Tee',
    'Morili',
    'Brainjotter',
    'Zubby Michael',
  ];

  console.log('🔍 INSPECTING EXISTING PEOPLE ROWS FOR TARGET ACTORS:\n');

  for (const term of queryTerms) {
    const { data } = await supabase
      .from('people')
      .select('*')
      .ilike('name', `%${term}%`);

    if (data && data.length > 0) {
      console.log(`Matched '${term}': ${data.length} row(s)`);
      for (const row of data) {
        console.log(`  ID: ${row.id} | Name: "${row.name}" | FilmCount: ${row.film_count} | Image: ${row.photo_url || row.image_url || row.tmdb_profile_path || row.profile_path || 'NONE'}`);
      }
    } else {
      console.log(`❌ NO MATCH FOR '${term}'`);
    }
  }
}

inspectPeople().catch(console.error);
