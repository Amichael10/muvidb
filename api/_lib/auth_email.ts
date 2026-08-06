/**
 * Branded Supabase Auth emails via Resend — reuses MuviDbWelcomeEmail layout.
 */
import React from 'react';
import { render } from '@react-email/render';
import MuviDbWelcomeEmail from '../../emails/MuviDbWelcomeEmail';
import { getResend, resendConfigured } from './resend.js';
import { getHeroCollage, WELCOME_EMAIL_ASSETS, type WelcomeCollage } from './welcome_email.js';

const SITE = 'https://muvidb.com';
const DEFAULT_FROM = 'MuviDB Welcome <support@muvidb.com>';
const DEFAULT_REPLY_TO = 'support@muvidb.com';
const FALLBACK_POSTER = `${SITE}/images/film-placeholder.webp`;

const COMPACT_COLLAGE: WelcomeCollage = {
  featuredPerson: FALLBACK_POSTER,
  actor: FALLBACK_POSTER,
  filmmaker: FALLBACK_POSTER,
  moviePoster: FALLBACK_POSTER,
  productionStill: FALLBACK_POSTER,
};

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

/** Supabase verify link — same shape as built-in confirm / recovery templates. */
export function buildAuthActionUrl(payload: AuthEmailPayload): string {
  const { email_data: d } = payload;
  const base = (d.site_url || process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').replace(/\/$/, '');
  const redirect = d.redirect_to || SITE;
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
        compact: true,
      };
    case 'recovery':
      return {
        subject: 'Reset your MuviDB password',
        preview: 'Reset your MuviDB password.',
        eyebrow: 'PASSWORD RESET',
        headline: 'Reset your password',
        intro: `Hi ${firstName}, we received a request to reset your password. If this was you, use the button below.`,
        ctaLabel: 'Reset password →',
        compact: true,
      };
    case 'email_change':
      return {
        subject: 'Confirm your new email on MuviDB',
        preview: 'Confirm your new MuviDB email address.',
        eyebrow: 'EMAIL CHANGE',
        headline: 'Confirm new email',
        intro: `Hi ${firstName}, confirm this change to update the email on your MuviDB account.`,
        ctaLabel: 'Confirm new email →',
        compact: true,
      };
    case 'invite':
      return {
        subject: 'You\'re invited to MuviDB',
        preview: 'Accept your invitation to MuviDB.',
        eyebrow: 'INVITATION',
        headline: 'You\'re invited',
        intro: `Hi ${firstName}, you've been invited to join MuviDB — the home of African cinema.`,
        ctaLabel: 'Accept invite →',
        compact: true,
      };
    case 'magiclink':
      return {
        subject: 'Your MuviDB sign-in link',
        preview: 'Sign in to MuviDB with this link.',
        eyebrow: 'SIGN IN',
        headline: 'Your sign-in link',
        intro: `Hi ${firstName}, use the button below to sign in to MuviDB. This link expires soon.`,
        ctaLabel: 'Sign in →',
        compact: true,
      };
    default:
      return {
        subject: 'MuviDB account action',
        preview: 'Complete your MuviDB account action.',
        eyebrow: 'MUVIDB',
        headline: 'Action required',
        intro: `Hi ${firstName}, use the button below to continue.`,
        ctaLabel: 'Continue →',
        compact: true,
      };
  }
}

async function resolveCollage(compact: boolean): Promise<WelcomeCollage> {
  if (compact) return COMPACT_COLLAGE;
  try {
    return await getHeroCollage();
  } catch {
    return COMPACT_COLLAGE;
  }
}

export async function sendAuthEmail(payload: AuthEmailPayload) {
  if (!resendConfigured()) {
    return { ok: false as const, error: 'RESEND_API_KEY not configured' };
  }

  const email = (payload.user?.email || '').trim();
  if (!email) return { ok: false as const, error: 'Missing recipient email' };

  const firstName = firstNameFromUser(payload.user);
  const action = payload.email_data.email_action_type;
  const copy = copyForAction(action, firstName);
  const actionUrl = buildAuthActionUrl(payload);

  const from = (process.env.RESEND_FROM_EMAIL || '').trim() || DEFAULT_FROM;
  const replyTo = (process.env.RESEND_REPLY_TO || '').trim() || DEFAULT_REPLY_TO;
  const collage = await resolveCollage(copy.compact);

  let html: string;
  try {
    html = await render(
      React.createElement(MuviDbWelcomeEmail, {
        firstName,
        logoUrl: WELCOME_EMAIL_ASSETS.logoUrl,
        exploreUrl: SITE,
        helpUrl: `${SITE}/about`,
        unsubscribeUrl: `${SITE}/dashboard`,
        preview: copy.preview,
        eyebrow: copy.eyebrow,
        headline: copy.headline,
        intro: copy.intro,
        ctaLabel: copy.ctaLabel,
        ctaUrl: actionUrl,
        compact: copy.compact,
        collage,
        social: { ...WELCOME_EMAIL_ASSETS.social },
      }),
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
