import { Link } from 'react-router-dom';
import { useState } from 'react';
import { Icon } from '@iconify/react';

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
    <div className="relative flex flex-col gap-3">
      <Link 
        to={`/films/${film.mubi_slug || film.id}`}
        className={`relative block rounded-xl overflow-hidden group transition-all duration-500 hover:shadow-2xl z-0 hover:z-10 ${sizeClasses[size]}`}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {/* Poster Image */}
        <img 
          src={film.poster_url || film.poster} 
          alt="" 
          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
          loading="lazy"
        />

        {/* Professional Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent opacity-60 group-hover:opacity-80 transition-opacity duration-500" />

        {/* Rating Badge (Top Left) */}
        <div className="absolute top-2 left-2 flex items-center gap-1 bg-black/60 backdrop-blur-md text-white px-1.5 py-0.5 rounded-md border border-white/10 shadow-lg z-20">
          <Icon icon="solar:star-bold" className="text-brand text-[10px]" />
          <span className="text-[10px] font-bold">
            {Number(film.tmdb_rating || film.average_rating || film.rating || 0).toFixed(1)}
          </span>
        </div>

        {/* Action Button (Hover State) */}
        <div className={`absolute top-2 right-2 transition-all duration-500 z-20 ${isHovered ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-1'}`}>
          <button 
            className="bg-brand hover:bg-white text-white hover:text-brand w-7 h-7 rounded-lg transition-all duration-300 active:scale-90 shadow-xl flex items-center justify-center border border-white/10"
            onClick={(e) => {
              e.preventDefault();
              if (onAction) onAction(film);
            }}
          >
            <Icon icon={actionType === 'add' ? "solar:add-circle-linear" : "solar:close-circle-linear"} width="14" />
          </button>
        </div>

        {/* Bottom Content Overlay - Improved Legibility */}
        <div className="absolute inset-x-0 bottom-0 p-3 z-20 bg-gradient-to-t from-black/90 via-black/40 to-transparent pt-10">
          <h3 className="text-white text-xs font-bold leading-tight mb-1 line-clamp-2 group-hover:text-brand transition-colors">
            {film.title}
          </h3>
          <div className="flex items-center gap-2 text-[10px] font-medium text-white/70">
            <span className="text-brand/90 font-bold">{film.year || film.release_date?.split('-')[0] || 'N/A'}</span>
            {film.genres && film.genres.length > 0 && (
              <>
                <span className="w-1 h-1 rounded-full bg-white/20" />
                <span className="truncate">{film.genres[0]}</span>
              </>
            )}
          </div>
        </div>
      </Link>

      {/* Watched Toggle */}
      {showWatchedToggle && (
        <button 
          onClick={() => onToggleWatched && onToggleWatched(film)}
          className="flex items-center gap-2 mt-1 text-[10px] font-bold text-text-muted hover:text-brand transition-colors group w-fit pl-1"
        >
          <div className={`w-3.5 h-3.5 rounded border flex items-center justify-center transition-all ${isWatched ? 'bg-brand border-brand' : 'border-border bg-surface-2/30'}`}>
            {isWatched && (
              <Icon icon="solar:check-read-linear" className="text-white text-[9px]" />
            )}
          </div>
          <span className={isWatched ? 'text-brand' : ''}>Watched</span>
        </button>
      )}
    </div>
  );
}
