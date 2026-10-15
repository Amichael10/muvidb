import { beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock('./supabase.js', () => ({ supabase: { rpc: mocks.rpc } }));
import { requireRequestQuota } from './request_quota';
function response() { const res: any = { status: vi.fn(() => res), json: vi.fn(() => res), setHeader: vi.fn() }; return res; }
beforeEach(() => vi.clearAllMocks());
it('requires the per-client and global budget before allowing a paid request', async () => {
  mocks.rpc.mockResolvedValue({ data: true, error: null });
  expect(await requireRequestQuota({ headers: {} } as any, response(), 'search', 'user')).toBe(true);
  expect(mocks.rpc).toHaveBeenCalledTimes(3);
  expect(mocks.rpc).toHaveBeenLastCalledWith('consume_request_quota', expect.objectContaining({ p_subject: 'search:global:day' }));
});
it('denies a request when its shared quota is exhausted', async () => {
  mocks.rpc.mockResolvedValue({ data: false, error: null });
  const res = response();
  expect(await requireRequestQuota({ headers: {} } as any, res, 'search')).toBe(false);
  expect(res.status).toHaveBeenCalledWith(429);
});
it('denies paid requests when quota storage is unavailable', async () => {
  mocks.rpc.mockResolvedValue({ data: null, error: { message: 'Unavailable' } });
  const res = response();
  expect(await requireRequestQuota({ headers: {} } as any, res, 'search')).toBe(false);
  expect(res.status).toHaveBeenCalledWith(503);
});
