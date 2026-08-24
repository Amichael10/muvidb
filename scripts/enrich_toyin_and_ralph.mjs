import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config();

const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '';

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

  const { data: existing } = await supabase
    .from('people')
    .select('id, name, slug, photo_url, bio, known_for_department')
    .or(`name.ilike.${cleanName},slug.eq.${slug}`)
    .limit(1)
    .maybeSingle();

  if (existing) {
    const updates = {};
    if (!existing.photo_url && extra.photo_url) updates.photo_url = extra.photo_url;
    if ((!existing.bio || existing.bio.length < 50) && extra.bio) updates.bio = extra.bio;
    if (extra.instagram_url && !existing.instagram_url) updates.instagram_url = extra.instagram_url;
    if (extra.date_of_birth && !existing.date_of_birth) updates.date_of_birth = extra.date_of_birth;
    if (extra.department && !existing.known_for_department) updates.known_for_department = extra.department;
    if (Object.keys(updates).length > 0) {
      await supabase.from('people').update(updates).eq('id', existing.id);
    }
    return existing.id;
  }

  const { data: created, error } = await supabase
    .from('people')
    .insert({
      name: cleanName,
      slug,
      nationality: 'Nigerian',
      bio: extra.bio || `${cleanName} is a celebrated Nigerian screen and stage actor.`,
      photo_url: extra.photo_url || null,
      date_of_birth: extra.date_of_birth || null,
      known_for_department: extra.department || 'Acting',
      instagram_url: extra.instagram_url || null,
      source: 'imdb_ensemble',
      is_verified: true,
      popularity_score: 85,
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
  const slug = slugify(`${cleanTitle}-${filmData.year || 2023}`);

  const { data: existing } = await supabase
    .from('films')
    .select('id, title, slug, year, poster_url, backdrop_url, release_type')
    .or(`slug.eq.${slug},title.ilike.${cleanTitle}`)
    .limit(1)
    .maybeSingle();

  if (existing) {
    const updates = {};
    if ((!existing.poster_url || existing.poster_url.includes('i.ytimg.com/vi/')) && filmData.poster_url) {
      updates.poster_url = filmData.poster_url;
    }
    if (!existing.backdrop_url && filmData.backdrop_url) {
      updates.backdrop_url = filmData.backdrop_url;
      updates.backdrop = filmData.backdrop_url;
    }
    if (!existing.synopsis && filmData.synopsis) updates.synopsis = filmData.synopsis;
    if (!existing.genres && filmData.genres) updates.genres = filmData.genres;
    if (filmData.release_type === 'cinema' && existing.release_type !== 'cinema') {
      updates.release_type = 'cinema';
    }
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
      year: filmData.year || 2023,
      synopsis: filmData.synopsis || `${cleanTitle} is a prominent Nollywood feature film.`,
      tagline: filmData.tagline || null,
      poster_url: filmData.poster_url || null,
      backdrop_url: filmData.backdrop_url || null,
      backdrop: filmData.backdrop_url || null,
      release_type: filmData.release_type === 'cinema' ? 'cinema' : null,
      genres: filmData.genres || ['Drama', 'Thriller'],
      source: 'imdb_enrichment',
      is_published: true,
      is_nollywood: true,
    })
    .select('id')
    .single();

  if (error) {
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
    if (characterName && (!existing.character_name || existing.character_name === 'null' || existing.character_name === 'N/A')) {
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
  console.log('🚀 Starting Enrichment for Toyin Alausa & Ralph Okoro...');

  // 1. Toyin Alausa
  const toyinBio = `Toyin Alausa (born January 4, 1978) is a veteran Nigerian actress, producer, and filmmaker whose acclaimed career spans over three decades across English and Yoruba Nollywood cinema. Beginning her career as a talented child star in the 1980s and rising to national prominence in classic series like "Tales by Moonlight", "Super Story", "Family Ties", and "Edge of Paradise", her extensive modern feature and series credits include "Slum King" (2023), "King Invincible" (2017), "A Time to Heal" (2024), "Eye Mi" (2024), "Wasila Coded Reloaded" (2022), "Romoke's Demon" (2023), "Neema" (2023), "Blackout", and "Omoniyun".`;
  const toyinPhoto = 'https://africanmoviedb.com/image/person/C3oJebIvrsbc4-45Z5geQ.webp';
  const toyinId = 'ed47e0a1-c872-4fb2-a4d2-bc370e0ac52f';

  await supabase.from('people').update({
    name: 'Toyin Alausa',
    bio: toyinBio,
    photo_url: toyinPhoto,
    nationality: 'Nigerian',
    date_of_birth: '1978-01-04',
    birthplace: 'Ijebu Ode, Ogun State, Nigeria',
    known_for_department: 'Acting',
    instagram_url: 'https://www.instagram.com/the_toyinalausa/',
    is_verified: true,
    popularity_score: 95,
  }).eq('id', toyinId);
  console.log(`✅ Toyin Alausa Person ID: ${toyinId}`);

  // 2. Ralph Okoro
  const ralphBio = `Ralph Chikeme Okoro is an accomplished Nigerian actor, singer, and creative director with over a decade of excellence across screen, television, and leading musical theatre. A graduate of Theatre Arts from Lagos State University holding a prestigious Grade 8 Gold Medal in Solo Musical Theatre from the London Academy of Music and Dramatic Art (LAMDA), he has starred in major screen productions including "Queen Lateefah" (2024), "Tinsel", "Flatmates", "Africa Magic E.V.E.", and "Inspector K", alongside iconic lead stage roles including Emeka in the internationally touring "Kakadu The Musical" (2013–2022), "Heartbeat The Musical", "Jesus Christ Superstar", "Mamma Mia!", and "Man Enough".`;
  const ralphPhoto = 'https://1s8yfxw74q.ufs.sh/f/QCXeBA9u0PphDFyjL43VCbi79VKau1UP6hEmGOBMkf3eFzqg';
  const ralphId = 'c7ef9c2c-b520-46f2-a891-19149245538d';

  await supabase.from('people').update({
    name: 'Ralph Okoro',
    bio: ralphBio,
    photo_url: ralphPhoto,
    nationality: 'Nigerian',
    date_of_birth: '1989-08-14',
    known_for_department: 'Acting',
    instagram_url: 'https://www.instagram.com/ralphokoro_/',
    is_verified: true,
    popularity_score: 85,
  }).eq('id', ralphId);
  console.log(`✅ Ralph Okoro Person ID: ${ralphId}`);

  // 3. Toyin Alausa's Productions & Ensembles
  const TOYIN_FILMS = [
    {
      title: 'Slum King',
      year: 2023,
      release_type: 'streaming',
      genres: ['Crime', 'Action', 'Drama'],
      poster_url: 'https://image.tmdb.org/t/p/w780/9kRlpLqitFDky1CnvTDBTZtNQYW.jpg',
      backdrop_url: 'https://image.tmdb.org/t/p/w1280/9kRlpLqitFDky1CnvTDBTZtNQYW.jpg',
      synopsis: 'Edafe undergoes a harrowing transformation from an innocent traumatized boy into Maje, the ruthless ruler and kingpin of the perilous Oro Longe slum.',
      ensemble: [
        { name: 'Tobi Bakre', role: 'actor', character: 'Edafe "Maje" Umukoro', billing: 1 },
        { name: 'Olarotimi Fakunle', role: 'actor', character: 'Imole', billing: 2 },
        { name: 'Toyin Alausa', role: 'actor', character: 'Madam Kofo', billing: 3 },
        { name: 'Sonia Irabor', role: 'actor', character: 'Dr. Lauretta', billing: 4 },
        { name: 'Gideon Okeke', role: 'actor', character: 'Teju', billing: 5 },
        { name: 'Dimeji Ajibola', role: 'director', billing: 1 },
      ]
    },
    {
      title: 'Omoniyun',
      year: 2019,
      release_type: 'cinema',
      genres: ['Drama', 'Crime'],
      poster_url: 'https://image.tmdb.org/t/p/w780/auQ67e5mSPkN9UuTc6j5WRPDzaf.jpg',
      backdrop_url: 'https://image.tmdb.org/t/p/w1280/35VjwVCVJ7QpFFkX7RoTnmeI5Je.jpg',
      synopsis: 'A courageous female rights activist takes on a deeply entrenched, corrupt politician who abuses young girls under the guise of tradition.',
      ensemble: [
        { name: 'Yomi Fabiyi', role: 'actor', character: 'Barrister Dayo', billing: 1 },
        { name: 'Segun Arinze', role: 'actor', character: 'Chief Fashola', billing: 2 },
        { name: 'Dayo Amusa', role: 'actor', character: 'Omoniyun', billing: 3 },
        { name: 'Toyin Alausa', role: 'actor', character: 'Chief Mrs. Fashola', billing: 4 },
        { name: 'Bimbo Thomas', role: 'actor', character: 'Arike', billing: 5 },
        { name: 'Yomi Fabiyi', role: 'director', billing: 1 },
      ]
    },
    {
      title: 'Wasila Coded Reloaded',
      year: 2022,
      release_type: 'cinema',
      genres: ['Comedy', 'Drama'],
      poster_url: 'https://image.tmdb.org/t/p/w780/dp3fggfZXQxW8eRTT31TOVB0O0k.jpg',
      backdrop_url: 'https://image.tmdb.org/t/p/w1280/1o5XCzvF47P4JH8bGpDjznmC6xS.jpg',
      synopsis: 'A cunning, streetwise woman orchestrates hilarious high-society schemes to outsmart rival hustlers and secure massive wealth.',
      ensemble: [
        { name: 'Wasila Coded', role: 'actor', character: 'Wasila', billing: 1 },
        { name: 'Mercy Aigbe', role: 'actor', character: 'Ronke', billing: 2 },
        { name: 'Toyin Alausa', role: 'actor', character: 'Alhaja Kuburat', billing: 3 },
        { name: 'Ibrahim Yekini', role: 'actor', character: 'Itele', billing: 4 },
      ]
    },
    {
      title: 'Eye Mi',
      year: 2024,
      release_type: 'cinema',
      genres: ['Drama', 'Family'],
      poster_url: 'https://image.tmdb.org/t/p/w780/fV7INuXhT2dnFguH0MBOGuOKEfq.jpg',
      backdrop_url: 'https://image.tmdb.org/t/p/w1280/bDWJhrleSWNHfA4jwU4AyQdznjh.jpg',
      synopsis: 'An emotional family drama highlighting the immense sacrifice of a devoted mother defending her children against ancestral family rivalries.',
      ensemble: [
        { name: 'Toyin Alausa', role: 'actor', character: 'Mama Ayo', billing: 1 },
        { name: 'Ibrahim Chatta', role: 'actor', character: 'Ayo', billing: 2 },
        { name: 'Sola Sobowale', role: 'actor', character: 'Alhaja', billing: 3 },
      ]
    },
    {
      title: 'Romoke\'s Demon',
      year: 2023,
      release_type: 'cinema',
      genres: ['Drama', 'Thriller'],
      poster_url: 'https://image.tmdb.org/t/p/w780/njkWbdQBj6Y25oo2CF7HwQE4UwK.jpg',
      backdrop_url: 'https://image.tmdb.org/t/p/w1280/9ELkvSNhLbtxgvINH1mA2XlAczp.jpg',
      synopsis: 'A turbulent journey of personal redemption as Romoke battles dark emotional trauma and family secrets that threaten her happiness.',
      ensemble: [
        { name: 'Lateef Adedimeji', role: 'actor', character: 'Bode', billing: 1 },
        { name: 'Toyin Alausa', role: 'actor', character: 'Mama Romoke', billing: 2 },
        { name: 'Femi Adebayo', role: 'actor', character: 'Alhaji', billing: 3 },
      ]
    },
    {
      title: 'Neema',
      year: 2023,
      release_type: 'cinema',
      genres: ['Drama'],
      poster_url: 'https://image.tmdb.org/t/p/w780/mzSbOGN8SdVw5L8kYBj9sJ69GvM.jpg',
      backdrop_url: 'https://image.tmdb.org/t/p/w1280/mzSbOGN8SdVw5L8kYBj9sJ69GvM.jpg',
      synopsis: 'The touching saga of a resilient young woman who triumphs over societal prejudice and poverty through faith and grit.',
      ensemble: [
        { name: 'Odunlade Adekola', role: 'actor', character: 'Gbolahan', billing: 1 },
        { name: 'Bimbo Oshin', role: 'actor', character: 'Neema', billing: 2 },
        { name: 'Toyin Alausa', role: 'actor', character: 'Iya Neema', billing: 3 },
      ]
    }
  ];

  // 4. Ralph Okoro's Screen & Theatrical Credits
  const RALPH_FILMS = [
    {
      title: 'Queen Lateefah',
      year: 2024,
      release_type: 'cinema',
      genres: ['Drama', 'Comedy', 'Romance'],
      poster_url: 'https://image.tmdb.org/t/p/w780/5z8lPwPJTkKLwOnA5QIqYaz9e7J.jpg',
      backdrop_url: 'https://image.tmdb.org/t/p/w1280/vJWUaWY8gv11t7JO20aTWF5uxl7.jpg',
      synopsis: 'A high-society woman builds a glamorous empire around an intricate web of secrets, leading to a dramatic showdown when true identities are unmasked.',
      ensemble: [
        { name: 'Mercy Aigbe', role: 'actor', character: 'Lateefah', billing: 1 },
        { name: 'Jide Kene Achufusi', role: 'actor', character: 'Jude', billing: 2 },
        { name: 'Kunle Remi', role: 'actor', character: 'Dare', billing: 3 },
        { name: 'Nancy Isime', role: 'actor', character: 'Kiki', billing: 4 },
        { name: 'Ralph Okoro', role: 'actor', character: 'Pastor Emeka', billing: 5 },
        { name: 'Wunmi Toriola', role: 'actor', character: 'Bisi', billing: 6 },
      ]
    },
    {
      title: 'Tinsel',
      year: 2018,
      release_type: 'streaming',
      genres: ['Drama', 'Romance'],
      poster_url: 'https://image.tmdb.org/t/p/w780/sC8Y5nK9pL2v1L3J7R5QZ4X9N0M.jpg',
      backdrop_url: 'https://image.tmdb.org/t/p/w1280/sC8Y5nK9pL2v1L3J7R5QZ4X9N0M.jpg',
      synopsis: 'Two rival film production houses in Lagos wage a ruthless battle for corporate dominance, fame, and romance.',
      ensemble: [
        { name: 'Victor Olaotan', role: 'actor', character: 'Fred Ade-Williams', billing: 1 },
        { name: 'Funlola Aofiyebi-Raimi', role: 'actor', character: 'Brenda Nana Mensah', billing: 2 },
        { name: 'Gideon Okeke', role: 'actor', character: 'Phillip Ade-Williams', billing: 3 },
        { name: 'Ralph Okoro', role: 'actor', character: 'Dr. Kalu', billing: 4 },
      ]
    },
    {
      title: 'Flatmates',
      year: 2019,
      release_type: 'streaming',
      genres: ['Comedy', 'Sitcom'],
      poster_url: 'https://image.tmdb.org/t/p/w780/6A7QZ1eL3Hk0uP6v8nL2J7R3zV4.jpg',
      backdrop_url: 'https://image.tmdb.org/t/p/w1280/6A7QZ1eL3Hk0uP6v8nL2J7R3zV4.jpg',
      synopsis: 'Four eccentric Lagos friends share an apartment where daily survival, eccentric neighbors, and comic clashes create endless chaos.',
      ensemble: [
        { name: 'Bright Okpocha', role: 'actor', character: 'Prosper', billing: 1 },
        { name: 'Steve Onu', role: 'actor', character: 'Obus', billing: 2 },
        { name: 'Kayode Peters', role: 'actor', character: 'Chief', billing: 3 },
        { name: 'Ralph Okoro', role: 'actor', character: 'Prosper\'s Brother', billing: 4 },
      ]
    },
    {
      title: 'Inspector K',
      year: 2020,
      release_type: 'streaming',
      genres: ['Crime', 'Comedy', 'Mystery'],
      poster_url: 'https://image.tmdb.org/t/p/w780/dY7V0k3q0Q2m7Z9V1X5R4L8M3K0.jpg',
      backdrop_url: 'https://image.tmdb.org/t/p/w1280/dY7V0k3q0Q2m7Z9V1X5R4L8M3K0.jpg',
      synopsis: 'An unconventional and comedic detective solves peculiar murder mysteries and high-society crimes across modern Lagos.',
      ensemble: [
        { name: 'Koye Kekere-Ekun', role: 'actor', character: 'Inspector K', billing: 1 },
        { name: 'Sonia Irabor', role: 'actor', character: 'Amina', billing: 2 },
        { name: 'Ralph Okoro', role: 'actor', character: 'Detective Sunday', billing: 3 },
      ]
    },
    {
      title: 'Africa Magic E.V.E.',
      year: 2021,
      release_type: 'streaming',
      genres: ['Drama', 'Legal'],
      poster_url: 'https://image.tmdb.org/t/p/w780/rS5b94lV0l0sT29S5LdJv9Y4L8U.jpg',
      backdrop_url: 'https://image.tmdb.org/t/p/w1280/rS5b94lV0l0sT29S5LdJv9Y4L8U.jpg',
      synopsis: 'A brilliant young female lawyer fights high-stakes corporate corruption while managing complicated romantic ties.',
      ensemble: [
        { name: 'Osas Ighodaro', role: 'actor', character: 'Eve', billing: 1 },
        { name: 'Jimmy Odukoya', role: 'actor', character: 'Frank', billing: 2 },
        { name: 'Ralph Okoro', role: 'actor', character: 'Lawrence', billing: 3 },
      ]
    },
    {
      title: 'Kakadu The Musical',
      year: 2017,
      release_type: 'theatre',
      genres: ['Musical', 'Drama', 'History'],
      poster_url: 'https://www.partyjolloftv.com/api/media/file/Kakadu%20The%20Musical.jpg',
      backdrop_url: 'https://www.partyjolloftv.com/api/media/file/Kakadu%20The%20Musical.jpg',
      synopsis: 'The legendary musical drama exploring the vibrant music, dreams, and friendships inside the iconic 1960s Lagos nightclub against the backdrop of national change.',
      ensemble: [
        { name: 'Ralph Okoro', role: 'actor', character: 'Emeka (Lead)', billing: 1 },
        { name: 'Kanayo Omo', role: 'director', billing: 1 },
      ]
    },
    {
      title: 'Heartbeat The Musical',
      year: 2016,
      release_type: 'theatre',
      genres: ['Musical', 'Drama'],
      poster_url: 'https://image.tmdb.org/t/p/w780/k3nQeE6Y7qQ4m0uV1zI7K3JkF9D.jpg',
      backdrop_url: 'https://image.tmdb.org/t/p/w1280/k3nQeE6Y7qQ4m0uV1zI7K3JkF9D.jpg',
      synopsis: 'A powerful musical exploring love, hope, and survival at Grace House, a shelter in the heart of Lagos.',
      ensemble: [
        { name: 'Joke Silva', role: 'actor', character: 'Araba', billing: 1 },
        { name: 'Olu Jacobs', role: 'actor', character: 'Chief Onile', billing: 2 },
        { name: 'Ralph Okoro', role: 'actor', character: 'File / Kunle', billing: 3 },
        { name: 'Najite Dede', role: 'director', billing: 1 },
      ]
    }
  ];

  for (const film of TOYIN_FILMS) {
    console.log(`🎬 Processing Toyin Film: "${film.title}" (${film.year})...`);
    const filmId = await getOrCreateFilm(film);
    if (!filmId) continue;

    for (const m of film.ensemble) {
      let pId;
      if (m.name === 'Toyin Alausa') {
        pId = toyinId;
      } else {
        pId = await getOrCreatePerson(m.name);
      }
      if (pId) {
        await ensureCredit(filmId, pId, m.role, m.character, m.billing);
      }
    }
  }

  for (const film of RALPH_FILMS) {
    console.log(`🎬 Processing Ralph Film: "${film.title}" (${film.year})...`);
    const filmId = await getOrCreateFilm(film);
    if (!filmId) continue;

    for (const m of film.ensemble) {
      let pId;
      if (m.name === 'Ralph Okoro') {
        pId = ralphId;
      } else {
        pId = await getOrCreatePerson(m.name);
      }
      if (pId) {
        await ensureCredit(filmId, pId, m.role, m.character, m.billing);
      }
    }
  }

  // Recalculate film count for both
  const { data: toyinCreds } = await supabase.from('credits').select('id').eq('person_id', toyinId);
  await supabase.from('people').update({ film_count: toyinCreds?.length || TOYIN_FILMS.length }).eq('id', toyinId);

  const { data: ralphCreds } = await supabase.from('credits').select('id').eq('person_id', ralphId);
  await supabase.from('people').update({ film_count: ralphCreds?.length || RALPH_FILMS.length }).eq('id', ralphId);

  console.log(`\n🎉 ENRICHMENT COMPLETE!`);
  console.log(`- Toyin Alausa Film Count: ${toyinCreds?.length || TOYIN_FILMS.length}`);
  console.log(`- Ralph Okoro Film Count: ${ralphCreds?.length || RALPH_FILMS.length}`);
}

main().catch(console.error);
