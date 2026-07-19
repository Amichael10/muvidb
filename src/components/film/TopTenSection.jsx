import { Link, useNavigate } from 'react-router-dom';
import { Icon } from '@iconify/react';
import { useAuth } from '../../context/AuthContext';
import { useWatchlist } from '../../hooks/useWatchlist';
import ImageWithFallback from '../ui/ImageWithFallback';
import { formatFilmTitle } from '../../utils/format';

const formatRuntime = (minutes) => {
  if (!minutes) return null;
  const total = Number(minutes);
  const hours = Math.floor(total / 60);
  const mins = total % 60;
  return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
};

const formatRelease = (film) => {
  if (film.release_date) {
    const date = new Date(`${film.release_date}T00:00:00`);
    if (!Number.isNaN(date.getTime())) {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    }
  }
  return film.year || null;
};

const getRating = (film) => {
  return film.liked_percent == null ? null : Math.round(Number(film.liked_percent));
};

const getFormat = (film) => {
  if (film.content_type === 'series') {
    const episodes = film.episode_count || film.episodes_count;
    return episodes ? `TV Series / ${episodes} eps` : 'TV Series';
  }
  return formatRuntime(film.runtime_minutes) || 'Feature Film';
};

function WatchlistButton({ film, compact = false }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { inWatchlist, loading, toggleWatchlist } = useWatchlist(film.id, user);

  const handleToggle = async (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (!user) {
      navigate('/login', { state: { from: `/films/${film.slug || film.id}` } });
      return;
    }
    await toggleWatchlist();
  };

  return (
    <button
      type="button"
      onClick={handleToggle}
      disabled={loading}
      className={`${compact ? 'h-8 w-8' : 'h-9 w-9'} flex items-center justify-center rounded-md border border-white/20 bg-black/55 text-white backdrop-blur-sm transition hover:border-brand hover:bg-brand disabled:cursor-wait disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand`}
      aria-label={inWatchlist ? `Remove ${formatFilmTitle(film.title)} from watchlist` : `Add ${formatFilmTitle(film.title)} to watchlist`}
      title={inWatchlist ? 'Remove from watchlist' : 'Add to watchlist'}
    >
      <Icon icon={inWatchlist ? 'solar:check-read-linear' : 'solar:add-circle-linear'} width="20" height="20" />
    </button>
  );
}

function RankTab({ rank, floating = false }) {
  return (
    <span
      className={`inline-flex min-w-10 items-center justify-center bg-brand px-2 py-1 pr-3 text-[11px] font-black leading-none tracking-wide text-white shadow-sm [clip-path:polygon(0_0,100%_0,88%_100%,0_100%)] ${floating ? 'absolute left-0 top-0 z-20' : 'w-fit'}`}
    >
      #{rank}
    </span>
  );
}

function FilmActions({ film }) {
  const filmPath = `/films/${film.slug || film.id}`;
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-semibold">
      <Link to={`${filmPath}#reviews`} className="inline-flex items-center gap-1 text-brand transition-colors hover:text-brand-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand">
        <Icon icon="solar:star-bold" className="text-[#F5C518]" />
        Rate
      </Link>
      <Link to={filmPath} className="inline-flex items-center gap-1 text-brand transition-colors hover:text-brand-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand">
        <Icon icon="solar:eye-linear" />
        Mark as watched
      </Link>
    </div>
  );
}

function FeatureCard({ film, featured = false }) {
  const title = formatFilmTitle(film.title);
  const filmPath = `/films/${film.slug || film.id}`;
  const rating = getRating(film);
  const synopsis = film.synopsis || 'Explore the story, cast, and where to watch this title on MuviDB.';

  return (
    <article className={`group relative grid min-w-0 gap-3 overflow-hidden rounded-lg border border-border bg-surface/95 p-3 shadow-sm transition-colors duration-200 hover:border-brand/50 ${featured ? 'grid-cols-[minmax(0,1.08fr)_minmax(0,1fr)] lg:min-h-[340px]' : 'grid-cols-[minmax(104px,0.78fr)_minmax(0,1fr)] lg:min-h-[300px]'}`}>
      <div className="relative min-h-0 overflow-hidden rounded-md bg-surface-2">
        <Link to={filmPath} className="block h-full min-h-[235px] lg:min-h-full" title={title}>
          <ImageWithFallback
            src={film.poster_url || film.backdrop_url}
            alt={title}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
            fallbackType="banner"
            name={title}
            loading="lazy"
            width={featured ? 520 : 360}
            sizes={featured ? '(max-width: 1024px) 50vw, 260px' : '(max-width: 1024px) 34vw, 180px'}
          />
        </Link>
        <div className="absolute left-2 top-2 z-20">
          <WatchlistButton film={film} />
        </div>
      </div>

      <div className="flex min-w-0 flex-col py-1">
        <RankTab rank={film.rank} />
        <Link to={filmPath} className="mt-2 line-clamp-2 font-heading text-base font-bold leading-tight text-text-primary transition-colors hover:text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand" title={title}>
          {title}
        </Link>

        <div className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] font-medium leading-relaxed text-text-secondary">
          {formatRelease(film) && <span>{formatRelease(film)}</span>}
          {getFormat(film) && <span>{getFormat(film)}</span>}
          {film.content_type === 'series' && film.year && <span>{film.year}</span>}
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] font-semibold">
          {rating != null ? (
            <span className="inline-flex items-center gap-1 text-text-primary">
              <Icon icon="mdi:popcorn" className="text-[#FA320A]" />
              {rating}% <span className="font-medium text-text-muted">liked</span>
            </span>
          ) : (
            <span className="text-text-muted">Not yet rated</span>
          )}
        </div>

        <div className="mt-3">
          <FilmActions film={film} />
        </div>

        <p className={`mt-5 text-sm leading-snug text-text-secondary ${featured ? 'line-clamp-5' : 'line-clamp-4'}`}>
          {synopsis}
        </p>
      </div>
    </article>
  );
}

function PosterCard({ film }) {
  const title = formatFilmTitle(film.title);
  const filmPath = `/films/${film.slug || film.id}`;

  return (
    <article className="group min-w-0 overflow-hidden rounded-lg border border-border bg-surface/95 shadow-sm transition-colors duration-200 hover:border-brand/50">
      <div className="relative aspect-[2/3] overflow-hidden bg-surface-2">
        <Link to={filmPath} className="block h-full" title={title}>
          <ImageWithFallback
            src={film.poster_url || film.backdrop_url}
            alt={title}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
            fallbackType="banner"
            name={title}
            loading="lazy"
            width={360}
            sizes="(max-width: 1024px) 28vw, 180px"
          />
        </Link>
        <RankTab rank={film.rank} floating />
        <div className="absolute right-2 top-2 z-20 opacity-0 transition-opacity duration-200 group-hover:opacity-100 focus-within:opacity-100">
          <WatchlistButton film={film} compact />
        </div>
      </div>
      <Link to={filmPath} className="block min-h-12 px-2 py-2.5 text-xs font-bold leading-snug text-text-primary transition-colors hover:text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand" title={title}>
        {title}
      </Link>
    </article>
  );
}

function LoadingFeature({ featured = false }) {
  return <div className={`grid min-h-[300px] gap-3 rounded-lg border border-border bg-surface/90 p-3 ${featured ? 'grid-cols-[minmax(0,1.08fr)_minmax(0,1fr)] lg:min-h-[340px]' : 'grid-cols-[minmax(104px,0.78fr)_minmax(0,1fr)]'}`}><div className="animate-shimmer rounded-md" /><div className="space-y-3 py-1"><div className="h-6 w-10 animate-shimmer rounded-md" /><div className="h-5 w-4/5 animate-shimmer rounded-md" /><div className="h-4 w-3/5 animate-shimmer rounded-md" /><div className="mt-6 h-20 w-full animate-shimmer rounded-md" /></div></div>;
}

export default function TopTenSection({ title, subtitle, films, isLoading = false }) {
  const topThree = films.slice(0, 3);
  const remaining = films.slice(3, 10);

  return (
    <section className="relative group/top-ten">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-7 flex items-end justify-between gap-4">
          <div className="space-y-1.5">
            {subtitle && <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-text-muted">{subtitle}</p>}
            <h2 className="font-heading text-3xl font-bold leading-none tracking-tight text-text-primary md:text-[2.5rem]">{title}</h2>
          </div>
          <Link to="/browse?sort=rating" className="inline-flex shrink-0 items-center gap-1.5 pb-1 text-xs font-bold tracking-wide text-text-secondary transition-colors hover:text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand">
            Browse all
            <Icon icon="solar:alt-arrow-right-linear" className="h-4 w-4" />
          </Link>
        </div>

        {isLoading ? (
          <>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-[1.3fr_1fr_1fr]">
              <LoadingFeature featured />
              <LoadingFeature />
              <LoadingFeature />
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
              {Array.from({ length: 7 }).map((_, index) => <div key={index} className="aspect-[2/3] animate-shimmer rounded-lg border border-border" />)}
            </div>
          </>
        ) : (
          <>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-[1.3fr_1fr_1fr]">
              {topThree.map((film, index) => <FeatureCard key={film.id} film={{ ...film, rank: film.rank || index + 1 }} featured={index === 0} />)}
            </div>
            {remaining.length > 0 && (
              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
                {remaining.map((film, index) => <PosterCard key={film.id} film={{ ...film, rank: film.rank || index + 4 }} />)}
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}
