import { afterEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ download: vi.fn() }));
vi.mock('./_lib/safe_image_download.js', () => ({ downloadPublicImage: mocks.download }));
vi.mock('./_lib/health.js', () => ({ handleHealth: vi.fn() }));
vi.mock('./_lib/mirror_images_admin.js', () => ({ handleMirrorImages: vi.fn() }));
import handler from './media';

function response() {
  const res: any = { status: vi.fn(() => res), send: vi.fn(() => res), setHeader: vi.fn() };
  return res;
}
afterEach(() => vi.unstubAllGlobals());

it('rejects active SVG content despite an image content type', async () => {
  mocks.download.mockResolvedValue(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script/></svg>'));
  const res = response();
  await handler({ query: { url: 'https://images.example.com/file.svg' } } as any, res);
  expect(res.status).toHaveBeenCalledWith(415);
  expect(res.setHeader).not.toHaveBeenCalledWith('Content-Type', 'image/svg+xml');
});

it('returns a size error when the safe downloader rejects an oversized image', async () => {
  mocks.download.mockRejectedValue(Object.assign(new Error('Too large'), { statusCode: 413 }));
  const res = response();
  await handler({ query: { url: 'https://images.example.com/large.jpg' } } as any, res);
  expect(res.status).toHaveBeenCalledWith(413);
});

it('serves a raster with a verified signature when its upstream type is generic', async () => {
  const jpeg = new Uint8Array([255, 216, 255, 224, 0, 0, 0, 0, 0, 0, 0, 0]);
  mocks.download.mockResolvedValue(Buffer.from(jpeg));
  const res = response();
  await handler({ query: { url: 'https://images.example.com/photo' } } as any, res);
  expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'image/jpeg');
  expect(res.send).toHaveBeenCalledWith(Buffer.from(jpeg));
});
