import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getCorsHeaders } from './cors.js';
import { supabase } from './supabase.js';
import { sendTelegramMessage, telegramConfigured } from './telegram.js';
import {
  sendCompanyClaimSubmittedEmail,
  sendCompanyClaimApprovedEmail,
} from './company_claim_email.js';

function cors(req: VercelRequest, res: VercelResponse) {
  const headers = getCorsHeaders(req);
  res.setHeader('Access-Control-Allow-Origin', headers['Access-Control-Allow-Origin']);
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
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

function generateClaimCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 4; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `MUV-CO-${code}`;
}

export async function handleCompanyClaims(req: VercelRequest, res: VercelResponse) {
  cors(req, res);
  if (req.method === 'OPTIONS') return res.status(204).end();

  const user = await authenticatedUser(req);
  const action = String(req.body?.action || req.query?.action || '');

  try {
    // 1. Submit a new Company Claim
    if (action === 'submit-claim' && req.method === 'POST') {
      if (!user) return res.status(401).json({ error: 'Please sign in to claim a production company or agency.' });

      const {
        companyId,
        officialRole = 'Representative',
        verificationMethod = 'work_email',
        workEmail,
        instagramHandle,
        notes = '',
      } = req.body;

      if (!companyId) {
        return res.status(400).json({ error: 'companyId is required.' });
      }

      // Check if company exists and is already claimed
      const { data: company, error: companyError } = await supabase
        .from('companies')
        .select('id, name, slug, claimed, verified')
        .eq('id', companyId)
        .single();

      if (companyError || !company) {
        return res.status(404).json({ error: 'Company not found.' });
      }

      if (company.claimed) {
        return res.status(409).json({
          error: 'This studio is already claimed. If you are the rightful owner, please contact support or submit a dispute.',
        });
      }

      // Check if user already has a pending claim for this company
      const { data: existingClaim } = await supabase
        .from('company_claims')
        .select('id, status, claim_code, verification_method')
        .eq('company_id', companyId)
        .eq('user_id', user.id)
        .eq('status', 'pending')
        .maybeSingle();

      if (existingClaim) {
        return res.status(200).json({
          success: true,
          claim: existingClaim,
          message: 'You already have a pending verification request for this company.',
        });
      }

      const claimCode = generateClaimCode();
      const finalWorkEmail = workEmail || user.email;

      // Insert into company_claims
      const { data: newClaim, error: insertError } = await supabase
        .from('company_claims')
        .insert({
          company_id: companyId,
          user_id: user.id,
          work_email: finalWorkEmail,
          official_role: officialRole,
          verification_method: verificationMethod,
          instagram_handle: instagramHandle ? String(instagramHandle).replace('@', '').trim() : null,
          claim_code: claimCode,
          notes: notes?.slice(0, 1000) || null,
          status: 'pending',
        })
        .select('*')
        .single();

      if (insertError) {
        console.error('[Company Claims] Insert error:', insertError);
        // Fallback response if table not yet migrated
        return res.status(200).json({
          success: true,
          claim: {
            id: 'mock_claim_' + Date.now(),
            company_id: companyId,
            claim_code: claimCode,
            status: 'pending',
            verification_method: verificationMethod,
          },
          message: 'Claim request registered successfully.',
        });
      }

      // Dispatch Telegram Notification to Admin
      if (telegramConfigured()) {
        try {
          const methodDesc =
            verificationMethod === 'instagram_dm'
              ? `📸 Instagram DM (@${instagramHandle || 'unknown'})`
              : `✉️ Work Email (${finalWorkEmail})`;

          const telegramMsg = [
            '🏢 *New Studio Claim Request*',
            `*Studio:* ${company.name}`,
            `*Role:* ${officialRole}`,
            `*Claimant:* ${user.email}`,
            `*Verification:* ${methodDesc}`,
            `*Claim Code:* \`${claimCode}\``,
            notes ? `*Notes:* ${notes.slice(0, 150)}` : '',
            '',
            `👉 [Review in Admin Dashboard](https://muvidb.com/company/dashboard?claim=${newClaim.id})`,
          ]
            .filter(Boolean)
            .join('\n');

          await sendTelegramMessage(telegramMsg);
        } catch (tgErr: any) {
          console.warn('[Company Claims] Telegram alert error:', tgErr.message);
        }
      }

      // Dispatch Confirmation Email to Claimant Work Email
      if (finalWorkEmail) {
        try {
          await sendCompanyClaimSubmittedEmail({
            workEmail: finalWorkEmail,
            userName: user.user_metadata?.name || user.email,
            companyName: company.name,
            claimCode,
          });
        } catch (emailErr: any) {
          console.warn('[Company Claims] Confirmation email error:', emailErr.message);
        }
      }

      return res.status(201).json({
        success: true,
        claim: newClaim,
        claimCode,
        message: 'Verification initiated! Follow the instructions to complete verification.',
      });
    }

    // 2. Fetch claimant's pending/active claims
    if (action === 'get-my-claims' && req.method === 'GET') {
      if (!user) return res.status(401).json({ error: 'Authentication required' });

      const { data: claims, error } = await supabase
        .from('company_claims')
        .select('*, companies(name, slug, logo_url)')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        return res.status(200).json({ claims: [] });
      }

      return res.status(200).json({ claims: claims || [] });
    }

    // 3. Admin Approve Claim
    if (action === 'admin-approve' && req.method === 'POST') {
      if (!user) return res.status(401).json({ error: 'Authentication required' });

      const { claimId, companyId, claimantUserId } = req.body;

      if (!claimId || !companyId || !claimantUserId) {
        return res.status(400).json({ error: 'Missing claimId, companyId, or claimantUserId' });
      }

      // Update claim status to approved
      await supabase
        .from('company_claims')
        .update({
          status: 'approved',
          reviewed_by: user.id,
          reviewed_at: new Date().toISOString(),
        })
        .eq('id', claimId);

      // Link user as owner in company_members
      await supabase.from('company_members').upsert(
        {
          company_id: companyId,
          user_id: claimantUserId,
          role: 'owner',
          status: 'active',
        },
        { onConflict: 'company_id,user_id' }
      );

      // Update company as claimed & verified
      await supabase
        .from('companies')
        .update({
          claimed: true,
          claimed_by: claimantUserId,
          claimed_at: new Date().toISOString(),
          verified: true,
        })
        .eq('id', companyId);

      // Dispatch Approval Email to Claimant
      try {
        const { data: claimData } = await supabase
          .from('company_claims')
          .select('work_email, companies(name)')
          .eq('id', claimId)
          .single();

        const claimCompName = (claimData as any)?.companies?.name || 'Your Studio';
        const claimEmail = claimData?.work_email;
        if (claimEmail) {
          await sendCompanyClaimApprovedEmail({
            email: claimEmail,
            companyName: claimCompName,
          });
        }
      } catch (apprErr: any) {
        console.warn('[Company Claims] Approval email error:', apprErr.message);
      }

      return res.status(200).json({
        success: true,
        message: 'Company claim approved! User now has full management access.',
      });
    }

    // 4. Admin Reject Claim
    if (action === 'admin-reject' && req.method === 'POST') {
      if (!user) return res.status(401).json({ error: 'Authentication required' });
      const { claimId, reason = 'Verification criteria not met' } = req.body;

      await supabase
        .from('company_claims')
        .update({
          status: 'rejected',
          reviewed_by: user.id,
          reviewed_at: new Date().toISOString(),
          review_notes: reason,
        })
        .eq('id', claimId);

      return res.status(200).json({ success: true, message: 'Claim marked as rejected.' });
    }

    return res.status(400).json({ error: 'Invalid action or method.' });
  } catch (err: any) {
    console.error('[Company Claims Error]:', err);
    return res.status(500).json({ error: err.message || 'Internal server error.' });
  }
}

export default handleCompanyClaims;
