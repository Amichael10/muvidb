import { Link } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { Icon } from '@iconify/react';
import ImageWithFallback from '../ui/ImageWithFallback';
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

const getLetterboxdRating = (film) => {
  if (film.imdb_rating != null && film.imdb_rating > 0) {
    return Number(film.imdb_rating).toFixed(1);
  }
  if (film.tmdb_rating != null && film.tmdb_rating > 0) {
    return Number(film.tmdb_rating).toFixed(1);
  }
  if (film.audience_rating != null && film.audience_rating > 0) {
    return Number(film.audience_rating).toFixed(1);
  }
  if (film.liked_percent != null && film.liked_percent > 0) {
    return (film.liked_percent / 10).toFixed(1);
  }
  if (film.rating != null && film.rating > 0) {
    return Number(film.rating).toFixed(1);
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
      <div className="relative flex items-end pl-14 sm:pl-16 group select-none transition-transform duration-300 hover:z-20">
        {/* Giant Translucent Number in Letterboxd Style */}
        <span className="text-[130px] sm:text-[150px] font-black text-white/[0.08] group-hover:text-brand/30 select-none absolute left-0 bottom-[-18px] z-0 font-heading leading-none -translate-x-2 tracking-tighter transition-colors duration-300">
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
      nollistream: { icon: 'solar:play-circle-bold', color: 'text-[#D0A008]', label: 'Watch on NolliStream' },
      ironflix: { icon: 'solar:play-bold', color: 'text-[#D32F2F]', label: 'Watch on Ironflix' },
      docuth: { icon: 'solar:play-bold', color: 'text-[#0048A8]', label: 'Watch on Docuth' },
      ebonylife: { icon: 'solar:play-circle-bold', color: 'text-[#F8A008]', label: 'Watch on EbonyLife' },
      circuits: { icon: 'solar:clapperboard-play-bold', color: 'text-[#F0532B]', label: 'Watch on Circuits' },
      homitv: { icon: 'solar:tv-bold', color: 'text-[#6D1DDC]', label: 'Watch on HomiTV' },
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
    ? (film.episodes_count > 1
      ? `${film.episodes_count} videos`
      : (film.season_count
        ? (film.season_count === 1 ? '1 Season' : `${film.season_count} Seasons`)
        : 'TV Series'))
    : (runtimeLabel || '2h 5m');
  const youtubeRuntimeLabel = (film.content_type === 'series' || film.is_series_group) ? durationLabel : runtimeLabel;
  const ratingStar = getLetterboxdRating(film);
  const primaryCountry = (Array.isArray(film.countries) ? film.countries[0] : null) || film.country || null;
  const flag = countryFlag(primaryCountry);
  const isYoutubeVariant = variant === 'youtube';
  const isLandscapeVariant = variant === 'landscape' || isYoutubeVariant;
  const youtubeGenreLabel = film.genres?.slice(0, 2).join(' / ') || 'Genre unavailable';
  const youtubeSynopsis = film.synopsis || film.tagline;
  const youtubeViews = ytViews || film.view_count;
  const formattedYoutubeViews = formatTotalViews(youtubeViews);
  const director = film.director || film.directors?.[0] || film.primary_director || null;
  const year = film.year || film.release_date?.slice(0, 4) || null;

  // Letterboxd width sizing for portrait
  const sizeClasses = {
    sm: 'w-28 sm:w-32 min-w-[7rem] sm:min-w-[8rem]',
    md: 'w-[145px] sm:w-[175px] min-w-[145px] sm:min-w-[175px]',
    lg: 'w-[190px] sm:w-[220px] min-w-[190px] sm:min-w-[220px]'
  };

  return (
    <div className={`relative group flex flex-col transition-all duration-200 select-none ${isLandscapeVariant ? (fullWidth ? 'w-full' : 'w-72 sm:w-80 shrink-0') : sizeClasses[size]}`}>
      
      {isLandscapeVariant ? (
        /* Landscape / YouTube Letterboxd Card */
        <div className="flex flex-col gap-2 w-full">
          <Link 
            to={`/films/${film.slug || film.id}`}
            title={formatFilmTitle(film.title)}
            className="relative block aspect-video w-full shrink-0 overflow-hidden rounded-[4px] border border-white/10 group-hover:border-white/30 bg-[#14181c] shadow-md transition-all duration-300 group-hover:scale-[1.02]"
          >
            <ImageWithFallback
              src={getFilmBackdrop(film)}
              alt={formatFilmTitle(film.title)}
              className="w-full h-full object-cover"
              fallbackType="film"
              name={formatFilmTitle(film.title)}
              loading="lazy"
              width={640}
              sizes="(max-width: 640px) 100vw, 320px"
            />

            {/* Play Button Indicator */}
            <div className="absolute inset-0 bg-black/20 group-hover:bg-black/40 transition-colors flex items-center justify-center">
              <div className="w-10 h-10 rounded-full bg-black/70 group-hover:bg-brand text-white flex items-center justify-center shadow-lg border border-white/20 transition-all duration-300 transform group-hover:scale-110">
                <Icon icon="solar:play-bold" className="text-base ml-0.5" />
              </div>
            </div>

            {/* Live badges */}
            {ratingStar && (
              <div className="absolute top-2 left-2 z-10 flex items-center gap-1 bg-black/80 backdrop-blur-sm border border-amber-400/30 text-amber-400 px-1.5 py-0.5 rounded-[3px] text-[10px] font-bold">
                <span>★</span>
                <span>{ratingStar}</span>
              </div>
            )}
          </Link>

          {/* Metadata Stack Beneath Backdrop */}
          <div className="flex flex-col px-0.5 text-left">
            <Link 
              to={`/films/${film.slug || film.id}`}
              className="font-heading font-bold text-sm text-white/95 group-hover:text-brand line-clamp-1 leading-snug transition-colors"
              title={formatFilmTitle(film.title)}
            >
              {formatFilmTitle(film.title)}
            </Link>

            <div className="flex items-center justify-between text-[11px] text-white/50 mt-1 font-mono">
              <div className="flex items-center gap-1.5">
                {year && <span>{year}</span>}
                {youtubeRuntimeLabel && (
                  <>
                    <span>•</span>
                    <span>{youtubeRuntimeLabel}</span>
                  </>
                )}
              </div>
              {formattedYoutubeViews && (
                <span className="text-white/70 font-semibold">{formattedYoutubeViews}</span>
              )}
            </div>
          </div>
        </div>
      ) : (
        /* Pristine Letterboxd 2:3 Portrait Card */
        <div className="flex flex-col w-full">
          {/* Poster Art (Pure, Sacred, Unadorned 2:3) */}
          <div className="relative aspect-[2/3] w-full rounded-[4px] overflow-hidden border border-white/10 group-hover:border-white/30 bg-[#14181c] shadow-lg transition-all duration-300 group-hover:scale-[1.03] group-hover:shadow-[0_12px_28px_rgba(0,0,0,0.85)]">
            <Link 
              to={`/films/${film.slug || film.id}`}
              title={formatFilmTitle(film.title)}
              className="block w-full h-full"
            >
              <ImageWithFallback
                src={film.poster_url || film.poster}
                alt={formatFilmTitle(film.title)}
                className="w-full h-full object-cover"
                fallbackType="film"
                name={formatFilmTitle(film.title)}
                loading="lazy"
                width={384}
                sizes="(max-width: 640px) 44vw, 192px"
              />
            </Link>

            {/* Letterboxd Action Dock (Fades in on hover) */}
            <div className="absolute inset-x-0 top-0 p-2 flex items-center justify-between bg-gradient-to-b from-black/80 via-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-20">
              {/* Left pill (Series / Cinema / Country flag) */}
              <div className="flex items-center gap-1">
                {flag && <span className="text-xs">{flag}</span>}
                {(film.content_type === 'series' || film.is_series_group) && (
                  <span className="bg-brand text-white text-[8px] font-black uppercase px-1 py-0.5 rounded-[2px]">
                    TV
                  </span>
                )}
              </div>

              {/* Right Watchlist action button */}
              <button
                type="button"
                className="w-7 h-7 rounded-[3px] bg-black/80 hover:bg-brand text-white flex items-center justify-center border border-white/20 transition-all duration-150 cursor-pointer"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (onAction) onAction(film);
                }}
                title={actionType === 'add' ? `Add ${formatFilmTitle(film.title)} to watchlist` : `Remove from watchlist`}
                aria-label={actionType === 'add' ? `Add to watchlist` : `Remove from watchlist`}
              >
                <Icon icon={actionType === 'add' ? "solar:bookmark-linear" : "solar:close-circle-linear"} width="15" />
              </button>
            </div>

            {/* Central subtle hover play indicator */}
            <Link
              to={`/films/${film.slug || film.id}`}
              className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-10"
              tabIndex={-1}
              aria-hidden="true"
            >
              <div className="w-9 h-9 rounded-full bg-black/60 group-hover:bg-brand text-white flex items-center justify-center border border-white/25 shadow-xl transition-transform duration-200 transform group-hover:scale-105">
                <Icon icon="solar:play-bold" className="text-sm ml-0.5" />
              </div>
            </Link>

            {/* Bottom rating pill inside poster (only if exists and mobile or unobtrusive) */}
            {ratingStar && (
              <div className="absolute bottom-2 left-2 z-10 flex items-center gap-1 bg-black/75 backdrop-blur-sm border border-amber-400/30 text-amber-400 px-1.5 py-0.5 rounded-[3px] text-[10px] font-bold">
                <span>★</span>
                <span>{ratingStar}</span>
              </div>
            )}
          </div>

          {/* Letterboxd Typographic Stack Beneath Poster */}
          <div className="pt-2 pb-1 flex flex-col text-left">
            <Link 
              to={`/films/${film.slug || film.id}`}
              className="font-heading font-semibold text-xs sm:text-[13px] text-white/90 group-hover:text-brand line-clamp-1 leading-snug transition-colors"
              title={formatFilmTitle(film.title)}
            >
              {formatFilmTitle(film.title)}
            </Link>

            <div className="flex items-center justify-between text-[11px] text-white/50 font-mono mt-0.5">
              <div className="flex items-center gap-1.5 truncate">
                {year && <span>{year}</span>}
                {director && (
                  <>
                    <span className="opacity-40">•</span>
                    <span className="truncate max-w-[90px]">{director}</span>
                  </>
                )}
                {!director && film.genres?.[0] && (
                  <>
                    <span className="opacity-40">•</span>
                    <span className="truncate max-w-[80px]">{film.genres[0]}</span>
                  </>
                )}
              </div>

              {/* Mini Platform Badges */}
              {activePlatforms.length > 0 && (
                <div className="flex items-center gap-1 shrink-0 ml-1">
                  {activePlatforms.slice(0, 2).map(platform => (
                    <span
                      key={platform.id}
                      className="w-3.5 h-3.5 flex items-center justify-center rounded-[2px] opacity-75 group-hover:opacity-100 transition-opacity"
                      title={platform.label}
                    >
                      {platform.logo ? (
                        <img src={platform.logo} alt="" className="w-full h-full object-contain" loading="lazy" />
                      ) : (
                        <Icon icon={platform.icon} className={`text-[10px] ${platform.color}`} />
                      )}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Watched Toggle (if requested) */}
      {showWatchedToggle && (
        <button 
          onClick={() => onToggleWatched && onToggleWatched(film)}
          className="flex items-center gap-1.5 mt-1 text-[10px] font-mono text-white/50 hover:text-brand transition-colors group/watched w-fit pl-0.5"
        >
          <div className={`w-3.5 h-3.5 rounded-[2px] border flex items-center justify-center transition-all ${isWatched ? 'bg-brand border-brand' : 'border-white/20 bg-white/5'}`}>
            {isWatched && (
              <Icon icon="solar:check-read-linear" className="text-white text-[9px]" />
            )}
          </div>
          <span className={isWatched ? 'text-brand' : ''}>Logged</span>
        </button>
      )}
    </div>
  );
}
