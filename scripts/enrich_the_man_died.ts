import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const posterUrl = 'https://m.media-amazon.com/images/S/pv-target-images/491377564c27235fe2bd2124540acb253616c2a4cc9709638116df0e437fab90.jpg';
const primeUrl = 'https://app.primevideo.com/detail?gti=amzn1.dv.gti.c83321bb-c742-4c2d-a517-2a8073708db6&territory=NG';
const synopsis = 'When an idealistic writer is jailed by the military after his mediation to stop a civil war is misconstrued as support for the rebels, his ideals are put to the ultimate test as he battles for his sanity and his life.';

const castList = [
  { name: 'Wale Ojo', role: 'actor', character: 'Wole Soyinka', order: 1 },
  { name: 'Sam Dede', role: 'actor', character: '', order: 2 },
  { name: 'Chidi Mokeme', role: 'actor', character: '', order: 3 },
  { name: 'Norbert Young', role: 'actor', character: '', order: 4 },
  { name: 'Francis Onwochei', role: 'actor', character: '', order: 5 },
  { name: 'Edmond Enabe', role: 'actor', character: '', order: 6 },
  { name: 'Segilola Ogidan', role: 'actor', character: '', order: 7 },
  { name: 'Simileoluwa Hassan', role: 'actor', character: '', order: 8 },
  { name: 'Christiana Oshunniyi', role: 'actor', character: '', order: 9 },
  { name: 'Abraham Amkpa', role: 'actor', character: '', order: 10 },
  { name: 'Awam Amkpa', role: 'director', character: '', order: 1 },
  { name: 'Femi Odugbemi', role: 'producer', character: '', order: 1 },
  { name: 'Bode Asiyanbi', role: 'writer', character: '', order: 1 },
  { name: 'Wole Soyinka', role: 'writer', character: 'Book Author', order: 2 },
];

function slugify(text: string) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
}

async function getOrCreatePerson(name: string) {
  const normName = name.trim();
  const slug = slugify(normName);

  const { data: existing } = await supabase
    .from('people')
    .select('id, name')
    .ilike('name', normName)
    .maybeSingle();

  if (existing) return existing.id;

  const { data: created, error } = await supabase
    .from('people')
    .insert([{ name: normName, slug, nationality: 'Nigerian' }])
    .select('id')
    .single();

  if (error || !created) {
    console.error(`Error creating person ${normName}:`, error);
    return null;
  }
  return created.id;
}

async function run() {
  console.log('🔍 Checking database for "The Man Died"...');

  const { data: existingFilms } = await supabase
    .from('films')
    .select('*')
    .or('title.ilike.%Man Died%,slug.eq.the-man-died');

  console.log(`Found ${existingFilms?.length || 0} existing film matches.`);

  let filmId: string;

  if (existingFilms && existingFilms.length > 0) {
    const film = existingFilms[0];
    filmId = film.id;
    console.log(`Updating existing film ID ${filmId} ("${film.title}")...`);

    const streamingLinks = film.streaming_links || {};
    streamingLinks.prime = primeUrl;
    streamingLinks.prime_video = primeUrl;

    const { error: updateErr } = await supabase
      .from('films')
      .update({
        title: 'The Man Died',
        slug: 'the-man-died',
        poster_url: posterUrl,
        synopsis: synopsis,
        year: 2024,
        streaming_links: streamingLinks,
      })
      .eq('id', filmId);

    if (updateErr) console.error('Error updating film:', updateErr);
    else console.log('✅ Film updated successfully!');
  } else {
    console.log('Creating new film entry for "The Man Died"...');
    const { data: createdFilm, error: createErr } = await supabase
      .from('films')
      .insert([{
        title: 'The Man Died',
        slug: 'the-man-died',
        poster_url: posterUrl,
        synopsis: synopsis,
        year: 2024,
        release_date: '2024-07-12',
        streaming_links: { prime: primeUrl, prime_video: primeUrl },
      }])
      .select('id')
      .single();

    if (createErr || !createdFilm) {
      console.error('Error creating film:', createErr);
      process.exit(1);
    }
    filmId = createdFilm.id;
    console.log(`✅ Film created with ID: ${filmId}`);
  }

  // Enrich Cast & Crew Credits
  console.log('👥 Adding Cast & Crew Credits...');
  for (const item of castList) {
    const personId = await getOrCreatePerson(item.name);
    if (!personId) continue;

    const { data: existingCredit } = await supabase
      .from('credits')
      .select('id')
      .eq('film_id', filmId)
      .eq('person_id', personId)
      .eq('role', item.role)
      .maybeSingle();

    if (!existingCredit) {
      const { error: creditErr } = await supabase
        .from('credits')
        .insert([{
          film_id: filmId,
          person_id: personId,
          role: item.role,
          character_name: item.character || null,
          billing_order: item.order,
        }]);

      if (creditErr) console.error(`Error adding credit for ${item.name}:`, creditErr);
      else console.log(`  ➕ Added credit: ${item.name} (${item.role})`);
    } else {
      console.log(`  ✓ Credit exists: ${item.name} (${item.role})`);
    }
  }

  console.log('🎉 Enrichment for "The Man Died" complete!');
}

run().catch(console.error);
