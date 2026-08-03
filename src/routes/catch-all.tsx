import { data } from 'react-router';

/**
 * Unknown paths — throw 404 so the root ErrorBoundary renders ErrorPage.
 * (Previously redirected to `/`, which hid missing pages.)
 */
export async function loader() {
  throw data(null, { status: 404 });
}

export function meta() {
  return [
    { title: 'Page not found | MuviDB' },
    { name: 'robots', content: 'noindex, follow' },
  ];
}

export default function CatchAll() {
  return null;
}
