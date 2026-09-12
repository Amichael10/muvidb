import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router';
import { supabase } from '../lib/supabase';
import { Icon } from '@iconify/react';
import { toTitleCase, toSentenceCase, formatFilmTitle } from '../utils/format';
import ImageWithFallback from '../components/ui/ImageWithFallback';
import SEO from '../components/SEO';

/**
 * Formats monetary amounts into concise Nigerian Naira (₦) or foreign currency.
 */
function formatMoney(num, currency = 'NGN') {
  if (!num || num <= 0) return null;
  const sym = currency === 'USD' ? '$' : '₦';
  if (num >= 1_000_000_000) return `${sym}${(num / 1_000_000_000).toFixed(2)}B`;
  if (num >= 1_000_000) return `${sym}${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000) return `${sym}${(num / 1_000).toFixed(0)}K`;
  return `${sym}${Number(num).toLocaleString()}`;
}

/**
 * Formats view counts into concise digital reach strings (e.g. 24.5M, 850K).
 */
function formatViews(num) {
  if (!num || num <= 0) return null;
  if (num >= 1_000_000_000) return `${(num / 1_000_000_000).toFixed(2)}B`;
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(0)}K`;
  return Number(num).toLocaleString();
}

export default function CompanyDetail() {
  const { id, slug: slugParam } = useParams();
  const slug = slugParam || id;
  const navigate = useNavigate();

  const [company, setCompany] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const [isBioExpanded, setIsBioExpanded] = useState(false);

  // View mode: 'ledger' (financial/commercial table) vs 'grid' (poster cards)
  const [viewMode, setViewMode] = useState('ledger');
  const [activeTab, setActiveTab] = useState('all'); // 'all', 'box_office', 'youtube', 'production', 'distribution', 'top'
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('box_office'); // 'box_office', 'views', 'year-desc', 'rating-desc', 'title'
  const [visibleCount, setVisibleCount] = useState(20);

  useEffect(() => {
    fetchCompany();
  }, [slug]);

  const fetchCompany = async () => {
    setLoading(true);
    setError(null);

    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(slug);

    // 1. Fetch Company
    const { data: comp, error: compErr } = await supabase
      .from('companies')
      .select('*')
      .eq(isUUID ? 'id' : 'slug', slug)
      .maybeSingle();

    if (compErr || !comp) {
      setError('Company not found');
      setLoading(false);
      return;
    }

    // 2. Fetch Films linked via film_companies OR production_company_id
    const { data: fcLinks } = await supabase
      .from('film_companies')
      .select(`
        role,
        films (
          id,
          title,
          year,
          poster_url,
          backdrop_url,
          liked_percent,
          average_rating,
          slug,
          box_office_domestic,
          box_office_worldwide,
          box_office_opening_weekend,
          box_office_currency,
          budget,
          view_count,
          release_type,
          film_genres (
            genres (
              name
            )
          )
        )
      `)
      .eq('company_id', comp.id);

    const { data: directProdFilms } = await supabase
      .from('films')
      .select(`
        id,
        title,
        year,
        poster_url,
        backdrop_url,
        liked_percent,
        average_rating,
        slug,
        box_office_domestic,
        box_office_worldwide,
        box_office_opening_weekend,
        box_office_currency,
        budget,
        view_count,
        release_type,
        film_genres (
          genres (
            name
          )
        )
      `)
      .eq('production_company_id', comp.id);

    // Merge film entries with roles
    const filmMap = new Map();

    (directProdFilms || []).forEach((f) => {
      if (f && f.id) {
        filmMap.set(f.id, { film: f, role: 'production' });
      }
    });

    (fcLinks || []).forEach((link) => {
      if (link.films && link.films.id) {
        const existing = filmMap.get(link.films.id);
        filmMap.set(link.films.id, {
          film: link.films,
          role: link.role || existing?.role || 'production',
        });
      }
    });

    comp.filmsWithRole = Array.from(filmMap.values());
    setCompany(comp);
    setLoading(false);
  };

  const allFilmsWithRole = useMemo(() => {
    return company?.filmsWithRole || [];
  }, [company]);

  // Studio Performance Scorecard & Financial Analytics
  const studioMetrics = useMemo(() => {
    let totalBoxOffice = 0;
    let totalViews = 0;
    let totalRatings = 0;
    let sumRatings = 0;
    let productionCount = 0;
    let distributionCount = 0;
    let boxOfficeReleasesCount = 0;
    let youtubeReleasesCount = 0;

    let highestGrossing = null;
    let maxGross = 0;

    let mostViewed = null;
    let maxViews = 0;

    allFilmsWithRole.forEach((item) => {
      const f = item.film;
      if (!f) return;

      const role = (item.role || '').toLowerCase();
      if (role.includes('distribut')) distributionCount += 1;
      else productionCount += 1;

      const bo = Number(f.box_office_domestic || f.box_office_worldwide || 0);
      if (bo > 0) {
        totalBoxOffice += bo;
        boxOfficeReleasesCount += 1;
        if (bo > maxGross) {
          maxGross = bo;
          highestGrossing = { film: f, gross: bo, role: item.role };
        }
      }

      const vc = Number(f.view_count || 0);
      if (vc > 0) {
        totalViews += vc;
        youtubeReleasesCount += 1;
        if (vc > maxViews) {
          maxViews = vc;
          mostViewed = { film: f, views: vc, role: item.role };
        }
      }

      const rating = f.liked_percent != null ? f.liked_percent : f.average_rating ? f.average_rating * 10 : null;
      if (rating != null) {
        sumRatings += rating;
        totalRatings += 1;
      }
    });

    const avgRating = totalRatings > 0 ? Math.round(sumRatings / totalRatings) : null;
    const avgBoxOffice = boxOfficeReleasesCount > 0 ? Math.round(totalBoxOffice / boxOfficeReleasesCount) : 0;

    // Top commercial blockbusters ranked (top 4)
    const rankedBlockbusters = [...allFilmsWithRole]
      .filter((item) => Number(item.film?.box_office_domestic || item.film?.box_office_worldwide || 0) > 0)
      .sort((a, b) => {
        const grossA = Number(a.film?.box_office_domestic || a.film?.box_office_worldwide || 0);
        const grossB = Number(b.film?.box_office_domestic || b.film?.box_office_worldwide || 0);
        return grossB - grossA;
      })
      .slice(0, 4);

    return {
      totalFilms: allFilmsWithRole.length,
      totalBoxOffice,
      totalViews,
      avgBoxOffice,
      avgRating,
      productionCount,
      distributionCount,
      boxOfficeReleasesCount,
      youtubeReleasesCount,
      highestGrossing,
      mostViewed,
      rankedBlockbusters,
    };
  }, [allFilmsWithRole]);

  // Extract posters for Hero Background Collage
  const movieCollagePosters = useMemo(() => {
    return allFilmsWithRole
      .map((item) => item.film?.poster_url)
      .filter(Boolean)
      .slice(0, 12);
  }, [allFilmsWithRole]);

  // Filter & Search Logic
  const filteredFilms = useMemo(() => {
    let result = [...allFilmsWithRole];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter((item) => {
        const title = (item.film?.title || '').toLowerCase();
        const genre = (item.film?.film_genres?.[0]?.genres?.name || '').toLowerCase();
        return title.includes(q) || genre.includes(q);
      });
    }

    if (activeTab === 'box_office') {
      result = result.filter((item) => Number(item.film?.box_office_domestic || item.film?.box_office_worldwide || 0) > 0);
    } else if (activeTab === 'youtube') {
      result = result.filter((item) => Number(item.film?.view_count || 0) > 0);
    } else if (activeTab === 'production') {
      result = result.filter((item) => {
        const r = (item.role || '').toLowerCase();
        return r.includes('production') || r.includes('co_prod');
      });
    } else if (activeTab === 'distribution') {
      result = result.filter((item) => {
        const r = (item.role || '').toLowerCase();
        return r.includes('distribut');
      });
    } else if (activeTab === 'top') {
      result = result.filter((item) => (item.film?.liked_percent || 0) >= 70);
    }

    // Sorting
    result.sort((a, b) => {
      const grossA = Number(a.film?.box_office_domestic || a.film?.box_office_worldwide || 0);
      const grossB = Number(b.film?.box_office_domestic || b.film?.box_office_worldwide || 0);

      const viewsA = Number(a.film?.view_count || 0);
      const viewsB = Number(b.film?.view_count || 0);

      if (sortBy === 'box_office') {
        return grossB - grossA;
      }
      if (sortBy === 'views') {
        return viewsB - viewsA;
      }
      if (sortBy === 'year-desc') {
        return (b.film?.year || 0) - (a.film?.year || 0);
      }
      if (sortBy === 'rating-desc') {
        return (b.film?.liked_percent || 0) - (a.film?.liked_percent || 0);
      }
      return String(a.film?.title || '').localeCompare(String(b.film?.title || ''));
    });

    return result;
  }, [allFilmsWithRole, activeTab, searchQuery, sortBy]);

  const displayedFilms = useMemo(() => {
    return filteredFilms.slice(0, visibleCount);
  }, [filteredFilms, visibleCount]);

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

  if (error || !company) {
    return (
      <div className="min-h-screen bg-bg pt-20 flex items-center justify-center text-center p-6">
        <div>
          <Icon icon="solar:buildings-linear" className="w-16 h-16 text-text-muted mx-auto mb-3 opacity-40" />
          <p className="text-text-primary text-xl font-bold mb-4">{error || 'Studio Not Found'}</p>
          <button
            type="button"
            onClick={() => navigate('/companies')}
            className="bg-brand text-black px-6 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider hover:bg-brand-hover transition-colors"
          >
            Back to Studios Directory
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg text-text-primary pb-24 selection:bg-brand/20">
      <SEO
        title={`${toTitleCase(company.name)} · Studio Metrics, Box Office & Filmography | MuviDB`}
        description={
          company.description ||
          `Explore complete studio metrics, commercial box office earnings, YouTube viewership, and full catalogue for ${company.name} on MuviDB.`
        }
      />


      {/* ─── 1. STUDIO MASTHEAD / HERO ─── */}
      <header className="relative border-b border-border bg-gradient-to-b from-surface to-bg overflow-hidden">
        {/* Dynamic Movie Collage Background */}
        {movieCollagePosters.length > 0 ? (
          <div className="absolute inset-0 overflow-hidden opacity-20 filter blur-[1px] scale-105 pointer-events-none">
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2 w-full h-full">
              {movieCollagePosters.map((url, idx) => (
                <div key={idx} className="relative aspect-[2/3] overflow-hidden rounded bg-black">
                  <img src={url} alt="" className="w-full h-full object-cover" />
                </div>
              ))}
            </div>
            <div className="absolute inset-0 bg-gradient-to-t from-bg via-bg/90 to-bg/50" />
            <div className="absolute inset-0 bg-gradient-to-r from-bg via-bg/80 to-transparent" />
          </div>
        ) : (
          <div className="absolute inset-0 grid-bg opacity-15 pointer-events-none" />
        )}

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-10 pb-12 relative z-10">
          <div className="flex flex-col lg:flex-row items-start gap-8 lg:gap-10">
            
            {/* Studio Logo */}
            <div className="flex-shrink-0 mx-auto lg:mx-0">
              <div className="w-28 h-28 sm:w-36 sm:h-36 rounded-2xl border-2 border-border/80 overflow-hidden bg-black shadow-2xl p-1 relative group">
                <ImageWithFallback
                  src={company.logo_url}
                  alt={toTitleCase(company.name)}
                  fallbackType="company"
                  name={toTitleCase(company.name)}
                  className="w-full h-full object-cover rounded-xl"
                  loading="eager"
                />
              </div>
            </div>

            {/* Studio Identity, Meta & Description */}
            <div className="flex-1 text-center lg:text-left min-w-0">
              <div className="flex flex-wrap items-center justify-center lg:justify-start gap-2.5 mb-2">
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-brand/10 border border-brand/25 text-brand text-[10px] font-black uppercase tracking-wider">
                  <Icon icon="solar:buildings-2-bold" className="w-3 h-3" />
                  Verified Nollywood Studio
                </span>

                {company.company_type && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-surface-2 border border-border text-text-secondary text-[11px] font-bold capitalize">
                    {company.company_type}
                  </span>
                )}

                {company.headquarters && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-surface-2 border border-border text-text-muted text-[11px] font-semibold">
                    📍 {company.headquarters}
                  </span>
                )}
              </div>

              <h1 className="text-3xl sm:text-5xl font-heading font-black text-text-primary tracking-tight leading-tight mb-2">
                {toTitleCase(company.name)}
              </h1>

              <div className="flex flex-wrap items-center justify-center lg:justify-start gap-3 text-xs text-text-muted font-bold mb-4">
                {company.founded_year && <span>Est. {company.founded_year}</span>}
                {company.founded_year && <span>•</span>}
                <span>{allFilmsWithRole.length} Catalog Releases</span>
                {studioMetrics.productionCount > 0 && <span>({studioMetrics.productionCount} Produced)</span>}
                {studioMetrics.distributionCount > 0 && <span>({studioMetrics.distributionCount} Distributed)</span>}
              </div>

              {company.description && (
                <div className="text-sm text-text-muted leading-relaxed max-w-3xl mb-6">
                  <p>
                    {isBioExpanded || company.description.length <= 160
                      ? toSentenceCase(company.description)
                      : `${toSentenceCase(company.description).slice(0, 160)}...`}
                    {company.description.length > 160 && (
                      <button
                        type="button"
                        onClick={() => setIsBioExpanded(!isBioExpanded)}
                        className="text-brand hover:underline font-bold ml-2 transition-colors cursor-pointer"
                      >
                        {isBioExpanded ? 'Show less' : 'Read more'}
                      </button>
                    )}
                  </p>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center justify-center lg:justify-start gap-3 text-xs font-semibold">
                {company.website && (
                  <a
                    href={company.website.startsWith('http') ? company.website : `https://${company.website}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 bg-brand hover:bg-brand-hover text-black font-bold px-5 py-2.5 rounded-xl transition-all shadow-md cursor-pointer"
                  >
                    <Icon icon="solar:global-bold" className="text-sm" />
                    <span>Official Studio Website</span>
                    <Icon icon="solar:arrow-right-up-linear" className="text-xs" />
                  </a>
                )}

                <button
                  type="button"
                  onClick={handleShare}
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-surface border border-border hover:border-brand text-text-primary text-xs font-bold transition-colors cursor-pointer"
                >
                  <Icon icon={copiedLink ? 'solar:check-circle-bold' : 'solar:share-linear'} className="text-sm text-brand" />
                  <span>{copiedLink ? 'Link Copied!' : 'Share Studio Profile'}</span>
                </button>
              </div>
            </div>

          </div>
        </div>
      </header>

      {/* ─── 2. STUDIO PERFORMANCE SCORECARD & FINANCIAL METRICS ─── */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-6 relative z-20">
        <div className="bg-surface border border-border rounded-2xl p-6 shadow-2xl backdrop-blur-md">
          <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            
            {/* Box Office Metric */}
            <div className="bg-surface-2/60 border border-border/80 rounded-xl p-4 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-wider text-text-muted mb-1">
                  <span>Tracked Box Office</span>
                  <Icon icon="solar:ticket-bold" className="text-amber-400 w-4 h-4" />
                </div>
                <p className="text-2xl sm:text-3xl font-heading font-black text-amber-400 tracking-tight">
                  {formatMoney(studioMetrics.totalBoxOffice) || '–'}
                </p>
              </div>
              <span className="text-[11px] text-text-muted mt-2 font-medium">
                Across {studioMetrics.boxOfficeReleasesCount} theatrical releases
              </span>
            </div>

            {/* YouTube Views Metric */}
            <div className="bg-surface-2/60 border border-border/80 rounded-xl p-4 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-wider text-text-muted mb-1">
                  <span>YouTube Views</span>
                  <Icon icon="solar:play-circle-bold" className="text-red-400 w-4 h-4" />
                </div>
                <p className="text-2xl sm:text-3xl font-heading font-black text-red-400 tracking-tight">
                  {formatViews(studioMetrics.totalViews) || '–'}
                </p>
              </div>
              <span className="text-[11px] text-text-muted mt-2 font-medium">
                Across {studioMetrics.youtubeReleasesCount} digital releases
              </span>
            </div>

            {/* Average Gross per Theatrical Release */}
            <div className="bg-surface-2/60 border border-border/80 rounded-xl p-4 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-wider text-text-muted mb-1">
                  <span>Avg Box Office / Film</span>
                  <Icon icon="solar:chart-2-bold" className="text-brand w-4 h-4" />
                </div>
                <p className="text-2xl sm:text-3xl font-heading font-black text-text-primary tracking-tight">
                  {formatMoney(studioMetrics.avgBoxOffice) || '–'}
                </p>
              </div>
              <span className="text-[11px] text-text-muted mt-2 font-medium">
                Commercial output density
              </span>
            </div>

            {/* Audience Approval Index */}
            <div className="bg-surface-2/60 border border-border/80 rounded-xl p-4 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-wider text-text-muted mb-1">
                  <span>Audience Score</span>
                  <Icon icon="solar:star-bold" className="text-emerald-400 w-4 h-4" />
                </div>
                <p className="text-2xl sm:text-3xl font-heading font-black text-emerald-400 tracking-tight">
                  {studioMetrics.avgRating != null ? `${studioMetrics.avgRating}%` : '–'}
                </p>
              </div>
              <span className="text-[11px] text-text-muted mt-2 font-medium">
                {studioMetrics.avgRating >= 70 ? 'Favorable audience reception' : 'Based on catalog ratings'}
              </span>
            </div>

          </div>

          {/* Quick Watermark Callouts */}
          {(studioMetrics.highestGrossing || studioMetrics.mostViewed) && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-5 pt-5 border-t border-border/60">
              {studioMetrics.highestGrossing && (
                <div className="flex items-center gap-3.5 p-3 rounded-xl bg-surface-2/40 border border-border">
                  <div className="w-12 h-16 rounded-lg overflow-hidden bg-black shrink-0 border border-border">
                    <ImageWithFallback
                      src={studioMetrics.highestGrossing.film?.poster_url}
                      alt={studioMetrics.highestGrossing.film?.title}
                      fallbackType="film"
                      name={studioMetrics.highestGrossing.film?.title}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="text-[10px] font-black uppercase tracking-wider text-amber-400 flex items-center gap-1">
                      <Icon icon="solar:cup-star-bold" className="w-3.5 h-3.5" />
                      Highest Grossing Release
                    </span>
                    <h4 className="text-sm font-bold text-text-primary truncate">
                      {formatFilmTitle(studioMetrics.highestGrossing.film?.title)} ({studioMetrics.highestGrossing.film?.year})
                    </h4>
                    <span className="text-xs text-text-muted capitalize">
                      {studioMetrics.highestGrossing.role}
                    </span>
                  </div>
                  <span className="px-3 py-1 rounded-lg bg-amber-500 text-black font-black text-xs shrink-0">
                    {formatMoney(studioMetrics.highestGrossing.gross)}
                  </span>
                </div>
              )}

              {studioMetrics.mostViewed && (
                <div className="flex items-center gap-3.5 p-3 rounded-xl bg-surface-2/40 border border-border">
                  <div className="w-12 h-16 rounded-lg overflow-hidden bg-black shrink-0 border border-border">
                    <ImageWithFallback
                      src={studioMetrics.mostViewed.film?.poster_url}
                      alt={studioMetrics.mostViewed.film?.title}
                      fallbackType="film"
                      name={studioMetrics.mostViewed.film?.title}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="text-[10px] font-black uppercase tracking-wider text-red-400 flex items-center gap-1">
                      <Icon icon="solar:play-circle-bold" className="w-3.5 h-3.5" />
                      Most Viewed YouTube Release
                    </span>
                    <h4 className="text-sm font-bold text-text-primary truncate">
                      {formatFilmTitle(studioMetrics.mostViewed.film?.title)} ({studioMetrics.mostViewed.film?.year})
                    </h4>
                    <span className="text-xs text-text-muted capitalize">
                      {studioMetrics.mostViewed.role}
                    </span>
                  </div>
                  <span className="px-3 py-1 rounded-lg bg-red-600 text-white font-black text-xs shrink-0">
                    {formatViews(studioMetrics.mostViewed.views)} views
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
      </section>

      {/* ─── 3. TOP COMMERCIAL BLOCKBUSTERS (HALL OF FAME) ─── */}
      {studioMetrics.rankedBlockbusters.length > 0 && (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-12">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="inline-flex items-center gap-1.5 text-amber-400 text-xs font-black uppercase tracking-widest mb-1">
                <Icon icon="solar:cup-bold" className="w-4 h-4" />
                Box Office Hall of Fame
              </div>
              <h2 className="text-2xl font-heading font-black text-text-primary tracking-tight">
                Top Commercial Blockbusters
              </h2>
            </div>
            <span className="text-xs text-text-muted font-semibold">Theatrical Milestones</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {studioMetrics.rankedBlockbusters.map((item, idx) => {
              const f = item.film;
              const gross = Number(f.box_office_domestic || f.box_office_worldwide || 0);

              return (
                <Link
                  key={f.id}
                  to={`/films/${f.slug || f.id}`}
                  className="group relative bg-surface border border-border hover:border-brand/50 rounded-2xl p-4 transition-all duration-300 shadow-sm hover:shadow-xl hover:-translate-y-1 flex flex-col justify-between"
                >
                  <div className="relative aspect-[2/3] w-full rounded-xl overflow-hidden bg-black mb-3.5 shadow-md">
                    <ImageWithFallback
                      src={f.poster_url}
                      alt={f.title}
                      fallbackType="film"
                      name={f.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />

                    {/* Rank Badge */}
                    <div className="absolute top-2 left-2 bg-black/80 backdrop-blur-md border border-white/20 text-white font-black text-xs px-2.5 py-1 rounded-lg shadow-lg">
                      #{idx + 1}
                    </div>

                    {/* Gross Badge */}
                    <div className="absolute bottom-2 right-2 bg-amber-500 text-black font-black text-xs px-2.5 py-1 rounded-lg shadow-lg">
                      {formatMoney(gross)}
                    </div>
                  </div>

                  <div>
                    <h3 className="font-heading font-black text-sm text-text-primary group-hover:text-brand transition-colors line-clamp-1 mb-1">
                      {formatFilmTitle(f.title)}
                    </h3>
                    <div className="flex items-center justify-between text-xs text-text-muted font-semibold">
                      <span>{f.year || 'N/A'}</span>
                      <span className="capitalize text-[11px] text-text-secondary bg-surface-2 px-2 py-0.5 rounded-md border border-border">
                        {item.role}
                      </span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {/* ─── 4. MAIN RELEASES CATALOGUE & COMMERCIAL LEDGER ─── */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-14">
        
        {/* Header & View Mode Switcher */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6">
          <div>
            <div className="inline-flex items-center gap-1.5 text-brand text-xs font-black uppercase tracking-widest mb-1">
              <Icon icon="solar:clapperboard-play-bold" />
              Catalogue & Filmography
            </div>
            <h2 className="text-2xl sm:text-3xl font-heading font-black text-text-primary tracking-tight">
              Releases by {toTitleCase(company.name)}
            </h2>
            <p className="text-xs text-text-muted mt-1">
              Showing {filteredFilms.length} of {allFilmsWithRole.length} indexed titles
            </p>
          </div>

          {/* View Mode Toggle: Commercial Ledger vs Poster Grid */}
          <div className="flex items-center gap-2 self-start md:self-auto bg-surface border border-border rounded-xl p-1 shadow-sm">
            <button
              type="button"
              onClick={() => setViewMode('ledger')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                viewMode === 'ledger'
                  ? 'bg-brand text-black shadow-sm'
                  : 'text-text-muted hover:text-text-primary'
              }`}
              title="Commercial Ledger Table View"
            >
              <Icon icon="solar:bill-list-bold" className="w-4 h-4" />
              <span>Commercial Table</span>
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
              <span>Poster Grid</span>
            </button>
          </div>
        </div>

        {/* Filter Tabs & Search Bar */}
        <div className="bg-surface border border-border rounded-2xl p-4 sm:p-5 shadow-sm space-y-4 mb-8">
          
          {/* Category Tabs */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar text-xs font-bold">
            <button
              type="button"
              onClick={() => { setActiveTab('all'); setVisibleCount(20); }}
              className={`px-3 py-1.5 rounded-lg border transition-all shrink-0 cursor-pointer ${
                activeTab === 'all'
                  ? 'bg-text-primary text-bg border-text-primary font-black shadow-sm'
                  : 'bg-surface-2 border-border text-text-muted hover:text-text-primary'
              }`}
            >
              All Releases ({allFilmsWithRole.length})
            </button>

            {studioMetrics.boxOfficeReleasesCount > 0 && (
              <button
                type="button"
                onClick={() => { setActiveTab('box_office'); setSortBy('box_office'); setVisibleCount(20); }}
                className={`px-3 py-1.5 rounded-lg border transition-all shrink-0 flex items-center gap-1.5 cursor-pointer ${
                  activeTab === 'box_office'
                    ? 'bg-amber-500 text-black border-amber-400 font-black shadow-sm'
                    : 'bg-surface-2 border-border text-amber-400 hover:border-amber-500/40'
                }`}
              >
                <Icon icon="solar:ticket-bold" className="w-3.5 h-3.5" />
                Box Office Releases ({studioMetrics.boxOfficeReleasesCount})
              </button>
            )}

            {studioMetrics.youtubeReleasesCount > 0 && (
              <button
                type="button"
                onClick={() => { setActiveTab('youtube'); setSortBy('views'); setVisibleCount(20); }}
                className={`px-3 py-1.5 rounded-lg border transition-all shrink-0 flex items-center gap-1.5 cursor-pointer ${
                  activeTab === 'youtube'
                    ? 'bg-red-600 text-white border-red-500 font-black shadow-sm'
                    : 'bg-surface-2 border-border text-red-400 hover:border-red-500/40'
                }`}
              >
                <Icon icon="solar:play-circle-bold" className="w-3.5 h-3.5" />
                YouTube Releases ({studioMetrics.youtubeReleasesCount})
              </button>
            )}

            <button
              type="button"
              onClick={() => { setActiveTab('production'); setVisibleCount(20); }}
              className={`px-3 py-1.5 rounded-lg border transition-all shrink-0 cursor-pointer ${
                activeTab === 'production'
                  ? 'bg-brand text-black border-brand font-black shadow-sm'
                  : 'bg-surface-2 border-border text-text-muted hover:text-text-primary'
              }`}
            >
              Production ({studioMetrics.productionCount})
            </button>

            <button
              type="button"
              onClick={() => { setActiveTab('distribution'); setVisibleCount(20); }}
              className={`px-3 py-1.5 rounded-lg border transition-all shrink-0 cursor-pointer ${
                activeTab === 'distribution'
                  ? 'bg-brand text-black border-brand font-black shadow-sm'
                  : 'bg-surface-2 border-border text-text-muted hover:text-text-primary'
              }`}
            >
              Distribution ({studioMetrics.distributionCount})
            </button>

            <button
              type="button"
              onClick={() => { setActiveTab('top'); setVisibleCount(20); }}
              className={`px-3 py-1.5 rounded-lg border transition-all shrink-0 cursor-pointer ${
                activeTab === 'top'
                  ? 'bg-emerald-600 text-white border-emerald-500 font-black shadow-sm'
                  : 'bg-surface-2 border-border text-emerald-400 hover:border-emerald-500/40'
              }`}
            >
              Top Rated ⭐
            </button>
          </div>

          {/* Search & Sorting Row */}
          <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-3">
            <div className="relative">
              <Icon icon="solar:magnifer-linear" className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted w-4 h-4" />
              <input
                type="text"
                placeholder="Search films by title or genre..."
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setVisibleCount(20); }}
                className="w-full pl-10 pr-4 py-2.5 bg-bg border border-border rounded-xl text-xs text-text-primary placeholder-text-muted focus:outline-none focus:border-brand transition-colors"
              />
            </div>

            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="bg-bg border border-border rounded-xl px-3 py-2.5 text-xs font-semibold text-text-primary focus:outline-none focus:border-brand"
              aria-label="Sort films"
            >
              <option value="box_office">Highest Box Office Earnings (₦)</option>
              <option value="views">Most YouTube Views (▶)</option>
              <option value="year-desc">Release Year (Newest First)</option>
              <option value="rating-desc">Audience Rating (High to Low)</option>
              <option value="title">Film Title (A–Z)</option>
            </select>
          </div>

        </div>

        {/* ─── CATALOGUE DISPLAY ─── */}
        {displayedFilms.length === 0 ? (
          <div className="bg-surface border border-border p-16 rounded-2xl text-center">
            <Icon icon="solar:clapperboard-line-duotone" className="w-16 h-16 text-text-muted mx-auto mb-3 opacity-40" />
            <h3 className="text-lg font-bold text-text-primary mb-1">No films found</h3>
            <p className="text-xs text-text-muted">No titles match your selected filter or search keyword.</p>
          </div>
        ) : viewMode === 'ledger' ? (
          /* COMMERCIAL TABLE / LEDGER VIEW */
          <div className="bg-surface border border-border rounded-2xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-surface-2/60 border-b border-border text-text-muted font-black uppercase tracking-wider text-[10px]">
                    <th className="py-3.5 px-4">Film Title</th>
                    <th className="py-3.5 px-4">Year</th>
                    <th className="py-3.5 px-4">Role</th>
                    <th className="py-3.5 px-4">Box Office Gross</th>
                    <th className="py-3.5 px-4">YouTube Views</th>
                    <th className="py-3.5 px-4">Audience Score</th>
                    <th className="py-3.5 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {displayedFilms.map((item) => {
                    const f = item.film;
                    const bo = Number(f.box_office_domestic || f.box_office_worldwide || 0);
                    const vc = Number(f.view_count || 0);
                    const rating = f.liked_percent != null ? `${f.liked_percent}%` : f.average_rating ? `${(f.average_rating * 10).toFixed(0)}%` : null;

                    return (
                      <tr key={f.id} className="hover:bg-surface-2/40 transition-colors group">
                        <td className="py-3 px-4">
                          <Link to={`/films/${f.slug || f.id}`} className="flex items-center gap-3">
                            <div className="w-10 h-14 rounded-lg overflow-hidden bg-black shrink-0 border border-border">
                              <ImageWithFallback
                                src={f.poster_url}
                                alt={f.title}
                                fallbackType="film"
                                name={f.title}
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                                loading="lazy"
                              />
                            </div>
                            <div className="min-w-0">
                              <span className="font-bold text-text-primary group-hover:text-brand transition-colors block truncate max-w-[240px] sm:max-w-[320px]">
                                {formatFilmTitle(f.title)}
                              </span>
                              {f.film_genres?.[0]?.genres?.name && (
                                <span className="text-[10px] text-text-muted">
                                  {f.film_genres[0].genres.name}
                                </span>
                              )}
                            </div>
                          </Link>
                        </td>

                        <td className="py-3 px-4 text-text-muted font-semibold">
                          {f.year || '–'}
                        </td>

                        <td className="py-3 px-4">
                          <span className="inline-block capitalize px-2 py-0.5 rounded-md bg-surface-2 border border-border text-[11px] font-bold text-text-secondary">
                            {item.role || 'Production'}
                          </span>
                        </td>

                        <td className="py-3 px-4 font-black">
                          {bo > 0 ? (
                            <span className="text-amber-400">{formatMoney(bo)}</span>
                          ) : (
                            <span className="text-text-muted opacity-40">–</span>
                          )}
                        </td>

                        <td className="py-3 px-4 font-bold">
                          {vc > 0 ? (
                            <span className="text-red-400">{formatViews(vc)}</span>
                          ) : (
                            <span className="text-text-muted opacity-40">–</span>
                          )}
                        </td>

                        <td className="py-3 px-4">
                          {rating ? (
                            <span className="inline-flex items-center gap-1 text-emerald-400 font-bold">
                              <Icon icon="solar:star-bold" className="w-3 h-3" />
                              {rating}
                            </span>
                          ) : (
                            <span className="text-text-muted opacity-40">–</span>
                          )}
                        </td>

                        <td className="py-3 px-4 text-right">
                          <Link
                            to={`/films/${f.slug || f.id}`}
                            className="inline-flex items-center gap-1 font-bold text-brand hover:underline"
                          >
                            <span>View</span>
                            <Icon icon="solar:arrow-right-linear" className="w-3 h-3" />
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          /* POSTER GRID VIEW */
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 sm:gap-6">
            {displayedFilms.map((item) => {
              const f = item.film;
              const bo = Number(f.box_office_domestic || f.box_office_worldwide || 0);
              const vc = Number(f.view_count || 0);

              return (
                <Link
                  key={f.id}
                  to={`/films/${f.slug || f.id}`}
                  className="group bg-surface border border-border hover:border-brand/40 rounded-2xl overflow-hidden flex flex-col justify-between shadow-sm transition-all hover:-translate-y-1"
                >
                  <div className="relative aspect-[2/3] w-full bg-black overflow-hidden">
                    <ImageWithFallback
                      src={f.poster_url}
                      alt={f.title}
                      fallbackType="film"
                      name={f.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      loading="lazy"
                    />

                    {/* Role Pill */}
                    {item.role && (
                      <span className="absolute top-2.5 left-2.5 bg-black/80 backdrop-blur-md border border-white/20 text-white text-[9px] font-black px-2 py-0.5 rounded-md uppercase tracking-wider shadow-lg z-10">
                        {item.role.replace('_', ' ')}
                      </span>
                    )}

                    {/* Box Office / Views Pill */}
                    {bo > 0 ? (
                      <span className="absolute bottom-2.5 right-2.5 bg-amber-500 text-black text-[10px] font-black px-2 py-0.5 rounded-md shadow-lg z-10">
                        {formatMoney(bo)}
                      </span>
                    ) : vc > 0 ? (
                      <span className="absolute bottom-2.5 right-2.5 bg-red-600 text-white text-[10px] font-black px-2 py-0.5 rounded-md shadow-lg z-10 flex items-center gap-1">
                        <Icon icon="solar:play-circle-bold" className="w-3 h-3" />
                        {formatViews(vc)}
                      </span>
                    ) : null}
                  </div>

                  <div className="p-3.5 flex flex-col justify-between flex-1">
                    <div>
                      <h4 className="font-bold text-text-primary text-xs sm:text-sm line-clamp-1 group-hover:text-brand transition-colors mb-1">
                        {formatFilmTitle(f.title)}
                      </h4>
                      <p className="text-[10px] text-text-muted font-semibold">
                        {f.year || 'N/A'}
                        {f.film_genres?.[0]?.genres?.name && ` • ${f.film_genres[0].genres.name}`}
                      </p>
                    </div>

                    <div className="mt-3 pt-2 border-t border-border/50 flex items-center justify-between text-[11px]">
                      <span className="text-text-muted text-[10px] capitalize">
                        {item.role}
                      </span>
                      <span className="text-brand font-bold group-hover:translate-x-0.5 transition-transform flex items-center gap-0.5">
                        Details →
                      </span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}

        {/* Load More Button */}
        {filteredFilms.length > visibleCount && (
          <div className="mt-12 text-center">
            <button
              type="button"
              onClick={() => setVisibleCount((prev) => prev + 20)}
              className="px-8 py-3.5 bg-surface border border-border hover:border-brand/50 text-text-primary font-bold text-xs rounded-xl shadow-md hover:bg-surface-2 transition-all inline-flex items-center gap-2 cursor-pointer"
            >
              <span>Load More Releases ({filteredFilms.length - visibleCount} remaining)</span>
              <Icon icon="solar:alt-arrow-down-linear" className="w-4 h-4 text-brand" />
            </button>
          </div>
        )}

      </section>
    </div>
  );
}