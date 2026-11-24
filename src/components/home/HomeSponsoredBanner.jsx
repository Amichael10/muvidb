import React, { useState, useEffect, useRef } from 'react';
import { Icon } from '@iconify/react';
import { getCampaigns } from '../../lib/adSettings';

/**
 * Editorial Multi-Ad Slider & Native Campaign Billboard
 * Supports:
 * - Dynamic Carousel Rotation (pauses on hover)
 * - Preview squares for direct multi-campaign navigation (no simple ellipsis)
 * - Multi-ratio layouts: Panorama, Rectangle (Bento), and Square Spotlight
 * - Zero gradients: Clean, solid, high-contrast matte editorial styling
 */
export default function HomeSponsoredBanner({ variant = null, format = null }) {
  const [campaigns, setCampaigns] = useState(getCampaigns);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  const timerRef = useRef(null);

  useEffect(() => {
    const handleUpdate = () => {
      setCampaigns(getCampaigns());
    };
    window.addEventListener('muvidb_ad_settings_change', handleUpdate);
    window.addEventListener('storage', handleUpdate);
    return () => {
      window.removeEventListener('muvidb_ad_settings_change', handleUpdate);
      window.removeEventListener('storage', handleUpdate);
    };
  }, []);

  // Filter active campaigns; if variant is specified, lock to it; otherwise rotate all active campaigns matching format
  const activeCampaigns = campaigns.filter((c) => {
    if (!c.isActive) return false;
    if (variant) {
      return c.id === variant || c.id.includes(variant);
    }
    if (format) {
      const campFormat = c.format || 'rectangle';
      if (format === 'rectangle') return campFormat === 'rectangle' || campFormat === 'square';
      return campFormat === format;
    }
    return true;
  });

  // Auto-rotation timer
  useEffect(() => {
    if (activeCampaigns.length <= 1 || isHovered) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }

    timerRef.current = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % activeCampaigns.length);
    }, 7500);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [activeCampaigns.length, isHovered]);

  if (activeCampaigns.length === 0) {
    return null;
  }

  // Ensure current index is within bounds
  const safeIndex = currentIndex % activeCampaigns.length;
  const current = activeCampaigns[safeIndex];
  const activeFormat = format || current.format || 'rectangle';

  const goToNext = () => {
    setCurrentIndex((prev) => (prev + 1) % activeCampaigns.length);
  };

  const goToPrev = () => {
    setCurrentIndex((prev) => (prev - 1 + activeCampaigns.length) % activeCampaigns.length);
  };

  return (
    <div
      className="py-6 border-b border-hairline bg-surface/10"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-3">

        {/* ─── 1. SQUARE SPOTLIGHT FORMAT ─── */}
        {activeFormat === 'square' && (
          <div className="max-w-md mx-auto relative rounded-2xl overflow-hidden border border-border bg-surface p-6 shadow-xl flex flex-col justify-between aspect-square group">
            <div className="space-y-3">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest bg-brand/15 text-brand border border-brand/30">
                <Icon icon="solar:diploma-verified-bold" className="text-xs" />
                <span>{current.eyebrow}</span>
              </span>
              <h3 className="font-heading font-black text-2xl text-text-primary tracking-tight leading-snug">
                {current.title}
              </h3>
              {current.badge && (
                <p className="text-xs text-amber-400 font-bold">
                  {current.badge} • {current.location}
                </p>
              )}
              <p className="text-xs text-text-secondary leading-relaxed">
                {current.description}
              </p>
            </div>

            <div className="pt-4 border-t border-border flex flex-col gap-2.5">
              <a
                href={current.ctaUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full py-3 rounded-xl bg-brand hover:bg-brand-hover text-black font-black text-xs uppercase tracking-wider inline-flex items-center justify-center gap-2 transition-all shadow-md active:scale-95 cursor-pointer"
              >
                <span>{current.ctaText}</span>
                <Icon icon="solar:arrow-right-up-linear" className="text-sm" />
              </a>
              <span className="text-[10px] text-text-muted text-center font-bold">
                {current.location}
              </span>
            </div>
          </div>
        )}

        {/* ─── 2. PANORAMA SLIM RIBBON FORMAT ─── */}
        {activeFormat === 'panorama' && (
          <div className="relative rounded-2xl overflow-hidden border border-border bg-surface px-6 py-5 sm:px-8 sm:py-6 shadow-xl group flex flex-col md:flex-row md:items-center justify-between gap-5">
            <div className="relative z-10 space-y-2 max-w-3xl">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[9.5px] font-black uppercase tracking-widest bg-brand/15 text-brand border border-brand/30 shadow-sm">
                  <Icon icon="solar:star-bold" className="text-xs" />
                  <span>{current.eyebrow}</span>
                </span>
                {current.badge && (
                  <span className="text-xs font-bold text-amber-400">
                    {current.badge} • {current.location}
                  </span>
                )}
              </div>

              <h3 className="font-heading font-black text-xl sm:text-2xl lg:text-3xl text-text-primary tracking-tight leading-tight">
                {current.title}
              </h3>

              <p className="text-xs text-text-secondary leading-relaxed max-w-2xl line-clamp-2">
                {current.description}
              </p>

              {current.tags && current.tags.length > 0 && (
                <div className="flex flex-wrap items-center gap-2 pt-0.5 text-[10.5px] font-semibold text-text-muted">
                  {current.tags.map((t, idx) => (
                    <span key={idx} className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-surface-2 border border-border text-text-secondary">
                      <span>{t}</span>
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div className="relative z-10 flex flex-col items-start md:items-end gap-2 shrink-0">
              <a
                href={current.ctaUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full sm:w-auto px-6 py-3 rounded-xl bg-brand hover:bg-brand-hover text-black font-black text-xs uppercase tracking-wider inline-flex items-center justify-center gap-2 transition-all shadow-md active:scale-95 cursor-pointer"
              >
                <span>{current.ctaText}</span>
                <Icon icon="solar:arrow-right-up-linear" className="text-sm" />
              </a>
              <span className="text-[10px] text-text-muted font-bold">
                {current.location}
              </span>
            </div>
          </div>
        )}

        {/* ─── 3. RECTANGLE (BENTO 2-COL) EDITORIAL FORMAT ─── */}
        {activeFormat === 'rectangle' && (
          <div className="relative rounded-2xl overflow-hidden border border-border bg-surface p-6 sm:p-8 shadow-xl group">
            <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
              
              {/* Media Preview Column */}
              <div className="lg:col-span-4 rounded-xl overflow-hidden border border-border bg-black aspect-[16/10] sm:aspect-[16/9] lg:aspect-auto lg:h-[220px] relative group/media shadow-inner">
                {current.mediaType === 'video' ? (
                  <video
                    src={current.mediaUrl}
                    poster={current.posterUrl}
                    autoPlay
                    loop
                    muted
                    playsInline
                    className="w-full h-full object-cover group-hover/media:scale-105 transition-transform duration-700"
                  />
                ) : (
                  <img
                    src={current.mediaUrl || current.posterUrl}
                    alt={current.title}
                    className="w-full h-full object-cover group-hover/media:scale-105 transition-transform duration-700"
                  />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent pointer-events-none" />
                <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between text-white text-[10px] font-bold z-10 pointer-events-none">
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-black/80 backdrop-blur-md border border-white/20">
                    <Icon icon="solar:clapperboard-play-bold" className="text-brand" />
                    <span>Featured Studio Program</span>
                  </span>
                  <span className="text-white/80">{current.location}</span>
                </div>
              </div>

              {/* Editorial Info Column */}
              <div className="lg:col-span-8 flex flex-col justify-between gap-4">
                <div className="space-y-2.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest bg-brand/15 text-brand border border-brand/30 shadow-sm">
                      <Icon icon="solar:diploma-verified-bold" className="text-xs" />
                      <span>{current.eyebrow}</span>
                    </span>
                    {current.badge && (
                      <span className="text-xs font-bold text-amber-400">
                        {current.badge}
                      </span>
                    )}
                  </div>

                  <h3 className="font-heading font-black text-2xl sm:text-3xl text-text-primary tracking-tight leading-tight">
                    {current.title}
                  </h3>

                  <p className="text-xs sm:text-sm text-text-secondary leading-relaxed max-w-2xl">
                    {current.description}
                  </p>

                  {/* Tag Chips */}
                  {current.tags && current.tags.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5 pt-1 text-[10.5px] font-bold">
                      {current.tags.map((tag, idx) => (
                        <span key={idx} className="px-2.5 py-1 rounded-lg bg-surface-2 border border-border text-text-secondary">
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Bottom Actions */}
                <div className="pt-2 border-t border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-xs text-text-muted">
                    <Icon icon="solar:map-point-bold" className="text-brand text-sm" />
                    <span>{current.location}</span>
                  </div>

                  <a
                    href={current.ctaUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-6 py-3 rounded-xl bg-brand hover:bg-brand-hover text-black font-black text-xs uppercase tracking-wider inline-flex items-center justify-center gap-2 transition-all shadow-md active:scale-95 cursor-pointer shrink-0"
                  >
                    <span>{current.ctaText}</span>
                    <Icon icon="solar:arrow-right-up-linear" className="text-sm" />
                  </a>
                </div>
              </div>

            </div>
          </div>
        )}

        {/* ─── 4. CAROUSEL SQUARE PREVIEWS & CONTROLS (NO ELLIPSIS — VISUAL SQUARE THUMBNAILS) ─── */}
        {activeCampaigns.length > 1 && (
          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            {/* Square Thumbnails Preview Row */}
            <div className="flex items-center gap-2 overflow-x-auto py-1">
              {activeCampaigns.map((camp, idx) => {
                const isActive = idx === safeIndex;
                return (
                  <button
                    key={camp.id}
                    type="button"
                    onClick={() => setCurrentIndex(idx)}
                    className={`flex items-center gap-2 p-1.5 rounded-xl border text-left transition-all cursor-pointer ${
                      isActive
                        ? 'border-brand bg-surface shadow-sm ring-1 ring-brand/40'
                        : 'border-border bg-surface-2/60 hover:bg-surface-2 hover:border-border/80 opacity-70 hover:opacity-100'
                    }`}
                  >
                    <div className="w-8 h-8 rounded-lg overflow-hidden bg-black shrink-0 relative">
                      <img
                        src={camp.posterUrl || camp.mediaUrl || '/images/academy-placeholder.svg'}
                        alt={camp.title}
                        className="w-full h-full object-cover"
                      />
                      {isActive && (
                        <div className="absolute inset-0 bg-brand/20 pointer-events-none" />
                      )}
                    </div>
                    <div className="min-w-0 pr-1 hidden sm:block max-w-[140px]">
                      <p className={`text-[10px] font-bold truncate ${isActive ? 'text-brand' : 'text-text-muted'}`}>
                        {camp.eyebrow}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Prev / Next Arrows */}
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={goToPrev}
                className="p-1.5 rounded-lg border border-border bg-surface hover:border-brand text-text-muted hover:text-brand transition-colors cursor-pointer"
                title="Previous Campaign"
              >
                <Icon icon="solar:alt-arrow-left-linear" className="text-sm" />
              </button>
              <button
                type="button"
                onClick={goToNext}
                className="p-1.5 rounded-lg border border-border bg-surface hover:border-brand text-text-muted hover:text-brand transition-colors cursor-pointer"
                title="Next Campaign"
              >
                <Icon icon="solar:alt-arrow-right-linear" className="text-sm" />
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
