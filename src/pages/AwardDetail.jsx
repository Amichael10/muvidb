import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { Icon } from '@iconify/react';
import { getAwardOrg, groupAwards, loadAwardsCatalog, normOrg } from '../lib/awards';
import ImageWithFallback from '../components/ui/ImageWithFallback';
import { formatFilmTitle, formatPersonName, toTitleCase } from '../utils/format';

const CATEGORY_LABELS = {
  academy: 'Academy Honours',
  festival: 'International Film Festival',
  indigenous: 'Indigenous & Cultural',
  industry: 'Industry & Business',
  impact: 'Social Impact & Advocacy',
};

export default function AwardDetail() {
  const { id } = useParams();
  const orgId = normOrg(id);
  const meta = getAwardOrg(orgId);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [catalog, setCatalog] = useState({ rows: [], orgs: [], years: [], stats: {} });
  const [selectedYear, setSelectedYear] = useState(null);
  const [categorySearch, setCategorySearch] = useState('');
  const [viewMode, setViewMode] = useState('table'); // 'table' | 'list' | 'grid'
  const [winnersOnly, setWinnersOnly] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('all');

  useEffect(() => {
    document.title = `${meta.label} (${meta.full}) | MuviDB Awards`;
    window.scrollTo(0, 0);
  }, [meta.label, meta.full]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const data = await loadAwardsCatalog();
        if (cancelled) return;
        setCatalog(data);

        // Find years specifically for this org
        const years = [
          ...new Set(
            data.rows
              .filter((r) => r.org.toLowerCase() === orgId.toLowerCase() || r.org === meta.id)
              .map((r) => r.year)
              .filter(Boolean)
          ),
        ].sort((a, b) => b - a);

        if (years.length > 0) {
          setSelectedYear(years[0]);
        }
      } catch (err) {
        console.error('Failed to load awards catalog:', err);
        if (!cancelled) setError(err.message || 'Failed to load awards catalog');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [orgId, meta.id]);

  // Filter rows for this ceremony
  const orgRows = useMemo(() => {
    return catalog.rows.filter(
      (r) => r.org.toLowerCase() === orgId.toLowerCase() || r.org === meta.id
    );
  }, [catalog.rows, orgId, meta.id]);

  const yearsForOrg = useMemo(() => {
    return [...new Set(orgRows.map((r) => r.year).filter(Boolean))].sort((a, b) => b - a);
  }, [orgRows]);

  // When years load or change
  useEffect(() => {
    if (yearsForOrg.length > 0 && (!selectedYear || !yearsForOrg.includes(selectedYear))) {
      setSelectedYear(yearsForOrg[0]);
    }
  }, [yearsForOrg, selectedYear]);

  // Group by category for the selected year
  const allCategories = useMemo(() => {
    return groupAwards(orgRows, { year: selectedYear });
  }, [orgRows, selectedYear]);

  // Filter categories by live search query, selectedCategory, and winnersOnly
  const filteredCategories = useMemo(() => {
    let result = allCategories;

    if (selectedCategory && selectedCategory !== 'all') {
      result = result.filter((cat) => cat.category === selectedCategory);
    }

    if (winnersOnly) {
      result = result.filter((cat) => cat.winners.length > 0);
    }

    if (!categorySearch.trim()) return result;
    const query = categorySearch.toLowerCase().trim();
    return result.filter((cat) => {
      if (cat.category.toLowerCase().includes(query)) return true;
      const matchWinner = cat.winners.some(
        (w) =>
          (w.person?.name && w.person.name.toLowerCase().includes(query)) ||
          (w.film?.title && w.film.title.toLowerCase().includes(query)) ||
          (w.work && w.work.toLowerCase().includes(query))
      );
      const matchNominee = cat.nominees.some(
        (n) =>
          (n.person?.name && n.person.name.toLowerCase().includes(query)) ||
          (n.film?.title && n.film.title.toLowerCase().includes(query)) ||
          (n.work && n.work.toLowerCase().includes(query))
      );
      return matchWinner || matchNominee;
    });
  }, [allCategories, categorySearch, selectedCategory, winnersOnly]);

  const totalWinnersInYear = useMemo(() => {
    return allCategories.reduce((acc, cat) => acc + cat.winners.length, 0);
  }, [allCategories]);

  const totalNomineesInYear = useMemo(() => {
    return allCategories.reduce((acc, cat) => acc + cat.nominees.length, 0);
  }, [allCategories]);

  const totalWinnersOverall = useMemo(() => {
    return orgRows.filter((r) => r.won).length;
  }, [orgRows]);

  const totalEntriesOverall = useMemo(() => {
    return orgRows.length;
  }, [orgRows]);

  return (
    <div className="min-h-screen bg-bg text-text-primary">
      <div className="mx-auto max-w-7xl border-x border-border min-h-screen">

        {/* Hero Section */}
        <header className="relative overflow-hidden border-b border-border bg-surface/40">
          {/* Ambient Glow */}
          <div
            className="pointer-events-none absolute -right-20 top-0 h-[460px] w-[460px] rounded-full opacity-25 blur-3xl"
            style={{ background: `radial-gradient(circle, ${meta.accent}66, transparent 70%)` }}
            aria-hidden="true"
          />
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.035]"
            style={{
              backgroundImage:
                'radial-gradient(circle at 1px 1px, var(--color-text-primary) 1px, transparent 0)',
              backgroundSize: '24px 24px',
            }}
            aria-hidden="true"
          />

          <div className="relative px-4 pb-10 pt-12 sm:px-6 lg:px-8 md:pb-14 md:pt-16">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
              <div className="max-w-3xl">
                {/* Category & Badge */}
                <div className="flex flex-wrap items-center gap-2.5">
                  <span
                    className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[11px] font-black uppercase tracking-wider text-white"
                    style={{ background: meta.accent }}
                  >
                    <Icon icon="solar:cup-star-bold" width="13" />
                    {CATEGORY_LABELS[meta.category] || 'Awards Ceremony'}
                  </span>
                  {meta.founded && (
                    <span className="rounded-md border border-border bg-surface px-2.5 py-1 text-[11px] font-bold text-text-muted">
                      Est. {meta.founded}
                    </span>
                  )}
                  <span className="rounded-md border border-border bg-surface px-2.5 py-1 text-[11px] font-bold text-text-muted">
                    {meta.location}
                  </span>
                </div>

                {/* Title */}
                <motion.h1
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-4 font-heading text-4xl font-black leading-tight tracking-tight sm:text-5xl lg:text-6xl"
                >
                  {meta.full}
                </motion.h1>

                {/* Tagline */}
                {meta.tagline && (
                  <p className="mt-2 text-base font-semibold text-brand sm:text-lg">
                    {meta.tagline}
                  </p>
                )}

                {/* Short Explainer */}
                <p className="mt-4 text-sm leading-relaxed text-text-muted sm:text-base">
                  {meta.about}
                </p>

                {/* Tags */}
                {meta.tags && meta.tags.length > 0 && (
                  <div className="mt-5 flex flex-wrap gap-1.5">
                    {meta.tags.map((tag) => (
                      <span
                        key={tag}
                        className="rounded border border-border bg-surface-2/80 px-2 py-0.5 text-[11px] font-bold text-text-muted"
                      >
                        #{tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Action Buttons / Portal Link */}
              <div className="flex flex-col gap-3 lg:items-end">
                {meta.submitUrl && (
                  <a
                    href={meta.submitUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand px-5 py-3 text-sm font-black text-white shadow-lg shadow-brand/20 transition-all hover:bg-brand-hover hover:gap-3"
                  >
                    <span>{meta.submitLabel || 'Official Entry Portal'}</span>
                    <Icon icon="solar:arrow-right-up-linear" width="16" />
                  </a>
                )}

                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-2">
                  <div className="rounded-xl border border-border bg-surface p-3 text-center">
                    <p className="font-heading text-xl font-black tabular-nums text-text-primary">
                      {yearsForOrg.length}
                    </p>
                    <p className="text-[10px] font-black uppercase tracking-wider text-text-muted">
                      Editions
                    </p>
                  </div>
                  <div className="rounded-xl border border-border bg-surface p-3 text-center">
                    <p className="font-heading text-xl font-black tabular-nums text-text-primary">
                      {totalWinnersOverall}
                    </p>
                    <p className="text-[10px] font-black uppercase tracking-wider text-text-muted">
                      Total Winners
                    </p>
                  </div>
                  <div className="rounded-xl border border-border bg-surface p-3 text-center col-span-2 sm:col-span-1 lg:col-span-2">
                    <p className="font-heading text-xl font-black tabular-nums text-text-primary">
                      {totalEntriesOverall}
                    </p>
                    <p className="text-[10px] font-black uppercase tracking-wider text-text-muted">
                      Total Entries Recorded
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </header>

        <main className="px-4 py-10 sm:px-6 lg:px-8 space-y-12">
          {/* SECTION 1: FilmFreeway-Style Ceremony & Entry Information */}
          <section className="rounded-2xl border border-border bg-surface overflow-hidden">
            <div className="h-1.5 w-full" style={{ background: meta.accent }} aria-hidden="true" />
            <div className="p-5 sm:p-7 border-b border-border flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <h2 className="font-heading text-2xl font-black tracking-tight text-text-primary">
                  Ceremony &amp; Entry Guidelines
                </h2>
                <p className="text-xs text-text-muted mt-0.5">
                  Official specifications, dates, eligibility windows, and submission details.
                </p>
              </div>
              {meta.submitUrl && (
                <a
                  href={meta.submitUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-brand hover:underline"
                >
                  Visit Official Website
                  <Icon icon="solar:arrow-right-up-linear" width="14" />
                </a>
              )}
            </div>

            <div className="grid gap-px border-t border-border bg-border md:grid-cols-3">
              {/* Tile 1: About */}
              <div className="bg-surface p-6 space-y-3">
                <div className="flex items-center gap-2 text-brand">
                  <Icon icon="solar:info-circle-linear" width="18" />
                  <h3 className="text-xs font-black uppercase tracking-widest text-text-primary">
                    About the Institution
                  </h3>
                </div>
                <p className="text-xs leading-relaxed text-text-muted">{meta.about}</p>
                <div className="pt-2 border-t border-border/60">
                  <span className="text-[10px] font-black uppercase tracking-wider text-text-muted">
                    Location:
                  </span>
                  <p className="text-xs font-bold text-text-primary">{meta.location}</p>
                </div>
              </div>

              {/* Tile 2: Dates & Schedule */}
              <div className="bg-surface p-6 space-y-3">
                <div className="flex items-center gap-2 text-brand">
                  <Icon icon="solar:calendar-linear" width="18" />
                  <h3 className="text-xs font-black uppercase tracking-widest text-text-primary">
                    Event Dates &amp; Timeline
                  </h3>
                </div>
                <p className="text-xs leading-relaxed text-text-muted">{meta.when}</p>
                <div className="pt-2 border-t border-border/60">
                  <span className="text-[10px] font-black uppercase tracking-wider text-text-muted">
                    Frequency:
                  </span>
                  <p className="text-xs font-bold text-text-primary">{meta.frequency}</p>
                </div>
              </div>

              {/* Tile 3: Rules & Entry Plan */}
              <div className="bg-surface p-6 space-y-3">
                <div className="flex items-center gap-2 text-brand">
                  <Icon icon="solar:document-text-linear" width="18" />
                  <h3 className="text-xs font-black uppercase tracking-widest text-text-primary">
                    Submission &amp; Entry Plan
                  </h3>
                </div>
                <p className="text-xs leading-relaxed text-text-muted">{meta.submissions}</p>
                {meta.entryPlan && (
                  <div className="mt-3 space-y-2 pt-2 border-t border-border/60 text-xs">
                    <div>
                      <span className="text-[10px] font-black uppercase tracking-wider text-text-muted">
                        Fees:
                      </span>
                      <p className="font-bold text-text-primary">{meta.entryPlan.fees}</p>
                    </div>
                    {meta.entryPlan.formats && (
                      <div>
                        <span className="text-[10px] font-black uppercase tracking-wider text-text-muted">
                          Accepted Formats:
                        </span>
                        <p className="text-text-muted">{meta.entryPlan.formats}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* SECTION 2: Editions Archive & Winners */}
          <section className="space-y-6">
            <div className="flex flex-col gap-4 border-b border-border pb-4">
              <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.3em] text-brand">
                    Editions Archive
                  </p>
                  <h2 className="mt-1 font-heading text-3xl font-black tracking-tight text-text-primary">
                    {meta.label} {selectedYear ? `${selectedYear} Winners & Nominees` : 'Archive'}
                  </h2>
                  {selectedYear && (
                    <p className="mt-1 text-xs text-text-muted">
                      {totalWinnersInYear} winners across {allCategories.length} categories in {selectedYear}
                    </p>
                  )}
                </div>

                {/* Toolbar: Search, Winners Only Filter & View Switcher */}
                <div className="flex flex-wrap sm:flex-nowrap items-center gap-2.5">
                  {/* Search input */}
                  <div className="relative w-full sm:w-64">
                    <Icon
                      icon="solar:magnifer-linear"
                      className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted"
                      width="16"
                    />
                    <input
                      type="text"
                      placeholder="Filter category or nominee…"
                      value={categorySearch}
                      onChange={(e) => setCategorySearch(e.target.value)}
                      className="w-full rounded-xl border border-border/70 bg-surface/70 py-2 pl-9 pr-8 text-xs font-semibold text-text-primary placeholder:text-text-muted focus:border-brand focus:outline-none"
                    />
                    {categorySearch && (
                      <button
                        type="button"
                        onClick={() => setCategorySearch('')}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary"
                      >
                        <Icon icon="solar:close-circle-bold" width="14" />
                      </button>
                    )}
                  </div>

                  {/* Winners Only Toggle */}
                  <button
                    type="button"
                    onClick={() => setWinnersOnly(!winnersOnly)}
                    className={`shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      winnersOnly
                        ? 'bg-amber-500/20 text-amber-400 border border-amber-500/50 shadow-sm'
                        : 'bg-surface/70 border border-border/70 text-text-muted hover:text-text-primary'
                    }`}
                    title={winnersOnly ? 'Showing winners only' : 'Filter to winners only'}
                  >
                    <Icon icon="solar:cup-star-bold" className="w-4 h-4 text-amber-400" />
                    <span>Winners Only</span>
                  </button>

                  {/* View Mode Toggle: Table vs List vs Grid */}
                  <div className="flex items-center gap-1 bg-surface/80 border border-border/70 rounded-xl p-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => setViewMode('table')}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        viewMode === 'table'
                          ? 'bg-brand text-black shadow-xs'
                          : 'text-text-muted hover:text-text-primary'
                      }`}
                      title="Compact Table View"
                    >
                      <Icon icon="solar:checklist-minimalistic-bold" className="w-4 h-4" />
                      <span>Table</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setViewMode('list')}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        viewMode === 'list'
                          ? 'bg-brand text-black shadow-xs'
                          : 'text-text-muted hover:text-text-primary'
                      }`}
                      title="Editorial List View"
                    >
                      <Icon icon="solar:list-bold" className="w-4 h-4" />
                      <span>List</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setViewMode('grid')}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        viewMode === 'grid'
                          ? 'bg-brand text-black shadow-xs'
                          : 'text-text-muted hover:text-text-primary'
                      }`}
                      title="Card Grid View"
                    >
                      <Icon icon="solar:widget-4-bold" className="w-4 h-4" />
                      <span>Grid</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Quick Jump Category Scrubber */}
              {allCategories.length > 2 && (
                <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-2 text-xs">
                  <span className="text-[10px] font-black uppercase tracking-wider text-text-muted shrink-0 mr-1 flex items-center gap-1">
                    <Icon icon="solar:filter-linear" className="w-3.5 h-3.5" />
                    Categories:
                  </span>
                  <button
                    type="button"
                    onClick={() => setSelectedCategory('all')}
                    className={`px-3 py-1 rounded-full text-xs font-semibold transition-all shrink-0 cursor-pointer ${
                      selectedCategory === 'all'
                        ? 'bg-text-primary text-bg font-bold shadow-xs'
                        : 'bg-surface-2/60 text-text-muted hover:text-text-primary hover:bg-surface-2'
                    }`}
                  >
                    All ({allCategories.length})
                  </button>
                  {allCategories.map((cat) => (
                    <button
                      key={cat.category}
                      type="button"
                      onClick={() => setSelectedCategory(cat.category === selectedCategory ? 'all' : cat.category)}
                      className={`px-3 py-1 rounded-full text-xs font-semibold transition-all shrink-0 cursor-pointer ${
                        selectedCategory === cat.category
                          ? 'bg-brand text-black font-bold shadow-xs'
                          : 'bg-surface-2/60 text-text-muted hover:text-text-primary hover:bg-surface-2'
                      }`}
                    >
                      {cat.category}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Year Selector Scrubber */}
            {yearsForOrg.length > 0 && (
              <div>
                <p className="mb-2 text-[10px] font-black uppercase tracking-wider text-text-muted">
                  Select Edition Year:
                </p>
                <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2">
                  {yearsForOrg.map((y) => {
                    const active = selectedYear === y;
                    const count = orgRows.filter((r) => r.year === y).length;
                    return (
                      <button
                        key={y}
                        type="button"
                        onClick={() => setSelectedYear(y)}
                        className={`group shrink-0 rounded-xl border px-4 py-2.5 text-left transition-all duration-300 ${
                          active
                            ? 'border-brand bg-brand text-white shadow-md shadow-brand/20'
                            : 'border-border bg-surface hover:-translate-y-0.5 hover:border-brand/40'
                        }`}
                      >
                        <span className="block font-heading text-lg font-black tabular-nums leading-none">
                          {y}
                        </span>
                        <span
                          className={`mt-0.5 block text-[9px] font-bold uppercase tracking-wider ${
                            active ? 'text-white/80' : 'text-text-muted group-hover:text-brand'
                          }`}
                        >
                          {count} entries
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Loading / Error / Empty States */}
            {loading && (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 pt-6">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div
                    key={i}
                    className="h-32 animate-pulse rounded-2xl border border-border bg-surface-2"
                  />
                ))}
              </div>
            )}

            {error && (
              <p className="rounded-2xl border border-red-500/30 bg-red-500/5 px-6 py-8 text-center text-sm font-bold text-red-500">
                {error}
              </p>
            )}

            {!loading && !error && filteredCategories.length === 0 && (
              <div className="rounded-2xl border border-border bg-surface p-12 text-center">
                <Icon icon="solar:cup-star-linear" className="mx-auto text-text-muted" width="36" />
                <p className="mt-2 text-sm font-bold text-text-primary">
                  {categorySearch ? `No categories matching "${categorySearch}"` : 'No awards recorded for this edition yet.'}
                </p>
                <p className="mt-1 text-xs text-text-muted">
                  Check another edition year above or browse other African ceremonies.
                </p>
              </div>
            )}

            {/* Categories Content: Table View vs List View vs Grid View */}
            {!loading && filteredCategories.length > 0 && (
              <div className="pt-2">
                {viewMode === 'table' && (
                  <AwardsTableView
                    categories={filteredCategories}
                    accent={meta.accent}
                    winnersOnly={winnersOnly}
                  />
                )}

                {viewMode === 'list' && (
                  <AwardsListView
                    categories={filteredCategories}
                    accent={meta.accent}
                    winnersOnly={winnersOnly}
                  />
                )}

                {viewMode === 'grid' && (
                  <div className="space-y-10">
                    {filteredCategories.map((cat, index) => (
                      <CategorySection
                        key={cat.category}
                        cat={cat}
                        index={index}
                        accent={meta.accent}
                        winnersOnly={winnersOnly}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}
          </section>
        </main>
      </div>
    </div>
  );
}

{/* ─── HELPER: EXTRACT ENTITY DETAILS ─── */}
function extractAwardEntity(row) {
  const person = row.person;
  const film = row.film;
  const company = row.company;
  const cinema = row.cinema;

  const personTo = person?.slug || person?.id ? `/people/${person.slug || person.id}` : null;
  const filmTo = film?.slug || film?.id ? `/films/${film.slug || film.id}` : null;
  const companyTo = company?.slug || company?.id ? `/companies/${company.slug || company.id}` : null;
  const cinemaTo = cinema?.id ? `/cinemas/${cinema.id}` : null;

  const entity = person
    ? {
        to: personTo,
        image: person.photo_url,
        imageType: 'avatar',
        name: formatPersonName(person.name),
        label: 'Person',
        icon: 'solar:user-linear',
      }
    : company
      ? {
          to: companyTo,
          image: company.logo_url,
          imageType: 'company',
          name: toTitleCase(company.name),
          label: 'Company',
          icon: 'solar:buildings-2-linear',
        }
      : cinema
        ? {
            to: cinemaTo,
            image: cinema.logo_url,
            imageType: 'company',
            name: toTitleCase(cinema.name),
            label: 'Cinema',
            icon: 'solar:city-linear',
          }
        : film
          ? {
              to: filmTo,
              image: film.poster_url,
              imageType: 'film',
              name: formatFilmTitle(film.title),
              label: 'Film',
              icon: 'solar:clapperboard-linear',
            }
          : null;

  const detail = film && !entity?.to?.startsWith('/films/')
    ? formatFilmTitle(film.title)
    : cinema
      ? [toTitleCase(cinema.city), toTitleCase(cinema.state)].filter(Boolean).join(', ')
      : row.work && String(row.work).toLowerCase() !== String(entity?.name || '').toLowerCase()
        ? row.work
        : null;

  return { entity, detail, person, film, company, cinema, personTo, filmTo };
}

{/* ─── 1. TABLE VIEW: ULTRA-SCANNABLE CEREMONY OVERVIEW ─── */}
function AwardsTableView({ categories, accent, winnersOnly }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-border/70 bg-surface/50 shadow-sm backdrop-blur-sm">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="border-b border-border/80 bg-surface-2/60 text-[10px] font-black uppercase tracking-wider text-text-muted">
              <th className="py-3 px-4 w-12 text-center">#</th>
              <th className="py-3 px-4 min-w-[200px]">Category</th>
              <th className="py-3 px-4 min-w-[280px]">🏆 Winner</th>
              {!winnersOnly && (
                <th className="py-3 px-4 min-w-[300px]">Nominees &amp; Contenders</th>
              )}
              <th className="py-3 px-4 w-28 text-right">Tally</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/50">
            {categories.map((cat, index) => {
              const hasWinner = cat.winners.length > 0;
              return (
                <tr
                  key={cat.category}
                  id={`cat-${encodeURIComponent(cat.category)}`}
                  className="group hover:bg-surface-2/40 transition-colors"
                >
                  {/* Index */}
                  <td className="py-3.5 px-4 text-center font-heading font-bold text-text-muted/60 tabular-nums">
                    {String(index + 1).padStart(2, '0')}
                  </td>

                  {/* Category Name */}
                  <td className="py-3.5 px-4 font-heading font-black text-sm text-text-primary">
                    <span className="group-hover:text-brand transition-colors">
                      {cat.category}
                    </span>
                  </td>

                  {/* Winner Cell */}
                  <td className="py-3.5 px-4">
                    {hasWinner ? (
                      <div className="space-y-2">
                        {cat.winners.map((row, wi) => {
                          const { entity, detail } = extractAwardEntity(row);
                          return (
                            <div
                              key={wi}
                              className="inline-flex items-center gap-3 p-2 pr-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs shadow-xs"
                            >
                              <div className="relative shrink-0">
                                {entity?.image ? (
                                  <div className="w-9 h-9 rounded-lg overflow-hidden bg-surface-2 border border-amber-500/40">
                                    <ImageWithFallback
                                      src={entity.image}
                                      alt={entity.name || ''}
                                      fallbackType={entity.imageType}
                                      name={entity.name}
                                      className="w-full h-full object-cover"
                                    />
                                  </div>
                                ) : (
                                  <div className="w-9 h-9 rounded-lg bg-amber-500/20 flex items-center justify-center text-amber-400">
                                    <Icon icon="solar:cup-star-bold" className="w-5 h-5" />
                                  </div>
                                )}
                                <span className="absolute -top-1.5 -right-1.5 bg-amber-500 text-black text-[9px] font-black rounded-full w-4 h-4 flex items-center justify-center shadow-xs">
                                  ★
                                </span>
                              </div>
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5">
                                  {entity?.to ? (
                                    <Link
                                      to={entity.to}
                                      className="font-black text-text-primary hover:text-brand truncate text-xs"
                                    >
                                      {entity.name}
                                    </Link>
                                  ) : (
                                    <span className="font-black text-text-primary truncate text-xs">
                                      {entity?.name || 'Winner'}
                                    </span>
                                  )}
                                </div>
                                {detail && (
                                  <div className="text-[11px] text-text-muted truncate flex items-center gap-1 mt-0.5">
                                    {row.film?.slug ? (
                                      <Link
                                        to={`/films/${row.film.slug}`}
                                        className="hover:text-text-primary truncate text-amber-200/90"
                                      >
                                        {detail}
                                      </Link>
                                    ) : (
                                      <span className="text-amber-200/80">{detail}</span>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 text-text-muted/60 text-xs italic">
                        <Icon icon="solar:clock-circle-linear" className="w-3.5 h-3.5" />
                        No winner recorded
                      </span>
                    )}
                  </td>

                  {/* Nominees Cell */}
                  {!winnersOnly && (
                    <td className="py-3.5 px-4">
                      {cat.nominees.length > 0 ? (
                        <div className="flex flex-wrap gap-1.5 max-w-xl">
                          {cat.nominees.map((row, ni) => {
                            const { entity, detail } = extractAwardEntity(row);
                            return (
                              <div
                                key={ni}
                                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-surface-2/60 border border-border/60 text-[11px] text-text-secondary hover:border-border hover:bg-surface-2 transition-colors"
                              >
                                {entity?.to ? (
                                  <Link
                                    to={entity.to}
                                    className="font-bold text-text-primary hover:text-brand truncate max-w-[140px]"
                                    title={entity.name}
                                  >
                                    {entity.name}
                                  </Link>
                                ) : (
                                  <span className="font-bold text-text-primary truncate max-w-[140px]">
                                    {entity?.name || 'Nominee'}
                                  </span>
                                )}
                                {detail && (
                                  <span
                                    className="text-text-muted truncate max-w-[130px]"
                                    title={detail}
                                  >
                                    ({detail})
                                  </span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <span className="text-text-muted/50 text-xs">–</span>
                      )}
                    </td>
                  )}

                  {/* Tally */}
                  <td className="py-3.5 px-4 text-right">
                    <span className="text-[11px] font-bold text-text-muted">
                      {cat.winners.length > 0 ? `${cat.winners.length}W · ` : ''}
                      {cat.nominees.length} Nominees
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

{/* ─── 2. LIST VIEW: EDITORIAL CEREMONY BREAKDOWN ─── */}
function AwardsListView({ categories, accent, winnersOnly }) {
  return (
    <div className="space-y-6">
      {categories.map((cat, index) => {
        const hasWinner = cat.winners.length > 0;
        return (
          <article
            key={cat.category}
            id={`cat-${encodeURIComponent(cat.category)}`}
            className="rounded-2xl border border-border/70 bg-surface/60 p-5 sm:p-6 shadow-sm space-y-4 hover:border-border transition-colors"
          >
            {/* Category Header */}
            <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border/50 pb-3">
              <div className="flex items-baseline gap-3">
                <span className="font-heading text-sm font-black tabular-nums text-text-muted/50">
                  {String(index + 1).padStart(2, '0')}
                </span>
                <h3 className="font-heading text-lg font-black tracking-tight text-text-primary md:text-xl">
                  {cat.category}
                </h3>
              </div>
              <span className="text-[10px] font-black uppercase tracking-wider text-text-muted">
                {cat.winners.length} Winner{cat.winners.length === 1 ? '' : 's'} · {cat.nominees.length} Nominee{cat.nominees.length === 1 ? '' : 's'}
              </span>
            </div>

            {/* Winner Banner */}
            {hasWinner && (
              <div className="space-y-3">
                {cat.winners.map((row, wi) => {
                  const { entity, detail } = extractAwardEntity(row);
                  return (
                    <div
                      key={wi}
                      className="relative overflow-hidden rounded-xl border border-amber-500/40 bg-gradient-to-r from-amber-500/15 via-amber-500/5 to-surface p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
                    >
                      <div className="flex items-center gap-4 min-w-0">
                        <div className="relative shrink-0">
                          {entity?.image ? (
                            <div className="w-14 h-14 rounded-xl overflow-hidden bg-black/40 border border-amber-500/50 shadow-md">
                              <ImageWithFallback
                                src={entity.image}
                                alt={entity.name || ''}
                                fallbackType={entity.imageType}
                                name={entity.name}
                                className="w-full h-full object-cover"
                              />
                            </div>
                          ) : (
                            <div className="w-14 h-14 rounded-xl bg-amber-500/20 flex items-center justify-center text-amber-400">
                              <Icon icon="solar:cup-star-bold" className="w-7 h-7" />
                            </div>
                          )}
                          <span className="absolute -bottom-1 -right-1 bg-amber-500 text-black text-[9px] font-black uppercase px-1.5 py-0.2 rounded-md shadow-xs flex items-center gap-0.5">
                            <Icon icon="solar:cup-star-bold" className="w-2.5 h-2.5" />
                            WIN
                          </span>
                        </div>
                        <div className="min-w-0">
                          <span className="text-[10px] font-black uppercase tracking-wider text-amber-400">
                            Official Winner
                          </span>
                          <h4 className="text-base font-black text-text-primary truncate">
                            {entity?.to ? (
                              <Link to={entity.to} className="hover:text-brand">
                                {entity.name}
                              </Link>
                            ) : (
                              entity?.name || 'Winner'
                            )}
                          </h4>
                          {detail && (
                            <p className="text-xs text-text-muted truncate mt-0.5">
                              {row.film?.slug ? (
                                <Link to={`/films/${row.film.slug}`} className="hover:text-text-primary text-amber-200/90 font-medium">
                                  {detail}
                                </Link>
                              ) : (
                                detail
                              )}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="shrink-0 flex items-center gap-2">
                        {row.film?.slug && (
                          <Link
                            to={`/films/${row.film.slug}`}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-2 text-xs font-bold text-text-primary hover:bg-brand hover:text-black transition-colors"
                          >
                            <Icon icon="solar:clapperboard-linear" className="w-3.5 h-3.5" />
                            <span>View Film</span>
                          </Link>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Nominees Grid (if not winnersOnly) */}
            {!winnersOnly && cat.nominees.length > 0 && (
              <div className="pt-2">
                <p className="text-[10px] font-black uppercase tracking-wider text-text-muted mb-2.5">
                  Other Nominees
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                  {cat.nominees.map((row, ni) => {
                    const { entity, detail } = extractAwardEntity(row);
                    return (
                      <div
                        key={ni}
                        className="flex items-center gap-3 p-2.5 rounded-xl bg-surface-2/40 border border-border/50 hover:bg-surface-2/70 transition-colors"
                      >
                        {entity?.image ? (
                          <div className="w-9 h-9 rounded-lg overflow-hidden bg-black/40 shrink-0 border border-border/50">
                            <ImageWithFallback
                              src={entity.image}
                              alt={entity.name || ''}
                              fallbackType={entity.imageType}
                              name={entity.name}
                              className="w-full h-full object-cover"
                            />
                          </div>
                        ) : (
                          <div className="w-9 h-9 rounded-lg bg-surface-2 flex items-center justify-center text-text-muted shrink-0">
                            <Icon icon="solar:user-linear" className="w-4 h-4" />
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          {entity?.to ? (
                            <Link
                              to={entity.to}
                              className="text-xs font-bold text-text-primary hover:text-brand truncate block"
                            >
                              {entity.name}
                            </Link>
                          ) : (
                            <span className="text-xs font-bold text-text-primary truncate block">
                              {entity?.name || 'Nominee'}
                            </span>
                          )}
                          {detail && (
                            <p className="text-[11px] text-text-muted truncate">
                              {detail}
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </article>
        );
      })}
    </div>
  );
}

{/* ─── 3. GRID VIEW (CATEGORY SECTION) ─── */}
function CategorySection({ cat, index, accent, winnersOnly }) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-40px' }}
      transition={{ duration: 0.35, delay: Math.min(index * 0.02, 0.2) }}
      className="space-y-4"
    >
      <div className="flex items-baseline justify-between border-b border-border/80 pb-2">
        <div className="flex items-baseline gap-2.5">
          <span className="font-heading text-sm font-black tabular-nums text-text-muted/50">
            {String(index + 1).padStart(2, '0')}
          </span>
          <h3 className="font-heading text-lg font-black tracking-tight text-text-primary md:text-xl">
            {cat.category}
          </h3>
        </div>
        <span className="text-[10px] font-black uppercase tracking-wider text-text-muted">
          {cat.winners.length} Winner{cat.winners.length === 1 ? '' : 's'} · {cat.nominees.length} Nominee{cat.nominees.length === 1 ? '' : 's'}
        </span>
      </div>

      {/* Winners */}
      {cat.winners.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {cat.winners.map((row, i) => (
            <AwardCard
              key={`w-${i}-${row.person?.id || row.person?.name}-${row.film?.id || row.work}`}
              row={row}
              winner
              accent={accent}
            />
          ))}
        </div>
      )}

      {/* Nominees (if not winnersOnly) */}
      {!winnersOnly && cat.nominees.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {cat.nominees.map((row, i) => (
            <AwardCard
              key={`n-${i}-${row.person?.id || row.person?.name}-${row.film?.id || row.work}`}
              row={row}
              accent={accent}
            />
          ))}
        </div>
      )}
    </motion.section>
  );
}

function AwardCard({ row, winner = false, accent }) {
  const { entity, detail } = extractAwardEntity(row);

  return (
    <article
      className={`group relative flex gap-3 overflow-hidden rounded-xl border bg-surface/70 p-3 transition-all duration-300 hover:-translate-y-1 hover:shadow-md ${
        winner ? 'border-amber-500/40 bg-amber-500/5' : 'border-border/70 hover:border-brand/40'
      }`}
      style={
        winner
          ? {
              boxShadow: `inset 0 0 0 1px ${accent || '#f59e0b'}55, 0 0 0 0 transparent`,
            }
          : undefined
      }
    >
      {/* Visual Accent Glow on Hover */}
      <span
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{
          background: `linear-gradient(135deg, ${accent || '#f59e0b'}12, transparent 60%)`,
        }}
        aria-hidden="true"
      />

      {entity?.to ? (
        <Link
          to={entity.to}
          className="relative z-[1] h-[84px] w-[58px] shrink-0 overflow-hidden rounded-lg border border-border/70 bg-surface-2"
        >
          <ImageWithFallback
            src={entity.image}
            alt={entity.name || ''}
            name={entity.name || ''}
            fallbackType={entity.imageType}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        </Link>
      ) : (
        <div className="relative z-[1] flex h-[84px] w-[58px] shrink-0 items-center justify-center rounded-lg border border-border/70 bg-surface-2">
          <Icon icon={entity?.icon || 'solar:cup-star-linear'} className="text-lg text-text-muted/40" />
        </div>
      )}

      <div className="relative z-[1] flex min-w-0 flex-1 flex-col justify-center gap-1">
        {winner ? (
          <span
            className="inline-flex w-fit items-center gap-1 rounded px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider text-white"
            style={{ background: accent || '#f59e0b' }}
          >
            <Icon icon="solar:cup-star-bold" width="10" />
            Winner
          </span>
        ) : (
          <span className="text-[9px] font-black uppercase tracking-wider text-text-muted">
            Nominee
          </span>
        )}

        {entity ? (
          entity.to ? (
            <Link to={entity.to} className="min-w-0 transition-colors hover:text-brand">
              <span className="truncate text-xs font-black text-text-primary block">{entity.name}</span>
            </Link>
          ) : (
            <p className="truncate text-xs font-black text-text-primary">{entity.name}</p>
          )
        ) : (
          <p className="text-[10px] font-black uppercase tracking-widest text-brand">Honour</p>
        )}

        {detail ? (
          <p className="line-clamp-2 text-[11px] leading-snug text-text-muted">{detail}</p>
        ) : (
          <p className="text-[10px] font-bold text-text-muted">{entity?.label || 'Recognition'}</p>
        )}
      </div>
    </article>
  );
}
