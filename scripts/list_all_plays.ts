import { supabase } from './lib/db';

async function listAllPlays() {
  const { data: plays } = await supabase.from('plays').select('id, title, year, playwright, director, producer, venue').order('year', { ascending: false });
  console.log(`Total plays in DB: ${plays?.length || 0}`);
  for (const p of (plays || [])) {
    console.log(`[${p.year || 'N/A'}] ${p.title} | Playwright: ${p.playwright || 'N/A'} | Director: ${p.director || 'N/A'}`);
  }
}

listAllPlays().catch(console.error);
