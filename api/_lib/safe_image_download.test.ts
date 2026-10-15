import { EventEmitter } from 'node:events';
import { Readable } from 'node:stream';
import { beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ lookup: vi.fn(), get: vi.fn(), responses: [] as any[] }));
vi.mock('node:dns/promises', () => ({ lookup: mocks.lookup }));
vi.mock('node:http', () => ({ default: { get: mocks.get } }));
vi.mock('node:https', () => ({ default: { get: mocks.get } }));
import { downloadPublicImage, isPublicImageAddress, resolveImageTarget } from './safe_image_download';

beforeEach(() => {
  vi.clearAllMocks(); mocks.responses.length = 0;
  mocks.lookup.mockResolvedValue([{ address: '8.8.8.8', family: 4 }]);
  mocks.get.mockImplementation((_url, _options, callback) => {
    const req: any = new EventEmitter();
    req.destroy = (error: any) => { if (error) req.emit('error', error); req.emit('close'); };
    queueMicrotask(() => {
      const spec = mocks.responses.shift() || {};
      const res: any = Readable.from(spec.chunks || []);
      res.statusCode = spec.status || 200;
      res.headers = spec.headers || {};
      res.on('close', () => req.emit('close'));
      callback(res);
    });
    return req;
  });
});

it.each(['127.0.0.1', '10.1.1.1', '169.254.169.254', '100.64.1.1', '192.168.1.1', '::1', '::ffff:127.0.0.1', '::ffff:7f00:1', 'fc00::1', 'fe80::1', '64:ff9b::7f00:1', '2001:db8::1'])('blocks non-public address %s', address => {
  expect(isPublicImageAddress(address)).toBe(false);
});
it.each(['8.8.8.8', '1.1.1.1', '2606:4700:4700::1111'])('permits public address %s', address => {
  expect(isPublicImageAddress(address)).toBe(true);
});
it('rejects names that resolve to private addresses before connecting', async () => {
  mocks.lookup.mockResolvedValue([{ address: '127.0.0.1', family: 4 }]);
  await expect(downloadPublicImage(new URL('https://images.example.com/photo'), {})).rejects.toMatchObject({ statusCode: 403 });
  expect(mocks.get).not.toHaveBeenCalled();
});
it('pins the validated address instead of resolving the name again at connection time', async () => {
  mocks.responses.push({ chunks: [Buffer.from('image')] });
  await downloadPublicImage(new URL('https://images.example.com/photo'), {});
  const options = mocks.get.mock.calls[0][1];
  const connected = vi.fn();
  options.lookup('images.example.com', {}, connected);
  expect(connected).toHaveBeenCalledWith(null, '8.8.8.8', 4);
  expect(mocks.lookup).toHaveBeenCalledTimes(1);
});
it('rejects a redirect to cloud metadata before making the second connection', async () => {
  mocks.responses.push({ status: 302, headers: { location: 'http://169.254.169.254/latest/meta-data/' } });
  await expect(downloadPublicImage(new URL('https://images.example.com/photo'), {})).rejects.toMatchObject({ statusCode: 403 });
  expect(mocks.get).toHaveBeenCalledTimes(1);
});
it('bounds streamed bytes even when the server omits Content-Length', async () => {
  mocks.responses.push({ chunks: [Buffer.alloc(7), Buffer.alloc(7)] });
  await expect(downloadPublicImage(new URL('https://images.example.com/photo'), {}, 10)).rejects.toMatchObject({ statusCode: 413 });
});
it('rejects credentials embedded in an image URL', async () => {
  await expect(resolveImageTarget(new URL('https://user:password@images.example.com/photo'))).rejects.toMatchObject({ statusCode: 400 });
});
