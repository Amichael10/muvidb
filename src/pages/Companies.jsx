import React, { useMemo, useState, useEffect, useRef } from 'react';
import { Link, useLoaderData } from 'react-router';
import { supabase } from '../lib/supabase';
import { Icon } from '@iconify/react';
import { toTitleCase, toSentenceCase, formatFilmTitle } from '../utils/format';
import ImageWithFallback from '../components/ui/ImageWithFallback';
import PageHeader from '../components/ui/PageHeader';
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
      className="group bg-surface/70 hover:bg-surface rounded-xl border border-border/70 hover:border-brand/40 transition-all duration-300 shadow-sm hover:shadow-md flex flex-col justify-between hover:-translate-y-0.5"
    >
      <div className="p-5">
        <div className="flex items-start gap-3.5">
          <div className="w-12 h-12 rounded-xl border border-border/80 overflow-hidden bg-surface-2 shrink-0 p-1 group-hover:border-brand/30 transition-colors">
            <ImageWithFallback
              src={company.logo_url}
              alt={toTitleCase(company.name)}
              fallbackType="company"
              name={toTitleCase(company.name)}
              className="w-full h-full object-cover rounded-lg"
              width={96}
              sizes="48px"
              loading="lazy"
            />
          </div>

          <div className="flex-1 min-w-0">
            <h3 className="text-text-primary font-bold text-sm sm:text-[15px] tracking-tight group-hover:text-brand transition-colors truncate">
              {toTitleCase(company.name)}
            </h3>

            <div className="flex items-center gap-1.5 mt-0.5 text-[11px] text-text-muted">
              {company.company_type && (
                <span className="text-brand font-medium capitalize">
                  {company.company_type}
                </span>
              )}
              {company.company_type && company.founded_year && <span>•</span>}
              {company.founded_year && (
                <span>Est. {company.founded_year}</span>
              )}
            </div>
          </div>
        </div>

        {company.description && (
          <p className="text-text-muted text-xs mt-3 line-clamp-2 leading-relaxed opacity-80">
            {toSentenceCase(company.description)}
          </p>
        )}

        {/* Commercial Highlights */}
        {(boxOffice > 0 || views > 0) && (
          <div className="mt-3 pt-3 border-t border-border/40 flex items-center gap-3 text-xs">
            {boxOffice > 0 && (
              <span className="inline-flex items-center gap-1 font-semibold text-amber-400">
                <Icon icon="solar:ticket-bold" className="w-3.5 h-3.5 text-amber-400/80" />
                {formatMoney(boxOffice)}
              </span>
            )}
            {views > 0 && (
              <span className="inline-flex items-center gap-1 font-semibold text-red-400">
                <Icon icon="solar:play-circle-bold" className="w-3.5 h-3.5 text-red-400/80" />
                {formatViews(views)}
              </span>
            )}
          </div>
        )}

        {/* Top Hit */}
        {topHit && (
          <div className="mt-2.5 flex items-center justify-between text-[11px] text-text-muted">
            <span className="truncate pr-2">
              Hit: <span className="text-text-primary font-medium">{formatFilmTitle(topHit.title)}</span>
            </span>
            <span className="font-semibold text-text-muted shrink-0 text-[10px]">
              {topHit.boxOffice ? formatMoney(topHit.boxOffice) : `${formatViews(topHit.views)} views`}
            </span>
          </div>
        )}
      </div>

      {/* Card Footer */}
      <div className="px-5 py-3 border-t border-border/40 flex items-center justify-between text-xs text-text-muted">
        <div className="flex items-center gap-1.5 font-medium">
          <Icon icon="solar:clapperboard-play-linear" className="w-3.5 h-3.5 text-brand/70" />
          <span>{filmCount} {filmCount === 1 ? 'Film' : 'Films'}</span>
        </div>

        <div className="flex items-center gap-3">
          {company.website && (
            <a
              href={company.website.startsWith('http') ? company.website : `https://${company.website}`}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="text-text-muted hover:text-text-primary font-medium flex items-center gap-1 text-[11px] transition-colors"
            >
              <span>Site</span>
              <Icon icon="solar:arrow-right-up-linear" className="w-3 h-3" />
            </a>
          )}
          <span className="text-brand font-medium group-hover:translate-x-0.5 transition-transform flex items-center gap-1 text-[11px]">
            <span>Portfolio</span>
            <Icon icon="solar:alt-arrow-right-linear" className="w-3 h-3" />
          </span>
        </div>
      </div>
    </Link>
  );
};

const CompanySkeleton = () => (
  <div className="bg-surface/70 rounded-xl border border-border/70 p-5 space-y-3.5">
    <div className="flex gap-3.5">
      <div className="w-12 h-12 rounded-xl bg-surface-2 animate-shimmer shrink-0" />
      <div className="flex-1 space-y-2">
        <div className="h-4 w-2/3 bg-surface-2 rounded animate-shimmer" />
        <div className="h-3 w-1/3 bg-surface-2 rounded animate-shimmer opacity-60" />
      </div>
    </div>
    <div className="space-y-1.5 pt-1">
      <div className="h-3 w-full bg-surface-2 rounded animate-shimmer opacity-40" />
      <div className="h-3 w-4/5 bg-surface-2 rounded animate-shimmer opacity-40" />
    </div>
    <div className="h-5 w-1/2 bg-surface-2/60 rounded animate-shimmer pt-2" />
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

      {/* ─── 1. PAGE HEADER & COMPACT METRICS ─── */}
      <PageHeader
        icon="solar:buildings-2-bold"
        eyebrow="Industry Directory"
        title="Studios & Distributors"
        description="The production powerhouses, theatrical distribution networks, and digital streaming creators shaping African cinema."
        count={companies.length}
        countLabel="studios tracked"
        actions={
          <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
            {industryStats.cumulativeBoxOffice > 0 && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface/70 border border-border/80 text-xs">
                <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" />
                <span className="text-text-muted">Tracked Box Office:</span>
                <span className="font-bold text-amber-400">
                  {formatMoney(industryStats.cumulativeBoxOffice)}
                </span>
              </div>
            )}
            {industryStats.cumulativeViews > 0 && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface/70 border border-border/80 text-xs">
                <span className="w-2 h-2 rounded-full bg-red-400 shrink-0" />
                <span className="text-text-muted">Digital Views:</span>
                <span className="font-bold text-red-400">
                  {formatViews(industryStats.cumulativeViews)}
                </span>
              </div>
            )}
            {industryStats.studiosWithFilms > 0 && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface/70 border border-border/80 text-xs">
                <span className="w-2 h-2 rounded-full bg-brand shrink-0" />
                <span className="text-text-muted">Catalogues:</span>
                <span className="font-bold text-text-primary">
                  {industryStats.studiosWithFilms} Active
                </span>
              </div>
            )}
          </div>
        }
      />

      {/* ─── 2. SEARCH, FILTERS & SORTING BAR ─── */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-border/70">
          
          {/* Quick Segment Filter Pills */}
          <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto pb-1 no-scrollbar text-xs font-semibold">
            <button
              type="button"
              onClick={() => setMetricFilter('all')}
              className={`px-3 py-1.5 rounded-lg border transition-all shrink-0 cursor-pointer ${
                metricFilter === 'all'
                  ? 'bg-surface-2 border-brand/50 text-text-primary font-bold shadow-xs'
                  : 'bg-surface/50 border-border text-text-muted hover:text-text-primary hover:border-border/80'
              }`}
            >
              All Studios ({companies.length})
            </button>
            <button
              type="button"
              onClick={() => { setMetricFilter('box_office'); setSortBy('box_office'); }}
              className={`px-3 py-1.5 rounded-lg border transition-all shrink-0 flex items-center gap-1.5 cursor-pointer ${
                metricFilter === 'box_office'
                  ? 'bg-amber-500/10 border-amber-500/40 text-amber-400 font-bold shadow-xs'
                  : 'bg-surface/50 border-border text-text-muted hover:text-amber-400 hover:border-amber-500/30'
              }`}
            >
              <Icon icon="solar:ticket-bold" className="w-3.5 h-3.5 text-amber-400" />
              Theatrical Box Office
            </button>
            <button
              type="button"
              onClick={() => { setMetricFilter('youtube'); setSortBy('views'); }}
              className={`px-3 py-1.5 rounded-lg border transition-all shrink-0 flex items-center gap-1.5 cursor-pointer ${
                metricFilter === 'youtube'
                  ? 'bg-red-500/10 border-red-500/40 text-red-400 font-bold shadow-xs'
                  : 'bg-surface/50 border-border text-text-muted hover:text-red-400 hover:border-red-500/30'
              }`}
            >
              <Icon icon="solar:play-circle-bold" className="w-3.5 h-3.5 text-red-400" />
              YouTube Powerhouses
            </button>
            <button
              type="button"
              onClick={() => setMetricFilter('with_films')}
              className={`px-3 py-1.5 rounded-lg border transition-all shrink-0 cursor-pointer ${
                metricFilter === 'with_films'
                  ? 'bg-brand/10 border-brand/40 text-brand font-bold shadow-xs'
                  : 'bg-surface/50 border-border text-text-muted hover:text-text-primary hover:border-border/80'
              }`}
            >
              With Releases
            </button>
          </div>

          {/* Search, Type & Sorting Controls */}
          <div className="flex items-center gap-2.5 flex-wrap sm:flex-nowrap">
            <div className="relative min-w-[220px] flex-1 sm:flex-initial">
              <Icon icon="solar:magnifer-linear" className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted w-3.5 h-3.5 pointer-events-none" />
              <input
                type="text"
                placeholder="Search studios..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-7 py-2 bg-surface/50 hover:bg-surface border border-border rounded-xl text-xs text-text-primary placeholder-text-muted focus:outline-none focus:border-brand transition-colors"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary"
                >
                  <Icon icon="solar:close-circle-bold" className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="bg-surface/50 hover:bg-surface border border-border rounded-xl px-3 py-2 text-xs font-semibold text-text-primary focus:outline-none focus:border-brand capitalize cursor-pointer"
              aria-label="Filter by studio type"
            >
              <option value="all">All Types</option>
              {typeOptions.map((t) => (
                <option key={t} value={t} className="capitalize">{t}</option>
              ))}
            </select>

            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="bg-surface/50 hover:bg-surface border border-border rounded-xl px-3 py-2 text-xs font-semibold text-text-primary focus:outline-none focus:border-brand cursor-pointer"
              aria-label="Sort studios"
            >
              <option value="box_office">Box Office (High to Low)</option>
              <option value="views">YouTube Views (High to Low)</option>
              <option value="films">Film Releases (High to Low)</option>
              <option value="founded">Year Founded</option>
              <option value="name">Name (A–Z)</option>
            </select>
          </div>

        </div>
      </section>

      {/* ─── 3. COMPANIES DIRECTORY GRID ─── */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8">
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <CompanySkeleton key={i} />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 bg-surface/50 rounded-2xl border border-border/70">
            <Icon icon="solar:buildings-linear" className="text-4xl mx-auto mb-3 opacity-30 text-brand" />
            <h3 className="text-base font-bold text-text-primary mb-1">No studios match these filters</h3>
            <p className="text-xs text-text-muted mb-4">Try adjusting your search term or metric filter.</p>
            <button
              type="button"
              onClick={clearFilters}
              className="px-4 py-2 rounded-xl bg-brand text-black text-xs font-bold hover:bg-brand-hover transition-colors cursor-pointer"
            >
              Reset Filters
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
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
