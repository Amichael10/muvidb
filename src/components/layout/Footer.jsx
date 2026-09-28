import { Link } from 'react-router-dom';
import { Icon } from '@iconify/react';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { SOCIAL_LINKS } from '../../config/socialLinks';

const footerGroups = [
  {
    title: 'Discover',
    links: [
      { label: 'Home', to: '/' },
      { label: 'Browse Movies', to: '/browse' },
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
    title: 'Platform',
    links: [
      { label: 'About Us', to: '/about' },
      { label: 'Developer API', to: '/developers', isNew: true },
      { label: 'Title Search', to: '/tools/title-checker', isNew: true },
      { label: 'MuviDB Pro', comingSoon: true },
      { label: 'Add a Film', to: '/submit/film' },
      { label: 'Contribute', to: '/submit' },
      { label: 'Film Classification', to: '/classification' },
      { label: 'Careers', to: '/careers' },
      { label: 'Contact', to: '/contact' },
      { label: 'Sign In', to: '/login', guestOnly: true },
      { label: 'Join MuviDB', to: '/signup', guestOnly: true },
      { label: 'Dashboard', to: '/dashboard', authOnly: true },
    ],
  },
];

const DATABASE_METRICS = [
  { label: 'Films Cataloged', val: '12,400+' },
  { label: 'Box Office Tracked', val: '₦18.5B+' },
  { label: 'Filmmaker Credits', val: '1,200+' },
  { label: 'Cinemas & Streaming', val: '50+' },
];

export default function Footer() {
  const { theme } = useTheme();
  const { isAuthenticated } = useAuth();

  return (
    <footer className="relative bg-[#080A0D] text-[#8E95A5] border-t border-white/10 select-none">
      {/* Live Cinephile Database Counter Bar */}
      <div className="border-b border-white/5 bg-[#0B0D11] py-4 px-6 sm:px-8">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4 text-xs font-mono">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-brand animate-pulse" />
            <span className="text-white font-bold uppercase tracking-wider text-[11px]">
              MuviDB Live Archive
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-[11px] text-white/60">
            {DATABASE_METRICS.map((metric, idx) => (
              <div key={metric.label} className="flex items-center gap-1.5">
                <span className="text-white font-bold">{metric.val}</span>
                <span className="text-white/40">{metric.label}</span>
                {idx < DATABASE_METRICS.length - 1 && (
                  <span className="hidden sm:inline text-white/20 ml-4">•</span>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="relative z-10 mx-auto max-w-7xl px-6 py-16 sm:px-8 sm:py-20 lg:px-10">
        <div className="grid gap-12 md:grid-cols-[1.45fr_repeat(3,minmax(0,1fr))] lg:gap-20">
          <div className="max-w-sm space-y-5">
            <Link to="/" className="inline-flex items-center">
              <img
                src={theme === 'dark' ? '/images/MuviDB Brand/White Wordmark.svg' : '/images/MuviDB Brand/Black Wordmark.svg'}
                alt="MuviDB"
                className="h-7 w-auto object-contain"
              />
            </Link>
            <p className="text-xs sm:text-sm font-normal leading-relaxed text-[#9DA3B4]">
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
                    className="flex h-9 w-9 items-center justify-center rounded-[4px] border border-white/10 text-white/60 transition-colors hover:border-brand hover:text-brand hover:bg-brand/5"
                  >
                    <Icon icon={social.icon} className="text-base" aria-hidden="true" />
                  </a>
                ) : (
                  <span
                    key={social.label}
                    role="img"
                    aria-label={`${social.label} — coming soon`}
                    className="flex h-9 w-9 items-center justify-center rounded-[4px] border border-white/5 text-white/20"
                  >
                    <Icon icon={social.icon} className="text-base" aria-hidden="true" />
                  </span>
                ),
              )}
            </div>
          </div>

          {footerGroups.map((group) => (
            <nav key={group.title} aria-label={group.title}>
              <h3 className="mb-4 text-[10px] font-mono font-bold uppercase tracking-[0.25em] text-white/90">
                {group.title}
              </h3>
              <ul className="space-y-3">
                {group.links
                  .filter((link) =>
                    link.guestOnly ? !isAuthenticated : !link.authOnly || isAuthenticated,
                  )
                  .map((link) => (
                    <li key={link.to || link.label} className="leading-none">
                      {link.comingSoon ? (
                        <span className="inline-flex items-center gap-2 text-xs font-normal leading-none text-white/40">
                          <span>{link.label}</span>
                          <span className="rounded px-1.5 py-0.5 text-[8px] font-mono font-bold uppercase tracking-wider text-amber-400 bg-amber-400/10 border border-amber-400/20">
                            Soon
                          </span>
                        </span>
                      ) : (
                        <Link
                          to={link.to}
                          className="inline-flex items-center gap-2 text-xs font-normal leading-none text-[#8E95A5] transition-colors hover:text-white"
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

        <div className="mt-14 space-y-6 border-t border-white/5 pt-8">
          <a
            href="https://www.themoviedb.org/"
            target="_blank"
            rel="noopener noreferrer"
            className="group flex max-w-xl flex-col gap-2.5 sm:flex-row sm:items-center"
            aria-label="The Movie Database — opens in a new tab"
          >
            <img
              src="/images/attribution/tmdb-logo.svg"
              alt=""
              className="h-5 w-auto opacity-60 transition-opacity group-hover:opacity-100"
              width="120"
              height="24"
            />
            <p className="text-[11px] leading-relaxed text-white/40">
              This product uses the TMDB API but is not endorsed or certified by TMDB.
            </p>
          </a>

          {/* Google Preferred Source button */}
          <div google-add-preferred-source-btn="" className="my-2" />

          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between text-[10px] font-mono uppercase tracking-wider text-white/40">
            <p>
              © {new Date().getFullYear()} MuviDB Archive. Made for African cinema lovers.
            </p>

            <div className="flex flex-wrap items-center gap-3">
              <Link to="/terms" className="transition-colors hover:text-white">Terms</Link>
              <span className="text-white/20">/</span>
              <Link to="/privacy" className="transition-colors hover:text-white">Privacy</Link>
              <span className="text-white/20">/</span>
              <button
                type="button"
                onClick={() => window.dispatchEvent(new Event('open-cookie-consent'))}
                className="uppercase tracking-wider transition-colors hover:text-white cursor-pointer"
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
