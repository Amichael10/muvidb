import { supabase } from './api/_lib/supabase.js';

async function check() {
  const { data, count, error } = await supabase.from('pending_cinema_films').select('*', { count: 'exact', head: true });
  console.log('PENDING COUNT:', count);
  console.log('ERROR:', error);
}

check().catch(console.error);
