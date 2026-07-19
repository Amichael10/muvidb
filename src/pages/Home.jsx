import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { getPersonYoutubeChannelUrl } from '../lib/youtube';
import HeroSection from '../components/film/HeroSection';
import FilmRow from '../components/film/FilmRow';
import FilmCard from '../components/film/FilmCard';
import TopTenSection from '../components/film/TopTenSection';
import GenreRail from '../components/film/GenreRail';
import PlatformRail from '../components/film/PlatformRail';
import PersonCard from '../components/person/PersonCard';
import { Icon } from '@iconify/react';
import { useAuth } from '../context/AuthContext';
import { PLATFORMS, platformFilter } from '../lib/platforms';
import { toTitleCase } from '../utils/format';
import { getZonedClock, getNextDate, isFutureShowtime, compareShowtimes } from '../utils/showtimes';
import ImageWithFallback from '../components/ui/ImageWithFallback';

// Platforms shown in the homepage "New to Stream" tabbed rail.
const NEW_STREAM = PLATFORMS.filter(p => ['netflix', 'prime_video', 'kava', 'docuth', 'ebonylife', 'circuits'].includes(p.id));
const NEW_STREAM_IDS = NEW_STREAM.map(p => p.id);
const CINEMA_SHOWTIME_PAGE_SIZE = 1000;

const cinemaFilmKey = (title = '') => title
  .normalize('NFKD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/&/g, ' and ')
  .replace(/[^a-z0-9]+/g, ' ')
  .trim()
  .replace(/\s+/g, ' ');

export default function Home() {
  const { isAuthenticated } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [isHeroLoading, setIsHeroLoading] = useState(true);
  const [isCinemaLoading, setIsCinemaLoading] = useState(true);
  const [inCinemas, setInCinemas] = useState([]);
  const [newToStream, setNewToStream] = useState({}); // { netflix: [...], prime_video: [...], ... }
  const [streamTab, setStreamTab] = useState('netflix');
  const [youtubeFeed, setYoutubeFeed] = useState([]);
  const [youtubeFilter, setYoutubeFilter] = useState('All');
  const [spotlightPerson, setSpotlightPerson] = useState(null);
  const [otherPeople, setOtherPeople] = useState([]);
  const [creators, setCreators] = useState([]);
  const [newReleases, setNewReleases] = useState([]);
  const [isComingSoonLoading, setIsComingSoonLoading] = useState(true);

  const [featuredFilms, setFeaturedFilms] = useState([]);
  const [comingSoon, setComingSoon] = useState([]);
  const [curatedCollection, setCuratedCollection] = useState(null);
  const [recentlyAdded, setRecentlyAdded] = useState([]);
  const [spotlightContent, setSpotlightContent] = useState(null);
  const [top10Films, setTop10Films] = useState([]);
  const [crewMembers, setCrewMembers] = useState([]);
  const [productionCompanies, setProductionCompanies] = useState([]);
  const [featuredSeries, setFeaturedSeries] = useState([]);
  const [genreSections, setGenreSections] = useState([]);

  // What's New consolidated tabs (Coming Soon / New Releases / Recently Added)
  const [whatsNewTab, setWhatsNewTab] = useState('coming');

  // Featured Talent consolidated tabs (Artist / Crew)
  const [featuredTalentTab, setFeaturedTalentTab] = useState('artist');

  // Accurate per-platform title counts (counted at the DB level — the client film
  // list is capped at 1000 rows and undercounts the 19k+ catalogue).
  const [platformCounts, setPlatformCounts] = useState({});

  // External YouTube Channel warning dialog states (Issue 19)
  const [isWarningModalOpen, setIsWarningModalOpen] = useState(false);
  const [externalUrl, setExternalUrl] = useState('');
  const [dontShowAgain, setDontShowAgain] = useState(false);

  useEffect(() => {
    document.title = "MuviDB | Home";
    // Run the platform counts AFTER the main load burst clears, not during it —
    // the unindexed streaming_links count scans are slow and were timing out while
    // ~13 other queries hammered the DB, leaving tiles stuck on "Browse". The tiles
    // render immediately regardless; this just makes their labels reliable.
    fetchAllData().finally(() => fetchPlatformCounts());

    const cinemaRefresh = window.setInterval(() => {
      fetchInCinemasData().catch(error => console.error('Error refreshing cinema data:', error));
    }, 60_000);

    return () => window.clearInterval(cinemaRefresh);
  }, []);

  const fetchAllData = async () => {
    setIsLoading(true);
    setIsHeroLoading(true);

    // Showtime aggregation is intentionally independent: a large cinema response
    // should never delay the hero or the rest of the homepage.
    setIsCinemaLoading(true);
    const cinemaPromise = fetchInCinemasData()
      .catch(e => console.error('Error fetching cinemas data:', e))
      .finally(() => setIsCinemaLoading(false));

    // Fetch the hero on its own critical path.
    try {
      await fetchFeaturedFilms().catch(e => console.error('Error fetching featured films:', e));
    } catch (e) {
      console.error('Error in critical fetches:', e);
    } finally {
      setIsHeroLoading(false);
    }

    // 2. Fetch all other sections in the background progressively
    try {
      await Promise.all([
        fetchFeaturedSeries().catch(e => console.error('Error fetching series:', e)),
        fetchNewReleases().catch(e => console.error('Error fetching new releases:', e)),
        fetchNewToStream().catch(e => console.error('Error fetching new to stream:', e)),
        fetchYoutubeFeed().catch(e => console.error('Error fetching youtube feed:', e)),
        fetchPeople().catch(e => console.error('Error fetching people:', e)),
        fetchCreators().catch(e => console.error('Error fetching creators:', e)),
        fetchCuratedCollection().catch(e => console.error('Error fetching curated collection:', e)),
        fetchSpotlightContent().catch(e => console.error('Error fetching spotlight content:', e)),
        fetchTop10Films().catch(e => console.error('Error fetching top 10:', e)),
        fetchCrewMembers().catch(e => console.error('Error fetching crew:', e)),
        fetchCompanies().catch(e => console.error('Error fetching companies:', e)),
        fetchRecentlyAdded().catch(e => console.error('Error fetching recently added:', e)),
        fetchGenreSections().catch(e => console.error('Error fetching genre sections:', e))
      ]);
    } catch (error) {
      console.error('Error in progressive fetches:', error);
    } finally {
      setIsLoading(false);
    }

    // Load this curated rail after the main homepage burst. Its status query is
    // indexed, but deferring it avoids competing with the heavier discovery rails.
    await fetchComingSoon().catch(e => console.error('Error fetching coming soon:', e));

    // Keep this promise observed without making lower homepage sections wait for it.
    await cinemaPromise;
  };

  // Fetch films for the top genre sections at the bottom of the page.
  const GENRE_SECTION_NAMES = ['Romance', 'Crime', 'Thriller', 'Comedy', 'Family'];
  const fetchGenreSections = async () => {
    const results = await Promise.all(
      GENRE_SECTION_NAMES.map(async (genreName) => {
        const { data } = await supabase
          .from('films')
          .select(`
            id, slug, title, poster_url, backdrop_url, year, source,
            content_type, streaming_links, view_count,
            film_genres!inner(genres!inner(name))
          `)
          .eq('film_genres.genres.name', genreName)
          .not('poster_url', 'is', null)
          .order('view_count', { ascending: false })
          .limit(8);
        const films = (data || []).map(f => ({
          ...f,
          genres: f.film_genres?.map(fg => fg.genres?.name).filter(Boolean) || []
        }));
        return { genre: genreName, films };
      })
    );
    setGenreSections(results.filter(s => s.films.length > 0));
  };
  const fetchPlatformCounts = async () => {
    // Count one platform, retrying once on a statement timeout (57014). Returns
    // null (unknown) only if it genuinely keeps failing, so a transient timeout
    // never silently collapses a real count to 0 and hides the platform.
    const countOne = async (p, attempt = 0) => {
      const { count, error } = await supabase
        .from('films')
        .select('id', { count: 'exact', head: true })
        .or(platformFilter(p.id));
      if (error) {
        if (attempt < 2 && error.code === '57014') {
          await new Promise(r => setTimeout(r, 1200 * (attempt + 1)));
          return countOne(p, attempt + 1);
        }
        console.error(`Error counting platform ${p.id}:`, error);
        return null;
      }
      return count ?? 0;
    };

    // Let the initial homepage query burst settle before hammering the DB with
    // exact-count scans — improves reliability of the first platform counted.
    await new Promise(r => setTimeout(r, 800));

    // Sequential, not parallel: 8 simultaneous exact-count scans over the 19k
    // catalogue saturate the connection pool and time out. Running them one at a
    // time keeps each well under the timeout. The tiles render immediately
    // regardless; each count is applied as soon as it resolves.
    const result = {};
    for (const p of PLATFORMS) {
      result[p.id] = await countOne(p);
      setPlatformCounts({ ...result });
    }
  };

  const fetchFeaturedFilms = async () => {
    const { data } = await supabase
      .from('films')
      .select(`
        *,
        film_genres(genres(name))
      `)
      .eq('is_featured', true)
      .or('source.neq.mubi,source.is.null,countries.cs.{Nigeria}')
      .order('view_count', { ascending: false });
    
    if (data) {
      setFeaturedFilms(data.map(f => ({
        ...f,
        genres: f.film_genres?.map(fg => fg.genres?.name).filter(Boolean) || []
      })));
    }
  };

  const fetchFeaturedSeries = async () => {
    const { data, error } = await supabase
      .from('films')
      .select(`
        id, slug, title, poster_url, backdrop_url, year, language,
        runtime_minutes, view_count, average_rating, liked_percent, languages, nfvcb_rating,
        is_featured, is_trending, release_type, streaming_links, source,
        youtube_watch_url, content_type, season_count, episode_count,
        film_genres(genres(name))
      `)
      .eq('content_type', 'series')
      .eq('is_trending', true)
      .or('source.neq.mubi,source.is.null,countries.cs.{Nigeria}')
      .order('view_count', { ascending: false })
      .limit(20);

    if (!error && data) {
      setFeaturedSeries(data.map(f => ({
        ...f,
        genres: f.film_genres?.map(fg => fg.genres?.name).filter(Boolean) || []
      })));
    }
  };

  const fetchNewReleases = async () => {
    // New Releases = newly added movies of year 2026, newest first.
    const { data, error } = await supabase
      .from('films')
      .select(`
        id, slug, title, poster_url, backdrop_url, year, language,
        runtime_minutes, view_count, average_rating, liked_percent, languages, nfvcb_rating,
        is_featured, is_trending, release_type, created_at, release_date,
        youtube_watch_url,
        film_genres(genres(name))
      `)
      .eq('content_type', 'movie')
      .eq('year', 2026)
      .or('source.neq.mubi,source.is.null,countries.cs.{Nigeria}')
      .order('created_at', { ascending: false })
      .limit(20);

    if (!error && data) {
      setNewReleases(data.map(f => ({
        ...f,
        genres: f.film_genres?.map(fg => fg.genres?.name).filter(Boolean) || []
      })));
    }
  };

  const fetchNewToStream = async () => {
    // Automatic sync entries and admin overrides share one ordered queue.
    const cols = `
      id, slug, title, poster_url, backdrop_url, year, language, genres,
      synopsis, tagline, runtime_minutes, view_count, average_rating, liked_percent, languages,
      audience_rating, tmdb_rating, nfvcb_rating, content_type,
      is_featured, is_trending, release_type, streaming_links, source,
      youtube_watch_url, created_at, release_date,
      film_genres(genres(name))
    `;
    const withGenres = (f) => {
      const relatedGenres = f.film_genres?.map(fg => fg.genres?.name).filter(Boolean) || [];
      return {
        ...f,
        genres: relatedGenres.length > 0 ? relatedGenres : (Array.isArray(f.genres) ? f.genres.filter(Boolean) : [])
      };
    };

    const map = {};
    NEW_STREAM_IDS.forEach(id => { map[id] = []; });

    const { data: queued, error: queueError } = await supabase
      .rpc('get_platform_new_releases', { p_platforms: NEW_STREAM_IDS });

    if (queueError) console.error('Error fetching New to Stream queue:', queueError);

    const orderedQueue = [...(queued || [])].sort((a, b) => {
      if (a.platform !== b.platform) return a.platform.localeCompare(b.platform);
      if (a.display_order !== b.display_order) return a.display_order - b.display_order;
      return new Date(b.film?.created_at || b.queue_created_at) - new Date(a.film?.created_at || a.queue_created_at);
    });

    orderedQueue.forEach(row => {
      if (row.film && map[row.platform]) map[row.platform].push(withGenres(row.film));
    });

    // Keep a resilient read-only fallback while a migration is deploying or a
    // newly added platform has not completed its first queue refresh.
    await Promise.all(NEW_STREAM_IDS.map(async (id) => {
      if (map[id].length > 0) return;
      const { data } = await supabase
        .from('films')
        .select(cols)
        .or(platformFilter(id))
        .or('source.neq.mubi,source.is.null,countries.cs.{Nigeria}')
        .order('created_at', { ascending: false })
        .limit(10);
      map[id] = (data || []).map(withGenres).slice(0, 10);
    }));

    NEW_STREAM_IDS.forEach(id => { map[id] = map[id].slice(0, 10); });

    setNewToStream(map);
  };

  const fetchInCinemasData = async () => {
    const cinemaClock = getZonedClock();
    const tomorrow = getNextDate(cinemaClock.date);
    const withGenres = (f) => ({
      ...f,
      genres: f.film_genres?.map(fg => fg.genres?.name).filter(Boolean) || []
    });

    // Build the complete set of films that still have an upcoming showtime.
    const stRows = [];
    let showtimePage = 0;

    while (true) {
      const pageStart = showtimePage * CINEMA_SHOWTIME_PAGE_SIZE;
      const { data: pageRows, error: showtimeError } = await supabase
        .from('showtimes')
        .select('film_id, cinema_id, show_date, show_time, cinemas(id, name, city, chain)')
        .gte('show_date', cinemaClock.date)
        .eq('is_available', true)
        .order('show_date', { ascending: true })
        .order('show_time', { ascending: true })
        .range(pageStart, pageStart + CINEMA_SHOWTIME_PAGE_SIZE - 1);

      if (showtimeError) {
        console.error('Error fetching cinema showtimes:', showtimeError);
        return;
      }

      stRows.push(...(pageRows || []));
      if (!pageRows || pageRows.length < CINEMA_SHOWTIME_PAGE_SIZE) break;
      showtimePage += 1;
    }

    // Showtimes are stored as local cinema dates/times. Compare them with the
    // current WAT clock, then find the earliest remaining show across cinemas.
    const futureShowtimes = (stRows || []).filter(showtime => isFutureShowtime(showtime, cinemaClock));
    const nowIds = new Set(futureShowtimes.map(r => r.film_id).filter(Boolean));
    const nextShowByFilm = {};
    const todayShowtimesByFilm = {};
    const futureShowtimeCountByFilm = {};
    futureShowtimes.forEach(showtime => {
      futureShowtimeCountByFilm[showtime.film_id] = (futureShowtimeCountByFilm[showtime.film_id] || 0) + 1;

      if (showtime.show_date === cinemaClock.date) {
        if (!todayShowtimesByFilm[showtime.film_id]) todayShowtimesByFilm[showtime.film_id] = new Set();
        todayShowtimesByFilm[showtime.film_id].add(`${showtime.cinema_id}:${showtime.show_time}`);
      }

      const current = nextShowByFilm[showtime.film_id];
      if (!current || compareShowtimes(showtime, current) < 0) {
        nextShowByFilm[showtime.film_id] = {
          ...showtime,
          is_today: showtime.show_date === cinemaClock.date,
          is_tomorrow: showtime.show_date === tomorrow
        };
      }
    });

    // A future date keeps the film visible after today's last show has passed.
    let nowFilms = [];
    if (nowIds.size > 0) {
      const { data } = await supabase
        .from('films')
        .select(`*, film_genres(genres(name))`)
        .in('id', Array.from(nowIds))
        // Newest cinema arrivals first: a freshly-fetched title leads the slider
        // so viewers slide right to reach the ones already showing.
        .order('created_at', { ascending: false });
      const candidates = (data || []).map(film => ({
        ...withGenres(film),
        next_showtime: nextShowByFilm[film.id] || null,
        remaining_today_showtime_count: todayShowtimesByFilm[film.id]?.size || 0,
        future_showtime_count: futureShowtimeCountByFilm[film.id] || 0
      }));

      // Cinema chains frequently spell the same title differently (for example,
      // "Remi & Nneoma" versus "Remi And Nneoma"). Keep one card per title and
      // combine its showtime signal, preferring the best-supported catalog row.
      const uniqueFilms = new Map();
      candidates.forEach(candidate => {
        const key = cinemaFilmKey(candidate.title) || candidate.id;
        const existing = uniqueFilms.get(key);
        if (!existing) {
          uniqueFilms.set(key, candidate);
          return;
        }

        const primary = candidate.future_showtime_count > existing.future_showtime_count
          ? candidate
          : existing;
        const firstNextShow = [existing.next_showtime, candidate.next_showtime]
          .filter(Boolean)
          .sort(compareShowtimes)[0] || null;

        uniqueFilms.set(key, {
          ...primary,
          next_showtime: firstNextShow,
          remaining_today_showtime_count:
            existing.remaining_today_showtime_count + candidate.remaining_today_showtime_count,
          future_showtime_count: existing.future_showtime_count + candidate.future_showtime_count
        });
      });

      nowFilms = Array.from(uniqueFilms.values());
    }

    setInCinemas(nowFilms);
  };

  const fetchComingSoon = async (attempt = 0) => {
    const { data, error } = await supabase.rpc('get_coming_soon_films', { p_limit: 20 });

    if (error) {
      if (attempt === 0 && error.code === '57014') {
        await new Promise(r => setTimeout(r, 1500));
        return fetchComingSoon(attempt + 1);
      }
      console.error('Error fetching coming soon:', error);
      setIsComingSoonLoading(false);
      return;
    }

    if (data) {
      const normalizedFilms = data.map(f => ({
        ...f,
        genres: Array.isArray(f.genres) ? f.genres.filter(Boolean) : []
      }));
      setComingSoon(normalizedFilms);
      setIsComingSoonLoading(false);
    }
    setIsComingSoonLoading(false);
  };

  const fetchCuratedCollection = async () => {
    const { data: collection } = await supabase
      .from('collections')
      .select(`
        *,
        collection_films(
          display_order,
          films(*, film_genres(genres(name)))
        )
      `)
      .eq('is_featured', true)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (collection) {
      const films = (collection.collection_films || [])
        .sort((a, b) => a.display_order - b.display_order)
        .map(cf => ({
          ...cf.films,
          genres: cf.films?.film_genres?.map(fg => fg.genres?.name).filter(Boolean) || []
        }))
        .filter(f => f.id && (f.source !== 'mubi' || (f.countries && Array.isArray(f.countries) && f.countries.includes('Nigeria'))));
      
      setCuratedCollection({ ...collection, films });
    }
  };

  const fetchSpotlightContent = async () => {
    const { data, error } = await supabase
      .from('spotlights')
      .select(`
        *,
        people (*)
      `)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    
    if (error) {
      console.error('Error fetching spotlight content:', error);
      return;
    }

    if (data) {
      if (data.featured_film_ids && data.featured_film_ids.length > 0) {
        const { data: filmsData, error: filmsErr } = await supabase
          .from('films')
          .select('id, slug, title, poster_url, release_type, source, year')
          .in('id', data.featured_film_ids);
        
        if (!filmsErr && filmsData) {
          const sortedFilms = data.featured_film_ids
            .map(id => filmsData.find(f => f.id === id))
            .filter(Boolean);
          
          setSpotlightContent({
            ...data,
            featured_films: sortedFilms
          });
        } else {
          setSpotlightContent({
            ...data,
            featured_films: []
          });
        }
      } else {
        setSpotlightContent({
          ...data,
          featured_films: []
        });
      }
    } else {
      setSpotlightContent(null);
    }
  };

  const fetchTop10Films = async () => {
    const { data, error } = await supabase
      .from('top_10_films')
      .select(`
        rank,
        films (
          id, slug, title, poster_url, backdrop_url, year, language, synopsis,
          runtime_minutes, view_count, average_rating, liked_percent, languages, audience_rating, audience_rating_count,
          tmdb_rating, nfvcb_rating, content_type, episode_count, season_count, release_date,
          is_featured, is_trending, release_type, created_at,
          film_genres(genres(name))
        )
      `)
      .order('rank', { ascending: true })
      .limit(10);
      
    if (!error && data) {
      setTop10Films(data.filter(item => item.films).map(item => ({
        ...item.films,
        genres: item.films.film_genres?.map(fg => fg.genres?.name).filter(Boolean) || [],
        rank: item.rank
      })));
    }
  };

  const fetchCrewMembers = async () => {
    const { data, error } = await supabase
      .from('people')
      .select('*')
      .not('known_for_department', 'in', '("Acting","Directing","Skit Maker","Unknown")')
      .order('popularity_score', { ascending: false })
      .limit(12);

    if (!error && data) {
      setCrewMembers(data);
    }
  };

  const fetchCompanies = async () => {
    const { data, error } = await supabase
      .from('companies')
      .select(`
        *,
        film_companies(film_id)
      `)
      .limit(12);

    if (!error && data) {
      setProductionCompanies(data);
    }
  };

  const fetchYoutubeFeed = async () => {
    // Free on YouTube = all fetched YouTube movies, newest first
    const { data } = await supabase
      .from('films')
      .select(`
        id, slug, title, poster_url, backdrop_url, year, language, genres,
        runtime_minutes, view_count, average_rating, liked_percent, languages, audience_rating, tmdb_rating, nfvcb_rating, synopsis, tagline,
        is_featured, is_trending, release_type, created_at, release_date,
        youtube_watch_url,
        film_genres(genres(name))
      `)
      .eq('source', 'youtube')
      .eq('content_type', 'movie')
      .gte('created_at', new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString())
      .order('created_at', { ascending: false })
      .limit(20);

    if (data) {
      const mapped = data.map(f => {
        const relatedGenres = f.film_genres?.map(fg => fg.genres?.name).filter(Boolean) || [];
        return {
          ...f,
          genres: relatedGenres.length > 0 ? relatedGenres : (Array.isArray(f.genres) ? f.genres.filter(Boolean) : []),
          channel_name: 'YouTube Featured'
        };
      });
      setYoutubeFeed(mapped);
    }
  };

  const fetchRecentlyAdded = async () => {
    // Recently Added = all newly added films from all sources (netflix, prime, youtube, docuth, kava, cinema, etc.)
    const { data, error } = await supabase
      .from('films')
      .select(`
        id, slug, title, poster_url, backdrop_url, year, language,
        runtime_minutes, view_count, average_rating, liked_percent, languages, nfvcb_rating,
        is_featured, is_trending, release_type, created_at, release_date,
        youtube_watch_url,
        film_genres(genres(name))
      `)
      .or('source.neq.mubi,source.is.null,countries.cs.{Nigeria}')
      .order('created_at', { ascending: false })
      .limit(20);

    if (!error && data) {
      setRecentlyAdded(data.map(f => ({
        ...f,
        genres: f.film_genres?.map(fg => fg.genres?.name).filter(Boolean) || []
      })));
    }
  };

  const fetchPeople = async () => {
    const { data } = await supabase
      .from('people')
      .select('*')
      .eq('is_spotlight', true)
      .order('popularity_score', { ascending: false })
      .limit(4);
    
    if (data && data.length > 0) {
      setSpotlightPerson(data[0]);
      setOtherPeople(data.slice(1));
    }
  };

  const fetchCreators = async () => {
    const { data } = await supabase
      .from('people')
      .select('*')
      .eq('is_spotlight', true)
      .or('youtube_handle.neq.null,youtube_handle.neq."",youtube_channel_id.neq.null,youtube_channel_id.neq.""')
      .order('popularity_score', { ascending: false })
      .limit(6);
    if (data) setCreators(data);
  };

  const filteredYoutube = youtubeFeed.filter(film => {
    if (youtubeFilter === 'All') return true;
    const runtime = film.runtime_minutes || 0;
    if (youtubeFilter === 'Skits') return runtime > 0 && runtime < 15;
    if (youtubeFilter === 'Movies') return runtime >= 15;
    return true;
  });

  const handleExternalClick = (e, url) => {
    if (!url || url === '#') return;
    const hideWarning = localStorage.getItem('MuviDB_hide_external_warning') === 'true';
    if (hideWarning) {
      return; // Let the browser open the link normally
    }
    
    e.preventDefault();
    setExternalUrl(url);
    setIsWarningModalOpen(true);
  };

  const proceedToExternal = () => {
    if (dontShowAgain) {
      localStorage.setItem('MuviDB_hide_external_warning', 'true');
    }
    window.open(externalUrl, '_blank', 'noopener,noreferrer');
    setIsWarningModalOpen(false);
  };

  // What's New consolidated tabs
  const whatsNewMap = { coming: comingSoon, new: newReleases, recent: recentlyAdded };

  // Cover art for the "Where to watch" rail is best-effort: pick from the rails we
  // already loaded instead of pulling the entire catalogue. Any platform without a
  // match falls back to its gradient (handled inside PlatformRail).
  const platformCoverPool = [
    ...featuredFilms,
    ...recentlyAdded,
    ...(newToStream.netflix || []),
    ...newReleases,
    ...top10Films,
  ];

  return (
    <div className="muvi-landing w-full pb-20 min-h-screen">
      {/* 1. HERO (Progressive Above-the-Fold Loading) (Issue 1) */}
      <HeroSection
        featuredFilms={featuredFilms}
        isLoading={isHeroLoading}
      />

      <div className="muvi-landing-shell max-w-7xl mx-auto">
        {/* 2. WHERE TO WATCH (signature, top-level entry point) */}
        <div className="landing-band grided watch-platform-band">
          <PlatformRail films={platformCoverPool} counts={platformCounts} />
        </div>

        {/* 3. IN CINEMAS NOW (promoted — larger cards + showtimes CTA) */}
        {(isCinemaLoading || inCinemas.length > 0) && (
          <div className="landing-band panel py-8 md:py-10">
            <FilmRow
              title="In Cinemas"
              subtitle="Upcoming screenings across cinemas near you"
              films={inCinemas}
              isLoading={isCinemaLoading}
              linkTo="/showtimes"
              cardVariant="cinema"
            />
          </div>
        )}

        {/* 6b. NEW RELEASES (landscape single slideable row) */}
        {(isLoading || newReleases.length > 0) && (
          <div className="landing-band alt py-8 md:py-10">
            <FilmRow
              title="New Releases"
              subtitle="Just dropped — the latest additions"
              films={newReleases}
              isLoading={isLoading}
              linkTo="/browse?sort=newest"
              cardVariant="landscape"
            />
          </div>
        )}

        {/* 4. STREAMING RAILS (turn watch-link data into a browse axis) */}
        {(isLoading || NEW_STREAM_IDS.some(id => (newToStream[id] || []).length > 0)) && (
          <div className="landing-band alt grided py-8 md:py-10">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-20">
              <div className="flex items-end justify-between gap-4 mb-6">
                <div className="space-y-1.5">
                  <p className="text-text-muted text-[10px] font-bold uppercase tracking-[0.25em]">Just added — stream tonight</p>
                  <h2 className="font-heading text-3xl md:text-[2.5rem] font-bold text-text-primary tracking-tight leading-none">New to Stream</h2>
                </div>
                <Link
                  to={`/watch/${streamTab}`}
                  className="group/see shrink-0 inline-flex items-center gap-1.5 text-text-secondary hover:text-brand text-xs font-bold tracking-wide transition-colors whitespace-nowrap pb-1"
                >
                  See all
                  <Icon icon="solar:alt-arrow-right-linear" className="w-4 h-4 transition-transform duration-300 group-hover/see:translate-x-1" />
                </Link>
              </div>
              <div className="flex gap-2.5 overflow-x-auto pb-1 scrollbar-hide">
                {NEW_STREAM.map(p => {
                  const active = streamTab === p.id;
                  return (
                    <button
                      key={p.id}
                      onClick={() => setStreamTab(p.id)}
                      className={`shrink-0 flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold border transition-all duration-200 ${
                        active ? 'bg-brand border-brand text-white' : 'bg-surface border-border text-text-secondary hover:border-brand/40 hover:text-text-primary'
                      }`}
                    >
                      <Icon icon={p.icon} className="text-sm" style={{ color: active ? '#fff' : p.color }} />
                      {p.name}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="mt-6 md:mt-7">
              <FilmRow
                films={newToStream[streamTab] || []}
                isLoading={isLoading}
                noHeader
                cardVariant="streaming"
                platform={streamTab}
              />
            </div>
          </div>
        )}
        {(isLoading || featuredSeries.length > 0) && (
          <div className="landing-band alt py-8 md:py-10">
            <FilmRow
              title="Popular TV Shows & Series"
              subtitle="Must-watch African series and episodes"
              films={featuredSeries}
              isLoading={isLoading}
              linkTo="/tv-shows"
            />
          </div>
        )}
        {(isLoading || youtubeFeed.length > 0) && (
          <div className="landing-band panel py-8 md:py-10">
            <FilmRow
              title="Free on YouTube"
              subtitle="No subscription needed"
              films={youtubeFeed}
              isLoading={isLoading}
              linkTo="/watch/youtube"
              cardVariant="youtube"
            />
          </div>
        )}
        {/* 5. TOP 10 THIS WEEK */}
        {(isLoading || top10Films.length > 0) && (
          <div className="landing-band panel py-8 md:py-10">
            <TopTenSection
              title="Top 10 This Week"
              subtitle="The most-watched Nollywood stories right now"
              films={top10Films}
              isLoading={isLoading}
            />
          </div>
        )}

        {/* 6a. COMING SOON (keep existing horizontal scroll cards) */}
        {(isLoading || isComingSoonLoading || comingSoon.length > 0) && (
          <div className="landing-band panel py-8 md:py-10">
            <FilmRow
              title="Coming Soon"
              subtitle="Upcoming releases to look forward to"
              films={comingSoon}
              isLoading={isLoading || isComingSoonLoading}
              linkTo="/browse?sort=upcoming"
              cardVariant="coming-soon"
            />
          </div>
        )}

        {/* 6c. RECENTLY ADDED (landscape single slideable row) */}
        {(isLoading || recentlyAdded.length > 0) && (
          <div className="landing-band panel py-8 md:py-10">
            <FilmRow
              title="Recently Added"
              subtitle="Fresh to the database — explore new additions"
              films={recentlyAdded}
              isLoading={isLoading}
              linkTo="/browse?sort=recent"
              cardVariant="landscape"
            />
          </div>
        )}

        {/* 7. GENRE MOODS (visual poster grid) */}
        <div className="landing-band alt grided">
          <GenreRail variant="poster-grid" />
        </div>

        {/* 8. CURATED PICK (editorial film row — discovery) */}
        {curatedCollection && curatedCollection.films.length > 0 && (
          <div className="landing-band alt py-14 md:py-16 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-brand/10 blur-[100px] rounded-full -mr-32 -mt-32"></div>
            <FilmRow
              title={curatedCollection.name}
              subtitle={curatedCollection.description}
              films={curatedCollection.films}
              isLoading={isLoading}
            />
          </div>
        )}

        {/* ===================== EDITORIAL ZONE (the Nollywood moat — magazine treatment) ===================== */}
        <div className="landing-band alt grided">

          {/* — Zone label: People of Nollywood — */}
          <div className="landing-zone-label max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <span>People of Nollywood</span>
            <span />
          </div>

        {/* 9. SPOTLIGHT (Editorial) */}
        {(isLoading || spotlightContent) && (
          <div className="relative z-10 border-b border-hairline py-14 md:py-16 bg-surface/40">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="flex items-center gap-2 mb-10">
                <Icon icon="solar:star-linear" className="text-brand text-xl" />
                <h2 className="font-heading font-bold text-2xl md:text-3xl text-text-primary tracking-tighter">
                  Spotlight
                </h2>
              </div>

              <div className="landing-module relative rounded-lg overflow-hidden">
                {isLoading ? (
                  <div className="h-[400px] animate-pulse bg-surface-2" />
                ) : spotlightContent && spotlightContent.people && (
                  <div className="flex flex-col md:flex-row items-stretch min-h-[400px]">
                    {/* 1. Artist Photo Cover (Left Pane) */}
                    <div className="w-full md:w-[28%] relative h-64 md:h-auto overflow-hidden bg-surface-2 shrink-0">
                      <ImageWithFallback
                        src={spotlightContent.photo_url || spotlightContent.people.photo_url}
                        alt={spotlightContent.people.name}
                        fallbackType="avatar"
                        name={spotlightContent.people.name}
                        className="absolute inset-0 w-full h-full object-cover"
                        width={640}
                        sizes="(max-width: 767px) 100vw, 28vw"
                        loading="lazy"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t md:bg-gradient-to-r from-black/40 via-transparent to-black/20 pointer-events-none" />
                    </div>

                    {/* 2. Editorial Story & Info (Middle Pane) */}
                    <div className="w-full md:w-[42%] p-6 md:p-8 flex flex-col justify-center shrink-0">
                      <span className="text-brand text-[9px] font-black uppercase tracking-widest mb-2 block">
                        Spotlight
                      </span>
                      <Link
                        to={`/people/${spotlightContent.people.slug || spotlightContent.people.id}`}
                        className="font-heading font-bold text-3xl md:text-4xl text-text-primary tracking-tighter mb-4 block hover:text-brand transition-colors"
                      >
                        {spotlightContent.people.name}
                      </Link>
                      <p className="text-text-secondary text-xs md:text-sm mb-8 leading-relaxed whitespace-pre-wrap line-clamp-6 text-justify">
                        {spotlightContent.story}
                      </p>
                      <div>
                        <Link
                          to={`/people/${spotlightContent.people.slug || spotlightContent.people.id}`}
                          className="inline-flex items-center gap-2 px-5 py-2.5 bg-surface-2 hover:bg-brand/10 hover:text-brand border border-hairline rounded-lg text-[10px] font-black uppercase tracking-widest text-text-primary transition-all"
                        >
                          Explore More
                          <Icon icon="solar:arrow-right-linear" className="w-3.5 h-3.5" />
                        </Link>
                      </div>
                    </div>

                    {/* 3. Pane Divider */}
                    <div className="hidden md:block w-px bg-border my-8 shrink-0" />

                    {/* 4. Featured Works (Right Pane) */}
                    <div className="w-full md:w-[30%] p-6 md:p-8 flex flex-col justify-center flex-1">
                      <h3 className="text-text-muted text-[10px] font-black uppercase tracking-widest mb-6">
                        Featured Works
                      </h3>
                      {spotlightContent.featured_films && spotlightContent.featured_films.length > 0 ? (
                        <div className="grid grid-cols-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2 sm:gap-3">
                          {spotlightContent.featured_films.map((film) => (
                            <Link
                              key={film.id}
                              to={`/films/${film.slug || film.id}`}
                              className="group flex flex-col gap-1.5 transition-all"
                              title={film.title}
                            >
                              <div className="aspect-[2/3] w-full rounded-lg overflow-hidden border border-hairline bg-surface-2 relative shadow-md">
                                <ImageWithFallback
                                  src={film.poster_url}
                                  alt={film.title}
                                  fallbackType="banner"
                                  name={film.title}
                                  className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                                  width={256}
                                  sizes="(max-width: 767px) 22vw, 100px"
                                  loading="lazy"
                                />
                                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end p-2">
                                  <span className="text-[8px] font-bold text-white line-clamp-2 leading-tight">
                                    {film.title}
                                  </span>
                                </div>
                              </div>
                            </Link>
                          ))}
                        </div>
                      ) : (
                        <div className="rounded-lg border border-dashed border-hairline p-6 text-center text-xs text-text-muted py-8">
                          No featured works curated.
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* 10. & 11. FEATURED TALENT (Artist & Crew Tabs) */}
        {(isLoading || spotlightPerson || crewMembers.length > 0) && (
          <div className="relative z-10 border-b border-hairline">
            <section className="py-16">
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex flex-col md:flex-row md:items-end justify-between mb-10 gap-4">
                  <div className="space-y-1">
                    <h2 className="font-heading font-bold text-2xl md:text-3xl text-text-primary tracking-tighter">
                      Featured Talent
                    </h2>
                    <p className="text-text-muted text-[10px] font-bold uppercase tracking-widest mt-1 opacity-60">The creative force of Nollywood</p>
                  </div>
                  
                  {/* Talent Tabs */}
                  <div className="flex items-center gap-6 border-b border-hairline pb-2 self-start md:self-auto">
                    <button
                      onClick={() => setFeaturedTalentTab('artist')}
                      className={`text-[11px] font-bold uppercase tracking-widest pb-2 -mb-[9px] transition-colors relative ${featuredTalentTab === 'artist' ? 'text-brand' : 'text-text-muted hover:text-text-primary'}`}
                    >
                      Featured Artist
                      {featuredTalentTab === 'artist' && <span className="absolute bottom-0 left-0 w-full h-[2px] bg-brand"></span>}
                    </button>
                    <button
                      onClick={() => setFeaturedTalentTab('crew')}
                      className={`text-[11px] font-bold uppercase tracking-widest pb-2 -mb-[9px] transition-colors relative ${featuredTalentTab === 'crew' ? 'text-brand' : 'text-text-muted hover:text-text-primary'}`}
                    >
                      Behind the Magic
                      {featuredTalentTab === 'crew' && <span className="absolute bottom-0 left-0 w-full h-[2px] bg-brand"></span>}
                    </button>
                  </div>

                  <Link
                    to={featuredTalentTab === 'artist' ? "/people" : "/people?craft=crew"}
                    className="text-brand text-[10px] font-bold uppercase tracking-widest hover:underline hidden md:block"
                  >
                    View all {featuredTalentTab === 'artist' ? 'Artists' : 'Crew'}
                  </Link>
                </div>

                {/* Tab Content: Featured Artist */}
                {featuredTalentTab === 'artist' && (
                  <div className="landing-module relative rounded-lg p-8 md:p-12 overflow-hidden page-fade-in">
                    <div className="absolute inset-0 grid-bg opacity-10 pointer-events-none"></div>
                    <div className="relative z-10 flex flex-col xl:flex-row gap-12 xl:items-center">
                      <div className="xl:flex-1">
                        <PersonCard person={spotlightPerson} variant="full" isLoading={isLoading} />
                      </div>
                      <div className="h-px xl:w-px xl:h-64 bg-border"></div>
                      <div className="w-full xl:w-80 grid grid-cols-1 sm:grid-cols-3 xl:grid-cols-2 gap-4">
                        {isLoading ? (
                          [...Array(4)].map((_, i) => (
                            <PersonCard key={i} variant="compact" isLoading={true} />
                          ))
                        ) : (
                          otherPeople.map(person => (
                            <PersonCard key={person.id} person={person} variant="compact" />
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Tab Content: Behind the Magic (Crew) */}
                {featuredTalentTab === 'crew' && (
                  <div className="flex overflow-x-auto gap-6 pb-6 pt-2 scrollbar-hide touch-pan-x page-fade-in">
                    {isLoading ? (
                      [...Array(6)].map((_, i) => (
                        <div key={i} className="shrink-0 w-44 bg-surface border border-hairline rounded-2xl p-5 text-center flex flex-col items-center gap-4">
                          <div className="w-24 h-24 rounded-full bg-surface-2 animate-pulse" />
                          <div className="w-24 h-4 bg-surface-2 animate-pulse rounded" />
                          <div className="w-16 h-3 bg-surface-2 animate-pulse rounded" />
                        </div>
                      ))
                    ) : (
                      crewMembers.map((crew) => (
                        <Link
                          key={crew.id}
                          to={`/people/${crew.slug || crew.id}`}
                          className="shrink-0 w-44 bg-surface border border-hairline hover:border-brand rounded-2xl p-5 text-center transition-all group shadow-sm flex flex-col items-center gap-4"
                        >
                          <div className="relative">
                            <ImageWithFallback
                              src={crew.photo_url}
                              alt={crew.name}
                              fallbackType="avatar"
                              name={crew.name}
                              className="w-24 h-24 rounded-full object-cover border-2 border-transparent group-hover:border-brand transition-all duration-300"
                              width={192}
                              sizes="96px"
                              loading="lazy"
                            />
                          </div>
                          <div className="space-y-2 w-full">
                            <h3 className="font-bold text-text-primary text-sm group-hover:text-brand transition-colors line-clamp-1">
                              {crew.name}
                            </h3>
                            <span className="inline-block bg-brand/10 text-brand text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full">
                              {crew.known_for_department || 'Crew'}
                            </span>
                          </div>
                        </Link>
                      ))
                    )}
                  </div>
                )}
                
                {/* Mobile View All Link */}
                <div className="mt-6 md:hidden">
                  <Link
                    to={featuredTalentTab === 'artist' ? "/people" : "/people?craft=crew"}
                    className="text-brand text-[10px] font-bold uppercase tracking-widest hover:underline"
                  >
                    View all {featuredTalentTab === 'artist' ? 'Artists' : 'Crew'}
                  </Link>
                </div>

              </div>
            </section>
          </div>
        )}


          {/* — Zone label: The Industry — */}
          <div className="landing-zone-label max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <span>The Industry</span>
            <span />
          </div>

        {/* 12. NOLLYWOOD STUDIOS (Production Companies) */}
        {(isLoading || productionCompanies.length > 0) && (
          <div className="relative z-10 border-b border-hairline py-14 md:py-16 bg-surface/30">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="flex items-end justify-between mb-12">
                <div className="space-y-1">
                  <h2 className="font-heading font-bold text-2xl md:text-3xl text-text-primary tracking-tighter">
                    Nollywood Studios
                  </h2>
                  <p className="text-text-muted text-[10px] font-bold uppercase tracking-widest mt-1 opacity-65">
                    The creative production powerhouses
                  </p>
                </div>
                <Link to="/companies" className="text-brand text-[10px] font-bold uppercase tracking-widest hover:underline">
                  View all
                </Link>
              </div>

              <div className="flex overflow-x-auto gap-6 pb-6 pt-2 scrollbar-hide touch-pan-x">
                {isLoading ? (
                  [...Array(4)].map((_, i) => (
                    <div key={i} className="shrink-0 w-64 bg-surface border border-hairline rounded-2xl p-6 flex flex-col gap-4">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-surface-2 animate-pulse shrink-0" />
                        <div className="space-y-2 flex-1">
                          <div className="h-4 w-2/3 bg-surface-2 animate-pulse rounded" />
                          <div className="h-3 w-1/3 bg-surface-2 animate-pulse rounded" />
                        </div>
                      </div>
                      <div className="h-3 w-1/2 bg-surface-2 animate-pulse rounded pt-2" />
                    </div>
                  ))
                ) : (
                  productionCompanies.map((company) => {
                    const initial = company.name?.charAt(0);
                    const filmCount = company.film_companies?.length || 0;
                    return (
                      <div 
                        key={company.id}

                        className="shrink-0 w-64 bg-surface border border-hairline hover:border-brand rounded-2xl p-6 transition-all group shadow-sm flex flex-col gap-4"
                      >
                        <div className="flex items-center gap-4">
                          {company.logo_url ? (
                            <div className="w-12 h-12 rounded-xl bg-white p-1 border border-hairline flex items-center justify-center overflow-hidden shrink-0">
                              <ImageWithFallback
                                src={company.logo_url} 
                                alt={company.name}
                                fallbackType="avatar"
                                name={company.name}
                                className="w-full h-full object-contain group-hover:scale-110 transition-transform duration-500"
                                width={96}
                                sizes="48px"
                                loading="lazy"
                              />
                            </div>
                          ) : (
                            <div className="w-12 h-12 rounded-xl bg-surface-2 flex items-center justify-center text-lg font-bold text-brand font-heading border border-hairline shrink-0">
                              {initial}
                            </div>
                          )}
                          <div className="min-w-0">
                            <h3 className="font-bold text-text-primary text-xs tracking-tight group-hover:text-brand transition-colors line-clamp-1 leading-tight">
                              {toTitleCase(company.name)}
                            </h3>
                            {company.founded_year && (
                              <p className="text-text-muted text-[8px] font-black uppercase tracking-widest mt-0.5 opacity-60">
                                EST. {company.founded_year}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="pt-2 border-t border-hairline flex items-center gap-1.5">
                          <Icon icon="solar:clapperboard-play-linear" className="text-text-muted text-xs" />
                          <span className="text-text-muted text-[8px] font-black uppercase tracking-widest">
                            {filmCount} {filmCount === 1 ? 'Film' : 'Films'} Produced
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        )}

        {/* 13. FEATURED CHANNELS */}
        {(isLoading || creators.length > 0) && (
          <div className="relative z-10 border-b border-hairline bg-surface/40 overflow-hidden">
             <div className="absolute inset-0 grid-bg opacity-10 pointer-events-none"></div>
            <section className="py-16 relative z-10">
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex items-end justify-between mb-12">
                  <div className="space-y-1">
                    <h2 className="font-heading font-bold text-2xl md:text-3xl text-text-primary tracking-tighter">
                      Featured Channels
                    </h2>
                    <p className="text-text-muted text-[10px] font-bold uppercase tracking-widest mt-1 opacity-60">The storytellers of YouTube</p>
                  </div>
                  <Link to="/channels" className="text-brand text-[10px] font-bold uppercase tracking-widest hover:underline">View all</Link>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 border-t border-l border-hairline rounded-xl overflow-hidden shadow-sm">
                  {isLoading ? (
                    [...Array(6)].map((_, i) => (
                      <div key={i} className="bg-surface p-8 border-r border-b border-hairline flex items-center gap-5">
                        <div className="w-16 h-16 rounded-lg bg-surface-2 animate-shimmer shrink-0"></div>
                        <div className="flex-1 space-y-3">
                          <div className="w-2/3 h-5 bg-surface-2 animate-shimmer rounded"></div>
                          <div className="w-1/2 h-3 bg-surface-2 animate-shimmer rounded opacity-60"></div>
                        </div>
                      </div>
                    ))
                  ) : (
                    creators.map((creator) => {
                      const stats = creator.youtube_stats || {};
                      const channelUrl = getPersonYoutubeChannelUrl(creator);
                      return (
                        <a 
                          key={creator.id}
                          href={channelUrl || '#'}
                          onClick={(e) => handleExternalClick(e, channelUrl)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="group bg-surface p-8 hover:bg-surface-2/50 transition-all duration-500 flex flex-col gap-6 border-r border-b border-hairline animate-in fade-in"
                        >
                          <div className="flex items-center gap-5">
                            <ImageWithFallback
                              src={stats.thumbnail || creator.photo_url}
                              alt={creator.name} 
                              fallbackType="avatar"
                              name={creator.name}
                              className="w-16 h-16 rounded-lg object-cover shadow-sm border border-hairline group-hover:scale-105 transition-transform" 
                              width={128}
                              sizes="64px"
                              loading="lazy"
                            />
                            <div>
                              <h3 className="text-lg font-black text-text-primary group-hover:text-brand transition-colors tracking-tight flex items-center gap-1.5">
                                {creator.name}
                                <Icon icon="solar:arrow-right-up-linear" className="text-xs opacity-40 group-hover:opacity-100 group-hover:text-brand transition-all shrink-0" />
                              </h3>
                              <div className="mt-2 flex items-center gap-4">
                                {(parseInt(stats.subscribers) > 0) && (
                                  <span className="text-[9px] font-bold text-brand">{parseInt(stats.subscribers).toLocaleString()} subs</span>
                                )}
                                {(parseInt(stats.videos) > 0) && (
                                  <span className="text-[9px] font-bold text-text-muted flex items-center gap-1.5">
                                    {parseInt(stats.videos).toLocaleString()} videos
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </a>
                      );
                    })
                  )}
                </div>
              </div>
            </section>
          </div>
        )}

        </div>{/* ===================== end editorial zone ===================== */}

        {/* 15. GENRE-SPECIFIC FILM SECTIONS */}
        {genreSections.length > 0 && (
          <div className="landing-band panel">
            {/* Zone label */}
            <div className="landing-zone-label max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <span>Browse by Genre</span>
              <span />
            </div>

            {genreSections.map((section) => (
              <div key={section.genre} className="border-b border-hairline py-10 md:py-12">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                  {/* Section header */}
                  <div className="flex items-end justify-between mb-6">
                    <h2 className="font-heading font-bold text-brand text-sm uppercase tracking-widest">
                      {section.genre}
                    </h2>
                    <Link
                      to={`/browse?genre=${encodeURIComponent(section.genre)}`}
                      className="group/see shrink-0 inline-flex items-center gap-1.5 text-text-secondary hover:text-brand text-xs font-bold tracking-wide transition-colors whitespace-nowrap"
                    >
                      See all
                      <Icon icon="solar:alt-arrow-right-linear" className="w-4 h-4 transition-transform duration-300 group-hover/see:translate-x-1" />
                    </Link>
                  </div>

                  {/* Film grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 md:gap-5">
                    {section.films.slice(0, 4).map((film) => (
                      <div key={film.id}>
                        <FilmCard film={film} variant="landscape" fullWidth={true} />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* 14. NEW MEMBER CTA BANNER (Issue 29) */}
        {!isAuthenticated && (
          <div className="landing-band alt grided px-4 sm:px-6 lg:px-8 py-14 md:py-16 border-t border-hairline/40">
            <div className="landing-module relative rounded-lg p-8 md:p-16 overflow-hidden text-center max-w-5xl mx-auto group">
              {/* Decorative Glow */}
              <div className="absolute -top-32 -left-32 w-96 h-96 bg-brand/10 rounded-full blur-[120px] transition-all group-hover:bg-brand/20 pointer-events-none"></div>
              <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-brand/10 rounded-full blur-[120px] transition-all group-hover:bg-brand/20 pointer-events-none"></div>
              
              <div className="relative z-10 max-w-2xl mx-auto space-y-6">
                <span className="text-brand text-xs font-bold tracking-[0.3em] uppercase block">Join the Nollywood Movement</span>
                <h2 className="font-heading font-bold text-3xl md:text-5xl text-text-primary tracking-tighter leading-tight">
                  Preserve the legacy. Celebrate the future.
                </h2>
                <p className="text-text-secondary text-sm md:text-base leading-relaxed">
                  Join MuviDB today to rate films, write reviews, follow your favourite artists, and build your own custom library of African cinematic excellence.
                </p>
                <div className="flex flex-wrap items-center justify-center gap-4 pt-4">
                  <Link 
                    to="/signup" 
                    className="bg-brand hover:bg-brand-hover text-white px-8 py-4 rounded-xl font-bold text-[11px] uppercase tracking-widest transition-all shadow-lg hover:shadow-brand/20 active:scale-95 shrink-0"
                  >
                    Join MuviDB
                  </Link>
                  <Link 
                    to="/browse" 
                    className="bg-white/5 hover:bg-white/10 text-text-primary border border-hairline px-8 py-4 rounded-xl font-bold text-[11px] uppercase tracking-widest transition-all active:scale-95 shrink-0"
                  >
                    Browse Database
                  </Link>
                </div>
              </div>
            </div>
          </div>
        )}

      </div>

      {/* 12. EXTERNAL LINK WARNING DIALOG MODAL (Issue 19) */}
      {isWarningModalOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 animate-in fade-in duration-300">
          {/* Backdrop */}
          <div 
            className="absolute inset-0 bg-black/85 backdrop-blur-sm"
            onClick={() => setIsWarningModalOpen(false)}
          />
          
          {/* Modal Content Card */}
          <div className="relative bg-surface border border-hairline rounded-3xl p-6 md:p-8 max-w-md w-full shadow-2xl z-10 space-y-6 animate-in zoom-in-95 duration-200">
            <div className="flex items-center gap-4 text-brand">
              <div className="w-12 h-12 rounded-2xl bg-brand/10 flex items-center justify-center text-brand">
                <Icon icon="solar:danger-triangle-linear" width="28" height="28" />
              </div>
              <h3 className="font-heading font-bold text-lg md:text-xl text-text-primary tracking-tight">
                Leaving MuviDB
              </h3>
            </div>
            
            <p className="text-text-secondary text-sm leading-relaxed">
              You are about to open an external YouTube channel in a new tab. MuviDB does not control external websites or content.
            </p>
            
            {/* Don't show again checkbox */}
            <label className="flex items-center gap-3 cursor-pointer select-none group w-fit">
              <input 
                type="checkbox"
                checked={dontShowAgain}
                onChange={(e) => setDontShowAgain(e.target.checked)}
                className="hidden"
              />
              <div className={`w-5 h-5 rounded border transition-all flex items-center justify-center ${dontShowAgain ? 'bg-brand border-brand' : 'border-hairline bg-surface-2 group-hover:border-brand/50'}`}>
                {dontShowAgain && <Icon icon="solar:check-read-linear" className="text-white text-xs" />}
              </div>
              <span className="text-xs text-text-muted font-bold group-hover:text-text-secondary transition-colors uppercase tracking-wider">
                Don't show this reminder again
              </span>
            </label>
            
            <div className="flex gap-4 pt-2">
              <button 
                onClick={() => setIsWarningModalOpen(false)}
                className="flex-1 bg-white/5 hover:bg-white/10 text-text-primary py-3.5 rounded-xl text-xs font-bold uppercase tracking-widest transition-all active:scale-95 border border-hairline"
              >
                Cancel
              </button>
              <button 
                onClick={proceedToExternal}
                className="flex-1 bg-brand hover:bg-brand-hover text-white py-3.5 rounded-xl text-xs font-bold uppercase tracking-widest transition-all active:scale-95 shadow-lg shadow-brand/10"
              >
                Proceed
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
