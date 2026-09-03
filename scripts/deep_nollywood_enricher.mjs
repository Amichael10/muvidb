import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY
);

const GRAPHQL_ENDPOINT = 'https://gateway.nollywood.com/graphql';

// ─── 1. KNOWN NOLLYWOOD ALIASES & VARIATIONS ────────────────────────────────
const NOLLYWOOD_ALIASES = [
  ['omowunmi dada', 'wunmi dada'],
  ['ibrahim yekini', 'ibrahim yekini itele', 'itele', 'itele dicon', 'ibrahim itele'],
  ['richard mofe-damijo', 'richard mofedamijo', 'rmd'],
  ['mercy johnson', 'mercy johnson okojie'],
  ['toyin abraham', 'toyin aimakhu', 'toyin abraham ajeyemi'],
  ['femi adebayo', 'femi adebayo salami'],
  ['odunlade adekola', 'odunlade adekola omo adekola'],
  ['funke akindele', 'funke akindele bello', 'jenifa'],
  ['lateef adedimeji', 'adedimeji lateef'],
  ['sola sobowale', 'toyin tomato'],
  ['nkem owoh', 'osuofia'],
  ['osita iheme', 'pawpaw'],
  ['chinedu ikedieze', 'aki'],
  ['patience ozokwor', 'mama g'],
  ['fathia williams', 'fathia balogun', 'faithia williams'],
  ['bukunmi oluwashina', 'olubukumi oluwashina', 'bukunmi oluwasina'],
  ['seun akindele', 'oluwaseun akindele'],
  ['bolanle ninalowo', 'nino b'],
  ['bimbo ademoye', 'bimbo ademoye-'],
  ['ayo makun', 'ay'],
  ['bright okpocha', 'basketmouth'],
  ['bovi ugboma', 'bovi'],
  ['broda shaggi', 'samuel animashaun perry', 'samuel perry'],
  ['mrs fish', 'oluwabukunmi oluwashina'],
  ['adebayo salami', 'oga bello'],
  ['jide kosoko', 'prince jide kosoko'],
  ['dele odule', 'chief dele odule'],
  ['yinka quadri', 'alhaji yinka quadri'],
  ['taiwo hassan', 'ogogo'],
  ['iyabo ojo', 'alice iyabo ojo'],
  ['shaffy bello', 'shaffy bello-akinrimisi'],
  ['kalu ikeagwu', 'kalu egbui ikeagwu'],
  ['genevieve nnaji', 'genevieve'],
  ['omotola jalade ekeinde', 'omosexy', 'omotola jalade']
];

function normalizeName(name) {
  if (!name) return '';
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/['"`]/g, '')
    .replace(/\b(chief|alhaji|prince|dr|barrister|pastor|evang|mrs|mr|miss)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function cleanTitle(t) {
  if (!t) return '';
  return t
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/['"`:,-]/g, '')
    .replace(/\b(the|a|an|part|season|episode|movie|nollywood|nigerian|full)\b/gi, '')
    .replace(/[^a-z0-9]/g, '')
    .trim();
}

function slugify(text) {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w-]+/g, '')
    .replace(/--+/g, '-');
}

// ─── 2. SMART PEOPLE MATCHER ────────────────────────────────────────────────
class PeopleResolver {
  constructor(dbPeople) {
    this.people = dbPeople; // array of { id, name, slug, photo_url }
    this.nameToId = new Map();
    this.slugToId = new Map();
    this.tokenIndex = new Map(); // token -> Set of people

    this.buildIndex();
  }

  buildIndex() {
    for (const p of this.people) {
      const norm = normalizeName(p.name);
      if (norm) {
        this.nameToId.set(norm, p.id);
      }
      if (p.slug) {
        this.slugToId.set(p.slug.toLowerCase(), p.id);
      }

      // Index aliases
      for (const group of NOLLYWOOD_ALIASES) {
        if (group.includes(norm)) {
          for (const alias of group) {
            if (!this.nameToId.has(alias)) {
              this.nameToId.set(alias, p.id);
            }
          }
        }
      }

      // Word tokens
      const tokens = norm.split(' ').filter(t => t.length > 2);
      for (const t of tokens) {
        if (!this.tokenIndex.has(t)) this.tokenIndex.set(t, new Set());
        this.tokenIndex.get(t).add(p);
      }
    }
  }

  resolve(rawName, rawSlug) {
    if (!rawName) return null;
    const norm = normalizeName(rawName);

    // 1. Direct match
    if (this.nameToId.has(norm)) return this.nameToId.get(norm);

    // 2. Slug match
    if (rawSlug && this.slugToId.has(rawSlug.toLowerCase())) {
      return this.slugToId.get(rawSlug.toLowerCase());
    }

    // 3. Alias dictionary match
    for (const group of NOLLYWOOD_ALIASES) {
      if (group.includes(norm)) {
        for (const alias of group) {
          if (this.nameToId.has(alias)) return this.nameToId.get(alias);
        }
      }
    }

    // 4. Prefix match (e.g. Omowunmi <-> Wunmi, Olubukunmi <-> Bukunmi)
    const tokens = norm.split(' ').filter(t => t.length > 2);
    if (tokens.length >= 2) {
      // Check candidate persons that share the last name
      const lastName = tokens[tokens.length - 1];
      const candidates = this.tokenIndex.get(lastName);
      if (candidates) {
        for (const cand of candidates) {
          const candNorm = normalizeName(cand.name);
          const candTokens = candNorm.split(' ').filter(t => t.length > 2);
          
          // If first name matches stripped prefix (e.g. 'wunmi' in 'omowunmi')
          const f1 = tokens[0];
          const f2 = candTokens[0];
          if (f1 && f2) {
            if (f1 === f2 || f1.includes(f2) || f2.includes(f1)) {
              return cand.id;
            }
          }

          // If all tokens of input are in candidate
          const matchAll = tokens.every(t => candNorm.includes(t));
          if (matchAll) return cand.id;

          // If all tokens of candidate are in input
          const candMatchAll = candTokens.every(t => norm.includes(t));
          if (candMatchAll) return cand.id;
        }
      }
    }

    return null;
  }

  register(newPerson) {
    this.people.push(newPerson);
    const norm = normalizeName(newPerson.name);
    if (norm) this.nameToId.set(norm, newPerson.id);
    if (newPerson.slug) this.slugToId.set(newPerson.slug.toLowerCase(), newPerson.id);
  }
}

// ─── 3. FETCH ALL DATA FROM SUPABASE WITH PAGINATION ─────────────────────────
async function fetchAllFromSupabase(table, selectFields) {
  const allRows = [];
  const PAGE_SIZE = 1000;
  let from = 0;
  while (true) {
    const { data, error } = await supabase
      .from(table)
      .select(selectFields)
      .range(from, from + PAGE_SIZE - 1);
    if (error || !data?.length) break;
    allRows.push(...data);
    from += PAGE_SIZE;
    if (data.length < PAGE_SIZE) break;
  }
  return allRows;
}

// ─── 4. FETCH WORK DETAIL FROM NOLLYWOOD.COM ─────────────────────────────────
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
        poster { url }
        backdrop { url }
        trailer { url }
        genres { name slug }
        cast {
          id
          role
          characterName
          person {
            id
            name
            slug
            headshot { url }
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
            headshot { url }
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
    return null;
  }
}

async function fetchAllCatalog() {
  console.log('📡 Fetching all 917 movies catalog from Nollywood.com...');
  const allMovies = [];
  let page = 1;
  const pageSize = 50;
  let totalPages = 1;

  const query = `
    query GetMoviesCatalog($input: GetMoviesInput!) {
      getMovies(input: $input) {
        items {
          id
          title
          slug
          releaseYear
          releaseDate
          runtime
        }
        pageInfo {
          total
          totalPages
        }
      }
    }
  `;

  while (page <= totalPages) {
    const res = await fetch(GRAPHQL_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query,
        variables: { input: { pagination: { page, pageSize } } }
      })
    });
    const d = await res.json();
    const r = d?.data?.getMovies;
    if (!r?.items) break;
    allMovies.push(...r.items);
    totalPages = r.pageInfo.totalPages;
    page++;
    await new Promise(res => setTimeout(res, 50));
  }
  return allMovies;
}

// ─── 5. MAIN ORCHESTRATION ──────────────────────────────────────────────────
async function main() {
  console.log('🎬 === DEEP NOLLYWOOD.COM ENRICHMENT & CAST/CREW SYNC ===\n');

  // Load all existing films and people
  console.log('1. Loading existing database...');
  const [allDbFilms, allDbPeople] = await Promise.all([
    fetchAllFromSupabase('films', 'id, title, year, slug, source, poster_url, backdrop_url, box_office_domestic, synopsis'),
    fetchAllFromSupabase('people', 'id, name, slug, photo_url')
  ]);
  console.log(` -> Loaded ${allDbFilms.length} films and ${allDbPeople.length} people from DB.`);

  const peopleResolver = new PeopleResolver(allDbPeople);

  // Map films by cleanTitle and slug
  const filmsByClean = new Map();
  const filmsBySlug = new Map();
  for (const f of allDbFilms) {
    const k = cleanTitle(f.title);
    if (k) {
      if (!filmsByClean.has(k)) filmsByClean.set(k, []);
      filmsByClean.get(k).push(f);
    }
    if (f.slug) filmsBySlug.set(f.slug.toLowerCase(), f);
  }

  // Load Nollywood.com catalog
  const catalog = await fetchAllCatalog();
  console.log(` -> Fetched ${catalog.length} movies from Nollywood.com catalog.\n`);

  let enrichedExistingFilms = 0;
  let newlyCreatedFilms = 0;
  let totalCastCreditsAdded = 0;
  let totalCrewCreditsAdded = 0;
  let peopleMatchedCount = 0;
  let newPeopleCreatedCount = 0;
  let boxOfficeEnriched = 0;

  console.log('2. Processing all movies for Deep Ensemble Enrichment & Box Office...');

  for (let i = 0; i < catalog.length; i++) {
    const catItem = catalog[i];
    const identifier = catItem.slug || catItem.id;
    
    // Fetch full work detail
    const detail = await fetchWorkDetails(identifier);
    if (!detail) continue;

    // Check if we already have this film in our DB
    const k = cleanTitle(detail.title);
    const existingMatches = filmsByClean.get(k) || [];
    
    // Match by year closeness or direct slug
    let targetFilm = filmsBySlug.get((detail.slug || '').toLowerCase()) ||
                     existingMatches.find(m => !detail.releaseYear || !m.year || Math.abs(m.year - detail.releaseYear) <= 1) ||
                     existingMatches[0];

    // If no existing film found, create it!
    if (!targetFilm) {
      const genreNames = (detail.genres || []).map(g => g.name);
      const hasBoxOffice = detail.boxOffice?.lifetimeGross || detail.boxOffice?.openingWeekendGross;
      const baseSlug = detail.slug || slugify(detail.title);

      const { data: newFilm, error: filmErr } = await supabase
        .from('films')
        .insert({
          title: detail.title,
          slug: baseSlug,
          year: detail.releaseYear || (detail.releaseDate ? parseInt(detail.releaseDate.slice(0, 4)) : null),
          release_date: detail.releaseDate || null,
          synopsis: detail.synopsis || detail.summary || null,
          runtime_minutes: detail.runtime || null,
          poster_url: detail.poster?.url || null,
          backdrop_url: detail.backdrop?.url || null,
          trailer_external_url: detail.trailer?.url || null,
          genres: genreNames.length ? genreNames : null,
          budget: detail.budget || null,
          box_office_domestic: detail.boxOffice?.lifetimeGross || null,
          box_office_opening_weekend: detail.boxOffice?.openingWeekendGross || null,
          box_office_currency: detail.boxOffice?.currency || 'NGN',
          box_office_source: hasBoxOffice ? 'Nollywood.com' : null,
          box_office_updated_at: hasBoxOffice ? new Date().toISOString() : null,
          content_kind: 'film',
          content_kind_confidence: 1.0,
          content_kind_checked_at: new Date().toISOString(),
          is_nollywood: true,
          source: 'nollywood_com'
        })
        .select('id, title, year')
        .single();

      if (filmErr) {
        console.error(`  ❌ Error creating film "${detail.title}":`, filmErr.message);
        continue;
      }

      targetFilm = newFilm;
      newlyCreatedFilms++;
      console.log(`[${i + 1}/${catalog.length}] 🆕 Created film: "${detail.title}" (${detail.releaseYear || 'N/A'})`);
    } else {
      // Enrich existing film with Poster, Backdrop, Box Office if missing!
      const updates = {};
      if (!targetFilm.poster_url && detail.poster?.url) updates.poster_url = detail.poster.url;
      if (!targetFilm.backdrop_url && detail.backdrop?.url) updates.backdrop_url = detail.backdrop.url;
      if (!targetFilm.synopsis && (detail.synopsis || detail.summary)) updates.synopsis = detail.synopsis || detail.summary;
      
      const hasBoxOffice = detail.boxOffice?.lifetimeGross || detail.boxOffice?.openingWeekendGross;
      if (hasBoxOffice && !targetFilm.box_office_domestic) {
        updates.box_office_domestic = detail.boxOffice.lifetimeGross;
        updates.box_office_opening_weekend = detail.boxOffice.openingWeekendGross;
        updates.box_office_currency = detail.boxOffice.currency || 'NGN';
        updates.box_office_source = 'Nollywood.com';
        updates.box_office_updated_at = new Date().toISOString();
        boxOfficeEnriched++;
      }

      if (Object.keys(updates).length > 0) {
        await supabase.from('films').update(updates).eq('id', targetFilm.id);
        enrichedExistingFilms++;
      }
    }

    // Load existing credits for this film so we never duplicate cast/crew!
    const { data: existingCredits } = await supabase
      .from('credits')
      .select('person_id, role')
      .eq('film_id', targetFilm.id);

    const existingPersonIds = new Set((existingCredits || []).map(c => c.person_id));

    // ─── ENRICH CAST ───
    if (detail.cast && detail.cast.length > 0) {
      for (let order = 0; order < detail.cast.length; order++) {
        const c = detail.cast[order];
        if (!c.person || !c.person.name) continue;

        let personId = peopleResolver.resolve(c.person.name, c.person.slug);
        if (personId) {
          peopleMatchedCount++;
        } else {
          // Create new person only if truly not in DB
          const baseSlug = c.person.slug || slugify(c.person.name);
          const { data: createdPerson, error: pErr } = await supabase
            .from('people')
            .insert({
              name: c.person.name.trim(),
              slug: baseSlug,
              photo_url: c.person.headshot?.url || null,
              known_for_department: 'Acting',
              source: 'nollywood_com'
            })
            .select('id, name, slug, photo_url')
            .single();

          if (!pErr && createdPerson) {
            personId = createdPerson.id;
            peopleResolver.register(createdPerson);
            newPeopleCreatedCount++;
          }
        }

        if (personId && !existingPersonIds.has(personId)) {
          const { error: credErr } = await supabase.from('credits').insert({
            film_id: targetFilm.id,
            person_id: personId,
            role: 'Actor',
            character_name: c.characterName || null,
            billing_order: order + 1,
            source: 'nollywood_com'
          });
          if (!credErr) {
            existingPersonIds.add(personId);
            totalCastCreditsAdded++;
          }
        }
      }
    }

    // ─── ENRICH CREW (Directors, Writers, Producers) ───
    if (detail.crew && detail.crew.length > 0) {
      for (let order = 0; order < detail.crew.length; order++) {
        const c = detail.crew[order];
        if (!c.person || !c.person.name) continue;

        let personId = peopleResolver.resolve(c.person.name, c.person.slug);
        if (personId) {
          peopleMatchedCount++;
        } else {
          const roleDept = c.role === 'DIRECTOR' ? 'Directing' : c.role === 'WRITER' ? 'Writing' : 'Production';
          const baseSlug = c.person.slug || slugify(c.person.name);
          const { data: createdPerson, error: pErr } = await supabase
            .from('people')
            .insert({
              name: c.person.name.trim(),
              slug: baseSlug,
              photo_url: c.person.headshot?.url || null,
              known_for_department: roleDept,
              source: 'nollywood_com'
            })
            .select('id, name, slug, photo_url')
            .single();

          if (!pErr && createdPerson) {
            personId = createdPerson.id;
            peopleResolver.register(createdPerson);
            newPeopleCreatedCount++;
          }
        }

        if (personId && !existingPersonIds.has(personId)) {
          const roleFormatted = c.role === 'DIRECTOR' ? 'Director' :
                                c.role === 'PRODUCER' ? 'Producer' :
                                c.role === 'WRITER' ? 'Writer' : (c.role || 'Crew');

          const { error: credErr } = await supabase.from('credits').insert({
            film_id: targetFilm.id,
            person_id: personId,
            role: roleFormatted,
            billing_order: 100 + order,
            source: 'nollywood_com'
          });
          if (!credErr) {
            existingPersonIds.add(personId);
            totalCrewCreditsAdded++;
          }
        }
      }
    }

    if ((i + 1) % 25 === 0 || i === catalog.length - 1) {
      console.log(` -> Progress: [${i + 1}/${catalog.length}] | Cast credits: ${totalCastCreditsAdded} | Crew: ${totalCrewCreditsAdded} | Matched People: ${peopleMatchedCount}`);
    }
  }

  console.log(`\n======================================================`);
  console.log(`🎉 DEEP NOLLYWOOD.COM ENRICHMENT COMPLETE!`);
  console.log(`- Existing Films Enriched:      ${enrichedExistingFilms}`);
  console.log(`- New Films Created:           ${newlyCreatedFilms}`);
  console.log(`- Cast Members Linked:         ${totalCastCreditsAdded}`);
  console.log(`- Crew Members Linked:         ${totalCrewCreditsAdded}`);
  console.log(`- Existing People Matched:     ${peopleMatchedCount}`);
  console.log(`- Truly New People Added:      ${newPeopleCreatedCount}`);
  console.log(`- Box Office Figures Enriched: ${boxOfficeEnriched}`);
  console.log(`======================================================\n`);
}

main().catch(console.error);
