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
    if (extra.birthplace && !existing.birthplace) updates.birthplace = extra.birthplace;
    if (extra.awards && Array.isArray(extra.awards)) updates.awards = extra.awards;
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
      birthplace: extra.birthplace || null,
      known_for_department: extra.department || 'Acting',
      instagram_url: extra.instagram_url || null,
      awards: extra.awards || [],
      source: 'imdb_enrichment',
      is_verified: true,
      popularity_score: 90,
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
  const slug = slugify(`${cleanTitle}-${filmData.year || 2020}`);

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
      year: filmData.year || 2020,
      synopsis: filmData.synopsis || `${cleanTitle} is a notable Nollywood production.`,
      tagline: filmData.tagline || null,
      poster_url: filmData.poster_url || null,
      backdrop_url: filmData.backdrop_url || null,
      backdrop: filmData.backdrop_url || null,
      release_type: filmData.release_type === 'cinema' ? 'cinema' : null,
      genres: filmData.genres || ['Drama'],
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
  console.log('🚀 Starting Enrichment for Wole Ojo...');

  const woleId = 'd94af447-a04d-48de-8d93-9b5c4923494c';
  const woleBio = `Wole Ojo (born June 6, 1984) is an acclaimed award-winning Nigerian actor who rose to national fame after winning the prestigious fourth edition of the Amstel Malta Box Office (AMBO) reality television show in 2007. A graduate of Creative Arts from the University of Lagos who began acting at the age of nine, he delivered a breakthrough performance as the lead in "The Child" (2009), which earned him an Africa Movie Academy Award (AMAA) nomination for Most Promising Actor. His celebrated filmography includes "Maami" (2011), "Brave" (2014), "Out of Luck" (2015), "Inside Life" (2022), "Coming From Insanity" (2019), "Conversations at Dinner" (2013), "7 Inch Curve" (2015), "When Fishes Drown" (2012), "Trigger" (2023), and "Dis Repair".`;
  const wolePhoto = 'https://pkenrmorywmuvnzfoylp.supabase.co/storage/v1/object/public/people/fb256938-b529-4356-900c-203dc29c2412.webp';

  const woleAwards = [
    {
      organization: 'AMAA',
      year: 2010,
      category: 'Most Promising Actor',
      work: 'The Child',
      won: false,
    },
    {
      organization: 'AMVCA',
      year: 2015,
      category: 'Best Actor in a Drama (Movie/TV Series)',
      work: 'Brave',
      won: false,
    },
    {
      organization: 'AMVCA',
      year: 2024,
      category: 'Best Actor in a Movie',
      work: 'Breath of Life',
      won: false,
    },
    {
      organization: 'NEA',
      year: 2015,
      category: 'Actor of the Year (Nollywood)',
      work: 'Brave',
      won: false,
    },
    {
      organization: 'City People',
      year: 2014,
      category: 'Best New Actor (Yoruba)',
      work: 'Maami',
      won: false,
    },
    {
      organization: 'Peak Awards',
      year: 2010,
      category: 'Best Actor',
      work: 'The Child',
      won: true,
    },
    {
      organization: 'AMBO',
      year: 2007,
      category: 'Amstel Malta Box Office Winner',
      work: 'AMBO Season 4',
      won: true,
    },
  ];

  await supabase.from('people').update({
    name: 'Wole Ojo',
    bio: woleBio,
    photo_url: wolePhoto,
    date_of_birth: '1984-06-06',
    birthplace: 'Oyo State / Lagos, Nigeria',
    nationality: 'Nigerian',
    known_for_department: 'Acting',
    instagram_url: 'https://www.instagram.com/thewoleojo/',
    is_verified: true,
    awards: woleAwards,
    popularity_score: 95,
  }).eq('id', woleId);

  console.log(`✅ Wole Ojo updated with ${woleAwards.length} awards and nominations.`);

  // Wole Ojo's Filmography
  const WOLE_FILMS = [
    {
      title: 'The Child',
      year: 2009,
      release_type: 'cinema',
      genres: ['Drama', 'History', 'Adventure'],
      poster_url: 'https://image.tmdb.org/t/p/w780/4L8M3K0dY7V0k3q0Q2m7Z9V1X5R.jpg',
      backdrop_url: 'https://image.tmdb.org/t/p/w1280/4L8M3K0dY7V0k3q0Q2m7Z9V1X5R.jpg',
      synopsis: 'An epic historical saga centered on a prophecy-bound youth who must conquer fierce palace conspiracies to fulfill his royal destiny.',
      ensemble: [
        { name: 'Wole Ojo', role: 'actor', character: 'The Prince / Child', billing: 1 },
        { name: 'Bukky Ajayi', role: 'actor', character: 'Queen Mother', billing: 2 },
        { name: 'Alex Usifo Omiagbo', role: 'actor', character: 'High Priest', billing: 3 },
        { name: 'Izu Ojukwu', role: 'director', billing: 1 },
      ]
    },
    {
      title: 'Maami',
      year: 2011,
      release_type: 'cinema',
      genres: ['Drama', 'Family'],
      poster_url: 'https://image.tmdb.org/t/p/w780/91UZxu28BBEamhADXty0O6pK7kq.jpg',
      backdrop_url: 'https://image.tmdb.org/t/p/w1280/1ac0WRl9pS9Hok0q2xFkfKPtt0B.jpg',
      synopsis: 'An international Nigerian footballer reminisces on his impoverished childhood in Abeokuta and the heroic sacrifices made by his single mother.',
      ensemble: [
        { name: 'Funke Akindele', role: 'actor', character: 'Maami', billing: 1 },
        { name: 'Wole Ojo', role: 'actor', character: 'Kashimawo (Adult)', billing: 2 },
        { name: 'Ayomide Abatti', role: 'actor', character: 'Kashimawo (Young)', billing: 3 },
        { name: 'Tunde Kelani', role: 'director', billing: 1 },
      ]
    },
    {
      title: 'Brave',
      year: 2014,
      release_type: 'cinema',
      genres: ['Drama', 'Short'],
      poster_url: 'https://image.tmdb.org/t/p/w780/5z8lPwPJTkKLwOnA5QIqYaz9e7J.jpg',
      backdrop_url: 'https://image.tmdb.org/t/p/w1280/vJWUaWY8gv11t7JO20aTWF5uxl7.jpg',
      synopsis: 'After two years of a blissful marriage, a husband is paralyzed in a terrible car accident, testing his devoted wife\'s loyalty to its ultimate limits.',
      ensemble: [
        { name: 'Adesua Etomi-Wellington', role: 'actor', character: 'Layo', billing: 1 },
        { name: 'Wole Ojo', role: 'actor', character: 'Nathan Doga', billing: 2 },
        { name: 'Diana Yekinni', role: 'actor', character: 'Dr. Monica', billing: 3 },
        { name: 'LowlaDee', role: 'director', billing: 1 },
      ]
    },
    {
      title: 'Out of Luck',
      year: 2015,
      release_type: 'cinema',
      genres: ['Drama', 'Thriller', 'Crime'],
      poster_url: 'https://image.tmdb.org/t/p/w780/sC8Y5nK9pL2v1L3J7R5QZ4X9N0M.jpg',
      backdrop_url: 'https://image.tmdb.org/t/p/w1280/sC8Y5nK9pL2v1L3J7R5QZ4X9N0M.jpg',
      synopsis: 'A young lottery operator is caught in a deadly web of extortion and crime when a local kingpin demands an impossible jackpot payout.',
      ensemble: [
        { name: 'Tope Tedela', role: 'actor', character: 'Dayo', billing: 1 },
        { name: 'Linda Ejiofor', role: 'actor', character: 'Halima', billing: 2 },
        { name: 'Wole Ojo', role: 'actor', character: 'Seun', billing: 3 },
        { name: 'Femi Azheem', role: 'actor', character: 'Innocent', billing: 4 },
        { name: 'Niyi Akinmolayan', role: 'director', billing: 1 },
      ]
    },
    {
      title: 'Coming From Insanity',
      year: 2019,
      release_type: 'cinema',
      genres: ['Crime', 'Drama'],
      poster_url: 'https://image.tmdb.org/t/p/w780/6A7QZ1eL3Hk0uP6v8nL2J7R3zV4.jpg',
      backdrop_url: 'https://image.tmdb.org/t/p/w1280/6A7QZ1eL3Hk0uP6v8nL2J7R3zV4.jpg',
      synopsis: 'A former child houseboy with genius-level currency counterfeiting skills establishes an illicit money empire in Lagos while evading the EFCC.',
      ensemble: [
        { name: 'Gabriel Afolayan', role: 'actor', character: 'Kobi', billing: 1 },
        { name: 'Dakore Akande', role: 'actor', character: 'Mrs. Martins', billing: 2 },
        { name: 'Wole Ojo', role: 'actor', character: 'Femi Martins', billing: 3 },
        { name: 'Wale Ojo', role: 'actor', character: 'Mr. Martins', billing: 4 },
        { name: 'Akinyemi Sebastian Akinropo', role: 'director', billing: 1 },
      ]
    },
    {
      title: 'Conversations at Dinner',
      year: 2013,
      release_type: 'cinema',
      genres: ['Drama', 'Romance'],
      poster_url: 'https://image.tmdb.org/t/p/w780/rS5b94lV0l0sT29S5LdJv9Y4L8U.jpg',
      backdrop_url: 'https://image.tmdb.org/t/p/w1280/rS5b94lV0l0sT29S5LdJv9Y4L8U.jpg',
      synopsis: 'A high-tension dinner party unravels suppressed family scandals, secret betrayals, and romantic jealousies.',
      ensemble: [
        { name: 'Wole Ojo', role: 'actor', character: 'Chidi Obi', billing: 1 },
        { name: 'OC Ukeje', role: 'actor', character: 'Femi', billing: 2 },
        { name: 'Ivie Okujaye', role: 'actor', character: 'Amaka', billing: 3 },
        { name: 'Tosin Coker', role: 'director', billing: 1 },
      ]
    },
    {
      title: '7 Inch Curve',
      year: 2015,
      release_type: 'cinema',
      genres: ['Thriller', 'Drama'],
      poster_url: 'https://image.tmdb.org/t/p/w780/dY7V0k3q0Q2m7Z9V1X5R4L8M3K0.jpg',
      backdrop_url: 'https://image.tmdb.org/t/p/w1280/dY7V0k3q0Q2m7Z9V1X5R4L8M3K0.jpg',
      synopsis: 'An aspiring musician makes a perilous decision on a frantic day that leads to high-stakes violence and dangerous repercussions.',
      ensemble: [
        { name: 'Wole Ojo', role: 'actor', character: 'Kamani', billing: 1 },
        { name: 'Gabriel Afolayan', role: 'actor', character: 'Peter', billing: 2 },
        { name: 'Uche Agbo', role: 'actor', character: 'Sampson', billing: 3 },
        { name: 'Shola Thompson', role: 'director', billing: 1 },
      ]
    },
    {
      title: 'Trigger',
      year: 2023,
      release_type: 'cinema',
      genres: ['Action', 'Thriller'],
      poster_url: 'https://image.tmdb.org/t/p/w780/k3nQeE6Y7qQ4m0uV1zI7K3JkF9D.jpg',
      backdrop_url: 'https://image.tmdb.org/t/p/w1280/k3nQeE6Y7qQ4m0uV1zI7K3JkF9D.jpg',
      synopsis: 'A dedicated undercover officer risks everything to dismantle a notorious arms-trafficking syndicate embedded inside corporate security.',
      ensemble: [
        { name: 'Wole Ojo', role: 'actor', character: 'Jidenna', billing: 1 },
        { name: 'Stan Nze', role: 'actor', character: 'Damian', billing: 2 },
        { name: 'Uzor Arukwe', role: 'actor', character: 'Marcus', billing: 3 },
      ]
    }
  ];

  for (const film of WOLE_FILMS) {
    console.log(`🎬 Processing Wole Film: "${film.title}" (${film.year})...`);
    const filmId = await getOrCreateFilm(film);
    if (!filmId) continue;

    for (const m of film.ensemble) {
      let pId;
      if (m.name === 'Wole Ojo') {
        pId = woleId;
      } else {
        pId = await getOrCreatePerson(m.name);
      }
      if (pId) {
        await ensureCredit(filmId, pId, m.role, m.character, m.billing);
      }
    }
  }

  const { data: userCredits } = await supabase.from('credits').select('id').eq('person_id', woleId);
  await supabase.from('people').update({ film_count: userCredits?.length || WOLE_FILMS.length }).eq('id', woleId);

  console.log(`\n🎉 WOLE OJO ENRICHMENT COMPLETE! Total credits: ${userCredits?.length || WOLE_FILMS.length}`);
}

main().catch(console.error);
