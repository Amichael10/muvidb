import { Link } from 'react-router-dom';
import { useState } from 'react';
import { Icon } from '@iconify/react';
import ImageWithFallback from '../ui/ImageWithFallback';

const formatDeltaViews = (views) => {
  if (!views) return null;
  const v = Number(views);
  if (v >= 1000000) return `+${(v / 1000000).toFixed(1)}M this week`;
  if (v >= 1000) return `+${(v / 1000).toFixed(0)}K this week`;
  return `+${v} views`;
};

const formatRuntimeHours = (minutes) => {
  if (!minutes) return null;
  const mins = Number(minutes);
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
};

export default function FilmCard({ 
  film, 
  size = 'md', 
  actionType = 'add', 
  onAction,
  showWatchedToggle = false,
  isWatched = false,
  onToggleWatched,
  variant = 'portrait'
}) {
  const [isHovered, setIsHovered] = useState(false);

  if (variant === 'top10') {
    return (
      <div className="relative flex items-end pl-14 sm:pl-16 h-72 sm:h-80 group select-none">
        {/* Giant Translucent Number */}
        <span className="text-[140px] sm:text-[160px] font-black text-white/10 select-none absolute left-0 bottom-[-24px] z-0 font-heading leading-none -translate-x-3 tracking-tighter">
          {film.rank || 1}
        </span>
        <div className="relative z-10 shrink-0">
          <FilmCard 
            film={film} 
            size="md" 
            variant="portrait" 
            actionType={actionType}
            onAction={onAction}
            showWatchedToggle={showWatchedToggle}
            isWatched={isWatched}
            onToggleWatched={onToggleWatched}
          />
        </div>
      </div>
    );
  }

  if (variant === 'landscape') {
    const formattedViews = formatDeltaViews(film.view_count);
    const durationLabel = formatRuntimeHours(film.runtime_minutes || film.runtime);
    
    return (
      <div className="relative flex flex-col gap-2 w-72 sm:w-80 group">
        <Link 
          to={`/films/${film.slug || film.id}`}
          title={film.title}
          className="relative block aspect-video w-full rounded-2xl overflow-hidden bg-surface-2/60 border border-white/5 group-hover:border-brand/40 shadow-xl group-hover:shadow-2xl group-hover:shadow-brand/5 transition-all duration-500 z-0 hover:z-10"
        >
          {/* Poster Image (Landscape aspect-video, upgraded to HD) */}
          <ImageWithFallback 
            src={film.poster_url || film.poster} 
            alt={film.title} 
            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
            fallbackType="banner"
            name={film.title}
            loading="lazy"
          />

          {/* Gradient Overlay for bottom controls readability */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />

          {/* Green Pill (Top Left) - e.g. +7.0M this week */}
          {formattedViews && (
            <div className="absolute top-2.5 left-2.5 bg-[#00A651] text-white text-[9px] font-bold px-2 py-1 rounded-md shadow-lg flex items-center gap-1 tracking-wide">
              {formattedViews}
            </div>
          )}

          {/* Duration Label (Bottom Right) - e.g. 1h 45m */}
          {durationLabel && (
            <div className="absolute bottom-2.5 right-2.5 bg-black/85 backdrop-blur-md text-white text-[9px] font-bold px-1.5 py-0.5 rounded border border-white/10 shadow-md">
              {durationLabel}
            </div>
          )}

          {/* Channel Brand (Bottom Left) - e.g. ON ENYINNA JONAS TV */}
          {film.channel_name && (
            <div className="absolute bottom-2.5 left-2.5 flex items-center gap-1.5 bg-black/60 backdrop-blur-md text-white/95 px-2 py-0.5 rounded-lg text-[8px] font-black uppercase tracking-wider border border-white/5">
              <Icon icon="simple-icons:youtube" className="text-[#FF0000] text-[10px]" />
              <span>ON {film.channel_name}</span>
            </div>
          )}
        </Link>

        {/* Info below image */}
        <div className="flex flex-col text-left px-1 mt-1">
          <Link 
            to={`/films/${film.slug || film.id}`}
            className="font-bold text-text-primary text-sm tracking-tight leading-snug group-hover:text-brand transition-colors line-clamp-1"
            title={film.title}
          >
            {film.title}
          </Link>
          <span className="text-xs text-text-muted mt-0.5 tracking-wide line-clamp-1">
            {film.channel_name || 'MuviDB Network'}
          </span>
        </div>
      </div>
    );
  }

  // Define dimensions based on size prop
  const sizeClasses = {
    sm: 'w-36 h-56 min-w-[9rem]',
    md: 'w-48 h-72 min-w-[12rem]',
    lg: 'w-64 h-96 min-w-[16rem]'
  };

  const filmRating = Number(film.tmdb_rating || film.average_rating || film.rating || 0);

  // Get active watch platform icons representing all available platforms
  const getPlatforms = () => {
    const list = [];
    if (film.is_in_cinemas) {
      list.push({ id: 'cinemas', icon: 'solar:ticket-bold', color: 'text-brand', label: 'In Cinemas Now' });
    }
    if (film.release_type === 'youtube' || (film.youtube_watch_url && film.youtube_watch_url.length > 5)) {
      list.push({ id: 'youtube', icon: 'simple-icons:youtube', color: 'text-[#FF0000]', label: 'Watch on YouTube' });
    }
    
    // Parse streaming links
    let streamingLinks = {};
    if (typeof film.streaming_links === 'string') {
      try { streamingLinks = JSON.parse(film.streaming_links); } catch(e) {}
    } else if (film.streaming_links) {
      streamingLinks = film.streaming_links;
    }
    
    const platformMap = {
      netflix: { icon: 'simple-icons:netflix', color: 'text-[#E50914]', label: 'Watch on Netflix' },
      prime_video: { icon: 'simple-icons:primevideo', color: 'text-[#00A8E1]', label: 'Watch on Prime Video' },
      kava: { icon: 'solar:play-circle-bold', color: 'text-[#FF5C00]', label: 'Watch on Kava' },
      ironflix: { icon: 'solar:play-bold', color: 'text-[#D32F2F]', label: 'Watch on Ironflix' },
      showmax: { icon: 'solar:tv-linear', color: 'text-[#E10098]', label: 'Watch on Showmax' },
      docuth: { icon: 'solar:play-bold', color: 'text-zinc-200', label: 'Watch on Docuth' }
    };
    
    Object.keys(platformMap).forEach(key => {
      if (streamingLinks[key] || film.release_type === key) {
        list.push({ id: key, ...platformMap[key] });
      }
    });
    
    return list.filter((v, i, a) => a.findIndex(t => t.id === v.id) === i);
  };
  
  const activePlatforms = getPlatforms();

  return (
    <div className="relative flex flex-col gap-3">
      <Link 
        to={`/films/${film.slug || film.id}`}
        title={film.title}
        className={`relative block rounded-xl overflow-hidden group transition-all duration-500 hover:shadow-2xl z-0 hover:z-10 bg-surface-2/60 ${sizeClasses[size]}`}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {/* Poster Image */}
        <ImageWithFallback 
          src={film.poster_url || film.poster} 
          alt={film.title} 
          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
          fallbackType="banner"
          name={film.title}
          loading="lazy"
        />

        {/* Professional Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent opacity-60 group-hover:opacity-80 transition-opacity duration-500" />

        {/* Rating Badge (Top Left) - Hidden if rating is 0.0 */}
        {filmRating > 0 && (
          <div className="absolute top-2 left-2 flex items-center gap-1 bg-black/60 backdrop-blur-md text-white px-1.5 py-0.5 rounded-md border border-white/10 shadow-lg z-20">
            <Icon icon="solar:star-bold" className="text-brand text-[10px]" />
            <span className="text-[10px] font-bold">
              {filmRating.toFixed(1)}
            </span>
          </div>
        )}

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

        {/* Bottom Content Overlay - Improved Legibility and Platform Icons */}
        <div className="absolute inset-x-0 bottom-0 p-3 z-20 bg-gradient-to-t from-black/95 via-black/40 to-transparent pt-10">
          <h3 className="text-white text-xs font-bold leading-tight mb-1 line-clamp-2 group-hover:text-brand transition-colors" title={film.title}>
            {film.title}
          </h3>
          <div className="flex items-center justify-between gap-2 mt-1">
            <div className="flex items-center gap-1.5 text-[10px] font-medium text-white/70">
              <span className="text-brand/90 font-bold">{film.year || film.release_date?.split('-')[0] || 'N/A'}</span>
              {film.genres && film.genres.length > 0 && (
                <>
                  <span className="w-1 h-1 rounded-full bg-white/20" />
                  <span className="truncate max-w-[80px]">{film.genres[0]}</span>
                </>
              )}
            </div>

            {/* Watch Platform Icons */}
            {activePlatforms.length > 0 && (
              <div className="flex items-center gap-1 shrink-0">
                {activePlatforms.slice(0, 3).map(platform => (
                  <span 
                    key={platform.id} 
                    className={`${platform.color} bg-black/40 backdrop-blur-sm w-5 h-5 rounded-full flex items-center justify-center border border-white/5`} 
                    title={platform.label}
                  >
                    <Icon icon={platform.icon} className="text-[10px]" />
                  </span>
                ))}
                {activePlatforms.length > 3 && (
                  <span className="text-[8px] font-black text-white bg-black/60 px-1 rounded-full border border-white/10 shrink-0">
                    +{activePlatforms.length - 3}
                  </span>
                )}
              </div>
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
