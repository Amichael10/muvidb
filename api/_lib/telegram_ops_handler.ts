/**
 * Telegram webhook for ops commands (only TELEGRAM_CHAT_ID).
 * POST /api/telegram → /api/data?_r=telegram
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  answerTelegramCallback,
  getTelegramFileUrl,
  isAllowedOpsChat,
  sendTelegramMessage,
  sendTelegramPhoto,
  sendTelegramVideo,
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
import { generateAIContent } from './ai_service.js';
import { extractInstagramMedia } from './instagram_downloader.js';
import { createSocialDraftFromIntake } from './social_intake.js';

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
    'Content intake: forward a YouTube Short, social link, screenshot, review, poster, or video.',
    'The bot can return playable Shorts and prepare films, critic reviews, credits, news, and social drafts for admin approval.',
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

  if (data.startsWith('intake_download:')) {
    const eventId = data.slice('intake_download:'.length).trim();
    const { data: event } = await supabase
      .from('social_news_events')
      .select('*')
      .eq('id', eventId)
      .eq('source_type', 'telegram_bot')
      .maybeSingle();
    if (!event?.source_url) {
      await answerTelegramCallback(callbackId, 'Video source not found');
      return;
    }
    const existingMetadata = intakeMetadata(event.metadata);
    if (existingMetadata.telegram_video_file_id) {
      await answerTelegramCallback(callbackId, 'Sending saved video…');
      const resent = await sendTelegramVideo({
        video: existingMetadata.telegram_video_file_id,
        caption: `✅ ${event.title || 'Video ready'}\n\nYou can play or save this MP4 from Telegram.`,
        chatId: String(chatId),
      });
      if (!resent.ok && chatId) await reply(chatId, `⚠️ Telegram could not resend the saved video: ${resent.error || 'unknown error'}`);
      return;
    }
    await answerTelegramCallback(callbackId, 'Preparing playable video…');
    if (chatId) await reply(chatId, '⏳ Downloading and preparing the Short for Telegram…');
    try {
      const media = await extractRemoteMedia(event.source_url);
      const metadata = intakeMetadata(event.metadata);
      const sent = await sendTelegramVideo({
        video: media.video_url,
        caption: [
          `✅ ${media.title || event.title || 'Video ready'}`,
          media.author ? `Channel: ${media.author}` : null,
          '',
          'You can play or save this MP4 from Telegram. Only reuse media you own or have permission to publish.',
        ].filter(Boolean).join('\n'),
        chatId: String(chatId),
        replyMarkup: {
          inline_keyboard: [
            [{ text: '🎨 Create Social Post', callback_data: `intake_draft:${eventId}` }],
            [{ text: '📥 Open Approval Inbox', url: `${(process.env.VITE_PUBLIC_SITE_URL || process.env.PUBLIC_SITE_URL || 'https://muvidb.com').replace(/\/$/, '')}/admin/social-studio?tab=intake` }],
          ],
        },
      });
      if (!sent.ok) throw new Error(sent.error || 'Telegram could not receive the video');
      metadata.video_url = media.video_url;
      metadata.video_duration = media.duration || null;
      metadata.telegram_video_file_id = sent.fileId || null;
      metadata.telegram_video_message_id = sent.messageId || null;
      metadata.downloaded_at = new Date().toISOString();
      metadata.workflow_status = metadata.workflow_status || 'received';
      await supabase.from('social_news_events').update({ metadata, updated_at: new Date().toISOString() }).eq('id', eventId);
    } catch (error: any) {
      if (chatId) await reply(chatId, `⚠️ I couldn’t prepare this video. ${error?.message || 'The source may be private, restricted, or unavailable.'}`);
    }
    return;
  }

  if (data.startsWith('intake_film:') || data.startsWith('intake_review:')) {
    const isFilm = data.startsWith('intake_film:');
    const prefix = isFilm ? 'intake_film:' : 'intake_review:';
    const eventId = data.slice(prefix.length).trim();
    const label = isFilm ? 'film record' : 'critic review';
    await answerTelegramCallback(callbackId, `Preparing ${label}…`);
    if (chatId) await reply(chatId, `🔎 Extracting a structured ${label} for admin approval…`);
    try {
      const { payload } = await prepareStructuredIntake(eventId, isFilm ? 'film' : 'critic_review');
      const site = (process.env.VITE_PUBLIC_SITE_URL || process.env.PUBLIC_SITE_URL || 'https://muvidb.com').replace(/\/$/, '');
      const summary = isFilm
        ? [`🎞 *Film intake prepared*`, `Title: ${payload.title || 'Needs correction'}`, payload.year ? `Year: ${payload.year}` : null, payload.synopsis ? `Synopsis: ${String(payload.synopsis).slice(0, 260)}${String(payload.synopsis).length > 260 ? '…' : ''}` : 'Synopsis: Missing']
        : [`📝 *Critic review prepared*`, `Film: ${payload.film_title || 'Needs matching'}`, `Critic: ${payload.critic_name || 'Needs correction'}`, payload.quote ? `Quote: “${String(payload.quote).slice(0, 260)}${String(payload.quote).length > 260 ? '…' : ''}”` : 'Quote: Missing'];
      if (chatId) {
        await sendTelegramMessage({
          text: [...summary.filter(Boolean), '', 'Nothing is public yet. Review and approve it in the admin inbox.'].join('\n'),
          chatId: String(chatId),
          replyMarkup: { inline_keyboard: [[{ text: '✅ Open Approval Inbox', url: `${site}/admin/social-studio?tab=intake` }]] },
        });
      }
    } catch (error: any) {
      if (chatId) await reply(chatId, `⚠️ Could not prepare the ${label}: ${error?.message || 'Extraction failed'}`);
    }
    return;
  }

  if (data.startsWith('intake_ignore:')) {
    const eventId = data.slice('intake_ignore:'.length).trim();
    const { data: event } = await supabase.from('social_news_events').select('metadata').eq('id', eventId).maybeSingle();
    const metadata = intakeMetadata(event?.metadata);
    metadata.workflow_status = 'rejected';
    metadata.rejected_at = new Date().toISOString();
    metadata.rejection_reason = 'Ignored from Telegram';
    await supabase.from('social_news_events').update({ status: 'ignored', metadata, updated_at: new Date().toISOString() }).eq('id', eventId);
    await answerTelegramCallback(callbackId, 'Ignored');
    if (chatId) await reply(chatId, '🗑 Intake item ignored. You can still see it using the Rejected filter in the admin inbox.');
    return;
  }

  if (data.startsWith('intake_draft:')) {
    const eventId = data.slice('intake_draft:'.length).trim();
    const { data: event, error: evErr } = await supabase
      .from('social_news_events')
      .select('*')
      .eq('id', eventId)
      .maybeSingle();

    if (evErr || !event) {
      await answerTelegramCallback(callbackId, 'Event not found');
      return;
    }

    const existingDraftId = intakeMetadata(event.metadata).canonical_content_item_id || event.draft_id;
    if (existingDraftId) {
      const site = (process.env.VITE_PUBLIC_SITE_URL || process.env.PUBLIC_SITE_URL || 'https://muvidb.com').replace(/\/$/, '');
      await answerTelegramCallback(callbackId, 'Draft already exists');
      if (chatId) {
        await sendTelegramMessage({
          text: '🎨 A Social Studio draft already exists for this intake item.',
          chatId: String(chatId),
          replyMarkup: { inline_keyboard: [[{ text: 'Open Social Studio', url: `${site}/admin/social-studio` }]] },
        });
      }
      return;
    }

    await answerTelegramCallback(callbackId, '🎨 Generating draft with AI...');
    if (chatId) await reply(chatId, '⏳ Crafting social media headline, angle, and captions with AI...');

    try {
      const prompt = `You are the lead social media editor for MuviDB, the premier Nollywood and African cinema database.
Based on this intake item:
Title: ${event.title}
Source URL: ${event.source_url || 'N/A'}
Content/Context: ${event.description}

Generate a high-converting, engaging social media pack for MuviDB:
1. headline: Punchy, exciting, cinema-focused headline (max 10 words)
2. angle: Why fans or the industry care (1-2 sentences)
3. instagram_caption: An engaging storytelling caption with no more than 3 relevant hashtags
4. facebook_caption: A conversational Facebook caption with no more than 3 hashtags
5. threads_post: A concise Threads post under 450 characters with no more than 3 hashtags
6. tiktok_caption: A short TikTok caption with no more than 3 hashtags

Respond ONLY with a valid JSON object matching this schema:
{
  "headline": "...",
  "angle": "...",
  "instagram_caption": "...",
  "facebook_caption": "...",
  "threads_post": "...",
  "tiktok_caption": "..."
}`;

      const aiRes = await generateAIContent(prompt);
      let aiJson: any = {};
      try {
        const cleaned = (aiRes.text || '').replace(/```json/g, '').replace(/```/g, '').trim();
        aiJson = JSON.parse(cleaned);
      } catch {
        aiJson = {
          headline: event.title,
          angle: String(event.description || '').slice(0, 150),
          instagram_caption: `${event.description || event.title}\n\n#Nollywood #AfricanCinema #MuviDB`,
          facebook_caption: `${event.description || event.title}\n\n#Nollywood #AfricanCinema #MuviDB`,
          threads_post: event.title,
          tiktok_caption: `${event.title}\n\n#Nollywood #AfricanCinema #MuviDB`,
        };
      }

      await createSocialDraftFromIntake({ intakeId: eventId, captions: aiJson });

      const site = (process.env.VITE_PUBLIC_SITE_URL || process.env.PUBLIC_SITE_URL || 'https://muvidb.com').replace(/\/$/, '');
      const studioUrl = `${site}/admin/social-studio`;

      const responseText = [
        '✨ Social Draft Created!',
        '',
        `📌 *Headline:* ${aiJson.headline || event.title}`,
        `💡 *Angle:* ${aiJson.angle || 'Latest Nollywood Update'}`,
        '',
        '📱 *Instagram Caption:*',
        aiJson.instagram_caption || '',
        '',
        '🧵 *Threads / X Post:*',
        aiJson.threads_post || '',
      ].join('\n');

      if (chatId) {
        await sendTelegramMessage({
          text: responseText,
          chatId: String(chatId),
          replyMarkup: {
            inline_keyboard: [
              [{ text: '🎨 Open Editable Draft', url: `${studioUrl}?tab=drafts` }],
            ],
          },
        });
      }
    } catch (e: any) {
      if (chatId) await reply(chatId, `⚠️ AI Draft generation failed: ${e.message}`);
    }
    return;
  }

  if (data.startsWith('intake_news:')) {
    const eventId = data.slice('intake_news:'.length).trim();
    const { data: event } = await supabase.from('social_news_events').select('metadata').eq('id', eventId).maybeSingle();
    const metadata = intakeMetadata(event?.metadata);
    metadata.intake_kind = 'news';
    metadata.workflow_status = 'needs_review';
    await supabase.from('social_news_events').update({ status: 'new', metadata, updated_at: new Date().toISOString() }).eq('id', eventId);
    await answerTelegramCallback(callbackId, '✅ Saved to News Opportunities');
    if (chatId) {
      const site = (process.env.VITE_PUBLIC_SITE_URL || process.env.PUBLIC_SITE_URL || 'https://muvidb.com').replace(/\/$/, '');
      await sendTelegramMessage({
        text: '📰 Added to the Content & News Opportunities queue in Social Studio.',
        chatId: String(chatId),
        replyMarkup: {
          inline_keyboard: [[{ text: '🌐 View in Social Studio', url: `${site}/admin/social-studio` }]],
        },
      });
    }
    return;
  }

  if (data.startsWith('intake_credits:')) {
    const eventId = data.slice('intake_credits:'.length).trim();
    await answerTelegramCallback(callbackId, 'Extracting cast & crew...');
    if (chatId) await reply(chatId, '🔍 Preparing cast and crew as a structured approval item…');

    try {
      const { payload } = await prepareStructuredIntake(eventId, 'credits');
      const credits = Array.isArray(payload.credits) ? payload.credits : [];
      const lines = credits.slice(0, 20).map((credit: any) => `• ${credit.name || 'Unknown'} — ${credit.role || 'Role needed'}${credit.character_name ? ` (${credit.character_name})` : ''}`);
      const site = (process.env.VITE_PUBLIC_SITE_URL || process.env.PUBLIC_SITE_URL || 'https://muvidb.com').replace(/\/$/, '');
      if (chatId) {
        await sendTelegramMessage({
          text: [`🎭 *Credit intake prepared*`, `Film: ${payload.film_title || 'Needs matching'}`, '', ...(lines.length ? lines : ['No definite credits were found.']), '', 'Review and match these names before anything is added.'].join('\n'),
          chatId: String(chatId),
          replyMarkup: { inline_keyboard: [[{ text: '✅ Open Approval Inbox', url: `${site}/admin/social-studio?tab=intake` }]] },
        });
      }
    } catch (e: any) {
      if (chatId) await reply(chatId, `⚠️ Credit extraction failed: ${e.message}`);
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

function cleanInstagramImageUrl(url: string | null): string | null {
  if (!url) return null;
  let cleaned = url.replace(/&amp;/g, '&');
  // Strip out dynamic cropping instructions from Meta CDN so the flyer/poster is not cropped into a square
  cleaned = cleaned.replace(/stp=c\d+\.\d+\.\d+\.\d+a_dst-jpg/g, 'stp=dst-jpg');
  cleaned = cleaned.replace(/_s\d+x\d+_/g, '_');
  return cleaned;
}

function decodeHtmlEntities(str: string): string {
  if (!str) return '';
  return str
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&#039;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#064;/g, '@')
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => {
      try {
        return String.fromCodePoint(parseInt(hex, 16));
      } catch {
        return '';
      }
    })
    .replace(/&#([0-9]+);/g, (_, dec) => {
      try {
        return String.fromCodePoint(parseInt(dec, 10));
      } catch {
        return '';
      }
    });
}

function intakeMetadata(value: unknown): Record<string, any> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? { ...(value as Record<string, any>) }
    : {};
}

function parseAiJson(text: string): Record<string, any> {
  const cleaned = String(text || '')
    .replace(/```(?:json)?/gi, '')
    .replace(/```/g, '')
    .trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start < 0 || end <= start) throw new Error('AI returned an unreadable response');
  return JSON.parse(cleaned.slice(start, end + 1));
}

async function extractRemoteMedia(url: string) {
  const extractorUrl = (process.env.MEDIA_EXTRACTOR_URL || process.env.RENDER_EXTRACTOR_URL || 'https://muvidb.onrender.com').replace(/\/$/, '');
  const extractorSecret = (process.env.EXTRACTOR_SECRET || '').trim();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (extractorSecret) headers.Authorization = `Bearer ${extractorSecret}`;
  const response = await fetch(`${extractorUrl}/extract`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ url }),
    signal: AbortSignal.timeout(25_000),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.success || !data.video_url) {
    throw new Error(data.error || data.detail || 'The video could not be prepared');
  }
  return data as {
    video_url: string;
    image_url?: string | null;
    title?: string | null;
    caption?: string | null;
    author?: string | null;
    duration?: number | null;
  };
}

async function prepareStructuredIntake(eventId: string, kind: 'film' | 'critic_review' | 'credits') {
  const { data: event, error } = await supabase
    .from('social_news_events')
    .select('*')
    .eq('id', eventId)
    .eq('source_type', 'telegram_bot')
    .maybeSingle();
  if (error) throw error;
  if (!event) throw new Error('Intake item not found');

  const metadata = intakeMetadata(event.metadata);
  metadata.intake_kind = kind;
  metadata.workflow_status = 'processing';
  await supabase.from('social_news_events').update({ metadata }).eq('id', eventId);

  const context = [
    `Title: ${event.title || ''}`,
    `Text: ${event.description || ''}`,
    `Source: ${event.source_url || ''}`,
    `Account: ${metadata.author_name || metadata.from_user || ''}`,
  ].join('\n');

  let prompt = '';
  if (kind === 'film') {
    prompt = `Extract a possible African film or series record from this forwarded source. Do not invent facts. Use null for anything not present.\n${context}\n\nReturn ONLY JSON with: {"title":string|null,"year":number|null,"synopsis":string|null,"genres":string[],"runtime_minutes":number|null,"release_date":string|null,"status":"released"|"upcoming"|"announced"|"filming"|null,"content_type":"movie"|"series"|null,"countries":string[],"platform":string|null,"cast":string[],"crew":[{"name":string,"role":string}],"poster_url":string|null}`;
  } else if (kind === 'critic_review') {
    prompt = `Extract a film critic review from this forwarded source. Preserve one concise review quote exactly when possible and do not invent a rating. Use null for unknown fields.\n${context}\n\nReturn ONLY JSON with: {"film_title":string|null,"film_id":null,"critic_name":string|null,"critic_title":string|null,"publication":string|null,"quote":string|null,"rating":number|null,"rating_scale":number|null,"review_url":string|null,"is_anonymous":false,"is_featured":true}`;
  } else {
    prompt = `Extract film credits from this forwarded source. Do not invent names or roles.\n${context}\n\nReturn ONLY JSON with: {"film_title":string|null,"film_id":null,"credits":[{"name":string,"role":string,"character_name":string|null}],"notes":string|null}`;
  }

  try {
    const ai = await generateAIContent(prompt);
    const payload = parseAiJson(ai.text || '');
    if (kind === 'film' && !payload.poster_url && metadata.image_url) payload.poster_url = metadata.image_url;
    if (kind === 'critic_review' && !payload.review_url) payload.review_url = event.source_url;
    metadata.extracted_payload = payload;
    metadata.workflow_status = 'needs_review';
    metadata.extracted_at = new Date().toISOString();
    await supabase
      .from('social_news_events')
      .update({
        event_type: kind === 'film' ? 'movie_announcement' : kind,
        status: 'new',
        metadata,
        updated_at: new Date().toISOString(),
      })
      .eq('id', eventId);
    return { event, payload };
  } catch (error: any) {
    metadata.workflow_status = 'failed';
    metadata.processing_error = String(error?.message || error).slice(0, 1000);
    await supabase.from('social_news_events').update({ metadata, updated_at: new Date().toISOString() }).eq('id', eventId);
    throw error;
  }
}

async function resolveIntakeMetadata(sourceUrl: string | null, rawText: string) {
  let title = '';
  let description = rawText || '';
  let platformLabel = 'Direct Submission';
  let eventType = 'manual';
  let authorName: string | null = null;
  let imageUrl: string | null = null;
  let videoUrl: string | null = null;

  if (sourceUrl) {
    if (/instagram\.com/i.test(sourceUrl)) {
      try {
        const igMedia = await extractInstagramMedia(sourceUrl);
        eventType = igMedia.isReel ? 'instagram_reel' : 'instagram_post';
        platformLabel = igMedia.isReel ? 'Instagram Reel' : 'Instagram';
        title = igMedia.title;
        if (igMedia.caption) description = igMedia.caption;
        if (igMedia.authorName) authorName = igMedia.authorName;
        if (igMedia.imageUrl) imageUrl = igMedia.imageUrl;
        if (igMedia.videoUrl) videoUrl = igMedia.videoUrl;
      } catch (err: any) {
        console.warn('[resolveIntakeMetadata] Instagram scrape warning:', err.message);
        eventType = 'instagram_post';
        platformLabel = 'Instagram';
        title = 'Instagram Post';
      }
    } else if (/threads\.net/i.test(sourceUrl)) {
      eventType = 'threads_post';
      platformLabel = 'Threads';
      try {
        const res = await fetch(sourceUrl, {
          headers: {
            'User-Agent': 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)',
            'Accept': 'text/html,application/xhtml+xml',
            'Accept-Language': 'en-US,en;q=0.9',
          },
          signal: AbortSignal.timeout(5000),
        });
        if (res.ok) {
          const html = await res.text();
          const ogTitle =
            html.match(/<meta property="og:title" content="([^"]*)"/i)?.[1] ||
            html.match(/<title>([^<]*)<\/title>/i)?.[1];
          const ogDesc =
            html.match(/<meta property="og:description" content="([^"]*)"/i)?.[1] ||
            html.match(/<meta name="description" content="([^"]*)"/i)?.[1];
          const ogImg = html.match(/<meta property="og:image" content="([^"]*)"/i)?.[1];

          if (ogTitle) {
            const decoded = decodeHtmlEntities(ogTitle);
            const author = decoded.match(/^([^:]+?)\s+on\s+Threads/i) || decoded.match(/^([^(]+)\s*\(@/);
            if (author) authorName = author[1].trim();
            title = decoded;
          }
          if (ogDesc) {
            const decodedDesc = decodeHtmlEntities(ogDesc);
            if (decodedDesc.length > 10 && !decodedDesc.includes('Join Threads to share')) {
              description = decodedDesc;
            }
          }
          if (ogImg && !ogImg.includes('static.cdninstagram.com')) {
            imageUrl = ogImg.replace(/&amp;/g, '&');
          }
        }
      } catch (err: any) {
        console.warn('[resolveIntakeMetadata] Threads scrape warning:', err.message);
      }
      if (!title) title = authorName ? `${authorName} on Threads` : 'Threads Post';
    } else if (/youtube\.com|youtu\.be/i.test(sourceUrl)) {
      eventType = 'youtube_video';
      platformLabel = 'YouTube';
      try {
        const oembed = await fetch(
          `https://www.youtube.com/oembed?url=${encodeURIComponent(sourceUrl)}&format=json`,
        ).then((r) => r.json());
        if (oembed) {
          title = oembed.title || 'YouTube Video';
          authorName = oembed.author_name || null;
          imageUrl = oembed.thumbnail_url || null;
        }
      } catch {}
      if (!title) title = 'YouTube Video';
    } else if (/twitter\.com|x\.com/i.test(sourceUrl)) {
      eventType = 'x_post';
      platformLabel = 'X / Twitter';
      try {
        const oembed = await fetch(
          `https://publish.twitter.com/oembed?url=${encodeURIComponent(sourceUrl)}`,
        ).then((r) => r.json());
        if (oembed) {
          authorName = oembed.author_name || null;
          const tweetText = (oembed.html || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
          title = authorName ? `Post by ${authorName}` : 'X / Twitter Post';
          if (tweetText) description = decodeHtmlEntities(tweetText);
        }
      } catch {}
      if (!title) title = 'X / Twitter Post';
    } else if (/tiktok\.com/i.test(sourceUrl)) {
      eventType = 'tiktok_post';
      platformLabel = 'TikTok';
      title = 'TikTok Video';
    } else {
      eventType = 'web_link';
      platformLabel = 'Web Article';
      try {
        const res = await fetch(sourceUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; MuviDBBot/1.0; +https://muvidb.com)',
            'Accept': 'text/html,application/xhtml+xml',
          },
          signal: AbortSignal.timeout(5000),
        });
        if (res.ok) {
          const html = await res.text();
          const ogTitle =
            html.match(/<meta property="og:title" content="([^"]*)"/i)?.[1] ||
            html.match(/<title>([^<]*)<\/title>/i)?.[1];
          const ogDesc =
            html.match(/<meta property="og:description" content="([^"]*)"/i)?.[1] ||
            html.match(/<meta name="description" content="([^"]*)"/i)?.[1];
          const ogImg = html.match(/<meta property="og:image" content="([^"]*)"/i)?.[1];
          if (ogTitle) title = decodeHtmlEntities(ogTitle.trim());
          if (ogDesc) description = decodeHtmlEntities(ogDesc.trim());
          if (ogImg) imageUrl = ogImg.trim();
        }
      } catch {}
      if (!title) title = 'Web Article';
    }
  }

  if (!title) {
    title = rawText.slice(0, 80).split('\n')[0] || 'Direct Note';
  }

  return { eventType, platformLabel, title, description, authorName, imageUrl, videoUrl };
}

async function handleSocialIntake(chatId: string | number, message: any) {
  const text = String(message.text || message.caption || '').trim();
  const photo = Array.isArray(message.photo) && message.photo.length > 0
    ? message.photo[message.photo.length - 1]
    : null;
  const directVideo = message.video || null;

  // Extract URLs if present
  const urlMatch = text.match(/https?:\/\/[^\s]+/i);
  const sourceUrl = urlMatch ? urlMatch[0] : null;

  const meta = await resolveIntakeMetadata(sourceUrl, text);

  if (photo && !meta.imageUrl) {
    meta.imageUrl = await getTelegramFileUrl(photo.file_id);
    if (!sourceUrl) {
      meta.eventType = 'image_upload';
      meta.platformLabel = 'Photo / Screenshot';
      if (!text) meta.title = 'Photo forwarded from Telegram';
    }
  } else if (directVideo && !meta.videoUrl) {
    meta.videoUrl = await getTelegramFileUrl(directVideo.file_id);
    if (!sourceUrl) {
      meta.eventType = 'video_upload';
      meta.platformLabel = 'Video Clip';
      if (!text) meta.title = 'Video forwarded from Telegram';
    }
  }

  const { data: newEvent, error } = await supabase
    .from('social_news_events')
    .insert({
      event_type: meta.eventType,
      title: meta.title.slice(0, 200),
      description: meta.description || text || (photo ? 'Photo forwarded via Telegram' : ''),
      source_type: 'telegram_bot',
      source_url: sourceUrl,
      urgency: 'high',
      status: 'new',
      metadata: {
        intake_kind: 'unclassified',
        workflow_status: 'received',
        telegram_message_id: message.message_id,
        from_user: message.from?.username || message.from?.first_name || 'Admin',
        forward_from: message.forward_from?.username || message.forward_from_chat?.title || null,
        has_photo: Boolean(photo),
        photo_file_id: photo?.file_id || null,
        video_file_id: directVideo?.file_id || null,
        image_url: meta.imageUrl,
        video_url: meta.videoUrl,
        raw_text: text,
        author_name: meta.authorName,
        received_at: new Date().toISOString(),
      },
    })
    .select('id')
    .single();

  if (error || !newEvent) {
    console.error('[telegram_social_intake] DB insert failed:', error?.message);
    await reply(chatId, `⚠️ Failed to save intake: ${error?.message || 'DB error'}`);
    return;
  }

  const site = (process.env.VITE_PUBLIC_SITE_URL || process.env.PUBLIC_SITE_URL || 'https://muvidb.com').replace(/\/$/, '');
  const adminUrl = `${site}/admin/social-studio`;

  const isLongCaption = meta.description && meta.description.length > 280;
  const snippet = isLongCaption ? meta.description.slice(0, 280) + '…' : meta.description;

  const promptMsg = [
    `📥 *New ${meta.platformLabel} Captured!*`,
    '',
    `📌 *Title:* ${meta.title}`,
    meta.authorName ? `👤 *Account:* ${meta.authorName}` : null,
    snippet ? `📝 *Caption:* "${snippet}"` : null,
    sourceUrl ? `🔗 *Link:* ${sourceUrl}` : null,
    '',
    '👇 *What would you like to do with this?*',
  ]
    .filter(Boolean)
    .join('\n');

  const inlineKeyboard = [
    ...(/(?:youtube\.com|youtu\.be)/i.test(sourceUrl || '')
      ? [[{ text: '▶️ Get Playable Video', callback_data: `intake_download:${newEvent.id}` }]]
      : []),
    [{ text: '🎨 Create Editable Social Draft', callback_data: `intake_draft:${newEvent.id}` }],
    [
      { text: '🎞 Prepare Film', callback_data: `intake_film:${newEvent.id}` },
      { text: '📝 Add Critic Review', callback_data: `intake_review:${newEvent.id}` },
    ],
    [
      { text: '🎭 Extract Credits', callback_data: `intake_credits:${newEvent.id}` },
      { text: '📰 Save as News', callback_data: `intake_news:${newEvent.id}` },
    ],
    [
      { text: '📥 Approval Inbox', url: `${adminUrl}?tab=intake` },
      { text: '🗑 Ignore', callback_data: `intake_ignore:${newEvent.id}` },
    ],
  ];

  if (meta.videoUrl) {
    await sendTelegramVideo({
      video: meta.videoUrl,
      caption: promptMsg,
      chatId: String(chatId),
      replyMarkup: { inline_keyboard: inlineKeyboard },
    });
  } else if (meta.imageUrl) {
    await sendTelegramPhoto({
      photo: meta.imageUrl,
      caption: promptMsg,
      chatId: String(chatId),
      replyMarkup: { inline_keyboard: inlineKeyboard },
    });
  } else {
    await sendTelegramMessage({
      text: promptMsg,
      chatId: String(chatId),
      disablePreview: false,
      replyMarkup: { inline_keyboard: inlineKeyboard },
    });
  }

  // If caption was long, deliver full unabridged text immediately so no text is lost
  if (isLongCaption) {
    await sendTelegramMessage({
      text: `📜 *Full Extracted Caption:*\n\n${meta.description}`,
      chatId: String(chatId),
      disablePreview: true,
    });
  }
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
    if (!message) {
      return res.status(200).json({ ok: true });
    }

    const chatId = message.chat?.id;
    if (!isAllowedOpsChat(chatId)) {
      // Silent ignore — do not leak that a bot exists to other chats
      return res.status(200).json({ ok: true });
    }

    const text = String(message.text || message.caption || '').trim();
    if (text.startsWith('/')) {
      await handleCommand(chatId, text);
    } else if (text || message.photo || message.video || message.document) {
      await handleSocialIntake(chatId, message);
    }

    return res.status(200).json({ ok: true });
  } catch (err: any) {
    console.error('[telegram_ops]', err?.message || err);
    // Always 200 to Telegram so it does not retry forever
    return res.status(200).json({ ok: false });
  }
}
