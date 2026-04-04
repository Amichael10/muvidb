import { useState } from 'react'

const TrailerPlayer = ({ film }) => {
  const [isPlaying, setIsPlaying] = useState(false)

  // ── YouTube trailer ──
  if (film.trailer_source === 'youtube' && film.trailer_youtube_id) {
    return (
      <div className="relative w-full aspect-video rounded-2xl overflow-hidden bg-surface">
        {!isPlaying ? (
          // Thumbnail with play button overlay
          <div 
            className="relative w-full h-full cursor-pointer group"
            onClick={() => setIsPlaying(true)}
          >
            <img
              src={`https://img.youtube.com/vi/${film.trailer_youtube_id}/maxresdefault.jpg`}
              alt={`${film.title} trailer`}
              className="w-full h-full object-cover"
              onError={(e) => {
                // Fallback to lower res thumbnail if maxres doesn't exist
                e.target.src = `https://img.youtube.com/vi/${film.trailer_youtube_id}/hqdefault.jpg`
              }}
            />
            {/* Dark overlay */}
            <div className="absolute inset-0 bg-black/40 group-hover:bg-black/20 transition-all duration-300" />
            
            {/* Play button */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-20 h-20 rounded-full bg-gold/90 group-hover:bg-gold group-hover:scale-110 transition-all duration-300 flex items-center justify-center shadow-2xl shadow-gold/40">
                <svg className="w-8 h-8 text-dark ml-1" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z"/>
                </svg>
              </div>
            </div>

            {/* "Official Trailer" badge */}
            <div className="absolute top-4 left-4 bg-black/70 text-white text-xs px-3 py-1 rounded-full">
              Official Trailer
            </div>
          </div>
        ) : (
          // Actual YouTube embed — autoplay when clicked
          <iframe
            className="w-full h-full"
            src={`https://www.youtube.com/embed/${film.trailer_youtube_id}?autoplay=1&rel=0`}
            title={`${film.title} Official Trailer`}
            frameBorder="0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope"
            allowFullScreen
          />
        )}
      </div>
    )
  }

  // ── External URL trailer ──
  if (film.trailer_source === 'external' && film.trailer_external_url) {
    return (
      <div className="w-full aspect-video rounded-2xl overflow-hidden bg-surface flex flex-col items-center justify-center gap-4 border border-border">
        <svg className="w-16 h-16 text-gold" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.069A1 1 0 0121 8.845v6.31a1 1 0 01-1.447.894L15 14M3 8a2 2 0 012-2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z"/>
        </svg>
        <div className="text-center">
          <p className="text-text-primary font-medium mb-1">
            Trailer available externally
          </p>
          <p className="text-text-muted text-sm mb-4">
            This trailer is hosted outside YouTube
          </p>
          <a
            href={film.trailer_external_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 bg-gold text-dark font-semibold px-6 py-3 rounded-full hover:bg-gold/90 transition-colors"
          >
            Watch Trailer
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/>
            </svg>
          </a>
        </div>
      </div>
    )
  }

  // ── No trailer ──
  return (
    <div className="w-full aspect-video rounded-2xl bg-surface flex flex-col items-center justify-center gap-3 border border-dashed border-border">
      <svg className="w-12 h-12 text-text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 4v16M17 4v16M3 8h4m10 0h4M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z"/>
      </svg>
      <p className="text-text-muted text-sm">Trailer coming soon</p>
    </div>
  )
}

export default TrailerPlayer