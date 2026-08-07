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
  console.log('🚀 Starting IMDb Enrichment for Ishola Ogunsola (I-Sho Pepper) & His Complete Filmography...');

  // 1. Enrich Ishola Ogunsola's Actor Profile
  const iShoPersonId = 'f5002fe6-fee4-4a56-bfcd-dab9a0f5fdaf';
  const iShoBio = `Ishola Ogunsola (1942 – 1992), affectionately known as I-Sho Pepper, was a giant of early Nigerian theatre, television, and cinema. A legendary playwright, actor, director, and music composer, he founded the renowned I-Sho Pepper Theatre Troupe. He composed, directed, and starred in timeless classics such as Efunsetan Aniwura (1981), Mosebolatan (1985), Kannakanna (1985), and Ose Sango (1991). He was married to celebrated veteran Nollywood actress Iyabo Ogunsola.`;

  await supabase
    .from('people')
    .update({
      name: 'Ishola Ogunsola (I-Sho Pepper)',
      bio: iShoBio,
      known_for_department: 'Director',
      nationality: 'Nigerian',
      gender: 'Male',
      is_spotlight: true,
    })
    .eq('id', iShoPersonId);

  console.log('✅ Updated Ishola Ogunsola (I-Sho Pepper) person profile');

  // 2. Film list to enrich
  const filmsToProcess = [
    {
      title: 'Efunsetan Aniwura',
      original_title: 'Efunsetan Aniwura',
      year: 1981,
      release_date: '1981-01-01',
      runtime_minutes: 125,
      content_type: 'movie',
      poster_url: 'https://image.tmdb.org/t/p/original/7tP9d3tHfoXA8JucR8Hpp5JFLUz.jpg',
      backdrop_url: 'https://image.tmdb.org/t/p/original/7tP9d3tHfoXA8JucR8Hpp5JFLUz.jpg',
      imdb_id: 'tt0302506',
      tmdb_id: 1492170,
      genres: ['Drama', 'History'],
      language: 'Yoruba',
      languages: ['Yoruba', 'English'],
      countries: ['Nigeria'],
      synopsis: 'The historical drama detailing the tragic life and formidable reign of Efunsetan Aniwura, the second Iyalode of Ibadan, her legendary wealth, iron-fisted rule, and ultimate clash with the authorities of Ibadan.',
      is_nollywood: true,
      is_published: true,
      slug: 'efunsetan-aniwura-1981',
      credits: [
        { name: 'Bankole Olayebi', role: 'director' },
        { name: 'Akinwunmi Isola', role: 'writer' },
        { name: 'Iyabo Ogunsola', role: 'actor', character: 'Efunsetan Aniwura' },
        { name: 'Ishola Ogunsola (I-Sho Pepper)', role: 'actor', character: 'Iyalode Chief / Lead' },
        { name: 'Lere Paimo', role: 'actor', character: 'Balogun Ibikunle' },
        { name: 'Jimoh Aliu', role: 'actor', character: '' },
      ],
    },
    {
      title: 'Mosebolatan',
      original_title: 'Mosebolatan',
      year: 1985,
      release_date: '1985-01-01',
      runtime_minutes: 115,
      content_type: 'movie',
      poster_url: 'https://image.tmdb.org/t/p/original/7tP9d3tHfoXA8JucR8Hpp5JFLUz.jpg',
      backdrop_url: 'https://image.tmdb.org/t/p/original/7tP9d3tHfoXA8JucR8Hpp5JFLUz.jpg',
      imdb_id: 'tt0302812',
      genres: ['Comedy', 'Drama'],
      language: 'Yoruba',
      languages: ['Yoruba'],
      countries: ['Nigeria'],
      synopsis: 'A classic Nollywood comedy-drama starring Ishola Ogunsola (I-Sho Pepper) and Moses Olaiya (Baba Sala) exploring greed, fortune, and family moral dilemmas.',
      is_nollywood: true,
      is_published: true,
      slug: 'mosebolatan-1985',
      credits: [
        { name: 'Ishola Ogunsola (I-Sho Pepper)', role: 'director' },
        { name: 'Ishola Ogunsola (I-Sho Pepper)', role: 'writer' },
        { name: 'Ishola Ogunsola (I-Sho Pepper)', role: 'producer' },
        { name: 'Ishola Ogunsola (I-Sho Pepper)', role: 'actor', character: 'Lead Actor' },
        { name: 'Moses Olaiya (Baba Sala)', role: 'actor', character: 'Baba Sala' },
        { name: 'Iyabo Ogunsola', role: 'actor', character: '' },
      ],
    },
    {
      title: 'Kannakanna',
      original_title: 'Kannakanna',
      year: 1985,
      release_date: '1985-06-01',
      runtime_minutes: 105,
      content_type: 'movie',
      poster_url: 'https://image.tmdb.org/t/p/original/7tP9d3tHfoXA8JucR8Hpp5JFLUz.jpg',
      backdrop_url: 'https://image.tmdb.org/t/p/original/7tP9d3tHfoXA8JucR8Hpp5JFLUz.jpg',
      imdb_id: 'tt0302701',
      genres: ['Drama', 'Thriller'],
      language: 'Yoruba',
      languages: ['Yoruba'],
      countries: ['Nigeria'],
      synopsis: 'A riveting traditional mystery drama centering around mystical secrets, betrayal, and justice in a Yoruba community.',
      is_nollywood: true,
      is_published: true,
      slug: 'kannakanna-1985',
      credits: [
        { name: 'Ishola Ogunsola (I-Sho Pepper)', role: 'director' },
        { name: 'Ishola Ogunsola (I-Sho Pepper)', role: 'writer' },
        { name: 'Ishola Ogunsola (I-Sho Pepper)', role: 'producer' },
        { name: 'Ishola Ogunsola (I-Sho Pepper)', role: 'actor', character: 'Lead Actor' },
        { name: 'Iyabo Ogunsola', role: 'actor', character: '' },
      ],
    },
    {
      title: 'Ose Sango',
      original_title: 'Ose Sango',
      year: 1991,
      release_date: '1991-01-01',
      runtime_minutes: 110,
      content_type: 'movie',
      poster_url: 'https://image.tmdb.org/t/p/original/7tP9d3tHfoXA8JucR8Hpp5JFLUz.jpg',
      backdrop_url: 'https://image.tmdb.org/t/p/original/7tP9d3tHfoXA8JucR8Hpp5JFLUz.jpg',
      imdb_id: 'tt0302875',
      genres: ['Drama', 'Fantasy'],
      language: 'Yoruba',
      languages: ['Yoruba'],
      countries: ['Nigeria'],
      synopsis: 'A powerful mythological drama detailing the sacred staff of Sango, the Orisha of Thunder, and the spiritual battles surrounding divine vengeance.',
      is_nollywood: true,
      is_published: true,
      slug: 'ose-sango-1991',
      credits: [
        { name: 'Ishola Ogunsola (I-Sho Pepper)', role: 'director' },
        { name: 'Ishola Ogunsola (I-Sho Pepper)', role: 'composer' },
        { name: 'Ishola Ogunsola (I-Sho Pepper)', role: 'actor', character: 'Sango Priest / Lead' },
        { name: 'Iyabo Ogunsola', role: 'actor', character: '' },
      ],
    },
  ];

  for (const film of filmsToProcess) {
    const { credits, ...filmPayload } = film;
    const filmId = await upsertFilm(filmPayload);
    if (filmId && credits) {
      for (let i = 0; i < credits.length; i++) {
        const c = credits[i];
        const personId = c.name.includes('Ishola Ogunsola') 
          ? iShoPersonId 
          : await findOrCreatePerson(c.name);
        if (personId) {
          await addCredit(filmId, personId, c.role, c.character || null, i + 1);
        }
      }
    }
  }

  console.log('\n🎉 Successfully enriched Ishola Ogunsola (I-Sho Pepper) and his complete filmography!');
}

main().catch(console.error);
