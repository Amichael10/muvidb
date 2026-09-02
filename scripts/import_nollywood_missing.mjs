import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY
);

const GRAPHQL_ENDPOINT = 'https://gateway.nollywood.com/graphql';

function slugify(text) {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w-]+/g, '')
    .replace(/--+/g, '-');
}

async function fetchWorkDetails(identifier) {
  const query = `
    query GetWorkDetail($identifier: String!) {
      getWork(identifier: $identifier) {
        id
        title
        slug
        workType
        releaseYear
        releaseDate
        runtime
        summary
        synopsis
        budget
        boxOffice {
          openingWeekendGross
          lifetimeGross
          currency
        }
        poster {
          url
          thumbnailImageUrl
        }
        backdrop {
          url
          thumbnailImageUrl
        }
        trailer {
          url
        }
        genres {
          name
          slug
        }
        cast {
          id
          role
          characterName
          person {
            id
            name
            slug
            headshot {
              url
            }
          }
        }
        crew {
          id
          role
          department
          person {
            id
            name
            slug
            headshot {
              url
            }
          }
        }
      }
    }
  `;

  try {
    const res = await fetch(GRAPHQL_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      body: JSON.stringify({
        query,
        variables: { identifier }
      })
    });

    const data = await res.json();
    return data?.data?.getWork || null;
  } catch (e) {
    console.error(`Error fetching detail for ${identifier}:`, e.message);
    return null;
  }
}

// Cache for people map: normalized name -> person_id
const peopleCache = new Map();

async function getOrCreatePerson(personData, defaultRole = 'Actor') {
  if (!personData || !personData.name) return null;
  const name = personData.name.trim();
  const normName = name.toLowerCase();

  if (peopleCache.has(normName)) {
    return peopleCache.get(normName);
  }

  // Check DB for existing person
  const { data: existingPerson } = await supabase
    .from('people')
    .select('id, name, slug')
    .ilike('name', name)
    .limit(1)
    .maybeSingle();

  if (existingPerson) {
    peopleCache.set(normName, existingPerson.id);
    return existingPerson.id;
  }

  // Create new person
  const baseSlug = personData.slug || slugify(name);
  let personSlug = baseSlug;
  const { data: slugCheck } = await supabase.from('people').select('id').eq('slug', personSlug).maybeSingle();
  if (slugCheck) {
    personSlug = `${baseSlug}-${Math.random().toString(36).substring(2, 6)}`;
  }

  const { data: newPerson, error } = await supabase
    .from('people')
    .insert({
      name,
      slug: personSlug,
      photo_url: personData.headshot?.url || null,
      known_for_department: defaultRole === 'DIRECTOR' ? 'Directing' : 'Acting',
      source: 'nollywood_com'
    })
    .select('id')
    .single();

  if (error) {
    console.error(`Error creating person ${name}:`, error.message);
    return null;
  }

  peopleCache.set(normName, newPerson.id);
  return newPerson.id;
}

async function main() {
  console.log('🚀 === IMPORTING MISSING MOVIES FROM NOLLYWOOD.COM ===');

  if (!fs.existsSync('nollywood_missing_movies.json')) {
    console.error('Missing nollywood_missing_movies.json file. Run scan first.');
    return;
  }

  const missingMovies = JSON.parse(fs.readFileSync('nollywood_missing_movies.json', 'utf8'));
  console.log(`Found ${missingMovies.length} missing movies to import with full metadata, cast & box office.`);

  let importedCount = 0;
  let creditsCount = 0;
  let boxOfficeCount = 0;

  for (let i = 0; i < missingMovies.length; i++) {
    const item = missingMovies[i];
    console.log(`\n[${i + 1}/${missingMovies.length}] Processing: "${item.title}" (${item.releaseYear || 'N/A'})...`);

    // Fetch full ensemble & details
    const detail = await fetchWorkDetails(item.slug || item.id);
    if (!detail) {
      console.log(`  ⚠️ Could not fetch details for ${item.title}`);
      continue;
    }

    // Prepare film slug
    const baseSlug = detail.slug || slugify(detail.title);
    let filmSlug = baseSlug;
    const { data: existingSlug } = await supabase.from('films').select('id').eq('slug', filmSlug).maybeSingle();
    if (existingSlug) {
      filmSlug = `${baseSlug}-${detail.releaseYear || new Date().getFullYear()}`;
    }

    // Extract genres
    const genreNames = (detail.genres || []).map(g => g.name);

    // Box office figures
    const hasBoxOffice = detail.boxOffice?.lifetimeGross || detail.boxOffice?.openingWeekendGross;
    const boxOfficeDomestic = detail.boxOffice?.lifetimeGross || null;
    const boxOfficeOpening = detail.boxOffice?.openingWeekendGross || null;
    const boxOfficeCurrency = detail.boxOffice?.currency || 'NGN';

    if (hasBoxOffice) boxOfficeCount++;

    // Insert film record with content_kind: 'film'
    const { data: newFilm, error: filmErr } = await supabase
      .from('films')
      .insert({
        title: detail.title,
        slug: filmSlug,
        year: detail.releaseYear || (detail.releaseDate ? parseInt(detail.releaseDate.slice(0, 4)) : null),
        release_date: detail.releaseDate || null,
        synopsis: detail.synopsis || detail.summary || null,
        runtime_minutes: detail.runtime || null,
        poster_url: detail.poster?.url || null,
        backdrop_url: detail.backdrop?.url || null,
        trailer_external_url: detail.trailer?.url || null,
        genres: genreNames.length ? genreNames : null,
        budget: detail.budget || null,
        box_office_domestic: boxOfficeDomestic,
        box_office_opening_weekend: boxOfficeOpening,
        box_office_currency: boxOfficeCurrency,
        box_office_source: hasBoxOffice ? 'Nollywood.com' : null,
        box_office_updated_at: hasBoxOffice ? new Date().toISOString() : null,
        content_kind: 'film',
        content_kind_confidence: 1.0,
        content_kind_checked_at: new Date().toISOString(),
        is_nollywood: true,
        source: 'nollywood_com'
      })
      .select('id')
      .single();

    if (filmErr) {
      console.error(`  ❌ Failed to insert film "${detail.title}":`, filmErr.message);
      continue;
    }

    importedCount++;
    console.log(`  ✅ Inserted film: ${detail.title} (ID: ${newFilm.id})`);
    if (hasBoxOffice) {
      console.log(`     💰 Box Office: ${boxOfficeCurrency} ${boxOfficeDomestic?.toLocaleString()}`);
    }

    // Insert Cast Credits
    if (detail.cast && detail.cast.length > 0) {
      console.log(`     👥 Adding ${detail.cast.length} cast members...`);
      for (let order = 0; order < detail.cast.length; order++) {
        const c = detail.cast[order];
        if (!c.person) continue;

        const personId = await getOrCreatePerson(c.person, 'Actor');
        if (personId) {
          const { error: credErr } = await supabase.from('credits').insert({
            film_id: newFilm.id,
            person_id: personId,
            role: 'Actor',
            character_name: c.characterName || null,
            billing_order: order + 1,
            source: 'nollywood_com'
          });
          if (!credErr) creditsCount++;
        }
      }
    }

    // Insert Crew Credits (Directors, Producers, Writers)
    if (detail.crew && detail.crew.length > 0) {
      console.log(`     🎬 Adding ${detail.crew.length} crew members...`);
      for (let order = 0; order < detail.crew.length; order++) {
        const c = detail.crew[order];
        if (!c.person) continue;

        const roleFormatted = c.role === 'DIRECTOR' ? 'Director' :
                              c.role === 'PRODUCER' ? 'Producer' :
                              c.role === 'WRITER' ? 'Writer' : (c.role || 'Crew');

        const personId = await getOrCreatePerson(c.person, c.role);
        if (personId) {
          const { error: credErr } = await supabase.from('credits').insert({
            film_id: newFilm.id,
            person_id: personId,
            role: roleFormatted,
            billing_order: 100 + order,
            source: 'nollywood_com'
          });
          if (!credErr) creditsCount++;
        }
      }
    }

    // Pause slightly
    await new Promise(r => setTimeout(r, 60));
  }

  console.log(`\n========================================`);
  console.log(`🎉 IMPORT COMPLETE!`);
  console.log(`- New Films Imported: ${importedCount}`);
  console.log(`- Credits Linked:     ${creditsCount}`);
  console.log(`- Box Office Figures: ${boxOfficeCount}`);
  console.log(`========================================\n`);
}

main().catch(console.error);
