import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from '@iconify/react';
import { SOCIAL_LINKS } from '../config/socialLinks';

/**
 * The places a single African film's credits currently live.
 */
const SCATTERED_SOURCES = [
  { label: 'Cinema posters', tilt: -2 },
  { label: 'YouTube descriptions', tilt: 1.5 },
  { label: 'Instagram captions', tilt: -1 },
  { label: 'Press interviews', tilt: 2 },
  { label: 'Trailers & teasers', tilt: -2.5 },
  { label: 'Streaming splash pages', tilt: 1.5 },
  { label: 'Archival blogs', tilt: -1.5 },
  { label: 'End scroll credits', tilt: 2 },
];

const PLATFORM_PILLARS = [
  {
    icon: 'solar:clapperboard-play-linear',
    title: 'Theatrical & Streaming Features',
    body: 'Complete index of African features spanning multiplex cinema, global SVODs, YouTube originals, and film festivals.',
  },
  {
    icon: 'solar:users-group-rounded-linear',
    title: 'Cast, Crew & Talent Guilds',
    body: 'Structured filmographies for actors, directors, screenwriters, producers, editors, and cinematographers.',
  },
  {
    icon: 'solar:link-circle-linear',
    title: 'Verified Screen Credits',
    body: 'Character names, billing order, departmental crew roles, and verifiable attribution connected across projects.',
  },
  {
    icon: 'solar:cup-star-linear',
    title: 'Commercial Box Office & Reach',
    body: 'Tracked theatrical grosses, weekend rankings, admissions data, and YouTube digital viewership counts.',
  },
  {
    icon: 'solar:ticket-linear',
    title: 'Live Cinema Showtimes',
    body: 'Daily screening schedules across Nigeria and Ghana including Filmhouse, Silverbird, Genesis, and Viva.',
  },
  {
    icon: 'solar:monitor-smartphone-linear',
    title: 'Unified Streaming Directory',
    body: 'Direct watch links across Netflix, Prime Video, YouTube, Kava, and local African streaming networks.',
  },
];

const ECOSYSTEM_ROLES = [
  {
    role: 'Audiences & Cinephiles',
    summary: 'Discover what is showing in cinemas today, where to stream hidden gems, and track complete filmographies of beloved actors.',
  },
  {
    role: 'Actors & Screenwriters',
    summary: 'Build a verifiable, permanent public portfolio that documents every feature, web series, and indie credit with zero lost history.',
  },
  {
    role: 'Directors & Department Crew',
    summary: 'Ensure key behind-the-camera crew — cinematographers, editors, sound designers, and costumiers — are recognized and indexed.',
  },
  {
    role: 'Film Academies & Students',
    summary: 'Connect educational institutions and training cohorts to verified alumni screen credits and industry box office success.',
  },
  {
    role: 'Studios & Casting Scouts',
    summary: 'Access commercial clout data, box office performance, and verified talent rosters to package co-productions and SVOD licensing.',
  },
  {
    role: 'Journalists & Historians',
    summary: 'Preserve the creative memory and commercial evolution of Nollywood and African cinema with verifiable archive data.',
  },
];

const BELIEFS = [
  'African cinema is a multi-billion dollar cultural powerhouse that deserves world-class documentation.',
  'Visibility must not be reserved only for the top 1% of blockbusters; early-career and indie work matters.',
  'Every actor, crew member, and director deserves a verified, permanent digital record of their craft.',
  'Commercial data (box office, showtimes, streaming channels) should be transparent, accessible, and structured.',
  'Preserving African cinema history requires active stewardship before archival memories disappear.',
];

const NAV_ANCHORS = [
  { id: 'problem', label: '01. The Problem', title: 'The Scattered Archive' },
  { id: 'turning-point', label: '02. The Catalyst', title: 'Why This Is Urgent' },
  { id: 'pillars', label: '03. Architecture', title: 'What We Are Building' },
  { id: 'ecosystem', label: '04. Ecosystem', title: 'Who MuviDB Serves' },
  { id: 'mission', label: '05. Mission', title: 'Core Principles' },
  { id: 'attribution', label: '06. Standards', title: 'Data Attribution & Integrity' },
  { id: 'compliance', label: '07. Disclosures', title: 'Platform Transparency' },
];

function Sprockets({ className = '' }) {
  return (
    <div className={`flex items-center gap-[6px] ${className}`} aria-hidden="true">
      {Array.from({ length: 14 }).map((_, index) => (
        <span key={index} className="h-[9px] w-[6px] rounded-[1px] bg-current opacity-30" />
      ))}
    </div>
  );
}

export default function About() {
  const [activeSection, setActiveSection] = useState('problem');

  useEffect(() => {
    document.title = 'About MuviDB | The Pan-African Cinema Database';
    window.scrollTo(0, 0);

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.find((e) => e.isIntersecting);
        if (visible) setActiveSection(visible.target.id);
      },
      { rootMargin: '-100px 0px -60% 0px' }
    );

    NAV_ANCHORS.forEach((item) => {
      const el = document.getElementById(item.id);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, []);

  return (
    <div className="min-h-screen bg-bg text-text-primary selection:bg-brand selection:text-white">
      {/* ─── EDITORIAL HERO MASTHEAD (LEFT-ALIGNED + LIVE SLATE CARD) ─── */}
      <header className="relative border-b border-border bg-surface/30 overflow-hidden pt-12 md:pt-16 pb-12 md:pb-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 items-start">
            
            {/* Left Column: Bold Editorial Manifesto */}
            <div className="lg:col-span-8 space-y-6">
              <div className="flex items-center gap-3">
                <Sprockets className="text-brand" />
                <span className="text-[11px] font-black uppercase tracking-[0.3em] text-brand">
                  MuviDB Platform Manifesto
                </span>
              </div>

              <h1 className="font-heading text-4xl sm:text-6xl lg:text-7xl font-black leading-[1.02] tracking-tight text-text-primary">
                African cinema,
                <br />
                properly <span className="text-brand">documented</span>.
              </h1>

              <p className="text-base sm:text-lg text-text-muted leading-relaxed max-w-2xl font-medium">
                MuviDB is the definitive public knowledge graph and commercial reference for African film. 
                We bring structure, verified credits, and institutional memory to an industry producing 
                thousands of groundbreaking stories every year.
              </p>

              <div className="flex flex-wrap items-center gap-3 pt-2">
                <Link
                  to="/browse"
                  className="px-6 py-3 rounded-xl bg-brand hover:bg-brand-hover text-black font-black text-xs uppercase tracking-wider transition-all shadow-sm cursor-pointer"
                >
                  Explore The Database
                </Link>
                <Link
                  to="/companies?type=academy"
                  className="px-6 py-3 rounded-xl bg-surface-2 hover:bg-surface-3 border border-border hover:border-brand text-text-primary font-bold text-xs uppercase tracking-wider transition-all cursor-pointer"
                >
                  Film Academies &amp; Institutions
                </Link>
              </div>
            </div>

            {/* Right Column: Live Platform Coverage Card */}
            <div className="lg:col-span-4">
              <div className="rounded-2xl border border-border bg-surface-2/80 p-6 sm:p-7 shadow-lg space-y-6">
                <div className="flex items-center justify-between border-b border-hairline pb-4">
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-widest text-brand block">
                      Platform Slate
                    </span>
                    <h3 className="font-heading font-black text-base text-text-primary">
                      Coverage Standards
                    </h3>
                  </div>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 text-[10px] font-bold">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    Live Database
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-0.5">
                    <p className="font-heading text-2xl font-black text-text-primary tracking-tight">
                      12,000+
                    </p>
                    <p className="text-[11px] font-bold text-text-muted uppercase tracking-wider">
                      Catalogued Titles
                    </p>
                  </div>
                  <div className="space-y-0.5">
                    <p className="font-heading text-2xl font-black text-text-primary tracking-tight">
                      4,800+
                    </p>
                    <p className="text-[11px] font-bold text-text-muted uppercase tracking-wider">
                      Verified Cast &amp; Crew
                    </p>
                  </div>
                  <div className="space-y-0.5">
                    <p className="font-heading text-2xl font-black text-amber-400 tracking-tight">
                      ₦14.2B+
                    </p>
                    <p className="text-[11px] font-bold text-text-muted uppercase tracking-wider">
                      Tracked Box Office
                    </p>
                  </div>
                  <div className="space-y-0.5">
                    <p className="font-heading text-2xl font-black text-text-primary tracking-tight">
                      18+
                    </p>
                    <p className="text-[11px] font-bold text-text-muted uppercase tracking-wider">
                      Cinema Circuits
                    </p>
                  </div>
                </div>

                <div className="border-t border-hairline pt-4 text-[12px] text-text-muted leading-relaxed font-medium">
                  Covering theatrical releases in Lagos, Abuja, Accra &amp; Port Harcourt alongside YouTube, Netflix, Prime Video, and film festival slates.
                </div>
              </div>
            </div>

          </div>
        </div>
      </header>

      {/* ─── ASYMMETRICAL EDITORIAL BODY (STICKY RAIL + DETAILED SECTIONS) ─── */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-20">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 items-start">
          
          {/* Left Sticky Navigation & Highlights Rail */}
          <aside className="lg:col-span-4 hidden lg:block sticky top-24 space-y-8">
            <div className="rounded-2xl border border-border bg-surface p-6 space-y-4">
              <span className="text-[10px] font-black uppercase tracking-[0.25em] text-text-muted block">
                Index of Pillars
              </span>
              <nav className="space-y-1">
                {NAV_ANCHORS.map((anchor) => (
                  <a
                    key={anchor.id}
                    href={`#${anchor.id}`}
                    className={`group flex items-center justify-between px-3 py-2 rounded-lg text-xs font-bold transition-all ${
                      activeSection === anchor.id
                        ? 'bg-brand/10 text-brand font-black'
                        : 'text-text-muted hover:text-text-primary hover:bg-surface-2'
                    }`}
                  >
                    <span>{anchor.label}</span>
                    <span className="text-[11px] opacity-70 group-hover:opacity-100">{anchor.title}</span>
                  </a>
                ))}
              </nav>
            </div>

            {/* Editorial Pull Quote Box */}
            <div className="rounded-2xl border border-border bg-surface-2 p-6 space-y-3">
              <span className="text-brand text-xs font-black uppercase tracking-widest block">
                Core Philosophy
              </span>
              <blockquote className="font-heading text-base font-bold text-text-primary leading-snug">
                &ldquo;African cinema does not have a talent problem. It has a documentation problem.&rdquo;
              </blockquote>
              <p className="text-[11px] text-text-muted font-medium pt-1">
                MuviDB was founded to ensure no credit is forgotten, and every creative&apos;s full journey counts.
              </p>
            </div>

            {/* Official Channels */}
            <div className="rounded-2xl border border-border bg-surface p-6 space-y-3">
              <span className="text-[10px] font-black uppercase tracking-widest text-text-muted block">
                Direct Channels
              </span>
              <ul className="space-y-2">
                {SOCIAL_LINKS.filter(s => s.href).map((social) => (
                  <li key={social.label}>
                    <a
                      href={social.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2.5 text-xs font-bold text-text-secondary hover:text-brand transition-colors"
                    >
                      <Icon icon={social.icon} className="text-sm" />
                      <span>{social.label}</span>
                      <span className="text-[10px] text-text-muted font-mono ml-auto">{social.handle}</span>
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </aside>

          {/* Right Editorial Story Column */}
          <div className="lg:col-span-8 space-y-16">

            {/* Section 01: The Problem */}
            <section id="problem" className="scroll-mt-24 space-y-6">
              <div className="border-b border-hairline pb-4">
                <span className="text-[11px] font-black uppercase tracking-widest text-brand">
                  01 / The Challenge
                </span>
                <h2 className="font-heading text-2xl sm:text-3xl font-black text-text-primary tracking-tight mt-1">
                  The Scattered Archive of African Storytelling
                </h2>
              </div>

              <div className="text-base text-text-muted leading-relaxed space-y-4">
                <p>
                  Across Africa, thousands of films and series premiere every year across multiplex cinemas, 
                  streaming giants, YouTube networks, festival circuits, and independent television. 
                  Actors, directors, screenwriters, producers, editors, and cinematographers contribute 
                  to these works, but their credits are often scattered across disconnected fragments:
                </p>
              </div>

              {/* Scattered Sources Card */}
              <div className="rounded-2xl border border-border bg-surface p-6 sm:p-7 space-y-5">
                <p className="text-[11px] font-black uppercase tracking-wider text-text-muted">
                  Where an African film&apos;s record lives today:
                </p>
                <div className="flex flex-wrap gap-2.5">
                  {SCATTERED_SOURCES.map((source) => (
                    <span
                      key={source.label}
                      className="px-3.5 py-2 rounded-lg border border-dashed border-border bg-surface-2 text-xs font-bold text-text-muted"
                      style={{ transform: `rotate(${source.tilt}deg)` }}
                    >
                      {source.label}
                    </span>
                  ))}
                </div>

                <div className="flex items-center gap-3 border-t border-hairline pt-4">
                  <Icon icon="solar:arrow-right-linear" className="text-brand shrink-0 text-lg" />
                  <p className="text-xs sm:text-sm font-bold text-text-primary">
                    MuviDB connects them into one verifiable record, with every credit and commercial metric attached.
                  </p>
                </div>
              </div>
            </section>

            {/* Section 02: The Catalyst */}
            <section id="turning-point" className="scroll-mt-24 space-y-6">
              <div className="border-b border-hairline pb-4">
                <span className="text-[11px] font-black uppercase tracking-widest text-brand">
                  02 / The Catalyst
                </span>
                <h2 className="font-heading text-2xl sm:text-3xl font-black text-text-primary tracking-tight mt-1">
                  Why Visibility Must Equal Full Representation
                </h2>
              </div>

              <div className="text-base text-text-muted leading-relaxed space-y-4">
                <p>
                  One afternoon, while scrolling through social media, we watched a video of an upcoming Nollywood 
                  actress celebrating that she had finally been listed on an international database for one movie. 
                  She was genuinely proud — and that moment stuck.
                </p>
                <p>
                  When we inspected her profile, the reality was stark: the profile existed, but it did not capture 
                  her actual journey. It listed one single title, completely omitting the ten YouTube features and 
                  indie projects where she had spent years honing her craft.
                </p>
                <p>
                  For African creatives, being online does not always mean being accurately represented. 
                  An actor can be working constantly, yet the internet only remembers a fraction of their body of work. 
                  <strong className="text-text-primary font-bold"> MuviDB is built for that missing archive.</strong>
                </p>
              </div>
            </section>

            {/* Section 03: What We Are Building */}
            <section id="pillars" className="scroll-mt-24 space-y-6">
              <div className="border-b border-hairline pb-4">
                <span className="text-[11px] font-black uppercase tracking-widest text-brand">
                  03 / Core Infrastructure
                </span>
                <h2 className="font-heading text-2xl sm:text-3xl font-black text-text-primary tracking-tight mt-1">
                  What We Are Building
                </h2>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {PLATFORM_PILLARS.map((pillar) => (
                  <div
                    key={pillar.title}
                    className="p-5 rounded-xl border border-border bg-surface hover:border-brand/40 transition-colors space-y-2.5"
                  >
                    <Icon icon={pillar.icon} className="text-brand text-2xl" />
                    <h3 className="font-heading font-black text-sm text-text-primary">
                      {pillar.title}
                    </h3>
                    <p className="text-xs text-text-muted leading-relaxed font-medium">
                      {pillar.body}
                    </p>
                  </div>
                ))}
              </div>
            </section>

            {/* Section 04: Built for the Whole Ecosystem */}
            <section id="ecosystem" className="scroll-mt-24 space-y-6">
              <div className="border-b border-hairline pb-4">
                <span className="text-[11px] font-black uppercase tracking-widest text-brand">
                  04 / Stakeholders
                </span>
                <h2 className="font-heading text-2xl sm:text-3xl font-black text-text-primary tracking-tight mt-1">
                  Built for the Entire Film Ecosystem
                </h2>
              </div>

              <div className="divide-y divide-border rounded-xl border border-border bg-surface overflow-hidden">
                {ECOSYSTEM_ROLES.map((item) => (
                  <div key={item.role} className="p-5 sm:p-6 flex flex-col sm:flex-row sm:items-start gap-2 sm:gap-6">
                    <span className="font-heading font-black text-sm text-text-primary sm:w-48 shrink-0">
                      {item.role}
                    </span>
                    <p className="text-xs sm:text-sm text-text-muted leading-relaxed font-medium">
                      {item.summary}
                    </p>
                  </div>
                ))}
              </div>
            </section>

            {/* Section 05: Core Principles */}
            <section id="mission" className="scroll-mt-24 space-y-6">
              <div className="border-b border-hairline pb-4">
                <span className="text-[11px] font-black uppercase tracking-widest text-brand">
                  05 / Platform Conviction
                </span>
                <h2 className="font-heading text-2xl sm:text-3xl font-black text-text-primary tracking-tight mt-1">
                  Our Uncompromising Beliefs
                </h2>
              </div>

              <ul className="space-y-3.5">
                {BELIEFS.map((belief, idx) => (
                  <li key={idx} className="flex items-start gap-3 p-4 rounded-xl border border-border bg-surface-2/60">
                    <span className="w-1.5 h-1.5 rounded-full bg-brand mt-2 shrink-0" />
                    <span className="text-xs sm:text-sm text-text-secondary leading-relaxed font-semibold">
                      {belief}
                    </span>
                  </li>
                ))}
              </ul>
            </section>

            {/* Section 06: Data Attribution & Governance */}
            <section id="attribution" className="scroll-mt-24 space-y-6">
              <div className="border-b border-hairline pb-4">
                <span className="text-[11px] font-black uppercase tracking-widest text-brand">
                  06 / Data Integrity
                </span>
                <h2 className="font-heading text-2xl sm:text-3xl font-black text-text-primary tracking-tight mt-1">
                  Attribution &amp; Source Verification
                </h2>
              </div>

              <div className="rounded-xl border border-border bg-surface p-6 space-y-4">
                <p className="text-xs sm:text-sm text-text-muted leading-relaxed font-medium">
                  MuviDB synthesizes verified on-screen film credits, official studio slates, 
                  theatrical exhibition schedules, and public catalogue metadata. Some secondary 
                  film metadata is referenced via{' '}
                  <a
                    href="https://www.themoviedb.org/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-bold text-brand hover:underline"
                  >
                    The Movie Database (TMDB)
                  </a>
                  . This product uses the TMDB API but is not officially endorsed or certified by TMDB.
                </p>

                <div className="pt-2">
                  <a
                    href="https://www.themoviedb.org/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-block"
                  >
                    <img
                      src="/images/attribution/tmdb-logo.svg"
                      alt="TMDB"
                      className="h-6 w-auto opacity-80 hover:opacity-100 transition-opacity"
                    />
                  </a>
                </div>
              </div>
            </section>

            {/* Section 07: Google Services & Compliance */}
            <section id="compliance" className="scroll-mt-24 space-y-6">
              <div className="border-b border-hairline pb-4">
                <span className="text-[11px] font-black uppercase tracking-widest text-brand">
                  07 / Platform Transparency
                </span>
                <h2 className="font-heading text-2xl sm:text-3xl font-black text-text-primary tracking-tight mt-1">
                  Google Services &amp; API Usage
                </h2>
              </div>

              <div className="rounded-xl border border-border bg-surface-2 p-6 space-y-4">
                <dl className="space-y-3.5 text-xs sm:text-sm text-text-muted">
                  <div>
                    <dt className="font-black text-text-primary mb-0.5">Google Sign-In</dt>
                    <dd className="font-medium leading-relaxed">
                      For optional account creation and watchlist synchronization. We receive your name, 
                      verified email, and avatar only if you explicitly choose to authenticate.
                    </dd>
                  </div>
                  <div className="border-t border-hairline pt-3">
                    <dt className="font-black text-text-primary mb-0.5">YouTube Data API</dt>
                    <dd className="font-medium leading-relaxed">
                      For public film metadata — video titles, thumbnails, view statistics, and official distributor 
                      channels — enabling fans to watch full free African features. We never access private user accounts.
                    </dd>
                  </div>
                </dl>
                <div className="text-[11px] text-text-muted border-t border-hairline pt-3">
                  Read our full{' '}
                  <Link to="/privacy" className="text-brand font-bold hover:underline">
                    Privacy Policy
                  </Link>{' '}
                  and{' '}
                  <Link to="/terms" className="text-brand font-bold hover:underline">
                    Terms of Service
                  </Link>
                  .
                </div>
              </div>
            </section>

            {/* Editorial Conclusion Card */}
            <div className="rounded-2xl border border-border bg-surface-2 p-8 sm:p-10 space-y-6">
              <Sprockets className="text-brand" />
              <h3 className="font-heading text-3xl sm:text-4xl font-black tracking-tight text-text-primary">
                African cinema is culture, memory &amp; identity.
              </h3>
              <p className="text-sm sm:text-base text-text-muted leading-relaxed font-medium max-w-xl">
                And it deserves to be documented with the same rigor, beauty, and permanence as any world cinema.
              </p>
              <div className="flex flex-wrap items-center gap-3 pt-2">
                <Link
                  to="/browse"
                  className="px-6 py-3 rounded-xl bg-brand hover:bg-brand-hover text-black font-black text-xs uppercase tracking-wider transition-all cursor-pointer"
                >
                  Browse Full Catalogue
                </Link>
                <Link
                  to="/contact"
                  className="px-6 py-3 rounded-xl bg-surface border border-border hover:border-brand text-text-primary font-bold text-xs uppercase tracking-wider transition-all cursor-pointer"
                >
                  Get In Touch
                </Link>
              </div>
            </div>

          </div>
        </div>
      </main>
    </div>
  );
}
