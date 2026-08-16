import React from 'react';
import { render } from '@react-email/render';
import MuviDbWelcomeEmail from './MuviDbWelcomeEmail.generated.js';
import { getResend } from './resend.js';
import { getHeroCollage, WELCOME_EMAIL_ASSETS } from './welcome_email.js';

export async function sendActorClaimApprovedEmail(opts: {
  email: string;
  userName?: string | null;
  personName: string;
  dashboardUrl: string;
}) {
  const resend = getResend();
  if (!resend) return { ok: false as const, error: 'RESEND_API_KEY not configured' };

  const firstName = (opts.userName || '').trim().split(/\s+/)[0] || 'there';
  const collage = await getHeroCollage();
  const html = await render(
    React.createElement(MuviDbWelcomeEmail, {
      firstName,
      logoUrl: WELCOME_EMAIL_ASSETS.logoUrl,
      exploreUrl: opts.dashboardUrl,
      helpUrl: opts.dashboardUrl,
      unsubscribeUrl: opts.dashboardUrl,
      collage,
      social: { ...WELCOME_EMAIL_ASSETS.social },
      compact: true,
      preview: `Your ${opts.personName} profile claim has been verified.`,
      eyebrow: 'PROFILE VERIFIED',
      headline: 'Your actor profile is now verified',
      intro: `Hi ${firstName}, your claim for ${opts.personName} has been approved. You can now request additions or removals from your filmography. Every catalogue change will still be reviewed by a MuviDB editor before it goes live.`,
      ctaLabel: 'Open actor dashboard →',
      ctaUrl: opts.dashboardUrl,
    }),
  );

  const from = (process.env.RESEND_FROM_EMAIL || '').trim() || 'MuviDB <support@muvidb.com>';
  const replyTo = (process.env.RESEND_REPLY_TO || '').trim() || 'support@muvidb.com';
  const { data, error } = await resend.emails.send({
    from,
    to: opts.email,
    subject: 'Your MuviDB actor profile has been verified',
    replyTo,
    html,
  });
  if (error) return { ok: false as const, error: error.message || 'Email send failed' };
  return { ok: true as const, emailId: data?.id || null };
}
