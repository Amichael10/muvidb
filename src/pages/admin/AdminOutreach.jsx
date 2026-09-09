import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from '@iconify/react';
import toast from 'react-hot-toast';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import {
  DEFAULT_OUTREACH_TEMPLATE,
  OUTREACH_STATUSES,
  fillOutreachTemplate,
  instagramDmUrl,
  instagramProfileUrl,
  parseInstagramHandle,
  personProfileUrl,
} from '../../lib/outreach';

const TEMPLATE_KEY = 'muvidb_outreach_template_v1';
const PAGE_SIZE = 40;

function statusMeta(id) {
  return OUTREACH_STATUSES.find((s) => s.id === id) || OUTREACH_STATUSES[0];
}

function statusToneClass(tone) {
  if (tone === 'amber') return 'bg-amber-500/10 text-amber-500 border-amber-500/20';
  if (tone === 'blue') return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
  if (tone === 'green') return 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20';
  return 'bg-surface-2 text-text-muted border-border';
}

export default function AdminOutreach() {
  const { user } = useAuth();
  const [people, setPeople] = useState([]);
  const [outreachByPerson, setOutreachByPerson] = useState({});
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState(null);
  const [selected, setSelected] = useState(() => new Set());
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [craftFilter, setCraftFilter] = useState('all');
  const [minFilms, setMinFilms] = useState(1);
  const [maxFilms, setMaxFilms] = useState(10);
  const [page, setPage] = useState(0);
  const [generating, setGenerating] = useState(false);
  
  // Pitch Editor / Modal State
  const [activeEditPerson, setActiveEditPerson] = useState(null);
  const [editingMessage, setEditingMessage] = useState('');
  const [editingNotes, setEditingNotes] = useState('');

  const [template, setTemplate] = useState(() => {
    try {
      return localStorage.getItem(TEMPLATE_KEY) || DEFAULT_OUTREACH_TEMPLATE;
    } catch {
      return DEFAULT_OUTREACH_TEMPLATE;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(TEMPLATE_KEY, template);
    } catch {
      /* ignore */
    }
  }, [template]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      // Paginate people with Instagram
      const batch = 1000;
      let from = 0;
      const all = [];
      while (true) {
        const { data, error } = await supabase
          .from('people')
          .select('id, name, slug, photo_url, instagram_url, film_count, popularity_score, known_for_department, claimed_by, is_verified')
          .not('instagram_url', 'is', null)
          .neq('instagram_url', '')
          .order('film_count', { ascending: true, nullsFirst: false })
          .range(from, from + batch - 1);
        if (error) throw error;
        all.push(...(data || []));
        if (!data?.length || data.length < batch) break;
        from += batch;
      }

      const ids = all.map((p) => p.id);
      const map = {};
      for (let i = 0; i < ids.length; i += 200) {
        const chunk = ids.slice(i, i + 200);
        const { data: rows, error } = await supabase
          .from('artist_outreach')
          .select('id, person_id, status, notes, last_message, contacted_at, updated_at')
          .in('person_id', chunk);
        if (error) throw error;
        for (const row of rows || []) map[row.person_id] = row;
      }

      setPeople(all);
      setOutreachByPerson(map);
    } catch (err) {
      console.error(err);
      toast.error(err.message || 'Failed to load outreach list');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // AI Batch Generator trigger
  const handleGenerateAiBatch = async () => {
    setGenerating(true);
    const toastId = toast.loading('Generating AI personalized pitches for emerging artists...');
    try {
      const queryParams = new URLSearchParams({
        _r: 'outreach',
        action: 'generate_batch',
        limit: '25',
        min_films: String(minFilms),
        max_films: String(maxFilms),
      });
      if (craftFilter !== 'all') {
        queryParams.set('craft', craftFilter);
      }

      const res = await fetch(`/api/data?${queryParams.toString()}`);
      const data = await res.json();

      if (!res.ok || !data.ok) {
        throw new Error(data.error || 'Failed to generate batch');
      }

      toast.success(
        `🎉 Successfully queued ${data.queued_count} candidates with AI personalized copy!`,
        { id: toastId }
      );
      await load();
      setStatusFilter('queued');
    } catch (err) {
      console.error(err);
      toast.error(err.message || 'Error generating outreach batch', { id: toastId });
    } finally {
      setGenerating(false);
    }
  };

  const enriched = useMemo(() => {
    const q = search.trim().toLowerCase();
    return people
      .map((p) => {
        const outreach = outreachByPerson[p.id];
        const status = outreach?.status || 'pending';
        const handle = parseInstagramHandle(p.instagram_url);
        return { ...p, outreach, status, handle };
      })
      .filter((p) => {
        if (!p.handle) return false;
        const films = Number(p.film_count || 0);
        if (films < Number(minFilms || 0)) return false;
        if (maxFilms && films > Number(maxFilms)) return false;
        if (statusFilter !== 'all' && p.status !== statusFilter) return false;
        if (craftFilter !== 'all') {
          const dept = (p.known_for_department || '').toLowerCase();
          if (!dept.includes(craftFilter.toLowerCase())) return false;
        }
        if (!q) return true;
        return (
          p.name?.toLowerCase().includes(q) ||
          p.handle?.toLowerCase().includes(q) ||
          p.slug?.toLowerCase().includes(q)
        );
      });
  }, [people, outreachByPerson, search, statusFilter, craftFilter, minFilms, maxFilms]);

  const counts = useMemo(() => {
    const base = { all: 0, pending: 0, queued: 0, sent: 0, replied: 0, skipped: 0 };
    for (const p of people) {
      if (!parseInstagramHandle(p.instagram_url)) continue;
      const films = Number(p.film_count || 0);
      if (films < Number(minFilms || 0)) continue;
      if (maxFilms && films > Number(maxFilms)) continue;
      base.all += 1;
      const status = outreachByPerson[p.id]?.status || 'pending';
      base[status] = (base[status] || 0) + 1;
    }
    return base;
  }, [people, outreachByPerson, minFilms, maxFilms]);

  const pageCount = Math.max(1, Math.ceil(enriched.length / PAGE_SIZE));
  const pageRows = enriched.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);

  useEffect(() => {
    setPage(0);
    setSelected(new Set());
  }, [search, statusFilter, craftFilter, minFilms, maxFilms]);

  const upsertStatus = async (person, status, extra = {}) => {
    setSavingId(person.id);
    try {
      const payload = {
        person_id: person.id,
        status,
        updated_at: new Date().toISOString(),
        updated_by: user?.id || null,
        ...extra,
      };
      if (status === 'sent' && !extra.contacted_at) {
        payload.contacted_at = new Date().toISOString();
        if (!payload.last_message) {
          payload.last_message = person.outreach?.last_message || fillOutreachTemplate(template, person);
        }
      }

      const { data, error } = await supabase
        .from('artist_outreach')
        .upsert(payload, { onConflict: 'person_id' })
        .select('id, person_id, status, notes, last_message, contacted_at, updated_at')
        .single();
      if (error) throw error;

      setOutreachByPerson((prev) => ({ ...prev, [person.id]: data }));
      toast.success(`Updated status to ${status}`);
      return data;
    } catch (err) {
      console.error(err);
      toast.error(err.message || 'Failed to update status');
      return null;
    } finally {
      setSavingId(null);
    }
  };

  const openEditor = (person) => {
    setActiveEditPerson(person);
    const existingMsg = person.outreach?.last_message || fillOutreachTemplate(template, person);
    setEditingMessage(existingMsg);
    setEditingNotes(person.outreach?.notes || '');
  };

  const saveEditedPitch = async () => {
    if (!activeEditPerson) return;
    await upsertStatus(activeEditPerson, activeEditPerson.status === 'pending' ? 'queued' : activeEditPerson.status, {
      last_message: editingMessage,
      notes: editingNotes,
    });
    setActiveEditPerson(null);
  };

  const copyMessage = async (person, { markQueued = true } = {}) => {
    const text = person.outreach?.last_message || fillOutreachTemplate(template, person);
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`Copied message for ${person.name}`);
      if (markQueued && person.status === 'pending') {
        await upsertStatus(person, 'queued', { last_message: text });
      }
    } catch {
      toast.error('Could not copy — check clipboard permission');
    }
  };

  const openDm = (person) => {
    const url = instagramDmUrl(person.instagram_url) || instagramProfileUrl(person.instagram_url);
    if (!url) {
      toast.error('No Instagram handle');
      return;
    }
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const copyAndOpen = async (person) => {
    await copyMessage(person);
    openDm(person);
  };

  const toggleSelect = (id) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectPage = () => {
    setSelected(new Set(pageRows.map((p) => p.id)));
  };

  const clearSelect = () => setSelected(new Set());

  const selectedPeople = useMemo(
    () => enriched.filter((p) => selected.has(p.id)),
    [enriched, selected]
  );

  const bulkStatus = async (status) => {
    if (!selectedPeople.length) return;
    for (const person of selectedPeople) {
      await upsertStatus(person, status);
    }
    toast.success(`Marked ${selectedPeople.length} as ${status}`);
    clearSelect();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <header className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-brand/10 text-brand border border-brand/20">
              <Icon icon="solar:letter-bold" className="text-sm" />
              Creator Growth & Onboarding
            </span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
              <Icon icon="solar:shield-check-bold" className="text-xs" />
              Human Emulation Safeguards Active
            </span>
          </div>
          <h1 className="text-3xl font-bold text-text-primary tracking-tight">Instagram Outreach Studio</h1>
          <p className="text-text-muted text-sm mt-1.5 max-w-3xl">
            Target emerging filmmakers, cinematographers, editors, sound designers, and actors (1–5 credits) with tailored AI invites referencing their exact film credits.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={load}
            disabled={loading}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border border-border text-xs font-bold text-text-muted hover:text-text-primary hover:border-brand transition-all"
          >
            <Icon icon="solar:refresh-linear" className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
          <button
            type="button"
            disabled={generating}
            onClick={handleGenerateAiBatch}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-brand to-amber-500 text-white text-xs font-bold shadow-lg shadow-brand/20 hover:opacity-95 transition-all disabled:opacity-50"
          >
            <Icon icon={generating ? 'solar:refresh-circle-linear' : 'solar:magic-stick-3-bold'} className={generating ? 'animate-spin text-base' : 'text-base'} />
            {generating ? 'Synthesizing Pitches...' : 'Generate AI Batch (25)'}
          </button>
        </div>
      </header>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { label: 'Available Artists', val: counts.all, icon: 'solar:users-group-rounded-linear', color: 'text-text-primary' },
          { label: 'Uncontacted', val: counts.pending, icon: 'solar:clock-circle-linear', color: 'text-amber-500' },
          { label: 'Queued for Bot', val: counts.queued, icon: 'solar:forward-linear', color: 'text-blue-500' },
          { label: 'Invites Sent', val: counts.sent, icon: 'solar:check-circle-bold', color: 'text-emerald-500' },
          { label: 'Profile Claimed/Replied', val: counts.replied, icon: 'solar:heart-bold', color: 'text-brand' },
          { label: 'Skipped', val: counts.skipped, icon: 'solar:close-circle-linear', color: 'text-text-muted' },
        ].map((m, idx) => (
          <div key={idx} className="card-cal p-3.5 rounded-2xl border border-border flex flex-col justify-between">
            <div className="flex items-center justify-between text-text-muted mb-2">
              <span className="text-[11px] font-bold tracking-wide uppercase">{m.label}</span>
              <Icon icon={m.icon} className={`text-base ${m.color}`} />
            </div>
            <p className={`text-2xl font-bold tracking-tight ${m.color}`}>{m.val}</p>
          </div>
        ))}
      </div>

      {/* Automated Bot Scout Runner Guidance */}
      <div className="card-cal p-4 rounded-2xl border border-brand/20 bg-gradient-to-br from-brand/5 via-surface to-surface-2 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Icon icon="solar:devices-bold" className="text-brand text-lg" />
            <span className="text-sm font-bold text-text-primary">Playwright Stealth Worker</span>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-500/10 text-blue-500 border border-blue-500/20">
              {counts.queued} Ready in Queue
            </span>
          </div>
          <p className="text-xs text-text-muted max-w-2xl">
            To dispatch queued pitches via your scout account at human typing speed (40–90ms) with automated Telegram reports:
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <code className="px-3 py-1.5 rounded-xl bg-bg border border-border text-xs font-mono text-brand select-all">
            npm run outreach:worker
          </code>
          <code className="px-3 py-1.5 rounded-xl bg-bg border border-border text-xs font-mono text-text-muted select-all">
            npm run ig:login
          </code>
        </div>
      </div>

      {/* Main Grid: Filters & Data Table */}
      <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
        {/* Left Filter & Target Selector */}
        <div className="xl:col-span-1 space-y-4">
          <div className="card-cal p-4 rounded-2xl border border-border space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-text-primary">Targeting Parameters</h3>
              <Icon icon="solar:tuning-square-2-linear" className="text-text-muted" />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-text-muted">Target Craft / Department</label>
              <select
                value={craftFilter}
                onChange={(e) => setCraftFilter(e.target.value)}
                className="w-full rounded-xl border border-border bg-surface px-3 py-2 text-xs font-medium text-text-primary focus:outline-none focus:border-brand"
              >
                <option value="all">All Departments</option>
                <option value="Directing">Directors</option>
                <option value="Camera">Cinematography / Camera</option>
                <option value="Sound">Sound Design / Mixers</option>
                <option value="Editing">Editors</option>
                <option value="Costume">Costume / Makeup</option>
                <option value="Acting">Actors (Emerging)</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs font-bold text-text-muted">Min Films</label>
                <input
                  type="number"
                  min={1}
                  value={minFilms}
                  onChange={(e) => setMinFilms(Number(e.target.value) || 1)}
                  className="w-full mt-1 rounded-xl border border-border bg-surface px-3 py-1.5 text-xs text-text-primary"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-text-muted">Max Films</label>
                <input
                  type="number"
                  min={1}
                  value={maxFilms}
                  onChange={(e) => setMaxFilms(Number(e.target.value) || 10)}
                  className="w-full mt-1 rounded-xl border border-border bg-surface px-3 py-1.5 text-xs text-text-primary"
                />
              </div>
            </div>

            <div className="pt-2 border-t border-border">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-text-primary">Default Copy Template</span>
                <button
                  type="button"
                  onClick={() => setTemplate(DEFAULT_OUTREACH_TEMPLATE)}
                  className="text-[10px] font-bold text-brand hover:underline"
                >
                  Reset
                </button>
              </div>
              <textarea
                value={template}
                onChange={(e) => setTemplate(e.target.value)}
                rows={6}
                className="w-full rounded-xl border border-border bg-surface-2 px-2.5 py-2 text-[11px] font-mono leading-relaxed text-text-primary focus:outline-none focus:border-brand"
              />
            </div>
          </div>
        </div>

        {/* Right Outreach Queue & Table */}
        <div className="xl:col-span-3 space-y-4">
          {/* Status Tabs */}
          <div className="flex flex-wrap items-center gap-1.5">
            {[
              { id: 'all', label: 'All Candidates' },
              ...OUTREACH_STATUSES.map((s) => ({ id: s.id, label: s.label })),
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setStatusFilter(tab.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${
                  statusFilter === tab.id
                    ? 'bg-brand text-white border-brand shadow-sm'
                    : 'bg-surface border-border text-text-muted hover:text-text-primary'
                }`}
              >
                {tab.label}
                <span className={`ml-1.5 px-1.5 py-0.2 rounded-full text-[10px] ${
                  statusFilter === tab.id ? 'bg-white/20 text-white' : 'bg-surface-2 text-text-muted'
                }`}>
                  {counts[tab.id] ?? 0}
                </span>
              </button>
            ))}
          </div>

          {/* Search bar & Bulk actions */}
          <div className="flex flex-col sm:flex-row items-center gap-3">
            <div className="relative flex-1 w-full">
              <Icon
                icon="solar:magnifer-linear"
                className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted text-base"
              />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Filter by artist name, handle, or slug..."
                className="w-full pl-9 pr-3 py-2 rounded-xl border border-border bg-surface text-xs focus:outline-none focus:border-brand"
              />
            </div>

            {selected.size > 0 && (
              <div className="flex items-center gap-2 p-1.5 rounded-xl border border-brand/30 bg-brand/5 shrink-0">
                <span className="text-xs font-bold text-brand px-2">{selected.size} selected</span>
                <button
                  type="button"
                  onClick={() => bulkStatus('queued')}
                  className="text-xs font-bold px-2.5 py-1 rounded-lg bg-surface border border-border hover:text-brand"
                >
                  Queue Batch
                </button>
                <button
                  type="button"
                  onClick={() => bulkStatus('sent')}
                  className="text-xs font-bold px-2.5 py-1 rounded-lg bg-surface border border-border hover:text-emerald-500"
                >
                  Mark Sent
                </button>
                <button
                  type="button"
                  onClick={() => bulkStatus('skipped')}
                  className="text-xs font-bold px-2.5 py-1 rounded-lg bg-surface border border-border hover:text-text-muted"
                >
                  Skip
                </button>
                <button
                  type="button"
                  onClick={clearSelect}
                  className="text-xs font-bold text-text-muted px-1 hover:text-text-primary"
                >
                  Clear
                </button>
              </div>
            )}
          </div>

          {/* Table Container */}
          <div className="card-cal rounded-2xl border border-border overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-border text-[11px] font-bold text-text-muted bg-surface/50">
              <button type="button" onClick={selectPage} className="hover:text-brand flex items-center gap-1.5">
                <Icon icon="solar:check-square-linear" />
                Select visible page
              </button>
              <span>
                {enriched.length} candidates · Page {page + 1} of {pageCount}
              </span>
            </div>

            {loading ? (
              <div className="p-8 space-y-3">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="h-16 rounded-xl bg-surface-2 animate-pulse" />
                ))}
              </div>
            ) : pageRows.length === 0 ? (
              <div className="p-12 text-center text-text-muted text-sm space-y-2">
                <Icon icon="solar:ghost-linear" className="text-3xl mx-auto opacity-40" />
                <p>No artists match the selected filters or search query.</p>
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {pageRows.map((person) => {
                  const meta = statusMeta(person.status);
                  const busy = savingId === person.id;
                  const hasCustomPitch = Boolean(person.outreach?.last_message);

                  return (
                    <li key={person.id} className="p-3.5 sm:p-4 hover:bg-surface-2/40 transition-colors">
                      <div className="flex gap-3 items-start">
                        <input
                          type="checkbox"
                          checked={selected.has(person.id)}
                          onChange={() => toggleSelect(person.id)}
                          className="mt-2.5 accent-[var(--brand)] rounded"
                        />
                        {person.photo_url ? (
                          <img
                            src={person.photo_url}
                            alt=""
                            className="w-11 h-11 rounded-full object-cover bg-surface-2 shrink-0 border border-border"
                          />
                        ) : (
                          <div className="w-11 h-11 rounded-full bg-surface-2 border border-border flex items-center justify-center text-xs font-bold text-text-muted shrink-0">
                            {(person.name || '?').charAt(0).toUpperCase()}
                          </div>
                        )}

                        <div className="min-w-0 flex-1 space-y-2">
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <Link
                                  to={`/people/${person.slug || person.id}`}
                                  target="_blank"
                                  className="font-bold text-text-primary text-sm hover:text-brand transition-colors"
                                >
                                  {person.name}
                                </Link>
                                {person.is_verified && (
                                  <Icon icon="solar:verified-check-bold" className="text-brand shrink-0 text-sm" />
                                )}
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${statusToneClass(meta.tone)}`}>
                                  {meta.label}
                                </span>
                                {hasCustomPitch && (
                                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-brand/10 text-brand">
                                    <Icon icon="solar:magic-stick-3-bold" />
                                    AI Tailored Pitch
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-text-muted mt-0.5">
                                <a
                                  href={`https://instagram.com/${person.handle}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-brand hover:underline"
                                >
                                  @{person.handle}
                                </a>
                                {person.film_count != null && <> · {person.film_count} films</>}
                                {person.known_for_department && <> · {person.known_for_department}</>}
                                {person.outreach?.contacted_at && (
                                  <> · Sent {new Date(person.outreach.contacted_at).toLocaleDateString()}</>
                                )}
                              </p>
                            </div>
                          </div>

                          {/* Message snippet preview if queued */}
                          {person.outreach?.last_message && (
                            <div className="p-2.5 rounded-xl bg-bg/80 border border-border text-xs text-text-muted font-sans line-clamp-2">
                              "{person.outreach.last_message}"
                            </div>
                          )}

                          {/* Action Buttons */}
                          <div className="flex flex-wrap items-center gap-2 pt-1">
                            <button
                              type="button"
                              onClick={() => openEditor(person)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface border border-border text-xs font-bold text-text-primary hover:border-brand transition-colors"
                            >
                              <Icon icon="solar:pen-new-square-linear" />
                              Edit / Preview Pitch
                            </button>
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => copyAndOpen(person)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand text-white text-xs font-bold hover:opacity-90 transition-opacity disabled:opacity-50"
                            >
                              <Icon icon="solar:copy-linear" />
                              Copy & Open IG
                            </button>
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => upsertStatus(person, 'queued')}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-border text-xs font-bold text-text-muted hover:text-blue-500 hover:border-blue-500/30"
                            >
                              Queue for Bot
                            </button>
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => upsertStatus(person, 'sent')}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-border text-xs font-bold text-text-muted hover:text-emerald-500 hover:border-emerald-500/30"
                            >
                              Mark Sent
                            </button>
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => upsertStatus(person, 'replied')}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-border text-xs font-bold text-text-muted hover:text-brand hover:border-brand/30"
                            >
                              Replied
                            </button>
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => upsertStatus(person, 'skipped')}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-border text-xs font-bold text-text-muted hover:text-text-primary"
                            >
                              Skip
                            </button>
                          </div>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}

            {pageCount > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-border bg-surface/30">
                <button
                  type="button"
                  disabled={page === 0}
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  className="text-xs font-bold text-text-muted disabled:opacity-40 hover:text-brand"
                >
                  Previous
                </button>
                <span className="text-xs text-text-muted">
                  Page {page + 1} of {pageCount}
                </span>
                <button
                  type="button"
                  disabled={page >= pageCount - 1}
                  onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
                  className="text-xs font-bold text-text-muted disabled:opacity-40 hover:text-brand"
                >
                  Next
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Pitch Editor Modal */}
      {activeEditPerson && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="card-cal w-full max-w-xl p-6 rounded-3xl border border-border shadow-2xl space-y-4 bg-surface">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-brand">Edit Direct Pitch</span>
                <h3 className="text-lg font-bold text-text-primary">
                  {activeEditPerson.name} (@{activeEditPerson.handle})
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setActiveEditPerson(null)}
                className="p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-surface-2"
              >
                <Icon icon="solar:close-circle-bold" className="text-xl" />
              </button>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-text-muted">Message Copy (Sent via Instagram DM)</label>
              <textarea
                value={editingMessage}
                onChange={(e) => setEditingMessage(e.target.value)}
                rows={8}
                className="w-full rounded-2xl border border-border bg-surface-2 px-3.5 py-3 text-xs font-sans leading-relaxed text-text-primary focus:outline-none focus:border-brand"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-text-muted">Internal Notes</label>
              <input
                value={editingNotes}
                onChange={(e) => setEditingNotes(e.target.value)}
                placeholder="e.g. Replied on IG asking about cast photo update"
                className="w-full rounded-xl border border-border bg-surface px-3 py-2 text-xs text-text-primary focus:outline-none focus:border-brand"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
              <button
                type="button"
                onClick={() => setActiveEditPerson(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-text-muted hover:text-text-primary"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={saveEditedPitch}
                className="px-5 py-2 rounded-xl bg-brand text-white text-xs font-bold hover:opacity-90 shadow-md shadow-brand/20"
              >
                Save & Queue Pitch
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
