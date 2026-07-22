/**
 * Detect scrape-like traffic on SEO person/film pages and Telegram-alert.
 * Durable counters live in scrape_ip_buckets (Supabase) so serverless
 * instances share state.
 */
import { supabase } from './supabase.js';
import { sendTelegramMessage, telegramConfigured } from './telegram.js';

const WINDOW_MS = 5 * 60 * 1000;
const HIT_THRESHOLD = Number(process.env.SCRAPE_ALERT_THRESHOLD || 100);
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
    ip = hops.length ? hops[hops.length - 1] : 'unknown';
  }
  return ip || 'unknown';
}

function windowStart(now = Date.now()) {
  return new Date(Math.floor(now / WINDOW_MS) * WINDOW_MS).toISOString();
}

export type SeoHitKind = 'person' | 'film' | 'sitemap';

/**
 * Fire-and-forget from the SEO handler. Never throw to the request path.
 */
export function trackSeoHit(req: any, kind: SeoHitKind, slug?: string): void {
  void recordAndMaybeAlert(req, kind, slug).catch((err) => {
    console.warn('[scrape_guard]', err?.message || err);
  });
}

async function recordAndMaybeAlert(req: any, kind: SeoHitKind, slug?: string) {
  if (!telegramConfigured()) return;

  const ua = String(readHeader(req?.headers, 'user-agent') || '');
  if (GOOD_BOT_RE.test(ua)) return;

  const ip = clientIp(req);
  if (!ip || ip === 'unknown') return;

  const path = kind === 'sitemap'
    ? `/sitemap-${slug || 'index'}.xml`
    : `/${kind === 'person' ? 'people' : 'films'}/${slug || ''}`;

  const start = windowStart();

  // Read-modify-write is fine at this volume; prefer simple over RPC for now.
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
    `Samples:`,
    ...samplePaths.slice(0, 8).map((p) => `• ${p}`),
  ].join('\n');

  const sent = await sendTelegramMessage(message);
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
