import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from '@iconify/react';
import FilmCard from '../film/FilmCard';

export default function HomeCinemaSection({
  inCinemas = [],
  isLoading = false,
  watchlistIds = new Set(),
  onToggleWatchlist,
}) {
  const [selectedCity, setSelectedCity] = useState('All');

  // Derive active cities from live showtime data attached to each cinema film
  const cities = useMemo(() => {
    const counts = new Map();
    for (const film of inCinemas) {
      const filmCities = film.active_cities || [];
      for (const city of filmCities) {
        if (!city) continue;
        counts.set(city, (counts.get(city) || 0) + 1);
      }
    }
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, 6)
      .map(([name, count]) => ({ name, count }));
  }, [inCinemas]);

  const filteredFilms = useMemo(() => {
    if (selectedCity === 'All') return inCinemas.slice(0, 12);
    return inCinemas
      .filter((film) => (film.active_cities || []).includes(selectedCity))
      .map((film) => ({
        ...film,
        next_showtime: film.city_next_showtime?.[selectedCity] || film.next_showtime,
      }))
      .slice(0, 12);
  }, [inCinemas, selectedCity]);

  if (!isLoading && inCinemas.length === 0) return null;

  return (
    <section className="py-10 md:py-12 border-b border-hairline">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div className="space-y-1">
            <p className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.22em] text-emerald-400">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span>Live Cinema Listings</span>
            </p>
            <h2 className="font-heading font-bold text-2xl sm:text-3xl text-text-primary tracking-tight">
              In Cinemas Today
            </h2>
            <p className="text-xs text-text-muted">
              Showing across 18+ locations in Lagos, Abuja, Port Harcourt &amp; Accra • Filmhouse, Silverbird, Genesis &amp; Viva
            </p>
          </div>

          <Link
            to="/showtimes"
            className="group inline-flex items-center gap-1.5 text-xs font-bold text-brand hover:underline whitespace-nowrap"
          >
            <span>All Showtimes &amp; Cinemas</span>
            <Icon
              icon="solar:alt-arrow-right-linear"
              className="w-4 h-4 transition-transform group-hover:translate-x-0.5"
            />
          </Link>
        </div>

        {/* City Filter Pills */}
        {cities.length > 0 && (
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide -mx-4 px-4 sm:mx-0 sm:px-0">
            <button
              type="button"
              onClick={() => setSelectedCity('All')}
              className={`shrink-0 px-3.5 py-1.5 rounded-xl text-xs font-bold border transition-colors cursor-pointer ${
                selectedCity === 'All'
                  ? 'bg-brand border-brand text-white'
                  : 'bg-surface border-border/80 text-text-secondary hover:border-brand/50 hover:text-text-primary'
              }`}
            >
              All Cities ({inCinemas.length})
            </button>
            {cities.map((c) => (
              <button
                key={c.name}
                type="button"
                onClick={() => setSelectedCity(c.name)}
                className={`shrink-0 inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold border transition-colors cursor-pointer ${
                  selectedCity === c.name
                    ? 'bg-brand border-brand text-white'
                    : 'bg-surface border-border/80 text-text-secondary hover:border-brand/50 hover:text-text-primary'
                }`}
              >
                <Icon icon="solar:map-point-linear" className="text-xs opacity-75" />
                <span>{c.name}</span>
                <span className="opacity-65 text-[10px]">({c.count})</span>
              </button>
            ))}
          </div>
        )}

        {/* Unified Decision Poster Rail (Mobile App Swipe Carousel & Desktop Grid) */}
        {isLoading && filteredFilms.length === 0 ? (
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
            {filteredFilms.map((film) => (
              <div key={film.id} className="w-[58vw] sm:w-auto shrink-0 snap-start select-none">
                <FilmCard
                  film={film}
                  fullWidth
                  contextMode="cinema"
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
