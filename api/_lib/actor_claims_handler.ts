import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getCorsHeaders } from './cors.js';
import { supabase } from './supabase.js';
import { sendActorClaimApprovedEmail } from './actor_claim_email.js';
import { notifyActorClaimSubmission } from './actor_claim_notify.js';
import { generateProfessionalCvPdf } from './professional_cv_pdf.js';

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
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return null;
  return data.user;
}

async function fullAdmin(user: { id: string } | null) {
  if (!user) return null;
  const { data: profile } = await supabase.from('users').select('role').eq('id', user.id).single();
  return profile?.role === 'admin' ? user : null;
}

function dashboardUrl() {
  const configured = (process.env.ACTOR_DASHBOARD_BASE_URL || process.env.VITE_PUBLIC_SITE_URL || '').trim();
  const base = configured || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'https://muvidb.com');
  return `${base.replace(/\/$/, '')}/pro-dashboard`;
}

export async function handleActorClaims(req: VercelRequest, res: VercelResponse) {
  cors(req, res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const action = String(req.body?.action || '');
  const id = String(req.body?.id || '');
  const note = typeof req.body?.note === 'string' ? req.body.note.trim() : null;

  try {
    const user = await authenticatedUser(req);
    if (action === 'export-professional-cv') {
      if (!user) return res.status(403).json({ error: 'Authentication required' });
      const format = req.body?.format === 'detailed' ? 'detailed' : 'resume';
      const { data: access, error: accessError } = await supabase.from('actor_profile_access')
        .select('person_id,people(name,bio,nationality,known_for_department,slug,youtube_stats)')
        .eq('user_id', user.id).eq('status', 'active').limit(1).maybeSingle();
      if (accessError) throw accessError;
      if (!access?.person_id) return res.status(403).json({ error: 'A verified professional profile is required' });
      const [{ data: profile }, { data: credits, error: creditsError }] = await Promise.all([
        supabase.from('users').select('email,professional_roles').eq('id', user.id).single(),
        supabase.from('credits')
          .select('role,character_name,films(title,year,view_count,average_rating,liked_percent,release_type,source,youtube_watch_url,box_office_domestic,box_office_worldwide,box_office_currency,box_office_source)')
          .eq('person_id', access.person_id),
      ]);
      if (creditsError) throw creditsError;
      const person = Array.isArray(access.people) ? access.people[0] : access.people;
      if (!person?.name) return res.status(400).json({ error: 'Professional profile is incomplete' });
      const pdf = generateProfessionalCvPdf({
        format,
        person,
        email: profile?.email || user.email,
        professionalRoles: profile?.professional_roles || [],
        credits: (credits || []).map(credit => ({
          ...credit,
          films: Array.isArray(credit.films) ? (credit.films[0] || null) : credit.films,
        })),
      });
      const filename = `${String(person.name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'professional'}-${format}.pdf`;
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Cache-Control', 'private, no-store');
      return res.status(200).send(pdf);
    }

    if (action === 'submit-claim') {
      if (!user) return res.status(403).json({ error: 'Authentication required' });
      const personId = String(req.body?.personId || '').trim();
      const socialPlatform = String(req.body?.socialPlatform || '').trim().toLowerCase();
      const socialHandle = String(req.body?.socialHandle || '').trim();
      const socialUrl = String(req.body?.socialUrl || '').trim();
      const claimantNote = typeof req.body?.note === 'string' ? req.body.note.trim() : '';
      const allowedPlatforms = new Set(['instagram', 'x', 'tiktok', 'facebook', 'youtube']);
      if (!personId || !allowedPlatforms.has(socialPlatform) || !socialHandle || !socialUrl) {
        return res.status(400).json({ error: 'Actor and valid social account details are required' });
      }
      let parsedSocialUrl: URL;
      try {
        parsedSocialUrl = new URL(socialUrl);
      } catch {
        return res.status(400).json({ error: 'A valid social profile URL is required' });
      }
      const platformDomains: Record<string, string[]> = {
        instagram: ['instagram.com'],
        x: ['x.com', 'twitter.com'],
        tiktok: ['tiktok.com'],
        facebook: ['facebook.com', 'fb.com'],
        youtube: ['youtube.com', 'youtu.be'],
      };
      const hostname = parsedSocialUrl.hostname.toLowerCase().replace(/^www\./, '');
      const matchesPlatform = platformDomains[socialPlatform].some((domain) => hostname === domain || hostname.endsWith(`.${domain}`));
      if (parsedSocialUrl.protocol !== 'https:' || !matchesPlatform) {
        return res.status(400).json({ error: 'A valid social profile URL is required' });
      }

      const { data: claim, error: insertError } = await supabase.from('profile_claims').insert({
        user_id: user.id,
        person_id: personId,
        status: 'pending',
        verification_status: 'awaiting_contact',
        social_platform: socialPlatform,
        social_handle: socialHandle.slice(0, 200),
        social_url: parsedSocialUrl.toString().slice(0, 1000),
        note: claimantNote.slice(0, 2000) || null,
      }).select('id,status,verification_status,verification_code,people!profile_claims_person_id_fkey(name,slug)').single();
      if (insertError) throw insertError;

      const notification = await notifyActorClaimSubmission(claim.id, { expectedUserId: user.id });
      return res.status(201).json({ success: true, claim, notification });
    }

    if (!id && action !== 'notify-pending-claims') {
      return res.status(400).json({ error: 'Request id is required' });
    }
    if (action === 'notify-new-claim') {
      if (!user) return res.status(403).json({ error: 'Authentication required' });
      const notification = await notifyActorClaimSubmission(id, { expectedUserId: user.id });
      return res.status(200).json({ success: true, notification });
    }

    const admin = await fullAdmin(user);
    if (!admin) return res.status(403).json({ error: 'Full admin access required' });

    if (action === 'notify-pending-claims') {
      const { data: pending, error: pendingError } = await supabase.from('profile_claims')
        .select('id')
        .eq('status', 'pending')
        .is('telegram_notified_at', null)
        .order('created_at', { ascending: true })
        .limit(10);
      if (pendingError) throw pendingError;
      const results = await Promise.all((pending || []).map((claim) => notifyActorClaimSubmission(claim.id)));
      return res.status(200).json({ success: true, attempted: results.length, results });
    }

    if (action === 'mark-contacted' || action === 'mark-confirmed') {
      const patch = action === 'mark-contacted'
        ? { verification_status: 'contacted', contacted_at: new Date().toISOString(), reviewer_note: note }
        : { verification_status: 'confirmed', verified_at: new Date().toISOString(), reviewer_note: note };
      const { error } = await supabase.from('profile_claims').update(patch).eq('id', id).eq('status', 'pending');
      if (error) throw error;
      return res.status(200).json({ success: true });
    }

    if (action === 'reject-claim') {
      if (!note) return res.status(400).json({ error: 'A rejection reason is required' });
      const { error } = await supabase.from('profile_claims').update({
        status: 'rejected',
        verification_status: 'rejected',
        rejection_reason: note,
        reviewer_note: note,
        reviewed_by: admin.id,
        reviewed_at: new Date().toISOString(),
      }).eq('id', id).eq('status', 'pending');
      if (error) throw error;
      return res.status(200).json({ success: true });
    }

    if (action === 'approve-claim') {
      const { data, error } = await supabase.rpc('approve_actor_profile_claim', {
        p_claim_id: id,
        p_admin_id: admin.id,
      });
      if (error) throw error;

      let email = { sent: false, error: null as string | null };
      if (data?.email) {
        const { data: claim } = await supabase
          .from('profile_claims')
          .select('approval_email_sent_at')
          .eq('id', id)
          .single();
        if (!claim?.approval_email_sent_at) {
          const result = await sendActorClaimApprovedEmail({
            email: data.email,
            userName: data.user_name,
            personName: data.person_name,
            dashboardUrl: dashboardUrl(),
          });
          if (result.ok) {
            await supabase.from('profile_claims').update({ approval_email_sent_at: new Date().toISOString() }).eq('id', id);
            email = { sent: true, error: null };
          } else {
            console.error('[actor-claims] approval email failed:', result.error);
            email = { sent: false, error: result.error };
          }
        }
      }
      return res.status(200).json({ success: true, data, email });
    }

    if (action === 'retry-approval-email') {
      const { data: claim, error: claimError } = await supabase.from('profile_claims')
        .select('id,status,verification_status,approval_email_sent_at,claimant:users!profile_claims_user_id_fkey(name,email),people!profile_claims_person_id_fkey(name)')
        .eq('id', id).single();
      if (claimError) throw claimError;
      if (claim.status !== 'approved' || claim.verification_status !== 'verified') {
        return res.status(400).json({ error: 'Only verified claims can receive an approval email' });
      }
      if (claim.approval_email_sent_at) return res.status(200).json({ success: true, email: { sent: true, skipped: true } });
      const user = Array.isArray(claim.claimant) ? claim.claimant[0] : claim.claimant;
      const person = Array.isArray(claim.people) ? claim.people[0] : claim.people;
      if (!user?.email || !person?.name) return res.status(400).json({ error: 'Claim email details are incomplete' });
      const result = await sendActorClaimApprovedEmail({ email: user.email, userName: user.name, personName: person.name, dashboardUrl: dashboardUrl() });
      if (!result.ok) return res.status(502).json({ error: result.error });
      await supabase.from('profile_claims').update({ approval_email_sent_at: new Date().toISOString() }).eq('id', id);
      return res.status(200).json({ success: true, email: { sent: true } });
    }

    if (action === 'approve-credit' || action === 'reject-credit') {
      if (action === 'reject-credit' && !note) {
        return res.status(400).json({ error: 'A rejection reason is required' });
      }
      const { data, error } = await supabase.rpc('review_actor_credit_request', {
        p_request_id: id,
        p_admin_id: admin.id,
        p_decision: action === 'approve-credit' ? 'approve' : 'reject',
        p_note: note,
      });
      if (error) throw error;
      return res.status(200).json({ success: true, data });
    }

    return res.status(400).json({ error: 'Unknown action' });
  } catch (error: any) {
    const reference = crypto.randomUUID().slice(0, 8).toUpperCase();
    console.error('[actor-claims]', { action, reference, error });
    return res.status(400).json({
      error: 'We could not complete this request. Please try again.',
      reference,
    });
  }
}
