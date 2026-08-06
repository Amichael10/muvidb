import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Icon } from '@iconify/react';
import CriticReviewsEditor from '../admin/CriticReviewsEditor';

export default function CriticReviewsSection({ filmId, user }) {
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdminModal, setShowAdminModal] = useState(false);

  const isAdmin =
    user?.app_metadata?.role === 'admin' ||
    user?.app_metadata?.role === 'superadmin' ||
    user?.user_metadata?.role === 'admin';

  useEffect(() => {
    if (filmId) {
      fetchCriticReviews();
    }
  }, [filmId]);

  const fetchCriticReviews = async () => {
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
      console.error('Error loading critic reviews:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return null;
  }

  // If no critic reviews yet, show nothing for normal users, but show "+ Add Critic Review" prompt for admins
  if (reviews.length === 0 && !isAdmin) {
    return null;
  }

  return (
    <section className="my-12">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500">
            <Icon icon="solar:medal-ribbon-star-bold" className="text-2xl" />
          </div>
          <div>
            <h2 className="text-xl md:text-2xl font-black text-text-primary tracking-tight flex items-center gap-2">
              Critic Reviews & Quotes
            </h2>
            <p className="text-xs text-text-muted">
              Praise & commentary from film critics and publications
            </p>
          </div>
        </div>

        {isAdmin && (
          <button
            type="button"
            onClick={() => setShowAdminModal(true)}
            className="px-3.5 py-2 bg-brand/10 hover:bg-brand text-brand hover:text-white border border-brand/20 font-bold text-xs rounded-xl transition-all flex items-center gap-1.5 shadow-sm cursor-pointer"
          >
            <Icon icon="solar:add-circle-bold" className="text-base" />
            Manage Critic Quotes ({reviews.length})
          </button>
        )}
      </div>

      {/* Reviews Cards */}
      {reviews.length === 0 ? (
        <div className="bg-surface/50 border border-dashed border-border rounded-2xl p-8 text-center">
          <Icon icon="solar:quote-up-bold-duotone" className="text-4xl text-text-muted mx-auto mb-2 opacity-50" />
          <p className="text-sm font-semibold text-text-primary">No critic reviews added yet</p>
          <p className="text-xs text-text-muted mt-1">As an admin, click "Manage Critic Quotes" above to add quotes from critics like Tolu Fagboro.</p>
        </div>
      ) : (
        <div className={`grid grid-cols-1 ${reviews.length > 1 ? 'md:grid-cols-2' : ''} gap-6`}>
          {reviews.map((rev) => {
            const displayName = rev.is_anonymous ? 'Anonymous Critic' : (rev.critic_name || 'Critic');
            const initials = displayName
              .split(' ')
              .map((n) => n[0])
              .join('')
              .toUpperCase()
              .slice(0, 2);

            const hasRating = rev.rating != null && rev.rating !== '' && !isNaN(Number(rev.rating));

            return (
              <div
                key={rev.id}
                className="relative bg-surface border border-border/80 hover:border-brand/30 rounded-2xl p-6 transition-all duration-300 shadow-sm hover:shadow-md flex flex-col justify-between group overflow-hidden"
              >
                {/* Decorative Quote Icon Background */}
                <Icon
                  icon="solar:quote-up-bold"
                  className="absolute right-4 top-4 text-6xl text-brand/5 group-hover:text-brand/10 transition-all pointer-events-none"
                />

                <div className="relative z-10 space-y-4">
                  {/* Rating or Badge Header */}
                  <div className="flex items-center justify-between">
                    {hasRating ? (
                      <div className="inline-flex items-center gap-1.5 bg-amber-500/10 border border-amber-500/20 text-amber-500 px-3 py-1 rounded-full text-xs font-black">
                        <Icon icon="solar:star-bold" className="text-sm" />
                        <span>{rev.rating} / 10</span>
                      </div>
                    ) : (
                      <div className="inline-flex items-center gap-1 bg-brand/10 border border-brand/20 text-brand px-3 py-1 rounded-full text-[11px] font-bold">
                        <Icon icon="solar:chat-quote-bold" className="text-xs" />
                        <span>Critic Quote</span>
                      </div>
                    )}

                    {rev.is_featured && (
                      <span className="text-[10px] font-bold text-text-muted bg-surface-2 px-2.5 py-0.5 rounded-full border border-border">
                        EXPERT PICK
                      </span>
                    )}
                  </div>

                  {/* Quote Body */}
                  <blockquote className="text-text-primary text-base font-serif italic leading-relaxed">
                    "{rev.quote}"
                  </blockquote>
                </div>

                {/* Author Info & External Link Footer */}
                <div className="relative z-10 flex items-center justify-between pt-6 mt-4 border-t border-border/60">
                  <div className="flex items-center gap-3">
                    {rev.avatar_url ? (
                      <img
                        src={rev.avatar_url}
                        alt={displayName}
                        className="w-11 h-11 rounded-full object-cover border-2 border-surface-2 group-hover:border-brand/30 transition-all shadow-sm"
                      />
                    ) : (
                      <div className="w-11 h-11 rounded-full bg-brand/10 border-2 border-brand/20 flex items-center justify-center text-brand font-black text-xs shadow-sm">
                        {initials}
                      </div>
                    )}

                    <div>
                      <h4 className="text-sm font-bold text-text-primary tracking-tight flex items-center gap-1.5">
                        {displayName}
                      </h4>
                      {rev.critic_title && (
                        <p className="text-xs text-text-muted font-medium">
                          {rev.critic_title}
                        </p>
                      )}
                    </div>
                  </div>

                  {rev.review_url && (
                    <a
                      href={rev.review_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs font-bold text-brand hover:text-brand-hover hover:underline transition-colors shrink-0"
                    >
                      <span>Full Review</span>
                      <Icon icon="solar:export-bold" className="text-xs" />
                    </a>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Admin Management Modal */}
      {showAdminModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
          <div className="bg-surface border border-border rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 shadow-2xl space-y-4 relative">
            <button
              type="button"
              onClick={() => setShowAdminModal(false)}
              className="absolute top-4 right-4 p-2 text-text-muted hover:text-text-primary rounded-xl hover:bg-surface-2 transition-colors cursor-pointer"
            >
              <Icon icon="solar:close-circle-bold" className="text-xl" />
            </button>

            <CriticReviewsEditor
              filmId={filmId}
              onUpdated={() => {
                fetchCriticReviews();
              }}
            />
          </div>
        </div>
      )}
    </section>
  );
}
