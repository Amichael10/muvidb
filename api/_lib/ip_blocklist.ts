/**
 * Durable IP blocklist (Supabase). Short in-memory cache so SSR/API
 * do not hit the DB on every request.
 */
import { supabase } from './supabase.js';

const CACHE_TTL_MS = 30_000;
const cache = new Map<string, { blocked: boolean; checkedAt: number }>();

function normalizeIp(ip: string): string {
  return String(ip || '').trim().toLowerCase();
}

export function invalidateBlockedIpCache(ip?: string) {
  if (ip) cache.delete(normalizeIp(ip));
  else cache.clear();
}

export async function isIpBlocked(ip: string): Promise<boolean> {
  const key = normalizeIp(ip);
  if (!key || key === 'unknown') return false;

  const hit = cache.get(key);
  if (hit && Date.now() - hit.checkedAt < CACHE_TTL_MS) return hit.blocked;

  const nowIso = new Date().toISOString();
  const { data, error } = await supabase
    .from('blocked_ips')
    .select('ip, expires_at')
    .eq('ip', key)
    .maybeSingle();

  if (error) {
    console.warn('[ip_blocklist] lookup failed:', error.message);
    return false;
  }

  let blocked = false;
  if (data?.ip) {
    if (data.expires_at && data.expires_at < nowIso) {
      await supabase.from('blocked_ips').delete().eq('ip', key);
      blocked = false;
    } else {
      blocked = true;
    }
  }

  cache.set(key, { blocked, checkedAt: Date.now() });
  return blocked;
}

export async function blockIp(opts: {
  ip: string;
  reason?: string;
  blockedBy?: string;
  expiresAt?: string | null;
}): Promise<{ ok: boolean; error?: string }> {
  const ip = normalizeIp(opts.ip);
  if (!ip || ip === 'unknown') return { ok: false, error: 'Invalid IP' };

  const { error } = await supabase.from('blocked_ips').upsert({
    ip,
    reason: (opts.reason || 'Manual block').slice(0, 500),
    blocked_by: opts.blockedBy || 'telegram',
    created_at: new Date().toISOString(),
    expires_at: opts.expiresAt ?? null,
  });

  if (error) return { ok: false, error: error.message };
  invalidateBlockedIpCache(ip);
  return { ok: true };
}

export async function unblockIp(ip: string): Promise<{ ok: boolean; error?: string }> {
  const key = normalizeIp(ip);
  if (!key) return { ok: false, error: 'Invalid IP' };

  const { error } = await supabase.from('blocked_ips').delete().eq('ip', key);
  if (error) return { ok: false, error: error.message };
  invalidateBlockedIpCache(key);
  return { ok: true };
}

export async function listBlockedIps(limit = 20): Promise<
  Array<{ ip: string; reason: string | null; created_at: string; expires_at: string | null }>
> {
  const { data, error } = await supabase
    .from('blocked_ips')
    .select('ip, reason, created_at, expires_at')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.warn('[ip_blocklist] list failed:', error.message);
    return [];
  }
  return data || [];
}
