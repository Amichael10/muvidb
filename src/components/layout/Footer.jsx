import { Link } from 'react-router-dom';
import { useTheme } from '../../context/ThemeContext';

const footerGroups = [
  {
    title: 'Discover',
    links: [
      { label: 'Home', to: '/' },
      { label: 'Browse Movies', to: '/browse' },
      { label: 'Top Rated', to: '/browse?sort=rating' },
      { label: 'New Releases', to: '/browse?sort=new' },
    ],
  },
  {
    title: 'People',
    links: [
      { label: 'Actors', to: '/browse?type=actors' },
      { label: 'Directors', to: '/browse?type=directors' },
      { label: 'Producers', to: '/browse?type=producers' },
      { label: 'Writers', to: '/browse?type=writers' },
    ],
  },
  {
    title: 'Platform',
    links: [
      { label: 'About Us', to: '/about' },
      { label: 'Careers', to: '/careers' },
      { label: 'Contact', to: '/contact' },
      { label: 'Sign In', to: '/login' },
      { label: 'Join MuviDB', to: '/signup' },
      { label: 'Dashboard', to: '/dashboard' },
    ],
  },
];

export default function Footer() {
  const { theme } = useTheme();

  return (
    <footer className="relative overflow-hidden bg-surface-2 text-text-primary border-t border-hairline transition-colors duration-300">
      <span className="footer-film-strip-perfs top-6" aria-hidden="true" />
      <span className="footer-film-strip-perfs bottom-6 footer-film-strip-perfs--reverse" aria-hidden="true" />

      <div className="relative z-10 mx-auto max-w-7xl px-6 py-20 sm:px-8 sm:py-24 lg:px-10">
        <div className="grid gap-12 md:grid-cols-[1.45fr_repeat(3,minmax(0,1fr))] lg:gap-20">
          <div className="max-w-sm space-y-6">
            <Link to="/" className="inline-flex items-center">
              <img
                src={theme === 'dark' ? '/images/MuviDB Brand/White Wordmark.svg' : '/images/MuviDB Brand/Black Wordmark.svg'}
                alt="MuviDB"
                className="h-8 w-auto object-contain"
              />
            </Link>
            <p className="text-sm font-medium leading-7 text-text-secondary">
              The premier film database for Nollywood. Preserving the legacy, celebrating the future.
            </p>
          </div>

          {footerGroups.map((group) => (
            <nav key={group.title} aria-label={group.title}>
              <h3 className="mb-5 text-[11px] font-black uppercase tracking-[0.24em] text-text-primary">
                {group.title}
              </h3>
              <ul className="space-y-4">
                {group.links.map((link) => (
                  <li key={link.to} className="leading-none">
                    <Link
                      to={link.to}
                      className="block text-xs font-semibold leading-none text-text-muted transition-colors hover:text-brand"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        <div className="mt-16 flex flex-col gap-5 border-t border-hairline pt-8 md:flex-row md:items-center md:justify-between">
          <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-text-muted">
            Copyright {new Date().getFullYear()} MuviDB Database. All rights reserved.
          </p>

          <div className="flex flex-wrap items-center gap-3 text-[10px] font-bold uppercase tracking-[0.18em] text-text-muted">
            <Link to="/terms" className="transition-colors hover:text-brand">Terms</Link>
            <span className="text-border">|</span>
            <Link to="/privacy" className="transition-colors hover:text-brand">Privacy</Link>
            <span className="text-border">|</span>
            <button
              type="button"
              onClick={() => window.dispatchEvent(new Event('open-cookie-consent'))}
              className="uppercase tracking-[0.18em] transition-colors hover:text-brand"
            >
              Cookie Settings
            </button>
          </div>
        </div>
      </div>
    </footer>
  );
}
