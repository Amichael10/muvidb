import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from '@iconify/react';
import ImageWithFallback from '../../ui/ImageWithFallback';

function getRating(film) {
  if (film?.imdb_rating && film.imdb_rating > 0) return Number(film.imdb_rating).toFixed(1);
  if (film?.tmdb_rating && film.tmdb_rating > 0) return Number(film.tmdb_rating).toFixed(1);
  if (film?.average_rating && film.average_rating > 0) return Number(film.average_rating).toFixed(1);
  return null;
}

export default function MobileTopPodium({ top10Films = [], isLoading = false }) {
  const [showRemaining, setShowRemaining] = useState(false);

  if (isLoading && (!top10Films || top10Films.length === 0)) {
    return (
      <section className="w-full py-6 px-4 animate-pulse">
        <div className="h-5 w-36 bg-surface rounded mb-4" />
        <div className="w-full h-44 bg-surface rounded-2xl mb-3" />
        <div className="grid grid-cols-2 gap-3">
          <div className="h-32 bg-surface rounded-xl" />
          <div className="h-32 bg-surface rounded-xl" />
        </div>
      </section>
    );
  }

  if (!top10Films || top10Films.length === 0) return null;

  const first = top10Films[0];
  const second = top10Films[1];
  const third = top10Films[2];
  const remaining = top10Films.slice(3, 10);

  return (
    <section id="mobile-section-top10" className="w-full py-6 px-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="space-y-0.5">
          <div className="flex items-center gap-1.5 text-amber-400 text-xs font-bold">
            <Icon icon="solar:cup-star-bold" />
            <span>NIGERIA BOX OFFICE & CHARTS</span>
          </div>
          <h3 className="font-heading text-xl font-black text-text-primary tracking-tight">
            Top 10 This Week
          </h3>
        </div>
        <Link to="/top-10" className="text-xs font-bold text-brand hover:underline flex items-center gap-1">
          <span>Full Chart</span>
          <Icon icon="solar:arrow-right-linear" />
        </Link>
      </div>

      {/* #1 The Gold Takeover Card */}
      {first && (
        <Link
          to={`/films/${first.slug || first.id}`}
          className="group relative block w-full rounded-2xl overflow-hidden bg-gradient-to-br from-amber-500/20 via-surface to-surface border border-amber-500/30 p-4 mb-3 shadow-lg shadow-black/40 active:scale-[0.99] transition-all"
        >
          <div className="flex items-center gap-4">
            {/* Poster */}
            <div className="relative w-24 aspect-[2/3] rounded-xl overflow-hidden shrink-0 bg-surface-2 shadow-md">
              <ImageWithFallback
                src={first.poster_url || first.backdrop_url}
                alt={first.title}
                fallbackType="film"
                name={first.title}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              />
              <div className="absolute top-1 left-1 w-6 h-6 rounded-full bg-amber-400 text-black font-black text-xs flex items-center justify-center shadow-lg">
                1
              </div>
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0 space-y-1.5">
              <span className="px-2 py-0.5 rounded-full bg-amber-400/20 text-amber-300 border border-amber-400/30 text-[10px] font-black uppercase tracking-wider inline-block">
                👑 #1 THIS WEEK
              </span>
              <h4 className="font-heading text-base font-black text-white line-clamp-2 leading-tight group-hover:text-amber-300 transition-colors">
                {first.title}
              </h4>
              <p className="text-[11px] text-text-secondary truncate">
                {first.genres?.[0] || 'Nollywood Hit'} {first.year ? `· ${first.year}` : ''}
              </p>
              {getRating(first) && (
                <div className="flex items-center gap-1 text-xs font-bold text-amber-300">
                  <Icon icon="solar:star-bold" className="text-xs" />
                  <span>{getRating(first)} rating</span>
                </div>
              )}
            </div>
          </div>
        </Link>
      )}

      {/* #2 and #3 Split Podiums */}
      {(second || third) && (
        <div className="grid grid-cols-2 gap-3 mb-3">
          {second && (
            <Link
              to={`/films/${second.slug || second.id}`}
              className="group p-3 rounded-xl bg-surface border border-border/60 hover:border-brand/40 flex items-center gap-2.5 transition-all active:scale-95 shadow-sm"
            >
              <div className="relative w-12 h-16 rounded-lg overflow-hidden shrink-0 bg-surface-2">
                <ImageWithFallback
                  src={second.poster_url || second.backdrop_url}
                  alt={second.title}
                  fallbackType="film"
                  name={second.title}
                  className="w-full h-full object-cover"
                />
                <div className="absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-slate-300 text-black font-black text-[9px] flex items-center justify-center">
                  2
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <h5 className="font-heading text-xs font-bold text-text-primary truncate group-hover:text-brand transition-colors">
                  {second.title}
                </h5>
                <span className="text-[10px] text-text-muted truncate block">
                  {second.genres?.[0] || 'Rank 2'}
                </span>
              </div>
            </Link>
          )}

          {third && (
            <Link
              to={`/films/${third.slug || third.id}`}
              className="group p-3 rounded-xl bg-surface border border-border/60 hover:border-brand/40 flex items-center gap-2.5 transition-all active:scale-95 shadow-sm"
            >
              <div className="relative w-12 h-16 rounded-lg overflow-hidden shrink-0 bg-surface-2">
                <ImageWithFallback
                  src={third.poster_url || third.backdrop_url}
                  alt={third.title}
                  fallbackType="film"
                  name={third.title}
                  className="w-full h-full object-cover"
                />
                <div className="absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-amber-700 text-white font-black text-[9px] flex items-center justify-center">
                  3
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <h5 className="font-heading text-xs font-bold text-text-primary truncate group-hover:text-brand transition-colors">
                  {third.title}
                </h5>
                <span className="text-[10px] text-text-muted truncate block">
                  {third.genres?.[0] || 'Rank 3'}
                </span>
              </div>
            </Link>
          )}
        </div>
      )}

      {/* Accordion for #4 through #10 */}
      {remaining.length > 0 && (
        <div className="space-y-2">
          {showRemaining && (
            <div className="space-y-2 pt-1 animate-fadeIn">
              {remaining.map((film, idx) => (
                <Link
                  key={film.id}
                  to={`/films/${film.slug || film.id}`}
                  className="flex items-center gap-3 p-2.5 rounded-xl bg-surface/60 border border-border/40 hover:border-brand/40 transition-all active:scale-[0.99]"
                >
                  <span className="w-5 text-center text-xs font-bold text-text-muted">
                    #{idx + 4}
                  </span>
                  <div className="w-9 h-12 rounded-md overflow-hidden shrink-0 bg-surface-2">
                    <ImageWithFallback
                      src={film.poster_url || film.backdrop_url}
                      alt={film.title}
                      fallbackType="film"
                      name={film.title}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h6 className="font-heading text-xs font-bold text-text-primary truncate">
                      {film.title}
                    </h6>
                    <span className="text-[10px] text-text-muted">
                      {film.genres?.[0] || 'Nollywood'} {film.year ? `· ${film.year}` : ''}
                    </span>
                  </div>
                  <Icon icon="solar:arrow-right-linear" className="text-sm text-text-muted shrink-0" />
                </Link>
              ))}
            </div>
          )}

          <button
            onClick={() => setShowRemaining(!showRemaining)}
            className="w-full py-2.5 rounded-xl bg-surface border border-border/60 text-xs font-bold text-text-secondary hover:text-text-primary flex items-center justify-center gap-1.5 transition-all active:scale-[0.98] min-h-[42px]"
          >
            <span>{showRemaining ? 'Hide Charts' : `View #4 through #10 (${remaining.length} titles)`}</span>
            <Icon icon={showRemaining ? 'solar:alt-arrow-up-linear' : 'solar:alt-arrow-down-linear'} />
          </button>
        </div>
      )}
    </section>
  );
}
