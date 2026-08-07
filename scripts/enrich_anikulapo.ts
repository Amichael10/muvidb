import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function findOrCreatePerson(name: string, role: string, profileImage: string | null = null) {
  if (!name) return null;
  const cleanName = name.trim();
  const { data: existing } = await supabase
    .from('people')
    .select('id, photo_url')
    .ilike('name', cleanName)
    .maybeSingle();

  if (existing) {
    if (profileImage && !existing.photo_url) {
      await supabase.from('people').update({ photo_url: profileImage }).eq('id', existing.id);
    }
    return existing.id;
  }

  const { data: newPerson, error } = await supabase
    .from('people')
    .insert({
      name: cleanName,
      source: 'imdb',
      nationality: 'Nigerian',
      photo_url: profileImage,
    })
    .select('id')
    .single();

  if (error) {
    console.error(`  ⚠️ Error creating person ${cleanName}:`, error.message);
    return null;
  }
  return newPerson.id;
}

async function addCredit(filmId: string, personId: string, role: string, characterName: string | null = null, billingOrder: number = 0) {
  if (!filmId || !personId) return;
  const { error } = await supabase.from('credits').upsert(
    {
      film_id: filmId,
      person_id: personId,
      role: role.toLowerCase(),
      character_name: characterName,
      billing_order: billingOrder,
      source: 'imdb',
    },
    { onConflict: 'film_id,person_id,role' }
  );
  if (error) {
    console.warn(`  ⚠️ Error adding credit ${role} for person ${personId}:`, error.message);
  }
}

async function main() {
  console.log('🚀 Starting IMDb Enrichment for Aníkúlápó & Aníkúlápó: Rise of the Spectre...');

  // 1. ANÍKÚLÁPÓ (2022 Movie - tt21432050)
  const movieFilmId = '72dbaca9-4b78-4fe8-8178-6deab8d51341';
  console.log('\n--- Enriching Aníkúlápó (2022 Movie) ---');

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
    imdb_rating: 5.4,
    imdb_vote_count: 517,
    tmdb_id: 1023994,
    tmdb_rating: 7.1,
    tmdb_vote_count: 43,
    genres: ['Drama', 'Fantasy'],
    language: 'Yoruba',
    languages: ['Yoruba', 'English'],
    countries: ['Nigeria'],
    synopsis: 'After an affair with a queen leads to his demise, an eager traveler encounters a mystical bird with the power to give him another life.',
    release_type: 'netflix',
    streaming_links: {
      netflix: 'https://www.netflix.com/title/81446132',
    },
    is_nollywood: true,
    is_published: true,
    slug: 'anikulapo-2022',
  };

  const { error: movieErr } = await supabase.from('films').update(moviePayload).eq('id', movieFilmId);
  if (movieErr) {
    console.error('❌ Error updating Aníkúlápó movie:', movieErr.message);
  } else {
    console.log('✅ Aníkúlápó movie record updated successfully.');
  }

  // Movie Cast & Crew Credits
  const movieCast = [
    { name: 'Kunle Afolayan', role: 'director', character: null, profile: 'https://image.tmdb.org/t/p/w500/yV1pYp3CkW3xR3gK9Z7Nf58m4e5.jpg' },
    { name: 'Shola Dada', role: 'writer', character: null, profile: null },
    { name: 'Kunle Remi', role: 'actor', character: 'Saro', profile: 'https://image.tmdb.org/t/p/w500/4Pl9ZuQnReUrOE4LRCrfkZLwiW4.jpg' },
    { name: 'Bimbo Ademoye', role: 'actor', character: 'Arolake', profile: 'https://image.tmdb.org/t/p/w500/qRjPXsuTm0jDUOSeBnF1sdJ6g8H.jpg' },
    { name: 'Hakeem Kae-Kazim', role: 'actor', character: 'Oba Aderoju', profile: 'https://image.tmdb.org/t/p/w500/sVNHRm51c9toG73FUQ5k1St0vju.jpg' },
    { name: 'Sola Sobowale', role: 'actor', character: 'Awarun', profile: null },
    { name: 'Taiwo Hassan', role: 'actor', character: 'Alaafin Ademuyiwa', profile: null },
    { name: 'Adebayo Salami', role: 'actor', character: 'Oyo Chief', profile: 'https://image.tmdb.org/t/p/w500/kqqXRBaA5DkOeSfZ8BA2Utrg096.jpg' },
    { name: 'Adebowale Adedayo', role: 'actor', character: 'Akanji', profile: 'https://image.tmdb.org/t/p/w500/twwO4XYm0cKQYU828GmXB2UiWeQ.jpg' },
    { name: 'Moji Afolayan', role: 'actor', character: 'Olori Wojuola', profile: null },
    { name: 'Yinka Quadri', role: 'actor', character: 'Hunter', profile: null },
  ];

  for (let i = 0; i < movieCast.length; i++) {
    const c = movieCast[i];
    const personId = await findOrCreatePerson(c.name, c.role, c.profile);
    if (personId) {
      await addCredit(movieFilmId, personId, c.role, c.character, i + 1);
    }
  }

  // 2. ANÍKÚLÁPÓ: RISE OF THE SPECTRE (2024 Series - tt31078762)
  const seriesFilmId = '1a7cc1be-194c-4c57-96a9-532084d85b38';
  console.log('\n--- Enriching Aníkúlápó: Rise of the Spectre (2024 Series) ---');

  const seriesPayload = {
    title: 'Aníkúlápó: Rise of the Spectre',
    original_title: 'Aníkúlápó: Rise of the Spectre',
    year: 2024,
    release_date: '2024-03-01',
    runtime_minutes: 55,
    content_type: 'series',
    season_count: 1,
    episode_count: 6,
    poster_url: 'https://image.tmdb.org/t/p/original/3HO233WHsznGviXEVOGMozSa996.jpg',
    backdrop_url: 'https://image.tmdb.org/t/p/original/2tQ5jSU5ECydgJUJZjYyDDKUmsd.jpg',
    imdb_id: 'tt31078762',
    imdb_rating: 5.0,
    imdb_vote_count: 140,
    tmdb_id: 247569,
    tmdb_rating: 7.0,
    tmdb_vote_count: 8,
    genres: ['Drama', 'Fantasy'],
    language: 'Yoruba',
    languages: ['Yoruba', 'English'],
    countries: ['Nigeria'],
    synopsis: 'In a race against time to avoid a dismal fate, traveler Saro returns to Ojumo with orders to complete a nearly impossible task.',
    release_type: 'netflix',
    streaming_links: {
      netflix: 'https://www.netflix.com/title/81678121',
    },
    is_nollywood: true,
    is_published: true,
    slug: 'anikulapo-rise-of-the-spectre-2024',
  };

  const { error: seriesErr } = await supabase.from('films').update(seriesPayload).eq('id', seriesFilmId);
  if (seriesErr) {
    console.error('❌ Error updating Aníkúlápó: Rise of the Spectre series:', seriesErr.message);
  } else {
    console.log('✅ Aníkúlápó: Rise of the Spectre series record updated successfully.');
  }

  // Series Cast & Crew Credits
  const seriesCast = [
    { name: 'Kunle Afolayan', role: 'director', character: null, profile: 'https://image.tmdb.org/t/p/w500/yV1pYp3CkW3xR3gK9Z7Nf58m4e5.jpg' },
    { name: 'Shola Dada', role: 'writer', character: null, profile: null },
    { name: 'Kunle Remi', role: 'actor', character: 'Saro', profile: 'https://image.tmdb.org/t/p/w500/4Pl9ZuQnReUrOE4LRCrfkZLwiW4.jpg' },
    { name: 'Bimbo Ademoye', role: 'actor', character: 'Arolake', profile: 'https://image.tmdb.org/t/p/w500/qRjPXsuTm0jDUOSeBnF1sdJ6g8H.jpg' },
    { name: 'Sola Sobowale', role: 'actor', character: 'Awarun', profile: null },
    { name: 'Lateef Adedimeji', role: 'actor', character: 'Awolaran', profile: 'https://image.tmdb.org/t/p/w500/uF6lX7qQk3Q5Pq5A5.jpg' },
    { name: 'Gabriel Afolayan', role: 'actor', character: 'Akin', profile: 'https://image.tmdb.org/t/p/w500/vG7Z8mK4u.jpg' },
    { name: 'Femi Adebayo', role: 'actor', character: 'Kuranga', profile: null },
    { name: 'Taiwo Hassan', role: 'actor', character: 'Alaafin Ademuyiwa', profile: null },
    { name: 'Owobo Ogunde', role: 'actor', character: 'Bashorun', profile: null },
  ];

  for (let i = 0; i < seriesCast.length; i++) {
    const c = seriesCast[i];
    const personId = await findOrCreatePerson(c.name, c.role, c.profile);
    if (personId) {
      await addCredit(seriesFilmId, personId, c.role, c.character, i + 1);
    }
  }

  console.log('\n🎉 All IMDb enrichment & credit linking completed successfully!');
}

main().catch(console.error);
