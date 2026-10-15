import { expect, it } from 'vitest';
import { whatsappRetryAt } from './whatsapp_retry_policy';

it('backs off temporary Meta failures and stops after three attempts', () => {
  expect(whatsappRetryAt(131016, 1, 0)).toBe(new Date(5 * 60_000).toISOString());
  expect(whatsappRetryAt(130429, 2, 0)).toBe(new Date(15 * 60_000).toISOString());
  expect(whatsappRetryAt(131000, 3, 0)).toBeNull();
});

it.each([undefined, 190, 131026, 131049, 132000, 132001, 131053])('does not automatically retry permanent or ambiguous failure %s', code => {
  expect(whatsappRetryAt(code, 1, 0)).toBeNull();
});
