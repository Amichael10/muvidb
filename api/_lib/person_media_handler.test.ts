import { beforeEach, expect, it, vi } from 'vitest';
const m = vi.hoisted(() => ({ from: vi.fn(), getUser: vi.fn(), quota: vi.fn(), create: vi.fn(), resolve: vi.fn(), preview: vi.fn(), discard: vi.fn(), insert: vi.fn(), update: vi.fn(), remove: vi.fn(), profileRole: 'fan', existing: null as any }));
vi.mock('./supabase.js', () => ({ supabase: { from: m.from, auth: { getUser: m.getUser } } }));
vi.mock('./cors.js', () => ({ handleCors: () => false }));
vi.mock('./request_quota.js', () => ({ requireRequestQuota: m.quota }));
vi.mock('./person_media_uploads.js', () => ({ createPendingMediaUpload: m.create, resolveMediaSubmissionUrl: m.resolve,
  privateMediaPreview: m.preview, discardPendingMedia: m.discard,
  mediaError: (message: string, statusCode = 400) => Object.assign(new Error(message), { statusCode }) }));
import { handlePersonMedia } from './person_media_handler';

const person = '11111111-1111-4111-8111-111111111111';
const media = '22222222-2222-4222-8222-222222222222';
function response() { const res: any = { status: vi.fn(() => res), json: vi.fn(() => res), setHeader: vi.fn() }; return res; }
function request(body: any = {}, method = 'POST'): any { return { method, headers: { authorization: 'Bearer session' }, query: {}, body }; }
beforeEach(() => {
  vi.clearAllMocks(); m.profileRole = 'fan'; m.existing = null;
  m.quota.mockResolvedValue(true); m.resolve.mockImplementation(async value => value); m.preview.mockImplementation(async value => value);
  m.getUser.mockResolvedValue({ data: { user: { id: 'real-user', user_metadata: { role: 'admin' } } }, error: null });
  m.from.mockImplementation(table => {
    let written: any = null;
    const chain: any = { then: (resolve: any) => Promise.resolve({ data: [], error: null }).then(resolve) };
    for (const name of ['select', 'eq', 'in', 'neq', 'order', 'limit']) chain[name] = vi.fn(() => chain);
    chain.maybeSingle = vi.fn(async () => ({ data: table === 'users' ? { role: m.profileRole } : m.existing, error: null }));
    chain.insert = vi.fn(fields => { written = fields; m.insert(fields); return chain; });
    chain.update = vi.fn(fields => { written = fields; m.update(fields); return chain; });
    chain.delete = vi.fn(() => { m.remove(); return chain; });
    chain.single = vi.fn(async () => ({ data: { ...written, id: media }, error: null }));
    return chain;
  });
});

it('rejects anonymous deletion before accessing service-role records', async () => {
  const res = response();
  await handlePersonMedia({ method: 'DELETE', headers: {}, query: { id: media } } as any, res);
  expect(res.status).toHaveBeenCalledWith(401);
  expect(m.from).not.toHaveBeenCalled();
});
it('forces a signed-in submission to pending and binds its uploader despite forged admin fields', async () => {
  const res = response();
  await handlePersonMedia(request({ person_id: person, media_type: 'photo', category: 'headshot', title: 'Portrait',
    url: 'https://images.example.com/portrait.jpg', status: 'approved', uploaded_by: 'victim', is_primary: true,
    created_at: 'forged', arbitrary_admin_field: true }), res);
  expect(res.status).toHaveBeenCalledWith(200);
  expect(m.insert).toHaveBeenCalledWith(expect.objectContaining({ status: 'pending', uploaded_by: 'real-user' }));
  expect(m.insert.mock.calls[0][0]).not.toHaveProperty('arbitrary_admin_field');
  expect(m.insert.mock.calls[0][0]).not.toHaveProperty('created_at');
  expect(m.update).not.toHaveBeenCalled();
  expect(m.resolve).toHaveBeenCalledWith(expect.any(String), 'real-user', person, false, false, 'photo');
});
it('rejects edits to already approved media even from its uploader', async () => {
  m.existing = { id: media, person_id: person, uploaded_by: 'real-user', status: 'approved' };
  const res = response();
  await handlePersonMedia(request({ id: media, person_id: person, title: 'Changed' }, 'PUT'), res);
  expect(res.status).toHaveBeenCalledWith(403);
  expect(m.update).not.toHaveBeenCalled();
});
it('does not issue upload capabilities to anonymous callers', async () => {
  const res = response();
  await handlePersonMedia({ method: 'POST', headers: {}, query: { action: 'presign' }, body: { personId: person } } as any, res);
  expect(res.status).toHaveBeenCalledWith(401);
  expect(m.create).not.toHaveBeenCalled();
});
it('allows administrator approval while preserving the original uploader', async () => {
  m.profileRole = 'admin';
  m.existing = { id: media, person_id: person, uploaded_by: 'original-user', status: 'pending', media_type: 'photo', category: 'headshot', title: 'Portrait', url: 'pending-media:upload-id' };
  const res = response();
  await handlePersonMedia(request({ id: media, person_id: person, status: 'approved', uploaded_by: 'forged-user' }, 'PUT'), res);
  expect(res.status).toHaveBeenCalledWith(200);
  expect(m.resolve).toHaveBeenCalledWith('pending-media:upload-id', 'real-user', person, true, true, 'photo');
  expect(m.update).toHaveBeenCalledWith(expect.objectContaining({ status: 'approved', uploaded_by: 'original-user' }));
});
it('does not expose the pending review queue to an ordinary user', async () => {
  const req = request({}, 'GET'); req.query.status = 'pending';
  const res = response();
  await handlePersonMedia(req, res);
  expect(res.status).toHaveBeenCalledWith(403);
  expect(m.preview).not.toHaveBeenCalled();
});
