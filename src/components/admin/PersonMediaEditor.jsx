import { useState, useEffect, useRef } from 'react';
import { Icon } from '@iconify/react';
import { supabase } from '../../lib/supabase';
import { toast } from 'react-hot-toast';
import ImageField from './ImageField';

const PHOTO_CATEGORIES = [
  { value: 'headshot', label: 'Headshot / Portrait' },
  { value: 'production_still', label: 'Production Still' },
  { value: 'red_carpet', label: 'Red Carpet / Premiere' },
  { value: 'behind_the_scenes', label: 'Behind The Scenes' }
];

const VIDEO_CATEGORIES = [
  { value: 'showreel', label: 'Showreel / Demo Reel' },
  { value: 'monologue', label: 'Monologue Performance' },
  { value: 'scene_clip', label: 'Scene Clip' },
  { value: 'interview', label: 'Interview' },
  { value: 'behind_the_scenes', label: 'BTS Video' }
];

function extractYoutubeId(url) {
  if (!url) return null;
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
  const match = url.match(regExp);
  return (match && match[2].length === 11) ? match[2] : null;
}

export default function PersonMediaEditor({ personId, personName }) {
  const [mediaList, setMediaList] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('all'); // 'all', 'photo', 'video'
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  // Form State
  const [formData, setFormData] = useState({
    media_type: 'photo',
    category: 'headshot',
    title: '',
    description: '',
    url: '',
    thumbnail_url: '',
    film_id: null,
    character_name: '',
    photographer_credit: '',
    year: new Date().getFullYear(),
    is_primary: false,
    status: 'approved'
  });

  const fetchMedia = async () => {
    if (!personId) return;
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('person_media')
        .select(`
          *,
          films(id, title, year, poster_url)
        `)
        .eq('person_id', personId)
        .order('is_primary', { ascending: false })
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error loading media:', error);
      } else {
        setMediaList(data || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchMedia();
  }, [personId]);

  const resetForm = () => {
    setFormData({
      media_type: 'photo',
      category: 'headshot',
      title: '',
      description: '',
      url: '',
      thumbnail_url: '',
      film_id: null,
      character_name: '',
      photographer_credit: '',
      year: new Date().getFullYear(),
      is_primary: false,
      status: 'approved'
    });
    setEditingItem(null);
  };

  const handleOpenAdd = (type = 'photo') => {
    resetForm();
    setFormData(prev => ({
      ...prev,
      media_type: type,
      category: type === 'photo' ? 'headshot' : 'showreel'
    }));
    setShowAddModal(true);
  };

  const handleOpenEdit = (item) => {
    setEditingItem(item);
    setFormData({
      media_type: item.media_type,
      category: item.category,
      title: item.title,
      description: item.description || '',
      url: item.url,
      thumbnail_url: item.thumbnail_url || '',
      film_id: item.film_id || null,
      character_name: item.character_name || '',
      photographer_credit: item.photographer_credit || '',
      year: item.year || new Date().getFullYear(),
      is_primary: Boolean(item.is_primary),
      status: item.status || 'approved'
    });
    setShowAddModal(true);
  };

  const handleUrlChange = (val) => {
    const update = { url: val };
    if (formData.media_type === 'video') {
      const ytId = extractYoutubeId(val);
      if (ytId) {
        update.thumbnail_url = `https://img.youtube.com/vi/${ytId}/hqdefault.jpg`;
      }
    }
    setFormData(prev => ({ ...prev, ...update }));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!formData.title.trim()) return toast.error('Please enter a title');
    if (!formData.url.trim()) return toast.error('Please provide a media URL');

    setIsSaving(true);
    try {
      let embedProvider = null;
      let embedId = null;

      if (formData.media_type === 'video') {
        const ytId = extractYoutubeId(formData.url);
        if (ytId) {
          embedProvider = 'youtube';
          embedId = ytId;
        } else if (formData.url.includes('vimeo.com')) {
          embedProvider = 'vimeo';
        }
      }

      // If set as primary, un-primary existing items of same media_type for this person
      if (formData.is_primary) {
        await supabase
          .from('person_media')
          .update({ is_primary: false })
          .eq('person_id', personId)
          .eq('media_type', formData.media_type);
      }

      const payload = {
        person_id: personId,
        media_type: formData.media_type,
        category: formData.category,
        title: formData.title.trim(),
        description: formData.description.trim() || null,
        url: formData.url.trim(),
        thumbnail_url: formData.thumbnail_url?.trim() || null,
        embed_provider: embedProvider,
        embed_id: embedId,
        film_id: formData.film_id || null,
        character_name: formData.character_name?.trim() || null,
        photographer_credit: formData.photographer_credit?.trim() || null,
        year: formData.year ? parseInt(formData.year) : null,
        is_primary: formData.is_primary,
        status: formData.status || 'approved',
        updated_at: new Date().toISOString()
      };

      if (editingItem) {
        const { error } = await supabase
          .from('person_media')
          .update(payload)
          .eq('id', editingItem.id);
        if (error) throw error;
        toast.success('Media updated successfully');
      } else {
        const { error } = await supabase
          .from('person_media')
          .insert({
            ...payload,
            created_at: new Date().toISOString()
          });
        if (error) throw error;
        toast.success('Media added successfully');
      }

      setShowAddModal(false);
      resetForm();
      fetchMedia();
    } catch (err) {
      console.error(err);
      toast.error('Failed to save media: ' + (err.message || err));
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this media item?')) return;
    setDeletingId(id);
    try {
      const { error } = await supabase
        .from('person_media')
        .delete()
        .eq('id', id);
      if (error) throw error;
      toast.success('Media deleted');
      setMediaList(prev => prev.filter(m => m.id !== id));
    } catch (err) {
      toast.error('Delete failed: ' + (err.message || err));
    } finally {
      setDeletingId(null);
    }
  };

  const handleTogglePrimary = async (item) => {
    try {
      const nextPrimary = !item.is_primary;
      if (nextPrimary) {
        await supabase
          .from('person_media')
          .update({ is_primary: false })
          .eq('person_id', personId)
          .eq('media_type', item.media_type);
      }
      await supabase
        .from('person_media')
        .update({ is_primary: nextPrimary })
        .eq('id', item.id);

      toast.success(nextPrimary ? 'Set as primary' : 'Unset primary');
      fetchMedia();
    } catch (err) {
      toast.error('Failed to update primary status');
    }
  };

  const photos = mediaList.filter(m => m.media_type === 'photo');
  const videos = mediaList.filter(m => m.media_type === 'video');

  const filteredMedia = activeTab === 'all' 
    ? mediaList 
    : mediaList.filter(m => m.media_type === activeTab);

  return (
    <section className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between pb-2 border-b border-border">
        <div className="flex items-center gap-2">
          <span className="text-xl">🎬</span>
          <h4 className="text-xs font-bold text-text-muted">Media &amp; Gallery</h4>
          {mediaList.length > 0 && (
            <span className="text-[10px] font-black bg-brand/10 text-brand border border-brand/20 rounded-xl px-2 py-0.5">
              {mediaList.length}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => handleOpenAdd('photo')}
            className="flex items-center gap-1 text-[11px] font-bold bg-surface border border-border hover:border-brand px-2.5 py-1 rounded-lg text-text-primary hover:text-brand transition-all"
          >
            <Icon icon="solar:camera-add-bold" width="14" />
            <span>Add Photo</span>
          </button>
          <button
            type="button"
            onClick={() => handleOpenAdd('video')}
            className="flex items-center gap-1 text-[11px] font-bold bg-brand text-white hover:bg-brand/90 px-2.5 py-1 rounded-lg transition-all shadow-sm"
          >
            <Icon icon="solar:videocamera-add-bold" width="14" />
            <span>Add Video</span>
          </button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setActiveTab('all')}
          className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
            activeTab === 'all'
              ? 'bg-brand text-white'
              : 'bg-surface border border-border text-text-muted hover:text-text-primary'
          }`}
        >
          All ({mediaList.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('photo')}
          className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition-all ${
            activeTab === 'photo'
              ? 'bg-brand text-white'
              : 'bg-surface border border-border text-text-muted hover:text-text-primary'
          }`}
        >
          <Icon icon="solar:gallery-bold" width="14" />
          <span>Photos ({photos.length})</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('video')}
          className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition-all ${
            activeTab === 'video'
              ? 'bg-brand text-white'
              : 'bg-surface border border-border text-text-muted hover:text-text-primary'
          }`}
        >
          <Icon icon="solar:video-frame-bold" width="14" />
          <span>Videos ({videos.length})</span>
        </button>
      </div>

      {/* Content Area */}
      {isLoading ? (
        <div className="p-8 text-center bg-surface-2/30 rounded-xl border border-border text-xs text-text-muted">
          <Icon icon="solar:spinner-line" className="animate-spin text-lg mx-auto mb-2 text-brand" />
          Loading media assets...
        </div>
      ) : filteredMedia.length === 0 ? (
        <div className="p-8 text-center bg-surface-2/30 rounded-xl border border-dashed border-border/80 space-y-2">
          <div className="text-2xl opacity-40">📸 🎥</div>
          <p className="text-xs text-text-muted">
            No {activeTab === 'all' ? 'photos or videos' : activeTab === 'photo' ? 'photos' : 'videos'} uploaded for {personName || 'this actor'}.
          </p>
          <div className="pt-2 flex items-center justify-center gap-2">
            <button
              type="button"
              onClick={() => handleOpenAdd('photo')}
              className="text-xs font-bold text-brand hover:underline"
            >
              + Add headshot or still
            </button>
            <span className="text-border">•</span>
            <button
              type="button"
              onClick={() => handleOpenAdd('video')}
              className="text-xs font-bold text-brand hover:underline"
            >
              + Add showreel or monologue
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {filteredMedia.map((item) => (
            <div
              key={item.id}
              className={`group relative rounded-xl border overflow-hidden bg-surface transition-all flex flex-col justify-between ${
                item.is_primary ? 'border-brand shadow-sm ring-1 ring-brand/30' : 'border-border hover:border-border-hover'
              }`}
            >
              {/* Thumbnail / Image Box */}
              <div className="relative aspect-video bg-black/40 overflow-hidden">
                <img
                  src={item.thumbnail_url || item.url}
                  alt={item.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  onError={(e) => {
                    e.currentTarget.src = 'https://images.unsplash.com/photo-1485846234645-a62644f84728?auto=format&fit=crop&w=400&q=80';
                  }}
                />

                {/* Media Type Badge */}
                <div className="absolute top-2 left-2 flex items-center gap-1 bg-black/80 backdrop-blur-md px-2 py-0.5 rounded-md text-[10px] font-bold text-white uppercase tracking-wider">
                  <Icon
                    icon={item.media_type === 'video' ? 'solar:play-circle-bold' : 'solar:camera-bold'}
                    className="text-brand"
                    width="12"
                  />
                  <span>{item.category?.replace(/_/g, ' ')}</span>
                </div>

                {/* Primary Star Tag */}
                {item.is_primary && (
                  <div className="absolute top-2 right-2 bg-brand text-white px-1.5 py-0.5 rounded text-[9px] font-black uppercase flex items-center gap-1 shadow-md">
                    <Icon icon="solar:star-bold" width="10" />
                    <span>Hero</span>
                  </div>
                )}

                {/* Hover Action Overlay */}
                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 p-2">
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noreferrer"
                    className="p-1.5 bg-white/20 hover:bg-white text-white hover:text-black rounded-lg transition-all"
                    title="Open full media"
                  >
                    <Icon icon="solar:link-circle-bold" width="16" />
                  </a>
                  <button
                    type="button"
                    onClick={() => handleTogglePrimary(item)}
                    className={`p-1.5 rounded-lg transition-all ${
                      item.is_primary ? 'bg-amber-400 text-black' : 'bg-white/20 hover:bg-amber-400 text-white hover:text-black'
                    }`}
                    title={item.is_primary ? 'Hero featured' : 'Make hero'}
                  >
                    <Icon icon="solar:star-bold" width="16" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleOpenEdit(item)}
                    className="p-1.5 bg-white/20 hover:bg-brand text-white rounded-lg transition-all"
                    title="Edit details"
                  >
                    <Icon icon="solar:pen-bold" width="16" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(item.id)}
                    disabled={deletingId === item.id}
                    className="p-1.5 bg-white/20 hover:bg-red-500 text-white rounded-lg transition-all"
                    title="Delete media"
                  >
                    <Icon icon="solar:trash-bin-trash-bold" width="16" />
                  </button>
                </div>
              </div>

              {/* Title & Info */}
              <div className="p-2.5 space-y-1">
                <h5 className="text-xs font-bold text-text-primary truncate" title={item.title}>
                  {item.title}
                </h5>
                <div className="flex items-center justify-between text-[10px] text-text-muted">
                  <span>{item.year || ''}</span>
                  {item.films && (
                    <span className="truncate max-w-[100px] text-brand font-medium">
                      {item.films.title}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add / Edit Media Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface border border-border rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="p-4 border-b border-border flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xl">{formData.media_type === 'video' ? '🎥' : '📸'}</span>
                <h3 className="text-sm font-bold text-text-primary">
                  {editingItem ? 'Edit Media Asset' : `Add ${formData.media_type === 'video' ? 'Video / Showreel' : 'Photo / Still'}`}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="p-1 rounded-lg text-text-muted hover:text-text-primary hover:bg-surface-2 transition-all"
              >
                <Icon icon="solar:close-circle-bold" width="20" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSave} className="p-5 space-y-4 overflow-y-auto custom-scrollbar flex-1">
              {/* Media Type & Category */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-text-primary mb-1.5">Type</label>
                  <select
                    value={formData.media_type}
                    onChange={(e) => {
                      const nextType = e.target.value;
                      setFormData(prev => ({
                        ...prev,
                        media_type: nextType,
                        category: nextType === 'photo' ? 'headshot' : 'showreel'
                      }));
                    }}
                    className="w-full bg-surface-2 border border-border p-2.5 rounded-lg text-xs font-semibold focus:border-brand outline-none"
                  >
                    <option value="photo">Photo / Still</option>
                    <option value="video">Video / Reel / Clip</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-text-primary mb-1.5">Category</label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}
                    className="w-full bg-surface-2 border border-border p-2.5 rounded-lg text-xs font-semibold focus:border-brand outline-none"
                  >
                    {(formData.media_type === 'photo' ? PHOTO_CATEGORIES : VIDEO_CATEGORIES).map(c => (
                      <option key={c.value} value={c.value}>{c.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Title */}
              <div>
                <label className="block text-xs font-bold text-text-primary mb-1.5">Title / Headline *</label>
                <input
                  type="text"
                  placeholder={formData.media_type === 'video' ? "e.g., 2024 Drama Showreel" : "e.g., AMVCA 10 Red Carpet"}
                  value={formData.title}
                  onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                  className="w-full bg-surface-2 border border-border p-2.5 rounded-lg text-xs focus:border-brand outline-none font-medium"
                  required
                />
              </div>

              {/* URL or Upload */}
              {formData.media_type === 'photo' ? (
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-bold text-text-primary mb-1.5">Photo URL *</label>
                    <input
                      type="url"
                      placeholder="https://..."
                      value={formData.url}
                      onChange={(e) => setFormData(prev => ({ ...prev, url: e.target.value, thumbnail_url: e.target.value }))}
                      className="w-full bg-surface-2 border border-border p-2.5 rounded-lg text-xs focus:border-brand outline-none"
                    />
                  </div>
                  <ImageField
                    label="Or Upload Image directly"
                    value={formData.url}
                    onChange={(url) => setFormData(prev => ({ ...prev, url, thumbnail_url: url }))}
                    bucket="people"
                    aspect="wide"
                  />
                </div>
              ) : (
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-bold text-text-primary mb-1.5">
                      Video URL (YouTube / Vimeo / Cloudflare R2) *
                    </label>
                    <input
                      type="url"
                      placeholder="https://www.youtube.com/watch?v=..."
                      value={formData.url}
                      onChange={(e) => handleUrlChange(e.target.value)}
                      className="w-full bg-surface-2 border border-border p-2.5 rounded-lg text-xs focus:border-brand outline-none"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-text-muted mb-1.5">Custom Thumbnail URL (Optional)</label>
                    <input
                      type="url"
                      placeholder="Auto-extracted from YouTube or custom image"
                      value={formData.thumbnail_url}
                      onChange={(e) => setFormData(prev => ({ ...prev, thumbnail_url: e.target.value }))}
                      className="w-full bg-surface-2 border border-border p-2.5 rounded-lg text-xs focus:border-brand outline-none"
                    />
                  </div>
                </div>
              )}

              {/* Optional Meta (Year, Character, Photographer) */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-text-muted mb-1.5">Year</label>
                  <input
                    type="number"
                    value={formData.year || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, year: e.target.value }))}
                    className="w-full bg-surface-2 border border-border p-2 rounded-lg text-xs focus:border-brand outline-none"
                    placeholder="2024"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-text-muted mb-1.5">Character Name</label>
                  <input
                    type="text"
                    value={formData.character_name}
                    onChange={(e) => setFormData(prev => ({ ...prev, character_name: e.target.value }))}
                    className="w-full bg-surface-2 border border-border p-2 rounded-lg text-xs focus:border-brand outline-none"
                    placeholder="Optional"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-text-muted mb-1.5">Photographer / Credit</label>
                  <input
                    type="text"
                    value={formData.photographer_credit}
                    onChange={(e) => setFormData(prev => ({ ...prev, photographer_credit: e.target.value }))}
                    className="w-full bg-surface-2 border border-border p-2 rounded-lg text-xs focus:border-brand outline-none"
                    placeholder="Optional"
                  />
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-bold text-text-muted mb-1.5">Description / Context</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  className="w-full bg-surface-2 border border-border p-2.5 rounded-lg text-xs focus:border-brand outline-none h-16 resize-none custom-scrollbar"
                  placeholder="Additional context about this performance or photo..."
                />
              </div>

              {/* Is Primary Checkbox */}
              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="is_primary_checkbox"
                  checked={formData.is_primary}
                  onChange={(e) => setFormData(prev => ({ ...prev, is_primary: e.target.checked }))}
                  className="rounded border-border text-brand focus:ring-brand accent-brand cursor-pointer"
                />
                <label htmlFor="is_primary_checkbox" className="text-xs font-semibold text-text-primary cursor-pointer">
                  Feature as Hero / Primary {formData.media_type === 'video' ? 'Showreel' : 'Photo'}
                </label>
              </div>

              {/* Submit Buttons */}
              <div className="pt-4 border-t border-border flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-text-muted hover:text-text-primary hover:bg-surface-2 transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-brand text-white hover:bg-brand/90 transition-all flex items-center gap-1.5 shadow-sm disabled:opacity-50"
                >
                  {isSaving && <Icon icon="solar:spinner-line" className="animate-spin" />}
                  <span>{editingItem ? 'Update Media' : 'Save Media Asset'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}
