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
import RottenTomatoesScorecard from '../components/film/RottenTomatoesScorecard';
import FilmSpecsTable from '../components/film/FilmSpecsTable';
import AdminBoxOfficeModal from '../components/film/AdminBoxOfficeModal';
import BoxOfficeBreakdownModal from '../components/film/BoxOfficeBreakdownModal';
import RateMoviePrompt from '../components/film/RateMoviePrompt';
import WatchOptions from '../components/film/WatchOptions';
import { PLATFORMS, isFilmOnPlatform, getWatchUrl } from '../lib/platforms';
import { getFilmBackdrop, getFilmPoster } from '../lib/filmImages';
import { Skeleton } from '../components/ui/Skeleton';
import ShareAction from '../components/ui/ShareAction';
import { slugOrId } from '../utils/slug';
import { getShowName } from '../utils/series';
import ImageWithFallback from '../components/ui/ImageWithFallback';
import AwardLogo from '../components/awards/AwardLogo';
import { normOrg } from '../lib/awards';
import { formatFilmTitle, toSentenceCase, formatPersonName, toTitleCase } from '../utils/format';
import { getFilmLanguages, getLanguageEndonym } from '../utils/languages';
import { formatRole } from '../lib/creditRoles';
import { formatViewCount } from '../utils/youtube';

const RELATED_FILMS_LIMIT = 5;

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

const parseFilmCredits = (credits = []) => {
  const castMembersRaw = credits
    .filter(c => {
      const role = (c.role || '').trim().toLowerCase();
      return role === 'actor' || role === 'cast';
    })
    .map(c => {
      const person = Array.isArray(c.people) ? c.people[0] : c.people;
      return person ? { ...person, role: c.character_name || 'Cast' } : null;
    })
    .filter(Boolean);
    
  const crewMembersRaw = credits
    .filter(c => {
      const role = (c.role || '').trim().toLowerCase();
      return role !== 'actor' && role !== 'cast';
    })
    .map(c => {
      const person = Array.isArray(c.people) ? c.people[0] : c.people;
      return person ? { ...person, role: formatRole(c.role) || 'Crew' } : null;
    })
    .filter(Boolean);

  const cast = deduplicateAndMerge(castMembersRaw);
  const crew = deduplicateAndMerge(crewMembersRaw);
  const dir = crew.find(m => (m.role || '').toLowerCase().includes('director'));

  return { cast, crew, director: dir ? dir.name : null };
};

export default function FilmDetail() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { user, role } = useAuth();
  const isAdmin = role === 'admin' || user?.role === 'admin';

  // The route loader (src/routes/film-detail.tsx) already fetched this film and
  // credits server-side, so the same row seeds the page and cast list on SSR.
  const loaderData = useLoaderData();
  const seededParsed = loaderData?.film?.credits?.length ? parseFilmCredits(loaderData.film.credits) : null;
  const seededFilm = loaderData?.film
    ? {
        ...loaderData.film,
        director: seededParsed?.director || loaderData.film.director || null,
        genres: dedupeGenres(
          loaderData.film.film_genres?.map((fg) => fg.genres?.name).filter(Boolean) || []
        ),
      }
    : null;

  const [film, setFilm] = useState(seededFilm);
  const [filmId, setFilmId] = useState(seededFilm?.id ?? null); // actual UUID for sub-queries
  const [cast, setCast] = useState(seededParsed?.cast || []);
  const [crew, setCrew] = useState(seededParsed?.crew || []);
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

  const [criticSummary, setCriticSummary] = useState({ score: null, count: 0, featuredQuote: null });
  const [showFilmEdit, setShowFilmEdit] = useState(false);
  const [showBoxOfficeModal, setShowBoxOfficeModal] = useState(false);
  const [showBoxOfficeBreakdown, setShowBoxOfficeBreakdown] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [showAllCast, setShowAllCast] = useState(false);
  const [awardsOpen, setAwardsOpen] = useState(false);
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [activeTab, setActiveTab] = useState('overview-section');

  // Scrollspy observer for sticky tabs
  useEffect(() => {
    const sectionIds = [
      'overview-section',
      'episodes-section',
      'trailer-section',
      'cast-section',
      'crew-section',
      'awards-section',
      'reviews-section',
    ];

    const elements = sectionIds.map((id) => document.getElementById(id)).filter(Boolean);
    if (elements.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.find((e) => e.isIntersecting);
        if (visible && visible.target.id) {
          setActiveTab(visible.target.id);
        }
      },
      {
        rootMargin: '-10% 0px -65% 0px',
        threshold: 0.1,
      }
    );

    elements.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [film, cast, crew, episodes]);

  const scrollToTab = (id) => {
    setActiveTab(id);
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const fetchCriticSummary = async (uuid) => {
    try {
      const { data } = await supabase
        .from('critic_reviews')
        .select('rating, quote, is_featured, critic_name, publication, critic:critics(name, publication)')
        .eq('film_id', uuid);
      if (data && data.length > 0) {
        const valid = data
          .map((r) => (r.rating != null && r.rating !== '' ? Number(r.rating) : null))
          .filter((n) => n !== null && !isNaN(n) && n > 0 && n <= 10)
          .map((n) => (n > 5 ? n / 2 : n)); // ensure 1-5 scale
        
        const featured = data.find((r) => r.is_featured && r.quote) || data.find((r) => r.quote) || null;
        const featuredObj = featured ? {
          quote: featured.quote,
          critic_name: featured.critic_name || featured.critic?.name,
          publication: featured.publication || featured.critic?.publication
        } : null;

        const avg5 = valid.length > 0 ? (valid.reduce((a, b) => a + b, 0) / valid.length) : null;
        // Scale 5-star avg to 10 for RottenTomatoesScorecard (which multiplies by 10 to get percentage)
        const avg10 = avg5 != null ? Math.round((avg5 * 2) * 10) / 10 : null;
        setCriticSummary({ score: avg10, count: valid.length, featuredQuote: featuredObj });
      }
    } catch (e) {
      console.error('Error fetching critic summary:', e);
    }
  };

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
      // Always via /api/content — the browser must not read the credits table.
      // Local dev works because vite proxies /api/content to production.
      const res = await fetch(`/api/content?resource=film-credits&filmId=${encodeURIComponent(uuid)}`);
      const data = res.ok ? ((await res.json()).credits || []) : [];

      const { cast: castMembers, crew: crewMembers, director: dirName } = parseFilmCredits(data);
      setCast(castMembers);
      setCrew(crewMembers);
      
      if (dirName) {
        setFilm(prev => prev ? { ...prev, director: dirName } : null);
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
        const runSingle = async (column, value) => {
          let query = supabase
            .from('films')
            .select(`
              *,
              film_genres(genre_id, genres(name)),
              film_companies(
                role,
                companies(id, name, slug, logo_url)
              )
            `)
            .eq(column, value);
          if (!isStaff) query = query.eq('is_published', true);
          return query.maybeSingle();
        };
        let { data, error } = await runSingle(col, val);
        if (!data && col === 'slug' && /-\d{4}$/.test(val)) {
          ({ data, error } = await runSingle('slug', val.replace(/-\d{4}$/, '')));
        }
        if (error || !data) throw error || new Error('Film not found');
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
      setLoading(false);

      if (data.credits && data.credits.length > 0) {
        const { cast: parsedCast, crew: parsedCrew, director: parsedDir } = parseFilmCredits(data.credits);
        setCast(parsedCast);
        setCrew(parsedCrew);
        if (parsedDir) setFilm(prev => prev ? { ...prev, director: parsedDir } : null);
      } else {
        fetchCredits(data.id);
      }
      fetchCriticSummary(data.id);
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
        .limit(RELATED_FILMS_LIMIT);

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
      .slice(0, RELATED_FILMS_LIMIT);

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
  const isRealYoutubeUrl = (url) => typeof url === 'string' && (url.includes('youtube.com') || url.includes('youtu.be'));
  const fullYoutubeUrl = (isRealYoutubeUrl(film.youtube_watch_url) ? film.youtube_watch_url : null) || (isFilmOnPlatform(film, 'youtube') ? getWatchUrl(film, 'youtube') : null);
  const availablePlatforms = PLATFORMS.filter((platform) => {
    if (platform.id === 'cinema') return false;
    if (platform.id === 'youtube' && fullYoutubeUrl) return true;
    return isFilmOnPlatform(film, platform.id);
  });
  // Languages belong in the hero, not only in the specs table further down —
  // the tongue a film is performed in is one of the first things a viewer here
  // wants to know. Shown as the endonym, with the English name on hover.
  const heroLanguages = getFilmLanguages(film).map(getLanguageEndonym).filter(Boolean);

  const directors = crew.filter((m) => (m.role || '').toLowerCase().includes('director'));
  const writers = crew.filter((m) => {
    const r = (m.role || '').toLowerCase();
    return r.includes('writer') || r.includes('screenplay') || r.includes('story');
  });
  const topCast = cast.slice(0, 5);

  const directorList = directors.length > 0
    ? directors
    : (film.director ? [{ name: film.director }] : []);

  const formatRuntime = (mins) => {
    if (!mins || isNaN(mins)) return null;
    const num = Number(mins);
    if (num <= 0) return null;
    const hours = Math.floor(num / 60);
    const remaining = num % 60;
    if (hours > 0 && remaining > 0) return `${hours}h ${remaining}m`;
    if (hours > 0) return `${hours}h`;
    return `${remaining}m`;
  };

  const domGross = Number(film.box_office_domestic || film.streaming_links?.box_office?.domestic || 0);
  const currency = film.box_office_currency || film.streaming_links?.box_office?.currency || 'NGN';
  const symbol = currency === 'NGN' ? '₦' : `${currency} `;
  const formattedGross = domGross >= 1_000_000_000 
    ? `${(domGross / 1_000_000_000).toFixed(2)} Billion` 
    : domGross >= 1_000_000
    ? `${(domGross / 1_000_000).toFixed(1)} Million`
    : domGross > 0 ? domGross.toLocaleString('en-NG') : null;
  const rawFormatted = domGross.toLocaleString('en-NG');
  const sourceLabel = film.box_office_source || film.streaming_links?.box_office?.source || 'Verified CEAN';
  const openingGross = Number(film.box_office_opening_weekend || film.streaming_links?.box_office?.opening_weekend || 0);

  // A film has genuine YouTube Movie views ONLY if:
  // 1. It is explicitly a YouTube movie (release_type === 'youtube'), OR
  // 2. It has an active YouTube watch URL AND is not a theatrical cinema release.
  // Trailer views on cinema movies are promotional and strictly excluded from movie stream metrics.
  const isCinemaFilm = domGross > 0 || film.release_type === 'cinema' || Boolean(film.is_in_cinemas);
  const isActualYoutubeMovie = film.release_type === 'youtube' || (Boolean(film.youtube_watch_url) && !isCinemaFilm);
  const showYoutubeViews = isActualYoutubeMovie && Boolean(film.view_count && Number(film.view_count) > 0);

  const votesCount = film.imdb_vote_count || film.tmdb_vote_count || film.audience_rating_count || (likesCount + dislikesCount);
  const ratingValue = (film.imdb_rating || film.tmdb_rating || film.audience_rating)
    ? Number(film.imdb_rating || film.tmdb_rating || film.audience_rating).toFixed(1)
    : (film.liked_percent ? (film.liked_percent / 10).toFixed(1) : null);

  const navTabs = [
    { id: 'overview-section', label: 'Overview', icon: 'solar:document-text-linear' },
    ...(episodes.length > 0 ? [{ id: 'episodes-section', label: `Episodes (${episodes.length})`, icon: 'solar:playlist-play-linear' }] : []),
    ...(cast.length > 0 ? [{ id: 'cast-section', label: `Cast (${cast.length})`, icon: 'solar:users-group-rounded-linear' }] : []),
    ...(crew.length > 0 ? [{ id: 'crew-section', label: `Crew (${crew.length})`, icon: 'solar:clapperboard-linear' }] : []),
    ...(Array.isArray(film?.awards) && film.awards.length > 0 ? [{ id: 'awards-section', label: 'Awards', icon: 'solar:cup-star-linear' }] : []),
    { id: 'reviews-section', label: 'Reviews', icon: 'solar:chat-round-dots-linear' },
    ...(relatedFilms.length > 0 ? [{ id: 'related-section', label: 'More Like This', icon: 'solar:film-strip-linear' }] : []),
  ];

  return (
    <div className="w-full bg-bg min-h-screen pb-20">
      {/* 1. CINEMATIC IMDB & NOLLYWIRE HERO STAGE */}
      <section className="relative w-full bg-[#12141a] text-white border-b border-border overflow-hidden">
        {/* Subtle radial ambient atmosphere */}
        <div 
          className="absolute inset-0 pointer-events-none opacity-40"
          style={{
            background: 'radial-gradient(circle at 75% 15%, #2a2029 0%, #171922 45%, #0e1015 85%)'
          }}
        />

        <div className="relative max-w-[1440px] mx-auto px-4 sm:px-6 md:px-8 lg:px-12 pt-5 sm:pt-6 pb-6">
          
          {/* TITLE & RATING HEADER ROW (Nollywire / IMDb Style) */}
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-4">
            <div className="min-w-0">
              {/* Eyebrow badge */}
              <div className="flex items-center gap-2 mb-1.5">
                <span className="w-4 h-0.5 bg-brand inline-block rounded-full"></span>
                <span className="text-[11px] font-black uppercase tracking-[0.2em] text-brand">
                  {film.is_in_cinemas 
                    ? 'In Cinemas' 
                    : film.content_type === 'series'
                    ? 'Original Series'
                    : (film.coming_soon || film.status === 'upcoming')
                    ? 'Coming Soon'
                    : 'Film'}
                </span>
                {parentSeries && (
                  <Link 
                    to={`/films/${parentSeries.slug || parentSeries.id}`}
                    className="ml-2 inline-flex items-center gap-1 text-[11px] font-bold text-white/70 hover:text-white transition-colors"
                  >
                    <span>· Part of {parentSeries.title}</span>
                  </Link>
                )}
              </div>

              {/* Title */}
              <h1 className="font-heading font-black text-2xl sm:text-3xl md:text-4xl lg:text-[2.65rem] xl:text-[2.85rem] text-white tracking-tight leading-[1.1] mb-2">
                {formatFilmTitle(film.title)}
              </h1>

              {/* Year line / metadata */}
              <div className="flex flex-wrap items-center gap-2 text-xs text-white/75 font-semibold">
                {film.year && <span>{film.year}</span>}
                {formatRuntime(film.runtime_minutes || film.runtime) && (
                  <>
                    <span className="w-1 h-1 rounded-full bg-white/40"></span>
                    <span>{formatRuntime(film.runtime_minutes || film.runtime)}</span>
                  </>
                )}
                {film.nfvcb_rating && (
                  <>
                    <span className="w-1 h-1 rounded-full bg-white/40"></span>
                    <span 
                      className="px-1.5 py-0.5 rounded border border-white/30 text-[10px] font-black text-white uppercase tracking-wider bg-white/10"
                      title={`NFVCB ${film.nfvcb_rating}`}
                    >
                      {film.nfvcb_rating}
                    </span>
                  </>
                )}
                {film.content_type && (
                  <>
                    <span className="w-1 h-1 rounded-full bg-white/40"></span>
                    <span className="capitalize">{film.content_type}</span>
                  </>
                )}
                {heroLanguages.length > 0 && (
                  <>
                    <span className="w-1 h-1 rounded-full bg-white/40"></span>
                    <span>{heroLanguages.map(l => l.label).join(', ')}</span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* MEDIA GRID (Poster on Left | Big Trailer Stage in Center | Quick Media Links on Right) */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-2 sm:gap-3 items-stretch">
            
            {/* 1. Poster Column (md:col-span-4 lg:col-span-3) */}
            <div className="md:col-span-4 lg:col-span-3 shrink-0 relative group rounded-xl overflow-hidden bg-black/60 border border-white/10 shadow-2xl flex flex-col aspect-[2/3] max-w-[220px] sm:max-w-[260px] md:max-w-none mx-auto md:mx-0 w-full">
              <ImageWithFallback
                src={getFilmPoster(film)}
                alt={`${formatFilmTitle(film.title)} Poster`}
                className="w-full h-full object-cover group-hover:scale-[1.015] transition-transform duration-500"
                fallbackType="film"
                name={formatFilmTitle(film.title)}
                width={512}
                sizes="(max-width: 768px) 100vw, 300px"
                loading="eager"
              />
              {film.is_in_cinemas && (
                <div className="absolute top-3 left-3 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/85 backdrop-blur-md border border-amber-400/40 text-[10px] font-black uppercase tracking-wider text-amber-300 shadow-xl">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse"></span>
                  <span>In Cinemas</span>
                </div>
              )}
            </div>

            {/* 2. Center: Trailer / Stage Video Player (md:col-span-8 lg:col-span-7) */}
            <div id="trailer-stage" className="md:col-span-8 lg:col-span-7 relative rounded-xl overflow-hidden bg-black border border-white/10 shadow-2xl aspect-video md:aspect-auto flex flex-col h-full w-full self-stretch min-h-[200px] sm:min-h-[280px]">
              {trailerVideoId ? (
                <div className="w-full h-full relative flex-1 min-h-0">
                  <iframe
                    className="w-full h-full absolute inset-0"
                    src={`https://www.youtube.com/embed/${trailerVideoId}?autoplay=0&rel=0&modestbranding=1`}
                    title={`${formatFilmTitle(film.title)} Official Trailer`}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                </div>
              ) : getFilmBackdrop(film) ? (
                <div className="w-full h-full relative flex-1 min-h-0">
                  <ImageWithFallback
                    src={getFilmBackdrop(film)}
                    alt={`${formatFilmTitle(film.title)} Backdrop`}
                    className="w-full h-full object-cover opacity-80"
                    fallbackType="film"
                    name={formatFilmTitle(film.title)}
                    width={1280}
                    quality={85}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent flex flex-col justify-end p-6">
                    <span className="text-[11px] uppercase tracking-widest font-black text-amber-400 mb-1">Official Backdrop</span>
                    <h3 className="text-lg sm:text-xl font-bold text-white drop-shadow">Trailer not published yet</h3>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center p-8 text-center text-white/50 w-full h-full flex-1 min-h-0">
                  <Icon icon="solar:clapperboard-play-linear" className="text-5xl mb-2 opacity-40 text-brand" />
                  <p className="text-sm font-bold text-white/80">Trailer not published</p>
                  <p className="text-xs text-white/50 mt-1">{formatFilmTitle(film.title)}</p>
                </div>
              )}
            </div>

            {/* 3. Media Cards Column (Desktop Right, lg:col-span-2) */}
            <div className="hidden lg:grid grid-rows-2 gap-2 sm:gap-3 col-span-2">
              {/* Videos Link */}
              <a
                href={fullYoutubeUrl || (trailerVideoId ? `https://www.youtube.com/watch?v=${trailerVideoId}` : '#trailer-stage')}
                target={fullYoutubeUrl || trailerVideoId ? '_blank' : '_self'}
                rel="noopener noreferrer"
                className="flex flex-col items-center justify-center p-3 sm:p-3.5 rounded-xl bg-white/[0.07] hover:bg-white/[0.12] border border-white/10 transition-all group text-center cursor-pointer"
              >
                <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white group-hover:scale-110 group-hover:bg-brand transition-all mb-1.5">
                  <Icon icon="solar:play-bold" className="text-base ml-0.5" />
                </div>
                <span className="text-xs font-black uppercase tracking-wider text-white">
                  {fullYoutubeUrl ? 'Play Movie' : '1 Video'}
                </span>
                <span className="text-[10px] text-white/50 font-medium mt-0.5">
                  {showYoutubeViews 
                    ? `${formatViewCount(film.view_count)} views · Full Movie`
                    : (fullYoutubeUrl ? 'On YouTube' : 'Official Trailer')}
                </span>
              </a>

              {/* Photos Link */}
              <a
                href="#overview-section"
                onClick={(e) => {
                  e.preventDefault();
                  scrollToTab('overview-section');
                }}
                className="flex flex-col items-center justify-center p-3 sm:p-3.5 rounded-xl bg-white/[0.07] hover:bg-white/[0.12] border border-white/10 transition-all group text-center cursor-pointer"
              >
                <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white group-hover:scale-110 group-hover:bg-amber-500 transition-all mb-1.5">
                  <Icon icon="solar:gallery-bold" className="text-base" />
                </div>
                <span className="text-xs font-black uppercase tracking-wider text-white">
                  Photos & Stills
                </span>
                <span className="text-[10px] text-white/50 font-medium mt-0.5">
                  Production Media
                </span>
              </a>
            </div>
          </div>

          {/* INTEGRATED HERO SCORECARD STRIP (Critics Meter + Audience Popcornmeter + Box Office & YouTube Views) */}
          <div className="pt-4 sm:pt-6 pb-1">
            <div className="flex flex-col lg:flex-row items-stretch gap-3.5 sm:gap-4 w-full">
              <div className="flex-1 min-w-0">
                <RottenTomatoesScorecard
                  film={film}
                  criticScore={criticSummary.score}
                  criticCount={criticSummary.count}
                  featuredQuote={criticSummary.featuredQuote}
                  audiencePercent={film.liked_percent ?? (likesCount > 0 ? Math.round((likesCount / (likesCount + dislikesCount)) * 100) : null)}
                  starRating={film.imdb_rating || film.tmdb_rating || film.audience_rating}
                  votesCount={votesCount}
                  onRateClick={() => {
                    setShowReviewForm(true);
                    const el = document.getElementById('rate-prompt-section') || document.getElementById('reviews-section');
                    if (el) el.scrollIntoView({ behavior: 'smooth' });
                  }}
                  onWatchClick={availablePlatforms.length > 0 ? () => {
                    const el = document.getElementById('overview-section');
                    if (el) el.scrollIntoView({ behavior: 'smooth' });
                  } : null}
                />
              </div>

              {/* Commercial & Reach Performance Card (Box Office & YouTube Views) */}
              {(domGross > 0 || showYoutubeViews || isAdmin) && (
                <div className="flex w-full lg:w-auto flex-col shrink-0">
                  {/* Case 1: Both Box Office AND Valid YouTube Stream (Rare Hybrid) */}
                  {domGross > 0 && showYoutubeViews ? (
                    <div className="h-full flex flex-col justify-between p-3.5 sm:p-4 rounded-xl sm:rounded-2xl bg-black/60 border border-white/15 backdrop-blur-xl shadow-2xl w-full lg:w-72 xl:w-80">
                      <div className="flex items-center justify-between gap-2 text-[10px] font-black uppercase tracking-widest text-white/60 mb-2">
                        <span>Commercial Reach</span>
                        <Link
                          to={`/films/${film.slug || film.id}/box-office`}
                          className="text-amber-400 hover:underline font-bold"
                        >
                          Full Breakdown →
                        </Link>
                      </div>
                      <div className="grid grid-cols-2 gap-2 py-1">
                        {/* Box Office Tile */}
                        <Link 
                          to={`/films/${film.slug || film.id}/box-office`}
                          className="p-2.5 rounded-lg bg-amber-500/[0.08] border border-amber-500/25 hover:border-amber-400/50 transition-all cursor-pointer group"
                        >
                          <div className="flex items-center gap-1 text-[10px] font-black text-amber-400 uppercase mb-0.5">
                            <Icon icon="solar:ticket-bold" className="text-xs" />
                            <span>Box Office</span>
                          </div>
                          <div className="text-base sm:text-lg font-black text-white font-heading leading-tight group-hover:text-amber-300">
                            <span className="text-amber-400">{symbol}</span>{formattedGross}
                          </div>
                          <div className="text-[9px] text-white/50 uppercase tracking-wider mt-0.5 font-bold">
                            Domestic
                          </div>
                        </Link>

                        {/* YouTube Stream Tile */}
                        <a
                          href={fullYoutubeUrl || `https://www.youtube.com/results?search_query=${encodeURIComponent(film.title)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-2.5 rounded-lg bg-red-500/[0.08] border border-red-500/25 hover:border-red-400/50 transition-all cursor-pointer group"
                        >
                          <div className="flex items-center gap-1 text-[10px] font-black text-red-400 uppercase mb-0.5">
                            <Icon icon="simple-icons:youtube" className="text-xs text-red-500" />
                            <span>YouTube</span>
                          </div>
                          <div className="text-base sm:text-lg font-black text-white font-heading leading-tight group-hover:text-red-400">
                            {formatViewCount(film.view_count)}
                          </div>
                          <div className="text-[9px] text-white/50 uppercase tracking-wider mt-0.5 font-bold">
                            Full Movie
                          </div>
                        </a>
                      </div>
                      <div className="text-[10px] text-white/40 font-medium mt-1.5">
                        Theatrical Run &amp; Official Stream
                      </div>
                    </div>
                  ) : domGross > 0 ? (
                    /* Case 2: Cinema Theatrical Release with Box Office */
                    <Link
                      to={`/films/${film.slug || film.id}/box-office`}
                      className="h-full flex flex-col justify-between p-4 sm:p-4.5 rounded-xl sm:rounded-2xl bg-black/60 border border-amber-500/30 backdrop-blur-xl shadow-2xl hover:border-amber-400/60 w-full lg:w-64 xl:w-72 text-left transition-all cursor-pointer group"
                    >
                      <div className="flex items-center justify-between gap-2 text-[10px] font-bold text-amber-400 uppercase tracking-widest mb-1.5">
                        <div className="flex items-center gap-1.5">
                          <Icon icon="solar:ticket-bold" className="text-amber-400 text-sm" />
                          <span>Box Office</span>
                        </div>
                        <span className="text-[10px] text-white/50 group-hover:text-amber-300 transition-colors">
                          Full Page →
                        </span>
                      </div>
                      <div className="my-auto py-1">
                        <p className="text-xl sm:text-2xl font-black text-white font-heading tracking-tight leading-none group-hover:text-amber-300 transition-colors">
                          <span className="text-amber-400">{symbol}</span>{formattedGross}
                        </p>
                        <div className="text-[10px] sm:text-[11px] font-bold text-white/60 uppercase tracking-wider mt-1.5">
                          Domestic Gross
                        </div>
                      </div>
                      <div className="text-[10px] text-white/40 font-medium">
                        {openingGross > 0 ? `₦${(openingGross / 1_000_000).toFixed(1)}M Opening Weekend` : 'Theatrical Cinema Release'}
                      </div>
                    </Link>
                  ) : showYoutubeViews ? (
                    /* Case 3: YouTube Full Movie Release with Stream Views */
                    <a
                      href={fullYoutubeUrl || `https://www.youtube.com/results?search_query=${encodeURIComponent(film.title)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="h-full flex flex-col justify-between p-4 sm:p-4.5 rounded-xl sm:rounded-2xl bg-black/60 border border-red-500/30 backdrop-blur-xl shadow-2xl hover:border-red-400/60 w-full lg:w-64 xl:w-72 text-left transition-all cursor-pointer group"
                    >
                      <div className="flex items-center justify-between gap-2 text-[10px] font-bold text-red-400 uppercase tracking-widest mb-1.5">
                        <div className="flex items-center gap-1.5">
                          <Icon icon="simple-icons:youtube" className="text-red-500 text-sm" />
                          <span>YouTube Stream</span>
                        </div>
                        <span className="text-[10px] text-white/50 group-hover:text-red-400 transition-colors">
                          Watch →
                        </span>
                      </div>
                      <div className="my-auto py-1">
                        <p className="text-xl sm:text-2xl font-black text-white font-heading tracking-tight leading-none flex items-baseline gap-1.5 group-hover:text-red-400 transition-colors">
                          <span className="text-red-500">{formatViewCount(film.view_count)}</span>
                          <span className="text-xs text-white/60 font-bold">views</span>
                        </p>
                        <div className="text-[10px] sm:text-[11px] font-bold text-white/60 uppercase tracking-wider mt-1.5">
                          Official Full Movie Stream
                        </div>
                      </div>
                      <div className="text-[10px] text-red-400/80 font-mono font-medium">
                        {Number(film.view_count).toLocaleString()} total streams
                      </div>
                    </a>
                  ) : (
                    /* Case 4: Admin Shortcut to add Gross */
                    <div
                      onClick={() => setShowBoxOfficeModal(true)}
                      className="h-full flex flex-col justify-center p-4 rounded-xl sm:rounded-2xl bg-black/40 border border-white/10 hover:border-amber-400/40 w-full lg:w-64 text-left transition-all cursor-pointer group"
                    >
                      <span className="text-[10px] font-black uppercase tracking-wider text-white/50">Box Office (Admin)</span>
                      <span className="text-xs font-bold text-amber-400 mt-1">+ Record Domestic Gross</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* SUMMARY ROW (Below Media Grid: Genres + Synopsis + Key Credits on Left | Action Cards on Right) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 pt-6 sm:pt-8 items-start">
            
            {/* Left 8 Cols: Genres + Tagline + Synopsis + Credits */}
            <div className="lg:col-span-8 space-y-4">
              
              {/* Genre Pills */}
              {film.genres && film.genres.length > 0 && (
                <div className="flex flex-wrap items-center gap-2">
                  {film.genres.map((genre) => (
                    <Link
                      key={genre}
                      to={`/browse?genre=${encodeURIComponent(genre)}`}
                      className="px-3.5 py-1 rounded-full text-xs font-bold bg-white/10 hover:bg-white/20 text-white/90 border border-white/15 transition-colors"
                    >
                      {genre}
                    </Link>
                  ))}
                </div>
              )}

              {/* Tagline */}
              {film.tagline && (
                <p className="text-base sm:text-lg text-amber-300/90 font-serif italic">
                  "{film.tagline}"
                </p>
              )}

              {/* Storyline / Synopsis */}
              {film.synopsis && (
                <p className="text-white/85 text-sm sm:text-base leading-relaxed max-w-3xl">
                  {toSentenceCase(film.synopsis)}
                </p>
              )}

              {/* Key Credits List (Director, Writers, Stars) */}
              <div className="border-t border-white/15 divide-y divide-white/15 pt-1">
                {directorList.length > 0 && (
                  <div className="grid grid-cols-12 gap-4 py-3 text-sm">
                    <span className="col-span-4 sm:col-span-3 lg:col-span-2 font-bold text-white/90">
                      Director{directorList.length > 1 ? 's' : ''}
                    </span>
                    <div className="col-span-8 sm:col-span-9 lg:col-span-10 flex flex-wrap items-center gap-1.5 text-white/80">
                      {directorList.map((dir, idx) => (
                        <span key={dir.id || dir.name} className="flex items-center">
                          {dir.slug || dir.id ? (
                            <Link to={`/people/${dir.slug || dir.id}`} className="text-brand hover:underline font-bold">
                              {formatPersonName(dir.name)}
                            </Link>
                          ) : (
                            <span className="text-white font-bold">{formatPersonName(dir.name)}</span>
                          )}
                          {idx < directorList.length - 1 && <span className="text-white/40 ml-1.5 mr-0.5">·</span>}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {writers.length > 0 && (
                  <div className="grid grid-cols-12 gap-4 py-3 text-sm">
                    <span className="col-span-4 sm:col-span-3 lg:col-span-2 font-bold text-white/90">
                      Writer{writers.length > 1 ? 's' : ''}
                    </span>
                    <div className="col-span-8 sm:col-span-9 lg:col-span-10 flex flex-wrap items-center gap-1.5 text-white/80">
                      {writers.slice(0, 4).map((w, idx, arr) => (
                        <span key={w.id || w.name} className="flex items-center">
                          {w.slug || w.id ? (
                            <Link to={`/people/${w.slug || w.id}`} className="text-brand hover:underline font-bold">
                              {formatPersonName(w.name)}
                            </Link>
                          ) : (
                            <span className="text-white font-bold">{formatPersonName(w.name)}</span>
                          )}
                          {idx < arr.length - 1 && <span className="text-white/40 ml-1.5 mr-0.5">·</span>}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {topCast.length > 0 && (
                  <div className="grid grid-cols-12 gap-4 py-3 text-sm">
                    <span className="col-span-4 sm:col-span-3 lg:col-span-2 font-bold text-white/90">
                      Stars
                    </span>
                    <div className="col-span-8 sm:col-span-9 lg:col-span-10 flex flex-wrap items-center gap-1.5 text-white/80">
                      {topCast.map((actor, idx) => (
                        <span key={actor.id || actor.name} className="flex items-center">
                          {actor.slug || actor.id ? (
                            <Link to={`/people/${actor.slug || actor.id}`} className="text-brand hover:underline font-bold">
                              {formatPersonName(actor.name)}
                            </Link>
                          ) : (
                            <span className="text-white font-bold">{formatPersonName(actor.name)}</span>
                          )}
                          {idx < topCast.length - 1 && <span className="text-white/40 ml-1.5 mr-0.5">·</span>}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Right 4 Cols: Action Aside (IMDb-Style Prominent Streaming Module, Watchlist, Rate, Recommend) */}
            <div className="lg:col-span-4 flex flex-col gap-3">
              {/* 1. STREAMING / WHERE TO WATCH (Prominent IMDb-Style Module) */}
              {(availablePlatforms.length > 0 || film.is_in_cinemas) && (
                <div className="flex flex-col gap-2 p-3.5 rounded-2xl bg-white/[0.04] border border-white/10 shadow-lg backdrop-blur-md">
                  <div className="flex items-center justify-between px-0.5">
                    <span className="text-[11px] font-black uppercase tracking-widest text-brand flex items-center gap-1.5">
                      <Icon icon="solar:tv-bold" className="text-sm" />
                      Streaming
                    </span>
                    {availablePlatforms.length > 1 && (
                      <span className="text-[10px] font-bold text-white/50 tracking-wider">
                        {availablePlatforms.length} services available
                      </span>
                    )}
                  </div>

                  {/* Single Platform: Wide Prominent Feature Card (Like IMDb's Prime Video Slate) */}
                  {availablePlatforms.length === 1 && (() => {
                    const platform = availablePlatforms[0];
                    const url = (platform.id === 'youtube' && fullYoutubeUrl)
                      ? fullYoutubeUrl
                      : getWatchUrl(film, platform.id);
                    const cardContent = (
                      <div
                        className="w-full h-12 sm:h-13 rounded-xl flex items-center justify-between px-3.5 sm:px-4 transition-all duration-200 hover:scale-[1.02] shadow-md group cursor-pointer border border-white/20"
                        style={{
                          backgroundColor: platform.color ? `${platform.color}dd` : '#1e222d',
                        }}
                      >
                        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                          {platform.logo ? (
                            <div className="w-8 h-8 sm:w-8.5 sm:h-8.5 rounded-lg bg-white flex items-center justify-center p-1 shrink-0 shadow-sm">
                              <img src={platform.logo} alt="" className="w-full h-full object-contain" />
                            </div>
                          ) : (
                            <div className="w-8 h-8 sm:w-8.5 sm:h-8.5 rounded-lg bg-white/20 flex items-center justify-center shrink-0">
                              <Icon icon={platform.icon} className="text-lg text-white" />
                            </div>
                          )}
                          <div className="flex flex-col min-w-0 text-left">
                            <span className="text-[9px] sm:text-[10px] font-bold text-white/80 uppercase tracking-wider leading-none">
                              Watch on
                            </span>
                            <span className="text-xs sm:text-sm font-black text-white truncate leading-tight mt-0.5">
                              {platform.name}
                            </span>
                          </div>
                        </div>
                        <div className="w-7 h-7 sm:w-7.5 sm:h-7.5 rounded-full bg-white/20 flex items-center justify-center text-white group-hover:bg-white group-hover:text-black transition-all shrink-0">
                          <Icon icon="solar:play-bold" className="text-xs sm:text-sm ml-0.5" />
                        </div>
                      </div>
                    );

                    return url ? (
                      <a href={url} target="_blank" rel="noopener noreferrer" title={`Watch on ${platform.name}`}>
                        {cardContent}
                      </a>
                    ) : (
                      <Link to={`/watch/${platform.id}`} title={`Explore ${platform.name}`}>
                        {cardContent}
                      </Link>
                    );
                  })()}

                  {/* Multiple Platforms: Generous 2-Column Grid of Watch Tiles */}
                  {availablePlatforms.length > 1 && (
                    <div className="grid grid-cols-2 gap-2">
                      {availablePlatforms.map((platform) => {
                        const url = (platform.id === 'youtube' && fullYoutubeUrl)
                          ? fullYoutubeUrl
                          : getWatchUrl(film, platform.id);
                        const cardContent = (
                          <div
                            className="h-11 sm:h-12 rounded-xl flex items-center justify-between px-2.5 sm:px-3 transition-all duration-200 hover:scale-[1.02] shadow-sm group cursor-pointer border border-white/10 bg-[#1e222d] hover:bg-[#282d3c] hover:border-white/25"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              {platform.logo ? (
                                <div className="w-7 h-7 sm:w-7.5 sm:h-7.5 rounded-lg bg-white flex items-center justify-center p-1 shrink-0 shadow-sm">
                                  <img src={platform.logo} alt="" className="w-full h-full object-contain" />
                                </div>
                              ) : (
                                <div
                                  className="w-7 h-7 sm:w-7.5 sm:h-7.5 rounded-lg flex items-center justify-center shrink-0 bg-white/10"
                                >
                                  <Icon
                                    icon={platform.icon}
                                    className="text-base"
                                    style={{ color: platform.color || '#fff' }}
                                  />
                                </div>
                              )}
                              <div className="flex flex-col min-w-0 text-left">
                                <span className="text-[9px] font-bold text-white/50 uppercase tracking-wider leading-none">
                                  Watch on
                                </span>
                                <span className="text-xs font-black text-white truncate leading-tight mt-0.5">
                                  {platform.name}
                                </span>
                              </div>
                            </div>
                            <Icon
                              icon="solar:arrow-right-up-linear"
                              className="text-xs text-white/40 group-hover:text-white group-hover:translate-x-0.5 transition-all shrink-0 ml-1"
                            />
                          </div>
                        );

                        return url ? (
                          <a
                            key={platform.id}
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            title={`Watch on ${platform.name}`}
                          >
                            {cardContent}
                          </a>
                        ) : (
                          <Link
                            key={platform.id}
                            to={`/watch/${platform.id}`}
                            title={`Browse ${platform.name} titles`}
                          >
                            {cardContent}
                          </Link>
                        );
                      })}
                    </div>
                  )}

                  {/* Theatrical Cinema Release Bar if currently in cinemas */}
                  {film.is_in_cinemas && (
                    <div className="h-10 sm:h-11 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-between px-3.5 text-amber-300">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                        <span className="text-xs font-bold uppercase tracking-wider">In Cinemas Now</span>
                      </div>
                      <Link
                        to="/cinemas"
                        className="text-[11px] font-bold text-amber-300 hover:text-white transition-colors flex items-center gap-1"
                      >
                        <span>Showtimes</span>
                        <Icon icon="solar:alt-arrow-right-linear" />
                      </Link>
                    </div>
                  )}
                </div>
              )}

              {/* 2. Primary: Watchlist Button (Nollywire / IMDb Style) */}
              <button
                type="button"
                onClick={handleWatchlist}
                disabled={watchlistLoading}
                className={`w-full flex items-center justify-center gap-2 px-4 py-2.5 sm:py-3 rounded-xl text-xs sm:text-[13px] font-bold tracking-wide transition-all duration-200 cursor-pointer active:scale-98 disabled:opacity-50 ${
                  inWatchlist
                    ? 'bg-amber-400/20 border border-amber-400/50 text-amber-300 shadow-sm'
                    : 'bg-[#222530] hover:bg-[#2b303d] border border-white/15 text-white shadow-sm'
                }`}
              >
                <Icon
                  icon={inWatchlist ? 'solar:bookmark-check-bold' : 'solar:bookmark-linear'}
                  className={`text-base sm:text-lg ${inWatchlist ? 'text-amber-400' : 'text-white/80'}`}
                />
                <span>{inWatchlist ? 'In Watchlist' : '+ Add to Watchlist'}</span>
              </button>

              {/* 3. Secondary Actions Grid (Rate & Review, Recommend) */}
              <div className="grid grid-cols-2 gap-2 sm:gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    setShowReviewForm(true);
                    const el = document.getElementById('rate-prompt-section') || document.getElementById('reviews-section');
                    if (el) el.scrollIntoView({ behavior: 'smooth' });
                  }}
                  className="flex items-center justify-center gap-1.5 py-2 px-2.5 sm:px-3 rounded-xl bg-[#222530]/80 hover:bg-[#2b303d] border border-white/15 text-white/90 text-xs font-bold transition-all cursor-pointer"
                >
                  <Icon icon="solar:star-linear" className="text-sm text-amber-400" />
                  <span>Rate & Review</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleReaction('like')}
                  disabled={reactionLoading}
                  className={`flex items-center justify-center gap-1.5 py-2 px-2.5 sm:px-3 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                    userReaction === 'like'
                      ? 'bg-brand/20 border-brand text-brand'
                      : 'bg-[#222530]/80 hover:bg-[#2b303d] border-white/15 text-white/90'
                  }`}
                >
                  <Icon icon={userReaction === 'like' ? 'solar:like-bold' : 'solar:like-linear'} className="text-sm text-brand" />
                  <span>{likesCount > 0 ? `${likesCount} Likes` : 'Recommend'}</span>
                </button>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* 2. STICKY SUB-NAVIGATION BAR (Nollywire/IMDb scrollspy with native design tokens) */}
      <nav 
        aria-label="Film sub-navigation"
        className="sticky top-16 z-30 bg-bg/95 backdrop-blur-md border-b border-border shadow-sm transition-all"
      >
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 md:px-8 lg:px-12 flex items-center justify-start gap-1 sm:gap-2 overflow-x-auto no-scrollbar py-2">
          {navTabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => scrollToTab(tab.id)}
                className={`shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
                  isActive
                    ? 'bg-brand text-white shadow-sm shadow-brand/20'
                    : 'text-text-muted hover:text-text-primary hover:bg-surface-2/60'
                }`}
              >
                {tab.icon && <Icon icon={tab.icon} className="text-sm" />}
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* 3. CONTENT SECTIONS (Nollywire & IMDb Clean Architecture) */}
      <main className="max-w-[1440px] mx-auto min-h-[600px] divide-y divide-border">
            {/* Unified Movie Info (Storyline & Synopsis + Production & Industry Specs) */}
            <div id="overview-section" className="scroll-mt-28">
              <FilmSpecsTable
                film={film}
                cast={cast}
                crew={crew}
                synopsis={film.synopsis}
                isAdmin={isAdmin}
                onEditBoxOffice={() => setShowBoxOfficeModal(true)}
                onOpenBoxOfficeBreakdown={() => navigate(`/films/${film.slug || film.id}/box-office`)}
                onSuggestEdit={() => setShowFilmEdit(true)}
                onReport={() => setShowReport(true)}
              />
            </div>
            {showBoxOfficeModal && (
              <AdminBoxOfficeModal
                film={film}
                onClose={() => setShowBoxOfficeModal(false)}
                onUpdated={(updatedFilm) => {
                  setFilm((prev) => ({
                    ...prev,
                    ...updatedFilm,
                  }));
                }}
              />
            )}
            {showBoxOfficeBreakdown && (
              <BoxOfficeBreakdownModal
                film={film}
                onClose={() => setShowBoxOfficeBreakdown(false)}
              />
            )}
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
              <section id="episodes-section" className="p-8 md:p-12 border-b border-border bg-surface-2/5 scroll-mt-28">
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

            {/* Cast (Nollywire / IMDb Responsive Grid) */}
            {cast.length > 0 && (
              <section id="cast-section" className="p-5 sm:p-6 md:p-8 border-b border-border scroll-mt-28">
                <div className="flex items-center justify-between mb-5 sm:mb-6">
                  <div className="flex items-center gap-2.5 sm:gap-3">
                    <span className="w-1.5 h-5 sm:h-6 rounded-full bg-brand shrink-0" />
                    <h2 className="font-heading font-black text-xl sm:text-2xl text-text-primary tracking-tight leading-none">
                      Top Cast
                    </h2>
                    <span className="text-[11px] sm:text-xs text-text-muted font-bold px-2 py-0.5 rounded-full bg-surface-2 border border-border">
                      {cast.length} {cast.length === 1 ? 'credit' : 'credits'}
                    </span>
                  </div>
                  {cast.length > 8 && (
                    <button
                      onClick={() => setShowAllCast(prev => !prev)}
                      className="text-xs font-bold text-brand hover:underline inline-flex items-center gap-1"
                    >
                      <span>{showAllCast ? 'Show top cast' : `See all ${cast.length}`}</span>
                      <Icon icon={showAllCast ? 'solar:alt-arrow-up-linear' : 'solar:alt-arrow-down-linear'} />
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-3.5">
                  {(showAllCast ? cast : cast.slice(0, 8)).map(person => (
                    <Link 
                      key={person.id} 
                      to={`/people/${person.slug || person.id}`}
                      className="group flex flex-col bg-surface/50 hover:bg-surface-2/60 rounded-xl p-2 sm:p-2.5 border border-border hover:border-brand/50 transition-all duration-300 shadow-sm"
                    >
                      <div className="relative w-full aspect-[3/4] rounded-lg overflow-hidden border border-border/80 group-hover:border-brand/40 bg-surface-2 shadow-inner">
                        <ImageWithFallback
                          src={person.photo_url}
                          alt={formatPersonName(person.name)}
                          fallbackType="avatar"
                          name={formatPersonName(person.name)}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          width={256}
                          sizes="(max-width: 639px) 140px, 180px"
                          loading="lazy"
                        />
                      </div>
                      <div className="mt-2.5 flex flex-col text-left px-0.5 min-w-0">
                        <span className="font-bold text-text-primary text-xs sm:text-sm tracking-tight leading-snug truncate group-hover:text-gold transition-colors">
                          {formatPersonName(person.name)}
                        </span>
                        <span className="text-[11px] text-text-muted font-medium mt-0.5 line-clamp-2 leading-relaxed">
                          {person.character_name ? `as ${toTitleCase(person.character_name)}` : toTitleCase(person.role || 'Cast')}
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>
                
                {cast.length > 8 && (
                  <div className="mt-6 flex justify-center">
                    <button
                      onClick={() => setShowAllCast(prev => !prev)}
                      className="min-h-[40px] px-5 py-2 bg-surface hover:bg-surface-2 border border-border hover:border-brand/50 text-text-primary text-xs font-bold rounded-lg transition-colors inline-flex items-center gap-2 shadow-sm"
                    >
                      <Icon icon={showAllCast ? 'solar:alt-arrow-up-linear' : 'solar:users-group-rounded-linear'} className="text-brand text-sm" />
                      <span>{showAllCast ? 'Show less' : `Show all ${cast.length} cast members`}</span>
                    </button>
                  </div>
                )}
              </section>
            )}

            {/* Crew */}
            {crew.length > 0 && (
              <section id="crew-section" className="p-5 sm:p-6 md:p-8 border-b border-border scroll-mt-28">
                <div className="flex items-center gap-2.5 sm:gap-3 mb-2">
                  <span className="w-1.5 h-5 sm:h-6 rounded-full bg-brand shrink-0" />
                  <h2 className="font-heading font-black text-xl sm:text-2xl text-text-primary tracking-tight leading-none">Crew</h2>
                </div>
                <p className="text-xs text-text-muted mb-5 pl-4">{crew.length} {crew.length === 1 ? 'member' : 'members'}</p>
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
              <section id="awards-section" className="p-8 md:p-12 border-b border-border scroll-mt-28">
                <button
                  type="button"
                  onClick={() => setAwardsOpen((prev) => !prev)}
                  aria-expanded={awardsOpen}
                  className="w-full flex items-center justify-between gap-4 text-left group"
                >
                  <div className="flex flex-wrap items-center gap-3 min-w-0">
                    <span className="w-1.5 h-6 rounded-full bg-brand shrink-0" />
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
                          className="flex items-start gap-3.5 py-4"
                        >
                          <Link
                            to={`/awards/${normOrg(award.organization)}`}
                            className="shrink-0 hover:scale-105 transition-transform"
                            title={award.organization || 'Award Ceremony'}
                          >
                            <AwardLogo org={award.organization} size="sm" />
                          </Link>
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
                              <Link
                                to={`/awards/${normOrg(award.organization)}`}
                                className="hover:text-text-primary hover:underline font-semibold text-text-primary/90"
                              >
                                {award.organization || 'AMVCA'}
                              </Link>
                              {award.year ? ` · ${award.year}` : ''}
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
            <div className="px-5 sm:px-6 md:px-8 pt-4">
              <CriticReviewsSection filmId={film.id} user={user} filmSlug={film.slug || slug} />
            </div>

            {/* Rotten Tomatoes "What did you think? / Rate it" interactive banner */}
            <div id="rate-prompt-section" className="px-5 sm:px-6 md:px-8 pt-5">
              <RateMoviePrompt
                filmTitle={formatFilmTitle(film.title)}
                userReaction={userReaction}
                likesCount={likesCount}
                dislikesCount={dislikesCount}
                onReaction={handleReaction}
                onWriteReviewClick={() => {
                  setShowReviewForm(true);
                  const el = document.getElementById('reviews-section');
                  if (el) el.scrollIntoView({ behavior: 'smooth' });
                }}
              />
            </div>

            {/* Reviews */}
            <section id="reviews-section" className="p-5 sm:p-6 md:p-8 scroll-mt-28">
              <ReviewSection
                filmId={film.id}
                currentUser={user}
                filmTitle={film.title}
                filmSlug={film.slug || slug}
                openForm={showReviewForm}
                onCloseForm={() => setShowReviewForm(false)}
              />
            </section>
      {/* More Like This (Nollywire / IMDb Style Responsive Grid) */}
      {relatedFilms.length > 0 && (
        <section id="related-section" className="p-5 sm:p-6 md:p-8 scroll-mt-28">
          <div className="flex items-center justify-between mb-5 sm:mb-6">
            <div className="flex items-center gap-2.5 sm:gap-3">
              <span className="w-1.5 h-5 sm:h-6 rounded-full bg-brand shrink-0" />
              <h2 className="font-heading font-black text-xl sm:text-2xl text-text-primary tracking-tight leading-none">
                More Like This
              </h2>
              <span className="text-[11px] sm:text-xs text-text-muted font-bold px-2 py-0.5 rounded-full bg-surface-2 border border-border">
                Recommended
              </span>
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-3.5">
            {relatedFilms.slice(0, 12).map((relatedFilm) => (
              <Link
                key={relatedFilm.id}
                to={`/films/${relatedFilm.slug || relatedFilm.id}`}
                className="group flex flex-col bg-surface/50 hover:bg-surface-2/60 rounded-xl p-2 sm:p-2.5 border border-border hover:border-brand/50 transition-all duration-300 shadow-sm"
              >
                <div className="relative w-full aspect-[2/3] rounded-lg overflow-hidden border border-border/80 group-hover:border-brand/40 bg-surface-2 shadow-inner">
                  <ImageWithFallback
                    src={relatedFilm.poster_url || relatedFilm.poster}
                    alt={relatedFilm.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    fallbackType="film"
                    name={relatedFilm.title}
                    width={240}
                    sizes="(max-width: 639px) 140px, 200px"
                    loading="lazy"
                  />
                </div>
                <div className="mt-2.5 flex flex-col text-left px-0.5 min-w-0">
                  <h4 className="font-bold text-text-primary text-xs sm:text-sm tracking-tight leading-snug truncate group-hover:text-gold transition-colors">
                    {formatFilmTitle(relatedFilm.title)}
                  </h4>
                  <div className="flex items-center gap-1.5 text-[11px] font-medium text-text-muted mt-0.5">
                    <span>{relatedFilm.year}</span>
                    {relatedFilm.genres && relatedFilm.genres.length > 0 && (
                      <>
                        <span>·</span>
                        <span className="truncate">{relatedFilm.genres[0]}</span>
                      </>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}
    </main>
  </div>
);
}
