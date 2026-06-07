import dns from 'dns';
dns.setDefaultResultOrder('ipv4first');

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { ProxyAgent } from 'undici';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  (process.env.VITE_SUPABASE_URL || '').trim(),
  (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim(),
  {
    auth: { persistSession: false },
    global: {
      fetch: (url, init) => {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout
        return fetch(url, {
          ...init,
          signal: controller.signal
        }).finally(() => clearTimeout(timeoutId));
      }
    }
  }
);

const TMDB_API_KEY = (process.env.TMDB_API_KEY || process.env.VITE_TMDB_API_KEY || '').trim();
const FIRECRAWL_API_KEY = (process.env.FIRECRAWL_API_KEY || '').trim();

const PROXY_USER = (process.env.SMARTPROXY_USER || 'smart-n84gqsupfojn').trim();
const PROXY_PASS = (process.env.SMARTPROXY_PASS || 'cumaxLcBt96dj0Wp').trim();
const PROXY_HOST = (process.env.SMARTPROXY_HOST || 'proxy.smartproxy.net').trim();
const PROXY_PORT = (process.env.SMARTPROXY_PORT || '3120').trim();

const proxyAgent = new ProxyAgent({
  uri: `http://${PROXY_HOST}:${PROXY_PORT}`,
  token: 'Basic ' + Buffer.from(`${PROXY_USER}:${PROXY_PASS}`).toString('base64')
});

interface ImdbCredit {
  imdbId: string;
  name: string;
  role: string;
  characterName?: string;
}

interface ImdbMatch {
  imdbId: string;
  posterUrl?: string;
  year?: number;
}

// Memory cache for TMDB person resolution to prevent redundant find queries
const tmdbPersonCache = new Map<string, { tmdbId: string | null; photoUrl: string | null; knownForDept: string }>();

// ─── Promise Concurrency Limiter ─────────────────────────────────────────────
async function pLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: Promise<R>[] = [];
  const executing: Promise<any>[] = [];
  for (const item of items) {
    const p = Promise.resolve().then(() => fn(item));
    results.push(p);
    if (limit <= items.length) {
      const e: Promise<any> = p.then(() => executing.splice(executing.indexOf(e), 1));
      executing.push(e);
      if (executing.length >= limit) {
        await Promise.race(executing);
      }
    }
  }
  return Promise.all(results);
}

// ─── Fetch External Helper (routes through proxy to avoid WAF/firewalls) ─────
async function fetchExternal(url: string, options: any = {}): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 20000); // 20s timeout
  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
      dispatcher: proxyAgent,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        ...(options.headers || {})
      }
    });
  } finally {
    clearTimeout(timeoutId);
  }
}

// ─── Image Mirroring Helper ──────────────────────────────────────────────────
async function mirrorImageToSupabase(externalUrl: string, bucket: string, fileName: string): Promise<string | null> {
  if (!externalUrl) return null;
  try {
    const response = await fetchExternal(externalUrl);
    if (!response.ok) throw new Error(`Fetch failed with status ${response.status}`);
    
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    let contentType = 'image/jpeg';
    if (externalUrl.endsWith('.png')) {
      contentType = 'image/png';
    } else if (externalUrl.endsWith('.webp')) {
      contentType = 'image/webp';
    }

    const { error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(fileName, buffer, {
        contentType,
        upsert: true
      });

    if (uploadError) throw uploadError;

    const { data } = supabase.storage.from(bucket).getPublicUrl(fileName);
    return data.publicUrl;
  } catch (err: any) {
    console.error(`  ⚠️ Failed to mirror image ${externalUrl} to ${bucket}/${fileName}:`, err.message);
    return null;
  }
}

// ─── Slug Generator ──────────────────────────────────────────────────────────
function makeSlug(text: string): string {
  if (!text) return '';
  return text.toLowerCase()
    .replace(/[^a-z0-9\s]/g, '').trim()
    .replace(/\s+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
}

// ─── Title Cleaning helpers ──────────────────────────────────────────────────
function cleanMovieTitle(title: string): string {
  if (!title) return '';
  // Split by [movie] or (movie) case-insensitive
  let cleaned = title.split(/\[movie\]/i)[0].split(/\(movie\)/i)[0];
  // Also split by "| " or " - " (typically appended details in scraper)
  if (cleaned.includes('|')) {
    cleaned = cleaned.split('|')[0];
  }
  return cleaned.trim();
}

function cleanTitle(t: string): string {
  return t.toLowerCase()
    .replace(/[\u2018\u2019]/g, "'") // normalize smart single quotes
    .replace(/[\u201C\u201D]/g, '"') // normalize smart double quotes
    .replace(/\s*\[movie\]\s*$/i, '') // strip [movie] suffix
    .replace(/\s*\(movie\)\s*$/i, '')
    .replace(/[^a-z0-9]/g, '')
    .trim();
}

// ─── Person Upsert Helper ─────────────────────────────────────────────────────
async function upsertPersonWithDetails(person: { name: string; tmdbId: string | null; photoUrl: string | null; knownForDept: string }): Promise<string | null> {
  let existingId: string | null = null;

  if (person.tmdbId) {
    const { data: existing } = await supabase
      .from('people')
      .select('id')
      .eq('tmdb_id', person.tmdbId)
      .maybeSingle();
    if (existing) existingId = existing.id;
  }

  if (!existingId) {
    const { data: byName } = await supabase
      .from('people')
      .select('id')
      .ilike('name', person.name)
      .maybeSingle();
    if (byName) {
      existingId = byName.id;
      if (person.tmdbId) {
        await supabase
          .from('people')
          .update({ tmdb_id: person.tmdbId })
          .eq('id', existingId);
      }
    }
  }

  if (existingId) {
    // Optionally enrich missing details
    const { data: current } = await supabase
      .from('people')
      .select('photo_url, known_for_department')
      .eq('id', existingId)
      .single();
    
    const updates: any = {};
    if (current && !current.photo_url && person.photoUrl) {
      updates.photo_url = person.photoUrl;
    }
    if (current && (!current.known_for_department || current.known_for_department === 'Acting') && person.knownForDept !== 'Acting') {
      updates.known_for_department = person.knownForDept;
    }
    
    if (Object.keys(updates).length > 0) {
      await supabase.from('people').update(updates).eq('id', existingId);
    }
    
    return existingId;
  }

  // Generate collision-free slug
  const baseSlug = makeSlug(person.name);
  let slug = baseSlug;
  let counter = 2;
  
  while (true) {
    const { data: check } = await supabase
      .from('people')
      .select('id')
      .eq('slug', slug)
      .maybeSingle();

    const { data: checkMubi } = await supabase
      .from('people')
      .select('id')
      .eq('mubi_slug', slug)
      .maybeSingle();

    if (!check && !checkMubi) break;
    slug = `${baseSlug}-${counter}`;
    counter++;
  }

  const { data: newPerson, error } = await supabase
    .from('people')
    .insert({
      name: person.name,
      tmdb_id: person.tmdbId || undefined,
      photo_url: person.photoUrl || undefined,
      nationality: 'Nigerian',
      known_for_department: person.knownForDept || 'Acting',
      slug: slug,
      mubi_slug: slug
    })
    .select('id')
    .single();

  if (error) {
    console.error(`  ⚠️ Failed to create person "${person.name}":`, error.message);
    return null;
  }
  return newPerson.id;
}

// Keep legacy upsert function for compatibility with existing code paths
async function upsertPerson(tmdbPerson: { id: number; name: string; photoUrl: string | null }): Promise<string | null> {
  return upsertPersonWithDetails({
    name: tmdbPerson.name,
    tmdbId: tmdbPerson.id.toString(),
    photoUrl: tmdbPerson.photoUrl,
    knownForDept: 'Acting'
  });
}

// ─── Credit Linking Helper ────────────────────────────────────────────────────
async function linkCredit(filmId: string, personId: string, role: string, charName: string = "") {
  let query = supabase
    .from('credits')
    .select('id')
    .eq('film_id', filmId)
    .eq('person_id', personId)
    .eq('role', role);
  
  if (charName) {
    query = query.eq('character_name', charName);
  }

  const { data: check } = await query.maybeSingle();
  if (check) return; // Already linked

  await supabase.from('credits').insert({
    film_id: filmId,
    person_id: personId,
    role: role,
    character_name: charName || null,
    billing_order: 0
  });
}

// ─── IMDb Suggestion Lookup ──────────────────────────────────────────────────
async function resolveImdbMatch(title: string, year: number | null): Promise<ImdbMatch | null> {
  const cleaned = cleanMovieTitle(title);
  const cleanedQuery = cleaned.toLowerCase()
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[^a-z0-9]/g, '')
    .trim();

  if (!cleanedQuery) return null;

  const firstLetter = cleanedQuery.charAt(0);
  const queryUnderscored = cleaned.replace(/\s+/g, '_');
  const suggestionUrl = `https://v3.sg.media-imdb.com/suggestion/${firstLetter}/${encodeURIComponent(queryUnderscored)}.json`;

  try {
    const res = await fetchExternal(suggestionUrl).then(r => r.json());
    const results = res.d || [];
    const cleanedTitleToCompare = cleanTitle(cleaned);
    
    // Find matching item by title and type
    let match = results.find((item: any) => 
      cleanTitle(item.l) === cleanedTitleToCompare &&
      (item.q === 'feature' || item.q === 'movie' || item.q === 'TV movie' || item.q === 'TV special' || item.q === 'video' || item.q === 'short')
    );

    if (!match && results.length > 0) {
      match = results.find((item: any) => cleanTitle(item.l) === cleanedTitleToCompare);
    }

    if (match) {
      return {
        imdbId: match.id,
        posterUrl: match.i?.imageUrl || undefined,
        year: match.y || undefined
      };
    }
  } catch (err: any) {
    console.error(`  ⚠️ IMDb suggestion lookup failed for "${title}":`, err.message);
  }
  return null;
}

// ─── IMDb Credits Parser ─────────────────────────────────────────────────────
function parseImdbCredits(markdown: string): ImdbCredit[] {
  const credits: ImdbCredit[] = [];
  
  const sectionHeaders = [
    'Director', 'Writer', 'Cast', 'Producers', 'Composer', 'Cinematographer', 'Editor',
    'Makeup Department', 'Sound Department', 'Production Management', 'Camera and Electrical Department',
    'Costume and Wardrobe Department', 'Editorial Department', 'Location Management', 'Script and Continuity Department'
  ];
  
  interface SectionPos {
    name: string;
    index: number;
  }
  const positions: SectionPos[] = [];
  
  for (const header of sectionHeaders) {
    const escaped = header.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    const regex = new RegExp(`\\[\\*\\*${escaped}\\*\\*\\]`, 'gi');
    let match;
    while ((match = regex.exec(markdown)) !== null) {
      positions.push({ name: header, index: match.index });
    }
  }
  
  positions.sort((a, b) => a.index - b.index);
  
  for (let i = 0; i < positions.length; i++) {
    const start = positions[i].index;
    const end = i + 1 < positions.length ? positions[i + 1].index : markdown.length;
    const sectionName = positions[i].name;
    const sectionContent = markdown.substring(start, end);
    
    const nameRegex = /\[([^\]]+)\]\(https:\/\/www\.imdb\.com\/name\/(nm\d+)\/[^)]*\)/gi;
    let nameMatch;
    
    const sectionCreditsMap = new Map<string, ImdbCredit>();
    
    while ((nameMatch = nameRegex.exec(sectionContent)) !== null) {
      let rawName = nameMatch[1].trim();
      const imdbId = nameMatch[2];
      
      if (rawName.toLowerCase().startsWith('go to ')) {
        rawName = rawName.substring(6).trim();
      }
      
      if (!sectionCreditsMap.has(imdbId)) {
        sectionCreditsMap.set(imdbId, {
          imdbId,
          name: rawName,
          role: sectionName === 'Cast' ? 'actor' : sectionName
        });
      } else {
        if (!nameMatch[1].trim().toLowerCase().startsWith('go to ')) {
          const existing = sectionCreditsMap.get(imdbId)!;
          existing.name = rawName;
        }
      }
    }
    
    if (sectionName === 'Cast') {
      const charRegex = /\[([^\]]+)\]\(https:\/\/www\.imdb\.com\/title\/[^\/]+\/characters\/(nm\d+)\/[^)]*\)/gi;
      let charMatch;
      while ((charMatch = charRegex.exec(sectionContent)) !== null) {
        const characterName = charMatch[1].trim();
        const imdbId = charMatch[2];
        const credit = sectionCreditsMap.get(imdbId);
        if (credit) {
          credit.characterName = characterName;
        }
      }
    }
    
    for (const credit of sectionCreditsMap.values()) {
      credits.push(credit);
    }
  }
  
  return credits;
}

// ─── Direct IMDb Credit Sync (Firecrawl fallback) ───────────────────────────
async function syncFromIMDbDirect(filmId: string, imdbId: string, title: string, fallbackPosterUrl?: string): Promise<boolean> {
  if (!FIRECRAWL_API_KEY) {
    console.log('  ⚠️ FIRECRAWL_API_KEY is missing. Skipping direct IMDb phase.');
    return false;
  }

  const url = `https://www.imdb.com/title/${imdbId}/fullcredits`;
  console.log(`  🌐 Scrambling direct IMDb credits page via Firecrawl...`);
  
  try {
    const res = await fetch('https://api.firecrawl.dev/v1/scrape', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${FIRECRAWL_API_KEY}`
      },
      body: JSON.stringify({
        url: url,
        formats: ['markdown']
      })
    });

    if (!res.ok) throw new Error(`Firecrawl API responded with ${res.status}`);
    const data: any = await res.json();
    if (!data.success) {
      throw new Error(data.error || 'Unknown Firecrawl error');
    }

    const markdown = data.data.markdown || '';
    const parsedCredits = parseImdbCredits(markdown);
    console.log(`  🍿 Found ${parsedCredits.length} cast & crew credits on IMDb page.`);

    if (parsedCredits.length === 0) {
      console.log(`  ⚠️ No credits parsed from IMDb page.`);
      return false;
    }

    // Mirror Poster if available from Suggestion API
    let posterUrl: string | null = null;
    if (fallbackPosterUrl) {
      console.log(`  📸 Mirroring IMDb Suggestion poster to Supabase Storage...`);
      const mirrored = await mirrorImageToSupabase(fallbackPosterUrl, 'posters', `${filmId}-poster.jpg`);
      posterUrl = mirrored || fallbackPosterUrl;
    }

    // Update film details
    const updatePayload: any = {};
    if (posterUrl) updatePayload.poster_url = posterUrl;
    if (Object.keys(updatePayload).length > 0) {
      await supabase.from('films').update(updatePayload).eq('id', filmId);
    }

    // Deduplicate people to prevent race conditions during insertion
    const uniquePeopleMap = new Map<string, { name: string; imdbId: string; knownForDept: string }>();
    for (const credit of parsedCredits) {
      const key = credit.imdbId || credit.name.toLowerCase();
      if (!uniquePeopleMap.has(key)) {
        uniquePeopleMap.set(key, {
          name: credit.name,
          imdbId: credit.imdbId,
          knownForDept: credit.role === 'actor' ? 'Acting' : credit.role
        });
      }
    }

    const uniquePeople = Array.from(uniquePeopleMap.values());
    console.log(`  👤 Resolving and upserting ${uniquePeople.length} unique people...`);
    const personIdMap = new Map<string, string>();

    await pLimit(uniquePeople, 5, async (p) => {
      let photoUrl: string | null = null;
      let tmdbPersonId: string | null = null;
      let knownForDept = p.knownForDept;

      if (p.imdbId) {
        if (tmdbPersonCache.has(p.imdbId)) {
          const cached = tmdbPersonCache.get(p.imdbId)!;
          tmdbPersonId = cached.tmdbId;
          photoUrl = cached.photoUrl;
          knownForDept = cached.knownForDept;
        } else if (TMDB_API_KEY) {
          const findUrl = `https://api.themoviedb.org/3/find/${p.imdbId}?api_key=${TMDB_API_KEY}&external_source=imdb_id`;
          try {
            const tmdbRes = await fetchExternal(findUrl).then(r => r.json());
            const tmdbPerson = tmdbRes.person_results?.[0];
            if (tmdbPerson) {
              tmdbPersonId = tmdbPerson.id.toString();
              knownForDept = tmdbPerson.known_for_department || knownForDept;
              if (tmdbPerson.profile_path) {
                const extPhotoUrl = `https://image.tmdb.org/t/p/w185${tmdbPerson.profile_path}`;
                console.log(`    👤 Mirroring photo for ${p.name} from TMDB...`);
                const mirrored = await mirrorImageToSupabase(extPhotoUrl, 'people', `${tmdbPerson.id}-person.jpg`);
                photoUrl = mirrored || extPhotoUrl;
              }
            }
            // Cache resolution result
            tmdbPersonCache.set(p.imdbId, {
              tmdbId: tmdbPersonId,
              photoUrl,
              knownForDept
            });
          } catch (err: any) {
            // Silently ignore mapping errors
          }
        }
      }

      // Upsert person into people table
      const personId = await upsertPersonWithDetails({
        name: p.name,
        tmdbId: tmdbPersonId,
        photoUrl,
        knownForDept
      });

      if (personId) {
        const key = p.imdbId || p.name.toLowerCase();
        personIdMap.set(key, personId);
      }
    });

    // Link credits in parallel
    console.log(`  🔗 Linking credits in database...`);
    await pLimit(parsedCredits, 10, async (credit) => {
      const key = credit.imdbId || credit.name.toLowerCase();
      const personId = personIdMap.get(key);
      if (personId) {
        await linkCredit(filmId, personId, credit.role, credit.characterName || '');
      }
    });

    return true;
  } catch (err: any) {
    console.error(`  ⚠️ Direct IMDb enrichment failed:`, err.message);
    return false;
  }
}

// ─── Sync From TMDB ──────────────────────────────────────────────────────────
async function syncFromTMDB(filmId: string, tmdbId: number): Promise<boolean> {
  if (!TMDB_API_KEY) {
    console.log('  ⚠️ TMDB API Key is missing. Skipping TMDB phase.');
    return false;
  }

  try {
    const detailsUrl = `https://api.themoviedb.org/3/movie/${tmdbId}?api_key=${TMDB_API_KEY}&append_to_response=credits,external_ids`;
    const details = await fetchExternal(detailsUrl).then(r => r.json());

    if (!details || !details.credits) {
      return false;
    }

    // Mirror Poster and Backdrop to internal Supabase Storage CDN
    let posterUrl: string | undefined = undefined;
    if (details.poster_path) {
      const extUrl = `https://image.tmdb.org/t/p/w500${details.poster_path}`;
      console.log(`  📸 Mirroring poster to Supabase Storage...`);
      const mirrored = await mirrorImageToSupabase(extUrl, 'posters', `${filmId}-poster.jpg`);
      posterUrl = mirrored || extUrl;
    }

    let backdropUrl: string | undefined = undefined;
    if (details.backdrop_path) {
      const extUrl = `https://image.tmdb.org/t/p/w1280${details.backdrop_path}`;
      console.log(`  📸 Mirroring backdrop to Supabase Storage...`);
      const mirrored = await mirrorImageToSupabase(extUrl, 'backdrops', `${filmId}-backdrop.jpg`);
      backdropUrl = mirrored || extUrl;
    }

    // Enrich missing movie details in the database
    await supabase.from('films').update({
      tmdb_id: tmdbId.toString(),
      poster_url: posterUrl || undefined,
      backdrop_url: backdropUrl || undefined,
      synopsis: details.overview || undefined,
      runtime_minutes: details.runtime || undefined,
      tmdb_rating: details.vote_average || undefined,
      tagline: details.tagline || undefined
    }).eq('id', filmId);

    // Collect all unique people and credits
    const cast = (details.credits.cast || []).slice(0, 30);
    const allCredits: { tmdbId: number; name: string; role: string; characterName?: string; profilePath: string | null }[] = [];
    
    for (const actor of cast) {
      allCredits.push({
        tmdbId: actor.id,
        name: actor.name,
        role: 'actor',
        characterName: actor.character || '',
        profilePath: actor.profile_path || null
      });
    }

    const crewJobs = [
      'Director', 'Producer', 'Executive Producer', 'Director of Photography',
      'Editor', 'Original Music Composer', 'Costume Design', 'Makeup Artist',
      'Gaffer', 'Sound Designer', 'Production Manager', 'Writer'
    ];
    const crew = (details.credits.crew || []).filter((c: any) => crewJobs.includes(c.job));
    for (const member of crew) {
      allCredits.push({
        tmdbId: member.id,
        name: member.name,
        role: member.job,
        profilePath: member.profile_path || null
      });
    }

    // Deduplicate people by TMDB ID
    const uniqueTmdbPeople = new Map<number, { name: string; profilePath: string | null; knownForDept: string }>();
    for (const c of allCredits) {
      if (!uniqueTmdbPeople.has(c.tmdbId)) {
        uniqueTmdbPeople.set(c.tmdbId, {
          name: c.name,
          profilePath: c.profilePath,
          knownForDept: c.role === 'actor' ? 'Acting' : c.role
        });
      }
    }

    console.log(`  👤 Resolving and upserting ${uniqueTmdbPeople.size} unique people from TMDB...`);
    const tmdbPersonIdMap = new Map<number, string>(); // TMDB ID -> DB person.id
    
    await pLimit(Array.from(uniqueTmdbPeople.entries()), 5, async ([tmdbId, p]) => {
      let photoUrl = p.profilePath ? `https://image.tmdb.org/t/p/w185${p.profilePath}` : null;
      if (photoUrl) {
        console.log(`    👤 Mirroring photo for ${p.name}...`);
        const mirrored = await mirrorImageToSupabase(photoUrl, 'people', `${tmdbId}-person.jpg`);
        photoUrl = mirrored || photoUrl;
      }
      
      const personId = await upsertPersonWithDetails({
        name: p.name,
        tmdbId: tmdbId.toString(),
        photoUrl,
        knownForDept: p.knownForDept
      });
      
      if (personId) {
        tmdbPersonIdMap.set(tmdbId, personId);
      }
    });

    console.log(`  🔗 Linking credits in database...`);
    await pLimit(allCredits, 10, async (c) => {
      const personId = tmdbPersonIdMap.get(c.tmdbId);
      if (personId) {
        await linkCredit(filmId, personId, c.role, c.characterName || '');
      }
    });

    return true;
  } catch (err: any) {
    console.error('  ⚠️ Error syncing from TMDB:', err.message);
    return false;
  }
}

// ─── Main Pipeline Loop ───────────────────────────────────────────────────────
async function main() {
  console.log('🚀 Starting IMDb/TMDB Film Credit & Media Enrichment Pipeline...\n');

  if (!TMDB_API_KEY) {
    console.error('❌ TMDB_API_KEY is not defined in .env.local');
    process.exit(1);
  }

  if (!FIRECRAWL_API_KEY) {
    console.error('❌ FIRECRAWL_API_KEY is not defined in .env.local');
    process.exit(1);
  }

  // Fetch films missing tmdb_id, sorted by created_at DESC (so newly scraped ones go first)
  console.log('📦 Fetching candidate films from database...');
  const { data: films, error } = await supabase
    .from('films')
    .select('id, title, year, needs_review, created_at, credits(id)')
    .is('tmdb_id', null)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('❌ Error fetching films:', error.message);
    process.exit(1);
  }

  // Filter in memory to select films that:
  // 1. Do not have needs_review = true (already failed lookup)
  // 2. Do not already have credits (already successfully enriched)
  const toProcessRaw = films || [];
  const candidateFilms = toProcessRaw.filter(f => 
    f.needs_review !== true && 
    (!f.credits || f.credits.length === 0)
  );

  console.log(`📝 Found ${candidateFilms.length} candidate films missing enrichment.`);
  
  if (candidateFilms.length === 0) {
    console.log('✅ All films are already enriched!');
    return;
  }

  // Process a batch of films to prevent rate-limiting or long processes
  const LIMIT = 50; 
  const toProcess = candidateFilms.slice(0, LIMIT);
  console.log(`⚡ Processing a batch of ${toProcess.length} films...`);

  let tmdbSuccessCount = 0;
  let imdbSuccessCount = 0;
  let failedCount = 0;

  for (let i = 0; i < toProcess.length; i++) {
    const film = toProcess[i];
    console.log(`\n[${i + 1}/${toProcess.length}] 🎥 "${film.title}" (${film.year || 'N/A'})`);
    
    // Check if TMDB sync succeeds or fallback to IMDb
    const cleanedTitle = cleanMovieTitle(film.title);
    const imdbMatch = await resolveImdbMatch(film.title, film.year);

    let resolved = false;
    if (imdbMatch) {
      console.log(`  🌐 IMDb Suggestion Match: "${cleanedTitle}" (IMDb ID: ${imdbMatch.imdbId})`);

      // Try TMDB Find by IMDb ID
      let tmdbId: number | null = null;
      const findUrl = `https://api.themoviedb.org/3/find/${imdbMatch.imdbId}?api_key=${TMDB_API_KEY}&external_source=imdb_id`;
      try {
        const findRes = await fetchExternal(findUrl).then(r => r.json());
        const findMatch = findRes.movie_results?.[0];
        if (findMatch) {
          tmdbId = findMatch.id;
          console.log(`  🌐 TMDB Match (via IMDb Find): "${findMatch.title}" (TMDB ID: ${tmdbId})`);
        }
      } catch (err: any) {
        // Silently ignore finding error
      }

      if (tmdbId) {
        const success = await syncFromTMDB(film.id, tmdbId);
        if (success) {
          console.log(`✅ ENRICHED VIA TMDB: "${film.title}"`);
          await supabase.from('films').update({ needs_review: false }).eq('id', film.id);
          tmdbSuccessCount++;
          resolved = true;
        }
      }

      if (!resolved) {
        // Fallback: direct IMDb sync
        const success = await syncFromIMDbDirect(film.id, imdbMatch.imdbId, cleanedTitle, imdbMatch.posterUrl);
        if (success) {
          console.log(`✅ ENRICHED VIA IMDB DIRECT: "${film.title}"`);
          await supabase.from('films').update({ needs_review: false }).eq('id', film.id);
          imdbSuccessCount++;
          resolved = true;
        }
      }
    }

    if (!resolved) {
      // Last resort: TMDB search by title
      let tmdbId: number | null = null;
      let searchUrl = `https://api.themoviedb.org/3/search/movie?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(cleanedTitle)}&include_adult=false`;
      if (film.year) searchUrl += `&primary_release_year=${film.year}`;
      try {
        let res = await fetchExternal(searchUrl).then(r => r.json());
        let results = res.results || [];
        if (results.length === 0 && film.year) {
          const fallbackUrl = `https://api.themoviedb.org/3/search/movie?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(cleanedTitle)}&include_adult=false`;
          res = await fetchExternal(fallbackUrl).then(r => r.json());
          results = res.results || [];
        }
        const cleanedQuery = cleanTitle(cleanedTitle);
        const match = results.find((r: any) => 
          cleanTitle(r.title) === cleanedQuery || 
          cleanTitle(r.original_title) === cleanedQuery
        );
        if (match) {
          tmdbId = match.id;
          console.log(`  🌐 TMDB Match (via Title Search): "${match.title}" (TMDB ID: ${tmdbId})`);
          const success = await syncFromTMDB(film.id, tmdbId);
          if (success) {
            console.log(`✅ ENRICHED VIA TMDB TITLE SEARCH: "${film.title}"`);
            await supabase.from('films').update({ needs_review: false }).eq('id', film.id);
            tmdbSuccessCount++;
            resolved = true;
          }
        }
      } catch (err: any) {
        // Ignore search errors
      }
    }

    if (!resolved) {
      console.log(`❌ Could not enrich "${film.title}" from TMDB or IMDb. Flagging for review.`);
      await supabase.from('films').update({ needs_review: true }).eq('id', film.id);
      failedCount++;
    }

    // Small delay to prevent rate limits
    await new Promise(res => setTimeout(res, 1200));
  }

  console.log('\n==========================================');
  console.log('🏁 Batch Enrichment Complete');
  console.log(`✅ Successes via TMDB:        ${tmdbSuccessCount}`);
  console.log(`✅ Successes via IMDb Direct: ${imdbSuccessCount}`);
  console.log(`❌ Failed / Flagged:          ${failedCount}`);
  console.log('==========================================\n');
}

main().catch(err => {
  console.error('💥 Critical Error in enrichment:', err);
  process.exit(1);
});
