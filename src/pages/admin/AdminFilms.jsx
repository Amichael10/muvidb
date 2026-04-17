import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { toast } from 'react-hot-toast';
import Drawer from '../../components/admin/Drawer';
import ConfirmModal from '../../components/admin/ConfirmModal';
import { extractYoutubeId } from '../../lib/youtube';

export default function AdminFilms() {
  const [films, setFilms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [editingFilm, setEditingFilm] = useState(null);
  const [deletingFilm, setDeletingFilm] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Normalized Data State
  const [credits, setCredits] = useState([]);
  const [showtimes, setShowtimes] = useState([]);
  const [cinemas, setCinemas] = useState([]);
  const [allGenres, setAllGenres] = useState([]);
  
  // Search States
  const [peopleSearch, setPeopleSearch] = useState('');
  const [peopleResults, setPeopleResults] = useState([]);
  const [isSearchingPeople, setIsSearchingPeople] = useState(false);
  const searchTimeout = useRef(null);
  
  // Library Search/Filter States
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [yearFilter, setYearFilter] = useState('all');
  const [isRefreshing, setIsRefreshing] = useState(false);

  const initialFormState = {
    title: '',
    year: new Date().getFullYear(),
    synopsis: '',
    poster_url: '',
    backdrop_url: '',
    genres: [],
    runtime_minutes: '',
    language: 'English',
    nfvcb_rating: '18',
    status: 'announced',
    trailer_source: 'youtube',
    trailer_youtube_id: '',
    tmdb_id: '',
    tmdb_rating: '',
    tagline: '',
    is_featured: false,
    release_type: 'cinema',
    youtube_watch_url: ''
  };

  const [formData, setFormData] = useState(initialFormState);

  useEffect(() => {
    fetchFilms();
    fetchCinemas();
    fetchGenres();
  }, []);

  const fetchGenres = async () => {
    const { data } = await supabase.from('genres').select('*').order('name');
    setAllGenres(data || []);
  };

  const fetchFilms = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('films')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setFilms(data || []);
    } catch (error) {
      toast.error('Failed to load films');
    } finally {
      setLoading(false);
    }
  };

  const fetchCinemas = async () => {
    const { data } = await supabase.from('cinemas').select('id, name, city').eq('is_active', true);
    setCinemas(data || []);
  };

  const refreshFromTmdb = async () => {
    if (!formData.tmdb_id) {
      toast.error('No TMDB ID linked to this production');
      return;
    }

    setIsRefreshing(true);
    toast.loading('Fetching fresh data...', { id: 'refreshtmdb' });

    try {
      const { getTmdbMovieDetails } = await import('../../utils/tmdb');
      const details = await getTmdbMovieDetails(formData.tmdb_id);
      
      if (!details) throw new Error('Could not fetch TMDB details');

      // Update basic fields
      setFormData(prev => ({
        ...prev,
        title: details.title || prev.title,
        synopsis: details.overview || prev.synopsis,
        tagline: details.tagline || prev.tagline,
        year: details.year || prev.year,
        runtime_minutes: details.runtime || prev.runtime_minutes,
        poster_url: details.posterUrl || prev.poster_url,
        backdrop_url: details.backdropUrl || prev.backdrop_url,
        status: details.status?.toLowerCase().replace(' ', '-') || prev.status,
        language: details.language || prev.language,
        tmdb_rating: details.rating || prev.tmdb_rating,
      }));

      // Update credits (replace existing)
      const newCredits = details.cast.map(c => ({
        tmdb_id: c.tmdbId,
        name: c.name,
        role: 'actor',
        character_name: c.character,
        is_new_from_tmdb: true // Flag to help handle creation
      }));

      // For crew, we only add the basics for now or map roles
      const crewCredits = details.crew.map(c => ({
        tmdb_id: c.tmdbId,
        name: c.name,
        role: c.job.toLowerCase(),
        is_new_from_tmdb: true
      }));

      // Actually we need to upsert these people first if we want to add them to credits list
      // But for simplicity in the UI, we'll just allow the user to see them 
      // and we handle the upsert during the main Save. 
      // However, the current AdminFilms logic expects person_id.
      // So let's just update the metadata for now, and warn about credits.
      
      toast.success('Metadata refreshed. Cast refresh requires a full sync script run.', { id: 'refreshtmdb' });
    } catch (err) {
      console.error(err);
      toast.error('Refresh failed', { id: 'refreshtmdb' });
    } finally {
      setIsRefreshing(false);
    }
  };

  const fetchFilmDetails = async (filmId) => {
    // Fetch credits
    const { data: creditData } = await supabase
      .from('credits')
      .select(`
        id, role, character_name, billing_order, person_id,
        people(id, name, photo_url)
      `)
      .eq('film_id', filmId)
      .order('billing_order', { ascending: true });
    
    if (creditData) {
      setCredits(creditData.map(c => ({
        person_id: c.person_id,
        name: c.people?.name,
        role: c.role,
        character_name: c.character_name,
        billing_order: c.billing_order
      })));
    }

    // Fetch showtimes (future only by default or all for admin)
    const { data: showtimeData } = await supabase
      .from('showtimes')
      .select('*')
      .eq('film_id', filmId)
      .order('start_time', { ascending: true });
    
    if (showtimeData) {
      setShowtimes(showtimeData.map(s => ({
        cinema_id: s.cinema_id,
        date: s.start_time.split('T')[0],
        time: s.start_time.split('T')[1].substring(0, 5),
        format: s.format,
        ticket_url: s.ticket_url
      })));
    }

    // Fetch film genres
    const { data: genreData } = await supabase
      .from('film_genres')
      .select('genre_id')
      .eq('film_id', filmId);
    
    if (genreData) {
      setFormData(prev => ({
        ...prev,
        genres: genreData.map(g => g.genre_id)
      }));
    }
  };

  const handleOpenDrawer = async (film = null) => {
    if (film) {
      setEditingFilm(film);
      setFormData({
        ...initialFormState,
        ...film,
        runtime_minutes: film.runtime_minutes || '',
        is_featured: film.is_featured || false,
        release_type: film.release_type || 'cinema',
        youtube_watch_url: film.youtube_watch_url || ''
      });
      await fetchFilmDetails(film.id);
    } else {
      setEditingFilm(null);
      setFormData(initialFormState);
      setCredits([]);
      setShowtimes([]);
    }
    setIsDrawerOpen(true);
  };

  const handleCloseDrawer = () => {
    setIsDrawerOpen(false);
    setEditingFilm(null);
    setFormData(initialFormState);
    setCredits([]);
    setShowtimes([]);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    
    // Auto-extract YouTube ID if someone pastes a full URL into the youtube_id field
    // OR if we add a new "trailer_url" field. For now let's make it smart on the ID field as well.
    if (name === 'trailer_youtube_id' && (value.includes('youtube.com') || value.includes('youtu.be'))) {
      const extractedId = extractYoutubeId(value);
      if (extractedId) {
        setFormData(prev => ({ ...prev, [name]: extractedId, trailer_external_url: value }));
        return;
      }
    }

    setFormData(prev => ({ ...prev, [name]: value }));
  };

  // People Search Logic
  const handlePeopleSearch = async (query) => {
    setPeopleSearch(query);
    if (!query) {
      setPeopleResults([]);
      return;
    }

    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    
    searchTimeout.current = setTimeout(async () => {
      setIsSearchingPeople(true);
      const { data } = await supabase
        .from('people')
        .select('id, name, photo_url')
        .ilike('name', `%${query}%`)
        .limit(5);
      setPeopleResults(data || []);
      setIsSearchingPeople(false);
    }, 300);
  };

  const addCredit = (person, role = 'actor') => {
    if (credits.some(c => c.person_id === person.id && c.role === role)) {
      toast.error('Person already added with this role');
      return;
    }
    setCredits(prev => [...prev, {
      person_id: person.id,
      name: person.name,
      role: role,
      character_name: '',
      billing_order: prev.length + 1
    }]);
    setPeopleSearch('');
    setPeopleResults([]);
  };

  const removeCredit = (index) => {
    setCredits(prev => prev.filter((_, i) => i !== index));
  };

  // Showtime Logic
  const addShowtime = () => {
    setShowtimes(prev => [...prev, {
      cinema_id: cinemas[0]?.id || '',
      date: new Date().toISOString().split('T')[0],
      time: '12:00',
      format: '2D',
      ticket_url: ''
    }]);
  };

  const updateShowtime = (index, field, value) => {
    setShowtimes(prev => prev.map((s, i) => i === index ? { ...s, [field]: value } : s));
  };

  const removeShowtime = (index) => {
    setShowtimes(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const filmPayload = {
        ...formData,
        year: parseInt(formData.year) || null,
        runtime_minutes: parseInt(formData.runtime_minutes) || null,
      };

      const { genres: selectedGenreIds, ...cleanFilmPayload } = filmPayload;

      let filmId = editingFilm?.id;

      if (editingFilm) {
        const { error } = await supabase.from('films').update(cleanFilmPayload).eq('id', filmId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from('films').insert([cleanFilmPayload]).select();
        if (error) throw error;
        filmId = data[0].id;
      }

      // Sync Genres
      await supabase.from('film_genres').delete().eq('film_id', filmId);
      if (selectedGenreIds.length > 0) {
        const genrePayload = selectedGenreIds.map(gid => ({
          film_id: filmId,
          genre_id: gid
        }));
        const { error: gError } = await supabase.from('film_genres').insert(genrePayload);
        if (gError) throw gError;
      }

      // Save Credits
      await supabase.from('credits').delete().eq('film_id', filmId);
      if (credits.length > 0) {
        const creditPayload = credits.map(c => ({
          film_id: filmId,
          person_id: c.person_id,
          role: c.role,
          character_name: c.character_name,
          billing_order: c.billing_order
        }));
        const { error: cError } = await supabase.from('credits').insert(creditPayload);
        if (cError) throw cError;
      }

      // Save Showtimes
      await supabase.from('showtimes').delete().eq('film_id', filmId);
      if (showtimes.length > 0) {
        const showtimePayload = showtimes.map(s => ({
          film_id: filmId,
          cinema_id: s.cinema_id,
          start_time: `${s.date}T${s.time}:00Z`,
          format: s.format,
          ticket_url: s.ticket_url
        }));
        const { error: sError } = await supabase.from('showtimes').insert(showtimePayload);
        if (sError) throw sError;
      }

      toast.success('Film saved successfully');
      handleCloseDrawer();
      fetchFilms();
    } catch (error) {
      console.error('Error saving:', error);
      toast.error(error.message || 'Failed to save film');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deletingFilm) return;
    try {
      const { error } = await supabase.from('films').delete().eq('id', deletingFilm.id);
      if (error) throw error;
      toast.success('Film deleted');
      fetchFilms();
      setDeletingFilm(null);
    } catch (error) {
      toast.error('Delete failed');
    }
  };

  const filteredFilms = films.filter(film => {
    const matchesSearch = film.title.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || film.status === statusFilter;
    const matchesYear = yearFilter === 'all' || film.year?.toString() === yearFilter;
    return matchesSearch && matchesStatus && matchesYear;
  });

  const uniqueYears = [...new Set(films.map(f => f.year))].filter(Boolean).sort((a, b) => b - a);

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-text-primary font-clash">Film Library</h1>
          <p className="text-text-muted text-sm mt-1 uppercase tracking-wider font-black">Database Control Center</p>
        </div>
        <button
          onClick={() => handleOpenDrawer()}
          className="bg-gold text-dark font-black px-6 py-3 rounded-xl hover:bg-gold/90 transition-all shadow-lg active:scale-95"
        >
          + ADD NEW PRODUCTION
        </button>
      </div>

      {/* Library Controls */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="md:col-span-2 relative">
          <input
            type="text"
            placeholder="Search by production title..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-surface border border-border rounded-xl px-4 py-3 text-sm focus:border-gold outline-none"
          />
        </div>
        <div>
          <select 
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full bg-surface border border-border rounded-xl px-4 py-3 text-sm focus:border-gold outline-none uppercase font-black text-[10px] tracking-widest"
          >
            <option value="all">ALL STATUSES</option>
            <option value="announced">ANNOUNCED</option>
            <option value="filming">FILMING</option>
            <option value="post-production">POST-PROD</option>
            <option value="released">RELEASED</option>
          </select>
        </div>
        <div>
          <select 
            value={yearFilter}
            onChange={(e) => setYearFilter(e.target.value)}
            className="w-full bg-surface border border-border rounded-xl px-4 py-3 text-sm focus:border-gold outline-none uppercase font-black text-[10px] tracking-widest"
          >
            <option value="all">ALL YEARS</option>
            {uniqueYears.map(y => <option key={y} value={y.toString()}>{y}</option>)}
          </select>
        </div>
      </div>

      <div className="bg-surface rounded-2xl overflow-hidden border border-border shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left border-collapse">
            <thead className="bg-[#0D1326] text-text-muted uppercase text-[10px] font-black tracking-widest">
              <tr>
                <th className="px-6 py-4">Title & Identity</th>
                <th className="px-6 py-4">Release Status</th>
                <th className="px-6 py-4">Internal Stats</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {loading ? (
                <tr><td colSpan="4" className="p-12 text-center text-text-muted italic">Synchronizing database...</td></tr>
              ) : filteredFilms.length === 0 ? (
                <tr><td colSpan="4" className="p-12 text-center text-text-muted italic">No productions match your filters.</td></tr>
              ) : filteredFilms.map(film => (
                <tr key={film.id} className="hover:bg-surface-2/30 transition-colors group">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-16 bg-surface-2 rounded-lg border border-border overflow-hidden flex-shrink-0 shadow-md">
                        {film.poster_url ? (
                          <img src={film.poster_url} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-gold/20 text-xs">NO IMG</div>
                        )}
                      </div>
                      <div>
                        <div className="font-bold text-text-primary text-base group-hover:text-gold transition-colors">{film.title}</div>
                        <div className="text-[10px] text-text-muted font-black uppercase tracking-widest mt-0.5">
                          {film.year} • {film.language}
                          {film.tmdb_id && (
                            <span className="ml-3 inline-flex items-center gap-1 text-blue-400">
                              <span className="w-1.5 h-1.5 rounded-full bg-blue-400"></span>
                              TMDB {film.tmdb_rating ? `⭐${film.tmdb_rating}` : 'LINKED'}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-tighter ${
                      film.status === 'released' ? 'bg-green-500/10 text-green-400' :
                      film.status === 'post-production' ? 'bg-blue-500/10 text-blue-400' :
                      'bg-surface-2 text-text-muted'
                    }`}>
                      {film.status.replace('-', ' ')}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex gap-4">
                      <div className="text-center">
                        <p className="text-[10px] text-text-muted font-black">VIEWS</p>
                        <p className="text-sm font-bold text-text-primary">{(film.view_count || 0).toLocaleString()}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button onClick={() => handleOpenDrawer(film)} className="text-gold font-black text-xs uppercase mr-4 hover:underline">Edit</button>
                    <button onClick={() => setDeletingFilm(film)} className="text-red-500 font-black text-xs uppercase hover:underline">Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Drawer
        isOpen={isDrawerOpen}
        onClose={handleCloseDrawer}
        title={editingFilm ? 'Edit Production Profile' : 'Register New Production'}
        width="800px"
      >
        <form onSubmit={handleSubmit} className="space-y-12 pb-24">
          {/* Main Attributes */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <section className="space-y-6">
              <div className="flex items-center justify-between border-b border-gold/10 pb-2">
                <h4 className="text-xs font-black text-gold uppercase tracking-[0.2em]">Core Identity</h4>
                {editingFilm && formData.tmdb_id && (
                  <button
                    type="button"
                    onClick={refreshFromTmdb}
                    disabled={isRefreshing}
                    className="text-[10px] font-black bg-blue-500/10 text-blue-400 border border-blue-500/20 px-3 py-1 rounded-full hover:bg-blue-500/20 transition-all flex items-center gap-1.5"
                  >
                    {isRefreshing ? 'REFRESHING...' : '✨ REFRESH FROM TMDB'}
                  </button>
                )}
              </div>
              <div>
                <label className="block text-xs font-black text-text-muted uppercase mb-1.5">Production Title *</label>
                <input required name="title" value={formData.title} onChange={handleChange} className="w-full bg-surface-2 border border-border rounded-xl px-4 py-3 text-sm focus:border-gold outline-none" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-black text-text-muted uppercase mb-1.5">Release Year</label>
                  <input type="number" name="year" value={formData.year} onChange={handleChange} className="w-full bg-surface-2 border border-border rounded-xl px-4 py-3 text-sm focus:border-gold outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-black text-text-muted uppercase mb-1.5">Status</label>
                  <select name="status" value={formData.status} onChange={handleChange} className="w-full bg-surface-2 border border-border rounded-xl px-4 py-3 text-sm focus:border-gold outline-none">
                    <option value="announced">Announced</option>
                    <option value="filming">Filming</option>
                    <option value="post-production">Post-Production</option>
                    <option value="released">Released</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-black text-text-muted uppercase mb-1.5">Story Synopsis</label>
                <textarea name="synopsis" rows="5" value={formData.synopsis} onChange={handleChange} className="w-full bg-surface-2 border border-border rounded-xl px-4 py-3 text-sm focus:border-gold outline-none resize-none" />
              </div>
              <section className="space-y-4 pt-4">
                <h4 className="text-[10px] font-black text-blue-400 uppercase tracking-widest flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-blue-400"></span>
                  TMDB Metadata
                </h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[8px] font-black text-text-muted uppercase mb-1">TMDB ID</label>
                    <input name="tmdb_id" value={formData.tmdb_id || ''} onChange={handleChange} className="w-full bg-surface-2 border border-border rounded-lg px-3 py-2 text-xs focus:border-gold outline-none" />
                  </div>
                  <div>
                    <label className="block text-[8px] font-black text-text-muted uppercase mb-1">TMDB Rating</label>
                    <input step="0.1" type="number" name="tmdb_rating" value={formData.tmdb_rating || ''} onChange={handleChange} className="w-full bg-surface-2 border border-border rounded-lg px-3 py-2 text-xs focus:border-gold outline-none" />
                  </div>
                </div>
                <div>
                  <label className="block text-[8px] font-black text-text-muted uppercase mb-1">Tagline</label>
                  <input name="tagline" value={formData.tagline || ''} onChange={handleChange} className="w-full bg-surface-2 border border-border rounded-lg px-3 py-2 text-xs focus:border-gold outline-none" placeholder="Catchy marketing phrase..." />
                </div>

                <div className="pt-4 space-y-4">
                  <div className="flex items-center justify-between p-4 bg-gold/5 border border-gold/20 rounded-xl">
                    <div>
                      <h4 className="text-xs font-black text-gold uppercase tracking-wider">Hero Spotlight</h4>
                      <p className="text-[10px] text-text-muted">Display this production in the homepage hero slider.</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, is_featured: !formData.is_featured })}
                      className={`relative w-12 h-6 rounded-full transition-colors ${
                        formData.is_featured ? 'bg-gold' : 'bg-surface-2'
                      }`}
                    >
                      <span className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${
                        formData.is_featured ? 'translate-x-7' : 'translate-x-1'
                      }`} />
                    </button>
                  </div>

                  <div className="space-y-4 p-4 bg-surface-2 rounded-xl border border-border">
                    <div>
                      <label className="block text-xs font-black text-text-muted uppercase mb-2">Release Format</label>
                      <div className="flex flex-wrap gap-2">
                        {['cinema', 'youtube', 'netflix', 'prime_video', 'kaba', 'showmax'].map((type) => (
                          <button
                            key={type}
                            type="button"
                            onClick={() => setFormData({ ...formData, release_type: type })}
                            className={`py-2 px-3 rounded-lg text-[10px] font-black uppercase tracking-widest border transition-all ${
                              formData.release_type === type 
                                ? 'bg-gold text-dark border-gold' 
                                : 'bg-bg text-text-muted border-border hover:border-gold/50'
                            }`}
                          >
                            {type.replace('_', ' ')}
                          </button>
                        ))}
                      </div>
                    </div>

                    {formData.release_type !== 'cinema' && (
                      <div className="animate-in fade-in slide-in-from-top-2">
                        <label className="block text-[8px] font-black text-gold uppercase mb-1.5 flex items-center gap-1.5">
                          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>
                          Streaming Link / Watch URL
                        </label>
                        <input 
                          name="youtube_watch_url" 
                          value={formData.youtube_watch_url || ''} 
                          onChange={handleChange} 
                          className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-xs focus:border-gold outline-none" 
                          placeholder="https://..." 
                        />
                        <p className="text-[8px] text-text-muted mt-1 italic">The main "Watch" button on the film detail page will go here.</p>
                      </div>
                    )}
                  </div>
                </div>
              </section>
            </section>

            <section className="space-y-6">
              <h4 className="text-xs font-black text-gold uppercase tracking-[0.2em] border-b border-gold/10 pb-2">Media & Visuals</h4>
              <div>
                <label className="block text-xs font-black text-text-muted uppercase mb-1.5">Poster URL</label>
                <input name="poster_url" value={formData.poster_url} onChange={handleChange} className="w-full bg-surface-2 border border-border rounded-xl px-4 py-3 text-sm focus:border-gold outline-none" placeholder="https://" />
              </div>
              <div>
                <label className="block text-xs font-black text-text-muted uppercase mb-1.5">Backdrop URL</label>
                <input name="backdrop_url" value={formData.backdrop_url} onChange={handleChange} className="w-full bg-surface-2 border border-border rounded-xl px-4 py-3 text-sm focus:border-gold outline-none" placeholder="https://" />
              </div>

              <div className="bg-[#0D1326] p-4 rounded-xl border border-gold/20 space-y-4">
                <h4 className="text-[10px] font-black text-gold uppercase tracking-widest flex items-center gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>
                  YouTube Trailer Override
                </h4>
                <div>
                  <label className="block text-[8px] font-black text-text-muted uppercase mb-1">YouTube URL or ID</label>
                  <input 
                    name="trailer_youtube_id" 
                    value={formData.trailer_youtube_id || ''} 
                    onChange={handleChange} 
                    className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-xs focus:border-gold outline-none placeholder:text-[10px]" 
                    placeholder="Paste full URL or ID here..." 
                  />
                  <p className="text-[8px] text-text-muted mt-1 italic">When you paste a full link, we automatically extract the Video ID.</p>
                </div>
              </div>
              
              {/* Genre Selection */}
              <div>
                <label className="block text-xs font-black text-text-muted uppercase mb-3 text-gold">Primary Genres</label>
                <div className="grid grid-cols-2 gap-3 bg-surface-2 p-4 rounded-xl border border-border">
                  {allGenres.map(genre => (
                    <label key={genre.id} className="flex items-center gap-3 cursor-pointer group">
                      <input
                        type="checkbox"
                        checked={formData.genres.includes(genre.id)}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          setFormData(prev => ({
                            ...prev,
                            genres: checked 
                              ? [...prev.genres, genre.id]
                              : prev.genres.filter(id => id !== genre.id)
                          }));
                        }}
                        className="w-4 h-4 rounded border-border text-gold bg-bg focus:ring-gold focus:ring-offset-bg accent-gold"
                      />
                      <span className="text-[10px] font-black uppercase tracking-wider text-text-muted group-hover:text-gold transition-colors">
                        {genre.name}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-black text-text-muted uppercase mb-1.5">Runtime (Mins)</label>
                  <input type="number" name="runtime_minutes" value={formData.runtime_minutes} onChange={handleChange} className="w-full bg-surface-2 border border-border rounded-xl px-4 py-3 text-sm focus:border-gold outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-black text-text-muted uppercase mb-1.5">Rating</label>
                  <select 
                    name="nfvcb_rating" 
                    value={formData.nfvcb_rating} 
                    onChange={handleChange} 
                    className="w-full bg-surface-2 border border-border rounded-xl px-4 py-3 text-sm focus:border-gold outline-none"
                  >
                    <option value="G">G</option>
                    <option value="PG">PG</option>
                    <option value="PG-13">PG-13</option>
                    <option value="15">15</option>
                    <option value="18">18</option>
                  </select>
                </div>
              </div>
            </section>
          </div>

          {/* Credits Section */}
          <section className="space-y-4">
            <div className="flex items-center justify-between border-b border-gold/10 pb-2">
              <h4 className="text-xs font-black text-gold uppercase tracking-[0.2em]">Cast & Creative Crew</h4>
              <div className="relative">
                <input
                  type="text"
                  placeholder="SEARCH PEOPLE DIRECTORY..."
                  value={peopleSearch}
                  onChange={(e) => handlePeopleSearch(e.target.value)}
                  className="bg-surface border border-gold/30 rounded-full px-4 py-1.5 text-[10px] font-black w-64 focus:border-gold outline-none"
                />
                {peopleResults.length > 0 && (
                  <div className="absolute right-0 top-full mt-2 w-full bg-surface border border-border rounded-xl shadow-2xl z-20 overflow-hidden">
                    {peopleResults.map(p => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => addCredit(p)}
                        className="w-full flex items-center gap-3 p-3 hover:bg-surface-2 transition-colors text-left border-b border-border/50 last:border-0"
                      >
                        <div className="w-8 h-8 rounded-full bg-border overflow-hidden">
                          {p.photo_url && <img src={p.photo_url} alt="" className="w-full h-full object-cover" />}
                        </div>
                        <span className="text-xs font-bold text-text-primary">{p.name}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="bg-surface-2 rounded-2xl border border-border p-4">
              {credits.length === 0 ? (
                <div className="p-8 text-center text-text-muted italic text-xs uppercase font-black">No credits assigned. Search above to add cast and crew.</div>
              ) : (
                <div className="space-y-3">
                  {credits.map((credit, idx) => (
                    <div key={idx} className="flex items-center gap-4 bg-surface p-3 rounded-xl border border-border shadow-sm slide-in">
                      <div className="flex-1">
                        <p className="text-xs font-black text-gold uppercase">{credit.name}</p>
                        <div className="flex items-center gap-4 mt-2">
                          <select
                            value={credit.role}
                            onChange={(e) => setCredits(prev => prev.map((c, i) => i === idx ? { ...c, role: e.target.value } : c))}
                            className="bg-surface-2 border border-border rounded-lg px-3 py-1 text-[10px] font-black focus:border-gold outline-none uppercase"
                          >
                            <option value="actor">Actor</option>
                            <option value="director">Director</option>
                            <option value="producer">Producer</option>
                            <option value="writer">Writer</option>
                          </select>
                          {credit.role === 'actor' && (
                            <input
                              placeholder="AS CHARACTER..."
                              value={credit.character_name || ''}
                              onChange={(e) => setCredits(prev => prev.map((c, i) => i === idx ? { ...c, character_name: e.target.value } : c))}
                              className="bg-transparent border-b border-border text-[10px] font-black px-2 py-1 outline-none focus:border-gold uppercase flex-1"
                            />
                          )}
                        </div>
                      </div>
                      <button type="button" onClick={() => removeCredit(idx)} className="text-red-500 font-bold p-2 hover:bg-red-500/10 rounded-lg transition-colors">✕</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>

          {/* Showtimes Section */}
          <section className="space-y-4">
            <div className="flex items-center justify-between border-b border-gold/10 pb-2">
              <h4 className="text-xs font-black text-gold uppercase tracking-[0.2em]">Cinema Showtimes</h4>
              <button
                type="button"
                onClick={addShowtime}
                className="text-[10px] font-black bg-gold/10 text-gold border border-gold/20 px-4 py-1.5 rounded-full hover:bg-gold/20 transition-all"
              >
                + APPEND SHOWTIME
              </button>
            </div>

            <div className="bg-surface-2 rounded-2xl border border-border p-4">
              {showtimes.length === 0 ? (
                <div className="p-8 text-center text-text-muted italic text-xs uppercase font-black">No active showtimes. Toggle "Showing in Cinema" by adding slots here.</div>
              ) : (
                <div className="space-y-4">
                  {showtimes.map((st, idx) => (
                    <div key={idx} className="grid grid-cols-1 lg:grid-cols-5 gap-4 bg-surface p-4 rounded-xl border border-border shadow-sm relative">
                      <div className="lg:col-span-1">
                        <label className="block text-[8px] font-black text-text-muted uppercase mb-1">Cinema Location</label>
                        <select
                          value={st.cinema_id}
                          onChange={(e) => updateShowtime(idx, 'cinema_id', e.target.value)}
                          className="w-full bg-surface-2 border border-border rounded-lg px-3 py-2 text-[10px] font-black outline-none focus:border-gold"
                        >
                          {cinemas.map(c => <option key={c.id} value={c.id}>{c.name} ({c.city})</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="block text-[8px] font-black text-text-muted uppercase mb-1">Session Date</label>
                        <input type="date" value={st.date} onChange={(e) => updateShowtime(idx, 'date', e.target.value)} className="w-full bg-surface-2 border border-border rounded-lg px-3 py-2 text-[10px] font-black outline-none focus:border-gold" />
                      </div>
                      <div>
                        <label className="block text-[8px] font-black text-text-muted uppercase mb-1">Start Time</label>
                        <input type="time" value={st.time} onChange={(e) => updateShowtime(idx, 'time', e.target.value)} className="w-full bg-surface-2 border border-border rounded-lg px-3 py-2 text-[10px] font-black outline-none focus:border-gold" />
                      </div>
                      <div>
                        <label className="block text-[8px] font-black text-text-muted uppercase mb-1">Format</label>
                        <select value={st.format} onChange={(e) => updateShowtime(idx, 'format', e.target.value)} className="w-full bg-surface-2 border border-border rounded-lg px-3 py-2 text-[10px] font-black outline-none focus:border-gold">
                          <option value="2D">2D</option>
                          <option value="3D">3D</option>
                          <option value="IMAX 2D">IMAX 2D</option>
                          <option value="IMAX 3D">IMAX 3D</option>
                        </select>
                      </div>
                      <div className="flex items-end gap-2">
                        <div className="flex-1">
                          <label className="block text-[8px] font-black text-text-muted uppercase mb-1">Booking Link</label>
                          <input placeholder="https://" value={st.ticket_url} onChange={(e) => updateShowtime(idx, 'ticket_url', e.target.value)} className="w-full bg-surface-2 border border-border rounded-lg px-3 py-2 text-[10px] font-black outline-none focus:border-gold" />
                        </div>
                        <button type="button" onClick={() => removeShowtime(idx)} className="text-red-500 font-bold p-2 mb-0.5 hover:bg-red-500/10 rounded-lg transition-colors">🗑️</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>

          <div className="sticky bottom-0 pt-6 mt-12 bg-[#13192B] border-t border-border -mx-6 px-6 pb-6 shadow-[0_-12px_30px_rgba(0,0,0,0.5)] z-20">
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-4 bg-gold hover:bg-gold/90 text-dark font-black rounded-2xl transition-all shadow-[0_12px_24px_-8px_rgba(212,160,23,0.6)] active:scale-[0.98] disabled:opacity-50 uppercase tracking-widest text-sm"
            >
              {isSubmitting ? 'PROCESSING TRANSACTION...' : editingFilm ? 'RE-COMMIT PRODUCTION DATA' : 'COMMIT PRODUCTION TO DATABASE'}
            </button>
          </div>
        </form>
      </Drawer>

      {deletingFilm && (
        <ConfirmModal
          onCancel={() => setDeletingFilm(null)}
          onConfirm={handleConfirmDelete}
          title="Delete Film"
          message={`Are you sure you want to delete "${deletingFilm?.title}"? All related credits, genres, and showtimes will be permanently removed.`}
          confirmLabel="Delete Film"
        />
      )}
    </div>
  );
}
