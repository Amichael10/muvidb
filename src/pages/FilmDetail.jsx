import { useState, useEffect, useRef } from 'react';
import { useParams, Link, useNavigate, useLoaderData } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { Icon } from '@iconify/react';
import { SuggestEditModal, ReportModal } from '../components/contribute/ContributeModals';
import { useWatchlist } from '../hooks/useWatchlist';
import { useReactions } from '../hooks/useReactions';
import ReviewSection from '../components/film/ReviewSection';
import CriticReviewsSection from '../components/film/CriticReviewsSection';
import PersonCard from '../components/person/PersonCard';
import FilmCard from '../components/film/FilmCard';
import LikedScore from '../components/film/LikedScore';
import WatchOptions from '../components/film/WatchOptions';
import { PLATFORMS, isFilmOnPlatform, getWatchUrl } from '../lib/platforms';
import { getFilmBackdrop, getFilmPoster } from '../lib/filmImages';
import { Skeleton } from '../components/ui/Skeleton';
import ShareAction from '../components/ui/ShareAction';
import { slugOrId } from '../utils/slug';
import { getShowName } from '../utils/series';
import ImageWithFallback from '../components/ui/ImageWithFallback';
import { formatFilmTitle, toSentenceCase, formatPersonName, toTitleCase } from '../utils/format';
import { formatRole } from '../lib/creditRoles';

const genreKey = (genre) => {
  const aliases = {
    comedies: 'comedy',
    dramas: 'drama',
    epics: 'epic',
    musicals: 'musical',
    romances: 'romance',
    thrillers: 'thriller',
  };
  const normalized = String(genre || '').trim().toLowerCase();
  return aliases[normalized] || normalized;
};

const dedupeGenres = (genres = []) => {
  const seen = new Set();
  return genres.filter((genre) => {
    const key = genreKey(genre);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const youtubeId = (value) => {
  if (!value) return null;
  const text = String(value).trim();
  if (/^[\w-]{11}$/.test(text)) return text;
  return text.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|shorts\/|watch\?v=))([\w-]{11})/)?.[1] || null;
};

const FilmDetailSkeleton = () => (
    <div className="w-full bg-bg min-h-screen">
        <div className="relative w-full h-[60vh] min-h-[500px] bg-surface-2/10 border-b border-border overflow-hidden">
            <div className="absolute inset-0 bg-surface-2 animate-shimmer opacity-20" />
            <div className="absolute inset-0 bg-gradient-to-r from-bg via-bg/40 to-transparent"></div>
            <div className="absolute bottom-0 left-0 w-full">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 border-x border-white/5 flex flex-col md:flex-row items-start md:items-end gap-6 md:gap-8 pb-8">
                    <div className="hidden md:block w-64 h-96 bg-surface-2 rounded-xl animate-shimmer shrink-0 shadow-2xl border border-white/10"></div>
                    <div className="flex-1 space-y-6 w-full pb-4">
                        <div className="space-y-4">
                            <div className="h-12 w-2/3 bg-surface-2 rounded-lg animate-shimmer"></div>
                            <div className="h-4 w-1/3 bg-surface-2 rounded-md animate-shimmer opacity-60"></div>
                        </div>
                        <div className="flex gap-2">
                            <div className="h-6 w-20 bg-surface-2 rounded-md animate-shimmer"></div>
                            <div className="h-6 w-20 bg-surface-2 rounded-md animate-shimmer"></div>
                            <div className="h-6 w-20 bg-surface-2 rounded-md animate-shimmer"></div>
                        </div>
                        <div className="h-10 w-48 bg-surface-2 rounded-lg animate-shimmer"></div>
                    </div>
                </div>
            </div>
        </div>

        <div className="max-w-7xl mx-auto border-x border-border min-h-[600px]">
            <div className="grid grid-cols-1 lg:grid-cols-3 divide-y lg:divide-y-0 lg:divide-x divide-border">
                <div className="lg:col-span-2">
                    <div className="p-8 md:p-12 border-b border-border space-y-6">
                        <div className="h-8 w-48 bg-surface-2 rounded-md animate-shimmer" />
                        <div className="space-y-3">
                            <div className="h-4 w-full bg-surface-2 rounded animate-shimmer" />
                            <div className="h-4 w-full bg-surface-2 rounded animate-shimmer" />
                            <div className="h-4 w-4/5 bg-surface-2 rounded animate-shimmer" />
                        </div>
                    </div>
                    <div className="p-8 md:p-12 border-b border-border space-y-6 bg-surface-2/5">
                        <div className="h-8 w-56 bg-surface-2 rounded-md animate-shimmer" />
                        <div className="aspect-video w-full bg-surface-2 rounded-xl border border-border animate-shimmer" />
                    </div>
                    <div className="p-8 md:p-12 border-b border-border space-y-8">
                        <div className="h-8 w-32 bg-surface-2 rounded-md animate-shimmer" />
                        <div className="flex gap-8 overflow-hidden">
                            {[1, 2, 3, 4, 5].map(i => (
                                <div key={i} className="shrink-0 w-32 space-y-3">
                                    <div className="w-32 h-32 bg-surface-2 rounded-xl border border-border animate-shimmer" />
                                    <div className="h-3 w-full bg-surface-2 rounded animate-shimmer" />
                                    <div className="h-2 w-1/2 bg-surface-2 rounded animate-shimmer opacity-60" />
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
                <div className="lg:col-span-1 divide-y divide-border">
                    <div className="p-8">
                        <div className="h-24 w-full bg-surface-2 rounded-xl border border-border animate-shimmer" />
                    </div>
                    <div className="p-8 space-y-6 bg-surface-2/5">
                        <div className="h-4 w-24 bg-surface-2 rounded animate-shimmer" />
                        <div className="space-y-4">
                            {[1, 2, 3, 4].map(i => (
                                <div key={i} className="flex justify-between items-center pb-3 border-b border-border last:border-0 last:pb-0">
                                    <div className="h-3 w-16 bg-surface-2 rounded animate-shimmer" />
                                    <div className="h-3 w-20 bg-surface-2 rounded animate-shimmer" />
                                </div>
                            ))}
                        </div>
                    </div>
                    <div className="p-8 space-y-4">
                        <div className="h-12 w-full bg-surface-2 rounded-lg animate-shimmer" />
                        <div className="h-12 w-full bg-surface-2 rounded-lg animate-shimmer" />
                    </div>
                </div>
            </div>
        </div>
    </div>
)

export default function FilmDetail() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  // The route loader (src/routes/film-detail.tsx) already fetched this film
  // server-side to build the SEO head, so the same row seeds the page and the
  // first paint has real content. Unpublished films aren't seeded (the loader
  // filters on is_published) and fall back to the client fetch below.
  const loaderData = useLoaderData();
  const seededFilm = loaderData?.film
    ? {
        ...loaderData.film,
        genres: dedupeGenres(
          loaderData.film.film_genres?.map((fg) => fg.genres?.name).filter(Boolean) || []
        ),
      }
    : null;

  const [film, setFilm] = useState(seededFilm);
  const [filmId, setFilmId] = useState(seededFilm?.id ?? null); // actual UUID for sub-queries
  const [relatedFilms, setRelatedFilms] = useState([]);
  // Starts false when seeded — otherwise the server renders the loading state
  // and SSR gains nothing.
  const [loading, setLoading] = useState(!seededFilm);
  const [episodes, setEpisodes] = useState([]);
  const [episodeSearch, setEpisodeSearch] = useState('');
  const [episodeSeasonFilter, setEpisodeSeasonFilter] = useState('all');
  const [parentSeries, setParentSeries] = useState(null);

  const fetchEpisodes = async (seriesId, showName) => {
    try {
      // Prefer manually linked children (series_id), then fall back to title variants.
      let linked = [];
      if (seriesId) {
        const { data, error } = await supabase
          .from('films')
          .select('id, title, poster_url, youtube_watch_url, episode_number, season_number, synopsis, runtime_minutes, slug')
          .eq('series_id', seriesId)
          .order('title', { ascending: true });
        if (error) throw error;
        linked = data || [];
      }

      let byTitle = [];
      if (showName) {
        const { data, error } = await supabase
          .from('films')
          .select('id, title, poster_url, youtube_watch_url, episode_number, season_number, synopsis, runtime_minutes, slug')
          .eq('content_type', 'series')
          .ilike('title', `${showName}%`)
          .order('title', { ascending: true });
        if (error) throw error;
        byTitle = data || [];
      }

      const seen = new Set();
      const merged = [...linked, ...byTitle].filter((ep) => {
        if (!ep?.id || seen.has(ep.id) || ep.id === seriesId) return false;
        seen.add(ep.id);
        return true;
      });
      setEpisodes(merged);
    } catch (error) {
      console.error('Error fetching episodes:', error);
    }
  };

  const fetchParentSeries = async (parentId) => {
    try {
      const { data, error } = await supabase
        .from('films')
        .select('id, title, slug')
        .eq('id', parentId)
        .single();
      if (!error && data) {
        setParentSeries(data);
      }
    } catch (e) {
      console.error('Error fetching parent series:', e);
    }
  };

  const {
    inWatchlist,
    loading: watchlistLoading,
    toggleWatchlist
  } = useWatchlist(filmId, user);

  const {
    userReaction,
    likesCount,
    dislikesCount,
    loading: reactionLoading,
    toggleReaction
  } = useReactions(filmId, user);

  const [cast, setCast] = useState([]);
  const [crew, setCrew] = useState([]);
  const [showFilmEdit, setShowFilmEdit] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [showAllCast, setShowAllCast] = useState(false);
  const [awardsOpen, setAwardsOpen] = useState(false);

  // For the slug the loader seeded, hand the row straight to fetchFilm so it
  // skips the primary query but STILL runs the follow-on work (credits,
  // episodes, related). Navigating to another film refetches normally.
  const seededSlug = useRef(seededFilm ? slug : null);

  useEffect(() => {
    setEpisodeSearch('');
    setEpisodeSeasonFilter('all');
    let preloaded = null;
    if (seededSlug.current === slug) {
      preloaded = loaderData?.film ?? null;
      seededSlug.current = null; // one-shot
    }
    fetchFilm(preloaded);
  }, [slug]);

  const fetchCredits = async (uuid) => {
    try {
      const fetchDirect = async () => {
        const { data: fallbackData, error: fallbackError } = await supabase
          .from('credits')
          .select('id, role, character_name, billing_order, people(id, name, photo_url, popularity_score, slug)')
          .eq('film_id', uuid)
          .order('billing_order', { ascending: true });
        if (fallbackError) throw fallbackError;
        return fallbackData || [];
      };

      let data = [];
      if (import.meta.env.DEV) {
        data = await fetchDirect();
      } else {
        const res = await fetch(`/api/content?resource=film-credits&filmId=${encodeURIComponent(uuid)}`);
        if (res.ok) {
          ({ credits: data } = await res.json());
        } else {
          data = await fetchDirect();
        }
      }

      const deduplicateAndMerge = (members) => {
        const map = new Map();
        members.forEach(m => {
          if (!map.has(m.id)) {
            map.set(m.id, { ...m });
          } else {
            const existing = map.get(m.id);
            if (m.role && !existing.role.includes(m.role)) {
              existing.role = `${existing.role}, ${m.role}`;
            }
          }
        });
        return Array.from(map.values());
      };

      const castMembersRaw = data
        .filter(c => {
          const role = (c.role || '').trim().toLowerCase();
          return role === 'actor' || role === 'cast';
        })
        .map(c => {
          const person = Array.isArray(c.people) ? c.people[0] : c.people;
          return person ? { ...person, role: c.character_name || 'Cast' } : null;
        })
        .filter(Boolean);
        
      const crewMembersRaw = data
        .filter(c => {
          const role = (c.role || '').trim().toLowerCase();
          return role !== 'actor' && role !== 'cast';
        })
        .map(c => {
          const person = Array.isArray(c.people) ? c.people[0] : c.people;
          return person ? { ...person, role: formatRole(c.role) || 'Crew' } : null;
        })
        .filter(Boolean);

      const castMembers = deduplicateAndMerge(castMembersRaw);
      const crewMembers = deduplicateAndMerge(crewMembersRaw);

      setCast(castMembers);
      setCrew(crewMembers);
      
      // Extract director if available
      const dir = crewMembers.find(m => (m.role || '').toLowerCase().includes('director'));
      if (dir) {
        setFilm(prev => prev ? { ...prev, director: dir.name } : null);
      }
    } catch (error) {
      console.error('Error fetching credits:', error);
    }
  };

  // `preloaded` is the row the route loader already fetched server-side. When
  // present the primary query is skipped, but everything after it still runs.
  const fetchFilm = async (preloaded = null) => {
    if (!preloaded) setLoading(true);
    try {
      const { col, val } = slugOrId(slug);
      const fetchDirect = async () => {
        // Belt-and-suspenders with films RLS (is_published OR is_admin()).
        // Non-admins must only see published rows; admins can preview drafts.
        const isStaff = user?.role === 'admin' || user?.role === 'admin_limited';
        let query = supabase
          .from('films')
          .select(`
            *,
            film_genres(genre_id, genres(name)),
            film_companies(
              companies(id, name, logo_url)
            )
          `)
          .eq(col, val);
        if (!isStaff) query = query.eq('is_published', true);
        const { data, error } = await query.single();
        if (error) throw error;
        return data;
      };

      let data = preloaded;
      if (!data) {
        if (import.meta.env.DEV) {
          data = await fetchDirect();
        } else {
          const response = await fetch(`/api/films?id=${encodeURIComponent(val)}`);
          if (response.ok) {
            ({ film: data } = await response.json());
          } else if (response.status === 404) {
            throw new Error('Film not found');
          } else {
            data = await fetchDirect();
          }
        }
      }

      const mappedFilm = {
        ...data,
        genres: dedupeGenres(data.film_genres?.map(fg => fg.genres?.name).filter(Boolean) || [])
      };

      setFilm(mappedFilm);
      setFilmId(data.id);
      // Title comes from the route's `meta` export now — setting it here would
      // overwrite the server-rendered one after hydration.
      // Render the page as soon as the main film row is in — everything below
      // (credits, episodes, related) loads in the background instead of blocking.
      setLoading(false);

      fetchCredits(data.id);
      if (data.content_type === 'series') {
        fetchEpisodes(data.id, getShowName(data.title));
      } else if (data.series_id) {
        fetchParentSeries(data.series_id);
      }
      fetchRelated(data);
    } catch (error) {
      console.error('Error fetching film:', error);
      setLoading(false);
    }
  };

  const fetchRelated = async (film) => {
    // Precomputed "More Like This" first — one indexed read of film_related,
    // built offline by scripts/build_related_films.ts (shared cast > Cohere
    // embedding similarity > rare genre > language > series, with popularity
    // fallback and dup/franchise de-duping).
    // Falls through to the live genre query below only when a film has no
    // precomputed rows yet (e.g. added since the last rebuild).
    try {
      const { data: pre } = await supabase
        .from('film_related')
        .select('rank, reason, films:related_id (id, title, year, poster_url, backdrop_url, slug, view_count, content_type, film_genres(genres(name)))')
        .eq('film_id', film.id)
        .order('rank', { ascending: true })
        .limit(12);

      if (pre?.length) {
        const mapped = pre
          .filter((r) => r.films)
          .map((r) => ({
            ...r.films,
            _reason: r.reason || null,
            genres: dedupeGenres(r.films.film_genres?.map((fg) => fg.genres?.name).filter(Boolean) || []),
          }));
        if (mapped.length) {
          setRelatedFilms(mapped);
          return;
        }
      }
    } catch {
      // Table missing or read failed — fall back to the live logic below.
    }

    const sourceGenreIds = (film.film_genres || []).map((row) => row.genre_id).filter(Boolean);
    let candidateIds = [];

    if (sourceGenreIds.length > 0) {
      const { data: candidateRows } = await supabase
        .from('film_genres')
        .select('film_id')
        .in('genre_id', sourceGenreIds)
        .neq('film_id', film.id)
        .limit(100);

      const matchCounts = new Map();
      for (const row of candidateRows || []) {
        matchCounts.set(row.film_id, (matchCounts.get(row.film_id) || 0) + 1);
      }
      candidateIds = [...matchCounts.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 24)
        .map(([id]) => id);
    }

    if (candidateIds.length === 0) {
      const { data: fallbackRows } = await supabase
        .from('films')
        .select('id')
        .neq('id', film.id)
        .limit(12);
      candidateIds = (fallbackRows || []).map((row) => row.id);
    }

    if (candidateIds.length === 0) {
      setRelatedFilms([]);
      return;
    }

    let query = supabase
      .from('films')
      .select(`id, title, year, poster_url, backdrop_url, slug, view_count, content_type, film_genres(genres(name))`)
      .in('id', candidateIds);
    if (film.content_type) query = query.eq('content_type', film.content_type);

    const { data: related } = await query;
    const sourceGenres = new Set(dedupeGenres(
      film.film_genres?.map((fg) => fg.genres?.name).filter(Boolean) || []
    ).map(genreKey));
    const ranked = (related || [])
      .map((candidate) => {
        const genres = dedupeGenres(candidate.film_genres?.map((fg) => fg.genres?.name).filter(Boolean) || []);
        const sharedGenres = genres.filter((genre) => sourceGenres.has(genreKey(genre))).length;
        const yearDistance = Math.abs((candidate.year || film.year || 0) - (film.year || candidate.year || 0));
        return { ...candidate, genres, _relatedScore: (sharedGenres * 100) - Math.min(yearDistance, 30) };
      })
      .sort((a, b) => b._relatedScore - a._relatedScore || (b.view_count || 0) - (a.view_count || 0))
      .slice(0, 4);

    setRelatedFilms(ranked);
  };

  const handleWatchlist = async () => {
    if (!user) {
      navigate('/login', {
        state: { from: `/films/${film?.slug || film?.id || slug}`, message: 'Sign in to add films to your watchlist' }
      });
      return;
    }
    await toggleWatchlist();
  };

  const handleReaction = async (type) => {
    if (!user) {
      navigate('/login', {
        state: { from: `/films/${film?.slug || film?.id || slug}`, message: `Sign in to ${type} films` }
      });
      return;
    }
    const ok = await toggleReaction(type);
    if (!ok || !filmId) return;
    // Trigger recomputes liked_percent in the DB; refresh popcorn % without reload.
    const { data } = await supabase
      .from('films')
      .select('liked_percent')
      .eq('id', filmId)
      .maybeSingle();
    if (data && Object.prototype.hasOwnProperty.call(data, 'liked_percent')) {
      setFilm((prev) => (prev ? { ...prev, liked_percent: data.liked_percent } : prev));
    }
  };



  if (loading) return <FilmDetailSkeleton />;

  if (!film) {
    return (
      <div className="w-full min-h-screen bg-bg flex items-center justify-center">
        <div className="max-w-7xl mx-auto px-4 border-x border-border py-32 text-center w-full">
          <Icon icon="solar:clapperboard-play-linear" className="text-4xl mx-auto mb-4 opacity-20 text-brand" />
          <p className="text-text-primary font-heading font-bold text-xl tracking-tighter mb-8">Movie not found</p>
          <button onClick={() => navigate('/browse')} className="bg-brand text-white font-bold px-8 py-4 rounded-lg hover:shadow-brand/20 transition-all">
            ← Browse Movies
          </button>
        </div>
      </div>
    );
  }

  const trailerVideoId = youtubeId(film.trailer_youtube_id);
  const availablePlatforms = PLATFORMS.filter((platform) => isFilmOnPlatform(film, platform.id));

  return (
    <div className="w-full bg-bg min-h-screen pb-20">
      {/* 1. CINEMATIC HEADER */}
      <div className="relative w-full h-[60vh] min-h-[500px] border-b border-border overflow-hidden">
        <ImageWithFallback
          src={getFilmBackdrop(film)}
          alt={`${formatFilmTitle(film.title)} Backdrop`} 
          className="absolute inset-0 w-full h-full object-cover"
          fallbackType="film"
          name={formatFilmTitle(film.title)}
          width={1600}
          quality={78}
          sizes="100vw"
          loading="eager"
          fetchPriority="high"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-black/90 via-black/40 to-transparent w-full md:w-1/2"></div>
        <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-bg to-transparent"></div>

        <div className="absolute bottom-0 left-0 w-full">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 border-x border-white/5 flex flex-col md:flex-row items-start md:items-end gap-6 md:gap-8 pb-8">
            <div className="hidden md:block w-64 shrink-0 translate-y-16 z-10">
              <ImageWithFallback
                src={getFilmPoster(film)}
                alt={`${formatFilmTitle(film.title)} Poster`} 
                className="w-full rounded-xl shadow-2xl border border-white/10 object-cover aspect-[2/3]"
                fallbackType="film"
                name={formatFilmTitle(film.title)}
                width={512}
                sizes="256px"
                loading="eager"
              />
            </div>

            <div className="flex-1 z-10 w-full">
              {parentSeries && (
                <Link 
                  to={`/films/${parentSeries.slug || parentSeries.id}`}
                  className="inline-flex items-center gap-1.5 bg-brand/10 border border-brand/20 text-brand px-2.5 py-1 rounded-md text-[10px] font-bold tracking-wide uppercase mb-3 hover:bg-brand/20 transition-all"
                >
                  <Icon icon="solar:tv-bold" className="text-xs" />
                  <span>Part of Series: {parentSeries.title}</span>
                </Link>
              )}
              <h1 className="font-heading font-bold text-3xl sm:text-4xl md:text-6xl text-white mb-4 leading-tight tracking-tighter drop-shadow-2xl">
                {formatFilmTitle(film.title)}
              </h1>

              <div className="flex flex-wrap items-center gap-3 md:gap-4 text-xs text-white/80 font-bold mb-4">
                <span>{film.year}</span>
                <span className="w-1 h-1 rounded-full bg-white/20"></span>
                <span>
                  {film.content_type === 'series'
                    ? (film.season_count ? `${film.season_count} Season${film.season_count > 1 ? 's' : ''}` : 'TV Series')
                    : `${film.runtime_minutes || film.runtime || 0} min`}
                </span>
                {/* Language hidden until per-film detection is accurate (data is ~99.7% default English) */}
                <span className="w-1 h-1 rounded-full bg-white/20"></span>
                <span className="bg-brand text-white px-2 py-0.5 rounded text-[10px] font-bold">
                  {film.nfvcb_rating}
                </span>
                {(() => {
                  const domGross = film.box_office_domestic || film.streaming_links?.box_office?.domestic;
                  if (!domGross) return null;
                  const currency = film.box_office_currency || film.streaming_links?.box_office?.currency || 'NGN';
                  const symbol = currency === 'NGN' ? '₦' : `${currency} `;
                  const formatted = domGross >= 1_000_000_000 
                    ? `${(domGross / 1_000_000_000).toFixed(2)}B` 
                    : `${(domGross / 1_000_000).toFixed(1)}M`;

                  return (
                    <>
                      <span className="w-1 h-1 rounded-full bg-white/20"></span>
                      <span className="inline-flex items-center gap-1.5 bg-gradient-to-r from-amber-500/30 to-brand/30 border border-amber-500/50 text-amber-300 px-2.5 py-0.5 rounded text-[10px] font-black shadow-lg backdrop-blur-md">
                        <Icon icon="solar:ticket-bold" className="text-amber-400 text-xs" />
                        <span>Box Office: {symbol}{formatted}</span>
                      </span>
                    </>
                  );
                })()}
                {film.is_in_cinemas && (
                  <span className="bg-gold text-bg px-2 py-0.5 rounded text-[10px] font-bold border border-gold uppercase tracking-wider">
                    In Cinemas
                  </span>
                )}
                {(film.coming_soon || film.status === 'upcoming') && (
                  <span className="bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded text-[10px] font-bold border border-blue-500/30 uppercase tracking-wider">
                    Coming Soon
                  </span>
                )}
                {film.status && !['released', 'upcoming'].includes(film.status) && (
                  <span className="bg-surface-2 text-text-primary px-2 py-0.5 rounded text-[10px] font-bold border border-border capitalize">
                    {film.status.replace('-', ' ')}
                  </span>
                )}
              </div>

              <div className="flex flex-wrap gap-2 mb-6">
                {(film.genres || []).map(genre => (
                  <span key={genre} className="px-3 py-1 text-[10px] font-bold bg-black/40 backdrop-blur-md text-white rounded-lg border border-white/10">
                    {genre}
                  </span>
                ))}
              </div>

              <div className="flex flex-wrap items-end gap-6">
                {film.liked_percent != null ? (
                  <LikedScore percent={film.liked_percent} variant="hero" />
                ) : (
                  <button 
                    onClick={() => {
                      const el = document.getElementById('reviews-section');
                      if (el) el.scrollIntoView({ behavior: 'smooth' });
                    }}
                    className="flex items-center gap-2 bg-brand/10 border border-brand/20 text-brand px-3 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-brand/20 transition-all duration-300 cursor-pointer active:scale-95 shadow-md shadow-brand/5 mb-1 shrink-0"
                  >
                    <Icon icon="solar:star-bold" className="text-xs" />
                    <span>Be the first to rate</span>
                  </button>
                )}
              </div>
            </div>

            {/* Right-Hand Side Box inside Hero Section */}
            {(() => {
              const domGross = film.box_office_domestic || film.streaming_links?.box_office?.domestic;
              if (!domGross) return null;
              const currency = film.box_office_currency || film.streaming_links?.box_office?.currency || 'NGN';
              const symbol = currency === 'NGN' ? '₦' : `${currency} `;
              const formatted = domGross >= 1_000_000_000 
                ? `${(domGross / 1_000_000_000).toFixed(2)} Billion` 
                : `${(domGross / 1_000_000).toFixed(1)} Million`;
              const rawFormatted = Number(domGross).toLocaleString('en-NG');

              return (
                <div className="hidden lg:flex flex-col items-end justify-end shrink-0 z-10 self-end mb-1">
                  <div className="p-4 rounded-2xl bg-black/70 border border-amber-500/40 backdrop-blur-xl shadow-2xl shadow-amber-500/20 max-w-xs w-full text-right space-y-2">
                    <div className="flex items-center justify-end gap-1.5 text-[10px] font-bold text-amber-400 uppercase tracking-widest">
                      <Icon icon="solar:ticket-bold" className="text-amber-400 text-sm" />
                      <span>Box Office Revenue</span>
                    </div>
                    <p className="text-2xl font-black text-white font-heading tracking-tight leading-none">
                      {symbol}{rawFormatted}
                    </p>
                    <div className="flex items-center justify-between pt-2 border-t border-amber-500/20 text-[10px] font-bold">
                      <span className="text-amber-300/90 font-mono">({symbol}{formatted})</span>
                      <span className="text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded uppercase text-[9px] border border-amber-500/30">
                        Verified CEAN
                      </span>
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      </div>

      {/* 2. CONTENT SECTION */}
      <div className="max-w-7xl mx-auto border-x border-border min-h-[600px]">
        <section className="lg:hidden p-4 sm:p-6 border-b border-border bg-surface/40 space-y-4">
          <WatchOptions film={film} isFullWidth />
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={handleWatchlist}
              disabled={watchlistLoading}
              className={`min-h-[52px] rounded-lg border flex flex-col items-center justify-center gap-1 text-xs font-bold transition-colors disabled:opacity-50 ${inWatchlist ? 'bg-brand text-white border-brand' : 'bg-surface border-border text-text-primary'}`}
            >
              <Icon icon={inWatchlist ? 'solar:bookmark-bold' : 'solar:bookmark-linear'} width="18" />
              {inWatchlist ? 'Saved' : 'Watchlist'}
            </button>
            <button
              type="button"
              onClick={() => handleReaction('like')}
              disabled={reactionLoading}
              className={`min-h-[52px] rounded-lg border flex flex-col items-center justify-center gap-1 text-xs font-bold transition-colors disabled:opacity-50 ${userReaction === 'like' ? 'bg-brand/10 border-brand text-brand' : 'bg-surface border-border text-text-primary'}`}
            >
              <Icon icon={userReaction === 'like' ? 'solar:like-bold' : 'solar:like-linear'} width="18" />
              {likesCount} Like
            </button>
            <button
              type="button"
              onClick={() => document.getElementById('reviews-section')?.scrollIntoView({ behavior: 'smooth' })}
              className="min-h-[52px] rounded-lg border border-border bg-surface text-text-primary flex flex-col items-center justify-center gap-1 text-xs font-bold"
            >
              <Icon icon="solar:star-linear" width="18" />
              Rate
            </button>
          </div>
          {availablePlatforms.length > 0 && (
            <div className="pt-1">
              <p className="text-xs font-bold text-text-muted mb-2">Where to watch</p>
              <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
                {availablePlatforms.map((platform) => {
                  const url = getWatchUrl(film, platform.id);
                  const className = 'shrink-0 inline-flex items-center gap-2 min-h-[40px] px-3 rounded-lg border border-border bg-surface text-xs font-bold text-text-primary';
                  const mark = platform.logo ? (
                    <span className="w-6 h-6 rounded-md bg-white overflow-hidden shrink-0 inline-flex items-center justify-center">
                      <img src={platform.logo} alt="" className="w-full h-full object-contain p-0.5" loading="lazy" />
                    </span>
                  ) : (
                    <span
                      className="w-6 h-6 rounded-md inline-flex items-center justify-center shrink-0"
                      style={{ background: `${platform.color}22`, color: platform.color }}
                    >
                      <Icon icon={platform.icon} width="14" height="14" />
                    </span>
                  );
                  const content = <>{mark}{platform.name}</>;
                  return url ? (
                    <a key={platform.id} href={url} target="_blank" rel="noopener noreferrer" className={className}>{content}</a>
                  ) : (
                    <Link key={platform.id} to={`/watch/${platform.id}`} className={className}>{content}</Link>
                  );
                })}
              </div>
            </div>
          )}
        </section>
        <div className="grid grid-cols-1 lg:grid-cols-3 divide-y lg:divide-y-0 lg:divide-x divide-border">

          {/* MAIN CONTENT (70%) — story → media → people → reviews → awards */}
          <div className="lg:col-span-2">
            {/* Synopsis */}
            <section className="p-8 md:p-12 border-b border-border">
              <h2 className="font-heading font-bold text-2xl md:text-[1.75rem] text-text-primary mb-6 tracking-tight leading-none">Synopsis</h2>
              <p className="text-text-muted text-lg leading-relaxed opacity-80 border-l-2 border-brand pl-6">
                {toSentenceCase(film.synopsis)}
              </p>
              <div className="flex flex-wrap items-center gap-4 mt-6">
                <button
                  onClick={() => setShowFilmEdit(true)}
                  className="inline-flex items-center gap-1.5 text-text-muted hover:text-brand text-[11px] font-bold transition-colors"
                >
                  <Icon icon="solar:pen-2-linear" width="14" />
                  Suggest an edit
                </button>
                <button
                  onClick={() => setShowReport(true)}
                  className="inline-flex items-center gap-1.5 text-text-muted hover:text-red-500 text-[11px] font-bold transition-colors"
                >
                  <Icon icon="solar:flag-linear" width="14" />
                  Report a broken / pirate link
                </button>
              </div>
              {showFilmEdit && (
                <SuggestEditModal
                  target="film"
                  targetId={filmId}
                  targetName={formatFilmTitle(film.title)}
                  current={{
                    title: film.title,
                    year: film.year,
                    synopsis: film.synopsis,
                    runtime_minutes: film.runtime_minutes ?? film.duration,
                    language: film.language,
                    countries: film.countries,
                    trailer_youtube_id: film.trailer_youtube_id,
                    tagline: film.tagline,
                  }}
                  onClose={() => setShowFilmEdit(false)}
                />
              )}
              {showReport && (
                <ReportModal kind="link" targetId={filmId} targetName={formatFilmTitle(film.title)} onClose={() => setShowReport(false)} />
              )}
            </section>

            {/* Episodes (for series) */}
            {episodes.length > 0 && (() => {
              const seasonOptions = [...new Set(
                episodes.map((ep) => ep.season_number).filter((n) => n != null),
              )].sort((a, b) => a - b);

              const q = episodeSearch.trim().toLowerCase();
              const filteredEpisodes = episodes.filter((ep) => {
                if (episodeSeasonFilter !== 'all' && String(ep.season_number ?? '') !== episodeSeasonFilter) {
                  return false;
                }
                if (!q) return true;
                return (
                  (ep.title || '').toLowerCase().includes(q)
                  || String(ep.episode_number ?? '').includes(q)
                  || (ep.synopsis || '').toLowerCase().includes(q)
                );
              });

              return (
              <section className="p-8 md:p-12 border-b border-border bg-surface-2/5">
                <div className="flex flex-col gap-5 mb-6">
                  <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
                    <h2 className="font-heading font-bold text-2xl md:text-[1.75rem] text-text-primary tracking-tight leading-none flex items-center gap-2">
                      <Icon icon="solar:playlist-play-bold" className="text-brand" />
                      Episodes
                      <span className="text-sm font-bold text-text-muted tracking-normal">
                        ({filteredEpisodes.length}{filteredEpisodes.length !== episodes.length ? ` / ${episodes.length}` : ''})
                      </span>
                    </h2>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-3">
                    <div className="relative flex-1">
                      <Icon
                        icon="solar:magnifer-linear"
                        className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted text-lg pointer-events-none"
                      />
                      <input
                        type="search"
                        value={episodeSearch}
                        onChange={(e) => setEpisodeSearch(e.target.value)}
                        placeholder="Search episodes by title or number…"
                        className="w-full bg-surface border border-border rounded-lg pl-10 pr-4 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:border-brand focus:outline-none transition-colors"
                      />
                    </div>
                    {seasonOptions.length > 0 && (
                      <select
                        value={episodeSeasonFilter}
                        onChange={(e) => setEpisodeSeasonFilter(e.target.value)}
                        className="bg-surface border border-border rounded-lg px-4 py-2.5 text-sm font-bold text-text-primary focus:border-brand focus:outline-none sm:w-44"
                      >
                        <option value="all">All seasons</option>
                        {seasonOptions.map((season) => (
                          <option key={season} value={String(season)}>
                            Season {season}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                </div>

                {filteredEpisodes.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-border bg-surface/60 px-6 py-12 text-center">
                    <p className="text-sm font-bold text-text-muted">No episodes match your search.</p>
                    <button
                      type="button"
                      onClick={() => { setEpisodeSearch(''); setEpisodeSeasonFilter('all'); }}
                      className="mt-3 text-xs font-bold uppercase tracking-widest text-brand hover:underline"
                    >
                      Clear filters
                    </button>
                  </div>
                ) : (
                <div className="flex flex-col gap-4">
                  {filteredEpisodes.map((episode) => (
                    <div 
                      key={episode.id} 
                      className="flex flex-col sm:flex-row gap-4 bg-surface p-4 rounded-xl border border-border hover:border-brand/40 hover:shadow-xl transition-all duration-300 group"
                    >
                      {/* Episode Thumbnail */}
                      <div className="relative w-full sm:w-48 aspect-video rounded-lg overflow-hidden bg-surface-2 shrink-0 border border-white/5">
                        <ImageWithFallback
                          src={episode.poster_url || film.poster_url || film.poster}
                          alt={episode.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                          fallbackType="film"
                          name={episode.title}
                          width={384}
                          sizes="(max-width: 639px) 100vw, 192px"
                          loading="lazy"
                        />
                        {episode.youtube_watch_url && (
                          <a 
                            href={episode.youtube_watch_url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                          >
                            <span className="w-10 h-10 rounded-full bg-brand text-white flex items-center justify-center shadow-lg transform scale-90 group-hover:scale-100 transition-transform duration-300">
                              <Icon icon="solar:play-bold" className="text-sm" />
                            </span>
                          </a>
                        )}
                      </div>
                      
                      {/* Episode Info */}
                      <div className="flex-1 flex flex-col justify-between py-1">
                        <div>
                          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                            {episode.season_number != null && (
                              <span className="text-[10px] font-black uppercase tracking-wider text-text-muted">
                                S{episode.season_number}
                              </span>
                            )}
                            <span className="text-[10px] font-black uppercase tracking-wider text-brand">
                              Episode {episode.episode_number || 'N/A'}
                            </span>
                            {episode.runtime_minutes && (
                              <>
                                <span className="w-1 h-1 rounded-full bg-white/20" />
                                <span className="text-[10px] font-bold text-text-muted">
                                  {episode.runtime_minutes} min
                                </span>
                              </>
                            )}
                          </div>
                          <h3 className="font-heading font-bold text-base text-text-primary tracking-tight leading-snug group-hover:text-brand transition-colors mb-2">
                            <Link to={`/films/${episode.slug || episode.id}`}>
                              {formatFilmTitle(episode.title)}
                            </Link>
                          </h3>
                          <p className="text-xs text-text-muted line-clamp-2 leading-relaxed font-medium">
                            {toSentenceCase(episode.synopsis || film.synopsis)}
                          </p>
                        </div>
                        
                        {episode.youtube_watch_url && (
                          <div className="mt-3 sm:mt-0">
                            <a 
                              href={episode.youtube_watch_url} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-brand hover:text-white transition-colors"
                            >
                              <Icon icon="simple-icons:youtube" className="text-[#FF0000] text-xs" />
                              <span>Watch Episode</span>
                            </a>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                )}
              </section>
              );
            })()}

            {/* Trailer */}
            {trailerVideoId && (
              <section id="trailer-section" className="p-8 md:p-12 border-b border-border bg-surface-2/10 relative overflow-hidden">
                <div className="absolute inset-0 grid-bg opacity-20 pointer-events-none"></div>
                <h2 className="font-heading font-bold text-2xl md:text-[1.75rem] text-text-primary mb-6 tracking-tight leading-none relative z-10">Official Trailer</h2>
                <div className="relative z-10 aspect-video rounded-xl overflow-hidden border border-border bg-surface-2 shadow-sm">
                  <iframe
                    className="w-full h-full"
                    src={`https://www.youtube.com/embed/${trailerVideoId}?autoplay=0&rel=0&modestbranding=1`}
                    title={`${formatFilmTitle(film.title)} Trailer`}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  ></iframe>
                </div>
              </section>
            )}

            {/* Cast */}
            {cast.length > 0 && (
              <section className="p-8 md:p-12 border-b border-border">
                <h2 className="font-heading font-bold text-2xl md:text-[1.75rem] text-text-primary mb-2 tracking-tight leading-none">Cast</h2>
                <p className="text-xs text-text-muted mb-6">{cast.length} {cast.length === 1 ? 'credit' : 'credits'}</p>
                <div className="flex gap-4 overflow-x-auto no-scrollbar snap-x snap-mandatory pb-2">
                  {(showAllCast ? cast : cast.slice(0, 8)).map(person => (
                    <Link 
                      key={person.id} 
                      to={`/people/${person.slug || person.id}`}
                      className="group flex flex-col w-28 sm:w-32 shrink-0 snap-start"
                    >
                      <div className="relative w-full aspect-[3/4] rounded-lg overflow-hidden border border-border shadow-sm group-hover:border-brand transition-colors duration-300">
                        <ImageWithFallback
                          src={person.photo_url}
                          alt={formatPersonName(person.name)}
                          fallbackType="avatar"
                          name={formatPersonName(person.name)}
                          className="w-full h-full object-cover"
                          width={256}
                          sizes="(max-width: 639px) 112px, 128px"
                          loading="lazy"
                        />
                      </div>
                      <div className="mt-3 flex flex-col text-left">
                        <span className="font-bold text-text-primary text-sm tracking-tight leading-snug line-clamp-1 group-hover:text-gold transition-colors">
                          {formatPersonName(person.name)}
                        </span>
                        <span className="text-xs text-text-muted font-medium mt-0.5 line-clamp-1">
                          {toTitleCase(person.role)}
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>
                
                {cast.length > 8 && (
                  <div className="mt-6 flex justify-start">
                    <button
                      onClick={() => setShowAllCast(prev => !prev)}
                      className="min-h-[44px] px-5 py-2 bg-surface border border-border text-text-primary text-xs font-bold rounded-lg hover:border-brand hover:text-brand transition-colors"
                    >
                      {showAllCast ? 'Show less' : `Show all ${cast.length} cast members`}
                    </button>
                  </div>
                )}
              </section>
            )}

            {/* Crew */}
            {crew.length > 0 && (
              <section className="p-8 md:p-12 border-b border-border">
                <h2 className="font-heading font-bold text-2xl md:text-[1.75rem] text-text-primary mb-2 tracking-tight leading-none">Crew</h2>
                <p className="text-xs text-text-muted mb-6">{crew.length} {crew.length === 1 ? 'member' : 'members'}</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-0 border border-border rounded-lg overflow-hidden">
                  {crew.map((member, idx) => (
                    <Link 
                      key={idx} 
                      to={`/people/${member.slug || member.id}`}
                      className="flex items-center gap-4 bg-surface p-4 border-r border-b border-border last:border-r-0 last:border-b-0 hover:bg-surface-2 transition-colors group"
                    >
                      <ImageWithFallback
                        src={member.photo_url}
                        alt={formatPersonName(member.name)}
                        fallbackType="avatar"
                        name={formatPersonName(member.name)}
                        className="w-10 h-10 rounded-lg object-cover border border-border group-hover:border-gold transition-colors"
                        width={96}
                        sizes="40px"
                        loading="lazy"
                      />
                      <div>
                        <div className="font-bold text-text-primary text-xs line-clamp-1 tracking-tight group-hover:text-gold transition-colors">{formatPersonName(member.name)}</div>
                        {/* Already Sentence-cased by formatRole; toTitleCase here
                            would re-break acronyms ("VFX" -> "Vfx"). */}
                        <div className="text-text-muted text-[10px] font-bold">{member.role}</div>
                      </div>
                    </Link>
                  ))}
                </div>
              </section>
            )}

            {/* Awards — before reviews, collapsed by default */}
            {Array.isArray(film.awards) && film.awards.length > 0 && (() => {
              const wins = film.awards.filter((a) => a.won !== false).length;
              const nominations = film.awards.filter((a) => a.won === false).length;
              return (
              <section className="p-8 md:p-12 border-b border-border">
                <button
                  type="button"
                  onClick={() => setAwardsOpen((prev) => !prev)}
                  aria-expanded={awardsOpen}
                  className="w-full flex items-center justify-between gap-4 text-left group"
                >
                  <div className="flex flex-wrap items-center gap-3 min-w-0">
                    <h2 className="font-heading font-bold text-xl md:text-2xl text-text-primary tracking-tight leading-none">
                      Awards
                    </h2>
                    <div className="flex flex-wrap items-center gap-2">
                      {wins > 0 && (
                        <span className="inline-flex items-center gap-1 rounded-md border border-brand/25 bg-brand/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-brand">
                          {wins} {wins === 1 ? 'win' : 'wins'}
                        </span>
                      )}
                      {nominations > 0 && (
                        <span className="inline-flex items-center gap-1 rounded-md border border-border bg-surface-2/60 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-text-muted">
                          {nominations} {nominations === 1 ? 'nomination' : 'nominations'}
                        </span>
                      )}
                    </div>
                  </div>
                  <Icon
                    icon={awardsOpen ? 'solar:alt-arrow-up-linear' : 'solar:alt-arrow-down-linear'}
                    className="text-xl text-text-muted group-hover:text-text-primary transition-colors shrink-0"
                  />
                </button>
                {awardsOpen && (
                  <ul className="mt-6 divide-y divide-border/70 border-y border-border/70">
                    {[...film.awards]
                      .sort((a, b) => (b.year || 0) - (a.year || 0))
                      .map((award, idx) => (
                        <li
                          key={`${award.organization}-${award.season}-${award.category}-${idx}`}
                          className="flex items-start gap-3 py-3.5"
                        >
                          <Icon icon="solar:cup-star-linear" className="text-base text-text-muted shrink-0 mt-0.5" />
                          <div className="min-w-0 flex-1">
                            <p className="text-text-primary text-sm font-semibold leading-snug">
                              {award.category || award.title}
                              <span
                                className={`ml-2 text-[10px] font-bold uppercase tracking-wider ${
                                  award.won === false ? 'text-text-muted' : 'text-brand'
                                }`}
                              >
                                {award.won === false ? 'Nominated' : 'Winner'}
                              </span>
                            </p>
                            <p className="text-text-muted text-xs mt-0.5">
                              {[award.organization || 'AMVCA', award.year].filter(Boolean).join(' · ')}
                              {award.recipients?.length ? ` · ${award.recipients.join(', ')}` : ''}
                            </p>
                          </div>
                        </li>
                      ))}
                  </ul>
                )}
              </section>
              );
            })()}

            {/* Critic Reviews & Quotes */}
            <div className="px-8 md:px-12 pt-4">
              <CriticReviewsSection filmId={film.id} user={user} />
            </div>

            {/* Reviews */}
            <section id="reviews-section" className="p-8 md:p-12">
              <ReviewSection
                filmId={film.id}
                currentUser={user}
              />
            </section>
          </div>

          {/* SIDEBAR (30%) — Watch first, then facts / platforms / related */}
          <div className="space-y-0 divide-y divide-border h-full">
            <div className="hidden lg:block p-8 space-y-3">
              <WatchOptions film={film} isFullWidth />
              <button
                onClick={handleWatchlist}
                disabled={watchlistLoading}
                className={`w-full flex items-center justify-center gap-2 px-6 py-4 rounded-lg font-bold text-[10px] tracking-widest transition-all duration-300 active:scale-95 min-h-[44px] disabled:opacity-50 ${inWatchlist
                  ? 'bg-brand text-white'
                  : 'bg-surface-2 border border-border text-text-primary hover:border-brand hover:text-brand'
                  }`}
              >
                {inWatchlist ? 'Added' : 'Add to Watchlist'}
              </button>

              <div className="flex gap-3 mt-3">
                <button
                  onClick={() => handleReaction('dislike')}
                  disabled={reactionLoading}
                  className={`flex-1 flex flex-col items-center justify-center gap-1.5 py-3 rounded-lg border transition-all duration-300 active:scale-95 disabled:opacity-50 ${userReaction === 'dislike' ? 'bg-red-500/10 border-red-500 text-red-500' : 'bg-surface-2 border-border text-text-muted hover:border-white hover:text-white'}`}
                  title="Dislike"
                >
                  <Icon icon={userReaction === 'dislike' ? "solar:dislike-bold" : "solar:dislike-linear"} className="text-xl" />
                  <span className="text-[10px] font-bold">{dislikesCount}</span>
                </button>

                <button
                  onClick={() => handleReaction('like')}
                  disabled={reactionLoading}
                  className={`flex-1 flex flex-col items-center justify-center gap-1.5 py-3 rounded-lg border transition-all duration-300 active:scale-95 disabled:opacity-50 ${userReaction === 'like' ? 'bg-brand/10 border-brand text-brand' : 'bg-surface-2 border-border text-text-muted hover:border-white hover:text-white'}`}
                  title="Like"
                >
                  <Icon icon={userReaction === 'like' ? "solar:like-bold" : "solar:like-linear"} className="text-xl" />
                  <span className="text-[10px] font-bold">{likesCount}</span>
                </button>
              </div>

              <ShareAction
                title={formatFilmTitle(film.title)}
                text={`Check out ${formatFilmTitle(film.title)} on MuviDB`}
              />
            </div>

            <div className="p-8 space-y-6">
              {(() => {
                const prodCompanies = (film.film_companies || []).filter(
                  (fc) => !fc.role || fc.role === 'production' || fc.role === 'co_production'
                );
                const distCompanies = (film.film_companies || []).filter(
                  (fc) => fc.role === 'distribution' || fc.role === 'international_distribution'
                );

                return (
                  <>
                    {/* Production Companies */}
                    <div>
                      <div className="text-[10px] text-text-muted font-bold uppercase tracking-wider mb-3 flex items-center gap-1.5">
                        <Icon icon="solar:buildings-bold" className="text-brand text-xs" />
                        <span>Production {prodCompanies.length > 1 ? 'Partners' : 'Company'}</span>
                      </div>

                      {prodCompanies.length > 0 ? (
                        <div className="space-y-3">
                          {prodCompanies.map((fc, idx) => (
                            <Link
                              key={idx}
                              to={`/companies/${fc.companies?.slug || fc.companies?.id}`}
                              className="flex items-center gap-3 group"
                            >
                              <div className="w-9 h-9 rounded-lg overflow-hidden bg-surface-2 shrink-0 border border-border group-hover:border-brand transition-colors">
                                <ImageWithFallback
                                  src={fc.companies?.logo_url}
                                  alt={fc.companies?.name || 'Studio'}
                                  fallbackType="company"
                                  name={fc.companies?.name || 'Studio'}
                                  className="w-full h-full object-cover"
                                  width={72}
                                  sizes="36px"
                                  loading="lazy"
                                />
                              </div>
                              <span className="font-bold text-text-primary text-xs group-hover:text-brand transition-colors line-clamp-1">
                                {fc.companies?.name}
                              </span>
                            </Link>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-text-muted font-medium">Independent Production</p>
                      )}
                    </div>

                    {/* Distribution Partners / Distributor */}
                    {(distCompanies.length > 0 || film.distributor || film.streaming_links?.distributor) && (
                      <div>
                        <div className="text-[10px] text-text-muted font-bold uppercase tracking-wider mb-3 flex items-center gap-1.5">
                          <Icon icon="solar:delivery-bold" className="text-brand text-xs" />
                          <span>Distribution {distCompanies.length > 1 ? 'Partners' : 'Partner / Distributor'}</span>
                        </div>
                        {distCompanies.length > 0 ? (
                          <div className="space-y-3">
                            {distCompanies.map((fc, idx) => (
                              <Link
                                key={idx}
                                to={`/companies/${fc.companies?.slug || fc.companies?.id}`}
                                className="flex items-center gap-3 group"
                              >
                                <div className="w-9 h-9 rounded-lg overflow-hidden bg-surface-2 shrink-0 border border-border group-hover:border-brand transition-colors">
                                  <ImageWithFallback
                                    src={fc.companies?.logo_url}
                                    alt={fc.companies?.name || 'Distributor'}
                                    fallbackType="company"
                                    name={fc.companies?.name || 'Distributor'}
                                    className="w-full h-full object-cover"
                                    width={72}
                                    sizes="36px"
                                    loading="lazy"
                                  />
                                </div>
                                <span className="font-bold text-text-primary text-xs group-hover:text-brand transition-colors line-clamp-1">
                                  {fc.companies?.name}
                                </span>
                              </Link>
                            ))}
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-text-primary text-xs bg-surface-2/80 border border-border px-3 py-2 rounded-lg inline-flex items-center gap-2">
                              <Icon icon="solar:box-minimalistic-bold" className="text-brand text-sm shrink-0" />
                              <span>{film.distributor || film.streaming_links?.distributor}</span>
                            </span>
                          </div>
                        )}
                      </div>
                    )}
                  </>
                );
              })()}
            </div>

            <div className="p-8">
              <h3 className="font-heading font-bold text-sm text-text-primary mb-5 tracking-tight">About</h3>
              <div className="space-y-4 text-[11px] font-bold">
                <div className="flex justify-between items-center border-b border-border pb-3">
                  <span className="text-text-muted tracking-wider">Status</span>
                  <span className="text-text-primary">{film.status}</span>
                </div>
                {(film.distributor || film.streaming_links?.distributor) && (
                  <div className="flex justify-between items-center border-b border-border pb-3">
                    <span className="text-text-muted tracking-wider">Distributor</span>
                    <span className="text-text-primary font-bold">{film.distributor || film.streaming_links?.distributor}</span>
                  </div>
                )}
                {film.countries && film.countries.length > 0 && (
                  <div className="flex justify-between items-start gap-4 border-b border-border pb-3">
                    <span className="text-text-muted tracking-wider shrink-0">Country</span>
                    <span className="text-right flex flex-wrap justify-end gap-x-1 gap-y-1">
                      {film.countries.map((country, i) => (
                        <span key={country} className="inline-flex items-center">
                          <Link
                            to={`/browse?country=${encodeURIComponent(country)}`}
                            className="text-text-primary hover:text-brand transition-colors underline-offset-2 hover:underline"
                          >
                            {country}
                          </Link>
                          {i < film.countries.length - 1 ? <span className="text-text-muted">,</span> : null}
                        </span>
                      ))}
                    </span>
                  </div>
                )}
                {/* Language row hidden until detection is accurate — re-enable with getFilmLanguages(film) */}
                <div className="flex justify-between items-center border-b border-border pb-3">
                  <span className="text-text-muted tracking-wider">{film.content_type === 'series' ? 'Seasons' : 'Runtime'}</span>
                  <span className="text-text-primary">
                    {film.content_type === 'series'
                      ? (film.season_count ? `${film.season_count} Season${film.season_count > 1 ? 's' : ''}` : 'TV Series')
                      : `${film.runtime_minutes || film.runtime} min`}
                  </span>
                </div>
                {film.content_type === 'series' && film.episode_count && (
                  <div className="flex justify-between items-center border-b border-border pb-3">
                    <span className="text-text-muted tracking-wider">Episodes</span>
                    <span className="text-text-primary">{film.episode_count} Episodes</span>
                  </div>
                )}
                <div className="flex justify-between items-center">
                  <span className="text-text-muted tracking-wider">Rating</span>
                  <span className="bg-surface-2 text-text-primary px-2 py-0.5 rounded text-[10px] border border-border font-bold">
                    {film.nfvcb_rating}
                  </span>
                </div>
              </div>
            </div>

            {/* WHERE TO WATCH — explicit per-platform list (answers the #1 query) */}
            {PLATFORMS.some((p) => isFilmOnPlatform(film, p.id)) && (
              <div className="hidden lg:block p-8">
                <h3 className="font-heading font-bold text-sm text-text-primary mb-5 tracking-tight flex items-center gap-2">
                  <Icon icon="solar:tv-bold" className="text-brand" />
                  Where to Watch
                </h3>
                <div className="flex flex-col gap-2">
                  {PLATFORMS.filter((p) => isFilmOnPlatform(film, p.id)).map((p) => {
                    const url = getWatchUrl(film, p.id);
                    const inner = (
                      <>
                        <span className="flex items-center gap-3">
                          {p.logo ? (
                            <span className="w-6 h-6 rounded-md bg-white overflow-hidden flex items-center justify-center border border-border shrink-0">
                              <img src={p.logo} alt="" className="w-full h-full object-contain p-0.5" loading="lazy" />
                            </span>
                          ) : (
                            <span
                              className="w-6 h-6 rounded-md flex items-center justify-center border border-white/10 shrink-0"
                              style={{ background: `${p.color}22`, color: p.color }}
                            >
                              <Icon icon={p.icon} width="14" height="14" />
                            </span>
                          )}
                          <span className="text-[11px] font-black uppercase tracking-widest text-text-primary">{p.name}</span>
                        </span>
                        <Icon icon={url ? 'solar:arrow-right-up-linear' : 'solar:alt-arrow-right-linear'} className="text-text-muted group-hover:text-brand transition-colors" />
                      </>
                    );
                    const className = 'group flex items-center justify-between px-4 py-3 rounded-lg bg-surface-2/40 border border-border hover:border-brand/50 transition-all';
                    return url ? (
                      <a key={p.id} href={url} target="_blank" rel="noopener noreferrer" className={className}>{inner}</a>
                    ) : (
                      <Link key={p.id} to={`/watch/${p.id}`} className={className}>{inner}</Link>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="p-8">
              <h3 className="font-heading font-bold text-sm text-text-primary mb-5 tracking-tight">More Like This</h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-1 gap-3 lg:gap-0 lg:border lg:border-border lg:rounded-lg lg:overflow-hidden lg:shadow-sm">
                {relatedFilms.map(relatedFilm => (
                  <Link
                    key={relatedFilm.id}
                    to={`/films/${relatedFilm.slug || relatedFilm.id}`}
                    className="flex flex-col lg:flex-row gap-3 lg:gap-4 bg-surface hover:bg-surface-2 p-3 lg:p-4 border border-border lg:border-0 lg:border-b lg:last:border-b-0 rounded-lg lg:rounded-none group transition-all min-w-0"
                  >
                    <ImageWithFallback
                      src={relatedFilm.poster_url || relatedFilm.poster} 
                      alt={relatedFilm.title}
                      className="w-full aspect-[2/3] lg:w-12 lg:h-16 lg:aspect-auto object-cover rounded-md border border-border"
                      fallbackType="film"
                      name={relatedFilm.title}
                      width={192}
                      sizes="(max-width: 639px) 40vw, (max-width: 1023px) 20vw, 48px"
                      loading="lazy"
                    />
                    <div className="flex flex-col justify-center">
                      <h4 className="font-bold text-text-primary text-xs group-hover:text-brand transition-colors line-clamp-2 mb-1 tracking-tight">
                        {formatFilmTitle(relatedFilm.title)}
                      </h4>
                      <div className="text-[10px] font-bold text-text-muted mb-1">
                        {relatedFilm.year} • {relatedFilm.genres && relatedFilm.genres.length > 0 ? relatedFilm.genres[0] : 'Media'}
                      </div>
                      {relatedFilm._reason && (
                        <div className="text-[9px] font-bold text-brand/80 uppercase tracking-wide line-clamp-1">
                          {relatedFilm._reason}
                        </div>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
