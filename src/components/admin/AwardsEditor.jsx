import { useEffect, useMemo, useRef, useState } from 'react';
import { Icon } from '@iconify/react';
import { supabase } from '../../lib/supabase';
import { AWARD_ORGS } from '../../lib/awards';
import { getCategoriesForOrg } from '../../lib/awardsSync';

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
        <div className="space-y-4">
          {awards.map((award, idx) => (
            <div key={idx} className="rounded-xl border border-border bg-surface-2/30 p-4 space-y-3.5">
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
                  className="p-1.5 text-text-muted hover:text-red-500 hover:bg-surface rounded-lg transition-colors"
                  title="Remove this award"
                >
                  <Icon icon="solar:trash-bin-trash-linear" width="16" />
                </button>
              </div>

              <div className="space-y-3">
                {/* 1. Award Ceremony / Organization */}
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-text-muted mb-1">
                    Award Ceremony / Festival
                  </label>
                  <SearchableOrgPicker
                    value={award.organization || ''}
                    onChange={(org) => update(idx, { organization: org })}
                  />
                </div>

                {/* 2. Year and Season */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-text-muted mb-1">
                      Year
                    </label>
                    <SearchableYearPicker
                      value={award.year || ''}
                      onChange={(yr) => update(idx, { year: yr })}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-text-muted mb-1">
                      Season / Edition (Optional)
                    </label>
                    <input
                      type="number"
                      placeholder="e.g. 10"
                      value={award.season || ''}
                      onChange={(e) => update(idx, { season: e.target.value })}
                      className="w-full bg-surface border border-border p-2 rounded-lg text-xs focus:border-brand outline-none"
                    />
                  </div>
                </div>

                {/* 3. Category Combobox */}
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-text-muted mb-1">
                    Category
                  </label>
                  <SearchableCategoryPicker
                    organization={award.organization}
                    value={award.category || ''}
                    onChange={(cat) => update(idx, { category: cat })}
                  />
                </div>

                {/* 4. Film or Recipients */}
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-text-muted mb-1">
                    {variant === 'person' ? 'Associated Movie / Project' : 'Recipients'}
                  </label>
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
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

/**
 * Searchable Award Organization Combobox with deduplicated list and clean wide popover
 */
function SearchableOrgPicker({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(value || '');
  const wrapRef = useRef(null);

  useEffect(() => {
    setQuery(value || '');
  }, [value]);

  useEffect(() => {
    const onDoc = (e) => {
      if (!wrapRef.current?.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  // Strict deduplication of AWARD_ORGS by ID
  const uniqueOrgs = useMemo(() => {
    const seen = new Set();
    return AWARD_ORGS.filter((o) => {
      const key = (o.id || '').toUpperCase();
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, []);

  const filteredOrgs = useMemo(() => {
    const q = (query || '').trim().toLowerCase();
    if (!q) return uniqueOrgs;
    return uniqueOrgs.filter(
      (o) =>
        o.id.toLowerCase().includes(q) ||
        o.label.toLowerCase().includes(q) ||
        (o.full && o.full.toLowerCase().includes(q))
    );
  }, [uniqueOrgs, query]);

  const exactMatch = uniqueOrgs.some(
    (o) =>
      o.id.toLowerCase() === (query || '').trim().toLowerCase() ||
      o.label.toLowerCase() === (query || '').trim().toLowerCase()
  );

  return (
    <div className="relative" ref={wrapRef}>
      <div className="flex items-center gap-1.5">
        <div className="relative flex-1">
          <input
            type="text"
            placeholder="Search award body (e.g. OAFP, AMVCA, DIYMA)..."
            value={query}
            onChange={(e) => {
              const val = e.target.value;
              setQuery(val);
              onChange(val);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            className="w-full bg-surface border border-border p-2.5 pr-8 rounded-lg text-xs font-semibold focus:border-brand outline-none transition-colors"
          />
          <button
            type="button"
            tabIndex={-1}
            onClick={() => setOpen(!open)}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary"
          >
            <Icon icon={open ? "solar:alt-arrow-up-linear" : "solar:alt-arrow-down-linear"} width="14" />
          </button>
        </div>
        <button
          type="button"
          onClick={() => {
            const trimmed = query.trim();
            if (trimmed) {
              onChange(trimmed);
              setOpen(false);
            } else {
              setOpen(true);
            }
          }}
          className="p-2.5 rounded-lg bg-surface border border-border hover:border-brand/50 text-text-muted hover:text-brand transition-colors flex items-center gap-1 text-xs font-bold"
          title="Create or select organization"
        >
          <Icon icon="solar:add-circle-bold" width="16" />
        </button>
      </div>

      {open && (
        <div className="absolute z-50 left-0 w-full min-w-[320px] max-w-[92vw] top-full mt-1.5 max-h-64 overflow-y-auto rounded-xl border border-border bg-surface shadow-2xl backdrop-blur-xl">
          {query.trim() && !exactMatch && (
            <button
              type="button"
              onClick={() => {
                const custom = query.trim();
                onChange(custom);
                setQuery(custom);
                setOpen(false);
              }}
              className="w-full flex items-center gap-2 px-3.5 py-2.5 text-left bg-brand/10 hover:bg-brand/20 text-brand border-b border-border text-xs font-bold transition-colors"
            >
              <Icon icon="solar:add-circle-linear" width="16" />
              <span>Use custom: &quot;{query.trim()}&quot;</span>
            </button>
          )}

          {filteredOrgs.map((org) => {
            const isSelected =
              value &&
              (value.toLowerCase() === org.id.toLowerCase() ||
                value.toLowerCase() === org.label.toLowerCase());
            return (
              <button
                key={org.id}
                type="button"
                onClick={() => {
                  onChange(org.id);
                  setQuery(org.id);
                  setOpen(false);
                }}
                className={`w-full flex flex-col items-start px-3.5 py-2.5 text-left border-b border-border/30 hover:bg-surface-2 transition-colors ${
                  isSelected ? 'bg-brand/15 text-brand font-bold' : ''
                }`}
              >
                <div className="flex items-center justify-between w-full gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black text-brand bg-brand/10 border border-brand/20 px-2 py-0.5 rounded">
                      {org.id}
                    </span>
                    <span className="text-xs font-bold text-text-primary">
                      {org.label !== org.id ? org.label : ''}
                    </span>
                  </div>
                  {org.founded && (
                    <span className="text-[10px] text-text-muted font-mono whitespace-nowrap">
                      est. {org.founded}
                    </span>
                  )}
                </div>
                {org.full && (
                  <span className="text-[11px] text-text-muted mt-1 leading-snug">
                    {org.full}
                  </span>
                )}
                {org.location && (
                  <span className="text-[10px] text-text-muted/80 mt-0.5 flex items-center gap-1">
                    <Icon icon="solar:map-point-linear" width="10" /> {org.location}
                  </span>
                )}
              </button>
            );
          })}

          {filteredOrgs.length === 0 && !query.trim() && (
            <p className="px-3.5 py-3 text-xs text-text-muted italic">Type to search or enter organization</p>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Scrollable Year Picker with quick selection of recent years or typing any year
 */
function SearchableYearPicker({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(value ? String(value) : '');
  const wrapRef = useRef(null);

  useEffect(() => {
    setQuery(value ? String(value) : '');
  }, [value]);

  useEffect(() => {
    const onDoc = (e) => {
      if (!wrapRef.current?.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const years = useMemo(() => {
    const currentYear = new Date().getFullYear() + 1; // 2026
    const list = [];
    for (let y = currentYear; y >= 2010; y--) {
      list.push(y);
    }
    return list;
  }, []);

  const filteredYears = useMemo(() => {
    const q = (query || '').trim();
    if (!q) return years;
    return years.filter((y) => String(y).includes(q));
  }, [years, query]);

  return (
    <div className="relative" ref={wrapRef}>
      <div className="relative">
        <input
          type="number"
          placeholder="Year (e.g. 2023)"
          value={query}
          onChange={(e) => {
            const val = e.target.value;
            setQuery(val);
            onChange(val);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          className="w-full bg-surface border border-border p-2 pr-7 rounded-lg text-xs focus:border-brand outline-none font-semibold"
        />
        <button
          type="button"
          tabIndex={-1}
          onClick={() => setOpen(!open)}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary"
        >
          <Icon icon={open ? "solar:alt-arrow-up-linear" : "solar:alt-arrow-down-linear"} width="13" />
        </button>
      </div>

      {open && (
        <div className="absolute z-50 left-0 right-0 top-full mt-1.5 max-h-48 overflow-y-auto rounded-lg border border-border bg-surface shadow-2xl">
          {filteredYears.map((yr) => {
            const isSelected = String(value) === String(yr);
            return (
              <button
                key={yr}
                type="button"
                onClick={() => {
                  onChange(String(yr));
                  setQuery(String(yr));
                  setOpen(false);
                }}
                className={`w-full flex items-center justify-between px-3 py-1.5 text-left border-b border-border/30 hover:bg-surface-2 transition-colors text-xs ${
                  isSelected ? 'bg-brand/15 text-brand font-bold' : 'text-text-primary'
                }`}
              >
                <span>{yr}</span>
                {isSelected && <Icon icon="solar:check-read-linear" className="text-brand" width="14" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/**
 * Searchable Award Category Combobox suggested by Organization + '+ Create New'
 */
function SearchableCategoryPicker({ organization, value, onChange }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(value || '');
  const wrapRef = useRef(null);

  useEffect(() => {
    setQuery(value || '');
  }, [value]);

  useEffect(() => {
    const onDoc = (e) => {
      if (!wrapRef.current?.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const suggestions = useMemo(() => {
    return getCategoriesForOrg(organization);
  }, [organization]);

  const filteredCategories = useMemo(() => {
    const q = (query || '').trim().toLowerCase();
    if (!q) return suggestions.slice(0, 30);
    return suggestions
      .filter((cat) => cat.toLowerCase().includes(q))
      .slice(0, 30);
  }, [suggestions, query]);

  const exactMatch = suggestions.some(
    (c) => c.toLowerCase() === (query || '').trim().toLowerCase()
  );

  return (
    <div className="relative" ref={wrapRef}>
      <div className="flex items-center gap-1.5">
        <div className="relative flex-1">
          <input
            type="text"
            placeholder="Category (e.g. Best Director of the Year, Best Actor)"
            value={query}
            onChange={(e) => {
              const val = e.target.value;
              setQuery(val);
              onChange(val);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            className="w-full bg-surface border border-border p-2 pr-7 rounded-lg text-xs focus:border-brand outline-none"
          />
          <button
            type="button"
            tabIndex={-1}
            onClick={() => setOpen(!open)}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary"
          >
            <Icon icon={open ? "solar:alt-arrow-up-linear" : "solar:alt-arrow-down-linear"} width="13" />
          </button>
        </div>
        <button
          type="button"
          onClick={() => {
            const trimmed = query.trim();
            if (trimmed) {
              onChange(trimmed);
              setOpen(false);
            } else {
              setOpen(true);
            }
          }}
          className="p-2 rounded-lg bg-surface border border-border hover:border-brand/50 text-text-muted hover:text-brand transition-colors"
          title="Create or select category"
        >
          <Icon icon="solar:add-circle-bold" width="16" />
        </button>
      </div>

      {open && (
        <div className="absolute z-50 left-0 w-full min-w-[300px] max-w-[92vw] top-full mt-1.5 max-h-56 overflow-y-auto rounded-lg border border-border bg-surface shadow-2xl">
          {query.trim() && !exactMatch && (
            <button
              type="button"
              onClick={() => {
                const custom = query.trim();
                onChange(custom);
                setQuery(custom);
                setOpen(false);
              }}
              className="w-full flex items-center gap-2 px-3.5 py-2 text-left bg-brand/10 hover:bg-brand/20 text-brand border-b border-border text-xs font-bold transition-colors"
            >
              <Icon icon="solar:add-circle-linear" width="14" />
              <span>Create new: &quot;{query.trim()}&quot;</span>
            </button>
          )}

          {filteredCategories.map((cat) => {
            const isSelected = value && value.toLowerCase() === cat.toLowerCase();
            return (
              <button
                key={cat}
                type="button"
                onClick={() => {
                  onChange(cat);
                  setQuery(cat);
                  setOpen(false);
                }}
                className={`w-full flex items-center justify-between px-3.5 py-2 text-left border-b border-border/40 hover:bg-surface-2 transition-colors ${
                  isSelected ? 'bg-brand/15 text-brand font-bold' : 'text-text-primary'
                }`}
              >
                <span className="text-xs truncate">{cat}</span>
                {isSelected && <Icon icon="solar:check-read-linear" className="text-brand" width="14" />}
              </button>
            );
          })}

          {filteredCategories.length === 0 && !query.trim() && (
            <p className="px-3.5 py-3 text-xs text-text-muted italic">Type to search or enter category</p>
          )}
        </div>
      )}
    </div>
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
        <div className="absolute z-50 left-0 right-0 top-full mt-1 rounded-lg border border-border bg-surface shadow-xl overflow-hidden">
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
