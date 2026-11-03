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

export default function MobilePosterGrid({
  title = 'Trending Nollywood',
  subtitle = 'Popular releases this week',
  films = [],
  isLoading = false,
  linkTo = '/browse',
  initialCount = 6,
}) {
  const [displayCount, setDisplayCount] = useState(initialCount);

  if (isLoading && (!films || films.length === 0)) {
    return (
      <section className="w-full py-6 px-4">
        <div className="h-5 w-40 bg-surface rounded mb-4 animate-pulse" />
        <div className="grid grid-cols-2 gap-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="aspect-[2/3] bg-surface rounded-2xl animate-pulse" />
          ))}
        </div>
      </section>
    );
  }

  if (!films || films.length === 0) return null;

  const visibleFilms = films.slice(0, displayCount);
  const canShowMore = displayCount < films.length;

  return (
    <section className="w-full py-6 px-4">
      {/* Section Header */}
      <div className="flex items-end justify-between gap-3 mb-4">
        <div className="space-y-0.5">
          <h3 className="font-heading text-lg font-bold text-text-primary tracking-tight">
            {title}
          </h3>
          {subtitle && <p className="text-xs text-text-muted">{subtitle}</p>}
        </div>
        {linkTo && (
          <Link
            to={linkTo}
            className="text-xs font-bold text-brand hover:underline flex items-center gap-1 shrink-0 pb-0.5"
          >
            <span>See all</span>
            <Icon icon="solar:arrow-right-linear" className="text-sm" />
          </Link>
        )}
      </div>

      {/* 2-Column Vertical Discovery Grid */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4">
        {visibleFilms.map((film) => {
          const rating = getRating(film);
          const genre = film.genres?.[0] || 'Nollywood';
          const poster = film.poster_url || film.backdrop_url;

          return (
            <Link
              key={film.id}
              to={`/films/${film.slug || film.id}`}
              className="group flex flex-col rounded-2xl overflow-hidden bg-surface border border-border/50 hover:border-brand/50 transition-all duration-300 shadow-sm active:scale-[0.98]"
            >
              {/* Poster (Strict 2:3 vertical ratio) */}
              <div className="relative aspect-[2/3] w-full overflow-hidden bg-surface-2">
                <ImageWithFallback
                  src={poster}
                  alt={film.title}
                  fallbackType="film"
                  name={film.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  loading="lazy"
                />

                {/* Top Corner Rating Badge */}
                {rating && (
                  <div className="absolute top-2 left-2 flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-black/70 backdrop-blur-md border border-white/10 text-[10px] font-bold text-amber-300 shadow-md">
                    <Icon icon="solar:star-bold" className="text-[10px]" />
                    <span>{rating}</span>
                  </div>
                )}

                {/* Cinema or Stream Badge */}
                {film.is_in_cinemas && (
                  <div className="absolute bottom-2 right-2 px-1.5 py-0.5 rounded-md bg-brand text-[9px] font-black uppercase text-white shadow-md">
                    Cinema
                  </div>
                )}
              </div>

              {/* Title & Metadata Strip */}
              <div className="p-2.5 space-y-1">
                <h4 className="font-heading text-xs font-bold text-text-primary line-clamp-1 leading-snug group-hover:text-brand transition-colors">
                  {film.title}
                </h4>
                <div className="flex items-center justify-between text-[10px] text-text-muted">
                  <span className="truncate">{genre}</span>
                  {film.year && <span>{film.year}</span>}
                </div>
              </div>
            </Link>
          );
        })}
      </div>

      {/* Progressive Disclosure Button */}
      {canShowMore ? (
        <button
          onClick={() => setDisplayCount((prev) => Math.min(prev + 6, films.length))}
          className="mt-4 w-full py-3 rounded-xl bg-surface-2 hover:bg-surface border border-border/60 text-xs font-bold text-text-secondary hover:text-text-primary flex items-center justify-center gap-2 transition-all active:scale-[0.98] min-h-[44px]"
        >
          <span>Show More Releases ({films.length - displayCount} left)</span>
          <Icon icon="solar:alt-arrow-down-linear" className="text-sm" />
        </button>
      ) : linkTo ? (
        <Link
          to={linkTo}
          className="mt-4 w-full py-3 rounded-xl bg-surface-2 hover:bg-surface border border-border/60 text-xs font-bold text-brand flex items-center justify-center gap-2 transition-all active:scale-[0.98] min-h-[44px]"
        >
          <span>Browse Complete Directory</span>
          <Icon icon="solar:arrow-right-linear" className="text-sm" />
        </Link>
      ) : null}
    </section>
  );
}
