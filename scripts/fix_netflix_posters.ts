import './dotenv_init.js';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

function sleep(ms: number) {
  return new Promise(r => setTimeout(r, ms));
}

async function callSupabaseWithRetry<T>(fn: () => Promise<{ data: T | null; error: any }>, retries = 5, delay = 2000): Promise<T | null> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const { data, error } = await fn();
      if (error) {
        const msg = (error.message || '').toLowerCase();
        if (msg.includes('fetch failed') || msg.includes('timeout') || error.code === '40001' || error.status === 503) {
          throw error;
        }
        console.error(`❌ DB Error: ${error.message}`);
        return null;
      }
      return data;
    } catch (e: any) {
      if (attempt === retries) throw e;
      console.warn(`⚠️ [Attempt ${attempt}/${retries}] Supabase call failed: ${e.message}. Retrying in ${delay / 1000}s...`);
      await sleep(delay);
      delay *= 1.5;
    }
  }
  throw new Error('Retries exhausted');
}

async function run() {
  console.log('🔍 Fetching films with missing poster_url but existing backdrop_url...');
  
  // Fetch films where poster_url is null or empty
  const data = await callSupabaseWithRetry<any[]>(async () => {
    return await supabase
      .from('films')
      .select('id, title, poster_url, backdrop_url, source')
      .or('poster_url.is.null,poster_url.eq.""');
  });

  if (!data) {
    console.error('❌ Error fetching films or no data returned.');
    return;
  }

  // Filter for films that have a non-empty backdrop_url
  const targets = data.filter(f => f.backdrop_url && f.backdrop_url.trim() !== '');

  console.log(`📊 Found ${targets.length} films missing poster_url but having backdrop_url.`);
  
  let updatedCount = 0;
  for (const film of targets) {
    await callSupabaseWithRetry(async () => {
      const res = await supabase
        .from('films')
        .update({ poster_url: film.backdrop_url })
        .eq('id', film.id);
      return { data: null, error: res.error };
    });
      
    updatedCount++;
    console.log(`✓ Updated "${film.title}" (${film.source})`);
  }
  
  console.log(`\n🎉 Successfully updated ${updatedCount} films.`);
}

run().catch(e => {
  console.error('Fatal execution error:', e);
  process.exit(1);
});


