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

function extractChain(name = '') {
  const chains = ['Filmhouse', 'Genesis', 'Silverbird', 'Ozone', 'Blu Star', 'Kada', 'Viva'];
  return chains.find((c) => name.toLowerCase().includes(c.toLowerCase())) || null;
}

const chainBadgeColors = {
  Filmhouse: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  Genesis: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
  Silverbird: 'bg-purple-500/15 text-purple-400 border-purple-500/30',
  Ozone: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  'Blu Star': 'bg-orange-500/15 text-orange-400 border-orange-500/30',
  Kada: 'bg-teal-500/15 text-teal-400 border-teal-500/30',
  Viva: 'bg-pink-500/15 text-pink-400 border-pink-500/30',
};

export default function DesktopShowtimesView({
  groupedByFilm = {},
  groupedByCinema = {},
  loading = false,
  selectedDate,
  setSelectedDate,
  selectedCity,
  setSelectedCity,
  selectedCinema,
  setSelectedCinema,
  selectedFormat,
  setSelectedFormat,
  selectedChain = 'All',
  setSelectedChain,
  searchQuery = '',
  setSearchQuery,
  next7Days = [],
  cities = [],
  cinemas = [],
  formats = [],
  CHAINS = [],
}) {
  const [viewMode, setViewMode] = useState('movie'); // 'movie' | 'cinema'
  const [expandedFilms, setExpandedFilms] = useState({});
  const [expandedCinemas, setExpandedCinemas] = useState({});

  const toggleFilmExpansion = (filmId) => {
    setExpandedFilms((prev) => ({ ...prev, [filmId]: !prev[filmId] }));
  };

  const toggleCinemaExpansion = (cinemaId) => {
    setExpandedCinemas((prev) => ({ ...prev, [cinemaId]: !prev[cinemaId] }));
  };

  const todayStr = next7Days[0] || selectedDate;
  const filmEntries = Object.entries(groupedByFilm);
  const cinemaEntries = Object.entries(groupedByCinema);

  const hasActiveFilters =
    selectedCity !== 'All' ||
    selectedCinema !== 'All' ||
    selectedFormat !== 'All' ||
    selectedChain !== 'All' ||
    Boolean(searchQuery.trim());

  const resetAllFilters = () => {
    setSelectedCity('All');
    setSelectedCinema('All');
    setSelectedFormat('All');
    if (setSelectedChain) setSelectedChain('All');
    if (setSearchQuery) setSearchQuery('');
  };

  return (
    <div className="w-full space-y-6 pt-4 pb-24">
      {/* 1. TOP HORIZONTAL 7-DAY CALENDAR RIBBON */}
      <section className="bg-surface/90 border border-border/80 rounded-2xl p-2.5 shadow-sm backdrop-blur-md">
        <div className="grid grid-cols-7 gap-2">
          {next7Days.map((dateStr) => {
            const { weekday, dayNum, month, isToday } = parseDayMeta(dateStr, todayStr);
            const isSelected = selectedDate === dateStr;

            return (
              <button
                key={dateStr}
                onClick={() => setSelectedDate(dateStr)}
                className={`group relative flex flex-col items-center justify-center py-3.5 px-3 rounded-xl border transition-all duration-200 cursor-pointer select-none ${
                  isSelected
                    ? 'bg-brand text-white border-brand shadow-lg shadow-brand/25 scale-[1.02]'
                    : 'bg-surface-2/40 border-border/60 text-text-muted hover:text-text-primary hover:border-brand/40 hover:bg-surface-2'
                }`}
              >
                <span
                  className={`text-[10px] font-black tracking-widest leading-none uppercase ${
                    isSelected ? 'text-white/90' : isToday ? 'text-brand' : 'text-text-muted'
                  }`}
                >
                  {weekday}
                </span>
                <span className="text-2xl font-black font-heading leading-tight my-1 tracking-tight">
                  {dayNum}
                </span>
                <span className="text-[9px] font-extrabold uppercase tracking-widest opacity-80 leading-none">
                  {month}
                </span>

                {isToday && !isSelected && (
                  <span className="absolute bottom-1 w-1.5 h-1.5 rounded-full bg-brand" />
                )}
              </button>
            );
          })}
        </div>
      </section>

      {/* 2. UNIFIED FILTER & INSTANT SEARCH TOOLBAR */}
      <section className="bg-surface border border-border/80 rounded-2xl p-4 sm:p-5 shadow-sm space-y-4">
        {/* Row 1: Search + City pills + View Toggle */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          {/* Live Search Input */}
          <div className="relative flex-1 min-w-[280px] max-w-md">
            <Icon
              icon="solar:magnifer-linear"
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted text-base pointer-events-none"
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search movie title, cinema name, city..."
              className="w-full h-11 bg-surface-2/70 border border-border/80 focus:border-brand rounded-xl pl-10 pr-9 text-xs font-semibold text-text-primary placeholder:text-text-muted outline-none transition-all"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary"
              >
                <Icon icon="solar:close-circle-bold" className="text-base" />
              </button>
            )}
          </div>

          {/* City Selector Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide py-0.5">
            <span className="text-[10px] font-black uppercase tracking-wider text-text-muted mr-1 flex items-center gap-1">
              <Icon icon="solar:map-point-linear" className="text-brand text-xs" />
              City:
            </span>
            {cities.map((city) => {
              const isSelected = selectedCity === city;
              return (
                <button
                  key={city}
                  onClick={() => setSelectedCity(city)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer select-none ${
                    isSelected
                      ? 'bg-brand text-white shadow-sm shadow-brand/20'
                      : 'bg-surface-2/60 text-text-muted border border-border/60 hover:text-text-primary hover:border-brand/30'
                  }`}
                >
                  {city === 'All' ? 'All Cities' : city}
                </button>
              );
            })}
          </div>

          {/* Dual View Mode: By Movie / By Cinema */}
          <div className="flex items-center gap-1 bg-surface-2 p-1 rounded-xl border border-border/60 shrink-0">
            <button
              onClick={() => setViewMode('movie')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer select-none ${
                viewMode === 'movie'
                  ? 'bg-brand text-white shadow-sm shadow-brand/20'
                  : 'text-text-muted hover:text-text-primary'
              }`}
            >
              <Icon icon="solar:clapperboard-play-bold" className="text-sm" />
              <span>By Movie</span>
            </button>
            <button
              onClick={() => setViewMode('cinema')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer select-none ${
                viewMode === 'cinema'
                  ? 'bg-brand text-white shadow-sm shadow-brand/20'
                  : 'text-text-muted hover:text-text-primary'
              }`}
            >
              <Icon icon="solar:city-bold" className="text-sm" />
              <span>By Cinema</span>
            </button>
          </div>
        </div>

        {/* Row 2: Chain Selector + Format Filter + Active Filters Reset */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-border/40 text-xs">
          {/* Cinema Chain Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide flex-1 py-0.5">
            <span className="text-[10px] font-black uppercase tracking-wider text-text-muted mr-1">
              Chains:
            </span>
            {CHAINS.map((chain) => {
              const isSelected = selectedChain === chain;
              const badgeStyle = chain !== 'All' ? chainBadgeColors[chain] : '';
              return (
                <button
                  key={chain}
                  onClick={() => setSelectedChain(chain)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all whitespace-nowrap cursor-pointer select-none border ${
                    isSelected
                      ? 'bg-brand text-white border-brand shadow-xs'
                      : chain !== 'All' && badgeStyle
                        ? `${badgeStyle} hover:opacity-90`
                        : 'bg-surface-2/40 border-border/60 text-text-muted hover:text-text-primary'
                  }`}
                >
                  {chain === 'All' ? 'All Chains' : chain}
                </button>
              );
            })}
          </div>

          {/* Screen Experience / Format Pills */}
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="text-[10px] font-black uppercase tracking-wider text-text-muted mr-1">
              Format:
            </span>
            {formats.map((fmt) => {
              const isSelected = selectedFormat === fmt;
              return (
                <button
                  key={fmt}
                  onClick={() => setSelectedFormat(fmt)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer select-none border ${
                    isSelected
                      ? 'bg-brand text-white border-brand shadow-xs'
                      : 'bg-surface-2/40 border-border/60 text-text-muted hover:text-text-primary'
                  }`}
                >
                  {fmt}
                </button>
              );
            })}
          </div>

          {/* Reset Filters CTA */}
          {hasActiveFilters && (
            <button
              onClick={resetAllFilters}
              className="text-[11px] font-bold text-brand hover:underline flex items-center gap-1 ml-2 cursor-pointer"
            >
              <span>Reset filters</span>
              <Icon icon="solar:restart-linear" className="text-xs" />
            </button>
          )}
        </div>
      </section>

      {/* 3. RESULTS STATUS BAR */}
      <div className="flex items-center justify-between text-xs text-text-muted px-1">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="font-semibold text-text-secondary">
            {loading
              ? 'Loading cinema schedule...'
              : viewMode === 'movie'
              ? `Showing ${filmEntries.length} ${filmEntries.length === 1 ? 'Movie' : 'Movies'} Screening`
              : `Showing ${cinemaEntries.length} ${cinemaEntries.length === 1 ? 'Cinema' : 'Cinemas'} With Screenings`}
          </span>
          {selectedCity !== 'All' && (
            <span>
              in <strong className="text-text-primary">{selectedCity}</strong>
            </span>
          )}
        </div>

        <span className="text-text-muted">
          Click any showtime to reserve seats directly on the cinema checkout portal.
        </span>
      </div>

      {/* 4. MAIN RESULTS VIEW */}
      {loading ? (
        // Skeletons
        <div className="space-y-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-64 bg-surface rounded-2xl border border-border animate-pulse" />
          ))}
        </div>
      ) : viewMode === 'movie' ? (
        /* ======================== MODE A: BY MOVIE ======================== */
        filmEntries.length === 0 ? (
          <div className="text-center py-28 bg-surface/40 border-2 border-dashed border-border rounded-3xl">
            <div className="w-16 h-16 rounded-2xl bg-brand/10 border border-brand/20 flex items-center justify-center text-brand mx-auto mb-4">
              <Icon icon="solar:clapperboard-play-linear" className="w-8 h-8 opacity-70" />
            </div>
            <h3 className="font-heading font-black text-xl text-text-primary mb-1">
              No Showtimes Found For This Date
            </h3>
            <p className="text-xs text-text-muted max-w-sm mx-auto leading-relaxed">
              No films match your search or selected city/format filters. Try selecting a different date or clearing active filters.
            </p>
            {hasActiveFilters && (
              <button
                onClick={resetAllFilters}
                className="mt-6 px-6 py-2.5 rounded-xl bg-brand hover:bg-brand-hover text-white text-xs font-bold uppercase tracking-wider transition-all shadow-md shadow-brand/20 cursor-pointer"
              >
                Reset All Filters
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-6">
            {filmEntries.map(([filmId, { film, cinemas: filmCinemas }]) => {
              const cinemaList = Object.values(filmCinemas);
              const isExpanded = !!expandedFilms[filmId];
              const visibleCinemas = isExpanded ? cinemaList : cinemaList.slice(0, 3);
              const hasMore = cinemaList.length > 3;
              const likedPercent = film?.liked_percent;
              const trailerId = film?.trailer_youtube_id;

              return (
                <article
                  key={filmId}
                  className="group bg-surface rounded-2xl border border-border/80 overflow-hidden shadow-sm hover:border-brand/40 transition-all duration-300"
                >
                  <div className="flex flex-col lg:flex-row divide-y lg:divide-y-0 lg:divide-x divide-border/60">
                    {/* Left Column: 2:3 Vertical Movie Poster Card */}
                    <div className="lg:w-72 xl:w-80 shrink-0 p-5 bg-surface-2/20 flex flex-col justify-between">
                      <div>
                        <div className="relative aspect-[2/3] rounded-xl overflow-hidden bg-surface-2 shadow-md">
                          <ImageWithFallback
                            src={film?.poster_url || film?.backdrop_url}
                            alt={film?.title}
                            fallbackType="film"
                            name={film?.title}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                            sizes="320px"
                          />
                          <span className="absolute top-2.5 left-2.5 px-2 py-0.5 rounded-md bg-brand text-white text-[9px] font-black uppercase tracking-wider shadow-sm">
                            Now In Cinemas
                          </span>
                        </div>

                        {/* Title & Metadata below poster */}
                        <div className="pt-3.5 space-y-1">
                          <Link
                            to={`/films/${film?.slug || film?.id}`}
                            className="font-heading text-lg font-black text-text-primary hover:text-brand transition-colors line-clamp-1 block leading-tight"
                          >
                            {film?.title}
                          </Link>

                          <div className="flex flex-wrap items-center gap-2 text-[11px] text-text-muted">
                            {film?.year && <span>{film.year}</span>}
                            {film?.runtime_minutes && <span>· {film.runtime_minutes}m</span>}
                            {likedPercent != null && (
                              <span className="flex items-center gap-1 text-emerald-400 font-bold ml-1">
                                <Icon icon="solar:like-bold" className="text-xs" />
                                {likedPercent}% Liked
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Action Links */}
                      <div className="pt-4 flex items-center gap-2 border-t border-border/40 mt-4">
                        <Link
                          to={`/films/${film?.slug || film?.id}`}
                          className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-surface-2/80 hover:bg-surface-2 text-text-primary text-xs font-bold border border-border/60 transition-all"
                        >
                          <span>Full Credits</span>
                          <Icon icon="solar:arrow-right-linear" className="text-xs" />
                        </Link>

                        {trailerId && (
                          <a
                            href={`https://www.youtube.com/watch?v=${trailerId}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-red-600/15 hover:bg-red-600/25 border border-red-500/30 text-red-400 text-xs font-bold transition-all"
                          >
                            <Icon icon="solar:videocamera-record-bold" className="text-sm" />
                            <span>Trailer</span>
                          </a>
                        )}
                      </div>
                    </div>

                    {/* Right Column: Cinemas & Interactive Showtime Buttons */}
                    <div className="flex-1 p-6 flex flex-col justify-between space-y-6">
                      <div className="space-y-6 divide-y divide-border/40">
                        {visibleCinemas.map(({ cinema, times }, cIdx) => {
                          const chain = extractChain(cinema?.name);
                          const colorBadge = chain ? chainBadgeColors[chain] : '';

                          return (
                            <div key={cinema?.id || cIdx} className={cIdx > 0 ? 'pt-6' : ''}>
                              {/* Venue Bar */}
                              <div className="flex items-center justify-between gap-3 mb-3">
                                <div className="flex items-center gap-2 min-w-0">
                                  {chain && (
                                    <span
                                      className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider border shrink-0 ${
                                        colorBadge || 'bg-surface-2 text-text-muted'
                                      }`}
                                    >
                                      {chain}
                                    </span>
                                  )}
                                  <Link
                                    to={`/cinemas/${cinema?.id}`}
                                    className="font-heading font-black text-sm text-text-primary hover:text-brand transition-colors truncate"
                                  >
                                    {cinema?.name}
                                  </Link>
                                  <span className="text-xs text-text-muted truncate">
                                    · {cinema?.city} {cinema?.address ? `(${cinema.address})` : ''}
                                  </span>
                                </div>

                                {cinema?.google_maps_url && (
                                  <a
                                    href={cinema.google_maps_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="shrink-0 flex items-center gap-1 text-[11px] font-bold text-brand hover:underline px-2.5 py-1 rounded-lg bg-brand/10 border border-brand/20 transition-colors"
                                  >
                                    <span>Directions</span>
                                    <Icon icon="solar:compass-linear" className="text-xs" />
                                  </a>
                                )}
                              </div>

                              {/* Showtime Pills Grid */}
                              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2.5">
                                {times.map((st) => {
                                  const isSpecial = st.format && st.format !== 'Standard';
                                  return (
                                    <a
                                      key={st.id}
                                      href={st.ticket_url || '#'}
                                      target={st.ticket_url ? '_blank' : '_self'}
                                      rel="noopener noreferrer"
                                      className={`group/pill flex flex-col items-center justify-center py-2.5 px-3 rounded-xl border text-center transition-all min-h-[50px] cursor-pointer select-none ${
                                        isSpecial
                                          ? 'bg-brand/15 border-brand/40 text-brand hover:bg-brand hover:text-white shadow-xs'
                                          : 'bg-surface-2/60 border-border/80 text-text-primary hover:border-brand hover:text-brand'
                                      } ${!st.ticket_url ? 'cursor-default' : 'active:scale-95'}`}
                                      title={st.ticket_url ? 'Click to book ticket' : 'Screening time'}
                                    >
                                      <span className="text-xs font-black tracking-tight leading-none group-hover/pill:scale-105 transition-transform">
                                        {formatShowTime(st.show_time)}
                                      </span>
                                      <span className="text-[9px] font-black uppercase tracking-wider mt-1 opacity-70 leading-none">
                                        {st.format || 'Standard'}
                                      </span>
                                    </a>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* Expand / Collapse More Venues */}
                      {hasMore && (
                        <div className="pt-2">
                          <button
                            onClick={() => toggleFilmExpansion(filmId)}
                            className="w-full py-3 px-4 rounded-xl bg-surface-2/40 hover:bg-surface-2 border border-border/60 hover:border-brand/40 text-xs font-bold text-text-secondary hover:text-brand transition-all flex items-center justify-center gap-2 cursor-pointer"
                          >
                            <span>
                              {isExpanded
                                ? 'Collapse Venue List'
                                : `+ ${cinemaList.length - 3} More Cinemas Showing This Film`}
                            </span>
                            <Icon
                              icon={isExpanded ? 'solar:alt-arrow-up-linear' : 'solar:alt-arrow-down-linear'}
                              className="text-sm"
                            />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )
      ) : (
        /* ======================== MODE B: BY CINEMA ======================== */
        cinemaEntries.length === 0 ? (
          <div className="text-center py-28 bg-surface/40 border-2 border-dashed border-border rounded-3xl">
            <div className="w-16 h-16 rounded-2xl bg-brand/10 border border-brand/20 flex items-center justify-center text-brand mx-auto mb-4">
              <Icon icon="solar:city-linear" className="w-8 h-8 opacity-70" />
            </div>
            <h3 className="font-heading font-black text-xl text-text-primary mb-1">
              No Cinemas Found With Screenings
            </h3>
            <p className="text-xs text-text-muted max-w-sm mx-auto leading-relaxed">
              No cinema locations match your selected city or chain filters for this date.
            </p>
          </div>
        ) : (
          <div className="space-y-8">
            {cinemaEntries.map(([cinemaId, { cinema, films: cinemaFilms }]) => {
              const filmList = Object.values(cinemaFilms);
              const chain = extractChain(cinema?.name);
              const colorBadge = chain ? chainBadgeColors[chain] : '';

              return (
                <div
                  key={cinemaId}
                  className="bg-surface rounded-2xl border border-border/80 overflow-hidden shadow-sm"
                >
                  {/* Cinema Master Header */}
                  <div className="p-5 bg-surface-2/40 border-b border-border/60 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      {chain && (
                        <span
                          className={`px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-wider border ${
                            colorBadge || 'bg-surface-2 text-text-muted'
                          }`}
                        >
                          {chain}
                        </span>
                      )}
                      <div>
                        <Link
                          to={`/cinemas/${cinema?.id}`}
                          className="font-heading text-lg font-black text-text-primary hover:text-brand transition-colors block leading-tight"
                        >
                          {cinema?.name}
                        </Link>
                        <p className="text-xs text-text-muted mt-0.5">
                          {cinema?.city} {cinema?.address ? `· ${cinema.address}` : ''}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="text-xs font-bold text-text-secondary bg-surface-2 px-3 py-1.5 rounded-lg border border-border/50">
                        {filmList.length} {filmList.length === 1 ? 'Movie' : 'Movies'} Today
                      </span>

                      {cinema?.google_maps_url && (
                        <a
                          href={cinema.google_maps_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1.5 text-xs font-bold text-brand hover:underline px-3 py-1.5 rounded-lg bg-brand/10 border border-brand/20 transition-colors"
                        >
                          <span>Map</span>
                          <Icon icon="solar:compass-linear" className="text-xs" />
                        </a>
                      )}
                    </div>
                  </div>

                  {/* Movies Playing At This Cinema */}
                  <div className="p-5 space-y-5 divide-y divide-border/40">
                    {filmList.map(({ film, times }, fIdx) => (
                      <div
                        key={film?.id || fIdx}
                        className={`flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                          fIdx > 0 ? 'pt-5' : ''
                        }`}
                      >
                        {/* Film Mini Thumbnail & Title */}
                        <div className="flex items-center gap-3.5 min-w-0 max-w-sm">
                          <Link
                            to={`/films/${film?.slug || film?.id}`}
                            className="w-14 aspect-[2/3] rounded-lg overflow-hidden shrink-0 bg-surface-2 shadow-xs block"
                          >
                            <ImageWithFallback
                              src={film?.poster_url || film?.backdrop_url}
                              alt={film?.title}
                              fallbackType="film"
                              name={film?.title}
                              className="w-full h-full object-cover"
                              sizes="56px"
                            />
                          </Link>

                          <div className="min-w-0">
                            <Link
                              to={`/films/${film?.slug || film?.id}`}
                              className="font-heading font-black text-sm text-text-primary hover:text-brand transition-colors block truncate"
                            >
                              {film?.title}
                            </Link>
                            <div className="text-[11px] text-text-muted flex items-center gap-1.5 mt-0.5">
                              {film?.year && <span>{film.year}</span>}
                              {film?.runtime_minutes && <span>· {film.runtime_minutes}m</span>}
                            </div>
                          </div>
                        </div>

                        {/* Screening Times */}
                        <div className="flex flex-wrap items-center gap-2 flex-1 justify-end">
                          {times.map((st) => {
                            const isSpecial = st.format && st.format !== 'Standard';
                            return (
                              <a
                                key={st.id}
                                href={st.ticket_url || '#'}
                                target={st.ticket_url ? '_blank' : '_self'}
                                rel="noopener noreferrer"
                                className={`flex flex-col items-center justify-center py-2 px-3 rounded-xl border text-center transition-all min-h-[46px] cursor-pointer select-none ${
                                  isSpecial
                                    ? 'bg-brand/15 border-brand/40 text-brand hover:bg-brand hover:text-white'
                                    : 'bg-surface-2/60 border-border/80 text-text-primary hover:border-brand hover:text-brand'
                                }`}
                              >
                                <span className="text-xs font-black tracking-tight leading-none">
                                  {formatShowTime(st.show_time)}
                                </span>
                                <span className="text-[8px] font-black uppercase tracking-wider mt-1 opacity-70 leading-none">
                                  {st.format || 'Standard'}
                                </span>
                              </a>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )
      )}
    </div>
  );
}
