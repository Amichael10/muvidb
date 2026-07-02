import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Link, useNavigate } from 'react-router-dom';
import WatchOptions from './WatchOptions';
import { Icon } from '@iconify/react';
import ImageWithFallback from '../ui/ImageWithFallback';

export default function HeroSection({ featuredFilms: featuredFilmsProp, featuredFilm: singleFilmProp, isLoading }) {
  // Handle both array and single object props for backward compatibility and slice to 6 items
  const featuredFilms = (featuredFilmsProp || (singleFilmProp ? [singleFilmProp] : [])).slice(0, 6);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const navigate = useNavigate();

  const [isPaused, setIsPaused] = useState(false);

  const handleSearch = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  useEffect(() => {
    if (featuredFilms.length <= 1 || isPaused) return;

    const interval = setInterval(() => {
      setCurrentIndex((prevIndex) => (prevIndex + 1) % featuredFilms.length);
    }, 15000); // Rotate every 15 seconds

    return () => clearInterval(interval);
  }, [featuredFilms.length, isPaused]);

  if (isLoading) {
    return (
      <section className="relative h-screen min-h-[600px] w-full flex items-center justify-center overflow-hidden bg-bg">
        <div className="absolute inset-0 z-0 bg-surface animate-shimmer"></div>
        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full h-full flex flex-col justify-end pb-32 pt-32">
          <div className="flex justify-between items-end w-full">
            <div className="max-w-2xl space-y-6">
              <div className="flex gap-2">
                <div className="w-16 h-6 bg-white/10 rounded-lg animate-pulse"></div>
                <div className="w-16 h-6 bg-white/10 rounded-lg animate-pulse"></div>
              </div>
              <div className="w-full h-16 md:h-24 bg-white/10 rounded-xl animate-pulse"></div>
              <div className="flex gap-4">
                <div className="w-20 h-4 bg-white/10 rounded animate-pulse"></div>
                <div className="w-20 h-4 bg-white/10 rounded animate-pulse"></div>
                <div className="w-20 h-4 bg-white/10 rounded animate-pulse"></div>
              </div>
              <div className="w-full h-20 bg-white/10 rounded-xl animate-pulse"></div>
              <div className="flex gap-4">
                <div className="w-32 h-12 bg-white/10 rounded-xl animate-pulse"></div>
                <div className="w-32 h-12 bg-white/10 rounded-xl animate-pulse"></div>
              </div>
            </div>
            <div className="hidden lg:block w-64 h-96 bg-white/10 rounded-2xl animate-pulse"></div>
          </div>
        </div>
      </section>
    );
  }

  if (!featuredFilms || featuredFilms.length === 0) return null;

  const featuredFilm = featuredFilms[currentIndex];



  return (
    <section 
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      className="relative h-screen min-h-[600px] w-full flex items-center justify-center overflow-hidden bg-bg group/hero"
    >
      {/* initial={false} skips the enter fade on first render so the LCP backdrop
          paints instantly; slide-to-slide crossfades still animate. */}
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={featuredFilm.id || currentIndex}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.4 }}
          className="absolute inset-0 z-0"
        >
          {/* Background Image & Overlays */}
          <div className="absolute inset-0 z-0">
            {/* Slow Ken Burns zoom — restarts each slide (keyed motion.div remounts) */}
            <div className="absolute inset-0 animate-kenburns">
              <ImageWithFallback
                src={featuredFilm.backdrop_url || featuredFilm.backdrop || featuredFilm.poster_url || featuredFilm.poster}
                alt={featuredFilm.title}
                className="w-full h-full object-cover"
                fallbackType="banner"
                name={featuredFilm.title}
                width={1280}
                loading="eager"
                fetchPriority="high"
              />
            </div>

            {/* Cinematic scrim — calm + directional, no animation. Bottom-up for the
                title, a soft left wash for readability, fade into the page below. */}
            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/45 to-black/10 z-10" />
            <div className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/25 to-transparent z-10" />
            <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-bg to-transparent z-10" />
          </div>

          {/* Content Container */}
          <div className="relative z-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full h-full flex flex-col justify-end pb-20 pt-24 md:pb-32 md:pt-32">
            <div className="flex justify-between items-end w-full">
              
              {/* Left Content */}
              <motion.div 
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.3, ease: "easeOut" }}
                className="max-w-2xl"
              >
                {/* Tagline — a quiet eyebrow, not a billboard */}
                <motion.p
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.8, delay: 0.2 }}
                  className="text-white/50 text-[11px] font-semibold tracking-[0.38em] uppercase mb-5"
                >
                  The home of Nollywood
                </motion.p>

                {/* Genre Pills */}
                <div className="flex flex-wrap gap-2 mb-6">
                  {(featuredFilm.genres || []).slice(0, 3).map((genre) => (
                    <span key={genre} className="px-3 py-1 text-[10px] font-semibold tracking-wide bg-white/5 backdrop-blur-md text-white/70 rounded-full border border-white/10">
                      {genre}
                    </span>
                  ))}
                </div>

                {/* Title */}
                <h1 className="font-heading font-bold text-3xl sm:text-4xl md:text-6xl lg:text-8xl text-white mb-6 leading-[0.92] tracking-tight [text-shadow:0_2px_40px_rgba(0,0,0,0.55)]">
                  {featuredFilm.title}
                </h1>

                {/* Meta Info */}
                <div className="flex flex-wrap items-center gap-6 mb-8 text-[11px] font-bold text-white/80">
                  {/* Rating - Only shown if > 0 (Issue 4) */}
                  {Number(featuredFilm.tmdb_rating || featuredFilm.rating || 0) > 0 && (
                    <div className="flex items-center gap-2 text-brand">
                      <Icon icon="solar:star-bold" className="text-base" />
                      <span>{Number(featuredFilm.tmdb_rating || featuredFilm.rating || 0).toFixed(1)}</span>
                    </div>
                  )}
                  
                  {/* Status / Popularity Icon */}
                  {featuredFilm.is_in_cinemas ? (
                    <div className="flex items-center gap-2 bg-brand/20 text-brand px-2.5 py-0.5 rounded border border-brand/30">
                      <Icon icon="solar:ticket-bold" className="text-base" />
                      <span className="uppercase tracking-widest text-[9px]">In Cinemas Now</span>
                    </div>
                  ) : (featuredFilm.is_trending || featuredFilm.view_count > 100) ? (
                    <div className="flex items-center gap-2">
                      <Icon icon="solar:fire-bold" className="text-base text-orange-500" />
                      <span>Trending</span>
                    </div>
                  ) : null}
                  
                  {/* Year */}
                  {featuredFilm.year && (
                    <div className="flex items-center gap-2">
                      <Icon icon="solar:calendar-linear" className="text-base" />
                      <span>{featuredFilm.year}</span>
                    </div>
                  )}
                  
                  {/* Runtime - Only show if value exists (Issue 23) */}
                  {(featuredFilm.runtime_minutes || featuredFilm.runtime) && (
                    <div className="flex items-center gap-2">
                      <Icon icon="solar:clock-circle-linear" className="text-base" />
                      <span>{featuredFilm.runtime_minutes || featuredFilm.runtime} min</span>
                    </div>
                  )}
                </div>


                {/* Synopsis — two lines, no decorative rule */}
                <p className="text-white/65 text-base md:text-lg mb-10 line-clamp-2 max-w-xl leading-relaxed">
                  {featuredFilm.synopsis}
                </p>

                {/* Buttons */}
                <div className="flex flex-wrap items-center gap-4">
                  <WatchOptions film={featuredFilm} />
                  <Link to={`/films/${featuredFilm.slug || featuredFilm.id}`} className="flex items-center justify-center gap-2 bg-white/10 backdrop-blur-md border border-white/20 text-white px-8 py-4 rounded-xl font-bold text-[10px] tracking-widest hover:bg-white hover:text-black transition-all duration-500 active:scale-95 shadow-xl">
                    <Icon icon="solar:info-circle-linear" width="16" />
                    More Info
                  </Link>
                </div>
              </motion.div>

              {/* Right Content (Poster) */}
              <motion.div 
                initial={{ opacity: 0, scale: 0.9, x: 20 }}
                animate={{ opacity: 1, scale: 1, x: 0 }}
                transition={{ duration: 0.8, delay: 0.5, ease: "easeOut" }}
                className="hidden lg:block relative group cursor-pointer"
              >
                <Link to={`/films/${featuredFilm.slug || featuredFilm.id}`} className="block relative">
                  <div className="absolute inset-0 bg-brand rounded-2xl blur-2xl opacity-0 group-hover:opacity-20 transition-opacity duration-700"></div>
                  <ImageWithFallback
                    src={featuredFilm.poster_url || featuredFilm.poster}
                    alt={`${featuredFilm.title} Poster`}
                    className="relative w-64 aspect-[2/3] rounded-2xl border border-white/10 shadow-2xl object-cover transform transition-all duration-700 group-hover:scale-105 group-hover:rotate-2"
                    fallbackType="banner"
                    name={featuredFilm.title}
                    width={384}
                  />
                </Link>
              </motion.div>

            </div>
          </div>
        </motion.div>
      </AnimatePresence>

      {/* Slider Indicators */}
      {featuredFilms.length > 1 && (
        <div className="absolute bottom-10 left-1/2 -translate-x-1/2 flex items-center gap-3 z-20">
          {featuredFilms.map((_, index) => (
            <button
              key={index}
              onClick={() => setCurrentIndex(index)}
              className={`h-1 rounded-full transition-all duration-500 ${
                index === currentIndex ? 'w-12 bg-brand' : 'w-4 bg-white/20 hover:bg-white/40'
              }`}
              aria-label={`Go to slide ${index + 1}`}
            />
          ))}
        </div>
      )}

      {/* Slider Controls (Chevron Arrows - visible on desktop hover) (Issue 5) */}
      {featuredFilms.length > 1 && (
        <>
          <button 
            onClick={() => setCurrentIndex(prev => (prev - 1 + featuredFilms.length) % featuredFilms.length)}
            className="absolute left-6 top-1/2 -translate-y-1/2 z-30 w-12 h-12 rounded-full bg-black/40 hover:bg-brand hover:scale-110 active:scale-95 text-white backdrop-blur-md border border-white/10 flex items-center justify-center transition-all duration-300 opacity-0 group-hover/hero:opacity-100 hidden md:flex cursor-pointer shadow-2xl"
            aria-label="Previous featured movie"
          >
            <Icon icon="solar:alt-arrow-left-linear" width="24" height="24" />
          </button>
          
          <button 
            onClick={() => setCurrentIndex(prev => (prev + 1) % featuredFilms.length)}
            className="absolute right-6 top-1/2 -translate-y-1/2 z-30 w-12 h-12 rounded-full bg-black/40 hover:bg-brand hover:scale-110 active:scale-95 text-white backdrop-blur-md border border-white/10 flex items-center justify-center transition-all duration-300 opacity-0 group-hover/hero:opacity-100 hidden md:flex cursor-pointer shadow-2xl"
            aria-label="Next featured movie"
          >
            <Icon icon="solar:alt-arrow-right-linear" width="24" height="24" />
          </button>
        </>
      )}

      {/* Progress bar indicator */}
      {featuredFilms.length > 1 && (
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/10 z-30">
          <motion.div
            key={currentIndex + (isPaused ? '-paused' : '-active')}
            initial={{ width: '0%' }}
            animate={isPaused ? { width: '0%' } : { width: '100%' }}
            transition={{ 
              duration: isPaused ? 0 : 15, 
              ease: 'linear' 
            }}
            className="h-full bg-brand"
          />
        </div>
      )}
    </section>
  );
}
