import React, { useEffect, useMemo, useState } from 'react';
import { useParams, Link } from 'react-router';
import { Icon } from '@iconify/react';
import { fetchCriticBySlug } from '../lib/critics';
import SEO from '../components/SEO';
import ImageWithFallback from '../components/ui/ImageWithFallback';
import { formatFilmTitle, formatPersonName } from '../utils/format';

/**
 * Normalizes any rating scale (5-point, 10-point, or 100-point) into a unified
 * 100-point Metacritic-equivalent score and sentiment tier (positive, mixed, negative).
 */
function normalizeRating(rawRating) {
  if (rawRating === null || rawRating === undefined || rawRating === '') {
    return null;
  }
  const num = Number(rawRating);
  if (Number.isNaN(num)) return null;

  let score100 = 0;
  let formattedLabel = '';

  if (num <= 5) {
    score100 = Math.round((num / 5) * 100);
    formattedLabel = `${num % 1 === 0 ? num : num.toFixed(1)} / 5`;
  } else if (num <= 10) {
    score100 = Math.round((num / 10) * 100);
    formattedLabel = `${num % 1 === 0 ? num : num.toFixed(1)} / 10`;
  } else {
    score100 = Math.min(100, Math.round(num));
    formattedLabel = `${score100} / 100`;
  }

  let sentiment = 'mixed';
  let badgeClasses = 'bg-amber-500 text-black border-amber-400';
  let pillClasses = 'bg-amber-500/10 text-amber-400 border-amber-500/30';
  let sentimentLabel = 'Mixed';

  if (score100 >= 60) {
    sentiment = 'positive';
    badgeClasses = 'bg-emerald-600 text-white border-emerald-500';
    pillClasses = 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';
    sentimentLabel = 'Positive';
  } else if (score100 < 40) {
    sentiment = 'negative';
    badgeClasses = 'bg-rose-600 text-white border-rose-500';
    pillClasses = 'bg-rose-500/10 text-rose-400 border-rose-500/30';
    sentimentLabel = 'Negative';
  }

  return {
    raw: num,
    score100,
    formattedLabel,
    sentiment,
    badgeClasses,
    pillClasses,
    sentimentLabel
  };
}

export default function CriticDetail() {
  const { slug } = useParams();
  const [critic, setCritic] = useState(null);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState('list'); // 'list' (Metacritic editorial) | 'grid'
  const [sentimentFilter, setSentimentFilter] = useState('all'); // 'all' | 'positive' | 'mixed' | 'negative'
  const [reviewSearch, setReviewSearch] = useState('');
  const [yearFilter, setYearFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortOrder, setSortOrder] = useState('newest');
  const [copiedLink, setCopiedLink] = useState(false);

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

  // Compute Metacritic-style analytics & score distributions
  const stats = useMemo(() => {
    let positive = 0;
    let mixed = 0;
    let negative = 0;
    let unrated = 0;
    let sumScore100 = 0;
    let ratedCount = 0;

    reviews.forEach((r) => {
      const normalized = normalizeRating(r.rating);
      if (!normalized) {
        unrated += 1;
        return;
      }
      ratedCount += 1;
      sumScore100 += normalized.score100;
      if (normalized.sentiment === 'positive') positive += 1;
      else if (normalized.sentiment === 'mixed') mixed += 1;
      else negative += 1;
    });

    const avgScore100 = ratedCount > 0 ? Math.round(sumScore100 / ratedCount) : null;
    const positivePct = ratedCount > 0 ? Math.round((positive / ratedCount) * 100) : 0;
    const mixedPct = ratedCount > 0 ? Math.round((mixed / ratedCount) * 100) : 0;
    const negativePct = ratedCount > 0 ? Math.round((negative / ratedCount) * 100) : 0;

    // Identify career watermarks (highest & lowest rated)
    const ratedReviewsSorted = [...reviews]
      .filter((r) => r.rating !== null && r.rating !== undefined)
      .sort((a, b) => {
        const normA = normalizeRating(a.rating)?.score100 || 0;
        const normB = normalizeRating(b.rating)?.score100 || 0;
        return normB - normA;
      });

    const highestRated = ratedReviewsSorted[0] || null;
    const lowestRated = ratedReviewsSorted.length > 1
      ? ratedReviewsSorted[ratedReviewsSorted.length - 1]
      : null;

    // Active years
    const years = reviews
      .map((r) => r.film?.year || r.play?.year)
      .filter(Boolean)
      .sort((a, b) => a - b);
    const yearsActive = years.length > 0
      ? `${years[0]} – ${years[years.length - 1]}`
      : 'Active';

    return {
      total: reviews.length,
      ratedCount,
      unrated,
      positive,
      mixed,
      negative,
      positivePct,
      mixedPct,
      negativePct,
      avgScore100,
      highestRated,
      lowestRated,
      yearsActive,
      sourceCount: reviews.filter((r) => r.review_url).length
    };
  }, [reviews]);

  // Distinct release years for filter dropdown
  const yearOptions = useMemo(() => {
    const years = reviews
      .map((r) => r.film?.year || r.play?.year)
      .filter(Boolean);
    return [...new Set(years)].sort((a, b) => b - a);
  }, [reviews]);

  // Filtered & sorted reviews list
  const filteredReviews = useMemo(() => {
    const query = reviewSearch.trim().toLowerCase();

    return reviews
      .filter((review) => {
        const film = review.film || review.play || {};
        const normalized = normalizeRating(review.rating);

        const searchable = [
          film.title,
          film.year,
          review.quote,
          review.review_url,
          critic?.publication,
          Array.isArray(film.genres) ? film.genres.join(' ') : ''
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();

        const matchesSearch = !query || searchable.includes(query);
        const matchesYear = yearFilter === 'all' || String(film.year) === yearFilter;
        const matchesSentiment =
          sentimentFilter === 'all' ||
          (normalized && normalized.sentiment === sentimentFilter);

        const hasRating = review.rating !== null && review.rating !== undefined;
        const hasSource = Boolean(review.review_url);
        const matchesStatus =
          statusFilter === 'all' ||
          (statusFilter === 'source' && hasSource) ||
          (statusFilter === 'rated' && hasRating) ||
          (statusFilter === 'unrated' && !hasRating);

        return matchesSearch && matchesYear && matchesSentiment && matchesStatus;
      })
      .sort((left, right) => {
        const leftTarget = left.film || left.play || {};
        const rightTarget = right.film || right.play || {};
        const normLeft = normalizeRating(left.rating)?.score100 || -1;
        const normRight = normalizeRating(right.rating)?.score100 || -1;

        if (sortOrder === 'rating-desc') {
          return normRight - normLeft;
        }
        if (sortOrder === 'rating-asc') {
          return normLeft - normRight;
        }
        if (sortOrder === 'title') {
          return (leftTarget.title || '').localeCompare(rightTarget.title || '');
        }
        if (sortOrder === 'year-desc') {
          return (rightTarget.year || 0) - (leftTarget.year || 0);
        }
        return new Date(right.created_at || 0) - new Date(left.created_at || 0);
      });
  }, [reviews, reviewSearch, yearFilter, sentimentFilter, statusFilter, sortOrder, critic]);

  const clearFilters = () => {
    setReviewSearch('');
    setYearFilter('all');
    setSentimentFilter('all');
    setStatusFilter('all');
    setSortOrder('newest');
  };

  const handleShare = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(window.location.href);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    }
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
        <h1 className="text-2xl font-bold text-text-primary mb-2">Critic Profile Not Found</h1>
        <p className="text-text-muted text-sm mb-6 max-w-md">
          We couldn't locate a verified film critic matching this address.
        </p>
        <Link
          to="/critics"
          className="px-6 py-2.5 rounded-xl bg-brand text-on-brand font-bold hover:bg-brand-hover transition-colors text-sm"
        >
          Return to Critics Directory
        </Link>
      </div>
    );
  }

  // Cover backdrop: use highest rated film backdrop or latest reviewed backdrop
  const coverBackdrop =
    stats.highestRated?.film?.backdrop_url ||
    reviews.find((r) => r.film?.backdrop_url)?.film?.backdrop_url ||
    null;

  // Latest spotlight review (for personal website showcase)
  const spotlightReview = reviews[0] || null;

  return (
    <div className="min-h-screen bg-bg text-text-primary pb-24 selection:bg-brand/20">
      <SEO
        title={`${critic.name} · Verified Film Critic Reviews & Scores | MuviDB`}
        description={
          critic.bio ||
          `Explore verified film reviews, critical essays, and Metascore breakdowns by ${critic.name} on MuviDB.`
        }
      />

      {/* ─── 1. CRITIC MASTHEAD / PERSONAL PORTFOLIO HERO ─── */}
      <header className="relative border-b border-border bg-gradient-to-b from-surface to-bg overflow-hidden">
        {/* Subtle Ambient Cover Art */}
        {coverBackdrop && (
          <div className="absolute inset-0 opacity-15 mix-blend-screen pointer-events-none overflow-hidden">
            <img
              src={coverBackdrop}
              alt=""
              className="w-full h-full object-cover object-center filter blur-md scale-105"
            />
            <div className="absolute inset-0 bg-gradient-to-b from-bg/60 via-bg/90 to-bg" />
          </div>
        )}
        <div className="absolute inset-0 grid-bg opacity-15 pointer-events-none" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-10 pb-12 relative z-10">
          <div className="flex flex-col lg:flex-row items-start gap-8 lg:gap-12">
            
            {/* Critic Headshot & Verification Shield */}
            <div className="flex-shrink-0 mx-auto lg:mx-0">
              <div className="relative group">
                <div className="w-32 h-32 sm:w-40 sm:h-40 rounded-2xl overflow-hidden border-2 border-border/80 bg-surface-2 shadow-2xl p-1 relative">
                  <ImageWithFallback
                    src={critic.avatar_url}
                    alt={critic.name}
                    fallbackType="avatar"
                    name={critic.name}
                    className="w-full h-full object-cover rounded-xl"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent pointer-events-none rounded-xl" />
                </div>

                {critic.is_verified && (
                  <div
                    className="absolute -bottom-2.5 -right-2.5 bg-brand text-on-brand rounded-full p-2 shadow-xl border-2 border-bg flex items-center justify-center"
                    title="Certified MuviDB Film Critic"
                  >
                    <Icon icon="solar:verified-check-bold" className="w-5 h-5 text-black" />
                  </div>
                )}
              </div>
            </div>

            {/* Editorial Bio, Metadata & Outlets */}
            <div className="flex-1 text-center lg:text-left min-w-0">
              <div className="flex flex-wrap items-center justify-center lg:justify-start gap-2.5 mb-2">
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-brand/10 border border-brand/25 text-brand text-[10px] font-black uppercase tracking-wider">
                  <Icon icon="solar:pen-bold" className="w-3 h-3" />
                  Verified Film Critic
                </span>

                {critic.publication && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-surface-2 border border-border text-text-secondary text-[11px] font-bold">
                    <Icon icon="solar:buildings-bold" className="w-3 h-3 text-brand" />
                    {critic.publication}
                  </span>
                )}
              </div>

              <h1 className="text-3xl sm:text-5xl font-heading font-black text-text-primary tracking-tight leading-tight mb-2">
                {formatPersonName(critic.name)}
              </h1>

              <p className="text-sm font-semibold text-brand mb-4">
                {critic.title || 'Film Critic & Cultural Commentator'}
                {critic.publication ? ` · ${critic.publication}` : ''}
              </p>

              <p className="text-sm text-text-muted leading-relaxed max-w-3xl mb-6">
                {critic.bio ||
                  'Accredited film journalist providing critical analysis, ratings, and commentary on Nollywood and global African storytelling.'}
              </p>

              {/* Social Handles, Platforms & Action Buttons */}
              <div className="flex flex-wrap items-center justify-center lg:justify-start gap-2.5 text-xs font-semibold">
                {critic.handle && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface/80 border border-border text-text-secondary">
                    <Icon icon="solar:mention-circle-bold" className="w-3.5 h-3.5 text-brand" />
                    {critic.handle}
                  </span>
                )}

                {critic.platform && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface/80 border border-border text-text-muted">
                    <Icon icon="solar:global-bold" className="w-3.5 h-3.5 text-brand" />
                    {critic.platform}
                  </span>
                )}

                {critic.profile_url && (
                  <a
                    href={critic.profile_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-brand text-black font-bold hover:bg-brand-hover transition-colors shadow-sm"
                  >
                    <span>Read on {critic.publication || 'Official Outlet'}</span>
                    <Icon icon="solar:arrow-right-up-linear" className="w-3.5 h-3.5" />
                  </a>
                )}
              </div>
            </div>

            {/* Quick Stat Pill Widget (Right Desktop) */}
            <div className="w-full lg:w-72 bg-surface/80 border border-border rounded-2xl p-5 backdrop-blur-sm shadow-xl flex flex-col gap-3 shrink-0">
              <div className="flex items-center justify-between pb-3 border-b border-border/60">
                <span className="text-[11px] font-bold uppercase tracking-wider text-text-muted">MuviDB Critic ID</span>
                <span className="text-xs font-mono font-bold text-brand">#{critic.slug}</span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="p-2.5 rounded-xl bg-surface-2/60 border border-border/40">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted block">Reviews</span>
                  <span className="text-xl font-black text-text-primary mt-0.5 block">{stats.total}</span>
                </div>
                <div className="p-2.5 rounded-xl bg-surface-2/60 border border-border/40">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted block">Avg Score</span>
                  <span className="text-xl font-black text-brand mt-0.5 block">
                    {stats.avgScore100 !== null ? `${stats.avgScore100}` : 'N/A'}
                    {stats.avgScore100 !== null && <span className="text-[10px] text-text-muted font-normal ml-0.5">/ 100</span>}
                  </span>
                </div>
              </div>

              <div className="pt-1 flex items-center justify-between text-xs text-text-muted">
                <span>Active Coverage:</span>
                <span className="font-semibold text-text-primary">{stats.yearsActive}</span>
              </div>
            </div>

          </div>
        </div>
      </header>

      {/* ─── 2. METACRITIC-STYLE SCORECARD & ANALYTICS BAR ─── */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-6 relative z-20">
        <div className="bg-surface border border-border rounded-2xl p-6 shadow-2xl backdrop-blur-md">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            
            {/* Left Column: Metascore Summary */}
            <div className="lg:col-span-4 flex items-center gap-5 border-b lg:border-b-0 lg:border-r border-border/70 pb-6 lg:pb-0 lg:pr-8">
              <div
                className={`w-20 h-20 rounded-2xl flex flex-col items-center justify-center font-heading font-black shadow-lg border shrink-0 ${
                  stats.avgScore100 >= 60
                    ? 'bg-emerald-600 text-white border-emerald-400/50'
                    : stats.avgScore100 >= 40
                    ? 'bg-amber-500 text-black border-amber-300/50'
                    : stats.avgScore100 !== null
                    ? 'bg-rose-600 text-white border-rose-400/50'
                    : 'bg-surface-2 text-text-muted border-border'
                }`}
              >
                <span className="text-3xl leading-none">{stats.avgScore100 !== null ? stats.avgScore100 : '–'}</span>
                <span className="text-[9px] uppercase tracking-widest font-sans font-bold opacity-90 mt-1">Metascore</span>
              </div>

              <div>
                <span className="text-[10px] font-black uppercase tracking-widest text-text-muted">Critic Metascore Rating</span>
                <h3 className="text-lg font-bold text-text-primary mt-0.5">
                  {stats.avgScore100 >= 60
                    ? 'Generally Favorable Reviews'
                    : stats.avgScore100 >= 40
                    ? 'Mixed or Average Commentary'
                    : stats.avgScore100 !== null
                    ? 'Unfavorable / Highly Critical'
                    : 'Unscored Portfolio'}
                </h3>
                <p className="text-xs text-text-muted mt-1">
                  Based on {stats.ratedCount} scored reviews out of {stats.total} entries
                </p>
              </div>
            </div>

            {/* Middle Column: Score Distribution Breakdown (Metacritic Signature) */}
            <div className="lg:col-span-8 flex flex-col justify-center">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-text-secondary flex items-center gap-1.5">
                  <Icon icon="solar:chart-2-bold" className="text-brand w-4 h-4" />
                  Score Distribution (Metacritic Breakdown)
                </span>
                <span className="text-xs text-text-muted font-medium">Click a bar to filter</span>
              </div>

              {/* 3-Color Horizontal Stacked Distribution Bar */}
              <div className="h-4 w-full rounded-full bg-surface-2 overflow-hidden flex shadow-inner border border-border/60">
                {stats.positive > 0 && (
                  <button
                    type="button"
                    onClick={() => setSentimentFilter('positive')}
                    style={{ width: `${stats.positivePct}%` }}
                    className="h-full bg-emerald-500 hover:bg-emerald-400 transition-all cursor-pointer relative group"
                    title={`Positive: ${stats.positive} (${stats.positivePct}%)`}
                  />
                )}
                {stats.mixed > 0 && (
                  <button
                    type="button"
                    onClick={() => setSentimentFilter('mixed')}
                    style={{ width: `${stats.mixedPct}%` }}
                    className="h-full bg-amber-500 hover:bg-amber-400 transition-all cursor-pointer relative group"
                    title={`Mixed: ${stats.mixed} (${stats.mixedPct}%)`}
                  />
                )}
                {stats.negative > 0 && (
                  <button
                    type="button"
                    onClick={() => setSentimentFilter('negative')}
                    style={{ width: `${stats.negativePct}%` }}
                    className="h-full bg-rose-500 hover:bg-rose-400 transition-all cursor-pointer relative group"
                    title={`Negative: ${stats.negative} (${stats.negativePct}%)`}
                  />
                )}
              </div>

              {/* Distribution Legend & Counts */}
              <div className="grid grid-cols-3 gap-2 mt-3 pt-2 text-xs">
                <button
                  type="button"
                  onClick={() => setSentimentFilter(sentimentFilter === 'positive' ? 'all' : 'positive')}
                  className={`flex items-center justify-between p-2 rounded-lg border transition-all cursor-pointer ${
                    sentimentFilter === 'positive'
                      ? 'bg-emerald-500/20 border-emerald-500 text-white font-bold'
                      : 'bg-surface-2/40 border-border hover:border-emerald-500/40 text-text-muted'
                  }`}
                >
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0" />
                    <span>Positive</span>
                  </span>
                  <span className="font-bold text-emerald-400">{stats.positive} ({stats.positivePct}%)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setSentimentFilter(sentimentFilter === 'mixed' ? 'all' : 'mixed')}
                  className={`flex items-center justify-between p-2 rounded-lg border transition-all cursor-pointer ${
                    sentimentFilter === 'mixed'
                      ? 'bg-amber-500/20 border-amber-500 text-white font-bold'
                      : 'bg-surface-2/40 border-border hover:border-amber-500/40 text-text-muted'
                  }`}
                >
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500 shrink-0" />
                    <span>Mixed</span>
                  </span>
                  <span className="font-bold text-amber-400">{stats.mixed} ({stats.mixedPct}%)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setSentimentFilter(sentimentFilter === 'negative' ? 'all' : 'negative')}
                  className={`flex items-center justify-between p-2 rounded-lg border transition-all cursor-pointer ${
                    sentimentFilter === 'negative'
                      ? 'bg-rose-500/20 border-rose-500 text-white font-bold'
                      : 'bg-surface-2/40 border-border hover:border-rose-500/40 text-text-muted'
                  }`}
                >
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-rose-500 shrink-0" />
                    <span>Negative</span>
                  </span>
                  <span className="font-bold text-rose-400">{stats.negative} ({stats.negativePct}%)</span>
                </button>
              </div>
            </div>

          </div>

          {/* High & Low Watermark Quick Highlights */}
          {(stats.highestRated || stats.lowestRated) && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6 pt-6 border-t border-border/60">
              {stats.highestRated && (
                <div className="flex items-center gap-3 p-3 rounded-xl bg-surface-2/50 border border-border">
                  <div className="w-12 h-16 rounded-md overflow-hidden bg-black shrink-0 border border-border">
                    <ImageWithFallback
                      src={stats.highestRated.film?.poster_url}
                      alt={stats.highestRated.film?.title}
                      fallbackType="film"
                      name={stats.highestRated.film?.title}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="text-[10px] font-black uppercase tracking-wider text-emerald-400 flex items-center gap-1">
                      <Icon icon="solar:cup-star-bold" className="w-3.5 h-3.5" />
                      Highest Rated Film
                    </span>
                    <h4 className="text-sm font-bold text-text-primary truncate">
                      {stats.highestRated.film?.title || 'Film'} ({stats.highestRated.film?.year})
                    </h4>
                    <p className="text-xs text-text-muted line-clamp-1 italic mt-0.5">
                      "{stats.highestRated.quote}"
                    </p>
                  </div>
                  <span className="px-2.5 py-1 rounded-lg bg-emerald-600 text-white font-black text-xs shrink-0">
                    {normalizeRating(stats.highestRated.rating)?.formattedLabel || stats.highestRated.rating}
                  </span>
                </div>
              )}

              {stats.lowestRated && (
                <div className="flex items-center gap-3 p-3 rounded-xl bg-surface-2/50 border border-border">
                  <div className="w-12 h-16 rounded-md overflow-hidden bg-black shrink-0 border border-border">
                    <ImageWithFallback
                      src={stats.lowestRated.film?.poster_url}
                      alt={stats.lowestRated.film?.title}
                      fallbackType="film"
                      name={stats.lowestRated.film?.title}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="text-[10px] font-black uppercase tracking-wider text-rose-400 flex items-center gap-1">
                      <Icon icon="solar:danger-triangle-bold" className="w-3.5 h-3.5" />
                      Most Critical Review
                    </span>
                    <h4 className="text-sm font-bold text-text-primary truncate">
                      {stats.lowestRated.film?.title || 'Film'} ({stats.lowestRated.film?.year})
                    </h4>
                    <p className="text-xs text-text-muted line-clamp-1 italic mt-0.5">
                      "{stats.lowestRated.quote}"
                    </p>
                  </div>
                  <span className="px-2.5 py-1 rounded-lg bg-rose-600 text-white font-black text-xs shrink-0">
                    {normalizeRating(stats.lowestRated.rating)?.formattedLabel || stats.lowestRated.rating}
                  </span>
                </div>
              )}
            </div>
          )}

        </div>
      </section>

      {/* ─── 3. CRITIC'S LATEST SPOTLIGHT REVIEW (Editorial Feature) ─── */}
      {spotlightReview && (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-12">
          <div className="relative rounded-2xl border border-brand/30 bg-gradient-to-r from-surface to-surface-2 p-6 sm:p-8 overflow-hidden shadow-xl">
            <div className="absolute -right-16 -top-16 w-64 h-64 bg-brand/5 rounded-full blur-3xl pointer-events-none" />
            
            <div className="flex flex-col md:flex-row items-center md:items-start gap-6 relative z-10">
              <div className="w-24 h-36 sm:w-28 sm:h-40 rounded-xl overflow-hidden shadow-2xl border border-border shrink-0 bg-black">
                <ImageWithFallback
                  src={spotlightReview.film?.poster_url || spotlightReview.play?.poster_url}
                  alt={spotlightReview.film?.title || spotlightReview.play?.title}
                  fallbackType="film"
                  name={spotlightReview.film?.title || spotlightReview.play?.title}
                  className="w-full h-full object-cover"
                />
              </div>

              <div className="flex-1 text-center md:text-left min-w-0">
                <div className="flex flex-wrap items-center justify-center md:justify-start gap-2 mb-2">
                  <span className="px-2.5 py-0.5 rounded-full bg-brand/15 text-brand text-[10px] font-black uppercase tracking-wider border border-brand/30">
                    Featured Latest Review
                  </span>
                  {(spotlightReview.film?.year || spotlightReview.play?.year) && (
                    <span className="text-xs font-bold text-text-muted">
                      {spotlightReview.film?.year || spotlightReview.play?.year}
                    </span>
                  )}
                  {normalizeRating(spotlightReview.rating) && (
                    <span className={`px-2 py-0.5 rounded-md font-black text-xs ${normalizeRating(spotlightReview.rating).badgeClasses}`}>
                      {normalizeRating(spotlightReview.rating).formattedLabel}
                    </span>
                  )}
                </div>

                <h3 className="text-2xl font-black text-text-primary tracking-tight mb-3">
                  {spotlightReview.film?.slug ? (
                    <Link to={`/films/${spotlightReview.film.slug}`} className="hover:text-brand transition-colors">
                      {formatFilmTitle(spotlightReview.film.title)}
                    </Link>
                  ) : spotlightReview.play?.slug ? (
                    <Link to={`/plays/${spotlightReview.play.slug}`} className="hover:text-brand transition-colors">
                      {spotlightReview.play.title}
                    </Link>
                  ) : (
                    spotlightReview.film?.title || spotlightReview.play?.title || 'Featured Work'
                  )}
                </h3>

                <blockquote className="text-base sm:text-lg italic text-text-primary leading-relaxed font-serif bg-surface/50 border-l-4 border-brand px-4 py-3 rounded-r-xl mb-4">
                  "{spotlightReview.quote}"
                </blockquote>

                <div className="flex flex-wrap items-center justify-center md:justify-start gap-4 text-xs">
                  {spotlightReview.review_url && (
                    <a
                      href={spotlightReview.review_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 font-bold text-brand hover:underline"
                    >
                      <span>Read full original article on {critic.publication || 'outlet'}</span>
                      <Icon icon="solar:arrow-right-up-linear" className="w-4 h-4" />
                    </a>
                  )}

                  {spotlightReview.film?.slug && (
                    <Link
                      to={`/films/${spotlightReview.film.slug}`}
                      className="inline-flex items-center gap-1 text-text-muted hover:text-text-primary transition-colors"
                    >
                      <Icon icon="solar:clapperboard-linear" className="w-4 h-4" />
                      <span>View Film details on MuviDB</span>
                    </Link>
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ─── 4. REVIEWS ARCHIVE (METACRITIC EDITORIAL FEED) ─── */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-14">
        
        {/* Section Header & Toolbar */}
        <div className="flex flex-col gap-5 mb-8">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-2 text-brand text-xs font-black uppercase tracking-widest mb-1.5">
                <Icon icon="solar:documents-minimalistic-bold" />
                Critical Catalogue
              </div>
              <h2 className="text-2xl sm:text-3xl font-heading font-black text-text-primary tracking-tight">
                Reviews by {formatPersonName(critic.name)}
              </h2>
              <p className="text-xs text-text-muted mt-1">
                Showing {filteredReviews.length} of {reviews.length} total reviews
                {stats.sourceCount > 0 ? ` · ${stats.sourceCount} linked external articles` : ''}
              </p>
            </div>

            {/* View Mode Toggle: List (Metacritic) vs Grid */}
            <div className="flex items-center gap-2 self-start md:self-auto bg-surface border border-border rounded-xl p-1 shadow-sm">
              <button
                type="button"
                onClick={() => setViewMode('list')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  viewMode === 'list'
                    ? 'bg-brand text-black shadow-sm'
                    : 'text-text-muted hover:text-text-primary'
                }`}
                title="Metacritic Editorial List View"
              >
                <Icon icon="solar:list-bold" className="w-4 h-4" />
                <span>Editorial List</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('grid')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  viewMode === 'grid'
                    ? 'bg-brand text-black shadow-sm'
                    : 'text-text-muted hover:text-text-primary'
                }`}
                title="Poster Grid View"
              >
                <Icon icon="solar:widget-4-bold" className="w-4 h-4" />
                <span>Card Grid</span>
              </button>
            </div>
          </div>

          {/* Interactive Filter & Search Controls */}
          <div className="bg-surface border border-border rounded-2xl p-4 shadow-sm space-y-4">
            
            {/* Sentiment Quick Tabs */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar text-xs font-bold">
              <button
                type="button"
                onClick={() => setSentimentFilter('all')}
                className={`px-3 py-1.5 rounded-lg border transition-all shrink-0 cursor-pointer ${
                  sentimentFilter === 'all'
                    ? 'bg-text-primary text-bg border-text-primary'
                    : 'bg-surface-2 border-border text-text-muted hover:text-text-primary'
                }`}
              >
                All Reviews ({reviews.length})
              </button>
              <button
                type="button"
                onClick={() => setSentimentFilter('positive')}
                className={`px-3 py-1.5 rounded-lg border transition-all shrink-0 flex items-center gap-1.5 cursor-pointer ${
                  sentimentFilter === 'positive'
                    ? 'bg-emerald-600 text-white border-emerald-500'
                    : 'bg-surface-2 border-border text-emerald-400 hover:border-emerald-500/40'
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                Positive ({stats.positive})
              </button>
              <button
                type="button"
                onClick={() => setSentimentFilter('mixed')}
                className={`px-3 py-1.5 rounded-lg border transition-all shrink-0 flex items-center gap-1.5 cursor-pointer ${
                  sentimentFilter === 'mixed'
                    ? 'bg-amber-500 text-black border-amber-400'
                    : 'bg-surface-2 border-border text-amber-400 hover:border-amber-500/40'
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-amber-400" />
                Mixed ({stats.mixed})
              </button>
              <button
                type="button"
                onClick={() => setSentimentFilter('negative')}
                className={`px-3 py-1.5 rounded-lg border transition-all shrink-0 flex items-center gap-1.5 cursor-pointer ${
                  sentimentFilter === 'negative'
                    ? 'bg-rose-600 text-white border-rose-500'
                    : 'bg-surface-2 border-border text-rose-400 hover:border-rose-500/40'
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-rose-400" />
                Negative ({stats.negative})
              </button>
            </div>

            {/* Search, Year, Status & Sorting Bar */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-[1fr_auto_auto_auto] gap-3">
              <div className="relative">
                <Icon icon="solar:magnifer-linear" className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
                <input
                  type="search"
                  value={reviewSearch}
                  onChange={(e) => setReviewSearch(e.target.value)}
                  placeholder="Search film title, quote, or genre..."
                  className="w-full bg-bg border border-border rounded-xl pl-10 pr-3 py-2.5 text-xs text-text-primary placeholder-text-muted focus:outline-none focus:border-brand transition-colors"
                />
              </div>

              <select
                value={yearFilter}
                onChange={(e) => setYearFilter(e.target.value)}
                className="bg-bg border border-border rounded-xl px-3 py-2.5 text-xs font-semibold text-text-primary focus:outline-none focus:border-brand"
                aria-label="Filter by release year"
              >
                <option value="all">All release years</option>
                {yearOptions.map((year) => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </select>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="bg-bg border border-border rounded-xl px-3 py-2.5 text-xs font-semibold text-text-primary focus:outline-none focus:border-brand"
                aria-label="Filter by review type"
              >
                <option value="all">All review types</option>
                <option value="source">With external article link</option>
                <option value="rated">Scored only</option>
                <option value="unrated">Unscored quotes</option>
              </select>

              <select
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value)}
                className="bg-bg border border-border rounded-xl px-3 py-2.5 text-xs font-semibold text-text-primary focus:outline-none focus:border-brand"
                aria-label="Sort reviews"
              >
                <option value="newest">Newest review added</option>
                <option value="rating-desc">Rating: Highest first</option>
                <option value="rating-asc">Rating: Lowest first</option>
                <option value="year-desc">Film release year</option>
                <option value="title">Film title A-Z</option>
              </select>
            </div>

          </div>
        </div>

        {/* ─── REVIEWS RENDERING ─── */}
        {reviews.length === 0 ? (
          <div className="bg-surface border border-border rounded-2xl p-16 text-center">
            <Icon icon="solar:document-text-line-duotone" className="w-16 h-16 text-text-muted mx-auto mb-3 opacity-40" />
            <p className="text-lg font-bold text-text-primary mb-1">No reviews linked yet</p>
            <p className="text-xs text-text-muted">Published reviews from this critic will be displayed here.</p>
          </div>
        ) : filteredReviews.length === 0 ? (
          <div className="bg-surface border border-border rounded-2xl p-16 text-center">
            <Icon icon="solar:filter-bold-duotone" className="w-16 h-16 text-text-muted mx-auto mb-3 opacity-40" />
            <p className="text-lg font-bold text-text-primary mb-1">No reviews match your filters</p>
            <p className="text-xs text-text-muted mb-5">Try changing your sentiment, year, or keyword query.</p>
            <button
              type="button"
              onClick={clearFilters}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-brand text-black text-xs font-bold hover:bg-brand-hover transition-colors cursor-pointer"
            >
              <Icon icon="solar:restart-bold" className="w-4 h-4" />
              Reset all filters
            </button>
          </div>
        ) : viewMode === 'list' ? (
          /* METACRITIC EDITORIAL LIST VIEW */
          <div className="space-y-4">
            {filteredReviews.map((rev) => {
              const film = rev.film || rev.play || {};
              const normalized = normalizeRating(rev.rating);
              const filmUrl = rev.film?.slug
                ? `/films/${rev.film.slug}`
                : rev.play?.slug
                ? `/plays/${rev.play.slug}`
                : null;

              return (
                <article
                  key={rev.id}
                  className="group bg-surface hover:bg-surface-2/70 border border-border hover:border-brand/40 rounded-2xl p-4 sm:p-6 transition-all duration-200 shadow-sm flex flex-col md:flex-row items-start gap-5"
                >
                  {/* Left: Poster */}
                  <div className="w-20 h-28 sm:w-24 sm:h-36 shrink-0 rounded-xl overflow-hidden bg-black border border-border shadow-md">
                    {filmUrl ? (
                      <Link to={filmUrl} className="block w-full h-full">
                        <ImageWithFallback
                          src={film.poster_url}
                          alt={film.title}
                          fallbackType="film"
                          name={film.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          loading="lazy"
                        />
                      </Link>
                    ) : (
                      <ImageWithFallback
                        src={film.poster_url}
                        alt={film.title}
                        fallbackType="film"
                        name={film.title}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    )}
                  </div>

                  {/* Center: Details & Editorial Quote */}
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-text-muted mb-1.5">
                      {film.year && (
                        <span className="font-bold text-text-primary bg-surface-2 px-2 py-0.5 rounded-md border border-border">
                          {film.year}
                        </span>
                      )}
                      {Array.isArray(film.genres) && film.genres.length > 0 && (
                        <span className="text-text-muted">
                          {film.genres.slice(0, 3).join(' • ')}
                        </span>
                      )}
                      {rev.created_at && (
                        <span className="text-[11px] text-text-muted/60">
                          Reviewed {new Date(rev.created_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                        </span>
                      )}
                    </div>

                    <h3 className="text-xl font-heading font-black text-text-primary tracking-tight leading-snug group-hover:text-brand transition-colors">
                      {filmUrl ? (
                        <Link to={filmUrl}>{formatFilmTitle(film.title || 'Untitled')}</Link>
                      ) : (
                        formatFilmTitle(film.title || 'Untitled')
                      )}
                    </h3>

                    {/* Metacritic Quote Bubble */}
                    <div className="mt-3 relative">
                      <p className="text-sm text-text-secondary italic leading-relaxed pl-3 border-l-2 border-brand/60">
                        "{rev.quote}"
                      </p>
                    </div>

                    <div className="mt-4 flex flex-wrap items-center gap-3 text-xs">
                      {rev.review_url && (
                        <a
                          href={rev.review_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 font-bold text-brand hover:underline"
                        >
                          <span>Full review on {critic.publication || 'source'}</span>
                          <Icon icon="solar:arrow-right-up-linear" className="w-3.5 h-3.5" />
                        </a>
                      )}

                      {filmUrl && (
                        <Link
                          to={filmUrl}
                          className="text-text-muted hover:text-text-primary inline-flex items-center gap-1 transition-colors font-medium"
                        >
                          <span>View film info</span>
                          <Icon icon="solar:alt-arrow-right-linear" className="w-3.5 h-3.5" />
                        </Link>
                      )}
                    </div>
                  </div>

                  {/* Right: Metascore Stamp Box */}
                  <div className="self-stretch md:self-start flex md:flex-col items-center justify-between md:justify-center gap-2 border-t md:border-t-0 md:border-l border-border/70 pt-3 md:pt-0 md:pl-5 shrink-0 min-w-[100px]">
                    {normalized ? (
                      <div className="flex flex-col items-center">
                        <div
                          className={`w-14 h-14 rounded-xl flex flex-col items-center justify-center font-heading font-black shadow-md border ${normalized.badgeClasses}`}
                        >
                          <span className="text-xl leading-none">{normalized.score100}</span>
                          <span className="text-[8px] uppercase tracking-wider font-sans opacity-90 mt-0.5">Score</span>
                        </div>
                        <span className="text-[10px] font-bold text-text-muted mt-1.5">
                          {normalized.formattedLabel}
                        </span>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center">
                        <div className="w-14 h-14 rounded-xl flex flex-col items-center justify-center font-heading font-black bg-surface-2 text-text-muted border border-border">
                          <Icon icon="solar:notes-bold" className="w-6 h-6 opacity-60" />
                        </div>
                        <span className="text-[10px] font-semibold text-text-muted mt-1">Unscored</span>
                      </div>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          /* CARD GRID VIEW */
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 sm:gap-6">
            {filteredReviews.map((rev) => {
              const film = rev.film || rev.play || {};
              const normalized = normalizeRating(rev.rating);
              const filmUrl = rev.film?.slug
                ? `/films/${rev.film.slug}`
                : rev.play?.slug
                ? `/plays/${rev.play.slug}`
                : null;

              return (
                <div
                  key={rev.id}
                  className="group bg-surface border border-border hover:border-brand/40 rounded-xl overflow-hidden flex flex-col justify-between shadow-sm transition-all hover:-translate-y-1"
                >
                  <div className="relative aspect-[2/3] w-full bg-black overflow-hidden">
                    {filmUrl ? (
                      <Link to={filmUrl} className="block w-full h-full">
                        <ImageWithFallback
                          src={film.poster_url}
                          alt={film.title}
                          fallbackType="film"
                          name={film.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          loading="lazy"
                        />
                      </Link>
                    ) : (
                      <ImageWithFallback
                        src={film.poster_url}
                        alt={film.title}
                        fallbackType="film"
                        name={film.title}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    )}

                    {/* Metascore Pill Overlaid */}
                    {normalized && (
                      <div className="absolute top-2.5 right-2.5 shadow-lg">
                        <span className={`px-2 py-1 rounded-md text-xs font-black shadow-md border ${normalized.badgeClasses}`}>
                          {normalized.score100}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="p-3.5 flex flex-col justify-between flex-1">
                    <div>
                      <h4 className="font-bold text-text-primary text-xs sm:text-sm line-clamp-1 group-hover:text-brand transition-colors mb-1">
                        {filmUrl ? (
                          <Link to={filmUrl}>{formatFilmTitle(film.title || 'Untitled')}</Link>
                        ) : (
                          formatFilmTitle(film.title || 'Untitled')
                        )}
                      </h4>
                      <p className="text-[10px] text-text-muted font-semibold mb-2">
                        {film.year}
                      </p>
                      <p className="text-[11px] text-text-muted italic line-clamp-2 leading-snug">
                        "{rev.quote}"
                      </p>
                    </div>

                    <div className="mt-3 pt-2.5 border-t border-border/50 flex items-center justify-between text-[11px]">
                      {rev.review_url ? (
                        <a
                          href={rev.review_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-brand font-bold hover:underline inline-flex items-center gap-1"
                        >
                          <span>Review</span>
                          <Icon icon="solar:arrow-right-up-linear" className="text-[10px]" />
                        </a>
                      ) : (
                        <span className="text-text-muted text-[10px]">Quote archived</span>
                      )}

                      {filmUrl && (
                        <Link to={filmUrl} className="text-text-muted hover:text-text-primary text-[10px]">
                          Details →
                        </Link>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

      </section>

      {/* ─── 5. PUBLICATION & CRITICAL BIO FOOTER SECTION ─── */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-16">
        <div className="bg-surface/50 border border-border rounded-2xl p-6 sm:p-8 flex flex-col md:flex-row items-center justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-brand mb-1">
              <Icon icon="solar:buildings-bold" />
              Accredited Publication
            </div>
            <h3 className="text-xl font-bold text-text-primary">
              {critic.publication || 'Independent Cultural Journal'}
            </h3>
            <p className="text-xs text-text-muted mt-1 max-w-2xl leading-relaxed">
              Reviews syndicated on MuviDB are curated under editorial standards prioritizing narrative depth, cinematic craftsmanship, and African film scholarship.
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {critic.profile_url && (
              <a
                href={critic.profile_url}
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2 rounded-xl bg-surface border border-border hover:border-brand text-xs font-bold text-text-primary hover:text-brand transition-colors inline-flex items-center gap-2"
              >
                <span>Visit Publication Website</span>
                <Icon icon="solar:arrow-right-up-linear" className="w-3.5 h-3.5" />
              </a>
            )}

            <Link
              to="/critics"
              className="px-4 py-2 rounded-xl bg-surface-2 border border-border text-xs font-bold text-text-muted hover:text-text-primary transition-colors"
            >
              All Critics Directory
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
