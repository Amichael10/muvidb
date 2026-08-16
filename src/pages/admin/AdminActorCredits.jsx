import { useEffect, useState } from 'react';
import { Icon } from '@iconify/react';
import { toast } from 'react-hot-toast';
import { supabase } from '../../lib/supabase';
import { authHeaders } from '../../lib/apiAuth';
import { formatRole } from '../../lib/creditRoles';

const OPEN = ['submitted', 'in_review', 'needs_information'];

export default function AdminActorCredits() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(null);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.from('actor_credit_requests').select(`
      *, users:submitted_by(name,email), people(name,slug,photo_url),
      films:film_id(id,title,slug,year,poster_url),
      credits:credit_id(id,role,character_name,films(id,title,slug,year,poster_url))
    `).in('status', OPEN).order('created_at', { ascending: true });
    if (error) toast.error(error.message);
    setRequests(data || []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const act = async (request, approve) => {
    const note = approve ? window.prompt('Internal approval note (optional):') : window.prompt('Rejection reason shown to the actor:');
    if (!approve && !note?.trim()) return;
    setBusy(request.id);
    const response = await fetch('/api/actor-claims', { method: 'POST', headers: await authHeaders(), body: JSON.stringify({ action: approve ? 'approve-credit' : 'reject-credit', id: request.id, note: note?.trim() || null }) });
    const body = await response.json().catch(() => ({}));
    setBusy(null);
    if (!response.ok) return toast.error(body.error || 'Review failed');
    toast.success(approve ? 'Catalogue change approved.' : 'Request rejected.');
    load();
  };

  if (loading) return <div className="h-52 animate-pulse rounded-2xl bg-surface" />;
  return <div className="space-y-7">
    <header><p className="text-[10px] font-black uppercase tracking-[.2em] text-brand">Catalogue moderation</p><div className="mt-2 flex items-center gap-3"><h1 className="text-3xl font-black text-text-primary">Actor credit requests</h1><span className="rounded-lg bg-brand/10 px-3 py-1 text-xs font-black text-brand">{requests.length}</span></div><p className="mt-3 text-sm text-text-muted">Nothing here changes the live catalogue until a full admin approves it.</p></header>
    {requests.length === 0 ? <div className="rounded-2xl border border-border bg-surface py-20 text-center"><Icon icon="solar:clipboard-check-bold" width="38" className="mx-auto text-green-500" /><h2 className="mt-4 text-lg font-black text-text-primary">Credit queue is clear</h2></div> : <div className="space-y-4">{requests.map((request) => {
      const film = request.films || request.credits?.films || request.proposed_film;
      return <article key={request.id} className="rounded-2xl border border-border bg-surface p-6">
        <div className="grid gap-6 lg:grid-cols-[220px_1fr_220px]">
          <div className="flex items-center gap-4 lg:block lg:text-center"><img src={request.people?.photo_url || '/images/person-placeholder.png'} alt="" className="h-20 w-20 rounded-2xl object-cover lg:mx-auto" /><div><h2 className="mt-2 font-black text-text-primary">{request.people?.name}</h2><p className="text-xs text-text-muted">{request.users?.email}</p></div></div>
          <div className="border-y border-border py-5 lg:border-x lg:border-y-0 lg:px-6 lg:py-0"><p className="text-[10px] font-black uppercase tracking-widest text-brand">{request.request_type.replaceAll('_', ' ')}</p><h3 className="mt-2 text-xl font-black text-text-primary">{film?.title || 'Unknown film'}</h3><p className="mt-1 text-sm text-text-muted">{film?.year || 'Year unknown'}{request.role ? ` · ${formatRole(request.role)}` : ''}{request.character_name ? ` as ${request.character_name}` : ''}</p>{request.note && <p className="mt-4 rounded-xl bg-surface-2 p-4 text-xs leading-6 text-text-muted">{request.note}</p>}{request.evidence_url && <a href={request.evidence_url} target="_blank" rel="noreferrer" className="mt-3 inline-block text-xs font-black text-brand">Open supporting source ↗</a>}{request.request_type === 'add_new_film' && <dl className="mt-4 grid grid-cols-2 gap-2">{Object.entries(request.proposed_film || {}).filter(([,value]) => value !== '' && value != null && (!Array.isArray(value) || value.length)).map(([key,value]) => <div key={key} className="rounded-lg border border-border p-2"><dt className="text-[9px] font-bold uppercase text-text-muted">{key.replaceAll('_',' ')}</dt><dd className="mt-1 break-words text-xs text-text-primary">{Array.isArray(value) ? value.join(', ') : String(value)}</dd></div>)}</dl>}</div>
          <div className="flex flex-col justify-center gap-3"><button disabled={busy === request.id} onClick={() => act(request, true)} className="rounded-xl bg-brand py-3 text-xs font-black text-white">Approve request</button><button disabled={busy === request.id} onClick={() => act(request, false)} className="rounded-xl border border-border py-3 text-xs font-black text-red-500">Reject request</button></div>
        </div>
      </article>;
    })}</div>}
  </div>;
}
