import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { getPersonYoutubeChannelUrl } from '../lib/youtube';
import HeroSection from '../components/film/HeroSection';
import FilmRow from '../components/film/FilmRow';
import FilmCard from '../components/film/FilmCard';
import GenreRail from '../components/film/GenreRail';
import PlatformRail from '../components/film/PlatformRail';
import PersonCard from '../components/person/PersonCard';
import { Icon } from '@iconify/react';
import { useAuth } from '../context/AuthContext';
import { PLATFORMS, platformFilter } from '../lib/platforms';
import { toTitleCase } from '../utils/format';

// Platforms shown in the homepage "New to Stream" tabbed rail.
const NEW_STREAM = PLATFORMS.filter(p => ['netflix', 'prime_video', 'kava', 'docuth'].includes(p.id));
const NEW_STREAM_IDS = NEW_STREAM.map(p => p.id);

export default function Home() {
  const { isAuthenticated } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [isHeroLoading, setIsHeroLoading] = useState(true);
  const [inCinemas, setInCinemas] = useState([]);
  const [leavingCinemas, setLeavingCinemas] = useState([]);
  const [newToStream, setNewToStream] = useState({}); // { netflix: [...], prime_video: [...], ... }
  const [streamTab, setStreamTab] = useState('netflix');
  const [youtubeFeed, setYoutubeFeed] = useState([]);
  const [youtubeFilter, setYoutubeFilter] = useState('All');
  const [spotlightPerson, setSpotlightPerson] = useState(null);
  const [otherPeople, setOtherPeople] = useState([]);
  const [creators, setCreators] = useState([]);
  const [newReleases, setNewReleases] = useState([]);

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

  // Spotlight Image Fallback state (Issue 24)
  const [spotlightImgError, setSpotlightImgError] = useState(false);

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
  }, []);

  const fetchAllData = async () => {
    setIsLoading(true);
    setIsHeroLoading(true);
    
    // 1. Fetch above-the-fold content first for instant loading experience (Issue 1)
    try {
      await Promise.all([
        fetchFeaturedFilms().catch(e => console.error('Error fetching featured films:', e)),
        fetchInCinemasData().catch(e => console.error('Error fetching cinemas data:', e))
      ]);
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
        fetchComingSoon().catch(e => console.error('Error fetching coming soon:', e)),
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
        runtime_minutes, view_count, average_rating, nfvcb_rating, 
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
        runtime_minutes, view_count, average_rating, nfvcb_rating,
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
    // "New to Stream" tabbed rail. Admins hand-pick titles per platform in
    // /admin/new-releases (platform_new_releases). Where a platform hasn't been
    // curated yet, we fall back to that platform's most-recently-added titles so
    // the tab is never empty during the catalogue backfill.
    const cols = `
      id, slug, title, poster_url, backdrop_url, year, language,
      runtime_minutes, view_count, average_rating, nfvcb_rating,
      is_featured, is_trending, release_type, streaming_links, source,
      youtube_watch_url, created_at, release_date,
      film_genres(genres(name))
    `;
    const withGenres = (f) => ({
      ...f,
      genres: f.film_genres?.map(fg => fg.genres?.name).filter(Boolean) || []
    });

    const map = {};
    NEW_STREAM_IDS.forEach(id => { map[id] = []; });

    // 1. Curated entries for all platforms in one query.
    const { data: curated } = await supabase
      .from('platform_new_releases')
      .select(`platform, films(${cols})`)
      .in('platform', NEW_STREAM_IDS)
      .order('created_at', { ascending: false });

    (curated || []).forEach(row => {
      if (row.films && map[row.platform]) map[row.platform].push(withGenres(row.films));
    });

    // 2. Recency fallback for any platform with no curation yet.
    await Promise.all(NEW_STREAM_IDS.map(async (id) => {
      if (map[id].length > 0) return;
      const { data } = await supabase
        .from('films')
        .select(cols)
        .or(platformFilter(id))
        .or('source.neq.mubi,source.is.null,countries.cs.{Nigeria}')
        .order('created_at', { ascending: false })
        .limit(12);
      map[id] = (data || []).map(withGenres);
    }));

    setNewToStream(map);
  };

  const fetchInCinemasData = async () => {
    const today = new Date().toISOString().split('T')[0];
    const withGenres = (f) => ({
      ...f,
      genres: f.film_genres?.map(fg => fg.genres?.name).filter(Boolean) || []
    });

    // 1. Build the FULL set of film_ids that have a live upcoming showtime.
    //    (Lightweight — just film_id. Previously we joined films + limited 200
    //    showtime ROWS, which collapsed to a few films and pushed everyone else
    //    wrongly into "Leaving".)
    const { data: stRows } = await supabase
      .from('showtimes')
      .select('film_id')
      .gte('show_date', today)
      .eq('is_available', true)
      .limit(5000);
    const nowIds = new Set((stRows || []).map(r => r.film_id).filter(Boolean));

    // 2. "In Cinemas Now" = those films (Nollywood, non-YouTube), for display.
    let nowFilms = [];
    if (nowIds.size > 0) {
      const { data } = await supabase
        .from('films')
        .select(`*, film_genres(genres(name))`)
        .in('id', Array.from(nowIds))
        .neq('source', 'youtube')
        .or('youtube_watch_url.is.null,youtube_watch_url.eq.""')
        .or('source.neq.mubi,source.is.null,countries.cs.{Nigeria}')
        .order('view_count', { ascending: false })
        .limit(60);
      nowFilms = (data || []).map(withGenres);
    }

    // 3. "Leaving Cinemas Soon" = still flagged is_in_cinemas but with NO live
    //    upcoming showtime (excluded against the full nowIds set, not the
    //    display-limited list, so a film with showtimes never lands here).
    const { data: flagged } = await supabase
      .from('films')
      .select(`*, film_genres(genres(name))`)
      .eq('is_in_cinemas', true)
      .neq('source', 'youtube')
      .or('youtube_watch_url.is.null,youtube_watch_url.eq.""')
      .or('source.neq.mubi,source.is.null,countries.cs.{Nigeria}')
      .order('release_date', { ascending: false })
      .limit(40);
    const leavingFilms = (flagged || [])
      .filter(f => !nowIds.has(f.id))
      .map(withGenres);

    setInCinemas(nowFilms);
    setLeavingCinemas(leavingFilms.slice(0, 20));
  };

  const fetchComingSoon = async (attempt = 0) => {
    // Explicit columns instead of `*`: the wide select made this query take ~3.7s,
    // which tipped over Postgres' statement timeout (57014). The lean column set
    // returns the same rows in ~1s. There is no index on films.status, so under the
    // burst of concurrent homepage queries it can still occasionally exceed the
    // anon-role timeout — when that happens we retry once after the burst clears,
    // at which point the query runs (near) alone and completes comfortably.
    const { data, error } = await supabase
      .from('films')
      .select(`
        id, slug, title, poster_url, backdrop_url, year, language,
        runtime_minutes, view_count, average_rating, nfvcb_rating,
        is_featured, is_trending, release_type, created_at, release_date,
        youtube_watch_url,
        film_genres(genres(name))
      `)
      .in('status', ['upcoming', 'in_production', 'post-production'])
      .or('source.neq.mubi,source.is.null,countries.cs.{Nigeria}')
      .order('release_date', { ascending: true })
      .limit(20);

    if (error) {
      if (attempt === 0 && error.code === '57014') {
        await new Promise(r => setTimeout(r, 1500));
        return fetchComingSoon(attempt + 1);
      }
      console.error('Error fetching coming soon:', error);
      return;
    }

    if (data) {
      setComingSoon(data.map(f => ({
        ...f,
        genres: f.film_genres?.map(fg => fg.genres?.name).filter(Boolean) || []
      })));
    }
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
          id, slug, title, poster_url, backdrop_url, year, language, 
          runtime_minutes, view_count, average_rating, nfvcb_rating, 
          is_featured, is_trending, release_type, created_at, release_date,
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
        id, slug, title, poster_url, backdrop_url, year, language, 
        runtime_minutes, view_count, average_rating, nfvcb_rating, 
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
      const mapped = data.map(f => ({
        ...f,
        genres: f.film_genres?.map(fg => fg.genres?.name).filter(Boolean) || [],
        channel_name: 'YouTube Featured'
      }));
      setYoutubeFeed(mapped);
    }
  };

  const fetchRecentlyAdded = async () => {
    // Recently Added = all newly added films from all sources (netflix, prime, youtube, docuth, kava, cinema, etc.)
    const { data, error } = await supabase
      .from('films')
      .select(`
        id, slug, title, poster_url, backdrop_url, year, language,
        runtime_minutes, view_count, average_rating, nfvcb_rating,
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
    <div className="w-full pb-20 bg-bg min-h-screen">
      {/* 1. HERO (Progressive Above-the-Fold Loading) (Issue 1) */}
      <HeroSection
        featuredFilms={featuredFilms}
        isLoading={isHeroLoading}
      />

      <div className="max-w-7xl mx-auto border-x border-hairline">
        {/* 2. WHERE TO WATCH (signature, top-level entry point) */}
        <div className="border-b border-hairline">
          <PlatformRail films={platformCoverPool} counts={platformCounts} />
        </div>

        {/* 3. IN CINEMAS NOW (promoted — larger cards + showtimes CTA) */}
        {(isLoading || inCinemas.length > 0) && (
          <div className="border-b border-hairline py-12">
            <FilmRow
              title="In Cinemas Now"
              subtitle="On the big screen this week — find showtimes near you"
              films={inCinemas}
              isLoading={isLoading}
              linkTo="/showtimes"
              cardVariant="landscape"
            />
          </div>
        )}

        {/* 6b. NEW RELEASES (landscape single slideable row) */}
        {(isLoading || newReleases.length > 0) && (
          <div className="border-b border-hairline py-12 bg-surface-2/5">
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
          <div className="border-b border-hairline py-12 bg-surface-2/5">
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
            <FilmRow
              films={newToStream[streamTab] || []}
              isLoading={isLoading}
              noHeader
            />
          </div>
        )}
        {(isLoading || featuredSeries.length > 0) && (
          <div className="border-b border-hairline py-12 bg-surface-2/5">
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
          <div className="border-b border-hairline py-12">
            <FilmRow
              title="Free on YouTube"
              subtitle="No subscription needed"
              films={youtubeFeed}
              isLoading={isLoading}
              linkTo="/watch/youtube"
            />
          </div>
        )}
        {leavingCinemas.length > 0 && (
          <div className="border-b border-hairline py-12 bg-surface-2/5">
            <FilmRow
              title="Leaving Cinemas Soon"
              subtitle="Catch them before they go"
              films={leavingCinemas}
              isLoading={isLoading}
              linkTo="/showtimes"
            />
          </div>
        )}

        {/* 5. TOP 10 THIS WEEK */}
        {(isLoading || top10Films.length > 0) && (
          <div className="border-b border-hairline py-12">
            <FilmRow
              title="Top 10 This Week"
              subtitle="The most-watched Nollywood stories right now"
              films={top10Films}
              isLoading={isLoading}
              cardVariant="top10"
            />
          </div>
        )}

        {/* 6a. COMING SOON (keep existing horizontal scroll cards) */}
        {(isLoading || comingSoon.length > 0) && (
          <div className="border-b border-hairline py-12">
            <FilmRow
              title="Coming Soon"
              subtitle="Upcoming releases to look forward to"
              films={comingSoon}
              isLoading={isLoading}
              linkTo="/browse?sort=upcoming"
            />
          </div>
        )}

        {/* 6c. RECENTLY ADDED (landscape single slideable row) */}
        {(isLoading || recentlyAdded.length > 0) && (
          <div className="border-b border-hairline py-12">
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
        <div className="border-b border-hairline">
          <GenreRail variant="poster-grid" />
        </div>

        {/* 8. CURATED PICK (editorial film row — discovery) */}
        {curatedCollection && curatedCollection.films.length > 0 && (
          <div className="border-b border-hairline py-16 bg-brand/5 relative overflow-hidden">
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
        <div className="bg-brand/[0.03]">

          {/* — Zone label: People of Nollywood — */}
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center gap-4 pt-16 pb-2">
            <span className="font-heading font-black text-xs tracking-[0.2em] uppercase text-brand whitespace-nowrap">People of Nollywood</span>
            <span className="flex-1 h-px bg-border" />
          </div>

        {/* 9. SPOTLIGHT (Editorial) */}
        {(isLoading || spotlightContent) && (
          <div className="border-b border-hairline py-16 bg-surface-2/10">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="flex items-center gap-2 mb-10">
                <Icon icon="solar:star-linear" className="text-brand text-xl" />
                <h2 className="font-heading font-bold text-2xl md:text-3xl text-text-primary tracking-tighter">
                  Spotlight
                </h2>
              </div>

              <div className="relative bg-surface rounded-xl overflow-hidden border border-hairline shadow-sm">
                {isLoading ? (
                  <div className="h-[400px] animate-pulse bg-surface-2" />
                ) : spotlightContent && spotlightContent.people && (
                  <div className="flex flex-col md:flex-row items-stretch min-h-[400px]">
                    {/* 1. Artist Photo Cover (Left Pane) */}
                    <div className="w-full md:w-[28%] relative h-64 md:h-auto overflow-hidden bg-surface-2 shrink-0">
                      {!spotlightImgError && (spotlightContent.photo_url || spotlightContent.people.photo_url) ? (
                        <img
                          src={spotlightContent.photo_url || spotlightContent.people.photo_url}
                          alt={spotlightContent.people.name}
                          className="absolute inset-0 w-full h-full object-cover"
                          onError={() => setSpotlightImgError(true)}
                        />
                      ) : (
                        <div className="absolute inset-0 bg-gradient-to-tr from-brand/20 via-surface-2 to-surface-3 flex items-center justify-center">
                          <span className="text-white/20 text-7xl font-heading font-black tracking-tighter select-none">
                            {spotlightContent.people.name ? spotlightContent.people.name.split(' ').map(n => n[0]).join('') : 'AA'}
                          </span>
                        </div>
                      )}
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
                                <img
                                  src={film.poster_url || 'https://images.unsplash.com/photo-1594909122845-11baa439b7bf?q=80&w=300'}
                                  alt={film.title}
                                  className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                                  onError={(e) => { e.target.src = 'https://images.unsplash.com/photo-1594909122845-11baa439b7bf?q=80&w=300'; }}
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
          <div className="border-b border-hairline">
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
                  <div className="relative bg-surface rounded-xl p-8 md:p-12 overflow-hidden border border-hairline shadow-sm page-fade-in">
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
                            <img
                              src={crew.photo_url || 'https://www.gravatar.com/avatar/00000000000000000000000000000000?d=mp&f=y'}
                              alt={crew.name}
                              className="w-24 h-24 rounded-full object-cover border-2 border-transparent group-hover:border-brand transition-all duration-300"
                              onError={(e) => { e.target.src = 'https://www.gravatar.com/avatar/00000000000000000000000000000000?d=mp&f=y'; }}
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
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center gap-4 pt-16 pb-2">
            <span className="font-heading font-black text-xs tracking-[0.2em] uppercase text-brand whitespace-nowrap">The Industry</span>
            <span className="flex-1 h-px bg-border" />
          </div>

        {/* 12. NOLLYWOOD STUDIOS (Production Companies) */}
        {(isLoading || productionCompanies.length > 0) && (
          <div className="border-b border-hairline py-16 bg-surface-2/5">
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
                              <img 
                                src={company.logo_url} 
                                alt={company.name}
                                className="w-full h-full object-contain group-hover:scale-110 transition-transform duration-500"
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
          <div className="border-b border-hairline bg-surface-2/10 relative overflow-hidden">
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
                            <img 
                              src={stats.thumbnail || creator.photo_url || 'https://www.gravatar.com/avatar/00000000000000000000000000000000?d=mp&f=y'} 
                              alt={creator.name} 
                              className="w-16 h-16 rounded-lg object-cover shadow-sm border border-hairline group-hover:scale-105 transition-transform" 
                              onError={(e) => { e.target.src = 'https://www.gravatar.com/avatar/00000000000000000000000000000000?d=mp&f=y'; }}
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
          <div className="border-t border-hairline">
            {/* Zone label */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center gap-4 pt-16 pb-2">
              <span className="font-heading font-black text-xs tracking-[0.2em] uppercase text-brand whitespace-nowrap">Browse by Genre</span>
              <span className="flex-1 h-px bg-border" />
            </div>

            {genreSections.map((section) => (
              <div key={section.genre} className="border-b border-hairline py-12">
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
          <div className="px-4 sm:px-6 lg:px-8 py-16 border-t border-hairline/40">
            <div className="relative bg-gradient-to-br from-brand/20 via-surface-2 to-surface border border-hairline rounded-3xl p-8 md:p-16 overflow-hidden shadow-2xl text-center max-w-5xl mx-auto group">
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
