import { useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from '@iconify/react';
import { formatFilmTitle, toTitleCase } from '../../utils/format';

const CATEGORY_LABELS = {
  headshot: 'Headshot',
  production_still: 'Production Still',
  red_carpet: 'Red Carpet',
  behind_the_scenes: 'Behind the Scenes',
};

export default function PersonPhotoLightboxModal({
  photo,
  photos = [],
  onClose,
  onSelectPhoto,
}) {
  const currentIndex = photos.findIndex((p) => p.id === photo?.id);
  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex >= 0 && currentIndex < photos.length - 1;

  const handlePrev = useCallback(() => {
    if (hasPrev && onSelectPhoto) {
      onSelectPhoto(photos[currentIndex - 1]);
    }
  }, [hasPrev, currentIndex, photos, onSelectPhoto]);

  const handleNext = useCallback(() => {
    if (hasNext && onSelectPhoto) {
      onSelectPhoto(photos[currentIndex + 1]);
    }
  }, [hasNext, currentIndex, photos, onSelectPhoto]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') handlePrev();
      if (e.key === 'ArrowRight') handleNext();
    };
    window.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'unset';
    };
  }, [onClose, handlePrev, handleNext]);

  if (!photo) return null;

  const linkedFilm = photo.films;
  const categoryLabel = CATEGORY_LABELS[photo.category] || toTitleCase(photo.category || 'Photo');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 backdrop-blur-lg animate-fade-in select-none">
      {/* Background Overlay */}
      <div className="absolute inset-0" onClick={onClose} />

      {/* Top Floating Controls */}
      <div className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between p-4 sm:p-6 bg-gradient-to-b from-black/80 to-transparent">
        <div className="flex items-center gap-3">
          <span className="bg-brand/20 text-brand border border-brand/30 text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-md">
            {categoryLabel}
          </span>
          {photos.length > 1 && (
            <span className="text-xs font-bold text-white/70">
              {currentIndex + 1} of {photos.length}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {photo.url && (
            <a
              href={photo.url}
              target="_blank"
              rel="noopener noreferrer"
              className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 border border-white/10 flex items-center justify-center text-white transition-colors"
              title="Open full size image"
            >
              <Icon icon="solar:maximize-square-linear" width="20" />
            </a>
          )}
          <button
            onClick={onClose}
            className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 border border-white/10 flex items-center justify-center text-white transition-colors"
            aria-label="Close photo lightbox"
          >
            <Icon icon="solar:close-circle-linear" width="22" />
          </button>
        </div>
      </div>

      {/* Prev / Next Nav Buttons */}
      {hasPrev && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            handlePrev();
          }}
          className="absolute left-4 top-1/2 -translate-y-1/2 z-20 w-12 h-12 rounded-full bg-black/60 hover:bg-brand border border-white/20 hover:border-brand flex items-center justify-center text-white shadow-2xl transition-all"
          title="Previous Photo (←)"
        >
          <Icon icon="solar:alt-arrow-left-linear" width="24" />
        </button>
      )}

      {hasNext && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleNext();
          }}
          className="absolute right-4 top-1/2 -translate-y-1/2 z-20 w-12 h-12 rounded-full bg-black/60 hover:bg-brand border border-white/20 hover:border-brand flex items-center justify-center text-white shadow-2xl transition-all"
          title="Next Photo (→)"
        >
          <Icon icon="solar:alt-arrow-right-linear" width="24" />
        </button>
      )}

      {/* Main Photo Display Area */}
      <div className="relative z-10 flex flex-col items-center justify-center max-w-6xl max-h-[80vh] px-4">
        <img
          src={photo.url}
          alt={photo.title || 'Actor photo'}
          className="max-h-[72vh] max-w-full object-contain rounded-lg shadow-2xl transition-all duration-300 pointer-events-auto"
          loading="eager"
        />
      </div>

      {/* Bottom Floating Info Bar */}
      <div className="absolute bottom-0 left-0 right-0 z-20 p-4 sm:p-6 bg-gradient-to-t from-black/90 via-black/60 to-transparent flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="text-center sm:text-left space-y-1 max-w-2xl">
          {photo.title && (
            <h4 className="text-white font-bold text-sm sm:text-base font-heading tracking-wide">
              {photo.title}
            </h4>
          )}
          {photo.description && (
            <p className="text-white/70 text-xs line-clamp-2 leading-relaxed">
              {photo.description}
            </p>
          )}
          <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3 text-[11px] text-white/60 font-semibold pt-0.5">
            {photo.photographer_credit && (
              <span>📸 Photo: {photo.photographer_credit}</span>
            )}
            {photo.year && (
              <span>• {photo.year}</span>
            )}
          </div>
        </div>

        {/* Linked Film Pill */}
        {linkedFilm && (
          <Link
            to={`/films/${linkedFilm.slug || linkedFilm.id}`}
            onClick={onClose}
            className="group flex items-center gap-2.5 px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 border border-white/15 transition-all text-left shrink-0"
          >
            {linkedFilm.poster_url && (
              <img
                src={linkedFilm.poster_url}
                alt={linkedFilm.title}
                className="w-7 h-10 object-cover rounded border border-white/20"
              />
            )}
            <div className="text-xs">
              <span className="text-[9px] font-bold text-brand uppercase tracking-wider block">
                Tagged In Film
              </span>
              <span className="text-white font-bold group-hover:text-brand transition-colors">
                {formatFilmTitle(linkedFilm.title)} {linkedFilm.year ? `(${linkedFilm.year})` : ''}
              </span>
            </div>
            <Icon icon="solar:alt-arrow-right-linear" className="text-white/60 group-hover:text-brand text-xs ml-1" />
          </Link>
        )}
      </div>
    </div>
  );
}
