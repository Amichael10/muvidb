import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from '@iconify/react';
import FilmCard from '../film/FilmCard';

export default function HomeUpcomingSlate({
  comingSoon = [],
  cinemaFilmIds = new Set(),
  isLoadingFilms = false,
  watchlistIds = new Set(),
  onToggleWatchlist,
}) {
  const filteredUpcomingFilms = useMemo(
    () => comingSoon.filter((film) => !cinemaFilmIds.has(film.id) && !film.series_id).slice(0, 12),
    [comingSoon, cinemaFilmIds]
  );

  return (
    <section className="py-10 md:py-12 border-b border-hairline">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div className="space-y-1">
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-amber-400 flex items-center gap-1.5">
              <Icon icon="solar:calendar-date-bold" className="text-xs" />
              <span>Cinema &amp; Streaming Calendar</span>
            </p>
            <h2 className="font-heading font-bold text-2xl sm:text-3xl text-text-primary tracking-tight">
              Upcoming Movies Slate
            </h2>
            <p className="text-xs text-text-muted">
              Films headed to Nigerian &amp; West African cinemas and premier streaming
            </p>
          </div>

          <Link
            to="/browse?sort=upcoming"
            className="group inline-flex items-center gap-1.5 text-xs font-bold text-brand hover:underline whitespace-nowrap"
          >
            <span>Explore Full Upcoming Slate</span>
            <Icon
              icon="solar:alt-arrow-right-linear"
              className="w-4 h-4 transition-transform group-hover:translate-x-0.5"
            />
          </Link>
        </div>

        {/* Portrait Film Cards (Mobile App Swipe Carousel & Desktop Grid) */}
        {isLoadingFilms && filteredUpcomingFilms.length === 0 ? (
          <div className="flex overflow-x-auto snap-x snap-mandatory gap-3 sm:gap-5 pb-3 -mx-4 px-4 scrollbar-none sm:grid sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 sm:mx-0 sm:px-0 sm:overflow-visible">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="space-y-2 animate-pulse w-[52vw] sm:w-auto shrink-0 snap-start">
                <div className="aspect-[2/3] w-full rounded-xl bg-surface-2" />
                <div className="h-3.5 w-3/4 rounded bg-surface-2" />
                <div className="h-3 w-1/2 rounded bg-surface-2" />
              </div>
            ))}
          </div>
        ) : filteredUpcomingFilms.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border/70 bg-surface p-8 text-center text-xs text-text-muted">
            No upcoming releases scheduled right now.{' '}
            <Link to="/submit" className="text-brand font-bold hover:underline">
              Submit an upcoming film →
            </Link>
          </div>
        ) : (
          <div className="flex overflow-x-auto snap-x snap-mandatory gap-3 sm:gap-5 pb-3 -mx-4 px-4 scrollbar-none sm:grid sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 sm:mx-0 sm:px-0 sm:overflow-visible">
            {filteredUpcomingFilms.slice(0, 6).map((film) => (
              <div key={film.id} className="w-[52vw] sm:w-auto shrink-0 snap-start select-none">
                <FilmCard
                  film={film}
                  fullWidth
                  contextMode="coming-soon"
                  isWatchlisted={watchlistIds.has(film.id)}
                  onAction={onToggleWatchlist}
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
