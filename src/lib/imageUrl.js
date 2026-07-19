const SUPABASE_DOMAIN = 'https://pkenrmorywmuvnzfoylp.supabase.co';
const STORAGE_OBJECT_PREFIX = '/storage/v1/object/public/';
const STORAGE_RENDER_PREFIX = '/storage/v1/render/image/public/';

// These hosts already provide stable public images. Other external images are
// routed through our cached media proxy in production.
const FRIENDLY_HOST = /(^|\.)(tmdb\.org|ytimg\.com|youtube\.com|ggpht\.com|googleusercontent\.com|ui-avatars\.com|muvidb\.com)$/i;

const isLocalhost =
  typeof window !== 'undefined' &&
  /^(localhost|127\.0\.0\.1|0\.0\.0\.0)$/.test(window.location.hostname);

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
  if (!width) return `${STORAGE_OBJECT_PREFIX}${objectPath}`;

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
      const mediaUrl = `/api/media?url=${encodeURIComponent(normalized)}`;
      if (!width) return mediaUrl;
      return `/_vercel/image?url=${encodeURIComponent(mediaUrl)}&w=${width}&q=${quality}`;
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
