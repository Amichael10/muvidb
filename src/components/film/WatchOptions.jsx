import React, { useState, useRef } from 'react';
import { Icon } from '@iconify/react';
import { getPlatform } from '../../lib/platforms';

const WatchOptions = ({ film, isFullWidth = false }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  const defaultLinks = {
    netflix: 'https://netflix.com',
    prime_video: 'https://primevideo.com',
    kava: 'https://kava.tv',
    youtube: 'https://youtube.com',
    showmax: 'https://showmax.com',
    ironflix: 'https://ironflix.com',
    docuth: 'https://web.docuth.com',
  };

  const platforms = [
    { id: 'netflix', label: 'Netflix', color: 'bg-[#E50914]', icon: 'simple-icons:netflix' },
    { id: 'prime_video', label: 'Prime Video', color: 'bg-[#00A8E1]', icon: 'simple-icons:primevideo' },
    { id: 'kava', label: 'Kava', color: 'bg-[#FF5C00]', icon: 'solar:play-circle-bold' },
    { id: 'ironflix', label: 'Ironflix', color: 'bg-[#D32F2F]', icon: 'solar:play-bold' },
    { id: 'youtube', label: 'YouTube', color: 'bg-[#FF0000]', icon: 'simple-icons:youtube' },
    { id: 'showmax', label: 'Showmax', color: 'bg-[#E10098]', icon: 'solar:tv-linear' },
    { id: 'docuth', label: 'Docuth', color: 'bg-[#0F0F10]', icon: 'solar:play-bold' },
  ];

  const availableLinks = platforms.map(p => {
    const directLink = film.streaming_links?.[p.id];
    const primaryLink = (film.release_type === p.id) ? film.youtube_watch_url : null;
    return {
      ...p,
      url: directLink || primaryLink || defaultLinks[p.id],
      isDirect: !!(directLink || primaryLink)
    };
  });

  // Filter to only show platforms that have direct links OR the primary platform
  const activeLinks = availableLinks.filter(l => l.isDirect || l.id === film.release_type);
  const trailerValue = String(film.trailer_youtube_id || '').trim();
  const hasTrailer = /^[\w-]{11}$/.test(trailerValue)
    || /(?:youtu\.be\/|youtube\.com\/(?:embed\/|shorts\/|watch\?v=))[\w-]{11}/.test(trailerValue);
  
  if (activeLinks.length === 0) {
    if (!hasTrailer) return null;

    return (
      <button 
        onClick={() => {
            const el = document.getElementById('trailer-section');
            if (el) el.scrollIntoView({ behavior: 'smooth' });
        }}
        className={`${isFullWidth ? 'w-full' : ''} flex items-center justify-center gap-2 bg-brand text-white px-8 py-4 rounded-xl font-black text-[10px] uppercase tracking-widest hover:scale-[1.02] hover:shadow-[0_0_15px_rgba(255,92,0,0.4)] transition-all duration-300 min-h-[44px] shadow-lg shadow-brand/20`}
      >
        <Icon icon="solar:play-bold" className="text-sm" />
        Trailer
      </button>
    );
  }

  const primaryLink = activeLinks.find(l => l.id === film.release_type) || activeLinks[0];
  const otherLinks = activeLinks.filter(l => l.id !== primaryLink.id);

  return (
    <div className={`relative inline-flex ${isFullWidth ? 'w-full' : ''}`} ref={dropdownRef}>
      <a
        href={primaryLink.url}
        target="_blank"
        rel="noopener noreferrer"
        className={`flex-1 flex items-center justify-center gap-3 px-8 py-4 ${otherLinks.length > 0 ? 'rounded-l-xl' : 'rounded-xl'} font-black text-[10px] uppercase tracking-widest transition-all duration-300 text-white hover:brightness-110 ${primaryLink.color} hover:shadow-lg min-h-[44px] shadow-lg shadow-black/20`}
      >
        <Icon icon={primaryLink.icon} className="text-sm" />
        Play on {primaryLink.label}
      </a>
      
      {otherLinks.length > 0 && (
        <div className="relative">
          <button
            onClick={() => setIsOpen(!isOpen)}
            onBlur={() => setTimeout(() => setIsOpen(false), 200)}
            className={`h-full px-4 border-l border-white/20 rounded-r-xl flex items-center justify-center text-white transition-all duration-300 hover:brightness-110 ${primaryLink.color} shadow-lg shadow-black/20`}
          >
            <Icon 
                icon="solar:alt-arrow-down-linear" 
                className={`w-4 h-4 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} 
                strokeWidth={3}
            />
          </button>

          {isOpen && (
            <div className="absolute right-0 bottom-full mb-3 w-56 bg-surface border border-border rounded-xl shadow-2xl z-50 overflow-hidden animate-in fade-in slide-in-from-bottom-2">
              <div className="p-3 border-b border-border bg-surface-2/30">
                <span className="text-[9px] font-black uppercase tracking-[0.2em] text-text-muted">Ways to Watch</span>
              </div>
              {otherLinks.map(link => (
                <a
                  key={link.id}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between px-4 py-4 hover:bg-surface-2 transition-colors border-b border-border last:border-0 group"
                >
                  <div className="flex items-center gap-3">
                    {getPlatform(link.id)?.logo
                      ? <img src={getPlatform(link.id).logo} alt="" className="w-4 h-4 object-contain rounded-sm" loading="lazy" />
                      : <Icon icon={link.icon} className="text-sm text-text-muted group-hover:text-brand transition-colors" />}
                    <span className="text-[10px] font-black text-text-primary uppercase tracking-widest">{link.label}</span>
                  </div>
                  {!link.isDirect && <span className="text-[8px] font-black bg-surface-2 px-2 py-0.5 rounded text-text-muted border border-border uppercase tracking-widest">Site</span>}
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
