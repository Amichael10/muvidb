export const MAX_WHATSAPP_ATTEMPTS = 3;
export const UNCONFIRMED_AFTER_MS = 30 * 60_000;
// Meta error 131049 is a recipient-level marketing frequency limit, not a
// transient outage. Space retries far enough apart to avoid repeatedly
// hitting the same limit. This can be tuned without a deploy.
export const MARKETING_COOLDOWN_MS = Number(process.env.WHATSAPP_MARKETING_COOLDOWN_HOURS || 72) * 60 * 60_000;

// Only known temporary Meta failures are retried. Policy/recipient/template
// failures and ambiguous request timeouts require attention instead.
export function whatsappRetryAt(code: number | undefined, attempts: number, now = Date.now()): string | null {
  if (attempts >= MAX_WHATSAPP_ATTEMPTS) return null;
  if (Number(code) === 131049) return new Date(now + MARKETING_COOLDOWN_MS).toISOString();
  if (![130429, 131000, 131016, 131056].includes(Number(code))) return null;
  return new Date(now + (attempts === 1 ? 5 : 15) * 60_000).toISOString();
}
