import React from 'react';
import { Icon } from '@iconify/react';

/**
 * Mirra "My life in slides™" / "Cinema in slides™"
 * Horizontal snapping card moments showing key films, stage productions,
 * behind-the-scenes sets, and red carpet appearances.
 */
export default function MirraSlidesCarousel({
  title = 'My life in slides™',
  moments = [],
  onSelectMoment,
}) {
  const defaultMoments = [
    {
      id: 'm1',
      title: 'King of Thieves II',
      subtitle: 'Principal Photography',
      location: 'Ibadan, Oyo State',
      sound: 'sound off',
      image: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=800&auto=format&fit=crop&q=80',
    },
    {
      id: 'm2',
      title: 'Terra Kulture Premiere',
      subtitle: 'DURO Stage Production',
      location: 'Victoria Island, Lagos',
      sound: 'sound off',
      image: 'https://images.unsplash.com/photo-1469488865564-c2de10f69f96?w=800&auto=format&fit=crop&q=80',
    },
    {
      id: 'm3',
      title: 'Jagun Jagun Red Carpet',
      subtitle: 'Global Cinema Launch',
      location: 'Filmhouse IMAX, Lekki',
      sound: 'sound off',
      image: 'https://images.unsplash.com/photo-1517604931442-7e0c8ed2963c?w=800&auto=format&fit=crop&q=80',
    },
    {
      id: 'm4',
      title: 'AFRIFF Industry Keynote',
      subtitle: 'The Future of African Storytelling',
      location: 'Eko Hotel, Lagos',
      sound: 'sound off',
      image: 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=800&auto=format&fit=crop&q=80',
    },
  ];

  const items = moments.length > 0 ? moments : defaultMoments;

  return (
    <div className="w-full space-y-2.5 select-none pt-2">
      {/* Header: Title + Moments Count */}
      <div className="flex items-center justify-between px-1">
        <h3 className="text-xs sm:text-sm font-bold text-white tracking-tight">
          {title}
        </h3>
        <span className="text-[11px] font-mono text-zinc-400">
          {items.length} Moments
        </span>
      </div>

      {/* Snapping Horizontal Scroll Container */}
      <div className="flex gap-3 overflow-x-auto no-scrollbar scroll-smooth snap-x snap-mandatory pb-2 -mx-1 px-1">
        {items.map((m, idx) => (
          <div
            key={m.id || idx}
            onClick={() => onSelectMoment && onSelectMoment(m)}
            className="group relative flex-shrink-0 w-[240px] sm:w-[260px] aspect-[4/5] rounded-3xl overflow-hidden border border-white/15 bg-zinc-900 shadow-xl snap-start cursor-pointer transition-all duration-300 hover:scale-[1.02]"
          >
            {/* Background Moment Image */}
            <img
              src={m.image}
              alt={m.title}
              className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
            />

            {/* Top Overlay: Location Pin + Sound Status */}
            <div className="absolute top-3 inset-x-3 flex items-center justify-between z-10">
              {m.location && (
                <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-black/60 backdrop-blur-md border border-white/15 text-[10px] font-mono text-white/90">
                  <Icon icon="solar:map-point-bold" className="text-brand text-xs" />
                  <span className="truncate max-w-[120px]">{m.location}</span>
                </div>
              )}

              {m.sound && (
                <div className="px-2 py-1 rounded-full bg-black/60 backdrop-blur-md border border-white/15 text-[10px] font-mono text-zinc-300">
                  <span>{m.sound}</span>
                </div>
              )}
            </div>

            {/* Bottom Overlay: Title & Subtitle */}
            <div className="absolute bottom-0 inset-x-0 p-3.5 bg-gradient-to-t from-black/95 via-black/50 to-transparent flex flex-col justify-end">
              <h4 className="text-sm font-bold text-white tracking-tight truncate drop-shadow-md">
                {m.title}
              </h4>
              {m.subtitle && (
                <p className="text-[11px] text-zinc-300 truncate mt-0.5 font-medium">
                  {m.subtitle}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
