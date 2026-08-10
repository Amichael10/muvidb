import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

async function testDistributorStorage() {
  const { data: films, error: fetchErr } = await supabase.from('films').select('id, title, streaming_links').limit(1);
  if (fetchErr || !films || films.length === 0) {
    console.error('Fetch error:', fetchErr);
    return;
  }

  const film = films[0];
  const updatedLinks = {
    ...(film.streaming_links || {}),
    distributor: 'FilmOne Entertainment'
  };

  const { data, error } = await supabase
    .from('films')
    .update({ streaming_links: updatedLinks })
    .eq('id', film.id)
    .select('id, title, streaming_links');

  if (error) {
    console.error('Update error:', error.message);
  } else {
    console.log('✅ Successfully stored distributor inside streaming_links:', data[0].streaming_links.distributor);
  }
}

testDistributorStorage();
