import { useState, useEffect } from 'react';
import { Icon } from '@iconify/react';
import { toast } from 'react-hot-toast';

export default function AdminAutomation() {
  const [automationJobs, setAutomationJobs] = useState([]);
  const [automationLoading, setAutomationLoading] = useState(false);

  useEffect(() => {
    fetchAutomationJobs();
  }, []);

  const fetchAutomationJobs = async () => {
    try {
      const res = await fetch('/api/automation?action=status');
      if (res.ok) {
        const data = await res.json();
        if (data.jobs) setAutomationJobs(data.jobs);
      }
    } catch (e) {
      console.error('Failed to fetch automation jobs', e);
    }
  };

  const triggerJob = async (jobId) => {
    let endpoint = '';
    if (jobId === 'channel_fetcher') endpoint = '/api/automation?action=fetch-channels';
    if (jobId === 'actor_enricher') endpoint = '/api/automation?action=enrich-actors';

    if (!endpoint) return;

    setAutomationLoading(true);
    toast(`Triggering ${jobId}...`, { icon: '🔄' });
    try {
      await fetch(endpoint, { method: 'POST' });
      toast.success('Job triggered successfully!');
      fetchAutomationJobs();
    } catch (e) {
      toast.error('Failed to trigger job');
    }
    setAutomationLoading(false);
  };

  return (
    <div className="animate-in fade-in duration-500">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="font-heading font-bold text-3xl text-text-primary">Automation Jobs</h2>
          <p className="text-text-muted mt-1 text-sm">Manage background tasks and continuous data pipelines.</p>
        </div>
        <button 
          onClick={fetchAutomationJobs}
          className="flex items-center gap-2 bg-surface border border-border px-4 py-2 rounded-xl text-sm font-bold text-text-primary hover:bg-surface-2 transition-colors"
        >
          <Icon icon="solar:refresh-bold" />
          Refresh
        </button>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Actor Enricher Card */}
        <div className="bg-surface border border-border rounded-2xl p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-brand/10 flex items-center justify-center text-brand">
                  <Icon icon="solar:user-id-bold" className="text-xl" />
                </div>
                <div>
                  <h3 className="font-bold text-lg text-text-primary">Actor Enricher</h3>
                  <span className="text-xs text-text-muted">Runs continuously via Daemon (20/batch)</span>
                </div>
              </div>
              {automationJobs.find(j => j.id === 'actor_enricher')?.status === 'running' ? (
                <span className="flex items-center gap-2 text-xs font-bold bg-amber-500/10 text-amber-500 px-3 py-1 rounded-full">
                  <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" /> Running
                </span>
              ) : (
                <span className="flex items-center gap-2 text-xs font-bold bg-green-500/10 text-green-500 px-3 py-1 rounded-full">
                  <span className="w-2 h-2 rounded-full bg-green-500" /> Idle
                </span>
              )}
            </div>
            
            <div className="space-y-3 mb-6 bg-bg/50 p-4 rounded-xl border border-border/50">
              <div className="flex justify-between text-sm">
                <span className="text-text-muted">Last Message:</span>
                <span className="font-mono text-xs text-text-primary text-right max-w-[60%] truncate" title={automationJobs.find(j => j.id === 'actor_enricher')?.last_message}>
                  {automationJobs.find(j => j.id === 'actor_enricher')?.last_message || 'No data'}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-text-muted">Last Run:</span>
                <span className="font-mono text-xs text-text-primary">
                  {automationJobs.find(j => j.id === 'actor_enricher')?.last_run 
                    ? new Date(automationJobs.find(j => j.id === 'actor_enricher').last_run).toLocaleString() 
                    : 'Never'}
                </span>
              </div>
            </div>
          </div>
          
          <button 
            onClick={() => triggerJob('actor_enricher')}
            disabled={automationLoading}
            className="w-full bg-brand hover:bg-brand/90 text-white font-bold py-3 px-4 rounded-xl transition-colors disabled:opacity-50 flex justify-center items-center gap-2"
          >
            <Icon icon="solar:play-bold" />
            Run Manual Batch Now
          </button>
        </div>

        {/* Channel Fetcher Card */}
        <div className="bg-surface border border-border rounded-2xl p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center text-red-500">
                  <Icon icon="solar:play-stream-bold" className="text-xl" />
                </div>
                <div>
                  <h3 className="font-bold text-lg text-text-primary">Channel Fetcher</h3>
                  <span className="text-xs text-text-muted">Runs every 2 hours via Daemon</span>
                </div>
              </div>
              {automationJobs.find(j => j.id === 'channel_fetcher')?.status === 'running' ? (
                <span className="flex items-center gap-2 text-xs font-bold bg-amber-500/10 text-amber-500 px-3 py-1 rounded-full">
                  <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" /> Running
                </span>
              ) : (
                <span className="flex items-center gap-2 text-xs font-bold bg-green-500/10 text-green-500 px-3 py-1 rounded-full">
                  <span className="w-2 h-2 rounded-full bg-green-500" /> Idle
                </span>
              )}
            </div>
            
            <div className="space-y-3 mb-6 bg-bg/50 p-4 rounded-xl border border-border/50">
              <div className="flex justify-between text-sm">
                <span className="text-text-muted">Last Message:</span>
                <span className="font-mono text-xs text-text-primary text-right max-w-[60%] truncate" title={automationJobs.find(j => j.id === 'channel_fetcher')?.last_message}>
                  {automationJobs.find(j => j.id === 'channel_fetcher')?.last_message || 'No data'}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-text-muted">Last Run:</span>
                <span className="font-mono text-xs text-text-primary">
                  {automationJobs.find(j => j.id === 'channel_fetcher')?.last_run 
                    ? new Date(automationJobs.find(j => j.id === 'channel_fetcher').last_run).toLocaleString() 
                    : 'Never'}
                </span>
              </div>
            </div>
          </div>
          
          <button 
            onClick={() => triggerJob('channel_fetcher')}
            disabled={automationLoading}
            className="w-full bg-surface-2 hover:bg-surface-3 border border-border text-text-primary font-bold py-3 px-4 rounded-xl transition-colors disabled:opacity-50 flex justify-center items-center gap-2"
          >
            <Icon icon="solar:play-bold" />
            Run Manual Batch Now
          </button>
        </div>
      </div>
    </div>
  );
}
