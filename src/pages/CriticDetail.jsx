import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router';
import { Icon } from '@iconify/react';
import { fetchCriticBySlug } from '../lib/critics';
import SEO from '../components/SEO';

export default function CriticDetail() {
  const { slug } = useParams();
  const [critic, setCritic] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      if (!slug) return;
      setLoading(true);
      const data = await fetchCriticBySlug(slug);
      setCritic(data);
      setLoading(false);
    }
    load();
  }, [slug]);

  if (loading) {
    return (
      <div className="min-h-screen bg-bg-dark flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-accent-yellow border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!critic) {
    return (
      <div className="min-h-screen bg-bg-dark text-text-primary flex flex-col items-center justify-center p-6 text-center">
        <Icon icon="solar:user-block-line-duotone" className="w-20 h-20 text-text-muted opacity-40 mb-4" />
        <h1 className="text-2xl font-bold text-white mb-2">Critic Not Found</h1>
        <p className="text-text-muted text-sm mb-6 max-w-md">We couldn't find a film critic profile matching this page.</p>
        <Link to="/critics" className="px-6 py-2.5 rounded-xl bg-accent-yellow text-bg-dark font-bold hover:bg-accent-yellow/90 transition-colors text-sm">
          Return to Critics Directory
        </Link>
      </div>
    );
  }

  const reviews = critic.reviews || [];
  const ratedReviews = reviews.filter(r => r.rating !== null && r.rating !== undefined);
  const avgRating = ratedReviews.length > 0
    ? (ratedReviews.reduce((sum, r) => sum + Number(r.rating), 0) / ratedReviews.length).toFixed(1)
    : 'N/A';

  return (
    <div className="min-h-screen bg-bg-dark text-text-primary pb-20">
      <SEO 
        title={`${critic.name} - Film Critic Profile | MuviDB`}
        description={critic.bio || `Read film reviews, star ratings, and critical essays by ${critic.name} on MuviDB.`}
      />

      {/* Header Profile Section */}
      <section className="relative border-b border-border-dark bg-gradient-to-b from-bg-darker via-surface-dark/40 to-bg-dark py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto">
          <Link to="/critics" className="inline-flex items-center gap-1.5 text-xs text-text-muted hover:text-accent-yellow transition-colors mb-6 font-semibold">
            <Icon icon="solar:alt-arrow-left-linear" className="w-4 h-4" />
            Back to All Critics
          </Link>

          <div className="flex flex-col md:flex-row items-center md:items-start gap-8">
            {/* Avatar */}
            <div className="relative flex-shrink-0">
              <img
                src={critic.avatar_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=300'}
                alt={critic.name}
                className="w-32 h-32 md:w-40 md:h-40 rounded-full object-cover border-4 border-border-dark shadow-2xl shadow-black/80"
              />
              {critic.is_verified && (
                <div className="absolute bottom-1 right-1 bg-accent-yellow text-bg-dark rounded-full p-2 shadow-lg" title="Verified Critic">
                  <Icon icon="solar:verified-check-bold" className="w-5 h-5" />
                </div>
              )}
            </div>

            {/* Info */}
            <div className="flex-1 text-center md:text-left">
              <div className="flex flex-wrap items-center justify-center md:justify-start gap-3 mb-2">
                <h1 className="text-3xl sm:text-4xl font-extrabold text-white">{critic.name}</h1>
                {critic.publication && (
                  <span className="px-3 py-1 rounded-full bg-accent-yellow/15 border border-accent-yellow/30 text-accent-yellow text-xs font-bold">
                    {critic.publication}
                  </span>
                )}
              </div>

              <p className="text-sm font-semibold text-text-muted mb-4">{critic.title || 'Film Critic'}</p>
              
              <p className="text-sm text-text-muted leading-relaxed max-w-3xl mb-6">
                {critic.bio || 'Film critic and culture journalist contributing to African cinema reviews and analytical essays.'}
              </p>

              {/* Handles & Social */}
              <div className="flex flex-wrap items-center justify-center md:justify-start gap-4 text-xs font-semibold">
                {critic.handle && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-dark border border-border-dark text-accent-yellow">
                    <Icon icon="solar:user-bold" className="w-4 h-4" />
                    {critic.handle}
                  </span>
                )}
                {critic.platform && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-dark border border-border-dark text-text-muted">
                    <Icon icon="solar:global-bold" className="w-4 h-4 text-accent-yellow" />
                    {critic.platform}
                  </span>
                )}
                {critic.profile_url && (
                  <a
                    href={critic.profile_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-accent-yellow/10 border border-accent-yellow/40 text-accent-yellow hover:bg-accent-yellow hover:text-bg-dark transition-colors"
                  >
                    <Icon icon="solar:link-circle-bold" className="w-4 h-4" />
                    Official Outlet
                  </a>
                )}
              </div>
            </div>
          </div>

          {/* Stats Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mt-10 pt-8 border-t border-border-dark/60">
            <div className="bg-surface-dark/80 border border-border-dark rounded-xl p-4 text-center">
              <span className="text-xs text-text-muted uppercase font-semibold tracking-wider">Total Reviews</span>
              <p className="text-2xl font-extrabold text-white mt-1">{reviews.length}</p>
            </div>
            <div className="bg-surface-dark/80 border border-border-dark rounded-xl p-4 text-center">
              <span className="text-xs text-text-muted uppercase font-semibold tracking-wider">Average Rating</span>
              <p className="text-2xl font-extrabold text-accent-yellow mt-1">{avgRating} {avgRating !== 'N/A' && '/ 5'}</p>
            </div>
            <div className="col-span-2 sm:col-span-1 bg-surface-dark/80 border border-border-dark rounded-xl p-4 text-center">
              <span className="text-xs text-text-muted uppercase font-semibold tracking-wider">Status</span>
              <p className="text-2xl font-extrabold text-green-400 mt-1 flex items-center justify-center gap-1.5">
                <Icon icon="solar:check-circle-bold" className="w-5 h-5" />
                Verified
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Reviews Filmography Section */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-12">
        <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
          <Icon icon="solar:videocamera-record-bold" className="text-accent-yellow w-6 h-6" />
          Film Reviews by {critic.name} ({reviews.length})
        </h2>

        {reviews.length === 0 ? (
          <div className="bg-surface-dark border border-border-dark rounded-2xl p-12 text-center">
            <Icon icon="solar:document-text-line-duotone" className="w-16 h-16 text-text-muted mx-auto mb-3 opacity-40" />
            <p className="text-lg font-bold text-white mb-1">No reviews linked yet</p>
            <p className="text-xs text-text-muted">Reviews from this critic will appear here as they are added.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {reviews.map((rev) => {
              const film = rev.film || {};
              return (
                <div key={rev.id} className="bg-surface-dark/80 border border-border-dark rounded-2xl p-6 flex flex-col justify-between hover:border-accent-yellow/40 transition-colors">
                  <div>
                    {/* Film Title Header */}
                    <div className="flex items-start gap-4 mb-4">
                      {film.poster_url && (
                        <img
                          src={film.poster_url}
                          alt={film.title}
                          className="w-14 h-20 rounded-lg object-cover border border-border-dark flex-shrink-0"
                        />
                      )}
                      <div>
                        <h3 className="text-lg font-bold text-white hover:text-accent-yellow transition-colors">
                          {film.slug ? (
                            <Link to={`/film/${film.slug}`}>{film.title || 'Untitled Film'}</Link>
                          ) : (
                            film.title || 'Untitled Film'
                          )}
                        </h3>
                        {film.year && <span className="text-xs text-text-muted font-semibold">{film.year}</span>}

                        {rev.rating !== null && rev.rating !== undefined && (
                          <div className="flex items-center gap-1 text-accent-yellow mt-1 text-xs font-bold">
                            <Icon icon="solar:star-bold" className="w-4 h-4" />
                            <span>{rev.rating} / 5</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Quote */}
                    <blockquote className="text-sm text-text-primary italic bg-surface-light/30 border-l-4 border-accent-yellow p-3.5 rounded-r-xl leading-relaxed mb-4">
                      "{rev.quote}"
                    </blockquote>
                  </div>

                  {rev.review_url && (
                    <a
                      href={rev.review_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs font-semibold text-accent-yellow hover:underline self-end"
                    >
                      Read Full Original Review
                      <Icon icon="solar:export-bold" className="w-3.5 h-3.5" />
                    </a>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
