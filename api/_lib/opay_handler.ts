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

const OPAY_SANDBOX_URL = 'https://sandbox-cashier-api.opayweb.com/api/v3/cashier/initialize';
const OPAY_LIVE_URL = 'https://cashier-api.opayweb.com/api/v3/cashier/initialize';

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
      userName = 'Studio Member',
      userPhone = '+2348000000000',
      amount = 25000,
      planType = 'pro_monthly',
      returnUrl,
    } = req.body as OPayInitializeRequest;

    if (!userEmail) {
      return res.status(400).json({ error: 'userEmail is required' });
    }

    const secretKey = (process.env.OPAY_SECRET_KEY || process.env.SECRET_KEY || '').trim();
    const merchantId = (process.env.OPAY_MERCHANT_ID || '').trim();
    const isLive = process.env.OPAY_ENV === 'live' || secretKey.startsWith('OPAYPRV_LIVE');
    const endpoint = isLive ? OPAY_LIVE_URL : OPAY_SANDBOX_URL;

    if (!secretKey) {
      return res.status(500).json({
        error: 'OPay configuration missing: OPAY_SECRET_KEY is not configured',
      });
    }

    const reference = `MUV_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`.toUpperCase();
    const origin = req.headers.origin || 'https://muvidb.com';
    const finalReturnUrl = returnUrl || `${origin}/company/dashboard?tab=api&payment=success&ref=${reference}`;
    const callbackUrl = `${origin}/api/webhooks/opay`;

    // Amount: OPay cashier requires amount in kobo (or string formatted). Standard kobo = amount * 100
    const amountKobo = String(Math.round(amount * 100));

    const payload: Record<string, any> = {
      reference,
      mchShortName: 'MuviDB',
      productName: `MuviDB Studio Pro (${planType})`,
      productDesc: 'MuviDB Studio Management & Developer API Tier',
      userPhone: userPhone.startsWith('+') ? userPhone : `+234${userPhone.replace(/^0/, '')}`,
      userEmail,
      userName,
      amount: amountKobo,
      currency: 'NGN',
      payMethods: ['account', 'card', 'bankTransfer', 'qrcode'],
      callbackUrl,
      returnUrl: finalReturnUrl,
    };

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${secretKey}`,
    };

    if (merchantId) {
      headers['MerchantId'] = merchantId;
    }

    console.log(`[OPay] Initializing checkout for ${reference} (${amount} NGN)`);

    const opayRes = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });

    const data = await opayRes.json().catch(() => null);

    if (!opayRes.ok || !data || data.code !== '00000') {
      console.error('[OPay] Initialize error:', opayRes.status, data);
      return res.status(opayRes.status || 502).json({
        error: data?.message || 'Failed to initialize OPay cashier checkout',
        details: data,
        needsMerchantId: !merchantId,
      });
    }

    // Success response: returns cashierUrl to redirect user
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

      // Extract company ID if embedded in reference (e.g. MUV_CMP_<id>_...)
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

    // OPay expects 200 response
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

    const secretKey = (process.env.OPAY_SECRET_KEY || process.env.SECRET_KEY || '').trim();
    const merchantId = (process.env.OPAY_MERCHANT_ID || '').trim();
    const isLive = process.env.OPAY_ENV === 'live' || secretKey.startsWith('OPAYPRV_LIVE');
    const endpoint = isLive
      ? 'https://cashier-api.opayweb.com/api/v3/cashier/status'
      : 'https://sandbox-cashier-api.opayweb.com/api/v3/cashier/status';

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${secretKey}`,
    };
    if (merchantId) headers['MerchantId'] = merchantId;

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
