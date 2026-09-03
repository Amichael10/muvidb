import * as cheerio from 'cheerio';
import { supabase } from './lib/db.js';

async function compareWithFilmFlux() {
  console.log('================================================================');
  console.log('📊 1. FETCHING STATS FROM OUR DATABASE (MuviDB / Lumi)');
  console.log('================================================================');

  // 1. Films count & breakdown
  const { count: totalFilms, error: fErr } = await supabase
    .from('films')
    .select('*', { count: 'exact', head: true });

  const { count: nollywoodFilms } = await supabase
    .from('films')
    .select('*', { count: 'exact', head: true })
    .eq('country', 'Nigeria');

  const { count: youtubeFilms } = await supabase
    .from('films')
    .select('*', { count: 'exact', head: true })
    .not('youtube_id', 'is', null);

  const { count: cinemaFilms } = await supabase
    .from('films')
    .select('*', { count: 'exact', head: true })
    .eq('is_in_cinemas', true);

  // 2. People / Actors count
  const { count: totalPeople, error: pErr } = await supabase
    .from('people')
    .select('*', { count: 'exact', head: true });

  // 3. Credits count
  const { count: totalCredits } = await supabase
    .from('credits')
    .select('*', { count: 'exact', head: true });

  // 4. Channels count
  const { count: totalChannels } = await supabase
    .from('channels')
    .select('*', { count: 'exact', head: true });

  // 5. Plays count
  const { count: totalPlays } = await supabase
    .from('plays')
    .select('*', { count: 'exact', head: true });

  // 6. Cinemas count
  const { count: totalCinemas } = await supabase
    .from('cinemas')
    .select('*', { count: 'exact', head: true });

  // 7. Reviews / Critics count
  const { count: totalReviews } = await supabase
    .from('reviews')
    .select('*', { count: 'exact', head: true });

  // 8. Awards count
  const { count: totalAwards } = await supabase
    .from('awards')
    .select('*', { count: 'exact', head: true });

  console.log(`Total Films in MuviDB: ${totalFilms?.toLocaleString()}`);
  console.log(`  - Nollywood / Nigerian Films: ${nollywoodFilms?.toLocaleString()}`);
  console.log(`  - YouTube / Free Stream Films: ${youtubeFilms?.toLocaleString()}`);
  console.log(`  - Cinema Active Films: ${cinemaFilms?.toLocaleString()}`);
  console.log(`Total People (Actors, Directors, Producers): ${totalPeople?.toLocaleString()}`);
  console.log(`Total Credits / Film-Person Links: ${totalCredits?.toLocaleString()}`);
  console.log(`Total Tracked Channels: ${totalChannels?.toLocaleString()}`);
  console.log(`Total Stage Theatres / Plays: ${totalPlays?.toLocaleString()}`);
  console.log(`Total Cinemas: ${totalCinemas?.toLocaleString()}`);
  console.log(`Total Critic Reviews: ${totalReviews?.toLocaleString()}`);
  console.log(`Total Industry Awards: ${totalAwards?.toLocaleString()}`);

  console.log('\n================================================================');
  console.log('🌐 2. FETCHING STATS FROM FilmFlux (filmflux.app)');
  console.log('================================================================');

  // Let's check filmflux sitemaps or pages
  const targets = [
    'https://filmflux.app',
    'https://filmflux.app/actors',
    'https://filmflux.app/channels',
    'https://filmflux.app/movies',
    'https://filmflux.app/sitemap.xml'
  ];

  for (const url of targets) {
    try {
      const res = await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0' } });
      console.log(`[FilmFlux] ${url} -> Status: ${res.status}`);
      if (res.ok) {
        const text = await res.text();
        if (url.endsWith('sitemap.xml')) {
          const urls = text.match(/<loc>(.*?)<\/loc>/g) || [];
          console.log(`[FilmFlux Sitemap] Total URLs in root sitemap: ${urls.length}`);
          const sitemapFiles = urls.filter(u => u.includes('sitemap'));
          console.log(`[FilmFlux Sitemap] Sub-sitemaps:`, sitemapFiles);
        } else {
          const $ = cheerio.load(text);
          const pageTitle = $('title').text();
          console.log(`  Title: ${pageTitle}`);
          // Look for counts on the page
          const textSnippet = $('body').text().replace(/\s+/g, ' ');
          const numbers = textSnippet.match(/\d+[\d,]*\s+(?:movies|actors|channels|titles|films)/gi);
          if (numbers) {
            console.log(`  Counts found on ${url}:`, Array.from(new Set(numbers)));
          }
        }
      }
    } catch (e: any) {
      console.log(`Error checking ${url}: ${e.message}`);
    }
  }

  process.exit(0);
}

compareWithFilmFlux().catch(err => {
  console.error(err);
  process.exit(1);
});
