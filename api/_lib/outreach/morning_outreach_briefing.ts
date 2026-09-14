import { sendTelegramMessage } from '../telegram.js';
import { supabase } from '../supabase.js';
import { generateQueueBatch } from '../outreach_generator.js';

/**
 * Sends the 08:30 AM WAT daily outreach briefing to Telegram.
 * Prepares the queue, ensures fresh uncontacted artists are queued,
 * and shows candidate names, handles, and pitch previews so the user
 * can review on mobile before running the worker locally.
 */
export async function sendMorningOutreachBriefing(overrideChatId?: string | number) {
  const defaultChatId = (process.env.TELEGRAM_CHAT_ID || '').trim();
  const chatId = overrideChatId ? String(overrideChatId) : defaultChatId;
  if (!chatId) {
    return { ok: false, error: 'TELEGRAM_CHAT_ID is not configured' };
  }

  // 1. Check current queued count
  let { data: queued, count, error } = await supabase
    .from('artist_outreach')
    .select(`
      id,
      person_id,
      status,
      last_message,
      people:person_id (
        id,
        name,
        slug,
        instagram_url,
        known_for_department,
        film_count
      )
    `, { count: 'exact' })
    .eq('status', 'queued')
    .order('created_at', { ascending: false })
    .limit(25);

  if (error) {
    console.error('[morning_outreach_briefing] Fetch error:', error);
    return { ok: false, error: error.message };
  }

  // 2. Auto-replenish queue if under 15 candidates
  if ((count || 0) < 15) {
    try {
      console.log('[morning_outreach_briefing] Replenishing outreach queue with AI candidates…');
      await generateQueueBatch({
        limit: 25,
        minFilms: 1,
        maxFilms: 12,
      });

      // Re-fetch after batch generation
      const refreshed = await supabase
        .from('artist_outreach')
        .select(`
          id,
          person_id,
          status,
          last_message,
          people:person_id (
            id,
            name,
            slug,
            instagram_url,
            known_for_department,
            film_count
          )
        `, { count: 'exact' })
        .eq('status', 'queued')
        .order('created_at', { ascending: false })
        .limit(25);

      if (refreshed.data) {
        queued = refreshed.data;
        count = refreshed.count;
      }
    } catch (genErr) {
      console.warn('[morning_outreach_briefing] Replenish warning:', genErr);
    }
  }

  const siteUrl = (process.env.VITE_PUBLIC_SITE_URL || process.env.PUBLIC_SITE_URL || 'https://muvidb.com').replace(/\/$/, '');
  const totalInQueue = count || queued?.length || 0;

  if (!queued || queued.length === 0) {
    await sendTelegramMessage({
      chatId,
      text: [
        '📬 *Daily Artist Outreach Queue*',
        '',
        'No artists currently queued for outreach today.',
        'Visit the admin outreach dashboard to discover new filmmakers and actors:',
      ].join('\n'),
      replyMarkup: {
        inline_keyboard: [
          [{ text: '👥 Open Outreach Dashboard', url: `${siteUrl}/admin/outreach` }],
        ],
      },
    });
    return { ok: true, count: 0 };
  }

  const candidateLines = (queued || []).slice(0, 10).map((item: any, idx: number) => {
    const p = item.people;
    const cleanHandle = p?.instagram_url
      ? '@' + p.instagram_url.replace(/https?:\/\/(www\.)?instagram\.com\//, '').replace(/\/$/, '')
      : '';
    const dept = p?.known_for_department || 'Actor / Crew';
    const msg = (item.last_message || '').trim();
    const preview = msg.length > 90 ? `${msg.slice(0, 85)}…` : (msg || 'Personalized pitch ready');

    return `${idx + 1}. *${p?.name || 'Artist'}* ${cleanHandle ? `(${cleanHandle})` : ''} — ${dept}\n   💬 _“${preview}”_`;
  }).join('\n\n');

  const remaining = totalInQueue > 10 ? totalInQueue - 10 : 0;

  const text = [
    `📬 *Daily Artist Outreach Queue (${totalInQueue} ready)*`,
    '',
    'Here are candidates prepared for Instagram outreach today:',
    '',
    candidateLines,
    remaining > 0 ? `\n_…plus ${remaining} more in queue._` : '',
    '',
    '💻 *To send these safely via your residential IP:*',
    'Open terminal on your laptop and run:',
    '`npm run outreach:send`',
  ].filter(Boolean).join('\n');

  await sendTelegramMessage({
    chatId,
    text,
    replyMarkup: {
      inline_keyboard: [
        [{ text: '👥 Review All in Dashboard', url: `${siteUrl}/admin/outreach` }],
      ],
    },
  });

  return { ok: true, count: totalInQueue };
}
