/**
 * Search route wrapper.
 *
 * Deliberately **no loader** — results stay client-side. Two reasons:
 *
 * 1. The query space is unbounded. Every distinct `?q=` is a fresh cache miss, so
 *    server-rendering search would put an uncacheable, user-controlled workload on
 *    a DB that already runs 8–15s under load and has thrown 57014 timeouts. It's
 *    also a cheap scraping lever.
 * 2. Search result pages shouldn't be indexed anyway (thin/duplicate content), so
 *    SSR buys no SEO — which is the main reason to server-render at all.
 *
 * What this wrapper *does* add is the `noindex` that the page never had: as a
 * client-only SPA route it inherited the site-wide default of `index, follow`, so
 * every crawled `/search?q=…` was a candidate for the index.
 */
export { default } from '../pages/Search';

export function meta() {
  const title = 'Search | MuviDB';
  return [
    { title },
    { name: 'description', content: 'Search films, people and studios on MuviDB — the home of Nollywood.' },
    // Result pages are thin/duplicate — keep them out of the index but let the
    // crawler follow through to the films and profiles they link to.
    { name: 'robots', content: 'noindex, follow' },
  ];
}
