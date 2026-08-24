import { useEffect, useRef, useState } from 'react';
import { Icon } from '@iconify/react';
import toast from 'react-hot-toast';
import { useSearchParams } from 'react-router-dom';
import { authHeaders } from '../../lib/apiAuth';
import { supabase } from '../../lib/supabase';
import { uploadAdminImage } from '../../lib/imageUpload';
import SocialDraftComposer, { EDITORIAL_THEMES } from '../../components/admin/SocialDraftComposer';
import AutoPilotReviewModal from '../../components/admin/AutoPilotReviewModal';

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
  const [activeTab, setActiveTab] = useState('calendar'); // 'calendar' | 'drafts' | 'composer'
  const [selectedSlotForReview, setSelectedSlotForReview] = useState(null);
  const [summary, setSummary] = useState(emptySummary);
  const [loading, setLoading] = useState(true);
  const [publishing, setPublishing] = useState(false);
  const [drafts, setDrafts] = useState([]);
  const [reviewingId, setReviewingId] = useState(null);
  const [scheduleAt, setScheduleAt] = useState({});
  const [connections, setConnections] = useState({
    loading: true,
    connecting: false,
    configuration: null,
    platforms: {
      threads: null,
      instagram: null,
      facebook: null,
      tiktok: null,
    },
  });
  const [channelsModalOpen, setChannelsModalOpen] = useState(false);
  const [manualConnectPlatform, setManualConnectPlatform] = useState(null);
  const [manualFormData, setManualFormData] = useState({ username: '', displayName: '', externalAccountId: '', accessToken: '' });

  // 30-Day Calendar State
  const getTomorrowDateStr = () => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().split('T')[0];
  };

  const [calendarSlots, setCalendarSlots] = useState([]);
  const [loadingCalendar, setLoadingCalendar] = useState(false);
  const [seedingCalendar, setSeedingCalendar] = useState(false);
  const [calendarStartDate, setCalendarStartDate] = useState(getTomorrowDateStr());
  const [postsPerDay, setPostsPerDay] = useState(1);
  const [shuffleOffset, setShuffleOffset] = useState(0);

  // Selected slot state for creating draft directly from a calendar day
  const [selectedThemeId, setSelectedThemeId] = useState('actor_spotlight');
  const [slotContext, setSlotContext] = useState(null);

  // Custom asset upload
  const fileInputRefs = useRef({});
  const [uploadingAssetId, setUploadingAssetId] = useState(null);

  const fetchConnectionsStatus = async () => {
    setConnections(current => ({ ...current, loading: true }));
    try {
      const res = await fetch('/api/social?task=connections_status', { headers: await authHeaders() });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      setConnections(current => ({
        ...current,
        loading: false,
        configuration: data.configuration,
        platforms: {
          threads: data.connections?.threads || data.connection || null,
          instagram: data.connections?.instagram || null,
          facebook: data.connections?.facebook || null,
          tiktok: data.connections?.tiktok || null,
        },
      }));
    } catch (error) {
      setConnections(current => ({ ...current, loading: false }));
      console.warn('Failed to load social connections status:', error.message);
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

  const fetchCalendar = async (offset = shuffleOffset) => {
    setLoadingCalendar(true);
    try {
      const res = await fetch(`/api/social?task=calendar_plan&days=30&offset=${offset}`, { headers: await authHeaders() });
      const data = await res.json().catch(() => ([]));
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      setCalendarSlots(Array.isArray(data) ? data : []);
    } catch (err) {
      console.warn('Failed to load calendar slots:', err.message);
    } finally {
      setLoadingCalendar(false);
    }
  };

  const handleShuffleAllCandidates = () => {
    const nextOffset = shuffleOffset + 1;
    setShuffleOffset(nextOffset);
    toast.success('🎲 Shuffled all candidates across the 30-day plan!');
    fetchCalendar(nextOffset);
  };

  const seedCalendar = async () => {
    setSeedingCalendar(true);
    try {
      const res = await fetch('/api/social?task=seed_calendar', {
        method: 'POST',
        headers: { ...(await authHeaders()), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          days: 30,
          startDate: calendarStartDate,
          postsPerDay,
          clearExistingPlanned: true,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      toast.success(`✨ Generated ${data.seeded || 30} slots starting ${calendarStartDate} (${postsPerDay} post${postsPerDay > 1 ? 's' : ''}/day)!`);
      await fetchCalendar(shuffleOffset);
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
    fetchConnectionsStatus();
    fetchCalendar();
  }, []);

  useEffect(() => {
    const threadsRes = searchParams.get('threads');
    const metaRes = searchParams.get('meta');
    const tiktokRes = searchParams.get('tiktok');
    const message = searchParams.get('message');

    if (threadsRes === 'connected') {
      toast.success('Threads is connected and ready for publishing.');
      fetchConnectionsStatus();
    } else if (threadsRes === 'error') {
      toast.error(message || 'Threads could not be connected.');
    }

    if (metaRes === 'connected') {
      toast.success(message || 'Meta (Facebook & Instagram) connected successfully!');
      fetchConnectionsStatus();
    } else if (metaRes === 'error') {
      toast.error(message || 'Meta connection failed.');
    }

    if (tiktokRes === 'connected') {
      toast.success('TikTok connected successfully!');
      fetchConnectionsStatus();
    } else if (tiktokRes === 'error') {
      toast.error(message || 'TikTok connection failed.');
    }

    if (threadsRes || metaRes || tiktokRes) {
      setSearchParams(current => {
        const next = new URLSearchParams(current);
        next.delete('threads');
        next.delete('meta');
        next.delete('tiktok');
        next.delete('message');
        return next;
      });
    }
  }, [searchParams, setSearchParams]);

  const refreshAll = () => {
    fetchSummary();
    fetchDrafts();
    fetchConnectionsStatus();
    fetchCalendar();
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
            <Pill tone={Object.values(connections.platforms).some(Boolean) ? 'green' : 'amber'}>
              {Object.values(connections.platforms).filter(Boolean).length}/4 Channels Connected
            </Pill>
          </div>
          <p className="mt-1 text-xs text-text-muted">
            30-day editorial pipeline: Auto-assigned Nollywood stars & movies, Figma graphic generation, and 1-click multi-platform scheduling (Instagram, Facebook, Threads, TikTok).
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setChannelsModalOpen(true)}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border bg-surface px-3 text-xs font-bold text-text-primary hover:border-brand hover:text-brand"
          >
            <Icon icon="solar:share-circle-linear" width="14" />
            Channels ({Object.values(connections.platforms).filter(Boolean).length}/4)
          </button>

          <button
            onClick={refreshAll}
            disabled={loading}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border bg-surface px-3 text-xs font-bold text-text-primary hover:bg-surface-2"
          >
            <Icon icon="solar:refresh-linear" width="14" /> Refresh
          </button>

          <button
            onClick={async () => {
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
            }}
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
        <Metric label="30-Day Plan Slots" value={calendarSlots.length} icon="solar:calendar-date-linear" tone="brand" />
        <Metric label="Active Drafts" value={counts.draftItems} icon="solar:document-add-linear" tone="blue" />
        <Metric label="Scheduled" value={counts.scheduledItems} icon="solar:calendar-mark-linear" tone="amber" />
        <Metric label="Queued Jobs" value={counts.queuedJobs} icon="solar:server-square-linear" tone="green" />
        <Metric label="Total Content" value={counts.contentItems} icon="solar:posts-carousel-vertical-linear" tone="blue" />
        <Metric label="Failed Jobs" value={counts.failedJobs} icon="solar:danger-triangle-linear" tone={counts.failedJobs ? 'red' : 'green'} />
      </div>

      {/* Main Tab Navigation */}
      <div className="flex border-b border-border">
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
          30-Day Auto-Pilot Plan ({calendarSlots.length} Slots)
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
          Queue & Scheduled Posts ({drafts.length})
        </button>

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
          Ad-Hoc Custom Composer
        </button>
      </div>

      {/* TAB 3: Ad-Hoc Custom Composer */}
      {activeTab === 'composer' && (
        <SocialDraftComposer
          disabled={!summary.enabled}
          selectedThemeId={selectedThemeId}
          slotContext={slotContext}
          onClearSlot={() => setSlotContext(null)}
          onGenerated={refreshAll}
        />
      )}

      {/* TAB 1: 30-Day Auto-Pilot Editorial Plan */}
      {activeTab === 'calendar' && (
        <div className="space-y-4">
          <div className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-5 lg:flex-row lg:items-center lg:justify-between shadow-sm">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-black uppercase tracking-widest text-text-primary">
                  30-Day Auto-Pilot Editorial Plan
                </h2>
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 border border-amber-500/20 px-2.5 py-0.5 text-[10px] font-bold text-amber-400">
                  <Icon icon="solar:crown-bold" width="11" />
                  Nollistream, Docuth & EbonyLife Priority
                </span>
              </div>
              <p className="mt-1 text-xs text-text-muted">
                Pre-matched daily schedule with verified Nollywood stars, crew, and streamers. Approve in 1 click or manually search/swap any candidate.
              </p>
            </div>

            {/* Editorial Control Toolbar */}
            <div className="flex flex-wrap items-center gap-2.5">
              {/* Start Date Selector */}
              <div className="flex items-center gap-1.5 rounded-lg border border-border bg-surface-2 px-2.5 py-1.5 text-xs">
                <Icon icon="solar:calendar-date-bold" className="text-brand" width="14" />
                <span className="text-[11px] font-bold text-text-muted">Start:</span>
                <input
                  type="date"
                  value={calendarStartDate}
                  onChange={e => setCalendarStartDate(e.target.value)}
                  className="bg-transparent font-mono text-xs font-bold text-text-primary outline-none"
                />
              </div>

              {/* Posts Per Day Toggle */}
              <div className="flex items-center rounded-lg border border-border bg-surface-2 p-0.5 text-xs font-bold">
                <button
                  type="button"
                  onClick={() => setPostsPerDay(1)}
                  className={`rounded-md px-2.5 py-1 transition-all ${
                    postsPerDay === 1
                      ? 'bg-brand text-white shadow-sm'
                      : 'text-text-muted hover:text-text-primary'
                  }`}
                >
                  1 Post/Day
                </button>
                <button
                  type="button"
                  onClick={() => setPostsPerDay(2)}
                  className={`rounded-md px-2.5 py-1 transition-all ${
                    postsPerDay === 2
                      ? 'bg-brand text-white shadow-sm'
                      : 'text-text-muted hover:text-text-primary'
                  }`}
                >
                  2 Posts/Day
                </button>
              </div>

              {/* Shuffle All Candidates Button */}
              <button
                type="button"
                onClick={handleShuffleAllCandidates}
                disabled={loadingCalendar}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface-2 px-3 py-1.5 text-xs font-bold text-text-primary hover:border-brand hover:text-brand transition-all disabled:opacity-50"
                title="Shuffle and rotate all candidate actors, crew, and movies across the plan"
              >
                <Icon icon="solar:shuffle-bold" width="14" />
                Shuffle All ({calendarSlots.length})
              </button>

              {/* Generate / Refresh Plan Button */}
              <button
                type="button"
                onClick={seedCalendar}
                disabled={seedingCalendar}
                className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-3.5 py-1.5 text-xs font-bold text-white transition-all hover:bg-brand-hover hover:shadow-lg hover:shadow-brand/20 disabled:opacity-50 shadow-sm"
              >
                <Icon
                  icon={seedingCalendar ? 'solar:spinner-linear' : 'solar:magic-stick-3-bold'}
                  className={seedingCalendar ? 'animate-spin' : ''}
                  width="14"
                />
                {seedingCalendar ? 'Generating Plan…' : '⚡ Generate Schedule'}
              </button>
            </div>
          </div>

          {loadingCalendar ? (
            <div className="rounded-lg border border-border bg-surface p-12 text-center">
              <Icon icon="solar:spinner-linear" className="mx-auto animate-spin text-brand" width="28" />
              <p className="mt-2 text-sm text-text-muted">Loading auto-pilot calendar & candidates…</p>
            </div>
          ) : calendarSlots.length === 0 ? (
            <div className="rounded-lg border border-border bg-surface p-8 text-center">
              <Icon icon="solar:calendar-mark-linear" className="mx-auto text-text-muted" width="32" />
              <p className="mt-2 text-sm font-bold text-text-primary">No calendar slots found</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {calendarSlots.map(slot => {
                const dateObj = new Date(slot.scheduled_date);
                const dayName = dateObj.toLocaleDateString(undefined, { weekday: 'short' });
                const monthDay = dateObj.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
                const series = slot.social_content_series || {};
                const icon = SERIES_ICONS[series.slug] || 'solar:posts-carousel-vertical-linear';
                const candidate = slot.candidate;
                const isScheduled = slot.status === 'scheduled';
                const isPublished = slot.status === 'published';

                return (
                  <div
                    key={slot.id}
                    className={`group flex flex-col justify-between rounded-xl border p-4 transition-all ${
                      isPublished
                        ? 'border-green-500/30 bg-surface shadow-sm'
                        : isScheduled
                          ? 'border-amber-500/30 bg-surface shadow-sm'
                          : 'border-border bg-surface hover:border-brand/60 hover:shadow-md'
                    }`}
                  >
                    <div>
                      {/* Header: Date + Status */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <span className="rounded bg-surface-2 px-2 py-0.5 font-mono text-[11px] font-bold text-text-primary">
                            {dayName}, {monthDay}
                          </span>
                          {slot.scheduled_time && (
                            <span className="font-mono text-[10px] text-text-muted">
                              {slot.scheduled_time.slice(0, 5)}
                            </span>
                          )}
                        </div>
                        <Pill tone={isPublished ? 'green' : isScheduled ? 'amber' : 'blue'}>
                          {isPublished ? 'Published' : isScheduled ? 'Scheduled' : 'Ready'}
                        </Pill>
                      </div>

                      {/* Series Badge */}
                      <div className="mt-2.5 flex items-center gap-1.5 text-brand">
                        <Icon icon={icon} width="14" />
                        <span className="text-[11px] font-black uppercase tracking-wider truncate">
                          {series.name || 'Editorial Series'}
                        </span>
                      </div>

                      {/* Auto-Assigned Candidate Preview Box */}
                      <div className="mt-2.5 flex items-center gap-3 rounded-lg border border-border/80 bg-surface-2/60 p-2.5">
                        <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-md border border-border bg-surface">
                          {candidate?.imageUrl ? (
                            <img src={candidate.imageUrl} alt="" className="h-full w-full object-cover" />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-text-muted">
                              <Icon icon="solar:user-star-linear" width="22" />
                            </div>
                          )}
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1">
                            <span className="truncate text-xs font-black text-text-primary">
                              {candidate?.name || 'Curated Nollywood Star'}
                            </span>
                          </div>
                          <p className="truncate text-[10px] text-text-muted">
                            {candidate?.subtext || series.description || 'Ready for review'}
                          </p>
                        </div>
                      </div>

                      {slot.selection && candidate && (
                        <div className="mt-2.5 rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-2.5 py-2">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[9px] font-black uppercase tracking-wider text-emerald-400">Why this post</span>
                            <span className="rounded bg-emerald-500/10 px-1.5 py-0.5 font-mono text-[9px] font-bold text-emerald-400">
                              {slot.selection.score}/100
                            </span>
                          </div>
                          <p className="mt-1 line-clamp-2 text-[10px] leading-relaxed text-text-muted">
                            {slot.selection.whyNow}
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Action Footer */}
                    <div className="mt-4 pt-3 border-t border-border flex items-center justify-between">
                      <span className="text-[9px] font-black uppercase tracking-wider text-text-muted">
                        {series.category || 'Editorial'}
                      </span>
                      {isScheduled || isPublished ? (
                        <button
                          type="button"
                          onClick={() => setSelectedSlotForReview(slot)}
                          className="inline-flex items-center gap-1 text-[11px] font-bold text-green-400 hover:text-green-300"
                        >
                          <Icon icon="solar:check-circle-bold" width="13" />
                          {isPublished ? 'View Post' : 'Scheduled'}
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setSelectedSlotForReview(slot)}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-3 py-1.5 text-xs font-bold text-white shadow transition-all hover:bg-brand-hover hover:shadow-brand/20 active:scale-95"
                        >
                          <Icon icon="solar:bolt-bold" width="13" />
                          Review & Schedule
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: Queue & Drafts List */}
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
              <p className="text-sm text-text-muted">No content items yet. Approve one in the 30-Day Plan tab or create one in Composer.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {drafts.map(item => (
                <div
                  key={item.id}
                  className="rounded-lg border border-border bg-surface p-5 transition-shadow hover:shadow-sm"
                >
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
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
                        <div className="flex h-28 w-28 shrink-0 items-center justify-center rounded-lg border border-dashed border-border bg-surface-2 text-text-muted">
                          <Icon icon="solar:gallery-linear" width="28" />
                        </div>
                      )}

                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-bold text-text-primary">{item.title}</h3>
                          <Pill tone={STATUS_TONES[item.status] || 'blue'}>{item.status}</Pill>
                          <span className="text-xs text-text-muted">
                            Type: <strong className="text-text-primary">{item.content_type}</strong>
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-text-muted">
                          Created {new Date(item.created_at).toLocaleString()}
                        </p>

                        {/* Replace Graphic Asset Button */}
                        <div className="mt-3 flex items-center gap-2">
                          <input
                            type="file"
                            accept="image/*"
                            ref={el => (fileInputRefs.current[item.id] = el)}
                            onChange={async (e) => {
                              const file = e.target.files?.[0];
                              if (!file) return;
                              setUploadingAssetId(item.id);
                              try {
                                const { publicUrl } = await uploadAdminImage(file, 'social');
                                const res = await fetch('/api/social?task=attach_custom_asset', {
                                  method: 'POST',
                                  headers: await authHeaders(),
                                  body: JSON.stringify({
                                    contentItemId: item.id,
                                    publicUrl,
                                    format: 'custom_design',
                                  }),
                                });
                                const data = await res.json().catch(() => ({}));
                                if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
                                toast.success('Custom artwork uploaded & attached!');
                                fetchDrafts();
                              } catch (err) {
                                toast.error(err.message || 'Failed to upload custom asset');
                              } finally {
                                setUploadingAssetId(null);
                              }
                            }}
                            className="hidden"
                          />
                          <button
                            type="button"
                            onClick={() => fileInputRefs.current[item.id]?.click()}
                            disabled={uploadingAssetId === item.id}
                            className="inline-flex items-center gap-1.5 rounded border border-border bg-surface px-2.5 py-1 text-xs font-bold text-text-primary hover:border-brand hover:text-brand disabled:opacity-50"
                          >
                            <Icon icon={uploadingAssetId === item.id ? 'solar:spinner-linear' : 'solar:upload-track-2-linear'} className={uploadingAssetId === item.id ? 'animate-spin' : ''} width="13" />
                            {uploadingAssetId === item.id ? 'Uploading…' : '🖼️ Replace Graphic'}
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

      {/* Social Channels & Platform Connections Modal */}
      {channelsModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="relative max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-xl border border-border bg-surface p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-border pb-4">
              <div>
                <h3 className="text-lg font-black tracking-tight text-text-primary">Connected Social Channels</h3>
                <p className="text-xs text-text-muted">Manage active publishing accounts across Instagram, Facebook, Threads, and TikTok.</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setChannelsModalOpen(false);
                  setManualConnectPlatform(null);
                }}
                className="rounded-lg p-1.5 text-text-muted hover:bg-surface-2 hover:text-text-primary"
              >
                <Icon icon="solar:close-circle-linear" width="20" />
              </button>
            </div>

            {/* One-Click OAuth Banner */}
            <div className="mt-4 rounded-lg border border-brand/20 bg-brand/5 p-3 text-xs text-text-muted">
              <span className="font-bold text-text-primary">💡 One-Click OAuth Login:</span> Click the OAuth connect buttons below to authenticate directly via Meta (for Instagram & Facebook), Threads, or TikTok without needing to manually find access tokens.
            </div>

            {/* Platform Grid */}
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
              {/* Instagram */}
              <div className="flex flex-col justify-between rounded-lg border border-border bg-surface-2 p-4">
                <div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#E1306C]/10 text-[#E1306C]">
                        <Icon icon="simple-icons:instagram" width="18" />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-text-primary">Instagram</h4>
                        <p className="text-[11px] text-text-muted">Feed, Carousels & Reels</p>
                      </div>
                    </div>
                    <Pill tone={connections.platforms.instagram ? 'green' : 'amber'}>
                      {connections.platforms.instagram ? 'Connected' : 'Offline'}
                    </Pill>
                  </div>

                  <div className="mt-3 space-y-1 text-xs">
                    <div className="flex justify-between text-text-muted">
                      <span>Handle:</span>
                      <span className="font-mono font-bold text-text-primary">
                        {connections.platforms.instagram ? `@${connections.platforms.instagram.username}` : 'Not connected'}
                      </span>
                    </div>
                    {connections.platforms.instagram?.tokenExpiresAt && (
                      <div className="flex justify-between text-text-muted text-[11px]">
                        <span>Expires:</span>
                        <span>{new Date(connections.platforms.instagram.tokenExpiresAt).toLocaleDateString()}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border/50 pt-3">
                  {connections.platforms.instagram ? (
                    <button
                      type="button"
                      onClick={() => disconnectAccount('instagram')}
                      disabled={connections.connecting}
                      className="rounded border border-red-500/20 bg-red-500/10 px-2.5 py-1.5 text-xs font-bold text-red-500 hover:bg-red-500/20 disabled:opacity-50"
                    >
                      Disconnect
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={connectMeta}
                    disabled={connections.connecting}
                    className="rounded bg-[#E1306C] px-3 py-1.5 text-xs font-bold text-white hover:opacity-90 disabled:opacity-50"
                  >
                    ⚡ Connect via Meta
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setManualConnectPlatform('instagram');
                      setManualFormData({
                        username: connections.platforms.instagram?.username || 'muvidb_',
                        displayName: connections.platforms.instagram?.displayName || 'MuviDB Instagram',
                        externalAccountId: connections.platforms.instagram?.externalAccountId || 'muvidb_ig_id',
                        accessToken: '',
                      });
                    }}
                    className="rounded border border-border bg-surface px-2.5 py-1.5 text-[11px] font-bold text-text-muted hover:text-text-primary"
                  >
                    Token
                  </button>
                </div>
              </div>

              {/* Facebook */}
              <div className="flex flex-col justify-between rounded-lg border border-border bg-surface-2 p-4">
                <div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#1877F2]/10 text-[#1877F2]">
                        <Icon icon="simple-icons:facebook" width="18" />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-text-primary">Facebook</h4>
                        <p className="text-[11px] text-text-muted">Pages & Community Feed</p>
                      </div>
                    </div>
                    <Pill tone={connections.platforms.facebook ? 'green' : 'amber'}>
                      {connections.platforms.facebook ? 'Connected' : 'Offline'}
                    </Pill>
                  </div>

                  <div className="mt-3 space-y-1 text-xs">
                    <div className="flex justify-between text-text-muted">
                      <span>Page:</span>
                      <span className="font-mono font-bold text-text-primary">
                        {connections.platforms.facebook ? (connections.platforms.facebook.displayName || connections.platforms.facebook.username) : 'Not connected'}
                      </span>
                    </div>
                    {connections.platforms.facebook?.tokenExpiresAt && (
                      <div className="flex justify-between text-text-muted text-[11px]">
                        <span>Expires:</span>
                        <span>{new Date(connections.platforms.facebook.tokenExpiresAt).toLocaleDateString()}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border/50 pt-3">
                  {connections.platforms.facebook ? (
                    <button
                      type="button"
                      onClick={() => disconnectAccount('facebook')}
                      disabled={connections.connecting}
                      className="rounded border border-red-500/20 bg-red-500/10 px-2.5 py-1.5 text-xs font-bold text-red-500 hover:bg-red-500/20 disabled:opacity-50"
                    >
                      Disconnect
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={connectMeta}
                    disabled={connections.connecting}
                    className="rounded bg-[#1877F2] px-3 py-1.5 text-xs font-bold text-white hover:opacity-90 disabled:opacity-50"
                  >
                    ⚡ Connect via Meta
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setManualConnectPlatform('facebook');
                      setManualFormData({
                        username: connections.platforms.facebook?.username || 'muvidb',
                        displayName: connections.platforms.facebook?.displayName || 'MuviDB Page',
                        externalAccountId: connections.platforms.facebook?.externalAccountId || 'muvidb_fb_page_id',
                        accessToken: '',
                      });
                    }}
                    className="rounded border border-border bg-surface px-2.5 py-1.5 text-[11px] font-bold text-text-muted hover:text-text-primary"
                  >
                    Token
                  </button>
                </div>
              </div>

              {/* Threads */}
              <div className="flex flex-col justify-between rounded-lg border border-border bg-surface-2 p-4">
                <div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-text-primary/10 text-text-primary">
                        <Icon icon="simple-icons:threads" width="18" />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-text-primary">Threads</h4>
                        <p className="text-[11px] text-text-muted">Meta Threads API</p>
                      </div>
                    </div>
                    <Pill tone={connections.platforms.threads ? 'green' : 'amber'}>
                      {connections.platforms.threads ? 'Connected' : 'Offline'}
                    </Pill>
                  </div>

                  <div className="mt-3 space-y-1 text-xs">
                    <div className="flex justify-between text-text-muted">
                      <span>Account:</span>
                      <span className="font-mono font-bold text-text-primary">
                        {connections.platforms.threads ? `@${connections.platforms.threads.username}` : 'Not connected'}
                      </span>
                    </div>
                    {connections.platforms.threads?.tokenExpiresAt && (
                      <div className="flex justify-between text-text-muted text-[11px]">
                        <span>Expires:</span>
                        <span>{new Date(connections.platforms.threads.tokenExpiresAt).toLocaleDateString()}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border/50 pt-3">
                  {connections.platforms.threads ? (
                    <button
                      type="button"
                      onClick={() => disconnectAccount('threads')}
                      disabled={connections.connecting}
                      className="rounded border border-red-500/20 bg-red-500/10 px-2.5 py-1.5 text-xs font-bold text-red-500 hover:bg-red-500/20 disabled:opacity-50"
                    >
                      Disconnect
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={connectThreads}
                    disabled={connections.connecting}
                    className="rounded bg-text-primary px-3 py-1.5 text-xs font-bold text-background hover:opacity-90 disabled:opacity-50"
                  >
                    <span className="flex items-center gap-1">
                      <Icon icon="simple-icons:threads" width="12" />
                      {connections.platforms.threads ? 'Reconnect OAuth' : 'Connect via Meta OAuth'}
                    </span>
                  </button>
                </div>
              </div>

              {/* TikTok */}
              <div className="flex flex-col justify-between rounded-lg border border-border bg-surface-2 p-4">
                <div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-black text-[#25F4EE] border border-border">
                        <Icon icon="simple-icons:tiktok" width="18" />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-text-primary">TikTok</h4>
                        <p className="text-[11px] text-text-muted">Vertical Shorts & Clips</p>
                      </div>
                    </div>
                    <Pill tone={connections.platforms.tiktok ? 'green' : 'amber'}>
                      {connections.platforms.tiktok ? 'Connected' : 'Offline'}
                    </Pill>
                  </div>

                  <div className="mt-3 space-y-1 text-xs">
                    <div className="flex justify-between text-text-muted">
                      <span>Account:</span>
                      <span className="font-mono font-bold text-text-primary">
                        {connections.platforms.tiktok ? `@${connections.platforms.tiktok.username}` : 'Not connected'}
                      </span>
                    </div>
                    {connections.platforms.tiktok?.tokenExpiresAt && (
                      <div className="flex justify-between text-text-muted text-[11px]">
                        <span>Expires:</span>
                        <span>{new Date(connections.platforms.tiktok.tokenExpiresAt).toLocaleDateString()}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border/50 pt-3">
                  {connections.platforms.tiktok ? (
                    <button
                      type="button"
                      onClick={() => disconnectAccount('tiktok')}
                      disabled={connections.connecting}
                      className="rounded border border-red-500/20 bg-red-500/10 px-2.5 py-1.5 text-xs font-bold text-red-500 hover:bg-red-500/20 disabled:opacity-50"
                    >
                      Disconnect
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={connectTikTok}
                    disabled={connections.connecting}
                    className="rounded bg-black border border-[#25F4EE]/40 text-[#25F4EE] px-3 py-1.5 text-xs font-bold hover:bg-surface-3 disabled:opacity-50"
                  >
                    ⚡ Connect via TikTok
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setManualConnectPlatform('tiktok');
                      setManualFormData({
                        username: connections.platforms.tiktok?.username || 'muvidb',
                        displayName: connections.platforms.tiktok?.displayName || 'MuviDB TikTok',
                        externalAccountId: connections.platforms.tiktok?.externalAccountId || 'muvidb_tiktok_id',
                        accessToken: '',
                      });
                    }}
                    className="rounded border border-border bg-surface px-2.5 py-1.5 text-[11px] font-bold text-text-muted hover:text-text-primary"
                  >
                    Token
                  </button>
                </div>
              </div>
            </div>

            {/* Manual / Direct Token Connection Form */}
            {manualConnectPlatform && (
              <form onSubmit={saveManualConnection} className="mt-6 rounded-lg border border-brand/30 bg-surface-2 p-5">
                <div className="flex items-center justify-between border-b border-border/60 pb-3">
                  <div>
                    <h4 className="text-sm font-bold text-brand uppercase tracking-wider">
                      Configure {manualConnectPlatform.toUpperCase()} Connection
                    </h4>
                    <p className="text-[11px] text-text-muted">Enter your exact handle and API token to link this channel.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setManualConnectPlatform(null)}
                    className="text-xs text-text-muted hover:text-text-primary"
                  >
                    Cancel
                  </button>
                </div>

                <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="block text-[11px] font-bold text-text-muted uppercase">
                      {manualConnectPlatform === 'instagram' ? 'Instagram Handle' : manualConnectPlatform === 'facebook' ? 'Facebook Page Handle' : 'Account Handle'}
                    </label>
                    <input
                      type="text"
                      required
                      value={manualFormData.username}
                      onChange={e => setManualFormData(prev => ({ ...prev, username: e.target.value }))}
                      placeholder={manualConnectPlatform === 'instagram' ? 'muvidb_' : 'muvidb'}
                      className="mt-1 h-9 w-full rounded border border-border bg-surface px-3 text-xs text-text-primary outline-none focus:border-brand"
                    />
                    <p className="mt-0.5 text-[10px] text-text-muted">
                      {manualConnectPlatform === 'instagram' ? 'e.g. muvidb_ (without leading @)' : 'e.g. muvidb'}
                    </p>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-text-muted uppercase">Display Name</label>
                    <input
                      type="text"
                      value={manualFormData.displayName}
                      onChange={e => setManualFormData(prev => ({ ...prev, displayName: e.target.value }))}
                      placeholder="MuviDB Official"
                      className="mt-1 h-9 w-full rounded border border-border bg-surface px-3 text-xs text-text-primary outline-none focus:border-brand"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-[11px] font-bold text-text-muted uppercase">API Access Token</label>
                    <input
                      type="password"
                      required
                      value={manualFormData.accessToken}
                      onChange={e => setManualFormData(prev => ({ ...prev, accessToken: e.target.value }))}
                      placeholder="Paste API Access Token"
                      className="mt-1 h-9 w-full rounded border border-border bg-surface px-3 text-xs text-text-primary outline-none focus:border-brand font-mono"
                    />
                    <p className="mt-1 text-[10px] text-text-muted">
                      All tokens are securely encrypted with AES-256-GCM prior to storage in database.
                    </p>
                  </div>
                </div>

                <div className="mt-4 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setManualConnectPlatform(null)}
                    className="rounded border border-border px-3 py-1.5 text-xs font-bold text-text-muted hover:text-text-primary"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={connections.connecting}
                    className="rounded bg-brand px-4 py-1.5 text-xs font-bold text-white hover:bg-brand-hover disabled:opacity-50"
                  >
                    {connections.connecting ? 'Saving…' : `Save ${manualConnectPlatform} Connection`}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Auto-Pilot 1-Click Review & Approve Modal */}
      <AutoPilotReviewModal
        isOpen={!!selectedSlotForReview}
        slot={selectedSlotForReview}
        onClose={() => setSelectedSlotForReview(null)}
        onApproved={refreshAll}
        onOpenManualComposer={(ctx) => {
          setSlotContext(ctx);
          setSelectedThemeId(ctx.seriesSlug || 'actor_spotlight');
          setActiveTab('composer');
        }}
      />
    </div>
  );
}
