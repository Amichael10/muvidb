import { useState, useMemo } from 'react';
import { Icon } from '@iconify/react';
import ProVideoTheaterModal from '../professional/ProVideoTheaterModal';

export default function PersonHeroMediaShowcase({
  photoUrl,
  personName = 'Actor',
  highlights = [],
  credits = [],
  knownFor = [],
  className = ''
}) {
  const [theaterVideo, setTheaterVideo] = useState(null);
  const [activeTab, setActiveTab] = useState('all'); // 'all' | 'videos' | 'photos'
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [isGalleryOpen, setIsGalleryOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(null);

  // Normalize highlights + Smart fallback from top film credits / trailers
  const { photos, videos, allMedia } = useMemo(() => {
    const p = [];
    const v = [];

    // 1. Process custom uploaded highlights / reels
    if (highlights && Array.isArray(highlights)) {
      highlights.forEach((item, idx) => {
        if (!item) return;

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
        } else if (typeof item === 'string' && item.trim().length > 0) {
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
    }

    // 2. SMART FALLBACK: If actor has no custom video reels, pull trailers from their filmography
    if (v.length === 0) {
      const filmPool = [...(knownFor || []), ...(credits || [])];
      const seenFilms = new Set();

      filmPool.forEach((c) => {
        const film = c.films || c;
        if (!film || seenFilms.has(film.id)) return;
        seenFilms.add(film.id);

        const trailerUrl = film.trailer_url || film.trailer;
        const ytId = film.youtube_id || (trailerUrl?.match(/(?:youtu\.be\/|v=|\/embed\/)([\w-]{11})/)?.[1]);

        if (ytId || trailerUrl) {
          v.push({
            id: `film_trailer_${film.id}`,
            type: 'video',
            category: 'trailer',
            title: `Trailer · ${film.title || 'Featured Film'}`,
            url: trailerUrl || `https://www.youtube.com/watch?v=${ytId}`,
            thumbnail: film.backdrop_url || film.poster_url || 'https://images.unsplash.com/photo-1485846234645-a62644f84728?auto=format&fit=crop&w=800&q=80',
            embed_provider: 'youtube',
            embed_id: ytId,
            film_title: film.title,
            character_name: c.character_name || null,
            year: film.release_year || null,
            is_featured: v.length === 0
          });
        }
      });
    }

    // 3. SMART FALLBACK: If actor has no custom photos, pull high-res film backdrops/stills
    if (p.length === 0) {
      const filmPool = [...(knownFor || []), ...(credits || [])];
      const seenPhotos = new Set();

      filmPool.forEach((c) => {
        const film = c.films || c;
        if (!film || !film.backdrop_url || seenPhotos.has(film.backdrop_url)) return;
        seenPhotos.add(film.backdrop_url);

        p.push({
          id: `film_backdrop_${film.id}`,
          type: 'photo',
          category: 'production_still',
          title: `Still from "${film.title}"`,
          url: film.backdrop_url,
          thumbnail: film.backdrop_url,
          year: film.release_year || null,
          aspect_ratio: '16:9'
        });
      });
    }

    return { photos: p, videos: v, allMedia: [...v, ...p] };
  }, [highlights, credits, knownFor]);

  const featuredVideo = videos.find(v => v.is_featured) || videos[0] || null;
  const secondaryPhoto = photos.find(p => !p.is_primary) || photos[1] || photos[0] || null;
  const secondaryVideo = videos.find(v => v !== featuredVideo) || null;

  const hasVideos = videos.length > 0;
  const hasPhotos = photos.length > 0;
  const hasMedia = hasVideos || hasPhotos;

  // If completely NO media and NO trailers/photos found in filmography, collapse gracefully
  if (!hasMedia) {
    return (
      <div className={`flex flex-col sm:flex-row gap-6 items-start ${className}`}>
        <div className="relative aspect-[3/4] w-48 shrink-0 overflow-hidden rounded-2xl border border-white/10 bg-[#161616] shadow-2xl">
          <img
            src={photoUrl || '/images/person-placeholder.png'}
            alt={personName}
            className="h-full w-full object-cover"
            loading="eager"
          />
          <div className="absolute bottom-3 left-3 z-10 flex h-8 w-8 select-none items-center justify-center rounded-full border border-white/40 bg-white/80 p-1 backdrop-blur-md shadow-lg">
            <img src="/images/muvidb-icon-watermark.png" alt="" className="h-full w-full object-contain" />
          </div>
        </div>
      </div>
    );
  }

  const openGallery = (tab = 'all', category = 'all') => {
    setActiveTab(tab);
    setCategoryFilter(category);
    setIsGalleryOpen(true);
  };

  const handleMediaClick = (item) => {
    if (item.type === 'video') {
      setTheaterVideo(item);
    } else {
      const pIndex = photos.findIndex(p => p.id === item.id || p.url === item.url);
      setLightboxIndex(pIndex >= 0 ? pIndex : 0);
    }
  };

  const filteredModalMedia = allMedia.filter(item => {
    if (activeTab === 'videos' && item.type !== 'video') return false;
    if (activeTab === 'photos' && item.type !== 'photo') return false;
    if (categoryFilter !== 'all' && item.category !== categoryFilter) return false;
    return true;
  });

  return (
    <div className={`w-full select-none ${className}`}>
      {/* ─── MUVIDB PREMIUM HERO MEDIA SHOWCASE ─── */}
      <div className="grid grid-cols-1 gap-3.5 md:grid-cols-12">
        {/* PANE 1: Portrait Avatar with Glass Frame */}
        <div className={`group relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-b from-[#1c1c1c] to-[#121212] p-1.5 shadow-2xl transition-all duration-300 hover:border-brand/40 ${
          hasVideos && hasPhotos
            ? 'md:col-span-4 lg:col-span-3'
            : hasVideos || hasPhotos
            ? 'md:col-span-4'
            : 'md:col-span-4'
        }`}>
          <div className="relative aspect-[3/4] w-full overflow-hidden rounded-xl bg-black">
            <img
              src={photoUrl || '/images/person-placeholder.png'}
              alt={personName}
              className="h-full w-full object-cover transition duration-700 group-hover:scale-105"
              loading="eager"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/20 pointer-events-none" />

            {/* Bottom-left MuviDB icon seal */}
            <div className="absolute bottom-3 left-3 z-10 flex h-8 w-8 select-none items-center justify-center rounded-full border border-white/40 bg-white/85 p-1 backdrop-blur-md shadow-xl">
              <img src="/images/muvidb-icon-watermark.png" alt="" className="h-full w-full object-contain" />
            </div>

            {/* Primary Portrait Badge */}
            <div className="absolute top-3 left-3 z-10">
              <span className="rounded-full bg-black/65 px-2.5 py-1 text-[9px] font-black uppercase tracking-wider text-white/90 backdrop-blur-md border border-white/10">
                Official Headshot
              </span>
            </div>
          </div>
        </div>

        {/* PANE 2: Cinematic Video Player (Glass Hero with Bottom-Left Action Anchor) */}
        {featuredVideo ? (
          <div
            onClick={() => setTheaterVideo(featuredVideo)}
            className={`group relative flex cursor-pointer flex-col justify-end overflow-hidden rounded-2xl border border-white/10 bg-[#141414] shadow-2xl transition-all duration-300 hover:border-brand/60 hover:shadow-brand/10 ${
              hasPhotos ? 'md:col-span-5 lg:col-span-6' : 'md:col-span-8'
            }`}
          >
            {/* Backdrop Image */}
            <div className="relative aspect-video w-full overflow-hidden bg-black">
              <img
                src={featuredVideo.thumbnail}
                alt={featuredVideo.title}
                className="h-full w-full object-cover transition duration-700 group-hover:scale-105 group-hover:opacity-90"
              />

              {/* Dynamic Vignette & Lighting Gradient */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/30 to-black/40" />

              {/* Top Bar inside Player */}
              <div className="absolute top-3.5 left-3.5 right-3.5 flex items-center justify-between z-10">
                <span className="flex items-center gap-1.5 rounded-full bg-brand/90 px-3 py-1 text-[9px] font-black uppercase tracking-wider text-white shadow-lg backdrop-blur-md">
                  <span className="h-1.5 w-1.5 rounded-full bg-white animate-ping" />
                  {featuredVideo.category?.replaceAll('_', ' ') || 'Performance Reel'}
                </span>

                <span className="grid h-8 w-8 place-items-center rounded-full bg-black/60 text-white/80 backdrop-blur-md transition group-hover:bg-brand group-hover:text-white">
                  <Icon icon="solar:maximize-square-3-linear" width="16" />
                </span>
              </div>

              {/* Bottom Cinema Action Bar (Hero Play Pill like IMDb but cleaner & with glowing brand energy) */}
              <div className="absolute bottom-3.5 left-3.5 right-3.5 flex items-center gap-3.5 z-10">
                {/* Glowing Play Circle */}
                <div className="relative grid h-12 w-12 sm:h-14 sm:w-14 shrink-0 place-items-center rounded-full bg-gradient-to-tr from-brand to-amber-500 text-white shadow-xl shadow-brand/30 transition duration-300 group-hover:scale-110">
                  <Icon icon="solar:play-bold" width="24" className="translate-x-0.5" />
                </div>

                {/* Video Info Label */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-heading text-sm sm:text-base font-black text-white tracking-tight group-hover:text-brand transition-colors">
                      Play {featuredVideo.category === 'trailer' ? 'Trailer' : 'Showreel'}
                    </p>
                    {featuredVideo.duration && (
                      <span className="rounded bg-black/70 px-1.5 py-0.5 text-[9px] font-bold text-text-muted border border-white/10">
                        {featuredVideo.duration}
                      </span>
                    )}
                  </div>
                  <p className="truncate text-xs text-text-muted mt-0.5 font-medium">
                    {featuredVideo.title} {featuredVideo.film_title ? `· ${featuredVideo.film_title}` : ''}
                  </p>
                </div>
              </div>
            </div>
          </div>
        ) : null}

        {/* PANE 3: Distinctive Media Stack (Full-Height Visual Bento Tiles) */}
        {hasPhotos && (
          <div className={`flex flex-col gap-3.5 ${hasVideos ? 'md:col-span-3' : 'md:col-span-8'}`}>
            {/* Tile 1: Photos & Stills Gallery Box */}
            <div
              onClick={() => openGallery('photos')}
              className="group relative flex flex-1 cursor-pointer flex-col justify-end overflow-hidden rounded-2xl border border-white/10 bg-[#151515] shadow-xl transition-all duration-300 hover:border-brand/50 hover:bg-[#1a1a1a] min-h-[130px]"
            >
              <img
                src={secondaryPhoto?.thumbnail || secondaryPhoto?.url || photoUrl}
                alt=""
                className="absolute inset-0 h-full w-full object-cover opacity-60 transition duration-700 group-hover:scale-105 group-hover:opacity-85"
              />
              <div className="relative z-10 bg-gradient-to-t from-black/95 via-black/60 to-transparent p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5 text-white">
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-brand/20 text-brand border border-brand/30 shadow-md">
                      <Icon icon="solar:gallery-wide-bold" width="18" />
                    </span>
                    <div>
                      <span className="font-heading text-xs sm:text-sm font-black tracking-wider uppercase block">
                        {photos.length} {photos.length === 1 ? 'Photo' : 'Photos'}
                      </span>
                      <p className="text-[10px] text-text-muted leading-tight">Headshots & stills</p>
                    </div>
                  </div>
                  <span className="grid h-7 w-7 place-items-center rounded-full bg-white/5 text-text-muted transition group-hover:bg-brand group-hover:text-white">
                    <Icon icon="solar:alt-arrow-right-linear" width="14" />
                  </span>
                </div>
              </div>
            </div>

            {/* Tile 2: Videos & Reels Box */}
            {hasVideos && (
              <div
                onClick={() => openGallery('videos')}
                className="group relative flex flex-1 cursor-pointer flex-col justify-end overflow-hidden rounded-2xl border border-white/10 bg-[#151515] shadow-xl transition-all duration-300 hover:border-brand/50 hover:bg-[#1a1a1a] min-h-[130px]"
              >
                <img
                  src={secondaryVideo?.thumbnail || featuredVideo?.thumbnail || '/images/film-placeholder.webp'}
                  alt=""
                  className="absolute inset-0 h-full w-full object-cover opacity-60 transition duration-700 group-hover:scale-105 group-hover:opacity-85"
                />
                <div className="relative z-10 bg-gradient-to-t from-black/95 via-black/60 to-transparent p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5 text-white">
                      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-red-500/20 text-red-400 border border-red-500/30 shadow-md">
                        <Icon icon="solar:videocamera-record-bold" width="18" />
                      </span>
                      <div>
                        <span className="font-heading text-xs sm:text-sm font-black tracking-wider uppercase block">
                          {videos.length} {videos.length === 1 ? 'Video' : 'Videos'}
                        </span>
                        <p className="text-[10px] text-text-muted leading-tight">Reels & trailers</p>
                      </div>
                    </div>
                    <span className="grid h-7 w-7 place-items-center rounded-full bg-white/5 text-text-muted transition group-hover:bg-brand group-hover:text-white">
                      <Icon icon="solar:alt-arrow-right-linear" width="14" />
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ─── FULLSCREEN IMMERSIVE MEDIA GALLERY DRAWER / LIGHTBOX ─── */}
      {isGalleryOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/90 p-4 backdrop-blur-2xl">
          <div className="relative flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-3xl border border-white/10 bg-[#121212] shadow-2xl">
            {/* Modal Navigation */}
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 bg-[#171717] px-6 py-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-brand">Portfolio Media Gallery</p>
                <h2 className="text-lg font-black text-text-primary">{personName}</h2>
              </div>

              {/* Tabs */}
              <div className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/[.03] p-1">
                <button
                  onClick={() => { setActiveTab('all'); setCategoryFilter('all'); }}
                  className={`rounded-lg px-3 py-1.5 text-xs font-black transition ${
                    activeTab === 'all' ? 'bg-brand text-white' : 'text-text-muted hover:text-white'
                  }`}
                >
                  All ({allMedia.length})
                </button>
                {videos.length > 0 && (
                  <button
                    onClick={() => { setActiveTab('videos'); setCategoryFilter('all'); }}
                    className={`flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-black transition ${
                      activeTab === 'videos' ? 'bg-brand text-white' : 'text-text-muted hover:text-white'
                    }`}
                  >
                    <Icon icon="solar:videocamera-record-bold" width="14" /> Reels & Trailers ({videos.length})
                  </button>
                )}
                {photos.length > 0 && (
                  <button
                    onClick={() => { setActiveTab('photos'); setCategoryFilter('all'); }}
                    className={`flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-black transition ${
                      activeTab === 'photos' ? 'bg-brand text-white' : 'text-text-muted hover:text-white'
                    }`}
                  >
                    <Icon icon="solar:gallery-wide-bold" width="14" /> Photos ({photos.length})
                  </button>
                )}
              </div>

              <button
                onClick={() => setIsGalleryOpen(false)}
                className="grid h-9 w-9 place-items-center rounded-full bg-white/[.05] text-text-muted hover:bg-white/10 hover:text-white"
              >
                <Icon icon="solar:close-circle-linear" width="22" />
              </button>
            </div>

            {/* Filter Chips */}
            <div className="flex overflow-x-auto gap-2 border-b border-white/5 bg-[#141414] px-6 py-3">
              {[
                { id: 'all', label: 'All Media' },
                { id: 'showreel', label: 'Showreels' },
                { id: 'trailer', label: 'Movie Trailers' },
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

            {/* Media Grid */}
            <div className="flex-1 overflow-y-auto p-6">
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
                {filteredModalMedia.map((item) => {
                  const isVideo = item.type === 'video';
                  return (
                    <article
                      key={item.id || item.url}
                      onClick={() => handleMediaClick(item)}
                      className="group relative cursor-pointer overflow-hidden rounded-2xl border border-white/10 bg-[#171717] shadow-lg transition duration-300 hover:-translate-y-1 hover:border-brand"
                    >
                      <div className={`relative w-full overflow-hidden bg-black ${
                        isVideo ? 'aspect-video' : item.aspect_ratio === '1:1' ? 'aspect-square' : 'aspect-[3/4]'
                      }`}>
                        <img
                          src={item.thumbnail || item.url}
                          alt={item.title}
                          className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                          loading="lazy"
                        />
                        {isVideo && (
                          <div className="absolute inset-0 grid place-items-center bg-black/30 transition group-hover:bg-black/50">
                            <span className="grid h-10 w-10 place-items-center rounded-full bg-brand/90 text-white shadow-xl transition group-hover:scale-110">
                              <Icon icon="solar:play-bold" width="18" />
                            </span>
                          </div>
                        )}
                        <span className="absolute left-2 top-2 rounded-md bg-black/70 px-2 py-0.5 text-[8px] font-black uppercase text-white backdrop-blur-md">
                          {item.category?.replaceAll('_', ' ') || item.type}
                        </span>
                      </div>
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
                      </div>
                    </article>
                  );
                })}
              </div>
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

      {/* ─── FULLSCREEN PHOTO LIGHTBOX ─── */}
      {lightboxIndex !== null && photos[lightboxIndex] && (
        <div
          onClick={() => setLightboxIndex(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 p-4 backdrop-blur-2xl"
        >
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
