import { beforeEach, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({ tables: {} as Record<string, any[]> }));
vi.mock('../supabase.js', () => ({ supabase: { from: (table: string) => {
  const filters: Array<[string, unknown]> = [];
  const query: any = {
    select: () => query,
    eq: (key: string, value: unknown) => { filters.push([key, value]); return query; },
    maybeSingle: async () => ({ data: (state.tables[table] || []).find(row => filters.every(([key, value]) => row[key] === value)) || null, error: null }),
    single: async () => query.maybeSingle(),
  };
  return query;
} } }));
vi.mock('../threads_oauth.js', () => ({ getPlatformPublishingCredentials: vi.fn(async (_platform, id) => ({ connection: { id: id || 'legacy' } })) }));
import { resolveDestinationConnection } from './destination-routing.js';
import { getPlatformPublishingCredentials } from '../threads_oauth.js';

beforeEach(() => {
  vi.clearAllMocks();
  state.tables = {
    social_connections: [{ id: 'main-instagram', platform: 'instagram', status: 'connected', username: 'muvidb_' }],
    content_destinations: [{ id: 'main', slug: 'main-muvidb' }],
    content_destination_platforms: [
      { destination_id: 'main', platform: 'facebook', enabled: true, social_connection_id: 'existing-facebook' },
      { destination_id: 'main', platform: 'tiktok', enabled: true, social_connection_id: 'existing-tiktok' },
      { destination_id: 'people', platform: 'instagram', enabled: true, social_connection_id: 'main-instagram' },
    ],
  };
});
it('never sends a Streaming Alert to main Instagram if the second account is missing', async () => {
  await expect(resolveDestinationConnection('streaming', 'instagram', 'where_to_watch')).rejects.toThrow('Connect @muvi_database');
  expect(getPlatformPublishingCredentials).not.toHaveBeenCalled();
});
it('selects the requested second Instagram account', async () => {
  state.tables.social_connections.push({ id: 'second-instagram', platform: 'instagram', status: 'connected', username: 'muvi_database' });
  await expect(resolveDestinationConnection('streaming', 'instagram', 'where_to_watch')).resolves.toBe('second-instagram');
});
it('preserves existing Facebook and TikTok mappings for Streaming Alerts', async () => {
  await expect(resolveDestinationConnection('streaming', 'facebook', 'where_to_watch')).resolves.toBe('existing-facebook');
  await expect(resolveDestinationConnection('streaming', 'tiktok', 'where_to_watch')).resolves.toBe('existing-tiktok');
});
it('honors the normal destination for other post types', async () => {
  await expect(resolveDestinationConnection('people', 'instagram', 'actor_spotlight')).resolves.toBe('main-instagram');
  expect(getPlatformPublishingCredentials).toHaveBeenCalledWith('instagram', 'main-instagram');
});
it('fails closed for an unmapped destination', async () => {
  await expect(resolveDestinationConnection('unknown', 'facebook')).rejects.toThrow('Choose a facebook account');
});
