export const MAX_WHATSAPP_ATTEMPTS = 3;
export const UNCONFIRMED_AFTER_MS = 30 * 60_000;

// A release alert is only news for about a day. Past this window the alert is
// abandoned instead of delivered stale, however many attempts are left.
const configuredStaleHours = Number(process.env.WHATSAPP_ALERT_STALE_AFTER_HOURS);
export const ALERT_STALE_AFTER_MS =
  (Number.isFinite(configuredStaleHours) && configuredStaleHours > 0 ? configuredStaleHours : 24) * 60 * 60_000;

// Meta error 131049 is a recipient-level marketing frequency cap enforced on
// Meta's side from that user's own marketing volume and engagement. Nothing we
// do resets their counter, so an immediate retry just re-hits the cap -- but a
// multi-day wait only guarantees stale news. Back off in hours and give up.
const MARKETING_LIMIT_BACKOFF_MS = [6 * 60 * 60_000, 12 * 60 * 60_000];

// Only known temporary Meta failures are retried. Policy/recipient/template
// failures and ambiguous request timeouts require attention instead.
export function whatsappRetryAt(
  code: number | undefined,
  attempts: number,
  now = Date.now(),
  firstAttemptAt?: string | null,
): string | null {
  if (attempts >= MAX_WHATSAPP_ATTEMPTS) return null;

  let delay: number;
  if (Number(code) === 131049) {
    delay = MARKETING_LIMIT_BACKOFF_MS[attempts - 1] ?? MARKETING_LIMIT_BACKOFF_MS[MARKETING_LIMIT_BACKOFF_MS.length - 1];
  } else if ([130429, 131000, 131016, 131056].includes(Number(code))) {
    delay = (attempts === 1 ? 5 : 15) * 60_000;
  } else {
    return null;
  }

  // Abandon rather than deliver an alert nobody still considers news.
  const firstAttempt = firstAttemptAt ? Date.parse(firstAttemptAt) : NaN;
  const deadline = (Number.isNaN(firstAttempt) ? now : firstAttempt) + ALERT_STALE_AFTER_MS;
  if (now + delay > deadline) return null;
  return new Date(now + delay).toISOString();
}
