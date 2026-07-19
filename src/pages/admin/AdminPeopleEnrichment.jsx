import { useCallback, useEffect, useMemo, useState } from 'react';
import { Icon } from '@iconify/react';
import toast from 'react-hot-toast';
import { Link } from 'react-router-dom';
import ImageWithFallback from '../../components/ui/ImageWithFallback';
import {
  applyPeopleEnrichment,
  checkPeopleEnrichmentSetup,
  listPeopleEnrichment,
  refreshPeopleEnrichment,
  researchPeopleWithGemini,
  researchPeopleWithGeminiBatch,
  reviewPeopleEnrichment,
  suggestPeopleEnrichment,
} from '../../lib/peopleEnrichmentClient';
import { ENRICHMENT_FIELDS } from '../../lib/peopleEnrichment';
import { getFriendlyErrorMessage } from '../../utils/errors';

const PAGE_SIZE = 40;
const SETUP_MESSAGE = 'Apply the pending People Enrichment + Gemini research migrations in Supabase, then select Check again.';

const FIELD_DEFINITIONS = [
  ...ENRICHMENT_FIELDS,
  { key: 'gender', label: 'Gender' },
  { key: 'nationality', label: 'Nationality' },
  { key: 'youtube_handle', label: 'YouTube handle', kind: 'link' },
  { key: 'photo_source_page', label: 'Photo source page', kind: 'link' },
  { key: 'notable_credits', label: 'Notable credits missing from MuviDB', kind: 'longtext' },
];

const STATUS_TABS = [
  { key: 'review', label: 'Review', stat: 'review' },
  { key: 'pending', label: 'Pending', stat: 'pending' },
  { key: 'no_match', label: 'No trusted match', stat: 'noMatch' },
  { key: 'applied', label: 'Applied', stat: 'applied' },
  { key: 'skipped', label: 'Skipped', stat: 'skipped' },
];

const STATUS_STYLE = {
  ready: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400',
  needs_review: 'border-amber-500/30 bg-amber-500/10 text-amber-400',
  no_match: 'border-red-500/30 bg-red-500/10 text-red-400',
  pending: 'border-border bg-surface-2 text-text-muted',
  fetching: 'border-brand/30 bg-brand/10 text-brand',
  failed: 'border-red-500/30 bg-red-500/10 text-red-400',
  applied: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400',
  skipped: 'border-border bg-surface-2 text-text-muted',
};

const APPLYABLE_FIELDS = new Set([
  'bio', 'photo_url', 'date_of_birth', 'birthplace', 'nationality', 'gender',
  'known_for_department', 'instagram_url', 'facebook_url', 'twitter_url',
  'tiktok_url', 'youtube_channel_id', 'youtube_handle', 'tmdb_id',
]);

const statusLabel = (status) => ({
  ready: 'Ready',
  needs_review: 'Check identity',
  no_match: 'No trusted match',
  pending: 'Waiting',
  fetching: 'Searching',
  failed: 'Lookup failed',
  applied: 'Applied',
  skipped: 'Skipped',
})[status] || status;

const formatDateTime = (value) => value
  ? new Intl.DateTimeFormat('en-NG', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
  : 'Not run';

const isBlank = (value) => {
  if (value === null || value === undefined) return true;
  if (Array.isArray(value)) return !value.length;
  return String(value).trim() === '';
};

function asEvidenceList(fieldSources, fieldKey, evidenceRows = []) {
  const fromTable = (evidenceRows || []).filter((row) => row.field_name === fieldKey);
  if (fromTable.length) {
    return fromTable.map((row) => ({
      source: 'Gemini',
      provider: 'Gemini',
      url: row.source_url,
      title: row.source_title,
      domain: row.source_domain,
      tier: row.source_tier,
      excerpt: row.evidence_excerpt,
    }));
  }
  const raw = fieldSources?.[fieldKey];
  if (!raw) return [];
  return (Array.isArray(raw) ? raw : [raw]).filter((row) => row?.url);
}

function sourceBadgeClass(source) {
  const value = String(source || '').toLowerCase();
  if (value.includes('gemini')) return 'border-sky-500/30 bg-sky-500/10 text-sky-300';
  if (value.includes('tmdb')) return 'border-violet-500/30 bg-violet-500/10 text-violet-300';
  return 'border-border bg-surface-2 text-text-muted';
}

function personFromRow(row) {
  return Array.isArray(row?.person) ? row.person[0] : row?.person;
}

const Metric = ({ label, value, accent = false }) => (
  <div className="min-w-0 border-l border-border px-5 py-4 first:border-l-0">
    <div className={`font-heading text-2xl font-bold ${accent ? 'text-brand' : 'text-text-primary'}`}>
      {Number(value || 0).toLocaleString()}
    </div>
    <div className="mt-1 text-[9px] font-bold uppercase text-text-muted">{label}</div>
  </div>
);

const StatusBadge = ({ status }) => (
  <span className={`inline-flex h-6 items-center border px-2 text-[9px] font-bold uppercase ${STATUS_STYLE[status] || STATUS_STYLE.pending}`}>
    {statusLabel(status)}
  </span>
);

const SourceBadge = ({ source }) => (
  <span className={`inline-flex h-6 items-center border px-2 text-[9px] font-bold uppercase ${sourceBadgeClass(source)}`}>
    {source || 'Unknown'}
  </span>
);

const FieldValue = ({ field, value, name, proposed = false }) => {
  if (isBlank(value)) return <span className="text-xs italic text-text-muted">No data</span>;
  if (field.kind === 'image') {
    return (
      <ImageWithFallback
        src={value}
        name={name}
        alt={`${name} profile`}
        width={240}
        className="h-32 w-28 border border-border object-cover"
      />
    );
  }
  if (field.key === 'notable_credits' && Array.isArray(value)) {
    return (
      <ul className="space-y-1 text-xs text-text-primary">
        {value.map((credit) => <li key={credit}>• {credit}</li>)}
      </ul>
    );
  }
  if (field.kind === 'link' || /^https?:\/\//i.test(String(value))) {
    return (
      <a href={value} target="_blank" rel="noreferrer" className="break-all text-xs font-medium text-brand hover:underline">
        {value}
      </a>
    );
  }
  if (field.kind === 'longtext') {
    return <p className={`text-xs leading-6 ${proposed ? 'text-text-primary' : 'text-text-muted'}`}>{value}</p>;
  }
  return <span className={`text-sm ${proposed ? 'font-semibold text-text-primary' : 'text-text-muted'}`}>{String(value)}</span>;
};

export default function AdminPeopleEnrichment() {
  const [setup, setSetup] = useState({ checking: true, ready: null, error: null });
  const [rows, setRows] = useState([]);
  const [stats, setStats] = useState({});
  const [count, setCount] = useState(0);
  const [status, setStatus] = useState('review');
  const [missingField, setMissingField] = useState('all');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState(null);
  const [batchIds, setBatchIds] = useState([]);
  const [selectedFields, setSelectedFields] = useState([]);
  const [photoConfirmed, setPhotoConfirmed] = useState(false);
  const [reviewNote, setReviewNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [working, setWorking] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), 250);
    return () => clearTimeout(timer);
  }, [search]);

  const checkSetup = useCallback(async (announce = false) => {
    setSetup({ checking: true, ready: null, error: null });
    const result = await checkPeopleEnrichmentSetup();
    setSetup({ checking: false, ready: result.ready, error: result.error });
    if (announce) {
      if (result.ready) toast.success('People Enrichment database is ready');
      else toast.error(SETUP_MESSAGE);
    }
    return result.ready;
  }, []);

  useEffect(() => {
    checkSetup();
  }, [checkSetup]);

  const loadRows = useCallback(async () => {
    if (setup.ready !== true) return;
    setLoading(true);
    try {
      const payload = await listPeopleEnrichment({
        status,
        missingField,
        search: debouncedSearch,
        page,
        pageSize: PAGE_SIZE,
      });
      const nextRows = payload.rows || [];
      setRows(nextRows);
      setStats(payload.stats || {});
      setCount(payload.count || 0);
      setSelectedId((current) => nextRows.some((row) => row.id === current)
        ? current
        : nextRows[0]?.id || null);
      setBatchIds((current) => current.filter((id) => nextRows.some((row) => row.id === id)));
    } catch (error) {
      toast.error(getFriendlyErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }, [setup.ready, status, missingField, debouncedSearch, page]);

  useEffect(() => {
    loadRows();
  }, [loadRows]);

  useEffect(() => {
    setPage(1);
  }, [status, missingField, debouncedSearch]);

  const selected = rows.find((row) => row.id === selectedId) || rows[0] || null;
  const person = personFromRow(selected);
  const candidateData = selected?.candidate_data || {};
  const fieldSources = selected?.field_sources || {};
  const evidenceRows = selected?.evidence || [];
  const researchRuns = [...(selected?.research_runs || [])]
    .sort((a, b) => new Date(b.started_at || 0) - new Date(a.started_at || 0));
  const latestGeminiRun = researchRuns.find((run) => run.provider === 'gemini');

  const conflicts = useMemo(() => {
    const fromReasons = (selected?.match_reasons || []).filter((reason) => /conflict/i.test(reason));
    return [...fromReasons, ...(candidateData.conflicts || [])];
  }, [selected?.match_reasons, candidateData]);

  const proposedFields = useMemo(
    () => FIELD_DEFINITIONS.filter((field) => !isBlank(candidateData[field.key])),
    [candidateData],
  );

  useEffect(() => {
    if (!selected || !person) {
      setSelectedFields([]);
      setReviewNote('');
      setPhotoConfirmed(false);
      return;
    }
    setSelectedFields(proposedFields
      .filter((field) => APPLYABLE_FIELDS.has(field.key))
      .filter((field) => field.key !== 'photo_url')
      .filter((field) => isBlank(person[field.key]) || person[field.key] === 'Prefer not to say')
      .map((field) => field.key));
    setReviewNote(selected.reviewer_note || '');
    setPhotoConfirmed(false);
  }, [selected?.id]);

  const runAction = async (key, loadingMessage, action) => {
    setWorking(key);
    const loadingToast = toast.loading(loadingMessage);
    try {
      await action(loadingToast);
      await loadRows();
    } catch (error) {
      toast.error(getFriendlyErrorMessage(error), { id: loadingToast });
    } finally {
      setWorking('');
    }
  };

  const runRefresh = () => runAction('refresh', 'Refreshing enrichment priorities...', async (toastId) => {
    const result = await refreshPeopleEnrichment();
    toast.success(`${Number(result.affected || 0).toLocaleString()} profiles prioritized`, { id: toastId });
  });

  const buildSuggestions = (queueIds) => runAction(
    queueIds?.length ? 'retry' : 'suggest',
    queueIds?.length ? 'Checking this identity on TMDB...' : 'Building TMDB profile proposals...',
    async (toastId) => {
      const result = await suggestPeopleEnrichment({ queueIds, limit: queueIds?.length || 5, provider: 'tmdb' });
      const successful = (result.results || []).filter((item) => item.status !== 'failed').length;
      if (!result.results?.length) toast('No pending profiles are waiting for lookup', { id: toastId });
      else toast.success(`${successful} TMDB ${successful === 1 ? 'proposal' : 'proposals'} prepared`, { id: toastId });
    },
  );

  const runGeminiResearch = (queueId, { force = true } = {}) => runAction(
    'gemini',
    'Researching with grounded Gemini...',
    async (toastId) => {
      const result = await researchPeopleWithGemini({ queueId, force });
      const statusValue = result.result?.status || result.status;
      if (statusValue === 'budget_blocked') {
        toast.error(result.result?.error || 'Daily Gemini budget reached', { id: toastId });
      } else if (statusValue === 'failed') {
        toast.error(result.result?.error || 'Gemini research failed', { id: toastId });
      } else {
        toast.success(`Gemini research: ${statusValue}`, { id: toastId });
      }
    },
  );

  const runGeminiBatch = async () => {
    const ids = batchIds.slice(0, 5);
    if (!ids.length) {
      toast.error('Select up to 5 profiles for Gemini research');
      return;
    }
    await runAction('gemini-batch', `Researching ${ids.length} profiles with Gemini...`, async (toastId) => {
      const result = await researchPeopleWithGeminiBatch({ queueIds: ids, limit: ids.length });
      const successful = (result.results || []).filter((item) => !['failed', 'budget_blocked'].includes(item.status)).length;
      toast.success(`${successful}/${ids.length} Gemini research runs completed`, { id: toastId });
      setBatchIds([]);
    });
  };

  const applySelected = async () => {
    if (!selected || !selectedFields.length) return;
    if (selectedFields.includes('photo_url') && !photoConfirmed) {
      toast.error('Confirm the proposed photo visually before applying it');
      return;
    }
    await runAction('apply', 'Applying selected profile fields...', async (toastId) => {
      await applyPeopleEnrichment(selected.id, selectedFields);
      toast.success(`${selectedFields.length} ${selectedFields.length === 1 ? 'field' : 'fields'} applied to ${person.name}`, { id: toastId });
    });
  };

  const review = async (nextStatus) => {
    if (!selected) return;
    await runAction(
      nextStatus,
      nextStatus === 'skipped' ? 'Rejecting proposal...' : 'Reopening profile lookup...',
      async (toastId) => {
        await reviewPeopleEnrichment(selected.id, nextStatus, reviewNote.trim() || null);
        toast.success(nextStatus === 'skipped' ? 'Proposal rejected' : 'Profile returned to the lookup queue', { id: toastId });
      },
    );
  };

  const toggleField = (key) => {
    if (key === 'photo_url' && !selectedFields.includes(key) && !photoConfirmed) {
      toast.error('Confirm the photo visually before selecting it');
      return;
    }
    setSelectedFields((current) => current.includes(key)
      ? current.filter((field) => field !== key)
      : [...current, key]);
  };

  const toggleBatch = (id) => {
    setBatchIds((current) => {
      if (current.includes(id)) return current.filter((value) => value !== id);
      if (current.length >= 5) {
        toast.error('Gemini batches are limited to 5 people');
        return current;
      }
      return [...current, id];
    });
  };

  const totalPages = Math.max(1, Math.ceil(count / PAGE_SIZE));
  const confidence = selected?.match_confidence === null || selected?.match_confidence === undefined
    ? null
    : Math.round(Number(selected.match_confidence) * 100);
  const primarySource = selected?.source_name || (latestGeminiRun ? 'Gemini' : null);
  const openSourceUrl = selected?.source_url
    || asEvidenceList(fieldSources, proposedFields[0]?.key, evidenceRows)[0]?.url
    || null;

  return (
    <div className="min-w-0 space-y-0">
      <section className="border-x border-t border-border bg-surface">
        <div className="flex flex-col gap-6 border-b border-border px-6 py-6 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="mb-2 text-[10px] font-bold uppercase text-brand">Profile quality</p>
            <h1 className="font-heading text-3xl font-bold text-text-primary">People Enrichment</h1>
            <p className="mt-2 max-w-2xl text-sm text-text-muted">
              Review TMDB and grounded Gemini proposals before any profile field becomes public.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={runRefresh}
              disabled={Boolean(working) || setup.ready !== true}
              className="inline-flex h-11 items-center justify-center gap-2 border border-border bg-bg px-4 text-sm font-bold text-text-primary hover:border-brand disabled:opacity-50"
            >
              <Icon icon={working === 'refresh' ? 'solar:refresh-circle-linear' : 'solar:sort-by-time-linear'} className={working === 'refresh' ? 'animate-spin' : ''} width="18" />
              Refresh priorities
            </button>
            <button
              type="button"
              onClick={() => buildSuggestions()}
              disabled={Boolean(working) || setup.ready !== true}
              className="inline-flex h-11 items-center justify-center gap-2 border border-border bg-bg px-4 text-sm font-bold text-text-primary hover:border-brand disabled:opacity-50"
            >
              <Icon icon={working === 'suggest' ? 'solar:refresh-circle-linear' : 'solar:magnifer-linear'} className={working === 'suggest' ? 'animate-spin' : ''} width="18" />
              Build 5 TMDB proposals
            </button>
            <button
              type="button"
              onClick={runGeminiBatch}
              disabled={Boolean(working) || setup.ready !== true || !batchIds.length}
              className="inline-flex h-11 items-center justify-center gap-2 bg-brand px-5 text-sm font-bold text-white hover:bg-brand/90 disabled:opacity-50"
            >
              <Icon icon={working === 'gemini-batch' ? 'solar:refresh-circle-linear' : 'solar:atom-linear'} className={working === 'gemini-batch' ? 'animate-spin' : ''} width="18" />
              Research {batchIds.length || ''} with Gemini
            </button>
          </div>
        </div>

        {setup.ready === false && (
          <div className="flex flex-col gap-4 border-b border-amber-500/20 bg-amber-500/10 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <Icon icon="solar:database-bold" className="mt-0.5 shrink-0 text-amber-400" width="20" />
              <div>
                <div className="text-xs font-bold text-amber-300">Database setup required</div>
                <p className="mt-1 text-xs text-amber-100/70">{SETUP_MESSAGE}</p>
              </div>
            </div>
            <button type="button" onClick={() => checkSetup(true)} className="inline-flex h-9 items-center gap-2 border border-amber-400/40 px-4 text-xs font-bold text-amber-300 hover:bg-amber-400/10">
              <Icon icon="solar:refresh-linear" width="16" />
              Check again
            </button>
          </div>
        )}

        <div className="grid grid-cols-2 border-b border-border md:grid-cols-5">
          <Metric label="Profiles queued" value={stats.total} />
          <Metric label="Pending lookup" value={stats.pending} />
          <Metric label="Ready to review" value={stats.review} accent />
          <Metric label="No trusted match" value={stats.noMatch} />
          <Metric label="Applied" value={stats.applied} />
        </div>

        <div className="flex min-w-0 overflow-x-auto border-b border-border">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setStatus(tab.key)}
              className={`flex h-12 shrink-0 items-center gap-2 border-r border-border px-5 text-xs font-bold ${status === tab.key ? 'bg-brand text-white' : 'text-text-muted hover:bg-surface-2 hover:text-text-primary'}`}
            >
              {tab.label}
              <span className={status === tab.key ? 'text-white/75' : 'text-text-muted'}>{Number(stats[tab.stat] || 0).toLocaleString()}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="grid gap-3 border-x border-b border-border bg-surface px-4 py-3 md:grid-cols-[minmax(240px,1fr)_240px]">
        <label className="relative min-w-0">
          <Icon icon="solar:magnifer-linear" className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" width="18" />
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search people"
            className="h-11 w-full border border-border bg-bg pl-10 pr-3 text-sm text-text-primary outline-none placeholder:text-text-muted focus:border-brand"
          />
        </label>
        <select
          value={missingField}
          onChange={(event) => setMissingField(event.target.value)}
          className="h-11 border border-border bg-bg px-3 text-sm text-text-primary outline-none focus:border-brand"
        >
          <option value="all">All missing fields</option>
          {ENRICHMENT_FIELDS.map((field) => <option key={field.key} value={field.key}>Missing {field.label.toLowerCase()}</option>)}
        </select>
      </section>

      <section className="grid min-h-[620px] border-x border-b border-border bg-surface md:grid-cols-[280px_minmax(0,1fr)] xl:grid-cols-[380px_minmax(0,1fr)]">
        <aside className="border-b border-border md:border-b-0 md:border-r">
          <div className="flex h-12 items-center justify-between border-b border-border px-4 text-[10px] font-bold uppercase text-text-muted">
            <span>{count.toLocaleString()} profiles · {batchIds.length}/5 selected</span>
            {loading && <Icon icon="solar:refresh-circle-linear" className="animate-spin text-brand" width="18" />}
          </div>
          <div className="max-h-[720px] overflow-y-auto">
            {!loading && !rows.length && (
              <div className="flex min-h-72 flex-col items-center justify-center px-8 text-center">
                <Icon icon="solar:user-check-linear" className="text-text-muted" width="34" />
                <p className="mt-4 text-sm font-bold text-text-primary">Nothing in this lane</p>
                <p className="mt-2 text-xs leading-5 text-text-muted">Refresh priorities or change the current filters.</p>
              </div>
            )}
            {rows.map((row) => {
              const rowPerson = personFromRow(row);
              return (
                <div
                  key={row.id}
                  className={`flex min-h-[112px] w-full gap-3 border-b border-border px-3 py-4 transition-colors ${selected?.id === row.id ? 'bg-brand/10 shadow-[inset_3px_0_0_#FF5C00]' : 'hover:bg-surface-2'}`}
                >
                  <label className="flex items-start pt-1">
                    <input
                      type="checkbox"
                      checked={batchIds.includes(row.id)}
                      onChange={() => toggleBatch(row.id)}
                      className="h-4 w-4 accent-brand"
                      aria-label={`Select ${rowPerson?.name || 'person'} for Gemini batch`}
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => setSelectedId(row.id)}
                    className="flex min-w-0 flex-1 gap-3 text-left"
                  >
                    <ImageWithFallback src={rowPerson?.photo_url} name={rowPerson?.name} width={112} className="h-16 w-14 shrink-0 border border-border object-cover" />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-start justify-between gap-2">
                        <span className="truncate text-sm font-bold text-text-primary">{rowPerson?.name || 'Unnamed person'}</span>
                        <span className="shrink-0 text-[10px] font-bold text-brand">{row.current_completeness}%</span>
                      </span>
                      <span className="mt-2 flex flex-wrap items-center gap-2">
                        <StatusBadge status={row.status} />
                        {row.source_name && <SourceBadge source={row.source_name} />}
                        <span className="text-[10px] text-text-muted">{rowPerson?.film_count || 0} credits</span>
                      </span>
                      <span className="mt-3 block h-1 w-full bg-bg">
                        <span className="block h-full bg-brand" style={{ width: `${row.current_completeness || 0}%` }} />
                      </span>
                    </span>
                  </button>
                </div>
              );
            })}
          </div>
          {count > PAGE_SIZE && (
            <div className="flex h-12 items-center justify-between border-t border-border px-3">
              <button type="button" onClick={() => setPage((value) => Math.max(1, value - 1))} disabled={page === 1} title="Previous page" className="flex h-8 w-8 items-center justify-center border border-border text-text-muted hover:text-brand disabled:opacity-30">
                <Icon icon="solar:alt-arrow-left-linear" width="17" />
              </button>
              <span className="text-[10px] font-bold text-text-muted">{page} / {totalPages}</span>
              <button type="button" onClick={() => setPage((value) => Math.min(totalPages, value + 1))} disabled={page === totalPages} title="Next page" className="flex h-8 w-8 items-center justify-center border border-border text-text-muted hover:text-brand disabled:opacity-30">
                <Icon icon="solar:alt-arrow-right-linear" width="17" />
              </button>
            </div>
          )}
        </aside>

        <div className="min-w-0">
          {!selected || !person ? (
            <div className="flex min-h-[620px] flex-col items-center justify-center px-8 text-center">
              <Icon icon="solar:document-add-linear" className="text-text-muted" width="38" />
              <p className="mt-4 text-sm font-bold text-text-primary">Select a profile to review</p>
            </div>
          ) : (
            <>
              <header className="flex flex-col gap-5 border-b border-border px-5 py-5 lg:flex-row lg:items-start lg:justify-between">
                <div className="flex min-w-0 gap-4">
                  <ImageWithFallback src={person.photo_url} name={person.name} width={160} className="h-24 w-20 shrink-0 border border-border object-cover" />
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="font-heading text-2xl font-bold text-text-primary">{person.name}</h2>
                      <StatusBadge status={selected.status} />
                      {primarySource && <SourceBadge source={primarySource} />}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-text-muted">
                      <span>{person.known_for_department || 'Department unknown'}</span>
                      <span>{person.film_count || 0} catalogue credits</span>
                      <span>{selected.missing_fields?.length || 0} missing fields</span>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {(selected.matched_credits || []).slice(0, 4).map((credit) => (
                        <span key={credit} className="border border-brand/25 bg-brand/10 px-2 py-1 text-[10px] font-bold text-brand">{credit}</span>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="flex shrink-0 flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => runGeminiResearch(selected.id, { force: true })}
                    disabled={Boolean(working)}
                    className="inline-flex h-9 items-center gap-2 border border-sky-500/40 bg-sky-500/10 px-3 text-xs font-bold text-sky-300 hover:bg-sky-500/20 disabled:opacity-50"
                  >
                    <Icon icon={working === 'gemini' ? 'solar:refresh-circle-linear' : 'solar:atom-linear'} className={working === 'gemini' ? 'animate-spin' : ''} width="16" />
                    Research with Gemini
                  </button>
                  <Link to={`/people/${person.slug}`} target="_blank" className="inline-flex h-9 items-center gap-2 border border-border px-3 text-xs font-bold text-text-muted hover:border-brand hover:text-brand">
                    <Icon icon="solar:square-top-down-linear" width="16" />
                    Public profile
                  </Link>
                  <Link to={`/admin/people?search=${encodeURIComponent(person.name)}`} target="_blank" rel="noreferrer" className="inline-flex h-9 items-center gap-2 border border-border px-3 text-xs font-bold text-text-muted hover:border-brand hover:text-brand">
                    <Icon icon="solar:pen-linear" width="16" />
                    Edit manually
                  </Link>
                </div>
              </header>

              <div className="grid border-b border-border md:grid-cols-[180px_minmax(0,1fr)]">
                <div className="border-b border-border px-5 py-5 md:border-b-0 md:border-r">
                  <div className="text-[9px] font-bold uppercase text-text-muted">Identity confidence</div>
                  <div className={`mt-2 font-heading text-3xl font-bold ${confidence !== null && confidence >= 78 ? 'text-emerald-400' : confidence !== null && confidence >= 58 ? 'text-amber-400' : 'text-text-muted'}`}>
                    {confidence === null ? '--' : `${confidence}%`}
                  </div>
                  <div className="mt-2 text-[10px] text-text-muted">Last checked {formatDateTime(selected.last_attempt_at)}</div>
                  {latestGeminiRun && (
                    <div className="mt-3 text-[10px] text-sky-300/90">
                      Gemini {latestGeminiRun.model} · {latestGeminiRun.status}
                    </div>
                  )}
                </div>
                <div className="px-5 py-5">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="text-[9px] font-bold uppercase text-text-muted">Identity reasons</span>
                    {primarySource && <SourceBadge source={primarySource} />}
                    {openSourceUrl && (
                      <a href={openSourceUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs font-bold text-brand hover:underline">
                        Open source
                        <Icon icon="solar:arrow-right-up-linear" width="14" />
                      </a>
                    )}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {(latestGeminiRun?.identity_reasons?.length
                      ? latestGeminiRun.identity_reasons
                      : selected.match_reasons || []).map((reason) => (
                      <span key={reason} className="border border-border bg-bg px-2 py-1 text-[10px] font-medium text-text-muted">{reason}</span>
                    ))}
                    {!selected.match_reasons?.length && !latestGeminiRun?.identity_reasons?.length && (
                      <span className="text-xs text-text-muted">No source evidence has been checked yet.</span>
                    )}
                  </div>
                </div>
              </div>

              {!!conflicts.length && (
                <div className="border-b border-amber-500/30 bg-amber-500/10 px-5 py-4">
                  <div className="text-[9px] font-bold uppercase text-amber-300">Conflicts — needs review</div>
                  <ul className="mt-2 space-y-1 text-xs text-amber-100/90">
                    {conflicts.map((conflict, index) => (
                      <li key={index}>
                        {typeof conflict === 'string'
                          ? conflict
                          : `${conflict.field}: ${(conflict.values || []).join(' vs ')}${conflict.note ? ` — ${conflict.note}` : ''}`}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {proposedFields.length ? (
                <div className="overflow-x-auto">
                  <div className="min-w-[520px]">
                    <div className="grid min-h-11 grid-cols-[40px_110px_minmax(140px,1fr)_minmax(180px,1.2fr)] border-b border-border bg-surface-2 text-[9px] font-bold uppercase text-text-muted xl:grid-cols-[48px_150px_minmax(0,1fr)_minmax(0,1.2fr)]">
                      <div className="border-r border-border" />
                      <div className="flex items-center border-r border-border px-4">Field</div>
                      <div className="flex items-center border-r border-border px-4">Current profile</div>
                      <div className="flex items-center px-4">Sourced proposal + evidence</div>
                    </div>
                    {proposedFields.map((field) => {
                      const evidence = asEvidenceList(fieldSources, field.key, evidenceRows);
                      const providers = [...new Set(evidence.map((row) => row.provider || row.source).filter(Boolean))];
                      const applyable = APPLYABLE_FIELDS.has(field.key);
                      return (
                        <div key={field.key} className="grid min-h-[92px] grid-cols-[40px_110px_minmax(140px,1fr)_minmax(180px,1.2fr)] border-b border-border xl:grid-cols-[48px_150px_minmax(0,1fr)_minmax(0,1.2fr)]">
                          <label className="flex cursor-pointer items-center justify-center border-r border-border bg-surface-2">
                            <input
                              type="checkbox"
                              checked={selectedFields.includes(field.key)}
                              onChange={() => toggleField(field.key)}
                              disabled={!applyable}
                              className="h-4 w-4 accent-brand disabled:opacity-30"
                              aria-label={`Apply ${field.label}`}
                            />
                          </label>
                          <div className="border-r border-border px-4 py-4">
                            <div className="text-[10px] font-bold uppercase text-text-muted">{field.label}</div>
                            <div className="mt-2 flex flex-wrap gap-1">
                              {providers.map((provider) => <SourceBadge key={provider} source={provider} />)}
                              {!providers.length && selected.source_name && <SourceBadge source={selected.source_name} />}
                            </div>
                          </div>
                          <div className="min-w-0 border-r border-border px-4 py-4">
                            <FieldValue field={field} value={person[field.key]} name={person.name} />
                          </div>
                          <div className="min-w-0 space-y-3 bg-brand/[0.025] px-4 py-4">
                            <FieldValue field={field} value={candidateData[field.key]} name={person.name} proposed />
                            {field.key === 'bio' && candidateData.bio && (
                              <div className="text-[10px] font-bold uppercase text-sky-300">AI-synthesized from cited sources</div>
                            )}
                            {field.key === 'photo_url' && candidateData.photo_url && (
                              <label className="flex items-start gap-2 text-xs text-text-muted">
                                <input
                                  type="checkbox"
                                  checked={photoConfirmed}
                                  onChange={(event) => {
                                    setPhotoConfirmed(event.target.checked);
                                    if (!event.target.checked) {
                                      setSelectedFields((current) => current.filter((key) => key !== 'photo_url'));
                                    }
                                  }}
                                  className="mt-0.5 h-4 w-4 accent-brand"
                                />
                                I visually confirm this photo matches {person.name}
                              </label>
                            )}
                            <div className="flex flex-wrap gap-2">
                              {evidence.map((row) => (
                                <a
                                  key={`${field.key}-${row.url}`}
                                  href={row.url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-flex items-center gap-1 border border-border bg-bg px-2 py-1 text-[10px] font-bold text-brand hover:border-brand"
                                  title={row.excerpt || row.title || row.url}
                                >
                                  {row.domain || 'source'}
                                  <Icon icon="solar:arrow-right-up-linear" width="12" />
                                </a>
                              ))}
                              {!evidence.length && (
                                <span className="text-[10px] text-red-300">No clickable evidence — do not apply</span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="flex min-h-64 flex-col items-center justify-center border-b border-border px-8 text-center">
                  <Icon icon={selected.status === 'no_match' ? 'solar:shield-warning-linear' : 'solar:magnifer-linear'} className="text-text-muted" width="34" />
                  <p className="mt-4 text-sm font-bold text-text-primary">
                    {selected.status === 'no_match' ? 'No trusted public match found' : 'No sourced proposal yet'}
                  </p>
                  <p className="mt-2 max-w-md text-xs leading-5 text-text-muted">
                    {selected.reviewer_note || 'Try TMDB again, or research emerging Nollywood talent with grounded Gemini.'}
                  </p>
                  <div className="mt-5 flex flex-wrap justify-center gap-2">
                    <button type="button" onClick={() => buildSuggestions([selected.id])} disabled={Boolean(working)} className="inline-flex h-10 items-center gap-2 border border-border px-4 text-xs font-bold text-text-primary hover:border-brand disabled:opacity-50">
                      <Icon icon={working === 'retry' ? 'solar:refresh-circle-linear' : 'solar:refresh-linear'} className={working === 'retry' ? 'animate-spin' : ''} width="17" />
                      Retry TMDB
                    </button>
                    <button type="button" onClick={() => runGeminiResearch(selected.id)} disabled={Boolean(working)} className="inline-flex h-10 items-center gap-2 border border-sky-500/40 px-4 text-xs font-bold text-sky-300 hover:bg-sky-500/10 disabled:opacity-50">
                      <Icon icon={working === 'gemini' ? 'solar:refresh-circle-linear' : 'solar:atom-linear'} className={working === 'gemini' ? 'animate-spin' : ''} width="17" />
                      Research with Gemini
                    </button>
                  </div>
                </div>
              )}

              <footer className="flex flex-col gap-4 bg-surface-2 px-5 py-5 lg:flex-row lg:items-end lg:justify-between">
                <label className="min-w-0 flex-1">
                  <span className="mb-2 block text-[9px] font-bold uppercase text-text-muted">Review note</span>
                  <input
                    type="text"
                    value={reviewNote}
                    onChange={(event) => setReviewNote(event.target.value)}
                    placeholder="Optional reason or follow-up note"
                    className="h-10 w-full border border-border bg-bg px-3 text-xs text-text-primary outline-none placeholder:text-text-muted focus:border-brand"
                  />
                </label>
                <div className="flex flex-wrap gap-2">
                  {openSourceUrl && (
                    <a href={openSourceUrl} target="_blank" rel="noreferrer" className="inline-flex h-10 items-center gap-2 border border-border bg-bg px-4 text-xs font-bold text-text-primary hover:border-brand">
                      <Icon icon="solar:link-round-linear" width="17" />
                      Open source
                    </a>
                  )}
                  <button type="button" onClick={() => runGeminiResearch(selected.id, { force: true })} disabled={Boolean(working)} className="inline-flex h-10 items-center gap-2 border border-sky-500/40 bg-bg px-4 text-xs font-bold text-sky-300 hover:bg-sky-500/10 disabled:opacity-50">
                    <Icon icon="solar:restart-linear" width="17" />
                    Retry research
                  </button>
                  {selected.status === 'skipped' || selected.status === 'applied' ? (
                    <button type="button" onClick={() => review('pending')} disabled={Boolean(working)} className="inline-flex h-10 items-center gap-2 border border-border bg-bg px-4 text-xs font-bold text-text-primary hover:border-brand disabled:opacity-50">
                      <Icon icon="solar:restart-linear" width="17" />
                      Reopen lookup
                    </button>
                  ) : (
                    <button type="button" onClick={() => review('skipped')} disabled={Boolean(working)} className="inline-flex h-10 items-center gap-2 border border-border bg-bg px-4 text-xs font-bold text-text-muted hover:border-red-500 hover:text-red-400 disabled:opacity-50">
                      <Icon icon="solar:close-circle-linear" width="17" />
                      Reject
                    </button>
                  )}
                  {['ready', 'needs_review'].includes(selected.status) && (
                    <button type="button" onClick={applySelected} disabled={Boolean(working) || !selectedFields.length} className="inline-flex h-10 items-center gap-2 bg-brand px-5 text-xs font-bold text-white hover:bg-brand/90 disabled:opacity-50">
                      <Icon icon={working === 'apply' ? 'solar:refresh-circle-linear' : 'solar:check-circle-linear'} className={working === 'apply' ? 'animate-spin' : ''} width="18" />
                      Apply {selectedFields.length || ''} selected
                    </button>
                  )}
                </div>
              </footer>
            </>
          )}
        </div>
      </section>
    </div>
  );
}
