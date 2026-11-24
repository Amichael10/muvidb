import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from '@iconify/react';

const GENRE_CARDS = [
  { name: 'Drama', tagline: 'Gripping family & social sagas', slug: 'drama' },
  { name: 'Comedy', tagline: 'Lagos wit & crowd-pleasers', slug: 'comedy' },
  { name: 'Thriller', tagline: 'High-stakes suspense & twists', slug: 'thriller' },
  { name: 'Romance', tagline: 'Modern love across the continent', slug: 'romance' },
  { name: 'Action', tagline: 'Stunts, warlords & adrenaline', slug: 'action' },
  { name: 'Crime', tagline: 'Heists, cartels & street justice', slug: 'crime' },
  { name: 'Epic', tagline: 'Kingdoms, heritage & folklore', slug: 'epic' },
  { name: 'Family', tagline: 'Warmth, culture & generations', slug: 'family' },
  { name: 'Horror', tagline: 'Supernatural & psychological chills', slug: 'horror' },
  { name: 'Documentary', tagline: 'Real African stories & history', slug: 'documentary' },
  { name: 'Animation', tagline: 'Original African animated worlds', slug: 'animation' },
];

const INDUSTRY_TOOLS = [
  {
    title: 'Claim Profile & Creator Link',
    badge: 'For Actors & Crew',
    description:
      'Own your verified Nollywood filmography, showcase casting specs (height, playing age, skills, availability), and share one live portfolio.',
    cta: 'Claim Your Profile',
    to: '/claim',
    icon: 'solar:verified-check-bold',
    accent: 'text-brand bg-brand/10 border-brand/20',
  },
  {
    title: 'Title Availability Checker',
    badge: 'For Producers & Writers',
    description:
      'Check whether your movie or series title already exists across 20,000+ Nollywood and African productions before going into production.',
    cta: 'Check a Title',
    to: '/title-checker',
    icon: 'solar:shield-check-bold',
    accent: 'text-sky-400 bg-sky-500/10 border-sky-500/20',
  },
  {
    title: 'Submit a Film or Credit',
    badge: 'Community & Studios',
    description:
      'Missing a cast credit, crew department, stage play, or upcoming release? Submit verified entries directly to keep African cinema history complete.',
    cta: 'Submit Entry',
    to: '/submit',
    icon: 'solar:add-circle-bold',
    accent: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
  },
  {
    title: 'Box Office & Awards Archive',
    badge: 'Market Intelligence',
    description:
      'Explore Nigerian domestic theatrical grosses, opening weekends, studio commercial track records, and major AMVCA & AMAA honours.',
    cta: 'Open Box Office',
    to: '/box-office',
    icon: 'solar:chart-square-bold',
    accent: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
  },
];

function GenreMotionCard({ genre, motionEnabled }) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <Link
      to={`/browse?genre=${encodeURIComponent(genre.name)}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onFocus={() => setIsHovered(true)}
      onBlur={() => setIsHovered(false)}
      className="group relative aspect-[4/3] min-h-[140px] rounded-xl overflow-hidden border border-border/80 hover:border-brand/70 bg-surface-2 transition-all duration-300 w-[64vw] sm:w-auto shrink-0 snap-start select-none"
    >
      {/* Static WebP at rest */}
      <img
        src={`/media/genres/${genre.slug}.webp`}
        alt={genre.name}
        loading="lazy"
        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
      />

      {/* Lazy-mounted WebM video strictly on hover/focus when motion is enabled */}
      {isHovered && motionEnabled && (
        <video
          src={`/media/genres/${genre.slug}.webm`}
          autoPlay
          muted
          loop
          playsInline
          aria-hidden="true"
          className="absolute inset-0 w-full h-full object-cover pointer-events-none"
        />
      )}

      {/* Clean Matte Scrim */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/35 to-black/10 pointer-events-none" />

      {/* Motion Indicator Pill on Hover */}
      {motionEnabled && (
        <span
          className={`absolute top-2.5 right-2.5 inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-black/75 border border-white/15 text-[9px] font-bold uppercase tracking-wider text-white/90 transition-opacity duration-200 ${
            isHovered ? 'opacity-100' : 'opacity-0'
          }`}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-brand animate-pulse" />
          Preview
        </span>
      )}

      {/* Genre Title & Mood Subtitle */}
      <div className="absolute inset-x-0 bottom-0 p-3 sm:p-3.5 flex items-end justify-between gap-2">
        <div className="min-w-0">
          <h3 className="font-heading font-black text-sm sm:text-base text-white group-hover:text-brand transition-colors truncate">
            {genre.name}
          </h3>
          <p className="text-[10.5px] text-white/75 font-medium truncate">
            {genre.tagline}
          </p>
        </div>
        <Icon
          icon="solar:arrow-right-linear"
          className="w-4 h-4 text-white/70 group-hover:text-brand group-hover:translate-x-0.5 transition-all shrink-0 mb-0.5"
        />
      </div>
    </Link>
  );
}

export default function HomeIndustryTools({ isAuthenticated = false }) {
  const [motionEnabled, setMotionEnabled] = useState(true);

  useEffect(() => {
    const checkMotion = () => {
      const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
      const stored = localStorage.getItem('muvidb_motion_enabled');
      setMotionEnabled(!reduced && stored !== 'false');
    };
    checkMotion();
    window.addEventListener('storage', checkMotion);
    return () => window.removeEventListener('storage', checkMotion);
  }, []);

  return (
    <section className="py-10 md:py-14">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
        {/* Cinematic Genre Quick-Explorer (WebP at rest -> WebM on hover) */}
        <div className="space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
            <div className="space-y-1">
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-brand">
                Browse by Mood
              </p>
              <h2 className="font-heading font-bold text-2xl sm:text-3xl text-text-primary tracking-tight">
                Explore Catalogue by Genre
              </h2>
            </div>

            <Link
              to="/advanced-search"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-border bg-surface hover:border-brand text-xs font-bold text-text-primary hover:text-brand transition-colors self-start sm:self-auto"
            >
              <Icon icon="solar:tuning-square-2-linear" className="text-sm text-brand" />
              <span>Advanced Filters</span>
            </Link>
          </div>

          <div className="flex overflow-x-auto snap-x snap-mandatory gap-3 pb-2 -mx-4 px-4 scrollbar-none sm:grid sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 sm:mx-0 sm:px-0 sm:overflow-visible">
            {GENRE_CARDS.map((genre) => (
              <GenreMotionCard key={genre.slug} genre={genre} motionEnabled={motionEnabled} />
            ))}
          </div>
        </div>

        {/* Built for the African Film Industry Toolkit */}
        <div className="space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
            <div className="space-y-1">
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-brand">
                For Filmmakers, Talent &amp; Fans
              </p>
              <h2 className="font-heading font-bold text-2xl sm:text-3xl text-text-primary tracking-tight">
                Tools Built for African Cinema
              </h2>
            </div>

            {!isAuthenticated && (
              <Link
                to="/signup"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-brand hover:bg-brand-hover text-white text-xs font-bold transition-colors self-start sm:self-auto"
              >
                <span>Create Free Account</span>
                <Icon icon="solar:alt-arrow-right-linear" className="w-4 h-4" />
              </Link>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {INDUSTRY_TOOLS.map((tool) => (
              <Link
                key={tool.title}
                to={tool.to}
                className="group rounded-2xl border border-border/80 bg-surface p-5 flex flex-col justify-between gap-4 hover:border-brand/50 transition-all duration-200 hover:-translate-y-0.5 shadow-sm"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className={`w-9 h-9 rounded-xl border flex items-center justify-center ${tool.accent}`}>
                      <Icon icon={tool.icon} className="text-lg" />
                    </span>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted">
                      {tool.badge}
                    </span>
                  </div>

                  <div className="space-y-1.5">
                    <h3 className="font-heading font-bold text-base text-text-primary group-hover:text-brand transition-colors">
                      {tool.title}
                    </h3>
                    <p className="text-xs text-text-muted leading-relaxed">
                      {tool.description}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 text-xs font-bold text-brand">
                  <span>{tool.cta}</span>
                  <Icon
                    icon="solar:alt-arrow-right-linear"
                    className="w-4 h-4 transition-transform group-hover:translate-x-0.5"
                  />
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
