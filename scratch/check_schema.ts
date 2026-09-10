import { supabase } from '../scripts/lib/db.js';

async function checkSchema() {
  const { data } = await supabase.from('films').select('release_type').limit(20);
  console.log('Sample release_types:', data);
  
  // Count how many films have release_type = 'cinema' with no box office and no showtimes
  const { count: cinemaCount } = await supabase.from('films').select('id', { count: 'exact', head: true }).eq('release_type', 'cinema');
  console.log('Total cinema release_type:', cinemaCount);

  // Check films where release_type is null
  const { count: nullCount } = await supabase.from('films').select('id', { count: 'exact', head: true }).is('release_type', null);
  console.log('Total null release_type:', nullCount);

  // Check how many have box office
  const { count: boCount } = await supabase.from('films').select('id', { count: 'exact', head: true }).eq('release_type', 'cinema').not('box_office_domestic', 'is', null);
  console.log('Cinema with box office:', boCount);
}
checkSchema().catch(console.error);
