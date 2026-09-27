/**
 * WhatsApp Endpoints Handler:
 * 1. POST /api/whatsapp?action=opt-in
 *    Allows authenticated user to update their phone and toggle WhatsApp alerts.
 * 2. POST /api/whatsapp?action=test-alert (Admin only)
 *    Manually triggers movie alerts for a specific film to test the WhatsApp flow.
 * 3. GET / POST /api/whatsapp?action=webhook
 *    Meta WhatsApp Webhook for token verification and incoming 'STOP' unsubscribe messages.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from './supabase.js';
import { isValidAuth } from './auth.js';
import { handleCors } from './cors.js';
import { normalizeWhatsAppNumber } from './meta_whatsapp.js';
import { dispatchMovieWhatsAppAlerts } from './whatsapp_movie_alerts.js';

export async function handleWhatsApp(req: VercelRequest, res: VercelResponse) {
  if (handleCors(req, res)) return;

  const action = req.query.action || req.query.op || '';

  // ── META WEBHOOK VERIFICATION (GET) ─────────────────────────────────────────
  if (req.method === 'GET' && (action === 'webhook' || req.query['hub.mode'])) {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    const expectedToken = (process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN || process.env.META_WEBHOOK_VERIFY_TOKEN || 'muvidb_whatsapp_verify_token').trim();

    if (mode === 'subscribe' && token === expectedToken) {
      console.log('[WhatsApp Webhook] Verification successful');
      return res.status(200).send(challenge);
    }
    return res.status(403).json({ error: 'Verification token mismatch' });
  }

  // ── META INBOUND WEBHOOK (POST) ─────────────────────────────────────────────
  // Handles incoming messages such as 'STOP' or button click to unsubscribe
  if (req.method === 'POST' && action === 'webhook') {
    const body = req.body;
    try {
      const entry = body?.entry?.[0];
      const changes = entry?.changes?.[0];
      const value = changes?.value;
      const message = value?.messages?.[0];

      if (message) {
        const from = message.from; // Sender phone number
        const text = (message.text?.body || message.button?.text || '').trim().toUpperCase();

        if (text === 'STOP' || text === 'UNSUBSCRIBE' || text.includes('STOP')) {
          console.log(`[WhatsApp Webhook] STOP received from ${from}. Opting out user.`);
          const normalized = normalizeWhatsAppNumber(from);
          // Look up user by phone and disable whatsapp_enabled
          await supabase
            .from('users')
            .update({ whatsapp_enabled: false })
            .ilike('whatsapp_phone', `%${normalized.slice(-10)}%`);
        }
      }
      return res.status(200).json({ status: 'ok' });
    } catch (err: any) {
      console.error('[WhatsApp Webhook] Inbound handling error:', err);
      return res.status(200).json({ status: 'error_logged' });
    }
  }

  // ── USER OPT-IN / PHONE UPDATE (POST) ───────────────────────────────────────
  if (req.method === 'POST' && action === 'opt-in') {
    const authHeader = req.headers['authorization'];
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Sign in required' });
    }
    const token = authHeader.split(' ')[1];
    const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
    if (authErr || !user) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    const { phone, enabled = true, personId } = req.body || {};
    const normalizedPhone = phone ? normalizeWhatsAppNumber(phone) : null;

    if (phone && (!normalizedPhone || normalizedPhone.length < 9)) {
      return res.status(400).json({ error: 'Please enter a valid phone number with country code' });
    }

    // Update user record
    const updatePayload: Record<string, any> = {
      whatsapp_enabled: Boolean(enabled),
    };
    if (normalizedPhone) {
      updatePayload.whatsapp_phone = normalizedPhone;
    }

    const { error: updateErr } = await supabase
      .from('users')
      .update(updatePayload)
      .eq('id', user.id);

    if (updateErr) {
      console.error('[WhatsApp Opt-In] User update failed:', updateErr);
      return res.status(500).json({ error: 'Failed to update preferences' });
    }

    // If personId was provided, also ensure notify_whatsapp is set on follows
    if (personId) {
      await supabase
        .from('follows')
        .update({ notify_whatsapp: true })
        .eq('user_id', user.id)
        .eq('person_id', personId);
    }

    return res.status(200).json({
      success: true,
      whatsapp_phone: normalizedPhone,
      whatsapp_enabled: Boolean(enabled),
    });
  }

  // ── ADMIN TEST / TRIGGER MOVIE ALERT (POST) ────────────────────────────────
  if (req.method === 'POST' && action === 'trigger-alert') {
    const auth = await isValidAuth(req);
    if (!auth.valid) {
      return res.status(401).json({ error: 'Admin or Cron authentication required' });
    }

    const { filmId, title, slug, posterUrl, releaseType, customPlatformName } = req.body || {};
    if (!filmId) {
      return res.status(400).json({ error: 'filmId is required' });
    }

    // If film details weren't passed in body, fetch from DB
    let filmTitle = title;
    let filmSlug = slug;
    let filmPoster = posterUrl;
    let filmReleaseType = releaseType;

    if (!filmTitle) {
      const { data: film } = await supabase
        .from('films')
        .select('id, title, slug, poster_url, release_type')
        .eq('id', filmId)
        .single();

      if (!film) {
        return res.status(404).json({ error: 'Film not found' });
      }
      filmTitle = film.title;
      filmSlug = film.slug;
      filmPoster = film.poster_url;
      filmReleaseType = film.release_type;
    }

    const dispatchResult = await dispatchMovieWhatsAppAlerts({
      filmId,
      title: filmTitle,
      slug: filmSlug,
      posterUrl: filmPoster,
      releaseType: filmReleaseType,
      customPlatformName,
    });

    return res.status(200).json({
      success: true,
      result: dispatchResult,
    });
  }

  return res.status(404).json({ error: 'Unknown action' });
}
