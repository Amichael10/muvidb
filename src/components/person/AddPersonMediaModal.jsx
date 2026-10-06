import { useState, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { Icon } from '@iconify/react';
import toast from 'react-hot-toast';

const VIDEO_CATEGORIES = [
  { value: 'showreel', label: 'Showreel / Demo Reel' },
  { value: 'monologue', label: 'Monologue / Audition Tape' },
  { value: 'scene_clip', label: 'Scene Clip' },
  { value: 'interview', label: 'Interview / Press' },
  { value: 'behind_the_scenes', label: 'Behind the Scenes' },
  { value: 'red_carpet', label: 'Red Carpet / Premiere' },
];

const PHOTO_CATEGORIES = [
  { value: 'headshot', label: 'Headshot / Portrait' },
  { value: 'production_still', label: 'Production Still' },
  { value: 'behind_the_scenes', label: 'Behind the Scenes' },
  { value: 'red_carpet', label: 'Red Carpet / Event' },
];

export default function AddPersonMediaModal({
  person,
  initialType = 'video',
  onClose,
  onMediaAdded,
}) {
  const { user } = useAuth();
  const [mediaType, setMediaType] = useState(initialType);
  const [category, setCategory] = useState(
    initialType === 'video' ? 'showreel' : 'headshot'
  );
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [url, setUrl] = useState('');
  const [thumbnailUrl, setThumbnailUrl] = useState('');
  const [coverMode, setCoverMode] = useState('link'); // 'link' | 'upload'
  const [isUploadingCover, setIsUploadingCover] = useState(false);
  const fileInputRef = useRef(null);
  const [photoMode, setPhotoMode] = useState('upload'); // 'link' | 'upload'
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const photoFileInputRef = useRef(null);
  const [videoMode, setVideoMode] = useState('link'); // 'link' | 'upload'
  const [isUploadingVideo, setIsUploadingVideo] = useState(false);
  const videoFileInputRef = useRef(null);
  const [durationStr, setDurationStr] = useState('');
  const [filmId, setFilmId] = useState('');
  const [characterName, setCharacterName] = useState('');
  const [photographerCredit, setPhotographerCredit] = useState('');
  const [year, setYear] = useState(new Date().getFullYear().toString());
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Parse YouTube or Vimeo URL for helper auto-fill
  const handleUrlChange = (val) => {
    setUrl(val);
    if (!thumbnailUrl && (val.includes('youtube.com') || val.includes('youtu.be'))) {
      const match = val.match(/(?:v=|youtu\.be\/)([^&?]+)/);
      if (match && match[1]) {
        setThumbnailUrl(`https://img.youtube.com/vi/${match[1]}/hqdefault.jpg`);
      }
    }
  };

  const handleVideoFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('video/')) {
      toast.error('Please select a video file (MP4, WebM, MOV)');
      return;
    }

    try {
      setIsUploadingVideo(true);
      const presignRes = await fetch('/api/person-media?action=presign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileName: file.name,
          mimeType: file.type || 'video/mp4',
          personName: person.name,
          personId: person.id,
        }),
      });
      const presignJson = await presignRes.json();
      if (!presignRes.ok || !presignJson.uploadUrl) {
        throw new Error(presignJson.error || 'Failed to prepare video upload');
      }

      const uploadRes = await fetch(presignJson.uploadUrl, {
        method: 'PUT',
        headers: {
          'Content-Type': file.type || 'video/mp4',
        },
        body: file,
      });

      if (!uploadRes.ok) {
        throw new Error(`Video upload to Cloudflare failed (${uploadRes.status})`);
      }

      setUrl(presignJson.publicUrl);

      if (!title) {
        const cleanTitle = file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
        setTitle(cleanTitle);
      }

      const videoEl = document.createElement('video');
      videoEl.preload = 'metadata';
      videoEl.onloadedmetadata = () => {
        window.URL.revokeObjectURL(videoEl.src);
        const durationSecs = Math.round(videoEl.duration);
        if (durationSecs && !durationStr) {
          const mins = Math.floor(durationSecs / 60);
          const secs = durationSecs % 60;
          setDurationStr(`${mins}:${secs < 10 ? '0' : ''}${secs}`);
        }
      };
      videoEl.src = URL.createObjectURL(file);

      toast.success('Video uploaded to Cloudflare R2!');
    } catch (err) {
      console.error('Video upload error:', err);
      toast.error('Video upload failed: ' + err.message);
    } finally {
      setIsUploadingVideo(false);
    }
  };

  const handlePhotoFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file (JPG, PNG, WebP)');
      return;
    }

    try {
      setIsUploadingPhoto(true);
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const base64 = reader.result;
          const res = await fetch('/api/person-media?action=upload', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              fileBase64: base64,
              fileName: file.name,
              mimeType: file.type,
              personName: person.name,
              personId: person.id,
            }),
          });
          const json = await res.json();
          if (!res.ok) throw new Error(json.error || 'Upload failed');
          setUrl(json.url);
          if (!title) {
            const cleanTitle = file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
            setTitle(cleanTitle);
          }
          toast.success('Photo uploaded to Cloudflare!');
        } catch (err) {
          toast.error('Photo upload failed: ' + err.message);
        } finally {
          setIsUploadingPhoto(false);
        }
      };
      reader.readAsDataURL(file);
    } catch (err) {
      setIsUploadingPhoto(false);
      toast.error(err.message);
    }
  };

  const handleCoverFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file (JPG, PNG, WebP)');
      return;
    }

    try {
      setIsUploadingCover(true);
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const base64 = reader.result;
          const res = await fetch('/api/person-media?action=upload', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              fileBase64: base64,
              fileName: file.name,
              mimeType: file.type,
              personName: person.name,
              personId: person.id,
            }),
          });
          const json = await res.json();
          if (!res.ok) throw new Error(json.error || 'Upload failed');
          setThumbnailUrl(json.url);
          toast.success('Cover image uploaded to Cloudflare!');
        } catch (err) {
          toast.error('Cover upload failed: ' + err.message);
        } finally {
          setIsUploadingCover(false);
        }
      };
      reader.readAsDataURL(file);
    } catch (err) {
      setIsUploadingCover(false);
      toast.error(err.message);
    }
  };

  const handleTypeSwitch = (type) => {
    setMediaType(type);
    setCategory(type === 'video' ? 'showreel' : 'headshot');
  };

  const parseDurationToSeconds = (str) => {
    if (!str) return null;
    if (str.includes(':')) {
      const parts = str.split(':').map((p) => parseInt(p, 10));
      if (parts.length === 2) return parts[0] * 60 + parts[1];
      if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
    }
    const num = parseInt(str, 10);
    return isNaN(num) ? null : num;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim()) {
      toast.error('Please enter a title for the media');
      return;
    }
    if (!url.trim()) {
      toast.error(mediaType === 'photo' ? 'Please upload a photo or enter an image URL' : 'Please upload a video file or enter a video URL');
      return;
    }

    try {
      setIsSubmitting(true);

      let embedProvider = null;
      let embedId = null;

      if (mediaType === 'video') {
        if (url.includes('youtube.com') || url.includes('youtu.be')) {
          embedProvider = 'youtube';
          const match = url.match(/(?:v=|youtu\.be\/|embed\/|shorts\/)([^&?#/]+)/);
          if (match) embedId = match[1];
        } else if (url.includes('vimeo.com')) {
          embedProvider = 'vimeo';
          const match = url.match(/vimeo\.com\/(?:channels\/(?:\w+\/)?|groups\/([^\/]*)\/videos\/|album\/(\d+)\/video\/|video\/|)(\d+)/) || url.match(/vimeo\.com\/(\d+)/);
          if (match) embedId = match[3] || match[1] || match[0];
        } else if (url.includes('drive.google.com')) {
          embedProvider = 'gdrive';
          const match = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/) || url.match(/id=([a-zA-Z0-9_-]+)/);
          if (match) embedId = match[1];
        } else if (url.includes('dailymotion.com') || url.includes('dai.ly')) {
          embedProvider = 'dailymotion';
          const match = url.match(/(?:video\/|dai\.ly\/)([a-zA-Z0-9]+)/);
          if (match) embedId = match[1];
        } else {
          embedProvider = 'direct';
        }
      }

      const durationSeconds = parseDurationToSeconds(durationStr);

      // Moderation: Admins and verified profile owners are approved immediately.
      // General public and unverified submissions are marked 'pending' for review.
      const isOwner = Boolean(user && person?.claimed_by && person.claimed_by === user.id);
      const isAdmin = Boolean(
        user?.user_metadata?.role === 'admin' ||
        user?.app_metadata?.role === 'admin' ||
        user?.email?.endsWith('@muvidb.com') ||
        user?.email === 'admin@muvidb.com'
      );
      const moderationStatus = (isAdmin || isOwner) ? 'approved' : 'pending';

      const payload = {
        person_id: person.id,
        media_type: mediaType,
        category,
        title: title.trim(),
        description: description.trim() || null,
        url: url.trim(),
        thumbnail_url: thumbnailUrl.trim() || null,
        embed_provider: embedProvider,
        embed_id: embedId,
        duration_seconds: durationSeconds,
        film_id: filmId || null,
        character_name: characterName.trim() || null,
        photographer_credit: photographerCredit.trim() || null,
        year: year ? parseInt(year, 10) : null,
        status: moderationStatus,
        uploaded_by: user?.id || null,
      };

      const res = await fetch('/api/person-media', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const resJson = await res.json();
      if (!res.ok) {
        throw new Error(resJson.error || 'Failed to save media');
      }
      const data = resJson.data;

      if (moderationStatus === 'pending') {
        toast.success('Thank you! Your submission was received and will be live once approved.', { duration: 5000 });
      } else {
        toast.success('Media added successfully!');
      }

      if (moderationStatus === 'approved') {
        onMediaAdded?.(data);
      }
      onClose();
    } catch (err) {
      console.error('Error adding media:', err);
      toast.error(err.message || 'Failed to add media');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Get list of actor's credited films for tagging
  const creditedFilms = (person.credits || [])
    .map((c) => c.films)
    .filter(Boolean)
    .filter((f, idx, arr) => arr.findIndex((x) => x.id === f.id) === idx);

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="absolute inset-0" onClick={onClose} />

      <div className="relative z-10 w-full max-w-xl bg-surface border border-border rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-surface-2/60">
          <div className="flex items-center gap-2">
            <Icon icon="solar:clapperboard-play-linear" className="text-brand text-xl" />
            <h3 className="font-heading font-bold text-lg text-text-primary">
              Add Media to Profile
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-text-muted hover:text-text-primary transition-colors p-1"
            aria-label="Close"
          >
            <Icon icon="solar:close-circle-linear" width="20" />
          </button>
        </div>

        {/* Modal Body / Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto">
          {/* Media Type Switch */}
          <div className="grid grid-cols-2 gap-2 bg-surface-2 p-1 rounded-xl border border-border">
            <button
              type="button"
              onClick={() => handleTypeSwitch('video')}
              className={`flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold transition-all ${
                mediaType === 'video'
                  ? 'bg-brand text-white shadow-sm'
                  : 'text-text-muted hover:text-text-primary'
              }`}
            >
              <Icon icon="solar:videocamera-record-bold" width="16" />
              <span>Video / Showreel</span>
            </button>
            <button
              type="button"
              onClick={() => handleTypeSwitch('photo')}
              className={`flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold transition-all ${
                mediaType === 'photo'
                  ? 'bg-brand text-white shadow-sm'
                  : 'text-text-muted hover:text-text-primary'
              }`}
            >
              <Icon icon="solar:gallery-bold" width="16" />
              <span>Photo / Still</span>
            </button>
          </div>

          {/* Category Selection */}
          <div>
            <label className="block text-xs font-bold text-text-secondary uppercase tracking-wider mb-1.5">
              Category
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full bg-surface-2 border border-border rounded-lg px-3.5 py-2.5 text-sm text-text-primary focus:border-brand outline-none transition-colors"
            >
              {(mediaType === 'video' ? VIDEO_CATEGORIES : PHOTO_CATEGORIES).map((cat) => (
                <option key={cat.value} value={cat.value}>
                  {cat.label}
                </option>
              ))}
            </select>
          </div>

          {/* Title */}
          <div>
            <label className="block text-xs font-bold text-text-secondary uppercase tracking-wider mb-1.5">
              Title *
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={mediaType === 'video' ? 'e.g. 2026 Dramatic Showreel' : 'e.g. Premiere Red Carpet Portrait'}
              className="w-full bg-surface-2 border border-border rounded-lg px-3.5 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:border-brand outline-none transition-colors"
            />
          </div>

          {/* Photo Media Input (Upload or Link) */}
          {mediaType === 'photo' ? (
            <div className="space-y-3 bg-surface-2/40 p-3.5 rounded-xl border border-border">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-bold text-text-primary uppercase tracking-wider">
                  Photo / Still Image *
                </label>
                <div className="flex items-center bg-surface border border-border rounded-lg p-0.5 text-[11px] font-bold">
                  <button
                    type="button"
                    onClick={() => setPhotoMode('upload')}
                    className={`px-2.5 py-1 rounded-md transition ${
                      photoMode === 'upload'
                        ? 'bg-brand text-white shadow-xs'
                        : 'text-text-muted hover:text-text-primary'
                    }`}
                  >
                    Upload Photo
                  </button>
                  <button
                    type="button"
                    onClick={() => setPhotoMode('link')}
                    className={`px-2.5 py-1 rounded-md transition ${
                      photoMode === 'link'
                        ? 'bg-brand text-white shadow-xs'
                        : 'text-text-muted hover:text-text-primary'
                    }`}
                  >
                    Paste Link
                  </button>
                </div>
              </div>

              {photoMode === 'upload' ? (
                <div className="space-y-2">
                  <input
                    type="file"
                    ref={photoFileInputRef}
                    accept="image/png,image/jpeg,image/webp,image/jpg"
                    onChange={handlePhotoFileUpload}
                    className="hidden"
                  />
                  <button
                    type="button"
                    disabled={isUploadingPhoto}
                    onClick={() => photoFileInputRef.current?.click()}
                    className="w-full flex items-center justify-center gap-2 py-4 px-4 rounded-xl border-2 border-dashed border-border hover:border-brand/70 bg-surface text-text-primary text-xs font-bold transition hover:bg-surface-2 cursor-pointer disabled:opacity-50"
                  >
                    {isUploadingPhoto ? (
                      <>
                        <Icon icon="solar:spinner-bold" width="18" className="animate-spin text-brand" />
                        <span>Uploading to Cloudflare R2...</span>
                      </>
                    ) : (
                      <>
                        <Icon icon="solar:upload-track-linear" width="18" className="text-brand" />
                        <span>{url ? 'Change Photo (JPG, PNG, WebP)' : 'Click to Upload Photo (JPG, PNG, WebP)'}</span>
                      </>
                    )}
                  </button>

                  {url && (
                    <div className="flex items-center gap-3 p-2 bg-surface rounded-xl border border-border">
                      <img
                        src={url}
                        alt="Photo Preview"
                        className="h-16 w-16 object-cover rounded-lg border border-border shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-text-primary truncate">Uploaded to Cloudflare</p>
                        <p className="text-[11px] text-text-muted truncate">{url}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setUrl('')}
                        className="p-1 text-red-500 hover:text-red-400 transition"
                        title="Remove photo"
                      >
                        <Icon icon="solar:trash-bin-trash-bold" width="18" />
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  <input
                    type="url"
                    required={mediaType === 'photo' && photoMode === 'link'}
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder="https://.../photo.jpg"
                    className="w-full bg-surface border border-border rounded-lg px-3.5 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:border-brand outline-none transition-colors"
                  />
                  {url && (
                    <div className="flex items-center gap-3 p-2 bg-surface rounded-xl border border-border">
                      <img
                        src={url}
                        alt="Photo Preview"
                        className="h-16 w-16 object-cover rounded-lg border border-border shrink-0"
                        onError={(e) => { e.currentTarget.style.display = 'none'; }}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-text-primary truncate">Image Link</p>
                        <p className="text-[11px] text-text-muted truncate">{url}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setUrl('')}
                        className="p-1 text-red-500 hover:text-red-400 transition"
                        title="Clear link"
                      >
                        <Icon icon="solar:trash-bin-trash-bold" width="18" />
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            /* Video Media Input (Upload or Link) */
            <div className="space-y-3 bg-surface-2/40 p-3.5 rounded-xl border border-border">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-bold text-text-primary uppercase tracking-wider">
                  Video Source *
                </label>
                <div className="flex items-center bg-surface border border-border rounded-lg p-0.5 text-[11px] font-bold">
                  <button
                    type="button"
                    onClick={() => setVideoMode('link')}
                    className={`px-2.5 py-1 rounded-md transition ${
                      videoMode === 'link'
                        ? 'bg-brand text-white shadow-xs'
                        : 'text-text-muted hover:text-text-primary'
                    }`}
                  >
                    Paste Link
                  </button>
                  <button
                    type="button"
                    onClick={() => setVideoMode('upload')}
                    className={`px-2.5 py-1 rounded-md transition ${
                      videoMode === 'upload'
                        ? 'bg-brand text-white shadow-xs'
                        : 'text-text-muted hover:text-text-primary'
                    }`}
                  >
                    Upload Video
                  </button>
                </div>
              </div>

              {videoMode === 'upload' ? (
                <div className="space-y-2">
                  <input
                    type="file"
                    ref={videoFileInputRef}
                    accept="video/mp4,video/webm,video/quicktime,video/x-m4v"
                    onChange={handleVideoFileUpload}
                    className="hidden"
                  />
                  <button
                    type="button"
                    disabled={isUploadingVideo}
                    onClick={() => videoFileInputRef.current?.click()}
                    className="w-full flex items-center justify-center gap-2 py-4 px-4 rounded-xl border-2 border-dashed border-border hover:border-brand/70 bg-surface text-text-primary text-xs font-bold transition hover:bg-surface-2 cursor-pointer disabled:opacity-50"
                  >
                    {isUploadingVideo ? (
                      <>
                        <Icon icon="solar:spinner-bold" width="18" className="animate-spin text-brand" />
                        <span>Uploading directly to Cloudflare R2...</span>
                      </>
                    ) : (
                      <>
                        <Icon icon="solar:videocamera-record-bold" width="18" className="text-brand" />
                        <span>{url ? 'Change Video File (MP4, WebM, MOV)' : 'Click to Upload Video File (MP4, WebM, MOV)'}</span>
                      </>
                    )}
                  </button>

                  {url && (
                    <div className="space-y-2 p-2.5 bg-surface rounded-xl border border-border">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Icon icon="solar:check-circle-bold" width="16" className="text-emerald-500" />
                          <span className="text-xs font-semibold text-text-primary">Uploaded to Cloudflare R2</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setUrl('')}
                          className="text-xs text-red-500 hover:text-red-400 font-medium"
                        >
                          Remove
                        </button>
                      </div>
                      <video
                        src={url}
                        controls
                        className="w-full max-h-48 rounded-lg bg-black object-contain"
                      />
                      <p className="text-[10px] text-text-muted truncate">{url}</p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  <input
                    type="url"
                    required={mediaType === 'video' && videoMode === 'link'}
                    value={url}
                    onChange={(e) => handleUrlChange(e.target.value)}
                    placeholder="https://www.youtube.com/watch?v=... (or Vimeo / MP4)"
                    className="w-full bg-surface border border-border rounded-lg px-3.5 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:border-brand outline-none transition-colors"
                  />
                  <p className="text-[11px] text-text-muted">
                    Supports YouTube, Vimeo, Google Drive preview links, or direct MP4 URLs.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Video Specific: Cover / Thumbnail (Optional) & Duration */}
          {mediaType === 'video' && (
            <div className="space-y-3 bg-surface-2/40 p-3.5 rounded-xl border border-border">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-bold text-text-primary uppercase tracking-wider">
                  Video Cover / Thumbnail <span className="text-text-muted font-normal lowercase">(optional)</span>
                </label>
                <div className="flex items-center bg-surface border border-border rounded-lg p-0.5 text-[11px] font-bold">
                  <button
                    type="button"
                    onClick={() => setCoverMode('link')}
                    className={`px-2.5 py-1 rounded-md transition ${
                      coverMode === 'link'
                        ? 'bg-brand text-white shadow-xs'
                        : 'text-text-muted hover:text-text-primary'
                    }`}
                  >
                    Paste Link
                  </button>
                  <button
                    type="button"
                    onClick={() => setCoverMode('upload')}
                    className={`px-2.5 py-1 rounded-md transition ${
                      coverMode === 'upload'
                        ? 'bg-brand text-white shadow-xs'
                        : 'text-text-muted hover:text-text-primary'
                    }`}
                  >
                    Upload Cover
                  </button>
                </div>
              </div>

              {coverMode === 'upload' ? (
                <div className="flex items-center gap-3">
                  <input
                    type="file"
                    ref={fileInputRef}
                    accept="image/png,image/jpeg,image/webp,image/jpg"
                    onChange={handleCoverFileUpload}
                    className="hidden"
                  />
                  <button
                    type="button"
                    disabled={isUploadingCover}
                    onClick={() => fileInputRef.current?.click()}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl border border-dashed border-border hover:border-brand/70 bg-surface text-text-primary text-xs font-bold transition hover:bg-surface-2 cursor-pointer disabled:opacity-50"
                  >
                    {isUploadingCover ? (
                      <>
                        <Icon icon="solar:spinner-bold" width="16" className="animate-spin text-brand" />
                        <span>Uploading to Cloudflare...</span>
                      </>
                    ) : (
                      <>
                        <Icon icon="solar:upload-track-linear" width="16" className="text-brand" />
                        <span>Upload Cover Image (JPG, PNG, WebP)</span>
                      </>
                    )}
                  </button>
                  {thumbnailUrl && (
                    <div className="relative group shrink-0">
                      <img
                        src={thumbnailUrl}
                        alt="Cover Preview"
                        className="h-11 w-18 object-cover rounded-lg border border-border"
                      />
                      <button
                        type="button"
                        onClick={() => setThumbnailUrl('')}
                        className="absolute -top-1.5 -right-1.5 h-4 w-4 rounded-full bg-red-600 text-white grid place-items-center shadow"
                        title="Remove cover"
                      >
                        <Icon icon="solar:close-circle-bold" width="12" />
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <input
                    type="url"
                    value={thumbnailUrl}
                    onChange={(e) => setThumbnailUrl(e.target.value)}
                    placeholder="https://... (auto-detected for YouTube or leave empty)"
                    className="flex-1 bg-surface border border-border rounded-lg px-3.5 py-2 text-xs text-text-primary placeholder:text-text-muted focus:border-brand outline-none transition-colors"
                  />
                  {thumbnailUrl && (
                    <div className="relative group shrink-0">
                      <img
                        src={thumbnailUrl}
                        alt="Cover Preview"
                        className="h-10 w-16 object-cover rounded-lg border border-border"
                      />
                      <button
                        type="button"
                        onClick={() => setThumbnailUrl('')}
                        className="absolute -top-1.5 -right-1.5 h-4 w-4 rounded-full bg-red-600 text-white grid place-items-center shadow"
                        title="Clear"
                      >
                        <Icon icon="solar:close-circle-bold" width="12" />
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Video Duration Field */}
              <div className="pt-1">
                <label className="block text-[11px] font-bold text-text-secondary uppercase tracking-wider mb-1">
                  Duration <span className="text-text-muted font-normal lowercase">(e.g. 2:15 or 135s - optional)</span>
                </label>
                <input
                  type="text"
                  value={durationStr}
                  onChange={(e) => setDurationStr(e.target.value)}
                  placeholder="e.g. 2:15"
                  className="w-full bg-surface border border-border rounded-lg px-3.5 py-2 text-xs text-text-primary placeholder:text-text-muted focus:border-brand outline-none transition-colors"
                />
              </div>
            </div>
          )}

          {/* Photo Specific: Photographer Credit */}
          {mediaType === 'photo' && (
            <div>
              <label className="block text-xs font-bold text-text-secondary uppercase tracking-wider mb-1.5">
                Photographer Credit (Optional)
              </label>
              <input
                type="text"
                value={photographerCredit}
                onChange={(e) => setPhotographerCredit(e.target.value)}
                placeholder="e.g. Kelechi Amadi-Obi"
                className="w-full bg-surface-2 border border-border rounded-lg px-3.5 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:border-brand outline-none transition-colors"
              />
            </div>
          )}

          {/* Tagged Film & Character Name */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-text-secondary uppercase tracking-wider mb-1.5">
                Tag to Movie (Optional)
              </label>
              <select
                value={filmId}
                onChange={(e) => setFilmId(e.target.value)}
                className="w-full bg-surface-2 border border-border rounded-lg px-3.5 py-2.5 text-sm text-text-primary focus:border-brand outline-none transition-colors"
              >
                <option value="">None / Independent</option>
                {creditedFilms.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.title} {f.year ? `(${f.year})` : ''}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-text-secondary uppercase tracking-wider mb-1.5">
                Character Name (Optional)
              </label>
              <input
                type="text"
                value={characterName}
                onChange={(e) => setCharacterName(e.target.value)}
                placeholder="e.g. Agent Bola"
                className="w-full bg-surface-2 border border-border rounded-lg px-3.5 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:border-brand outline-none transition-colors"
              />
            </div>
          </div>

          {/* Year & Description */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-bold text-text-secondary uppercase tracking-wider mb-1.5">
                Year
              </label>
              <input
                type="number"
                value={year}
                onChange={(e) => setYear(e.target.value)}
                className="w-full bg-surface-2 border border-border rounded-lg px-3.5 py-2.5 text-sm text-text-primary focus:border-brand outline-none transition-colors"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-text-secondary uppercase tracking-wider mb-1.5">
                Description / Notes
              </label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Brief contextual note"
                className="w-full bg-surface-2 border border-border rounded-lg px-3.5 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:border-brand outline-none transition-colors"
              />
            </div>
          </div>

          {/* Submit Action */}
          <div className="pt-4 flex items-center justify-end gap-3 border-t border-border">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-lg border border-border hover:bg-surface-2 text-text-secondary text-xs font-bold transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-6 py-2.5 rounded-lg bg-brand text-white hover:shadow-brand/20 text-xs font-bold transition-all disabled:opacity-50 flex items-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <Icon icon="solar:spinner-linear" className="animate-spin text-base" />
                  <span>Saving...</span>
                </>
              ) : (
                <span>Save to Profile</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
