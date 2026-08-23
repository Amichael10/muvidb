/**
 * Telegram webhook for ops commands (only TELEGRAM_CHAT_ID).
 * POST /api/telegram → /api/data?_r=telegram
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  answerTelegramCallback,
  isAllowedOpsChat,
  sendTelegramMessage,
  sendTelegramPhoto,
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
3. instagram_caption: An engaging storytelling caption with 5-8 relevant hashtags like #Nollywood #AfricanCinema #MuviDB
4. x_post: Punchy Twitter/X post under 250 characters with emojis

Respond ONLY with a valid JSON object matching this schema:
{
  "headline": "...",
  "angle": "...",
  "instagram_caption": "...",
  "x_post": "..."
}`;

      const aiRes = await generateAIContent(prompt);
      let aiJson: any = {};
      try {
        const cleaned = (aiRes.text || '').replace(/```json/g, '').replace(/```/g, '').trim();
        aiJson = JSON.parse(cleaned);
      } catch {
        aiJson = {
          headline: event.title,
          angle: event.description.slice(0, 150),
          instagram_caption: `${event.description}\n\n#Nollywood #AfricanCinema #MuviDB`,
          x_post: event.title,
        };
      }

      const { data: draft, error: draftErr } = await supabase
        .from('social_drafts')
        .insert({
          status: 'draft',
          angle_json: {
            id: 1,
            title: aiJson.headline || event.title,
            reason: aiJson.angle || event.description,
            confidence: 'High',
          },
          content_json: {
            headline: aiJson.headline || event.title,
            subheadline: aiJson.angle || '',
            instagram: { caption: aiJson.instagram_caption || '' },
            x: { post: aiJson.x_post || '' },
            threads: { post: aiJson.x_post || '' },
          },
          figma_template_key: 'breaking_news',
        })
        .select('id')
        .single();

      if (draftErr) throw draftErr;

      await supabase
        .from('social_news_events')
        .update({ status: 'converted_to_draft', draft_id: draft.id })
        .eq('id', eventId);

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
        aiJson.x_post || '',
      ].join('\n');

      if (chatId) {
        await sendTelegramMessage({
          text: responseText,
          chatId: String(chatId),
          replyMarkup: {
            inline_keyboard: [
              [{ text: '🎨 Open in Social Studio', url: studioUrl }],
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
    await supabase.from('social_news_events').update({ status: 'reviewed' }).eq('id', eventId);
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
    const { data: event } = await supabase.from('social_news_events').select('*').eq('id', eventId).maybeSingle();
    await answerTelegramCallback(callbackId, 'Extracting cast & crew...');
    if (chatId) await reply(chatId, '🔍 Scanning text for Nollywood cast, director, and film references with AI...');

    try {
      const prompt = `Extract all movie titles, actor names, directors, producers, and character roles mentioned in this text:
"${event?.description || event?.title || ''}"

Return a clear markdown list of discovered films and people with their respective roles.`;
      const res = await generateAIContent(prompt);
      if (chatId) {
        await reply(chatId, `🎭 Extracted Credits & Names:\n\n${res.text || 'No specific cast/crew names identified.'}`);
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

async function resolveIntakeMetadata(sourceUrl: string | null, rawText: string) {
  let title = '';
  let description = rawText || '';
  let platformLabel = 'Direct Submission';
  let eventType = 'manual';
  let authorName: string | null = null;
  let imageUrl: string | null = null;

  if (sourceUrl) {
    if (/instagram\.com/i.test(sourceUrl)) {
      eventType = 'instagram_post';
      platformLabel = 'Instagram';
      const match = sourceUrl.match(/instagram\.com\/(?:p|reel|tv)\/([^/?#&]+)/i);
      const shortcode = match ? match[1] : '';

      try {
        const cleanUrl = shortcode ? `https://www.instagram.com/p/${shortcode}/` : sourceUrl;
        const res = await fetch(cleanUrl, {
          headers: {
            'User-Agent':
              'Mozilla/5.0 (iPhone; CPU iPhone OS 16_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.5 Mobile/15E148 Safari/604.1',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9',
          },
          signal: AbortSignal.timeout(6000),
        });

        if (res.ok) {
          const html = await res.text();
          const ogTitle =
            html.match(/<meta property="og:title" content="([^"]*)"/i)?.[1] ||
            html.match(/content="([^"]*)"\s+property="og:title"/i)?.[1];
          const ogDesc =
            html.match(/<meta property="og:description" content="([^"]*)"/i)?.[1] ||
            html.match(/<meta name="description" content="([^"]*)"/i)?.[1] ||
            html.match(/content="([^"]*)"\s+property="og:description"/i)?.[1];
          const ogImg =
            html.match(/<meta property="og:image" content="([^"]*)"/i)?.[1] ||
            html.match(/content="([^"]*)"\s+property="og:image"/i)?.[1];

          if (ogImg) {
            imageUrl = ogImg.replace(/&amp;/g, '&');
          }

          if (ogTitle) {
            const decodedTitle = decodeHtmlEntities(ogTitle);
            const authorMatch =
              decodedTitle.match(/^([^:]+?)\s+on\s+Instagram/i) || decodedTitle.match(/^(.+?)\s*:\s*"/);
            if (authorMatch) authorName = authorMatch[1].trim();

            const captionQuoteMatch =
              decodedTitle.match(/on\s+Instagram:\s*"([\s\S]*)"/i) || decodedTitle.match(/:\s*"([\s\S]*)"/i);
            if (captionQuoteMatch && captionQuoteMatch[1]?.trim()) {
              description = decodeHtmlEntities(captionQuoteMatch[1].trim());
            }
          }

          if ((!description || description === rawText) && ogDesc) {
            const decodedDesc = decodeHtmlEntities(ogDesc);
            const descQuoteMatch = decodedDesc.match(/:\s*"([\s\S]*)"/i);
            if (descQuoteMatch && descQuoteMatch[1]?.trim()) {
              description = descQuoteMatch[1].trim();
            } else if (!decodedDesc.startsWith('Instagram') && decodedDesc.length > 20) {
              description = decodedDesc;
            }
          }
        }
      } catch (err: any) {
        console.warn('[resolveIntakeMetadata] Instagram scrape warning:', err.message);
      }

      if (!authorName) {
        authorName = sourceUrl.match(/instagram\.com\/([^/?#&]+)/i)?.[1] || null;
        if (['p', 'reel', 'tv', 'stories', 'explore'].includes(authorName || '')) authorName = null;
      }

      title = authorName
        ? `${authorName} on Instagram`
        : shortcode
          ? `Instagram Post (${shortcode})`
          : 'Instagram Post';
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

  return { eventType, platformLabel, title, description, authorName, imageUrl };
}

async function handleSocialIntake(chatId: string | number, message: any) {
  const text = String(message.text || message.caption || '').trim();
  const photo = Array.isArray(message.photo) && message.photo.length > 0
    ? message.photo[message.photo.length - 1]
    : null;

  // Extract URLs if present
  const urlMatch = text.match(/https?:\/\/[^\s]+/i);
  const sourceUrl = urlMatch ? urlMatch[0] : null;

  const meta = await resolveIntakeMetadata(sourceUrl, text);

  if (photo && !sourceUrl) {
    meta.eventType = 'image_upload';
    meta.platformLabel = 'Photo / Screenshot';
    if (!text) meta.title = 'Photo forwarded from Telegram';
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
        telegram_message_id: message.message_id,
        from_user: message.from?.username || message.from?.first_name || 'Admin',
        forward_from: message.forward_from?.username || message.forward_from_chat?.title || null,
        has_photo: Boolean(photo),
        photo_file_id: photo?.file_id || null,
        image_url: meta.imageUrl,
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

  const snippet = meta.description.length > 300 ? meta.description.slice(0, 300) + '…' : meta.description;

  const promptMsg = [
    `📥 *New ${meta.platformLabel} Post Captured!*`,
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
    [{ text: '🎨 Create Social Graphic Draft', callback_data: `intake_draft:${newEvent.id}` }],
    [
      { text: '📰 Add to News Opportunities', callback_data: `intake_news:${newEvent.id}` },
      { text: '🎭 Extract Credits', callback_data: `intake_credits:${newEvent.id}` },
    ],
    [{ text: '🌐 Open Social Studio', url: adminUrl }],
  ];

  if (meta.imageUrl) {
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
    } else if (text || message.photo || message.document) {
      await handleSocialIntake(chatId, message);
    }

    return res.status(200).json({ ok: true });
  } catch (err: any) {
    console.error('[telegram_ops]', err?.message || err);
    // Always 200 to Telegram so it does not retry forever
    return res.status(200).json({ ok: false });
  }
}
