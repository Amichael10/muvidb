import { Link } from 'react-router-dom';
import { useState } from 'react';
import { Icon } from '@iconify/react';
import ImageWithFallback from '../ui/ImageWithFallback';
import { useQuickView } from '../../context/QuickViewContext';

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
  variant = 'portrait' // Reverted to portrait as default layout
}) {
  const [isHovered, setIsHovered] = useState(false);
  const { openQuickView } = useQuickView();

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
    const durationLabel = (film.content_type === 'series' || film.is_series_group)
      ? (film.episodes_count > 1 ? `${film.episodes_count} Episodes` : (film.season_count ? (film.season_count === 1 ? '1 Season' : `${film.season_count} Seasons`) : 'TV Series'))
      : formatRuntimeHours(film.runtime_minutes || film.runtime);
    
    return (
      <div className="relative flex flex-col gap-2 w-72 sm:w-80 group">
        <Link 
          to={`/films/${film.slug || film.id}`}
          title={film.title}
          className="relative block aspect-video w-full rounded-2xl overflow-hidden bg-surface-2/60 border border-white/5 group-hover:border-brand/40 shadow-xl group-hover:shadow-2xl group-hover:shadow-brand/5 transition-all duration-500 z-0 hover:z-10"
        >
          {/* Poster Image (Landscape aspect-video) */}
          <ImageWithFallback 
            src={film.backdrop_url || film.poster_url || film.poster} 
            alt={film.title} 
            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
            fallbackType="banner"
            name={film.title}
            loading="lazy"
          />

          {/* Gradient Overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />

          {/* Views badge */}
          {formattedViews && (
            <div className="absolute top-2.5 left-2.5 bg-[#00A651] text-white text-[9px] font-bold px-2 py-1 rounded-md shadow-lg flex items-center gap-1 tracking-wide">
              {formattedViews}
            </div>
          )}

          {/* Duration Label */}
          {durationLabel && (
            <div className="absolute bottom-2.5 right-2.5 bg-black/85 backdrop-blur-md text-white text-[9px] font-bold px-1.5 py-0.5 rounded border border-white/10 shadow-md">
              {durationLabel}
            </div>
          )}

          {/* Channel Brand */}
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

  // Define dimensions based on size prop (Portrait 2:3 aspect ratio)
  const sizeClasses = {
    sm: 'w-36 h-56 min-w-[9rem]',
    md: 'w-48 h-72 min-w-[12rem]', // Naturally fits exactly 5.5 cards in standard viewports
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
  const durationLabel = film.content_type === 'series'
    ? (film.season_count ? (film.season_count === 1 ? '1 Season' : `${film.season_count} Seasons`) : 'TV Series')
    : (formatRuntimeHours(film.runtime_minutes || film.runtime) || '2h 5m');
  const matchScore = 75 + ((film.id ? Number(String(film.id).charCodeAt(0) || 0) : 0) % 24);

  const [hoverPosition, setHoverPosition] = useState('center');

  const handleMouseEnter = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const windowWidth = window.innerWidth;
    
    // Adjust threshold based on popup width and scale (280px * 1.08 / 2 = ~150px)
    if (rect.left < 150) {
      setHoverPosition('left');
    } else if (windowWidth - rect.right < 150) {
      setHoverPosition('right');
    } else {
      setHoverPosition('center');
    }
  };

  const getHoverClasses = () => {
    switch (hoverPosition) {
      case 'left': return 'left-0 top-1/2 -translate-y-1/2 origin-left';
      case 'right': return 'right-0 top-1/2 -translate-y-1/2 origin-right';
      default: return 'left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 origin-center';
    }
  };

  return (
    <div 
      className="relative group flex flex-col gap-3"
      onMouseEnter={handleMouseEnter}
    >
      {/* Base Portrait Card Link */}
      <Link 
        to={`/films/${film.slug || film.id}`}
        title={film.title}
        className={`relative block rounded-xl overflow-hidden transition-all duration-500 hover:shadow-2xl z-0 bg-surface-2/60 hover:border-brand/40 border border-white/5 ${sizeClasses[size]}`}
      >
        {/* Poster Image */}
        <ImageWithFallback 
          src={film.poster_url || film.poster} 
          alt={film.title} 
          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-[1.04]"
          fallbackType="banner"
          name={film.title}
          loading="lazy"
        />

        {/* Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent opacity-60 group-hover:opacity-80 transition-opacity duration-500" />

        {/* Rating Badge (Top Left) */}
        {filmRating > 0 && (
          <div className="absolute top-2.5 left-2.5 flex items-center gap-1 bg-black/60 backdrop-blur-md text-white px-1.5 py-0.5 rounded-md border border-white/10 shadow-lg z-20">
            <Icon icon="solar:star-bold" className="text-brand text-[10px]" />
            <span className="text-[10px] font-bold">
              {filmRating.toFixed(1)}
            </span>
          </div>
        )}

        {/* Series Badge */}
        {(film.content_type === 'series' || film.is_series_group) && (
          <div className={`absolute top-2.5 ${filmRating > 0 ? 'left-14' : 'left-2.5'} flex items-center gap-1 bg-brand text-white px-1.5 py-0.5 rounded-md shadow-lg z-20 text-[9px] font-black uppercase tracking-wider`}>
            <Icon icon={film.episodes_count > 1 ? "solar:folder-bold" : "solar:tv-bold"} className="text-white text-[9px]" />
            <span>{film.episodes_count > 1 ? `${film.episodes_count} EPS` : 'TV'}</span>
          </div>
        )}

        {/* Action Button (Hover State) */}
        <div className="absolute top-2.5 right-2.5 transition-all duration-500 z-20 opacity-0 -translate-y-1 group-hover:opacity-100 group-hover:translate-y-0">
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

        {/* Bottom Content Overlay */}
        <div className="absolute inset-x-0 bottom-0 p-3.5 z-20 bg-gradient-to-t from-black/95 via-black/40 to-transparent pt-10">
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

        {/* Bottom Line Accent (Brand Orange) */}
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-brand transform scale-x-0 group-hover:scale-x-100 transition-transform duration-500 origin-left z-30" />
      </Link>

      {/* Hover Landscape Popup Overlay */}
      <div 
        className={`absolute w-[280px] bg-[#181818] rounded-2xl overflow-hidden border border-white/10 shadow-2xl transition-all duration-300 ease-out opacity-0 scale-90 pointer-events-none group-hover:opacity-100 group-hover:scale-[1.08] group-hover:pointer-events-auto group-hover:delay-300 delay-100 z-50 flex flex-col ${getHoverClasses()}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Aspect-Video Preview Header */}
        <Link to={`/films/${film.slug || film.id}`} className="relative aspect-video w-full overflow-hidden block group/image bg-black">
          {film.backdrop_url ? (
            <ImageWithFallback 
              src={film.backdrop_url} 
              alt={film.title} 
              className="w-full h-full object-cover transition-transform duration-700 group-hover/image:scale-105"
              fallbackType="banner"
              name={film.title}
              loading="lazy"
            />
          ) : (
            <div className="relative w-full h-full overflow-hidden">
              {/* Blurred Poster Cover Fallback */}
              <div className="absolute inset-0 filter blur-xl scale-110 opacity-60">
                <img 
                  src={film.poster_url || film.poster} 
                  alt="" 
                  className="w-full h-full object-cover" 
                />
              </div>
              <div className="relative w-full h-full flex items-center justify-center bg-black/20">
                <img 
                  src={film.poster_url || film.poster} 
                  alt={film.title} 
                  className="h-full object-contain transition-transform duration-700 group-hover/image:scale-105" 
                />
              </div>
            </div>
          )}
          
          {/* Gradient Overlay */}
          <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-[#181818] to-transparent z-10" />

          {/* Center Play Button Overlay */}
          <div className="absolute inset-0 bg-black/35 flex items-center justify-center opacity-0 group-hover/image:opacity-100 transition-opacity duration-300 z-20">
            <div className="w-12 h-12 rounded-full bg-brand/90 hover:bg-brand text-white flex items-center justify-center shadow-lg transition-transform duration-300 transform scale-90 group-hover/image:scale-100 border border-white/25">
              <Icon icon="solar:play-bold" className="text-xl ml-0.5" />
            </div>
          </div>

          {/* Title on backdrop (bottom left) */}
          <div className="absolute bottom-3 left-4 right-4 z-20">
            <h4 className="text-white font-heading font-black text-sm tracking-tight drop-shadow-md truncate">
              {film.title}
            </h4>
          </div>
        </Link>

        {/* Details Box */}
        <div className="bg-[#181818] p-4 flex flex-col text-left">
          {/* Buttons Row */}
          <div className="flex items-center justify-between mb-3.5">
            <div className="flex items-center gap-2">
              {/* Play Button */}
              <Link 
                to={`/films/${film.slug || film.id}`}
                className="w-9 h-9 rounded-full bg-white flex items-center justify-center text-black hover:bg-white/95 transition shadow-md hover:scale-105 active:scale-95 shrink-0"
              >
                <Icon icon="solar:play-bold" className="text-lg ml-0.5" />
              </Link>
              
              {/* Add Watchlist Button */}
              <button 
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (onAction) onAction(film);
                }}
                className="w-9 h-9 rounded-full border border-white/30 hover:border-white flex items-center justify-center text-white bg-transparent hover:bg-white/10 transition hover:scale-105 active:scale-95 shrink-0"
                title={actionType === 'add' ? "Add to Watchlist" : "Remove from Watchlist"}
              >
                <Icon icon={actionType === 'add' ? "solar:plus-linear" : "solar:close-circle-linear"} className="text-lg" />
              </button>
              
              {/* Thumbs Up Button */}
              <button 
                className="w-9 h-9 rounded-full border border-white/30 hover:border-white flex items-center justify-center text-white bg-transparent hover:bg-white/10 transition hover:scale-105 active:scale-95 shrink-0"
                title="Like"
              >
                <Icon icon="solar:like-linear" className="text-lg" />
              </button>
            </div>
            
            {/* Info Arrow Button */}
            <button 
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                openQuickView(film);
              }}
              className="w-9 h-9 rounded-full border border-white/30 hover:border-white flex items-center justify-center text-white bg-transparent hover:bg-white/10 transition hover:scale-105 active:scale-95 shrink-0"
              title="More Info"
            >
              <Icon icon="solar:alt-arrow-down-linear" className="text-lg" />
            </button>
          </div>

          {/* Metadata Row */}
          <div className="flex items-center gap-2.5 text-xs text-white/90 mb-3 flex-wrap font-medium">
            <span className="text-brand font-bold">{matchScore}% Match</span>
            <span>{film.year || film.release_date?.split('-')[0]}</span>
            <span className="px-1.5 py-0.5 border border-white/30 rounded text-[9px] font-black tracking-wide leading-none uppercase bg-white/5">
              {film.maturity_rating || '18+'}
            </span>
            <span>{durationLabel}</span>
            <span className="px-1 py-0.5 border border-white/30 rounded text-[8px] font-black tracking-wide leading-none uppercase bg-white/5">
              HD
            </span>
          </div>

          {/* Genre Tags */}
          {film.genres && film.genres.length > 0 && (
            <div className="flex items-center gap-1.5 flex-wrap text-[10px] font-semibold text-white/60">
              {film.genres.slice(0, 3).map((g, idx) => (
                <span key={g} className="flex items-center gap-1.5">
                  {idx > 0 && <span className="w-1 h-1 rounded-full bg-white/20" />}
                  <span className="hover:text-white transition-colors">{g}</span>
                </span>
              ))}
            </div>
          )}

          {/* Platforms / Watch Badge */}
          {activePlatforms.length > 0 && (
            <div className="mt-3.5 pt-3 border-t border-white/5 flex flex-col gap-1.5">
              <span className="text-[9px] text-white/40 font-bold uppercase tracking-wider">Available on</span>
              <div className="flex items-center gap-1.5 flex-wrap">
                {activePlatforms.map(platform => (
                  <span 
                    key={platform.id} 
                    className={`${platform.color} bg-white/5 hover:bg-white/10 px-2 py-0.5 rounded-md flex items-center gap-1 border border-white/5 text-[9px] font-bold transition-all`} 
                    title={platform.label}
                  >
                    <Icon icon={platform.icon} className="text-[10px]" />
                    <span>{platform.label.replace('Watch on ', '').replace('In ', '')}</span>
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Watched Toggle */}
      {showWatchedToggle && (
        <button 
          onClick={() => onToggleWatched && onToggleWatched(film)}
          className="flex items-center gap-2 mt-1 text-[10px] font-bold text-text-muted hover:text-brand transition-colors group/watched w-fit pl-1"
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
