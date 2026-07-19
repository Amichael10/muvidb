import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from '@iconify/react';
import { toast } from 'react-hot-toast';
import { supabase } from '../../lib/supabase';

const PAGE_SIZE = 30;

function isPlausibleRuntime(value) {
  const runtime = Number(value);
  return Number.isInteger(runtime) && runtime >= 20 && runtime <= 600;
}

function plainText(value) {
  if (!value) return '';
  if (typeof DOMParser === 'undefined') return String(value);
  return new DOMParser()
    .parseFromString(String(value), 'text/html')
    .body.textContent
    ?.replace(/\s+/g, ' ')
    .trim() || '';
}

function formatDate(value) {
  if (!value) return 'Unknown';
  return new Date(value).toLocaleString('en-NG', {
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function sourceLabel(value) {
  if (!value) return 'Unknown source';
  return value.replace(/[_-]+/g, ' ').replace(/\b\w/g, letter => letter.toUpperCase());
}

function StatusBadge({ decision }) {
  const config = decision === 'promoted'
    ? { label: 'Approved', icon: 'solar:check-circle-linear', className: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20' }
    : decision === 'blacklisted'
      ? { label: 'Rejected', icon: 'solar:close-circle-linear', className: 'text-red-500 bg-red-500/10 border-red-500/20' }
      : { label: 'Pending', icon: 'solar:clock-circle-linear', className: 'text-brand bg-brand/10 border-brand/20' };

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-[10px] font-bold uppercase ${config.className}`}>
      <Icon icon={config.icon} width="13" />
      {config.label}
    </span>
  );
}

function PromoteModal({ pending, onClose, onDone }) {
  const [mode, setMode] = useState('new');
  const [form, setForm] = useState({
    title: pending.title,
    year: '',
    runtime_minutes: isPlausibleRuntime(pending.runtime_minutes) ? pending.runtime_minutes : '',
    genres: '',
    synopsis: pending.synopsis ?? '',
    poster_url: pending.poster_url ?? '',
    language: 'English',
  });
  const [filmSearch, setFilmSearch] = useState(pending.title);
  const [filmResults, setFilmResults] = useState([]);
  const [selectedFilm, setSelectedFilm] = useState(null);
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (mode !== 'existing' || filmSearch.trim().length < 2) {
      setFilmResults([]);
      return undefined;
    }

    let active = true;
    const timer = window.setTimeout(async () => {
      setSearching(true);
      const { data, error: queryError } = await supabase
        .from('films')
        .select('id,title,year,poster_url,is_in_cinemas')
        .ilike('title', `%${filmSearch.trim()}%`)
        .order('year', { ascending: false, nullsFirst: false })
        .limit(8);
      if (!active) return;
      setSearching(false);
      if (queryError) {
        setError(queryError.message);
        return;
      }
      setFilmResults(data ?? []);
    }, 250);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [filmSearch, mode]);

  const submit = async event => {
    event.preventDefault();
    if (mode === 'existing' && !selectedFilm) {
      setError('Select the matching catalog film first.');
      return;
    }

    setSaving(true);
    setError('');
    const filmData = mode === 'new'
      ? {
          ...form,
          genres: form.genres.split(',').map(value => value.trim()).filter(Boolean),
          runtime_minutes: isPlausibleRuntime(form.runtime_minutes)
            ? Number(form.runtime_minutes)
            : null,
        }
      : {};

    const { data: filmId, error: promoteError } = await supabase.rpc('promote_pending_cinema_film', {
      p_pending_id: pending.id,
      p_existing_film_id: selectedFilm?.id ?? null,
      p_film_data: filmData,
    });

    setSaving(false);
    if (promoteError) {
      setError(promoteError.message);
      return;
    }
    onDone(filmId);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-lg border border-border bg-surface shadow-2xl">
        <div className="sticky top-0 z-10 flex items-start justify-between border-b border-border bg-surface px-6 py-5">
          <div>
            <p className="text-[10px] font-bold uppercase text-brand">Approve cinema film</p>
            <h2 className="mt-1 text-xl font-bold text-text-primary">{pending.title}</h2>
          </div>
          <button type="button" onClick={onClose} className="flex h-9 w-9 items-center justify-center rounded-md border border-border text-text-muted hover:text-text-primary" title="Close">
            <Icon icon="solar:close-circle-linear" width="20" />
          </button>
        </div>

        <form onSubmit={submit} className="p-6">
          <div className="mb-6 grid grid-cols-2 gap-2 rounded-md bg-surface-2 p-1">
            <button type="button" onClick={() => setMode('new')} className={`h-10 rounded-md text-xs font-bold ${mode === 'new' ? 'bg-surface text-brand shadow-sm' : 'text-text-muted'}`}>
              Create new film
            </button>
            <button type="button" onClick={() => setMode('existing')} className={`h-10 rounded-md text-xs font-bold ${mode === 'existing' ? 'bg-surface text-brand shadow-sm' : 'text-text-muted'}`}>
              Link existing film
            </button>
          </div>

          {error && (
            <div className="mb-5 flex items-start gap-2 rounded-md border border-red-500/20 bg-red-500/10 p-3 text-xs text-red-500">
              <Icon icon="solar:danger-triangle-linear" width="17" />
              <span>{error}</span>
            </div>
          )}

          {mode === 'existing' ? (
            <div className="space-y-4">
              <label className="block">
                <span className="mb-2 block text-[10px] font-bold uppercase text-text-muted">Catalog title</span>
                <div className="relative">
                  <Icon icon="solar:magnifer-linear" className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" width="18" />
                  <input value={filmSearch} onChange={event => { setFilmSearch(event.target.value); setSelectedFilm(null); }} className="h-11 w-full rounded-md border border-border bg-surface-2 pl-10 pr-4 text-sm text-text-primary outline-none focus:border-brand" />
                </div>
              </label>

              <div className="max-h-64 overflow-y-auto rounded-md border border-border">
                {searching ? (
                  <div className="p-8 text-center text-xs text-text-muted">Searching catalog...</div>
                ) : filmResults.length === 0 ? (
                  <div className="p-8 text-center text-xs text-text-muted">No matching catalog films.</div>
                ) : filmResults.map(film => (
                  <button key={film.id} type="button" onClick={() => setSelectedFilm(film)} className={`flex w-full items-center gap-3 border-b border-border p-3 text-left last:border-0 ${selectedFilm?.id === film.id ? 'bg-brand/10' : 'hover:bg-surface-2'}`}>
                    <div className="h-12 w-9 flex-shrink-0 overflow-hidden rounded-sm bg-surface-3">
                      {film.poster_url && <img src={film.poster_url} alt="" className="h-full w-full object-cover" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold text-text-primary">{film.title}</p>
                      <p className="text-xs text-text-muted">{film.year || 'Year unknown'}{film.is_in_cinemas ? ' · Already in cinemas' : ''}</p>
                    </div>
                    {selectedFilm?.id === film.id && <Icon icon="solar:check-circle-bold" className="text-brand" width="20" />}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <label className="block">
                <span className="mb-2 block text-[10px] font-bold uppercase text-text-muted">Title</span>
                <input value={form.title} onChange={event => setForm(current => ({ ...current, title: event.target.value }))} required className="h-11 w-full rounded-md border border-border bg-surface-2 px-4 text-sm text-text-primary outline-none focus:border-brand" />
              </label>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <label>
                  <span className="mb-2 block text-[10px] font-bold uppercase text-text-muted">Year</span>
                  <input type="number" value={form.year} onChange={event => setForm(current => ({ ...current, year: event.target.value }))} className="h-11 w-full rounded-md border border-border bg-surface-2 px-4 text-sm text-text-primary outline-none focus:border-brand" />
                </label>
                <label>
                  <span className="mb-2 block text-[10px] font-bold uppercase text-text-muted">Runtime</span>
                  <input type="number" min="20" max="600" value={form.runtime_minutes} onChange={event => setForm(current => ({ ...current, runtime_minutes: event.target.value }))} className="h-11 w-full rounded-md border border-border bg-surface-2 px-4 text-sm text-text-primary outline-none focus:border-brand" />
                </label>
                <label>
                  <span className="mb-2 block text-[10px] font-bold uppercase text-text-muted">Language</span>
                  <input value={form.language} onChange={event => setForm(current => ({ ...current, language: event.target.value }))} className="h-11 w-full rounded-md border border-border bg-surface-2 px-4 text-sm text-text-primary outline-none focus:border-brand" />
                </label>
              </div>
              <label className="block">
                <span className="mb-2 block text-[10px] font-bold uppercase text-text-muted">Genres</span>
                <input value={form.genres} onChange={event => setForm(current => ({ ...current, genres: event.target.value }))} placeholder="Drama, Comedy" className="h-11 w-full rounded-md border border-border bg-surface-2 px-4 text-sm text-text-primary outline-none focus:border-brand" />
              </label>
              <label className="block">
                <span className="mb-2 block text-[10px] font-bold uppercase text-text-muted">Synopsis</span>
                <textarea value={form.synopsis} onChange={event => setForm(current => ({ ...current, synopsis: event.target.value }))} rows="4" className="w-full resize-none rounded-md border border-border bg-surface-2 px-4 py-3 text-sm text-text-primary outline-none focus:border-brand" />
              </label>
              <label className="block">
                <span className="mb-2 block text-[10px] font-bold uppercase text-text-muted">Poster URL</span>
                <input value={form.poster_url} onChange={event => setForm(current => ({ ...current, poster_url: event.target.value }))} className="h-11 w-full rounded-md border border-border bg-surface-2 px-4 text-sm text-text-primary outline-none focus:border-brand" />
              </label>
            </div>
          )}

          <div className="mt-7 flex justify-end gap-3 border-t border-border pt-5">
            <button type="button" onClick={onClose} className="h-10 px-4 text-xs font-bold text-text-muted hover:text-text-primary">Cancel</button>
            <button type="submit" disabled={saving} className="inline-flex h-10 items-center gap-2 rounded-md bg-brand px-5 text-xs font-bold text-white hover:bg-brand-hover disabled:opacity-60">
              <Icon icon={saving ? 'solar:refresh-linear' : 'solar:check-circle-linear'} className={saving ? 'animate-spin' : ''} width="17" />
              {saving ? 'Approving...' : 'Approve film'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function AdminCinemaFilms() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [viewMode, setViewMode] = useState('pending');
  const [search, setSearch] = useState('');
  const [source, setSource] = useState('all');
  const [page, setPage] = useState(1);
  const [promoteTarget, setPromoteTarget] = useState(null);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    setError('');
    let query = supabase
      .from('pending_cinema_films')
      .select('*, cinema:cinemas!pending_cinema_films_last_seen_cinema_id_fkey(id,name,city)');

    query = viewMode === 'pending'
      ? query.is('admin_decision', null)
      : query.not('admin_decision', 'is', null);

    const { data, error: queryError } = await query.order('last_seen_at', { ascending: false });
    if (queryError) {
      setError(queryError.message);
      setItems([]);
    } else {
      setItems(data ?? []);
    }
    setLoading(false);
  }, [viewMode]);

  useEffect(() => {
    fetchItems();
    const channel = supabase
      .channel('admin-cinema-triage-page')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pending_cinema_films' }, fetchItems)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchItems]);

  useEffect(() => { setPage(1); }, [search, source, viewMode]);

  const sources = useMemo(() => Array.from(new Set(items.map(item => item.source).filter(Boolean))).sort(), [items]);
  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return items.filter(item => {
      const matchesSource = source === 'all' || item.source === source;
      const matchesSearch = !term || [item.title, item.source, item.cinema?.name, item.synopsis]
        .filter(Boolean)
        .some(value => value.toLowerCase().includes(term));
      return matchesSource && matchesSearch;
    });
  }, [items, search, source]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const visibleItems = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const seenToday = items.filter(item => item.last_seen_at && Date.now() - new Date(item.last_seen_at).getTime() < 86_400_000).length;

  const blacklist = async item => {
    if (!window.confirm(`Reject "${item.title}" from future cinema matching?`)) return;
    const { error: updateError } = await supabase
      .from('pending_cinema_films')
      .update({ admin_decision: 'blacklisted' })
      .eq('id', item.id);
    if (updateError) {
      toast.error(updateError.message);
      return;
    }
    toast.success('Cinema title rejected');
    fetchItems();
  };

  const returnToQueue = async item => {
    const { error: updateError } = await supabase
      .from('pending_cinema_films')
      .update({ admin_decision: null })
      .eq('id', item.id);
    if (updateError) {
      toast.error(updateError.message);
      return;
    }
    toast.success('Title returned to review queue');
    fetchItems();
  };

  return (
    <div className="mx-auto max-w-[1500px] pb-20">
      <div className="mb-7 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="mb-1 text-[10px] font-bold uppercase text-brand">Cinema ingestion</p>
          <h1 className="text-3xl font-bold text-text-primary">Cinema Film Review</h1>
        </div>
        <Link to="/admin/cinema-scraping" className="inline-flex h-10 items-center gap-2 self-start rounded-md border border-border bg-surface px-4 text-xs font-bold text-text-primary hover:border-brand/40 hover:text-brand">
          <Icon icon="solar:refresh-linear" width="17" />
          Scraper status
        </Link>
      </div>

      <div className="mb-7 grid grid-cols-1 border-y border-border bg-surface sm:grid-cols-3">
        <div className="border-b border-border p-5 sm:border-b-0 sm:border-r">
          <p className="text-[10px] font-bold uppercase text-text-muted">{viewMode === 'pending' ? 'Awaiting review' : 'Archived decisions'}</p>
          <p className="mt-2 text-3xl font-bold text-text-primary">{items.length}</p>
        </div>
        <div className="border-b border-border p-5 sm:border-b-0 sm:border-r">
          <p className="text-[10px] font-bold uppercase text-text-muted">Seen in last 24 hours</p>
          <p className="mt-2 text-3xl font-bold text-text-primary">{seenToday}</p>
        </div>
        <div className="p-5">
          <p className="text-[10px] font-bold uppercase text-text-muted">Active scraper sources</p>
          <p className="mt-2 text-3xl font-bold text-text-primary">{sources.length}</p>
        </div>
      </div>

      <div className="mb-5 flex flex-col gap-3 xl:flex-row xl:items-center">
        <div className="grid grid-cols-2 gap-1 rounded-md border border-border bg-surface p-1">
          <button onClick={() => setViewMode('pending')} className={`h-9 rounded-md px-4 text-xs font-bold ${viewMode === 'pending' ? 'bg-brand text-white' : 'text-text-muted hover:text-text-primary'}`}>Pending</button>
          <button onClick={() => setViewMode('decided')} className={`h-9 rounded-md px-4 text-xs font-bold ${viewMode === 'decided' ? 'bg-brand text-white' : 'text-text-muted hover:text-text-primary'}`}>Decided</button>
        </div>
        <div className="relative min-w-0 flex-1">
          <Icon icon="solar:magnifer-linear" className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" width="18" />
          <input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search title, source or cinema" className="h-11 w-full rounded-md border border-border bg-surface pl-10 pr-4 text-sm text-text-primary outline-none focus:border-brand" />
        </div>
        <select value={source} onChange={event => setSource(event.target.value)} className="h-11 rounded-md border border-border bg-surface px-3 text-sm text-text-primary outline-none focus:border-brand">
          <option value="all">All sources</option>
          {sources.map(value => <option key={value} value={value}>{sourceLabel(value)}</option>)}
        </select>
        <button onClick={fetchItems} className="flex h-11 w-11 items-center justify-center rounded-md border border-border bg-surface text-text-muted hover:text-brand" title="Refresh queue">
          <Icon icon="solar:refresh-linear" width="19" />
        </button>
      </div>

      {error && (
        <div className="mb-5 flex items-start justify-between gap-4 rounded-md border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-500">
          <div className="flex gap-2"><Icon icon="solar:danger-triangle-linear" width="20" /><span>{error}</span></div>
          <button onClick={fetchItems} className="text-xs font-bold underline">Retry</button>
        </div>
      )}

      <div className="overflow-hidden rounded-md border border-border bg-surface">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1050px] text-left">
            <thead className="border-b border-border bg-surface-2 text-[10px] font-bold uppercase text-text-muted">
              <tr>
                <th className="px-5 py-4">Film</th>
                <th className="px-5 py-4">Latest signal</th>
                <th className="px-5 py-4">Metadata</th>
                <th className="px-5 py-4">Status</th>
                <th className="px-5 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr><td colSpan="5" className="p-16 text-center text-sm text-text-muted">Loading cinema signals...</td></tr>
              ) : visibleItems.length === 0 && !error ? (
                <tr><td colSpan="5" className="p-16 text-center"><Icon icon="solar:inbox-linear" className="mx-auto mb-3 text-text-muted" width="28" /><p className="text-sm font-bold text-text-primary">No titles found</p></td></tr>
              ) : visibleItems.map(item => (
                <tr key={item.id} className="align-middle hover:bg-surface-2/50">
                  <td className="px-5 py-4">
                    <div className="flex max-w-md items-center gap-3">
                      <div className="h-16 w-11 flex-shrink-0 overflow-hidden rounded-sm bg-surface-3">
                        {item.poster_url ? <img src={item.poster_url} alt="" className="h-full w-full object-cover" /> : <Icon icon="solar:clapperboard-play-linear" className="m-auto h-full text-text-muted" width="20" />}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold text-text-primary">{item.title}</p>
                      <p className="mt-1 line-clamp-2 text-xs leading-5 text-text-muted">{plainText(item.synopsis) || 'No synopsis supplied by the cinema.'}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    <p className="text-xs font-bold text-text-primary">{sourceLabel(item.source)}</p>
                    <p className="mt-1 text-xs text-text-muted">{item.cinema?.name || 'Cinema not recorded'}{item.cinema?.city ? ` · ${item.cinema.city}` : ''}</p>
                    <p className="mt-1 text-[10px] text-text-muted">{formatDate(item.last_seen_at)}</p>
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex flex-wrap gap-2 text-[10px] font-bold text-text-muted">
                      <span className="rounded-md bg-surface-2 px-2 py-1">{item.showtime_count || 0} sightings</span>
                      {isPlausibleRuntime(item.runtime_minutes) && <span className="rounded-md bg-surface-2 px-2 py-1">{item.runtime_minutes} min</span>}
                      {item.rating && <span className="rounded-md bg-surface-2 px-2 py-1">{item.rating}</span>}
                    </div>
                  </td>
                  <td className="px-5 py-4"><StatusBadge decision={item.admin_decision} /></td>
                  <td className="px-5 py-4">
                    <div className="flex justify-end gap-2">
                      {!item.admin_decision && (
                        <>
                          <button onClick={() => setPromoteTarget(item)} className="inline-flex h-9 items-center gap-1.5 rounded-md bg-brand px-3 text-xs font-bold text-white hover:bg-brand-hover">
                            <Icon icon="solar:check-circle-linear" width="16" /> Approve
                          </button>
                          <button onClick={() => blacklist(item)} className="flex h-9 w-9 items-center justify-center rounded-md border border-border text-text-muted hover:border-red-500/30 hover:text-red-500" title="Reject title">
                            <Icon icon="solar:close-circle-linear" width="18" />
                          </button>
                        </>
                      )}
                      {item.admin_decision === 'blacklisted' && (
                        <button onClick={() => returnToQueue(item)} className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border px-3 text-xs font-bold text-text-primary hover:border-brand/40 hover:text-brand">
                          <Icon icon="solar:restart-linear" width="16" /> Restore
                        </button>
                      )}
                      {item.admin_decision === 'promoted' && item.promoted_film_id && (
                        <Link to={`/film/${item.promoted_film_id}`} target="_blank" className="flex h-9 w-9 items-center justify-center rounded-md border border-border text-text-muted hover:text-brand" title="Open film">
                          <Icon icon="solar:arrow-right-up-linear" width="18" />
                        </Link>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {!loading && filtered.length > PAGE_SIZE && (
          <div className="flex items-center justify-between border-t border-border px-5 py-3">
            <p className="text-xs text-text-muted">Page {page} of {pageCount}</p>
            <div className="flex gap-2">
              <button disabled={page === 1} onClick={() => setPage(value => value - 1)} className="flex h-8 w-8 items-center justify-center rounded-md border border-border text-text-muted disabled:opacity-30" title="Previous page"><Icon icon="solar:alt-arrow-left-linear" /></button>
              <button disabled={page === pageCount} onClick={() => setPage(value => value + 1)} className="flex h-8 w-8 items-center justify-center rounded-md border border-border text-text-muted disabled:opacity-30" title="Next page"><Icon icon="solar:alt-arrow-right-linear" /></button>
            </div>
          </div>
        )}
      </div>

      {promoteTarget && (
        <PromoteModal
          pending={promoteTarget}
          onClose={() => setPromoteTarget(null)}
          onDone={() => {
            setPromoteTarget(null);
            toast.success('Film approved and showtimes transferred');
            fetchItems();
          }}
        />
      )}
    </div>
  );
}
