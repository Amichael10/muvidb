import { supabase } from './lib/db';

async function main() {
  console.log('=== Consolidating Anikulapo: Rise of the Spectre Series & Episodes ===');

  const canonicalSlug = 'anikulapo-rise-of-the-spectre';

  // 1. Fetch all series rows
  const { data: rows } = await supabase
    .from('films')
    .select('id, slug, title')
    .ilike('slug', '%anikulapo-rise-of-the-spectre%')
    .is('episode_number', null);

  console.log('Found series master candidates:', rows);

  let canonicalId = '3c0bb840-7942-4aa0-9dc5-6faf7f2955d2';

  const seriesPayload = {
    title: 'Aníkúlápó: Rise of the Spectre',
    original_title: 'Aníkúlápó: Rise of the Spectre',
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
    slug: canonicalSlug,
  };

  // Update canonical series row
  await supabase.from('films').update(seriesPayload).eq('id', canonicalId);
  console.log(`✓ Updated canonical series row: ${canonicalId}`);

  // 2. Point all 6 episodes to this canonical series ID
  const { data: updatedEps, error: epErr } = await supabase
    .from('films')
    .update({ series_id: canonicalId })
    .ilike('slug', 'anikulapo-rise-of-the-spectre-s01e%')
    .select('id, title, episode_number');

  if (epErr) console.error('Error updating episodes:', epErr.message);
  else console.log(`✓ Linked ${updatedEps?.length || 0} episodes to canonical series ID ${canonicalId}`);

  // 3. Delete extra duplicate series stubs
  const dupsToDelete = ['0502c3e6-52db-4204-aea2-4dd8d83e2118', '1a7cc1be-194c-4c57-96a9-532084d85b38'];
  for (const dupId of dupsToDelete) {
    if (dupId !== canonicalId) {
      await supabase.from('credits').delete().eq('film_id', dupId);
      await supabase.from('films').delete().eq('id', dupId);
      console.log(`✓ Removed duplicate stub series ${dupId}`);
    }
  }

  // 4. Attach full cast to canonical series
  const { data: movieCredits } = await supabase
    .from('credits')
    .select('person_id, role, character_name, billing_order, source')
    .eq('film_id', 'c2a507aa-69a7-4592-8306-5c8a844b82a9');

  if (movieCredits && movieCredits.length > 0) {
    const seriesCredits = movieCredits.map((c) => ({
      ...c,
      film_id: canonicalId,
    }));
    await supabase.from('credits').delete().eq('film_id', canonicalId);
    await supabase.from('credits').insert(seriesCredits);
    console.log(`✓ Copied ${seriesCredits.length} credits to canonical series master`);
  }

  console.log('\n🎉 Consolidation complete!');
}

main().catch(console.error);
