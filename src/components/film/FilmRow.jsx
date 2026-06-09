import { useRef, useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import FilmCard from './FilmCard';
import SkeletonCard from '../ui/SkeletonCard';
import { Icon } from '@iconify/react';

export default function FilmRow({ title, subtitle, films, sortKey, isLoading = false, noHeader = false, linkTo, cardVariant }) {
  const scrollRef = useRef(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  // Sort films if sortKey is provided
  const sortedFilms = [...films].sort((a, b) => {
    if (sortKey === 'views') return (b.view_count || 0) - (a.view_count || 0);
    if (sortKey === 'year') return (b.year || 0) - (a.year || 0);
    if (sortKey === 'rating') return (b.rating || 0) - (a.rating || 0);
    return 0;
  });

  const checkScroll = () => {
    if (scrollRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
      setCanScrollLeft(scrollLeft > 10);
      setCanScrollRight(scrollLeft + clientWidth < scrollWidth - 10);
    }
  };

  useEffect(() => {
    checkScroll();
    window.addEventListener('resize', checkScroll);
    return () => window.removeEventListener('resize', checkScroll);
  }, [films, isLoading]);

  const scroll = (direction) => {
    if (scrollRef.current) {
      const { clientWidth } = scrollRef.current;
      const scrollAmount = direction === 'left' ? -clientWidth * 0.8 : clientWidth * 0.8;
      scrollRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  };

  return (
    <section className={`relative group/row ${noHeader ? '' : 'py-8'}`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        {!noHeader && (
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
            <div className="space-y-1">
              <h2 className="text-2xl font-bold text-text-primary tracking-tight">
                {title}
              </h2>
              {subtitle && (
                <p className="text-text-muted text-[10px] font-bold uppercase tracking-widest mt-1 opacity-70">{subtitle}</p>
              )}
            </div>
            <Link 
              to={linkTo || `/browse${sortKey ? `?sort=${sortKey}` : ''}`} 
              className="text-text-primary font-bold text-xs px-5 py-2.5 border border-border rounded-lg hover:border-brand hover:text-brand transition-all duration-300 flex items-center gap-2 w-fit bg-surface/50 backdrop-blur-sm"
            >
              {linkTo ? 'See all' : 'Browse all'}
              <Icon icon="solar:alt-arrow-right-linear" className="w-3.5 h-3.5" />
            </Link>
          </div>
        )}

        {/* Scrollable Row Container */}
        <div className="relative -mx-4 sm:mx-0">
          {/* Edge Gradients for Desktop */}
          <div className={`absolute top-0 left-0 bottom-0 w-20 z-10 bg-gradient-to-r from-bg to-transparent pointer-events-none transition-opacity duration-300 hidden md:block ${canScrollLeft ? 'opacity-100' : 'opacity-0'}`} />
          <div className={`absolute top-0 right-0 bottom-0 w-20 z-10 bg-gradient-to-l from-bg to-transparent pointer-events-none transition-opacity duration-300 hidden md:block ${canScrollRight ? 'opacity-100' : 'opacity-0'}`} />

          {/* Navigation Arrows - Only visible if there's more than 1 item */}
          {films.length > 1 && (
            <>
              <button 
                onClick={() => scroll('left')}
                className={`absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1/2 z-20 w-10 h-10 bg-surface border border-border rounded-full flex items-center justify-center text-text-primary shadow-lg opacity-0 group-hover/row:opacity-100 transition-all duration-300 hover:scale-110 active:scale-95 hover:border-brand hidden md:flex ${!canScrollLeft && 'pointer-events-none !opacity-0'}`}
                aria-label="Previous"
              >
                <Icon icon="solar:alt-arrow-left-linear" width="20" height="20" />
              </button>
              
              <button 
                onClick={() => scroll('right')}
                className={`absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 z-20 w-10 h-10 bg-surface border border-border rounded-full flex items-center justify-center text-text-primary shadow-lg opacity-0 group-hover/row:opacity-100 transition-all duration-300 hover:scale-110 active:scale-95 hover:border-brand hidden md:flex ${!canScrollRight && 'pointer-events-none !opacity-0'}`}
                aria-label="Next"
              >
                <Icon icon="solar:alt-arrow-right-linear" width="20" height="20" />
              </button>
            </>
          )}

          <div 
            ref={scrollRef}
            onScroll={checkScroll}
            className="flex overflow-x-auto gap-4 md:gap-6 py-16 -my-16 px-4 sm:px-0 scrollbar-hide touch-pan-x"
          >
            {isLoading ? (
              [...Array(6)].map((_, i) => (
                <div key={i} className="shrink-0">
                  <SkeletonCard size="md" variant={cardVariant} />
                </div>
              ))
            ) : films.length === 0 ? (
              <div className="w-full py-16 text-center text-text-muted text-sm bg-surface-2/10 rounded-2xl border border-dashed border-border/50 mx-4">
                No titles available in this section.
              </div>
            ) : (
              sortedFilms.map((film, index) => (
                <div key={film.id} className="shrink-0">
                  <FilmCard 
                    film={cardVariant === 'top10' ? { ...film, rank: index + 1 } : film} 
                    size="md" 
                    variant={cardVariant} 
                  />
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
