import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { getPersonYoutubeChannelUrl } from '../lib/youtube';
import HeroSection from '../components/film/HeroSection';
import FilmRow from '../components/film/FilmRow';
import GenreRail from '../components/film/GenreRail';
import PlatformRail from '../components/film/PlatformRail';
import PersonCard from '../components/person/PersonCard';
import { Icon } from '@iconify/react';
import { useAuth } from '../context/AuthContext';
import { PLATFORMS, platformFilter } from '../lib/platforms';

export default function Home() {
  const { isAuthenticated } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [isHeroLoading, setIsHeroLoading] = useState(true);
  const [inCinemas, setInCinemas] = useState([]);
  const [leavingCinemas, setLeavingCinemas] = useState([]);
  const [netflixNew, setNetflixNew] = useState([]);
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

  // What's New consolidated tabs (Coming Soon / New Releases / Recently Added)
  const [whatsNewTab, setWhatsNewTab] = useState('coming');

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
    fetchAllData();
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
        fetchNetflixNew().catch(e => console.error('Error fetching netflix new:', e)),
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
        fetchPlatformCounts().catch(e => console.error('Error fetching platform counts:', e))
      ]);
    } catch (error) {
      console.error('Error in progressive fetches:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchPlatformCounts = async () => {
    const entries = await Promise.all(
      PLATFORMS.map(async (p) => {
        const { count } = await supabase
          .from('films')
          .select('id', { count: 'exact', head: true })
          .or(platformFilter(p.id));
        return [p.id, count || 0];
      })
    );
    setPlatformCounts(Object.fromEntries(entries));
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
        id, title, poster_url, backdrop_url, year, language, 
        runtime_minutes, view_count, average_rating, nfvcb_rating, 
        is_featured, is_trending, release_type, streaming_links, source,
        content_type, season_count, episode_count,
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
        id, title, poster_url, backdrop_url, year, language,
        runtime_minutes, view_count, average_rating, nfvcb_rating,
        is_featured, is_trending, release_type, created_at, release_date,
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

  const fetchNetflixNew = async () => {
    // New on Netflix = the most recently discovered Netflix titles, newest first.
    // Ordered by the Netflix-specific `netflix_added_at` stamp (set by the Netflix
    // sync) so titles that were already in the catalogue but were *newly* found on
    // Netflix surface too — their old `created_at` would otherwise hide them.
    // Queried directly (not derived from the view-count-capped film list) so fresh
    // low-view titles still appear; no hard year cutoff, recency ordering handles it.
    const { data, error } = await supabase
      .from('films')
      .select(`
        id, title, poster_url, backdrop_url, year, language,
        runtime_minutes, view_count, average_rating, nfvcb_rating,
        is_featured, is_trending, release_type, streaming_links, source,
        created_at, release_date,
        film_genres(genres(name))
      `)
      .or('release_type.eq.netflix,source.eq.netflix,streaming_links->>netflix.not.is.null')
      .or('source.neq.mubi,source.is.null,countries.cs.{Nigeria}')
      .gte('year', 2026)
      .order('streaming_links->>netflix_added_at', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false })
      .limit(20);

    if (!error && data) {
      setNetflixNew(data.map(f => ({
        ...f,
        genres: f.film_genres?.map(fg => fg.genres?.name).filter(Boolean) || []
      })));
    }
  };

  const fetchInCinemasData = async () => {
    const today = new Date().toISOString().split('T')[0];
    const notYoutube = (f) => !(f.source === 'youtube' || (f.youtube_watch_url && String(f.youtube_watch_url).length > 5));
    const withGenres = (f) => ({
      ...f,
      genres: f.film_genres?.map(fg => fg.genres?.name).filter(Boolean) || []
    });

    // 1. "In Cinemas Now" = titles with a live, upcoming showtime. This is the
    //    freshness source of truth — once a film's schedule lapses it falls out.
    const { data: showtimesData } = await supabase
      .from('showtimes')
      .select(`
        film_id,
        films!inner(*, film_genres(genres(name)))
      `)
      .gte('show_date', today)
      .eq('is_available', true)
      .neq('films.source', 'youtube')
      .or('youtube_watch_url.is.null,youtube_watch_url.eq.""', { foreignTable: 'films' })
      .or('source.neq.mubi,source.is.null,countries.cs.{Nigeria}', { foreignTable: 'films' })
      .order('show_date', { ascending: true })
      .limit(200);

    const nowMap = new Map();
    (showtimesData || []).forEach(s => {
      const f = s.films;
      if (f && notYoutube(f) && !nowMap.has(f.id)) nowMap.set(f.id, withGenres(f));
    });

    // 2. "Leaving Cinemas Soon" = still flagged is_in_cinemas but no live showtime
    //    left, i.e. the sync stopped finding it on screen. The weekly sweep clears
    //    the flag entirely once a title has been gone past the grace window.
    const { data: flagged } = await supabase
      .from('films')
      .select(`*, film_genres(genres(name))`)
      .eq('is_in_cinemas', true)
      .neq('source', 'youtube')
      .or('youtube_watch_url.is.null,youtube_watch_url.eq.""')
      .or('source.neq.mubi,source.is.null,countries.cs.{Nigeria}')
      .order('release_date', { ascending: false })
      .limit(40);

    const leavingMap = new Map();
    (flagged || []).forEach(f => {
      if (notYoutube(f) && !nowMap.has(f.id)) leavingMap.set(f.id, withGenres(f));
    });

    // Fallback: if no live showtimes exist at all (e.g. scraper hasn't run yet
    // today), surface flagged titles as "now" so the rail isn't blank.
    if (nowMap.size === 0 && leavingMap.size > 0) {
      leavingMap.forEach((v, k) => nowMap.set(k, v));
      leavingMap.clear();
    }

    setInCinemas(Array.from(nowMap.values()));
    setLeavingCinemas(Array.from(leavingMap.values()).slice(0, 20));
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
        id, title, poster_url, backdrop_url, year, language,
        runtime_minutes, view_count, average_rating, nfvcb_rating,
        is_featured, is_trending, release_type, created_at, release_date,
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
          .select('id, title, poster_url, release_type, source, year')
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
          id, title, poster_url, backdrop_url, year, language, 
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
        id, title, poster_url, backdrop_url, year, language, 
        runtime_minutes, view_count, average_rating, nfvcb_rating, 
        is_featured, is_trending, release_type, created_at, release_date,
        film_genres(genres(name))
      `)
      .eq('source', 'youtube')
      .eq('content_type', 'movie')
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
        id, title, poster_url, backdrop_url, year, language,
        runtime_minutes, view_count, average_rating, nfvcb_rating,
        is_featured, is_trending, release_type, created_at, release_date,
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
    ...netflixNew,
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

      <div className="max-w-7xl mx-auto border-x border-border">
        {/* 2. WHERE TO WATCH (signature, top-level entry point) */}
        <div className="border-b border-border">
          <PlatformRail films={platformCoverPool} counts={platformCounts} isLoading={isLoading} />
        </div>

        {/* 3. IN CINEMAS NOW (promoted — larger cards + showtimes CTA) */}
        {(isLoading || inCinemas.length > 0) && (
          <div className="border-b border-border py-12">
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

        {/* 4. STREAMING RAILS (turn watch-link data into a browse axis) */}
        {(isLoading || netflixNew.length > 0) && (
          <div className="border-b border-border py-12 bg-surface-2/5">
            <FilmRow
              title="New on Netflix Naija"
              subtitle="Just added — stream tonight"
              films={netflixNew}
              isLoading={isLoading}
              linkTo="/watch/netflix"
            />
          </div>
        )}
        {(isLoading || featuredSeries.length > 0) && (
          <div className="border-b border-border py-12 bg-surface-2/5">
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
          <div className="border-b border-border py-12">
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
          <div className="border-b border-border py-12 bg-surface-2/5">
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
          <div className="border-b border-border py-12">
            <FilmRow
              title="Top 10 This Week"
              subtitle="The most-watched Nollywood stories right now"
              films={top10Films}
              isLoading={isLoading}
              cardVariant="top10"
            />
          </div>
        )}

        {/* 6. WHAT'S NEW (three redundant rows consolidated into tabs) */}
        {(isLoading || comingSoon.length > 0 || newReleases.length > 0 || recentlyAdded.length > 0) && (
          <div className="border-b border-border py-12">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-20">
              <div className="space-y-1 mb-6">
                <h2 className="text-2xl font-bold text-text-primary tracking-tight">What&apos;s New</h2>
                <p className="text-text-muted text-[10px] font-bold uppercase tracking-widest opacity-70">Fresh on MuviDB</p>
              </div>
              <div className="flex gap-6 border-b border-border mb-2">
                {[
                  { key: 'coming', label: 'Coming Soon' },
                  { key: 'new', label: 'New Releases' },
                  { key: 'recent', label: 'Recently Added' },
                ].map((t) => (
                  <button
                    key={t.key}
                    onClick={() => setWhatsNewTab(t.key)}
                    className={`pb-3 -mb-px text-sm font-bold border-b-2 transition-colors cursor-pointer ${
                      whatsNewTab === t.key
                        ? 'text-text-primary border-brand'
                        : 'text-text-muted border-transparent hover:text-text-secondary'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>
            <FilmRow
              films={whatsNewMap[whatsNewTab] || []}
              isLoading={isLoading}
              noHeader
            />
          </div>
        )}

        {/* 7. GENRE MOODS (compact chip strip) */}
        <div className="border-b border-border">
          <GenreRail variant="chips" />
        </div>

        {/* 8. CURATED PICK (editorial film row — discovery) */}
        {curatedCollection && curatedCollection.films.length > 0 && (
          <div className="border-b border-border py-16 bg-brand/5 relative overflow-hidden">
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
          <div className="border-b border-border py-16 bg-surface-2/10">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="flex items-center gap-2 mb-10">
                <Icon icon="solar:star-linear" className="text-brand text-xl" />
                <h2 className="font-heading font-bold text-2xl md:text-3xl text-text-primary tracking-tighter">
                  Spotlight
                </h2>
              </div>

              <div className="relative bg-surface rounded-xl overflow-hidden border border-border shadow-sm">
                {isLoading ? (
                  <div className="h-[400px] animate-pulse bg-surface-2" />
                ) : spotlightContent && spotlightContent.people && (
                  <div className="flex flex-col md:flex-row items-stretch min-h-[400px]">
                    {/* 1. Artist Photo Cover (Left Pane) */}
                    <div className="md:w-[28%] relative h-64 md:h-auto overflow-hidden bg-surface-2 shrink-0">
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
                    <div className="md:w-[42%] p-8 flex flex-col justify-center shrink-0">
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
                          className="inline-flex items-center gap-2 px-5 py-2.5 bg-surface-2 hover:bg-brand/10 hover:text-brand border border-border rounded-lg text-[10px] font-black uppercase tracking-widest text-text-primary transition-all"
                        >
                          Explore More
                          <Icon icon="solar:arrow-right-linear" className="w-3.5 h-3.5" />
                        </Link>
                      </div>
                    </div>

                    {/* 3. Pane Divider */}
                    <div className="hidden md:block w-px bg-border my-8 shrink-0" />

                    {/* 4. Featured Works (Right Pane) */}
                    <div className="md:w-[30%] p-8 flex flex-col justify-center flex-1">
                      <h3 className="text-text-muted text-[10px] font-black uppercase tracking-widest mb-6">
                        Featured Works
                      </h3>
                      {spotlightContent.featured_films && spotlightContent.featured_films.length > 0 ? (
                        <div className="grid grid-cols-4 gap-3">
                          {spotlightContent.featured_films.map((film) => (
                            <Link
                              key={film.id}
                              to={`/film/${film.id}`}
                              className="group flex flex-col gap-1.5 transition-all"
                              title={film.title}
                            >
                              <div className="aspect-[2/3] w-full rounded-lg overflow-hidden border border-border bg-surface-2 relative shadow-md">
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
                        <div className="rounded-lg border border-dashed border-border p-6 text-center text-xs text-text-muted py-8">
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

        {/* 10. FEATURED ARTIST */}
        {(isLoading || spotlightPerson) && (
          <div className="border-b border-border">
            <section className="py-16">
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex items-end justify-between mb-10">
                  <div className="space-y-1">
                    <h2 className="font-heading font-bold text-2xl md:text-3xl text-text-primary tracking-tighter">
                      Featured Artist
                    </h2>
                    <p className="text-text-muted text-[10px] font-bold uppercase tracking-widest mt-1 opacity-60">The talent behind the camera</p>
                  </div>
                  <Link
                    to="/people"
                    className="text-brand text-[10px] font-bold uppercase tracking-widest hover:underline"
                  >
                    View all
                  </Link>
                </div>

                <div className="relative bg-surface rounded-xl p-8 md:p-12 overflow-hidden border border-border shadow-sm">
                  <div className="absolute inset-0 grid-bg opacity-10 pointer-events-none"></div>
                  <div className="relative z-10 flex flex-col xl:flex-row gap-12 xl:items-center">
                    <div className="xl:flex-1">
                      <PersonCard person={spotlightPerson} variant="full" isLoading={isLoading} />
                    </div>
                    <div className="h-px xl:w-px xl:h-64 bg-border"></div>
                    <div className="xl:w-80 flex justify-around xl:grid xl:grid-cols-2 gap-4">
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
              </div>
            </section>
          </div>
        )}

        {/* 11. BEHIND THE MAGIC (Crew Spotlights) */}
        {(isLoading || crewMembers.length > 0) && (
          <div className="border-b border-border py-16">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="flex items-end justify-between mb-12">
                <div className="space-y-1">
                  <h2 className="font-heading font-bold text-2xl md:text-3xl text-text-primary tracking-tighter">
                    Behind the Magic
                  </h2>
                  <p className="text-text-muted text-[10px] font-bold uppercase tracking-widest mt-1 opacity-65">
                    The creative crew crafting Nollywood's best stories
                  </p>
                </div>
                <Link to="/people?craft=crew" className="text-brand text-[10px] font-bold uppercase tracking-widest hover:underline">
                  Explore Crew
                </Link>
              </div>

              <div className="flex overflow-x-auto gap-6 pb-6 pt-2 scrollbar-hide touch-pan-x">
                {isLoading ? (
                  [...Array(6)].map((_, i) => (
                    <div key={i} className="shrink-0 w-44 bg-surface border border-border rounded-2xl p-5 text-center flex flex-col items-center gap-4">
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
                      className="shrink-0 w-44 bg-surface border border-border hover:border-brand rounded-2xl p-5 text-center transition-all group shadow-sm flex flex-col items-center gap-4"
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
                        <h4 className="font-bold text-text-primary text-sm group-hover:text-brand transition-colors line-clamp-1">
                          {crew.name}
                        </h4>
                        <span className="inline-block bg-brand/10 text-brand text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full">
                          {crew.known_for_department || 'Crew'}
                        </span>
                      </div>
                    </Link>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

          {/* — Zone label: The Industry — */}
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center gap-4 pt-16 pb-2">
            <span className="font-heading font-black text-xs tracking-[0.2em] uppercase text-brand whitespace-nowrap">The Industry</span>
            <span className="flex-1 h-px bg-border" />
          </div>

        {/* 12. NOLLYWOOD STUDIOS (Production Companies) */}
        {(isLoading || productionCompanies.length > 0) && (
          <div className="border-b border-border py-16 bg-surface-2/5">
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
                    <div key={i} className="shrink-0 w-64 bg-surface border border-border rounded-2xl p-6 flex flex-col gap-4">
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
                      <Link 
                        key={company.id}
                        to={`/companies/${company.slug || company.id}`}
                        className="shrink-0 w-64 bg-surface border border-border hover:border-brand rounded-2xl p-6 transition-all group shadow-sm flex flex-col gap-4"
                      >
                        <div className="flex items-center gap-4">
                          {company.logo_url ? (
                            <div className="w-12 h-12 rounded-xl bg-white p-1 border border-border flex items-center justify-center overflow-hidden shrink-0">
                              <img 
                                src={company.logo_url} 
                                alt={company.name}
                                className="w-full h-full object-contain group-hover:scale-110 transition-transform duration-500"
                              />
                            </div>
                          ) : (
                            <div className="w-12 h-12 rounded-xl bg-surface-2 flex items-center justify-center text-lg font-bold text-brand font-heading border border-border shrink-0">
                              {initial}
                            </div>
                          )}
                          <div className="min-w-0">
                            <h4 className="font-bold text-text-primary text-xs uppercase tracking-tight group-hover:text-brand transition-colors line-clamp-1 leading-tight">
                              {company.name}
                            </h4>
                            {company.founded_year && (
                              <p className="text-text-muted text-[8px] font-black uppercase tracking-widest mt-0.5 opacity-60">
                                EST. {company.founded_year}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="pt-2 border-t border-border flex items-center gap-1.5">
                          <Icon icon="solar:clapperboard-play-linear" className="text-text-muted text-xs" />
                          <span className="text-text-muted text-[8px] font-black uppercase tracking-widest">
                            {filmCount} {filmCount === 1 ? 'Film' : 'Films'} Produced
                          </span>
                        </div>
                      </Link>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        )}

        {/* 13. FEATURED CHANNELS */}
        {(isLoading || creators.length > 0) && (
          <div className="border-b border-border bg-surface-2/10 relative overflow-hidden">
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

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 border-t border-l border-border rounded-xl overflow-hidden shadow-sm">
                  {isLoading ? (
                    [...Array(6)].map((_, i) => (
                      <div key={i} className="bg-surface p-8 border-r border-b border-border flex items-center gap-5">
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
                          className="group bg-surface p-8 hover:bg-surface-2/50 transition-all duration-500 flex flex-col gap-6 border-r border-b border-border animate-in fade-in"
                        >
                          <div className="flex items-center gap-5">
                            <img 
                              src={stats.thumbnail || creator.photo_url || 'https://www.gravatar.com/avatar/00000000000000000000000000000000?d=mp&f=y'} 
                              alt={creator.name} 
                              className="w-16 h-16 rounded-lg object-cover shadow-sm border border-border group-hover:scale-105 transition-transform" 
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

        {/* 14. NEW MEMBER CTA BANNER (Issue 29) */}
        {!isAuthenticated && (
          <div className="px-4 sm:px-6 lg:px-8 py-16 border-t border-border/40">
            <div className="relative bg-gradient-to-br from-brand/20 via-surface-2 to-surface border border-border rounded-3xl p-8 md:p-16 overflow-hidden shadow-2xl text-center max-w-5xl mx-auto group">
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
                    className="bg-white/5 hover:bg-white/10 text-text-primary border border-border px-8 py-4 rounded-xl font-bold text-[11px] uppercase tracking-widest transition-all active:scale-95 shrink-0"
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
          <div className="relative bg-surface border border-border rounded-3xl p-6 md:p-8 max-w-md w-full shadow-2xl z-10 space-y-6 animate-in zoom-in-95 duration-200">
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
              <div className={`w-5 h-5 rounded border transition-all flex items-center justify-center ${dontShowAgain ? 'bg-brand border-brand' : 'border-border bg-surface-2 group-hover:border-brand/50'}`}>
                {dontShowAgain && <Icon icon="solar:check-read-linear" className="text-white text-xs" />}
              </div>
              <span className="text-xs text-text-muted font-bold group-hover:text-text-secondary transition-colors uppercase tracking-wider">
                Don't show this reminder again
              </span>
            </label>
            
            <div className="flex gap-4 pt-2">
              <button 
                onClick={() => setIsWarningModalOpen(false)}
                className="flex-1 bg-white/5 hover:bg-white/10 text-text-primary py-3.5 rounded-xl text-xs font-bold uppercase tracking-widest transition-all active:scale-95 border border-border"
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
