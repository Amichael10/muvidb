import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useWatchlist } from '../../hooks/useWatchlist';
import { Icon } from '@iconify/react';
import ImageWithFallback from '../ui/ImageWithFallback';
import { PLATFORMS, isFilmOnPlatform } from '../../lib/platforms';
import { formatFilmTitle } from '../../utils/format';

const formatReleaseDate = (dateString) => {
  if (!dateString) return 'Date TBA';
  const date = new Date(`${dateString}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return 'Date TBA';
  return date.toLocaleDateString('en-NG', {
    timeZone: 'Africa/Lagos',
    weekday: 'short',
    day: 'numeric',
    month: 'short'
  });
};

const formatRuntime = (minutes) => {
  if (!minutes) return null;
  const total = Number(minutes);
  const hours = Math.floor(total / 60);
  const mins = total % 60;
  return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
};

const getActivePlatforms = (film) => PLATFORMS.filter(platform => {
  if (platform.id === 'cinema') {
    return film.is_in_cinemas || film.release_type === 'cinema';
  }
  return isFilmOnPlatform(film, platform.id);
});

export default function ComingSoonCard({ film }) {
  const title = formatFilmTitle(film.title);
  const filmPath = `/films/${film.slug || film.id}`;
  const genres = film.genres?.slice(0, 2).join(' • ') || 'Genre TBA';
  const runtime = formatRuntime(film.runtime_minutes || film.runtime);
  const activePlatforms = getActivePlatforms(film);
  const primaryPlatform = activePlatforms.find(platform => platform.id === film.release_type) || activePlatforms[0];
  const actionLabel = activePlatforms.length === 1 && primaryPlatform
    ? primaryPlatform.name
    : 'Watch options';
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
    <article className="group w-[250px] min-w-[250px] shrink-0 overflow-hidden rounded-lg border border-border bg-surface shadow-sm transition duration-300 hover:-translate-y-1 hover:border-brand/50 hover:shadow-xl">
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
          className="absolute left-0 top-0 z-20 flex h-12 w-10 items-start justify-center bg-black/65 pt-2 text-white transition hover:bg-brand disabled:cursor-wait disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
          aria-label={inWatchlist ? `Remove ${title} from watchlist` : `Add ${title} to watchlist`}
          title={inWatchlist ? 'Remove from watchlist' : 'Add to watchlist'}
        >
          <Icon icon={inWatchlist ? 'solar:check-read-linear' : 'solar:add-circle-linear'} width="22" height="22" />
        </button>
      </div>

      <div className="flex min-h-[235px] flex-col p-3.5">
        <Link to={filmPath} className="line-clamp-2 min-h-12 font-heading text-lg font-semibold leading-tight text-text-primary transition-colors hover:text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand" title={title}>
          {title}
        </Link>

        <p className="mt-2 line-clamp-1 text-sm font-medium text-text-secondary">
          {genres}
        </p>

        <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-text-muted">
          {film.synopsis || 'More details will be announced soon.'}
        </p>

        <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-text-muted">
          <span className="inline-flex items-center gap-1 font-semibold text-brand">
            <Icon icon="solar:calendar-date-linear" />
            {formatReleaseDate(film.release_date)}
          </span>
          {runtime && (
            <>
              <span>•</span>
              <span>{runtime}</span>
            </>
          )}
        </div>

        <div className="mt-auto pt-4">
          <Link to={filmPath} className="flex min-h-10 w-full items-center justify-center gap-2 rounded-full bg-surface-2 px-4 py-2.5 text-sm font-medium text-brand transition-colors hover:bg-brand hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand">
            <Icon icon={primaryPlatform?.id === 'cinema' ? 'solar:ticket-linear' : 'solar:play-circle-linear'} className="text-lg" />
            {actionLabel}
          </Link>
        </div>
      </div>
    </article>
  );
}
