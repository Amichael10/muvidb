import { useRef } from 'react';
import { Icon } from '@iconify/react';
import { formatFilmTitle, toTitleCase } from '../../utils/format';

function formatDuration(seconds) {
  if (!seconds) return null;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

const CATEGORY_STYLES = {
  showreel: { label: 'Showreel', badge: 'bg-purple-500/20 text-purple-400 border-purple-500/30' },
  monologue: { label: 'Monologue', badge: 'bg-amber-500/20 text-amber-400 border-amber-500/30' },
  scene_clip: { label: 'Scene Clip', badge: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
  interview: { label: 'Interview', badge: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' },
  behind_the_scenes: { label: 'Behind the Scenes', badge: 'bg-rose-500/20 text-rose-400 border-rose-500/30' },
  red_carpet: { label: 'Red Carpet', badge: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' },
};

export default function PersonVideosCarousel({
  videos = [],
  onPlayVideo,
  onAddMedia,
  canManage = false,
}) {
  const scrollRef = useRef(null);

  if (!videos || videos.length === 0) return null;

  const scroll = (direction) => {
    if (scrollRef.current) {
      const scrollAmount = direction === 'left' ? -360 : 360;
      scrollRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  };

  return (
    <div className="space-y-4">
      {/* Section Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <h3 className="font-heading font-bold text-2xl text-text-primary tracking-tight flex items-center gap-2">
            <span>Videos & Showreels</span>
            <span className="text-text-muted text-sm font-semibold">({videos.length})</span>
          </h3>
        </div>

        <div className="flex items-center gap-2">
          {canManage && (
            <button
              onClick={() => onAddMedia?.('video')}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-brand hover:underline px-2.5 py-1 rounded-md bg-brand/10 border border-brand/20 transition-colors"
            >
              <Icon icon="solar:add-circle-linear" width="14" />
              <span>Add Video</span>
            </button>
          )}

          {videos.length > 2 && (
            <div className="flex items-center gap-1">
              <button
                onClick={() => scroll('left')}
                className="w-8 h-8 rounded-lg border border-border bg-surface hover:bg-surface-2 flex items-center justify-center text-text-muted hover:text-text-primary transition-colors"
                aria-label="Scroll videos left"
              >
                <Icon icon="solar:alt-arrow-left-linear" width="16" />
              </button>
              <button
                onClick={() => scroll('right')}
                className="w-8 h-8 rounded-lg border border-border bg-surface hover:bg-surface-2 flex items-center justify-center text-text-muted hover:text-text-primary transition-colors"
                aria-label="Scroll videos right"
              >
                <Icon icon="solar:alt-arrow-right-linear" width="16" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Videos Horizontal Carousel */}
      <div
        ref={scrollRef}
        className="flex gap-4 overflow-x-auto no-scrollbar snap-x snap-mandatory pb-2 pt-1"
      >
        {videos.map((vid) => {
          const categoryMeta = CATEGORY_STYLES[vid.category] || {
            label: toTitleCase(vid.category || 'Video'),
            badge: 'bg-surface-2 text-text-secondary border-border',
          };
          const thumbnail = vid.thumbnail_url || (vid.embed_id ? `https://img.youtube.com/vi/${vid.embed_id}/hqdefault.jpg` : null);

          return (
            <div
              key={vid.id}
              onClick={() => onPlayVideo(vid)}
              className="group w-64 sm:w-72 md:w-80 shrink-0 snap-start cursor-pointer flex flex-col"
            >
              {/* Thumbnail Container */}
              <div className="relative aspect-video rounded-xl overflow-hidden border border-border bg-surface-2 group-hover:border-brand transition-all duration-300 shadow-md">
                {thumbnail ? (
                  <img
                    src={thumbnail}
                    alt={vid.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    loading="lazy"
                  />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center bg-surface-2 text-text-muted">
                    <Icon icon="solar:videocamera-record-linear" width="32" className="opacity-40" />
                  </div>
                )}

                {/* Dark gradient shadow */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/30 pointer-events-none" />

                {/* Top Category Badge */}
                <div className="absolute top-2.5 left-2.5 z-10">
                  <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded border ${categoryMeta.badge}`}>
                    {categoryMeta.label}
                  </span>
                </div>

                {/* Duration Badge */}
                {vid.duration_seconds > 0 && (
                  <div className="absolute bottom-2.5 right-2.5 z-10 bg-black/80 backdrop-blur-sm text-white text-[10px] font-bold px-1.5 py-0.5 rounded border border-white/10">
                    {formatDuration(vid.duration_seconds)}
                  </div>
                )}

                {/* Play Button Overlay */}
                <div className="absolute inset-0 flex items-center justify-center z-10">
                  <div className="w-11 h-11 rounded-full bg-brand/90 group-hover:bg-brand text-white flex items-center justify-center shadow-xl group-hover:scale-110 transition-transform duration-300">
                    <Icon icon="solar:play-bold" width="20" className="ml-0.5" />
                  </div>
                </div>
              </div>

              {/* Text Info */}
              <div className="mt-2.5 space-y-1">
                <h4 className="font-heading font-bold text-sm text-text-primary group-hover:text-brand transition-colors line-clamp-1">
                  {vid.title}
                </h4>
                {vid.films ? (
                  <p className="text-xs text-text-muted line-clamp-1">
                    from <span className="text-text-secondary font-medium">{formatFilmTitle(vid.films.title)}</span>
                    {vid.character_name ? ` as ${toTitleCase(vid.character_name)}` : ''}
                  </p>
                ) : vid.description ? (
                  <p className="text-xs text-text-muted line-clamp-1">
                    {vid.description}
                  </p>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
