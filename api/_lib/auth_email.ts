/**
 * Branded Supabase Auth emails via Resend — lightweight HTML (email-client safe).
 */
import { getResend, resendConfigured } from './resend.js';

const SITE = 'https://muvidb.com';
const LOGO = `${SITE}/images/MuviDB%20Brand/Black%20Wordmark.png`;
const ORANGE = '#FF5A1F';
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

function esc(s: string) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

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
        preheader: 'Confirm your email to finish joining MuviDB.',
        eyebrow: 'CONFIRM YOUR EMAIL',
        headline: 'Almost there!',
        intro: `Hi ${firstName}, tap the button below to confirm your email and activate your MuviDB account.`,
        ctaLabel: 'Confirm email',
      };
    case 'recovery':
      return {
        subject: 'Reset your MuviDB password',
        preheader: 'Reset your MuviDB password.',
        eyebrow: 'PASSWORD RESET',
        headline: 'Reset your password',
        intro: `Hi ${firstName}, we received a request to reset your password. If this was you, use the button below.`,
        ctaLabel: 'Reset password',
      };
    case 'email_change':
      return {
        subject: 'Confirm your new email on MuviDB',
        preheader: 'Confirm your new MuviDB email address.',
        eyebrow: 'EMAIL CHANGE',
        headline: 'Confirm new email',
        intro: `Hi ${firstName}, confirm this change to update the email on your MuviDB account.`,
        ctaLabel: 'Confirm new email',
      };
    case 'invite':
      return {
        subject: "You're invited to MuviDB",
        preheader: 'Accept your invitation to MuviDB.',
        eyebrow: 'INVITATION',
        headline: "You're invited",
        intro: `Hi ${firstName}, you've been invited to join MuviDB — the home of African cinema.`,
        ctaLabel: 'Accept invite',
      };
    case 'magiclink':
      return {
        subject: 'Your MuviDB sign-in link',
        preheader: 'Sign in to MuviDB with this link.',
        eyebrow: 'SIGN IN',
        headline: 'Your sign-in link',
        intro: `Hi ${firstName}, use the button below to sign in to MuviDB. This link expires soon.`,
        ctaLabel: 'Sign in',
      };
    default:
      return {
        subject: 'MuviDB account action',
        preheader: 'Complete your MuviDB account action.',
        eyebrow: 'MUVIDB',
        headline: 'Action required',
        intro: `Hi ${firstName}, use the button below to continue.`,
        ctaLabel: 'Continue',
      };
  }
}

function renderAuthEmailHtml(opts: {
  preheader: string;
  eyebrow: string;
  headline: string;
  intro: string;
  ctaLabel: string;
  actionUrl: string;
}) {
  const { preheader, eyebrow, headline, intro, ctaLabel, actionUrl } = opts;
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="color-scheme" content="light" />
  <meta name="supported-color-schemes" content="light" />
  <title>MuviDB</title>
</head>
<body style="margin:0;padding:0;background-color:#F3F4F6;font-family:Arial,Helvetica,sans-serif;-webkit-text-size-adjust:100%;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${esc(preheader)}</div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#F3F4F6;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:560px;background-color:#FFFFFF;border-radius:16px;">
          <tr>
            <td style="padding:28px 32px 12px;">
              <img src="${LOGO}" width="140" height="auto" alt="MuviDB" style="display:block;border:0;outline:none;text-decoration:none;" />
            </td>
          </tr>
          <tr>
            <td style="padding:8px 32px 32px;">
              <p style="margin:0 0 12px;font-size:11px;font-weight:700;letter-spacing:0.18em;color:${ORANGE};text-transform:uppercase;">${esc(eyebrow)}</p>
              <h1 style="margin:0 0 16px;font-size:28px;line-height:1.15;color:#15171A;font-weight:800;">${esc(headline)}</h1>
              <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#5F6368;">${esc(intro)}</p>
              <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td style="border-radius:10px;background-color:${ORANGE};">
                    <a href="${esc(actionUrl)}" target="_blank" style="display:inline-block;padding:14px 24px;font-size:12px;font-weight:800;letter-spacing:0.08em;text-transform:uppercase;color:#FFFFFF;text-decoration:none;border-radius:10px;">${esc(ctaLabel)}</a>
                  </td>
                </tr>
              </table>
              <p style="margin:24px 0 0;font-size:12px;line-height:1.6;color:#5F6368;">If the button does not work, copy this link into your browser:<br /><a href="${esc(actionUrl)}" target="_blank" style="color:${ORANGE};word-break:break-all;">${esc(actionUrl)}</a></p>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 32px;background-color:#FFF9F5;border-top:1px solid #F0E8E2;">
              <p style="margin:0;font-size:11px;color:#5F6368;">The <span style="color:${ORANGE};font-weight:700;">MuviDB</span> Team · <a href="${SITE}" style="color:${ORANGE};">muvidb.com</a></p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function renderAuthEmailText(opts: {
  intro: string;
  ctaLabel: string;
  actionUrl: string;
}) {
  return `${opts.intro}\n\n${opts.ctaLabel}: ${opts.actionUrl}\n\n— The MuviDB Team\n${SITE}`;
}

/** Render a sample confirm email (GET ?preview=signup on /api/auth-email). */
export function previewAuthEmailHtml(action: AuthEmailAction = 'signup') {
  const copy = copyForAction(action, 'there');
  const actionUrl = `${SITE}/auth/confirmed`;
  return renderAuthEmailHtml({
    preheader: copy.preheader,
    eyebrow: copy.eyebrow,
    headline: copy.headline,
    intro: copy.intro,
    ctaLabel: copy.ctaLabel,
    actionUrl,
  });
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
  const html = renderAuthEmailHtml({
    preheader: copy.preheader,
    eyebrow: copy.eyebrow,
    headline: copy.headline,
    intro: copy.intro,
    ctaLabel: copy.ctaLabel,
    actionUrl,
  });
  const text = renderAuthEmailText({
    intro: copy.intro,
    ctaLabel: copy.ctaLabel,
    actionUrl,
  });

  const resend = getResend()!;
  const { data, error } = await resend.emails.send({
    from,
    to: email,
    subject: copy.subject,
    replyTo,
    html,
    text,
  });

  if (error) {
    console.error('[auth-email] Resend error:', error);
    return { ok: false as const, error: error.message || 'Resend send failed' };
  }

  return { ok: true as const, emailId: data?.id, action };
}
