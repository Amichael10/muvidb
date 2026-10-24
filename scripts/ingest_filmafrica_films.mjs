import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

function slugify(text) {
  return (text || '')
    .toString()
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '');
}

function normalize(s) {
  return (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '');
}

async function findFilmInDb(title) {
  const normTitle = normalize(title);
  const cleanTitle = title.replace(/\s+/g, ' ').replace(/[’']/g, "'").trim();

  // 1. Exact match on title
  const { data: exact } = await supabase
    .from('films')
    .select('id, title, year, synopsis, poster_url, runtime_minutes')
    .eq('title', cleanTitle)
    .limit(2);
  if (exact && exact.length > 0) return exact[0];

  // 2. Case-insensitive exact match
  const { data: ilikeExact } = await supabase
    .from('films')
    .select('id, title, year, synopsis, poster_url, runtime_minutes')
    .ilike('title', cleanTitle)
    .limit(2);
  if (ilikeExact && ilikeExact.length > 0) return ilikeExact[0];

  // 3. Extract core keywords
  const keywords = cleanTitle
    .replace(/[^\w\s]/g, '')
    .split(/\s+/)
    .filter(w => w.length > 3 && !['with', 'from', 'about', 'what'].includes(w.toLowerCase()));

  if (keywords.length > 0) {
    const pattern = `%${keywords.slice(0, 2).join('%')}%`;
    const { data: keywordMatches } = await supabase
      .from('films')
      .select('id, title, year, synopsis, poster_url, runtime_minutes')
      .ilike('title', pattern)
      .limit(10);

    const match = (keywordMatches || []).find(db => {
      const dbNorm = normalize(db.title);
      return dbNorm === normTitle || (dbNorm.length > 5 && normTitle.includes(dbNorm)) || (normTitle.length > 5 && dbNorm.includes(normTitle));
    });
    if (match) return match;
  }

  return null;
}

async function findOrCreatePerson(name, roleHint = 'Crew') {
  if (!name || name.trim().length < 2) return null;
  const cleanName = name.trim();
  const targetNorm = normalize(cleanName);

  // 1. Check existing in people
  const { data: matches } = await supabase
    .from('people')
    .select('id, name')
    .ilike('name', cleanName)
    .limit(5);

  const exact = (matches || []).find(p => normalize(p.name) === targetNorm);
  if (exact) return exact.id;

  // 2. Fuzzy match by last name
  const parts = cleanName.split(' ');
  if (parts.length > 1) {
    const { data: fuzzyMatches } = await supabase
      .from('people')
      .select('id, name')
      .ilike('name', `%${parts[parts.length - 1]}%`)
      .limit(10);
    const fuzzy = (fuzzyMatches || []).find(p => normalize(p.name) === targetNorm);
    if (fuzzy) return fuzzy.id;
  }

  // 3. Create person if not found
  const slug = `${slugify(cleanName)}-${Math.random().toString(36).substring(2, 6)}`;
  const { data: newPerson, error } = await supabase
    .from('people')
    .insert({
      name: cleanName,
      slug: slug,
      known_for_department: roleHint === 'Director' ? 'Directing' : (roleHint === 'Actor' ? 'Acting' : 'Production')
    })
    .select('id')
    .single();

  if (error) {
    console.warn(`  ⚠️ Could not insert person "${cleanName}":`, error.message);
    return null;
  }
  return newPerson.id;
}

async function addCredit(filmId, personId, role, characterName = null) {
  if (!filmId || !personId || !role) return;

  const { data: existing } = await supabase
    .from('credits')
    .select('id, role, character_name')
    .eq('film_id', filmId)
    .eq('person_id', personId)
    .eq('role', role)
    .limit(1);

  if (existing && existing.length > 0) {
    if (characterName && !existing[0].character_name) {
      await supabase.from('credits').update({ character_name: characterName }).eq('id', existing[0].id);
    }
    return;
  }

  await supabase.from('credits').insert({
    film_id: filmId,
    person_id: personId,
    role: role,
    character_name: characterName,
    source: 'film_africa'
  });
}

async function main() {
  const allFilms = JSON.parse(fs.readFileSync('scratch/filmafrica_54_films.json', 'utf8'));
  // Exclude curated screening programmes which are composite events
  const films = allFilms.filter(f => !f.title.toLowerCase().includes('short film programme') && !f.title.toLowerCase().includes('short film  programme'));

  console.log(`Processing ${films.length} distinct films from Film Africa...`);

  let updatedCount = 0;
  let createdCount = 0;

  for (const f of films) {
    const cleanTitle = f.title.replace(/\s+/g, ' ').replace(/[’']/g, "'").trim();

    // 1. Check existing film in DB
    const existingFilm = await findFilmInDb(cleanTitle);

    let filmId = null;

    if (existingFilm) {
      filmId = existingFilm.id;
      // Enrich in-place without overwriting good data
      const updates = {};
      if (!existingFilm.poster_url && f.poster) updates.poster_url = f.poster;
      if (!existingFilm.runtime_minutes && f.runtime) updates.runtime_minutes = parseInt(f.runtime, 10);
      if (!existingFilm.synopsis && f.synopsis) updates.synopsis = f.synopsis;

      if (Object.keys(updates).length > 0) {
        await supabase.from('films').update(updates).eq('id', filmId);
        console.log(`  🔄 Enriched existing film: "${existingFilm.title}" (${filmId})`);
      } else {
        console.log(`  ✅ Existing film verified: "${existingFilm.title}" (${filmId})`);
      }
      updatedCount++;
    } else {
      // Create novel film
      const year = f.year ? parseInt(f.year, 10) : 2026;
      const slug = `${slugify(cleanTitle)}-${year}-${Math.random().toString(36).substring(2, 6)}`;
      const runtime = f.runtime ? parseInt(f.runtime, 10) : null;

      const isNollywood = [
        'odunlade', 'adekola', 'bimbo', 'oriahi', 'esiri', 'orimogunje', 
        'ebonylife', 'dada', 'aigbe', 'ofoma', 'nwosu', 'lagos', 'nigeria'
      ].some(k => (f.director + ' ' + f.cast + ' ' + f.venue + ' ' + f.synopsis).toLowerCase().includes(k));

      const { data: newFilm, error } = await supabase
        .from('films')
        .insert({
          title: cleanTitle,
          slug: slug,
          year: year,
          synopsis: f.synopsis || null,
          poster_url: f.poster || null,
          runtime_minutes: runtime,
          is_nollywood: isNollywood,
          status: 'released',
          source: 'film_africa'
        })
        .select('id')
        .single();

      if (error) {
        console.error(`  ❌ Failed to insert film "${cleanTitle}":`, error.message);
        continue;
      }
      filmId = newFilm.id;
      console.log(`  ✨ Created novel film: "${cleanTitle}" (${filmId})`);
      createdCount++;
    }

    // 2. Link Director Credits (with zero-duplicate check)
    if (f.director && filmId) {
      const directorNames = f.director.split(/,|\band\b|&/).map(d => d.trim()).filter(Boolean);
      for (const dName of directorNames) {
        if (dName.length > 2 && !dName.toLowerCase().includes('unknown')) {
          const personId = await findOrCreatePerson(dName, 'Director');
          if (personId) {
            await addCredit(filmId, personId, 'Director');
          }
        }
      }
    }

    // 3. Link Producer Credits (with zero-duplicate check)
    if (f.producer && filmId) {
      const producerNames = f.producer.split(/,|\band\b|&/).map(p => p.trim()).filter(Boolean);
      for (const pName of producerNames) {
        if (pName.length > 2) {
          const personId = await findOrCreatePerson(pName, 'Producer');
          if (personId) {
            await addCredit(filmId, personId, 'Producer');
          }
        }
      }
    }

    // 4. Link Principal Cast Credits (with zero-duplicate check)
    if (f.cast && filmId) {
      const castNames = f.cast.split(/,|\band\b|&/).map(c => c.trim()).filter(Boolean);
      for (const cName of castNames) {
        if (cName.length > 2) {
          const personId = await findOrCreatePerson(cName, 'Actor');
          if (personId) {
            await addCredit(filmId, personId, 'Actor');
          }
        }
      }
    }
  }

  console.log(`\n🎉 Ingestion Complete!`);
  console.log(`- Enriched Existing: ${updatedCount}`);
  console.log(`- Created New Novel: ${createdCount}`);
}

main().catch(console.error);
