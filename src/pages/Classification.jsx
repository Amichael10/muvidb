import { useEffect } from 'react';
import { Icon } from '@iconify/react';

/**
 * The NFVCB classification scale.
 *
 * Ordered by restriction, because that ordering is the point — a flat grid
 * presents seven equal cards and loses the fact that this is a ladder from
 * "anyone" to "licensed venues only".
 *
 * `accent` is sampled from each official symbol so the page inherits the
 * board's own colour language rather than inventing one.
 */
const CLASSIFICATIONS = [
  {
    code: 'G',
    file: 'symbol_G.jpg',
    name: 'General',
    accent: '#1E9E52',
    audience: 'Everyone',
    minAge: 0,
    summary: 'Nothing that would harm or disturb any age group.',
    detail:
      'Suitable for all audiences, including young children. Content contains nothing that would harm or disturb any age group.',
  },
  {
    code: 'PG',
    file: 'symbol_PG.jpg',
    name: 'Parental Guidance',
    accent: '#E0B400',
    audience: 'All ages, guidance advised',
    minAge: 0,
    summary: 'General viewing, but some scenes may unsettle younger children.',
    detail:
      'General viewing, but some scenes may be unsuitable for young children. Parents are advised to watch with younger children.',
  },
  {
    code: '12',
    file: 'symbol_12.jpg',
    name: '12 Years and Above',
    accent: '#E8720C',
    audience: '12+ only',
    minAge: 12,
    summary: 'Not to be supplied to anyone below 12.',
    detail:
      'Suitable only for persons of 12 years and over. Not to be supplied to any person below that age.',
  },
  {
    code: '12A',
    file: 'symbol_12A.png',
    name: '12A — Accompanied',
    accent: '#F07C1E',
    audience: '12+, or younger with an adult',
    minAge: 12,
    summary: 'Under-12s may watch with a responsible adult.',
    detail:
      'Suitable for 12 years and above, but younger children may watch when accompanied by a responsible adult who has deemed the content appropriate.',
  },
  {
    code: '15',
    file: 'symbol_15.jpg',
    name: '15 Years and Above',
    accent: '#1E8FD5',
    audience: '15+ only',
    minAge: 15,
    summary: 'Stronger language, themes or references.',
    detail:
      'Suitable only for persons of 15 years and over. Content may include stronger language, themes, or references not appropriate for younger audiences.',
  },
  {
    code: '18',
    file: 'symbol_18.jpg',
    name: '18 Years and Above',
    accent: '#D8232A',
    audience: 'Adults only',
    minAge: 18,
    summary: 'Adult themes, strong language, nudity or violence.',
    detail:
      'Suitable only for adults aged 18 and over. Content may include adult themes, strong language, nudity, or violence.',
  },
  {
    code: 'RE',
    file: 'symbol_RE.jpg',
    name: 'Restricted Exhibition',
    accent: '#5B3F98',
    audience: 'Licensed venues only',
    minAge: 18,
    summary: 'Restricted to controlled exhibition settings.',
    detail:
      'Content is restricted to specific controlled exhibition settings only, such as licensed adult venues. Not for general public distribution.',
  },
];

/** Sprocket run — the film-leader motif the brand already uses on the homepage rails. */
function Sprockets({ className = '' }) {
  return (
    <div className={`flex items-center gap-[6px] ${className}`} aria-hidden="true">
      {Array.from({ length: 14 }).map((_, index) => (
        <span key={index} className="h-[9px] w-[6px] rounded-[1px] bg-current opacity-30" />
      ))}
    </div>
  );
}

function RestrictionTrack({ index, accent }) {
  return (
    <div className="flex items-center gap-1.5" aria-hidden="true">
      {CLASSIFICATIONS.map((_, step) => (
        <span
          key={step}
          className="h-1 w-4 rounded-full transition-colors"
          style={{
            backgroundColor: step <= index ? accent : 'var(--color-border)',
            opacity: step <= index ? 1 : 0.7,
          }}
        />
      ))}
    </div>
  );
}

export default function Classification() {
  useEffect(() => {
    document.title = 'Film Classification (NFVCB) | MuviDB';
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
            National Film and Video Censors Board
          </p>

          <h1 className="mt-5 max-w-3xl font-heading text-5xl font-black leading-[0.95] tracking-tighter md:text-7xl">
            How Nigerian films
            <br />
            are <span className="text-brand">classified</span>
          </h1>

          <p className="mt-7 max-w-2xl text-lg leading-relaxed text-text-muted">
            Seven official symbols, ordered from open to everyone through to restricted exhibition.
            Every film on MuviDB carries the classification it was given — or none, where it has not
            been classified.
          </p>

          <div className="mt-10 flex flex-wrap items-center gap-2.5">
            {CLASSIFICATIONS.map(item => (
              <a
                key={item.code}
                href={`#rating-${item.code}`}
                className="rounded-lg border border-border bg-surface px-3.5 py-2 text-xs font-black tracking-wide transition-all hover:-translate-y-0.5"
                style={{ color: item.accent }}
              >
                {item.code}
              </a>
            ))}
          </div>
        </div>
      </header>

      {/* ── The ladder ─────────────────────────────────────────── */}
      <main className="mx-auto max-w-6xl px-4 py-16 md:py-24">
        <ol className="space-y-5">
          {CLASSIFICATIONS.map((item, index) => (
            <li
              key={item.code}
              id={`rating-${item.code}`}
              className="group relative scroll-mt-24 overflow-hidden rounded-2xl border border-border bg-surface transition-colors"
            >
              {/* Severity spine */}
              <span
                className="absolute inset-y-0 left-0 w-1.5 transition-all group-hover:w-2.5"
                style={{ backgroundColor: item.accent }}
                aria-hidden="true"
              />

              <div className="flex flex-col gap-6 p-6 pl-8 md:flex-row md:items-center md:gap-9 md:p-8 md:pl-11">
                {/* The symbol keeps a light plate in both themes — the official
                    artwork is white-background and would sit in a dark void
                    otherwise. */}
                <div className="flex shrink-0 items-center gap-5">
                  <span className="font-heading text-3xl font-black tabular-nums text-text-muted opacity-30">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <div className="rounded-xl bg-white p-3 shadow-sm ring-1 ring-black/10">
                    <img
                      src={`/assets/nfvcb/${item.file}`}
                      alt={`NFVCB ${item.code} classification symbol`}
                      className="h-[74px] w-[86px] object-contain"
                      loading="lazy"
                    />
                  </div>
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    <h2 className="font-heading text-2xl font-black tracking-tight md:text-3xl">
                      {item.name}
                    </h2>
                    <span
                      className="rounded-md px-2 py-0.5 text-[11px] font-black tracking-widest"
                      style={{ backgroundColor: `${item.accent}1A`, color: item.accent }}
                    >
                      {item.code}
                    </span>
                  </div>

                  <p className="mt-2 text-base font-semibold text-text-primary">{item.summary}</p>
                  <p className="mt-2 max-w-2xl text-sm leading-relaxed text-text-muted">
                    {item.detail}
                  </p>

                  <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-3">
                    <span className="inline-flex items-center gap-2 text-xs font-bold text-text-muted">
                      <Icon icon="solar:users-group-rounded-linear" width="15" />
                      {item.audience}
                    </span>
                    <RestrictionTrack index={index} accent={item.accent} />
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ol>

        {/* ── Provenance ───────────────────────────────────────── */}
        <section className="mt-14 rounded-2xl border border-border bg-surface-2 p-7 md:p-9">
          <h2 className="font-heading text-xl font-black tracking-tight">
            About these classifications
          </h2>
          <p className="mt-3 max-w-3xl text-sm leading-relaxed text-text-muted">
            Classification in Nigeria is set by the National Film and Video Censors Board. The
            symbols and their definitions above are the Board&apos;s own. MuviDB displays a
            film&apos;s classification where one has been assigned; a missing rating means the title
            has not been classified, not that it is unrestricted.
          </p>
          <p className="mt-3 max-w-3xl text-sm leading-relaxed text-text-muted">
            Some older records in our catalogue carry <strong className="text-text-primary">PG-13</strong>,
            which is an American rating rather than a Nigerian one. Those are being mapped onto the
            scale above.
          </p>
          <a
            href="https://nfvcb.gov.ng/classification"
            target="_blank"
            rel="noreferrer noopener"
            className="mt-5 inline-flex items-center gap-2 text-sm font-bold text-brand hover:underline"
          >
            Read the official guidance at nfvcb.gov.ng
            <Icon icon="solar:arrow-right-up-linear" width="15" />
          </a>
        </section>

        <Sprockets className="mt-14 justify-center text-text-primary" />
      </main>
    </div>
  );
}
