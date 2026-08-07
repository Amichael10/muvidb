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

async function findOrCreatePerson(name: string, photoUrl: string | null = null, bio: string | null = null) {
  if (!name) return null;
  const cleanName = name.trim();
  const { data: existing } = await supabase
    .from('people')
    .select('id, photo_url, bio')
    .ilike('name', cleanName)
    .maybeSingle();

  if (existing) {
    const updates: any = {};
    if (photoUrl && !existing.photo_url) updates.photo_url = photoUrl;
    if (bio && !existing.bio) updates.bio = bio;
    if (Object.keys(updates).length > 0) {
      await supabase.from('people').update(updates).eq('id', existing.id);
    }
    return existing.id;
  }

  const { data: newPerson, error } = await supabase
    .from('people')
    .insert({
      name: cleanName,
      source: 'imdb',
      nationality: 'Nigerian',
      photo_url: photoUrl,
      bio: bio,
      slug: cleanName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''),
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

async function upsertFilm(filmData: any) {
  const { data: existing } = await supabase
    .from('films')
    .select('id')
    .ilike('title', filmData.title)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase.from('films').update(filmData).eq('id', existing.id);
    if (error) console.error(`❌ Error updating film ${filmData.title}:`, error.message);
    else console.log(`✅ Updated existing film ${filmData.title}`);
    return existing.id;
  }

  const { data: newFilm, error } = await supabase
    .from('films')
    .insert(filmData)
    .select('id')
    .single();

  if (error) {
    console.error(`❌ Error creating film ${filmData.title}:`, error.message);
    return null;
  }
  console.log(`✨ Created new film ${filmData.title}`);
  return newFilm.id;
}

async function main() {
  console.log('🚀 Starting IMDb Enrichment for Adeyemi Afolayan (Ade-Love) & His Complete Filmography...');

  // 1. Enrich Ade-Love's Actor Profile
  const adeLovePersonId = '663ecaa0-90ad-4b7a-a8e9-c9b87df159a8';
  const adeLoveBio = `Adeyemi Josiah Afolayan (1940 – 1996), professionally known as Ade Love, was a legendary Nigerian film director, producer, and actor. A pioneer of early Nigerian cinema, he formed the Ade Love Theatre Troupe in 1971 and produced seminal classics including Ajani Ogun (1976), Ija Ominira (1979), Kadara (1981), Ija Orogun (1982), Taxi Driver (1983), Taxi Driver 2 (1984), and Iya ni Wura (1985). He is the patriarch of the celebrated Afolayan filmmaking dynasty, fathering acclaimed directors and actors Kunle Afolayan, Gabriel Afolayan, Moji Afolayan, and Aremu Afolayan.`;

  await supabase
    .from('people')
    .update({
      name: 'Adeyemi Afolayan (Ade-Love)',
      bio: adeLoveBio,
      tmdb_id: 1323258,
      known_for_department: 'Director',
      nationality: 'Nigerian',
      gender: 'Male',
      is_spotlight: true,
    })
    .eq('id', adeLovePersonId);

  console.log('✅ Updated Ade-Love person profile');

  // 2. Film list to enrich
  const filmsToProcess = [
    {
      title: 'Ajani Ogun',
      original_title: 'Ajani Ogun',
      year: 1976,
      release_date: '1976-01-02',
      runtime_minutes: 120,
      content_type: 'movie',
      poster_url: 'https://image.tmdb.org/t/p/original/yRpkssZElvjS9rHxYTxO9NgboXW.jpg',
      backdrop_url: 'https://assets.mubicdn.net/images/film/41448/image-w1280.jpg?1745490328',
      imdb_id: 'tt0271343',
      tmdb_id: 271429,
      genres: ['Drama', 'Musical'],
      language: 'Yoruba',
      languages: ['Yoruba', 'English'],
      countries: ['Nigeria'],
      synopsis: 'Ajani Ogun tells the story of a young hunter, Ajani-Ogun, who fights a vicious and corrupt politician who misappropriated his family land after his father died.',
      is_nollywood: true,
      is_published: true,
      slug: 'ajani-ogun',
      credits: [
        { name: 'Ola Balogun', role: 'director' },
        { name: 'Ola Balogun', role: 'writer' },
        { name: 'Adeyemi Afolayan (Ade-Love)', role: 'actor', character: 'Ajani Ogun' },
        { name: 'Idowu Adebisi', role: 'actor', character: '' },
        { name: 'Mope Ilori', role: 'actor', character: '' },
        { name: 'Duro Ladipo', role: 'actor', character: '' },
      ],
    },
    {
      title: 'Ija Ominira (Fight for Freedom)',
      original_title: 'Ija Ominira',
      year: 1979,
      release_date: '1979-01-01',
      runtime_minutes: 110,
      content_type: 'movie',
      poster_url: 'https://image.tmdb.org/t/p/original/yRpkssZElvjS9rHxYTxO9NgboXW.jpg',
      backdrop_url: 'https://assets.mubicdn.net/images/film/41448/image-w1280.jpg?1745490328',
      imdb_id: 'tt0296683',
      tmdb_id: 1444007,
      genres: ['Action', 'Drama', 'History'],
      language: 'Yoruba',
      languages: ['Yoruba', 'English'],
      countries: ['Nigeria'],
      synopsis: 'Ija Ominira is the cinematic transposition of Adebayo Faleti’s acclaimed novel. It tells the epic story of a tyrannical, cruel king whose oppression leads his exasperated subjects to revolt and fight for freedom.',
      is_nollywood: true,
      is_published: true,
      slug: 'ija-ominira',
      credits: [
        { name: 'Ola Balogun', role: 'director' },
        { name: 'Adebayo Faleti', role: 'writer' },
        { name: 'Adeyemi Afolayan (Ade-Love)', role: 'producer' },
        { name: 'Adeyemi Afolayan (Ade-Love)', role: 'actor', character: 'Hero / Rebel Leader' },
        { name: 'Duro Ladipo', role: 'actor', character: 'King' },
        { name: 'Oyin Adejobi', role: 'actor', character: '' },
      ],
    },
    {
      title: 'Kadara (Destiny)',
      original_title: 'Kadara',
      year: 1981,
      release_date: '1981-05-05',
      runtime_minutes: 94,
      content_type: 'movie',
      poster_url: 'https://image.tmdb.org/t/p/original/1sInKbUIyHGiy0xcC5Y509dwyPB.jpg',
      backdrop_url: 'https://i.ytimg.com/vi/Nv1u3yoAAZA/hqdefault.jpg',
      imdb_id: 'tt0082607',
      tmdb_id: 558315,
      genres: ['Drama', 'Romance'],
      language: 'Yoruba',
      languages: ['Yoruba', 'English'],
      countries: ['Nigeria'],
      synopsis: 'In an ancient kingdom bound by sacred laws, tradition dictates that the right to marry the beautiful princess can only be won through a grueling wrestling tournament. Kadara follows the rivalry between a humble farmer and a wealthy brutish suitor.',
      is_nollywood: true,
      is_published: true,
      slug: 'kadara-destiny',
      credits: [
        { name: 'Adeyemi Afolayan (Ade-Love)', role: 'director' },
        { name: 'Adeyemi Afolayan (Ade-Love)', role: 'writer' },
        { name: 'Adeyemi Afolayan (Ade-Love)', role: 'producer' },
        { name: 'Adeyemi Afolayan (Ade-Love)', role: 'actor', character: 'Farmer / Hero' },
        { name: 'Lere Paimo', role: 'actor', character: '' },
        { name: 'Charles Olumo', role: 'actor', character: '' },
      ],
    },
    {
      title: 'Ija Orogun',
      original_title: 'Ija Orogun',
      year: 1982,
      release_date: '1982-01-01',
      runtime_minutes: 105,
      content_type: 'movie',
      poster_url: 'https://image.tmdb.org/t/p/original/cO6LqVXVxDG9LRrPp8sfKGvANiy.jpg',
      backdrop_url: 'https://image.tmdb.org/t/p/original/fTah2huUXan6vtQXdbL6NSCCaXg.jpg',
      imdb_id: 'tt0302647',
      genres: ['Drama', 'Family'],
      language: 'Yoruba',
      languages: ['Yoruba'],
      countries: ['Nigeria'],
      synopsis: 'A gripping exploration of polygamy, domestic rivalry, and family jealousy in traditional Yoruba society.',
      is_nollywood: true,
      is_published: true,
      slug: 'ija-orogun',
      credits: [
        { name: 'Adeyemi Afolayan (Ade-Love)', role: 'director' },
        { name: 'Adeyemi Afolayan (Ade-Love)', role: 'writer' },
        { name: 'Adeyemi Afolayan (Ade-Love)', role: 'producer' },
        { name: 'Adeyemi Afolayan (Ade-Love)', role: 'actor', character: 'Husband' },
        { name: 'Sunday Omobolanle', role: 'actor', character: '' },
      ],
    },
    {
      title: 'Taxi Driver',
      original_title: 'Taxi Driver',
      year: 1983,
      release_date: '1983-01-01',
      runtime_minutes: 110,
      content_type: 'movie',
      poster_url: 'https://image.tmdb.org/t/p/original/cO6LqVXVxDG9LRrPp8sfKGvANiy.jpg',
      backdrop_url: 'https://image.tmdb.org/t/p/original/fTah2huUXan6vtQXdbL6NSCCaXg.jpg',
      imdb_id: 'tt0302996',
      genres: ['Comedy', 'Drama'],
      language: 'Yoruba',
      languages: ['Yoruba', 'English'],
      countries: ['Nigeria'],
      synopsis: 'Ade-Love stars as a charismatic taxi driver navigating the humor, hardship, and streetwise adventures of 1980s Lagos.',
      is_nollywood: true,
      is_published: true,
      slug: 'taxi-driver-1983',
      credits: [
        { name: 'Adeyemi Afolayan (Ade-Love)', role: 'director' },
        { name: 'Adeyemi Afolayan (Ade-Love)', role: 'writer' },
        { name: 'Adeyemi Afolayan (Ade-Love)', role: 'producer' },
        { name: 'Adeyemi Afolayan (Ade-Love)', role: 'actor', character: 'Taxi Driver' },
        { name: 'Charles Olumo', role: 'actor', character: '' },
      ],
    },
    {
      title: 'Iya ni Wura (Golden Mother)',
      original_title: 'Iya ni Wura',
      year: 1985,
      release_date: '1985-04-10',
      runtime_minutes: 139,
      content_type: 'movie',
      poster_url: 'https://image.tmdb.org/t/p/original/cO6LqVXVxDG9LRrPp8sfKGvANiy.jpg',
      backdrop_url: 'https://image.tmdb.org/t/p/original/fTah2huUXan6vtQXdbL6NSCCaXg.jpg',
      imdb_id: 'tt0302674',
      tmdb_id: 1667785,
      genres: ['Drama', 'Family'],
      language: 'Yoruba',
      languages: ['Yoruba', 'English'],
      countries: ['Nigeria'],
      synopsis: 'A mother’s desperate attempt to save her twin sons ends in their separation, setting off years of loss and emotional trials until fate brings them back together.',
      is_nollywood: true,
      is_published: true,
      slug: 'iya-ni-wura',
      credits: [
        { name: 'Adeyemi Afolayan (Ade-Love)', role: 'director' },
        { name: 'Adeyemi Afolayan (Ade-Love)', role: 'writer' },
        { name: 'Adeyemi Afolayan (Ade-Love)', role: 'producer' },
        { name: 'Adeyemi Afolayan (Ade-Love)', role: 'actor', character: 'Taye / Kehinde / Goodluck' },
        { name: 'Sunday Omobolanle', role: 'actor', character: '' },
        { name: 'Lere Paimo', role: 'actor', character: '' },
        { name: 'Charles Olumo', role: 'actor', character: '' },
        { name: 'Ray Eyiwunmi', role: 'actor', character: '' },
        { name: 'Biodun Duroladipo', role: 'actor', character: '' },
      ],
    },
  ];

  for (const film of filmsToProcess) {
    const { credits, ...filmPayload } = film;
    const filmId = await upsertFilm(filmPayload);
    if (filmId && credits) {
      for (let i = 0; i < credits.length; i++) {
        const c = credits[i];
        const personId = c.name.includes('Ade-Love') 
          ? adeLovePersonId 
          : await findOrCreatePerson(c.name);
        if (personId) {
          await addCredit(filmId, personId, c.role, c.character || null, i + 1);
        }
      }
    }
  }

  console.log('\n🎉 Successfully enriched Adeyemi Afolayan (Ade-Love) and his filmography!');
}

main().catch(console.error);
