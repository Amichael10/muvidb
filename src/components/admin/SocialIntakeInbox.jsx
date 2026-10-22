import { useEffect, useMemo, useState } from 'react';
import { Icon } from '@iconify/react';
import toast from 'react-hot-toast';
import { authHeaders } from '../../lib/apiAuth';
import { supabase } from '../../lib/supabase';

const KIND_LABELS = {
  unclassified: 'Unclassified',
  social_post: 'Social post',
  film: 'Film',
  critic_review: 'Critic review',
  credits: 'Credits',
  news: 'News',
};

const STATUS_TONES = {
  received: 'border-blue-500/20 bg-blue-500/10 text-blue-400',
  processing: 'border-amber-500/20 bg-amber-500/10 text-amber-400',
  needs_review: 'border-amber-500/20 bg-amber-500/10 text-amber-400',
  approved: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-400',
  applied: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-400',
  rejected: 'border-red-500/20 bg-red-500/10 text-red-400',
  failed: 'border-red-500/20 bg-red-500/10 text-red-400',
};

function Field({ label, value, onChange, type = 'text', rows, placeholder }) {
  const className = 'mt-1.5 w-full rounded-lg border border-border bg-surface-2 px-3 py-2.5 text-sm text-text-primary outline-none focus:border-brand';
  return (
    <label className="block">
      <span className="text-[10px] font-black uppercase tracking-widest text-text-muted">{label}</span>
      {rows ? (
        <textarea className={className} rows={rows} value={value ?? ''} placeholder={placeholder} onChange={event => onChange(event.target.value)} />
      ) : (
        <input className={className} type={type} value={value ?? ''} placeholder={placeholder} onChange={event => onChange(event.target.value)} />
      )}
    </label>
  );
}

async function apiRequest(task, body) {
  const response = await fetch(`/api/social?task=${task}`, {
    method: body ? 'POST' : 'GET',
    headers: body ? { ...(await authHeaders()), 'Content-Type': 'application/json' } : await authHeaders(),
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `The request failed (${response.status})`);
  return data;
}

export default function SocialIntakeInbox({ onCreateSocialDraft }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState('open');
  const [kindFilter, setKindFilter] = useState('all');
  const [selectedId, setSelectedId] = useState(null);
  const [payload, setPayload] = useState({});
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [kind, setKind] = useState('unclassified');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [filmSearch, setFilmSearch] = useState('');
  const [filmResults, setFilmResults] = useState([]);
  const [searchingFilms, setSearchingFilms] = useState(false);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await apiRequest('intake_list');
      setItems(Array.isArray(data) ? data : []);
      setSelectedId(current => current && data.some(item => item.id === current) ? current : data[0]?.id || null);
    } catch (requestError) {
      setError(requestError.message || 'We could not load Telegram intake items.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const selected = items.find(item => item.id === selectedId) || null;
  useEffect(() => {
    if (!selected) return;
    setPayload({ ...(selected.extracted_payload || {}) });
    setTitle(selected.title || '');
    setDescription(selected.description || '');
    setKind(selected.intake_kind || 'unclassified');
    setNotes(selected.metadata?.admin_notes || '');
    setFilmSearch(selected.extracted_payload?.film_title || '');
    setFilmResults([]);
  }, [selectedId]);

  const filteredItems = useMemo(() => items.filter(item => {
    const statusMatches = statusFilter === 'all'
      || (statusFilter === 'open' && !['applied', 'approved', 'rejected'].includes(item.workflow_status))
      || item.workflow_status === statusFilter;
    return statusMatches && (kindFilter === 'all' || item.intake_kind === kindFilter);
  }), [items, statusFilter, kindFilter]);

  const setPayloadField = (field, value) => setPayload(current => ({ ...current, [field]: value }));

  const save = async (workflowStatus = selected?.workflow_status || 'needs_review') => {
    if (!selected) return null;
    setSaving(true);
    try {
      const updated = await apiRequest('intake_update', {
        intakeId: selected.id,
        title,
        description,
        kind,
        payload,
        workflowStatus,
        adminNotes: notes,
      });
      await load();
      setSelectedId(selected.id);
      toast.success('Intake changes saved');
      return updated;
    } catch (saveError) {
      toast.error(saveError.message || 'Could not save this intake item');
      return null;
    } finally {
      setSaving(false);
    }
  };

  const approve = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      await apiRequest('intake_update', { intakeId: selected.id, title, description, kind, payload, workflowStatus: 'needs_review', adminNotes: notes });
      const result = await apiRequest('intake_approve', { intakeId: selected.id, payload });
      toast.success(result.appliedEntityType === 'film' ? 'Film added to MuviDB' : result.appliedEntityType === 'critic_review' ? 'Critic review added' : 'Intake item approved');
      await load();
    } catch (approvalError) {
      toast.error(approvalError.message || 'This item could not be approved');
    } finally {
      setSaving(false);
    }
  };

  const reject = async () => {
    if (!selected) return;
    const reason = window.prompt('Why are you rejecting this intake item?') || '';
    setSaving(true);
    try {
      await apiRequest('intake_reject', { intakeId: selected.id, reason });
      toast.success('Intake item rejected');
      await load();
    } catch (rejectError) {
      toast.error(rejectError.message || 'Could not reject this item');
    } finally {
      setSaving(false);
    }
  };

  const createSocialDraft = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      await apiRequest('intake_update', {
        intakeId: selected.id,
        title,
        description,
        kind: 'social_post',
        payload,
        workflowStatus: 'needs_review',
        adminNotes: notes,
      });
      const result = await apiRequest('intake_create_social', { intakeId: selected.id });
      toast.success(result.existing ? 'Opening the existing Social Studio draft' : 'Editable Social Studio draft created');
      await load();
      onCreateSocialDraft?.(result);
    } catch (draftError) {
      toast.error(draftError.message || 'Could not create a Social Studio draft');
    } finally {
      setSaving(false);
    }
  };

  const searchFilms = async value => {
    setFilmSearch(value);
    if (value.trim().length < 2) return setFilmResults([]);
    setSearchingFilms(true);
    try {
      const { data } = await supabase.from('films').select('id,title,year,poster_url').ilike('title', `%${value.trim()}%`).limit(8);
      setFilmResults(data || []);
    } finally {
      setSearchingFilms(false);
    }
  };

  if (loading) return (
    <div className="rounded-xl border border-border bg-surface p-12 text-center">
      <Icon icon="solar:spinner-linear" className="mx-auto animate-spin text-brand" width="30" />
      <p className="mt-3 text-sm font-bold text-text-primary">Loading Telegram intake…</p>
    </div>
  );

  if (error) return (
    <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-10 text-center">
      <Icon icon="solar:danger-triangle-linear" className="mx-auto text-red-500" width="30" />
      <p className="mt-3 text-sm font-bold text-text-primary">Couldn’t load the intake inbox</p>
      <p className="mt-1 text-xs text-text-muted">{error}</p>
      <button onClick={load} className="mt-4 rounded-lg bg-brand px-4 py-2 text-xs font-bold text-white">Try again</button>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-5 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Icon icon="solar:inbox-in-linear" className="text-brand" width="21" />
            <h2 className="text-sm font-black uppercase tracking-widest text-text-primary">Telegram Approval Inbox</h2>
          </div>
          <p className="mt-1 text-xs text-text-muted">Forwarded sources are prepared here. Nothing changes the public catalogue until you approve it.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <select value={statusFilter} onChange={event => setStatusFilter(event.target.value)} className="rounded-lg border border-border bg-surface-2 px-3 py-2 text-xs font-bold text-text-primary">
            <option value="open">Open items</option><option value="all">All statuses</option><option value="received">Received</option><option value="needs_review">Needs review</option><option value="applied">Applied</option><option value="approved">Approved</option><option value="rejected">Rejected</option><option value="failed">Failed</option>
          </select>
          <select value={kindFilter} onChange={event => setKindFilter(event.target.value)} className="rounded-lg border border-border bg-surface-2 px-3 py-2 text-xs font-bold text-text-primary">
            <option value="all">All types</option>{Object.entries(KIND_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
          <button onClick={load} className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-bold text-text-muted hover:text-text-primary"><Icon icon="solar:refresh-linear" /> Refresh</button>
        </div>
      </div>

      <div className="grid min-h-[620px] gap-4 xl:grid-cols-[360px_minmax(0,1fr)]">
        <div className="space-y-2 rounded-xl border border-border bg-surface p-3">
          {filteredItems.length === 0 ? <p className="p-8 text-center text-sm text-text-muted">No intake items match this filter.</p> : filteredItems.map(item => (
            <button key={item.id} onClick={() => setSelectedId(item.id)} className={`w-full rounded-lg border p-3 text-left transition-colors ${selectedId === item.id ? 'border-brand bg-brand/5' : 'border-border bg-surface-2 hover:border-brand/40'}`}>
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-surface">
                  {item.metadata?.image_url ? <img src={item.metadata.image_url} alt="" className="h-full w-full object-cover" /> : <Icon icon={item.intake_kind === 'film' ? 'solar:clapperboard-linear' : item.intake_kind === 'critic_review' ? 'solar:chat-square-like-linear' : 'solar:inbox-in-linear'} className="text-brand" width="20" />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-2 text-xs font-black text-text-primary">{item.title}</p>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    <span className="rounded border border-border px-1.5 py-0.5 text-[9px] font-black uppercase text-text-muted">{KIND_LABELS[item.intake_kind] || item.intake_kind}</span>
                    <span className={`rounded border px-1.5 py-0.5 text-[9px] font-black uppercase ${STATUS_TONES[item.workflow_status] || STATUS_TONES.received}`}>{String(item.workflow_status).replaceAll('_', ' ')}</span>
                  </div>
                  <p className="mt-1.5 text-[10px] text-text-muted">{new Date(item.detected_at).toLocaleString()}</p>
                </div>
              </div>
            </button>
          ))}
        </div>

        {!selected ? <div className="flex items-center justify-center rounded-xl border border-border bg-surface text-sm text-text-muted">Select an intake item.</div> : (
          <div className="rounded-xl border border-border bg-surface">
            <div className="border-b border-border p-5">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-brand">Forwarded via Telegram</p>
                  <h3 className="mt-1 text-xl font-black text-text-primary">{selected.title}</h3>
                  <p className="mt-1 text-xs text-text-muted">From {selected.metadata?.author_name || selected.metadata?.from_user || 'admin'} · {new Date(selected.detected_at).toLocaleString()}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {selected.source_url && <a href={selected.source_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-bold text-text-primary hover:border-brand"><Icon icon="solar:link-circle-linear" /> Open source</a>}
                  {selected.metadata?.telegram_video_file_id && <span className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-xs font-bold text-emerald-400"><Icon icon="solar:videocamera-record-linear" /> Video returned</span>}
                </div>
              </div>
            </div>

            <div className="grid gap-5 p-5 lg:grid-cols-[minmax(0,1fr)_280px]">
              <div className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Inbox title" value={title} onChange={setTitle} />
                  <label className="block"><span className="text-[10px] font-black uppercase tracking-widest text-text-muted">Action type</span><select value={kind} onChange={event => setKind(event.target.value)} className="mt-1.5 w-full rounded-lg border border-border bg-surface-2 px-3 py-2.5 text-sm text-text-primary">{Object.entries(KIND_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
                </div>
                <Field label="Source text / context" value={description} onChange={setDescription} rows={5} />

                {kind === 'film' && <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Film title" value={payload.title} onChange={value => setPayloadField('title', value)} />
                  <Field label="Year" type="number" value={payload.year} onChange={value => setPayloadField('year', value)} />
                  <div className="sm:col-span-2"><Field label="Synopsis" value={payload.synopsis} onChange={value => setPayloadField('synopsis', value)} rows={6} placeholder="Required before approval" /></div>
                  <Field label="Genres (comma separated)" value={Array.isArray(payload.genres) ? payload.genres.join(', ') : payload.genres} onChange={value => setPayloadField('genres', value)} />
                  <Field label="Runtime (minutes)" type="number" value={payload.runtime_minutes} onChange={value => setPayloadField('runtime_minutes', value)} />
                  <Field label="Release date" type="date" value={payload.release_date} onChange={value => setPayloadField('release_date', value)} />
                  <Field label="Poster URL" value={payload.poster_url} onChange={value => setPayloadField('poster_url', value)} />
                </div>}

                {kind === 'critic_review' && <div className="space-y-4">
                  <div className="relative"><Field label="Match film" value={filmSearch} onChange={searchFilms} placeholder="Search MuviDB films" />{searchingFilms && <Icon icon="solar:spinner-linear" className="absolute right-3 top-8 animate-spin text-brand" />}{filmResults.length > 0 && <div className="absolute z-20 mt-1 w-full rounded-lg border border-border bg-surface p-1 shadow-2xl">{filmResults.map(film => <button key={film.id} type="button" onClick={() => { setPayloadField('film_id', film.id); setPayloadField('film_title', film.title); setFilmSearch(`${film.title}${film.year ? ` (${film.year})` : ''}`); setFilmResults([]); }} className="flex w-full items-center gap-2 rounded p-2 text-left text-xs hover:bg-surface-2"><span className="font-bold text-text-primary">{film.title}</span><span className="text-text-muted">{film.year || ''}</span></button>)}</div>}</div>
                  {payload.film_id && <p className="text-xs font-bold text-emerald-400">✓ Film matched: {payload.film_title || payload.film_id}</p>}
                  <div className="grid gap-4 sm:grid-cols-2"><Field label="Critic name" value={payload.critic_name} onChange={value => setPayloadField('critic_name', value)} /><Field label="Publication / title" value={payload.publication || payload.critic_title} onChange={value => setPayloadField('publication', value)} /></div>
                  <Field label="Review quote" value={payload.quote} onChange={value => setPayloadField('quote', value)} rows={6} />
                  <div className="grid gap-4 sm:grid-cols-3"><Field label="Rating (optional)" type="number" value={payload.rating} onChange={value => setPayloadField('rating', value)} /><Field label="Rating scale" type="number" value={payload.rating_scale || 10} onChange={value => setPayloadField('rating_scale', value)} /><Field label="Review URL" value={payload.review_url || selected.source_url} onChange={value => setPayloadField('review_url', value)} /></div>
                </div>}

                {kind === 'credits' && <div className="space-y-3"><Field label="Film title" value={payload.film_title} onChange={value => setPayloadField('film_title', value)} />{Array.isArray(payload.credits) && payload.credits.map((credit, index) => <div key={index} className="grid gap-2 rounded-lg border border-border bg-surface-2 p-3 sm:grid-cols-3"><Field label="Name" value={credit.name} onChange={value => setPayloadField('credits', payload.credits.map((row, rowIndex) => rowIndex === index ? { ...row, name: value } : row))} /><Field label="Role" value={credit.role} onChange={value => setPayloadField('credits', payload.credits.map((row, rowIndex) => rowIndex === index ? { ...row, role: value } : row))} /><Field label="Character" value={credit.character_name} onChange={value => setPayloadField('credits', payload.credits.map((row, rowIndex) => rowIndex === index ? { ...row, character_name: value } : row))} /></div>)}</div>}

                <Field label="Admin notes" value={notes} onChange={setNotes} rows={3} />
              </div>

              <aside className="space-y-4">
                <div className="overflow-hidden rounded-xl border border-border bg-surface-2">
                  {selected.metadata?.video_url ? <video src={selected.metadata.video_url} controls playsInline className="aspect-[9/16] max-h-[420px] w-full bg-black object-contain" /> : selected.metadata?.image_url ? <img src={selected.metadata.image_url} alt="Forwarded source" className="max-h-[420px] w-full object-contain" /> : <div className="flex aspect-square items-center justify-center text-text-muted"><Icon icon="solar:gallery-linear" width="42" /></div>}
                </div>
                <div className="rounded-lg border border-border bg-surface-2 p-3 text-xs text-text-muted"><p className="font-bold text-text-primary">Approval safety</p><p className="mt-1 leading-relaxed">Films require a real synopsis. Reviews require a matched film, critic attribution, and quote. The original source stays attached for verification.</p></div>
              </aside>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border p-5">
              <button type="button" onClick={reject} disabled={saving || ['applied', 'rejected'].includes(selected.workflow_status)} className="rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-2 text-xs font-bold text-red-400 disabled:opacity-40">Reject</button>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => save('needs_review')} disabled={saving} className="rounded-lg border border-border bg-surface-2 px-4 py-2 text-xs font-bold text-text-primary disabled:opacity-40">Save changes</button>
                {kind === 'social_post' && onCreateSocialDraft && <button type="button" onClick={createSocialDraft} disabled={saving} className="rounded-lg border border-brand/30 bg-brand/10 px-4 py-2 text-xs font-bold text-brand disabled:opacity-40">Create editable social draft</button>}
                <button type="button" onClick={approve} disabled={saving || ['applied', 'rejected'].includes(selected.workflow_status)} className="inline-flex items-center gap-2 rounded-lg bg-brand px-5 py-2 text-xs font-black text-white disabled:opacity-40"><Icon icon={saving ? 'solar:spinner-linear' : 'solar:check-circle-bold'} className={saving ? 'animate-spin' : ''} />{kind === 'film' ? 'Approve & add film' : kind === 'critic_review' ? 'Approve & add review' : 'Approve intake'}</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
