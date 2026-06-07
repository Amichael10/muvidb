import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  (process.env.VITE_SUPABASE_URL || '').trim(),
  (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim()
);

const DRAMA_GENRE_ID = '8c5383fd-3fec-458c-9ddb-6fbd8485eabc';

async function main() {
  console.log('Fetching all films...');
  
  let allFilms: any[] = [];
  let from = 0;
  let step = 1000;
  while (true) {
    const { data, error } = await supabase.from('films').select('id').order('id').range(from, from + step - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    allFilms.push(...data);
    from += step;
  }
  
  console.log('Fetching all film_genres...');
  let allFilmGenres: any[] = [];
  from = 0;
  while (true) {
    const { data, error } = await supabase.from('film_genres').select('film_id').order('film_id').range(from, from + step - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    allFilmGenres.push(...data);
    from += step;
  }
  
  const filmsWithGenres = new Set(allFilmGenres.map((fg: any) => fg.film_id));
  const filmsMissingGenres = allFilms.filter((f: any) => !filmsWithGenres.has(f.id));
  
  console.log(`Found ${filmsMissingGenres.length} films missing genres.`);
  
  if (filmsMissingGenres.length === 0) return;
  
  const toInsert = filmsMissingGenres.map((f: any) => ({
    film_id: f.id,
    genre_id: DRAMA_GENRE_ID
  }));
  
  let inserted = 0;
  for (const item of toInsert) {
    const { error: insertError } = await supabase.from('film_genres').insert(item);
    if (insertError) {
      if (insertError.code !== '23505') {
        console.error('Error inserting genre:', insertError);
      }
    } else {
      inserted++;
    }
  }
  console.log(`✅ Successfully mapped ${inserted} missing films to "Drama".`);
}

main();
