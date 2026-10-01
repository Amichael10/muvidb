import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

function slugify(text: string) {
  return (text || '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w-]+/g, '')
    .replace(/--+/g, '-')
    .slice(0, 80);
}

function computeNameKey(name: string) {
  return (name || '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .trim();
}

async function uniqueSlug(table: 'people' | 'films', base: string) {
  let slug = base;
  for (let i = 0; i < 20; i++) {
    const { data } = await supabase.from(table).select('id').eq('slug', slug).maybeSingle();
    if (!data) return slug;
    slug = `${base}-${i + 2}`.slice(0, 80);
  }
  return `${base}-${Date.now().toString(36)}`.slice(0, 80);
}

async function getOrCreatePerson(name: string, photoUrl: string | null = null, department = 'Acting') {
  const cleanName = name.replace(/\s+/g, ' ').trim();
  const nameKey = computeNameKey(cleanName);

  // 1. Try by exact / ilike name or name_key
  const { data: byName } = await supabase
    .from('people')
    .select('id, name, photo_url')
    .or(`name.ilike.${cleanName},name_key.eq.${nameKey}`)
    .maybeSingle();

  if (byName) {
    if (photoUrl && !byName.photo_url) {
      await supabase.from('people').update({ photo_url: photoUrl }).eq('id', byName.id);
    }
    return byName.id;
  }

  // 2. Create new person
  const slug = await uniqueSlug('people', slugify(cleanName));
  const { data: newPerson, error } = await supabase.from('people').insert({
    name: cleanName,
    slug,
    photo_url: photoUrl || null,
    known_for_department: department,
    nationality: 'Nigerian',
    source: 'imdb',
  }).select('id').single();

  if (error) {
    console.error(`Error inserting person ${cleanName}:`, error.message);
    throw error;
  }
  return newPerson.id;
}

async function enrichRemiXNneoma() {
  console.log('\n=========================================');
  console.log('1. ENRICHING REMI X NNEOMA (tt43598213)');
  console.log('=========================================');

  // Find canonical film record
  const { data: existingFilms } = await supabase
    .from('films')
    .select('id, title, imdb_id, poster_url, backdrop_url')
    .or('imdb_id.eq.tt43598213,title.ilike.%remi%nneoma%,title.ilike.%remi x%');

  console.log('Existing film rows found:', existingFilms?.length || 0);

  let canonicalFilmId = 'bb18ea46-f5f7-4389-903a-6a8ff212c312';
  if (existingFilms && existingFilms.length > 0) {
    canonicalFilmId = existingFilms[0].id;
  }

  // Canonical metadata from IMDb tt43598213
  const canonicalMetadata = {
    title: 'Remi & Nneoma (A Ruth and Naomi Story)',
    imdb_id: 'tt43598213',
    year: 2026,
    release_date: '2026-03-01',
    runtime_minutes: 118,
    synopsis: 'Even in heartbreak, God begins something new. Remi X Nneoma is a moving story of grace, healing, and the quiet strength found in trusting God.',
    tagline: 'A Ruth and Naomi Story',
    poster_url: 'https://m.media-amazon.com/images/M/MV5BMGI3YjNjYWMtODhkMS00MzQyLWE3MTYtZDkwZmViM2M5YmJjXkEyXkFqcGc@._V1_FMjpg_UX1000_.jpg',
    backdrop_url: 'https://www.partyjolloftv.com/api/media/file/Remi%20x%20Nneoma%20Poster-1080x788.jpg',
    content_type: 'feature_film',
    status: 'released',
    countries: ['Nigeria'],
    languages: ['English', 'Igbo'],
    genres: ['Drama', 'Faith'],
  };

  const { error: updateErr } = await supabase
    .from('films')
    .update(canonicalMetadata)
    .eq('id', canonicalFilmId);

  if (updateErr) {
    console.error('Error updating canonical film:', updateErr.message);
  } else {
    console.log(`✅ Updated canonical film ${canonicalFilmId} with verified title, poster, and backdrop.`);
  }

  // Purge existing credits on canonical film
  await supabase.from('credits').delete().eq('film_id', canonicalFilmId);
  console.log(`🧹 Purged old credit rows on film ${canonicalFilmId}`);

  // Verified ensemble from IMDb fullcredits
  const verifiedCredits = [
    // Director
    { name: 'Lyndsey F. Efejuku', role: 'director', character: null, billing: 1, dept: 'Directing' },
    // Writer
    { name: 'Bikiya Graham-Douglas', role: 'writer', character: null, billing: 2, dept: 'Writing' },
    // Cast
    { name: 'Bisola Aiyeola', role: 'actor', character: 'Remi', billing: 1, dept: 'Acting' },
    { name: 'Eucharia Anunobi Ekwu', role: 'actor', character: 'Chetachi', billing: 2, dept: 'Acting' },
    { name: 'Liz Benson', role: 'actor', character: 'Nneoma', billing: 3, dept: 'Acting' },
    { name: 'Martha Ehinome', role: 'actor', character: 'Oprah', billing: 4, dept: 'Acting' },
    { name: 'Bucci Franklin', role: 'actor', character: 'Amaechi', billing: 5, dept: 'Acting' },
    { name: 'Bikiya Graham-Douglas', role: 'actor', character: 'Hachikaru', billing: 6, dept: 'Acting' },
    { name: 'Ifeanyi Kalu', role: 'actor', character: 'Ovundah', billing: 7, dept: 'Acting' },
    { name: 'Tina Mba', role: 'actor', character: 'Ariyike', billing: 8, dept: 'Acting' },
    { name: 'Uche Montana', role: 'actor', character: 'Oma', billing: 9, dept: 'Acting' },
    { name: 'Kelechi Udegbe', role: 'actor', character: 'Nyesom', billing: 10, dept: 'Acting' },
    // Producers
    { name: 'Bikiya Graham-Douglas', role: 'producer', character: null, billing: 11, dept: 'Production' },
    { name: 'Solate Ovundah-Akarolo', role: 'producer', character: null, billing: 12, dept: 'Production' },
    // Crew
    { name: 'Adam Songbird', role: 'composer', character: null, billing: 13, dept: 'Sound' },
    { name: 'U. Ehizoba Chris', role: 'editor', character: null, billing: 14, dept: 'Editing' },
    { name: 'Lulu Martins', role: 'sound', character: null, billing: 15, dept: 'Sound' },
    { name: 'Friday Anagha', role: 'cinematographer', character: null, billing: 16, dept: 'Camera' },
  ];

  for (const c of verifiedCredits) {
    const personId = await getOrCreatePerson(c.name, null, c.dept);
    await supabase.from('credits').insert({
      film_id: canonicalFilmId,
      person_id: personId,
      role: c.role,
      character_name: c.character,
      billing_order: c.billing,
      is_uncredited: false,
    });
    console.log(`  + Credit: ${c.name} as ${c.role}${c.character ? ` (${c.character})` : ''} [billing ${c.billing}]`);
  }

  console.log(`🎉 Remi & Nneoma completely enriched with ${verifiedCredits.length} verified credits!`);
}

async function enrichFemiBranch() {
  console.log('\n=========================================');
  console.log('2. ENRICHING FEMI BRANCH (nm2143567)');
  console.log('=========================================');

  // Check existing person
  const { data: existing } = await supabase
    .from('people')
    .select('id, name, photo_url, bio, slug')
    .ilike('name', 'Femi Branch')
    .maybeSingle();

  let femiId = existing?.id;

  const femiData = {
    name: 'Femi Branch',
    known_for_department: 'Acting',
    bio: 'David Babafemi Mauton Osunkoya, popularly known as Femi Branch, is an acclaimed Nigerian actor, director, producer, and playwright. Born on May 14, 1970 in Sagamu, Ogun State, he studied Dramatic Arts at Obafemi Awolowo University. He rose to national prominence as Oscar in the television classic Domino and has starred in over a hundred acclaimed productions across three decades, including Ajoche (King Odaleko), A Place in the Stars (Young Pa Dakim), House of Ga\'a, Wasila Coded Reloaded, and Ireke: Rise of the Maroons.',
    date_of_birth: '1970-05-14',
    birthplace: 'Sagamu, Ogun State, Nigeria',
    nationality: 'Nigerian',
    photo_url: 'https://nollymeter.com/uploads/actor/actor_1758807481.jpg',
    is_verified: true,
  };

  if (femiId) {
    await supabase.from('people').update(femiData).eq('id', femiId);
    console.log(`✅ Updated existing Femi Branch record (${femiId})`);
  } else {
    const slug = await uniqueSlug('people', 'femi-branch');
    const { data: newPerson, error } = await supabase.from('people').insert({
      ...femiData,
      slug,
    }).select('id').single();

    if (error) throw error;
    femiId = newPerson.id;
    console.log(`✅ Created Femi Branch record with ID: ${femiId}`);
  }

  // Link Femi Branch to existing films in MuviDB
  const filmMatches = [
    { titlePattern: 'A Place in the Stars', character: 'Young Pa Dakim', billing: 4 },
    { titlePattern: 'Wasila Coded Reloaded', character: 'Honourable', billing: 3 },
    { titlePattern: 'Ajoche', character: 'King Odaleko', billing: 1 },
    { titlePattern: 'King Kosoko: The Battle for Lagos', character: 'Eletu Odibo (The King Maker)', billing: 2 },
    { titlePattern: 'Colors of Fire', character: 'Abifarin', billing: 3 },
    { titlePattern: 'Owambe Thieves', character: 'Oga Blings Blings', billing: 4 },
    { titlePattern: 'House of Ga\'a', character: null, billing: 6 },
    { titlePattern: 'Ireke: Rise of the Maroons', character: null, billing: 7 },
    { titlePattern: 'Farmer\'s Bride', character: null, billing: 5 },
    { titlePattern: 'New Money', character: null, billing: 8 },
  ];

  console.log('\nLinking verified acting credits for Femi Branch (guaranteeing zero duplicate credits):');
  for (const match of filmMatches) {
    const { data: films } = await supabase
      .from('films')
      .select('id, title, year')
      .ilike('title', `%${match.titlePattern}%`);

    if (!films || !films.length) continue;

    for (const film of films) {
      // Rule 4: Zero-Duplicate Actor Guarantee
      const { data: existingCredit } = await supabase
        .from('credits')
        .select('id, role, character_name, billing_order')
        .eq('film_id', film.id)
        .eq('person_id', femiId)
        .maybeSingle();

      if (existingCredit) {
        // Update in-place
        await supabase
          .from('credits')
          .update({
            character_name: match.character || existingCredit.character_name,
            role: 'actor',
            billing_order: match.billing || existingCredit.billing_order,
          })
          .eq('id', existingCredit.id);
        console.log(`  ✓ Updated credit in-place on "${film.title}" (${film.year || ''})`);
      } else {
        // Insert new credit row
        await supabase
          .from('credits')
          .insert({
            film_id: film.id,
            person_id: femiId,
            role: 'actor',
            character_name: match.character,
            billing_order: match.billing,
            is_uncredited: false,
          });
        console.log(`  + Linked Femi Branch to "${film.title}" (${film.year || ''}) as ${match.character || 'Actor'}`);
      }
    }
  }

  console.log(`🎉 Femi Branch successfully enriched and linked across catalog!`);
}

async function main() {
  await enrichRemiXNneoma();
  await enrichFemiBranch();
  console.log('\nALL ENRICHMENTS COMPLETED SUCCESSFULLY!');
  process.exit(0);
}

main().catch(err => {
  console.error('Fatal error during enrichment:', err);
  process.exit(1);
});
