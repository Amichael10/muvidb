import { useState, useEffect, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from '@iconify/react';
import toast from 'react-hot-toast';
import { supabase } from '../../lib/supabase';
import { pickAutoMatch } from '../../lib/personNameMatch';
import { searchPeopleByName } from '../../lib/peopleSearch';

const PEOPLE_SEARCH_SELECT = 'id, name, photo_url, film_count';
const NFVCB_RATINGS = ['G', 'PG', 'PG-13', '15', '18'];
const WORKER_COMMAND = [
  'cd C:\\Users\\User\\muvidb',
  'npx tsx scripts/harvest_credits.ts --cookies="C:\\Users\\User\\Downloads\\Cookies.txt"',
].join('\n');
const WORKER_ONLINE_MS = 45_000;

function CandidatePersonNameCell({
  candidate,
  disabled,
  onTextChange,
  onAutoLink,
  onPickPerson,
}) {
  const [suggestions, setSuggestions] = useState([]);
  const [open, setOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const wrapRef = useRef(null);
  const debounceRef = useRef(null);

  useEffect(() => {
    const closeOnOutsideClick = (event) => {
      if (wrapRef.current && !wrapRef.current.contains(event.target)) setOpen(false);
    };
    document.addEventListener('mousedown', closeOnOutsideClick);
    return () => document.removeEventListener('mousedown', closeOnOutsideClick);
  }, []);

  useEffect(() => {
    if (disabled || !open) {
      setSearching(false);
      return undefined;
    }
    const query = String(candidate.raw_name || '').trim();
    clearTimeout(debounceRef.current);

    if (query.length < 2) {
      setSuggestions([]);
      setSearching(false);
      return undefined;
    }

    let cancelled = false;
    setSearching(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const hits = await searchPeopleByName(query, {
          limit: 8,
          select: PEOPLE_SEARCH_SELECT,
        });
        if (cancelled) return;
        setSuggestions(hits);

        // Match the launch-credit OCR behavior: exact and safe name-order
        // matches link automatically, while fuzzy hits remain choices.
        const autoMatch = pickAutoMatch(query, hits);
        if (autoMatch && autoMatch.id !== candidate.matched_person_id) {
          onAutoLink(autoMatch);
        }
      } catch (error) {
        if (cancelled) return;
        console.error('Harvest people suggestion search failed:', error);
        setSuggestions([]);
      } finally {
        if (!cancelled) setSearching(false);
      }
    }, 280);

    return () => {
      cancelled = true;
      clearTimeout(debounceRef.current);
    };
    // Search only when the typed value changes. Inline row callbacks are
    // intentionally excluded so a match update does not restart the request.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [candidate.raw_name, disabled, open]);

  return (
    <div ref={wrapRef} className="relative">
      <input
        type="text"
        value={candidate.raw_name || ''}
        disabled={disabled}
        autoComplete="off"
        aria-label="Person name"
        onFocus={() => setOpen(true)}
        onChange={(event) => {
          onTextChange(event.target.value);
          setOpen(true);
        }}
        className="w-full bg-surface border border-border rounded-md px-2.5 py-2 text-xs font-bold text-text-primary outline-none focus:border-brand disabled:opacity-70"
        placeholder="Type a name to search profiles…"
      />

      {open && !disabled && String(candidate.raw_name || '').trim().length >= 2 && (
        <div className="absolute left-0 top-full mt-1 w-[min(24rem,90vw)] min-w-[18rem] max-h-72 overflow-y-auto bg-surface border border-border rounded-lg shadow-2xl z-50 ring-1 ring-black/5">
          {searching ? (
            <div className="px-3 py-3 text-[10px] font-bold text-text-muted uppercase tracking-widest">
              Searching profiles…
            </div>
          ) : suggestions.length === 0 ? (
            <div className="px-3 py-3 text-xs text-text-muted">
              No profiles found — approval will create a new person
            </div>
          ) : (
            suggestions.map((person) => (
              <button
                key={person.id}
                type="button"
                aria-label={`Use existing profile ${person.name}`}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => {
                  onPickPerson(person);
                  setOpen(false);
                }}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-left hover:bg-surface-2 transition-colors border-b border-border/50 last:border-0 ${
                  candidate.matched_person_id === person.id ? 'bg-blue-500/5' : ''
                }`}
              >
                <div className="w-8 h-8 rounded-full bg-surface-2 border border-border overflow-hidden shrink-0">
                  {person.photo_url && (
                    <img src={person.photo_url} alt="" className="w-full h-full object-cover" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-bold text-text-primary truncate">
                    {person.name}
                  </div>
                  <div className="text-[9px] text-text-muted font-bold uppercase tracking-wider">
                    {person._suggested
                      ? 'Similar existing profile'
                      : person.film_count
                        ? `${person.film_count} credits`
                        : 'Existing profile'}
                  </div>
                </div>
                {candidate.matched_person_id === person.id && (
                  <Icon icon="solar:check-circle-bold" className="w-4 h-4 text-green-400 shrink-0" />
                )}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Review queue for the headless credit-roll harvester
 * (scripts/harvest_credits.ts). The worker never writes to `credits` — it only
 * proposes candidates here, and nothing goes live until it's approved on this
 * page. Extraction guesses; people decide.
 */
export default function AdminCreditHarvest() {
  const [stats, setStats] = useState(null);
  const [groups, setGroups] = useState([]);      // [{ film, candidates[] }]
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('pending');
  const [minConfidence, setMinConfidence] = useState(0);
  const [selected, setSelected] = useState(new Set());
  const [busy, setBusy] = useState(false);
  const [approvalProgress, setApprovalProgress] = useState(null);
  const [moviePage, setMoviePage] = useState(0);
  const [totalMovies, setTotalMovies] = useState(0);
  const [genreOptions, setGenreOptions] = useState([]);
  const [metadataSaving, setMetadataSaving] = useState(false);
  const [harvestControl, setHarvestControl] = useState(null);
  const [controlBusy, setControlBusy] = useState(false);
  const [monitorOpen, setMonitorOpen] = useState(false);
  const [monitorLoading, setMonitorLoading] = useState(false);
  const [monitorError, setMonitorError] = useState('');
  const [workers, setWorkers] = useState([]);
  const [workerLogs, setWorkerLogs] = useState([]);
  const [errorsOnly, setErrorsOnly] = useState(false);

  const loadStats = useCallback(async () => {
    // Pipeline progress — mirrors what the worker is doing on the other machine.
    const counts = {};
    for (const s of ['pending', 'running', 'done', 'failed']) {
      const { count } = await supabase
        .from('credit_harvest_jobs')
        .select('*', { count: 'exact', head: true })
        .eq('status', s);
      counts[s] = count ?? 0;
    }
    for (const o of ['credits_found', 'no_credits']) {
      const { count } = await supabase
        .from('credit_harvest_jobs')
        .select('*', { count: 'exact', head: true })
        .eq('outcome', o);
      counts[o] = count ?? 0;
    }
    const { count: pendingCands } = await supabase
      .from('credit_candidates')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending');
    counts.pendingCandidates = pendingCands ?? 0;
    setStats(counts);
  }, []);

  const loadCandidates = useCallback(async () => {
    setLoading(true);
    try {
      const { data: filmPage, error: pageError } = await supabase.rpc(
        'get_credit_candidate_review_films',
        {
          p_status: statusFilter,
          p_min_confidence: minConfidence,
          p_limit: 1,
          p_offset: moviePage,
        },
      );
      if (pageError) throw pageError;

      const pageRow = filmPage?.[0];
      if (!pageRow) {
        setGroups([]);
        setTotalMovies(0);
        setSelected(new Set());
        if (moviePage > 0) setMoviePage((current) => Math.max(0, current - 1));
        return;
      }

      const { data, error } = await supabase
        .from('credit_candidates')
        .select('*, films:film_id (id, title, slug, poster_url, year, youtube_watch_url, synopsis, runtime_minutes, nfvcb_rating, film_genres(genre_id)), people:matched_person_id (id, name, photo_url)')
        .eq('film_id', pageRow.film_id)
        .eq('status', statusFilter)
        .gte('confidence', minConfidence)
        .order('credit_type', { ascending: true })
        .order('role_or_character', { ascending: true, nullsFirst: false })
        .order('confidence', { ascending: false })
        .limit(500);
      if (error) throw error;

      const film = data?.[0]?.films;
      setGroups(data?.length
        ? [{
            film: {
              ...film,
              genre_ids: (film?.film_genres || []).map((row) => row.genre_id),
              _metadataDirty: false,
            },
            candidates: data,
          }]
        : []);
      setTotalMovies(Number(pageRow.total_films) || 0);
      setSelected(new Set());
    } catch (e) {
      toast.error(`Could not load candidates: ${e.message}`);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, minConfidence, moviePage]);

  const loadMonitor = useCallback(async (showLoading = false) => {
    if (showLoading) setMonitorLoading(true);
    try {
      const [controlResult, workersResult, logsResult] = await Promise.all([
        supabase
          .from('credit_harvest_control')
          .select('*')
          .eq('id', 1)
          .maybeSingle(),
        supabase
          .from('credit_harvest_workers')
          .select('*, current_film:current_film_id (id, title, slug)')
          .order('last_seen_at', { ascending: false })
          .limit(20),
        supabase
          .from('credit_harvest_logs')
          .select('id, worker_id, level, event_type, message, created_at, film_id, films:film_id (id, title, slug)')
          .order('created_at', { ascending: false })
          .limit(100),
      ]);

      if (controlResult.error) throw controlResult.error;
      if (workersResult.error) throw workersResult.error;
      if (logsResult.error) throw logsResult.error;

      setHarvestControl(controlResult.data || { paused: false });
      setWorkers(workersResult.data || []);
      setWorkerLogs(logsResult.data || []);
      setMonitorError('');
    } catch (error) {
      console.error('Could not load credit harvest monitor:', error);
      setMonitorError(error.message || 'The worker monitor database controls are unavailable.');
    } finally {
      if (showLoading) setMonitorLoading(false);
    }
  }, []);

  useEffect(() => { loadStats(); }, [loadStats]);
  useEffect(() => { loadCandidates(); }, [loadCandidates]);
  useEffect(() => {
    loadMonitor();
    const refreshEvery = monitorOpen ? 5000 : 15000;
    const timer = setInterval(() => { loadMonitor(); }, refreshEvery);
    return () => clearInterval(timer);
  }, [loadMonitor, monitorOpen]);
  useEffect(() => {
    let cancelled = false;

    const loadGenres = async () => {
      const { data, error } = await supabase
        .from('genres')
        .select('id, name')
        .order('name');
      if (cancelled) return;
      if (error) {
        console.error('Could not load harvest genres:', error);
        toast.error(`Could not load genres: ${error.message}`);
        return;
      }
      setGenreOptions(data || []);
    };

    loadGenres();
    return () => { cancelled = true; };
  }, []);

  const copyWorkerCommand = async () => {
    try {
      await navigator.clipboard.writeText(WORKER_COMMAND);
      toast.success('Worker command copied');
    } catch {
      toast.error('Could not copy automatically. Select the command and copy it.');
    }
  };

  const changeHarvestPause = async (paused) => {
    setControlBusy(true);
    try {
      const { data, error } = await supabase.rpc('set_credit_harvest_paused', {
        p_paused: paused,
      });
      if (error) throw error;

      const control = Array.isArray(data) ? data[0] : data;
      setHarvestControl(control || { paused });
      toast.success(
        paused
          ? 'Pause requested. Active movies will finish first.'
          : 'Harvest resumed. Waiting workers can claim movies again.',
      );
      await Promise.all([loadMonitor(), loadStats()]);
    } catch (error) {
      toast.error(`Could not ${paused ? 'pause' : 'resume'} harvest: ${error.message}`);
    } finally {
      setControlBusy(false);
    }
  };

  const recoverStaleJobs = async () => {
    if (!confirm(
      'Return harvest jobs with no heartbeat for at least 60 minutes to the pending queue?',
    )) return;

    setControlBusy(true);
    try {
      const { data, error } = await supabase.rpc('recover_stale_credit_harvest_jobs', {
        p_stale_after_minutes: 60,
      });
      if (error) throw error;
      toast.success(`Recovered ${Number(data) || 0} stale job(s)`);
      await Promise.all([loadMonitor(true), loadStats()]);
    } catch (error) {
      toast.error(`Could not recover stale jobs: ${error.message}`);
    } finally {
      setControlBusy(false);
    }
  };

  const toggle = (id) => setSelected((prev) => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  const toggleFilm = (group) => setSelected((prev) => {
    const next = new Set(prev);
    const ids = group.candidates.map((c) => c.id);
    const allOn = ids.every((id) => next.has(id));
    ids.forEach((id) => (allOn ? next.delete(id) : next.add(id)));
    return next;
  });

  const selectedRows = () =>
    groups.flatMap((g) => g.candidates).filter((c) => selected.has(c.id));

  const editCandidate = (id, patch) => {
    setGroups((current) => current.map((group) => ({
      ...group,
      candidates: group.candidates.map((candidate) => (
        candidate.id === id
          ? {
              ...candidate,
              ...patch,
              _dirty: true,
              ...(Object.hasOwn(patch, 'raw_name')
                && !Object.hasOwn(patch, 'matched_person_id')
                ? { matched_person_id: null, people: null }
                : {}),
            }
          : candidate
      )),
    })));
  };

  const editFilmMetadata = (filmId, patch) => {
    setGroups((current) => current.map((group) => (
      group.film?.id === filmId
        ? {
            ...group,
            film: {
              ...group.film,
              ...patch,
              _metadataDirty: true,
            },
          }
        : group
    )));
  };

  const toggleFilmGenre = (film, genreId) => {
    const currentIds = Array.isArray(film.genre_ids) ? film.genre_ids : [];
    editFilmMetadata(film.id, {
      genre_ids: currentIds.includes(genreId)
        ? currentIds.filter((id) => id !== genreId)
        : [...currentIds, genreId],
    });
  };

  const saveFilmMetadata = async (film) => {
    const synopsis = String(film.synopsis || '').trim() || null;
    const runtimeText = String(film.runtime_minutes ?? '').trim();
    const runtime = runtimeText === '' ? null : Number(runtimeText);
    const rating = String(film.nfvcb_rating || '').trim();
    const genreIds = [...new Set(film.genre_ids || [])];

    if (runtime !== null && (!Number.isInteger(runtime) || runtime < 1 || runtime > 600)) {
      toast.error('Runtime must be a whole number between 1 and 600 minutes.');
      return;
    }
    if (rating && !NFVCB_RATINGS.includes(rating)) {
      toast.error('Choose a valid content rating.');
      return;
    }

    setMetadataSaving(true);
    try {
      const filmUpdate = {
        synopsis,
        runtime_minutes: runtime,
      };
      if (rating) filmUpdate.nfvcb_rating = rating;

      const { error: filmError } = await supabase
        .from('films')
        .update(filmUpdate)
        .eq('id', film.id);
      if (filmError) throw filmError;

      const { data: currentLinks, error: linksError } = await supabase
        .from('film_genres')
        .select('genre_id')
        .eq('film_id', film.id);
      if (linksError) throw linksError;

      const currentIds = new Set((currentLinks || []).map((row) => row.genre_id));
      const nextIds = new Set(genreIds);
      const toAdd = genreIds.filter((genreId) => !currentIds.has(genreId));
      const toRemove = [...currentIds].filter((genreId) => !nextIds.has(genreId));

      if (toAdd.length) {
        const { error: insertError } = await supabase
          .from('film_genres')
          .insert(toAdd.map((genreId) => ({
            film_id: film.id,
            genre_id: genreId,
          })));
        if (insertError) throw insertError;
      }

      if (toRemove.length) {
        const { error: deleteError } = await supabase
          .from('film_genres')
          .delete()
          .eq('film_id', film.id)
          .in('genre_id', toRemove);
        if (deleteError) throw deleteError;
      }

      setGroups((current) => current.map((group) => (
        group.film?.id === film.id
          ? {
              ...group,
              film: {
                ...group.film,
                synopsis,
                runtime_minutes: runtime,
                nfvcb_rating: rating || group.film.nfvcb_rating || null,
                genre_ids: genreIds,
                _metadataDirty: false,
              },
            }
          : group
      )));
      toast.success(`Saved details for ${film.title}`);
    } catch (error) {
      toast.error(`Could not save movie details: ${error.message}`);
    } finally {
      setMetadataSaving(false);
    }
  };

  const persistCandidate = async (row, showToast = true) => {
    const name = row.raw_name?.replace(/\s+/g, ' ').trim();
    const detail = row.role_or_character?.replace(/\s+/g, ' ').trim() || null;
    if (!name || name.split(' ').length < 2) {
      throw new Error('A person name must contain at least two words.');
    }
    if (!['actor', 'crew'].includes(row.credit_type)) {
      throw new Error('Type must be actor or crew.');
    }
    if (row.credit_type === 'crew' && !detail) {
      throw new Error('Crew candidates need a role.');
    }

    let matchedId = row.matched_person_id || null;
    if (!matchedId) {
      const { data, error: matchError } = await supabase.rpc(
        'find_person_by_name',
        { p_name: name },
      );
      if (matchError) throw matchError;
      matchedId = data || null;
    }

    const patch = {
      raw_name: name,
      role_or_character: detail,
      credit_type: row.credit_type,
      matched_person_id: matchedId || null,
    };
    const { error } = await supabase
      .from('credit_candidates')
      .update(patch)
      .eq('id', row.id);
    if (error) throw error;

    setGroups((current) => current.map((group) => ({
      ...group,
      candidates: group.candidates.map((candidate) => (
        candidate.id === row.id
          ? {
              ...candidate,
              ...patch,
              people: matchedId
                ? row.people?.id === matchedId
                  ? row.people
                  : { id: matchedId, name, photo_url: null }
                : null,
              _dirty: false,
            }
          : candidate
      )),
    })));
    if (showToast) toast.success(`Saved ${name}`);
    return { ...row, ...patch };
  };

  const saveCandidate = async (row) => {
    setBusy(true);
    try {
      await persistCandidate(row);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  /** Approve → create the person if needed, then write a real credit row. */
  const approve = async (rows) => {
    if (!rows.length) return;
    setBusy(true);
    setApprovalProgress({ done: 0, total: rows.length });
    let created = 0;
    let linked = 0;
    const failed = [];

    try {
      for (const [index, row] of rows.entries()) {
        try {
          const { data, error } = await supabase.rpc('approve_credit_candidate', {
            p_candidate_id: row.id,
            p_name: row.raw_name,
            p_credit_type: row.credit_type,
            p_role_or_character: row.role_or_character || null,
            p_matched_person_id: row.matched_person_id || null,
          });
          if (error) throw error;

          const result = Array.isArray(data) ? data[0] : data;
          if (result?.created_person) created++;
          else linked++;
        } catch (error) {
          failed.push({
            name: row.raw_name,
            message: error.message,
          });
        } finally {
          setApprovalProgress({ done: index + 1, total: rows.length });
        }
      }

      // Wait for the queue refresh. When the movie has no pending candidates,
      // page 2 naturally becomes page 1 before approval controls unlock.
      await Promise.all([loadCandidates(), loadStats()]);

      const approvedCount = rows.length - failed.length;
      if (approvedCount) {
        toast.success(`Approved ${approvedCount} (${linked} linked, ${created} new people)`);
      }
      if (failed.length) {
        console.error('Approve failures:', failed);
        const firstFailure = failed[0];
        toast.error(
          `${failed.length} not approved. ${firstFailure.name}: ${firstFailure.message}`,
          { duration: 7000 },
        );
      }
    } finally {
      setApprovalProgress(null);
      setBusy(false);
    }
  };

  /** Reject → keep the row so the same bad name isn't re-proposed later. */
  const reject = async (rows) => {
    if (!rows.length) return;
    setBusy(true);
    const { error } = await supabase.from('credit_candidates')
      .update({ status: 'rejected', reviewed_at: new Date().toISOString() })
      .in('id', rows.map((r) => r.id));
    setBusy(false);
    error ? toast.error(error.message) : toast.success(`Rejected ${rows.length}`);
    loadCandidates(); loadStats();
  };

  /** Delete → remove entirely (for OCR garbage not worth remembering). */
  const remove = async (rows) => {
    if (!rows.length) return;
    if (!confirm(`Permanently delete ${rows.length} candidate(s)? This cannot be undone.`)) return;

    const deletedIds = new Set(rows.map((row) => row.id));
    const remainingCandidateCount = groups
      .flatMap((group) => group.candidates)
      .filter((candidate) => !deletedIds.has(candidate.id))
      .length;

    setBusy(true);
    try {
      const { error } = await supabase.from('credit_candidates')
        .delete().in('id', [...deletedIds]);
      if (error) throw error;

      // Remove only the deleted rows locally. This deliberately preserves
      // unsaved name/type/role edits on every other candidate in the movie.
      setGroups((current) => current
        .map((group) => ({
          ...group,
          candidates: group.candidates.filter((candidate) => !deletedIds.has(candidate.id)),
        }))
        .filter((group) => group.candidates.length > 0));
      setSelected((current) => {
        const next = new Set(current);
        deletedIds.forEach((id) => next.delete(id));
        return next;
      });

      toast.success(`Deleted ${rows.length}`);

      if (remainingCandidateCount === 0) {
        // Only a completed/emptied movie needs a new candidate page.
        await Promise.all([loadCandidates(), loadStats()]);
      } else {
        setStats((current) => current
          ? {
              ...current,
              pendingCandidates: Math.max(0, current.pendingCandidates - rows.length),
            }
          : current);
      }
    } catch (error) {
      toast.error(error.message);
    } finally {
      setBusy(false);
    }
  };

  const confidenceStyle = (c) =>
    c >= 0.7 ? 'bg-green-500/15 text-green-400 border-green-500/30'
      : c >= 0.5 ? 'bg-brand/15 text-brand border-brand/30'
        : 'bg-surface-2 text-text-muted border-border';

  const selCount = selected.size;
  const now = Date.now();
  const onlineWorkers = workers.filter((worker) => (
    !['stopped', 'failed'].includes(worker.status)
    && Number.isFinite(new Date(worker.last_seen_at).getTime())
    && now - new Date(worker.last_seen_at).getTime() <= WORKER_ONLINE_MS
  ));
  const recentFailureCount = workerLogs.filter((entry) => entry.level === 'error').length;
  const visibleWorkerLogs = errorsOnly
    ? workerLogs.filter((entry) => entry.level === 'error')
    : workerLogs;
  const harvestPaused = harvestControl?.paused === true;
  const harvestControlReady = Boolean(harvestControl);
  const harvestPausing = harvestPaused && (stats?.running || 0) > 0;
  const harvestStateLabel = !harvestControlReady
    ? 'Control setup required'
    : harvestPausing
      ? `Pausing · ${stats.running} finishing`
      : harvestPaused
        ? 'Paused'
        : 'Running';

  const workerStatusTone = (status) => {
    if (status === 'running') return 'text-green-400 bg-green-500/10 border-green-500/25';
    if (status === 'paused') return 'text-amber-400 bg-amber-500/10 border-amber-500/25';
    if (status === 'failed') return 'text-red-400 bg-red-500/10 border-red-500/25';
    return 'text-text-muted bg-surface-2 border-border';
  };

  const logTone = (level) => {
    if (level === 'success') return 'text-green-400';
    if (level === 'warning') return 'text-amber-400';
    if (level === 'error') return 'text-red-400';
    return 'text-text-muted';
  };

  const formatMonitorTime = (value) => {
    if (!value) return '—';
    const date = new Date(value);
    if (!Number.isFinite(date.getTime())) return '—';
    return date.toLocaleString([], {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const sourceUrl = (film, candidate) => {
    if (!film?.youtube_watch_url) return null;
    try {
      const url = new URL(film.youtube_watch_url);
      if (Number.isFinite(candidate.source_video_sec)) {
        url.searchParams.set('t', `${Math.max(0, Math.round(candidate.source_video_sec))}s`);
      }
      return url.toString();
    } catch {
      return film.youtube_watch_url;
    }
  };

  const moviePager = () => (
    <div className="card-cal px-4 py-3 flex items-center justify-between gap-4">
      <button
        type="button"
        disabled={loading || moviePage === 0}
        onClick={() => setMoviePage((current) => Math.max(0, current - 1))}
        className="text-xs font-black px-3 py-2 rounded-lg border border-border text-text-primary hover:bg-surface-2 disabled:opacity-35 disabled:cursor-not-allowed flex items-center gap-1.5"
      >
        <Icon icon="solar:alt-arrow-left-linear" className="w-4 h-4" />
        Previous movie
      </button>

      <div className="text-center">
        <div className="text-[9px] font-black uppercase tracking-widest text-text-muted">
          Review progress
        </div>
        <div className="text-sm font-black text-text-primary">
          Movie {totalMovies ? moviePage + 1 : 0} of {totalMovies}
        </div>
      </div>

      <button
        type="button"
        disabled={loading || moviePage + 1 >= totalMovies}
        onClick={() => setMoviePage((current) => current + 1)}
        className="text-xs font-black px-3 py-2 rounded-lg border border-border text-text-primary hover:bg-surface-2 disabled:opacity-35 disabled:cursor-not-allowed flex items-center gap-1.5"
      >
        Next movie
        <Icon icon="solar:alt-arrow-right-linear" className="w-4 h-4" />
      </button>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-black text-text-primary tracking-tight">Credit Harvest Review</h1>
          <p className="text-xs text-text-muted mt-1">
            Candidates extracted from YouTube credit rolls. Nothing is live until approved.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          <span className={`text-[10px] font-black px-2.5 py-2 rounded-lg border ${
            !harvestControlReady
              ? 'text-text-muted bg-surface-2 border-border'
              : harvestPaused
              ? 'text-amber-400 bg-amber-500/10 border-amber-500/25'
              : 'text-green-400 bg-green-500/10 border-green-500/25'
          }`}>
            {harvestStateLabel}
          </span>
          <button
            type="button"
            disabled={controlBusy || !harvestControl}
            onClick={() => changeHarvestPause(!harvestPaused)}
            className={`text-xs font-black px-3 py-2 rounded-lg border disabled:opacity-40 flex items-center gap-2 ${
              harvestPaused
                ? 'text-green-400 bg-green-500/10 border-green-500/30 hover:bg-green-500/20'
                : 'text-amber-400 bg-amber-500/10 border-amber-500/30 hover:bg-amber-500/20'
            }`}
          >
            <Icon
              icon={harvestPaused ? 'solar:play-circle-linear' : 'solar:pause-circle-linear'}
              className="w-4 h-4"
            />
            {!harvestControlReady
              ? 'Control unavailable'
              : controlBusy
              ? 'Updating…'
              : harvestPaused
                ? 'Resume harvest'
                : 'Pause after current movies'}
          </button>
          <button
            onClick={() => {
              loadStats();
              loadCandidates();
              loadMonitor(true);
            }}
            className="text-xs font-bold px-3 py-2 rounded-lg border border-border hover:bg-surface-2 flex items-center gap-2"
          >
            <Icon icon="solar:refresh-linear" className="w-4 h-4" /> Refresh
          </button>
        </div>
      </div>

      {/* Pipeline progress — what the worker machine is doing */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
          {[
            ['Queued', stats.pending, 'text-text-primary'],
            ['Running', stats.running, 'text-brand'],
            ['Processed', stats.done, 'text-text-primary'],
            ['Rolls found', stats.credits_found, 'text-green-400'],
            ['No credits', stats.no_credits, 'text-text-muted'],
            ['To review', stats.pendingCandidates, 'text-brand'],
          ].map(([label, value, tone]) => (
            <div key={label} className="card-cal p-3">
              <div className="text-[9px] font-black uppercase tracking-widest text-text-muted">{label}</div>
              <div className={`text-lg font-black ${tone}`}>{value ?? 0}</div>
            </div>
          ))}
        </div>
      )}

      <div className="card-cal p-4 flex flex-col lg:flex-row lg:items-center gap-3">
        <div className="flex items-center gap-3 shrink-0">
          <div className="w-9 h-9 rounded-lg bg-brand/10 border border-brand/20 text-brand flex items-center justify-center">
            <Icon icon="solar:command-linear" className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs font-black text-text-primary">Start a worker</div>
            <div className="text-[10px] text-text-muted">Run once per worker terminal</div>
          </div>
        </div>
        <code className="min-w-0 flex-1 whitespace-pre-wrap break-all text-[10px] leading-relaxed bg-surface-2 border border-border rounded-lg px-3 py-2 text-text-primary">
          {WORKER_COMMAND}
        </code>
        <button
          type="button"
          onClick={copyWorkerCommand}
          className="text-xs font-black px-3 py-2 rounded-lg border border-border text-text-primary hover:bg-surface-2 flex items-center justify-center gap-2 shrink-0"
        >
          <Icon icon="solar:copy-linear" className="w-4 h-4" />
          Copy command
        </button>
      </div>

      {/* Filters + bulk actions */}
      <div className="card-cal p-4 flex flex-wrap items-center gap-3">
        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setMoviePage(0);
          }}
          className="bg-surface border border-border rounded-lg px-3 py-2 text-xs text-text-primary focus:border-brand outline-none"
        >
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
        </select>

        <label className="flex items-center gap-2 text-xs text-text-muted">
          Min confidence
          <select
            value={minConfidence}
            onChange={(e) => {
              setMinConfidence(Number(e.target.value));
              setMoviePage(0);
            }}
            className="bg-surface border border-border rounded-lg px-2 py-2 text-xs text-text-primary focus:border-brand outline-none"
          >
            <option value={0}>Any</option>
            <option value={0.5}>0.5+</option>
            <option value={0.7}>0.7+ (high)</option>
          </select>
        </label>

        <div className="flex-1" />

        {selCount > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-text-muted">{selCount} selected</span>
            <button
              disabled={busy}
              onClick={() => approve(selectedRows())}
              className="text-xs font-black px-3 py-2 rounded-lg bg-green-500/15 text-green-400 border border-green-500/30 hover:bg-green-500/25 disabled:opacity-40"
            >
              Approve
            </button>
            <button
              disabled={busy}
              onClick={() => reject(selectedRows())}
              className="text-xs font-black px-3 py-2 rounded-lg bg-surface-2 text-text-primary border border-border hover:bg-surface-3 disabled:opacity-40"
            >
              Reject
            </button>
            <button
              disabled={busy}
              onClick={() => remove(selectedRows())}
              className="text-xs font-black px-3 py-2 rounded-lg bg-red-500/10 text-red-400 border border-red-500/30 hover:bg-red-500/20 disabled:opacity-40"
            >
              Delete
            </button>
          </div>
        )}
      </div>

      {totalMovies > 0 && moviePager()}

      {loading ? (
        <div className="card-cal p-12 text-center text-xs text-text-muted">Loading candidates…</div>
      ) : groups.length === 0 ? (
        <div className="card-cal p-12 text-center">
          <div className="text-3xl mb-3">🎬</div>
          <p className="text-sm font-bold text-text-primary">Nothing to review</p>
          <p className="text-xs text-text-muted mt-1">
            Run the harvester on the worker machine to populate this queue.
          </p>
          <code className="inline-block mt-3 text-[10px] bg-surface-2 border border-border rounded px-2 py-1">
            npx tsx scripts/harvest_credits.ts
          </code>
        </div>
      ) : (
        <div className="space-y-4">
          {groups.map((group) => {
            const ids = group.candidates.map((c) => c.id);
            const allOn = ids.every((id) => selected.has(id));
            return (
              <div key={group.film?.id || Math.random()} className="card-cal overflow-visible">
                <div className="flex items-center gap-3 p-4 border-b border-border bg-surface-2/30">
                  <input
                    type="checkbox"
                    checked={allOn}
                    onChange={() => toggleFilm(group)}
                    className="w-4 h-4 accent-[color:var(--color-brand)]"
                  />
                  {group.film?.poster_url && (
                    <img src={group.film.poster_url} alt="" className="w-8 h-11 object-cover rounded border border-border" />
                  )}
                  <div className="min-w-0 flex-1">
                    <Link
                      to={`/films/${group.film?.slug || group.film?.id}`}
                      target="_blank"
                      className="text-sm font-bold text-text-primary hover:text-brand truncate block"
                    >
                      {group.film?.title || 'Unknown film'}
                    </Link>
                    <div className="text-[10px] text-text-muted">
                      {group.film?.year || '—'} · {group.candidates.length} candidate{group.candidates.length === 1 ? '' : 's'}
                    </div>
                  </div>
                  <button
                    disabled={busy}
                    onClick={() => approve(group.candidates)}
                    className="text-[10px] font-black px-2.5 py-1.5 rounded-md bg-green-500/15 text-green-400 border border-green-500/30 hover:bg-green-500/25 disabled:opacity-40"
                  >
                    {approvalProgress
                      ? `Approving ${approvalProgress.done}/${approvalProgress.total}`
                      : `Approve all ${group.candidates.length}`}
                  </button>
                </div>

                <div className="p-4 border-b border-border bg-surface/60">
                  <div className="flex items-center justify-between gap-3 mb-3">
                    <div>
                      <h2 className="text-xs font-black text-text-primary">Movie details</h2>
                      <p className="text-[10px] text-text-muted mt-0.5">
                        These changes update the movie itself and do not approve any credits.
                      </p>
                    </div>
                    <button
                      type="button"
                      disabled={metadataSaving || !group.film?._metadataDirty}
                      onClick={() => saveFilmMetadata(group.film)}
                      className="text-[10px] font-black px-3 py-2 rounded-md bg-brand/15 text-brand border border-brand/30 hover:bg-brand/25 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5 shrink-0"
                    >
                      <Icon
                        icon={metadataSaving ? 'solar:refresh-linear' : 'solar:diskette-linear'}
                        className={`w-4 h-4 ${metadataSaving ? 'animate-spin' : ''}`}
                      />
                      {metadataSaving ? 'Saving details…' : 'Save movie details'}
                    </button>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_9rem_9rem] gap-3">
                    <label className="min-w-0">
                      <span className="block text-[9px] font-black uppercase tracking-wider text-text-muted mb-1">
                        Synopsis
                      </span>
                      <textarea
                        value={group.film?.synopsis || ''}
                        onChange={(event) => editFilmMetadata(group.film.id, {
                          synopsis: event.target.value,
                        })}
                        rows={4}
                        aria-label="Movie synopsis"
                        placeholder="Add or correct the movie synopsis"
                        className="w-full resize-y bg-surface border border-border rounded-md px-3 py-2.5 text-xs leading-relaxed text-text-primary outline-none focus:border-brand"
                      />
                    </label>

                    <label>
                      <span className="block text-[9px] font-black uppercase tracking-wider text-text-muted mb-1">
                        Runtime
                      </span>
                      <div className="relative">
                        <input
                          type="number"
                          min="1"
                          max="600"
                          step="1"
                          value={group.film?.runtime_minutes ?? ''}
                          onChange={(event) => editFilmMetadata(group.film.id, {
                            runtime_minutes: event.target.value,
                          })}
                          aria-label="Runtime in minutes"
                          placeholder="120"
                          className="w-full bg-surface border border-border rounded-md pl-3 pr-11 py-2.5 text-xs font-bold text-text-primary outline-none focus:border-brand"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-text-muted pointer-events-none">
                          min
                        </span>
                      </div>
                    </label>

                    <label>
                      <span className="block text-[9px] font-black uppercase tracking-wider text-text-muted mb-1">
                        Content rating
                      </span>
                      <select
                        value={group.film?.nfvcb_rating || ''}
                        onChange={(event) => editFilmMetadata(group.film.id, {
                          nfvcb_rating: event.target.value,
                        })}
                        aria-label="Content rating"
                        className="w-full bg-surface border border-border rounded-md px-3 py-2.5 text-xs font-bold text-text-primary outline-none focus:border-brand"
                      >
                        <option value="" disabled>
                          Choose
                        </option>
                        {NFVCB_RATINGS.map((rating) => (
                          <option key={rating} value={rating}>
                            {rating}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>

                  <fieldset className="mt-3">
                    <legend className="text-[9px] font-black uppercase tracking-wider text-text-muted mb-2">
                      Genres
                    </legend>
                    {genreOptions.length ? (
                      <div className="flex flex-wrap gap-2">
                        {genreOptions.map((genre) => {
                          const checked = (group.film?.genre_ids || []).includes(genre.id);
                          return (
                            <label
                              key={genre.id}
                              className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-[10px] font-bold cursor-pointer transition-colors ${
                                checked
                                  ? 'border-brand/40 bg-brand/15 text-brand'
                                  : 'border-border bg-surface text-text-muted hover:text-text-primary hover:bg-surface-2'
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => toggleFilmGenre(group.film, genre.id)}
                                className="w-3 h-3 accent-[color:var(--color-brand)]"
                              />
                              {genre.name}
                            </label>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="text-[10px] text-text-muted">Loading genres…</div>
                    )}
                  </fieldset>
                </div>

                <div className="divide-y divide-border">
                  {group.candidates.map((c) => (
                    <div key={c.id} className="px-4 py-3 hover:bg-surface-2/30">
                      <div className="flex items-end gap-3">
                        <input
                          type="checkbox"
                          checked={selected.has(c.id)}
                          onChange={() => toggle(c.id)}
                          className="w-4 h-4 mb-2 accent-[color:var(--color-brand)]"
                        />

                        <div className="min-w-0 flex-[2]">
                          <span className="block text-[9px] font-black uppercase tracking-wider text-text-muted mb-1">
                            Person name
                          </span>
                          <CandidatePersonNameCell
                            candidate={c}
                            disabled={statusFilter !== 'pending'}
                            onTextChange={(name) => editCandidate(c.id, { raw_name: name })}
                            onAutoLink={(person) => editCandidate(c.id, {
                              matched_person_id: person.id,
                              people: {
                                id: person.id,
                                name: person.name,
                                photo_url: person.photo_url,
                              },
                            })}
                            onPickPerson={(person) => editCandidate(c.id, {
                              raw_name: person.name,
                              matched_person_id: person.id,
                              people: {
                                id: person.id,
                                name: person.name,
                                photo_url: person.photo_url,
                              },
                            })}
                          />
                        </div>

                        <label className="w-28 shrink-0">
                          <span className="block text-[9px] font-black uppercase tracking-wider text-text-muted mb-1">
                            Type
                          </span>
                          <select
                            value={c.credit_type}
                            disabled={statusFilter !== 'pending'}
                            onChange={(e) => editCandidate(c.id, { credit_type: e.target.value })}
                            className="w-full bg-surface border border-border rounded-md px-2 py-2 text-xs font-bold text-text-primary outline-none focus:border-brand disabled:opacity-70"
                          >
                            <option value="actor">Actor</option>
                            <option value="crew">Crew</option>
                          </select>
                        </label>

                        <label className="min-w-0 flex-[2]">
                          <span className="block text-[9px] font-black uppercase tracking-wider text-text-muted mb-1">
                            {c.credit_type === 'actor' ? 'Character' : 'Crew role'}
                          </span>
                          <input
                            value={c.role_or_character || ''}
                            disabled={statusFilter !== 'pending'}
                            onChange={(e) => editCandidate(c.id, { role_or_character: e.target.value })}
                            placeholder={c.credit_type === 'actor' ? 'Character name' : 'e.g. Director'}
                            className="w-full bg-surface border border-border rounded-md px-2.5 py-2 text-xs text-text-primary outline-none focus:border-brand disabled:opacity-70"
                          />
                        </label>

                        <div className="flex items-center gap-2 pb-1.5 shrink-0">
                          {c.people ? (
                            <span
                              className="max-w-36 text-[10px] font-bold text-green-400 flex items-center gap-1"
                              title={`Linked to existing profile: ${c.people.name}`}
                            >
                              <Icon icon="solar:check-circle-bold" className="w-3.5 h-3.5" />
                              <span className="truncate">{c.people.name}</span>
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold text-text-muted" title="Will create a new person on approve">
                              new person
                            </span>
                          )}

                          <span className={`text-[10px] font-black px-1.5 py-0.5 rounded border ${confidenceStyle(c.confidence)}`}>
                            {Math.round(c.confidence * 100)}%
                          </span>

                          {statusFilter === 'pending' && (
                            <div className="flex items-center gap-1">
                              {c._dirty && (
                                <button
                                  disabled={busy}
                                  onClick={() => saveCandidate(c)}
                                  title="Save edits"
                                  className="w-7 h-7 rounded flex items-center justify-center text-brand hover:bg-brand/15 disabled:opacity-40"
                                >
                                  <Icon icon="solar:diskette-linear" className="w-4 h-4" />
                                </button>
                              )}
                              <button
                                disabled={busy}
                                onClick={() => approve([c])}
                                title="Approve"
                                className="w-7 h-7 rounded flex items-center justify-center text-green-400 hover:bg-green-500/15 disabled:opacity-40"
                              >
                                <Icon icon="solar:check-circle-linear" className="w-4 h-4" />
                              </button>
                              <button
                                disabled={busy}
                                onClick={() => reject([c])}
                                title="Reject"
                                className="w-7 h-7 rounded flex items-center justify-center text-text-muted hover:bg-surface-3 disabled:opacity-40"
                              >
                                <Icon icon="solar:close-circle-linear" className="w-4 h-4" />
                              </button>
                              <button
                                disabled={busy}
                                onClick={() => remove([c])}
                                title="Delete"
                                className="w-7 h-7 rounded flex items-center justify-center text-red-400 hover:bg-red-500/15 disabled:opacity-40"
                              >
                                <Icon icon="solar:trash-bin-trash-linear" className="w-4 h-4" />
                              </button>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="ml-7 mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-text-muted">
                        <span>
                          OCR {Math.round((c.ocr_confidence ?? c.confidence) * 100)}%
                        </span>
                        <span>{c.frame_support || 1} frame{c.frame_support === 1 ? '' : 's'}</span>
                        {c.source_layout?.mode && <span>{c.source_layout.mode}</span>}
                        {c.source_ocr_text && (
                          <code className="max-w-xl truncate text-[10px] text-text-primary bg-surface-2 border border-border rounded px-1.5 py-0.5">
                            {c.source_ocr_text}
                          </code>
                        )}
                        {sourceUrl(group.film, c) && (
                          <a
                            href={sourceUrl(group.film, c)}
                            target="_blank"
                            rel="noreferrer"
                            className="font-bold text-brand hover:underline"
                          >
                            Open source at {Number.isFinite(c.source_video_sec)
                              ? `${Math.floor(c.source_video_sec / 60)}:${String(Math.round(c.source_video_sec % 60)).padStart(2, '0')}`
                              : 'video'}
                          </a>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
          {totalMovies > 1 && moviePager()}
        </div>
      )}

      <button
        type="button"
        onClick={() => {
          setMonitorOpen(true);
          loadMonitor(true);
        }}
        aria-label="Open worker monitor"
        className="fixed bottom-6 right-6 z-40 rounded-full bg-brand text-white shadow-2xl shadow-brand/25 border border-white/10 px-4 py-3 flex items-center gap-2 hover:brightness-110"
      >
        <Icon icon="solar:monitor-camera-linear" className="w-5 h-5" />
        <span className="text-xs font-black">Worker monitor</span>
        <span className="min-w-5 h-5 px-1.5 rounded-full bg-black/20 flex items-center justify-center text-[9px] font-black">
          {onlineWorkers.length}
        </span>
        {recentFailureCount > 0 && (
          <span className="min-w-5 h-5 px-1.5 rounded-full bg-red-500 text-white flex items-center justify-center text-[9px] font-black">
            {recentFailureCount}
          </span>
        )}
      </button>

      {monitorOpen && (
        <div className="fixed inset-0 z-[80]">
          <button
            type="button"
            aria-label="Close worker monitor"
            onClick={() => setMonitorOpen(false)}
            className="absolute inset-0 bg-black/65 backdrop-blur-sm"
          />
          <aside
            role="dialog"
            aria-modal="true"
            aria-label="Credit harvest worker monitor"
            className="absolute right-0 top-0 h-full w-full max-w-2xl bg-bg border-l border-border shadow-2xl flex flex-col"
          >
            <div className="px-5 py-4 border-b border-border flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <Icon icon="solar:monitor-camera-linear" className="w-5 h-5 text-brand" />
                  <h2 className="text-base font-black text-text-primary">Worker monitor</h2>
                  {monitorLoading && (
                    <Icon icon="solar:refresh-linear" className="w-4 h-4 text-text-muted animate-spin" />
                  )}
                </div>
                <p className="text-[10px] text-text-muted mt-1">
                  Auto-refreshes every 5 seconds while open.
                </p>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => loadMonitor(true)}
                  className="w-8 h-8 rounded-lg border border-border text-text-muted hover:text-text-primary hover:bg-surface-2 flex items-center justify-center"
                  title="Refresh monitor"
                >
                  <Icon icon="solar:refresh-linear" className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setMonitorOpen(false)}
                  className="w-8 h-8 rounded-lg border border-border text-text-muted hover:text-text-primary hover:bg-surface-2 flex items-center justify-center"
                  title="Close"
                >
                  <Icon icon="solar:close-circle-linear" className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-5">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  ['Control', harvestStateLabel],
                  ['Online workers', onlineWorkers.length],
                  ['Active jobs', stats?.running ?? 0],
                  ['Recent failures', recentFailureCount],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-lg border border-border bg-surface p-3">
                    <div className="text-[8px] font-black uppercase tracking-widest text-text-muted">
                      {label}
                    </div>
                    <div className="text-sm font-black text-text-primary mt-1">{value}</div>
                  </div>
                ))}
              </div>

              {monitorError && (
                <div className="rounded-xl border border-amber-500/25 bg-amber-500/10 p-3 flex items-start gap-2">
                  <Icon icon="solar:danger-triangle-linear" className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
                  <div>
                    <div className="text-[10px] font-black text-amber-300">
                      Monitor database setup is not active yet
                    </div>
                    <p className="text-[10px] text-text-muted mt-1">
                      Apply the harvest-control migration, then refresh this panel.
                    </p>
                  </div>
                </div>
              )}

              <div className="rounded-xl border border-border bg-surface p-4">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div>
                    <div className="text-xs font-black text-text-primary">Harvest control</div>
                    <p className="text-[10px] text-text-muted mt-1">
                      Pause lets active movies finish, then blocks every new claim.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={controlBusy || !harvestControl}
                      onClick={() => changeHarvestPause(!harvestPaused)}
                      className={`text-[10px] font-black px-3 py-2 rounded-lg border disabled:opacity-40 flex items-center gap-1.5 ${
                        harvestPaused
                          ? 'text-green-400 bg-green-500/10 border-green-500/30'
                          : 'text-amber-400 bg-amber-500/10 border-amber-500/30'
                      }`}
                    >
                      <Icon
                        icon={harvestPaused ? 'solar:play-circle-linear' : 'solar:pause-circle-linear'}
                        className="w-4 h-4"
                      />
                      {!harvestControlReady
                        ? 'Control unavailable'
                        : harvestPaused
                          ? 'Resume'
                          : 'Pause'}
                    </button>
                    <button
                      type="button"
                      disabled={controlBusy}
                      onClick={recoverStaleJobs}
                      className="text-[10px] font-black px-3 py-2 rounded-lg border border-border text-text-primary hover:bg-surface-2 disabled:opacity-40"
                      title="Return jobs with no heartbeat for 60 minutes to pending"
                    >
                      Recover stuck jobs
                    </button>
                  </div>
                </div>
              </div>

              <section>
                <div className="flex items-center justify-between gap-3 mb-2">
                  <h3 className="text-xs font-black text-text-primary">
                    Workers ({workers.length})
                  </h3>
                  <button
                    type="button"
                    onClick={copyWorkerCommand}
                    className="text-[10px] font-black text-brand hover:underline flex items-center gap-1"
                  >
                    <Icon icon="solar:copy-linear" className="w-3.5 h-3.5" />
                    Copy start command
                  </button>
                </div>

                {workers.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-border p-5 text-center">
                    <p className="text-xs font-bold text-text-primary">No workers have reported yet</p>
                    <p className="text-[10px] text-text-muted mt-1">
                      Existing workers will appear after they are restarted with the latest script.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {workers.map((worker) => {
                      const seenAt = new Date(worker.last_seen_at).getTime();
                      const online = !['stopped', 'failed'].includes(worker.status)
                        && Number.isFinite(seenAt)
                        && now - seenAt <= WORKER_ONLINE_MS;
                      return (
                        <div key={worker.worker_id} className="rounded-xl border border-border bg-surface p-3">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <span className={`w-2 h-2 rounded-full ${
                                  online ? 'bg-green-400' : 'bg-text-muted/40'
                                }`} />
                                <span className="text-xs font-black text-text-primary truncate">
                                  {worker.machine_name}
                                  {worker.process_id ? ` · PID ${worker.process_id}` : ''}
                                </span>
                              </div>
                              <p className="text-[10px] text-text-muted mt-1 truncate">
                                {worker.last_message || 'No status message'}
                              </p>
                              {worker.current_film?.title && (
                                <Link
                                  to={`/films/${worker.current_film.slug || worker.current_film.id}`}
                                  target="_blank"
                                  className="inline-block text-[10px] font-bold text-brand hover:underline mt-1"
                                >
                                  {worker.current_film.title}
                                </Link>
                              )}
                            </div>
                            <span className={`text-[9px] font-black uppercase px-2 py-1 rounded border ${workerStatusTone(worker.status)}`}>
                              {online ? worker.status : 'offline'}
                            </span>
                          </div>
                          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[9px] text-text-muted">
                            <span>Seen {formatMonitorTime(worker.last_seen_at)}</span>
                            <span>{worker.processed_count || 0} processed</span>
                            <span className={worker.failure_count ? 'text-red-400' : ''}>
                              {worker.failure_count || 0} failed
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>

              <section>
                <div className="flex items-center justify-between gap-3 mb-2">
                  <h3 className="text-xs font-black text-text-primary">
                    Recent log ({visibleWorkerLogs.length})
                  </h3>
                  <button
                    type="button"
                    onClick={() => setErrorsOnly((current) => !current)}
                    className={`text-[10px] font-black px-2.5 py-1.5 rounded-md border ${
                      errorsOnly
                        ? 'text-red-400 bg-red-500/10 border-red-500/25'
                        : 'text-text-muted border-border hover:bg-surface-2'
                    }`}
                  >
                    {errorsOnly ? 'Showing failures' : 'Show failures only'}
                  </button>
                </div>

                {visibleWorkerLogs.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-border p-5 text-center text-[10px] text-text-muted">
                    {errorsOnly ? 'No failures in the recent log.' : 'No worker events recorded yet.'}
                  </div>
                ) : (
                  <div className="rounded-xl border border-border bg-surface divide-y divide-border overflow-hidden">
                    {visibleWorkerLogs.map((entry) => (
                      <div key={entry.id} className="px-3 py-2.5 flex items-start gap-2.5">
                        <Icon
                          icon={entry.level === 'error'
                            ? 'solar:danger-triangle-linear'
                            : entry.level === 'success'
                              ? 'solar:check-circle-linear'
                              : entry.level === 'warning'
                                ? 'solar:info-circle-linear'
                                : 'solar:clock-circle-linear'}
                          className={`w-4 h-4 mt-0.5 shrink-0 ${logTone(entry.level)}`}
                        />
                        <div className="min-w-0 flex-1">
                          <p className={`text-[11px] leading-relaxed ${entry.level === 'error' ? 'text-red-300' : 'text-text-primary'}`}>
                            {entry.message}
                          </p>
                          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[9px] text-text-muted">
                            <span>{formatMonitorTime(entry.created_at)}</span>
                            <span>{entry.worker_id === 'dashboard' ? 'Dashboard' : entry.worker_id}</span>
                            {entry.films?.title && (
                              <Link
                                to={`/films/${entry.films.slug || entry.films.id}`}
                                target="_blank"
                                className="font-bold text-brand hover:underline"
                              >
                                {entry.films.title}
                              </Link>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
