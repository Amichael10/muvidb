import React, { useEffect, useState } from 'react';
import { Icon } from '@iconify/react';
import { fetchCritics, upsertCritic, deleteCritic } from '../../lib/critics';
import SEO from '../../components/SEO';

export default function AdminCritics() {
  const [critics, setCritics] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null); // null or critic object
  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    title: '',
    publication: '',
    bio: '',
    avatar_url: '',
    platform: '',
    handle: '',
    profile_url: '',
    is_verified: true
  });

  async function loadData() {
    setLoading(true);
    const data = await fetchCritics();
    setCritics(data);
    setLoading(false);
  }

  useEffect(() => {
    loadData();
  }, []);

  function handleEdit(critic) {
    setEditing(critic);
    setFormData({
      name: critic.name || '',
      slug: critic.slug || '',
      title: critic.title || '',
      publication: critic.publication || '',
      bio: critic.bio || '',
      avatar_url: critic.avatar_url || '',
      platform: critic.platform || '',
      handle: critic.handle || '',
      profile_url: critic.profile_url || '',
      is_verified: critic.is_verified ?? true
    });
  }

  function handleReset() {
    setEditing(null);
    setFormData({
      name: '',
      slug: '',
      title: '',
      publication: '',
      bio: '',
      avatar_url: '',
      platform: '',
      handle: '',
      profile_url: '',
      is_verified: true
    });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!formData.name.trim()) return alert('Name is required');

    try {
      const payload = editing ? { ...formData, id: editing.id } : formData;
      await upsertCritic(payload);
      alert(editing ? 'Critic updated!' : 'Critic created!');
      handleReset();
      loadData();
    } catch (err) {
      console.error(err);
      alert('Failed to save critic: ' + err.message);
    }
  }

  async function handleDelete(critic) {
    if (!window.confirm(`Delete critic "${critic.name}"?`)) return;
    try {
      await deleteCritic(critic.id);
      loadData();
    } catch (err) {
      alert('Failed to delete critic: ' + err.message);
    }
  }

  return (
    <div className="min-h-screen bg-bg-dark text-text-primary p-6 md:p-10 max-w-7xl mx-auto">
      <SEO title="Manage Film Critics | MuviDB Admin" />

      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-extrabold text-white flex items-center gap-2">
            <Icon icon="solar:pen-new-square-bold" className="text-accent-yellow w-8 h-8" />
            Manage Film Critics
          </h1>
          <p className="text-xs text-text-muted mt-1">Add, update, or edit verified film critic profiles and publications.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Form Column */}
        <div className="bg-surface-dark border border-border-dark p-6 rounded-2xl h-fit">
          <h2 className="text-lg font-bold text-white mb-4">
            {editing ? 'Edit Critic' : 'Add New Critic'}
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4 text-xs">
            <div>
              <label className="text-text-muted font-bold block mb-1">Critic Full Name *</label>
              <input
                type="text"
                value={formData.name}
                onChange={e => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g. Tolu Fagbure"
                className="w-full bg-bg-dark border border-border-dark rounded-xl px-3 py-2 text-white"
                required
              />
            </div>

            <div>
              <label className="text-text-muted font-bold block mb-1">URL Slug (Optional)</label>
              <input
                type="text"
                value={formData.slug}
                onChange={e => setFormData({ ...formData, slug: e.target.value })}
                placeholder="e.g. tolu-fagbure"
                className="w-full bg-bg-dark border border-border-dark rounded-xl px-3 py-2 text-white"
              />
            </div>

            <div>
              <label className="text-text-muted font-bold block mb-1">Professional Title</label>
              <input
                type="text"
                value={formData.title}
                onChange={e => setFormData({ ...formData, title: e.target.value })}
                placeholder="e.g. Film Critic & Culture Analyst"
                className="w-full bg-bg-dark border border-border-dark rounded-xl px-3 py-2 text-white"
              />
            </div>

            <div>
              <label className="text-text-muted font-bold block mb-1">Publication / Outlet</label>
              <input
                type="text"
                value={formData.publication}
                onChange={e => setFormData({ ...formData, publication: e.target.value })}
                placeholder="e.g. Film Efiko / Melody FM"
                className="w-full bg-bg-dark border border-border-dark rounded-xl px-3 py-2 text-white"
              />
            </div>

            <div>
              <label className="text-text-muted font-bold block mb-1">Avatar Photo URL</label>
              <input
                type="url"
                value={formData.avatar_url}
                onChange={e => setFormData({ ...formData, avatar_url: e.target.value })}
                placeholder="https://..."
                className="w-full bg-bg-dark border border-border-dark rounded-xl px-3 py-2 text-white"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-text-muted font-bold block mb-1">Primary Platform</label>
                <input
                  type="text"
                  value={formData.platform}
                  onChange={e => setFormData({ ...formData, platform: e.target.value })}
                  placeholder="e.g. YouTube / X"
                  className="w-full bg-bg-dark border border-border-dark rounded-xl px-3 py-2 text-white"
                />
              </div>

              <div>
                <label className="text-text-muted font-bold block mb-1">Social Handle</label>
                <input
                  type="text"
                  value={formData.handle}
                  onChange={e => setFormData({ ...formData, handle: e.target.value })}
                  placeholder="@handle"
                  className="w-full bg-bg-dark border border-border-dark rounded-xl px-3 py-2 text-white"
                />
              </div>
            </div>

            <div>
              <label className="text-text-muted font-bold block mb-1">Biography</label>
              <textarea
                rows={3}
                value={formData.bio}
                onChange={e => setFormData({ ...formData, bio: e.target.value })}
                placeholder="Brief bio..."
                className="w-full bg-bg-dark border border-border-dark rounded-xl px-3 py-2 text-white"
              />
            </div>

            <div className="flex items-center gap-2 pt-2">
              <input
                type="checkbox"
                id="is_verified"
                checked={formData.is_verified}
                onChange={e => setFormData({ ...formData, is_verified: e.target.checked })}
              />
              <label htmlFor="is_verified" className="text-white font-bold cursor-pointer">
                Verified Critic Badge
              </label>
            </div>

            <div className="flex items-center gap-2 pt-4">
              <button
                type="submit"
                className="flex-1 bg-accent-yellow text-bg-dark font-bold py-2.5 rounded-xl hover:bg-accent-yellow/90 transition-colors"
              >
                {editing ? 'Update Critic' : 'Create Critic'}
              </button>

              {editing && (
                <button
                  type="button"
                  onClick={handleReset}
                  className="bg-surface-light text-text-muted font-bold py-2.5 px-4 rounded-xl hover:text-white"
                >
                  Cancel
                </button>
              )}
            </div>
          </form>
        </div>

        {/* List Column */}
        <div className="lg:col-span-2 space-y-4">
          <h2 className="text-lg font-bold text-white mb-4">Critics Directory ({critics.length})</h2>

          {loading ? (
            <div className="py-12 text-center text-text-muted">Loading critics...</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {critics.map(critic => (
                <div key={critic.id} className="bg-surface-dark/80 border border-border-dark p-4 rounded-xl flex gap-4 items-center justify-between">
                  <div className="flex items-center gap-3">
                    <img
                      src={critic.avatar_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=200'}
                      alt={critic.name}
                      className="w-12 h-12 rounded-full object-cover border border-border-dark"
                    />
                    <div>
                      <h3 className="text-sm font-bold text-white">{critic.name}</h3>
                      <span className="text-[11px] text-accent-yellow font-semibold">{critic.publication || 'Critic'}</span>
                      <span className="text-[10px] text-text-muted block">{critic.review_count} Reviews</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleEdit(critic)}
                      className="p-2 rounded-lg bg-surface-light text-text-muted hover:text-accent-yellow transition-colors"
                      title="Edit Critic"
                    >
                      <Icon icon="solar:pen-bold" className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(critic)}
                      className="p-2 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors"
                      title="Delete Critic"
                    >
                      <Icon icon="solar:trash-bin-trash-bold" className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
