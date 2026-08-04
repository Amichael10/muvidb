import { useState, useEffect, useCallback } from 'react';
import { Icon } from '@iconify/react';
import { supabase } from '../../lib/supabase';
import { toast } from 'react-hot-toast';

const ADAPTER_LABELS = {
  reach_cinema: 'Reach Cinema (Viva/Ozone/KADA)',
  veezi:        'Veezi (Silverbird)',
  cinesync:     'Cinesync (Filmhouse) ⚠️',
  bluepictures: 'Blue Pictures',
  firecrawl:    'Firecrawl (Genesis/fallback)',
  manual:       'Manual Override',
};

function fmtWhen(iso) {
  if (!iso) return 'never';
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function HealthDot({ cinema }) {
  const { scrape_enabled, showtimes_last_fetched_at, scrape_failure_count, scrape_last_error } = cinema;
  
  if (!scrape_enabled) {
    return (
      <div className="relative group/health inline-block">
        <span className="flex w-2.5 h-2.5 rounded-full bg-surface-3 transition-transform group-hover/health:scale-125" title="Scraping Disabled" />
        <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 px-2 py-1 bg-surface border border-border rounded text-[9px] font-black text-text-muted uppercase tracking-widest opacity-0 group-hover/health:opacity-100 transition-all pointer-events-none whitespace-nowrap z-50">
          Disabled
        </div>
      </div>
    );
  }
  
  if ((scrape_failure_count ?? 0) >= 5) {
    return (
      <div className="relative group/health inline-block">
        <span className="flex w-2.5 h-2.5 rounded-full bg-red-500 shadow-[0_0_12px_rgba(239,68,68,0.4)] animate-pulse" title="Quarantined" />
        <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 px-2 py-1 bg-red-500 text-white rounded text-[9px] font-black uppercase tracking-widest opacity-0 group-hover/health:opacity-100 transition-all pointer-events-none whitespace-nowrap z-50">
          Quarantined
        </div>
      </div>
    );
  }
  
  if (scrape_last_error) {
    return (
      <div className="relative group/health inline-block">
        <span className="flex w-2.5 h-2.5 rounded-full bg-brand shadow-[0_0_12px_rgba(255,92,0,0.4)]" title="Error Reported" />
        <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 px-2 py-1 bg-brand text-white rounded text-[9px] font-black uppercase tracking-widest opacity-0 group-hover/health:opacity-100 transition-all pointer-events-none whitespace-nowrap z-50">
          Error
        </div>
      </div>
    );
  }
  
  const stale = showtimes_last_fetched_at && (Date.now() - new Date(showtimes_last_fetched_at).getTime() > 48 * 3600 * 1000);
  
  return (
    <div className="relative group/health inline-block">
      <span className={`flex w-2.5 h-2.5 rounded-full ${stale ? 'bg-orange-300 shadow-[0_0_12px_rgba(251,146,60,0.4)]' : 'bg-green-500 shadow-[0_0_12px_rgba(34,197,94,0.4)]'}`} title={stale ? 'Stale Data' : 'Healthy'} />
      <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 px-2 py-1 bg-surface border border-border rounded text-[9px] font-black uppercase tracking-widest opacity-0 group-hover/health:opacity-100 transition-all pointer-events-none whitespace-nowrap z-50">
        <span className={stale ? 'text-orange-500' : 'text-green-500'}>{stale ? 'Latency High' : 'Synchronized'}</span>
      </div>
    </div>
  );
}

export default function AdminCinemaScraping() {
  const [cinemas, setCinemas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState(null);
  const [filter, setFilter] = useState('enabled'); 
  const [search, setSearch] = useState('');

  const fetchCinemas = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('cinemas')
      .select('id, name, chain, city, scrape_enabled, scrape_adapter, scrape_config, showtimes_last_fetched_at, scrape_failure_count, scrape_last_error')
      .order('chain', { ascending: true, nullsFirst: false })
      .order('name');
    setCinemas(data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchCinemas();
  }, [fetchCinemas]);

  const toggleEnabled = async (id, current) => {
    const { error } = await supabase.from('cinemas').update({ scrape_enabled: !current }).eq('id', id);
    if (!error) {
       setCinemas(prev => prev.map(c => c.id === id ? { ...c, scrape_enabled: !current } : c));
       toast.success(`Broadcasting ${!current ? 'enabled' : 'isolated'}`);
    } else {
       toast.error('Failed to update cinema');
    }
  };

  const resetFailures = async (id) => {
    const { error } = await supabase.from('cinemas').update({ scrape_failure_count: 0, scrape_last_error: null }).eq('id', id);
    if (!error) {
       setCinemas(prev => prev.map(c => c.id === id ? { ...c, scrape_failure_count: 0, scrape_last_error: null } : c));
       toast.success('Errors cleared');
    }
  };

  const triggerManualSync = async () => {
    setSyncing(true);
    setSyncResult(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch('/api/cron/refresh-showtimes', { 
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${session?.access_token || ''}`
        }
      });
      const text = await res.text();
      
      if (text.includes('import ') || text.includes('export ')) {
        throw new Error('Local dev detected: Vite cannot execute .ts scripts. Use vercel dev.');
      }

      let data;
      try {
        data = JSON.parse(text);
      } catch (e) {
        throw new Error('Invalid server response');
      }

      setSyncResult(data);
      toast.success('Sync cycle completed.');
      fetchCinemas();
    } catch (err) {
      console.error(err);
      toast.error(err.message || 'Sync failed to start');
    } finally {
      setSyncing(false);
    }
  };

  const filtered = cinemas.filter(c => {
    const matchesSearch = c.name.toLowerCase().includes(search.toLowerCase()) || (c.chain || '').toLowerCase().includes(search.toLowerCase());
    if (filter === 'all') return matchesSearch;
    if (filter === 'enabled') return matchesSearch && c.scrape_enabled;
    if (filter === 'disabled') return matchesSearch && !c.scrape_enabled;
    if (filter === 'failed') return matchesSearch && (c.scrape_failure_count ?? 0) > 0;
    return matchesSearch;
  });

  return (
    <div className="p-8 max-w-[1600px] mx-auto pb-24">
      {/* Premium Header */}
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-8 mb-12">
        <div>
          <p className="text-brand text-[10px] font-black uppercase tracking-[0.4em] mb-2 italic">Cinema Scrapers</p>
          <h1 className="text-4xl font-black text-text-primary tracking-tight mb-2">Manage Showtimes</h1>
          <p className="text-text-muted text-sm max-w-2xl font-medium leading-relaxed">
            Coordinating <span className="text-brand font-bold">{cinemas.filter(c => c.scrape_enabled).length} automated crawlers</span> across multiple theater networks. Real-time monitoring of facility infrastructure.
          </p>
        </div>
        <button
          onClick={triggerManualSync}
          disabled={syncing}
          className="group relative px-10 py-5 bg-brand text-white rounded-md text-[10px] font-black uppercase tracking-[0.2em] shadow-2xl shadow-brand/20 hover:scale-105 active:scale-95 transition-all duration-300 disabled:opacity-50"
        >
          <span className="relative z-10 flex items-center gap-3 font-black">
             {syncing ? <span className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" /> : <span className="text-lg">⚡</span>}
             Start Manual Sync
          </span>
          <div className="absolute inset-0 bg-white/10 rounded-md opacity-0 group-hover:opacity-100 transition-opacity" />
        </button>
      </div>

      {syncResult && (
        <div className="card-cal mb-8 p-6 bg-surface-2 border-brand/20 animate-in fade-in slide-in-from-top-4 duration-500">
          <div className="flex items-center justify-between mb-4">
             <div className="flex items-center gap-3">
                <span className="text-xl">📡</span>
                <p className="text-[10px] font-black text-text-primary uppercase tracking-widest">Sync Details</p>
             </div>
             <button onClick={() => setSyncResult(null)} className="text-text-muted hover:text-text-primary transition-colors">✕</button>
          </div>
          <pre className="text-[11px] font-mono text-brand/80 p-4 bg-surface rounded-md overflow-x-auto border border-border/50">
            {JSON.stringify(syncResult, null, 2)}
          </pre>
        </div>
      )}

      {/* Control Module */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 mb-10 items-end">
        <div className="lg:col-span-8 flex items-center gap-4 overflow-x-auto pb-4 no-scrollbar">
           {[
             { id: 'all', label: 'All Cinemas' },
             { id: 'enabled', label: 'Enabled' },
             { id: 'disabled', label: 'Disabled' },
             { id: 'failed', label: 'Errors' },
           ].map(t => (
             <button
               key={t.id}
               onClick={() => setFilter(t.id)}
               className={`px-8 py-3 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all border whitespace-nowrap ${
                 filter === t.id
                   ? 'bg-text-primary border-text-primary text-surface shadow-xl'
                   : 'bg-surface border-border text-text-muted hover:border-border-hover hover:text-text-primary'
               }`}
             >
               {t.label}
             </button>
           ))}
        </div>
        <div className="lg:col-span-4 relative group">
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search facility signature..."
            className="w-full h-14 bg-surface border border-border rounded-md px-6 pl-14 text-text-primary text-sm focus:border-brand focus:outline-none transition-all placeholder:text-text-muted/30 shadow-xl group-hover:border-border-hover"
          />
          <Icon icon="solar:magnifer-linear" className="absolute left-6 top-1/2 -translate-y-1/2 text-xl opacity-40 pointer-events-none" />
        </div>
      </div>

      {/* Grid Interface */}
      <div className="card-cal overflow-hidden border border-border/50">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-border text-text-muted text-[10px] font-black uppercase tracking-[0.3em] bg-surface-2/50">
                <th className="px-10 py-6">Cinema Location</th>
                <th className="px-10 py-6">Sync Method</th>
                <th className="px-10 py-6">Sync Status</th>
                <th className="px-10 py-6 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                 <tr><td colSpan="4" className="px-10 py-32 text-center text-[10px] font-black text-brand uppercase tracking-widest animate-pulse italic">Loading cinemas...</td></tr>
              ) : filtered.length === 0 ? (
                 <tr><td colSpan="4" className="px-10 py-32 text-center text-text-muted italic opacity-40 uppercase tracking-widest text-[10px] font-black">No cinemas found at this frequency.</td></tr>
              ) : filtered.map(cinema => (
                <tr key={cinema.id} className="group hover:bg-surface-2/50 transition-all duration-300">
                  <td className="px-10 py-8">
                    <div className="flex items-center gap-4">
                      <HealthDot cinema={cinema} />
                      <div className="min-w-0">
                         <div className="flex items-center gap-2 mb-1">
                            <h3 className="text-text-primary text-base font-black tracking-tight group-hover:text-brand transition-colors truncate">{cinema.name}</h3>
                            <span className="bg-surface-3 text-text-muted text-[8px] font-black uppercase px-2 py-0.5 rounded-lg border border-border">{cinema.chain}</span>
                         </div>
                         <p className="text-[10px] text-text-muted font-bold uppercase tracking-widest">{cinema.city}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-10 py-8">
                     <div className="flex flex-col">
                        <span className="text-text-primary text-xs font-black italic">{ADAPTER_LABELS[cinema.scrape_adapter] || cinema.scrape_adapter}</span>
                        <span className="text-[9px] text-text-muted font-bold uppercase tracking-widest mt-1">Version 2.1 Mapped</span>
                     </div>
                  </td>
                  <td className="px-10 py-8">
                     <div className="flex flex-col">
                        <div className="flex items-center gap-2 mb-1">
                           <span className="text-text-primary text-sm font-black italic tabular-nums">{fmtWhen(cinema.showtimes_last_fetched_at)}</span>
                           {cinema.scrape_failure_count > 0 && (
                              <span className="text-red-500 text-[10px] font-black">[{cinema.scrape_failure_count} Error Signals]</span>
                           )}
                        </div>
                        <p className="text-[9px] text-text-muted font-bold uppercase tracking-widest truncate max-w-[200px]">
                           {cinema.scrape_last_error ?? 'Healthy'}
                        </p>
                     </div>
                  </td>
                  <td className="px-10 py-8 text-right">
                     <div className="flex justify-end gap-3 opacity-0 group-hover:opacity-100 transition-all transform translate-x-2 group-hover:translate-x-0">
                        {cinema.scrape_failure_count > 0 && (
                          <button
                            onClick={() => resetFailures(cinema.id)}
                            className="w-10 h-10 rounded-md bg-green-500/10 text-green-500 hover:bg-green-500 hover:text-white border border-green-500/20 flex items-center justify-center transition-all shadow-md active:scale-90"
                            title="Reset Errors"
                          >
                            ♻️
                          </button>
                        )}
                        <button
                          onClick={() => toggleEnabled(cinema.id, cinema.scrape_enabled)}
                          className={`w-10 h-10 rounded-md flex items-center justify-center transition-all shadow-md active:scale-90 border overflow-hidden ${
                            cinema.scrape_enabled 
                            ? 'bg-orange-500/10 text-orange-500 hover:bg-orange-500 hover:text-white border-orange-500/20' 
                            : 'bg-green-500/10 text-green-500 hover:bg-green-500 hover:text-white border-green-500/20'
                          }`}
                          title={cinema.scrape_enabled ? 'Turn Off' : 'Turn On'}
                        >
                           <Icon icon={cinema.scrape_enabled ? 'solar:pause-bold' : 'solar:play-bold'} />
                        </button>
                        <button
                          onClick={() => window.open(`/admin/cinemas?edit=${cinema.id}`, '_blank')}
                          className="w-10 h-10 rounded-md bg-surface border border-border flex items-center justify-center text-text-muted hover:text-brand hover:border-brand/30 transition-all shadow-md active:scale-90"
                          title="Edit Details"
                        >
                           <Icon icon="solar:magnifer-linear" />
                        </button>
                     </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
