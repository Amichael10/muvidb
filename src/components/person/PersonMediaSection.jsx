import { useState, useMemo } from 'react';
import PersonVideosCarousel from './PersonVideosCarousel';
import PersonPhotosGrid from './PersonPhotosGrid';
import PersonVideoPlayerModal from './PersonVideoPlayerModal';
import PersonPhotoLightboxModal from './PersonPhotoLightboxModal';
import AddPersonMediaModal from './AddPersonMediaModal';

export default function PersonMediaSection({
  person,
  media = [],
  canManage = false,
  onMediaAdded,
}) {
  const [activeVideo, setActiveVideo] = useState(null);
  const [activePhoto, setActivePhoto] = useState(null);
  const [addMediaType, setAddMediaType] = useState(null); // 'video' | 'photo' | null

  // Separate videos and photos
  const { videos, photos } = useMemo(() => {
    const list = Array.isArray(media) ? media : [];
    const vids = list
      .filter((m) => m.media_type === 'video' && m.status === 'approved')
      .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
    const pics = list
      .filter((m) => m.media_type === 'photo' && m.status === 'approved')
      .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));

    return { videos: vids, photos: pics };
  }, [media]);

  const hasVideos = videos.length > 0;
  const hasPhotos = photos.length > 0;
  const hasAnyMedia = hasVideos || hasPhotos;

  // Strict conditional rendering: If zero media, completely collapse section
  if (!hasAnyMedia) {
    return null;
  }

  return (
    <section className="p-4 md:p-8 lg:p-12 border-b border-border space-y-12">
      {/* Top Media Header (if both or either present) */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <p className="text-brand text-[10px] font-black uppercase tracking-[0.22em] mb-1.5">
            IMDb-Style Media Showcase
          </p>
          <h2 className="text-text-primary text-3xl font-bold font-heading tracking-tighter">
            Photos & Videos
          </h2>
        </div>

        {canManage && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setAddMediaType('video')}
              className="px-4 py-2 rounded-lg bg-surface border border-border hover:border-brand text-text-primary hover:text-brand text-xs font-bold transition-all"
            >
              + Add Video
            </button>
            <button
              onClick={() => setAddMediaType('photo')}
              className="px-4 py-2 rounded-lg bg-surface border border-border hover:border-brand text-text-primary hover:text-brand text-xs font-bold transition-all"
            >
              + Add Photo
            </button>
          </div>
        )}
      </div>

      {/* Videos Section */}
      {hasVideos && (
        <PersonVideosCarousel
          videos={videos}
          onPlayVideo={(vid) => setActiveVideo(vid)}
          onAddMedia={(type) => setAddMediaType(type)}
          canManage={canManage}
        />
      )}

      {/* Photos Section */}
      {hasPhotos && (
        <PersonPhotosGrid
          photos={photos}
          onSelectPhoto={(pic) => setActivePhoto(pic)}
          onAddMedia={(type) => setAddMediaType(type)}
          canManage={canManage}
        />
      )}

      {/* Theater-Mode Video Player Modal */}
      {activeVideo && (
        <PersonVideoPlayerModal
          video={activeVideo}
          videos={videos}
          onClose={() => setActiveVideo(null)}
          onSelectVideo={(v) => setActiveVideo(v)}
        />
      )}

      {/* Fullscreen Photo Lightbox Modal */}
      {activePhoto && (
        <PersonPhotoLightboxModal
          photo={activePhoto}
          photos={photos}
          onClose={() => setActivePhoto(null)}
          onSelectPhoto={(p) => setActivePhoto(p)}
        />
      )}

      {/* Add Media Modal */}
      {addMediaType && (
        <AddPersonMediaModal
          person={person}
          initialType={addMediaType}
          onClose={() => setAddMediaType(null)}
          onMediaAdded={(newMedia) => {
            onMediaAdded?.(newMedia);
          }}
        />
      )}
    </section>
  );
}
