import React, { useEffect, useMemo, useState } from 'react';
import { useParams, Link } from 'react-router';
import { Icon } from '@iconify/react';
import { fetchCriticBySlug } from '../lib/critics';
import SEO from '../components/SEO';

function ReviewPoster({ film }) {
  const [imageFailed, setImageFailed] = useState(false);
  const hasPoster = Boolean(film?.poster_url && !imageFailed);
  const shellClass = "relative w-24 h-36 sm:w-28 sm:h-40 rounded-lg border border-border bg-surface-2 overflow-hidden shadow-lg flex items-center justify-center";
  const content = (
    <>
      <Icon icon="solar:gallery-minimalistic-bold" className="w-8 h-8 text-text-muted opacity-40" />
      {hasPoster && (
        <img
          src={film.poster_url}
          alt=""
          onError={() => setImageFailed(true)}
          className="absolute inset-0 w-full h-full object-cover"
        />
      )}
    </>
  );

  if (film?.slug) {
    return (
      <Link to={`/film/${film.slug}`} className={`${shellClass} group/poster hover:border-brand transition-colors`}>
        {content}
      </Link>
    );
  }

  return <div className={shellClass}>{content}</div>;
}

export default function CriticDetail() {
  const { slug } = useParams();
  const [critic, setCritic] = useState(null);
  const [loading, setLoading] = useState(true);
  const [reviewSearch, setReviewSearch] = useState('');
  const [yearFilter, setYearFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortOrder, setSortOrder] = useState('newest');

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

  const reviews = critic?.reviews || [];
  const ratedReviews = reviews.filter(r => r.rating !== null && r.rating !== undefined);
  const avgRating = ratedReviews.length > 0
    ? (ratedReviews.reduce((sum, r) => sum + Number(r.rating), 0) / ratedReviews.length).toFixed(1)
    : 'N/A';
  const sourceCount = reviews.filter(r => r.review_url).length;

  const yearOptions = useMemo(() => {
    const years = reviews
      .map(r => r.film?.year)
      .filter(Boolean);
    return [...new Set(years)].sort((a, b) => b - a);
  }, [reviews]);

  const filteredReviews = useMemo(() => {
    const query = reviewSearch.trim().toLowerCase();

    return reviews
      .filter((review) => {
        const film = review.film || {};
        const searchable = [
          film.title,
          film.year,
          review.quote,
          review.review_url,
        ].filter(Boolean).join(' ').toLowerCase();

        const matchesSearch = !query || searchable.includes(query);
        const matchesYear = yearFilter === 'all' || String(film.year) === yearFilter;
        const hasRating = review.rating !== null && review.rating !== undefined;
        const hasSource = Boolean(review.review_url);
        const matchesStatus =
          statusFilter === 'all' ||
          (statusFilter === 'rated' && hasRating) ||
          (statusFilter === 'unrated' && !hasRating) ||
          (statusFilter === 'source' && hasSource) ||
          (statusFilter === 'high' && Number(review.rating) >= 4);

        return matchesSearch && matchesYear && matchesStatus;
      })
      .sort((left, right) => {
        const leftFilm = left.film || {};
        const rightFilm = right.film || {};
        if (sortOrder === 'title') {
          return (leftFilm.title || '').localeCompare(rightFilm.title || '');
        }
        if (sortOrder === 'year-desc') {
          return (rightFilm.year || 0) - (leftFilm.year || 0);
        }
        if (sortOrder === 'rating-desc') {
          return Number(right.rating || 0) - Number(left.rating || 0);
        }
        return new Date(right.created_at || 0) - new Date(left.created_at || 0);
      });
  }, [reviews, reviewSearch, yearFilter, statusFilter, sortOrder]);

  const clearReviewFilters = () => {
    setReviewSearch('');
    setYearFilter('all');
    setStatusFilter('all');
    setSortOrder('newest');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-brand border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!critic) {
    return (
      <div className="min-h-screen bg-bg text-text-primary flex flex-col items-center justify-center p-6 text-center">
        <Icon icon="solar:user-block-line-duotone" className="w-20 h-20 text-text-muted opacity-40 mb-4" />
        <h1 className="text-2xl font-bold text-text-primary mb-2">Critic Not Found</h1>
        <p className="text-text-muted text-sm mb-6 max-w-md">We couldn't find a film critic profile matching this page.</p>
        <Link to="/critics" className="px-6 py-2.5 rounded-xl bg-brand text-on-brand font-bold hover:bg-brand-hover transition-colors text-sm">
          Return to Critics Directory
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg text-text-primary pb-20">
      <SEO 
        title={`${critic.name} - Film Critic Profile | MuviDB`}
        description={critic.bio || `Read film reviews, star ratings, and critical essays by ${critic.name} on MuviDB.`}
      />

      {/* Header Profile Section */}
      <section className="relative border-b border-border bg-surface/40 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto">
          <Link to="/critics" className="inline-flex items-center gap-1.5 text-xs text-text-muted hover:text-brand transition-colors mb-6 font-semibold">
            <Icon icon="solar:alt-arrow-left-linear" className="w-4 h-4" />
            Back to All Critics
          </Link>

          <div className="flex flex-col md:flex-row items-center md:items-start gap-8">
            {/* Avatar */}
            <div className="relative flex-shrink-0">
              <img
                src={critic.avatar_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=300'}
                alt={critic.name}
                className="w-32 h-32 md:w-40 md:h-40 rounded-full object-cover border-4 border-border shadow-2xl"
              />
              {critic.is_verified && (
                <div className="absolute bottom-1 right-1 bg-brand text-on-brand rounded-full p-2 shadow-lg" title="Verified Critic">
                  <Icon icon="solar:verified-check-bold" className="w-5 h-5" />
                </div>
              )}
            </div>

            {/* Info */}
            <div className="flex-1 text-center md:text-left">
              <div className="flex flex-wrap items-center justify-center md:justify-start gap-3 mb-2">
                <h1 className="text-3xl sm:text-4xl font-extrabold text-text-primary">{critic.name}</h1>
                {critic.publication && (
                  <span className="px-3 py-1 rounded-full bg-brand/15 border border-brand/30 text-brand text-xs font-bold">
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
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface border border-border text-brand">
                    <Icon icon="solar:user-bold" className="w-4 h-4" />
                    {critic.handle}
                  </span>
                )}
                {critic.platform && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface border border-border text-text-muted">
                    <Icon icon="solar:global-bold" className="w-4 h-4 text-brand" />
                    {critic.platform}
                  </span>
                )}
                {critic.profile_url && (
                  <a
                    href={critic.profile_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-brand/10 border border-brand/40 text-brand hover:bg-brand hover:text-on-brand transition-colors"
                  >
                    <Icon icon="solar:link-circle-bold" className="w-4 h-4" />
                    Official Outlet
                  </a>
                )}
              </div>
            </div>
          </div>

          {/* Stats Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mt-10 pt-8 border-t border-border/60">
            <div className="bg-surface border border-border rounded-xl p-4 text-center">
              <span className="text-xs text-text-muted uppercase font-semibold tracking-wider">Total Reviews</span>
              <p className="text-2xl font-extrabold text-text-primary mt-1">{reviews.length}</p>
            </div>
            <div className="bg-surface border border-border rounded-xl p-4 text-center">
              <span className="text-xs text-text-muted uppercase font-semibold tracking-wider">Average Rating</span>
              <p className="text-2xl font-extrabold text-brand mt-1">{avgRating} {avgRating !== 'N/A' && '/ 5'}</p>
            </div>
            <div className="col-span-2 sm:col-span-1 bg-surface border border-border rounded-xl p-4 text-center">
              <span className="text-xs text-text-muted uppercase font-semibold tracking-wider">Status</span>
              <p className="text-2xl font-extrabold text-green-500 mt-1 flex items-center justify-center gap-1.5">
                <Icon icon="solar:check-circle-bold" className="w-5 h-5" />
                Verified
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Reviews Filmography Section */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-12">
        <div className="flex flex-col gap-5 mb-6">
          <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold text-text-primary flex items-center gap-2">
                <Icon icon="solar:videocamera-record-bold" className="text-brand w-6 h-6" />
                Film Reviews by {critic.name}
              </h2>
              <p className="text-xs text-text-muted mt-1">
                Showing {filteredReviews.length} of {reviews.length} linked films
                {sourceCount > 0 ? ` · ${sourceCount} original source ${sourceCount === 1 ? 'link' : 'links'}` : ''}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface border border-border text-text-muted font-semibold">
                <Icon icon="solar:film-bold" className="w-4 h-4 text-brand" />
                {reviews.length} films
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface border border-border text-text-muted font-semibold">
                <Icon icon="solar:link-circle-bold" className="w-4 h-4 text-brand" />
                {sourceCount} sources
              </span>
            </div>
          </div>

          {reviews.length > 0 && (
            <div className="bg-surface border border-border rounded-xl p-3 sm:p-4">
              <div className="grid grid-cols-1 md:grid-cols-[minmax(220px,1fr)_auto_auto_auto] gap-3">
                <div className="relative">
                  <Icon icon="solar:magnifer-linear" className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
                  <input
                    type="search"
                    value={reviewSearch}
                    onChange={(e) => setReviewSearch(e.target.value)}
                    placeholder="Search by film title or quote..."
                    className="w-full bg-bg border border-border rounded-lg pl-10 pr-3 py-2.5 text-xs text-text-primary placeholder-text-muted focus:outline-none focus:border-brand transition-colors"
                  />
                </div>

                <select
                  value={yearFilter}
                  onChange={(e) => setYearFilter(e.target.value)}
                  className="bg-bg border border-border rounded-lg px-3 py-2.5 text-xs font-semibold text-text-primary focus:outline-none focus:border-brand"
                  aria-label="Filter reviews by release year"
                >
                  <option value="all">All years</option>
                  {yearOptions.map(year => (
                    <option key={year} value={year}>{year}</option>
                  ))}
                </select>

                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="bg-bg border border-border rounded-lg px-3 py-2.5 text-xs font-semibold text-text-primary focus:outline-none focus:border-brand"
                  aria-label="Filter reviews by review status"
                >
                  <option value="all">All reviews</option>
                  <option value="source">With source link</option>
                  <option value="rated">Rated</option>
                  <option value="unrated">Unrated</option>
                  <option value="high">4+ rating</option>
                </select>

                <select
                  value={sortOrder}
                  onChange={(e) => setSortOrder(e.target.value)}
                  className="bg-bg border border-border rounded-lg px-3 py-2.5 text-xs font-semibold text-text-primary focus:outline-none focus:border-brand"
                  aria-label="Sort reviews"
                >
                  <option value="newest">Newest added</option>
                  <option value="title">Film title A-Z</option>
                  <option value="year-desc">Release year</option>
                  <option value="rating-desc">Rating high-low</option>
                </select>
              </div>
            </div>
          )}
        </div>

        {reviews.length === 0 ? (
          <div className="bg-surface border border-border rounded-2xl p-12 text-center">
            <Icon icon="solar:document-text-line-duotone" className="w-16 h-16 text-text-muted mx-auto mb-3 opacity-40" />
            <p className="text-lg font-bold text-text-primary mb-1">No reviews linked yet</p>
            <p className="text-xs text-text-muted">Reviews from this critic will appear here as they are added.</p>
          </div>
        ) : filteredReviews.length === 0 ? (
          <div className="bg-surface border border-border rounded-2xl p-12 text-center">
            <Icon icon="solar:filter-bold-duotone" className="w-16 h-16 text-text-muted mx-auto mb-3 opacity-40" />
            <p className="text-lg font-bold text-text-primary mb-1">No film reviews match those filters</p>
            <p className="text-xs text-text-muted mb-5">Try another film title, year, or review status.</p>
            <button
              type="button"
              onClick={clearReviewFilters}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-brand text-on-brand text-xs font-bold hover:bg-brand-hover transition-colors"
            >
              <Icon icon="solar:restart-bold" className="w-4 h-4" />
              Reset filters
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
            {filteredReviews.map((rev) => {
              const film = rev.film || {};

              return (
                <div key={rev.id} className="bg-surface border border-border rounded-xl p-4 sm:p-5 flex flex-col sm:flex-row gap-4 hover:border-brand/50 transition-colors">
                  <div className="w-28 sm:w-32 flex-shrink-0">
                    <ReviewPoster film={film} />
                  </div>

                  <div className="flex-1 min-w-0 flex flex-col justify-between gap-4">
                    <div>
                      <div className="flex flex-wrap items-center gap-2 mb-2">
                        {film.year && (
                          <span className="px-2 py-1 rounded-md bg-surface-2 border border-border text-[11px] text-text-muted font-bold">
                            {film.year}
                          </span>
                        )}
                        {rev.rating !== null && rev.rating !== undefined && (
                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-brand/10 border border-brand/30 text-[11px] text-brand font-bold">
                            <Icon icon="solar:star-bold" className="w-3.5 h-3.5" />
                            {rev.rating} / 5
                          </span>
                        )}
                        {rev.review_url && (
                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-green-500/10 border border-green-500/30 text-[11px] text-green-500 font-bold">
                            <Icon icon="solar:link-circle-bold" className="w-3.5 h-3.5" />
                            Source
                          </span>
                        )}
                      </div>

                      <h3 className="text-xl font-extrabold text-text-primary leading-tight hover:text-brand transition-colors">
                        {film.slug ? (
                          <Link to={`/film/${film.slug}`}>{film.title || 'Untitled Film'}</Link>
                        ) : (
                          film.title || 'Untitled Film'
                        )}
                      </h3>

                      <blockquote className="mt-4 text-sm text-text-primary italic bg-surface-2 border-l-4 border-brand px-4 py-3 rounded-r-lg leading-relaxed">
                        "{rev.quote}"
                      </blockquote>
                    </div>

                    <div className="flex items-center justify-between gap-3">
                      {film.slug ? (
                        <Link
                          to={`/film/${film.slug}`}
                          className="inline-flex items-center gap-1.5 text-xs font-bold text-text-muted hover:text-brand transition-colors"
                        >
                          <Icon icon="solar:play-circle-bold" className="w-4 h-4" />
                          Film page
                        </Link>
                      ) : (
                        <span className="text-xs text-text-muted font-semibold">No film page slug</span>
                      )}

                      {rev.review_url && (
                        <a
                          href={rev.review_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 text-xs font-bold text-brand hover:underline"
                        >
                          Original review
                          <Icon icon="solar:export-bold" className="w-3.5 h-3.5" />
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
