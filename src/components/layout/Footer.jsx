import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from '@iconify/react';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { SOCIAL_LINKS } from '../../config/socialLinks';

const footerGroups = [
  {
    title: 'Cinema & Stage',
    links: [
      { label: 'Browse All Films', to: '/browse' },
      { label: 'Box Office Hub', to: '/box-office', badge: 'Live', badgeColor: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' },
      { label: 'Stage Plays & Theatre', to: '/plays', badge: 'New', badgeColor: 'bg-purple-500/15 text-purple-400 border-purple-500/30' },
      { label: 'Showtimes & Cinemas', to: '/showtimes' },
      { label: 'Top Rated Nollywood', to: '/browse?sort=rating' },
      { label: 'Latest Releases', to: '/browse?sort=newest' },
    ],
  },
  {
    title: 'Talent & Guilds',
    links: [
      { label: 'Actors & Actresses', to: '/people?role=actor' },
      { label: 'Film Directors', to: '/people?role=director' },
      { label: 'Writers & Creators', to: '/people?role=writer' },
      { label: 'Producers & Execs', to: '/people?role=producer' },
      { label: 'Film Critics Lounge', to: '/critics' },
      { label: 'Awards & Honors', to: '/awards' },
    ],
  },
  {
    title: 'Tools & Registry',
    links: [
      { label: 'Advanced Search', to: '/advanced-search', badge: 'New', badgeColor: 'bg-brand/15 text-brand border-brand/30' },
      { label: 'Title Registry Checker', to: '/tools/title-checker' },
      { label: 'Film Classification', to: '/classification' },
      { label: 'Developer API & Docs', to: '/developers' },
      { label: 'Brand Kit & Assets', to: '/brand' },
    ],
  },
  {
    title: 'Industry & Pro',
    links: [
      { label: 'Claim Your Profile', to: '/claim', badge: 'Pro', badgeColor: 'bg-amber-500/15 text-amber-400 border-amber-500/30' },
      { label: 'Submit Film or Play', to: '/submit' },
      { label: 'Production Companies', to: '/companies' },
      { label: 'Streaming Channels', to: '/channels' },
      { label: 'Pro Dashboard', to: '/pro-dashboard', authOnly: true },
      { label: 'Member Watchlist', to: '/dashboard', authOnly: true },
    ],
  },
  {
    title: 'About & Press',
    links: [
      { label: 'About MuviDB', to: '/about' },
      { label: 'Contact Support', to: '/contact' },
      { label: 'Careers & Team', to: '/careers' },
      { label: 'Sign In', to: '/login', guestOnly: true },
      { label: 'Join Free', to: '/signup', guestOnly: true },
    ],
  },
];

const DEFAULT_METRICS = [
  { label: 'Films Cataloged', val: '17,500+' },
  { label: 'Box Office Tracked', val: '₦35.5B+' },
  { label: 'Filmmaker Credits', val: '100,000+' },
  { label: 'Cinemas & Streaming', val: '180+' },
];

export default function Footer() {
  const { theme } = useTheme();
  const { isAuthenticated } = useAuth();
  const [metrics, setMetrics] = useState(() => {
    try {
      const cached = sessionStorage.getItem('muvidb_live_metrics_cache');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed.metrics && Date.now() - parsed.timestamp < 30 * 60 * 1000) {
          return parsed.metrics;
        }
      }
    } catch (_) {}
    return DEFAULT_METRICS;
  });

  useEffect(() => {
    let isMounted = true;
    async function fetchLiveMetrics() {
      try {
        const statsRes = await fetch('/api/content?resource=site-stats');
        if (!statsRes.ok) throw new Error(`site-stats ${statsRes.status}`);
        const stats = await statsRes.json();

        const filmsCount = stats.films || 17584;
        const creditsCount = stats.credits || 103782;
        const cinemasCount = stats.cinemas || 185;

        const totalBo = Number(stats.boxOfficeTotal) || 0;
        const boFormatted = totalBo > 0 ? `₦${(totalBo / 1e9).toFixed(1)}B+` : '₦35.5B+';

        const updated = [
          { label: 'Films Cataloged', val: `${filmsCount.toLocaleString()}+` },
          { label: 'Box Office Tracked', val: boFormatted },
          { label: 'Filmmaker Credits', val: `${creditsCount.toLocaleString()}+` },
          { label: 'Cinemas & Streaming', val: `${cinemasCount}+` },
        ];

        if (isMounted) {
          setMetrics(updated);
          try {
            sessionStorage.setItem('muvidb_live_metrics_cache', JSON.stringify({
              metrics: updated,
              timestamp: Date.now()
            }));
          } catch (_) {}
        }
      } catch (e) {
        // Fallback to initial defaults if network fails
      }
    }

    fetchLiveMetrics();
    return () => { isMounted = false; };
  }, []);

  return (
    <footer className="relative bg-bg text-text-secondary border-t border-border select-none transition-colors duration-200">
      
      {/* ── 1. LIVE ARCHIVE METRICS BAR ── */}
      <div className="border-b border-border/80 bg-surface/80 backdrop-blur-md py-3.5 px-4 sm:px-8">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2.5">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span className="text-text-primary font-heading font-black tracking-wider uppercase text-[11px]">
              MuviDB Live Archive
            </span>
            <span className="hidden sm:inline text-text-muted/40">•</span>
            <span className="hidden sm:inline text-text-muted text-[11px]">
              Verified Nollywood & African Cinema Data
            </span>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-1.5 text-xs">
            {metrics.map((metric, idx) => (
              <div key={metric.label} className="flex items-center gap-1.5">
                <span className="text-text-primary font-heading font-black">{metric.val}</span>
                <span className="text-text-muted text-[11px]">{metric.label}</span>
                {idx < metrics.length - 1 && (
                  <span className="hidden md:inline text-text-muted/30 ml-3">•</span>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="relative z-10 mx-auto max-w-7xl px-4 py-12 sm:px-8 sm:py-16 lg:px-10">
        
        {/* ── 2. CREATOR & INDUSTRY PRO CALLOUT BANNER ── */}
        <div className="mb-12 p-6 sm:p-8 rounded-2xl bg-gradient-to-br from-surface-2/90 via-surface/95 to-surface-2/70 border border-border/90 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-1.5 max-w-2xl">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-brand/10 border border-brand/20 text-brand text-[10px] font-black uppercase tracking-wider">
              <Icon icon="solar:clapperboard-play-bold" width="13" />
              <span>Nollywood Creators &amp; Industry Pros</span>
            </div>
            <h3 className="text-lg sm:text-xl font-heading font-black text-text-primary">
              Claim your profile. Showcase your filmography, verify credits &amp; track box office.
            </h3>
            <p className="text-xs text-text-muted leading-relaxed">
              Are you an actor, director, writer, or producer? Take ownership of your career page on Nigeria's definitive cinema catalog.
            </p>
          </div>
          <div className="flex items-center gap-3 w-full sm:w-auto shrink-0">
            <Link
              to="/claim"
              className="flex-1 sm:flex-initial px-5 py-2.5 rounded-xl bg-gradient-to-r from-brand to-brand-600 hover:from-brand-600 hover:to-brand text-white text-xs font-bold transition shadow-lg shadow-brand/25 text-center flex items-center justify-center gap-2"
            >
              <Icon icon="solar:verified-check-bold" width="15" />
              <span>Claim Profile</span>
            </Link>
            <Link
              to="/submit"
              className="flex-1 sm:flex-initial px-4 py-2.5 rounded-xl bg-surface border border-border hover:border-brand/40 text-text-primary text-xs font-bold transition text-center flex items-center justify-center gap-1.5"
            >
              <Icon icon="solar:add-circle-linear" width="15" />
              <span>Add Film / Play</span>
            </Link>
          </div>
        </div>

        {/* ── 3. MAIN NAVIGATION COLUMNS (2-col mobile, 5-col desktop) ── */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-8 lg:gap-10 pb-12 border-b border-border/80">
          {footerGroups.map((group) => (
            <nav key={group.title} aria-label={group.title} className="space-y-3.5">
              <h4 className="text-[11px] font-heading font-black uppercase tracking-[0.18em] text-text-primary border-b border-border/40 pb-2">
                {group.title}
              </h4>
              <ul className="space-y-2.5">
                {group.links
                  .filter((link) =>
                    link.guestOnly ? !isAuthenticated : !link.authOnly || isAuthenticated,
                  )
                  .map((link) => (
                    <li key={link.to || link.label}>
                      <Link
                        to={link.to}
                        className="group inline-flex items-center gap-1.5 text-xs text-text-muted hover:text-text-primary transition-colors duration-200"
                      >
                        <span className="group-hover:translate-x-0.5 transition-transform duration-200">
                          {link.label}
                        </span>
                        {link.badge && (
                          <span className={`rounded px-1.5 py-0.2 text-[8px] font-mono font-bold uppercase tracking-wider border ${link.badgeColor || 'bg-brand/10 text-brand border-brand/20'}`}>
                            {link.badge}
                          </span>
                        )}
                      </Link>
                    </li>
                  ))}
              </ul>
            </nav>
          ))}
        </div>

        {/* ── 4. BRAND, SOCIAL & ATTRIBUTION FOOTER ── */}
        <div className="pt-10 space-y-8">
          
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div className="space-y-3 max-w-md">
              <Link to="/" className="inline-flex items-center">
                <img
                  src={theme === 'light' ? "/images/MuviDB Brand/Wordmark.svg" : "/images/MuviDB Brand/White Wordmark.svg"}
                  alt="MuviDB"
                  className="h-7 w-auto object-contain"
                />
              </Link>
              <p className="text-xs leading-relaxed text-text-muted">
                The authoritative film and stage theatre database for Nollywood &amp; African cinema. Cataloging every release, verified credit, stage run, and box office milestone.
              </p>
            </div>

            {/* Social Channels Strip */}
            <div className="space-y-2">
              <p className="text-[10px] font-mono uppercase tracking-wider text-text-muted font-bold">
                Follow Nollywood Cinema
              </p>
              <div className="flex items-center gap-2">
                {SOCIAL_LINKS.map((social) =>
                  social.href ? (
                    <a
                      key={social.label}
                      href={social.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`MuviDB on ${social.label}`}
                      className="flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-surface text-text-muted transition-all hover:border-brand hover:text-brand hover:bg-brand/10 hover:scale-105 active:scale-95 shadow-xs"
                    >
                      <Icon icon={social.icon} className="text-base" aria-hidden="true" />
                    </a>
                  ) : null
                )}
              </div>
            </div>
          </div>

          {/* TMDB & Source Attribution */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pt-6 border-t border-border/60">
            <a
              href="https://www.themoviedb.org/"
              target="_blank"
              rel="noopener noreferrer"
              className="group flex items-center gap-3"
              aria-label="The Movie Database — opens in a new tab"
            >
              <img
                src="/images/attribution/tmdb-logo.svg"
                alt="TMDB"
                className="h-3.5 w-auto opacity-60 transition-opacity group-hover:opacity-100"
                width="100"
                height="20"
              />
              <p className="text-[11px] text-text-muted/80">
                This product uses the TMDB API but is not endorsed or certified by TMDB.
              </p>
            </a>

            {/* Google Preferred Source button */}
            <div google-add-preferred-source-btn="" />
          </div>

          {/* Legal & Copyright */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-border/40 text-[11px] text-text-muted font-mono">
            <p>
              © {new Date().getFullYear()} MuviDB Archive. Engineered for African cinema lovers worldwide.
            </p>

            <div className="flex flex-wrap items-center gap-3">
              <Link to="/terms" className="hover:text-text-primary transition-colors">Terms of Use</Link>
              <span className="text-border">•</span>
              <Link to="/privacy" className="hover:text-text-primary transition-colors">Privacy Policy</Link>
              <span className="text-border">•</span>
              <button
                type="button"
                onClick={() => window.dispatchEvent(new Event('open-cookie-consent'))}
                className="hover:text-text-primary transition-colors cursor-pointer"
              >
                Cookie Preferences
              </button>
            </div>
          </div>

        </div>
      </div>
    </footer>
  );
}
