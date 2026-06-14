import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: './.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl!, supabaseKey!);

async function run() {
  const { data: films, error } = await supabase.from('films').select(`
      id, title, source_video_id, runtime_minutes, genres, synopsis, film_genres(genre_id), credits(person_id)
    `).not('runtime_minutes', 'is', null);
  console.log(JSON.stringify(films, null, 2));
}
run();
