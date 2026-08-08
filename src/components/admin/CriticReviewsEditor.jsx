import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { toast } from 'react-hot-toast';
import { Icon } from '@iconify/react';
import { upsertCritic } from '../../lib/critics';

export default function CriticReviewsEditor({ filmId, onUpdated }) {
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [editingReview, setEditingReview] = useState(null);

  const initialFormState = {
    id: null,
    critic_id: null,
    critic_name: '',
    critic_title: '',
    avatar_url: '',
    quote: '',
    rating: '', // Default empty (Optional rating)
    review_url: '',
    is_anonymous: false,
    is_featured: true,
  };

  const [formData, setFormData] = useState(initialFormState);

  // -- Critic Directory Search ------------------------------------------------
  const [criticSearch, setCriticSearch] = useState('');
  const [criticResults, setCriticResults] = useState([]);
  const [isSearchingCritics, setIsSearchingCritics] = useState(false);
  const [showCriticDropdown, setShowCriticDropdown] = useState(false);
  const [selectedCritic, setSelectedCritic] = useState(null);
  const searchTimeout = useRef(null);
  const dropdownRef = useRef(null);

  useEffect(() => {
    if (filmId) {
      fetchReviews();
    }
  }, [filmId]);

  // Close search dropdown on outside click
  useEffect(() => {
    function onClickOutside(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setShowCriticDropdown(false);
      }
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  const fetchReviews = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('critic_reviews')
        .select('*, critic:critics(id, name, avatar_url, publication, is_verified)')
        .eq('film_id', filmId)
        .order('is_featured', { ascending: false })
        .order('created_at', { ascending: false });

      if (error) throw error;
      setReviews(data || []);
    } catch (err) {
      console.error('Error fetching critic reviews:', err);
    } finally {
      setLoading(false);
    }
  };

  // ---- Critic Search Handler -----------------------------------------------
  const handleCriticSearch = (query) => {
    setCriticSearch(query);
    setShowCriticDropdown(true);
    setFormData(prev => ({ ...prev, critic_name: query }));
    if (query.trim().length < 2) {
      setCriticResults([]);
      return;
    }

    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(async () => {
      setIsSearchingCritics(true);
      try {
        const { data } = await supabase
          .from('critics')
          .select('id, name, publication, title, avatar_url, is_verified')
          .ilike('name', `%${query}%`)
          .limit(6);
        setCriticResults(data || []);
      } catch (err) {
        console.error(err);
      } finally {
        setIsSearchingCritics(false);
      }
    }, 300);
  };

  const selectCritic = (critic) => {
    setSelectedCritic(critic);
    setCriticSearch(critic.name);
    setShowCriticDropdown(false);
    setCriticResults([]);

    const titleText = critic.publication
      ? `${critic.title || 'Film Critic'} · ${critic.publication}`
      : critic.title || 'Film Critic';

    setFormData(prev => ({
      ...prev,
      critic_id: critic.id,
      critic_name: critic.name,
      critic_title: prev.critic_title || titleText,
      avatar_url: prev.avatar_url || critic.avatar_url || '',
    }));
  };

  const createAndLinkCritic = async (name) => {
    if (!name.trim()) return;
    try {
      const newCritic = await upsertCritic({
        name: name.trim(),
        title: 'Film Critic',
        is_verified: true,
      });
      selectCritic(newCritic);
      toast.success(`Created & linked critic profile for "${name}"`);
    } catch (err) {
      console.error('Error creating critic:', err);
      toast.error('Failed to create critic profile');
    }
  };

  const clearSelectedCritic = () => {
    setSelectedCritic(null);
    setCriticSearch('');
    setFormData(prev => ({
      ...prev,
      critic_id: null,
      critic_name: '',
    }));
  };

  const handleEdit = (rev) => {
    setEditingReview(rev);
    const cName = rev.critic_name || rev.critic?.name || '';
    setCriticSearch(cName);
    setSelectedCritic(rev.critic || null);

    setFormData({
      id: rev.id,
      critic_id: rev.critic_id || rev.critic?.id || null,
      critic_name: cName,
      critic_title: rev.critic_title || '',
      avatar_url: rev.avatar_url || rev.critic?.avatar_url || '',
      quote: rev.quote || '',
      rating: rev.rating != null ? String(rev.rating) : '',
      review_url: rev.review_url || '',
      is_anonymous: Boolean(rev.is_anonymous),
      is_featured: rev.is_featured !== false,
    });
  };

  const handleResetForm = () => {
    setEditingReview(null);
    setSelectedCritic(null);
    setCriticSearch('');
    setCriticResults([]);
    setShowCriticDropdown(false);
    setFormData(initialFormState);
  };

  const handleSubmit = async (e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }

    if (!filmId) {
      toast.error('Film ID is missing. Please save the film first.');
      return;
    }

    if (!formData.quote.trim()) {
      toast.error('Review quote text is required');
      return;
    }

    if (!formData.is_anonymous && !formData.critic_name.trim()) {
      toast.error('Critic name is required (or check Anonymous)');
      return;
    }

    setIsSaving(true);
    try {
      const parsedRating =
        formData.rating !== '' && formData.rating !== null && !isNaN(Number(formData.rating))
          ? parseFloat(formData.rating)
          : null;

      const payload = {
        film_id: filmId,
        critic_id: formData.is_anonymous ? null : formData.critic_id,
        critic_name: formData.is_anonymous ? null : formData.critic_name.trim(),
        critic_title: formData.critic_title.trim() || null,
        avatar_url: formData.avatar_url.trim() || null,
        quote: formData.quote.trim(),
        rating: parsedRating,
        review_url: formData.review_url.trim() || null,
        is_anonymous: formData.is_anonymous,
        is_featured: formData.is_featured,
        updated_at: new Date().toISOString(),
      };

      if (formData.id) {
        const { error } = await supabase
          .from('critic_reviews')
          .update(payload)
          .eq('id', formData.id);
        if (error) throw error;
        toast.success('Critic review updated');
      } else {
        const { error } = await supabase
          .from('critic_reviews')
          .insert([payload]);
        if (error) throw error;
        toast.success('Critic review added');
      }

      handleResetForm();
      await fetchReviews();
      if (onUpdated) onUpdated();
    } catch (err) {
      console.error('Error saving critic review:', err);
      toast.error(err.message || 'Failed to save critic review');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this critic review?')) return;
    try {
      const { error } = await supabase
        .from('critic_reviews')
        .delete()
        .eq('id', id);
      if (error) throw error;
      toast.success('Critic review deleted');
      fetchReviews();
      if (onUpdated) onUpdated();
    } catch (err) {
      console.error('Error deleting critic review:', err);
      toast.error('Failed to delete critic review');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between border-b border-border pb-4">
        <div>
          <h3 className="text-lg font-bold text-text-primary flex items-center gap-2">
            <Icon icon="solar:medal-ribbon-bold" className="text-brand text-xl" />
            Expert Critic Reviews & Pull-Quotes
          </h3>
          <p className="text-xs text-text-muted">
            Search & link verified film critics (or add new critic profiles) to attach pull-quotes and ratings to this film.
          </p>
        </div>
      </div>

      {/* Form Container */}
      <div className="bg-surface-2 p-4 rounded-xl border border-border space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-brand">
            {editingReview ? 'Edit Critic Review' : 'Add New Critic Review'}
          </span>
          {editingReview && (
            <button
              type="button"
              onClick={handleResetForm}
              className="text-xs text-text-muted hover:text-text-primary underline cursor-pointer"
            >
              Cancel Edit
            </button>
          )}
        </div>

        {/* Anonymous Checkbox */}
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="is_anonymous"
            checked={formData.is_anonymous}
            onChange={(e) => setFormData({ ...formData, is_anonymous: e.target.checked })}
            className="w-4 h-4 rounded border-border text-brand focus:ring-brand"
          />
          <label htmlFor="is_anonymous" className="text-xs font-semibold text-text-primary cursor-pointer select-none">
            Post as Anonymous / Unattributed Critic
          </label>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Critic Search Dropdown */}
          {!formData.is_anonymous && (
            <div className="relative" ref={dropdownRef}>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-medium text-text-muted">
                  Search Critic Directory *
                </label>
                {selectedCritic && (
                  <button
                    type="button"
                    onClick={clearSelectedCritic}
                    className="text-[10px] text-brand hover:underline font-bold"
                  >
                    Unlink
                  </button>
                )}
              </div>

              <div className="relative">
                <input
                  type="text"
                  value={criticSearch}
                  onChange={(e) => handleCriticSearch(e.target.value)}
                  onFocus={() => criticSearch.length >= 2 && setShowCriticDropdown(true)}
                  placeholder="Search critic by name (e.g. Tolu Fagbure)..."
                  className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-xs text-text-primary focus:border-brand focus:outline-none pr-8"
                />
                {isSearchingCritics ? (
                  <div className="absolute right-2.5 top-2.5 w-3.5 h-3.5 border-2 border-brand border-t-transparent rounded-full animate-spin" />
                ) : selectedCritic ? (
                  <Icon icon="solar:check-circle-bold" className="absolute right-2.5 top-2.5 text-green-500 text-sm" />
                ) : null}
              </div>

              {/* Search Results Dropdown */}
              {showCriticDropdown && criticSearch.trim().length >= 2 && (
                <div className="absolute left-0 right-0 top-full mt-1 bg-surface border border-border rounded-xl shadow-2xl z-30 overflow-hidden">
                  {isSearchingCritics ? (
                    <div className="p-4 text-center text-xs text-text-muted">Searching critics directory...</div>
                  ) : (
                    <>
                      {criticResults.map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => selectCritic(c)}
                          className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-surface-2 transition-colors text-left border-b border-border/50 last:border-0"
                        >
                          <div className="w-8 h-8 rounded-full bg-surface-2 overflow-hidden border border-border flex-shrink-0">
                            {c.avatar_url ? (
                              <img src={c.avatar_url} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-[10px] font-bold text-brand">
                                {c.name.charAt(0)}
                              </div>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-bold text-text-primary truncate flex items-center gap-1">
                              {c.name}
                              {c.is_verified && <Icon icon="solar:verified-check-bold" className="text-brand text-xs shrink-0" />}
                            </p>
                            <p className="text-[10px] text-text-muted truncate">{c.publication || c.title || 'Verified Critic'}</p>
                          </div>
                        </button>
                      ))}

                      {criticSearch.trim() && !criticResults.some((c) => c.name.toLowerCase() === criticSearch.trim().toLowerCase()) && (
                        <button
                          type="button"
                          onClick={() => createAndLinkCritic(criticSearch.trim())}
                          className="w-full flex items-center gap-3 px-3 py-2.5 bg-brand/5 hover:bg-brand/10 transition-colors text-left group"
                        >
                          <div className="w-7 h-7 rounded-full bg-brand text-white flex items-center justify-center group-hover:scale-110 transition-transform shadow-md shrink-0">
                            <Icon icon="solar:plus-bold" className="text-xs" />
                          </div>
                          <div>
                            <p className="text-[9px] font-black text-brand uppercase tracking-widest leading-none mb-0.5">New Critic Profile</p>
                            <p className="text-xs font-bold text-text-primary">Create profile for "{criticSearch.trim()}"</p>
                          </div>
                        </button>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Critic Title / Publication */}
          <div className={formData.is_anonymous ? 'md:col-span-2' : ''}>
            <label className="block text-xs font-medium text-text-muted mb-1">
              Title / Publication (Optional)
            </label>
            <input
              type="text"
              value={formData.critic_title}
              onChange={(e) => setFormData({ ...formData, critic_title: e.target.value })}
              placeholder="e.g. Film Critic · In Nollywood"
              className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-xs text-text-primary focus:border-brand focus:outline-none"
            />
          </div>

          {/* Avatar URL */}
          <div>
            <label className="block text-xs font-medium text-text-muted mb-1">
              Avatar Image URL (Optional)
            </label>
            <input
              type="url"
              value={formData.avatar_url}
              onChange={(e) => setFormData({ ...formData, avatar_url: e.target.value })}
              placeholder="https://example.com/avatar.jpg"
              className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-xs text-text-primary focus:border-brand focus:outline-none"
            />
          </div>

          {/* Rating (Optional) */}
          <div>
            <label className="block text-xs font-medium text-text-muted mb-1">
              Star Rating / Score (Optional — Leave blank if unrated)
            </label>
            <input
              type="number"
              step="0.1"
              min="0"
              max="10"
              value={formData.rating}
              onChange={(e) => setFormData({ ...formData, rating: e.target.value })}
              placeholder="Leave blank for unrated quote"
              className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-xs text-text-primary focus:border-brand focus:outline-none"
            />
          </div>
        </div>

        {/* Quote Text */}
        <div>
          <label className="block text-xs font-medium text-text-muted mb-1">
            Review Quote / Snippet *
          </label>
          <textarea
            rows={3}
            value={formData.quote}
            onChange={(e) => setFormData({ ...formData, quote: e.target.value })}
            placeholder="e.g. A masterclass in Nollywood suspense. Magnificent performances and tight direction throughout."
            className="w-full bg-surface border border-border rounded-lg p-3 text-xs text-text-primary focus:border-brand focus:outline-none"
          />
        </div>

        {/* Review Link & Featured Toggle */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
          <div className="md:col-span-2">
            <label className="block text-xs font-medium text-text-muted mb-1">
              Full Review Link (Optional)
            </label>
            <input
              type="url"
              value={formData.review_url}
              onChange={(e) => setFormData({ ...formData, review_url: e.target.value })}
              placeholder="https://..."
              className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-xs text-text-primary focus:border-brand focus:outline-none"
            />
          </div>

          <div className="flex items-center gap-2 pt-4">
            <input
              type="checkbox"
              id="is_featured"
              checked={formData.is_featured}
              onChange={(e) => setFormData({ ...formData, is_featured: e.target.checked })}
              className="w-4 h-4 rounded border-border text-brand focus:ring-brand"
            />
            <label htmlFor="is_featured" className="text-xs font-semibold text-text-primary cursor-pointer select-none">
              Featured Pull-Quote
            </label>
          </div>
        </div>

        {/* Submit Button */}
        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSaving}
            className="px-4 py-2 bg-brand text-white font-bold text-xs rounded-lg hover:opacity-90 transition-all flex items-center gap-1.5 shadow-sm disabled:opacity-50 cursor-pointer"
          >
            <Icon icon="solar:check-circle-bold" className="text-sm" />
            {isSaving ? 'Saving...' : editingReview ? 'Update Quote' : 'Save Critic Quote'}
          </button>
        </div>
      </div>

      {/* List of Existing Critic Reviews */}
      <div className="space-y-3">
        <h4 className="text-xs font-bold uppercase tracking-wider text-text-muted">
          Existing Critic Quotes ({reviews.length})
        </h4>

        {loading ? (
          <div className="text-xs text-text-muted py-4 text-center">Loading quotes...</div>
        ) : reviews.length === 0 ? (
          <div className="text-xs text-text-muted py-6 text-center bg-surface border border-dashed border-border rounded-xl">
            No critic quotes added yet. Add one above!
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3">
            {reviews.map((rev) => {
              const criticInfo = rev.critic || {};
              const avatar = rev.avatar_url || criticInfo.avatar_url;
              const name = rev.is_anonymous ? 'Anonymous Critic' : (rev.critic_name || criticInfo.name);

              return (
                <div
                  key={rev.id}
                  className="bg-surface border border-border rounded-xl p-4 flex items-start justify-between gap-4"
                >
                  <div className="flex items-start gap-3">
                    {avatar ? (
                      <img
                        src={avatar}
                        alt=""
                        className="w-10 h-10 rounded-full object-cover border border-border"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-brand/10 border border-brand/20 flex items-center justify-center text-brand font-black text-xs">
                        {rev.is_anonymous
                          ? '?'
                          : (name || 'C')
                              .split(' ')
                              .map((n) => n[0])
                              .join('')
                              .toUpperCase()
                              .slice(0, 2)}
                      </div>
                    )}

                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-sm text-text-primary flex items-center gap-1">
                          {name}
                          {(rev.critic_id || criticInfo.is_verified) && (
                            <Icon icon="solar:verified-check-bold" className="text-brand text-xs" title="Linked Verified Critic" />
                          )}
                        </span>
                        {rev.critic_title && (
                          <span className="text-xs text-text-muted">
                            · {rev.critic_title}
                          </span>
                        )}
                        {rev.rating != null && String(rev.rating) !== '' && (
                          <span className="text-xs font-bold text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded-full flex items-center gap-1">
                            <Icon icon="solar:star-bold" className="text-xs" />
                            {rev.rating} / 10
                          </span>
                        )}
                        {rev.is_featured && (
                          <span className="text-[10px] font-bold text-brand bg-brand/10 px-2 py-0.5 rounded-full uppercase">
                            Featured
                          </span>
                        )}
                      </div>

                      <p className="text-xs text-text-secondary italic mt-1 font-serif">
                        "{rev.quote}"
                      </p>

                      {rev.review_url && (
                        <a
                          href={rev.review_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-[11px] text-brand hover:underline mt-1 font-medium"
                        >
                          Read Full Review
                          <Icon icon="solar:export-bold" className="text-[10px]" />
                        </a>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleEdit(rev)}
                      className="p-1.5 text-text-muted hover:text-brand transition-colors rounded-lg hover:bg-surface-2 cursor-pointer"
                      title="Edit"
                    >
                      <Icon icon="solar:pen-bold" className="text-base" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(rev.id)}
                      className="p-1.5 text-text-muted hover:text-red-500 transition-colors rounded-lg hover:bg-surface-2 cursor-pointer"
                      title="Delete"
                    >
                      <Icon icon="solar:trash-bin-trash-bold" className="text-base" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
