import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { toast } from 'react-hot-toast';
import { Icon } from '@iconify/react';
import Drawer from '../../components/admin/Drawer';
import ConfirmModal from '../../components/admin/ConfirmModal';
import MergeModal from '../../components/admin/MergeModal';
import { extractYoutubeId } from '../../lib/youtube';

export default function AdminFilms() {
  const [films, setFilms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [editingFilm, setEditingFilm] = useState(null);
  const [deletingFilm, setDeletingFilm] = useState(null);
  const [selectedFilmIds, setSelectedFilmIds] = useState([]);
  const [filmBatchDeleteIds, setFilmBatchDeleteIds] = useState(null);
  const [isBatchDeleting, setIsBatchDeleting] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isMergeModalOpen, setIsMergeModalOpen] = useState(false);
  const [isMerging, setIsMerging] = useState(false);
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const pageSize = 20;
  
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
    youtube_watch_url: '',
    streaming_links: {}
  };

  const [formData, setFormData] = useState(initialFormState);

  useEffect(() => {
    fetchCinemas();
    fetchGenres();
  }, []);

  useEffect(() => {
    setPage(1);
    setSelectedFilmIds([]);
  }, [searchTerm, statusFilter, yearFilter]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchFilms();
    }, searchTerm ? 400 : 0);
    return () => clearTimeout(timer);
  }, [page, searchTerm, statusFilter, yearFilter]);

  const fetchGenres = async () => {
    const { data } = await supabase.from('genres').select('*').order('name');
    setAllGenres(data || []);
  };

  const fetchFilms = async () => {
    setLoading(true);
    try {
      // 1. Get total count
      let countQuery = supabase.from('films').select('*', { count: 'exact', head: true });
      if (searchTerm) countQuery = countQuery.ilike('title', `%${searchTerm}%`);
      if (statusFilter !== 'all') countQuery = countQuery.eq('status', statusFilter);
      if (yearFilter !== 'all') countQuery = countQuery.eq('year', parseInt(yearFilter));
      
      const { count } = await countQuery;
      setTotalCount(count || 0);

      // 2. Get paginated data
      let query = supabase.from('films').select('*');
      
      if (searchTerm) query = query.ilike('title', `%${searchTerm}%`);
      if (statusFilter !== 'all') query = query.eq('status', statusFilter);
      if (yearFilter !== 'all') query = query.eq('year', parseInt(yearFilter));

      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;

      const { data, error } = await query
        .order('created_at', { ascending: false })
        .range(from, to);

      if (error) throw error;
      setFilms(data || []);
    } catch (error) {
      console.error(error);
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
      .order('show_date', { ascending: true })
      .order('show_time', { ascending: true });
    
    if (showtimeData) {
      setShowtimes(showtimeData.map(s => ({
        cinema_id: s.cinema_id,
        date: s.show_date,
        time: s.show_time?.substring(0, 5) || '12:00',
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
        youtube_watch_url: film.youtube_watch_url || '',
        streaming_links: film.streaming_links || {},
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
        tmdb_id: parseInt(formData.tmdb_id) || null,
        tmdb_rating: parseFloat(formData.tmdb_rating) || null,
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
          show_date: s.date,
          show_time: s.time,
          format: s.format,
          ticket_url: s.ticket_url,
          is_available: true
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
      setSelectedFilmIds((prev) => prev.filter((id) => id !== deletingFilm.id));
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

  const toggleFilmSelect = (id) => {
    setSelectedFilmIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const allFilteredFilmsSelected =
    filteredFilms.length > 0 && filteredFilms.every((f) => selectedFilmIds.includes(f.id));

  const toggleSelectAllFilteredFilms = () => {
    if (allFilteredFilmsSelected) {
      const filteredIds = new Set(filteredFilms.map((f) => f.id));
      setSelectedFilmIds((prev) => prev.filter((id) => !filteredIds.has(id)));
    } else {
      setSelectedFilmIds((prev) => {
        const next = new Set([...prev, ...filteredFilms.map((f) => f.id)]);
        return [...next];
      });
    }
  };

  const handleConfirmBatchDeleteFilms = async () => {
    if (!filmBatchDeleteIds?.length) return;
    setIsBatchDeleting(true);
    try {
      const { error } = await supabase.from('films').delete().in('id', filmBatchDeleteIds);
      if (error) throw error;
      toast.success(`Deleted ${filmBatchDeleteIds.length} film${filmBatchDeleteIds.length === 1 ? '' : 's'}`);
      setSelectedFilmIds((prev) => prev.filter((id) => !filmBatchDeleteIds.includes(id)));
      setFilmBatchDeleteIds(null);
      fetchFilms();
    } catch (error) {
      toast.error('Batch delete failed');
    } finally {
      setIsBatchDeleting(false);
    }
  };

  const handleMergeFilms = async (primaryId, secondaryIds) => {
    setIsMerging(true);
    const t = toast.loading('Consolidating production records...');
    try {
      for (const secId of secondaryIds) {
        const { error } = await supabase.rpc('merge_films', { 
          primary_id: primaryId, 
          secondary_id: secId 
        });
        if (error) throw error;
      }
      
      toast.success('Productions merged successfully!', { id: t });
      setIsMergeModalOpen(false);
      setSelectedFilmIds([]);
      fetchFilms();
    } catch (error) {
      console.error('Merge error:', error);
      toast.error(`Merge failed: ${error.message}`, { id: t });
    } finally {
      setIsMerging(false);
    }
  };

  const currentYear = new Date().getFullYear();
  const uniqueYears = Array.from({ length: currentYear - 1980 + 3 }, (_, i) => currentYear + 2 - i);

  return (
    <div className="p-10 max-w-[1600px] mx-auto">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-12">
        <div>
          <p className="text-brand text-xs font-bold mb-1">Database</p>
          <h1 className="text-3xl font-bold text-text-primary tracking-tight">Movies</h1>
          <p className="text-text-muted text-sm mt-1 font-medium">Manage and monitor the digital film library.</p>
        </div>
        <button
          onClick={() => handleOpenDrawer()}
          className="bg-brand text-white font-bold px-8 py-3.5 rounded-md text-sm hover:opacity-90 active:scale-95 transition-all shadow-lg shadow-brand/20 flex items-center gap-2"
        >
          <Icon icon="solar:add-circle-linear" className="w-5 h-5" />
          Add movie record
        </button>
      </div>

      {/* Library Controls */}
      <div className="flex flex-col md:flex-row gap-4 mb-8">
        <div className="flex-1 relative group">
          <input
            type="text"
            placeholder="Search by production title..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-surface border border-border rounded-md px-4 py-3 pl-12 text-text-primary text-sm focus:border-brand focus:ring-4 focus:ring-brand/5 shadow-sm transition-all"
          />
          <svg className="absolute left-4 top-3.5 w-5 h-5 text-text-muted group-focus-within:text-brand transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
        <div className="flex gap-4">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-surface border border-border rounded-md px-4 py-3 text-text-primary text-sm focus:border-brand focus:ring-4 focus:ring-brand/5 shadow-sm transition-all appearance-none cursor-pointer min-w-[160px]"
          >
            <option value="all">Any Status</option>
            <option value="announced">Announced</option>
            <option value="filming">Filming</option>
            <option value="post-production">Post-Prod</option>
            <option value="released">Released</option>
          </select>
          <select
            value={yearFilter}
            onChange={(e) => setYearFilter(e.target.value)}
            className="bg-surface border border-border rounded-md px-4 py-3 text-text-primary text-sm focus:border-brand focus:ring-4 focus:ring-brand/5 shadow-sm transition-all appearance-none cursor-pointer min-w-[120px]"
          >
            <option value="all">All Years</option>
            {uniqueYears.map(y => <option key={y} value={y.toString()}>{y}</option>)}
          </select>
        </div>
      </div>

      {selectedFilmIds.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4 p-4 rounded-md bg-surface-2 border border-border">
          <span className="text-sm text-text-primary font-bold">
            {selectedFilmIds.length} selected
          </span>
          <div className="flex items-center gap-3">
            {selectedFilmIds.length >= 2 && (
              <button
                type="button"
                onClick={() => setIsMergeModalOpen(true)}
                className="text-sm font-black uppercase tracking-wider px-4 py-2 rounded-lg bg-brand/15 text-brand border border-brand/30 hover:bg-brand/25 transition-colors flex items-center gap-2"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" /></svg>
                Merge selected
              </button>
            )}
            <button
              type="button"
              onClick={() => setFilmBatchDeleteIds([...selectedFilmIds])}
              className="text-sm font-black uppercase tracking-wider px-4 py-2 rounded-lg bg-red-500/15 text-red-400 border border-red-500/30 hover:bg-red-500/25 transition-colors"
            >
              Delete selected
            </button>
          </div>
        </div>
      )}

      <div className="card-cal overflow-hidden mb-12">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left border-collapse">
            <thead>
              <tr className="border-b border-border text-text-muted text-xs font-bold bg-surface-2/30">
                <th className="pl-6 py-4 w-12">
                  <input
                    type="checkbox"
                    checked={allFilteredFilmsSelected}
                    onChange={toggleSelectAllFilteredFilms}
                    disabled={loading || filteredFilms.length === 0}
                    className="w-4 h-4 rounded border-border bg-surface accent-brand cursor-pointer disabled:opacity-40"
                  />
                </th>
                <th className="px-6 py-4 font-bold">Production</th>
                <th className="px-6 py-4 font-bold">Status</th>
                <th className="px-6 py-4 font-bold">Engagement</th>
                <th className="pr-6 py-4 text-right font-bold w-[120px]">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr><td colSpan="5" className="p-20 text-center text-text-muted">Loading database records...</td></tr>
              ) : filteredFilms.length === 0 ? (
                <tr><td colSpan="5" className="p-20 text-center text-text-muted italic">No productions found.</td></tr>
              ) : filteredFilms.map((film, i) => (
                <tr 
                  key={film.id} 
                  className="group hover:bg-surface-2/50 transition-colors"
                >
                  <td className="pl-6 py-4">
                    <input
                      type="checkbox"
                      checked={selectedFilmIds.includes(film.id)}
                      onChange={() => toggleFilmSelect(film.id)}
                      className="w-4 h-4 rounded border-border bg-surface accent-brand cursor-pointer"
                    />
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-14 bg-surface-2 rounded-lg border border-border overflow-hidden flex-shrink-0 shadow-sm transition-transform group-hover:scale-105">
                        {film.poster_url ? (
                          <img src={film.poster_url} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-[8px] font-bold text-text-muted">Empty</div>
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="font-bold text-text-primary text-sm truncate group-hover:text-brand transition-colors">{film.title}</div>
                        <div className="text-[11px] text-text-muted font-medium mt-0.5">
                          {film.year || 'TBD'} • {film.language || 'English'}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                      film.status === 'released' ? 'bg-green-500/10 text-green-600 border-green-500/20' :
                      film.status === 'post-production' ? 'bg-blue-500/10 text-blue-600 border-blue-500/20' :
                      film.status === 'filming' ? 'bg-amber-500/10 text-amber-600 border-amber-500/20' :
                      'bg-slate-500/10 text-slate-500 border-slate-500/20'
                    }`}>
                      {film.status.replace('-', ' ')}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col">
                      <span className="text-text-primary font-bold text-xs">{(film.view_count || 0).toLocaleString()}</span>
                      <span className="text-[10px] text-text-muted font-medium">Views</span>
                    </div>
                  </td>
                  <td className="pr-6 py-4 text-right">
                    <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => handleOpenDrawer(film)}
                        className="p-2 hover:bg-surface rounded-lg text-text-muted hover:text-brand transition-all border border-transparent hover:border-border hover:shadow-sm"
                        title="Edit Production"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => setDeletingFilm(film)}
                        className="p-2 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-lg text-text-muted hover:text-red-600 transition-all border border-transparent hover:border-red-100 dark:hover:border-red-900 shadow-sm"
                        title="Delete Production"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        {/* Pagination Footer */}
        <div className="flex items-center justify-between px-6 py-6 border-t border-border bg-surface-2/30">
          <div className="text-xs font-bold text-text-muted uppercase tracking-widest">
            Showing <span className="text-text-primary">{(page - 1) * pageSize + 1}</span> to <span className="text-text-primary">{Math.min(page * pageSize, totalCount)}</span> of <span className="text-text-primary">{totalCount}</span> Films
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setPage(prev => Math.max(1, prev - 1))}
              disabled={page === 1 || loading}
              className="px-4 py-2 bg-surface border border-border text-xs font-bold text-text-primary rounded-md hover:bg-surface-2 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
            >
              Previous
            </button>
            <div className="flex items-center px-4 text-xs font-bold text-brand bg-brand/10 border border-brand/20 rounded-md">
              Page {page}
            </div>
            <button
              onClick={() => setPage(prev => (prev * pageSize < totalCount ? prev + 1 : prev))}
              disabled={page * pageSize >= totalCount || loading}
              className="px-4 py-2 bg-surface border border-border text-xs font-bold text-text-primary rounded-md hover:bg-surface-2 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      <MergeModal
        isOpen={isMergeModalOpen}
        onClose={() => setIsMergeModalOpen(false)}
        items={films.filter(f => selectedFilmIds.includes(f.id))}
        onConfirm={handleMergeFilms}
        type="film"
      />

      <Drawer
        isOpen={isDrawerOpen}
        onClose={handleCloseDrawer}
        title={editingFilm ? 'Edit Movie Profile' : 'Add New Movie'}
        width="800px"
      >
        <form onSubmit={handleSubmit} className="space-y-12">
          {/* Main Attributes */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
            <section className="space-y-6">
              <div className="flex items-center justify-between pb-2 border-b border-border">
                <h4 className="text-xs font-bold text-text-muted">Core Information</h4>
                {editingFilm && formData.tmdb_id && (
                  <button
                    type="button"
                    onClick={refreshFromTmdb}
                    disabled={isRefreshing}
                    className="text-[10px] font-bold text-brand bg-brand/5 border border-brand/20 px-3 py-1 rounded-full hover:bg-brand/10 transition-all flex items-center gap-1.5"
                  >
                    {isRefreshing ? 'Refreshing...' : (
                      <>
                        <Icon icon="solar:stars-minimalistic-bold" />
                        Sync TMDB
                      </>
                    )}
                  </button>
                )}
              </div>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-text-primary mb-2">Movie Title *</label>
                  <input 
                    required 
                    name="title" 
                    value={formData.title} 
                    onChange={handleChange} 
                    className="w-full bg-surface-2 border border-border rounded-md px-4 py-2.5 text-sm focus:border-brand focus:ring-4 focus:ring-brand/5 outline-none transition-all" 
                    placeholder="Enter movie title..."
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-text-primary mb-2">Release Year</label>
                    <input 
                      type="number" 
                      name="year" 
                      value={formData.year} 
                      onChange={handleChange} 
                      className="w-full bg-surface-2 border border-border rounded-md px-4 py-2.5 text-sm focus:border-brand focus:ring-4 focus:ring-brand/5 outline-none transition-all" 
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-text-primary mb-2">Status</label>
                    <select 
                      name="status" 
                      value={formData.status} 
                      onChange={handleChange} 
                      className="w-full bg-surface-2 border border-border rounded-md px-4 py-2.5 text-sm focus:border-brand focus:ring-4 focus:ring-brand/5 outline-none transition-all appearance-none cursor-pointer"
                    >
                      <option value="announced">Announced</option>
                      <option value="filming">Filming</option>
                      <option value="post-production">Post-Production</option>
                      <option value="released">Released</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-text-primary mb-2">Story Synopsis</label>
                  <textarea 
                    name="synopsis" 
                    rows="5" 
                    value={formData.synopsis} 
                    onChange={handleChange} 
                    className="w-full bg-surface-2 border border-border rounded-md px-4 py-2.5 text-sm focus:border-brand focus:ring-4 focus:ring-brand/5 outline-none transition-all resize-none leading-relaxed" 
                    placeholder="Tell the story..."
                  />
                </div>
              </div>

              <div className="pt-4 space-y-6">
                <div className="p-5 bg-surface-2 border border-border rounded-lg space-y-4">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="w-2 h-2 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]"></span>
                    <h4 className="text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-widest">Intelligence Linking</h4>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-bold text-text-muted uppercase mb-1.5">TMDB ID</label>
                      <input name="tmdb_id" value={formData.tmdb_id || ''} onChange={handleChange} className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-xs focus:border-brand outline-none" />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-text-muted uppercase mb-1.5">Rating</label>
                      <input step="0.1" type="number" name="tmdb_rating" value={formData.tmdb_rating || ''} onChange={handleChange} className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-xs focus:border-brand outline-none" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-text-muted uppercase mb-1.5">Marketing Tagline</label>
                    <input name="tagline" value={formData.tagline || ''} onChange={handleChange} className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-xs focus:border-brand outline-none" placeholder="Catchy phrase..." />
                  </div>
                </div>

                <div className="p-5 bg-surface-2 border border-border rounded-lg space-y-6">
                  <div className="flex items-center justify-between pb-4 border-b border-border/50">
                    <div>
                      <h4 className="text-sm font-bold text-text-primary tracking-tight">Showcase Feature</h4>
                      <p className="text-[11px] text-text-muted mt-0.5">Pin this production to the primary Hero carousel.</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, is_featured: !formData.is_featured })}
                      className={`relative w-11 h-6 rounded-full transition-colors duration-200 outline-none focus:ring-2 focus:ring-brand/20 ${
                        formData.is_featured ? 'bg-brand' : 'bg-slate-200 dark:bg-slate-800'
                      }`}
                    >
                      <span className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white shadow-sm transition-transform duration-200 ${
                        formData.is_featured ? 'translate-x-5' : 'translate-x-0'
                      }`} />
                    </button>
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-bold text-text-primary tracking-tight font-heading">Market Momentum</h4>
                      <p className="text-[11px] text-text-muted mt-0.5 italic">Boost this to the 'Trending This Week' section.</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, is_trending: !formData.is_trending })}
                      className={`relative w-11 h-6 rounded-full transition-colors duration-200 outline-none focus:ring-2 focus:ring-brand/20 ${
                        formData.is_trending ? 'bg-orange-500' : 'bg-slate-200 dark:bg-slate-800'
                      }`}
                    >
                      <span className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white shadow-sm transition-transform duration-200 ${
                        formData.is_trending ? 'translate-x-5' : 'translate-x-0'
                      }`} />
                    </button>
                  </div>
                </div>
              </div>
            </section>

            <section className="space-y-8">
              <h4 className="text-[11px] font-bold text-text-muted uppercase tracking-widest pb-2 border-b border-border">Media & Presentation</h4>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-text-primary mb-2">Poster Asset URL</label>
                  <input name="poster_url" value={formData.poster_url} onChange={handleChange} className="w-full bg-surface-2 border border-border rounded-md px-4 py-2.5 text-sm focus:border-brand focus:ring-4 focus:ring-brand/5 outline-none transition-all" placeholder="https://" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-text-primary mb-2">Landscape Backdrop URL</label>
                  <input name="backdrop_url" value={formData.backdrop_url} onChange={handleChange} className="w-full bg-surface-2 border border-border rounded-md px-4 py-2.5 text-sm focus:border-brand focus:ring-4 focus:ring-brand/5 outline-none transition-all" placeholder="https://" />
                </div>
              </div>

              <div className="p-5 bg-surface-2 border border-border rounded-lg space-y-5">
                <div>
                  <label className="block text-[10px] font-bold text-text-muted uppercase tracking-widest mb-3">Classification Genres</label>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                    {allGenres.map(genre => (
                      <label key={genre.id} className="flex items-center gap-3 cursor-pointer group">
                        <div className="relative flex items-center">
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
                            className="w-4 h-4 rounded border-border text-brand bg-surface focus:ring-brand/30 accent-brand transition-all"
                          />
                        </div>
                        <span className="text-[11px] font-medium text-text-muted group-hover:text-text-primary transition-colors">
                          {genre.name}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 pt-2">
                  <div>
                    <label className="block text-[10px] font-bold text-text-muted uppercase mb-2">Duration (Mins)</label>
                    <input type="number" name="runtime_minutes" value={formData.runtime_minutes} onChange={handleChange} className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-xs focus:border-brand outline-none" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-text-muted uppercase mb-2">Content Rating</label>
                    <select 
                      name="nfvcb_rating" 
                      value={formData.nfvcb_rating} 
                      onChange={handleChange} 
                      className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-xs focus:border-brand outline-none"
                    >
                      {['G', 'PG', 'PG-13', '15', '18'].map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </div>
                </div>
              </div>

              <div className="p-5 bg-orange-50 dark:bg-orange-500/5 border border-orange-200 dark:border-orange-500/20 rounded-lg space-y-4">
                <div className="flex items-center gap-2 mb-1">
                  <svg className="w-4 h-4 text-brand" fill="currentColor" viewBox="0 0 24 24"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>
                  <h4 className="text-[10px] font-bold text-brand uppercase tracking-widest">Public Access Control</h4>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-text-muted uppercase mb-2">Available On Platforms</label>
                  <div className="flex flex-wrap gap-2">
                    {['cinema', 'youtube', 'netflix', 'prime_video', 'kava', 'showmax'].map((type) => {
                      const isActive = type === 'cinema' 
                        ? formData.release_type === 'cinema'
                        : (formData.streaming_links && type in formData.streaming_links) || formData.release_type === type;
                      
                      const isPrimary = formData.release_type === type;

                      return (
                        <div key={type} className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              if (type === 'cinema') {
                                setFormData({ ...formData, release_type: 'cinema' });
                              } else {
                                const newLinks = { ...formData.streaming_links };
                                if (isActive && !isPrimary) {
                                  delete newLinks[type];
                                } else {
                                  newLinks[type] = newLinks[type] || '';
                                }
                                setFormData({ 
                                  ...formData, 
                                  streaming_links: newLinks,
                                  // If we just activated it and nothing is primary, make it primary
                                  release_type: (!formData.release_type || formData.release_type === 'cinema') ? type : formData.release_type
                                });
                              }
                            }}
                            className={`py-1.5 px-3 rounded-lg text-[10px] font-bold uppercase tracking-wider border transition-all flex items-center gap-2 ${
                              isActive 
                                ? 'bg-brand/10 text-brand border-brand/50 shadow-sm' 
                                : 'bg-surface text-text-muted border-border hover:border-brand/40'
                            }`}
                          >
                            {isActive && (
                              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                              </svg>
                            )}
                            {type.replace('_', ' ')}
                          </button>
                          
                          {isActive && type !== 'cinema' && (
                            <button
                              type="button"
                              title="Set as Primary"
                              onClick={() => setFormData({ ...formData, release_type: type })}
                              className={`p-1.5 rounded-md transition-all ${
                                isPrimary ? 'text-gold' : 'text-text-muted hover:text-gold'
                              }`}
                            >
                              <svg className="w-4 h-4" fill={isPrimary ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.54 1.118l-3.976-2.888a1 1 0 00-1.175 0l-3.976 2.888c-.784.57-1.838-.196-1.539-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                              </svg>
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
                {formData.release_type !== 'cinema' && (
                  <div className="pt-2 animate-in fade-in slide-in-from-top-2">
                    <label className="block text-[10px] font-bold text-text-muted uppercase mb-2">
                      Primary Watch URL (Shown on Button)
                    </label>
                    <input 
                      name="youtube_watch_url" 
                      value={formData.youtube_watch_url || ''} 
                      onChange={handleChange} 
                      className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-xs focus:border-brand outline-none" 
                      placeholder="https://..." 
                    />
                  </div>
                )}

                {/* Multi-Platform Links */}
                <div className="pt-4 space-y-4 border-t border-border mt-4">
                  <h5 className="text-[10px] font-black uppercase tracking-widest text-text-primary">Watch Destination Links</h5>
                  <div className="grid grid-cols-1 gap-3">
                    {[
                      { id: 'netflix', label: 'Netflix', placeholder: 'https://netflix.com/...' },
                      { id: 'prime_video', label: 'Prime Video', placeholder: 'https://primevideo.com/...' },
                      { id: 'kava', label: 'Kava', placeholder: 'https://kava.tv/...' },
                      { id: 'youtube', label: 'YouTube (Full Movie)', placeholder: 'https://youtube.com/watch?v=...' },
                      { id: 'showmax', label: 'Showmax', placeholder: 'https://showmax.com/...' },
                    ].map(platform => {
                      const isActive = (formData.streaming_links && platform.id in formData.streaming_links) || formData.release_type === platform.id;
                      if (!isActive) return null;

                      return (
                        <div key={platform.id} className="flex flex-col gap-1.5 animate-in fade-in slide-in-from-left-2">
                          <div className="flex items-center justify-between">
                            <label className="text-[9px] font-bold text-text-muted uppercase tracking-wider">
                              {platform.label} {formData.release_type === platform.id && <span className="text-gold ml-1">(PRIMARY)</span>}
                            </label>
                          </div>
                          <input
                            type="text"
                            value={platform.id === formData.release_type ? (formData.youtube_watch_url || formData.streaming_links?.[platform.id] || '') : (formData.streaming_links?.[platform.id] || '')}
                            onChange={(e) => {
                              if (platform.id === formData.release_type) {
                                setFormData({
                                  ...formData,
                                  youtube_watch_url: e.target.value,
                                  streaming_links: {
                                    ...formData.streaming_links,
                                    [platform.id]: e.target.value
                                  }
                                });
                              } else {
                                setFormData({
                                  ...formData,
                                  streaming_links: {
                                    ...formData.streaming_links,
                                    [platform.id]: e.target.value
                                  }
                                });
                              }
                            }}
                            placeholder={platform.placeholder}
                            className="w-full bg-surface-2 border border-border rounded-lg px-3 py-2 text-[10px] focus:border-brand outline-none"
                          />
                        </div>
                      );
                    })}
                    {(!formData.streaming_links || Object.keys(formData.streaming_links).length === 0) && formData.release_type === 'cinema' && (
                      <p className="text-[10px] text-text-muted italic">No streaming platforms selected.</p>
                    )}
                  </div>
                </div>
                <div className="pt-2">
                  <label className="block text-[10px] font-bold text-text-muted uppercase mb-2">YouTube Video Override (Trailers)</label>
                  <input 
                    name="trailer_youtube_id" 
                    value={formData.trailer_youtube_id || ''} 
                    onChange={handleChange} 
                    className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-xs focus:border-brand outline-none" 
                    placeholder="URL or ID..." 
                  />
                </div>
              </div>
            </section>
          </div>

          <hr className="border-border" />

          {/* Credits Section */}
          <section className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <h4 className="text-sm font-bold text-text-primary tracking-tight">Cast & Creative Crew</h4>
              <div className="relative group">
                <input
                  type="text"
                  placeholder="Search directory..."
                  value={peopleSearch}
                  onChange={(e) => handlePeopleSearch(e.target.value)}
                  className="bg-surface-2 border border-border rounded-md px-4 py-2 text-xs w-full md:w-64 focus:border-brand outline-none transition-all pr-12"
                />
                <svg className="absolute right-4 top-2.5 w-4 h-4 text-text-muted group-focus-within:text-brand transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                {peopleResults.length > 0 && (
                  <div className="absolute right-0 top-full mt-2 w-full bg-surface border border-border rounded-md shadow-2xl z-20 overflow-hidden ring-1 ring-black/5 animate-in fade-in slide-in-from-top-2">
                    {peopleResults.map(p => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => addCredit(p)}
                        className="w-full flex items-center gap-3 p-3 hover:bg-surface-2 transition-colors text-left border-b border-border/50 last:border-0"
                      >
                        <div className="w-8 h-8 rounded-full bg-surface-2 overflow-hidden border border-border">
                          {p.photo_url && <img src={p.photo_url} alt="" className="w-full h-full object-cover" />}
                        </div>
                        <span className="text-xs font-bold text-text-primary">{p.name}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="bg-surface-2/50 rounded-lg border border-border p-6 min-h-[100px] flex flex-col items-center justify-center">
              {credits.length === 0 ? (
                <div className="text-center text-text-muted py-8">
                  <div className="w-12 h-12 bg-surface rounded-full flex items-center justify-center mx-auto mb-3 border border-border">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
                  </div>
                  <p className="text-xs font-medium">No cast members assigned yet.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 w-full">
                  {credits.map((credit, idx) => (
                    <div key={idx} className="flex items-center gap-4 bg-surface p-4 rounded-md border border-border shadow-sm group animate-in slide-in-from-left-2">
                      <div className="flex-1 space-y-3">
                        <p className="text-xs font-bold text-text-primary">{credit.name}</p>
                        <div className="flex items-center gap-3">
                          <select
                            value={credit.role}
                            onChange={(e) => setCredits(prev => prev.map((c, i) => i === idx ? { ...c, role: e.target.value } : c))}
                            className="bg-surface-2 border border-border rounded-lg px-2 py-1 text-[10px] font-bold focus:border-brand outline-none uppercase"
                          >
                            <option value="actor">Actor</option>
                            <option value="director">Director</option>
                            <option value="producer">Producer</option>
                            <option value="writer">Writer</option>
                          </select>
                          {credit.role === 'actor' && (
                            <input
                              placeholder="Role name..."
                              value={credit.character_name || ''}
                              onChange={(e) => setCredits(prev => prev.map((c, i) => i === idx ? { ...c, character_name: e.target.value } : c))}
                              className="bg-transparent border-b border-border text-[10px] font-medium px-2 py-1 outline-none focus:border-brand flex-1"
                            />
                          )}
                        </div>
                      </div>
                      <button type="button" onClick={() => removeCredit(idx)} className="p-2 text-text-muted hover:text-red-500 hover:bg-red-50 rounded-lg transition-all opacity-0 group-hover:opacity-100">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>

          <hr className="border-border" />

          {/* Showtimes Section */}
          <section className="space-y-6">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-bold text-text-primary tracking-tight">Active Engagement (Showtimes)</h4>
              <button
                type="button"
                onClick={addShowtime}
                className="text-[10px] font-bold text-brand bg-brand/5 border border-brand/20 px-4 py-2 rounded-md hover:bg-brand/10 transition-all flex items-center gap-2"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" /></svg>
                Add Showtime
              </button>
            </div>

            <div className="bg-surface-2/50 rounded-lg border border-border p-6 min-h-[100px]">
              {showtimes.length === 0 ? (
                <div className="text-center text-text-muted py-8">
                  <div className="w-12 h-12 bg-surface rounded-full flex items-center justify-center mx-auto mb-3 border border-border">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  </div>
                  <p className="text-xs font-medium">No showtimes listed.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {showtimes.map((st, idx) => (
                    <div key={idx} className="grid grid-cols-1 lg:grid-cols-5 gap-4 bg-surface p-5 rounded-md border border-border shadow-sm group relative animate-in slide-in-from-bottom-2">
                      <div className="lg:col-span-1">
                        <label className="block text-[9px] font-bold text-text-muted uppercase mb-1.5">Cinema</label>
                        <select
                          value={st.cinema_id}
                          onChange={(e) => updateShowtime(idx, 'cinema_id', e.target.value)}
                          className="w-full bg-surface-2 border border-border rounded-lg px-3 py-2 text-[11px] font-bold outline-none focus:border-brand"
                        >
                          {cinemas.map(c => <option key={c.id} value={c.id}>{c.name} ({c.city})</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="block text-[9px] font-bold text-text-muted uppercase mb-1.5">Date</label>
                        <input type="date" value={st.date} onChange={(e) => updateShowtime(idx, 'date', e.target.value)} className="w-full bg-surface-2 border border-border rounded-lg px-3 py-2 text-[11px] font-bold outline-none focus:border-brand" />
                      </div>
                      <div>
                        <label className="block text-[9px] font-bold text-text-muted uppercase mb-1.5">Time</label>
                        <input type="time" value={st.time} onChange={(e) => updateShowtime(idx, 'time', e.target.value)} className="w-full bg-surface-2 border border-border rounded-lg px-3 py-2 text-[11px] font-bold outline-none focus:border-brand" />
                      </div>
                      <div>
                        <label className="block text-[9px] font-bold text-text-muted uppercase mb-1.5">Format</label>
                        <select value={st.format} onChange={(e) => updateShowtime(idx, 'format', e.target.value)} className="w-full bg-surface-2 border border-border rounded-lg px-3 py-2 text-[11px] font-bold outline-none focus:border-brand">
                          {['2D', '3D', 'IMAX 2D', 'IMAX 3D'].map(f => <option key={f} value={f}>{f}</option>)}
                        </select>
                      </div>
                      <div className="flex items-end gap-3">
                        <div className="flex-1">
                          <label className="block text-[9px] font-bold text-text-muted uppercase mb-1.5">Ticket URL</label>
                          <input placeholder="https://" value={st.ticket_url} onChange={(e) => updateShowtime(idx, 'ticket_url', e.target.value)} className="w-full bg-surface-2 border border-border rounded-lg px-3 py-2 text-[11px] font-bold outline-none focus:border-brand" />
                        </div>
                        <button type="button" onClick={() => removeShowtime(idx)} className="p-2 text-text-muted hover:text-red-500 hover:bg-red-50 rounded-lg transition-all">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>

          <div className="pt-8 pb-4">
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-4 bg-brand text-white font-bold rounded-lg transition-all shadow-xl shadow-brand/20 active:scale-[0.99] disabled:opacity-50 text-sm tracking-tight flex items-center justify-center gap-3"
            >
              {isSubmitting ? (
                <>
                  <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                  Processing...
                </>
              ) : (
                editingFilm ? 'Commit Changes' : 'Register Production'
              )}
            </button>
          </div>
        </form>
      </Drawer>

      {deletingFilm && (
        <ConfirmModal
          onCancel={() => setDeletingFilm(null)}
          onConfirm={handleConfirmDelete}
          title="Delete Production"
          message={`Are you sure you want to delete "${deletingFilm?.title}"? This action cannot be undone and will remove all related intelligence including credits and showtimes.`}
          confirmLabel="Delete Production"
        />
      )}

      {filmBatchDeleteIds && (
        <ConfirmModal
          onCancel={() => !isBatchDeleting && setFilmBatchDeleteIds(null)}
          onConfirm={handleConfirmBatchDeleteFilms}
          title="Batch Delete"
          message={`Are you sure you want to delete ${filmBatchDeleteIds.length} productions? All associated data will be purged.`}
          confirmLabel="Delete Multiple"
          isProcessing={isBatchDeleting}
        />
      )}
    </div>
  );
}
