import { expect, it } from 'vitest';
import { ALERT_STALE_AFTER_MS, whatsappRetryAt } from './whatsapp_retry_policy';

it('backs off temporary Meta failures and stops after three attempts', () => {
  expect(whatsappRetryAt(131016, 1, 0)).toBe(new Date(5 * 60_000).toISOString());
  expect(whatsappRetryAt(130429, 2, 0)).toBe(new Date(15 * 60_000).toISOString());
  expect(whatsappRetryAt(131000, 3, 0)).toBeNull();
});

it('backs off Meta marketing-frequency failures in hours, not days', () => {
  // Retrying 131049 immediately just re-hits Meta's recipient cap, but a
  // multi-day wait only delivers stale news.
  expect(whatsappRetryAt(131049, 1, 0)).toBe(new Date(6 * 60 * 60_000).toISOString());
  expect(whatsappRetryAt(131049, 2, 6 * 60 * 60_000)).toBe(new Date(18 * 60 * 60_000).toISOString());
  expect(whatsappRetryAt(131049, 3, 0)).toBeNull();
});

it('abandons an alert rather than delivering it past the stale window', () => {
  const firstAttempt = new Date(0).toISOString();
  // 19h in, a further 6h backoff would land past the 24h window.
  expect(whatsappRetryAt(131049, 2, 19 * 60 * 60_000, firstAttempt)).toBeNull();
  expect(whatsappRetryAt(131049, 1, 1 * 60 * 60_000, firstAttempt))
    .toBe(new Date(7 * 60 * 60_000).toISOString());
  // Without a first-attempt time the window is measured from now instead.
  expect(whatsappRetryAt(131049, 1, 19 * 60 * 60_000)).not.toBeNull();
  expect(ALERT_STALE_AFTER_MS).toBe(24 * 60 * 60_000);
});

it.each([undefined, 190, 131026, 132000, 132001, 131053])('does not automatically retry permanent or ambiguous failure %s', code => {
  expect(whatsappRetryAt(code, 1, 0)).toBeNull();
});
