import { Link, useNavigate } from 'react-router-dom';
import { Icon } from '@iconify/react';
import { useAuth } from '../../context/AuthContext';
import { useWatchlist } from '../../hooks/useWatchlist';
import { getPlatform } from '../../lib/platforms';
import { formatFilmTitle } from '../../utils/format';
import ImageWithFallback from '../ui/ImageWithFallback';

const formatRuntime = (minutes) => {
  if (!minutes) return 'Runtime TBA';
  const total = Number(minutes);
  const hours = Math.floor(total / 60);
  const mins = total % 60;
  return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
};

const getRating = (film) => {
  const rating = Number(film.tmdb_rating || film.rating || film.audience_rating || film.average_rating || 0);
  return rating > 0 ? Math.min(9.7, rating).toFixed(1) : 'Not rated';
};

export default function StreamingCard({ film, platformId }) {
  const platform = getPlatform(platformId || film.release_type || film.source);
  const title = formatFilmTitle(film.title);
  const filmPath = `/films/${film.slug || film.id}`;
  const genres = film.genres?.slice(0, 2).join(' / ') || 'Genre unavailable';
  const synopsis = film.synopsis || film.tagline || 'Synopsis unavailable.';
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
    <article className="group relative grid h-[242px] w-[330px] min-w-[330px] shrink-0 grid-cols-[138px_minmax(0,1fr)] overflow-hidden rounded-lg border border-border bg-surface shadow-sm transition duration-300 hover:-translate-y-1 hover:border-brand/50 hover:shadow-xl sm:h-[258px] sm:w-[390px] sm:min-w-[390px] sm:grid-cols-[160px_minmax(0,1fr)]">
      <span
        className="absolute inset-x-0 top-0 z-30 h-1"
        style={{ backgroundColor: platform?.color || '#FF5A1F' }}
      />

      <div className="relative min-h-0 overflow-hidden border-r border-border bg-surface-2">
        <Link to={filmPath} className="block h-full" title={title}>
          <ImageWithFallback
            src={film.poster_url || film.backdrop_url}
            alt={title}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
            fallbackType="banner"
            name={title}
            loading="lazy"
            width={360}
          />
        </Link>

        <button
          type="button"
          onClick={handleWatchlist}
          disabled={loading}
          className="absolute left-2 top-3 z-20 flex h-9 w-9 items-center justify-center rounded-md border border-white/20 bg-black/65 text-white backdrop-blur-sm transition hover:border-brand hover:bg-brand disabled:cursor-wait disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
          aria-label={inWatchlist ? `Remove ${title} from watchlist` : `Add ${title} to watchlist`}
          title={inWatchlist ? 'Remove from watchlist' : 'Add to watchlist'}
        >
          <Icon icon={inWatchlist ? 'solar:check-read-linear' : 'solar:add-circle-linear'} width="20" height="20" />
        </button>
      </div>

      <div className="flex min-w-0 flex-col p-3 pt-4 sm:p-4 sm:pt-5">
        <div className="flex min-h-6 items-center gap-2 text-[10px] font-bold uppercase text-text-muted">
          <span className="flex h-5 w-5 shrink-0 items-center justify-center overflow-hidden rounded bg-surface-2">
            {platform?.logo ? (
              <img src={platform.logo} alt="" className="h-full w-full bg-white object-contain p-0.5" />
            ) : (
              <Icon icon={platform?.icon || 'solar:play-circle-bold'} style={{ color: platform?.color || '#FF5A1F' }} />
            )}
          </span>
          <span className="line-clamp-1">New on {platform?.name || 'streaming'}</span>
        </div>

        <Link
          to={filmPath}
          className="mt-2 min-h-10 line-clamp-2 font-heading text-sm font-bold leading-snug text-text-primary transition-colors hover:text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand sm:text-base"
          title={title}
        >
          {title}
        </Link>

        <p className="mt-1 min-h-4 line-clamp-1 text-[11px] font-semibold text-brand">
          {genres}
        </p>

        <p className="mt-2 min-h-[48px] line-clamp-3 text-[11px] leading-relaxed text-text-secondary sm:text-xs">
          {synopsis}
        </p>

        <div className="mt-auto flex flex-wrap items-center gap-x-2.5 gap-y-1 border-t border-border pt-3 text-[10px] font-medium text-text-muted sm:text-[11px]">
          <span className="inline-flex items-center gap-1 font-semibold text-text-primary">
            <Icon icon="solar:star-bold" className="text-[#F5C518]" />
            {getRating(film)}
          </span>
          <span>{formatRuntime(film.runtime_minutes || film.runtime)}</span>
          <span>{film.year || film.release_date?.slice(0, 4) || 'Year TBA'}</span>
        </div>
      </div>
    </article>
  );
}
