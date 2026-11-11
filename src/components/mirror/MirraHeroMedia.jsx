import React from 'react';

/**
 * Full-bleed Living Video / Vertical Studio Portrait Hero
 * Matches Mirra's signature high-fashion upper-viewport media treatment.
 */
export default function MirraHeroMedia({
  mediaUrl,
  isVideo = false,
  posterUrl,
  alt = 'Creator Media',
}) {
  return (
    <div className="relative w-full h-[480px] sm:h-[540px] overflow-hidden select-none bg-zinc-950">
      {isVideo && mediaUrl ? (
        <video
          src={mediaUrl}
          poster={posterUrl}
          autoPlay
          loop
          muted
          playsInline
          className="w-full h-full object-cover object-center"
        />
      ) : (
        <img
          src={mediaUrl || posterUrl || '/placeholder-avatar.png'}
          alt={alt}
          className="w-full h-full object-cover object-top filter brightness-[0.98]"
        />
      )}

      {/* Top subtle vignette for status bar readability */}
      <div className="absolute top-0 inset-x-0 h-24 bg-gradient-to-b from-black/60 via-black/20 to-transparent pointer-events-none" />

      {/* Bottom atmospheric dark blend into content */}
      <div className="absolute bottom-0 inset-x-0 h-40 bg-gradient-to-t from-black via-black/60 to-transparent pointer-events-none" />
    </div>
  );
}
