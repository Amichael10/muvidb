import React, { useState, useEffect } from 'react';
import { Link } from 'react-router';
import { supabase } from '../../lib/supabase';
import { Icon } from '@iconify/react';
import CriticReviewsEditor from '../admin/CriticReviewsEditor';

export default function CriticReviewsSection({ filmId, playId, user }) {
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdminModal, setShowAdminModal] = useState(false);

  const isAdmin =
    user?.app_metadata?.role === 'admin' ||
    user?.app_metadata?.role === 'superadmin' ||
    user?.user_metadata?.role === 'admin';

  useEffect(() => {
    if (filmId || playId) {
      fetchCriticReviews();
    }
  }, [filmId, playId]);

  const fetchCriticReviews = async () => {
    setLoading(true);
    try {
      let q = supabase
        .from('critic_reviews')
        .select('*, critic:critics(id, name, slug, avatar_url, publication, is_verified)');

      if (playId) {
        q = q.eq('play_id', playId);
      } else if (filmId) {
        q = q.eq('film_id', filmId);
      } else {
        setReviews([]);
        return;
      }

      const { data, error } = await q
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

  const [filter, setFilter] = useState('all');

  const filteredReviews = reviews.filter((rev) => {
    if (filter === 'featured') return rev.is_featured;
    if (filter === 'fresh') {
      const num = Number(rev.rating);
      return !isNaN(num) && num >= 6;
    }
    return true;
  });

  return (
    <section className="my-10">
      {/* Header with RT-Style Filters */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
            <Icon icon="solar:medal-ribbon-star-bold" className="text-2xl" />
          </div>
          <div>
            <h2 className="text-xl md:text-2xl font-black font-heading text-text-primary tracking-tight flex items-center gap-2">
              Critic Reviews & Press Quotes
            </h2>
            <p className="text-xs text-text-muted">
              Critical commentary and verified editorial reviews from Nollywood press
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Filter Pills */}
          <div className="inline-flex p-1 bg-surface border border-border rounded-xl text-xs font-bold">
            <button
              type="button"
              onClick={() => setFilter('all')}
              className={`px-3 py-1 rounded-lg transition-all ${filter === 'all' ? 'bg-brand text-white' : 'text-text-muted hover:text-text-primary'}`}
            >
              All ({reviews.length})
            </button>
            <button
              type="button"
              onClick={() => setFilter('fresh')}
              className={`px-3 py-1 rounded-lg transition-all ${filter === 'fresh' ? 'bg-brand text-white' : 'text-text-muted hover:text-text-primary'}`}
            >
              Fresh (★ 6+)
            </button>
            <button
              type="button"
              onClick={() => setFilter('featured')}
              className={`px-3 py-1 rounded-lg transition-all ${filter === 'featured' ? 'bg-brand text-white' : 'text-text-muted hover:text-text-primary'}`}
            >
              Picks
            </button>
          </div>

          {isAdmin && (
            <button
              type="button"
              onClick={() => setShowAdminModal(true)}
              className="px-3.5 py-1.5 bg-brand/10 hover:bg-brand text-brand hover:text-white border border-brand/20 font-bold text-xs rounded-xl transition-all flex items-center gap-1.5 shadow-sm cursor-pointer ml-2"
            >
              <Icon icon="solar:add-circle-bold" className="text-base" />
              Manage ({reviews.length})
            </button>
          )}
        </div>
      </div>

      {/* Reviews Cards */}
      {filteredReviews.length === 0 ? (
        <div className="bg-surface/50 border border-dashed border-border rounded-2xl p-8 text-center">
          <Icon icon="solar:quote-up-bold-duotone" className="text-4xl text-text-muted mx-auto mb-2 opacity-50" />
          <p className="text-sm font-semibold text-text-primary">No critic reviews match this filter</p>
          <button
            type="button"
            onClick={() => setFilter('all')}
            className="mt-2 text-xs font-bold text-brand hover:underline"
          >
            Show all reviews
          </button>
        </div>
      ) : (
        <div className={`grid grid-cols-1 ${filteredReviews.length > 1 ? 'md:grid-cols-2' : ''} gap-5`}>
          {filteredReviews.map((rev) => {
            const criticObj = rev.critic || {};
            const displayName = rev.is_anonymous
              ? 'Anonymous Critic'
              : (rev.critic_name || criticObj.name || 'Critic');
            
            const publication = rev.publication || criticObj.publication || 'Film Review';
            const avatar = rev.avatar_url || criticObj.avatar_url;
            const initials = displayName
              .split(' ')
              .map((n) => n[0])
              .join('')
              .toUpperCase()
              .slice(0, 2);

            const hasRating = rev.rating != null && rev.rating !== '' && !isNaN(Number(rev.rating));
            const ratingNum = hasRating ? Number(rev.rating) : null;
            const isFresh = ratingNum != null ? ratingNum >= 6 : true;
            const criticSlug = criticObj.slug;
            const isVerified = criticObj.is_verified || Boolean(rev.critic_id);

            return (
              <div
                key={rev.id}
                className="relative bg-surface/90 hover:bg-surface border border-border/80 hover:border-brand/40 rounded-2xl p-6 transition-all duration-300 shadow-sm hover:shadow-xl flex flex-col justify-between group overflow-hidden"
              >
                {/* Decorative Watermark */}
                <Icon
                  icon="solar:quote-up-bold"
                  className="absolute right-4 top-4 text-7xl text-white/[0.03] group-hover:text-brand/[0.06] transition-all pointer-events-none"
                />

                <div className="relative z-10 space-y-4">
                  {/* Top Header: Publication Pill + Fresh/Tomato Badge + Star Rating */}
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2">
                      {/* Fresh Tomato / Splat Icon */}
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider border ${
                          isFresh
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                            : 'bg-red-500/10 text-red-400 border-red-500/20'
                        }`}
                        title={isFresh ? 'Fresh Verdict' : 'Rotten Verdict'}
                      >
                        <Icon
                          icon={isFresh ? 'solar:medal-ribbon-star-bold' : 'solar:danger-triangle-bold'}
                          className="text-xs"
                        />
                        <span>{isFresh ? 'Fresh' : 'Rotten'}</span>
                      </span>

                      {/* Publication Pill */}
                      <span className="text-[11px] font-bold text-text-primary bg-surface-2 px-2.5 py-0.5 rounded-md border border-border truncate max-w-[160px]">
                        {publication}
                      </span>
                    </div>

                    {/* Numeric Score */}
                    {hasRating ? (
                      <div className="inline-flex items-center gap-1 text-amber-400 font-black text-xs">
                        <Icon icon="solar:star-bold" className="text-xs" />
                        <span>{ratingNum} / 10</span>
                      </div>
                    ) : (
                      rev.is_featured && (
                        <span className="text-[9px] font-black uppercase tracking-widest text-brand bg-brand/10 border border-brand/20 px-2 py-0.5 rounded">
                          Featured Pick
                        </span>
                      )
                    )}
                  </div>

                  {/* Punchy Pull-Quote */}
                  <blockquote className="text-text-primary text-[15px] sm:text-base font-serif italic leading-relaxed pt-1">
                    "{rev.quote}"
                  </blockquote>
                </div>

                {/* Author Info & Full Review External Link Footer */}
                <div className="relative z-10 flex items-center justify-between pt-5 mt-5 border-t border-border/60">
                  <div className="flex items-center gap-3">
                    {criticSlug ? (
                      <Link to={`/critics/${criticSlug}`} className="shrink-0">
                        {avatar ? (
                          <img
                            src={avatar}
                            alt={displayName}
                            className="w-10 h-10 rounded-full object-cover border-2 border-surface-2 group-hover:border-brand/50 transition-all shadow-sm"
                            loading="lazy"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-brand/10 border-2 border-brand/20 flex items-center justify-center text-brand font-black text-xs shadow-sm">
                            {initials}
                          </div>
                        )}
                      </Link>
                    ) : avatar ? (
                      <img
                        src={avatar}
                        alt={displayName}
                        className="w-10 h-10 rounded-full object-cover border-2 border-surface-2 shadow-sm"
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-brand/10 border-2 border-brand/20 flex items-center justify-center text-brand font-black text-xs shadow-sm">
                        {initials}
                      </div>
                    )}

                    <div>
                      <h4 className="text-xs sm:text-sm font-bold text-text-primary tracking-tight flex items-center gap-1.5">
                        {criticSlug ? (
                          <Link to={`/critics/${criticSlug}`} className="hover:text-brand transition-colors">
                            {displayName}
                          </Link>
                        ) : (
                          displayName
                        )}
                        {isVerified && !rev.is_anonymous && (
                          <Icon icon="solar:verified-check-bold" className="text-brand text-xs" title="Verified Critic" />
                        )}
                      </h4>
                      <p className="text-[11px] text-text-muted font-medium">
                        {rev.critic_title || publication}
                      </p>
                    </div>
                  </div>

                  {rev.review_url && (
                    <a
                      href={rev.review_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs font-bold text-brand hover:text-brand-hover hover:underline transition-colors shrink-0 bg-brand/5 hover:bg-brand/10 px-3 py-1.5 rounded-lg border border-brand/20"
                    >
                      <span>Full Review</span>
                      <Icon icon="solar:arrow-right-up-linear" className="text-xs" />
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
              playId={playId}
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
