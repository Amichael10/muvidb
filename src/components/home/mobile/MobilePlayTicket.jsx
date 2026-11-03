import React from 'react';
import { Link } from 'react-router-dom';
import { Icon } from '@iconify/react';
import ImageWithFallback from '../../ui/ImageWithFallback';
import { getPlayDateLabel } from '../../../lib/plays';

export default function MobilePlayTicket({ upcomingPlays = [], isLoading = false }) {
  if (isLoading && (!upcomingPlays || upcomingPlays.length === 0)) {
    return (
      <section className="w-full py-6 px-4 animate-pulse">
        <div className="h-5 w-36 bg-surface rounded mb-4" />
        <div className="h-28 bg-surface rounded-2xl" />
      </section>
    );
  }

  if (!upcomingPlays || upcomingPlays.length === 0) return null;

  return (
    <section id="mobile-section-theatre" className="w-full py-6 px-4 bg-surface/20 border-y border-white/5">
      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="space-y-0.5">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-400">Live Stage & Theatre</p>
          <h3 className="font-heading text-lg font-bold text-text-primary tracking-tight">
            Upcoming Stage Plays
          </h3>
        </div>
        <Link to="/plays" className="text-xs font-bold text-brand hover:underline flex items-center gap-1">
          <span>All Plays</span>
          <Icon icon="solar:arrow-right-linear" />
        </Link>
      </div>

      {/* Perforated Ticket Cards Stack */}
      <div className="space-y-3">
        {upcomingPlays.slice(0, 3).map((play) => (
          <Link
            key={play.id}
            to={`/plays/${play.slug || play.id}`}
            className="group relative flex overflow-hidden rounded-2xl bg-surface border border-border/70 hover:border-brand/50 transition-all duration-300 shadow-sm active:scale-[0.99]"
          >
            {/* Left Ticket Stub: Poster */}
            <div className="relative w-24 sm:w-28 shrink-0 aspect-[2/3] overflow-hidden bg-surface-2 border-r border-dashed border-border/80">
              <ImageWithFallback
                src={play.poster_url || play.banner_url}
                alt={play.title}
                fallbackType="film"
                name={play.title}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              />
              <div className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded bg-black/70 backdrop-blur-sm text-[8px] font-black text-amber-400 uppercase">
                {play.status === 'currently_running' ? 'Running' : 'Stage'}
              </div>

              {/* Perforated Notch Visuals */}
              <div className="absolute -top-2 -right-2 w-4 h-4 rounded-full bg-[#0B0D10] border border-border/80" />
              <div className="absolute -bottom-2 -right-2 w-4 h-4 rounded-full bg-[#0B0D10] border border-border/80" />
            </div>

            {/* Right Ticket Body */}
            <div className="p-3.5 flex-1 min-w-0 flex flex-col justify-between space-y-2">
              <div className="space-y-1">
                <span className="text-[9px] font-black uppercase tracking-wider text-brand">
                  {play.genre || 'Live Theatre'}
                </span>
                <h4 className="font-heading text-sm font-black text-text-primary group-hover:text-brand transition-colors line-clamp-1 leading-snug">
                  {play.title}
                </h4>
                <div className="space-y-0.5 text-[11px] text-text-secondary">
                  <div className="flex items-center gap-1.5 truncate">
                    <Icon icon="solar:calendar-bold" className="text-amber-400 text-xs shrink-0" />
                    <span className="truncate">{getPlayDateLabel(play, 'Date TBA')}</span>
                  </div>
                  <div className="flex items-center gap-1.5 truncate text-text-muted">
                    <Icon icon="solar:map-point-bold" className="text-text-muted text-xs shrink-0" />
                    <span className="truncate">{play.venue || play.city || 'Lagos'}</span>
                  </div>
                </div>
              </div>

              {/* Action Link */}
              <div className="pt-1 flex items-center justify-between text-[10px] font-bold text-brand group-hover:translate-x-0.5 transition-transform border-t border-white/5">
                <span className="uppercase tracking-widest">Get Stage Info</span>
                <Icon icon="solar:arrow-right-linear" className="text-xs" />
              </div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
