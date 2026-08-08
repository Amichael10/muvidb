import { Icon } from '@iconify/react';

const DESTINATIONS = [
  { href: '/browse', label: 'Movies', icon: 'solar:clapperboard-play-bold', hint: 'Browse the catalogue' },
  { href: '/tv-shows', label: 'TV Shows', icon: 'solar:tv-bold', hint: 'Series & episodes' },
  { href: '/search', label: 'Search', icon: 'solar:magnifer-bold', hint: 'Find a title or person' },
  { href: '/showtimes', label: 'Showtimes', icon: 'solar:ticket-bold', hint: 'What’s on in cinemas' },
];

/**
 * Action-first error / 404 surface.
 * Uses MuviDB theme tokens. Swap `.error-hero-visual` for an animation later if wanted.
 */
export default function ErrorPage({ variant = 'error' }) {
  const is404 = variant === '404';

  const code = is404 ? '404' : 'Error';
  const title = is404 ? 'This page isn’t here' : 'Something broke on our side';
  const description = is404
    ? 'The link may be old, mistyped, or the page was moved. Pick a destination below to keep going.'
    : 'We couldn’t load this page. Reload, or head somewhere solid while we sort it out.';

  const goBack = () => {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      window.history.back();
      return;
    }
    window.location.href = '/';
  };

  const reload = () => {
    window.location.reload();
  };

  return (
    <div className="relative min-h-[100dvh] overflow-hidden bg-bg text-text-primary">
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        <div className="absolute inset-0 grid-bg opacity-30" />
        <div
          className="absolute left-1/2 top-0 h-[420px] w-[520px] -translate-x-1/2 rounded-full opacity-50 blur-3xl"
          style={{
            background: 'radial-gradient(circle, rgba(255,90,31,0.18) 0%, transparent 65%)',
          }}
        />
      </div>

      <div className="relative z-10 mx-auto flex min-h-[100dvh] max-w-2xl flex-col justify-center px-5 py-16 sm:px-8">
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center rounded-md border border-brand/40 bg-brand/10 px-2.5 py-1 font-['Syne',ui-sans-serif,system-ui] text-xs font-bold tracking-wide text-brand">
            {code}
          </span>
          <span className="text-[11px] font-bold uppercase tracking-[0.22em] text-text-muted">
            {is404 ? 'Page missing' : 'Load failed'}
          </span>
        </div>

        <div className="mt-6 flex flex-col gap-6 sm:flex-row sm:items-start sm:gap-8">
          <div className="error-hero-visual shrink-0 self-start">
            <div className="relative flex h-20 w-20 items-center justify-center overflow-hidden rounded-2xl border border-border bg-surface sm:h-24 sm:w-24">
              <img
                src="/images/error-film-reel.png"
                alt=""
                width={96}
                height={96}
                className="h-full w-full object-cover opacity-90"
              />
            </div>
          </div>

          <div className="min-w-0 flex-1">
            <h1 className="font-['Syne',ui-sans-serif,system-ui] text-3xl font-extrabold tracking-tight text-text-primary sm:text-4xl">
              {title}
            </h1>
            <p className="mt-3 max-w-md text-sm leading-relaxed text-text-secondary sm:text-[15px]">
              {description}
            </p>
          </div>
        </div>

        {/* Primary actions — what to do next */}
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <a
            href="/browse"
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-brand px-5 py-3.5 text-sm font-bold text-white transition hover:bg-brand-hover"
          >
            <Icon icon="solar:clapperboard-play-bold" width="18" />
            Browse movies
          </a>
          {is404 ? (
            <button
              type="button"
              onClick={goBack}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-border bg-surface px-5 py-3.5 text-sm font-bold text-text-primary transition hover:border-brand/40"
            >
              <Icon icon="solar:arrow-left-linear" width="18" />
              Go back
            </button>
          ) : (
            <button
              type="button"
              onClick={reload}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-border bg-surface px-5 py-3.5 text-sm font-bold text-text-primary transition hover:border-brand/40"
            >
              <Icon icon="solar:refresh-bold" width="18" />
              Try again
            </button>
          )}
        </div>

        {/* Clear destinations */}
        <div className="mt-10">
          <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.22em] text-text-muted">
            Or go somewhere useful
          </p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {DESTINATIONS.map((d) => (
              <a
                key={d.href}
                href={d.href}
                className="group flex items-center gap-3 rounded-xl border border-border bg-surface/60 px-4 py-3.5 transition hover:border-brand/50 hover:bg-surface"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand/10 text-brand">
                  <Icon icon={d.icon} width="18" />
                </span>
                <span className="min-w-0 text-left">
                  <span className="block text-sm font-bold text-text-primary group-hover:text-brand">
                    {d.label}
                  </span>
                  <span className="block text-xs text-text-muted">{d.hint}</span>
                </span>
                <Icon
                  icon="solar:arrow-right-linear"
                  width="16"
                  className="ml-auto shrink-0 text-text-muted opacity-0 transition group-hover:translate-x-0.5 group-hover:opacity-100 group-hover:text-brand"
                />
              </a>
            ))}
          </div>
        </div>

        <div className="mt-8 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-border pt-6 text-xs text-text-muted">
          <a href="/" className="font-semibold text-text-secondary transition hover:text-brand">
            Homepage
          </a>
          {!is404 && (
            <button
              type="button"
              onClick={goBack}
              className="font-semibold text-text-secondary transition hover:text-brand"
            >
              Go back
            </button>
          )}
          <a href="/contact" className="font-semibold text-text-secondary transition hover:text-brand">
            Contact support
          </a>
        </div>
      </div>
    </div>
  );
}
