import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Link } from 'react-router-dom';

export default function HeroSection({ featuredFilms: featuredFilmsProp, featuredFilm: singleFilmProp }) {
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

  if (!featuredFilms || featuredFilms.length === 0) return null;

  const featuredFilm = featuredFilms[currentIndex];

  // Format views (e.g., 4200000 -> 4.2M)
  const formatViews = (views) => {
    if (!views) return '0';
    if (views >= 1000000) {
      return (views / 1000000).toFixed(1) + 'M';
    }
    return views;
  };

  return (
    <section className="relative h-screen min-h-[600px] w-full flex items-center justify-center overflow-hidden">
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
            
            {/* Gradient Overlay: Transparent right to dark left */}
            <div className="absolute inset-0 bg-gradient-to-r from-[#0A0F1E]/95 via-[#0A0F1E]/70 to-transparent"></div>
            
            {/* Subtle animated gradient shimmer */}
            <div className="absolute inset-0 bg-gradient-to-tr from-gold/5 via-transparent to-terracotta/5 animate-gradient-x mix-blend-overlay"></div>
            
            {/* Bottom fade into page background */}
            <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-bg to-transparent"></div>
          </div>

          {/* Content Container */}
          <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full h-full flex flex-col justify-end pb-24 pt-32">
            <div className="flex justify-between items-end w-full">
              
              {/* Left Content */}
              <motion.div 
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.3, ease: "easeOut" }}
                className="max-w-2xl"
              >
                {/* Genre Pills */}
                <div className="flex flex-wrap gap-2 mb-4">
                  {(featuredFilm.genres || []).map((genre) => (
                    <span key={genre} className="px-3 py-1 text-xs font-medium bg-surface-2/80 backdrop-blur-sm text-text-primary rounded-full border border-border">
                      {genre}
                    </span>
                  ))}
                </div>

                {/* Title */}
                <h1 className="font-heading font-bold text-4xl md:text-6xl text-text-primary mb-4 leading-tight">
                  {featuredFilm.title}
                </h1>

                {/* Meta Info */}
                <div className="flex flex-wrap items-center gap-4 md:gap-6 mb-6 text-sm font-medium">
                  {/* Rating */}
                  <div className="flex items-center gap-1 text-gold">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                    </svg>
                    <span>{featuredFilm.tmdb_rating || featuredFilm.rating}</span>
                  </div>
                  
                  {/* Views with YouTube icon */}
                  <div className="flex items-center gap-1.5 text-text-muted">
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M22.54 6.42a2.78 2.78 0 0 0-1.94-2C18.88 4 12 4 12 4s-6.88 0-8.6.46a2.78 2.78 0 0 0-1.94 2A29 29 0 0 0 1 11.75a29 29 0 0 0 .46 5.33 2.78 2.78 0 0 0 1.94 2c1.72.46 8.6.46 8.6.46s6.88 0 8.6-.46a2.78 2.78 0 0 0 1.94-2 29 29 0 0 0 .46-5.33 29 29 0 0 0-.46-5.33z"/>
                      <polygon points="9.75 15.02 15.5 11.75 9.75 8.48 9.75 15.02" fill="var(--color-bg)"/>
                    </svg>
                    <span>{formatViews(featuredFilm.view_count)} views</span>
                  </div>
                  
                  {/* Year */}
                  <div className="text-text-muted">
                    {featuredFilm.year}
                  </div>
                  
                  {/* Runtime */}
                  <div className="text-text-muted">
                    {featuredFilm.runtime} min
                  </div>
                </div>

                {/* Synopsis */}
                <p className="text-text-muted text-base md:text-lg mb-8 line-clamp-2 max-w-xl">
                  {featuredFilm.synopsis}
                </p>

                {/* Buttons */}
                <div className="flex flex-wrap items-center gap-4">
                  {featuredFilm.release_type && featuredFilm.release_type !== 'cinema' && featuredFilm.youtube_watch_url ? (
                    <a href={featuredFilm.youtube_watch_url} target="_blank" rel="noopener noreferrer" className={`flex items-center justify-center gap-2 px-8 py-3 rounded-full font-semibold transition-all duration-300 text-white hover:scale-105 ${
                      featuredFilm.release_type === 'youtube' ? 'bg-[#FF0000] hover:shadow-[0_0_15px_rgba(255,0,0,0.4)]' :
                      featuredFilm.release_type === 'netflix' ? 'bg-[#E50914] hover:shadow-[0_0_15px_rgba(229,9,20,0.4)]' :
                      featuredFilm.release_type === 'prime_video' ? 'bg-[#00A8E1] hover:shadow-[0_0_15px_rgba(0,168,225,0.4)]' :
                      featuredFilm.release_type === 'showmax' ? 'bg-[#E10098] hover:shadow-[0_0_15px_rgba(225,0,152,0.4)]' :
                      'bg-gold text-dark hover:shadow-[0_0_15px_rgba(212,160,23,0.4)]'
                     }`}>
                      {featuredFilm.release_type === 'youtube' ? (
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                          <polygon points="9.75 15.02 15.5 11.75 9.75 8.48 9.75 15.02" fill="currentColor" />
                        </svg>
                      ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polygon points="5 3 19 12 5 21 5 3"/>
                        </svg>
                      )}
                      Watch on {featuredFilm.release_type.replace('_', ' ')}
                    </a>
                  ) : (
                    <button className="flex items-center justify-center gap-2 bg-gold text-bg px-8 py-3 rounded-full font-semibold hover:scale-105 hover:shadow-[0_0_15px_rgba(212,160,23,0.4)] transition-all duration-300">
                      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polygon points="5 3 19 12 5 21 5 3"/>
                      </svg>
                      Watch Trailer
                    </button>
                  )}
                  <Link to={`/film/${featuredFilm.id}`} className="flex items-center justify-center gap-2 bg-transparent border-2 border-gold text-gold px-8 py-3 rounded-full font-semibold hover:bg-gold/10 hover:scale-105 transition-all duration-300">
                    View Details
                  </Link>
                </div>
              </motion.div>

              {/* Right Content (Poster) */}
              <motion.div 
                initial={{ opacity: 0, scale: 0.9, x: 20 }}
                animate={{ opacity: 1, scale: 1, x: 0 }}
                transition={{ duration: 0.8, delay: 0.5, ease: "easeOut" }}
                className="hidden lg:block relative group"
              >
                <div className="absolute inset-0 bg-gold rounded-2xl blur-xl opacity-20 group-hover:opacity-40 transition-opacity duration-500"></div>
                <img 
                  src={featuredFilm.poster_url || featuredFilm.poster} 
                  alt={`${featuredFilm.title} Poster`} 
                  className="relative w-64 h-auto rounded-2xl border border-gold/30 shadow-[0_0_20px_rgba(212,160,23,0.2)] opacity-90 object-cover"
                />
              </motion.div>

            </div>
          </div>
        </motion.div>
      </AnimatePresence>

      {/* Slider Indicators */}
      {featuredFilms.length > 1 && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-2 z-20">
          {featuredFilms.map((_, index) => (
            <button
              key={index}
              onClick={() => setCurrentIndex(index)}
              className={`h-2 rounded-full transition-all duration-300 ${
                index === currentIndex ? 'w-8 bg-gold' : 'w-2 bg-text-muted hover:bg-text-primary'
              }`}
              aria-label={`Go to slide ${index + 1}`}
            />
          ))}
        </div>
      )}
    </section>
  );
}
