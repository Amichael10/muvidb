import { useState, useMemo } from 'react';
import { Icon } from '@iconify/react';
import { formatFilmTitle, toTitleCase } from '../../utils/format';

const CATEGORY_TABS = [
  { id: 'all', label: 'All Photos' },
  { id: 'headshot', label: 'Headshots' },
  { id: 'production_still', label: 'Production Stills' },
  { id: 'behind_the_scenes', label: 'Behind the Scenes' },
  { id: 'red_carpet', label: 'Events' },
];

export default function PersonPhotosGrid({
  photos = [],
  onSelectPhoto,
  onAddMedia,
  canManage = false,
}) {
  const [activeFilter, setActiveFilter] = useState('all');

  // Compute available categories
  const filteredPhotos = useMemo(() => {
    if (!photos) return [];
    if (activeFilter === 'all') return photos;
    return photos.filter((p) => p.category === activeFilter);
  }, [photos, activeFilter]);

  if (!photos || photos.length === 0) return null;

  return (
    <div className="space-y-4">
      {/* Header & Filter Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <h3 className="font-heading font-bold text-2xl text-text-primary tracking-tight flex items-center gap-2">
            <span>Photo Gallery</span>
            <span className="text-text-muted text-sm font-semibold">({photos.length})</span>
          </h3>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {canManage && (
            <button
              onClick={() => onAddMedia?.('photo')}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-brand hover:underline px-2.5 py-1 rounded-md bg-brand/10 border border-brand/20 transition-colors mr-1"
            >
              <Icon icon="solar:camera-add-linear" width="14" />
              <span>Add Photo</span>
            </button>
          )}

          {/* Filter Pills */}
          <div className="flex items-center gap-1 bg-surface border border-border rounded-lg p-1 overflow-x-auto no-scrollbar">
            {CATEGORY_TABS.map((tab) => {
              const count = tab.id === 'all'
                ? photos.length
                : photos.filter((p) => p.category === tab.id).length;

              if (count === 0 && tab.id !== 'all') return null;

              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveFilter(tab.id)}
                  className={`px-3 py-1 rounded-md text-[11px] font-bold transition-all whitespace-nowrap ${
                    activeFilter === tab.id
                      ? 'bg-brand text-white shadow-sm'
                      : 'text-text-muted hover:text-text-primary hover:bg-surface-2'
                  }`}
                >
                  {tab.label} {count > 0 && <span className="opacity-70">({count})</span>}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Responsive Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4">
        {filteredPhotos.map((photo) => {
          const linkedFilm = photo.films;

          return (
            <div
              key={photo.id}
              onClick={() => onSelectPhoto(photo)}
              className="group relative aspect-[3/4] rounded-xl overflow-hidden border border-border bg-surface-2 hover:border-brand cursor-pointer transition-all duration-300 shadow-sm"
            >
              <img
                src={photo.url}
                alt={photo.title || 'Actor photo'}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                loading="lazy"
              />

              {/* Hover Dark Vignette & Information */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 p-3 flex flex-col justify-end text-left">
                {photo.title && (
                  <h5 className="text-white text-xs font-bold truncate">
                    {photo.title}
                  </h5>
                )}

                {linkedFilm && (
                  <p className="text-[10px] text-brand font-semibold truncate mt-0.5">
                    🎬 {formatFilmTitle(linkedFilm.title)}
                  </p>
                )}

                {photo.photographer_credit && (
                  <p className="text-[9px] text-white/60 truncate mt-0.5">
                    📸 {photo.photographer_credit}
                  </p>
                )}

                <div className="mt-2 flex items-center justify-between text-[10px] text-white/80 font-bold">
                  <span className="capitalize">{toTitleCase(photo.category || 'Photo')}</span>
                  <span className="text-brand flex items-center gap-0.5">
                    View <Icon icon="solar:alt-arrow-right-linear" width="12" />
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
