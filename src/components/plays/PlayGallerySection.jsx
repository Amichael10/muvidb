import React, { useState, useRef } from 'react';
import { Icon } from '@iconify/react';
import toast from 'react-hot-toast';
import PlayPhotoLightboxModal from './PlayPhotoLightboxModal';
import { addPlayImage, deletePlayImage } from '../../lib/plays';
import { uploadAdminImage } from '../../lib/imageUpload';

const IMAGE_TYPES = [
  { value: 'production_still', label: 'Production Still' },
  { value: 'poster', label: 'Poster / Key Art' },
  { value: 'stage_performance', label: 'Stage Performance' },
  { value: 'behind_the_scenes', label: 'Behind the Scenes' },
  { value: 'rehearsal', label: 'Rehearsal' },
];

export default function PlayGallerySection({
  play,
  images = [],
  isAdmin = false,
  onImagesUpdated
}) {
  const [activeLightboxIndex, setActiveLightboxIndex] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [uploadMode, setUploadMode] = useState('upload'); // 'upload' | 'url'
  const [selectedFile, setSelectedFile] = useState(null);
  const [filePreview, setFilePreview] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [brokenImageIds, setBrokenImageIds] = useState(new Set());
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef(null);

  const [newImage, setNewImage] = useState({
    url: '',
    caption: '',
    image_type: 'production_still',
    is_primary: false,
  });

  // Rule: if none and not admin, leave it completely empty
  if (images.length === 0 && !isAdmin) {
    return null;
  }

  function handleFileChosen(file) {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Please choose a valid image file (JPEG, PNG, WebP).');
      return;
    }
    if (file.size > 15 * 1024 * 1024) {
      toast.error('Image size must be under 15 MB.');
      return;
    }

    setSelectedFile(file);
    const objectUrl = URL.createObjectURL(file);
    setFilePreview(objectUrl);
  }

  function resetForm() {
    setSelectedFile(null);
    if (filePreview) {
      URL.revokeObjectURL(filePreview);
      setFilePreview(null);
    }
    setNewImage({ url: '', caption: '', image_type: 'production_still', is_primary: false });
    setUploadMode('upload');
  }

  async function handleAddImage(e) {
    e.preventDefault();

    let finalUrl = '';

    setSaving(true);
    try {
      if (uploadMode === 'upload') {
        if (!selectedFile) {
          toast.error('Please select an image file to upload.');
          setSaving(false);
          return;
        }

        const uploadRes = await uploadAdminImage(selectedFile, 'film-images');
        if (uploadRes.error) {
          throw new Error(uploadRes.error);
        }
        finalUrl = uploadRes.url;
      } else {
        const urlStr = newImage.url.trim();
        if (!urlStr) {
          toast.error('Please enter an image URL.');
          setSaving(false);
          return;
        }

        // Warn if an HTML viewer page link like ibb.co was entered instead of direct image
        if (urlStr.includes('ibb.co/') && !urlStr.includes('i.ibb.co/')) {
          toast.error('The link entered is an ImgBB page, not a direct image. Please use "Upload File" tab to upload directly.');
          setSaving(false);
          return;
        }

        finalUrl = urlStr;
      }

      await addPlayImage({
        play_id: play.id,
        url: finalUrl,
        caption: newImage.caption.trim() || null,
        image_type: newImage.image_type || 'production_still',
        is_primary: !!newImage.is_primary,
        sort_order: images.length + 1,
      });

      toast.success(uploadMode === 'upload' ? 'Photo uploaded to gallery successfully!' : 'Gallery photo added successfully!');
      resetForm();
      setShowAddModal(false);
      if (onImagesUpdated) onImagesUpdated();
    } catch (err) {
      console.error('Error adding play image:', err);
      toast.error(err.message || 'Failed to add image');
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteImage(e, imageId) {
    e.stopPropagation();
    if (!window.confirm('Are you sure you want to delete this gallery photo?')) return;
    try {
      await deletePlayImage(imageId);
      toast.success('Image removed from gallery');
      if (onImagesUpdated) onImagesUpdated();
    } catch (err) {
      console.error('Error deleting image:', err);
      toast.error(err.message || 'Failed to remove image');
    }
  }

  return (
    <section className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.24em] text-brand mb-1">
            Production Media & Stills
          </p>
          <h2 className="text-xl sm:text-2xl font-bold text-text-primary flex items-center gap-2">
            <Icon icon="solar:gallery-wide-bold" className="text-brand w-6 h-6" />
            <span>Stage Show Gallery</span>
            {images.length > 0 && (
              <span className="text-xs font-mono text-text-muted">({images.length})</span>
            )}
          </h2>
        </div>

        {isAdmin && (
          <button
            type="button"
            onClick={() => {
              resetForm();
              setShowAddModal(true);
            }}
            className="px-3.5 py-1.5 rounded-xl bg-brand/10 hover:bg-brand/20 border border-brand/30 text-brand text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Icon icon="solar:add-circle-bold" className="text-base" />
            <span>Add Photo</span>
          </button>
        )}
      </div>

      {/* Gallery Grid or Admin Empty State */}
      {images.length === 0 ? (
        isAdmin && (
          <div className="p-8 rounded-2xl bg-surface border border-dashed border-border/80 text-center space-y-3">
            <Icon icon="solar:gallery-bold" className="w-12 h-12 text-text-muted mx-auto opacity-40" />
            <div className="space-y-1">
              <p className="text-sm font-bold text-text-primary">No gallery photos added yet</p>
              <p className="text-xs text-text-muted max-w-md mx-auto">
                As an administrator, you can upload high-resolution performance photos, set imagery, and key art.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                resetForm();
                setShowAddModal(true);
              }}
              className="px-4 py-2 rounded-xl bg-brand text-white text-xs font-bold hover:bg-brand-hover transition-colors cursor-pointer inline-flex items-center gap-2"
            >
              <Icon icon="solar:add-circle-bold" />
              <span>Add First Gallery Photo</span>
            </button>
          </div>
        )
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4">
          {images.map((img, idx) => {
            const isBroken = brokenImageIds.has(img.id);

            return (
              <div
                key={img.id || idx}
                onClick={() => !isBroken && setActiveLightboxIndex(idx)}
                className="group relative rounded-2xl border border-border/80 hover:border-brand/60 bg-surface overflow-hidden cursor-pointer transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-brand/5 flex flex-col"
              >
                <div className="relative aspect-[4/3] bg-surface-2 overflow-hidden flex items-center justify-center">
                  {isBroken ? (
                    <div className="w-full h-full flex flex-col items-center justify-center p-3 text-center bg-surface-2/80 text-text-muted">
                      <Icon icon="solar:gallery-broken-bold" className="w-8 h-8 text-amber-500/60 mb-1" />
                      <span className="text-[10px] font-bold text-text-secondary">Image Unavailable</span>
                      <span className="text-[9px] text-text-muted line-clamp-1 mt-0.5">Link could not be loaded</span>
                    </div>
                  ) : (
                    <img
                      src={img.url}
                      alt={img.caption || `${play?.title} production still`}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      loading="lazy"
                      onError={() => {
                        setBrokenImageIds((prev) => new Set([...prev, img.id]));
                      }}
                    />
                  )}

                  {/* Gradient vignette */}
                  {!isBroken && (
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-60 group-hover:opacity-80 transition-opacity" />
                  )}

                  {/* Badge */}
                  <div className="absolute top-2 left-2 flex gap-1 z-10">
                    <span className="text-[9px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-black/70 text-amber-300 backdrop-blur-xs border border-white/10">
                      {img.image_type?.replace(/_/g, ' ') || 'Still'}
                    </span>
                  </div>

                  {/* Admin Delete Action */}
                  {isAdmin && (
                    <button
                      type="button"
                      onClick={(e) => handleDeleteImage(e, img.id)}
                      className="absolute top-2 right-2 z-20 p-1.5 rounded-lg bg-red-950/90 hover:bg-red-800 text-red-200 opacity-90 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity cursor-pointer shadow-md"
                      title="Delete image"
                    >
                      <Icon icon="solar:trash-bin-trash-bold" className="text-xs" />
                    </button>
                  )}

                  {/* Center Zoom Icon on Hover */}
                  {!isBroken && (
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10 pointer-events-none">
                      <div className="p-2.5 rounded-full bg-brand text-white shadow-lg scale-90 group-hover:scale-100 transition-transform">
                        <Icon icon="solar:magnifer-zoom-in-bold" className="text-lg" />
                      </div>
                    </div>
                  )}
                </div>

                {/* Caption Footer */}
                {img.caption && (
                  <div className="p-2.5 bg-surface border-t border-border/40 text-[11px] font-medium text-text-secondary line-clamp-1">
                    {img.caption}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Lightbox Modal */}
      {activeLightboxIndex !== null && images[activeLightboxIndex] && (
        <PlayPhotoLightboxModal
          images={images}
          initialIndex={activeLightboxIndex}
          onClose={() => setActiveLightboxIndex(null)}
          playTitle={play?.title}
        />
      )}

      {/* Admin Quick Add Modal */}
      {showAddModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-fade-in"
          onClick={() => {
            if (!saving) setShowAddModal(false);
          }}
        >
          <div
            className="relative w-full max-w-lg rounded-2xl bg-surface border border-border shadow-2xl p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2">
                <Icon icon="solar:gallery-wide-bold" className="text-brand text-xl" />
                <div>
                  <h3 className="text-base font-bold text-text-primary">Add Stage Gallery Photo</h3>
                  <p className="text-xs text-text-muted">{play?.title}</p>
                </div>
              </div>
              <button
                type="button"
                disabled={saving}
                onClick={() => setShowAddModal(false)}
                className="p-1 rounded-lg text-text-muted hover:text-text-primary cursor-pointer disabled:opacity-50"
              >
                <Icon icon="solar:close-circle-bold" className="text-xl" />
              </button>
            </div>

            {/* Mode Tabs */}
            <div className="flex items-center p-1 bg-surface-2 rounded-xl border border-border">
              <button
                type="button"
                onClick={() => setUploadMode('upload')}
                className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  uploadMode === 'upload'
                    ? 'bg-brand text-white shadow-sm'
                    : 'text-text-secondary hover:text-text-primary'
                }`}
              >
                <Icon icon="solar:upload-track-2-bold" className="text-base" />
                <span>Upload Photo File</span>
              </button>
              <button
                type="button"
                onClick={() => setUploadMode('url')}
                className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  uploadMode === 'url'
                    ? 'bg-brand text-white shadow-sm'
                    : 'text-text-secondary hover:text-text-primary'
                }`}
              >
                <Icon icon="solar:link-bold" className="text-base" />
                <span>Paste Image Link</span>
              </button>
            </div>

            <form onSubmit={handleAddImage} className="space-y-4">
              {uploadMode === 'upload' ? (
                /* File Upload Dropzone */
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-text-secondary block">
                    Select Photo File <span className="text-brand">*</span>
                  </label>
                  <div
                    onDragOver={(e) => {
                      e.preventDefault();
                      setIsDragging(true);
                    }}
                    onDragLeave={() => setIsDragging(false)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setIsDragging(false);
                      const file = e.dataTransfer.files?.[0];
                      if (file) handleFileChosen(file);
                    }}
                    onClick={() => fileInputRef.current?.click()}
                    className={`border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition-all ${
                      isDragging
                        ? 'border-brand bg-brand/10'
                        : 'border-border/80 hover:border-brand/60 bg-surface-2/60'
                    }`}
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/png,image/jpeg,image/webp,image/jpg"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleFileChosen(file);
                      }}
                    />

                    {filePreview ? (
                      <div className="space-y-2">
                        <div className="relative w-full aspect-[16/9] max-h-48 rounded-lg overflow-hidden bg-black/50 mx-auto border border-border">
                          <img
                            src={filePreview}
                            alt="Upload preview"
                            className="w-full h-full object-contain"
                          />
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedFile(null);
                              if (filePreview) URL.revokeObjectURL(filePreview);
                              setFilePreview(null);
                            }}
                            className="absolute top-2 right-2 p-1 rounded-full bg-black/80 hover:bg-black text-white text-xs cursor-pointer shadow-md"
                            title="Remove photo"
                          >
                            <Icon icon="solar:close-circle-bold" className="text-lg" />
                          </button>
                        </div>
                        <p className="text-[11px] font-mono text-text-muted truncate">
                          {selectedFile?.name} ({(selectedFile?.size ? selectedFile.size / 1024 : 0).toFixed(0)} KB)
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-2 py-3">
                        <div className="w-12 h-12 rounded-full bg-brand/10 text-brand flex items-center justify-center mx-auto border border-brand/20">
                          <Icon icon="solar:upload-track-2-bold" className="w-6 h-6" />
                        </div>
                        <div>
                          <p className="text-xs font-bold text-text-primary">
                            Click to select photo or drag and drop
                          </p>
                          <p className="text-[11px] text-text-muted mt-0.5">
                            JPEG, PNG, or WebP (optimized &amp; stored permanently)
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                /* Paste URL Field */
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-text-secondary block">
                    Direct Image URL <span className="text-brand">*</span>
                  </label>
                  <input
                    type="url"
                    value={newImage.url}
                    onChange={(e) => setNewImage({ ...newImage, url: e.target.value })}
                    placeholder="https://... direct image file (ends in .jpg, .png, etc.)"
                    className="w-full bg-surface-2 border border-border rounded-xl px-4 py-2.5 text-xs text-text-primary focus:border-brand focus:outline-none"
                  />
                  <p className="text-[11px] text-text-muted">
                    Must be a direct link to the image file, not a webpage. For guaranteed uptime, use the <strong>Upload Photo File</strong> tab.
                  </p>
                </div>
              )}

              {/* Category */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-text-secondary block">
                  Photo Category
                </label>
                <select
                  value={newImage.image_type}
                  onChange={(e) => setNewImage({ ...newImage, image_type: e.target.value })}
                  className="w-full bg-surface-2 border border-border rounded-xl px-4 py-2.5 text-xs text-text-primary focus:border-brand focus:outline-none"
                >
                  {IMAGE_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>

              {/* Caption */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-text-secondary block">
                  Caption (Optional)
                </label>
                <input
                  type="text"
                  value={newImage.caption}
                  onChange={(e) => setNewImage({ ...newImage, caption: e.target.value })}
                  placeholder="e.g. Stage Performance Scene, Cast Rehearsal"
                  className="w-full bg-surface-2 border border-border rounded-xl px-4 py-2.5 text-xs text-text-primary focus:border-brand focus:outline-none"
                />
              </div>

              {/* Primary art checkbox */}
              <div className="flex items-center gap-2 pt-1">
                <label className="flex items-center gap-2 text-xs text-text-secondary cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={newImage.is_primary}
                    onChange={(e) => setNewImage({ ...newImage, is_primary: e.target.checked })}
                    className="rounded border-border text-brand focus:ring-brand"
                  />
                  <span>Mark as primary key art / poster</span>
                </label>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2.5 rounded-xl bg-surface-2 hover:bg-surface-3 text-text-secondary text-xs font-bold transition-colors cursor-pointer disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2.5 bg-brand text-white font-bold rounded-xl text-xs hover:bg-brand-hover transition-colors disabled:opacity-50 cursor-pointer shadow-md shadow-brand/20 flex items-center gap-2"
                >
                  {saving ? (
                    <>
                      <Icon icon="solar:spinner-linear" className="animate-spin text-sm" />
                      <span>{uploadMode === 'upload' ? 'Uploading…' : 'Adding…'}</span>
                    </>
                  ) : (
                    <>
                      <Icon icon="solar:check-circle-bold" className="text-sm" />
                      <span>{uploadMode === 'upload' ? 'Upload Photo' : 'Add to Gallery'}</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}
