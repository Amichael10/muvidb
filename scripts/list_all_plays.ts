import { supabase } from './lib/db';

async function listAllPlays() {
  const { data: plays, error } = await supabase
    .from('plays')
    .select('id, title, slug, venue, year, status')
    .order('title', { ascending: true });

  if (error) {
    console.error('Error fetching plays:', error);
    return;
  }

  console.log(`Total plays in database: ${plays.length}`);
  plays.forEach(p => console.log(`- [${p.year || 'TBA'}] "${p.title}" (slug: ${p.slug})`));
}

listAllPlays().catch(console.error);
