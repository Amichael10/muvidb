// In-memory store — resets on cold starts, first layer of defense only.
const requests = new Map<string, { count: number; resetAt: number }>();

const WINDOW_MS = 60_000;
const MAX_REQUESTS = 60;

const readHeader = (headers: any, name: string): string | undefined => {
  const raw = typeof headers.get === 'function' ? headers.get(name) : headers[name];
  return Array.isArray(raw) ? raw[0] : raw;
};

export function checkRateLimit(req: any): boolean {
  try {
    const headers = req.headers;
    if (!headers) return false;

    // Resolve the client IP from a trusted source. A caller can put arbitrary
    // values in x-forwarded-for, and Vercel APPENDS the real client IP as the
    // last hop — so the spoofable leftmost value must not be used as the key.
    // Prefer x-real-ip (set by Vercel to the immediate client), then fall back
    // to the LAST entry of x-forwarded-for.
    let ip = readHeader(headers, 'x-real-ip')?.trim();
    if (!ip) {
      const forwarded = readHeader(headers, 'x-forwarded-for') ?? '';
      const hops = forwarded.split(',').map((h) => h.trim()).filter(Boolean);
      ip = hops.length ? hops[hops.length - 1] : 'unknown';
    }

    const now = Date.now();
    const entry = requests.get(ip);

    if (!entry || now >= entry.resetAt) {
      requests.set(ip, { count: 1, resetAt: now + WINDOW_MS });
      return false;
    }

    entry.count += 1;
    return entry.count > MAX_REQUESTS;
  } catch (err) {
    console.error('Rate limit check error:', err);
    return false; // Fail open - better to allow some requests than to crash the site
  }
}
