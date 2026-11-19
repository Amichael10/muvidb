/**
 * Cinemax Distribution Limited Sync & Enrichment Script
 *
 * Scrapes official film metadata, trailers, production companies, posters,
 * and partner cinemas from https://www.cinemaxdr.com.
 *
 * Capabilities:
 * - Scrapes 37 titles from https://www.cinemaxdr.com/api/movies
 * - Extracts deep metadata from https://www.cinemaxdr.com/movies/[slug] (Trailers, Production, Director, Cast)
 * - Inspects partner cinemas from https://www.cinemaxdr.com/api/cinemas
 * - Matches against MuviDB films catalog
 * - Enriches missing trailers, distributor ("Cinemax Distribution Limited"), and production companies
 * - Inserts brand new uncatalogued films
 *
 * Usage:
 *   node scripts/sync_cinemaxdr.mjs           # Dry-run audit preview
 *   node scripts/sync_cinemaxdr.mjs --apply   # Apply changes to Supabase
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config();

const url = process.env.VITE_SUPABASE_URL || 'https://pkenrmorywmuvnzfoylp.supabase.co';
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(url, key);

const APPLY = process.argv.includes('--apply');

// Title alias dictionary to handle slight punctuation / title variances between Cinemax & DB
const TITLE_ALIASES = {
  'sistá': 'sista',
  'sista': 'sista',
  'ụnọ (the f in family)': 'uno: the f in family',
  'uno': 'uno: the f in family',
  'kilanko (the invincible child)': 'kilanko: the invincible child',
  'kilanko': 'kilanko: the invincible child',
  'l i f e': 'life',
  'trade by bata': 'trade by bata',
  'irete: the reckoning': 'irete: the reckoning',
  'a very dirty christmas': 'a very dirty christmas',
  'five figurines': 'five figurines',
  'telexzikora': 'telexzikora',
  'gingerrr': 'gingerrr',
};

function extractYouTubeId(url) {
  if (!url) return null;
  const match = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/i);
  return match ? match[1] : null;
}

function parseDurationMinutes(durationStr) {
  if (!durationStr) return null;
  let total = 0;
  const hMatch = durationStr.match(/(\d+)\s*h/i);
  const mMatch = durationStr.match(/(\d+)\s*m/i);
  if (hMatch) total += parseInt(hMatch[1], 10) * 60;
  if (mMatch) total += parseInt(mMatch[1], 10);
  return total > 0 ? total : null;
}

async function fetchMovieDetail(slug) {
  try {
    const res = await fetch(`https://www.cinemaxdr.com/movies/${slug}`, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
      signal: AbortSignal.timeout(12000),
    });
    if (!res.ok) return {};
    const html = await res.text();

    const info = {};
    const rowMatches = [...html.matchAll(/<div class="info-row"[^>]*>\s*<div class="info-label"[^>]*>([\s\S]*?)<\/div>\s*<div class="info-value"[^>]*>([\s\S]*?)<\/div>/gi)];
    for (const r of rowMatches) {
      const label = r[1].replace(/<[^>]+>/g, '').trim();
      const value = r[2].replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').trim();
      info[label] = value;
    }

    // YouTube trailer link from Next.js payload or HTML
    let trailerUrl = null;
    const ytMatch = html.match(/"youtube":\s*"([^"]+)"/i) ||
                    html.match(/(?:https?:)?\/\/(?:www\.)?(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/i);
    if (ytMatch) {
      trailerUrl = ytMatch[1].startsWith('http') ? ytMatch[1] : `https://www.youtube.com/watch?v=${ytMatch[1]}`;
    }

    // High res poster from DigitalOcean Spaces CDN
    const posterMatch = html.match(/https:\/\/[^"'\s]*\/media\/cinemaxdr\/uploads\/posters\/[a-zA-Z0-9_-]+\.(?:jpg|jpeg|png|webp)/i);
    const posterUrl = posterMatch ? posterMatch[0] : null;

    // High res backdrop
    const backdropMatch = html.match(/https:\/\/[^"'\s]*\/media\/cinemaxdr\/uploads\/(?:backdrops|stills|banners)\/[a-zA-Z0-9_-]+\.(?:jpg|jpeg|png|webp)/i);
    const backdropUrl = backdropMatch ? backdropMatch[0] : null;

    // Cast members
    const cast = [];
    const castCards = [...html.matchAll(/<article class="cast-card"[^>]*>([\s\S]*?)<\/article>/gi)];
    for (const card of castCards) {
      const cardHtml = card[1];
      const name = cardHtml.match(/<div class="cast-name"[^>]*>([\s\S]*?)<\/div>/i)?.[1]?.replace(/<[^>]+>/g, '').trim();
      const role = cardHtml.match(/<div class="cast-role[^"]*"[^>]*>([\s\S]*?)<\/div>/i)?.[1]?.replace(/<[^>]+>/g, '').trim();
      if (name) {
        cast.push({ name, role: role || 'Cast' });
      }
    }

    return {
      info,
      trailerUrl,
      director: info['Director'] || null,
      writer: info['Writer'] || null,
      production: info['Production'] || null,
      distributor: info['Distributor'] || 'Cinemax Distribution Limited',
      runtime: info['Runtime'] || null,
      releaseDate: info['Release Date'] || null,
      posterUrl,
      backdropUrl,
      cast,
    };
  } catch (err) {
    return { error: err.message };
  }
}

async function getOrCreateCompany(companyName, role = 'production') {
  if (!companyName) return null;
  const clean = companyName.trim();
  if (!clean || clean.length < 2) return null;

  // 1. Search existing company
  const { data: existing } = await supabase
    .from('companies')
    .select('id, name')
    .ilike('name', clean)
    .limit(1)
    .maybeSingle();

  if (existing) return existing.id;

  // 2. Insert new company if APPLY is enabled
  if (APPLY) {
    const slugBase = clean.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    const slug = `${slugBase}-${Math.random().toString(36).substring(2, 7)}`;
    const { data: inserted, error } = await supabase
      .from('companies')
      .insert({
        name: clean,
        slug,
        company_type: role === 'distribution' ? 'distribution' : 'production',
      })
      .select('id')
      .single();

    if (error) {
      console.warn(`Could not create company "${clean}":`, error.message);
      return null;
    }
    return inserted.id;
  }

  return 'mock-new-company-id';
}

async function linkFilmCompany(filmId, companyId, role) {
  if (!filmId || !companyId || !APPLY) return;
  const { data: existing } = await supabase
    .from('film_companies')
    .select('film_id')
    .eq('film_id', filmId)
    .eq('company_id', companyId)
    .eq('role', role)
    .maybeSingle();

  if (!existing) {
    await supabase.from('film_companies').insert({
      film_id: filmId,
      company_id: companyId,
      role,
    });
  }
}

async function main() {
  console.log('===============================================================');
  console.log('🎬 CINEMAX DISTRIBUTION LIMITED SYNC & ENRICHMENT');
  console.log(`Mode: ${APPLY ? '🚀 LIVE APPLY (Writing to Supabase)' : '🔍 DRY-RUN PREVIEW'}`);
  console.log('===============================================================\n');

  // 1. Fetch Cinemax movies
  console.log('1. Fetching catalogue from https://www.cinemaxdr.com/api/movies...');
  const res = await fetch('https://www.cinemaxdr.com/api/movies', {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
    signal: AbortSignal.timeout(25000),
  });
  const apiMovies = await res.json();
  console.log(`Fetched ${apiMovies.length} movies from Cinemax.\n`);

  // 2. Fetch partner cinemas
  console.log('2. Checking partner cinemas from https://www.cinemaxdr.com/api/cinemas...');
  const cinemasRes = await fetch('https://www.cinemaxdr.com/api/cinemas', {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
    signal: AbortSignal.timeout(20000),
  });
  const partnerCinemas = await cinemasRes.json();
  console.log(`Found ${partnerCinemas.length} partner cinemas in Nigeria (e.g. ${partnerCinemas.map(c => c.name).slice(0, 3).join(', ')}...)\n`);

  // 3. Ensure Cinemax Distribution Limited company record exists
  let cinemaxCompanyId = null;
  const { data: cinemaxComp } = await supabase
    .from('companies')
    .select('id, name')
    .ilike('name', '%cinemax%')
    .limit(1)
    .maybeSingle();

  if (cinemaxComp) {
    cinemaxCompanyId = cinemaxComp.id;
    if (APPLY) {
      await supabase.from('companies').update({
        name: 'Cinemax Distribution Limited',
        website: 'https://www.cinemaxdr.com',
        description: 'Cinemax Distribution Limited — leading Co-Creator and Distributor of African cinema content.',
        company_type: 'distribution',
      }).eq('id', cinemaxCompanyId);
    }
  } else if (APPLY) {
    cinemaxCompanyId = await getOrCreateCompany('Cinemax Distribution Limited', 'distribution');
  }

  // 4. Process each film
  let matchedCount = 0;
  let newCount = 0;
  let enrichedTrailers = 0;
  let enrichedDistributors = 0;
  let enrichedProductions = 0;

  for (let idx = 0; idx < apiMovies.length; idx++) {
    const m = apiMovies[idx];
    const rawTitle = m.title.trim();
    const cleanLower = rawTitle.toLowerCase();
    const searchTitle = TITLE_ALIASES[cleanLower] || rawTitle;

    // Search DB
    const { data: dbMatches } = await supabase
      .from('films')
      .select('id, title, year, distributor, trailer_youtube_id, trailer_external_url, runtime_minutes, poster_url, backdrop_url, synopsis')
      .ilike('title', searchTitle)
      .limit(3);

    let dbFilm = dbMatches && dbMatches[0] ? dbMatches[0] : null;

    if (!dbFilm) {
      // Try stripping non-alphanumeric
      const stripped = searchTitle.replace(/[^a-zA-Z0-9\s]/g, '').trim();
      const { data: fuzzy } = await supabase
        .from('films')
        .select('id, title, year, distributor, trailer_youtube_id, trailer_external_url, runtime_minutes, poster_url, backdrop_url, synopsis')
        .ilike('title', `%${stripped}%`)
        .limit(3);
      if (fuzzy && fuzzy[0]) {
        dbFilm = fuzzy[0];
      }
    }

    // Fetch movie detail page
    const detail = await fetchMovieDetail(m.slug);
    const trailerUrl = detail.trailerUrl || null;
    const trailerYtId = extractYouTubeId(trailerUrl);
    const prodCompanyRaw = detail.production || null;
    const distributorName = 'Cinemax Distribution Limited';
    const runtimeMins = parseDurationMinutes(detail.runtime || m.duration);
    const posterUrl = detail.posterUrl || (m.poster ? `https://cots-media.fra1.cdn.digitaloceanspaces.com${m.poster}` : null);

    if (dbFilm) {
      matchedCount++;
      const updates = {};
      const changes = [];

      // 1. Distributor
      if (!dbFilm.distributor || !dbFilm.distributor.toLowerCase().includes('cinemax')) {
        updates.distributor = dbFilm.distributor ? `${dbFilm.distributor}, ${distributorName}` : distributorName;
        changes.push(`Distributor: "${updates.distributor}"`);
        enrichedDistributors++;
      }

      // 2. Trailer
      if (trailerYtId && !dbFilm.trailer_youtube_id) {
        updates.trailer_youtube_id = trailerYtId;
        updates.trailer_external_url = trailerUrl;
        updates.trailer_source = 'youtube';
        changes.push(`Trailer: ${trailerUrl}`);
        enrichedTrailers++;
      }

      // 3. Runtime
      if (runtimeMins && !dbFilm.runtime_minutes) {
        updates.runtime_minutes = runtimeMins;
        changes.push(`Runtime: ${runtimeMins}m`);
      }

      // 4. Poster (if missing)
      if (posterUrl && !dbFilm.poster_url) {
        updates.poster_url = posterUrl;
        changes.push(`Poster attached from DigitalOcean Spaces`);
      }

      // 5. In cinemas status
      if (m.status && m.status.toLowerCase().includes('in cinema')) {
        updates.is_in_cinemas = true;
      }

      if (APPLY && Object.keys(updates).length > 0) {
        await supabase.from('films').update(updates).eq('id', dbFilm.id);
      }

      // 6. Link Cinemax to film_companies
      if (cinemaxCompanyId) {
        await linkFilmCompany(dbFilm.id, cinemaxCompanyId, 'distribution');
      }

      // 7. Production Company
      if (prodCompanyRaw) {
        const prodParts = prodCompanyRaw.split(/[,&]|\bin association with\b/i).map(p => p.replace(/\(producer\)/i, '').trim()).filter(Boolean);
        for (const prod of prodParts) {
          if (prod.length > 2) {
            const compId = await getOrCreateCompany(prod, 'production');
            if (compId) {
              await linkFilmCompany(dbFilm.id, compId, 'production');
            }
          }
        }
        enrichedProductions++;
        changes.push(`Production: "${prodCompanyRaw}"`);
      }

      console.log(`[MATCH] "${rawTitle}" -> DB ID: ${dbFilm.id}`);
      if (changes.length > 0) {
        console.log(`   ✨ Enriched: ${changes.join(' | ')}`);
      } else {
        console.log(`   ✓ Already up-to-date in DB`);
      }

    } else {
      newCount++;
      console.log(`[NEW] "${rawTitle}" (${m.year || '2026'}) [${m.status}] - Slug: ${m.slug}`);
      console.log(`   Poster: ${posterUrl || 'None'}`);
      console.log(`   Trailer: ${trailerUrl || 'None'}`);
      console.log(`   Production: ${prodCompanyRaw || 'None'}`);

      if (APPLY) {
        const slugBase = rawTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
        const newSlug = `${slugBase}-${Math.random().toString(36).substring(2, 7)}`;
        const { data: newFilm, error: insErr } = await supabase.from('films').insert({
          title: rawTitle,
          slug: newSlug,
          year: parseInt(m.year, 10) || new Date().getFullYear(),
          release_date: detail.releaseDate || m.releaseDate || null,
          synopsis: Array.isArray(m.synopsis) ? m.synopsis.join(' ') : (m.synopsis || ''),
          poster_url: posterUrl,
          backdrop_url: detail.backdropUrl,
          trailer_youtube_id: trailerYtId,
          trailer_external_url: trailerUrl,
          trailer_source: trailerUrl && !trailerYtId ? 'external' : 'youtube',
          distributor: distributorName,
          runtime_minutes: runtimeMins,
          is_in_cinemas: m.status?.toLowerCase().includes('in cinema') || false,
          is_nollywood: true,
          content_type: 'movie',
          source: 'cinemax',
        }).select('id').single();

        if (newFilm) {
          console.log(`   🎉 Created new film record: ${newFilm.id}`);
          if (cinemaxCompanyId) {
            await linkFilmCompany(newFilm.id, cinemaxCompanyId, 'distribution');
          }
          if (prodCompanyRaw) {
            const prodParts = prodCompanyRaw.split(/[,&]|\bin association with\b/i).map(p => p.replace(/\(producer\)/i, '').trim()).filter(Boolean);
            for (const prod of prodParts) {
              if (prod.length > 2) {
                const compId = await getOrCreateCompany(prod, 'production');
                if (compId) await linkFilmCompany(newFilm.id, compId, 'production');
              }
            }
          }
        } else if (insErr) {
          console.warn(`   ❌ Insert failed:`, insErr.message);
        }
      }
    }
  }

  console.log('\n===============================================================');
  console.log('📊 FINAL SYNC AUDIT SUMMARY');
  console.log(`Total Cinemax Titles: ${apiMovies.length}`);
  console.log(`Matched Existing Films: ${matchedCount} (${Math.round(matchedCount / apiMovies.length * 100)}%)`);
  console.log(`New Films (To Add): ${newCount}`);
  console.log(`Trailers Enriched: ${enrichedTrailers}`);
  console.log(`Distributors Enriched: ${enrichedDistributors}`);
  console.log(`Production Companies Linked: ${enrichedProductions}`);
  console.log('===============================================================\n');
}

main().catch(console.error);
