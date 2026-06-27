// Supabase Storage images are served at full resolution. To cut the bytes (the
// single biggest payload on the homepage) we route them through Vercel's Image
// Optimization endpoint (/_vercel/image), which resizes + re-encodes to WebP/AVIF
// on the fly. This works on the Supabase Free tier because the optimization
// happens at the Vercel edge, not in Supabase.
//
// IMPORTANT: every width passed here MUST be present in vercel.json -> images.sizes
// (or deviceSizes) or the optimizer returns HTTP 400. Keep the two in sync.

const SUPABASE_DOMAIN = 'https://pkenrmorywmuvnzfoylp.supabase.co';

// Hosts that serve images hotlink-friendly (or are ours) — leave them untouched.
// Everything else external gets routed through our /api/media proxy so the
// origin is hidden and hotlink-protected images still render from muvidb.com.
const FRIENDLY_HOST = /(^|\.)(tmdb\.org|ytimg\.com|youtube\.com|ggpht\.com|googleusercontent\.com|ui-avatars\.com|muvidb\.com)$/i;

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

  // Same-origin Supabase storage path: optimize via Vercel (prod, width given).
  if (url.startsWith('/')) {
    if (isLocalhost || !width) return url;
    return `/_vercel/image?url=${encodeURIComponent(url)}&w=${width}&q=${quality}`;
  }

  // External absolute URL. Friendly hosts (TMDB/YouTube/ours) render directly;
  // everything else goes through the /api/media proxy to dodge hotlink blocks
  // and keep the origin hidden. Skip the proxy on localhost (route not served by Vite).
  if (/^https?:\/\//i.test(url) && !isLocalhost) {
    let host = '';
    try { host = new URL(url).hostname; } catch { /* leave host empty */ }
    if (host && !FRIENDLY_HOST.test(host)) {
      return `/api/media?url=${encodeURIComponent(originalUrl)}`;
    }
  }

  return url;
}
