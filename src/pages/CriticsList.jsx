import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { Icon } from '@iconify/react';
import { fetchCritics } from '../lib/critics';
import SEO from '../components/SEO';
import ImageWithFallback from '../components/ui/ImageWithFallback';
import { formatPersonName, formatFilmTitle } from '../utils/format';

/**
 * Normalizes a score or rating into a 100-point scale with Metacritic-style badge colors.
 */
function getScoreBadge(avgRating) {
  if (!avgRating) return null;
  const num = Number(avgRating);
  if (Number.isNaN(num)) return null;

  let score100 = 0;
  if (num <= 5) score100 = Math.round((num / 5) * 100);
  else if (num <= 10) score100 = Math.round((num / 10) * 100);
  else score100 = Math.min(100, Math.round(num));

  if (score100 >= 60) {
    return { score100, label: 'Positive', badgeClass: 'bg-emerald-600 text-white border-emerald-500' };
  }
  if (score100 >= 40) {
    return { score100, label: 'Mixed', badgeClass: 'bg-amber-500 text-black border-amber-400' };
  }
  return { score100, label: 'Negative', badgeClass: 'bg-rose-600 text-white border-rose-500' };
}

export default function CriticsList() {
  const [critics, setCritics] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedPublication, setSelectedPublication] = useState('all');
  const [sortBy, setSortBy] = useState('reviews-desc');

  useEffect(() => {
    async function load() {
      const data = await fetchCritics();
      setCritics(data);
      setLoading(false);
    }
    load();
  }, []);

  // Compute aggregate statistics
  const stats = useMemo(() => {
    const totalCritics = critics.length;
    const totalReviews = critics.reduce((acc, c) => acc + (c.review_count || 0), 0);
    const publications = new Set(critics.map((c) => c.publication).filter(Boolean));
    return {
      totalCritics,
      totalReviews,
      totalPublications: publications.size
    };
  }, [critics]);

  // Extract distinct publications
  const publicationsList = useMemo(() => {
    const pubs = critics
      .map((c) => c.publication?.trim())
      .filter(Boolean);
    return ['all', ...new Set(pubs)];
  }, [critics]);

  // Filter & sort critics
  const filteredCritics = useMemo(() => {
    const query = search.trim().toLowerCase();

    return critics
      .filter((c) => {
        const matchesSearch =
          !query ||
          c.name?.toLowerCase().includes(query) ||
          c.publication?.toLowerCase().includes(query) ||
          c.title?.toLowerCase().includes(query) ||
          c.handle?.toLowerCase().includes(query) ||
          c.bio?.toLowerCase().includes(query);

        const matchesPublication =
          selectedPublication === 'all' ||
          c.publication?.toLowerCase() === selectedPublication.toLowerCase();

        return matchesSearch && matchesPublication;
      })
      .sort((a, b) => {
        if (sortBy === 'reviews-desc') {
          return (b.review_count || 0) - (a.review_count || 0);
        }
        if (sortBy === 'rating-desc') {
          return Number(b.avg_rating || 0) - Number(a.avg_rating || 0);
        }
        return (a.name || '').localeCompare(b.name || '');
      });
  }, [critics, search, selectedPublication, sortBy]);

  // Top active critics spotlight (top 3 with reviews)
  const spotlightCritics = useMemo(() => {
    return [...critics]
      .filter((c) => c.review_count > 10)
      .sort((a, b) => (b.review_count || 0) - (a.review_count || 0))
      .slice(0, 3);
  }, [critics]);

  return (
    <div className="min-h-screen bg-bg text-text-primary pb-24 selection:bg-brand/20">
      <SEO
        title="Verified Film Critics & Cultural Journalists Directory | MuviDB"
        description="Discover accredited African film critics, culture journalists, and movie reviewers. Explore comprehensive review filmographies, Metascores, and critical essays on Nollywood."
      />


      {/* ─── 1. EDITORIAL DIRECTORY HERO ─── */}
      <section className="relative overflow-hidden border-b border-border bg-gradient-to-b from-surface/80 to-bg px-4 sm:px-6 lg:px-8">
        <div className="absolute inset-0 grid-bg opacity-15 pointer-events-none" />
        
        <div className="max-w-7xl mx-auto pt-14 pb-16 relative z-10">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand/10 border border-brand/30 text-brand text-[10px] font-black uppercase tracking-[0.2em] mb-5">
              <Icon icon="solar:pen-new-square-bold" className="w-4 h-4" />
              Verified Critic & Publications Directory
            </div>
            <h1 className="font-heading text-4xl sm:text-6xl font-black tracking-tight text-text-primary leading-tight">
              The Voices of African Cinema
            </h1>
            <p className="mt-4 text-sm sm:text-base text-text-muted max-w-2xl leading-relaxed">
              Explore verified film critics, essayists, and cultural reviewers providing authoritative analysis, star ratings, and Metascores across Nollywood and world cinema.
            </p>
          </div>

          {/* Aggregate Stats Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5 mt-10 max-w-4xl">
            <div className="bg-surface/90 border border-border rounded-xl p-4 shadow-sm">
              <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted block">Accredited Critics</span>
              <p className="text-2xl sm:text-3xl font-heading font-black text-text-primary mt-1">
                {stats.totalCritics}
              </p>
            </div>
            <div className="bg-surface/90 border border-border rounded-xl p-4 shadow-sm">
              <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted block">Published Reviews</span>
              <p className="text-2xl sm:text-3xl font-heading font-black text-brand mt-1">
                {stats.totalReviews.toLocaleString()}+
              </p>
            </div>
            <div className="bg-surface/90 border border-border rounded-xl p-4 shadow-sm">
              <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted block">Publications</span>
              <p className="text-2xl sm:text-3xl font-heading font-black text-text-primary mt-1">
                {stats.totalPublications}
              </p>
            </div>
            <div className="bg-surface/90 border border-border rounded-xl p-4 shadow-sm">
              <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted block">Certification</span>
              <p className="text-xl sm:text-2xl font-heading font-black text-emerald-400 mt-1 flex items-center gap-1">
                <Icon icon="solar:verified-check-bold" className="w-5 h-5 text-emerald-400" />
                Verified
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ─── 2. SPOTLIGHT PROFILES (TOP VOICES) ─── */}
      {spotlightCritics.length > 0 && selectedPublication === 'all' && !search && (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-6 relative z-20">
          <div className="bg-surface border border-border rounded-2xl p-6 shadow-xl">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-brand">
                <Icon icon="solar:star-bold" className="w-4 h-4" />
                Prolific Voices in African Cinema
              </div>
              <span className="text-xs text-text-muted font-semibold">Featured Portfolios</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {spotlightCritics.map((sc) => {
                const scoreBadge = getScoreBadge(sc.avg_rating);
                return (
                  <Link
                    key={sc.id}
                    to={`/critics/${sc.slug}`}
                    className="group flex flex-col justify-between p-5 rounded-xl bg-surface-2/60 hover:bg-surface-2 border border-border hover:border-brand/40 transition-all duration-300 shadow-sm hover:-translate-y-1"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div className="relative">
                          <div className="w-14 h-14 rounded-xl overflow-hidden border border-border shadow-md bg-black">
                            <ImageWithFallback
                              src={sc.avatar_url}
                              alt={sc.name}
                              fallbackType="avatar"
                              name={sc.name}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                            />
                          </div>
                          {sc.is_verified && (
                            <div className="absolute -bottom-1 -right-1 bg-brand text-black rounded-full p-1 shadow-md">
                              <Icon icon="solar:verified-check-bold" className="w-3 h-3" />
                            </div>
                          )}
                        </div>

                        <div className="text-right">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-surface border border-border text-[11px] font-bold text-text-primary">
                            <Icon icon="solar:notes-bold" className="w-3 h-3 text-brand" />
                            {sc.review_count} Reviews
                          </span>
                          {scoreBadge && (
                            <div className="mt-1">
                              <span className={`px-2 py-0.5 rounded-md text-[10px] font-black ${scoreBadge.badgeClass}`}>
                                {scoreBadge.score100} Avg
                              </span>
                            </div>
                          )}
                        </div>
                      </div>

                      <h3 className="text-lg font-heading font-black text-text-primary group-hover:text-brand transition-colors">
                        {formatPersonName(sc.name)}
                      </h3>
                      <p className="text-xs font-semibold text-brand mt-0.5">
                        {sc.publication || 'Film Critic'}
                      </p>
                      <p className="text-xs text-text-muted mt-2 line-clamp-2 leading-relaxed">
                        {sc.bio}
                      </p>
                    </div>

                    {sc.latest_review?.film && (
                      <div className="mt-4 pt-3 border-t border-border/60 flex items-center justify-between text-[11px]">
                        <span className="text-text-muted truncate max-w-[170px]">
                          Latest: <span className="text-text-primary font-bold">{formatFilmTitle(sc.latest_review.film.title)}</span>
                        </span>
                        <span className="font-bold text-brand group-hover:translate-x-0.5 transition-transform flex items-center gap-0.5">
                          View →
                        </span>
                      </div>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* ─── 3. SEARCH, PUBLICATION FILTERS & SORTING ─── */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-12">
        <div className="bg-surface border border-border rounded-2xl p-4 shadow-sm space-y-4">
          
          {/* Publication Filter Pills */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar text-xs font-bold">
            {publicationsList.map((pub) => {
              const isSelected = selectedPublication.toLowerCase() === pub.toLowerCase();
              return (
                <button
                  key={pub}
                  type="button"
                  onClick={() => setSelectedPublication(pub)}
                  className={`px-3 py-1.5 rounded-lg border transition-all shrink-0 cursor-pointer ${
                    isSelected
                      ? 'bg-brand text-black border-brand font-black shadow-sm'
                      : 'bg-surface-2 border-border text-text-muted hover:text-text-primary'
                  }`}
                >
                  {pub === 'all' ? 'All Publications' : pub}
                </button>
              );
            })}
          </div>

          {/* Search & Sort Row */}
          <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-3">
            <div className="relative">
              <Icon icon="solar:magnifer-linear" className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted w-4 h-4" />
              <input
                type="text"
                placeholder="Search critic by name, publication, or beat..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-bg border border-border rounded-xl text-xs text-text-primary placeholder-text-muted focus:outline-none focus:border-brand transition-colors"
              />
            </div>

            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="bg-bg border border-border rounded-xl px-3 py-2.5 text-xs font-semibold text-text-primary focus:outline-none focus:border-brand"
              aria-label="Sort critics directory"
            >
              <option value="reviews-desc">Most Reviews Published</option>
              <option value="rating-desc">Highest Average Metascore</option>
              <option value="name-asc">Critic Name A-Z</option>
            </select>
          </div>

        </div>
      </section>

      {/* ─── 4. CRITICS DIRECTORY GRID ─── */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8">
        {loading ? (
          <div className="flex items-center justify-center py-24">
            <div className="w-10 h-10 border-4 border-brand border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : filteredCritics.length === 0 ? (
          <div className="text-center py-20 bg-surface rounded-2xl border border-border">
            <Icon icon="solar:user-block-line-duotone" className="w-16 h-16 text-text-muted mx-auto mb-3 opacity-40" />
            <h3 className="text-xl font-bold text-text-primary mb-1">No critics found</h3>
            <p className="text-xs text-text-muted mb-4">Try clearing or adjusting your search term.</p>
            <button
              type="button"
              onClick={() => { setSearch(''); setSelectedPublication('all'); }}
              className="px-4 py-2 rounded-xl bg-brand text-black text-xs font-bold hover:bg-brand-hover transition-colors"
            >
              Reset Filters
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredCritics.map((critic) => {
              const scoreBadge = getScoreBadge(critic.avg_rating);

              return (
                <Link
                  key={critic.id}
                  to={`/critics/${critic.slug}`}
                  className="group bg-surface hover:bg-surface-2/70 border border-border hover:border-brand/40 rounded-2xl p-6 transition-all duration-300 shadow-sm hover:shadow-xl hover:shadow-brand/5 hover:-translate-y-1 flex flex-col justify-between"
                >
                  <div>
                    {/* Header: Avatar, Verified Badge, Review Counter & Score */}
                    <div className="flex items-start justify-between gap-4 mb-4">
                      <div className="relative">
                        <div className="w-16 h-16 rounded-2xl overflow-hidden border-2 border-border group-hover:border-brand transition-colors shadow-md bg-black">
                          <ImageWithFallback
                            src={critic.avatar_url}
                            alt={critic.name}
                            fallbackType="avatar"
                            name={critic.name}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          />
                        </div>
                        {critic.is_verified && (
                          <div
                            className="absolute -bottom-1 -right-1 bg-brand text-black rounded-full p-1 shadow-md border border-bg"
                            title="Certified Film Critic"
                          >
                            <Icon icon="solar:verified-check-bold" className="w-3.5 h-3.5" />
                          </div>
                        )}
                      </div>

                      <div className="flex flex-col items-end gap-1">
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-surface-2 border border-border text-xs text-text-primary font-bold">
                          <Icon icon="solar:notes-bold" className="w-3.5 h-3.5 text-brand" />
                          {critic.review_count} {critic.review_count === 1 ? 'Review' : 'Reviews'}
                        </span>
                        {scoreBadge && (
                          <span className={`px-2 py-0.5 rounded-md text-[10px] font-black shadow-sm ${scoreBadge.badgeClass}`}>
                            {scoreBadge.score100} Avg Metascore
                          </span>
                        )}
                      </div>
                    </div>

                    <h2 className="text-xl font-heading font-black text-text-primary group-hover:text-brand transition-colors">
                      {formatPersonName(critic.name)}
                    </h2>
                    <p className="text-xs font-semibold text-brand mt-0.5">
                      {critic.publication || 'Film Critic'}
                    </p>
                    <p className="text-xs text-text-muted mt-2.5 line-clamp-3 leading-relaxed">
                      {critic.bio || 'Film critic and cultural journalist covering African cinema, premieres, and narrative craft.'}
                    </p>
                  </div>

                  {/* Footer / Latest Review Teaser */}
                  <div className="mt-6 pt-4 border-t border-border/60 flex flex-col gap-2">
                    {critic.latest_review?.film && (
                      <div className="text-[11px] text-text-muted flex items-center justify-between">
                        <span className="truncate max-w-[200px]">
                          Recent: <strong className="text-text-primary">{formatFilmTitle(critic.latest_review.film.title)}</strong>
                        </span>
                        {critic.latest_review.rating && (
                          <span className="font-bold text-text-primary">
                            ★ {critic.latest_review.rating}
                          </span>
                        )}
                      </div>
                    )}

                    <div className="flex items-center justify-between text-xs text-text-muted group-hover:text-text-primary transition-colors pt-1">
                      <span className="font-mono text-[11px] text-brand">{critic.handle || `@${critic.slug}`}</span>
                      <span className="flex items-center gap-1 font-bold text-brand group-hover:translate-x-1 transition-transform">
                        <span>View Portfolio</span>
                        <Icon icon="solar:alt-arrow-right-linear" className="w-3.5 h-3.5" />
                      </span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
