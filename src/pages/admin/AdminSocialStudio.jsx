import { useEffect, useMemo, useRef, useState } from 'react';
import { Icon } from '@iconify/react';
import toast from 'react-hot-toast';
import { useSearchParams } from 'react-router-dom';
import { authHeaders } from '../../lib/apiAuth';
import { supabase } from '../../lib/supabase';
import { uploadAdminSocialMedia } from '../../lib/imageUpload';
import SocialDraftComposer, { EDITORIAL_THEMES } from '../../components/admin/SocialDraftComposer';
import AutoPilotReviewModal from '../../components/admin/AutoPilotReviewModal';
import SocialIntakeInbox from '../../components/admin/SocialIntakeInbox';
import FilmSearchCombobox from '../../components/admin/FilmSearchCombobox';

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

const AVAILABLE_ASPECT_RATIOS = [
  { id: '9:16', label: '9:16', subtitle: 'Reels / TikTok' },
  { id: '1:1', label: '1:1', subtitle: 'Square Feed' },
  { id: '4:5', label: '4:5', subtitle: 'Portrait' },
  { id: '16:9', label: '16:9', subtitle: 'Landscape' },
];

function parseTimestampToSeconds(value) {
  if (value === null || value === undefined || value === '') return 0;
  if (typeof value === 'number') return isNaN(value) ? 0 : Math.max(0, Math.floor(value));
  
  const str = String(value).trim();
  if (!str) return 0;

  if (/^\d+(\.\d+)?$/.test(str)) {
    return Math.max(0, Math.floor(Number(str)));
  }

  const parts = str.split(':').map(p => Number(p.trim()));
  if (parts.some(p => isNaN(p))) return 0;

  if (parts.length === 3) {
    const [hours, minutes, seconds] = parts;
    return Math.max(0, Math.floor(hours * 3600 + minutes * 60 + seconds));
  }
  if (parts.length === 2) {
    const [minutes, seconds] = parts;
    return Math.max(0, Math.floor(minutes * 60 + seconds));
  }
  if (parts.length === 1) {
    return Math.max(0, Math.floor(parts[0]));
  }
  return 0;
}

function formatSecondsToTimestamp(totalSeconds) {
  if (typeof totalSeconds === 'string' && totalSeconds.includes(':')) {
    return totalSeconds;
  }
  const sec = typeof totalSeconds === 'number' ? totalSeconds : parseTimestampToSeconds(totalSeconds);
  if (isNaN(sec) || sec <= 0) return '00:00';

  const s = Math.floor(sec);
  const hours = Math.floor(s / 3600);
  const minutes = Math.floor((s % 3600) / 60);
  const seconds = s % 60;

  const pad = n => (n < 10 ? `0${n}` : `${n}`);

  if (hours > 0) {
    return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  }
  return `${pad(minutes)}:${pad(seconds)}`;
}

function getDimensionsForAspectRatio(aspectRatio) {
  switch (aspectRatio) {
    case '9:16':
      return { width: 540, height: 960 };
    case '4:5':
      return { width: 720, height: 900 };
    case '16:9':
      return { width: 960, height: 540 };
    case '1:1':
    default:
      return { width: 720, height: 720 };
  }
}

function sortAndFilterFilmsForVideoAutopilot(rawFilms = [], usedFilmIds = new Set(), usedFilmTitles = new Set()) {
  const currentYear = new Date().getFullYear(); // e.g. 2026
  const now = Date.now();
  const FORTY_EIGHT_HOURS = 48 * 60 * 60 * 1000;

  const isVideoSource = value => {
    if (!value) return false;
    try {
      const parsed = new URL(value);
      return /youtube\.com|youtu\.be|\.mp4(?:$|\?)|\.webm(?:$|\?)|\.mov(?:$|\?)/i.test(parsed.hostname + parsed.pathname + parsed.search);
    } catch { return false; }
  };

  const processed = (rawFilms || []).map(f => {
    const sourceUrl = f.youtube_watch_url || (f.trailer_youtube_id ? `https://www.youtube.com/watch?v=${f.trailer_youtube_id}` : f.trailer_external_url);
    const releaseTime = f.release_date ? new Date(f.release_date).getTime() : 0;
    const createdTime = f.created_at ? new Date(f.created_at).getTime() : 0;
    
    let year = f.year ? Number(f.year) : 0;
    if (!year && f.release_date) {
      const d = new Date(f.release_date);
      if (!isNaN(d.getFullYear())) year = d.getFullYear();
    }

    const cleanTitle = (f.title || '').toLowerCase().trim();
    const isUsed = usedFilmIds.has(f.id) || (cleanTitle && usedFilmTitles.has(cleanTitle));
    
    // Breaking / ultra fresh: released in past 48h (hours ago / yesterday / today) or uploaded in past 48h for current year
    const isReleasedRecently = releaseTime > 0 && (now - releaseTime) >= -86400000 && (now - releaseTime) <= FORTY_EIGHT_HOURS;
    const isUploadedRecently = createdTime > 0 && (now - createdTime) <= FORTY_EIGHT_HOURS && (year >= currentYear - 1);
    const isUltraFresh = isReleasedRecently || isUploadedRecently;

    return {
      ...f,
      sourceUrl,
      isUsed,
      isUltraFresh,
      releaseTime,
      createdTime,
      year: year || 0,
    };
  }).filter(f => isVideoSource(f.sourceUrl));

  if (!processed.length) return [];

  // Deterministic sort:
  // 1. Unused before used
  // 2. Ultra fresh (breaking / released today/yesterday) at the absolute top
  // 3. Year DESC (2026 films before 2025 before 2024...)
  // 4. Release Date DESC (Month/Day latest first within year)
  // 5. Uploaded/Created Time DESC
  return [...processed].sort((a, b) => {
    // Unused before used
    if (!a.isUsed && b.isUsed) return -1;
    if (a.isUsed && !b.isUsed) return 1;

    // Ultra fresh (breaking / released hours ago or yesterday) takes absolute top priority
    if (a.isUltraFresh && !b.isUltraFresh) return -1;
    if (!a.isUltraFresh && b.isUltraFresh) return 1;

    // Year descending: 2026 > 2025 > 2024
    if ((a.year || 0) !== (b.year || 0)) {
      return (b.year || 0) - (a.year || 0);
    }

    // By release date: latest month and date first (e.g. Sept 2026 > Aug 2026 > Jan 2026)
    if (a.releaseTime !== b.releaseTime) {
      return b.releaseTime - a.releaseTime;
    }

    // Secondary sort: most recent upload to DB (created_at DESC)
    return b.createdTime - a.createdTime;
  });
}

function getRowAspectRatios(row) {
  if (Array.isArray(row?.aspectRatios) && row.aspectRatios.length > 0) {
    return row.aspectRatios;
  }
  if (row?.aspectRatio) {
    return [row.aspectRatio];
  }
  return ['9:16', '1:1'];
}

function Metric({ label, value, icon, tone = 'brand' }) {
  const tones = {
    brand: 'bg-brand/10 text-brand border-brand/20',
    green: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    amber: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    red: 'bg-red-500/10 text-red-400 border-red-500/20',
    blue: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  };

  return (
    <div className="relative overflow-hidden rounded-xl border border-white/10 bg-surface/90 p-4 shadow-sm backdrop-blur transition-all hover:border-white/20 hover:bg-surface">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-wider text-text-muted">{label}</p>
          <p className="mt-1 text-2xl font-black tracking-tight text-text-primary">{value}</p>
        </div>
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${tones[tone] || tones.brand}`}>
          <Icon icon={icon} width="20" />
        </div>
      </div>
    </div>
  );
}

function Pill({ children, tone = 'brand' }) {
  const tones = {
    brand: 'border-brand/30 bg-brand/10 text-brand',
    green: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400',
    amber: 'border-amber-500/30 bg-amber-500/10 text-amber-400',
    red: 'border-red-500/30 bg-red-500/10 text-red-400',
    blue: 'border-blue-500/30 bg-blue-500/10 text-blue-400',
    neutral: 'border-white/10 bg-white/5 text-text-secondary',
  };

  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider ${tones[tone] || tones.brand}`}>
      {children}
    </span>
  );
}

function asRelationArray(value) {
  if (Array.isArray(value)) return value.filter(Boolean);
  if (value && typeof value === 'object') return [value];
  return [];
}

function extractYouTubeId(url) {
  if (!url || typeof url !== 'string') return null;
  if (url.includes('youtube.com/embed/')) {
    return url.split('youtube.com/embed/')[1]?.split('?')[0];
  }
  if (url.includes('youtube.com/watch')) {
    try {
      return new URL(url).searchParams.get('v');
    } catch {
      return null;
    }
  }
  if (url.includes('youtu.be/')) {
    return url.split('youtu.be/')[1]?.split('?')[0];
  }
  return null;
}

function SocialAssetThumbnail({ asset }) {
  const [loadFailed, setLoadFailed] = useState(false);
  if (!asset?.public_url || loadFailed) {
    return (
      <div className="flex h-28 w-28 shrink-0 items-center justify-center rounded-xl border border-dashed border-white/10 bg-surface-2 text-text-muted">
        <Icon icon="solar:gallery-linear" width="28" />
      </div>
    );
  }

  const publicUrl = asset.public_url;
  const ytId = extractYouTubeId(publicUrl);
  const isDirectVideo = !ytId && (
    Boolean(asset.format?.toLowerCase().includes('video')) ||
    /\.(mp4|webm|mov|m4v)(\?.*)?$/i.test(publicUrl)
  );

  const formatLabel = {
    video_vertical_9_16: '9:16 Video',
    custom_video: 'Video',
    custom_design: 'Custom',
    square_1_1: '1:1 Square',
    portrait_4_5: '4:5 Portrait',
    carousel: 'Carousel',
  }[asset.format] || (asset.format ? asset.format.replace(/_/g, ' ') : 'Media');

  if (ytId) {
    return (
      <div className="relative group h-28 w-28 shrink-0 overflow-hidden rounded-xl border border-white/10 bg-surface-2 shadow-sm">
        <img
          src={`https://img.youtube.com/vi/${ytId}/hqdefault.jpg`}
          alt=""
          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          onError={() => setLoadFailed(true)}
        />
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/40 group-hover:bg-black/20 transition-all">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-red-600 text-[10px] text-white shadow-lg">
            ▶
          </span>
        </div>
        <span className="absolute bottom-1.5 right-1.5 rounded-md bg-black/80 backdrop-blur px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wider text-white">
          YouTube
        </span>
      </div>
    );
  }

  if (isDirectVideo) {
    return (
      <div className="relative group h-28 w-28 shrink-0 overflow-hidden rounded-xl border border-white/10 bg-surface-2 shadow-sm">
        <video
          src={publicUrl}
          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          muted
          playsInline
          preload="metadata"
          onError={() => setLoadFailed(true)}
          onMouseEnter={(e) => { try { e.target.play(); } catch {} }}
          onMouseLeave={(e) => { try { e.target.pause(); e.target.currentTime = 0; } catch {} }}
        />
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/30 group-hover:opacity-0 transition-opacity">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-black/70 backdrop-blur text-[10px] text-white shadow-lg">
            ▶
          </span>
        </div>
        <span className="absolute bottom-1.5 right-1.5 rounded-md bg-black/80 backdrop-blur px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wider text-white">
          {formatLabel}
        </span>
      </div>
    );
  }

  return (
    <div className="relative group h-28 w-28 shrink-0 overflow-hidden rounded-xl border border-white/10 bg-surface-2 shadow-sm">
      <img
        src={publicUrl}
        alt=""
        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
        onError={() => setLoadFailed(true)}
      />
      <span className="absolute bottom-1.5 right-1.5 rounded-md bg-black/80 backdrop-blur px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wider text-white">
        {formatLabel}
      </span>
    </div>
  );
}

function getPlatformOptions(value) {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value;
  if (typeof value !== 'string') return {};

  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function normalizeSocialContentItem(item) {
  return {
    ...item,
    social_platform_variants: asRelationArray(item?.social_platform_variants).map(variant => ({
      ...variant,
      platform_options: getPlatformOptions(variant?.platform_options),
    })),
    social_assets: asRelationArray(item?.social_assets),
  };
}

const VIDEO_COPY_ANGLES = [
  { value: 'editorial', label: '🎬 Editorial & Critique' },
  { value: 'high_drama', label: '🔥 High Drama' },
  { value: 'audience_debate', label: '🗣️ Audience Debate' },
  { value: 'streaming_alert', label: '🍿 Streaming Alert' },
  { value: 'discovery', label: '🔎 Discovery' },
];

export default function AdminSocialStudio() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState(() => searchParams.get('tab') === 'intake' ? 'intake' : 'calendar'); // 'calendar' | 'drafts' | 'composer' | 'intake' | 'channels' | 'video_plan'
  const [calendarViewMode, setCalendarViewMode] = useState('month'); // 'month' | 'cards'
  const [selectedSlotForReview, setSelectedSlotForReview] = useState(null);
  const [summary, setSummary] = useState(emptySummary);
  const [loading, setLoading] = useState(true);
  const [publishing, setPublishing] = useState(false);
  const [drafts, setDrafts] = useState([]);
  const [draftsLoading, setDraftsLoading] = useState(false);
  const [draftsError, setDraftsError] = useState('');
  const [reviewingId, setReviewingId] = useState(null);
  const [scheduleAt, setScheduleAt] = useState({});
  const [expandedCaptions, setExpandedCaptions] = useState({});
  const [editingDraft, setEditingDraft] = useState(null);
  const [editingQueueItem, setEditingQueueItem] = useState(null);
  const [queueEditTitle, setQueueEditTitle] = useState('');
  const [queueEditCaptions, setQueueEditCaptions] = useState({});
  const [savingQueueEdit, setSavingQueueEdit] = useState(false);
  const [queueFilterStatus, setQueueFilterStatus] = useState('all');
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
  const [videoAutopilot, setVideoAutopilot] = useState({ running: false, message: '', jobs: [] });
  const [videoPlan, setVideoPlan] = useState({
    days: 7,
    startDate: new Date().toISOString().slice(0, 10),
    slot1Time: '12:00',
    slot2Time: '16:00',
    slot3Time: '20:00',
    clipLength: 30,
  });
  const [videoRows, setVideoRows] = useState([
    { id: crypto.randomUUID(), date: new Date().toISOString().slice(0, 10), time: '12:00', aspectRatios: ['9:16', '1:1'], filmId: '', mode: 'gemini', start: '01:30', end: '02:00', caption: '', engine: 'gemini', angle: 'editorial', variations: [], selectedVariationKey: 'B' },
    { id: crypto.randomUUID(), date: new Date().toISOString().slice(0, 10), time: '16:00', aspectRatios: ['9:16', '1:1'], filmId: '', mode: 'gemini', start: '01:30', end: '02:00', caption: '', engine: 'gemini', angle: 'editorial', variations: [], selectedVariationKey: 'B' },
    { id: crypto.randomUUID(), date: new Date().toISOString().slice(0, 10), time: '20:00', aspectRatios: ['9:16', '1:1'], filmId: '', mode: 'gemini', start: '01:30', end: '02:00', caption: '', engine: 'gemini', angle: 'editorial', variations: [], selectedVariationKey: 'B' },
  ]);
  const [videoFilmOptions, setVideoFilmOptions] = useState([]);
  const [videoFilmSearch, setVideoFilmSearch] = useState({});
  const [clipperStatus, setClipperStatus] = useState('checking');
  const [calendarStartDate, setCalendarStartDate] = useState(getTomorrowDateStr());
  const [postsPerDay, setPostsPerDay] = useState(1);
  const [shuffleOffset, setShuffleOffset] = useState(0);

  // Month navigation for Month View
  const [currentCalendarMonth, setCurrentCalendarMonth] = useState(() => new Date());

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

  const connectMeta = async () => {
    setConnections(prev => ({ ...prev, connecting: true }));
    try {
      const res = await fetch('/api/social?task=meta_oauth_start', {
        method: 'POST',
        headers: await authHeaders(),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      if (data.authorizationUrl) {
        window.location.href = data.authorizationUrl;
      } else {
        throw new Error('No authorization URL received from Meta');
      }
    } catch (err) {
      toast.error(err.message || 'Failed to initiate Meta connection');
      setConnections(prev => ({ ...prev, connecting: false }));
    }
  };

  const connectThreads = async () => {
    setConnections(prev => ({ ...prev, connecting: true }));
    try {
      const res = await fetch('/api/social?task=threads_oauth_start', {
        method: 'POST',
        headers: await authHeaders(),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      if (data.authorizationUrl) {
        window.location.href = data.authorizationUrl;
      } else {
        throw new Error('No authorization URL received from Threads');
      }
    } catch (err) {
      toast.error(err.message || 'Failed to initiate Threads connection');
      setConnections(prev => ({ ...prev, connecting: false }));
    }
  };

  const connectTikTok = async () => {
    setConnections(prev => ({ ...prev, connecting: true }));
    try {
      const res = await fetch('/api/social?task=tiktok_oauth_start', {
        method: 'POST',
        headers: await authHeaders(),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      if (data.authorizationUrl) {
        window.location.href = data.authorizationUrl;
      } else {
        throw new Error('No authorization URL received from TikTok');
      }
    } catch (err) {
      toast.error(err.message || 'Failed to initiate TikTok connection');
      setConnections(prev => ({ ...prev, connecting: false }));
    }
  };

  const disconnectAccount = async (platform) => {
    const confirmed = window.confirm(`Disconnect MuviDB ${platform}? This will stop automated posts to ${platform}.`);
    if (!confirmed) return;

    setConnections(prev => ({ ...prev, connecting: true }));
    try {
      const res = await fetch('/api/social?task=disconnect_platform', {
        method: 'POST',
        headers: { ...(await authHeaders()), 'Content-Type': 'application/json' },
        body: JSON.stringify({ platform }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      toast.success(`Disconnected ${platform}`);
      await fetchConnectionsStatus();
    } catch (err) {
      toast.error(err.message || `Failed to disconnect ${platform}`);
    } finally {
      setConnections(prev => ({ ...prev, connecting: false }));
    }
  };

  const saveManualConnection = async (e) => {
    e.preventDefault();
    if (!manualConnectPlatform || !manualFormData.accessToken.trim()) {
      toast.error('Please provide a valid access token');
      return;
    }

    setConnections(prev => ({ ...prev, connecting: true }));
    try {
      const res = await fetch('/api/social?task=save_connection', {
        method: 'POST',
        headers: { ...(await authHeaders()), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          platform: manualConnectPlatform,
          username: manualFormData.username.trim(),
          displayName: manualFormData.displayName.trim() || manualFormData.username.trim(),
          externalAccountId: manualFormData.externalAccountId.trim() || manualFormData.username.trim(),
          accessToken: manualFormData.accessToken.trim(),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      toast.success(`Successfully saved ${manualConnectPlatform} connection!`);
      setManualConnectPlatform(null);
      setManualFormData({ username: '', displayName: '', externalAccountId: '', accessToken: '' });
      await fetchConnectionsStatus();
    } catch (err) {
      toast.error(err.message || `Failed to save ${manualConnectPlatform} token`);
    } finally {
      setConnections(prev => ({ ...prev, connecting: false }));
    }
  };

  const fetchDrafts = async (silent = false) => {
    if (!silent) setDraftsLoading(true);
    setDraftsError('');
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
          social_platform_variants(id,platform,status,caption,title,hashtags,selected_asset_id,platform_options,scheduled_for,published_at,last_error_code,last_error_message),
          social_assets(id,public_url,format,width,height)
        `)
        .order('created_at', { ascending: false })
        .limit(30);

      if (error) throw error;
      setDrafts(asRelationArray(data).map(normalizeSocialContentItem));
    } catch (err) {
      console.warn('Failed to load social drafts:', err.message);
      setDraftsError('We could not load your drafts and scheduled posts right now. Please try again.');
    } finally {
      if (!silent) setDraftsLoading(false);
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

  useEffect(() => {
    let cancelled = false;
    const checkClipper = async () => {
      try { const response = await fetch('http://127.0.0.1:4317/health'); if (!cancelled) setClipperStatus(response.ok ? 'running' : 'offline'); }
      catch { if (!cancelled) setClipperStatus('offline'); }
    };
    checkClipper();
    const timer = window.setInterval(checkClipper, 5000);
    return () => { cancelled = true; window.clearInterval(timer); };
  }, []);

  useEffect(() => {
    if (activeTab !== 'calendar' && activeTab !== 'video_plan') return undefined;
    let cancelled = false;
    Promise.all([
      supabase.from('films')
        .select('id,title,release_date,year,created_at,synopsis,genres,trailer_youtube_id,trailer_external_url,youtube_watch_url')
        .or('trailer_youtube_id.not.is.null,trailer_external_url.not.is.null,youtube_watch_url.not.is.null')
        .order('release_date', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false })
        .limit(1000),
      supabase.from('social_content_items')
        .select('id,title,source_entity_id,source_snapshot')
        .limit(1000)
    ]).then(([{ data: filmsData }, { data: socialData }]) => {
      if (cancelled) return;
      const usedIds = new Set();
      const usedTitles = new Set();
      (socialData || []).forEach(item => {
        if (item.source_entity_id) usedIds.add(item.source_entity_id);
        if (item.source_snapshot?.film_id) usedIds.add(item.source_snapshot.film_id);
        if (item.source_snapshot?.filmId) usedIds.add(item.source_snapshot.filmId);
        if (item.source_snapshot?.id) usedIds.add(item.source_snapshot.id);
        if (item.source_snapshot?.title) usedTitles.add(String(item.source_snapshot.title).toLowerCase().trim());
        if (item.title) {
          const cleanTitle = item.title.split('—')[0].split('-')[0].trim().toLowerCase();
          if (cleanTitle) usedTitles.add(cleanTitle);
        }
      });
      const sorted = sortAndFilterFilmsForVideoAutopilot(filmsData || [], usedIds, usedTitles);
      setVideoFilmOptions(sorted);
    }).catch(err => {
      console.warn('Failed to load video film options:', err);
    });
    return () => { cancelled = true; };
  }, [activeTab]);

  const launchDesktopClipper = () => {
    const link = document.createElement('a');
    link.href = 'muvidb-clipper://start';
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    link.remove();
    toast.success('Launching the desktop clipper in a separate window…');
  };

  const runDailyVideoAutopilot = async () => {
    if (videoAutopilot.running) return;
    setVideoAutopilot({ running: true, message: 'Selecting the newest eligible film…', jobs: [] });
    try {
      let eligibleFilms = videoFilmOptions;
      if (!eligibleFilms.length) {
        const [{ data: films }, { data: socialData }] = await Promise.all([
          supabase.from('films')
            .select('id,title,synopsis,genres,trailer_youtube_id,trailer_external_url,youtube_watch_url,release_date,year,created_at')
            .or('trailer_youtube_id.not.is.null,trailer_external_url.not.is.null,youtube_watch_url.not.is.null')
            .order('release_date', { ascending: false, nullsFirst: false })
            .order('created_at', { ascending: false }).limit(1000),
          supabase.from('social_content_items')
            .select('id,title,source_entity_id,source_snapshot').limit(1000)
        ]);
        const usedIds = new Set();
        const usedTitles = new Set();
        (socialData || []).forEach(item => {
          if (item.source_entity_id) usedIds.add(item.source_entity_id);
          if (item.source_snapshot?.film_id) usedIds.add(item.source_snapshot.film_id);
          if (item.source_snapshot?.filmId) usedIds.add(item.source_snapshot.filmId);
          if (item.source_snapshot?.id) usedIds.add(item.source_snapshot.id);
          if (item.source_snapshot?.title) usedTitles.add(String(item.source_snapshot.title).toLowerCase().trim());
          if (item.title) {
            const cleanTitle = item.title.split('—')[0].split('-')[0].trim().toLowerCase();
            if (cleanTitle) usedTitles.add(cleanTitle);
          }
        });
        eligibleFilms = sortAndFilterFilmsForVideoAutopilot(films || [], usedIds, usedTitles);
      }
      const film = eligibleFilms[0];
      if (!film) throw new Error('No recently added film with a usable video source was found.');
      const sourceUrl = film.sourceUrl;
      setVideoAutopilot(prev => ({ ...prev, message: `Gemini is choosing the strongest viral scene from ${film.title}…` }));
      let sourceMetadata = { title: film.title, duration: 3600, transcript: '', description: '', synopsis: film.synopsis || '', genre: Array.isArray(film.genres) ? film.genres.join(', ') : (film.genres || '') };
      try {
        const metadataResponse = await fetch('http://127.0.0.1:4317/metadata', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url: sourceUrl }) });
        if (metadataResponse.ok) sourceMetadata = { ...sourceMetadata, ...(await metadataResponse.json()) };
      } catch { /* Gemini safe fallback */ }
      const recommendationResponse = await fetch('/api/ai', { method: 'POST', headers: { ...(await authHeaders()), 'Content-Type': 'application/json' }, body: JSON.stringify({ task: 'recommend_clip_segment', data: { ...sourceMetadata, duration: Math.max(1, Number(sourceMetadata.duration) || 3600), targetLength: videoPlan.clipLength || 45 } }) });
      const recommendation = await recommendationResponse.json().catch(() => ({}));
      if (!recommendationResponse.ok) throw new Error(recommendation.error || 'Gemini could not recommend a clip.');
      const safeStart = Math.max(0, parseTimestampToSeconds(recommendation.startTime ?? recommendation.startTimeFormatted));
      const safeEnd = Math.min(Math.max(safeStart + 1, parseTimestampToSeconds(recommendation.endTime ?? recommendation.endTimeFormatted) || safeStart + (videoPlan.clipLength || 45)), Number(sourceMetadata.duration) || safeStart + (videoPlan.clipLength || 45));
      const clips = ['9:16', '1:1'].map(aspect_ratio => ({ url: sourceUrl, start_time: safeStart, end_time: safeEnd, aspect_ratio, fit_mode: 'cover', title: film.title }));
      const batchResponse = await fetch('http://127.0.0.1:4317/batch', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ clips }) });
      const batch = await batchResponse.json().catch(() => ({}));
      if (!batchResponse.ok) throw new Error(batch.detail || 'The local clipper could not queue the video batch.');
      setVideoAutopilot(prev => ({ ...prev, message: 'Rendering 9:16 and 1:1 videos locally…', jobs: batch.jobs || [] }));
      const completed = [];
      for (const job of batch.jobs || []) {
        let status;
        for (;;) {
          await new Promise(resolve => setTimeout(resolve, 1500));
          const response = await fetch(job.status_url);
          status = await response.json().catch(() => ({}));
          if (!response.ok) throw new Error(status.detail || 'A local video render failed.');
          if (status.success) break;
          setVideoAutopilot(prev => ({ ...prev, message: `Rendering ${status.result?.aspect_ratio || 'video'}… ${status.progress || 0}%` }));
        }
        const sessionResponse = await fetch('/api/social?task=create_r2_upload_session', { method: 'POST', headers: { ...(await authHeaders()), 'Content-Type': 'application/json' }, body: JSON.stringify({ fileName: status.file_name, mimeType: 'video/mp4', fileSize: status.size_bytes || 1024 }) });
        const session = await sessionResponse.json().catch(() => ({}));
        if (!sessionResponse.ok) throw new Error(session.error || 'Could not prepare video storage.');

        let uploadSuccessful = false;
        try {
          const directUploadRes = await fetch('http://127.0.0.1:4317/upload', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token: job.job_id, upload_url: session.uploadUrl, content_type: 'video/mp4' }),
          });
          if (directUploadRes.ok) {
            uploadSuccessful = true;
          }
        } catch {
          // fallback to browser fetch
        }

        if (!uploadSuccessful) {
          try {
            const blob = await (await fetch(status.download_url)).blob();
            const uploadResponse = await fetch(session.uploadUrl, { method: 'PUT', headers: { 'Content-Type': 'video/mp4' }, body: blob });
            if (!uploadResponse.ok) throw new Error('Could not upload the rendered video.');
          } catch (err) {
            throw new Error('Clipper download blocked by browser. Please restart your local clipper script to apply the CORS patch.');
          }
        }
        completed.push({ ...status, public_url: session.publicUrl, r2_key: session.key });
      }
      if (completed.length > 0) {
        const primaryAsset = completed[0];
        const dims = getDimensionsForAspectRatio(primaryAsset.aspect_ratio);
        await fetch('/api/social?task=create_editor_video_draft', {
          method: 'POST',
          headers: { ...(await authHeaders()), 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: `${film.title} — Highlight Clip`,
            publicUrl: primaryAsset.public_url,
            storagePath: primaryAsset.r2_key,
            mimeType: 'video/mp4',
            format: primaryAsset.aspect_ratio,
            fileSizeBytes: primaryAsset.size_bytes,
            width: dims.width,
            height: dims.height,
            assets: completed.map(asset => {
              const d = getDimensionsForAspectRatio(asset.aspect_ratio);
              return {
                publicUrl: asset.public_url,
                storagePath: asset.r2_key,
                mimeType: 'video/mp4',
                format: asset.aspect_ratio,
                fileSizeBytes: asset.size_bytes,
                width: d.width,
                height: d.height,
              };
            }),
            captions: { instagram: recommendation.caption || '', facebook: recommendation.caption || '', threads: recommendation.caption || '', tiktok: recommendation.caption || '' },
            platforms: ['instagram', 'facebook', 'threads', 'tiktok'],
          }),
        });
      }
      setVideoAutopilot({ running: false, message: `Prepared 1 multi-ratio video draft for approval.`, jobs: completed });
      await fetchDrafts(true);
      toast.success(`Prepared multi-ratio video draft for ${film.title}!`);
    } catch (err) {
      setVideoAutopilot(prev => ({ ...prev, running: false, message: err.message || 'Daily video autopilot failed.' }));
      toast.error(err.message || 'Daily video autopilot failed.');
    }
  };

  const updateVideoRow = (id, patch) => setVideoRows(rows => rows.map(row => row.id === id ? { ...row, ...patch } : row));
  const addVideoRow = () => setVideoRows(rows => [...rows, {
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    date: videoPlan.startDate || new Date().toISOString().slice(0, 10),
    time: videoPlan.slot1Time || '12:00',
    aspectRatios: ['9:16', '1:1'],
    filmId: videoFilmOptions[0]?.id || '',
    film: videoFilmOptions[0] || null,
    mode: 'gemini',
    start: '01:30',
    end: formatSecondsToTimestamp(90 + (videoPlan.clipLength || 30)),
    caption: '',
    engine: 'gemini',
    angle: 'editorial',
    variations: [],
    selectedVariationKey: 'B',
  }]);
  const buildVideoPlanRows = () => {
    const baseDate = new Date(`${videoPlan.startDate}T12:00:00`);
    const films = videoFilmOptions;
    if (!films.length) return toast.error('No films with usable video sources are available yet.');
    const rows = [];
    let filmIdx = 0;
    const dailySlots = [
      videoPlan.slot1Time || '12:00',
      videoPlan.slot2Time || '16:00',
      videoPlan.slot3Time || '20:00',
    ];
    for (let day = 0; day < videoPlan.days; day += 1) {
      const date = new Date(baseDate); date.setDate(baseDate.getDate() + day);
      const dateString = date.toISOString().slice(0, 10);
      dailySlots.forEach((slotTime, slotIndex) => {
        const film = films[filmIdx % films.length];
        filmIdx += 1;
        rows.push({
          id: `${Date.now()}-${day}-${slotIndex}`,
          date: dateString,
          time: slotTime,
          aspectRatios: ['9:16', '1:1'],
          filmId: film?.id || '',
          film: film || null,
          mode: 'gemini',
          start: '01:30',
          end: formatSecondsToTimestamp(90 + (videoPlan.clipLength || 30)),
          caption: '',
          engine: 'gemini',
          angle: 'editorial',
          variations: [],
          selectedVariationKey: 'B',
        });
      });
    }
    setVideoRows(rows);
    toast.success(`Built ${rows.length} video rows across ${videoPlan.days} days (3 distinct movies per day, 9:16 & 1:1 multi-ratio).`);
  };
  const removeVideoRow = id => setVideoRows(rows => rows.length > 1 ? rows.filter(row => row.id !== id) : rows);
  const resolveFilmForRow = async row => {
    if (row.film && row.film.id === row.filmId && row.film.credits) return row.film;
    if (!row.filmId) return null;
    try {
      const { data, error } = await supabase
        .from('films')
        .select(`
          id,title,release_date,year,synopsis,genres,trailer_youtube_id,trailer_external_url,youtube_watch_url,
          youtube_channels(id,channel_name,channel_title),
          film_platform_links(platform,web_url),
          credits(
            id,role,job,billing_order,character_name,
            people(id,name,instagram_handle,slug)
          )
        `)
        .eq('id', row.filmId)
        .single();
      if (!error && data) return data;
    } catch {
      // fallback
    }
    const existing = videoFilmOptions.find(item => item.id === row.filmId);
    return existing || null;
  };

  const generateRowCaption = async (row, customAngle = null, customEngine = null) => {
    const film = await resolveFilmForRow(row);
    if (!film) return toast.error('Choose a film before generating a caption.');
    const engine = customEngine || row.engine || 'gemini';
    const angle = customAngle || row.angle || 'editorial';
    const isManual = row.mode === 'manual';

    updateVideoRow(row.id, {
      generatingCaption: true,
      caption: isManual 
        ? `Generating ${engine.toUpperCase()} copy for ${row.start} – ${row.end}…` 
        : `Selecting viral scene & generating copy with ${engine.toUpperCase()}…`,
    });

    try {
      const sourceUrl = film.youtube_watch_url || (film.trailer_youtube_id ? `https://www.youtube.com/watch?v=${film.trailer_youtube_id}` : film.trailer_external_url);
      const channelName = film.youtube_channels?.channel_title || film.youtube_channels?.channel_name || '';
      const platform = film.film_platform_links?.[0]?.platform || 'YouTube';
      
      const rawCredits = asRelationArray(film.credits);
      const cast = rawCredits
        .filter(c => (c.role === 'cast' || c.job === 'Actor' || !c.role) && c.people?.name)
        .sort((a, b) => (a.billing_order || 99) - (b.billing_order || 99))
        .map(c => ({ name: c.people.name, instagram_handle: c.people.instagram_handle }));
      
      const directors = rawCredits
        .filter(c => (c.job?.toLowerCase().includes('director') || c.role === 'director') && c.people?.name)
        .map(c => ({ name: c.people.name, instagram_handle: c.people.instagram_handle }));

      const producers = rawCredits
        .filter(c => (c.job?.toLowerCase().includes('producer') || c.role === 'producer') && c.people?.name)
        .map(c => ({ name: c.people.name, instagram_handle: c.people.instagram_handle }));

      let sourceMetadata = {
        title: film.title,
        duration: 3600,
        transcript: '',
        description: '',
        synopsis: film.synopsis || '',
        genre: Array.isArray(film.genres) ? film.genres.join(', ') : (film.genres || ''),
        channelName,
        platform,
        cast,
        directors,
        producers,
      };

      if (sourceUrl) {
        try {
          const metadataResponse = await fetch('http://127.0.0.1:4317/metadata', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: sourceUrl }),
          });
          if (metadataResponse.ok) {
            const meta = await metadataResponse.json();
            sourceMetadata = { ...sourceMetadata, ...meta };
          }
        } catch {
          // clipper offline fallback
        }
      }

      const response = await fetch('/api/ai', {
        method: 'POST',
        headers: { ...(await authHeaders()), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          task: 'recommend_clip_segment',
          data: {
            ...sourceMetadata,
            mode: row.mode,
            startTime: row.start,
            endTime: row.end,
            preferredProvider: engine,
            angle: angle,
            targetLength: videoPlan.clipLength || 45,
          },
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || `${engine.toUpperCase()} caption generation failed`);

      const updates = {
        generatingCaption: false,
        caption: data.caption || '',
        variations: Array.isArray(data.variations) ? data.variations : [],
        selectedVariationKey: 'B',
        engine: data.engine || engine,
        angle: angle,
      };

      if (row.mode === 'gemini') {
        const startSec = parseTimestampToSeconds(data.startTime ?? data.startTimeFormatted);
        const endSec = parseTimestampToSeconds(data.endTime ?? data.endTimeFormatted) || (startSec + (videoPlan.clipLength || 45));
        updates.start = data.startTimeFormatted || formatSecondsToTimestamp(startSec);
        updates.end = data.endTimeFormatted || formatSecondsToTimestamp(endSec);
        toast.success(`✨ Scene selected: ${updates.start} – ${updates.end}`);
      } else {
        toast.success(`✨ ${data.engine?.toUpperCase() || engine.toUpperCase()} caption generated for ${row.start} – ${row.end}`);
      }

      updateVideoRow(row.id, updates);
    } catch (err) {
      updateVideoRow(row.id, { caption: '', generatingCaption: false });
      toast.error(err.message);
    }
  };

  const prepareCustomVideoPlan = async (action = 'draft', targetRows = null) => {
    const rowsToProcess = targetRows ? (Array.isArray(targetRows) ? targetRows : [targetRows]) : videoRows;
    const validRows = rowsToProcess.filter(row => row.filmId && row.date && row.time);
    if (!validRows.length) return toast.error('Add at least one video row with a film, date, and time.');
    setVideoAutopilot({ running: true, message: `Preparing ${validRows.length} planned video item${validRows.length === 1 ? '' : 's'}…`, jobs: [] });
    try {
      let created = 0;
      for (const row of validRows) {
        const film = await resolveFilmForRow(row);
        if (!film) continue;
        const sourceUrl = film.youtube_watch_url || (film.trailer_youtube_id ? `https://www.youtube.com/watch?v=${film.trailer_youtube_id}` : film.trailer_external_url);
        let start = parseTimestampToSeconds(row.start);
        let end = parseTimestampToSeconds(row.end);
        if (end <= start) {
          end = start + (videoPlan.clipLength || 45);
        }
        let caption = row.caption || '';
        if (row.mode === 'gemini' || !caption) {
          let sourceMetadata = { title: film.title, duration: 3600, transcript: '', description: '', synopsis: film.synopsis || '', genre: film.genre || '' };
          if (sourceUrl) {
            try {
              const metadataResponse = await fetch('http://127.0.0.1:4317/metadata', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url: sourceUrl }),
              });
              if (metadataResponse.ok) {
                const meta = await metadataResponse.json();
                sourceMetadata = { ...sourceMetadata, ...meta };
              }
            } catch { /* clipper fallback */ }
          }
          const recommendationResponse = await fetch('/api/ai', {
            method: 'POST',
            headers: { ...(await authHeaders()), 'Content-Type': 'application/json' },
            body: JSON.stringify({
              task: 'recommend_clip_segment',
              data: {
                ...sourceMetadata,
                targetLength: videoPlan.clipLength || 45,
              },
            }),
          });
          const recommendation = await recommendationResponse.json().catch(() => ({}));
          if (!recommendationResponse.ok) throw new Error(recommendation.error || 'Gemini could not recommend a clip.');
          if (row.mode === 'gemini') {
            start = parseTimestampToSeconds(recommendation.startTime ?? recommendation.startTimeFormatted) || start;
            end = parseTimestampToSeconds(recommendation.endTime ?? recommendation.endTimeFormatted) || end;
          }
          caption = caption || recommendation.caption || '';
        }

        const formats = getRowAspectRatios(row);
        const clips = formats.map(ar => ({
          url: sourceUrl,
          start_time: start,
          end_time: end,
          aspect_ratio: ar,
          fit_mode: 'cover',
          title: film.title,
        }));

        const batchResponse = await fetch('http://127.0.0.1:4317/batch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ clips }),
        });
        const batch = await batchResponse.json().catch(() => ({}));
        if (!batchResponse.ok) throw new Error(batch.detail || 'The local clipper could not queue this video.');
        
        const renderedAssets = [];
        for (let j = 0; j < (batch.jobs || []).length; j++) {
          const job = batch.jobs[j];
          const targetFormat = formats[j] || formats[0];
          let status;
          for (;;) {
            await new Promise(resolve => setTimeout(resolve, 1200));
            const response = await fetch(job.status_url);
            status = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(status.detail || 'Video render failed.');
            if (status.success) break;
            setVideoAutopilot(prev => ({
              ...prev,
              message: `Rendering ${film.title} (${targetFormat})… ${status.progress || 0}%`,
            }));
          }
          const sessionResponse = await fetch('/api/social?task=create_r2_upload_session', {
            method: 'POST',
            headers: { ...(await authHeaders()), 'Content-Type': 'application/json' },
            body: JSON.stringify({ fileName: status.file_name, mimeType: 'video/mp4', fileSize: status.size_bytes || 1024 }),
          });
          const session = await sessionResponse.json().catch(() => ({}));
          if (!sessionResponse.ok) throw new Error(session.error || 'Could not prepare video storage.');

          let uploadSuccessful = false;
          try {
            const directUploadRes = await fetch('http://127.0.0.1:4317/upload', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ token: job.job_id, upload_url: session.uploadUrl, content_type: 'video/mp4' }),
            });
            if (directUploadRes.ok) {
              uploadSuccessful = true;
            }
          } catch {
            // fallback to browser fetch
          }

          if (!uploadSuccessful) {
            try {
              const blob = await (await fetch(status.download_url)).blob();
              const uploadResponse = await fetch(session.uploadUrl, {
                method: 'PUT',
                headers: { 'Content-Type': 'video/mp4' },
                body: blob,
              });
              if (!uploadResponse.ok) throw new Error('Could not upload the rendered video.');
            } catch (err) {
              throw new Error('Clipper download blocked by browser. Please restart your local clipper script to apply the CORS patch.');
            }
          }

          const dims = getDimensionsForAspectRatio(targetFormat);
          renderedAssets.push({
            publicUrl: session.publicUrl,
            storagePath: session.key,
            mimeType: 'video/mp4',
            format: targetFormat,
            fileSizeBytes: status.size_bytes || 1024,
            width: dims.width,
            height: dims.height,
          });
        }

        if (renderedAssets.length > 0) {
          const primaryAsset = renderedAssets[0];
          const draftResponse = await fetch('/api/social?task=create_editor_video_draft', {
            method: 'POST',
            headers: { ...(await authHeaders()), 'Content-Type': 'application/json' },
            body: JSON.stringify({
              title: `${film.title} — Highlight Clip`,
              publicUrl: primaryAsset.publicUrl,
              storagePath: primaryAsset.storagePath,
              mimeType: primaryAsset.mimeType,
              format: primaryAsset.format,
              fileSizeBytes: primaryAsset.fileSizeBytes,
              width: primaryAsset.width,
              height: primaryAsset.height,
              assets: renderedAssets,
              captions: { instagram: caption, facebook: caption, threads: caption, tiktok: caption },
              platforms: ['instagram', 'facebook', 'threads', 'tiktok'],
            }),
          });
          const draft = await draftResponse.json().catch(() => ({}));
          if (!draftResponse.ok) throw new Error(draft.error || 'Could not create the video draft.');
          const contentItemId = draft.id || draft.contentItemId || draft.content_item_id || draft.item?.id;
          if (contentItemId && (action === 'schedule' || action === 'publish')) {
            const task = action === 'publish' ? 'publish_editor_video_now' : 'schedule';
            const response = await fetch(`/api/social?task=${task}`, {
              method: 'POST',
              headers: { ...(await authHeaders()), 'Content-Type': 'application/json' },
              body: JSON.stringify({ contentItemId, scheduledFor: new Date(`${row.date}T${row.time}`).toISOString() }),
            });
            const result = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(result.error || `Could not ${action} video.`);
          }
          created += 1;
        }
      }
      setVideoAutopilot({ running: false, message: `Prepared ${created} video draft${created === 1 ? '' : 's'}.`, jobs: [] });
      await refreshAll();
      setActiveTab('drafts');
      toast.success(`✨ Video clip saved to drafts with ${formats.join(' & ')} formats!`);
    } catch (err) {
      setVideoAutopilot(prev => ({ ...prev, running: false, message: err.message || 'Custom video plan failed.' }));
      toast.error(err.message || 'Custom video plan failed.');
    }
  };

  const fetchSummary = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await fetch('/api/social', { headers: await authHeaders() });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      setSummary({ ...emptySummary, ...data, counts: { ...emptySummary.counts, ...(data.counts || {}) } });
    } catch (err) {
      toast.error(err.message || 'Failed to load Social Studio');
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    fetchSummary();
    fetchDrafts();
    fetchConnectionsStatus();
    fetchCalendar();
  }, []);

  // Real-time polling while any post is actively publishing or scheduled
  useEffect(() => {
    const hasActivePublishing = drafts.some(d => d.status === 'publishing' || d.status === 'processing');
    if (!hasActivePublishing) return;

    const interval = setInterval(() => {
      fetchSummary(true);
      fetchDrafts(true);
    }, 3500);

    return () => clearInterval(interval);
  }, [drafts]);

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
      if (!reason.trim()) {
        toast.error('A rejection reason is required');
        return;
      }
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
    if (!value) {
      toast.error('Pick a date and time first');
      return;
    }

    const scheduledFor = new Date(value);
    if (Number.isNaN(scheduledFor.getTime())) {
      toast.error('Choose a valid date and time');
      return;
    }

    setReviewingId(contentItemId);
    try {
      const res = await fetch('/api/social?task=schedule', {
        method: 'POST',
        headers: { ...(await authHeaders()), 'Content-Type': 'application/json' },
        body: JSON.stringify({ contentItemId, scheduledFor: scheduledFor.toISOString() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      const platforms = Array.isArray(data.platforms) ? data.platforms.join(', ') : 'selected channels';
      toast.success(`Scheduled ${data.jobs || 0} job(s): ${platforms}`);
      setScheduleAt(current => ({ ...current, [contentItemId]: '' }));
      refreshAll();
    } catch (err) {
      const message = err instanceof TypeError || /failed to fetch|networkerror|load failed/i.test(String(err?.message || ''))
        ? 'MuviDB could not reach the scheduling service. Your draft is safe—check your connection and try again.'
        : err.message || 'This post could not be scheduled. Your draft is still saved.';
      toast.error(message, { duration: 7000 });
    } finally {
      setReviewingId(null);
    }
  };

  const runQuickSchedulePreset = (contentItemId, preset) => {
    const target = new Date();
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
          ? `Cancelled ${data.cancelledJobs || 0} job(s); ${data.inFlight} already publishing`
          : `Cancelled ${data.cancelledJobs || 0} job(s) — back to approved`,
      );
      refreshAll();
    } catch (err) {
      toast.error(err.message || 'Cancel failed');
    } finally {
      setReviewingId(null);
    }
  };

  const runPublishNow = async (contentItemId, currentStatus) => {
    setReviewingId(contentItemId);
    const toastId = toast.loading('Initiating instant publish for selected channels...');
    try {
      if (currentStatus !== 'scheduled') {
        const schedRes = await fetch('/api/social?task=schedule', {
          method: 'POST',
          headers: { ...(await authHeaders()), 'Content-Type': 'application/json' },
          body: JSON.stringify({ contentItemId, scheduledFor: new Date().toISOString() }),
        });
        const schedData = await schedRes.json().catch(() => ({}));
        if (!schedRes.ok) throw new Error(schedData.error || `HTTP ${schedRes.status}`);
      }

      const pubRes = await fetch('/api/social?task=publish_due', {
        headers: await authHeaders(),
      });
      const pubData = await pubRes.json().catch(() => ({}));
      if (!pubRes.ok) throw new Error(pubData.error || `HTTP ${pubRes.status}`);

      toast.success('Publishing in progress! Uploading & publishing to selected channels.', { id: toastId });
      refreshAll();
    } catch (err) {
      toast.error(err.message || 'Failed to trigger publishing', { id: toastId });
    } finally {
      setReviewingId(null);
    }
  };

  const openFullStudioEditor = async item => {
    setReviewingId(item.id);
    try {
      if (item.status === 'scheduled') {
        const res = await fetch('/api/social?task=prepare_queue_item_edit', {
          method: 'POST',
          headers: { ...(await authHeaders()), 'Content-Type': 'application/json' },
          body: JSON.stringify({ contentItemId: item.id }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      }
      setEditingDraft(item);
      setActiveTab('composer');
      toast.success(`Opening "${item.title || 'Post'}" in Full Studio`);
    } catch (err) {
      toast.error(err.message || 'Could not open post in Studio');
    } finally {
      setReviewingId(null);
    }
  };

  const openQueueEditor = async item => {
    setReviewingId(item.id);
    try {
      const res = await fetch('/api/social?task=prepare_queue_item_edit', {
        method: 'POST',
        headers: { ...(await authHeaders()), 'Content-Type': 'application/json' },
        body: JSON.stringify({ contentItemId: item.id }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);

      const editableItem = { ...item, status: 'draft' };
      setEditingQueueItem(editableItem);
      setQueueEditTitle(item.title || '');
      setQueueEditCaptions(Object.fromEntries(
        asRelationArray(item.social_platform_variants).map(variant => [variant.id, variant.caption || '']),
      ));
      setDrafts(current => current.map(entry => entry.id === item.id ? editableItem : entry));
      if (data.from === 'scheduled') toast.success('Schedule cancelled. You can now edit this post.');
    } catch (err) {
      toast.error(err.message || 'This post could not be opened for editing');
    } finally {
      setReviewingId(null);
    }
  };

  const saveQueueEditor = async () => {
    if (!editingQueueItem) return;
    const variants = asRelationArray(editingQueueItem.social_platform_variants);
    if (!queueEditTitle.trim()) {
      toast.error('Post title cannot be empty');
      return;
    }
    if (variants.some(variant => !String(queueEditCaptions[variant.id] || '').trim())) {
      toast.error('Every selected platform needs a caption');
      return;
    }

    setSavingQueueEdit(true);
    try {
      const payloadVariants = variants.map(variant => ({
        id: variant.id,
        caption: queueEditCaptions[variant.id],
      }));
      const res = await fetch('/api/social?task=update_queue_item', {
        method: 'POST',
        headers: { ...(await authHeaders()), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contentItemId: editingQueueItem.id,
          title: queueEditTitle,
          variants: payloadVariants,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      toast.success('Queue post updated and saved as a draft');
      setEditingQueueItem(null);
      await fetchDrafts();
      fetchSummary();
    } catch (err) {
      toast.error(err.message || 'Could not save this post');
    } finally {
      setSavingQueueEdit(false);
    }
  };

  const deleteQueueItem = async item => {
    const confirmed = window.confirm(
      `Delete “${item.title}”? This removes the unpublished post, its captions, schedule, and generated artwork. This cannot be undone.`,
    );
    if (!confirmed) return;

    setReviewingId(item.id);
    try {
      const res = await fetch('/api/social?task=delete_queue_item', {
        method: 'POST',
        headers: { ...(await authHeaders()), 'Content-Type': 'application/json' },
        body: JSON.stringify({ contentItemId: item.id }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      setDrafts(current => current.filter(entry => entry.id !== item.id));
      toast.success('Queue post deleted');
      fetchSummary();
    } catch (err) {
      toast.error(err.message || 'Could not delete this post');
    } finally {
      setReviewingId(null);
    }
  };

  const counts = summary.counts || emptySummary.counts;
  const connectedPlatformsList = Object.entries(connections.platforms).filter(([, v]) => Boolean(v));
  const connectedCount = connectedPlatformsList.length;

  // Group calendar slots by scheduled_date for Month Grid view
  const slotsByDate = useMemo(() => {
    const map = {};
    for (const slot of calendarSlots) {
      const dateKey = slot.scheduled_date ? slot.scheduled_date.slice(0, 10) : '';
      if (dateKey) {
        if (!map[dateKey]) map[dateKey] = [];
        map[dateKey].push(slot);
      }
    }
    return map;
  }, [calendarSlots]);

  // Build calendar matrix for month view
  const calendarMatrix = useMemo(() => {
    const year = currentCalendarMonth.getFullYear();
    const month = currentCalendarMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);

    const startOffset = firstDay.getDay(); // 0 = Sun, 1 = Mon...
    const daysInMonth = lastDay.getDate();

    const days = [];
    // Leading days
    for (let i = 0; i < startOffset; i++) {
      const prevDate = new Date(year, month, 1 - (startOffset - i));
      days.push({
        date: prevDate,
        dateStr: prevDate.toISOString().slice(0, 10),
        isCurrentMonth: false,
      });
    }
    // Month days
    for (let i = 1; i <= daysInMonth; i++) {
      const currDate = new Date(year, month, i);
      days.push({
        date: currDate,
        dateStr: currDate.toISOString().slice(0, 10),
        isCurrentMonth: true,
      });
    }
    // Trailing days to fill 35 or 42 grid cells
    const remaining = (7 - (days.length % 7)) % 7;
    for (let i = 1; i <= remaining; i++) {
      const nextDate = new Date(year, month + 1, i);
      days.push({
        date: nextDate,
        dateStr: nextDate.toISOString().slice(0, 10),
        isCurrentMonth: false,
      });
    }
    return days;
  }, [currentCalendarMonth]);

  const filteredDrafts = useMemo(() => {
    if (queueFilterStatus === 'all') return drafts;
    return drafts.filter(d => d.status === queueFilterStatus);
  }, [drafts, queueFilterStatus]);

  return (
    <div className="space-y-6">
      {/* ========================================================================= */}
      {/* 1. TOP HEADER & CHANNELS STATUS BAR (SchedulePress / Pastis Inspired)   */}
      {/* ========================================================================= */}
      <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-r from-surface via-surface to-surface-2 p-6 shadow-xl backdrop-blur">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          {/* Left: Studio Branding & Status */}
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand text-white shadow-lg shadow-brand/25">
                <Icon icon="solar:clapperboard-play-bold" width="20" />
              </div>
              <h1 className="text-2xl font-black tracking-tight text-white">Social Studio</h1>
              
              <Pill tone={summary.enabled ? 'green' : 'amber'}>
                {summary.enabled ? 'Live Mode' : 'Draft Mock'}
              </Pill>

              {/* Connected Channels Pill */}
              <button
                type="button"
                onClick={() => setChannelsModalOpen(true)}
                className="group inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/40 px-3 py-1 text-xs font-bold text-text-primary hover:border-brand/40 hover:bg-black/60 transition-all"
                title="View and manage connected social profiles"
              >
                <div className="flex -space-x-1.5">
                  <span className={`flex h-4 w-4 items-center justify-center rounded-full text-[9px] ${connections.platforms.threads ? 'bg-white text-black' : 'bg-surface-3 text-text-muted'}`}>
                    <Icon icon="simple-icons:threads" width="9" />
                  </span>
                  <span className={`flex h-4 w-4 items-center justify-center rounded-full text-[9px] ${connections.platforms.instagram ? 'bg-[#E1306C] text-white' : 'bg-surface-3 text-text-muted'}`}>
                    <Icon icon="mdi:instagram" width="9" />
                  </span>
                  <span className={`flex h-4 w-4 items-center justify-center rounded-full text-[9px] ${connections.platforms.facebook ? 'bg-[#1877F2] text-white' : 'bg-surface-3 text-text-muted'}`}>
                    <Icon icon="mdi:facebook" width="9" />
                  </span>
                  <span className={`flex h-4 w-4 items-center justify-center rounded-full text-[9px] ${connections.platforms.tiktok ? 'bg-[#25F4EE] text-black' : 'bg-surface-3 text-text-muted'}`}>
                    <Icon icon="simple-icons:tiktok" width="9" />
                  </span>
                </div>
                <span className="text-[11px] font-bold">
                  {connectedCount}/4 Connected
                </span>
                <Icon icon="solar:alt-arrow-right-linear" className="text-text-muted group-hover:text-brand group-hover:translate-x-0.5 transition-all" width="12" />
              </button>
            </div>

            <p className="text-xs text-text-muted max-w-2xl leading-relaxed">
              Multi-channel Nollywood publishing studio: 30-day automated editorial planner, Figma/HTML canvas generator, AI copywriter, and one-click instant distribution to Instagram, Threads, Facebook & TikTok.
            </p>
          </div>

          {/* Right: Studio Primary Action Buttons */}
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={refreshAll}
              disabled={loading}
              className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-white/10 bg-surface-2 px-3.5 text-xs font-bold text-text-primary hover:border-white/20 hover:bg-surface-3 active:scale-95 transition-all shadow-sm"
              title="Refresh all studio data"
            >
              <Icon icon="solar:refresh-linear" className={loading ? 'animate-spin text-brand' : ''} width="16" />
              <span>Refresh</span>
            </button>

            <button
              type="button"
              onClick={launchDesktopClipper}
              disabled={clipperStatus === 'running'}
              className={`inline-flex h-10 items-center gap-1.5 rounded-xl border px-3.5 text-xs font-black transition-all shadow-sm ${
                clipperStatus === 'running'
                  ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
                  : 'border-violet-500/30 bg-violet-500/15 text-violet-200 hover:bg-violet-500/25'
              }`}
              title="Start the local FFmpeg/YouTube desktop video clipper"
            >
              <Icon icon={clipperStatus === 'running' ? 'solar:check-circle-bold' : 'solar:laptop-minimalistic-bold'} width="16" />
              <span>{clipperStatus === 'running' ? 'Clipper Ready' : 'Start Clipper'}</span>
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
              className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-amber-500/30 bg-amber-500/15 px-4 text-xs font-bold text-amber-300 hover:bg-amber-500/25 disabled:opacity-50 transition-all shadow-sm"
              title="Trigger publishing for all scheduled posts that are due now"
            >
              <Icon icon={publishing ? 'solar:spinner-linear' : 'solar:play-bold'} className={publishing ? 'animate-spin' : ''} width="16" />
              <span>Publish Due</span>
            </button>

            {/* Main Create Post CTA */}
            <button
              type="button"
              onClick={() => {
                setEditingDraft(null);
                setSlotContext(null);
                setActiveTab('composer');
              }}
              className="inline-flex h-10 items-center gap-2 rounded-xl bg-brand px-5 text-xs font-black text-white hover:bg-brand-hover active:scale-95 shadow-lg shadow-brand/25 transition-all"
            >
              <Icon icon="solar:add-circle-bold" width="18" />
              <span>Create Post</span>
            </button>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. OVERVIEW METRICS ROW                                                  */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        <Metric label="30-Day Plan Slots" value={calendarSlots.length} icon="solar:calendar-date-bold" tone="brand" />
        <Metric label="Active Drafts" value={counts.draftItems} icon="solar:document-add-bold" tone="blue" />
        <Metric label="Scheduled" value={counts.scheduledItems} icon="solar:calendar-mark-bold" tone="amber" />
        <Metric label="Queued Jobs" value={counts.queuedJobs} icon="solar:server-square-bold" tone="green" />
        <Metric label="Total Content" value={counts.contentItems} icon="solar:posts-carousel-vertical-bold" tone="blue" />
        <Metric label="Failed Jobs" value={counts.failedJobs} icon="solar:danger-triangle-bold" tone={counts.failedJobs ? 'red' : 'green'} />
      </div>

      {/* ========================================================================= */}
      {/* 3. SEGMENTED TAB NAVIGATOR (Pastis / SchedulePress Style)                */}
      {/* ========================================================================= */}
      <div className="flex overflow-x-auto rounded-2xl border border-white/10 bg-surface p-1.5 shadow-sm">
        <button
          type="button"
          onClick={() => setActiveTab('calendar')}
          className={`flex items-center gap-2 rounded-xl px-5 py-2.5 text-xs font-black uppercase tracking-wider transition-all ${
            activeTab === 'calendar'
              ? 'bg-brand text-white shadow-md shadow-brand/20'
              : 'text-text-muted hover:text-text-primary hover:bg-surface-2'
          }`}
        >
          <Icon icon="solar:calendar-mark-bold" width="16" />
          <span>30-Day Auto-Pilot Plan</span>
          <span className={`rounded-full px-2 py-0.5 text-[10px] ${activeTab === 'calendar' ? 'bg-black/30 text-white' : 'bg-surface-3 text-text-muted'}`}>
            {calendarSlots.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('drafts')}
          className={`flex items-center gap-2 rounded-xl px-5 py-2.5 text-xs font-black uppercase tracking-wider transition-all ${
            activeTab === 'drafts'
              ? 'bg-brand text-white shadow-md shadow-brand/20'
              : 'text-text-muted hover:text-text-primary hover:bg-surface-2'
          }`}
        >
          <Icon icon="solar:posts-carousel-vertical-bold" width="16" />
          <span>Queue & Scheduled</span>
          <span className={`rounded-full px-2 py-0.5 text-[10px] ${activeTab === 'drafts' ? 'bg-black/30 text-white' : 'bg-surface-3 text-text-muted'}`}>
            {drafts.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('composer')}
          className={`flex items-center gap-2 rounded-xl px-5 py-2.5 text-xs font-black uppercase tracking-wider transition-all ${
            activeTab === 'composer'
              ? 'bg-brand text-white shadow-md shadow-brand/20'
              : 'text-text-muted hover:text-text-primary hover:bg-surface-2'
          }`}
        >
          <Icon icon="solar:magic-stick-3-bold" width="16" />
          <span>Ad-Hoc Composer</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('intake')}
          className={`flex items-center gap-2 rounded-xl px-5 py-2.5 text-xs font-black uppercase tracking-wider transition-all ${
            activeTab === 'intake'
              ? 'bg-brand text-white shadow-md shadow-brand/20'
              : 'text-text-muted hover:text-text-primary hover:bg-surface-2'
          }`}
        >
          <Icon icon="solar:inbox-in-bold" width="16" />
          <span>Telegram Intake Inbox</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('video_plan')}
          className={`flex items-center gap-2 rounded-xl px-5 py-2.5 text-xs font-black uppercase tracking-wider transition-all ${
            activeTab === 'video_plan'
              ? 'bg-brand text-white shadow-md shadow-brand/20'
              : 'text-text-muted hover:text-text-primary hover:bg-surface-2'
          }`}
        >
          <Icon icon="solar:clapperboard-edit-bold" width="16" />
          <span>Video Autopilot</span>
        </button>

        <button
          type="button"
          onClick={() => setChannelsModalOpen(true)}
          className="ml-auto flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold text-text-muted hover:text-text-primary hover:bg-surface-2 transition-all"
        >
          <Icon icon="solar:settings-bold" width="16" />
          <span>Channels Hub</span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* 4. TAB 1: 30-DAY AUTO-PILOT CALENDAR VIEW (SchedulePress Inspired)        */}
      {/* ========================================================================= */}
      {activeTab === 'calendar' && (
        <div className="space-y-5">
          {/* Calendar Control Bar */}
          <div className="rounded-2xl border border-white/10 bg-surface p-5 shadow-sm">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
              {/* Left: Month Navigator & View Switcher */}
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-surface-2 p-1 shadow-sm">
                  <button
                    type="button"
                    onClick={() => {
                      const prev = new Date(currentCalendarMonth);
                      prev.setMonth(prev.getMonth() - 1);
                      setCurrentCalendarMonth(prev);
                    }}
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-text-muted hover:bg-surface hover:text-text-primary transition-all"
                    title="Previous month"
                  >
                    <Icon icon="solar:alt-arrow-left-linear" width="16" />
                  </button>

                  <span className="px-3 font-mono text-sm font-black text-white">
                    {currentCalendarMonth.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
                  </span>

                  <button
                    type="button"
                    onClick={() => {
                      const next = new Date(currentCalendarMonth);
                      next.setMonth(next.getMonth() + 1);
                      setCurrentCalendarMonth(next);
                    }}
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-text-muted hover:bg-surface hover:text-text-primary transition-all"
                    title="Next month"
                  >
                    <Icon icon="solar:alt-arrow-right-linear" width="16" />
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => setCurrentCalendarMonth(new Date())}
                  className="rounded-xl border border-white/10 bg-surface-2 px-3 py-1.5 text-xs font-bold text-text-primary hover:bg-surface-3 transition-all"
                >
                  Today
                </button>

                {/* View Switch: Month Grid vs Cards */}
                <div className="flex items-center rounded-xl border border-white/10 bg-surface-2 p-1">
                  <button
                    type="button"
                    onClick={() => setCalendarViewMode('month')}
                    className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
                      calendarViewMode === 'month'
                        ? 'bg-brand text-white shadow-sm'
                        : 'text-text-muted hover:text-text-primary'
                    }`}
                  >
                    <Icon icon="solar:calendar-bold" width="14" />
                    Month Grid
                  </button>

                  <button
                    type="button"
                    onClick={() => setCalendarViewMode('cards')}
                    className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
                      calendarViewMode === 'cards'
                        ? 'bg-brand text-white shadow-sm'
                        : 'text-text-muted hover:text-text-primary'
                    }`}
                  >
                    <Icon icon="solar:widget-2-bold" width="14" />
                    Card View
                  </button>
                </div>
              </div>

              {/* Right: Editorial Generation Toolbar */}
              <div className="flex flex-wrap items-center gap-2.5">
                {/* Start Date */}
                <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-surface-2 px-3 py-1.5 text-xs">
                  <Icon icon="solar:calendar-date-bold" className="text-brand" width="16" />
                  <span className="text-[10px] font-black uppercase tracking-wider text-text-muted">Start:</span>
                  <input
                    type="date"
                    value={calendarStartDate}
                    onChange={e => setCalendarStartDate(e.target.value)}
                    className="bg-transparent font-mono text-xs font-bold text-white outline-none cursor-pointer"
                  />
                </div>

                {/* Posts per day pills */}
                <div className="flex items-center rounded-xl border border-white/10 bg-surface-2 p-1 text-xs font-bold">
                  {[1, 2, 3].map(num => (
                    <button
                      key={num}
                      type="button"
                      onClick={() => setPostsPerDay(num)}
                      className={`rounded-lg px-3 py-1 text-xs transition-all ${
                        postsPerDay === num
                          ? 'bg-brand text-white shadow-sm'
                          : 'text-text-muted hover:text-text-primary'
                      }`}
                    >
                      {num} {num === 1 ? 'Post' : num === 3 ? 'Lanes' : 'Posts'}/Day
                    </button>
                  ))}
                </div>

                {/* Shuffle Candidates */}
                <button
                  type="button"
                  onClick={handleShuffleAllCandidates}
                  disabled={loadingCalendar}
                  className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-white/10 bg-surface-2 px-3.5 text-xs font-bold text-text-primary hover:border-brand/40 hover:text-brand disabled:opacity-50 transition-all shadow-sm"
                  title="Shuffle candidate actors, crew, and movies across the 30-day plan"
                >
                  <Icon icon="solar:shuffle-bold" width="15" />
                  <span>Shuffle</span>
                </button>

                {/* Generate Schedule CTA */}
                <button
                  type="button"
                  onClick={seedCalendar}
                  disabled={seedingCalendar}
                  className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-brand px-4 text-xs font-black text-white hover:bg-brand-hover shadow-lg shadow-brand/20 active:scale-95 disabled:opacity-50 transition-all"
                >
                  <Icon icon={seedingCalendar ? 'solar:spinner-linear' : 'solar:magic-stick-3-bold'} className={seedingCalendar ? 'animate-spin' : ''} width="15" />
                  <span>{seedingCalendar ? 'Generating…' : '⚡ Generate Schedule'}</span>
                </button>
              </div>
            </div>
          </div>

          {loadingCalendar ? (
            <div className="rounded-2xl border border-white/10 bg-surface p-16 text-center shadow-xl">
              <Icon icon="solar:spinner-linear" className="mx-auto animate-spin text-brand" width="36" />
              <p className="mt-3 text-sm font-bold text-white">Loading 30-day schedule & verified Nollywood stars…</p>
              <p className="mt-1 text-xs text-text-muted">Fetching editorial series, movies, reviews, and streaming availability.</p>
            </div>
          ) : calendarSlots.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-white/15 bg-surface/50 p-12 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-brand/10 text-brand border border-brand/20">
                <Icon icon="solar:calendar-mark-bold" width="28" />
              </div>
              <h3 className="mt-4 text-base font-black text-white">No Calendar Slots Generated Yet</h3>
              <p className="mx-auto mt-1 max-w-md text-xs text-text-muted">
                Click <strong>"⚡ Generate Schedule"</strong> above to automatically populate 30 days of curated Nollywood content matched to each day’s editorial theme.
              </p>
              <button
                type="button"
                onClick={seedCalendar}
                disabled={seedingCalendar}
                className="mt-5 inline-flex items-center gap-2 rounded-xl bg-brand px-5 py-2.5 text-xs font-black text-white hover:bg-brand-hover shadow-lg shadow-brand/20"
              >
                <Icon icon="solar:magic-stick-3-bold" width="16" />
                <span>Generate 30-Day Auto-Pilot Plan</span>
              </button>
            </div>
          ) : calendarViewMode === 'month' ? (
            /* ========================================================================= */
            /* 7-DAY MONTH CALENDAR MATRIX (Reference Image 1: SchedulePress Style)      */
            /* ========================================================================= */
            <div className="overflow-hidden rounded-2xl border border-white/10 bg-surface shadow-xl">
              {/* Day Headers (Sun - Sat) */}
              <div className="grid grid-cols-7 border-b border-white/10 bg-surface-2 text-center">
                {['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map((day, index) => (
                  <div key={day} className="py-3 text-[11px] font-black uppercase tracking-wider text-text-muted border-r border-white/5 last:border-r-0">
                    <span className="hidden sm:inline">{day}</span>
                    <span className="sm:hidden">{day.slice(0, 3)}</span>
                  </div>
                ))}
              </div>

              {/* Month Grid Cells */}
              <div className="grid grid-cols-7 divide-x divide-y divide-white/10 bg-surface">
                {calendarMatrix.map(cell => {
                  const daySlots = slotsByDate[cell.dateStr] || [];
                  const isToday = cell.dateStr === new Date().toISOString().slice(0, 10);

                  return (
                    <div
                      key={cell.dateStr}
                      className={`group relative min-h-[140px] p-2 transition-colors flex flex-col justify-between ${
                        !cell.isCurrentMonth
                          ? 'bg-black/40 text-text-muted/40'
                          : isToday
                            ? 'bg-brand/5'
                            : 'bg-surface hover:bg-surface-2/40'
                      }`}
                    >
                      {/* Cell Header: Date Number + Quick Add */}
                      <div className="flex items-center justify-between">
                        <span
                          className={`flex h-6 w-6 items-center justify-center rounded-full font-mono text-xs font-black ${
                            isToday
                              ? 'bg-brand text-white shadow-md shadow-brand/30'
                              : cell.isCurrentMonth
                                ? 'text-white'
                                : 'text-text-muted'
                          }`}
                        >
                          {cell.date.getDate()}
                        </span>

                        <button
                          type="button"
                          onClick={() => {
                            setSlotContext({ scheduled_date: cell.dateStr, scheduled_time: '11:00' });
                            setActiveTab('composer');
                          }}
                          className="opacity-0 group-hover:opacity-100 flex h-5 w-5 items-center justify-center rounded-md border border-white/10 bg-surface-2 text-[10px] text-text-muted hover:border-brand hover:text-brand transition-all"
                          title={`Schedule post for ${cell.dateStr}`}
                        >
                          +
                        </button>
                      </div>

                      {/* Day Slots List */}
                      <div className="my-1.5 space-y-1.5 flex-1">
                        {daySlots.map(slot => {
                          const series = slot.social_content_series || {};
                          const icon = SERIES_ICONS[series.slug] || 'solar:posts-carousel-vertical-linear';
                          const candidate = slot.candidate;
                          const isScheduled = slot.status === 'scheduled';
                          const isPublished = slot.status === 'published';

                          return (
                            <button
                              key={slot.id}
                              type="button"
                              onClick={() => setSelectedSlotForReview(slot)}
                              className={`w-full text-left rounded-lg p-1.5 border transition-all shadow-sm hover:scale-[1.02] active:scale-95 ${
                                isPublished
                                  ? 'border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/15'
                                  : isScheduled
                                    ? 'border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/15'
                                    : 'border-white/10 bg-surface-2 hover:border-brand/40 hover:bg-surface-3'
                              }`}
                            >
                              <div className="flex items-center justify-between gap-1">
                                <span className="font-mono text-[9px] font-bold text-text-muted">
                                  {slot.scheduled_time?.slice(0, 5) || '11:00'}
                                </span>
                                <span
                                  className={`rounded px-1 text-[8px] font-black uppercase ${
                                    isPublished
                                      ? 'bg-emerald-500/20 text-emerald-400'
                                      : isScheduled
                                        ? 'bg-amber-500/20 text-amber-400'
                                        : 'bg-brand/20 text-brand'
                                  }`}
                                >
                                  {isPublished ? 'Live' : isScheduled ? 'Sched' : 'Plan'}
                                </span>
                              </div>

                              <div className="mt-1 flex items-center gap-1.5">
                                {candidate?.imageUrl ? (
                                  <img
                                    src={candidate.imageUrl}
                                    alt=""
                                    className="h-5 w-5 rounded-md object-cover border border-white/10 shrink-0"
                                  />
                                ) : (
                                  <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-surface-3 text-text-muted">
                                    <Icon icon={icon} width="10" />
                                  </div>
                                )}
                                <span className="truncate text-[10px] font-black text-white leading-tight">
                                  {candidate?.name || series.name || 'Post'}
                                </span>
                              </div>
                            </button>
                          );
                        })}
                      </div>

                      {/* Day bottom indicator */}
                      <div className="text-right">
                        {daySlots.length > 0 && (
                          <span className="text-[9px] font-mono text-text-muted">
                            {daySlots.length} {daySlots.length === 1 ? 'item' : 'items'}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            /* ========================================================================= */
            /* CARD VIEW MODE                                                           */
            /* ========================================================================= */
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
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
                    className={`group flex flex-col justify-between rounded-2xl border p-4 transition-all shadow-md ${
                      isPublished
                        ? 'border-emerald-500/30 bg-surface'
                        : isScheduled
                          ? 'border-amber-500/30 bg-surface'
                          : 'border-white/10 bg-surface hover:border-brand/50 hover:bg-surface-2'
                    }`}
                  >
                    <div>
                      {/* Header: Date + Status */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <span className="rounded-lg bg-surface-2 px-2.5 py-1 font-mono text-xs font-bold text-white border border-white/5">
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
                      <div className="mt-3 flex items-center gap-1.5 text-brand">
                        <Icon icon={icon} width="16" />
                        <span className="text-xs font-black uppercase tracking-wider truncate">
                          {series.name || 'Editorial Series'}
                        </span>
                      </div>

                      {/* Auto-Assigned Candidate Box */}
                      <div className="mt-3 flex items-center gap-3 rounded-xl border border-white/10 bg-surface-2 p-3">
                        <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg border border-white/10 bg-surface">
                          {candidate?.imageUrl ? (
                            <img src={candidate.imageUrl} alt="" className="h-full w-full object-cover" />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-text-muted">
                              <Icon icon="solar:user-star-linear" width="22" />
                            </div>
                          )}
                        </div>

                        <div className="min-w-0 flex-1">
                          <span className="truncate text-xs font-black text-white block">
                            {candidate?.name || 'Curated Nollywood Star'}
                          </span>
                          <p className="truncate text-[10px] text-text-muted mt-0.5">
                            {candidate?.subtext || series.description || 'Ready for review'}
                          </p>
                        </div>
                      </div>

                      {slot.selection && candidate && (
                        <div className="mt-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-3 py-2">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[9px] font-black uppercase tracking-wider text-emerald-400">Match Reason</span>
                            <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 font-mono text-[9px] font-bold text-emerald-400">
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
                    <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-between">
                      <span className="text-[10px] font-black uppercase tracking-wider text-text-muted">
                        {series.category || 'Editorial'}
                      </span>
                      <button
                        type="button"
                        onClick={() => setSelectedSlotForReview(slot)}
                        className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-bold transition-all shadow-sm ${
                          isScheduled || isPublished
                            ? 'border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20'
                            : 'bg-brand text-white hover:bg-brand-hover shadow-brand/20 active:scale-95'
                        }`}
                      >
                        <Icon icon={isScheduled || isPublished ? 'solar:check-circle-bold' : 'solar:bolt-bold'} width="14" />
                        <span>{isPublished ? 'View Post' : isScheduled ? 'Scheduled' : 'Review & Schedule'}</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 5. TAB 2: QUEUE & SCHEDULED POSTS (SchedulePress / Pastis Style)          */}
      {/* ========================================================================= */}
      {activeTab === 'drafts' && (
        <div className="space-y-5">
          {/* Header & Filter Bar */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between rounded-2xl border border-white/10 bg-surface p-4 shadow-sm">
            <div className="flex items-center gap-2">
              <Icon icon="solar:posts-carousel-vertical-bold" className="text-brand" width="22" />
              <div>
                <h2 className="text-sm font-black uppercase tracking-widest text-white">Queue & Scheduled Content</h2>
                <p className="text-[11px] text-text-muted">Manage scheduled jobs, review drafts, and trigger instant publishing.</p>
              </div>
            </div>

            {/* Filter Pills */}
            <div className="flex items-center gap-1 rounded-xl border border-white/10 bg-surface-2 p-1">
              {[
                { key: 'all', label: 'All' },
                { key: 'scheduled', label: 'Scheduled' },
                { key: 'draft', label: 'Drafts' },
                { key: 'published', label: 'Published' },
              ].map(tab => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setQueueFilterStatus(tab.key)}
                  className={`rounded-lg px-3 py-1 text-xs font-bold transition-all ${
                    queueFilterStatus === tab.key
                      ? 'bg-brand text-white shadow-sm'
                      : 'text-text-muted hover:text-text-primary'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {draftsLoading ? (
            <div className="rounded-2xl border border-white/10 bg-surface p-16 text-center shadow-xl">
              <Icon icon="solar:spinner-linear" className="mx-auto animate-spin text-brand" width="32" />
              <p className="mt-3 text-sm font-bold text-white">Loading content queue…</p>
            </div>
          ) : filteredDrafts.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-white/15 bg-surface/50 p-12 text-center">
              <p className="text-sm text-text-muted">No content items found in this view. Create a new post or approve a slot from the 30-Day Plan.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredDrafts.map(item => {
                const variants = asRelationArray(item.social_platform_variants);
                const assets = asRelationArray(item.social_assets);
                const selectedAssetId = variants.find(variant => variant.selected_asset_id)?.selected_asset_id;
                const carouselPreviewUrl = variants.find(variant =>
                  Array.isArray(variant.platform_options?.carousel_asset_urls) && variant.platform_options.carousel_asset_urls.length
                )?.platform_options.carousel_asset_urls[0];
                const previewAsset = carouselPreviewUrl
                  ? { public_url: carouselPreviewUrl, format: 'carousel' }
                  : assets.find(asset => asset.id === selectedAssetId) || assets[0];
                const canChangeQueueItem = !['publishing', 'partially_published', 'published'].includes(item.status);
                const isExpanded = Boolean(expandedCaptions[item.id]);

                const scheduledTime = item.scheduled_for || variants.find(v => v.scheduled_for)?.scheduled_for;
                const publishedTime = item.published_at || (item.status === 'published' ? item.updated_at : null);

                return (
                  <div
                    key={item.id}
                    className="group relative rounded-2xl border border-white/10 bg-surface p-5 shadow-lg hover:border-white/20 transition-all space-y-4"
                  >
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      {/* Left: Thumbnail & Replace */}
                      <div className="flex items-start gap-4 shrink-0">
                        <div className="relative">
                          <SocialAssetThumbnail asset={previewAsset} />
                          <input
                            type="file"
                            accept="image/*,video/*,.mp4,.webm,.mov"
                            ref={el => (fileInputRefs.current[item.id] = el)}
                            onChange={async (e) => {
                              const file = e.target.files?.[0];
                              if (!file) return;
                              setUploadingAssetId(item.id);
                              try {
                                const upload = await uploadAdminSocialMedia(file, 'social-published-assets');
                                if (upload.error || !upload.url) throw new Error(upload.error || 'The uploaded media has no public URL');
                                const publicUrl = upload.url;
                                const res = await fetch('/api/social?task=attach_custom_asset', {
                                  method: 'POST',
                                  headers: { ...(await authHeaders()), 'Content-Type': 'application/json' },
                                  body: JSON.stringify({ contentItemId: item.id, publicUrl }),
                                });
                                const data = await res.json().catch(() => ({}));
                                if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
                                toast.success('Custom artwork uploaded & attached!');
                                setDrafts(current => current.map(draft => draft.id === item.id
                                  ? {
                                      ...draft,
                                      social_assets: [
                                        { id: data.id, public_url: publicUrl, format: data.format, width: data.width, height: data.height },
                                        ...asRelationArray(draft.social_assets).filter(asset => asset.id !== data.id),
                                      ],
                                      social_platform_variants: asRelationArray(draft.social_platform_variants).map(variant => ({
                                        ...variant,
                                        selected_asset_id: data.id,
                                      })),
                                    }
                                  : draft));
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
                            className="mt-2 w-full inline-flex items-center justify-center gap-1 rounded-lg bg-surface-2 border border-white/10 px-2 py-1 text-[10px] font-bold text-white hover:bg-surface-3 hover:text-brand disabled:opacity-50 transition-colors"
                          >
                            <Icon icon={uploadingAssetId === item.id ? 'solar:spinner-linear' : 'solar:upload-track-2-linear'} className={uploadingAssetId === item.id ? 'animate-spin' : ''} width="12" />
                            <span>{uploadingAssetId === item.id ? 'Uploading…' : 'Replace Media'}</span>
                          </button>

                          {/* Quick Download Buttons for All Assets */}
                          {assets.length > 0 && (
                            <div className="mt-1.5 flex flex-wrap gap-1">
                              {assets.map((ast, aIdx) => (
                                <a
                                  key={ast.id || aIdx}
                                  href={ast.public_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  download
                                  className="inline-flex items-center gap-1 rounded-md bg-white/10 px-2 py-0.5 text-[9px] font-bold text-white hover:bg-brand hover:text-white transition-colors"
                                  title={`Download ${ast.format?.replace(/_/g, ' ') || 'media'}`}
                                >
                                  <Icon icon="solar:download-minimalistic-bold" width="10" />
                                  <span>{assets.length > 1 ? (ast.format?.includes('9_16') ? '9:16' : ast.format?.includes('1_1') ? '1:1' : `#${aIdx + 1}`) : 'Download'}</span>
                                </a>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Title, Badges, Schedule Timing & Platforms */}
                        <div className="flex-1 min-w-0 space-y-2.5">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-base font-black text-white tracking-tight">{item.title}</h3>
                            <Pill tone={STATUS_TONES[item.status] || 'neutral'}>
                              {item.status}
                            </Pill>
                            <span className="rounded-md bg-surface-2 border border-white/5 px-2 py-0.5 text-[10px] font-bold text-text-muted">
                              {item.content_type?.replace(/_/g, ' ')}
                            </span>
                          </div>

                          {/* Timing Banner */}
                          <div className="flex flex-wrap items-center gap-3 text-xs text-text-muted font-mono">
                            {item.status === 'scheduled' && scheduledTime ? (
                              <span className="inline-flex items-center gap-1.5 font-bold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2.5 py-1 rounded-lg">
                                <Icon icon="solar:clock-circle-bold" width="14" />
                                Scheduled: {new Date(scheduledTime).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
                              </span>
                            ) : item.status === 'published' && publishedTime ? (
                              <span className="inline-flex items-center gap-1.5 font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-lg">
                                <Icon icon="solar:check-circle-bold" width="14" />
                                Published on {new Date(publishedTime).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
                              </span>
                            ) : (
                              <span>Created {new Date(item.created_at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}</span>
                            )}
                          </div>

                          {/* Platform Badges with Quick Include/Exclude Toggle */}
                          <div className="flex flex-wrap gap-2 pt-1">
                            {variants.map(variant => {
                              const icon = {
                                instagram: 'mdi:instagram',
                                threads: 'simple-icons:threads',
                                facebook: 'mdi:facebook',
                                tiktok: 'simple-icons:tiktok',
                                youtube: 'mdi:youtube',
                              }[variant.platform] || 'solar:share-linear';

                              const isExcluded = variant.status === 'cancelled';

                              return (
                                <button
                                  key={variant.id}
                                  type="button"
                                  onClick={async () => {
                                    if (!canChangeQueueItem) return;
                                    const nextStatus = isExcluded ? 'draft' : 'cancelled';
                                    setDrafts(current => current.map(draft => draft.id === item.id
                                      ? {
                                          ...draft,
                                          social_platform_variants: asRelationArray(draft.social_platform_variants).map(v => v.id === variant.id ? { ...v, status: nextStatus } : v),
                                        }
                                      : draft));
                                    try {
                                      await fetch('/api/social?task=update_variant_options', {
                                        method: 'POST',
                                        headers: { ...(await authHeaders()), 'Content-Type': 'application/json' },
                                        body: JSON.stringify({ variantId: variant.id, status: nextStatus }),
                                      });
                                      toast.success(`${variant.platform} ${isExcluded ? 'included' : 'excluded from post'}`);
                                    } catch (err) {
                                      toast.error(`Failed to update ${variant.platform}: ${err.message}`);
                                    }
                                  }}
                                  disabled={!canChangeQueueItem}
                                  title={canChangeQueueItem ? `Click to ${isExcluded ? 'include' : 'exclude'} ${variant.platform}` : undefined}
                                  className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs transition-all ${
                                    isExcluded
                                      ? 'border-dashed border-rose-500/30 bg-rose-500/5 text-rose-300 opacity-50 hover:opacity-80'
                                      : 'border-white/10 bg-surface-2 hover:border-brand/40 text-text-primary'
                                  }`}
                                >
                                  <Icon icon={icon} width="14" className={isExcluded ? 'text-rose-400' : 'text-brand'} />
                                  <span className={`capitalize font-bold text-[11px] ${isExcluded ? 'line-through text-rose-300/80' : ''}`}>{variant.platform}</span>
                                  <span className={`text-[9px] uppercase font-mono ${isExcluded ? 'text-rose-400 font-bold' : 'text-text-muted'}`}>
                                    ({isExcluded ? 'off' : variant.status})
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      </div>

                      {/* Right: Actions */}
                      <div className="flex flex-wrap items-center gap-2">
                        {canChangeQueueItem && (
                          <button
                            type="button"
                            onClick={() => openFullStudioEditor(item)}
                            className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-surface-2 px-3 py-1.5 text-xs font-bold text-text-primary hover:border-brand/40 hover:text-brand transition-all shadow-sm"
                          >
                            <Icon icon="solar:pen-2-bold" width="14" />
                            <span>Edit in Studio</span>
                          </button>
                        )}

                        {item.status === 'scheduled' ? (
                          <button
                            type="button"
                            onClick={() => runCancelSchedule(item.id)}
                            className="inline-flex items-center gap-1 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-xs font-bold text-amber-400 hover:bg-amber-500/20 transition-all"
                          >
                            <Icon icon="solar:close-circle-bold" width="14" />
                            <span>Cancel Schedule</span>
                          </button>
                        ) : item.status !== 'published' ? (
                          <button
                            type="button"
                            onClick={() => runPublishNow(item.id, item.status)}
                            disabled={reviewingId === item.id}
                            className="inline-flex items-center gap-1.5 rounded-xl bg-brand px-3.5 py-1.5 text-xs font-black text-white hover:bg-brand-hover shadow-md shadow-brand/20 active:scale-95 transition-all"
                          >
                            <Icon icon="solar:play-bold" width="14" />
                            <span>Publish Now</span>
                          </button>
                        ) : null}

                        {canChangeQueueItem && (
                          <button
                            type="button"
                            onClick={() => deleteQueueItem(item)}
                            className="flex h-8 w-8 items-center justify-center rounded-xl border border-red-500/20 bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-all"
                            title="Delete post"
                          >
                            <Icon icon="solar:trash-bin-trash-bold" width="14" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 6. TAB 3: AD-HOC CUSTOM COMPOSER                                         */}
      {/* ========================================================================= */}
      {activeTab === 'composer' && (
        <SocialDraftComposer
          disabled={!summary.enabled}
          initialDraft={editingDraft}
          onClearDraft={() => setEditingDraft(null)}
          selectedThemeId={selectedThemeId}
          slotContext={slotContext}
          onClearSlot={() => setSlotContext(null)}
          onGenerated={async (res, meta) => {
            await refreshAll();
            if (meta?.action === 'scheduled' || meta?.action === 'published') {
              setActiveTab('drafts');
              setEditingDraft(null);
            }
          }}
        />
      )}

      {/* ========================================================================= */}
      {/* 7. TAB 4: TELEGRAM INTAKE INBOX                                          */}
      {/* ========================================================================= */}
      {activeTab === 'intake' && (
        <SocialIntakeInbox
          onCreateSocialDraft={async () => {
            await refreshAll();
            setActiveTab('drafts');
          }}
        />
      )}

      {/* ========================================================================= */}
      {/* 8. TAB 5: VIDEO AUTOPILOT PLANNER                                        */}
      {/* ========================================================================= */}
      {activeTab === 'video_plan' && (
        <div className="space-y-5">
          <div className="rounded-2xl border border-violet-500/30 bg-gradient-to-br from-violet-500/10 via-surface to-surface p-6 shadow-xl">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="text-base font-black text-white">Video Autopilot Planner</h3>
                <p className="mt-1 max-w-2xl text-xs text-text-muted leading-relaxed">
                  Automated video generation pipeline: Selects the latest verified Nollywood releases, extracts highlight moments with Gemini, and renders high-res 1:1 and 9:16 video clips locally.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-wider transition-all ${
                    clipperStatus === 'running'
                      ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300 shadow-sm shadow-emerald-500/20'
                      : 'border-rose-500/40 bg-rose-500/10 text-rose-300'
                  }`}
                >
                  <span className={`h-2 w-2 rounded-full ${clipperStatus === 'running' ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400'}`} />
                  {clipperStatus === 'running' ? 'Local Clipper Ready' : 'Local Clipper Offline'}
                </span>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              <label className="text-[10px] font-black uppercase tracking-wider text-text-muted">
                Plan Duration
                <select
                  value={videoPlan.days}
                  onChange={e => setVideoPlan(p => ({ ...p, days: Number(e.target.value) }))}
                  className="mt-1 h-10 w-full rounded-xl border border-white/10 bg-surface px-3 text-xs font-bold text-white outline-none"
                >
                  <option value="7">7 days (21 clips)</option>
                  <option value="14">14 days (42 clips)</option>
                  <option value="30">30 days (90 clips)</option>
                </select>
              </label>

              <label className="text-[10px] font-black uppercase tracking-wider text-text-muted">
                Start Date
                <input
                  type="date"
                  value={videoPlan.startDate}
                  onChange={e => setVideoPlan(p => ({ ...p, startDate: e.target.value }))}
                  className="mt-1 h-10 w-full rounded-xl border border-white/10 bg-surface px-3 text-xs font-bold text-white outline-none cursor-pointer"
                />
              </label>

              <label className="text-[10px] font-black uppercase tracking-wider text-text-muted">
                Slot 1 Time
                <input
                  type="time"
                  value={videoPlan.slot1Time}
                  onChange={e => setVideoPlan(p => ({ ...p, slot1Time: e.target.value }))}
                  className="mt-1 h-10 w-full rounded-xl border border-white/10 bg-surface px-3 text-xs font-bold text-white outline-none cursor-pointer"
                />
              </label>

              <label className="text-[10px] font-black uppercase tracking-wider text-text-muted">
                Slot 2 Time
                <input
                  type="time"
                  value={videoPlan.slot2Time}
                  onChange={e => setVideoPlan(p => ({ ...p, slot2Time: e.target.value }))}
                  className="mt-1 h-10 w-full rounded-xl border border-white/10 bg-surface px-3 text-xs font-bold text-white outline-none cursor-pointer"
                />
              </label>

              <label className="text-[10px] font-black uppercase tracking-wider text-text-muted">
                Slot 3 Time
                <input
                  type="time"
                  value={videoPlan.slot3Time}
                  onChange={e => setVideoPlan(p => ({ ...p, slot3Time: e.target.value }))}
                  className="mt-1 h-10 w-full rounded-xl border border-white/10 bg-surface px-3 text-xs font-bold text-white outline-none cursor-pointer"
                />
              </label>

              <label className="text-[10px] font-black uppercase tracking-wider text-text-muted">
                Clip Length
                <select
                  value={videoPlan.clipLength}
                  onChange={e => setVideoPlan(p => ({ ...p, clipLength: Number(e.target.value) }))}
                  className="mt-1 h-10 w-full rounded-xl border border-white/10 bg-surface px-3 text-xs font-bold text-white outline-none"
                >
                  <option value="15">15 seconds</option>
                  <option value="30">30 seconds</option>
                  <option value="45">45 seconds</option>
                  <option value="60">60 seconds</option>
                </select>
              </label>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={buildVideoPlanRows}
                disabled={videoAutopilot.running}
                className="rounded-xl bg-violet-600 px-4 py-2.5 text-xs font-black text-white hover:bg-violet-500 shadow-md shadow-violet-600/20 disabled:opacity-50 transition-all"
              >
                Build {videoPlan.days}-Day Video Plan
              </button>

              <button
                type="button"
                onClick={runDailyVideoAutopilot}
                disabled={videoAutopilot.running}
                className="rounded-xl border border-violet-500/40 bg-violet-500/15 px-4 py-2.5 text-xs font-black text-violet-200 hover:bg-violet-500/25 disabled:opacity-50 transition-all"
              >
                {videoAutopilot.running ? 'Processing…' : '⚡ Auto-Generate Today’s Clips'}
              </button>
            </div>
          </div>

          {/* Custom Video Plan Rows */}
          <section className="rounded-2xl border border-white/10 bg-surface p-6 shadow-xl">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-4">
              <div>
                <h3 className="text-sm font-black uppercase tracking-wider text-white">Planned Video Clips ({videoRows.length})</h3>
                <p className="mt-0.5 text-xs text-text-muted">Review clips, regenerate AI captions, or adjust crop timings before rendering.</p>
              </div>
              <button
                type="button"
                onClick={addVideoRow}
                className="rounded-xl border border-brand/40 bg-brand/10 px-3.5 py-2 text-xs font-black text-brand hover:bg-brand/20 transition-all"
              >
                ＋ Add Video Clip
              </button>
            </div>

            <div className="mt-4 space-y-3">
              {videoRows.map((row, index) => (
                <div key={row.id} className="rounded-xl border border-white/10 bg-surface-2 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black uppercase tracking-wider text-brand">Clip #{index + 1}</span>
                    <button
                      type="button"
                      onClick={() => removeVideoRow(row.id)}
                      className="text-xs font-bold text-red-400 hover:text-red-300"
                      disabled={videoRows.length === 1}
                    >
                      Remove
                    </button>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
                    <label className="text-[10px] font-black uppercase text-text-muted">
                      Date
                      <input
                        type="date"
                        value={row.date}
                        onChange={e => updateVideoRow(row.id, { date: e.target.value })}
                        className="mt-1 h-9 w-full rounded-lg border border-white/10 bg-surface px-2 text-xs text-white"
                      />
                    </label>

                    <label className="text-[10px] font-black uppercase text-text-muted">
                      Time
                      <input
                        type="time"
                        value={row.time}
                        onChange={e => updateVideoRow(row.id, { time: e.target.value })}
                        className="mt-1 h-9 w-full rounded-lg border border-white/10 bg-surface px-2 text-xs text-white"
                      />
                    </label>

                    <div className="sm:col-span-2 lg:col-span-2">
                      <label className="block text-[10px] font-black uppercase text-text-muted">
                        Film Selection
                      </label>
                      <FilmSearchCombobox
                        value={row.filmId}
                        onChange={(filmId, film) => updateVideoRow(row.id, { filmId, film })}
                        films={videoFilmOptions}
                        placeholder="Search Nollywood films…"
                        className="mt-1"
                      />
                    </div>

                    <div className="sm:col-span-2 lg:col-span-2">
                      <label className="text-[10px] font-black uppercase text-text-muted">
                        Timing Mode
                        <select
                          value={row.mode}
                          onChange={e => updateVideoRow(row.id, { mode: e.target.value })}
                          className="mt-1 h-9 w-full rounded-lg border border-white/10 bg-surface px-2 text-xs text-white"
                        >
                          <option value="gemini">Gemini Auto (Finds Best Scene)</option>
                          <option value="manual">Manual Exact Timing (MM:SS)</option>
                        </select>
                      </label>
                    </div>

                    <div className="col-span-full">
                      <label className="block text-[10px] font-black uppercase text-text-muted mb-1">
                        Formats to Generate ({getRowAspectRatios(row).length} selected)
                      </label>
                      <div className="flex flex-wrap gap-2">
                        {AVAILABLE_ASPECT_RATIOS.map(fmt => {
                          const activeFormats = getRowAspectRatios(row);
                          const isSelected = activeFormats.includes(fmt.id);
                          return (
                            <button
                              key={fmt.id}
                              type="button"
                              onClick={() => {
                                let next;
                                if (isSelected) {
                                  next = activeFormats.filter(f => f !== fmt.id);
                                  if (next.length === 0) next = [fmt.id];
                                } else {
                                  next = [...activeFormats, fmt.id];
                                }
                                updateVideoRow(row.id, { aspectRatios: next });
                              }}
                              className={`h-8 px-3 rounded-lg border text-xs font-bold transition-all flex items-center gap-2 ${
                                isSelected
                                  ? 'border-brand bg-brand/20 text-brand-light shadow-sm shadow-brand/20'
                                  : 'border-white/10 bg-surface text-text-muted hover:border-white/20 hover:text-white'
                              }`}
                              title={`${fmt.label} (${fmt.subtitle})`}
                            >
                              <span className={`w-2 h-2 rounded-full ${isSelected ? 'bg-brand' : 'bg-white/20'}`} />
                              <span>{fmt.label}</span>
                              <span className="text-[10px] opacity-70">({fmt.subtitle})</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-end gap-2.5">
                    <label className="text-[10px] font-black uppercase text-text-muted">
                      Start Time (MM:SS)
                      <input
                        type="text"
                        placeholder="e.g. 22:22"
                        value={row.start}
                        onChange={e => updateVideoRow(row.id, { start: e.target.value })}
                        disabled={row.mode === 'gemini'}
                        className="mt-1 h-9 w-28 rounded-lg border border-white/10 bg-surface px-2.5 text-xs text-white placeholder:text-white/30 disabled:opacity-50 focus:border-brand"
                      />
                    </label>

                    <label className="text-[10px] font-black uppercase text-text-muted">
                      End Time (MM:SS)
                      <input
                        type="text"
                        placeholder="e.g. 24:30"
                        value={row.end}
                        onChange={e => updateVideoRow(row.id, { end: e.target.value })}
                        disabled={row.mode === 'gemini'}
                        className="mt-1 h-9 w-28 rounded-lg border border-white/10 bg-surface px-2.5 text-xs text-white placeholder:text-white/30 disabled:opacity-50 focus:border-brand"
                      />
                    </label>

                    {(() => {
                      const s = parseTimestampToSeconds(row.start);
                      const e = parseTimestampToSeconds(row.end);
                      const duration = Math.max(0, e - s);
                      if (duration > 0) {
                        return (
                          <div className="flex h-9 items-center rounded-lg border border-brand/30 bg-brand/10 px-2.5 text-[11px] font-semibold text-brand-light">
                            ⏱️ {duration}s ({Math.floor(duration / 60) > 0 ? `${Math.floor(duration / 60)}m ` : ''}${duration % 60}s)
                          </div>
                        );
                      }
                      return null;
                    })()}

                    {/* AI Engine Switcher (Gemini / Cohere) */}
                    <div className="inline-flex h-9 items-center rounded-lg border border-white/10 bg-surface p-0.5 text-[10px] font-bold">
                      <button
                        type="button"
                        onClick={() => updateVideoRow(row.id, { engine: 'gemini' })}
                        className={`h-full rounded px-2.5 transition-all flex items-center gap-1 ${
                          (row.engine || 'gemini') === 'gemini'
                            ? 'bg-violet-600 text-white shadow-xs'
                            : 'text-text-muted hover:text-white'
                        }`}
                      >
                        <span>⚡ Gemini</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => updateVideoRow(row.id, { engine: 'cohere' })}
                        className={`h-full rounded px-2.5 transition-all flex items-center gap-1 ${
                          row.engine === 'cohere'
                            ? 'bg-brand text-white shadow-xs'
                            : 'text-text-muted hover:text-white'
                        }`}
                      >
                        <span>🪄 Cohere</span>
                      </button>
                    </div>

                    {/* Tone / Editorial Angle Selector */}
                    <select
                      value={row.angle || 'editorial'}
                      onChange={e => updateVideoRow(row.id, { angle: e.target.value })}
                      className="h-9 rounded-lg border border-white/10 bg-surface px-2.5 text-xs font-bold text-white outline-none focus:border-brand"
                    >
                      {VIDEO_COPY_ANGLES.map(a => (
                        <option key={a.value} value={a.value}>
                          {a.label}
                        </option>
                      ))}
                    </select>

                    <button
                      type="button"
                      onClick={() => generateRowCaption(row)}
                      disabled={row.generatingCaption || !row.filmId}
                      className="h-9 rounded-lg border border-violet-400/40 bg-violet-500/15 px-3 text-xs font-bold text-violet-200 hover:bg-violet-500/25 transition-all flex items-center gap-1.5 disabled:opacity-50"
                    >
                      {row.generatingCaption ? (
                        <>
                          <Icon icon="solar:spinner-linear" className="animate-spin" width="14" />
                          <span>Generating…</span>
                        </>
                      ) : (
                        <>
                          <Icon icon="solar:magic-stick-3-bold" width="14" />
                          <span>Generate 3 Variations ({(row.engine || 'gemini').toUpperCase()})</span>
                        </>
                      )}
                    </button>
                  </div>

                  {/* 3 Variations Pills (Option A / Option B / Option C) */}
                  {Array.isArray(row.variations) && row.variations.length > 0 && (
                    <div className="rounded-xl border border-white/10 bg-surface/60 p-2.5 space-y-1.5">
                      <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-wider text-text-muted">
                        <span>Select Copy Variation</span>
                        <span className="text-violet-400 font-mono text-[9px]">Engine: {row.engine || 'gemini'} · Tone: {row.angle || 'editorial'}</span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        {row.variations.map(v => {
                          const isSelected = (row.selectedVariationKey || 'B') === v.key || row.caption === v.text;
                          return (
                            <button
                              key={v.key}
                              type="button"
                              onClick={() => {
                                updateVideoRow(row.id, {
                                  caption: v.text,
                                  selectedVariationKey: v.key,
                                });
                                toast.success(`Switched to Option ${v.key} (${v.label})`);
                              }}
                              className={`rounded-lg border p-2 text-left transition-all ${
                                isSelected
                                  ? 'border-brand bg-brand/15 text-white ring-1 ring-brand shadow-xs'
                                  : 'border-white/10 bg-surface text-text-muted hover:border-white/20 hover:text-white'
                              }`}
                            >
                              <div className="flex items-center justify-between text-xs font-black">
                                <span>Option {v.key}: {v.label}</span>
                                {isSelected && <Icon icon="solar:check-circle-bold" className="text-brand" width="14" />}
                              </div>
                              <p className="mt-1 text-[10px] line-clamp-2 leading-relaxed opacity-90">{v.text}</p>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  <label className="block text-[10px] font-black uppercase text-text-muted">
                    Caption
                    <textarea
                      value={row.caption}
                      onChange={e => updateVideoRow(row.id, { caption: e.target.value })}
                      rows={2}
                      placeholder="Write social caption or generate one with AI…"
                      className="mt-1 w-full rounded-lg border border-white/10 bg-surface px-3 py-2 text-xs text-white outline-none focus:border-brand"
                    />
                  </label>

                  <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/5 pt-2">
                    <div className="text-[11px] text-text-muted">
                      {row.filmId ? (
                        <span>Ready to clip {getRowAspectRatios(row).join(' & ')} formats ({row.start} – {row.end})</span>
                      ) : (
                        <span className="text-amber-300/80">Select a film to enable rendering</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => prepareCustomVideoPlan('draft', row)}
                        disabled={videoAutopilot.running || clipperStatus !== 'running' || !row.filmId}
                        className="flex h-8 items-center gap-1.5 rounded-lg bg-brand px-3.5 text-xs font-bold text-white shadow-sm shadow-brand/20 transition-all hover:bg-brand-hover disabled:opacity-50"
                      >
                        <Icon icon="solar:clapperboard-play-bold" width="14" />
                        <span>Render This Clip (Draft)</span>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-5 flex flex-wrap gap-2.5">
              <button
                type="button"
                onClick={() => prepareCustomVideoPlan('draft')}
                disabled={videoAutopilot.running || clipperStatus !== 'running'}
                className="rounded-xl bg-brand px-5 py-2.5 text-xs font-black text-white hover:bg-brand-hover disabled:opacity-50 shadow-md shadow-brand/20 transition-all"
              >
                {videoAutopilot.running ? 'Processing…' : 'Render & Save to Drafts'}
              </button>

              <button
                type="button"
                onClick={() => prepareCustomVideoPlan('schedule')}
                disabled={videoAutopilot.running || clipperStatus !== 'running'}
                className="rounded-xl border border-amber-400/40 bg-amber-500/15 px-5 py-2.5 text-xs font-black text-amber-300 hover:bg-amber-500/25 disabled:opacity-50 transition-all"
              >
                Schedule All
              </button>

              <button
                type="button"
                onClick={() => prepareCustomVideoPlan('publish')}
                disabled={videoAutopilot.running || clipperStatus !== 'running'}
                className="rounded-xl border border-emerald-400/40 bg-emerald-500/15 px-5 py-2.5 text-xs font-black text-emerald-300 hover:bg-emerald-500/25 disabled:opacity-50 transition-all"
              >
                Post All Now
              </button>
            </div>
            {clipperStatus !== 'running' && (
              <div className="mt-4 flex items-center gap-2.5 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-xs text-amber-200">
                <Icon icon="solar:info-circle-bold" className="text-base text-amber-400 shrink-0" />
                <div>
                  <span className="font-bold">Local FFmpeg Clipper is offline.</span> Start the clipper service by running{' '}
                  <code className="rounded bg-black/40 px-1.5 py-0.5 font-mono text-[11px] text-amber-300">
                    powershell scripts\start-local-social-clipper.ps1
                  </code>{' '}
                  in your terminal to enable video rendering.
                </div>
              </div>
            )}
          </section>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 9. CHANNELS HUB MODAL (SchedulePress Inspired Reference Image 3)          */}
      {/* ========================================================================= */}
      {channelsModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
          <div className="relative max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-2xl border border-white/15 bg-surface p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand/10 text-brand border border-brand/20">
                  <Icon icon="solar:share-circle-bold" width="22" />
                </div>
                <div>
                  <h3 className="text-base font-black text-white">Social Profiles & Channel Connections</h3>
                  <p className="text-xs text-text-muted">Link and authenticate your official brand accounts for automated publishing.</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setChannelsModalOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-text-muted hover:bg-surface-2 hover:text-white"
              >
                <Icon icon="solar:close-circle-bold" width="20" />
              </button>
            </div>

            {/* Platform Grid */}
            <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
              {/* Instagram Card */}
              <div className="flex flex-col justify-between rounded-xl border border-white/10 bg-surface-2 p-5 shadow-sm">
                <div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#E1306C]/15 text-[#E1306C] border border-[#E1306C]/20">
                        <Icon icon="mdi:instagram" width="22" />
                      </div>
                      <div>
                        <h4 className="text-sm font-black text-white">Instagram</h4>
                        <p className="text-[11px] text-text-muted">Feed Posts, Reels & Carousels</p>
                      </div>
                    </div>
                    <Pill tone={connections.platforms.instagram ? 'green' : 'amber'}>
                      {connections.platforms.instagram ? 'Active' : 'Offline'}
                    </Pill>
                  </div>

                  <div className="mt-4 space-y-1.5 text-xs">
                    <div className="flex justify-between text-text-muted">
                      <span>Connected Profile:</span>
                      <span className="font-mono font-bold text-white">
                        {connections.platforms.instagram ? `@${connections.platforms.instagram.username}` : 'Not connected'}
                      </span>
                    </div>
                    {connections.platforms.instagram?.displayName && (
                      <div className="flex justify-between text-text-muted">
                        <span>Account Name:</span>
                        <span className="font-bold text-text-secondary">{connections.platforms.instagram.displayName}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-white/10 pt-4">
                  {connections.platforms.instagram && (
                    <button
                      type="button"
                      onClick={() => disconnectAccount('instagram')}
                      disabled={connections.connecting}
                      className="rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-1.5 text-xs font-bold text-red-400 hover:bg-red-500/20 disabled:opacity-50"
                    >
                      Disconnect
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={connectMeta}
                    disabled={connections.connecting}
                    className="rounded-xl bg-[#E1306C] px-4 py-1.5 text-xs font-black text-white hover:opacity-90 disabled:opacity-50 shadow-md"
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
                    className="rounded-xl border border-white/10 bg-surface px-3 py-1.5 text-xs font-bold text-text-muted hover:text-white"
                  >
                    Token
                  </button>
                </div>
              </div>

              {/* Threads Card */}
              <div className="flex flex-col justify-between rounded-xl border border-white/10 bg-surface-2 p-5 shadow-sm">
                <div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 text-white border border-white/20">
                        <Icon icon="simple-icons:threads" width="22" />
                      </div>
                      <div>
                        <h4 className="text-sm font-black text-white">Threads</h4>
                        <p className="text-[11px] text-text-muted">Meta Threads API</p>
                      </div>
                    </div>
                    <Pill tone={connections.platforms.threads ? 'green' : 'amber'}>
                      {connections.platforms.threads ? 'Active' : 'Offline'}
                    </Pill>
                  </div>

                  <div className="mt-4 space-y-1.5 text-xs">
                    <div className="flex justify-between text-text-muted">
                      <span>Connected Profile:</span>
                      <span className="font-mono font-bold text-white">
                        {connections.platforms.threads ? `@${connections.platforms.threads.username}` : 'Not connected'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-white/10 pt-4">
                  {connections.platforms.threads && (
                    <button
                      type="button"
                      onClick={() => disconnectAccount('threads')}
                      disabled={connections.connecting}
                      className="rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-1.5 text-xs font-bold text-red-400 hover:bg-red-500/20 disabled:opacity-50"
                    >
                      Disconnect
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={connectThreads}
                    disabled={connections.connecting}
                    className="rounded-xl bg-white px-4 py-1.5 text-xs font-black text-black hover:opacity-90 disabled:opacity-50 shadow-md"
                  >
                    ⚡ Connect Threads
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setManualConnectPlatform('threads');
                      setManualFormData({
                        username: connections.platforms.threads?.username || 'muvidb_',
                        displayName: connections.platforms.threads?.displayName || 'MuviDB Threads',
                        externalAccountId: connections.platforms.threads?.externalAccountId || 'muvidb_threads_id',
                        accessToken: '',
                      });
                    }}
                    className="rounded-xl border border-white/10 bg-surface px-3 py-1.5 text-xs font-bold text-text-muted hover:text-white"
                  >
                    Token
                  </button>
                </div>
              </div>

              {/* Facebook Card */}
              <div className="flex flex-col justify-between rounded-xl border border-white/10 bg-surface-2 p-5 shadow-sm">
                <div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#1877F2]/15 text-[#1877F2] border border-[#1877F2]/20">
                        <Icon icon="mdi:facebook" width="22" />
                      </div>
                      <div>
                        <h4 className="text-sm font-black text-white">Facebook</h4>
                        <p className="text-[11px] text-text-muted">Official Pages & Group Posts</p>
                      </div>
                    </div>
                    <Pill tone={connections.platforms.facebook ? 'green' : 'amber'}>
                      {connections.platforms.facebook ? 'Active' : 'Offline'}
                    </Pill>
                  </div>

                  <div className="mt-4 space-y-1.5 text-xs">
                    <div className="flex justify-between text-text-muted">
                      <span>Connected Page:</span>
                      <span className="font-mono font-bold text-white">
                        {connections.platforms.facebook ? `@${connections.platforms.facebook.username}` : 'Not connected'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-white/10 pt-4">
                  {connections.platforms.facebook && (
                    <button
                      type="button"
                      onClick={() => disconnectAccount('facebook')}
                      disabled={connections.connecting}
                      className="rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-1.5 text-xs font-bold text-red-400 hover:bg-red-500/20 disabled:opacity-50"
                    >
                      Disconnect
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={connectMeta}
                    disabled={connections.connecting}
                    className="rounded-xl bg-[#1877F2] px-4 py-1.5 text-xs font-black text-white hover:opacity-90 disabled:opacity-50 shadow-md"
                  >
                    ⚡ Connect Facebook
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
                    className="rounded-xl border border-white/10 bg-surface px-3 py-1.5 text-xs font-bold text-text-muted hover:text-white"
                  >
                    Token
                  </button>
                </div>
              </div>

              {/* TikTok Card */}
              <div className="flex flex-col justify-between rounded-xl border border-white/10 bg-surface-2 p-5 shadow-sm">
                <div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-black text-[#25F4EE] border border-[#25F4EE]/30 shadow-md">
                        <Icon icon="simple-icons:tiktok" width="22" />
                      </div>
                      <div>
                        <h4 className="text-sm font-black text-white">TikTok</h4>
                        <p className="text-[11px] text-text-muted">Vertical Video Clips & Shorts</p>
                      </div>
                    </div>
                    <Pill tone={connections.platforms.tiktok ? 'green' : 'amber'}>
                      {connections.platforms.tiktok ? 'Active' : 'Offline'}
                    </Pill>
                  </div>

                  <div className="mt-4 space-y-1.5 text-xs">
                    <div className="flex justify-between text-text-muted">
                      <span>Connected Handle:</span>
                      <span className="font-mono font-bold text-white">
                        {connections.platforms.tiktok ? `@${connections.platforms.tiktok.username}` : 'Not connected'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-white/10 pt-4">
                  {connections.platforms.tiktok && (
                    <button
                      type="button"
                      onClick={() => disconnectAccount('tiktok')}
                      disabled={connections.connecting}
                      className="rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-1.5 text-xs font-bold text-red-400 hover:bg-red-500/20 disabled:opacity-50"
                    >
                      Disconnect
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={connectTikTok}
                    disabled={connections.connecting}
                    className="rounded-xl bg-black border border-[#25F4EE]/40 text-[#25F4EE] px-4 py-1.5 text-xs font-black hover:bg-surface-3 disabled:opacity-50 shadow-md"
                  >
                    ⚡ Connect TikTok
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
                    className="rounded-xl border border-white/10 bg-surface px-3 py-1.5 text-xs font-bold text-text-muted hover:text-white"
                  >
                    Token
                  </button>
                </div>
              </div>
            </div>

            {/* Manual Token Connection Form */}
            {manualConnectPlatform && (
              <form onSubmit={saveManualConnection} className="mt-6 rounded-2xl border border-brand/30 bg-surface-2 p-5 shadow-xl">
                <div className="flex items-center justify-between border-b border-white/10 pb-3">
                  <div>
                    <h4 className="text-sm font-black text-brand uppercase tracking-wider">
                      Configure {manualConnectPlatform.toUpperCase()} Token Connection
                    </h4>
                    <p className="text-xs text-text-muted">Enter your handle and long-lived access token.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setManualConnectPlatform(null)}
                    className="text-xs text-text-muted hover:text-white"
                  >
                    Cancel
                  </button>
                </div>

                <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="block text-[10px] font-black uppercase text-text-muted">Account Handle</label>
                    <input
                      type="text"
                      required
                      value={manualFormData.username}
                      onChange={e => setManualFormData(prev => ({ ...prev, username: e.target.value }))}
                      placeholder={manualConnectPlatform === 'instagram' ? 'muvidb_' : 'muvidb'}
                      className="mt-1 h-10 w-full rounded-xl border border-white/10 bg-surface px-3 text-xs text-white outline-none focus:border-brand"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-black uppercase text-text-muted">Display Name</label>
                    <input
                      type="text"
                      value={manualFormData.displayName}
                      onChange={e => setManualFormData(prev => ({ ...prev, displayName: e.target.value }))}
                      placeholder="MuviDB Official"
                      className="mt-1 h-10 w-full rounded-xl border border-white/10 bg-surface px-3 text-xs text-white outline-none focus:border-brand"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-[10px] font-black uppercase text-text-muted">API Access Token</label>
                    <input
                      type="password"
                      required
                      value={manualFormData.accessToken}
                      onChange={e => setManualFormData(prev => ({ ...prev, accessToken: e.target.value }))}
                      placeholder="Paste API Access Token"
                      className="mt-1 h-10 w-full rounded-xl border border-white/10 bg-surface px-3 text-xs font-mono text-white outline-none focus:border-brand"
                    />
                  </div>
                </div>

                <div className="mt-4 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setManualConnectPlatform(null)}
                    className="rounded-xl border border-white/10 px-4 py-2 text-xs font-bold text-text-muted hover:text-white"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={connections.connecting}
                    className="rounded-xl bg-brand px-5 py-2 text-xs font-black text-white hover:bg-brand-hover disabled:opacity-50 shadow-md shadow-brand/20"
                  >
                    {connections.connecting ? 'Saving…' : `Save ${manualConnectPlatform} Connection`}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 10. AUTO-PILOT REVIEW & APPROVAL MODAL                                   */}
      {/* ========================================================================= */}
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
