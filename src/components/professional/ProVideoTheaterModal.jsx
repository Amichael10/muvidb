import { useEffect } from 'react';
import { Icon } from '@iconify/react';

export default function ProVideoTheaterModal({ video, onClose }) {
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  if (!video) return null;

  const isYouTube = video.embed_provider === 'youtube' || video.url?.includes('youtube.com') || video.url?.includes('youtu.be');
  const isVimeo = video.embed_provider === 'vimeo' || video.url?.includes('vimeo.com');
  const isGDrive = video.embed_provider === 'gdrive' || video.url?.includes('drive.google.com');
  const isDailymotion = video.embed_provider === 'dailymotion' || video.url?.includes('dailymotion.com') || video.url?.includes('dai.ly');
  const isDirect = video.embed_provider === 'r2' || (!isYouTube && !isVimeo && !isGDrive && !isDailymotion);

  let embedSrc = '';
  if (isYouTube) {
    const id = video.embed_id || video.url?.match(/(?:v=|youtu\.be\/|embed\/|shorts\/)([\w-]+)/)?.[1];
    embedSrc = `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0`;
  } else if (isVimeo) {
    const match = video.url?.match(/vimeo\.com\/(?:channels\/(?:\w+\/)?|groups\/([^\/]*)\/videos\/|album\/(\d+)\/video\/|video\/|)(\d+)/) || video.url?.match(/vimeo\.com\/(\d+)/);
    const id = video.embed_id || (match ? (match[3] || match[1] || match[0]) : null);
    embedSrc = `https://player.vimeo.com/video/${id}?autoplay=1`;
  } else if (isGDrive) {
    const match = video.url?.match(/\/file\/d\/([a-zA-Z0-9_-]+)/) || video.url?.match(/id=([a-zA-Z0-9_-]+)/);
    const id = video.embed_id || (match ? match[1] : null);
    embedSrc = id ? `https://drive.google.com/file/d/${id}/preview` : video.url;
  } else if (isDailymotion) {
    const match = video.url?.match(/(?:video\/|dai\.ly\/)([a-zA-Z0-9]+)/);
    const id = video.embed_id || (match ? match[1] : null);
    embedSrc = `https://www.dailymotion.com/embed/video/${id}?autoplay=1`;
  }

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/90 p-3 sm:p-4 backdrop-blur-lg overscroll-contain"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="relative my-auto flex max-h-[calc(100vh-1.5rem)] sm:max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl sm:rounded-3xl border border-white/10 bg-[#121212] shadow-2xl">
        {/* Top bar */}
        <div className="flex shrink-0 items-center justify-between border-b border-white/10 px-5 py-3.5 sm:px-6 sm:py-4">
          <div className="flex items-center gap-3">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand/10 text-brand">
              <Icon icon="solar:play-circle-bold" width="20" />
            </span>
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-brand">{video.category || 'Performance'}</p>
              <h3 className="truncate text-sm font-black text-text-primary md:text-base">{video.title}</h3>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close video player"
            className="grid h-8 w-8 place-items-center rounded-full bg-white/[.05] text-text-muted transition hover:bg-white/10 hover:text-white"
          >
            <Icon icon="solar:close-circle-linear" width="20" />
          </button>
        </div>

        {/* Video Player */}
        <div className="relative aspect-video w-full bg-black">
          {isDirect ? (
            <video
              src={video.url}
              controls
              autoPlay
              className="h-full w-full object-contain"
            />
          ) : (
            <iframe
              src={embedSrc}
              title={video.title}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              className="h-full w-full border-0"
            />
          )}
        </div>

        {/* Metadata Footer */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-t border-white/10 bg-[#171717] px-6 py-4 text-xs text-text-muted">
          <div className="flex items-center gap-4">
            {video.film_title && (
              <span>
                <Icon icon="solar:clapperboard-linear" className="mr-1.5 inline text-brand" />
                Tagged to: <strong className="text-text-primary">{video.film_title}</strong>
              </span>
            )}
            {video.character_name && (
              <span>
                <Icon icon="solar:user-bold" className="mr-1.5 inline text-brand" />
                Role: <strong className="text-text-primary">{video.character_name}</strong>
              </span>
            )}
            {video.year && <span>{video.year}</span>}
          </div>
          <a
            href={video.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-brand hover:underline"
          >
            Open source video <Icon icon="solar:external-link-linear" width="14" />
          </a>
        </div>
      </div>
    </div>
  );
}
