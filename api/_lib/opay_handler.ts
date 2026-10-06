import type { VercelRequest, VercelResponse } from '@vercel/node';
import crypto from 'node:crypto';
import { supabase } from './supabase.js';

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
      companyId,
      userEmail,
      amount = 25000,
      planType = 'pro_monthly',
      returnUrl,
    } = req.body as OPayInitializeRequest;

    if (!userEmail) {
      return res.status(400).json({ error: 'userEmail is required' });
    }

    const publicKey = (process.env.OPAY_PUBLIC_KEY || process.env.PUBLIC_KEY || '').trim();
    const secretKey = (process.env.OPAY_SECRET_KEY || process.env.SECRET_KEY || '').trim();
    const merchantId = (process.env.OPAY_MERCHANT_ID || '').trim();

    const isLive = process.env.OPAY_ENV === 'live';
    const endpoint = isLive ? OPAY_LIVE_URL : OPAY_SANDBOX_URL;

    if (!publicKey && !secretKey) {
      return res.status(500).json({
        error: 'OPay configuration missing: OPAY_PUBLIC_KEY is not configured',
      });
    }

    if (!merchantId) {
      return res.status(500).json({
        error: 'OPay configuration missing: OPAY_MERCHANT_ID is not configured in .env',
      });
    }

    const reference = `MUV_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`.toUpperCase();
    const origin = req.headers.origin || 'https://muvidb.com';
    const finalReturnUrl = returnUrl || `${origin}/company/dashboard?tab=api&payment=success&ref=${reference}`;
    const callbackUrl = `${origin}/api/webhooks/opay`;

    // Amount in Kobo: e.g. 25000 NGN -> 2500000 Kobo
    const amountKobo = Math.round(amount * 100);

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
        name: `MuviDB Studio Pro (${planType})`,
        description: 'MuviDB Studio Pro & Developer API Tier',
      },
    };

    // Public Key is standard for /cashier/create
    const token = publicKey || secretKey;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      'MerchantId': merchantId,
    };

    console.log(`[OPay] Initializing cashier checkout for ${reference} (Merchant: ${merchantId})`);

    const opayRes = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });

    const data = await opayRes.json().catch(() => null);

    if (!opayRes.ok || !data || (data.code !== '00000' && !data.data?.cashierUrl)) {
      console.error('[OPay] Initialize error:', opayRes.status, data);
      return res.status(opayRes.status || 502).json({
        error: data?.message || 'Failed to initialize OPay cashier checkout',
        details: data,
      });
    }

    return res.status(200).json({
      success: true,
      reference,
      orderNo: data.data?.orderNo,
      cashierUrl: data.data?.cashierUrl,
      status: data.data?.status || 'INITIAL',
    });
  } catch (err: any) {
    console.error('[OPay] Exception in initialize:', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
}

/**
 * Handle OPay Webhook Notifications (server-to-server callback)
 */
async function handleWebhook(req: VercelRequest, res: VercelResponse) {
  try {
    const rawBody = req.body;
    console.log('[OPay Webhook] Received payload:', JSON.stringify(rawBody));

    const secretKey = (process.env.OPAY_SECRET_KEY || process.env.SECRET_KEY || '').trim();
    const payload = rawBody?.payload || rawBody;
    const incomingSha512 = req.headers['sha512'] || rawBody?.sha512;

    // Verify HMAC/SHA512 if provided
    if (incomingSha512 && secretKey && rawBody?.payload) {
      const calculated = crypto
        .createHmac('sha512', secretKey)
        .update(JSON.stringify(rawBody.payload))
        .digest('hex');

      if (calculated !== incomingSha512) {
        console.warn('[OPay Webhook] Signature mismatch. Calculated:', calculated, 'Got:', incomingSha512);
      }
    }

    const status = payload?.status;
    const reference = payload?.reference;

    if (status === 'SUCCESS') {
      console.log(`[OPay Webhook] Payment SUCCESS for reference: ${reference}`);

      if (reference?.includes('_CMP_')) {
        const parts = reference.split('_');
        const companyId = parts[2];
        if (companyId) {
          await supabase
            .from('companies')
            .update({
              api_tier: 'pro',
            })
            .eq('id', companyId);
        }
      }
    }

    return res.status(200).json({ code: '00000', message: 'SUCCESS' });
  } catch (err: any) {
    console.error('[OPay Webhook] Error:', err);
    return res.status(200).json({ code: '00000', message: 'ERROR_RECORDED' });
  }
}

/**
 * Check status of an existing order
 */
async function handleCheckStatus(req: VercelRequest, res: VercelResponse) {
  try {
    const reference = String(req.query.reference || '');
    const orderNo = String(req.query.orderNo || '');

    if (!reference && !orderNo) {
      return res.status(400).json({ error: 'reference or orderNo is required' });
    }

    const publicKey = (process.env.OPAY_PUBLIC_KEY || process.env.PUBLIC_KEY || '').trim();
    const merchantId = (process.env.OPAY_MERCHANT_ID || '').trim();
    const isLive = process.env.OPAY_ENV === 'live';
    const endpoint = isLive
      ? 'https://api.opaycheckout.com/api/v1/international/cashier/status'
      : 'https://testapi.opaycheckout.com/api/v1/international/cashier/status';

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${publicKey}`,
      'MerchantId': merchantId,
    };

    const opayRes = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify({ reference, orderNo }),
    });

    const data = await opayRes.json().catch(() => null);
    return res.status(opayRes.status).json(data);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
}
