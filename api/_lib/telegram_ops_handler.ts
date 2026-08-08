/**
 * Telegram webhook for ops commands (only TELEGRAM_CHAT_ID).
 * POST /api/telegram → /api/data?_r=telegram
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  answerTelegramCallback,
  isAllowedOpsChat,
  sendTelegramMessage,
  telegramConfigured,
} from './telegram.js';
import {
  allowIp,
  blockIp,
  listAllowlistedIps,
  listBlockedIps,
  unallowIp,
  unblockIp,
} from './ip_blocklist.js';
import { recentHitsForIp, topHitters } from './scrape_guard.js';
import { supabase } from './supabase.js';

const IP_RE = /^(?:\d{1,3}\.){3}\d{1,3}$|^(?:[a-fA-F0-9:]+)$/;

function verifyWebhookSecret(req: VercelRequest): boolean {
  const expected = (process.env.TELEGRAM_WEBHOOK_SECRET || '').trim();
  if (!expected) return true; // optional until setWebhook is run with secret
  const got = String(req.headers['x-telegram-bot-api-secret-token'] || '');
  return got === expected;
}

function helpText() {
  return [
    'MuviDB ops bot (you only)',
    '',
    '/block <ip> — refuse SSR + public API for this IP',
    '/unblock <ip> — remove from blocklist',
    '/allow <ip> — whitelist (no alerts, cannot block)',
    '/unallow <ip> — remove from whitelist',
    '/allowed — list whitelisted IPs',
    '/hits [ip] — recent scrape buckets (or top offenders)',
    '/blocked — list blocked IPs',
    '/help — this message',
    '',
    'YouTube: new film-length uploads alert here before auto-import.',
    'Use Hide on the alert to skip a video on the next sync.',
    '',
    'Tip: browse muvidb.com, then /hits to find your home IP → /allow <ip>',
  ].join('\n');
}

async function reply(chatId: string | number, text: string) {
  await sendTelegramMessage({ text, chatId: String(chatId) });
}

async function handleCommand(chatId: string | number, text: string) {
  const parts = text.trim().split(/\s+/);
  const cmd = (parts[0] || '').split('@')[0].toLowerCase();
  const arg = parts.slice(1).join(' ').trim();

  if (cmd === '/start' || cmd === '/help') {
    await reply(chatId, helpText());
    return;
  }

  if (cmd === '/block') {
    const ip = arg.split(/\s+/)[0];
    if (!ip || !IP_RE.test(ip)) {
      await reply(chatId, 'Usage: /block <ip>');
      return;
    }
    const result = await blockIp({ ip, reason: 'Telegram /block', blockedBy: 'telegram' });
    await reply(
      chatId,
      result.ok
        ? `Blocked ${ip}. SSR and public API will refuse this IP within ~30s.`
        : `Failed to block: ${result.error}`,
    );
    return;
  }

  if (cmd === '/unblock') {
    const ip = arg.split(/\s+/)[0];
    if (!ip || !IP_RE.test(ip)) {
      await reply(chatId, 'Usage: /unblock <ip>');
      return;
    }
    const result = await unblockIp(ip);
    await reply(
      chatId,
      result.ok ? `Unblocked ${ip}.` : `Failed to unblock: ${result.error}`,
    );
    return;
  }

  if (cmd === '/blocked') {
    const rows = await listBlockedIps(25);
    if (!rows.length) {
      await reply(chatId, 'No IPs currently blocked.');
      return;
    }
    const lines = rows.map((r) => {
      const when = r.created_at ? new Date(r.created_at).toISOString().slice(0, 16) : '?';
      return `• ${r.ip} (${when}${r.reason ? ` — ${r.reason}` : ''})`;
    });
    await reply(chatId, `Blocked IPs (${rows.length}):\n${lines.join('\n')}`);
    return;
  }

  if (cmd === '/allow' || cmd === '/whitelist') {
    const ip = arg.split(/\s+/)[0];
    if (!ip || !IP_RE.test(ip)) {
      await reply(chatId, 'Usage: /allow <ip>\nBrowse the site, run /hits, then allow your home IP.');
      return;
    }
    const note = arg.split(/\s+/).slice(1).join(' ') || 'home/trusted';
    const result = await allowIp({ ip, note });
    await reply(
      chatId,
      result.ok
        ? `Allowlisted ${ip}. No scrape alerts; /block will refuse this IP.`
        : `Failed to allow: ${result.error}`,
    );
    return;
  }

  if (cmd === '/unallow' || cmd === '/unwhitelist') {
    const ip = arg.split(/\s+/)[0];
    if (!ip || !IP_RE.test(ip)) {
      await reply(chatId, 'Usage: /unallow <ip>');
      return;
    }
    const result = await unallowIp(ip);
    await reply(
      chatId,
      result.ok ? `Removed ${ip} from allowlist.` : `Failed: ${result.error}`,
    );
    return;
  }

  if (cmd === '/allowed' || cmd === '/allowlist') {
    const rows = await listAllowlistedIps(25);
    const envRaw = (process.env.SCRAPE_IP_ALLOWLIST || '').trim();
    const envLines = envRaw
      ? envRaw.split(',').map((s) => s.trim()).filter(Boolean).map((ip) => `• ${ip} (env)`)
      : [];
    if (!rows.length && !envLines.length) {
      await reply(chatId, 'No allowlisted IPs. Browse muvidb.com → /hits → /allow <ip>');
      return;
    }
    const dbLines = rows.map((r) => {
      const when = r.created_at ? new Date(r.created_at).toISOString().slice(0, 16) : '?';
      return `• ${r.ip} (${when}${r.note ? ` — ${r.note}` : ''})`;
    });
    await reply(chatId, `Allowlisted IPs:\n${[...envLines, ...dbLines].join('\n')}`);
    return;
  }

  if (cmd === '/hits') {
    if (arg && IP_RE.test(arg.split(/\s+/)[0])) {
      const ip = arg.split(/\s+/)[0];
      const rows = await recentHitsForIp(ip, 5);
      if (!rows.length) {
        await reply(chatId, `No recent buckets for ${ip}.`);
        return;
      }
      const lines = rows.map((r: any) => {
        const paths = (r.sample_paths || []).slice(0, 4).join(', ');
        return `• ${r.hits} hits @ ${r.window_start}\n  ${paths || '(no paths)'}`;
      });
      await reply(chatId, `Hits for ${ip}:\n${lines.join('\n')}`);
      return;
    }

    const rows = await topHitters(10);
    if (!rows.length) {
      await reply(chatId, 'No recent hit buckets.');
      return;
    }
    const lines = rows.map(
      (r: any) => `• ${r.ip} — ${r.hits} hits\n  ${(r.sample_paths || []).slice(0, 3).join(', ')}`,
    );
    await reply(chatId, `Top hitters (~15 min):\n${lines.join('\n')}`);
    return;
  }

  await reply(chatId, `Unknown command. ${helpText()}`);
}

async function handleCallback(query: any) {
  const chatId = query?.message?.chat?.id;
  const data = String(query?.data || '');
  const callbackId = query?.id;

  if (!isAllowedOpsChat(chatId)) {
    await answerTelegramCallback(callbackId, 'Not authorized');
    return;
  }

  if (data.startsWith('block:')) {
    const ip = data.slice('block:'.length).trim();
    const result = await blockIp({ ip, reason: 'Telegram inline block', blockedBy: 'telegram' });
    await answerTelegramCallback(callbackId, result.ok ? `Blocked ${ip}` : 'Block failed');
    if (chatId) {
      await reply(
        chatId,
        result.ok ? `🚫 Blocked ${ip}` : `Failed to block ${ip}: ${result.error}`,
      );
    }
    return;
  }

  if (data.startsWith('allow:')) {
    const ip = data.slice('allow:'.length).trim();
    const result = await allowIp({ ip, note: 'Telegram inline allow' });
    await answerTelegramCallback(callbackId, result.ok ? `Allowlisted ${ip}` : 'Allow failed');
    if (chatId) {
      await reply(
        chatId,
        result.ok ? `✅ Allowlisted ${ip}` : `Failed to allow ${ip}: ${result.error}`,
      );
    }
    return;
  }

  if (data.startsWith('hide_yt:')) {
    const parts = data.slice('hide_yt:'.length).split(':');
    const channelId = parts[0]?.trim();
    const videoId = parts.slice(1).join(':').trim();
    if (!channelId || !videoId) {
      await answerTelegramCallback(callbackId, 'Invalid hide payload');
      return;
    }
    const { error } = await supabase
      .from('channel_videos')
      .upsert(
        {
          channel_id: channelId,
          video_id: videoId,
          title: '(hidden via Telegram)',
          is_hidden: true,
          match_status: 'rejected',
        },
        { onConflict: 'channel_id,video_id' },
      );
    await answerTelegramCallback(callbackId, error ? 'Hide failed' : 'Hidden — sync will skip');
    if (chatId) {
      await reply(
        chatId,
        error
          ? `Failed to hide ${videoId}: ${error.message}`
          : `🙈 Hidden ${videoId}. It will not auto-import on the next sync.`,
      );
    }
    return;
  }

  if (data.startsWith('ignore:')) {
    const ip = data.slice('ignore:'.length).trim();
    // Stretch cooldown so we don't re-alert for 30m
    await supabase.from('scrape_alert_log').upsert({
      ip,
      last_alert_at: new Date().toISOString(),
      last_hits: 0,
      last_message: 'Ignored via Telegram',
    });
    await answerTelegramCallback(callbackId, `Ignored ${ip} for ~30m`);
    if (chatId) await reply(chatId, `Ignored alerts for ${ip} (cooldown refreshed).`);
    return;
  }

  await answerTelegramCallback(callbackId, 'Unknown action');
}

export async function handleTelegramOps(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'GET') {
    return res.status(200).json({
      ok: true,
      configured: telegramConfigured(),
      hint: 'Telegram posts updates here. Use scripts/set_telegram_webhook.ts to register.',
    });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!telegramConfigured()) {
    return res.status(503).json({ error: 'Telegram not configured' });
  }

  if (!verifyWebhookSecret(req)) {
    return res.status(401).json({ error: 'Invalid webhook secret' });
  }

  const update = req.body || {};

  try {
    if (update.callback_query) {
      await handleCallback(update.callback_query);
      return res.status(200).json({ ok: true });
    }

    const message = update.message || update.edited_message;
    if (!message?.text) {
      return res.status(200).json({ ok: true });
    }

    const chatId = message.chat?.id;
    if (!isAllowedOpsChat(chatId)) {
      // Silent ignore — do not leak that a bot exists to other chats
      return res.status(200).json({ ok: true });
    }

    const text = String(message.text || '');
    if (text.startsWith('/')) {
      await handleCommand(chatId, text);
    }

    return res.status(200).json({ ok: true });
  } catch (err: any) {
    console.error('[telegram_ops]', err?.message || err);
    // Always 200 to Telegram so it does not retry forever
    return res.status(200).json({ ok: false });
  }
}
