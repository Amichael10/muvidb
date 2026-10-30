import React, { useState, useMemo } from 'react';
import { Icon } from '@iconify/react';
import ImageWithFallback from '../ui/ImageWithFallback';
import {
  calculateYoutubeBoxOffice,
  calculateStreamingVelocity,
  parseRuntimeMinutes,
  formatCompactCurrency,
  USD_TO_NGN,
} from '../../lib/youtubeBoxOffice';
import { formatViews } from '../../utils/format';

/**
 * ViewStats-inspired Detailed YouTube Box Office & Streaming Analytics Modal
 * With interactive growth trajectory chart and pacing breakdown table.
 * 100% client-side computed: 0 Vercel compute, 0 external API calls, $0 cost.
 */
export default function YouTubeBreakdownModal({ film, onClose }) {
  if (!film) return null;

  const views = Number(film.view_count || 0);
  const runtimeMins = parseRuntimeMinutes(film.runtime_minutes || film.duration);
  const est = calculateYoutubeBoxOffice({
    viewCount: views,
    runtimeMinutes: runtimeMins,
    language: film.language,
    title: film.title,
  });

  const velocity = calculateStreamingVelocity({
    viewCount: views,
    releaseDate: film.release_date,
    year: film.year,
  });

  // Calculate estimated mid-rolls based on duration
  let estMidrolls = 1;
  if (runtimeMins >= 120) estMidrolls = '8 – 12';
  else if (runtimeMins >= 75) estMidrolls = '4 – 7';
  else if (runtimeMins >= 45) estMidrolls = '2 – 3';
  else if (runtimeMins >= 30) estMidrolls = '1 – 2';

  // Audience split assumption (indigenous vs english drama)
  const langText = `${film.language || ''} ${film.title || ''}`.toLowerCase();
  const isIndigenous = /yoruba|hausa|igbo|apatatv|yorubahood/i.test(langText);
  const domesticShare = isIndigenous ? 70 : 50;
  const diasporaShare = 100 - domesticShare;

  const watchUrl = film.youtube_watch_url || (film.source_video_id ? `https://www.youtube.com/watch?v=${film.source_video_id}` : null);

  // Active hover point on chart
  const [activePoint, setActivePoint] = useState(null);

  // Parse release date
  const releaseDateObj = useMemo(() => {
    if (film.release_date) {
      const d = new Date(film.release_date);
      if (!isNaN(d.getTime())) return d;
    }
    if (film.year) {
      return new Date(Number(film.year), 0, 1);
    }
    const d = new Date();
    d.setDate(d.getDate() - (velocity.daysActive || 120));
    return d;
  }, [film.release_date, film.year, velocity.daysActive]);

  // Compute Growth Trajectory Chart Data (ViewStats Cumulative Curve)
  const chartData = useMemo(() => {
    const totalDays = Math.max(7, velocity.daysActive || 30);
    const intervals = 8;
    const points = [];
    
    // SVG Dimensions
    const svgWidth = 560;
    const svgHeight = 170;
    const paddingX = 45;
    const paddingBottom = 30;
    const paddingTop = 20;
    const plotWidth = svgWidth - paddingX - 20;
    const plotHeight = svgHeight - paddingTop - paddingBottom;

    // Milestone fractions following Nollywood viral decay trajectory:
    // Rapid surge in early days, then steady compounding
    const dayFractions = [0, 0.05, 0.12, 0.25, 0.45, 0.68, 0.85, 1];
    const viewFractions = [0, 0.18, 0.35, 0.52, 0.69, 0.83, 0.93, 1];

    dayFractions.forEach((dFrac, idx) => {
      const dayOffset = Math.round(dFrac * totalDays);
      const pointDate = new Date(releaseDateObj.getTime() + dayOffset * 86400000);
      const ptViews = Math.round(views * viewFractions[idx]);
      
      const x = paddingX + dFrac * plotWidth;
      const y = paddingTop + plotHeight - (viewFractions[idx] * plotHeight);

      // Typical performance baseline (averaging ~40% of this hit's peak)
      const typicalFrac = viewFractions[idx] * 0.42;
      const typicalY = paddingTop + plotHeight - (typicalFrac * plotHeight);

      const dateStr = pointDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      
      points.push({
        idx,
        dayOffset,
        dateStr,
        views: ptViews,
        x,
        y,
        typicalY,
        percent: Math.round(viewFractions[idx] * 100),
      });
    });

    // SVG path string for main curve
    const pathD = points.reduce((acc, pt, i) => {
      if (i === 0) return `M ${pt.x} ${pt.y}`;
      // Smooth cubic bezier
      const prev = points[i - 1];
      const cx = (prev.x + pt.x) / 2;
      return `${acc} C ${cx} ${prev.y}, ${cx} ${pt.y}, ${pt.x} ${pt.y}`;
    }, '');

    // Area path for gradient fill under main curve
    const areaD = `${pathD} L ${points[points.length - 1].x} ${paddingTop + plotHeight} L ${points[0].x} ${paddingTop + plotHeight} Z`;

    // Typical baseline curve
    const typicalPathD = points.reduce((acc, pt, i) => {
      if (i === 0) return `M ${pt.x} ${pt.typicalY}`;
      const prev = points[i - 1];
      const cx = (prev.x + pt.x) / 2;
      return `${acc} C ${cx} ${prev.typicalY}, ${cx} ${pt.typicalY}, ${pt.x} ${pt.typicalY}`;
    }, '');

    const typicalAreaD = `${typicalPathD} L ${points[points.length - 1].x} ${paddingTop + plotHeight} L ${points[0].x} ${paddingTop + plotHeight} Z`;

    return { points, pathD, areaD, typicalPathD, typicalAreaD, svgWidth, svgHeight, paddingTop, plotHeight, paddingX, plotWidth };
  }, [views, velocity.daysActive, releaseDateObj]);

  // Compute Recent Daily Pacing Table Data (Last 7 Days)
  const pacingData = useMemo(() => {
    const rows = [];
    const avgDailyViews = velocity.viewsPerDay || Math.round(views / Math.max(1, velocity.daysActive));
    const now = new Date();
    const rpmToUse = Number(est.effectiveMidRpm) || 2.25;

    // Fluctuations for recent 7 days (mimics real YouTube viewing patterns with higher weekend traffic)
    const varianceMultipliers = [0.94, 0.91, 1.08, 1.15, 1.04, 0.96, 0.92];

    for (let i = 6; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 86400000);
      const mult = varianceMultipliers[6 - i] || 1;
      const dayViews = Math.max(10, Math.round(avgDailyViews * mult));
      
      // Calculate AdSense for this single day
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

    // Averages
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
  }, [views, velocity.viewsPerDay, velocity.daysActive, est.effectiveMidRpm]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div 
        className="relative w-full max-w-2xl lg:max-w-3xl rounded-2xl bg-surface border border-border shadow-2xl p-4 sm:p-6 space-y-5 max-h-[92vh] overflow-y-auto no-scrollbar"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-start justify-between gap-4 border-b border-border pb-4">
          <div className="flex items-center gap-3 min-w-0">
            {film.poster_url && (
              <div className="w-12 h-16 rounded-lg overflow-hidden border border-border shrink-0 bg-surface-2">
                <ImageWithFallback
                  src={film.poster_url}
                  alt={film.title}
                  fallbackType="film"
                  className="w-full h-full object-cover"
                />
              </div>
            )}
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-[11px] font-bold text-brand uppercase tracking-wider mb-0.5">
                <Icon icon="simple-icons:youtube" className="text-red-500 text-sm shrink-0" />
                <span>YouTube Box Office & ViewStats</span>
              </div>
              <h3 className="text-lg sm:text-xl font-black text-text-primary font-heading tracking-tight truncate">
                {film.title} {film.year ? `(${film.year})` : ''}
              </h3>
              <p className="text-xs text-text-muted">
                Active streaming pacing & lifetime digital box office model
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-surface-2 transition-colors cursor-pointer shrink-0"
            aria-label="Close"
          >
            <Icon icon="solar:close-circle-bold" className="text-2xl" />
          </button>
        </div>

        {/* Primary Metric Grid (4 Cards) */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3">
          {/* Estimated Digital Box Office */}
          <div className="p-3.5 rounded-xl bg-surface-2 border border-border/70 space-y-1">
            <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider block">Est. Box Office</span>
            <p className="text-base sm:text-lg font-black text-brand font-heading leading-tight truncate">
              {est.formattedNgn}
            </p>
            <span className="text-[11px] text-text-muted font-mono block">
              {est.formattedUsd}
            </span>
          </div>

          {/* Lifetime Views */}
          <div className="p-3.5 rounded-xl bg-surface-2 border border-border/70 space-y-1">
            <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider block">Lifetime Streams</span>
            <p className="text-base sm:text-lg font-black text-text-primary font-heading leading-tight flex items-center gap-1 truncate">
              <span>{formatViews(views)}</span>
            </p>
            <span className="text-[11px] text-text-muted font-mono block">
              {views.toLocaleString('en-US')}
            </span>
          </div>

          {/* Velocity & Pacing */}
          <div className="p-3.5 rounded-xl bg-surface-2 border border-border/70 space-y-1">
            <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider block">Velocity & Pacing</span>
            <div className="pt-0.5">
              <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border whitespace-nowrap ${velocity.badge.color}`}>
                <Icon icon={velocity.badge.icon} className="text-xs shrink-0" />
                <span>{velocity.badge.label}</span>
              </span>
            </div>
            <span className="text-[11px] text-text-primary font-mono font-bold block pt-0.5 truncate">
              ~{velocity.formattedViewsPerDay}
            </span>
          </div>

          {/* Runtime & Ad Density */}
          <div className="p-3.5 rounded-xl bg-surface-2 border border-border/70 space-y-1">
            <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider block">Runtime & Density</span>
            <p className="text-sm sm:text-base font-bold text-text-primary flex items-center gap-1 pt-0.5">
              <Icon icon="solar:clock-circle-bold" className="text-brand text-xs shrink-0" />
              <span>{Math.floor(runtimeMins / 60)}h {runtimeMins % 60}m</span>
            </p>
            <span className="text-[10px] text-text-muted block">
              ~{estMidrolls} Mid-Roll Breaks
            </span>
          </div>
        </div>

        {/* ------------------------------------------------------------- */}
        {/* VIEWSTATS SECTION 1: CUMULATIVE VIEWS PROGRESSION CHART       */}
        {/* ------------------------------------------------------------- */}
        <div className="p-4 rounded-xl bg-surface-2 border border-border/70 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <div className="flex items-center gap-2">
                <Icon icon="solar:chart-2-bold" className="text-brand text-base" />
                <h4 className="text-xs sm:text-sm font-bold text-text-primary font-heading">
                  Cumulative Views Progression
                </h4>
              </div>
              <p className="text-[11px] text-text-muted">
                Trajectory from premiere release to current lifetime streams
              </p>
            </div>

            {/* Legend */}
            <div className="flex items-center gap-3 text-[11px]">
              <span className="inline-flex items-center gap-1.5 font-semibold text-text-primary">
                <span className="w-2.5 h-2.5 rounded-full bg-brand inline-block"></span>
                <span>This video</span>
              </span>
              <span className="inline-flex items-center gap-1.5 text-text-muted">
                <span className="w-2.5 h-2.5 rounded-sm bg-neutral-600/60 inline-block"></span>
                <span>Typical baseline</span>
              </span>
            </div>
          </div>

          {/* SVG Progression Chart */}
          <div className="relative w-full overflow-hidden bg-bg/50 rounded-lg border border-border/40 p-2">
            <svg 
              viewBox={`0 0 ${chartData.svgWidth} ${chartData.svgHeight}`} 
              className="w-full h-44 sm:h-52 select-none"
            >
              <defs>
                {/* Brand gradient fill under curve */}
                <linearGradient id="brandAreaGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#FF5A1F" stopOpacity="0.25" />
                  <stop offset="100%" stopColor="#FF5A1F" stopOpacity="0.0" />
                </linearGradient>

                {/* Baseline gradient fill */}
                <linearGradient id="typicalAreaGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#71717A" stopOpacity="0.15" />
                  <stop offset="100%" stopColor="#71717A" stopOpacity="0.02" />
                </linearGradient>
              </defs>

              {/* Grid Lines & Y-Axis Labels */}
              {[0, 0.33, 0.66, 1].map((frac, idx) => {
                const y = chartData.paddingTop + chartData.plotHeight * (1 - frac);
                const labelVal = formatCompactCurrency(views * frac);
                return (
                  <g key={idx}>
                    <line
                      x1={chartData.paddingX}
                      y1={y}
                      x2={chartData.svgWidth - 20}
                      y2={y}
                      stroke="currentColor"
                      className="text-border/40"
                      strokeDasharray="3 3"
                      strokeWidth="1"
                    />
                    <text
                      x={chartData.paddingX - 6}
                      y={y + 3}
                      textAnchor="end"
                      className="text-[9px] fill-text-muted font-mono"
                    >
                      {labelVal}
                    </text>
                  </g>
                );
              })}

              {/* Typical Baseline Shaded Area & Line */}
              <path d={chartData.typicalAreaD} fill="url(#typicalAreaGradient)" />
              <path 
                d={chartData.typicalPathD} 
                fill="none" 
                stroke="#71717A" 
                strokeWidth="1.5" 
                strokeDasharray="4 4" 
                opacity="0.6"
              />

              {/* Main Movie Shaded Area */}
              <path d={chartData.areaD} fill="url(#brandAreaGradient)" />

              {/* Main Movie Curve */}
              <path 
                d={chartData.pathD} 
                fill="none" 
                stroke="#FF5A1F" 
                strokeWidth="2.5" 
                strokeLinecap="round"
              />

              {/* Milestone Dots */}
              {chartData.points.map((pt, i) => {
                const isHovered = activePoint?.idx === pt.idx;
                const isLast = i === chartData.points.length - 1;
                return (
                  <g 
                    key={pt.idx}
                    className="cursor-pointer"
                    onMouseEnter={() => setActivePoint(pt)}
                    onMouseLeave={() => setActivePoint(null)}
                    onClick={() => setActivePoint(pt)}
                  >
                    <circle
                      cx={pt.x}
                      cy={pt.y}
                      r={isHovered ? 6 : isLast ? 4.5 : 3}
                      fill={isHovered ? '#FFFFFF' : '#FF5A1F'}
                      stroke={isHovered ? '#FF5A1F' : '#FFFFFF'}
                      strokeWidth={isHovered ? 2.5 : 1.5}
                      className="transition-all duration-150"
                    />
                    {/* X-axis date labels */}
                    <text
                      x={pt.x}
                      y={chartData.svgHeight - 8}
                      textAnchor="middle"
                      className={`text-[8.5px] font-mono transition-colors ${
                        isHovered ? 'fill-brand font-bold' : 'fill-text-muted'
                      }`}
                    >
                      {pt.dateStr}
                    </text>
                  </g>
                );
              })}
            </svg>

            {/* Active Point Floating Tooltip */}
            {activePoint && (
              <div 
                className="absolute top-3 right-3 bg-surface/95 border border-brand/40 px-3 py-1.5 rounded-lg shadow-lg text-[11px] pointer-events-none animate-fade-in"
              >
                <div className="flex items-center gap-1.5 font-bold text-text-primary">
                  <span className="w-1.5 h-1.5 rounded-full bg-brand"></span>
                  <span>{activePoint.dateStr}:</span>
                  <span className="text-brand font-mono">{formatViews(activePoint.views)}</span>
                </div>
                <div className="text-[10px] text-text-muted font-mono">
                  Day {activePoint.dayOffset} ({activePoint.percent}% of current)
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ------------------------------------------------------------- */}
        {/* VIEWSTATS SECTION 2: RECENT DAILY PACING & PROJECTIONS TABLE */}
        {/* ------------------------------------------------------------- */}
        <div className="p-4 rounded-xl bg-surface-2 border border-border/70 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Icon icon="solar:calendar-date-bold" className="text-brand text-base" />
              <h4 className="text-xs sm:text-sm font-bold text-text-primary font-heading">
                Recent Pacing & Daily AdSense Breakdown
              </h4>
            </div>
            <span className="text-[10px] text-text-muted font-mono bg-bg px-2 py-0.5 rounded border border-border">
              ViewStats Model
            </span>
          </div>

          <div className="overflow-x-auto rounded-lg border border-border/60 bg-bg/60">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-border bg-surface-2/80 text-[10px] font-bold text-text-muted uppercase tracking-wider">
                  <th className="py-2.5 px-3">Date</th>
                  <th className="py-2.5 px-3 text-right">Daily Streams</th>
                  <th className="py-2.5 px-3 text-right">Est. AdSense Revenue</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40 font-mono text-[11px]">
                {pacingData.rows.map((row, idx) => (
                  <tr key={idx} className="hover:bg-surface/50 transition-colors">
                    <td className="py-2 px-3 text-text-secondary">{row.dateStr}</td>
                    <td className="py-2 px-3 text-right text-text-primary font-bold">
                      {row.views.toLocaleString('en-US')}
                    </td>
                    <td className="py-2 px-3 text-right text-brand font-bold">
                      {row.formattedNgn}{' '}
                      <span className="text-[10px] text-text-muted font-normal">({row.formattedUsd})</span>
                    </td>
                  </tr>
                ))}
              </tbody>
              {/* Summary Averages Footer */}
              <tfoot className="border-t-2 border-border bg-surface-2/90 font-mono text-[11px]">
                <tr>
                  <td className="py-2 px-3 font-sans font-bold text-text-primary text-[10px] uppercase">
                    Daily Average:
                  </td>
                  <td className="py-2 px-3 text-right font-bold text-text-primary">
                    {pacingData.averages.daily.views.toLocaleString('en-US')}
                  </td>
                  <td className="py-2 px-3 text-right font-bold text-brand">
                    {pacingData.averages.daily.ngn}{' '}
                    <span className="text-[10px] text-text-muted font-normal">({pacingData.averages.daily.usd})</span>
                  </td>
                </tr>
                <tr>
                  <td className="py-2 px-3 font-sans font-bold text-text-primary text-[10px] uppercase">
                    Weekly Average (7D):
                  </td>
                  <td className="py-2 px-3 text-right font-bold text-text-primary">
                    {pacingData.averages.weekly.views.toLocaleString('en-US')}
                  </td>
                  <td className="py-2 px-3 text-right font-bold text-brand">
                    {pacingData.averages.weekly.ngn}{' '}
                    <span className="text-[10px] text-text-muted font-normal">({pacingData.averages.weekly.usd})</span>
                  </td>
                </tr>
                <tr>
                  <td className="py-2 px-3 font-sans font-bold text-text-primary text-[10px] uppercase">
                    30-Day Average:
                  </td>
                  <td className="py-2 px-3 text-right font-bold text-text-primary">
                    {pacingData.averages.monthly.views.toLocaleString('en-US')}
                  </td>
                  <td className="py-2 px-3 text-right font-bold text-brand">
                    {pacingData.averages.monthly.ngn}{' '}
                    <span className="text-[10px] text-text-muted font-normal">({pacingData.averages.monthly.usd})</span>
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* Audience Mix & RPM Breakdown */}
        <div className="p-3.5 rounded-xl bg-brand/5 border border-brand/20 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-brand uppercase tracking-wider flex items-center gap-1.5 text-[11px]">
              <Icon icon="solar:users-group-rounded-bold" className="text-sm" />
              <span>Audience Demographics & CPM Modeling</span>
            </span>
            <span className="text-[10px] text-text-muted font-mono">
              ₦{USD_TO_NGN} / $1 USD
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="p-2.5 rounded-lg bg-surface border border-border/50 space-y-0.5">
              <span className="text-[10px] text-text-muted block uppercase font-semibold">Audience Mix</span>
              <div className="flex items-center justify-between font-mono font-bold text-[11px]">
                <span className="text-text-primary">Domestic: {domesticShare}%</span>
                <span className="text-brand">Diaspora: {diasporaShare}%</span>
              </div>
              <span className="text-[10px] text-text-muted block">
                {isIndigenous ? 'Higher domestic West Africa share' : 'High UK/US/Canada diaspora crossover'}
              </span>
            </div>

            <div className="p-2.5 rounded-lg bg-surface border border-border/50 space-y-0.5">
              <span className="text-[10px] text-text-muted block uppercase font-semibold">Effective Creator RPM</span>
              <p className="font-mono font-bold text-brand text-xs sm:text-sm">
                {est.effectiveRpmUsd} / 1K
              </p>
              <span className="text-[10px] text-text-muted block">
                Net creator rate after YouTube's 45% platform split
              </span>
            </div>
          </div>
        </div>

        {/* Action Button: Watch on YouTube */}
        {watchUrl && (
          <div className="pt-1">
            <a
              href={watchUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-brand hover:bg-brand-hover text-white font-bold text-xs sm:text-sm transition-all shadow-md active:scale-98 cursor-pointer"
            >
              <Icon icon="solar:play-bold" className="text-base" />
              <span>Watch Full Movie on YouTube</span>
              <Icon icon="solar:arrow-right-up-linear" className="text-xs opacity-75" />
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
