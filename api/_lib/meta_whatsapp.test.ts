import { afterEach, expect, it, vi } from 'vitest';
import sharp from 'sharp';
import { sendMetaWhatsAppTemplate } from './meta_whatsapp';

afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

it('converts a WebP poster to JPEG, uploads it, and sends the media ID', async () => {
  vi.stubEnv('WHATSAPP_PHONE_NUMBER_ID', 'sender');
  vi.stubEnv('WHATSAPP_ACCESS_TOKEN', 'token');
  const webp = await sharp({ create: { width: 20, height: 20, channels: 3, background: '#ffffff' } }).webp().toBuffer();
  const fetchMock = vi.fn()
    .mockResolvedValueOnce(new Response(new Uint8Array(webp)))
    .mockResolvedValueOnce(Response.json({ id: 'uploaded-image' }))
    .mockResolvedValueOnce(Response.json({ messages: [{ id: 'message' }] }));
  vi.stubGlobal('fetch', fetchMock);
  const result = await sendMetaWhatsAppTemplate({ to: '2348000000000', templateName: 'movie_release_alert', headerImageUrl: 'https://example.com/poster.webp' });
  expect(result.ok).toBe(true);
  const upload = fetchMock.mock.calls[1][1].body as FormData;
  const file = upload.get('file') as File;
  expect(file.type).toBe('image/jpeg');
  expect((await sharp(Buffer.from(await file.arrayBuffer())).metadata()).format).toBe('jpeg');
  const payload = JSON.parse(fetchMock.mock.calls[2][1].body);
  expect(payload.template.components[0].parameters[0].image).toEqual({ id: 'uploaded-image' });
});

it('does not send a message when Meta rejects the media upload', async () => {
  vi.stubEnv('WHATSAPP_PHONE_NUMBER_ID', 'sender');
  vi.stubEnv('WHATSAPP_ACCESS_TOKEN', 'token');
  const png = await sharp({ create: { width: 20, height: 20, channels: 3, background: '#ffffff' } }).png().toBuffer();
  const fetchMock = vi.fn().mockResolvedValueOnce(new Response(new Uint8Array(png)))
    .mockResolvedValueOnce(Response.json({ error: { message: 'Unsupported media' } }, { status: 400 }));
  vi.stubGlobal('fetch', fetchMock);
  expect(await sendMetaWhatsAppTemplate({ to: '2348000000000', templateName: 'movie_release_alert', headerImageUrl: 'https://example.com/poster.png' }))
    .toEqual({ ok: false, error: 'WhatsApp poster preparation failed: Unsupported media' });
  expect(fetchMock).toHaveBeenCalledTimes(2);
});
