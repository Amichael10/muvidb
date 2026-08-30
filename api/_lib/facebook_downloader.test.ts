import { describe, expect, it, vi, beforeEach } from 'vitest';
import {
  cleanFacebookUrl,
  decodeHtmlEntities,
  extractFacebookMedia,
  isFacebookReelUrl,
  isFacebookUrl,
  isFacebookVideoUrl,
} from './facebook_downloader.js';

describe('Facebook media extraction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('correctly identifies Facebook URLs and Reels', () => {
    expect(isFacebookUrl('https://www.facebook.com/reel/123456789')).toBe(true);
    expect(isFacebookUrl('https://fb.watch/xyz123')).toBe(true);
    expect(isFacebookUrl('https://fb.me/abc')).toBe(true);
    expect(isFacebookUrl('https://example.com')).toBe(false);

    expect(isFacebookReelUrl('https://www.facebook.com/reel/123456789')).toBe(true);
    expect(isFacebookReelUrl('https://www.facebook.com/share/r/abc123xyz/')).toBe(true);
    expect(isFacebookReelUrl('https://www.facebook.com/watch/?v=123')).toBe(false);

    expect(isFacebookVideoUrl('https://fb.watch/xyz123')).toBe(true);
    expect(isFacebookVideoUrl('https://www.facebook.com/share/v/abc123xyz/')).toBe(true);
    expect(isFacebookVideoUrl('https://www.facebook.com/username/videos/123456/')).toBe(true);
  });

  it('cleans tracking parameters from Facebook URLs', () => {
    const dirtyUrl =
      'https://www.facebook.com/reel/123456789?mibextid=rS40aB7S9Ucbxw6v&rdid=abc&ref=share';
    const cleaned = cleanFacebookUrl(dirtyUrl);
    expect(cleaned).toBe('https://www.facebook.com/reel/123456789');
  });

  it('decodes HTML entities in text', () => {
    expect(decodeHtmlEntities('&quot;Hello&quot; &amp; &#039;World&#039;')).toBe('"Hello" & \'World\'');
  });

  it('extracts media from OpenGraph HTML when microservice is offline', async () => {
    const mockHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta property="og:title" content="Kunle Afolayan - Behind The Scenes of Anikulapo | Facebook" />
          <meta property="og:description" content="Exclusive first look at the production of the new Nollywood epic." />
          <meta property="og:image" content="https://scontent.facebook.com/poster.jpg" />
          <meta property="og:video" content="https://video.facebook.com/stream.mp4" />
        </head>
      </html>
    `;

    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (url.includes('/extract')) {
          return { ok: false, status: 500 };
        }
        return {
          ok: true,
          text: async () => mockHtml,
        };
      }),
    );

    const media = await extractFacebookMedia('https://www.facebook.com/share/r/abc123xyz/');
    expect(media.isReel).toBe(true);
    expect(media.isVideo).toBe(true);
    expect(media.videoUrl).toBe('https://video.facebook.com/stream.mp4');
    expect(media.imageUrl).toBe('https://scontent.facebook.com/poster.jpg');
    expect(media.caption).toBe('Exclusive first look at the production of the new Nollywood epic.');
    expect(media.authorName).toBe('Kunle Afolayan');
    expect(media.title).toContain('Kunle Afolayan on Facebook (Reel)');
  });

  it('extracts media using microservice when available', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (url.includes('/extract')) {
          return {
            ok: true,
            json: async () => ({
              success: true,
              title: 'Funke Akindele Breaks Box Office Record',
              caption: 'A Tribe Called Judah crosses 1 Billion Naira!',
              author: 'Funke Akindele',
              video_url: 'https://cdn.facebook.com/hd_reel.mp4',
              image_url: 'https://cdn.facebook.com/thumb.jpg',
            }),
          };
        }
        return { ok: false, status: 404 };
      }),
    );

    const media = await extractFacebookMedia('https://www.facebook.com/reel/999888777');
    expect(media.isReel).toBe(true);
    expect(media.videoUrl).toBe('https://cdn.facebook.com/hd_reel.mp4');
    expect(media.imageUrl).toBe('https://cdn.facebook.com/thumb.jpg');
    expect(media.caption).toBe('A Tribe Called Judah crosses 1 Billion Naira!');
    expect(media.authorName).toBe('Funke Akindele');
    expect(media.title).toBe('Funke Akindele on Facebook (Reel)');
  });
});
