import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Link, useNavigate } from 'react-router-dom';
import WatchOptions from './WatchOptions';
import { Icon } from '@iconify/react';
import ImageWithFallback from '../ui/ImageWithFallback';
import { formatFilmTitle } from '../../utils/format';

export default function HeroSection({ featuredFilms: featuredFilmsProp, featuredFilm: singleFilmProp, isLoading }) {
  // Handle both array and single object props for backward compatibility and slice to 6 items
  const featuredFilms = (featuredFilmsProp || (singleFilmProp ? [singleFilmProp] : [])).slice(0, 6);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const navigate = useNavigate();


  useEffect(() => {
    if (featuredFilms.length <= 1 || isPaused) return;

    const interval = setInterval(() => {
      setCurrentIndex((prevIndex) => (prevIndex + 1) % featuredFilms.length);
    }, 15000); // Rotate every 15 seconds

    return () => clearInterval(interval);
  }, [featuredFilms.length, isPaused]);

  if (isLoading) {
    return (
      <section className="w-full bg-bg py-4 md:py-8 lg:py-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col lg:flex-row gap-4 h-auto lg:h-[600px]">
            <div className="relative w-full lg:flex-1 h-[50vh] min-h-[400px] lg:h-full rounded-2xl bg-surface animate-pulse border border-hairline"></div>
            <div className="hidden lg:flex flex-col w-[350px] xl:w-[400px] shrink-0 h-full gap-4">
              <div className="w-24 h-6 bg-surface animate-pulse rounded mb-2"></div>
              {[1, 2, 3].map(i => (
                <div key={i} className="flex gap-4 h-1/3 max-h-[180px]">
                  <div className="w-28 shrink-0 h-full bg-surface animate-pulse rounded-lg border border-white/5"></div>
                  <div className="flex flex-col gap-2 flex-1 pt-2">
                    <div className="w-16 h-3 bg-surface animate-pulse rounded"></div>
                    <div className="w-full h-4 bg-surface animate-pulse rounded"></div>
                    <div className="w-3/4 h-4 bg-surface animate-pulse rounded"></div>
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

  // Helper to get next 3 films for the "Up next" list
  const getUpNextFilms = () => {
    if (featuredFilms.length <= 1) return [];
    const upNext = [];
    for (let i = 1; i <= 3; i++) {
      if (featuredFilms.length > i) {
        upNext.push(featuredFilms[(currentIndex + i) % featuredFilms.length]);
      }
    }
    return upNext;
  };
  
  const upNextFilms = getUpNextFilms();

  return (
    <section 
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      className="w-full bg-bg py-4 md:py-8 lg:py-10"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col lg:flex-row gap-4 h-auto lg:h-[600px]">
          
          {/* Main Banner (Left) */}
          <div className="relative w-full lg:flex-1 h-[55vh] min-h-[450px] lg:h-full rounded-2xl overflow-hidden group/hero bg-[#111] shadow-2xl flex border border-white/10">
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={featuredFilm.id || currentIndex}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.4 }}
                className="absolute inset-0 z-0"
              >
                {/* Background Backdrop */}
                <div className="absolute inset-0">
                  <ImageWithFallback
                    src={featuredFilm.backdrop_url || featuredFilm.backdrop || featuredFilm.poster_url || featuredFilm.poster}
                    alt={formatFilmTitle(featuredFilm.title)}
                    className="w-full h-full object-cover animate-kenburns"
                    fallbackType="banner"
                    name={formatFilmTitle(featuredFilm.title)}
                    width={1280}
                    loading="eager"
                    fetchPriority="high"
                  />
                  {/* Gradients */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent" />
                  <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/20 to-transparent" />
                  <div className="absolute bottom-0 inset-x-0 h-2/3 bg-gradient-to-t from-[#000000] to-transparent opacity-95" />
                </div>

                {/* Bottom Overlay Content */}
                <div className="absolute bottom-0 left-0 right-0 p-5 md:p-8 flex items-end gap-6 z-20">
                  
                  {/* Small Embedded Poster */}
                  <Link 
                    to={`/films/${featuredFilm.slug || featuredFilm.id}`} 
                    className="hidden md:block shrink-0 relative group/poster shadow-2xl rounded-lg overflow-hidden border border-white/20 hover:border-white/50 transition-colors w-[150px] aspect-[2/3] transform hover:scale-105 duration-300"
                  >
                    <ImageWithFallback
                      src={featuredFilm.poster_url || featuredFilm.poster}
                      alt={formatFilmTitle(featuredFilm.title)}
                      className="w-full h-full object-cover"
                      fallbackType="banner"
                      name={formatFilmTitle(featuredFilm.title)}
                    />
                    {/* Hover Play button on poster */}
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/poster:opacity-100 transition-opacity flex items-center justify-center">
                      <div className="w-12 h-12 rounded-full border-2 border-white text-white flex items-center justify-center backdrop-blur-sm">
                        <Icon icon="solar:play-bold" className="text-xl ml-1" />
                      </div>
                    </div>
                  </Link>
                  
                  {/* Title and Play Section */}
                  <div className="flex flex-col flex-1 pb-1">
                    {/* Tags / Meta */}
                    <div className="flex items-center gap-3 mb-2.5 flex-wrap">
                      {(featuredFilm.is_trending || featuredFilm.view_count > 100) && (
                        <span className="flex items-center gap-1.5 bg-brand text-white px-2 py-0.5 rounded text-[10px] font-bold tracking-widest uppercase">
                          <Icon icon="solar:fire-bold" />
                          Trending
                        </span>
                      )}
                      {featuredFilm.is_in_cinemas && (
                        <span className="flex items-center gap-1.5 bg-white/10 text-white border border-white/20 px-2 py-0.5 rounded text-[10px] font-bold tracking-widest uppercase">
                          <Icon icon="solar:ticket-bold" className="text-brand" />
                          In Cinemas
                        </span>
                      )}
                      {(featuredFilm.genres || []).slice(0, 2).map((genre) => (
                        <span key={genre} className="text-white/70 text-xs font-semibold">
                          {genre}
                        </span>
                      ))}
                    </div>

                    <h2 className="text-white text-3xl md:text-4xl lg:text-[42px] font-heading font-black tracking-tight mb-3 line-clamp-2 shadow-sm leading-[1.1]">
                      {formatFilmTitle(featuredFilm.title)}
                    </h2>
                    
                    <p className="text-white/70 text-sm line-clamp-2 mb-6 max-w-2xl font-medium">
                      {featuredFilm.synopsis}
                    </p>
                    
                    <div className="flex items-center gap-4">
                      {/* Large Play/Watch Options */}
                      <WatchOptions film={featuredFilm} />
                      
                      <Link to={`/films/${featuredFilm.slug || featuredFilm.id}`} className="flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white px-6 py-3.5 rounded-full font-bold text-sm tracking-wide transition-all duration-300 active:scale-95 border border-white/10">
                        <Icon icon="solar:info-circle-bold" className="text-xl" />
                        Details
                      </Link>
                    </div>
                  </div>
                </div>
              </motion.div>
            </AnimatePresence>

            {/* Main Banner Nav Arrows */}
            {featuredFilms.length > 1 && (
              <>
                <button 
                  onClick={(e) => { e.preventDefault(); setCurrentIndex(prev => (prev - 1 + featuredFilms.length) % featuredFilms.length); }}
                  className="absolute left-4 top-1/2 -translate-y-1/2 z-30 w-12 h-12 rounded-full bg-black/50 hover:bg-black/80 hover:scale-110 text-white border border-white/20 flex items-center justify-center transition-all duration-300 opacity-0 group-hover/hero:opacity-100 hidden md:flex backdrop-blur-sm"
                  aria-label="Previous"
                >
                  <Icon icon="solar:alt-arrow-left-linear" width="24" />
                </button>
                <button 
                  onClick={(e) => { e.preventDefault(); setCurrentIndex(prev => (prev + 1) % featuredFilms.length); }}
                  className="absolute right-4 top-1/2 -translate-y-1/2 z-30 w-12 h-12 rounded-full bg-black/50 hover:bg-black/80 hover:scale-110 text-white border border-white/20 flex items-center justify-center transition-all duration-300 opacity-0 group-hover/hero:opacity-100 hidden md:flex backdrop-blur-sm"
                  aria-label="Next"
                >
                  <Icon icon="solar:alt-arrow-right-linear" width="24" />
                </button>
              </>
            )}

            {/* Progress bar indicator for desktop banner */}
            {featuredFilms.length > 1 && (
              <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/10 z-30 hidden md:block">
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

            {/* Mobile Slider Indicators (dots) */}
            {featuredFilms.length > 1 && (
              <div className="absolute bottom-4 right-4 flex items-center gap-1.5 z-20 md:hidden">
                {featuredFilms.map((_, index) => (
                  <button
                    key={index}
                    onClick={() => setCurrentIndex(index)}
                    className={`h-1.5 rounded-full transition-all duration-500 ${
                      index === currentIndex ? 'w-6 bg-brand' : 'w-1.5 bg-white/40'
                    }`}
                    aria-label={`Go to slide ${index + 1}`}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Up Next List (Right) */}
          {upNextFilms.length > 0 && (
            <div className="hidden lg:flex flex-col w-[350px] xl:w-[420px] shrink-0 h-full">
              <div className="flex items-center justify-between mb-4 px-2">
                <h3 className="text-brand font-black text-xl flex items-center gap-2">
                  Up next
                </h3>
              </div>
              
              <div className="flex flex-col gap-3 flex-1 overflow-hidden">
                {upNextFilms.map((film) => {
                  const actualIndex = featuredFilms.findIndex(f => f.id === film.id);
                  return (
                    <button 
                      key={film.id}
                      onClick={() => setCurrentIndex(actualIndex)}
                      className="group flex gap-4 items-start text-left hover:bg-surface-2 p-2 rounded-xl transition-colors h-1/3 max-h-[190px]"
                    >
                      {/* Small Thumbnail */}
                      <div className="relative h-full shrink-0 aspect-[2/3] rounded-lg overflow-hidden border border-hairline group-hover:border-border transition-colors shadow-lg">
                        <ImageWithFallback
                          src={film.poster_url || film.poster}
                          alt={formatFilmTitle(film.title)}
                          className="w-full h-full object-cover"
                          fallbackType="banner"
                          name={formatFilmTitle(film.title)}
                        />
                        <div className="absolute inset-0 bg-black/10 group-hover:bg-black/50 transition-colors flex items-center justify-center">
                          <Icon icon="solar:play-bold" className="text-white text-3xl opacity-0 group-hover:opacity-100 transition-transform transform group-hover:scale-110 duration-300" />
                        </div>
                      </div>
                      
                      {/* Info */}
                      <div className="flex flex-col pt-1.5 justify-start h-full">
                        <div className="flex items-center gap-2 text-text-muted text-xs font-bold uppercase tracking-widest mb-1.5">
                          <Icon icon="solar:play-circle-bold" className="text-base text-brand" />
                          <span>{(film.runtime_minutes || film.runtime) ? `${film.runtime_minutes || film.runtime} min` : 'Watch Now'}</span>
                        </div>
                        <h4 className="text-text-primary font-bold text-lg line-clamp-2 leading-snug group-hover:text-brand transition-colors mb-1">
                          {formatFilmTitle(film.title)}
                        </h4>
                        <p className="text-text-muted text-xs line-clamp-2 font-medium">
                          {film.synopsis || "Tap to play this title"}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
              
              {/* Browse All Link */}
              <div className="mt-auto pt-3 px-2">
                <Link to="/browse" className="text-text-primary font-bold text-base hover:text-brand transition-colors flex items-center gap-1.5 w-fit">
                  Browse all titles <Icon icon="solar:alt-arrow-right-linear" className="text-xl" />
                </Link>
              </div>
            </div>
          )}

        </div>
      </div>
    </section>
  );
}
