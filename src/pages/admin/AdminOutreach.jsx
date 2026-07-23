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
const PAGE_SIZE = 50;

function statusMeta(id) {
  return OUTREACH_STATUSES.find((s) => s.id === id) || OUTREACH_STATUSES[0];
}

function statusToneClass(tone) {
  if (tone === 'amber') return 'bg-amber-500/10 text-amber-600 border-amber-500/20';
  if (tone === 'blue') return 'bg-blue-500/10 text-blue-600 border-blue-500/20';
  if (tone === 'green') return 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20';
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
  const [statusFilter, setStatusFilter] = useState('pending');
  const [minFilms, setMinFilms] = useState(1);
  const [page, setPage] = useState(0);
  const [template, setTemplate] = useState(() => {
    try {
      return localStorage.getItem(TEMPLATE_KEY) || DEFAULT_OUTREACH_TEMPLATE;
    } catch {
      return DEFAULT_OUTREACH_TEMPLATE;
    }
  });
  const [previewId, setPreviewId] = useState(null);

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
      // Paginate people with Instagram — ~880 today
      const batch = 1000;
      let from = 0;
      const all = [];
      while (true) {
        const { data, error } = await supabase
          .from('people')
          .select('id, name, slug, photo_url, instagram_url, film_count, popularity_score, known_for_department, claimed_by, is_verified')
          .not('instagram_url', 'is', null)
          .neq('instagram_url', '')
          .order('film_count', { ascending: false, nullsFirst: false })
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
        if (Number(p.film_count || 0) < Number(minFilms || 0)) return false;
        if (statusFilter !== 'all' && p.status !== statusFilter) return false;
        if (!q) return true;
        return (
          p.name?.toLowerCase().includes(q) ||
          p.handle?.toLowerCase().includes(q) ||
          p.slug?.toLowerCase().includes(q)
        );
      });
  }, [people, outreachByPerson, search, statusFilter, minFilms]);

  const counts = useMemo(() => {
    const base = { all: 0, pending: 0, queued: 0, sent: 0, replied: 0, skipped: 0 };
    for (const p of people) {
      if (!parseInstagramHandle(p.instagram_url)) continue;
      if (Number(p.film_count || 0) < Number(minFilms || 0)) continue;
      base.all += 1;
      const status = outreachByPerson[p.id]?.status || 'pending';
      base[status] = (base[status] || 0) + 1;
    }
    return base;
  }, [people, outreachByPerson, minFilms]);

  const pageCount = Math.max(1, Math.ceil(enriched.length / PAGE_SIZE));
  const pageRows = enriched.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);

  useEffect(() => {
    setPage(0);
    setSelected(new Set());
  }, [search, statusFilter, minFilms]);

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
        payload.last_message = fillOutreachTemplate(template, person);
      }

      const { data, error } = await supabase
        .from('artist_outreach')
        .upsert(payload, { onConflict: 'person_id' })
        .select('id, person_id, status, notes, last_message, contacted_at, updated_at')
        .single();
      if (error) throw error;

      setOutreachByPerson((prev) => ({ ...prev, [person.id]: data }));
      return data;
    } catch (err) {
      console.error(err);
      toast.error(err.message || 'Failed to update status');
      return null;
    } finally {
      setSavingId(null);
    }
  };

  const copyMessage = async (person, { markQueued = true } = {}) => {
    const text = fillOutreachTemplate(template, person);
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`Copied message for ${person.name}`);
      if (markQueued && person.status === 'pending') {
        await upsertStatus(person, 'queued');
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

  const previewPerson = previewId
    ? enriched.find((p) => p.id === previewId) || people.find((p) => p.id === previewId)
    : pageRows[0] || enriched[0];

  return (
    <div className="space-y-6">
      <header className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div>
          <p className="text-brand text-xs font-bold mb-1">Manual send desk</p>
          <h1 className="text-3xl font-bold text-text-primary tracking-tight">Artist Outreach</h1>
          <p className="text-text-muted text-sm mt-2 max-w-2xl">
            Pick people with Instagram, copy a personalized message, open IG, then mark sent.
            No auto-DM — keeps the account safe.
          </p>
        </div>
        <button
          type="button"
          onClick={load}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-border text-sm font-bold text-text-muted hover:text-text-primary hover:border-brand"
        >
          <Icon icon="solar:refresh-linear" />
          Refresh
        </button>
      </header>

      <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
        {/* Template */}
        <section className="xl:col-span-2 card-cal p-4 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-bold text-text-primary">Message template</h2>
            <button
              type="button"
              className="text-[11px] font-bold text-text-muted hover:text-brand"
              onClick={() => setTemplate(DEFAULT_OUTREACH_TEMPLATE)}
            >
              Reset default
            </button>
          </div>
          <p className="text-[11px] text-text-muted">
            Tokens: {'{first_name}'}, {'{name}'}, {'{profile_url}'}, {'{instagram}'}
          </p>
          <textarea
            value={template}
            onChange={(e) => setTemplate(e.target.value)}
            rows={14}
            className="w-full rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm text-text-primary font-mono leading-relaxed focus:outline-none focus:border-brand"
          />
          {previewPerson && (
            <div className="rounded-lg border border-border bg-bg p-3 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-bold text-text-muted uppercase tracking-wide">
                  Preview · {previewPerson.name}
                </p>
                <button
                  type="button"
                  className="text-[11px] font-bold text-brand"
                  onClick={() => copyMessage(previewPerson, { markQueued: false })}
                >
                  Copy preview
                </button>
              </div>
              <pre className="whitespace-pre-wrap text-xs text-text-primary font-sans leading-relaxed">
                {fillOutreachTemplate(template, previewPerson)}
              </pre>
            </div>
          )}
        </section>

        {/* List */}
        <section className="xl:col-span-3 space-y-4">
          <div className="flex flex-wrap gap-2">
            {[
              { id: 'all', label: 'All with IG' },
              ...OUTREACH_STATUSES.map((s) => ({ id: s.id, label: s.label })),
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setStatusFilter(tab.id)}
                className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-colors ${
                  statusFilter === tab.id
                    ? 'bg-brand text-white border-brand'
                    : 'bg-surface border-border text-text-muted hover:text-text-primary'
                }`}
              >
                {tab.label}
                <span className="ml-1 opacity-70">{counts[tab.id] ?? 0}</span>
              </button>
            ))}
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Icon
                icon="solar:magnifer-linear"
                className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted"
              />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search name or @handle"
                className="w-full pl-9 pr-3 py-2.5 rounded-lg border border-border bg-surface text-sm focus:outline-none focus:border-brand"
              />
            </div>
            <label className="flex items-center gap-2 text-xs font-bold text-text-muted px-1">
              Min films
              <input
                type="number"
                min={0}
                value={minFilms}
                onChange={(e) => setMinFilms(Number(e.target.value) || 0)}
                className="w-16 rounded-lg border border-border bg-surface px-2 py-2 text-sm text-text-primary"
              />
            </label>
          </div>

          {selected.size > 0 && (
            <div className="flex flex-wrap items-center gap-2 p-3 rounded-lg border border-brand/30 bg-brand/5">
              <span className="text-xs font-bold text-brand">{selected.size} selected</span>
              <button type="button" onClick={() => bulkStatus('queued')} className="text-xs font-bold px-2 py-1 rounded bg-surface border border-border">
                Queue
              </button>
              <button type="button" onClick={() => bulkStatus('sent')} className="text-xs font-bold px-2 py-1 rounded bg-surface border border-border">
                Mark sent
              </button>
              <button type="button" onClick={() => bulkStatus('skipped')} className="text-xs font-bold px-2 py-1 rounded bg-surface border border-border">
                Skip
              </button>
              <button type="button" onClick={clearSelect} className="text-xs font-bold text-text-muted ml-auto">
                Clear
              </button>
            </div>
          )}

          <div className="card-cal overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2 border-b border-border text-[11px] font-bold text-text-muted">
              <button type="button" onClick={selectPage} className="hover:text-brand">
                Select page
              </button>
              <span>
                {enriched.length} match · page {page + 1}/{pageCount}
              </span>
            </div>

            {loading ? (
              <div className="p-8 space-y-3">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="h-16 rounded-lg bg-surface-2 animate-pulse" />
                ))}
              </div>
            ) : pageRows.length === 0 ? (
              <div className="p-12 text-center text-text-muted text-sm">
                No people match these filters.
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {pageRows.map((person) => {
                  const meta = statusMeta(person.status);
                  const busy = savingId === person.id;
                  return (
                    <li key={person.id} className="p-3 sm:p-4 hover:bg-surface-2/40 transition-colors">
                      <div className="flex gap-3">
                        <input
                          type="checkbox"
                          checked={selected.has(person.id)}
                          onChange={() => toggleSelect(person.id)}
                          className="mt-3 accent-[var(--brand)]"
                        />
                        {person.photo_url ? (
                          <img
                            src={person.photo_url}
                            alt=""
                            className="w-11 h-11 rounded-full object-cover bg-surface-2 shrink-0"
                          />
                        ) : (
                          <div className="w-11 h-11 rounded-full bg-surface-2 border border-border flex items-center justify-center text-sm font-bold text-text-muted shrink-0">
                            {(person.name || '?').charAt(0).toUpperCase()}
                          </div>
                        )}
                        <div className="min-w-0 flex-1 space-y-2">
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <Link
                                  to={`/people/${person.slug || person.id}`}
                                  target="_blank"
                                  className="font-bold text-text-primary hover:text-brand truncate"
                                >
                                  {person.name}
                                </Link>
                                {person.is_verified && (
                                  <Icon icon="solar:verified-check-bold" className="text-brand shrink-0" />
                                )}
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${statusToneClass(meta.tone)}`}>
                                  {meta.label}
                                </span>
                              </div>
                              <p className="text-xs text-text-muted mt-0.5">
                                @{person.handle}
                                {person.film_count != null && <> · {person.film_count} films</>}
                                {person.known_for_department && <> · {person.known_for_department}</>}
                              </p>
                            </div>
                          </div>

                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => {
                                setPreviewId(person.id);
                                copyAndOpen(person);
                              }}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand text-white text-xs font-bold hover:opacity-90 disabled:opacity-50"
                            >
                              <Icon icon="solar:copy-linear" />
                              Copy + open IG
                            </button>
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => copyMessage(person)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs font-bold text-text-muted hover:text-text-primary"
                            >
                              Copy only
                            </button>
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => upsertStatus(person, 'sent')}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs font-bold text-text-muted hover:text-emerald-600"
                            >
                              Mark sent
                            </button>
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => upsertStatus(person, 'replied')}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs font-bold text-text-muted hover:text-emerald-600"
                            >
                              Replied
                            </button>
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => upsertStatus(person, 'skipped')}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs font-bold text-text-muted hover:text-text-primary"
                            >
                              Skip
                            </button>
                            <a
                              href={personProfileUrl(person)}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs font-bold text-text-muted hover:text-brand"
                            >
                              Profile
                            </a>
                            <button
                              type="button"
                              onClick={() => setPreviewId(person.id)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-text-muted hover:text-brand"
                            >
                              Preview
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
              <div className="flex items-center justify-between px-4 py-3 border-t border-border">
                <button
                  type="button"
                  disabled={page === 0}
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  className="text-xs font-bold text-text-muted disabled:opacity-40 hover:text-brand"
                >
                  Previous
                </button>
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
        </section>
      </div>
    </div>
  );
}
