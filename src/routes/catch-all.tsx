import { data, redirect, useLocation } from 'react-router';
import FilmmakerPortfolio from '../pages/FilmmakerPortfolio';
import LumiMirrorPreview from '../pages/LumiMirrorPreview';

/**
 * Catch-all handler:
 * - If path has a trailing slash (e.g. `/mirror-preview/end-to-end-test/`), redirect to canonical path.
 * - If the URL starts with `/@...`, serve the Creator Link.
 * - If the URL starts with `/mirror-preview` or `/mirror`, serve the isolated Mirror Preview.
 * - Otherwise, throw 404 so the root ErrorBoundary renders ErrorPage.
 */
export async function loader({ request }: { request: Request }) {
  const url = new URL(request.url);
  if (url.pathname.length > 1 && url.pathname.endsWith('/')) {
    const cleanPath = url.pathname.replace(/\/+$/, '') + url.search;
    return redirect(cleanPath);
  }
  if (url.pathname.startsWith('/@')) {
    return { isPortfolio: true };
  }
  if (url.pathname.startsWith('/mirror-preview') || url.pathname.startsWith('/mirror')) {
    return { isMirror: true };
  }
  throw data(null, { status: 404 });
}

export function meta({ location }: { location?: { pathname: string } }) {
  if (location?.pathname?.startsWith('/@')) {
    const handle = location.pathname.slice(2).split('/')[0];
    return [
      { title: `@${decodeURIComponent(handle)} | MuviDB Creator Link` },
      { name: 'robots', content: 'index, follow' },
    ];
  }
  if (location?.pathname?.startsWith('/mirror')) {
    return [
      { title: 'Lumi Mirror | Digital Identity Sandbox' },
      { name: 'robots', content: 'noindex, nofollow' },
    ];
  }
  return [
    { title: 'Page not found | MuviDB' },
    { name: 'robots', content: 'noindex, follow' },
  ];
}

export default function CatchAll() {
  const location = useLocation();
  if (location.pathname.startsWith('/@')) {
    return <FilmmakerPortfolio />;
  }
  if (location.pathname.startsWith('/mirror-preview') || location.pathname.startsWith('/mirror')) {
    return <LumiMirrorPreview />;
  }
  return null;
}
