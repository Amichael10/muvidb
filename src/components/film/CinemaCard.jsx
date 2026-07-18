import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useWatchlist } from '../../hooks/useWatchlist';
import { Icon } from '@iconify/react';
import ImageWithFallback from '../ui/ImageWithFallback';
import { formatFilmTitle } from '../../utils/format';

const getRating = (film) => {
  return film.liked_percent == null ? null : Math.round(Number(film.liked_percent));
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
  const rating = getRating(film);
  const runtime = formatRuntime(film.runtime_minutes);
  const genres = film.genres?.slice(0, 2).join(' • ') || 'Now showing in cinemas';
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
    <article className="group w-[280px] min-w-[280px] shrink-0 overflow-hidden rounded-lg border border-border bg-surface shadow-sm transition duration-300 hover:-translate-y-1 hover:border-brand/50 hover:shadow-xl">
      <div className="relative aspect-[2/3] overflow-hidden bg-surface-2">
        <Link to={filmPath} className="block h-full" title={title}>
          <ImageWithFallback
            src={film.poster_url || film.backdrop_url}
            alt={title}
            className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.03]"
            fallbackType="banner"
            name={title}
            loading="lazy"
            width={640}
          />
        </Link>

        <button
          type="button"
          onClick={handleWatchlist}
          disabled={loading}
          className="absolute left-0 top-0 z-20 flex h-14 w-12 items-start justify-center bg-black/65 pt-2 text-white transition hover:bg-brand disabled:cursor-wait disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
          aria-label={inWatchlist ? `Remove ${title} from watchlist` : `Add ${title} to watchlist`}
          title={inWatchlist ? 'Remove from watchlist' : 'Add to watchlist'}
        >
          <Icon icon={inWatchlist ? 'solar:check-read-linear' : 'solar:add-circle-linear'} width="25" height="25" />
        </button>
      </div>

      <div className="flex min-h-[245px] flex-col p-3">
        <Link to={filmPath} className="line-clamp-2 min-h-14 font-heading text-xl font-semibold leading-tight text-text-primary transition-colors hover:text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand" title={title}>
          {title}
        </Link>

        <p className="mt-2 line-clamp-1 text-sm font-medium text-text-secondary">
          {genres}
        </p>

        <p className="mt-3 line-clamp-2 text-sm leading-relaxed text-text-secondary">
          {film.synopsis || 'Catch this title on the big screen while it is showing in cinemas.'}
        </p>

        <div className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-text-secondary">
          {rating != null && (
            <span className="inline-flex items-center gap-1 font-semibold text-text-primary">
              <Icon icon="mdi:popcorn" className="text-[#FA320A]" />
              {rating}%
            </span>
          )}
          {rating && runtime && <span className="text-text-muted">•</span>}
          {runtime && <span>{runtime}</span>}
          {runtime && film.nfvcb_rating && <span className="text-text-muted">•</span>}
          {film.nfvcb_rating && <span>{film.nfvcb_rating}</span>}
        </div>

        {nextShowtime && (
          <div className="mt-3">
            <p className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs font-semibold text-brand">
              <span>
                {nextShowtime.is_today
                  ? film.remaining_today_showtime_count === 1
                    ? 'Last show today'
                    : 'Showing today'
                  : nextShowtime.is_tomorrow
                    ? 'Showing tomorrow'
                    : `Showing ${formatShowDate(nextShowtime.show_date)}`}
              </span>
              {formatShowTime(nextShowtime.show_time) && (
                <>
                  <span className="text-text-muted">•</span>
                  <span>Next show {formatShowTime(nextShowtime.show_time)}</span>
                </>
              )}
            </p>
            {nextShowtime.cinemas?.name && (
              <p className="mt-1 truncate text-[10px] font-medium text-text-muted">
                at {nextShowtime.cinemas.name}
              </p>
            )}
          </div>
        )}

        <div className="mt-auto pt-5">
          <Link to="/showtimes" className="flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-brand px-4 py-3 text-base font-medium text-white transition-colors hover:bg-brand-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand">
            <Icon icon="solar:ticket-bold" className="text-xl" />
            Showtimes
          </Link>
        </div>
      </div>
    </article>
  );
}
