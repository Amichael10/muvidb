/**
 * Detect scrape-like traffic and Telegram-alert.
 * Durable counters live in scrape_ip_buckets (Supabase) so serverless
 * instances share state. Blocking is separate (ip_blocklist).
 */
import { supabase } from './supabase.js';
import { sendTelegramMessage, telegramConfigured } from './telegram.js';
import { isIpBlocked } from './ip_blocklist.js';

const WINDOW_MS = 5 * 60 * 1000;
const HIT_THRESHOLD = Number(process.env.SCRAPE_ALERT_THRESHOLD || 50);
const COOLDOWN_MS = Number(process.env.SCRAPE_ALERT_COOLDOWN_MS || 30 * 60 * 1000);

const GOOD_BOT_RE = /googlebot|bingbot|slurp|duckduckbot|baiduspider|yandex|applebot|facebookexternalhit|twitterbot|linkedinbot|semrushbot|ahrefsbot|dotbot|petalbot|bytespider|gptbot|claudebot|anthropic/i;

const readHeader = (headers: any, name: string): string | undefined => {
  const raw = typeof headers?.get === 'function' ? headers.get(name) : headers?.[name];
  return Array.isArray(raw) ? raw[0] : raw;
};

export function clientIp(req: any): string {
  const headers = req?.headers;
  let ip = readHeader(headers, 'x-real-ip')?.trim();
  if (!ip) {
    const forwarded = readHeader(headers, 'x-forwarded-for') ?? '';
    const hops = forwarded.split(',').map((h: string) => h.trim()).filter(Boolean);
    // On Vercel the left-most is typically the client
    ip = hops.length ? hops[0] : 'unknown';
  }
  return ip || 'unknown';
}

function windowStart(now = Date.now()) {
  return new Date(Math.floor(now / WINDOW_MS) * WINDOW_MS).toISOString();
}

export type HitKind = 'person' | 'film' | 'sitemap' | 'page' | 'api';

/**
 * Fire-and-forget from SEO / SSR / API handlers. Never throw to the request path.
 */
export function trackSeoHit(req: any, kind: HitKind, slug?: string): void {
  void recordAndMaybeAlert(req, kind, slug).catch((err) => {
    console.warn('[scrape_guard]', err?.message || err);
  });
}

/** Track an arbitrary path (SSR page or API). */
export function trackPageHit(req: any, path: string, kind: HitKind = 'page'): void {
  void recordAndMaybeAlert(req, kind, undefined, path).catch((err) => {
    console.warn('[scrape_guard]', err?.message || err);
  });
}

export async function rejectIfBlocked(req: any): Promise<boolean> {
  try {
    const ip = clientIp(req);
    return await isIpBlocked(ip);
  } catch {
    return false;
  }
}

async function recordAndMaybeAlert(
  req: any,
  kind: HitKind,
  slug?: string,
  explicitPath?: string,
) {
  if (!telegramConfigured()) return;

  const ua = String(readHeader(req?.headers, 'user-agent') || '');
  if (GOOD_BOT_RE.test(ua)) return;

  const ip = clientIp(req);
  if (!ip || ip === 'unknown') return;

  // Already blocked — no need to keep alerting
  if (await isIpBlocked(ip)) return;

  const path = explicitPath
    || (kind === 'sitemap'
      ? `/sitemap-${slug || 'index'}.xml`
      : kind === 'api'
        ? `/api/${slug || 'data'}`
        : `/${kind === 'person' ? 'people' : kind === 'film' ? 'films' : 'page'}/${slug || ''}`);

  const start = windowStart();

  const { data: existing } = await supabase
    .from('scrape_ip_buckets')
    .select('hits, sample_paths')
    .eq('ip', ip)
    .eq('window_start', start)
    .maybeSingle();

  const prevHits = Number(existing?.hits || 0);
  const prevPaths: string[] = Array.isArray(existing?.sample_paths) ? existing.sample_paths : [];
  const samplePaths = prevPaths.includes(path)
    ? prevPaths.slice(0, 12)
    : [...prevPaths, path].slice(-12);
  const hits = prevHits + 1;

  const { error: upsertErr } = await supabase.from('scrape_ip_buckets').upsert(
    {
      ip,
      window_start: start,
      hits,
      sample_paths: samplePaths,
      user_agent: ua.slice(0, 240) || null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'ip,window_start' },
  );
  if (upsertErr) throw upsertErr;

  if (hits < HIT_THRESHOLD) return;

  const { data: cool } = await supabase
    .from('scrape_alert_log')
    .select('last_alert_at')
    .eq('ip', ip)
    .maybeSingle();

  const last = cool?.last_alert_at ? new Date(cool.last_alert_at).getTime() : 0;
  if (Date.now() - last < COOLDOWN_MS) return;

  // Only fire when first crossing the threshold in this window
  if (prevHits >= HIT_THRESHOLD) return;

  const message = [
    '🚨 MuviDB scrape alert',
    `IP: ${ip}`,
    `Hits: ${hits} in ~5 min (threshold ${HIT_THRESHOLD})`,
    `Kind: ${kind}`,
    `UA: ${ua.slice(0, 120) || '(empty)'}`,
    'Samples:',
    ...samplePaths.slice(0, 8).map((p) => `• ${p}`),
    '',
    `Block: /block ${ip}`,
  ].join('\n');

  const sent = await sendTelegramMessage({
    text: message,
    replyMarkup: {
      inline_keyboard: [
        [
          { text: '🚫 Block IP', callback_data: `block:${ip}` },
          { text: 'Ignore 30m', callback_data: `ignore:${ip}` },
        ],
      ],
    },
  });
  if (!sent.ok) {
    console.warn('[scrape_guard] telegram failed:', sent.error);
    return;
  }

  await supabase.from('scrape_alert_log').upsert({
    ip,
    last_alert_at: new Date().toISOString(),
    last_hits: hits,
    last_message: message.slice(0, 500),
  });
}

export async function recentHitsForIp(ip: string, limit = 5) {
  const key = String(ip || '').trim().toLowerCase();
  const { data } = await supabase
    .from('scrape_ip_buckets')
    .select('ip, window_start, hits, sample_paths, user_agent')
    .eq('ip', key)
    .order('window_start', { ascending: false })
    .limit(limit);
  return data || [];
}

export async function topHitters(limit = 10) {
  const since = new Date(Date.now() - WINDOW_MS * 3).toISOString();
  const { data } = await supabase
    .from('scrape_ip_buckets')
    .select('ip, window_start, hits, sample_paths, user_agent')
    .gte('window_start', since)
    .order('hits', { ascending: false })
    .limit(limit);
  return data || [];
}

export { HIT_THRESHOLD };
