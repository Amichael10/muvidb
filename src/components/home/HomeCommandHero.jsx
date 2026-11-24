import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from '@iconify/react';
import ImageWithFallback from '../ui/ImageWithFallback';
import { formatFilmTitle } from '../../utils/format';
import { getFilmBackdrop } from '../../lib/filmImages';

const QUICK_JUMPS = [
  { label: 'In Cinemas (18+ Locations)', to: '/showtimes', icon: 'solar:ticket-bold', accent: 'text-emerald-400' },
  { label: 'Free on YouTube', to: '/watch/youtube', icon: 'simple-icons:youtube', accent: 'text-[#FF0000]' },
  { label: 'Box Office Leaderboard', to: '/box-office', icon: 'solar:chart-square-bold', accent: 'text-amber-400' },
  { label: 'Live Stage Plays', to: '/plays', icon: 'solar:mask-hamsa-bold', accent: 'text-purple-400' },
  { label: 'Title Registry', to: '/title-checker', icon: 'solar:shield-check-bold', accent: 'text-sky-400' },
  { label: 'Claim Industry Profile', to: '/claim', icon: 'solar:verified-check-bold', accent: 'text-brand' },
];

const formatGross = (amount) => {
  const n = Number(amount);
  if (!Number.isFinite(n) || n <= 0) return '—';
  if (n >= 1_000_000_000) return `₦${(n / 1_000_000_000).toFixed(2).replace(/\.?0+$/, '')}B`;
  if (n >= 1_000_000) return `₦${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
  return `₦${Math.round(n / 1_000)}K`;
};

const getScore = (film) => {
  if (!film) return null;
  if (film.imdb_rating > 0) return Number(film.imdb_rating).toFixed(1);
  if (film.tmdb_rating > 0) return Number(film.tmdb_rating).toFixed(1);
  if (film.audience_rating > 0) return Number(film.audience_rating).toFixed(1);
  if (film.liked_percent > 0) return (Number(film.liked_percent) / 10).toFixed(1);
  return null;
};

// Fallback high-grade demo data for Tri-Modal African Commercial Chart
const DEMO_CINEMA_LEADERS = [
  {
    id: 'a-tribe-called-judah',
    slug: 'a-tribe-called-judah',
    title: 'A Tribe Called Judah',
    year: 2023,
    distributor: 'FilmOne Studios',
    box_office_domestic: 1420000000,
    poster_url: 'https://m.media-amazon.com/images/M/MV5BMjA4ZGY1YjEtZDUxNS00Y2UzLTlmNWItOGY3ZjU5ZTk2ZjM1XkEyXkFqcGc@._V1_FMjpg_UX1000_.jpg',
  },
  {
    id: 'beast-of-two-worlds',
    slug: 'beast-of-two-worlds',
    title: 'Beast of Two Worlds (Ajakaju)',
    year: 2024,
    distributor: 'Anthill Studios',
    box_office_domestic: 312000000,
    poster_url: 'https://m.media-amazon.com/images/M/MV5BZDU1ODVkMjItYmFhNy00YmM1LWI0YmItMDcyZGE0ZDBiOGE2XkEyXkFqcGc@._V1_FMjpg_UX1000_.jpg',
  },
  {
    id: 'farmers-bride',
    slug: 'farmers-bride',
    title: "Farmer's Bride",
    year: 2024,
    distributor: 'FilmOne Studios',
    box_office_domestic: 248000000,
    poster_url: 'https://m.media-amazon.com/images/M/MV5BMmM4Y2Y0YTctZWY2Yy00ZjMwLThlNTItZjFlZjYwZTkzNTlkXkEyXkFqcGc@._V1_FMjpg_UX1000_.jpg',
  },
  {
    id: 'the-return-of-makunse',
    slug: 'the-return-of-makunse',
    title: 'The Return of Makunse',
    year: 2024,
    distributor: 'Silverbird Film Distribution',
    box_office_domestic: 185000000,
    poster_url: 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?auto=format&fit=crop&w=400&q=80',
  },
  {
    id: 'seven-doors-premiere',
    slug: 'seven-doors',
    title: 'Seven Doors',
    year: 2024,
    distributor: 'Pound Road Media',
    box_office_domestic: 145000000,
    poster_url: 'https://m.media-amazon.com/images/M/MV5BODg3ZjNmOTItZTBkNi00ODFjLWIwY2ItOTU1ZWMwMDI1NWIxXkEyXkFqcGc@._V1_FMjpg_UX1000_.jpg',
  },
];

const DEMO_THEATRE_LEADERS = [
  {
    id: 'gayinas-pound-of-flesh-2026',
    slug: 'gayinas-pound-of-flesh-2026',
    title: "Gayina's Pound of Flesh",
    venue: 'National Theatre, Accra',
    producer: 'Image Bureau Gh. Ltd',
    metric: 'GH¢100 – 200 VIP',
    status: 'Live Run',
    poster_url: 'https://res.cloudinary.com/dg8kkh3xx/image/upload/v1786096697/events/dlaqqsw5j1axg0f94xbp.jpg',
  },
  {
    id: 'honey-trap',
    slug: 'honey-trap',
    title: 'Honey Trap',
    venue: 'The National Theatre',
    producer: 'Roverman Productions',
    metric: 'GH¢150 Standard',
    status: 'Live Run',
    poster_url: 'https://korba-website-assets.s3.eu-west-1.amazonaws.com/projects/roverman/honey_trap.jpg',
  },
  {
    id: 'voices-in-my-head',
    slug: 'voices-in-my-head',
    title: 'Voices in My Head',
    venue: 'The National Theatre',
    producer: 'Roverman Productions',
    metric: 'Uncle Ebo Whyte Classic',
    status: 'Encore Run',
    poster_url: 'https://korba-website-assets.s3.eu-west-1.amazonaws.com/projects/roverman/voices_in_my_head.jpg',
  },
  {
    id: 'saro-the-musical',
    slug: 'saro-the-musical',
    title: 'Saro The Musical: Homecoming',
    venue: 'Terra Kulture Arena, Lagos',
    producer: 'BAP Productions',
    metric: '₦15K – ₦50K VIP',
    status: 'Holiday Run',
    poster_url: 'https://images.unsplash.com/photo-1507676184212-d03ab07a01bf?auto=format&fit=crop&w=400&q=80',
  },
  {
    id: 'love-on-the-ropes',
    slug: 'love-on-the-ropes',
    title: 'Love on the Ropes',
    venue: 'The National Theatre',
    producer: 'Roverman Productions',
    metric: 'Commercial Hit',
    status: 'Archived Run',
    poster_url: 'https://korba-website-assets.s3.eu-west-1.amazonaws.com/projects/roverman/roverman_logo.png',
  },
];

const DEMO_YOUTUBE_LEADERS = [
  {
    id: 'something-like-gold',
    slug: 'something-like-gold',
    title: 'Something Like Gold (Digital)',
    channel: 'Ruth Kadiri 247',
    views: '18.4M Views',
    badge: 'Trending #1',
    poster_url: 'https://images.unsplash.com/photo-1536440136628-849c177e76a1?auto=format&fit=crop&w=400&q=80',
    to: '/watch/youtube',
  },
  {
    id: 'aiyetoro-town-return',
    slug: 'aiyetoro-town',
    title: 'Aiyetoro Town: The Return',
    channel: 'SceneOne TV',
    views: '14.2M Views',
    badge: '100% Free',
    poster_url: 'https://images.unsplash.com/photo-1518676590629-3dcbd9c5a5c9?auto=format&fit=crop&w=400&q=80',
    to: '/watch/youtube',
  },
  {
    id: 'anike-the-vow',
    slug: 'anike-the-vow',
    title: 'Anike: The Vow',
    channel: 'Bimbo Ademoye TV',
    views: '9.8M Views',
    badge: 'Breakout Hit',
    poster_url: 'https://images.unsplash.com/photo-1485846234645-a62644f84728?auto=format&fit=crop&w=400&q=80',
    to: '/watch/youtube',
  },
  {
    id: 'the-secret-maid',
    slug: 'the-secret-maid',
    title: 'The Secret Maid',
    channel: 'Uche Nancy TV',
    views: '8.1M Views',
    badge: 'Viral Romance',
    poster_url: 'https://images.unsplash.com/photo-1524712245354-2c4e5e7121c0?auto=format&fit=crop&w=400&q=80',
    to: '/watch/youtube',
  },
  {
    id: 'street-kid-millionaire',
    slug: 'street-kid-millionaire',
    title: 'Street Kid Millionaire',
    channel: 'Omoni Oboli TV',
    views: '6.5M Views',
    badge: 'Drama Hit',
    poster_url: 'https://images.unsplash.com/photo-1478720568477-152d9b164e26?auto=format&fit=crop&w=400&q=80',
    to: '/watch/youtube',
  },
];

export default function HomeCommandHero({
  featuredFilms = [],
  boxOfficeRecent = [],
  boxOfficeAllTime = [],
  isLoadingHero = false,
  isLoadingBoxOffice = false,
  stats = {},
}) {
  const [slideIdx, setSlideIdx] = useState(0);

  // TRI-MODAL COMMERCIAL CONTROLLER: 'cinema' | 'theatre' | 'youtube'
  const [commercialTab, setCommercialTab] = useState('cinema');

  // Dynamic Year Context: e.g. '2026' with fallback logic
  const [cinemaYearTab, setCinemaYearTab] = useState('recent'); // 'recent' (2026 Season) | 'allTime'

  const slides = featuredFilms.slice(0, 5);
  const activeFilm = slides[slideIdx] || slides[0] || null;

  // Active Cinema box office dataset
  const activeCinemaList =
    cinemaYearTab === 'recent'
      ? boxOfficeRecent.length > 0
        ? boxOfficeRecent.slice(0, 5)
        : DEMO_CINEMA_LEADERS
      : boxOfficeAllTime.length > 0
        ? boxOfficeAllTime.slice(0, 5)
        : DEMO_CINEMA_LEADERS;

  useEffect(() => {
    if (slides.length <= 1) return undefined;
    const timer = window.setInterval(() => {
      setSlideIdx((prev) => (prev + 1) % slides.length);
    }, 9000);
    return () => window.clearInterval(timer);
  }, [slides.length]);

  const score = getScore(activeFilm);
  const activeTitle = activeFilm ? formatFilmTitle(activeFilm.title) : '';
  const activePath = activeFilm ? `/films/${activeFilm.slug || activeFilm.id}` : '/browse';

  // Dynamic Year Label calculation
  const currentYear = new Date().getFullYear();
  const cinemaSeasonLabel = `${currentYear} Season`;

  return (
    <section className="relative pt-[84px] pb-8 md:pt-[96px] md:pb-12 border-b border-hairline overflow-hidden">
      {/* Subtle architectural glow */}
      <div
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{
          background:
            'radial-gradient(ellipse 65% 50% at 15% 0%, color-mix(in srgb, var(--color-brand) 16%, transparent), transparent 65%)',
        }}
      />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
        
        {/* ─── TOP COMMAND BAR (CLEANED UP: ZERO REDUNDANT HERO SEARCH BAR) ─── */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div className="space-y-1.5 max-w-2xl">
            <div className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.22em] text-brand">
              <span className="w-1.5 h-1.5 rounded-full bg-brand" />
              <span>African Film Database · Theatrical Showtimes · Live Commercial Charts</span>
            </div>
            <h1 className="font-heading font-bold text-2xl sm:text-3xl md:text-[2.2rem] text-text-primary tracking-tight leading-[1.12]">
              Find where to watch African cinema — and who made it.
            </h1>
            <p className="text-xs sm:text-sm text-text-muted">
              Live cinema showtimes in 18+ locations, verified creator casting credits, and commercial box office intelligence.
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <Link
              to="/showtimes"
              className="px-4 py-2 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-400 font-bold text-xs inline-flex items-center gap-1.5 transition-all shadow-sm"
            >
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>Now in 18+ Cinema Locations</span>
            </Link>
          </div>
        </div>

        {/* Quick Utility Jumps */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide -mx-4 px-4 sm:mx-0 sm:px-0">
          {QUICK_JUMPS.map((item) => (
            <Link
              key={item.label}
              to={item.to}
              className="shrink-0 inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border border-border/80 bg-surface hover:border-brand/60 hover:bg-surface-2 text-xs font-semibold text-text-primary transition-all"
            >
              <Icon icon={item.icon} className={`text-sm ${item.accent}`} />
              <span>{item.label}</span>
            </Link>
          ))}
        </div>

        {/* Asymmetric 12-Col Command Grid: Featured Release (8) + Tri-Modal Commercial Chart (4) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
          
          {/* ─── LEFT: CINEMATIC SPOTLIGHT HERO (8 COLS) ─── */}
          <div className="lg:col-span-7 xl:col-span-8 relative rounded-2xl overflow-hidden border border-border/80 bg-surface min-h-[360px] sm:min-h-[420px] flex flex-col justify-end group">
            {isLoadingHero && !activeFilm ? (
              <div className="absolute inset-0 bg-surface-2 animate-pulse" />
            ) : activeFilm ? (
              <>
                <ImageWithFallback
                  src={getFilmBackdrop(activeFilm) || activeFilm.poster_url}
                  alt={activeTitle}
                  fallbackType="film"
                  name={activeTitle}
                  className="absolute inset-0 w-full h-full object-cover object-center transition-transform duration-700 group-hover:scale-[1.02]"
                  width={1200}
                  sizes="(max-width: 1024px) 100vw, 66vw"
                  fetchPriority="high"
                />
                {/* Scrims */}
                <div className="absolute inset-0 bg-gradient-to-t from-[#080A0D] via-[#080A0D]/70 to-[#080A0D]/20" />
                <div className="absolute inset-0 bg-gradient-to-r from-[#080A0D]/85 via-[#080A0D]/30 to-transparent" />

                <div className="relative z-10 p-5 sm:p-7 md:p-8 flex flex-col gap-3 max-w-2xl">
                  {/* Status / Meta Row */}
                  <div className="flex flex-wrap items-center gap-2 text-[11px] font-bold">
                    {activeFilm.is_in_cinemas ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 uppercase tracking-wider text-[10px]">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                        In Cinemas (18+ Locations)
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-brand/20 border border-brand/40 text-orange-200 uppercase tracking-wider text-[10px]">
                        Featured African Release
                      </span>
                    )}

                    {activeFilm.year && (
                      <span className="text-white/80">{activeFilm.year}</span>
                    )}
                    {activeFilm.genres?.length > 0 && (
                      <span className="text-white/70">
                        · {activeFilm.genres.slice(0, 2).join(' / ')}
                      </span>
                    )}
                    {score && (
                      <span className="inline-flex items-center gap-1 text-amber-300 font-bold">
                        · ★ {score}
                      </span>
                    )}
                  </div>

                  {/* Title */}
                  <Link to={activePath} className="group/title">
                    <h2 className="font-heading font-black text-2xl sm:text-3xl md:text-4xl text-white tracking-tight leading-tight group-hover/title:text-brand transition-colors">
                      {activeTitle}
                    </h2>
                  </Link>

                  {/* Synopsis / Tagline */}
                  {(activeFilm.synopsis || activeFilm.tagline) && (
                    <p className="text-xs sm:text-sm text-white/80 line-clamp-2 max-w-xl leading-relaxed">
                      {activeFilm.tagline || activeFilm.synopsis}
                    </p>
                  )}

                  {/* Primary CTA Cluster */}
                  <div className="flex flex-wrap items-center gap-3 pt-2">
                    <Link
                      to={activePath}
                      className="px-5 py-2.5 rounded-xl bg-brand hover:bg-brand-hover text-white text-xs font-bold tracking-wide transition-all shadow-md inline-flex items-center gap-2 cursor-pointer active:scale-95"
                    >
                      <Icon icon="solar:clapperboard-play-bold" className="text-sm" />
                      <span>Explore Film &amp; Cast</span>
                    </Link>

                    {activeFilm.is_in_cinemas && (
                      <Link
                        to={`/showtimes?film=${encodeURIComponent(activeFilm.slug || activeFilm.id)}`}
                        className="px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-white text-xs font-bold transition-all inline-flex items-center gap-1.5 backdrop-blur-md"
                      >
                        <Icon icon="solar:ticket-bold" className="text-sm text-emerald-400" />
                        <span>Find Showtimes</span>
                      </Link>
                    )}

                    {/* Carousel Thumbnail Pager */}
                    {slides.length > 1 && (
                      <div className="flex items-center gap-1.5 sm:gap-2 ml-auto">
                        {slides.map((s, idx) => {
                          const isActive = idx === slideIdx;
                          const thumbUrl = s.poster_url || s.poster || getFilmBackdrop(s);
                          return (
                            <button
                              key={s.id}
                              type="button"
                              onClick={() => setSlideIdx(idx)}
                              aria-label={`Show ${s.title || `slide ${idx + 1}`}`}
                              title={s.title}
                              className={`relative w-8 h-8 sm:w-9 sm:h-9 rounded-lg overflow-hidden border transition-all cursor-pointer ${
                                isActive
                                  ? 'border-brand ring-2 ring-brand/50 scale-105 shadow-md shadow-black/50 opacity-100'
                                  : 'border-white/20 opacity-50 hover:opacity-90 hover:border-white/40'
                              }`}
                            >
                              <img
                                src={thumbUrl}
                                alt={s.title}
                                className="w-full h-full object-cover"
                                loading="lazy"
                              />
                              {isActive && (
                                <div className="absolute inset-0 bg-brand/10 pointer-events-none" />
                              )}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </>
            ) : null}
          </div>

          {/* ─── RIGHT: TRI-MODAL AFRICAN COMMERCIAL CHART (4 COLS) ─── */}
          <div className="lg:col-span-5 xl:col-span-4 rounded-2xl border border-border/80 bg-surface p-4 sm:p-5 flex flex-col justify-between gap-4 shadow-sm">
            <div className="space-y-3.5">
              
              {/* Header Title & Subtext (Single Straight Line Season/All-Time Button) */}
              <div className="flex items-center justify-between gap-2 border-b border-hairline pb-3 min-w-0 flex-nowrap">
                <div className="min-w-0 flex-1 overflow-hidden">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-400 flex items-center gap-1.5 truncate">
                    <Icon icon="solar:cup-star-bold" className="text-xs shrink-0" />
                    <span className="truncate">Commercial Intelligence</span>
                  </p>
                  <h2 className="font-heading font-black text-sm sm:text-base text-text-primary mt-0.5 truncate">
                    African Creative Charts
                  </h2>
                </div>

                {/* Cinema Year Toggle (Guaranteed Single Straight Line - Never Wraps) */}
                {commercialTab === 'cinema' && (
                  <div className="shrink-0 min-w-max flex items-center rounded-lg border border-border bg-surface-2 p-0.5 text-[10px] font-bold whitespace-nowrap select-none flex-nowrap">
                    <button
                      type="button"
                      onClick={() => setCinemaYearTab('recent')}
                      className={`px-2.5 sm:px-3 py-1.5 rounded-md transition-colors cursor-pointer whitespace-nowrap inline-flex items-center justify-center shrink-0 min-w-max leading-none select-none flex-nowrap ${
                        cinemaYearTab === 'recent'
                          ? 'bg-amber-500 text-black font-black shadow-xs'
                          : 'text-text-muted hover:text-text-primary'
                      }`}
                      title="Current / Latest active tracking year"
                    >
                      <span className="whitespace-nowrap inline-block shrink-0 min-w-max leading-none">{cinemaSeasonLabel}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setCinemaYearTab('allTime')}
                      className={`px-2.5 sm:px-3 py-1.5 rounded-md transition-colors cursor-pointer whitespace-nowrap inline-flex items-center justify-center shrink-0 min-w-max leading-none select-none flex-nowrap ${
                        cinemaYearTab === 'allTime'
                          ? 'bg-amber-500 text-black font-black shadow-xs'
                          : 'text-text-muted hover:text-text-primary'
                      }`}
                    >
                      <span className="whitespace-nowrap inline-block shrink-0 min-w-max leading-none">All-Time</span>
                    </button>
                  </div>
                )}
              </div>

              {/* ─── APP-LIKE 2-WAY SEGMENTED CONTROL (CINEMA & YOUTUBE) ─── */}
              <div className="grid grid-cols-2 gap-1 bg-surface-2 p-1 rounded-xl border border-border/70 select-none">
                <button
                  type="button"
                  onClick={() => setCommercialTab('cinema')}
                  className={`flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    commercialTab === 'cinema'
                      ? 'bg-amber-500 text-black shadow-sm font-black'
                      : 'text-text-secondary hover:text-text-primary'
                  }`}
                >
                  <Icon icon="solar:clapperboard-play-bold" className="text-xs shrink-0" />
                  <span className="truncate">Cinema (₦)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setCommercialTab('youtube')}
                  className={`flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    commercialTab === 'youtube'
                      ? 'bg-red-600 text-white shadow-sm font-black'
                      : 'text-text-secondary hover:text-text-primary'
                  }`}
                >
                  <Icon icon="simple-icons:youtube" className="text-xs shrink-0" />
                  <span className="truncate">YouTube (▶)</span>
                </button>
              </div>

              {/* ─── TAB 1: CINEMA BOX OFFICE LEADERBOARD ─── */}
              {commercialTab === 'cinema' && (
                <div className="divide-y divide-hairline animate-in fade-in duration-200">
                  {activeCinemaList.map((film, idx) => {
                    const title = formatFilmTitle(film.title);
                    return (
                      <Link
                        key={film.id}
                        to={`/films/${film.slug || film.id}`}
                        className="group flex items-center gap-3 py-2 first:pt-1 last:pb-1 hover:bg-surface-2/60 -mx-2 px-2 rounded-lg transition-colors"
                      >
                        <span
                          className={`w-5 text-center font-heading font-black text-sm shrink-0 ${
                            idx === 0 ? 'text-amber-400' : 'text-text-muted'
                          }`}
                        >
                          {idx + 1}
                        </span>

                        <div className="w-8 h-11 rounded-md overflow-hidden bg-surface-2 border border-hairline shrink-0">
                          <ImageWithFallback
                            src={film.poster_url}
                            alt={title}
                            fallbackType="film"
                            name={title}
                            className="w-full h-full object-cover"
                            width={64}
                            loading="lazy"
                          />
                        </div>

                        <div className="min-w-0 flex-1">
                          <p className="font-heading font-bold text-xs text-text-primary group-hover:text-brand truncate transition-colors">
                            {title}
                          </p>
                          <p className="text-[10px] text-text-muted truncate">
                            {film.year || 'Nollywood'}
                            {film.distributor ? ` · ${film.distributor}` : ''}
                          </p>
                        </div>

                        <span className="shrink-0 font-mono font-bold text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-md">
                          {formatGross(film.box_office_domestic)}
                        </span>
                      </Link>
                    );
                  })}
                </div>
              )}

              {/* ─── TAB 2: YOUTUBE NOLLYWOOD DIGITAL HITS ─── */}
              {commercialTab === 'youtube' && (
                <div className="divide-y divide-hairline animate-in fade-in duration-200">
                  {DEMO_YOUTUBE_LEADERS.map((yt, idx) => (
                    <Link
                      key={yt.id}
                      to={yt.to || '/watch/youtube'}
                      className="group flex items-center gap-3 py-2 first:pt-1 last:pb-1 hover:bg-surface-2/60 -mx-2 px-2 rounded-lg transition-colors"
                    >
                      <span
                        className={`w-5 text-center font-heading font-black text-sm shrink-0 ${
                          idx === 0 ? 'text-red-500' : 'text-text-muted'
                        }`}
                      >
                        {idx + 1}
                      </span>

                      <div className="w-8 h-11 rounded-md overflow-hidden bg-surface-2 border border-hairline shrink-0">
                        <ImageWithFallback
                          src={yt.poster_url}
                          alt={yt.title}
                          fallbackType="film"
                          name={yt.title}
                          className="w-full h-full object-cover"
                          width={64}
                          loading="lazy"
                        />
                      </div>

                      <div className="min-w-0 flex-1">
                        <p className="font-heading font-bold text-xs text-text-primary group-hover:text-red-400 truncate transition-colors">
                          {yt.title}
                        </p>
                        <p className="text-[10px] text-text-muted truncate">
                          {yt.channel}
                        </p>
                      </div>

                      <span className="shrink-0 font-mono font-bold text-xs text-red-400 bg-red-600/10 border border-red-500/20 px-2 py-0.5 rounded-md flex items-center gap-1">
                        <Icon icon="solar:play-bold" className="text-[10px]" />
                        <span>{yt.views}</span>
                      </span>
                    </Link>
                  ))}
                </div>
              )}

            </div>

            {/* Dynamic Bottom CTA based on active tab */}
            <Link
              to={
                commercialTab === 'youtube'
                  ? '/watch/youtube'
                  : '/box-office'
              }
              className="flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-surface-2 hover:bg-surface-3 border border-hairline text-xs font-bold text-text-primary hover:text-brand transition-colors"
            >
              <span>
                {commercialTab === 'youtube'
                  ? 'Explore All YouTube Nollywood'
                  : 'Full Nigerian Box Office Tracker'}
              </span>
              <Icon icon="solar:alt-arrow-right-linear" className="w-4 h-4" />
            </Link>
          </div>

        </div>
      </div>
    </section>
  );
}
