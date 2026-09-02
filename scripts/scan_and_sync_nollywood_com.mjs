import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY
);

const GRAPHQL_ENDPOINT = 'https://gateway.nollywood.com/graphql';

function normalizeTitle(t) {
  if (!t) return '';
  return t
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '')
    .trim();
}

async function fetchAllDbFilms() {
  console.log('🔍 Fetching all existing films from Supabase with pagination...');
  const allFilms = [];
  const PAGE_SIZE = 1000;
  let from = 0;

  while (true) {
    const { data, error } = await supabase
      .from('films')
      .select('id, title, year, slug, poster_url, backdrop_url, box_office_domestic, box_office_worldwide, synopsis')
      .range(from, from + PAGE_SIZE - 1);

    if (error) {
      console.error('Error fetching films from DB:', error);
      break;
    }

    if (!data || data.length === 0) break;
    allFilms.push(...data);
    from += PAGE_SIZE;
    if (data.length < PAGE_SIZE) break;
  }

  console.log(`📊 Loaded ${allFilms.length} total films from Supabase.`);
  return allFilms;
}

async function fetchAllNollywoodMovies() {
  console.log('📡 Fetching all movies catalog from Nollywood.com GraphQL...');
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
          workType
          releaseYear
          releaseDate
          runtime
          summary
          synopsis
          budget
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
        }
        pageInfo {
          total
          page
          pageSize
          totalPages
        }
      }
    }
  `;

  while (page <= totalPages) {
    try {
      const res = await fetch(GRAPHQL_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        },
        body: JSON.stringify({
          query,
          variables: {
            input: {
              pagination: { page, pageSize }
            }
          }
        })
      });

      if (!res.ok) {
        console.error(`Page ${page} failed with status:`, res.status);
        break;
      }

      const data = await res.json();
      const result = data?.data?.getMovies;
      if (!result || !result.items) break;

      allMovies.push(...result.items);
      totalPages = result.pageInfo.totalPages;
      page++;
      await new Promise(r => setTimeout(r, 60));
    } catch (e) {
      console.error(`Error fetching page ${page}:`, e.message);
      break;
    }
  }

  console.log(`✅ Completed catalog fetch. Total items: ${allMovies.length}`);
  return allMovies;
}

async function main() {
  console.log('🎬 === NOLLYWOOD.COM MOVIE SCAN & DB ENRICHMENT ===');

  const [dbFilms, remoteMovies] = await Promise.all([
    fetchAllDbFilms(),
    fetchAllNollywoodMovies()
  ]);

  const existingFilmsMap = new Map();
  for (const f of dbFilms) {
    const key = normalizeTitle(f.title);
    if (key) {
      if (!existingFilmsMap.has(key)) {
        existingFilmsMap.set(key, []);
      }
      existingFilmsMap.get(key).push(f);
    }
  }

  const missingMovies = [];
  const matchedMovies = [];

  for (const rm of remoteMovies) {
    const key = normalizeTitle(rm.title);
    const existingList = existingFilmsMap.get(key);

    if (!existingList || existingList.length === 0) {
      missingMovies.push(rm);
    } else {
      matchedMovies.push({ remote: rm, existing: existingList[0] });
    }
  }

  console.log(`\n========================================`);
  console.log(`📊 ACCURATE COMPARISON SUMMARY:`);
  console.log(`- Total Movies on Nollywood.com: ${remoteMovies.length}`);
  console.log(`- MATCHED in our Database:      ${matchedMovies.length}`);
  console.log(`- TRULY MISSING from our DB:     ${missingMovies.length}`);
  console.log(`========================================\n`);

  fs.writeFileSync(
    'nollywood_missing_movies.json',
    JSON.stringify(missingMovies, null, 2)
  );

  console.log(`Saved ${missingMovies.length} missing movies to nollywood_missing_movies.json`);
  console.log(`First 20 Missing Titles:`);
  missingMovies.slice(0, 20).forEach((m, idx) => {
    console.log(`  ${idx + 1}. ${m.title} (${m.releaseYear || 'N/A'}) - Poster: ${m.poster?.url ? 'YES' : 'NO'}`);
  });
}

main().catch(console.error);
