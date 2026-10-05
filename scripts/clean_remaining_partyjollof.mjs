import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import dns from 'node:dns';
import { Agent, setGlobalDispatcher } from 'undici';

dotenv.config({ path: '.env.local' });
dotenv.config();

const customLookup = (hostname, options, callback) => {
  if (hostname === 'pkenrmorywmuvnzfoylp.supabase.co') {
    if (options && options.all) return callback(null, [{ address: '172.64.149.246', family: 4 }]);
    return callback(null, '172.64.149.246', 4);
  }
  return dns.lookup(hostname, options, callback);
};

setGlobalDispatcher(new Agent({ connect: { lookup: customLookup, timeout: 30000 } }));

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function cleanRemainingPartyJollof() {
  console.log('🧹 Cleaning remaining dead partyjollof URLs...');

  // 1. Where poster_url has partyjollof
  const { data: pFilms, error: pErr } = await supabase
    .from('films')
    .select('id, title, poster_url')
    .ilike('poster_url', '%partyjollof%');

  if (pFilms && pFilms.length > 0) {
    console.log(`Found ${pFilms.length} films with dead partyjollof poster_url.`);
    // Update in parallel batches
    const batchSize = 20;
    for (let i = 0; i < pFilms.length; i += batchSize) {
      const batch = pFilms.slice(i, i + batchSize);
      await Promise.all(
        batch.map(f => supabase.from('films').update({
          poster_url: null,
          backdrop_url: null,
          updated_at: new Date().toISOString()
        }).eq('id', f.id))
      );
      console.log(`  Cleared posters ${i + 1} to ${Math.min(i + batchSize, pFilms.length)}`);
    }
  }

  // 2. Where backdrop_url still has partyjollof
  const { data: bFilms, error: bErr } = await supabase
    .from('films')
    .select('id, title, poster_url, backdrop_url')
    .ilike('backdrop_url', '%partyjollof%');

  if (bFilms && bFilms.length > 0) {
    console.log(`Found ${bFilms.length} films with dead partyjollof backdrop_url.`);
    const batchSize = 20;
    for (let i = 0; i < bFilms.length; i += batchSize) {
      const batch = bFilms.slice(i, i + batchSize);
      await Promise.all(
        batch.map(f => supabase.from('films').update({
          backdrop_url: f.poster_url || null,
          updated_at: new Date().toISOString()
        }).eq('id', f.id))
      );
      console.log(`  Cleaned backdrops ${i + 1} to ${Math.min(i + batchSize, bFilms.length)}`);
    }
  }

  console.log('🎉 Dead partyjollof URLs completely cleaned from database!');
}

cleanRemainingPartyJollof().catch(console.error);
