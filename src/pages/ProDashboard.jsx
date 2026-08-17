import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Icon } from '@iconify/react';
import { toast } from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { formatRole } from '../lib/creditRoles';
import { authHeaders } from '../lib/apiAuth';
import { professionalRoleLabel } from '../lib/professionalRoles';
import { getProfileProgress } from '../lib/professionalProfile';
import { formatViewCount } from '../utils/youtube';
import CreditRequestModal from '../components/professional/CreditRequestModal';
import ProfileEditorModal from '../components/professional/ProfileEditorModal';
import CareerPassportModal from '../components/professional/CareerPassportModal';
import CareerPassportWelcome from '../components/professional/CareerPassportWelcome';

const OPEN_STATUSES = ['submitted', 'pending', 'in_review', 'needs_information'];

function StatusPill({ status }) {
  const normalized = String(status || 'pending');
  const tone = normalized === 'approved'
    ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-400'
    : normalized === 'rejected'
      ? 'border-red-500/20 bg-red-500/10 text-red-400'
      : 'border-amber-500/20 bg-amber-500/10 text-amber-400';
  return <span className={`rounded-full border px-2.5 py-1 text-[9px] font-black uppercase tracking-wider ${tone}`}>{normalized.replaceAll('_', ' ')}</span>;
}

function MetricCard({ icon, label, value, detail }) {
  return (
    <article className="group rounded-2xl border border-white/10 bg-[#171717] p-5 transition hover:-translate-y-0.5 hover:border-brand/30">
      <div className="flex items-start justify-between"><p className="text-[9px] font-black uppercase tracking-[.2em] text-text-muted">{label}</p><span className="rounded-lg bg-brand/10 p-2 text-brand"><Icon icon={icon} width="17" /></span></div>
      <p className="mt-3 text-3xl font-black tracking-tight text-text-primary">{value}</p>
      <p className="mt-1 text-[11px] text-text-muted">{detail}</p>
    </article>
  );
}

function EmptyState({ icon, title, body, action }) {
  return <div className="rounded-2xl border border-dashed border-white/10 bg-white/[.02] px-6 py-9 text-center"><Icon icon={icon} width="30" className="mx-auto text-brand" /><h3 className="mt-3 text-sm font-black text-text-primary">{title}</h3><p className="mx-auto mt-2 max-w-sm text-xs leading-5 text-text-muted">{body}</p>{action}</div>;
}

function formatMoney(value, currency = 'NGN') {
  const amount = Number(value) || 0;
  const prefix = currency === 'NGN' ? '₦' : `${currency} `;
  if (amount >= 1_000_000_000) return `${prefix}${(amount / 1_000_000_000).toFixed(2)}B`;
  if (amount >= 1_000_000) return `${prefix}${(amount / 1_000_000).toFixed(1)}M`;
  return `${prefix}${amount.toLocaleString()}`;
}

function isYoutubeFilm(film = {}) {
  return Boolean(film.youtube_watch_url || film.release_type === 'youtube' || film.source === 'youtube');
}

export default function ProDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [access, setAccess] = useState(null);
  const [claim, setClaim] = useState(null);
  const [credits, setCredits] = useState([]);
  const [creditRequests, setCreditRequests] = useState([]);
  const [profileRequests, setProfileRequests] = useState([]);
  const [addingCredit, setAddingCredit] = useState(false);
  const [editingProfile, setEditingProfile] = useState(false);
  const [passportOpen, setPassportOpen] = useState(false);
  const [welcomeOpen, setWelcomeOpen] = useState(false);
  const [exporting, setExporting] = useState(null);

  const load = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    setLoadError(false);
    try {
      const { data: accessRow, error: accessError } = await supabase.from('actor_profile_access').select('*,people(*)').eq('user_id', user.id).eq('status', 'active').limit(1).maybeSingle();
      if (accessError) throw accessError;
      setAccess(accessRow || null);
      if (!accessRow) {
        const { data: claimRow, error: claimError } = await supabase.from('profile_claims').select('*,people(*)').eq('user_id', user.id).order('created_at', { ascending: false }).limit(1).maybeSingle();
        if (claimError) throw claimError;
        setClaim(claimRow || null);
        setCredits([]);
        setCreditRequests([]);
        setProfileRequests([]);
        return;
      }
      const [creditResponse, requestResponse, profileResponse] = await Promise.all([
        fetch(`/api/content?resource=person-credits&personId=${encodeURIComponent(accessRow.person_id)}`).then((response) => response.ok ? response.json() : Promise.reject(new Error('credits unavailable'))),
        supabase.from('actor_credit_requests').select('*').eq('submitted_by', user.id).eq('person_id', accessRow.person_id).order('created_at', { ascending: false }),
        supabase.from('contributions').select('id,status,payload,note,created_at,reviewed_at').eq('submitted_by', user.id).eq('type', 'edit_person').eq('target_id', accessRow.person_id).order('created_at', { ascending: false }),
      ]);
      if (requestResponse.error) throw requestResponse.error;
      if (profileResponse.error) throw profileResponse.error;
      setCredits(creditResponse.credits || []);
      setCreditRequests(requestResponse.data || []);
      setProfileRequests(profileResponse.data || []);
    } catch (error) {
      console.error('Professional dashboard failed to load', error);
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    document.title = 'Professional dashboard | MuviDB';
    if (user?.role === 'admin' || user?.role === 'admin_limited') navigate('/admin');
    else load();
  }, [load, navigate, user?.role]);

  useEffect(() => {
    const personId = access?.person_id || access?.people?.id;
    if (!user?.id || !personId || typeof window === 'undefined') return;
    const key = `muvidb:career-passport-welcome:${user.id}:${personId}:v1`;
    if (!window.localStorage.getItem(key)) {
      window.localStorage.setItem(key, new Date().toISOString());
      setWelcomeOpen(true);
    }
  }, [access?.people?.id, access?.person_id, user?.id]);

  const person = access?.people;
  const progress = useMemo(() => getProfileProgress(person, credits), [person, credits]);
  const pendingRemoval = useMemo(() => new Set(creditRequests.filter((request) => request.request_type === 'remove' && OPEN_STATUSES.includes(request.status)).map((request) => request.credit_id)), [creditRequests]);
  const openRequests = [...creditRequests, ...profileRequests].filter((request) => OPEN_STATUSES.includes(request.status));
  const hasPendingProfileUpdate = profileRequests.some((request) => OPEN_STATUSES.includes(request.status));
  const sortedCredits = [...credits].sort((a, b) => (b.films?.year || 0) - (a.films?.year || 0));
  const roles = (user?.professional_roles?.length ? user.professional_roles : [person?.known_for_department || 'actor']).map(professionalRoleLabel);
  const youtubeStats = person?.youtube_stats || {};
  const youtubeViews = Number(youtubeStats.views) || 0;
  const youtubeSubscribers = Number(youtubeStats.subscribers) || 0;
  const reportedBoxOffice = credits.reduce((sum, credit) => {
    const film = credit.films || {};
    if (!film.box_office_source) return sum;
    return sum + (Number(film.box_office_domestic || film.box_office_worldwide) || 0);
  }, 0);

  const requestRemoval = async (credit) => {
    const reason = window.prompt(`Why should “${credit.films?.title || 'this credit'}” be removed from your filmography?`);
    if (!reason?.trim()) return;
    try {
      const { error } = await supabase.from('actor_credit_requests').insert({ submitted_by: user.id, person_id: access.person_id, request_type: 'remove', credit_id: credit.id, note: reason.trim(), status: 'submitted' });
      if (error) throw error;
      toast.success('Removal request sent. The credit stays public while it is reviewed.');
      load();
    } catch (error) {
      console.error('Credit removal request failed', error);
      toast.error('We couldn’t send this request. Please try again.');
    }
  };

  const exportCv = async (format) => {
    setExporting(format);
    try {
      const response = await fetch('/api/actor-claims', { method: 'POST', headers: await authHeaders(), body: JSON.stringify({ action: 'export-professional-cv', format }) });
      if (!response.ok) throw new Error('export failed');
      const blob = await response.blob();
      const disposition = response.headers.get('content-disposition') || '';
      const filename = disposition.match(/filename="([^"]+)"/)?.[1] || `${person.name}-${format}.pdf`;
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      toast.success(`${format === 'resume' ? 'Resume' : 'Detailed CV'} downloaded.`);
    } catch (error) {
      console.error('Professional PDF export failed', error);
      toast.error('We couldn’t prepare your PDF right now. Please try again.');
    } finally {
      setExporting(null);
    }
  };

  if (loading) return <main className="min-h-screen bg-bg px-4 pb-20 pt-28"><div className="mx-auto max-w-7xl animate-pulse"><div className="h-72 rounded-[28px] bg-surface" /><div className="mt-5 grid gap-4 sm:grid-cols-3"><div className="h-32 rounded-2xl bg-surface" /><div className="h-32 rounded-2xl bg-surface" /><div className="h-32 rounded-2xl bg-surface" /></div></div></main>;

  if (loadError) return <main className="min-h-screen bg-bg px-4 pb-20 pt-32"><section className="mx-auto max-w-xl rounded-3xl border border-white/10 bg-surface p-9 text-center"><Icon icon="solar:cloud-cross-linear" width="40" className="mx-auto text-brand" /><h1 className="mt-4 text-2xl font-black text-text-primary">Your dashboard is taking longer to load</h1><p className="mt-3 text-sm leading-6 text-text-muted">Your information is safe. Check your connection and try again.</p><button onClick={load} className="mt-6 rounded-xl bg-brand px-6 py-3 text-xs font-black text-white">Try again</button></section></main>;

  if (!access) return (
    <main className="min-h-screen bg-bg px-4 pb-20 pt-32">
      <section className="mx-auto max-w-2xl rounded-[28px] border border-white/10 bg-surface p-8 text-center md:p-12">
        {claim?.status === 'pending' ? <><Icon icon="solar:hourglass-line-bold" width="42" className="mx-auto text-brand" /><p className="mt-5 text-[10px] font-black uppercase tracking-[.24em] text-brand">Profile claim</p><h1 className="mt-2 text-3xl font-black text-text-primary">Your claim is under review</h1><p className="mt-4 text-sm leading-7 text-text-muted">MuviDB will contact <strong className="text-text-primary">{claim.social_handle}</strong> on {claim.social_platform}. Current step: <strong className="text-text-primary">{String(claim.verification_status).replaceAll('_', ' ')}</strong>.</p><div className="mx-auto mt-6 max-w-xs rounded-2xl bg-surface-2 p-5"><p className="text-[10px] font-bold uppercase tracking-widest text-text-muted">Verification code</p><p className="mt-2 font-mono text-2xl font-black text-brand">{claim.verification_code}</p></div><div className="mx-auto mt-7 max-w-md rounded-xl border border-white/10 p-4 text-left text-xs leading-6 text-text-muted"><strong className="text-text-primary">What happens next</strong><br />Submitted → Social contact → Confirmation → Admin approval</div></> : <><Icon icon="solar:user-check-linear" width="42" className="mx-auto text-brand" /><h1 className="mt-5 text-3xl font-black text-text-primary">Connect your professional profile</h1><p className="mt-4 text-sm leading-7 text-text-muted">Find your existing MuviDB page, claim it and bring your credits into one professional workspace.</p><Link to="/claim" className="mt-7 inline-flex rounded-xl bg-brand px-7 py-3 text-xs font-black text-white">Find my profile</Link></>}
      </section>
    </main>
  );

  return (
    <main className="relative min-h-screen overflow-hidden bg-bg px-4 pb-24 pt-24">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[520px] bg-[radial-gradient(circle_at_85%_5%,rgba(255,83,31,.14),transparent_38%),radial-gradient(circle_at_10%_35%,rgba(255,255,255,.035),transparent_30%)]" />
      <section className="relative mx-auto max-w-7xl">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-4 px-1">
          <div><p className="text-[10px] font-black uppercase tracking-[.28em] text-brand">Professional dashboard</p><h1 className="mt-2 text-2xl font-black text-text-primary md:text-3xl">Welcome back, {person.name.split(' ')[0]}</h1></div>
          <div className="flex flex-wrap gap-2"><button onClick={() => setPassportOpen(true)} className="inline-flex items-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-xs font-black text-white shadow-lg shadow-brand/15"><Icon icon="solar:share-bold" width="17" /> Share Career Passport</button><Link to={`/people/${person.slug || person.id}`} className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[.03] px-4 py-2.5 text-xs font-black text-text-primary hover:border-brand/50 hover:text-brand"><Icon icon="solar:eye-linear" width="17" /> View public profile</Link></div>
        </div>

        <header className="relative overflow-hidden rounded-[30px] border border-white/10 bg-gradient-to-br from-[#1d1d1d] to-[#121212] p-6 shadow-2xl md:p-8">
          <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-brand/10 blur-3xl" />
          <div className="relative flex flex-col gap-7 lg:flex-row lg:items-center">
            <div className="relative w-fit shrink-0"><img src={person.photo_url || '/images/person-placeholder.png'} alt={person.name} className="h-32 w-28 rounded-2xl border border-white/10 object-cover shadow-xl md:h-40 md:w-36" /><span className="absolute -bottom-2 -right-2 grid h-9 w-9 place-items-center rounded-full border-4 border-[#171717] bg-brand text-white"><Icon icon="solar:verified-check-bold" width="19" /></span></div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2"><span className="rounded-full border border-brand/20 bg-brand/10 px-3 py-1 text-[9px] font-black uppercase tracking-[.18em] text-brand">Verified professional</span>{hasPendingProfileUpdate && <span className="rounded-full border border-amber-500/20 bg-amber-500/10 px-3 py-1 text-[9px] font-black uppercase tracking-[.14em] text-amber-400">Profile update in review</span>}</div>
              <h2 className="mt-4 truncate text-3xl font-black tracking-tight text-text-primary md:text-5xl">{person.name}</h2>
              <p className="mt-2 text-sm font-bold text-brand">{roles.join(' · ')}</p>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-text-muted">{person.bio || 'Complete your profile with a professional bio, career details and social links so audiences and industry teams can discover your work.'}</p>
              <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-xs text-text-muted">{person.nationality && <span><Icon icon="solar:global-linear" className="mr-1.5 inline text-brand" />{person.nationality}</span>}{person.birthplace && <span><Icon icon="solar:map-point-linear" className="mr-1.5 inline text-brand" />{person.birthplace}</span>}</div>
            </div>
            <div className="w-full shrink-0 rounded-2xl border border-white/10 bg-black/20 p-5 lg:w-64">
              <div className="flex items-center justify-between"><div><p className="text-[9px] font-black uppercase tracking-[.18em] text-text-muted">Profile strength</p><p className="mt-1 text-2xl font-black text-text-primary">{progress.percent}%</p></div><div className="relative grid h-14 w-14 place-items-center rounded-full" style={{ background: `conic-gradient(#ff531f ${progress.percent * 3.6}deg, rgba(255,255,255,.08) 0)` }}><div className="grid h-10 w-10 place-items-center rounded-full bg-[#171717] text-[10px] font-black text-text-primary">{progress.completed}/{progress.total}</div></div></div>
              <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-brand transition-all" style={{ width: `${progress.percent}%` }} /></div>
              <button onClick={() => setEditingProfile(true)} className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-brand px-4 py-3 text-xs font-black text-white shadow-lg shadow-brand/10"><Icon icon="solar:pen-new-square-linear" width="17" /> {progress.percent === 100 ? 'Update profile' : 'Complete profile'}</button>
            </div>
          </div>
        </header>

        <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard icon="solar:clapperboard-play-linear" label="Published credits" value={credits.length} detail="Credits verified by MuviDB" />
          <MetricCard icon="logos:youtube-icon" label="YouTube channel views" value={youtubeViews ? formatViewCount(youtubeViews) : '—'} detail={youtubeViews ? 'Synced from your linked channel' : 'Connect a channel to begin syncing'} />
          <MetricCard icon="solar:ticket-sale-linear" label="Reported film box office" value={reportedBoxOffice ? formatMoney(reportedBoxOffice) : '—'} detail={reportedBoxOffice ? 'Source-backed credited productions' : 'Appears when sourced figures exist'} />
          <MetricCard icon="solar:inbox-linear" label="Open requests" value={openRequests.length} detail="Currently with the editorial team" />
        </div>

        <div className="mt-7 grid gap-6 xl:grid-cols-[1.45fr_.75fr]">
          <div className="space-y-6">
            <section className="rounded-3xl border border-white/10 bg-[#171717] p-6 md:p-7">
              <div className="flex flex-wrap items-center justify-between gap-4"><div><p className="text-[9px] font-black uppercase tracking-[.2em] text-brand">Career</p><h2 className="mt-1 text-xl font-black text-text-primary">Published filmography</h2></div><button onClick={() => setAddingCredit(true)} className="inline-flex items-center gap-2 rounded-xl bg-brand px-4 py-3 text-xs font-black text-white"><Icon icon="solar:add-circle-bold" width="17" /> Add a credit</button></div>
              <div className="mt-5 space-y-3">
                {sortedCredits.length === 0 && <EmptyState icon="solar:clapperboard-text-linear" title="Build your filmography" body="Search the MuviDB catalogue or submit a missing production. An editor will verify each credit." action={<button onClick={() => setAddingCredit(true)} className="mt-4 text-xs font-black text-brand">Add your first credit →</button>} />}
                {sortedCredits.map((credit) => { const film = credit.films || {}; const boxOffice = Number(film.box_office_domestic || film.box_office_worldwide) || 0; return <article key={credit.id} className="group flex items-center gap-4 rounded-2xl border border-white/10 bg-white/[.015] p-3.5 transition hover:border-brand/25"><img src={film.poster_url || '/images/film-placeholder.webp'} alt="" className="h-20 w-14 rounded-xl object-cover" /><div className="min-w-0 flex-1"><Link to={`/films/${film.slug || credit.film_id}`} className="block truncate text-sm font-black text-text-primary group-hover:text-brand">{film.title || 'Unknown film'}</Link><p className="mt-1 text-xs text-text-muted">{formatRole(credit.role)}{credit.character_name ? ` as ${credit.character_name}` : ''} · {film.year || 'Year unknown'}</p><div className="mt-2 flex flex-wrap gap-2">{isYoutubeFilm(film) && Number(film.view_count) > 0 && <span className="rounded-full bg-red-500/10 px-2.5 py-1 text-[9px] font-black text-red-300"><Icon icon="logos:youtube-icon" className="mr-1 inline" />{formatViewCount(film.view_count)} views</span>}{film.average_rating > 0 && <span className="rounded-full bg-amber-500/10 px-2.5 py-1 text-[9px] font-black text-amber-300"><Icon icon="solar:star-bold" className="mr-1 inline" />{Number(film.average_rating).toFixed(1)}/10</span>}{boxOffice > 0 && film.box_office_source && <span title={`Source: ${film.box_office_source}`} className="rounded-full bg-emerald-500/10 px-2.5 py-1 text-[9px] font-black text-emerald-300"><Icon icon="solar:ticket-sale-linear" className="mr-1 inline" />{formatMoney(boxOffice, film.box_office_currency || 'NGN')} reported</span>}</div></div><button disabled={pendingRemoval.has(credit.id)} onClick={() => requestRemoval(credit)} className="rounded-lg border border-white/10 px-3 py-2 text-[9px] font-black text-text-muted hover:border-red-500/40 hover:text-red-400 disabled:opacity-50">{pendingRemoval.has(credit.id) ? 'Removal pending' : 'Request removal'}</button></article>; })}
              </div>
            </section>

            <section className="rounded-3xl border border-white/10 bg-[#171717] p-6 md:p-7">
              <div className="flex items-center justify-between"><div><p className="text-[9px] font-black uppercase tracking-[.2em] text-brand">Editorial review</p><h2 className="mt-1 text-xl font-black text-text-primary">Recent requests</h2></div><span className="text-xs font-bold text-text-muted">{creditRequests.length + profileRequests.length} total</span></div>
              <div className="mt-5 grid gap-3 md:grid-cols-2">
                {creditRequests.length === 0 && profileRequests.length === 0 && <div className="md:col-span-2"><EmptyState icon="solar:inbox-linear" title="No requests yet" body="Profile changes and filmography requests will appear here with their review status." /></div>}
                {profileRequests.slice(0, 3).map((request) => <article key={request.id} className="rounded-2xl border border-white/10 p-4"><div className="flex items-start justify-between gap-3"><div><p className="text-[9px] font-black uppercase tracking-wider text-brand">Profile update</p><h3 className="mt-1 text-sm font-black text-text-primary">Public profile details</h3></div><StatusPill status={request.status} /></div><p className="mt-3 text-[10px] text-text-muted">Submitted {new Date(request.created_at).toLocaleDateString()}</p></article>)}
                {creditRequests.slice(0, 5).map((request) => <article key={request.id} className="rounded-2xl border border-white/10 p-4"><div className="flex items-start justify-between gap-3"><div><p className="text-[9px] font-black uppercase tracking-wider text-brand">{request.request_type.replaceAll('_', ' ')}</p><h3 className="mt-1 text-sm font-black text-text-primary">{request.proposed_film?.title || credits.find((credit) => credit.film_id === request.film_id || credit.id === request.credit_id)?.films?.title || 'Filmography request'}</h3></div><StatusPill status={request.status} /></div>{request.rejection_reason && <p className="mt-3 rounded-lg bg-red-500/10 p-3 text-xs text-red-300">The editor needs a revision. Check the note and submit again.</p>}<p className="mt-3 text-[10px] text-text-muted">Submitted {new Date(request.created_at).toLocaleDateString()}</p></article>)}
              </div>
            </section>
          </div>

          <aside className="space-y-6">
            {(person.youtube_channel_id || youtubeViews || youtubeSubscribers) && <section className="overflow-hidden rounded-3xl border border-white/10 bg-[#171717]"><div className="h-20 bg-gradient-to-r from-red-500/20 via-brand/10 to-transparent" /><div className="p-6 pt-0"><div className="-mt-8 flex items-end gap-3"><img src={youtubeStats.thumbnail || person.photo_url || '/images/person-placeholder.png'} alt="" className="h-16 w-16 rounded-2xl border-4 border-[#171717] object-cover" /><div className="pb-1"><p className="text-[9px] font-black uppercase tracking-[.2em] text-red-400">Connected YouTube channel</p><h2 className="mt-1 text-base font-black text-text-primary">{youtubeStats.title || person.youtube_handle || person.name}</h2></div></div><div className="mt-5 grid grid-cols-3 gap-2"><div className="rounded-xl bg-white/[.03] p-3"><p className="text-[8px] font-black uppercase text-text-muted">Views</p><p className="mt-1 text-sm font-black text-text-primary">{formatViewCount(youtubeViews)}</p></div><div className="rounded-xl bg-white/[.03] p-3"><p className="text-[8px] font-black uppercase text-text-muted">Subscribers</p><p className="mt-1 text-sm font-black text-text-primary">{formatViewCount(youtubeSubscribers)}</p></div><div className="rounded-xl bg-white/[.03] p-3"><p className="text-[8px] font-black uppercase text-text-muted">Videos</p><p className="mt-1 text-sm font-black text-text-primary">{formatViewCount(youtubeStats.videos || 0)}</p></div></div><p className="mt-4 text-[10px] text-text-muted">Last synced {youtubeStats.last_updated ? new Date(youtubeStats.last_updated).toLocaleDateString() : 'after editorial approval'}</p></div></section>}
            <section className="rounded-3xl border border-white/10 bg-[#171717] p-6">
              <div className="flex items-center justify-between"><div><p className="text-[9px] font-black uppercase tracking-[.2em] text-brand">Profile checklist</p><h2 className="mt-1 text-lg font-black text-text-primary">Stand out professionally</h2></div><span className="text-xs font-black text-brand">{progress.percent}%</span></div>
              <div className="mt-5 space-y-3">{progress.checks.map((check) => <div key={check.key} className="flex items-center gap-3"><span className={`grid h-6 w-6 shrink-0 place-items-center rounded-full ${check.complete ? 'bg-emerald-500/15 text-emerald-400' : 'bg-white/[.05] text-text-muted'}`}><Icon icon={check.complete ? 'solar:check-circle-bold' : 'solar:circle-linear'} width="15" /></span><p className={`text-xs ${check.complete ? 'text-text-muted line-through decoration-white/20' : 'font-bold text-text-primary'}`}>{check.label}</p></div>)}</div>
              <button onClick={() => setEditingProfile(true)} className="mt-6 w-full rounded-xl border border-brand/40 bg-brand/5 py-3 text-xs font-black text-brand hover:bg-brand hover:text-white">Review profile details</button>
            </section>

            <section className="rounded-3xl border border-white/10 bg-gradient-to-br from-brand/10 to-[#171717] p-6">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand text-white"><Icon icon="solar:document-text-linear" width="21" /></span>
              <h2 className="mt-4 text-lg font-black text-text-primary">Career documents</h2><p className="mt-2 text-xs leading-5 text-text-muted">Download a polished PDF built from your verified MuviDB profile and filmography.</p>
              <div className="mt-5 space-y-2"><button disabled={exporting} onClick={() => exportCv('resume')} className="flex w-full items-center justify-between rounded-xl bg-brand px-4 py-3 text-xs font-black text-white disabled:opacity-50"><span>{exporting === 'resume' ? 'Preparing resume…' : 'One-page resume'}</span><Icon icon="solar:download-minimalistic-linear" width="17" /></button><button disabled={exporting} onClick={() => exportCv('detailed')} className="flex w-full items-center justify-between rounded-xl border border-white/10 px-4 py-3 text-xs font-black text-text-primary disabled:opacity-50"><span>{exporting === 'detailed' ? 'Preparing CV…' : 'Detailed career CV'}</span><Icon icon="solar:download-minimalistic-linear" width="17" /></button></div>
            </section>

            <section className="rounded-3xl border border-white/10 bg-[#171717] p-6"><p className="text-[9px] font-black uppercase tracking-[.2em] text-brand">How review works</p><div className="mt-4 space-y-4">{[['1', 'You submit a change'], ['2', 'An editor checks the details'], ['3', 'Approved updates go public']].map(([number, label]) => <div key={number} className="flex items-center gap-3"><span className="grid h-7 w-7 place-items-center rounded-full bg-white/[.05] text-[10px] font-black text-brand">{number}</span><p className="text-xs font-bold text-text-primary">{label}</p></div>)}</div><p className="mt-5 border-t border-white/10 pt-4 text-[10px] leading-5 text-text-muted"><Icon icon="solar:shield-check-linear" className="mr-1 inline text-brand" /> Professional access cannot directly delete or overwrite public catalogue records.</p></section>
          </aside>
        </div>
      </section>
      {addingCredit && <CreditRequestModal person={person} onClose={() => setAddingCredit(false)} onSaved={load} />}
      {editingProfile && <ProfileEditorModal person={person} onClose={() => setEditingProfile(false)} onSaved={load} />}
      {welcomeOpen && <CareerPassportWelcome firstName={person.name?.split(' ')[0]} onDismiss={() => setWelcomeOpen(false)} onCreate={() => { setWelcomeOpen(false); setPassportOpen(true); }} />}
      {passportOpen && <CareerPassportModal person={{ ...person, claimed: true }} credits={credits} personalized onClose={() => setPassportOpen(false)} />}
    </main>
  );
}
