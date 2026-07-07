import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Icon } from '@iconify/react';
import { useAuth } from '../../context/AuthContext';
import { toast } from 'react-hot-toast';

export default function AdminOverview() {
  const { user } = useAuth();
  const [counts, setCounts] = useState({
    films: 0, people: 0, credits: 0,
    users: 0, reviews: 0,
    myFilms: 0, myPeople: 0, myCredits: 0, myCompanies: 0, myUpdates: 0, myTotalActions: 0
  });
  const [isLoading, setIsLoading] = useState(true);

  const [recentActivity, setRecentActivity] = useState([]);
  const [apiStatus, setApiStatus] = useState({ tmdb: 'checking', youtube: 'checking' });
  const [lastSyncs, setLastSyncs] = useState({ videos: null, showtimes: null });

  useEffect(() => {
    if (!user) return;

    const fetchCounts = async () => {
      try {
        if (user.role === 'admin_limited') {
          // Fetch sub-admin stats from admin_actions
          const { data: userStats, error: statsError } = await supabase
            .from('admin_actions')
            .select('action_type, entity_type')
            .eq('user_id', user.id);

          if (statsError) throw statsError;

          const stats = userStats || [];
          setCounts(prev => ({
            ...prev,
            myFilms: stats.filter(s => s.action_type === 'create' && s.entity_type === 'film').length,
            myPeople: stats.filter(s => s.action_type === 'create' && s.entity_type === 'person').length,
            myCredits: stats.filter(s => s.action_type === 'create' && s.entity_type === 'credit').length,
            myCompanies: stats.filter(s => s.action_type === 'create' && s.entity_type === 'company').length,
            myUpdates: stats.filter(s => s.action_type === 'update').length,
            myTotalActions: stats.length
          }));
        } else {
          // Fetch global counts for full admin
          const [films, people, credits, reviews] = 
            await Promise.all([
              supabase.from('films').select('*', { count: 'exact', head: true }),
              supabase.from('people').select('*', { count: 'exact', head: true }),
              supabase.from('credits').select('*', { count: 'exact', head: true }),
              supabase.from('reviews').select('*', { count: 'exact', head: true })
            ]);
          setCounts(prev => ({
            ...prev,
            films: films.count || 0,
            people: people.count || 0,
            credits: credits.count || 0,
            users: 1,
            reviews: reviews.count || 0
          }));
        }
      } catch (error) {
        console.error('Error fetching counts:', error);
      } finally {
        setIsLoading(false);
      }
    };

    const fetchActivity = async () => {
      try {
        if (user.role === 'admin_limited') {
          // Fetch limited admin actions only
          const { data: actions, error: actionsError } = await supabase
            .from('admin_actions')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })
            .limit(10);

          if (actionsError) throw actionsError;

          const activities = (actions || []).map(a => {
            let verb = 'Performed action on';
            if (a.action_type === 'create') verb = 'Created';
            if (a.action_type === 'update') verb = 'Updated';
            if (a.action_type === 'delete') verb = 'Deleted';

            let entityLabel = a.entity_type;
            if (a.entity_type === 'film') entityLabel = 'movie';

            return {
              type: a.entity_type,
              text: `${verb} ${entityLabel}: ${a.entity_name}`,
              time: new Date(a.created_at).toLocaleString()
            };
          });

          setRecentActivity(activities);
        } else {
          // Fetch global actions from admin_actions
          const { data: actions, error: actionsError } = await supabase
            .from('admin_actions')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(10);

          if (!actionsError && actions && actions.length > 0) {
            const activities = actions.map(a => {
              let verb = 'Modified';
              if (a.action_type === 'create') verb = 'Created';
              if (a.action_type === 'update') verb = 'Updated';
              if (a.action_type === 'delete') verb = 'Deleted';

              let entityLabel = a.entity_type;
              if (a.entity_type === 'film') entityLabel = 'movie';

              return {
                type: a.entity_type,
                text: `${verb} ${entityLabel}: ${a.entity_name}`,
                time: new Date(a.created_at).toLocaleString()
              };
            });
            setRecentActivity(activities);
          } else {
            // Fallback to public lists if admin_actions is completely empty
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
          }
        }
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

    if (user.role !== 'admin_limited') {
      checkApiHealth();
      checkSyncs();
    }
  }, [user]);

  const getActivityIcon = (type) => {
    switch (type) {
      case 'film': return 'solar:clapperboard-play-linear';
      case 'person': return 'solar:user-linear';
      case 'credit': return 'solar:document-text-linear';
      case 'company': return 'solar:buildings-linear';
      case 'user': return 'solar:user-linear';
      case 'review': return 'solar:star-linear';
      case 'sync': return 'solar:refresh-linear';
      default: return 'solar:info-circle-linear';
    }
  };

  const handleRunScript = async (scriptName) => {
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

  const isLimitedAdmin = user?.role === 'admin_limited';

  const stats = isLimitedAdmin ? [
    { label: 'My Movies Added', value: counts.myFilms, icon: 'solar:clapperboard-play-linear' },
    { label: 'My People Added', value: counts.myPeople, icon: 'solar:user-linear' },
    { label: 'My Credits Added', value: counts.myCredits, icon: 'solar:document-text-linear' },
    { label: 'My Companies Added', value: counts.myCompanies, icon: 'solar:buildings-linear' },
    { label: 'Updates Performed', value: counts.myUpdates, icon: 'solar:pen-linear' },
    { label: 'Total Contributions', value: counts.myTotalActions, icon: 'solar:ranking-linear' }
  ] : [
    { label: 'Movies', value: counts.films, icon: 'solar:clapperboard-play-linear' },
    { label: 'People', value: counts.people, icon: 'solar:user-linear' },
    { label: 'Credits', value: counts.credits, icon: 'solar:document-text-linear' },
    { label: 'AI status', value: 'Active', icon: 'solar:cpu-linear', isStatic: true },
    { label: 'Reviews', value: counts.reviews, icon: 'solar:star-linear' }
  ];

  const quickActions = isLimitedAdmin ? [
    { label: 'Add movie record', icon: 'solar:clapperboard-play-linear', path: '/admin/films' },
    { label: 'Manage people profiles', icon: 'solar:user-linear', path: '/admin/people' },
    { label: 'Manage cast & crew credits', icon: 'solar:document-text-linear', path: '/admin/credits' },
    { label: 'Manage corporate partners', icon: 'solar:buildings-linear', path: '/admin/companies' }
  ] : [
    { label: 'Add movie record', icon: 'solar:clapperboard-play-linear', path: '/admin/films' },
    { label: 'AI review center', icon: 'solar:magic-stick-linear', path: '/admin/ai' },
    { label: 'Sync cinema data', icon: 'solar:refresh-linear', path: '/admin/cinema-scraping' },
    { label: 'Review identity claims', icon: 'solar:clipboard-list-linear', path: '/admin/claims' }
  ];

  return (
    <div className="space-y-10">
      {/* Welcome Header */}
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <p className="text-brand text-xs font-bold mb-1">
            {isLimitedAdmin ? 'Sub-Admin Workspace' : 'Administration'}
          </p>
          <h1 className="text-3xl font-bold text-text-primary tracking-tight">
            {isLimitedAdmin ? 'My Overview' : 'Overview'}
          </h1>
          <p className="text-text-muted text-sm mt-1 max-w-xl font-medium">
            {isLimitedAdmin 
              ? 'Your personal contribution metrics, updates, and content editing dashboard.' 
              : 'System metrics and administrative control center.'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-brand/10 rounded-full border border-brand/20">
            <Icon icon={isLimitedAdmin ? "solar:shield-check-bold" : "solar:shield-up-bold"} className="text-brand text-xs" />
            <span className="text-[10px] font-bold text-brand uppercase">
              {isLimitedAdmin ? 'Role: Sub-Admin' : 'Role: Super-Admin'}
            </span>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 bg-green-500/10 rounded-full border border-green-500/20">
            <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
            <span className="text-[10px] font-bold text-green-600 dark:text-green-400">System online</span>
          </div>
        </div>
      </header>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-6">
        {stats.map((stat, i) => (
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
              <h2 className="text-lg font-bold text-text-primary">
                {isLimitedAdmin ? 'My Recent Contributions' : 'Recent activity'}
              </h2>
              <p className="text-xs text-text-muted mt-0.5">
                {isLimitedAdmin 
                  ? 'Your personal activity log and change history' 
                  : 'Platform logs and event history'}
              </p>
            </div>
            {recentActivity.length > 0 && (
              <span className="text-[10px] font-bold text-brand bg-brand/10 px-2.5 py-1 rounded-md">
                {recentActivity.length} Events
              </span>
            )}
          </div>
          <div className="divide-y divide-border">
            {recentActivity.length === 0 ? (
              <div className="p-12 text-center">
                <div className="w-12 h-12 rounded-full bg-brand/10 flex items-center justify-center mx-auto mb-4">
                  <Icon icon="solar:history-linear" className="text-brand text-2xl animate-spin-slow" />
                </div>
                <h3 className="text-sm font-bold text-text-primary">No actions logged yet</h3>
                <p className="text-xs text-text-muted mt-1 max-w-sm mx-auto">
                  {isLimitedAdmin 
                    ? 'Start managing films, credits, people, or companies to see your activity stream here!' 
                    : 'No administrative actions have been captured in the system log.'}
                </p>
              </div>
            ) : (
              recentActivity.map((activity, index) => (
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
                        <span className="text-[9px] font-bold text-brand px-2 py-0.5 bg-brand/5 rounded-md border border-brand/10 uppercase">
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
              ))
            )}
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
              {quickActions.map((action, i) => (
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

          {/* Contextual Side Panel */}
          {isLimitedAdmin ? (
            /* Sub-Admin Permissions Summary */
            <div className="card-cal p-6">
              <h3 className="text-[10px] font-bold text-text-muted uppercase tracking-wider mb-5 flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                Your Permissions
              </h3>
              <div className="space-y-3.5">
                {[
                  { name: 'Movies Tab', icon: 'solar:clapperboard-play-linear', allowed: true },
                  { name: 'People Profiles', icon: 'solar:user-linear', allowed: true },
                  { name: 'Credits Tab', icon: 'solar:document-text-linear', allowed: true },
                  { name: 'Companies Tab', icon: 'solar:buildings-linear', allowed: true },
                  { name: 'System Settings', icon: 'solar:settings-linear', allowed: false },
                  { name: 'User Management', icon: 'solar:users-group-two-rounded-linear', allowed: false }
                ].map((perm, i) => (
                  <div key={i} className="flex items-center justify-between text-xs font-semibold text-text-primary">
                    <div className="flex items-center gap-2">
                      <Icon icon={perm.icon} className="text-text-muted text-base" />
                      <span>{perm.name}</span>
                    </div>
                    <span className={`px-2 py-0.5 text-[9px] font-bold rounded-md ${
                      perm.allowed 
                        ? 'bg-green-500/10 text-green-500 border border-green-500/20' 
                        : 'bg-red-500/10 text-red-500 border border-red-500/20'
                    }`}>
                      {perm.allowed ? 'READ/WRITE' : 'RESTRICTED'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            /* System Health & APIs for Super Admin */
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
          )}

          {/* Contextual Bottom Side Panel */}
          {isLimitedAdmin ? (
            /* Editing guidelines for limited admin */
            <div className="card-cal p-6 md:col-span-2 lg:col-span-1 xl:col-span-2 bg-gradient-to-br from-brand/5 to-transparent border-brand/20">
              <h3 className="text-[10px] font-bold text-brand uppercase tracking-wider mb-3.5 flex items-center gap-2">
                <Icon icon="solar:magic-stick-bold" />
                Contributor Guidelines
              </h3>
              <ul className="space-y-2.5 text-xs text-text-muted font-medium">
                <li className="flex items-start gap-2">
                  <span className="text-brand font-bold mt-0.5">•</span>
                  <span><strong>Spelling:</strong> Ensure names match official records or spelling on IMDb/Wikipedia.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-brand font-bold mt-0.5">•</span>
                  <span><strong>Images:</strong> Always upload clear, high-quality portraits and official posters.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-brand font-bold mt-0.5">•</span>
                  <span><strong>Credits:</strong> Connect correct profiles instead of typing plain names when possible.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-brand font-bold mt-0.5">•</span>
                  <span><strong>Audit Logs:</strong> All updates/deletions are tracked for system safety.</span>
                </li>
              </ul>
            </div>
          ) : (
            /* Automation Hub for Super Admin */
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
          )}
        </div>
      </div>
    </div>
  );
}

