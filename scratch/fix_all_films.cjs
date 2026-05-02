const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const dotenv = require('dotenv');

const envLocal = fs.existsSync('.env.local') ? dotenv.parse(fs.readFileSync('.env.local')) : {};
const envDefault = fs.existsSync('.env') ? dotenv.parse(fs.readFileSync('.env')) : {};
const env = { ...envDefault, ...envLocal };

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

function cleanTitle(raw) {
  if (!raw) return raw;
  let title = raw.trim();
  title = title.replace(/\s*\/\s*[A-Z]{2,5}\.?\s*\/?\s*$/i, '');
  title = title.replace(/\s+[-–—]\s*Watch\s+.*/i, '');
  title = title.replace(/\s+[-–—]\s*LATEST\s*.*/i, '');
  title = title.replace(/\s+[-–—]s\s*NEW\s*$/i, '');
  title = title.replace(/\s*#\w+/g, '');
  title = title.replace(/\s+[-–—]\s+Nigerian\s*.*/i, '');
  title = title.replace(/\s+[-–—]\s+Nollywood\s*.*/i, '');
  title = title.replace(/\s+[-–—]\s+African\s*.*/i, '');
  title = title.replace(/\s+[-–—]Nigerian\s*.*/i, '');
  title = title.replace(/\s+[-–—]Nollywood\s*.*/i, '');
  title = title.replace(/\s+[-–—]African\s*.*/i, '');
  title = title.replace(/\s*Latest\s*(Nigerian|Nollywood|Yoruba|Igbo)?\s*(Epic\s*)?(New\s*)?(Drama\s*)?(Movie|Film|Movies|Films)s?\s*$/i, '');
  title = title.replace(/\s+[-–—]\s+[A-Z][a-z]+\s+[A-Z][a-z]+\s*[\/,]\s*[A-Z].*$/i, '');
  title = title.replace(/\s*(Full|Complete)\s*(Movie|Film|Season)\s*$/i, '');
  title = title.replace(/\s*\|\s*(Moments with Mo|MWM)\s*$/i, '');
  title = title.replace(/\s*\(Latest\s*(Comedy\s*)?(Drama\s*)?(Action\s*)?(Movie|Film|Movies|Films)\s*\)\s*$/i, '');
  if (title.length > 80) {
    const dashParts = title.split(/\s+[-–—]\s+/);
    if (dashParts[0].length >= 3 && dashParts[0].length <= 70) {
      title = dashParts[0];
    }
  }
  title = title.replace(/\s{2,}/g, ' ').trim();
  title = title.replace(/\s*[,|]\s*$/, '').trim();
  title = title.replace(/\s+[-–—]\s*$/, '').trim();
  return title;
}

async function fetchAll(query) {
  // Paginate through all results in batches of 1000
  let all = [];
  let from = 0;
  const batchSize = 1000;
  while (true) {
    const { data, error } = await query.range(from, from + batchSize - 1);
    if (error) { console.error('Fetch error:', error.message); break; }
    if (!data || data.length === 0) break;
    all = all.concat(data);
    if (data.length < batchSize) break;
    from += batchSize;
  }
  return all;
}

async function run() {
  console.log('=== BATCH FIX (all remaining) ===\n');

  // ── Part 1: Backdrops ──
  console.log('── Fixing missing backdrops ──');
  let backdropFixed = 0;
  let from = 0;
  while (true) {
    const { data, error } = await supabase
      .from('films')
      .select('id, title, poster_url')
      .not('poster_url', 'is', null)
      .neq('poster_url', '')
      .or('backdrop_url.is.null,backdrop_url.eq.""')
      .range(from, from + 999);
    
    if (error) { console.error('Error:', error.message); break; }
    if (!data || data.length === 0) break;
    
    console.log(`  Batch from ${from}: ${data.length} films`);
    
    for (const film of data) {
      const { error: ue } = await supabase
        .from('films')
        .update({ backdrop_url: film.poster_url })
        .eq('id', film.id);
      if (!ue) backdropFixed++;
    }
    
    if (data.length < 1000) break;
    from += 1000;
  }
  console.log(`✅ Fixed ${backdropFixed} backdrops total.\n`);

  // ── Part 2: Titles ──
  console.log('── Fixing YouTube titles ──');
  let titleFixed = 0;
  from = 0;
  while (true) {
    const { data, error } = await supabase
      .from('films')
      .select('id, title, youtube_watch_url')
      .not('youtube_watch_url', 'is', null)
      .neq('youtube_watch_url', '')
      .range(from, from + 999);
    
    if (error) { console.error('Error:', error.message); break; }
    if (!data || data.length === 0) break;
    
    console.log(`  Batch from ${from}: ${data.length} films`);
    
    for (const film of data) {
      const cleaned = cleanTitle(film.title);
      if (cleaned !== film.title) {
        const { error: ue } = await supabase
          .from('films')
          .update({ title: cleaned })
          .eq('id', film.id);
        if (!ue) titleFixed++;
      }
    }
    
    if (data.length < 1000) break;
    from += 1000;
  }
  console.log(`✅ Fixed ${titleFixed} titles total.\n`);

  console.log('=== ALL DONE ===');
}

run().catch(console.error);
