import { useState, useEffect, useMemo } from 'react';
import { useParams, Link, Navigate } from 'react-router-dom';
import { Icon } from '@iconify/react';
import { supabase } from '../lib/supabase';
import FilmCard from '../components/film/FilmCard';
import SkeletonCard from '../components/ui/SkeletonCard';
import { getPlatform, platformFilter } from '../lib/platforms';
import { collapseSeriesFilms } from '../utils/series';

// Reusable "Watch on [Platform]" browse page — owns the "where to watch Nollywood
// on <platform>" search intent. Mirrors Browse's grid/filter UX but pinned to one platform.
export default function WatchPlatform() {
  const { platform: platformId } = useParams();
  const platform = getPlatform(platformId);
  // YouTube thumbnails are 16:9, so those cards use the richer landscape layout
  // shared with the homepage feed. Cinema/streaming posters stay portrait.
  const isYoutube = platformId === 'youtube';

  const [films, setFilms] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [selectedGenre, setSelectedGenre] = useState('');
  const [yearMin, setYearMin] = useState(0);
  const [newThisMonth, setNewThisMonth] = useState(false);

  useEffect(() => {
    if (!platform) return;
    document.title = `Where to Watch Nollywood on ${platform.name} | MuviDB`;
    fetchFilms();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [platformId]);

  const fetchFilms = async () => {
    setLoading(true);
    try {
      // Filter at the DB level so we get ALL of the platform's titles (the catalogue
      // is 19k+; a recency window would miss most of a platform's films).
      // NB: we intentionally DON'T ask for `count: 'exact'` here — the streaming_links
      // JSON filter is unindexed, and adding an exact count roughly tripled the query
      // time (~3.1s vs ~1.2s) which tipped it over the statement timeout under load,
      // throwing and leaving the page blank. The count is fetched separately below as
      // a non-blocking best-effort so it can never blank the grid.
      const runQuery = async (attempt = 0) => {
        const res = await supabase
          .from('films')
          .select(`
            id, title, slug, poster_url, backdrop_url, year, language, genres,
            runtime_minutes, view_count, average_rating, liked_percent, audience_rating, synopsis, tagline,
            tmdb_rating, nfvcb_rating, countries, content_type, youtube_watch_url,
            release_type, streaming_links, source, is_in_cinemas, created_at,
            series_id, episode_number, season_number, episode_count, season_count,
            film_genres(genres(name))
          `)
          .or(platformFilter(platformId))
          .order('created_at', { ascending: false })
          .limit(1000);
        if (res.error && attempt < 2 && res.error.code === '57014') {
          await new Promise((r) => setTimeout(r, 1200 * (attempt + 1)));
          return runQuery(attempt + 1);
        }
        return res;
      };

      const { data, error } = await runQuery();
      if (error) throw error;

      const mapped = (data || []).map((f) => {
        const relatedGenres = f.film_genres?.map((fg) => fg.genres?.name).filter(Boolean) || [];
        return {
          ...f,
          genres: relatedGenres.length > 0 ? relatedGenres : (Array.isArray(f.genres) ? f.genres.filter(Boolean) : []),
        };
      });

      // One card per series — episodes live inside the detail page, not the grid.
      const collapsed = collapseSeriesFilms(mapped);
      setFilms(collapsed);
      // Count grouped cards (not raw episode rows) so the header matches the grid.
      setTotalCount(collapsed.length);
    } catch (err) {
      console.error('Error fetching platform films:', err);
    } finally {
      setLoading(false);
    }
  };

  const genres = useMemo(() => {
    const set = new Set();
    films.forEach((f) => f.genres.forEach((g) => set.add(g)));
    return Array.from(set).sort();
  }, [films]);

  const filtered = useMemo(() => {
    const monthAgo = new Date();
    monthAgo.setDate(monthAgo.getDate() - 31);
    return films.filter((f) => {
      if (selectedGenre && !f.genres.includes(selectedGenre)) return false;
      if (yearMin && (f.year || 0) < yearMin) return false;
      if (newThisMonth && (!f.created_at || new Date(f.created_at) < monthAgo)) return false;
      return true;
    });
  }, [films, selectedGenre, yearMin, newThisMonth]);

  const headerPosters = useMemo(() => {
    const list = films
      .map((f) => f.poster_url || f.backdrop_url)
      .filter(Boolean);
    const unique = Array.from(new Set(list));
    return unique.slice(0, 10);
  }, [films]);

  if (!platform) return <Navigate to="/browse" replace />;

  return (
    <div className="min-h-screen bg-bg">

      {/* Cinematic Header with 3D Poster Collage Fan */}
      <div className="relative bg-[#08080c] border-b border-border/60 overflow-hidden pt-28 pb-16 md:py-24">
        {/* Ambient Warm Golden Glow background */}
        <div className="absolute top-1/2 right-0 -translate-y-1/2 w-[600px] h-[500px] bg-gradient-to-l from-amber-500/15 via-amber-600/5 to-transparent blur-3xl rounded-full pointer-events-none" />
        <div className="absolute inset-0 grid-bg opacity-15 pointer-events-none" />

        <div className="max-w-7xl mx-auto px-4 md:px-8 relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-12 items-center gap-12 lg:gap-8">
            
            {/* Left Info Column */}
            <div className="lg:col-span-6 xl:col-span-5 space-y-6">
              <Link
                to="/browse"
                className="inline-flex items-center gap-2 text-text-muted text-[11px] font-bold uppercase tracking-widest hover:text-amber-400 transition-colors"
              >
                <Icon icon="solar:alt-arrow-left-linear" className="w-4 h-4 text-amber-400" />
                <span>WHERE TO WATCH</span>
              </Link>

              <div className="flex items-center gap-4">
                <div
                  className="w-14 h-14 md:w-16 md:h-16 rounded-2xl flex items-center justify-center border border-amber-500/30 shrink-0 shadow-lg shadow-amber-500/10"
                  style={{ background: `${platform.color}22`, color: platform.color }}
                >
                  {platform.logo ? (
                    <img src={platform.logo} alt={platform.name} className="w-9 h-9 object-contain" />
                  ) : (
                    <Icon icon={platform.icon} className="text-3xl md:text-4xl" />
                  )}
                </div>
                <div>
                  <h1 className="text-3xl sm:text-4xl md:text-5xl font-heading font-extrabold text-white tracking-tight leading-tight">
                    Watch on {platform.name}
                  </h1>
                  <p className="text-text-muted text-sm md:text-base font-medium mt-1">
                    {loading ? 'Loading titles…' : `${totalCount} Nollywood ${totalCount === 1 ? 'title' : 'titles'} available`}
                  </p>
                </div>
              </div>

              {/* Gold Accent Bar */}
              <div className="w-12 h-1 bg-amber-500 rounded-full shadow-sm shadow-amber-500/50" />

              <p className="text-text-muted text-sm md:text-base leading-relaxed max-w-lg">
                From timeless classics to the latest blockbusters, stream premium Nollywood movies anytime, anywhere.
              </p>
            </div>

            {/* Right 3D Poster Fan & Film Reel Collage */}
            <div className="lg:col-span-6 xl:col-span-7 relative flex justify-center lg:justify-end overflow-hidden lg:overflow-visible py-6">
              
              {/* Golden Film Reel Graphic (Behind Collage) */}
              <div className="absolute -right-12 bottom-0 w-[280px] md:w-[360px] opacity-30 pointer-events-none z-0">
                <svg viewBox="0 0 400 400" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full text-amber-500/40">
                  <circle cx="300" cy="200" r="160" stroke="currentColor" strokeWidth="12" />
                  <circle cx="300" cy="200" r="130" stroke="currentColor" strokeWidth="4" strokeDasharray="12 12" />
                  <circle cx="300" cy="200" r="40" stroke="currentColor" strokeWidth="8" />
                  <circle cx="230" cy="200" r="24" fill="currentColor" />
                  <circle cx="370" cy="200" r="24" fill="currentColor" />
                  <circle cx="300" cy="130" r="24" fill="currentColor" />
                  <circle cx="300" cy="270" r="24" fill="currentColor" />
                </svg>
              </div>

              {/* 3D Poster Stack Container */}
              <div className="relative w-full max-w-[560px] h-[320px] sm:h-[380px] md:h-[420px] flex items-center justify-center">
                
                {/* 2-Tier Collage Fan Grid */}
                {headerPosters.length > 0 ? (
                  <div className="relative w-full h-full flex items-center justify-center">
                    {headerPosters.slice(0, 9).map((posterUrl, idx) => {
                      const configs = [
                        { rotate: '-rotate-12', translateY: '-translate-y-12', translateX: '-translate-x-36 sm:-translate-x-44', z: 'z-30', scale: 'scale-100' },
                        { rotate: '-rotate-6', translateY: '-translate-y-8', translateX: '-translate-x-20 sm:-translate-x-24', z: 'z-30', scale: 'scale-105' },
                        { rotate: 'rotate-0', translateY: '-translate-y-4', translateX: 'translate-x-0', z: 'z-40', scale: 'scale-110' },
                        { rotate: 'rotate-6', translateY: '-translate-y-8', translateX: 'translate-x-20 sm:translate-x-24', z: 'z-30', scale: 'scale-105' },
                        { rotate: 'rotate-12', translateY: '-translate-y-12', translateX: 'translate-x-36 sm:translate-x-44', z: 'z-30', scale: 'scale-100' },
                        { rotate: '-rotate-6', translateY: 'translate-y-16', translateX: '-translate-x-28 sm:-translate-x-32', z: 'z-10', scale: 'scale-95' },
                        { rotate: 'rotate-0', translateY: 'translate-y-20', translateX: '-translate-x-8 sm:-translate-x-10', z: 'z-20', scale: 'scale-95' },
                        { rotate: 'rotate-6', translateY: 'translate-y-20', translateX: 'translate-x-8 sm:translate-x-10', z: 'z-20', scale: 'scale-95' },
                        { rotate: 'rotate-12', translateY: 'translate-y-16', translateX: 'translate-x-28 sm:translate-x-32', z: 'z-10', scale: 'scale-95' },
                      ];

                      const cfg = configs[idx % configs.length];

                      return (
                        <div
                          key={idx}
                          className={`absolute top-1/2 left-1/2 -mt-24 sm:-mt-28 -ml-14 sm:-ml-16 w-28 sm:w-32 md:w-36 h-40 sm:h-48 md:h-52 rounded-xl sm:rounded-2xl overflow-hidden border border-white/20 shadow-2xl shadow-black/80 transition-all duration-500 ease-out hover:rotate-0 hover:scale-125 hover:z-50 hover:shadow-amber-500/20 hover:border-amber-400/50 ${cfg.rotate} ${cfg.translateY} ${cfg.translateX} ${cfg.z} ${cfg.scale}`}
                        >
                          <img
                            src={posterUrl}
                            alt="Movie Poster"
                            className="w-full h-full object-cover"
                            loading="lazy"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-white/10 pointer-events-none" />
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="relative w-full h-full flex items-center justify-center">
                    {[-10, -5, 0, 5, 10].map((deg, idx) => (
                      <div
                        key={idx}
                        style={{ transform: `rotate(${deg}deg) translateX(${(idx - 2) * 45}px)` }}
                        className="absolute w-28 sm:w-32 h-40 sm:h-48 rounded-2xl bg-surface-2/40 border border-white/10 animate-pulse shadow-xl"
                      />
                    ))}
                  </div>
                )}
              </div>

            </div>

          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto border-x border-border min-h-screen">
        {/* Filter controls */}
        <div className="flex flex-wrap items-center gap-3 p-6 md:p-8 border-b border-border bg-surface-2/5">
          <button
            onClick={() => setNewThisMonth((v) => !v)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[11px] font-bold uppercase tracking-widest border transition-all ${
              newThisMonth ? 'bg-brand border-brand text-white' : 'bg-surface border-border text-text-muted hover:border-brand/50'
            }`}
          >
            <Icon icon="solar:fire-bold" className="text-sm" /> New this month
          </button>

          <select
            value={selectedGenre}
            onChange={(e) => setSelectedGenre(e.target.value)}
            className="bg-surface border border-border text-text-primary rounded-xl px-4 py-2 text-[11px] font-bold tracking-wider outline-none focus:border-brand transition-all"
          >
            <option value="">All genres</option>
            {genres.map((g) => (
              <option key={g} value={g}>{g}</option>
            ))}
          </select>

          <select
            value={yearMin}
            onChange={(e) => setYearMin(parseInt(e.target.value, 10))}
            className="bg-surface border border-border text-text-primary rounded-xl px-4 py-2 text-[11px] font-bold tracking-wider outline-none focus:border-brand transition-all"
          >
            <option value={0}>Any year</option>
            <option value={2024}>2024 +</option>
            <option value={2020}>2020 +</option>
            <option value={2015}>2015 +</option>
            <option value={2010}>2010 +</option>
          </select>

          {(selectedGenre || yearMin || newThisMonth) && (
            <button
              onClick={() => { setSelectedGenre(''); setYearMin(0); setNewThisMonth(false); }}
              className="text-[10px] font-bold text-brand hover:underline uppercase tracking-widest ml-1"
            >
              Clear
            </button>
          )}
        </div>

        {/* Grid */}
        <div className="p-8 md:p-12">
          {loading ? (
            isYoutube ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-8">
                {[...Array(6)].map((_, i) => (
                  <SkeletonCard key={i} variant="youtube" fullWidth />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
                {[...Array(8)].map((_, i) => (
                  <div key={i} className="flex justify-center"><SkeletonCard size="md" /></div>
                ))}
              </div>
            )
          ) : filtered.length > 0 ? (
            isYoutube ? (
              // Landscape (rectangle) cards — backdrop + runtime + live views, like home.
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-8">
                {filtered.map((film) => (
                  <FilmCard key={film.id} film={film} variant="youtube" fullWidth />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
                {filtered.map((film) => (
                  <div key={film.id} className="flex justify-center"><FilmCard film={film} /></div>
                ))}
              </div>
            )
          ) : (
            <div className="bg-surface-2/10 border-2 border-dashed border-border rounded-xl p-24 text-center">
              <p className="text-text-muted text-xs font-bold mb-6">
                No {platform.name} titles match these filters yet.
              </p>
              <Link to="/browse" className="bg-brand text-white text-[10px] font-bold px-8 py-3 rounded-lg uppercase tracking-widest hover:shadow-brand/20 transition-all">
                Browse all films
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
