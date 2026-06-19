/**
 * image_mirror.ts
 *
 * Downloads an external image URL and re-uploads it to Supabase Storage,
 * returning our own CDN URL. This eliminates hotlinking from third-party
 * sites (partyjolloftv, africanmoviedb, netflix CDN, etc.)
 *
 * Usage:
 *   const ownUrl = await mirrorImageToStorage(externalUrl, 'posters', 'film-id.jpg');
 */

import { supabase } from './supabase.js';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';

/** Domains we already own — skip mirroring for these */
const ALLOWED_DOMAINS = [
  'pkenrmorywmuvnzfoylp.supabase.co', // our own Supabase storage
  'image.tmdb.org',                    // TMDB explicitly allows hotlinking
  'ui-avatars.com',                    // placeholder service
];

/** Domains that routinely block external fetch (skip gracefully) */
const SKIP_DOMAINS = [
  'occ-0-',       // Netflix CDN — blocks all non-browser fetches
  'nflxso.net',
  'instagram.f',  // Instagram CDN — requires login session
  'fbcdn.net',
];

export function isOwnUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  try {
    const domain = new URL(url).hostname;
    return ALLOWED_DOMAINS.some(d => domain.endsWith(d));
  } catch {
    return false;
  }
}

function shouldSkip(url: string): boolean {
  return SKIP_DOMAINS.some(d => url.includes(d));
}

/**
 * Mirror an image from an external URL into Supabase Storage.
 *
 * @param externalUrl  - The source URL to download
 * @param bucket       - 'posters' | 'people' | 'backdrops' | 'film-images'
 * @param filename     - The filename to store (e.g. "abc123.jpg"). If omitted,
 *                       it is derived from the URL or a UUID.
 * @returns            - The public Supabase Storage URL, or null if failed
 */
export async function mirrorImageToStorage(
  externalUrl: string | null | undefined,
  bucket: 'posters' | 'people' | 'backdrops' | 'film-images',
  filename?: string,
): Promise<string | null> {
  if (!externalUrl) return null;

  // Already our own URL — nothing to do
  if (isOwnUrl(externalUrl)) return externalUrl;

  // Skip domains that will always fail
  if (shouldSkip(externalUrl)) return null;

  try {
    // 1. Download the image with a browser-like User-Agent
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000); // 15s timeout

    let response: Response;
    try {
      response = await fetch(externalUrl, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
          'Referer': 'https://muvidb.com/',
        },
      });
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) {
      console.warn(`[image_mirror] Fetch failed for ${externalUrl}: HTTP ${response.status}`);
      return null;
    }

    // 2. Validate content type
    const contentType = response.headers.get('content-type') || 'image/jpeg';
    if (!contentType.startsWith('image/')) {
      console.warn(`[image_mirror] Non-image content-type "${contentType}" for ${externalUrl}`);
      return null;
    }

    // 3. Derive a clean filename
    const ext = contentType.includes('png') ? 'png' : contentType.includes('webp') ? 'webp' : 'jpg';
    const storageName = filename
      ? `${filename.replace(/\.[^.]+$/, '')}.${ext}`
      : `${crypto.randomUUID()}.${ext}`;

    // 4. Get image bytes
    const buffer = await response.arrayBuffer();
    if (buffer.byteLength < 500) {
      // Suspiciously small — likely a 1x1 tracking pixel or error page
      console.warn(`[image_mirror] Image too small (${buffer.byteLength}B) for ${externalUrl}`);
      return null;
    }

    // 5. Upload to Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(storageName, buffer, {
        contentType,
        upsert: true,
        cacheControl: '31536000', // 1 year
      });

    if (uploadError) {
      console.error(`[image_mirror] Upload failed for ${externalUrl}:`, uploadError.message);
      return null;
    }

    // 6. Build and return the public URL
    const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/${bucket}/${storageName}`;
    console.log(`[image_mirror] ✓ Mirrored ${externalUrl} → ${publicUrl}`);
    return publicUrl;

  } catch (err: any) {
    if (err.name === 'AbortError') {
      console.warn(`[image_mirror] Timeout fetching ${externalUrl}`);
    } else {
      console.warn(`[image_mirror] Error for ${externalUrl}: ${err.message}`);
    }
    return null;
  }
}

/**
 * Mirror an image only if the URL is from a problematic third-party domain.
 * Returns the original URL if it's already acceptable (TMDB, own storage, etc.)
 * Falls back to the original URL if mirroring fails so data is never lost.
 */
export async function mirrorIfExternal(
  externalUrl: string | null | undefined,
  bucket: 'posters' | 'people' | 'backdrops' | 'film-images',
  filename?: string,
): Promise<string | null> {
  if (!externalUrl) return null;
  if (isOwnUrl(externalUrl)) return externalUrl;

  const mirrored = await mirrorImageToStorage(externalUrl, bucket, filename);
  // Fall back to original URL if mirroring fails — better to show the image
  // than to lose it entirely. The batch job will retry later.
  return mirrored ?? externalUrl;
}
