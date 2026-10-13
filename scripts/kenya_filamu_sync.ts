import './dotenv_init.ts';
import { createClient } from '@supabase/supabase-js';
import { mirrorImageToStorage, isOwnUrl } from '../api/_lib/image_mirror.js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials in environment.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const actorCache = new Map<string, string>(); // name.toLowerCase() -> person_id

function sleep(ms: number) {
  return new Promise(r => setTimeout(r, ms));
}

function decodeHtml(html: string): string {
  if (!html) return '';
  return html
    .replace(/&#8217;/g, "'")
    .replace(/&#8216;/g, "'")
    .replace(/&#8220;/g, '"')
    .replace(/&#8221;/g, '"')
    .replace(/&#8211;/g, '–')
    .replace(/&#8212;/g, '—')
    .replace(/&#038;/g, '&')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(parseInt(dec, 10)))
    .trim();
}

function cleanTitle(title: string): string {
  return decodeHtml(title).trim().replace(/\s+/g, ' ');
}

function cleanName(name: string): string {
  if (!name) return '';
  let clean = decodeHtml(name).replace(/\([^)]*\)/g, '');
  clean = clean.replace(/[.,\s]+$/, '');
  return clean.trim().replace(/\s+/g, ' ');
}

// Anti-Hollywood & Garbage filter
const HOLLYWOOD_BLOCKLIST = /\b(avengers|iron man|captain america|spider-man|spiderman|batman|superman|marvel|fast & furious|jurassic|star wars|transformers|mission: impossible|harry potter|avatar|oppenheimer|barbie|black panther|aquaman|guardians of the galaxy|thor|deadpool|x-men)\b/i;

function isGarbageOrHollywood(title: string): boolean {
  const t = title.toLowerCase().trim();
  if (t === 'test movie' || t.startsWith('test ')) return true;
  if (HOLLYWOOD_BLOCKLIST.test(title)) return true;
  return false;
}

/**
 * Robust Database Retry Wrapper
 */
async function callDb<T>(fn: () => Promise<{ data: T | null; error: any }>, retries = 5, delay = 2000): Promise<T | null> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const { data, error } = await fn();
      if (error) {
        const msg = (error.message || '').toLowerCase();
        if (msg.includes('fetch failed') || msg.includes('timeout') || error.code === '40001' || error.status === 503) {
          throw error;
        }
        console.error(`❌ Supabase Error: ${error.message}`);
        return null;
      }
      return data;
    } catch (e: any) {
      if (attempt === retries) throw e;
      console.warn(`⚠️ [Attempt ${attempt}/${retries}] DB call failed: ${e.message}. Retrying in ${delay / 1000}s...`);
      await sleep(delay);
      delay *= 1.5;
    }
  }
  return null;
}

/**
 * Pre-cache known Kenyan actors to prevent duplicates
 */
async function preWarmActorCache() {
  console.log('🔄 Pre-warming Kenyan actors cache...');
  const { data: kenyanActors } = await supabase
    .from('people')
    .select('id, name')
    .eq('nationality', 'Kenyan')
    .limit(1000);

  if (kenyanActors) {
    for (const a of kenyanActors) {
      if (a.name) actorCache.set(a.name.toLowerCase().trim(), a.id);
    }
  }
  console.log(`   Cached ${actorCache.size} existing Kenyan actors.`);
}

/**
 * Find or Create Actor following Zero-Duplicate rule
 */
async function findOrCreateActor(rawName: string, dryRun: boolean): Promise<string | null> {
  const clean = cleanName(rawName);
  if (!clean || clean.length < 2) return null;

  const cacheKey = clean.toLowerCase();
  if (actorCache.has(cacheKey)) {
    return actorCache.get(cacheKey)!;
  }

  // 1. Exact match in people table
  const { data: existing } = await supabase
    .from('people')
    .select('id, name, nationality')
    .ilike('name', clean)
    .limit(1);

  if (existing && existing.length > 0) {
    const person = existing[0];
    actorCache.set(cacheKey, person.id);
    // Ensure Kenyan nationality if empty
    if (!person.nationality && !dryRun) {
      await supabase
        .from('people')
        .update({ nationality: 'Kenyan' })
        .eq('id', person.id);
    }
    return person.id;
  }

  if (dryRun) {
    const fakeId = `dryrun-actor-${clean.replace(/\s+/g, '-').toLowerCase()}`;
    actorCache.set(cacheKey, fakeId);
    return fakeId;
  }

  // 2. Create new person record tagged with Kenyan nationality
  const { data: newPerson, error: insertErr } = await supabase
    .from('people')
    .insert({
      name: clean,
      nationality: 'Kenyan',
      source: 'filamu.org',
      status: 'community',
      needs_review: false
    })
    .select('id')
    .single();

  if (insertErr || !newPerson) {
    console.error(`    ❌ Failed to insert person "${clean}":`, insertErr?.message);
    return null;
  }

  actorCache.set(cacheKey, newPerson.id);
  console.log(`    ✨ Created new Kenyan actor/filmmaker: "${clean}" (ID: ${newPerson.id})`);
  return newPerson.id;
}

/**
 * Zero-Duplicate Credit Ingestion
 */
async function attachCredit(filmId: string, personId: string, role = 'Cast Member', billingOrder?: number, dryRun = false) {
  if (dryRun) return;

  const { data: existingCredit } = await supabase
    .from('credits')
    .select('id, role, billing_order')
    .eq('film_id', filmId)
    .eq('person_id', personId)
    .maybeSingle();

  if (existingCredit) {
    const updates: any = {};
    if (billingOrder !== undefined && !existingCredit.billing_order) {
      updates.billing_order = billingOrder;
    }
    if (Object.keys(updates).length > 0) {
      await supabase.from('credits').update(updates).eq('id', existingCredit.id);
    }
    return;
  }

  await supabase.from('credits').insert({
    film_id: filmId,
    person_id: personId,
    role: role,
    billing_order: billingOrder || null,
    source: 'filamu.org'
  });
}

/**
 * Fetch paginated data from WordPress REST API
 */
async function fetchWpEndpoint(endpoint: string, page = 1, perPage = 50): Promise<{ items: any[]; total: number; totalPages: number }> {
  const url = `https://filamu.org/wp-json/wp/v2/${endpoint}?per_page=${perPage}&page=${page}&_embed`;
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) FilmdbaSync/1.0'
    }
  });

  if (!res.ok) {
    if (res.status === 400) return { items: [], total: 0, totalPages: 0 }; // page out of bounds
    throw new Error(`Filamu API error (${res.status}): ${await res.text()}`);
  }

  const total = parseInt(res.headers.get('x-wp-total') || '0', 10);
  const totalPages = parseInt(res.headers.get('x-wp-totalpages') || '1', 10);
  const items = await res.json();
  return { items, total, totalPages };
}

export async function syncFilamuKenya(options: { dryRun?: boolean; limit?: number; offset?: number; type?: 'movie' | 'series' | 'all' } = {}) {
  const dryRun = !!options.dryRun;
  const limit = options.limit || Infinity;
  const typeFilter = options.type || 'all';

  console.log('🇰🇪 Starting Kenya Filamu.org Native Content Ingestion...');
  console.log(`   Config: dryRun=${dryRun}, limit=${options.limit || 'ALL'}, typeFilter=${typeFilter}`);

  await preWarmActorCache();

  const endpointsToProcess: { endpoint: 'movie' | 'series'; contentType: 'movie' | 'series' }[] = [];
  if (typeFilter === 'movie' || typeFilter === 'all') {
    endpointsToProcess.push({ endpoint: 'movie', contentType: 'movie' });
  }
  if (typeFilter === 'series' || typeFilter === 'all') {
    endpointsToProcess.push({ endpoint: 'series', contentType: 'series' });
  }

  let totalProcessed = 0;
  let newFilmsCreated = 0;
  let filmsEnriched = 0;
  let skippedCount = 0;

  for (const { endpoint, contentType } of endpointsToProcess) {
    console.log(`\n============================================================`);
    console.log(`📂 Ingesting ${contentType.toUpperCase()} catalog from Filamu.org...`);
    console.log(`============================================================`);

    let page = 1;
    let keepFetching = true;

    while (keepFetching && totalProcessed < limit) {
      console.log(`\n📡 Fetching ${endpoint} page ${page}...`);
      let result;
      try {
        result = await fetchWpEndpoint(endpoint, page, 50);
      } catch (err: any) {
        console.error(`❌ Failed to fetch page ${page}:`, err.message);
        break;
      }

      if (!result.items || result.items.length === 0) {
        break;
      }

      console.log(`   Fetched ${result.items.length} items (Total in catalog: ${result.total})`);

      for (const item of result.items) {
        if (totalProcessed >= limit) {
          keepFetching = false;
          break;
        }

        totalProcessed++;
        const title = cleanTitle(item.title?.rendered || '');
        if (!title || isGarbageOrHollywood(title)) {
          console.log(`   🚫 Skipped: "${title}" (Invalid or Hollywood)`);
          skippedCount++;
          continue;
        }

        // Extract metadata from terms
        const terms = (item._embedded?.['wp:term'] || []).flat();
        const yearTerm = terms.find((t: any) => t.taxonomy === 'years');
        const year = yearTerm && !isNaN(parseInt(yearTerm.name, 10)) ? parseInt(yearTerm.name, 10) : null;
        const genres = terms
          .filter((t: any) => t.taxonomy === 'genre')
          .map((t: any) => t.name)
          .filter(Boolean);
        const peopleNames = terms
          .filter((t: any) => t.taxonomy === 'person')
          .map((t: any) => cleanName(t.name))
          .filter(Boolean);

        const synopsis = item.yoast_head_json?.description || item.excerpt?.rendered?.replace(/<[^>]+>/g, '').trim() || null;
        let posterUrl = item._embedded?.['wp:featuredmedia']?.[0]?.source_url || null;

        console.log(`\n[${totalProcessed}] Processing ${contentType}: "${title}" (${year || 'Year N/A'})`);

        // Check if film exists by title + year or source_video_id
        let existingFilm: any = null;
        const { data: bySource } = await supabase
          .from('films')
          .select('id, title, year, poster_url, countries, genres, synopsis')
          .eq('source_video_id', `filamu-${item.id}`)
          .maybeSingle();

        if (bySource) {
          existingFilm = bySource;
        } else {
          // Look up by title and country Kenya or close title match
          const { data: byTitle } = await supabase
            .from('films')
            .select('id, title, year, poster_url, countries, genres, synopsis')
            .ilike('title', title)
            .limit(1);

          if (byTitle && byTitle.length > 0) {
            existingFilm = byTitle[0];
          }
        }

        // Mirror poster if new or missing
        if (posterUrl && !dryRun) {
          try {
            posterUrl = await mirrorImageToStorage(posterUrl, 'posters');
          } catch {
            // Keep remote posterUrl
          }
        }

        let filmId: string;

        if (existingFilm) {
          filmId = existingFilm.id;
          console.log(`   ✓ Found existing film (ID: ${filmId})`);

          if (!dryRun) {
            const updates: any = {};
            const currentCountries = existingFilm.countries || [];
            if (!currentCountries.includes('Kenya')) {
              updates.countries = [...currentCountries, 'Kenya'];
            }
            if (!existingFilm.synopsis && synopsis) updates.synopsis = synopsis;
            if (!existingFilm.year && year) updates.year = year;
            if (!existingFilm.poster_url && posterUrl) updates.poster_url = posterUrl;

            const currentGenres = existingFilm.genres || [];
            const mergedGenres = Array.from(new Set([...currentGenres, ...genres]));
            if (mergedGenres.length > currentGenres.length) {
              updates.genres = mergedGenres;
            }

            if (Object.keys(updates).length > 0) {
              await supabase.from('films').update(updates).eq('id', filmId);
              console.log(`   ✓ Enriched existing film metadata in-place`);
            }
          }
          filmsEnriched++;
        } else {
          console.log(`   ✨ Inserting new Kenyan ${contentType}: "${title}"`);
          if (dryRun) {
            filmId = `dryrun-film-${item.id}`;
          } else {
            const { data: newFilm, error: filmErr } = await supabase
              .from('films')
              .insert({
                title: title,
                year: year,
                synopsis: synopsis,
                poster_url: posterUrl,
                countries: ['Kenya'],
                genres: genres,
                source: 'filamu.org',
                source_video_id: `filamu-${item.id}`,
                status: 'released',
                needs_review: false,
                content_type: contentType,
                release_type: 'cinema',
                is_nollywood: false
              })
              .select('id')
              .single();

            if (filmErr || !newFilm) {
              console.error(`   ❌ Failed to insert film "${title}":`, filmErr?.message);
              continue;
            }
            filmId = newFilm.id;
          }
          newFilmsCreated++;
        }

        // Attach Cast & Crew Credits
        if (peopleNames.length > 0) {
          console.log(`   👥 Linking ${peopleNames.length} cast/crew member(s)...`);
          let order = 1;
          for (const personName of peopleNames) {
            const personId = await findOrCreateActor(personName, dryRun);
            if (personId) {
              await attachCredit(filmId, personId, 'Cast Member', order++, dryRun);
            }
          }
        }

        // Small breather
        await sleep(150);
      }

      if (page >= result.totalPages) {
        break;
      }
      page++;
    }
  }

  console.log(`\n============================================================`);
  console.log(`🎉 Filamu.org Kenya Sync Complete!`);
  console.log(`   ✨ New Films/Series Created: ${newFilmsCreated}`);
  console.log(`   📝 Existing Films Enriched: ${filmsEnriched}`);
  console.log(`   🚫 Skipped: ${skippedCount}`);
  console.log(`   📊 Total Processed: ${totalProcessed}`);
  console.log(`============================================================`);
}

// CLI Execution Support
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const isAll = args.includes('--all');
const limitIdx = args.indexOf('--limit');
const limit = limitIdx !== -1 && args[limitIdx + 1] ? parseInt(args[limitIdx + 1], 10) : (isAll ? Infinity : 10);
const typeIdx = args.indexOf('--type');
const type = typeIdx !== -1 && args[typeIdx + 1] ? (args[typeIdx + 1] as any) : 'all';

syncFilamuKenya({ dryRun, limit, type }).catch(console.error);
