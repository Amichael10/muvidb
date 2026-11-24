import { useState, useEffect, useRef, useMemo, lazy, Suspense } from 'react';
import { useLoaderData, useNavigate, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { supabase } from '../lib/supabase';
import { PUBLIC_PERSON_COLUMNS, PUBLIC_FILM_COLUMNS } from '../lib/publicSelects';
import { useAuth } from '../context/AuthContext';
import { PLATFORMS, platformFilter } from '../lib/platforms';
import {
  getZonedClock,
  getNextDate,
  isPublicCinemaShowtime,
  compareShowtimes,
  isLiveCinemaFilm,
} from '../utils/showtimes';
import { fetchPlays } from '../lib/plays';
import { filterAndSortFreshStreaming } from '../lib/ranking';
import DeferredMount from '../components/ui/DeferredMount';
import HomeCommandHero from '../components/home/HomeCommandHero';
import HomeCinemaSection from '../components/home/HomeCinemaSection';
import HomeNewReleases from '../components/home/HomeNewReleases';
import HomeStreamingHub from '../components/home/HomeStreamingHub';
import HomeIndustryTools from '../components/home/HomeIndustryTools';
import HomeTheatreSection from '../components/home/HomeTheatreSection';
import HomeSponsoredBanner from '../components/home/HomeSponsoredBanner';
import HomeIndustryEcosystem from '../components/home/HomeIndustryEcosystem';

// Below-fold sections — lazy loaded to keep initial bundle lean
const CriticsLoungeSection = lazy(() => import('../components/film/CriticsLoungeSection'));
const HomeUpcomingSlate = lazy(() => import('../components/home/HomeUpcomingSlate'));
const HomePulseRails = lazy(() => import('../components/home/HomePulseRails'));

const STREAMING_PLATFORMS = PLATFORMS.filter((p) =>
  ['netflix', 'prime_video', 'kava', 'docuth', 'ebonylife', 'circuits', 'nollistream', 'homitv', 'filmporte'].includes(p.id)
);
const STREAMING_IDS = STREAMING_PLATFORMS.map((p) => p.id);
const CINEMA_SHOWTIME_PAGE_SIZE = 1000;

const cinemaFilmKey = (title = '') =>
  title
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\([^)]*\)/g, ' ')
    .replace(/\[[^\]]*\]/g, ' ')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');

const withNormalizedGenres = (f) => {
  const related = f.film_genres?.map((fg) => fg.genres?.name).filter(Boolean) || [];
  return {
    ...f,
    genres: related.length > 0 ? related : Array.isArray(f.genres) ? f.genres.filter(Boolean) : [],
  };
};

export default function Home() {
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const loaderData = useLoaderData() || {};

  // Above-the-fold Command Hero state (SSR-seeded)
  const [featuredFilms, setFeaturedFilms] = useState(loaderData.featuredFilms ?? []);
  const [boxOfficeRecent, setBoxOfficeRecent] = useState(loaderData.boxOfficeRecent ?? []);
  const [boxOfficeAllTime, setBoxOfficeAllTime] = useState(loaderData.boxOfficeAllTime ?? []);
  const [isHeroLoading, setIsHeroLoading] = useState(!(loaderData.featuredFilms?.length > 0));
  const [isBoxOfficeLoading, setIsBoxOfficeLoading] = useState(
    !(loaderData.boxOfficeAllTime?.length > 0 || loaderData.boxOfficeRecent?.length > 0)
  );

  // Core viewer utility sections
  const [inCinemas, setInCinemas] = useState([]);
  const [isCinemaLoading, setIsCinemaLoading] = useState(true);
  const [newReleases, setNewReleases] = useState([]);
  const [isNewReleasesLoading, setIsNewReleasesLoading] = useState(true);
  const [streamingByPlatform, setStreamingByPlatform] = useState({});
  const [youtubeFeed, setYoutubeFeed] = useState([]);
  const [isStreamingLoading, setIsStreamingLoading] = useState(true);

  // Below-fold sections (lazy mounted + fetched once near viewport)
  const secondaryFetched = useRef(false);
  const [comingSoon, setComingSoon] = useState([]);
  const [isComingSoonLoading, setIsComingSoonLoading] = useState(false);
  const [upcomingPlays, setUpcomingPlays] = useState([]);
  const [isPlaysLoading, setIsPlaysLoading] = useState(false);
  const [companies, setCompanies] = useState([]);
  const [talent, setTalent] = useState([]);
  const [crew, setCrew] = useState([]);
  const [birthdayPool, setBirthdayPool] = useState([]);
  const [isIndustryLoading, setIsIndustryLoading] = useState(false);

  // Single batched watchlist state for all cards on the page (avoids N+1 card queries)
  const [watchlistIds, setWatchlistIds] = useState(() => new Set());
  const [watchlistStreamingAlerts, setWatchlistStreamingAlerts] = useState([]);
  const [dismissedAlert, setDismissedAlert] = useState(false);

  useEffect(() => {
    if (!user?.id) {
      setWatchlistIds(new Set());
      setWatchlistStreamingAlerts([]);
      return;
    }
    let active = true;
    supabase
      .from('watchlist')
      .select('film_id, films(id, slug, title, coming_soon, youtube_watch_url, streaming_links)')
      .eq('user_id', user.id)
      .then(({ data }) => {
        if (active && Array.isArray(data)) {
          setWatchlistIds(new Set(data.map((row) => row.film_id)));
          const nowStreaming = data
            .map((row) => row.films)
            .filter(
              (f) =>
                f &&
                !f.coming_soon &&
                (f.youtube_watch_url ||
                  f.streaming_links?.netflix ||
                  f.streaming_links?.prime_video ||
                  f.streaming_links?.kava)
            )
            .slice(0, 3);
          setWatchlistStreamingAlerts(nowStreaming);
        }
      });
    return () => {
      active = false;
    };
  }, [user?.id]);

  const handleToggleWatchlist = async (film) => {
    if (!film?.id) return;
    if (!user?.id) {
      navigate('/login', { state: { from: `/films/${film.slug || film.id}` } });
      return;
    }

    const alreadySaved = watchlistIds.has(film.id);
    // Optimistic toggle
    setWatchlistIds((prev) => {
      const next = new Set(prev);
      if (alreadySaved) next.delete(film.id);
      else next.add(film.id);
      return next;
    });

    try {
      if (alreadySaved) {
        const { error } = await supabase
          .from('watchlist')
          .delete()
          .eq('user_id', user.id)
          .eq('film_id', film.id);
        if (error) throw error;
        toast.success(`Removed "${film.title}" from watchlist`);
      } else {
        const { error } = await supabase
          .from('watchlist')
          .insert({ user_id: user.id, film_id: film.id });
        if (error) throw error;
        toast.success(`Saved "${film.title}" to watchlist`);
      }
    } catch (err) {
      // Rollback on failure
      setWatchlistIds((prev) => {
        const next = new Set(prev);
        if (alreadySaved) next.add(film.id);
        else next.delete(film.id);
        return next;
      });
      toast.error('Could not update watchlist.');
    }
  };

  // Priority wave: Hero/BoxOffice fallback (if SSR didn't seed) + Live Cinemas + Streaming Hub
  useEffect(() => {
    const runPriority = () => {
      const jobs = [
        fetchInCinemasData().catch((e) => console.error('Cinema fetch error:', e)),
        fetchNewReleasesData().catch((e) => console.error('New releases fetch error:', e)),
        fetchStreamingHubData().catch((e) => console.error('Streaming fetch error:', e)),
      ];
      if (!loaderData.featuredFilms?.length) {
        jobs.push(fetchFeaturedFallback().catch((e) => console.error('Hero fallback error:', e)));
      }
      if (!loaderData.boxOfficeAllTime?.length && !loaderData.boxOfficeRecent?.length) {
        jobs.push(fetchBoxOfficeFallback().catch((e) => console.error('BoxOffice fallback error:', e)));
      }
      Promise.all(jobs).then(() => {
        // Pre-warm below-fold industry & upcoming data
        setTimeout(() => {
          fetchSecondaryData().catch(() => {});
        }, 300);
      });
    };

    let idleId = null;
    let timeoutId = null;
    if (typeof requestIdleCallback === 'function') {
      idleId = requestIdleCallback(runPriority, { timeout: 600 });
    } else {
      timeoutId = setTimeout(runPriority, 50);
    }

    const cinemaRefresh = window.setInterval(() => {
      fetchInCinemasData().catch(() => {});
    }, 120_000);

    return () => {
      if (idleId != null && typeof cancelIdleCallback === 'function') cancelIdleCallback(idleId);
      if (timeoutId != null) clearTimeout(timeoutId);
      window.clearInterval(cinemaRefresh);
    };
  }, []);

  const fetchFeaturedFallback = async () => {
    setIsHeroLoading(true);
    try {
      const cols = `
        id, slug, title, poster_url, backdrop_url, year, synopsis, tagline,
        view_count, average_rating, audience_rating, imdb_rating, tmdb_rating, liked_percent,
        release_type, source, is_in_cinemas, coming_soon, streaming_links,
        youtube_watch_url, trailer_youtube_id, runtime_minutes,
        film_genres(genres(name))
      `;
      let { data } = await supabase
        .from('films')
        .select(cols)
        .eq('is_featured', true)
        .or('source.neq.mubi,source.is.null,countries.cs.{Nigeria}')
        .order('is_in_cinemas', { ascending: false })
        .order('year', { ascending: false })
        .order('view_count', { ascending: false })
        .limit(5);

      if (!data || data.length === 0) {
        const res = await supabase
          .from('films')
          .select(cols)
          .not('backdrop_url', 'is', null)
          .or('source.neq.mubi,source.is.null,countries.cs.{Nigeria}')
          .order('is_in_cinemas', { ascending: false })
          .order('year', { ascending: false })
          .order('view_count', { ascending: false })
          .limit(5);
        data = res.data;
      }

      if (data) setFeaturedFilms(data.map(withNormalizedGenres));
    } finally {
      setIsHeroLoading(false);
    }
  };

  const fetchBoxOfficeFallback = async () => {
    setIsBoxOfficeLoading(true);
    try {
      const cols = 'id, slug, title, poster_url, year, distributor, box_office_domestic, box_office_currency';
      const [allRes, recentRes] = await Promise.all([
        supabase
          .from('films')
          .select(cols)
          .gt('box_office_domestic', 0)
          .order('box_office_domestic', { ascending: false })
          .limit(5),
        supabase
          .from('films')
          .select(cols)
          .gt('box_office_domestic', 0)
          .gte('year', 2025)
          .order('box_office_domestic', { ascending: false })
          .limit(5),
      ]);
      if (allRes.data) setBoxOfficeAllTime(allRes.data);
      if (recentRes.data) setBoxOfficeRecent(recentRes.data);
    } finally {
      setIsBoxOfficeLoading(false);
    }
  };

  const fetchInCinemasData = async () => {
    setIsCinemaLoading(true);
    try {
      const cinemaClock = getZonedClock();
      const tomorrow = getNextDate(cinemaClock.date);

      const stRows = [];
      let showtimePage = 0;

      while (true) {
        const pageStart = showtimePage * CINEMA_SHOWTIME_PAGE_SIZE;
        const { data: pageRows, error: showtimeError } = await supabase
          .from('showtimes')
          .select(
            'film_id, cinema_id, show_date, show_time, films(id, status, coming_soon, is_in_cinemas), cinemas(id, name, city, chain)'
          )
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

      const futureShowtimes = stRows.filter((st) => isPublicCinemaShowtime(st, cinemaClock));
      const nowIds = new Set(futureShowtimes.map((r) => r.film_id).filter(Boolean));

      const nextShowByFilm = {};
      const upcomingShowsByFilm = {};
      const cityNextShowByFilm = {};
      const citiesByFilm = {};
      const futureCountByFilm = {};

      futureShowtimes.forEach((st) => {
        const fId = st.film_id;
        futureCountByFilm[fId] = (futureCountByFilm[fId] || 0) + 1;

        const enrichedShow = {
          ...st,
          is_today: st.show_date === cinemaClock.date,
          is_tomorrow: st.show_date === tomorrow,
        };

        if (!nextShowByFilm[fId] || compareShowtimes(st, nextShowByFilm[fId]) < 0) {
          nextShowByFilm[fId] = enrichedShow;
        }

        // Track distinct cinema venue upcoming showtimes for dynamic rotation
        if (!upcomingShowsByFilm[fId]) upcomingShowsByFilm[fId] = [];
        const venueName = st.cinemas?.name || st.cinema_name || '';
        if (
          venueName &&
          upcomingShowsByFilm[fId].length < 6 &&
          !upcomingShowsByFilm[fId].some((s) => (s.cinemas?.name || s.cinema_name) === venueName)
        ) {
          upcomingShowsByFilm[fId].push(enrichedShow);
        }

        const rawCity = st.cinemas?.city?.trim();
        if (rawCity) {
          if (!citiesByFilm[fId]) citiesByFilm[fId] = new Set();
          citiesByFilm[fId].add(rawCity);

          if (!cityNextShowByFilm[fId]) cityNextShowByFilm[fId] = {};
          const prevCityShow = cityNextShowByFilm[fId][rawCity];
          if (!prevCityShow || compareShowtimes(st, prevCityShow) < 0) {
            cityNextShowByFilm[fId][rawCity] = enrichedShow;
          }
        }
      });

      if (nowIds.size === 0) {
        setInCinemas([]);
        return;
      }

      const { data } = await supabase
        .from('films')
        .select(`${PUBLIC_FILM_COLUMNS}, film_genres(genres(name))`)
        .in('id', Array.from(nowIds))
        .order('created_at', { ascending: false });

      const candidates = (data || [])
        .filter(isLiveCinemaFilm)
        .map((film) => ({
          ...withNormalizedGenres(film),
          next_showtime: nextShowByFilm[film.id] || null,
          upcoming_showtimes: upcomingShowsByFilm[film.id] || [],
          active_cities: Array.from(citiesByFilm[film.id] || []),
          city_next_showtime: cityNextShowByFilm[film.id] || {},
          future_showtime_count: futureCountByFilm[film.id] || 0,
        }));

      // Deduplicate cinema chain spelling variants
      const uniqueFilms = new Map();
      candidates.forEach((candidate) => {
        const key = cinemaFilmKey(candidate.title) || candidate.id;
        const existing = uniqueFilms.get(key);
        if (!existing) {
          uniqueFilms.set(key, candidate);
          return;
        }
        const primary =
          candidate.future_showtime_count > existing.future_showtime_count ? candidate : existing;
        const firstNextShow =
          [existing.next_showtime, candidate.next_showtime]
            .filter(Boolean)
            .sort(compareShowtimes)[0] || null;

        const mergedCities = Array.from(
          new Set([...(existing.active_cities || []), ...(candidate.active_cities || [])])
        );
        const mergedShows = [...(existing.upcoming_showtimes || [])];
        (candidate.upcoming_showtimes || []).forEach((s) => {
          const vName = s.cinemas?.name || s.cinema_name;
          if (vName && !mergedShows.some((x) => (x.cinemas?.name || x.cinema_name) === vName)) {
            mergedShows.push(s);
          }
        });

        const mergedCityShows = { ...(existing.city_next_showtime || {}) };
        Object.entries(candidate.city_next_showtime || {}).forEach(([city, show]) => {
          if (!mergedCityShows[city] || compareShowtimes(show, mergedCityShows[city]) < 0) {
            mergedCityShows[city] = show;
          }
        });

        uniqueFilms.set(key, {
          ...primary,
          next_showtime: firstNextShow,
          upcoming_showtimes: mergedShows,
          active_cities: mergedCities,
          city_next_showtime: mergedCityShows,
          future_showtime_count: existing.future_showtime_count + candidate.future_showtime_count,
        });
      });

      setInCinemas(Array.from(uniqueFilms.values()));
    } finally {
      setIsCinemaLoading(false);
    }
  };

  const fetchNewReleasesData = async () => {
    setIsNewReleasesLoading(true);
    try {
      const todayIso = new Date().toISOString().slice(0, 10);
      const minFreshYear = new Date().getFullYear() - 1;
      const cols = `
        id, slug, title, poster_url, backdrop_url, year, genres,
        runtime_minutes, view_count, average_rating, liked_percent,
        audience_rating, imdb_rating, tmdb_rating, content_type,
        release_type, streaming_links, source, youtube_watch_url,
        created_at, release_date, coming_soon, is_in_cinemas,
        film_genres(genres(name))
      `;

      const { data, error } = await supabase
        .from('films')
        .select(cols)
        .or('coming_soon.eq.false,coming_soon.is.null')
        .or('source.neq.mubi,source.is.null,countries.cs.{Nigeria}')
        .is('series_id', null)
        .gte('year', minFreshYear)
        .not('poster_url', 'is', null)
        .or(`release_date.lte.${todayIso},release_date.is.null`)
        .order('release_date', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false })
        .limit(36);

      if (!error && Array.isArray(data)) {
        const normalized = data.map(withNormalizedGenres);
        setNewReleases(filterAndSortFreshStreaming(normalized, { minFallback: 12 }).slice(0, 24));
      }
    } finally {
      setIsNewReleasesLoading(false);
    }
  };

  const fetchStreamingHubData = async () => {
    setIsStreamingLoading(true);
    try {
      const cols = `
        id, slug, title, poster_url, backdrop_url, year, genres,
        runtime_minutes, view_count, average_rating, liked_percent,
        audience_rating, imdb_rating, tmdb_rating, content_type,
        release_type, streaming_links, source, youtube_watch_url,
        created_at, release_date, coming_soon, is_in_cinemas,
        film_genres(genres(name))
      `;

      const minFreshYear = new Date().getFullYear() - 1;
      const [queueRes, youtubeRes] = await Promise.all([
        supabase.rpc('get_platform_new_releases', { p_platforms: STREAMING_IDS }),
        supabase
          .from('films')
          .select(cols)
          .eq('source', 'youtube')
          .eq('content_type', 'movie')
          .gte('year', minFreshYear)
          .not('poster_url', 'is', null)
          .order('release_date', { ascending: false, nullsFirst: false })
          .order('created_at', { ascending: false })
          .order('view_count', { ascending: false, nullsFirst: false })
          .limit(24),
      ]);

      const map = {};
      STREAMING_IDS.forEach((id) => {
        map[id] = [];
      });

      if (!queueRes.error && Array.isArray(queueRes.data)) {
        const orderedQueue = [...queueRes.data].sort((a, b) => {
          if (a.platform !== b.platform) return a.platform.localeCompare(b.platform);
          if (a.display_order !== b.display_order) return a.display_order - b.display_order;
          const dateA = new Date(a.film?.release_date || a.film?.created_at || a.queue_created_at).getTime();
          const dateB = new Date(b.film?.release_date || b.film?.created_at || b.queue_created_at).getTime();
          return dateB - dateA;
        });

        orderedQueue.forEach((row) => {
          // Exclude child episodes so only the parent series card displays with episode counts
          if (row.film && !row.film.series_id && map[row.platform]) {
            map[row.platform].push(withNormalizedGenres(row.film));
          }
        });
      }

      // Fallback for any core platform that had an empty RPC queue (strictly fresh titles)
      await Promise.all(
        STREAMING_IDS.map(async (id) => {
          if (map[id].length > 0) return;
          const { data } = await supabase
            .from('films')
            .select(cols)
            .or(platformFilter(id))
            .or('source.neq.mubi,source.is.null,countries.cs.{Nigeria}')
            .is('series_id', null)
            .gte('year', minFreshYear)
            .not('poster_url', 'is', null)
            .order('release_date', { ascending: false, nullsFirst: false })
            .order('created_at', { ascending: false })
            .limit(16);
          map[id] = (data || []).map(withNormalizedGenres);
        })
      );

      STREAMING_IDS.forEach((id) => {
        map[id] = filterAndSortFreshStreaming(map[id], { minFallback: 4 }).slice(0, 12);
      });

      setStreamingByPlatform(map);

      if (!youtubeRes.error && youtubeRes.data) {
        setYoutubeFeed(
          filterAndSortFreshStreaming(youtubeRes.data.map(withNormalizedGenres), { minFallback: 6 }).slice(0, 12)
        );
      }
    } finally {
      setIsStreamingLoading(false);
    }
  };

  // Below-fold fetches triggered once near viewport
  const fetchSecondaryData = async () => {
    if (secondaryFetched.current) return;
    secondaryFetched.current = true;

    setIsComingSoonLoading(true);
    setIsPlaysLoading(true);
    setIsIndustryLoading(true);

    await Promise.all([
      fetchComingSoon().finally(() => setIsComingSoonLoading(false)),
      fetchUpcomingPlays().finally(() => setIsPlaysLoading(false)),
      Promise.all([fetchCompanies(), fetchIndustryPeople()]).finally(() => setIsIndustryLoading(false)),
    ]);
  };

  const fetchComingSoon = async (attempt = 0) => {
    const { data, error } = await supabase.rpc('get_coming_soon_films', { p_limit: 16 });
    if (error) {
      if (attempt === 0 && error.code === '57014') {
        await new Promise((r) => setTimeout(r, 1200));
        return fetchComingSoon(attempt + 1);
      }
      console.error('Error fetching coming soon:', error);
      return;
    }
    if (data) {
      setComingSoon(
        data.map((f) => ({
          ...f,
          genres: Array.isArray(f.genres) ? f.genres.filter(Boolean) : [],
        }))
      );
    }
  };

  const fetchUpcomingPlays = async () => {
    try {
      const rows = await fetchPlays();
      const today = new Date().toISOString().slice(0, 10);
      const upcoming = (rows || [])
        .filter((play) => {
          const status = String(play.status || '').toLowerCase();
          return (
            status === 'upcoming' ||
            status === 'currently_running' ||
            (play.run_end_date && play.run_end_date >= today) ||
            (play.run_start_date && play.run_start_date >= today)
          );
        })
        .sort((a, b) => {
          const aDate = a.run_start_date || a.run_end_date || '9999-12-31';
          const bDate = b.run_start_date || b.run_end_date || '9999-12-31';
          return aDate.localeCompare(bDate);
        })
        .slice(0, 6);
      setUpcomingPlays(upcoming);
    } catch (err) {
      console.error('Error fetching plays:', err);
    }
  };

  const fetchCompanies = async () => {
    try {
      const { data, error } = await supabase.from('companies').select(`
        id, name, logo_url, founded_year, company_type,
        film_companies(
          film:films(
            id, title, poster_url, view_count, liked_percent, box_office_domestic, year
          )
        )
      `);

      if (error || !data) return;

      const scored = data
        .map((c) => {
          const films = (c.film_companies || []).map((fc) => fc.film).filter(Boolean);
          const filmCount = films.length;
          if (filmCount === 0) return null;

          const isRealLogo = Boolean(
            c.logo_url &&
              !c.logo_url.includes('ui-avatars.com') &&
              !c.logo_url.includes('placeholder') &&
              !c.logo_url.includes('default')
          );

          let totalBoxOffice = 0;
          let topFilm = null;
          let topFilmScore = -1;

          for (const f of films) {
            const bo = Number(f.box_office_domestic) || 0;
            totalBoxOffice += bo;
            const fScore =
              (bo > 0 ? bo / 100_000 : 0) +
              (f.liked_percent ? Number(f.liked_percent) * 10 : 0) +
              (f.view_count ? Math.log10(Number(f.view_count) + 1) * 100 : 0) +
              (f.poster_url ? 500 : 0);
            if (fScore > topFilmScore) {
              topFilmScore = fScore;
              topFilm = f;
            }
          }

          let score = 0;
          if (isRealLogo) score += 6000;
          score += Math.min(filmCount * 180, 4500);
          if (totalBoxOffice >= 1_000_000_000) score += 8000;
          else if (totalBoxOffice >= 200_000_000) score += 5000;
          else if (totalBoxOffice > 0) score += 3000;

          return {
            ...c,
            filmCount,
            totalBoxOffice,
            topFilm,
            score,
          };
        })
        .filter(Boolean)
        .sort((a, b) => b.score - a.score)
        .slice(0, 8);

      setCompanies(scored);
    } catch (err) {
      console.error('Error fetching companies:', err);
    }
  };

  const fetchIndustryPeople = async () => {
    try {
      const [talentRes, crewRes, birthdayRes] = await Promise.all([
        supabase
          .from('people')
          .select(PUBLIC_PERSON_COLUMNS)
          .not('photo_url', 'is', null)
          .order('is_verified', { ascending: false })
          .order('film_count', { ascending: false, nullsFirst: false })
          .order('popularity_score', { ascending: false, nullsFirst: false })
          .limit(10),
        supabase
          .from('people')
          .select(PUBLIC_PERSON_COLUMNS)
          .not('known_for_department', 'in', '("Acting","Skit Maker","Unknown")')
          .not('known_for_department', 'is', null)
          .not('photo_url', 'is', null)
          .order('is_verified', { ascending: false })
          .order('film_count', { ascending: false, nullsFirst: false })
          .order('popularity_score', { ascending: false, nullsFirst: false })
          .limit(6),
        supabase
          .from('people')
          .select(PUBLIC_PERSON_COLUMNS)
          .not('date_of_birth', 'is', null)
          .not('photo_url', 'is', null)
          .order('popularity_score', { ascending: false, nullsFirst: false })
          .limit(80),
      ]);

      if (!talentRes.error && talentRes.data) setTalent(talentRes.data);
      if (!crewRes.error && crewRes.data) setCrew(crewRes.data);
      if (!birthdayRes.error && birthdayRes.data) setBirthdayPool(birthdayRes.data);
    } catch (err) {
      console.error('Error fetching industry people:', err);
    }
  };

  // Deduplication set so Cinema films don't duplicate inside Streaming or Coming Soon
  const cinemaFilmIds = useMemo(() => new Set(inCinemas.map((f) => f.id)), [inCinemas]);

  // Auto-enhance hero slides with live in-cinema films if no manually featured films exist
  const heroSlides = useMemo(() => {
    if (featuredFilms.length > 0) return featuredFilms;
    return inCinemas.filter((f) => f.backdrop_url || f.poster_url).slice(0, 5);
  }, [featuredFilms, inCinemas]);

  return (
    <div className="w-full min-h-screen bg-bg text-text-primary pb-16">
      {/* 1. COMMAND HERO: Cinematic Spotlight + Tri-Modal Commercial Chart (Cinema/Theatre/YouTube) */}
      <HomeCommandHero
        featuredFilms={heroSlides}
        boxOfficeRecent={boxOfficeRecent}
        boxOfficeAllTime={boxOfficeAllTime}
        isLoadingHero={isHeroLoading && inCinemas.length === 0}
        isLoadingBoxOffice={isBoxOfficeLoading}
        stats={{ inCinemasCount: inCinemas.length }}
      />

      {/* 2. LIVE IN CINEMAS TODAY (18+ Locations, City Filter) */}
      <HomeCinemaSection
        inCinemas={inCinemas}
        isLoading={isCinemaLoading}
        watchlistIds={watchlistIds}
        onToggleWatchlist={handleToggleWatchlist}
      />

      {/* 3. NEW RELEASES (Every Newly Released Movie Across Cinema, YouTube & Streaming) */}
      <HomeNewReleases
        newReleases={newReleases}
        isLoading={isNewReleasesLoading}
        watchlistIds={watchlistIds}
        onToggleWatchlist={handleToggleWatchlist}
      />

      {/* 4. NATIVE MANAGED SPONSOR BILLBOARD: Upper Slot (Rotates all active Rectangle & Square campaigns) */}
      <HomeSponsoredBanner format="rectangle" />

      {/* Watchlist "Now Streaming" Automated Alert Strip */}
      {watchlistStreamingAlerts.length > 0 && !dismissedAlert && (
        <div className="bg-surface-2 border-y border-border">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2.5 flex items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2 min-w-0">
              <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0 animate-pulse" />
              <span className="font-black uppercase tracking-wider text-emerald-400 shrink-0">
                Watchlist Alert
              </span>
              <span className="text-text-secondary truncate">
                Now streaming:{' '}
                <Link
                  to={`/films/${watchlistStreamingAlerts[0].slug || watchlistStreamingAlerts[0].id}`}
                  className="font-bold text-text-primary hover:text-brand underline"
                >
                  {watchlistStreamingAlerts[0].title}
                </Link>
                {watchlistStreamingAlerts.length > 1
                  ? ` (+${watchlistStreamingAlerts.length - 1} more saved)`
                  : ''}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setDismissedAlert(true)}
              className="text-text-muted hover:text-text-primary text-[11px] font-bold shrink-0 cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* 4. WHERE TO WATCH TONIGHT (Unified Streaming + Free on YouTube) */}
      <HomeStreamingHub
        streamingByPlatform={streamingByPlatform}
        youtubeFeed={youtubeFeed}
        cinemaFilmIds={cinemaFilmIds}
        isLoading={isStreamingLoading}
        watchlistIds={watchlistIds}
        onToggleWatchlist={handleToggleWatchlist}
      />

      {/* Below-fold utility & industry sections */}
      <DeferredMount minHeight={400} rootMargin="450px 0px" onActivate={fetchSecondaryData}>
        <Suspense fallback={<div className="min-h-[240px]" aria-hidden="true" />}>
          {/* 5. CRITICS' VERDICT (Strictly Recency-First + Zero-Falsification) */}
          <CriticsLoungeSection />

          {/* 6. NOW ON STAGE & LIVE THEATRE (Dedicated Section, Portrait Cards) */}
          <HomeTheatreSection
            plays={upcomingPlays}
            isLoading={isPlaysLoading}
          />

          {/* 7. UPCOMING MOVIES SLATE (Pure Portrait Film Cards) */}
          <HomeUpcomingSlate
            comingSoon={comingSoon}
            cinemaFilmIds={cinemaFilmIds}
            isLoadingFilms={isComingSoonLoading}
            watchlistIds={watchlistIds}
            onToggleWatchlist={handleToggleWatchlist}
          />
        </Suspense>
      </DeferredMount>

      {/* 8. NATIVE MANAGED SPONSOR BILLBOARD: Lower Slot (Rotates all active Panorama campaigns) */}
      <HomeSponsoredBanner format="panorama" />

      {/* 9. THE NOLLYWOOD ECOSYSTEM: BENTO STUDIOS & VERIFIED CAST/CREW PASSPORTS */}
      <HomeIndustryEcosystem
        companies={companies}
        talent={talent}
        crew={crew}
        isLoading={isIndustryLoading}
      />

      {/* 10. MUVIBD POWER MOVERS (Δ) & BORN TODAY (DAILY AUTOMATED PULSE) */}
      <Suspense fallback={<div className="min-h-[200px]" aria-hidden="true" />}>
        <HomePulseRails
          powerPeople={talent}
          birthdayPool={birthdayPool}
          isLoading={isIndustryLoading}
        />
      </Suspense>

      {/* 11. BUILT FOR AFRICAN CINEMA: GENRES + INDUSTRY TOOLKIT */}
      <HomeIndustryTools isAuthenticated={isAuthenticated} />
    </div>
  );
}
