import { Icon } from '@iconify/react';

export default function ProVideoTheaterModal({ video, onClose }) {
  if (!video) return null;

  const isYouTube = video.embed_provider === 'youtube' || video.url?.includes('youtube.com') || video.url?.includes('youtu.be');
  const isVimeo = video.embed_provider === 'vimeo' || video.url?.includes('vimeo.com');
  const isDirect = video.embed_provider === 'r2' || (!isYouTube && !isVimeo);

  let embedSrc = '';
  if (isYouTube) {
    const id = video.embed_id || video.url?.match(/(?:v=|youtu\.be\/)([\w-]+)/)?.[1];
    embedSrc = `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0`;
  } else if (isVimeo) {
    const id = video.embed_id || video.url?.match(/vimeo\.com\/(\d+)/)?.[1];
    embedSrc = `https://player.vimeo.com/video/${id}?autoplay=1`;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4 backdrop-blur-lg">
      <div className="relative flex max-h-[95vh] w-full max-w-4xl flex-col overflow-hidden rounded-3xl border border-white/10 bg-[#121212] shadow-2xl">
        {/* Top bar */}
        <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
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
            onClick={onClose}
            className="grid h-9 w-9 place-items-center rounded-full bg-white/[.05] text-text-muted hover:bg-white/10 hover:text-white"
          >
            <Icon icon="solar:close-circle-linear" width="22" />
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
