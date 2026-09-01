import { useState, useRef, useEffect } from 'react';
import { Icon } from '@iconify/react';
import toast from 'react-hot-toast';
import { authHeaders } from '../../lib/apiAuth';
import { supabase } from '../../lib/supabase';

const LOCAL_CLIPPER_URL = 'http://127.0.0.1:4317';

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
  onAttachRenderedVideo,
}) {
  const [activeTab, setActiveTab] = useState('clip_range'); // 'whole_video' | 'clip_range'
  const [videoInput, setVideoInput] = useState(initialVideoUrl || '');
  const [videoUrl, setVideoUrl] = useState(initialVideoUrl || '');
  const [videoTitle, setVideoTitle] = useState(initialTitle || '');
  const [loading, setLoading] = useState(false);

  // Timecodes & Trimmer State
  const videoRef = useRef(null);
  const iframeRef = useRef(null);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [startTime, setStartTime] = useState(0);
  const [endTime, setEndTime] = useState(30);
  const [startTimeInput, setStartTimeInput] = useState('00:00');
  const [endTimeInput, setEndTimeInput] = useState('00:30');
  const [isPreviewingClip, setIsPreviewingClip] = useState(false);

  // Crop Aspect Ratio & Framing Mode
  const [cropAspectRatio, setCropAspectRatio] = useState('9:16'); // '9:16' | '1:1' | '16:9' | '4:5'
  const [selectedAspectRatios, setSelectedAspectRatios] = useState(['9:16']);
  const [cropFitMode, setCropFitMode] = useState('cover'); // 'cover' (fill/crop) | 'contain' (fit/letterbox)

  // Multi-Stage Progress State for True Video Cut & Upload
  const [isRendering, setIsRendering] = useState(false);
  const [renderProgress, setRenderProgress] = useState(0);
  const [renderStage, setRenderStage] = useState(1);
  const [renderStatusText, setRenderStatusText] = useState('');
  const progressTimerRef = useRef(null);
  const renderAbortRef = useRef(null);

  useEffect(() => {
    if (initialVideoUrl) {
      setVideoInput(initialVideoUrl);
      setVideoUrl(initialVideoUrl);
    }
    if (initialTitle) {
      setVideoTitle(initialTitle);
    }
  }, [initialVideoUrl, initialTitle]);

  useEffect(() => {
    return () => {
      if (progressTimerRef.current) clearInterval(progressTimerRef.current);
    };
  }, []);

  if (!isOpen) return null;

  // Extract YouTube ID or direct URL
  const extractVideoUrl = (input) => {
    let raw = String(input || '').trim();
    if (!raw) return '';
    if (raw.includes('youtube.com/watch')) {
      try {
        const vid = new URL(raw).searchParams.get('v');
        if (vid) {
          return `https://www.youtube.com/embed/${vid}?autoplay=1&enablejsapi=1`;
        }
      } catch {
        const m = raw.match(/v=([a-zA-Z0-9_-]+)/);
        if (m) {
          return `https://www.youtube.com/embed/${m[1]}?autoplay=1&enablejsapi=1`;
        }
      }
    }
    if (raw.includes('youtu.be/')) {
      const vid = raw.split('youtu.be/')[1]?.split('?')[0];
      if (vid) {
        return `https://www.youtube.com/embed/${vid}?autoplay=1&enablejsapi=1`;
      }
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
    setEndTime(Math.min(dur, 60));
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

  // Preview embed in canvas
  const handleApplyPreviewToCanvas = (mode) => {
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
      toast.success('Whole video imported into canvas preview!');
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
      toast.success(`Trimmed loop preview sent to canvas!`);
      onClose();
    }
  };

  const uploadLocalClipToStorage = async (localClip, signal) => {
    const clipResponse = await fetch(localClip.download_url, { signal });
    if (!clipResponse.ok) throw new Error('The desktop clipper finished, but the rendered file could not be read.');
    const clipBlob = await clipResponse.blob();
    if (!clipBlob.size) throw new Error('The desktop clipper returned an empty video.');

    const cleanFileName = (localClip.file_name || `muvidb_clip_${Date.now()}.mp4`).replace(/[^a-zA-Z0-9._-]/g, '_');
    const storagePath = `clips/${Date.now()}_${cleanFileName}`;

    // 1. Direct High-Speed Supabase CDN Upload
    if (supabase) {
      try {
        const { error: uploadErr } = await supabase.storage
          .from('social-published-assets')
          .upload(storagePath, clipBlob, { contentType: 'video/mp4', upsert: true });

        if (!uploadErr) {
          const { data: urlData } = supabase.storage
            .from('social-published-assets')
            .getPublicUrl(storagePath);

          if (urlData?.publicUrl) {
            if (localClip.cleanup_url) {
              fetch(localClip.cleanup_url, { method: 'DELETE' }).catch(() => {});
            }
            return {
              ...localClip,
              public_url: urlData.publicUrl,
              size_mb: Number((clipBlob.size / (1024 * 1024)).toFixed(2)),
            };
          }
        }
      } catch (err) {
        console.warn('Supabase storage direct upload failed, trying drive fallback...', err);
      }
    }

    // 2. Google Drive Fallback
    const sessionResponse = await fetch('/api/social?task=create_r2_upload_session', {
      method: 'POST',
      headers: { ...(await authHeaders()), 'Content-Type': 'application/json' },
      signal,
      body: JSON.stringify({
        fileName: cleanFileName,
        mimeType: 'video/mp4',
        fileSize: clipBlob.size,
      }),
    });
    const session = await sessionResponse.json().catch(() => ({}));
    if (!sessionResponse.ok || !session.uploadUrl || !session.publicUrl) {
      throw new Error(session.error || 'MuviDB could not prepare the temporary video upload.');
    }

    const driveResponse = await fetch(session.uploadUrl, {
      method: 'PUT',
      headers: { 'Content-Type': 'video/mp4' },
      signal,
      body: clipBlob,
    });
    if (!driveResponse.ok) {
      throw new Error('Cloudflare R2 could not store the rendered clip.');
    }

    if (localClip.cleanup_url) {
      fetch(localClip.cleanup_url, { method: 'DELETE' }).catch(() => {});
    }

    return {
      ...localClip,
      public_url: session.publicUrl,
      r2_key: session.key,
      size_mb: Number((clipBlob.size / (1024 * 1024)).toFixed(2)),
    };
  };

  // Fetch and render locally only. Drive upload is deliberately kept as a
  // separate step so an upload/attach failure can never be mistaken for a
  // failed YouTube extraction and retried through the cloud fallback.
  const renderWithDesktopClipper = async (payload, signal) => {
    const response = await fetch(`${LOCAL_CLIPPER_URL}/clip`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal,
      body: JSON.stringify({
        url: payload.url,
        start_time: payload.startTime,
        end_time: payload.endTime,
        aspect_ratio: payload.aspectRatio,
        fit_mode: payload.fitMode === 'contain' ? 'contain' : 'cover',
        title: payload.title,
      }),
    });
    const data = await response.json().catch(() => ({}));
    if (response.status === 202 && data.job_id) {
      // The desktop service renders in the background so a slow YouTube
      // download cannot make the browser report a generic "Failed to fetch".
      for (;;) {
        await new Promise((resolve, reject) => {
          const timer = setTimeout(resolve, 1000);
          if (signal) {
            const abort = () => { clearTimeout(timer); reject(new DOMException('Aborted', 'AbortError')); };
            if (signal.aborted) abort();
            else signal.addEventListener('abort', abort, { once: true });
          }
        });
        const statusResponse = await fetch(data.status_url, { signal });
        const status = await statusResponse.json().catch(() => ({}));
        if (statusResponse.ok && status.success) return status;
        if (!statusResponse.ok) throw new Error(status.detail || status.error || 'The desktop clipper could not finish this video.');
        if (Number.isFinite(status.progress)) setRenderProgress(Math.max(10, Math.min(85, status.progress)));
        setRenderStatusText(`[2/3] ${status.message || 'Processing the clip…'}`);
      }
    }
    if (!response.ok || !data.success) {
      throw new Error(data.detail || data.error || 'The desktop clipper could not render this video.');
    }
    return data;
  };

  const cancelRender = () => {
    renderAbortRef.current?.abort();
    renderAbortRef.current = null;
    if (progressTimerRef.current) clearInterval(progressTimerRef.current);
    setIsRendering(false);
    setRenderStatusText('Render cancelled.');
    toast('Video render cancelled');
  };

  // Free local residential slicing first; the existing cloud extractor remains
  // a fallback for direct MP4s and periods when YouTube is not blocking it.
  const handleRenderAndAttachClip = async () => {
    if (!videoInput.trim() && !videoUrl) {
      return toast.error('Please enter a video URL or YouTube link');
    }
    if (activeTab === 'clip_range' && endTime <= startTime) {
      return toast.error('End time must be greater than start time');
    }

    const startSec = activeTab === 'clip_range' ? startTime : 0;
    const endSec = activeTab === 'clip_range' ? endTime : (duration || 60);
    const sliceLen = Math.max(1, endSec - startSec);

    setIsRendering(true);
    const abortController = new AbortController();
    renderAbortRef.current = abortController;
    setRenderProgress(5);
    setRenderStage(1);
    setRenderStatusText(`[1/3] Preparing ${selectedAspectRatios.length} aspect ratio${selectedAspectRatios.length === 1 ? '' : 's'} (${formatSecondsToTimecode(startSec)} → ${formatSecondsToTimecode(endSec)})...`);

    try {
      const rawTarget = (videoInput.trim() || videoUrl || '').trim();
      let cleanWatchUrl = rawTarget;
      if (rawTarget.includes('youtu.be/')) {
        const vid = rawTarget.split('youtu.be/')[1]?.split('?')[0]?.split('&')[0];
        if (vid) {
          cleanWatchUrl = `https://www.youtube.com/watch?v=${vid}`;
        }
      } else if (rawTarget.includes('embed/')) {
        const vid = rawTarget.split('embed/')[1]?.split('?')[0]?.split('&')[0];
        if (vid) {
          cleanWatchUrl = `https://www.youtube.com/watch?v=${vid}`;
        }
      }

      const ratios = selectedAspectRatios.length ? selectedAspectRatios : [cropAspectRatio];
      for (let index = 0; index < ratios.length; index += 1) {
        const ratio = ratios[index];
        const payload = { url: cleanWatchUrl, startTime: startSec, endTime: endSec, aspectRatio: ratio, fitMode: cropFitMode, title: videoTitle || 'social_clip' };
        setRenderStage(2);
        setRenderProgress(Math.round(10 + (index / ratios.length) * 45));
        setRenderStatusText(`[2/3] Downloading source & rendering ${ratio} crop (${index + 1}/${ratios.length})…`);
        let data;
        let localClip;
        try {
          localClip = await renderWithDesktopClipper(payload, abortController.signal);
        } catch (error) {
          const authFailure = /cookie|sign in|not a bot|youtube needs/i.test(String(error?.message || ''));
          if (authFailure) {
            throw new Error('YouTube authentication failed. Export a fresh cookies.txt while signed in to YouTube, place it in the MuviDB project folder, restart the clipper, and try again.');
          }
          if (/ffmpeg|render the selected crop|requested format is not available/i.test(String(error?.message || ''))) {
            throw new Error(`The desktop clipper could not render this crop. ${error?.message || 'Check that FFmpeg is installed and try again.'}`);
          }
          setRenderStatusText(`[2/3] Desktop clipper unavailable for ${ratio}. Trying cloud fallback…`);
          const res = await fetch('/api/social?task=clip_video', { method: 'POST', headers: { ...(await authHeaders()), 'Content-Type': 'application/json' }, signal: abortController.signal, body: JSON.stringify(payload) });
          data = await res.json().catch(() => ({}));
          if (!res.ok || !data.success) throw new Error(error?.message || data.error || 'The video could not be rendered.');
        }
        if (localClip) {
          // A rendered local file is uploaded directly to CDN storage
          data = await uploadLocalClipToStorage(localClip, abortController.signal);
        }
        setRenderStage(3);
        setRenderProgress(Math.round(55 + ((index + 0.5) / ratios.length) * 40));
        setRenderStatusText(`[3/3] Uploading ${ratio} MP4 to Cloudflare R2 and attaching it…`);
        const clipAsset = { url: data.public_url, public_url: data.public_url, publicUrl: data.public_url, driveFileId: data.drive_file_id, drive_file_id: data.drive_file_id, r2Key: data.r2_key, r2_key: data.r2_key, format: 'custom_video', mediaType: 'video', duration: sliceLen, aspectRatio: ratio, fileName: data.file_name, sizeMb: data.size_mb, title: `${videoTitle || 'Clip'} (${formatSecondsToTimecode(startSec)} - ${formatSecondsToTimecode(endSec)})`, isRenderedMp4: true };
        if (onAttachRenderedVideo) {
          const attached = await onAttachRenderedVideo(clipAsset);
          if (attached === false) throw new Error(`The ${ratio} video was rendered but could not be attached to this draft.`);
        } else onImportToCanvas?.(clipAsset);
        setRenderProgress(Math.round(55 + ((index + 1) / ratios.length) * 40));
      }
      setRenderProgress(100);
      setRenderStatusText(`[Done] ${ratios.length} rendered video${ratios.length === 1 ? '' : 's'} attached to the draft.`);

      toast.success(`🎉 ${cropAspectRatio} Video Clip attached to draft!`);
      renderAbortRef.current = null;
      setTimeout(() => {
        setIsRendering(false);
        onClose();
      }, 1000);
    } catch (err) {
      if (progressTimerRef.current) clearInterval(progressTimerRef.current);
      renderAbortRef.current = null;
      setIsRendering(false);
      if (err?.name === 'AbortError') return;
      console.error('Render clip error:', err);
      toast.error(err.message || 'Could not render video clip. Please check the video link.');
    }
  };

  const clipDuration = Math.max(0, endTime - startTime);
  const isEmbed = videoUrl.includes('youtube.com/embed');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-md">
      <div className="relative flex max-h-[95vh] w-full max-w-4xl flex-col rounded-2xl border border-border bg-[#0f0f13] shadow-2xl overflow-hidden text-white">
        
        {/* Render Progress Overlay Modal */}
        {isRendering && (
          <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/90 p-6 backdrop-blur-lg">
            <div className="w-full max-w-md space-y-5 rounded-2xl border border-white/10 bg-[#16161c] p-6 shadow-2xl text-center">
              <div className="relative mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-brand/20 text-brand border border-brand/40">
                <Icon icon="solar:clapperboard-edit-bold" className="animate-bounce" width="32" />
              </div>

              <div className="space-y-1.5">
                <h3 className="text-base font-black uppercase tracking-wider text-white">
                  Rendering & Attaching Video Clip
                </h3>
                <p className="font-mono text-xs text-brand font-bold">
                  {renderStatusText}
                </p>
              </div>

              {/* Progress Bar */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-mono font-bold text-white/70">
                  <span>Progress Stage {renderStage}/3</span>
                  <span className="text-brand">{renderProgress}%</span>
                </div>
                <div className="h-3 w-full overflow-hidden rounded-full bg-black/60 border border-white/10">
                  <div
                    className="h-full bg-gradient-to-r from-brand via-amber-400 to-emerald-400 transition-all duration-300"
                    style={{ width: `${renderProgress}%` }}
                  />
                </div>
              </div>

              {/* Multi-step Status Items */}
              <div className="space-y-2 rounded-xl bg-black/40 p-3 text-left font-mono text-[11px]">
                <div className={`flex items-center gap-2 ${renderStage >= 1 ? 'text-emerald-400 font-bold' : 'text-white/40'}`}>
                  <Icon icon={renderStage > 1 ? 'solar:check-circle-bold' : 'solar:spinner-linear'} className={renderStage === 1 ? 'animate-spin' : ''} width="14" />
                  <span>1. Slicing source segment ({formatSecondsToTimecode(startTime)} → {formatSecondsToTimecode(endTime)})</span>
                </div>
                <div className={`flex items-center gap-2 ${renderStage >= 2 ? 'text-emerald-400 font-bold' : 'text-white/40'}`}>
                  <Icon icon={renderStage > 2 ? 'solar:check-circle-bold' : 'solar:spinner-linear'} className={renderStage === 2 ? 'animate-spin' : ''} width="14" />
                  <span>2. Applying {cropAspectRatio} {cropFitMode === 'cover' ? 'Vertical Fill' : 'Fit'} 1080x1920 Crop</span>
                </div>
                <div className={`flex items-center gap-2 ${renderStage >= 3 ? 'text-emerald-400 font-bold' : 'text-white/40'}`}>
                  <Icon icon={renderProgress === 100 ? 'solar:check-circle-bold' : 'solar:spinner-linear'} className={renderStage === 3 && renderProgress < 100 ? 'animate-spin' : ''} width="14" />
                  <span>3. Uploading MP4 to Cloud Storage & attaching to variants</span>
                </div>
              </div>

              <p className="text-[11px] text-white/50">
                Please wait a moment while the video is processed with FFmpeg & stored for social publishing.
              </p>
              <button
                type="button"
                onClick={cancelRender}
                className="rounded-lg border border-white/20 bg-white/5 px-4 py-2 text-xs font-bold text-white/80 hover:bg-white/10 hover:text-white"
              >
                Cancel render
              </button>
            </div>
          </div>
        )}

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
                Cut, 9:16 vertical crop, and attach MP4 video clips directly into your drafts
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
            onClick={() => setActiveTab('clip_range')}
            className={`flex flex-1 items-center justify-center gap-2 border-b-2 py-3 text-xs font-black uppercase tracking-wider transition-all ${
              activeTab === 'clip_range'
                ? 'border-brand bg-brand/10 text-brand'
                : 'border-transparent text-white/60 hover:text-white'
            }`}
          >
            <Icon icon="solar:scissors-bold" width="16" />
            <span>Option 1: Clip Video by Start & End Time (TikTok / Reels)</span>
          </button>
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
            <span>Option 2: Use Whole Video</span>
          </button>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Video Preview Player */}
          <div className="relative aspect-video w-full overflow-hidden rounded-xl border border-white/10 bg-black shadow-inner">
            {videoUrl ? (
              isEmbed ? (
                <iframe
                  src={videoUrl}
                  title="Source Video"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  className="h-full w-full border-0"
                />
              ) : (
                <video
                  ref={videoRef}
                  src={videoUrl}
                  onLoadedMetadata={handleLoadedMetadata}
                  onTimeUpdate={handleTimeUpdate}
                  className="h-full w-full object-contain"
                  controls
                  playsInline
                />
              )
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-2 text-white/40">
                <Icon icon="solar:videocamera-record-linear" width="48" />
                <p className="text-xs">Paste video link above and click &quot;Fetch Video&quot; to preview</p>
              </div>
            )}
          </div>

          {/* Aspect Ratio & Framing Controls */}
          <div className="rounded-xl border border-white/10 bg-[#16161c] p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h4 className="text-xs font-black uppercase tracking-wider text-white">Target Framing & Aspect Ratio</h4>
                <p className="text-[10px] text-white/60">Choose the canvas layout for TikTok, Reels, or Instagram</p>
              </div>
              <div className="flex items-center gap-2">
                {[
                  { id: '9:16', label: '9:16 Vertical (TikTok/Reels)' },
                  { id: '1:1', label: '1:1 Square (Feed)' },
                  { id: '4:5', label: '4:5 Portrait' },
                  { id: '16:9', label: '16:9 Landscape' },
                ].map(r => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => {
                      setCropAspectRatio(r.id);
                      setSelectedAspectRatios(current => current.includes(r.id)
                        ? (current.length > 1 ? current.filter(value => value !== r.id) : current)
                        : [...current, r.id]);
                    }}
                    className={`rounded-lg px-3 py-1.5 text-xs font-black transition-all ${
                      selectedAspectRatios.includes(r.id)
                        ? 'bg-brand text-white shadow-md'
                        : 'bg-black/40 text-white/70 hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    {selectedAspectRatios.includes(r.id) ? '✓ ' : ''}{r.label}
                  </button>
                ))}
              </div>
              <p className="mt-2 text-[10px] text-white/50">Select every format you need. They will be rendered and uploaded in one run.</p>
            </div>

            {/* Fit Mode Toggle */}
            <div className="mt-3 flex items-center justify-between border-t border-white/10 pt-3">
              <span className="text-[11px] text-white/70 font-semibold">Scaling Mode:</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setCropFitMode('cover')}
                  className={`rounded-lg px-3 py-1 text-xs font-bold transition-all ${
                    cropFitMode === 'cover'
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                      : 'bg-black/30 text-white/60 hover:text-white'
                  }`}
                >
                  Fill Frame (Zoom Crop - Fills Full Screen)
                </button>
                <button
                  type="button"
                  onClick={() => setCropFitMode('contain')}
                  className={`rounded-lg px-3 py-1 text-xs font-bold transition-all ${
                    cropFitMode === 'contain'
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                      : 'bg-black/30 text-white/60 hover:text-white'
                  }`}
                >
                  Fit Frame (Letterbox)
                </button>
              </div>
            </div>
          </div>

          <div className="flex items-start gap-3 rounded-xl border border-emerald-500/25 bg-emerald-500/10 p-3 text-xs text-emerald-100">
            <Icon icon="solar:laptop-minimalistic-check-linear" width="20" className="mt-0.5 shrink-0 text-emerald-300" />
            <div>
              <p className="font-black">Free desktop processing</p>
              <p className="mt-0.5 text-[11px] leading-5 text-emerald-100/70">
                For reliable YouTube clips, keep <span className="font-mono text-emerald-200">scripts/start-local-social-clipper.ps1</span> running on this computer. The final MP4 goes directly to temporary Google Drive storage—never through Vercel or Supabase.
              </p>
            </div>
          </div>

          {/* Timecode & Action Controls */}
          {activeTab === 'clip_range' && (
            <div className="rounded-xl border border-white/10 bg-[#16161c] p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between border-b border-white/10 pb-3 gap-3">
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
                  
                  {/* Preview Loop Button */}
                  <button
                    type="button"
                    onClick={handlePreviewClip}
                    disabled={!videoUrl || clipDuration <= 0}
                    className={`inline-flex items-center gap-1.5 rounded-xl border px-3.5 py-2 text-xs font-black uppercase tracking-wider transition-all ${
                      isPreviewingClip
                        ? 'border-amber-500/50 bg-amber-500/20 text-amber-300 ring-1 ring-amber-500/40'
                        : 'border-white/20 bg-black/40 text-white hover:bg-white/10'
                    }`}
                  >
                    <Icon icon={isPlaying && isPreviewingClip ? 'solar:pause-bold' : 'solar:play-bold'} width="14" />
                    <span>{isPreviewingClip ? 'Pause Loop' : 'Preview Loop'}</span>
                  </button>

                  {/* Canvas Preview Button */}
                  <button
                    type="button"
                    onClick={() => handleApplyPreviewToCanvas('clip')}
                    disabled={!videoUrl || clipDuration <= 0}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-white/20 bg-black/40 px-3.5 py-2 text-xs font-black uppercase tracking-wider text-white hover:bg-white/10 disabled:opacity-50"
                  >
                    <Icon icon="solar:eye-bold" width="14" />
                    <span>Canvas Preview</span>
                  </button>

                  {/* Primary Cut, Crop & Attach MP4 Video Button */}
                  <button
                    type="button"
                    onClick={handleRenderAndAttachClip}
                    disabled={!videoUrl || clipDuration <= 0 || isRendering}
                    className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-brand to-amber-500 px-5 py-2.5 text-xs font-black uppercase tracking-wider text-white hover:opacity-90 disabled:opacity-50 shadow-lg"
                    title="Cuts precise segment, crops to 1:1 or 9:16, and attaches MP4 video to draft"
                  >
                    <Icon icon="solar:clapperboard-edit-bold" width="16" />
                    <span>🎬 Cut, Crop & Attach MP4 Video</span>
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
            </div>
          )}

          {activeTab === 'whole_video' && (
            <div className="rounded-xl border border-white/10 bg-[#16161c] p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-black text-white">Full Video Importer</h4>
                  <p className="text-xs text-white/60">Import whole video directly into draft without trimming</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleApplyPreviewToCanvas('whole')}
                    className="rounded-xl border border-white/20 bg-black/40 px-4 py-2.5 text-xs font-black uppercase text-white hover:bg-white/10"
                  >
                    Canvas Preview
                  </button>
                  <button
                    type="button"
                    onClick={handleRenderAndAttachClip}
                    disabled={!videoUrl || isRendering}
                    className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-brand to-amber-500 px-5 py-2.5 text-xs font-black uppercase tracking-wider text-white hover:opacity-90 shadow-lg"
                  >
                    <Icon icon="solar:clapperboard-edit-bold" width="16" />
                    <span>🎬 Render & Attach Full Video</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
