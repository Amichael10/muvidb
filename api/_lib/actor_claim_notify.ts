import { supabase } from './supabase.js';
import { sendTelegramMessage, telegramConfigured } from './telegram.js';

type NotifyOptions = {
  expectedUserId?: string;
  force?: boolean;
};

function siteUrl() {
  const configured = (process.env.VITE_PUBLIC_SITE_URL || process.env.PUBLIC_SITE_URL || '').trim();
  return (configured || 'https://muvidb.com').replace(/\/$/, '');
}

export async function notifyActorClaimSubmission(claimId: string, options: NotifyOptions = {}) {
  if (!telegramConfigured()) {
    return { ok: false as const, skipped: false, error: 'Telegram is not configured' };
  }

  const { data: claim, error } = await supabase
    .from('profile_claims')
    .select(`
      id,user_id,person_id,status,verification_status,verification_code,
      social_platform,social_handle,social_url,created_at,telegram_notified_at,
      claimant:users!profile_claims_user_id_fkey(name,email),
      people!profile_claims_person_id_fkey(name,slug)
    `)
    .eq('id', claimId)
    .single();
  if (error || !claim) throw error || new Error('Claim not found');
  if (options.expectedUserId && claim.user_id !== options.expectedUserId) {
    throw new Error('You cannot send notifications for another user’s claim');
  }
  if (claim.status !== 'pending') {
    return { ok: true as const, skipped: true, reason: 'Claim is no longer pending' };
  }
  if (claim.telegram_notified_at && !options.force) {
    return { ok: true as const, skipped: true, reason: 'Telegram alert already sent' };
  }

  if (options.force) {
    await supabase.from('profile_claims').update({ telegram_notified_at: null }).eq('id', claim.id);
  }
  const attemptedAt = new Date().toISOString();
  const { data: locked, error: lockError } = await supabase
    .from('profile_claims')
    .update({ telegram_notified_at: attemptedAt, telegram_notification_error: null })
    .eq('id', claim.id)
    .is('telegram_notified_at', null)
    .select('id')
    .maybeSingle();
  if (lockError) throw lockError;
  if (!locked) return { ok: true as const, skipped: true, reason: 'Notification is already being sent' };

  const claimant = Array.isArray(claim.claimant) ? claim.claimant[0] : claim.claimant;
  const person = Array.isArray(claim.people) ? claim.people[0] : claim.people;
  const reference = String(claim.id).slice(0, 8).toUpperCase();
  const base = siteUrl();
  const message = [
    '🎭 New actor profile claim',
    `Actor: ${person?.name || 'Unknown actor'}`,
    `Claimant: ${claimant?.name || 'Unknown user'}`,
    claimant?.email ? `Email: ${claimant.email}` : null,
    `Social: ${claim.social_handle} on ${claim.social_platform}`,
    `Reference: ${reference}`,
    `Verification code: ${claim.verification_code}`,
    `Submitted: ${new Date(claim.created_at).toISOString()}`,
  ].filter(Boolean).join('\n');

  const sent = await sendTelegramMessage({
    text: message,
    replyMarkup: {
      inline_keyboard: [
        [{ text: 'Review claim', url: `${base}/admin/claims` }],
        ...(claim.social_url ? [[{ text: 'Open social account', url: claim.social_url }]] : []),
      ],
    },
  });
  if (!sent.ok) {
    await supabase.from('profile_claims').update({
      telegram_notified_at: null,
      telegram_notification_error: String(sent.error || 'Telegram send failed').slice(0, 1000),
    }).eq('id', claim.id);
    return { ok: false as const, skipped: false, error: sent.error || 'Telegram send failed' };
  }

  return { ok: true as const, skipped: false, messageId: sent.messageId || null };
}
