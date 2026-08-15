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

  const accentColor = platform?.color || '#D0A008';

  if (!platform) return <Navigate to="/browse" replace />;

  return (
    <div className="min-h-screen bg-bg">

      {/* Hero Header with Dynamic Platform Colors & User Provided Film Reel Artwork */}
      <div className="relative bg-[#07070a] border-b border-border/60 overflow-hidden pt-28 pb-16 md:py-24">
        {/* Dynamic Platform Ambient Color Glow */}
        <div
          className="absolute top-1/2 right-0 -translate-y-1/2 w-[700px] h-[550px] blur-3xl pointer-events-none rounded-full"
          style={{
            background: `radial-gradient(circle at 75% 50%, ${accentColor}33 0%, ${accentColor}10 45%, transparent 75%)`,
          }}
        />
        <div className="absolute inset-0 grid-bg opacity-15 pointer-events-none" />

        <div className="max-w-7xl mx-auto px-4 md:px-8 relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-12 items-center gap-12 lg:gap-8">
            
            {/* Left Info Column */}
            <div className="lg:col-span-6 xl:col-span-5 space-y-6">
              <Link
                to="/browse"
                className="inline-flex items-center gap-2 text-text-muted text-[11px] font-bold uppercase tracking-widest transition-colors group"
              >
                <Icon icon="solar:alt-arrow-left-linear" className="w-4 h-4 transition-transform group-hover:-translate-x-1" style={{ color: accentColor }} />
                <span className="group-hover:text-text-primary transition-colors">WHERE TO WATCH</span>
              </Link>

              <div className="flex items-center gap-4">
                <div
                  className="w-14 h-14 md:w-16 md:h-16 rounded-2xl flex items-center justify-center border shrink-0 transition-all"
                  style={{
                    background: `${accentColor}20`,
                    borderColor: `${accentColor}40`,
                    color: accentColor,
                    boxShadow: `0 8px 24px ${accentColor}25`,
                  }}
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

              {/* Dynamic Theme Color Accent Line */}
              <div
                className="w-12 h-1 rounded-full"
                style={{
                  backgroundColor: accentColor,
                  boxShadow: `0 0 14px ${accentColor}88`,
                }}
              />

              <p className="text-text-muted text-sm md:text-base leading-relaxed max-w-lg">
                From timeless classics to the latest blockbusters, stream premium Nollywood movies anytime, anywhere.
              </p>
            </div>

            {/* Right 3D Poster Fan & Film Reel Artwork */}
            <div className="lg:col-span-7 xl:col-span-7 relative flex justify-center lg:justify-end overflow-hidden lg:overflow-visible py-4">
              
              {/* User-provided High-Res Golden Film Reel Artwork (Far Right) */}
              <div className="absolute -right-8 sm:-right-14 md:-right-18 top-1/2 -translate-y-1/2 w-[320px] sm:w-[420px] md:w-[520px] lg:w-[580px] pointer-events-none z-10">
                <img
                  src="/images/film_reel_vector.svg"
                  alt="Cinema Film Reel"
                  className="w-full h-auto object-contain drop-shadow-[0_0_50px_rgba(0,0,0,0.9)]"
                  onError={(e) => {
                    // Fallback to original PNG if SVG renderer encounters issues
                    e.currentTarget.src = '/images/film_reel_original.png';
                  }}
                />
              </div>

              {/* 3D Poster Collage Container */}
              <div className="relative w-full max-w-[680px] lg:max-w-[760px] h-[420px] sm:h-[500px] md:h-[560px] lg:h-[600px] flex items-center justify-center">
                
                {/* 2-Tier Large Poster Grid matching reference mockup */}
                {headerPosters.length > 0 ? (
                  <div className="relative w-full h-full z-20">
                    {headerPosters.slice(0, 9).map((posterUrl, idx) => {
                      const cardStyles = [
                        // Row 1 (Top / Upper Level)
                        { pos: 'left-[2%] sm:left-[3%] top-[4%] sm:top-[5%]', rotate: 'rotate-3', z: 'z-10' },
                        { pos: 'left-[18%] sm:left-[20%] top-[2%] sm:top-[3%]', rotate: 'rotate-6', z: 'z-15' },
                        { pos: 'left-[35%] sm:left-[37%] top-[0%]', rotate: 'rotate-6', z: 'z-20' },
                        { pos: 'left-[52%] sm:left-[54%] top-[2%] sm:top-[3%]', rotate: 'rotate-8', z: 'z-15' },
                        { pos: 'left-[68%] sm:left-[70%] top-[5%] sm:top-[6%]', rotate: 'rotate-10', z: 'z-10' },
                        // Row 2 (Bottom / Front Level - Overlapping Upward)
                        { pos: 'left-[10%] sm:left-[12%] top-[46%] sm:top-[48%]', rotate: 'rotate-4', z: 'z-30' },
                        { pos: 'left-[27%] sm:left-[29%] top-[48%] sm:top-[50%]', rotate: 'rotate-6', z: 'z-35' },
                        { pos: 'left-[44%] sm:left-[46%] top-[48%] sm:top-[50%]', rotate: 'rotate-8', z: 'z-35' },
                        { pos: 'left-[61%] sm:left-[63%] top-[46%] sm:top-[48%]', rotate: 'rotate-10', z: 'z-30' },
                      ];

                      const style = cardStyles[idx % cardStyles.length];

                      return (
                        <div
                          key={idx}
                          className={`absolute ${style.pos} ${style.rotate} ${style.z} w-32 sm:w-40 md:w-48 lg:w-54 h-48 sm:h-60 md:h-72 lg:h-80 rounded-xl sm:rounded-2xl overflow-hidden border-2 shadow-[0_25px_60px_rgba(0,0,0,0.95)] transition-all duration-500 ease-out hover:rotate-0 hover:scale-120 hover:z-50`}
                          style={{
                            borderColor: `${accentColor}40`,
                          }}
                        >
                          <img
                            src={posterUrl}
                            alt="Movie Poster"
                            className="w-full h-full object-cover"
                            loading="lazy"
                          />
                          {/* Inner shimmer overlay */}
                          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-white/10 pointer-events-none" />
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="relative w-full h-full flex items-center justify-center z-20">
                    {[-10, -5, 0, 5, 10].map((deg, idx) => (
                      <div
                        key={idx}
                        style={{ transform: `rotate(${deg}deg) translateX(${(idx - 2) * 60}px)` }}
                        className="absolute w-36 sm:w-44 h-52 sm:h-64 rounded-2xl bg-surface-2/40 border border-white/10 animate-pulse shadow-xl"
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
