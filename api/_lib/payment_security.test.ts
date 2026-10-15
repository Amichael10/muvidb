import { createHmac } from 'node:crypto';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ from: vi.fn(), rpc: vi.fn(), getUser: vi.fn(), quota: vi.fn() }));
vi.mock('./supabase.js', () => ({ supabase: { from: mocks.from, rpc: mocks.rpc, auth: { getUser: mocks.getUser } } }));
vi.mock('./request_quota.js', () => ({ requireRequestQuota: mocks.quota }));
import { initializePaymentOrder, paymentAmountMinor, verifyBachsCallback, verifyOpayCallback } from './payment_security';
import { handleOpay } from './opay_handler';
import { handleBachs } from './bachs_handler';

function response() { const res: any = { status: vi.fn(() => res), json: vi.fn(() => res), setHeader: vi.fn() }; return res; }
beforeEach(() => { vi.clearAllMocks(); mocks.quota.mockResolvedValue(true); });
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

it.each(['NaN', '-1', '1e6', '0.001', 'Infinity'])('rejects ambiguous payment amount %s', value => {
  expect(paymentAmountMinor(value)).toBeNull();
});
it('converts decimal money without rounding away fractional precision', () => {
  expect(paymentAmountMinor('25000.10')).toBe(2500010);
  expect(paymentAmountMinor('25000')).toBe(2500000);
});

it('uses the server price even when a company member requests a one-naira subscription', async () => {
  const insert = vi.fn().mockResolvedValue({ error: null });
  const chain: any = { select: vi.fn(() => chain), eq: vi.fn(() => chain), in: vi.fn(() => chain), maybeSingle: vi.fn().mockResolvedValue({ data: { role: 'owner' }, error: null }), insert };
  mocks.from.mockReturnValue(chain);
  mocks.getUser.mockResolvedValue({ data: { user: { id: 'member-id' } }, error: null });
  const order = await initializePaymentOrder({ headers: { authorization: 'Bearer session' }, body: {
    companyId: '11111111-1111-4111-8111-111111111111', amount: 1, planType: 'pro_monthly', currency: 'NGN',
  } } as any, response(), 'bachs', false);
  expect(order?.amountMinor).toBe(2500000);
  expect(insert).toHaveBeenCalledWith(expect.objectContaining({ amount_minor: 2500000, user_id: 'member-id', sandbox: false }));
});

it('does not turn a donation into a company subscription', async () => {
  const insert = vi.fn().mockResolvedValue({ error: null });
  mocks.from.mockReturnValue({ insert });
  await initializePaymentOrder({ headers: {}, body: { companyId: 'victim', amount: 100, planType: 'support' } } as any, response(), 'bachs', false);
  expect(insert).toHaveBeenCalledWith(expect.objectContaining({ company_id: null, plan_type: 'support', amount_minor: 10000 }));
});

it.each([handleOpay, handleBachs])('never grants access through sandbox confirmation', async handler => {
  const res = response();
  await handler({ method: 'POST', headers: {}, query: { op: 'confirm_sandbox' }, body: { companyId: 'victim' } } as any, res);
  expect(res.status).toHaveBeenCalledWith(410);
  expect(mocks.from).not.toHaveBeenCalled();
  expect(mocks.rpc).not.toHaveBeenCalled();
});

it.each([['OPAY_SECRET_KEY', handleOpay], ['BACHS_WEBHOOK_SECRET', handleBachs]] as const)('rejects unsigned callbacks with %s configured', async (variable, handler) => {
  vi.stubEnv(variable, 'fixture-secret');
  const res = response();
  await handler({ method: 'POST', headers: {}, query: { op: 'webhook' }, body: { status: 'SUCCESS' } } as any, res);
  expect(res.status).toHaveBeenCalledWith(401);
  expect(mocks.rpc).not.toHaveBeenCalled();
});

it('verifies OPay callbacks using the documented SHA3-512 canonical format', () => {
  const payload = { amount: '25000', currency: 'NGN', reference: 'order', refunded: false, status: 'SUCCESS', timestamp: '2026-10-15T00:00:00Z', token: 'token', transactionId: 'transaction' };
  const canonical = '{Amount:"25000",Currency:"NGN",Reference:"order",Refunded:f,Status:"SUCCESS",Timestamp:"2026-10-15T00:00:00Z",Token:"token",TransactionID:"transaction"}';
  const tag = createHmac('sha3-512', 'fixture-secret').update(canonical).digest('hex');
  expect(verifyOpayCallback(payload, tag, 'fixture-secret')).toBe(true);
  expect(verifyOpayCallback({ ...payload, amount: '1' }, tag, 'fixture-secret')).toBe(false);
});

it('supports Bachs signature rotation and rejects stale requests', () => {
  const raw = Buffer.from('{ "fixture": true }\n');
  const timestamp = String(Math.floor(Date.now() / 1000));
  const tag = createHmac('sha256', 'fixture-secret').update(`${timestamp}.`).update(raw).digest('hex');
  expect(verifyBachsCallback(raw, { 'x-bachs-signature-v2': `t=${timestamp},v1=${'0'.repeat(64)},v1=${tag}` }, 'fixture-secret')).toBe(true);
  expect(verifyBachsCallback(raw, { 'x-bachs-timestamp': '1000000000', 'x-bachs-signature': tag }, 'fixture-secret')).toBe(false);
});

it('does not fulfil a signed checkout.completed event', async () => {
  vi.stubEnv('BACHS_WEBHOOK_SECRET', 'fixture-secret');
  const body = { id: 'event', type: 'checkout.completed', data: { metadata: { company_id: 'victim' } } };
  const rawBody = Buffer.from(JSON.stringify(body));
  const timestamp = String(Math.floor(Date.now() / 1000));
  const tag = createHmac('sha256', 'fixture-secret').update(`${timestamp}.`).update(rawBody).digest('hex');
  const res = response();
  await handleBachs({ method: 'POST', query: { op: 'webhook' }, headers: { 'x-bachs-timestamp': timestamp, 'x-bachs-signature': tag }, rawBody, body } as any, res);
  expect(res.status).toHaveBeenCalledWith(200);
  expect(mocks.rpc).not.toHaveBeenCalled();
  expect(mocks.from).not.toHaveBeenCalled();
});
