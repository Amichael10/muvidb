// In-memory store — resets on cold starts, first layer of defense only.
const requests = new Map<string, { count: number; resetAt: number }>();

const WINDOW_MS = 60_000;
const MAX_REQUESTS = 60;

export function checkRateLimit(req: Request): boolean {
  const ip =
    (req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() || 'unknown';

  const now = Date.now();
  const entry = requests.get(ip);

  if (!entry || now >= entry.resetAt) {
    requests.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return false;
  }

  entry.count += 1;
  return entry.count > MAX_REQUESTS;
}
