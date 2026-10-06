import React from 'react';
import { render } from '@react-email/render';
import MuviDbWelcomeEmail from './MuviDbWelcomeEmail.generated.js';
import { getResend } from './resend.js';
import { getHeroCollage, WELCOME_EMAIL_ASSETS } from './welcome_email.js';

function siteUrl() {
  const configured = (process.env.VITE_PUBLIC_SITE_URL || process.env.PUBLIC_SITE_URL || '').trim();
  return (configured || 'https://muvidb.com').replace(/\/$/, '');
}

/**
 * Send confirmation email when a studio claim request is submitted via corporate email
 */
export async function sendCompanyClaimSubmittedEmail(opts: {
  workEmail: string;
  userName?: string | null;
  companyName: string;
  claimCode: string;
  dashboardUrl?: string;
}) {
  const resend = getResend();
  if (!resend) return { ok: false as const, error: 'RESEND_API_KEY not configured' };

  const firstName = (opts.userName || '').trim().split(/\s+/)[0] || 'there';
  const collage = await getHeroCollage();
  const targetUrl = opts.dashboardUrl || `${siteUrl()}/company/dashboard`;

  const html = await render(
    React.createElement(MuviDbWelcomeEmail, {
      firstName,
      logoUrl: WELCOME_EMAIL_ASSETS.logoUrl,
      exploreUrl: targetUrl,
      helpUrl: `${siteUrl()}/help`,
      unsubscribeUrl: targetUrl,
      collage,
      social: { ...WELCOME_EMAIL_ASSETS.social },
      compact: true,
      preview: `We received your verification request for ${opts.companyName}.`,
      eyebrow: 'STUDIO VERIFICATION IN PROGRESS',
      headline: `We received your claim for ${opts.companyName}`,
      intro: `Hi ${firstName}, we have logged your verification request for ${opts.companyName} (Ticket Ref: ${opts.claimCode}). Our Trust & Safety team is reviewing your corporate domain credentials (${opts.workEmail}). Once confirmed, you will receive full administrative access to manage your film catalogue, box office metrics, and talent roster.`,
      ctaLabel: 'View studio dashboard →',
      ctaUrl: targetUrl,
    }),
  );

  const from = (process.env.RESEND_FROM_EMAIL || '').trim() || 'MuviDB <support@muvidb.com>';
  const replyTo = (process.env.RESEND_REPLY_TO || '').trim() || 'support@muvidb.com';

  const { data, error } = await resend.emails.send({
    from,
    to: opts.workEmail,
    subject: `Verification Request Received: ${opts.companyName} (Ref: ${opts.claimCode})`,
    replyTo,
    html,
  });

  if (error) return { ok: false as const, error: error.message || 'Email send failed' };
  return { ok: true as const, emailId: data?.id || null };
}

/**
 * Send approval confirmation email when admin approves a studio claim
 */
export async function sendCompanyClaimApprovedEmail(opts: {
  email: string;
  userName?: string | null;
  companyName: string;
  dashboardUrl?: string;
}) {
  const resend = getResend();
  if (!resend) return { ok: false as const, error: 'RESEND_API_KEY not configured' };

  const firstName = (opts.userName || '').trim().split(/\s+/)[0] || 'there';
  const collage = await getHeroCollage();
  const targetUrl = opts.dashboardUrl || `${siteUrl()}/company/dashboard`;

  const html = await render(
    React.createElement(MuviDbWelcomeEmail, {
      firstName,
      logoUrl: WELCOME_EMAIL_ASSETS.logoUrl,
      exploreUrl: targetUrl,
      helpUrl: `${siteUrl()}/help`,
      unsubscribeUrl: targetUrl,
      collage,
      social: { ...WELCOME_EMAIL_ASSETS.social },
      compact: true,
      preview: `Congratulations! ${opts.companyName} is officially verified on MuviDB.`,
      eyebrow: 'STUDIO VERIFIED',
      headline: `${opts.companyName} is now officially verified`,
      intro: `Hi ${firstName}, your claim for ${opts.companyName} has been verified and approved. You now have full administrative access to manage your films, add theatrical box office numbers, and maintain your official talent roster on MuviDB.`,
      ctaLabel: 'Open studio workspace →',
      ctaUrl: targetUrl,
    }),
  );

  const from = (process.env.RESEND_FROM_EMAIL || '').trim() || 'MuviDB <support@muvidb.com>';
  const replyTo = (process.env.RESEND_REPLY_TO || '').trim() || 'support@muvidb.com';

  const { data, error } = await resend.emails.send({
    from,
    to: opts.email,
    subject: `Official Verification Approved: ${opts.companyName} on MuviDB`,
    replyTo,
    html,
  });

  if (error) return { ok: false as const, error: error.message || 'Email send failed' };
  return { ok: true as const, emailId: data?.id || null };
}
