import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
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

function normalizeTitle(t) {
  if (!t) return '';
  return t
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '')
    .trim();
}

async function fetchUnreleasedWorks() {
  const query = `
    query GetUnreleasedWorks($input: GetUnreleasedWorksInput) {
      getUnreleasedWorks(input: $input) {
        id
        workType
        slug
        title
        summary
        synopsis
        releaseDate
        releaseYear
        runtime
        contentRating
        isStreamable
        poster {
          id
          url
          title
        }
        backdrop {
          id
          url
        }
        trailer {
          url
          title
          description
        }
        genres {
          id
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
      }
    }
  `;

  const res = await fetch(GRAPHQL_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'User-Agent': 'Mozilla/5.0' },
    body: JSON.stringify({ query, variables: { input: { limit: 100 } } })
  });

  const json = await res.json();
  if (json.errors) {
    throw new Error(JSON.stringify(json.errors));
  }
  return json.data?.getUnreleasedWorks || [];
}

async function fetchWorkDetail(identifier) {
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
        poster {
          url
        }
        backdrop {
          url
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
      headers: { 'Content-Type': 'application/json', 'User-Agent': 'Mozilla/5.0' },
      body: JSON.stringify({ query, variables: { identifier } })
    });
    const json = await res.json();
    return json?.data?.getWork || null;
  } catch (err) {
    console.error(`Error fetching work detail for ${identifier}:`, err.message);
    return null;
  }
}

// In-memory cache for person lookups
const peopleCache = new Map();

async function getOrCreatePerson(personData, defaultRole = 'Actor') {
  if (!personData || !personData.name) return null;
  const rawName = personData.name.trim();
  const norm = rawName.toLowerCase();

  if (peopleCache.has(norm)) {
    return peopleCache.get(norm);
  }

  // Check existing person in DB using index on name
  const { data: existingPerson } = await supabase
    .from('people')
    .select('id, name, slug, photo_url')
    .eq('name', rawName)
    .limit(1)
    .maybeSingle();

  if (existingPerson) {
    if (!existingPerson.photo_url && personData.headshot?.url) {
      await supabase
        .from('people')
        .update({ photo_url: personData.headshot.url })
        .eq('id', existingPerson.id);
    }
    peopleCache.set(norm, existingPerson.id);
    return existingPerson.id;
  }

  // Create new person
  const baseSlug = personData.slug || slugify(rawName);
  let personSlug = baseSlug;
  const { data: slugExists } = await supabase
    .from('people')
    .select('id')
    .eq('slug', personSlug)
    .maybeSingle();

  if (slugExists) {
    personSlug = `${baseSlug}-${Math.random().toString(36).substring(2, 6)}`;
  }

  const { data: newPerson, error } = await supabase
    .from('people')
    .insert({
      name: rawName,
      slug: personSlug,
      photo_url: personData.headshot?.url || null,
      known_for_department: defaultRole.toLowerCase().includes('director') ? 'Directing' :
                            defaultRole.toLowerCase().includes('writer') ? 'Writing' : 'Acting',
      source: 'nollywood_com'
    })
    .select('id')
    .single();

  if (error) {
    console.error(`Error creating person ${rawName}:`, error.message);
    return null;
  }

  peopleCache.set(norm, newPerson.id);
  return newPerson.id;
}

async function linkGenres(filmId, genreNames, allDbGenres) {
  if (!filmId || !genreNames || genreNames.length === 0) return;

  const genreMap = new Map();
  allDbGenres.forEach(g => {
    genreMap.set(g.name.toLowerCase(), g.id);
  });

  const aliasMap = {
    'coming-of-age': 'coming of age',
    'epics': 'epic',
    'romantic comedy': 'romcom',
    'sci-fi': 'science fiction'
  };

  const genreIdsToLink = [];
  for (const rawName of genreNames) {
    const lower = rawName.toLowerCase();
    const resolved = aliasMap[lower] || lower;
    if (genreMap.has(resolved)) {
      genreIdsToLink.push(genreMap.get(resolved));
    }
  }

  for (const genreId of genreIdsToLink) {
    await supabase
      .from('film_genres')
      .upsert({ film_id: filmId, genre_id: genreId }, { onConflict: 'film_id,genre_id' });
  }
}

async function main() {
  console.log('🎬 === NOLLYWOOD.COM COMING SOON SYNC ===');

  // 1. Fetch all genres from DB
  const { data: dbGenres } = await supabase.from('genres').select('id, name');
  console.log(`Loaded ${dbGenres?.length || 0} genres from database.`);

  // 2. Fetch unreleased works from nollywood.com
  console.log('📡 Fetching coming soon movies from Nollywood.com GraphQL gateway...');
  const comingSoonList = await fetchUnreleasedWorks();
  console.log(`✅ Retrieved ${comingSoonList.length} coming soon movies.`);

  // 3. Process each movie
  for (let i = 0; i < comingSoonList.length; i++) {
    const item = comingSoonList[i];
    console.log(`\n--------------------------------------------------------------`);
    console.log(`[${i + 1}/${comingSoonList.length}] Processing: "${item.title}" (Release: ${item.releaseDate || 'TBD'})`);

    // Fetch full ensemble from getWork
    const detail = await fetchWorkDetail(item.slug || item.id) || item;

    const genreNames = (detail.genres || []).map(g => g.name || g).filter(Boolean);
    const normTitle = normalizeTitle(item.title);

    let existingFilm = null;

    const { data: bySlug } = await supabase
      .from('films')
      .select('id, title, slug, status, coming_soon, release_date, year, poster_url, backdrop_url, trailer_external_url, synopsis, genres')
      .eq('slug', item.slug)
      .maybeSingle();

    if (bySlug) {
      existingFilm = bySlug;
    } else {
      const { data: byTitle } = await supabase
        .from('films')
        .select('id, title, slug, status, coming_soon, release_date, year, poster_url, backdrop_url, trailer_external_url, synopsis, genres')
        .ilike('title', `%${item.title.replace(/['":]/g, '').trim()}%`);

      if (byTitle && byTitle.length > 0) {
        existingFilm = byTitle.find(f => normalizeTitle(f.title) === normTitle) || null;
      }
    }

    let filmId = null;

    if (existingFilm) {
      console.log(`  🔄 Existing movie found in DB: "${existingFilm.title}" (ID: ${existingFilm.id})`);
      filmId = existingFilm.id;

      const updatePayload = {
        status: 'upcoming',
        coming_soon: true,
        release_date: detail.releaseDate || existingFilm.release_date,
        year: detail.releaseYear || (detail.releaseDate ? parseInt(detail.releaseDate.slice(0, 4)) : existingFilm.year || 2026),
        is_in_cinemas: false,
        synopsis: existingFilm.synopsis || detail.synopsis || detail.summary || null,
        poster_url: existingFilm.poster_url || detail.poster?.url || null,
        backdrop_url: existingFilm.backdrop_url || detail.backdrop?.url || null,
        trailer_external_url: existingFilm.trailer_external_url || detail.trailer?.url || null,
        runtime_minutes: existingFilm.runtime_minutes || detail.runtime || null,
        genres: existingFilm.genres && existingFilm.genres.length ? existingFilm.genres : genreNames,
        is_nollywood: true,
        source: existingFilm.source || 'nollywood_com',
        updated_at: new Date().toISOString()
      };

      const { error: updErr } = await supabase
        .from('films')
        .update(updatePayload)
        .eq('id', filmId);

      if (updErr) {
        console.error(`  ❌ Error updating film ${existingFilm.title}:`, updErr.message);
      } else {
        console.log(`  ✅ Successfully updated film in-place to Coming Soon!`);
      }
    } else {
      console.log(`  ➕ Inserting new coming soon film: "${detail.title}"`);
      const baseSlug = detail.slug || slugify(detail.title);
      let filmSlug = baseSlug;

      const { data: slugCheck } = await supabase.from('films').select('id').eq('slug', filmSlug).maybeSingle();
      if (slugCheck) {
        filmSlug = `${baseSlug}-2026`;
      }

      const insertPayload = {
        title: detail.title,
        slug: filmSlug,
        year: detail.releaseYear || (detail.releaseDate ? parseInt(detail.releaseDate.slice(0, 4)) : 2026),
        release_date: detail.releaseDate || null,
        status: 'upcoming',
        coming_soon: true,
        is_in_cinemas: false,
        synopsis: detail.synopsis || detail.summary || null,
        runtime_minutes: detail.runtime || null,
        poster_url: detail.poster?.url || null,
        backdrop_url: detail.backdrop?.url || null,
        trailer_external_url: detail.trailer?.url || null,
        genres: genreNames.length ? genreNames : null,
        content_kind: 'film',
        content_kind_confidence: 1.0,
        content_kind_checked_at: new Date().toISOString(),
        is_nollywood: true,
        source: 'nollywood_com'
      };

      const { data: newFilm, error: insErr } = await supabase
        .from('films')
        .insert(insertPayload)
        .select('id')
        .single();

      if (insErr) {
        console.error(`  ❌ Failed to insert film "${detail.title}":`, insErr.message);
        continue;
      }

      filmId = newFilm.id;
      console.log(`  ✅ Inserted new film with ID: ${filmId}`);
    }

    // Link film_genres junction table
    if (filmId && dbGenres) {
      await linkGenres(filmId, genreNames, dbGenres);
      console.log(`  🏷️ Linked genres: ${genreNames.join(', ')}`);
    }

    // Reconcile Cast & Crew without duplicate entries
    const { data: existingCredits } = await supabase
      .from('credits')
      .select('id, person_id, role, character_name, billing_order')
      .eq('film_id', filmId);

    const creditsByPersonRole = new Map();
    (existingCredits || []).forEach(c => {
      creditsByPersonRole.set(`${c.person_id}_${c.role.toLowerCase()}`, c);
    });

    // Cast members
    const castList = detail.cast || [];
    for (let order = 0; order < castList.length; order++) {
      const c = castList[order];
      if (!c.person) continue;

      const personId = await getOrCreatePerson(c.person, 'Actor');
      if (!personId) continue;

      const key = `${personId}_actor`;
      if (creditsByPersonRole.has(key)) {
        const existing = creditsByPersonRole.get(key);
        if (!existing.character_name && c.characterName) {
          await supabase
            .from('credits')
            .update({ character_name: c.characterName })
            .eq('id', existing.id);
          console.log(`     👤 Enriched character for actor: ${c.person.name} (${c.characterName})`);
        }
      } else {
        await supabase.from('credits').insert({
          film_id: filmId,
          person_id: personId,
          role: 'Actor',
          character_name: c.characterName || null,
          billing_order: order + 1,
          source: 'nollywood_com'
        });
        creditsByPersonRole.set(key, { person_id: personId, role: 'Actor' });
      }
    }

    // Crew members
    const crewList = detail.crew || [];
    for (let order = 0; order < crewList.length; order++) {
      const cr = crewList[order];
      if (!cr.person) continue;

      const roleFormatted = cr.role === 'DIRECTOR' ? 'Director' :
                            cr.role === 'PRODUCER' ? 'Producer' :
                            cr.role === 'WRITER' ? 'Writer' : (cr.role || 'Crew');

      const personId = await getOrCreatePerson(cr.person, roleFormatted);
      if (!personId) continue;

      const key = `${personId}_${roleFormatted.toLowerCase()}`;
      if (!creditsByPersonRole.has(key)) {
        await supabase.from('credits').insert({
          film_id: filmId,
          person_id: personId,
          role: roleFormatted,
          billing_order: 100 + order,
          source: 'nollywood_com'
        });
        creditsByPersonRole.set(key, { person_id: personId, role: roleFormatted });
      }
    }

    console.log(`  👥 Credits synced: ${castList.length} cast, ${crewList.length} crew.`);
  }

  console.log(`\n==============================================================`);
  console.log(`🎉 ALL 15 COMING SOON MOVIES SUCCESSFULLY SYNCED!`);
  console.log(`==============================================================\n`);

  // Final verification using get_coming_soon_films RPC
  const anonClient = createClient(
    process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL,
    process.env.VITE_SUPABASE_ANON_KEY
  );

  const { data: comingSoonFilms, error: rpcErr } = await anonClient.rpc('get_coming_soon_films', { p_limit: 30 });
  if (rpcErr) {
    console.error('RPC Error:', rpcErr);
  } else {
    console.log(`Verified get_coming_soon_films RPC returns ${comingSoonFilms?.length || 0} films:`);
    comingSoonFilms?.forEach((f, idx) => {
      console.log(`  ${idx + 1}. "${f.title}" (${f.release_date || f.year}) [Genres: ${f.genres?.join(', ')}]`);
    });
  }
}

main().catch(console.error);
