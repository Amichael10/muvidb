import React from 'react';
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div 
        className="relative w-full max-w-lg rounded-2xl bg-surface border border-border shadow-2xl p-6 space-y-6 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b border-border pb-4">
          <div className="flex items-center gap-3">
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
            <div>
              <div className="flex items-center gap-2 text-xs font-bold text-brand uppercase tracking-wider mb-1">
                <Icon icon="simple-icons:youtube" className="text-red-500 text-sm" />
                <span>YouTube Box Office & ViewStats</span>
              </div>
              <h3 className="text-xl font-black text-text-primary font-heading tracking-tight">
                {film.title} {film.year ? `(${film.year})` : ''}
              </h3>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-surface-2 transition-colors cursor-pointer"
            aria-label="Close"
          >
            <Icon icon="solar:close-circle-bold" className="text-2xl" />
          </button>
        </div>

        {/* Primary Metric Grid */}
        <div className="grid grid-cols-2 gap-3">
          {/* Estimated Digital Box Office */}
          <div className="p-4 rounded-xl bg-surface-2 border border-border/60 space-y-1">
            <span className="text-[11px] font-semibold text-text-muted uppercase tracking-wider">Est. AdSense Box Office</span>
            <p className="text-xl sm:text-2xl font-black text-brand font-heading leading-tight">
              {est.formattedNgn}
            </p>
            <span className="text-xs text-text-muted font-mono block">
              {est.formattedUsd} (USD)
            </span>
          </div>

          {/* Lifetime Views */}
          <div className="p-4 rounded-xl bg-surface-2 border border-border/60 space-y-1">
            <span className="text-[11px] font-semibold text-text-muted uppercase tracking-wider">Lifetime Streams</span>
            <p className="text-xl sm:text-2xl font-black text-text-primary font-heading leading-tight flex items-center gap-1.5">
              <span>{formatViews(views)}</span>
            </p>
            <span className="text-xs text-text-muted font-mono block">
              {views.toLocaleString('en-US')} views
            </span>
          </div>

          {/* Velocity & Pacing */}
          <div className="p-4 rounded-xl bg-surface-2 border border-border/60 space-y-1">
            <span className="text-[11px] font-semibold text-text-muted uppercase tracking-wider">Stream Velocity</span>
            <div className="flex items-center gap-1.5 pt-0.5">
              <span className={`inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full border ${velocity.badge.color}`}>
                <Icon icon={velocity.badge.icon} className="text-xs" />
                <span>{velocity.badge.label}</span>
              </span>
            </div>
            <span className="text-xs text-text-primary font-mono font-bold block pt-0.5">
              ~{velocity.formattedViewsPerDay}
            </span>
          </div>

          {/* Runtime & Ad Density */}
          <div className="p-4 rounded-xl bg-surface-2 border border-border/60 space-y-1">
            <span className="text-[11px] font-semibold text-text-muted uppercase tracking-wider">Runtime & Ad Breaks</span>
            <p className="text-base font-bold text-text-primary flex items-center gap-1.5 pt-0.5">
              <Icon icon="solar:clock-circle-bold" className="text-brand text-sm" />
              <span>{Math.floor(runtimeMins / 60)}h {runtimeMins % 60}m</span>
            </p>
            <span className="text-[11px] text-text-muted block">
              ~{estMidrolls} Mid-Roll Breaks
            </span>
          </div>
        </div>

        {/* ViewStats Audience & AdSense Model */}
        <div className="p-4 rounded-xl bg-brand/5 border border-brand/20 space-y-3">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-brand uppercase tracking-wider flex items-center gap-1.5">
              <Icon icon="solar:chart-square-bold" className="text-sm" />
              <span>ViewStats Audience & Monetization Model</span>
            </span>
            <span className="text-[10px] text-text-muted bg-surface px-2 py-0.5 rounded border border-border">
              Nollywood Benchmark
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs pt-1">
            <div className="p-2.5 rounded-lg bg-surface/80 border border-border/50 space-y-0.5">
              <span className="text-[10px] text-text-muted block uppercase font-semibold">Audience Mix</span>
              <div className="flex items-center justify-between font-mono font-bold text-[11px]">
                <span className="text-text-primary">Domestic: {domesticShare}%</span>
                <span className="text-brand">Diaspora: {diasporaShare}%</span>
              </div>
              <span className="text-[10px] text-text-muted block">
                {isIndigenous ? 'Higher domestic West Africa share' : 'High US/UK/Canada diaspora crossover'}
              </span>
            </div>

            <div className="p-2.5 rounded-lg bg-surface/80 border border-border/50 space-y-0.5">
              <span className="text-[10px] text-text-muted block uppercase font-semibold">Effective Creator RPM</span>
              <p className="font-mono font-bold text-brand text-sm">
                {est.effectiveRpmUsd} / 1K
              </p>
              <span className="text-[10px] text-text-muted block">
                Net creator AdSense rate after YouTube's 45% cut
              </span>
            </div>
          </div>

          <div className="p-2.5 rounded-lg bg-surface/80 border border-border/50 text-[11px] text-text-secondary flex items-start gap-2">
            <Icon icon="solar:info-circle-linear" className="text-brand text-sm shrink-0 mt-0.5" />
            <span>
              Revenue is calculated using verified runtime (mid-roll ad slots), diaspora viewership benchmarks, and dual NGN/USD FX @ ₦{USD_TO_NGN}/$1.
            </span>
          </div>
        </div>

        {/* Action Button: Watch on YouTube */}
        {watchUrl && (
          <div className="pt-2">
            <a
              href={watchUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-sm transition-all shadow-md active:scale-98 cursor-pointer"
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

