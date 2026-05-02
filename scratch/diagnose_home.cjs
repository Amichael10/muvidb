const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const dotenv = require('dotenv');

const envLocal = fs.existsSync('.env.local') ? dotenv.parse(fs.readFileSync('.env.local')) : {};
const envDefault = fs.existsSync('.env') ? dotenv.parse(fs.readFileSync('.env')) : {};
const env = { ...envDefault, ...envLocal };

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

async function diagnose() {
  console.log('=== HOME PAGE DATA DIAGNOSIS ===\n');

  // 1. Check is_in_cinemas films WITHOUT the youtube_watch_url filter
  const { data: allCinema, error: e1 } = await supabase
    .from('films')
    .select('id, title, source, youtube_watch_url, is_in_cinemas, countries')
    .eq('is_in_cinemas', true);
  
  console.log('1. ALL films with is_in_cinemas=true:', allCinema?.length || 0);
  if (allCinema) {
    allCinema.forEach(f => {
      console.log(`   - "${f.title}" | source=${f.source} | yt_url=${f.youtube_watch_url ? f.youtube_watch_url.substring(0, 50) : 'null'} | countries=${JSON.stringify(f.countries)}`);
    });
  }

  // 2. Check how many get filtered OUT by youtube_watch_url filter
  const { data: afterYtFilter, error: e2 } = await supabase
    .from('films')
    .select('id, title, source, youtube_watch_url')
    .eq('is_in_cinemas', true)
    .neq('source', 'youtube')
    .or('youtube_watch_url.is.null,youtube_watch_url.eq.""');

  console.log('\n2. After youtube_watch_url filter:', afterYtFilter?.length || 0);
  if (e2) console.log('   ERROR:', e2.message);
  if (afterYtFilter) {
    afterYtFilter.forEach(f => {
      console.log(`   - "${f.title}" | source=${f.source} | yt_url=${f.youtube_watch_url || 'null'}`);
    });
  }

  // 3. Check what the frontend double-check would do
  if (allCinema) {
    const afterFrontendFilter = allCinema.filter(f => {
      const isYoutube = f.source === 'youtube' || (f.youtube_watch_url && f.youtube_watch_url.length > 5);
      return !isYoutube;
    });
    console.log('\n3. After frontend isYoutube double-check:', afterFrontendFilter.length);
    afterFrontendFilter.forEach(f => {
      console.log(`   - "${f.title}"`);
    });

    // Show which ones get filtered out
    const removed = allCinema.filter(f => {
      const isYoutube = f.source === 'youtube' || (f.youtube_watch_url && f.youtube_watch_url.length > 5);
      return isYoutube;
    });
    if (removed.length > 0) {
      console.log('\n   REMOVED by frontend filter:');
      removed.forEach(f => {
        console.log(`   ❌ "${f.title}" | source=${f.source} | yt_url=${f.youtube_watch_url}`);
      });
    }
  }

  // 4. Featured films
  const { data: featured } = await supabase
    .from('films')
    .select('id, title, poster_url, backdrop_url, source, is_featured')
    .eq('is_featured', true)
    .or('source.neq.mubi,source.is.null,countries.cs.{"Nigeria"}');

  console.log('\n4. Featured films (hero):', featured?.length || 0);
  if (featured) {
    featured.forEach(f => {
      console.log(`   - "${f.title}" | has_poster=${!!f.poster_url} | has_backdrop=${!!f.backdrop_url}`);
    });
  }

  // 5. Recently added / YouTube feed
  const { data: recent } = await supabase
    .from('films')
    .select('id, title, source, created_at')
    .or('source.neq.mubi,source.is.null,countries.cs.{"Nigeria"}')
    .order('created_at', { ascending: false })
    .limit(10);

  console.log('\n5. Recently Added (top 10):', recent?.length || 0);
  if (recent) {
    recent.forEach(f => {
      console.log(`   - "${f.title}" | source=${f.source} | created=${f.created_at}`);
    });
  }

  // 6. New releases (2026)
  const { data: newRel } = await supabase
    .from('films')
    .select('id, title, year, source')
    .eq('year', 2026)
    .or('source.neq.mubi,source.is.null,countries.cs.{"Nigeria"}')
    .order('created_at', { ascending: false })
    .limit(10);

  console.log('\n6. New Releases (2026):', newRel?.length || 0);

  // 7. Coming soon
  const { data: coming } = await supabase
    .from('films')
    .select('id, title, coming_soon, status')
    .or('coming_soon.eq.true,status.ilike.announced')
    .or('source.neq.mubi,source.is.null,countries.cs.{"Nigeria"}')
    .limit(10);

  console.log('\n7. Coming Soon:', coming?.length || 0);

  // 8. Check the REAL problem - cinema films that have youtube_watch_url set
  const { data: cinemaWithYt } = await supabase
    .from('films')
    .select('id, title, source, youtube_watch_url, is_in_cinemas')
    .eq('is_in_cinemas', true)
    .not('youtube_watch_url', 'is', null);

  console.log('\n8. Cinema films WITH youtube_watch_url:', cinemaWithYt?.length || 0);
  if (cinemaWithYt) {
    cinemaWithYt.forEach(f => {
      console.log(`   ⚠️ "${f.title}" | source=${f.source} | yt_url=${f.youtube_watch_url}`);
    });
  }

  console.log('\n=== DIAGNOSIS COMPLETE ===');
}

diagnose().catch(console.error);
