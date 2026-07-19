import { useEffect, useMemo, useState } from 'react';
import { Icon } from '@iconify/react';
import toast from 'react-hot-toast';
import MergeModal from '../../components/admin/MergeModal';
import ImageWithFallback from '../../components/ui/ImageWithFallback';
import { authHeaders } from '../../lib/apiAuth';
import { supabase } from '../../lib/supabase';
import { scanDuplicateRecords } from '../../lib/deduplicator';
import { getPlatform, parseStreamingLinks } from '../../lib/platforms';
import { formatFilmTitle, formatPersonName } from '../../utils/format';
import { getFriendlyErrorMessage } from '../../utils/errors';

const PAGE_SIZE = 160;
const DATABASE_SETUP_MESSAGE = 'Database setup is required before records can be merged. Apply the pending Catalog Deduplicator migration in Supabase, then select Check again.';

const SCAN_FIELDS = {
  people: [
    'id', 'name', 'slug', 'photo_url', 'bio', 'date_of_birth', 'nationality',
    'gender', 'tmdb_id', 'mubi_id', 'instagram_url', 'facebook_url',
    'twitter_url', 'youtube_channel_id', 'youtube_handle', 'is_verified',
    'claimed_by', 'known_for_department', 'popularity_score', 'profile_views',
    'film_count', 'source', 'created_at', 'updated_at',
  ].join(','),
  films: [
    'id', 'title', 'original_title', 'slug', 'poster_url', 'synopsis', 'year',
    'release_date', 'runtime_minutes', 'tmdb_id', 'mubi_id', 'source',
    'source_video_id', 'trailer_youtube_id', 'content_type', 'series_id',
    'season_number', 'episode_number', 'release_type', 'status', 'is_published',
    'view_count', 'needs_review', 'youtube_watch_url', 'streaming_links',
    'trailer_external_url', 'film_watch_links(distributor,url)', 'created_at', 'updated_at',
  ].join(','),
};

const CONFIDENCE = {
  high: { label: 'Strong candidate', tone: 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10' },
  medium: { label: 'Compare records', tone: 'text-amber-400 border-amber-500/30 bg-amber-500/10' },
  review: { label: 'Manual review', tone: 'text-blue-400 border-blue-500/30 bg-blue-500/10' },
  blocked: { label: 'Identity conflict', tone: 'text-red-400 border-red-500/30 bg-red-500/10' },
};

const titleFor = (record, entity) => entity === 'people'
  ? formatPersonName(record.name)
  : formatFilmTitle(record.title);

const imageFor = (record, entity) => entity === 'people' ? record.photo_url : record.poster_url;

const getFilmWatchLinks = (film) => {
  const links = [];
  const seen = new Set();
  const add = (platformId, label, url, icon) => {
    if (typeof url !== 'string' || !/^https?:\/\//i.test(url.trim())) return;
    const normalized = url.trim();
    if (seen.has(normalized)) return;
    seen.add(normalized);
    links.push({ platformId, label, url: normalized, icon });
  };

  add('youtube', 'YouTube', film.youtube_watch_url, 'simple-icons:youtube');
  if (!film.youtube_watch_url && film.source_video_id && (film.source === 'youtube' || film.release_type === 'youtube')) {
    add('youtube', 'YouTube', `https://www.youtube.com/watch?v=${film.source_video_id}`, 'simple-icons:youtube');
  }

  Object.entries(parseStreamingLinks(film)).forEach(([platformId, value]) => {
    const platform = getPlatform(platformId);
    const url = typeof value === 'string' ? value : value?.url;
    add(platformId, platform?.name || platformId.replaceAll('_', ' '), url, platform?.icon || 'solar:play-circle-linear');
  });

  (film.film_watch_links || []).forEach((link) => {
    const platformId = String(link.distributor || 'watch').toLowerCase().replace(/[^a-z0-9]+/g, '_');
    const platform = getPlatform(platformId);
    add(platformId, platform?.name || link.distributor || 'Watch', link.url, platform?.icon || 'solar:play-circle-linear');
  });

  return links;
};

const getFilmTrailerUrl = (film) => {
  if (film.trailer_external_url && /^https?:\/\//i.test(film.trailer_external_url)) return film.trailer_external_url;
  if (film.trailer_youtube_id) return `https://www.youtube.com/watch?v=${film.trailer_youtube_id}`;
  return null;
};

const fetchEveryRow = async (entity, onProgress) => {
  const rows = [];
  const pageSize = 1000;
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .from(entity)
      .select(SCAN_FIELDS[entity])
      .order('id', { ascending: true })
      .range(from, from + pageSize - 1);
    if (error) throw error;
    const page = data || [];
    rows.push(...page);
    onProgress?.(`Reading ${rows.length.toLocaleString()} ${entity}...`);
    if (page.length < pageSize) break;
  }
  return rows;
};

const apiRequest = async (body) => {
  const response = await fetch('/api/deduplicator', {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify(body),
  });
  if (response.status === 404) return null;
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) return null;
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || 'Deduplicator request failed');
  return payload;
};

const getDeduplicatorErrorMessage = (error) => {
  const rawMessage = [error?.message, error?.details, error?.hint, error?.code]
    .filter(Boolean)
    .join(' ');
  const message = rawMessage.toLowerCase();
  if (
    message.includes('database setup is required')
    || message.includes('dedupe_scan_runs')
    || message.includes('dedupe_ignored_pairs')
    || message.includes('merge_people_group')
    || message.includes('merge_films_group')
    || message.includes('pgrst202')
    || message.includes('pgrst205')
  ) {
    return DATABASE_SETUP_MESSAGE;
  }
  if (message.includes('merge blocked:')) return error.message;
  return getFriendlyErrorMessage(error);
};

const ConfidenceBadge = ({ confidence }) => {
  const config = CONFIDENCE[confidence] || CONFIDENCE.review;
  return (
    <span className={`inline-flex h-6 items-center border px-2 text-[9px] font-bold uppercase ${config.tone}`}>
      {config.label}
    </span>
  );
};

const Metric = ({ value, label, accent = false }) => (
  <div className="min-w-0 border-l border-border px-5 py-4 first:border-l-0">
    <div className={`font-heading text-2xl font-bold ${accent ? 'text-brand' : 'text-text-primary'}`}>
      {Number(value || 0).toLocaleString()}
    </div>
    <div className="mt-1 text-[9px] font-bold uppercase text-text-muted">{label}</div>
  </div>
);

export default function AdminDeduplicator() {
  const [entity, setEntity] = useState('people');
  const [reports, setReports] = useState({ people: null, films: null });
  const [isScanning, setIsScanning] = useState(false);
  const [scanStatus, setScanStatus] = useState('');
  const [query, setQuery] = useState('');
  const [confidence, setConfidence] = useState('all');
  const [sort, setSort] = useState('confidence');
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [selectedGroupId, setSelectedGroupId] = useState(null);
  const [primaryId, setPrimaryId] = useState(null);
  const [mergeIds, setMergeIds] = useState([]);
  const [mergeItems, setMergeItems] = useState([]);
  const [isMergeOpen, setIsMergeOpen] = useState(false);
  const [isMerging, setIsMerging] = useState(false);
  const [isDismissing, setIsDismissing] = useState(false);
  const [databaseReady, setDatabaseReady] = useState(null);

  const report = reports[entity];

  useEffect(() => {
    let cancelled = false;
    fetch('/prototypes/people-deduplicator-report.json', { cache: 'no-store' })
      .then((response) => response.ok ? response.json() : null)
      .then((payload) => {
        if (cancelled || !payload) return;
        setReports((current) => ({ ...current, people: payload }));
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const checkDatabaseSetup = async (announce = false) => {
    setDatabaseReady(null);
    const { error } = await supabase.from('dedupe_scan_runs').select('id').limit(1);
    const ready = !error;
    setDatabaseReady(ready);
    if (announce) {
      if (ready) toast.success('Deduplicator database is ready');
      else toast.error(getDeduplicatorErrorMessage(error));
    }
    return ready;
  };

  useEffect(() => {
    checkDatabaseSetup();
  }, []);

  const filteredGroups = useMemo(() => {
    if (!report?.groups) return [];
    const needle = query.trim().toLowerCase();
    const groups = report.groups.filter((group) => {
      if (confidence !== 'all' && group.confidence !== confidence) return false;
      if (!needle) return true;
      return group.records.some((record) => [
        record.name, record.title, record.id, record.source,
        record.instagram_url, record.youtube_handle,
      ].filter(Boolean).join(' ').toLowerCase().includes(needle));
    });

    return groups.sort((left, right) => {
      if (sort === 'records') return right.records.length - left.records.length || right.score - left.score;
      if (sort === 'name') return titleFor(left.records[0], entity).localeCompare(titleFor(right.records[0], entity));
      const order = { high: 0, medium: 1, review: 2, blocked: 3 };
      return order[left.confidence] - order[right.confidence] || right.score - left.score;
    });
  }, [report, confidence, query, sort, entity]);

  const selectedGroup = filteredGroups.find((group) => group.id === selectedGroupId)
    || filteredGroups[0]
    || null;

  useEffect(() => {
    if (!selectedGroup) {
      setSelectedGroupId(null);
      setPrimaryId(null);
      setMergeIds([]);
      return;
    }
    if (selectedGroup.id !== selectedGroupId) setSelectedGroupId(selectedGroup.id);
    const recommended = selectedGroup.recommendedPrimaryId || selectedGroup.records[0]?.id;
    setPrimaryId(recommended);
    setMergeIds(selectedGroup.records.filter((record) => record.id !== recommended).map((record) => record.id));
  }, [selectedGroup?.id, entity]);

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [entity, confidence, query, sort]);

  const scan = async () => {
    setIsScanning(true);
    setScanStatus(`Starting full ${entity} scan...`);
    const started = performance.now();
    try {
      let nextReport = await apiRequest({ action: 'scan', entity });
      if (!nextReport) {
        const records = await fetchEveryRow(entity, setScanStatus);
        setScanStatus(`Comparing ${records.length.toLocaleString()} records...`);
        await new Promise((resolve) => setTimeout(resolve, 30));
        nextReport = scanDuplicateRecords(records, entity);
      }
      setReports((current) => ({ ...current, [entity]: nextReport }));
      setSelectedGroupId(nextReport.groups[0]?.id || null);
      const seconds = ((performance.now() - started) / 1000).toFixed(1);
      toast.success(`Scanned ${nextReport.recordsScanned.toLocaleString()} records in ${seconds}s`);
    } catch (error) {
      toast.error(getDeduplicatorErrorMessage(error));
    } finally {
      setIsScanning(false);
      setScanStatus('');
    }
  };

  const selectGroup = (group) => {
    setSelectedGroupId(group.id);
    const recommended = group.recommendedPrimaryId || group.records[0]?.id;
    setPrimaryId(recommended);
    setMergeIds(group.records.filter((record) => record.id !== recommended).map((record) => record.id));
  };

  const choosePrimary = (id) => {
    setPrimaryId(id);
    setMergeIds(selectedGroup.records.filter((record) => record.id !== id).map((record) => record.id));
  };

  const toggleMerge = (id) => {
    if (id === primaryId) return;
    setMergeIds((current) => current.includes(id)
      ? current.filter((recordId) => recordId !== id)
      : [...current, id]);
  };

  const loadMergeDetails = async () => {
    if (!selectedGroup || !primaryId || !mergeIds.length) return;
    const ids = [primaryId, ...mergeIds];
    try {
      let payload = await apiRequest({ action: 'details', entity, ids });
      if (!payload) {
        const { data, error } = await supabase.from(entity).select('*').in('id', ids);
        if (error) throw error;
        payload = { records: data || [] };
      }
      const ordered = ids.map((id) => payload.records.find((record) => record.id === id)).filter(Boolean);
      setMergeItems(ordered);
      setIsMergeOpen(true);
    } catch (error) {
      toast.error(getDeduplicatorErrorMessage(error));
    }
  };

  const completeMerge = async (selectedPrimaryId, duplicateIds, metadata) => {
    setIsMerging(true);
    const loadingToast = toast.loading('Merging records and transferring relationships...');
    try {
      if (databaseReady !== true) throw new Error(DATABASE_SETUP_MESSAGE);
      const payload = await apiRequest({
        action: 'merge', entity, primaryId: selectedPrimaryId, duplicateIds, metadata,
      });
      if (!payload) {
        const rpcName = entity === 'people' ? 'merge_people_group' : 'merge_films_group';
        const { error } = await supabase.rpc(rpcName, {
          p_master_id: selectedPrimaryId,
          p_duplicate_ids: duplicateIds,
          p_metadata: metadata || {},
        });
        if (error) throw error;
      }
      setReports((current) => ({
        ...current,
        [entity]: {
          ...current[entity],
          groups: current[entity].groups.filter((group) => group.id !== selectedGroup.id),
          summary: {
            ...current[entity].summary,
            groups: Math.max(0, current[entity].summary.groups - 1),
          },
        },
      }));
      setIsMergeOpen(false);
      setMergeItems([]);
      toast.success(`${duplicateIds.length} ${duplicateIds.length === 1 ? 'record' : 'records'} merged`, { id: loadingToast });
    } catch (error) {
      toast.error(getDeduplicatorErrorMessage(error), { id: loadingToast });
    } finally {
      setIsMerging(false);
    }
  };

  const dismissGroup = async () => {
    if (!selectedGroup) return;
    setIsDismissing(true);
    const loadingToast = toast.loading('Saving this decision...');
    try {
      const ids = selectedGroup.records.map((record) => record.id);
      const payload = await apiRequest({ action: 'dismiss', entity, ids, reason: 'Reviewed as separate records' });
      if (!payload) {
        const rows = [];
        for (let left = 0; left < ids.length; left += 1) {
          for (let right = left + 1; right < ids.length; right += 1) {
            const [leftRecordId, rightRecordId] = [ids[left], ids[right]].sort();
            rows.push({ entity_type: entity, left_record_id: leftRecordId, right_record_id: rightRecordId, reason: 'Reviewed as separate records' });
          }
        }
        const { error } = await supabase.from('dedupe_ignored_pairs').upsert(rows, { onConflict: 'entity_type,left_record_id,right_record_id' });
        if (error) throw error;
      }
      setReports((current) => ({
        ...current,
        [entity]: {
          ...current[entity],
          groups: current[entity].groups.filter((group) => group.id !== selectedGroup.id),
          summary: { ...current[entity].summary, groups: Math.max(0, current[entity].summary.groups - 1) },
        },
      }));
      toast.success('Marked as separate records', { id: loadingToast });
    } catch (error) {
      toast.error(getDeduplicatorErrorMessage(error), { id: loadingToast });
    } finally {
      setIsDismissing(false);
    }
  };

  const switchEntity = (nextEntity) => {
    setEntity(nextEntity);
    setQuery('');
    setConfidence('all');
    setSelectedGroupId(null);
  };

  return (
    <div className="min-w-0 space-y-0">
      <section className="border-x border-t border-border bg-surface">
        <div className="flex flex-col gap-6 border-b border-border px-6 py-6 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="mb-2 text-[10px] font-bold uppercase text-brand">Catalogue integrity</p>
            <h1 className="font-heading text-3xl font-bold text-text-primary">Deduplicator</h1>
            <p className="mt-2 max-w-2xl text-sm text-text-muted">
              Scan the full catalogue, compare identity evidence, and merge selected records into one survivor.
            </p>
          </div>
          <button
            type="button"
            onClick={scan}
            disabled={isScanning}
            className="inline-flex h-11 items-center justify-center gap-2 bg-brand px-5 text-sm font-bold text-white transition-colors hover:bg-brand/90 disabled:cursor-wait disabled:opacity-60"
          >
            <Icon icon={isScanning ? 'solar:refresh-circle-linear' : 'solar:radar-2-linear'} className={isScanning ? 'animate-spin' : ''} width="19" />
            {isScanning ? scanStatus || 'Scanning catalogue...' : `Scan all ${entity}`}
          </button>
        </div>

        {databaseReady === false && (
          <div className="flex flex-col gap-4 border-b border-amber-500/20 bg-amber-500/10 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <Icon icon="solar:database-bold" className="mt-0.5 shrink-0 text-amber-400" width="20" />
              <div>
                <div className="text-xs font-bold text-amber-300">Database setup required</div>
                <p className="mt-1 text-xs leading-relaxed text-amber-100/70">
                  You can review candidates, but merging and dismissal are paused until the pending Catalog Deduplicator migration is applied in Supabase.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => checkDatabaseSetup(true)}
              className="inline-flex h-9 shrink-0 items-center justify-center gap-2 border border-amber-400/40 px-4 text-xs font-bold text-amber-300 hover:bg-amber-400/10"
            >
              <Icon icon="solar:refresh-linear" width="16" />
              Check again
            </button>
          </div>
        )}

        <div className="grid grid-cols-2 border-b border-border lg:grid-cols-6">
          <div className="col-span-2 flex min-h-20 items-stretch border-b border-border lg:border-b-0 lg:border-r">
            {['people', 'films'].map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => switchEntity(option)}
                className={`flex flex-1 items-center justify-center gap-2 border-r border-border px-4 text-sm font-bold capitalize last:border-r-0 ${entity === option ? 'bg-brand text-white' : 'text-text-muted hover:bg-surface-2 hover:text-text-primary'}`}
              >
                <Icon icon={option === 'people' ? 'solar:users-group-rounded-linear' : 'solar:clapperboard-play-linear'} width="18" />
                {option}
              </button>
            ))}
          </div>
          <Metric value={report?.recordsScanned} label="Records scanned" />
          <Metric value={report?.summary?.groups} label="Candidate groups" accent />
          <Metric value={report?.summary?.high} label="Strong candidates" />
          <Metric value={report?.summary?.blocked} label="Identity conflicts" />
        </div>
      </section>

      <section className="grid gap-3 border-x border-b border-border bg-surface px-4 py-3 lg:grid-cols-[minmax(220px,1fr)_auto_minmax(150px,0.38fr)]">
        <label className="relative min-w-0">
          <Icon icon="solar:magnifer-linear" className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" width="18" />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={`Search ${entity} candidates`}
            className="h-11 w-full border border-border bg-bg pl-10 pr-3 text-sm text-text-primary outline-none placeholder:text-text-muted focus:border-brand"
          />
        </label>
        <div className="flex min-w-0 overflow-x-auto border border-border bg-bg p-1">
          {['all', 'high', 'medium', 'review', 'blocked'].map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setConfidence(option)}
              className={`h-9 whitespace-nowrap px-3 text-[10px] font-bold capitalize ${confidence === option ? 'bg-brand text-white' : 'text-text-muted hover:text-text-primary'}`}
            >
              {option === 'all' ? 'All matches' : CONFIDENCE[option].label}
            </button>
          ))}
        </div>
        <select
          value={sort}
          onChange={(event) => setSort(event.target.value)}
          className="h-11 border border-border bg-bg px-3 text-sm text-text-primary outline-none focus:border-brand"
        >
          <option value="confidence">Confidence</option>
          <option value="records">Most records</option>
          <option value="name">Name A-Z</option>
        </select>
      </section>

      {!report ? (
        <section className="grid min-h-[520px] place-items-center border-x border-b border-border bg-surface px-6 text-center">
          <div className="max-w-md">
            <Icon icon="solar:radar-2-linear" className="mx-auto text-brand" width="48" />
            <h2 className="mt-5 font-heading text-xl font-bold text-text-primary">No {entity} scan loaded</h2>
            <p className="mt-2 text-sm text-text-muted">Run a full scan to create the review queue.</p>
          </div>
        </section>
      ) : (
        <main className="grid min-h-[650px] border-x border-b border-border bg-surface md:grid-cols-[300px_minmax(0,1fr)] xl:grid-cols-[390px_minmax(0,1fr)]">
          <section className="min-w-0 border-b border-border md:border-b-0 md:border-r" aria-label="Duplicate candidate groups">
            <div className="flex h-14 items-center justify-between border-b border-border px-4">
              <h2 className="text-[11px] font-bold uppercase text-text-primary">Review queue</h2>
              <span className="text-[10px] text-text-muted">{filteredGroups.length.toLocaleString()} groups</span>
            </div>
            <div className="max-h-[760px] overflow-y-auto">
              {filteredGroups.slice(0, visibleCount).map((group) => (
                <button
                  key={group.id}
                  type="button"
                  onClick={() => selectGroup(group)}
                  className={`w-full border-b border-border px-4 py-4 text-left transition-colors ${selectedGroup?.id === group.id ? 'bg-brand/10 shadow-[inset_3px_0_0_var(--color-brand)]' : 'hover:bg-surface-2'}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-bold text-text-primary">{titleFor(group.records[0], entity)}</div>
                      <div className="mt-1 truncate text-[10px] text-text-muted">
                        {group.records.slice(1, 4).map((record) => titleFor(record, entity)).join(' / ')}
                      </div>
                    </div>
                    <span className="font-heading text-lg font-bold text-text-primary">{group.records.length}</span>
                  </div>
                  <div className="mt-3 flex items-center justify-between gap-2">
                    <ConfidenceBadge confidence={group.confidence} />
                    <span className="text-[10px] font-mono text-text-muted">{Math.round(group.score * 100)}% match</span>
                  </div>
                </button>
              ))}
            </div>
            {visibleCount < filteredGroups.length && (
              <div className="p-4">
                <button
                  type="button"
                  onClick={() => setVisibleCount((count) => count + PAGE_SIZE)}
                  className="h-10 w-full border border-border text-xs font-bold text-text-muted hover:border-brand hover:text-text-primary"
                >
                  Load {Math.min(PAGE_SIZE, filteredGroups.length - visibleCount)} more
                </button>
              </div>
            )}
          </section>

          <section className="min-w-0 bg-bg" aria-label="Selected duplicate group">
            {!selectedGroup ? (
              <div className="grid min-h-[540px] place-items-center text-sm text-text-muted">No matching groups.</div>
            ) : (
              <>
                <header className="border-b border-border bg-surface px-5 py-5 lg:px-7">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <ConfidenceBadge confidence={selectedGroup.confidence} />
                        <span className="text-[10px] font-mono text-text-muted">{Math.round(selectedGroup.score * 100)}% highest pair score</span>
                      </div>
                      <h2 className="mt-3 font-heading text-2xl font-bold text-text-primary">
                        {selectedGroup.records.length} records may share one identity
                      </h2>
                      <p className="mt-2 text-xs text-text-muted">Choose the survivor, deselect anything that does not belong, then review field values before merging.</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={dismissGroup}
                        disabled={isDismissing || databaseReady !== true}
                        className="inline-flex h-10 items-center gap-2 border border-border px-4 text-xs font-bold text-text-muted hover:border-red-500/50 hover:text-red-400 disabled:opacity-50"
                      >
                        <Icon icon="solar:shield-cross-linear" width="17" />
                        Not duplicates
                      </button>
                      <button
                        type="button"
                        onClick={loadMergeDetails}
                        disabled={!primaryId || !mergeIds.length}
                        className="inline-flex h-10 items-center gap-2 bg-brand px-4 text-xs font-bold text-white hover:bg-brand/90 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        <Icon icon="solar:merge-linear" width="17" />
                        Review merge ({mergeIds.length})
                      </button>
                    </div>
                  </div>
                </header>

                <div className="border-b border-border px-5 py-4 lg:px-7">
                  <div className="flex flex-wrap gap-2">
                    {selectedGroup.reasons.map((reason) => (
                      <span key={reason} className="border border-border bg-surface px-2 py-1 text-[10px] font-bold text-text-muted">{reason}</span>
                    ))}
                  </div>
                  {selectedGroup.conflicts.length > 0 && (
                    <div className="mt-4 border-l-2 border-red-500 bg-red-500/10 px-4 py-3">
                      <div className="text-[10px] font-bold uppercase text-red-400">Resolve before merging</div>
                      <div className="mt-1 text-xs text-red-200/80">{selectedGroup.conflicts.join(' · ')}</div>
                    </div>
                  )}
                </div>

                <div className="divide-y divide-border">
                  {selectedGroup.records.map((record) => {
                    const isPrimary = primaryId === record.id;
                    const isSelected = isPrimary || mergeIds.includes(record.id);
                    const watchLinks = entity === 'films' ? getFilmWatchLinks(record) : [];
                    const trailerUrl = entity === 'films' ? getFilmTrailerUrl(record) : null;
                    return (
                      <article key={record.id} className={`grid gap-4 px-5 py-5 lg:grid-cols-[72px_minmax(0,1fr)_180px] lg:px-7 ${isPrimary ? 'bg-brand/5' : ''}`}>
                        <div className="h-20 w-16 overflow-hidden border border-border bg-surface">
                          <ImageWithFallback
                            src={imageFor(record, entity)}
                            alt={titleFor(record, entity)}
                            fallbackType={entity === 'people' ? 'avatar' : 'poster'}
                            name={titleFor(record, entity)}
                            className="h-full w-full object-cover"
                          />
                        </div>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="font-heading text-lg font-bold text-text-primary">{titleFor(record, entity)}</h3>
                            {record.is_verified && <Icon icon="solar:verified-check-bold" className="text-brand" width="17" />}
                            {record.claimed_by && <span className="border border-blue-500/30 bg-blue-500/10 px-2 py-0.5 text-[9px] font-bold text-blue-400">Claimed</span>}
                          </div>
                          <div className="mt-1 font-mono text-[9px] text-text-muted">{record.id}</div>
                          <div className="mt-3 grid grid-cols-2 gap-x-5 gap-y-2 text-[10px] sm:grid-cols-4">
                            <div><span className="block uppercase text-text-muted">{entity === 'people' ? 'Credits' : 'Year'}</span><strong className="text-text-primary">{entity === 'people' ? (record.film_count || 0) : (record.year || 'Unknown')}</strong></div>
                            <div><span className="block uppercase text-text-muted">Completeness</span><strong className="text-text-primary">{record.completeness}/7</strong></div>
                            <div><span className="block uppercase text-text-muted">TMDB</span><strong className="text-text-primary">{record.tmdb_id || 'None'}</strong></div>
                            <div><span className="block uppercase text-text-muted">Source</span><strong className="text-text-primary">{record.source || 'Unknown'}</strong></div>
                          </div>
                          {entity === 'people' && record.date_of_birth && <div className="mt-3 text-[10px] text-text-muted">Born {record.date_of_birth}</div>}
                          {entity === 'films' && record.synopsis && <p className="mt-3 line-clamp-2 text-xs leading-relaxed text-text-muted">{record.synopsis}</p>}
                          {entity === 'films' && (
                            <div className="mt-4 flex flex-wrap gap-2">
                              {watchLinks.map((link) => (
                                <a
                                  key={`${record.id}-${link.platformId}-${link.url}`}
                                  href={link.url}
                                  target="_blank"
                                  rel="noreferrer"
                                  title={`Open ${link.label} in a new tab`}
                                  className="inline-flex h-8 items-center gap-2 border border-brand/35 bg-brand/10 px-3 text-[10px] font-bold text-brand hover:bg-brand hover:text-white"
                                >
                                  <Icon icon={link.icon} width="14" />
                                  Watch on {link.label}
                                  <Icon icon="solar:arrow-right-up-linear" width="13" />
                                </a>
                              ))}
                              {trailerUrl && (
                                <a
                                  href={trailerUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  title="Open trailer in a new tab"
                                  className="inline-flex h-8 items-center gap-2 border border-border bg-surface px-3 text-[10px] font-bold text-text-muted hover:border-brand hover:text-brand"
                                >
                                  <Icon icon="solar:play-circle-linear" width="14" />
                                  Trailer
                                </a>
                              )}
                              {record.slug && (
                                <a
                                  href={`/films/${record.slug}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  title="Open public film page in a new tab"
                                  className="inline-flex h-8 items-center gap-2 border border-border bg-surface px-3 text-[10px] font-bold text-text-muted hover:border-brand hover:text-brand"
                                >
                                  <Icon icon="solar:document-linear" width="14" />
                                  View details
                                </a>
                              )}
                              <a
                                href={`/admin/films?edit=${record.id}`}
                                target="_blank"
                                rel="noreferrer"
                                title="Open this film record for editing"
                                className="inline-flex h-8 items-center gap-2 border border-border bg-surface px-3 text-[10px] font-bold text-text-muted hover:border-brand hover:text-brand"
                              >
                                <Icon icon="solar:pen-linear" width="14" />
                                Edit title
                              </a>
                              {!watchLinks.length && !trailerUrl && (
                                <span className="inline-flex h-8 items-center gap-2 border border-border/70 px-3 text-[10px] font-medium text-text-muted">
                                  <Icon icon="solar:link-broken-linear" width="14" />
                                  No watch link
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-2 lg:flex-col lg:items-stretch lg:justify-center">
                          <label className={`flex h-10 cursor-pointer items-center gap-2 border px-3 text-[10px] font-bold ${isPrimary ? 'border-brand bg-brand/10 text-brand' : 'border-border text-text-muted hover:text-text-primary'}`}>
                            <input
                              type="radio"
                              name="primary-record"
                              checked={isPrimary}
                              onChange={() => choosePrimary(record.id)}
                              className="accent-brand"
                            />
                            Keep as primary
                          </label>
                          <label className={`flex h-10 items-center gap-2 border px-3 text-[10px] font-bold ${isPrimary ? 'cursor-not-allowed border-border/50 text-text-muted/40' : 'cursor-pointer border-border text-text-muted hover:text-text-primary'}`}>
                            <input
                              type="checkbox"
                              checked={isSelected}
                              disabled={isPrimary}
                              onChange={() => toggleMerge(record.id)}
                              className="accent-brand"
                            />
                            {isPrimary ? 'Surviving record' : 'Include in merge'}
                          </label>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </>
            )}
          </section>
        </main>
      )}

      <MergeModal
        isOpen={isMergeOpen}
        onClose={() => !isMerging && setIsMergeOpen(false)}
        items={mergeItems}
        onConfirm={completeMerge}
        type={entity === 'people' ? 'person' : 'film'}
        confirmDisabled={databaseReady !== true}
        confirmDisabledReason={databaseReady === false ? DATABASE_SETUP_MESSAGE : 'Checking database setup...'}
      />
    </div>
  );
}
