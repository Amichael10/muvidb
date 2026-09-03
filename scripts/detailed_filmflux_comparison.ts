import { supabase } from './lib/db.js';

async function detailedComparison() {
  console.log('=== ANALYZING FILMFLUX SITEMAP ===');
  const res = await fetch('https://filmflux.app/sitemap.xml', { headers: { 'user-agent': 'Mozilla/5.0' } });
  const xml = await res.text();
  const matches = xml.match(/<loc>(.*?)<\/loc>/g) || [];
  const urls = matches.map(m => m.replace(/<\/?loc>/g, ''));

  const breakdown: Record<string, number> = {
    movies: 0,
    actors: 0,
    channels: 0,
    articles: 0,
    genres: 0,
    other: 0
  };

  const sampleMovies: string[] = [];
  const sampleActors: string[] = [];
  const sampleChannels: string[] = [];

  for (const url of urls) {
    if (url.includes('/movie/')) {
      breakdown.movies++;
      if (sampleMovies.length < 5) sampleMovies.push(url);
    } else if (url.includes('/actor/')) {
      breakdown.actors++;
      if (sampleActors.length < 5) sampleActors.push(url);
    } else if (url.includes('/channel/')) {
      breakdown.channels++;
      if (sampleChannels.length < 5) sampleChannels.push(url);
    } else if (url.includes('/article/')) {
      breakdown.articles++;
    } else if (url.includes('/genre/')) {
      breakdown.genres++;
    } else {
      breakdown.other++;
    }
  }

  console.log('FilmFlux Total Sitemap URLs:', urls.length);
  console.log('FilmFlux URL Breakdown:', breakdown);

  console.log('\n=== ANALYZING OUR DATABASE (MuviDB / Lumi) ===');
  const { count: totalFilms } = await supabase.from('films').select('*', { count: 'exact', head: true });
  const { count: filmsWithYoutube } = await supabase.from('films').select('*', { count: 'exact', head: true }).not('youtube_id', 'is', null);
  const { count: totalPeople } = await supabase.from('people').select('*', { count: 'exact', head: true });
  const { count: peopleWithBio } = await supabase.from('people').select('*', { count: 'exact', head: true }).not('bio', 'is', null);
  const { count: peopleWithImage } = await supabase.from('people').select('*', { count: 'exact', head: true }).not('avatar_url', 'is', null);
  const { count: totalCredits } = await supabase.from('credits').select('*', { count: 'exact', head: true });
  const { count: totalChannels } = await supabase.from('channels').select('*', { count: 'exact', head: true });
  const { count: activeCinemas } = await supabase.from('cinemas').select('*', { count: 'exact', head: true });
  const { count: totalPlays } = await supabase.from('plays').select('*', { count: 'exact', head: true });

  console.log({
    muvidb: {
      totalFilms,
      filmsWithYoutube,
      totalPeople,
      peopleWithBio,
      peopleWithImage,
      totalCredits,
      totalChannels,
      activeCinemas,
      totalPlays
    },
    filmflux: {
      totalIndexedUrls: urls.length,
      moviesCount: breakdown.movies,
      actorsCount: breakdown.actors,
      channelsCount: breakdown.channels,
      articlesCount: breakdown.articles,
      genresCount: breakdown.genres
    }
  });

  process.exit(0);
}

detailedComparison().catch(err => {
  console.error(err);
  process.exit(1);
});
