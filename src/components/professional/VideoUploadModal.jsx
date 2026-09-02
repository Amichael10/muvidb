import { useState } from 'react';
import { Icon } from '@iconify/react';
import { toast } from 'react-hot-toast';
import { supabase } from '../../lib/supabase';
import { authHeaders } from '../../lib/apiAuth';

const VIDEO_CATEGORIES = [
  { id: 'showreel', label: 'Official Showreel / Acting Reel', desc: 'Curated montage showcasing your best performances' },
  { id: 'monologue', label: 'Dramatic Monologue', desc: 'Solo audition monologue or dramatic character reading' },
  { id: 'scene_clip', label: 'Film / TV Scene Clip', desc: 'Standout scene from a specific movie or series' },
  { id: 'interview', label: 'Interview & Press', desc: 'Media feature, red carpet interview, or podcast appearance' },
  { id: 'audition', label: 'Audition Tape / Self-Tape', desc: 'Unlisted or public casting self-tape' }
];

export default function VideoUploadModal({ person, credits = [], onClose, onSaved }) {
  const [sourceType, setSourceType] = useState('url'); // 'url' | 'upload'
  const [videoUrl, setVideoUrl] = useState('');
  const [file, setFile] = useState(null);
  const [category, setCategory] = useState('showreel');
  const [title, setTitle] = useState('');
  const [characterName, setCharacterName] = useState('');
  const [taggedFilmId, setTaggedFilmId] = useState('');
  const [year, setYear] = useState(new Date().getFullYear());
  const [isFeatured, setIsFeatured] = useState(false);
  const [uploading, setUploading] = useState(false);

  // Extract YouTube or Vimeo ID
  const parseVideoEmbed = (url) => {
    if (!url) return null;
    const ytMatch = url.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i);
    if (ytMatch && ytMatch[1]) {
      return {
        provider: 'youtube',
        id: ytMatch[1],
        url: `https://www.youtube.com/watch?v=${ytMatch[1]}`,
        thumbnail: `https://i.ytimg.com/vi/${ytMatch[1]}/hqdefault.jpg`
      };
    }
    const vimeoMatch = url.match(/(?:vimeo\.com\/)(\d+)/i);
    if (vimeoMatch && vimeoMatch[1]) {
      return {
        provider: 'vimeo',
        id: vimeoMatch[1],
        url: `https://vimeo.com/${vimeoMatch[1]}`,
        thumbnail: 'https://images.unsplash.com/photo-1574717024653-61fd2cf4d44d?auto=format&fit=crop&w=800&q=80'
      };
    }
    return {
      provider: 'direct',
      id: null,
      url,
      thumbnail: 'https://images.unsplash.com/photo-1536440136628-849c177e76a1?auto=format&fit=crop&w=800&q=80'
    };
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (sourceType === 'url' && !videoUrl.trim()) {
      toast.error('Please enter a YouTube or Vimeo link');
      return;
    }

    if (sourceType === 'upload' && !file) {
      toast.error('Please select a video file (MP4, MOV)');
      return;
    }

    setUploading(true);
    try {
      let finalUrl = videoUrl.trim();
      let embedProvider = 'youtube';
      let embedId = null;
      let thumbnailUrl = 'https://images.unsplash.com/photo-1478760329108-5c3ed9d495a0?auto=format&fit=crop&w=800&q=80';

      if (sourceType === 'upload' && file) {
        // Direct MP4 R2 Presigned Upload
        const uploadSessionRes = await fetch('/api/social?task=create_r2_upload_url', {
          method: 'POST',
          headers: await authHeaders(),
          body: JSON.stringify({
            fileName: `videos/${person.slug || person.id}_${Date.now()}_${file.name}`,
            mimeType: file.type || 'video/mp4'
          })
        });

        if (uploadSessionRes.ok) {
          const session = await uploadSessionRes.json();
          if (session?.uploadUrl) {
            const putRes = await fetch(session.uploadUrl, {
              method: 'PUT',
              headers: { 'Content-Type': file.type || 'video/mp4' },
              body: file
            });
            if (putRes.ok) {
              finalUrl = session.publicUrl;
              embedProvider = 'r2';
            }
          }
        }
      } else {
        const parsed = parseVideoEmbed(videoUrl);
        if (parsed) {
          embedProvider = parsed.provider;
          embedId = parsed.id;
          finalUrl = parsed.url;
          thumbnailUrl = parsed.thumbnail;
        }
      }

      // Check if film title should be tagged
      const selectedCredit = credits.find(c => c.film_id === taggedFilmId || c.films?.id === taggedFilmId);
      const filmTitle = selectedCredit?.films?.title || null;

      const newVideoItem = {
        id: `video_${Date.now()}`,
        type: 'video',
        category,
        title: title || `${person.name} - ${category.toUpperCase()}`,
        url: finalUrl,
        thumbnail: thumbnailUrl,
        embed_provider: embedProvider,
        embed_id: embedId,
        film_id: taggedFilmId || null,
        film_title: filmTitle,
        character_name: characterName || selectedCredit?.character_name || null,
        year: Number(year) || new Date().getFullYear(),
        is_featured: isFeatured,
        created_at: new Date().toISOString()
      };

      // Retrieve existing highlights
      const currentStats = person.youtube_stats || {};
      const existingHighlights = Array.isArray(currentStats.instagram_highlights)
        ? [...currentStats.instagram_highlights]
        : [];

      if (isFeatured) {
        // Unmark other featured videos
        existingHighlights.forEach(h => {
          if (h.type === 'video') h.is_featured = false;
        });
      }

      const updatedHighlights = [newVideoItem, ...existingHighlights];

      const { error: dbError } = await supabase
        .from('people')
        .update({
          youtube_stats: {
            ...currentStats,
            instagram_highlights: updatedHighlights
          },
          updated_at: new Date().toISOString()
        })
        .eq('id', person.id);

      if (dbError) throw dbError;

      toast.success(isFeatured ? 'Video added and pinned as your main featured showreel!' : 'Video added to portfolio!');
      onSaved?.();
      onClose();
    } catch (err) {
      console.error('Video upload error:', err);
      toast.error(err.message || 'Failed to save video. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/80 p-4 backdrop-blur-md">
      <div className="relative w-full max-w-2xl rounded-3xl border border-white/10 bg-[#171717] p-6 shadow-2xl md:p-8">
        <button
          onClick={onClose}
          className="absolute right-6 top-6 grid h-9 w-9 place-items-center rounded-full bg-white/[.05] text-text-muted hover:bg-white/10 hover:text-white"
        >
          <Icon icon="solar:close-circle-linear" width="22" />
        </button>

        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand/10 text-brand">
            <Icon icon="solar:videocamera-record-bold" width="22" />
          </span>
          <div>
            <p className="text-[10px] font-black uppercase tracking-[.25em] text-brand">Reels & Performance Hub</p>
            <h2 className="text-xl font-black text-text-primary">Add Showreel or Performance Video</h2>
          </div>
        </div>

        {/* Source Toggle */}
        <div className="mt-6 flex rounded-2xl border border-white/10 bg-white/[.02] p-1.5">
          <button
            type="button"
            onClick={() => setSourceType('url')}
            className={`flex flex-1 items-center justify-center gap-2 rounded-xl py-2.5 text-xs font-black transition ${
              sourceType === 'url' ? 'bg-brand text-white shadow-lg shadow-brand/15' : 'text-text-muted hover:text-white'
            }`}
          >
            <Icon icon="logos:youtube-icon" width="16" /> Link YouTube / Vimeo
          </button>
          <button
            type="button"
            onClick={() => setSourceType('upload')}
            className={`flex flex-1 items-center justify-center gap-2 rounded-xl py-2.5 text-xs font-black transition ${
              sourceType === 'upload' ? 'bg-brand text-white shadow-lg shadow-brand/15' : 'text-text-muted hover:text-white'
            }`}
          >
            <Icon icon="solar:cloud-upload-bold" width="16" /> Upload MP4 / MOV File
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          {sourceType === 'url' ? (
            <div>
              <label className="text-[10px] font-black uppercase tracking-wider text-text-muted">
                YouTube or Vimeo URL
              </label>
              <div className="relative mt-1.5">
                <input
                  type="url"
                  value={videoUrl}
                  onChange={(e) => setVideoUrl(e.target.value)}
                  placeholder="https://www.youtube.com/watch?v=... or https://youtu.be/..."
                  className="w-full rounded-xl border border-white/10 bg-white/[.03] py-2.5 pl-4 pr-10 text-xs font-bold text-text-primary outline-none focus:border-brand"
                />
                <Icon icon="solar:link-bold" width="16" className="absolute right-3.5 top-3 text-text-muted" />
              </div>
            </div>
          ) : (
            <div>
              <label className="text-[10px] font-black uppercase tracking-wider text-text-muted">
                Video File (MP4, MOV up to 150MB)
              </label>
              <input
                type="file"
                accept="video/mp4,video/quicktime"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                className="mt-1.5 w-full rounded-xl border border-white/10 bg-white/[.03] p-3 text-xs font-bold text-text-primary file:mr-3 file:rounded-lg file:border-0 file:bg-brand/15 file:px-3 file:py-1 file:text-xs file:font-black file:text-brand"
              />
            </div>
          )}

          {/* Category */}
          <div>
            <label className="text-[10px] font-black uppercase tracking-wider text-text-muted">
              Performance Category
            </label>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {VIDEO_CATEGORIES.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setCategory(cat.id)}
                  className={`flex items-start gap-2.5 rounded-xl border p-2.5 text-left transition ${
                    category === cat.id
                      ? 'border-brand bg-brand/10 text-text-primary'
                      : 'border-white/10 bg-white/[.02] text-text-muted hover:border-white/20'
                  }`}
                >
                  <span className={`mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full border ${
                    category === cat.id ? 'border-brand bg-brand text-white' : 'border-white/20'
                  }`}>
                    {category === cat.id && <Icon icon="solar:check-bold" width="10" />}
                  </span>
                  <div>
                    <p className={`text-xs font-black ${category === cat.id ? 'text-brand' : 'text-text-primary'}`}>
                      {cat.label}
                    </p>
                    <p className="text-[9px] leading-tight text-text-muted mt-0.5">{cat.desc}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Title */}
          <div>
            <label className="text-[10px] font-black uppercase tracking-wider text-text-muted">
              Video Title
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. 2026 Dramatic Acting Reel or Monologue from Oloibiri"
              className="mt-1.5 w-full rounded-xl border border-white/10 bg-white/[.03] px-4 py-2.5 text-xs font-bold text-text-primary outline-none focus:border-brand"
            />
          </div>

          {/* Tag to Movie & Character */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="text-[10px] font-black uppercase tracking-wider text-text-muted">
                Tag to Credited Movie (Optional)
              </label>
              <select
                value={taggedFilmId}
                onChange={(e) => setTaggedFilmId(e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-white/10 bg-[#202020] px-3 py-2.5 text-xs font-bold text-text-primary outline-none focus:border-brand"
              >
                <option value="">-- None / Standalone Showreel --</option>
                {credits.map((c) => (
                  <option key={c.id} value={c.film_id || c.films?.id}>
                    {c.films?.title || 'Untitled Film'} ({c.films?.year || 'N/A'})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-black uppercase tracking-wider text-text-muted">
                Character Portrayed (Optional)
              </label>
              <input
                type="text"
                value={characterName}
                onChange={(e) => setCharacterName(e.target.value)}
                placeholder="e.g. Lead as Dr. Kemi"
                className="mt-1.5 w-full rounded-xl border border-white/10 bg-white/[.03] px-4 py-2.5 text-xs font-bold text-text-primary outline-none focus:border-brand"
              />
            </div>
          </div>

          {/* Pin as Main Featured Reel */}
          <label className="flex cursor-pointer items-center justify-between rounded-2xl border border-white/10 bg-white/[.02] p-3.5 transition hover:border-brand/40">
            <div className="flex items-center gap-3">
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-red-500/10 text-red-400">
                <Icon icon="solar:play-circle-bold" width="18" />
              </span>
              <div>
                <p className="text-xs font-black text-text-primary">Pin as Headline Showreel</p>
                <p className="text-[10px] text-text-muted">Autoplays or features first on your profile for casting directors</p>
              </div>
            </div>
            <input
              type="checkbox"
              checked={isFeatured}
              onChange={(e) => setIsFeatured(e.target.checked)}
              className="h-4 w-4 accent-brand"
            />
          </label>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-white/10 px-5 py-2.5 text-xs font-black text-text-muted hover:text-white"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={uploading}
              className="inline-flex items-center gap-2 rounded-xl bg-brand px-6 py-2.5 text-xs font-black text-white shadow-lg shadow-brand/20 hover:bg-brand/90 disabled:opacity-50"
            >
              {uploading ? (
                <>
                  <Icon icon="solar:spinner-linear" className="animate-spin" width="18" />
                  Saving Video...
                </>
              ) : (
                <>
                  <Icon icon="solar:check-circle-bold" width="18" />
                  Save Performance Reel
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
