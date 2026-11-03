import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from '@iconify/react';
import ImageWithFallback from '../../ui/ImageWithFallback';

function formatShowTime(timeStr) {
  if (!timeStr) return '';
  const [hours, minutes] = timeStr.split(':');
  const h = parseInt(hours, 10);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hour12 = h % 12 || 12;
  return `${hour12}:${minutes} ${ampm}`;
}

function parseDayMeta(dateStr, todayStr) {
  const d = new Date(`${dateStr}T00:00:00Z`);
  const isToday = dateStr === todayStr;
  const tomorrow = new Date(new Date(`${todayStr}T00:00:00Z`).getTime() + 86400000).toISOString().split('T')[0];
  const isTomorrow = dateStr === tomorrow;

  const weekday = isToday ? 'TODAY' : isTomorrow ? 'TOMORROW' : d.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' }).toUpperCase();
  const dayNum = d.getUTCDate();
  const month = d.toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' }).toUpperCase();

  return { weekday, dayNum, month, isToday };
}

export default function MobileShowtimesView({
  groupedByFilm = {},
  loading = false,
  selectedDate,
  setSelectedDate,
  selectedCity,
  setSelectedCity,
  selectedCinema,
  setSelectedCinema,
  selectedFormat,
  setSelectedFormat,
  next7Days = [],
  cities = [],
  cinemas = [],
  formats = [],
}) {
  const [isFilterSheetOpen, setIsFilterSheetOpen] = useState(false);
  const [expandedFilms, setExpandedFilms] = useState({});

  const toggleFilmExpansion = (filmId) => {
    setExpandedFilms((prev) => ({
      ...prev,
      [filmId]: !prev[filmId],
    }));
  };

  const todayStr = next7Days[0] || selectedDate;
  const filmEntries = Object.entries(groupedByFilm);
  const hasActiveFilters = selectedCity !== 'All' || selectedCinema !== 'All' || selectedFormat !== 'All';

  const resetFilters = () => {
    setSelectedCity('All');
    setSelectedCinema('All');
    setSelectedFormat('All');
  };

  return (
    <div className="w-full pb-28 md:hidden">
      {/* 1. STICKY TOP CONTROLLER (Date slider + quick city chips) */}
      <div className="sticky top-14 z-30 w-full bg-[#0B0D10]/95 backdrop-blur-md border-b border-white/5 py-2 px-3 shadow-md shadow-black/50">
        {/* Date Horizontal Slider */}
        <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide py-1">
          {next7Days.map((dateStr) => {
            const { weekday, dayNum, month, isToday } = parseDayMeta(dateStr, todayStr);
            const isSelected = selectedDate === dateStr;

            return (
              <button
                key={dateStr}
                onClick={() => setSelectedDate(dateStr)}
                className={`shrink-0 flex flex-col items-center justify-center min-w-[62px] py-2 px-2.5 rounded-2xl border transition-all duration-200 select-none ${
                  isSelected
                    ? 'bg-brand text-white border-brand shadow-lg shadow-brand/30 scale-[1.03]'
                    : 'bg-surface/80 border-border/60 text-text-muted hover:text-text-primary active:scale-95'
                }`}
              >
                <span className={`text-[9px] font-black tracking-wider leading-tight ${isSelected ? 'text-white/90' : isToday ? 'text-brand' : 'text-text-muted'}`}>
                  {weekday}
                </span>
                <span className="text-base font-black font-heading leading-tight my-0.5">
                  {dayNum}
                </span>
                <span className="text-[8px] font-bold uppercase tracking-widest opacity-75">
                  {month}
                </span>
              </button>
            );
          })}
        </div>

        {/* Quick City Filters & Filter Toggle */}
        <div className="flex items-center justify-between gap-2 mt-2 pt-1 border-t border-white/5">
          <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide flex-1 py-0.5">
            {cities.map((city) => {
              const isSelected = selectedCity === city;
              return (
                <button
                  key={city}
                  onClick={() => setSelectedCity(city)}
                  className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-bold transition-all min-h-[34px] select-none ${
                    isSelected
                      ? 'bg-brand/20 text-brand border border-brand/50'
                      : 'bg-surface/60 text-text-muted border border-border/50 hover:text-text-primary'
                  }`}
                >
                  {city === 'All' ? 'All Cities' : city}
                </button>
              );
            })}
          </div>

          {/* More Filters Trigger (Cinema & Format) */}
          <button
            onClick={() => setIsFilterSheetOpen(true)}
            className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border transition-all min-h-[34px] ${
              selectedCinema !== 'All' || selectedFormat !== 'All'
                ? 'bg-brand text-white border-brand shadow-sm shadow-brand/30'
                : 'bg-surface text-text-secondary border-border/70 hover:border-brand/40'
            }`}
          >
            <Icon icon="solar:filter-linear" className="text-sm" />
            <span>Filter</span>
            {(selectedCinema !== 'All' || selectedFormat !== 'All') && (
              <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
            )}
          </button>
        </div>
      </div>

      {/* 2. RESULTS SUMMARY BAR */}
      <div className="px-4 py-3 flex items-center justify-between gap-2 text-xs text-text-muted">
        <div className="flex items-center gap-1.5">
          <Icon icon="solar:ticket-bold" className="text-brand text-sm" />
          <span className="font-semibold text-text-secondary">
            {loading ? 'Searching showtimes...' : `${filmEntries.length} ${filmEntries.length === 1 ? 'Movie' : 'Movies'} Screening`}
          </span>
          {selectedCity !== 'All' && <span>in <strong className="text-text-primary">{selectedCity}</strong></span>}
        </div>
        {hasActiveFilters && (
          <button
            onClick={resetFilters}
            className="text-[11px] font-bold text-brand hover:underline flex items-center gap-1"
          >
            <span>Reset filters</span>
            <Icon icon="solar:restart-linear" className="text-xs" />
          </button>
        )}
      </div>

      {/* 3. SHOWTIME CARDS FEED */}
      <div className="px-4 space-y-4">
        {loading ? (
          // Mobile Skeletons
          [...Array(3)].map((_, i) => (
            <div key={i} className="bg-surface rounded-2xl border border-border p-4 animate-pulse space-y-3">
              <div className="flex gap-3">
                <div className="w-20 aspect-[2/3] bg-surface-2 rounded-xl shrink-0" />
                <div className="flex-1 space-y-2 py-1">
                  <div className="h-5 w-3/4 bg-surface-2 rounded" />
                  <div className="h-3 w-1/2 bg-surface-2 rounded" />
                  <div className="h-4 w-20 bg-surface-2 rounded mt-2" />
                </div>
              </div>
              <div className="pt-2 grid grid-cols-3 gap-2">
                <div className="h-11 bg-surface-2 rounded-xl" />
                <div className="h-11 bg-surface-2 rounded-xl" />
                <div className="h-11 bg-surface-2 rounded-xl" />
              </div>
            </div>
          ))
        ) : filmEntries.length === 0 ? (
          // Empty State
          <div className="text-center py-20 px-4 bg-surface/50 border border-border rounded-3xl mt-4">
            <div className="w-16 h-16 rounded-2xl bg-brand/10 border border-brand/20 flex items-center justify-center text-brand mx-auto mb-4">
              <Icon icon="solar:clapperboard-play-linear" className="w-8 h-8 opacity-70" />
            </div>
            <h3 className="font-heading font-black text-lg text-text-primary mb-1">
              No Showtimes Found
            </h3>
            <p className="text-xs text-text-muted max-w-xs mx-auto leading-relaxed">
              We couldn't find scheduled screenings matching your current date and location filters.
            </p>
            {hasActiveFilters && (
              <button
                onClick={resetFilters}
                className="mt-5 px-5 py-2.5 rounded-xl bg-brand hover:bg-brand-hover text-white text-xs font-bold uppercase tracking-wider transition-all shadow-md shadow-brand/20"
              >
                Clear All Filters
              </button>
            )}
          </div>
        ) : (
          // Film Cards
          filmEntries.map(([filmId, { film, cinemas: filmCinemas }]) => {
            const cinemaList = Object.values(filmCinemas);
            const isExpanded = !!expandedFilms[filmId];
            const visibleCinemas = isExpanded ? cinemaList : cinemaList.slice(0, 2);
            const hasMoreCinemas = cinemaList.length > 2;
            const likedPercent = film?.liked_percent;

            return (
              <article
                key={filmId}
                className="bg-surface rounded-2xl border border-border/70 overflow-hidden shadow-sm"
              >
                {/* Film Card Header */}
                <div className="p-3.5 flex gap-3.5 items-start bg-surface-2/30 border-b border-border/40">
                  <Link
                    to={`/films/${film?.slug || film?.id}`}
                    className="w-20 sm:w-24 aspect-[2/3] rounded-xl overflow-hidden shrink-0 bg-surface-2 shadow-md relative block"
                  >
                    <ImageWithFallback
                      src={film?.poster_url || film?.backdrop_url}
                      alt={film?.title}
                      fallbackType="film"
                      name={film?.title}
                      className="w-full h-full object-cover"
                      sizes="96px"
                    />
                    <span className="absolute top-1 left-1 px-1.5 py-0.5 rounded bg-brand/90 text-white text-[8px] font-black uppercase tracking-wider backdrop-blur-sm">
                      Cinema
                    </span>
                  </Link>

                  <div className="flex-1 min-w-0 py-0.5">
                    <Link
                      to={`/films/${film?.slug || film?.id}`}
                      className="font-heading text-base font-black text-text-primary line-clamp-2 leading-tight hover:text-brand transition-colors"
                    >
                      {film?.title}
                    </Link>

                    <div className="flex flex-wrap items-center gap-1.5 mt-1.5 text-[11px] text-text-muted">
                      {film?.year && <span>{film.year}</span>}
                      {film?.runtime_minutes && <span>· {film.runtime_minutes}m</span>}
                      {likedPercent != null && (
                        <span className="flex items-center gap-1 text-emerald-400 font-bold ml-1">
                          <Icon icon="solar:like-bold" className="text-xs" />
                          {likedPercent}%
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2 mt-2.5">
                      <Link
                        to={`/films/${film?.slug || film?.id}`}
                        className="inline-flex items-center gap-1 text-[11px] font-bold text-brand hover:underline"
                      >
                        <span>Film overview</span>
                        <Icon icon="solar:arrow-right-linear" className="text-xs" />
                      </Link>
                    </div>
                  </div>
                </div>

                {/* Cinema Venues & Screening Times */}
                <div className="p-3.5 space-y-4 divide-y divide-border/30">
                  {visibleCinemas.map(({ cinema, times }, cIdx) => (
                    <div key={cinema?.id || cIdx} className={cIdx > 0 ? 'pt-3.5' : ''}>
                      {/* Venue Header */}
                      <div className="flex items-center justify-between gap-2 mb-2.5">
                        <div className="min-w-0">
                          <Link
                            to={`/cinemas/${cinema?.id}`}
                            className="font-heading text-xs font-black text-text-primary uppercase tracking-tight hover:text-brand transition-colors block truncate"
                          >
                            {cinema?.name}
                          </Link>
                          <p className="text-[10px] text-text-muted flex items-center gap-1 mt-0.5 truncate">
                            <Icon icon="solar:map-point-linear" className="text-brand shrink-0" />
                            <span className="truncate">{cinema?.city} {cinema?.address ? `· ${cinema.address}` : ''}</span>
                          </p>
                        </div>

                        {cinema?.google_maps_url && (
                          <a
                            href={cinema.google_maps_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="shrink-0 flex items-center gap-1 text-[10px] font-bold text-brand hover:underline px-2 py-1 rounded-md bg-brand/10 border border-brand/20"
                          >
                            <span>Map</span>
                            <Icon icon="solar:compass-linear" className="text-xs" />
                          </a>
                        )}
                      </div>

                      {/* Showtime Buttons Grid */}
                      <div className="grid grid-cols-3 gap-2">
                        {times.map((st) => {
                          const isSpecial = st.format && st.format !== 'Standard';
                          return (
                            <a
                              key={st.id}
                              href={st.ticket_url || '#'}
                              target={st.ticket_url ? '_blank' : '_self'}
                              rel="noopener noreferrer"
                              className={`flex flex-col items-center justify-center p-2 rounded-xl border text-center transition-all min-h-[46px] active:scale-95 select-none ${
                                isSpecial
                                  ? 'bg-brand/15 border-brand/40 text-brand hover:bg-brand hover:text-white'
                                  : 'bg-surface-2/60 border-border/80 text-text-primary hover:border-brand hover:text-brand'
                              } ${!st.ticket_url ? 'cursor-default' : 'shadow-xs'}`}
                            >
                              <span className="text-xs font-black tracking-tight leading-none">
                                {formatShowTime(st.show_time)}
                              </span>
                              <span className="text-[8px] font-extrabold uppercase tracking-wider mt-1 opacity-70 leading-none">
                                {st.format || 'Standard'}
                              </span>
                            </a>
                          );
                        })}
                      </div>
                    </div>
                  ))}

                  {/* Show More Venues Expansion */}
                  {hasMoreCinemas && (
                    <div className="pt-2">
                      <button
                        onClick={() => toggleFilmExpansion(filmId)}
                        className="w-full py-2.5 px-3 rounded-xl bg-surface-2/50 border border-border/70 hover:border-brand/50 text-[11px] font-bold text-text-secondary hover:text-brand transition-all flex items-center justify-center gap-1.5"
                      >
                        <span>{isExpanded ? 'Show Fewer Cinemas' : `+ ${cinemaList.length - 2} More Cinemas Showing This`}</span>
                        <Icon
                          icon={isExpanded ? 'solar:alt-arrow-up-linear' : 'solar:alt-arrow-down-linear'}
                          className="text-sm"
                        />
                      </button>
                    </div>
                  )}
                </div>
              </article>
            );
          })
        )}
      </div>

      {/* 4. FILTER BOTTOM DRAWER MODAL */}
      {isFilterSheetOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center p-0 animate-in fade-in duration-200">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            onClick={() => setIsFilterSheetOpen(false)}
          />

          {/* Drawer Sheet */}
          <div className="relative w-full max-w-lg bg-surface border-t border-hairline rounded-t-3xl p-5 shadow-2xl z-10 space-y-5 animate-in slide-in-from-bottom duration-200 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-border/60">
              <div className="flex items-center gap-2">
                <Icon icon="solar:filter-bold" className="text-brand text-lg" />
                <h3 className="font-heading text-lg font-black text-text-primary">
                  Filter Showtimes
                </h3>
              </div>
              <button
                onClick={() => setIsFilterSheetOpen(false)}
                className="w-8 h-8 rounded-full bg-surface-2 flex items-center justify-center text-text-muted hover:text-text-primary"
              >
                <Icon icon="solar:close-circle-bold" className="text-xl" />
              </button>
            </div>

            {/* City Selection */}
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-wider text-text-muted">
                City / Region
              </label>
              <div className="grid grid-cols-2 gap-2">
                {cities.map((city) => (
                  <button
                    key={city}
                    onClick={() => setSelectedCity(city)}
                    className={`py-2.5 px-3 rounded-xl text-xs font-bold border transition-all text-left truncate ${
                      selectedCity === city
                        ? 'bg-brand text-white border-brand shadow-sm shadow-brand/20'
                        : 'bg-surface-2 border-border/60 text-text-secondary hover:text-text-primary'
                    }`}
                  >
                    {city === 'All' ? 'All Cities' : city}
                  </button>
                ))}
              </div>
            </div>

            {/* Cinema Selection */}
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-wider text-text-muted">
                Cinema Venue
              </label>
              <select
                value={selectedCinema}
                onChange={(e) => setSelectedCinema(e.target.value)}
                className="w-full bg-surface-2 border border-border text-text-primary rounded-xl px-3.5 py-3 text-xs font-bold focus:border-brand focus:outline-none"
              >
                <option value="All">All Cinemas</option>
                {cinemas
                  .filter((c) => selectedCity === 'All' || c.city === selectedCity)
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.city})
                    </option>
                  ))}
              </select>
            </div>

            {/* Experience / Format Selection */}
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-wider text-text-muted">
                Experience / Screen Format
              </label>
              <div className="grid grid-cols-3 gap-2">
                {formats.map((fmt) => (
                  <button
                    key={fmt}
                    onClick={() => setSelectedFormat(fmt)}
                    className={`py-2.5 px-2 rounded-xl text-xs font-bold border transition-all text-center ${
                      selectedFormat === fmt
                        ? 'bg-brand text-white border-brand shadow-sm shadow-brand/20'
                        : 'bg-surface-2 border-border/60 text-text-secondary hover:text-text-primary'
                    }`}
                  >
                    {fmt}
                  </button>
                ))}
              </div>
            </div>

            {/* Apply & Reset CTAs */}
            <div className="flex gap-3 pt-3">
              <button
                onClick={resetFilters}
                className="flex-1 py-3 rounded-xl bg-surface-2 border border-border text-xs font-bold text-text-secondary uppercase tracking-wider active:scale-95"
              >
                Reset
              </button>
              <button
                onClick={() => setIsFilterSheetOpen(false)}
                className="flex-1 py-3 rounded-xl bg-brand hover:bg-brand-hover text-white text-xs font-bold uppercase tracking-wider shadow-lg shadow-brand/20 active:scale-95"
              >
                Apply Filters
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
