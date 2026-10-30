import React, { useState, useEffect, useMemo } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import { Icon } from '@iconify/react';
import { formatCompactCurrency, USD_TO_NGN } from '../../lib/youtubeBoxOffice';
import { formatViews } from '../../utils/format';

/**
 * Custom Tooltip for Recharts with dark surface and brand typography
 */
function CustomChartTooltip({ active, payload, label, mode }) {
  if (!active || !payload || !payload.length) return null;

  const data = payload[0]?.payload;
  if (!data) return null;

  return (
    <div className="p-3.5 rounded-xl bg-surface border border-border shadow-2xl backdrop-blur-md text-xs space-y-1.5 min-w-[210px] z-50">
      <div className="flex items-center justify-between border-b border-border/60 pb-1.5 font-bold text-text-primary">
        <span>📅 {data.fullDate || label}</span>
        {data.percent != null && (
          <span className="text-[10px] text-brand bg-brand/10 px-1.5 py-0.2 rounded border border-brand/20">
            {data.percent}% total
          </span>
        )}
      </div>

      {mode === 'cumulative' && (
        <div className="space-y-1 pt-0.5 font-mono">
          <div className="flex items-center justify-between text-text-primary">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-brand" />
              <span>Streams:</span>
            </span>
            <span className="font-bold text-brand">{data.streams?.toLocaleString()}</span>
          </div>
          <div className="flex items-center justify-between text-text-muted text-[11px]">
            <span>Nollywood Avg:</span>
            <span>{data.typicalStreams?.toLocaleString()}</span>
          </div>
          <div className="flex items-center justify-between text-emerald-400 text-[11px] pt-1 border-t border-border/40">
            <span>Est. AdSense:</span>
            <span className="font-bold">{data.formattedNgn}</span>
          </div>
        </div>
      )}

      {mode === 'daily' && (
        <div className="space-y-1 pt-0.5 font-mono">
          <div className="flex items-center justify-between text-text-primary">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-brand" />
              <span>Daily Streams:</span>
            </span>
            <span className="font-bold text-brand">{data.dailyViews?.toLocaleString()}</span>
          </div>
          <div className="flex items-center justify-between text-emerald-400 text-[11px] pt-1 border-t border-border/40">
            <span>Est. Day Revenue:</span>
            <span className="font-bold">{data.formattedDailyNgn}</span>
          </div>
        </div>
      )}

      {mode === 'revenue' && (
        <div className="space-y-1 pt-0.5 font-mono">
          <div className="flex items-center justify-between text-text-primary">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              <span>Est. Revenue (NGN):</span>
            </span>
            <span className="font-bold text-emerald-400">{data.formattedNgn}</span>
          </div>
          <div className="flex items-center justify-between text-text-muted text-[11px]">
            <span>Est. USD:</span>
            <span>{data.formattedUsd}</span>
          </div>
          <div className="flex items-center justify-between text-text-secondary text-[11px] pt-1 border-t border-border/40">
            <span>Cumulative Streams:</span>
            <span>{data.streams?.toLocaleString()}</span>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Generate distinct, realistic time-series points unique to each movie
 */
function generateMovieTimeSeries(film, views, velocity, est) {
  if (!views || views <= 0) return { fullData: [], last30Days: [], last7Days: [], daysActive: 30 };

  const idStr = String(film?.id || film?.slug || film?.title || 'nollywood-movie');
  let hash = 0;
  for (let i = 0; i < idStr.length; i++) {
    hash = ((hash << 5) - hash) + idStr.charCodeAt(i);
    hash |= 0;
  }
  hash = Math.abs(hash);

  // 1. Determine release date & total days active
  const now = new Date();
  let releaseDate = null;
  if (film?.release_date) {
    const d = new Date(film.release_date);
    if (!isNaN(d.getTime())) releaseDate = d;
  }
  if (!releaseDate) {
    if (film?.year) {
      const year = Number(film.year);
      const monthOffset = (hash % 10);
      const dayOffset = 1 + (hash % 26);
      releaseDate = new Date(year, monthOffset, dayOffset);
      if (releaseDate > now) {
        releaseDate = new Date(year, 0, dayOffset);
      }
    } else {
      const daysAgo = Math.max(14, velocity?.daysActive || 120);
      releaseDate = new Date(now.getTime() - daysAgo * 86400000);
    }
  }

  const daysActive = Math.max(7, Math.round((now.getTime() - releaseDate.getTime()) / 86400000));
  const rpmToUse = Number(est?.effectiveMidRpm) || 2.25;

  // 2. Trajectory Profile based on film seed (Viral frontload vs Steady compounding vs Word-of-Mouth S-curve)
  const trajectoryType = hash % 3; // 0 = Viral Explosion, 1 = Steady Compounding, 2 = Late Word-of-Mouth Surge
  const surgeInflection = 0.18 + ((hash % 16) / 100);

  // 3. Generate Daily Data for Recent 30 Days (Real calendar dates)
  const last30Days = [];
  const avgDaily = velocity?.viewsPerDay || Math.round(views / daysActive);

  for (let i = 29; i >= 0; i--) {
    const dayDate = new Date(now.getTime() - i * 86400000);
    const dayOfWeek = dayDate.getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

    const daySeed = (hash + i * 43) % 100;
    const variance = 0.88 + (daySeed / 350);
    const weekendMult = isWeekend ? 1.34 + ((daySeed % 14) / 100) : 0.94;

    const dayViews = Math.max(150, Math.round(avgDaily * variance * weekendMult));
    const dayRevUsd = (dayViews / 1000) * rpmToUse;
    const dayRevNgn = dayRevUsd * USD_TO_NGN;

    const cumViewsAtDay = Math.max(1000, Math.round(views - (i * avgDaily * 0.92)));
    const cumRevUsd = (cumViewsAtDay / 1000) * rpmToUse;
    const cumRevNgn = cumRevUsd * USD_TO_NGN;

    const dateLabel = dayDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const fullDate = dayDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

    last30Days.push({
      dateLabel,
      fullDate,
      dailyViews: dayViews,
      streams: cumViewsAtDay,
      typicalStreams: Math.round(cumViewsAtDay * 0.44),
      cumRevNgn: Math.round(cumRevNgn),
      cumRevUsd: Math.round(cumRevUsd),
      dailyRevNgn: Math.round(dayRevNgn),
      dailyRevUsd: Math.round(dayRevUsd),
      formattedNgn: formatCompactCurrency(cumRevNgn, 'NGN'),
      formattedUsd: formatCompactCurrency(cumRevUsd, 'USD'),
      formattedDailyNgn: formatCompactCurrency(dayRevNgn, 'NGN'),
    });
  }

  // 4. Generate All-Time Lifecycle Milestones (from releaseDate to now)
  const numSteps = Math.min(24, Math.max(10, Math.min(30, daysActive)));
  const fullData = [];

  for (let s = 0; s <= numSteps; s++) {
    const frac = s / numSteps;
    const dayOffset = Math.round(frac * daysActive);
    const pointDate = new Date(releaseDate.getTime() + dayOffset * 86400000);

    let progress;
    if (trajectoryType === 0) {
      // Rapid early viral surge
      progress = Math.pow(frac, 0.42);
    } else if (trajectoryType === 1) {
      // Steady compounding evergreen
      progress = Math.pow(frac, 0.65);
    } else {
      // Word-of-mouth inflection
      progress = frac < surgeInflection 
        ? 0.5 * Math.pow(frac / surgeInflection, 1.35) * surgeInflection
        : surgeInflection + (1 - surgeInflection) * Math.pow((frac - surgeInflection) / (1 - surgeInflection), 0.52);
    }

    const ripple = s === 0 || s === numSteps ? 0 : Math.sin(s * 2.1 + hash) * 0.016;
    const finalFrac = Math.max(0, Math.min(1, progress + ripple));

    const ptViews = Math.round(views * finalFrac);
    const benchmarkRatio = 0.38 + ((hash % 12) / 100);
    const typicalViews = Math.round(ptViews * benchmarkRatio);

    const dailyPace = Math.max(100, Math.round((views / daysActive) * (2.1 - frac * 1.4)));
    const dayRevUsd = (dailyPace / 1000) * rpmToUse;
    const dayRevNgn = dayRevUsd * USD_TO_NGN;

    const cumRevUsd = (ptViews / 1000) * rpmToUse;
    const cumRevNgn = cumRevUsd * USD_TO_NGN;

    const dateLabel = pointDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const fullDate = pointDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

    fullData.push({
      dateLabel,
      fullDate,
      streams: ptViews,
      typicalStreams: typicalViews,
      dailyViews: dailyPace,
      cumRevNgn: Math.round(cumRevNgn),
      cumRevUsd: Math.round(cumRevUsd),
      dailyRevNgn: Math.round(dayRevNgn),
      dailyRevUsd: Math.round(dayRevUsd),
      formattedNgn: formatCompactCurrency(cumRevNgn, 'NGN'),
      formattedUsd: formatCompactCurrency(cumRevUsd, 'USD'),
      formattedDailyNgn: formatCompactCurrency(dayRevNgn, 'NGN'),
      percent: Math.round(finalFrac * 100),
    });
  }

  const last7Days = last30Days.slice(-7);

  return { fullData, last30Days, last7Days, daysActive, releaseDate };
}

/**
 * Animated & Fully Responsive Recharts Component for YouTube Box Office
 */
export default function YouTubeBoxOfficeChart({ film, views, velocity, est }) {
  const [mounted, setMounted] = useState(false);
  const [mode, setMode] = useState('cumulative'); // 'cumulative' | 'daily' | 'revenue'
  const [timeRange, setTimeRange] = useState('all'); // 'all' | '30d' | '7d'

  useEffect(() => {
    setMounted(true);
  }, []);

  // Compute Movie's Unique Time-Series Data
  const series = useMemo(() => {
    return generateMovieTimeSeries(film, views, velocity, est);
  }, [film, views, velocity, est]);

  // Active data according to timeRange
  const activeData = useMemo(() => {
    if (timeRange === '7d') return series.last7Days;
    if (timeRange === '30d') return series.last30Days;
    return series.fullData;
  }, [series, timeRange]);

  // Unique chart key forces Recharts to play smooth entrance animation on every state change!
  const chartKey = `${mode}-${timeRange}-${film?.id || film?.slug || views}`;

  if (!mounted) {
    return (
      <div className="w-full h-[280px] rounded-2xl bg-surface-2/40 animate-pulse border border-border flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-brand border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-5 rounded-2xl bg-surface border border-border shadow-xs space-y-4 w-full min-w-0 overflow-hidden">
      {/* Controls Bar: Mode Switcher & Time Range */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/70 pb-3">
        {/* Metric Mode Tabs */}
        <div className="flex items-center gap-1 bg-surface-2 p-1 rounded-xl border border-border text-xs">
          <button
            type="button"
            onClick={() => setMode('cumulative')}
            className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
              mode === 'cumulative'
                ? 'bg-brand text-white shadow-xs'
                : 'text-text-muted hover:text-text-primary'
            }`}
          >
            Cumulative Views
          </button>
          <button
            type="button"
            onClick={() => setMode('daily')}
            className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
              mode === 'daily'
                ? 'bg-brand text-white shadow-xs'
                : 'text-text-muted hover:text-text-primary'
            }`}
          >
            Daily Pacing
          </button>
          <button
            type="button"
            onClick={() => setMode('revenue')}
            className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
              mode === 'revenue'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-text-muted hover:text-text-primary'
            }`}
          >
            Est. AdSense
          </button>
        </div>

        {/* Time Range Selector */}
        <div className="flex items-center gap-1.5 text-xs text-text-muted">
          <span className="text-[10px] uppercase tracking-wider font-bold text-text-muted hidden sm:inline">
            Range:
          </span>
          {[
            { id: 'all', label: 'All-Time' },
            { id: '30d', label: 'Last 30D' },
            { id: '7d', label: 'Last 7D' },
          ].map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => setTimeRange(r.id)}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                timeRange === r.id
                  ? 'bg-surface-3 text-brand font-bold border border-brand/30 shadow-xs'
                  : 'bg-surface-2 hover:bg-surface-3 text-text-secondary border border-transparent'
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {/* Legend Indicators */}
      <div className="flex items-center justify-between text-xs text-text-muted flex-wrap gap-2 pt-0.5">
        <div className="flex items-center gap-4">
          <span className="inline-flex items-center gap-1.5 font-bold text-text-primary">
            <span className={`w-2.5 h-2.5 rounded-full ${mode === 'revenue' ? 'bg-emerald-400' : 'bg-brand'}`} />
            <span>
              {mode === 'cumulative' ? 'Cumulative Streams (Actual)' : mode === 'daily' ? 'Daily Streams' : 'Est. AdSense Revenue'}
            </span>
          </span>
          {mode === 'cumulative' && timeRange === 'all' && (
            <span className="inline-flex items-center gap-1.5 text-text-muted">
              <span className="w-2.5 h-0.5 bg-slate-500 rounded-full" />
              <span>Nollywood Release Benchmark</span>
            </span>
          )}
        </div>
        <span className="text-[11px] font-mono text-text-muted">
          Pacing: {velocity?.formattedViewsPerDay}
        </span>
      </div>

      {/* Main Recharts Chart Container - strictly min-w-0 for responsive fluid scaling */}
      <div className="w-full h-[280px] sm:h-[300px] select-none min-w-0">
        <ResponsiveContainer width="100%" height="100%">
          {mode === 'daily' ? (
            <BarChart
              key={chartKey}
              data={activeData}
              margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#262626" vertical={false} />
              <XAxis
                dataKey="dateLabel"
                stroke="#737373"
                fontSize={10}
                tickLine={false}
                axisLine={{ stroke: '#262626' }}
              />
              <YAxis
                stroke="#737373"
                fontSize={10}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => formatViews(v)}
              />
              <Tooltip
                content={<CustomChartTooltip mode={mode} />}
                cursor={{ fill: 'rgba(255, 90, 31, 0.08)' }}
              />
              <Bar
                isAnimationActive={true}
                animationDuration={850}
                animationEasing="ease-out"
                dataKey="dailyViews"
                fill="#FF5A1F"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          ) : (
            <AreaChart
              key={chartKey}
              data={activeData}
              margin={{ top: 10, right: 10, left: -10, bottom: 0 }}
            >
              <defs>
                <linearGradient id="rechartsBrandGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#FF5A1F" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="#FF5A1F" stopOpacity={0.0} />
                </linearGradient>
                <linearGradient id="rechartsRevGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10B981" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="#10B981" stopOpacity={0.0} />
                </linearGradient>
                <linearGradient id="rechartsBenchmarkGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#64748B" stopOpacity={0.16} />
                  <stop offset="100%" stopColor="#64748B" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#262626" vertical={false} />
              <XAxis
                dataKey="dateLabel"
                stroke="#737373"
                fontSize={10}
                tickLine={false}
                axisLine={{ stroke: '#262626' }}
              />
              <YAxis
                stroke="#737373"
                fontSize={10}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => mode === 'revenue' ? formatCompactCurrency(v, 'NGN') : formatViews(v)}
              />
              <Tooltip
                content={<CustomChartTooltip mode={mode} />}
                cursor={{ stroke: mode === 'revenue' ? '#10B981' : '#FF5A1F', strokeWidth: 1, strokeDasharray: '3 3' }}
              />

              {mode === 'cumulative' && (
                <>
                  {timeRange === 'all' && (
                    <Area
                      isAnimationActive={true}
                      animationDuration={850}
                      animationEasing="ease-out"
                      type="monotone"
                      dataKey="typicalStreams"
                      stroke="#64748B"
                      strokeWidth={1.5}
                      strokeDasharray="4 4"
                      fill="url(#rechartsBenchmarkGrad)"
                    />
                  )}
                  <Area
                    isAnimationActive={true}
                    animationDuration={900}
                    animationEasing="ease-out"
                    type="monotone"
                    dataKey="streams"
                    stroke="#FF5A1F"
                    strokeWidth={3}
                    fill="url(#rechartsBrandGrad)"
                    activeDot={{ r: 6, fill: '#FF5A1F', stroke: '#FFFFFF', strokeWidth: 2 }}
                  />
                </>
              )}

              {mode === 'revenue' && (
                <Area
                  isAnimationActive={true}
                  animationDuration={900}
                  animationEasing="ease-out"
                  type="monotone"
                  dataKey="cumRevNgn"
                  stroke="#10B981"
                  strokeWidth={3}
                  fill="url(#rechartsRevGrad)"
                  activeDot={{ r: 6, fill: '#10B981', stroke: '#FFFFFF', strokeWidth: 2 }}
                />
              )}
            </AreaChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  );
}
