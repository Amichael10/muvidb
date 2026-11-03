import React from 'react';
import { Link } from 'react-router-dom';
import { Icon } from '@iconify/react';
import ImageWithFallback from '../../ui/ImageWithFallback';
import { getPlayDateLabel } from '../../../lib/plays';

function formatBoxOffice(amount) {
  if (!amount || amount <= 0) return null;
  const num = Number(amount);
  if (num >= 1_000_000_000) return `₦${(num / 1_000_000_000).toFixed(1)}B`;
  if (num >= 1_000_000) return `₦${(num / 1_000_000).toFixed(1)}M`;
  return `₦${num.toLocaleString()}`;
}

export default function DesktopPlayCard({ play, mode = 'grid' }) {
  const isRunning = play.status === 'currently_running';
  const isUpcoming = play.status === 'upcoming';
  const boxOfficeStr = formatBoxOffice(play.box_office_domestic);
  const dateLabel = getPlayDateLabel(play, 'Dates TBA');

  if (mode === 'list') {
    return (
      <article className="group relative bg-surface border border-border/80 hover:border-brand/60 rounded-2xl overflow-hidden transition-all duration-300 hover:shadow-xl hover:shadow-black/20">
        <div className="flex flex-col md:flex-row divide-y md:divide-y-0 md:divide-x divide-border/60">
          {/* Left: 2:3 Poster with Perforated Edge */}
          <Link
            to={`/plays/${play.slug || play.id}`}
            className="md:w-52 shrink-0 aspect-[2/3] relative bg-surface-2 overflow-hidden block"
          >
            <ImageWithFallback
              src={play.poster_url || play.banner_url}
              alt={play.title}
              fallbackType="film"
              name={play.title}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              sizes="208px"
            />
            {/* Status Badge */}
            <span
              className={`absolute top-2.5 left-2.5 px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider backdrop-blur-md flex items-center gap-1.5 shadow-md ${
                isRunning
                  ? 'bg-emerald-500/90 text-white'
                  : isUpcoming
                    ? 'bg-blue-600/90 text-white'
                    : 'bg-black/80 text-text-muted border border-white/10'
              }`}
            >
              {isRunning && (
                <span className="relative flex h-1.5 w-1.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75" />
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-white" />
                </span>
              )}
              {isRunning ? 'Live On Stage' : isUpcoming ? 'Upcoming' : 'Archive'}
            </span>

            {/* Perforated Notches on Right Edge */}
            <div className="hidden md:block absolute -top-2.5 -right-2.5 w-5 h-5 rounded-full bg-bg border border-border/80" />
            <div className="hidden md:block absolute -bottom-2.5 -right-2.5 w-5 h-5 rounded-full bg-bg border border-border/80" />
          </Link>

          {/* Center: Play Details & Schedule */}
          <div className="flex-1 p-5 sm:p-6 flex flex-col justify-between min-w-0">
            <div>
              <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-black uppercase tracking-[0.2em] text-brand">
                    {play.genre || 'Theatrical Production'}
                  </span>
                  {play.year && (
                    <span className="text-[10px] font-bold text-text-muted border border-border px-1.5 py-0.5 rounded bg-surface-2">
                      {play.year}
                    </span>
                  )}
                </div>

                {boxOfficeStr && (
                  <span className="text-[10px] font-bold text-amber-400 border border-amber-500/30 px-2 py-0.5 rounded-md bg-amber-500/10 inline-flex items-center gap-1 shadow-xs">
                    <Icon icon="solar:ticket-sale-bold" className="text-xs" />
                    <span>{boxOfficeStr} Box Office</span>
                  </span>
                )}
              </div>

              <Link
                to={`/plays/${play.slug || play.id}`}
                className="font-heading text-xl sm:text-2xl font-black text-text-primary group-hover:text-brand transition-colors block leading-tight"
              >
                {play.title}
              </Link>

              {(play.director || play.playwright || play.producer) && (
                <p className="text-xs text-text-muted mt-1.5 font-medium flex flex-wrap items-center gap-x-3 gap-y-1">
                  {play.director && (
                    <span className="inline-flex items-center gap-1">
                      <Icon icon="solar:masks-bold" className="text-brand text-xs" />
                      Dir. {play.director}
                    </span>
                  )}
                  {play.playwright && (
                    <span className="inline-flex items-center gap-1">
                      <Icon icon="solar:pen-new-square-linear" className="text-brand text-xs" />
                      By {play.playwright}
                    </span>
                  )}
                  {play.producer && (
                    <span className="text-text-muted opacity-80">
                      Prod. {play.producer}
                    </span>
                  )}
                </p>
              )}

              <p className="mt-3 text-xs text-text-muted line-clamp-2 leading-relaxed">
                {play.synopsis || 'Explore full production schedule, venue, director, and stage ensemble credits.'}
              </p>
            </div>

            {/* Performance Meta & Action Buttons */}
            <div className="pt-4 mt-4 border-t border-border/40 flex flex-wrap items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-xs text-text-muted">
                <div className="flex items-center gap-1.5">
                  <Icon icon="solar:calendar-minimalistic-bold" className="text-brand" />
                  <span className="font-semibold text-text-secondary">{dateLabel}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Icon icon="solar:map-point-bold" className="text-brand" />
                  <span>{play.venue ? `${play.venue}${play.city ? ` · ${play.city}` : ''}` : (play.city || 'Venue TBA')}</span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {play.source_url && (
                  <a
                    href={play.source_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3.5 py-1.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-400 text-xs font-bold transition-all flex items-center gap-1"
                  >
                    <span>Tickets / Info</span>
                    <Icon icon="solar:arrow-right-up-linear" className="text-xs" />
                  </a>
                )}
                <Link
                  to={`/plays/${play.slug || play.id}`}
                  className="px-4 py-1.5 rounded-xl bg-brand hover:bg-brand-hover text-white text-xs font-bold uppercase tracking-wider transition-all shadow-sm shadow-brand/20 flex items-center gap-1.5"
                >
                  <span>Production Details</span>
                  <Icon icon="solar:arrow-right-linear" className="text-xs" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </article>
    );
  }

  // Default: Grid Playbill Card (Vertical Theatrical Playbill Aesthetic)
  return (
    <article className="group relative bg-surface border border-border/80 hover:border-brand/60 rounded-2xl overflow-hidden transition-all duration-300 hover:shadow-2xl hover:shadow-brand/5 hover:-translate-y-1.5 flex flex-col justify-between">
      {/* 1. TOP PLAYBILL HEADER BAR */}
      <div className="px-4 py-2 bg-gradient-to-r from-amber-500/15 via-surface-2/60 to-surface-2/30 border-b border-border/60 flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-amber-400 text-[9px] font-black uppercase tracking-[0.22em]">
          <Icon icon="solar:masks-bold" className="text-xs" />
          <span>Stage Repertoire</span>
        </div>
        <span className="text-[9px] font-black uppercase tracking-widest text-text-muted">
          {play.city || 'Nigeria'}
        </span>
      </div>

      {/* 2. POSTER ARTWORK CONTAINER (2:3 PORTRAIT) */}
      <Link
        to={`/plays/${play.slug || play.id}`}
        className="relative aspect-[2/3] w-full overflow-hidden bg-surface-2 block"
      >
        <ImageWithFallback
          src={play.poster_url || play.banner_url}
          alt={play.title}
          fallbackType="film"
          name={play.title}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
        />

        {/* Gradient Shadow Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent" />

        {/* Live Status Badge */}
        <div className="absolute top-3 left-3">
          <span
            className={`px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider backdrop-blur-md flex items-center gap-1.5 shadow-lg ${
              isRunning
                ? 'bg-emerald-500/90 text-white'
                : isUpcoming
                  ? 'bg-blue-600/90 text-white'
                  : 'bg-black/80 text-text-muted border border-white/10'
            }`}
          >
            {isRunning && (
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75" />
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-white" />
              </span>
            )}
            {isRunning ? 'Live On Stage' : isUpcoming ? 'Upcoming' : 'Archive'}
          </span>
        </div>

        {/* Box Office Pill (Top Right) */}
        {boxOfficeStr && (
          <div className="absolute top-3 right-3">
            <span className="px-2 py-1 rounded-lg text-[9px] font-black text-amber-300 bg-black/80 border border-amber-500/40 backdrop-blur-md inline-flex items-center gap-1 shadow-md">
              <Icon icon="solar:ticket-sale-bold" className="text-xs text-amber-400" />
              {boxOfficeStr}
            </span>
          </div>
        )}

        {/* Overlay Footer on Poster (Genre & Year) */}
        <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between text-white/90">
          <span className="px-2 py-0.5 rounded-md bg-black/70 backdrop-blur-sm border border-white/10 text-[9px] font-black uppercase tracking-widest text-brand">
            {play.genre || 'Stage Play'}
          </span>
          {play.year && (
            <span className="text-[10px] font-extrabold text-white/80 drop-shadow-sm">
              {play.year}
            </span>
          )}
        </div>
      </Link>

      {/* 3. TACTILE PERFORATED TEAR-LINE NOTCHES */}
      <div className="relative py-0 border-t border-dashed border-border/80">
        <div className="absolute -left-2 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-bg border border-border/80" />
        <div className="absolute -right-2 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-bg border border-border/80" />
      </div>

      {/* 4. TICKET STUB CONTENT BODY */}
      <div className="p-4 sm:p-5 flex-1 flex flex-col justify-between space-y-4">
        <div>
          <Link
            to={`/plays/${play.slug || play.id}`}
            className="font-heading text-lg sm:text-xl font-black text-text-primary group-hover:text-brand transition-colors line-clamp-1 block leading-tight"
          >
            {play.title}
          </Link>

          {(play.director || play.playwright) && (
            <p className="text-[11px] text-text-muted mt-1 truncate font-medium">
              {play.director ? `Dir. ${play.director}` : `By ${play.playwright}`}
            </p>
          )}

          <p className="text-xs text-text-muted line-clamp-2 mt-2 leading-relaxed opacity-90">
            {play.synopsis || 'Explore production schedule, venue, director, and full stage ensemble.'}
          </p>
        </div>

        {/* Performance Dates & Venue */}
        <div className="pt-3 border-t border-border/40 space-y-1.5 text-[11px] text-text-muted">
          <div className="flex items-center gap-2">
            <Icon icon="solar:calendar-minimalistic-bold" className="text-brand text-xs shrink-0" />
            <span className="font-semibold text-text-secondary truncate">{dateLabel}</span>
          </div>

          <div className="flex items-center gap-2">
            <Icon icon="solar:map-point-bold" className="text-brand text-xs shrink-0" />
            <span className="truncate">
              {play.venue ? `${play.venue}${play.city ? ` · ${play.city}` : ''}` : (play.city || 'Venue TBA')}
            </span>
          </div>
        </div>

        {/* Interactive Hover CTA Footer */}
        <Link
          to={`/plays/${play.slug || play.id}`}
          className="w-full py-2.5 rounded-xl bg-surface-2/80 hover:bg-brand text-text-secondary hover:text-white text-xs font-bold uppercase tracking-wider transition-all duration-200 flex items-center justify-center gap-1.5 border border-border/60 hover:border-brand shadow-xs"
        >
          <span>Production &amp; Cast</span>
          <Icon icon="solar:arrow-right-linear" className="text-xs group-hover:translate-x-0.5 transition-transform" />
        </Link>
      </div>
    </article>
  );
}
