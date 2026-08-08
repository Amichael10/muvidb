/**
 * Durable IP blocklist + allowlist (Supabase). Short in-memory cache so
 * SSR/API do not hit the DB on every request.
 */
import { supabase } from './supabase.js';

const CACHE_TTL_MS = 30_000;
const blockCache = new Map<string, { blocked: boolean; checkedAt: number }>();
const allowCache = new Map<string, { allowed: boolean; checkedAt: number }>();

function normalizeIp(ip: string): string {
  return String(ip || '').trim().toLowerCase();
}

/** Env allowlist (comma-separated), plus DB allowlisted_ips. */
function envAllowlisted(ip: string): boolean {
  const raw = (process.env.SCRAPE_IP_ALLOWLIST || '').trim();
  if (!raw) return false;
  const key = normalizeIp(ip);
  return raw.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean).includes(key);
}

export function invalidateBlockedIpCache(ip?: string) {
  if (ip) blockCache.delete(normalizeIp(ip));
  else blockCache.clear();
}

export function invalidateAllowlistCache(ip?: string) {
  if (ip) allowCache.delete(normalizeIp(ip));
  else allowCache.clear();
}

export async function isIpAllowlisted(ip: string): Promise<boolean> {
  const key = normalizeIp(ip);
  if (!key || key === 'unknown') return false;
  if (envAllowlisted(key)) return true;

  const hit = allowCache.get(key);
  if (hit && Date.now() - hit.checkedAt < CACHE_TTL_MS) return hit.allowed;

  const { data, error } = await supabase
    .from('allowlisted_ips')
    .select('ip')
    .eq('ip', key)
    .maybeSingle();

  if (error) {
    console.warn('[ip_allowlist] lookup failed:', error.message);
    return false;
  }

  const allowed = Boolean(data?.ip);
  allowCache.set(key, { allowed, checkedAt: Date.now() });
  return allowed;
}

export async function isIpBlocked(ip: string): Promise<boolean> {
  const key = normalizeIp(ip);
  if (!key || key === 'unknown') return false;

  // Allowlist always wins
  if (await isIpAllowlisted(key)) return false;

  const hit = blockCache.get(key);
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

  blockCache.set(key, { blocked, checkedAt: Date.now() });
  return blocked;
}

export async function allowIp(opts: {
  ip: string;
  note?: string;
}): Promise<{ ok: boolean; error?: string }> {
  const ip = normalizeIp(opts.ip);
  if (!ip || ip === 'unknown') return { ok: false, error: 'Invalid IP' };

  const { error } = await supabase.from('allowlisted_ips').upsert({
    ip,
    note: (opts.note || 'Telegram /allow').slice(0, 500),
    created_at: new Date().toISOString(),
  });
  if (error) return { ok: false, error: error.message };

  // If it was blocked, clear the block
  await supabase.from('blocked_ips').delete().eq('ip', ip);
  invalidateAllowlistCache(ip);
  invalidateBlockedIpCache(ip);
  return { ok: true };
}

export async function unallowIp(ip: string): Promise<{ ok: boolean; error?: string }> {
  const key = normalizeIp(ip);
  if (!key) return { ok: false, error: 'Invalid IP' };

  const { error } = await supabase.from('allowlisted_ips').delete().eq('ip', key);
  if (error) return { ok: false, error: error.message };
  invalidateAllowlistCache(key);
  return { ok: true };
}

export async function listAllowlistedIps(limit = 25): Promise<
  Array<{ ip: string; note: string | null; created_at: string }>
> {
  const { data, error } = await supabase
    .from('allowlisted_ips')
    .select('ip, note, created_at')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.warn('[ip_allowlist] list failed:', error.message);
    return [];
  }
  return data || [];
}

export async function blockIp(opts: {
  ip: string;
  reason?: string;
  blockedBy?: string;
  expiresAt?: string | null;
}): Promise<{ ok: boolean; error?: string }> {
  const ip = normalizeIp(opts.ip);
  if (!ip || ip === 'unknown') return { ok: false, error: 'Invalid IP' };

  if (await isIpAllowlisted(ip)) {
    return { ok: false, error: 'IP is allowlisted — /unallow it first' };
  }

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
