import React, { useState, useRef } from 'react';
import { Icon } from '@iconify/react';
import { PLATFORMS, getPlatform, parseStreamingLinks } from '../../lib/platforms';

const PlatformMark = ({ platformId, size = 24, className = '' }) => {
  const platform = getPlatform(platformId);
  if (!platform) return null;
  const px = `${size}px`;

  if (platform.logo) {
    return (
      <span
        className={`inline-flex items-center justify-center rounded-md bg-white shrink-0 overflow-hidden ${className}`}
        style={{ width: px, height: px }}
        title={platform.name}
      >
        <img
          src={platform.logo}
          alt=""
          className="w-full h-full object-contain p-0.5"
          loading="lazy"
        />
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center justify-center rounded-md shrink-0 ${className}`}
      style={{
        width: px,
        height: px,
        background: 'rgba(255,255,255,0.15)',
        color: '#fff',
      }}
      title={platform.name}
    >
      <Icon icon={platform.icon} width={Math.round(size * 0.62)} height={Math.round(size * 0.62)} />
    </span>
  );
};

const WatchOptions = ({ film, isFullWidth = false }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  const defaultLinks = {
    netflix: 'https://netflix.com',
    prime_video: 'https://primevideo.com',
    kava: 'https://kava.tv',
    youtube: 'https://youtube.com',
    docuth: 'https://web.docuth.com',
    ebonylife: 'https://ebonylifeonplus.com',
    circuits: 'https://www.circuits.tv',
  };

  // Prefer the shared PLATFORMS catalogue (icons + real logos).
  const catalog = PLATFORMS.filter((p) => !p.isCinema);
  const links = parseStreamingLinks(film);

  const availableLinks = catalog.map((p) => {
    const directLink = links[p.id];
    const primaryLink = film.release_type === p.id ? film.youtube_watch_url : null;
    return {
      id: p.id,
      label: p.name,
      color: p.color,
      icon: p.icon,
      logo: p.logo,
      url: directLink || primaryLink || defaultLinks[p.id],
      isDirect: !!(directLink || primaryLink),
    };
  });

  const activeLinks = availableLinks.filter(
    (l) => l.isDirect || l.id === film.release_type
  );
  const trailerValue = String(film.trailer_youtube_id || '').trim();
  const hasTrailer =
    /^[\w-]{11}$/.test(trailerValue) ||
    /(?:youtu\.be\/|youtube\.com\/(?:embed\/|shorts\/|watch\?v=))([\w-]{11})/.test(
      trailerValue
    );

  if (activeLinks.length === 0) {
    if (!hasTrailer) return null;

    return (
      <button
        type="button"
        onClick={() => {
          document.getElementById('trailer-section')?.scrollIntoView({ behavior: 'smooth' });
        }}
        className={`${isFullWidth ? 'w-full' : ''} flex items-center justify-center gap-2.5 bg-brand text-white px-8 py-4 rounded-xl font-black text-[10px] uppercase tracking-widest hover:scale-[1.02] hover:shadow-[0_0_15px_rgba(255,92,0,0.4)] transition-all duration-300 min-h-[44px] shadow-lg shadow-brand/20`}
      >
        <Icon icon="solar:play-bold" width="24" height="24" />
        Trailer
      </button>
    );
  }

  const primaryLink =
    activeLinks.find((l) => l.id === film.release_type) || activeLinks[0];
  const otherLinks = activeLinks.filter((l) => l.id !== primaryLink.id);

  return (
    <div className={`relative inline-flex ${isFullWidth ? 'w-full' : ''}`} ref={dropdownRef}>
      <a
        href={primaryLink.url}
        target="_blank"
        rel="noopener noreferrer"
        className={`flex-1 flex items-center justify-center gap-2.5 px-6 sm:px-8 py-4 ${otherLinks.length > 0 ? 'rounded-l-xl' : 'rounded-xl'} font-black text-[10px] uppercase tracking-widest transition-all duration-300 text-white hover:brightness-110 min-h-[44px] shadow-lg shadow-black/20`}
        style={{ backgroundColor: primaryLink.color }}
      >
        <PlatformMark platformId={primaryLink.id} size={24} />
        <span>Play on {primaryLink.label}</span>
        {otherLinks.length > 0 && (
          <span className="hidden sm:inline-flex items-center -space-x-1.5 ml-1 opacity-90">
            {otherLinks.slice(0, 3).map((link) => (
              <PlatformMark
                key={link.id}
                platformId={link.id}
                size={20}
                className="ring-2 ring-black/25"
              />
            ))}
          </span>
        )}
      </a>

      {otherLinks.length > 0 && (
        <div className="relative">
          <button
            type="button"
            onClick={() => setIsOpen(!isOpen)}
            onBlur={() => setTimeout(() => setIsOpen(false), 200)}
            className="h-full px-3 sm:px-4 border-l border-white/20 rounded-r-xl flex items-center justify-center gap-1.5 text-white transition-all duration-300 hover:brightness-110 shadow-lg shadow-black/20"
            style={{ backgroundColor: primaryLink.color }}
            aria-label="More watch options"
          >
            <span className="sm:hidden inline-flex items-center -space-x-1.5">
              {otherLinks.slice(0, 2).map((link) => (
                <PlatformMark
                  key={link.id}
                  platformId={link.id}
                  size={20}
                  className="ring-2 ring-black/25"
                />
              ))}
            </span>
            <Icon
              icon="solar:alt-arrow-down-linear"
              className={`w-4 h-4 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}
              strokeWidth={3}
            />
          </button>

          {isOpen && (
            <div className="absolute right-0 bottom-full mb-3 w-56 bg-surface border border-border rounded-xl shadow-2xl z-50 overflow-hidden animate-in fade-in slide-in-from-bottom-2">
              <div className="p-3 border-b border-border bg-surface-2/30">
                <span className="text-[9px] font-black uppercase tracking-[0.2em] text-text-muted">
                  Ways to Watch
                </span>
              </div>
              {otherLinks.map((link) => (
                <a
                  key={link.id}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between px-4 py-4 hover:bg-surface-2 transition-colors border-b border-border last:border-0 group"
                >
                  <div className="flex items-center gap-3">
                    <PlatformMark platformId={link.id} size={24} />
                    <span className="text-[10px] font-black text-text-primary uppercase tracking-widest">
                      {link.label}
                    </span>
                  </div>
                  {!link.isDirect && (
                    <span className="text-[8px] font-black bg-surface-2 px-2 py-0.5 rounded text-text-muted border border-border uppercase tracking-widest">
                      Site
                    </span>
                  )}
                </a>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default WatchOptions;
