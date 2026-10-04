import { useState, useEffect } from 'react';
import { Icon } from '@iconify/react';
import { toast } from 'react-hot-toast';
import { supabase } from '../../lib/supabase';
import { authHeaders } from '../../lib/apiAuth';
import { notifyProAdminOnTelegram } from '../../lib/proModeration';

const CATEGORIES = [
  { id: 'headshot', label: 'Official Headshot', desc: 'Primary professional headshot or portfolio portrait' },
  { id: 'production_still', label: 'Production Still', desc: 'On-set still or character costume capture' },
  { id: 'behind_the_scenes', label: 'Behind the Scenes', desc: 'Working behind the camera or on-set rehearsal' },
  { id: 'red_carpet', label: 'Red Carpet & Premiere', desc: 'Awards show, festival premiere, or press event' },
  { id: 'editorial', label: 'Editorial & Press', desc: 'Magazine feature, interview photoshoot, or promotional shoot' }
];

export default function PhotoUploadModal({ person, onClose, onSaved }) {
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [category, setCategory] = useState('headshot');
  const [title, setTitle] = useState('');
  const [photographer, setPhotographer] = useState('');
  const [year, setYear] = useState(new Date().getFullYear());
  const [isPrimary, setIsPrimary] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const handleFileSelect = (selectedFile) => {
    if (!selectedFile) return;
    if (!selectedFile.type.startsWith('image/')) {
      toast.error('Please upload an image file (JPEG, PNG, WebP)');
      return;
    }
    if (selectedFile.size > 20 * 1024 * 1024) {
      toast.error('Image size must be under 20MB');
      return;
    }
    setFile(selectedFile);
    setPreviewUrl(URL.createObjectURL(selectedFile));
    if (!title) {
      setTitle(selectedFile.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' '));
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file && !previewUrl) {
      toast.error('Please select an image to upload');
      return;
    }

    setUploading(true);
    try {
      let finalUrl = previewUrl;
      let r2Key = null;

      // 1. Get presigned R2 upload URL
      if (file) {
        const uploadSessionRes = await fetch('/api/social?task=create_r2_upload_url', {
          method: 'POST',
          headers: await authHeaders(),
          body: JSON.stringify({
            fileName: `${person.slug || person.id}_${Date.now()}_${file.name}`,
            mimeType: file.type || 'image/jpeg'
          })
        });

        if (uploadSessionRes.ok) {
          const session = await uploadSessionRes.json();
          if (session?.uploadUrl) {
            // Upload binary direct to R2
            const putRes = await fetch(session.uploadUrl, {
              method: 'PUT',
              headers: { 'Content-Type': file.type || 'image/jpeg' },
              body: file
            });
            if (putRes.ok) {
              finalUrl = session.publicUrl;
              r2Key = session.key;
            }
          }
        }
      }

      // 2. Save media record into person's highlights / media
      const newPhotoItem = {
        id: `photo_${Date.now()}`,
        type: 'photo',
        category,
        title: title || 'Official Photo',
        url: finalUrl,
        thumbnail: finalUrl,
        photographer: photographer || null,
        year: Number(year) || new Date().getFullYear(),
        is_primary: isPrimary,
        created_at: new Date().toISOString()
      };

      // Retrieve existing highlights
      const currentStats = person.youtube_stats || {};
      const existingHighlights = Array.isArray(currentStats.instagram_highlights)
        ? [...currentStats.instagram_highlights]
        : [];

      if (isPrimary) {
        // Unmark other primary photos
        existingHighlights.forEach(h => {
          if (h.type === 'photo') h.is_primary = false;
        });
      }

      const updatedHighlights = [newPhotoItem, ...existingHighlights];

      const updates = {
        youtube_stats: {
          ...currentStats,
          instagram_highlights: updatedHighlights
        },
        updated_at: new Date().toISOString()
      };

      // If marked as primary headshot, also update main photo_url
      if (isPrimary) {
        updates.photo_url = finalUrl;
      }

      const { error: dbError } = await supabase
        .from('people')
        .update(updates)
        .eq('id', person.id);

      if (dbError) throw dbError;

      // Also record into person_media with pending moderation status
      try {
        await supabase.from('person_media').insert({
          person_id: person.id,
          media_type: 'photo',
          category,
          title: title || 'Official Photo',
          url: finalUrl,
          thumbnail_url: finalUrl,
          photographer_credit: photographer || null,
          year: Number(year) || new Date().getFullYear(),
          is_primary: isPrimary,
          status: 'pending'
        });
      } catch (mediaErr) {
        console.warn('person_media insert note:', mediaErr);
      }

      // Notify Admin on Telegram
      notifyProAdminOnTelegram({
        personId: person.id,
        personName: person.name,
        personSlug: person.slug,
        updateType: 'photos',
        summary: `New photo uploaded (${category}): "${title || 'Official Photo'}"`,
        details: `URL: ${finalUrl}\nPhotographer: ${photographer || 'N/A'}\nPrimary: ${isPrimary ? 'Yes' : 'No'}`,
        link: '/admin/contributions'
      }).catch((err) => console.warn('Photo upload telegram notify error:', err));

      toast.success(isPrimary ? 'Photo uploaded and set as primary headshot!' : 'Photo added to portfolio!');
      onSaved?.();
      onClose();
    } catch (err) {
      console.error('Photo upload failed:', err);
      toast.error(err.message || 'Failed to upload photo. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[200] flex items-start justify-center overflow-y-auto bg-black/85 p-3 backdrop-blur-md overscroll-contain sm:items-center sm:p-5"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="relative my-auto flex max-h-[calc(100vh-1.5rem)] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#171717] shadow-2xl sm:max-h-[88vh] sm:rounded-3xl">
        {/* Pinned Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-white/10 bg-[#171717] px-5 py-3.5 sm:px-6 sm:py-4">
          <div className="flex items-center gap-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-brand/10 text-brand sm:h-10 sm:w-10">
              <Icon icon="solar:camera-bold" width="20" />
            </span>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[.25em] text-brand">Portfolio Management</p>
              <h2 className="text-base font-black text-text-primary sm:text-lg">Upload Professional Photo</h2>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="grid h-8 w-8 place-items-center rounded-full bg-white/[.05] text-text-muted transition hover:bg-white/10 hover:text-white"
          >
            <Icon icon="solar:close-circle-linear" width="20" />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <div className="flex-1 space-y-4 overflow-y-auto p-4 sm:p-6">
            {/* Drag & Drop Upload Box */}
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              className={`relative flex min-h-[130px] cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-4 text-center transition sm:min-h-[160px] sm:rounded-2xl sm:p-6 ${
                dragOver ? 'border-brand bg-brand/5' : previewUrl ? 'border-brand/40 bg-black/40' : 'border-white/15 bg-white/[.02] hover:border-white/30'
              }`}
            >
              {previewUrl ? (
                <div className="relative flex flex-col items-center">
                  <img
                    src={previewUrl}
                    alt="Preview"
                    className="max-h-40 rounded-xl object-contain shadow-lg sm:max-h-48"
                  />
                  <button
                    type="button"
                    onClick={() => { setFile(null); setPreviewUrl(''); }}
                    className="mt-2.5 inline-flex items-center gap-1.5 rounded-lg bg-red-500/10 px-3 py-1 text-xs font-black text-red-400 hover:bg-red-500/20"
                  >
                    <Icon icon="solar:trash-bin-trash-bold" width="14" /> Choose different file
                  </button>
                </div>
              ) : (
                <>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={(e) => handleFileSelect(e.target.files?.[0])}
                    className="absolute inset-0 cursor-pointer opacity-0"
                  />
                  <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand/10 text-brand sm:h-12 sm:w-12 sm:rounded-2xl">
                    <Icon icon="solar:cloud-upload-bold" width="22" className="sm:h-6 sm:w-6" />
                  </span>
                  <p className="mt-2 text-xs font-black text-text-primary sm:text-sm">
                    Drag & drop your high-resolution photo here
                  </p>
                  <p className="mt-0.5 text-[11px] text-text-muted">
                    Supports JPEG, PNG, WebP up to 20MB • Direct Cloudflare R2 Upload
                  </p>
                  <span className="mt-3 rounded-lg border border-white/10 bg-white/[.05] px-3.5 py-1.5 text-[11px] font-black text-text-primary sm:rounded-xl sm:px-4 sm:py-2 sm:text-xs">
                    Browse Files
                  </span>
                </>
              )}
            </div>

            {/* Photo Category Selector */}
            <div>
              <label className="text-[10px] font-black uppercase tracking-wider text-text-muted">
                Photo Classification
              </label>
              <div className="mt-1.5 grid gap-2 sm:grid-cols-2">
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setCategory(cat.id)}
                    className={`flex items-start gap-2.5 rounded-xl border p-2.5 text-left transition sm:p-3 ${
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
                      <p className="text-[10px] leading-tight text-text-muted mt-0.5">{cat.desc}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Metadata Inputs */}
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="text-[10px] font-black uppercase tracking-wider text-text-muted">
                  Caption / Title
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Official 2026 Headshot"
                  className="mt-1 w-full rounded-xl border border-white/10 bg-white/[.03] px-3.5 py-2 text-xs font-bold text-text-primary outline-none focus:border-brand"
                />
              </div>
              <div>
                <label className="text-[10px] font-black uppercase tracking-wider text-text-muted">
                  Photographer / Credit (Optional)
                </label>
                <input
                  type="text"
                  value={photographer}
                  onChange={(e) => setPhotographer(e.target.value)}
                  placeholder="e.g. Kelechi Amadi-Obi"
                  className="mt-1 w-full rounded-xl border border-white/10 bg-white/[.03] px-3.5 py-2 text-xs font-bold text-text-primary outline-none focus:border-brand"
                />
              </div>
            </div>

            {/* Primary Headshot Toggle */}
            <label className="flex cursor-pointer items-center justify-between rounded-xl border border-white/10 bg-white/[.02] p-3 transition hover:border-brand/40 sm:rounded-2xl sm:p-3.5">
              <div className="flex items-center gap-2.5 sm:gap-3">
                <span className="grid h-8 w-8 place-items-center rounded-xl bg-amber-500/10 text-amber-400 sm:h-9 sm:w-9">
                  <Icon icon="solar:star-bold" width="18" />
                </span>
                <div>
                  <p className="text-xs font-black text-text-primary">Set as Primary Profile Avatar</p>
                  <p className="text-[10px] text-text-muted">Will be displayed on your search results and main hero banner</p>
                </div>
              </div>
              <input
                type="checkbox"
                checked={isPrimary}
                onChange={(e) => setIsPrimary(e.target.checked)}
                className="h-4 w-4 accent-brand sm:h-5 sm:w-5"
              />
            </label>
          </div>

          {/* Pinned Footer */}
          <div className="flex shrink-0 items-center justify-end gap-3 border-t border-white/10 bg-[#171717] px-5 py-3 sm:px-6 sm:py-3.5">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-white/10 px-4 py-2 text-xs font-black text-text-muted transition hover:bg-white/[.04] hover:text-white"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={uploading || (!file && !previewUrl)}
              className="inline-flex items-center gap-2 rounded-xl bg-brand px-5 py-2 text-xs font-black text-white shadow-lg shadow-brand/20 transition hover:bg-brand/90 disabled:opacity-50"
            >
              {uploading ? (
                <>
                  <Icon icon="solar:spinner-linear" className="animate-spin" width="16" />
                  Uploading to R2...
                </>
              ) : (
                <>
                  <Icon icon="solar:check-circle-bold" width="16" />
                  Save Photo
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
