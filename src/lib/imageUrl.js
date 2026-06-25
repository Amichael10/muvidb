// Supabase Storage images are served at full resolution. To cut the bytes (the
// single biggest payload on the homepage) we route them through Vercel's Image
// Optimization endpoint (/_vercel/image), which resizes + re-encodes to WebP/AVIF
// on the fly. This works on the Supabase Free tier because the optimization
// happens at the Vercel edge, not in Supabase.
//
// IMPORTANT: every width passed here MUST be present in vercel.json -> images.sizes
// (or deviceSizes) or the optimizer returns HTTP 400. Keep the two in sync.

const SUPABASE_DOMAIN = 'https://pkenrmorywmuvnzfoylp.supabase.co';

// Vite dev server doesn't serve /_vercel/image, and the storage reverse-proxy
// (see vercel.json routes / vite.config proxy) only exists outside localhost,
// so skip optimization in local development.
const isLocalhost =
  typeof window !== 'undefined' &&
  /^(localhost|127\.0\.0\.1|0\.0\.0\.0)$/.test(window.location.hostname);

/**
 * Rewrite an image URL for cheaper delivery.
 *
 * @param {string} originalUrl
 * @param {{ width?: number, quality?: number }} [opts]
 * @returns {string}
 */
export function getProxiedImageUrl(originalUrl, opts = {}) {
  if (!originalUrl) return originalUrl;

  const { width, quality = 75 } = opts;

  // Convert absolute Supabase Storage URLs to the same-origin reverse-proxy path
  // so they share our domain (better caching, and required for the optimizer).
  let url = originalUrl;
  if (url.startsWith(SUPABASE_DOMAIN)) {
    url = url.replace(SUPABASE_DOMAIN, '');
  }

  // In dev, or with no width, or for non-Supabase URLs (e.g. YouTube/TMDB
  // thumbnails which live on other origins and have their own fallback logic),
  // return the path untouched. We only optimize same-origin storage paths so we
  // don't need to whitelist external domains and don't disturb other components.
  if (isLocalhost || !width || !url.startsWith('/')) {
    return url;
  }

  // Vercel's optimizer needs the source as a root-relative URL.
  return `/_vercel/image?url=${encodeURIComponent(url)}&w=${width}&q=${quality}`;
}
