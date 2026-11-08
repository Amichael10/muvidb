import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Icon } from '@iconify/react';

export default function PlayPhotoLightboxModal({
  images = [],
  initialIndex = 0,
  onClose,
  playTitle = 'Stage Production'
}) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [isLoaded, setIsLoaded] = useState(false);
  const touchStartX = useRef(null);

  const currentImage = images[currentIndex];

  useEffect(() => {
    setIsLoaded(false);
  }, [currentIndex]);

  // Preload adjacent images
  useEffect(() => {
    if (!images || images.length <= 1) return;
    const nextIdx = (currentIndex + 1) % images.length;
    const prevIdx = (currentIndex - 1 + images.length) % images.length;
    const preload = (url) => {
      if (!url) return;
      const img = new Image();
      img.src = url;
    };
    preload(images[nextIdx]?.url);
    preload(images[prevIdx]?.url);
  }, [currentIndex, images]);

  const handleNext = useCallback(() => {
    if (images.length <= 1) return;
    setCurrentIndex((prev) => (prev + 1) % images.length);
  }, [images.length]);

  const handlePrev = useCallback(() => {
    if (images.length <= 1) return;
    setCurrentIndex((prev) => (prev - 1 + images.length) % images.length);
  }, [images.length]);

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

  const handleTouchStart = (e) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e) => {
    if (touchStartX.current === null) return;
    const touchEndX = e.changedTouches[0].clientX;
    const diff = touchStartX.current - touchEndX;
    if (Math.abs(diff) > 50) {
      if (diff > 0) handleNext();
      else handlePrev();
    }
    touchStartX.current = null;
  };

  if (!currentImage) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/95 backdrop-blur-md flex flex-col justify-between select-none animate-fade-in"
      onClick={onClose}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Top Bar */}
      <div
        className="w-full flex items-center justify-between px-4 sm:px-8 py-4 bg-gradient-to-b from-black/80 to-transparent z-10"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-2.5 h-2.5 rounded-full bg-brand" />
          <div className="min-w-0">
            <h3 className="text-sm sm:text-base font-black text-white font-heading truncate">
              {playTitle}
            </h3>
            <span className="text-[11px] text-text-muted">
              Production Gallery · Image {currentIndex + 1} of {images.length}
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white/80 hover:text-white transition-colors cursor-pointer"
          aria-label="Close photo preview"
        >
          <Icon icon="solar:close-circle-bold" className="text-2xl" />
        </button>
      </div>

      {/* Main Image View */}
      <div
        className="relative flex-1 flex items-center justify-center p-2 sm:p-6 min-h-0"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Prev Arrow */}
        {images.length > 1 && (
          <button
            type="button"
            onClick={handlePrev}
            className="absolute left-2 sm:left-6 z-20 p-2.5 sm:p-3 rounded-full bg-black/60 hover:bg-black/90 border border-white/10 text-white hover:text-brand transition-all cursor-pointer backdrop-blur-xs shadow-lg"
            aria-label="Previous image"
          >
            <Icon icon="solar:alt-arrow-left-bold" className="text-xl sm:text-2xl" />
          </button>
        )}

        {/* Center Image Container */}
        <div className="relative max-w-full max-h-full flex items-center justify-center">
          {!isLoaded && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-8 h-8 rounded-full border-2 border-brand border-t-transparent animate-spin" />
            </div>
          )}
          <img
            src={currentImage.url}
            alt={currentImage.caption || `${playTitle} production photo`}
            className={`max-w-full max-h-[75vh] object-contain rounded-xl shadow-2xl transition-opacity duration-300 ${
              isLoaded ? 'opacity-100' : 'opacity-0'
            }`}
            onLoad={() => setIsLoaded(true)}
          />
        </div>

        {/* Next Arrow */}
        {images.length > 1 && (
          <button
            type="button"
            onClick={handleNext}
            className="absolute right-2 sm:right-6 z-20 p-2.5 sm:p-3 rounded-full bg-black/60 hover:bg-black/90 border border-white/10 text-white hover:text-brand transition-all cursor-pointer backdrop-blur-xs shadow-lg"
            aria-label="Next image"
          >
            <Icon icon="solar:alt-arrow-right-bold" className="text-xl sm:text-2xl" />
          </button>
        )}
      </div>

      {/* Bottom Caption & Thumbnails Bar */}
      <div
        className="w-full bg-gradient-to-t from-black/90 via-black/70 to-transparent px-4 sm:px-8 py-4 space-y-3 z-10"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 max-w-5xl mx-auto">
          <div className="space-y-1 min-w-0">
            {currentImage.caption && (
              <p className="text-xs sm:text-sm font-semibold text-white truncate">
                {currentImage.caption}
              </p>
            )}
            <div className="flex items-center gap-2 text-[10px] uppercase font-bold tracking-widest text-text-muted">
              <span className="px-2 py-0.5 rounded bg-white/10 text-amber-300">
                {currentImage.image_type?.replace(/_/g, ' ') || 'Production Still'}
              </span>
              {currentImage.is_primary && (
                <span className="px-2 py-0.5 rounded bg-brand text-white">
                  Official Key Art
                </span>
              )}
            </div>
          </div>

          <div className="text-right text-xs text-text-muted font-mono shrink-0">
            {currentIndex + 1} / {images.length}
          </div>
        </div>

        {/* Thumbnail Filmstrip */}
        {images.length > 1 && (
          <div className="flex items-center justify-center gap-2 overflow-x-auto py-1 max-w-3xl mx-auto scrollbar-none">
            {images.map((img, idx) => (
              <button
                key={img.id || idx}
                type="button"
                onClick={() => setCurrentIndex(idx)}
                className={`relative w-14 h-10 sm:w-16 sm:h-12 rounded-lg overflow-hidden shrink-0 border-2 transition-all cursor-pointer ${
                  currentIndex === idx
                    ? 'border-brand scale-105 shadow-md shadow-brand/20'
                    : 'border-white/20 opacity-50 hover:opacity-100 hover:border-white/50'
                }`}
              >
                <img
                  src={img.url}
                  alt={img.caption || `Thumbnail ${idx + 1}`}
                  className="w-full h-full object-cover"
                />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
