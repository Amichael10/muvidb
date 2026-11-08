import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { toast } from 'react-hot-toast';
import { Icon } from '@iconify/react';
import { fetchPlayImages, addPlayImage, deletePlayImage, updatePlayImage } from '../../lib/plays';

const IMAGE_TYPES = [
  { value: 'production_still', label: 'Production Still' },
  { value: 'poster', label: 'Poster / Key Art' },
  { value: 'stage_performance', label: 'Stage Performance' },
  { value: 'behind_the_scenes', label: 'Behind the Scenes' },
  { value: 'rehearsal', label: 'Rehearsal' },
];

export default function PlayImagesEditor({ playId, onUpdated }) {
  const [images, setImages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);

  const initialFormState = {
    url: '',
    caption: '',
    image_type: 'production_still',
    is_primary: false,
    sort_order: 0,
  };

  const [formData, setFormData] = useState(initialFormState);

  useEffect(() => {
    if (playId) {
      loadImages();
    }
  }, [playId]);

  async function loadImages() {
    setLoading(true);
    try {
      const data = await fetchPlayImages(playId);
      setImages(data || []);
    } catch (err) {
      console.error('Failed to load play images:', err);
      toast.error('Could not load play gallery images');
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!formData.url.trim()) {
      toast.error('Please enter an image URL');
      return;
    }

    setIsSaving(true);
    try {
      await addPlayImage({
        play_id: playId,
        url: formData.url.trim(),
        caption: formData.caption.trim() || null,
        image_type: formData.image_type || 'production_still',
        is_primary: !!formData.is_primary,
        sort_order: Number(formData.sort_order || images.length + 1),
      });

      toast.success('Gallery image added successfully');
      setFormData(initialFormState);
      setShowAddForm(false);
      await loadImages();
      if (onUpdated) onUpdated();
    } catch (err) {
      console.error('Error adding play image:', err);
      toast.error(err.message || 'Failed to add image');
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete(imageId) {
    if (!window.confirm('Are you sure you want to delete this gallery image?')) return;
    try {
      await deletePlayImage(imageId);
      toast.success('Image deleted');
      setImages(prev => prev.filter(img => img.id !== imageId));
      if (onUpdated) onUpdated();
    } catch (err) {
      console.error('Error deleting play image:', err);
      toast.error(err.message || 'Failed to delete image');
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-xs font-bold text-text-muted uppercase tracking-wider flex items-center gap-2">
            <Icon icon="solar:gallery-wide-bold" className="text-brand w-4 h-4" />
            Stage Production Gallery ({images.length})
          </h4>
          <p className="text-[11px] text-text-muted mt-0.5">
            Production stills, posters, backstage photos, and live performance imagery.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowAddForm(prev => !prev)}
          className="px-3 py-1.5 rounded-lg bg-brand text-white text-xs font-bold flex items-center gap-1.5 hover:bg-brand-hover transition-colors cursor-pointer"
        >
          <Icon icon={showAddForm ? 'solar:close-circle-bold' : 'solar:add-circle-bold'} className="text-sm" />
          <span>{showAddForm ? 'Cancel' : 'Add Image'}</span>
        </button>
      </div>

      {/* Add Image Form */}
      {showAddForm && (
        <form onSubmit={handleSubmit} className="p-4 rounded-xl bg-surface-2 border border-border space-y-3 animate-fade-in">
          <div className="text-xs font-bold text-text-primary mb-2 flex items-center gap-1.5">
            <Icon icon="solar:cloud-upload-bold" className="text-brand text-sm" />
            <span>Add Production Still or Poster</span>
          </div>

          <div>
            <label className="text-[11px] font-semibold text-text-muted block mb-1">Image URL *</label>
            <input
              type="url"
              required
              value={formData.url}
              onChange={e => setFormData({ ...formData, url: e.target.value })}
              placeholder="https://... image url"
              className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-xs text-text-primary focus:border-brand focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-semibold text-text-muted block mb-1">Image Type</label>
              <select
                value={formData.image_type}
                onChange={e => setFormData({ ...formData, image_type: e.target.value })}
                className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-xs text-text-primary focus:border-brand focus:outline-none"
              >
                {IMAGE_TYPES.map(t => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[11px] font-semibold text-text-muted block mb-1">Caption (Optional)</label>
              <input
                type="text"
                value={formData.caption}
                onChange={e => setFormData({ ...formData, caption: e.target.value })}
                placeholder="e.g. Afternoon Performance Pass / Rehearsal"
                className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-xs text-text-primary focus:border-brand focus:outline-none"
              />
            </div>
          </div>

          <div className="flex items-center gap-2 pt-1">
            <label className="flex items-center gap-2 text-xs text-text-secondary cursor-pointer select-none">
              <input
                type="checkbox"
                checked={formData.is_primary}
                onChange={e => setFormData({ ...formData, is_primary: e.target.checked })}
                className="rounded border-border text-brand focus:ring-brand"
              />
              <span>Set as primary gallery highlight</span>
            </label>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-border/40">
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="px-3 py-1.5 rounded-lg bg-surface hover:bg-surface-3 text-text-muted text-xs font-semibold"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-4 py-1.5 rounded-lg bg-brand text-white text-xs font-bold hover:bg-brand-hover transition-colors disabled:opacity-50"
            >
              {isSaving ? 'Saving…' : 'Save Image'}
            </button>
          </div>
        </form>
      )}

      {/* Existing Images Grid */}
      {loading ? (
        <div className="p-6 text-center text-xs text-text-muted">Loading gallery images…</div>
      ) : images.length === 0 ? (
        <div className="p-6 text-center bg-surface-2/40 border border-dashed border-border rounded-xl text-xs text-text-muted">
          No gallery images attached to this stage play yet.
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {images.map((img) => (
            <div key={img.id} className="group relative rounded-xl border border-border bg-surface overflow-hidden flex flex-col">
              <div className="relative aspect-[4/3] bg-black/40 overflow-hidden">
                <img
                  src={img.url}
                  alt={img.caption || 'Play still'}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  loading="lazy"
                />
                <div className="absolute top-1.5 left-1.5 flex gap-1">
                  <span className="text-[9px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-black/70 text-amber-300 backdrop-blur-xs">
                    {img.image_type?.replace(/_/g, ' ')}
                  </span>
                  {img.is_primary && (
                    <span className="text-[9px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-brand text-white">
                      Primary
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => handleDelete(img.id)}
                  className="absolute top-1.5 right-1.5 p-1 rounded-md bg-red-950/80 hover:bg-red-900 text-red-200 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer shadow-sm"
                  title="Delete image"
                >
                  <Icon icon="solar:trash-bin-trash-bold" className="text-xs" />
                </button>
              </div>

              {img.caption && (
                <div className="p-2 text-[11px] text-text-muted line-clamp-2">
                  {img.caption}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
