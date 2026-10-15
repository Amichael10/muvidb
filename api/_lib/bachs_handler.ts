import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from './supabase.js';
import type { RawBodyRequest } from './request_body.js';
import { initializePaymentOrder, paymentAmountMinor, paymentReturnUrl, paymentOrderStatus, verifyBachsCallback } from './payment_security.js';

interface BachsInitializeRequest {
  companyId?: string;
  userEmail?: string;
  userName?: string;
  amount?: number; // in NGN (e.g. 25000)
  currency?: string; // 'NGN' | 'USD'
  planType?: string; // 'pro_monthly' | 'pro_annual' | 'support'
  returnUrl?: string;
  cancelUrl?: string;
}

const BACHS_API_BASE = 'https://api.bachs.io/v1';

export async function handleBachs(req: VercelRequest, res: VercelResponse) {
  const op = req.query.op || req.body?.op || (req.url?.includes('webhook') ? 'webhook' : 'initialize');

  if (req.method === 'POST' && op === 'initialize') {
    return handleInitialize(req, res);
  }

  if (req.method === 'POST' && op === 'confirm_sandbox') {
    return handleConfirmSandbox(req, res);
  }

  if (req.method === 'POST' && (op === 'webhook' || req.url?.includes('webhook'))) {
    return handleWebhook(req, res);
  }

  if (req.method === 'GET' && op === 'status') {
    return handleCheckStatus(req, res);
  }

  return res.status(400).json({ error: 'Invalid Bachs operation or method' });
}

/**
 * Initialize Bachs Hosted Checkout Session
 */
async function handleInitialize(req: VercelRequest, res: VercelResponse) {
  try {
    const {
      userEmail,
      userName,
      currency = 'NGN',
      returnUrl,
      cancelUrl,
    } = req.body as BachsInitializeRequest;

    const secretKey = (process.env.BACHS_SECRET_KEY || '').trim();
    if (!secretKey) {
      return res.status(500).json({ error: 'BACHS_SECRET_KEY is not configured on the server.' });
    }

    const order = await initializePaymentOrder(req, res, 'bachs', secretKey.startsWith('sk_sandbox_') || process.env.BACHS_ENV === 'sandbox');
    if (!order) return;
    const { reference, companyId, amount, planType } = order;
    const origin = 'https://muvidb.com';

    const finalReturnUrl = paymentReturnUrl(returnUrl, `${origin}/company/dashboard?tab=api&payment=success&ref=${reference}`);
    const finalCancelUrl = paymentReturnUrl(cancelUrl, `${origin}/company/dashboard?tab=api&payment=cancelled&ref=${reference}`);

    const formattedAmount = Number(amount).toFixed(2);

    const payload: Record<string, any> = {
      reference,
      pricing: {
        currency: currency.toUpperCase(),
        amount: formattedAmount,
      },
      success_url: finalReturnUrl,
      cancel_url: finalCancelUrl,
      metadata: {
        reference,
        company_id: companyId || '',
        plan_type: planType,
      },
    };

    if (userEmail) {
      payload.customer = {
        email: userEmail,
        ...(userName ? { name: userName } : {}),
      };
    }

    console.log(`[Bachs] Initializing checkout session for ${reference} (${currency} ${formattedAmount})`);

    const apiBase = order && (secretKey.startsWith('sk_sandbox_') || process.env.BACHS_ENV === 'sandbox') ? 'https://sandbox-api.bachs.io/v1' : BACHS_API_BASE;
    const response = await fetch(`${apiBase}/checkout-sessions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${secretKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10000),
    });

    const data = await response.json().catch(() => null);

    if (response.ok && data) {
      const checkoutUrl = data.checkout_url || data.url || data.session_url;
      const sessionId = data.id || data.session_id;
      if (!sessionId || !checkoutUrl) return res.status(502).json({ error: 'Invalid checkout response' });
      const { error: orderError } = await supabase.from('payment_orders').update({ provider_checkout_id: String(sessionId) }).eq('reference', reference);
      if (orderError) return res.status(503).json({ error: 'Unable to record checkout session' });

      return res.status(200).json({
        success: true,
        reference,
        sessionId,
        checkoutUrl,
        cashierUrl: checkoutUrl,
      });
    }

    if (data?.error_code === 'ACCOUNT_NOT_ACTIVATED') {
      return res.status(503).json({ error: 'Payment provider activation is pending' });
    }

    console.error('[Bachs] Checkout creation returned error:', response.status, data);
    return res.status(response.status).json({
      error: 'Failed to initialize Bachs checkout session',
    });
  } catch (err: any) {
    console.error('[Bachs] Exception in initialize:', err);
    return res.status(500).json({ error: 'Payment service unavailable' });
  }
}

/**
 * Confirm Sandbox Checkout (Simulation for unactivated/testing environments)
 */
async function handleConfirmSandbox(req: VercelRequest, res: VercelResponse) {
  return res.status(410).json({ error: 'Sandbox checkout cannot activate paid access' });
}

/**
 * Handle Bachs Webhook Notifications (HMAC-SHA256 signature verified)
 */
async function handleWebhook(req: VercelRequest, res: VercelResponse) {
  try {
    const webhookSecret = (process.env.BACHS_WEBHOOK_SECRET || '').trim();
    if (!webhookSecret) return res.status(503).json({ error: 'Payment verification is not configured' });
    const raw = (req as RawBodyRequest).rawBody;
    if (!verifyBachsCallback(raw, req.headers, webhookSecret)) {
      return res.status(401).json({ error: 'Invalid payment signature' });
    }
    const rawBody = raw!.toString('utf8');

    const event = typeof req.body === 'object' ? req.body : JSON.parse(rawBody || '{}');
    const eventType = (event.type || event.event || '').toLowerCase();
    const data = event.data || event.payload || event;

    console.log(`[Bachs Webhook] Processing event: ${eventType}`);

    // Completing checkout alone can represent a free checkout; require collected money.
    if (eventType === 'collection.succeeded' && data.status === 'SUCCEEDED') {
      const reference = data.metadata?.reference || data.reference;
      const minor = paymentAmountMinor(data.amount);
      if (!reference || !minor || !data.checkout_id || !data.charge_id || !event.id) {
        return res.status(400).json({ error: 'Payment reconciliation fields required' });
      }
      const { data: settled, error } = await supabase.rpc('settle_payment_order', {
        p_reference: String(reference), p_provider: 'bachs', p_amount_minor: minor,
        p_currency: String(data.currency || ''), p_transaction_id: String(data.charge_id),
        p_event_id: String(event.id), p_checkout_id: String(data.checkout_id),
      });
      if (error) return res.status(503).json({ error: 'Payment processing unavailable' });
      if (!settled) return res.status(400).json({ error: 'Payment does not match an order' });
    }

    return res.status(200).json({ received: true });
  } catch (err: any) {
    console.error('[Bachs Webhook] Handler error:', err);
    return res.status(503).json({ error: 'Payment processing unavailable' });
  }
}

/**
 * Check Status of a Checkout Session or Payment
 */
async function handleCheckStatus(req: VercelRequest, res: VercelResponse) {
  return paymentOrderStatus(req, res, 'bachs');
}

export default handleBachs;
