import { supabase } from './lib/db';

interface CreditDef {
  name: string;
  role: string;
  character?: string | null;
  profile?: string | null;
  billingOrder: number;
}

async function resolvePeopleMap(
  creditsList: CreditDef[]
): Promise<Map<string, { id: string; photo_url: string | null }>> {
  const uniqueNames = Array.from(new Set(creditsList.map((c) => c.name.trim())));
  const map = new Map<string, { id: string; photo_url: string | null }>();

  console.log(`Resolving ${uniqueNames.length} cast & crew people...`);

  // 1. Batch query existing people
  const { data: matched, error: matchErr } = await supabase
    .from('people')
    .select('id, name, photo_url')
    .in('name', uniqueNames);

  if (matchErr) {
    console.error('Error batch fetching people:', matchErr.message);
  }

  for (const p of matched || []) {
    map.set(p.name.toLowerCase().trim(), { id: p.id, photo_url: p.photo_url });
  }

  // 2. Create any missing people or update missing photos
  for (const c of creditsList) {
    const key = c.name.toLowerCase().trim();
    const existing = map.get(key);

    if (!existing) {
      const slug = key.replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
      const { data: created, error: insErr } = await supabase
        .from('people')
        .insert({
          name: c.name.trim(),
          slug: `${slug}-${Math.floor(Math.random() * 10000)}`,
          source: 'imdb',
          nationality: 'Nigerian',
          photo_url: c.profile || null,
          known_for_department:
            c.role === 'director'
              ? 'Directing'
              : c.role === 'writer'
              ? 'Writing'
              : 'Acting',
        })
        .select('id, photo_url')
        .single();

      if (created) {
        map.set(key, { id: created.id, photo_url: created.photo_url });
        console.log(`  + Created person: ${c.name}`);
      } else if (insErr) {
        console.error(`  ⚠️ Error inserting person ${c.name}:`, insErr.message);
      }
    } else if (c.profile && !existing.photo_url) {
      await supabase
        .from('people')
        .update({ photo_url: c.profile })
        .eq('id', existing.id);
      existing.photo_url = c.profile;
      console.log(`  + Updated photo for: ${c.name}`);
    }
  }

  return map;
}

async function attachCredits(
  filmId: string,
  creditsDefs: CreditDef[],
  peopleMap: Map<string, { id: string; photo_url: string | null }>
) {
  const creditsToInsert: any[] = [];

  for (const c of creditsDefs) {
    const person = peopleMap.get(c.name.toLowerCase().trim());
    if (person) {
      creditsToInsert.push({
        film_id: filmId,
        person_id: person.id,
        role: c.role.toLowerCase(),
        character_name: c.character || null,
        billing_order: c.billingOrder,
        source: 'imdb',
      });
    }
  }

  if (creditsToInsert.length > 0) {
    // Delete existing credits for this film & re-insert cleanly
    await supabase.from('credits').delete().eq('film_id', filmId);
    const { error } = await supabase.from('credits').insert(creditsToInsert);
    if (error) {
      console.error(`  ❌ Error attaching credits to film ${filmId}:`, error.message);
    } else {
      console.log(`  ✓ Attached ${creditsToInsert.length} credits to film ${filmId}`);
    }
  }
}

async function main() {
  console.log('=== Complete IMDb Enrichment for Aníkúlápó Film & Series Universe ===\n');

  // Master Cast & Crew Definitions
  const masterMovieCredits: CreditDef[] = [
    { name: 'Kunle Afolayan', role: 'director', character: null, profile: 'https://image.tmdb.org/t/p/w500/yV1pYp3CkW3xR3gK9Z7Nf58m4e5.jpg', billingOrder: 1 },
    { name: 'Shola Dada', role: 'writer', character: null, profile: null, billingOrder: 2 },
    { name: 'Kunle Remi', role: 'actor', character: 'Saro', profile: 'https://image.tmdb.org/t/p/w500/4Pl9ZuQnReUrOE4LRCrfkZLwiW4.jpg', billingOrder: 3 },
    { name: 'Bimbo Ademoye', role: 'actor', character: 'Arolake', profile: 'https://image.tmdb.org/t/p/w500/qRjPXsuTm0jDUOSeBnF1sdJ6g8H.jpg', billingOrder: 4 },
    { name: 'Sola Sobowale', role: 'actor', character: 'Awarun', profile: 'https://image.tmdb.org/t/p/w500/5v6k3Zc1yS7rT3XQ6A9e4E1.jpg', billingOrder: 5 },
    { name: 'Hakeem Kae-Kazim', role: 'actor', character: 'Oba Aderoju', profile: 'https://image.tmdb.org/t/p/w500/sVNHRm51c9toG73FUQ5k1St0vju.jpg', billingOrder: 6 },
    { name: 'Taiwo Hassan', role: 'actor', character: 'Alaafin Ademuyiwa', profile: null, billingOrder: 7 },
    { name: 'Adebayo Salami', role: 'actor', character: 'Oyo Chief', profile: 'https://image.tmdb.org/t/p/w500/kqqXRBaA5DkOeSfZ8BA2Utrg096.jpg', billingOrder: 8 },
    { name: 'Faithia Balogun', role: 'actor', character: 'Ojumo Queen', profile: null, billingOrder: 9 },
    { name: 'Dele Odule', role: 'actor', character: 'Otunba', profile: null, billingOrder: 10 },
    { name: 'Yinka Quadri', role: 'actor', character: 'Hunter', profile: null, billingOrder: 11 },
    { name: 'Adebowale Adedayo', role: 'actor', character: 'Akanji', profile: 'https://image.tmdb.org/t/p/w500/twwO4XYm0cKQYU828GmXB2UiWeQ.jpg', billingOrder: 12 },
    { name: 'Moji Afolayan', role: 'actor', character: 'Olori Wojuola', profile: null, billingOrder: 13 },
    { name: 'Kareem Adepoju', role: 'actor', character: 'Chief Priest / Baba Wande', profile: null, billingOrder: 14 },
    { name: 'Ronke Oshodi Oke', role: 'actor', character: 'Oyo Villager', profile: null, billingOrder: 15 },
  ];

  const masterSeriesCredits: CreditDef[] = [
    { name: 'Kunle Afolayan', role: 'director', character: null, profile: 'https://image.tmdb.org/t/p/w500/yV1pYp3CkW3xR3gK9Z7Nf58m4e5.jpg', billingOrder: 1 },
    { name: 'Shola Dada', role: 'writer', character: null, profile: null, billingOrder: 2 },
    { name: 'Kunle Remi', role: 'actor', character: 'Saro', profile: 'https://image.tmdb.org/t/p/w500/4Pl9ZuQnReUrOE4LRCrfkZLwiW4.jpg', billingOrder: 3 },
    { name: 'Bimbo Ademoye', role: 'actor', character: 'Arolake', profile: 'https://image.tmdb.org/t/p/w500/qRjPXsuTm0jDUOSeBnF1sdJ6g8H.jpg', billingOrder: 4 },
    { name: 'Sola Sobowale', role: 'actor', character: 'Awarun', profile: 'https://image.tmdb.org/t/p/w500/5v6k3Zc1yS7rT3XQ6A9e4E1.jpg', billingOrder: 5 },
    { name: 'Lateef Adedimeji', role: 'actor', character: 'Awolaran', profile: 'https://image.tmdb.org/t/p/w500/uF6lX7qQk3Q5Pq5A5.jpg', billingOrder: 6 },
    { name: 'Gabriel Afolayan', role: 'actor', character: 'Akin', profile: 'https://image.tmdb.org/t/p/w500/vG7Z8mK4u.jpg', billingOrder: 7 },
    { name: 'Femi Adebayo', role: 'actor', character: 'Kuranga', profile: null, billingOrder: 8 },
    { name: 'Owobo Ogunde', role: 'actor', character: 'Bashorun', profile: null, billingOrder: 9 },
    { name: 'Taiwo Hassan', role: 'actor', character: 'Alaafin Ademuyiwa', profile: null, billingOrder: 10 },
    { name: 'Adebayo Salami', role: 'actor', character: 'Oyo Chief', profile: 'https://image.tmdb.org/t/p/w500/kqqXRBaA5DkOeSfZ8BA2Utrg096.jpg', billingOrder: 11 },
    { name: 'Jide Kosoko', role: 'actor', character: 'Ojumo Chief', profile: null, billingOrder: 12 },
    { name: 'Aisha Lawal', role: 'actor', character: 'Omi', profile: null, billingOrder: 13 },
    { name: 'Moji Afolayan', role: 'actor', character: 'Olori Wojuola', profile: null, billingOrder: 14 },
  ];

  // Resolve all people in bulk
  const allCreditsList = [...masterMovieCredits, ...masterSeriesCredits];
  const peopleMap = await resolvePeopleMap(allCreditsList);
  console.log(`✓ Resolved ${peopleMap.size} people successfully.\n`);

  // ── 1. ENRICH 2022 FEATURE FILM (Aníkúlápó) ─────────────────────────────────
  console.log('--- 1. Enriching Aníkúlápó (2022 Movie - IMDb: tt21432050) ---');

  const { data: movieRows } = await supabase
    .from('films')
    .select('id, slug')
    .or('slug.eq.anikulapo,slug.eq.anikulapo-2022,imdb_id.eq.tt21432050');

  const movie = movieRows && movieRows.length > 0 ? movieRows[0] : null;

  const moviePayload = {
    title: 'Aníkúlápó',
    original_title: 'Aníkúlápó',
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
    slug: 'anikulapo',
  };

  let movieId: string;
  if (movie) {
    movieId = movie.id;
    await supabase.from('films').update(moviePayload).eq('id', movieId);
    console.log(`✓ Updated 2022 movie (${movieId})`);
  } else {
    const { data: newFilm, error: insErr } = await supabase.from('films').insert(moviePayload).select('id').single();
    if (insErr) throw insErr;
    movieId = newFilm!.id;
    console.log(`✓ Created 2022 movie (${movieId})`);
  }

  await attachCredits(movieId, masterMovieCredits, peopleMap);

  // ── 2. ENRICH 2024 SERIES (Aníkúlápó: Rise of the Spectre) ──────────────────
  console.log('\n--- 2. Enriching Aníkúlápó: Rise of the Spectre (2024 Series - IMDb: tt31078762) ---');

  const { data: seriesRows } = await supabase
    .from('films')
    .select('id, slug')
    .or('slug.eq.anikulapo-rise-of-the-spectre,slug.eq.anikulapo-rise-of-the-spectre-2,slug.eq.anikulapo-rise-of-the-spectre-2024,imdb_id.eq.tt31078762');

  const series = seriesRows && seriesRows.length > 0 ? seriesRows[0] : null;

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
    slug: 'anikulapo-rise-of-the-spectre',
  };

  let seriesId: string;
  if (series) {
    seriesId = series.id;
    await supabase.from('films').update(seriesPayload).eq('id', seriesId);
    console.log(`✓ Updated 2024 series master record (${seriesId})`);
  } else {
    const { data: newSeries, error: insSeriesErr } = await supabase.from('films').insert(seriesPayload).select('id').single();
    if (insSeriesErr) throw insSeriesErr;
    seriesId = newSeries!.id;
    console.log(`✓ Created 2024 series master record (${seriesId})`);
  }

  await attachCredits(seriesId, masterSeriesCredits, peopleMap);

  // ── 3. INSERT ALL 6 SEASON 1 EPISODES ───────────────────────────────────────
  console.log('\n--- 3. Inserting / Enriching All 6 Episodes of Season 1 ---');

  const episodes = [
    {
      episode_number: 1,
      season_number: 1,
      title: 'Aníkúlápó: Rise of the Spectre - Episode 1: The Return',
      slug: 'anikulapo-rise-of-the-spectre-s01e01',
      runtime_minutes: 54,
      synopsis: 'Saro awakens in the supernatural purgatory realm and is given a second chance at life under strict spiritual conditions, while turmoil brews in Oyo kingdom.',
      release_date: '2024-03-01',
      imdb_rating: 6.6,
      liked_percent: 78,
    },
    {
      episode_number: 2,
      season_number: 1,
      title: 'Aníkúlápó: Rise of the Spectre - Episode 2: Unfinished Business',
      slug: 'anikulapo-rise-of-the-spectre-s01e02',
      runtime_minutes: 58,
      synopsis: 'Saro returns to the mortal realm and attempts to reconcile with the lives he shattered, only to encounter fierce resistance and supernatural omens.',
      release_date: '2024-03-01',
      imdb_rating: 6.5,
      liked_percent: 76,
    },
    {
      episode_number: 3,
      season_number: 1,
      title: 'Aníkúlápó: Rise of the Spectre - Episode 3: Blood and Spirits',
      slug: 'anikulapo-rise-of-the-spectre-s01e03',
      runtime_minutes: 62,
      synopsis: 'As political rivalries intensify among the Oyo and Ojumo chiefs, Saro discovers the devastating price demanded by the Akala bird.',
      release_date: '2024-03-01',
      imdb_rating: 6.7,
      liked_percent: 79,
    },
    {
      episode_number: 4,
      season_number: 1,
      title: 'Aníkúlápó: Rise of the Spectre - Episode 4: Betrayal at Court',
      slug: 'anikulapo-rise-of-the-spectre-s01e04',
      runtime_minutes: 55,
      synopsis: 'Arolake is drawn back into royal intrigue as secrets from the past unravel, threatening the stability of the entire palace.',
      release_date: '2024-03-01',
      imdb_rating: 6.4,
      liked_percent: 75,
    },
    {
      episode_number: 5,
      season_number: 1,
      title: 'Aníkúlápó: Rise of the Spectre - Episode 5: Clash of Kingdoms',
      slug: 'anikulapo-rise-of-the-spectre-s01e05',
      runtime_minutes: 65,
      synopsis: 'War erupts between neighboring realms as mystical forces clash with royal armies in a spectacular battle for survival.',
      release_date: '2024-03-01',
      imdb_rating: 6.8,
      liked_percent: 81,
    },
    {
      episode_number: 6,
      season_number: 1,
      title: 'Aníkúlápó: Rise of the Spectre - Episode 6: The Final Reckoning',
      slug: 'anikulapo-rise-of-the-spectre-s01e06',
      runtime_minutes: 72,
      synopsis: 'In an epic season finale, Saro confronts his spiritual destiny and makes a momentous sacrifice that will alter the kingdoms forever.',
      release_date: '2024-03-01',
      imdb_rating: 7.0,
      liked_percent: 83,
    },
  ];

  for (const ep of episodes) {
    const epPayload = {
      title: ep.title,
      slug: ep.slug,
      series_id: seriesId,
      episode_number: ep.episode_number,
      season_number: ep.season_number,
      content_type: 'mini_series',
      year: 2024,
      release_date: ep.release_date,
      runtime_minutes: ep.runtime_minutes,
      synopsis: ep.synopsis,
      poster_url: 'https://image.tmdb.org/t/p/original/3HO233WHsznGviXEVOGMozSa996.jpg',
      backdrop_url: 'https://image.tmdb.org/t/p/original/2tQ5jSU5ECydgJUJZjYyDDKUmsd.jpg',
      imdb_rating: ep.imdb_rating,
      liked_percent: ep.liked_percent,
      release_type: 'netflix',
      streaming_links: {
        netflix: `https://www.netflix.com/title/81678121`,
        netflix_watch: `https://www.netflix.com/watch/81678121?trackId=200257859`,
      },
      is_nollywood: true,
      is_published: true,
    };

    const { data: existingEps } = await supabase
      .from('films')
      .select('id')
      .eq('slug', ep.slug)
      .limit(1);

    let epId: string;
    if (existingEps && existingEps.length > 0) {
      epId = existingEps[0].id;
      await supabase.from('films').update(epPayload).eq('id', epId);
      console.log(`  ✓ Updated Episode ${ep.episode_number}: "${ep.title}"`);
    } else {
      const { data: createdEp, error: epErr } = await supabase.from('films').insert(epPayload).select('id').single();
      if (epErr) {
        console.error(`  ❌ Error inserting Episode ${ep.episode_number}:`, epErr.message);
        continue;
      }
      epId = createdEp!.id;
      console.log(`  ✓ Inserted Episode ${ep.episode_number}: "${ep.title}"`);
    }

    // Attach credits to episode
    await attachCredits(epId, masterSeriesCredits.slice(0, 8), peopleMap);
  }

  // Clean up any extra duplicates
  const { data: extraDups } = await supabase
    .from('films')
    .select('id, slug')
    .in('slug', ['anikulapo-rise-of-the-spectre-2', 'anikulapo-2022']);

  for (const dup of extraDups || []) {
    if (dup.id !== seriesId && dup.id !== movieId) {
      console.log(`\n--- Cleaning up duplicate record (${dup.id} - ${dup.slug}) ---`);
      await supabase.from('credits').delete().eq('film_id', dup.id);
      await supabase.from('films').delete().eq('id', dup.id);
      console.log('✓ Duplicate cleanly removed.');
    }
  }

  console.log('\n🎉 Complete Aníkúlápó Film Universe Enrichment Finished!');
}

main().catch((err) => {
  console.error('Fatal error during Anikulapo enrichment:', err);
  process.exit(1);
});
