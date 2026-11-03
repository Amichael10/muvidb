import React, { useState } from 'react';
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

export default function MobilePlaysListView({
  plays = [],
  loading = false,
  activeTab = 'all',
  setActiveTab,
  selectedCity = 'all',
  setSelectedCity,
  search = '',
  setSearch,
  counts = {},
  popularCities = [],
  filtered = [],
  featuredPlay = null,
}) {
  const [showSearch, setShowSearch] = useState(false);

  const tabs = [
    { id: 'all', label: 'All Plays', count: counts.all },
    { id: 'currently_running', label: 'On Stage', count: counts.currently_running, pulse: true },
    { id: 'upcoming', label: 'Upcoming', count: counts.upcoming },
    { id: 'box_office', label: 'Box Office', count: counts.box_office },
    { id: 'archived', label: 'Archive', count: counts.archived },
  ];

  return (
    <div className="w-full pb-28 md:hidden">
      {/* 1. COMPACT MOBILE HERO & SEARCH TRIGGER */}
      <div className="px-4 pt-4 pb-3 bg-gradient-to-b from-surface/80 to-[#0B0D10] border-b border-white/5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-1.5 text-brand text-[10px] font-black uppercase tracking-[0.2em]">
              <Icon icon="solar:masks-bold" className="text-sm" />
              <span>Live Repertoire & Heritage</span>
            </div>
            <h1 className="font-heading text-2xl font-black text-text-primary tracking-tight mt-0.5">
              Stage Plays & Theatre
            </h1>
          </div>

          <button
            onClick={() => setShowSearch(!showSearch)}
            className={`w-10 h-10 rounded-xl flex items-center justify-center border transition-all ${
              showSearch || search
                ? 'bg-brand text-white border-brand shadow-sm shadow-brand/30'
                : 'bg-surface border-border text-text-muted hover:text-text-primary'
            }`}
            aria-label="Toggle search"
          >
            <Icon icon={showSearch ? 'solar:close-circle-bold' : 'solar:magnifer-linear'} className="text-lg" />
          </button>
        </div>

        {/* Collapsible Search Input */}
        {(showSearch || search) && (
          <div className="mt-3 relative animate-in fade-in slide-in-from-top-2 duration-200">
            <Icon
              icon="solar:magnifer-linear"
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted text-sm"
            />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search play, venue, playwright, cast..."
              className="w-full h-11 bg-surface border border-border/80 focus:border-brand rounded-xl pl-10 pr-9 text-xs text-text-primary outline-none placeholder:text-text-muted transition-all"
              autoFocus={showSearch && !search}
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
        )}
      </div>

      {/* 2. STICKY CATEGORY & LOCATION SLIDER */}
      <div className="sticky top-14 z-30 w-full bg-[#0B0D10]/95 backdrop-blur-md border-b border-white/5 py-2 px-3 shadow-md shadow-black/40">
        {/* Status Segment Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide py-1">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`shrink-0 flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all min-h-[40px] select-none ${
                  isActive
                    ? 'bg-brand text-white border border-brand shadow-md shadow-brand/25 scale-[1.02]'
                    : 'bg-surface/80 border border-border/60 text-text-secondary hover:text-text-primary active:scale-95'
                }`}
              >
                {tab.pulse && (
                  <span className="flex h-2 w-2 rounded-full bg-emerald-400 animate-pulse mr-0.5" />
                )}
                <span>{tab.label}</span>
                <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-black ${
                  isActive ? 'bg-white/20 text-white' : 'bg-surface-2 text-text-muted'
                }`}>
                  {tab.count || 0}
                </span>
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
          {popularCities.map((city) => {
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
                {city === 'all' ? 'All Locations' : city}
              </button>
            );
          })}
        </div>
      </div>

      {/* 3. FEATURED MARQUEE CARD (Overview mode only, no active search) */}
      {!search && activeTab === 'all' && selectedCity === 'all' && featuredPlay && (
        <div className="px-4 pt-4">
          <Link
            to={`/plays/${featuredPlay.slug || featuredPlay.id}`}
            className="group relative block rounded-2xl overflow-hidden bg-gradient-to-br from-amber-500/15 via-surface to-surface border border-amber-500/30 p-3.5 shadow-lg shadow-black/30 active:scale-[0.99] transition-all"
          >
            <div className="flex gap-3.5">
              <div className="w-24 sm:w-28 aspect-[2/3] rounded-xl overflow-hidden shrink-0 bg-surface-2 shadow-md relative">
                <ImageWithFallback
                  src={featuredPlay.poster_url || featuredPlay.banner_url}
                  alt={featuredPlay.title}
                  fallbackType="film"
                  name={featuredPlay.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  sizes="112px"
                />
                <span className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded bg-brand text-white text-[8px] font-black uppercase tracking-wider shadow-sm">
                  Spotlight
                </span>
              </div>

              <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5">
                <div>
                  <div className="flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-amber-400">
                    <Icon icon="solar:star-bold" className="text-xs" />
                    <span>Featured Production</span>
                  </div>
                  <h3 className="font-heading text-base font-black text-text-primary group-hover:text-brand transition-colors line-clamp-2 mt-1 leading-snug">
                    {featuredPlay.title}
                  </h3>
                  {(featuredPlay.director || featuredPlay.playwright) && (
                    <p className="text-[11px] text-text-muted mt-1 truncate">
                      {featuredPlay.director ? `Dir. ${featuredPlay.director}` : `By ${featuredPlay.playwright}`}
                    </p>
                  )}
                </div>

                <div className="space-y-1 pt-2">
                  <div className="flex items-center gap-1.5 text-[10px] font-semibold text-text-secondary truncate">
                    <Icon icon="solar:calendar-minimalistic-bold" className="text-brand shrink-0" />
                    <span className="truncate">{getPlayDateLabel(featuredPlay, 'Dates TBA')}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-[10px] text-text-muted truncate">
                    <Icon icon="solar:map-point-bold" className="text-brand shrink-0" />
                    <span className="truncate">{featuredPlay.venue || featuredPlay.city || 'Venue TBA'}</span>
                  </div>
                </div>
              </div>
            </div>
          </Link>
        </div>
      )}

      {/* 4. RESULTS COUNT & ACTIVE FILTER PILL */}
      <div className="px-4 pt-4 pb-2 flex items-center justify-between text-xs text-text-muted">
        <span className="font-semibold text-text-secondary">
          {loading ? 'Loading repertoire...' : `${filtered.length} ${filtered.length === 1 ? 'Production' : 'Productions'}`}
        </span>
        {(search || selectedCity !== 'all' || activeTab !== 'all') && (
          <button
            onClick={() => {
              setSearch('');
              setSelectedCity('all');
              setActiveTab('all');
            }}
            className="text-[11px] font-bold text-brand hover:underline flex items-center gap-1"
          >
            <span>Reset filters</span>
            <Icon icon="solar:restart-linear" className="text-xs" />
          </button>
        )}
      </div>

      {/* 5. PERFORATED THEATRE TICKET STUB CARDS */}
      <div className="px-4 space-y-3 pt-1">
        {loading ? (
          [...Array(4)].map((_, i) => (
            <div key={i} className="h-32 bg-surface rounded-2xl border border-border animate-pulse" />
          ))
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 px-4 bg-surface/50 border border-border rounded-3xl mt-4">
            <div className="w-16 h-16 rounded-2xl bg-brand/10 border border-brand/20 flex items-center justify-center text-brand mx-auto mb-4">
              <Icon icon="solar:masks-linear" className="w-8 h-8 opacity-60" />
            </div>
            <h3 className="font-heading font-black text-lg text-text-primary mb-1">
              No Plays Found
            </h3>
            <p className="text-xs text-text-muted max-w-xs mx-auto leading-relaxed">
              No stage productions match your selected category, city, or search term.
            </p>
          </div>
        ) : (
          filtered.map((play) => {
            const isRunning = play.status === 'currently_running';
            const isUpcoming = play.status === 'upcoming';
            const boxOfficeStr = formatBoxOffice(play.box_office_domestic);

            return (
              <Link
                key={play.id}
                to={`/plays/${play.slug || play.id}`}
                className="group relative flex overflow-hidden rounded-2xl bg-surface border border-border/80 hover:border-brand/50 transition-all duration-300 shadow-sm active:scale-[0.99]"
              >
                {/* Left Ticket Stub (Poster + Perforation Notch) */}
                <div className="relative w-28 sm:w-32 shrink-0 aspect-[2/3] overflow-hidden bg-surface-2 border-r border-dashed border-border/80">
                  <ImageWithFallback
                    src={play.poster_url || play.banner_url}
                    alt={play.title}
                    fallbackType="film"
                    name={play.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    sizes="128px"
                  />

                  {/* Status Indicator Pill */}
                  <div className={`absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider backdrop-blur-sm ${
                    isRunning
                      ? 'bg-emerald-500/90 text-white'
                      : isUpcoming
                        ? 'bg-blue-600/90 text-white'
                        : 'bg-black/75 text-text-muted'
                  }`}>
                    {isRunning ? 'Live Run' : isUpcoming ? 'Upcoming' : 'Archive'}
                  </div>

                  {/* Perforated Top & Bottom Cutout Notches */}
                  <div className="absolute -top-2.5 -right-2.5 w-5 h-5 rounded-full bg-[#0B0D10] border border-border/80" />
                  <div className="absolute -bottom-2.5 -right-2.5 w-5 h-5 rounded-full bg-[#0B0D10] border border-border/80" />
                </div>

                {/* Right Ticket Body */}
                <div className="flex-1 p-3.5 flex flex-col justify-between min-w-0">
                  <div>
                    {/* Category & Box Office Chips */}
                    <div className="flex items-center justify-between gap-1.5 mb-1">
                      <span className="text-[9px] font-black uppercase tracking-wider text-brand truncate">
                        {play.genre || 'Stage Play'}
                      </span>
                      {boxOfficeStr && (
                        <span className="shrink-0 text-[9px] font-bold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 rounded flex items-center gap-0.5">
                          <Icon icon="solar:ticket-sale-bold" className="text-[10px]" />
                          {boxOfficeStr}
                        </span>
                      )}
                    </div>

                    {/* Play Title */}
                    <h3 className="font-heading text-sm sm:text-base font-black text-text-primary group-hover:text-brand transition-colors line-clamp-2 leading-snug">
                      {play.title}
                    </h3>

                    {/* Director / Playwright */}
                    {(play.director || play.playwright) && (
                      <p className="text-[10px] text-text-muted mt-0.5 truncate font-medium">
                        {play.director ? `Dir. ${play.director}` : `By ${play.playwright}`}
                      </p>
                    )}
                  </div>

                  {/* Date & Venue Footer */}
                  <div className="pt-2 border-t border-border/40 mt-2 space-y-1">
                    <div className="flex items-center gap-1.5 text-[10px] font-semibold text-text-secondary truncate">
                      <Icon icon="solar:calendar-minimalistic-bold" className="text-brand text-xs shrink-0" />
                      <span className="truncate">{getPlayDateLabel(play, 'Run dates TBA')}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-[10px] text-text-muted truncate">
                      <Icon icon="solar:map-point-bold" className="text-brand text-xs shrink-0" />
                      <span className="truncate">{play.venue ? `${play.venue}${play.city ? ` (${play.city})` : ''}` : (play.city || 'Venue TBA')}</span>
                    </div>
                  </div>
                </div>
              </Link>
            );
          })
        )}
      </div>
    </div>
  );
}
