import { beforeEach, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ from: vi.fn(), rpc: vi.fn(), maybeSingle: vi.fn() }));
vi.mock('./supabase.js', () => ({ supabase: { from: mocks.from, rpc: mocks.rpc } }));
import { requireApiKey } from './api_key_guard';

const record = { id: 'key-id', scopes: ['films:read'], is_active: true, rate_limit_per_min: 60 };
function response() {
  const res: any = { status: vi.fn(() => res), json: vi.fn(() => res), setHeader: vi.fn() };
  return res;
}
const request: any = { headers: { 'x-api-key': 'test-api-key' }, query: {} };

beforeEach(() => {
  vi.clearAllMocks();
  mocks.from.mockReturnValue({ select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), maybeSingle: mocks.maybeSingle });
  mocks.maybeSingle.mockResolvedValue({ data: record, error: null });
});

it('rejects exhausted quota before returning an authenticated key', async () => {
  mocks.rpc.mockResolvedValue({ data: false, error: null });
  const res = response();
  expect(await requireApiKey(request, res, 'films:read')).toBeNull();
  expect(res.status).toHaveBeenCalledWith(429);
  expect(res.setHeader).toHaveBeenCalledWith('Retry-After', '60');
});

it('fails closed when the distributed quota service is unavailable', async () => {
  mocks.rpc.mockResolvedValue({ data: null, error: { message: 'Unavailable' } });
  const res = response();
  expect(await requireApiKey(request, res, 'films:read')).toBeNull();
  expect(res.status).toHaveBeenCalledWith(503);
});

it('accepts an authorized key only after consuming its shared quota', async () => {
  mocks.rpc.mockResolvedValue({ data: true, error: null });
  expect(await requireApiKey(request, response(), 'films:read')).toEqual(record);
  expect(mocks.rpc).toHaveBeenCalledWith('consume_api_key_quota', { p_key_id: record.id });
});

it('does not consume quota when the key lacks the requested scope', async () => {
  const res = response();
  expect(await requireApiKey(request, res, 'people:write')).toBeNull();
  expect(res.status).toHaveBeenCalledWith(403);
  expect(mocks.rpc).not.toHaveBeenCalled();
});
