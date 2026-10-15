export const MAX_WHATSAPP_ATTEMPTS = 3;
export const UNCONFIRMED_AFTER_MS = 30 * 60_000;

// Only known temporary Meta failures are retried. Policy/recipient/template
// failures and ambiguous request timeouts require attention instead.
export function whatsappRetryAt(code: number | undefined, attempts: number, now = Date.now()): string | null {
  if (attempts >= MAX_WHATSAPP_ATTEMPTS || ![130429, 131000, 131016, 131056].includes(Number(code))) return null;
  return new Date(now + (attempts === 1 ? 5 : 15) * 60_000).toISOString();
}
