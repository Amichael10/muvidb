import { useState, useEffect, useRef } from 'react';
import { Link, useSearchParams, useLoaderData } from 'react-router-dom';
import { Icon } from '@iconify/react';
import { supabase } from '../lib/supabase';
import { collapseSeriesFilms } from '../utils/series';
import FilmCard from '../components/film/FilmCard';
import SkeletonCard from '../components/ui/SkeletonCard';
import { Skeleton } from '../components/ui/Skeleton';
import PageHeader from '../components/ui/PageHeader';
import { PLATFORMS, platformFilter } from '../lib/platforms';
import { NFVCB_RATING_OPTIONS } from '../lib/contributions';
import { AFRICAN_COUNTRY_NAMES } from '../utils/africanCountries';

export default function Browse() {
  const [searchParams] = useSearchParams();
  const initialGenre = searchParams.get('genre') || '';
  const initialCountry = searchParams.get('country') || '';
  const initialSort = searchParams.get('sort') || 'views';

  const initialPlatform = searchParams.get('platform') || '';

  // First page of results is server-rendered and edge-cached by the route loader
  // in src/routes/browse.tsx, so it's already in the HTML on first paint.
  const loaderData = useLoaderData();
  const seeded = !!loaderData?.seeded && (loaderData.films?.length ?? 0) > 0;

  const [isMobileFiltersOpen, setIsMobileFiltersOpen] = useState(false);
  const [films, setFilms] = useState(loaderData?.films ?? []);
  const [dbGenres, setDbGenres] = useState([]);
  const [dbCountries, setDbCountries] = useState(AFRICAN_COUNTRY_NAMES);
  // Starts false when seeded, otherwise the server would render the skeleton and
  // SSR would buy us nothing.
  const [loading, setLoading] = useState(!seeded);
  const [error, setError] = useState(null);
  
  // Filters state
  const [selectedGenres, setSelectedGenres] = useState(initialGenre ? [initialGenre] : []);
  const [selectedCountries, setSelectedCountries] = useState(initialCountry ? [initialCountry] : []);
  const [selectedPlatform, setSelectedPlatform] = useState(initialPlatform);
  const [selectedYear, setSelectedYear] = useState(''); // '' = any year; otherwise exact year
  const [selectedRatings, setSelectedRatings] = useState([]);
  const [language, setLanguage] = useState('');
  const [sortBy, setSortBy] = useState(initialSort);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [genresExpanded, setGenresExpanded] = useState(false);
  const [countriesExpanded, setCountriesExpanded] = useState(!!initialCountry && initialCountry !== 'Nigeria');
  const activeTab = 'movie';
  const GENRE_PREVIEW = 10;
  const COUNTRY_PREVIEW = 8;
  const currentYear = new Date().getFullYear();
  const yearOptions = Array.from({ length: currentYear - 1979 }, (_, i) => currentYear - i);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 400);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  useEffect(() => {
    // Title now comes from the route's `meta` export — setting it here too would
    // overwrite the server-rendered one after hydration.
    fetchGenres();
  }, []);

  // Skip only the on-mount fetch when the loader already seeded results; every
  // later filter change still refetches through the normal client path.
  const skipInitialFetch = useRef(seeded);

  useEffect(() => {
    setError(null);
    if (skipInitialFetch.current) {
      skipInitialFetch.current = false;
      return;
    }
    fetchFilms();
  }, [selectedGenres, selectedCountries, selectedPlatform, selectedYear, selectedRatings, language, sortBy, debouncedSearchQuery]);

  const fetchGenres = async () => {
    try {
      const [genresRes, countriesRes] = await Promise.all([
        supabase.from('genres').select('name').order('name'),
        supabase.from('countries').select('name').eq('continent', 'Africa').order('name')
      ]);
      if (genresRes.error) throw genresRes.error;
      if (countriesRes.error) throw countriesRes.error;
      
      setDbGenres((genresRes.data || []).map(g => g.name));
      const names = (countriesRes.data || []).map(c => c.name);
      setDbCountries(names.length ? names : AFRICAN_COUNTRY_NAMES);
    } catch (err) {
      console.error('Error fetching filters:', err);
      setDbCountries(AFRICAN_COUNTRY_NAMES);
    }
  };
  
  const fetchFilms = async () => {
    setLoading(true);
    try {
      let query = supabase.from('films').select(`
        id, slug, title, poster_url, backdrop_url, year, language, genres,
        runtime_minutes, view_count, average_rating, liked_percent, languages, audience_rating, tmdb_rating, nfvcb_rating, synopsis, tagline,
        release_type, streaming_links, source, youtube_watch_url,
        film_genres!left(genres(name)),
        film_countries!left(countries(name))
      `);

      if (selectedGenres.length > 0 && selectedCountries.length > 0) {
         query = supabase.from('films').select(`
          id, slug, title, poster_url, backdrop_url, year, language, genres,
          runtime_minutes, view_count, average_rating, liked_percent, languages, audience_rating, tmdb_rating, nfvcb_rating, synopsis, tagline,
          release_type, streaming_links, source, youtube_watch_url,
          film_genres!inner(genres!inner(name)),
          film_countries!inner(countries!inner(name))
        `);
        query = query.in('film_genres.genres.name', selectedGenres);
        query = query.in('film_countries.countries.name', selectedCountries);
      } else if (selectedGenres.length > 0) {
        query = supabase.from('films').select(`
          id, slug, title, poster_url, backdrop_url, year, language, genres,
          runtime_minutes, view_count, average_rating, liked_percent, languages, audience_rating, tmdb_rating, nfvcb_rating, synopsis, tagline,
          release_type, streaming_links, source, youtube_watch_url,
          film_genres!inner(genres!inner(name)),
          film_countries!left(countries(name))
        `);
        query = query.in('film_genres.genres.name', selectedGenres);
      } else if (selectedCountries.length > 0) {
        query = supabase.from('films').select(`
          id, slug, title, poster_url, backdrop_url, year, language, genres,
          runtime_minutes, view_count, average_rating, liked_percent, languages, audience_rating, tmdb_rating, nfvcb_rating, synopsis, tagline,
          release_type, streaming_links, source, youtube_watch_url,
          film_genres!left(genres(name)),
          film_countries!inner(countries!inner(name))
        `);
        query = query.in('film_countries.countries.name', selectedCountries);
      }

      query = query.eq('content_type', activeTab);

      if (debouncedSearchQuery.trim()) {
        query = query.ilike('title', `%${debouncedSearchQuery.trim()}%`);
      }

      if (selectedYear) query = query.eq('year', parseInt(selectedYear, 10));
      if (language) query = query.eq('language', language);
      if (selectedRatings.length > 0) query = query.in('nfvcb_rating', selectedRatings);
      
      // Filter: Only show non-mubi films OR mubi films from Nigeria
      query = query.or('source.neq.mubi,source.is.null,countries.cs.{"Nigeria"}');

      if (selectedPlatform) {
        query = query.or(platformFilter(selectedPlatform));
      }

      const sortMap = {
        'views': { column: 'view_count', ascending: false },
        'rating': { column: 'liked_percent', ascending: false },
        'newest': { column: 'created_at', ascending: false },
        'oldest': { column: 'year', ascending: true }
      };
      
      const config = sortMap[sortBy] || sortMap.views;
      query = query.order(config.column, { ascending: config.ascending });
      query = query.range(0, 49);

      const { data, error: dbError } = await query;
      
      if (dbError) throw dbError;

      const transformed = (data || []).map(f => {
        const relatedGenres = f.film_genres?.map(fg => fg.genres?.name).filter(Boolean) || [];
        return {
          ...f,
          genres: relatedGenres.length > 0 ? relatedGenres : (Array.isArray(f.genres) ? f.genres.filter(Boolean) : []),
          countries: f.film_countries?.map(fc => fc.countries?.name).filter(Boolean) || []
        };
      });

      setFilms(collapseSeriesFilms(transformed));
    } catch (err) {
      console.error('Fetch error:', err);
      setError('Could not connect to the movie database.');
    } finally {
      setLoading(false);
    }
  };

  const nfvcbRatings = NFVCB_RATING_OPTIONS.map((o) => o.value);
  
  const toggleGenre = (genre) => {
    setSelectedGenres(prev => 
      prev.includes(genre) ? prev.filter(g => g !== genre) : [...prev, genre]
    );
  };

  const toggleCountry = (country) => {
    setSelectedCountries(prev => 
      prev.includes(country) ? prev.filter(c => c !== country) : [...prev, country]
    );
  };

  const toggleRating = (rating) => {
    setSelectedRatings(prev => 
      prev.includes(rating) ? prev.filter(r => r !== rating) : [...prev, rating]
    );
  };

  const clearAll = () => {
    setSelectedGenres([]);
    setSelectedCountries([]);
    setSelectedPlatform('');
    setSelectedYear('');
    setSelectedRatings([]);
    setLanguage('');
    setSortBy('views');
    setSearchQuery('');
    setGenresExpanded(false);
  };

  const visibleGenres = genresExpanded ? dbGenres : dbGenres.slice(0, GENRE_PREVIEW);
  const hiddenGenreCount = Math.max(0, dbGenres.length - GENRE_PREVIEW);
  // Keep Nigeria first when collapsed; still include any selected countries in the preview.
  const orderedCountries = (() => {
    const rest = dbCountries.filter((c) => c !== 'Nigeria');
    return dbCountries.includes('Nigeria') ? ['Nigeria', ...rest] : dbCountries;
  })();
  const countryPreview = (() => {
    const preview = orderedCountries.slice(0, COUNTRY_PREVIEW);
    for (const c of selectedCountries) {
      if (!preview.includes(c)) preview.push(c);
    }
    return preview;
  })();
  const visibleCountries = countriesExpanded ? orderedCountries : countryPreview;
  const hiddenCountryCount = Math.max(0, orderedCountries.length - COUNTRY_PREVIEW);

  return (
    <div className="min-h-screen bg-bg">
      <PageHeader
        icon="solar:clapperboard-play-bold"
        eyebrow="Browse"
        title="Movies"
        description="Explore the complete collection of Nollywood movies, from digital premieres to theatrical blockbusters."
        count={films.length}
        countLabel="titles in view"
        actions={
          <button
            className="md:hidden flex items-center justify-center gap-2 bg-surface border border-border px-6 py-3 rounded-lg text-xs font-bold text-text-primary"
            onClick={() => setIsMobileFiltersOpen(!isMobileFiltersOpen)}
          >
            <Icon icon="solar:filter-linear" width="16" />
            Filters
          </button>
        }
      />

      <div className="max-w-7xl mx-auto border-x border-border min-h-screen">
        <div className="flex flex-col md:flex-row divide-y md:divide-y-0 md:divide-x divide-border">
          {/* Filters Sidebar */}
          <div className={`md:w-80 shrink-0 p-8 space-y-12 bg-surface-2/5 ${isMobileFiltersOpen ? 'block' : 'hidden md:block'}`}>
            <div className="flex items-center justify-between border-b border-border pb-4">
              <h3 className="font-heading font-bold text-sm text-text-primary">Filters</h3>
              <button onClick={clearAll} className="text-[9px] font-bold text-brand hover:underline">Clear Filters</button>
            </div>

            <div className="space-y-4">
              <h4 className="font-bold text-text-muted text-[10px] tracking-wider">Sort By</h4>
              <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="w-full bg-surface border border-border text-text-primary rounded-lg p-4 text-[10px] font-bold tracking-wider outline-none focus:border-brand transition-all">
                <option value="views">Most Viewed</option>
                <option value="rating">Top Rated</option>
                <option value="newest">Newest Arrivals</option>
                <option value="oldest">Vintage</option>
              </select>
            </div>

            <div className="space-y-4">
              <h4 className="font-bold text-text-muted text-[10px] tracking-wider">Watch Platform</h4>
              <select
                value={selectedPlatform}
                onChange={(e) => setSelectedPlatform(e.target.value)}
                className="w-full bg-surface border border-border text-text-primary rounded-lg p-4 text-[10px] font-bold tracking-wider outline-none focus:border-brand transition-all"
              >
                <option value="">All Platforms</option>
                {PLATFORMS.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>

            <div className="space-y-6">
              <h4 className="font-bold text-text-muted text-[10px] tracking-wider">Genres</h4>
              <div className="space-y-3">
                {visibleGenres.map(genre => (
                  <label key={genre} className="flex items-center gap-3 cursor-pointer group" onClick={() => toggleGenre(genre)}>
                    <div className={`w-4 h-4 rounded border-2 transition-all flex items-center justify-center ${selectedGenres.includes(genre) ? 'bg-brand border-brand shadow-[0_0_8px_var(--brand)]' : 'border-border bg-surface group-hover:border-brand/50'}`}>
                      {selectedGenres.includes(genre) && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                    </div>
                    <span className={`text-[11px] font-bold tracking-wider transition-colors ${selectedGenres.includes(genre) ? 'text-brand' : 'text-text-primary group-hover:text-brand'}`}>{genre}</span>
                  </label>
                ))}
              </div>
              {hiddenGenreCount > 0 && (
                <button
                  type="button"
                  onClick={() => setGenresExpanded((v) => !v)}
                  className="text-[10px] font-bold uppercase tracking-widest text-brand hover:underline"
                >
                  {genresExpanded ? 'Show less' : `${hiddenGenreCount}+ more`}
                </button>
              )}
            </div>

            <div className="space-y-6">
              <h4 className="font-bold text-text-muted text-[10px] tracking-wider">Countries</h4>
              <div className="space-y-3">
                {visibleCountries.map(country => (
                  <label key={country} className="flex items-center gap-3 cursor-pointer group" onClick={() => toggleCountry(country)}>
                    <div className={`w-4 h-4 rounded border-2 transition-all flex items-center justify-center ${selectedCountries.includes(country) ? 'bg-brand border-brand shadow-[0_0_8px_var(--brand)]' : 'border-border bg-surface group-hover:border-brand/50'}`}>
                      {selectedCountries.includes(country) && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                    </div>
                    <span className={`text-[11px] font-bold tracking-wider transition-colors ${selectedCountries.includes(country) ? 'text-brand' : 'text-text-primary group-hover:text-brand'}`}>{country}</span>
                  </label>
                ))}
              </div>
              {hiddenCountryCount > 0 && (
                <button
                  type="button"
                  onClick={() => setCountriesExpanded((v) => !v)}
                  className="text-[10px] font-bold uppercase tracking-widest text-brand hover:underline"
                >
                  {countriesExpanded ? 'Show less' : `${hiddenCountryCount}+ more`}
                </button>
              )}
            </div>

            <div className="space-y-4">
              <h4 className="font-bold text-text-muted text-[10px] tracking-wider">Year</h4>
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(e.target.value)}
                className="w-full bg-surface border border-border text-text-primary rounded-lg p-4 text-[10px] font-bold tracking-wider outline-none focus:border-brand transition-all"
              >
                <option value="">Any year</option>
                {yearOptions.map((y) => (
                  <option key={y} value={String(y)}>{y}</option>
                ))}
              </select>
            </div>

            <div className="space-y-6">
              <h4 className="font-bold text-text-muted text-[10px] tracking-wider">Rating</h4>
              <div className="flex flex-wrap gap-2">
                {nfvcbRatings.map(r => (
                  <button key={r} onClick={() => toggleRating(r)} className={`px-4 py-2 rounded text-[10px] font-bold border transition-all ${selectedRatings.includes(r) ? 'bg-brand border-brand text-white shadow-lg shadow-brand/20' : 'border-border text-text-muted hover:border-brand/50 hover:text-text-primary'}`}>
                    {r}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Films Grid */}
          <div className="flex-1 p-4 md:p-8 lg:p-12">
            {/* Search Bar */}
            <div className="mb-8 relative max-w-md">
              <Icon icon="solar:magnifer-linear" className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted opacity-60 text-lg pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search movies by title..."
                className="w-full h-12 bg-surface border border-border text-text-primary rounded-xl px-5 pl-11 text-sm focus:border-brand focus:outline-none transition-all shadow-md"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary"
                  aria-label="Clear search"
                >
                  <Icon icon="solar:close-circle-linear" className="text-lg" />
                </button>
              )}
            </div>

            {loading ? (
              <div className={`grid gap-4 sm:gap-6 md:gap-8 ${selectedPlatform === 'youtube' ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3' : 'grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'}`}>
                {[...Array(8)].map((_, i) => (
                  <div key={i} className="flex justify-center">
                    <SkeletonCard size="md" variant={selectedPlatform === 'youtube' ? 'youtube' : 'portrait'} fullWidth={selectedPlatform === 'youtube'} />
                  </div>
                ))}
              </div>
            ) : films.length > 0 ? (
              <div className={`grid gap-4 sm:gap-6 md:gap-8 ${selectedPlatform === 'youtube' ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3' : 'grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'}`}>
                {films.map(film => (
                  <div key={film.id} className={selectedPlatform === 'youtube' ? '' : 'flex justify-center'}>
                    <FilmCard film={film} variant={selectedPlatform === 'youtube' ? 'youtube' : 'portrait'} fullWidth={selectedPlatform === 'youtube'} />
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-surface-2/10 border-2 border-dashed border-border rounded-xl p-32 text-center">
                <p className="text-text-muted text-xs font-bold mb-6">No matching results found.</p>
                <div className="flex flex-wrap items-center justify-center gap-3">
                  <button onClick={clearAll} className="bg-brand text-white text-[10px] font-bold px-8 py-3 rounded-lg hover:shadow-brand/20 transition-all">Reset Filters</button>
                  <Link to="/submit/film" className="border border-border text-text-primary text-[10px] font-bold px-8 py-3 rounded-lg hover:border-brand hover:text-brand transition-all">Add a Missing Film</Link>
                </div>
              </div>
            )}

            {!loading && (
              <div className="mt-12 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-border bg-surface px-6 py-5">
                <div>
                  <p className="text-text-primary text-sm font-bold">Something missing from this list?</p>
                  <p className="text-text-muted text-xs mt-1">Send us the film and an editor will review it.</p>
                </div>
                <Link
                  to="/submit"
                  className="rounded-lg bg-brand px-6 py-3 text-[10px] font-black uppercase tracking-widest text-white transition-all hover:opacity-90 active:scale-95"
                >
                  Add to MuviDB
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
