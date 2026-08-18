import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { Icon } from '@iconify/react';
import { AWARD_ORGS, getAwardOrg, loadAwardsCatalog } from '../lib/awards';
import ImageWithFallback from '../components/ui/ImageWithFallback';
import { formatFilmTitle, formatPersonName } from '../utils/format';

const CATEGORY_TABS = [
  { id: 'all', label: 'All Honours & Festivals', icon: 'solar:cup-star-linear' },
  { id: 'academy', label: 'Academies & Major Honours', icon: 'solar:medal-star-linear' },
  { id: 'festival', label: 'Film Festivals & Markets', icon: 'solar:clapperboard-linear' },
  { id: 'indigenous', label: 'Indigenous & Regional', icon: 'solar:masks-linear' },
  { id: 'impact', label: 'Industry & Social Impact', icon: 'solar:heart-angle-linear' },
];

const CATEGORY_LABELS = {
  academy: 'Academy Honours',
  festival: 'Film Festival',
  indigenous: 'Indigenous & Regional',
  industry: 'Industry & Business',
  impact: 'Social Impact',
};

export default function Awards() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [catalog, setCatalog] = useState({ rows: [], orgs: [], years: [], stats: {} });
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');

  useEffect(() => {
    document.title = 'Awards & Film Festivals | MuviDB';
    window.scrollTo(0, 0);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const data = await loadAwardsCatalog();
        if (cancelled) return;
        setCatalog(data);
      } catch (err) {
        console.error('Failed to load awards catalog:', err);
        if (!cancelled) setError(err.message || 'Failed to load awards directory');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Compute stats per organization
  const orgStatsMap = useMemo(() => {
    const map = new Map();
    for (const r of catalog.rows) {
      if (!map.has(r.org)) {
        map.set(r.org, { entries: 0, winners: 0, years: new Set() });
      }
      const item = map.get(r.org);
      item.entries += 1;
      if (r.won) item.winners += 1;
      if (r.year) item.years.add(r.year);
    }
    return map;
  }, [catalog.rows]);

  // Only include organizations that actually have recorded film / people awards in the database
  const allOrganizations = useMemo(() => {
    return (catalog.orgs || [])
      .map((orgId) => getAwardOrg(orgId))
      .filter(Boolean);
  }, [catalog.orgs]);

  // Filter organizations by search and category
  const filteredOrgs = useMemo(() => {
    let list = allOrganizations;

    if (selectedCategory !== 'all') {
      if (selectedCategory === 'impact') {
        list = list.filter((o) => o.category === 'impact' || o.category === 'industry');
      } else {
        list = list.filter((o) => o.category === selectedCategory);
      }
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter((o) => {
        const matchName =
          o.label.toLowerCase().includes(q) ||
          o.full.toLowerCase().includes(q) ||
          (o.tagline && o.tagline.toLowerCase().includes(q));
        const matchLocation = o.location && o.location.toLowerCase().includes(q);
        const matchAbout = o.about && o.about.toLowerCase().includes(q);
        const matchTags = Array.isArray(o.tags) && o.tags.some((t) => t.toLowerCase().includes(q));
        return matchName || matchLocation || matchAbout || matchTags;
      });
    }

    return list;
  }, [allOrganizations, selectedCategory, searchQuery]);

  // Recent Highlights Spotlight: last major winners recorded
  const recentSpotlightWinners = useMemo(() => {
    return catalog.rows
      .filter((r) => r.won && (r.film?.poster_url || r.person?.photo_url) && r.year >= 2024)
      .slice(0, 6);
  }, [catalog.rows]);

  return (
    <div className="min-h-screen bg-bg text-text-primary">
      <div className="mx-auto max-w-7xl border-x border-border min-h-screen">
        {/* Hero Section */}
        <header className="relative overflow-hidden border-b border-border bg-surface/30">
          <div
            className="pointer-events-none absolute -right-24 top-0 h-[450px] w-[450px] rounded-full opacity-20 blur-3xl"
            style={{ background: 'radial-gradient(circle, var(--color-brand) 55%, transparent 70%)' }}
            aria-hidden="true"
          />
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.035]"
            style={{
              backgroundImage:
                'radial-gradient(circle at 1px 1px, var(--color-text-primary) 1px, transparent 0)',
              backgroundSize: '28px 28px',
            }}
            aria-hidden="true"
          />

          <div className="relative px-4 pb-12 pt-24 sm:px-6 lg:px-8 md:pb-16 md:pt-28">
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="inline-flex items-center gap-2 rounded-full border border-brand/20 bg-brand/10 px-3 py-1 text-[11px] font-black uppercase tracking-[0.25em] text-brand"
            >
              <Icon icon="solar:cup-star-bold" width="14" />
              African Film Honours &amp; Festival Directory
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05, duration: 0.5 }}
              className="mt-4 max-w-3xl font-heading text-4xl font-black leading-tight tracking-tight sm:text-6xl md:text-7xl"
            >
              The ceremonies that
              <span className="block text-brand">crown African cinema</span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="mt-5 max-w-2xl text-sm leading-relaxed text-text-muted sm:text-base md:text-lg"
            >
              Explore premier academies, international festivals, and industry honours across Nigeria and the continent. View entry guidelines, dates, and historical winners tied directly to the films and talent.
            </motion.p>

            {/* Live Stats Bar */}
            {!loading && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.15 }}
                className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4 max-w-3xl"
              >
                <div className="rounded-xl border border-border bg-surface/80 p-3.5 backdrop-blur-sm">
                  <p className="font-heading text-2xl font-black tabular-nums tracking-tight text-text-primary">
                    {allOrganizations.length}
                  </p>
                  <p className="text-[10px] font-black uppercase tracking-wider text-text-muted">
                    Honours &amp; Festivals
                  </p>
                </div>
                <div className="rounded-xl border border-border bg-surface/80 p-3.5 backdrop-blur-sm">
                  <p className="font-heading text-2xl font-black tabular-nums tracking-tight text-text-primary">
                    {catalog.years.length}
                  </p>
                  <p className="text-[10px] font-black uppercase tracking-wider text-text-muted">
                    Editions Archived
                  </p>
                </div>
                <div className="rounded-xl border border-border bg-surface/80 p-3.5 backdrop-blur-sm">
                  <p className="font-heading text-2xl font-black tabular-nums tracking-tight text-text-primary">
                    {catalog.stats.entries || catalog.rows.length}
                  </p>
                  <p className="text-[10px] font-black uppercase tracking-wider text-text-muted">
                    Recorded Entries
                  </p>
                </div>
                <div className="rounded-xl border border-border bg-surface/80 p-3.5 backdrop-blur-sm">
                  <p className="font-heading text-2xl font-black tabular-nums tracking-tight text-text-primary">
                    {(catalog.stats.films || 0) + (catalog.stats.people || 0)}
                  </p>
                  <p className="text-[10px] font-black uppercase tracking-wider text-text-muted">
                    Honoured Films &amp; Cast
                  </p>
                </div>
              </motion.div>
            )}
          </div>
        </header>

        <main className="px-4 py-10 sm:px-6 lg:px-8 space-y-12">
          {/* Controls Bar: Live Search & Category Chips */}
          <div className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              {/* Search Bar */}
              <div className="relative flex-1 max-w-xl">
                <Icon
                  icon="solar:magnifer-linear"
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted"
                  width="18"
                />
                <input
                  type="text"
                  placeholder="Search awards, festivals, cities (Lagos, Abuja, Kano, Enugu), categories…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full rounded-xl border border-border bg-surface py-3 pl-11 pr-10 text-xs sm:text-sm font-medium text-text-primary placeholder:text-text-muted focus:border-brand focus:outline-none transition-all shadow-sm"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary"
                  >
                    <Icon icon="solar:close-circle-bold" width="16" />
                  </button>
                )}
              </div>

              <span className="text-xs font-bold text-text-muted">
                Showing {filteredOrgs.length} of {allOrganizations.length} honours
              </span>
            </div>

            {/* Category Filter Chips */}
            <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
              {CATEGORY_TABS.map((tab) => {
                const active = selectedCategory === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setSelectedCategory(tab.id)}
                    className={`inline-flex shrink-0 items-center gap-1.5 rounded-xl border px-3.5 py-2 text-xs font-bold transition-all ${
                      active
                        ? 'border-brand bg-brand text-white shadow-md shadow-brand/20'
                        : 'border-border bg-surface text-text-muted hover:border-brand/40 hover:text-text-primary'
                    }`}
                  >
                    <Icon icon={tab.icon} width="14" />
                    {tab.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Directory Cards Grid */}
          {loading ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 9 }).map((_, i) => (
                <div
                  key={i}
                  className="h-64 animate-pulse rounded-2xl border border-border bg-surface-2"
                />
              ))}
            </div>
          ) : error ? (
            <p className="rounded-2xl border border-red-500/30 bg-red-500/5 px-6 py-8 text-center text-sm font-bold text-red-500">
              {error}
            </p>
          ) : filteredOrgs.length === 0 ? (
            <div className="rounded-2xl border border-border bg-surface p-12 text-center">
              <Icon icon="solar:cup-star-linear" className="mx-auto text-text-muted" width="40" />
              <p className="mt-3 text-base font-bold text-text-primary">
                No ceremonies found matching "{searchQuery}"
              </p>
              <p className="mt-1 text-xs text-text-muted">
                Try searching for a different keyword or resetting your filter.
              </p>
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setSelectedCategory('all');
                }}
                className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-brand px-4 py-2 text-xs font-bold text-white"
              >
                Reset Search
              </button>
            </div>
          ) : (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {filteredOrgs.map((org) => {
                const stats = orgStatsMap.get(org.id) || { entries: 0, winners: 0, years: new Set() };
                const yearCount = stats.years.size;

                return (
                  <Link
                    key={org.id}
                    to={`/awards/${org.id}`}
                    className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-border bg-surface p-6 transition-all duration-300 hover:-translate-y-1.5 hover:border-brand/40 hover:shadow-xl"
                  >
                    {/* Glowing Top Accent Bar */}
                    <div
                      className="absolute left-0 top-0 h-1.5 w-full transition-all duration-300 group-hover:h-2"
                      style={{ background: org.accent }}
                      aria-hidden="true"
                    />

                    {/* Ambient Glow */}
                    <div
                      className="pointer-events-none absolute -right-8 -top-8 h-28 w-28 rounded-full opacity-0 blur-2xl transition-opacity duration-500 group-hover:opacity-30"
                      style={{ background: org.accent }}
                      aria-hidden="true"
                    />

                    <div>
                      {/* Category & Location Badge */}
                      <div className="flex items-center justify-between gap-2">
                        <span
                          className="rounded-md px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-white"
                          style={{ background: org.accent }}
                        >
                          {CATEGORY_LABELS[org.category] || 'Honours'}
                        </span>
                        <span className="text-[11px] font-bold text-text-muted">
                          {org.location?.split(',')[0] || 'Nigeria'}
                        </span>
                      </div>

                      {/* Header Title */}
                      <div className="mt-4">
                        <h3 className="font-heading text-2xl font-black tracking-tight text-text-primary group-hover:text-brand transition-colors">
                          {org.label}
                        </h3>
                        <p className="mt-0.5 text-xs font-semibold text-text-primary line-clamp-1">
                          {org.full}
                        </p>
                      </div>

                      {/* About Snippet */}
                      <p className="mt-3 text-xs leading-relaxed text-text-muted line-clamp-3">
                        {org.about}
                      </p>

                      {/* Key Metadata Tag Badges */}
                      <div className="mt-4 flex flex-wrap gap-1.5">
                        {org.frequency && (
                          <span className="rounded bg-surface-2 px-2 py-0.5 text-[10px] font-bold text-text-muted">
                            📅 {org.frequency}
                          </span>
                        )}
                        {yearCount > 0 && (
                          <span className="rounded bg-surface-2 px-2 py-0.5 text-[10px] font-bold text-text-muted">
                            🏆 {yearCount} Editions
                          </span>
                        )}
                        {stats.entries > 0 && (
                          <span className="rounded bg-surface-2 px-2 py-0.5 text-[10px] font-bold text-text-muted">
                            {stats.entries} Entries
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Bottom Action Footer */}
                    <div className="mt-6 pt-4 border-t border-border flex items-center justify-between">
                      <span className="text-[10px] font-black uppercase tracking-wider text-text-muted">
                        {org.entryPlan?.fees || 'Official Submissions'}
                      </span>
                      <span className="inline-flex items-center gap-1 text-xs font-black text-brand transition-transform group-hover:translate-x-1">
                        View Details &amp; Winners
                        <Icon icon="solar:arrow-right-linear" width="14" />
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}

          {/* Section: Recent African Award Winners Spotlight */}
          {!loading && recentSpotlightWinners.length > 0 && (
            <section className="rounded-2xl border border-border bg-surface p-6 sm:p-8 space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-border pb-4">
                <div>
                  <span className="text-[10px] font-black uppercase tracking-[0.28em] text-brand">
                    Spotlight
                  </span>
                  <h2 className="font-heading text-2xl font-black tracking-tight text-text-primary sm:text-3xl">
                    Recent Award-Winning Work &amp; Talent
                  </h2>
                </div>
                <p className="text-xs text-text-muted">
                  Top honours conferred across recent African ceremonies
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {recentSpotlightWinners.map((winner, idx) => {
                  const person = winner.person;
                  const film = winner.film;
                  const orgMeta = getAwardOrg(winner.org);
                  const filmTo = film?.slug || film?.id ? `/films/${film.slug || film.id}` : null;
                  const personTo = person?.slug || person?.id ? `/people/${person.slug || person.id}` : null;

                  return (
                    <article
                      key={idx}
                      className="group flex gap-3.5 rounded-xl border border-border bg-surface-2/70 p-3.5 transition-all hover:border-brand/40 hover:shadow-md"
                    >
                      {filmTo ? (
                        <Link
                          to={filmTo}
                          className="h-20 w-14 shrink-0 overflow-hidden rounded-lg border border-border bg-surface"
                        >
                          <ImageWithFallback
                            src={film?.poster_url || person?.photo_url}
                            alt={film?.title || person?.name || ''}
                            name={film?.title || person?.name || ''}
                            fallbackType={film?.poster_url ? 'film' : 'avatar'}
                            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                          />
                        </Link>
                      ) : (
                        <div className="flex h-20 w-14 shrink-0 items-center justify-center rounded-lg border border-border bg-surface text-text-muted">
                          <Icon icon="solar:cup-star-bold" className="text-brand" width="20" />
                        </div>
                      )}

                      <div className="flex min-w-0 flex-1 flex-col justify-center gap-1">
                        <div className="flex items-center gap-1.5">
                          <span
                            className="rounded px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider text-white"
                            style={{ background: orgMeta.accent }}
                          >
                            {orgMeta.label} {winner.year}
                          </span>
                          <span className="text-[10px] font-bold text-text-muted truncate">
                            {winner.category}
                          </span>
                        </div>

                        {person?.name && (
                          <Link
                            to={personTo || '#'}
                            className="text-xs font-black text-text-primary hover:text-brand truncate"
                          >
                            {formatPersonName(person.name)}
                          </Link>
                        )}

                        {film?.title && (
                          <Link
                            to={filmTo || '#'}
                            className="text-xs font-semibold text-text-muted hover:text-text-primary truncate"
                          >
                            {formatFilmTitle(film.title)}
                          </Link>
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          )}
        </main>
      </div>
    </div>
  );
}
