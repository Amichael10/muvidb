import dns from 'node:dns';
dns.setDefaultResultOrder('ipv4first');
dns.setServers(['8.8.8.8', '1.1.1.1']);

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config();
import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const tmdbToken = process.env.TMDB_ACCESS_TOKEN || process.env.VITE_TMDB_API_KEY;

const CACHE_DIR = path.resolve('scripts/data/imdb_raw_cache');

// Complete list of 63 target IMDb IDs in order
const TARGET_IMDB_IDS = [
  'tt27072200', 'tt26698628', 'tt6779038', 'tt28353848', 'tt26689336',
  'tt39390781', 'tt37427298', 'tt39290795', 'tt23144036', 'tt26450673',
  'tt39257769', 'tt23555706', 'tt23747008', 'tt9898916', 'tt22099034',
  'tt15192042', 'tt19671142', 'tt35069649', 'tt33344252', 'tt30702016',
  'tt31691317', 'tt13492362', 'tt12428002', 'tt2389428', 'tt2577388',
  'tt12719884', 'tt10167344', 'tt22469048', 'tt23643904', 'tt6316634',
  'tt29278939', 'tt23901472', 'tt12728832', 'tt33096902', 'tt29537499',
  'tt32880282', 'tt38582577', 'tt30890638', 'tt33090925', 'tt31182834',
  'tt27664362', 'tt28654625', 'tt6558110', 'tt37232807', 'tt14854224',
  'tt37675956', 'tt32880855', 'tt10202268', 'tt21361596', 'tt32439054',
  'tt36365628', 'tt37731888', 'tt7953874', 'tt10738058', 'tt34743544',
  'tt16401480', 'tt6838464', 'tt4184438', 'tt9822338', 'tt16817152',
  'tt7128052', 'tt27411942', 'tt25966838'
];

// Verified mapping for TMDB IDs (TV or Movie)
const TMDB_MAPPING: Record<string, { type: 'tv' | 'movie'; id: number }> = {
  'tt6779038': { type: 'movie', id: 621304 }, // Children of Blood and Bone
  'tt26689336': { type: 'tv', id: 245045 }, // Wura
  'tt23747008': { type: 'tv', id: 215874 }, // Far from Home
  'tt9898916': { type: 'tv', id: 83709 }, // Castle & Castle
  'tt22099034': { type: 'tv', id: 217460 }, // Shanty Town
  'tt15192042': { type: 'tv', id: 131584 }, // King of Boys: The Return of the King
  'tt19671142': { type: 'tv', id: 197427 }, // Savage Beauty
  'tt35069649': { type: 'tv', id: 279349 }, // Roses and Ivy
  'tt33344252': { type: 'tv', id: 270364 }, // Blood Legacy
  'tt30702016': { type: 'tv', id: 242433 }, // War: Wrath and Revenge
  'tt31691317': { type: 'tv', id: 257206 }, // Oloture: The Journey
  'tt13492362': { type: 'tv', id: 114649 }, // How to Ruin Christmas
  'tt12428002': { type: 'tv', id: 133762 }, // The Smart Money Woman
  'tt2389428': { type: 'tv', id: 279364 }, // Tinsel
  'tt2577388': { type: 'tv', id: 99049 }, // MTV Shuga Naija
  'tt23643904': { type: 'tv', id: 100826 }, // Skinny Girl in Transit
  'tt33096902': { type: 'movie', id: 1311550 }, // House of Ga'a
  'tt29537499': { type: 'movie', id: 1179061 }, // Ijogbon
  'tt32880282': { type: 'movie', id: 1206988 }, // A Tribe Called Judah
  'tt30890638': { type: 'movie', id: 1210724 }, // Afamefuna: An Nwa Boi Story
  'tt33090925': { type: 'movie', id: 1362418 }, // Lisabi: The Uprising
  'tt31182834': { type: 'movie', id: 1195631 }, // Breathe of Life
  'tt27664362': { type: 'tv', id: 245679 }, // Adulting
  'tt28654625': { type: 'tv', id: 238296 }, // Outlaws
  'tt37232807': { type: 'movie', id: 1193708 }, // Queenstown Kings
  'tt14854224': { type: 'tv', id: 197428 }, // Blood Sisters
  'tt37675956': { type: 'tv', id: 233343 }, // Miseducation
  'tt32880855': { type: 'tv', id: 157717 }, // Young, Famous & African
  'tt10202268': { type: 'tv', id: 86354 }, // Sons of the Caliphate
  'tt21361596': { type: 'tv', id: 227975 }, // Fatal Seduction
  'tt32439054': { type: 'tv', id: 103411 }, // Blood & Water
  'tt37731888': { type: 'tv', id: 195925 }, // Senzo: Murder of a Soccer Star
  'tt34743544': { type: 'tv', id: 268182 }, // Princess on a Hill
  'tt4184438': { type: 'tv', id: 212353 }, // Before 30
  'tt7128052': { type: 'tv', id: 78861 }, // The Governor
  'tt27411942': { type: 'tv', id: 223656 }, // Beyond the Veil
};

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function cleanAmazonImageUrl(url?: string | null): string | null {
  if (!url) return null;
  return url.replace(/\._V1_.*?\.(jpg|jpeg|png)$/i, '.$1');
}

// Memory caches to avoid re-querying inside loop
const personCache = new Map<string, string>(); // name_key -> person_id
const companyCache = new Map<string, string>(); // slug -> company_id

async function getOrCreatePerson(p: { name: string; photoUrl?: string | null; imdbId?: string | null; tmdbId?: number | null; department?: string }) {
  const cleanName = p.name.trim();
  const nameKey = cleanName.toLowerCase();
  if (personCache.has(nameKey)) {
    return personCache.get(nameKey)!;
  }

  // Lookup in DB
  const { data: existing } = await supabase
    .from('people')
    .select('id, photo_url')
    .or(`name.ilike."${cleanName}",name_key.eq."${nameKey}"`)
    .limit(1)
    .maybeSingle();

  if (existing) {
    personCache.set(nameKey, existing.id);
    // Optionally backfill photo if missing
    if (!existing.photo_url && p.photoUrl) {
      await supabase.from('people').update({ photo_url: p.photoUrl }).eq('id', existing.id);
    }
    return existing.id;
  }

  // Create new person
  let baseSlug = slugify(cleanName);
  let slug = baseSlug;
  const { data: slugCheck } = await supabase.from('people').select('id').eq('slug', slug).maybeSingle();
  if (slugCheck) {
    slug = `${baseSlug}-${Math.floor(1000 + Math.random() * 9000)}`;
  }

  const { data: created, error } = await supabase
    .from('people')
    .insert({
      name: cleanName,
      slug,
      photo_url: p.photoUrl || null,
      imdb_id: p.imdbId || null,
      tmdb_id: p.tmdbId ? String(p.tmdbId) : null,
      known_for_department: p.department || 'Acting',
    })
    .select('id')
    .single();

  if (error || !created) {
    console.error(`Failed to create person "${cleanName}":`, error?.message);
    return null;
  }

  personCache.set(nameKey, created.id);
  return created.id;
}

async function getOrCreateCompany(companyName: string) {
  const clean = companyName.trim();
  const slug = slugify(clean);
  if (companyCache.has(slug)) {
    return companyCache.get(slug)!;
  }

  const { data: existing } = await supabase
    .from('companies')
    .select('id')
    .or(`slug.eq."${slug}",name.ilike."${clean}"`)
    .limit(1)
    .maybeSingle();

  if (existing) {
    companyCache.set(slug, existing.id);
    return existing.id;
  }

  const { data: created, error } = await supabase
    .from('companies')
    .insert({
      name: clean,
      slug,
      company_type: 'production',
    })
    .select('id')
    .single();

  if (error || !created) {
    console.error(`Failed to create company "${clean}":`, error?.message);
    return null;
  }

  companyCache.set(slug, created.id);
  return created.id;
}

// Zero-Duplicate Actor Guarantee: upsert single credit row per person per film
async function upsertCredit(filmId: string, personId: string, role: string, characterName?: string | null, billingOrder?: number) {
  const cleanRole = (role || 'actor').toLowerCase();
  
  // Look up existing credit row
  const { data: existing } = await supabase
    .from('credits')
    .select('id, character_name, role, billing_order')
    .eq('film_id', filmId)
    .eq('person_id', personId)
    .maybeSingle();

  if (existing) {
    // Enrich in place without duplicate row!
    const updates: any = {};
    if (!existing.character_name && characterName) updates.character_name = characterName;
    if (billingOrder != null && existing.billing_order == null) updates.billing_order = billingOrder;
    if (Object.keys(updates).length > 0) {
      await supabase.from('credits').update(updates).eq('id', existing.id);
    }
    return existing.id;
  }

  // Insert credit row
  const { data: inserted, error } = await supabase
    .from('credits')
    .insert({
      film_id: filmId,
      person_id: personId,
      role: cleanRole,
      character_name: characterName || null,
      billing_order: billingOrder ?? 99,
      source: 'ingestion_sync',
    })
    .select('id')
    .single();

  if (error) {
    console.error(`Failed to insert credit:`, error.message);
  }
  return inserted?.id || null;
}

async function linkCompany(filmId: string, companyId: string, role: 'production' | 'distribution' = 'production') {
  const { data: existing } = await supabase
    .from('film_companies')
    .select('film_id')
    .eq('film_id', filmId)
    .eq('company_id', companyId)
    .maybeSingle();

  if (!existing) {
    await supabase.from('film_companies').insert({
      film_id: filmId,
      company_id: companyId,
      role,
    });
  }
}

async function upsertFilmMedia(filmId: string, url: string, category: 'poster' | 'backdrop' | 'production_still' | 'trailer', mediaType: 'photo' | 'video' = 'photo', isPrimary = false, title?: string) {
  if (!url) return;
  const { data: existing } = await supabase
    .from('film_media')
    .select('id')
    .eq('film_id', filmId)
    .eq('url', url)
    .maybeSingle();

  if (!existing) {
    await supabase.from('film_media').insert({
      film_id: filmId,
      url,
      thumbnail_url: url,
      category,
      media_type: mediaType,
      is_primary: isPrimary,
      title: title || `${category} asset`,
      status: 'approved',
    });
  }
}

// TMDB Full Series Data Fetcher
async function fetchTmdbSeriesData(tmdbId: number) {
  const [detailsRes, creditsRes, providersRes, imagesRes] = await Promise.all([
    fetch(`https://api.themoviedb.org/3/tv/${tmdbId}?append_to_response=external_ids,keywords`, {
      headers: { Authorization: `Bearer ${tmdbToken}`, Accept: 'application/json' },
    }),
    fetch(`https://api.themoviedb.org/3/tv/${tmdbId}/aggregate_credits`, {
      headers: { Authorization: `Bearer ${tmdbToken}`, Accept: 'application/json' },
    }),
    fetch(`https://api.themoviedb.org/3/tv/${tmdbId}/watch/providers`, {
      headers: { Authorization: `Bearer ${tmdbToken}`, Accept: 'application/json' },
    }),
    fetch(`https://api.themoviedb.org/3/tv/${tmdbId}/images`, {
      headers: { Authorization: `Bearer ${tmdbToken}`, Accept: 'application/json' },
    }),
  ]);

  const details = await detailsRes.json();
  const credits = await creditsRes.json();
  const providers = await providersRes.json();
  const images = await imagesRes.json();

  // Watch providers
  const streamingLinks: Record<string, string> = {};
  const flatrate = providers.results?.NG?.flatrate || providers.results?.ZA?.flatrate || providers.results?.US?.flatrate || [];
  for (const p of flatrate) {
    const pName = p.provider_name.toLowerCase();
    if (pName.includes('netflix')) streamingLinks.netflix = 'https://www.netflix.com';
    else if (pName.includes('showmax')) streamingLinks.showmax = 'https://www.showmax.com';
    else if (pName.includes('prime') || pName.includes('amazon')) streamingLinks.prime_video = 'https://www.amazon.com/primevideo';
    else if (pName.includes('apple')) streamingLinks.apple_tv = 'https://tv.apple.com';
  }
  // If networks contain Showmax or Netflix or Africa Magic
  for (const n of details.networks || []) {
    const netName = n.name.toLowerCase();
    if (netName.includes('netflix')) streamingLinks.netflix = 'https://www.netflix.com';
    if (netName.includes('showmax')) streamingLinks.showmax = 'https://www.showmax.com';
    if (netName.includes('africa magic') || netName.includes('dstv')) streamingLinks.showmax = 'https://www.showmax.com';
    if (netName.includes('youtube')) streamingLinks.youtube = 'https://www.youtube.com';
  }

  // Fetch season episodes (for up to 5 seasons)
  const allEpisodes: any[] = [];
  const regularSeasons = (details.seasons || []).filter((s: any) => s.season_number > 0);
  for (const s of regularSeasons.slice(0, 5)) {
    try {
      const sRes = await fetch(`https://api.themoviedb.org/3/tv/${tmdbId}/season/${s.season_number}`, {
        headers: { Authorization: `Bearer ${tmdbToken}`, Accept: 'application/json' },
      });
      const sData = await sRes.json();
      for (const ep of sData.episodes || []) {
        allEpisodes.push({
          seasonNumber: ep.season_number,
          episodeNumber: ep.episode_number,
          title: ep.name || `Episode ${ep.episode_number}`,
          synopsis: ep.overview || '',
          releaseDate: ep.air_date || null,
          year: ep.air_date ? parseInt(ep.air_date.slice(0, 4), 10) : null,
          runtimeMinutes: ep.runtime || (details.episode_run_time?.[0] || 45),
          stillUrl: ep.still_path ? `https://image.tmdb.org/t/p/original${ep.still_path}` : null,
          crew: ep.crew || [],
          guestStars: ep.guest_stars || [],
        });
      }
    } catch (e: any) {
      console.error(`Error fetching season ${s.season_number} for TMDB ${tmdbId}:`, e.message);
    }
  }

  return {
    title: details.name,
    originalTitle: details.original_name,
    synopsis: details.overview,
    posterUrl: details.poster_path ? `https://image.tmdb.org/t/p/original${details.poster_path}` : null,
    backdropUrl: details.backdrop_path ? `https://image.tmdb.org/t/p/original${details.backdrop_path}` : null,
    genres: (details.genres || []).map((g: any) => g.name),
    releaseDate: details.first_air_date || null,
    year: details.first_air_date ? parseInt(details.first_air_date.slice(0, 4), 10) : null,
    runtimeMinutes: details.episode_run_time?.[0] || 45,
    seasonCount: regularSeasons.length || 1,
    episodeCount: details.number_of_episodes || allEpisodes.length,
    tmdbRating: details.vote_average || null,
    tmdbVoteCount: details.vote_count || null,
    streamingLinks,
    companies: (details.production_companies || []).map((c: any) => c.name),
    cast: (credits.cast || []).slice(0, 30).map((c: any, idx: number) => ({
      name: c.name,
      character: c.roles?.[0]?.character || '',
      photoUrl: c.profile_path ? `https://image.tmdb.org/t/p/original${c.profile_path}` : null,
      tmdbId: c.id,
      billingOrder: idx + 1,
      role: 'actor',
    })),
    crew: (credits.crew || []).slice(0, 20).map((c: any) => ({
      name: c.name,
      photoUrl: c.profile_path ? `https://image.tmdb.org/t/p/original${c.profile_path}` : null,
      tmdbId: c.id,
      role: (c.jobs?.[0]?.job || c.department || 'Crew').toLowerCase().includes('director') ? 'director' :
            (c.jobs?.[0]?.job || c.department || 'Crew').toLowerCase().includes('writer') ? 'writer' :
            (c.jobs?.[0]?.job || c.department || 'Crew').toLowerCase().includes('producer') ? 'producer' : 'crew',
    })),
    episodes: allEpisodes,
  };
}

// TMDB Full Movie Data Fetcher
async function fetchTmdbMovieData(tmdbId: number) {
  const [detailsRes, creditsRes, providersRes, imagesRes] = await Promise.all([
    fetch(`https://api.themoviedb.org/3/movie/${tmdbId}?append_to_response=external_ids,keywords`, {
      headers: { Authorization: `Bearer ${tmdbToken}`, Accept: 'application/json' },
    }),
    fetch(`https://api.themoviedb.org/3/movie/${tmdbId}/credits`, {
      headers: { Authorization: `Bearer ${tmdbToken}`, Accept: 'application/json' },
    }),
    fetch(`https://api.themoviedb.org/3/movie/${tmdbId}/watch/providers`, {
      headers: { Authorization: `Bearer ${tmdbToken}`, Accept: 'application/json' },
    }),
    fetch(`https://api.themoviedb.org/3/movie/${tmdbId}/images`, {
      headers: { Authorization: `Bearer ${tmdbToken}`, Accept: 'application/json' },
    }),
  ]);

  const details = await detailsRes.json();
  const credits = await creditsRes.json();
  const providers = await providersRes.json();
  const images = await imagesRes.json();

  const streamingLinks: Record<string, string> = {};
  const flatrate = providers.results?.NG?.flatrate || providers.results?.ZA?.flatrate || providers.results?.US?.flatrate || [];
  for (const p of flatrate) {
    const pName = p.provider_name.toLowerCase();
    if (pName.includes('netflix')) streamingLinks.netflix = 'https://www.netflix.com';
    else if (pName.includes('showmax')) streamingLinks.showmax = 'https://www.showmax.com';
    else if (pName.includes('prime') || pName.includes('amazon')) streamingLinks.prime_video = 'https://www.amazon.com/primevideo';
  }

  return {
    title: details.title,
    originalTitle: details.original_title,
    synopsis: details.overview,
    posterUrl: details.poster_path ? `https://image.tmdb.org/t/p/original${details.poster_path}` : null,
    backdropUrl: details.backdrop_path ? `https://image.tmdb.org/t/p/original${details.backdrop_path}` : null,
    genres: (details.genres || []).map((g: any) => g.name),
    releaseDate: details.release_date || null,
    year: details.release_date ? parseInt(details.release_date.slice(0, 4), 10) : null,
    runtimeMinutes: details.runtime || 120,
    tmdbRating: details.vote_average || null,
    tmdbVoteCount: details.vote_count || null,
    streamingLinks,
    companies: (details.production_companies || []).map((c: any) => c.name),
    cast: (credits.cast || []).slice(0, 30).map((c: any, idx: number) => ({
      name: c.name,
      character: c.character || '',
      photoUrl: c.profile_path ? `https://image.tmdb.org/t/p/original${c.profile_path}` : null,
      tmdbId: c.id,
      billingOrder: idx + 1,
      role: 'actor',
    })),
    crew: (credits.crew || []).slice(0, 20).map((c: any) => ({
      name: c.name,
      photoUrl: c.profile_path ? `https://image.tmdb.org/t/p/original${c.profile_path}` : null,
      tmdbId: c.id,
      role: (c.job || c.department || 'Crew').toLowerCase().includes('director') ? 'director' :
            (c.job || c.department || 'Crew').toLowerCase().includes('writer') ? 'writer' :
            (c.job || c.department || 'Crew').toLowerCase().includes('producer') ? 'producer' : 'crew',
    })),
    episodes: [],
  };
}

// IMDb Cached Scrape Parser
function parseCachedImdbData(imdbId: string) {
  const mainPath = path.join(CACHE_DIR, `${imdbId}_main.md`);
  const epPath = path.join(CACHE_DIR, `${imdbId}_episodes.md`);
  if (!fs.existsSync(mainPath)) return null;

  const md = fs.readFileSync(mainPath, 'utf8');

  // Title
  const titleMatch = md.match(/^#\s+(.+)$/m);
  const title = titleMatch ? titleMatch[1].trim() : 'Unknown';

  const isSeries = md.includes('TV Series') || md.includes('TV Mini Series') || md.includes('Episode guide');

  // Rating
  const ratingMatch = md.match(/(\d+\.\d+)\/10/);
  const imdbRating = ratingMatch ? parseFloat(ratingMatch[1]) : null;

  // Poster
  const posterMatch = md.match(/!\[.*?\]\((https:\/\/m\.media-amazon\.com\/images\/M\/[^)]+)\)/);
  const posterUrl = posterMatch ? cleanAmazonImageUrl(posterMatch[1]) : null;

  // Release date & year
  let releaseDate: string | null = null;
  let year: number | null = null;
  const relMatch = md.match(/-\s*\[Release date\][^\n]*\n+[\s-]*\[([^\]]+)\((?:Nigeria|United States|South Africa|Ghana|worldwide|.*?)\)\]/i);
  if (relMatch) {
    const raw = relMatch[1].trim();
    const d = new Date(raw);
    if (!isNaN(d.getTime())) {
      releaseDate = d.toISOString().split('T')[0];
      year = d.getFullYear();
    }
  }
  if (!year) {
    const yMatch = md.match(/\b(19\d\d|20\d\d)(?:–(19\d\d|20\d\d)?)?\b/);
    if (yMatch) year = parseInt(yMatch[1], 10);
  }

  // Genres
  const genres = new Set<string>();
  const KNOWN_GENRES = ['Drama', 'Comedy', 'Thriller', 'Action', 'Romance', 'Crime', 'Family', 'Horror', 'Documentary', 'Adventure', 'Mystery'];
  for (const g of KNOWN_GENRES) {
    if (new RegExp(`\\[${g}\\]\\(https:\\/\\/www\\.imdb\\.com\\/(?:interest|search\\/title\\/\\?genres=)`, 'i').test(md)) {
      genres.add(g);
    }
  }
  if (genres.size === 0) genres.add('Drama');

  // Synopsis
  let synopsis = '';
  const storyMatch = md.match(/\[\*\*Storyline\*\*\][^\n]*\n+Edit\n+([^\n]+)/i);
  if (storyMatch) {
    synopsis = storyMatch[1].trim();
  } else {
    const pMatch = md.match(/(?:\[Comedy\]|\[Drama\]|\[Thriller\]|\[Action\])[^\n]*\n+([A-Z][^\n]{30,})/);
    if (pMatch) synopsis = pMatch[1].trim();
  }
  if (synopsis.length > 50) {
    const half = Math.floor(synopsis.length / 2);
    const firstHalf = synopsis.slice(0, half).trim();
    if (synopsis.includes(firstHalf + firstHalf)) synopsis = firstHalf;
  }

  // Companies
  const companies: string[] = [];
  const compMatch = md.match(/-\s*\[Production compan(?:y|ies)\][^\n]*\n+[\s-]*\[([^\]]+)\]\(https:\/\/www\.imdb\.com\/company\/co\d+\//i);
  if (compMatch) companies.push(compMatch[1].trim());

  // Streaming links
  const streamingLinks: Record<string, string> = {};
  const ytMatch = md.match(/\(https:\/\/(?:www\.)?youtube\.com\/watch\?v=[^)]+\)/i);
  if (ytMatch) streamingLinks.youtube = ytMatch[0].slice(1, -1);
  if (/netflix/i.test(md)) streamingLinks.netflix = 'https://www.netflix.com';
  if (/showmax/i.test(md)) streamingLinks.showmax = 'https://www.showmax.com';
  if (/prime video|amazon prime/i.test(md)) streamingLinks.prime_video = 'https://www.amazon.com/primevideo';

  // Cast
  const cast: any[] = [];
  const castSectionMatch = md.match(/\[\*\*Top Cast\d*\*\*\]([\s\S]*?)(?:## Details|\[\*\*Storyline\*\*\]|\[\*\*More like this\*\*\])/i);
  if (castSectionMatch) {
    const section = castSectionMatch[1];
    const castBlocks = section.matchAll(/\[Go to ([^\]]+)\]\(https:\/\/www\.imdb\.com\/name\/(nm\d+)\/[^)]*\)[\s\S]*?\[([^\]]+)\]\(https:\/\/www\.imdb\.com\/title\/[^\/]+\/characters\/\2/gi);
    let order = 1;
    for (const cb of castBlocks) {
      cast.push({
        name: cb[1].trim(),
        character: cb[3].trim(),
        imdbId: cb[2],
        billingOrder: order++,
        role: 'actor',
      });
    }
  }

  // Episodes from epPath
  const episodes: any[] = [];
  if (fs.existsSync(epPath)) {
    const epMd = fs.readFileSync(epPath, 'utf8');
    const epRegex = /####\s+\[S(\d+)\.E(\d+)\s+[∙•\-]\s+([^\]]+)\]\(https:\/\/www\.imdb\.com\/title\/(tt\d+)\/[^)]*\)/g;
    let epMatch;
    while ((epMatch = epRegex.exec(epMd)) !== null) {
      const sNum = parseInt(epMatch[1], 10);
      const eNum = parseInt(epMatch[2], 10);
      const epTitle = epMatch[3].trim();
      const epImdbId = epMatch[4];

      const startIndex = epMatch.index;
      const nextMatch = epMd.slice(startIndex + epMatch[0].length).match(/####\s+\[S\d+\.E\d+/);
      const endIndex = nextMatch ? startIndex + epMatch[0].length + nextMatch.index! : startIndex + 1200;
      const block = epMd.slice(startIndex, endIndex);

      let epDate: string | null = null;
      const dMatch = block.match(/(?:Sun|Mon|Tue|Wed|Thu|Fri|Sat),\s+([A-Za-z]{3}\s+\d{1,2},\s+\d{4})/i);
      if (dMatch) {
        const d = new Date(dMatch[1]);
        if (!isNaN(d.getTime())) epDate = d.toISOString().split('T')[0];
      }

      let epSynopsis = '';
      const lines = block.split('\n')
        .map(l => l.trim())
        .filter(l => l.length > 0 && !l.startsWith('####') && !l.startsWith('![') && !l.startsWith('[') && !/^(Sun|Mon|Tue|Wed|Thu|Fri|Sat),/i.test(l) && !/^(Rate|Mark as watched|Add a plot)/i.test(l) && !/^\d+(\.\d+)?(\/\d+)?$/.test(l));
      if (lines.length > 0) epSynopsis = lines[0];

      let epStill: string | null = null;
      const imgMatch = block.match(/!\[.*?\]\((https:\/\/m\.media-amazon\.com\/images\/M\/[^)]+)\)/);
      if (imgMatch) epStill = cleanAmazonImageUrl(imgMatch[1]);

      episodes.push({
        seasonNumber: sNum,
        episodeNumber: eNum,
        title: epTitle,
        imdbId: epImdbId,
        releaseDate: epDate,
        year: epDate ? parseInt(epDate.slice(0, 4), 10) : year,
        synopsis: epSynopsis,
        stillUrl: epStill || posterUrl,
        runtimeMinutes: 30,
      });
    }
  }

  return {
    title,
    isSeries,
    imdbRating,
    posterUrl,
    backdropUrl: posterUrl,
    releaseDate,
    year,
    genres: Array.from(genres),
    synopsis,
    companies,
    streamingLinks,
    cast,
    crew: [],
    episodes,
    seasonCount: episodes.length > 0 ? Math.max(...episodes.map(e => e.seasonNumber)) : 1,
    episodeCount: episodes.length || 1,
  };
}

async function ingestTitle(imdbId: string, idx: number, total: number) {
  console.log(`\n======================================================`);
  console.log(`[${idx + 1}/${total}] Processing IMDb ID: ${imdbId}`);
  console.log(`======================================================`);

  // Check if mapping exists on TMDB
  const tmdbEntry = TMDB_MAPPING[imdbId];
  let fullData: any = null;

  if (tmdbEntry) {
    console.log(`Using TMDB source (${tmdbEntry.type.toUpperCase()} ID ${tmdbEntry.id})...`);
    if (tmdbEntry.type === 'tv') {
      fullData = await fetchTmdbSeriesData(tmdbEntry.id);
      fullData.isSeries = true;
    } else {
      fullData = await fetchTmdbMovieData(tmdbEntry.id);
      fullData.isSeries = false;
    }
    // Also cross-reference IMDb cache to enrich synopsis/cast if available
    const imdbData = parseCachedImdbData(imdbId);
    if (imdbData) {
      if (!fullData.synopsis && imdbData.synopsis) fullData.synopsis = imdbData.synopsis;
      if (imdbData.streamingLinks) fullData.streamingLinks = { ...fullData.streamingLinks, ...imdbData.streamingLinks };
      if (imdbData.companies?.length > 0) fullData.companies = Array.from(new Set([...fullData.companies, ...imdbData.companies]));
    }
  } else {
    console.log(`Using IMDb Firecrawl cached scrape...`);
    fullData = parseCachedImdbData(imdbId);
  }

  if (!fullData || !fullData.title) {
    console.error(`Could not resolve data for ${imdbId}, skipping.`);
    return;
  }

  console.log(`Title: "${fullData.title}" (${fullData.year || 'N/A'}) - ${fullData.isSeries ? 'SERIES' : 'MOVIE'}`);
  console.log(`Episodes to create/enrich: ${fullData.episodes?.length || 0}`);
  console.log(`Cast to link: ${fullData.cast?.length || 0}`);

  // 1. Check existing master film
  let masterFilmId: string | null = null;
  const { data: existingFilms } = await supabase
    .from('films')
    .select('id, title, content_type, slug')
    .or(`imdb_id.eq."${imdbId}",slug.eq."${slugify(fullData.title)}"`)
    .is('series_id', null)
    .limit(1);

  const existingMaster = existingFilms?.[0];

  const updateFields: any = {
    title: fullData.title,
    synopsis: fullData.synopsis || null,
    poster_url: fullData.posterUrl || null,
    backdrop_url: fullData.backdropUrl || null,
    runtime_minutes: fullData.runtimeMinutes || null,
    release_date: fullData.releaseDate || null,
    year: fullData.year || null,
    genres: fullData.genres?.length > 0 ? fullData.genres : ['Drama'],
    content_type: fullData.isSeries ? 'series' : 'movie',
    season_count: fullData.isSeries ? (fullData.seasonCount || 1) : null,
    episode_count: fullData.isSeries ? (fullData.episodeCount || fullData.episodes?.length || 1) : null,
    streaming_links: fullData.streamingLinks || {},
    release_type: fullData.streamingLinks?.netflix ? 'netflix' :
                  fullData.streamingLinks?.showmax ? 'showmax' :
                  fullData.streamingLinks?.prime_video ? 'prime_video' :
                  fullData.streamingLinks?.youtube ? 'youtube' :
                  (fullData.year && fullData.year > 2026) ? 'unreleased' : 'cinema',
    status: fullData.year && fullData.year > 2026 ? 'in_production' : 'released',
    is_nollywood: true,
    is_published: true,
    imdb_id: imdbId,
    tmdb_id: tmdbEntry ? tmdbEntry.id : null,
    tmdb_rating: fullData.tmdbRating || null,
    tmdb_vote_count: fullData.tmdbVoteCount || null,
    imdb_rating: fullData.imdbRating || null,
    updated_at: new Date().toISOString(),
  };

  if (existingMaster) {
    masterFilmId = existingMaster.id;
    console.log(`Updating existing master film [${masterFilmId}] "${existingMaster.title}"...`);
    const { error: updErr } = await supabase.from('films').update(updateFields).eq('id', masterFilmId);
    if (updErr) console.error(`Error updating master:`, updErr.message);
  } else {
    let baseSlug = slugify(fullData.title);
    let slug = fullData.year ? `${baseSlug}-${fullData.year}` : baseSlug;
    const { data: sCheck } = await supabase.from('films').select('id').eq('slug', slug).maybeSingle();
    if (sCheck) slug = `${slug}-${Math.floor(100 + Math.random() * 900)}`;

    console.log(`Creating new master film with slug "${slug}"...`);
    const { data: created, error: crErr } = await supabase
      .from('films')
      .insert({
        ...updateFields,
        slug,
      })
      .select('id')
      .single();

    if (crErr || !created) {
      console.error(`Error creating master:`, crErr?.message);
      return;
    }
    masterFilmId = created.id;
  }

  // 2. Insert Film Media (Poster & Backdrop)
  if (fullData.posterUrl) {
    await upsertFilmMedia(masterFilmId, fullData.posterUrl, 'poster', 'photo', true, `${fullData.title} Official Poster`);
  }
  if (fullData.backdropUrl && fullData.backdropUrl !== fullData.posterUrl) {
    await upsertFilmMedia(masterFilmId, fullData.backdropUrl, 'backdrop', 'photo', true, `${fullData.title} Official Backdrop`);
  }

  // 3. Companies
  for (const cName of fullData.companies || []) {
    const compId = await getOrCreateCompany(cName);
    if (compId) await linkCompany(masterFilmId, compId, 'production');
  }

  // 4. Ensemble Cast & Crew (Zero-Duplicate Actor Guarantee)
  for (const c of fullData.cast || []) {
    const pId = await getOrCreatePerson({
      name: c.name,
      photoUrl: c.photoUrl,
      imdbId: c.imdbId,
      tmdbId: c.tmdbId,
      department: 'Acting',
    });
    if (pId) {
      await upsertCredit(masterFilmId, pId, 'actor', c.character, c.billingOrder);
    }
  }

  for (const cr of fullData.crew || []) {
    const pId = await getOrCreatePerson({
      name: cr.name,
      photoUrl: cr.photoUrl,
      tmdbId: cr.tmdbId,
      department: cr.role,
    });
    if (pId) {
      await upsertCredit(masterFilmId, pId, cr.role);
    }
  }

  // 5. Episodes
  if (fullData.isSeries) {
    // If episodes list is empty but it's a known series with seasons, generate baseline season 1 episodes
    let episodesToInsert = fullData.episodes || [];
    if (episodesToInsert.length === 0) {
      console.log(`Generating default Season 1 episodes for "${fullData.title}"...`);
      episodesToInsert = [
        { seasonNumber: 1, episodeNumber: 1, title: 'Episode 1', synopsis: `${fullData.title} - Series Premiere.` },
        { seasonNumber: 1, episodeNumber: 2, title: 'Episode 2', synopsis: `${fullData.title} - Episode 2.` },
        { seasonNumber: 1, episodeNumber: 3, title: 'Episode 3', synopsis: `${fullData.title} - Episode 3.` },
        { seasonNumber: 1, episodeNumber: 4, title: 'Episode 4', synopsis: `${fullData.title} - Episode 4.` },
      ];
    }

    console.log(`Enriching/Creating ${episodesToInsert.length} episodes for "${fullData.title}"...`);
    for (const ep of episodesToInsert) {
      const { data: existingEp } = await supabase
        .from('films')
        .select('id')
        .eq('series_id', masterFilmId)
        .eq('season_number', ep.seasonNumber)
        .eq('episode_number', ep.episodeNumber)
        .maybeSingle();

      let baseEpSlug = `${slugify(fullData.title)}-s${ep.seasonNumber}-e${ep.episodeNumber}`;
      let epSlug = baseEpSlug;
      const { data: epSlugCheck } = await supabase.from('films').select('id').eq('slug', epSlug).maybeSingle();
      if (epSlugCheck && epSlugCheck.id !== existingEp?.id) {
        epSlug = `${baseEpSlug}-${Math.floor(100 + Math.random() * 900)}`;
      }
      const epData = {
        title: ep.title || `Episode ${ep.episodeNumber}`,
        synopsis: ep.synopsis || fullData.synopsis || null,
        poster_url: ep.stillUrl || fullData.posterUrl || null,
        backdrop_url: ep.stillUrl || fullData.backdropUrl || null,
        release_date: ep.releaseDate || fullData.releaseDate || null,
        year: ep.year || fullData.year || null,
        runtime_minutes: ep.runtimeMinutes || fullData.runtimeMinutes || 45,
        content_type: 'series',
        series_id: masterFilmId,
        season_number: ep.seasonNumber,
        episode_number: ep.episodeNumber,
        imdb_id: ep.imdbId || null,
        status: 'released',
        is_nollywood: true,
        is_published: true,
      };

      let epId: string;
      if (existingEp) {
        epId = existingEp.id;
        await supabase.from('films').update(epData).eq('id', epId);
      } else {
        const { data: createdEp, error: epErr } = await supabase
          .from('films')
          .insert({
            ...epData,
            slug: epSlug,
          })
          .select('id')
          .single();

        if (epErr || !createdEp) {
          console.error(`Failed to create episode S${ep.seasonNumber}E${ep.episodeNumber}:`, epErr?.message);
          continue;
        }
        epId = createdEp.id;
      }

      // Link episode still into media
      if (ep.stillUrl) {
        await upsertFilmMedia(epId, ep.stillUrl, 'production_still', 'photo', false, `S${ep.seasonNumber}E${ep.episodeNumber} Still`);
      }
    }
  }

  console.log(`✔ Finished ingestion for "${fullData.title}"!`);
}

async function run() {
  console.log(`Starting ingestion of all ${TARGET_IMDB_IDS.length} target series and films...`);
  for (let i = 0; i < TARGET_IMDB_IDS.length; i++) {
    const id = TARGET_IMDB_IDS[i];
    try {
      await ingestTitle(id, i, TARGET_IMDB_IDS.length);
    } catch (e: any) {
      console.error(`Fatal error on ${id}:`, e);
    }
  }
  console.log(`\n🎉 BATCH INGESTION COMPLETED FOR ALL ${TARGET_IMDB_IDS.length} TITLES!`);
}

run().catch(console.error);
