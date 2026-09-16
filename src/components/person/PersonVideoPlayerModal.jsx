import { useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from '@iconify/react';
import { formatFilmTitle, toTitleCase } from '../../utils/format';

function formatDuration(seconds) {
  if (!seconds) return null;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

const CATEGORY_LABELS = {
  showreel: 'Showreel',
  monologue: 'Monologue',
  scene_clip: 'Scene Clip',
  interview: 'Interview',
  behind_the_scenes: 'Behind the Scenes',
  red_carpet: 'Red Carpet',
};

export default function PersonVideoPlayerModal({
  video,
  videos = [],
  onClose,
  onSelectVideo,
}) {
  const currentIndex = videos.findIndex((v) => v.id === video?.id);
  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex >= 0 && currentIndex < videos.length - 1;

  const handlePrev = useCallback(() => {
    if (hasPrev && onSelectVideo) {
      onSelectVideo(videos[currentIndex - 1]);
    }
  }, [hasPrev, currentIndex, videos, onSelectVideo]);

  const handleNext = useCallback(() => {
    if (hasNext && onSelectVideo) {
      onSelectVideo(videos[currentIndex + 1]);
    }
  }, [hasNext, currentIndex, videos, onSelectVideo]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') handlePrev();
      if (e.key === 'ArrowRight') handleNext();
    };
    window.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'unset';
    };
  }, [onClose, handlePrev, handleNext]);

  if (!video) return null;

  // Determine video embed or direct stream
  const getEmbedSource = () => {
    const provider = video.embed_provider || '';
    const embedId = video.embed_id;
    const url = video.url || '';

    // Direct YouTube URL or provider
    if (provider === 'youtube' || url.includes('youtube.com') || url.includes('youtu.be')) {
      const id =
        embedId ||
        (url.includes('v=')
          ? url.split('v=')[1]?.split('&')[0]
          : url.split('youtu.be/')[1]?.split('?')[0]);
      if (id) {
        return {
          type: 'iframe',
          src: `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0&modestbranding=1`,
        };
      }
    }

    // Vimeo
    if (provider === 'vimeo' || url.includes('vimeo.com')) {
      const id = embedId || url.split('vimeo.com/')[1]?.split('?')[0];
      if (id) {
        return {
          type: 'iframe',
          src: `https://player.vimeo.com/video/${id}?autoplay=1&title=0&byline=0`,
        };
      }
    }

    // Direct Video (R2 / MP4 / WebM)
    return {
      type: 'video',
      src: url,
    };
  };

  const embed = getEmbedSource();
  const linkedFilm = video.films;
  const categoryLabel = CATEGORY_LABELS[video.category] || toTitleCase(video.category || 'Video');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/90 backdrop-blur-md animate-fade-in">
      {/* Background Overlay */}
      <div className="absolute inset-0" onClick={onClose} />

      {/* Main Player Dialog */}
      <div className="relative z-10 w-full max-w-5xl bg-surface border border-border rounded-2xl overflow-hidden shadow-2xl flex flex-col max-h-[92vh]">
        {/* Header Bar */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-border bg-surface-2/60">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="bg-brand/10 text-brand border border-brand/20 text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-md shrink-0">
              {categoryLabel}
            </span>
            <h3 className="font-heading font-bold text-base text-text-primary truncate">
              {video.title}
            </h3>
            {video.duration_seconds > 0 && (
              <span className="text-xs text-text-muted font-bold shrink-0">
                • {formatDuration(video.duration_seconds)}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Playlist Nav */}
            {videos.length > 1 && (
              <div className="flex items-center gap-1 bg-surface border border-border rounded-lg p-0.5 mr-2">
                <button
                  onClick={handlePrev}
                  disabled={!hasPrev}
                  className="p-1.5 rounded text-text-muted hover:text-text-primary hover:bg-surface-2 disabled:opacity-30 disabled:pointer-events-none transition-colors"
                  title="Previous video (←)"
                >
                  <Icon icon="solar:alt-arrow-left-linear" width="16" />
                </button>
                <span className="text-[10px] font-bold text-text-muted px-1">
                  {currentIndex + 1} / {videos.length}
                </span>
                <button
                  onClick={handleNext}
                  disabled={!hasNext}
                  className="p-1.5 rounded text-text-muted hover:text-text-primary hover:bg-surface-2 disabled:opacity-30 disabled:pointer-events-none transition-colors"
                  title="Next video (→)"
                >
                  <Icon icon="solar:alt-arrow-right-linear" width="16" />
                </button>
              </div>
            )}

            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg border border-border hover:border-brand hover:text-brand bg-surface flex items-center justify-center text-text-muted transition-colors"
              aria-label="Close video player"
            >
              <Icon icon="solar:close-circle-linear" width="18" />
            </button>
          </div>
        </div>

        {/* Video Canvas */}
        <div className="relative w-full aspect-video bg-black flex items-center justify-center overflow-hidden">
          {embed.type === 'iframe' ? (
            <iframe
              src={embed.src}
              title={video.title}
              className="w-full h-full border-0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
            />
          ) : (
            <video
              src={embed.src}
              controls
              autoPlay
              className="w-full h-full object-contain"
            >
              Your browser does not support the video tag.
            </video>
          )}
        </div>

        {/* Video Metadata & Linked Film Footer */}
        <div className="p-5 bg-surface flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-t border-border overflow-y-auto">
          <div className="space-y-1.5 flex-1 min-w-0">
            <h4 className="font-heading font-bold text-lg text-text-primary">
              {video.title}
            </h4>
            {video.description && (
              <p className="text-text-muted text-xs leading-relaxed max-w-2xl line-clamp-2">
                {video.description}
              </p>
            )}
            {video.year && (
              <p className="text-text-secondary text-[11px] font-bold">
                Year: {video.year}
              </p>
            )}
          </div>

          {/* Context-Aware Tagged Film Card */}
          {linkedFilm && (
            <Link
              to={`/films/${linkedFilm.slug || linkedFilm.id}`}
              onClick={onClose}
              className="group flex items-center gap-3 p-2.5 rounded-xl border border-border bg-surface-2/60 hover:border-brand transition-colors shrink-0 max-w-full sm:max-w-xs"
            >
              {linkedFilm.poster_url && (
                <img
                  src={linkedFilm.poster_url}
                  alt={linkedFilm.title}
                  className="w-10 h-14 object-cover rounded-md border border-border group-hover:scale-105 transition-transform"
                />
              )}
              <div className="min-w-0">
                <span className="text-[9px] font-black uppercase text-brand tracking-widest block">
                  Featured Movie
                </span>
                <p className="text-xs font-bold text-text-primary truncate group-hover:text-brand transition-colors">
                  {formatFilmTitle(linkedFilm.title)} {linkedFilm.year ? `(${linkedFilm.year})` : ''}
                </p>
                {video.character_name && (
                  <p className="text-[11px] text-text-muted truncate">
                    as <span className="text-text-secondary font-semibold">{toTitleCase(video.character_name)}</span>
                  </p>
                )}
              </div>
              <Icon icon="solar:alt-arrow-right-linear" className="text-text-muted group-hover:text-brand transition-colors ml-auto text-sm shrink-0" />
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
