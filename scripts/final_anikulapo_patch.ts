import { supabase } from './lib/db';

async function main() {
  console.log('=== Final Anikulapo IMDb & TMDB Metadata Alignment ===');

  // 1. Movie: Aníkúlápó (2022)
  const movieId = 'c2a507aa-69a7-4592-8306-5c8a844b82a9';
  await supabase.from('films').update({
    title: 'Aníkúlápó',
    original_title: 'Aníkúlápó',
    slug: 'anikulapo',
    tagline: 'He who has death in his pouch.',
    year: 2022,
    release_date: '2022-09-30',
    runtime_minutes: 142,
    content_type: 'movie',
    poster_url: 'https://image.tmdb.org/t/p/original/xb30hkUpBm23stnVgDJGYGsC0R0.jpg',
    backdrop_url: 'https://image.tmdb.org/t/p/original/gCojEROJs4JUVCCMA4fDFGc8OFc.jpg',
    imdb_id: 'tt21432050',
    imdb_rating: 6.2,
    imdb_vote_count: 3200,
    tmdb_id: 1023994,
    tmdb_rating: 7.1,
    tmdb_vote_count: 48,
    liked_percent: 74,
    genres: ['Drama', 'Fantasy', 'Romance', 'Epic'],
    language: 'Yoruba',
    languages: ['Yoruba', 'English'],
    countries: ['Nigeria'],
    synopsis: 'After an affair with a queen leads to his demise, an eager traveler encounters a mystical bird with the power to give him another life, rising to prominence as a legendary resurrection healer before pride and greed test his fate.',
    release_type: 'netflix',
    streaming_links: {
      netflix: 'https://www.netflix.com/title/81446132',
      netflix_watch: 'https://www.netflix.com/watch/81446132',
    },
    is_nollywood: true,
    is_published: true,
  }).eq('id', movieId);
  console.log('✓ Updated 2022 movie metadata');

  // 2. Series Master: Aníkúlápó: Rise of the Spectre (2024)
  const seriesId = '3c0bb840-7942-4aa0-9dc5-6faf7f2955d2';
  await supabase.from('films').update({
    title: 'Aníkúlápó: Rise of the Spectre',
    original_title: 'Aníkúlápó: Rise of the Spectre',
    slug: 'anikulapo-rise-of-the-spectre',
    tagline: 'Death is only the beginning.',
    year: 2024,
    release_date: '2024-03-01',
    runtime_minutes: 58,
    content_type: 'series',
    season_count: 1,
    episode_count: 6,
    poster_url: 'https://image.tmdb.org/t/p/original/3HO233WHsznGviXEVOGMozSa996.jpg',
    backdrop_url: 'https://image.tmdb.org/t/p/original/2tQ5jSU5ECydgJUJZjYyDDKUmsd.jpg',
    imdb_id: 'tt31078762',
    imdb_rating: 6.5,
    imdb_vote_count: 1850,
    tmdb_id: 247569,
    tmdb_rating: 7.2,
    tmdb_vote_count: 34,
    liked_percent: 77,
    genres: ['Drama', 'Fantasy', 'Action', 'Epic'],
    language: 'Yoruba',
    languages: ['Yoruba', 'English'],
    countries: ['Nigeria'],
    synopsis: 'In a high-stakes sequel series, traveler Saro returns from the spirit realm to Ojumo with orders to complete a nearly impossible spiritual task, sparking royal betrayals, ghost wars, and mystical turmoil across the Yoruba kingdoms.',
    release_type: 'netflix',
    streaming_links: {
      netflix: 'https://www.netflix.com/title/81678121',
      netflix_watch: 'https://www.netflix.com/watch/81678121',
    },
    is_nollywood: true,
    is_published: true,
  }).eq('id', seriesId);
  console.log('✓ Updated 2024 series master metadata');

  console.log('Done!');
}

main().catch(console.error);
