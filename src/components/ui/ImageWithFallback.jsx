import { useState, useEffect } from 'react';

// Premium brand-aligned gradients for fallback backgrounds
const PRESET_GRADIENTS = [
  { from: '#FF5A1F', to: '#FF8C00', name: 'Brand Orange' },
  { from: '#4F46E5', to: '#7C3AED', name: 'Royal Indigo' },
  { from: '#059669', to: '#10B981', name: 'Emerald Green' },
  { from: '#DB2777', to: '#F43F5E', name: 'Rose Pink' },
  { from: '#7C3AED', to: '#C084FC', name: 'Vibrant Purple' },
  { from: '#D97706', to: '#F59E0B', name: 'Amber Gold' },
  { from: '#0891B2', to: '#06B6D4', name: 'Ocean Cyan' },
  { from: '#2563EB', to: '#3B82F6', name: 'Electric Blue' },
];

const getHash = (str) => {
  if (!str) return 0;
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return Math.abs(hash);
};

export default function ImageWithFallback({
  src,
  alt = '',
  className = '',
  fallbackType = 'avatar', // 'avatar' | 'banner' | 'video'
  name = '',
  ...props
}) {
  const [hasError, setHasError] = useState(!src);

  // Sync error state if the src changes dynamically
  useEffect(() => {
    setHasError(!src);
  }, [src]);

  const hash = getHash(name || alt || 'Ensembla');
  const gradient = PRESET_GRADIENTS[hash % PRESET_GRADIENTS.length];

  // Get initials for avatar (max 2 characters)
  const getInitials = (title) => {
    if (!title) return 'EN';
    const cleaned = title.trim().replace(/[^a-zA-Z0-9\s]/g, '');
    const words = cleaned.split(/\s+/).filter(Boolean);
    if (words.length >= 2) {
      return (words[0][0] + words[1][0]).toUpperCase();
    }
    if (words.length === 1) {
      return words[0].slice(0, Math.min(2, words[0].length)).toUpperCase();
    }
    return title.slice(0, 2).toUpperCase();
  };

  const initials = getInitials(name || alt);

  if (hasError) {
    if (fallbackType === 'banner') {
      return (
        <div
          className={`w-full h-full relative overflow-hidden flex items-center justify-center ${className}`}
          style={{
            background: `linear-gradient(135deg, ${gradient.from}, ${gradient.to})`,
          }}
          {...props}
        >
          {/* Subtle Grid overlay */}
          <div className="absolute inset-0 grid-bg opacity-15 pointer-events-none" />
          
          {/* Glassmorphic decorative bubbles for that extra premium look */}
          <div className="absolute -top-12 -left-12 w-32 h-32 rounded-full bg-white/10 blur-xl pointer-events-none" />
          <div className="absolute -bottom-16 -right-16 w-40 h-40 rounded-full bg-black/15 blur-2xl pointer-events-none" />
          
          {/* Subtle text label if it's large enough */}
          <span className="absolute bottom-3 right-4 text-[9px] font-black uppercase tracking-[0.25em] text-white/40 pointer-events-none select-none font-heading">
            {name || alt || 'ENSEMBLA'}
          </span>
        </div>
      );
    }

    if (fallbackType === 'video') {
      return (
        <div
          className={`w-full h-full bg-surface-2 flex flex-col items-center justify-center relative overflow-hidden border border-border/50 ${className}`}
          {...props}
        >
          <div className="absolute inset-0 grid-bg opacity-5 pointer-events-none" />
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center mb-1 text-white shadow-md"
            style={{
              background: `linear-gradient(135deg, ${gradient.from}, ${gradient.to})`,
            }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="5 3 19 12 5 21 5 3"/>
            </svg>
          </div>
          <span className="text-[9px] font-bold text-text-muted max-w-[80%] truncate uppercase tracking-widest text-center px-2">
            {name || alt || 'VIDEO'}
          </span>
        </div>
      );
    }

    // Default 'avatar' fallback - Uses @container query styling for scaling font size automatically
    return (
      <div
        className={`relative flex items-center justify-center text-white font-heading font-bold select-none @container ${className}`}
        style={{
          background: `linear-gradient(135deg, ${gradient.from}, ${gradient.to})`,
        }}
        {...props}
      >
        <div className="absolute inset-0 bg-white/5 pointer-events-none mix-blend-overlay" />
        <span className="drop-shadow-[0_2px_4px_rgba(0,0,0,0.3)] text-[38cqi] leading-none uppercase font-black">
          {initials}
        </span>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      className={className}
      onError={() => setHasError(true)}
      {...props}
    />
  );
}
