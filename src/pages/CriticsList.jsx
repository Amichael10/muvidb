import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { Icon } from '@iconify/react';
import { fetchCritics } from '../lib/critics';
import SEO from '../components/SEO';
import PageHeader from '../components/ui/PageHeader';
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

  return (
    <div className="min-h-screen bg-bg text-text-primary pb-24 selection:bg-brand/20">
      <SEO
        title="Verified Film Critics & Cultural Journalists Directory | MuviDB"
        description="Discover accredited African film critics, culture journalists, and movie reviewers. Explore comprehensive review filmographies, Metascores, and critical essays on Nollywood."
      />

      {/* ─── 1. PAGE HEADER & COMPACT METRICS ─── */}
      <PageHeader
        icon="solar:pen-new-square-bold"
        eyebrow="Editorial Directory"
        title="The Voices of African Cinema"
        description="Explore verified film critics, essayists, and cultural reviewers providing authoritative analysis, star ratings, and Metascores across Nollywood."
        count={critics.length}
        countLabel="critics accredited"
        actions={
          <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
            {stats.totalReviews > 0 && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface/70 border border-border/80 text-xs">
                <span className="w-2 h-2 rounded-full bg-brand shrink-0" />
                <span className="text-text-muted">Published Reviews:</span>
                <span className="font-bold text-brand">
                  {stats.totalReviews.toLocaleString()}+
                </span>
              </div>
            )}
            {stats.totalPublications > 0 && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface/70 border border-border/80 text-xs">
                <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" />
                <span className="text-text-muted">Outlets:</span>
                <span className="font-bold text-text-primary">
                  {stats.totalPublications} Publications
                </span>
              </div>
            )}
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface/70 border border-border/80 text-xs">
              <Icon icon="solar:verified-check-bold" className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span className="text-text-muted">Certification:</span>
              <span className="font-bold text-emerald-400">
                Verified
              </span>
            </div>
          </div>
        }
      />

      {/* ─── 2. SEARCH, OUTLET FILTERS & SORTING BAR ─── */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8">
        <div className="space-y-4">
          
          {/* Publication Filter Pills */}
          <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto pb-1 no-scrollbar text-xs font-semibold">
            <span className="text-[11px] font-bold uppercase tracking-wider text-text-muted mr-1 shrink-0 flex items-center gap-1.5">
              <Icon icon="solar:bookmark-bold" className="text-brand w-3.5 h-3.5" />
              Outlet:
            </span>
            {publicationsList.map((pub) => {
              const isSelected = selectedPublication.toLowerCase() === pub.toLowerCase();
              return (
                <button
                  key={pub}
                  type="button"
                  onClick={() => setSelectedPublication(pub)}
                  className={`px-3 py-1.5 rounded-lg border transition-all shrink-0 cursor-pointer ${
                    isSelected
                      ? 'bg-surface-2 border-brand/50 text-text-primary font-bold shadow-xs'
                      : 'bg-surface/50 border-border text-text-muted hover:text-text-primary hover:border-border/80'
                  }`}
                >
                  {pub === 'all' ? `All Outlets (${critics.length})` : pub}
                </button>
              );
            })}
          </div>

          {/* Search & Sort Row */}
          <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-3 items-center">
            <div className="relative">
              <Icon icon="solar:magnifer-linear" className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted w-4 h-4" />
              <input
                type="text"
                placeholder="Search critic by name, publication, or beat..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-9 py-2.5 bg-surface/70 hover:bg-surface border border-border/80 focus:border-brand rounded-xl text-xs text-text-primary placeholder-text-muted focus:outline-none transition-all shadow-xs"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary p-1"
                  aria-label="Clear search"
                >
                  <Icon icon="solar:close-circle-bold" className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="relative">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="w-full sm:w-auto bg-surface/70 hover:bg-surface border border-border/80 rounded-xl px-3.5 py-2.5 text-xs font-semibold text-text-primary focus:outline-none focus:border-brand transition-all shadow-xs cursor-pointer pr-8"
                aria-label="Sort critics directory"
              >
                <option value="reviews-desc">Most Reviews Published</option>
                <option value="rating-desc">Highest Average Metascore</option>
                <option value="name-asc">Critic Name A-Z</option>
              </select>
            </div>
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
                  className="group bg-surface/70 hover:bg-surface border border-border/70 hover:border-brand/40 rounded-xl p-5 transition-all duration-300 shadow-xs hover:shadow-lg hover:shadow-brand/5 hover:-translate-y-0.5 flex flex-col justify-between"
                >
                  <div>
                    {/* Header: Avatar, Verified Badge, Review Counter & Score */}
                    <div className="flex items-start justify-between gap-3.5 mb-3.5">
                      <div className="relative">
                        <div className="w-14 h-14 rounded-xl overflow-hidden border border-border/80 group-hover:border-brand/50 transition-colors shadow-xs bg-surface-2 shrink-0">
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
                            className="absolute -bottom-1 -right-1 bg-brand text-on-brand rounded-full p-0.5 shadow-sm border border-surface"
                            title="Certified Film Critic"
                          >
                            <Icon icon="solar:verified-check-bold" className="w-3.5 h-3.5" />
                          </div>
                        )}
                      </div>

                      <div className="flex flex-col items-end gap-1">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-surface-2 border border-border/70 text-[11px] text-text-primary font-semibold">
                          <Icon icon="solar:notes-bold" className="w-3 h-3 text-brand" />
                          {critic.review_count} {critic.review_count === 1 ? 'Review' : 'Reviews'}
                        </span>
                        {scoreBadge && (
                          <span className={`px-2 py-0.5 rounded-md text-[10px] font-black shadow-xs ${scoreBadge.badgeClass}`}>
                            {scoreBadge.score100} Avg Metascore
                          </span>
                        )}
                      </div>
                    </div>

                    <h2 className="text-lg font-heading font-black text-text-primary group-hover:text-brand transition-colors leading-snug">
                      {formatPersonName(critic.name)}
                    </h2>
                    <p className="text-xs font-semibold text-brand mt-0.5">
                      {critic.publication || 'Film Critic'}
                    </p>
                    <p className="text-xs text-text-muted mt-2 line-clamp-2 leading-relaxed">
                      {critic.bio || 'Film critic and cultural journalist covering African cinema, premieres, and narrative craft.'}
                    </p>
                  </div>

                  {/* Footer / Latest Review Teaser */}
                  <div className="mt-4 pt-3 border-t border-border/40 flex flex-col gap-1.5">
                    {critic.latest_review?.film && (
                      <div className="text-[11px] text-text-muted flex items-center justify-between">
                        <span className="truncate max-w-[200px]">
                          Recent: <strong className="text-text-primary font-medium">{formatFilmTitle(critic.latest_review.film.title)}</strong>
                        </span>
                        {critic.latest_review.rating && (
                          <span className="font-bold text-text-primary text-[10px]">
                            ★ {critic.latest_review.rating}
                          </span>
                        )}
                      </div>
                    )}

                    <div className="flex items-center justify-between text-xs text-text-muted group-hover:text-text-primary transition-colors pt-1">
                      <span className="font-mono text-[11px] text-brand">{critic.handle || `@${critic.slug}`}</span>
                      <span className="flex items-center gap-1 font-medium text-brand group-hover:translate-x-0.5 transition-transform text-[11px]">
                        <span>View Portfolio</span>
                        <Icon icon="solar:alt-arrow-right-linear" className="w-3 h-3" />
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
