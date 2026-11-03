import React from 'react';
import { Link } from 'react-router-dom';
import { Icon } from '@iconify/react';
import { toTitleCase, toSentenceCase } from '../../../utils/format';

const CHAIN_LIST = ['Filmhouse', 'Genesis', 'Silverbird', 'Ozone', 'Blu Star', 'Kada', 'Viva'];

export function extractChain(name = '') {
  return CHAIN_LIST.find((c) => name.toLowerCase().includes(c.toLowerCase())) || null;
}

// Accent colour per chain: solid tile, soft pill, and top accent bar.
const chainTheme = {
  Filmhouse: { tile: 'bg-amber-500 text-black', pill: 'bg-amber-500/15 text-amber-400 border-amber-500/30', bar: 'bg-amber-500' },
  Genesis: { tile: 'bg-blue-600 text-white', pill: 'bg-blue-500/15 text-blue-400 border-blue-500/30', bar: 'bg-blue-500' },
  Silverbird: { tile: 'bg-purple-600 text-white', pill: 'bg-purple-500/15 text-purple-400 border-purple-500/30', bar: 'bg-purple-500' },
  Ozone: { tile: 'bg-emerald-600 text-white', pill: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30', bar: 'bg-emerald-500' },
  'Blu Star': { tile: 'bg-orange-600 text-white', pill: 'bg-orange-500/15 text-orange-400 border-orange-500/30', bar: 'bg-orange-500' },
  Kada: { tile: 'bg-teal-600 text-white', pill: 'bg-teal-500/15 text-teal-400 border-teal-500/30', bar: 'bg-teal-500' },
  Viva: { tile: 'bg-pink-600 text-white', pill: 'bg-pink-500/15 text-pink-400 border-pink-500/30', bar: 'bg-pink-500' },
};

const neutralTheme = {
  tile: 'bg-surface-2 text-text-secondary border border-border',
  pill: 'bg-surface-2 text-text-muted border-border',
  bar: 'bg-border',
};

function directionsUrl(cinema) {
  if (cinema.google_maps_url) return cinema.google_maps_url;
  const q = [cinema.name, cinema.address, cinema.city].filter(Boolean).join(', ');
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
}

function CinemaCard({ cinema, showCount }) {
  const chain = extractChain(cinema.name);
  const theme = chain ? chainTheme[chain] : neutralTheme;
  const isPlaying = showCount > 0;
  const tileLabel = chain
    ? chain.split(' ').map((w) => w[0]).join('')
    : (cinema.name || '?').trim().charAt(0).toUpperCase();

  return (
    <article className="group relative flex flex-col bg-surface border border-border rounded-2xl overflow-hidden transition-all duration-300 hover:border-brand/50 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-black/20">
      {/* Chain accent bar */}
      <div className={`h-1 w-full ${theme.bar}`} />

      <Link to={`/cinemas/${cinema.id}`} className="flex-1 p-5 block">
        <div className="flex items-start gap-4">
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-heading font-black text-base shrink-0 ${theme.tile}`}>
            {tileLabel}
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="font-heading font-bold text-base text-text-primary leading-snug line-clamp-2 group-hover:text-brand transition-colors">
              {toTitleCase(cinema.name)}
            </h3>
            <p className="text-xs text-text-muted mt-1 flex items-center gap-1.5 truncate">
              <Icon icon="solar:map-point-linear" className="shrink-0 text-brand" width="13" />
              <span className="truncate">
                {[toTitleCase(cinema.city), toTitleCase(cinema.state)].filter(Boolean).join(', ') || 'Location TBA'}
              </span>
            </p>
          </div>
        </div>

        {cinema.address && (
          <p className="text-xs text-text-secondary mt-4 line-clamp-2 leading-relaxed">
            {toSentenceCase(cinema.address)}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-2 mt-4">
          {chain && (
            <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border ${theme.pill}`}>
              {chain}
            </span>
          )}
          {isPlaying ? (
            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/25 inline-flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              {showCount} {showCount === 1 ? 'film' : 'films'} showing
            </span>
          ) : (
            <span className="text-[11px] font-medium px-2 py-0.5 rounded-md bg-surface-2 text-text-muted border border-border">
              No listings yet
            </span>
          )}
        </div>
      </Link>

      {/* Action row */}
      <div className="grid grid-cols-3 divide-x divide-border border-t border-border text-xs font-semibold">
        <Link
          to={`/cinemas/${cinema.id}`}
          className="flex items-center justify-center gap-1.5 py-3 text-text-secondary hover:text-brand hover:bg-surface-2/60 transition-colors"
        >
          <Icon icon="solar:calendar-date-linear" width="15" />
          Schedule
        </Link>
        <a
          href={directionsUrl(cinema)}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-1.5 py-3 text-text-secondary hover:text-brand hover:bg-surface-2/60 transition-colors"
        >
          <Icon icon="solar:routing-2-linear" width="15" />
          Directions
        </a>
        {cinema.booking_url ? (
          <a
            href={cinema.booking_url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-1.5 py-3 text-brand hover:bg-brand/10 transition-colors"
          >
            <Icon icon="solar:ticket-linear" width="15" />
            Tickets
          </a>
        ) : (
          <span className="flex items-center justify-center gap-1.5 py-3 text-text-muted/50 cursor-default">
            <Icon icon="solar:ticket-linear" width="15" />
            Tickets
          </span>
        )}
      </div>
    </article>
  );
}

function CardSkeleton() {
  return (
    <div className="bg-surface border border-border rounded-2xl overflow-hidden">
      <div className="h-1 bg-surface-2" />
      <div className="p-5 space-y-4">
        <div className="flex gap-4">
          <div className="w-12 h-12 rounded-xl bg-surface-2 animate-pulse" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-3/4 bg-surface-2 rounded animate-pulse" />
            <div className="h-3 w-1/2 bg-surface-2 rounded animate-pulse" />
          </div>
        </div>
        <div className="h-3 w-full bg-surface-2 rounded animate-pulse" />
        <div className="h-5 w-1/3 bg-surface-2 rounded animate-pulse" />
      </div>
      <div className="h-11 border-t border-border bg-surface-2/30" />
    </div>
  );
}

export default function DesktopCinemasView({
  allCinemas = [],
  filtered = [],
  groupedByCity = {},
  showCounts = {},
  loading = false,
  selectedCity,
  setSelectedCity,
  selectedChain,
  setSelectedChain,
  search,
  setSearch,
  cities = [],
  CHAINS = [],
}) {
  const playingToday = allCinemas.filter((c) => (showCounts[c.id] || 0) > 0).length;
  const cityCount = cities.filter((c) => c !== 'All').length;
  const hasFilters = selectedCity !== 'All' || selectedChain !== 'All' || Boolean(search);

  const chainCounts = allCinemas.reduce((acc, c) => {
    const chain = extractChain(c.name);
    if (chain) acc[chain] = (acc[chain] || 0) + 1;
    return acc;
  }, {});

  const resetFilters = () => {
    setSelectedCity('All');
    setSelectedChain('All');
    setSearch('');
  };

  return (
    <div className="min-h-[600px] pb-24">
      {/* Hero */}
      <section className="border-b border-border bg-gradient-to-b from-surface/50 to-bg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-8">
            <div className="max-w-2xl">
              <div className="inline-flex items-center gap-2 border border-brand/30 bg-brand/10 px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-[0.2em] text-brand mb-4">
                <Icon icon="solar:videocamera-record-bold" className="text-sm" />
                Exhibition
              </div>
              <h1 className="font-heading text-4xl lg:text-5xl font-black tracking-tight text-text-primary">
                Cinemas in Nigeria
              </h1>
              <p className="mt-3 text-sm sm:text-base text-text-muted leading-relaxed">
                Find a cinema near you, see how many films are showing today, and jump straight to schedules, directions and tickets.
              </p>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-3 shrink-0">
              {[
                { label: 'Venues', value: allCinemas.length, icon: 'solar:buildings-2-linear' },
                { label: 'Cities', value: cityCount, icon: 'solar:map-point-linear' },
                { label: 'Showing today', value: playingToday, icon: 'solar:play-circle-linear', live: true },
              ].map((s) => (
                <div key={s.label} className="min-w-[120px] bg-surface border border-border rounded-2xl px-4 py-3.5">
                  <div className="flex items-center justify-between text-text-muted">
                    <Icon icon={s.icon} width="16" className="text-brand" />
                    {s.live && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />}
                  </div>
                  <p className="mt-2 font-heading text-2xl font-black text-text-primary leading-none">{loading ? '—' : s.value}</p>
                  <p className="mt-1 text-[11px] font-semibold text-text-muted">{s.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Sticky toolbar */}
      <div className="sticky top-[72px] z-30 bg-bg/90 backdrop-blur-md border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[260px] max-w-md">
              <Icon icon="solar:magnifer-linear" className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted" width="18" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by cinema, area or address..."
                className="w-full h-11 bg-surface border border-border focus:border-brand rounded-xl pl-10 pr-9 text-sm text-text-primary placeholder:text-text-muted outline-none transition-colors"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary"
                  aria-label="Clear search"
                >
                  <Icon icon="solar:close-circle-bold" width="18" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide">
              {cities.map((city) => {
                const active = selectedCity === city;
                return (
                  <button
                    key={city}
                    onClick={() => setSelectedCity(city)}
                    className={`px-3.5 h-9 rounded-xl text-sm font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                      active
                        ? 'bg-brand text-white'
                        : 'bg-surface border border-border text-text-secondary hover:text-text-primary hover:border-brand/40'
                    }`}
                  >
                    {city === 'All' ? 'All cities' : toTitleCase(city)}
                  </button>
                );
              })}
            </div>

            {hasFilters && (
              <button
                onClick={resetFilters}
                className="ml-auto text-xs font-bold text-brand hover:underline inline-flex items-center gap-1 cursor-pointer"
              >
                Reset
                <Icon icon="solar:restart-linear" width="13" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide">
            <span className="text-[11px] font-bold uppercase tracking-wider text-text-muted mr-1">Chain</span>
            {CHAINS.map((chain) => {
              const active = selectedChain === chain;
              const theme = chainTheme[chain];
              const count = chain === 'All' ? allCinemas.length : chainCounts[chain] || 0;
              if (chain !== 'All' && count === 0) return null;
              return (
                <button
                  key={chain}
                  onClick={() => setSelectedChain(chain)}
                  className={`px-3 h-8 rounded-lg text-xs font-semibold whitespace-nowrap border transition-colors inline-flex items-center gap-1.5 cursor-pointer ${
                    active
                      ? 'bg-brand text-white border-brand'
                      : theme
                        ? `${theme.pill} hover:opacity-90`
                        : 'bg-surface border-border text-text-secondary hover:text-text-primary'
                  }`}
                >
                  {chain === 'All' ? 'All chains' : chain}
                  <span className={`text-[10px] font-bold ${active ? 'text-white/80' : 'opacity-70'}`}>{count}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Results */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8">
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {[1, 2, 3, 4, 5, 6].map((i) => <CardSkeleton key={i} />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-24 bg-surface/40 border-2 border-dashed border-border rounded-3xl">
            <Icon icon="solar:buildings-2-linear" className="mx-auto mb-3 text-brand opacity-50" width="40" />
            <h3 className="font-heading text-lg font-bold text-text-primary">No cinemas match your filters</h3>
            <p className="text-sm text-text-muted mt-1">Try another city or chain, or clear your search.</p>
            {hasFilters && (
              <button
                onClick={resetFilters}
                className="mt-5 px-5 py-2.5 rounded-xl bg-brand text-white text-xs font-bold uppercase tracking-wider cursor-pointer"
              >
                Reset filters
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-12">
            {Object.entries(groupedByCity).map(([city, list]) => {
              const live = list.filter((c) => (showCounts[c.id] || 0) > 0).length;
              return (
                <section key={city}>
                  <div className="flex items-end justify-between gap-4 mb-5 pb-3 border-b border-border">
                    <div>
                      <h2 className="font-heading text-2xl font-black text-text-primary tracking-tight">{toTitleCase(city)}</h2>
                      <p className="text-xs text-text-muted mt-0.5">
                        {list.length} {list.length === 1 ? 'cinema' : 'cinemas'}
                        {live > 0 && <span className="text-emerald-400"> · {live} showing today</span>}
                      </p>
                    </div>
                    <Link
                      to="/showtimes"
                      className="text-xs font-bold text-brand hover:underline inline-flex items-center gap-1 shrink-0"
                    >
                      Showtimes
                      <Icon icon="solar:arrow-right-linear" width="13" />
                    </Link>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                    {list.map((cinema) => (
                      <CinemaCard key={cinema.id} cinema={cinema} showCount={showCounts[cinema.id] || 0} />
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
