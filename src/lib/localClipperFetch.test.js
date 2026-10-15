import { afterEach, beforeEach, expect, it, vi } from 'vitest';
beforeEach(() => {
  vi.resetModules();
  vi.stubGlobal('window', { location: { origin: 'https://muvidb.com' } });
});
afterEach(() => vi.unstubAllGlobals());

it('pairs with the clipper before submitting a render job', async () => {
  const fetchMock = vi.fn().mockResolvedValueOnce(Response.json({ pairing_token: 'local-pair' }))
    .mockResolvedValueOnce(Response.json({ job_id: 'job' }));
  vi.stubGlobal('fetch', fetchMock);
  const { fetchWithLocalClipperAuth } = await import('./localClipperFetch');
  await fetchWithLocalClipperAuth('http://127.0.0.1:4317/clip', { method: 'POST', headers: { 'Content-Type': 'application/json' } });
  expect(fetchMock.mock.calls[1][1].headers.get('X-Muvidb-Clipper-Token')).toBe('local-pair');
});

it('never forwards a pairing token to an API or storage host', async () => {
  const fetchMock = vi.fn().mockResolvedValue(Response.json({ ok: true }));
  vi.stubGlobal('fetch', fetchMock);
  const { fetchWithLocalClipperAuth } = await import('./localClipperFetch');
  await fetchWithLocalClipperAuth('https://storage.example.com/upload', { method: 'PUT', headers: { 'Content-Type': 'video/mp4' } });
  expect(fetchMock).toHaveBeenCalledTimes(1);
  expect(fetchMock.mock.calls[0][1].headers).toEqual({ 'Content-Type': 'video/mp4' });
});

it('refreshes pairing after the desktop service restarts', async () => {
  const fetchMock = vi.fn().mockResolvedValueOnce(Response.json({ pairing_token: 'old-pair' }))
    .mockResolvedValueOnce(new Response('', { status: 401 }))
    .mockResolvedValueOnce(Response.json({ pairing_token: 'new-pair' }))
    .mockResolvedValueOnce(Response.json({ success: true }));
  vi.stubGlobal('fetch', fetchMock);
  const { fetchWithLocalClipperAuth } = await import('./localClipperFetch');
  await fetchWithLocalClipperAuth('http://127.0.0.1:4317/clip', { method: 'POST' });
  expect(fetchMock.mock.calls[3][1].headers.get('X-Muvidb-Clipper-Token')).toBe('new-pair');
});
