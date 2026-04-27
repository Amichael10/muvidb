import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Link } from 'react-router-dom';
import WatchOptions from './WatchOptions';
import { Icon } from '@iconify/react';

export default function HeroSection({ featuredFilms: featuredFilmsProp, featuredFilm: singleFilmProp, isLoading }) {
  // Handle both array and single object props for backward compatibility
  const featuredFilms = featuredFilmsProp || (singleFilmProp ? [singleFilmProp] : []);
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    if (featuredFilms.length <= 1) return;

    const interval = setInterval(() => {
      setCurrentIndex((prevIndex) => (prevIndex + 1) % featuredFilms.length);
    }, 15000); // Rotate every 15 seconds

    return () => clearInterval(interval);
  }, [featuredFilms.length]);

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

  // Format views (e.g., 4200000 -> 4.2M)
  const formatViews = (views) => {
    if (!views) return '0';
    if (views >= 1000000) {
      return (views / 1000000).toFixed(1) + 'M';
    }
    if (views >= 1000) {
      return (views / 1000).toFixed(1) + 'K';
    }
    return views;
  };

  return (
    <section className="relative h-screen min-h-[600px] w-full flex items-center justify-center overflow-hidden bg-bg">
      <AnimatePresence mode="wait">
        <motion.div
          key={featuredFilm.id || currentIndex}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 1 }}
          className="absolute inset-0 z-0"
        >
          {/* Background Image & Overlays */}
          <div className="absolute inset-0 z-0">
            <img 
              src={featuredFilm.backdrop_url || featuredFilm.backdrop} 
              alt={featuredFilm.title} 
              className="w-full h-full object-cover"
            />
            
            {/* Gradient Overlay: Consistently dark on the left for text readability across themes */}
            <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/40 to-transparent"></div>
            
            {/* Subtle animated gradient shimmer */}
            <div className="absolute inset-0 bg-gradient-to-tr from-brand/5 via-transparent to-brand/5 animate-pulse mix-blend-overlay"></div>
            
            {/* Bottom fade into page background */}
            <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-bg to-transparent"></div>
          </div>

          {/* Content Container */}
          <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full h-full flex flex-col justify-end pb-32 pt-32 border-x border-white/5">
            <div className="flex justify-between items-end w-full">
              
              {/* Left Content */}
              <motion.div 
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.3, ease: "easeOut" }}
                className="max-w-2xl"
              >
                {/* Genre Pills */}
                <div className="flex flex-wrap gap-2 mb-6">
                  {(featuredFilm.genres || []).map((genre) => (
                    <span key={genre} className="px-3 py-1 text-[10px] font-bold bg-black/40 backdrop-blur-md text-white rounded-lg border border-white/10">
                      {genre}
                    </span>
                  ))}
                </div>

                {/* Title */}
                <h1 className="font-heading font-bold text-5xl md:text-7xl text-white mb-6 leading-[1.1] tracking-tighter drop-shadow-2xl">
                  {featuredFilm.title}
                </h1>

                {/* Meta Info */}
                <div className="flex flex-wrap items-center gap-6 mb-8 text-[11px] font-bold text-white/80">
                  {/* Rating */}
                  <div className="flex items-center gap-2 text-brand">
                    <Icon icon="solar:star-bold" className="text-base" />
                    <span>{Number(featuredFilm.tmdb_rating || featuredFilm.rating || 0).toFixed(1)}</span>
                  </div>
                  
                  {/* Popularity Icon */}
                  <div className="flex items-center gap-2">
                    <Icon icon="solar:fire-bold" className="text-base text-orange-500" />
                    <span>Trending</span>
                  </div>
                  
                  {/* Year */}
                  <div className="flex items-center gap-2">
                    <Icon icon="solar:calendar-linear" className="text-base" />
                    <span>{featuredFilm.year}</span>
                  </div>
                  
                  {/* Runtime */}
                  <div className="flex items-center gap-2">
                    <Icon icon="solar:clock-circle-linear" className="text-base" />
                    <span>{featuredFilm.runtime_minutes || featuredFilm.runtime} min</span>
                  </div>
                </div>

                {/* Synopsis */}
                <p className="text-white/90 text-base md:text-lg mb-10 line-clamp-3 max-w-xl border-l-2 border-brand pl-6 leading-relaxed drop-shadow-lg opacity-90">
                  {featuredFilm.synopsis}
                </p>

                {/* Buttons */}
                <div className="flex flex-wrap items-center gap-4">
                  <WatchOptions film={featuredFilm} />
                  <Link to={`/films/${featuredFilm.id}`} className="flex items-center justify-center gap-2 bg-white/10 backdrop-blur-md border border-white/20 text-white px-8 py-4 rounded-xl font-bold text-[10px] tracking-widest hover:bg-white hover:text-black transition-all duration-500 active:scale-95 shadow-xl">
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
                <Link to={`/films/${featuredFilm.id}`} className="block relative">
                  <div className="absolute inset-0 bg-brand rounded-2xl blur-2xl opacity-0 group-hover:opacity-20 transition-opacity duration-700"></div>
                  <img 
                    src={featuredFilm.poster_url || featuredFilm.poster} 
                    alt={`${featuredFilm.title} Poster`} 
                    className="relative w-64 h-auto rounded-2xl border border-white/10 shadow-2xl object-cover transform transition-all duration-700 group-hover:scale-105 group-hover:rotate-2"
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
    </section>
  );
}
