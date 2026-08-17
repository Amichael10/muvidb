import { useEffect, useState } from 'react';
import { Icon } from '@iconify/react';
import { toast } from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import { CAST_ROLE, CREW_ROLES } from '../../lib/creditRoles';

const inputClass = 'mt-2 w-full rounded-xl border border-border bg-surface-2 px-4 py-3 text-sm text-text-primary outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/10';

export default function CreditRequestModal({ person, onClose, onSaved }) {
  const { user } = useAuth();
  const [mode, setMode] = useState('existing');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [film, setFilm] = useState(null);
  const [kind, setKind] = useState('cast');
  const [crewRole, setCrewRole] = useState(CREW_ROLES[0].value);
  const [characterName, setCharacterName] = useState('');
  const [note, setNote] = useState('');
  const [evidenceUrl, setEvidenceUrl] = useState('');
  const [saving, setSaving] = useState(false);
  const [newFilm, setNewFilm] = useState({ title: '', content_type: 'movie', year: new Date().getFullYear(), release_type: '', synopsis: '', genres: '', runtime_minutes: '', language: 'English', countries: 'Nigeria', release_date: '', nfvcb_rating: '', youtube_watch_url: '', trailer_youtube_id: '', poster_url: '' });

  useEffect(() => {
    if (mode !== 'existing' || query.trim().length < 2 || film) {
      setResults([]);
      setSearching(false);
      return undefined;
    }
    let active = true;
    setSearching(true);
    const timer = setTimeout(async () => {
      const { data, error } = await supabase.from('films').select('id,title,year,poster_url,content_type').ilike('title', `%${query.trim()}%`).order('year', { ascending: false }).limit(10);
      if (!active) return;
      setResults(error ? [] : (data || []));
      setSearching(false);
    }, 300);
    return () => { active = false; clearTimeout(timer); };
  }, [query, film, mode]);

  const setField = (key, value) => setNewFilm((current) => ({ ...current, [key]: value }));
  const submit = async (event) => {
    event.preventDefault();
    if (mode === 'existing' && !film) return toast.error('Select a film first.');
    if (mode === 'new' && (!newFilm.title.trim() || !newFilm.release_type || !newFilm.countries.trim() || !evidenceUrl.trim())) return toast.error('Title, release type, country and a supporting source are required.');
    setSaving(true);
    try {
      const proposedFilm = mode === 'new' ? {
        ...newFilm,
        year: Number(newFilm.year),
        runtime_minutes: newFilm.runtime_minutes ? Number(newFilm.runtime_minutes) : null,
        genres: newFilm.genres.split(',').map((value) => value.trim()).filter(Boolean),
        countries: newFilm.countries.split(',').map((value) => value.trim()).filter(Boolean),
      } : null;
      const { error } = await supabase.from('actor_credit_requests').insert({
        submitted_by: user.id,
        person_id: person.id,
        request_type: mode === 'new' ? 'add_new_film' : 'add_existing',
        film_id: mode === 'existing' ? film.id : null,
        role: kind === 'cast' ? CAST_ROLE : crewRole,
        character_name: kind === 'cast' ? characterName.trim() || null : null,
        proposed_film: proposedFilm,
        note: note.trim() || null,
        evidence_url: evidenceUrl.trim() || null,
        status: 'submitted',
      });
      if (error) throw error;
      toast.success('Credit request submitted for review.');
      onSaved();
      onClose();
    } catch (error) {
      console.error('Credit request failed', error);
      toast.error('We couldn’t submit this credit. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const fields = [
    ['title', 'Film title *', 'text'], ['year', 'Release year *', 'number'], ['countries', 'Countries *', 'text'],
    ['genres', 'Genres', 'text'], ['runtime_minutes', 'Runtime (minutes)', 'number'], ['language', 'Language', 'text'],
    ['release_date', 'Release date', 'date'], ['poster_url', 'Poster URL', 'url'], ['youtube_watch_url', 'Official watch URL', 'url'], ['trailer_youtube_id', 'Trailer YouTube ID', 'text'],
  ];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 p-4 backdrop-blur-md" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <form onSubmit={submit} className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-[28px] border border-white/10 bg-[#151515] p-6 shadow-2xl md:p-8">
        <div className="flex items-start justify-between gap-4">
          <div><p className="text-[10px] font-black uppercase tracking-[.24em] text-brand">Filmography request</p><h2 className="mt-2 text-2xl font-black text-text-primary">Add a professional credit</h2><p className="mt-2 text-sm text-text-muted">Every credit is checked by a MuviDB editor before publishing.</p></div>
          <button type="button" onClick={onClose} aria-label="Close" className="text-text-muted"><Icon icon="solar:close-circle-linear" width="28" /></button>
        </div>

        <div className="mt-7 grid grid-cols-2 gap-2 rounded-xl bg-surface-2 p-1.5">
          <button type="button" onClick={() => setMode('existing')} className={`rounded-lg py-3 text-xs font-black ${mode === 'existing' ? 'bg-brand text-white' : 'text-text-muted'}`}>Find an existing film</button>
          <button type="button" onClick={() => setMode('new')} className={`rounded-lg py-3 text-xs font-black ${mode === 'new' ? 'bg-brand text-white' : 'text-text-muted'}`}>Film is missing</button>
        </div>

        {mode === 'existing' ? (
          <div className="mt-6">
            <label className="text-xs font-bold text-text-primary" htmlFor="credit-film-search">Search the catalogue</label>
            {film ? (
              <div className="mt-2 flex items-center gap-3 rounded-xl border border-brand/50 bg-brand/5 p-4"><img src={film.poster_url || '/images/film-placeholder.webp'} alt="" className="h-14 w-10 rounded object-cover" /><div><strong className="text-sm text-text-primary">{film.title}</strong><p className="text-xs text-text-muted">{film.year || 'Year unknown'}</p></div><button type="button" onClick={() => setFilm(null)} className="ml-auto text-xs font-black text-brand">Change</button></div>
            ) : (
              <><div className="relative"><input id="credit-film-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Type at least 2 characters…" className={inputClass} />{searching && <Icon icon="svg-spinners:180-ring-with-bg" className="absolute right-4 top-6 text-brand" width="18" />}</div>
              {query.trim().length >= 2 && !searching && results.length === 0 && <p className="mt-3 rounded-xl bg-surface-2 p-4 text-xs text-text-muted">No matching film found. Choose “Film is missing” to submit it.</p>}
              <div className="mt-2 grid gap-2">{results.map((row) => <button type="button" key={row.id} onClick={() => setFilm(row)} className="flex items-center gap-3 rounded-xl border border-border p-3 text-left hover:border-brand"><img src={row.poster_url || '/images/film-placeholder.webp'} alt="" className="h-12 w-9 rounded object-cover" /><span><strong className="block text-sm text-text-primary">{row.title}</strong><small className="text-text-muted">{row.year || 'Year unknown'}</small></span></button>)}</div></>
            )}
          </div>
        ) : (
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            {fields.map(([key, label, type]) => <label key={key} className={key === 'title' ? 'sm:col-span-2' : ''}><span className="text-xs font-bold text-text-primary">{label}</span><input type={type} min={type === 'number' ? 1 : undefined} value={newFilm[key]} onChange={(event) => setField(key, event.target.value)} className={inputClass} /></label>)}
            <label><span className="text-xs font-bold text-text-primary">Content type *</span><select value={newFilm.content_type} onChange={(event) => setField('content_type', event.target.value)} className={inputClass}><option value="movie">Movie</option><option value="series">Series</option><option value="mini_series">Mini-series</option><option value="documentary">Documentary</option></select></label>
            <label><span className="text-xs font-bold text-text-primary">Release type *</span><select value={newFilm.release_type} onChange={(event) => setField('release_type', event.target.value)} className={inputClass}><option value="">Select</option><option value="cinema">Cinema</option><option value="youtube">YouTube</option><option value="netflix">Netflix</option><option value="prime_video">Prime Video</option><option value="showmax">Showmax</option><option value="unreleased">Not released yet</option></select></label>
            <label className="sm:col-span-2"><span className="text-xs font-bold text-text-primary">Synopsis</span><textarea rows="4" value={newFilm.synopsis} onChange={(event) => setField('synopsis', event.target.value)} className={inputClass} /></label>
          </div>
        )}

        <div className="mt-7 grid gap-4 sm:grid-cols-2">
          <label><span className="text-xs font-bold text-text-primary">Credit type</span><select value={kind} onChange={(event) => setKind(event.target.value)} className={inputClass}><option value="cast">Cast / Actor</option><option value="crew">Crew</option></select></label>
          {kind === 'cast' ? <label><span className="text-xs font-bold text-text-primary">Character name</span><input value={characterName} onChange={(event) => setCharacterName(event.target.value)} className={inputClass} /></label> : <label><span className="text-xs font-bold text-text-primary">Crew role</span><select value={crewRole} onChange={(event) => setCrewRole(event.target.value)} className={inputClass}>{CREW_ROLES.map((role) => <option key={role.value} value={role.value}>{role.label}</option>)}</select></label>}
          <label className="sm:col-span-2"><span className="text-xs font-bold text-text-primary">Supporting source {mode === 'new' && '*'}</span><input type="url" value={evidenceUrl} onChange={(event) => setEvidenceUrl(event.target.value)} placeholder="Official announcement, trailer or production page" className={inputClass} /></label>
          <label className="sm:col-span-2"><span className="text-xs font-bold text-text-primary">Note to the editor</span><textarea rows="3" value={note} onChange={(event) => setNote(event.target.value)} className={inputClass} /></label>
        </div>
        <button disabled={saving} className="mt-7 w-full rounded-xl bg-brand py-4 text-xs font-black text-white disabled:opacity-50">{saving ? 'Submitting request…' : 'Submit for admin review'}</button>
      </form>
    </div>
  );
}
