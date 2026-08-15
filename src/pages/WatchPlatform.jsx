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

  const featuredFilms = useMemo(() => {
    return films.slice(0, 5);
  }, [films]);

  const accentColor = platform?.color || '#D0A008';

  if (!platform) return <Navigate to="/browse" replace />;

  return (
    <div className="min-h-screen bg-bg">

      {/* Clean Product-Driven Hero Header matching Mockup */}
      <div className="relative bg-[#07070a] border-b border-border/60 overflow-hidden pt-28 pb-12 md:py-20">
        {/* Subtle Grid Background & Dynamic Ambient Color Glow */}
        <div className="absolute inset-0 grid-bg opacity-20 pointer-events-none" />
        <div
          className="absolute top-0 right-0 w-[700px] h-[500px] blur-3xl pointer-events-none rounded-full"
          style={{
            background: `radial-gradient(circle at 80% 20%, ${accentColor}25 0%, ${accentColor}08 50%, transparent 80%)`,
          }}
        />

        <div className="max-w-7xl mx-auto px-4 md:px-8 relative z-10">
          
          {/* Top Row: Back Link (Left) & Platform Brand Emblem (Right) */}
          <div className="flex items-center justify-between mb-8">
            <Link
              to="/browse"
              className="inline-flex items-center gap-2 text-text-muted text-[11px] font-bold uppercase tracking-widest transition-colors group"
            >
              <Icon icon="solar:alt-arrow-left-linear" className="w-4 h-4 transition-transform group-hover:-translate-x-1" style={{ color: accentColor }} />
              <span className="group-hover:text-text-primary transition-colors">WHERE TO WATCH</span>
            </Link>

            {/* Platform Brand Emblem (Top Right) */}
            <div className="flex items-center gap-3 bg-surface-2/40 backdrop-blur-md border border-white/10 px-4 py-2 rounded-2xl">
              {platform.logo ? (
                <img src={platform.logo} alt={platform.name} className="h-7 w-auto object-contain" />
              ) : (
                <div
                  className="w-8 h-8 rounded-xl flex items-center justify-center"
                  style={{ background: `${accentColor}22`, color: accentColor }}
                >
                  <Icon icon={platform.icon} className="text-xl" />
                </div>
              )}
              <span className="text-lg md:text-xl font-heading font-extrabold text-white tracking-tight">
                {platform.name}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-8 items-start">
            
            {/* Left Info & Feature Badges Column */}
            <div className="lg:col-span-5 xl:col-span-5 space-y-6">
              <div className="flex items-start gap-4">
                <div
                  className="w-14 h-14 md:w-16 md:h-16 rounded-2xl flex items-center justify-center border shrink-0 transition-all shadow-lg"
                  style={{
                    background: `${accentColor}18`,
                    borderColor: `${accentColor}40`,
                    color: accentColor,
                    boxShadow: `0 8px 24px ${accentColor}20`,
                  }}
                >
                  {platform.logo ? (
                    <img src={platform.logo} alt={platform.name} className="w-9 h-9 object-contain" />
                  ) : (
                    <Icon icon={platform.icon} className="text-3xl md:text-4xl" />
                  )}
                </div>
                <div className="space-y-1">
                  <h1 className="text-3xl sm:text-4xl md:text-5xl font-heading font-extrabold text-white tracking-tight leading-none">
                    Watch on
                  </h1>
                  <h2 className="text-3xl sm:text-4xl md:text-5xl font-heading font-extrabold tracking-tight leading-none" style={{ color: accentColor }}>
                    {platform.name}
                  </h2>
                  <p className="text-text-muted text-xs md:text-sm font-medium pt-2">
                    {loading ? 'Loading titles…' : `${totalCount} Nollywood ${totalCount === 1 ? 'title' : 'titles'} available`}
                  </p>
                </div>
              </div>

              {/* Dynamic Theme Accent Line */}
              <div
                className="w-12 h-1 rounded-full"
                style={{
                  backgroundColor: accentColor,
                  boxShadow: `0 0 12px ${accentColor}88`,
                }}
              />

              <p className="text-text-muted text-xs sm:text-sm leading-relaxed max-w-md">
                From timeless classics to the latest blockbusters, stream premium Nollywood movies anytime, anywhere.
              </p>

              {/* Bottom Feature Badges Grid (4 Items) */}
              <div className="grid grid-cols-4 gap-2 pt-4">
                {[
                  { label: 'Stream Anytime', icon: 'solar:clapperboard-play-bold' },
                  { label: 'Premium Nollywood', icon: 'solar:play-circle-bold' },
                  { label: 'Watch on Any Device', icon: 'solar:laptop-bold' },
                  { label: 'Safe & Reliable', icon: 'solar:shield-check-bold' },
                ].map((feat, idx) => (
                  <div key={idx} className="flex flex-col items-center text-center space-y-1.5 p-2 rounded-xl bg-surface-2/15 border border-white/5">
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center border"
                      style={{
                        background: `${accentColor}15`,
                        borderColor: `${accentColor}30`,
                        color: accentColor,
                      }}
                    >
                      <Icon icon={feat.icon} className="text-base" />
                    </div>
                    <span className="text-[10px] font-semibold text-text-muted leading-tight">
                      {feat.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Right Featured Movie Cards Row (5 Cards) */}
            <div className="lg:col-span-7 xl:col-span-7 space-y-6">
              
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 sm:gap-4">
                {featuredFilms.length > 0
                  ? featuredFilms.map((film) => (
                      <Link
                        key={film.id}
                        to={`/films/${film.slug || film.id}`}
                        className="group flex flex-col bg-[#0b0b10] border rounded-2xl p-2 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl"
                        style={{ borderColor: `${accentColor}30` }}
                      >
                        <div className="relative aspect-[2/3] w-full rounded-xl overflow-hidden shadow-md mb-2 bg-surface-2/40">
                          {film.poster_url || film.backdrop_url ? (
                            <img
                              src={film.poster_url || film.backdrop_url}
                              alt={film.title}
                              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                              loading="lazy"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-text-muted">
                              <Icon icon="solar:film-strip-bold" className="text-2xl" />
                            </div>
                          )}
                          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                        <h3 className="text-xs font-bold text-white truncate px-1 group-hover:text-amber-400 transition-colors">
                          {film.title}
                        </h3>
                        <p className="text-[10px] text-text-muted truncate px-1 mt-0.5">
                          {Array.isArray(film.genres) && film.genres.length > 0 ? film.genres.join(', ') : 'Nollywood'}
                        </p>
                        <span className="text-[10px] font-semibold px-1 mt-0.5" style={{ color: accentColor }}>
                          {film.year || 'Released'}
                        </span>
                      </Link>
                    ))
                  : [...Array(5)].map((_, i) => (
                      <div key={i} className="bg-surface-2/20 border border-white/5 rounded-2xl p-2 space-y-2 animate-pulse">
                        <div className="aspect-[2/3] w-full rounded-xl bg-surface-2/40" />
                        <div className="h-3 bg-surface-2/60 rounded w-3/4" />
                        <div className="h-2 bg-surface-2/40 rounded w-1/2" />
                      </div>
                    ))}
              </div>

              {/* Bottom MuviDB Banner Pill */}
              <div className="bg-[#0b0b10] border border-white/10 p-4 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4 shadow-lg">
                <div className="flex items-center gap-3.5">
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 border"
                    style={{ background: `${accentColor}20`, borderColor: `${accentColor}40`, color: accentColor }}
                  >
                    <Icon icon="solar:videocamera-record-bold" className="text-xl" />
                  </div>
                  <p className="text-xs sm:text-sm font-medium text-text-muted leading-tight">
                    Find out where your favorite African movies are streaming.{' '}
                    <span className="font-bold block sm:inline" style={{ color: accentColor }}>
                      MuviDB shows you. You decide what to watch.
                    </span>
                  </p>
                </div>

                <div className="flex items-center gap-3 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 sm:border-l border-white/10 sm:pl-4">
                  <img src="/filmhouse.png" alt="MuviDB" className="h-6 w-auto object-contain opacity-80" />
                  <span className="text-base font-heading font-extrabold text-white tracking-tight">
                    MuviDB
                  </span>
                </div>
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
              newThisMonth ? 'text-white shadow-md' : 'bg-surface border-border text-text-muted hover:border-white/20'
            }`}
            style={
              newThisMonth
                ? { backgroundColor: accentColor, borderColor: accentColor, boxShadow: `0 4px 14px ${accentColor}40` }
                : {}
            }
          >
            <Icon icon="solar:fire-bold" className="text-sm" /> New this month
          </button>

          <select
            value={selectedGenre}
            onChange={(e) => setSelectedGenre(e.target.value)}
            className="bg-surface border border-border text-text-primary rounded-xl px-4 py-2 text-[11px] font-bold tracking-wider outline-none transition-all"
            style={{
              borderColor: selectedGenre ? accentColor : undefined,
            }}
          >
            <option value="">All genres</option>
            {genres.map((g) => (
              <option key={g} value={g}>{g}</option>
            ))}
          </select>

          <select
            value={yearMin}
            onChange={(e) => setYearMin(parseInt(e.target.value, 10))}
            className="bg-surface border border-border text-text-primary rounded-xl px-4 py-2 text-[11px] font-bold tracking-wider outline-none transition-all"
            style={{
              borderColor: yearMin ? accentColor : undefined,
            }}
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
              className="text-[10px] font-bold hover:underline uppercase tracking-widest ml-1"
              style={{ color: accentColor }}
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
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-6 sm:gap-8">
                {[...Array(10)].map((_, i) => (
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
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-6 sm:gap-8">
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
