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

export default function DesktopPlayCard({ play }) {
  const isRunning = play.status === 'currently_running';
  const isUpcoming = play.status === 'upcoming';
  const boxOfficeStr = formatBoxOffice(play.box_office_domestic);
  const dateLabel = getPlayDateLabel(play, 'Dates TBA');

  return (
    <article className="group flex flex-col w-full">
      {/* 1. Cinematic 2:3 Vertical Poster Card */}
      <Link
        to={`/plays/${play.slug || play.id}`}
        className="relative aspect-[2/3] w-full rounded-2xl overflow-hidden bg-surface-2 border border-border/80 group-hover:border-brand/60 shadow-md group-hover:shadow-2xl transition-all duration-300 group-hover:scale-[1.02] block"
      >
        <ImageWithFallback
          src={play.poster_url || play.banner_url}
          alt={play.title}
          fallbackType="film"
          name={play.title}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
        />

        {/* Subtle Dark Gradient at bottom of poster */}
        <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/80 via-black/30 to-transparent pointer-events-none" />

        {/* Top-Left Live Status Badge */}
        <div className="absolute top-3 left-3 z-10">
          <span
            className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider backdrop-blur-md flex items-center gap-1.5 shadow-md ${
              isRunning
                ? 'bg-emerald-500/90 text-white'
                : isUpcoming
                  ? 'bg-blue-600/90 text-white'
                  : 'bg-black/75 text-text-muted border border-white/10'
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

        {/* Top-Right Box Office Pill */}
        {boxOfficeStr && (
          <div className="absolute top-3 right-3 z-10">
            <span className="px-2 py-1 rounded-lg text-[10px] font-black text-amber-300 bg-black/80 border border-amber-500/40 backdrop-blur-md inline-flex items-center gap-1 shadow-md">
              <Icon icon="solar:ticket-sale-bold" className="text-xs text-amber-400" />
              {boxOfficeStr}
            </span>
          </div>
        )}

        {/* Bottom Poster Genre Pill */}
        {play.genre && (
          <div className="absolute bottom-3 left-3 z-10">
            <span className="px-2 py-0.5 rounded-md bg-black/70 backdrop-blur-sm border border-white/15 text-[9px] font-black uppercase tracking-wider text-brand">
              {play.genre}
            </span>
          </div>
        )}
      </Link>

      {/* 2. Clean Metadata Stack Beneath Poster */}
      <div className="pt-3 px-0.5 flex flex-col text-left">
        <Link
          to={`/plays/${play.slug || play.id}`}
          className="font-heading font-black text-base text-text-primary group-hover:text-brand transition-colors line-clamp-1 leading-snug"
          title={play.title}
        >
          {play.title}
        </Link>

        {/* Playwright / Director Byline */}
        {(play.director || play.playwright) && (
          <p className="text-xs text-text-muted mt-1 truncate font-medium">
            {play.director ? `Dir. ${play.director}` : `By ${play.playwright}`}
          </p>
        )}

        {/* Performance Dates */}
        <div className="flex items-center gap-1.5 text-[11px] text-text-secondary font-medium mt-1.5 truncate">
          <Icon icon="solar:calendar-minimalistic-bold" className="text-brand text-xs shrink-0" />
          <span className="truncate">{dateLabel}</span>
        </div>

        {/* Venue & City */}
        <div className="flex items-center gap-1.5 text-[11px] text-text-muted mt-1 truncate">
          <Icon icon="solar:map-point-bold" className="text-brand text-xs shrink-0" />
          <span className="truncate">
            {play.venue ? `${play.venue}${play.city ? ` · ${play.city}` : ''}` : (play.city || 'Venue TBA')}
          </span>
        </div>
      </div>
    </article>
  );
}
