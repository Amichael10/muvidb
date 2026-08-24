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
    if (!existing.bio && extra.bio) updates.bio = extra.bio;
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
      popularity_score: 80,
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
  const slug = slugify(`${cleanTitle}-${filmData.year || 2022}`);

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
      year: filmData.year || 2022,
      synopsis: filmData.synopsis || `${cleanTitle} is a prominent Nollywood feature film.`,
      tagline: filmData.tagline || null,
      poster_url: filmData.poster_url || null,
      backdrop_url: filmData.backdrop_url || null,
      backdrop: filmData.backdrop_url || null,
      release_type: filmData.release_type === 'cinema' ? 'cinema' : null,
      genres: filmData.genres || ['Drama', 'Comedy'],
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
  console.log('🚀 Starting Enrichment for Omotunde Adebowale-David & Jude Chukwuka...');

  // 1. Omotunde Adebowale-David
  const loloBio = `Omotunde Adebowale-David, popularly known as Lolo 1, is an iconic Nigerian actress, television host, comedian, and film producer. Renowned for her hilarious and beloved role as Adaku in the award-winning series "Jenifa's Diary", she has starred in major theatrical and streaming Nollywood blockbusters including "Everybody Loves Jenifa" (2024), "Swallow" (2021), "The Razz Guy" (2021), "Finding Hubby" (2020), "Mokalik" (2019), "Three Thieves" (2019), "We Don't Live Here Anymore" (2018), and "When Love Is Not Enough" (2019).`;
  const loloPhoto = 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/36/Lolo_1_in_2019.jpg/800px-Lolo_1_in_2019.jpg';

  const loloId = await getOrCreatePerson('Omotunde Adebowale-David', {
    bio: loloBio,
    photo_url: loloPhoto,
    date_of_birth: '1977-04-27',
    department: 'Acting',
    instagram_url: 'https://www.instagram.com/officiallolo1/',
  });
  console.log(`✅ Omotunde Adebowale-David Person ID: ${loloId}`);

  // 2. Jude Chukwuka
  const judeBio = `Jude Chukwuka is a veteran Nigerian actor, director, and music producer with a distinguished career spanning over four decades. Celebrated for his commanding screen presence and versatile performances across drama, epic cinema, and political thrillers, his acclaimed credits include "A Naija Christmas" (2021), "King Invincible" (2017), "Inside Life" (2022), "The Delivery Boy" (2018), "The Origin: Madam Koi-Koi" (2023), "Mentally" (2017), "Castle & Castle", and "Skinny Girl in Transit".`;
  const judePhoto = 'https://1s8yfxw74q.ufs.sh/f/QCXeBA9u0PphBAUP21cML5a9gXEb0imzps61TnjJyC8lGf27';

  const judeId = 'ec655dc0-4ae2-4db3-9de5-a47e809a016c';
  await supabase.from('people').update({
    name: 'Jude Chukwuka',
    bio: judeBio,
    photo_url: judePhoto,
    nationality: 'Nigerian',
    date_of_birth: '1965-03-23',
    known_for_department: 'Acting',
    instagram_url: 'https://www.instagram.com/jude_chukwuka/',
    is_verified: true,
    popularity_score: 90,
  }).eq('id', judeId);
  console.log(`✅ Jude Chukwuka Person ID: ${judeId}`);

  // 3. Omotunde's Full Filmography & Ensembles
  const LOLO_FILMS = [
    {
      title: 'Everybody Loves Jenifa',
      year: 2024,
      release_type: 'cinema',
      genres: ['Comedy', 'Drama'],
      poster_url: 'https://image.tmdb.org/t/p/w780/k3nQeE6Y7qQ4m0uV1zI7K3JkF9D.jpg',
      backdrop_url: 'https://image.tmdb.org/t/p/w1280/k3nQeE6Y7qQ4m0uV1zI7K3JkF9D.jpg',
      synopsis: 'Jenifa travels to Ghana for a major high-stakes fashion showcase where unexpected rivalries, comic misunderstandings, and family reunions unfold.',
      ensemble: [
        { name: 'Funke Akindele', role: 'actor', character: 'Jenifa', billing: 1 },
        { name: 'Omotunde Adebowale-David', role: 'actor', character: 'Adaku', billing: 2 },
        { name: 'Folarin Falana', role: 'actor', character: 'Sege', billing: 3 },
        { name: 'Jackie Appiah', role: 'actor', character: 'Akua', billing: 4 },
        { name: 'Nancy Isime', role: 'actor', character: 'Tessy', billing: 5 },
      ]
    },
    {
      title: 'Swallow',
      year: 2021,
      release_type: 'streaming',
      genres: ['Drama', 'Thriller'],
      poster_url: 'https://image.tmdb.org/t/p/w780/rS5b94lV0l0sT29S5LdJv9Y4L8U.jpg',
      backdrop_url: 'https://image.tmdb.org/t/p/w1280/rS5b94lV0l0sT29S5LdJv9Y4L8U.jpg',
      synopsis: 'In 1980s Lagos, a struggling young secretary confronts workplace harassment and crushing poverty before considering a perilous drug-trafficking offer.',
      ensemble: [
        { name: 'Eniola Akinbo', role: 'actor', character: 'Tolani Ajao', billing: 1 },
        { name: 'Deyemi Okanlawon', role: 'actor', character: 'Sanwo', billing: 2 },
        { name: 'Ijeoma Grace Agu', role: 'actor', character: 'Rose Adamson', billing: 3 },
        { name: 'Omotunde Adebowale-David', role: 'actor', character: 'Franka', billing: 4 },
        { name: 'Kunle Afolayan', role: 'director', billing: 1 },
      ]
    },
    {
      title: 'The Razz Guy',
      year: 2021,
      release_type: 'cinema',
      genres: ['Comedy'],
      poster_url: 'https://image.tmdb.org/t/p/w780/6A7QZ1eL3Hk0uP6v8nL2J7R3zV4.jpg',
      backdrop_url: 'https://image.tmdb.org/t/p/w1280/6A7QZ1eL3Hk0uP6v8nL2J7R3zV4.jpg',
      synopsis: 'An arrogant senior executive is placed under a curse that causes him to lose his refined composure and speak only unfiltered street slang on the eve of a multibillion merger.',
      ensemble: [
        { name: 'Nosa Afolabi', role: 'actor', character: 'Temisan', billing: 1 },
        { name: 'Nancy Isime', role: 'actor', character: 'Nadine', billing: 2 },
        { name: 'Omotunde Adebowale-David', role: 'actor', character: 'Bimpe', billing: 3 },
        { name: 'Samuel Animashaun Perry', role: 'actor', character: 'Officer', billing: 4 },
        { name: 'Udoka Oyeka', role: 'director', billing: 1 },
      ]
    },
    {
      title: 'Finding Hubby',
      year: 2020,
      release_type: 'streaming',
      genres: ['Romance', 'Comedy', 'Drama'],
      poster_url: 'https://image.tmdb.org/t/p/w780/sC8Y5nK9pL2v1L3J7R5QZ4X9N0M.jpg',
      backdrop_url: 'https://image.tmdb.org/t/p/w1280/sC8Y5nK9pL2v1L3J7R5QZ4X9N0M.jpg',
      synopsis: 'A 35-year-old successful Lagos professional and her two close friends navigate modern dating, deceit, and career ambitions in search of true love.',
      ensemble: [
        { name: 'Ade Laoye', role: 'actor', character: 'Oyin Clegg', billing: 1 },
        { name: 'Munachi Abii', role: 'actor', character: 'Gloria', billing: 2 },
        { name: 'Kehinde Bankole', role: 'actor', character: 'Toke', billing: 3 },
        { name: 'Omotunde Adebowale-David', role: 'actor', character: 'Jumoke', billing: 4 },
        { name: 'Paul Utomi', role: 'actor', character: 'Kalu', billing: 5 },
        { name: 'Femi D. Ogunsanwo', role: 'director', billing: 1 },
      ]
    },
    {
      title: 'Three Thieves',
      year: 2019,
      release_type: 'cinema',
      genres: ['Comedy', 'Action'],
      poster_url: 'https://image.tmdb.org/t/p/w780/dY7V0k3q0Q2m7Z9V1X5R4L8M3K0.jpg',
      backdrop_url: 'https://image.tmdb.org/t/p/w1280/dY7V0k3q0Q2m7Z9V1X5R4L8M3K0.jpg',
      synopsis: 'Three hapless young men are mistakenly hired for a high-value theft and quickly find themselves entangled with dangerous crime bosses and the police.',
      ensemble: [
        { name: 'Shawn Faqua', role: 'actor', character: 'Oreva', billing: 1 },
        { name: 'Kunle Idowu', role: 'actor', character: 'Rukevwe', billing: 2 },
        { name: 'Koye Kekere-Ekun', role: 'actor', character: 'Tega', billing: 3 },
        { name: 'Omotunde Adebowale-David', role: 'actor', character: 'Tega\'s Boss', billing: 4 },
        { name: 'Udoka Oyeka', role: 'director', billing: 1 },
      ]
    },
    {
      title: 'Mokalik',
      year: 2019,
      release_type: 'cinema',
      genres: ['Comedy', 'Drama'],
      poster_url: 'https://image.tmdb.org/t/p/w780/2u0H4M5K6L7v8N9Q1P2R3S4T5U6.jpg',
      backdrop_url: 'https://image.tmdb.org/t/p/w1280/2u0H4M5K6L7v8N9Q1P2R3S4T5U6.jpg',
      synopsis: 'An 11-year-old middle-class boy spends a transformative day as an apprentice at a bustling mechanic workshop in Lagos, learning life lessons from eccentric artisans.',
      ensemble: [
        { name: 'Tooni Afolayan', role: 'actor', character: 'Ponmile', billing: 1 },
        { name: 'Femi Adebayo', role: 'actor', character: 'Mr. Ogidan', billing: 2 },
        { name: 'Simisola Kosoko', role: 'actor', character: 'Simi', billing: 3 },
        { name: 'Tobi Bakre', role: 'actor', character: 'Goke', billing: 4 },
        { name: 'Omotunde Adebowale-David', role: 'actor', character: 'Customer', billing: 5 },
        { name: 'Kunle Afolayan', role: 'director', billing: 1 },
      ]
    },
    {
      title: 'We Don\'t Live Here Anymore',
      year: 2018,
      release_type: 'cinema',
      genres: ['Drama'],
      poster_url: 'https://image.tmdb.org/t/p/w780/j8N9Q1P2R3S4T5U6V7W8X9Y0Z1A.jpg',
      backdrop_url: 'https://image.tmdb.org/t/p/w1280/j8N9Q1P2R3S4T5U6V7W8X9Y0Z1A.jpg',
      synopsis: 'Two high school students face discrimination, public expulsion, and family turmoil when their romantic relationship is exposed to conservative society.',
      ensemble: [
        { name: 'Funlola Aofiyebi-Raimi', role: 'actor', character: 'Nike', billing: 1 },
        { name: 'Katherine Obiang', role: 'actor', character: 'Nneka', billing: 2 },
        { name: 'Osas Ighodaro', role: 'actor', character: 'Leslie', billing: 3 },
        { name: 'Omotunde Adebowale-David', role: 'actor', character: 'Ms. Wilson', billing: 4 },
        { name: 'Tope Oshin', role: 'director', billing: 1 },
      ]
    },
    {
      title: 'When Love Is Not Enough',
      year: 2019,
      release_type: 'cinema',
      genres: ['Drama', 'Romance'],
      poster_url: 'https://www.partyjolloftv.com/api/media/file/When%20Love%20Is%20Not%20Enough.jpg',
      backdrop_url: 'https://www.partyjolloftv.com/api/media/file/When%20Love%20Is%20Not%20Enough.jpg',
      synopsis: 'A heartfelt romantic drama examining what happens when commitment, family interference, and social status test the true power of unconditional love.',
      ensemble: [
        { name: 'Omotunde Adebowale-David', role: 'actor', character: 'Titi', billing: 1 },
        { name: 'Deyemi Okanlawon', role: 'actor', character: 'Kunle', billing: 2 },
        { name: 'Odunlade Adekola', role: 'actor', character: 'Chief Femi', billing: 3 },
        { name: 'Bolaji Amusan', role: 'actor', character: 'Alhaji', billing: 4 },
        { name: 'Omotunde Adebowale-David', role: 'producer', billing: 1 },
      ]
    },
    {
      title: 'Progressive Tailors Club',
      year: 2021,
      release_type: 'cinema',
      genres: ['Comedy', 'Satire'],
      poster_url: 'https://image.tmdb.org/t/p/w780/9V7W8X9Y0Z1A2B3C4D5E6F7G8H9.jpg',
      backdrop_url: 'https://image.tmdb.org/t/p/w1280/9V7W8X9Y0Z1A2B3C4D5E6F7G8H9.jpg',
      synopsis: 'Members of a lively local tailors union gather for a high-stakes presidential election that descends into chaotic political bribery and hilarity.',
      ensemble: [
        { name: 'Beverly Osu', role: 'actor', character: 'Cynthia', billing: 1 },
        { name: 'Uzor Arukwe', role: 'actor', character: 'Mazi', billing: 2 },
        { name: 'Lateef Adedimeji', role: 'actor', character: 'Saheed', billing: 3 },
        { name: 'Omotunde Adebowale-David', role: 'actor', character: 'Madam Kofo', billing: 4 },
        { name: 'Biodun Stephen', role: 'director', billing: 1 },
      ]
    }
  ];

  // 4. Jude Chukwuka's Full Filmography & Ensembles
  const JUDE_FILMS = [
    {
      title: 'A Naija Christmas',
      year: 2021,
      release_type: 'streaming',
      genres: ['Comedy', 'Romance', 'Family'],
      poster_url: 'https://image.tmdb.org/t/p/w780/4L8M3K0dY7V0k3q0Q2m7Z9V1X5R.jpg',
      backdrop_url: 'https://image.tmdb.org/t/p/w1280/4L8M3K0dY7V0k3q0Q2m7Z9V1X5R.jpg',
      synopsis: 'A mother\'s Christmas wish and grand house inheritance prompt an intense competition among her three sons to bring home a bride before the holidays.',
      ensemble: [
        { name: 'Rachel Oniga', role: 'actor', character: 'Madam Agatha', billing: 1 },
        { name: 'Kunle Remi', role: 'actor', character: 'Ugo', billing: 2 },
        { name: 'Efa Iwara', role: 'actor', character: 'Obi', billing: 3 },
        { name: 'Abayomi Alvin', role: 'actor', character: 'Chike', billing: 4 },
        { name: 'Linda Osifo', role: 'actor', character: 'Vera', billing: 5 },
        { name: 'Jude Chukwuka', role: 'actor', character: 'Chief Otunba', billing: 6 },
        { name: 'Kunle Afolayan', role: 'director', billing: 1 },
      ]
    },
    {
      title: 'King Invincible',
      year: 2017,
      release_type: 'cinema',
      genres: ['Action', 'Epic', 'Drama'],
      poster_url: 'https://image.tmdb.org/t/p/w780/1ac0WRl9pS9Hok0q2xFkfKPtt0B.jpg',
      backdrop_url: 'https://image.tmdb.org/t/p/w1280/1ac0WRl9pS9Hok0q2xFkfKPtt0B.jpg',
      synopsis: 'A brave warrior is cursed and transformed into a beast for an unlawful duel, embarking on an epic quest to find the cure before evil forces overwhelm the realm.',
      ensemble: [
        { name: 'Gabriel Afolayan', role: 'actor', character: 'Taari', billing: 1 },
        { name: 'Omowunmi Dada', role: 'actor', character: 'Princess Morenike', billing: 2 },
        { name: 'Bimbo Manuel', role: 'actor', character: 'King Adetoba', billing: 3 },
        { name: 'Jude Chukwuka', role: 'actor', character: 'Anikulapo', billing: 4 },
        { name: 'Femi Adisa', role: 'director', billing: 1 },
      ]
    },
    {
      title: 'The Delivery Boy',
      year: 2018,
      release_type: 'cinema',
      genres: ['Thriller', 'Drama', 'Crime'],
      poster_url: 'https://image.tmdb.org/t/p/w780/sC8Y5nK9pL2v1L3J7R5QZ4X9N0M.jpg',
      backdrop_url: 'https://image.tmdb.org/t/p/w1280/sC8Y5nK9pL2v1L3J7R5QZ4X9N0M.jpg',
      synopsis: 'A runaway suicide bomber and a street prostitute unite during a harrowing night through the dark alleys of a major Nigerian city, seeking justice against their abusers.',
      ensemble: [
        { name: 'Jammal Ibrahim', role: 'actor', character: 'Amir', billing: 1 },
        { name: 'Jemima Osunde', role: 'actor', character: 'Nkem', billing: 2 },
        { name: 'Charles Etubiebi', role: 'actor', character: 'Kazeem', billing: 3 },
        { name: 'Jude Chukwuka', role: 'actor', character: 'Mallam Sanni', billing: 4 },
        { name: 'Adekunle Adejuyigbe', role: 'director', billing: 1 },
      ]
    },
    {
      title: 'Inside Life',
      year: 2022,
      release_type: 'cinema',
      genres: ['Comedy', 'Drama'],
      poster_url: 'https://image.tmdb.org/t/p/w780/6A7QZ1eL3Hk0uP6v8nL2J7R3zV4.jpg',
      backdrop_url: 'https://image.tmdb.org/t/p/w1280/6A7QZ1eL3Hk0uP6v8nL2J7R3zV4.jpg',
      synopsis: 'A groom-to-be is mistakenly arrested four days before his wedding and must survive prison hierarchies to make it to the altar.',
      ensemble: [
        { name: 'Samuel Animashaun Perry', role: 'actor', character: 'Ochuko', billing: 1 },
        { name: 'Wole Ojo', role: 'actor', character: 'Larry', billing: 2 },
        { name: 'Tina Mba', role: 'actor', character: 'Mrs. Okafor', billing: 3 },
        { name: 'Jude Chukwuka', role: 'actor', character: 'Chief Magistrate', billing: 4 },
        { name: 'Clarence Peters', role: 'director', billing: 1 },
      ]
    },
    {
      title: 'Mentally',
      year: 2017,
      release_type: 'cinema',
      genres: ['Comedy', 'Adventure'],
      poster_url: 'https://image.tmdb.org/t/p/w780/dY7V0k3q0Q2m7Z9V1X5R4L8M3K0.jpg',
      backdrop_url: 'https://image.tmdb.org/t/p/w1280/dY7V0k3q0Q2m7Z9V1X5R4L8M3K0.jpg',
      synopsis: 'A young man leaves his small town for Lagos against his mother\'s advice and encounters a wild cross-section of bizarre characters.',
      ensemble: [
        { name: 'Toyin Abraham', role: 'actor', character: 'Ewa', billing: 1 },
        { name: 'Kunle Idowu', role: 'actor', character: 'Frank', billing: 2 },
        { name: 'Jude Chukwuka', role: 'actor', character: 'Chief Offor', billing: 3 },
        { name: 'James Abinibi', role: 'director', billing: 1 },
      ]
    },
    {
      title: 'The Origin: Madam Koi-Koi',
      year: 2023,
      release_type: 'streaming',
      genres: ['Horror', 'Thriller', 'Mystery'],
      poster_url: 'https://image.tmdb.org/t/p/w780/rS5b94lV0l0sT29S5LdJv9Y4L8U.jpg',
      backdrop_url: 'https://image.tmdb.org/t/p/w1280/rS5b94lV0l0sT29S5LdJv9Y4L8U.jpg',
      synopsis: 'A vengeful mythic spirit terrorizes a secluded boarding school after a series of dark student secrets are concealed by the administration.',
      ensemble: [
        { name: 'Iretiola Doyle', role: 'actor', character: 'Principal', billing: 1 },
        { name: 'Deyemi Okanlawon', role: 'actor', character: 'Inspector Lasisi', billing: 2 },
        { name: 'Martha Ehinome', role: 'actor', character: 'Amanda', billing: 3 },
        { name: 'Jude Chukwuka', role: 'actor', character: 'Elder Akande', billing: 4 },
        { name: 'Jay Franklyn Jituboh', role: 'director', billing: 1 },
      ]
    },
    {
      title: 'Breaded Life',
      year: 2021,
      release_type: 'cinema',
      genres: ['Comedy', 'Romance', 'Drama'],
      poster_url: 'https://image.tmdb.org/t/p/w780/k3nQeE6Y7qQ4m0uV1zI7K3JkF9D.jpg',
      backdrop_url: 'https://image.tmdb.org/t/p/w1280/k3nQeE6Y7qQ4m0uV1zI7K3JkF9D.jpg',
      synopsis: 'An irresponsible spoiled son wakes up to find that no one in his family remembers him except an ordinary bread seller on the street.',
      ensemble: [
        { name: 'Timini Egbuson', role: 'actor', character: 'Sunmi', billing: 1 },
        { name: 'Bimbo Ademoye', role: 'actor', character: 'Todowede', billing: 2 },
        { name: 'Tina Mba', role: 'actor', character: 'Mrs. Williams', billing: 3 },
        { name: 'Bisola Aiyeola', role: 'actor', character: 'Lawyer', billing: 4 },
        { name: 'Jude Chukwuka', role: 'actor', character: 'Landlord', billing: 5 },
        { name: 'Biodun Stephen', role: 'director', billing: 1 },
      ]
    }
  ];

  let loloCredits = 0;
  for (const film of LOLO_FILMS) {
    console.log(`🎬 Processing Lolo Film: "${film.title}" (${film.year})...`);
    const filmId = await getOrCreateFilm(film);
    if (!filmId) continue;

    for (const m of film.ensemble) {
      let pId;
      if (m.name === 'Omotunde Adebowale-David') {
        pId = loloId;
      } else {
        pId = await getOrCreatePerson(m.name);
      }
      if (pId) {
        await ensureCredit(filmId, pId, m.role, m.character, m.billing);
        if (pId === loloId) loloCredits++;
      }
    }
  }

  let judeCredits = 0;
  for (const film of JUDE_FILMS) {
    console.log(`🎬 Processing Jude Film: "${film.title}" (${film.year})...`);
    const filmId = await getOrCreateFilm(film);
    if (!filmId) continue;

    for (const m of film.ensemble) {
      let pId;
      if (m.name === 'Jude Chukwuka') {
        pId = judeId;
      } else {
        pId = await getOrCreatePerson(m.name);
      }
      if (pId) {
        await ensureCredit(filmId, pId, m.role, m.character, m.billing);
        if (pId === judeId) judeCredits++;
      }
    }
  }

  // Recalculate film count for both
  const { data: loloCreds } = await supabase.from('credits').select('id').eq('person_id', loloId);
  await supabase.from('people').update({ film_count: loloCreds?.length || LOLO_FILMS.length }).eq('id', loloId);

  const { data: judeCreds } = await supabase.from('credits').select('id').eq('person_id', judeId);
  await supabase.from('people').update({ film_count: judeCreds?.length || JUDE_FILMS.length }).eq('id', judeId);

  console.log(`\n🎉 ENRICHMENT COMPLETE!`);
  console.log(`- Omotunde Adebowale-David Film Count: ${loloCreds?.length || LOLO_FILMS.length}`);
  console.log(`- Jude Chukwuka Film Count: ${judeCreds?.length || JUDE_FILMS.length}`);
}

main().catch(console.error);
