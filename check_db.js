const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://pkenrmorywmuvnzfoylp.supabase.co';
const supabaseAnonKey = 'sb_publishable_v-i89VcfvICnFoBDCRqVBQ_tufJb7r8';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkData() {
  console.log('Checking films...');
  const { data: films, error: fError } = await supabase.from('films').select('id, title, year').order('year', { ascending: false }).limit(10);
  if (fError) console.error('Film Error:', fError);
  console.log('Latest films:', (films || []).map(f => `${f.title} (${f.year})`));

  console.log('Checking showtimes...');
  const { count, error: sError } = await supabase.from('showtimes').select('*', { count: 'exact', head: true });
  if (sError) console.error('Showtime Error:', sError);
  console.log('Showtimes count:', count);
}

checkData();
