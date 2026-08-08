import { describe, expect, it } from 'vitest';
import { getImageSrcSet, getProxiedImageUrl, normalizeImageUrl } from './imageUrl';

const SUPABASE_POSTER =
  'https://pkenrmorywmuvnzfoylp.supabase.co/storage/v1/object/public/posters/abc/poster.jpg';

describe('normalizeImageUrl', () => {
  it('strips the line breaks some legacy rows contain', () => {
    expect(normalizeImageUrl('https://x.test/a\n/b.jpg  ')).toBe('https://x.test/a/b.jpg');
  });

  it('passes through empty values', () => {
    expect(normalizeImageUrl(null)).toBe('');
    expect(normalizeImageUrl('')).toBe('');
  });
});

describe('getProxiedImageUrl — Supabase images', () => {
  // Transformations are metered per source image and Pro includes only 100.
  // Requesting a width must NOT silently opt into the paid endpoint.
  it('serves the stored object even when a width is requested', () => {
    const url = getProxiedImageUrl(SUPABASE_POSTER, { width: 320 });
    expect(url).toBe('/storage/v1/object/public/posters/abc/poster.jpg');
    expect(url).not.toContain('render/image');
  });

  it('serves the stored object when no width is requested', () => {
    expect(getProxiedImageUrl(SUPABASE_POSTER)).toBe(
      '/storage/v1/object/public/posters/abc/poster.jpg',
    );
  });

  it('never emits the metered endpoint at any width', () => {
    for (const width of [16, 320, 640, 1280, 2560]) {
      expect(getProxiedImageUrl(SUPABASE_POSTER, { width })).not.toContain('render/image');
    }
  });

  it('normalises an already-transformed URL back to the plain object', () => {
    const transformed =
      'https://pkenrmorywmuvnzfoylp.supabase.co/storage/v1/render/image/public/posters/abc/poster.jpg?width=320';
    expect(getProxiedImageUrl(transformed, { width: 320 })).toBe(
      '/storage/v1/object/public/posters/abc/poster.jpg',
    );
  });
});

describe('getImageSrcSet', () => {
  it('degrades to undefined when every width collapses to one URL', () => {
    // Callers treat undefined as "no srcset" and fall back to plain src, which
    // is what keeps images working now that widths no longer vary the URL.
    expect(getImageSrcSet(SUPABASE_POSTER, [320, 640, 1280])).toBeUndefined();
  });

  it('returns undefined for an empty width list', () => {
    expect(getImageSrcSet(SUPABASE_POSTER, [])).toBeUndefined();
  });
});
