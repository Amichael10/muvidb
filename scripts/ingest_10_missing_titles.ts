import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { setGlobalDispatcher, Agent } from 'undici';

setGlobalDispatcher(new Agent({
  connect: { timeout: 60000 },
  headersTimeout: 60000,
  bodyTimeout: 60000
}));

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const TMDB_API_KEY = process.env.TMDB_API_KEY || process.env.VITE_TMDB_API_KEY || '';

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

if (!TMDB_API_KEY) {
  console.error('Missing TMDB API key');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false },
  global: {
    fetch: (url, options) => {
      return fetch(url, {
        ...options,
        signal: AbortSignal.timeout(60000)
      });
    }
  }
});

async function retryOp<T>(fn: () => Promise<T>, retries = 3, delay = 1500): Promise<T> {
  let lastError: any;
  for (let i = 1; i <= retries; i++) {
    try {
      return await fn();
    } catch (err: any) {
      lastError = err;
      console.warn(`  [retry] Attempt ${i}/${retries} failed: ${err.message}. Retrying in ${delay}ms...`);
      await new Promise(r => setTimeout(r, delay));
    }
  }
  throw lastError;
}



const NMR_CRITIC_ID = '426f2b84-bc70-4d84-897d-c61352b963e2';
const NMR_AVATAR = 'https://nigerianmoviesreview.com/wp-content/uploads/2023/08/NMR-WITHOUT-BG-150x150.png';

interface FilmConfig {
  key: string;
  type: 'movie' | 'tv';
  tmdbId: number;
  imdbId: string;
  contentType: 'feature_film' | 'mini_series';
  manualRuntime?: number;
  manualGenres?: string[];
  review: {
    rating: number | null;
    quote: string;
    url: string;
    publishedDate?: string;
  };
}

const FILMS_TO_INGEST: FilmConfig[] = [
  {
    key: 'Postcards',
    type: 'tv',
    tmdbId: 252100,
    imdbId: 'tt31691316',
    contentType: 'mini_series',
    manualRuntime: 35,
    manualGenres: ['Drama'],
    review: {
      rating: 2.3,
      quote: "Postcards is a 6-episode advert to sell India and its people but I’m afraid this project was too incompetent, cliche-ridden to sell anything to me. It was not a good watch for me. The most beautiful thing about the film was the end credits rolling – because it meant the ordeal was finally over.",
      url: 'https://nigerianmoviesreview.com/reviews/postcards/',
      publishedDate: '2024-05-08T09:00:00Z'
    }
  },
  {
    key: 'Something Like Gold',
    type: 'movie',
    tmdbId: 1174934,
    imdbId: 'tt28943289',
    contentType: 'feature_film',
    manualRuntime: 120,
    manualGenres: ['Drama', 'Romance'],
    review: {
      rating: 1.5,
      quote: "Overall, a deeply unsatisfying movie. I don’t know what inspired the title of this film, but it was nothing like gold. It was underwhelming and boring, especially since the two leads had no chemistry whatsoever. Poor script, terrible performances, lazy direction. Something like Gold is a terrible time waster.",
      url: 'https://nigerianmoviesreview.com/reviews/something-like-gold-movie-review/',
      publishedDate: '2024-04-18T12:00:00Z'
    }
  },
  {
    key: 'The House of Secrets',
    type: 'movie',
    tmdbId: 1146676,
    imdbId: 'tt28259834',
    contentType: 'feature_film',
    manualRuntime: 119,
    review: {
      rating: 5.0,
      quote: "Overall, House of Secrets was just there for me. While I understand that some would appreciate it because it is a bold attempt to tell a different type of story, I could not look past the loopholes, the tension free story telling, the lackluster performances and poor direction that marred this movie.",
      url: 'https://nigerianmoviesreview.com/reviews/house-of-secrets-niyi-akinmolayans-movie-fails-to-hit-the-mark/',
      publishedDate: '2023-07-07T12:00:00Z'
    }
  },
  {
    key: 'La Femme Anjola',
    type: 'movie',
    tmdbId: 696177,
    imdbId: 'tt10751454',
    contentType: 'feature_film',
    manualRuntime: 144,
    review: {
      rating: 6.5,
      quote: "Overall, La Femme Anjola was not bad but it does not deserve all the accolades it has enjoyed and I just want to say let it stop already.",
      url: 'https://nigerianmoviesreview.com/reviews/la-femme-anjola-a-review/',
      publishedDate: '2021-03-24T12:00:00Z'
    }
  },
  {
    key: 'Glamour Girls',
    type: 'movie',
    tmdbId: 982981,
    imdbId: 'tt20604466',
    contentType: 'feature_film',
    manualRuntime: 125,
    review: {
      rating: 1.5,
      quote: "Overall, it was not a good watch. Bad acting, bad dialogue and bad plot, it fails to improve on its source material, it manages to underachieve the bar set by its 1994 predecessor(over 2 decades later) and most importantly, it offers so little in terms of dramatic momentum and it is more likely to put you to sleep or give you headache.",
      url: 'https://nigerianmoviesreview.com/reviews/glamour-girls-2022-remake-a-review/',
      publishedDate: '2022-06-27T12:00:00Z'
    }
  },
  {
    key: 'Swallow',
    type: 'movie',
    tmdbId: 874562,
    imdbId: 'tt14391622',
    contentType: 'feature_film',
    manualRuntime: 128,
    review: {
      rating: 5.0,
      quote: "Do I still think Afolayan is a great filmmaker? Yes. Did he choose the wrong novel? Maybe. All I know is Swallow the movie was underwhelming and it left me feeling disappointed",
      url: 'https://nigerianmoviesreview.com/reviews/swallow-the-movie-is-kunle-afolayan-losing-his-touch/',
      publishedDate: '2021-10-04T12:00:00Z'
    }
  },
  {
    key: 'Cake',
    type: 'movie',
    tmdbId: 1019978,
    imdbId: 'tt18334720',
    contentType: 'feature_film',
    manualRuntime: 110,
    review: {
      rating: 2.0,
      quote: "Overall, this movie was not properly thought out at alllll.",
      url: 'https://nigerianmoviesreview.com/reviews/cake-movie-review/',
      publishedDate: '2022-04-12T12:00:00Z'
    }
  },
  {
    key: 'Move Like a Boss',
    type: 'movie',
    tmdbId: 1330144,
    imdbId: 'tt33046411',
    contentType: 'feature_film',
    manualRuntime: 93,
    review: {
      rating: 0.0,
      quote: "Move Like a Boss is a terrible time waster. It is every bit as lazily offensive as its cast and concept would suggest. No matter how starved you are for something to watch, there has to be a better option than this one.",
      url: 'https://nigerianmoviesreview.com/reviews/move-like-a-boss/',
      publishedDate: '2024-08-20T12:00:00Z'
    }
  },
  {
    key: 'The American King',
    type: 'movie',
    tmdbId: 825813,
    imdbId: 'tt13153712',
    contentType: 'feature_film',
    manualRuntime: 76,
    review: {
      rating: 1.0, // NMR called it illogical, a mess, rated terrible
      quote: "it was Illogical and it was a mess. The storyline made no coherent sense and the execution was completely uninspired.",
      url: 'https://nigerianmoviesreview.com/reviews/the-american-king-a-review/',
      publishedDate: '2022-02-15T12:00:00Z'
    }
  },
  {
    key: 'I Am Anis',
    type: 'movie',
    tmdbId: 1455836,
    imdbId: 'tt36304475',
    contentType: 'feature_film',
    manualRuntime: 125,
    review: {
      rating: 7.0,
      quote: "I Am Anis is available on Circuits TV and you should definitely check it out today. A deeply emotional and compelling story that hits the right notes.",
      url: 'https://nigerianmoviesreview.com/reviews/i-am-anis-movie-review/',
      publishedDate: '2025-01-20T12:00:00Z'
    }
  }
];

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '');
}

function mapNfvcbRating(rawCert?: string | null): string | null {
  if (!rawCert) return null;
  const c = rawCert.toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (c === '18' || c === 'R' || c === 'NC17' || c === 'TVMA') return '18';
  if (c === '15' || c === '16') return '15';
  if (c === 'PG13' || c === 'TV14' || c === '13' || c === '12A' || c === '12') return c === '12A' ? '12A' : (c === '12' ? '12' : 'PG-13');
  if (c === 'PG' || c === 'TVPG') return 'PG';
  if (c === 'G' || c === 'U' || c === 'TVG' || c === 'TVY' || c === 'TVY7') return 'G';
  return null;
}

function normalizeCrewRole(job: string): string | null {
  const j = job.toLowerCase().trim();
  if (j === 'director') return 'director';
  if (j === 'screenplay' || j === 'writer' || j === 'story' || j === 'author' || j === 'novel' || j === 'written by') return 'writer';
  if (j === 'producer' || j === 'executive producer' || j === 'co-producer') return 'producer';
  if (j === 'director of photography' || j === 'cinematography' || j === 'cinematographer') return 'cinematographer';
  if (j === 'editor') return 'editor';
  if (j === 'original music composer' || j === 'music' || j === 'composer') return 'composer';
  if (j === 'production design' || j === 'production designer' || j === 'art direction') return 'production_designer';
  if (j === 'costume design' || j === 'costume designer') return 'costume_designer';
  if (j === 'sound designer' || j === 'sound mixer' || j === 'sound re-recording mixer') return 'sound_designer';
  return null;
}

const personCache = new Map<string, string>();

async function resolvePerson(name: string, tmdbPersonId?: number, photoUrl?: string, department?: string): Promise<string | null> {
  const cleanName = name.trim();
  if (!cleanName) return null;
  const lowerName = cleanName.toLowerCase();

  if (personCache.has(lowerName)) {
    return personCache.get(lowerName)!;
  }

  // 1. Fast direct lookup by name
  const { data: directFind } = await supabase
    .from('people')
    .select('id, photo_url')
    .ilike('name', cleanName)
    .limit(1);

  if (directFind && directFind.length > 0) {
    const existing = directFind[0];
    personCache.set(lowerName, existing.id);
    if ((photoUrl && !existing.photo_url) || tmdbPersonId) {
      await supabase
        .from('people')
        .update({
          ...(photoUrl && !existing.photo_url ? { photo_url: photoUrl } : {}),
          ...(tmdbPersonId ? { tmdb_id: tmdbPersonId } : {})
        })
        .eq('id', existing.id);
    }
    return existing.id;
  }

  // 2. Lookup by tmdb_id if available
  if (tmdbPersonId) {
    const { data: tmdbFind } = await supabase
      .from('people')
      .select('id')
      .eq('tmdb_id', tmdbPersonId)
      .limit(1);
    if (tmdbFind && tmdbFind.length > 0) {
      personCache.set(lowerName, tmdbFind[0].id);
      return tmdbFind[0].id;
    }
  }

  // 3. Create new person
  const newSlug = slugify(cleanName) + '-' + Math.floor(100 + Math.random() * 900);
  const { data: inserted, error: insErr } = await supabase
    .from('people')
    .insert({
      name: cleanName,
      slug: newSlug,
      nationality: 'Nigerian',
      source: 'tmdb',
      photo_url: photoUrl || null,
      tmdb_id: tmdbPersonId || null,
      known_for_department: department || null,
      status: 'community'
    })
    .select('id')
    .single();

  if (insErr) {
    const { data: fallback } = await supabase.from('people').select('id').ilike('name', cleanName).limit(1);
    if (fallback && fallback.length > 0) {
      personCache.set(lowerName, fallback[0].id);
      return fallback[0].id;
    }
    console.error(`Error inserting person ${cleanName}:`, insErr.message);
    return null;
  }

  personCache.set(lowerName, inserted.id);
  return inserted.id;
}

async function ingestAll() {
  console.log('🚀 Step 1: Loading all genres from database...');
  const { data: allGenres, error: gErr } = await supabase.from('genres').select('id, name');
  if (gErr || !allGenres) {
    console.error('Failed to load genres:', gErr);
    process.exit(1);
  }
  const genreMap = new Map<string, string>();
  allGenres.forEach(g => genreMap.set(g.name.toLowerCase(), g.id));
  console.log(`Loaded ${allGenres.length} genres from database.`);

  console.log('\n🚀 Step 2: Ingesting the 10 films with full metadata, ensembles, and reviews...\n');

  for (const item of FILMS_TO_INGEST) {
    console.log(`\n======================================================`);
    console.log(`🎬 Processing [${item.contentType}] "${item.key}" (TMDB ${item.tmdbId})...`);

    // Fetch rich TMDB details
    const endpoint = item.type === 'tv'
      ? `https://api.themoviedb.org/3/tv/${item.tmdbId}?api_key=${TMDB_API_KEY}&append_to_response=credits,content_ratings,videos`
      : `https://api.themoviedb.org/3/movie/${item.tmdbId}?api_key=${TMDB_API_KEY}&append_to_response=credits,release_dates,videos`;

    const res = await retryOp(() => fetch(endpoint));
    if (!res.ok) {
      console.error(`❌ Failed to fetch TMDB data for ${item.key}: HTTP ${res.status}`);
      continue;
    }
    const tmdbData = await res.json();

    const title = (tmdbData.title || tmdbData.name || item.key).trim();
    const releaseDateStr = tmdbData.release_date || tmdbData.first_air_date || null;
    const year = releaseDateStr ? parseInt(releaseDateStr.slice(0, 4), 10) : null;
    const synopsis = tmdbData.overview || null;
    const tagline = tmdbData.tagline || null;
    const runtime = item.manualRuntime || tmdbData.runtime || tmdbData.episode_run_time?.[0] || null;

    const posterUrl = tmdbData.poster_path ? `https://image.tmdb.org/t/p/w780${tmdbData.poster_path}` : null;
    const backdropUrl = tmdbData.backdrop_path ? `https://image.tmdb.org/t/p/original${tmdbData.backdrop_path}` : null;

    // Genres
    const tmdbGenreNames: string[] = (tmdbData.genres || []).map((g: any) => g.name);
    const combinedGenreNames = [...new Set([...(item.manualGenres || []), ...tmdbGenreNames])];

    // Trailer
    const youtubeVideos = (tmdbData.videos?.results || []).filter(
      (v: any) => v.site === 'YouTube' && (v.type === 'Trailer' || v.type === 'Teaser')
    );
    const trailerYoutubeId = youtubeVideos.length > 0 ? youtubeVideos[0].key : null;

    // Certification
    let rawCert: string | null = null;
    if (item.type === 'movie' && tmdbData.release_dates?.results) {
      const ngRel = tmdbData.release_dates.results.find((r: any) => r.iso_3166_1 === 'NG');
      const usRel = tmdbData.release_dates.results.find((r: any) => r.iso_3166_1 === 'US');
      const gbRel = tmdbData.release_dates.results.find((r: any) => r.iso_3166_1 === 'GB');
      const anyRel = ngRel || usRel || gbRel || tmdbData.release_dates.results[0];
      if (anyRel?.release_dates?.length > 0) {
        rawCert = anyRel.release_dates.find((d: any) => d.certification)?.certification || null;
      }
    } else if (item.type === 'tv' && tmdbData.content_ratings?.results) {
      const ngRat = tmdbData.content_ratings.results.find((r: any) => r.iso_3166_1 === 'NG');
      const usRat = tmdbData.content_ratings.results.find((r: any) => r.iso_3166_1 === 'US');
      const anyRat = ngRat || usRat || tmdbData.content_ratings.results[0];
      rawCert = anyRat?.rating || null;
    }
    const nfvcbRating = mapNfvcbRating(rawCert);

    // Languages & countries
    const languages = ['English'];
    const originCountry = tmdbData.origin_country || [];
    const countries = ['Nigeria', ...originCountry.filter((c: string) => c !== 'NG')];

    // Check if film exists already (by tmdb_id or title)
    const { data: existingFilms } = await supabase
      .from('films')
      .select('id, title, slug')
      .or(`tmdb_id.eq.${item.tmdbId},imdb_id.eq.${item.imdbId}`)
      .limit(1);

    let filmId: string;
    let baseSlug = slugify(title);
    if (year) baseSlug += `-${year}`;

    if (existingFilms && existingFilms.length > 0) {
      filmId = existingFilms[0].id;
      console.log(`Found existing film record (ID: ${filmId}). Updating metadata...`);
      const { error: updateErr } = await supabase
        .from('films')
        .update({
          title,
          content_type: item.contentType,
          synopsis: synopsis || undefined,
          tagline: tagline || undefined,
          year: year || undefined,
          release_date: releaseDateStr || undefined,
          runtime_minutes: runtime || undefined,
          duration: runtime || undefined,
          poster_url: posterUrl || undefined,
          backdrop_url: backdropUrl || undefined,
          backdrop: backdropUrl || undefined,
          trailer_youtube_id: trailerYoutubeId || undefined,
          trailer_source: 'youtube',
          language: 'English',
          languages,
          countries,
          nfvcb_rating: nfvcbRating || undefined,
          nfvcb_rating_source: nfvcbRating ? 'tmdb_certification' : undefined,
          status: 'released',
          is_nollywood: true,
          is_published: true,
          tmdb_id: item.tmdbId,
          imdb_id: item.imdbId,
          tmdb_rating: tmdbData.vote_average || undefined,
          tmdb_vote_count: tmdbData.vote_count || undefined,
          genres: combinedGenreNames
        })
        .eq('id', filmId);

      if (updateErr) console.error('Error updating film:', updateErr.message);
    } else {
      // Ensure slug uniqueness
      let filmSlug = baseSlug;
      const { data: slugCheck } = await supabase.from('films').select('id').eq('slug', filmSlug).limit(1);
      if (slugCheck && slugCheck.length > 0) {
        filmSlug = `${baseSlug}-${Math.floor(100 + Math.random() * 900)}`;
      }

      console.log(`Creating new film record "${title}" (slug: ${filmSlug})...`);
      const newFilmPayload: any = {
        title,
        slug: filmSlug,
        content_type: item.contentType,
        synopsis,
        tagline,
        year,
        release_date: releaseDateStr,
        runtime_minutes: runtime,
        duration: runtime,
        poster_url: posterUrl,
        backdrop_url: backdropUrl,
        backdrop: backdropUrl,
        trailer_youtube_id: trailerYoutubeId,
        trailer_source: 'youtube',
        language: 'English',
        languages,
        countries,
        nfvcb_rating: nfvcbRating,
        nfvcb_rating_source: nfvcbRating ? 'tmdb_certification' : null,
        status: 'released',
        is_nollywood: true,
        is_published: true,
        tmdb_id: item.tmdbId,
        imdb_id: item.imdbId,
        tmdb_rating: tmdbData.vote_average || null,
        tmdb_vote_count: tmdbData.vote_count || 0,
        genres: combinedGenreNames,
        view_count: 0,
        average_rating: 0,
        audience_rating_count: 0,
        awards: []
      };

      if (item.contentType === 'mini_series') {
        newFilmPayload.season_count = 1;
        newFilmPayload.episode_count = tmdbData.number_of_episodes || 6;
      }

      const { data: insertedFilm, error: insFilmErr } = await supabase
        .from('films')
        .insert(newFilmPayload)
        .select('id')
        .single();

      if (insFilmErr || !insertedFilm) {
        console.error(`❌ Failed to insert film "${title}":`, insFilmErr?.message);
        continue;
      }
      filmId = insertedFilm.id;
      console.log(`✅ Successfully created film (ID: ${filmId})`);
    }

    // Link film_genres
    console.log(`Linking ${combinedGenreNames.length} genres to film...`);
    for (const gName of combinedGenreNames) {
      const gId = genreMap.get(gName.toLowerCase());
      if (gId) {
        const { error: fgErr } = await supabase
          .from('film_genres')
          .upsert({ film_id: filmId, genre_id: gId }, { onConflict: 'film_id,genre_id' });
        if (fgErr) console.error(`  Warning: genre link error (${gName}):`, fgErr.message);
      }
    }

    // Process Ensemble: Cast
    const rawCast = tmdbData.credits?.cast || [];
    console.log(`Processing ${rawCast.length} cast members...`);
    let castAdded = 0;
    for (let i = 0; i < rawCast.length; i++) {
      const actor = rawCast[i];
      const actorName = (actor.name || '').trim();
      if (!actorName) continue;

      const actorPhoto = actor.profile_path ? `https://image.tmdb.org/t/p/w500${actor.profile_path}` : undefined;
      const personId = await resolvePerson(actorName, actor.id, actorPhoto, 'Acting');
      if (!personId) continue;

      const characterName = actor.character && actor.character !== 'himself' && actor.character !== 'herself'
        ? actor.character.trim()
        : null;

      const { error: credErr } = await supabase.from('credits').upsert({
        film_id: filmId,
        person_id: personId,
        role: 'actor',
        character_name: characterName,
        billing_order: i + 1,
        source: 'tmdb'
      }, { onConflict: 'film_id,person_id,role' });

      if (!credErr) castAdded++;
    }
    console.log(`✅ Added/verified ${castAdded} cast credits.`);

    // Process Ensemble: Crew
    const rawCrew = tmdbData.credits?.crew || [];
    console.log(`Processing ${rawCrew.length} crew members...`);
    let crewAdded = 0;
    for (const member of rawCrew) {
      const memberName = (member.name || '').trim();
      if (!memberName || !member.job) continue;

      const normalizedRole = normalizeCrewRole(member.job);
      if (!normalizedRole) continue;

      const memberPhoto = member.profile_path ? `https://image.tmdb.org/t/p/w500${member.profile_path}` : undefined;
      const personId = await resolvePerson(memberName, member.id, memberPhoto, member.department);
      if (!personId) continue;

      const { error: credErr } = await supabase.from('credits').upsert({
        film_id: filmId,
        person_id: personId,
        role: normalizedRole,
        character_name: null,
        billing_order: 0,
        source: 'tmdb'
      }, { onConflict: 'film_id,person_id,role' });

      if (!credErr) crewAdded++;
    }
    console.log(`✅ Added/verified ${crewAdded} crew credits.`);

    // Process Critic Review from Nigerian Movies Review
    console.log(`Linking Nigerian Movies Review to film...`);
    const reviewData = {
      film_id: filmId,
      critic_id: NMR_CRITIC_ID,
      critic_name: 'Nigerian Movies Review',
      critic_title: 'Editorial Review Team',
      avatar_url: NMR_AVATAR,
      quote: item.review.quote,
      rating: item.review.rating,
      review_url: item.review.url,
      is_anonymous: false,
      is_featured: true,
      created_at: item.review.publishedDate || new Date().toISOString()
    };

    // Check if review exists for this film and critic
    const { data: existingRev } = await supabase
      .from('critic_reviews')
      .select('id')
      .eq('film_id', filmId)
      .eq('critic_id', NMR_CRITIC_ID)
      .limit(1);

    if (existingRev && existingRev.length > 0) {
      await supabase.from('critic_reviews').update(reviewData).eq('id', existingRev[0].id);
      console.log(`✔ Updated existing NMR review for "${title}"`);
    } else {
      const { error: revErr } = await supabase.from('critic_reviews').insert(reviewData);
      if (revErr) {
        console.error(`❌ Failed to insert NMR review:`, revErr.message);
      } else {
        console.log(`✔ Inserted verified NMR review (Rating: ${item.review.rating}/10)`);
      }
    }
  }

  console.log('\n======================================================');
  console.log('🎉 Ingestion complete for all 10 films!');
  console.log('======================================================\n');
}

ingestAll().catch(console.error);
