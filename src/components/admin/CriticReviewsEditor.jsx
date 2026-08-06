import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { toast } from 'react-hot-toast';
import { Icon } from '@iconify/react';

export default function CriticReviewsEditor({ filmId, onUpdated }) {
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [editingReview, setEditingReview] = useState(null);

  const initialFormState = {
    id: null,
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

  useEffect(() => {
    if (filmId) {
      fetchReviews();
    }
  }, [filmId]);

  const fetchReviews = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('critic_reviews')
        .select('*')
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

  const handleEdit = (rev) => {
    setEditingReview(rev);
    setFormData({
      id: rev.id,
      critic_name: rev.critic_name || '',
      critic_title: rev.critic_title || '',
      avatar_url: rev.avatar_url || '',
      quote: rev.quote || '',
      rating: rev.rating != null ? String(rev.rating) : '',
      review_url: rev.review_url || '',
      is_anonymous: Boolean(rev.is_anonymous),
      is_featured: rev.is_featured !== false,
    });
  };

  const handleResetForm = () => {
    setEditingReview(null);
    setFormData(initialFormState);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    e.stopPropagation();

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
            Add featured quotes from critics (e.g. Tolu Fagboro, Oris Aigbokhaevbolo) or publications. Ratings are optional.
          </p>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="bg-surface-2 p-4 rounded-xl border border-border space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-brand">
            {editingReview ? 'Edit Critic Review' : 'Add New Critic Review'}
          </span>
          {editingReview && (
            <button
              type="button"
              onClick={handleResetForm}
              className="text-xs text-text-muted hover:text-text-primary underline"
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
          {/* Critic Name */}
          {!formData.is_anonymous && (
            <div>
              <label className="block text-xs font-medium text-text-muted mb-1">
                Critic Name *
              </label>
              <input
                type="text"
                value={formData.critic_name}
                onChange={(e) => setFormData({ ...formData, critic_name: e.target.value })}
                placeholder="e.g. Tolu Fagboro"
                className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-xs text-text-primary focus:border-brand focus:outline-none"
              />
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
              Star Rating / Score (Optional — Leave blank if no rating given)
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
              placeholder="https://substack.com/..."
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

        {/* Submit */}
        <div className="flex justify-end gap-2 pt-2">
          <button
            type="submit"
            disabled={isSaving}
            className="px-4 py-2 bg-brand text-white font-bold text-xs rounded-lg hover:opacity-90 transition-all flex items-center gap-1.5 shadow-sm disabled:opacity-50"
          >
            <Icon icon="solar:check-circle-bold" className="text-sm" />
            {isSaving ? 'Saving...' : editingReview ? 'Update Quote' : 'Save Critic Quote'}
          </button>
        </div>
      </form>

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
            {reviews.map((rev) => (
              <div
                key={rev.id}
                className="bg-surface border border-border rounded-xl p-4 flex items-start justify-between gap-4"
              >
                <div className="flex items-start gap-3">
                  {rev.avatar_url ? (
                    <img
                      src={rev.avatar_url}
                      alt=""
                      className="w-10 h-10 rounded-full object-cover border border-border"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-brand/10 border border-brand/20 flex items-center justify-center text-brand font-black text-xs">
                      {rev.is_anonymous
                        ? '?'
                        : (rev.critic_name || 'C')
                            .split(' ')
                            .map((n) => n[0])
                            .join('')
                            .toUpperCase()
                            .slice(0, 2)}
                    </div>
                  )}

                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-sm text-text-primary">
                        {rev.is_anonymous ? 'Anonymous Critic' : rev.critic_name}
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
                    className="p-1.5 text-text-muted hover:text-brand transition-colors rounded-lg hover:bg-surface-2"
                    title="Edit"
                  >
                    <Icon icon="solar:pen-bold" className="text-base" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(rev.id)}
                    className="p-1.5 text-text-muted hover:text-red-500 transition-colors rounded-lg hover:bg-surface-2"
                    title="Delete"
                  >
                    <Icon icon="solar:trash-bin-trash-bold" className="text-base" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
