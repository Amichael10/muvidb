import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Icon } from '@iconify/react';

export default function AdminOverview() {
  const [counts, setCounts] = useState({
    films: 0, people: 0, credits: 0,
    users: 0, reviews: 0, pendingClaims: 0
  });
  const [isLoading, setIsLoading] = useState(true);

  const [recentActivity, setRecentActivity] = useState([]);
  const [apiStatus, setApiStatus] = useState({ tmdb: 'checking', youtube: 'checking' });
  const [lastSyncs, setLastSyncs] = useState({ videos: null, showtimes: null });

  useEffect(() => {
    const fetchCounts = async () => {
      try {
        const [films, people, credits, reviews] = 
          await Promise.all([
            supabase.from('films').select('*', { count: 'exact', head: true }),
            supabase.from('people').select('*', { count: 'exact', head: true }),
            supabase.from('credits').select('*', { count: 'exact', head: true }),
            supabase.from('reviews').select('*', { count: 'exact', head: true })
          ]);
        setCounts({
          films: films.count || 0,
          people: people.count || 0,
          credits: credits.count || 0,
          users: 1, // Mock value to prevent restricted access crash
          reviews: reviews.count || 0,
          pendingClaims: 0 // Mock value to prevent restricted access crash
        });
      } catch (error) {
        console.error('Error fetching counts:', error);
      } finally {
        setIsLoading(false);
      }
    };

    const fetchActivity = async () => {
      try {
        const [films, reviews, cinemas, channels] = await Promise.all([
          supabase.from('films').select('title, created_at').order('created_at', { ascending: false }).limit(5),
          supabase.from('reviews').select('body, rating, created_at').order('created_at', { ascending: false }).limit(5),
          supabase.from('cinemas').select('name, showtimes_last_fetched_at').order('showtimes_last_fetched_at', { ascending: false }).limit(3),
          supabase.from('channels').select('name, videos_last_fetched_at').order('videos_last_fetched_at', { ascending: false }).limit(3)
        ]);

        const activities = [
          ...(films.data || []).map(f => ({ 
            type: 'film', 
            text: `New film added: ${f.title}`, 
            time: new Date(f.created_at).toLocaleString() 
          })),
          ...(reviews.data || []).map(r => ({ 
            type: 'review', 
            text: `New ${r.rating}★ review: "${r.body?.substring(0, 30)}..."`, 
            time: new Date(r.created_at).toLocaleString() 
          })),
          ...(cinemas.data || []).filter(c => c.showtimes_last_fetched_at).map(c => ({
            type: 'sync',
            text: `Cinema synced: ${c.name}`,
            time: new Date(c.showtimes_last_fetched_at).toLocaleString()
          })),
          ...(channels.data || []).filter(c => c.videos_last_fetched_at).map(c => ({
            type: 'sync',
            text: `YouTube sync: ${c.name}`,
            time: new Date(c.videos_last_fetched_at).toLocaleString()
          }))
        ].sort((a, b) => new Date(b.time) - new Date(a.time)).slice(0, 10);

        setRecentActivity(activities);
      } catch (error) {
        console.error('Error fetching activity:', error);
      }
    };

    const checkSyncs = async () => {
      try {
        const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        
        const [channels, cinemas, videoCount, showtimeCount] = await Promise.all([
          supabase.from('channels').select('videos_last_fetched_at').order('videos_last_fetched_at', { ascending: false }).limit(1).maybeSingle(),
          supabase.from('cinemas').select('showtimes_last_fetched_at').order('showtimes_last_fetched_at', { ascending: false }).limit(1).maybeSingle(),
          supabase.from('channel_videos').select('*', { count: 'exact', head: true }).gt('created_at', last24h),
          supabase.from('showtimes').select('*', { count: 'exact', head: true }).gt('created_at', last24h)
        ]);

        setLastSyncs({
          videos: channels.data?.videos_last_fetched_at,
          showtimes: cinemas.data?.showtimes_last_fetched_at,
          videosCount: videoCount.count || 0,
          showtimesCount: showtimeCount.count || 0
        });
      } catch (e) {
        console.error('Error fetching sync times:', e);
      }
    };

    const checkApiHealth = async () => {
      ['tmdb', 'youtube'].forEach(async (provider) => {
        try {
          const res = await fetch(`/api/health?service=${provider}`);
          setApiStatus(prev => ({ ...prev, [provider]: res.ok ? 'active' : 'error' }));
        } catch (e) {
          setApiStatus(prev => ({ ...prev, [provider]: 'error' }));
        }
      });
    };

    fetchCounts();
    fetchActivity();
    checkApiHealth();
    checkSyncs();
  }, []);

  const getActivityIcon = (type) => {
    switch (type) {
      case 'film': return 'solar:clapperboard-play-linear';
      case 'claim': return 'solar:clipboard-list-linear';
      case 'user': return 'solar:user-linear';
      case 'review': return 'solar:star-linear';
      case 'sync': return 'solar:refresh-linear';
      default: return 'solar:info-circle-linear';
    }
  };

  const handleRunScript = async (scriptName) => {
    const toast = (await import('react-hot-toast')).default;
    const promise = (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const cronSecret = (import.meta.env && import.meta.env.VITE_CRON_SECRET) || '';
      
      const headers = {
        'Authorization': `Bearer ${session?.access_token || ''}`
      };
      if (cronSecret) {
        headers['x-cron-secret'] = cronSecret;
      }

      return fetch(`/api/cron/${scriptName}`, { headers });
    })().then(async res => {
      const text = await res.text();
      if (text.includes('import ') || text.includes('export ')) {
        throw new Error('Local dev detected: Vite cannot execute .ts scripts. Use vercel dev.');
      }
      if (!res.ok) throw new Error(`Status ${res.status}`);
      return text;
    });
    
    toast.promise(promise, {
      loading: `Executing ${scriptName}...`,
      success: `${scriptName} executed (Check Production for real data)!`,
      error: (err) => err.message
    });
  };

  return (
    <div className="space-y-10">
      {/* Welcome Header */}
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <p className="text-brand text-xs font-bold mb-1">Administration</p>
          <h1 className="text-3xl font-bold text-text-primary tracking-tight">Overview</h1>
          <p className="text-text-muted text-sm mt-1 max-w-xl font-medium">
            System metrics and administrative control center.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-brand/10 rounded-full border border-brand/20">
            <Icon icon="solar:cpu-bold" className="text-brand text-xs" />
            <span className="text-[10px] font-bold text-brand">AI: Gemini 1.5</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 bg-green-500/10 rounded-full border border-green-500/20">
            <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
            <span className="text-[10px] font-bold text-green-600 dark:text-green-400">System online</span>
          </div>
        </div>
      </header>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-6">
        {[
          { label: 'Movies', value: counts.films, icon: 'solar:clapperboard-play-linear' },
          { label: 'People', value: counts.people, icon: 'solar:user-linear' },
          { label: 'Credits', value: counts.credits, icon: 'solar:document-text-linear' },
          { label: 'AI status', value: 'Active', icon: 'solar:cpu-linear', isStatic: true },
          { label: 'Reviews', value: counts.reviews, icon: 'solar:star-linear' },
          { label: 'Claims', value: counts.pendingClaims, icon: 'solar:clipboard-list-linear', warning: counts.pendingClaims > 0 }
        ].map((stat, i) => (
          <div key={i} className="card-cal p-6 group transition-all hover:border-brand/30 relative overflow-hidden">
            <div className="flex items-center justify-between mb-4 relative z-10">
              <Icon icon={stat.icon} className="text-2xl text-text-muted group-hover:text-brand transition-colors" />
              {stat.warning && (
                <span className="flex h-2 w-2 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                </span>
              )}
            </div>
            <div className="text-xl font-bold text-text-primary tabular-nums relative z-10 truncate">
              {isLoading ? (
                <div className="h-8 w-16 bg-surface-2 rounded-lg animate-pulse" />
              ) : stat.isStatic ? stat.value : (stat.value || 0).toLocaleString()}
            </div>
            <p className="text-[10px] font-bold text-text-muted mt-1.5 opacity-60 uppercase tracking-wider">{stat.label}</p>
            
            <div className="absolute -right-4 -bottom-4 w-12 h-12 bg-brand/5 rounded-full blur-2xl group-hover:bg-brand/10 transition-colors" />
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {/* Recent Activity */}
        <div className="lg:col-span-2 xl:col-span-2 card-cal p-0 overflow-hidden">
          <div className="px-6 py-5 border-b border-border flex items-center justify-between bg-surface-2/30">
            <div>
              <h2 className="text-lg font-bold text-text-primary">Recent activity</h2>
              <p className="text-xs text-text-muted mt-0.5">Platform logs and event history</p>
            </div>
            <button className="text-[11px] font-bold text-brand bg-brand/10 px-3 py-1.5 rounded-lg hover:bg-brand/20 transition-all">
              View all
            </button>
          </div>
          <div className="divide-y divide-border">
            {recentActivity.map((activity, index) => (
              <div 
                key={index}
                className="flex items-center justify-between px-6 py-4 hover:bg-surface-2/50 transition-colors group"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-md bg-surface-2 flex items-center justify-center text-lg border border-border group-hover:border-brand/30 transition-colors">
                    <Icon icon={getActivityIcon(activity.type)} className="text-xl text-text-muted group-hover:text-brand transition-colors" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-text-primary leading-tight">{activity.text}</p>
                    <div className="flex items-center gap-3 mt-1.5">
                      <span className="text-[9px] font-bold text-brand px-2 py-0.5 bg-brand/5 rounded-md border border-brand/10">
                        {activity.type}
                      </span>
                      <span className="text-[10px] font-medium text-text-muted opacity-60">
                        {activity.time}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="text-text-muted opacity-0 group-hover:opacity-100 transition-all translate-x-2 group-hover:translate-x-0">
                  <Icon icon="solar:alt-arrow-right-linear" className="w-5 h-5" />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Quick Actions & Status */}
        <div className="lg:col-span-1 xl:col-span-2 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2 gap-6">
          <div className="card-cal p-6">
            <h3 className="text-[10px] font-bold text-text-muted uppercase tracking-wider mb-5 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-brand" />
              Quick actions
            </h3>
            <div className="space-y-3">
              {[
                { label: 'Add movie record', icon: 'solar:clapperboard-play-linear', path: '/admin/films' },
                { label: 'AI review center', icon: 'solar:magic-stick-linear', path: '/admin/ai' },
                { label: 'Sync cinema data', icon: 'solar:refresh-linear', path: '/admin/cinema-scraping' },
                { label: 'Review identity claims', icon: 'solar:clipboard-list-linear', path: '/admin/claims' }
              ].map((action, i) => (
                <a 
                  key={i} 
                  href={action.path}
                  className="w-full flex items-center gap-3 p-3 bg-surface-2/50 border border-border rounded-md hover:border-brand/40 hover:bg-surface-2 transition-all text-left group"
                >
                  <Icon icon={action.icon} className="text-xl text-text-muted group-hover:text-brand transition-transform" />
                  <span className="text-sm font-bold text-text-primary group-hover:text-brand transition-colors">{action.label}</span>
                </a>
              ))}
            </div>
          </div>

          {/* System Health & APIs */}
          <div className="card-cal p-6">
            <h3 className="text-[10px] font-bold text-text-muted uppercase tracking-wider mb-5 flex items-center justify-between">
              <span>System status</span>
              <div className="flex gap-1">
                <div className="w-1 h-1 rounded-full bg-green-500" />
                <div className="w-1 h-1 rounded-full bg-green-500" />
              </div>
            </h3>
            <div className="space-y-4">
              {[
                { name: 'Metadata processing', status: 'active', icon: 'solar:cpu-linear' },
                { name: 'Movie data (TMDB)', status: apiStatus.tmdb, icon: 'solar:clapperboard-linear' },
                { name: 'YouTube sync service', status: apiStatus.youtube, icon: 'solar:videocamera-record-linear' }
              ].map((api, i) => (
                <div key={i} className="flex items-center justify-between p-3 bg-surface-2 rounded-md border border-border">
                  <div className="flex items-center gap-3">
                    <Icon icon={api.icon} className="text-lg text-text-muted" />
                    <span className="text-xs font-bold text-text-primary">{api.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`w-1.5 h-1.5 rounded-full ${
                      api.status === 'active' ? 'bg-green-500' : api.status === 'checking' ? 'bg-amber-500 animate-pulse' : 'bg-red-500'
                    }`} />
                    <span className="text-[10px] font-bold opacity-60">
                      {api.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Automation Hub */}
          <div className="card-cal p-6 md:col-span-2 lg:col-span-1 xl:col-span-2">
            <h3 className="text-[10px] font-bold text-text-muted uppercase tracking-wider mb-5">
              Maintenance
            </h3>
            <div className="space-y-4">
              {[
                { name: 'Fetch YouTube records', script: 'refresh-videos', desc: 'Sync latest external content', last: lastSyncs.videos, count: lastSyncs.videosCount },
                { name: 'Update cinema listings', script: 'refresh-showtimes', desc: 'Sync local theater data', last: lastSyncs.showtimes, count: lastSyncs.showtimesCount }
              ].map((job, i) => (
                <div key={i} className="group">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-xs font-bold text-text-primary line-clamp-1">{job.name}</p>
                        {job.count > 0 && (
                          <span className="text-[8px] font-bold bg-brand/10 text-brand px-1.5 py-0.5 rounded-full">
                            +{job.count} recently
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-text-muted font-medium">
                        {job.last ? `Last run: ${new Date(job.last).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : job.desc}
                      </p>
                    </div>
                    <button 
                      onClick={() => handleRunScript(job.script)}
                      className="w-8 h-8 flex items-center justify-center bg-brand/5 border border-brand/20 text-brand rounded-lg hover:bg-brand hover:text-white transition-all shadow-sm"
                      title="Run task"
                    >
                      <Icon icon="solar:play-bold" className="text-[10px]" />
                    </button>
                  </div>
                  {i < 1 && <div className="h-[1px] w-full bg-border mt-3 opacity-50" />}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
