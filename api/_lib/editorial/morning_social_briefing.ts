import { sendTelegramMessage, type TelegramInlineButton } from '../telegram.js';
import { supabase } from '../supabase.js';

/**
 * Sends the 08:00 AM WAT morning briefing to Telegram with today's 3 scheduled social posts.
 * Provides interactive inline buttons for:
 * - [✅ Approve]
 * - [❌ Skip]
 * - [💬 Conversational]
 * - [📰 Editorial]
 * - [🔥 Relatable]
 * - [🚀 Approve All 3 For Today]
 */
export async function sendMorningSocialBriefing(overrideChatId?: string | number) {
  const defaultChatId = (process.env.TELEGRAM_CHAT_ID || '').trim();
  const chatId = overrideChatId ? String(overrideChatId) : defaultChatId;
  if (!chatId) {
    return { ok: false, error: 'TELEGRAM_CHAT_ID is not configured' };
  }

  // Get current date string in West Africa Time (Africa/Lagos is UTC+1)
  const todayStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Lagos' }).format(new Date());
  const startIso = new Date(`${todayStr}T00:00:00+01:00`).toISOString();
  const endIso = new Date(`${todayStr}T23:59:59+01:00`).toISOString();

  const { data: items, error } = await supabase
    .from('social_content_items')
    .select(`
      id,
      title,
      status,
      content_type,
      scheduled_for,
      metadata,
      social_platform_variants (
        id,
        platform,
        status,
        caption,
        title,
        hashtags
      )
    `)
    .gte('scheduled_for', startIso)
    .lte('scheduled_for', endIso)
    .neq('status', 'rejected')
    .order('scheduled_for', { ascending: true });

  if (error) {
    console.error('[morning_social_briefing] Query error:', error);
    return { ok: false, error: error.message };
  }

  const siteUrl = (process.env.VITE_PUBLIC_SITE_URL || process.env.PUBLIC_SITE_URL || 'https://muvidb.com').replace(/\/$/, '');

  if (!items || items.length === 0) {
    await sendTelegramMessage({
      chatId,
      text: [
        `☀️ *MuviDB Social Schedule for Today (${todayStr})*`,
        '',
        '⚠️ *No posts are scheduled or drafted for today.*',
        '',
        'Click below to generate 3 posts in the Social Studio Calendar:',
      ].join('\n'),
      replyMarkup: {
        inline_keyboard: [
          [{ text: '📅 Open Social Calendar', url: `${siteUrl}/admin/social-studio?tab=calendar` }],
        ],
      },
    });
    return { ok: true, count: 0, message: 'No posts scheduled for today' };
  }

  // Send header overview
  await sendTelegramMessage({
    chatId,
    text: [
      `☀️ *MuviDB Social Schedule for Today (${todayStr})*`,
      `Found *${items.length}* post${items.length === 1 ? '' : 's'} prepared for today.`,
      'Review and approve captions or switch tones below:',
    ].join('\n'),
  });

  const slotIcons = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣'];

  for (let idx = 0; idx < items.length; idx++) {
    const item = items[idx];
    const icon = slotIcons[idx] || '📌';
    
    // Format scheduled time in WAT
    let timeLabel = '';
    if (item.scheduled_for) {
      const d = new Date(item.scheduled_for);
      timeLabel = d.toLocaleTimeString('en-GB', {
        timeZone: 'Africa/Lagos',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      }) + ' WAT';
    } else {
      timeLabel = item.metadata?.scheduled_time || 'Planned';
    }

    const primaryVariant = (item.social_platform_variants || []).find((v: any) => v.platform === 'instagram') ||
      (item.social_platform_variants || [])[0];
    const caption = primaryVariant?.caption || item.metadata?.synopsis || 'No caption text generated yet.';
    const captionPreview = caption.length > 320 ? `${caption.slice(0, 310)}…` : caption;

    const statusBadge = item.status === 'scheduled' || item.status === 'approved'
      ? '✅ Ready to Post'
      : '📝 Draft (Needs Approval)';

    const typeLabel = (item.content_type || 'spotlight').replace(/_/g, ' ').toUpperCase();

    const postText = [
      `${icon} *${timeLabel} — ${typeLabel}*`,
      `📌 *${item.title || 'Untitled Post'}*`,
      `Status: ${statusBadge}`,
      '',
      '💬 *Caption Preview:*',
      `_${captionPreview}_`,
    ].join('\n');

    const inline_keyboard: TelegramInlineButton[][] = [
      [
        { text: '✅ Approve', callback_data: `appr:${item.id}` },
        { text: '❌ Skip', callback_data: `skip:${item.id}` },
      ],
      [
        { text: '💬 Conversational', callback_data: `tone:${item.id}:conv` },
        { text: '📰 Editorial', callback_data: `tone:${item.id}:edit` },
        { text: '🔥 Relatable', callback_data: `tone:${item.id}:rel` },
      ],
    ];

    await sendTelegramMessage({
      chatId,
      text: postText,
      replyMarkup: { inline_keyboard },
    });
  }

  // Master action to approve all
  const hasDrafts = items.some(i => i.status === 'draft' || i.status === 'ready_for_review');
  if (hasDrafts) {
    await sendTelegramMessage({
      chatId,
      text: '⚡ *Master Control:* Tap below to approve all pending posts for today with their current captions:',
      replyMarkup: {
        inline_keyboard: [
          [{ text: '🚀 Approve All For Today', callback_data: `appr_all:${todayStr}` }],
          [{ text: '🎨 Open Social Studio', url: `${siteUrl}/admin/social-studio` }],
        ],
      },
    });
  }

  return { ok: true, count: items.length, date: todayStr };
}
