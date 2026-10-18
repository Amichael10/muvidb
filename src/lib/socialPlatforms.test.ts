import { describe, expect, it } from 'vitest';
import {
  SOCIAL_PLATFORMS,
  GENERIC_LINK,
  detectPlatform,
  platformFor,
  resolveSocialUrl,
  prettyUrl,
  handleFromUrl,
} from './socialPlatforms';

describe('registry shape', () => {
  it('every platform is complete, so no tile can render half-styled', () => {
    for (const p of SOCIAL_PLATFORMS) {
      expect(p.key, 'key').toBeTruthy();
      expect(p.label, `${p.key} label`).toBeTruthy();
      expect(p.icon, `${p.key} icon`).toMatch(/^[a-z-]+:[a-z0-9-]+$/);
      expect(p.fg, `${p.key} fg`).toMatch(/^text-/);
      expect(p.tint, `${p.key} tint`).toMatch(/^bg-/);
      expect(p.hosts.length, `${p.key} hosts`).toBeGreaterThan(0);
      expect(typeof p.handleToUrl, `${p.key} handleToUrl`).toBe('function');
    }
  });

  it('has no duplicate keys', () => {
    const keys = SOCIAL_PLATFORMS.map((p) => p.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('covers the platforms the reference design shows', () => {
    const keys = SOCIAL_PLATFORMS.map((p) => p.key);
    for (const expected of ['instagram', 'snapchat', 'youtube', 'facebook', 'tiktok', 'x']) {
      expect(keys).toContain(expected);
    }
  });
});

describe('detectPlatform — this is what spares a creator from choosing an icon', () => {
  it('recognises a pasted profile URL', () => {
    expect(detectPlatform('https://instagram.com/rinaboyxx')?.key).toBe('instagram');
    expect(detectPlatform('https://www.tiktok.com/@rinaboyxx')?.key).toBe('tiktok');
    expect(detectPlatform('https://youtube.com/@rinaboyxx')?.key).toBe('youtube');
    expect(detectPlatform('https://www.linkedin.com/in/michael-adewale')?.key).toBe('linkedin');
  });

  it('works without a scheme, which is how people paste', () => {
    expect(detectPlatform('instagram.com/rinaboyxx')?.key).toBe('instagram');
  });

  it('treats twitter.com and x.com as the same platform', () => {
    expect(detectPlatform('https://twitter.com/someone')?.key).toBe('x');
    expect(detectPlatform('https://x.com/someone')?.key).toBe('x');
  });

  it('matches subdomains but not lookalike domains', () => {
    expect(detectPlatform('https://open.spotify.com/artist/abc')?.key).toBe('spotify');
    // A phishing-style host must not borrow a brand icon.
    expect(detectPlatform('https://instagram.com.evil.example/x')?.key).not.toBe('instagram');
  });

  it('returns null for an unknown site, so the generic glyph is used', () => {
    expect(detectPlatform('https://amichael.design')).toBeNull();
    expect(detectPlatform('')).toBeNull();
    expect(detectPlatform(null)).toBeNull();
  });
});

describe('resolveSocialUrl — the chip + bare handle flow in the editor', () => {
  it('turns a bare handle into a full profile URL', () => {
    expect(resolveSocialUrl('instagram', 'rinaboyxx')).toBe('https://instagram.com/rinaboyxx');
    expect(resolveSocialUrl('tiktok', 'rinaboyxx')).toBe('https://tiktok.com/@rinaboyxx');
    expect(resolveSocialUrl('x', 'rinaboyxx')).toBe('https://x.com/rinaboyxx');
  });

  it('strips a leading @, which people always type', () => {
    expect(resolveSocialUrl('instagram', '@rinaboyxx')).toBe('https://instagram.com/rinaboyxx');
  });

  it('adds the @ YouTube channel handles need', () => {
    expect(resolveSocialUrl('youtube', 'rinaboyxx')).toBe('https://youtube.com/@rinaboyxx');
    expect(resolveSocialUrl('youtube', '@rinaboyxx')).toBe('https://youtube.com/@rinaboyxx');
  });

  it('leaves a full URL untouched', () => {
    const url = 'https://instagram.com/rinaboyxx';
    expect(resolveSocialUrl('instagram', url)).toBe(url);
  });

  it('keeps digits only for WhatsApp, which needs a bare number', () => {
    expect(resolveSocialUrl('whatsapp', '+234 801 234 5678')).toBe('https://wa.me/2348012345678');
  });

  it('returns null for nothing, so an empty field never becomes a dead link', () => {
    expect(resolveSocialUrl('instagram', '')).toBeNull();
    expect(resolveSocialUrl('instagram', null)).toBeNull();
  });
});

describe('platformFor accepts the names already stored in the people table', () => {
  it('maps the legacy twitter column onto X', () => {
    expect(platformFor('twitter')?.key).toBe('x');
    expect(platformFor('twitter_url')?.key).toBe('x');
  });

  it('maps the people-table column names', () => {
    expect(platformFor('youtube_handle')?.key).toBe('youtube');
    expect(platformFor('instagram_url')?.key).toBe('instagram');
  });

  it('is case insensitive and safe on junk', () => {
    expect(platformFor('InStaGram')?.key).toBe('instagram');
    expect(platformFor('myspace')).toBeNull();
    expect(platformFor(null)).toBeNull();
  });
});

describe('display helpers', () => {
  it('prettyUrl drops the scheme, www and trailing slash', () => {
    expect(prettyUrl('https://www.amichael.design/')).toBe('amichael.design');
  });

  it('handleFromUrl gives the name a creator recognises', () => {
    expect(handleFromUrl('https://instagram.com/rinaboyxx')).toBe('rinaboyxx');
    expect(handleFromUrl('https://tiktok.com/@rinaboyxx')).toBe('rinaboyxx');
    expect(handleFromUrl('https://www.linkedin.com/in/michael-adewale')).toBe('michael-adewale');
  });

  it('declines rather than showing a long opaque segment', () => {
    expect(handleFromUrl(`https://example.com/${'x'.repeat(50)}`)).toBeNull();
    expect(handleFromUrl('https://amichael.design')).toBeNull();
  });
});

describe('GENERIC_LINK keeps an unrecognised link looking deliberate', () => {
  it('carries the same styling fields a platform does', () => {
    expect(GENERIC_LINK.icon).toBeTruthy();
    expect(GENERIC_LINK.fg).toMatch(/^text-/);
    expect(GENERIC_LINK.tint).toMatch(/^bg-/);
  });
});
