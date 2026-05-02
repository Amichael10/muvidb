
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const dotenv = require('dotenv');

const envLocal = fs.existsSync('.env.local') ? dotenv.parse(fs.readFileSync('.env.local')) : {};
const envDefault = fs.existsSync('.env') ? dotenv.parse(fs.readFileSync('.env')) : {};
const env = { ...envDefault, ...envLocal };

const supabaseUrl = env.VITE_SUPABASE_URL || env.SUPABASE_URL;
const supabaseKey = env.VITE_SUPABASE_ANON_KEY || env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkQueries() {
  console.log('Testing fetchInCinemasData queries...');

  // 1. Explicit flag
  const { data: cinemaMovies, error: error1 } = await supabase
    .from('films')
    .select(`id, title, source, youtube_watch_url, is_in_cinemas, countries`)
    .eq('is_in_cinemas', true)
    .neq('source', 'youtube')
    .or('youtube_watch_url.is.null,youtube_watch_url.eq.""')
    .or('source.neq.mubi,source.is.null,countries.cs.{"Nigeria"}');

  if (error1) {
    console.error('Error 1:', error1);
  } else {
    console.log(' cinemaMovies count:', cinemaMovies.length);
  }

  // 2. Showtimes
  const today = new Date().toISOString().split('T')[0];
  const { data: showtimesData, error: error2 } = await supabase
    .from('showtimes')
    .select(`
      film_id, 
      films!inner(id, title, source, youtube_watch_url, countries)
    `)
    .gte('show_date', today)
    .eq('is_available', true)
    .neq('films.source', 'youtube')
    .or('youtube_watch_url.is.null,youtube_watch_url.eq.""', { foreignTable: 'films' })
    .or('source.neq.mubi,source.is.null,countries.cs.{"Nigeria"}', { foreignTable: 'films' });

  if (error2) {
    console.error('Error 2:', error2);
  } else {
    console.log(' showtimesData count:', showtimesData.length);
  }

  // 3. Test the specific OR string for countries
  console.log('\nTesting country OR string...');
  const { data: countryTest, error: error4 } = await supabase
    .from('films')
    .select('id, title, countries')
    .or('source.neq.mubi,source.is.null,countries.cs.{Nigeria}') // Removed double quotes around Nigeria and added curly braces
    .limit(5);

  if (error4) {
    console.error('Error 4 (Nigeria):', error4);
  } else {
    console.log(' countryTest count:', countryTest.length);
  }

  // 4. Check total counts
  console.log('\nChecking total counts...');
  const { count: mubiCount } = await supabase.from('films').select('*', { count: 'exact', head: true }).eq('source', 'mubi');
  const { count: mubiNigeriaCount } = await supabase.from('films').select('*', { count: 'exact', head: true }).eq('source', 'mubi').contains('countries', ['Nigeria']);
  const { count: manualCount } = await supabase.from('films').select('*', { count: 'exact', head: true }).eq('source', 'manual');
  const { count: youtubeCount } = await supabase.from('films').select('*', { count: 'exact', head: true }).eq('source', 'youtube');
  const { count: nullSourceCount } = await supabase.from('films').select('*', { count: 'exact', head: true }).is('source', null);

  console.log(' Mubi total:', mubiCount);
  console.log(' Mubi Nigeria:', mubiNigeriaCount);
  console.log(' Manual:', manualCount);
  console.log(' YouTube:', youtubeCount);
  console.log(' Null source:', nullSourceCount);

  // Check featured films
  const { count: featuredCount } = await supabase.from('films').select('*', { count: 'exact', head: true }).eq('is_featured', true);
  console.log(' Total is_featured=true:', featuredCount);

  const { count: featuredFilteredCount } = await supabase.from('films').select('*', { count: 'exact', head: true })
    .eq('is_featured', true)
    .or('source.neq.mubi,source.is.null,countries.cs.{Nigeria}');
  console.log(' Featured films passing filter:', featuredFilteredCount);
}

checkQueries();
