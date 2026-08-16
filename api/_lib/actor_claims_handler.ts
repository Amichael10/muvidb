import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getCorsHeaders } from './cors.js';
import { supabase } from './supabase.js';
import { sendActorClaimApprovedEmail } from './actor_claim_email.js';

function cors(req: VercelRequest, res: VercelResponse) {
  const headers = getCorsHeaders(req);
  res.setHeader('Access-Control-Allow-Origin', headers['Access-Control-Allow-Origin']);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Vary', 'Origin');
}

async function fullAdmin(req: VercelRequest) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return null;
  const token = header.slice(7).trim();
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return null;
  const { data: profile } = await supabase.from('users').select('role').eq('id', data.user.id).single();
  return profile?.role === 'admin' ? data.user : null;
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

  const admin = await fullAdmin(req);
  if (!admin) return res.status(403).json({ error: 'Full admin access required' });

  const action = String(req.body?.action || '');
  const id = String(req.body?.id || '');
  const note = typeof req.body?.note === 'string' ? req.body.note.trim() : null;
  if (!id) return res.status(400).json({ error: 'Request id is required' });

  try {
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
        .select('id,status,verification_status,approval_email_sent_at,users(name,email),people(name)')
        .eq('id', id).single();
      if (claimError) throw claimError;
      if (claim.status !== 'approved' || claim.verification_status !== 'verified') {
        return res.status(400).json({ error: 'Only verified claims can receive an approval email' });
      }
      if (claim.approval_email_sent_at) return res.status(200).json({ success: true, email: { sent: true, skipped: true } });
      const user = Array.isArray(claim.users) ? claim.users[0] : claim.users;
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
    console.error('[actor-claims]', action, error);
    return res.status(400).json({ error: error?.message || 'Request failed' });
  }
}
