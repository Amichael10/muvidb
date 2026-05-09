import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkHealth() {
  const { count: emptySynopsis } = await supabase.from('films').select('*', { count: 'exact', head: true }).or('synopsis.is.null,synopsis.eq.""');
  const { count: emptyPoster } = await supabase.from('films').select('*', { count: 'exact', head: true }).or('poster_url.is.null,poster_url.eq.""');
  const { count: totalFilms } = await supabase.from('films').select('*', { count: 'exact', head: true });
  
  console.log(`📊 Total Films: ${totalFilms}`);
  console.log(`📝 Films with empty synopsis: ${emptySynopsis}`);
  console.log(`🖼️ Films with empty poster: ${emptyPoster}`);

  // Check for duplicate actors (simple name match)
  const { data: people } = await supabase.from('people').select('name');
  const names = people?.map(p => p.name) || [];
  const nameCounts = names.reduce((acc, name) => {
    acc[name] = (acc[name] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const duplicates = Object.entries(nameCounts).filter(([_, count]) => count > 1);
  console.log(`👥 Duplicate names in people table: ${duplicates.length}`);
  if (duplicates.length > 0) {
    console.log('Sample duplicates:', duplicates.slice(0, 5));
  }
}

checkHealth();
