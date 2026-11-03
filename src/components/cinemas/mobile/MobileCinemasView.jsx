import React from 'react';
import { Link } from 'react-router-dom';
import { Icon } from '@iconify/react';
import { toTitleCase, toSentenceCase, formatPersonName } from '../../../utils/format';

function extractChain(name = '') {
  const chains = ['Filmhouse', 'Genesis', 'Silverbird', 'Ozone', 'Blu Star', 'Kada', 'Viva'];
  return chains.find((c) => name.toLowerCase().includes(c.toLowerCase())) || null;
}

const chainColors = {
  Filmhouse: 'bg-amber-500/20 text-amber-400 border-amber-500/40',
  Genesis: 'bg-blue-500/20 text-blue-400 border-blue-500/40',
  Silverbird: 'bg-purple-500/20 text-purple-400 border-purple-500/40',
  Ozone: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40',
  'Blu Star': 'bg-orange-500/20 text-orange-400 border-orange-500/40',
  Kada: 'bg-teal-500/20 text-teal-400 border-teal-500/40',
  Viva: 'bg-pink-500/20 text-pink-400 border-pink-500/40',
};

export default function MobileCinemasView({
  cinemas = [],
  showCounts = {},
  loading = false,
  selectedCity = 'All',
  setSelectedCity,
  selectedChain = 'All',
  setSelectedChain,
  search = '',
  setSearch,
  cities = [],
  CHAINS = [],
  groupedByCity = {},
}) {
  const cityEntries = Object.entries(groupedByCity);
  const totalCinemas = cinemas.length;

  return (
    <div className="w-full pb-28 md:hidden">
      {/* 1. COMPACT HERO & SEARCH */}
      <div className="px-4 pt-4 pb-3 bg-gradient-to-b from-surface/80 to-[#0B0D10] border-b border-white/5">
        <div className="flex items-center gap-1.5 text-brand text-[10px] font-black uppercase tracking-[0.2em]">
          <Icon icon="solar:city-bold" className="text-sm" />
          <span>Cinemas & Exhibition Circuits</span>
        </div>
        <h1 className="font-heading text-2xl font-black text-text-primary tracking-tight mt-0.5">
          Cinema Theatres
        </h1>

        {/* Search Input */}
        <div className="mt-3 relative">
          <Icon
            icon="solar:magnifer-linear"
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted text-sm"
          />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search cinema chain, location, city..."
            className="w-full h-11 bg-surface border border-border/80 focus:border-brand rounded-xl pl-10 pr-9 text-xs text-text-primary outline-none placeholder:text-text-muted transition-all"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary"
            >
              <Icon icon="solar:close-circle-linear" className="text-base" />
            </button>
          )}
        </div>
      </div>

      {/* 2. STICKY CHAIN & CITY SLIDERS */}
      <div className="sticky top-14 z-30 w-full bg-[#0B0D10]/95 backdrop-blur-md border-b border-white/5 py-2 px-3 shadow-md shadow-black/40">
        {/* Cinema Chain Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide py-1">
          {CHAINS.map((chain) => {
            const isSelected = selectedChain === chain;
            return (
              <button
                key={chain}
                onClick={() => setSelectedChain(chain)}
                className={`shrink-0 px-3.5 py-2 rounded-xl text-xs font-bold transition-all min-h-[38px] select-none ${
                  isSelected
                    ? 'bg-brand text-white border border-brand shadow-sm shadow-brand/30 scale-[1.02]'
                    : 'bg-surface/80 border border-border/60 text-text-secondary hover:text-text-primary'
                }`}
              >
                {chain === 'All' ? 'All Chains' : chain}
              </button>
            );
          })}
        </div>

        {/* City Filter Chips */}
        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide pt-1.5 mt-1 border-t border-white/5">
          <span className="text-[10px] font-black uppercase tracking-wider text-text-muted shrink-0 mr-1 flex items-center gap-1">
            <Icon icon="solar:map-point-linear" className="text-brand text-xs" />
            City:
          </span>
          {cities.map((city) => {
            const isSelected = selectedCity === city;
            return (
              <button
                key={city}
                onClick={() => setSelectedCity(city)}
                className={`shrink-0 px-2.5 py-1 rounded-full text-[11px] font-bold capitalize transition-all select-none ${
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
      </div>

      {/* 3. RESULTS SUMMARY */}
      <div className="px-4 py-3 flex items-center justify-between text-xs text-text-muted">
        <span className="font-semibold text-text-secondary">
          {loading ? 'Finding theatres...' : `${cinemas.length} Theatres Across Nigeria`}
        </span>
        {(search || selectedCity !== 'All' || selectedChain !== 'All') && (
          <button
            onClick={() => {
              setSearch('');
              setSelectedCity('All');
              setSelectedChain('All');
            }}
            className="text-[11px] font-bold text-brand hover:underline flex items-center gap-1"
          >
            <span>Reset filters</span>
            <Icon icon="solar:restart-linear" className="text-xs" />
          </button>
        )}
      </div>

      {/* 4. THEATRES BY CITY ACCORDION/LIST */}
      <div className="px-4 space-y-6">
        {loading ? (
          [...Array(4)].map((_, i) => (
            <div key={i} className="h-28 bg-surface rounded-2xl border border-border animate-pulse" />
          ))
        ) : cityEntries.length === 0 ? (
          <div className="text-center py-20 px-4 bg-surface/50 border border-border rounded-3xl mt-4">
            <div className="w-16 h-16 rounded-2xl bg-brand/10 border border-brand/20 flex items-center justify-center text-brand mx-auto mb-4">
              <Icon icon="solar:buildings-2-linear" className="w-8 h-8 opacity-60" />
            </div>
            <h3 className="font-heading font-black text-lg text-text-primary mb-1">
              No Theatres Found
            </h3>
            <p className="text-xs text-text-muted max-w-xs mx-auto leading-relaxed">
              No cinema locations match your search query or selected city filter.
            </p>
          </div>
        ) : (
          cityEntries.map(([city, cityCinemas]) => (
            <div key={city} className="space-y-3">
              {/* City Group Header */}
              <div className="flex items-center justify-between pb-1 border-b border-border/40">
                <h2 className="font-heading text-sm font-black uppercase tracking-wider text-text-primary flex items-center gap-1.5">
                  <Icon icon="solar:map-point-wave-bold" className="text-brand text-sm" />
                  <span>{city}</span>
                </h2>
                <span className="text-[10px] font-bold text-text-muted">
                  {cityCinemas.length} {cityCinemas.length === 1 ? 'Location' : 'Locations'}
                </span>
              </div>

              {/* Cinema Venue Cards */}
              <div className="space-y-2.5">
                {cityCinemas.map((cinema) => {
                  const chain = extractChain(cinema.name);
                  const colorClass = chain ? chainColors[chain] || 'bg-surface-2 text-text-muted' : 'bg-surface-2 text-text-muted';
                  const initials = formatPersonName(cinema.name)?.charAt(0) || 'C';
                  const showCount = showCounts[cinema.id] || 0;

                  return (
                    <div
                      key={cinema.id}
                      className="bg-surface border border-border/80 rounded-2xl p-3.5 shadow-xs"
                    >
                      <div className="flex items-start gap-3">
                        <div className={`w-11 h-11 rounded-xl flex items-center justify-center text-base font-black font-heading shrink-0 border ${colorClass}`}>
                          {initials}
                        </div>

                        <div className="flex-1 min-w-0">
                          <Link
                            to={`/cinemas/${cinema.id}`}
                            className="font-heading text-sm font-black text-text-primary hover:text-brand transition-colors block truncate"
                          >
                            {toTitleCase(cinema.name)}
                          </Link>

                          {(cinema.address || cinema.city) && (
                            <p className="text-[11px] text-text-muted flex items-center gap-1 mt-0.5 truncate">
                              <Icon icon="solar:map-point-linear" className="text-brand/60 shrink-0" />
                              <span className="truncate">
                                {[toTitleCase(cinema.city), toTitleCase(cinema.state)].filter(Boolean).join(', ')}
                              </span>
                            </p>
                          )}

                          <div className="flex items-center gap-2 mt-2">
                            {chain && (
                              <span className={`text-[8px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border ${colorClass}`}>
                                {chain}
                              </span>
                            )}
                            {showCount > 0 && (
                              <span className="text-[9px] font-bold text-emerald-400 flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                <span>{showCount} movies today</span>
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Card Action Strip */}
                      <div className="flex items-center gap-2 pt-3 mt-3 border-t border-border/40">
                        <Link
                          to={`/cinemas/${cinema.id}`}
                          className="flex-1 flex items-center justify-center gap-1 py-2 px-3 rounded-xl bg-surface-2/60 hover:bg-surface-2 text-text-primary text-[11px] font-bold transition-all border border-border/60"
                        >
                          <span>Showtimes</span>
                          <Icon icon="solar:arrow-right-linear" className="text-xs" />
                        </Link>

                        {cinema.booking_url && (
                          <a
                            href={cinema.booking_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex-1 flex items-center justify-center gap-1 py-2 px-3 rounded-xl bg-brand/15 hover:bg-brand/25 text-brand text-[11px] font-bold transition-all border border-brand/30"
                          >
                            <Icon icon="solar:ticket-bold" className="text-xs" />
                            <span>Book Now</span>
                          </a>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
