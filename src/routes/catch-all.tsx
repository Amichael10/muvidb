import { data, useLocation } from 'react-router';
import FilmmakerPortfolio from '../pages/FilmmakerPortfolio';

/**
 * Catch-all handler:
 * - If the URL starts with `/@...`, serve the Filmmaker Link-in-Bio Portfolio.
 * - Otherwise, throw 404 so the root ErrorBoundary renders ErrorPage.
 */
export async function loader({ request }: { request: Request }) {
  const url = new URL(request.url);
  if (url.pathname.startsWith('/@')) {
    return { isPortfolio: true };
  }
  throw data(null, { status: 404 });
}

export function meta({ location }: { location?: { pathname: string } }) {
  if (location?.pathname?.startsWith('/@')) {
    const handle = location.pathname.slice(2).split('/')[0];
    return [
      { title: `@${decodeURIComponent(handle)} | MuviDB Creator Portfolio` },
      { name: 'robots', content: 'index, follow' },
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
  return null;
}
