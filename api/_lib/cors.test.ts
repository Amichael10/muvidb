import { afterEach, expect, it, vi } from 'vitest';
import { getCorsHeaders } from './cors';
afterEach(() => vi.unstubAllEnvs());
it('does not grant CORS access to another Vercel project', () => {
  vi.stubEnv('NODE_ENV', 'production');
  expect(getCorsHeaders({ headers: { origin: 'https://attacker.vercel.app' } } as any)['Access-Control-Allow-Origin']).not.toBe('https://attacker.vercel.app');
});
it('allows the preview origin explicitly supplied by this deployment', () => {
  vi.stubEnv('VERCEL_URL', 'muvidb-verified-preview.vercel.app');
  expect(getCorsHeaders({ headers: { origin: 'https://muvidb-verified-preview.vercel.app' } } as any)['Access-Control-Allow-Origin']).toBe('https://muvidb-verified-preview.vercel.app');
});
