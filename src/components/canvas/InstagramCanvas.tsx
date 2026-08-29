import React, { useState } from 'react';

export interface CanvasVideoProps {
  mediaUrl: string;
  className?: string;
  autoPlay?: boolean;
  loop?: boolean;
  muted?: boolean;
}

export function CanvasVideoPlayer({
  mediaUrl,
  className = 'w-full h-full object-contain',
  autoPlay = false,
  loop = false,
  muted = false,
}: CanvasVideoProps) {
  const [hasError, setHasError] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // If the URL is a YouTube page or embed link, HTML5 video cannot decode it directly
  const isYouTubeEmbed = mediaUrl && (
    mediaUrl.includes('youtube.com/embed') ||
    mediaUrl.includes('youtube.com/watch') ||
    mediaUrl.includes('youtu.be')
  );

  if (isYouTubeEmbed) {
    let embedSrc = mediaUrl;
    if (mediaUrl.includes('watch?v=')) {
      const vid = mediaUrl.split('watch?v=')[1]?.split('&')[0];
      embedSrc = `https://www.youtube.com/embed/${vid}?autoplay=1&enablejsapi=1`;
    } else if (mediaUrl.includes('youtu.be/')) {
      const vid = mediaUrl.split('youtu.be/')[1]?.split('?')[0];
      embedSrc = `https://www.youtube.com/embed/${vid}?autoplay=1&enablejsapi=1`;
    }

    return (
      <div className="relative w-full h-full flex items-center justify-center bg-black rounded-lg overflow-hidden">
        <iframe
          key={embedSrc}
          src={embedSrc}
          title="YouTube Video Preview"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          className="w-full h-full border-0 object-cover"
        />
      </div>
    );
  }

  return (
    <div className="relative w-full h-full flex items-center justify-center bg-black rounded-lg overflow-hidden">
      {hasError ? (
        <div className="p-4 text-center text-xs text-white/70">
          <p className="font-semibold text-red-400">Unable to play video</p>
          <p className="mt-1 text-[11px] text-white/50">{errorMessage || 'Codec or media source not supported directly by browser.'}</p>
        </div>
      ) : (
        <video
          key={mediaUrl}
          src={mediaUrl}
          controls
          playsInline
          preload="auto"
          crossOrigin="anonymous"
          autoPlay={autoPlay}
          loop={loop}
          muted={muted}
          className={className}
          onError={(e) => {
            console.error('Canvas video playback error:', e);
            setHasError(true);
            setErrorMessage('HTML5 video decoding failed. Ensure source is an MP4/WebM blob or stream.');
          }}
        >
          <source src={mediaUrl} type="video/webm" />
          <source src={mediaUrl} type="video/mp4" />
          Your browser does not support HTML5 video playback.
        </video>
      )}
    </div>
  );
}

export default CanvasVideoPlayer;
