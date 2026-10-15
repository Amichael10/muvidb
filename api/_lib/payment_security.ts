import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { SUBSCRIPTION_PLANS } from '../../src/config/plans.js';
import { supabase } from './supabase.js';
import { requireRequestQuota } from './request_quota.js';

export function paymentReturnUrl(value: unknown, fallback: string): string {
  try {
    const candidate = new URL(String(value));
    const allowed = ['https://muvidb.com', 'https://www.muvidb.com'];
    if (process.env.NODE_ENV !== 'production') allowed.push('http://localhost:3001');
    if (allowed.includes(candidate.origin) && !candidate.username && !candidate.password) return candidate.toString();
  } catch { /* Use the application's return route. */ }
  return fallback;
}

export async function paymentOrderStatus(req: VercelRequest, res: VercelResponse, provider: 'opay' | 'bachs') {
  const reference = typeof req.query.reference === 'string' ? req.query.reference : '';
  const checkoutId = typeof req.query.sessionId === 'string' ? req.query.sessionId : '';
  if (!reference && !checkoutId) return res.status(400).json({ error: 'Payment reference required' });
  const query = supabase.from('payment_orders').select('reference,status,user_id').eq('provider', provider);
  const { data: order, error } = await (reference ? query.eq('reference', reference) : query.eq('provider_checkout_id', checkoutId)).maybeSingle();
  if (error) return res.status(503).json({ error: 'Payment status unavailable' });
  if (!order) return res.status(404).json({ error: 'Payment not found' });
  if (order.user_id) {
    const token = String(req.headers.authorization || '').match(/^Bearer (.+)$/)?.[1];
    if (!token) return res.status(401).json({ error: 'Sign in required' });
    const { data, error: authError } = await supabase.auth.getUser(token);
    if (authError || data.user?.id !== order.user_id) return res.status(403).json({ error: 'Payment access denied' });
  }
  res.setHeader('Cache-Control', 'no-store');
  return res.status(200).json({ reference: order.reference, status: order.status === 'paid' ? 'SUCCESS' : 'INITIAL' });
}

export function paymentAmountMinor(value: unknown): number | null {
  const raw = String(value ?? '');
  if (!/^\d{1,9}(\.\d{1,2})?$/.test(raw)) return null;
  const [whole, fractional = ''] = raw.split('.');
  return Number(whole) * 100 + Number(fractional.padEnd(2, '0'));
}

export async function initializePaymentOrder(req: VercelRequest, res: VercelResponse, provider: 'opay' | 'bachs', sandbox: boolean) {
  const body = req.body || {};
  const planType = String(body.planType || 'pro_monthly');
  if (!['support', 'pro_monthly', 'pro_annual'].includes(planType) || (body.currency && body.currency !== 'NGN')) {
    res.status(400).json({ error: 'Unsupported plan or currency' }); return null;
  }
  let userId: string | null = null;
  let companyId: string | null = null;
  let amountMinor: number;
  if (planType === 'support') {
    const donation = paymentAmountMinor(body.amount);
    if (!donation || donation < 10000 || donation > 100000000) { res.status(400).json({ error: 'Invalid contribution amount' }); return null; }
    amountMinor = donation;
  } else {
    const token = String(req.headers.authorization || '').match(/^Bearer (.+)$/)?.[1];
    if (!token) { res.status(401).json({ error: 'Sign in required' }); return null; }
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data.user) { res.status(401).json({ error: 'Invalid session' }); return null; }
    userId = data.user.id;
    companyId = String(body.companyId || '');
    if (!/^[0-9a-f-]{36}$/i.test(companyId)) { res.status(400).json({ error: 'Invalid company' }); return null; }
    const { data: member, error: memberError } = await supabase.from('company_members').select('role')
      .eq('company_id', companyId).eq('user_id', userId).eq('status', 'active').in('role', ['owner', 'admin']).maybeSingle();
    if (memberError || !member) { res.status(403).json({ error: 'Company billing access required' }); return null; }
    amountMinor = SUBSCRIPTION_PLANS[planType === 'pro_annual' ? 'studio_pro_annual' : 'studio_pro_monthly'].amount * 100;
  }
  if (!(await requireRequestQuota(req, res, `payment-${provider}`, userId || undefined))) return null;
  const reference = `MUV_${randomUUID()}`;
  const { error } = await supabase.from('payment_orders').insert({ reference, provider, user_id: userId,
    company_id: companyId, plan_type: planType, amount_minor: amountMinor, currency: 'NGN', sandbox });
  if (error) { res.status(503).json({ error: 'Unable to record payment order' }); return null; }
  return { reference, amountMinor, amount: amountMinor / 100, companyId, planType };
}

/** Canonical callback format from OPay's callback-signature documentation. */
export function verifyOpayCallback(payload: any, signature: unknown, secret: string): boolean {
  if (!secret || !payload || typeof signature !== 'string' || !/^[a-f0-9]{128}$/i.test(signature)) return false;
  for (const name of ['amount', 'currency', 'reference', 'status', 'timestamp', 'transactionId']) {
    if (typeof payload[name] !== 'string' || /["\\\r\n]/.test(payload[name])) return false;
  }
  if (typeof payload.refunded !== 'boolean' || (payload.token != null && typeof payload.token !== 'string')) return false;
  const token = payload.token || '';
  if (/["\\\r\n]/.test(token)) return false;
  const canonical = `{Amount:"${payload.amount}",Currency:"${payload.currency}",Reference:"${payload.reference}",Refunded:${payload.refunded ? 't' : 'f'},Status:"${payload.status}",Timestamp:"${payload.timestamp}",Token:"${token}",TransactionID:"${payload.transactionId}"}`;
  return timingSafeEqual(createHmac('sha3-512', secret).update(canonical).digest(), Buffer.from(signature, 'hex'));
}

export function verifyBachsCallback(raw: Buffer | undefined, headers: VercelRequest['headers'], secret: string): boolean {
  if (!secret || !Buffer.isBuffer(raw)) return false;
  let timestamp = String(headers['x-bachs-timestamp'] || '');
  let signatures = [String(headers['x-bachs-signature'] || '')];
  const versioned = headers['x-bachs-signature-v2'];
  if (typeof versioned === 'string') {
    const parts = versioned.split(',').map(item => item.trim().split('='));
    timestamp = parts.find(([key]) => key === 't')?.[1] || '';
    signatures = parts.filter(([key]) => key === 'v1').map(([, value]) => value);
  }
  if (!/^\d{10}$/.test(timestamp) || Math.abs(Date.now() / 1000 - Number(timestamp)) > 300) return false;
  const expected = createHmac('sha256', secret).update(`${timestamp}.`).update(raw).digest();
  return signatures.some(signature => /^[a-f0-9]{64}$/i.test(signature) && timingSafeEqual(expected, Buffer.from(signature, 'hex')));
}
