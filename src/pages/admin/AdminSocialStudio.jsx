import { useEffect, useRef, useState } from 'react';
import { Icon } from '@iconify/react';
import toast from 'react-hot-toast';
import { useSearchParams } from 'react-router-dom';
import { authHeaders } from '../../lib/apiAuth';
import { supabase } from '../../lib/supabase';
import { uploadAdminImage } from '../../lib/imageUpload';
import SocialDraftComposer, { EDITORIAL_THEMES } from '../../components/admin/SocialDraftComposer';

const STATUS_TONES = {
  draft: 'blue',
  ready_for_review: 'amber',
  approved: 'green',
  scheduled: 'amber',
  published: 'green',
  partially_published: 'green',
  failed: 'red',
  rejected: 'red',
};

const SERIES_ICONS = {
  filmography: 'solar:user-star-linear',
  critics_say: 'solar:chat-round-line-linear',
  the_critic: 'solar:medal-star-linear',
  one_film_two_takes: 'solar:scale-linear',
  where_to_watch: 'solar:tv-linear',
  behind_the_camera: 'solar:clapperboard-edit-linear',
  weekend_watchlist: 'solar:film-strip-linear',
  whats_on_stage: 'solar:masks-linear',
  stage_to_screen: 'solar:star-fall-linear',
  film_conversation: 'solar:dialog-linear',
  new_and_upcoming: 'solar:bell-bing-linear',
  birthday_spotlight: 'solar:cake-linear',
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
    <div className="rounded-lg border border-border bg-surface p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-text-muted">{label}</p>
          <p className="mt-1 text-2xl font-black tracking-tight text-text-primary">{value}</p>
        </div>
        <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${tones[tone] || tones.brand}`}>
          <Icon icon={icon} width="18" />
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
    blue: 'border-blue-500/20 bg-blue-500/10 text-blue-500',
  };

  return (
    <span className={`inline-flex items-center rounded-md border px-2.5 py-0.5 text-[10px] font-black uppercase tracking-widest ${tones[tone] || tones.brand}`}>
      {children}
    </span>
  );
}

export default function AdminSocialStudio() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState('composer'); // 'composer' | 'calendar' | 'drafts'
  const [summary, setSummary] = useState(emptySummary);
  const [loading, setLoading] = useState(true);
  const [publishing, setPublishing] = useState(false);
  const [drafts, setDrafts] = useState([]);
  const [reviewingId, setReviewingId] = useState(null);
  const [scheduleAt, setScheduleAt] = useState({});
  const [threads, setThreads] = useState({ loading: true, connecting: false, configuration: null, connection: null });

  // 30-Day Calendar State
  const [calendarSlots, setCalendarSlots] = useState([]);
  const [loadingCalendar, setLoadingCalendar] = useState(false);
  const [seedingCalendar, setSeedingCalendar] = useState(false);

  // Selected slot state for creating draft directly from a calendar day
  const [selectedThemeId, setSelectedThemeId] = useState('actor_spotlight');
  const [slotContext, setSlotContext] = useState(null);

  // Custom asset upload
  const fileInputRefs = useRef({});
  const [uploadingAssetId, setUploadingAssetId] = useState(null);

  const fetchThreadsStatus = async () => {
    setThreads(current => ({ ...current, loading: true }));
    try {
      const res = await fetch('/api/social?task=threads_status', { headers: await authHeaders() });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      setThreads(current => ({ ...current, loading: false, configuration: data.configuration, connection: data.connection }));
    } catch (error) {
      setThreads(current => ({ ...current, loading: false }));
      console.warn('Failed to load Threads connection status:', error.message);
    }
  };

  const fetchDrafts = async () => {
    try {
      const { data, error } = await supabase
        .from('social_content_items')
        .select(`
          id,
          title,
          status,
          content_type,
          created_at,
          rejection_reason,
          social_platform_variants(id,platform,status,caption,title,hashtags,scheduled_for,published_at),
          social_assets(id,public_url,format,width,height)
        `)
        .order('created_at', { ascending: false })
        .limit(25);

      if (error) throw error;
      setDrafts(data || []);
    } catch (err) {
      console.warn('Failed to load social drafts:', err.message);
    }
  };

  const fetchCalendar = async () => {
    setLoadingCalendar(true);
    try {
      const res = await fetch('/api/social?task=calendar_plan&days=30', { headers: await authHeaders() });
      const data = await res.json().catch(() => ([]));
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      setCalendarSlots(Array.isArray(data) ? data : []);
    } catch (err) {
      console.warn('Failed to load calendar slots:', err.message);
    } finally {
      setLoadingCalendar(false);
    }
  };

  const seedCalendar = async () => {
    setSeedingCalendar(true);
    try {
      const res = await fetch('/api/social?task=seed_calendar', {
        method: 'POST',
        headers: { ...(await authHeaders()), 'Content-Type': 'application/json' },
        body: JSON.stringify({ days: 30 }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      toast.success(`Refreshed ${data.seeded || 30} days of rolling content plan!`);
      await fetchCalendar();
    } catch (err) {
      toast.error(err.message || 'Failed to seed 30-day calendar');
    } finally {
      setSeedingCalendar(false);
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
    fetchThreadsStatus();
    fetchCalendar();
  }, []);

  useEffect(() => {
    const result = searchParams.get('threads');
    if (!result) return;
    if (result === 'connected') {
      toast.success('Threads is connected and ready for publishing.');
      fetchThreadsStatus();
    } else {
      toast.error(searchParams.get('message') || 'Threads could not be connected. Please try again.');
    }
    setSearchParams(current => {
      const next = new URLSearchParams(current);
      next.delete('threads');
      next.delete('message');
      return next;
    }, { replace: true });
  }, [searchParams, setSearchParams]);

  const refreshAll = () => {
    fetchSummary();
    fetchDrafts();
    fetchThreadsStatus();
    fetchCalendar();
  };

  const connectThreads = async () => {
    setThreads(current => ({ ...current, connecting: true }));
    try {
      const res = await fetch('/api/social?task=threads_oauth_start', {
        method: 'POST',
        headers: { ...(await authHeaders()), 'Content-Type': 'application/json' },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.authorizationUrl) throw new Error(data.error || 'Threads connection could not start');
      window.location.assign(data.authorizationUrl);
    } catch (error) {
      toast.error(error.message || 'Threads connection could not start');
      setThreads(current => ({ ...current, connecting: false }));
    }
  };

  const disconnectThreadsAccount = async () => {
    if (!window.confirm('Disconnect the MuviDB Threads account? Scheduled Threads posts will not publish until it is reconnected.')) return;
    setThreads(current => ({ ...current, connecting: true }));
    try {
      const res = await fetch('/api/social?task=threads_disconnect', {
        method: 'POST',
        headers: { ...(await authHeaders()), 'Content-Type': 'application/json' },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Threads could not be disconnected');
      toast.success('Threads account disconnected.');
      await fetchThreadsStatus();
    } catch (error) {
      toast.error(error.message || 'Threads could not be disconnected');
    } finally {
      setThreads(current => ({ ...current, connecting: false }));
    }
  };

  const reviewActions = status => {
    if (status === 'draft') return [{ action: 'submit', label: 'Submit for review', tone: 'brand' }];
    if (status === 'ready_for_review') {
      return [
        { action: 'approve', label: 'Approve', tone: 'green' },
        { action: 'reject', label: 'Reject', tone: 'red' },
        { action: 'reopen', label: 'Back to draft', tone: 'plain' },
      ];
    }
    if (status === 'rejected') return [{ action: 'reopen', label: 'Reopen', tone: 'plain' }];
    if (status === 'approved') return [{ action: 'reopen', label: 'Undo approval', tone: 'plain' }];
    return [];
  };

  const runReview = async (contentItemId, action) => {
    let reason = null;
    if (action === 'reject') {
      reason = window.prompt('Why is this being rejected?');
      if (reason === null) return;
      if (!reason.trim()) return toast.error('A rejection reason is required');
    }

    setReviewingId(contentItemId);
    try {
      const res = await fetch('/api/social?task=review', {
        method: 'POST',
        headers: { ...(await authHeaders()), 'Content-Type': 'application/json' },
        body: JSON.stringify({ contentItemId, action, reason }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      toast.success(`${data.from} → ${data.status}`);
      refreshAll();
    } catch (err) {
      toast.error(err.message || 'Review action failed');
    } finally {
      setReviewingId(null);
    }
  };

  const runSchedule = async (contentItemId, explicitDate) => {
    const value = explicitDate || scheduleAt[contentItemId];
    if (!value) return toast.error('Pick a date and time first');

    setReviewingId(contentItemId);
    try {
      const res = await fetch('/api/social?task=schedule', {
        method: 'POST',
        headers: { ...(await authHeaders()), 'Content-Type': 'application/json' },
        body: JSON.stringify({ contentItemId, scheduledFor: new Date(value).toISOString() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      toast.success(`Scheduled ${data.jobs} job(s): ${data.platforms?.join(', ')}`);
      setScheduleAt(current => ({ ...current, [contentItemId]: '' }));
      refreshAll();
    } catch (err) {
      toast.error(err.message || 'Scheduling failed');
    } finally {
      setReviewingId(null);
    }
  };

  const runQuickSchedulePreset = (contentItemId, preset) => {
    let target = new Date();
    if (preset === 'today_6pm') {
      target.setHours(18, 0, 0, 0);
      if (target.getTime() < Date.now()) target.setDate(target.getDate() + 1);
    } else if (preset === 'tomorrow_10am') {
      target.setDate(target.getDate() + 1);
      target.setHours(10, 0, 0, 0);
    } else if (preset === 'tomorrow_6pm') {
      target.setDate(target.getDate() + 1);
      target.setHours(18, 0, 0, 0);
    }
    runSchedule(contentItemId, target.toISOString());
  };

  const runCancelSchedule = async contentItemId => {
    setReviewingId(contentItemId);
    try {
      const res = await fetch('/api/social?task=cancel_schedule', {
        method: 'POST',
        headers: { ...(await authHeaders()), 'Content-Type': 'application/json' },
        body: JSON.stringify({ contentItemId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      toast.success(
        data.inFlight
          ? `Cancelled ${data.cancelledJobs} job(s); ${data.inFlight} already publishing`
          : `Cancelled ${data.cancelledJobs} job(s) — back to approved`,
      );
      refreshAll();
    } catch (err) {
      toast.error(err.message || 'Cancel failed');
    } finally {
      setReviewingId(null);
    }
  };

  const handleCustomUploadOnItem = async (contentItemId, event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploadingAssetId(contentItemId);
    try {
      const uploadRes = await uploadAdminImage(file, 'film-images');
      if (uploadRes.error) throw new Error(uploadRes.error);

      const res = await fetch('/api/social?task=attach_custom_asset', {
        method: 'POST',
        headers: { ...(await authHeaders()), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contentItemId,
          publicUrl: uploadRes.url,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);

      toast.success('Custom artwork attached to this draft!');
      refreshAll();
    } catch (err) {
      toast.error(err.message || 'Failed to attach custom design');
    } finally {
      setUploadingAssetId(null);
    }
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
      else toast.success(`${summary.publishMode === 'live' ? 'Live' : 'Mock'} publisher processed ${data.processed || 0} job(s)`);
      refreshAll();
    } catch (err) {
      toast.error(err.message || 'Publisher run failed');
    } finally {
      setPublishing(false);
    }
  };

  const handleCreateDraftFromCalendarSlot = slot => {
    const series = slot.social_content_series || {};
    const dateObj = new Date(slot.scheduled_date);
    const dayName = dateObj.toLocaleDateString(undefined, { weekday: 'long' });

    // Map series slug to editor theme ID
    const matchedTheme =
      EDITORIAL_THEMES.find(t => t.seriesSlug === series.slug) ||
      EDITORIAL_THEMES.find(t => t.id === series.slug) ||
      EDITORIAL_THEMES[0];

    setSelectedThemeId(matchedTheme.id);
    setSlotContext({
      slotId: slot.id,
      scheduledDate: slot.scheduled_date,
      dayName,
      seriesName: series.name || 'Editorial Slot',
      seriesSlug: series.slug,
    });
    setActiveTab('composer');
    window.scrollTo({ top: 0, behavior: 'smooth' });
    toast.success(`Activated ${matchedTheme.name} for ${slot.scheduled_date} (${dayName})!`);
  };

  const counts = summary.counts || emptySummary.counts;

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-black tracking-tight text-text-primary">Social Studio</h1>
            <Pill tone={summary.enabled ? 'green' : 'amber'}>
              {summary.enabled ? 'Active' : 'Flag off'}
            </Pill>
            <Pill tone={threads.connection ? 'green' : 'amber'}>
              {threads.connection ? `@${threads.connection.username}` : 'Threads Offline'}
            </Pill>
          </div>
          <p className="mt-1 text-xs text-text-muted">
            Editorial content machine: 30-day strategy, viral AI captions with actor tags, custom artwork replacement, and Meta publishing.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {threads.connection ? (
            <button
              type="button"
              onClick={disconnectThreadsAccount}
              disabled={threads.connecting}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border bg-surface px-3 text-xs font-bold text-text-muted hover:text-red-500"
            >
              <Icon icon="simple-icons:threads" width="14" /> Disconnect
            </button>
          ) : (
            <button
              type="button"
              onClick={connectThreads}
              disabled={threads.connecting || threads.loading}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-text-primary px-3 text-xs font-bold text-background hover:opacity-90"
            >
              <Icon icon="simple-icons:threads" width="14" /> Connect Threads
            </button>
          )}

          <button
            onClick={refreshAll}
            disabled={loading}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border bg-surface px-3 text-xs font-bold text-text-primary hover:bg-surface-2"
          >
            <Icon icon="solar:refresh-linear" width="14" /> Refresh
          </button>

          <button
            onClick={runMockPublisher}
            disabled={publishing || !summary.enabled}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-brand px-3.5 text-xs font-bold text-white hover:bg-brand-hover"
          >
            <Icon icon={publishing ? 'solar:spinner-linear' : 'solar:play-linear'} className={publishing ? 'animate-spin' : ''} width="14" />
            Publish Due Posts
          </button>
        </div>
      </div>

      {/* Overview Metrics */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        <Metric label="Content Items" value={counts.contentItems} icon="solar:posts-carousel-vertical-linear" />
        <Metric label="Active Drafts" value={counts.draftItems} icon="solar:document-add-linear" tone="blue" />
        <Metric label="Scheduled" value={counts.scheduledItems} icon="solar:calendar-mark-linear" tone="amber" />
        <Metric label="Queued Jobs" value={counts.queuedJobs} icon="solar:server-square-linear" tone="green" />
        <Metric label="Failed Jobs" value={counts.failedJobs} icon="solar:danger-triangle-linear" tone={counts.failedJobs ? 'red' : 'green'} />
        <Metric label="30-Day Plan Slots" value={calendarSlots.length} icon="solar:calendar-date-linear" tone="brand" />
      </div>

      {/* Main Tab Navigation */}
      <div className="flex border-b border-border">
        <button
          type="button"
          onClick={() => setActiveTab('composer')}
          className={`flex items-center gap-2 border-b-2 px-5 py-3 text-xs font-black uppercase tracking-wider transition-colors ${
            activeTab === 'composer'
              ? 'border-brand text-brand'
              : 'border-transparent text-text-muted hover:text-text-primary'
          }`}
        >
          <Icon icon="solar:magic-stick-3-linear" width="16" />
          Draft Composer & Generator
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('calendar')}
          className={`flex items-center gap-2 border-b-2 px-5 py-3 text-xs font-black uppercase tracking-wider transition-colors ${
            activeTab === 'calendar'
              ? 'border-brand text-brand'
              : 'border-transparent text-text-muted hover:text-text-primary'
          }`}
        >
          <Icon icon="solar:calendar-mark-linear" width="16" />
          30-Day Editorial Calendar ({calendarSlots.length} Days)
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('drafts')}
          className={`flex items-center gap-2 border-b-2 px-5 py-3 text-xs font-black uppercase tracking-wider transition-colors ${
            activeTab === 'drafts'
              ? 'border-brand text-brand'
              : 'border-transparent text-text-muted hover:text-text-primary'
          }`}
        >
          <Icon icon="solar:posts-carousel-vertical-linear" width="16" />
          Queue & Recent Drafts ({drafts.length})
        </button>
      </div>

      {/* TAB 1: Composer & Generator */}
      {activeTab === 'composer' && (
        <SocialDraftComposer
          disabled={!summary.enabled}
          selectedThemeId={selectedThemeId}
          slotContext={slotContext}
          onClearSlot={() => setSlotContext(null)}
          onGenerated={refreshAll}
        />
      )}

      {/* TAB 2: 30-Day Editorial Plan */}
      {activeTab === 'calendar' && (
        <div className="space-y-4">
          <div className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-sm font-black uppercase tracking-widest text-text-primary">
                30-Day Rolling Editorial Content Calendar
              </h2>
              <p className="mt-1 text-xs text-text-muted">
                Structured into 7 high-engagement weekday series. Click "Generate Draft" on any day to create, customize, and schedule it.
              </p>
            </div>
            <button
              type="button"
              onClick={seedCalendar}
              disabled={seedingCalendar}
              className="inline-flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-xs font-bold text-white transition-colors hover:bg-brand-hover disabled:opacity-50"
            >
              <Icon icon={seedingCalendar ? 'solar:spinner-linear' : 'solar:magic-stick-3-linear'} className={seedingCalendar ? 'animate-spin' : ''} width="16" />
              {seedingCalendar ? 'Refreshing…' : 'Refresh 30-Day Plan'}
            </button>
          </div>

          {loadingCalendar ? (
            <div className="rounded-lg border border-border bg-surface p-12 text-center">
              <Icon icon="solar:spinner-linear" className="mx-auto animate-spin text-brand" width="28" />
              <p className="mt-2 text-sm text-text-muted">Loading editorial calendar…</p>
            </div>
          ) : calendarSlots.length === 0 ? (
            <div className="rounded-lg border border-border bg-surface p-8 text-center">
              <Icon icon="solar:calendar-mark-linear" className="mx-auto text-text-muted" width="32" />
              <p className="mt-2 text-sm font-bold text-text-primary">No calendar slots found</p>
              <p className="mt-1 text-xs text-text-muted">Click the button below to generate a 30-day schedule automatically.</p>
              <button
                type="button"
                onClick={seedCalendar}
                disabled={seedingCalendar}
                className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-brand px-4 py-2 text-xs font-bold text-white"
              >
                Generate 30 Days Now
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {calendarSlots.map(slot => {
                const dateObj = new Date(slot.scheduled_date);
                const dayName = dateObj.toLocaleDateString(undefined, { weekday: 'short' });
                const monthDay = dateObj.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
                const series = slot.social_content_series || {};
                const icon = SERIES_ICONS[series.slug] || 'solar:posts-carousel-vertical-linear';

                return (
                  <div
                    key={slot.id}
                    className="flex flex-col justify-between rounded-lg border border-border bg-surface p-4 transition-all hover:border-brand/50 hover:shadow-sm"
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="rounded bg-surface-2 px-2 py-0.5 font-mono text-[11px] font-bold text-text-primary">
                          {dayName}, {monthDay}
                        </span>
                        <Pill tone={slot.status === 'published' ? 'green' : slot.status === 'scheduled' ? 'amber' : 'blue'}>
                          {slot.status || 'planned'}
                        </Pill>
                      </div>

                      <div className="mt-3 flex items-start gap-2.5">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand/10 text-brand">
                          <Icon icon={icon} width="18" />
                        </div>
                        <div className="min-w-0">
                          <h4 className="text-xs font-black text-text-primary truncate">{series.name || 'Editorial Slot'}</h4>
                          <p className="mt-0.5 text-[10px] text-text-muted line-clamp-2">
                            {series.description || 'Curated Nollywood editorial post.'}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 pt-3 border-t border-border flex items-center justify-between">
                      <span className="text-[9px] font-black uppercase tracking-wider text-text-muted">
                        {series.category || 'Editorial'}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleCreateDraftFromCalendarSlot(slot)}
                        className="inline-flex items-center gap-1.5 rounded bg-brand px-2.5 py-1 text-xs font-bold text-white hover:bg-brand-hover transition-colors shadow-sm"
                      >
                        <Icon icon="solar:magic-stick-3-linear" width="13" />
                        Create Draft
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: Queue & Drafts List */}
      {activeTab === 'drafts' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Icon icon="solar:posts-carousel-vertical-linear" className="text-brand" width="20" />
              <h2 className="text-sm font-black uppercase tracking-widest text-text-primary">Drafts & Scheduled Posts</h2>
            </div>
            <button
              onClick={fetchDrafts}
              className="inline-flex items-center gap-1 text-xs font-bold text-text-muted hover:text-text-primary"
            >
              <Icon icon="solar:refresh-linear" width="14" /> Refresh List
            </button>
          </div>

          {drafts.length === 0 ? (
            <div className="rounded-lg border border-border bg-surface p-8 text-center">
              <p className="text-sm text-text-muted">No content items yet. Generate one in the Draft Composer tab.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {drafts.map(item => (
                <div
                  key={item.id}
                  className="rounded-lg border border-border bg-surface p-5 transition-shadow hover:shadow-sm"
                >
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    {/* Visual Art / Poster Preview */}
                    <div className="flex shrink-0 items-start gap-4">
                      {item.social_assets && item.social_assets.length > 0 ? (
                        <div className="relative group h-28 w-28 shrink-0 overflow-hidden rounded-lg border border-border bg-surface-2">
                          <img
                            src={item.social_assets[0].public_url}
                            alt=""
                            className="h-full w-full object-cover"
                          />
                          <span className="absolute bottom-1 right-1 rounded bg-black/70 px-1 py-0.5 text-[8px] font-black uppercase tracking-wider text-white">
                            {item.social_assets[0].format === 'custom_design' ? 'Custom Design' : item.social_assets[0].format}
                          </span>
                        </div>
                      ) : (
                        <div className="flex h-28 w-28 shrink-0 flex-col items-center justify-center rounded-lg border border-dashed border-border bg-surface-2 text-center p-2">
                          <Icon icon="solar:gallery-linear" className="text-text-muted" width="24" />
                          <span className="mt-1 text-[9px] text-text-muted">No artwork</span>
                        </div>
                      )}

                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-base font-black text-text-primary">{item.title}</h3>
                          <Pill tone={STATUS_TONES[item.status] || 'brand'}>{item.status}</Pill>
                        </div>
                        <p className="mt-1 text-xs text-text-muted">
                          {item.content_type} • Created {new Date(item.created_at).toLocaleString()}
                        </p>

                        {/* Replace Design with Custom Artwork */}
                        <div className="mt-3">
                          <input
                            type="file"
                            accept="image/png,image/jpeg,image/webp"
                            ref={el => {
                              fileInputRefs.current[item.id] = el;
                            }}
                            onChange={e => handleCustomUploadOnItem(item.id, e)}
                            className="hidden"
                          />
                          <button
                            type="button"
                            onClick={() => fileInputRefs.current[item.id]?.click()}
                            disabled={uploadingAssetId === item.id}
                            className="inline-flex items-center gap-1.5 rounded border border-border bg-surface-2 px-2.5 py-1 text-xs font-bold text-text-primary transition-colors hover:border-brand hover:text-brand disabled:opacity-50"
                          >
                            <Icon
                              icon={uploadingAssetId === item.id ? 'solar:spinner-linear' : 'solar:upload-track-2-linear'}
                              className={uploadingAssetId === item.id ? 'animate-spin' : ''}
                              width="13"
                            />
                            {uploadingAssetId === item.id ? 'Uploading...' : 'Replace Artwork (Canva/Poster)'}
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Actions & Status Controls */}
                    <div className="flex flex-wrap items-center gap-2">
                      {(item.social_platform_variants || []).map(variant => (
                        <span
                          key={variant.id}
                          className="inline-flex items-center gap-1 rounded-md border border-border bg-surface-2 px-2 py-1 text-[10px] font-bold text-text-muted"
                        >
                          <Icon icon={`simple-icons:${variant.platform}`} width="12" />
                          {variant.platform}
                        </span>
                      ))}

                      {reviewActions(item.status).map(({ action, label, tone }) => (
                        <button
                          key={action}
                          type="button"
                          onClick={() => runReview(item.id, action)}
                          disabled={reviewingId === item.id}
                          className={`rounded-md border px-3 py-1.5 text-xs font-bold transition-colors disabled:opacity-50 ${
                            tone === 'green'
                              ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20'
                              : tone === 'red'
                                ? 'border-red-500/30 bg-red-500/10 text-red-500 hover:bg-red-500/20'
                                : tone === 'brand'
                                  ? 'border-brand/30 bg-brand/10 text-brand hover:bg-brand/20'
                                  : 'border-border bg-surface-2 text-text-muted hover:text-text-primary'
                          }`}
                        >
                          {label}
                        </button>
                      ))}

                      {item.status === 'scheduled' && (
                        <button
                          type="button"
                          onClick={() => runCancelSchedule(item.id)}
                          disabled={reviewingId === item.id}
                          className="rounded-md border border-border bg-surface-2 px-3 py-1.5 text-xs font-bold text-text-muted transition-colors hover:text-text-primary disabled:opacity-50"
                        >
                          Cancel Schedule
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Schedule Controls */}
                  {item.status !== 'published' && item.status !== 'scheduled' && (
                    <div className="mt-4 border-t border-border pt-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[10px] font-black uppercase tracking-widest text-text-muted">
                          Quick Schedule:
                        </span>
                        <button
                          type="button"
                          onClick={() => runQuickSchedulePreset(item.id, 'today_6pm')}
                          disabled={reviewingId === item.id}
                          className="rounded border border-border bg-surface-2 px-2.5 py-1 text-xs font-bold text-text-primary hover:border-brand hover:text-brand disabled:opacity-50"
                        >
                          🕒 Today 6 PM
                        </button>
                        <button
                          type="button"
                          onClick={() => runQuickSchedulePreset(item.id, 'tomorrow_10am')}
                          disabled={reviewingId === item.id}
                          className="rounded border border-border bg-surface-2 px-2.5 py-1 text-xs font-bold text-text-primary hover:border-brand hover:text-brand disabled:opacity-50"
                        >
                          🕒 Tomorrow 10 AM
                        </button>
                        <button
                          type="button"
                          onClick={() => runQuickSchedulePreset(item.id, 'tomorrow_6pm')}
                          disabled={reviewingId === item.id}
                          className="rounded border border-border bg-surface-2 px-2.5 py-1 text-xs font-bold text-text-primary hover:border-brand hover:text-brand disabled:opacity-50"
                        >
                          🕒 Tomorrow 6 PM
                        </button>

                        <div className="flex items-center gap-2 ml-auto">
                          <input
                            type="datetime-local"
                            value={scheduleAt[item.id] || ''}
                            onChange={e => setScheduleAt(curr => ({ ...curr, [item.id]: e.target.value }))}
                            className="h-8 rounded border border-border bg-surface-2 px-2 text-xs text-text-primary outline-none focus:border-brand"
                          />
                          <button
                            type="button"
                            onClick={() => runSchedule(item.id)}
                            disabled={reviewingId === item.id || !scheduleAt[item.id]}
                            className="rounded bg-brand px-3 py-1 text-xs font-bold text-white hover:bg-brand-hover disabled:opacity-50"
                          >
                            Schedule
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Caption preview snippet */}
                  {item.social_platform_variants?.[0]?.caption && (
                    <div className="mt-3 rounded-md bg-surface-2 p-3 text-xs text-text-muted whitespace-pre-wrap max-h-28 overflow-y-auto font-mono">
                      {item.social_platform_variants[0].caption}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
