import { useState, useEffect, useMemo } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { formatViewCount } from '../../utils/youtube';
import { toast } from 'react-hot-toast';
import SyncStatusOverlay from '../../components/admin/SyncStatusOverlay';

export default function AdminChannelDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [channel, setChannel] = useState(null);
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState(null);
  const [syncReport, setSyncReport] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  useEffect(() => {
    fetchData();
  }, [id]);

  async function fetchData() {
    setLoading(true);
    
    const { data: ch, error: chErr } = await supabase
      .from('channels')
      .select('*')
      .eq('id', id)
      .single();
    
    if (chErr) {
      console.error('Error fetching channel:', chErr);
      setLoading(false);
      return;
    }
    setChannel(ch);

    const { data: vids, error: vidsErr } = await supabase
      .from('channel_videos')
      .select(`
        id, video_id, title, thumbnail_url, published_at, 
        duration_seconds, is_hidden, film_id,
        films(id, title, poster_url, release_type, year, synopsis, needs_review)
      `)
      .eq('channel_id', id)
      .order('published_at', { ascending: false });

    if (vidsErr) {
      console.error('Error fetching videos:', vidsErr);
      toast.error(`Database Error: ${vidsErr.message}`);
    }
    setVideos(vids || []);
    setLoading(false);
  }

  const handleSync = async () => {
    setSyncing(true);
    setSyncProgress({ current: 0, total: 1, status: 'Opening Data Link...' });
    try {
      const { data: { session } } = await supabase.auth.getSession();
      setSyncProgress({ current: 0.5, total: 1, status: `Fetching ${channel?.name || 'Signals'}...` });
      
      const res = await fetch(`/api/cron/refresh-videos?channelId=${id}`, {
        headers: {
          'Authorization': `Bearer ${session?.access_token || ''}`
        }
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Sync failed');
      
      setSyncProgress(null);
      setSyncReport([{ name: channel?.name || 'Channel', success: true, count: json.videos_upserted || 0 }]);
      fetchData();
    } catch (err) {
      setSyncProgress(null);
      setSyncReport([{ name: channel?.name || 'Channel', success: false, error: err.message }]);
    } finally {
      setSyncing(false);
    }
  };

  const stats = useMemo(() => {
    const total = videos.length;
    const pending = videos.filter(v => v.films?.needs_review).length;
    const approved = total - pending;
    return { total, pending, approved };
  }, [videos]);

  const handleHide = async (videoId, currentStatus) => {
    try {
      const { error } = await supabase
        .from('channel_videos')
        .update({ is_hidden: !currentStatus })
        .eq('id', videoId);
      if (error) throw error;
      setVideos(videos.map(v => v.id === videoId ? { ...v, is_hidden: !currentStatus } : v));
      toast.success(!currentStatus ? 'Video hidden' : 'Video unhidden');
    } catch (err) {
      toast.error('Failed to update visibility');
    }
  };

  const handleDeleteVideo = async (videoId) => {
    if (!window.confirm('Are you sure you want to delete this video record? This will remove the mapping as well.')) return;
    try {
      const { error } = await supabase.from('channel_videos').delete().eq('id', videoId);
      if (error) throw error;
      setVideos(videos.filter(v => v.id !== videoId));
      toast.success('Record deleted');
    } catch (err) {
      toast.error('Deletion failed');
    }
  };

  const filteredFilms = useMemo(() => {
    return videos.filter(v => {
      const filmTitle = v.films?.title || '';
      const videoTitle = v.title || '';
      const titleMatches = filmTitle.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          videoTitle.toLowerCase().includes(searchQuery.toLowerCase());
      
      const isPending = !v.films || v.films.needs_review;
      const isApproved = v.films && !v.films.needs_review;
      const isHidden = v.is_hidden;

      if (statusFilter === 'hidden') return titleMatches && isHidden;
      if (isHidden) return false;

      if (statusFilter === 'pending') return titleMatches && isPending;
      if (statusFilter === 'approved') return titleMatches && isApproved;
      return titleMatches;
    });
  }, [videos, searchQuery, statusFilter]);

  if (loading) {
    return (
      <div className="min-h-[80vh] flex flex-col items-center justify-center p-8 space-y-4">
        <div className="w-16 h-16 border-4 border-brand/20 border-t-brand rounded-full animate-spin" />
        <p className="text-brand text-[10px] font-black uppercase tracking-[0.3em] animate-pulse">Establishing Node Link</p>
      </div>
    );
  }

  if (!channel) {
    return (
      <div className="p-12 text-center bg-surface border border-red-500/20 rounded-md shadow-2xl m-8">
        <div className="w-20 h-20 bg-red-500/10 rounded-md flex items-center justify-center text-4xl mx-auto mb-6">⚠️</div>
        <h1 className="text-3xl font-black text-red-500 mb-4 tracking-tight uppercase">Access Denied</h1>
        <p className="text-text-muted mb-8 font-medium">The specified channel node either does not exist or has been decommissioned.</p>
        <Link to="/admin/channels" className="px-10 py-4 bg-brand text-white rounded-lg text-[10px] font-black uppercase tracking-widest inline-block transition-all hover:scale-105 shadow-lg shadow-brand/20">Return to Grid</Link>
      </div>
    );
  }

  return (
    <div className="pb-24">
      {/* Navigation Header */}
      <div className="px-8 py-6 flex items-center justify-between border-b border-border bg-surface/50 backdrop-blur-md sticky top-0 z-40">
        <div className="flex items-center gap-6">
          <Link to="/admin/channels" className="w-10 h-10 rounded-md bg-surface-2 border border-border flex items-center justify-center text-text-muted hover:text-brand hover:border-brand/30 transition-all shadow-sm">←</Link>
          <div className="h-10 w-px bg-border" />
          <div className="min-w-0">
            <p className="text-brand text-[10px] font-black uppercase tracking-widest leading-none mb-1.5 opacity-80 italic">Distribution Intelligence</p>
            <h1 className="text-lg font-black text-text-primary tracking-tight truncate max-w-sm">{channel.name}</h1>
          </div>
        </div>
        <div className="flex items-center gap-6">
           <button
             onClick={handleSync}
             disabled={syncing}
             className="group relative px-6 py-3 bg-brand/10 border border-brand/20 text-brand rounded-md text-[10px] font-black uppercase tracking-widest hover:bg-brand hover:text-white transition-all disabled:opacity-50"
           >
             {syncing ? (
               <span className="flex items-center gap-2">
                 <span className="w-3 h-3 border-2 border-brand/20 border-t-white rounded-full animate-spin" />
                 Syncing...
               </span>
             ) : (
               'Sync Signal'
             )}
           </button>
           <div className="hidden lg:block text-right">
              <p className="text-[9px] font-black text-text-muted uppercase tracking-widest mb-1">Network Capacity</p>
              <p className="text-text-primary font-black text-xs italic">{formatViewCount(channel.subscriber_count || 0)} Signals</p>
           </div>
           {channel.thumbnail_url && (
             <img src={channel.thumbnail_url} alt="" className="w-10 h-10 rounded-md border border-border shadow-md" />
           )}
        </div>
      </div>

      <div className="p-8 max-w-[1400px] mx-auto">
        {/* Statistics Strip */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
           {[
             { label: 'Total Mapped Assets', val: stats.total, icon: '📦', color: 'text-text-primary' },
             { label: 'Pending Review',    val: stats.pending, icon: '🛡️', color: 'text-brand' },
             { label: 'Approved & Active', val: stats.approved, icon: '✅', color: 'text-green-500' },
           ].map(s => (
             <div key={s.label} className="card-cal p-6 flex items-center justify-between group hover:border-brand/20 transition-all">
                <div>
                   <p className="text-[10px] font-black text-text-muted uppercase tracking-[0.2em] mb-2">{s.label}</p>
                   <p className={`text-3xl font-black ${s.color}`}>{s.val}</p>
                </div>
                <span className="text-2xl bg-surface-2 w-12 h-12 flex items-center justify-center rounded-lg border border-border group-hover:scale-110 transition-transform">{s.icon}</span>
             </div>
           ))}
        </div>

        {/* Search & Filter Hub */}
        <div className="flex flex-col md:flex-row gap-6 mb-10 items-end">
            <div className="flex-1 w-full">
               <label className="block text-text-muted text-[10px] font-black uppercase tracking-widest mb-3 px-1">Signal Search</label>
               <div className="relative group">
                 <input
                  type="text"
                  placeholder="Filter by production title or original asset name..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full h-14 bg-surface border border-border rounded-lg px-6 pl-14 text-text-primary text-sm focus:border-brand focus:outline-none transition-all placeholder:text-text-muted/30 group-hover:border-border-hover shadow-2xl"
                />
                <span className="absolute left-6 top-1/2 -translate-y-1/2 text-text-muted opacity-50 text-xl">🔍</span>
               </div>
            </div>
            <div className="flex gap-4">
               {['all', 'pending', 'approved', 'hidden'].map(tab => (
                 <button
                  key={tab}
                  onClick={() => setStatusFilter(tab)}
                  className={`px-8 py-4 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all border ${
                    statusFilter === tab
                      ? 'bg-text-primary border-text-primary text-surface shadow-lg'
                      : 'bg-surface border-border text-text-muted hover:border-border-hover hover:text-text-primary'
                  }`}
                >
                  {tab}
                </button>
               ))}
            </div>
        </div>

        {/* Data Grid */}
        <div className="grid grid-cols-1 xl:grid-cols-1 gap-6">
           <div className="card-cal overflow-hidden">
             <table className="w-full text-left">
               <thead>
                 <tr className="border-b border-border text-text-muted text-[10px] font-black uppercase tracking-[0.3em] bg-surface-2/50">
                   <th className="px-10 py-6">Asset Intelligence</th>
                   <th className="px-10 py-6">Production Map</th>
                   <th className="px-10 py-6">Status</th>
                   <th className="px-10 py-6 text-right">Actions</th>
                 </tr>
               </thead>
               <tbody className="divide-y divide-border">
                 {filteredFilms.length === 0 ? (
                   <tr>
                     <td colSpan="4" className="px-10 py-24 text-center">
                        <div className="opacity-20 text-5xl mb-4">🌑</div>
                        <p className="text-text-muted text-xs font-black uppercase tracking-widest">No matching signals in current buffer</p>
                     </td>
                   </tr>
                 ) : filteredFilms.map(vid => (
                    <tr key={vid.id} className="group hover:bg-surface-2/50 transition-all duration-300">
                      <td className="px-10 py-8">
                        <div className="flex items-center gap-6">
                           <img src={vid.thumbnail_url} alt="" className="w-24 h-14 rounded-md object-cover border border-border shadow-md transition-transform group-hover:scale-105" />
                           <div className="min-w-0">
                              <p className="text-text-primary font-black text-sm truncate max-w-sm mb-1">{vid.title}</p>
                              <p className="text-[10px] text-text-muted font-bold uppercase tracking-widest italic">{new Date(vid.published_at).toLocaleDateString()}</p>
                           </div>
                        </div>
                      </td>
                      <td className="px-10 py-8">
                        {vid.films ? (
                          <div className="flex items-center gap-4">
                             <div className="w-8 h-12 bg-surface-3 rounded-md border border-border overflow-hidden">
                                {vid.films.poster_url && <img src={vid.films.poster_url} alt="" className="w-full h-full object-cover" />}
                             </div>
                             <div className="min-w-0">
                                <p className="text-text-primary font-bold text-xs truncate max-w-[200px]">{vid.films.title}</p>
                                <p className="text-[9px] text-text-muted font-bold uppercase tracking-widest">{vid.films.year || 'TBD'}</p>
                             </div>
                          </div>
                        ) : (
                          <span className="text-red-500 text-[10px] font-black uppercase tracking-widest px-3 py-1 bg-red-500/10 rounded-lg">Unmapped</span>
                        )}
                      </td>
                      <td className="px-10 py-8">
                        {vid.films?.needs_review ? (
                          <span className="inline-flex items-center px-4 py-1.5 rounded-full bg-brand/10 border border-brand/20 text-brand text-[9px] font-black uppercase tracking-widest shadow-sm">
                             <span className="w-1 h-1 rounded-full bg-brand animate-pulse mr-2" /> Needs Audit
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-4 py-1.5 rounded-full bg-green-500/10 border border-green-500/20 text-green-500 text-[9px] font-black uppercase tracking-widest shadow-sm">
                             Approved
                          </span>
                        )}
                      </td>
                      <td className="px-10 py-8 text-right">
                         <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Link 
                               to={vid.film_id ? `/admin/films?edit=${vid.film_id}` : `/admin/films?map_video=${vid.id}`} 
                               className="w-10 h-10 rounded-md bg-surface border border-border flex items-center justify-center text-text-muted hover:text-brand hover:border-brand/30 transition-all shadow-md"
                               title={vid.film_id ? "Edit Film" : "Map to Film"}
                            >✏️</Link>
                            <button 
                               onClick={() => handleHide(vid.id, vid.is_hidden)} 
                               className={`w-10 h-10 rounded-md bg-surface border border-border flex items-center justify-center transition-all shadow-md ${vid.is_hidden ? 'text-brand border-brand/30' : 'text-text-muted hover:text-brand hover:border-brand/30'}`}
                               title={vid.is_hidden ? "Unhide Video" : "Hide Video"}
                            >
                              {vid.is_hidden ? '👁️' : '🕶️'}
                            </button>
                            <button 
                               onClick={() => handleDeleteVideo(vid.id)} 
                               className="w-10 h-10 rounded-md bg-surface border border-border flex items-center justify-center text-text-muted hover:text-red-500 hover:border-red-500/30 transition-all shadow-md"
                               title="Delete Record"
                            >🗑️</button>
                            <a 
                               href={`https://youtube.com/watch?v=${vid.video_id}`} 
                               target="_blank" 
                               rel="noopener noreferrer" 
                               className="w-10 h-10 rounded-md bg-surface border border-border flex items-center justify-center text-text-muted hover:text-red-500 hover:border-red-500/30 transition-all shadow-md"
                               title="External Source"
                            >↗</a>
                         </div>
                      </td>
                    </tr>
                 ))}
               </tbody>
             </table>
           </div>
        </div>
      </div>
      {/* Progress & Report Overlay */}
      <SyncStatusOverlay 
        progress={syncProgress} 
        report={syncReport} 
        onClose={() => setSyncReport(null)} 
      />
    </div>
  );
}
