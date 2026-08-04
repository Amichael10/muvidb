import React from 'react';
import { render } from '@react-email/render';
import MuviDbWelcomeEmail from '../../emails/MuviDbWelcomeEmail';
import { getResend } from './resend.js';
import { supabase } from './supabase.js';

const SITE = 'https://muvidb.com';

/**
 * From address must be a mailbox/domain you verified in Resend.
 * Display name can still say "Welcome" even when the address is support@.
 * Override with RESEND_FROM_EMAIL if needed, e.g.
 *   MuviDB Welcome <support@muvidb.com>
 */
const DEFAULT_FROM = 'MuviDB Welcome <support@muvidb.com>';
const DEFAULT_REPLY_TO = 'support@muvidb.com';

const FALLBACK_POSTER = `${SITE}/images/film-placeholder.webp`;

export const WELCOME_EMAIL_ASSETS = {
  logoUrl: `${SITE}/images/MuviDB%20Brand/Black%20Wordmark.svg`,
  social: {
    instagram: 'https://www.instagram.com/muvidb_/',
    x: 'https://twitter.com/muvidb_',
    tiktok: 'https://www.tiktok.com/@muvidb',
    linkedin: 'https://www.linkedin.com/company/muvidb/',
  },
} as const;

export type WelcomeCollage = {
  featuredPerson: string;
  actor: string;
  filmmaker: string;
  moviePoster: string;
  productionStill: string;
};

/**
 * Pull collage images from the same featured-film set as the Home hero
 * (`is_featured`, view_count ordered, limit 6). Prefer poster, then backdrop.
 */
export async function getHeroCollage(): Promise<WelcomeCollage> {
  const { data: films, error } = await supabase
    .from('films')
    .select('poster_url, backdrop_url')
    .eq('is_featured', true)
    .or('source.neq.mubi,source.is.null,countries.cs.{Nigeria}')
    .order('view_count', { ascending: false })
    .limit(6);

  if (error) {
    console.warn('[welcome-email] hero collage query failed:', error.message);
  }

  const urls: string[] = [];
  for (const film of films || []) {
    const poster = typeof film.poster_url === 'string' ? film.poster_url.trim() : '';
    const backdrop = typeof film.backdrop_url === 'string' ? film.backdrop_url.trim() : '';
    if (poster) urls.push(poster);
    if (backdrop && backdrop !== poster) urls.push(backdrop);
  }

  const unique = [...new Set(urls)].filter(Boolean);
  while (unique.length < 5) unique.push(FALLBACK_POSTER);

  return {
    featuredPerson: unique[0],
    actor: unique[1],
    filmmaker: unique[2],
    moviePoster: unique[3],
    productionStill: unique[4],
  };
}

export type SendWelcomeEmailResult =
  | { ok: true; emailId?: string; skipped?: 'already_sent' | 'no_email' }
  | { ok: false; error: string };

/**
 * Send the branded welcome email. Idempotent via auth app_metadata.welcome_email_sent.
 * Call only from server code — never from the browser with the Resend key.
 */
export async function sendWelcomeEmail(opts: {
  userId: string;
  email: string;
  firstName?: string | null;
}): Promise<SendWelcomeEmailResult> {
  const email = (opts.email || '').trim().toLowerCase();
  if (!email) return { ok: true, skipped: 'no_email' };

  const resend = getResend();
  if (!resend) {
    console.error('[welcome-email] RESEND_API_KEY not configured');
    return { ok: false, error: 'RESEND_API_KEY not configured on the server' };
  }

  // Idempotency via auth app_metadata (needs service role). If admin API is
  // unavailable we still send — the JWT already authenticated this user.
  let existingMeta: Record<string, unknown> = {};
  try {
    const { data: authUser, error: getErr } = await supabase.auth.admin.getUserById(opts.userId);
    if (getErr) {
      console.warn('[welcome-email] admin getUserById failed (continuing):', getErr.message);
    } else if (authUser?.user?.app_metadata?.welcome_email_sent) {
      return { ok: true, skipped: 'already_sent' };
    } else {
      existingMeta = (authUser?.user?.app_metadata || {}) as Record<string, unknown>;
    }
  } catch (err: any) {
    console.warn('[welcome-email] admin lookup threw (continuing):', err?.message || err);
  }

  const firstName =
    (opts.firstName || '').trim().split(/\s+/).filter(Boolean)[0]
    || 'there';

  const from = (process.env.RESEND_FROM_EMAIL || '').trim() || DEFAULT_FROM;
  const replyTo = (process.env.RESEND_REPLY_TO || '').trim() || DEFAULT_REPLY_TO;

  let collage: WelcomeCollage;
  try {
    collage = await getHeroCollage();
  } catch (err: any) {
    console.warn('[welcome-email] collage failed, using placeholders:', err?.message || err);
    collage = {
      featuredPerson: FALLBACK_POSTER,
      actor: FALLBACK_POSTER,
      filmmaker: FALLBACK_POSTER,
      moviePoster: FALLBACK_POSTER,
      productionStill: FALLBACK_POSTER,
    };
  }

  let html: string;
  try {
    html = await render(
      React.createElement(MuviDbWelcomeEmail, {
        firstName,
        logoUrl: WELCOME_EMAIL_ASSETS.logoUrl,
        exploreUrl: SITE,
        helpUrl: `${SITE}/about`,
        unsubscribeUrl: `${SITE}/dashboard`,
        collage,
        social: { ...WELCOME_EMAIL_ASSETS.social },
      }),
    );
  } catch (err: any) {
    console.error('[welcome-email] render failed:', err);
    return { ok: false, error: `Email render failed: ${err?.message || err}` };
  }

  const { data, error } = await resend.emails.send({
    from,
    to: email,
    subject: 'Welcome to MuviDB',
    replyTo,
    html,
  });

  if (error) {
    console.error('[welcome-email] Resend error:', error);
    return {
      ok: false,
      error: error.message || 'Resend rejected the send — check From domain and API key',
    };
  }

  // Mark sent so retries / OAuth re-logins do not spam.
  try {
    const { error: metaErr } = await supabase.auth.admin.updateUserById(opts.userId, {
      app_metadata: {
        ...existingMeta,
        welcome_email_sent: true,
        welcome_email_sent_at: new Date().toISOString(),
      },
    });
    if (metaErr) {
      console.warn('[welcome-email] sent but failed to mark metadata:', metaErr.message);
    }
  } catch (err: any) {
    console.warn('[welcome-email] sent but metadata update threw:', err?.message || err);
  }

  return { ok: true, emailId: data?.id };
}
