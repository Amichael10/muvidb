import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from '@iconify/react';
import ImageWithFallback from '../../ui/ImageWithFallback';

function formatRuntime(minutes) {
  if (!minutes) return null;
  const mins = Number(minutes);
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function getRating(film) {
  if (film?.imdb_rating && film.imdb_rating > 0) return Number(film.imdb_rating).toFixed(1);
  if (film?.tmdb_rating && film.tmdb_rating > 0) return Number(film.tmdb_rating).toFixed(1);
  if (film?.average_rating && film.average_rating > 0) return Number(film.average_rating).toFixed(1);
  return null;
}

export default function MobileHero({ featuredFilms = [], isLoading = false }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const navigate = useNavigate();
  const { user } = useAuth();

  const films = (featuredFilms || []).filter(Boolean);
  const currentFilm = films[currentIndex] || films[0];

  // Auto-slide every 6 seconds if not touched
  useEffect(() => {
    if (films.length <= 1) return;
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % films.length);
    }, 6000);
    return () => clearInterval(interval);
  }, [films.length]);

  if (isLoading || !currentFilm) {
    return (
      <div id="mobile-section-hero" className="w-full aspect-[4/5] max-h-[500px] bg-surface-2 animate-pulse relative rounded-b-3xl overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-t from-[#0B0D10] via-black/40 to-transparent" />
        <div className="absolute bottom-6 left-4 right-4 space-y-3">
          <div className="h-4 w-28 bg-surface rounded" />
          <div className="h-8 w-3/4 bg-surface rounded" />
          <div className="h-3 w-1/2 bg-surface rounded" />
          <div className="flex gap-2 pt-2">
            <div className="h-11 flex-1 bg-surface rounded-xl" />
            <div className="h-11 flex-1 bg-surface rounded-xl" />
          </div>
        </div>
      </div>
    );
  }

  const rating = getRating(currentFilm);
  const runtime = formatRuntime(currentFilm.runtime_minutes || currentFilm.duration);
  const genre = currentFilm.genres?.[0] || 'Nollywood';
  const poster = currentFilm.poster_url || currentFilm.backdrop_url;
  const isCinema = currentFilm.is_in_cinemas || currentFilm.status === 'in_cinemas';
  const trailerId = currentFilm.trailer_youtube_id;

  return (
    <section id="mobile-section-hero" className="relative w-full overflow-hidden bg-black select-none">
      {/* Visual Canvas: 4:5 mobile poster stage with cinema ambient glow */}
      <div className="relative w-full aspect-[4/5] max-h-[540px] overflow-hidden">
        <ImageWithFallback
          src={poster}
          alt={currentFilm.title}
          fallbackType="film"
          name={currentFilm.title}
          className="w-full h-full object-cover object-center transform scale-105"
          priority
        />

        {/* Ambient Cinema Lighting & Gradient Scrims */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#0B0D10] via-[#0B0D10]/50 to-black/30 pointer-events-none" />
        <div className="absolute inset-0 bg-radial-gradient from-transparent via-transparent to-black/60 pointer-events-none" />

        {/* Top Badges: Spotlight / Cinema status */}
        <div className="absolute top-3 left-4 right-4 flex items-center justify-between pointer-events-none">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/60 backdrop-blur-md border border-white/10 text-[10px] font-bold text-amber-300">
            <Icon icon="solar:flame-bold" className="text-xs" />
            <span>FEATURED SPOTLIGHT</span>
          </div>
          {isCinema && (
            <span className="px-2.5 py-1 rounded-full bg-brand/90 backdrop-blur-md text-[10px] font-black text-white uppercase tracking-wider shadow-lg shadow-brand/30">
              NOW IN CINEMAS
            </span>
          )}
        </div>

        {/* Bottom Content Cluster */}
        <div className="absolute bottom-4 left-4 right-4 space-y-3 z-10">
          {/* Metadata Chips */}
          <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold text-text-secondary">
            {rating && (
              <span className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 border border-amber-500/30 font-bold">
                <Icon icon="solar:star-bold" className="text-xs" />
                {rating}
              </span>
            )}
            <span className="px-2 py-0.5 rounded-md bg-white/10 backdrop-blur-sm text-text-primary">
              {genre}
            </span>
            {currentFilm.year && <span>{currentFilm.year}</span>}
            {runtime && <span>· {runtime}</span>}
          </div>

          {/* Film Title */}
          <Link to={`/films/${currentFilm.slug || currentFilm.id}`}>
            <h2 className="font-heading text-2xl sm:text-3xl font-black text-white tracking-tight line-clamp-2 leading-tight hover:text-brand transition-colors drop-shadow-md">
              {currentFilm.title}
            </h2>
          </Link>

          {/* Tagline / Synopsis preview */}
          {currentFilm.tagline || currentFilm.synopsis ? (
            <p className="text-xs text-white/80 line-clamp-2 leading-relaxed drop-shadow-xs">
              {currentFilm.tagline || currentFilm.synopsis}
            </p>
          ) : null}

          {/* 3-Button Action Cluster */}
          <div className="grid grid-cols-2 gap-2 pt-1">
            <Link
              to={isCinema ? `/showtimes` : `/films/${currentFilm.slug || currentFilm.id}`}
              className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-brand hover:bg-brand-hover text-white text-xs font-black uppercase tracking-wider shadow-lg shadow-brand/30 active:scale-95 transition-all min-h-[46px]"
            >
              <Icon icon={isCinema ? 'solar:ticket-bold' : 'solar:play-circle-bold'} className="text-base" />
              <span>{isCinema ? 'Get Tickets' : 'Watch Now'}</span>
            </Link>

            {trailerId ? (
              <a
                href={`https://www.youtube.com/watch?v=${trailerId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-white text-xs font-bold uppercase tracking-wider backdrop-blur-md active:scale-95 transition-all min-h-[46px]"
              >
                <Icon icon="solar:videocamera-record-bold" className="text-base text-red-400" />
                <span>Trailer</span>
              </a>
            ) : (
              <Link
                to={`/films/${currentFilm.slug || currentFilm.id}`}
                className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-white text-xs font-bold uppercase tracking-wider backdrop-blur-md active:scale-95 transition-all min-h-[46px]"
              >
                <Icon icon="solar:info-circle-linear" className="text-base" />
                <span>Details</span>
              </Link>
            )}
          </div>

          {/* Carousel Slide Indicators */}
          {films.length > 1 && (
            <div className="flex items-center justify-center gap-1.5 pt-2">
              {films.map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => setCurrentIndex(idx)}
                  className={`h-1.5 rounded-full transition-all duration-300 ${
                    idx === currentIndex ? 'w-6 bg-brand' : 'w-1.5 bg-white/30'
                  }`}
                  aria-label={`Go to slide ${idx + 1}`}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
