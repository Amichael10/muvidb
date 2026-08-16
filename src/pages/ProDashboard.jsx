import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Icon } from '@iconify/react';
import { toast } from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { CAST_ROLE, CREW_ROLES, formatRole } from '../lib/creditRoles';

const input = 'w-full rounded-xl border border-border bg-surface-2 px-4 py-3 text-sm text-text-primary outline-none focus:border-brand';

function StatusPill({ status }) {
  const tone = status === 'approved' ? 'text-green-500 bg-green-500/10 border-green-500/20' : status === 'rejected' ? 'text-red-500 bg-red-500/10 border-red-500/20' : 'text-amber-500 bg-amber-500/10 border-amber-500/20';
  return <span className={`rounded-lg border px-2.5 py-1 text-[10px] font-black uppercase tracking-wider ${tone}`}>{String(status).replace('_', ' ')}</span>;
}
function CreditRequestModal({ person, onClose, onSaved }) {
  const { user } = useAuth();
  const [mode, setMode] = useState('existing');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [film, setFilm] = useState(null);
  const [kind, setKind] = useState('cast');
  const [crewRole, setCrewRole] = useState(CREW_ROLES[0].value);
  const [customRole, setCustomRole] = useState('');
  const [characterName, setCharacterName] = useState('');
  const [note, setNote] = useState('');
  const [evidenceUrl, setEvidenceUrl] = useState('');
  const [saving, setSaving] = useState(false);
  const [newFilm, setNewFilm] = useState({
    title: '', content_type: 'movie', year: new Date().getFullYear(), release_type: '',
    synopsis: '', genres: '', runtime_minutes: '', language: 'English', countries: 'Nigeria',
    release_date: '', nfvcb_rating: '', youtube_watch_url: '', trailer_youtube_id: '', poster_url: '',
  });

  useEffect(() => {
    if (mode !== 'existing' || query.trim().length < 2 || film) return setResults([]);
    const timer = setTimeout(async () => {
      const { data } = await supabase.from('films').select('id,title,year,poster_url,content_type').ilike('title', `%${query.trim()}%`).order('year', { ascending: false }).limit(10);
      setResults(data || []);
    }, 250);
    return () => clearTimeout(timer);
  }, [query, film, mode]);

  const role = kind === 'cast' ? CAST_ROLE : (customRole.trim().toLowerCase() || crewRole);
  const setField = (key, value) => setNewFilm((current) => ({ ...current, [key]: value }));

  const submit = async (event) => {
    event.preventDefault();
    if (mode === 'existing' && !film) return toast.error('Select a film first.');
    if (mode === 'new' && (!newFilm.title.trim() || !newFilm.release_type || !newFilm.countries.trim() || !evidenceUrl.trim())) {
      return toast.error('Title, release type, country and a supporting source are required.');
    }
    setSaving(true);
    const proposed = mode === 'new' ? {
      ...newFilm,
      year: Number(newFilm.year),
      runtime_minutes: newFilm.runtime_minutes ? Number(newFilm.runtime_minutes) : null,
      genres: newFilm.genres.split(',').map((value) => value.trim()).filter(Boolean),
      countries: newFilm.countries.split(',').map((value) => value.trim()).filter(Boolean),
    } : null;
    const { error } = await supabase.from('actor_credit_requests').insert({
      submitted_by: user.id,
      person_id: person.id,
      request_type: mode === 'new' ? 'add_new_film' : 'add_existing',
      film_id: mode === 'existing' ? film.id : null,
      role,
      character_name: kind === 'cast' ? characterName.trim() || null : null,
      proposed_film: proposed,
      note: note.trim() || null,
      evidence_url: evidenceUrl.trim() || null,
      status: 'submitted',
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success('Credit request submitted for review.');
    onSaved();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <form onSubmit={submit} className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-border bg-surface p-6 md:p-8">
        <div className="flex items-start justify-between gap-4"><div><p className="text-[10px] font-black uppercase tracking-widest text-brand">Filmography request</p><h2 className="mt-2 text-2xl font-black text-text-primary">Add a credit for {person.name}</h2></div><button type="button" onClick={onClose} className="text-text-muted"><Icon icon="solar:close-circle-linear" width="26" /></button></div>

        <div className="mt-7 grid grid-cols-2 gap-2 rounded-xl bg-surface-2 p-1.5">
          <button type="button" onClick={() => setMode('existing')} className={`rounded-lg py-3 text-xs font-black ${mode === 'existing' ? 'bg-brand text-white' : 'text-text-muted'}`}>Existing film</button>
          <button type="button" onClick={() => setMode('new')} className={`rounded-lg py-3 text-xs font-black ${mode === 'new' ? 'bg-brand text-white' : 'text-text-muted'}`}>Film is missing</button>
        </div>

        {mode === 'existing' ? (
          <div className="mt-6">
            <label htmlFor="actor-film-search" className="text-xs font-bold text-text-primary">Search film</label>
            {film ? <div className="mt-2 flex items-center gap-3 rounded-xl border border-brand bg-brand/5 p-4"><img src={film.poster_url || '/images/film-placeholder.webp'} alt="" className="h-14 w-10 rounded object-cover" /><div><strong className="text-sm text-text-primary">{film.title}</strong><p className="text-xs text-text-muted">{film.year || 'Year unknown'}</p></div><button type="button" onClick={() => setFilm(null)} className="ml-auto text-xs font-bold text-brand">Change</button></div> : <><input id="actor-film-search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search the catalogue…" className={`mt-2 ${input}`} /><div className="mt-2 grid gap-2">{results.map((row) => <button type="button" key={row.id} onClick={() => setFilm(row)} className="flex items-center gap-3 rounded-xl border border-border p-3 text-left hover:border-brand"><img src={row.poster_url || '/images/film-placeholder.webp'} alt="" className="h-12 w-9 rounded object-cover" /><span><strong className="block text-sm text-text-primary">{row.title}</strong><small className="text-text-muted">{row.year || 'Year unknown'}</small></span></button>)}</div></>}
          </div>
        ) : (
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2"><label htmlFor="actor-film-title" className="text-xs font-bold text-text-primary">Film title *</label><input id="actor-film-title" value={newFilm.title} onChange={(e) => setField('title', e.target.value)} className={`mt-2 ${input}`} required /></div>
            <div><label htmlFor="actor-film-content-type" className="text-xs font-bold text-text-primary">Content type *</label><select id="actor-film-content-type" value={newFilm.content_type} onChange={(e) => setField('content_type', e.target.value)} className={`mt-2 ${input}`}><option value="movie">Movie</option><option value="series">Series</option><option value="mini_series">Mini-series</option><option value="documentary">Documentary</option></select></div>
            <div><label htmlFor="actor-film-year" className="text-xs font-bold text-text-primary">Release year *</label><input id="actor-film-year" type="number" min="1900" max="2100" value={newFilm.year} onChange={(e) => setField('year', e.target.value)} className={`mt-2 ${input}`} required /></div>
            <div><label htmlFor="actor-film-release-type" className="text-xs font-bold text-text-primary">Release type *</label><select id="actor-film-release-type" value={newFilm.release_type} onChange={(e) => setField('release_type', e.target.value)} className={`mt-2 ${input}`} required><option value="">Select</option><option value="cinema">Cinema</option><option value="youtube">YouTube (free)</option><option value="youtube_premium">YouTube (paid)</option><option value="netflix">Netflix</option><option value="prime_video">Prime Video</option><option value="showmax">Showmax</option><option value="kava">Kava</option><option value="unreleased">Not released yet</option></select></div>
            <div><label htmlFor="actor-film-countries" className="text-xs font-bold text-text-primary">Countries *</label><input id="actor-film-countries" value={newFilm.countries} onChange={(e) => setField('countries', e.target.value)} placeholder="Nigeria, Ghana" className={`mt-2 ${input}`} required /></div>
            <div className="sm:col-span-2"><label htmlFor="actor-film-synopsis" className="text-xs font-bold text-text-primary">Synopsis</label><textarea id="actor-film-synopsis" value={newFilm.synopsis} onChange={(e) => setField('synopsis', e.target.value)} rows="4" className={`mt-2 ${input}`} /></div>
            <div><label htmlFor="actor-film-genres" className="text-xs font-bold text-text-primary">Genres</label><input id="actor-film-genres" value={newFilm.genres} onChange={(e) => setField('genres', e.target.value)} placeholder="Drama, Thriller" className={`mt-2 ${input}`} /></div>
            <div><label htmlFor="actor-film-runtime" className="text-xs font-bold text-text-primary">Runtime (minutes)</label><input id="actor-film-runtime" type="number" min="1" value={newFilm.runtime_minutes} onChange={(e) => setField('runtime_minutes', e.target.value)} className={`mt-2 ${input}`} /></div>
            <div><label htmlFor="actor-film-languages" className="text-xs font-bold text-text-primary">Languages</label><input id="actor-film-languages" value={newFilm.language} onChange={(e) => setField('language', e.target.value)} className={`mt-2 ${input}`} /></div>
            <div><label htmlFor="actor-film-release-date" className="text-xs font-bold text-text-primary">Release date</label><input id="actor-film-release-date" type="date" value={newFilm.release_date} onChange={(e) => setField('release_date', e.target.value)} className={`mt-2 ${input}`} /></div>
            <div><label htmlFor="actor-film-rating" className="text-xs font-bold text-text-primary">NFVCB rating</label><select id="actor-film-rating" value={newFilm.nfvcb_rating} onChange={(e) => setField('nfvcb_rating', e.target.value)} className={`mt-2 ${input}`}><option value="">Unknown</option>{['G','PG','12','12A','PG-13','15','18','RE'].map((value) => <option key={value}>{value}</option>)}</select></div>
            <div><label htmlFor="actor-film-poster" className="text-xs font-bold text-text-primary">Poster URL</label><input id="actor-film-poster" type="url" value={newFilm.poster_url} onChange={(e) => setField('poster_url', e.target.value)} className={`mt-2 ${input}`} /></div>
            <div><label htmlFor="actor-film-watch-url" className="text-xs font-bold text-text-primary">Official watch URL</label><input id="actor-film-watch-url" type="url" value={newFilm.youtube_watch_url} onChange={(e) => setField('youtube_watch_url', e.target.value)} className={`mt-2 ${input}`} /></div>
            <div><label htmlFor="actor-film-trailer" className="text-xs font-bold text-text-primary">Trailer YouTube ID</label><input id="actor-film-trailer" value={newFilm.trailer_youtube_id} onChange={(e) => setField('trailer_youtube_id', e.target.value)} className={`mt-2 ${input}`} /></div>
          </div>
        )}

        <div className="mt-7 grid gap-4 sm:grid-cols-2">
          <div><label htmlFor="actor-credit-type" className="text-xs font-bold text-text-primary">Credit type</label><select id="actor-credit-type" value={kind} onChange={(e) => setKind(e.target.value)} className={`mt-2 ${input}`}><option value="cast">Cast / Actor</option><option value="crew">Crew</option></select></div>
          {kind === 'cast' ? <div><label htmlFor="actor-character-name" className="text-xs font-bold text-text-primary">Character name</label><input id="actor-character-name" value={characterName} onChange={(e) => setCharacterName(e.target.value)} className={`mt-2 ${input}`} /></div> : <div><label htmlFor="actor-crew-role" className="text-xs font-bold text-text-primary">Crew role</label><select id="actor-crew-role" value={crewRole} onChange={(e) => setCrewRole(e.target.value)} className={`mt-2 ${input}`}>{CREW_ROLES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></div>}
          {kind === 'crew' && <div className="sm:col-span-2"><label htmlFor="actor-custom-role" className="text-xs font-bold text-text-primary">Custom role <span className="font-normal text-text-muted">(optional)</span></label><input id="actor-custom-role" value={customRole} onChange={(e) => setCustomRole(e.target.value)} placeholder="Overrides the selected crew role" className={`mt-2 ${input}`} /></div>}
          <div className="sm:col-span-2"><label htmlFor="actor-credit-source" className="text-xs font-bold text-text-primary">Supporting source {mode === 'new' && '*'}</label><input id="actor-credit-source" type="url" value={evidenceUrl} onChange={(e) => setEvidenceUrl(e.target.value)} required={mode === 'new'} placeholder="Official trailer, announcement or production page" className={`mt-2 ${input}`} /></div>
          <div className="sm:col-span-2"><label htmlFor="actor-credit-note" className="text-xs font-bold text-text-primary">Note to the editor</label><textarea id="actor-credit-note" value={note} onChange={(e) => setNote(e.target.value)} rows="3" className={`mt-2 ${input}`} /></div>
        </div>
        <button disabled={saving} className="mt-7 w-full rounded-xl bg-brand py-4 text-xs font-black text-white disabled:opacity-50">{saving ? 'Submitting…' : 'Submit for admin review'}</button>
      </form>
    </div>
  );
}

export default function ProDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [access, setAccess] = useState(null);
  const [claim, setClaim] = useState(null);
  const [credits, setCredits] = useState([]);
  const [requests, setRequests] = useState([]);
  const [adding, setAdding] = useState(false);

  const load = async () => {
    if (!user?.id) return;
    setLoading(true);
    const { data: accessRow } = await supabase.from('actor_profile_access').select('*,people(*)').eq('user_id', user.id).eq('status', 'active').limit(1).maybeSingle();
    setAccess(accessRow || null);
    if (!accessRow) {
      const { data: claimRow } = await supabase.from('profile_claims').select('*,people(*)').eq('user_id', user.id).order('created_at', { ascending: false }).limit(1).maybeSingle();
      setClaim(claimRow || null);
      setLoading(false);
      return;
    }
    const [creditRes, requestRes] = await Promise.all([
      fetch(`/api/content?resource=person-credits&personId=${encodeURIComponent(accessRow.person_id)}`).then((res) => res.ok ? res.json() : { credits: [] }),
      supabase.from('actor_credit_requests').select('*').eq('submitted_by', user.id).order('created_at', { ascending: false }),
    ]);
    setCredits(creditRes.credits || []);
    setRequests(requestRes.data || []);
    setLoading(false);
  };

  useEffect(() => {
    document.title = 'Actor dashboard | MuviDB';
    if (user?.role === 'admin' || user?.role === 'admin_limited') return navigate('/admin');
    load();
  }, [user?.id]);

  const pendingRemoval = useMemo(() => new Set(requests.filter((r) => r.request_type === 'remove' && ['submitted','in_review','needs_information'].includes(r.status)).map((r) => r.credit_id)), [requests]);

  const requestRemoval = async (credit) => {
    const reason = window.prompt(`Why should “${credit.films?.title || 'this credit'}” be removed from your filmography?`);
    if (!reason?.trim()) return;
    const { error } = await supabase.from('actor_credit_requests').insert({
      submitted_by: user.id, person_id: access.person_id, request_type: 'remove',
      credit_id: credit.id, note: reason.trim(), status: 'submitted',
    });
    if (error) return toast.error(error.message);
    toast.success('Removal request submitted. The credit stays public until an admin approves.');
    load();
  };

  if (loading) return <main className="min-h-screen bg-bg px-6 pt-32"><div className="mx-auto h-48 max-w-5xl animate-pulse rounded-2xl bg-surface" /></main>;

  if (!access) {
    return (
      <main className="min-h-screen bg-bg px-4 pt-32 pb-20">
        <section className="mx-auto max-w-2xl rounded-2xl border border-border bg-surface p-8 text-center md:p-12">
          {claim?.status === 'pending' ? <><Icon icon="solar:hourglass-line-bold" width="42" className="mx-auto text-brand" /><h1 className="mt-5 text-3xl font-black text-text-primary">Claim under review</h1><p className="mt-4 text-sm leading-7 text-text-muted">MuviDB will contact <strong className="text-text-primary">{claim.social_handle}</strong> on {claim.social_platform}. Current verification status: <strong className="text-text-primary">{String(claim.verification_status).replace('_', ' ')}</strong>.</p><div className="mx-auto mt-6 max-w-xs rounded-xl bg-surface-2 p-4"><p className="text-[10px] font-bold uppercase tracking-widest text-text-muted">Verification code</p><p className="mt-1 font-mono text-2xl font-black text-brand">{claim.verification_code}</p></div></> : <><Icon icon="solar:user-check-linear" width="42" className="mx-auto text-brand" /><h1 className="mt-5 text-3xl font-black text-text-primary">Connect your actor profile</h1><p className="mt-4 text-sm leading-7 text-text-muted">Claim and verify your public actor record before requesting filmography changes.</p><Link to="/claim" className="mt-7 inline-flex rounded-xl bg-brand px-7 py-3 text-xs font-black text-white">Claim actor profile</Link></>}
        </section>
      </main>
    );
  }

  const person = access.people;
  return (
    <main className="min-h-screen bg-bg px-4 pt-24 pb-20">
      <section className="mx-auto max-w-6xl">
        <header className="flex flex-col gap-6 rounded-2xl border border-border bg-surface p-7 md:flex-row md:items-center">
          <img src={person.photo_url || '/images/person-placeholder.png'} alt="" className="h-24 w-24 rounded-2xl object-cover" />
          <div><p className="text-[10px] font-black uppercase tracking-[.2em] text-brand">Verified actor workspace</p><h1 className="mt-2 text-3xl font-black text-text-primary">{person.name}</h1><p className="mt-2 text-sm text-text-muted">Submit filmography additions and removal requests. An admin reviews every change before it goes live.</p></div>
          <div className="md:ml-auto"><button onClick={() => setAdding(true)} className="rounded-xl bg-brand px-6 py-3 text-xs font-black text-white"><Icon icon="solar:add-circle-bold" className="mr-2 inline" />Add credit</button></div>
        </header>

        <div className="mt-8 grid gap-8 lg:grid-cols-[1.4fr_.8fr]">
          <section className="rounded-2xl border border-border bg-surface p-6">
            <div className="flex items-center justify-between"><h2 className="text-xl font-black text-text-primary">Published filmography</h2><span className="text-xs font-bold text-text-muted">{credits.length} credits</span></div>
            <div className="mt-5 space-y-3">
              {credits.length === 0 && <p className="rounded-xl bg-surface-2 p-6 text-sm text-text-muted">No published credits yet.</p>}
              {credits.sort((a,b) => (b.films?.year || 0) - (a.films?.year || 0)).map((credit) => <div key={credit.id} className="flex items-center gap-4 rounded-xl border border-border p-4"><img src={credit.films?.poster_url || '/images/film-placeholder.webp'} alt="" className="h-16 w-12 rounded object-cover" /><div className="min-w-0"><Link to={`/films/${credit.films?.slug || credit.film_id}`} className="block truncate text-sm font-black text-text-primary hover:text-brand">{credit.films?.title || 'Unknown film'}</Link><p className="mt-1 text-xs text-text-muted">{formatRole(credit.role)}{credit.character_name ? ` · ${credit.character_name}` : ''} · {credit.films?.year || 'Year unknown'}</p></div><button disabled={pendingRemoval.has(credit.id)} onClick={() => requestRemoval(credit)} className="ml-auto rounded-lg border border-border px-3 py-2 text-[10px] font-black text-text-muted hover:border-red-500 hover:text-red-500 disabled:opacity-50">{pendingRemoval.has(credit.id) ? 'Removal pending' : 'Request removal'}</button></div>)}
            </div>
          </section>

          <section className="rounded-2xl border border-border bg-surface p-6">
            <h2 className="text-xl font-black text-text-primary">Your requests</h2>
            <div className="mt-5 space-y-3">
              {requests.length === 0 && <p className="rounded-xl bg-surface-2 p-6 text-sm text-text-muted">You have not submitted any filmography requests.</p>}
              {requests.map((request) => <article key={request.id} className="rounded-xl border border-border p-4"><div className="flex items-start justify-between gap-3"><div><p className="text-[10px] font-black uppercase tracking-wider text-brand">{request.request_type.replaceAll('_', ' ')}</p><h3 className="mt-1 text-sm font-black text-text-primary">{request.proposed_film?.title || credits.find((c) => c.film_id === request.film_id || c.id === request.credit_id)?.films?.title || 'Film request'}</h3></div><StatusPill status={request.status} /></div>{request.rejection_reason && <p className="mt-3 rounded-lg bg-red-500/10 p-3 text-xs text-red-400">{request.rejection_reason}</p>}<p className="mt-3 text-[10px] text-text-muted">Submitted {new Date(request.created_at).toLocaleDateString()}</p></article>)}
            </div>
          </section>
        </div>
      </section>
      {adding && <CreditRequestModal person={person} onClose={() => setAdding(false)} onSaved={load} />}
    </main>
  );
}
