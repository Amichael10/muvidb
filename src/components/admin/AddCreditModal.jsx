import { useEffect, useRef, useState } from 'react';
import { Icon } from '@iconify/react';
import { toast } from 'react-hot-toast';
import { supabase } from '../../lib/supabase';
import { CAST_ROLE, CREW_ROLES, normalizeRole } from '../../lib/creditRoles';

/**
 * Attach an existing person to a film from the PERSON side.
 *
 * The film drawer already does person→film; this is the reverse, for backfilling
 * a credit noticed while enriching an actor (otherwise you'd have to leave, find
 * the film, and edit it there).
 *
 * @param {{
 *   person: { id: string, name: string },
 *   existingCredits: Array<{ film_id?: string, films?: { id: string }, role: string }>,
 *   onClose: () => void,
 *   onSaved: () => void,
 * }} props
 */
export default function AddCreditModal({ person, existingCredits = [], onClose, onSaved }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [film, setFilm] = useState(null);

  const [kind, setKind] = useState('cast'); // 'cast' | 'crew'
  const [crewRole, setCrewRole] = useState(CREW_ROLES[0].value);
  const [customRole, setCustomRole] = useState('');
  const [useCustom, setUseCustom] = useState(false);
  const [characterName, setCharacterName] = useState('');
  const [saving, setSaving] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createdStub, setCreatedStub] = useState(false);

  const timer = useRef(null);

  // Debounced title search — mirrors the people search in the film drawer.
  useEffect(() => {
    if (film) return;
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      return;
    }
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      setSearching(true);
      const { data } = await supabase
        .from('films')
        .select('id, title, year, poster_url')
        .ilike('title', `%${q}%`)
        .order('year', { ascending: false })
        .limit(8);
      setResults(data || []);
      setSearching(false);
    }, 300);
    return () => timer.current && clearTimeout(timer.current);
  }, [query, film]);

  const role = kind === 'cast' ? CAST_ROLE : useCustom ? normalizeRole(customRole) : crewRole;

  // Escape hatch for backfilling: the credit is the thing being recorded here,
  // and stopping to go create the film properly is what makes this tedious. The
  // stub carries a title + slug only — everything else is filled in later from
  // the Films page.
  const createStubFilm = async (title) => {
    setCreating(true);
    const slug = title
      .toLowerCase()
      .replace(/[^a-zA-Z0-9\s]/g, '')
      .trim()
      .replace(/\s+/g, '-');

    let { data, error } = await supabase
      .from('films')
      .insert([{ title, slug }])
      .select('id, title, year, poster_url')
      .single();

    // Slug is unique; another film may already own this one (a remake, or a
    // near-duplicate title that punctuation stripped down to the same string).
    if (error?.code === '23505') {
      ({ data, error } = await supabase
        .from('films')
        .insert([{ title, slug: `${slug}-${Date.now().toString(36).slice(-4)}` }])
        .select('id, title, year, poster_url')
        .single());
    }

    setCreating(false);
    if (error) return toast.error(error.message);

    setFilm(data);
    setCreatedStub(true);
    toast.success(`Created “${data.title}” — remember to fill it in later.`);
  };

  const save = async () => {
    if (!film) return toast.error('Pick a film first.');
    if (!role) return toast.error('Enter a role.');

    // credits_film_person_role_uidx would reject this anyway, but catch it here
    // for a readable message. Only the same role collides — one person can hold
    // two roles on a film (a director who also acts).
    const dupe = existingCredits.some(
      (c) => (c.films?.id || c.film_id) === film.id && normalizeRole(c.role) === role,
    );
    if (dupe) return toast.error(`${person.name} is already credited as ${role} on this film.`);

    setSaving(true);

    // Append after the current cast list rather than assuming a count.
    const { data: last } = await supabase
      .from('credits')
      .select('billing_order')
      .eq('film_id', film.id)
      .order('billing_order', { ascending: false })
      .limit(1);

    const { error } = await supabase.from('credits').insert([
      {
        person_id: person.id,
        film_id: film.id,
        role,
        character_name: kind === 'cast' && characterName.trim() ? characterName.trim() : null,
        billing_order: (last?.[0]?.billing_order ?? 0) + 1,
      },
    ]);
    setSaving(false);

    if (error) return toast.error(error.message);
    toast.success(`Credited ${person.name} on ${film.title}`);
    onSaved();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg bg-surface border border-border rounded-xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div>
            <h3 className="text-sm font-black text-text-primary">Add film credit</h3>
            <p className="text-[11px] text-text-muted mt-0.5">for {person.name}</p>
          </div>
          <button onClick={onClose} className="text-text-muted hover:text-text-primary transition-colors">
            <Icon icon="solar:close-circle-linear" width="20" />
          </button>
        </div>

        <div className="p-5 space-y-5 max-h-[70vh] overflow-y-auto">
          {/* 1 — film */}
          <div>
            <label className="block text-[10px] font-black text-text-muted uppercase tracking-widest mb-2">
              Film
            </label>

            {film ? (
              <div className="flex items-center gap-3 p-2.5 bg-surface-2 border border-brand/40 rounded-lg">
                <div className="w-9 h-12 rounded border border-border overflow-hidden bg-surface shrink-0">
                  {film.poster_url ? (
                    <img src={film.poster_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-[7px] text-text-muted">
                      NONE
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-text-primary truncate">{film.title}</p>
                  {film.year && <p className="text-[10px] text-text-muted">{film.year}</p>}
                </div>
                <button
                  onClick={() => {
                    setFilm(null);
                    setCreatedStub(false);
                    setQuery('');
                  }}
                  className="text-[10px] font-bold text-text-muted hover:text-brand transition-colors"
                >
                  Change
                </button>
              </div>
            ) : null}

            {createdStub && film && (
              <p className="mt-1.5 text-[10px] font-bold text-amber-500 flex items-start gap-1">
                <Icon icon="solar:danger-triangle-linear" className="text-xs mt-px shrink-0" />
                <span>
                  Title-only film — it will show on Browse without a poster until you fill it in
                  from the Films page.
                </span>
              </p>
            )}

            {!film && (
              <>
                <div className="relative">
                  <Icon
                    icon="solar:magnifer-linear"
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted text-sm"
                  />
                  <input
                    autoFocus
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Start typing a film title…"
                    className="w-full bg-surface-2 border border-border rounded-lg pl-9 pr-3 py-2.5 text-sm text-text-primary focus:border-brand outline-none transition-all"
                  />
                </div>

                {searching && <p className="mt-2 text-[10px] text-text-muted">Searching…</p>}

                {!searching && query.trim().length >= 2 && results.length === 0 && (
                  <button
                    onClick={() => createStubFilm(query.trim())}
                    disabled={creating}
                    className="mt-2 w-full flex items-center gap-2 p-3 rounded-lg border border-dashed border-border hover:border-brand hover:bg-surface-2 text-left transition-all disabled:opacity-50"
                  >
                    <Icon icon="solar:add-square-linear" className="text-brand text-lg shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-text-primary truncate">
                        {creating ? 'Creating…' : `Create “${query.trim()}”`}
                      </p>
                      <p className="text-[10px] text-text-muted">
                        No match. Adds a title-only film you can fill in later.
                      </p>
                    </div>
                  </button>
                )}

                {results.length > 0 && (
                  <div className="mt-2 border border-border rounded-lg divide-y divide-border overflow-hidden">
                    {results.map((f) => (
                      <button
                        key={f.id}
                        onClick={() => setFilm(f)}
                        className="w-full flex items-center gap-3 p-2 text-left hover:bg-surface-2 transition-colors"
                      >
                        <div className="w-8 h-11 rounded border border-border overflow-hidden bg-surface shrink-0">
                          {f.poster_url && (
                            <img src={f.poster_url} alt="" className="w-full h-full object-cover" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-text-primary truncate">{f.title}</p>
                          {f.year && <p className="text-[10px] text-text-muted">{f.year}</p>}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>

          {/* 2 — cast or crew */}
          <div>
            <label className="block text-[10px] font-black text-text-muted uppercase tracking-widest mb-2">
              Credited as
            </label>
            <div className="flex items-center gap-1 p-1 bg-surface-2 rounded-lg border border-border w-fit">
              {['cast', 'crew'].map((k) => (
                <button
                  key={k}
                  onClick={() => setKind(k)}
                  className={`px-4 py-1.5 rounded text-[10px] font-black uppercase tracking-wider transition-all ${
                    kind === k ? 'bg-brand text-white' : 'text-text-muted hover:text-text-primary'
                  }`}
                >
                  {k}
                </button>
              ))}
            </div>
          </div>

          {/* 3 — role detail */}
          {kind === 'cast' ? (
            <div>
              <label className="block text-[10px] font-black text-text-muted uppercase tracking-widest mb-2">
                Character <span className="text-text-muted/60 normal-case font-bold">(optional)</span>
              </label>
              <input
                value={characterName}
                onChange={(e) => setCharacterName(e.target.value)}
                placeholder="e.g. Omotara Johnson"
                className="w-full bg-surface-2 border border-border rounded-lg px-3 py-2.5 text-sm text-text-primary focus:border-brand outline-none transition-all"
              />
            </div>
          ) : (
            <div>
              <label className="block text-[10px] font-black text-text-muted uppercase tracking-widest mb-2">
                Crew role
              </label>
              {useCustom ? (
                <div className="flex items-center gap-2">
                  <input
                    autoFocus
                    value={customRole}
                    onChange={(e) => setCustomRole(e.target.value)}
                    placeholder="Enter a new role…"
                    className="flex-1 bg-surface-2 border border-brand rounded-lg px-3 py-2.5 text-sm text-text-primary outline-none"
                  />
                  <button
                    onClick={() => {
                      setUseCustom(false);
                      setCustomRole('');
                    }}
                    className="text-text-muted hover:text-red-500 transition-colors"
                    title="Back to the standard list"
                  >
                    <Icon icon="solar:close-circle-linear" width="18" />
                  </button>
                </div>
              ) : (
                <select
                  value={crewRole}
                  onChange={(e) => {
                    if (e.target.value === '__custom') setUseCustom(true);
                    else setCrewRole(e.target.value);
                  }}
                  className="w-full bg-surface-2 border border-border rounded-lg px-3 py-2.5 text-sm text-text-primary focus:border-brand outline-none transition-all capitalize"
                >
                  {CREW_ROLES.map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.label}
                    </option>
                  ))}
                  <option value="__custom" className="text-brand font-black">
                    + Add custom role…
                  </option>
                </select>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-border bg-surface-2/40">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-xs font-bold text-text-muted hover:text-text-primary transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={save}
            disabled={!film || saving}
            className="px-4 py-2 rounded-lg bg-brand text-white text-xs font-black disabled:opacity-40 disabled:cursor-not-allowed hover:brightness-110 transition-all"
          >
            {saving ? 'Saving…' : 'Add credit'}
          </button>
        </div>
      </div>
    </div>
  );
}
