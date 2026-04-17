import { Link } from 'react-router-dom';
import { useState } from 'react';

export default function FilmCard({ 
  film, 
  size = 'md', 
  actionType = 'add', 
  onAction,
  showWatchedToggle = false,
  isWatched = false,
  onToggleWatched
}) {
  const [isHovered, setIsHovered] = useState(false);

  // Define dimensions based on size prop
  const sizeClasses = {
    sm: 'w-36 h-56 min-w-[9rem]',
    md: 'w-48 h-72 min-w-[12rem]',
    lg: 'w-64 h-96 min-w-[16rem]'
  };

  return (
    <div className="relative flex flex-col gap-2">
      <Link 
        to={`/film/${film.id}`}
        className={`relative block rounded-2xl overflow-hidden group transition-all duration-300 transform hover:-translate-y-1 hover:shadow-[0_0_20px_rgba(212,160,23,0.3)] hover:z-10 ${sizeClasses[size]}`}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {/* Poster Image */}
        <img 
          src={film.poster_url || film.poster} 
          alt={film.title} 
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
          loading="lazy"
        />

        {/* Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#0A0F1E] via-[#0A0F1E]/40 to-transparent opacity-80 group-hover:opacity-90 transition-opacity duration-300"></div>

        {/* Action Button (Hover State) */}
        <div className={`absolute top-3 right-3 transition-opacity duration-300 ${isHovered ? 'opacity-100' : 'opacity-0'}`}>
          <button 
            className="bg-surface-2/80 backdrop-blur-md hover:bg-gold text-text-primary hover:text-bg p-2 rounded-full transition-all duration-300 active:scale-95 min-h-[44px] min-w-[44px] flex items-center justify-center"
            onClick={(e) => {
              e.preventDefault(); // Prevent navigating to film detail
              if (onAction) onAction(film);
            }}
            aria-label={actionType === 'add' ? "Add to watchlist" : "Remove from watchlist"}
          >
            {actionType === 'add' ? (
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19"/>
                <line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"/>
                <line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            )}
          </button>
        </div>

        {/* Bottom Content */}
        <div className="absolute bottom-0 left-0 right-0 p-4 flex flex-col justify-end">
          <h3 className="font-heading font-bold text-text-primary text-lg leading-tight mb-1 line-clamp-2 group-hover:text-gold transition-colors">
            {film.title}
          </h3>
          
          <div className="flex items-center justify-between mt-1">
            <div className="text-xs text-text-muted font-medium truncate pr-2">
              {film.year} {film.genres && film.genres.length > 0 ? `• ${film.genres[0]}` : ''}
            </div>
            
            <div className="flex items-center gap-1 bg-gold text-bg px-1.5 py-0.5 rounded text-xs font-bold shrink-0">
              <span>{film.tmdb_rating || film.rating}</span>
              <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
              </svg>
            </div>
          </div>
        </div>
      </Link>

      {/* Watched Toggle */}
      {showWatchedToggle && (
        <button 
          onClick={() => onToggleWatched && onToggleWatched(film)}
          className="flex items-center gap-2 mt-1 text-sm font-medium text-text-muted hover:text-text-primary transition-colors group w-fit"
        >
          <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${isWatched ? 'bg-gold border-gold' : 'border-border bg-surface group-hover:border-gold/50'}`}>
            {isWatched && (
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--color-bg)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
            )}
          </div>
          Watched
        </button>
      )}
    </div>
  );
}
