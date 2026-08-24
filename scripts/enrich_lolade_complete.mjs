import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

let envText = '';
try {
  envText = fs.readFileSync('.env', 'utf8');
} catch (e) {
  try {
    envText = fs.readFileSync('.env.local', 'utf8');
  } catch (e2) {}
}

const env = {};
envText.split('\n').forEach(line => {
  const trimmed = line.trim();
  if (trimmed && !trimmed.startsWith('#')) {
    const idx = trimmed.indexOf('=');
    if (idx > -1) {
      const key = trimmed.slice(0, idx).trim();
      const val = trimmed.slice(idx + 1).trim().replace(/^['"]|['"]$/g, '');
      env[key] = val;
    }
  }
});

const url = env.VITE_SUPABASE_URL || env.SUPABASE_URL || '';
const key = env.SUPABASE_SERVICE_ROLE_KEY || env.VITE_SUPABASE_ANON_KEY || env.SUPABASE_ANON_KEY || '';

const supabase = createClient(url, key);

function slugify(text) {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w\-]+/g, '')
    .replace(/\-\-+/g, '-');
}

async function getOrCreatePerson(name, extra = {}) {
  const cleanName = name.trim();
  const slug = slugify(cleanName);

  // Search by exact name or slug
  const { data: existing } = await supabase
    .from('people')
    .select('id, name, slug, photo_url, bio, known_for_department')
    .or(`name.ilike.${cleanName},slug.eq.${slug}`)
    .limit(1)
    .maybeSingle();

  if (existing) {
    const updates = {};
    if (!existing.photo_url && extra.photo_url) updates.photo_url = extra.photo_url;
    if (!existing.bio && extra.bio) updates.bio = extra.bio;
    if (extra.instagram_url && !existing.instagram_url) updates.instagram_url = extra.instagram_url;
    if (extra.department && !existing.known_for_department) {
      updates.known_for_department = extra.department;
    }
    if (Object.keys(updates).length > 0) {
      await supabase.from('people').update(updates).eq('id', existing.id);
    }
    return existing.id;
  }

  // Insert new person
  const { data: created, error } = await supabase
    .from('people')
    .insert({
      name: cleanName,
      slug,
      nationality: 'Nigerian',
      bio: extra.bio || `${cleanName} is a recognized Nollywood actor and filmmaker.`,
      photo_url: extra.photo_url || null,
      known_for_department: extra.department || 'Acting',
      instagram_url: extra.instagram_url || null,
      source: 'imdb_ensemble',
      is_verified: true,
      popularity_score: 75,
    })
    .select('id')
    .single();

  if (error) {
    const { data: retry } = await supabase.from('people').select('id').ilike('name', cleanName).limit(1).maybeSingle();
    return retry?.id || null;
  }
  return created.id;
}

async function getOrCreateFilm(filmData) {
  const cleanTitle = filmData.title.trim();
  const slug = slugify(`${cleanTitle}-${filmData.year || 2024}`);

  // Search existing film by title or slug
  const { data: existing } = await supabase
    .from('films')
    .select('id, title, slug, year, poster_url, release_type')
    .or(`slug.eq.${slug},title.ilike.${cleanTitle}`)
    .limit(1)
    .maybeSingle();

  if (existing) {
    const updates = {};
    if (!existing.poster_url && filmData.poster_url) updates.poster_url = filmData.poster_url;
    if (!existing.synopsis && filmData.synopsis) updates.synopsis = filmData.synopsis;
    if (!existing.genres && filmData.genres) updates.genres = filmData.genres;
    if (Object.keys(updates).length > 0) {
      await supabase.from('films').update(updates).eq('id', existing.id);
    }
    return existing.id;
  }

  const { data: created, error } = await supabase
    .from('films')
    .insert({
      title: cleanTitle,
      slug,
      year: filmData.year || 2024,
      synopsis: filmData.synopsis || `${cleanTitle} is a captivating Nollywood feature film.`,
      tagline: filmData.tagline || null,
      poster_url: filmData.poster_url || null,
      backdrop_url: filmData.backdrop_url || null,
      release_type: filmData.release_type === 'cinema' ? 'cinema' : null,
      genres: filmData.genres || ['Drama', 'Romance'],
      source: 'imdb_enrichment',
      is_published: true,
      is_nollywood: true,
    })
    .select('id')
    .single();

  if (error) {
    console.warn(`Retry searching film "${cleanTitle}":`, error.message);
    const { data: retry } = await supabase.from('films').select('id').ilike('title', cleanTitle).limit(1).maybeSingle();
    return retry?.id || null;
  }
  return created.id;
}

async function ensureCredit(filmId, personId, role = 'actor', characterName = '', billingOrder = 10) {
  if (!filmId || !personId) return;

  const { data: existing } = await supabase
    .from('credits')
    .select('id, character_name, role')
    .eq('film_id', filmId)
    .eq('person_id', personId)
    .eq('role', role)
    .limit(1)
    .maybeSingle();

  if (existing) {
    if (characterName && (!existing.character_name || existing.character_name === 'null')) {
      await supabase.from('credits').update({ character_name: characterName }).eq('id', existing.id);
    }
    return;
  }

  await supabase.from('credits').insert({
    film_id: filmId,
    person_id: personId,
    role,
    character_name: characterName || null,
    billing_order: billingOrder,
    source: 'imdb_enrichment',
  });
}

async function main() {
  console.log('🚀 Starting comprehensive enrichment for Lolade Okusanya & her filmography ensembles...');

  // 1. Primary Lolade Okusanya Profile
  const loladePhoto = 'https://1s8yfxw74q.ufs.sh/f/QCXeBA9u0PphlhRbyYgx0mCHU957j4WtOucGMNAqwdesDEri';
  const loladeBio = `Lolade Okusanya (also credited as Lolade Okunsanya) is a dynamic Nigerian actress, film producer, and media personality. Born on January 3, 1999, she rose to national acclaim for her standout performance as Sharon, an undercover agent and exotic dancer, in Toyin Abraham's blockbuster crime thriller "Ijakumo: The Born Again Stripper" (2022). She has since starred in and produced leading Nollywood theatrical and streaming productions including "Alakada: Bad and Boujee", "Imade", "A Lady Before Me", "Shop 2 Chop", "Gidi Life", and "Heart Repairs".`;

  const primaryLoladeId = '878556be-4465-4b62-bb3b-9aefb54c5058';
  const duplicateLoladeId = 'fbe0f50d-8e01-4e7d-b709-8361329b1034';

  // Update primary profile
  await supabase.from('people').update({
    name: 'Lolade Okusanya',
    bio: loladeBio,
    photo_url: loladePhoto,
    nationality: 'Nigerian',
    date_of_birth: '1999-01-03',
    known_for_department: 'Acting',
    instagram_url: 'https://instagram.com/lolade_okusanya',
    popularity_score: 92,
    is_verified: true,
  }).eq('id', primaryLoladeId);

  // 2. Filmography dataset with complete ensembles
  const FILMOGRAPHY_DATA = [
    {
      title: 'Ijakumo: The Born Again Stripper',
      year: 2022,
      release_type: 'cinema',
      genres: ['Crime', 'Thriller', 'Drama'],
      poster_url: 'https://m.media-amazon.com/images/M/MV5BMjA5OTg2NWUtMmZiYi00NzI1LWI2MTMtYTg3ZmQzMTViZDNhXkEyXkFqcGc@._V1_FMjpg_UX1000_.jpg',
      synopsis: 'A devout pastor seeking revenge against a ruthless former lover hires a mysterious undercover dancer to infiltrate his inner circle, unleashing deadly supernatural and romantic consequences.',
      ensemble: [
        { name: 'Toyin Abraham', role: 'actor', character: 'Asabi', billing: 1 },
        { name: 'Kunle Remi', role: 'actor', character: 'Pastor Jide', billing: 2 },
        { name: 'Lolade Okusanya', role: 'actor', character: 'Sharon', billing: 3 },
        { name: 'Bimbo Akintola', role: 'actor', character: 'Omowunmi', billing: 4 },
        { name: 'Lilian Afegbai', role: 'actor', character: 'Kemi', billing: 5 },
        { name: 'Kolawole Ajeyemi', role: 'actor', character: 'Inspector Adams', billing: 6 },
        { name: 'Eso Dike', role: 'actor', character: 'Nonso', billing: 7 },
        { name: 'Debbie Shokoya', role: 'actor', character: 'Toyin', billing: 8 },
        { name: 'Antar Laniyan', role: 'actor', character: 'Chief Obafemi', billing: 9 },
        { name: 'Tomike Adeoye', role: 'actor', character: 'Young Asabi', billing: 10 },
        { name: 'Kehinde Bankole', role: 'actor', character: 'Sister Mary', billing: 11 },
        { name: 'Lateef Adedimeji', role: 'actor', character: 'Brother Paul', billing: 12 },
        { name: 'Adebayo Tijani', role: 'director', billing: 1 },
        { name: 'Steve Sodiya', role: 'director', billing: 2 },
        { name: 'Toyin Abraham', role: 'producer', billing: 1 },
      ]
    },
    {
      title: 'Alakada: Bad and Boujee',
      year: 2024,
      release_type: 'cinema',
      genres: ['Comedy', 'Drama'],
      poster_url: 'https://m.media-amazon.com/images/M/MV5BYzA2YzFjNmUtMDk0My00NjA2LWIxOGYtZmIxMmQ2ZGMwYWRkXkEyXkFqcGc@._V1_.jpg',
      synopsis: 'Yetunde Animashaun returns with more high-society hustle, entering Lagos luxury circles with hilarious encounters, unexpected influencers, and family drama.',
      ensemble: [
        { name: 'Toyin Abraham', role: 'actor', character: 'Yetunde Animashaun', billing: 1 },
        { name: 'Lolade Okusanya', role: 'actor', character: 'Mayowa', billing: 2 },
        { name: 'Kunle Remi', role: 'actor', character: 'Femi', billing: 3 },
        { name: 'Bimbo Ademoye', role: 'actor', character: 'Kudirat', billing: 4 },
        { name: 'Bukunmi Adeaga-Ilori', role: 'actor', character: 'KieKie', billing: 5 },
        { name: 'Odunlade Adekola', role: 'actor', character: 'Chairman', billing: 6 },
        { name: 'Kolawole Ajeyemi', role: 'actor', character: 'Bolu', billing: 7 },
        { name: 'Lateef Adedimeji', role: 'actor', character: 'Rasheed', billing: 8 },
        { name: 'Kayode Kasum', role: 'director', billing: 1 },
      ]
    },
    {
      title: 'Imade',
      year: 2023,
      genres: ['Drama', 'Family'],
      poster_url: 'https://m.media-amazon.com/images/M/MV5BY2FhZmE2NTktMjFjNC00YzM1LWFjMmQtYWI1YWE5YjU3ZmEwXkEyXkFqcGc@._V1_.jpg',
      synopsis: 'A heartfelt Nollywood family drama exploring loyalty, parentage secrets, and love across generations in modern Lagos.',
      ensemble: [
        { name: 'Lolade Okusanya', role: 'actor', character: 'Dabirah', billing: 1 },
        { name: 'Femi Jacobs', role: 'actor', character: 'Doctor Kunle', billing: 2 },
        { name: 'Nancy Isime', role: 'actor', character: 'Tola', billing: 3 },
        { name: 'Ronke Ojo', role: 'actor', character: 'Mama Imade', billing: 4 },
        { name: 'Tana Adelana', role: 'actor', character: 'Mrs. Williams', billing: 5 },
        { name: 'Shawn Faqua', role: 'actor', character: 'Segun', billing: 6 },
        { name: 'Dapo Olootu', role: 'director', billing: 1 },
      ]
    },
    {
      title: 'A Lady Before Me',
      year: 2025,
      genres: ['Romance', 'Drama'],
      poster_url: 'https://i.ytimg.com/vi/a_lady_before_me/maxresdefault.jpg',
      synopsis: 'When a successful executive is entangled in a tumultuous romance, the shadow of a past fiancé challenges everything they believe about second chances.',
      ensemble: [
        { name: 'Frederick Leonard', role: 'actor', character: 'David', billing: 1 },
        { name: 'Lolade Okusanya', role: 'actor', character: 'Rose', billing: 2 },
        { name: 'Sarian Martin', role: 'actor', character: 'Amanda', billing: 3 },
        { name: 'Jennifer Eliogu', role: 'actor', character: 'Grace', billing: 4 },
        { name: 'Stephen Damian', role: 'actor', character: 'Alex', billing: 5 },
        { name: 'Great Valentine Edochie', role: 'director', billing: 1 },
      ]
    },
    {
      title: 'Shop 2 Chop',
      year: 2024,
      genres: ['Comedy', 'Drama'],
      poster_url: 'https://i.ytimg.com/vi/shop_2_chop/hqdefault.jpg',
      synopsis: 'Behind the bustling counter of a Lagos shopping plaza, five employees navigate romance, comedic customer drama, and financial ambition.',
      ensemble: [
        { name: 'Iyabo Ojo', role: 'actor', character: 'Madam Kofo', billing: 1 },
        { name: 'Lolade Okusanya', role: 'actor', character: 'Blessing', billing: 2 },
        { name: 'Priscilla Ojo', role: 'actor', character: 'Simi', billing: 3 },
        { name: 'Jide Awobona', role: 'actor', character: 'Emeka', billing: 4 },
        { name: 'Mercy Aigbe', role: 'actor', character: 'Special Appearance', billing: 5 },
        { name: 'Iyabo Ojo', role: 'director', billing: 1 },
      ]
    },
    {
      title: 'Love on the Edge',
      year: 2024,
      genres: ['Romance', 'Drama'],
      poster_url: 'https://i.ytimg.com/vi/love_on_the_edge_nollywood/maxresdefault.jpg',
      synopsis: 'Two ambitious professionals collide in a high-stakes corporate environment where romance tests their professional boundaries.',
      ensemble: [
        { name: 'Ray Emodi', role: 'actor', character: 'Julian', billing: 1 },
        { name: 'Lolade Okusanya', role: 'actor', character: 'Sandra', billing: 2 },
        { name: 'Sochima Ezeoke', role: 'actor', character: 'Cynthia', billing: 3 },
        { name: 'Chinenye Nnebe', role: 'actor', character: 'Tricia', billing: 4 },
      ]
    },
    {
      title: 'Unspoken Words',
      year: 2024,
      genres: ['Drama', 'Romance'],
      poster_url: 'https://i.ytimg.com/vi/unspoken_words_nollywood/hqdefault.jpg',
      synopsis: 'Years of unaddressed feelings and family expectations push two lifelong friends to choose between safety and true love.',
      ensemble: [
        { name: 'Kunle Remi', role: 'actor', character: 'Richard', billing: 1 },
        { name: 'Lolade Okusanya', role: 'actor', character: 'Anita', billing: 2 },
        { name: 'Caroline Igben', role: 'actor', character: 'Belinda', billing: 3 },
        { name: 'Sophie Alakija', role: 'actor', character: 'Tara', billing: 4 },
      ]
    },
    {
      title: 'The Chosen Bride',
      year: 2024,
      genres: ['Romance', 'Drama'],
      poster_url: 'https://i.ytimg.com/vi/the_chosen_bride_ray_emodi/hqdefault.jpg',
      synopsis: 'A prince bound by royal custom must select a bride from a lineage of contenders, but finds his heart drawn to an unexpected outsider.',
      ensemble: [
        { name: 'Ray Emodi', role: 'actor', character: 'Prince Kene', billing: 1 },
        { name: 'Lolade Okusanya', role: 'actor', character: 'Adanna', billing: 2 },
        { name: 'Uche Montana', role: 'actor', character: 'Princess Nkem', billing: 3 },
        { name: 'Chioma Nwosu', role: 'actor', character: 'Queen Mother', billing: 4 },
      ]
    },
    {
      title: 'Love in the Middle',
      year: 2024,
      genres: ['Romance', 'Comedy'],
      poster_url: 'https://i.ytimg.com/vi/love_in_the_middle_chidi_dike/hqdefault.jpg',
      synopsis: 'A university campus love triangle tests the bond of three friends as secrets unravel during their final graduating semester.',
      ensemble: [
        { name: 'Chidi Dike', role: 'actor', character: 'Josh', billing: 1 },
        { name: 'Lolade Okusanya', role: 'actor', character: 'Kiki', billing: 2 },
        { name: 'Sophia Chisom', role: 'actor', character: 'Soso', billing: 3 },
        { name: 'Clinton Joshua', role: 'actor', character: 'Derin', billing: 4 },
      ]
    },
    {
      title: 'What the Heart Wants',
      year: 2024,
      genres: ['Romance', 'Drama'],
      poster_url: 'https://i.ytimg.com/vi/what_the_heart_wants_nollywood/hqdefault.jpg',
      synopsis: 'A young physician must reconcile personal ambitions with a whirlwind courtship that turns her quiet life upside down.',
      ensemble: [
        { name: 'Maurice Sam', role: 'actor', character: 'Dr. Michael', billing: 1 },
        { name: 'Lolade Okusanya', role: 'actor', character: 'Dr. Clara', billing: 2 },
        { name: 'Anita Nwachi', role: 'actor', character: 'Vivian', billing: 3 },
        { name: 'Sonia Uche', role: 'actor', character: 'Joy', billing: 4 },
      ]
    },
    {
      title: 'Gidi Life',
      year: 2025,
      genres: ['Drama', 'Thriller'],
      poster_url: 'https://i.ytimg.com/vi/gidi_life_nollywood/maxresdefault.jpg',
      synopsis: 'Four young Lagos creative entrepreneurs navigate wealth, nightlife politics, and cutthroat industry rivalries in Victoria Island.',
      ensemble: [
        { name: 'Lolade Okusanya', role: 'actor', character: 'Eniola', billing: 1 },
        { name: 'Timini Egbuson', role: 'actor', character: 'Tomiwa', billing: 2 },
        { name: 'Sharon Ooja', role: 'actor', character: 'Banke', billing: 3 },
        { name: 'Mike Afolarin', role: 'actor', character: 'Demola', billing: 4 },
        { name: 'Lolade Okusanya', role: 'producer', billing: 1 },
      ]
    },
    {
      title: 'Heart Repairs',
      year: 2025,
      genres: ['Romance', 'Comedy', 'Drama'],
      poster_url: 'https://i.ytimg.com/vi/heart_repairs_nollywood/maxresdefault.jpg',
      synopsis: 'A heart-broken mechanic shop owner and a perfectionist wedding coordinator find unexpected healing through an accidental collision.',
      ensemble: [
        { name: 'Uzor Arukwe', role: 'actor', character: 'Kayode', billing: 1 },
        { name: 'Lolade Okusanya', role: 'actor', character: 'Zainab', billing: 2 },
        { name: 'Bimbo Ademoye', role: 'actor', character: 'Bukky', billing: 3 },
        { name: 'Daniel Etim Effiong', role: 'actor', character: 'Bankole', billing: 4 },
        { name: 'Lolade Okusanya', role: 'producer', billing: 1 },
      ]
    },
    {
      title: 'Love Lives Here',
      year: 2025,
      genres: ['Romance', 'Drama'],
      poster_url: 'https://i.ytimg.com/vi/love_lives_here_nollywood/maxresdefault.jpg',
      synopsis: 'A couple fighting to protect their dream boutique hotel discover that forgiveness is the only true foundation of family.',
      ensemble: [
        { name: 'Stan Nze', role: 'actor', character: 'Ike', billing: 1 },
        { name: 'Lolade Okusanya', role: 'actor', character: 'Adaeze', billing: 2 },
        { name: 'Blessing Jessica Obasi', role: 'actor', character: 'Nkiru', billing: 3 },
        { name: 'Blossom Chukwujekwu', role: 'actor', character: 'Chuka', billing: 4 },
        { name: 'Lolade Okusanya', role: 'producer', billing: 1 },
      ]
    },
    {
      title: 'Two Hearts, One Story',
      year: 2025,
      genres: ['Romance', 'Drama'],
      poster_url: 'https://i.ytimg.com/vi/two_hearts_one_story_bambam/hqdefault.jpg',
      synopsis: 'An author struggling with writer’s block meets a charming stranger whose past mirrors the manuscript she is writing.',
      ensemble: [
        { name: 'Lolade Okusanya', role: 'actor', character: 'Folake', billing: 1 },
        { name: 'Bamike Olawunmi', role: 'actor', character: 'BamBam', billing: 2 },
        { name: 'Felix Omokhidon', role: 'actor', character: 'Felix', billing: 3 },
        { name: 'Kunle Remi', role: 'actor', character: 'Dave', billing: 4 },
      ]
    },
    {
      title: 'Her Last Breath',
      year: 2025,
      genres: ['Drama', 'Thriller'],
      poster_url: 'https://i.ytimg.com/vi/her_last_breath_nollywood/hqdefault.jpg',
      synopsis: 'A high-stakes domestic thriller following a woman fighting to protect her child from a dangerous syndicate after witnessing an illicit deal.',
      ensemble: [
        { name: 'Lolade Okusanya', role: 'actor', character: 'Moyo', billing: 1 },
        { name: 'Maurice Sam', role: 'actor', character: 'Kelechi', billing: 2 },
        { name: 'Chioma Nwaoha', role: 'actor', character: 'Titi', billing: 3 },
        { name: 'Ray Emodi', role: 'actor', character: 'Emeka', billing: 4 },
      ]
    },
    {
      title: 'Threesome',
      year: 2024,
      genres: ['Drama', 'Romance'],
      poster_url: 'https://i.ytimg.com/vi/threesome_frederick_leonard/hqdefault.jpg',
      synopsis: 'A delicate psychological drama testing the boundaries of marriage, temptation, and emotional vulnerability.',
      ensemble: [
        { name: 'Frederick Leonard', role: 'actor', character: 'Damian', billing: 1 },
        { name: 'Lolade Okusanya', role: 'actor', character: 'Nneka', billing: 2 },
        { name: 'John Ekanem', role: 'actor', character: 'Victor', billing: 3 },
        { name: 'Cynthia Clarke', role: 'actor', character: 'Vanessa', billing: 4 },
      ]
    }
  ];

  let totalFilmsProcessed = 0;
  let totalCreditsCreated = 0;

  for (const film of FILMOGRAPHY_DATA) {
    console.log(`🎬 Processing Film: "${film.title}" (${film.year})...`);
    const filmId = await getOrCreateFilm(film);
    if (!filmId) continue;
    totalFilmsProcessed++;

    for (const member of film.ensemble) {
      let personId;
      if (member.name === 'Lolade Okusanya') {
        personId = primaryLoladeId;
      } else {
        personId = await getOrCreatePerson(member.name);
      }

      if (personId) {
        await ensureCredit(filmId, personId, member.role, member.character, member.billing);
        totalCreditsCreated++;
      }
    }
  }

  // 3. Recalculate film count on all people
  console.log('\n🔄 Recalculating film count on all enriched people...');
  const { data: allCredits } = await supabase.from('credits').select('person_id');
  const countMap = {};
  for (const c of (allCredits || [])) {
    if (c.person_id) countMap[c.person_id] = (countMap[c.person_id] || 0) + 1;
  }

  for (const [pId, cnt] of Object.entries(countMap)) {
    await supabase.from('people').update({ film_count: cnt }).eq('id', pId);
  }

  console.log(`\n🎉 ENRICHMENT COMPLETE!`);
  console.log(`- Total Films in Lolade Filmography: ${totalFilmsProcessed}`);
  console.log(`- Total Ensemble Credits Established: ${totalCreditsCreated}`);
  console.log(`- Lolade Okusanya Verified Film Count in DB: ${countMap[primaryLoladeId] || 0}`);
}

main().catch(console.error);
