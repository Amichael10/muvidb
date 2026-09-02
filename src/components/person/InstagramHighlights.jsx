import { useState } from 'react';
import { Icon } from '@iconify/react';
import ProVideoTheaterModal from '../professional/ProVideoTheaterModal';

export function extractInstagramShortcode(url) {
  if (!url || typeof url !== 'string') return null;
  const match = url.match(/instagram\.com\/(?:p|reel|tv)\/([^/?#&]+)/i);
  return match ? match[1] : null;
}

export function getInstagramImageUrl(url) {
  const shortcode = extractInstagramShortcode(url);
  if (!shortcode) return null;
  return `https://www.instagram.com/p/${shortcode}/media/?size=l`;
}

export default function InstagramHighlights({ highlights = [], instagramHandle = '' }) {
  const [activeTheaterVideo, setActiveTheaterVideo] = useState(null);
  const [activeLightboxPhoto, setActiveLightboxPhoto] = useState(null);

  if (!highlights || !Array.isArray(highlights) || highlights.length === 0) return null;

  // Separate rich objects from legacy string URLs
  const richPhotos = highlights.filter(h => typeof h === 'object' && h !== null && h.type === 'photo');
  const richVideos = highlights.filter(h => typeof h === 'object' && h !== null && h.type === 'video');
  const legacyUrls = highlights.filter(h => typeof h === 'string' && h.trim().length > 0);

  const hasRichMedia = richPhotos.length > 0 || richVideos.length > 0;

  return (
    <section className="my-10 space-y-8">
      {/* 1. Featured Showreels & Performance Videos */}
      {richVideos.length > 0 && (
        <div>
          <div className="mb-4 flex items-center justify-between">
            <h3 className="flex items-center gap-2.5 font-heading text-lg font-black tracking-tight text-text-primary md:text-xl">
              <span className="grid h-7 w-7 place-items-center rounded-lg bg-red-500/10 text-red-400">
                <Icon icon="solar:videocamera-record-bold" width="17" />
              </span>
              <span>Performance Videos & Showreels</span>
              <span className="rounded-full bg-white/[.05] px-2 py-0.5 text-xs text-text-muted">{richVideos.length}</span>
            </h3>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {richVideos.map((video) => (
              <article
                key={video.id || video.url}
                onClick={() => setActiveTheaterVideo(video)}
                className="group relative cursor-pointer overflow-hidden rounded-2xl border border-border bg-surface-2 shadow-lg transition-all duration-300 hover:-translate-y-1 hover:border-brand"
              >
                <div className="relative aspect-video w-full overflow-hidden bg-black">
                  <img
                    src={video.thumbnail || '/images/film-placeholder.webp'}
                    alt={video.title}
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 grid place-items-center bg-black/30 transition group-hover:bg-black/50">
                    <span className="grid h-12 w-12 place-items-center rounded-full bg-brand/90 text-white shadow-xl transition group-hover:scale-110">
                      <Icon icon="solar:play-bold" width="22" />
                    </span>
                  </div>
                  <span className="absolute left-2.5 top-2.5 rounded-full bg-black/70 px-2.5 py-0.5 text-[9px] font-black uppercase tracking-wider text-brand backdrop-blur-md">
                    {video.category?.replaceAll('_', ' ') || 'Reel'}
                  </span>
                  {video.duration && (
                    <span className="absolute bottom-2.5 right-2.5 rounded bg-black/80 px-2 py-0.5 text-[10px] font-black text-white backdrop-blur-sm">
                      {video.duration}
                    </span>
                  )}
                </div>

                <div className="p-4">
                  <h4 className="truncate text-xs font-black text-text-primary group-hover:text-brand">{video.title}</h4>
                  {video.film_title && (
                    <p className="mt-1 truncate text-[11px] text-text-muted">
                      Film: <strong className="text-text-primary">{video.film_title}</strong>
                    </p>
                  )}
                  {video.character_name && (
                    <p className="text-[10px] text-brand">as {video.character_name}</p>
                  )}
                </div>
              </article>
            ))}
          </div>
        </div>
      )}

      {/* 2. High-Res Photos & Stills Gallery */}
      {richPhotos.length > 0 && (
        <div>
          <div className="mb-4 flex items-center justify-between">
            <h3 className="flex items-center gap-2.5 font-heading text-lg font-black tracking-tight text-text-primary md:text-xl">
              <span className="grid h-7 w-7 place-items-center rounded-lg bg-brand/10 text-brand">
                <Icon icon="solar:gallery-wide-bold" width="17" />
              </span>
              <span>Photos & Production Stills</span>
              <span className="rounded-full bg-white/[.05] px-2 py-0.5 text-xs text-text-muted">{richPhotos.length}</span>
            </h3>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {richPhotos.map((photo) => (
              <article
                key={photo.id || photo.url}
                onClick={() => setActiveLightboxPhoto(photo)}
                className="group relative aspect-[3/4] cursor-pointer overflow-hidden rounded-2xl border border-border bg-surface-2 shadow-md transition duration-300 hover:-translate-y-1 hover:border-brand"
              >
                <img
                  src={photo.thumbnail || photo.url}
                  alt={photo.title || 'Photo'}
                  className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                  loading="lazy"
                />
                <span className="absolute left-2.5 top-2.5 rounded-md bg-black/70 px-2 py-0.5 text-[8px] font-black uppercase tracking-wider text-white backdrop-blur-md">
                  {photo.category?.replaceAll('_', ' ') || 'Photo'}
                </span>
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-3 pt-6 opacity-0 transition group-hover:opacity-100">
                  <p className="truncate text-[11px] font-black text-white">{photo.title}</p>
                  {photo.photographer && <p className="text-[9px] text-text-muted">📷 {photo.photographer}</p>}
                </div>
              </article>
            ))}
          </div>
        </div>
      )}

      {/* 3. Legacy Instagram Links (if any) */}
      {!hasRichMedia && legacyUrls.length > 0 && (
        <div>
          <div className="mb-4 flex items-center justify-between">
            <h3 className="flex items-center gap-2 font-heading text-lg font-bold tracking-tight text-text-primary md:text-xl">
              <Icon icon="solar:instagram-bold" className="text-xl text-pink-500" />
              <span>Instagram Highlights</span>
            </h3>
            {instagramHandle && (
              <a
                href={instagramHandle.startsWith('http') ? instagramHandle : `https://instagram.com/${instagramHandle.replace('@', '')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-xs font-bold text-text-muted transition-colors hover:text-brand"
              >
                <span>View Profile</span>
                <Icon icon="solar:export-linear" className="text-xs" />
              </a>
            )}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
            {legacyUrls.slice(0, 3).map((url, idx) => {
              const shortcode = extractInstagramShortcode(url);
              const isReel = url.includes('/reel/') || url.includes('/tv/');
              const imageUrl = getInstagramImageUrl(url);

              return (
                <a
                  key={shortcode || idx}
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group relative flex aspect-square flex-col justify-end overflow-hidden rounded-xl border border-border bg-surface-2 shadow-md transition-all duration-300 hover:border-brand"
                >
                  {imageUrl ? (
                    <img
                      src={imageUrl}
                      alt={`Instagram highlight ${idx + 1}`}
                      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                      loading="lazy"
                    />
                  ) : null}

                  {isReel && (
                    <div className="absolute right-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-full border border-white/20 bg-black/60 text-white shadow-lg backdrop-blur-md">
                      <Icon icon="solar:play-bold" className="ml-0.5 text-sm" />
                    </div>
                  )}

                  <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-2 bg-black/60 p-4 text-center text-xs font-bold text-white opacity-0 backdrop-blur-[2px] transition-opacity duration-300 group-hover:opacity-100">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-tr from-amber-500 via-rose-500 to-purple-600 shadow-lg">
                      <Icon icon="solar:instagram-bold" className="text-xl text-white" />
                    </div>
                    <span className="tracking-wide">View on Instagram</span>
                    <Icon icon="solar:export-bold" className="text-xs opacity-80" />
                  </div>
                </a>
              );
            })}
          </div>
        </div>
      )}

      {/* Fullscreen Video Player */}
      {activeTheaterVideo && (
        <ProVideoTheaterModal
          video={activeTheaterVideo}
          onClose={() => setActiveTheaterVideo(null)}
        />
      )}

      {/* Lightbox Photo Preview */}
      {activeLightboxPhoto && (
        <div
          onClick={() => setActiveLightboxPhoto(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4 backdrop-blur-lg"
        >
          <div className="relative max-h-[90vh] max-w-4xl" onClick={(e) => e.stopPropagation()}>
            <img
              src={activeLightboxPhoto.url}
              alt={activeLightboxPhoto.title}
              className="max-h-[85vh] rounded-2xl object-contain shadow-2xl"
            />
            <div className="mt-3 flex items-center justify-between text-xs text-white">
              <div>
                <p className="font-black">{activeLightboxPhoto.title}</p>
                {activeLightboxPhoto.photographer && (
                  <p className="text-text-muted">📷 {activeLightboxPhoto.photographer} · {activeLightboxPhoto.year}</p>
                )}
              </div>
              <button
                onClick={() => setActiveLightboxPhoto(null)}
                className="rounded-xl bg-white/10 px-4 py-2 font-black hover:bg-white/20"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
