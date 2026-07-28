import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from '@iconify/react';
import toast from 'react-hot-toast';
import { supabase } from '../../lib/supabase';

/**
 * Review queue for the headless credit-roll harvester
 * (scripts/harvest_credits.ts). The worker never writes to `credits` — it only
 * proposes candidates here, and nothing goes live until it's approved on this
 * page. Extraction guesses; people decide.
 */
export default function AdminCreditHarvest() {
  const [stats, setStats] = useState(null);
  const [groups, setGroups] = useState([]);      // [{ film, candidates[] }]
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('pending');
  const [minConfidence, setMinConfidence] = useState(0);
  const [selected, setSelected] = useState(new Set());
  const [busy, setBusy] = useState(false);

  const loadStats = useCallback(async () => {
    // Pipeline progress — mirrors what the worker is doing on the other machine.
    const counts = {};
    for (const s of ['pending', 'running', 'done', 'failed']) {
      const { count } = await supabase
        .from('credit_harvest_jobs')
        .select('*', { count: 'exact', head: true })
        .eq('status', s);
      counts[s] = count ?? 0;
    }
    for (const o of ['credits_found', 'no_credits']) {
      const { count } = await supabase
        .from('credit_harvest_jobs')
        .select('*', { count: 'exact', head: true })
        .eq('outcome', o);
      counts[o] = count ?? 0;
    }
    const { count: pendingCands } = await supabase
      .from('credit_candidates')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending');
    counts.pendingCandidates = pendingCands ?? 0;
    setStats(counts);
  }, []);

  const loadCandidates = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('credit_candidates')
        .select('*, films:film_id (id, title, slug, poster_url, year), people:matched_person_id (id, name, photo_url)')
        .eq('status', statusFilter)
        .gte('confidence', minConfidence)
        .order('confidence', { ascending: false })
        .limit(400);
      if (error) throw error;

      // Group by film so a reviewer judges a whole roll at once, not stray names.
      const byFilm = new Map();
      for (const c of data || []) {
        const key = c.film_id;
        if (!byFilm.has(key)) byFilm.set(key, { film: c.films, candidates: [] });
        byFilm.get(key).candidates.push(c);
      }
      setGroups([...byFilm.values()]);
      setSelected(new Set());
    } catch (e) {
      toast.error(`Could not load candidates: ${e.message}`);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, minConfidence]);

  useEffect(() => { loadStats(); }, [loadStats]);
  useEffect(() => { loadCandidates(); }, [loadCandidates]);

  const toggle = (id) => setSelected((prev) => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  const toggleFilm = (group) => setSelected((prev) => {
    const next = new Set(prev);
    const ids = group.candidates.map((c) => c.id);
    const allOn = ids.every((id) => next.has(id));
    ids.forEach((id) => (allOn ? next.delete(id) : next.add(id)));
    return next;
  });

  const selectedRows = () =>
    groups.flatMap((g) => g.candidates).filter((c) => selected.has(c.id));

  /** Approve → create the person if needed, then write a real credit row. */
  const approve = async (rows) => {
    if (!rows.length) return;
    setBusy(true);
    let created = 0; let linked = 0; const failed = [];

    for (const row of rows) {
      try {
        let personId = row.matched_person_id;
        if (!personId) {
          // upsert_person_by_name is the shared, name_key-aware create path —
          // using it here keeps the harvester from spawning duplicate people.
          const { data, error } = await supabase.rpc('upsert_person_by_name', {
            p_name: row.raw_name,
            p_data: {},
          });
          if (error) throw error;
          personId = data;
          created++;
        } else linked++;

        const { error: cErr } = await supabase.from('credits').insert({
          film_id: row.film_id,
          person_id: personId,
          role: row.credit_type === 'crew' ? (row.role_or_character || 'crew') : 'actor',
          character_name: row.credit_type === 'cast' ? (row.role_or_character || null) : null,
        });
        // A duplicate credit is a success for our purposes — it's already there.
        if (cErr && !/duplicate|unique/i.test(cErr.message)) throw cErr;

        await supabase.from('credit_candidates')
          .update({ status: 'approved', reviewed_at: new Date().toISOString() })
          .eq('id', row.id);
      } catch (e) {
        failed.push(`${row.raw_name}: ${e.message}`);
      }
    }

    setBusy(false);
    if (failed.length) {
      console.error('Approve failures:', failed);
      toast.error(`${failed.length} failed — see console`);
    }
    toast.success(`Approved ${rows.length - failed.length} (${linked} linked, ${created} new people)`);
    loadCandidates(); loadStats();
  };

  /** Reject → keep the row so the same bad name isn't re-proposed later. */
  const reject = async (rows) => {
    if (!rows.length) return;
    setBusy(true);
    const { error } = await supabase.from('credit_candidates')
      .update({ status: 'rejected', reviewed_at: new Date().toISOString() })
      .in('id', rows.map((r) => r.id));
    setBusy(false);
    error ? toast.error(error.message) : toast.success(`Rejected ${rows.length}`);
    loadCandidates(); loadStats();
  };

  /** Delete → remove entirely (for OCR garbage not worth remembering). */
  const remove = async (rows) => {
    if (!rows.length) return;
    if (!confirm(`Permanently delete ${rows.length} candidate(s)? This cannot be undone.`)) return;
    setBusy(true);
    const { error } = await supabase.from('credit_candidates')
      .delete().in('id', rows.map((r) => r.id));
    setBusy(false);
    error ? toast.error(error.message) : toast.success(`Deleted ${rows.length}`);
    loadCandidates(); loadStats();
  };

  const confidenceStyle = (c) =>
    c >= 0.7 ? 'bg-green-500/15 text-green-400 border-green-500/30'
      : c >= 0.5 ? 'bg-brand/15 text-brand border-brand/30'
        : 'bg-surface-2 text-text-muted border-border';

  const selCount = selected.size;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-black text-text-primary tracking-tight">Credit Harvest Review</h1>
          <p className="text-xs text-text-muted mt-1">
            Candidates extracted from YouTube credit rolls. Nothing is live until approved.
          </p>
        </div>
        <button
          onClick={() => { loadStats(); loadCandidates(); }}
          className="text-xs font-bold px-3 py-2 rounded-lg border border-border hover:bg-surface-2 flex items-center gap-2"
        >
          <Icon icon="solar:refresh-linear" className="w-4 h-4" /> Refresh
        </button>
      </div>

      {/* Pipeline progress — what the worker machine is doing */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
          {[
            ['Queued', stats.pending, 'text-text-primary'],
            ['Running', stats.running, 'text-brand'],
            ['Processed', stats.done, 'text-text-primary'],
            ['Rolls found', stats.credits_found, 'text-green-400'],
            ['No credits', stats.no_credits, 'text-text-muted'],
            ['To review', stats.pendingCandidates, 'text-brand'],
          ].map(([label, value, tone]) => (
            <div key={label} className="card-cal p-3">
              <div className="text-[9px] font-black uppercase tracking-widest text-text-muted">{label}</div>
              <div className={`text-lg font-black ${tone}`}>{value ?? 0}</div>
            </div>
          ))}
        </div>
      )}

      {/* Filters + bulk actions */}
      <div className="card-cal p-4 flex flex-wrap items-center gap-3">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="bg-surface border border-border rounded-lg px-3 py-2 text-xs text-text-primary focus:border-brand outline-none"
        >
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
        </select>

        <label className="flex items-center gap-2 text-xs text-text-muted">
          Min confidence
          <select
            value={minConfidence}
            onChange={(e) => setMinConfidence(Number(e.target.value))}
            className="bg-surface border border-border rounded-lg px-2 py-2 text-xs text-text-primary focus:border-brand outline-none"
          >
            <option value={0}>Any</option>
            <option value={0.5}>0.5+</option>
            <option value={0.7}>0.7+ (high)</option>
          </select>
        </label>

        <div className="flex-1" />

        {selCount > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-text-muted">{selCount} selected</span>
            <button
              disabled={busy}
              onClick={() => approve(selectedRows())}
              className="text-xs font-black px-3 py-2 rounded-lg bg-green-500/15 text-green-400 border border-green-500/30 hover:bg-green-500/25 disabled:opacity-40"
            >
              Approve
            </button>
            <button
              disabled={busy}
              onClick={() => reject(selectedRows())}
              className="text-xs font-black px-3 py-2 rounded-lg bg-surface-2 text-text-primary border border-border hover:bg-surface-3 disabled:opacity-40"
            >
              Reject
            </button>
            <button
              disabled={busy}
              onClick={() => remove(selectedRows())}
              className="text-xs font-black px-3 py-2 rounded-lg bg-red-500/10 text-red-400 border border-red-500/30 hover:bg-red-500/20 disabled:opacity-40"
            >
              Delete
            </button>
          </div>
        )}
      </div>

      {loading ? (
        <div className="card-cal p-12 text-center text-xs text-text-muted">Loading candidates…</div>
      ) : groups.length === 0 ? (
        <div className="card-cal p-12 text-center">
          <div className="text-3xl mb-3">🎬</div>
          <p className="text-sm font-bold text-text-primary">Nothing to review</p>
          <p className="text-xs text-text-muted mt-1">
            Run the harvester on the worker machine to populate this queue.
          </p>
          <code className="inline-block mt-3 text-[10px] bg-surface-2 border border-border rounded px-2 py-1">
            npx tsx scripts/harvest_credits.ts
          </code>
        </div>
      ) : (
        <div className="space-y-4">
          {groups.map((group) => {
            const ids = group.candidates.map((c) => c.id);
            const allOn = ids.every((id) => selected.has(id));
            return (
              <div key={group.film?.id || Math.random()} className="card-cal overflow-hidden">
                <div className="flex items-center gap-3 p-4 border-b border-border bg-surface-2/30">
                  <input
                    type="checkbox"
                    checked={allOn}
                    onChange={() => toggleFilm(group)}
                    className="w-4 h-4 accent-[color:var(--color-brand)]"
                  />
                  {group.film?.poster_url && (
                    <img src={group.film.poster_url} alt="" className="w-8 h-11 object-cover rounded border border-border" />
                  )}
                  <div className="min-w-0 flex-1">
                    <Link
                      to={`/films/${group.film?.slug || group.film?.id}`}
                      target="_blank"
                      className="text-sm font-bold text-text-primary hover:text-brand truncate block"
                    >
                      {group.film?.title || 'Unknown film'}
                    </Link>
                    <div className="text-[10px] text-text-muted">
                      {group.film?.year || '—'} · {group.candidates.length} candidate{group.candidates.length === 1 ? '' : 's'}
                    </div>
                  </div>
                  <button
                    disabled={busy}
                    onClick={() => approve(group.candidates)}
                    className="text-[10px] font-black px-2.5 py-1.5 rounded-md bg-green-500/15 text-green-400 border border-green-500/30 hover:bg-green-500/25 disabled:opacity-40"
                  >
                    Approve all
                  </button>
                </div>

                <div className="divide-y divide-border">
                  {group.candidates.map((c) => (
                    <div key={c.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-surface-2/30">
                      <input
                        type="checkbox"
                        checked={selected.has(c.id)}
                        onChange={() => toggle(c.id)}
                        className="w-4 h-4 accent-[color:var(--color-brand)]"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-bold text-text-primary truncate">{c.raw_name}</div>
                        {c.role_or_character && (
                          <div className="text-[10px] text-text-muted truncate">{c.role_or_character}</div>
                        )}
                      </div>

                      <span className="text-[9px] font-black uppercase tracking-wide px-1.5 py-0.5 rounded bg-surface-2 border border-border text-text-muted">
                        {c.credit_type}
                      </span>

                      {c.people ? (
                        <span className="text-[10px] font-bold text-green-400 flex items-center gap-1 shrink-0" title="Matches an existing person">
                          <Icon icon="solar:check-circle-bold" className="w-3.5 h-3.5" />
                          {c.people.name}
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold text-text-muted shrink-0" title="Will create a new person on approve">
                          new person
                        </span>
                      )}

                      <span className={`text-[10px] font-black px-1.5 py-0.5 rounded border shrink-0 ${confidenceStyle(c.confidence)}`}>
                        {Math.round(c.confidence * 100)}%
                      </span>

                      {statusFilter === 'pending' && (
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            disabled={busy}
                            onClick={() => approve([c])}
                            title="Approve"
                            className="w-6 h-6 rounded flex items-center justify-center text-green-400 hover:bg-green-500/15 disabled:opacity-40"
                          >
                            <Icon icon="solar:check-circle-linear" className="w-4 h-4" />
                          </button>
                          <button
                            disabled={busy}
                            onClick={() => reject([c])}
                            title="Reject"
                            className="w-6 h-6 rounded flex items-center justify-center text-text-muted hover:bg-surface-3 disabled:opacity-40"
                          >
                            <Icon icon="solar:close-circle-linear" className="w-4 h-4" />
                          </button>
                          <button
                            disabled={busy}
                            onClick={() => remove([c])}
                            title="Delete"
                            className="w-6 h-6 rounded flex items-center justify-center text-red-400 hover:bg-red-500/15 disabled:opacity-40"
                          >
                            <Icon icon="solar:trash-bin-trash-linear" className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
