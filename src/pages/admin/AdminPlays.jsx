import React, { useEffect, useRef, useState } from 'react';
import { Icon } from '@iconify/react';
import { fetchPlays, upsertPlay, upsertStageCredit, deleteStageCredit } from '../../lib/plays';
import { supabase } from '../../lib/supabase';
import ImageField from '../../components/admin/ImageField';
import SEO from '../../components/SEO';

const BLANK_FORM = {
  title: '',
  slug: '',
  playwright: '',
  director: '',
  producer: '',
  venue: '',
  city: '',
  country: 'Nigeria',
  poster_url: '',
  banner_url: '',
  synopsis: '',
  genre: '',
  year: new Date().getFullYear(),
  status: 'archived',
};

export default function AdminPlays() {
  const [plays, setPlays] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [formData, setFormData] = useState(BLANK_FORM);
  const [formMsg, setFormMsg] = useState(null); // { type: 'success'|'error', text }
  const [saving, setSaving] = useState(false);

  // -- Stage credits for the currently-editing play --------------------------
  const [credits, setCredits] = useState([]); // local staged list
  const [savedCredits, setSavedCredits] = useState([]); // credits already in DB
  const [loadingCredits, setLoadingCredits] = useState(false);

  // -- People search ---------------------------------------------------------
  const [peopleSearch, setPeopleSearch] = useState('');
  const [peopleResults, setPeopleResults] = useState([]);
  const [isSearchingPeople, setIsSearchingPeople] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const searchTimeout = useRef(null);
  const searchRef = useRef(null);

  // -- Credit link status ----------------------------------------------------
  const [creditMsg, setCreditMsg] = useState(null);

  async function loadData() {
    setLoading(true);
    const data = await fetchPlays();
    setPlays(data);
    setLoading(false);
  }

  useEffect(() => {
    loadData();
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    function onClickOutside(e) {
      if (searchRef.current && !searchRef.current.contains(e.target)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  // Load existing DB credits when editing a play
  async function loadSavedCredits(playId) {
    setLoadingCredits(true);
    const { data } = await supabase
      .from('stage_credits')
      .select('*, person:people(id, name, slug, photo_url)')
      .eq('play_id', playId)
      .order('billing_order', { ascending: true });
    setSavedCredits(data || []);
    setLoadingCredits(false);
  }

  // ---- People search -------------------------------------------------------
  function handlePeopleSearch(query) {
    setPeopleSearch(query);
    setShowDropdown(true);
    if (query.trim().length < 2) {
      setPeopleResults([]);
      return;
    }
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(async () => {
      setIsSearchingPeople(true);
      const { data } = await supabase
        .from('people')
        .select('id, name, slug, photo_url')
        .ilike('name', `%${query}%`)
        .limit(8);
      setPeopleResults(data || []);
      setIsSearchingPeople(false);
    }, 300);
  }

  function addPerson(person) {
    // Prevent duplicates in staged list
    if (credits.some(c => c.person_id === person.id)) return;
    setCredits(prev => [...prev, {
      person_id: person.id,
      name: person.name,
      photo_url: person.photo_url || null,
      role: 'Actor',
      character_name: '',
      billing_order: savedCredits.length + prev.length + 1,
    }]);
    setPeopleSearch('');
    setPeopleResults([]);
    setShowDropdown(false);
  }

  async function createAndAddPerson(name) {
    try {
      const { data, error } = await supabase
        .from('people')
        .insert([{ name, nationality: 'Nigerian', gender: 'Prefer not to say' }])
        .select()
        .single();
      if (error) throw error;
      addPerson(data);
      setCreditMsg({ type: 'success', text: `New profile created for "${name}"` });
      setTimeout(() => setCreditMsg(null), 3000);
    } catch (err) {
      setCreditMsg({ type: 'error', text: 'Failed to create person: ' + err.message });
    }
  }

  function removeCredit(index) {
    setCredits(prev => prev.filter((_, i) => i !== index));
  }

  async function removeSavedCredit(credit) {
    try {
      await deleteStageCredit(credit.id);
      setSavedCredits(prev => prev.filter(c => c.id !== credit.id));
      setCreditMsg({ type: 'success', text: `Removed ${credit.person?.name}` });
      setTimeout(() => setCreditMsg(null), 3000);
    } catch (err) {
      setCreditMsg({ type: 'error', text: 'Failed to remove credit: ' + err.message });
    }
  }

  async function saveCredits() {
    if (!editing) {
      setCreditMsg({ type: 'error', text: 'Save the play first before adding credits.' });
      return;
    }
    if (credits.length === 0) {
      setCreditMsg({ type: 'error', text: 'No pending credits to save.' });
      return;
    }
    setSaving(true);
    try {
      for (const c of credits) {
        await upsertStageCredit({
          play_id: editing.id,
          person_id: c.person_id,
          role: c.role || 'Actor',
          character_name: c.character_name?.trim() || null,
          billing_order: c.billing_order,
        });
      }
      setCreditMsg({ type: 'success', text: `${credits.length} credit(s) saved!` });
      setCredits([]);
      loadSavedCredits(editing.id);
    } catch (err) {
      setCreditMsg({ type: 'error', text: 'Failed to save credits: ' + err.message });
    } finally {
      setSaving(false);
      setTimeout(() => setCreditMsg(null), 3500);
    }
  }

  // ---- Play form -----------------------------------------------------------
  function handleEdit(play) {
    setEditing(play);
    setFormData({
      title: play.title || '',
      slug: play.slug || '',
      playwright: play.playwright || '',
      director: play.director || '',
      producer: play.producer || '',
      venue: play.venue || '',
      city: play.city || '',
      country: play.country || 'Nigeria',
      poster_url: play.poster_url || '',
      banner_url: play.banner_url || '',
      synopsis: play.synopsis || '',
      genre: play.genre || '',
      year: play.year || new Date().getFullYear(),
      status: play.status || 'archived',
    });
    setCredits([]);
    setCreditMsg(null);
    loadSavedCredits(play.id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function handleReset() {
    setEditing(null);
    setFormData(BLANK_FORM);
    setFormMsg(null);
    setCredits([]);
    setSavedCredits([]);
    setCreditMsg(null);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!formData.title.trim()) {
      setFormMsg({ type: 'error', text: 'Title is required.' });
      return;
    }
    setSaving(true);
    setFormMsg(null);
    try {
      const payload = editing ? { ...formData, id: editing.id } : formData;
      const saved = await upsertPlay(payload);
      setFormMsg({ type: 'success', text: editing ? 'Play updated!' : 'Play created!' });
      if (!editing) {
        setEditing(saved);
        loadSavedCredits(saved.id);
      }
      loadData();
    } catch (err) {
      setFormMsg({ type: 'error', text: 'Failed to save play: ' + err.message });
    } finally {
      setSaving(false);
      setTimeout(() => setFormMsg(null), 4000);
    }
  }

  // ---- Render --------------------------------------------------------------
  return (
    <div className="min-h-screen bg-bg text-text-primary p-6 md:p-10 max-w-7xl mx-auto">
      <SEO title="Manage Theatre Plays | MuviDB Admin" />

      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-extrabold text-text-primary flex items-center gap-2">
            <Icon icon="solar:masks-bold" className="text-brand w-8 h-8" />
            Manage Theatre Plays & Stage Performances
          </h1>
          <p className="text-xs text-text-muted mt-1">Add, update, or archive theatrical productions and stage credits.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

        {/* ── Left: Play Form ─────────────────────────────────────────────── */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-surface border border-border p-6 rounded-2xl">
            <h2 className="text-lg font-bold text-text-primary mb-5">
              {editing ? `Editing: ${editing.title}` : 'Add New Play'}
            </h2>

            <form onSubmit={handleSubmit} className="space-y-4 text-xs">
              {/* Title */}
              <div>
                <label className="text-text-muted font-bold block mb-1">Play Title *</label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={e => setFormData({ ...formData, title: e.target.value })}
                  placeholder="e.g. Saro The Musical"
                  className="w-full bg-bg border border-border rounded-xl px-3 py-2 text-text-primary focus:border-brand outline-none"
                  required
                />
              </div>

              {/* Slug */}
              <div>
                <label className="text-text-muted font-bold block mb-1">URL Slug (Optional)</label>
                <input
                  type="text"
                  value={formData.slug}
                  onChange={e => setFormData({ ...formData, slug: e.target.value })}
                  placeholder="e.g. saro-the-musical"
                  className="w-full bg-bg border border-border rounded-xl px-3 py-2 text-text-primary focus:border-brand outline-none"
                />
              </div>

              {/* Playwright + Director */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-text-muted font-bold block mb-1">Playwright</label>
                  <input
                    type="text"
                    value={formData.playwright}
                    onChange={e => setFormData({ ...formData, playwright: e.target.value })}
                    placeholder="e.g. Wole Soyinka"
                    className="w-full bg-bg border border-border rounded-xl px-3 py-2 text-text-primary focus:border-brand outline-none"
                  />
                </div>
                <div>
                  <label className="text-text-muted font-bold block mb-1">Director</label>
                  <input
                    type="text"
                    value={formData.director}
                    onChange={e => setFormData({ ...formData, director: e.target.value })}
                    placeholder="e.g. Bolanle Austen-Peters"
                    className="w-full bg-bg border border-border rounded-xl px-3 py-2 text-text-primary focus:border-brand outline-none"
                  />
                </div>
              </div>

              {/* Producer */}
              <div>
                <label className="text-text-muted font-bold block mb-1">Producer</label>
                <input
                  type="text"
                  value={formData.producer}
                  onChange={e => setFormData({ ...formData, producer: e.target.value })}
                  placeholder="e.g. Remi Aiyeolami"
                  className="w-full bg-bg border border-border rounded-xl px-3 py-2 text-text-primary focus:border-brand outline-none"
                />
              </div>

              {/* Venue + City */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-text-muted font-bold block mb-1">Venue</label>
                  <input
                    type="text"
                    value={formData.venue}
                    onChange={e => setFormData({ ...formData, venue: e.target.value })}
                    placeholder="e.g. Muson Centre"
                    className="w-full bg-bg border border-border rounded-xl px-3 py-2 text-text-primary focus:border-brand outline-none"
                  />
                </div>
                <div>
                  <label className="text-text-muted font-bold block mb-1">City</label>
                  <input
                    type="text"
                    value={formData.city}
                    onChange={e => setFormData({ ...formData, city: e.target.value })}
                    placeholder="e.g. Lagos"
                    className="w-full bg-bg border border-border rounded-xl px-3 py-2 text-text-primary focus:border-brand outline-none"
                  />
                </div>
              </div>

              {/* Year + Genre + Status */}
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-text-muted font-bold block mb-1">Year</label>
                  <input
                    type="number"
                    value={formData.year}
                    onChange={e => setFormData({ ...formData, year: Number(e.target.value) })}
                    className="w-full bg-bg border border-border rounded-xl px-3 py-2 text-text-primary focus:border-brand outline-none"
                  />
                </div>
                <div>
                  <label className="text-text-muted font-bold block mb-1">Genre</label>
                  <input
                    type="text"
                    value={formData.genre}
                    onChange={e => setFormData({ ...formData, genre: e.target.value })}
                    placeholder="Musical"
                    className="w-full bg-bg border border-border rounded-xl px-3 py-2 text-text-primary focus:border-brand outline-none"
                  />
                </div>
                <div>
                  <label className="text-text-muted font-bold block mb-1">Status</label>
                  <select
                    value={formData.status}
                    onChange={e => setFormData({ ...formData, status: e.target.value })}
                    className="w-full bg-bg border border-border rounded-xl px-2 py-2 text-text-primary focus:border-brand outline-none"
                  >
                    <option value="archived">Archived</option>
                    <option value="currently_running">Running</option>
                    <option value="upcoming">Upcoming</option>
                  </select>
                </div>
              </div>

              {/* Poster image */}
              <ImageField
                label="Poster / Artwork"
                value={formData.poster_url}
                onChange={url => setFormData(prev => ({ ...prev, poster_url: url }))}
                bucket="film-images"
                aspect="poster"
                hint="Recommended: portrait 2:3 ratio"
              />

              {/* Banner image */}
              <ImageField
                label="Banner / Backdrop"
                value={formData.banner_url}
                onChange={url => setFormData(prev => ({ ...prev, banner_url: url }))}
                bucket="film-images"
                aspect="backdrop"
              />

              {/* Synopsis */}
              <div>
                <label className="text-text-muted font-bold block mb-1">Synopsis</label>
                <textarea
                  rows={3}
                  value={formData.synopsis}
                  onChange={e => setFormData({ ...formData, synopsis: e.target.value })}
                  placeholder="Brief synopsis of the production..."
                  className="w-full bg-bg border border-border rounded-xl px-3 py-2 text-text-primary focus:border-brand outline-none resize-none"
                />
              </div>

              {/* Form feedback */}
              {formMsg && (
                <div className={`p-3 rounded-xl text-xs font-bold ${formMsg.type === 'success' ? 'bg-green-500/10 text-green-500 border border-green-500/30' : 'bg-red-500/10 text-red-400 border border-red-500/30'}`}>
                  {formMsg.text}
                </div>
              )}

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 bg-brand text-on-brand font-bold py-2.5 rounded-xl hover:bg-brand-hover transition-colors disabled:opacity-60"
                >
                  {saving ? 'Saving…' : editing ? 'Update Play' : 'Create Play'}
                </button>
                {editing && (
                  <button
                    type="button"
                    onClick={handleReset}
                    className="bg-surface-2 text-text-muted font-bold py-2.5 px-4 rounded-xl hover:text-text-primary transition-colors"
                  >
                    Cancel
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>

        {/* ── Right: Credits + Plays List ──────────────────────────────────── */}
        <div className="lg:col-span-2 space-y-8">

          {/* Stage Credits Panel */}
          <div className="bg-surface border border-border p-6 rounded-2xl">
            <h3 className="text-base font-bold text-text-primary mb-1 flex items-center gap-2">
              <Icon icon="solar:users-group-two-rounded-bold" className="text-brand w-5 h-5" />
              Stage Ensemble / Performers
            </h3>
            <p className="text-[11px] text-text-muted mb-4">
              {editing
                ? `Adding cast & crew for "${editing.title}"`
                : 'Save or select a play first to manage its cast.'}
            </p>

            {/* Search box */}
            <div className="relative mb-4" ref={searchRef}>
              <div className="flex items-center gap-2 bg-bg border border-border rounded-xl px-3 py-2 focus-within:border-brand transition-colors">
                <Icon icon="solar:magnifer-linear" className="w-4 h-4 text-text-muted flex-shrink-0" />
                <input
                  type="text"
                  value={peopleSearch}
                  onChange={e => handlePeopleSearch(e.target.value)}
                  onFocus={() => peopleSearch.length >= 2 && setShowDropdown(true)}
                  placeholder="Search actors, directors, crew…"
                  disabled={!editing}
                  className="flex-1 bg-transparent outline-none text-xs text-text-primary placeholder-text-muted disabled:opacity-50"
                />
                {isSearchingPeople && (
                  <div className="w-4 h-4 border-2 border-brand border-t-transparent rounded-full animate-spin flex-shrink-0" />
                )}
              </div>

              {/* Dropdown */}
              {showDropdown && peopleSearch.trim().length >= 2 && (
                <div className="absolute left-0 right-0 top-full mt-1 bg-surface border border-border rounded-xl shadow-2xl z-20 overflow-hidden">
                  {isSearchingPeople ? (
                    <div className="p-6 text-center text-xs text-text-muted">Searching…</div>
                  ) : (
                    <>
                      {peopleResults.map(p => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => addPerson(p)}
                          className="w-full flex items-center gap-3 px-4 py-3 hover:bg-surface-2 transition-colors text-left border-b border-border/50 last:border-0"
                        >
                          <div className="w-8 h-8 rounded-full bg-surface-2 overflow-hidden border border-border flex-shrink-0">
                            {p.photo_url && <img src={p.photo_url} alt="" className="w-full h-full object-cover" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-bold text-text-primary truncate">{p.name}</p>
                            <p className="text-[10px] text-text-muted font-semibold uppercase tracking-tight">Existing Record</p>
                          </div>
                        </button>
                      ))}
                      {/* Create new person */}
                      {peopleSearch.trim() && !peopleResults.some(p => p.name.toLowerCase() === peopleSearch.trim().toLowerCase()) && (
                        <button
                          type="button"
                          onClick={() => createAndAddPerson(peopleSearch.trim())}
                          className="w-full flex items-center gap-3 px-4 py-3 bg-brand/5 hover:bg-brand/10 transition-colors text-left group"
                        >
                          <div className="w-9 h-9 rounded-full bg-brand text-white flex items-center justify-center group-hover:scale-110 transition-transform shadow-lg shadow-brand/20 flex-shrink-0">
                            <Icon icon="solar:plus-bold" className="w-4 h-4" />
                          </div>
                          <div>
                            <p className="text-[10px] font-black text-brand uppercase tracking-widest leading-none mb-0.5">New Identity</p>
                            <p className="text-xs font-bold text-text-primary">Create profile for "{peopleSearch.trim()}"</p>
                          </div>
                        </button>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Pending (unsaved) credit cards */}
            {credits.length > 0 && (
              <div className="space-y-3 mb-4">
                <p className="text-[11px] font-bold text-text-muted uppercase tracking-wider">
                  Pending — {credits.length} to save
                </p>
                {credits.map((c, idx) => (
                  <div key={idx} className="flex items-start gap-3 bg-brand/5 border border-brand/20 rounded-xl p-3.5 animate-in slide-in-from-left-2">
                    <div className="w-9 h-9 rounded-full bg-surface-2 overflow-hidden border border-border flex-shrink-0 mt-0.5">
                      {c.photo_url && <img src={c.photo_url} alt="" className="w-full h-full object-cover" />}
                    </div>
                    <div className="flex-1 space-y-2 min-w-0">
                      <p className="text-xs font-bold text-text-primary truncate">{c.name}</p>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-[10px] text-text-muted font-bold block mb-1">Role</label>
                          <input
                            type="text"
                            value={c.role}
                            onChange={e => setCredits(prev => prev.map((cr, i) => i === idx ? { ...cr, role: e.target.value } : cr))}
                            placeholder="Actor / Director…"
                            className="w-full bg-bg border border-border rounded-lg px-2.5 py-1.5 text-[11px] text-text-primary focus:border-brand outline-none"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-text-muted font-bold block mb-1">Character (optional)</label>
                          <input
                            type="text"
                            value={c.character_name}
                            onChange={e => setCredits(prev => prev.map((cr, i) => i === idx ? { ...cr, character_name: e.target.value } : cr))}
                            placeholder="e.g. Elesin Oba"
                            className="w-full bg-bg border border-border rounded-lg px-2.5 py-1.5 text-[11px] text-text-primary focus:border-brand outline-none"
                          />
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeCredit(idx)}
                      className="p-1.5 rounded-lg text-red-400 hover:bg-red-500/10 transition-colors flex-shrink-0 mt-0.5"
                      title="Remove"
                    >
                      <Icon icon="solar:trash-bin-trash-bold" className="w-4 h-4" />
                    </button>
                  </div>
                ))}

                <button
                  type="button"
                  onClick={saveCredits}
                  disabled={saving}
                  className="w-full bg-brand text-on-brand font-bold py-2.5 rounded-xl hover:bg-brand-hover transition-colors text-xs disabled:opacity-60"
                >
                  {saving ? 'Saving…' : `Save ${credits.length} Credit(s) to Play`}
                </button>
              </div>
            )}

            {/* Saved credits in DB */}
            {editing && (
              <div>
                {loadingCredits ? (
                  <div className="py-6 text-center">
                    <div className="w-6 h-6 border-2 border-brand border-t-transparent rounded-full animate-spin mx-auto" />
                  </div>
                ) : savedCredits.length > 0 ? (
                  <div>
                    <p className="text-[11px] font-bold text-text-muted uppercase tracking-wider mb-3">
                      Saved — {savedCredits.length} credit(s)
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {savedCredits.map(c => {
                        const person = c.person || {};
                        return (
                          <div key={c.id} className="flex items-center gap-3 bg-surface-2 border border-border rounded-xl p-3">
                            <div className="w-9 h-9 rounded-full bg-surface overflow-hidden border border-border flex-shrink-0">
                              {person.photo_url && <img src={person.photo_url} alt="" className="w-full h-full object-cover" />}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-bold text-text-primary truncate">{person.name}</p>
                              <p className="text-[10px] text-brand font-semibold">{c.role}</p>
                              {c.character_name && (
                                <p className="text-[10px] text-text-muted italic">as {c.character_name}</p>
                              )}
                            </div>
                            <button
                              type="button"
                              onClick={() => removeSavedCredit(c)}
                              className="p-1.5 rounded-lg text-red-400 hover:bg-red-500/10 transition-colors flex-shrink-0"
                              title="Remove"
                            >
                              <Icon icon="solar:trash-bin-trash-bold" className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-6 border border-dashed border-border rounded-xl text-text-muted text-xs">
                    No cast linked yet — search above to add performers.
                  </div>
                )}
              </div>
            )}

            {/* Credits feedback */}
            {creditMsg && (
              <div className={`mt-3 p-3 rounded-xl text-xs font-bold ${creditMsg.type === 'success' ? 'bg-green-500/10 text-green-500 border border-green-500/30' : 'bg-red-500/10 text-red-400 border border-red-500/30'}`}>
                {creditMsg.text}
              </div>
            )}
          </div>

          {/* Plays Catalog */}
          <div>
            <h2 className="text-lg font-bold text-text-primary mb-4 flex items-center gap-2">
              <Icon icon="solar:masks-bold" className="text-brand w-5 h-5" />
              Plays Catalog ({plays.length})
            </h2>
            {loading ? (
              <div className="py-12 text-center">
                <div className="w-8 h-8 border-3 border-brand border-t-transparent rounded-full animate-spin mx-auto" />
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {plays.map(play => (
                  <div
                    key={play.id}
                    className={`bg-surface border rounded-xl p-4 flex gap-4 items-start transition-all ${editing?.id === play.id ? 'border-brand/60 shadow-lg shadow-brand/5' : 'border-border'}`}
                  >
                    {/* Poster thumbnail */}
                    <div className="w-12 h-16 rounded-lg overflow-hidden border border-border flex-shrink-0 bg-surface-2">
                      {play.poster_url
                        ? <img src={play.poster_url} alt={play.title} className="w-full h-full object-cover" />
                        : <div className="w-full h-full flex items-center justify-center"><Icon icon="solar:masks-line-duotone" className="w-6 h-6 text-text-muted opacity-40" /></div>
                      }
                    </div>

                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-bold text-text-primary truncate">{play.title}</h3>
                      <span className="text-[11px] text-brand font-semibold">{play.playwright || 'Theatre'}</span>
                      <span className="text-[10px] text-text-muted block">📍 {play.venue || play.city || '—'} · {play.year}</span>
                      <span className={`mt-1 inline-block text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        play.status === 'currently_running'
                          ? 'bg-green-500/15 text-green-500'
                          : play.status === 'upcoming'
                          ? 'bg-blue-500/15 text-blue-400'
                          : 'bg-surface-2 text-text-muted'
                      }`}>
                        {play.status === 'currently_running' ? 'Running' : play.status === 'upcoming' ? 'Upcoming' : 'Archive'}
                      </span>
                    </div>

                    <button
                      onClick={() => handleEdit(play)}
                      className="p-2 rounded-lg bg-surface-2 text-text-muted hover:text-brand transition-colors flex-shrink-0"
                      title="Edit Play"
                    >
                      <Icon icon="solar:pen-bold" className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
