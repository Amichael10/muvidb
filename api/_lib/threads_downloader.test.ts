import { describe, expect, it, vi, beforeEach } from 'vitest';
import {
  cleanThreadsUrl,
  decodeHtmlEntities,
  extractThreadsMedia,
  extractThreadsShortcode,
  isThreadsUrl,
} from './threads_downloader.js';

describe('Threads media extraction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('correctly identifies Threads URLs and shortcodes', () => {
    expect(isThreadsUrl('https://www.threads.net/@muvidb/post/DFkxyz123')).toBe(true);
    expect(isThreadsUrl('https://threads.net/t/DFkxyz123')).toBe(true);
    expect(isThreadsUrl('https://threads.com/@user/post/123')).toBe(true);
    expect(isThreadsUrl('https://instagram.com/p/123')).toBe(false);

    expect(extractThreadsShortcode('https://www.threads.net/@muvidb/post/DFkxyz123')).toBe(
      'DFkxyz123',
    );
    expect(extractThreadsShortcode('https://threads.net/t/C8abc123/')).toBe('C8abc123');
  });

  it('cleans tracking parameters from Threads URLs', () => {
    const dirtyUrl = 'https://www.threads.net/@muvidb/post/DFkxyz123?xmt=AQG123&utm_source=share';
    const cleaned = cleanThreadsUrl(dirtyUrl);
    expect(cleaned).toBe('https://www.threads.net/@muvidb/post/DFkxyz123');
  });

  it('extracts metadata from oEmbed and HTML fallback', async () => {
    const mockHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta property="og:title" content="CJ Obasi (@cjfiery) on Threads" />
          <meta property="og:description" content="Mami Wata is streaming worldwide today. Thank you all for the love." />
          <meta property="og:image" content="https://threads.net/media/mami_wata.jpg" />
        </head>
      </html>
    `;

    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (url.includes('/extract')) {
          return { ok: false, status: 500 };
        }
        if (url.includes('/api/v1/oembed')) {
          return {
            ok: true,
            json: async () => ({
              title: 'Mami Wata is streaming worldwide today.',
              author_name: 'CJ Obasi',
              author_url: 'https://www.threads.net/@cjfiery',
              thumbnail_url: 'https://threads.net/media/mami_wata.jpg',
            }),
          };
        }
        return {
          ok: true,
          text: async () => mockHtml,
        };
      }),
    );

    const media = await extractThreadsMedia('https://www.threads.net/@cjfiery/post/DFkxyz123');
    expect(media.caption).toBe('Mami Wata is streaming worldwide today.');
    expect(media.authorName).toBe('CJ Obasi');
    expect(media.authorUsername).toBe('cjfiery');
    expect(media.imageUrl).toBe('https://threads.net/media/mami_wata.jpg');
    expect(media.title).toBe('CJ Obasi on Threads');
  });

  it('extracts video from microservice when available', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (url.includes('/extract')) {
          return {
            ok: true,
            json: async () => ({
              success: true,
              title: 'New Trailer Drop: The Black Book 2',
              caption: 'Teaser trailer is here! In cinemas December.',
              author: 'Editi Effiong',
              video_url: 'https://cdn.threads.net/trailer.mp4',
              image_url: 'https://cdn.threads.net/poster.jpg',
            }),
          };
        }
        return { ok: false, status: 404 };
      }),
    );

    const media = await extractThreadsMedia('https://www.threads.net/@editieffiong/post/C999');
    expect(media.videoUrl).toBe('https://cdn.threads.net/trailer.mp4');
    expect(media.imageUrl).toBe('https://cdn.threads.net/poster.jpg');
    expect(media.caption).toBe('Teaser trailer is here! In cinemas December.');
    expect(media.authorName).toBe('Editi Effiong');
    expect(media.title).toBe('Editi Effiong on Threads');
  });
});
