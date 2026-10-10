import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from '@iconify/react';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { SOCIAL_LINKS } from '../../config/socialLinks';
import { supabase } from '../../lib/supabase';

const footerGroups = [
  {
    title: 'Discover',
    links: [
      { label: 'Home', to: '/' },
      { label: 'Browse Movies', to: '/browse' },
      { label: 'Advanced Search', to: '/advanced-search', isNew: true },
      { label: 'Awards', to: '/awards' },
      { label: 'Top Rated', to: '/browse?sort=rating' },
      { label: 'New Releases', to: '/browse?sort=newest' },
    ],
  },
  {
    title: 'People & Arts',
    links: [
      { label: 'Actors', to: '/people?role=Actor' },
      { label: 'Directors', to: '/people?role=Director' },
      { label: 'Film Critics', to: '/critics' },
      { label: 'Theatre Plays', to: '/plays' },
      { label: 'Awards', to: '/awards' },
    ],
  },
  {
    title: 'Platform & Tools',
    links: [
      { label: 'About Us', to: '/about' },
      { label: 'Developer API', to: '/developers', isNew: true },
      { label: 'Brand Kit', to: '/brand', isNew: true },
      { label: 'Title Search', to: '/tools/title-checker', isNew: true },
      { label: 'Support the Archive', to: '/support' },
      { label: 'Film Classification', to: '/classification' },
    ],
  },
  {
    title: 'Community',
    links: [
      { label: 'Add a Film', to: '/submit/film' },
      { label: 'Contribute Data', to: '/submit' },
      { label: 'Careers', to: '/careers' },
      { label: 'Contact', to: '/contact' },
      { label: 'Sign In', to: '/login', guestOnly: true },
      { label: 'Join MuviDB', to: '/signup', guestOnly: true },
      { label: 'Dashboard', to: '/dashboard', authOnly: true },
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
        const [filmsRes, creditsRes, cinemasRes, boRes] = await Promise.all([
          supabase.from('films').select('*', { count: 'exact', head: true }),
          supabase.from('credits').select('*', { count: 'exact', head: true }),
          supabase.from('cinemas').select('*', { count: 'exact', head: true }),
          supabase.from('films').select('box_office_domestic').not('box_office_domestic', 'is', null),
        ]);

        const filmsCount = filmsRes.count || 17584;
        const creditsCount = creditsRes.count || 103782;
        const cinemasCount = cinemasRes.count || 185;

        let totalBo = 0;
        boRes.data?.forEach(r => {
          totalBo += (Number(r.box_office_domestic) || 0);
        });
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
      {/* Live Cinephile Database Counter Bar */}
      <div className="border-b border-hairline bg-surface py-3.5 px-6 sm:px-8">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4 text-xs font-mono">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-brand animate-pulse" />
            <span className="text-text-primary font-bold uppercase tracking-wider text-[11px]">
              MuviDB Live Archive
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-[11px] text-text-secondary">
            {metrics.map((metric, idx) => (
              <div key={metric.label} className="flex items-center gap-1.5">
                <span className="text-text-primary font-bold">{metric.val}</span>
                <span className="text-text-muted">{metric.label}</span>
                {idx < metrics.length - 1 && (
                  <span className="hidden sm:inline text-text-muted/40 ml-4">•</span>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="relative z-10 mx-auto max-w-7xl px-6 py-14 sm:px-8 sm:py-16 lg:px-10">
        <div className="grid gap-10 md:grid-cols-[1.2fr_repeat(4,minmax(0,1fr))] lg:gap-12">
          <div className="max-w-sm space-y-4">
            <Link to="/" className="inline-flex items-center">
              <img
                src={theme === 'light' ? "/images/MuviDB Brand/Wordmark.svg" : "/images/MuviDB Brand/White Wordmark.svg"}
                alt="MuviDB"
                className="h-7 w-auto object-contain"
              />
            </Link>
            <p className="text-xs sm:text-sm font-normal leading-relaxed text-text-secondary">
              The social film database and discovery platform for Nollywood &amp; African cinema. Track what you watch, tell your friends what’s good.
            </p>

            <div className="flex items-center gap-2.5 pt-1">
              {SOCIAL_LINKS.map((social) =>
                social.href ? (
                  <a
                    key={social.label}
                    href={social.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`MuviDB on ${social.label}`}
                    className="flex h-9 w-9 items-center justify-center rounded-lg border border-border text-text-secondary transition-colors hover:border-brand hover:text-brand hover:bg-brand/5"
                  >
                    <Icon icon={social.icon} className="text-base" aria-hidden="true" />
                  </a>
                ) : (
                  <span
                    key={social.label}
                    role="img"
                    aria-label={`${social.label} — coming soon`}
                    className="flex h-9 w-9 items-center justify-center rounded-lg border border-hairline text-text-muted/40"
                  >
                    <Icon icon={social.icon} className="text-base" aria-hidden="true" />
                  </span>
                ),
              )}
            </div>
          </div>

          {footerGroups.map((group) => (
            <nav key={group.title} aria-label={group.title}>
              <h3 className="mb-4 text-[11px] font-mono font-bold uppercase tracking-[0.2em] text-text-primary">
                {group.title}
              </h3>
              <ul className="space-y-2.5">
                {group.links
                  .filter((link) =>
                    link.guestOnly ? !isAuthenticated : !link.authOnly || isAuthenticated,
                  )
                  .map((link) => (
                    <li key={link.to || link.label} className="leading-none">
                      {link.comingSoon ? (
                        <span className="inline-flex items-center gap-2 text-xs font-normal leading-none text-text-muted">
                          <span>{link.label}</span>
                          <span className="rounded px-1.5 py-0.5 text-[8px] font-mono font-bold uppercase tracking-wider text-amber-500 bg-amber-500/10 border border-amber-500/20">
                            Soon
                          </span>
                        </span>
                      ) : (
                        <Link
                          to={link.to}
                          className="inline-flex items-center gap-2 text-xs font-normal leading-none text-text-secondary transition-colors hover:text-text-primary hover:translate-x-0.5"
                        >
                          <span>{link.label}</span>
                          {link.isNew && (
                            <span className="rounded px-1.5 py-0.5 text-[8px] font-mono font-bold uppercase tracking-wider text-brand bg-brand/10 border border-brand/20">
                              New
                            </span>
                          )}
                        </Link>
                      )}
                    </li>
                  ))}
              </ul>
            </nav>
          ))}
        </div>

        <div className="mt-12 space-y-6 border-t border-hairline pt-8">
          <a
            href="https://www.themoviedb.org/"
            target="_blank"
            rel="noopener noreferrer"
            className="group flex max-w-xl flex-col gap-2 sm:flex-row sm:items-center"
            aria-label="The Movie Database — opens in a new tab"
          >
            <img
              src="/images/attribution/tmdb-logo.svg"
              alt=""
              className="h-4.5 w-auto opacity-60 transition-opacity group-hover:opacity-100"
              width="120"
              height="24"
            />
            <p className="text-[11px] leading-relaxed text-text-muted">
              This product uses the TMDB API but is not endorsed or certified by TMDB.
            </p>
          </a>

          {/* Google Preferred Source button */}
          <div google-add-preferred-source-btn="" className="my-2" />

          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between text-[11px] font-mono uppercase tracking-wider text-text-muted">
            <p>
              © {new Date().getFullYear()} MuviDB Archive. Made for African cinema lovers.
            </p>

            <div className="flex flex-wrap items-center gap-3">
              <Link to="/terms" className="transition-colors hover:text-text-primary">Terms</Link>
              <span className="text-text-muted/40">/</span>
              <Link to="/privacy" className="transition-colors hover:text-text-primary">Privacy</Link>
              <span className="text-text-muted/40">/</span>
              <button
                type="button"
                onClick={() => window.dispatchEvent(new Event('open-cookie-consent'))}
                className="uppercase tracking-wider transition-colors hover:text-text-primary cursor-pointer"
              >
                Cookie Settings
              </button>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
