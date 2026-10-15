import { createHmac, timingSafeEqual } from 'node:crypto';

export function verifyMetaWebhookSignature(raw: Buffer | undefined, header: unknown, secret: string): boolean {
  if (!secret || !Buffer.isBuffer(raw) || typeof header !== 'string' || !/^sha256=[0-9a-f]{64}$/i.test(header)) return false;
  const expected = createHmac('sha256', secret).update(raw).digest();
  const provided = Buffer.from(header.slice(7), 'hex');
  return timingSafeEqual(expected, provided);
}
