import React, { useState, useEffect, useMemo } from 'react';
import { Link, useLoaderData, useSearchParams } from 'react-router';
import { Icon } from '@iconify/react';
import { supabase } from '../lib/supabase';
import SEO from '../components/SEO';
import ImageWithFallback from '../components/ui/ImageWithFallback';
import BoxOfficeBreakdownModal from '../components/film/BoxOfficeBreakdownModal';
import YouTubeBreakdownModal from '../components/film/YouTubeBreakdownModal';
import {
  calculateYoutubeBoxOffice,
  calculateStreamingVelocity,
  formatCompactCurrency,
  parseRuntimeMinutes,
  USD_TO_NGN,
} from '../lib/youtubeBoxOffice';
import { formatPersonName, formatViews } from '../utils/format';

function formatNaira(amount) {
  if (!amount || isNaN(amount)) return '—';
  const num = Number(amount);
  if (num >= 1_000_000_000) {
    return `₦${(num / 1_000_000_000).toFixed(2)} Billion`;
  }
  if (num >= 1_000_000) {
    return `₦${(num / 1_000_000).toFixed(1)} Million`;
  }
  return `₦${num.toLocaleString('en-NG')}`;
}

export default function BoxOffice() {
  const loaderData = useLoaderData();
  const [searchParams, setSearchParams] = useSearchParams();

  // Active section: 'cinema' | 'plays' | 'youtube'
  const initialSection = searchParams.get('section') || 'cinema';
  const [activeSection, setActiveSection] = useState(
    ['cinema', 'plays', 'youtube'].includes(initialSection) ? initialSection : 'cinema'
  );

  // Keep activeSection in sync when URL searchParams change
  useEffect(() => {
    const sec = searchParams.get('section');
    if (sec && ['cinema', 'plays', 'youtube'].includes(sec)) {
      setActiveSection(sec);
    } else if (!sec) {
      setActiveSection('cinema');
    }
  }, [searchParams]);

  const seeded = !!loaderData?.seeded && (loaderData.films?.length ?? 0) > 0;

  const [films, setFilms] = useState(loaderData?.films ?? []);
  const [plays, setPlays] = useState(loaderData?.plays ?? []);
  const [youtubeFilms, setYoutubeFilms] = useState(loaderData?.youtubeFilms ?? []);
  const [loading, setLoading] = useState(false);

  const [selectedFilmForModal, setSelectedFilmForModal] = useState(null);
  const [selectedYoutubeFilmForModal, setSelectedYoutubeFilmForModal] = useState(null);
  const [cinemaTab, setCinemaTab] = useState('all'); // 'all' | 'billion' | '2026' | '2025' | '2024' | '2023'
  const [playsTab, setPlaysTab] = useState('all');   // 'all' | 'top-tier' | '2026' | '2025'
  const [youtubeTab, setYoutubeTab] = useState('all'); // 'all' | '10m' | '5m' | '2026' | '2025' | '2024'
  const [searchQuery, setSearchQuery] = useState('');

  // Sync state if loaderData provides or updates datasets
  useEffect(() => {
    if (loaderData?.films?.length) setFilms(loaderData.films);
    if (loaderData?.plays?.length) setPlays(loaderData.plays);
    if (loaderData?.youtubeFilms?.length) setYoutubeFilms(loaderData.youtubeFilms);
  }, [loaderData]);

  // Sync active section to URL params
  const handleSectionChange = (section) => {
    setActiveSection(section);
    setSearchQuery('');
    if (section === 'cinema') setCinemaTab('all');
    if (section === 'plays') setPlaysTab('all');
    if (section === 'youtube') setYoutubeTab('all');
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (section === 'cinema') {
          next.delete('section');
        } else {
          next.set('section', section);
        }
        return next;
      },
      { replace: true }
    );
  };

  useEffect(() => {
    async function fetchMissingData() {
      const needFilms = films.length === 0;
      const needPlays = plays.length === 0;
      const needYt = youtubeFilms.length === 0;

      if (!needFilms && !needPlays && !needYt) return;

      setLoading(true);
      try {
        const promises = [];
        if (needFilms) {
          promises.push(
            supabase
              .from('films')
              .select(`
                id,
                title,
                slug,
                year,
                poster_url,
                backdrop_url,
                genres,
                box_office_domestic,
                box_office_opening_weekend,
                box_office_currency,
                distributor,
                streaming_links,
                credits (
                  role,
                  person:people (
                    id,
                    name
                  )
                ),
                film_companies (
                  role,
                  company:companies (
                    id,
                    name
                  )
                )
              `)
              .gt('box_office_domestic', 0)
              .order('box_office_domestic', { ascending: false })
              .then(res => { if (res.data) setFilms(res.data); })
          );
        }

        if (needPlays) {
          promises.push(
            supabase
              .from('plays')
              .select(`
                id,
                title,
                slug,
                year,
                poster_url,
                banner_url,
                venue,
                city,
                playwright,
                director,
                producer,
                run_start_date,
                run_end_date,
                box_office_domestic,
                box_office_tickets_sold,
                box_office_currency,
                box_office_source,
                box_office_metrics
              `)
              .gt('box_office_domestic', 0)
              .order('box_office_domestic', { ascending: false })
              .then(res => { if (res.data) setPlays(res.data); })
          );
        }

        if (needYt) {
          promises.push(
            supabase
              .from('films')
              .select(`
                id,
                title,
                slug,
                year,
                poster_url,
                backdrop_url,
                genres,
                view_count,
                runtime_minutes,
                duration,
                language,
                release_date,
                liked_percent,
                source_video_id,
                youtube_watch_url,
                credits (
                  role,
                  person:people (
                    id,
                    name
                  )
                )
              `)
              .gt('view_count', 0)
              .order('view_count', { ascending: false })
              .limit(100)
              .then(res => { if (res.data) setYoutubeFilms(res.data); })
          );
        }

        await Promise.all(promises);
      } catch (err) {
        console.error('Failed to load box office data:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchMissingData();
  }, []);

  // Compute key stats for Cinema
  const totalCinemaGross = useMemo(() => {
    return films.reduce((acc, f) => acc + (Number(f.box_office_domestic) || 0), 0);
  }, [films]);

  const billionClubFilms = useMemo(() => {
    return films.filter((f) => Number(f.box_office_domestic) >= 1_000_000_000);
  }, [films]);

  const topCinemaFilm = films[0] || null;

  // Compute key stats for Plays
  const totalPlaysGross = useMemo(() => {
    return plays.reduce((acc, p) => acc + (Number(p.box_office_domestic) || 0), 0);
  }, [plays]);

  const totalTicketsSold = useMemo(() => {
    return plays.reduce((acc, p) => acc + (Number(p.box_office_tickets_sold) || 0), 0);
  }, [plays]);

  const topPlay = plays[0] || null;

  // Compute key stats for YouTube (ViewStats-inspired)
  const totalYoutubeViews = useMemo(() => {
    return youtubeFilms.reduce((acc, y) => acc + (Number(y.view_count) || 0), 0);
  }, [youtubeFilms]);

  const totalYoutubeEstimatedGross = useMemo(() => {
    let sumNgn = 0;
    let sumUsd = 0;
    youtubeFilms.forEach((film) => {
      const est = calculateYoutubeBoxOffice({
        viewCount: Number(film.view_count || 0),
        runtimeMinutes: film.runtime_minutes || film.duration,
        language: film.language,
        title: film.title,
      });
      sumNgn += (est.lowNgn + est.highNgn) / 2;
      sumUsd += (est.lowUsd + est.highUsd) / 2;
    });
    return { sumNgn, sumUsd };
  }, [youtubeFilms]);

  const tenMillionClub = useMemo(() => {
    return youtubeFilms.filter((y) => Number(y.view_count) >= 10_000_000);
  }, [youtubeFilms]);

  const topYoutubeFilm = youtubeFilms[0] || null;

  // Filtered Cinema Films
  const filteredFilms = useMemo(() => {
    return films.filter((film) => {
      const filmYear = Number(film.year) || (film.release_date ? new Date(film.release_date).getFullYear() : null);
      if (cinemaTab === 'billion') {
        if (Number(film.box_office_domestic) < 1_000_000_000) return false;
      } else if (cinemaTab === '2026') {
        if (filmYear !== 2026) return false;
      } else if (cinemaTab === '2025') {
        if (filmYear !== 2025) return false;
      } else if (cinemaTab === '2024') {
        if (filmYear !== 2024) return false;
      } else if (cinemaTab === '2023') {
        if (filmYear !== 2023) return false;
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesTitle = film.title?.toLowerCase().includes(q);
        const directorName = film.director || film.credits?.find((c) => c.role?.toLowerCase() === 'director')?.person?.name;
        const matchesDirector = directorName?.toLowerCase().includes(q);
        if (!matchesTitle && !matchesDirector) return false;
      }

      return true;
    });
  }, [films, cinemaTab, searchQuery]);

  // Filtered Stage Plays
  const filteredPlays = useMemo(() => {
    return plays.filter((play) => {
      const gross = Number(play.box_office_domestic || 0);
      const playYear = Number(play.year) || (play.run_start_date ? new Date(play.run_start_date).getFullYear() : null);
      if (playsTab === 'top-tier') {
        if (gross < 5_000_000) return false;
      } else if (playsTab === '2026') {
        if (playYear !== 2026) return false;
      } else if (playsTab === '2025') {
        if (playYear !== 2025) return false;
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesTitle = play.title?.toLowerCase().includes(q);
        const matchesVenue = play.venue?.toLowerCase().includes(q);
        const matchesDirector = play.director?.toLowerCase().includes(q);
        const matchesPlaywright = play.playwright?.toLowerCase().includes(q);
        if (!matchesTitle && !matchesVenue && !matchesDirector && !matchesPlaywright) return false;
      }

      return true;
    });
  }, [plays, playsTab, searchQuery]);

  // Filtered YouTube Films
  const filteredYoutube = useMemo(() => {
    return youtubeFilms.filter((film) => {
      const views = Number(film.view_count || 0);
      const ytYear = Number(film.year) || (film.release_date ? new Date(film.release_date).getFullYear() : null);
      if (youtubeTab === '10m') {
        if (views < 10_000_000) return false;
      } else if (youtubeTab === '5m') {
        if (views < 5_000_000) return false;
      } else if (youtubeTab === '2026') {
        if (ytYear !== 2026) return false;
      } else if (youtubeTab === '2025') {
        if (ytYear !== 2025) return false;
      } else if (youtubeTab === '2024') {
        if (ytYear !== 2024) return false;
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesTitle = film.title?.toLowerCase().includes(q);
        const directorName = film.director || film.credits?.find((c) => c.role?.toLowerCase() === 'director')?.person?.name;
        const matchesDirector = directorName?.toLowerCase().includes(q);
        if (!matchesTitle && !matchesDirector) return false;
      }

      return true;
    });
  }, [youtubeFilms, youtubeTab, searchQuery]);

  return (
    <div className="w-full bg-bg min-h-screen pb-24 text-text-primary">
      <SEO 
        title={
          activeSection === 'plays'
            ? 'Nollywood Stage Play Box Office & Admissions | MuviDB'
            : activeSection === 'youtube'
            ? 'Nollywood YouTube Box Office & Viewership Tracker | MuviDB'
            : 'Nollywood Box Office Tracker | MuviDB'
        }
        description={
          activeSection === 'plays'
            ? 'Live theatrical grosses, ticket sales, and admissions across premier Nigerian stage productions and live theatre circuits.'
            : activeSection === 'youtube'
            ? 'Official YouTube viewership records, digital blockbusters, and top streaming releases in Nollywood.'
            : 'Comprehensive theatrical grosses, all-time record rankings, and box office breakdowns for Nigerian cinema.'
        }
      />

      {/* Hero Banner */}
      <section className="relative w-full border-b border-border bg-surface-2/30 py-8 sm:py-12">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 md:px-8 lg:px-12">
          
          {/* Main Title & Dynamic Metrics */}
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
            <div className="space-y-2 max-w-2xl">
              <div className="flex items-center gap-2">
                <span className={`w-3 h-0.5 inline-block rounded-full ${
                  activeSection === 'plays' ? 'bg-purple-400' : activeSection === 'youtube' ? 'bg-red-500' : 'bg-brand'
                }`}></span>
                <span className={`text-[11px] font-black uppercase tracking-[0.2em] ${
                  activeSection === 'plays' ? 'text-purple-400' : activeSection === 'youtube' ? 'text-red-500' : 'text-brand'
                }`}>
                  {activeSection === 'plays'
                    ? 'Stage Play & Theatre Tracker'
                    : activeSection === 'youtube'
                    ? 'YouTube Streaming & Digital Tracker'
                    : 'Theatrical Box Office Tracker'}
                </span>
              </div>
              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black font-heading text-text-primary tracking-tight">
                {activeSection === 'plays'
                  ? 'Stage Play Box Office'
                  : activeSection === 'youtube'
                  ? 'YouTube Box Office'
                  : 'Nollywood Box Office'}
              </h1>
              <p className="text-text-muted text-sm sm:text-base leading-relaxed">
                {activeSection === 'plays'
                  ? 'Official ticket sales, admissions, and verified live theatrical grosses across premier Nigerian stage plays and theatre circuits.'
                  : activeSection === 'youtube'
                  ? 'Official digital viewership figures, multi-million streaming milestones, and top-ranking Nollywood blockbusters on YouTube.'
                  : 'Official theatrical grosses, record-breaking milestones, and circuit intelligence for Nigerian cinematic releases.'}
              </p>
            </div>

            {/* Quick Metrics Bar (Dynamic for each section) */}
            <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-stretch sm:items-center gap-2 sm:gap-3 w-full lg:w-auto">
              {activeSection === 'cinema' && (
                <>
                  <div className="p-3 sm:p-3.5 rounded-xl bg-surface border border-border min-w-0 sm:min-w-[140px] flex-1 sm:flex-initial">
                    <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider block">Total Theatrical Gross</span>
                    <span className="text-lg sm:text-xl font-black text-brand font-heading">
                      {formatNaira(totalCinemaGross)}
                    </span>
                  </div>
                  <div className="p-3 sm:p-3.5 rounded-xl bg-surface border border-border min-w-0 sm:min-w-[120px] flex-1 sm:flex-initial">
                    <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider block">₦1B Club Titles</span>
                    <span className="text-lg sm:text-xl font-black text-text-primary font-heading flex items-center gap-1.5">
                      <Icon icon="solar:crown-bold" className="text-brand" />
                      {billionClubFilms.length}
                    </span>
                  </div>
                  {topCinemaFilm && (
                    <div className="p-3 sm:p-3.5 rounded-xl bg-surface border border-border min-w-0 sm:min-w-[160px] col-span-2 sm:col-span-1">
                      <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider block">#1 All-Time Cinema</span>
                      <Link 
                        to={`/films/${topCinemaFilm.slug || topCinemaFilm.id}/box-office`}
                        className="text-xs sm:text-sm font-black text-text-primary hover:text-brand transition-colors truncate block max-w-[180px]"
                        title={topCinemaFilm.title}
                      >
                        {topCinemaFilm.title}
                      </Link>
                    </div>
                  )}
                </>
              )}

              {activeSection === 'plays' && (
                <>
                  <div className="p-3 sm:p-3.5 rounded-xl bg-surface border border-border min-w-0 sm:min-w-[140px] flex-1 sm:flex-initial">
                    <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider block">Total Stage Gross</span>
                    <span className="text-lg sm:text-xl font-black text-purple-400 font-heading">
                      {formatNaira(totalPlaysGross)}
                    </span>
                  </div>
                  <div className="p-3 sm:p-3.5 rounded-xl bg-surface border border-border min-w-0 sm:min-w-[130px] flex-1 sm:flex-initial">
                    <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider block">Tracked Admissions</span>
                    <span className="text-lg sm:text-xl font-black text-text-primary font-heading flex items-center gap-1.5">
                      <Icon icon="solar:ticket-bold" className="text-purple-400" />
                      {totalTicketsSold.toLocaleString()} tickets
                    </span>
                  </div>
                  {topPlay && (
                    <div className="p-3 sm:p-3.5 rounded-xl bg-surface border border-border min-w-0 sm:min-w-[160px] col-span-2 sm:col-span-1">
                      <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider block">#1 Stage Production</span>
                      <Link 
                        to={`/plays/${topPlay.slug || topPlay.id}/box-office`}
                        className="text-xs sm:text-sm font-black text-text-primary hover:text-purple-400 transition-colors truncate block max-w-[180px]"
                        title={topPlay.title}
                      >
                        {topPlay.title}
                      </Link>
                    </div>
                  )}
                </>
              )}

              {activeSection === 'youtube' && (
                <>
                  <div className="p-3 sm:p-3.5 rounded-xl bg-surface border border-border min-w-0 sm:min-w-[140px] flex-1 sm:flex-initial">
                    <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider block">Tracked Viewership</span>
                    <span className="text-lg sm:text-xl font-black text-red-500 font-heading">
                      {formatViews(totalYoutubeViews)}
                    </span>
                  </div>
                  <div className="p-3 sm:p-3.5 rounded-xl bg-surface border border-border min-w-0 sm:min-w-[130px] flex-1 sm:flex-initial">
                    <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider block">10M+ Super-Hits</span>
                    <span className="text-lg sm:text-xl font-black text-text-primary font-heading flex items-center gap-1.5">
                      <Icon icon="solar:fire-bold" className="text-red-500" />
                      {tenMillionClub.length} films
                    </span>
                  </div>
                  {topYoutubeFilm && (
                    <div className="p-3 sm:p-3.5 rounded-xl bg-surface border border-border min-w-0 sm:min-w-[160px] col-span-2 sm:col-span-1">
                      <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider block">#1 Most-Viewed</span>
                      <Link 
                        to={`/films/${topYoutubeFilm.slug || topYoutubeFilm.id}`}
                        className="text-xs sm:text-sm font-black text-text-primary hover:text-red-500 transition-colors truncate block max-w-[180px]"
                        title={topYoutubeFilm.title}
                      >
                        {topYoutubeFilm.title}
                      </Link>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Master Category Selector Tabs */}
          <div className="mt-6 sm:mt-8 pt-4 sm:pt-6 border-t border-border/70 flex items-center gap-2 overflow-x-auto no-scrollbar pb-1 sm:flex-wrap">
            <button
              type="button"
              onClick={() => handleSectionChange('cinema')}
              className={`shrink-0 whitespace-nowrap inline-flex items-center gap-2 px-3.5 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
                activeSection === 'cinema'
                  ? 'bg-brand text-white shadow-md shadow-brand/20'
                  : 'bg-surface border border-border text-text-secondary hover:text-text-primary hover:bg-surface-2'
              }`}
            >
              <Icon icon="solar:clapperboard-play-bold" className="text-base" />
              <span>Cinema Box Office</span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-black ${
                activeSection === 'cinema' ? 'bg-black/20 text-black' : 'bg-surface-2 text-text-muted'
              }`}>
                {films.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => handleSectionChange('plays')}
              className={`shrink-0 whitespace-nowrap inline-flex items-center gap-2 px-3.5 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
                activeSection === 'plays'
                  ? 'bg-purple-600 text-white shadow-md shadow-purple-600/20'
                  : 'bg-surface border border-border text-text-secondary hover:text-text-primary hover:bg-surface-2'
              }`}
            >
              <Icon icon="solar:masks-bold" className="text-base text-purple-400" />
              <span>Stage Play Box Office</span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-black ${
                activeSection === 'plays' ? 'bg-white/20 text-white' : 'bg-surface-2 text-text-muted'
              }`}>
                {plays.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => handleSectionChange('youtube')}
              className={`shrink-0 whitespace-nowrap inline-flex items-center gap-2 px-3.5 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
                activeSection === 'youtube'
                  ? 'bg-red-600 text-white shadow-md shadow-red-600/20'
                  : 'bg-surface border border-border text-text-secondary hover:text-text-primary hover:bg-surface-2'
              }`}
            >
              <Icon icon="solar:play-circle-bold" className="text-base text-red-500" />
              <span>YouTube Box Office</span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-black ${
                activeSection === 'youtube' ? 'bg-white/20 text-white' : 'bg-surface-2 text-text-muted'
              }`}>
                {youtubeFilms.length}+
              </span>
            </button>
          </div>

        </div>
      </section>

      {/* Main Content Area */}
      <main className="max-w-[1440px] mx-auto px-4 sm:px-6 md:px-8 lg:px-12 pt-8 space-y-6">
        
        {/* Filter Controls & Search */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2">
          
          {/* Section Specific Sub-Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
            {activeSection === 'cinema' && (
              [
                { id: 'all', label: 'All-Time Highest Grossing' },
                { id: 'billion', label: '₦1 Billion Club', icon: 'solar:crown-bold' },
                { id: '2026', label: '2026 Releases' },
                { id: '2025', label: '2025 Releases' },
                { id: '2024', label: '2024 Releases' },
                { id: '2023', label: '2023 Releases' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setCinemaTab(tab.id)}
                  className={`shrink-0 inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                    cinemaTab === tab.id
                      ? 'bg-brand text-white shadow-xs font-bold'
                      : 'bg-surface border border-border text-text-secondary hover:text-text-primary hover:bg-surface-2'
                  }`}
                >
                  {tab.icon && <Icon icon={tab.icon} className={cinemaTab === tab.id ? 'text-white text-sm' : 'text-brand text-sm'} />}
                  <span>{tab.label}</span>
                </button>
              ))
            )}

            {activeSection === 'plays' && (
              [
                { id: 'all', label: 'All Stage Productions' },
                { id: 'top-tier', label: '₦5M+ Grossing', icon: 'solar:star-bold' },
                { id: '2026', label: '2026 Season' },
                { id: '2025', label: '2025 Season' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setPlaysTab(tab.id)}
                  className={`shrink-0 inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                    playsTab === tab.id
                      ? 'bg-purple-600 text-white shadow-xs font-bold'
                      : 'bg-surface border border-border text-text-secondary hover:text-text-primary hover:bg-surface-2'
                  }`}
                >
                  {tab.icon && <Icon icon={tab.icon} className="text-purple-300 text-sm" />}
                  <span>{tab.label}</span>
                </button>
              ))
            )}

            {activeSection === 'youtube' && (
              [
                { id: 'all', label: 'All-Time Most Viewed' },
                { id: '10m', label: '10M+ Club', icon: 'solar:fire-bold' },
                { id: '5m', label: '5M+ Club' },
                { id: '2026', label: '2026 Releases' },
                { id: '2025', label: '2025 Releases' },
                { id: '2024', label: '2024 Releases' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setYoutubeTab(tab.id)}
                  className={`shrink-0 inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                    youtubeTab === tab.id
                      ? 'bg-red-600 text-white shadow-xs font-bold'
                      : 'bg-surface border border-border text-text-secondary hover:text-text-primary hover:bg-surface-2'
                  }`}
                >
                  {tab.icon && <Icon icon={tab.icon} className="text-brand text-sm" />}
                  <span>{tab.label}</span>
                </button>
              ))
            )}
          </div>

          {/* Search box */}
          <div className="relative min-w-[240px] max-w-xs">
            <Icon icon="solar:magnifer-linear" className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted text-sm" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={
                activeSection === 'plays'
                  ? 'Search plays, venues, directors...'
                  : activeSection === 'youtube'
                  ? 'Search YouTube movies...'
                  : 'Search films or directors...'
              }
              className="w-full bg-surface border border-border rounded-full pl-9 pr-4 py-1.5 text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:border-brand transition-colors"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary"
              >
                <Icon icon="solar:close-circle-bold" className="text-sm" />
              </button>
            )}
          </div>
        </div>

        {/* Results Count & Instructions */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between text-xs text-text-muted gap-1">
          <span>
            Showing{' '}
            <strong>
              {activeSection === 'cinema'
                ? filteredFilms.length
                : activeSection === 'plays'
                ? filteredPlays.length
                : filteredYoutube.length}
            </strong>{' '}
            {activeSection === 'cinema' ? 'theatrical releases' : activeSection === 'plays' ? 'stage productions' : 'YouTube blockbusters'}
          </span>
          <span className="italic">
            {activeSection === 'plays'
              ? 'Click any box office gross to view tickets, admission tiers, and venue details'
              : activeSection === 'cinema'
              ? 'Click any gross figure to open the detailed circuit run'
              : 'Click any movie title to view credits, reviews, and streaming links'}
          </span>
        </div>

        {/* --------------------------------------------------------------- */}
        {/* SECTION 1: CINEMA BOX OFFICE TABLE                              */}
        {/* --------------------------------------------------------------- */}
        {activeSection === 'cinema' && (
          loading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="h-18 rounded-2xl bg-surface border border-border animate-pulse" />
              ))}
            </div>
          ) : filteredFilms.length === 0 ? (
            <div className="p-12 text-center rounded-2xl bg-surface border border-border space-y-3">
              <Icon icon="solar:ticket-sale-linear" className="text-4xl text-text-muted mx-auto opacity-40" />
              <p className="text-sm font-semibold text-text-primary">No theatrical records match this filter</p>
              <p className="text-xs text-text-muted">Try selecting "All-Time Highest Grossing" or clear your search query.</p>
            </div>
          ) : (
            <div className="rounded-2xl border border-border overflow-hidden bg-surface shadow-xs">
              {/* Mobile Card View (sm:hidden) */}
              <div className="block sm:hidden divide-y divide-border/60">
                {filteredFilms.map((film, index) => {
                  const rank = index + 1;
                  const dom = Number(film.box_office_domestic || 0);
                  const opening = Number(film.box_office_opening_weekend || 0);
                  const isBillion = dom >= 1_000_000_000;
                  const distCompanies = (film.film_companies || [])
                    .filter((fc) => fc.role === 'distribution' || fc.role === 'distributor')
                    .map((fc) => fc.company?.name)
                    .filter(Boolean);
                  const distributors = distCompanies.length > 0 ? distCompanies : (film.distributor ? [film.distributor] : []);
                  const directorName = film.director || film.credits?.find((c) => c.role?.toLowerCase() === 'director')?.person?.name;

                  return (
                    <div key={film.id} className="p-3.5 space-y-3 hover:bg-surface-2/30 transition-colors">
                      <div className="flex items-start gap-3">
                        <span className={`w-6 h-6 rounded-full font-black text-xs inline-flex items-center justify-center shrink-0 shadow-xs ${
                          rank === 1 ? 'bg-brand text-white' : rank === 2 ? 'bg-slate-300 text-black' : rank === 3 ? 'bg-[#9A3412] text-white' : 'bg-surface-2 text-text-muted font-mono'
                        }`}>
                          {rank}
                        </span>
                        <Link to={`/films/${film.slug || film.id}`} className="shrink-0 w-11 h-15 rounded-lg overflow-hidden border border-border bg-surface-2">
                          <ImageWithFallback src={film.poster_url} alt={film.title} fallbackType="film" className="w-full h-full object-cover" />
                        </Link>
                        <div className="min-w-0 flex-1">
                          <Link to={`/films/${film.slug || film.id}`} className="font-heading font-bold text-sm text-text-primary hover:text-brand transition-colors block line-clamp-2">
                            {film.title}
                          </Link>
                          <div className="flex items-center gap-1.5 text-[10px] text-text-muted mt-1 flex-wrap">
                            {film.year && <span>{film.year}</span>}
                            {directorName && <span>• {formatPersonName(directorName)}</span>}
                          </div>
                          {isBillion && (
                            <span className="inline-flex items-center gap-1 text-[9px] font-bold text-brand bg-brand/10 px-1.5 py-0.5 rounded border border-brand/20 mt-1">
                              <Icon icon="solar:crown-bold" className="text-xs" />
                              <span>₦1B+ Club</span>
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2 pt-1 border-t border-border/50 text-xs">
                        <button
                          type="button"
                          onClick={() => setSelectedFilmForModal(film)}
                          className="p-2 rounded-lg bg-surface-2 border border-border text-left group hover:border-brand/40 transition-colors cursor-pointer"
                        >
                          <span className="text-[9px] font-bold text-text-muted uppercase tracking-wider block">Lifetime Domestic</span>
                          <span className="text-xs font-black text-brand font-heading block truncate group-hover:underline">
                            {formatNaira(dom)} ↗
                          </span>
                          <span className="text-[10px] text-text-muted font-mono block">
                            ₦{dom.toLocaleString('en-NG')}
                          </span>
                        </button>
                        <div className="p-2 rounded-lg bg-surface-2 border border-border text-left">
                          <span className="text-[9px] font-bold text-text-muted uppercase tracking-wider block">Opening Weekend</span>
                          <span className="text-xs font-black text-text-primary font-heading block truncate">
                            {opening > 0 ? formatNaira(opening) : '—'}
                          </span>
                          <span className="text-[10px] text-text-muted truncate block">
                            {distributors[0] || 'Theatrical Circuit'}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Desktop Table View (hidden sm:block) */}
              <div className="hidden sm:block overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-border bg-surface-2/60 text-text-muted font-bold uppercase tracking-wider text-[10px]">
                      <th className="py-3.5 pl-4 sm:pl-6 pr-2 w-12 text-center">Rank</th>
                      <th className="py-3.5 px-3">Film</th>
                      <th className="py-3.5 px-3 hidden sm:table-cell">Year</th>
                      <th className="py-3.5 px-3 hidden md:table-cell">Director</th>
                      <th className="py-3.5 px-3 hidden lg:table-cell">Distributor</th>
                      <th className="py-3.5 px-3 text-right">Opening Weekend</th>
                      <th className="py-3.5 pr-4 sm:pr-6 pl-3 text-right">Lifetime Domestic Gross</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {filteredFilms.map((film, index) => {
                      const rank = index + 1;
                      const dom = Number(film.box_office_domestic || 0);
                      const opening = Number(film.box_office_opening_weekend || 0);
                      const isBillion = dom >= 1_000_000_000;
                      const distCompanies = (film.film_companies || [])
                        .filter((fc) => fc.role === 'distribution' || fc.role === 'distributor')
                        .map((fc) => fc.company?.name)
                        .filter(Boolean);
                      const distributors = distCompanies.length > 0
                        ? distCompanies
                        : (film.distributor ? [film.distributor] : []);

                      const directorName = film.director || film.credits?.find((c) => c.role?.toLowerCase() === 'director')?.person?.name;

                      return (
                        <tr 
                          key={film.id}
                          className="hover:bg-surface-2/40 transition-colors group"
                        >
                          {/* Rank */}
                          <td className="py-3.5 pl-4 sm:pl-6 pr-2 text-center">
                            {rank === 1 ? (
                              <span className="w-6 h-6 rounded-full bg-brand text-white font-black text-xs inline-flex items-center justify-center shadow-xs">
                                1
                              </span>
                            ) : rank === 2 ? (
                              <span className="w-6 h-6 rounded-full bg-slate-300 text-black font-black text-xs inline-flex items-center justify-center shadow-xs">
                                2
                              </span>
                            ) : rank === 3 ? (
                              <span className="w-6 h-6 rounded-full bg-[#9A3412] text-white font-black text-xs inline-flex items-center justify-center shadow-xs">
                                3
                              </span>
                            ) : (
                              <span className="font-mono text-text-muted font-bold text-xs">
                                #{rank}
                              </span>
                            )}
                          </td>

                          {/* Film Details */}
                          <td className="py-3.5 px-3">
                            <div className="flex items-center gap-3">
                              <Link 
                                to={`/films/${film.slug || film.id}`} 
                                className="shrink-0 w-11 h-15 rounded-lg overflow-hidden border border-border shadow-xs hover:opacity-90 transition-opacity"
                              >
                                <ImageWithFallback
                                  src={film.poster_url}
                                  alt={film.title}
                                  fallbackType="film"
                                  className="w-full h-full object-cover"
                                />
                              </Link>
                              <div className="min-w-0">
                                <Link
                                  to={`/films/${film.slug || film.id}`}
                                  className="font-heading font-bold text-sm text-text-primary hover:text-brand transition-colors block truncate"
                                >
                                  {film.title}
                                </Link>
                                <div className="flex items-center gap-2 mt-0.5 text-[11px] text-text-muted">
                                  <span className="sm:hidden">{film.year}</span>
                                  {isBillion && (
                                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-brand bg-brand/10 px-1.5 py-0.2 rounded border border-brand/20">
                                      <Icon icon="solar:crown-bold" className="text-xs" />
                                      <span>₦1B+ Club</span>
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* Year */}
                          <td className="py-3.5 px-3 text-text-muted hidden sm:table-cell font-mono">
                            {film.year || '—'}
                          </td>

                          {/* Director */}
                          <td className="py-3.5 px-3 text-text-secondary hidden md:table-cell">
                            {directorName ? formatPersonName(directorName) : '—'}
                          </td>

                          {/* Distributor */}
                          <td className="py-3.5 px-3 text-text-muted hidden lg:table-cell truncate max-w-[140px]">
                            {distributors.length > 0 ? distributors.join(', ') : '—'}
                          </td>

                          {/* Opening Weekend */}
                          <td className="py-3.5 px-3 text-right text-text-secondary font-mono">
                            {opening > 0 ? formatNaira(opening) : '—'}
                          </td>

                          {/* Lifetime Domestic Gross */}
                          <td className="py-3.5 pr-4 sm:pr-6 pl-3 text-right">
                            <Link
                              to={`/films/${film.slug || film.id}/box-office`}
                              className="inline-flex flex-col items-end cursor-pointer group/btn"
                              title="Click to view full box office run breakdown"
                            >
                              <span className="font-heading font-black text-sm text-brand group-hover/btn:underline decoration-brand/50 underline-offset-2 flex items-center gap-1">
                                <span>{formatNaira(dom)}</span>
                                <Icon icon="solar:arrow-right-up-linear" className="text-xs opacity-60 group-hover/btn:opacity-100 group-hover/btn:translate-x-0.5 transition-all" />
                              </span>
                              <span className="text-[10px] text-text-muted font-mono">
                                ₦{dom.toLocaleString('en-NG')}
                              </span>
                            </Link>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )
        )}

        {/* --------------------------------------------------------------- */}
        {/* SECTION 2: STAGE PLAY BOX OFFICE TABLE                          */}
        {/* --------------------------------------------------------------- */}
        {activeSection === 'plays' && (
          loading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="h-18 rounded-2xl bg-surface border border-border animate-pulse" />
              ))}
            </div>
          ) : filteredPlays.length === 0 ? (
            <div className="p-12 text-center rounded-2xl bg-surface border border-border space-y-3">
              <Icon icon="solar:masks-linear" className="text-4xl text-text-muted mx-auto opacity-40" />
              <p className="text-sm font-semibold text-text-primary">No stage play records match this filter</p>
              <p className="text-xs text-text-muted">Try selecting "All Stage Productions" or clear your search query.</p>
            </div>
          ) : (
            <div className="rounded-2xl border border-border overflow-hidden bg-surface shadow-xs">
              {/* Mobile Card View (sm:hidden) */}
              <div className="block sm:hidden divide-y divide-border/60">
                {filteredPlays.map((play, index) => {
                  const rank = index + 1;
                  const gross = Number(play.box_office_domestic || 0);
                  const tickets = Number(play.box_office_tickets_sold || 0);

                  return (
                    <div key={play.id} className="p-3.5 space-y-3 hover:bg-surface-2/30 transition-colors">
                      <div className="flex items-start gap-3">
                        <span className={`w-6 h-6 rounded-full font-black text-xs inline-flex items-center justify-center shrink-0 shadow-xs ${
                          rank === 1 ? 'bg-purple-500 text-white' : rank === 2 ? 'bg-slate-300 text-black' : rank === 3 ? 'bg-[#9A3412] text-white' : 'bg-surface-2 text-text-muted font-mono'
                        }`}>
                          {rank}
                        </span>
                        <Link to={`/plays/${play.slug || play.id}/box-office`} className="shrink-0 w-11 h-15 rounded-lg overflow-hidden border border-border bg-surface-2">
                          <ImageWithFallback src={play.poster_url || play.banner_url} alt={play.title} fallbackType="play" className="w-full h-full object-cover" />
                        </Link>
                        <div className="min-w-0 flex-1">
                          <Link to={`/plays/${play.slug || play.id}/box-office`} className="font-heading font-bold text-sm text-text-primary hover:text-purple-400 transition-colors block line-clamp-2">
                            {play.title}
                          </Link>
                          <div className="flex items-center gap-1.5 text-[10px] text-text-muted mt-1 flex-wrap">
                            {play.year && <span>{play.year}</span>}
                            {play.venue && <span>• {play.venue}</span>}
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2 pt-1 border-t border-border/50 text-xs">
                        <div className="p-2 rounded-lg bg-surface-2 border border-border text-left">
                          <span className="text-[9px] font-bold text-text-muted uppercase tracking-wider block">Stage Box Office</span>
                          <span className="text-xs font-black text-purple-400 font-heading block truncate">
                            {formatNaira(gross)}
                          </span>
                          <span className="text-[10px] text-text-muted font-mono block">
                            ₦{gross.toLocaleString('en-NG')}
                          </span>
                        </div>
                        <div className="p-2 rounded-lg bg-surface-2 border border-border text-left">
                          <span className="text-[9px] font-bold text-text-muted uppercase tracking-wider block">Tickets Sold</span>
                          <span className="text-xs font-black text-text-primary font-heading block truncate">
                            {tickets > 0 ? `${tickets.toLocaleString()} tickets` : '—'}
                          </span>
                          <span className="text-[10px] text-text-muted truncate block">
                            {play.city || 'Nigeria'}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Desktop Table View (hidden sm:block) */}
              <div className="hidden sm:block overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-border bg-surface-2/60 text-text-muted font-bold uppercase tracking-wider text-[10px]">
                      <th className="py-3.5 pl-4 sm:pl-6 pr-2 w-12 text-center">Rank</th>
                      <th className="py-3.5 px-3">Stage Production</th>
                      <th className="py-3.5 px-3 hidden sm:table-cell">Year</th>
                      <th className="py-3.5 px-3 hidden md:table-cell">Venue & Circuit</th>
                      <th className="py-3.5 px-3 hidden lg:table-cell">Director / Playwright</th>
                      <th className="py-3.5 px-3 text-right">Tickets Sold</th>
                      <th className="py-3.5 pr-4 sm:pr-6 pl-3 text-right">Lifetime Box Office Gross</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {filteredPlays.map((play, index) => {
                      const rank = index + 1;
                      const gross = Number(play.box_office_domestic || 0);
                      const tickets = Number(play.box_office_tickets_sold || 0);
                      const isBlockbuster = gross >= 10_000_000;

                      return (
                        <tr 
                          key={play.id}
                          className="hover:bg-surface-2/40 transition-colors group"
                        >
                          {/* Rank */}
                          <td className="py-3.5 pl-4 sm:pl-6 pr-2 text-center">
                            {rank === 1 ? (
                              <span className="w-6 h-6 rounded-full bg-purple-500 text-white font-black text-xs inline-flex items-center justify-center shadow-xs">
                                1
                              </span>
                            ) : rank === 2 ? (
                              <span className="w-6 h-6 rounded-full bg-slate-300 text-black font-black text-xs inline-flex items-center justify-center shadow-xs">
                                2
                              </span>
                            ) : rank === 3 ? (
                              <span className="w-6 h-6 rounded-full bg-[#9A3412] text-white font-black text-xs inline-flex items-center justify-center shadow-xs">
                                3
                              </span>
                            ) : (
                              <span className="font-mono text-text-muted font-bold text-xs">
                                #{rank}
                              </span>
                            )}
                          </td>

                          {/* Play Details */}
                          <td className="py-3.5 px-3">
                            <div className="flex items-center gap-3">
                              <Link 
                                to={`/plays/${play.slug || play.id}/box-office`} 
                                className="shrink-0 w-11 h-15 rounded-lg overflow-hidden border border-border shadow-xs hover:opacity-90 transition-opacity bg-surface-2"
                              >
                                <ImageWithFallback
                                  src={play.poster_url || play.banner_url}
                                  alt={play.title}
                                  fallbackType="play"
                                  className="w-full h-full object-cover"
                                />
                              </Link>
                              <div className="min-w-0">
                                <Link
                                  to={`/plays/${play.slug || play.id}/box-office`}
                                  className="font-heading font-bold text-sm text-text-primary hover:text-purple-400 transition-colors block truncate"
                                >
                                  {play.title}
                                </Link>
                                <div className="flex items-center gap-2 mt-0.5 text-[11px] text-text-muted">
                                  <span className="sm:hidden font-mono">{play.year}</span>
                                  {isBlockbuster && (
                                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-purple-400 bg-purple-500/10 px-1.5 py-0.2 rounded border border-purple-500/20">
                                      <Icon icon="solar:star-bold" className="text-xs" />
                                      <span>₦10M+ Play</span>
                                    </span>
                                  )}
                                  <span className="hidden sm:inline-block text-text-muted truncate max-w-[200px]">
                                    {play.city || 'Nigeria'}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* Year */}
                          <td className="py-3.5 px-3 text-text-muted hidden sm:table-cell font-mono">
                            {play.year || (play.run_start_date ? new Date(play.run_start_date).getFullYear() : '—')}
                          </td>

                          {/* Venue */}
                          <td className="py-3.5 px-3 text-text-secondary hidden md:table-cell truncate max-w-[200px]" title={play.venue}>
                            {play.venue || '—'}
                          </td>

                          {/* Director / Playwright */}
                          <td className="py-3.5 px-3 text-text-muted hidden lg:table-cell truncate max-w-[150px]">
                            {play.director ? formatPersonName(play.director) : play.playwright ? formatPersonName(play.playwright) : play.producer || '—'}
                          </td>

                          {/* Tickets Sold */}
                          <td className="py-3.5 px-3 text-right text-text-secondary font-mono">
                            {tickets > 0 ? (
                              <span className="inline-flex items-center gap-1 justify-end">
                                <Icon icon="solar:ticket-linear" className="text-xs text-purple-400" />
                                <span>{tickets.toLocaleString('en-NG')}</span>
                              </span>
                            ) : (
                              '—'
                            )}
                          </td>

                          {/* Lifetime Box Office Gross (Clickable -> Stage Play Breakdown) */}
                          <td className="py-3.5 pr-4 sm:pr-6 pl-3 text-right">
                            <Link
                              to={`/plays/${play.slug || play.id}/box-office`}
                              className="inline-flex flex-col items-end cursor-pointer group/btn"
                              title="Click to view admissions, ticket categories, and performance breakdown"
                            >
                              <span className="font-heading font-black text-sm text-purple-400 group-hover/btn:underline decoration-purple-400/50 underline-offset-2 flex items-center gap-1">
                                <span>{formatNaira(gross)}</span>
                                <Icon icon="solar:arrow-right-up-linear" className="text-xs opacity-60 group-hover/btn:opacity-100 group-hover/btn:translate-x-0.5 transition-all" />
                              </span>
                              <span className="text-[10px] text-text-muted font-mono">
                                ₦{gross.toLocaleString('en-NG')}
                              </span>
                            </Link>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )
        )}

        {/* --------------------------------------------------------------- */}
        {/* SECTION 3: YOUTUBE BOX OFFICE TABLE (ViewStats-inspired) */}
        {activeSection === 'youtube' && (
          loading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="h-18 rounded-2xl bg-surface border border-border animate-pulse" />
              ))}
            </div>
          ) : filteredYoutube.length === 0 ? (
            <div className="p-12 text-center rounded-2xl bg-surface border border-border space-y-3">
              <Icon icon="solar:play-circle-linear" className="text-4xl text-text-muted mx-auto opacity-40" />
              <p className="text-sm font-semibold text-text-primary">No YouTube records match this filter</p>
              <p className="text-xs text-text-muted">Try selecting "All-Time Most Viewed" or clear your search query.</p>
            </div>
          ) : (
            <div className="rounded-2xl border border-border overflow-hidden bg-surface shadow-xs">
              {/* Mobile Card View (sm:hidden) */}
              <div className="block sm:hidden divide-y divide-border/60">
                {filteredYoutube.map((film, index) => {
                  const rank = index + 1;
                  const views = Number(film.view_count || 0);
                  const est = calculateYoutubeBoxOffice({
                    viewCount: views,
                    runtimeMinutes: film.runtime_minutes || film.duration,
                    language: film.language,
                    title: film.title,
                  });
                  const velocity = calculateStreamingVelocity({
                    viewCount: views,
                    releaseDate: film.release_date,
                    year: film.year,
                  });
                  const runtimeMins = parseRuntimeMinutes(film.runtime_minutes || film.duration);
                  const isSuperHit = views >= 10_000_000;
                  const watchUrl = film.youtube_watch_url || (film.source_video_id ? `https://www.youtube.com/watch?v=${film.source_video_id}` : null);
                  const directorName = film.director || film.credits?.find((c) => c.role?.toLowerCase() === 'director')?.person?.name;

                  return (
                    <div key={film.id} className="p-3.5 space-y-3 hover:bg-surface-2/30 transition-colors">
                      <div className="flex items-start gap-3">
                        <span className={`w-6 h-6 rounded-full font-black text-xs inline-flex items-center justify-center shrink-0 shadow-xs ${
                          rank === 1 ? 'bg-brand text-white' : rank === 2 ? 'bg-slate-300 text-black' : rank === 3 ? 'bg-[#9A3412] text-white' : 'bg-surface-2 text-text-muted font-mono'
                        }`}>
                          {rank}
                        </span>
                        <Link to={`/films/${film.slug || film.id}`} className="shrink-0 w-11 h-15 rounded-lg overflow-hidden border border-border bg-surface-2">
                          <ImageWithFallback src={film.poster_url} alt={film.title} fallbackType="film" className="w-full h-full object-cover" />
                        </Link>
                        <div className="min-w-0 flex-1">
                          <Link to={`/films/${film.slug || film.id}`} className="font-heading font-bold text-sm text-text-primary hover:text-brand transition-colors block line-clamp-2">
                            {film.title}
                          </Link>
                          <div className="flex items-center gap-1.5 text-[10px] text-text-muted mt-1 flex-wrap">
                            {film.year && <span>{film.year}</span>}
                            <span>• {Math.floor(runtimeMins / 60)}h {runtimeMins % 60}m</span>
                            {directorName && <span>• {formatPersonName(directorName)}</span>}
                          </div>
                          {isSuperHit && (
                            <span className="inline-flex items-center gap-1 text-[9px] font-bold text-brand bg-brand/10 px-1.5 py-0.5 rounded border border-brand/20 mt-1">
                              <Icon icon="solar:fire-bold" className="text-xs" />
                              <span>10M+ Club</span>
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2 pt-1 border-t border-border/50 text-xs">
                        <button
                          type="button"
                          onClick={() => setSelectedYoutubeFilmForModal(film)}
                          className="p-2 rounded-lg bg-surface-2 border border-border text-left group hover:border-brand/40 transition-colors cursor-pointer"
                        >
                          <span className="text-[9px] font-bold text-text-muted uppercase tracking-wider block">Est. AdSense Gross</span>
                          <span className="text-xs font-black text-brand font-heading block truncate group-hover:underline">
                            {est.formattedNgn} ↗
                          </span>
                          <span className="text-[10px] text-text-muted font-mono block">
                            {est.formattedUsd}
                          </span>
                        </button>
                        <div className="p-2 rounded-lg bg-surface-2 border border-border text-left">
                          <span className="text-[9px] font-bold text-text-muted uppercase tracking-wider block">Lifetime Streams</span>
                          <span className="text-xs font-black text-text-primary font-heading block truncate">
                            {formatViews(views)}
                          </span>
                          <span className="text-[10px] text-text-muted font-mono block">
                            {views.toLocaleString('en-US')} streams
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between gap-2 pt-1 border-t border-border/40 text-xs">
                        <span className={`inline-flex items-center gap-1.5 text-[10px] font-bold px-2 py-0.5 rounded-full border whitespace-nowrap ${velocity.badge.color}`}>
                          <Icon icon={velocity.badge.icon} className="text-xs shrink-0" />
                          <span className="whitespace-nowrap">{velocity.badge.label}</span>
                          <span className="font-mono opacity-80 whitespace-nowrap">({velocity.formattedViewsPerDay})</span>
                        </span>
                        {watchUrl && (
                          <a href={watchUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[11px] font-bold text-brand hover:underline">
                            <Icon icon="solar:play-bold" className="text-xs" />
                            <span>Watch</span>
                            <Icon icon="solar:arrow-right-up-linear" className="text-[10px]" />
                          </a>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Desktop Table View (hidden sm:block) */}
              <div className="hidden sm:block overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-border bg-surface-2/60 text-text-muted font-bold uppercase tracking-wider text-[10px]">
                      <th className="py-3.5 pl-4 sm:pl-6 pr-2 w-12 text-center">Rank</th>
                      <th className="py-3.5 px-3">Film / YouTube Release</th>
                      <th className="py-3.5 px-3 hidden sm:table-cell">Year</th>
                      <th className="py-3.5 px-3 hidden md:table-cell">Director / Cast</th>
                      <th className="py-3.5 px-3 text-right">Est. AdSense Box Office</th>
                      <th className="py-3.5 px-3 hidden lg:table-cell text-center">Velocity & Pacing</th>
                      <th className="py-3.5 px-3 hidden sm:table-cell text-center">Watch</th>
                      <th className="py-3.5 pr-4 sm:pr-6 pl-3 text-right">Lifetime Streams</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {filteredYoutube.map((film, index) => {
                      const rank = index + 1;
                      const views = Number(film.view_count || 0);
                      const isSuperHit = views >= 10_000_000;
                      const directorName = film.director || film.credits?.find((c) => c.role?.toLowerCase() === 'director')?.person?.name;
                      const watchUrl = film.youtube_watch_url || (film.source_video_id ? `https://www.youtube.com/watch?v=${film.source_video_id}` : null);
                      const est = calculateYoutubeBoxOffice({
                        viewCount: views,
                        runtimeMinutes: film.runtime_minutes || film.duration,
                        language: film.language,
                        title: film.title,
                      });
                      const velocity = calculateStreamingVelocity({
                        viewCount: views,
                        releaseDate: film.release_date,
                        year: film.year,
                      });
                      const runtimeMins = parseRuntimeMinutes(film.runtime_minutes || film.duration);
                      const runtimeFormatted = runtimeMins >= 60
                        ? `${Math.floor(runtimeMins / 60)}h ${runtimeMins % 60}m`
                        : `${runtimeMins}m`;

                      return (
                        <tr 
                          key={film.id}
                          className="hover:bg-surface-2/40 transition-colors group"
                        >
                          {/* Rank */}
                          <td className="py-3.5 pl-4 sm:pl-6 pr-2 text-center">
                            {rank === 1 ? (
                              <span className="w-6 h-6 rounded-full bg-brand text-white font-black text-xs inline-flex items-center justify-center shadow-xs">
                                1
                              </span>
                            ) : rank === 2 ? (
                              <span className="w-6 h-6 rounded-full bg-slate-300 text-black font-black text-xs inline-flex items-center justify-center shadow-xs">
                                2
                              </span>
                            ) : rank === 3 ? (
                              <span className="w-6 h-6 rounded-full bg-[#9A3412] text-white font-black text-xs inline-flex items-center justify-center shadow-xs">
                                3
                              </span>
                            ) : (
                              <span className="font-mono text-text-muted font-bold text-xs">
                                #{rank}
                              </span>
                            )}
                          </td>

                          {/* Film Details */}
                          <td className="py-3.5 px-3">
                            <div className="flex items-center gap-3">
                              <Link 
                                to={`/films/${film.slug || film.id}`} 
                                className="shrink-0 w-11 h-15 rounded-lg overflow-hidden border border-border shadow-xs hover:opacity-90 transition-opacity bg-surface-2"
                              >
                                <ImageWithFallback
                                  src={film.poster_url}
                                  alt={film.title}
                                  fallbackType="film"
                                  className="w-full h-full object-cover"
                                />
                              </Link>
                              <div className="min-w-0">
                                <Link
                                  to={`/films/${film.slug || film.id}`}
                                  className="font-heading font-bold text-sm text-text-primary hover:text-brand transition-colors block truncate"
                                >
                                  {film.title}
                                </Link>
                                <div className="flex items-center gap-2 mt-0.5 text-[11px] text-text-muted flex-wrap">
                                  <span className="font-mono text-[10px] bg-surface-2 px-1.5 py-0.5 rounded border border-border">
                                    {runtimeFormatted}
                                  </span>
                                  {isSuperHit && (
                                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-brand bg-brand/10 px-1.5 py-0.2 rounded border border-brand/20">
                                      <Icon icon="solar:fire-bold" className="text-xs" />
                                      <span>10M+ Club</span>
                                    </span>
                                  )}
                                  {film.source_video_id && (
                                    <span className="hidden sm:inline-block font-mono text-[10px] text-text-muted">
                                      ID: {film.source_video_id}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* Year */}
                          <td className="py-3.5 px-3 text-text-muted hidden sm:table-cell font-mono">
                            {film.year || '—'}
                          </td>

                          {/* Director */}
                          <td className="py-3.5 px-3 text-text-secondary hidden md:table-cell">
                            {directorName ? formatPersonName(directorName) : '—'}
                          </td>

                          {/* Est. AdSense Box Office */}
                          <td className="py-3.5 px-3 text-right">
                            <button
                              type="button"
                              onClick={() => setSelectedYoutubeFilmForModal(film)}
                              className="inline-flex flex-col items-end cursor-pointer group/est text-right"
                              title="Click to view detailed ViewStats breakdown"
                            >
                              <span className="font-heading font-black text-sm text-brand group-hover/est:underline decoration-brand/50 underline-offset-2 flex items-center gap-1">
                                <span>{est.formattedNgn}</span>
                                <Icon icon="solar:arrow-right-up-linear" className="text-xs opacity-60 group-hover/est:opacity-100 group-hover/est:translate-x-0.5 transition-all" />
                              </span>
                              <span className="text-[10px] text-text-muted font-mono">
                                {est.formattedUsd} • {est.effectiveRpmUsd} RPM
                              </span>
                            </button>
                          </td>

                          {/* Velocity & Pacing - strictly on a straight line */}
                          <td className="py-3.5 px-3 hidden lg:table-cell text-center whitespace-nowrap">
                            <span className={`inline-flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-0.5 rounded-full border whitespace-nowrap ${velocity.badge.color}`}>
                              <Icon icon={velocity.badge.icon} className="text-xs shrink-0" />
                              <span className="whitespace-nowrap">{velocity.badge.label}</span>
                              <span className="font-mono opacity-80 whitespace-nowrap">({velocity.formattedViewsPerDay})</span>
                            </span>
                          </td>

                          {/* Direct YouTube Link */}
                          <td className="py-3.5 px-3 hidden sm:table-cell text-center">
                            {watchUrl ? (
                              <a
                                href={watchUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-brand/10 text-brand hover:bg-brand hover:text-white transition-all text-[11px] font-semibold"
                                title="Watch on YouTube"
                              >
                                <Icon icon="solar:play-bold" className="text-xs" />
                                <span>Watch</span>
                              </a>
                            ) : (
                              <span className="text-text-muted">—</span>
                            )}
                          </td>

                          {/* Views */}
                          <td className="py-3.5 pr-4 sm:pr-6 pl-3 text-right">
                            <Link
                              to={`/films/${film.slug || film.id}`}
                              className="inline-flex flex-col items-end cursor-pointer group/btn"
                              title="Click to view full movie details"
                            >
                              <span className="font-heading font-black text-sm text-text-primary group-hover/btn:text-brand transition-colors flex items-center gap-1">
                                <Icon icon="solar:fire-bold" className="text-xs text-brand opacity-75" />
                                <span>{formatViews(views)}</span>
                              </span>
                              <span className="text-[10px] text-text-muted font-mono">
                                {views.toLocaleString('en-US')} streams
                              </span>
                            </Link>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {/* ViewStats Methodology Footer */}
              <div className="p-3 sm:p-4 bg-surface-2/40 border-t border-border flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[11px] text-text-muted">
                <div className="flex items-center gap-1.5">
                  <Icon icon="solar:info-circle-linear" className="text-brand text-xs shrink-0" />
                  <span>
                    <strong>ViewStats Estimation Model:</strong> YouTube AdSense earnings are estimated using verified movie runtimes (mid-roll ad density) and Nollywood diaspora audience benchmarks (US/UK/Canada vs Domestic).
                  </span>
                </div>
                <span className="font-mono text-[10px] text-text-muted shrink-0">
                  Dual NGN/USD Exchange @ ₦${USD_TO_NGN}/$1
                </span>
              </div>
            </div>
          )
        )}
      </main>

      {/* Box Office Breakdown Modal */}
      {selectedFilmForModal && (
        <BoxOfficeBreakdownModal
          film={selectedFilmForModal}
          onClose={() => setSelectedFilmForModal(null)}
        />
      )}

      {/* YouTube ViewStats Breakdown Modal */}
      {selectedYoutubeFilmForModal && (
        <YouTubeBreakdownModal
          film={selectedYoutubeFilmForModal}
          onClose={() => setSelectedYoutubeFilmForModal(null)}
        />
      )}
    </div>
  );
}
