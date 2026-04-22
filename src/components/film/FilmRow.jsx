import { useRef, useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import FilmCard from './FilmCard';
import SkeletonCard from '../ui/SkeletonCard';

export default function FilmRow({ title, subtitle, films, sortKey, isLoading = false, noHeader = false }) {
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
    <section className={noHeader ? '' : 'py-8 relative group'}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        {!noHeader && (
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
            <div className="space-y-1">
              <h2 className="font-heading font-bold text-2xl md:text-3xl text-text-primary tracking-tighter">
                {title}
              </h2>
              {subtitle && (
                <p className="text-text-muted text-sm font-medium opacity-80 italic">{subtitle}</p>
              )}
            </div>
            <Link 
              to={`/browse${sortKey ? `?sort=${sortKey}` : ''}`} 
              className="text-brand font-black text-[10px] uppercase tracking-widest px-5 py-2 border border-border rounded-xl hover:border-brand hover:text-brand transition-all duration-300 active:scale-95 flex items-center gap-2 w-fit bg-surface/50 backdrop-blur-sm"
            >
              BROWSING ARCHIVE 
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </Link>
          </div>
        )}

        {/* Scrollable Row Container */}
        <div className="relative -mx-4 sm:mx-0">
          {/* Edge Gradients for Desktop */}
          <div className={`absolute top-0 left-0 bottom-0 w-20 z-10 bg-gradient-to-r from-bg to-transparent pointer-events-none transition-opacity duration-300 hidden md:block ${canScrollLeft ? 'opacity-100' : 'opacity-0'}`} />
          <div className={`absolute top-0 right-0 bottom-0 w-20 z-10 bg-gradient-to-l from-bg to-transparent pointer-events-none transition-opacity duration-300 hidden md:block ${canScrollRight ? 'opacity-100' : 'opacity-0'}`} />

          {/* Navigation Arrows */}
          <button 
            onClick={() => scroll('left')}
            className={`absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1/2 z-20 w-12 h-12 bg-surface border border-border rounded-full flex items-center justify-center text-text-primary shadow-xl opacity-0 group-hover:opacity-100 transition-all duration-300 hover:scale-110 active:scale-95 hover:border-brand hidden md:flex ${!canScrollLeft && 'pointer-events-none !opacity-0'}`}
            aria-label="Previous"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
          </button>
          
          <button 
            onClick={() => scroll('right')}
            className={`absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 z-20 w-12 h-12 bg-surface border border-border rounded-full flex items-center justify-center text-text-primary shadow-xl opacity-0 group-hover:opacity-100 transition-all duration-300 hover:scale-110 active:scale-95 hover:border-brand hidden md:flex ${!canScrollRight && 'pointer-events-none !opacity-0'}`}
            aria-label="Next"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
          </button>

          <div 
            ref={scrollRef}
            onScroll={checkScroll}
            className="flex overflow-x-auto gap-4 md:gap-8 pb-10 pt-2 px-4 sm:px-0 snap-x snap-mandatory scrollbar-hide touch-pan-x"
          >
            {isLoading ? (
              [...Array(6)].map((_, i) => (
                <div key={i} className="snap-start shrink-0">
                  <SkeletonCard size="md" />
                </div>
              ))
            ) : films.length === 0 ? (
              <div className="w-full py-16 text-center text-text-muted italic text-sm bg-surface/30 rounded-3xl border-2 border-dashed border-border/50">
                No active productions available in this section.
              </div>
            ) : (
              sortedFilms.map((film) => (
                <div key={film.id} className="snap-start shrink-0 group/card">
                  <FilmCard film={film} size="md" />
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
