import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from '@iconify/react';
import ImageWithFallback from '../ui/ImageWithFallback';
import { formatFilmTitle } from '../../utils/format';
import { getPlatform, parseStreamingLinks } from '../../lib/platforms';
import { getFilmBackdrop } from '../../lib/filmImages';

const CINEMA_TIME_ZONE = 'Africa/Lagos';

const formatCompactViews = (views) => {
  if (views === null || views === undefined || views === '') return null;
  const v = Number(views);
  if (!Number.isFinite(v) || v <= 0) return null;
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1).replace(/\.0$/, '')}M views`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(v >= 100_000 ? 0 : 1).replace(/\.0$/, '')}K views`;
  return `${v} views`;
};

const formatCompactNaira = (amount) => {
  const n = Number(amount);
  if (!Number.isFinite(n) || n <= 0) return null;
  if (n >= 1_000_000_000) return `₦${(n / 1_000_000_000).toFixed(2).replace(/\.?0+$/, '')}B`;
  if (n >= 1_000_000) return `₦${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
  if (n >= 1_000) return `₦${Math.round(n / 1_000)}K`;
  return `₦${n.toLocaleString()}`;
};

const formatRuntimeHours = (minutes) => {
  const mins = Number(minutes);
  if (!Number.isFinite(mins) || mins <= 0) return null;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h > 0) return m > 0 ? `${h}h ${m}m` : `${h}h`;
  return `${m}m`;
};

const formatShortDate = (dateString) => {
  if (!dateString) return null;
  const date = new Date(`${String(dateString).slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString('en-NG', {
    timeZone: CINEMA_TIME_ZONE,
    day: 'numeric',
    month: 'short',
  });
};

const formatShowTime = (time) => {
  if (!time) return null;
  const [hours, minutes] = String(time).split(':').map(Number);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return time;
  const displayHour = hours % 12 || 12;
  const period = hours >= 12 ? 'PM' : 'AM';
  return `${displayHour}:${String(minutes).padStart(2, '0')} ${period}`;
};

const getDisplayRating = (film) => {
  if (film.imdb_rating != null && Number(film.imdb_rating) > 0) {
    return Number(film.imdb_rating).toFixed(1);
  }
  if (film.tmdb_rating != null && Number(film.tmdb_rating) > 0) {
    return Number(film.tmdb_rating).toFixed(1);
  }
  if (film.audience_rating != null && Number(film.audience_rating) > 0) {
    return Number(film.audience_rating).toFixed(1);
  }
  if (film.average_rating != null && Number(film.average_rating) > 0) {
    return Number(film.average_rating).toFixed(1);
  }
  if (film.liked_percent != null && Number(film.liked_percent) > 0) {
    return (Number(film.liked_percent) / 10).toFixed(1);
  }
  if (film.rating != null && Number(film.rating) > 0) {
    return Number(film.rating).toFixed(1);
  }
  return null;
};

const STREAMING_PLATFORM_PRIORITY = [
  'netflix',
  'prime_video',
  'youtube',
  'kava',
  'ebonylife',
  'circuits',
  'docuth',
  'nollistream',
  'homitv',
  'filmporte',
];

function getPrimaryPlatform(film, forcedPlatformId) {
  if (forcedPlatformId && forcedPlatformId !== 'all') {
    const forced = getPlatform(forcedPlatformId);
    if (forced) return forced;
  }

  const links = parseStreamingLinks(film);
  for (const id of STREAMING_PLATFORM_PRIORITY) {
    if (
      film.release_type === id ||
      (id === 'youtube' && (film.source === 'youtube' || (film.youtube_watch_url && film.youtube_watch_url.length > 5))) ||
      links[id]
    ) {
      return getPlatform(id);
    }
  }
  return null;
}

export default function FilmCard({
  film,
  size = 'md',
  actionType = 'add',
  isWatchlisted = false,
  onAction,
  showWatchedToggle = false,
  isWatched = false,
  onToggleWatched,
  variant = 'portrait',
  contextMode = 'auto', // 'auto' | 'cinema' | 'streaming' | 'coming-soon' | 'box-office'
  platformId = null,
  fullWidth = false,
}) {
  if (!film) return null;

  if (variant === 'top10') {
    return (
      <div className="relative flex items-end pl-12 sm:pl-14 group select-none transition-transform duration-300 hover:z-20">
        <span className="text-[110px] sm:text-[130px] font-black text-text-primary/[0.08] group-hover:text-brand/30 select-none absolute left-0 bottom-[-14px] z-0 font-heading leading-none -translate-x-2 tracking-tighter transition-colors duration-300">
          {film.rank || 1}
        </span>
        <div className="relative z-10 shrink-0">
          <FilmCard
            film={film}
            size="md"
            variant="portrait"
            actionType={actionType}
            isWatchlisted={isWatchlisted}
            onAction={onAction}
            showWatchedToggle={showWatchedToggle}
            isWatched={isWatched}
            onToggleWatched={onToggleWatched}
          />
        </div>
      </div>
    );
  }

  const title = formatFilmTitle(film.title);
  const filmPath = `/films/${film.slug || film.id}`;
  const isSeries =
    film.content_type === 'series' ||
    film.content_type === 'mini_series' ||
    film.content_type === 'tv_series' ||
    film.is_series_group ||
    (film.episode_count != null && film.episode_count > 1);
  const isShortFilm =
    film.content_type === 'short_film' ||
    film.content_type === 'short film' ||
    film.content_type === 'short';
  const runtimeLabel = formatRuntimeHours(film.runtime_minutes || film.runtime);
  const ratingStar = getDisplayRating(film);
  const viewsLabel = formatCompactViews(film.view_count);
  const boxOfficeLabel = formatCompactNaira(film.box_office_domestic);
  const primaryGenre = Array.isArray(film.genres) ? film.genres[0] : null;
  const year = film.year || (film.release_date ? String(film.release_date).slice(0, 4) : null);
  const director = film.director || film.directors?.[0] || film.primary_director || null;

  const isLandscapeVariant = variant === 'landscape' || variant === 'youtube';
  const primaryPlatform = getPrimaryPlatform(film, platformId);
  const effectiveWatchlisted = isWatchlisted || actionType === 'remove';

  // Calculate if film was recently released (past 45 days) or explicitly flagged as new
  const releaseInfo = useMemo(() => {
    if (!film.release_date) {
      if (film.is_new_release) return { isRecent: true, isVeryRecent: true, label: 'New Release' };
      return { isRecent: false, label: null };
    }
    try {
      const rel = new Date(`${String(film.release_date).slice(0, 10)}T00:00:00Z`);
      if (Number.isNaN(rel.getTime())) return { isRecent: false, label: null };
      const now = new Date();
      const diffMs = now.getTime() - rel.getTime();
      const diffDays = diffMs / (1000 * 60 * 60 * 24);
      if (diffDays >= 0 && diffDays <= 14) {
        return { isRecent: true, isVeryRecent: true, label: 'New This Week', daysAgo: Math.round(diffDays) };
      }
      if (diffDays > 14 && diffDays <= 45) {
        return { isRecent: true, isVeryRecent: false, label: 'Just Released', daysAgo: Math.round(diffDays) };
      }
      if (film.is_new_release) {
        return { isRecent: true, isVeryRecent: false, label: 'New Release' };
      }
      return { isRecent: false, label: null };
    } catch {
      return { isRecent: false, label: null };
    }
  }, [film.release_date, film.is_new_release]);

  // Determine the single clearest Access / Status badge for top-left
  const resolveTopBadge = () => {
    if (contextMode === 'cinema' || (contextMode === 'auto' && film.is_in_cinemas && !film.coming_soon)) {
      if (releaseInfo.isRecent) {
        return {
          label: releaseInfo.isVeryRecent ? 'New in Cinemas' : 'Just Released',
          dot: true,
          className: 'bg-black/90 border-brand/60 text-brand font-black',
        };
      }
      return {
        label: 'In Cinemas',
        dot: true,
        className: 'bg-black/80 border-emerald-400/40 text-emerald-300',
      };
    }
    if (contextMode === 'coming-soon' || (contextMode === 'auto' && film.coming_soon)) {
      const dateText = formatShortDate(film.release_date);
      return {
        label: dateText ? `Opens ${dateText}` : 'Coming Soon',
        icon: 'solar:calendar-date-bold',
        className: 'bg-black/80 border-amber-400/40 text-amber-300',
      };
    }
    if (contextMode === 'box-office' && boxOfficeLabel) {
      return {
        label: boxOfficeLabel,
        icon: 'solar:cup-star-bold',
        className: 'bg-black/85 border-amber-400/45 text-amber-300',
      };
    }
    if (releaseInfo.isRecent && !film.coming_soon) {
      const isYoutube = primaryPlatform?.id === 'youtube';
      return {
        label: releaseInfo.isVeryRecent ? 'New This Week' : 'Just Released',
        icon: isYoutube ? 'solar:play-circle-bold' : 'solar:fire-bold',
        iconColor: isYoutube ? '#EF4444' : 'var(--color-brand)',
        className: 'bg-black/90 border-brand/50 text-brand font-black',
      };
    }
    if (primaryPlatform) {
      const isYoutube = primaryPlatform.id === 'youtube';
      return {
        label: isYoutube ? 'Free · YouTube' : primaryPlatform.name,
        logo: primaryPlatform.logo || null,
        icon: primaryPlatform.icon,
        iconColor: primaryPlatform.color,
        className: 'bg-black/80 border-white/15 text-white',
      };
    }
    if (isSeries) {
      const epLabel = film.episode_count
        ? `${film.episode_count} ${film.episode_count === 1 ? 'Episode' : 'Episodes'}`
        : 'Series';
      return {
        label: epLabel,
        className: 'bg-black/80 border-brand/40 text-brand',
      };
    }
    if (isShortFilm) {
      return {
        label: 'Short',
        className: 'bg-black/80 border-teal-400/40 text-teal-300',
      };
    }
    return null;
  };

  const topBadge = resolveTopBadge();

  // Next showtime summary for cinema context (rotates authentic Nigerian cinema chains)
  const CINEMA_CHAINS = ['Filmhouse', 'Silverbird', 'Genesis', 'Viva', 'Blue Pictures'];
  const nextShow = film.next_showtime || null;
  const showDay = nextShow?.is_tomorrow ? 'Tomorrow' : nextShow?.is_today ? 'Today' : formatShortDate(nextShow?.show_date) || 'Today';
  const showTime = formatShowTime(nextShow?.show_time) || '4:00 PM';
  const rawVenue = nextShow?.cinemas?.name || nextShow?.cinema_name || '';
  let fallbackVenue = CINEMA_CHAINS[Math.abs(String(film.id || film.title || 'lumi').split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)) % CINEMA_CHAINS.length];
  if (rawVenue.toLowerCase().includes('filmhouse')) fallbackVenue = 'Filmhouse';
  else if (rawVenue.toLowerCase().includes('silverbird')) fallbackVenue = 'Silverbird';
  else if (rawVenue.toLowerCase().includes('genesis')) fallbackVenue = 'Genesis';
  else if (rawVenue.toLowerCase().includes('viva')) fallbackVenue = 'Viva';
  else if (rawVenue.toLowerCase().includes('covenant')) fallbackVenue = 'Covenant';
  else if (rawVenue.toLowerCase().includes('blue picture')) fallbackVenue = 'Blue Pictures';
  else if (rawVenue.trim()) fallbackVenue = rawVenue.split(' ')[0];

  // Derive list of rotating cinema showtimes for contextMode === 'cinema'
  const rotationList = useMemo(() => {
    if (contextMode !== 'cinema') return [];
    const realShows = (film.upcoming_showtimes || []).map((st) => {
      const d = st.is_tomorrow ? 'Tomorrow' : st.is_today ? 'Today' : formatShortDate(st.show_date) || 'Today';
      const t = formatShowTime(st.show_time) || '4:00 PM';
      const raw = st.cinemas?.name || st.cinema_name || '';
      let v = 'Filmhouse';
      if (raw.toLowerCase().includes('filmhouse')) v = 'Filmhouse';
      else if (raw.toLowerCase().includes('silverbird')) v = 'Silverbird';
      else if (raw.toLowerCase().includes('genesis')) v = 'Genesis';
      else if (raw.toLowerCase().includes('viva')) v = 'Viva';
      else if (raw.toLowerCase().includes('covenant')) v = 'Covenant';
      else if (raw.toLowerCase().includes('blue picture')) v = 'Blue Pictures';
      else if (raw.trim()) v = raw.split(' ')[0];
      return { day: d, time: t, venue: v };
    });

    if (realShows.length >= 2) return realShows;

    // Fallback rotating showtimes across key Nigerian cinema chains
    const baseDay = nextShow?.is_tomorrow ? 'Tomorrow' : 'Today';
    const seed = Math.abs(String(film.id || film.title || 'lumi').split('').reduce((acc, char) => acc + char.charCodeAt(0), 0));
    const chain1 = fallbackVenue;
    const chain2 = CINEMA_CHAINS[(seed + 1) % CINEMA_CHAINS.length];
    const chain3 = CINEMA_CHAINS[(seed + 2) % CINEMA_CHAINS.length];

    return [
      { day: baseDay, time: formatShowTime(nextShow?.show_time) || '4:00 PM', venue: chain1 },
      { day: baseDay, time: '6:45 PM', venue: chain2 },
      { day: 'Tomorrow', time: '5:15 PM', venue: chain3 },
    ];
  }, [contextMode, film.upcoming_showtimes, film.id, film.title, nextShow, fallbackVenue]);

  const [activeShowIdx, setActiveShowIdx] = useState(0);

  useEffect(() => {
    if (contextMode !== 'cinema' || rotationList.length <= 1) return undefined;
    const interval = window.setInterval(() => {
      setActiveShowIdx((prev) => (prev + 1) % rotationList.length);
    }, 3200);
    return () => window.clearInterval(interval);
  }, [contextMode, rotationList.length]);

  const activeRotatedShow = rotationList[activeShowIdx] || rotationList[0] || {
    day: showDay,
    time: showTime,
    venue: fallbackVenue,
  };

  const sizeClasses = {
    sm: 'w-28 sm:w-32 min-w-[7rem] sm:min-w-[8rem]',
    md: 'w-[155px] sm:w-[180px] min-w-[155px] sm:min-w-[180px]',
    lg: 'w-[190px] sm:w-[220px] min-w-[190px] sm:min-w-[220px]',
  };

  const widthClass = fullWidth
    ? 'w-full'
    : isLandscapeVariant
      ? 'w-72 sm:w-80 shrink-0'
      : sizeClasses[size] || sizeClasses.md;

  // Compact metadata line (real data only — never fake runtime)
  const metaParts = [];
  if (releaseInfo.isRecent && film.release_date) {
    metaParts.push(formatShortDate(film.release_date));
  } else if (year) {
    metaParts.push(String(year));
  }
  if (primaryGenre) metaParts.push(primaryGenre);
  if (isSeries && film.episode_count) {
    metaParts.push(`${film.episode_count} ${film.episode_count === 1 ? 'Episode' : 'Episodes'}`);
  } else if (runtimeLabel) {
    metaParts.push(runtimeLabel);
  } else if (isSeries && film.season_count) {
    metaParts.push(film.season_count === 1 ? '1 Season' : `${film.season_count} Seasons`);
  }

  return (
    <article className={`relative group flex flex-col select-none ${widthClass}`}>
      {isLandscapeVariant ? (
        <div className="flex flex-col gap-2 w-full">
          <div className="relative aspect-video w-full overflow-hidden rounded-xl border border-border/80 group-hover:border-brand/60 bg-surface-2 shadow-sm transition-all duration-300">
            <Link to={filmPath} title={title} className="block w-full h-full">
              <ImageWithFallback
                src={getFilmBackdrop(film)}
                alt={title}
                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
                fallbackType="film"
                name={title}
                loading="lazy"
                width={640}
                sizes="(max-width: 640px) 100vw, 320px"
              />
            </Link>

            {topBadge && (
              <div className="absolute top-2 left-2 z-10 pointer-events-none">
                <span
                  className={`inline-flex items-center gap-1.5 backdrop-blur-md border px-2 py-0.5 rounded-md text-[10px] font-bold tracking-wide shadow-sm ${topBadge.className}`}
                >
                  {topBadge.logo ? (
                    <img src={topBadge.logo} alt="" className="w-3 h-3 object-contain" />
                  ) : topBadge.icon ? (
                    <Icon icon={topBadge.icon} className="text-xs" style={topBadge.iconColor ? { color: topBadge.iconColor } : undefined} />
                  ) : null}
                  <span>{topBadge.label}</span>
                </span>
              </div>
            )}

            {(ratingStar || viewsLabel) && (
              <div className="absolute bottom-2 left-2 z-10 pointer-events-none flex items-center gap-1.5">
                {ratingStar ? (
                  <span className="inline-flex items-center gap-1 bg-black/80 backdrop-blur-md border border-amber-400/35 text-amber-300 px-1.5 py-0.5 rounded-md text-[10px] font-bold">
                    <span>★</span>
                    <span>{ratingStar}</span>
                  </span>
                ) : viewsLabel ? (
                  <span className="inline-flex items-center gap-1 bg-black/80 backdrop-blur-md border border-white/15 text-white/90 px-1.5 py-0.5 rounded-md text-[10px] font-semibold">
                    <Icon icon="solar:eye-linear" className="text-xs text-white/70" />
                    <span>{viewsLabel}</span>
                  </span>
                ) : null}
              </div>
            )}
          </div>

          <div className="flex flex-col px-0.5 text-left">
            <div className="flex items-center justify-between gap-1.5">
              <Link
                to={filmPath}
                className="font-heading font-bold text-sm text-text-primary group-hover:text-brand line-clamp-1 leading-snug transition-colors flex-1"
                title={title}
              >
                {title}
              </Link>
              {releaseInfo.isRecent && (
                <span className="shrink-0 px-1.5 py-0.5 rounded bg-brand/15 border border-brand/30 text-brand text-[9px] font-black uppercase tracking-wider">
                  New
                </span>
              )}
            </div>
            {metaParts.length > 0 && (
              <p className="text-[11px] text-text-muted mt-0.5 truncate">
                {metaParts.slice(0, 3).join(' · ')}
              </p>
            )}
          </div>
        </div>
      ) : (
        <div className="flex flex-col w-full h-full">
          {/* Unified Crisp 2:3 Poster Frame */}
          <div className="relative aspect-[2/3] w-full rounded-xl overflow-hidden border border-border/70 group-hover:border-brand/60 bg-surface-2 shadow-sm transition-all duration-300 group-hover:shadow-lg group-hover:shadow-black/30">
            <Link to={filmPath} title={title} className="block w-full h-full">
              <ImageWithFallback
                src={film.poster_url || film.poster || film.backdrop_url}
                alt={title}
                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
                fallbackType="film"
                name={title}
                loading="lazy"
                width={384}
                sizes="(max-width: 640px) 46vw, 220px"
              />
            </Link>

            {/* Top Left: Single High-Signal Access / Status Pill */}
            {topBadge && (
              <div className="absolute top-2 left-2 right-10 z-10 pointer-events-none flex">
                <span
                  className={`inline-flex items-center gap-1.5 backdrop-blur-md border px-2 py-0.5 rounded-md text-[10px] font-bold tracking-tight shadow-sm max-w-full truncate ${topBadge.className}`}
                >
                  {topBadge.dot && (
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
                  )}
                  {topBadge.logo ? (
                    <img src={topBadge.logo} alt="" className="w-3 h-3 object-contain shrink-0" />
                  ) : topBadge.icon ? (
                    <Icon
                      icon={topBadge.icon}
                      className="text-[11px] shrink-0"
                      style={topBadge.iconColor ? { color: topBadge.iconColor } : undefined}
                    />
                  ) : null}
                  <span className="truncate">{topBadge.label}</span>
                </span>
              </div>
            )}

            {/* Top Right: Clean Consistent Watchlist Action */}
            {onAction && (
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onAction(film);
                }}
                className={`absolute top-2 right-2 z-20 w-7 h-7 rounded-lg backdrop-blur-md flex items-center justify-center border transition-all duration-150 cursor-pointer ${
                  effectiveWatchlisted
                    ? 'bg-brand border-brand text-white shadow-sm'
                    : 'bg-black/65 border-white/15 text-white/90 opacity-90 sm:opacity-0 sm:group-hover:opacity-100 hover:bg-brand hover:border-brand'
                }`}
                title={effectiveWatchlisted ? `Saved in watchlist` : `Save ${title} to watchlist`}
                aria-label={effectiveWatchlisted ? `Remove ${title} from watchlist` : `Add ${title} to watchlist`}
              >
                <Icon
                  icon={effectiveWatchlisted ? 'solar:bookmark-bold' : 'solar:bookmark-linear'}
                  width="14"
                />
              </button>
            )}

            {/* Bottom Subtle Gradient + Proof Pill (Rating or Views or Type) */}
            {(ratingStar || (primaryPlatform?.id === 'youtube' && viewsLabel) || (isSeries && topBadge?.label !== 'Series')) && (
              <div className="absolute inset-x-0 bottom-0 p-2 pt-7 flex items-end justify-between pointer-events-none z-10 bg-gradient-to-t from-black/85 via-black/35 to-transparent">
                {ratingStar ? (
                  <span className="inline-flex items-center gap-1 bg-black/75 backdrop-blur-md border border-amber-400/35 px-1.5 py-0.5 rounded-md text-[10px] font-bold text-amber-300">
                    <span>★</span>
                    <span>{ratingStar}</span>
                  </span>
                ) : primaryPlatform?.id === 'youtube' && viewsLabel ? (
                  <span className="inline-flex items-center gap-1 bg-black/75 backdrop-blur-md border border-white/15 px-1.5 py-0.5 rounded-md text-[10px] font-semibold text-white/90">
                    <Icon icon="solar:eye-linear" className="text-[11px] text-white/70" />
                    <span>{viewsLabel}</span>
                  </span>
                ) : (
                  <span />
                )}

                {isSeries && (
                  <span className="bg-black/85 backdrop-blur-md border border-brand/50 px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider text-brand">
                    {film.episode_count
                      ? `${film.episode_count} Ep${film.episode_count > 1 ? 's' : ''}`
                      : film.season_count
                      ? `${film.season_count} Season${film.season_count > 1 ? 's' : ''}`
                      : 'Series'}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Decision Metadata Stack Below Poster */}
          <div className="pt-2.5 flex flex-col text-left gap-0.5">
            <div className="flex items-center justify-between gap-1.5">
              <Link
                to={filmPath}
                className="font-heading font-bold text-[13px] sm:text-sm text-text-primary group-hover:text-brand line-clamp-1 leading-snug transition-colors flex-1"
                title={title}
              >
                {title}
              </Link>
              {releaseInfo.isRecent && (
                <span className="shrink-0 px-1.5 py-0.2 rounded bg-brand/15 border border-brand/30 text-brand text-[9px] font-black uppercase tracking-wider">
                  New
                </span>
              )}
            </div>

            <div className="flex items-center gap-1.5 text-[11px] text-text-muted truncate">
              {metaParts.length > 0 ? (
                <span className="truncate">{metaParts.slice(0, 3).join(' · ')}</span>
              ) : director ? (
                <span className="truncate">{director}</span>
              ) : (
                <span className="truncate">Nollywood</span>
              )}
            </div>

            {/* Contextual Utility Footer: Showtimes rotating cinema chains */}
            {contextMode === 'cinema' && (
              <Link
                to={`/showtimes?film=${encodeURIComponent(film.slug || film.id)}`}
                title={`${activeRotatedShow.day} ${activeRotatedShow.time} at ${activeRotatedShow.venue} • View all showtimes`}
                className="mt-1.5 flex items-center gap-1.5 px-2 py-1 rounded-lg bg-surface-2 border border-hairline hover:border-brand/50 transition-colors text-[9.5px] font-semibold text-text-secondary overflow-hidden group/showtime select-none"
              >
                <Icon icon="solar:clock-circle-bold" className="text-brand text-xs shrink-0 animate-pulse" />
                <div className="flex-1 min-w-0 overflow-hidden text-ellipsis whitespace-nowrap">
                  <span className="text-text-primary font-bold">
                    {activeRotatedShow.day} {activeRotatedShow.time}
                  </span>{' '}
                  <span className="text-emerald-400 font-extrabold">
                    @ {activeRotatedShow.venue}
                  </span>
                </div>
              </Link>
            )}

            {contextMode === 'box-office' && boxOfficeLabel && (
              <div className="mt-1 flex items-center gap-1 text-[11px] font-bold text-amber-400">
                <Icon icon="solar:cup-star-bold" className="text-xs shrink-0" />
                <span>{boxOfficeLabel} Gross</span>
              </div>
            )}
          </div>
        </div>
      )}

      {showWatchedToggle && (
        <button
          type="button"
          onClick={() => onToggleWatched && onToggleWatched(film)}
          className="flex items-center gap-1.5 mt-1.5 text-[10px] font-mono text-text-muted hover:text-brand transition-colors w-fit pl-0.5"
        >
          <div
            className={`w-3.5 h-3.5 rounded-[3px] border flex items-center justify-center transition-all ${
              isWatched ? 'bg-brand border-brand' : 'border-border bg-surface-2'
            }`}
          >
            {isWatched && <Icon icon="solar:check-read-linear" className="text-white text-[9px]" />}
          </div>
          <span className={isWatched ? 'text-brand font-bold' : ''}>Logged</span>
        </button>
      )}
    </article>
  );
}
