/**
 * Master Filmography & Credit Ingestion Engine
 *
 * Combines:
 *  - TMDB API (Multi-identity alias resolution, whole ensemble cast, HD posters, backdrops, genres, synopsis)
 *  - IMDb Baseline (Exact IMDb IDs, high-res portraits, external cross-referencing)
 *  - Muvidb Zero-Duplicate Graph Reconciliation (in-place credit updating, ensemble backfill)
 *
 * Usage:
 *   npx tsx scripts/master_filmography_sync.ts --person "Debo Adedayo"
 *   npx tsx scripts/master_filmography_sync.ts --imdb nm12354481
 *   npx tsx scripts/master_filmography_sync.ts --tmdb 3618654
 *   npx tsx scripts/master_filmography_sync.ts --top 50
 *   npx tsx scripts/master_filmography_sync.ts --auto
 */

import { supabase } from './lib/db';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config();

const TMDB_API_KEY = process.env.VITE_TMDB_API_KEY || process.env.TMDB_API_KEY || '4edb739fa9f16d24f0aecf6a0dbcaab8';

// Known aliases mapping for actors with fragmented profiles
const KNOWN_ALIASES: Record<string, string[]> = {
  'debo adedayo': ['Debo Adedayo', 'Adebowale Adedayo', 'Adebowale Mr Macaroni Adedayo', 'Mr Macaroni'],
  'adebowale adedayo': ['Debo Adedayo', 'Adebowale Adedayo', 'Adebowale Mr Macaroni Adedayo', 'Mr Macaroni'],
  'richard mofe-damijo': ['Richard Mofe-Damijo', 'RMD', 'Richard Mofe Damijo'],
  'funke akindele': ['Funke Akindele', 'Funke Akindele-Bello', 'Jenifa'],
  'bimbo ademoye': ['Bimbo Ademoye', 'Abimbola Ademoye'],
  'sola sobowale': ['Sola Sobowale', 'Shaffy Sobowale'],
  'mercy johnson': ['Mercy Johnson', 'Mercy Johnson Okojie'],
  'odunlade adekola': ['Odunlade Adekola', 'Odun Adekola'],
  'femi adebayo': ['Femi Adebayo', 'Femi Adebayo Salami'],
  'lateef adedimeji': ['Lateef Adedimeji', 'Adedimeji Lateef'],
  'kunle afolayan': ['Kunle Afolayan'],
  'nkem owoh': ['Nkem Owoh', 'Osuofia'],
  'genevieve nnaji': ['Genevieve Nnaji'],
  'saga adeolu': ['Saga Adeolu', 'Saga Deolu', 'Adeolu Okusaga', 'Adeoluwa Okusaga', 'Okusaga Adeolu'],
  'adeoluwa okusaga': ['Saga Adeolu', 'Saga Deolu', 'Adeolu Okusaga', 'Adeoluwa Okusaga', 'Okusaga Adeolu'],
};

function getAllAliases(name: string): string[] {
  const norm = cleanTitle(name).toLowerCase();
  const set = new Set<string>([cleanTitle(name)]);
  for (const [key, list] of Object.entries(KNOWN_ALIASES)) {
    const listNorm = list.map(a => a.toLowerCase().trim());
    if (key === norm || listNorm.includes(norm)) {
      list.forEach(a => set.add(a));
      set.add(key);
    }
  }
  return Array.from(set);
}

// Strict African country codes to prevent Hollywood/European contamination
const AFRICAN_ISO_CODES = new Set([
  'NG', 'GH', 'ZA', 'KE', 'UG', 'TZ', 'CM', 'RW', 'ZW', 'SN',
  'EG', 'MA', 'ET', 'CI', 'ZM', 'MW', 'MZ', 'AO', 'CD', 'CG',
  'SL', 'LR', 'GM', 'BF', 'NE', 'ML', 'BJ', 'TG', 'GA', 'BW',
  'NA', 'SZ', 'LS', 'MU', 'SC', 'TN', 'DZ', 'LY', 'SD', 'SS'
]);

const AFRICAN_LANGUAGES = new Set([
  'yo', 'ig', 'ha', 'sw', 'zu', 'xh', 'tw', 'ak', 'sn', 'st', 'am', 'so', 'rw', 'ny'
]);

const AFRICAN_KEYWORDS = [
  'nigeria', 'ghana', 'south africa', 'kenya', 'uganda', 'tanzania', 'cameroon',
  'rwanda', 'zimbabwe', 'senegal', 'zambia', 'egypt', 'morocco', 'ethiopia',
  'liberia', 'sierra leone', 'nollywood', 'yoruba', 'igbo', 'hausa', 'kannywood',
  'ghallywood', 'lagos', 'accra', 'ibadan', 'enugu', 'benin city', 'abuja', 'jos'
];

// Names and tokens distinctive to African / Nollywood talents
const AFRICAN_TALENT_TOKENS = new Set([
  'uche', 'nancy', 'kadiri', 'okereke', 'kosoko', 'edochie', 'agu', 'erics', 'akindele',
  'chinedu', 'emeka', 'chidi', 'kanayo', 'osita', 'ebere', 'chiwetalu', 'lancelot', 'tchidi',
  'chatta', 'afolayan', 'ogunde', 'salami', 'quadri', 'balogun', 'lawal', 'adekola', 'adebayo',
  'aigbe', 'remi', 'ademoye', 'sobowale', 'hassan', 'bakre', 'falz', 'falana', 'macaroni',
  'adedayo', 'njubigbo', 'odoputa', 'imasuen', 'babalola', 'irele', 'ajayi', 'okanlawon',
  'okpocha', 'achufusi', 'awolowo', 'bachor', 'akpore', 'russet', 'nnaji', 'buari', 'ezuruonye',
  'nnebe', 'genevieve', 'omotola', 'iniedo', 'esien', 'esin', 'lazarus', 'isokpan', 'adunni',
  'ade', 'mba', 'ojo', 'dike', 'alabi', 'animashaun', 'badmus', 'belo', 'bello', 'chima',
  'chigozie', 'chukwu', 'eze', 'ibrahim', 'idris', 'iyabo', 'kalu', 'muhammad', 'nwosu',
  'obinna', 'odi', 'odunlade', 'ogbonna', 'ogungbe', 'olamide', 'olowo', 'omoni', 'onwuka',
  'osahon', 'oyeleke', 'somkele', 'taiwo', 'tolu', 'tope', 'yakubu', 'yekini', 'yomi',
  'zack', 'zubby', 'destiny', 'etiko', 'pete', 'kelechi', 'ike', 'somadina', 'regina',
  'daniels', 'mercy', 'johnson', 'infinix', 'nollywood', 'yoruba', 'igbo', 'hausa',
  'iyk', 'iyke', 'fredrick', 'leonard', 'ken', 'muna', 'obio', 'oluebube',
  'sonia', 'chinenye', 'uchegbu', 'onyeabor', 'anodebe', 'ani', 'uchenna', 'chinwe',
  'ngozi', 'patience', 'ozokwor', 'nkem', 'owoh', 'sam', 'loco', 'efe', 'bimbo',
  'ronke', 'fathia', 'williams', 'iheme', 'aki', 'pawpaw', 'okolie', 'ebuka',
  'stanley', 'odeh', 'etuk', 'eneaji', 'eneng', 'uzoeshi', 'ejike', 'ibedilo',
  'osifo', 'uka', 'ujams', 'ihebie', 'reginald', 'chisom', 'nnaebue', 'nnanna',
  'maduka', 'billion', 'nnadi', 'nkechinyere', 'jombo', 'ifeanyi', 'edward',
  'cbriel', 'blessed', 'okey', 'rita', 'charles', 'omoni', 'oboli', 'kemi',
  'adetiba', 'jade', 'osiberu', 'chikere', 'biodun', 'stephen', 'mo', 'abudu'
]);

// Genre name to ID cache
let genreCache: Map<string, string> | null = null;

async function getGenreCache(): Promise<Map<string, string>> {
  if (genreCache) return genreCache;
  const { data } = await supabase.from('genres').select('id, name');
  genreCache = new Map();
  for (const g of data || []) {
    genreCache.set(g.name.toLowerCase().trim(), g.id);
  }
  return genreCache;
}

function slugify(text: string): string {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function cleanTitle(t: string): string {
  return t ? t.trim().replace(/\s+/g, ' ') : '';
}

/** Fetch with retry & exponential backoff */
async function fetchJsonWithRetry(url: string, retries = 3): Promise<any> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) MuviDB-Sync/1.0' }
      });
      if (!res.ok) {
        if (res.status === 404) return null;
        throw new Error(`HTTP ${res.status}`);
      }
      return await res.json();
    } catch (err: any) {
      if (attempt === retries) throw err;
      await new Promise(r => setTimeout(r, attempt * 1200));
    }
  }
  return null;
}

/** Look up person on IMDb suggest endpoint for verified nm... ID and portrait */
async function lookupImdbSuggest(name: string, knownImdbId?: string): Promise<{ imdbId: string | null; photoUrl: string | null }> {
  try {
    const q = knownImdbId || name;
    const path = knownImdbId ? `names/n/${q}.json` : `names/a/${encodeURIComponent(name)}.json`;
    const data = await fetchJsonWithRetry(`https://v3.sg.media-imdb.com/suggestion/${path}`);
    const results = data?.d || [];
    
    let match = knownImdbId ? results.find((r: any) => r.id === knownImdbId) : null;
    if (!match && results.length > 0) {
      match = results.find((r: any) => r.l?.toLowerCase() === name.toLowerCase()) || results[0];
    }

    if (match) {
      return {
        imdbId: match.id || null,
        photoUrl: match.i?.imageUrl || null,
      };
    }
  } catch (err: any) {
    // Non-fatal fallback
  }
  return { imdbId: null, photoUrl: null };
}

/** Search TMDB for a person name and return all matching candidate person IDs */
async function searchTmdbPersonIds(name: string): Promise<number[]> {
  try {
    const data = await fetchJsonWithRetry(
      `https://api.themoviedb.org/3/search/person?query=${encodeURIComponent(name)}&api_key=${TMDB_API_KEY}`
    );
    if (!data?.results) return [];
    
    // Return IDs that match closely
    const nameLower = name.toLowerCase();
    const ids: number[] = [];
    for (const r of data.results) {
      const rLower = r.name?.toLowerCase() || '';
      if (rLower === nameLower || rLower.includes(nameLower) || nameLower.includes(rLower)) {
        ids.push(r.id);
      }
    }
    return ids;
  } catch {
    return [];
  }
}

/** Fetch person details + combined credits from TMDB */
async function fetchTmdbPersonData(tmdbPersonId: number) {
  const [details, credits, ext] = await Promise.all([
    fetchJsonWithRetry(`https://api.themoviedb.org/3/person/${tmdbPersonId}?api_key=${TMDB_API_KEY}`),
    fetchJsonWithRetry(`https://api.themoviedb.org/3/person/${tmdbPersonId}/combined_credits?api_key=${TMDB_API_KEY}`),
    fetchJsonWithRetry(`https://api.themoviedb.org/3/person/${tmdbPersonId}/external_ids?api_key=${TMDB_API_KEY}`)
  ]);

  return { details, credits, externalIds: ext };
}

/** Fetch full movie details including full ensemble cast from TMDB */
async function fetchTmdbMediaEnsemble(tmdbId: number, mediaType: 'movie' | 'tv') {
  const endpoint = mediaType === 'tv' ? 'tv' : 'movie';
  const url = `https://api.themoviedb.org/3/${endpoint}/${tmdbId}?append_to_response=credits,external_ids&api_key=${TMDB_API_KEY}`;
  return await fetchJsonWithRetry(url);
}

/**
 * Sync or create a Person in Muvidb
 */
async function getOrCreatePerson(
  name: string,
  extra: { tmdbId?: number | null; imdbId?: string | null; photoUrl?: string | null; bio?: string | null } = {}
): Promise<string | null> {
  const normName = cleanTitle(name);
  if (!normName) return null;

  // 1. Match by tmdb_id if present
  if (extra.tmdbId) {
    const { data: byTmdb } = await supabase.from('people').select('id, name, imdb_id, photo_url').eq('tmdb_id', extra.tmdbId).maybeSingle();
    if (byTmdb) {
      // Update missing fields
      const updates: any = {};
      if (extra.imdbId && !byTmdb.imdb_id) updates.imdb_id = extra.imdbId;
      if (extra.photoUrl && !byTmdb.photo_url) updates.photo_url = extra.photoUrl;
      if (Object.keys(updates).length > 0) {
        await supabase.from('people').update(updates).eq('id', byTmdb.id);
      }
      return byTmdb.id;
    }
  }

  // 2. Match by imdb_id if present
  if (extra.imdbId) {
    const { data: byImdb } = await supabase.from('people').select('id, name, tmdb_id, photo_url').eq('imdb_id', extra.imdbId).maybeSingle();
    if (byImdb) {
      const updates: any = {};
      if (extra.tmdbId && !byImdb.tmdb_id) updates.tmdb_id = extra.tmdbId;
      if (extra.photoUrl && !byImdb.photo_url) updates.photo_url = extra.photoUrl;
      if (Object.keys(updates).length > 0) {
        await supabase.from('people').update(updates).eq('id', byImdb.id);
      }
      return byImdb.id;
    }
  }

  // 3. Match by name and all known aliases
  const aliasList = getAllAliases(normName);
  let matchedPerson: any = null;
  for (const alias of aliasList) {
    const { data: byName } = await supabase.from('people').select('id, name, tmdb_id, imdb_id, photo_url').ilike('name', alias).maybeSingle();
    if (byName) {
      matchedPerson = byName;
      break;
    }
  }

  if (matchedPerson) {
    const updates: any = {};
    if (extra.tmdbId && !matchedPerson.tmdb_id) updates.tmdb_id = extra.tmdbId;
    if (extra.imdbId && !matchedPerson.imdb_id) updates.imdb_id = extra.imdbId;
    if (extra.photoUrl && !matchedPerson.photo_url) updates.photo_url = extra.photoUrl;
    if (Object.keys(updates).length > 0) {
      await supabase.from('people').update(updates).eq('id', matchedPerson.id);
    }
    return matchedPerson.id;
  }

  // 4. Insert new person
  const baseSlug = slugify(normName);
  const uniqueSlug = `${baseSlug}-${Math.floor(1000 + Math.random() * 9000)}`;

  const { data: newPerson, error } = await supabase
    .from('people')
    .insert({
      name: normName,
      slug: uniqueSlug,
      tmdb_id: extra.tmdbId || null,
      imdb_id: extra.imdbId || null,
      photo_url: extra.photoUrl || null,
      bio: extra.bio || null,
      nationality: 'Nigerian',
      is_verified: false,
    })
    .select('id')
    .single();

  if (error) {
    // If slug collision, retry with timestamp slug
    if (error.code === '23505') {
      const { data: retryPerson } = await supabase
        .from('people')
        .insert({
          name: normName,
          slug: `${baseSlug}-${Date.now().toString().slice(-6)}`,
          tmdb_id: extra.tmdbId || null,
          imdb_id: extra.imdbId || null,
          photo_url: extra.photoUrl || null,
          bio: extra.bio || null,
          nationality: 'Nigerian',
        })
        .select('id')
        .single();
      return retryPerson?.id || null;
    }
    console.error(`  ⚠️ Error inserting person "${normName}":`, error.message);
    return null;
  }

  return newPerson.id;
}

/**
 * Ingest or Match Film with full metadata, poster, genres, and ensemble
 */
async function syncFilmAndEnsemble(
  tmdbCredit: any,
  genresMap: Map<string, string>
): Promise<{ filmId: string; wasCreated: boolean; ensembleAdded: number }> {
  const tmdbId = tmdbCredit.id;
  const mediaType: 'movie' | 'tv' = tmdbCredit.media_type === 'tv' ? 'tv' : 'movie';
  const title = cleanTitle(tmdbCredit.title || tmdbCredit.name || tmdbCredit.original_title);
  const releaseDate = tmdbCredit.release_date || tmdbCredit.first_air_date || '';
  const year = releaseDate ? parseInt(releaseDate.substring(0, 4), 10) : null;

  if (!title) return { filmId: '', wasCreated: false, ensembleAdded: 0 };

  // 1. Fetch deep media details including ensemble cast
  const mediaDetails = await fetchTmdbMediaEnsemble(tmdbId, mediaType);
  if (!mediaDetails) return { filmId: '', wasCreated: false, ensembleAdded: 0 };

  const originCountries: string[] = (mediaDetails.origin_country || []).map((c: string) => c.toUpperCase());
  const prodCountries: string[] = (mediaDetails.production_countries || []).map((c: any) => (c.iso_3166_1 || '').toUpperCase());
  const allCountries = [...originCountries, ...prodCountries];
  const isAfricanCountry = allCountries.some(c => AFRICAN_ISO_CODES.has(c));
  const isAfricanLang = AFRICAN_LANGUAGES.has((mediaDetails.original_language || '').toLowerCase());
  const text = `${title} ${mediaDetails.overview || tmdbCredit.overview || ''}`.toLowerCase();
  const hasAfricanKeyword = AFRICAN_KEYWORDS.some(k => text.includes(k));

  // Check if cast/crew indicates African / Nollywood production (overcoming TMDB "US" mislabeling)
  const rawCast = mediaDetails.credits?.cast || [];
  const rawCrew = mediaDetails.credits?.crew || [];
  const samplePeople = [...rawCast.slice(0, 15), ...rawCrew.slice(0, 10)];
  let africanTalentCount = 0;
  for (const person of samplePeople) {
    const pName = (person.name || '').toLowerCase();
    const parts = pName.split(/\s+/);
    if (parts.some((part: string) => AFRICAN_TALENT_TOKENS.has(part))) {
      africanTalentCount++;
    }
  }
  const hasAfricanCastOrCrew =
    africanTalentCount >= 2 ||
    (samplePeople.length > 0 && africanTalentCount >= 1 && (samplePeople.length <= 15 || africanTalentCount / samplePeople.length >= 0.1));

  const isAfricanOrigin = isAfricanCountry || isAfricanLang || hasAfricanKeyword || hasAfricanCastOrCrew;

  const imdbId = mediaDetails.external_ids?.imdb_id || mediaDetails.imdb_id || null;
  const synopsis = mediaDetails.overview || tmdbCredit.overview || null;
  const posterPath = mediaDetails.poster_path || tmdbCredit.poster_path;
  const posterUrl = posterPath ? `https://image.tmdb.org/t/p/w500${posterPath}` : null;
  const backdropPath = mediaDetails.backdrop_path || tmdbCredit.backdrop_path;
  const backdropUrl = backdropPath ? `https://image.tmdb.org/t/p/original${backdropPath}` : null;
  const runtime = mediaDetails.runtime || (Array.isArray(mediaDetails.episode_run_time) ? mediaDetails.episode_run_time[0] : null) || null;
  const genresList: string[] = (mediaDetails.genres || []).map((g: any) => g.name).filter(Boolean);
  const voteAverage = mediaDetails.vote_average || tmdbCredit.vote_average || null;
  const voteCount = mediaDetails.vote_count || tmdbCredit.vote_count || null;
  const contentType = mediaType === 'tv' ? 'series' : 'movie';

  // 2. Check if film exists
  let filmId: string | null = null;
  let wasCreated = false;

  // A. Check by tmdb_id
  const { data: byTmdb } = await supabase.from('films').select('id, poster_url, synopsis, genres, imdb_id').eq('tmdb_id', tmdbId).maybeSingle();
  if (byTmdb) filmId = byTmdb.id;

  // B. Check by imdb_id
  if (!filmId && imdbId) {
    const { data: byImdb } = await supabase.from('films').select('id, poster_url, synopsis, genres, tmdb_id').eq('imdb_id', imdbId).maybeSingle();
    if (byImdb) filmId = byImdb.id;
  }

  // C. Check by title and year
  if (!filmId && year) {
    const { data: byTitleYear } = await supabase
      .from('films')
      .select('id, poster_url, synopsis, genres')
      .ilike('title', title)
      .gte('year', year - 1)
      .lte('year', year + 1)
      .maybeSingle();
    if (byTitleYear) filmId = byTitleYear.id;
  }

  // Guard: If film does not already exist in Muvidb, NEVER create it unless it is genuine African!
  if (!filmId && !isAfricanOrigin) {
    console.log(`   ⏭️ Skipping foreign non-African title: "${title}" (${allCountries.join(', ') || 'foreign'})`);
    return { filmId: '', wasCreated: false, ensembleAdded: 0 };
  }

  if (filmId) {
    // Backfill any missing fields on existing film
    const updates: any = {};
    if (imdbId && !byTmdb?.imdb_id) updates.imdb_id = imdbId;
    if (tmdbId && !byTmdb) updates.tmdb_id = tmdbId;
    if (posterUrl && !byTmdb?.poster_url) updates.poster_url = posterUrl;
    if (backdropUrl) updates.backdrop_url = backdropUrl;
    if (synopsis && !byTmdb?.synopsis) updates.synopsis = synopsis;
    if (runtime) updates.runtime_minutes = runtime;
    if (genresList.length > 0 && (!byTmdb?.genres || byTmdb.genres.length === 0)) updates.genres = genresList;
    if (voteAverage) updates.tmdb_rating = voteAverage;
    if (voteCount) updates.tmdb_vote_count = voteCount;

    if (Object.keys(updates).length > 0) {
      await supabase.from('films').update(updates).eq('id', filmId);
    }
  } else {
    // Insert new film
    const baseSlug = slugify(`${title}-${year || 2024}`);
    const uniqueSlug = `${baseSlug}-${Math.floor(100 + Math.random() * 900)}`;

    const { data: newFilm, error } = await supabase
      .from('films')
      .insert({
        title,
        slug: uniqueSlug,
        year,
        release_date: releaseDate || null,
        synopsis,
        poster_url: posterUrl,
        backdrop_url: backdropUrl,
        runtime_minutes: runtime,
        genres: genresList,
        content_type: contentType,
        imdb_id: imdbId,
        tmdb_id: tmdbId,
        tmdb_rating: voteAverage,
        tmdb_vote_count: voteCount,
        is_nollywood: true,
        is_published: true,
      })
      .select('id')
      .single();

    if (error) {
      if (error.code === '23505') {
        const { data: retryFilm } = await supabase
          .from('films')
          .insert({
            title,
            slug: `${baseSlug}-${Date.now().toString().slice(-6)}`,
            year,
            release_date: releaseDate || null,
            synopsis,
            poster_url: posterUrl,
            backdrop_url: backdropUrl,
            runtime_minutes: runtime,
            genres: genresList,
            content_type: contentType,
            imdb_id: imdbId,
            tmdb_id: tmdbId,
            is_nollywood: true,
            is_published: true,
          })
          .select('id')
          .single();
        filmId = retryFilm?.id || null;
      } else {
        console.error(`  ⚠️ Error creating film "${title}":`, error.message);
      }
    } else {
      filmId = newFilm.id;
      wasCreated = true;
    }
  }

  if (!filmId) return { filmId: '', wasCreated: false, ensembleAdded: 0 };

  // 3. Associate genres into film_genres table
  if (genresList.length > 0) {
    for (const gName of genresList) {
      const gid = genresMap.get(gName.toLowerCase().trim());
      if (gid) {
        await supabase
          .from('film_genres')
          .upsert({ film_id: filmId, genre_id: gid }, { onConflict: 'film_id,genre_id', ignoreDuplicates: true });
      }
    }
  }

  // 4. Ingest Whole Ensemble Cast (top 25) - ONLY for genuine African titles
  let ensembleAdded = 0;
  if (isAfricanOrigin) {
    const rawCast = mediaDetails.credits?.cast || [];
    const topCast = rawCast.slice(0, 25);

    for (const c of topCast) {
      if (!c.name) continue;
      const actorPhoto = c.profile_path ? `https://image.tmdb.org/t/p/w500${c.profile_path}` : null;
      const personId = await getOrCreatePerson(c.name, {
        tmdbId: c.id,
        photoUrl: actorPhoto,
      });

      if (personId) {
        const characterName = c.character ? c.character.trim() : null;
        const billingOrder = typeof c.order === 'number' ? c.order : 99;

        // Check existing credit to ensure Zero-Duplicate Actor Guarantee
        const { data: existingCredit } = await supabase
          .from('credits')
          .select('id, character_name, billing_order')
          .eq('film_id', filmId)
          .eq('person_id', personId)
          .maybeSingle();

        if (existingCredit) {
          // Update in-place if character name was missing or more specific
          if (!existingCredit.character_name && characterName) {
            await supabase
              .from('credits')
              .update({ character_name: characterName, billing_order: billingOrder })
              .eq('id', existingCredit.id);
          }
        } else {
          // Insert credit
          const { error: credErr } = await supabase.from('credits').insert({
            film_id: filmId,
            person_id: personId,
            role: 'Actor',
            character_name: characterName,
            billing_order: billingOrder,
            source: 'tmdb',
          });
          if (!credErr) ensembleAdded++;
        }
      }
    }

    // Also ingest key Crew (Director, Producer, Writer, Costume Designer)
    const keyCrewJobs = new Set([
      'Director', 'Producer', 'Executive Producer', 'Writer', 'Screenplay',
      'Costume Design', 'Costumer', 'Production Manager'
    ]);
    const keyCrew = (mediaDetails.credits?.crew || []).filter((c: any) => keyCrewJobs.has(c.job));
    for (const crewMember of keyCrew) {
      if (!crewMember.name) continue;
      const roleName = crewMember.job === 'Costumer' ? 'Costume Design' : crewMember.job;
      const crewPersonId = await getOrCreatePerson(crewMember.name, {
        tmdbId: crewMember.id,
        photoUrl: crewMember.profile_path ? `https://image.tmdb.org/t/p/w500${crewMember.profile_path}` : null,
      });
      if (crewPersonId) {
        const { data: existingCrew } = await supabase
          .from('credits')
          .select('id')
          .eq('film_id', filmId)
          .eq('person_id', crewPersonId)
          .ilike('role', roleName)
          .maybeSingle();

        if (!existingCrew) {
          const { error: crewErr } = await supabase.from('credits').insert({
            film_id: filmId,
            person_id: crewPersonId,
            role: roleName,
            source: 'tmdb',
          });
          if (!crewErr) ensembleAdded++;
        }
      }
    }
  }

  return { filmId, wasCreated, ensembleAdded };
}

/**
 * Perform Master Filmography Sync for a single person
 */
export async function syncPersonMaster(
  personQuery: { id?: string; name: string; imdbId?: string | null; tmdbId?: number | null }
) {
  console.log(`\n════════════════════════════════════════════════════════════════════`);
  console.log(`🌟 MASTER SYNC: "${personQuery.name}" (IMDb: ${personQuery.imdbId || 'N/A'}, TMDB: ${personQuery.tmdbId || 'N/A'})`);

  const genresMap = await getGenreCache();

  // 1. Resolve canonical Person in Muvidb
  let personRow: any = null;
  if (personQuery.id) {
    const { data } = await supabase.from('people').select('*').eq('id', personQuery.id).single();
    personRow = data;
  } else if (personQuery.imdbId) {
    const { data } = await supabase.from('people').select('*').eq('imdb_id', personQuery.imdbId).maybeSingle();
    personRow = data;
  } else {
    const searchAliases = getAllAliases(personQuery.name);
    for (const alias of searchAliases) {
      const { data } = await supabase.from('people').select('*').ilike('name', alias).maybeSingle();
      if (data) {
        personRow = data;
        break;
      }
    }
  }

  // If still not in DB, create person
  if (!personRow) {
    const newId = await getOrCreatePerson(personQuery.name, {
      imdbId: personQuery.imdbId,
      tmdbId: personQuery.tmdbId,
    });
    if (!newId) {
      console.error(`❌ Could not find or create person "${personQuery.name}".`);
      return;
    }
    const { data } = await supabase.from('people').select('*').eq('id', newId).single();
    personRow = data;
  }

  const personId = personRow.id;
  const canonicalName = personRow.name;
  console.log(`👤 Target Muvidb Person: "${canonicalName}" [${personId}]`);

  // 2. Discover all aliases & TMDB Person IDs
  const aliases = new Set<string>();
  aliases.add(canonicalName);
  aliases.add(personQuery.name);
  const lowerName = canonicalName.toLowerCase();
  for (const [key, aliasList] of Object.entries(KNOWN_ALIASES)) {
    if (lowerName.includes(key) || key.includes(lowerName)) {
      for (const a of aliasList) aliases.add(a);
    }
  }

  console.log(`🔍 Checking aliases: ${Array.from(aliases).join(' | ')}`);

  const tmdbPersonIds = new Set<number>();
  if (personRow.tmdb_id) tmdbPersonIds.add(personRow.tmdb_id);
  if (personQuery.tmdbId) tmdbPersonIds.add(personQuery.tmdbId);

  for (const alias of aliases) {
    const foundIds = await searchTmdbPersonIds(alias);
    for (const id of foundIds) tmdbPersonIds.add(id);
  }

  console.log(`🎬 Found ${tmdbPersonIds.size} TMDB profile(s): [${Array.from(tmdbPersonIds).join(', ')}]`);

  // 3. Query IMDb suggest for verified photo & IMDb ID
  let masterImdbId = personRow.imdb_id || personQuery.imdbId || null;
  const imdbSuggest = await lookupImdbSuggest(canonicalName, masterImdbId || undefined);
  if (imdbSuggest.imdbId && !masterImdbId) masterImdbId = imdbSuggest.imdbId;

  // Update master profile with high-res portrait, bio, and IDs if available
  const personUpdates: any = {};
  if (masterImdbId && masterImdbId !== personRow.imdb_id) personUpdates.imdb_id = masterImdbId;
  if (imdbSuggest.photoUrl && !personRow.photo_url) personUpdates.photo_url = imdbSuggest.photoUrl;

  // 4. Collect combined credits across all TMDB profiles (Cast and Crew)
  interface CombinedCreditItem {
    credit: any;
    role: string;
    characterName: string | null;
    billingOrder: number;
  }
  const allCreditsToIngest: CombinedCreditItem[] = [];
  const seenCreditMedia = new Set<string>();

  for (const tId of tmdbPersonIds) {
    try {
      const data = await fetchTmdbPersonData(tId);
      if (data.details) {
        if (!personRow.bio && data.details.biography) personUpdates.bio = data.details.biography;
        if (!personRow.date_of_birth && data.details.birthday) personUpdates.date_of_birth = data.details.birthday;
        if (!personRow.birthplace && data.details.place_of_birth) personUpdates.birthplace = data.details.place_of_birth;
        if (data.details.profile_path && !personRow.photo_url && !personUpdates.photo_url) {
          personUpdates.photo_url = `https://image.tmdb.org/t/p/h632${data.details.profile_path}`;
        }
      }

      if (data.externalIds?.imdb_id && !masterImdbId) {
        masterImdbId = data.externalIds.imdb_id;
        personUpdates.imdb_id = masterImdbId;
      }

      // Collect Cast credits
      for (const c of data.credits?.cast || []) {
        const key = `${c.media_type || 'movie'}_${c.id}_Actor`;
        if (!seenCreditMedia.has(key)) {
          seenCreditMedia.add(key);
          allCreditsToIngest.push({
            credit: c,
            role: 'Actor',
            characterName: c.character ? c.character.trim() : null,
            billingOrder: typeof c.order === 'number' ? c.order : 50,
          });
        }
      }

      // Collect Crew credits (Producer, Director, Writer, Costume Design, etc.)
      for (const c of data.credits?.crew || []) {
        const rawJob = c.job || c.department || 'Crew';
        const role = rawJob === 'Costumer' ? 'Costume Design' : rawJob;
        const key = `${c.media_type || 'movie'}_${c.id}_${role}`;
        if (!seenCreditMedia.has(key)) {
          seenCreditMedia.add(key);
          allCreditsToIngest.push({
            credit: c,
            role,
            characterName: null,
            billingOrder: 99,
          });
        }
      }
    } catch (err: any) {
      console.warn(`  ⚠️ Could not fetch TMDB ${tId}:`, err.message);
    }
  }

  if (Object.keys(personUpdates).length > 0) {
    await supabase.from('people').update(personUpdates).eq('id', personId);
    console.log(`  ✓ Updated person metadata (IMDb: ${masterImdbId || 'N/A'}, Photo: ${!!personUpdates.photo_url})`);
  }

  console.log(`🎞️ Total combined unique TMDB credits to ingest: ${allCreditsToIngest.length}`);

  let createdFilmsCount = 0;
  let totalEnsembleAdded = 0;
  let personalCreditsLinked = 0;

  // 5. Ingest each film, ensemble, and person's credit
  for (let i = 0; i < allCreditsToIngest.length; i++) {
    const item = allCreditsToIngest[i];
    const c = item.credit;
    const title = c.title || c.name || 'Untitled';
    const year = (c.release_date || c.first_air_date || '').substring(0, 4);

    process.stdout.write(`  [${i + 1}/${allCreditsToIngest.length}] "${title}" (${year || 'N/A'}) [${item.role}]... `);

    try {
      const { filmId, wasCreated, ensembleAdded } = await syncFilmAndEnsemble(c, genresMap);
      if (wasCreated) createdFilmsCount++;
      totalEnsembleAdded += ensembleAdded;

      if (filmId) {
        // Link target person's credit with their designated role
        const { data: existingCredit } = await supabase
          .from('credits')
          .select('id, character_name, role')
          .eq('film_id', filmId)
          .eq('person_id', personId)
          .ilike('role', item.role)
          .maybeSingle();

        if (existingCredit) {
          if (!existingCredit.character_name && item.characterName) {
            await supabase.from('credits').update({ character_name: item.characterName }).eq('id', existingCredit.id);
          }
        } else {
          await supabase.from('credits').insert({
            film_id: filmId,
            person_id: personId,
            role: item.role,
            character_name: item.characterName,
            billing_order: item.billingOrder,
            source: 'tmdb',
          });
          personalCreditsLinked++;
        }
        console.log(`Done (${wasCreated ? 'NEW FILM' : 'matched'}, ensemble: +${ensembleAdded})`);
      } else {
        console.log(`Skipped`);
      }
    } catch (err: any) {
      console.log(`Failed: ${err.message}`);
    }

    // Gentle pacing
    await new Promise(r => setTimeout(r, 250));
  }

  // 6. Recalculate accurate film_count for the person
  const { count: finalCreditsCount } = await supabase
    .from('credits')
    .select('*', { count: 'exact', head: true })
    .eq('person_id', personId);

  await supabase
    .from('people')
    .update({
      film_count: finalCreditsCount || 0,
      is_verified: true,
      updated_at: new Date().toISOString(),
    })
    .eq('id', personId);

  console.log(`\n🎉 SUMMARY FOR "${canonicalName}":`);
  console.log(`   • Total Verified Credits in Muvidb: ${finalCreditsCount}`);
  console.log(`   • Newly Created Films: ${createdFilmsCount}`);
  console.log(`   • Personal Credits Linked: ${personalCreditsLinked}`);
  console.log(`   • Ensemble Cast Credits Enriched: ${totalEnsembleAdded}`);
  console.log(`════════════════════════════════════════════════════════════════════\n`);
}

/** CLI Entrypoint */
async function main() {
  const args = process.argv.slice(2);

  const personArgIdx = args.indexOf('--person') !== -1 ? args.indexOf('--person') : args.indexOf('--name');
  const imdbArgIdx = args.indexOf('--imdb');
  const tmdbArgIdx = args.indexOf('--tmdb');
  const topArgIdx = args.indexOf('--top');
  const isAuto = args.includes('--auto') || args.includes('--all');

  if (personArgIdx !== -1 && args[personArgIdx + 1]) {
    const name = args[personArgIdx + 1].trim();
    await syncPersonMaster({ name });
    process.exit(0);
  }

  if (imdbArgIdx !== -1 && args[imdbArgIdx + 1]) {
    const imdbId = args[imdbArgIdx + 1].trim();
    const { data: p } = await supabase.from('people').select('id, name, imdb_id, tmdb_id').eq('imdb_id', imdbId).maybeSingle();
    await syncPersonMaster({
      id: p?.id,
      name: p?.name || imdbId,
      imdbId,
      tmdbId: p?.tmdb_id,
    });
    process.exit(0);
  }

  if (tmdbArgIdx !== -1 && args[tmdbArgIdx + 1]) {
    const tmdbId = parseInt(args[tmdbArgIdx + 1].trim(), 10);
    const { data: p } = await supabase.from('people').select('id, name, imdb_id, tmdb_id').eq('tmdb_id', tmdbId).maybeSingle();
    await syncPersonMaster({
      id: p?.id,
      name: p?.name || `TMDB ${tmdbId}`,
      tmdbId,
      imdbId: p?.imdb_id,
    });
    process.exit(0);
  }

  if (topArgIdx !== -1 || isAuto) {
    const limit = topArgIdx !== -1 ? parseInt(args[topArgIdx + 1], 10) || 50 : 200;
    const offsetArgIdx = args.indexOf('--offset');
    const offset = offsetArgIdx !== -1 ? parseInt(args[offsetArgIdx + 1], 10) || 0 : 0;
    const isAsc = args.includes('--asc');
    const verifiedOnly = args.includes('--verified');
    console.log(`🚀 Starting Master Filmography Enrichment Pipeline (Queue: ${limit} talents, offset: ${offset}, order: ${isAsc ? 'ASC' : 'DESC (popular first)'}, verifiedOnly: ${verifiedOnly})...`);

    // Fetch talents, prioritizing verified or spotlight ones with existing African credits
    let peopleQuery = supabase
      .from('people')
      .select('id, name, imdb_id, tmdb_id, film_count, is_verified')
      .not('name', 'is', null)
      .order('film_count', { ascending: isAsc });

    if (verifiedOnly) {
      peopleQuery = peopleQuery.eq('is_verified', true);
    }

    const { data: people } = await peopleQuery.range(offset, offset + limit - 1);

    if (!people || people.length === 0) {
      console.log('No people found to enrich.');
      process.exit(0);
    }

    console.log(`Found ${people.length} actors/filmmakers in queue.`);

    for (let i = 0; i < people.length; i++) {
      const p = people[i];
      console.log(`\n[${i + 1}/${people.length}] Processing queue item: "${p.name}" (Current credits: ${p.film_count || 0})`);
      try {
        await syncPersonMaster({
          id: p.id,
          name: p.name,
          imdbId: p.imdb_id,
          tmdbId: p.tmdb_id,
        });
      } catch (err: any) {
        console.error(`❌ Error syncing ${p.name}:`, err.message);
      }
      // Rest 1.5s between actors
      await new Promise(r => setTimeout(r, 1500));
    }

    console.log('🏁 Batch filmography enrichment complete!');
    process.exit(0);
  }

  // Default: run on Debo Adedayo as the gold standard test
  console.log('No specific arguments provided. Defaulting to Debo Adedayo test run...');
  await syncPersonMaster({ name: 'Debo Adedayo', imdbId: 'nm12354481' });
  process.exit(0);
}

main().catch(err => {
  console.error('Fatal engine error:', err);
  process.exit(1);
});
