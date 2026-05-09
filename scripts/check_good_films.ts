
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkRecentGoodFilms() {
  const { data: films, error } = await supabase
    .from('films')
    .select('title, poster_url, synopsis, created_at')
    .not('synopsis', 'is', null)
    .not('poster_url', 'is', null)
    .order('created_at', { ascending: false })
    .limit(5);
    
  if (error) {
    console.error('Error fetching films:', error);
    return;
  }

  console.log('Recent "Good" Films:');
  films.forEach(f => {
    console.log(`- ${f.title} (Created: ${f.created_at})`);
    console.log(`  Poster: ${f.poster_url?.substring(0, 50)}...`);
    console.log(`  Synopsis: ${f.synopsis?.substring(0, 100)}...`);
  });
}

checkRecentGoodFilms();
