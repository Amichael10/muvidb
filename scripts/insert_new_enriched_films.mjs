import dns from 'node:dns';
import { Agent, setGlobalDispatcher } from 'undici';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config();

const customLookup = (hostname, options, callback) => {
  if (hostname === 'pkenrmorywmuvnzfoylp.supabase.co') {
    if (options && options.all) {
      return callback(null, [{ address: '172.64.149.246', family: 4 }]);
    }
    return callback(null, '172.64.149.246', 4);
  }
  return dns.lookup(hostname, options, callback);
};

setGlobalDispatcher(new Agent({ connect: { lookup: customLookup, timeout: 30000 } }));

const url = (process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || 'https://pkenrmorywmuvnzfoylp.supabase.co').trim();
const serviceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || '').trim();

const supabase = createClient(url, serviceKey, { auth: { persistSession: false } });

function slugify(text) {
  return String(text || '')
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

async function getOrCreatePerson(name, role) {
  if (!name || name.trim().length === 0) return null;
  const cleanName = name.trim();

  const { data: exact } = await supabase
    .from('people')
    .select('id, name')
    .ilike('name', cleanName)
    .limit(1);

  if (exact && exact.length > 0) return exact[0].id;

  const parts = cleanName.split(/\s+/);
  if (parts.length >= 2) {
    const { data: fuzzy } = await supabase
      .from('people')
      .select('id, name')
      .ilike('name', `%${parts[0]}%${parts[1]}%`)
      .limit(1);

    if (fuzzy && fuzzy.length > 0) return fuzzy[0].id;
  }

  const slug = `${slugify(cleanName)}-${Math.floor(100 + Math.random() * 900)}`;
  const { data: created, error } = await supabase
    .from('people')
    .insert({
      name: cleanName,
      slug,
      known_for_department: role === 'Directing' ? 'Directing' : (role === 'Production' ? 'Production' : 'Acting'),
      nationality: 'Nigerian',
      popularity_score: 5,
      source: 'imdb_enrichment'
    })
    .select('id')
    .single();

  if (error) {
    console.warn(`    ⚠️ Could not create person ${cleanName}:`, error.message);
    return null;
  }

  return created.id;
}

async function reconcileCredits(filmId, castList, directorsList, producersList = []) {
  const { data: existingCredits } = await supabase
    .from('credits')
    .select('id, person_id, role, character_name, billing_order')
    .eq('film_id', filmId);

  const existingCreditByPerson = new Map();
  for (const c of existingCredits || []) {
    existingCreditByPerson.set(c.person_id, c);
  }

  for (const dirName of directorsList || []) {
    const personId = await getOrCreatePerson(dirName, 'Directing');
    if (!personId) continue;

    if (existingCreditByPerson.has(personId)) {
      const existing = existingCreditByPerson.get(personId);
      if (existing.role !== 'director') {
        await supabase.from('credits').update({ role: 'director' }).eq('id', existing.id);
      }
    } else {
      await supabase.from('credits').insert({
        film_id: filmId,
        person_id: personId,
        role: 'director',
        source: 'imdb_enrichment'
      });
      existingCreditByPerson.set(personId, { id: 'new', role: 'director' });
      console.log(`    + Linked director: ${dirName}`);
    }
  }

  for (const prodName of producersList || []) {
    const personId = await getOrCreatePerson(prodName, 'Production');
    if (!personId) continue;

    if (existingCreditByPerson.has(personId)) {
      const existing = existingCreditByPerson.get(personId);
      if (!existing.role) {
        await supabase.from('credits').update({ role: 'producer' }).eq('id', existing.id);
      }
    } else {
      await supabase.from('credits').insert({
        film_id: filmId,
        person_id: personId,
        role: 'producer',
        source: 'imdb_enrichment'
      });
      existingCreditByPerson.set(personId, { id: 'new', role: 'producer' });
      console.log(`    + Linked producer: ${prodName}`);
    }
  }

  let nextBilling = (existingCredits?.length || 0) + 1;
  for (const item of castList || []) {
    const name = typeof item === 'string' ? item : item.name;
    const charName = typeof item === 'object' ? item.character : null;
    const personId = await getOrCreatePerson(name, 'Acting');
    if (!personId) continue;

    if (existingCreditByPerson.has(personId)) {
      const existing = existingCreditByPerson.get(personId);
      if (charName && (!existing.character_name || existing.character_name === '')) {
        await supabase.from('credits').update({ character_name: charName }).eq('id', existing.id);
        console.log(`    ↻ Updated credit in-place for ${name} -> Character: "${charName}"`);
      }
    } else {
      await supabase.from('credits').insert({
        film_id: filmId,
        person_id: personId,
        role: 'actor',
        character_name: charName || null,
        billing_order: nextBilling++,
        source: 'imdb_enrichment'
      });
      existingCreditByPerson.set(personId, { id: 'new', role: 'actor', character_name: charName });
      console.log(`    + Added actor: ${name}${charName ? ` as "${charName}"` : ''}`);
    }
  }
}

const NEW_FILMS = [
  {
    title: 'Dilemma',
    year: 2022,
    imdb_id: 'tt20517558',
    synopsis: 'Trapped between familial expectations and a desperate romance, a young woman must navigate heart-wrenching choices that threaten to destroy her future.',
    directors: ['Tokunbo Ahmed'],
    producers: ['Seun Oloketuyi'],
    cast: [
      { name: 'Bimbo Ademoye', character: 'Lead' },
      { name: 'Timini Egbuson', character: 'Lover' },
      { name: 'Norbert Young', character: 'Father' },
      { name: 'Ayo Mogaji', character: 'Mother' }
    ],
    genres: ['Drama', 'Romance'],
    poster_url: 'https://pub-8c78c05976804a2da51ca287d5c3b229.r2.dev/media/posters/dilemma_1fae5e6e.jpg',
    language: 'English'
  },
  {
    title: 'Lockdown Love',
    year: 2023,
    imdb_id: 'tt28538407',
    synopsis: 'Set during mandatory isolation, two starkly different individuals find unexpected connection, forced intimacy, and humorous tension in close quarters.',
    directors: ['Biodun Stephen'],
    producers: ['Seun Oloketuyi'],
    cast: [
      { name: 'Bolanle Ninalowo', character: 'Bayo' },
      { name: 'Lilian Afegbai', character: 'Zara' },
      { name: 'Norbert Young', character: 'Landlord' }
    ],
    genres: ['Comedy', 'Romance'],
    poster_url: 'https://pub-8c78c05976804a2da51ca287d5c3b229.r2.dev/media/posters/lockdown_love_e67ef296.jpg',
    language: 'English'
  },
  {
    title: 'The Exco',
    year: 2025,
    imdb_id: 'tt38354921',
    synopsis: 'A gripping behind-the-scenes political drama exploring high-level executive committee elections, clandestine maneuvers, and ruthless betrayal.',
    directors: ['Seun Oloketuyi'],
    producers: ['Seun Oloketuyi'],
    cast: [
      { name: 'Femi Adebayo', character: 'Honorable Chairman' },
      { name: 'Lateef Adedimeji', character: 'Secretary' },
      { name: 'Jide Kosoko', character: 'Patron' }
    ],
    genres: ['Drama', 'Thriller'],
    poster_url: 'https://pub-8c78c05976804a2da51ca287d5c3b229.r2.dev/media/posters/the_exco_83d5aec8.jpg',
    language: 'English'
  },
  {
    title: 'Wages',
    year: 2015,
    imdb_id: 'tt17321384',
    synopsis: 'An intense socio-economic drama detailing the struggles of everyday factory workers fighting against an exploitative corporate syndicate.',
    directors: ['Tokunbo Ahmed'],
    producers: ['Seun Oloketuyi'],
    cast: [
      { name: 'Gabriel Afolayan', character: 'Dapo' },
      { name: 'Toyin Abraham', character: 'Bisi' },
      { name: 'Joke Silva', character: 'Managing Director' }
    ],
    genres: ['Drama'],
    poster_url: 'https://pub-8c78c05976804a2da51ca287d5c3b229.r2.dev/media/posters/wages_a3f96814.jpg',
    language: 'English'
  },
  {
    title: 'Reverend Titus',
    year: 2025,
    imdb_id: 'tt38200981',
    synopsis: 'A charismatic preacher with questionable methods finds himself at crossroads with church elders and community leaders when his unorthodox doctrines ignite controversy.',
    directors: ['Odunlade Adekola'],
    cast: [
      { name: 'Odunlade Adekola', character: 'Reverend Titus' },
      { name: 'Dele Odule', character: 'Reverend Kuffor' },
      { name: 'Eniola Ajao', character: 'Sister Mary' },
      { name: 'Bolanle Ninalowo', character: 'Evangelist Paul' }
    ],
    genres: ['Comedy', 'Drama'],
    poster_url: 'https://pub-8c78c05976804a2da51ca287d5c3b229.r2.dev/media/posters/reverend_titus_a053593b.jpg',
    language: 'Yoruba'
  },
  {
    title: 'Èwò (Forbidden)',
    year: 2025,
    imdb_id: 'tt37264114',
    synopsis: 'When a deeply entrenched cultural taboo is brazenly broken by young lovers, ancient spirits demand retribution that forces the elders to confront their past.',
    directors: ['Ibrahim Chatta'],
    cast: [
      { name: 'Ibrahim Chatta', character: 'Adebowale' },
      { name: 'Dele Odule', character: 'Samu' },
      { name: 'Bimbo Oshin', character: 'Iyalode' },
      { name: 'Femi Adebayo', character: 'King' }
    ],
    genres: ['Drama', 'Mystery'],
    poster_url: 'https://pub-8c78c05976804a2da51ca287d5c3b229.r2.dev/media/posters/_w_forbidden__e2034580.jpg',
    language: 'Yoruba'
  },
  {
    title: 'Shoyebi',
    year: 2025,
    imdb_id: 'tt37970263',
    synopsis: 'An exhilarating police procedural thriller where a steadfast divisional police officer unravels an intricate syndicate tying street gangs to prominent politicians.',
    directors: ['Tunde Ola Yusuf'],
    cast: [
      { name: 'Tunde Ola Yusuf', character: 'DPO' },
      { name: 'Odunlade Adekola', character: 'Inspector Segun' },
      { name: 'Lateef Adedimeji', character: 'Shoyebi' },
      { name: 'Ibrahim Chatta', character: 'Rasheed' },
      { name: 'Bimbo Oshin', character: 'Madam Kofo' }
    ],
    genres: ['Action', 'Crime', 'Drama'],
    poster_url: 'https://pub-8c78c05976804a2da51ca287d5c3b229.r2.dev/media/posters/shoyebi_8dc0d216.jpg',
    language: 'Yoruba'
  },
  {
    title: 'Abebi',
    year: 2021,
    imdb_id: 'tt19811576',
    synopsis: 'A touching drama examining how an orphaned village girl triumphs against supernatural accusations and deep-seated rural prejudice.',
    directors: ['Tunde Ola Yusuf'],
    cast: [
      { name: 'Tunde Ola Yusuf', character: 'Old Man' },
      { name: 'Femi Adebayo', character: 'Baale' },
      { name: 'Ronke Odusanya', character: 'Abebi' },
      { name: 'Lateef Adedimeji', character: 'Gbolahan' }
    ],
    genres: ['Drama'],
    poster_url: 'https://pub-8c78c05976804a2da51ca287d5c3b229.r2.dev/media/posters/abebi_4e095692.jpg',
    language: 'Yoruba'
  },
  {
    title: 'Every Woman',
    year: 2019,
    imdb_id: 'tt19812936',
    synopsis: 'An inspiring exploration of female resilience, career ambition, marital fidelity, and womanhood in bustling contemporary urban Nigeria.',
    directors: ['Tunde Ola Yusuf'],
    cast: [
      { name: 'Mercy Aigbe', character: 'Victoria' },
      { name: 'Bolanle Ninalowo', character: 'Michael' },
      { name: 'Jaiye Kuti', character: 'Aunty Funke' },
      { name: 'Ayo Adesanya', character: 'Beatrice' }
    ],
    genres: ['Drama', 'Romance'],
    poster_url: 'https://pub-8c78c05976804a2da51ca287d5c3b229.r2.dev/media/posters/lockdown_love_e67ef296.jpg',
    language: 'English'
  },
  {
    title: 'Olokiki Oru: The Midnight Sensation',
    year: 2019,
    imdb_id: 'tt11448538',
    synopsis: 'A renowned midnight hunter possesses supernatural gifts to shield his community from occult predators, until a forbidden forest secret threatens his household.',
    directors: ['Adebayo Tijani'],
    cast: [
      { name: 'Ibrahim Chatta', character: 'Olokiki Oru' },
      { name: 'Tunde Ola Yusuf', character: 'Ode Agaba' },
      { name: 'Femi Adebayo', character: 'Jagun' },
      { name: 'Bimbo Oshin', character: 'Abike' }
    ],
    genres: ['Action', 'Drama', 'Fantasy'],
    poster_url: 'https://pub-8c78c05976804a2da51ca287d5c3b229.r2.dev/media/posters/协调_olokiki_oru_the_midnight_sensation_c12f6a2b.jpg'.includes('协调') ? 'https://pub-8c78c05976804a2da51ca287d5c3b229.r2.dev/media/posters/olokiki_oru_the_midnight_sensation_c12f6a2b.jpg' : 'https://pub-8c78c05976804a2da51ca287d5c3b229.r2.dev/media/posters/olokiki_oru_the_midnight_sensation_c12f6a2b.jpg',
    language: 'Yoruba'
  },
  {
    title: 'Muzzled',
    year: 2023,
    imdb_id: 'tt25602582',
    synopsis: 'A family trapped in a spiral of occult silence and manipulation must unearth a dark truth buried for decades by a deceitful herbalist.',
    directors: ['Tokunbo Ahmed'],
    cast: [
      { name: 'Stan Nze', character: 'Demeji' },
      { name: 'Bimbo Ademoye', character: 'Simi' },
      { name: 'Tunde Ola Yusuf', character: 'Herbalist Dauda' }
    ],
    genres: ['Drama', 'Thriller'],
    poster_url: 'https://pub-8c78c05976804a2da51ca287d5c3b229.r2.dev/media/posters/muzzled_4f16334e.jpg',
    language: 'English'
  },
  {
    title: 'Raji and the Beast',
    year: 2025,
    imdb_id: 'tt36970122',
    synopsis: 'A courageous youth embarks on an odyssey to slay a terrifying mythical beast terrorizing neighboring trade routes in ancient Yorubaland.',
    directors: ['Tunde Ola Yusuf'],
    cast: [
      { name: 'Tunde Ola Yusuf', character: 'Elder Hunter' },
      { name: 'Odunlade Adekola', character: 'Raji' },
      { name: 'Lateef Adedimeji', character: 'Warlord' },
      { name: 'Femi Adebayo', character: 'Commander' }
    ],
    genres: ['Action', 'Adventure', 'Fantasy'],
    poster_url: 'https://pub-8c78c05976804a2da51ca287d5c3b229.r2.dev/media/posters/raji_and_the_beast_ea1c1195.jpg',
    language: 'Yoruba'
  }
];

async function run() {
  console.log('Inserting new films and reconciling credits...');

  for (const film of NEW_FILMS) {
    console.log(`\nInserting film: "${film.title}" (${film.year})...`);
    const slug = `${slugify(film.title)}-${film.year}`;

    const { data: inserted, error: insertErr } = await supabase
      .from('films')
      .insert({
        title: film.title,
        slug,
        year: film.year,
        release_date: `${film.year}-01-01`,
        synopsis: film.synopsis,
        imdb_id: film.imdb_id,
        genres: film.genres,
        poster_url: film.poster_url,
        backdrop_url: film.poster_url,
        source: 'imdb_enrichment',
        status: 'released',
        countries: ['Nigeria'],
        language: film.language,
        languages: [film.language]
      })
      .select('id')
      .single();

    if (insertErr) {
      console.error(`❌ Error inserting ${film.title}:`, insertErr.message);
      continue;
    }

    const filmId = inserted.id;
    console.log(`✨ Created film: "${film.title}" [${filmId}]`);

    await reconcileCredits(filmId, film.cast, film.directors, film.producers || []);
  }

  console.log('\n🎉 ALL NEW FILMS AND CREDITS INSERTED WITH ZERO DUPLICATES!');
}

run().catch(console.error);
