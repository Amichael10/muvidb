import { useState, useEffect, useCallback, useRef } from 'react';
import { Icon } from '@iconify/react';

export default function PersonPhotoLightboxModal({
  photos = [],
  initialIndex = 0,
  onClose,
  personName = ''
}) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [isLoaded, setIsLoaded] = useState(false);
  const touchStartX = useRef(null);

  const currentPhoto = photos[currentIndex];

  // Reset loaded state when slide changes
  useEffect(() => {
    setIsLoaded(false);
  }, [currentIndex]);

  // Preload adjacent images for instantaneous navigation
  useEffect(() => {
    if (!photos || photos.length <= 1) return;

    const nextIdx = (currentIndex + 1) % photos.length;
    const prevIdx = (currentIndex - 1 + photos.length) % photos.length;

    const preload = (url) => {
      if (!url) return;
      const img = new Image();
      img.src = url;
    };

    preload(photos[nextIdx]?.url);
    preload(photos[prevIdx]?.url);
  }, [currentIndex, photos]);

  const handleNext = useCallback(() => {
    if (photos.length <= 1) return;
    setCurrentIndex((prev) => (prev + 1) % photos.length);
  }, [photos.length]);

  const handlePrev = useCallback(() => {
    if (photos.length <= 1) return;
    setCurrentIndex((prev) => (prev - 1 + photos.length) % photos.length);
  }, [photos.length]);

  // Keyboard navigation & Esc listener
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose?.();
      } else if (e.key === 'ArrowRight') {
        handleNext();
      } else if (e.key === 'ArrowLeft') {
        handlePrev();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, handleNext, handlePrev]);

  // Mobile swipe gestures
  const handleTouchStart = (e) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e) => {
    if (touchStartX.current === null) return;
    const touchEndX = e.changedTouches[0].clientX;
    const diff = touchStartX.current - touchEndX;

    if (Math.abs(diff) > 50) {
      if (diff > 0) {
        handleNext();
      } else {
        handlePrev();
      }
    }
    touchStartX.current = null;
  };

  if (!currentPhoto) return null;

  const thumbnailUrl = currentPhoto.thumbnail || currentPhoto.url;
  const fullUrl = currentPhoto.url;

  return (
    <div
      className="fixed inset-0 z-[250] flex flex-col justify-between bg-black/95 backdrop-blur-xl select-none overscroll-contain"
      onMouseDown={(e) => {
        // Close if clicked on the backdrop directly
        if (e.target === e.currentTarget) {
          onClose?.();
        }
      }}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* ─── TOP BAR (IMDb-Style Header) ─── */}
      <header className="relative z-30 flex h-14 sm:h-16 shrink-0 items-center justify-between border-b border-white/10 bg-black/60 px-4 sm:px-6 backdrop-blur-md">
        <div className="flex items-center gap-3 min-w-0">
          <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-brand/10 text-brand">
            <Icon icon="solar:gallery-wide-bold" width="18" />
          </div>
          <div className="min-w-0 truncate">
            <p className="truncate text-xs sm:text-sm font-black text-white">
              {currentPhoto.title || (personName ? `${personName} Photo` : 'Photo Gallery')}
            </p>
            <p className="text-[10px] sm:text-xs text-text-muted capitalize">
              {currentPhoto.category?.replaceAll('_', ' ') || 'Production Media'}
              {currentPhoto.year ? ` · ${currentPhoto.year}` : ''}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {photos.length > 1 && (
            <span className="rounded-full bg-white/10 px-2.5 py-1 text-[11px] sm:text-xs font-bold text-white/80">
              {currentIndex + 1} / {photos.length}
            </span>
          )}

          {/* Explicit IMDb-Style Close Button */}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="group flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-black text-white shadow-lg transition hover:border-white/40 hover:bg-white/20 hover:text-brand focus:outline-none focus:ring-2 focus:ring-brand"
          >
            <Icon icon="solar:close-circle-bold" width="16" className="text-white/80 group-hover:text-brand" />
            <span className="hidden xs:inline">Close</span>
          </button>
        </div>
      </header>

      {/* ─── MAIN VIEWPORT (Flexible Responsive Media Container) ─── */}
      <main
        className="relative flex flex-1 min-h-0 items-center justify-center p-2 sm:p-4 md:p-6"
        onMouseDown={(e) => {
          if (e.target === e.currentTarget) {
            onClose?.();
          }
        }}
      >
        {/* Navigation Arrows */}
        {photos.length > 1 && (
          <>
            <button
              type="button"
              onClick={handlePrev}
              aria-label="Previous photo"
              className="absolute left-2 sm:left-4 z-20 grid h-10 w-10 sm:h-12 sm:w-12 place-items-center rounded-full border border-white/10 bg-black/60 text-white backdrop-blur-md transition hover:bg-brand hover:border-brand hover:text-black focus:outline-none active:scale-95"
            >
              <Icon icon="solar:alt-arrow-left-linear" width="24" />
            </button>

            <button
              type="button"
              onClick={handleNext}
              aria-label="Next photo"
              className="absolute right-2 sm:right-4 z-20 grid h-10 w-10 sm:h-12 sm:w-12 place-items-center rounded-full border border-white/10 bg-black/60 text-white backdrop-blur-md transition hover:bg-brand hover:border-brand hover:text-black focus:outline-none active:scale-95"
            >
              <Icon icon="solar:alt-arrow-right-linear" width="24" />
            </button>
          </>
        )}

        {/* Media Frame */}
        <div className="relative flex h-full w-full max-w-5xl items-center justify-center">
          {/* Fast Low-Res / Thumbnail Placeholder (shows instantly) */}
          {!isLoaded && thumbnailUrl && (
            <img
              src={thumbnailUrl}
              alt=""
              aria-hidden="true"
              className="max-h-full max-w-full object-contain filter blur-sm scale-95 opacity-60 transition duration-300 pointer-events-none"
            />
          )}

          {/* Loading Spinner Indicator */}
          {!isLoaded && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="flex items-center gap-2 rounded-full border border-white/15 bg-black/70 px-4 py-2 text-xs font-bold text-white shadow-xl backdrop-blur-md">
                <Icon icon="solar:spinner-linear" className="animate-spin text-brand" width="18" />
                <span>Loading HD Photo...</span>
              </div>
            </div>
          )}

          {/* High-Resolution Master Image */}
          <img
            src={fullUrl}
            alt={currentPhoto.title || personName || 'Photo'}
            onLoad={() => setIsLoaded(true)}
            loading="eager"
            decoding="async"
            className={`max-h-full max-w-full object-contain rounded-xl shadow-2xl transition-opacity duration-300 ${
              isLoaded ? 'opacity-100' : 'opacity-0 absolute'
            }`}
          />
        </div>
      </main>

      {/* ─── FOOTER (Metadata & Quick Strip) ─── */}
      <footer className="relative z-30 flex min-h-[48px] shrink-0 items-center justify-between border-t border-white/10 bg-black/60 px-4 sm:px-6 py-2 backdrop-blur-md text-xs text-white/80">
        <div className="min-w-0 truncate">
          {currentPhoto.description && (
            <p className="truncate text-xs text-text-muted">{currentPhoto.description}</p>
          )}
          {currentPhoto.photographer && (
            <p className="text-[11px] text-text-muted">📷 Photo credit: {currentPhoto.photographer}</p>
          )}
        </div>

        <div className="hidden sm:flex items-center gap-2 shrink-0 text-[11px] text-white/40">
          <span>Use <kbd className="rounded bg-white/10 px-1 py-0.5 text-white/70">←</kbd> <kbd className="rounded bg-white/10 px-1 py-0.5 text-white/70">→</kbd> to navigate</span>
          <span>·</span>
          <span><kbd className="rounded bg-white/10 px-1 py-0.5 text-white/70">ESC</kbd> to close</span>
        </div>
      </footer>
    </div>
  );
}
