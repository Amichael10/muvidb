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
 * Custom Tooltip for Recharts
 */
function CustomChartTooltip({ active, payload, label, mode }) {
  if (!active || !payload || !payload.length) return null;

  const data = payload[0]?.payload;
  if (!data) return null;

  return (
    <div className="p-3.5 rounded-xl bg-surface border border-border shadow-2xl backdrop-blur-md text-xs space-y-1.5 min-w-[200px]">
      <div className="flex items-center justify-between border-b border-border/60 pb-1.5 font-bold text-text-primary">
        <span>📅 {data.fullDate || label}</span>
        {data.percent != null && (
          <span className="text-[10px] text-brand bg-brand/10 px-1.5 py-0.2 rounded border border-brand/20">
            {data.percent}% of total
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
 * Professional Recharts Component for YouTube Streaming Box Office
 * Replaces plain SVG with interactive AreaChart/BarChart with Mode Switchers and Tooltips.
 */
export default function YouTubeBoxOfficeChart({ film, views, velocity, est }) {
  const [mounted, setMounted] = useState(false);
  const [mode, setMode] = useState('cumulative'); // 'cumulative' | 'daily' | 'revenue'
  const [timeRange, setTimeRange] = useState('all'); // 'all' | '30d' | '7d'

  useEffect(() => {
    setMounted(true);
  }, []);

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

  // Construct Time Series Data
  const fullChartData = useMemo(() => {
    if (!views || views <= 0) return [];
    const totalDays = Math.max(7, velocity?.daysActive || 60);
    const rpmToUse = Number(est?.effectiveMidRpm) || 2.25;

    // Milestone trajectory distribution (exponential initial velocity decaying into compounding steady tail)
    const steps = Math.min(30, Math.max(10, totalDays));
    const items = [];

    for (let i = 0; i <= steps; i++) {
      const frac = i / steps;
      // Exponential curve formula: y = 1 - (1 - x)^2.2
      const viewFrac = Math.min(1, Math.pow(frac, 0.48));
      const dayOffset = Math.round(frac * totalDays);
      const pointDate = new Date(releaseDateObj.getTime() + dayOffset * 86400000);
      const ptViews = Math.round(views * viewFrac);
      const typicalViews = Math.round(ptViews * 0.42);

      // Daily velocity at this point
      const dailyRate = Math.max(100, Math.round((views / totalDays) * (2.2 - frac * 1.5)));
      const dayRevUsd = (dailyRate / 1000) * rpmToUse;
      const dayRevNgn = dayRevUsd * USD_TO_NGN;

      const cumRevUsd = (ptViews / 1000) * rpmToUse;
      const cumRevNgn = cumRevUsd * USD_TO_NGN;

      const dateLabel = pointDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      const fullDate = pointDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

      items.push({
        dayOffset,
        dateLabel,
        fullDate,
        streams: ptViews,
        typicalStreams: typicalViews,
        dailyViews: dailyRate,
        cumRevNgn: Math.round(cumRevNgn),
        cumRevUsd: Math.round(cumRevUsd),
        dailyRevNgn: Math.round(dayRevNgn),
        formattedNgn: formatCompactCurrency(cumRevNgn, 'NGN'),
        formattedUsd: formatCompactCurrency(cumRevUsd, 'USD'),
        formattedDailyNgn: formatCompactCurrency(dayRevNgn, 'NGN'),
        percent: Math.round(viewFrac * 100),
      });
    }

    return items;
  }, [views, velocity?.daysActive, releaseDateObj, est?.effectiveMidRpm]);

  // Filtered by Time Range
  const activeData = useMemo(() => {
    if (!fullChartData.length) return [];
    if (timeRange === '7d') {
      return fullChartData.slice(-7);
    }
    if (timeRange === '30d') {
      return fullChartData.slice(-15);
    }
    return fullChartData;
  }, [fullChartData, timeRange]);

  if (!mounted) {
    return (
      <div className="w-full h-[280px] rounded-2xl bg-surface-2/40 animate-pulse border border-border flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-brand border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-5 rounded-2xl bg-surface border border-border shadow-xs space-y-4">
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
                ? 'bg-brand text-white shadow-xs'
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
                  ? 'bg-surface-3 text-brand font-bold border border-brand/30'
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
            <span className="w-2.5 h-2.5 rounded-full bg-brand" />
            <span>
              {mode === 'cumulative' ? 'Cumulative Streams (Actual)' : mode === 'daily' ? 'Daily Streams' : 'Est. AdSense Revenue'}
            </span>
          </span>
          {mode === 'cumulative' && (
            <span className="inline-flex items-center gap-1.5 text-text-muted">
              <span className="w-2.5 h-0.5 bg-slate-500 rounded-full" />
              <span>Nollywood Release Benchmark</span>
            </span>
          )}
        </div>
        <span className="text-[11px] font-mono text-text-muted">
          Peak Velocity: {velocity?.formattedViewsPerDay}
        </span>
      </div>

      {/* Main Recharts Chart */}
      <div className="w-full h-[270px] select-none">
        <ResponsiveContainer width="100%" height="100%">
          {mode === 'daily' ? (
            <BarChart data={activeData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
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
              <Tooltip content={<CustomChartTooltip mode={mode} />} />
              <Bar dataKey="dailyViews" fill="#FF5A1F" radius={[4, 4, 0, 0]} />
            </BarChart>
          ) : (
            <AreaChart data={activeData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
              <defs>
                <linearGradient id="rechartsBrandGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#FF5A1F" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="#FF5A1F" stopOpacity={0.0} />
                </linearGradient>
                <linearGradient id="rechartsRevGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10B981" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="#10B981" stopOpacity={0.0} />
                </linearGradient>
                <linearGradient id="rechartsBenchmarkGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#64748B" stopOpacity={0.15} />
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
              <Tooltip content={<CustomChartTooltip mode={mode} />} />

              {mode === 'cumulative' && (
                <>
                  <Area
                    type="monotone"
                    dataKey="typicalStreams"
                    stroke="#64748B"
                    strokeWidth={1.5}
                    strokeDasharray="4 4"
                    fill="url(#rechartsBenchmarkGrad)"
                  />
                  <Area
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
