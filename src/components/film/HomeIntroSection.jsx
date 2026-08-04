import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from '@iconify/react';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';

const PILLARS = [
  {
    icon: 'solar:play-stream-linear',
    title: 'Where to watch',
    body: 'See Netflix, Prime, YouTube, Kava, and more — plus what’s in cinemas now.',
    to: '/browse',
    cue: 'Stream & cinema',
  },
  {
    icon: 'solar:ticket-linear',
    title: 'Showtimes & people',
    body: 'Find cinema times, then dig into cast, crew, and filmographies.',
    to: '/showtimes',
    cue: 'Times & credits',
  },
  {
    icon: 'solar:chat-round-like-linear',
    title: 'Rate, review, follow',
    body: 'Build your taste, leave reviews, and follow actors and filmmakers you care about.',
    to: '/signup',
    cue: 'Your taste',
  },
];

const CYCLE_MS = 5200;

export default function HomeIntroSection() {
  const reduceMotion = useReducedMotion();
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (reduceMotion || paused) return undefined;
    const id = window.setInterval(() => {
      setActive((i) => (i + 1) % PILLARS.length);
    }, CYCLE_MS);
    return () => window.clearInterval(id);
  }, [reduceMotion, paused, active]);

  const pillar = PILLARS[active];

  return (
    <section
      aria-label="About MuviDB"
      className="relative border-y border-border/80 overflow-hidden"
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.4]"
        style={{
          background:
            'radial-gradient(ellipse 70% 55% at 8% 40%, color-mix(in srgb, var(--color-brand) 22%, transparent), transparent 58%), radial-gradient(ellipse 45% 70% at 100% 10%, color-mix(in srgb, var(--color-brand) 12%, transparent), transparent 52%)',
        }}
      />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.035]"
        style={{
          backgroundImage:
            'repeating-linear-gradient(-12deg, transparent, transparent 11px, currentColor 11px, currentColor 12px)',
        }}
      />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 md:py-24">
        <div className="grid lg:grid-cols-12 gap-12 lg:gap-16 items-center">
          <motion.div
            className="lg:col-span-6 space-y-7"
            initial={reduceMotion ? false : { opacity: 0, y: 28 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.35 }}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          >
            <p className="text-brand text-[10px] md:text-[11px] font-bold uppercase tracking-[0.28em]">
              What is MuviDB
            </p>
            <h2 className="font-heading font-bold text-3xl sm:text-4xl md:text-[2.85rem] text-text-primary tracking-tighter leading-[1.05] max-w-xl">
              The database for Nollywood &amp; African film.
            </h2>
            <p className="text-text-secondary text-sm md:text-base leading-relaxed max-w-xl">
              Discover movies and TV, cinema showtimes, where to stream, cast and crew, and free
              YouTube titles — then rate, review, and follow the people who make them.
            </p>
            <div className="flex flex-wrap items-center gap-3 pt-1">
              <Link
                to="/browse"
                className="inline-flex items-center gap-2 bg-brand text-white px-5 py-2.5 rounded-lg text-[11px] font-bold uppercase tracking-widest hover:bg-brand-hover transition-colors"
              >
                Explore catalogue
                <Icon icon="solar:arrow-right-linear" className="w-4 h-4" />
              </Link>
              <Link
                to="/about"
                className="inline-flex items-center gap-2 border border-border bg-surface/60 text-text-primary px-5 py-2.5 rounded-lg text-[11px] font-bold uppercase tracking-widest hover:border-brand/50 transition-colors"
              >
                About MuviDB
              </Link>
              <Link
                to="/privacy"
                className="text-text-muted hover:text-brand text-[11px] font-bold uppercase tracking-widest transition-colors px-2"
              >
                Privacy
              </Link>
              <Link
                to="/terms"
                className="text-text-muted hover:text-brand text-[11px] font-bold uppercase tracking-widest transition-colors px-2"
              >
                Terms
              </Link>
            </div>
          </motion.div>

          <motion.div
            className="lg:col-span-6"
            initial={reduceMotion ? false : { opacity: 0, y: 36 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.75, delay: 0.08, ease: [0.22, 1, 0.36, 1] }}
            onMouseEnter={() => setPaused(true)}
            onMouseLeave={() => setPaused(false)}
            onFocusCapture={() => setPaused(true)}
            onBlurCapture={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget)) setPaused(false);
            }}
          >
            <div className="flex items-center justify-between mb-4 px-1">
              <p className="text-text-muted text-[10px] font-bold uppercase tracking-[0.22em]">
                What you can do
              </p>
              <div className="flex items-center gap-2" role="tablist" aria-label="Product highlights">
                {PILLARS.map((item, i) => (
                  <button
                    key={item.title}
                    type="button"
                    role="tab"
                    aria-selected={i === active}
                    aria-label={item.title}
                    onClick={() => setActive(i)}
                    className={`relative h-1.5 rounded-full transition-all duration-500 ${
                      i === active ? 'w-8 bg-brand' : 'w-1.5 bg-border hover:bg-text-muted'
                    }`}
                  />
                ))}
              </div>
            </div>

            <div className="relative min-h-[280px] sm:min-h-[300px]">
              {/* Soft stacked depth behind the active card */}
              <div
                aria-hidden
                className="absolute inset-x-4 top-5 bottom-0 rounded-2xl border border-border/40 bg-surface/20"
              />
              <div
                aria-hidden
                className="absolute inset-x-2 top-2.5 bottom-0 rounded-2xl border border-border/55 bg-surface/30"
              />

              <AnimatePresence mode="wait">
                <motion.div
                  key={pillar.title}
                  role="tabpanel"
                  initial={reduceMotion ? false : { opacity: 0, y: 18, scale: 0.985 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={reduceMotion ? undefined : { opacity: 0, y: -14, scale: 0.99 }}
                  transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
                  className="relative overflow-hidden rounded-2xl border border-border/90 bg-surface/70 backdrop-blur-md shadow-[0_24px_60px_-28px_rgba(0,0,0,0.55)]"
                >
                  <div
                    className="pointer-events-none absolute -right-6 -top-10 font-heading font-bold text-[7.5rem] leading-none tracking-tighter text-text-primary/[0.04] select-none"
                    aria-hidden
                  >
                    0{active + 1}
                  </div>
                  <div
                    className="pointer-events-none absolute inset-0 opacity-80"
                    style={{
                      background:
                        'linear-gradient(135deg, color-mix(in srgb, var(--color-brand) 14%, transparent), transparent 45%)',
                    }}
                  />

                  <Link
                    to={pillar.to}
                    className="relative z-10 flex flex-col gap-6 p-6 sm:p-8 min-h-[260px] sm:min-h-[280px]"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <span className="w-12 h-12 rounded-xl bg-brand/12 border border-brand/25 flex items-center justify-center text-brand shadow-sm">
                        <Icon icon={pillar.icon} className="w-6 h-6" />
                      </span>
                      <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-brand/90 pt-1">
                        {pillar.cue}
                      </span>
                    </div>

                    <div className="space-y-3 mt-auto">
                      <h3 className="font-heading font-bold text-2xl sm:text-[1.75rem] text-text-primary tracking-tight leading-tight">
                        {pillar.title}
                      </h3>
                      <p className="text-text-secondary text-sm sm:text-[15px] leading-relaxed max-w-md">
                        {pillar.body}
                      </p>
                    </div>

                    <div className="flex items-center justify-between gap-3 pt-1">
                      <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-brand">
                        Explore
                        <Icon icon="solar:arrow-right-linear" className="w-4 h-4" />
                      </span>
                      <span className="text-[10px] font-bold tracking-widest text-text-muted tabular-nums">
                        {active + 1} / {PILLARS.length}
                      </span>
                    </div>
                  </Link>

                  {/* Autoplay progress — pauses on hover/focus */}
                  {!reduceMotion && !paused && (
                    <div className="absolute bottom-0 inset-x-0 h-[2px] bg-border/50 overflow-hidden">
                      <motion.div
                        key={`progress-${active}`}
                        className="h-full w-full bg-brand origin-left"
                        initial={{ scaleX: 0 }}
                        animate={{ scaleX: 1 }}
                        transition={{ duration: CYCLE_MS / 1000, ease: 'linear' }}
                      />
                    </div>
                  )}
                </motion.div>
              </AnimatePresence>
            </div>

            {/* Manual selectors under the stage */}
            <div className="mt-4 grid grid-cols-3 gap-2">
              {PILLARS.map((item, i) => {
                const selected = i === active;
                return (
                  <button
                    key={item.title}
                    type="button"
                    onClick={() => setActive(i)}
                    className={`text-left rounded-xl border px-3 py-2.5 transition-all duration-300 ${
                      selected
                        ? 'border-brand/45 bg-brand/8 text-text-primary'
                        : 'border-border/70 bg-surface/25 text-text-muted hover:border-border hover:text-text-primary'
                    }`}
                  >
                    <span className="block text-[9px] font-bold uppercase tracking-[0.18em] opacity-70 mb-0.5">
                      0{i + 1}
                    </span>
                    <span className="block text-[11px] font-bold tracking-tight leading-snug line-clamp-1">
                      {item.title}
                    </span>
                  </button>
                );
              })}
            </div>
          </motion.div>
        </div>

        <p className="mt-12 pt-6 border-t border-border/60 text-text-muted text-[11px] md:text-xs leading-relaxed max-w-3xl">
          MuviDB uses Google Sign-In and the YouTube Data API for account access and public
          catalogue data. We don’t sell Google user data —{' '}
          <Link to="/privacy" className="text-brand font-semibold hover:underline">
            Privacy Policy
          </Link>
          .
        </p>
      </div>
    </section>
  );
}
