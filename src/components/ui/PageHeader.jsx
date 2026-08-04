import { Icon } from '@iconify/react';

/**
 * Shared catalogue-page header — sentence-case titles, brand bar, optional count.
 * Keeps the TV Shows pattern but with stronger atmosphere and type.
 */
export default function PageHeader({
  icon,
  eyebrow = 'Catalogue',
  title,
  description,
  count,
  countLabel = 'available',
  actions = null,
  children = null,
}) {
  return (
    <header className="relative overflow-hidden border-b border-border bg-bg">
      {/* Atmosphere */}
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        <div className="absolute inset-0 grid-bg opacity-[0.35]" />
        <div
          className="absolute -left-24 top-0 h-[340px] w-[340px] rounded-full opacity-40 blur-3xl"
          style={{
            background: 'radial-gradient(circle, rgba(255,90,31,0.22) 0%, transparent 68%)',
          }}
        />
        <div
          className="absolute -right-16 bottom-0 h-[260px] w-[260px] rounded-full opacity-30 blur-3xl"
          style={{
            background: 'radial-gradient(circle, rgba(255,255,255,0.06) 0%, transparent 70%)',
          }}
        />
        <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-bg to-transparent" />
      </div>

      <div className="relative z-10 mx-auto max-w-7xl border-x border-border px-4 pb-12 pt-28 md:pb-14 md:pt-32">
        <div className="flex flex-col gap-8 md:flex-row md:items-end md:justify-between">
          <div className="min-w-0 max-w-2xl">
            {eyebrow && (
              <p className="mb-4 text-[10px] font-bold uppercase tracking-[0.28em] text-brand">
                {eyebrow}
              </p>
            )}

            <div className="flex items-start gap-3.5 sm:gap-4">
              {icon && (
                <div className="mt-1.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-brand/35 bg-brand/10 shadow-[0_0_24px_rgba(255,90,31,0.12)] sm:mt-2 sm:h-12 sm:w-12">
                  <Icon icon={icon} className="text-xl text-brand sm:text-2xl" />
                </div>
              )}
              <h1 className="font-['Syne',ui-sans-serif,system-ui] text-4xl font-extrabold tracking-[-0.04em] text-text-primary sm:text-5xl md:text-6xl">
                {title}
              </h1>
            </div>

            {description && (
              <p className="mt-5 max-w-xl border-l-2 border-brand pl-5 text-sm leading-relaxed text-text-secondary sm:pl-6 sm:text-[15px]">
                {description}
              </p>
            )}

            {count != null && count > 0 && (
              <p className="mt-4 pl-5 text-xs text-text-muted sm:pl-6">
                <span className="font-['Syne',ui-sans-serif,system-ui] text-base font-bold tabular-nums text-brand">
                  {count.toLocaleString()}
                </span>
                {' '}
                {countLabel}
              </p>
            )}

            {children && <div className="mt-6">{children}</div>}
          </div>

          {actions && <div className="shrink-0">{actions}</div>}
        </div>
      </div>
    </header>
  );
}
