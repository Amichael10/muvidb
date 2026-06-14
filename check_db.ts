import { supabase } from './api/_lib/supabase.js';

async function check() {
  const { data: cinemas } = await supabase.from('cinemas').select('id, name, scrape_enabled, scrape_config, scrape_last_error').eq('scrape_adapter', 'veezi');
  console.log('CINEMAS:');
  console.dir(cinemas, { depth: null });

  const { data: pending } = await supabase.from('pending_cinema_films').select('title, source, showtime_count, admin_decision, last_seen_at').order('last_seen_at', { ascending: false }).limit(20);
  console.log('\nPENDING:');
  console.dir(pending, { depth: null });
}

check().catch(console.error);
