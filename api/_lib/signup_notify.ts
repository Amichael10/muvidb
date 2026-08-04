/**
 * One-shot Telegram alert when a new user signs up.
 * Idempotent via auth app_metadata.ops_signup_notified.
 */
import { supabase } from './supabase.js';
import { sendTelegramMessage, telegramConfigured } from './telegram.js';

export async function notifySignupOnce(opts: {
  userId: string;
  email: string;
  firstName?: string | null;
  role?: string | null;
  provider?: string | null;
}): Promise<void> {
  if (!telegramConfigured()) return;

  const userId = opts.userId;
  if (!userId) return;

  try {
    const { data, error } = await supabase.auth.admin.getUserById(userId);
    if (error || !data?.user) return;

    const meta = (data.user.app_metadata || {}) as Record<string, unknown>;
    if (meta.ops_signup_notified) return;

    const email = opts.email || data.user.email || '(no email)';
    const name =
      opts.firstName
      || data.user.user_metadata?.name
      || data.user.user_metadata?.full_name
      || '';
    const role = opts.role || data.user.user_metadata?.role || 'fan';
    const provider =
      opts.provider
      || data.user.app_metadata?.provider
      || (Array.isArray(data.user.identities) && data.user.identities[0]?.provider)
      || 'email';
    const created = data.user.created_at
      ? new Date(data.user.created_at).toISOString()
      : new Date().toISOString();

    const message = [
      '👋 New MuviDB signup',
      name ? `Name: ${name}` : null,
      `Email: ${email}`,
      `Role: ${role}`,
      `Via: ${provider}`,
      `At: ${created}`,
      `Id: ${userId}`,
    ].filter(Boolean).join('\n');

    const sent = await sendTelegramMessage(message);
    if (!sent.ok) {
      console.warn('[signup_notify] telegram failed:', sent.error);
      return;
    }

    await supabase.auth.admin.updateUserById(userId, {
      app_metadata: {
        ...meta,
        ops_signup_notified: true,
        ops_signup_notified_at: new Date().toISOString(),
      },
    });
  } catch (err: any) {
    console.warn('[signup_notify]', err?.message || err);
  }
}
