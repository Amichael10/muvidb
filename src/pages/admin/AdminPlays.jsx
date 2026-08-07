import React, { useEffect, useState } from 'react';
import { Icon } from '@iconify/react';
import { fetchPlays, upsertPlay, upsertStageCredit } from '../../lib/plays';
import { supabase } from '../../lib/supabaseClient';
import SEO from '../../components/SEO';

export default function AdminPlays() {
  const [plays, setPlays] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [formData, setFormData] = useState({
    title: '',
    slug: '',
    playwright: '',
    director: '',
    producer: '',
    venue: '',
    city: '',
    country: 'Nigeria',
    poster_url: '',
    synopsis: '',
    genre: '',
    year: 2024,
    status: 'archived'
  });

  // Stage Credit Modal / Form State
  const [selectedPlayForCredit, setSelectedPlayForCredit] = useState(null);
  const [peopleSearch, setPeopleSearch] = useState('');
  const [peopleResults, setPeopleResults] = useState([]);
  const [selectedPerson, setSelectedPerson] = useState(null);
  const [creditRole, setCreditRole] = useState('Actor');
  const [characterName, setCharacterName] = useState('');

  async function loadData() {
    setLoading(true);
    const data = await fetchPlays();
    setPlays(data);
    setLoading(false);
  }

  useEffect(() => {
    loadData();
  }, []);

  async function searchActors(query) {
    setPeopleSearch(query);
    if (query.trim().length < 2) {
      setPeopleResults([]);
      return;
    }
    const { data } = await supabase
      .from('people')
      .select('id, name, slug, photo_url')
      .ilike('name', `%${query}%`)
      .limit(6);
    setPeopleResults(data || []);
  }

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
      synopsis: play.synopsis || '',
      genre: play.genre || '',
      year: play.year || 2024,
      status: play.status || 'archived'
    });
  }

  function handleReset() {
    setEditing(null);
    setFormData({
      title: '',
      slug: '',
      playwright: '',
      director: '',
      producer: '',
      venue: '',
      city: '',
      country: 'Nigeria',
      poster_url: '',
      synopsis: '',
      genre: '',
      year: 2024,
      status: 'archived'
    });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!formData.title.trim()) return alert('Title is required');

    try {
      const payload = editing ? { ...formData, id: editing.id } : formData;
      await upsertPlay(payload);
      alert(editing ? 'Play updated!' : 'Play created!');
      handleReset();
      loadData();
    } catch (err) {
      console.error(err);
      alert('Failed to save play: ' + err.message);
    }
  }

  async function handleAddStageCredit(e) {
    e.preventDefault();
    if (!selectedPlayForCredit || !selectedPerson) {
      return alert('Please select a play and an actor');
    }

    try {
      await upsertStageCredit({
        play_id: selectedPlayForCredit.id,
        person_id: selectedPerson.id,
        role: creditRole,
        character_name: characterName.trim() || null
      });
      alert(`Linked ${selectedPerson.name} to ${selectedPlayForCredit.title}!`);
      setSelectedPerson(null);
      setCharacterName('');
      setPeopleSearch('');
    } catch (err) {
      alert('Failed to link stage credit: ' + err.message);
    }
  }

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
        {/* Form Column */}
        <div className="bg-surface border border-border p-6 rounded-2xl h-fit">
          <h2 className="text-lg font-bold text-text-primary mb-4">
            {editing ? 'Edit Play' : 'Add New Play'}
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4 text-xs">
            <div>
              <label className="text-text-muted font-bold block mb-1">Play Title *</label>
              <input
                type="text"
                value={formData.title}
                onChange={e => setFormData({ ...formData, title: e.target.value })}
                placeholder="e.g. Saro The Musical"
                className="w-full bg-bg border border-border rounded-xl px-3 py-2 text-text-primary"
                required
              />
            </div>

            <div>
              <label className="text-text-muted font-bold block mb-1">URL Slug (Optional)</label>
              <input
                type="text"
                value={formData.slug}
                onChange={e => setFormData({ ...formData, slug: e.target.value })}
                placeholder="e.g. saro-the-musical"
                className="w-full bg-bg border border-border rounded-xl px-3 py-2 text-text-primary"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-text-muted font-bold block mb-1">Playwright</label>
                <input
                  type="text"
                  value={formData.playwright}
                  onChange={e => setFormData({ ...formData, playwright: e.target.value })}
                  placeholder="e.g. Wole Soyinka"
                  className="w-full bg-bg border border-border rounded-xl px-3 py-2 text-text-primary"
                />
              </div>

              <div>
                <label className="text-text-muted font-bold block mb-1">Director</label>
                <input
                  type="text"
                  value={formData.director}
                  onChange={e => setFormData({ ...formData, director: e.target.value })}
                  placeholder="e.g. Bolanle Austen-Peters"
                  className="w-full bg-bg border border-border rounded-xl px-3 py-2 text-text-primary"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-text-muted font-bold block mb-1">Venue Name</label>
                <input
                  type="text"
                  value={formData.venue}
                  onChange={e => setFormData({ ...formData, venue: e.target.value })}
                  placeholder="e.g. Muson Centre"
                  className="w-full bg-bg border border-border rounded-xl px-3 py-2 text-text-primary"
                />
              </div>

              <div>
                <label className="text-text-muted font-bold block mb-1">City / Location</label>
                <input
                  type="text"
                  value={formData.city}
                  onChange={e => setFormData({ ...formData, city: e.target.value })}
                  placeholder="e.g. Lagos, Nigeria"
                  className="w-full bg-bg border border-border rounded-xl px-3 py-2 text-text-primary"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="text-text-muted font-bold block mb-1">Year</label>
                <input
                  type="number"
                  value={formData.year}
                  onChange={e => setFormData({ ...formData, year: Number(e.target.value) })}
                  placeholder="2024"
                  className="w-full bg-bg border border-border rounded-xl px-3 py-2 text-text-primary"
                />
              </div>

              <div>
                <label className="text-text-muted font-bold block mb-1">Genre</label>
                <input
                  type="text"
                  value={formData.genre}
                  onChange={e => setFormData({ ...formData, genre: e.target.value })}
                  placeholder="Musical"
                  className="w-full bg-bg border border-border rounded-xl px-3 py-2 text-text-primary"
                />
              </div>

              <div>
                <label className="text-text-muted font-bold block mb-1">Status</label>
                <select
                  value={formData.status}
                  onChange={e => setFormData({ ...formData, status: e.target.value })}
                  className="w-full bg-bg border border-border rounded-xl px-2 py-2 text-text-primary"
                >
                  <option value="archived">Archived</option>
                  <option value="currently_running">Running</option>
                  <option value="upcoming">Upcoming</option>
                </select>
              </div>
            </div>

            <div>
              <label className="text-text-muted font-bold block mb-1">Poster URL</label>
              <input
                type="url"
                value={formData.poster_url}
                onChange={e => setFormData({ ...formData, poster_url: e.target.value })}
                placeholder="https://..."
                className="w-full bg-bg border border-border rounded-xl px-3 py-2 text-text-primary"
              />
            </div>

            <div>
              <label className="text-text-muted font-bold block mb-1">Synopsis</label>
              <textarea
                rows={3}
                value={formData.synopsis}
                onChange={e => setFormData({ ...formData, synopsis: e.target.value })}
                placeholder="Brief synopsis of the production..."
                className="w-full bg-bg border border-border rounded-xl px-3 py-2 text-text-primary"
              />
            </div>

            <div className="flex items-center gap-2 pt-4">
              <button
                type="submit"
                className="flex-1 bg-brand text-on-brand font-bold py-2.5 rounded-xl hover:bg-brand-hover transition-colors"
              >
                {editing ? 'Update Play' : 'Create Play'}
              </button>

              {editing && (
                <button
                  type="button"
                  onClick={handleReset}
                  className="bg-surface-2 text-text-muted font-bold py-2.5 px-4 rounded-xl hover:text-text-primary"
                >
                  Cancel
                </button>
              )}
            </div>
          </form>
        </div>

        {/* List & Stage Credit Link Column */}
        <div className="lg:col-span-2 space-y-8">
          {/* Link Stage Credit Tool */}
          <div className="bg-surface border border-border p-6 rounded-2xl">
            <h3 className="text-base font-bold text-text-primary mb-2 flex items-center gap-2">
              <Icon icon="solar:link-circle-bold" className="text-brand w-5 h-5" />
              Link Actor to Stage Play
            </h3>

            <form onSubmit={handleAddStageCredit} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-text-muted font-bold block mb-1">Select Stage Play</label>
                  <select
                    value={selectedPlayForCredit?.id || ''}
                    onChange={e => {
                      const p = plays.find(item => item.id === e.target.value);
                      setSelectedPlayForCredit(p || null);
                    }}
                    className="w-full bg-bg border border-border rounded-xl px-3 py-2 text-text-primary"
                    required
                  >
                    <option value="">-- Select Play --</option>
                    {plays.map(p => (
                      <option key={p.id} value={p.id}>{p.title} ({p.year})</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-text-muted font-bold block mb-1">Search Actor</label>
                  <input
                    type="text"
                    value={peopleSearch}
                    onChange={e => searchActors(e.target.value)}
                    placeholder="Type actor name..."
                    className="w-full bg-bg border border-border rounded-xl px-3 py-2 text-text-primary"
                  />
                  {peopleResults.length > 0 && (
                    <div className="mt-1 bg-surface border border-border rounded-xl overflow-hidden shadow-lg">
                      {peopleResults.map(p => (
                        <div
                          key={p.id}
                          onClick={() => {
                            setSelectedPerson(p);
                            setPeopleSearch(p.name);
                            setPeopleResults([]);
                          }}
                          className="px-3 py-2 hover:bg-surface-2 cursor-pointer flex items-center gap-2 text-text-primary"
                        >
                          <img src={p.photo_url || ''} alt="" className="w-6 h-6 rounded-full object-cover" />
                          <span>{p.name}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {selectedPerson && (
                <div className="p-2 bg-brand/10 border border-brand/30 rounded-lg text-brand font-bold">
                  Selected Actor: {selectedPerson.name}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-text-muted font-bold block mb-1">Role / Department</label>
                  <input
                    type="text"
                    value={creditRole}
                    onChange={e => setCreditRole(e.target.value)}
                    placeholder="e.g. Actor, Director, Lead Performer"
                    className="w-full bg-bg border border-border rounded-xl px-3 py-2 text-text-primary"
                  />
                </div>

                <div>
                  <label className="text-text-muted font-bold block mb-1">Character Name (Optional)</label>
                  <input
                    type="text"
                    value={characterName}
                    onChange={e => setCharacterName(e.target.value)}
                    placeholder="e.g. Elesin Oba"
                    className="w-full bg-bg border border-border rounded-xl px-3 py-2 text-text-primary"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="bg-brand text-on-brand font-bold px-6 py-2 rounded-xl hover:bg-brand-hover transition-colors"
              >
                Add Stage Credit
              </button>
            </form>
          </div>

          {/* Plays Table */}
          <div>
            <h2 className="text-lg font-bold text-text-primary mb-4">Plays Catalog ({plays.length})</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {plays.map(play => (
                <div key={play.id} className="bg-surface border border-border p-4 rounded-xl flex gap-4 items-center justify-between">
                  <div className="flex items-center gap-3">
                    <img
                      src={play.poster_url || 'https://images.unsplash.com/photo-1507676184212-d03ab07a01bf?auto=format&fit=crop&q=80&w=200'}
                      alt={play.title}
                      className="w-12 h-16 rounded-lg object-cover border border-border"
                    />
                    <div>
                      <h3 className="text-sm font-bold text-text-primary">{play.title}</h3>
                      <span className="text-[11px] text-brand font-semibold">{play.playwright || 'Theatre'}</span>
                      <span className="text-[10px] text-text-muted block">📍 {play.venue || play.city} ({play.year})</span>
                    </div>
                  </div>

                  <button
                    onClick={() => handleEdit(play)}
                    className="p-2 rounded-lg bg-surface-2 text-text-muted hover:text-brand transition-colors"
                    title="Edit Play"
                  >
                    <Icon icon="solar:pen-bold" className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
