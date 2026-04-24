/**
 * /admin/youtube-videos
 *
 * Shows every channel_video where duration_seconds >= 1800 (30 min).
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import { formatViewCount } from '../../utils/youtube';
import { toast } from 'react-hot-toast';

const FILM_MIN = 60; // 1 min in seconds (includes skits)

function fmtDuration(s) {
  if (!s) return '—';
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function StatusBadge({ video }) {
  // Check if it's a freshly linked film in local state
  const filmData = video.films || (video.film_id && video.temp_film);
  const isPending = video.film_id && (filmData?.needs_review ?? true);
  const isVerified = video.film_id && filmData?.needs_review === false;
  const isUnmatched = !video.film_id;

  return (
    <div className="flex flex-col gap-1.5 items-center">
      <div className="flex items-center gap-2">
        {isUnmatched && (
          <span className="px-2 py-0.5 rounded-lg bg-surface-2 text-text-muted border border-border text-[9px] font-bold flex items-center gap-1.5">
            <span className="w-1 h-1 rounded-full bg-slate-500" />
            Needs Link
          </span>
        )}
        {isPending && (
          <span className="px-2 py-0.5 rounded-lg bg-brand/10 text-brand border border-brand/20 text-[9px] font-bold tracking-wider flex items-center gap-1.5">
            <span className="w-1 h-1 rounded-full bg-brand animate-pulse" />
            Pending
          </span>
        )}
        {isVerified && (
          <span className="px-2 py-0.5 rounded-lg bg-green-500/10 text-green-500 border border-green-500/20 text-[9px] font-bold tracking-wider flex items-center gap-1.5">
            <span className="w-1 h-1 rounded-full bg-green-500" />
            Verified
          </span>
        )}
      </div>
      {video.is_hidden && (
         <span className="px-2 py-0.5 rounded-lg bg-red-500/10 text-red-500 border border-red-500/20 text-[9px] font-bold">
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

  // Company selection state
  const [companySearch, setCompanySearch] = useState('');
  const [companyResults, setCompanyResults] = useState([]);
  const [selectedCompany, setSelectedCompany] = useState(null);
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    // Fetch current company
    supabase
      .from('film_companies')
      .select('companies(*)')
      .eq('film_id', film.id)
      .limit(1)
      .then(({ data }) => {
        if (data && data.length > 0) {
          setSelectedCompany(data[0].companies);
          setCompanySearch(data[0].companies.name);
        }
      });
  }, [film.id]);

  const handleCompanySearch = async (query) => {
    setCompanySearch(query);
    if (!query) {
      setCompanyResults([]);
      return;
    }
    setIsSearching(true);
    const { data } = await supabase
      .from('companies')
      .select('*')
      .ilike('name', `%${query}%`)
      .limit(5);
    setCompanyResults(data || []);
    setIsSearching(false);
  };

  const createCompany = async (name) => {
    const { data, error } = await supabase
      .from('companies')
      .insert([{ name, description: '.', website: '.', logo_url: null }])
      .select()
      .single();
    if (!error) {
      setSelectedCompany(data);
      setCompanySearch(data.name);
      setCompanyResults([]);
      toast.success(`Created company: ${name}`);
    }
  };

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

    // Save Company Relationship
    try {
      await supabase.from('film_companies').delete().eq('film_id', film.id);
      if (selectedCompany) {
        await supabase.from('film_companies').insert([{ film_id: film.id, company_id: selectedCompany.id }]);
      }
    } catch (e) {
      console.error('Error saving company link:', e);
    }

    toast.success('Metadata updated');
    onSave();
  };

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-xl z-[100] flex items-center justify-center p-4 animate-in fade-in duration-300">
      <div className="bg-surface border border-border rounded-md w-full max-w-xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-400">
        <div className="border-b border-border px-10 py-8 flex items-center justify-between bg-surface-2/30">
          <div>
            <p className="text-brand text-[10px] font-bold tracking-wider mb-1">Movie Details</p>
            <h2 className="text-text-primary text-2xl font-bold tracking-tight">Edit Information</h2>
          </div>
          <button onClick={onClose} className="w-12 h-12 flex items-center justify-center rounded-lg hover:bg-surface-2 text-text-muted transition-all">✕</button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-10 space-y-8 overflow-y-auto max-h-[60vh] custom-scrollbar">
          <div>
            <label className="block text-text-muted text-[10px] font-bold tracking-wider mb-3 px-1">Movie Title</label>
            <input name="title" value={form.title} onChange={handleChange} className="w-full bg-surface-2 border border-border rounded-lg px-5 h-14 text-text-primary text-sm font-bold focus:border-brand/50 focus:ring-4 focus:ring-brand/5 transition-all outline-none" />
          </div>

          <div className="grid grid-cols-2 gap-8">
            <div>
              <label className="block text-text-muted text-[10px] font-bold mb-3 px-1">Release Year</label>
              <input name="year" type="number" value={form.year} onChange={handleChange} className="w-full bg-surface-2 border border-border rounded-lg px-5 h-14 text-text-primary text-sm font-bold focus:border-brand/50 focus:ring-4 focus:ring-brand/5 transition-all outline-none" />
            </div>
            <div>
              <label className="block text-text-muted text-[10px] font-bold mb-3 px-1">Category</label>
              <div className="relative">
                <select name="release_type" value={form.release_type} onChange={handleChange} className="w-full bg-surface-2 border border-border rounded-lg px-5 h-14 text-text-primary text-[11px] font-bold focus:border-brand/50 outline-none appearance-none cursor-pointer">
                  {['youtube','cinema','netflix','amazon','showmax','iroko','kava'].map(v => <option key={v} value={v}>{v}</option>)}
                </select>
                <span className="absolute right-5 top-1/2 -translate-y-1/2 pointer-events-none text-text-muted">↓</span>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-text-muted text-[10px] font-bold tracking-wider mb-3 px-1">Movie Synopsis</label>
            <textarea name="synopsis" value={form.synopsis} onChange={handleChange} rows={5} className="w-full bg-surface-2 border border-border rounded-lg px-5 py-4 text-text-primary text-sm font-medium focus:border-brand/50 outline-none resize-none custom-scrollbar" />
          </div>

          <label className="flex items-center gap-5 cursor-pointer select-none bg-surface-2/50 p-6 rounded-lg border border-border hover:border-brand/20 transition-all transition-colors group">
            <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${form.needs_review ? 'bg-brand border-brand shadow-lg shadow-brand/20' : 'border-border group-hover:border-text-muted'}`}>
              <input type="checkbox" name="needs_review" checked={form.needs_review} onChange={handleChange} className="hidden" />
              {form.needs_review && <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" d="M5 13l4 4L19 7" /></svg>}
            </div>
            <div>
                <span className="text-text-primary text-sm font-bold tracking-wider">Mark as Verified</span>
                <p className="text-text-muted text-[10px] mt-1 font-bold">Uncheck to mark as production-ready.</p>
            </div>
          </label>

          <div className="pt-4 border-t border-border">
            <label className="block text-text-muted text-[10px] font-bold tracking-wider mb-3 px-1 uppercase">Production Company</label>
            <div className="relative group">
              <input 
                type="text" 
                value={companySearch} 
                onChange={(e) => handleCompanySearch(e.target.value)} 
                placeholder="Search or add company..."
                className="w-full bg-surface-2 border border-border rounded-lg px-5 h-14 text-text-primary text-sm font-bold focus:border-brand/50 outline-none pr-12" 
              />
              <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-2">
                {isSearching ? (
                  <div className="w-4 h-4 border-2 border-brand/20 border-t-brand rounded-full animate-spin" />
                ) : companySearch && !selectedCompany && (
                  <button
                    type="button"
                    onClick={() => createCompany(companySearch)}
                    className="p-1 hover:bg-brand/10 rounded-full text-brand transition-all"
                    title="Create and link this company"
                  >
                    <Icon icon="solar:add-circle-bold" className="w-5 h-5" />
                  </button>
                )}
                {selectedCompany && companySearch === selectedCompany.name && (
                  <Icon icon="solar:check-circle-bold" className="w-4 h-4 text-green-500" />
                )}
              </div>

              {companyResults.length > 0 && (
                <div className="absolute left-0 top-full mt-2 w-full bg-surface border border-border rounded-md shadow-2xl z-50 overflow-hidden ring-1 ring-black/5">
                  {companyResults.map(c => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => {
                        setSelectedCompany(c);
                        setCompanySearch(c.name);
                        setCompanyResults([]);
                      }}
                      className="w-full flex items-center gap-3 p-3 hover:bg-surface-2 transition-colors text-left border-b border-border/50 last:border-0"
                    >
                      <div className="w-8 h-8 rounded-lg bg-surface-2 overflow-hidden border border-border flex items-center justify-center">
                        {c.logo_url ? (
                          <img src={c.logo_url} alt="" className="w-full h-full object-contain p-1" />
                        ) : (
                          <span className="text-[10px] font-bold text-brand">{c.name.charAt(0)}</span>
                        )}
                      </div>
                      <div>
                        <p className="text-[11px] font-bold text-text-primary">{c.name}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <p className="text-[9px] text-text-muted mt-2 px-1">Linking a production company helps organize the library.</p>
          </div>
        </form>

        <div className="px-10 py-8 border-t border-border bg-surface-2/30 flex gap-4">
          <button type="button" onClick={onClose} className="flex-1 h-14 rounded-lg border border-border text-text-muted font-bold text-[10px] tracking-wider hover:bg-surface-2 transition-all">Cancel</button>
          <button onClick={handleSubmit} disabled={saving} className="flex-[2] h-14 rounded-lg bg-brand text-white font-bold text-[10px] tracking-wider hover:scale-[1.02] active:scale-95 transition-all shadow-xl shadow-brand/20 disabled:opacity-50">
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Credits Modal (Simplified) ────────────────────────────────────────────────
function CreditsModal({ film, onClose }) {
  const [credits, setCredits] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from('film_credits')
      .select('id, character_name, people(id, name, profile_path)')
      .eq('film_id', film.id)
      .then(({ data }) => { setCredits(data || []); setLoading(false); });
  }, [film.id]);

  const removeCredit = async (id) => {
    const { error } = await supabase.from('film_credits').delete().eq('id', id);
    if (!error) setCredits(prev => prev.filter(c => c.id !== id));
  };

  return (
    <div className="fixed inset-0 bg-background/90 backdrop-blur-md z-[100] flex items-center justify-center p-4">
      <div className="bg-surface border border-border rounded-xl w-full max-w-2xl shadow-2xl flex flex-col max-h-[85vh]">
        <div className="p-8 border-b border-border flex items-center justify-between">
           <div>
             <p className="text-brand text-xs font-bold mb-1">Credits Manager</p>
             <h2 className="text-text-primary text-xl font-bold">{film.title}</h2>
           </div>
           <button onClick={onClose} className="text-text-muted hover:text-text-primary transition-colors text-2xl font-light">✕</button>
        </div>
        
        <div className="p-8 overflow-y-auto custom-scrollbar flex-1">
          {loading ? (
             <div className="h-40 flex items-center justify-center text-text-muted text-xs font-bold">Loading credits...</div>
          ) : (
            <div className="grid grid-cols-1 gap-3">
              {credits.map(c => (
                <div key={c.id} className="group flex items-center justify-between p-4 bg-surface-2 border border-border rounded-lg hover:border-brand/20 transition-all">
                  <div className="flex items-center gap-4">
                    <img src={c.people?.profile_path || 'https://via.placeholder.com/100x150'} className="w-10 h-10 rounded-full object-cover grayscale group-hover:grayscale-0 transition-all" alt="" />
                    <div>
                      <p className="text-text-primary text-sm font-bold tracking-tight">{c.people?.name}</p>
                      <p className="text-text-muted text-xs font-medium">
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
  const [selectedIds,   setSelectedIds]   = useState(new Set());
  const [isBulkAction,  setIsBulkAction]  = useState(false);
  
  // Pagination State
  const [page, setPage] = useState(0);
  const [pageSize] = useState(100);
  const [totalCount, setTotalCount] = useState(0);
  const [globalStats, setGlobalStats] = useState({ total: 0, pending: 0, verified: 0, unmatched: 0, hidden: 0 });

  const fetchGlobalStats = useCallback(async () => {
    // We can run these in parallel for speed
    const [totalRes, pendingRes, verifiedRes, unmatchedRes, hiddenRes] = await Promise.all([
      supabase.from('channel_videos').select('id', { count: 'exact', head: true }).gte('duration_seconds', FILM_MIN),
      supabase.from('channel_videos').select('id', { count: 'exact', head: true }).not('film_id', 'is', null).filter('films.needs_review', 'eq', true).gte('duration_seconds', FILM_MIN),
      supabase.from('channel_videos').select('id', { count: 'exact', head: true }).not('film_id', 'is', null).filter('films.needs_review', 'eq', false).gte('duration_seconds', FILM_MIN),
      supabase.from('channel_videos').select('id', { count: 'exact', head: true }).is('film_id', null).gte('duration_seconds', FILM_MIN),
      supabase.from('channel_videos').select('id', { count: 'exact', head: true }).eq('is_hidden', true).gte('duration_seconds', FILM_MIN)
    ]);

    setGlobalStats({
      total: totalRes.count || 0,
      pending: pendingRes.count || 0,
      verified: verifiedRes.count || 0,
      unmatched: unmatchedRes.count || 0,
      hidden: hiddenRes.count || 0
    });
    setTotalCount(totalRes.count || 0);
  }, []);

  const fetchVideos = useCallback(async () => {
    setLoading(true);
    const from = page * pageSize;
    const to = from + pageSize - 1;

    let query = supabase
      .from('channel_videos')
      .select(`
        id, video_id, title, thumbnail_url, published_at,
        duration_seconds, is_hidden, film_id, match_status,
        channels(id, name),
        films(id, title, needs_review, release_type, year, synopsis)
      `, { count: 'exact' })
      .gte('duration_seconds', FILM_MIN)
      .order('published_at', { ascending: false });

    if (channelFilter !== 'all') query = query.eq('channel_id', channelFilter);
    if (searchQuery.trim()) query = query.ilike('title', `%${searchQuery}%`);
    
    // Apply Status Filter at Database Level
    if (statusFilter === 'needs_review') query = query.not('film_id', 'is', null).filter('films.needs_review', 'eq', true);
    if (statusFilter === 'matched')      query = query.not('film_id', 'is', null).filter('films.needs_review', 'eq', false);
    if (statusFilter === 'unmatched')    query = query.is('film_id', null);
    if (statusFilter === 'hidden')       query = query.eq('is_hidden', true);

    const { data, error, count } = await query.range(from, to);
    
    if (error) console.error('Fetch Error:', error);
    setVideos(data || []);
    setTotalCount(count || 0);
    setLoading(false);
  }, [channelFilter, searchQuery, statusFilter, page, pageSize]);

  useEffect(() => { 
    fetchVideos(); 
    fetchGlobalStats();
    setSelectedIds(new Set()); 
  }, [fetchVideos, fetchGlobalStats]);
  
  // Reset to page 0 when filters change
  useEffect(() => { setPage(0); }, [channelFilter, searchQuery, statusFilter]);

  const toggleSelect = id => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = (visibleVideos) => {
    if (selectedIds.size === visibleVideos.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(visibleVideos.map(v => v.id)));
  };

  const handleBulkAction = async (action) => {
    try {
      setIsBulkAction(true);
      const ids = Array.from(selectedIds);
      const actionVideos = videos.filter(v => ids.includes(v.id));
      const results = {};

      if (action === 'create_films') {
        toast.loading(`Processing ${ids.length} films on server...`, { id: 'bulk' });
        
        const { data: rpcData, error: rpcErr } = await supabase.rpc('batch_create_films_from_videos', {
          video_db_ids: ids
        });

        if (rpcErr) {
          console.error('Batch RPC Error:', rpcErr);
          toast.error(`Critical Error: ${rpcErr.message}`, { id: 'bulk' });
        } else {
          const processed = rpcData || [];
          
          // Use real Film IDs from the database immediately
          processed.forEach(item => {
             results[item.video_id] = { film_id: item.new_film_id, match_status: 'manual' };
          });

          if (processed.length < ids.length) {
            toast.error(`${ids.length - processed.length} items failed or were duplicates.`, { id: 'bulk', duration: 4000 });
          } else {
            toast.success(`Successfully processed ${processed.length} items!`, { id: 'bulk' });
          }
        }
      } else if (action === 'certify') {
        const filmIds = actionVideos.map(v => v.film_id).filter(id => id && typeof id === 'string' && id.length > 30);
        
        if (filmIds.length > 0) {
          toast.loading(`Certifying ${filmIds.length} films...`, { id: 'bulk' });
          const { data: count, error: certifyErr } = await supabase.rpc('batch_certify_films', {
            film_uuids: filmIds
          });

          if (certifyErr) {
            console.error('Batch Certify Error:', certifyErr);
            toast.error(`Certify failed: ${certifyErr.message}`, { id: 'bulk' });
          } else {
             actionVideos.forEach(v => {
               if (v.film_id) results[v.id] = { films: { ...v.films, needs_review: false } };
             });
             toast.success(`Verified ${count || filmIds.length} films!`, { id: 'bulk' });
          }
        } else {
           toast.error("Please select 'Matched' items to verify.", { id: 'bulk' });
        }
      } else if (action === 'hide') {
        const { error } = await supabase.from('channel_videos').update({ is_hidden: true }).in('id', ids);
        if (error) {
           toast.error(`Hide failed: ${error.message}`, { id: 'bulk' });
        } else {
          ids.forEach(id => { results[id] = { is_hidden: true }; });
          toast.success(`Hidden ${ids.length} videos`, { id: 'bulk' });
        }
      }

      // Apply changes to local state immediately
      setVideos(prev => prev.map(v => results[v.id] ? { ...v, ...results[v.id] } : v));
      setSelectedIds(new Set());
    } catch (e) {
      console.error('Bulk Action Exception:', e);
      toast.error(`Unexpected Error: ${e.message}`, { id: 'bulk' });
    } finally {
      setIsBulkAction(false);
      // Background refresh to get full metadata
      setTimeout(() => fetchVideos(), 5000);
    }
  };

  useEffect(() => {
    supabase.from('channels').select('id, name').order('name').then(({ data }) => setChannels(data || []));
  }, []);

  const createFilmFromVideo = async (video) => {
    // 1. Create the film
    const { data: newFilm, error: fErr } = await supabase
      .from('films')
      .insert({
        title: video.title,
        release_type: 'youtube',
        needs_review: true,
        synopsis: 'Imported from YouTube. Please update description.'
      })
      .select()
      .single();

    if (fErr) { toast.error(`Film creation failed: ${fErr.message}`); return; }

    // 2. Link the video to the new film
    const { error: vErr } = await supabase
      .from('channel_videos')
      .update({ film_id: newFilm.id })
      .eq('id', video.id);

    if (vErr) {
      toast.error(`Linking failed: ${vErr.message}`);
    } else {
      // 3. Attempt to link Production Company (Producer Name)
      if (video.channels?.name) {
        try {
          const channelName = video.channels.name;
          // Check if company exists
          let { data: existingCo } = await supabase
            .from('companies')
            .select('id')
            .ilike('name', channelName)
            .single();
          
          let companyId = existingCo?.id;

          if (!companyId) {
            // Create company
            const { data: newCo, error: coErr } = await supabase
              .from('companies')
              .insert([{ name: channelName, description: '.', website: '.', logo_url: null }])
              .select()
              .single();
            if (!coErr) companyId = newCo.id;
          }

          if (companyId) {
            await supabase
              .from('film_companies')
              .insert([{ film_id: newFilm.id, company_id: companyId }]);
          }
        } catch (e) {
          console.error('Auto-company link failed:', e);
        }
      }

      toast.success(`'${video.title}' is now a Film record!`);
      fetchVideos();
    }
  };

  const certifyFilm = async (filmId) => {
    const { error } = await supabase.from('films').update({ needs_review: false }).eq('id', filmId);
    if (error) toast.error('Certification failed');
    else { toast.success('Film is now LIVE!'); fetchVideos(); }
  };

  const toggleHidden = async (video) => {
    setTogglingId(video.id);
    const { error } = await supabase.from('channel_videos').update({ is_hidden: !video.is_hidden }).eq('id', video.id);
    if (error) toast.error('Visibility toggle failed');
    else {
      setVideos(vs => vs.map(v => v.id === video.id ? { ...v, is_hidden: !v.is_hidden } : v));
      toast.success(video.is_hidden ? 'Video is now visible' : 'Video has been hidden');
    }
    setTogglingId(null);
  };

  const handleManualSync = async () => {
    setSyncing(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const cronSecret = (import.meta.env && import.meta.env.VITE_CRON_SECRET) || '';
      
      const headers = { 
        'Authorization': `Bearer ${session?.access_token || ''}`,
        'Content-Type': 'application/json' 
      };
      if (cronSecret) headers['x-cron-secret'] = cronSecret;

      const res = await fetch('/api/cron/refresh-videos', { method: 'POST', headers });
      
      // Safety check: if response isn't JSON (like a 404 error page), catch it
      const contentType = res.headers.get("content-type");
      if (contentType && contentType.indexOf("application/json") !== -1) {
        const json = await res.json();
        if (!res.ok) toast.error(`Sync Error: ${json.error || 'Server error'}`);
        else {
          toast.success(`Processed ${json.channels_processed || 0} channels.`);
          fetchVideos();
        }
      } else {
        const text = await res.text();
        if (text.includes('<!DOCTYPE') || res.status === 404) {
          toast.error("Local sync unavailable. Use Production dashboard or 'vercel dev' to run scripts.");
        } else {
          toast.error(`Server Error: ${res.status}`);
        }
      }
    } catch (e) { 
      toast.error(`Connection Error: Check if server is running.`);
      console.error(e);
    }
    setSyncing(false);
  };

  const stats = useMemo(() => ({
    total: globalStats.total,
    pending: globalStats.pending,
    verified: globalStats.verified,
    unmatched: globalStats.unmatched,
    hidden: globalStats.hidden,
  }), [globalStats]);

  const filtered = videos; // Already filtered by DB

  return (
    <div className="space-y-10 animate-in fade-in duration-500 pb-32">
      {/* Bulk Action Bar */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[110] bg-surface-2 border border-brand/20 rounded-2xl shadow-2xl px-8 py-4 flex items-center gap-8 animate-in slide-in-from-bottom-10">
          <div className="border-r border-border pr-8">
             <p className="text-xs font-bold text-brand leading-none mb-1">Batch Actions</p>
             <p className="text-sm font-bold text-text-primary whitespace-nowrap">{selectedIds.size} items selected</p>
          </div>
          
          <div className="flex items-center gap-3">
             <button 
               disabled={isBulkAction} 
               onClick={() => handleBulkAction('create_films')} 
               className="h-10 px-6 rounded-lg bg-brand text-white text-[10px] font-bold tracking-wider hover:scale-105 transition-all shadow-lg shadow-brand/20 disabled:opacity-50 disabled:cursor-wait"
             >
               {isBulkAction ? 'Processing...' : 'Create Movies'}
             </button>
             <button 
               disabled={isBulkAction} 
               onClick={() => handleBulkAction('certify')} 
               className="h-10 px-6 rounded-lg bg-green-500 text-white text-[10px] font-bold tracking-wider hover:scale-105 transition-all shadow-lg shadow-green-500/20 disabled:opacity-50 disabled:cursor-wait"
             >
               {isBulkAction ? 'Processing...' : 'Bulk Verify'}
             </button>
             <button 
               disabled={isBulkAction} 
               onClick={() => handleBulkAction('hide')} 
               className="h-10 px-6 rounded-lg bg-surface border border-border text-text-muted text-xs font-bold hover:bg-red-500/10 hover:text-red-500 transition-all disabled:opacity-50 disabled:cursor-wait"
             >
               Bulk Hide
             </button>
          </div>

          <button onClick={() => setSelectedIds(new Set())} className="text-xs font-bold text-text-muted hover:text-text-primary ml-4">Cancel</button>
        </div>
      )}

      {/* Header */}
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-8">
        <div>
          <p className="text-brand text-xs font-bold mb-1">Queue Management</p>
          <h1 className="text-3xl font-bold text-text-primary tracking-tight">Imported Videos</h1>
          <p className="text-text-muted text-sm mt-1 max-w-xl font-medium leading-relaxed opacity-80">
            Review and link videos imported from external sources to database records.
          </p>
        </div>
        <button 
          onClick={handleManualSync} 
          disabled={syncing} 
          className="bg-brand text-white font-bold px-10 py-3.5 rounded-lg text-sm hover:scale-[1.02] active:scale-[0.98] transition-all shadow-xl shadow-brand/20 flex items-center gap-3"
        >
          {syncing ? (
            <div className="w-4 h-4 border-3 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <Icon icon="solar:refresh-linear" className="text-lg" />
          )}
          {syncing ? 'Scanning...' : 'Sync videos'}
        </button>
      </header>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-6">
        {[
          { label: 'Total items', val: stats.total,      icon: 'solar:videocamera-record-linear', color: 'text-text-primary' },
          { label: 'Pending review',   val: stats.pending,    icon: 'solar:clock-circle-linear', color: 'text-brand' },
          { label: 'Verified movies', val: stats.verified,   icon: 'solar:check-read-linear', color: 'text-green-500' },
          { label: 'Unlinked', val: stats.unmatched,  icon: 'solar:link-broken-linear', color: 'text-text-muted' },
          { label: 'Hidden',    val: stats.hidden,     icon: 'solar:eye-closed-linear', color: 'text-red-500' },
        ].map(s => (
          <div key={s.label} className="card-cal p-6 group hover:border-brand/20 transition-all">
            <div className="flex items-center gap-3 mb-4 opacity-60">
              <Icon icon={s.icon} className="text-xl" />
              <p className="text-[10px] font-bold text-text-muted tracking-wider leading-none">{s.label}</p>
            </div>
            <p className={`text-3xl font-bold tracking-tighter ${s.color}`}>{s.val}</p>
          </div>
        ))}
      </div>

      {/* Modernized Filter Bar */}
      <div className="card-cal p-2 overflow-hidden flex flex-col md:flex-row items-center divide-y md:divide-y-0 md:divide-x divide-border">
        <div className="flex-[1.5] relative w-full">
          <Icon icon="solar:magnifer-linear" className="absolute left-6 top-1/2 -translate-y-1/2 text-text-muted" />
          <input 
            type="text" 
            value={searchQuery} 
            onChange={e => setSearchQuery(e.target.value)} 
            placeholder="Search imported videos..." 
            className="w-full bg-transparent border-none py-5 pl-14 pr-6 text-text-primary text-sm font-bold focus:ring-0 placeholder:text-text-muted/50" 
          />
        </div>
        
        <div className="w-full md:w-72 relative bg-surface-2/30">
          <select value={channelFilter} onChange={e => setChannelFilter(e.target.value)} className="w-full bg-transparent border-none py-5 px-8 text-text-primary text-sm font-bold focus:ring-0 cursor-pointer appearance-none">
            <option value="all">All sources</option>
            {channels.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <Icon icon="solar:alt-arrow-down-linear" className="absolute right-6 top-1/2 -translate-y-1/2 pointer-events-none text-text-muted" />
        </div>

        <div className="w-full md:w-72 relative bg-surface-2/50">
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="w-full bg-transparent border-none py-5 px-8 text-text-primary text-sm font-bold focus:ring-0 cursor-pointer appearance-none">
            <option value="all">All statuses</option>
            <option value="needs_review">Pending review</option>
            <option value="matched">Verified movies</option>
            <option value="unmatched">Unlinked</option>
            <option value="hidden">Hidden</option>
          </select>
          <Icon icon="solar:alt-arrow-down-linear" className="absolute right-6 top-1/2 -translate-y-1/2 pointer-events-none text-text-muted" />
        </div>
      </div>

      {/* Main Table */}
      <div className="card-cal overflow-hidden">
        <div className="overflow-x-auto custom-scrollbar">
          {loading ? (
            <div className="h-96 flex flex-col items-center justify-center gap-4">
              <div className="w-12 h-12 border-4 border-brand/20 border-t-brand rounded-full animate-spin" />
              <p className="text-xs font-bold text-text-muted">Loading records...</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="h-96 flex flex-col items-center justify-center text-center p-10">
              <Icon icon="solar:video-library-linear" className="text-5xl text-text-muted mb-4 opacity-20" />
              <h3 className="text-xl font-bold text-text-primary tracking-tight">No results found</h3>
              <p className="text-text-muted text-sm mt-1 max-w-xs font-medium">Try adjusting your filters or search terms.</p>
              <button onClick={() => { setSearchQuery(''); setChannelFilter('all'); setStatusFilter('all'); }} className="mt-6 text-brand font-bold text-xs hover:underline">Clear all filters</button>
            </div>
          ) : (
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-surface-2/30 border-b border-border text-xs font-bold text-text-muted">
                  <th className="px-6 py-5 text-center w-12">
                     <input 
                       type="checkbox" 
                       className="w-4 h-4 rounded border-border bg-surface-3 text-brand focus:ring-brand accent-brand"
                       checked={selectedIds.size > 0 && selectedIds.size === filtered.length}
                       onChange={() => toggleSelectAll(filtered)}
                     />
                  </th>
                  <th className="px-10 py-5 text-left">Record details</th>
                  <th className="px-6 py-5 text-center">Status</th>
                  <th className="px-6 py-5 text-center w-32">Duration</th>
                  <th className="px-10 py-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {filtered.map(v => (
                  <tr key={v.id} className={`hover:bg-surface-2/40 transition-all group ${selectedIds.has(v.id) ? 'bg-brand/5' : ''}`}>
                    <td className="px-6 py-6 text-center">
                       <input 
                         type="checkbox" 
                         className="w-4 h-4 rounded border-border bg-surface-3 text-brand focus:ring-brand accent-brand"
                         checked={selectedIds.has(v.id)}
                         onChange={() => toggleSelect(v.id)}
                       />
                    </td>
                    <td className="px-10 py-6">
                      <div className="flex items-center gap-6">
                        <div className="relative flex-shrink-0">
                          <img src={v.thumbnail_url} alt="" className="w-28 h-16 rounded-md object-cover shadow-xl border border-border transition-transform group-hover:scale-105" />
                          <div className="absolute inset-0 rounded-md ring-1 ring-inset ring-black/5" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-text-primary text-sm font-bold truncate leading-tight group-hover:text-brand transition-colors tracking-tight">{v.film_id ? v.films?.title : v.title}</p>
                          <div className="flex items-center gap-2 mt-1.5 font-bold tracking-wide">
                            <span className="text-[10px] text-text-muted">{v.channels?.name || 'YouTube'}</span>
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
                      <span className="text-xs font-bold text-text-muted font-mono tracking-tighter">{fmtDuration(v.duration_seconds)}</span>
                    </td>
                    <td className="px-10 py-6 text-right">
                      <div className="flex items-center justify-end gap-3">
                        {v.film_id ? (
                          <>
                            {v.films?.needs_review && (
                               <button onClick={() => certifyFilm(v.film_id)} className="h-10 px-5 rounded-md bg-green-500 text-white text-[10px] font-bold hover:bg-green-600 transition-all shadow-lg shadow-green-500/20">Verify now</button>
                            )}
                            <button onClick={() => setEditFilm(v.films)} className="h-10 px-5 rounded-md border border-border bg-surface-2 text-text-primary text-[10px] font-bold hover:border-brand/30 hover:text-brand transition-all">Info</button>
                            <button onClick={() => setCreditsFilm(v.films)} className="h-10 px-5 rounded-md border border-border bg-surface-2 text-text-primary text-[10px] font-bold hover:border-brand/30 hover:text-brand transition-all">Credits</button>
                          </>
                        ) : (
                          <div className="flex items-center gap-2">
                             <button 
                               onClick={() => createFilmFromVideo(v)} 
                               className="h-10 px-5 rounded-md bg-brand text-white text-[10px] font-bold hover:scale-105 transition-all shadow-lg shadow-brand/20"
                             >
                               Create record
                             </button>
                             <div className="text-[10px] font-bold text-text-muted/30 mr-4 tracking-wider font-mono">ID: {v.video_id}</div>
                          </div>
                        )}
                        <button onClick={() => toggleHidden(v)} disabled={togglingId === v.id} className={`h-10 w-10 flex items-center justify-center rounded-md border border-border transition-all ${v.is_hidden ? 'bg-red-500/10 text-red-500 border-red-500/20' : 'bg-surface-2 hover:border-text-muted text-text-muted'}`}>
                          {togglingId === v.id ? (
                             <div className="w-3.5 h-3.5 border-2 border-text-muted/30 border-t-text-muted rounded-full animate-spin" />
                          ) : (
                            <Icon icon={v.is_hidden ? 'solar:eye-linear' : 'solar:eye-closed-linear'} className="text-lg" />
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

      {/* Pagination Controls */}
      <div className="flex items-center justify-between pt-10 border-t border-border/50">
        <div className="space-y-1">
          <p className="text-xs font-bold text-text-muted">
            Showing {page * pageSize + 1} - {Math.min((page + 1) * pageSize, totalCount)} of {totalCount} records
          </p>
        </div>
        <div className="flex items-center gap-4">
          <button 
            disabled={page === 0 || loading}
            onClick={() => setPage(p => p - 1)}
            className="h-12 px-8 rounded-xl border border-border bg-surface-2 text-text-primary text-[10px] font-bold hover:border-brand/30 transition-all disabled:opacity-30"
          >
            Previous
          </button>
          <button 
            disabled={(page + 1) * pageSize >= totalCount || loading}
            onClick={() => setPage(p => p + 1)}
            className="h-12 px-8 rounded-xl bg-brand text-white text-[10px] font-bold hover:scale-105 transition-all shadow-lg shadow-brand/20 disabled:opacity-30"
          >
            Next
          </button>
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
