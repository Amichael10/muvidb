import React from 'react';
import { render } from '@react-email/render';
// Precompiled by scripts/build_email_templates.mjs. Import the generated .js sibling.
import MuviDbContributionThankYouEmail from './MuviDbContributionThankYouEmail.generated.js';
import type { ContributionKind, ApprovedContributionItem } from './MuviDbContributionThankYouEmail.js';
import { getResend } from './resend.js';

export type { ContributionKind, ApprovedContributionItem };

export async function sendContributionThankYouEmail(opts: {
  toEmail: string;
  contributorName?: string;
  items?: ApprovedContributionItem[];
  contributionType?: ContributionKind | string;
  itemTitle?: string;
  itemUrl?: string;
  detailsSummary?: string;
}) {
  const resend = getResend();
  if (!resend) return { ok: false as const, error: 'RESEND_API_KEY not configured' };

  const normalizedItems: ApprovedContributionItem[] =
    opts.items && opts.items.length > 0
      ? opts.items
      : [
          {
            itemTitle: opts.itemTitle || 'Your contribution',
            itemUrl: opts.itemUrl || 'https://muvidb.com',
            contributionType: opts.contributionType || 'general',
            detailsSummary:
              opts.detailsSummary || 'Your proposed update was verified and published to the live catalogue.',
          },
        ];

  const html = await render(
    React.createElement(MuviDbContributionThankYouEmail, {
      contributorName: opts.contributorName || 'Film Friend',
      items: normalizedItems,
      logoUrl: 'https://muvidb.com/brand/wordmark-dark.png',
    }),
  );

  const envFrom = (process.env.RESEND_FROM_EMAIL || '').trim();
  const emailMatch = envFrom.match(/<([^>]+)>/);
  const baseEmail = emailMatch ? emailMatch[1] : (envFrom.includes('@') ? envFrom : 'support@muvidb.com');
  const from = `MuviDB Community <${baseEmail}>`;
  const replyTo = (process.env.RESEND_REPLY_TO || '').trim() || 'support@muvidb.com';

  const subject =
    normalizedItems.length > 1
      ? `Your ${normalizedItems.length} contributions are now live on MuviDB! 🎬`
      : `Your contribution to "${normalizedItems[0]?.itemTitle || 'MuviDB'}" is now live! 🎬`;

  const { data, error } = await resend.emails.send({
    from,
    to: opts.toEmail,
    subject,
    replyTo,
    html,
  });

  if (error) return { ok: false as const, error: error.message || 'Email delivery failed' };
  return { ok: true as const, emailId: data?.id || null };
}
