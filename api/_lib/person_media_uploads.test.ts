import { beforeEach, expect, it, vi } from 'vitest';
import sharp from 'sharp';
const m = vi.hoisted(() => ({ from: vi.fn(), storage: vi.fn(), publish: vi.fn(), download: vi.fn(), remove: vi.fn(), signedUpload: vi.fn(), signedPreview: vi.fn(), upload: null as any }));
vi.mock('./supabase.js', () => ({ supabase: { from: m.from, storage: { from: m.storage } } }));
vi.mock('./r2.js', () => ({ uploadToR2: m.publish }));
import { createPendingMediaUpload, resolveMediaSubmissionUrl } from './person_media_uploads';
const person = '11111111-1111-4111-8111-111111111111';
const id = '22222222-2222-4222-8222-222222222222';
beforeEach(() => {
  vi.clearAllMocks();
  m.upload = { id, uploaded_by: 'owner', person_id: person, mime_type: 'image/jpeg', storage_path: `owner/${id}.jpg` };
  m.from.mockImplementation(() => {
    const q: any = { then: (resolve: any) => Promise.resolve({ data: null, count: 0, error: null }).then(resolve) };
    for (const name of ['select', 'eq', 'is', 'insert', 'update']) q[name] = vi.fn(() => q);
    q.maybeSingle = vi.fn(async () => ({ data: m.upload, error: null })); return q;
  });
  m.signedUpload.mockResolvedValue({ data: { signedUrl: 'https://private.example/upload?token=fixture' }, error: null });
  m.storage.mockReturnValue({ createSignedUploadUrl: m.signedUpload, createSignedUrl: m.signedPreview, download: m.download, remove: m.remove });
  m.publish.mockResolvedValue({ url: 'https://cdn.example.com/approved.jpg' });
});
it('creates a private, non-overwriting upload capability without publishing the file', async () => {
  const result = await createPendingMediaUpload('owner', person, 'image/jpeg', 100);
  expect(m.storage).toHaveBeenCalledWith('person-media-pending');
  expect(m.signedUpload).toHaveBeenCalledWith(expect.any(String), { upsert: false });
  expect(result.publicUrl).toMatch(/^pending-media:/);
  expect(m.signedPreview).not.toHaveBeenCalled();
  expect(m.publish).not.toHaveBeenCalled();
});
it('rejects active document uploads before creating storage capabilities', async () => {
  await expect(createPendingMediaUpload('owner', person, 'text/html', 100)).rejects.toMatchObject({ statusCode: 400 });
  expect(m.signedUpload).not.toHaveBeenCalled();
});
it('does not let another user attach a private upload', async () => {
  await expect(resolveMediaSubmissionUrl(`pending-media:${id}`, 'attacker', person, false, false, 'photo')).rejects.toMatchObject({ statusCode: 403 });
  expect(m.publish).not.toHaveBeenCalled();
});
it('stores the internal reference while an owner submission awaits approval', async () => {
  expect(await resolveMediaSubmissionUrl(`pending-media:${id}`, 'owner', person, false, false, 'photo')).toBe(`pending-media:${id}`);
  expect(m.publish).not.toHaveBeenCalled();
});
it('requires administrator authority to publish a quarantined file', async () => {
  await expect(resolveMediaSubmissionUrl(`pending-media:${id}`, 'owner', person, false, true, 'photo')).rejects.toMatchObject({ statusCode: 403 });
  expect(m.publish).not.toHaveBeenCalled();
});

it('validates and re-encodes an image before publishing an administrator-approved upload', async () => {
  const original = await sharp({ create: { width: 2, height: 2, channels: 3, background: '#ff0000' } }).png().toBuffer();
  m.upload.mime_type = 'image/png'; m.upload.byte_size = original.length;
  m.download.mockResolvedValue({ data: new Blob([new Uint8Array(original)]), error: null });
  const url = await resolveMediaSubmissionUrl(`pending-media:${id}`, 'administrator', person, true, true, 'photo');
  expect(url).toBe('https://cdn.example.com/approved.jpg');
  expect(m.publish).toHaveBeenCalledWith(expect.stringMatching(/^media\/approved\//), expect.any(Buffer), 'image/jpeg');
  expect((await sharp(m.publish.mock.calls[0][1]).metadata()).format).toBe('jpeg');
  expect(m.remove).toHaveBeenCalledWith([m.upload.storage_path]);
});

it('rejects disguised HTML before an administrator can publish it as an image', async () => {
  const bytes = Buffer.from('<html><script>fixture</script></html>');
  m.upload.byte_size = bytes.length;
  m.download.mockResolvedValue({ data: new Blob([new Uint8Array(bytes)]), error: null });
  await expect(resolveMediaSubmissionUrl(`pending-media:${id}`, 'administrator', person, true, true, 'photo')).rejects.toMatchObject({ statusCode: 400 });
  expect(m.publish).not.toHaveBeenCalled();
});
