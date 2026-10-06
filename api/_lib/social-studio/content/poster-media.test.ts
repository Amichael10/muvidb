import { describe, expect, it } from 'vitest';
import sharp from 'sharp';
import { preparePoster, socialPhotoUrl, downloadSocialImage } from './poster-media.js';

describe('poster media', () => {
  it('rejects landscape thumbnails rather than cropping them into a poster', async () => {
    const image = await sharp({ create: { width: 1280, height: 720, channels: 3, background: '#ff0000' } }).png().toBuffer();
    await expect(preparePoster(image)).rejects.toThrow('Portrait poster strictly required');
  });
  it('preserves an entire portrait poster inside a JPEG canvas supported by both platforms', async () => {
    const image = await sharp({ create: { width: 600, height: 900, channels: 3, background: '#ff0000' } }).png().toBuffer();
    const result = await preparePoster(image);
    const metadata = await sharp(result.jpeg).metadata();
    expect(metadata).toMatchObject({ format: 'jpeg', width: 864, height: 1080 });
    const { data, info } = await sharp(result.jpeg).raw().toBuffer({ resolveWithObject: true });
    expect(data[0]).toBeLessThan(30); // Side padding, not a cropped or stretched poster.
    expect(data[(540 * info.width + 432) * info.channels]).toBeGreaterThan(240);
  });
  it('strictly rejects landscape artwork unconditionally even if bypass was requested', async () => {
    const image = await sharp({ create: { width: 1200, height: 675, channels: 3, background: '#fff' } }).png().toBuffer();
    await expect(preparePoster(image, false)).rejects.toThrow('Portrait poster strictly required');
  });
  it('strictly rejects square artwork (must be portrait)', async () => {
    const image = await sharp({ create: { width: 800, height: 800, channels: 3, background: '#fff' } }).png().toBuffer();
    await expect(preparePoster(image)).rejects.toThrow('Portrait poster strictly required');
  });
  it('strictly rejects low-resolution portrait posters below 450x600', async () => {
    const image = await sharp({ create: { width: 300, height: 450, channels: 3, background: '#fff' } }).png().toBuffer();
    await expect(preparePoster(image)).rejects.toThrow('Poster resolution is too low');
  });
  it('serves TikTok images through the owned domain rather than a storage redirect', () => {
    expect(socialPhotoUrl('tiktok/abc/0.jpg')).toBe('https://muvidb.com/api/media?op=social-photo&path=tiktok%2Fabc%2F0.jpg');
  });
  it('rejects YouTube thumbnail URLs before fetching', async () => {
    await expect(downloadSocialImage('https://i.ytimg.com/vi/abc123xyz/hqdefault.jpg')).rejects.toThrow('Landscape or video thumbnail URL detected');
  });
  it('rejects local URLs before fetching', async () => {
    await expect(downloadSocialImage('https://127.0.0.1/private')).rejects.toThrow('public HTTPS');
  });
});
