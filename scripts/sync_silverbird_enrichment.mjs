import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { veeziAdapter } from '../api/_lib/cinema-adapters/veezi.ts';
import { upsertShowtimes } from '../api/_lib/cinema-adapters/upsert.ts';

dotenv.config({ path: '.env.local' });
dotenv.config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing Supabase credentials in environment.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false }
});

function cleanStr(s) {
  if (!s) return '';
  return s
    .replace(/&#8217;/g, "'")
    .replace(/&#8211;/g, "-")
    .replace(/&#38;/g, "&")
    .replace(/&amp;/g, "&")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function slugify(text) {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

async function scrapeSilverbirdMovie(url) {
  if (url.includes('online-ticket')) return null;
  const res = await fetch(url);
  if (!res.ok) return null;
  const html = await res.text();

  // Title
  const titleMatch = html.match(/<h1[^>]*class=["'][^"']*entry-title[^"']*["'][^>]*>([\s\S]*?)<\/h1>/i) ||
                     html.match(/<title>([^<]+)- Silverbird Cinemas<\/title>/i);
  let rawTitle = titleMatch ? titleMatch[1].replace(/<[^>]+>/g, '').trim() : '';
  const title = cleanStr(rawTitle.replace(/\(.*?\)/g, ''));
  if (!title) return null;

  // Rating / PG
  const pgMatch = html.match(/<span class=["']pg["']>([\s\S]*?)<\/span>/i);
  let rating = pgMatch ? cleanStr(pgMatch[1].replace(/<[^>]+>/g, '')) : '';
  if (rating === 'TBC' || rating.length > 5) rating = null;

  // Duration
  const durMatch = html.match(/<span class=["']duration["']>([\s\S]*?)<\/span>/i);
  let runtimeMinutes = null;
  if (durMatch) {
    const durText = durMatch[1].replace(/<[^>]+>/g, '').trim();
    const hrMatch = durText.match(/(\d+)\s*hours?/i);
    const minMatch = durText.match(/(\d+)\s*minutes?/i);
    let mins = 0;
    if (hrMatch) mins += parseInt(hrMatch[1], 10) * 60;
    if (minMatch) mins += parseInt(minMatch[1], 10);
    if (mins > 0) runtimeMinutes = mins;
  }

  // Backdrop: #amy-page-header img
  let backdropUrl = null;
  const headerMatch = html.match(/<section id=["']amy-page-header["'][^>]*>([\s\S]*?)<\/section>/i);
  if (headerMatch) {
    const srcMatch = headerMatch[1].match(/<img[^>]+src=["']([^"']+)["']/i);
    if (srcMatch && !srcMatch[1].includes('default') && !srcMatch[1].includes('logo')) {
      backdropUrl = srcMatch[1];
    }
  }

  // Poster: div.entry-thumb img
  let posterUrl = null;
  const thumbMatch = html.match(/<div class=["']entry-thumb["']>([\s\S]*?)<\/div>/i);
  if (thumbMatch) {
    const srcMatch = thumbMatch[1].match(/<img[^>]+src=["']([^"']+)["']/i);
    if (srcMatch && !srcMatch[1].includes('default') && !srcMatch[1].includes('logo')) {
      posterUrl = srcMatch[1];
    }
  }

  // Release Date
  let releaseDate = null;
  const relMatch = html.match(/<li>\s*<label>Release:<\/label>\s*<span>([^<]+)<\/span>/i);
  if (relMatch) {
    const parsedD = new Date(relMatch[1].trim());
    if (!isNaN(parsedD.getTime())) {
      releaseDate = parsedD.toISOString().split('T')[0];
    }
  }

  // Language
  let language = 'English';
  const langMatch = html.match(/<li>\s*<label>Language:<\/label>\s*<span>([^<]+)<\/span>/i);
  if (langMatch) {
    language = cleanStr(langMatch[1]);
  }

  // Genres
  const genreMatches = [...html.matchAll(/<a href=["']https:\/\/silverbirdcinemas\.com\/genre\/[^"']+["'][^>]*>([^<]+)<\/a>/gi)]
    .map(m => cleanStr(m[1]))
    .filter(g => g && !['Now Showing', 'Slider', 'Coming Soon'].includes(g));
  const genres = [...new Set(genreMatches)];

  // Actors
  const actorMatches = [...html.matchAll(/<a href=["']https:\/\/silverbirdcinemas\.com\/actor\/[^"']+["'][^>]*>([^<]+)<\/a>/gi)]
    .map(m => cleanStr(m[1]))
    .filter(Boolean);
  const actors = [...new Set(actorMatches)];

  // Directors
  const dirMatches = [...html.matchAll(/<a href=["']https:\/\/silverbirdcinemas\.com\/director\/[^"']+["'][^>]*>([^<]+)<\/a>/gi)]
    .map(m => cleanStr(m[1]))
    .filter(Boolean);
  const directors = [...new Set(dirMatches)];

  // Synopsis
  let synopsis = null;
  const synMatch = html.match(/<div class=["']entry-content["']>([\s\S]*?)<\/div>/i);
  if (synMatch) {
    let rawSyn = synMatch[1];
    rawSyn = rawSyn.replace(/<h3>Synopsis<\/h3>/i, '');
    rawSyn = rawSyn.replace(/SHOWTIME[\s\S]*/i, '');
    rawSyn = rawSyn.replace(/\*NB:[\s\S]*/i, '');
    rawSyn = rawSyn.replace(/<div class=["']entry-showtime[\s\S]*/i, '');
    rawSyn = rawSyn.replace(/<[^>]+>/g, '').trim();
    if (rawSyn.length > 20) {
      synopsis = cleanStr(rawSyn);
    }
  }

  const isNollywood = genres.some(g => /nollywood/i.test(g)) ||
                      /yoruba|hausa|igbo/i.test(language) ||
                      /nigeria/i.test(synopsis || '');

  return {
    url,
    title,
    rating,
    runtimeMinutes,
    releaseDate,
    language,
    genres,
    isNollywood,
    directors,
    actors,
    posterUrl,
    backdropUrl,
    synopsis
  };
}

async function getOrCreatePerson(name, department = 'Acting') {
  const cleanName = cleanStr(name);
  if (!cleanName) return null;

  const { data: existing } = await supabase
    .from('people')
    .select('id, name')
    .ilike('name', cleanName)
    .limit(1);

  if (existing && existing.length > 0) {
    return existing[0].id;
  }

  const slug = slugify(cleanName);
  const { data: created, error } = await supabase
    .from('people')
    .insert({
      name: cleanName,
      slug,
      known_for_department: department,
      is_verified: false
    })
    .select('id')
    .single();

  if (error) {
    // If slug collision, query again
    const { data: retry } = await supabase
      .from('people')
      .select('id')
      .ilike('name', cleanName)
      .limit(1);
    return retry?.[0]?.id || null;
  }

  return created?.id || null;
}

async function linkCredits(filmId, actors, directors) {
  // Fetch existing credits for this film
  const { data: existingCredits } = await supabase
    .from('credits')
    .select('person_id, role')
    .eq('film_id', filmId);

  const existingMap = new Set(
    (existingCredits || []).map(c => `${c.person_id}_${c.role}`)
  );

  // Link directors
  for (const dirName of directors) {
    const personId = await getOrCreatePerson(dirName, 'Directing');
    if (personId && !existingMap.has(`${personId}_director`)) {
      await supabase.from('credits').insert({
        film_id: filmId,
        person_id: personId,
        role: 'director',
        source: 'silverbird'
      });
      existingMap.add(`${personId}_director`);
      console.log(`    + Added director: ${dirName}`);
    }
  }

  // Link actors
  let order = (existingCredits?.length || 0) + 1;
  for (const actorName of actors) {
    const personId = await getOrCreatePerson(actorName, 'Acting');
    if (personId && !existingMap.has(`${personId}_actor`)) {
      await supabase.from('credits').insert({
        film_id: filmId,
        person_id: personId,
        role: 'actor',
        billing_order: order++,
        source: 'silverbird'
      });
      existingMap.add(`${personId}_actor`);
      console.log(`    + Added actor: ${actorName}`);
    }
  }
}

async function runEnrichment() {
  console.log('Fetching Silverbird amy_movie sitemap...');
  const sitemapRes = await fetch('https://silverbirdcinemas.com/amy_movie-sitemap.xml');
  const xml = await sitemapRes.text();
  const urls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1]);

  console.log(`Found ${urls.length} movie URLs in Silverbird sitemap.`);

  let enrichedCount = 0;
  let createdCount = 0;

  for (const u of urls) {
    try {
      const data = await scrapeSilverbirdMovie(u);
      if (!data) continue;

      // Check if film exists in DB
      const { data: exact } = await supabase
        .from('films')
        .select('*')
        .ilike('title', data.title)
        .limit(1);

      let film = exact?.[0];

      if (!film) {
        // Try without punctuation
        const { data: partial } = await supabase
          .from('films')
          .select('*')
          .ilike('title', `%${data.title}%`)
          .limit(1);
        film = partial?.[0];
      }

      if (film) {
        console.log(`\n[ENRICHING] "${film.title}" (${film.id}) from Silverbird:`);
        const updates = {};

        // Backdrop
        if (!film.backdrop_url && data.backdropUrl) {
          updates.backdrop_url = data.backdropUrl;
          console.log(`  + Added HD Backdrop: ${data.backdropUrl}`);
        }

        // Poster
        if (!film.poster_url && data.posterUrl) {
          updates.poster_url = data.posterUrl;
          console.log(`  + Added HD Poster: ${data.posterUrl}`);
        }

        // Runtime (update if missing or if existing was suspiciously short <= 30 mins)
        if (data.runtimeMinutes && (!film.runtime_minutes || film.runtime_minutes <= 30)) {
          updates.runtime_minutes = data.runtimeMinutes;
          console.log(`  + Updated Runtime: ${film.runtime_minutes} -> ${data.runtimeMinutes}m`);
        }

        // Rating
        if (!film.nfvcb_rating && data.rating) {
          updates.nfvcb_rating = data.rating;
          console.log(`  + Added Rating: ${data.rating}`);
        }

        // Mark in cinemas
        if (!film.is_in_cinemas) {
          updates.is_in_cinemas = true;
          console.log(`  + Set is_in_cinemas = true`);
        }

        // Mark as Nollywood if Silverbird indicates Nollywood
        if (data.isNollywood && !film.is_nollywood) {
          updates.is_nollywood = true;
          console.log(`  + Set is_nollywood = true`);
        }

        // Synopsis if missing
        if ((!film.synopsis || film.synopsis.length < 50) && data.synopsis) {
          updates.synopsis = data.synopsis;
          console.log(`  + Added Synopsis`);
        }

        if (Object.keys(updates).length > 0) {
          updates.updated_at = new Date().toISOString();
          await supabase.from('films').update(updates).eq('id', film.id);
        }

        // Enrich cast and directors
        await linkCredits(film.id, data.actors, data.directors);
        enrichedCount++;
      } else {
        if (!data.isNollywood) {
          console.log(`\n[SKIPPING NON-NOLLYWOOD] "${data.title}" (Genres: ${data.genres.join(', ')})`);
          continue;
        }

        // Create new film if Nollywood
        console.log(`\n[CREATING NEW NOLLYWOOD FILM] "${data.title}":`);
        const year = data.releaseDate ? parseInt(data.releaseDate.split('-')[0], 10) : 2026;
        const slug = `${slugify(data.title)}-${year}`;

        const newFilmData = {
          title: data.title,
          slug,
          year,
          release_date: data.releaseDate,
          is_nollywood: true,
          is_in_cinemas: true,
          status: 'released',
          release_type: 'cinema',
          synopsis: data.synopsis || `${data.title} showing at Silverbird Cinemas.`,
          runtime_minutes: data.runtimeMinutes,
          nfvcb_rating: data.rating,
          language: data.language || 'English',
          poster_url: data.posterUrl,
          backdrop_url: data.backdropUrl,
          genres: data.genres,
          source: 'silverbird'
        };

        const { data: newFilm, error } = await supabase
          .from('films')
          .insert(newFilmData)
          .select('id')
          .single();

        if (error) {
          console.error(`  x Error creating "${data.title}":`, error.message);
        } else if (newFilm) {
          console.log(`  + Successfully created film ID: ${newFilm.id}`);
          await linkCredits(newFilm.id, data.actors, data.directors);
          createdCount++;
        }
      }
    } catch (err) {
      console.error(`Error processing ${u}:`, err.message);
    }
  }

  console.log(`\nFinished Enrichment: ${enrichedCount} enriched, ${createdCount} created.`);
}

async function runShowtimesSync() {
  console.log('\n=============================================');
  console.log('RUNNING LIVE SILVERBIRD SHOWTIMES SYNC...');
  console.log('=============================================');

  const { data: silverbirdCinemas, error } = await supabase
    .from('cinemas')
    .select('*')
    .ilike('name', '%silverbird%')
    .eq('is_active', true);

  if (error || !silverbirdCinemas) {
    console.error('Error fetching Silverbird cinemas:', error);
    return;
  }

  // Mapping of cinema name/city to known tokens
  const TOKEN_MAP = {
    'ikeja': '9chn7w68550a7sxgexpdng2ndm',
    'galleria': '4x3z2wcre0rek2beab5w344ae0',
    'victoria island': '4x3z2wcre0rek2beab5w344ae0',
    'jabi': 'ypr75qx9nh88brqya85qtg3wqc',
    'sec': 'ntfpkgyc0phrmzxb2ctk828vd4',
    'entertainment centre': 'ntfpkgyc0phrmzxb2ctk828vd4',
    'kaduna': 'p2gfjfgyfxmt9hja0jzwvh162w',
    'galaxy': 'p2gfjfgyfxmt9hja0jzwvh162w'
  };

  let totalShowtimesSynced = 0;

  for (const c of silverbirdCinemas) {
    let siteToken = c.scrape_config?.siteToken;

    if (!siteToken) {
      const searchKey = `${c.name} ${c.city} ${c.address || ''}`.toLowerCase();
      for (const [k, tok] of Object.entries(TOKEN_MAP)) {
        if (searchKey.includes(k)) {
          siteToken = tok;
          break;
        }
      }
    }

    if (!siteToken) {
      console.log(`Skipping [${c.name}] - no siteToken mapped.`);
      continue;
    }

    // Ensure cinema has scrape_enabled = true, scrape_adapter = 'veezi', and correct siteToken
    await supabase.from('cinemas').update({
      scrape_enabled: true,
      scrape_adapter: 'veezi',
      scrape_config: { siteToken }
    }).eq('id', c.id);

    console.log(`\nSyncing showtimes for: ${c.name} (${c.city}) [token: ${siteToken}]`);
    const adapterResult = await veeziAdapter({
      ...c,
      scrape_config: { siteToken }
    });

    console.log(`  Parsed ${adapterResult.showtimes.length} showtimes from Veezi.`);
    if (adapterResult.showtimes.length > 0) {
      const upsertResult = await upsertShowtimes(
        c.id,
        adapterResult.showtimes,
        `silverbird-veezi-${siteToken}`
      );
      console.log(`  Upserted: ${upsertResult.inserted} inserted, ${upsertResult.updated} updated, ${upsertResult.unmatched} unmatched/pending.`);
      totalShowtimesSynced += (upsertResult.inserted + upsertResult.updated);
    }
  }

  console.log(`\n✓ SHOWTIME SYNC COMPLETED: ${totalShowtimesSynced} total active showtimes in DB.`);
}

async function main() {
  await runEnrichment();
  await runShowtimesSync();
}

main().catch(console.error);
