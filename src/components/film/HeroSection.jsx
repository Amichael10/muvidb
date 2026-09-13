import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Link, useNavigate } from 'react-router-dom';
import WatchOptions from './WatchOptions';
import { Icon } from '@iconify/react';
import ImageWithFallback from '../ui/ImageWithFallback';
import { formatFilmTitle } from '../../utils/format';
import { getFilmBackdrop } from '../../lib/filmImages';
import { useAuth } from '../../context/AuthContext';
import { useWatchlist } from '../../hooks/useWatchlist';

function WatchlistHeroButton({ film }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { inWatchlist, loading, toggleWatchlist } = useWatchlist(film?.id, user);

  const handleClick = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!user) {
      navigate('/login', { state: { from: `/films/${film.slug || film.id}` } });
      return;
    }
    await toggleWatchlist();
  };

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className={`inline-flex items-center gap-2 px-4 py-3 rounded-[4px] text-xs font-bold uppercase tracking-wider transition-all duration-200 border backdrop-blur-md active:scale-95 ${
        inWatchlist
          ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300'
          : 'bg-white/10 hover:bg-white/20 border-white/20 hover:border-white/40 text-white'
      }`}
      title={inWatchlist ? 'In your Watchlist' : 'Add to Watchlist'}
      aria-label={inWatchlist ? 'In your Watchlist' : 'Add to Watchlist'}
    >
      <Icon
        icon={inWatchlist ? 'solar:check-read-linear' : 'solar:bookmark-linear'}
        className="text-base"
      />
      <span>{inWatchlist ? 'Watchlist' : '+ Watchlist'}</span>
    </button>
  );
}

const formatRuntime = (minutes) => {
  if (!minutes) return null;
  const mins = Number(minutes);
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
};

const getStarRating = (film) => {
  if (film.imdb_rating != null && film.imdb_rating > 0) {
    return Number(film.imdb_rating).toFixed(1);
  }
  if (film.tmdb_rating != null && film.tmdb_rating > 0) {
    return Number(film.tmdb_rating).toFixed(1);
  }
  if (film.audience_rating != null && film.audience_rating > 0) {
    return Number(film.audience_rating).toFixed(1);
  }
  if (film.liked_percent != null && film.liked_percent > 0) {
    return (film.liked_percent / 10).toFixed(1);
  }
  return null;
};

export default function HeroSection({ featuredFilms: featuredFilmsProp, featuredFilm: singleFilmProp, isLoading }) {
  const featuredFilms = (featuredFilmsProp || (singleFilmProp ? [singleFilmProp] : [])).slice(0, 6);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  useEffect(() => {
    if (featuredFilms.length <= 1 || isPaused) return;

    const interval = setInterval(() => {
      setCurrentIndex((prevIndex) => (prevIndex + 1) % featuredFilms.length);
    }, 12000); // Rotate every 12 seconds

    return () => clearInterval(interval);
  }, [featuredFilms.length, isPaused]);

  if (isLoading) {
    return (
      <section className="relative w-full py-4 md:py-6 lg:py-8 bg-[#0B0D10]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col lg:flex-row gap-4 h-auto lg:h-[600px]">
            <div className="relative w-full lg:flex-1 h-[52vh] min-h-[420px] lg:h-full rounded-[6px] bg-[#14181c] border border-white/5 animate-pulse" />
            <div className="hidden lg:flex flex-col w-[360px] xl:w-[410px] shrink-0 h-full gap-3 p-4 bg-[#14181c] rounded-[6px] border border-white/5">
              <div className="w-28 h-5 bg-white/10 animate-pulse rounded-[3px] mb-2" />
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex gap-3.5 h-1/3 p-2 rounded-[4px] bg-white/[0.02]">
                  <div className="w-20 shrink-0 h-full bg-white/10 animate-pulse rounded-[3px]" />
                  <div className="flex flex-col gap-2 flex-1 pt-1">
                    <div className="w-16 h-3 bg-white/10 animate-pulse rounded-[2px]" />
                    <div className="w-full h-4 bg-white/10 animate-pulse rounded-[2px]" />
                    <div className="w-3/4 h-3 bg-white/5 animate-pulse rounded-[2px]" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    );
  }

  if (!featuredFilms || featuredFilms.length === 0) return null;

  const featuredFilm = featuredFilms[currentIndex];
  const starScore = getStarRating(featuredFilm);
  const runtimeLabel = formatRuntime(featuredFilm.runtime_minutes || featuredFilm.runtime);
  const director = featuredFilm.director || featuredFilm.directors?.[0] || featuredFilm.primary_director || null;
  const year = featuredFilm.year || featuredFilm.release_date?.slice(0, 4) || null;
  const primaryGenre = featuredFilm.genres?.[0] || null;

  // Up next list (the remaining films)
  const getUpNextFilms = () => {
    if (featuredFilms.length <= 1) return [];
    const list = [];
    for (let i = 1; i <= Math.min(3, featuredFilms.length - 1); i++) {
      list.push(featuredFilms[(currentIndex + i) % featuredFilms.length]);
    }
    return list;
  };

  const upNextFilms = getUpNextFilms();

  return (
    <section 
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      className="relative w-full py-4 md:py-6 lg:py-8 bg-[#0B0D10] text-white select-none"
      aria-label="Premiere Spotlight"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col lg:flex-row gap-4 h-auto lg:h-[600px]">
          
          {/* Main Cinematic Billboard (Left) */}
          <div className="relative w-full lg:flex-1 h-[58vh] min-h-[480px] lg:h-full rounded-[6px] overflow-hidden border border-white/10 bg-[#121519] group/hero flex shadow-2xl">
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={featuredFilm.id || currentIndex}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.5, ease: 'easeOut' }}
                className="absolute inset-0 z-0"
              >
                {/* Backdrop Image with MUBI Vignette */}
                <div className="absolute inset-0">
                  <ImageWithFallback
                    src={getFilmBackdrop(featuredFilm)}
                    alt={formatFilmTitle(featuredFilm.title)}
                    className="w-full h-full object-cover animate-kenburns"
                    fallbackType="film"
                    name={formatFilmTitle(featuredFilm.title)}
                    width={1440}
                    quality={82}
                    sizes="(max-width: 1024px) 100vw, 75vw"
                    loading="eager"
                    fetchPriority="high"
                  />
                  {/* High-end MUBI obsidian vignette & text contrast gradients */}
                  <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#0B0D10] via-[#0B0D10]/65 to-transparent" />
                  <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-[#0B0D10]/90 via-[#0B0D10]/40 to-transparent" />
                  <div className="pointer-events-none absolute top-0 inset-x-0 h-24 bg-gradient-to-b from-[#0B0D10]/60 to-transparent" />
                </div>

                {/* Bottom Overlay Content */}
                <div className="absolute bottom-0 left-0 right-0 p-6 md:p-8 lg:p-10 flex items-end gap-6 z-20">
                  
                  {/* Letterboxd Unadorned 2:3 Companion Mini-Poster */}
                  <Link 
                    to={`/films/${featuredFilm.slug || featuredFilm.id}`} 
                    className="hidden md:block shrink-0 relative group/poster rounded-[4px] overflow-hidden border border-white/20 hover:border-brand transition-all duration-300 w-[140px] lg:w-[155px] aspect-[2/3] shadow-[0_12px_36px_rgba(0,0,0,0.85)] transform hover:scale-[1.03]"
                    title={`View ${formatFilmTitle(featuredFilm.title)}`}
                  >
                    <ImageWithFallback
                      src={featuredFilm.poster_url || featuredFilm.poster}
                      alt={formatFilmTitle(featuredFilm.title)}
                      className="w-full h-full object-cover"
                      fallbackType="film"
                      name={formatFilmTitle(featuredFilm.title)}
                      width={320}
                      sizes="155px"
                      loading="eager"
                    />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/poster:opacity-100 transition-opacity flex items-center justify-center">
                      <div className="w-10 h-10 rounded-full bg-brand text-white flex items-center justify-center shadow-lg">
                        <Icon icon="solar:play-bold" className="text-lg ml-0.5" />
                      </div>
                    </div>
                  </Link>
                  
                  {/* Editorial Copy & Cinephile Actions */}
                  <div className="flex flex-col flex-1 pb-1 min-w-0">
                    {/* Eyebrow & Live Tags */}
                    <div className="flex items-center gap-2.5 mb-3 flex-wrap">
                      <span className="inline-flex items-center gap-1.5 text-[10px] font-mono font-black uppercase tracking-[0.25em] text-brand bg-brand/10 border border-brand/30 px-2.5 py-0.5 rounded-[3px]">
                        <span className="w-1.5 h-1.5 rounded-full bg-brand animate-pulse" />
                        Film of the Day
                      </span>

                      {featuredFilm.is_in_cinemas && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-mono font-bold uppercase tracking-wider text-emerald-400 bg-emerald-500/10 border border-emerald-500/25 px-2 py-0.5 rounded-[3px]">
                          <Icon icon="solar:ticket-bold" className="text-xs" />
                          In Cinemas
                        </span>
                      )}

                      {starScore && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-400 bg-black/50 border border-amber-400/30 px-2 py-0.5 rounded-[3px]">
                          <span>★</span>
                          <span>{starScore}</span>
                        </span>
                      )}

                      {primaryGenre && (
                        <span className="text-white/60 text-xs font-medium tracking-wide">
                          {primaryGenre}
                        </span>
                      )}
                    </div>

                    {/* Film Title */}
                    <h2 className="text-white text-3xl sm:text-4xl md:text-5xl lg:text-[46px] font-heading font-black tracking-tight mb-2.5 line-clamp-2 leading-[1.08] drop-shadow-[0_4px_16px_rgba(0,0,0,0.9)]">
                      {formatFilmTitle(featuredFilm.title)}
                    </h2>

                    {/* Cinephile Metadata Line */}
                    <div className="flex items-center gap-2 text-xs md:text-sm text-white/75 font-medium mb-3.5 flex-wrap">
                      {director && (
                        <>
                          <span className="text-white font-semibold">Dir. {director}</span>
                          <span className="text-white/30">•</span>
                        </>
                      )}
                      {year && <span>{year}</span>}
                      {runtimeLabel && (
                        <>
                          <span className="text-white/30">•</span>
                          <span>{runtimeLabel}</span>
                        </>
                      )}
                    </div>

                    {/* Poetic Synopsis / Logline */}
                    {featuredFilm.synopsis && (
                      <p className="text-white/80 text-xs sm:text-sm line-clamp-2 mb-6 max-w-2xl font-normal leading-relaxed drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
                        {featuredFilm.synopsis}
                      </p>
                    )}

                    {/* Action Bar */}
                    <div className="flex items-center gap-3 flex-wrap">
                      <WatchOptions film={featuredFilm} />
                      <WatchlistHeroButton film={featuredFilm} />
                      <Link 
                        to={`/films/${featuredFilm.slug || featuredFilm.id}`} 
                        className="inline-flex items-center gap-1.5 px-4 py-3 rounded-[4px] text-xs font-bold uppercase tracking-wider text-white/90 hover:text-white bg-white/5 hover:bg-white/10 border border-white/15 hover:border-white/30 transition-all duration-200"
                      >
                        <span>Details</span>
                        <Icon icon="solar:alt-arrow-right-linear" className="text-base" />
                      </Link>
                    </div>
                  </div>
                </div>
              </motion.div>
            </AnimatePresence>

            {/* Nav Arrows */}
            {featuredFilms.length > 1 && (
              <>
                <button 
                  onClick={(e) => { 
                    e.preventDefault(); 
                    setCurrentIndex(prev => (prev - 1 + featuredFilms.length) % featuredFilms.length); 
                  }}
                  className="absolute left-4 top-1/2 -translate-y-1/2 z-30 w-10 h-10 rounded-[4px] bg-black/60 hover:bg-black/90 text-white border border-white/20 hover:border-brand hover:scale-105 flex items-center justify-center transition-all duration-200 opacity-0 group-hover/hero:opacity-100 hidden md:flex backdrop-blur-md"
                  aria-label="Previous Spotlight"
                >
                  <Icon icon="solar:alt-arrow-left-linear" width="20" />
                </button>
                <button 
                  onClick={(e) => { 
                    e.preventDefault(); 
                    setCurrentIndex(prev => (prev + 1) % featuredFilms.length); 
                  }}
                  className="absolute right-4 top-1/2 -translate-y-1/2 z-30 w-10 h-10 rounded-[4px] bg-black/60 hover:bg-black/90 text-white border border-white/20 hover:border-brand hover:scale-105 flex items-center justify-center transition-all duration-200 opacity-0 group-hover/hero:opacity-100 hidden md:flex backdrop-blur-md"
                  aria-label="Next Spotlight"
                >
                  <Icon icon="solar:alt-arrow-right-linear" width="20" />
                </button>
              </>
            )}

            {/* Progress bar indicator for desktop banner */}
            {featuredFilms.length > 1 && (
              <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-white/10 z-30 hidden md:block">
                <motion.div
                  key={currentIndex + (isPaused ? '-paused' : '-active')}
                  initial={{ width: '0%' }}
                  animate={isPaused ? { width: '0%' } : { width: '100%' }}
                  transition={{ 
                    duration: isPaused ? 0 : 12, 
                    ease: 'linear' 
                  }}
                  className="h-full bg-brand"
                />
              </div>
            )}

            {/* Mobile Slider Indicators (numbered pills) */}
            {featuredFilms.length > 1 && (
              <div className="absolute bottom-3 right-4 flex items-center gap-1.5 z-20 md:hidden bg-black/60 backdrop-blur-md px-2.5 py-1 rounded-[4px] border border-white/15">
                <span className="text-[10px] font-mono text-brand font-bold">0{currentIndex + 1}</span>
                <span className="text-[10px] text-white/40">/</span>
                <span className="text-[10px] font-mono text-white/60">0{featuredFilms.length}</span>
              </div>
            )}
          </div>

          {/* Up Next List (Right Sidebar - MUBI Editorial Queue) */}
          {upNextFilms.length > 0 && (
            <div className="hidden lg:flex flex-col w-[360px] xl:w-[410px] shrink-0 h-full rounded-[6px] p-4 bg-[#121519] border border-white/10">
              <div className="flex items-center justify-between mb-3 px-1 border-b border-white/10 pb-3">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-brand" />
                  <h3 className="text-xs font-mono font-black uppercase tracking-[0.2em] text-white">
                    Up Next Premiere
                  </h3>
                </div>
                <span className="text-[11px] font-mono text-white/40">
                  0{currentIndex + 1} / 0{featuredFilms.length}
                </span>
              </div>
              
              <div className="flex flex-col gap-2.5 flex-1 overflow-hidden">
                {upNextFilms.map((film, idx) => {
                  const actualIndex = featuredFilms.findIndex(f => f.id === film.id);
                  const queueNum = String(actualIndex + 1).padStart(2, '0');
                  const itemStar = getStarRating(film);
                  const itemDirector = film.director || film.directors?.[0] || null;

                  return (
                    <button 
                      key={film.id}
                      onClick={() => setCurrentIndex(actualIndex)}
                      className="group flex gap-3.5 items-start text-left bg-white/[0.02] hover:bg-white/[0.07] border border-transparent hover:border-white/15 p-2.5 rounded-[4px] transition-all duration-200 h-1/3 cursor-pointer"
                    >
                      {/* Monospace Queue Number */}
                      <span className="text-xs font-mono font-bold text-white/40 group-hover:text-brand transition-colors pt-0.5">
                        {queueNum}
                      </span>

                      {/* Pristine 2:3 Thumbnail */}
                      <div className="relative h-full shrink-0 aspect-[2/3] rounded-[3px] overflow-hidden border border-white/10 group-hover:border-white/30 transition-colors shadow-md">
                        <ImageWithFallback
                          src={film.poster_url || film.poster}
                          alt={formatFilmTitle(film.title)}
                          className="w-full h-full object-cover"
                          fallbackType="film"
                          name={formatFilmTitle(film.title)}
                          width={160}
                          sizes="80px"
                          loading="lazy"
                        />
                        <div className="absolute inset-0 bg-black/20 group-hover:bg-black/50 transition-colors flex items-center justify-center">
                          <Icon icon="solar:play-bold" className="text-white text-xl opacity-0 group-hover:opacity-100 transition-transform transform group-hover:scale-110 duration-200" />
                        </div>
                      </div>
                      
                      {/* Film Details */}
                      <div className="flex flex-col justify-between h-full flex-1 min-w-0 py-0.5">
                        <div>
                          <div className="flex items-center gap-2 text-[10px] font-mono text-white/50 uppercase tracking-wider mb-1">
                            {film.year && <span>{film.year}</span>}
                            {itemStar && (
                              <span className="text-amber-400 font-bold">★ {itemStar}</span>
                            )}
                          </div>
                          <h4 className="text-white font-heading font-bold text-sm line-clamp-1 leading-snug group-hover:text-brand transition-colors">
                            {formatFilmTitle(film.title)}
                          </h4>
                          {itemDirector && (
                            <p className="text-white/60 text-[11px] line-clamp-1 font-normal mt-0.5">
                              Dir. {itemDirector}
                            </p>
                          )}
                        </div>

                        <span className="text-[10px] font-mono uppercase tracking-wider text-brand/80 group-hover:text-brand flex items-center gap-1">
                          <span>Switch to spotlight</span>
                          <Icon icon="solar:alt-arrow-right-linear" className="text-xs" />
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
              
              {/* Browse Catalogue Link */}
              <div className="mt-auto pt-3 border-t border-white/10 px-1">
                <Link 
                  to="/browse" 
                  className="text-white/70 hover:text-brand font-mono text-[11px] uppercase tracking-wider transition-colors flex items-center justify-between w-full"
                >
                  <span>Explore full catalogue</span>
                  <Icon icon="solar:alt-arrow-right-linear" className="text-sm" />
                </Link>
              </div>
            </div>
          )}

        </div>
      </div>
    </section>
  );
}
