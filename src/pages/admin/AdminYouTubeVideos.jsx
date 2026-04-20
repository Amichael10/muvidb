/**
 * /admin/youtube-videos
 *
 * Shows every channel_video where duration_seconds >= 1800 (30 min).
 * Admins can:
 *  - Toggle is_hidden (suppresses the video from public pages)
 *  - Edit the auto-generated film record (fix title, add synopsis, approve)
 *  - Add cast / crew credits to a film
 *  - Trigger AI extraction (when OPENAI key becomes available)
 */

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';

const FILM_MIN = 1800; // 30 min in seconds

function fmtDuration(s) {
  if (!s) return '—';
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function StatusBadge({ video }) {
  if (!video.film_id)           return <span className="text-xs px-2 py-0.5 rounded-full bg-[#1C2440] text-[#7A8099]">Unmatched</span>;
  if (video.film?.needs_review) return <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-900/40 text-yellow-400">Needs Review</span>;
  return                               <span className="text-xs px-2 py-0.5 rounded-full bg-green-900/40 text-green-400">Matched ✓</span>;
}

// ── Edit Film Modal ───────────────────────────────────────────────────────────

function EditFilmModal({ film, onSave, onClose }) {
  const [form, setForm] = useState({
    title:        film.title        ?? '',
    year:         film.year         ?? '',
    synopsis:     film.synopsis     ?? '',
    release_type: film.release_type ?? 'youtube',
    needs_review: film.needs_review ?? true,
  });
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState('');

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
    if (err) { setError(err.message); return; }
    onSave();
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-[#13192B] border border-[#252D45] rounded-2xl w-full max-w-lg">
        <div className="border-b border-[#252D45] px-6 py-4 flex items-center justify-between">
          <h2 className="text-[#F5F0E8] font-bold">Edit Film</h2>
          <button onClick={onClose} className="text-[#7A8099] hover:text-[#F5F0E8] text-xl">✕</button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && <p className="text-red-400 text-sm">{error}</p>}

          <div>
            <label className="block text-[#7A8099] text-xs font-medium mb-1">Title *</label>
            <input name="title" value={form.title} onChange={handleChange}
              className="w-full bg-[#0A0F1E] border border-[#252D45] rounded-xl px-3 py-2 text-[#F5F0E8] text-sm focus:border-[#D4A017] focus:outline-none" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[#7A8099] text-xs font-medium mb-1">Year</label>
              <input name="year" type="number" value={form.year} onChange={handleChange}
                className="w-full bg-[#0A0F1E] border border-[#252D45] rounded-xl px-3 py-2 text-[#F5F0E8] text-sm focus:border-[#D4A017] focus:outline-none" />
            </div>
            <div>
              <label className="block text-[#7A8099] text-xs font-medium mb-1">Release Type</label>
              <select name="release_type" value={form.release_type} onChange={handleChange}
                className="w-full bg-[#0A0F1E] border border-[#252D45] rounded-xl px-3 py-2 text-[#F5F0E8] text-sm focus:border-[#D4A017] focus:outline-none">
                {['youtube','cinema','netflix','amazon','showmax','iroko'].map(v =>
                  <option key={v} value={v}>{v.charAt(0).toUpperCase() + v.slice(1)}</option>
                )}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-[#7A8099] text-xs font-medium mb-1">Synopsis</label>
            <textarea name="synopsis" value={form.synopsis} onChange={handleChange} rows={3}
              className="w-full bg-[#0A0F1E] border border-[#252D45] rounded-xl px-3 py-2 text-[#F5F0E8] text-sm focus:border-[#D4A017] focus:outline-none resize-none" />
          </div>

          <label className="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" name="needs_review" checked={form.needs_review} onChange={handleChange}
              className="w-4 h-4 accent-yellow-400" />
            <span className="text-[#F5F0E8] text-sm">Still needs review</span>
          </label>
          <p className="text-[#7A8099] text-xs -mt-2">
            Uncheck this to mark the film as approved — it will appear in public filmography.
          </p>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-[#252D45] text-[#7A8099] hover:text-[#F5F0E8] text-sm">Cancel</button>
            <button type="submit" disabled={saving}
              className="flex-1 py-2.5 rounded-xl bg-[#D4A017] text-black font-bold text-sm disabled:opacity-50">
              {saving ? 'Saving…' : 'Save Film'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Credits Modal ─────────────────────────────────────────────────────────────

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
  const [msg,           setMsg]           = useState('');

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
    setMsg('');
    const { error } = await supabase.from('credits').insert({
      film_id:        film.id,
      person_id:      person.id,
      role:           selectedRole,
      character_name: charName.trim() || null,
    });
    if (error) setMsg(error.message);
    else { setMsg(`Added ${person.name} as ${selectedRole}`); setPeopleQuery(''); setPeopleResults([]); setCharName(''); fetchCredits(); }
    setAdding(false);
  };

  const removeCredit = async (creditId) => {
    await supabase.from('credits').delete().eq('id', creditId);
    setCredits(c => c.filter(x => x.id !== creditId));
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-[#13192B] border border-[#252D45] rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="border-b border-[#252D45] px-6 py-4 flex items-center justify-between flex-shrink-0">
          <div>
            <h2 className="text-[#F5F0E8] font-bold">Credits — {film.title}</h2>
            <p className="text-[#7A8099] text-xs mt-0.5">Add or remove cast & crew</p>
          </div>
          <button onClick={onClose} className="text-[#7A8099] hover:text-[#F5F0E8] text-xl">✕</button>
        </div>

        <div className="overflow-y-auto flex-1 p-5 space-y-5">
          {/* Add person */}
          <div className="bg-[#0A0F1E] border border-[#252D45] rounded-xl p-4 space-y-3">
            <p className="text-[#F5F0E8] text-sm font-medium">Add person</p>

            {msg && <p className="text-green-400 text-xs">{msg}</p>}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[#7A8099] text-xs mb-1">Role</label>
                <select value={selectedRole} onChange={e => setSelectedRole(e.target.value)}
                  className="w-full bg-[#13192B] border border-[#252D45] rounded-xl px-3 py-2 text-[#F5F0E8] text-sm focus:border-[#D4A017] focus:outline-none">
                  {ROLES.map(r => <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[#7A8099] text-xs mb-1">Character name (actors only)</label>
                <input value={charName} onChange={e => setCharName(e.target.value)} placeholder="optional"
                  className="w-full bg-[#13192B] border border-[#252D45] rounded-xl px-3 py-2 text-[#F5F0E8] text-sm focus:border-[#D4A017] focus:outline-none placeholder-[#7A8099]" />
              </div>
            </div>

            <div className="relative">
              <input
                value={peopleQuery}
                onChange={e => setPeopleQuery(e.target.value)}
                placeholder="Search people by name…"
                className="w-full bg-[#13192B] border border-[#252D45] rounded-xl px-3 py-2 text-[#F5F0E8] text-sm focus:border-[#D4A017] focus:outline-none placeholder-[#7A8099]"
              />
              {searching && <p className="text-[#7A8099] text-xs mt-1">Searching…</p>}
              {peopleResults.length > 0 && (
                <div className="absolute z-10 left-0 right-0 mt-1 bg-[#13192B] border border-[#252D45] rounded-xl overflow-hidden shadow-2xl">
                  {peopleResults.map(p => (
                    <button
                      key={p.id}
                      onClick={() => addCredit(p)}
                      disabled={adding}
                      className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-[#1C2440] text-left transition-colors"
                    >
                      {p.photo_url
                        ? <img src={p.photo_url} alt="" className="w-8 h-8 rounded-full object-cover flex-shrink-0" />
                        : <div className="w-8 h-8 rounded-full bg-[#1C2440] flex items-center justify-center text-[#D4A017] font-bold text-sm flex-shrink-0">{p.name?.charAt(0)}</div>
                      }
                      <div className="min-w-0">
                        <p className="text-[#F5F0E8] text-sm font-medium truncate">{p.name}</p>
                        {p.known_for_department && <p className="text-[#7A8099] text-xs">{p.known_for_department}</p>}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Existing credits */}
          <div>
            <p className="text-[#7A8099] text-xs font-medium uppercase tracking-wider mb-2">Current Credits</p>
            {loadingC ? (
              <p className="text-[#7A8099] text-sm">Loading…</p>
            ) : credits.length === 0 ? (
              <p className="text-[#7A8099] text-sm">No credits yet.</p>
            ) : (
              <div className="space-y-1.5">
                {credits.map(c => (
                  <div key={c.id} className="flex items-center justify-between bg-[#0A0F1E] border border-[#252D45] rounded-xl px-4 py-2.5">
                    <div className="flex items-center gap-3">
                      {c.people?.photo_url
                        ? <img src={c.people.photo_url} alt="" className="w-8 h-8 rounded-full object-cover" />
                        : <div className="w-8 h-8 rounded-full bg-[#1C2440] flex items-center justify-center text-[#D4A017] text-sm font-bold">{c.people?.name?.charAt(0)}</div>
                      }
                      <div>
                        <p className="text-[#F5F0E8] text-sm font-medium">{c.people?.name}</p>
                        <p className="text-[#7A8099] text-xs capitalize">
                          {c.role}{c.character_name ? ` · ${c.character_name}` : ''}
                        </p>
                      </div>
                    </div>
                    <button onClick={() => removeCredit(c.id)}
                      className="text-red-400 hover:text-red-300 text-xs px-2 py-1 rounded-lg hover:bg-red-900/20 transition-colors">
                      Remove
                    </button>
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

// ── Main page ─────────────────────────────────────────────────────────────────

export default function AdminYouTubeVideos() {
  const [videos,       setVideos]       = useState([]);
  const [channels,     setChannels]     = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [channelFilter,setChannelFilter]= useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [editFilm,     setEditFilm]     = useState(null);  // film object
  const [creditsFilm,  setCreditsFilm]  = useState(null);  // film object
  const [togglingId,   setTogglingId]   = useState(null);
  const [syncing,      setSyncing]      = useState(false);
  const [syncMsg,      setSyncMsg]      = useState('');

  const fetchVideos = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('channel_videos')
      .select(`
        id, video_id, title, thumbnail_url, published_at,
        duration_seconds, is_hidden, film_id, match_status,
        channels(id, name),
        films(id, title, needs_review, release_type, year, synopsis)
      `)
      .gte('duration_seconds', FILM_MIN)
      .order('published_at', { ascending: false })
      .limit(200);

    setVideos(data || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchVideos();
    // Also load channel list for filter dropdown
    supabase.from('channels').select('id, name').order('name')
      .then(({ data }) => setChannels(data || []));
  }, [fetchVideos]);

  const toggleHidden = async (video) => {
    setTogglingId(video.id);
    await supabase
      .from('channel_videos')
      .update({ is_hidden: !video.is_hidden })
      .eq('id', video.id);
    setVideos(vs => vs.map(v => v.id === video.id ? { ...v, is_hidden: !v.is_hidden } : v));
    setTogglingId(null);
  };

  const handleManualSync = async () => {
    setSyncing(true);
    setSyncMsg('');
    try {
      const res = await fetch('/api/cron/refresh-videos', { method: 'POST' });
      const json = await res.json();
      if (!res.ok) setSyncMsg(`Error: ${json.error}`);
      else setSyncMsg(`Done — ${json.channels_processed} channels, ${json.videos_upserted} videos, ${json.films_created} films created.`);
      fetchVideos();
    } catch (e) {
      setSyncMsg(`Network error: ${e.message}`);
    }
    setSyncing(false);
  };

  // Stats
  const total       = videos.length;
  const needsReview = videos.filter(v => v.film_id && v.films?.needs_review).length;
  const matched     = videos.filter(v => v.film_id && !v.films?.needs_review).length;
  const unmatched   = videos.filter(v => !v.film_id).length;
  const hidden      = videos.filter(v => v.is_hidden).length;

  // Filter
  const filtered = videos.filter(v => {
    if (channelFilter !== 'all' && v.channels?.id !== channelFilter) return false;
    if (statusFilter === 'needs_review' && !(v.film_id && v.films?.needs_review)) return false;
    if (statusFilter === 'matched'   && !(v.film_id && !v.films?.needs_review)) return false;
    if (statusFilter === 'unmatched' && v.film_id) return false;
    if (statusFilter === 'hidden'    && !v.is_hidden) return false;
    return true;
  });

  return (
    <div>
      {/* Header */}
      <div className="flex items-start justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[#F5F0E8]">YouTube Videos (30+ min)</h1>
          <p className="text-[#7A8099] text-sm mt-1">
            Auto-crawled films from linked channels. Review and approve before they go public.
          </p>
        </div>
        <button
          onClick={handleManualSync}
          disabled={syncing}
          className="bg-[#1C2440] border border-[#252D45] text-[#F5F0E8] font-medium px-5 py-2.5 rounded-xl text-sm hover:border-[#D4A017]/50 disabled:opacity-50 transition-all flex items-center gap-2"
        >
          <span>{syncing ? '⟳ Syncing…' : '↻ Run Sync Now'}</span>
        </button>
      </div>

      {syncMsg && (
        <div className="mb-4 bg-[#13192B] border border-[#252D45] text-[#F5F0E8] text-sm px-4 py-3 rounded-xl">
          {syncMsg}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
        {[
          { label: 'Total',        value: total,       color: 'text-[#F5F0E8]' },
          { label: 'Needs Review', value: needsReview, color: 'text-yellow-400' },
          { label: 'Approved',     value: matched,     color: 'text-green-400' },
          { label: 'Unmatched',    value: unmatched,   color: 'text-[#7A8099]' },
          { label: 'Hidden',       value: hidden,      color: 'text-red-400' },
        ].map(s => (
          <div key={s.label} className="bg-[#13192B] border border-[#252D45] rounded-xl p-3 text-center">
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-[#7A8099] text-xs mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap mb-5">
        <select
          value={channelFilter}
          onChange={e => setChannelFilter(e.target.value)}
          className="bg-[#13192B] border border-[#252D45] text-[#F5F0E8] rounded-xl px-3 py-2 text-sm focus:border-[#D4A017] focus:outline-none"
        >
          <option value="all">All Channels</option>
          {channels.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="bg-[#13192B] border border-[#252D45] text-[#F5F0E8] rounded-xl px-3 py-2 text-sm focus:border-[#D4A017] focus:outline-none"
        >
          <option value="all">All Statuses</option>
          <option value="needs_review">Needs Review</option>
          <option value="matched">Approved</option>
          <option value="unmatched">Unmatched</option>
          <option value="hidden">Hidden</option>
        </select>
        <span className="text-[#7A8099] text-sm self-center">{filtered.length} videos</span>
      </div>

      {/* Table */}
      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-16 bg-[#13192B] rounded-xl animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-5xl mb-4">🎬</p>
          <p className="text-[#F5F0E8] font-bold text-lg">No videos found</p>
          <p className="text-[#7A8099] text-sm mt-1">Try a different filter or run a sync</p>
        </div>
      ) : (
        <div className="bg-[#13192B] border border-[#252D45] rounded-2xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#252D45] text-[#7A8099] text-xs uppercase tracking-wider">
                <th className="text-left px-4 py-3 font-medium">Video</th>
                <th className="text-left px-4 py-3 font-medium hidden md:table-cell">Channel</th>
                <th className="text-left px-4 py-3 font-medium hidden lg:table-cell">Duration</th>
                <th className="text-left px-4 py-3 font-medium hidden lg:table-cell">Published</th>
                <th className="text-left px-4 py-3 font-medium">Status</th>
                <th className="text-right px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((v, i) => (
                <tr
                  key={v.id}
                  className={`border-b border-[#252D45] last:border-0 transition-colors ${
                    v.is_hidden ? 'opacity-40' : ''
                  } ${i % 2 === 0 ? '' : 'bg-[#0A0F1E]/30'} hover:bg-[#1C2440]/30`}
                >
                  {/* Video */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      {v.thumbnail_url ? (
                        <img src={v.thumbnail_url} alt=""
                          className="w-16 h-10 rounded-lg object-cover flex-shrink-0" />
                      ) : (
                        <div className="w-16 h-10 rounded-lg bg-[#1C2440] flex items-center justify-center flex-shrink-0">
                          <span className="text-[#7A8099] text-xs">▶</span>
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="text-[#F5F0E8] text-xs font-medium line-clamp-2 max-w-[200px]">
                          {v.film_id ? v.films?.title : v.title}
                        </p>
                        {v.film_id && v.films?.title !== v.title && (
                          <p className="text-[#7A8099] text-[10px] line-clamp-1 max-w-[200px]">
                            YT: {v.title}
                          </p>
                        )}
                      </div>
                    </div>
                  </td>

                  {/* Channel */}
                  <td className="px-4 py-3 hidden md:table-cell">
                    <span className="text-[#7A8099] text-xs">{v.channels?.name || '—'}</span>
                  </td>

                  {/* Duration */}
                  <td className="px-4 py-3 hidden lg:table-cell">
                    <span className="text-[#7A8099] text-xs">{fmtDuration(v.duration_seconds)}</span>
                  </td>

                  {/* Published */}
                  <td className="px-4 py-3 hidden lg:table-cell">
                    <span className="text-[#7A8099] text-xs">
                      {v.published_at ? new Date(v.published_at).toLocaleDateString() : '—'}
                    </span>
                  </td>

                  {/* Status */}
                  <td className="px-4 py-3">
                    <StatusBadge video={v} />
                  </td>

                  {/* Actions */}
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1.5 flex-wrap">
                      {/* YouTube link */}
                      <a
                        href={`https://youtube.com/watch?v=${v.video_id}`}
                        target="_blank" rel="noopener noreferrer"
                        className="text-[10px] bg-red-900/30 text-red-400 px-2.5 py-1.5 rounded-lg hover:bg-red-900/50 transition-colors"
                      >
                        ▶ YT
                      </a>

                      {/* Edit film (only if film exists) */}
                      {v.films && (
                        <button
                          onClick={() => setEditFilm(v.films)}
                          className="text-[10px] bg-[#D4A017]/10 text-[#D4A017] px-2.5 py-1.5 rounded-lg hover:bg-[#D4A017]/20 transition-colors"
                        >
                          Edit
                        </button>
                      )}

                      {/* Credits (only if film exists) */}
                      {v.films && (
                        <button
                          onClick={() => setCreditsFilm(v.films)}
                          className="text-[10px] bg-blue-900/30 text-blue-400 px-2.5 py-1.5 rounded-lg hover:bg-blue-900/50 transition-colors"
                        >
                          Credits
                        </button>
                      )}

                      {/* Hide/Show toggle */}
                      <button
                        onClick={() => toggleHidden(v)}
                        disabled={togglingId === v.id}
                        className={`text-[10px] px-2.5 py-1.5 rounded-lg transition-colors ${
                          v.is_hidden
                            ? 'bg-green-900/30 text-green-400 hover:bg-green-900/50'
                            : 'bg-[#252D45] text-[#7A8099] hover:text-[#F5F0E8]'
                        }`}
                      >
                        {togglingId === v.id ? '…' : v.is_hidden ? 'Show' : 'Hide'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modals */}
      {editFilm && (
        <EditFilmModal
          film={editFilm}
          onSave={() => { setEditFilm(null); fetchVideos(); }}
          onClose={() => setEditFilm(null)}
        />
      )}
      {creditsFilm && (
        <CreditsModal film={creditsFilm} onClose={() => setCreditsFilm(null)} />
      )}
    </div>
  );
}
