import { useEffect, useState } from 'react';
import { Icon } from '@iconify/react';
import toast from 'react-hot-toast';
import { authHeaders } from '../../lib/apiAuth';
import { supabase } from '../../lib/supabase';
import SocialDraftComposer from '../../components/admin/SocialDraftComposer';

const STATUS_TONES = {
  draft: 'blue',
  ready_for_review: 'amber',
  approved: 'green',
  scheduled: 'amber',
  published: 'green',
  failed: 'red',
  rejected: 'red',
};

const emptySummary = {
  enabled: false,
  publishMode: 'mock',
  assetBucket: 'social-published-assets',
  defaultTimezone: 'Africa/Lagos',
  counts: {
    contentItems: 0,
    draftItems: 0,
    scheduledItems: 0,
    queuedJobs: 0,
    failedJobs: 0,
    connections: 0,
    templates: 0,
  },
};

function Metric({ label, value, icon, tone = 'brand' }) {
  const tones = {
    brand: 'bg-brand/10 text-brand',
    green: 'bg-emerald-500/10 text-emerald-500',
    amber: 'bg-amber-500/10 text-amber-500',
    red: 'bg-red-500/10 text-red-500',
    blue: 'bg-blue-500/10 text-blue-500',
  };

  return (
    <div className="rounded-lg border border-border bg-surface p-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-text-muted">{label}</p>
          <p className="mt-2 text-3xl font-black tracking-tight text-text-primary">{value}</p>
        </div>
        <div className={`flex h-11 w-11 items-center justify-center rounded-lg ${tones[tone] || tones.brand}`}>
          <Icon icon={icon} width="22" />
        </div>
      </div>
    </div>
  );
}

function Pill({ children, tone = 'brand' }) {
  const tones = {
    brand: 'border-brand/20 bg-brand/10 text-brand',
    green: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-500',
    amber: 'border-amber-500/20 bg-amber-500/10 text-amber-500',
    red: 'border-red-500/20 bg-red-500/10 text-red-500',
  };

  return (
    <span className={`inline-flex items-center rounded-md border px-2.5 py-1 text-[10px] font-black uppercase tracking-widest ${tones[tone] || tones.brand}`}>
      {children}
    </span>
  );
}

export default function AdminSocialStudio() {
  const [summary, setSummary] = useState(emptySummary);
  const [loading, setLoading] = useState(true);
  const [publishing, setPublishing] = useState(false);
  const [drafts, setDrafts] = useState([]);

  const fetchDrafts = async () => {
    try {
      const { data, error } = await supabase
        .from('social_content_items')
        .select('id,title,status,content_type,created_at,social_platform_variants(id,platform,status)')
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) throw error;
      setDrafts(data || []);
    } catch (err) {
      // The tables are unreadable until the migration is applied; the summary
      // banner already explains that state, so this stays quiet.
      console.warn('Failed to load social drafts:', err.message);
    }
  };

  const fetchSummary = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/social', { headers: await authHeaders() });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      setSummary({ ...emptySummary, ...data, counts: { ...emptySummary.counts, ...(data.counts || {}) } });
    } catch (err) {
      toast.error(err.message || 'Failed to load Social Studio');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSummary();
    fetchDrafts();
  }, []);

  const refreshAll = () => {
    fetchSummary();
    fetchDrafts();
  };

  const runMockPublisher = async () => {
    setPublishing(true);
    try {
      const res = await fetch('/api/social?task=publish_due', {
        method: 'POST',
        headers: await authHeaders(),
        body: JSON.stringify({ limit: 10 }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      if (data.skipped) toast(`Publisher skipped: ${data.reason}`);
      else toast.success(`Mock publisher processed ${data.processed || 0} job(s)`);
      refreshAll();
    } catch (err) {
      toast.error(err.message || 'Mock publisher failed');
    } finally {
      setPublishing(false);
    }
  };

  const counts = summary.counts || emptySummary.counts;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-black tracking-tight text-text-primary">Social Studio</h1>
            <Pill tone={summary.enabled ? 'green' : 'amber'}>
              {summary.enabled ? 'Enabled' : 'Flag off'}
            </Pill>
            <Pill tone={summary.publishMode === 'mock' ? 'green' : 'red'}>
              {summary.publishMode}
            </Pill>
          </div>
          <p className="mt-1 text-sm text-text-muted">Draft foundation, approvals, scheduling queue, and mock publisher.</p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={refreshAll}
            disabled={loading}
            className="inline-flex h-10 items-center gap-2 rounded-lg border border-border bg-surface px-4 text-xs font-bold text-text-primary transition-colors hover:bg-surface-2 disabled:opacity-60"
          >
            <Icon icon="solar:refresh-linear" width="16" />
            Refresh
          </button>
          <button
            onClick={runMockPublisher}
            disabled={publishing || !summary.enabled || summary.publishMode !== 'mock'}
            className="inline-flex h-10 items-center gap-2 rounded-lg bg-brand px-4 text-xs font-bold text-white transition-colors hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Icon icon={publishing ? 'solar:spinner-linear' : 'solar:play-linear'} className={publishing ? 'animate-spin' : ''} width="16" />
            Run Mock Publisher
          </button>
        </div>
      </div>

      {!summary.enabled && (
        <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 p-5">
          <div className="flex items-start gap-3">
            <Icon icon="solar:shield-warning-linear" className="mt-0.5 text-amber-500" width="22" />
            <div>
              <p className="text-sm font-bold text-text-primary">Social Studio is gated</p>
              <p className="mt-1 text-sm text-text-muted">Set `SOCIAL_STUDIO_ENABLED=true` when this foundation is ready to appear in production.</p>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="Content Items" value={counts.contentItems} icon="solar:posts-carousel-vertical-linear" />
        <Metric label="Drafts" value={counts.draftItems} icon="solar:document-add-linear" tone="blue" />
        <Metric label="Scheduled" value={counts.scheduledItems} icon="solar:calendar-mark-linear" tone="amber" />
        <Metric label="Queued Jobs" value={counts.queuedJobs} icon="solar:server-square-linear" tone="green" />
        <Metric label="Failed Jobs" value={counts.failedJobs} icon="solar:danger-triangle-linear" tone={counts.failedJobs ? 'red' : 'green'} />
        <Metric label="Connections" value={counts.connections} icon="solar:link-circle-linear" />
        <Metric label="Templates" value={counts.templates} icon="solar:palette-round-linear" tone="blue" />
      </div>

      <SocialDraftComposer disabled={!summary.enabled} onGenerated={refreshAll} />

      <div className="rounded-lg border border-border bg-surface p-5">
        <div className="flex items-center gap-2">
          <Icon icon="solar:posts-carousel-vertical-linear" className="text-brand" width="20" />
          <h2 className="text-sm font-black uppercase tracking-widest text-text-primary">Recent Drafts</h2>
        </div>

        {drafts.length === 0 ? (
          <p className="mt-3 text-sm text-text-muted">No content items yet. Generate one above.</p>
        ) : (
          <div className="mt-4 space-y-2">
            {drafts.map(item => (
              <div
                key={item.id}
                className="flex flex-col gap-2 rounded-lg border border-border bg-surface-2 p-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-text-primary">{item.title}</p>
                  <p className="mt-0.5 text-[10px] uppercase tracking-widest text-text-muted">
                    {item.content_type} · {new Date(item.created_at).toLocaleString()}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  {(item.social_platform_variants || []).map(variant => (
                    <span
                      key={variant.id}
                      className="rounded-md border border-border bg-surface px-2 py-1 text-[10px] font-bold text-text-muted"
                    >
                      {variant.platform}
                    </span>
                  ))}
                  <Pill tone={STATUS_TONES[item.status] || 'brand'}>{item.status}</Pill>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="rounded-lg border border-border bg-surface p-5">
          <p className="text-[10px] font-black uppercase tracking-widest text-text-muted">Asset Bucket</p>
          <p className="mt-2 break-all font-mono text-sm text-text-primary">{summary.assetBucket}</p>
        </div>
        <div className="rounded-lg border border-border bg-surface p-5">
          <p className="text-[10px] font-black uppercase tracking-widest text-text-muted">Timezone</p>
          <p className="mt-2 font-mono text-sm text-text-primary">{summary.defaultTimezone}</p>
        </div>
        <div className="rounded-lg border border-border bg-surface p-5">
          <p className="text-[10px] font-black uppercase tracking-widest text-text-muted">Live Providers</p>
          <p className="mt-2 text-sm font-bold text-text-primary">Not configured in Phase 1</p>
        </div>
      </div>
    </div>
  );
}
