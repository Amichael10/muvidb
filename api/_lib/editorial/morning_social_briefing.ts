import { sendTelegramMessage, type TelegramInlineButton } from '../telegram.js';
import { supabase } from '../supabase.js';
import { isLikelyLandscapeOrThumbnailUrl } from './candidate_strategy.js';

/**
 * Sends the 07:00 AM WAT morning briefing to Telegram with today's scheduled social posts.
 * - Starting tomorrow (2026-10-13), posts are auto-approved to publish at their scheduled time.
 * - Under NO condition are landscape banners or video thumbnails allowed to post.
 * - The Telegram notification alerts the user of chosen posts & posting times without waiting for manual approval.
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

  // Auto-approval starts tomorrow morning (2026-10-13)
  const isAutoApproveActive = todayStr >= '2026-10-13';

  async function fetchTodayItems() {
    const { data: variants, error } = await supabase
      .from('social_platform_variants')
      .select(`
        id,
        content_item_id,
        platform,
        status,
        caption,
        title,
        hashtags,
        scheduled_for,
        social_content_items (
          id,
          title,
          status,
          content_type,
          source_snapshot
        )
      `)
      .gte('scheduled_for', startIso)
      .lte('scheduled_for', endIso)
      .neq('status', 'rejected')
      .order('scheduled_for', { ascending: true });

    if (error || !variants || variants.length === 0) return [];

    const itemMap = new Map<string, any>();
    for (const v of variants) {
      const rawItem = (v as any).social_content_items;
      if (!rawItem || !v.content_item_id) continue;
      if (!itemMap.has(v.content_item_id)) {
        itemMap.set(v.content_item_id, {
          ...rawItem,
          scheduled_for: v.scheduled_for,
          metadata: rawItem.source_snapshot || {},
          social_platform_variants: [],
        });
      }
      const grouped = itemMap.get(v.content_item_id);
      grouped.social_platform_variants.push(v);
      if (!grouped.scheduled_for && v.scheduled_for) {
        grouped.scheduled_for = v.scheduled_for;
      }
    }
    return Array.from(itemMap.values());
  }

  let items = await fetchTodayItems();

  if (!items || items.length === 0) {
    try {
      const { generateDailyScheduleDrafts } = await import('./calendar_service.js');
      await generateDailyScheduleDrafts({ daysAhead: 1, startDate: todayStr });
      items = await fetchTodayItems();
    } catch (genErr) {
      console.warn('[morning_social_briefing] Auto-draft fallback failed:', genErr);
    }
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

  // ── STRICT PORTRAIT VALIDATION & AUTO-APPROVAL ──
  // Under NO condition can Social Studio post a landscape banner or video thumbnail.
  const validItems: any[] = [];
  const rejectedItems: any[] = [];

  for (const item of items) {
    const posterUrl = (
      item.metadata?.posterUrl ||
      item.metadata?.imageUrl ||
      item.metadata?.poster_url ||
      item.source_snapshot?.posterUrl ||
      item.source_snapshot?.imageUrl ||
      item.source_snapshot?.poster_url ||
      item.source_snapshot?.assetUrl ||
      ''
    ).trim();

    if (posterUrl && isLikelyLandscapeOrThumbnailUrl(posterUrl)) {
      console.warn(`[morning_social_briefing] Rejecting item "${item.title}" — landscape artwork detected: ${posterUrl}`);
      await supabase
        .from('social_content_items')
        .update({
          status: 'rejected',
          metadata: { ...item.metadata, rejection_reason: 'landscape_banner_detected', rejected_at: new Date().toISOString() },
        })
        .eq('id', item.id);
      await supabase
        .from('social_platform_variants')
        .update({
          status: 'rejected',
          last_error_code: 'landscape_poster_rejected',
          last_error_message: 'Landscape banner detected. Under no condition can Social Studio post landscape artwork.',
        })
        .eq('content_item_id', item.id);
      rejectedItems.push(item);
      continue;
    }

    // Auto-approve valid portrait items if auto-approval is active
    if (isAutoApproveActive && (item.status === 'draft' || item.status === 'ready_for_review')) {
      await supabase
        .from('social_content_items')
        .update({ status: 'scheduled', updated_at: new Date().toISOString() })
        .eq('id', item.id);
      await supabase
        .from('social_platform_variants')
        .update({ status: 'scheduled', updated_at: new Date().toISOString() })
        .eq('content_item_id', item.id);
      item.status = 'scheduled';
    }

    validItems.push(item);
  }

  if (validItems.length === 0) {
    await sendTelegramMessage({
      chatId,
      text: [
        `☀️ *MuviDB Social Schedule for Today (${todayStr})*`,
        '',
        '⚠️ *All draft items were rejected because they contained landscape banners or missing portrait artwork.*',
        'Under strict rules, only crisp portrait posters are eligible to post.',
      ].join('\n'),
      replyMarkup: {
        inline_keyboard: [
          [{ text: '🎨 Open Social Studio', url: `${siteUrl}/admin/social-studio` }],
        ],
      },
    });
    return { ok: true, count: 0, rejected: rejectedItems.length };
  }

  // Send header overview
  const headerLines = [
    `☀️ *MuviDB Social Schedule for Today (${todayStr})*`,
    `Found *${validItems.length}* verified portrait post${validItems.length === 1 ? '' : 's'}.`,
  ];
  if (isAutoApproveActive) {
    headerLines.push('⚡ *Auto-Scheduled:* Posts will publish automatically at their designated times.');
  } else {
    headerLines.push('Review and approve captions or switch tones below:');
  }

  await sendTelegramMessage({
    chatId,
    text: headerLines.join('\n'),
  });

  const slotIcons = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣'];

  for (let idx = 0; idx < validItems.length; idx++) {
    const item = validItems[idx];
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
      timeLabel = item.metadata?.scheduled_time || 'Planned Slot';
    }

    const primaryVariant = (item.social_platform_variants || []).find((v: any) => v.platform === 'instagram') ||
      (item.social_platform_variants || [])[0];
    const caption = primaryVariant?.caption || item.metadata?.synopsis || 'No caption text generated yet.';
    const captionPreview = caption.length > 320 ? `${caption.slice(0, 310)}…` : caption;

    const statusBadge = isAutoApproveActive || item.status === 'scheduled' || item.status === 'approved'
      ? `🚀 Auto-Scheduled for ${timeLabel}`
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

    let inline_keyboard: TelegramInlineButton[][];
    if (isAutoApproveActive) {
      // Auto-approved: does NOT wait for approval. Provide cancel / studio links and tone controls.
      inline_keyboard = [
        [
          { text: '❌ Cancel Post', callback_data: `skip:${item.id}` },
          { text: '🎨 Edit in Studio', url: `${siteUrl}/admin/social-studio` },
        ],
        [
          { text: '💬 Conversational', callback_data: `tone:${item.id}:conv` },
          { text: '📰 Editorial', callback_data: `tone:${item.id}:edit` },
          { text: '🔥 Relatable', callback_data: `tone:${item.id}:rel` },
        ],
      ];
    } else {
      inline_keyboard = [
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
    }

    await sendTelegramMessage({
      chatId,
      text: postText,
      replyMarkup: { inline_keyboard },
    });
  }

  // Master action only shown if not auto-approved and drafts remain
  if (!isAutoApproveActive) {
    const hasDrafts = validItems.some(i => i.status === 'draft' || i.status === 'ready_for_review');
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
  }

  return { ok: true, count: validItems.length, rejected: rejectedItems.length, date: todayStr };
}
