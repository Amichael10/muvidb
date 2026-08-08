import { useState } from 'react';
import { Icon } from '@iconify/react';

export function extractInstagramShortcode(url) {
  if (!url) return null;
  const match = url.match(/instagram\.com\/(?:p|reel|tv)\/([^/?#&]+)/i);
  return match ? match[1] : null;
}

export function getInstagramImageUrl(url) {
  const shortcode = extractInstagramShortcode(url);
  if (!shortcode) return null;
  return `https://www.instagram.com/p/${shortcode}/media/?size=l`;
}

export default function InstagramHighlights({ highlights = [], instagramHandle = '' }) {
  // Filter valid URLs
  const validHighlights = (highlights || []).filter(url => typeof url === 'string' && url.trim().length > 0);

  if (validHighlights.length === 0) return null;

  return (
    <section className="my-8">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-heading font-bold text-lg md:text-xl text-text-primary flex items-center gap-2 tracking-tight">
          <Icon icon="solar:instagram-bold" className="text-pink-500 text-xl" />
          <span>Instagram Highlights</span>
        </h3>
        {instagramHandle && (
          <a
            href={instagramHandle.startsWith('http') ? instagramHandle : `https://instagram.com/${instagramHandle.replace('@', '')}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-bold text-text-muted hover:text-brand transition-colors flex items-center gap-1"
          >
            <span>View Profile</span>
            <Icon icon="solar:export-linear" className="text-xs" />
          </a>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
        {validHighlights.slice(0, 3).map((url, idx) => {
          const shortcode = extractInstagramShortcode(url);
          const isReel = url.includes('/reel/') || url.includes('/tv/');
          const imageUrl = getInstagramImageUrl(url);

          return (
            <a
              key={shortcode || idx}
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="group relative aspect-square rounded-xl overflow-hidden border border-border hover:border-brand bg-surface-2 transition-all duration-300 shadow-md flex flex-col justify-end"
            >
              {imageUrl ? (
                <img
                  src={imageUrl}
                  alt={`Instagram highlight ${idx + 1}`}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  loading="lazy"
                  onError={(e) => {
                    // Fallback to placeholder if IG CDN fails
                    e.target.style.display = 'none';
                  }}
                />
              ) : null}

              {/* Video Play Badge indicator if Reel */}
              {isReel && (
                <div className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/60 backdrop-blur-md border border-white/20 flex items-center justify-center text-white shadow-lg z-10">
                  <Icon icon="solar:play-bold" className="text-sm ml-0.5" />
                </div>
              )}

              {/* Hover Overlay with Theme-Aware contrast */}
              <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px] opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col items-center justify-center gap-2 p-4 text-white font-bold text-xs text-center z-20">
                <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-amber-500 via-rose-500 to-purple-600 flex items-center justify-center shadow-lg">
                  <Icon icon="solar:instagram-bold" className="text-white text-xl" />
                </div>
                <span className="tracking-wide">View on Instagram</span>
                <Icon icon="solar:export-bold" className="text-xs opacity-80" />
              </div>
            </a>
          );
        })}
      </div>
    </section>
  );
}
