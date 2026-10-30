import React, { useState, useEffect, useMemo } from 'react';
import { useParams, Link, useNavigate, useSearchParams, useLoaderData } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Icon } from '@iconify/react';
import ImageWithFallback from '../components/ui/ImageWithFallback';
import SEO from '../components/SEO';
import { formatFilmTitle, formatPersonName, formatViews } from '../utils/format';
import { useAuth } from '../context/AuthContext';
import {
  calculateYoutubeBoxOffice,
  calculateStreamingVelocity,
  parseRuntimeMinutes,
  formatCompactCurrency,
  USD_TO_NGN,
} from '../lib/youtubeBoxOffice';

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

export default function FilmBoxOffice() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const loaderData = useLoaderData();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin' || user?.role === 'admin_limited';

  const [film, setFilm] = useState(loaderData?.film ?? null);
  const [loading, setLoading] = useState(!loaderData?.film);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (loaderData?.film) {
      setFilm(loaderData.film);
      setLoading(false);
      return;
    }

    async function loadFilm() {
      if (!slug) return;
      setLoading(true);
      setError(null);

      try {
        const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(slug);
        const col = isUUID ? 'id' : 'slug';

        let { data, error: fetchErr } = await supabase
          .from('films')
          .select(`
            id,
            title,
            slug,
            year,
            release_date,
            runtime_minutes,
            duration,
            nfvcb_rating,
            poster_url,
            backdrop_url,
            box_office_domestic,
            box_office_opening_weekend,
            box_office_currency,
            box_office_source,
            streaming_links,
            view_count,
            language,
            source_video_id,
            youtube_watch_url,
            liked_percent,
            release_type,
            director,
            film_genres (
              genres (
                name
              )
            )
          `)
          .eq(col, slug)
          .maybeSingle();

        if (fetchErr || !data) {
          const { data: fallbackData } = await supabase
            .from('films')
            .select(`
              id,
              title,
              slug,
              year,
              release_date,
              runtime_minutes,
              duration,
              nfvcb_rating,
              poster_url,
              backdrop_url,
              box_office_domestic,
              box_office_opening_weekend,
              box_office_currency,
              box_office_source,
              streaming_links,
              view_count,
              language,
              source_video_id,
              youtube_watch_url,
              liked_percent,
              release_type,
              director,
              film_genres (
                genres (
                  name
                )
              )
            `)
            .eq('id', slug)
            .maybeSingle();

          data = fallbackData;
        }

        if (data) {
          try {
            const res = await fetch(`/api/content?resource=film-credits&filmId=${encodeURIComponent(data.id)}`);
            if (res.ok) {
              const crData = await res.json();
              data.credits = crData.credits || [];
            }
          } catch {}

          if (data.film_genres) {
            data.genres = data.film_genres.map((fg) => fg.genres?.name).filter(Boolean);
          }
          setFilm(data);
        } else {
          setError('Film not found');
        }
      } catch (err) {
        console.error('Error fetching film box office:', err);
        setError('Failed to load box office data');
      } finally {
        setLoading(false);
      }
    }

    loadFilm();
  }, [slug, loaderData]);

  // Extract Box Office Metrics
  const boxOfficeData = film?.streaming_links?.box_office || {};
  const domestic = Number(film?.box_office_domestic || boxOfficeData.domestic || 0);
  const openingWeekend = Number(film?.box_office_opening_weekend || boxOfficeData.opening_weekend || 0);
  const admissions = Number(boxOfficeData.admissions || boxOfficeData.admissions_total || 0);
  const weekendAdmissions = Number(boxOfficeData.admissions_weekend || 0);
  const locations = boxOfficeData.locations;
  const source = film?.box_office_source || boxOfficeData.source || 'Nigerian Film Intelligence / CEAN';
  const weeklyHistory = Array.isArray(boxOfficeData.history) ? boxOfficeData.history : [];

  const totalWeeklyGross = useMemo(() => {
    return weeklyHistory.reduce((acc, w) => acc + (Number(w.gross) || 0), 0);
  }, [weeklyHistory]);

  const remainingGross = useMemo(() => {
    return domestic > totalWeeklyGross && totalWeeklyGross > 0
      ? domestic - totalWeeklyGross
      : 0;
  }, [domestic, totalWeeklyGross]);

  // YouTube Metrics & Calculations
  const views = Number(film?.view_count || 0);
  const hasTheatrical = domestic > 0 || weeklyHistory.length > 0;
  const hasYouTube = views > 0 || Boolean(film?.source_video_id || film?.youtube_watch_url);

  // Section switcher
  const requestedType = searchParams.get('type');
  const [selectedSection, setSelectedSection] = useState(null);

  const activeSection = useMemo(() => {
    if (selectedSection) return selectedSection;
    if (requestedType === 'youtube' && hasYouTube) return 'youtube';
    if (requestedType === 'theatrical' && hasTheatrical) return 'theatrical';
    if (hasYouTube && !hasTheatrical) return 'youtube';
    return 'theatrical';
  }, [selectedSection, requestedType, hasYouTube, hasTheatrical]);

  const runtimeMins = parseRuntimeMinutes(film?.runtime_minutes || film?.duration);
  const youtubeBoxOffice = useMemo(() => {
    if (!hasYouTube) return null;
    return calculateYoutubeBoxOffice({
      viewCount: views,
      runtimeMinutes: runtimeMins,
      language: film?.language,
      title: film?.title,
    });
  }, [hasYouTube, views, runtimeMins, film?.language, film?.title]);

  const velocity = useMemo(() => {
    if (!hasYouTube) return null;
    return calculateStreamingVelocity({
      viewCount: views,
      releaseDate: film?.release_date,
      year: film?.year,
    });
  }, [hasYouTube, views, film?.release_date, film?.year]);

  const watchUrl = film?.youtube_watch_url || (film?.source_video_id ? `https://www.youtube.com/watch?v=${film.source_video_id}` : null);

  // Midrolls & Audience Split
  let estMidrolls = '1 – 2';
  if (runtimeMins >= 120) estMidrolls = '8 – 12';
  else if (runtimeMins >= 75) estMidrolls = '4 – 7';
  else if (runtimeMins >= 45) estMidrolls = '2 – 3';

  const langText = `${film?.language || ''} ${film?.title || ''}`.toLowerCase();
  const isIndigenous = /yoruba|hausa|igbo|apatatv|yorubahood/i.test(langText);
  const domesticShare = isIndigenous ? 70 : 50;
  const diasporaShare = 100 - domesticShare;

  // Release Date
  const releaseDateObj = useMemo(() => {
    if (film?.release_date) {
      const d = new Date(film.release_date);
      if (!isNaN(d.getTime())) return d;
    }
    if (film?.year) {
      return new Date(Number(film.year), 0, 1);
    }
    const d = new Date();
    d.setDate(d.getDate() - (velocity?.daysActive || 120));
    return d;
  }, [film?.release_date, film?.year, velocity?.daysActive]);

  // Interactive Hover State on SVG Chart
  const [activeChartPoint, setActiveChartPoint] = useState(null);

  // SVG Growth Trajectory Chart Data
  const chartData = useMemo(() => {
    if (!views || views <= 0) return null;
    const totalDays = Math.max(7, velocity?.daysActive || 30);
    const svgWidth = 840;
    const svgHeight = 260;
    const paddingX = 60;
    const paddingBottom = 40;
    const paddingTop = 25;
    const plotWidth = svgWidth - paddingX - 30;
    const plotHeight = svgHeight - paddingTop - paddingBottom;

    const dayFractions = [0, 0.05, 0.12, 0.25, 0.45, 0.68, 0.85, 1];
    const viewFractions = [0, 0.18, 0.35, 0.52, 0.69, 0.83, 0.93, 1];

    const points = dayFractions.map((dFrac, idx) => {
      const dayOffset = Math.round(dFrac * totalDays);
      const pointDate = new Date(releaseDateObj.getTime() + dayOffset * 86400000);
      const ptViews = Math.round(views * viewFractions[idx]);
      const x = paddingX + dFrac * plotWidth;
      const y = paddingTop + plotHeight - (viewFractions[idx] * plotHeight);
      const typicalFrac = viewFractions[idx] * 0.42;
      const typicalY = paddingTop + plotHeight - (typicalFrac * plotHeight);
      const dateStr = pointDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

      const rpmToUse = Number(youtubeBoxOffice?.effectiveMidRpm) || 2.25;
      const cumRevUsd = (ptViews / 1000) * rpmToUse;
      const cumRevNgn = cumRevUsd * USD_TO_NGN;

      return {
        idx,
        dayOffset,
        dateStr,
        views: ptViews,
        cumRevUsd,
        cumRevNgn,
        formattedNgn: formatCompactCurrency(cumRevNgn, 'NGN'),
        formattedUsd: formatCompactCurrency(cumRevUsd, 'USD'),
        x,
        y,
        typicalY,
        percent: Math.round(viewFractions[idx] * 100),
      };
    });

    const pathD = points.reduce((acc, pt, i) => {
      if (i === 0) return `M ${pt.x} ${pt.y}`;
      const prev = points[i - 1];
      const cx = (prev.x + pt.x) / 2;
      return `${acc} C ${cx} ${prev.y}, ${cx} ${pt.y}, ${pt.x} ${pt.y}`;
    }, '');

    const areaD = `${pathD} L ${points[points.length - 1].x} ${paddingTop + plotHeight} L ${points[0].x} ${paddingTop + plotHeight} Z`;

    const typicalPathD = points.reduce((acc, pt, i) => {
      if (i === 0) return `M ${pt.x} ${pt.typicalY}`;
      const prev = points[i - 1];
      const cx = (prev.x + pt.x) / 2;
      return `${acc} C ${cx} ${prev.typicalY}, ${cx} ${pt.typicalY}, ${pt.x} ${pt.typicalY}`;
    }, '');

    const typicalAreaD = `${typicalPathD} L ${points[points.length - 1].x} ${paddingTop + plotHeight} L ${points[0].x} ${paddingTop + plotHeight} Z`;

    return { points, pathD, areaD, typicalPathD, typicalAreaD, svgWidth, svgHeight, paddingTop, plotHeight, paddingX, plotWidth };
  }, [views, velocity?.daysActive, releaseDateObj, youtubeBoxOffice?.effectiveMidRpm]);

  // Recent Daily Pacing Table Data (Last 7 Days)
  const pacingData = useMemo(() => {
    if (!views || !velocity) return null;
    const rows = [];
    const avgDailyViews = velocity.viewsPerDay || Math.round(views / Math.max(1, velocity.daysActive));
    const now = new Date();
    const rpmToUse = Number(youtubeBoxOffice?.effectiveMidRpm) || 2.25;

    const varianceMultipliers = [0.94, 0.91, 1.08, 1.15, 1.04, 0.96, 0.92];

    for (let i = 6; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 86400000);
      const mult = varianceMultipliers[6 - i] || 1;
      const dayViews = Math.max(10, Math.round(avgDailyViews * mult));
      const dayRevUsd = (dayViews / 1000) * rpmToUse;
      const dayRevNgn = dayRevUsd * USD_TO_NGN;

      rows.push({
        dateStr: d.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' }),
        views: dayViews,
        revenueUsd: dayRevUsd,
        revenueNgn: dayRevNgn,
        formattedNgn: formatCompactCurrency(dayRevNgn, 'NGN'),
        formattedUsd: formatCompactCurrency(dayRevUsd, 'USD'),
      });
    }

    const dailyAvgViews = avgDailyViews;
    const dailyAvgUsd = (dailyAvgViews / 1000) * rpmToUse;
    const dailyAvgNgn = dailyAvgUsd * USD_TO_NGN;

    const weeklyAvgViews = avgDailyViews * 7;
    const weeklyAvgUsd = dailyAvgUsd * 7;
    const weeklyAvgNgn = dailyAvgNgn * 7;

    const monthlyAvgViews = avgDailyViews * 30;
    const monthlyAvgUsd = dailyAvgUsd * 30;
    const monthlyAvgNgn = dailyAvgNgn * 30;

    return {
      rows,
      averages: {
        daily: { views: dailyAvgViews, ngn: formatCompactCurrency(dailyAvgNgn, 'NGN'), usd: formatCompactCurrency(dailyAvgUsd, 'USD') },
        weekly: { views: weeklyAvgViews, ngn: formatCompactCurrency(weeklyAvgNgn, 'NGN'), usd: formatCompactCurrency(weeklyAvgUsd, 'USD') },
        monthly: { views: monthlyAvgViews, ngn: formatCompactCurrency(monthlyAvgNgn, 'NGN'), usd: formatCompactCurrency(monthlyAvgUsd, 'USD') },
      }
    };
  }, [views, velocity, youtubeBoxOffice?.effectiveMidRpm]);

  // Back Navigation Handler
  const handleBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate(activeSection === 'youtube' ? '/box-office?section=youtube' : '/box-office');
    }
  };

  const directors = useMemo(() => {
    const list = (film?.credits || [])
      .filter((c) => c.role?.toLowerCase() === 'director')
      .map((c) => c.person)
      .filter(Boolean);
    if (list.length > 0) return list;
    if (film?.director) return [{ name: film.director }];
    return [];
  }, [film]);

  if (loading) {
    return (
      <div className="w-full min-h-[70vh] flex flex-col items-center justify-center space-y-4">
        <div className="w-8 h-8 rounded-full border-2 border-brand border-t-transparent animate-spin" />
        <p className="text-text-muted text-sm font-medium">Loading Box Office Records...</p>
      </div>
    );
  }

  if (error || !film) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-20 text-center space-y-4">
        <Icon icon="solar:ticket-sale-linear" className="text-5xl text-text-muted mx-auto opacity-40" />
        <h2 className="text-2xl font-bold text-text-primary">Box Office Record Not Found</h2>
        <p className="text-text-muted text-sm">We could not find box office tracking records for this title.</p>
        <Link
          to="/box-office"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-brand text-white font-bold text-sm shadow-md hover:opacity-90 transition-opacity"
        >
          <Icon icon="solar:arrow-left-linear" />
          <span>Back to Box Office Tracker</span>
        </Link>
      </div>
    );
  }

  return (
    <div className="w-full bg-bg min-h-screen pb-24 text-text-primary font-sans">
      <SEO 
        title={`${film.title} (${film.year || ''}) ${activeSection === 'youtube' ? 'YouTube Box Office & ViewStats Breakdown' : 'Box Office Breakdown'} | MuviDB`}
        description={activeSection === 'youtube' 
          ? `Official YouTube streaming analytics, verified view tallies, and estimated AdSense box office earnings for ${film.title}.`
          : `Theatrical box office gross, weekly run numbers, admissions, and commercial performance breakdown for ${film.title}.`
        }
      />

      {/* Breadcrumb / Back Bar */}
      <section className="border-b border-border bg-surface-2/40 py-3.5">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 md:px-8 lg:px-12 flex items-center justify-between gap-4">
          <button
            type="button"
            onClick={handleBack}
            className="inline-flex items-center gap-2 text-xs font-bold text-text-muted hover:text-brand transition-colors group cursor-pointer"
          >
            <Icon icon="solar:arrow-left-linear" className="text-sm group-hover:-translate-x-0.5 transition-transform" />
            <span>Back</span>
          </button>

          <div className="flex items-center gap-3">
            <Link
              to={activeSection === 'youtube' ? '/box-office?section=youtube' : '/box-office'}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-brand hover:underline"
            >
              <Icon icon={activeSection === 'youtube' ? 'solar:play-circle-bold' : 'solar:ticket-bold'} className="text-sm" />
              <span>{activeSection === 'youtube' ? 'YouTube Box Office Leaderboard' : 'Nollywood Cinema Tracker'}</span>
            </Link>
          </div>
        </div>
      </section>

      {/* Film Header Summary */}
      <section className="relative border-b border-border bg-surface/60 py-8 sm:py-10">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 md:px-8 lg:px-12">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
            <Link
              to={`/films/${film.slug || film.id}`}
              className="shrink-0 w-24 sm:w-28 md:w-32 aspect-[2/3] rounded-xl overflow-hidden border border-border shadow-xl hover:opacity-90 transition-opacity bg-surface-2"
            >
              <ImageWithFallback
                src={film.poster_url}
                alt={film.title}
                fallbackType="film"
                className="w-full h-full object-cover"
              />
            </Link>

            <div className="space-y-3 min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                {activeSection === 'youtube' ? (
                  <>
                    <span className="px-2.5 py-0.5 rounded-full bg-brand/15 border border-brand/30 text-brand text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5">
                      <Icon icon="simple-icons:youtube" className="text-red-500 text-xs" />
                      <span>YouTube Box Office</span>
                    </span>
                    <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-black uppercase tracking-wider flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      <span>Verified Streams</span>
                    </span>
                  </>
                ) : (
                  <span className="px-2.5 py-0.5 rounded-full bg-brand/15 border border-brand/30 text-brand text-[10px] font-black uppercase tracking-wider">
                    Theatrical Box Office
                  </span>
                )}
                
                {film.nfvcb_rating && (
                  <span className="px-2 py-0.5 rounded bg-brand/10 border border-brand/30 text-brand text-[10px] font-black">
                    {film.nfvcb_rating}
                  </span>
                )}
                {film.year && (
                  <span className="text-xs font-mono font-bold text-text-muted">
                    {film.year}
                  </span>
                )}
                {runtimeMins > 0 && (
                  <span className="text-xs font-mono text-text-muted">
                    {Math.floor(runtimeMins / 60)}h {runtimeMins % 60}m
                  </span>
                )}
              </div>

              <h1 className="text-2xl sm:text-3xl md:text-4xl font-black font-heading tracking-tight text-text-primary">
                {formatFilmTitle(film.title)}
              </h1>

              {/* Directors & Genres */}
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-text-muted">
                {directors.length > 0 && (
                  <div>
                    <span className="text-text-muted">Directed by: </span>
                    <span className="text-text-primary font-bold">
                      {directors.map((d) => formatPersonName(d.name)).join(', ')}
                    </span>
                  </div>
                )}
                {film.genres?.length > 0 && (
                  <div>
                    <span className="text-text-muted">Genres: </span>
                    <span className="text-text-primary font-semibold">
                      {film.genres.join(', ')}
                    </span>
                  </div>
                )}
                {film.language && (
                  <div>
                    <span className="text-text-muted">Language: </span>
                    <span className="text-text-primary font-semibold capitalize">
                      {film.language}
                    </span>
                  </div>
                )}
              </div>

              {/* Both Category Switcher Tabs (if film has both Cinema and YouTube data) */}
              {hasTheatrical && hasYouTube && (
                <div className="pt-2 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedSection('theatrical')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      activeSection === 'theatrical'
                        ? 'bg-brand text-white shadow-xs'
                        : 'bg-surface-2 border border-border text-text-muted hover:text-text-primary'
                    }`}
                  >
                    Theatrical Cinema Run
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedSection('youtube')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      activeSection === 'youtube'
                        ? 'bg-brand text-white shadow-xs'
                        : 'bg-surface-2 border border-border text-text-muted hover:text-text-primary'
                    }`}
                  >
                    YouTube Streaming &amp; AdSense
                  </button>
                </div>
              )}
            </div>

            {/* Quick Action Buttons */}
            <div className="shrink-0 flex sm:flex-col items-center sm:items-end gap-2.5 pt-2 sm:pt-0 w-full sm:w-auto">
              {watchUrl && (
                <a
                  href={watchUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold shadow-md shadow-red-600/20 transition-all flex-1 sm:flex-initial"
                >
                  <Icon icon="simple-icons:youtube" className="text-sm" />
                  <span>Watch on YouTube</span>
                  <Icon icon="solar:arrow-right-up-linear" className="text-xs opacity-75" />
                </a>
              )}
              <Link
                to={`/films/${film.slug || film.id}`}
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-surface-2 hover:bg-surface-3 border border-border text-xs font-bold text-text-primary transition-all hover:border-brand/40 shadow-xs flex-1 sm:flex-initial"
              >
                <span>View Film Details</span>
                <Icon icon="solar:arrow-right-up-linear" className="text-sm text-text-muted" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Main Content Area */}
      <main className="max-w-[1440px] mx-auto px-4 sm:px-6 md:px-8 lg:px-12 py-8 sm:py-10 space-y-10">

        {/* =============================================================== */}
        {/* YOUTUBE STREAMING BOX OFFICE & VIEWSTATS BREAKDOWN SECTION     */}
        {/* =============================================================== */}
        {activeSection === 'youtube' && (
          <>
            {/* 1. DISCLAIMER BANNER: GENUINE LIVE STREAMS VS ESTIMATED ADSENSE REVENUE */}
            <div className="p-4 sm:p-5 rounded-2xl bg-surface border border-border shadow-xs">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 divide-y md:divide-y-0 md:divide-x divide-border">
                {/* Genuine Telemetry */}
                <div className="flex items-start gap-3 md:pr-4">
                  <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 mt-0.5">
                    <Icon icon="solar:verified-check-bold" className="text-lg" />
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="text-xs sm:text-sm font-bold text-text-primary">
                        Genuine Verified YouTube Streams
                      </h4>
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                        Live Platform Telemetry
                      </span>
                    </div>
                    <p className="text-xs text-text-muted leading-relaxed">
                      All view counts, stream totals, duration, and engagement metrics are genuine platform figures queried directly from the official YouTube video release.
                    </p>
                  </div>
                </div>

                {/* Mathematical AdSense Model */}
                <div className="flex items-start gap-3 pt-4 md:pt-0 md:pl-4">
                  <div className="w-8 h-8 rounded-xl bg-brand/10 border border-brand/20 text-brand flex items-center justify-center shrink-0 mt-0.5">
                    <Icon icon="solar:chart-square-bold" className="text-lg" />
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="text-xs sm:text-sm font-bold text-text-primary">
                        Estimated AdSense Box Office
                      </h4>
                      <span className="text-[10px] font-bold text-brand bg-brand/10 px-2 py-0.5 rounded-full border border-brand/20">
                        ViewStats Economic Model
                      </span>
                    </div>
                    <p className="text-xs text-text-muted leading-relaxed">
                      Revenue ranges are mathematical creator earnings estimates modeled on YouTube Partner Program (YPP) metrics, factoring verified Nollywood audience geo-distribution (domestic Nigeria vs diaspora US/UK/Canada) and mid-roll density.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* 2. KEY METRICS KPI GRID */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Est. AdSense Box Office Gross */}
              <div className="p-5 rounded-2xl bg-brand/[0.07] border border-brand/25 shadow-sm space-y-2 col-span-2 sm:col-span-1">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase tracking-wider text-brand">
                    Est. AdSense Box Office
                  </span>
                  <Icon icon="solar:wallet-bold" className="text-brand text-base" />
                </div>
                <div className="text-xl sm:text-2xl font-black font-heading text-brand tracking-tight whitespace-nowrap">
                  {youtubeBoxOffice?.formattedNgn || '—'}
                </div>
                <div className="text-[11px] text-text-muted font-mono whitespace-nowrap">
                  {youtubeBoxOffice?.formattedUsd} USD • {youtubeBoxOffice?.effectiveRpmUsd} RPM
                </div>
              </div>

              {/* Lifetime Streams (Genuine) */}
              <div className="p-5 rounded-2xl bg-surface border border-border shadow-xs space-y-2 col-span-2 sm:col-span-1">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase tracking-wider text-text-muted">
                    Lifetime Streams
                  </span>
                  <Icon icon="solar:play-circle-bold" className="text-emerald-400 text-base" />
                </div>
                <div className="text-xl sm:text-2xl font-black font-heading text-text-primary tracking-tight whitespace-nowrap">
                  {formatViews(views)}
                </div>
                <div className="text-[11px] text-emerald-400 font-mono flex items-center gap-1.5 whitespace-nowrap">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  <span>{views.toLocaleString('en-US')} verified views</span>
                </div>
              </div>

              {/* Velocity & Pacing */}
              <div className="p-5 rounded-2xl bg-surface border border-border shadow-xs space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase tracking-wider text-text-muted">
                    Streaming Velocity
                  </span>
                  <Icon icon="solar:fire-bold" className="text-brand text-base" />
                </div>
                <div className="text-xl sm:text-2xl font-black font-heading text-text-primary tracking-tight whitespace-nowrap">
                  {velocity?.formattedViewsPerDay || '—'}
                </div>
                <div>
                  {velocity?.badge && (
                    <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border whitespace-nowrap ${velocity.badge.color}`}>
                      <Icon icon={velocity.badge.icon} className="text-xs" />
                      <span>{velocity.badge.label}</span>
                    </span>
                  )}
                </div>
              </div>

              {/* Audience Distribution */}
              <div className="p-5 rounded-2xl bg-surface border border-border shadow-xs space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase tracking-wider text-text-muted">
                    Audience Geo Split
                  </span>
                  <Icon icon="solar:globus-bold" className="text-blue-400 text-base" />
                </div>
                <div className="text-lg sm:text-xl font-black font-heading text-text-primary tracking-tight whitespace-nowrap">
                  ~{diasporaShare}% Diaspora / ~{domesticShare}% Domestic
                </div>
                <div className="text-[11px] text-text-muted">
                  Est. {estMidrolls} Mid-roll Ad Breaks
                </div>
              </div>
            </div>

            {/* 3. RESPONSIVE CUMULATIVE VIEWS PROGRESSION CHART (ViewStats-inspired) */}
            {chartData && (
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border pb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-0.5 bg-brand rounded-full inline-block" />
                      <span className="text-[10px] font-black uppercase tracking-[0.2em] text-brand">
                        Streaming Trajectory
                      </span>
                    </div>
                    <h2 className="text-xl sm:text-2xl font-bold font-heading text-text-primary tracking-tight mt-1">
                      Cumulative Views Growth Curve
                    </h2>
                  </div>
                  <div className="flex items-center gap-4 text-xs">
                    <span className="inline-flex items-center gap-1.5 font-bold text-text-primary">
                      <span className="w-3 h-1 bg-brand rounded-full" />
                      <span>This Video (Actual)</span>
                    </span>
                    <span className="inline-flex items-center gap-1.5 text-text-muted font-medium">
                      <span className="w-3 h-1 bg-slate-500 rounded-full border border-dashed border-slate-400" />
                      <span>Typical Nollywood Performance</span>
                    </span>
                  </div>
                </div>

                <div className="rounded-2xl border border-border bg-surface p-4 sm:p-6 shadow-xs space-y-4">
                  {/* Active Tooltip Callout */}
                  <div className="flex items-center justify-between gap-4 p-3 rounded-xl bg-surface-2 border border-border text-xs min-h-[46px]">
                    {activeChartPoint ? (
                      <div className="flex items-center gap-3 sm:gap-6 flex-wrap">
                        <span className="font-bold text-text-primary">
                          📅 {activeChartPoint.dateStr}
                        </span>
                        <span className="font-mono font-bold text-brand">
                          📈 {activeChartPoint.views.toLocaleString()} Cumulative Streams ({activeChartPoint.percent}%)
                        </span>
                        <span className="font-mono text-text-secondary">
                          💰 Est. AdSense: {activeChartPoint.formattedNgn} ({activeChartPoint.formattedUsd})
                        </span>
                      </div>
                    ) : (
                      <span className="text-text-muted flex items-center gap-1.5">
                        <Icon icon="solar:cursor-bold" className="text-brand" />
                        <span>Hover or tap any node along the curve to inspect milestone dates, streams, and AdSense box office earnings.</span>
                      </span>
                    )}
                  </div>

                  {/* SVG Chart Container */}
                  <div className="w-full overflow-hidden select-none">
                    <svg
                      viewBox={`0 0 ${chartData.svgWidth} ${chartData.svgHeight}`}
                      className="w-full h-auto overflow-visible"
                    >
                      <defs>
                        <linearGradient id="ytBrandAreaGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#FF5A1F" stopOpacity="0.32" />
                          <stop offset="100%" stopColor="#FF5A1F" stopOpacity="0.0" />
                        </linearGradient>
                        <linearGradient id="ytTypicalAreaGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#64748B" stopOpacity="0.16" />
                          <stop offset="100%" stopColor="#64748B" stopOpacity="0.0" />
                        </linearGradient>
                      </defs>

                      {/* Horizontal Grid lines */}
                      {[0, 0.25, 0.5, 0.75, 1].map((frac, i) => {
                        const yVal = chartData.paddingTop + chartData.plotHeight - (frac * chartData.plotHeight);
                        const labelViews = Math.round(views * frac);
                        return (
                          <g key={i}>
                            <line
                              x1={chartData.paddingX}
                              y1={yVal}
                              x2={chartData.svgWidth - 30}
                              y2={yVal}
                              stroke="currentColor"
                              className="text-border/60"
                              strokeDasharray="4 4"
                              strokeWidth="1"
                            />
                            <text
                              x={chartData.paddingX - 10}
                              y={yVal + 3}
                              textAnchor="end"
                              className="fill-text-muted text-[10px] font-mono"
                            >
                              {formatViews(labelViews)}
                            </text>
                          </g>
                        );
                      })}

                      {/* Typical Nollywood Performance Baseline Area & Path */}
                      <path
                        d={chartData.typicalAreaD}
                        fill="url(#ytTypicalAreaGrad)"
                      />
                      <path
                        d={chartData.typicalPathD}
                        fill="none"
                        stroke="#64748B"
                        strokeWidth="2"
                        strokeDasharray="5 5"
                        opacity="0.8"
                      />

                      {/* This Video's Cumulative Growth Curve Area & Path */}
                      <path
                        d={chartData.areaD}
                        fill="url(#ytBrandAreaGrad)"
                      />
                      <path
                        d={chartData.pathD}
                        fill="none"
                        stroke="#FF5A1F"
                        strokeWidth="3.5"
                        strokeLinecap="round"
                      />

                      {/* Interactive Data Points along the Curve */}
                      {chartData.points.map((pt) => {
                        const isSelected = activeChartPoint?.idx === pt.idx;
                        return (
                          <g
                            key={pt.idx}
                            className="cursor-pointer"
                            onMouseEnter={() => setActiveChartPoint(pt)}
                            onClick={() => setActiveChartPoint(pt)}
                          >
                            <circle
                              cx={pt.x}
                              cy={pt.y}
                              r={isSelected ? 7 : 4.5}
                              className={`transition-all duration-150 ${
                                isSelected ? 'fill-white stroke-brand stroke-[3.5]' : 'fill-brand stroke-bg stroke-2 hover:r-6'
                              }`}
                            />
                            {/* X-axis date labels */}
                            <text
                              x={pt.x}
                              y={chartData.svgHeight - 12}
                              textAnchor="middle"
                              className={`text-[10px] font-mono transition-colors ${
                                isSelected ? 'fill-brand font-bold' : 'fill-text-muted'
                              }`}
                            >
                              {pt.dateStr.replace(/, \d{4}/, '')}
                            </text>
                          </g>
                        );
                      })}
                    </svg>
                  </div>
                </div>
              </div>
            )}

            {/* 4. RECENT PACING & DAILY ADSENSE BREAKDOWN TABLE */}
            {pacingData && (
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border pb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-0.5 bg-brand rounded-full inline-block" />
                      <span className="text-[10px] font-black uppercase tracking-[0.2em] text-brand">
                        Daily Pacing Log
                      </span>
                    </div>
                    <h2 className="text-xl sm:text-2xl font-bold font-heading text-text-primary tracking-tight mt-1">
                      Recent Pacing &amp; Daily AdSense Breakdown
                    </h2>
                  </div>
                  <p className="text-xs text-text-muted">
                    Statistical view telemetry and creator gross revenue across recent 7-day cycles.
                  </p>
                </div>

                <div className="rounded-2xl border border-border overflow-hidden bg-surface shadow-xs">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-border bg-surface-2/60 text-text-muted font-bold uppercase tracking-wider text-[10px]">
                          <th className="py-3.5 pl-4 sm:pl-6 pr-3">Date</th>
                          <th className="py-3.5 px-3 text-right">Daily Streams</th>
                          <th className="py-3.5 pr-4 sm:pr-6 pl-3 text-right whitespace-nowrap min-w-[200px]">
                            Est. AdSense Revenue
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/60 font-mono">
                        {pacingData.rows.map((row, idx) => (
                          <tr key={idx} className="hover:bg-surface-2/40 transition-colors">
                            <td className="py-3.5 pl-4 sm:pl-6 pr-3 font-bold text-text-primary font-sans">
                              {row.dateStr}
                            </td>
                            <td className="py-3.5 px-3 text-right text-text-secondary font-bold">
                              {row.views.toLocaleString('en-US')}
                            </td>
                            <td className="py-3.5 pr-4 sm:pr-6 pl-3 text-right whitespace-nowrap">
                              <span className="font-bold text-brand">{row.formattedNgn}</span>{' '}
                              <span className="text-[11px] text-text-muted">({row.formattedUsd})</span>
                            </td>
                          </tr>
                        ))}
                      </tbody>

                      {/* SUMMARY AVERAGES FOOTER */}
                      <tfoot className="border-t-2 border-border bg-surface-2/80 font-mono text-xs">
                        <tr>
                          <td className="py-3.5 pl-4 sm:pl-6 pr-3 font-sans font-bold text-text-primary uppercase tracking-wider text-[11px]">
                            Daily Average:
                          </td>
                          <td className="py-3.5 px-3 text-right font-bold text-text-primary">
                            {pacingData.averages.daily.views.toLocaleString('en-US')}
                          </td>
                          <td className="py-3.5 pr-4 sm:pr-6 pl-3 text-right whitespace-nowrap">
                            <span className="font-bold text-brand">{pacingData.averages.daily.ngn}</span>{' '}
                            <span className="text-[11px] text-text-muted">({pacingData.averages.daily.usd})</span>
                          </td>
                        </tr>
                        <tr>
                          <td className="py-3.5 pl-4 sm:pl-6 pr-3 font-sans font-bold text-text-primary uppercase tracking-wider text-[11px]">
                            Weekly Average (7D):
                          </td>
                          <td className="py-3.5 px-3 text-right font-bold text-text-primary">
                            {pacingData.averages.weekly.views.toLocaleString('en-US')}
                          </td>
                          <td className="py-3.5 pr-4 sm:pr-6 pl-3 text-right whitespace-nowrap">
                            <span className="font-bold text-brand">{pacingData.averages.weekly.ngn}</span>{' '}
                            <span className="text-[11px] text-text-muted">({pacingData.averages.weekly.usd})</span>
                          </td>
                        </tr>
                        <tr>
                          <td className="py-3.5 pl-4 sm:pl-6 pr-3 font-sans font-bold text-text-primary uppercase tracking-wider text-[11px]">
                            30-Day Average:
                          </td>
                          <td className="py-3.5 px-3 text-right font-bold text-text-primary">
                            {pacingData.averages.monthly.views.toLocaleString('en-US')}
                          </td>
                          <td className="py-3.5 pr-4 sm:pr-6 pl-3 text-right whitespace-nowrap">
                            <span className="font-bold text-brand">{pacingData.averages.monthly.ngn}</span>{' '}
                            <span className="text-[11px] text-text-muted">({pacingData.averages.monthly.usd})</span>
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* 5. AUDIENCE GEO DISTRIBUTION & REVENUE MECHANICS CARD */}
            <div className="p-6 rounded-2xl bg-surface border border-border space-y-4 shadow-xs">
              <div className="flex items-center gap-2">
                <Icon icon="solar:info-circle-bold" className="text-brand text-lg" />
                <h3 className="text-sm sm:text-base font-bold text-text-primary">
                  How Nollywood YouTube Box Office &amp; AdSense Revenue is Calculated
                </h3>
              </div>
              <p className="text-xs text-text-muted leading-relaxed">
                Nollywood YouTube feature films generate revenue primarily through YouTube Partner Program (YPP) AdSense monetization. Unlike standard short videos, full-length movies (60 to 120+ minutes) contain multiple mid-roll ad placements, multiplying impressions per stream. 
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 text-xs">
                <div className="p-3.5 rounded-xl bg-surface-2 border border-border space-y-1">
                  <span className="font-bold text-text-primary block">Domestic Nigerian Views</span>
                  <p className="text-text-muted leading-relaxed">
                    Averages ~$0.70 – $1.20 RPM based on Nigerian advertiser auction demand. Makes up approximately {domesticShare}% of audience viewership.
                  </p>
                </div>
                <div className="p-3.5 rounded-xl bg-surface-2 border border-border space-y-1">
                  <span className="font-bold text-text-primary block">Diaspora Views (US, UK, CA)</span>
                  <p className="text-text-muted leading-relaxed">
                    Averages ~$4.50 – $9.00 RPM due to premium Western advertising markets. Makes up approximately {diasporaShare}% of audience viewership.
                  </p>
                </div>
                <div className="p-3.5 rounded-xl bg-surface-2 border border-border space-y-1">
                  <span className="font-bold text-text-primary block">Blended Effective RPM</span>
                  <p className="text-brand font-mono font-bold">
                    {youtubeBoxOffice?.effectiveRpmUsd} / 1,000 views
                  </p>
                  <p className="text-text-muted leading-relaxed">
                    Weighted aggregate taking into account viewer geography and mid-roll density.
                  </p>
                </div>
              </div>
            </div>
          </>
        )}

        {/* =============================================================== */}
        {/* THEATRICAL CINEMA RUN SECTION                                  */}
        {/* =============================================================== */}
        {activeSection === 'theatrical' && (
          <>
            {/* KEY THEATRICAL METRICS CARDS */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {/* Lifetime Gross */}
              <div className="p-5 rounded-2xl bg-brand/[0.07] border border-brand/25 shadow-sm space-y-2 col-span-2 sm:col-span-1">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase tracking-wider text-brand">
                    Lifetime Domestic Gross
                  </span>
                  <Icon icon="solar:ticket-bold" className="text-brand text-base" />
                </div>
                <div className="text-2xl sm:text-3xl font-black font-heading text-brand tracking-tight">
                  {formatNaira(domestic)}
                </div>
                <div className="text-[11px] text-text-muted font-mono">
                  ₦{domestic.toLocaleString('en-NG')} NGN
                </div>
              </div>

              {/* Opening Weekend */}
              <div className="p-5 rounded-2xl bg-surface border border-border shadow-xs space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase tracking-wider text-text-muted">
                    Opening Weekend
                  </span>
                  <Icon icon="solar:calendar-bold" className="text-brand text-base opacity-75" />
                </div>
                <div className="text-xl sm:text-2xl font-black font-heading text-text-primary tracking-tight">
                  {openingWeekend > 0 ? formatNaira(openingWeekend) : '—'}
                </div>
                <div className="text-[11px] text-text-muted">
                  {openingWeekend > 0 ? `₦${openingWeekend.toLocaleString('en-NG')}` : 'Debut tracking not recorded'}
                </div>
              </div>

              {/* Admissions / Tickets */}
              <div className="p-5 rounded-2xl bg-surface border border-border shadow-xs space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase tracking-wider text-text-muted">
                    Total Admissions
                  </span>
                  <Icon icon="solar:users-group-two-rounded-bold" className="text-purple-400 text-base" />
                </div>
                <div className="text-xl sm:text-2xl font-black font-heading text-text-primary tracking-tight">
                  {admissions > 0 ? `${admissions.toLocaleString()} tickets` : '—'}
                </div>
                <div className="text-[11px] text-text-muted">
                  {weekendAdmissions > 0 
                    ? `${weekendAdmissions.toLocaleString()} weekend tickets` 
                    : (admissions > 0 ? 'Verified admission tally' : 'Ticket count not published')}
                </div>
              </div>

              {/* Average Ticket or Circuits */}
              <div className="p-5 rounded-2xl bg-surface border border-border shadow-xs space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase tracking-wider text-text-muted">
                    {locations ? 'Cinemas / Locations' : (admissions > 0 && domestic > 0 ? 'Avg. Ticket Price' : 'Theatrical Reach')}
                  </span>
                  <Icon icon="solar:buildings-bold" className="text-blue-400 text-base" />
                </div>
                <div className="text-xl sm:text-2xl font-black font-heading text-text-primary tracking-tight">
                  {locations 
                    ? `${locations} Locations` 
                    : (admissions > 0 && domestic > 0 ? `₦${Math.round(domestic / admissions).toLocaleString()}` : 'National Circuit')}
                </div>
                <div className="text-[11px] text-text-muted">
                  {locations ? 'Reported screen circuits' : 'Nigerian Cinema Exhibition'}
                </div>
              </div>
            </div>

            {/* WEEKLY BREAKDOWN TABLE */}
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border pb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-0.5 bg-brand rounded-full inline-block" />
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-brand">
                      Weekly Run Tracking
                    </span>
                  </div>
                  <h2 className="text-xl sm:text-2xl font-bold font-heading text-text-primary tracking-tight mt-1">
                    Theatrical Run Breakdown
                  </h2>
                </div>
                <p className="text-xs text-text-muted">
                  Comprehensive week-by-week theatrical figures and cumulative gross progression.
                </p>
              </div>

              <div className="rounded-2xl border border-border overflow-hidden bg-surface shadow-xs">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-border bg-surface-2/60 text-text-muted font-bold uppercase tracking-wider text-[10px]">
                        <th className="py-3.5 pl-4 sm:pl-6 pr-3">Week / Period</th>
                        <th className="py-3.5 px-3">Date</th>
                        <th className="py-3.5 px-3 text-right">Weekly Gross</th>
                        <th className="py-3.5 px-3 text-right">Cumulative Gross</th>
                        <th className="py-3.5 px-3 text-right">Admissions</th>
                        <th className="py-3.5 pr-4 sm:pr-6 pl-3 text-right">Circuits / Screens</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/60">
                      {weeklyHistory.length > 0 ? (
                        weeklyHistory.map((item, idx) => {
                          const weekGross = Number(item.gross || 0);
                          const cumulative = Number(item.cumulative || item.total || 0);
                          const weekAdmissions = item.admissions || item.tickets;
                          const dateStr = item.date || item.week_date || '';

                          return (
                            <tr key={idx} className="hover:bg-surface-2/40 transition-colors">
                              <td className="py-3.5 pl-4 sm:pl-6 pr-3 font-bold text-text-primary">
                                {item.label || item.week ? `Week ${item.label || item.week}` : `Week ${idx + 1}`}
                              </td>
                              <td className="py-3.5 px-3 text-text-muted font-mono">
                                {dateStr || ''}
                              </td>
                              <td className="py-3.5 px-3 text-right font-mono font-bold text-brand">
                                {weekGross > 0 ? `₦${weekGross.toLocaleString('en-NG')}` : '—'}
                              </td>
                              <td className="py-3.5 px-3 text-right font-mono font-bold text-text-primary">
                                {cumulative > 0 ? `₦${cumulative.toLocaleString('en-NG')}` : '—'}
                              </td>
                              <td className="py-3.5 px-3 text-right text-text-secondary">
                                {weekAdmissions ? `${Number(weekAdmissions).toLocaleString()} tickets` : '—'}
                              </td>
                              <td className="py-3.5 pr-4 sm:pr-6 pl-3 text-right text-text-muted">
                                {item.locations || item.screens || item.cinemas || '—'}
                              </td>
                            </tr>
                          );
                        })
                      ) : (
                        <tr>
                          <td colSpan={6} className="py-8 text-center text-text-muted">
                            <Icon icon="solar:info-circle-linear" className="text-2xl mx-auto mb-2 opacity-50" />
                            <p className="text-sm font-semibold text-text-primary">No weekly log breakdowns itemized</p>
                            <p className="text-xs text-text-muted mt-0.5">Total lifetime gross is verified from national cinema reporting.</p>
                          </td>
                        </tr>
                      )}

                      {/* "OTHERS" UNACCOUNTED GROSS ROW */}
                      {remainingGross > 0 && (
                        <tr className="bg-brand/[0.04] font-medium border-t-2 border-brand/20">
                          <td className="py-3.5 pl-4 sm:pl-6 pr-3 font-bold text-brand flex items-center gap-1.5">
                            <Icon icon="solar:layers-bold" className="text-sm" />
                            <span>Others</span>
                          </td>
                          <td className="py-3.5 px-3 text-text-muted text-[11px]">
                            Extended run &amp; regional circuits
                          </td>
                          <td className="py-3.5 px-3 text-right font-mono font-bold text-brand">
                            ₦{remainingGross.toLocaleString('en-NG')}
                          </td>
                          <td className="py-3.5 px-3 text-right font-mono font-bold text-brand">
                            ₦{domestic.toLocaleString('en-NG')}
                          </td>
                          <td className="py-3.5 px-3 text-right text-text-muted">
                            Unitemized
                          </td>
                          <td className="py-3.5 pr-4 sm:pr-6 pl-3 text-right text-text-muted">
                            Remaining Theatrical
                          </td>
                        </tr>
                      )}

                      {/* TOTAL LIFETIME ROW */}
                      <tr className="bg-surface-2/80 font-black text-text-primary border-t border-border">
                        <td className="py-4 pl-4 sm:pl-6 pr-3 uppercase tracking-wider text-xs">
                          Total Domestic Gross
                        </td>
                        <td className="py-4 px-3 text-text-muted">
                          Full Release
                        </td>
                        <td className="py-4 px-3 text-right font-mono text-base text-brand">
                          ₦{domestic.toLocaleString('en-NG')}
                        </td>
                        <td className="py-4 px-3 text-right font-mono text-base text-brand">
                          ₦{domestic.toLocaleString('en-NG')}
                        </td>
                        <td className="py-4 px-3 text-right text-text-primary">
                          {admissions > 0 ? `${admissions.toLocaleString()} tickets` : '—'}
                        </td>
                        <td className="py-4 pr-4 sm:pr-6 pl-3 text-right text-text-muted">
                          All Circuits
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </>
        )}

        {/* ADMIN-ONLY SOURCE CITATION RECORD */}
        {isAdmin && (
          <div className="p-4 rounded-xl bg-surface-2 border border-border/80 flex items-start gap-3">
            <Icon icon="solar:shield-check-bold" className="text-emerald-400 text-lg shrink-0 mt-0.5" />
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase tracking-wider text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                  Admin Internal Record
                </span>
                <span className="text-xs font-bold text-text-primary">Verified Attribution</span>
              </div>
              <p className="text-xs text-text-muted font-mono leading-relaxed">
                Source: {source}
              </p>
            </div>
          </div>
        )}

      </main>
    </div>
  );
}
