import { afterEach, expect, it, vi } from 'vitest';
vi.mock('./_lib/health.js', () => ({ handleHealth: vi.fn() }));
vi.mock('./_lib/mirror_images_admin.js', () => ({ handleMirrorImages: vi.fn() }));
import handler from './media';

function response() {
  const res: any = { status: vi.fn(() => res), send: vi.fn(() => res), setHeader: vi.fn() };
  return res;
}
afterEach(() => vi.unstubAllGlobals());

it('rejects active SVG content despite an image content type', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('<svg xmlns="http://www.w3.org/2000/svg"><script/></svg>', { headers: { 'content-type': 'image/svg+xml' } })));
  const res = response();
  await handler({ query: { url: 'https://images.example.com/file.svg' } } as any, res);
  expect(res.status).toHaveBeenCalledWith(415);
  expect(res.setHeader).not.toHaveBeenCalledWith('Content-Type', 'image/svg+xml');
});

it('rejects oversized responses from the declared size before reading them', async () => {
  const upstream = new Response('not read', { headers: { 'content-length': String(16 * 1024 * 1024) } });
  const cancel = vi.spyOn(upstream.body!, 'cancel');
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(upstream));
  const res = response();
  await handler({ query: { url: 'https://images.example.com/large.jpg' } } as any, res);
  expect(res.status).toHaveBeenCalledWith(413);
  expect(cancel).toHaveBeenCalled();
});

it('serves a raster with a verified signature when its upstream type is generic', async () => {
  const jpeg = new Uint8Array([255, 216, 255, 224, 0, 0, 0, 0, 0, 0, 0, 0]);
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(jpeg, { headers: { 'content-type': 'application/octet-stream' } })));
  const res = response();
  await handler({ query: { url: 'https://images.example.com/photo' } } as any, res);
  expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'image/jpeg');
  expect(res.send).toHaveBeenCalledWith(Buffer.from(jpeg));
});
