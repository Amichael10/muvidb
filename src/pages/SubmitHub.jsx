import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from '@iconify/react';
import { SUBMIT_KINDS, SUBMIT_STEPS } from '../lib/contributions';

/**
 * The /submit hub. The three cards and the "how it works" rail are derived from
 * SUBMIT_KINDS and SUBMIT_STEPS, so a fourth submission kind or a sixth step
 * appears here without this file being touched.
 */

const KIND_ORDER = ['film', 'person', 'channel'];

/** Sprocket run — the film-leader motif shared with /about and /classification. */
function Sprockets({ className = '' }) {
  return (
    <div className={`flex items-center gap-[6px] ${className}`} aria-hidden="true">
      {Array.from({ length: 14 }).map((_, index) => (
        <span key={index} className="h-[9px] w-[6px] rounded-[1px] bg-current opacity-30" />
      ))}
    </div>
  );
}

const HOUSE_RULES = [
  {
    icon: 'solar:magnifer-linear',
    title: 'Search before you submit',
    body: 'The first step of every form searches the catalogue for you. A duplicate costs an editor more time to merge than the record saves.',
  },
  {
    icon: 'solar:shield-warning-linear',
    title: 'Legitimate links only',
    body: 'Official channels and licensed streaming pages. Pirated uploads are rejected.',
  },
  {
    icon: 'solar:document-text-linear',
    title: 'Write a record, not a caption',
    body: 'No hashtags, no "FULL MOVIE", no "subscribe". A synopsis describes the story, not the upload.',
  },
  {
    icon: 'solar:gallery-check-linear',
    title: 'Real artwork',
    body: 'Official posters and clear photographs. Thumbnails with text burned over them get replaced.',
  },
];

export default function SubmitHub() {
  useEffect(() => {
    document.title = 'Add to MuviDB | Submit a film, person or channel';
    window.scrollTo(0, 0);
  }, []);

  return (
    <div className="min-h-screen bg-bg text-text-primary">
      {/* ── Leader ─────────────────────────────────────────────── */}
      <header className="relative overflow-hidden border-b border-border">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.05]"
          aria-hidden="true"
          style={{
            backgroundImage:
              'repeating-linear-gradient(90deg, var(--color-text-primary) 0 2px, transparent 2px 96px)',
          }}
        />

        <div className="relative mx-auto max-w-6xl px-4 pb-16 pt-28 md:pt-36">
          <Sprockets className="mb-10 text-text-primary" />

          <p className="text-[11px] font-black uppercase tracking-[0.42em] text-brand">
            Contribute to MuviDB
          </p>

          <h1 className="mt-5 max-w-4xl font-heading text-5xl font-black leading-[0.95] tracking-tighter md:text-7xl">
            Add what we
            <br />
            are <span className="text-brand">missing</span>.
          </h1>

          <p className="mt-7 max-w-2xl text-lg leading-relaxed text-text-muted">
            African cinema moves faster than any one team can catalogue it. If a film, a performer
            or a channel is not here yet, tell us — an editor checks every submission before it
            goes live.
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-16 md:py-24">
        {/* ── The three kinds ──────────────────────────────────── */}
        <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
          <h2 className="font-heading text-2xl font-black tracking-tight md:text-3xl">
            What are you adding?
          </h2>
          <p className="text-[11px] font-black uppercase tracking-[0.28em] text-text-muted">
            Sign-in required
          </p>
        </div>

        <ul className="mt-8 grid gap-5 md:grid-cols-3">
          {KIND_ORDER.map((key, index) => {
            const spec = SUBMIT_KINDS[key];
            if (!spec) return null;

            const requiredFields = spec.fields.filter(field => field.required);
            const optionalCount = spec.fields.length - requiredFields.length;

            return (
              <li key={spec.kind} className="group relative">
                <Link
                  to={`/submit/${spec.kind}`}
                  className="flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-surface p-7 pl-8 transition-all hover:-translate-y-1 hover:border-brand/50 md:p-8 md:pl-10"
                >
                  <span
                    className="absolute inset-y-0 left-0 w-1.5 bg-brand transition-all group-hover:w-2.5"
                    aria-hidden="true"
                  />

                  <div className="flex items-start justify-between gap-4">
                    <Icon icon={spec.icon} width="30" className="text-brand" aria-hidden="true" />
                    <span className="font-heading text-3xl font-black tabular-nums text-text-muted opacity-25">
                      {String(index + 1).padStart(2, '0')}
                    </span>
                  </div>

                  <h3 className="mt-5 font-heading text-2xl font-black leading-tight tracking-tight">
                    {spec.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-text-muted">{spec.subtitle}</p>

                  <div className="mt-6 border-t border-hairline pt-5">
                    <p className="text-[10px] font-black uppercase tracking-[0.24em] text-text-muted">
                      We will ask for
                    </p>
                    <ul className="mt-3 space-y-2">
                      {requiredFields.map(field => (
                        <li
                          key={field.key}
                          className="flex items-center gap-2.5 text-xs font-bold text-text-primary"
                        >
                          <span
                            className="h-1 w-3.5 shrink-0 rounded-full bg-brand"
                            aria-hidden="true"
                          />
                          {field.label}
                        </li>
                      ))}
                    </ul>
                    <p className="mt-3 text-[11px] font-semibold leading-relaxed text-text-muted">
                      Plus {optionalCount} optional {optionalCount === 1 ? 'field' : 'fields'}, as
                      far as you know them.
                    </p>
                  </div>

                  <span className="mt-auto pt-7 inline-flex items-center gap-2 text-xs font-black uppercase tracking-widest text-brand">
                    Start
                    <Icon icon="solar:arrow-right-linear" width="15" aria-hidden="true" />
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>

        {/* ── How it works ─────────────────────────────────────── */}
        <section className="mt-16 md:mt-20">
          <h2 className="font-heading text-2xl font-black tracking-tight md:text-3xl">
            How the form works
          </h2>
          <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-text-muted">
            Five short steps, the same for all three. Your answers save to this browser as you go,
            so you can leave and come back.
          </p>

          <ol className="mt-8 grid gap-px overflow-hidden rounded-2xl border border-border bg-border md:grid-cols-5">
            {SUBMIT_STEPS.map(step => (
              <li key={step.key} className="bg-surface p-5 md:p-6">
                <span className="font-heading text-2xl font-black tabular-nums text-brand opacity-40">
                  {String(step.id).padStart(2, '0')}
                </span>
                <h3 className="mt-2 font-heading text-base font-black leading-tight tracking-tight">
                  {step.title}
                </h3>
                <p className="mt-2 text-xs leading-relaxed text-text-muted">{step.description}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* ── House rules ──────────────────────────────────────── */}
        <section className="mt-16 md:mt-20">
          <h2 className="font-heading text-2xl font-black tracking-tight md:text-3xl">
            Before you start
          </h2>

          <ul className="mt-8 grid gap-3 sm:grid-cols-2">
            {HOUSE_RULES.map(rule => (
              <li
                key={rule.title}
                className="rounded-xl border border-border bg-surface p-5 transition-colors hover:border-brand/40 md:p-6"
              >
                <Icon icon={rule.icon} width="22" className="text-brand" aria-hidden="true" />
                <h3 className="mt-3 font-heading text-base font-black tracking-tight">
                  {rule.title}
                </h3>
                <p className="mt-1.5 text-sm leading-relaxed text-text-muted">{rule.body}</p>
              </li>
            ))}
          </ul>
        </section>

        {/* ── What happens next ────────────────────────────────── */}
        <section className="mt-16 overflow-hidden rounded-2xl border border-border bg-surface-2 p-7 md:mt-20 md:p-10">
          <Sprockets className="mb-8 text-text-primary" />

          <h2 className="max-w-2xl font-heading text-2xl font-black leading-tight tracking-tighter md:text-4xl">
            Nothing you send goes live unreviewed.
          </h2>
          <p className="mt-5 max-w-2xl text-[15px] leading-relaxed text-text-muted">
            Submissions land in an editorial queue where each field is checked on its own. An editor
            keeps what is verifiable, corrects what needs correcting, and drops the rest — so a
            half-remembered runtime never blocks a good title from being added.
          </p>
          <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-text-muted">
            Already in the catalogue but wrong? Open the record and use{' '}
            <strong className="text-text-primary">Suggest an edit</strong> instead — corrections are
            faster to review than a fresh submission.
          </p>

          <div className="mt-9 flex flex-wrap gap-3">
            <Link
              to="/submit/film"
              className="rounded-lg bg-brand px-6 py-3 text-xs font-black uppercase tracking-widest text-white transition-all hover:opacity-90 active:scale-95"
            >
              Add a film
            </Link>
            <Link
              to="/browse"
              className="rounded-lg border border-border bg-surface px-6 py-3 text-xs font-black uppercase tracking-widest text-text-primary transition-all hover:border-brand hover:text-brand active:scale-95"
            >
              Search the catalogue first
            </Link>
          </div>
        </section>

        <Sprockets className="mt-14 justify-center text-text-primary" />
      </main>
    </div>
  );
}
