const SUPABASE_DOMAIN = 'https://pkenrmorywmuvnzfoylp.supabase.co';
const STORAGE_OBJECT_PREFIX = '/storage/v1/object/public/';
const STORAGE_RENDER_PREFIX = '/storage/v1/render/image/public/';

// These hosts already provide stable public images. Other external images are
// routed through our cached media proxy in production.
const FRIENDLY_HOST = /(^|\.)(tmdb\.org|ytimg\.com|youtube\.com|ggpht\.com|googleusercontent\.com|ui-avatars\.com|muvidb\.com)$/i;

// Under SSR this module is evaluated on the server too, where there is no
// window — so the server would compute `false` and emit a /_vercel/image URL
// while the browser on localhost computes `true` and emits the raw URL, which
// React reports as a hydration mismatch. Treating a dev-mode server render as
// localhost keeps both sides in agreement. In production both evaluate false.
const isLocalhost =
  typeof window !== 'undefined'
    ? /^(localhost|127\.0\.0\.1|0\.0\.0\.0)$/.test(window.location.hostname)
    // NB: must be the exact token `import.meta.env.DEV` — Vite substitutes it
    // statically at build time, and optional chaining (`import.meta.env?.DEV`)
    // defeats that replacement, leaving it undefined on the server.
    : import.meta.env.DEV === true;

export function normalizeImageUrl(value) {
  if (!value) return '';
  // A few legacy database values contain line breaks inside otherwise valid
  // URLs. Browsers tolerate them, but optimizers and cache keys do not.
  return String(value).replace(/[\r\n\t]/g, '').trim();
}

function clampInteger(value, min, max) {
  const number = Math.round(Number(value));
  if (!Number.isFinite(number)) return null;
  return Math.min(max, Math.max(min, number));
}

function getSupabaseObjectPath(value) {
  const url = normalizeImageUrl(value);
  if (!url) return null;

  let pathname = url;
  if (/^https?:\/\//i.test(url)) {
    try {
      const parsed = new URL(url);
      if (parsed.origin !== SUPABASE_DOMAIN) return null;
      pathname = parsed.pathname;
    } catch {
      return null;
    }
  }

  if (pathname.startsWith(STORAGE_OBJECT_PREFIX)) {
    return pathname.slice(STORAGE_OBJECT_PREFIX.length);
  }
  if (pathname.startsWith(STORAGE_RENDER_PREFIX)) {
    return pathname.slice(STORAGE_RENDER_PREFIX.length);
  }
  return null;
}

function buildSupabaseImageUrl(objectPath, width, quality) {
  // Supabase image transformations are metered per unique source image, and Pro
  // includes only 100 per billing period. Routing the catalogue through them hit
  // 2,088 in one cycle — a ~20x overage.
  //
  // Our stored images do not need it: posters average ~43 KB (908 MB across
  // 21,592 objects), so a resize saves little and costs quota on every new image
  // a visitor sees. Serving the stored object directly is both cheaper and one
  // less hop.
  //
  // getImageSrcSet() degrades cleanly — when every width collapses to the same
  // URL it returns undefined, and callers fall back to plain `src`.
  //
  // Set VITE_SUPABASE_IMAGE_TRANSFORMS=true to re-enable, e.g. if larger
  // originals are stored later and resizing becomes worth the quota.
  const transformsEnabled = import.meta.env.VITE_SUPABASE_IMAGE_TRANSFORMS === 'true';
  if (!width || !transformsEnabled) return `${STORAGE_OBJECT_PREFIX}${objectPath}`;

  const params = new URLSearchParams({
    width: String(width),
    quality: String(quality),
    resize: 'cover',
  });
  return `${STORAGE_RENDER_PREFIX}${objectPath}?${params.toString()}`;
}

/**
 * Return a responsive, cache-stable image URL.
 *
 * Supabase-owned images use Pro image transformations through our existing
 * same-origin storage proxy. Third-party images stay direct when reliable and
 * use the cached MuviDB media proxy otherwise.
 */
export function getProxiedImageUrl(originalUrl, opts = {}) {
  const normalized = normalizeImageUrl(originalUrl);
  if (!normalized) return normalized;

  const width = clampInteger(opts.width, 16, 2560);
  const quality = clampInteger(opts.quality ?? 75, 20, 100) ?? 75;
  const objectPath = getSupabaseObjectPath(normalized);

  if (objectPath) {
    return buildSupabaseImageUrl(objectPath, width, quality);
  }

  if (/^https?:\/\//i.test(normalized) && !isLocalhost) {
    let host = '';
    try {
      host = new URL(normalized).hostname;
    } catch {
      return normalized;
    }

    if (host && !FRIENDLY_HOST.test(host)) {
      // Route through our media proxy. Do NOT wrap in /_vercel/image — Vercel
      // image optimization rejects relative /api/media URLs
      // (INVALID_IMAGE_OPTIMIZE_REQUEST), which blanked person photos on
      // PersonDetail (width={512}) while PersonCard (raw src) still worked.
      return `/api/media?url=${encodeURIComponent(normalized)}`;
    }
  }

  return normalized;
}

export function getImageSrcSet(originalUrl, widths, quality = 75) {
  const candidates = [...new Set((widths || [])
    .map(width => clampInteger(width, 16, 2560))
    .filter(Boolean))]
    .sort((first, second) => first - second)
    .map(width => ({ width, url: getProxiedImageUrl(originalUrl, { width, quality }) }));

  const uniqueUrls = [...new Set(candidates.map(candidate => candidate.url))];
  if (uniqueUrls.length < 2) return undefined;
  return candidates.map(candidate => `${candidate.url} ${candidate.width}w`).join(', ');
}
