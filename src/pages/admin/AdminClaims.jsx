import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from '@iconify/react';
import { toast } from 'react-hot-toast';
import { supabase } from '../../lib/supabase';
import { authHeaders } from '../../lib/apiAuth';

export default function AdminClaims() {
  const [claims, setClaims] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(null);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.from('profile_claims')
      .select('*,users(name,email,avatar_url),people(name,slug,photo_url,is_verified,claimed_by)')
      .or('status.eq.pending,and(status.eq.approved,verification_status.eq.verified,approval_email_sent_at.is.null)')
      .order('created_at', { ascending: true });
    if (error) toast.error(error.message);
    setClaims(data || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const act = async (claim, action, note = null) => {
    setBusy(claim.id);
    const response = await fetch('/api/actor-claims', {
      method: 'POST', headers: await authHeaders(), body: JSON.stringify({ action, id: claim.id, note }),
    });
    const body = await response.json().catch(() => ({}));
    setBusy(null);
    if (!response.ok) return toast.error(body.error || 'Action failed');
    if (action === 'approve-claim') {
      toast.success(body.email?.sent ? 'Claim approved and verification email sent.' : 'Claim approved. Email delivery needs attention.');
    } else toast.success('Claim updated.');
    load();
  };

  const reject = (claim) => {
    const reason = window.prompt('Reason shown to the claimant:');
    if (reason?.trim()) act(claim, 'reject-claim', reason.trim());
  };

  if (loading) return <div className="h-52 animate-pulse rounded-2xl bg-surface" />;

  return (
    <div className="space-y-7">
      <header><p className="text-[10px] font-black uppercase tracking-[.2em] text-brand">Identity review</p><div className="mt-2 flex items-center gap-3"><h1 className="text-3xl font-black text-text-primary">Actor claims</h1><span className="rounded-lg bg-brand/10 px-3 py-1 text-xs font-black text-brand">{claims.length}</span></div><p className="mt-3 max-w-2xl text-sm text-text-muted">Contact the selected social account from an official MuviDB account. Only approve after the reply comes from that account.</p></header>

      {claims.length === 0 ? <div className="rounded-2xl border border-border bg-surface py-20 text-center"><Icon icon="solar:verified-check-bold" width="38" className="mx-auto text-green-500" /><h2 className="mt-4 text-lg font-black text-text-primary">Claim queue is clear</h2></div> : <div className="space-y-4">{claims.map((claim) => {
        const reference = String(claim.id).slice(0, 8).toUpperCase();
        return <article key={claim.id} className="rounded-2xl border border-border bg-surface p-6 lg:p-8">
          <div className="grid gap-7 lg:grid-cols-[180px_1fr_260px]">
            <div className="text-center"><img src={claim.people?.photo_url || '/images/person-placeholder.png'} alt="" className="mx-auto h-24 w-24 rounded-2xl object-cover" /><h2 className="mt-3 font-black text-text-primary">{claim.people?.name || 'Unknown actor'}</h2><Link to={`/people/${claim.people?.slug || claim.person_id}`} target="_blank" className="mt-2 inline-block text-xs font-bold text-brand">View profile</Link></div>
            <div className="space-y-4 border-y border-border py-6 lg:border-x lg:border-y-0 lg:px-7 lg:py-0">
              <div><p className="text-[10px] font-black uppercase tracking-widest text-text-muted">Claimant</p><p className="mt-1 text-sm font-black text-text-primary">{claim.users?.name}</p><p className="text-xs text-text-muted">{claim.users?.email}</p></div>
              <div className="rounded-xl bg-surface-2 p-4"><div className="flex items-center justify-between gap-3"><div><p className="text-[10px] font-black uppercase tracking-widest text-text-muted">Contact on {claim.social_platform}</p><a href={claim.social_url} target="_blank" rel="noreferrer" className="mt-1 block text-sm font-black text-brand">{claim.social_handle}</a></div><Icon icon="solar:chat-round-line-bold" width="26" className="text-brand" /></div></div>
              <div className="grid grid-cols-2 gap-3"><div className="rounded-xl border border-border p-3"><p className="text-[9px] font-bold uppercase tracking-widest text-text-muted">Claim reference</p><p className="mt-1 font-mono font-black text-text-primary">{reference}</p></div><div className="rounded-xl border border-border p-3"><p className="text-[9px] font-bold uppercase tracking-widest text-text-muted">Code</p><p className="mt-1 font-mono text-lg font-black text-brand">{claim.verification_code}</p></div></div>
              {claim.note && <blockquote className="border-l-2 border-brand pl-4 text-xs leading-6 text-text-muted">{claim.note}</blockquote>}
            </div>
            <div className="flex flex-col justify-center gap-3">
              <div className="mb-2 rounded-xl border border-border bg-surface-2 p-3"><p className="text-[9px] font-bold uppercase tracking-widest text-text-muted">Verification state</p><p className="mt-1 text-sm font-black capitalize text-text-primary">{claim.verification_status.replace('_', ' ')}</p></div>
              {claim.status === 'approved' && !claim.approval_email_sent_at && <button disabled={busy === claim.id} onClick={() => act(claim, 'retry-approval-email')} className="rounded-xl bg-brand py-3 text-xs font-black text-white">Retry approval email</button>}
              {claim.status === 'pending' && claim.verification_status === 'awaiting_contact' && <button disabled={busy === claim.id} onClick={() => act(claim, 'mark-contacted', `Contacted ${claim.social_handle} on ${claim.social_platform}.`)} className="rounded-xl border border-brand py-3 text-xs font-black text-brand">Mark contacted</button>}
              {claim.verification_status === 'contacted' && <button disabled={busy === claim.id} onClick={() => act(claim, 'mark-confirmed', `Confirmation received from ${claim.social_handle}.`)} className="rounded-xl border border-green-500 py-3 text-xs font-black text-green-500">Mark reply confirmed</button>}
              {['confirmed','verified'].includes(claim.verification_status) && <button disabled={busy === claim.id} onClick={() => act(claim, 'approve-claim')} className="rounded-xl bg-brand py-3 text-xs font-black text-white">Approve claim + send email</button>}
              {claim.status === 'pending' && <button disabled={busy === claim.id} onClick={() => reject(claim)} className="rounded-xl border border-border py-3 text-xs font-black text-red-500">Reject claim</button>}
            </div>
          </div>
        </article>;
      })}</div>}
    </div>
  );
}
