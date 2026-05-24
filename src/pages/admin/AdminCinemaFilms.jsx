/**
 * /admin/cinema-films
 * 
 * Triage queue for scraped cinema titles that didn't match our Nollywood
 * catalog. Aligned with the premium Cal-inspired orange design system.
 */

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { toast } from 'react-hot-toast';

function fmtDate(s) {
  if (!s) return '—';
  return new Date(s).toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function DecisionBadge({ decision }) {
  if (decision === 'promoted') {
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-green-500/10 text-green-500 border border-green-500/20 text-[9px] font-black uppercase tracking-widest">
        <span className="w-1 h-1 rounded-full bg-green-500" />
        Promoted
      </span>
    );
  }
  if (decision === 'blacklisted') {
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-500/10 text-red-500 border border-red-500/20 text-[9px] font-black uppercase tracking-widest">
        <span className="w-1 h-1 rounded-full bg-red-500" />
        Blacklisted
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-brand/10 text-brand border border-brand/20 text-[9px] font-black uppercase tracking-widest">
      <span className="w-1 h-1 rounded-full bg-brand animate-pulse" />
      Pending Triage
    </span>
  );
}

// --- Promote Modal ---
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
        needs_review:     true,
      })
      .select('id')
      .single();
    
    if (fErr) { setError(fErr.message); setSaving(false); return; }

    const { error: pErr } = await supabase
      .from('pending_cinema_films')
      .update({ admin_decision: 'promoted', promoted_film_id: created.id })
      .eq('id', pending.id);
    
    if (pErr) { setError(pErr.message); setSaving(false); return; }

    setSaving(false);
    onDone();
  };

  return (
    <div className="fixed inset-0 bg-overlay backdrop-blur-md z-[100] flex items-center justify-center p-4">
      <div className="bg-surface border border-border rounded-md w-full max-w-lg shadow-2xl animate-in zoom-in duration-300">
        <div className="p-8 border-b border-border">
          <p className="text-brand text-[10px] font-black uppercase tracking-widest mb-1 italic">Protocol Elevation</p>
          <h2 className="text-2xl font-black text-text-primary tracking-tight">Promote to Catalog</h2>
        </div>
        <form onSubmit={handleSubmit} className="p-8 space-y-6">
          {error && <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-500 text-[10px] font-black uppercase tracking-widest rounded-md">{error}</div>}
          
          <div>
            <label className="block text-text-muted text-[10px] font-black uppercase tracking-widest mb-2 px-1">Global Title</label>
            <input name="title" value={form.title} onChange={handleChange} className="w-full h-12 bg-surface-2 border border-border rounded-lg px-5 text-text-primary text-sm focus:border-brand focus:outline-none" required />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-text-muted text-[10px] font-black uppercase tracking-widest mb-2 px-1">Release Year</label>
              <input type="number" name="year" value={form.year} onChange={handleChange} className="w-full h-12 bg-surface-2 border border-border rounded-lg px-5 text-text-primary text-sm focus:border-brand focus:outline-none" />
            </div>
            <div>
              <label className="block text-text-muted text-[10px] font-black uppercase tracking-widest mb-2 px-1">Runtime (Min)</label>
              <input type="number" name="runtime_minutes" value={form.runtime_minutes} onChange={handleChange} className="w-full h-12 bg-surface-2 border border-border rounded-lg px-5 text-text-primary text-sm focus:border-brand focus:outline-none" />
            </div>
          </div>

          <div className="flex gap-4 pt-4">
            <button type="button" onClick={onClose} className="flex-1 py-4 text-text-muted font-black text-[10px] uppercase tracking-widest hover:bg-surface-2 rounded-lg transition-all">Abort</button>
            <button type="submit" disabled={saving} className="flex-[2] py-4 bg-brand text-white font-black text-[10px] uppercase tracking-widest rounded-lg hover:bg-brand-hover shadow-lg shadow-brand/20 transition-all active:scale-95">
              {saving ? 'Processing...' : 'Confirm Promotion'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function AdminCinemaFilms() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [promoteTarget, setPromoteTarget] = useState(null);
  const [viewMode, setViewMode] = useState('pending'); // 'pending' | 'decided'
  const [search, setSearch] = useState('');

  const fetchItems = useCallback(async () => {
    setLoading(true);
    let query = supabase.from('pending_cinema_films').select('*');
    
    if (viewMode === 'pending') {
      query = query.is('admin_decision', null);
    } else {
      query = query.not('admin_decision', 'is', null);
    }

    const { data } = await query.order('first_seen_at', { ascending: false });
    setItems(data ?? []);
    setLoading(false);
  }, [viewMode]);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  const blacklist = async (id) => {
    if (!window.confirm('Quarantine this title from all future ingestions?')) return;
    const { error } = await supabase.from('pending_cinema_films').update({ admin_decision: 'blacklisted' }).eq('id', id);
    if (!error) {
      toast.success('Title blacklisted');
      fetchItems();
    }
  };

  const filtered = items.filter(i => i.title.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="p-8 max-w-[1400px] mx-auto pb-24">
      {/* Header */}
      <div className="mb-12">
        <p className="text-brand text-[10px] font-black uppercase tracking-[0.4em] mb-2 italic">Triage Protocol</p>
        <h1 className="text-4xl font-black text-text-primary tracking-tight mb-2">Theater Ingestion Queue</h1>
        <p className="text-text-muted text-sm max-w-xl font-medium leading-relaxed">
           Manage un-mapped theater signals. Promote validated Nollywood productions or isolate irrelevant noise from the ecosystem.
        </p>
      </div>

      {/* Controls */}
      <div className="flex flex-col md:flex-row gap-6 mb-10 items-end">
        <div className="flex-1 w-full">
           <label className="block text-text-muted text-[10px] font-black uppercase tracking-widest mb-3 px-1">Signature Search</label>
           <div className="relative group">
              <input
                type="text"
                placeholder="Locate signature by title..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full h-14 bg-surface border border-border rounded-lg px-6 pl-14 text-text-primary text-sm focus:border-brand focus:outline-none transition-all shadow-xl"
              />
              <span className="absolute left-6 top-1/2 -translate-y-1/2 text-xl opacity-30">🔍</span>
           </div>
        </div>
        <div className="flex gap-4">
           {[
             { id: 'pending', label: 'Triage Queue' },
             { id: 'decided', label: 'Archived Decisions' }
           ].map(t => (
             <button
                key={t.id}
                onClick={() => setViewMode(t.id)}
                className={`px-8 py-4 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all border ${
                  viewMode === t.id
                    ? 'bg-text-primary border-text-primary text-surface shadow-xl'
                    : 'bg-surface border-border text-text-muted hover:border-border-hover hover:text-text-primary shadow-sm'
                }`}
             >
               {t.label}
             </button>
           ))}
        </div>
      </div>

      {/* Grid */}
      <div className="card-cal overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-border text-text-muted text-[10px] font-black uppercase tracking-[0.3em] bg-surface-2/50">
                <th className="px-10 py-6">Ingested Signature</th>
                <th className="px-10 py-6">Internal Tracking</th>
                <th className="px-10 py-6">Decision Status</th>
                <th className="px-10 py-6 text-right">Action Protocol</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr><td colSpan="4" className="px-10 py-32 text-center text-[10px] font-black text-brand uppercase animate-pulse">Syncing Triage Data...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan="4" className="px-10 py-32 text-center text-text-muted italic opacity-40 uppercase tracking-widest text-[10px] font-black">Buffer Cleared. No pending items.</td></tr>
              ) : filtered.map(item => (
                <tr key={item.id} className="group hover:bg-surface-2/50 transition-all duration-300">
                  <td className="px-10 py-8">
                    <div className="flex flex-col">
                      <span className="text-text-primary text-base font-black tracking-tight group-hover:text-brand transition-colors">{item.title}</span>
                      <span className="text-[9px] text-text-muted font-bold uppercase tracking-widest mt-1">Detected: {fmtDate(item.first_seen_at)}</span>
                    </div>
                  </td>
                  <td className="px-10 py-8">
                    <div className="flex flex-col">
                      <span className="text-text-primary text-xs font-black italic">ID: {item.id.substring(0,8)}</span>
                      <span className="text-[9px] text-text-muted font-bold uppercase tracking-widest mt-1">Relay Signature Confirmed</span>
                    </div>
                  </td>
                  <td className="px-10 py-8">
                    <DecisionBadge decision={item.admin_decision} />
                  </td>
                  <td className="px-10 py-8 text-right">
                    {!item.admin_decision && (
                       <div className="flex justify-end gap-3 opacity-0 group-hover:opacity-100 transition-all transform translate-x-2 group-hover:translate-x-0">
                          <button
                            onClick={() => setPromoteTarget(item)}
                            className="px-6 py-2.5 bg-green-500 text-white rounded-md text-[10px] font-black uppercase tracking-widest shadow-lg shadow-green-500/20 hover:scale-105 active:scale-95 transition-all"
                          >
                            Promote
                          </button>
                          <button
                            onClick={() => blacklist(item.id)}
                            className="px-6 py-2.5 bg-red-500/10 text-red-500 border border-red-500/20 rounded-md text-[10px] font-black uppercase tracking-widest hover:bg-red-500 hover:text-white transition-all shadow-md active:scale-95"
                          >
                            Isolate
                          </button>
                       </div>
                    )}
                    {item.admin_decision === 'promoted' && (
                       <span className="text-[10px] font-black text-text-muted uppercase italic opacity-40">Resolved via Catalog</span>
                    )}
                    {item.admin_decision === 'blacklisted' && (
                       <span className="text-[10px] font-black text-red-500 uppercase italic opacity-40">Title Quarantined</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {promoteTarget && (
        <PromoteModal
          pending={promoteTarget}
          onDone={() => { setPromoteTarget(null); fetchItems(); toast.success('Elevated to catalog'); }}
          onClose={() => setPromoteTarget(null)}
        />
      )}
    </div>
  );
}
