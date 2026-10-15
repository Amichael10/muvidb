import { createHmac } from 'node:crypto';
import { Readable } from 'node:stream';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ from: vi.fn(), update: vi.fn(), in: vi.fn(), statuses: vi.fn() }));
vi.mock('./supabase.js', () => ({ supabase: { from: mocks.from } }));
vi.mock('./cors.js', () => ({ handleCors: () => false }));
vi.mock('./whatsapp_delivery_status.js', () => ({ recordWhatsAppDeliveryStatuses: mocks.statuses }));
import { handleWhatsApp } from './whatsapp_handler';
import { prepareRequestBody } from './request_body';

const secret = 'fixture-secret';
const stop = { entry: [{ changes: [{ value: { messages: [{ from: '2348100000000', text: { body: 'STOP' } }] } }] }] };
function response() { const res: any = { status: vi.fn(() => res), json: vi.fn(() => res), setHeader: vi.fn(), send: vi.fn() }; return res; }
function request(raw: Buffer, signature?: string): any {
  const req = Readable.from([raw]);
  return Object.assign(req, { method: 'POST', query: { action: 'webhook' }, headers: { 'content-type': 'application/json', 'x-hub-signature-256': signature } });
}
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv('WHATSAPP_APP_SECRET', secret);
  mocks.from.mockReturnValue({ update: mocks.update });
  mocks.update.mockReturnValue({ in: mocks.in });
  mocks.in.mockResolvedValue({ error: null });
});
afterEach(() => vi.unstubAllEnvs());

it('rejects an unsigned STOP before reading or changing database records', async () => {
  const req = request(Buffer.from(JSON.stringify(stop)));
  await prepareRequestBody(req);
  const res = response();
  await handleWhatsApp(req, res);
  expect(res.status).toHaveBeenCalledWith(401);
  expect(mocks.statuses).not.toHaveBeenCalled();
  expect(mocks.from).not.toHaveBeenCalled();
});

it('verifies the original bytes including whitespace and unsubscribes only the full number', async () => {
  const raw = Buffer.from(JSON.stringify(stop, null, 2) + '\n');
  const signature = 'sha256=' + createHmac('sha256', secret).update(raw).digest('hex');
  const req = request(raw, signature);
  await prepareRequestBody(req);
  const res = response();
  await handleWhatsApp(req, res);
  expect(res.status).toHaveBeenCalledWith(200);
  expect(mocks.in).toHaveBeenCalledWith('whatsapp_phone', ['2348100000000', '+2348100000000']);
});

it('rejects payload tampering even when a well-formed signature is supplied', async () => {
  const raw = Buffer.from(JSON.stringify(stop));
  const req = request(raw, 'sha256=' + createHmac('sha256', secret).update('{}').digest('hex'));
  await prepareRequestBody(req);
  const res = response();
  await handleWhatsApp(req, res);
  expect(res.status).toHaveBeenCalledWith(401);
  expect(mocks.from).not.toHaveBeenCalled();
});

it('fails closed with no configured Meta app secret', async () => {
  vi.stubEnv('WHATSAPP_APP_SECRET', '');
  const req = request(Buffer.from(JSON.stringify(stop)));
  await prepareRequestBody(req);
  const res = response();
  await handleWhatsApp(req, res);
  expect(res.status).toHaveBeenCalledWith(503);
  expect(mocks.statuses).not.toHaveBeenCalled();
});
