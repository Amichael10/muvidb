import { Link } from 'react-router-dom';
import FilmCard from './FilmCard';
import SkeletonCard from '../ui/SkeletonCard';

export default function FilmRow({ title, films, sortKey, isLoading = false }) {
  // Sort films if sortKey is provided
  const sortedFilms = [...films].sort((a, b) => {
    if (sortKey === 'views') return (b.view_count || 0) - (a.view_count || 0);
    if (sortKey === 'year') return (b.year || 0) - (a.year || 0);
    if (sortKey === 'rating') return (b.rating || 0) - (a.rating || 0);
    return 0;
  });

  return (
    <section className="py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="flex items-end justify-between mb-6">
          <h2 className="font-heading font-bold text-2xl md:text-3xl text-text-primary">
            {title}
          </h2>
          <Link 
            to={`/browse${sortKey ? `?sort=${sortKey}` : ''}`} 
            className="text-gold hover:text-text-primary transition-all duration-300 active:scale-95 font-medium text-sm md:text-base flex items-center gap-1"
          >
            See All 
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="5" y1="12" x2="19" y2="12"/>
              <polyline points="12 5 19 12 12 19"/>
            </svg>
          </Link>
        </div>

        {/* Scrollable Row */}
        <div className="relative -mx-4 sm:mx-0">
          <div className="flex overflow-x-auto gap-4 md:gap-6 pb-6 pt-2 px-4 sm:px-0 snap-x snap-mandatory scrollbar-hide touch-pan-x">
            {isLoading ? (
              [...Array(6)].map((_, i) => (
                <div key={i} className="snap-start shrink-0">
                  <SkeletonCard size="md" />
                </div>
              ))
            ) : (
              sortedFilms.map((film) => (
                <div key={film.id} className="snap-start shrink-0">
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
