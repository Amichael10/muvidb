import { useState, useMemo } from 'react';
import { Icon } from '@iconify/react';
import ProVideoTheaterModal from '../professional/ProVideoTheaterModal';

export default function PersonMediaHub({ highlights = [], personName = 'Actor', instagramHandle = '' }) {
  const [activeTab, setActiveTab] = useState('all'); // 'all' | 'videos' | 'photos'
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [theaterVideo, setTheaterVideo] = useState(null);
  const [lightboxIndex, setLightboxIndex] = useState(null);

  // Normalize highlights into structured media objects
  const { photos, videos, allMedia } = useMemo(() => {
    if (!highlights || !Array.isArray(highlights)) {
      return { photos: [], videos: [], allMedia: [] };
    }

    const p = [];
    const v = [];

    highlights.forEach((item, idx) => {
      if (!item) return;

      // Object format
      if (typeof item === 'object') {
        if (item.type === 'photo') {
          p.push({
            id: item.id || `photo_${idx}`,
            type: 'photo',
            category: item.category || 'headshot',
            title: item.title || 'Official Photo',
            url: item.url,
            thumbnail: item.thumbnail || item.url,
            photographer: item.photographer || null,
            year: item.year || null,
            aspect_ratio: item.aspect_ratio || '3:4',
            is_primary: item.is_primary || false
          });
        } else if (item.type === 'video') {
          v.push({
            id: item.id || `video_${idx}`,
            type: 'video',
            category: item.category || 'showreel',
            title: item.title || 'Performance Reel',
            url: item.url,
            thumbnail: item.thumbnail || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=800&q=80',
            embed_provider: item.embed_provider || 'youtube',
            embed_id: item.embed_id || null,
            duration: item.duration || null,
            film_title: item.film_title || null,
            character_name: item.character_name || null,
            year: item.year || null,
            is_featured: item.is_featured || false
          });
        }
      }
      // Legacy Instagram URL strings
      else if (typeof item === 'string' && item.trim().length > 0) {
        const isReel = item.includes('/reel/') || item.includes('/tv/');
        const shortcode = item.match(/instagram\.com\/(?:p|reel|tv)\/([^/?#&]+)/i)?.[1];
        const igImg = shortcode ? `https://www.instagram.com/p/${shortcode}/media/?size=l` : null;

        if (isReel) {
          v.push({
            id: `ig_reel_${idx}`,
            type: 'video',
            category: 'social_reel',
            title: 'Instagram Performance Reel',
            url: item,
            thumbnail: igImg || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=800&q=80',
            embed_provider: 'instagram',
            embed_id: shortcode
          });
        } else {
          p.push({
            id: `ig_photo_${idx}`,
            type: 'photo',
            category: 'editorial',
            title: 'Instagram Capture',
            url: item,
            thumbnail: igImg || item,
            aspect_ratio: '1:1'
          });
        }
      }
    });

    return { photos: p, videos: v, allMedia: [...v, ...p] };
  }, [highlights]);

  if (allMedia.length === 0) return null;

  // Primary preview items for the inline hero capsule
  const featuredVideo = videos.find(v => v.is_featured) || videos[0] || null;
  const featuredPhoto = photos.find(p => p.is_primary) || photos[0] || null;

  // Filtered list for the modal
  const filteredModalMedia = allMedia.filter(item => {
    if (activeTab === 'videos' && item.type !== 'video') return false;
    if (activeTab === 'photos' && item.type !== 'photo') return false;
    if (categoryFilter !== 'all' && item.category !== categoryFilter) return false;
    return true;
  });

  const openModal = (tab = 'all', category = 'all') => {
    setActiveTab(tab);
    setCategoryFilter(category);
    setIsModalOpen(true);
  };

  const handleMediaClick = (item) => {
    if (item.type === 'video') {
      setTheaterVideo(item);
    } else {
      const pIndex = photos.findIndex(p => p.id === item.id || p.url === item.url);
      setLightboxIndex(pIndex >= 0 ? pIndex : 0);
    }
  };

  return (
    <div className="my-6">
      {/* ─── INLINE COMPACT MEDIA CAPSULE (Clean, High-End Bento Preview) ─── */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {/* 1. Featured Video Capsule */}
        {featuredVideo ? (
          <div
            onClick={() => handleMediaClick(featuredVideo)}
            className="group relative flex cursor-pointer items-center justify-between overflow-hidden rounded-2xl border border-white/10 bg-[#171717] p-3 shadow-lg transition-all duration-300 hover:border-brand/40 hover:bg-[#1c1c1c]"
          >
            <div className="flex items-center gap-3.5 min-w-0">
              <div className="relative h-16 w-24 shrink-0 overflow-hidden rounded-xl bg-black">
                <img
                  src={featuredVideo.thumbnail}
                  alt=""
                  className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                />
                <span className="absolute inset-0 grid place-items-center bg-black/30">
                  <span className="grid h-8 w-8 place-items-center rounded-full bg-brand/90 text-white shadow-md transition group-hover:scale-110">
                    <Icon icon="solar:play-bold" width="16" />
                  </span>
                </span>
                {featuredVideo.duration && (
                  <span className="absolute bottom-1 right-1 rounded bg-black/80 px-1.5 py-0.2 text-[9px] font-black text-white">
                    {featuredVideo.duration}
                  </span>
                )}
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-[9px] font-black uppercase tracking-wider text-brand">
                    {featuredVideo.category?.replaceAll('_', ' ') || 'Showreel'}
                  </span>
                  {featuredVideo.year && <span className="text-[10px] text-text-muted">· {featuredVideo.year}</span>}
                </div>
                <h4 className="mt-0.5 truncate text-xs font-black text-text-primary group-hover:text-brand">
                  {featuredVideo.title}
                </h4>
                {featuredVideo.character_name && (
                  <p className="truncate text-[10px] text-text-muted">as {featuredVideo.character_name}</p>
                )}
              </div>
            </div>

            {/* Video Counter Pill */}
            {videos.length > 1 && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); openModal('videos'); }}
                className="ml-2 shrink-0 rounded-xl border border-white/10 bg-white/[.04] px-2.5 py-1.5 text-[10px] font-black text-text-muted transition hover:border-brand hover:text-brand"
              >
                +{videos.length - 1} reels
              </button>
            )}
          </div>
        ) : null}

        {/* 2. Featured Photo Gallery Capsule */}
        {featuredPhoto ? (
          <div
            onClick={() => handleMediaClick(featuredPhoto)}
            className="group relative flex cursor-pointer items-center justify-between overflow-hidden rounded-2xl border border-white/10 bg-[#171717] p-3 shadow-lg transition-all duration-300 hover:border-brand/40 hover:bg-[#1c1c1c]"
          >
            <div className="flex items-center gap-3.5 min-w-0">
              <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-black">
                <img
                  src={featuredPhoto.thumbnail || featuredPhoto.url}
                  alt=""
                  className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                />
                <span className="absolute left-1 top-1 rounded bg-black/70 px-1 py-0.2 text-[8px] font-black uppercase text-white backdrop-blur-sm">
                  {featuredPhoto.category?.replaceAll('_', ' ') || 'Photo'}
                </span>
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-[9px] font-black uppercase tracking-wider text-brand">Portfolio</span>
                  {featuredPhoto.year && <span className="text-[10px] text-text-muted">· {featuredPhoto.year}</span>}
                </div>
                <h4 className="mt-0.5 truncate text-xs font-black text-text-primary group-hover:text-brand">
                  {featuredPhoto.title}
                </h4>
                {featuredPhoto.photographer ? (
                  <p className="truncate text-[10px] text-text-muted">📷 {featuredPhoto.photographer}</p>
                ) : (
                  <p className="text-[10px] text-text-muted">Verified Portfolio Capture</p>
                )}
              </div>
            </div>

            {/* Photos Counter Button */}
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); openModal('photos'); }}
              className="ml-2 shrink-0 rounded-xl border border-white/10 bg-white/[.04] px-2.5 py-1.5 text-[10px] font-black text-text-muted transition hover:border-brand hover:text-brand"
            >
              +{photos.length} photos
            </button>
          </div>
        ) : null}
      </div>

      {/* ─── FULLSCREEN IMMERSIVE MEDIA HUB MODAL ─── */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/90 p-4 backdrop-blur-xl">
          <div className="relative flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-3xl border border-white/10 bg-[#121212] shadow-2xl">
            {/* Modal Header & Navigation */}
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 bg-[#171717] px-6 py-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[.25em] text-brand">Media & Performance Portfolio</p>
                <h2 className="text-lg font-black text-text-primary">{personName}</h2>
              </div>

              {/* Top Tabs */}
              <div className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/[.03] p-1">
                <button
                  onClick={() => { setActiveTab('all'); setCategoryFilter('all'); }}
                  className={`rounded-lg px-3 py-1.5 text-xs font-black transition ${
                    activeTab === 'all' ? 'bg-brand text-white' : 'text-text-muted hover:text-white'
                  }`}
                >
                  All ({allMedia.length})
                </button>
                <button
                  onClick={() => { setActiveTab('videos'); setCategoryFilter('all'); }}
                  className={`flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-black transition ${
                    activeTab === 'videos' ? 'bg-brand text-white' : 'text-text-muted hover:text-white'
                  }`}
                >
                  <Icon icon="solar:videocamera-record-bold" width="14" /> Reels ({videos.length})
                </button>
                <button
                  onClick={() => { setActiveTab('photos'); setCategoryFilter('all'); }}
                  className={`flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-black transition ${
                    activeTab === 'photos' ? 'bg-brand text-white' : 'text-text-muted hover:text-white'
                  }`}
                >
                  <Icon icon="solar:gallery-wide-bold" width="14" /> Photos ({photos.length})
                </button>
              </div>

              <button
                onClick={() => setIsModalOpen(false)}
                className="grid h-9 w-9 place-items-center rounded-full bg-white/[.05] text-text-muted hover:bg-white/10 hover:text-white"
              >
                <Icon icon="solar:close-circle-linear" width="22" />
              </button>
            </div>

            {/* Sub-Category Filter Chips */}
            <div className="flex overflow-x-auto gap-2 border-b border-white/5 bg-[#141414] px-6 py-3">
              {[
                { id: 'all', label: 'All Items' },
                { id: 'showreel', label: 'Showreels' },
                { id: 'monologue', label: 'Monologues' },
                { id: 'scene_clip', label: 'Scene Clips' },
                { id: 'headshot', label: 'Headshots' },
                { id: 'production_still', label: 'Production Stills' },
                { id: 'editorial', label: 'Editorial' },
                { id: 'red_carpet', label: 'Red Carpet' },
              ].map(cat => (
                <button
                  key={cat.id}
                  onClick={() => setCategoryFilter(cat.id)}
                  className={`shrink-0 rounded-lg px-3 py-1 text-[11px] font-black transition ${
                    categoryFilter === cat.id
                      ? 'bg-white/15 text-brand border border-brand/40'
                      : 'bg-white/[.02] text-text-muted hover:text-white'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>

            {/* Media Gallery Grid (Dynamic Ratio Auto-Fit) */}
            <div className="flex-1 overflow-y-auto p-6">
              {filteredModalMedia.length === 0 ? (
                <div className="py-16 text-center text-xs text-text-muted">
                  No media items match the selected filter.
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
                  {filteredModalMedia.map((item) => {
                    const isVideo = item.type === 'video';
                    return (
                      <article
                        key={item.id || item.url}
                        onClick={() => handleMediaClick(item)}
                        className="group relative cursor-pointer overflow-hidden rounded-2xl border border-white/10 bg-[#171717] shadow-lg transition duration-300 hover:-translate-y-1 hover:border-brand"
                      >
                        {/* Dynamic Aspect Ratio Container */}
                        <div className={`relative w-full overflow-hidden bg-black ${
                          isVideo ? 'aspect-video' : item.aspect_ratio === '1:1' ? 'aspect-square' : 'aspect-[3/4]'
                        }`}>
                          <img
                            src={item.thumbnail || item.url}
                            alt={item.title}
                            className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                            loading="lazy"
                          />

                          {/* Play overlay for video */}
                          {isVideo && (
                            <div className="absolute inset-0 grid place-items-center bg-black/30 transition group-hover:bg-black/50">
                              <span className="grid h-10 w-10 place-items-center rounded-full bg-brand/90 text-white shadow-xl transition group-hover:scale-110">
                                <Icon icon="solar:play-bold" width="18" />
                              </span>
                            </div>
                          )}

                          {/* Category Badge */}
                          <span className="absolute left-2 top-2 rounded-md bg-black/70 px-2 py-0.5 text-[8px] font-black uppercase text-white backdrop-blur-md">
                            {item.category?.replaceAll('_', ' ') || item.type}
                          </span>

                          {isVideo && item.duration && (
                            <span className="absolute bottom-2 right-2 rounded bg-black/80 px-1.5 py-0.2 text-[9px] font-black text-white">
                              {item.duration}
                            </span>
                          )}
                        </div>

                        {/* Title & Metadata */}
                        <div className="p-3">
                          <h4 className="truncate text-xs font-black text-text-primary group-hover:text-brand">
                            {item.title}
                          </h4>
                          {item.character_name && (
                            <p className="truncate text-[10px] text-brand">as {item.character_name}</p>
                          )}
                          {item.photographer && (
                            <p className="truncate text-[10px] text-text-muted">📷 {item.photographer}</p>
                          )}
                          {item.film_title && (
                            <p className="truncate text-[10px] text-text-muted">Film: {item.film_title}</p>
                          )}
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ─── FULLSCREEN VIDEO THEATER MODAL ─── */}
      {theaterVideo && (
        <ProVideoTheaterModal
          video={theaterVideo}
          onClose={() => setTheaterVideo(null)}
        />
      )}

      {/* ─── FULLSCREEN PHOTO LIGHTBOX WITH PREV / NEXT ─── */}
      {lightboxIndex !== null && photos[lightboxIndex] && (
        <div
          onClick={() => setLightboxIndex(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 p-4 backdrop-blur-2xl"
        >
          {/* Lightbox Navigation Buttons */}
          {photos.length > 1 && (
            <>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setLightboxIndex((lightboxIndex - 1 + photos.length) % photos.length);
                }}
                className="absolute left-4 top-1/2 -translate-y-1/2 grid h-12 w-12 place-items-center rounded-full bg-white/10 text-white backdrop-blur-md hover:bg-white/20"
              >
                <Icon icon="solar:arrow-left-bold" width="22" />
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setLightboxIndex((lightboxIndex + 1) % photos.length);
                }}
                className="absolute right-4 top-1/2 -translate-y-1/2 grid h-12 w-12 place-items-center rounded-full bg-white/10 text-white backdrop-blur-md hover:bg-white/20"
              >
                <Icon icon="solar:arrow-right-bold" width="22" />
              </button>
            </>
          )}

          <div className="relative max-h-[90vh] max-w-4xl" onClick={(e) => e.stopPropagation()}>
            <img
              src={photos[lightboxIndex].url}
              alt={photos[lightboxIndex].title}
              className="max-h-[80vh] w-auto rounded-2xl object-contain shadow-2xl"
            />
            <div className="mt-3 flex items-center justify-between text-xs text-white">
              <div>
                <p className="font-black text-sm">{photos[lightboxIndex].title}</p>
                <p className="text-[11px] text-text-muted mt-0.5">
                  {photos[lightboxIndex].category?.replaceAll('_', ' ').toUpperCase()}
                  {photos[lightboxIndex].photographer && ` · Photo by ${photos[lightboxIndex].photographer}`}
                  {photos[lightboxIndex].year && ` · ${photos[lightboxIndex].year}`}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-text-muted text-[11px]">{lightboxIndex + 1} / {photos.length}</span>
                <button
                  onClick={() => setLightboxIndex(null)}
                  className="rounded-xl bg-white/10 px-4 py-2 font-black hover:bg-white/20"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
