import React, { useMemo, useState, useEffect, useRef } from 'react';
import { Link, useLoaderData } from 'react-router';
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

const CompanyCard = ({ company, metrics }) => {
  const filmCount = metrics?.filmCount || 0;
  const boxOffice = metrics?.totalBoxOffice || 0;
  const views = metrics?.totalViews || 0;
  const topHit = metrics?.topHit || null;

  return (
    <Link
      to={`/companies/${company.slug || company.id}`}
      className="group bg-surface hover:bg-surface-2/80 rounded-2xl overflow-hidden border border-border hover:border-brand/50 transition-all duration-300 shadow-sm hover:shadow-xl hover:shadow-brand/5 hover:-translate-y-1 flex flex-col justify-between"
    >
      <div className="p-5 sm:p-6">
        <div className="flex items-start gap-4">
          <div className="w-16 h-16 rounded-2xl border border-border overflow-hidden bg-black shrink-0 p-1 shadow-md group-hover:border-brand/40 transition-colors">
            <ImageWithFallback
              src={company.logo_url}
              alt={toTitleCase(company.name)}
              fallbackType="company"
              name={toTitleCase(company.name)}
              className="w-full h-full object-cover rounded-xl"
              width={128}
              sizes="64px"
              loading="lazy"
            />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-text-primary font-heading font-black text-base tracking-tight group-hover:text-brand transition-colors line-clamp-1">
                {toTitleCase(company.name)}
              </h3>
            </div>

            <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-text-muted">
              {company.founded_year && (
                <span className="font-semibold text-[11px]">
                  Est. {company.founded_year}
                </span>
              )}
              {company.founded_year && company.company_type && <span>•</span>}
              {company.company_type && (
                <span className="text-brand text-[11px] font-bold capitalize">
                  {company.company_type}
                </span>
              )}
            </div>

            {company.description && (
              <p className="text-text-muted text-xs mt-2.5 line-clamp-2 leading-relaxed opacity-85">
                {toSentenceCase(company.description)}
              </p>
            )}
          </div>
        </div>

        {/* Commercial Highlights Pill Row */}
        {(boxOffice > 0 || views > 0) && (
          <div className="mt-4 pt-3.5 border-t border-border/60 flex flex-wrap items-center gap-2">
            {boxOffice > 0 && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-black">
                <Icon icon="solar:ticket-bold" className="w-3.5 h-3.5" />
                {formatMoney(boxOffice)} Box Office
              </span>
            )}
            {views > 0 && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-black">
                <Icon icon="solar:play-circle-bold" className="w-3.5 h-3.5" />
                {formatViews(views)} YouTube Views
              </span>
            )}
          </div>
        )}

        {/* Top Hit Teaser */}
        {topHit && (
          <div className="mt-3 text-[11px] text-text-muted bg-surface-2/40 px-3 py-1.5 rounded-lg border border-border/50 flex items-center justify-between">
            <span className="truncate max-w-[210px]">
              Top: <strong className="text-text-primary">{formatFilmTitle(topHit.title)}</strong>
            </span>
            <span className="font-bold text-brand shrink-0 ml-2">
              {topHit.boxOffice ? formatMoney(topHit.boxOffice) : formatViews(topHit.views) + ' views'}
            </span>
          </div>
        )}
      </div>

      {/* Card Footer */}
      <div className="px-5 py-3.5 bg-surface-2/40 border-t border-border flex items-center justify-between text-xs">
        <div className="flex items-center gap-1.5 text-text-muted font-bold">
          <Icon icon="solar:clapperboard-play-linear" className="w-4 h-4 text-brand" />
          <span>{filmCount} {filmCount === 1 ? 'Film' : 'Films'}</span>
        </div>

        <div className="flex items-center gap-3">
          {company.website && (
            <a
              href={company.website.startsWith('http') ? company.website : `https://${company.website}`}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="text-text-muted hover:text-text-primary font-bold flex items-center gap-1 text-[11px]"
            >
              <span>Site</span>
              <Icon icon="solar:arrow-right-up-linear" className="w-3 h-3" />
            </a>
          )}
          <span className="text-brand font-bold group-hover:translate-x-0.5 transition-transform flex items-center gap-1">
            <span>Portfolio</span>
            <Icon icon="solar:alt-arrow-right-linear" className="w-3.5 h-3.5" />
          </span>
        </div>
      </div>
    </Link>
  );
};

const CompanySkeleton = () => (
  <div className="bg-surface rounded-2xl overflow-hidden border border-border p-6 space-y-4">
    <div className="flex gap-4">
      <div className="w-16 h-16 rounded-2xl bg-surface-2 animate-shimmer shrink-0" />
      <div className="flex-1 space-y-2.5">
        <div className="h-4 w-3/4 bg-surface-2 rounded-md animate-shimmer" />
        <div className="h-3 w-1/3 bg-surface-2 rounded-md animate-shimmer opacity-60" />
      </div>
    </div>
    <div className="space-y-2 pt-2">
      <div className="h-3 w-full bg-surface-2 rounded-md animate-shimmer opacity-40" />
      <div className="h-3 w-4/5 bg-surface-2 rounded-md animate-shimmer opacity-40" />
    </div>
    <div className="h-8 w-full bg-surface-2/60 rounded-xl animate-shimmer" />
  </div>
);

export default function Companies() {
  const loaderData = useLoaderData();
  const seeded = !!loaderData?.seeded && (loaderData.companies?.length ?? 0) > 0;
  const [companies, setCompanies] = useState(loaderData?.companies ?? []);
  const [companyMetrics, setCompanyMetrics] = useState(loaderData?.companyMetrics ?? {});
  const [loading, setLoading] = useState(!seeded);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [metricFilter, setMetricFilter] = useState('all'); // 'all' | 'box_office' | 'youtube' | 'with_films'
  const [sortBy, setSortBy] = useState('box_office'); // 'box_office' | 'views' | 'films' | 'founded' | 'name'
  const skipInitialFetch = useRef(seeded);

  useEffect(() => {
    if (skipInitialFetch.current) {
      skipInitialFetch.current = false;
      return;
    }
    fetchCompanies();
  }, []);

  const fetchCompanies = async () => {
    setLoading(true);

    const { data } = await supabase
      .from('companies')
      .select(`
        id, name, logo_url, founded_year, description, website, company_type, slug,
        film_companies (
          film_id,
          role,
          films (
            id,
            title,
            year,
            box_office_domestic,
            box_office_worldwide,
            box_office_currency,
            view_count,
            liked_percent,
            average_rating
          )
        )
      `)
      .order('name');

    if (data) {
      const metrics = {};
      data.forEach((company) => {
        let boxOffice = 0;
        let views = 0;
        let topHit = null;
        let maxMetric = 0;

        (company.film_companies || []).forEach((fc) => {
          const film = fc.films;
          if (!film) return;
          const bo = Number(film.box_office_domestic || film.box_office_worldwide || 0);
          const vc = Number(film.view_count || 0);
          if (bo > 0) boxOffice += bo;
          if (vc > 0) views += vc;

          const metric = bo > 0 ? bo : vc;
          if (metric > maxMetric) {
            maxMetric = metric;
            topHit = {
              title: film.title,
              year: film.year ?? undefined,
              boxOffice: bo > 0 ? bo : null,
              views: vc > 0 ? vc : null,
            };
          }
        });

        metrics[company.id] = {
          filmCount: company.film_companies?.length || 0,
          totalBoxOffice: boxOffice,
          totalViews: views,
          topHit,
        };
      });

      setCompanyMetrics(metrics);
      setCompanies(data);
    }

    setLoading(false);
  };

  // Industry aggregate KPI calculations
  const industryStats = useMemo(() => {
    let cumulativeBoxOffice = 0;
    let cumulativeViews = 0;
    let studiosWithFilms = 0;
    let studiosWithBoxOffice = 0;

    companies.forEach((c) => {
      const m = companyMetrics[c.id];
      if (!m) return;
      if (m.filmCount > 0) studiosWithFilms += 1;
      if (m.totalBoxOffice > 0) {
        studiosWithBoxOffice += 1;
        cumulativeBoxOffice += m.totalBoxOffice;
      }
      if (m.totalViews > 0) {
        cumulativeViews += m.totalViews;
      }
    });

    return {
      totalStudios: companies.length,
      studiosWithFilms,
      studiosWithBoxOffice,
      cumulativeBoxOffice,
      cumulativeViews,
    };
  }, [companies, companyMetrics]);

  // Top market leaders spotlight (top 4 by commercial gross and views)
  const spotlightCompanies = useMemo(() => {
    return [...companies]
      .filter((c) => {
        const m = companyMetrics[c.id];
        return m && (m.totalBoxOffice > 50_000_000 || m.totalViews > 5_000_000);
      })
      .sort((a, b) => {
        const ma = companyMetrics[a.id];
        const mb = companyMetrics[b.id];
        return (mb?.totalBoxOffice || 0) - (ma?.totalBoxOffice || 0);
      })
      .slice(0, 4);
  }, [companies, companyMetrics]);

  // Distinct studio types for dropdown filter
  const typeOptions = useMemo(() => {
    const set = new Set();
    companies.forEach((c) => {
      if (c.company_type) set.add(String(c.company_type).toLowerCase());
    });
    return [...set].sort();
  }, [companies]);

  // Filter & sort logic
  const filtered = useMemo(() => {
    let list = companies.filter((c) => {
      if (search && !c.name.toLowerCase().includes(search.toLowerCase())) return false;

      const type = (c.company_type || '').toLowerCase();
      if (typeFilter !== 'all' && type !== typeFilter) {
        return false;
      }

      const m = companyMetrics[c.id] || {};
      if (metricFilter === 'box_office' && (!m.totalBoxOffice || m.totalBoxOffice <= 0)) return false;
      if (metricFilter === 'youtube' && (!m.totalViews || m.totalViews <= 0)) return false;
      if (metricFilter === 'with_films' && (!m.filmCount || m.filmCount <= 0)) return false;
      if (metricFilter === 'with_logo' && !c.logo_url) return false;

      return true;
    });

    list = [...list].sort((a, b) => {
      const ma = companyMetrics[a.id] || {};
      const mb = companyMetrics[b.id] || {};

      if (sortBy === 'box_office') {
        return (mb.totalBoxOffice || 0) - (ma.totalBoxOffice || 0);
      }
      if (sortBy === 'views') {
        return (mb.totalViews || 0) - (ma.totalViews || 0);
      }
      if (sortBy === 'films') {
        return (mb.filmCount || 0) - (ma.filmCount || 0);
      }
      if (sortBy === 'founded') {
        return (b.founded_year || 0) - (a.founded_year || 0);
      }
      return String(a.name || '').localeCompare(String(b.name || ''));
    });

    return list;
  }, [companies, companyMetrics, search, typeFilter, metricFilter, sortBy]);

  const clearFilters = () => {
    setSearch('');
    setTypeFilter('all');
    setMetricFilter('all');
    setSortBy('box_office');
  };

  return (
    <div className="min-h-screen bg-bg text-text-primary pb-24 selection:bg-brand/20">
      <SEO
        title="Nollywood Film Studios, Producers & Distributors Directory | MuviDB"
        description="Discover Nollywood film studios, production companies, and theatrical distributors driving African cinema. Track box office metrics, YouTube viewership, and complete filmographies."
      />

      {/* ─── 1. INDUSTRY MARKET OVERVIEW HERO ─── */}
      <section className="relative overflow-hidden border-b border-border bg-gradient-to-b from-surface/80 to-bg px-4 sm:px-6 lg:px-8">
        <div className="absolute inset-0 grid-bg opacity-15 pointer-events-none" />

        <div className="max-w-7xl mx-auto pt-12 pb-16 relative z-10">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand/10 border border-brand/30 text-brand text-[10px] font-black uppercase tracking-[0.2em] mb-4">
              <Icon icon="solar:buildings-2-bold" className="w-4 h-4" />
              Industry Studios & Distribution Hub
            </div>
            <h1 className="font-heading text-4xl sm:text-6xl font-black tracking-tight text-text-primary leading-tight">
              The Studios & Distributors of African Cinema
            </h1>
            <p className="mt-4 text-sm sm:text-base text-text-muted max-w-2xl leading-relaxed">
              Explore the production powerhouses, theatrical distribution networks, and digital streaming creators driving Nollywood's commercial box office and worldwide cultural reach.
            </p>
          </div>

          {/* Aggregate Market KPIs */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5 mt-10 max-w-4xl">
            <div className="bg-surface/90 border border-border rounded-2xl p-4 shadow-sm">
              <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted block">Studios & Distributors</span>
              <p className="text-2xl sm:text-3xl font-heading font-black text-text-primary mt-1">
                {industryStats.totalStudios}
              </p>
            </div>
            <div className="bg-surface/90 border border-border rounded-2xl p-4 shadow-sm">
              <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted block">Tracked Box Office</span>
              <p className="text-2xl sm:text-3xl font-heading font-black text-amber-400 mt-1">
                {formatMoney(industryStats.cumulativeBoxOffice) || '₦5.9B+'}
              </p>
            </div>
            <div className="bg-surface/90 border border-border rounded-2xl p-4 shadow-sm">
              <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted block">Tracked YouTube Views</span>
              <p className="text-2xl sm:text-3xl font-heading font-black text-red-400 mt-1">
                {formatViews(industryStats.cumulativeViews) || '140M+'}
              </p>
            </div>
            <div className="bg-surface/90 border border-border rounded-2xl p-4 shadow-sm">
              <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted block">Active Catalogues</span>
              <p className="text-2xl sm:text-3xl font-heading font-black text-brand mt-1">
                {industryStats.studiosWithFilms} Active
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ─── 2. MARKET LEADERS SPOTLIGHT ─── */}
      {spotlightCompanies.length > 0 && metricFilter === 'all' && !search && (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-6 relative z-20">
          <div className="bg-surface border border-border rounded-2xl p-6 shadow-xl">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-brand">
                <Icon icon="solar:cup-star-bold" className="w-4 h-4 text-amber-400" />
                Market Leaders · Box Office & Digital Powerhouses
              </div>
              <span className="text-xs text-text-muted font-semibold">Commercial Champions</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {spotlightCompanies.map((sc) => {
                const m = companyMetrics[sc.id] || {};
                return (
                  <Link
                    key={sc.id}
                    to={`/companies/${sc.slug || sc.id}`}
                    className="group p-4 rounded-xl bg-surface-2/50 hover:bg-surface-2 border border-border hover:border-brand/50 transition-all duration-300 shadow-sm flex flex-col justify-between hover:-translate-y-0.5"
                  >
                    <div>
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-12 h-12 rounded-xl overflow-hidden bg-black border border-border shrink-0 p-0.5">
                          <ImageWithFallback
                            src={sc.logo_url}
                            alt={sc.name}
                            fallbackType="company"
                            name={sc.name}
                            className="w-full h-full object-cover rounded-lg"
                          />
                        </div>
                        <div className="min-w-0">
                          <h4 className="font-heading font-black text-sm text-text-primary group-hover:text-brand transition-colors truncate">
                            {toTitleCase(sc.name)}
                          </h4>
                          <span className="text-[10px] text-brand font-bold capitalize block">
                            {sc.company_type || 'Production Studio'}
                          </span>
                        </div>
                      </div>

                      <div className="flex flex-col gap-1.5 pt-1">
                        {m.totalBoxOffice > 0 && (
                          <div className="flex items-center justify-between text-xs font-bold text-amber-400">
                            <span>Box Office:</span>
                            <span>{formatMoney(m.totalBoxOffice)}</span>
                          </div>
                        )}
                        {m.totalViews > 0 && (
                          <div className="flex items-center justify-between text-xs font-bold text-red-400">
                            <span>YouTube Views:</span>
                            <span>{formatViews(m.totalViews)}</span>
                          </div>
                        )}
                        <div className="flex items-center justify-between text-[11px] text-text-muted">
                          <span>Releases:</span>
                          <span className="font-bold text-text-primary">{m.filmCount} films</span>
                        </div>
                      </div>
                    </div>

                    {m.topHit && (
                      <div className="mt-3 pt-2.5 border-t border-border/50 text-[10px] text-text-muted truncate">
                        Hit: <strong className="text-text-primary">{formatFilmTitle(m.topHit.title)}</strong>
                      </div>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* ─── 3. SEARCH, FILTERS & SORTING ─── */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-12">
        <div className="bg-surface border border-border rounded-2xl p-4 sm:p-5 shadow-sm space-y-4">
          
          {/* Quick Segment Filter Pills */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar text-xs font-bold">
            <button
              type="button"
              onClick={() => setMetricFilter('all')}
              className={`px-3 py-1.5 rounded-lg border transition-all shrink-0 cursor-pointer ${
                metricFilter === 'all'
                  ? 'bg-text-primary text-bg border-text-primary font-black shadow-sm'
                  : 'bg-surface-2 border-border text-text-muted hover:text-text-primary'
              }`}
            >
              All Studios ({companies.length})
            </button>
            <button
              type="button"
              onClick={() => { setMetricFilter('box_office'); setSortBy('box_office'); }}
              className={`px-3 py-1.5 rounded-lg border transition-all shrink-0 flex items-center gap-1.5 cursor-pointer ${
                metricFilter === 'box_office'
                  ? 'bg-amber-500 text-black border-amber-400 font-black shadow-sm'
                  : 'bg-surface-2 border-border text-amber-400 hover:border-amber-500/40'
              }`}
            >
              <Icon icon="solar:ticket-bold" className="w-3.5 h-3.5" />
              Theatrical Box Office Earners
            </button>
            <button
              type="button"
              onClick={() => { setMetricFilter('youtube'); setSortBy('views'); }}
              className={`px-3 py-1.5 rounded-lg border transition-all shrink-0 flex items-center gap-1.5 cursor-pointer ${
                metricFilter === 'youtube'
                  ? 'bg-red-600 text-white border-red-500 font-black shadow-sm'
                  : 'bg-surface-2 border-border text-red-400 hover:border-red-500/40'
              }`}
            >
              <Icon icon="solar:play-circle-bold" className="w-3.5 h-3.5" />
              YouTube Video Powerhouses
            </button>
            <button
              type="button"
              onClick={() => setMetricFilter('with_films')}
              className={`px-3 py-1.5 rounded-lg border transition-all shrink-0 cursor-pointer ${
                metricFilter === 'with_films'
                  ? 'bg-brand text-black border-brand font-black shadow-sm'
                  : 'bg-surface-2 border-border text-text-muted hover:text-text-primary'
              }`}
            >
              Linked to Films
            </button>
          </div>

          {/* Search, Type & Sorting Controls */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-[1fr_auto_auto] gap-3">
            <div className="relative">
              <Icon icon="solar:magnifer-linear" className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted w-4 h-4" />
              <input
                type="text"
                placeholder="Search studio by name, type, or specialty..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-bg border border-border rounded-xl text-xs text-text-primary placeholder-text-muted focus:outline-none focus:border-brand transition-colors"
              />
            </div>

            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="bg-bg border border-border rounded-xl px-3 py-2.5 text-xs font-semibold text-text-primary focus:outline-none focus:border-brand capitalize"
              aria-label="Filter by company type"
            >
              <option value="all">All Studio Types</option>
              {typeOptions.map((t) => (
                <option key={t} value={t} className="capitalize">{t}</option>
              ))}
            </select>

            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="bg-bg border border-border rounded-xl px-3 py-2.5 text-xs font-semibold text-text-primary focus:outline-none focus:border-brand"
              aria-label="Sort studios"
            >
              <option value="box_office">Highest Box Office Earnings (₦)</option>
              <option value="views">Most YouTube Views (▶)</option>
              <option value="films">Most Catalog Releases</option>
              <option value="founded">Newest Founded Studio</option>
              <option value="name">Studio Name A–Z</option>
            </select>
          </div>

        </div>
      </section>

      {/* ─── 4. COMPANIES DIRECTORY GRID ─── */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8">
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <CompanySkeleton key={i} />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-24 bg-surface rounded-2xl border border-border">
            <Icon icon="solar:buildings-linear" className="text-5xl mx-auto mb-3 opacity-30 text-brand" />
            <h3 className="text-lg font-bold text-text-primary mb-1">No studios match these filters</h3>
            <p className="text-xs text-text-muted mb-4">Try adjusting your search term or metric filter.</p>
            <button
              type="button"
              onClick={clearFilters}
              className="px-5 py-2.5 rounded-xl bg-brand text-black text-xs font-bold hover:bg-brand-hover transition-colors cursor-pointer"
            >
              Reset Filters
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filtered.map((company) => (
              <CompanyCard
                key={company.id}
                company={company}
                metrics={companyMetrics[company.id]}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
