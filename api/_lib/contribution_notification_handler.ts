import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getCorsHeaders } from './cors.js';
import { getSupabase } from './supabase.js';
import { sendContributionThankYouEmail, type ApprovedContributionItem, type ContributionKind } from './contribution_email.js';

function cors(req: VercelRequest, res: VercelResponse) {
  const headers = getCorsHeaders(req);
  res.setHeader('Access-Control-Allow-Origin', headers['Access-Control-Allow-Origin']);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Vary', 'Origin');
}

async function authenticatedUser(req: VercelRequest) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return null;
  const token = header.slice(7).trim();
  const supabase = getSupabase();
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return null;
  return data.user;
}

async function isAdmin(user: { id: string } | null) {
  if (!user) return false;
  const supabase = getSupabase();
  const { data: profile } = await supabase.from('users').select('role').eq('id', user.id).maybeSingle();
  return profile?.role === 'admin';
}

function resolveItemKind(type?: string | null, payload?: any, imagePath?: string | null): { kind: ContributionKind; summary: string } {
  const t = String(type || '');
  const fields = payload?.fields || payload || {};
  const fieldKeys = Object.keys(fields);

  if (imagePath || t.includes('poster') || fieldKeys.includes('poster') || fieldKeys.includes('poster_url')) {
    return {
      kind: 'poster',
      summary: 'High-resolution official artwork verified and set as primary key art.',
    };
  }

  if (t === 'new_film') {
    return {
      kind: 'general',
      summary: 'New film production record verified and added to the living catalogue.',
    };
  }

  if (t === 'new_person') {
    return {
      kind: 'credits',
      summary: 'New talent profile verified and documented in the Nollywood directory.',
    };
  }

  if (fieldKeys.includes('synopsis') || fieldKeys.includes('tagline') || fieldKeys.includes('bio')) {
    return {
      kind: 'synopsis',
      summary: 'Storyline, synopsis, and biographical context enriched.',
    };
  }

  if (fieldKeys.includes('release_date') || fieldKeys.includes('year') || fieldKeys.includes('release_type')) {
    return {
      kind: 'release_date',
      summary: 'Theatrical status and release chronology verified.',
    };
  }

  if (fieldKeys.includes('trailer_youtube_id') || fieldKeys.includes('youtube_watch_url')) {
    return {
      kind: 'trailer',
      summary: 'Official trailer / stream link verified and embedded.',
    };
  }

  if (fieldKeys.length > 0) {
    const formatted = fieldKeys.map((k) => k.replace(/_/g, ' ')).join(', ');
    return {
      kind: 'general',
      summary: `Verified catalogue updates applied to: ${formatted}.`,
    };
  }

  return {
    kind: 'general',
    summary: 'Catalogue record improvement verified and published.',
  };
}

export async function handleContributionNotifications(req: VercelRequest, res: VercelResponse) {
  cors(req, res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const user = await authenticatedUser(req);
  const isUserAdmin = await isAdmin(user);
  if (!user || !isUserAdmin) {
    return res.status(403).json({ error: 'Admin privileges required' });
  }

  const supabase = getSupabase();
  const action = String(req.body?.action || 'on-contribution-reviewed');
  const contributionId = req.body?.contributionId ? String(req.body.contributionId) : null;
  const targetUserId = req.body?.userId ? String(req.body.userId) : null;
  const forceSend = Boolean(req.body?.forceSend);

  try {
    let submitterId = targetUserId;

    if (contributionId) {
      const { data: currentContrib, error: contribErr } = await supabase
        .from('contributions')
        .select('*')
        .eq('id', contributionId)
        .maybeSingle();

      if (contribErr) throw contribErr;
      if (!currentContrib) {
        return res.status(404).json({ error: 'Contribution not found' });
      }

      if (!currentContrib.submitted_by) {
        return res.status(200).json({
          ok: true,
          status: 'skipped',
          reason: 'Anonymous / unauthenticated submission. No user account to notify.',
        });
      }

      submitterId = currentContrib.submitted_by;
    }

    if (!submitterId) {
      return res.status(400).json({ error: 'Missing contributionId or userId' });
    }

    // 1. Read the WHOLE pending contribution queue for this user
    const { count: pendingCount, error: countErr } = await supabase
      .from('contributions')
      .select('id', { count: 'exact', head: true })
      .eq('submitted_by', submitterId)
      .eq('status', 'pending');

    if (countErr) throw countErr;

    // 2. If the user still has other pending contributions and we are not force sending,
    // HOLD the email so we don't spam or blast the user with multiple emails while the admin is reviewing!
    if ((pendingCount ?? 0) > 0 && !forceSend) {
      return res.status(200).json({
        ok: true,
        status: 'held',
        remainingPending: pendingCount,
        message: `Notification held: contributor has ${pendingCount} other pending contribution(s) awaiting review.`,
      });
    }

    // 3. User has 0 pending contributions remaining (or forceSend is true).
    // Read all approved contributions for this user that have NOT yet received a thank-you email.
    const { data: approvedList, error: approvedErr } = await supabase
      .from('contributions')
      .select('*')
      .eq('submitted_by', submitterId)
      .eq('status', 'approved')
      .order('reviewed_at', { ascending: false });

    if (approvedErr) throw approvedErr;

    const unnotified = (approvedList || []).filter((item) => {
      const p = item.payload || {};
      return !p.thank_you_emailed_at;
    });

    if (unnotified.length === 0) {
      return res.status(200).json({
        ok: true,
        status: 'noop',
        message: 'All approved contributions for this user have already been notified.',
      });
    }

    // 4. Retrieve contributor profile
    const { data: contributor, error: userErr } = await supabase
      .from('users')
      .select('id, name, email')
      .eq('id', submitterId)
      .maybeSingle();

    if (userErr || !contributor?.email) {
      return res.status(200).json({
        ok: true,
        status: 'skipped',
        reason: 'Contributor user has no valid email address on record.',
      });
    }

    // 5. Gather entity metadata for each approved contribution
    const emailItems: ApprovedContributionItem[] = [];

    for (const item of unnotified) {
      let title = 'Production Record';
      let url = 'https://muvidb.com';

      if (item.target_table === 'films' && item.target_id) {
        const { data: film } = await supabase
          .from('films')
          .select('title, year, slug')
          .eq('id', item.target_id)
          .maybeSingle();
        if (film) {
          title = `${film.title}${film.year ? ` (${film.year})` : ''}`;
          url = film.slug ? `https://muvidb.com/film/${film.slug}` : `https://muvidb.com/film/${film.id}`;
        }
      } else if (item.target_table === 'people' && item.target_id) {
        const { data: person } = await supabase
          .from('people')
          .select('name, slug')
          .eq('id', item.target_id)
          .maybeSingle();
        if (person) {
          title = person.name;
          url = person.slug ? `https://muvidb.com/name/${person.slug}` : `https://muvidb.com/name/${person.id}`;
        }
      } else if (item.type === 'new_film') {
        const t = item.payload?.title || 'New Film';
        const y = item.payload?.year ? ` (${item.payload.year})` : '';
        title = `${t}${y}`;
        url = 'https://muvidb.com/browse';
      } else if (item.type === 'new_person') {
        title = item.payload?.name || 'New Talent Profile';
        url = 'https://muvidb.com/people';
      } else if (item.type === 'new_channel') {
        title = item.payload?.name || 'YouTube Channel';
        url = 'https://muvidb.com/channels';
      }

      const { kind, summary } = resolveItemKind(item.type, item.payload, item.image_path);

      emailItems.push({
        id: item.id,
        itemTitle: title,
        itemUrl: url,
        contributionType: kind,
        detailsSummary: item.note || summary,
      });
    }

    // 6. Send the single consolidated thank-you email via Resend
    const sendResult = await sendContributionThankYouEmail({
      toEmail: contributor.email,
      contributorName: contributor.name || 'Film Friend',
      items: emailItems,
    });

    if (!sendResult.ok) {
      console.error('[Contribution Email] Failed sending email:', sendResult.error);
      return res.status(500).json({ error: sendResult.error });
    }

    // 7. Stamp all unnotified contributions as notified with the Resend emailId
    const nowIso = new Date().toISOString();
    await Promise.all(
      unnotified.map((item) => {
        const nextPayload = {
          ...(item.payload || {}),
          thank_you_emailed_at: nowIso,
          thank_you_email_id: sendResult.emailId,
        };
        return supabase.from('contributions').update({ payload: nextPayload }).eq('id', item.id);
      }),
    );

    return res.status(200).json({
      ok: true,
      status: 'sent',
      recipient: contributor.email,
      itemCount: unnotified.length,
      emailId: sendResult.emailId,
      items: emailItems.map((i) => i.itemTitle),
    });
  } catch (err: any) {
    console.error('[Contribution Notification Error]:', err);
    return res.status(500).json({ error: err.message || 'Server error processing contribution notification' });
  }
}
