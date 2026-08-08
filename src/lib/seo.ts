/**
 * Client-safe half of the SEO helpers.
 *
 * `meta` is a *client* route export, so anything it touches gets bundled for the
 * browser. Keeping the pure shaping logic here — and the Supabase queries in
 * seo.server.ts — is what lets a route export both `loader` (server) and `meta`
 * (client) without pulling the service-role client into the client bundle.
 * See https://reactrouter.com/explanation/code-splitting#removal-of-server-code
 */

export type Seo = {
  title: string;
  description: string;
  image: string;
  canonical: string;
  robots: string;
  jsonLd: unknown[];
};

const DEFAULT_TITLE = 'MuviDB | The Ultimate African Film & Entertainment Database';

/**
 * Cache headers, matching what api/seo.ts used to send. The DB is slow (8–15s
 * under load), so every server-rendered route must be edge-cached — see
 * docs/SSR_MIGRATION.md.
 */
export const CACHE_OK = 'public, max-age=60, s-maxage=3600, stale-while-revalidate';
/** Thin/missing pages: short cache so later enrichment can become indexable fast. */
export const CACHE_404 = 'public, max-age=60, s-maxage=300, stale-while-revalidate';

/** Converts a Seo payload into React Router meta descriptors. */
export function toMeta(seo?: Seo) {
  if (!seo) return [{ title: DEFAULT_TITLE }];
  return [
    { title: seo.title },
    { name: 'description', content: seo.description },
    { name: 'robots', content: seo.robots },
    { tagName: 'link', rel: 'canonical', href: seo.canonical },
    { property: 'og:title', content: seo.title },
    { property: 'og:description', content: seo.description },
    { property: 'og:image', content: seo.image },
    { property: 'og:url', content: seo.canonical },
    { name: 'twitter:card', content: 'summary_large_image' },
    ...seo.jsonLd.map((block) => ({ 'script:ld+json': block })),
  ];
}
