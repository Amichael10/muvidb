import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Icon } from '@iconify/react';
import toast from 'react-hot-toast';

export default function AdminSpotlight() {
  const [spotlights, setSpotlights] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentSpotlight, setCurrentSpotlight] = useState(null);

  // Form State
  const [personId, setPersonId] = useState('');
  const [personSearch, setPersonSearch] = useState('');
  const [personResults, setPersonResults] = useState([]);
  const [selectedPerson, setSelectedPerson] = useState(null);
  
  const [story, setStory] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');
  const [isActive, setIsActive] = useState(false);

  const [personFilms, setPersonFilms] = useState([]);
  const [selectedFilmIds, setSelectedFilmIds] = useState([]);
  const [isFilmsLoading, setIsFilmsLoading] = useState(false);

  useEffect(() => {
    fetchSpotlights();
  }, []);

  useEffect(() => {
    if (personSearch.length > 2) {
      const delaySearch = setTimeout(() => {
        searchPeople(personSearch);
      }, 500);
      return () => clearTimeout(delaySearch);
    } else {
      setPersonResults([]);
    }
  }, [personSearch]);

  const fetchSpotlights = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('spotlights')
        .select('*, people(name, photo_url)')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setSpotlights(data || []);
    } catch (err) {
      toast.error('Failed to load spotlights: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const searchPeople = async (query) => {
    try {
      const { data, error } = await supabase
        .from('people')
        .select('id, name, photo_url')
        .ilike('name', `%${query}%`)
        .limit(5);
      
      if (error) throw error;
      setPersonResults(data || []);
    } catch (err) {
      console.error('Error searching people:', err);
    }
  };

  const fetchPersonFilms = async (id) => {
    if (!id) {
      setPersonFilms([]);
      return;
    }
    setIsFilmsLoading(true);
    try {
      const { data, error } = await supabase
        .from('credits')
        .select(`
          film_id,
          films (
            id,
            title,
            poster_url,
            release_type,
            year
          )
        `)
        .eq('person_id', id);

      if (error) throw error;
      
      const uniqueFilms = [];
      const seen = new Set();
      (data || []).forEach(item => {
        if (item.films && !seen.has(item.films.id)) {
          seen.add(item.films.id);
          uniqueFilms.push(item.films);
        }
      });
      
      setPersonFilms(uniqueFilms);
    } catch (err) {
      console.error('Error fetching person films:', err);
      toast.error('Failed to load person films: ' + err.message);
    } finally {
      setIsFilmsLoading(false);
    }
  };

  const selectPerson = (person) => {
    setPersonId(person.id);
    setSelectedPerson(person);
    setPersonSearch('');
    setPersonResults([]);
    fetchPersonFilms(person.id);
  };

  const handleOpenModal = (spotlight = null) => {
    if (spotlight) {
      setCurrentSpotlight(spotlight);
      setPersonId(spotlight.person_id);
      setSelectedPerson(spotlight.people);
      setStory(spotlight.story || '');
      setPhotoUrl(spotlight.photo_url || '');
      setIsActive(spotlight.is_active);
      setSelectedFilmIds(spotlight.featured_film_ids || []);
      fetchPersonFilms(spotlight.person_id);
    } else {
      setCurrentSpotlight(null);
      setPersonId('');
      setSelectedPerson(null);
      setStory('');
      setPhotoUrl('');
      setIsActive(false);
      setSelectedFilmIds([]);
      setPersonFilms([]);
    }
    setPersonSearch('');
    setIsModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!personId) {
      toast.error('Please select a person');
      return;
    }
    if (!story.trim()) {
      toast.error('Please enter a story');
      return;
    }

    const payload = {
      person_id: personId,
      story: story,
      photo_url: photoUrl || null,
      is_active: isActive,
      featured_film_ids: selectedFilmIds,
      updated_at: new Date().toISOString()
    };

    try {
      if (currentSpotlight) {
        const { error } = await supabase
          .from('spotlights')
          .update(payload)
          .eq('id', currentSpotlight.id);
        if (error) throw error;
        toast.success('Spotlight updated successfully');
      } else {
        const { error } = await supabase
          .from('spotlights')
          .insert([payload]);
        if (error) throw error;
        toast.success('Spotlight created successfully');
      }
      setIsModalOpen(false);
      fetchSpotlights();
    } catch (err) {
      toast.error('Failed to save spotlight: ' + err.message);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this spotlight?')) return;
    try {
      const { error } = await supabase.from('spotlights').delete().eq('id', id);
      if (error) throw error;
      toast.success('Spotlight deleted');
      fetchSpotlights();
    } catch (err) {
      toast.error('Failed to delete spotlight: ' + err.message);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Spotlight Management</h1>
          <p className="text-text-muted text-sm mt-1">Manage the featured spotlight displayed on the home page.</p>
        </div>
        <button
          onClick={() => handleOpenModal()}
          className="flex items-center gap-2 px-4 py-2 bg-brand text-white rounded-lg hover:bg-brand-hover transition-colors font-medium text-sm"
        >
          <Icon icon="solar:add-circle-linear" width="20" />
          Add Spotlight
        </button>
      </div>

      <div className="bg-surface rounded-xl border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-border bg-surface-2/50 text-xs uppercase tracking-wider text-text-muted">
                <th className="p-4 font-semibold">Person</th>
                <th className="p-4 font-semibold">Story</th>
                <th className="p-4 font-semibold text-center">Active</th>
                <th className="p-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading ? (
                <tr>
                  <td colSpan="4" className="p-8 text-center text-text-muted">
                    <Icon icon="solar:spinner-linear" className="w-6 h-6 animate-spin mx-auto mb-2" />
                    Loading spotlights...
                  </td>
                </tr>
              ) : spotlights.length === 0 ? (
                <tr>
                  <td colSpan="4" className="p-8 text-center text-text-muted">
                    No spotlights found.
                  </td>
                </tr>
              ) : (
                spotlights.map((s) => (
                  <tr key={s.id} className="hover:bg-surface-2/30 transition-colors">
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <img 
                          src={s.photo_url || s.people?.photo_url || 'https://www.gravatar.com/avatar/0?d=mp'} 
                          alt=""
                          className="w-10 h-10 rounded-lg object-cover"
                        />
                        <div className="flex flex-col">
                          <span className="font-medium text-text-primary">{s.people?.name || 'Unknown'}</span>
                          <span className="text-[9px] text-text-muted uppercase font-bold tracking-wider mt-0.5">
                            {s.featured_film_ids?.length || 0} Featured Works
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="p-4">
                      <p className="text-sm text-text-secondary line-clamp-2">{s.story}</p>
                    </td>
                    <td className="p-4 text-center">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
                        s.is_active ? 'bg-green-500/10 text-green-500' : 'bg-surface-3 text-text-muted'
                      }`}>
                        {s.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="p-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleOpenModal(s)}
                          className="p-2 text-text-muted hover:text-brand hover:bg-brand/10 rounded-lg transition-colors"
                          title="Edit"
                        >
                          <Icon icon="solar:pen-linear" width="18" />
                        </button>
                        <button
                          onClick={() => handleDelete(s.id)}
                          className="p-2 text-text-muted hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"
                          title="Delete"
                        >
                          <Icon icon="solar:trash-bin-trash-linear" width="18" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-surface border border-border rounded-xl w-full max-w-2xl flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between p-6 border-b border-border">
              <h2 className="text-xl font-bold text-text-primary">
                {currentSpotlight ? 'Edit Spotlight' : 'New Spotlight'}
              </h2>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="text-text-muted hover:text-text-primary transition-colors"
              >
                <Icon icon="solar:close-circle-linear" width="24" />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-6">
              
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-2">Select Person</label>
                {selectedPerson ? (
                  <div className="flex items-center justify-between p-3 bg-surface-2 rounded-lg border border-border">
                    <div className="flex items-center gap-3">
                      <img src={selectedPerson.photo_url || 'https://www.gravatar.com/avatar/0?d=mp'} alt="" className="w-8 h-8 rounded-full object-cover" />
                      <span className="font-medium text-text-primary">{selectedPerson.name}</span>
                    </div>
                    <button 
                      type="button" 
                      onClick={() => { setSelectedPerson(null); setPersonId(''); }}
                      className="text-text-muted hover:text-red-500 text-sm"
                    >
                      Change
                    </button>
                  </div>
                ) : (
                  <div className="relative">
                    <Icon icon="solar:magnifer-linear" className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
                    <input
                      type="text"
                      placeholder="Search for a person..."
                      value={personSearch}
                      onChange={(e) => setPersonSearch(e.target.value)}
                      className="w-full bg-surface-2 border border-border rounded-lg pl-10 pr-4 py-2.5 text-text-primary focus:border-brand focus:ring-1 focus:ring-brand outline-none transition-all"
                    />
                    {personResults.length > 0 && (
                      <div className="absolute top-full left-0 right-0 mt-1 bg-surface border border-border rounded-lg shadow-xl z-10 overflow-hidden">
                        {personResults.map(p => (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => selectPerson(p)}
                            className="w-full flex items-center gap-3 p-3 text-left hover:bg-surface-2 transition-colors border-b border-border last:border-0"
                          >
                            <img src={p.photo_url || 'https://www.gravatar.com/avatar/0?d=mp'} alt="" className="w-8 h-8 rounded-full object-cover" />
                            <span className="text-text-primary font-medium">{p.name}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-text-secondary mb-2">Photo URL (Optional)</label>
                <input
                  type="text"
                  value={photoUrl}
                  onChange={(e) => setPhotoUrl(e.target.value)}
                  placeholder="Leave blank to use the person's default photo"
                  className="w-full bg-surface-2 border border-border rounded-lg px-4 py-2.5 text-text-primary focus:border-brand focus:ring-1 focus:ring-brand outline-none transition-all"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-text-secondary mb-2">
                  Featured Works (Select up to 4 films)
                </label>
                {personId ? (
                  isFilmsLoading ? (
                    <div className="flex items-center gap-2 py-4 justify-center text-sm text-text-muted">
                      <Icon icon="solar:spinner-linear" className="w-5 h-5 animate-spin" />
                      Loading films...
                    </div>
                  ) : personFilms.length === 0 ? (
                    <p className="text-sm text-text-muted py-2">
                      No movies found in the database for this person. Add films in the films panel to feature them.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      <div className="flex justify-between items-center text-xs text-text-muted">
                        <span>Available works: {personFilms.length}</span>
                        <span className={`font-semibold ${selectedFilmIds.length > 4 ? 'text-red-500' : 'text-brand'}`}>
                          Selected: {selectedFilmIds.length} / 4
                        </span>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-60 overflow-y-auto p-1.5 border border-border rounded-lg bg-surface-2/40">
                        {personFilms.map((film) => {
                          const isSelected = selectedFilmIds.includes(film.id);
                          return (
                            <button
                              key={film.id}
                              type="button"
                              onClick={() => {
                                if (isSelected) {
                                  setSelectedFilmIds(selectedFilmIds.filter(id => id !== film.id));
                                } else {
                                  if (selectedFilmIds.length >= 4) {
                                    toast.error('You can select a maximum of 4 films.');
                                    return;
                                  }
                                  setSelectedFilmIds([...selectedFilmIds, film.id]);
                                }
                              }}
                              className={`flex flex-col gap-2 p-2 rounded-lg border text-left transition-all relative overflow-hidden group ${
                                isSelected 
                                  ? 'bg-brand/10 border-brand ring-1 ring-brand' 
                                  : 'bg-surface border-border hover:border-text-muted'
                              }`}
                            >
                              <div className="aspect-[2/3] w-full rounded-md bg-surface-2 overflow-hidden relative">
                                <img 
                                  src={film.poster_url || 'https://images.unsplash.com/photo-1594909122845-11baa439b7bf?q=80&w=150'} 
                                  alt="" 
                                  className="w-full h-full object-cover transition-transform group-hover:scale-105 duration-300"
                                  onError={(e) => { e.target.src = 'https://images.unsplash.com/photo-1594909122845-11baa439b7bf?q=80&w=150'; }}
                                />
                                {isSelected && (
                                  <div className="absolute top-1 right-1 w-5 h-5 rounded-full bg-brand text-white flex items-center justify-center shadow-md">
                                    <Icon icon="solar:check-circle-bold" className="w-4 h-4" />
                                  </div>
                                )}
                              </div>
                              <div className="min-w-0">
                                <h5 className="font-bold text-text-primary text-[10px] line-clamp-1 leading-tight">
                                  {film.title}
                                </h5>
                                <div className="flex items-center gap-1.5 mt-0.5 text-[8px] text-text-muted uppercase tracking-wider font-semibold">
                                  <span>{film.year || 'N/A'}</span>
                                  {film.release_type && (
                                    <>
                                      <span>•</span>
                                      <span className="text-brand/80">{film.release_type}</span>
                                    </>
                                  )}
                                </div>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )
                ) : (
                  <p className="text-sm text-text-muted py-2 italic">
                    Select a person above to choose their featured works.
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-text-secondary mb-2">Story / Bio</label>
                <textarea
                  value={story}
                  onChange={(e) => setStory(e.target.value)}
                  required
                  rows="6"
                  placeholder="Enter the editorial story or bio..."
                  className="w-full bg-surface-2 border border-border rounded-lg px-4 py-3 text-text-primary focus:border-brand focus:ring-1 focus:ring-brand outline-none transition-all resize-none"
                ></textarea>
              </div>

              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="isActive"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  className="w-5 h-5 rounded border-border bg-surface-2 text-brand focus:ring-brand focus:ring-offset-surface"
                />
                <label htmlFor="isActive" className="text-sm font-medium text-text-primary">
                  Set as Active Spotlight
                </label>
              </div>

            </form>
            
            <div className="p-6 border-t border-border bg-surface-2/30 flex justify-end gap-3 mt-auto">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 rounded-lg text-text-secondary hover:text-text-primary font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                className="px-6 py-2 bg-brand text-white rounded-lg hover:bg-brand-hover transition-colors font-medium"
              >
                Save Spotlight
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
