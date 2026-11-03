import React from 'react';
import { Link } from 'react-router-dom';
import { Icon } from '@iconify/react';
import ImageWithFallback from '../../ui/ImageWithFallback';

function formatShowTime(time) {
  if (!time) return null;
  const [hours, minutes] = String(time).split(':').map(Number);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return time;
  const displayHour = hours % 12 || 12;
  const period = hours >= 12 ? 'PM' : 'AM';
  return `${displayHour}:${String(minutes).padStart(2, '0')} ${period}`;
}

export default function MobileCinemaStrip({ inCinemas = [], isLoading = false }) {
  if (isLoading && (!inCinemas || inCinemas.length === 0)) {
    return (
      <div className="w-full py-4 px-4 bg-surface/30 animate-pulse">
        <div className="h-4 w-32 bg-surface rounded mb-3" />
        <div className="flex gap-3 overflow-hidden">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="w-64 h-20 bg-surface rounded-xl shrink-0" />
          ))}
        </div>
      </div>
    );
  }

  if (!inCinemas || inCinemas.length === 0) return null;

  return (
    <section id="mobile-section-cinemas" className="w-full py-5 px-4 bg-surface/40 border-y border-white/5">
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-ping" />
          <h3 className="font-heading text-sm font-black uppercase tracking-wider text-text-primary">
            In Cinemas Today
          </h3>
        </div>
        <Link
          to="/showtimes"
          className="text-xs font-bold text-brand hover:underline flex items-center gap-1 shrink-0"
        >
          <span>All Showtimes</span>
          <Icon icon="solar:arrow-right-linear" className="text-sm" />
        </Link>
      </div>

      {/* Horizontal Fast-Paced Cinema Cards */}
      <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-hide snap-x snap-mandatory">
        {inCinemas.slice(0, 6).map((film) => {
          const nextShow = film.next_showtime;
          const timeStr = nextShow?.time ? formatShowTime(nextShow.time) : null;
          const venueStr = nextShow?.cinema_name || nextShow?.cinema_chain || 'Cinemas';
          const totalRemaining = film.remaining_today_showtime_count || 0;

          return (
            <Link
              key={film.id}
              to={`/films/${film.slug || film.id}`}
              className="shrink-0 w-[240px] snap-start flex items-center gap-3 p-2.5 rounded-xl bg-surface border border-border/60 hover:border-brand/40 transition-all active:scale-[0.98] shadow-sm"
            >
              {/* Poster 2:3 */}
              <div className="w-14 h-20 rounded-lg overflow-hidden shrink-0 bg-surface-2 relative">
                <ImageWithFallback
                  src={film.poster_url || film.backdrop_url}
                  alt={film.title}
                  fallbackType="film"
                  name={film.title}
                  className="w-full h-full object-cover"
                />
              </div>

              {/* Info Column */}
              <div className="flex-1 min-w-0 space-y-1">
                <h4 className="font-heading text-xs font-bold text-text-primary truncate leading-tight">
                  {film.title}
                </h4>

                {timeStr ? (
                  <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-400 border border-emerald-500/20 text-[10px] font-black">
                    <Icon icon="solar:clock-circle-bold" className="text-xs shrink-0" />
                    <span>{timeStr}</span>
                  </div>
                ) : (
                  <span className="text-[10px] text-text-muted truncate block">
                    {film.genres?.[0] || 'Now Showing'}
                  </span>
                )}

                <p className="text-[10px] text-text-secondary truncate">
                  {venueStr} {totalRemaining > 1 ? `(+${totalRemaining - 1} more)` : ''}
                </p>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
