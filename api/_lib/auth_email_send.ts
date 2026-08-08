/**
 * Auth confirm / reset email render + send — runs via api/data bundle.
 */
import { getResend, resendConfigured } from './resend.js';
import { renderMuviDbEmail } from './welcome_email.js';
import {
  FALLBACK_COLLAGE,
  SITE_URL,
  WELCOME_EMAIL_ASSETS,
  type WelcomeCollage,
} from './email_assets.js';

const DEFAULT_FROM = 'MuviDB Welcome <support@muvidb.com>';
const DEFAULT_REPLY_TO = 'support@muvidb.com';

export type AuthEmailAction =
  | 'signup'
  | 'recovery'
  | 'email_change'
  | 'invite'
  | 'magiclink'
  | 'reauthentication'
  | string;

export type AuthEmailPayload = {
  user: {
    email: string;
    user_metadata?: Record<string, unknown>;
  };
  email_data: {
    token: string;
    token_hash: string;
    redirect_to: string;
    email_action_type: AuthEmailAction;
    site_url: string;
    token_new?: string;
    token_hash_new?: string;
  };
};

function firstNameFromUser(user: AuthEmailPayload['user']) {
  const meta = user.user_metadata || {};
  const raw =
    (typeof meta.name === 'string' && meta.name)
    || (typeof meta.full_name === 'string' && meta.full_name)
    || '';
  return raw.trim().split(/\s+/).filter(Boolean)[0] || 'there';
}

export function buildAuthActionUrl(payload: AuthEmailPayload): string {
  const { email_data: d } = payload;
  const base = (d.site_url || process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').replace(/\/$/, '');
  const redirect = d.redirect_to || SITE_URL;
  const params = new URLSearchParams({
    token: d.token_hash,
    type: d.email_action_type,
    redirect_to: redirect,
  });
  return `${base}/auth/v1/verify?${params.toString()}`;
}

function copyForAction(action: AuthEmailAction, firstName: string) {
  switch (action) {
    case 'signup':
      return {
        subject: 'Confirm your MuviDB account',
        preview: 'Confirm your email to finish joining MuviDB.',
        eyebrow: 'CONFIRM YOUR EMAIL',
        headline: 'Almost there!',
        intro: `Hi ${firstName}, tap the button below to confirm your email and activate your MuviDB account.`,
        ctaLabel: 'Confirm email →',
      };
    case 'recovery':
      return {
        subject: 'Reset your MuviDB password',
        preview: 'Reset your MuviDB password.',
        eyebrow: 'PASSWORD RESET',
        headline: 'Reset your password',
        intro: `Hi ${firstName}, we received a request to reset your password. If this was you, use the button below.`,
        ctaLabel: 'Reset password →',
      };
    default:
      return {
        subject: 'MuviDB account action',
        preview: 'Complete your MuviDB account action.',
        eyebrow: 'MUVIDB',
        headline: 'Action required',
        intro: `Hi ${firstName}, use the button below to continue.`,
        ctaLabel: 'Continue →',
      };
  }
}

async function resolveCollage(): Promise<WelcomeCollage> {
  try {
    const { getHeroCollage } = await import('./welcome_email.js');
    return await getHeroCollage();
  } catch {
    return FALLBACK_COLLAGE;
  }
}

function emailProps(
  action: AuthEmailAction,
  firstName: string,
  actionUrl: string,
  collage: WelcomeCollage,
) {
  const copy = copyForAction(action, firstName);
  return {
    firstName,
    logoUrl: WELCOME_EMAIL_ASSETS.logoUrl,
    exploreUrl: SITE_URL,
    helpUrl: `${SITE_URL}/about`,
    unsubscribeUrl: `${SITE_URL}/dashboard`,
    preview: copy.preview,
    eyebrow: copy.eyebrow,
    headline: copy.headline,
    intro: copy.intro,
    ctaLabel: copy.ctaLabel,
    ctaUrl: actionUrl,
    compact: true,
    collage,
    social: { ...WELCOME_EMAIL_ASSETS.social },
  };
}

/** GET /api/data?_r=auth-email&preview=signup */
export async function previewAuthEmailHtml(action: AuthEmailAction = 'signup') {
  return renderMuviDbEmail(
    emailProps(action, 'there', `${SITE_URL}/auth/confirmed`, FALLBACK_COLLAGE),
  );
}

export async function sendAuthEmail(payload: AuthEmailPayload) {
  if (!resendConfigured()) {
    return { ok: false as const, error: 'RESEND_API_KEY not configured' };
  }

  const email = (payload.user?.email || '').trim();
  if (!email) return { ok: false as const, error: 'Missing recipient email' };

  const firstName = firstNameFromUser(payload.user);
  const action = payload.email_data?.email_action_type || 'signup';
  const copy = copyForAction(action, firstName);
  const actionUrl = buildAuthActionUrl(payload);

  if (!actionUrl.includes('/auth/v1/verify')) {
    return { ok: false as const, error: 'Missing Supabase site_url for verify link' };
  }

  const from = (process.env.RESEND_FROM_EMAIL || '').trim() || DEFAULT_FROM;
  const replyTo = (process.env.RESEND_REPLY_TO || '').trim() || DEFAULT_REPLY_TO;
  const collage = await resolveCollage();

  let html: string;
  try {
    html = await renderMuviDbEmail(
      emailProps(action, firstName, actionUrl, collage),
    );
  } catch (err: any) {
    console.error('[auth-email] render failed:', err?.message || err);
    return { ok: false as const, error: `Email render failed: ${err?.message || err}` };
  }

  const resend = getResend()!;
  const { data, error } = await resend.emails.send({
    from,
    to: email,
    subject: copy.subject,
    replyTo,
    html,
  });

  if (error) {
    console.error('[auth-email] Resend error:', error);
    return { ok: false as const, error: error.message || 'Resend send failed' };
  }

  return { ok: true as const, emailId: data?.id, action };
}
