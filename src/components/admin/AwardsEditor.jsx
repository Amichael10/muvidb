import { useEffect, useRef, useState } from 'react';
import { Icon } from '@iconify/react';
import { supabase } from '../../lib/supabase';

/**
 * Awards & nominations editor for the jsonb `awards` column, shared by the
 * person drawer (people.awards) and the film drawer (films.awards).
 *
 * Person awards can soft-link to a film via `film_id` (poster + route on the
 * public person page). Film awards store recipient name strings.
 */
export default function AwardsEditor({ value, onChange, variant }) {
  const awards = Array.isArray(value) ? value : [];

  const blank = {
    organization: 'AMVCA',
    year: '',
    season: '',
    category: '',
    won: false,
    ...(variant === 'person' ? { work: '', film_id: null } : { recipients: [] }),
  };

  const update = (idx, patch) => {
    const next = [...awards];
    next[idx] = { ...next[idx], ...patch };
    onChange(next);
  };

  return (
    <section className="space-y-6">
      <div className="flex items-center justify-between pb-2 border-b border-border">
        <div className="flex items-center gap-2">
          <span className="text-xl">🏆</span>
          <h4 className="text-xs font-bold text-text-muted">Awards &amp; Nominations</h4>
          {awards.length > 0 && (
            <span className="text-[10px] font-black bg-brand/10 text-brand border border-brand/20 rounded-xl px-2 py-0.5">
              {awards.length}
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={() => onChange([...awards, blank])}
          className="flex items-center gap-1.5 text-xs font-bold text-brand hover:underline"
        >
          <Icon icon="solar:add-circle-linear" width="16" /> Add award
        </button>
      </div>

      {awards.length === 0 ? (
        <p className="text-xs text-text-muted italic">
          No awards yet. Click &quot;Add award&quot; to record a win or nomination.
        </p>
      ) : (
        <div className="space-y-3">
          {awards.map((award, idx) => (
            <div key={idx} className="rounded-lg border border-border bg-surface-2/30 p-3 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1 p-1 bg-surface rounded-lg border border-border">
                  <button
                    type="button"
                    onClick={() => update(idx, { won: true })}
                    className={`px-3 py-1 rounded text-[10px] font-black uppercase tracking-wider transition-all ${
                      award.won ? 'bg-brand text-white' : 'text-text-muted hover:text-text-primary'
                    }`}
                  >
                    Winner
                  </button>
                  <button
                    type="button"
                    onClick={() => update(idx, { won: false })}
                    className={`px-3 py-1 rounded text-[10px] font-black uppercase tracking-wider transition-all ${
                      !award.won ? 'bg-amber-500 text-white' : 'text-text-muted hover:text-text-primary'
                    }`}
                  >
                    Nominee
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => onChange(awards.filter((_, i) => i !== idx))}
                  className="text-text-muted hover:text-red-500 transition-colors"
                  title="Remove this award"
                >
                  <Icon icon="solar:trash-bin-trash-linear" width="16" />
                </button>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <input
                  type="text"
                  placeholder="Organization"
                  value={award.organization || ''}
                  onChange={(e) => update(idx, { organization: e.target.value })}
                  className="bg-surface border border-border p-2 rounded-lg text-xs focus:border-brand outline-none"
                />
                <input
                  type="number"
                  placeholder="Year"
                  value={award.year || ''}
                  onChange={(e) => update(idx, { year: e.target.value })}
                  className="bg-surface border border-border p-2 rounded-lg text-xs focus:border-brand outline-none"
                />
                <input
                  type="number"
                  placeholder="Season"
                  value={award.season || ''}
                  onChange={(e) => update(idx, { season: e.target.value })}
                  className="bg-surface border border-border p-2 rounded-lg text-xs focus:border-brand outline-none"
                />
              </div>

              <input
                type="text"
                placeholder="Category (e.g. Best Lead Actress)"
                value={award.category || ''}
                onChange={(e) => update(idx, { category: e.target.value })}
                className="w-full bg-surface border border-border p-2 rounded-lg text-xs focus:border-brand outline-none"
              />

              {variant === 'person' ? (
                <FilmWorkPicker
                  work={award.work || ''}
                  filmId={award.film_id || null}
                  onChange={({ work, film_id }) => update(idx, { work, film_id })}
                />
              ) : (
                <input
                  type="text"
                  placeholder="Recipients, comma separated (e.g. BB Sasore, Kemi Adetiba)"
                  value={(award.recipients || []).join(', ')}
                  onChange={(e) =>
                    update(idx, {
                      recipients: e.target.value
                        .split(',')
                        .map((s) => s.trim())
                        .filter(Boolean),
                    })
                  }
                  className="w-full bg-surface border border-border p-2 rounded-lg text-xs focus:border-brand outline-none"
                />
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function FilmWorkPicker({ work, filmId, onChange }) {
  const [query, setQuery] = useState(work || '');
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);
  const [linkedTitle, setLinkedTitle] = useState(null);
  const [searching, setSearching] = useState(false);
  const wrapRef = useRef(null);

  useEffect(() => {
    setQuery(work || '');
  }, [work]);

  useEffect(() => {
    let cancelled = false;
    if (!filmId) {
      setLinkedTitle(null);
      return undefined;
    }
    (async () => {
      const { data } = await supabase
        .from('films')
        .select('id, title')
        .eq('id', filmId)
        .maybeSingle();
      if (!cancelled) setLinkedTitle(data?.title || null);
    })();
    return () => {
      cancelled = true;
    };
  }, [filmId]);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      return undefined;
    }
    let cancelled = false;
    const t = setTimeout(async () => {
      setSearching(true);
      const { data } = await supabase
        .from('films')
        .select('id, title, year, poster_url')
        .ilike('title', `%${q}%`)
        .order('view_count', { ascending: false })
        .limit(8);
      if (!cancelled) {
        setResults(data || []);
        setSearching(false);
      }
    }, 280);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [query]);

  useEffect(() => {
    const onDoc = (e) => {
      if (!wrapRef.current?.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  return (
    <div className="relative space-y-1.5" ref={wrapRef}>
      <input
        type="text"
        placeholder="Search film to link (or type a work title)"
        value={query}
        onChange={(e) => {
          const next = e.target.value;
          setQuery(next);
          setOpen(true);
          // Typing freely clears the soft link until a result is picked
          onChange({ work: next, film_id: null });
        }}
        onFocus={() => setOpen(true)}
        className="w-full bg-surface border border-border p-2 rounded-lg text-xs focus:border-brand outline-none"
      />
      {filmId ? (
        <p className="text-[10px] text-green-500 font-bold flex items-center gap-1">
          <Icon icon="solar:link-linear" width="12" />
          Linked{linkedTitle ? `: ${linkedTitle}` : ''} — poster will show on the person page
          <button
            type="button"
            className="ml-auto text-text-muted hover:text-red-500 font-bold"
            onClick={() => onChange({ work: query, film_id: null })}
          >
            Unlink
          </button>
        </p>
      ) : (
        <p className="text-[10px] text-text-muted">
          Pick a film from search to connect this award to the catalogue.
        </p>
      )}
      {open && query.trim().length >= 2 && (
        <div className="absolute z-30 left-0 right-0 top-full mt-1 rounded-lg border border-border bg-surface shadow-xl overflow-hidden">
          {searching && (
            <p className="px-3 py-2 text-[10px] text-text-muted font-bold">Searching…</p>
          )}
          {!searching && results.length === 0 && (
            <p className="px-3 py-2 text-[10px] text-text-muted">No films found</p>
          )}
          {results.map((film) => (
            <button
              key={film.id}
              type="button"
              onClick={() => {
                setQuery(film.title);
                setOpen(false);
                onChange({ work: film.title, film_id: film.id });
              }}
              className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-surface-2 transition-colors"
            >
              {film.poster_url ? (
                <img src={film.poster_url} alt="" className="w-7 h-10 object-cover rounded-sm bg-surface-2" />
              ) : (
                <span className="w-7 h-10 rounded-sm bg-surface-2 inline-flex items-center justify-center">
                  <Icon icon="solar:clapperboard-linear" className="text-text-muted" width="14" />
                </span>
              )}
              <span className="min-w-0">
                <span className="block text-xs font-bold text-text-primary truncate">{film.title}</span>
                {film.year != null && (
                  <span className="block text-[10px] text-text-muted">{film.year}</span>
                )}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
