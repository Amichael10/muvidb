import { useState, useRef, useEffect } from 'react';
import { Icon } from '@iconify/react';
import toast from 'react-hot-toast';

function formatSecondsToTimecode(totalSeconds) {
  if (isNaN(totalSeconds) || totalSeconds < 0) return '00:00:00';
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = Math.floor(totalSeconds % 60);
  if (h > 0) {
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function parseTimecodeToSeconds(timeStr) {
  if (!timeStr) return 0;
  const parts = String(timeStr).trim().split(':').map(Number);
  if (parts.length === 3) {
    return (parts[0] * 3600) + (parts[1] * 60) + (parts[2] || 0);
  }
  if (parts.length === 2) {
    return (parts[0] * 60) + (parts[1] || 0);
  }
  return Number(timeStr) || 0;
}

export default function SocialVideoClipModal({
  isOpen,
  onClose,
  initialVideoUrl = '',
  initialTitle = '',
  onImportToCanvas,
}) {
  const [activeTab, setActiveTab] = useState('clip_range'); // 'whole_video' | 'clip_range'
  const [videoInput, setVideoInput] = useState(initialVideoUrl || '');
  const [videoUrl, setVideoUrl] = useState(initialVideoUrl || '');
  const [videoTitle, setVideoTitle] = useState(initialTitle || '');
  const [loading, setLoading] = useState(false);

  // Timecodes & Trimmer State
  const videoRef = useRef(null);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [startTime, setStartTime] = useState(0);
  const [endTime, setEndTime] = useState(0);
  const [startTimeInput, setStartTimeInput] = useState('00:00');
  const [endTimeInput, setEndTimeInput] = useState('00:30');
  const [isPreviewingClip, setIsPreviewingClip] = useState(false);

  useEffect(() => {
    if (initialVideoUrl) {
      setVideoInput(initialVideoUrl);
      setVideoUrl(initialVideoUrl);
    }
    if (initialTitle) {
      setVideoTitle(initialTitle);
    }
  }, [initialVideoUrl, initialTitle]);

  if (!isOpen) return null;

  // Extract YouTube ID or direct URL
  const extractVideoUrl = (input) => {
    const raw = String(input || '').trim();
    if (!raw) return '';
    if (raw.includes('youtube.com/watch')) {
      try {
        const vid = new URL(raw).searchParams.get('v');
        if (vid) return `https://www.youtube.com/embed/${vid}?autoplay=1&enablejsapi=1`;
      } catch {
        const m = raw.match(/v=([a-zA-Z0-9_-]+)/);
        if (m) return `https://www.youtube.com/embed/${m[1]}?autoplay=1&enablejsapi=1`;
      }
    }
    if (raw.includes('youtu.be/')) {
      const vid = raw.split('youtu.be/')[1]?.split('?')[0];
      if (vid) return `https://www.youtube.com/embed/${vid}?autoplay=1&enablejsapi=1`;
    }
    if (raw.includes('youtube.com/embed/')) {
      return raw.includes('enablejsapi=1') ? raw : `${raw}${raw.includes('?') ? '&' : '?'}autoplay=1&enablejsapi=1`;
    }
    if (/^[a-zA-Z0-9_-]{11}$/.test(raw)) {
      return `https://www.youtube.com/embed/${raw}?autoplay=1&enablejsapi=1`;
    }
    return raw;
  };

  const handleFetchVideo = () => {
    if (!videoInput.trim()) {
      return toast.error('Please enter a video URL, YouTube link, or MP4 URL');
    }
    setLoading(true);
    const resolved = extractVideoUrl(videoInput);
    setVideoUrl(resolved);
    setIsPreviewingClip(false);
    toast.success('Video loaded ready for clipping!');
    setLoading(false);
  };

  const handleLoadedMetadata = () => {
    if (!videoRef.current) return;
    const dur = videoRef.current.duration || 0;
    setDuration(dur);
    setStartTime(0);
    setEndTime(Math.min(dur, 60)); // Default to 60s max for TikTok/Reels
    setStartTimeInput('00:00');
    setEndTimeInput(formatSecondsToTimecode(Math.min(dur, 60)));
  };

  const handleTimeUpdate = () => {
    if (!videoRef.current) return;
    const t = videoRef.current.currentTime;
    setCurrentTime(t);

    if (activeTab === 'clip_range' && endTime > startTime) {
      if (t >= endTime) {
        videoRef.current.currentTime = startTime;
      }
    }
  };

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (videoRef.current.paused) {
      if (currentTime < startTime || currentTime >= endTime) {
        videoRef.current.currentTime = startTime;
      }
      videoRef.current.play();
      setIsPlaying(true);
    } else {
      videoRef.current.pause();
      setIsPlaying(false);
    }
  };

  const handleSetStartTime = (sec) => {
    const valid = Math.max(0, Math.min(sec, duration || 9999));
    setStartTime(valid);
    setStartTimeInput(formatSecondsToTimecode(valid));
    if (valid >= endTime) {
      const nextEnd = Math.min(duration || (valid + 30), valid + 30);
      setEndTime(nextEnd);
      setEndTimeInput(formatSecondsToTimecode(nextEnd));
    }
    if (videoRef.current) videoRef.current.currentTime = valid;
  };

  const handleSetEndTime = (sec) => {
    const valid = Math.max(startTime + 1, Math.min(sec, duration || 9999));
    setEndTime(valid);
    setEndTimeInput(formatSecondsToTimecode(valid));
    if (videoRef.current) videoRef.current.currentTime = valid;
  };

  const handlePreviewClip = () => {
    if (!videoUrl) return toast.error('Please load a video first');
    if (endTime <= startTime) return toast.error('End time must be after start time');
    
    setIsPreviewingClip(true);
    if (videoUrl.includes('youtube.com/embed')) {
      let vid = '';
      if (videoUrl.includes('embed/')) {
        vid = videoUrl.split('embed/')[1]?.split('?')[0];
      }
      if (vid) {
        setVideoUrl(`https://www.youtube.com/embed/${vid}?autoplay=1&start=${Math.max(0, Math.floor(startTime))}&end=${Math.max(1, Math.floor(endTime))}&enablejsapi=1`);
      }
    } else if (videoRef.current) {
      videoRef.current.currentTime = startTime;
      const p = videoRef.current.play();
      if (p && typeof p.then === 'function') {
        p.then(() => setIsPlaying(true)).catch((err) => {
          console.warn('Preview playback interrupted:', err);
          setIsPlaying(false);
        });
      } else {
        setIsPlaying(true);
      }
    }
    toast.success(`Playing preview clip: ${formatSecondsToTimecode(startTime)} to ${formatSecondsToTimecode(endTime)}`);
  };

  const handleApplyToCanvas = (mode) => {
    if (!videoUrl) {
      return toast.error('Please load a video first');
    }

    if (mode === 'whole') {
      let fullUrl = videoUrl;
      if (videoUrl.includes('youtube.com') || videoUrl.includes('youtu.be')) {
        let vid = '';
        if (videoUrl.includes('embed/')) {
          vid = videoUrl.split('embed/')[1]?.split('?')[0];
        } else if (videoUrl.includes('youtu.be/')) {
          vid = videoUrl.split('youtu.be/')[1]?.split('?')[0];
        } else if (videoUrl.includes('watch?v=')) {
          vid = videoUrl.split('watch?v=')[1]?.split('&')[0];
        }
        if (vid) {
          fullUrl = `https://www.youtube.com/embed/${vid}?autoplay=1&enablejsapi=1`;
        }
      }

      onImportToCanvas?.({
        url: fullUrl,
        mode: 'whole',
        startTime: 0,
        endTime: duration,
        duration: duration,
        title: videoTitle || 'Source Video',
      });
      toast.success('Whole video imported straight into the canvas!');
      onClose();
    } else {
      if (endTime <= startTime) {
        return toast.error('End time must be greater than start time');
      }
      const clipDuration = endTime - startTime;
      let clippedUrl = videoUrl;
      if (videoUrl.includes('youtube.com') || videoUrl.includes('youtu.be')) {
        let vid = '';
        if (videoUrl.includes('embed/')) {
          vid = videoUrl.split('embed/')[1]?.split('?')[0];
        } else if (videoUrl.includes('youtu.be/')) {
          vid = videoUrl.split('youtu.be/')[1]?.split('?')[0];
        } else if (videoUrl.includes('watch?v=')) {
          vid = videoUrl.split('watch?v=')[1]?.split('&')[0];
        }
        if (vid) {
          clippedUrl = `https://www.youtube.com/embed/${vid}?autoplay=1&start=${Math.max(0, Math.floor(startTime))}&end=${Math.max(1, Math.floor(endTime))}&enablejsapi=1`;
        }
      }

      onImportToCanvas?.({
        url: clippedUrl,
        mode: 'clip',
        startTime,
        endTime,
        duration: clipDuration,
        formattedStart: formatSecondsToTimecode(startTime),
        formattedEnd: formatSecondsToTimecode(endTime),
        title: `${videoTitle || 'Clip'} (${formatSecondsToTimecode(startTime)} - ${formatSecondsToTimecode(endTime)})`,
      });
      toast.success(`Trimmed clip (${formatSecondsToTimecode(startTime)} to ${formatSecondsToTimecode(endTime)}) sent to canvas!`);
      onClose();
    }
  };

  const clipDuration = Math.max(0, endTime - startTime);
  const isEmbed = videoUrl.includes('youtube.com/embed');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-md">
      <div className="relative flex max-h-[95vh] w-full max-w-4xl flex-col rounded-2xl border border-border bg-[#0f0f13] shadow-2xl overflow-hidden text-white">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-white/10 bg-[#16161c] px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-600/20 text-red-500 border border-red-500/30">
              <Icon icon="solar:clapperboard-play-bold" width="22" />
            </div>
            <div>
              <h3 className="text-base font-black uppercase tracking-wider text-white">
                YouTube & Video Clip Studio
              </h3>
              <p className="text-xs text-white/60">
                Download whole videos or enter exact start/end timecodes directly into the canvas
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-white/60 hover:bg-white/10 hover:text-white"
          >
            <Icon icon="solar:close-circle-linear" width="22" />
          </button>
        </div>

        {/* Video Input Bar */}
        <div className="border-b border-white/10 bg-[#121216] p-4">
          <label className="text-[10px] font-black uppercase tracking-wider text-white/70">
            Video Source (YouTube Trailer, Nollywood Stream, or Direct MP4 Link)
          </label>
          <div className="mt-1.5 flex gap-2">
            <div className="relative flex-1">
              <Icon icon="solar:link-linear" className="absolute left-3 top-3 text-white/40" width="18" />
              <input
                type="text"
                value={videoInput}
                onChange={e => setVideoInput(e.target.value)}
                placeholder="Paste YouTube link (e.g. https://youtu.be/...) or MP4 video URL…"
                className="h-10 w-full rounded-lg border border-white/10 bg-black/50 pl-10 pr-4 text-xs text-white outline-none focus:border-brand"
              />
            </div>
            <button
              type="button"
              onClick={handleFetchVideo}
              disabled={loading || !videoInput.trim()}
              className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-5 text-xs font-black uppercase tracking-wider text-white hover:bg-red-500 disabled:opacity-50"
            >
              <Icon icon="solar:cloud-download-linear" width="16" />
              <span>Fetch Video</span>
            </button>
          </div>
        </div>

        {/* Mode Selector Tabs: 2 Options */}
        <div className="flex border-b border-white/10 bg-[#16161c]">
          <button
            type="button"
            onClick={() => setActiveTab('whole_video')}
            className={`flex flex-1 items-center justify-center gap-2 border-b-2 py-3 text-xs font-black uppercase tracking-wider transition-all ${
              activeTab === 'whole_video'
                ? 'border-brand bg-brand/10 text-brand'
                : 'border-transparent text-white/60 hover:text-white'
            }`}
          >
            <Icon icon="solar:file-download-bold" width="16" />
            <span>Option 1: Download Whole Video</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('clip_range')}
            className={`flex flex-1 items-center justify-center gap-2 border-b-2 py-3 text-xs font-black uppercase tracking-wider transition-all ${
              activeTab === 'clip_range'
                ? 'border-brand bg-brand/10 text-brand'
                : 'border-transparent text-white/60 hover:text-white'
            }`}
          >
            <Icon icon="solar:scissors-bold" width="16" />
            <span>Option 2: Enter Start & End Time (Custom Clip)</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Video Player Box */}
          <div className="relative aspect-video w-full overflow-hidden rounded-xl border border-white/10 bg-black shadow-xl">
            {videoUrl ? (
              isEmbed ? (
                <iframe
                  src={videoUrl}
                  title="YouTube Player"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  className="h-full w-full border-0"
                />
              ) : (
                <div className="relative h-full w-full flex items-center justify-center">
                  <video
                    ref={videoRef}
                    src={videoUrl}
                    playsInline
                    onLoadedMetadata={handleLoadedMetadata}
                    onTimeUpdate={handleTimeUpdate}
                    className="h-full w-full object-contain"
                  />
                  <button
                    type="button"
                    onClick={togglePlay}
                    className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 hover:opacity-100 transition-opacity"
                  >
                    <div className="flex h-14 w-14 items-center justify-center rounded-full bg-black/80 text-white shadow-2xl backdrop-blur-md">
                      <Icon icon={isPlaying ? 'solar:pause-bold' : 'solar:play-bold'} width="26" />
                    </div>
                  </button>
                </div>
              )
            ) : (
              <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-white/40">
                <Icon icon="solar:play-stream-linear" width="48" />
                <span className="text-xs">Paste a video or trailer URL above to preview & clip</span>
              </div>
            )}
          </div>

          {/* OPTION 1: Whole Video Controls */}
          {activeTab === 'whole_video' && (
            <div className="rounded-xl border border-white/10 bg-[#16161c] p-5">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-black text-white">Full Video Download & Canvas Import</h4>
                  <p className="text-xs text-white/60 mt-0.5">
                    Transfers the entire video directly into your Social Studio draft without any cutting.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleApplyToCanvas('whole')}
                  disabled={!videoUrl}
                  className="inline-flex items-center gap-2 rounded-xl bg-brand px-6 py-3 text-xs font-black uppercase tracking-wider text-white hover:bg-brand-hover disabled:opacity-50 shadow-lg"
                >
                  <Icon icon="solar:download-square-bold" width="18" />
                  <span>Download Whole Video to Canvas</span>
                </button>
              </div>
            </div>
          )}

          {/* OPTION 2: Enter Start & End Time Controls */}
          {activeTab === 'clip_range' && (
            <div className="rounded-xl border border-white/10 bg-[#16161c] p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <div>
                  <h4 className="text-sm font-black text-white">Trim Segment by Start & End Time</h4>
                  <p className="text-xs text-white/60">
                    Set precise in and out timestamps for viral social reels & TikTok clips
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 font-mono text-xs font-black text-emerald-400">
                    Duration: {formatSecondsToTimecode(clipDuration)}
                  </span>
                  <button
                    type="button"
                    onClick={handlePreviewClip}
                    disabled={!videoUrl || clipDuration <= 0}
                    className={`inline-flex items-center gap-1.5 rounded-xl border px-4 py-2.5 text-xs font-black uppercase tracking-wider transition-all ${
                      isPreviewingClip
                        ? 'border-amber-500/50 bg-amber-500/20 text-amber-300 ring-1 ring-amber-500/40'
                        : 'border-white/20 bg-black/40 text-white hover:bg-white/10'
                    }`}
                  >
                    <Icon icon={isPlaying && isPreviewingClip ? 'solar:pause-bold' : 'solar:play-bold'} width="14" />
                    <span>{isPreviewingClip ? 'Pause Preview' : 'Preview Clip Loop'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleApplyToCanvas('clip')}
                    disabled={!videoUrl || clipDuration <= 0}
                    className="inline-flex items-center gap-2 rounded-xl bg-brand px-5 py-2.5 text-xs font-black uppercase tracking-wider text-white hover:bg-brand-hover disabled:opacity-50 shadow-lg"
                  >
                    <Icon icon="solar:cut-bold" width="16" />
                    <span>Send Clip to Canvas</span>
                  </button>
                </div>
              </div>

              {isPreviewingClip && (
                <div className="flex items-center justify-between rounded-lg bg-amber-500/10 border border-amber-500/30 px-3.5 py-2 text-xs text-amber-300 animate-pulse">
                  <div className="flex items-center gap-2 font-bold">
                    <Icon icon="solar:videocamera-record-bold" className="text-amber-400" width="14" />
                    <span>Live Previewing Trimmed Loop ({formatSecondsToTimecode(startTime)} → {formatSecondsToTimecode(endTime)})</span>
                  </div>
                  <span className="font-mono text-[11px] font-black text-amber-400">
                    Playhead: {formatSecondsToTimecode(currentTime)}
                  </span>
                </div>
              )}

              {/* Timecode Inputs Grid */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {/* Start Time Box */}
                <div className="rounded-lg border border-white/10 bg-black/40 p-3.5 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase tracking-wider text-text-muted">
                      1. Start Time (In-Point)
                    </span>
                    <button
                      type="button"
                      onClick={() => handleSetStartTime(currentTime)}
                      className="rounded bg-brand/20 px-2 py-0.5 text-[10px] font-black text-brand hover:bg-brand/30"
                    >
                      Set Current Playhead ({formatSecondsToTimecode(currentTime)})
                    </button>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={startTimeInput}
                      onChange={e => {
                        setStartTimeInput(e.target.value);
                        setStartTime(parseTimecodeToSeconds(e.target.value));
                      }}
                      placeholder="00:00"
                      className="h-10 w-full rounded border border-white/10 bg-[#121216] px-3 font-mono text-sm font-bold text-brand outline-none focus:border-brand"
                    />
                    <div className="flex gap-1">
                      <button
                        type="button"
                        onClick={() => handleSetStartTime(startTime - 5)}
                        className="rounded bg-white/10 px-2 py-2 text-xs font-mono hover:bg-white/20"
                      >
                        -5s
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSetStartTime(startTime + 5)}
                        className="rounded bg-white/10 px-2 py-2 text-xs font-mono hover:bg-white/20"
                      >
                        +5s
                      </button>
                    </div>
                  </div>
                </div>

                {/* End Time Box */}
                <div className="rounded-lg border border-white/10 bg-black/40 p-3.5 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase tracking-wider text-text-muted">
                      2. End Time (Out-Point)
                    </span>
                    <button
                      type="button"
                      onClick={() => handleSetEndTime(currentTime)}
                      className="rounded bg-brand/20 px-2 py-0.5 text-[10px] font-black text-brand hover:bg-brand/30"
                    >
                      Set Current Playhead ({formatSecondsToTimecode(currentTime)})
                    </button>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={endTimeInput}
                      onChange={e => {
                        setEndTimeInput(e.target.value);
                        setEndTime(parseTimecodeToSeconds(e.target.value));
                      }}
                      placeholder="00:30"
                      className="h-10 w-full rounded border border-white/10 bg-[#121216] px-3 font-mono text-sm font-bold text-brand outline-none focus:border-brand"
                    />
                    <div className="flex gap-1">
                      <button
                        type="button"
                        onClick={() => handleSetEndTime(endTime - 5)}
                        className="rounded bg-white/10 px-2 py-2 text-xs font-mono hover:bg-white/20"
                      >
                        -5s
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSetEndTime(endTime + 5)}
                        className="rounded bg-white/10 px-2 py-2 text-xs font-mono hover:bg-white/20"
                      >
                        +5s
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Social Platform Recommendations */}
              <div className="flex flex-wrap items-center gap-2 pt-2 text-[11px] text-white/70">
                <span className="font-bold text-white">Platform Recommendations:</span>
                <span className="rounded bg-black/60 px-2 py-0.5 border border-white/10">🎵 TikTok: 15s - 60s</span>
                <span className="rounded bg-black/60 px-2 py-0.5 border border-white/10">📸 Reels: up to 90s</span>
                <span className="rounded bg-black/60 px-2 py-0.5 border border-white/10">🧵 Threads: up to 5 min</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
