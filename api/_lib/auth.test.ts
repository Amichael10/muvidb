import { beforeEach, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ getUser: vi.fn(), single: vi.fn(), from: vi.fn() }));
vi.mock('./supabase.js', () => ({ supabase: { auth: { getUser: mocks.getUser }, from: mocks.from } }));
import { isValidAuth } from './auth';

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getUser.mockResolvedValue({ data: { user: { id: 'user', user_metadata: { role: 'admin' } } }, error: null });
  const query = { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), single: mocks.single };
  mocks.from.mockReturnValue(query);
});

it('rejects a missing profile despite an admin role in editable user metadata', async () => {
  mocks.single.mockResolvedValue({ data: null, error: null });
  expect((await isValidAuth({ headers: { authorization: 'Bearer user-session' } } as any)).valid).toBe(false);
});

it('rejects an unavailable profile database despite editable admin metadata', async () => {
  mocks.single.mockRejectedValue(new Error('Database unavailable'));
  expect((await isValidAuth({ headers: { authorization: 'Bearer user-session' } } as any)).valid).toBe(false);
});

it.each(['fan', 'professional'])('rejects a verified %s profile', async (role) => {
  mocks.single.mockResolvedValue({ data: { role }, error: null });
  expect((await isValidAuth({ headers: { authorization: 'Bearer user-session' } } as any)).valid).toBe(false);
});

it.each(['admin', 'admin_limited'])('accepts a verified %s profile', async (role) => {
  mocks.single.mockResolvedValue({ data: { role }, error: null });
  expect((await isValidAuth({ headers: { authorization: 'Bearer user-session' } } as any)).valid).toBe(true);
});
