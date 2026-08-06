/**
 * Minimal Standard Webhooks verifier (Supabase Auth Send Email hook).
 * https://github.com/standard-webhooks/standard-webhooks
 */
import crypto from 'crypto';

const TOLERANCE_SEC = 5 * 60;

function decodeSecret(raw: string): Buffer {
  const trimmed = raw.replace(/^v1,whsec_/, '').replace(/^whsec_/, '');
  return Buffer.from(trimmed, 'base64');
}

function sign(secret: Buffer, msgId: string, timestamp: string, payload: string) {
  const signed = `${msgId}.${timestamp}.${payload}`;
  return crypto.createHmac('sha256', secret).update(signed).digest('base64');
}

export function verifyStandardWebhook(
  payload: string,
  headers: Record<string, string | undefined>,
  secretRaw: string,
): unknown {
  const msgId = headers['webhook-id'] || headers['svix-id'];
  const timestamp = headers['webhook-timestamp'] || headers['svix-timestamp'];
  const signatureHeader = headers['webhook-signature'] || headers['svix-signature'];

  if (!msgId || !timestamp || !signatureHeader) {
    throw new Error('Missing webhook signature headers');
  }

  const ts = Number(timestamp);
  if (!Number.isFinite(ts)) throw new Error('Invalid webhook timestamp');
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - ts) > TOLERANCE_SEC) {
    throw new Error('Webhook timestamp outside tolerance');
  }

  const secret = decodeSecret(secretRaw);
  const expected = sign(secret, msgId, timestamp, payload);

  const signatures = signatureHeader.split(' ').map((part) => {
    const [version, sig] = part.split(',', 2);
    return { version, sig };
  });

  const valid = signatures.some(
    (s) => s.version === 'v1' && s.sig && timingSafeEqual(s.sig, expected),
  );
  if (!valid) throw new Error('Invalid webhook signature');

  return JSON.parse(payload);
}

function timingSafeEqual(a: string, b: string) {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}
