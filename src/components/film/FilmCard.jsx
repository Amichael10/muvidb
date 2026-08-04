import { Link } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { Icon } from '@iconify/react';
import ImageWithFallback from '../ui/ImageWithFallback';
import LikedScore from './LikedScore';
import { formatFilmTitle } from '../../utils/format';
import { getPlatform } from '../../lib/platforms';
import { getFilmBackdrop } from '../../lib/filmImages';

const formatDeltaViews = (views) => {
  if (!views) return null;
  const v = Number(views);
  if (v >= 1000000) return `+${(v / 1000000).toFixed(1)}M this week`;
  if (v >= 1000) return `+${(v / 1000).toFixed(0)}K this week`;
  return `+${v} views`;
};

const formatTotalViews = (views) => {
  if (views === null || views === undefined || views === '') return null;
  const v = Number(views);
  if (v >= 1000000) return `${(v / 1000000).toFixed(1)}M Views`;
  if (v >= 1000) return `${(v / 1000).toFixed(1)}K Views`;
  return `${v} Views`;
};

const formatRuntimeHours = (minutes) => {
  if (!minutes) return null;
  const mins = Number(minutes);
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
};

// Surface where a title is from (esp. non-Nigerian African titles). Handles
// both full names ("Nigeria") and ISO-2 codes ("NG") since the data has both.
const NAME_TO_ISO = {
  nigeria: 'NG', ghana: 'GH', kenya: 'KE', 'south africa': 'ZA', tanzania: 'TZ',
  uganda: 'UG', cameroon: 'CM', "cote d'ivoire": 'CI', "côte d'ivoire": 'CI',
  'ivory coast': 'CI', zambia: 'ZM', zimbabwe: 'ZW', rwanda: 'RW', ethiopia: 'ET',
  senegal: 'SN', mali: 'ML', benin: 'BJ', togo: 'TG', 'sierra leone': 'SL',
  liberia: 'LR', gambia: 'GM', malawi: 'MW', mozambique: 'MZ', angola: 'AO',
  botswana: 'BW', namibia: 'NA', 'democratic republic of the congo': 'CD',
  'united states': 'US', 'united states of america': 'US', usa: 'US',
  'united kingdom': 'GB', uk: 'GB',
};
const iso2ToFlag = (code) =>
  String.fromCodePoint(...[...code.toUpperCase()].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));
const countryFlag = (country) => {
  if (!country) return null;
  const c = country.trim();
  const iso = /^[a-z]{2}$/i.test(c) ? c.toUpperCase() : NAME_TO_ISO[c.toLowerCase()];
  return iso ? iso2ToFlag(iso) : '🌍';
};

const getYoutubeId = (url) => {
  if (!url) return null;
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
  const match = url.match(regExp);
  return (match && match[2].length === 11) ? match[2] : null;
};

const fetchYoutubeViews = async (videoId) => {
  const cacheKey = `yt_views_${videoId}`;
  const cached = localStorage.getItem(cacheKey);
  if (cached) {
    try {
      const { views, timestamp } = JSON.parse(cached);
      if (Date.now() - timestamp < 21600000) {
        return views;
      }
    } catch (e) {}
  }
  
  const apiKey = import.meta.env.VITE_YOUTUBE_API_KEY;
  if (!apiKey) return null;

  try {
    const response = await fetch(
      `https://www.googleapis.com/youtube/v3/videos?part=statistics&id=${videoId}&key=${apiKey}`
    );
    const data = await response.json();
    const views = data.items?.[0]?.statistics?.viewCount;
    if (views) {
      localStorage.setItem(cacheKey, JSON.stringify({ views, timestamp: Date.now() }));
      return views;
    }
  } catch (error) {
    console.error('Error fetching YouTube views:', error);
  }
  return null;
};

export default function FilmCard({ 
  film, 
  size = 'md', 
  actionType = 'add', 
  onAction,
  showWatchedToggle = false,
  isWatched = false,
  onToggleWatched,
  variant = 'portrait',
  fullWidth = false
}) {
  const [ytViews, setYtViews] = useState(null);

  useEffect(() => {
    let active = true;
    const videoId = getYoutubeId(film.youtube_watch_url);
    if (videoId) {
      fetchYoutubeViews(videoId).then(views => {
        if (active && views) {
          setYtViews(views);
        }
      });
    }
    return () => {
      active = false;
    };
  }, [film.youtube_watch_url]);

  if (variant === 'top10') {
    return (
      <div className="relative flex items-end pl-14 sm:pl-16 h-72 sm:h-80 group select-none">
        {/* Giant Translucent Number */}
        <span className="text-[140px] sm:text-[160px] font-black text-brand/15 dark:text-white/10 select-none absolute left-0 bottom-[-24px] z-0 font-heading leading-none -translate-x-3 tracking-tighter">
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
      kava: { icon: 'solar:play-circle-bold', color: 'text-[#E84090]', label: 'Watch on Kava' },
      ironflix: { icon: 'solar:play-bold', color: 'text-[#D32F2F]', label: 'Watch on Ironflix' },
      showmax: { icon: 'solar:tv-linear', color: 'text-[#E10098]', label: 'Watch on Showmax' },
      docuth: { icon: 'solar:play-bold', color: 'text-[#0048A8]', label: 'Watch on Docuth' },
      ebonylife: { icon: 'solar:play-circle-bold', color: 'text-[#F8A008]', label: 'Watch on EbonyLife' },
      circuits: { icon: 'solar:clapperboard-play-bold', color: 'text-[#F0532B]', label: 'Watch on Circuits' },
    };
    
    Object.keys(platformMap).forEach(key => {
      if (streamingLinks[key] || film.release_type === key) {
        list.push({ id: key, ...platformMap[key] });
      }
    });
    
    return list
      .filter((v, i, a) => a.findIndex(t => t.id === v.id) === i)
      .map((p) => ({ ...p, logo: getPlatform(p.id)?.logo || null }));
  };

  const activePlatforms = getPlatforms();
  const runtimeLabel = formatRuntimeHours(film.runtime_minutes || film.runtime);
  const durationLabel = (film.content_type === 'series' || film.is_series_group)
    ? (film.episodes_count > 1 ? `${film.episodes_count} Episodes` : (film.season_count ? (film.season_count === 1 ? '1 Season' : `${film.season_count} Seasons`) : 'TV Series'))
    : (runtimeLabel || '2h 5m');
  const youtubeRuntimeLabel = (film.content_type === 'series' || film.is_series_group) ? durationLabel : runtimeLabel;
  const formattedTotalViews = formatTotalViews(film.view_count);
  const formattedViews = formatDeltaViews(film.view_count);

  const sizeClasses = {
    sm: 'w-28 sm:w-36 h-44 sm:h-56 min-w-[7rem] sm:min-w-[9rem]',
    md: 'w-[140px] sm:w-48 h-[210px] sm:h-72 min-w-[8.75rem] sm:min-w-[12rem]',
    lg: 'w-full sm:w-64 aspect-[2/3] min-w-[12rem] sm:min-w-[16rem]'
  };

  const likedPct = film.liked_percent == null ? null : Math.round(Number(film.liked_percent));
  const primaryCountry = (Array.isArray(film.countries) ? film.countries[0] : null) || film.country || null;
  const flag = countryFlag(primaryCountry);
  const isYoutubeVariant = variant === 'youtube';
  const isLandscapeVariant = variant === 'landscape' || isYoutubeVariant;
  const youtubeGenreLabel = film.genres?.slice(0, 2).join(' / ') || 'Genre unavailable';
  const youtubeSynopsis = film.synopsis || film.tagline;
  const youtubeViews = ytViews || film.view_count;
  const formattedYoutubeViews = formatTotalViews(youtubeViews);
  const youtubeRatingLabel = likedPct != null ? `${likedPct}% liked` : 'Not rated';
  const youtubeCardHeight = fullWidth ? 'h-[360px] sm:h-[430px] lg:h-[390px]' : 'h-[350px] sm:h-[370px]';

  return (
    <div className={`relative group flex flex-col gap-3 ${isLandscapeVariant ? (fullWidth ? 'w-full' : 'w-72 sm:w-80 shrink-0') : ''}`}>
      {isLandscapeVariant ? (
        <div className={`relative flex w-full flex-col ${isYoutubeVariant ? `${youtubeCardHeight} overflow-hidden rounded-lg border border-border bg-surface shadow-sm transition duration-300 hover:-translate-y-1 hover:border-brand/50 hover:shadow-xl` : 'gap-2'}`}>
          <Link 
            to={`/films/${film.slug || film.id}`}
            title={formatFilmTitle(film.title)}
            className={`relative z-0 block aspect-video w-full shrink-0 overflow-hidden bg-surface-2/60 transition-all duration-500 hover:z-10 ${isYoutubeVariant ? 'border-b border-border' : 'rounded-lg border border-border shadow-sm group-hover:border-brand/40 group-hover:shadow-xl group-hover:shadow-brand/5'}`}
          >
            <ImageWithFallback
              src={getFilmBackdrop(film)}
              alt={formatFilmTitle(film.title)}
              className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
              fallbackType="film"
              name={formatFilmTitle(film.title)}
              loading="lazy"
              width={640}
              sizes="(max-width: 640px) 100vw, 320px"
            />
            {likedPct != null && (
              <LikedScore percent={likedPct} variant="badge" className="absolute top-2.5 left-2.5 z-20" />
            )}
            <div className="absolute inset-0 bg-black/20 group-hover:bg-black/0 transition-colors duration-300" />
            {getYoutubeId(film.youtube_watch_url) && (
              <div className="absolute inset-0 flex items-center justify-center opacity-90 group-hover:opacity-100 transition-opacity">
                <div className="w-10 h-10 rounded-full bg-brand/90 text-white flex items-center justify-center shadow-lg transition-transform group-hover:scale-110">
                  <Icon icon="solar:play-bold" className="text-lg ml-0.5" />
                </div>
              </div>
            )}
          </Link>

          <div className={isYoutubeVariant ? 'flex min-h-0 flex-1 flex-col p-3 text-left' : 'mt-1 flex flex-col px-1 text-left'}>
            <Link to={`/films/${film.slug || film.id}`}>
              <h3 
                className={`font-bold text-text-primary tracking-tight leading-snug group-hover:text-brand transition-colors ${isYoutubeVariant ? 'min-h-10 text-base line-clamp-2' : 'text-sm line-clamp-1'}`}
                title={formatFilmTitle(film.title)}
              >
                {formatFilmTitle(film.title)}
              </h3>
            </Link>

            {isYoutubeVariant ? (
              <>
                <p className="mt-1 min-h-4 line-clamp-1 text-[11px] font-semibold text-brand">
                  {youtubeGenreLabel}
                </p>
                <p className="mt-2 min-h-10 line-clamp-2 text-xs leading-relaxed text-text-secondary">
                  {youtubeSynopsis || 'Explore video details, cast, and streaming availability on MuviDB.'}
                </p>
                <div className="mt-auto flex flex-wrap items-center gap-x-2.5 gap-y-1 border-t border-border pt-3 text-[10px] font-medium text-text-muted">
                  <span className="inline-flex items-center gap-1 font-semibold text-text-primary">
                    <Icon icon="mdi:popcorn" className="text-[#FA320A]" />
                    {youtubeRatingLabel}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Icon icon="solar:clock-circle-linear" className="text-[12px]" />
                    {youtubeRuntimeLabel || 'Runtime TBA'}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Icon icon="solar:eye-linear" className="text-[12px]" />
                    {formattedYoutubeViews || 'Views unavailable'}
                  </span>
                </div>
              </>
            ) : (
              <span className="text-xs text-text-muted mt-0.5 tracking-wide line-clamp-1">
                {durationLabel}
                {!!(ytViews || film.view_count) && (
                  <>
                    <span className="mx-1.5 opacity-45">•</span>
                    <span>{formatTotalViews(ytViews || film.view_count)}</span>
                  </>
                )}
              </span>
            )}
          </div>
        </div>
      ) : (
        <Link 
          to={`/films/${film.slug || film.id}`}
          title={formatFilmTitle(film.title)}
          className={`relative block rounded-lg overflow-hidden transition-all duration-500 hover:shadow-2xl z-0 bg-surface-2/60 hover:border-brand/40 border border-border ${sizeClasses[size]}`}
        >
          <ImageWithFallback
            src={film.poster_url || film.poster}
            alt={formatFilmTitle(film.title)}
            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-[1.04]"
            fallbackType="film"
            name={formatFilmTitle(film.title)}
            loading="lazy"
            width={384}
            sizes="(max-width: 640px) 44vw, 192px"
          />

          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent opacity-60 group-hover:opacity-80 transition-opacity duration-500" />

          {likedPct != null && (
            <LikedScore percent={likedPct} variant="badge" className="absolute top-2.5 left-2.5 z-20" />
          )}

          {(film.content_type === 'series' || film.is_series_group) && (
            <div className={`absolute top-2.5 ${likedPct != null ? 'left-[4.25rem]' : 'left-2.5'} flex items-center gap-1 bg-brand text-white px-1.5 py-0.5 rounded-md shadow-lg z-20 text-[9px] font-black uppercase tracking-wider`}>
              <Icon icon={film.episodes_count > 1 ? "solar:folder-bold" : "solar:tv-bold"} className="text-white text-[9px]" />
              <span>{film.episodes_count > 1 ? `${film.episodes_count} EPS` : 'TV'}</span>
            </div>
          )}

          <div className="absolute top-2.5 right-2.5 transition-all duration-500 z-20 opacity-0 -translate-y-1 group-hover:opacity-100 group-hover:translate-y-0">
            <button
              className="bg-brand hover:bg-white text-white hover:text-brand w-7 h-7 rounded-lg transition-all duration-300 active:scale-90 shadow-xl flex items-center justify-center border border-white/10"
              onClick={(e) => {
                e.preventDefault();
                if (onAction) onAction(film);
              }}
              aria-label={actionType === 'add' ? `Add ${formatFilmTitle(film.title)} to watchlist` : `Remove ${formatFilmTitle(film.title)} from watchlist`}
            >
              <Icon icon={actionType === 'add' ? "solar:add-circle-linear" : "solar:close-circle-linear"} width="14" />
            </button>
          </div>

          <div className="absolute inset-x-0 bottom-0 p-3.5 z-20 bg-gradient-to-t from-black/95 via-black/40 to-transparent pt-10">
            <h3 className="text-white text-xs font-bold leading-tight mb-1 line-clamp-2 group-hover:text-brand transition-colors" title={formatFilmTitle(film.title)}>
              {formatFilmTitle(film.title)}
            </h3>
            <div className="flex items-center justify-between gap-2 mt-1">
              <div className="flex items-center gap-1.5 text-[10px] font-medium text-white/70">
                {flag && <span title={primaryCountry} className="text-[11px] leading-none">{flag}</span>}
                <span className="text-brand/90 font-bold">{film.year || film.release_date?.split('-')[0] || 'N/A'}</span>
                {film.genres && film.genres.length > 0 && (
                  <>
                    <span className="w-1 h-1 rounded-full bg-white/20" />
                    <span className="truncate max-w-[80px]">{film.genres[0]}</span>
                  </>
                )}
              </div>

              {activePlatforms.length > 0 && (
                <div className="flex items-center gap-1 shrink-0">
                  {activePlatforms.slice(0, 3).map(platform => (
                    <span
                      key={platform.id}
                      className={`${platform.logo ? 'bg-white' : `${platform.color} bg-black/40`} backdrop-blur-sm w-5 h-5 rounded-full flex items-center justify-center border border-white/5 overflow-hidden`}
                      title={platform.label}
                    >
                      {platform.logo
                        ? <img src={platform.logo} alt="" className="w-full h-full object-contain p-0.5" loading="lazy" />
                        : <Icon icon={platform.icon} className="text-[10px]" />}
                    </span>
                  ))}
                  {activePlatforms.length > 3 && (
                    <span className="text-[8px] font-black text-white bg-black/60 px-1 rounded-xl border border-white/10 shrink-0">
                      +{activePlatforms.length - 3}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="absolute bottom-0 left-0 right-0 h-1 bg-brand transform scale-x-0 group-hover:scale-x-100 transition-transform duration-500 origin-left z-30" />
        </Link>
      )}

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
