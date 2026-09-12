import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useWatchlist } from '../../hooks/useWatchlist';
import { Icon } from '@iconify/react';
import ImageWithFallback from '../ui/ImageWithFallback';
import { formatFilmTitle } from '../../utils/format';

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

const CINEMA_TIME_ZONE = 'Africa/Lagos';

const formatRuntime = (minutes) => {
  if (!minutes) return null;
  const total = Number(minutes);
  const hours = Math.floor(total / 60);
  const mins = total % 60;
  return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
};

const formatShowTime = (time) => {
  if (!time) return null;
  const [hours, minutes] = String(time).split(':').map(Number);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return time;
  const displayHour = hours % 12 || 12;
  const period = hours >= 12 ? 'PM' : 'AM';
  return `${displayHour}:${String(minutes).padStart(2, '0')} ${period}`;
};

const formatShowDate = (dateString) => {
  if (!dateString) return null;
  const date = new Date(`${dateString}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return dateString;
  return date.toLocaleDateString('en-NG', {
    timeZone: CINEMA_TIME_ZONE,
    weekday: 'short',
    day: 'numeric',
    month: 'short'
  });
};

export default function CinemaCard({ film }) {
  const title = formatFilmTitle(film.title);
  const filmPath = `/films/${film.slug || film.id}`;
  const starScore = getRating(film);
  const runtime = formatRuntime(film.runtime_minutes);
  const genres = film.genres?.slice(0, 2).join(' • ') || 'Now in Cinemas';
  const nextShowtime = film.next_showtime;
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
    <article className="group relative w-[230px] sm:w-[250px] shrink-0 flex flex-col transition-all duration-300 select-none">
      {/* 2:3 Theatrical Poster Art */}
      <div className="relative aspect-[2/3] w-full rounded-[4px] overflow-hidden border border-white/10 group-hover:border-white/30 bg-[#14181c] shadow-lg transition-all duration-300 group-hover:scale-[1.03] group-hover:shadow-[0_12px_28px_rgba(0,0,0,0.85)]">
        <Link to={filmPath} className="block w-full h-full" title={title}>
          <ImageWithFallback
            src={film.poster_url || film.backdrop_url}
            alt={title}
            className="h-full w-full object-cover"
            fallbackType="film"
            name={title}
            loading="lazy"
            width={480}
            sizes="250px"
          />
        </Link>

        {/* Theatrical Eyebrow Tag */}
        <div className="absolute top-2 left-2 z-10">
          <span className="inline-flex items-center gap-1 bg-black/80 backdrop-blur-sm border border-emerald-500/30 text-emerald-400 px-2 py-0.5 rounded-[3px] text-[9px] font-mono font-bold uppercase tracking-wider">
            <Icon icon="solar:ticket-bold" className="text-xs" />
            In Cinemas
          </span>
        </div>

        {/* Hover Watchlist Action */}
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

        {/* Central Explore Indicator on Hover */}
        <Link
          to={filmPath}
          className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-10"
          tabIndex={-1}
          aria-hidden="true"
        >
          <div className="w-10 h-10 rounded-full bg-brand text-white flex items-center justify-center shadow-xl border border-white/20 transform scale-90 group-hover:scale-100 transition-transform duration-200">
            <Icon icon="solar:ticket-bold" className="text-lg ml-0.5" />
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
      <div className="pt-2.5 pb-1 flex flex-col text-left">
        <Link 
          to={filmPath} 
          className="font-heading font-semibold text-sm text-white/95 group-hover:text-brand line-clamp-1 leading-snug transition-colors"
          title={title}
        >
          {title}
        </Link>

        <div className="flex items-center gap-1.5 text-[11px] text-white/50 font-mono mt-0.5 truncate">
          <span>{genres}</span>
          {runtime && (
            <>
              <span className="opacity-40">•</span>
              <span>{runtime}</span>
            </>
          )}
        </div>

        {/* Next Showtime Pill */}
        {nextShowtime && (
          <div className="mt-2 flex items-center gap-1.5 bg-[#181d24] border border-white/10 px-2.5 py-1.5 rounded-[4px] text-[11px] font-mono">
            <Icon icon="solar:clock-circle-linear" className="text-brand text-xs shrink-0" />
            <span className="text-white/90 truncate font-semibold">
              {nextShowtime.is_today
                ? 'Today'
                : nextShowtime.is_tomorrow
                  ? 'Tomorrow'
                  : formatShowDate(nextShowtime.show_date)}
              {formatShowTime(nextShowtime.show_time) ? ` • ${formatShowTime(nextShowtime.show_time)}` : ''}
            </span>
          </div>
        )}
      </div>
    </article>
  );
}
