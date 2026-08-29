import { useState, useRef, useEffect, useCallback } from 'react';
import { Icon } from '@iconify/react';
import toast from 'react-hot-toast';

export const ASPECT_RATIOS = [
  { id: '1:1', label: '1:1 Square (Feed)', aspectClass: 'aspect-square', width: 1080, height: 1080, icon: 'solar:square-linear' },
  { id: '9:16', label: '9:16 Vertical (TikTok / Reels / Shorts)', aspectClass: 'aspect-[9/16]', width: 1080, height: 1920, icon: 'solar:smartphone-linear' },
  { id: '4:5', label: '4:5 Portrait (Instagram Feed)', aspectClass: 'aspect-[4/5]', width: 1080, height: 1350, icon: 'solar:document-linear' },
  { id: '16:9', label: '16:9 Landscape (YouTube / Cinema)', aspectClass: 'aspect-[16/9]', width: 1920, height: 1080, icon: 'solar:tv-linear' },
];

function formatTime(seconds) {
  if (isNaN(seconds) || seconds < 0) return '00:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 10);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${ms}`;
}

function parseTimeToSeconds(timeStr) {
  if (!timeStr) return 0;
  const parts = String(timeStr).trim().split(':').map(Number);
  if (parts.length === 3) {
    return (parts[0] * 3600) + (parts[1] * 60) + parts[2];
  }
  if (parts.length === 2) {
    return (parts[0] * 60) + parts[1];
  }
  return Number(timeStr) || 0;
}

export default function SocialCanvasViewport({
  children,
  mediaUrl,
  mediaType = 'image',
  aspectRatio = '1:1',
  onAspectRatioChange,
  onCutVideo,
  platformLabel = 'Instagram',
  platformIcon = 'mdi:instagram',
  platformAccent = 'from-fuchsia-500 via-red-500 to-amber-400',
  allowVideoCut = true,
  onOpenVideoStudio,
  extraToolbarItems,
}) {
  // Zoom & Pan State
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [activeAspect, setActiveAspect] = useState(aspectRatio);
  const [fitMode, setFitMode] = useState('contain'); // 'contain' (Fit) | 'cover' (Fill)

  // Video / Image detection
  const isVideo = mediaType === 'video' ||
    Boolean(mediaUrl && (
      /\.(mp4|webm|mov|m4v)(\?.*)?$/i.test(mediaUrl) ||
      mediaUrl.startsWith('blob:') ||
      mediaUrl.includes('youtube.com') ||
      mediaUrl.includes('youtu.be')
    ));

  // In-Canvas Video Trimmer / Cut State
  const videoRef = useRef(null);
  const containerRef = useRef(null);
  const [videoDuration, setVideoDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [trimStart, setTrimStart] = useState(0);
  const [trimEnd, setTrimEnd] = useState(0);
  const [showTrimmer, setShowTrimmer] = useState(false);
  const [isTrimming, setIsTrimming] = useState(false);

  // Sync active aspect ratio with prop
  useEffect(() => {
    if (aspectRatio) setActiveAspect(aspectRatio);
  }, [aspectRatio]);

  const handleAspectSelect = (ratioId) => {
    setActiveAspect(ratioId);
    onAspectRatioChange?.(ratioId);
  };

  // Zoom helpers
  const zoomIn = () => setZoom(z => Math.min(3.0, Number((z + 0.15).toFixed(2))));
  const zoomOut = () => setZoom(z => Math.max(0.3, Number((z - 0.15).toFixed(2))));
  const resetZoom = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };
  const fitToScreen = () => {
    setZoom(0.85);
    setPan({ x: 0, y: 0 });
  };

  // Wheel zoom handler
  const handleWheel = useCallback((e) => {
    if (e.ctrlKey || e.metaKey || e.altKey) {
      e.preventDefault();
      const delta = e.deltaY < 0 ? 0.1 : -0.1;
      setZoom(z => Math.max(0.3, Math.min(3.0, Number((z + delta).toFixed(2)))));
    }
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleWheel);
  }, [handleWheel]);

  // Pan dragging
  const handleMouseDown = (e) => {
    if (e.button !== 0 && e.button !== 1) return; // Left or Middle click
    if (zoom > 1 || isPanning) {
      setIsPanning(true);
      setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    }
  };

  const handleMouseMove = (e) => {
    if (!isPanning) return;
    setPan({
      x: e.clientX - panStart.x,
      y: e.clientY - panStart.y,
    });
  };

  const handleMouseUp = () => {
    setIsPanning(false);
  };

  // Video duration and playhead tracking
  const handleLoadedMetadata = () => {
    if (!videoRef.current) return;
    const dur = videoRef.current.duration || 0;
    setVideoDuration(dur);
    setTrimStart(0);
    setTrimEnd(dur);
  };

  const handleTimeUpdate = () => {
    if (!videoRef.current) return;
    const t = videoRef.current.currentTime;
    setCurrentTime(t);

    if (showTrimmer && trimEnd > trimStart) {
      if (t >= trimEnd) {
        videoRef.current.currentTime = trimStart;
      }
    }
  };

  // Reset playback state when mediaUrl changes
  useEffect(() => {
    setIsPlaying(false);
    setVideoDuration(0);
    setTrimStart(0);
    setTrimEnd(0);
    if (videoRef.current) {
      try {
        videoRef.current.pause();
      } catch {}
    }
  }, [mediaUrl]);

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (videoRef.current.paused) {
      if (showTrimmer && (currentTime < trimStart || currentTime >= trimEnd)) {
        videoRef.current.currentTime = trimStart;
      }
      const playPromise = videoRef.current.play();
      if (playPromise && typeof playPromise.then === 'function') {
        playPromise.then(() => {
          setIsPlaying(true);
        }).catch((err) => {
          console.warn('Canvas video playback prevented or failed:', err);
          setIsPlaying(false);
        });
      } else {
        setIsPlaying(true);
      }
    } else {
      videoRef.current.pause();
      setIsPlaying(false);
    }
  };

  const handleSetIn = () => {
    if (!videoRef.current) return;
    const t = videoRef.current.currentTime;
    if (t >= trimEnd) {
      toast.error('Start time must be before end time');
      return;
    }
    setTrimStart(t);
    toast.success(`In-point set to ${formatTime(t)}`);
  };

  const handleSetOut = () => {
    if (!videoRef.current) return;
    const t = videoRef.current.currentTime;
    if (t <= trimStart) {
      toast.error('End time must be after start time');
      return;
    }
    setTrimEnd(t);
    toast.success(`Out-point set to ${formatTime(t)}`);
  };

  const handleApplyCut = async () => {
    if (trimEnd <= trimStart) {
      return toast.error('Please set valid start and end points');
    }
    setIsTrimming(true);
    try {
      if (onCutVideo) {
        await onCutVideo({
          startTime: trimStart,
          endTime: trimEnd,
          duration: trimEnd - trimStart,
          formattedStart: formatTime(trimStart),
          formattedEnd: formatTime(trimEnd),
        });
      } else {
        toast.success(`Cut applied: ${formatTime(trimStart)} to ${formatTime(trimEnd)} (${formatTime(trimEnd - trimStart)} duration)`);
      }
    } catch (err) {
      toast.error(err.message || 'Failed to cut video');
    } finally {
      setIsTrimming(false);
    }
  };

  const selectedRatioConfig = ASPECT_RATIOS.find(r => r.id === activeAspect) || ASPECT_RATIOS[0];

  return (
    <div
      className={`relative flex flex-col overflow-hidden rounded-2xl border border-border bg-[#0a0a0c] shadow-2xl transition-all ${
        isFullscreen ? 'fixed inset-0 z-50 rounded-none' : 'min-h-[480px] w-full'
      }`}
    >
      {/* Top CapCut-Style Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 bg-[#121216] px-4 py-2 text-white">
        {/* Left: Platform & Aspect Ratio Selector */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 rounded-lg bg-black/40 px-2.5 py-1 text-xs font-bold">
            <span className={`flex h-4 w-4 items-center justify-center rounded-full bg-gradient-to-r ${platformAccent}`}>
              <Icon icon={platformIcon} width="11" className="text-white" />
            </span>
            <span className="text-[11px] text-white/90">{platformLabel}</span>
          </div>

          <div className="h-4 w-px bg-white/10" />

          {/* Aspect Ratio Menu */}
          <div className="flex items-center gap-1 rounded-lg bg-black/40 p-0.5">
            {ASPECT_RATIOS.map(r => (
              <button
                key={r.id}
                type="button"
                onClick={() => handleAspectSelect(r.id)}
                title={r.label}
                className={`flex items-center gap-1 rounded px-2 py-1 text-[11px] font-bold transition-all ${
                  activeAspect === r.id
                    ? 'bg-brand text-white shadow-sm'
                    : 'text-white/60 hover:bg-white/10 hover:text-white'
                }`}
              >
                <Icon icon={r.icon} width="12" />
                <span>{r.id}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Center: Extra Actions (e.g. Video Studio) */}
        <div className="flex items-center gap-2">
          {onOpenVideoStudio && (
            <button
              type="button"
              onClick={onOpenVideoStudio}
              className="inline-flex items-center gap-1.5 rounded-lg bg-red-600/90 px-3 py-1 text-[11px] font-black text-white hover:bg-red-500 shadow-sm transition-all"
            >
              <Icon icon="solar:clapperboard-play-linear" width="14" />
              <span>YouTube / Clip Studio</span>
            </button>
          )}

          {isVideo && allowVideoCut && (
            <button
              type="button"
              onClick={() => setShowTrimmer(prev => !prev)}
              className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[11px] font-bold transition-all ${
                showTrimmer
                  ? 'border-brand bg-brand/20 text-brand ring-1 ring-brand'
                  : 'border-white/10 bg-black/40 text-white/80 hover:text-white hover:bg-white/10'
              }`}
            >
              <Icon icon="solar:scissors-linear" width="13" />
              <span>{showTrimmer ? 'Hide Cut Tool' : 'In-Canvas Cut'}</span>
            </button>
          )}

          {extraToolbarItems}
        </div>

        {/* Right: CapCut-Style Zoom & View Space Controls */}
        <div className="flex items-center gap-1.5">
          {/* Zoom Out */}
          <button
            type="button"
            onClick={zoomOut}
            title="Zoom Out (Ctrl + Scroll Down)"
            className="flex h-7 w-7 items-center justify-center rounded-lg bg-black/40 text-white/70 hover:bg-white/10 hover:text-white"
          >
            <Icon icon="solar:magnifer-zoom-out-linear" width="14" />
          </button>

          {/* Zoom Percentage Indicator */}
          <button
            type="button"
            onClick={resetZoom}
            title="Click to reset zoom (100%)"
            className="min-w-[48px] rounded-lg bg-black/40 px-2 py-1 text-center font-mono text-[11px] font-black text-white/90 hover:bg-white/10"
          >
            {Math.round(zoom * 100)}%
          </button>

          {/* Zoom In */}
          <button
            type="button"
            onClick={zoomIn}
            title="Zoom In (Ctrl + Scroll Up)"
            className="flex h-7 w-7 items-center justify-center rounded-lg bg-black/40 text-white/70 hover:bg-white/10 hover:text-white"
          >
            <Icon icon="solar:magnifer-zoom-in-linear" width="14" />
          </button>

          {/* Fit / Fill Mode Toggle */}
          <button
            type="button"
            onClick={() => setFitMode(m => m === 'contain' ? 'cover' : 'contain')}
            title={fitMode === 'contain' ? 'Switch to Fill Mode (Scale to fill entire frame)' : 'Switch to Fit Mode (Contain with original aspect)'}
            className={`flex h-7 items-center gap-1.5 rounded-lg px-2 text-[10px] font-bold transition-all ${
              fitMode === 'cover'
                ? 'bg-brand text-white shadow-sm'
                : 'bg-black/40 text-white/70 hover:bg-white/10 hover:text-white'
            }`}
          >
            <Icon icon={fitMode === 'cover' ? 'solar:maximize-square-minimalistic-bold' : 'solar:minimize-square-minimalistic-bold'} width="12" />
            <span>{fitMode === 'cover' ? 'Fill Frame' : 'Fit Frame'}</span>
          </button>

          {/* Reset Zoom */}
          <button
            type="button"
            onClick={fitToScreen}
            title="Reset Canvas View"
            className="flex h-7 items-center gap-1 rounded-lg bg-black/40 px-2 text-[10px] font-bold text-white/70 hover:bg-white/10 hover:text-white"
          >
            <Icon icon="solar:maximize-square-2-linear" width="12" />
            <span>Reset View</span>
          </button>

          <div className="h-4 w-px bg-white/10" />

          {/* Fullscreen Toggle */}
          <button
            type="button"
            onClick={() => setIsFullscreen(f => !f)}
            title={isFullscreen ? 'Exit Fullscreen' : 'Expand Full Canvas'}
            className={`flex h-7 w-7 items-center justify-center rounded-lg ${
              isFullscreen ? 'bg-brand text-white' : 'bg-black/40 text-white/70 hover:bg-white/10 hover:text-white'
            }`}
          >
            <Icon icon={isFullscreen ? 'solar:minimize-square-3-linear' : 'solar:maximize-square-3-linear'} width="14" />
          </button>
        </div>
      </div>

      {/* Main Interactive Canvas Area */}
      <div
        ref={containerRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        className={`relative flex flex-1 items-center justify-center overflow-hidden bg-[#0c0c0e] select-none ${
          zoom > 1 || isPanning ? 'cursor-grab active:cursor-grabbing' : 'cursor-default'
        }`}
        style={{ minHeight: isFullscreen ? 'calc(100vh - 120px)' : '420px' }}
      >
        {/* Subtle grid pattern background */}
        <div
          className="absolute inset-0 opacity-20 pointer-events-none"
          style={{
            backgroundImage: 'radial-gradient(circle, #ffffff 1px, transparent 1px)',
            backgroundSize: '24px 24px',
          }}
        />

        {/* Scalable & Pannable Viewport Stage */}
        <div
          className="transition-transform duration-75 ease-out origin-center"
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          }}
        >
          {/* Framed Canvas Box */}
          <div
            className={`relative overflow-hidden rounded-xl border border-white/20 bg-black shadow-2xl transition-all ${
              selectedRatioConfig.aspectClass
            }`}
            style={{
              maxHeight: isFullscreen ? '85vh' : '520px',
              width: activeAspect === '9:16' ? '290px' : activeAspect === '4:5' ? '360px' : activeAspect === '16:9' ? '540px' : '400px',
            }}
          >
            {/* Custom Content or Injected Video */}
            {isVideo && typeof mediaUrl === 'string' ? (
              mediaUrl.includes('youtube.com') || mediaUrl.includes('youtu.be') ? (
                <div className="relative h-full w-full bg-black flex items-center justify-center">
                  <iframe
                    key={mediaUrl}
                    src={(() => {
                      if (mediaUrl.includes('youtube.com/embed/')) return mediaUrl;
                      try {
                        const parsed = new URL(mediaUrl);
                        let vid = '';
                        if (mediaUrl.includes('youtu.be/')) {
                          vid = parsed.pathname.slice(1).split('?')[0];
                        } else if (mediaUrl.includes('shorts/')) {
                          vid = parsed.pathname.split('shorts/')[1]?.split('?')[0];
                        } else {
                          vid = parsed.searchParams.get('v') || '';
                        }
                        if (vid) {
                          const start = parsed.searchParams.get('start');
                          const end = parsed.searchParams.get('end');
                          let embed = `https://www.youtube.com/embed/${vid}?autoplay=1&enablejsapi=1`;
                          if (start) embed += `&start=${start}`;
                          if (end) embed += `&end=${end}`;
                          return embed;
                        }
                      } catch {}
                      return mediaUrl;
                    })()}
                    title="Video Canvas Preview"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    className="h-full w-full border-0 object-cover"
                  />
                </div>
              ) : (
                <div className="relative h-full w-full bg-black flex items-center justify-center">
                  <video
                    ref={videoRef}
                    key={mediaUrl}
                    src={mediaUrl}
                    playsInline
                    preload="auto"
                    onLoadedMetadata={handleLoadedMetadata}
                    onTimeUpdate={handleTimeUpdate}
                    onError={(e) => console.error('Canvas video playback error:', e)}
                    className={`h-full w-full ${fitMode === 'cover' ? 'object-cover' : 'object-contain'}`}
                  />
                  {/* Play/Pause Overlay on Click */}
                  <button
                    type="button"
                    onClick={togglePlay}
                    className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 hover:opacity-100 transition-opacity"
                  >
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-black/70 text-white backdrop-blur-sm">
                      <Icon icon={isPlaying ? 'solar:pause-bold' : 'solar:play-bold'} width="22" />
                    </div>
                  </button>
                </div>
              )
            ) : (
              <div className={`h-full w-full flex items-center justify-center [&>img]:${fitMode === 'cover' ? 'object-cover' : 'object-contain'} [&>video]:${fitMode === 'cover' ? 'object-cover' : 'object-contain'}`}>
                {children}
              </div>
            )}

            {/* Canvas Corner Dimension Badge */}
            <span className="absolute bottom-2 left-2 rounded bg-black/75 px-1.5 py-0.5 text-[9px] font-mono font-bold text-white/80 backdrop-blur-sm pointer-events-none">
              {selectedRatioConfig.label.split(' ')[0]} ({selectedRatioConfig.width}x{selectedRatioConfig.height})
            </span>
          </div>
        </div>

        {/* Floating Zoom Indicator Hint */}
        {zoom !== 1 && (
          <div className="absolute bottom-3 right-3 rounded-full bg-black/80 px-3 py-1 text-[10px] font-mono text-white/75 backdrop-blur-sm border border-white/10 pointer-events-none">
            Zoom: {Math.round(zoom * 100)}% • Hold Space / Drag to Pan
          </div>
        )}
      </div>

      {/* In-Canvas Video Trimmer / Cutting Timeline (CapCut style) */}
      {isVideo && showTrimmer && (
        <div className="border-t border-white/10 bg-[#121216] p-4 text-white">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-3">
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand/20 text-brand">
                <Icon icon="solar:scissors-bold" width="16" />
              </span>
              <div>
                <h4 className="text-xs font-black uppercase tracking-wider text-white">In-Canvas Video Cut & Trim</h4>
                <p className="text-[10px] text-white/60">
                  Cut video directly on the canvas without leaving Social Studio
                </p>
              </div>
            </div>

            {/* Timecode Inputs */}
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 rounded-lg bg-black/50 px-2.5 py-1 border border-white/10">
                <span className="text-[9px] font-black uppercase tracking-wider text-text-muted">Start</span>
                <input
                  type="text"
                  value={formatTime(trimStart)}
                  onChange={e => setTrimStart(parseTimeToSeconds(e.target.value))}
                  className="w-16 bg-transparent font-mono text-xs font-bold text-brand outline-none"
                />
                <button
                  type="button"
                  onClick={handleSetIn}
                  title="Set Start to Current Playhead"
                  className="rounded bg-brand/20 px-1.5 py-0.5 text-[9px] font-black uppercase text-brand hover:bg-brand/30"
                >
                  Set [
                </button>
              </div>

              <span className="text-white/40 font-mono">→</span>

              <div className="flex items-center gap-1.5 rounded-lg bg-black/50 px-2.5 py-1 border border-white/10">
                <span className="text-[9px] font-black uppercase tracking-wider text-text-muted">End</span>
                <input
                  type="text"
                  value={formatTime(trimEnd)}
                  onChange={e => setTrimEnd(parseTimeToSeconds(e.target.value))}
                  className="w-16 bg-transparent font-mono text-xs font-bold text-brand outline-none"
                />
                <button
                  type="button"
                  onClick={handleSetOut}
                  title="Set End to Current Playhead"
                  className="rounded bg-brand/20 px-1.5 py-0.5 text-[9px] font-black uppercase text-brand hover:bg-brand/30"
                >
                  Set ]
                </button>
              </div>

              {/* Clip Duration Pill */}
              <div className="rounded-lg bg-emerald-500/20 px-2.5 py-1 text-[11px] font-mono font-black text-emerald-400 border border-emerald-500/30">
                Clip: {formatTime(Math.max(0, trimEnd - trimStart))}
              </div>

              {/* Apply Cut Button */}
              <button
                type="button"
                onClick={handleApplyCut}
                disabled={isTrimming || trimEnd <= trimStart}
                className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-3.5 py-1.5 text-xs font-black uppercase tracking-wider text-white hover:bg-brand-hover transition-all disabled:opacity-50 shadow-md"
              >
                <Icon icon={isTrimming ? 'solar:spinner-linear' : 'solar:cut-bold'} className={isTrimming ? 'animate-spin' : ''} width="14" />
                <span>{isTrimming ? 'Cutting…' : 'Apply Cut to Canvas'}</span>
              </button>
            </div>
          </div>

          {/* Interactive Range Scrubber */}
          <div className="mt-3 space-y-2">
            <div className="flex items-center justify-between text-[10px] font-mono text-white/60">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={togglePlay}
                  className="flex h-6 w-6 items-center justify-center rounded bg-white/10 hover:bg-white/20 text-white"
                >
                  <Icon icon={isPlaying ? 'solar:pause-bold' : 'solar:play-bold'} width="12" />
                </button>
                <span>Playhead: {formatTime(currentTime)}</span>
              </div>
              <span>Total Video: {formatTime(videoDuration)}</span>
            </div>

            {/* Visual Scrubber Track */}
            <div className="relative h-7 w-full rounded-lg bg-black/60 border border-white/10 overflow-hidden">
              {/* Active Trim Window Highlight */}
              {videoDuration > 0 && (
                <div
                  className="absolute top-0 bottom-0 bg-brand/30 border-x-2 border-brand"
                  style={{
                    left: `${(trimStart / videoDuration) * 100}%`,
                    width: `${((trimEnd - trimStart) / videoDuration) * 100}%`,
                  }}
                />
              )}

              {/* Playhead Marker */}
              {videoDuration > 0 && (
                <div
                  className="absolute top-0 bottom-0 w-1 bg-white shadow-lg pointer-events-none"
                  style={{
                    left: `${(currentTime / videoDuration) * 100}%`,
                  }}
                />
              )}

              {/* Range Input for scrubbing */}
              <input
                type="range"
                min={0}
                max={videoDuration || 100}
                step={0.1}
                value={currentTime}
                onChange={e => {
                  const val = Number(e.target.value);
                  setCurrentTime(val);
                  if (videoRef.current) videoRef.current.currentTime = val;
                }}
                className="absolute inset-0 w-full opacity-0 cursor-pointer"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
