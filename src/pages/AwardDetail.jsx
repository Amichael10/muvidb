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
  const [activeViewTab, setActiveViewTab] = useState('winners'); // 'winners' | 'all'

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

  // Filter categories by live search query
  const filteredCategories = useMemo(() => {
    if (!categorySearch.trim()) return allCategories;
    const query = categorySearch.toLowerCase().trim();
    return allCategories.filter((cat) => {
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
  }, [allCategories, categorySearch]);

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
        {/* Top Breadcrumb Header */}
        <div className="border-b border-border bg-surface/50 px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex flex-wrap items-center gap-2 text-xs text-text-muted">
            <Link to="/" className="hover:text-brand transition-colors">
              Home
            </Link>
            <Icon icon="solar:alt-arrow-right-linear" width="12" />
            <Link to="/awards" className="hover:text-brand transition-colors">
              Awards &amp; Festivals
            </Link>
            <Icon icon="solar:alt-arrow-right-linear" width="12" />
            <span className="font-bold text-text-primary">{meta.label}</span>
          </div>
        </div>

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
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between border-b border-border pb-4">
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

              {/* Live Search inside Year */}
              <div className="relative w-full sm:w-72">
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
                  className="w-full rounded-xl border border-border bg-surface py-2 pl-9 pr-8 text-xs font-semibold text-text-primary placeholder:text-text-muted focus:border-brand focus:outline-none"
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

            {/* Categories List */}
            {!loading && filteredCategories.length > 0 && (
              <div className="space-y-10 pt-2">
                {filteredCategories.map((cat, index) => (
                  <CategorySection
                    key={cat.category}
                    cat={cat}
                    index={index}
                    accent={meta.accent}
                  />
                ))}
              </div>
            )}
          </section>
        </main>
      </div>
    </div>
  );
}

function CategorySection({ cat, index, accent }) {
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

      {/* Nominees */}
      {cat.nominees.length > 0 && (
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

  return (
    <article
      className={`group relative flex gap-3 overflow-hidden rounded-xl border bg-surface p-3 transition-all duration-300 hover:-translate-y-1 hover:shadow-md ${
        winner ? 'border-transparent' : 'border-border hover:border-brand/35'
      }`}
      style={
        winner
          ? {
              boxShadow: `inset 0 0 0 1px ${accent}66, 0 0 0 0 transparent`,
            }
          : undefined
      }
    >
      {/* Visual Accent Glow on Hover */}
      <span
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{
          background: `linear-gradient(135deg, ${accent}12, transparent 60%)`,
        }}
        aria-hidden="true"
      />

      {entity?.to ? (
        <Link
          to={entity.to}
          className="relative z-[1] h-[84px] w-[58px] shrink-0 overflow-hidden rounded-lg border border-border bg-surface-2"
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
        <div className="relative z-[1] flex h-[84px] w-[58px] shrink-0 items-center justify-center rounded-lg border border-border bg-surface-2">
          <Icon icon={entity?.icon || 'solar:cup-star-linear'} className="text-lg text-text-muted/40" />
        </div>
      )}

      <div className="relative z-[1] flex min-w-0 flex-1 flex-col justify-center gap-1">
        {winner ? (
          <span
            className="inline-flex w-fit items-center gap-1 rounded px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider text-white"
            style={{ background: accent }}
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
