/**
 * /admin/youtube-videos
 *
 * Shows every channel_video where duration_seconds >= 1800 (30 min).
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import { formatViewCount } from '../../utils/youtube';
import { toast } from 'react-hot-toast';

const FILM_MIN = 1800; // 30 min in seconds

function fmtDuration(s) {
  if (!s) return '—';
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function StatusBadge({ video }) {
  const isPending = video.film_id && video.films?.needs_review;
  const isVerified = video.film_id && !video.films?.needs_review;
  const isUnmatched = !video.film_id;

  return (
    <div className="flex flex-col gap-1.5 items-center">
      <div className="flex items-center gap-2">
        {isUnmatched && (
          <span className="px-2 py-0.5 rounded-lg bg-surface-2 text-text-muted border border-border text-[9px] font-black uppercase tracking-widest">
            Unmatched
          </span>
        )}
        {isPending && (
          <span className="px-2 py-0.5 rounded-lg bg-brand/10 text-brand border border-brand/20 text-[9px] font-black uppercase tracking-widest flex items-center gap-1.5">
            <span className="w-1 h-1 rounded-full bg-brand animate-pulse" />
            Queued
          </span>
        )}
        {isVerified && (
          <span className="px-2 py-0.5 rounded-lg bg-green-500/10 text-green-500 border border-green-500/20 text-[9px] font-black uppercase tracking-widest flex items-center gap-1.5">
            <span className="w-1 h-1 rounded-full bg-green-500" />
            Certified
          </span>
        )}
      </div>
      {video.is_hidden && (
         <span className="px-2 py-0.5 rounded-lg bg-red-500/10 text-red-500 border border-red-500/20 text-[9px] font-black uppercase tracking-widest">
            Hidden
         </span>
      )}
    </div>
  );
}

// ── Edit Film Modal (Modernized) ──────────────────────────────────────────────
function EditFilmModal({ film, onSave, onClose }) {
  const [form, setForm] = useState({
    title:        film.title        ?? '',
    year:         film.year         ?? '',
    synopsis:     film.synopsis     ?? '',
    release_type: film.release_type ?? 'youtube',
    needs_review: film.needs_review ?? true,
  });
  const [saving, setSaving] = useState(false);

  const handleChange = e => {
    const { name, value, type, checked } = e.target;
    setForm(f => ({ ...f, [name]: type === 'checkbox' ? checked : value }));
  };

  const handleSubmit = async e => {
    e.preventDefault();
    setSaving(true);
    const { error: err } = await supabase
      .from('films')
      .update({ ...form, year: form.year ? Number(form.year) : null })
      .eq('id', film.id);
    setSaving(false);
    if (err) { toast.error(err.message); return; }
    toast.success('Metadata updated');
    onSave();
  };

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-xl z-[100] flex items-center justify-center p-4 animate-in fade-in duration-300">
      <div className="bg-surface border border-border rounded-md w-full max-w-xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-400">
        <div className="border-b border-border px-10 py-8 flex items-center justify-between bg-surface-2/30">
          <div>
            <p className="text-brand text-[10px] font-black uppercase tracking-[0.3em] mb-1 italic">Asset Intelligence</p>
            <h2 className="text-text-primary text-2xl font-black tracking-tight">Edit Metadata</h2>
          </div>
          <button onClick={onClose} className="w-12 h-12 flex items-center justify-center rounded-lg hover:bg-surface-2 text-text-muted transition-all">✕</button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-10 space-y-8 overflow-y-auto max-h-[60vh] custom-scrollbar">
          <div>
            <label className="block text-text-muted text-[10px] font-black uppercase tracking-[0.2em] mb-3 px-1">Official Production Title</label>
            <input name="title" value={form.title} onChange={handleChange} className="w-full bg-surface-2 border border-border rounded-lg px-5 h-14 text-text-primary text-sm font-bold focus:border-brand/50 focus:ring-4 focus:ring-brand/5 transition-all outline-none" />
          </div>

          <div className="grid grid-cols-2 gap-8">
            <div>
              <label className="block text-text-muted text-[10px] font-black uppercase tracking-[0.2em] mb-3 px-1">Temporal Origin (Year)</label>
              <input name="year" type="number" value={form.year} onChange={handleChange} className="w-full bg-surface-2 border border-border rounded-lg px-5 h-14 text-text-primary text-sm font-bold focus:border-brand/50 focus:ring-4 focus:ring-brand/5 transition-all outline-none" />
            </div>
            <div>
              <label className="block text-text-muted text-[10px] font-black uppercase tracking-[0.2em] mb-3 px-1">Platform Category</label>
              <div className="relative">
                <select name="release_type" value={form.release_type} onChange={handleChange} className="w-full bg-surface-2 border border-border rounded-lg px-5 h-14 text-text-primary text-[11px] font-black uppercase tracking-widest focus:border-brand/50 outline-none appearance-none cursor-pointer">
                  {['youtube','cinema','netflix','amazon','showmax','iroko'].map(v => <option key={v} value={v}>{v.toUpperCase()}</option>)}
                </select>
                <span className="absolute right-5 top-1/2 -translate-y-1/2 pointer-events-none text-text-muted">↓</span>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-text-muted text-[10px] font-black uppercase tracking-[0.2em] mb-3 px-1">Abstract Perspective (Synopsis)</label>
            <textarea name="synopsis" value={form.synopsis} onChange={handleChange} rows={5} className="w-full bg-surface-2 border border-border rounded-lg px-5 py-4 text-text-primary text-sm font-medium focus:border-brand/50 outline-none resize-none custom-scrollbar" />
          </div>

          <label className="flex items-center gap-5 cursor-pointer select-none bg-surface-2/50 p-6 rounded-lg border border-border hover:border-brand/20 transition-all transition-colors group">
            <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${form.needs_review ? 'bg-brand border-brand shadow-lg shadow-brand/20' : 'border-border group-hover:border-text-muted'}`}>
              <input type="checkbox" name="needs_review" checked={form.needs_review} onChange={handleChange} className="hidden" />
              {form.needs_review && <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" d="M5 13l4 4L19 7" /></svg>}
            </div>
            <div>
                <span className="text-text-primary text-sm font-black uppercase tracking-widest">Global Protocol Verification</span>
                <p className="text-text-muted text-[10px] mt-1 font-bold">Toggle off to certify asset as production-ready.</p>
            </div>
          </label>
        </form>

        <div className="px-10 py-8 border-t border-border bg-surface-2/30 flex gap-4">
          <button type="button" onClick={onClose} className="flex-1 h-14 rounded-lg border border-border text-text-muted font-black text-[10px] uppercase tracking-[0.2em] hover:bg-surface-2 transition-all">Abort Changes</button>
          <button onClick={handleSubmit} disabled={saving} className="flex-[2] h-14 rounded-lg bg-brand text-white font-black text-[10px] uppercase tracking-[0.2em] hover:scale-[1.02] active:scale-95 transition-all shadow-xl shadow-brand/20 disabled:opacity-50">
            {saving ? 'Synchronizing...' : 'Finalize Meta-Sync'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Credits Modal (Modernized) ──────────────────────────────────────────────
const ROLES = ['actor', 'director', 'writer', 'producer', 'cinematographer', 'editor'];

function CreditsModal({ film, onClose }) {
  const [credits,       setCredits]       = useState([]);
  const [loadingC,      setLoadingC]      = useState(true);
  const [peopleQuery,   setPeopleQuery]   = useState('');
  const [peopleResults, setPeopleResults] = useState([]);
  const [searching,     setSearching]     = useState(false);
  const [selectedRole,  setSelectedRole]  = useState('actor');
  const [charName,      setCharName]      = useState('');
  const [adding,        setAdding]        = useState(false);

  const fetchCredits = useCallback(async () => {
    setLoadingC(true);
    const { data } = await supabase
      .from('credits')
      .select('id, role, character_name, billing_order, people(id, name, photo_url)')
      .eq('film_id', film.id)
      .order('billing_order', { ascending: true, nullsFirst: false });
    setCredits(data || []);
    setLoadingC(false);
  }, [film.id]);

  useEffect(() => { fetchCredits(); }, [fetchCredits]);

  useEffect(() => {
    if (!peopleQuery.trim()) { setPeopleResults([]); return; }
    const t = setTimeout(async () => {
      setSearching(true);
      const res = await fetch(`/api/people?search=${encodeURIComponent(peopleQuery)}&limit=10`);
      const json = await res.json();
      setPeopleResults(json.people || []);
      setSearching(false);
    }, 300);
    return () => clearTimeout(t);
  }, [peopleQuery]);

  const addCredit = async (person) => {
    setAdding(true);
    const { error } = await supabase.from('credits').insert({
      film_id:        film.id,
      person_id:      person.id,
      role:           selectedRole,
      character_name: charName.trim() || null,
    });
    if (error) toast.error(error.message);
    else { toast.success(`Added ${person.name}`); setPeopleQuery(''); setPeopleResults([]); setCharName(''); fetchCredits(); }
    setAdding(false);
  };

  const removeCredit = async (creditId) => {
    const { error } = await supabase.from('credits').delete().eq('id', creditId);
    if (error) toast.error('Failed to remove');
    else { setCredits(c => c.filter(x => x.id !== creditId)); toast.success('Attribution removed'); }
  };

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-xl z-[100] flex items-center justify-center p-4 animate-in fade-in duration-300">
      <div className="bg-surface border border-border rounded-md w-full max-w-2xl max-h-[90vh] overflow-hidden shadow-2xl flex flex-col animate-in zoom-in-95 duration-400">
        <div className="border-b border-border px-10 py-8 flex items-center justify-between bg-surface-2/30 flex-shrink-0">
          <div>
            <p className="text-brand text-[10px] font-black uppercase tracking-[0.3em] mb-1 italic">Production Hub</p>
            <h2 className="text-text-primary text-2xl font-black tracking-tight">Credits Management</h2>
            <p className="text-text-muted text-xs mt-1 font-bold">{film.title}</p>
          </div>
          <button onClick={onClose} className="w-12 h-12 flex items-center justify-center rounded-lg hover:bg-surface-2 text-text-muted transition-all">✕</button>
        </div>

        <div className="overflow-y-auto flex-1 p-10 space-y-10 custom-scrollbar">
          <section className="bg-surface-2/30 border border-border rounded-md p-8 space-y-6 shadow-sm">
            <h3 className="text-brand text-[10px] font-black uppercase tracking-[0.2em]">Add New Contributor</h3>

            <div className="grid grid-cols-2 gap-6">
              <div>
                <label className="block text-text-muted text-[10px] font-black uppercase tracking-widest mb-2 pl-1">Department</label>
                <div className="relative">
                  <select value={selectedRole} onChange={e => setSelectedRole(e.target.value)}
                    className="w-full bg-surface border border-border rounded-md px-4 h-12 text-text-primary text-xs font-black uppercase tracking-widest focus:border-brand outline-none appearance-none cursor-pointer group-hover:bg-surface-2 transition-colors">
                    {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-text-muted">↓</span>
                </div>
              </div>
              <div>
                <label className="block text-text-muted text-[10px] font-black uppercase tracking-widest mb-2 pl-1">Persona/Role Name</label>
                <input value={charName} onChange={e => setCharName(e.target.value)} placeholder="e.g. Lead Detective"
                  className="w-full bg-surface border border-border rounded-md px-4 h-12 text-text-primary text-sm font-bold focus:border-brand outline-none transition-all" />
              </div>
            </div>

            <div className="relative">
              <label className="block text-text-muted text-[10px] font-black uppercase tracking-widest mb-2 pl-1">Talent Search</label>
              <div className="relative">
                <input value={peopleQuery} onChange={e => setPeopleQuery(e.target.value)} placeholder="Search the talent registry..."
                  className="w-full bg-surface border border-border rounded-md pl-12 pr-14 h-14 text-text-primary text-sm font-bold focus:border-brand outline-none transition-all" />
                <span className="absolute left-5 top-1/2 -translate-y-1/2 text-text-muted">🔍</span>
                {searching && <div className="absolute right-5 top-1/2 -translate-y-1/2 w-5 h-5 border-3 border-brand/20 border-t-brand rounded-full animate-spin" />}
              </div>
              
              {peopleResults.length > 0 && (
                <div className="absolute z-10 left-0 right-0 mt-3 bg-surface border border-border rounded-lg overflow-hidden shadow-2xl max-h-64 overflow-y-auto animate-in slide-in-from-top-2 duration-200">
                  {peopleResults.map(p => (
                    <button key={p.id} onClick={() => addCredit(p)} disabled={adding} className="w-full flex items-center gap-4 px-6 py-4 hover:bg-surface-2 text-left transition-all border-b border-border/50 last:border-0 group">
                      <div className="w-10 h-10 rounded-full border border-border overflow-hidden bg-surface-2 group-hover:scale-110 transition-transform">
                        {p.photo_url ? <img src={p.photo_url} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-brand font-black text-xs">{p.name?.charAt(0)}</div>}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-text-primary text-sm font-black truncate">{p.name}</p>
                        <p className="text-text-muted text-[10px] font-bold uppercase tracking-widest">{p.known_for_department || 'Talent'}</p>
                      </div>
                      <div className="w-8 h-8 rounded-lg bg-brand/10 text-brand flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <span className="text-lg font-black leading-none">＋</span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </section>

          <div className="space-y-6">
            <h3 className="text-text-muted text-[10px] font-black uppercase tracking-[0.3em] px-1">Verified Contributors</h3>
            {loadingC ? (
              <div className="py-20 text-center flex flex-col items-center gap-4">
                <div className="w-10 h-10 border-4 border-brand/20 border-t-brand rounded-full animate-spin" />
                <p className="text-text-muted text-[10px] font-black uppercase tracking-widest animate-pulse">Syncing production records...</p>
              </div>
            ) : credits.length === 0 ? (
              <div className="py-20 text-center bg-surface-2/30 rounded-md border border-dashed border-border flex flex-col items-center gap-3">
                <span className="text-3xl opacity-20">🎭</span>
                <p className="text-text-muted text-xs font-bold uppercase tracking-widest">No verified talent attached.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {credits.map(c => (
                  <div key={c.id} className="flex items-center justify-between bg-surface-2/50 border border-border rounded-lg p-4 group hover:border-brand/20 transition-all">
                    <div className="flex items-center gap-4">
                      {c.people?.photo_url ? <img src={c.people.photo_url} alt="" className="w-11 h-11 rounded-full object-cover border border-border" /> : <div className="w-11 h-11 rounded-full bg-surface-2 border border-border flex items-center justify-center text-brand text-xs font-black">{c.people?.name?.charAt(0)}</div>}
                      <div className="min-w-0">
                        <p className="text-text-primary text-sm font-black truncate">{c.people?.name}</p>
                        <p className="text-[9px] text-text-muted font-black uppercase tracking-widest mt-0.5">
                          <span className="text-brand">{c.role}</span>
                          {c.character_name && ` · ${c.character_name}`}
                        </p>
                      </div>
                    </div>
                    <button onClick={() => removeCredit(c.id)} className="w-9 h-9 flex items-center justify-center rounded-md bg-red-500/5 text-red-500 border border-red-500/10 opacity-0 group-hover:opacity-100 hover:bg-red-500 hover:text-white transition-all">✕</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────
export default function AdminYouTubeVideos() {
  const [videos,       setVideos]       = useState([]);
  const [channels,     setChannels]     = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [channelFilter,setChannelFilter]= useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchQuery,  setSearchQuery]  = useState('');
  const [editFilm,     setEditFilm]     = useState(null);
  const [creditsFilm,  setCreditsFilm]  = useState(null);
  const [togglingId,   setTogglingId]   = useState(null);
  const [syncing,      setSyncing]      = useState(false);

  const fetchVideos = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from('channel_videos')
      .select(`
        id, video_id, title, thumbnail_url, published_at,
        duration_seconds, is_hidden, film_id, match_status,
        channels(id, name),
        films(id, title, needs_review, release_type, year, synopsis)
      `)
      .gte('duration_seconds', FILM_MIN)
      .order('published_at', { ascending: false });

    if (channelFilter !== 'all') query = query.eq('channel_id', channelFilter);
    if (searchQuery.trim()) query = query.ilike('title', `%${searchQuery}%`);

    const { data } = await query.limit(500);
    setVideos(data || []);
    setLoading(false);
  }, [channelFilter, searchQuery]);

  useEffect(() => { fetchVideos(); }, [fetchVideos]);

  useEffect(() => {
    supabase.from('channels').select('id, name').order('name').then(({ data }) => setChannels(data || []));
  }, []);

  const toggleHidden = async (video) => {
    setTogglingId(video.id);
    const { error } = await supabase.from('channel_videos').update({ is_hidden: !video.is_hidden }).eq('id', video.id);
    if (error) toast.error('Visibility toggle failed');
    else {
      setVideos(vs => vs.map(v => v.id === video.id ? { ...v, is_hidden: !v.is_hidden } : v));
      toast.success(video.is_hidden ? 'Asset is now visible' : 'Asset has been hidden');
    }
    setTogglingId(null);
  };

  const handleManualSync = async () => {
    setSyncing(true);
    try {
      const res = await fetch('/api/cron/refresh-videos', { method: 'POST' });
      const json = await res.json();
      if (!res.ok) toast.error(`Sync Error: ${json.error}`);
      else {
        toast.success(`Successfully processed ${json.channels_processed} channels.`);
        fetchVideos();
      }
    } catch (e) { toast.error(`Network error: ${e.message}`); }
    setSyncing(false);
  };

  const stats = useMemo(() => ({
    total: videos.length,
    pending: videos.filter(v => v.film_id && v.films?.needs_review).length,
    verified: videos.filter(v => v.film_id && !v.films?.needs_review).length,
    unmatched: videos.filter(v => !v.film_id).length,
    hidden: videos.filter(v => v.is_hidden).length,
  }), [videos]);

  const filtered = videos.filter(v => {
    if (statusFilter === 'needs_review' && !(v.film_id && v.films?.needs_review)) return false;
    if (statusFilter === 'matched'   && !(v.film_id && !v.films?.needs_review)) return false;
    if (statusFilter === 'unmatched' && v.film_id) return false;
    if (statusFilter === 'hidden'    && !v.is_hidden) return false;
    return true;
  });

  return (
    <div className="space-y-10 animate-in fade-in duration-500">
      {/* Header */}
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-8">
        <div>
          <p className="text-brand text-[10px] font-black uppercase tracking-[0.3em] mb-1 italic">Content Ingestion</p>
          <h1 className="text-3xl font-black text-text-primary tracking-tight">YouTube Assets</h1>
          <p className="text-text-muted text-sm mt-1 max-w-xl font-medium leading-relaxed opacity-80">
            Automated movie intercept and cataloging engine. Managing verified production streams.
          </p>
        </div>
        <button 
          onClick={handleManualSync} 
          disabled={syncing} 
          className="bg-brand text-white font-black px-10 py-3.5 rounded-lg text-sm hover:scale-[1.02] active:scale-[0.98] transition-all shadow-xl shadow-brand/20 flex items-center gap-3"
        >
          {syncing ? (
            <div className="w-4 h-4 border-3 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <span className="text-lg leading-none">🔄</span>
          )}
          {syncing ? 'Scanning Channels...' : 'Initialize Video Sync'}
        </button>
      </header>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-6">
        {[
          { label: 'Total Intercepts', val: stats.total,      icon: '🎞️', color: 'text-text-primary' },
          { label: 'Pending Review',   val: stats.pending,    icon: '⏳', color: 'text-brand' },
          { label: 'Certified Assets', val: stats.verified,   icon: '✅', color: 'text-green-500' },
          { label: 'Unmatched Signals', val: stats.unmatched,  icon: '❓', color: 'text-text-muted' },
          { label: 'Security Lock',    val: stats.hidden,     icon: '🔒', color: 'text-red-500' },
        ].map(s => (
          <div key={s.label} className="card-cal p-6 group hover:border-brand/20 transition-all">
            <div className="flex items-center gap-3 mb-4 opacity-60">
              <span className="text-xl">{s.icon}</span>
              <p className="text-[10px] font-black text-text-muted uppercase tracking-[0.15em] leading-none">{s.label}</p>
            </div>
            <p className={`text-3xl font-black tracking-tighter ${s.color}`}>{s.val}</p>
          </div>
        ))}
      </div>

      {/* Modernized Filter Bar */}
      <div className="card-cal p-2 overflow-hidden flex flex-col md:flex-row items-center divide-y md:divide-y-0 md:divide-x divide-border">
        <div className="flex-[1.5] relative w-full">
          <span className="absolute left-6 top-1/2 -translate-y-1/2 text-text-muted">🔍</span>
          <input 
            type="text" 
            value={searchQuery} 
            onChange={e => setSearchQuery(e.target.value)} 
            placeholder="Search intercepted asset title..." 
            className="w-full bg-transparent border-none py-5 pl-14 pr-6 text-text-primary text-sm font-bold focus:ring-0 placeholder:text-text-muted/50" 
          />
        </div>
        
        <div className="w-full md:w-72 relative bg-surface-2/30">
          <select value={channelFilter} onChange={e => setChannelFilter(e.target.value)} className="w-full bg-transparent border-none py-5 px-8 text-text-primary text-sm font-black uppercase tracking-widest focus:ring-0 cursor-pointer appearance-none">
            <option value="all">Every Source</option>
            {channels.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <span className="absolute right-6 top-1/2 -translate-y-1/2 pointer-events-none text-text-muted">↓</span>
        </div>

        <div className="w-full md:w-72 relative bg-surface-2/50">
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="w-full bg-transparent border-none py-5 px-8 text-text-primary text-sm font-black uppercase tracking-widest focus:ring-0 cursor-pointer appearance-none">
            <option value="all">Static State</option>
            <option value="needs_review">Needs Review</option>
            <option value="matched">Certified</option>
            <option value="unmatched">Unmatched</option>
            <option value="hidden">Hidden</option>
          </select>
          <span className="absolute right-6 top-1/2 -translate-y-1/2 pointer-events-none text-text-muted">↓</span>
        </div>
      </div>

      {/* Main Production Table */}
      <div className="card-cal overflow-hidden">
        <div className="overflow-x-auto">
          {loading ? (
            <div className="py-32 text-center flex flex-col items-center gap-6">
              <div className="w-12 h-12 border-4 border-brand/20 border-t-brand rounded-full animate-spin" />
              <p className="text-text-muted text-[11px] font-black uppercase tracking-[0.3em] animate-pulse">Syncing Production Spectrum...</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-32 text-center flex flex-col items-center gap-4">
              <span className="text-4xl opacity-20">🎞️</span>
              <p className="text-text-muted text-lg font-bold">No assets match current scan protocol.</p>
              <button onClick={() => { setSearchQuery(''); setChannelFilter('all'); setStatusFilter('all'); }} className="text-brand font-black text-[10px] uppercase tracking-widest hover:underline">Reset Protocols</button>
            </div>
          ) : (
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-surface-2/30 border-b border-border text-[10px] font-black text-text-muted uppercase tracking-[0.2em]">
                  <th className="px-10 py-5 text-left">Transmission Payload</th>
                  <th className="px-6 py-5 text-center">Protocol Status</th>
                  <th className="px-6 py-5 text-center w-32">Temporal Len</th>
                  <th className="px-10 py-5 text-right">Settings</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {filtered.map(v => (
                  <tr key={v.id} className="hover:bg-surface-2/40 transition-all group">
                    <td className="px-10 py-6">
                      <div className="flex items-center gap-6">
                        <div className="relative flex-shrink-0">
                          <img src={v.thumbnail_url} alt="" className="w-28 h-16 rounded-md object-cover shadow-xl border border-border transition-transform group-hover:scale-105" />
                          <div className="absolute inset-0 rounded-md ring-1 ring-inset ring-black/5" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-text-primary text-sm font-black truncate leading-tight group-hover:text-brand transition-colors tracking-tight">{v.film_id ? v.films?.title : v.title}</p>
                          <div className="flex items-center gap-2 mt-1.5 font-bold uppercase tracking-widest">
                            <span className="text-[10px] text-text-muted">{v.channels?.name || 'External Stream'}</span>
                            <span className="w-1 h-1 rounded-full bg-border" />
                            <span className="text-[10px] text-text-muted/60">{new Date(v.published_at).toLocaleDateString()}</span>
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-6 text-center">
                      <StatusBadge video={v} />
                    </td>
                    <td className="px-6 py-6 text-center">
                      <span className="text-[11px] font-black text-text-muted font-mono tracking-tighter bg-surface-2 px-2 py-1 rounded-lg border border-border/50">
                        {fmtDuration(v.duration_seconds)}
                      </span>
                    </td>
                    <td className="px-10 py-6 text-right">
                      <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        {v.film_id ? (
                          <>
                            <button onClick={() => setEditFilm(v.films)} className="h-10 px-5 rounded-md border border-border bg-surface-2 text-text-primary text-[10px] font-black uppercase tracking-widest hover:border-brand/30 hover:text-brand transition-all">Intel</button>
                            <button onClick={() => setCreditsFilm(v.films)} className="h-10 px-5 rounded-md border border-border bg-surface-2 text-text-primary text-[10px] font-black uppercase tracking-widest hover:border-brand/30 hover:text-brand transition-all">Cast</button>
                          </>
                        ) : (
                          <div className="text-[10px] font-black text-text-muted/30 uppercase mr-4 tracking-widest">Protocol Locked</div>
                        )}
                        <button onClick={() => toggleHidden(v)} disabled={togglingId === v.id} className={`h-10 w-10 flex items-center justify-center rounded-md border border-border transition-all ${v.is_hidden ? 'bg-red-500/10 text-red-500 border-red-500/20' : 'bg-surface-2 hover:border-text-muted text-text-muted'}`}>
                          {togglingId === v.id ? (
                             <div className="w-3.5 h-3.5 border-2 border-text-muted/30 border-t-text-muted rounded-full animate-spin" />
                          ) : (
                            <span className="text-lg leading-none">{v.is_hidden ? '👁️' : '🚫'}</span>
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {editFilm && (
        <EditFilmModal film={editFilm} onSave={() => { setEditFilm(null); fetchVideos(); }} onClose={() => setEditFilm(null)} />
      )}
      {creditsFilm && (
        <CreditsModal film={creditsFilm} onClose={() => setCreditsFilm(null)} />
      )}
    </div>
  );
}
