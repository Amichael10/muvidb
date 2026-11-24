import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from '@iconify/react';
import FilmCard from '../film/FilmCard';

export default function HomeNewReleases({
  newReleases = [],
  isLoading = false,
  watchlistIds = new Set(),
  onToggleWatchlist,
}) {
  const [filter, setFilter] = useState('all');

  const categorized = useMemo(() => {
    const cinema = [];
    const youtube = [];
    const streaming = [];

    for (const film of newReleases) {
      if (film.is_in_cinemas) {
        cinema.push(film);
      } else if (
        film.source === 'youtube' ||
        film.release_type === 'youtube' ||
        (film.youtube_watch_url && film.youtube_watch_url.length > 5)
      ) {
        youtube.push(film);
      } else {
        streaming.push(film);
      }
    }

    return { cinema, youtube, streaming };
  }, [newReleases]);

  const visibleFilms = useMemo(() => {
    if (filter === 'cinema') return categorized.cinema.slice(0, 12);
    if (filter === 'youtube') return categorized.youtube.slice(0, 12);
    if (filter === 'streaming') return categorized.streaming.slice(0, 12);
    return newReleases.slice(0, 12);
  }, [filter, newReleases, categorized]);

  if (!isLoading && newReleases.length === 0) return null;

  const filterTabs = [
    { id: 'all', label: 'All New', count: newReleases.length },
    ...(categorized.cinema.length > 0 ? [{ id: 'cinema', label: 'In Cinemas', count: categorized.cinema.length }] : []),
    ...(categorized.youtube.length > 0 ? [{ id: 'youtube', label: 'YouTube', count: categorized.youtube.length }] : []),
    ...(categorized.streaming.length > 0 ? [{ id: 'streaming', label: 'Streaming', count: categorized.streaming.length }] : []),
  ];

  return (
    <section className="py-10 md:py-12 border-b border-hairline bg-bg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div className="space-y-1">
            <p className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.22em] text-brand">
              <span className="w-1.5 h-1.5 rounded-full bg-brand animate-pulse" />
              <span>Just Dropped</span>
            </p>
            <h2 className="font-heading font-bold text-2xl sm:text-3xl text-text-primary tracking-tight">
              New Releases
            </h2>
            <p className="text-xs text-text-muted">
              Every newly released African film across cinemas, YouTube, and streaming platforms
            </p>
          </div>

          <Link
            to="/browse?sort=release_date"
            className="group inline-flex items-center gap-1.5 text-xs font-bold text-brand hover:underline whitespace-nowrap"
          >
            <span>All New Releases</span>
            <Icon
              icon="solar:alt-arrow-right-linear"
              className="w-4 h-4 transition-transform group-hover:translate-x-0.5"
            />
          </Link>
        </div>

        {/* Source Filter Pills */}
        {filterTabs.length > 1 && (
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide -mx-4 px-4 sm:mx-0 sm:px-0">
            {filterTabs.map((tab) => {
              const isActive = filter === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setFilter(tab.id)}
                  className={`shrink-0 inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold border transition-colors cursor-pointer ${
                    isActive
                      ? 'bg-brand border-brand text-white'
                      : 'bg-surface border-border/80 text-text-secondary hover:border-brand/50 hover:text-text-primary'
                  }`}
                >
                  <span>{tab.label}</span>
                  <span className="opacity-70 text-[10px]">({tab.count})</span>
                </button>
              );
            })}
          </div>
        )}

        {/* Rail */}
        {isLoading && visibleFilms.length === 0 ? (
          <div className="flex overflow-x-auto snap-x snap-mandatory gap-4 pb-3 -mx-4 px-4 scrollbar-none sm:grid sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 sm:mx-0 sm:px-0 sm:overflow-visible">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="space-y-2 animate-pulse w-[58vw] sm:w-auto shrink-0 snap-start">
                <div className="aspect-[2/3] w-full rounded-xl bg-surface-2" />
                <div className="h-3.5 w-3/4 rounded bg-surface-2" />
                <div className="h-3 w-1/2 rounded bg-surface-2" />
              </div>
            ))}
          </div>
        ) : (
          <div className="flex overflow-x-auto snap-x snap-mandatory gap-4 pb-3 -mx-4 px-4 scrollbar-none sm:grid sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 sm:mx-0 sm:px-0 sm:overflow-visible">
            {visibleFilms.map((film) => (
              <div key={film.id} className="w-[58vw] sm:w-auto shrink-0 snap-start select-none">
                <FilmCard
                  film={film}
                  fullWidth
                  contextMode={film.is_in_cinemas ? 'cinema' : 'auto'}
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
