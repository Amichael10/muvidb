import React, { useState } from 'react';
import { Icon } from '@iconify/react';
import toast from 'react-hot-toast';
import PlayPhotoLightboxModal from './PlayPhotoLightboxModal';
import { addPlayImage, deletePlayImage } from '../../lib/plays';

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
  const [saving, setSaving] = useState(false);
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

  async function handleAddImage(e) {
    e.preventDefault();
    if (!newImage.url.trim()) {
      toast.error('Please enter an image URL');
      return;
    }
    setSaving(true);
    try {
      await addPlayImage({
        play_id: play.id,
        url: newImage.url.trim(),
        caption: newImage.caption.trim() || null,
        image_type: newImage.image_type || 'production_still',
        is_primary: !!newImage.is_primary,
        sort_order: images.length + 1,
      });
      toast.success('Gallery photo added successfully');
      setNewImage({ url: '', caption: '', image_type: 'production_still', is_primary: false });
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
            onClick={() => setShowAddModal(true)}
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
                As an administrator, you can upload or link high-resolution performance photos, set imagery, and key art.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowAddModal(true)}
              className="px-4 py-2 rounded-xl bg-brand text-white text-xs font-bold hover:bg-brand-hover transition-colors cursor-pointer inline-flex items-center gap-2"
            >
              <Icon icon="solar:add-circle-bold" />
              <span>Add First Gallery Photo</span>
            </button>
          </div>
        )
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4">
          {images.map((img, idx) => (
            <div
              key={img.id || idx}
              onClick={() => setActiveLightboxIndex(idx)}
              className="group relative rounded-2xl border border-border/80 hover:border-brand/60 bg-surface overflow-hidden cursor-pointer transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-brand/5 flex flex-col"
            >
              <div className="relative aspect-[4/3] bg-surface-2 overflow-hidden">
                <img
                  src={img.url}
                  alt={img.caption || `${play?.title} production still`}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  loading="lazy"
                />

                {/* Gradient vignette */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-60 group-hover:opacity-80 transition-opacity" />

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
                    className="absolute top-2 right-2 z-20 p-1.5 rounded-lg bg-red-950/80 hover:bg-red-900 text-red-200 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer shadow-sm"
                    title="Delete image"
                  >
                    <Icon icon="solar:trash-bin-trash-bold" className="text-xs" />
                  </button>
                )}

                {/* Center Zoom Icon on Hover */}
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10 pointer-events-none">
                  <div className="p-2.5 rounded-full bg-brand text-white shadow-lg scale-90 group-hover:scale-100 transition-transform">
                    <Icon icon="solar:magnifer-zoom-in-bold" className="text-lg" />
                  </div>
                </div>
              </div>

              {/* Caption Footer */}
              {img.caption && (
                <div className="p-2.5 bg-surface border-t border-border/40 text-[11px] font-medium text-text-secondary line-clamp-1">
                  {img.caption}
                </div>
              )}
            </div>
          ))}
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
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in"
          onClick={() => setShowAddModal(false)}
        >
          <div
            className="relative w-full max-w-md rounded-2xl bg-surface border border-border shadow-2xl p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2">
                <Icon icon="solar:gallery-wide-bold" className="text-brand text-lg" />
                <h3 className="text-base font-bold text-text-primary">Add Gallery Photo</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="p-1 rounded-lg text-text-muted hover:text-text-primary cursor-pointer"
              >
                <Icon icon="solar:close-circle-bold" className="text-xl" />
              </button>
            </div>

            <form onSubmit={handleAddImage} className="space-y-3">
              <div>
                <label className="text-xs font-bold text-text-secondary block mb-1">Image URL *</label>
                <input
                  type="url"
                  required
                  value={newImage.url}
                  onChange={(e) => setNewImage({ ...newImage, url: e.target.value })}
                  placeholder="https://... direct image URL"
                  className="w-full bg-surface-2 border border-border rounded-xl px-4 py-2.5 text-xs text-text-primary focus:border-brand focus:outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-text-secondary block mb-1">Image Category</label>
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

              <div>
                <label className="text-xs font-bold text-text-secondary block mb-1">Caption (Optional)</label>
                <input
                  type="text"
                  value={newImage.caption}
                  onChange={(e) => setNewImage({ ...newImage, caption: e.target.value })}
                  placeholder="e.g. Afternoon Performance Pass, Stage Moment"
                  className="w-full bg-surface-2 border border-border rounded-xl px-4 py-2.5 text-xs text-text-primary focus:border-brand focus:outline-none"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <label className="flex items-center gap-2 text-xs text-text-secondary cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={newImage.is_primary}
                    onChange={(e) => setNewImage({ ...newImage, is_primary: e.target.checked })}
                    className="rounded border-border text-brand focus:ring-brand"
                  />
                  <span>Mark as primary key art</span>
                </label>
              </div>

              <div className="flex items-center gap-3 pt-3 border-t border-border">
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 bg-brand text-white font-bold py-2.5 rounded-xl text-xs hover:bg-brand-hover transition-colors disabled:opacity-50 cursor-pointer"
                >
                  {saving ? 'Adding…' : 'Add to Gallery'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2.5 rounded-xl bg-surface-2 hover:bg-surface-3 text-text-secondary text-xs font-bold transition-colors cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}
