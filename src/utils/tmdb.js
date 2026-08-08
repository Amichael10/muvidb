// ─────────────────────────────────────────
// TMDB API Utility Module
// All API calls are proxied through /api/tmdb so the key
// never appears in the browser bundle.
// Docs: https://developer.themoviedb.org/docs
// ─────────────────────────────────────────

const IMAGE_BASE = 'https://image.tmdb.org/t/p'

// ─── Image URL Helper ────────────────────
// Sizes: w92, w154, w185, w342, w500, w780, original
export const tmdbImageUrl = (path, size = 'w500') => {
  if (!path) return null
  return `${IMAGE_BASE}/${size}${path}`
}

export const tmdbPosterUrl = (path) => tmdbImageUrl(path, 'w500')
export const tmdbBackdropUrl = (path) => tmdbImageUrl(path, 'w1280')
export const tmdbProfileUrl = (path) => tmdbImageUrl(path, 'w185')

// ─── Language Code Mapping ───────────────
const LANGUAGE_MAP = {
  en: 'English',
  yo: 'Yoruba',
  ig: 'Igbo',
  ha: 'Hausa',
  pcm: 'Pidgin',
  fr: 'French',
  pt: 'Portuguese',
  es: 'Spanish',
  ar: 'Arabic',
  sw: 'Swahili',
}

export const mapLanguage = (isoCode) => {
  return LANGUAGE_MAP[isoCode] || isoCode?.toUpperCase() || 'English'
}

// ─── Status Mapping ──────────────────────
const STATUS_MAP = {
  'Released': 'released',
  'Post Production': 'post-production',
  'In Production': 'filming',
  'Planned': 'announced',
  'Rumored': 'announced',
  'Canceled': 'announced',
}

export const mapStatus = (tmdbStatus) => {
  return STATUS_MAP[tmdbStatus] || 'announced'
}

// ─── TMDB Genre → MuviDB Genre Mapping ────
// TMDB genre IDs: https://developer.themoviedb.org/reference/genre-movie-list
const TMDB_GENRE_MAP = {
  28: 'Action',
  12: 'Adventure',
  16: 'Animation',
  35: 'Comedy',
  80: 'Crime',
  99: 'Documentary',
  18: 'Drama',
  10751: 'Family',
  14: 'Fantasy',
  36: 'History',
  27: 'Horror',
  10402: 'Music',
  9648: 'Mystery',
  10749: 'Romance',
  878: 'Sci-Fi',
  53: 'Thriller',
  10752: 'War',
  37: 'Western',
}

export const mapTmdbGenre = (tmdbGenreId) => {
  return TMDB_GENRE_MAP[tmdbGenreId] || null
}

// ─── API Fetch Helper ────────────────────
// Routes through the server-side /api/tmdb proxy so the API key
// is never included in the client bundle.
const tmdbFetch = async (endpoint, params = {}) => {
  const searchParams = new URLSearchParams({ endpoint })
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      searchParams.set(key, value)
    }
  })

  try {
    const res = await fetch(`/api/tmdb?${searchParams}`)
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}))
      console.error(`TMDB API error (${res.status}):`, errData)
      return null
    }
    return await res.json()
  } catch (error) {
    console.error('TMDB fetch error:', error)
    return null
  }
}

// ─────────────────────────────────────────
// FUNCTION 1: Search TMDB for movies
// Returns top results matching query
// ─────────────────────────────────────────
export const searchTmdbMovies = async (query, page = 1) => {
  if (!query?.trim()) return { results: [], totalPages: 0, totalResults: 0 }

  const data = await tmdbFetch('/search/movie', {
    query: query.trim(),
    page,
    include_adult: false,
  })

  if (!data) return { results: [], totalPages: 0, totalResults: 0 }

  return {
    results: data.results.map(movie => ({
      tmdbId: movie.id,
      title: movie.title,
      originalTitle: movie.original_title,
      year: movie.release_date ? new Date(movie.release_date).getFullYear() : null,
      releaseDate: movie.release_date,
      overview: movie.overview,
      posterUrl: tmdbPosterUrl(movie.poster_path),
      backdropUrl: tmdbBackdropUrl(movie.backdrop_path),
      rating: movie.vote_average,
      voteCount: movie.vote_count,
      popularity: movie.popularity,
      language: mapLanguage(movie.original_language),
      genreIds: movie.genre_ids,
      genreNames: movie.genre_ids.map(id => mapTmdbGenre(id)).filter(Boolean),
    })),
    totalPages: data.total_pages,
    totalResults: data.total_results,
    page: data.page,
  }
}

// ─────────────────────────────────────────
// FUNCTION 2: Discover Nigerian movies
// Uses with_origin_country=NG filter
// ─────────────────────────────────────────
export const discoverNigerianMovies = async (page = 1, year = null, sortBy = 'popularity.desc') => {
  const params = {
    with_origin_country: 'NG',
    sort_by: sortBy,
    page,
    include_adult: false,
  }

  if (year) {
    params.primary_release_year = year
  }

  const data = await tmdbFetch('/discover/movie', params)

  if (!data) return { results: [], totalPages: 0, totalResults: 0 }

  return {
    results: data.results.map(movie => ({
      tmdbId: movie.id,
      title: movie.title,
      originalTitle: movie.original_title,
      year: movie.release_date ? new Date(movie.release_date).getFullYear() : null,
      releaseDate: movie.release_date,
      overview: movie.overview,
      posterUrl: tmdbPosterUrl(movie.poster_path),
      backdropUrl: tmdbBackdropUrl(movie.backdrop_path),
      rating: movie.vote_average,
      voteCount: movie.vote_count,
      popularity: movie.popularity,
      language: mapLanguage(movie.original_language),
      genreIds: movie.genre_ids,
      genreNames: movie.genre_ids.map(id => mapTmdbGenre(id)).filter(Boolean),
    })),
    totalPages: Math.min(data.total_pages, 500), // TMDB caps at 500
    totalResults: data.total_results,
    page: data.page,
  }
}

// ─────────────────────────────────────────
// FUNCTION 3: Get full movie details
// Includes credits (cast/crew) and production companies
// Costs 1 request (append_to_response saves quota)
// ─────────────────────────────────────────
export const getTmdbMovieDetails = async (tmdbId) => {
  const data = await tmdbFetch(`/movie/${tmdbId}`, {
    append_to_response: 'credits',
  })

  if (!data) return null

  // Extract top cast (limit to 50)
  const cast = (data.credits?.cast || []).slice(0, 50).map(person => ({
    tmdbId: person.id,
    name: person.name,
    character: person.character,
    order: person.order,
    photoUrl: tmdbProfileUrl(person.profile_path),
  }))

  // Extract key crew (Directors, Writers, Producers, Cinematographers, etc.)
  const importantJobs = [
    'Director', 'Writer', 'Screenplay', 'Producer', 'Executive Producer', 
    'Director of Photography', 'Editor', 'Original Music Composer', 
    'Production Design', 'Art Direction', 'Costume Design', 'Makeup Artist', 
    'Stunt Coordinator', 'Visual Effects Supervisor', 'Casting'
  ]
  const crew = (data.credits?.crew || [])
    .filter(person => importantJobs.includes(person.job))
    .map(person => ({
      tmdbId: person.id,
      name: person.name,
      job: person.job,
      department: person.department,
      photoUrl: tmdbProfileUrl(person.profile_path),
    }))

  // Extract production companies
  const companies = (data.production_companies || []).map(company => ({
    tmdbId: company.id,
    name: company.name,
    logoUrl: tmdbImageUrl(company.logo_path, 'w185'),
    originCountry: company.origin_country,
  }))

  return {
    tmdbId: data.id,
    title: data.title,
    originalTitle: data.original_title,
    tagline: data.tagline,
    overview: data.overview,
    releaseDate: data.release_date,
    year: data.release_date ? new Date(data.release_date).getFullYear() : null,
    runtime: data.runtime,
    status: mapStatus(data.status),
    language: mapLanguage(data.original_language),
    posterUrl: tmdbPosterUrl(data.poster_path),
    backdropUrl: tmdbBackdropUrl(data.backdrop_path),
    rating: data.vote_average,
    voteCount: data.vote_count,
    popularity: data.popularity,
    budget: data.budget,
    revenue: data.revenue,
    genres: (data.genres || []).map(g => ({
      tmdbId: g.id,
      name: mapTmdbGenre(g.id) || g.name,
    })),
    cast,
    crew,
    companies,
    imdbId: data.imdb_id,
  }
}

// ─────────────────────────────────────────
// FUNCTION 4: Get person details
// ─────────────────────────────────────────
export const getTmdbPerson = async (tmdbId) => {
  const data = await tmdbFetch(`/person/${tmdbId}`, {
    append_to_response: 'movie_credits',
  })

  if (!data) return null

  // Process filmography
  const filmography = [
    ...(data.movie_credits?.cast || []),
    ...(data.movie_credits?.crew || [])
  ]
    .map(m => ({
      tmdbId: m.id,
      title: m.title || m.original_title,
      role: m.character || m.job || 'Unknown',
      year: m.release_date ? new Date(m.release_date).getFullYear() : null,
      posterUrl: tmdbPosterUrl(m.poster_path),
      popularity: m.popularity,
    }))
    // Deduplicate (same movie, multiple roles)
    .reduce((acc, current) => {
      const x = acc.find(item => item.tmdbId === current.tmdbId);
      if (!x) return acc.concat([current]);
      return acc;
    }, [])
    .sort((a, b) => (b.year || 0) - (a.year || 0))

  return {
    tmdbId: data.id,
    name: data.name,
    biography: data.biography,
    birthday: data.birthday,
    deathday: data.deathday,
    placeOfBirth: data.place_of_birth,
    photoUrl: tmdbProfileUrl(data.profile_path),
    imdbId: data.imdb_id,
    popularity: data.popularity,
    filmography,
  }
}
