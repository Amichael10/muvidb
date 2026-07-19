import { useState, useEffect } from 'react';
import { getImageSrcSet, getProxiedImageUrl, normalizeImageUrl } from '../../lib/imageUrl';

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

// Upgrade low-res YouTube thumbnails to high-res maxresdefault.jpg
const getHighResYoutubeThumbnail = (url) => {
  const normalized = normalizeImageUrl(url);
  if (!normalized) return '';
  if (normalized.includes('ytimg.com') || normalized.includes('youtube.com/vi/')) {
    const match = normalized.match(/\/vi\/([^/?#]+)/) || normalized.match(/\/vi_webp\/([^/?#]+)/);
    if (match && match[1]) {
      const videoId = match[1];
      return `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;
    }
  }
  return normalized;
};

const getYoutubePreviewThumbnail = (url) => {
  if (!url || !url.includes('/maxresdefault.jpg')) return '';
  return url.replace('/maxresdefault.jpg', '/hqdefault.jpg');
};

export default function ImageWithFallback({
  src,
  alt = '',
  className = '',
  fallbackType = 'avatar', // 'avatar' | 'banner' | 'video'
  name = '',
  width, // optional: request an optimized image of this width (Supabase storage only)
  quality = 75,
  style,
  loading = 'lazy',
  decoding = 'async',
  fetchPriority,
  sizes,
  srcSet,
  onLoad,
  onError,
  ...props
}) {
  const [imgSrc, setImgSrc] = useState(getHighResYoutubeThumbnail(src));
  const [hasError, setHasError] = useState(!src);
  const [isLoaded, setIsLoaded] = useState(false);

  // Sync state if the src changes dynamically
  useEffect(() => {
    setImgSrc(getHighResYoutubeThumbnail(src));
    setHasError(!src);
    setIsLoaded(false);
  }, [src]);

  const hash = getHash(name || alt || 'MuviDB');
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

  const handleImageError = (event) => {
    setIsLoaded(false);
    if (imgSrc && imgSrc.includes('/maxresdefault.jpg')) {
      // Fallback to hqdefault (480x360), which always exists
      const fallbackSrc = imgSrc.replace('/maxresdefault.jpg', '/hqdefault.jpg');
      setImgSrc(fallbackSrc);
    } else if (imgSrc && imgSrc.includes('/hqdefault.jpg')) {
      // If hqdefault also fails, try standard default (mqdefault)
      const fallbackSrc = imgSrc.replace('/hqdefault.jpg', '/mqdefault.jpg');
      setImgSrc(fallbackSrc);
    } else {
      setHasError(true);
      onError?.(event);
    }
  };

  if (hasError) {
    if (fallbackType === 'banner') {
      return (
        <div
          className={`w-full h-full relative overflow-hidden flex items-center justify-center @container ${className}`}
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

          {/* Darkening scrim so the branded label reads as intentional, not broken */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-black/15 pointer-events-none" />

          {/* Branded centered title + MuviDB mark */}
          <div className="relative z-10 flex flex-col items-center justify-center text-center px-4 pointer-events-none select-none">
            <span className="font-heading font-black text-white leading-tight tracking-tight line-clamp-3 drop-shadow-[0_2px_6px_rgba(0,0,0,0.4)] text-[clamp(13px,4cqi,22px)]">
              {name || alt || 'Untitled'}
            </span>
            <span className="mt-2 text-[9px] font-black uppercase tracking-[0.28em] text-white/70 font-heading">
              Muvi<span className="text-white">DB</span>
            </span>
          </div>
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

  const handleImageLoad = (event) => {
    const img = event.currentTarget;
    // YouTube's "unavailable" placeholder image is returned with a width of 120px (120x90).
    // If we detect this placeholder, immediately swap to hqdefault.jpg which always exists.
    if (imgSrc && imgSrc.includes('/maxresdefault.jpg') && img.naturalWidth <= 120) {
      const fallbackSrc = imgSrc.replace('/maxresdefault.jpg', '/hqdefault.jpg');
      setImgSrc(fallbackSrc);
      setIsLoaded(false);
      return;
    }

    const reveal = () => {
      setIsLoaded(true);
      onLoad?.(event);
    };
    if (typeof img.decode === 'function') {
      img.decode().catch(() => {}).finally(reveal);
    } else {
      reveal();
    }
  };

  // Supabase Pro serves the tiny preview from its transformed-image CDN. For
  // YouTube, keep maxres as the final image while hqdefault paints underneath
  // immediately; failed maxres requests then reveal an already-warm fallback.
  const mainUrl = getProxiedImageUrl(imgSrc, { width, quality });
  const youtubePreview = getYoutubePreviewThumbnail(imgSrc);
  const lqip = youtubePreview || getProxiedImageUrl(imgSrc, { width: 32, quality: 35 });
  const hasUsefulPreview = Boolean(lqip && lqip !== mainUrl);
  const placeholderStyle = hasUsefulPreview
    ? { backgroundImage: `url("${lqip}")`, backgroundSize: 'cover', backgroundPosition: 'center' }
    : { background: `linear-gradient(135deg, ${gradient.from}, ${gradient.to})` };
  const generatedSrcSet = srcSet || (width
    ? getImageSrcSet(imgSrc, [Math.max(32, Math.round(width / 2)), width], quality)
    : undefined);
  const revealStyle = {
    ...placeholderStyle,
    filter: isLoaded ? 'blur(0)' : hasUsefulPreview ? 'blur(7px)' : 'none',
    opacity: isLoaded ? 1 : 0.96,
    transition: 'filter 220ms ease, opacity 180ms ease, transform 500ms ease',
    ...style,
  };

  // Optimize only at render time so the raw imgSrc above keeps driving the
  // YouTube/error fallback logic untouched.
  return (
    <img
      src={mainUrl}
      srcSet={generatedSrcSet}
      sizes={sizes}
      alt={alt}
      className={className}
      style={revealStyle}
      loading={loading}
      decoding={decoding}
      fetchPriority={fetchPriority}
      onLoad={handleImageLoad}
      onError={handleImageError}
      {...props}
    />
  );
}
