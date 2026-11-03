import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from '@iconify/react';
import ImageWithFallback from '../../ui/ImageWithFallback';
import { PLATFORMS } from '../../../lib/platforms';

const POPULAR_STREAMING = [
  { id: 'netflix', name: 'Netflix', color: '#E50914', icon: 'simple-icons:netflix' },
  { id: 'prime_video', name: 'Prime Video', color: '#00A8E1', icon: 'simple-icons:amazonprime' },
  { id: 'youtube', name: 'YouTube', color: '#FF0000', icon: 'simple-icons:youtube' },
  { id: 'showmax', name: 'Showmax', color: '#0054A6', icon: 'solar:tv-bold' },
];

export default function MobileStreamingHub({
  newToStream = {},
  youtubeFeed = [],
  isLoading = false,
}) {
  const [activePlatform, setActivePlatform] = useState('netflix');

  const currentFilms = activePlatform === 'youtube'
    ? youtubeFeed
    : (newToStream[activePlatform] || []);

  const featuredFilm = currentFilms[0];
  const secondaryFilms = currentFilms.slice(1, 5);

  const activePlatformMeta = POPULAR_STREAMING.find((p) => p.id === activePlatform) || POPULAR_STREAMING[0];

  return (
    <section id="mobile-section-streaming" className="w-full py-6 px-4 bg-surface/30 border-y border-white/5">
      {/* Section Header */}
      <div className="flex items-end justify-between gap-3 mb-3">
        <div className="space-y-0.5">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-brand">1-Tap Streaming Hub</p>
          <h3 className="font-heading text-lg font-bold text-text-primary tracking-tight">
            Stream Tonight
          </h3>
        </div>
        <Link
          to={`/watch/${activePlatform}`}
          className="text-xs font-bold text-brand hover:underline flex items-center gap-1 shrink-0 pb-0.5"
        >
          <span>See all</span>
          <Icon icon="solar:arrow-right-linear" className="text-sm" />
        </Link>
      </div>

      {/* 1-Tap Platform Switcher Pills */}
      <div className="flex gap-2 overflow-x-auto pb-3 scrollbar-hide">
        {POPULAR_STREAMING.map((p) => {
          const isActive = activePlatform === p.id;
          return (
            <button
              key={p.id}
              onClick={() => setActivePlatform(p.id)}
              className={`shrink-0 flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold border transition-all duration-200 min-h-[40px] select-none ${
                isActive
                  ? 'bg-surface border-brand text-white shadow-md shadow-brand/20'
                  : 'bg-surface/60 border-border/50 text-text-muted hover:text-text-primary'
              }`}
            >
              <Icon icon={p.icon} className="text-sm" style={{ color: p.color }} />
              <span>{p.name}</span>
            </button>
          );
        })}
      </div>

      {/* Featured Title Spotlight for Active Platform */}
      {featuredFilm ? (
        <div className="space-y-3">
          <Link
            to={`/films/${featuredFilm.slug || featuredFilm.id}`}
            className="group relative block w-full rounded-2xl overflow-hidden bg-surface border border-border/60 hover:border-brand/40 transition-all shadow-md active:scale-[0.99]"
          >
            {/* Backdrop / Landscape preview */}
            <div className="relative aspect-[16/9] w-full overflow-hidden bg-surface-2">
              <ImageWithFallback
                src={featuredFilm.backdrop_url || featuredFilm.poster_url}
                alt={featuredFilm.title}
                fallbackType="film"
                name={featuredFilm.title}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />

              {/* Platform Chip */}
              <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-black/70 backdrop-blur-md text-[10px] font-bold text-white border border-white/10">
                <Icon icon={activePlatformMeta.icon} style={{ color: activePlatformMeta.color }} />
                <span>On {activePlatformMeta.name}</span>
              </div>

              {/* Bottom Title & Details */}
              <div className="absolute bottom-3 left-3 right-3 space-y-1">
                <h4 className="font-heading text-base font-black text-white line-clamp-1 leading-tight group-hover:text-brand transition-colors">
                  {featuredFilm.title}
                </h4>
                {featuredFilm.synopsis && (
                  <p className="text-[11px] text-white/80 line-clamp-2 leading-relaxed">
                    {featuredFilm.synopsis}
                  </p>
                )}
              </div>
            </div>

            {/* Direct Action Bar */}
            <div className="p-3 bg-surface flex items-center justify-between border-t border-white/5">
              <div className="text-[11px] font-semibold text-text-secondary">
                {featuredFilm.genres?.[0] || 'Feature Film'} {featuredFilm.year ? `· ${featuredFilm.year}` : ''}
              </div>
              <div className="flex items-center gap-1 text-xs font-bold text-brand group-hover:translate-x-1 transition-transform">
                <span>Watch details</span>
                <Icon icon="solar:arrow-right-linear" />
              </div>
            </div>
          </Link>

          {/* Secondary 2-Poster Mini Grid */}
          {secondaryFilms.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1">
              {secondaryFilms.slice(0, 2).map((film) => (
                <Link
                  key={film.id}
                  to={`/films/${film.slug || film.id}`}
                  className="flex items-center gap-2.5 p-2 rounded-xl bg-surface/70 border border-border/40 hover:border-brand/40 transition-all active:scale-95"
                >
                  <div className="w-10 h-14 rounded-md overflow-hidden shrink-0 bg-surface-2">
                    <ImageWithFallback
                      src={film.poster_url || film.backdrop_url}
                      alt={film.title}
                      fallbackType="film"
                      name={film.title}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h5 className="font-heading text-xs font-bold text-text-primary truncate">
                      {film.title}
                    </h5>
                    <span className="text-[10px] text-text-muted truncate block">
                      {film.year || 'Stream'}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="py-8 text-center text-xs text-text-muted bg-surface/40 rounded-xl">
          No titles found for {activePlatformMeta.name} right now.
        </div>
      )}
    </section>
  );
}
