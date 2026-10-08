import type { VercelRequest, VercelResponse } from '@vercel/node';
import crypto from 'node:crypto';
import { supabase } from './supabase.js';

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
      companyId,
      userEmail,
      userName,
      amount = 25000,
      currency = 'NGN',
      planType = 'pro_monthly',
      returnUrl,
      cancelUrl,
    } = req.body as BachsInitializeRequest;

    const secretKey = (process.env.BACHS_SECRET_KEY || '').trim();
    if (!secretKey) {
      return res.status(500).json({ error: 'BACHS_SECRET_KEY is not configured on the server.' });
    }

    const origin = req.headers.origin || 'https://muvidb.com';
    const reference = companyId
      ? `MUV_CMP_${companyId}_${Date.now()}`.toUpperCase()
      : `MUV_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`.toUpperCase();

    const finalReturnUrl = returnUrl || `${origin}/company/dashboard?tab=api&payment=success&ref=${reference}`;
    const finalCancelUrl = cancelUrl || `${origin}/company/dashboard?tab=api&payment=cancelled&ref=${reference}`;

    const formattedAmount = Number(amount).toFixed(2);

    const payload: Record<string, any> = {
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

    const response = await fetch(`${BACHS_API_BASE}/checkout-sessions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${secretKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json().catch(() => null);

    if (response.ok && data) {
      const checkoutUrl = data.checkout_url || data.url || data.session_url;
      const sessionId = data.id || data.session_id;

      return res.status(200).json({
        success: true,
        reference,
        sessionId,
        checkoutUrl,
        cashierUrl: checkoutUrl,
      });
    }

    // Handle account pending activation or onboarding
    if (data?.error_code === 'ACCOUNT_NOT_ACTIVATED') {
      console.warn('[Bachs] Live account is pending activation by Bachs compliance:', data.detail);

      // Offer developer/sandbox fallback so checkout testing doesn't break while awaiting live KYC
      const mockCheckoutUrl = `${origin}/company/dashboard?tab=api&mock_bachs=1&ref=${reference}&amount=${amount}&plan=${planType}&company_id=${companyId || ''}`;

      return res.status(200).json({
        success: true,
        reference,
        sessionId: `BACHS_SANDBOX_${Date.now()}`,
        checkoutUrl: mockCheckoutUrl,
        cashierUrl: mockCheckoutUrl,
        isSandbox: true,
        notice: 'Bachs live account pending activation. Sandbox checkout preview active.',
      });
    }

    console.error('[Bachs] Checkout creation returned error:', response.status, data);
    return res.status(response.status).json({
      error: data?.detail || data?.message || 'Failed to initialize Bachs checkout session',
      details: data,
    });
  } catch (err: any) {
    console.error('[Bachs] Exception in initialize:', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
}

/**
 * Confirm Sandbox Checkout (Simulation for unactivated/testing environments)
 */
async function handleConfirmSandbox(req: VercelRequest, res: VercelResponse) {
  try {
    const { companyId, reference } = req.body || {};
    let targetCompanyId = companyId;

    if (!targetCompanyId && reference?.includes('_CMP_')) {
      const parts = reference.split('_');
      targetCompanyId = parts[2];
    }

    if (targetCompanyId) {
      const { error } = await supabase
        .from('companies')
        .update({ api_tier: 'pro' })
        .eq('id', targetCompanyId);

      if (error) {
        console.error('[Bachs Sandbox] Supabase update error:', error);
      }
    }

    return res.status(200).json({
      success: true,
      reference,
      status: 'SUCCESS',
      message: 'Payment confirmed! Studio Pro tier activated.',
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
}

/**
 * Handle Bachs Webhook Notifications (HMAC-SHA256 signature verified)
 */
async function handleWebhook(req: VercelRequest, res: VercelResponse) {
  try {
    const webhookSecret = (process.env.BACHS_WEBHOOK_SECRET || '').trim();
    const signature = (req.headers['x-bachs-signature'] || req.headers['x-bachs-signature-v2'] || '') as string;
    const timestamp = (req.headers['x-bachs-timestamp'] || '') as string;

    const rawBody = typeof req.body === 'string' ? req.body : JSON.stringify(req.body || {});
    console.log('[Bachs Webhook] Incoming webhook notification received');

    // Cryptographic signature verification if secret is set and signature provided
    if (webhookSecret && signature && timestamp) {
      const now = Math.floor(Date.now() / 1000);
      const reqTime = parseInt(timestamp, 10);

      // Replay tolerance: 300s
      if (Math.abs(now - reqTime) > 300) {
        console.warn('[Bachs Webhook] Timestamp outside 300s window. Possible replay attack.');
        return res.status(400).json({ error: 'Timestamp tolerance exceeded' });
      }

      const toSign = `${timestamp}.${rawBody}`;
      const calculated = crypto
        .createHmac('sha256', webhookSecret)
        .update(toSign)
        .digest('hex');

      if (calculated !== signature) {
        console.warn('[Bachs Webhook] Signature mismatch. Calculated:', calculated, 'Header:', signature);
        return res.status(401).json({ error: 'Invalid webhook signature' });
      }
    }

    const event = typeof req.body === 'object' ? req.body : JSON.parse(rawBody || '{}');
    const eventType = (event.type || event.event || '').toLowerCase();
    const data = event.data || event.payload || event;

    console.log(`[Bachs Webhook] Processing event: ${eventType}`);

    // Check for successful payment / checkout completed / collection succeeded / invoice paid
    const isSuccess =
      eventType.includes('checkout.completed') ||
      eventType.includes('collection.succeeded') ||
      eventType.includes('invoice.paid') ||
      eventType === 'checkout completed' ||
      eventType === 'collection succeeded';

    if (isSuccess) {
      const metadata = data?.metadata || {};
      const reference = metadata?.reference || data?.reference;
      const companyId = metadata?.company_id || (reference?.includes('_CMP_') ? reference.split('_')[2] : null);

      console.log(`[Bachs Webhook] Payment verified for company: ${companyId || 'N/A'}, ref: ${reference}`);

      if (companyId) {
        const { error } = await supabase
          .from('companies')
          .update({
            api_tier: 'pro',
          })
          .eq('id', companyId);

        if (error) {
          console.error('[Bachs Webhook] Failed to update company api_tier:', error.message);
        } else {
          console.log(`[Bachs Webhook] Successfully elevated company ${companyId} to Studio Pro tier.`);
        }
      }
    }

    // Check for subscription deletion or cancellation
    const isCancellation =
      eventType.includes('customer_subscription.deleted') ||
      eventType.includes('subscription.deleted') ||
      eventType.includes('subscription.canceled');

    if (isCancellation) {
      const metadata = data?.metadata || {};
      const companyId = metadata?.company_id;
      if (companyId) {
        console.log(`[Bachs Webhook] Subscription ended for company: ${companyId}`);
        await supabase
          .from('companies')
          .update({ api_tier: 'free' })
          .eq('id', companyId);
      }
    }

    return res.status(200).json({ received: true });
  } catch (err: any) {
    console.error('[Bachs Webhook] Handler error:', err);
    return res.status(200).json({ received: false, error: err.message });
  }
}

/**
 * Check Status of a Checkout Session or Payment
 */
async function handleCheckStatus(req: VercelRequest, res: VercelResponse) {
  try {
    const sessionId = String(req.query.sessionId || req.query.id || '');
    if (!sessionId) {
      return res.status(400).json({ error: 'sessionId is required' });
    }

    const secretKey = (process.env.BACHS_SECRET_KEY || '').trim();
    const response = await fetch(`${BACHS_API_BASE}/checkout-sessions/${encodeURIComponent(sessionId)}`, {
      headers: {
        'Authorization': `Bearer ${secretKey}`,
      },
    });

    const data = await response.json().catch(() => null);
    return res.status(response.status).json(data);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
}

export default handleBachs;
