import React, { useState, useRef, useEffect, useCallback } from 'react';
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
  const [selectedFiles, setSelectedFiles] = useState([]); // Array of { file, preview, name, size }
  const [isDragging, setIsDragging] = useState(false);
  const [brokenImageIds, setBrokenImageIds] = useState(new Set());
  const [saving, setSaving] = useState(false);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const fileInputRef = useRef(null);
  const sliderRef = useRef(null);

  const checkScroll = useCallback(() => {
    if (sliderRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = sliderRef.current;
      setCanScrollLeft(scrollLeft > 10);
      setCanScrollRight(scrollLeft + clientWidth < scrollWidth - 10);
    }
  }, []);

  useEffect(() => {
    checkScroll();
    window.addEventListener('resize', checkScroll);
    return () => window.removeEventListener('resize', checkScroll);
  }, [images, checkScroll]);

  const scroll = (direction) => {
    if (sliderRef.current) {
      const { clientWidth } = sliderRef.current;
      const scrollAmount = direction === 'left' ? -clientWidth * 0.75 : clientWidth * 0.75;
      sliderRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  };

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

  function handleFilesChosen(files) {
    if (!files || files.length === 0) return;
    const chosen = Array.from(files);
    const valid = [];

    for (const file of chosen) {
      if (!file.type.startsWith('image/')) {
        toast.error(`"${file.name}" is not a valid image file.`);
        continue;
      }
      if (file.size > 15 * 1024 * 1024) {
        toast.error(`"${file.name}" exceeds 15 MB.`);
        continue;
      }
      valid.push({
        file,
        preview: URL.createObjectURL(file),
        name: file.name,
        size: file.size,
      });
    }

    if (valid.length > 0) {
      setSelectedFiles((prev) => [...prev, ...valid]);
    }
  }

  function removeFile(index) {
    setSelectedFiles((prev) => {
      const target = prev[index];
      if (target?.preview) URL.revokeObjectURL(target.preview);
      return prev.filter((_, i) => i !== index);
    });
  }

  function resetForm() {
    selectedFiles.forEach((item) => {
      if (item.preview) URL.revokeObjectURL(item.preview);
    });
    setSelectedFiles([]);
    setNewImage({ url: '', caption: '', image_type: 'production_still', is_primary: false });
    setUploadMode('upload');
  }

  async function handleAddImage(e) {
    e.preventDefault();

    setSaving(true);
    try {
      if (uploadMode === 'upload') {
        if (selectedFiles.length === 0) {
          toast.error('Please select at least one photo file to upload.');
          setSaving(false);
          return;
        }

        let uploadedCount = 0;
        for (let i = 0; i < selectedFiles.length; i++) {
          const item = selectedFiles[i];
          const uploadRes = await uploadAdminImage(item.file, 'film-images');
          if (uploadRes.error) {
            toast.error(`Failed to upload ${item.name}: ${uploadRes.error}`);
            continue;
          }

          await addPlayImage({
            play_id: play.id,
            url: uploadRes.url,
            caption: newImage.caption.trim() || null,
            image_type: newImage.image_type || 'production_still',
            is_primary: i === 0 && !!newImage.is_primary,
            sort_order: images.length + i + 1,
          });
          uploadedCount++;
        }

        if (uploadedCount > 0) {
          toast.success(
            uploadedCount === 1
              ? 'Photo uploaded to stage gallery successfully!'
              : `${uploadedCount} photos uploaded to stage gallery successfully!`
          );
        }
      } else {
        const urlStr = newImage.url.trim();
        if (!urlStr) {
          toast.error('Please enter an image URL.');
          setSaving(false);
          return;
        }

        // Warn if an HTML viewer page link or expiring service like ibb.co was entered
        if (urlStr.includes('ibb.co')) {
          toast.error('ImgBB links expire quickly and fail cross-origin loading. Please use "Upload Photo File" tab to upload your photo file directly.');
          setSaving(false);
          return;
        }

        await addPlayImage({
          play_id: play.id,
          url: urlStr,
          caption: newImage.caption.trim() || null,
          image_type: newImage.image_type || 'production_still',
          is_primary: !!newImage.is_primary,
          sort_order: images.length + 1,
        });

        toast.success('Gallery photo added successfully!');
      }

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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
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

        {/* Action Controls: Fullscreen View, Slider Nav Arrows, Add Photo */}
        <div className="flex items-center gap-2 flex-wrap">
          {images.length > 0 && (
            <button
              type="button"
              onClick={() => setActiveLightboxIndex(0)}
              className="px-3.5 py-1.5 rounded-xl bg-surface-2 hover:bg-surface-3 border border-border/80 hover:border-brand/50 text-text-primary text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer group"
              title="Open full screen lightbox gallery"
            >
              <Icon icon="solar:maximize-square-bold" className="text-sm text-brand group-hover:scale-110 transition-transform" />
              <span>Full Screen View</span>
            </button>
          )}

          {images.length > 1 && (
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => scroll('left')}
                disabled={!canScrollLeft}
                className="w-8 h-8 rounded-xl bg-surface-2 hover:bg-surface-3 border border-border/80 flex items-center justify-center text-text-primary transition-all disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
                aria-label="Scroll left"
              >
                <Icon icon="solar:alt-arrow-left-linear" className="text-base" />
              </button>
              <button
                type="button"
                onClick={() => scroll('right')}
                disabled={!canScrollRight}
                className="w-8 h-8 rounded-xl bg-surface-2 hover:bg-surface-3 border border-border/80 flex items-center justify-center text-text-primary transition-all disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
                aria-label="Scroll right"
              >
                <Icon icon="solar:alt-arrow-right-linear" className="text-base" />
              </button>
            </div>
          )}

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
      </div>

      {/* Gallery Slider or Admin Empty State */}
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
        <div className="relative group/slider -mx-4 sm:mx-0">
          {/* Edge Gradients for Desktop */}
          <div
            className={`absolute top-0 left-0 bottom-0 w-16 z-10 bg-gradient-to-r from-bg to-transparent pointer-events-none transition-opacity duration-300 hidden md:block ${
              canScrollLeft ? 'opacity-100' : 'opacity-0'
            }`}
          />
          <div
            className={`absolute top-0 right-0 bottom-0 w-16 z-10 bg-gradient-to-l from-bg to-transparent pointer-events-none transition-opacity duration-300 hidden md:block ${
              canScrollRight ? 'opacity-100' : 'opacity-0'
            }`}
          />

          {/* Horizontal Slider Track */}
          <div
            ref={sliderRef}
            onScroll={checkScroll}
            className="flex overflow-x-auto gap-3.5 sm:gap-4 py-2 px-4 sm:px-0 scrollbar-none snap-x snap-mandatory scroll-smooth overscroll-x-contain"
          >
            {images.map((img, idx) => {
              const isBroken = brokenImageIds.has(img.id);

              return (
                <div
                  key={img.id || idx}
                  onClick={() => !isBroken && setActiveLightboxIndex(idx)}
                  className="w-72 sm:w-80 md:w-96 shrink-0 snap-start group relative rounded-2xl border border-border/80 hover:border-brand/60 bg-surface overflow-hidden cursor-pointer transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-brand/5 flex flex-col select-none"
                >
                  <div className="relative aspect-[16/10] bg-surface-2 overflow-hidden flex items-center justify-center">
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

                    {/* Type Badge */}
                    <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5 z-10 pointer-events-none">
                      <span className="text-[9px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-black/75 text-amber-300 backdrop-blur-md border border-white/10 shadow-sm">
                        {img.image_type?.replace(/_/g, ' ') || 'Still'}
                      </span>
                      {img.is_primary && (
                        <span className="text-[9px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-brand text-white shadow-sm">
                          Key Art
                        </span>
                      )}
                    </div>

                    {/* Top Right Action Overlay: Full Screen Icon & Admin Delete */}
                    <div className="absolute top-2.5 right-2.5 flex items-center gap-1.5 z-20">
                      {!isBroken && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveLightboxIndex(idx);
                          }}
                          className="p-1.5 rounded-lg bg-black/70 hover:bg-black text-white/90 hover:text-white backdrop-blur-md border border-white/15 transition-all cursor-pointer shadow-md hover:scale-105"
                          title="Full Screen View"
                          aria-label="Full Screen View"
                        >
                          <Icon icon="solar:maximize-square-bold" className="text-sm" />
                        </button>
                      )}

                      {isAdmin && (
                        <button
                          type="button"
                          onClick={(e) => handleDeleteImage(e, img.id)}
                          className="p-1.5 rounded-lg bg-red-950/90 hover:bg-red-800 text-red-200 backdrop-blur-md border border-red-500/30 transition-all cursor-pointer shadow-md hover:scale-105"
                          title="Delete image"
                        >
                          <Icon icon="solar:trash-bin-trash-bold" className="text-sm" />
                        </button>
                      )}
                    </div>

                    {/* Center Zoom Hint on Hover */}
                    {!isBroken && (
                      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10 pointer-events-none">
                        <div className="px-3 py-1.5 rounded-xl bg-black/80 backdrop-blur-md border border-white/20 text-white text-xs font-semibold shadow-xl scale-95 group-hover:scale-100 transition-transform flex items-center gap-1.5">
                          <Icon icon="solar:maximize-square-bold" className="text-sm text-brand" />
                          <span>Full Screen View</span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Caption Footer */}
                  {img.caption && (
                    <div className="p-3 bg-surface border-t border-border/40 text-xs font-medium text-text-secondary line-clamp-1">
                      {img.caption}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
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
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-text-secondary block">
                      Select Photos <span className="text-brand">*</span>
                    </label>
                    {selectedFiles.length > 0 && (
                      <span className="text-[11px] font-bold text-brand">
                        {selectedFiles.length} photo{selectedFiles.length > 1 ? 's' : ''} selected
                      </span>
                    )}
                  </div>
                  <div
                    onDragOver={(e) => {
                      e.preventDefault();
                      setIsDragging(true);
                    }}
                    onDragLeave={() => setIsDragging(false)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setIsDragging(false);
                      const files = e.dataTransfer.files;
                      if (files && files.length > 0) handleFilesChosen(files);
                    }}
                    onClick={() => fileInputRef.current?.click()}
                    className={`border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-all ${
                      isDragging
                        ? 'border-brand bg-brand/10'
                        : 'border-border/80 hover:border-brand/60 bg-surface-2/60'
                    }`}
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      multiple
                      accept="image/png,image/jpeg,image/webp,image/jpg"
                      className="hidden"
                      onChange={(e) => {
                        const files = e.target.files;
                        if (files && files.length > 0) handleFilesChosen(files);
                      }}
                    />

                    {selectedFiles.length > 0 ? (
                      <div className="space-y-3" onClick={(e) => e.stopPropagation()}>
                        <div className="grid grid-cols-3 gap-2 max-h-48 overflow-y-auto p-1">
                          {selectedFiles.map((item, idx) => (
                            <div key={idx} className="relative aspect-[4/3] rounded-lg overflow-hidden bg-black/60 border border-border group/preview">
                              <img
                                src={item.preview}
                                alt={item.name}
                                className="w-full h-full object-cover"
                              />
                              <button
                                type="button"
                                onClick={() => removeFile(idx)}
                                className="absolute top-1 right-1 p-1 rounded-full bg-black/80 hover:bg-red-600 text-white text-xs cursor-pointer shadow-md transition-colors"
                                title="Remove photo"
                              >
                                <Icon icon="solar:close-circle-bold" className="text-sm" />
                              </button>
                              <div className="absolute bottom-0 inset-x-0 p-1 bg-black/70 text-[9px] font-mono text-white/80 truncate">
                                {(item.size / 1024).toFixed(0)} KB
                              </div>
                            </div>
                          ))}
                        </div>
                        <div className="flex items-center justify-between pt-1">
                          <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            className="text-[11px] font-bold text-brand hover:underline inline-flex items-center gap-1 cursor-pointer"
                          >
                            <Icon icon="solar:add-circle-bold" />
                            <span>Add more photos</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              selectedFiles.forEach((f) => f.preview && URL.revokeObjectURL(f.preview));
                              setSelectedFiles([]);
                            }}
                            className="text-[11px] font-bold text-text-muted hover:text-red-400 cursor-pointer"
                          >
                            Clear all
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-2 py-3">
                        <div className="w-12 h-12 rounded-full bg-brand/10 text-brand flex items-center justify-center mx-auto border border-brand/20">
                          <Icon icon="solar:upload-track-2-bold" className="w-6 h-6" />
                        </div>
                        <div>
                          <p className="text-xs font-bold text-text-primary">
                            Click to select photos or drag &amp; drop
                          </p>
                          <p className="text-[11px] text-text-muted mt-0.5">
                            JPEG, PNG, or WebP · You can select multiple photos at once
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
                      <span>{uploadMode === 'upload' ? (selectedFiles.length > 1 ? `Uploading ${selectedFiles.length} Photos…` : 'Uploading…') : 'Adding…'}</span>
                    </>
                  ) : (
                    <>
                      <Icon icon="solar:check-circle-bold" className="text-sm" />
                      <span>
                        {uploadMode === 'upload'
                          ? (selectedFiles.length > 1 ? `Upload ${selectedFiles.length} Photos` : 'Upload Photo')
                          : 'Add to Gallery'}
                      </span>
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
