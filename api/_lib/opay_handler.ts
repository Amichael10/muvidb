import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from './supabase.js';
import { initializePaymentOrder, paymentAmountMinor, paymentReturnUrl, paymentOrderStatus, verifyOpayCallback } from './payment_security.js';

interface OPayInitializeRequest {
  companyId: string;
  userEmail: string;
  userName?: string;
  userPhone?: string;
  amount: number; // in NGN (e.g. 25000 for 25k Naira)
  planType?: string; // 'pro_monthly' | 'pro_annual' | 'api_enterprise'
  returnUrl?: string;
}

const OPAY_SANDBOX_URL = 'https://testapi.opaycheckout.com/api/v1/international/cashier/create';
const OPAY_LIVE_URL = 'https://api.opaycheckout.com/api/v1/international/cashier/create';

export async function handleOpay(req: VercelRequest, res: VercelResponse) {
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

  return res.status(400).json({ error: 'Invalid OPay operation or method' });
}

/**
 * Initialize OPay Cashier payment session
 */
async function handleInitialize(req: VercelRequest, res: VercelResponse) {
  try {
    const {
      userEmail,
      returnUrl,
    } = req.body as OPayInitializeRequest;

    if (!userEmail) {
      return res.status(400).json({ error: 'userEmail is required' });
    }

    const publicKey = (process.env.OPAY_PUBLIC_KEY || process.env.PUBLIC_KEY || '').trim();
    const secretKey = (process.env.OPAY_SECRET_KEY || process.env.SECRET_KEY || '').trim();
    const merchantId = (process.env.OPAY_MERCHANT_ID || '256626100609333').trim();

    const isLive = process.env.OPAY_ENV === 'live';
    const endpoint = isLive ? OPAY_LIVE_URL : OPAY_SANDBOX_URL;

    const order = await initializePaymentOrder(req, res, 'opay', !isLive);
    if (!order) return;
    const { reference, companyId, amount, planType } = order;
    const origin = 'https://muvidb.com';
    const finalReturnUrl = paymentReturnUrl(returnUrl, `${origin}/company/dashboard?tab=api&payment=success&ref=${reference}`);
    const callbackUrl = `${origin}/api/webhooks/opay`;

    // Amount in Kobo: e.g. 25000 NGN -> 2500000 Kobo
    const amountKobo = order.amountMinor;

    const productName = (req.body as any)?.productName || (planType === 'support' ? 'MuviDB Archive Contribution' : `MuviDB Studio Pro (${planType})`);
    const productDesc = (req.body as any)?.productDescription || (planType === 'support' ? 'Support & Preservation Contribution for MuviDB Archive' : 'MuviDB Studio Pro & Developer API Tier');

    const payload = {
      reference,
      country: 'NG',
      amount: {
        total: amountKobo,
        currency: 'NGN',
      },
      returnUrl: finalReturnUrl,
      callbackUrl,
      product: {
        name: productName,
        description: productDesc,
      },
    };

    const token = publicKey || secretKey;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      'MerchantId': merchantId,
    };

    console.log(`[OPay] Initializing cashier checkout for ${reference} (Merchant: ${merchantId}, Mode: ${isLive ? 'LIVE' : 'TEST'})`);

    // If live mode is enabled, attempt calling live OPay API
    if (isLive && token) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 8000);

        const opayRes = await fetch(endpoint, {
          method: 'POST',
          headers,
          body: JSON.stringify(payload),
          signal: controller.signal,
        });
        clearTimeout(timeout);

        const data = await opayRes.json().catch(() => null);

        if (opayRes.ok && data && (data.code === '00000' || data.data?.cashierUrl)) {
          return res.status(200).json({
            success: true,
            reference,
            orderNo: data.data?.orderNo,
            cashierUrl: data.data?.cashierUrl,
            status: data.data?.status || 'INITIAL',
          });
        }
      } catch (liveErr: any) {
        console.warn('[OPay] Live gateway call failed or timed out:', liveErr.message);
      }
    }

    if (isLive) return res.status(502).json({ error: 'Payment gateway unavailable; no payment has been confirmed' });
    // Sandbox checkout never activates paid access.
    // Provide seamless OPay Sandbox Cashier session
    const mockCashierUrl = returnUrl
      ? `${returnUrl}${returnUrl.includes('?') ? '&' : '?'}mock_opay=1&ref=${reference}&amount=${amount}&plan=${planType}`
      : `${origin}/company/dashboard?tab=api&mock_opay=1&ref=${reference}&amount=${amount}&plan=${planType}&company_id=${companyId || ''}`;

    return res.status(200).json({
      success: true,
      reference,
      orderNo: `OPAY_SANDBOX_${Date.now()}`,
      cashierUrl: mockCashierUrl,
      status: 'INITIAL',
      isSandbox: true,
    });
  } catch (err: any) {
    console.error('[OPay] Exception in initialize:', err);
    return res.status(500).json({ error: 'Payment service unavailable' });
  }
}

/**
 * Confirm sandbox payment and elevate studio tier
 */
async function handleConfirmSandbox(req: VercelRequest, res: VercelResponse) {
  return res.status(410).json({ error: 'Sandbox checkout cannot activate paid access' });
}

/**
 * Handle OPay Webhook Notifications (server-to-server callback)
 */
async function handleWebhook(req: VercelRequest, res: VercelResponse) {
  try {
    const rawBody = req.body;

    const secretKey = (process.env.OPAY_SECRET_KEY || '').trim();
    const payload = rawBody?.payload || rawBody;
    const incomingSha512 = req.headers['sha512'] || rawBody?.sha512;

    if (!secretKey) return res.status(503).json({ error: 'Payment verification is not configured' });
    if (!verifyOpayCallback(payload, incomingSha512, secretKey)) return res.status(401).json({ error: 'Invalid payment signature' });

    const status = payload?.status;
    const reference = payload?.reference;

    if (status === 'SUCCESS' && !payload.refunded) {
      const minor = paymentAmountMinor(payload.amount);
      if (!minor) return res.status(400).json({ error: 'Invalid payment amount' });
      const { data, error } = await supabase.rpc('settle_payment_order', {
        p_reference: reference, p_provider: 'opay', p_amount_minor: minor, p_currency: payload.currency,
        p_transaction_id: payload.transactionId, p_event_id: payload.transactionId, p_checkout_id: null,
      });
      if (error) return res.status(503).json({ error: 'Payment processing unavailable' });
      if (!data) return res.status(400).json({ error: 'Payment does not match an order' });
    }

    return res.status(200).json({ code: '00000', message: 'SUCCESS' });
  } catch (err: any) {
    console.error('[OPay Webhook] Error:', err);
    return res.status(503).json({ error: 'Payment processing unavailable' });
  }
}

/**
 * Check status of an existing order
 */
async function handleCheckStatus(req: VercelRequest, res: VercelResponse) {
  return paymentOrderStatus(req, res, 'opay');
}

export default handleOpay;
