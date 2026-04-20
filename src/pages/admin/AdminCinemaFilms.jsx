/**
 * /admin/cinema-films
 *
 * Triage queue for scraped cinema titles that didn't match our Nollywood
 * catalog (films.is_nollywood=true). Admin decides per row:
 *
 *   • Promote to catalog → inserts into films (is_nollywood=true). Next scrape
 *                          will link showtimes automatically.
 *   • Blacklist          → future scrapes skip this title forever.
 *
 * Blacklisted + promoted rows stay in the table for audit but are hidden by
 * default (toggle filter).
 */

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';

function fmtDate(s) {
  if (!s) return '—';
  return new Date(s).toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function DecisionBadge({ decision }) {
  if (decision === 'promoted')    return <span className="text-xs px-2 py-0.5 rounded-full bg-green-900/40 text-green-400">Promoted ✓</span>;
  if (decision === 'blacklisted') return <span className="text-xs px-2 py-0.5 rounded-full bg-red-900/40 text-red-400">Blacklisted</span>;
  return                                 <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-900/40 text-yellow-400">Pending</span>;
}

// ── Promote modal ────────────────────────────────────────────────────────────

function PromoteModal({ pending, onDone, onClose }) {
  const [form, setForm] = useState({
    title:           pending.title,
    year:            new Date().getFullYear(),
    synopsis:        pending.synopsis ?? '',
    poster_url:      pending.poster_url ?? '',
    runtime_minutes: pending.runtime_minutes ?? '',
    release_type:    'cinema',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState('');

  const handleChange = e => {
    const { name, value } = e.target;
    setForm(f => ({ ...f, [name]: value }));
  };

  const handleSubmit = async e => {
    e.preventDefault();
    setSaving(true);
    setError('');

    // 1. Insert into films
    const { data: created, error: fErr } = await supabase
      .from('films')
      .insert({
        title:            form.title.trim(),
        year:             form.year ? Number(form.year) : null,
        synopsis:         form.synopsis || null,
        poster_url:       form.poster_url || null,
        runtime_minutes:  form.runtime_minutes ? Number(form.runtime_minutes) : null,
        language:         'English',
        status:           'released',
        release_type:     form.release_type,
        source:           'cinema-promoted',
        is_nollywood:     true,
        needs_review:     true,  // admin can still tidy title/metadata on /admin/films
      })
      .select('id')
      .single();
    if (fErr) { setError(fErr.message); setSaving(false); return; }

    // 2. Mark pending row
    const { error: pErr } = await supabase
      .from('pending_cinema_films')
      .update({ admin_decision: 'promoted', promoted_film_id: created.id })
      .eq('id', pending.id);
    if (pErr) { setError(pErr.message); setSaving(false); return; }

    setSaving(false);
    onDone();
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-[#13192B] border border-[#252D45] rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="border-b border-[#252D45] px-6 py-4 flex items-center justify-between sticky top-0 bg-[#13192B] z-10">
          <div>
            <h2 className="text-[#F5F0E8] font-bold">Promote to Nollywood Catalog</h2>
            <p className="text-[#7A8099] text-xs mt-0.5">Creates a films row and links future showtimes automatically.</p>
          </div>
          <button onClick={onClose} className="text-[#7A8099] hover:text-[#F5F0E8] text-xl">✕</button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && <p className="text-red-400 text-sm bg-red-900/20 rounded px-3 py-2">{error}</p>}

          {pending.poster_url && (
            <img src={pending.poster_url} alt="" className="w-24 h-36 rounded-lg object-cover float-right ml-4 border border-[#252D45]" />
          )}

          <div>
            <label className="block text-[#7A8099] text-xs font-medium mb-1">Title *</label>
            <input name="title" value={form.title} onChange={handleChange} required
              className="w-full bg-[#0A0F1E] border border-[#252D45] rounded-xl px-3 py-2 text-[#F5F0E8] text-sm focus:border-[#D4A017] focus:outline-none" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[#7A8099] text-xs font-medium mb-1">Year</label>
              <input name="year" type="number" value={form.year} onChange={handleChange}
                className="w-full bg-[#0A0F1E] border border-[#252D45] rounded-xl px-3 py-2 text-[#F5F0E8] text-sm focus:border-[#D4A017] focus:outline-none" />
            </div>
            <div>
              <label className="block text-[#7A8099] text-xs font-medium mb-1">Runtime (min)</label>
              <input name="runtime_minutes" type="number" value={form.runtime_minutes} onChange={handleChange}
                className="w-full bg-[#0A0F1E] border border-[#252D45] rounded-xl px-3 py-2 text-[#F5F0E8] text-sm focus:border-[#D4A017] focus:outline-none" />
            </div>
          </div>

          <div>
            <label className="block text-[#7A8099] text-xs font-medium mb-1">Poster URL</label>
            <input name="poster_url" value={form.poster_url} onChange={handleChange}
              className="w-full bg-[#0A0F1E] border border-[#252D45] rounded-xl px-3 py-2 text-[#F5F0E8] text-sm focus:border-[#D4A017] focus:outline-none" />
          </div>

          <div>
            <label className="block text-[#7A8099] text-xs font-medium mb-1">Synopsis</label>
            <textarea name="synopsis" value={form.synopsis} onChange={handleChange} rows={4}
              className="w-full bg-[#0A0F1E] border border-[#252D45] rounded-xl px-3 py-2 text-[#F5F0E8] text-sm focus:border-[#D4A017] focus:outline-none" />
          </div>

          <div>
            <label className="block text-[#7A8099] text-xs font-medium mb-1">Release Type</label>
            <select name="release_type" value={form.release_type} onChange={handleChange}
              className="w-full bg-[#0A0F1E] border border-[#252D45] rounded-xl px-3 py-2 text-[#F5F0E8] text-sm focus:border-[#D4A017] focus:outline-none">
              <option value="cinema">Cinema</option>
              <option value="netflix">Netflix</option>
              <option value="prime">Prime Video</option>
              <option value="youtube">YouTube</option>
              <option value="tv">TV</option>
            </select>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-[#252D45]">
            <button type="button" onClick={onClose}
              className="px-4 py-2 text-[#7A8099] hover:text-[#F5F0E8] text-sm">Cancel</button>
            <button type="submit" disabled={saving}
              className="px-4 py-2 bg-[#D4A017] text-[#0A0F1E] rounded-xl text-sm font-semibold hover:bg-[#D4A017]/90 disabled:opacity-50">
              {saving ? 'Promoting…' : 'Promote to Catalog'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Main page ────────────────────────────────────────────────────────────────

export default function AdminCinemaFilms() {
  const [rows, setRows]         = useState([]);
  const [loading, setLoading]   = useState(true);
  const [filter, setFilter]     = useState('pending');    // 'pending' | 'blacklisted' | 'promoted' | 'all'
  const [search, setSearch]     = useState('');
  const [promote, setPromote]   = useState(null);         // pending row being promoted

  const fetchRows = useCallback(async () => {
    setLoading(true);
    let q = supabase
      .from('pending_cinema_films')
      .select('id, title, poster_url, synopsis, rating, runtime_minutes, source, first_seen_at, last_seen_at, showtime_count, admin_decision, last_seen_cinema_id, cinemas(name)')
      .order('last_seen_at', { ascending: false })
      .limit(500);
    if (filter === 'pending')     q = q.is('admin_decision', null);
    if (filter === 'blacklisted') q = q.eq('admin_decision', 'blacklisted');
    if (filter === 'promoted')    q = q.eq('admin_decision', 'promoted');
    const { data, error } = await q;
    if (error) console.error('fetch pending:', error.message);
    setRows(data ?? []);
    setLoading(false);
  }, [filter]);

  useEffect(() => { document.title = 'Admin | Cinema Films'; }, []);
  useEffect(() => { fetchRows(); }, [fetchRows]);

  const blacklist = async (id) => {
    if (!confirm('Blacklist this title? Future cinema scrapes will skip it.')) return;
    const { error } = await supabase
      .from('pending_cinema_films')
      .update({ admin_decision: 'blacklisted' })
      .eq('id', id);
    if (error) return alert(error.message);
    fetchRows();
  };

  const unblacklist = async (id) => {
    const { error } = await supabase
      .from('pending_cinema_films')
      .update({ admin_decision: null, promoted_film_id: null })
      .eq('id', id);
    if (error) return alert(error.message);
    fetchRows();
  };

  const filtered = rows.filter(r =>
    !search || r.title.toLowerCase().includes(search.toLowerCase()),
  );

  const counts = rows.reduce((c, r) => {
    const k = r.admin_decision ?? 'pending';
    c[k] = (c[k] ?? 0) + 1;
    return c;
  }, {});

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-text-primary">Cinema Films — Triage Queue</h2>
        <p className="text-text-muted mt-1">Review scraped titles that didn't match our Nollywood catalog.</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { k: 'pending',     label: 'Pending',     color: 'text-yellow-400' },
          { k: 'promoted',    label: 'Promoted',    color: 'text-green-400'  },
          { k: 'blacklisted', label: 'Blacklisted', color: 'text-red-400'    },
          { k: 'total',       label: 'Total',       color: 'text-gold',
            val: rows.length },
        ].map(s => (
          <div key={s.k} className="bg-surface border border-border rounded-xl p-4">
            <p className="text-text-muted text-xs uppercase tracking-wide">{s.label}</p>
            <p className={`text-2xl font-bold mt-1 ${s.color}`}>
              {s.val ?? counts[s.k] ?? 0}
            </p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="flex bg-surface border border-border rounded-xl overflow-hidden">
          {['pending', 'blacklisted', 'promoted', 'all'].map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-4 py-2 text-sm ${filter === f ? 'bg-[#D4A017] text-[#0A0F1E]' : 'text-text-muted hover:text-text-primary'}`}>
              {f[0].toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search titles…"
          className="flex-1 min-w-[200px] bg-surface border border-border rounded-xl px-4 py-2 text-sm text-text-primary placeholder-text-muted focus:border-gold focus:outline-none"
        />
      </div>

      {/* Table */}
      {loading ? (
        <div className="text-center text-text-muted py-20">Loading…</div>
      ) : filtered.length === 0 ? (
        <div className="text-center text-text-muted py-20">
          <p className="text-3xl mb-2">🎬</p>
          <p>No entries match the current filter.</p>
        </div>
      ) : (
        <div className="bg-surface border border-border rounded-2xl overflow-hidden">
          <table className="w-full">
            <thead className="bg-[#0A0F1E] text-xs uppercase text-text-muted">
              <tr>
                <th className="text-left px-4 py-3">Title</th>
                <th className="text-left px-4 py-3">Source</th>
                <th className="text-left px-4 py-3">Last Seen</th>
                <th className="text-center px-4 py-3">×</th>
                <th className="text-left px-4 py-3">Status</th>
                <th className="text-right px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(r => (
                <tr key={r.id} className="border-t border-border hover:bg-[#0A0F1E]/50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      {r.poster_url && (
                        <img src={r.poster_url} alt="" className="w-10 h-14 rounded object-cover border border-border flex-shrink-0" />
                      )}
                      <div className="min-w-0">
                        <p className="text-text-primary font-medium truncate">{r.title}</p>
                        {r.synopsis && (
                          <p className="text-text-muted text-xs line-clamp-1 mt-0.5">{r.synopsis}</p>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-text-muted">{r.source}</td>
                  <td className="px-4 py-3 text-xs text-text-muted">
                    {fmtDate(r.last_seen_at)}
                    {r.cinemas?.name && <div className="text-[10px] mt-0.5">@ {r.cinemas.name}</div>}
                  </td>
                  <td className="px-4 py-3 text-center text-sm text-text-primary font-medium">{r.showtime_count}</td>
                  <td className="px-4 py-3"><DecisionBadge decision={r.admin_decision} /></td>
                  <td className="px-4 py-3 text-right">
                    <div className="inline-flex gap-2">
                      {r.admin_decision === null && (
                        <>
                          <button onClick={() => setPromote(r)}
                            className="px-3 py-1.5 text-xs bg-green-900/40 text-green-400 hover:bg-green-900/60 rounded-lg">
                            ✓ Promote
                          </button>
                          <button onClick={() => blacklist(r.id)}
                            className="px-3 py-1.5 text-xs bg-red-900/40 text-red-400 hover:bg-red-900/60 rounded-lg">
                            ✕ Blacklist
                          </button>
                        </>
                      )}
                      {r.admin_decision === 'blacklisted' && (
                        <button onClick={() => unblacklist(r.id)}
                          className="px-3 py-1.5 text-xs bg-[#252D45] text-text-muted hover:text-text-primary rounded-lg">
                          ↻ Un-blacklist
                        </button>
                      )}
                      {r.admin_decision === 'promoted' && (
                        <span className="text-xs text-text-muted">(already in catalog)</span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {promote && (
        <PromoteModal
          pending={promote}
          onDone={() => { setPromote(null); fetchRows(); }}
          onClose={() => setPromote(null)}
        />
      )}
    </div>
  );
}
