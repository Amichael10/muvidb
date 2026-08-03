import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { Icon } from '@iconify/react';
import { AWARD_ORGS, groupAwards, loadAwardsCatalog } from '../lib/awards';
import ImageWithFallback from '../components/ui/ImageWithFallback';
import { formatFilmTitle, formatPersonName } from '../utils/format';

function orgMeta(id) {
  return (
    AWARD_ORGS.find((o) => o.id === id) || {
      id,
      label: id,
      full: id,
      accent: 'var(--color-brand)',
      about: 'A film and television awards body represented in the MuviDB catalogue.',
      when: 'Dates vary by edition.',
      submissions: 'Submission rules are set by the organising body each year.',
      submitUrl: null,
    }
  );
}

export default function Awards() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [catalog, setCatalog] = useState({ rows: [], orgs: [], years: [], stats: {} });
  const [org, setOrg] = useState(null);
  const [year, setYear] = useState(null);
  const [infoOpen, setInfoOpen] = useState(true);

  useEffect(() => {
    document.title = 'Awards | MuviDB';
    window.scrollTo(0, 0);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await loadAwardsCatalog();
        if (cancelled) return;
        setCatalog(data);
        const preferred =
          data.orgs.find((o) => o === 'AMVCA') ||
          data.orgs.find((o) => o === 'AMAA') ||
          data.orgs[0] ||
          null;
        setOrg(preferred);
        const yearsForOrg = [
          ...new Set(
            data.rows.filter((r) => r.org === preferred).map((r) => r.year).filter(Boolean)
          ),
        ].sort((a, b) => b - a);
        setYear(yearsForOrg[0] || null);
      } catch (err) {
        console.error(err);
        if (!cancelled) setError(err.message || 'Failed to load awards');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const yearsForOrg = useMemo(() => {
    if (!org) return catalog.years;
    return [
      ...new Set(catalog.rows.filter((r) => r.org === org).map((r) => r.year).filter(Boolean)),
    ].sort((a, b) => b - a);
  }, [catalog.rows, catalog.years, org]);

  useEffect(() => {
    if (!yearsForOrg.length) {
      setYear(null);
      return;
    }
    if (!year || !yearsForOrg.includes(year)) setYear(yearsForOrg[0]);
  }, [yearsForOrg, year]);

  const categories = useMemo(
    () => groupAwards(catalog.rows, { org, year }),
    [catalog.rows, org, year]
  );

  const winCount = useMemo(
    () => catalog.rows.filter((r) => r.org === org && r.year === year && r.won).length,
    [catalog.rows, org, year]
  );

  const meta = orgMeta(org);

  return (
    <div className="min-h-screen bg-bg text-text-primary">
      {/* Site grid shell */}
      <div className="mx-auto max-w-7xl border-x border-border min-h-screen">
        {/* Hero — creative, not a Classification clone */}
        <header className="relative overflow-hidden border-b border-border">
          <div
            className="pointer-events-none absolute -right-24 top-0 h-[420px] w-[420px] rounded-full opacity-30 blur-3xl"
            style={{ background: `radial-gradient(circle, ${meta.accent}55, transparent 70%)` }}
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

          <div className="relative px-4 pb-12 pt-28 sm:px-6 lg:px-8 md:pb-16 md:pt-32">
            <motion.p
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-[11px] font-black uppercase tracking-[0.4em] text-brand"
            >
              Ceremonies · winners · nominations
            </motion.p>

            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05, duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
              className="mt-4 max-w-2xl font-heading text-5xl font-black leading-[0.92] tracking-tighter md:text-7xl"
            >
              The nights that
              <span className="block text-brand">shape the slate</span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.12 }}
              className="mt-6 max-w-lg text-base leading-relaxed text-text-muted md:text-lg"
            >
              Browse African award history on MuviDB — every win and nomination tied back to the
              film and the people who made it.
            </motion.p>

            {!loading && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.2 }}
                className="mt-8 flex flex-wrap gap-3"
              >
                {[
                  { n: catalog.stats.entries || 0, l: 'Entries' },
                  { n: catalog.orgs.length, l: 'Ceremonies' },
                  { n: catalog.years.length, l: 'Years' },
                ].map((s) => (
                  <div
                    key={s.l}
                    className="rounded-2xl border border-border bg-surface/80 px-4 py-3 backdrop-blur-sm transition-transform hover:-translate-y-1 hover:border-brand/40"
                  >
                    <p className="font-heading text-2xl font-black tabular-nums tracking-tight">{s.n}</p>
                    <p className="text-[10px] font-black uppercase tracking-widest text-text-muted">
                      {s.l}
                    </p>
                  </div>
                ))}
              </motion.div>
            )}
          </div>
        </header>

        <div className="px-4 py-10 sm:px-6 lg:px-8 md:py-12">
          {/* Ceremony picker — large interactive cards */}
          <div className="grid gap-3 md:grid-cols-3">
            {(catalog.orgs.length ? catalog.orgs : AWARD_ORGS.map((o) => o.id)).map((id) => {
              const m = orgMeta(id);
              const active = org === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => {
                    setOrg(id);
                    setInfoOpen(true);
                  }}
                  className={`group relative overflow-hidden rounded-2xl border p-5 text-left transition-all duration-300 ${
                    active
                      ? 'border-transparent shadow-lg scale-[1.01]'
                      : 'border-border bg-surface hover:-translate-y-1 hover:border-brand/35 hover:shadow-md'
                  }`}
                  style={
                    active
                      ? {
                          background: `linear-gradient(145deg, ${m.accent} 0%, color-mix(in srgb, ${m.accent} 70%, #111) 100%)`,
                          color: '#fff',
                        }
                      : undefined
                  }
                >
                  <span
                    className={`pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full opacity-0 blur-2xl transition-opacity duration-500 group-hover:opacity-40 ${
                      active ? 'opacity-50' : ''
                    }`}
                    style={{ background: m.accent }}
                    aria-hidden="true"
                  />
                  <p
                    className={`text-[10px] font-black uppercase tracking-[0.28em] ${
                      active ? 'text-white/70' : 'text-text-muted'
                    }`}
                  >
                    Ceremony
                  </p>
                  <p className="mt-2 font-heading text-2xl font-black tracking-tight">{m.label}</p>
                  <p
                    className={`mt-1 text-xs leading-snug line-clamp-2 ${
                      active ? 'text-white/80' : 'text-text-muted'
                    }`}
                  >
                    {m.full}
                  </p>
                  <span
                    className={`mt-4 inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider transition-transform group-hover:translate-x-1 ${
                      active ? 'text-white' : 'text-brand'
                    }`}
                  >
                    {active ? 'Selected' : 'Explore'}
                    <Icon icon="solar:arrow-right-linear" width="14" />
                  </span>
                </button>
              );
            })}
          </div>

          {/* Ceremony explainer */}
          <AnimatePresence mode="wait">
            {org && infoOpen && (
              <motion.section
                key={org}
                initial={{ opacity: 0, y: 12, height: 0 }}
                animate={{ opacity: 1, y: 0, height: 'auto' }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                className="mt-6 overflow-hidden rounded-2xl border border-border bg-surface"
              >
                <div
                  className="h-1 w-full"
                  style={{ background: meta.accent }}
                  aria-hidden="true"
                />
                <div className="flex items-start justify-between gap-4 p-5 md:p-7">
                  <div className="min-w-0">
                    <p className="text-[10px] font-black uppercase tracking-[0.3em] text-text-muted">
                      What is {meta.label}?
                    </p>
                    <h2 className="mt-1 font-heading text-2xl font-black tracking-tight md:text-3xl">
                      {meta.full}
                    </h2>
                  </div>
                  <button
                    type="button"
                    onClick={() => setInfoOpen(false)}
                    className="shrink-0 rounded-full border border-border p-2 text-text-muted transition-colors hover:border-brand hover:text-brand"
                    aria-label="Collapse ceremony info"
                  >
                    <Icon icon="solar:alt-arrow-up-linear" width="18" />
                  </button>
                </div>

                <div className="grid gap-px border-t border-border bg-border md:grid-cols-3">
                  <InfoTile
                    icon="solar:info-circle-linear"
                    title="What it means"
                    body={meta.about}
                  />
                  <InfoTile
                    icon="solar:calendar-linear"
                    title="When it usually happens"
                    body={meta.when}
                  />
                  <InfoTile
                    icon="solar:upload-linear"
                    title="Film submissions"
                    body={meta.submissions}
                    action={
                      meta.submitUrl
                        ? { href: meta.submitUrl, label: meta.submitLabel || 'Official portal' }
                        : null
                    }
                  />
                </div>
              </motion.section>
            )}
          </AnimatePresence>

          {org && !infoOpen && (
            <button
              type="button"
              onClick={() => setInfoOpen(true)}
              className="mt-4 inline-flex items-center gap-2 text-xs font-bold text-brand hover:underline"
            >
              <Icon icon="solar:info-circle-linear" width="16" />
              About {meta.label} — timing &amp; submissions
            </button>
          )}

          {/* Year scrubber */}
          {yearsForOrg.length > 0 && (
            <div className="mt-10">
              <p className="mb-3 text-[10px] font-black uppercase tracking-[0.28em] text-text-muted">
                Edition year
              </p>
              <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
                {yearsForOrg.map((y) => {
                  const active = year === y;
                  const count = catalog.rows.filter(
                    (r) => r.org === org && r.year === y
                  ).length;
                  return (
                    <button
                      key={y}
                      type="button"
                      onClick={() => setYear(y)}
                      className={`group shrink-0 rounded-2xl border px-4 py-3 text-left transition-all duration-300 ${
                        active
                          ? 'border-brand bg-brand text-white shadow-md shadow-brand/20'
                          : 'border-border bg-surface hover:-translate-y-1 hover:border-brand/40 hover:shadow-sm'
                      }`}
                    >
                      <span className="block font-heading text-xl font-black tabular-nums leading-none">
                        {y}
                      </span>
                      <span
                        className={`mt-1 block text-[10px] font-bold uppercase tracking-wider ${
                          active ? 'text-white/70' : 'text-text-muted group-hover:text-brand'
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

          {/* Results header */}
          {org && !loading && (
            <div className="mt-12 mb-6 flex flex-wrap items-end justify-between gap-4 border-b border-border pb-4">
              <div>
                <h2 className="font-heading text-3xl font-black tracking-tighter md:text-4xl">
                  {meta.label} {year}
                </h2>
                <p className="mt-1 text-sm text-text-muted">
                  {winCount} winners across {categories.length} categories
                </p>
              </div>
            </div>
          )}

          {loading && (
            <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className="h-40 animate-pulse rounded-2xl border border-border bg-surface-2"
                />
              ))}
            </div>
          )}

          {error && (
            <p className="mt-10 rounded-2xl border border-red-500/30 bg-red-500/5 px-6 py-8 text-center text-sm font-bold text-red-500">
              {error}
            </p>
          )}

          {!loading && !error && categories.length === 0 && (
            <p className="mt-10 py-16 text-center text-text-muted">
              No awards for this selection yet.
            </p>
          )}

          {!loading && categories.length > 0 && (
            <div className="space-y-12">
              {categories.map((cat, index) => (
                <CategorySection key={cat.category} cat={cat} index={index} accent={meta.accent} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function InfoTile({ icon, title, body, action }) {
  return (
    <div className="bg-surface p-5 md:p-6 transition-colors hover:bg-surface-2/60">
      <div className="mb-3 flex items-center gap-2 text-brand">
        <Icon icon={icon} width="18" />
        <h3 className="text-[11px] font-black uppercase tracking-[0.2em]">{title}</h3>
      </div>
      <p className="text-sm leading-relaxed text-text-muted">{body}</p>
      {action?.href && (
        <a
          href={action.href}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-4 inline-flex items-center gap-1.5 text-xs font-bold text-brand transition-all hover:gap-2.5"
        >
          {action.label}
          <Icon icon="solar:arrow-right-up-linear" width="14" />
        </a>
      )}
    </div>
  );
}

function CategorySection({ cat, index, accent }) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-40px' }}
      transition={{ duration: 0.4, delay: Math.min(index * 0.03, 0.2) }}
    >
      <div className="mb-4 flex items-baseline gap-3">
        <span className="font-heading text-sm font-black tabular-nums text-text-muted/40">
          {String(index + 1).padStart(2, '0')}
        </span>
        <h3 className="font-heading text-xl font-black tracking-tight md:text-2xl">
          {cat.category}
        </h3>
        <span className="text-[10px] font-black uppercase tracking-widest text-text-muted">
          {cat.winners.length}W · {cat.nominees.length}N
        </span>
      </div>

      {cat.winners.length > 0 && (
        <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
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

      {cat.nominees.length > 0 && (
        <>
          <p className="mb-2 text-[10px] font-black uppercase tracking-[0.22em] text-text-muted">
            Nominees
          </p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {cat.nominees.map((row, i) => (
              <AwardCard
                key={`n-${i}-${row.person?.id || row.person?.name}-${row.film?.id || row.work}`}
                row={row}
                accent={accent}
              />
            ))}
          </div>
        </>
      )}
    </motion.section>
  );
}

function AwardCard({ row, winner = false, accent }) {
  const person = row.person;
  const film = row.film;
  const personTo = person?.slug || person?.id ? `/people/${person.slug || person.id}` : null;
  const filmTo = film?.slug || film?.id ? `/films/${film.slug || film.id}` : null;

  return (
    <article
      className={`group relative flex gap-3 overflow-hidden rounded-2xl border bg-surface p-3 transition-all duration-300 hover:-translate-y-1.5 hover:shadow-xl ${
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
      {/* Hover wash */}
      <span
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{
          background: `linear-gradient(135deg, ${accent}14, transparent 55%)`,
        }}
        aria-hidden="true"
      />

      {filmTo ? (
        <Link
          to={filmTo}
          className="relative z-[1] h-[88px] w-[60px] shrink-0 overflow-hidden rounded-xl border border-border bg-surface-2"
        >
          <ImageWithFallback
            src={film?.poster_url}
            alt={film?.title || ''}
            name={film?.title || ''}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
          />
        </Link>
      ) : (
        <div className="relative z-[1] flex h-[88px] w-[60px] shrink-0 items-center justify-center rounded-xl border border-border bg-surface-2">
          <Icon icon="solar:clapperboard-linear" className="text-xl text-text-muted/40" />
        </div>
      )}

      <div className="relative z-[1] flex min-w-0 flex-1 flex-col justify-center gap-1">
        {winner && (
          <span
            className="inline-flex w-fit items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-white"
            style={{ background: accent }}
          >
            <Icon icon="solar:cup-star-bold" width="11" />
            Winner
          </span>
        )}

        {person ? (
          personTo ? (
            <Link
              to={personTo}
              className="flex min-w-0 items-center gap-2 transition-colors hover:text-brand"
            >
              <span className="h-7 w-7 shrink-0 overflow-hidden rounded-full border border-border bg-surface-2 ring-0 transition-all group-hover:ring-2 group-hover:ring-brand/30">
                <ImageWithFallback
                  src={person.photo_url}
                  alt=""
                  fallbackType="avatar"
                  name={person.name}
                  className="h-full w-full object-cover"
                  width={56}
                  sizes="28px"
                  loading="lazy"
                />
              </span>
              <span className="truncate text-sm font-bold">{formatPersonName(person.name)}</span>
            </Link>
          ) : (
            <p className="truncate text-sm font-bold">{formatPersonName(person.name)}</p>
          )
        ) : (
          <p className="text-[10px] font-black uppercase tracking-widest text-brand">Film award</p>
        )}

        {film ? (
          filmTo ? (
            <Link
              to={filmTo}
              className="line-clamp-2 text-xs leading-snug text-text-muted transition-colors hover:text-text-primary"
            >
              {formatFilmTitle(film.title)}
            </Link>
          ) : (
            <p className="line-clamp-2 text-xs leading-snug text-text-muted">
              {formatFilmTitle(film.title)}
            </p>
          )
        ) : (
          <p className="text-xs italic text-text-muted/60">Work not linked</p>
        )}
      </div>
    </article>
  );
}
