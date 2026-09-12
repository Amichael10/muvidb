import { Link, useNavigate } from 'react-router-dom';
import { Icon } from '@iconify/react';
import { useAuth } from '../../context/AuthContext';
import { useWatchlist } from '../../hooks/useWatchlist';
import { getPlatform } from '../../lib/platforms';
import { formatFilmTitle } from '../../utils/format';
import ImageWithFallback from '../ui/ImageWithFallback';

const formatRuntime = (minutes) => {
  if (!minutes) return null;
  const total = Number(minutes);
  const hours = Math.floor(total / 60);
  const mins = total % 60;
  return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
};

const getRating = (film) => {
  if (film.imdb_rating != null && film.imdb_rating > 0) {
    return (film.imdb_rating / 2).toFixed(1);
  }
  if (film.tmdb_rating != null && film.tmdb_rating > 0) {
    return (film.tmdb_rating / 2).toFixed(1);
  }
  if (film.liked_percent != null && film.liked_percent > 0) {
    return (film.liked_percent / 20).toFixed(1);
  }
  return null;
};

export default function StreamingCard({ film, platformId }) {
  const platform = getPlatform(platformId || film.release_type || film.source);
  const title = formatFilmTitle(film.title);
  const filmPath = `/films/${film.slug || film.id}`;
  const genres = film.genres?.slice(0, 2).join(' • ') || null;
  const starScore = getRating(film);
  const runtime = formatRuntime(film.runtime_minutes || film.runtime);
  const year = film.year || film.release_date?.slice(0, 4) || null;
  const { user } = useAuth();
  const navigate = useNavigate();
  const { inWatchlist, loading, toggleWatchlist } = useWatchlist(film.id, user);

  const handleWatchlist = async (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (!user) {
      navigate('/login', { state: { from: filmPath } });
      return;
    }
    await toggleWatchlist();
  };

  return (
    <article className="group relative w-[170px] sm:w-[195px] shrink-0 flex flex-col transition-all duration-300 select-none">
      {/* 2:3 Streaming Poster Art */}
      <div className="relative aspect-[2/3] w-full rounded-[4px] overflow-hidden border border-white/10 group-hover:border-white/30 bg-[#14181c] shadow-lg transition-all duration-300 group-hover:scale-[1.03] group-hover:shadow-[0_12px_28px_rgba(0,0,0,0.85)]">
        <Link to={filmPath} className="block w-full h-full" title={title}>
          <ImageWithFallback
            src={film.poster_url || film.backdrop_url}
            alt={title}
            className="h-full w-full object-cover"
            fallbackType="film"
            name={title}
            loading="lazy"
            width={400}
            sizes="195px"
          />
        </Link>

        {/* Platform Badge (Top Left) */}
        <div className="absolute top-2 left-2 z-10">
          <span className="inline-flex items-center gap-1 bg-black/85 backdrop-blur-sm border border-white/15 px-1.5 py-0.5 rounded-[3px] text-[10px] font-mono font-bold text-white shadow">
            {platform?.logo ? (
              <img src={platform.logo} alt="" className="w-3.5 h-3.5 object-contain" />
            ) : (
              <Icon icon={platform?.icon || 'solar:play-circle-bold'} style={{ color: platform?.color || '#FF5A1F' }} className="text-xs" />
            )}
            <span className="text-[9px] uppercase tracking-wider">{platform?.name || 'Stream'}</span>
          </span>
        </div>

        {/* Hover Watchlist Action (Top Right) */}
        <div className="absolute top-2 right-2 z-20 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          <button
            type="button"
            onClick={handleWatchlist}
            disabled={loading}
            className="w-7 h-7 rounded-[3px] bg-black/80 hover:bg-brand text-white flex items-center justify-center border border-white/20 transition-all cursor-pointer"
            aria-label={inWatchlist ? `Remove ${title} from watchlist` : `Add ${title} to watchlist`}
            title={inWatchlist ? 'Remove from watchlist' : 'Add to watchlist'}
          >
            <Icon icon={inWatchlist ? 'solar:check-read-linear' : 'solar:bookmark-linear'} width="15" />
          </button>
        </div>

        {/* Central Play Indicator on Hover */}
        <Link
          to={filmPath}
          className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-10"
          tabIndex={-1}
          aria-hidden="true"
        >
          <div className="w-9 h-9 rounded-full bg-brand text-white flex items-center justify-center shadow-xl border border-white/20 transform scale-90 group-hover:scale-100 transition-transform duration-200">
            <Icon icon="solar:play-bold" className="text-sm ml-0.5" />
          </div>
        </Link>

        {/* Rating inside poster bottom */}
        {starScore && (
          <div className="absolute bottom-2 left-2 z-10 flex items-center gap-1 bg-black/80 backdrop-blur-sm border border-amber-400/30 text-amber-400 px-1.5 py-0.5 rounded-[3px] text-[10px] font-bold">
            <span>★</span>
            <span>{starScore}</span>
          </div>
        )}
      </div>

      {/* Letterboxd Stack Below Poster */}
      <div className="pt-2 pb-1 flex flex-col text-left">
        <Link 
          to={filmPath} 
          className="font-heading font-semibold text-xs sm:text-sm text-white/90 group-hover:text-brand line-clamp-1 leading-snug transition-colors"
          title={title}
        >
          {title}
        </Link>

        <div className="flex items-center gap-1.5 text-[11px] text-white/50 font-mono mt-0.5 truncate">
          {year && <span>{year}</span>}
          {genres && (
            <>
              <span className="opacity-40">•</span>
              <span className="truncate">{genres}</span>
            </>
          )}
          {runtime && (
            <>
              <span className="opacity-40">•</span>
              <span>{runtime}</span>
            </>
          )}
        </div>
      </div>
    </article>
  );
}
