import { useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import {
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  isRouteErrorResponse,
  useLocation,
} from 'react-router';
import { Toaster } from 'react-hot-toast';

import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { QuickViewProvider } from './context/QuickViewContext';

import Navbar from './components/layout/Navbar';
import Footer from './components/layout/Footer';
import MobileNav from './components/layout/MobileNav';
import SmoothScroll from './components/layout/SmoothScroll';
import CookieConsent from './components/CookieConsent';
import QuickViewModal from './components/film/QuickViewModal';

import './index.css';

const ORG_JSONLD = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'MuviDB',
  url: 'https://muvidb.com/',
  logo: 'https://muvidb.com/images/MuviDB%20Brand/og-image.png',
  description: 'The home of Nollywood — every film, every credit, and where to watch.',
};

const SITE_JSONLD = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: 'MuviDB',
  url: 'https://muvidb.com/',
  potentialAction: {
    '@type': 'SearchAction',
    target: {
      '@type': 'EntryPoint',
      urlTemplate: 'https://muvidb.com/search?q={search_term_string}',
    },
    'query-input': 'required name=search_term_string',
  },
};

/**
 * The document shell. Everything here used to live in index.html — under
 * framework mode React renders the whole document, so index.html is no longer
 * the entry point.
 */
export function Layout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="UTF-8" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no"
        />
        <meta name="theme-color" content="#FF5C00" />

        {/* Speed up the first image/data round-trips (Core Web Vitals) */}
        <link rel="preconnect" href="https://pkenrmorywmuvnzfoylp.supabase.co" crossOrigin="" />
        <link rel="dns-prefetch" href="https://pkenrmorywmuvnzfoylp.supabase.co" />
        <link rel="preconnect" href="https://i.ytimg.com" />
        <link rel="dns-prefetch" href="https://www.partyjolloftv.com" />

        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&family=Syne:wght@400;600;700;800&family=Inter:wght@400;500;600&display=swap"
          rel="stylesheet"
        />

        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <link rel="icon" type="image/png" href="/favicon.png" />
        <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
        <link rel="shortcut icon" href="/favicon.ico" />
        <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
        <meta name="apple-mobile-web-app-title" content="MuviDB" />
        <link rel="manifest" href="/site.webmanifest" />

        {/* Site-level structured data (sitelinks search box + brand entity) */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(ORG_JSONLD) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(SITE_JSONLD) }}
        />

        {/* Per-route <title>/<meta> from each route's `meta` export, then styles */}
        <Meta />
        <Links />
      </head>
      <body>
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

/** Default site-wide meta, overridden per route by a route's `meta` export. */
export function meta() {
  const title = 'MuviDB | The Ultimate African Film & Entertainment Database';
  const description =
    'Every film. Every credit. Explore African cinema, discover talent, track releases, and connect with the people behind the stories.';
  const image = 'https://muvidb.com/images/MuviDB%20Brand/og-image.png';
  return [
    { title },
    { name: 'description', content: description },
    { property: 'og:type', content: 'website' },
    { property: 'og:url', content: 'https://muvidb.com/' },
    { property: 'og:title', content: title },
    { property: 'og:description', content: description },
    { property: 'og:image', content: image },
    { name: 'twitter:card', content: 'summary_large_image' },
    { property: 'twitter:domain', content: 'muvidb.com' },
    { property: 'twitter:url', content: 'https://muvidb.com/' },
    { name: 'twitter:title', content: title },
    { name: 'twitter:description', content: description },
    { name: 'twitter:image', content: image },
  ];
}

function BackToTop() {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const handleScroll = () => setVisible(window.scrollY > 400);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);
  if (!visible) return null;
  return (
    <button
      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      className="fixed bottom-28 right-6 bg-brand/90 hover:bg-brand text-white p-3 rounded-full shadow-xl z-50 transition-all hover:scale-110 active:scale-95 lg:bottom-12 lg:right-12 lg:p-4 border border-white/10"
    >
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m18 15-6-6-6 6"/></svg>
    </button>
  );
}

/** Navbar/Footer chrome — the old `Layout` from App.tsx, renamed so it doesn't
 *  collide with the framework's document-level `Layout` export above. */
function AppChrome({ children }: { children: ReactNode }) {
  const location = useLocation();
  const isAdminPath = location.pathname.startsWith('/admin');
  const isOnboardingPath = location.pathname === '/onboarding';
  const isWaitlistPath = location.pathname === '/waitlist';

  const hideLayout = isAdminPath || isOnboardingPath || isWaitlistPath;

  return (
    <div className="min-h-screen flex flex-col bg-bg text-text-primary">
      {!hideLayout && <Navbar />}
      <main className={`flex-grow ${!hideLayout ? 'pt-24 pb-20 lg:pb-0' : ''}`}>
        {children}
      </main>
      {!hideLayout && <Footer />}
      {!hideLayout && <MobileNav />}
      {!hideLayout && <BackToTop />}
    </div>
  );
}

export default function Root() {
  // PostHog is browser-only and was previously initialised at module scope in
  // main.tsx — that would now run during server rendering, so it moves into an
  // effect and is imported dynamically.
  useEffect(() => {
    const key = import.meta.env.VITE_POSTHOG_KEY;
    if (!key) return;
    import('posthog-js').then(({ default: posthog }) => {
      posthog.init(key, {
        api_host: import.meta.env.VITE_POSTHOG_HOST || 'https://us.i.posthog.com',
        person_profiles: 'identified_only',
        opt_out_capturing_by_default: true,   // wait for cookie consent
        opt_out_persistence_by_default: true,
        disable_session_recording: true,
      });
    });
  }, []);

  return (
    <AuthProvider>
      <ThemeProvider>
        <QuickViewProvider>
          <SmoothScroll>
            <Toaster
              position="top-center"
              toastOptions={{
                style: {
                  background: '#1A1A1A',
                  color: '#F2F2F2',
                  border: '1px solid #333333',
                },
              }}
            />
            <CookieConsent />
            <QuickViewModal />
            {/* Signature: subtle film grain over the whole app */}
            <div className="film-grain" aria-hidden="true" />
            <AppChrome>
              <Outlet />
            </AppChrome>
          </SmoothScroll>
        </QuickViewProvider>
      </ThemeProvider>
    </AuthProvider>
  );
}

/** Shown while the client hydrates deferred UI — must not replace SSR HTML permanently. */
export function HydrateFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-bg text-text-secondary text-sm">
      Loading…
    </div>
  );
}

export function ErrorBoundary({ error }: { error: unknown }) {
  const message = isRouteErrorResponse(error)
    ? error.status === 404
      ? 'That page could not be found.'
      : `${error.status} ${error.statusText}`
    : 'Something went wrong loading this page.';

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-5 bg-bg text-text-primary px-6 text-center">
      <p className="text-text-secondary text-sm max-w-xs">{message}</p>
      <button
        onClick={() => window.location.reload()}
        className="bg-brand text-white font-bold px-6 py-3 rounded-xl text-sm hover:opacity-90 transition-opacity"
      >
        Reload
      </button>
    </div>
  );
}
