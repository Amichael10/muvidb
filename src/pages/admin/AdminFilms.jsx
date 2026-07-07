import React, { useState, useEffect, useRef, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import { toast } from 'react-hot-toast';
import { Icon } from '@iconify/react';
import Drawer from '../../components/admin/Drawer';
import ConfirmModal from '../../components/admin/ConfirmModal';
import MergeModal from '../../components/admin/MergeModal';
import { extractYoutubeId } from '../../lib/youtube';
import { useAuth } from '../../context/AuthContext';
import { logAdminAction } from '../../lib/adminLogger';
import { toTitleCase } from '../../utils/format';
import { useLocalStorageDraft } from '../../hooks/useLocalStorageDraft';
import { getFriendlyErrorMessage } from '../../utils/errors';
import { authHeaders } from '../../lib/apiAuth';

export default function AdminFilms() {
  const { user } = useAuth();
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
  const [lastSync, setLastSync] = useState(null);
  const pageSize = 20;
  
  // Normalized Data State
  const [credits, setCredits] = useState([]);
  const [customRoles, setCustomRoles] = useState([]);
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
  const [featuredFilter, setFeaturedFilter] = useState('all'); // all, featured, regular
  const [trendingFilter, setTrendingFilter] = useState('all'); // all, trending, regular
  const [sortBy, setSortBy] = useState('newest'); // newest, oldest, a-z
  const [duplicateFilter, setDuplicateFilter] = useState(false);
  const [sourceFilter, setSourceFilter] = useState('all');
  const [platformFilter, setPlatformFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [cinemaFilter, setCinemaFilter] = useState('all'); // all, in_cinemas, not_in_cinemas
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [viewMode, setViewMode] = useState('library'); // library, youtube_buffer
  const [youtubeVideos, setYoutubeVideos] = useState([]);
  const [isSummarizing, setIsSummarizing] = useState(false);

  const handleAISummarize = async () => {
    if (!formData.title) {
      toast.error('Title is required for summarization');
      return;
    }

    setIsSummarizing(true);
    try {
      const response = await fetch('/api/ai', {
        method: 'POST',
        headers: await authHeaders(),
        body: JSON.stringify({
          task: 'summarize_film',
          data: { title: formData.title, description: formData.synopsis }
        })
      });

      const data = await response.json();
      if (data.synopsis) {
        setFormData(prev => ({ ...prev, synopsis: data.synopsis }));
        toast.success('Synopsis generated!');
      }
    } catch (err) {
      console.error('AI Error:', err);
      toast.error('AI Summarization failed');
    } finally {
      setIsSummarizing(false);
    }
  };

  const handleAIPolishTitle = async () => {
    if (!formData.title) return;
    setIsSummarizing(true);
    try {
      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: await authHeaders(),
        body: JSON.stringify({ task: 'polish_title', data: { title: formData.title } })
      });
      const data = await res.json();
      if (data.title) {
        setFormData(prev => ({ ...prev, title: data.title }));
        toast.success('Title polished!');
      }
    } catch (err) {
      toast.error('Failed to polish title');
    } finally {
      setIsSummarizing(false);
    }
  };

  // Company Search States
  const [companySearch, setCompanySearch] = useState('');
  const [companyResults, setCompanyResults] = useState([]);
  const [selectedCompany, setSelectedCompany] = useState(null);
  const [isSearchingCompanies, setIsSearchingCompanies] = useState(false);
  const [isCreatingCompany, setIsCreatingCompany] = useState(false);

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
    status: 'upcoming',
    trailer_source: 'youtube',
    trailer_youtube_id: '',
    tmdb_id: '',
    tmdb_rating: '',
    tagline: '',
    is_featured: false,
    is_trending: false,
    release_type: '',
    youtube_watch_url: '',
    source_video_id: '',
    content_type: 'movie',
    is_in_cinemas: false,
    streaming_links: {}
  };

  const [formData, setFormData] = useState(initialFormState);

  const draftKey = isDrawerOpen ? (editingFilm ? `MuviDB_draft_film_${editingFilm.id}` : 'MuviDB_draft_film_new') : null;
  const draftData = useMemo(() => ({ formData, credits, showtimes, selectedCompany }), [formData, credits, showtimes, selectedCompany]);
  const { clearDraft } = useLocalStorageDraft(draftKey, draftData, isDrawerOpen);
  const [draftRestoredMessage, setDraftRestoredMessage] = useState('');


  const uniqueYears = useMemo(() => {
    const years = new Set();
    const currentYear = new Date().getFullYear();
    for (let i = 0; i < 30; i++) years.add(currentYear - i);
    return Array.from(years).sort((a, b) => b - a);
  }, []);

  useEffect(() => {
    fetchCinemas();
    fetchGenres();
  }, []);

  useEffect(() => {
    setPage(1);
    setSelectedFilmIds([]);
  }, [searchTerm, statusFilter, yearFilter, featuredFilter, trendingFilter, sourceFilter, platformFilter, typeFilter, cinemaFilter, sortBy]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (viewMode === 'library') {
        fetchFilms();
      } else {
        fetchYoutubeBuffer();
      }
    }, searchTerm ? 400 : 0);
    return () => clearTimeout(timer);
  }, [page, searchTerm, statusFilter, yearFilter, featuredFilter, trendingFilter, sourceFilter, platformFilter, typeFilter, cinemaFilter, sortBy, viewMode]);

  useEffect(() => {
    const handleDeepLink = async () => {
      const params = new URLSearchParams(window.location.search);
      const editId = params.get('edit');
      const mapVideoId = params.get('map_video');

      if (editId) {
        // Attempt to find in existing list or fetch directly
        let film = films.find(f => f.id === editId);
        if (!film) {
          const { data } = await supabase.from('films').select('*').eq('id', editId).single();
          film = data;
        }

        if (film) {
          setEditingFilm(film);
          setFormData({ ...initialFormState, ...film });
          setIsDrawerOpen(true);
        }
        // Clear param after handling
        window.history.replaceState({}, '', window.location.pathname);
      } else if (mapVideoId) {
        // Handle mapping a new video
        const { data: video } = await supabase.from('channel_videos').select('*, channels(name)').eq('id', mapVideoId).single();
        if (video) {
          setEditingFilm(null); // It's a new film record
          setFormData({
            ...initialFormState,
            title: video.title,
            synopsis: video.description || '',
            poster_url: video.thumbnail_url || '',
            source_video_id: video.video_id,
            youtube_watch_url: `https://www.youtube.com/watch?v=${video.video_id}`,
            release_type: 'youtube',
            status: 'released',
            channel_video_id: video.id
          });
          setIsDrawerOpen(true);
          toast.success(`Mapping video: ${video.title}`);
        }
        window.history.replaceState({}, '', window.location.pathname);
      }
    };

    handleDeepLink();
  }, [films.length > 0]); // Run when films list is populated

  const fetchGenres = async () => {
    const { data } = await supabase.from('genres').select('*').order('name');
    setAllGenres(data || []);
  };

  const fetchFilms = async () => {
    setLoading(true);
    try {
      // 1. Get total count
      let countQuery = supabase.from('films').select('*', { count: 'exact', head: true });
      if (searchTerm) countQuery = countQuery.ilike('title', `%${searchTerm.toLowerCase()}%`);
      if (statusFilter !== 'all') countQuery = countQuery.eq('status', statusFilter);
      if (yearFilter !== 'all') countQuery = countQuery.eq('year', parseInt(yearFilter));
      if (featuredFilter === 'featured') countQuery = countQuery.eq('is_featured', true);
      if (featuredFilter === 'regular') countQuery = countQuery.eq('is_featured', false);
      if (sourceFilter !== 'all') countQuery = countQuery.eq('source', sourceFilter);
      if (typeFilter !== 'all') countQuery = countQuery.eq('content_type', typeFilter);
      if (cinemaFilter === 'in_cinemas') countQuery = countQuery.eq('is_in_cinemas', true);
      if (cinemaFilter === 'not_in_cinemas') countQuery = countQuery.eq('is_in_cinemas', false);
      if (platformFilter !== 'all') {
        if (platformFilter === 'youtube') countQuery = countQuery.not('youtube_watch_url', 'is', null);
        else countQuery = countQuery.not(`streaming_links->${platformFilter}`, 'is', null);
      }
      
      const { count } = await countQuery;
      setTotalCount(count || 0);

      // 2. Get paginated data
      let query;
      
      if (duplicateFilter) {
        query = supabase.rpc('get_duplicate_films');
      } else {
        query = supabase.from('films').select('*');
      }
      
      if (!duplicateFilter && searchTerm) query = query.ilike('title', `%${searchTerm.toLowerCase()}%`);
      if (statusFilter !== 'all') query = query.eq('status', statusFilter);
      if (yearFilter !== 'all') query = query.eq('year', parseInt(yearFilter));
      if (featuredFilter === 'featured') query = query.eq('is_featured', true);
      if (featuredFilter === 'regular') query = query.eq('is_featured', false);
      if (trendingFilter === 'trending') query = query.eq('is_trending', true);
      if (trendingFilter === 'regular') query = query.eq('is_trending', false);
      if (sourceFilter !== 'all') query = query.eq('source', sourceFilter);
      if (typeFilter !== 'all') query = query.eq('content_type', typeFilter);
      if (cinemaFilter === 'in_cinemas') query = query.eq('is_in_cinemas', true);
      if (cinemaFilter === 'not_in_cinemas') query = query.eq('is_in_cinemas', false);
      if (platformFilter !== 'all') {
        if (platformFilter === 'youtube') query = query.not('youtube_watch_url', 'is', null);
        else query = query.not(`streaming_links->${platformFilter}`, 'is', null);
      }

      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;

      const sortConfig = {
        newest: { column: 'created_at', ascending: false },
        oldest: { column: 'created_at', ascending: true },
        'a-z': { column: 'title', ascending: true }
      };
      
      const config = sortConfig[sortBy] || sortConfig.newest;

      // Duplicate filter ignores typical order to keep dupes grouped by title
      if (!duplicateFilter) {
        query = query.order(config.column, { ascending: config.ascending });
      }

      const { data, error } = await query.range(from, to);

      if (error) throw error;
      let finalData = data || [];

      setFilms(finalData);
    } catch (error) {
      console.error(error);
      toast.error('Failed to load films');
    } finally {
      setLoading(false);
    }
  };

  const formatDuration = (seconds) => {
    if (!seconds) return '00:00';
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hrs > 0) return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const fetchYoutubeBuffer = async () => {
    setLoading(true);
    try {
      // Fetch videos that are NOT hidden and do NOT have a film_id
      let query = supabase
        .from('channel_videos')
        .select('*, channels(name)', { count: 'exact' })
        .is('film_id', null)
        .eq('is_hidden', false);

      if (searchTerm) query = query.ilike('title', `%${searchTerm.toLowerCase()}%`);

      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;

      const { data, count, error } = await query
        .order('published_at', { ascending: false })
        .range(from, to);

      if (error) throw error;
      setYoutubeVideos(data || []);
      setTotalCount(count || 0);

      // Fetch last sync from channels
      const { data: syncData } = await supabase
        .from('channels')
        .select('videos_last_fetched_at')
        .order('videos_last_fetched_at', { ascending: false })
        .limit(1);
      
      if (syncData?.[0]?.videos_last_fetched_at) {
        setLastSync(new Date(syncData[0].videos_last_fetched_at));
      }
    } catch (error) {
      console.error(error);
      toast.error('Failed to load YouTube buffer');
    } finally {
      setLoading(false);
    }
  };

  const handleIgnoreVideo = async (videoId) => {
    try {
      const { error } = await supabase
        .from('channel_videos')
        .update({ is_hidden: true })
        .eq('id', videoId);
      
      if (error) throw error;
      setYoutubeVideos(prev => prev.filter(v => v.id !== videoId));
      toast.success('Signal dismissed');
    } catch (err) {
      toast.error('Failed to hide signal');
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
    const [
      { data: creditData },
      { data: showtimeData },
      { data: genreData },
      { data: companyData }
    ] = await Promise.all([
      supabase
        .from('credits')
        .select(`id, role, character_name, billing_order, person_id, people(id, name, photo_url)`)
        .eq('film_id', filmId)
        .order('billing_order', { ascending: true }),
      supabase
        .from('showtimes')
        .select('*')
        .eq('film_id', filmId)
        .order('show_date', { ascending: true })
        .order('show_time', { ascending: true }),
      supabase
        .from('film_genres')
        .select('genre_id')
        .eq('film_id', filmId),
      supabase
        .from('film_companies')
        .select('companies(*)')
        .eq('film_id', filmId)
        .limit(1)
    ]);
    
    if (creditData) {
      const standardRoles = ['actor', 'director', 'producer', 'executive producer', 'writer', 'cinematographer', 'editor', 'composer', 'sound recordist', 'production designer', 'art director', 'makeup artist', 'costume designer', 'gaffer', 'continuity', 'production manager', 'assistant director', 'colorist', 'vfx', 'stunts', 'casting director', 'location manager'];
      
      const existingCustomRoles = [...new Set(creditData
        .map(c => c.role ? c.role.toLowerCase() : '')
        .filter(role => role && !standardRoles.includes(role)))];
      setCustomRoles(existingCustomRoles);

      setCredits(creditData.map(c => ({
        person_id: c.person_id,
        name: c.people?.name,
        role: c.role ? c.role.toLowerCase() : '',
        character_name: c.character_name,
        billing_order: c.billing_order,
        isCustomRole: false
      })));
    }

    if (showtimeData) {
      setShowtimes(showtimeData.map(s => ({
        cinema_id: s.cinema_id,
        date: s.show_date,
        time: s.show_time?.substring(0, 5) || '12:00',
        format: s.format,
        ticket_url: s.ticket_url
      })));
    }

    if (genreData) {
      setFormData(prev => ({
        ...prev,
        genres: genreData.map(g => g.genre_id)
      }));
    }
    
    if (companyData && companyData.length > 0 && companyData[0].companies) {
      setSelectedCompany(companyData[0].companies);
      setCompanySearch(companyData[0].companies.name);
    } else {
      setSelectedCompany(null);
      setCompanySearch('');
    }
  };

  const handleOpenDrawer = async (film = null, ignoreDraft = false) => {
    let draft = null;
    const key = film ? `MuviDB_draft_film_${film.id}` : 'MuviDB_draft_film_new';
    if (!ignoreDraft) {
      try {
        const stored = localStorage.getItem(key);
        if (stored) draft = JSON.parse(stored);
      } catch (e) {}
    }
    setDraftRestoredMessage(draft ? 'Unsaved changes restored from draft.' : '');

    if (film) {
      setEditingFilm(film);
      setFormData(draft?.formData || {
        ...initialFormState,
        ...film,
        genres: film.genres || [],
        runtime_minutes: film.runtime_minutes || '',
        is_featured: film.is_featured || false,
        release_type: film.release_type || 'cinema',
        youtube_watch_url: film.youtube_watch_url || '',
        streaming_links: film.streaming_links || {},
      });
      
      if (draft) {
        setCredits(draft.credits || []);
        setShowtimes(draft.showtimes || []);
        setSelectedCompany(draft.selectedCompany || null);
        setCompanySearch(draft.selectedCompany?.name || '');
      } else {
        await fetchFilmDetails(film.id);
      }
    } else {
      setEditingFilm(null);
      setFormData(draft?.formData || initialFormState);
      setCredits(draft?.credits || []);
      setShowtimes(draft?.showtimes || []);
      setSelectedCompany(draft?.selectedCompany || null);
      setCompanySearch(draft?.selectedCompany?.name || '');
    }
    setIsDrawerOpen(true);
  };

  const handleCloseDrawer = () => {
    setIsDrawerOpen(false);
    setEditingFilm(null);
    setFormData(initialFormState);
    setCredits([]);
    setShowtimes([]);
    setSelectedCompany(null);
    setCompanySearch('');
    setCompanyResults([]);
    setPeopleSearch('');
    setPeopleResults([]);
    setCustomRoles([]);
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

  const createPerson = async (name) => {
    if (!name) return;
    try {
      const { data, error } = await supabase
        .from('people')
        .insert([{ 
          name, 
          nationality: 'Nigerian', 
          gender: 'Prefer not to say' 
        }])
        .select()
        .single();

      if (error) throw error;
      
      addCredit(data);
      setPeopleSearch('');
      setPeopleResults([]);
      toast.success(`Profile for "${name}" created`);
    } catch (error) {
      console.error('Error creating person:', error);
      toast.error('Failed to create person');
    }
  };

  const handleCompanySearch = async (query) => {
    setCompanySearch(query);
    if (!query) {
      setCompanyResults([]);
      return;
    }

    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    
    searchTimeout.current = setTimeout(async () => {
      setIsSearchingCompanies(true);
      const { data } = await supabase
        .from('companies')
        .select('*')
        .ilike('name', `%${query}%`)
        .limit(5);
      setCompanyResults(data || []);
      setIsSearchingCompanies(false);
    }, 300);
  };

  const createCompany = async (name) => {
    if (!name) return;
    setIsCreatingCompany(true);
    try {
      const { data, error } = await supabase
        .from('companies')
        .insert([{ 
          name, 
          description: '.', 
          website: '.', 
          logo_url: null 
        }])
        .select()
        .single();

      if (error) throw error;
      
      setSelectedCompany(data);
      setCompanySearch(data.name);
      setCompanyResults([]);
      toast.success(`Company "${name}" created and linked`);
    } catch (error) {
      console.error('Error creating company:', error);
      toast.error('Failed to create company');
    } finally {
      setIsCreatingCompany(false);
    }
  };

  const addCredit = (person, role = 'actor') => {
    const normRole = role.trim().toLowerCase();
    if (credits.some(c => c.person_id === person.id && (c.role || '').trim().toLowerCase() === normRole)) {
      toast.error('Person already added with this role');
      return;
    }
    setCredits(prev => [...prev, {
      person_id: person.id,
      name: person.name,
      role: normRole,
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
        year: formData.year && !isNaN(parseInt(formData.year)) ? parseInt(formData.year) : null,
        runtime_minutes: formData.runtime_minutes && !isNaN(parseInt(formData.runtime_minutes)) ? parseInt(formData.runtime_minutes) : null,
        tmdb_id: formData.tmdb_id && !isNaN(parseInt(formData.tmdb_id)) ? parseInt(formData.tmdb_id) : null,
        tmdb_rating: formData.tmdb_rating && !isNaN(parseFloat(formData.tmdb_rating)) ? parseFloat(formData.tmdb_rating) : null,
        is_trending: Boolean(formData.is_trending),
        is_featured: Boolean(formData.is_featured),
        is_in_cinemas: Boolean(formData.is_in_cinemas),
        slug: formData.slug || (formData.title ? formData.title.toLowerCase().replace(/[^a-zA-Z0-9\s]/g, '').trim().replace(/\s+/g, '-') : null),
        mubi_slug: formData.mubi_slug || formData.slug || (formData.title ? formData.title.toLowerCase().replace(/[^a-zA-Z0-9\s]/g, '').trim().replace(/\s+/g, '-') : null),
        source_video_id: (typeof formData.source_video_id === 'string' ? formData.source_video_id.trim() : formData.source_video_id) || null,
        trailer_youtube_id: (typeof formData.trailer_youtube_id === 'string' ? formData.trailer_youtube_id.trim() : formData.trailer_youtube_id) || null,
        poster_url: (formData.poster_url || '').trim() || null,
        backdrop_url: (formData.backdrop_url || '').trim() || null,
        youtube_watch_url: (formData.youtube_watch_url || '').trim() || null,
        release_type: formData.release_type || null,
      };

      const { genres: selectedGenreIds, channel_video_id, ...cleanFilmPayload } = filmPayload;

      let filmId = editingFilm?.id;

      if (editingFilm) {
        const { error } = await supabase.from('films').update(cleanFilmPayload).eq('id', filmId);
        if (error) throw error;
      } else {
        // If we have a source_video_id, check if it already exists to avoid unique constraint error
        if (cleanFilmPayload.source_video_id) {
          const { data: existing } = await supabase
            .from('films')
            .select('id, title')
            .eq('source_video_id', cleanFilmPayload.source_video_id)
            .maybeSingle();
          
          if (existing) {
            // It already exists! Let's update it instead of creating a new one
            filmId = existing.id;
            const { error: updateErr } = await supabase
              .from('films')
              .update(cleanFilmPayload)
              .eq('id', filmId);
            if (updateErr) throw updateErr;
            toast.success(`Updated existing film: ${existing.title}`);
          } else {
            const { data, error } = await supabase.from('films').insert([cleanFilmPayload]).select();
            if (error) throw error;
            filmId = data[0].id;
          }
        } else {
          const { data, error } = await supabase.from('films').insert([cleanFilmPayload]).select();
          if (error) throw error;
          filmId = data[0].id;
        }

      }

      // Always try to link the channel_videos record to this film (new or existing)
      if (channel_video_id) {
        await supabase.from('channel_videos').update({ film_id: filmId }).eq('id', channel_video_id);
      } else if (cleanFilmPayload.source_video_id) {
        await supabase.from('channel_videos').update({ film_id: filmId }).eq('video_id', cleanFilmPayload.source_video_id);
      }

      // Delete old associations in parallel
      await Promise.all([
        supabase.from('film_genres').delete().eq('film_id', filmId),
        supabase.from('credits').delete().eq('film_id', filmId),
        supabase.from('showtimes').delete().eq('film_id', filmId),
        supabase.from('film_companies').delete().eq('film_id', filmId)
      ]);

      const insertPromises = [];

      if (selectedGenreIds.length > 0) {
        const genrePayload = selectedGenreIds.map(gid => ({
          film_id: filmId,
          genre_id: gid
        }));
        insertPromises.push(supabase.from('film_genres').insert(genrePayload));
      }

      if (credits.length > 0) {
        // 1. Filter out any credits that are missing a person_id (safety guard)
        const creditsWithId = credits.filter(c => c.person_id);

        if (creditsWithId.length > 0) {
          // 2. Verify all person_ids actually exist in the people table
          const personIds = [...new Set(creditsWithId.map(c => c.person_id))];
          const { data: existingPeople } = await supabase
            .from('people')
            .select('id')
            .in('id', personIds);

          const validIds = new Set((existingPeople || []).map(p => p.id));
          const invalidCount = personIds.filter(id => !validIds.has(id)).length;

          if (invalidCount > 0) {
            toast.error(`${invalidCount} cast/crew member(s) no longer exist and were skipped. The rest were saved.`);
          }

          // 3. Only insert credits whose person_id is confirmed valid
          const validCredits = creditsWithId.filter(c => validIds.has(c.person_id));
          if (validCredits.length > 0) {
            const uniquePayloads = [];
            const seen = new Set();

            for (const c of validCredits) {
              const normalizedRole = c.role ? toTitleCase(c.role.trim()) : '';
              const key = `${c.person_id}-${normalizedRole}`;

              if (!seen.has(key)) {
                seen.add(key);
                uniquePayloads.push({
                  film_id: filmId,
                  person_id: c.person_id,
                  role: normalizedRole,
                  character_name: c.character_name ? toTitleCase(c.character_name.trim()) : '',
                  billing_order: c.billing_order
                });
              } else {
                // If duplicate exists, merge character_name if original doesn't have it
                const existing = uniquePayloads.find(p => p.person_id === c.person_id && p.role === normalizedRole);
                if (existing && !existing.character_name && c.character_name) {
                  existing.character_name = toTitleCase(c.character_name.trim());
                }
              }
            }

            if (uniquePayloads.length > 0) {
              insertPromises.push(supabase.from('credits').insert(uniquePayloads));
            }
          }
        }
      }

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
        insertPromises.push(supabase.from('showtimes').insert(showtimePayload));
      }

      if (selectedCompany) {
        insertPromises.push(supabase.from('film_companies').insert([{ film_id: filmId, company_id: selectedCompany.id }]));
      }

      if (insertPromises.length > 0) {
        const results = await Promise.all(insertPromises);
        results.forEach(res => {
          if (res.error) throw res.error;
        });
      }

      const actionType = editingFilm ? 'update' : 'create';
      await logAdminAction(user, actionType, 'film', filmId, cleanFilmPayload.title, { year: cleanFilmPayload.year });

      toast.success('Film saved successfully');
      clearDraft();
      handleCloseDrawer();
      fetchFilms();
      fetchYoutubeBuffer();
    } catch (error) {
      console.error('Error saving:', error);
      toast.error(getFriendlyErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deletingFilm) return;
    try {
      const { error } = await supabase.from('films').delete().eq('id', deletingFilm.id);
      if (error) throw error;
      await logAdminAction(user, 'delete', 'film', deletingFilm.id, deletingFilm.title);
      toast.success('Film deleted');
      setSelectedFilmIds((prev) => prev.filter((id) => id !== deletingFilm.id));
      fetchFilms();
      setDeletingFilm(null);
    } catch (error) {
      toast.error(getFriendlyErrorMessage(error));
    }
  };

  const toggleFeatured = async (film) => {
    const newStatus = !film.is_featured;
    try {
      const { error } = await supabase
        .from('films')
        .update({ is_featured: newStatus })
        .eq('id', film.id);

      if (error) throw error;
      
      await logAdminAction(user, 'update', 'film', film.id, film.title, { is_featured: newStatus, field: 'featured' });
      
      setFilms(prev => prev.map(f => f.id === film.id ? { ...f, is_featured: newStatus } : f));
      toast.success(newStatus ? 'Production Featured' : 'Removed from Featured');
    } catch (err) {
      toast.error(getFriendlyErrorMessage(err));
    }
  };

  const filteredFilms = films.filter(film => {
    const matchesSearch = (film.title || '').toLowerCase().includes(searchTerm.toLowerCase());
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
      
      for (const id of filmBatchDeleteIds) {
        await logAdminAction(user, 'delete', 'film', id, `Batch deleted film ID: ${id}`);
      }
      
      toast.success(`Deleted ${filmBatchDeleteIds.length} film${filmBatchDeleteIds.length === 1 ? '' : 's'}`);
      setSelectedFilmIds((prev) => prev.filter((id) => !filmBatchDeleteIds.includes(id)));
      setFilmBatchDeleteIds(null);
      fetchFilms();
    } catch (error) {
      toast.error(getFriendlyErrorMessage(error));
    } finally {
      setIsBatchDeleting(false);
    }
  };

  const handleMergeFilms = async (primaryId, secondaryIds, enrichedData = null) => {
    const t = toast.loading('Executing production merge...');
    setIsMerging(true);
    try {
      // 1. Relational merge
      for (const secId of secondaryIds) {
        const { error } = await supabase.rpc('merge_films', { 
          p_primary_id: primaryId, 
          p_secondary_id: secId,
          p_metadata: enrichedData
        });
        if (error) throw error;
      }
      
      await logAdminAction(user, 'update', 'film', primaryId, `Merged secondary ID(s) into film`, { secondaryIds });
      
      toast.success('Productions merged and metadata synchronized', { id: t });
      setIsMergeModalOpen(false);
      setSelectedFilmIds([]);
      fetchFilms();
    } catch (error) {
      console.error('Merge error:', error);
      toast.error(`Merge failed: ${getFriendlyErrorMessage(error)}`, { id: t });
    } finally {
      setIsMerging(false);
    }
  };



  return (
    <div className="p-4 md:p-8 lg:p-10 w-full max-w-full mx-auto">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-12">
        <div>
          <p className="text-brand text-xs font-bold mb-1">Database</p>
          <h1 className="text-3xl font-bold text-text-primary tracking-tight">Movies</h1>
          <p className="text-text-muted text-sm mt-1 font-medium">Manage and monitor the digital film library.</p>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex gap-1 p-1 bg-surface-2 rounded-xl border border-border">
            <button
              onClick={() => setViewMode('library')}
              className={`px-6 py-2.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${viewMode === 'library' ? 'bg-surface border border-border shadow-sm text-text-primary' : 'text-text-muted hover:text-text-primary'}`}
            >
              📂 Library
            </button>
            <button
              onClick={() => setViewMode('youtube_buffer')}
              className={`px-6 py-2.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${viewMode === 'youtube_buffer' ? 'bg-surface border border-border shadow-sm text-text-primary' : 'text-text-muted hover:text-text-primary'}`}
            >
              📺 Buffer
            </button>
          </div>
          
          <button
            onClick={() => handleOpenDrawer()}
            className="bg-brand text-white font-bold px-8 py-3.5 rounded-md text-sm hover:opacity-90 active:scale-95 transition-all shadow-lg shadow-brand/20 flex items-center gap-2"
          >
          <Icon icon="solar:add-circle-linear" className="w-5 h-5" />
          Add movie record
        </button>
      </div>
    </div>

      {/* Library Controls */}
      <div className="flex flex-col gap-4 mb-8">
        <div className="flex flex-col lg:flex-row gap-4 w-full">
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
          <div className="flex flex-wrap items-center gap-3">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-surface border border-border rounded-md px-4 py-3 text-text-primary text-sm focus:border-brand focus:ring-4 focus:ring-brand/5 shadow-sm transition-all appearance-none cursor-pointer min-w-[140px]"
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
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="bg-surface border border-border rounded-md px-4 py-3 text-text-primary text-sm focus:border-brand focus:ring-4 focus:ring-brand/5 shadow-sm transition-all appearance-none cursor-pointer min-w-[140px]"
            >
              <option value="newest">Recently Added</option>
              <option value="oldest">Oldest First</option>
              <option value="a-z">Alphabetical</option>
            </select>
            <button
              onClick={() => setDuplicateFilter(!duplicateFilter)}
              className={`px-4 py-3 rounded-md text-xs font-bold transition-all border flex items-center gap-2 ${duplicateFilter ? 'bg-amber-500/10 text-amber-600 border-amber-500/20' : 'bg-surface border-border text-text-muted hover:text-text-primary'}`}
              title="Show potential duplicates by name"
            >
              <Icon icon="solar:copy-bold" className="w-4 h-4" />
              {duplicateFilter ? 'Showing Duplicates' : 'Filter Duplicates'}
            </button>
          </div>
        </div>
        
        {/* Advanced Filters */}
        <div className="flex flex-wrap items-center gap-3 p-4 bg-surface-2/50 rounded-lg border border-border">
          <div className="text-xs font-bold text-text-muted uppercase tracking-widest mr-2">Filters:</div>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="bg-surface border border-border rounded-md px-3 py-2 text-text-primary text-xs focus:border-brand focus:ring-2 focus:ring-brand/20 shadow-sm transition-all appearance-none cursor-pointer"
          >
            <option value="all">All Types</option>
            <option value="movie">Movies</option>
            <option value="series">Series</option>
          </select>

          <select
            value={cinemaFilter}
            onChange={(e) => setCinemaFilter(e.target.value)}
            className="bg-surface border border-border rounded-md px-3 py-2 text-text-primary text-xs focus:border-brand focus:ring-2 focus:ring-brand/20 shadow-sm transition-all appearance-none cursor-pointer"
          >
            <option value="all">All Cinema Status</option>
            <option value="in_cinemas">In Cinemas</option>
            <option value="not_in_cinemas">Not In Cinemas</option>
          </select>

          <select
            value={platformFilter}
            onChange={(e) => setPlatformFilter(e.target.value)}
            className="bg-surface border border-border rounded-md px-3 py-2 text-text-primary text-xs focus:border-brand focus:ring-2 focus:ring-brand/20 shadow-sm transition-all appearance-none cursor-pointer"
          >
            <option value="all">All Platforms</option>
            <option value="youtube">YouTube</option>
            <option value="netflix">Netflix</option>
            <option value="prime_video">Prime Video</option>
            <option value="kava">Kava</option>
            <option value="iroko_tv">IrokoTV</option>
            <option value="docuth">Docuth</option>
          </select>

          <select
            value={sourceFilter}
            onChange={(e) => setSourceFilter(e.target.value)}
            className="bg-surface border border-border rounded-md px-3 py-2 text-text-primary text-xs focus:border-brand focus:ring-2 focus:ring-brand/20 shadow-sm transition-all appearance-none cursor-pointer"
          >
            <option value="all">All Sources</option>
            <option value="manual">Manual</option>
            <option value="netflix_sync">Netflix Sync</option>
            <option value="prime_sync">Prime Sync</option>
            <option value="kava">Kava Sync</option>
            <option value="irokotv">IrokoTV Sync</option>
            <option value="youtube">YouTube Sync</option>
            <option value="docuth_sync">Docuth Sync</option>
          </select>
          
          <select
            value={featuredFilter}
            onChange={(e) => setFeaturedFilter(e.target.value)}
            className="bg-surface border border-border rounded-md px-3 py-2 text-text-primary text-xs focus:border-brand focus:ring-2 focus:ring-brand/20 shadow-sm transition-all appearance-none cursor-pointer"
          >
            <option value="all">All Placement</option>
            <option value="featured">Featured Hero</option>
            <option value="regular">Regular</option>
          </select>
          
          <select
            value={trendingFilter}
            onChange={(e) => setTrendingFilter(e.target.value)}
            className="bg-surface border border-border rounded-md px-3 py-2 text-text-primary text-xs focus:border-brand focus:ring-2 focus:ring-brand/20 shadow-sm transition-all appearance-none cursor-pointer"
          >
            <option value="all">Any Trend</option>
            <option value="trending">Trending Now</option>
            <option value="regular">Normal Feed</option>
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
                <th className="px-6 py-4 font-bold">Year</th>
                <th className="px-6 py-4 font-bold">Country</th>
                <th className="px-6 py-4 font-bold">Platforms</th>
                <th className="px-6 py-4 font-bold">Source</th>
                <th className="px-6 py-4 font-bold text-center">Status</th>
                <th className="pr-6 py-4 text-right font-bold w-[120px]">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr><td colSpan="5" className="p-20 text-center text-text-muted italic">Loading records...</td></tr>
              ) : viewMode === 'library' ? (
                films.length === 0 ? (
                  <tr><td colSpan="5" className="p-20 text-center text-text-muted italic">No productions found in library.</td></tr>
                ) : films.map((film) => (
                  <tr key={film.id} className="group hover:bg-surface-2/50 transition-colors">
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
                          {film.poster_url ? <img src={film.poster_url} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-[8px] font-bold text-text-muted">Empty</div>}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <div className="font-bold text-text-primary text-sm truncate group-hover:text-brand transition-colors">{film.title}</div>
                            {film.is_featured && <Icon icon="solar:star-bold" className="w-3 h-3 text-brand" />}
                            {film.is_trending && <Icon icon="solar:fire-bold" className="w-3 h-3 text-amber-500" />}
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            <span className={`px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-tighter border ${film.content_type === 'series' ? 'bg-purple-500/10 text-purple-600 border-purple-500/20' : 'bg-surface-3 text-text-muted border-border'}`}>
                              {film.content_type || 'movie'}
                            </span>
                            {film.needs_review && (
                              <span className="px-1.5 py-0.5 rounded bg-red-500/10 text-red-600 text-[8px] font-black uppercase tracking-tighter border border-red-500/20">
                                Review Required
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-text-primary font-mono text-xs">{film.year || 'TBD'}</span>
                    </td>
                    <td className="px-6 py-4">
                      {film.countries && film.countries.length > 0 ? (
                        <div className="flex flex-wrap gap-1 max-w-[120px]">
                          {film.countries.map(c => (
                            <span key={c} className="px-1.5 py-0.5 rounded bg-surface-3 border border-border text-[9px] font-bold text-text-muted uppercase tracking-tighter whitespace-nowrap">
                              {c}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-[10px] text-text-muted opacity-50">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        {film.youtube_watch_url && (
                          <a href={film.youtube_watch_url} target="_blank" rel="noreferrer" className="w-8 h-8 flex items-center justify-center rounded-lg bg-red-500/10 text-red-600 hover:bg-red-500 hover:text-white transition-all shadow-sm" title="YouTube Play Link">
                            <Icon icon="solar:play-circle-bold" className="w-5 h-5" />
                          </a>
                        )}
                        {film.streaming_links?.netflix && (
                          <>
                            <a href={film.streaming_links.netflix} target="_blank" rel="noreferrer" className="w-8 h-8 flex items-center justify-center rounded-lg bg-slate-900 text-white hover:bg-black transition-all shadow-sm" title="Netflix Title Link">
                              <Icon icon="simple-icons:netflix" className="w-4 h-4" />
                            </a>
                            {film.streaming_links.netflix_watch && (
                              <a href={film.streaming_links.netflix_watch} target="_blank" rel="noreferrer" className="w-8 h-8 flex items-center justify-center rounded-lg bg-red-600/10 text-red-600 hover:bg-red-600 hover:text-white transition-all shadow-sm" title="Netflix Watch Link">
                                <Icon icon="solar:play-circle-bold" className="w-5 h-5" />
                              </a>
                            )}
                          </>
                        )}
                        {film.streaming_links?.prime_video && (
                          <a href={film.streaming_links.prime_video} target="_blank" rel="noreferrer" className="w-8 h-8 flex items-center justify-center rounded-lg bg-blue-500/10 text-blue-600 hover:bg-blue-600 hover:text-white transition-all shadow-sm" title="Prime Video Link">
                            <Icon icon="simple-icons:primevideo" className="w-5 h-5" />
                          </a>
                        )}
                        {film.streaming_links?.kava && (
                          <a href={film.streaming_links.kava} target="_blank" rel="noreferrer" className="w-8 h-8 flex items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 hover:bg-emerald-600 hover:text-white transition-all shadow-sm" title="Kava.tv Link">
                            <Icon icon="solar:video-library-bold" className="w-4 h-4" />
                          </a>
                        )}
                        {film.streaming_links?.iroko_tv && (
                          <a href={film.streaming_links.iroko_tv} target="_blank" rel="noreferrer" className="w-8 h-8 flex items-center justify-center rounded-lg bg-amber-500/10 text-amber-600 hover:bg-amber-600 hover:text-white transition-all shadow-sm" title="IrokoTV Link">
                            <Icon icon="solar:play-bold" className="w-4 h-4" />
                          </a>
                        )}
                        {film.streaming_links?.docuth && (
                          <a href={film.streaming_links.docuth} target="_blank" rel="noreferrer" className="w-8 h-8 flex items-center justify-center rounded-lg bg-zinc-900 text-white hover:bg-black transition-all shadow-sm" title="Docuth Link">
                            <Icon icon="solar:play-bold" className="w-4 h-4" />
                          </a>
                        )}
                        {!film.youtube_watch_url && !film.streaming_links?.netflix && !film.streaming_links?.prime_video && !film.streaming_links?.kava && !film.streaming_links?.iroko_tv && !film.streaming_links?.docuth && (
                          <span className="text-[10px] text-text-muted font-bold uppercase tracking-tighter opacity-40">Offline</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                       <div className="flex flex-col">
                         <span className="text-[10px] text-text-muted font-black uppercase tracking-widest leading-none mb-1">{(film.source || 'Manual').replace('_', ' ')}</span>
                         <span className="text-[10px] text-brand/60 font-bold">{film.release_type || 'Film'}</span>
                       </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="flex flex-col items-center gap-1.5">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                          film.status === 'released' ? 'bg-green-500/10 text-green-600 border-green-500/20' :
                          film.status === 'post-production' ? 'bg-blue-500/10 text-blue-600 border-blue-500/20' :
                          film.status === 'in_production' ? 'bg-amber-500/10 text-amber-600 border-amber-500/20' :
                          'bg-slate-500/10 text-slate-500 border-slate-500/20'
                        }`}>
                          {(film.status || 'unknown').replace('-', ' ')}
                        </span>
                        {(film.is_featured || film.is_trending) && (
                          <div className="flex gap-1">
                             {film.is_featured && <span className="w-1.5 h-1.5 rounded-full bg-brand animate-pulse" title="Featured"></span>}
                             {film.is_trending && <span className="w-1.5 h-1.5 rounded-full bg-blue-400" title="Trending"></span>}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="pr-6 py-4 text-right">
                      <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => toggleFeatured(film)}
                          className={`p-2 hover:bg-surface rounded-lg transition-all border border-transparent hover:border-border hover:shadow-sm ${film.is_featured ? 'text-brand' : 'text-text-muted hover:text-brand'}`}
                          title="Toggle Spotlight"
                        >
                          <Icon icon={film.is_featured ? "solar:star-bold" : "solar:star-linear"} className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleOpenDrawer(film)}
                          className="p-2 hover:bg-surface rounded-lg text-text-muted hover:text-brand transition-all border border-transparent hover:border-border hover:shadow-sm"
                          title="Edit Production"
                        >
                          <Icon icon="solar:pen-linear" className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setDeletingFilm(film)}
                          className="p-2 hover:bg-red-50 rounded-lg text-text-muted hover:text-red-600 transition-all border border-transparent hover:border-red-100 shadow-sm"
                          title="Delete Production"
                        >
                          <Icon icon="solar:trash-bin-trash-linear" className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                youtubeVideos.length === 0 ? (
                  <tr><td colSpan="6" className="p-20 text-center text-text-muted italic">No unmapped YouTube signals found.</td></tr>
                ) : youtubeVideos.map((vid) => (
                  <tr key={vid.id} className="group hover:bg-surface-2/50 transition-colors">
                    <td className="pl-6 py-4">
                       <Icon icon="solar:play-circle-bold" className="w-4 h-4 text-text-muted opacity-20" />
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-4">
                        <div className="w-16 h-10 bg-surface-2 rounded-md border border-border overflow-hidden flex-shrink-0 shadow-sm">
                          {vid.thumbnail_url && <img src={vid.thumbnail_url} alt="" className="w-full h-full object-cover" />}
                        </div>
                        <div className="min-w-0">
                          <p className="font-bold text-text-primary text-sm truncate group-hover:text-brand transition-colors">{vid.title}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <p className="text-[10px] text-text-muted font-bold uppercase tracking-widest">{vid.channels?.name || 'YouTube'}</p>
                            <span className="w-1 h-1 rounded-full bg-border"></span>
                            <p className="text-[10px] text-brand font-black tracking-widest">{formatDuration(vid.duration_seconds)}</p>
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold border bg-brand/5 text-brand border-brand/20 uppercase tracking-tighter">
                        Unmapped Signal
                      </span>
                    </td>
                    <td className="px-6 py-4">
                       <span className="text-[10px] text-text-muted opacity-50">-</span>
                    </td>
                    <td className="px-6 py-4">
                       <div className="text-[10px] text-text-muted font-bold uppercase">{new Date(vid.published_at).toLocaleDateString()}</div>
                    </td>
                    <td className="pr-6 py-4 text-right">
                        <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                           <button
                             onClick={() => {
                               setEditingFilm(null);
                               setFormData({
                                 ...initialFormState,
                                 title: vid.title,
                                 synopsis: vid.description || '',
                                 poster_url: vid.thumbnail_url || '',
                                 source_video_id: vid.video_id,
                                 youtube_watch_url: `https://www.youtube.com/watch?v=${vid.video_id}`,
                                 runtime_minutes: vid.duration_seconds ? Math.floor(vid.duration_seconds / 60) : '',
                                 status: 'released',
                                 channel_video_id: vid.id
                               });
                               setIsDrawerOpen(true);
                             }}
                             className="p-2 bg-brand/10 text-brand rounded-lg hover:bg-brand hover:text-white transition-all border border-brand/20 shadow-sm"
                             title="Create Film from Signal"
                           >
                              <Icon icon="solar:add-circle-linear" width="18" />
                           </button>
                           <button
                             onClick={() => handleIgnoreVideo(vid.id)}
                             className="p-2 bg-surface-2 text-text-muted hover:text-red-500 rounded-lg transition-all border border-border hover:border-red-200"
                             title="Dismiss Signal"
                           >
                              <Icon icon="solar:eye-closed-linear" width="18" />
                           </button>
                        </div>
                     </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        
        {/* Pagination Footer */}
          {(() => {
            const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
            const getPageNumbers = () => {
              const pages = [];
              if (totalPages <= 7) {
                for (let i = 1; i <= totalPages; i++) pages.push(i);
              } else {
                if (page <= 4) {
                  for (let i = 1; i <= 5; i++) pages.push(i);
                  pages.push('...');
                  pages.push(totalPages);
                } else if (page >= totalPages - 3) {
                  pages.push(1);
                  pages.push('...');
                  for (let i = totalPages - 4; i <= totalPages; i++) pages.push(i);
                } else {
                  pages.push(1);
                  pages.push('...');
                  pages.push(page - 1);
                  pages.push(page);
                  pages.push(page + 1);
                  pages.push('...');
                  pages.push(totalPages);
                }
              }
              return pages;
            };
  
            return (
              <div className="flex flex-col lg:flex-row items-center justify-between gap-4 px-6 py-6 border-t border-border bg-surface-2/30">
                <div className="text-xs font-bold text-text-muted uppercase tracking-widest text-center lg:text-left">
                  Showing <span className="text-text-primary">{totalCount === 0 ? 0 : (page - 1) * pageSize + 1}</span> to <span className="text-text-primary">{Math.min(page * pageSize, totalCount)}</span> of <span className="text-text-primary">{totalCount}</span> Items
                </div>
                
                <div className="flex flex-wrap items-center justify-center gap-1">
                  <button
                    onClick={() => setPage(1)}
                    disabled={page === 1 || loading}
                    className="px-3 py-2 text-xs font-bold text-text-primary rounded-md hover:bg-surface-2 disabled:opacity-30 disabled:cursor-not-allowed transition-all flex items-center gap-1"
                  >
                    <Icon icon="solar:double-alt-arrow-left-linear" width="16" />
                    First
                  </button>
                  <button
                    onClick={() => setPage(prev => Math.max(1, prev - 1))}
                    disabled={page === 1 || loading}
                    className="px-3 py-2 text-xs font-bold text-text-primary rounded-md hover:bg-surface-2 disabled:opacity-30 disabled:cursor-not-allowed transition-all flex items-center gap-1"
                  >
                    <Icon icon="solar:alt-arrow-left-linear" width="16" />
                    Prev
                  </button>
  
                  {getPageNumbers().map((p, i) => (
                    p === '...' ? (
                      <span key={`dots-${i}`} className="px-2 text-text-muted">...</span>
                    ) : (
                      <button
                        key={p}
                        onClick={() => setPage(p)}
                        className={`min-w-[32px] h-8 flex items-center justify-center rounded-md text-xs font-bold transition-all ${
                          page === p 
                            ? 'bg-brand text-white shadow-md' 
                            : 'text-text-primary hover:bg-surface-2'
                        }`}
                      >
                        {p}
                      </button>
                    )
                  ))}
  
                  <button
                    onClick={() => setPage(prev => (prev < totalPages ? prev + 1 : prev))}
                    disabled={page === totalPages || loading}
                    className="px-3 py-2 text-xs font-bold text-text-primary rounded-md hover:bg-surface-2 disabled:opacity-30 disabled:cursor-not-allowed transition-all flex items-center gap-1"
                  >
                    Next
                    <Icon icon="solar:alt-arrow-right-linear" width="16" />
                  </button>
                  <button
                    onClick={() => setPage(totalPages)}
                    disabled={page === totalPages || loading}
                    className="px-3 py-2 text-xs font-bold text-text-primary rounded-md hover:bg-surface-2 disabled:opacity-30 disabled:cursor-not-allowed transition-all flex items-center gap-1"
                  >
                    Last
                    <Icon icon="solar:double-alt-arrow-right-linear" width="16" />
                  </button>
  
                  <div className="flex items-center gap-2 ml-2 pl-2 lg:ml-4 lg:pl-4 border-l border-border">
                    <span className="text-xs font-bold text-text-muted">Go to</span>
                    <input 
                      key={page}
                      type="number" 
                      defaultValue={page}
                      min={1}
                      max={totalPages}
                      onBlur={(e) => {
                        const val = parseInt(e.target.value);
                        if (!isNaN(val) && val >= 1 && val <= totalPages) {
                          setPage(val);
                        } else {
                          e.target.value = page;
                        }
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          const val = parseInt(e.currentTarget.value);
                          if (!isNaN(val) && val >= 1 && val <= totalPages) {
                            setPage(val);
                          } else {
                            e.currentTarget.value = page;
                          }
                        }
                      }}
                      className="w-16 px-2 py-1 text-xs font-bold bg-surface border border-border rounded-md text-center focus:outline-none focus:border-brand text-text-primary"
                    />
                  </div>
                </div>
              </div>
            );
          })()}
        </div>

        <MergeModal
        isOpen={isMergeModalOpen}
        onClose={() => setIsMergeModalOpen(false)}
        items={films.filter(f => selectedFilmIds.includes(f.id))}
        onConfirm={handleMergeFilms}
        type="film"
      />      <Drawer
        isOpen={isDrawerOpen}
        onClose={handleCloseDrawer}
        title={editingFilm ? 'Edit Movie Profile' : 'Add New Movie'}
        width="800px"
      >
        {draftRestoredMessage && (
          <div className="bg-amber-500/10 border-b border-amber-500/20 px-6 py-3 flex items-center justify-between mb-4">
            <div className="flex items-center gap-2 text-amber-500">
              <Icon icon="lucide:history" className="w-4 h-4" />
              <span className="text-sm font-medium">{draftRestoredMessage}</span>
            </div>
            <button
              onClick={() => {
                clearDraft();
                setDraftRestoredMessage('');
                setIsDrawerOpen(false);
                setTimeout(() => handleOpenDrawer(editingFilm, true), 100);
              }}
              className="text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 py-1.5 rounded-lg transition-colors border border-slate-700 hover:border-slate-600"
            >
              Discard Draft
            </button>
          </div>
        )}
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
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-xs font-bold text-text-primary">Movie Title *</label>
                    <button
                      type="button"
                      onClick={handleAIPolishTitle}
                      disabled={isSummarizing}
                      className="text-[10px] font-bold text-brand bg-brand/5 border border-brand/20 px-3 py-1.5 rounded-full hover:bg-brand/10 active:scale-95 transition-all flex items-center gap-1.5"
                    >
                      <Icon icon="solar:magic-stick-bold" />
                      AI Polish
                    </button>
                  </div>
                  <input 
                    required 
                    name="title" 
                    value={formData.title} 
                    onChange={handleChange} 
                    className="w-full bg-surface-2 border border-border rounded-md px-4 py-2.5 text-sm text-text-primary focus:border-brand focus:ring-4 focus:ring-brand/5 outline-none transition-all" 
                    placeholder="Enter movie title..."
                  />
                </div>
                
                {/* Production Company Field */}
                <div className="relative">
                  <label className="block text-xs font-bold text-text-primary mb-2">Production Company</label>
                  <div className="relative group">
                    <input 
                      type="text"
                      value={companySearch}
                      onChange={(e) => handleCompanySearch(e.target.value)}
                      className="w-full bg-surface-2 border border-border rounded-md px-4 py-2.5 text-sm text-text-primary focus:border-brand focus:ring-4 focus:ring-brand/5 outline-none transition-all pr-12"
                      placeholder="Search or add company..."
                    />
                    <div className="absolute right-4 top-2.5 flex items-center gap-2">
                      {isSearchingCompanies ? (
                        <div className="w-4 h-4 border-2 border-brand/20 border-t-brand rounded-full animate-spin" />
                      ) : companySearch && !selectedCompany && (
                        <button
                          type="button"
                          onClick={() => createCompany(companySearch)}
                          className="p-1 hover:bg-brand/10 rounded-full text-brand transition-all"
                          title="Create and link this company"
                        >
                          <Icon icon="solar:add-circle-bold" className="w-5 h-5" />
                        </button>
                      )}
                      {!companySearch && (
                        <Icon icon="solar:buildings-linear" className="w-4 h-4 text-text-muted" />
                      )}
                      {selectedCompany && companySearch === selectedCompany.name && (
                        <Icon icon="solar:check-circle-bold" className="w-4 h-4 text-green-500" />
                      )}
                    </div>
                    
                    {companyResults.length > 0 && (
                      <div className="absolute left-0 top-full mt-2 w-full bg-surface border border-border rounded-md shadow-2xl z-50 overflow-hidden ring-1 ring-black/5 animate-in fade-in slide-in-from-top-2">
                        {companyResults.map(c => (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => {
                              setSelectedCompany(c);
                              setCompanySearch(c.name);
                              setCompanyResults([]);
                            }}
                            className="w-full flex items-center gap-3 p-3 hover:bg-surface-2 transition-colors text-left border-b border-border/50 last:border-0"
                          >
                            <div className="w-8 h-8 rounded-lg bg-surface-2 overflow-hidden border border-border flex items-center justify-center">
                              {c.logo_url ? (
                                <img src={c.logo_url} alt="" className="w-full h-full object-contain p-1" />
                              ) : (
                                <span className="text-[10px] font-bold text-brand">{c.name.charAt(0)}</span>
                              )}
                            </div>
                            <div>
                              <p className="text-xs font-bold text-text-primary">{c.name}</p>
                              <p className="text-[10px] text-text-muted">{c.website?.replace(/^https?:\/\//, '') || 'No website'}</p>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-text-primary mb-2">Release Year</label>
                    <input 
                      type="number" 
                      name="year" 
                      value={formData.year} 
                      onChange={handleChange} 
                      className="w-full bg-surface-2 border border-border rounded-md px-4 py-2.5 text-sm text-text-primary focus:border-brand focus:ring-4 focus:ring-brand/5 outline-none transition-all" 
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-text-primary mb-2">Content Type</label>
                    <select 
                      name="content_type" 
                      value={formData.content_type || 'movie'} 
                      onChange={handleChange} 
                      className="w-full bg-surface-2 border border-border rounded-md px-4 py-2.5 text-sm text-text-primary focus:border-brand focus:ring-4 focus:ring-brand/5 outline-none transition-all appearance-none cursor-pointer"
                    >
                      <option value="movie">Movie</option>
                      <option value="series">Series</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-text-primary mb-2">Status</label>
                    <select 
                      name="status" 
                      value={formData.status} 
                      onChange={handleChange} 
                      className="w-full bg-surface-2 border border-border rounded-md px-4 py-2.5 text-sm text-text-primary focus:border-brand focus:ring-4 focus:ring-brand/5 outline-none transition-all appearance-none cursor-pointer"
                    >
                      <option value="upcoming">Upcoming / Announced</option>
                      <option value="in_production">In Production / Filming</option>
                      <option value="post-production">Post-Production</option>
                      <option value="released">Released</option>
                    </select>
                  </div>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-xs font-bold text-text-primary">Story Synopsis</label>
                    <button
                      type="button"
                      onClick={handleAISummarize}
                      disabled={isSummarizing}
                      className="text-[10px] font-bold text-white bg-brand border border-brand/20 px-3 py-1.5 rounded-full hover:brightness-110 active:scale-95 transition-all flex items-center gap-1.5 shadow-lg shadow-brand/20"
                    >
                      {isSummarizing ? 'Generating...' : (
                        <>
                          <Icon icon="solar:stars-minimalistic-bold" />
                          AI Summarize
                        </>
                      )}
                    </button>
                  </div>
                  <textarea 
                    name="synopsis" 
                    rows="5" 
                    value={formData.synopsis} 
                    onChange={handleChange} 
                    className="w-full bg-surface-2 border border-border rounded-md px-4 py-2.5 text-sm text-text-primary focus:border-brand focus:ring-4 focus:ring-brand/5 outline-none transition-all resize-none leading-relaxed" 
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
                      <input name="tmdb_id" value={formData.tmdb_id || ''} onChange={handleChange} className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-xs text-text-primary focus:border-brand outline-none" />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-text-muted uppercase mb-1.5">Rating</label>
                      <input step="0.1" type="number" name="tmdb_rating" value={formData.tmdb_rating || ''} onChange={handleChange} className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-xs text-text-primary focus:border-brand outline-none" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-text-muted uppercase mb-1.5">Marketing Tagline</label>
                    <input name="tagline" value={formData.tagline || ''} onChange={handleChange} className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-xs text-text-primary focus:border-brand outline-none" placeholder="Catchy phrase..." />
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
                  <input name="poster_url" value={formData.poster_url} onChange={handleChange} className="w-full bg-surface-2 border border-border rounded-md px-4 py-2.5 text-sm text-text-primary focus:border-brand focus:ring-4 focus:ring-brand/5 outline-none transition-all" placeholder="https://" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-text-primary mb-2">Landscape Backdrop URL</label>
                  <input name="backdrop_url" value={formData.backdrop_url} onChange={handleChange} className="w-full bg-surface-2 border border-border rounded-md px-4 py-2.5 text-sm text-text-primary focus:border-brand focus:ring-4 focus:ring-brand/5 outline-none transition-all" placeholder="https://" />
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
                            checked={Array.isArray(formData.genres) && formData.genres.includes(genre.id)}
                            onChange={(e) => {
                              const checked = e.target.checked;
                              setFormData(prev => ({
                                ...prev,
                                genres: checked 
                                  ? [...(prev.genres || []), genre.id]
                                  : (prev.genres || []).filter(id => id !== genre.id)
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

                  <div className="flex items-center gap-6 pt-4 border-t border-border/50">
                    <label className="flex items-center gap-3 cursor-pointer group">
                      <div className="relative">
                        <input 
                          type="checkbox" 
                          name="is_featured" 
                          checked={formData.is_featured} 
                          onChange={(e) => setFormData({ ...formData, is_featured: e.target.checked })}
                          className="sr-only" 
                        />
                        <div className={`w-10 h-5 rounded-full transition-all ${formData.is_featured ? 'bg-brand' : 'bg-surface-muted border border-border'}`} />
                        <div className={`absolute top-1 w-3 h-3 rounded-full transition-all ${formData.is_featured ? 'left-6 bg-white' : 'left-1 bg-text-muted'}`} />
                      </div>
                      <span className="text-xs font-bold text-text uppercase tracking-wider group-hover:text-brand transition-colors">Featured</span>
                    </label>

                    <label className="flex items-center gap-3 cursor-pointer group">
                      <div className="relative">
                        <input 
                          type="checkbox" 
                          name="is_trending" 
                          checked={formData.is_trending} 
                          onChange={(e) => setFormData({ ...formData, is_trending: e.target.checked })}
                          className="sr-only" 
                        />
                        <div className={`w-10 h-5 rounded-full transition-all ${formData.is_trending ? 'bg-orange-500' : 'bg-surface-muted border border-border'}`} />
                        <div className={`absolute top-1 w-3 h-3 rounded-full transition-all ${formData.is_trending ? 'left-6 bg-white' : 'left-1 bg-text-muted'}`} />
                      </div>
                      <span className="text-xs font-bold text-text uppercase tracking-wider group-hover:text-orange-500 transition-colors">Trending</span>
                    </label>

                    <label className="flex items-center gap-3 cursor-pointer group">
                      <div className="relative">
                        <input 
                          type="checkbox" 
                          name="is_in_cinemas" 
                          checked={formData.is_in_cinemas} 
                          onChange={(e) => setFormData({ ...formData, is_in_cinemas: e.target.checked })}
                          className="sr-only" 
                        />
                        <div className={`w-10 h-5 rounded-full transition-all ${formData.is_in_cinemas ? 'bg-blue-500' : 'bg-surface-muted border border-border'}`} />
                        <div className={`absolute top-1 w-3 h-3 rounded-full transition-all ${formData.is_in_cinemas ? 'left-6 bg-white' : 'left-1 bg-text-muted'}`} />
                      </div>
                      <span className="text-xs font-bold text-text uppercase tracking-wider group-hover:text-blue-500 transition-colors">In Cinemas</span>
                    </label>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 pt-2">
                  <div>
                    <label className="block text-[10px] font-bold text-text-muted uppercase mb-2">Duration (Mins)</label>
                    <input type="number" name="runtime_minutes" value={formData.runtime_minutes} onChange={handleChange} className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-xs text-text-primary focus:border-brand outline-none" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-text-muted uppercase mb-2">Content Rating</label>
                    <select 
                      name="nfvcb_rating" 
                      value={formData.nfvcb_rating} 
                      onChange={handleChange} 
                      className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-xs text-text-primary focus:border-brand outline-none"
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
                    {['cinema', 'youtube', 'netflix', 'prime_video', 'kava', 'showmax', 'docuth', 'ebonylife'].map((type) => {
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
                      className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-xs text-text-primary focus:border-brand outline-none" 
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
                      { id: 'docuth', label: 'Docuth', placeholder: 'https://docuth.com/...' },
                      { id: 'ebonylife', label: 'EbonyLife', placeholder: 'https://ebonylifeonplus.com/...' },
                    ].map(platform => {
                      const isActive = (formData.streaming_links && platform.id in formData.streaming_links) || formData.release_type === platform.id;
                      if (!isActive) return null;

                      return (
                        <div key={platform.id} className="flex flex-col gap-3 animate-in fade-in slide-in-from-left-2">
                          <div className="flex flex-col gap-1.5">
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
                              className="w-full bg-surface-2 border border-border rounded-lg px-3 py-2 text-[10px] text-text-primary focus:border-brand outline-none"
                            />
                          </div>
                          
                          {platform.id === 'netflix' && (
                            <div className="flex flex-col gap-1.5">
                              <label className="text-[9px] font-bold text-text-muted uppercase tracking-wider">
                                Netflix Watch URL
                              </label>
                              <input
                                type="text"
                                value={formData.streaming_links?.netflix_watch || ''}
                                onChange={(e) => {
                                  setFormData({
                                    ...formData,
                                    streaming_links: {
                                      ...formData.streaming_links,
                                      netflix_watch: e.target.value
                                    }
                                  });
                                }}
                                placeholder="https://www.netflix.com/watch/..."
                                className="w-full bg-surface-2 border border-border rounded-lg px-3 py-2 text-[10px] text-text-primary focus:border-brand outline-none"
                              />
                            </div>
                          )}
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
                    className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-xs text-text-primary focus:border-brand outline-none" 
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
                  className="bg-surface-2 border border-border rounded-md px-4 py-2 text-xs w-full md:w-64 text-text-primary focus:border-brand outline-none transition-all pr-12"
                />
                <svg className="absolute right-4 top-2.5 w-4 h-4 text-text-muted group-focus-within:text-brand transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                {(isSearchingPeople || peopleResults.length > 0 || peopleSearch.trim()) && (
                  <div className="absolute right-0 top-full mt-2 w-full bg-surface border border-border rounded-md shadow-2xl z-20 overflow-hidden ring-1 ring-black/5 animate-in fade-in slide-in-from-top-2">
                    {isSearchingPeople ? (
                      <div className="p-8 text-center">
                        <div className="w-6 h-6 border-2 border-brand border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                        <p className="text-[10px] font-black text-text-muted uppercase tracking-widest">Searching Directory...</p>
                      </div>
                    ) : (
                      <>
                        {peopleResults.map(p => (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => addCredit(p)}
                            className="w-full flex items-center gap-3 p-3 hover:bg-surface-2 transition-colors text-left border-b border-border/50 last:border-0"
                          >
                            <div className="w-8 h-8 rounded-full bg-surface-2 overflow-hidden border border-border flex-shrink-0">
                              {p.photo_url && <img src={p.photo_url} alt="" className="w-full h-full object-cover" />}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-bold text-text-primary truncate">{p.name}</p>
                              <p className="text-[9px] text-text-muted font-bold uppercase tracking-tighter">Existing Record</p>
                            </div>
                          </button>
                        ))}
                        
                        {peopleSearch.trim() && !peopleResults.some(p => p.name.toLowerCase() === peopleSearch.trim().toLowerCase()) && (
                          <button
                            type="button"
                            onClick={() => createPerson(peopleSearch)}
                            className="w-full flex items-center gap-3 p-4 bg-brand/5 hover:bg-brand/10 transition-colors text-left border-t border-brand/20 group/add"
                          >
                            <div className="w-10 h-10 rounded-full bg-brand text-white flex items-center justify-center group-hover/add:scale-110 transition-transform shadow-lg shadow-brand/20">
                               <Icon icon="solar:plus-bold" className="w-5 h-5" />
                            </div>
                            <div className="flex-1">
                              <p className="text-[10px] font-black text-brand uppercase tracking-widest leading-none mb-1">New Identity</p>
                              <p className="text-xs font-bold text-text-primary">Create profile for "{peopleSearch}"</p>
                            </div>
                          </button>
                        )}
                      </>
                    )}
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
                        <div className="flex items-center gap-3 flex-wrap">
                          {credit.isCustomRole ? (
                            <div className="flex items-center gap-1">
                              <input
                                autoFocus
                                placeholder="Enter custom role..."
                                value={credit.tempRole || ''}
                                onChange={(e) => setCredits(prev => prev.map((c, i) => i === idx ? { ...c, tempRole: e.target.value } : c))}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    e.preventDefault();
                                    if (credit.tempRole?.trim()) {
                                      const newRole = credit.tempRole.trim().toLowerCase();
                                      if (!customRoles.includes(newRole)) setCustomRoles(prev => [...prev, newRole]);
                                      setCredits(prev => prev.map((c, i) => i === idx ? { ...c, role: newRole, isCustomRole: false, tempRole: '' } : c));
                                    }
                                  }
                                }}
                                className="bg-surface-2 border border-brand rounded-lg px-2 py-1 text-[10px] text-text-primary font-bold focus:border-brand outline-none uppercase min-w-[120px]"
                              />
                              <button 
                                type="button"
                                onClick={() => {
                                  if (credit.tempRole?.trim()) {
                                    const newRole = credit.tempRole.trim().toLowerCase();
                                    if (!customRoles.includes(newRole)) setCustomRoles(prev => [...prev, newRole]);
                                    setCredits(prev => prev.map((c, i) => i === idx ? { ...c, role: newRole, isCustomRole: false, tempRole: '' } : c));
                                  }
                                }}
                                className="p-1 hover:bg-brand/10 rounded-full text-brand transition-all"
                                title="Save Custom Role"
                              >
                                <Icon icon="solar:check-circle-bold" className="w-4 h-4" />
                              </button>
                              <button 
                                type="button"
                                onClick={() => setCredits(prev => prev.map((c, i) => i === idx ? { ...c, isCustomRole: false, role: 'actor', tempRole: '' } : c))}
                                className="text-text-muted hover:text-red-500 p-1"
                                title="Back to standard roles"
                              >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                              </button>
                            </div>
                          ) : (
                            <select
                              value={credit.role}
                              onChange={(e) => {
                                if (e.target.value === 'custom_role') {
                                  setCredits(prev => prev.map((c, i) => i === idx ? { ...c, role: '', isCustomRole: true } : c));
                                } else {
                                  setCredits(prev => prev.map((c, i) => i === idx ? { ...c, role: e.target.value } : c));
                                }
                              }}
                              className="bg-surface-2 border border-border rounded-lg px-2 py-1 text-[10px] text-text-primary font-bold focus:border-brand outline-none uppercase"
                            >
                              <option value="actor">Actor</option>
                              <option value="director">Director</option>
                              <option value="producer">Producer</option>
                              <option value="executive producer">Executive Producer</option>
                              <option value="writer">Writer</option>
                              <option value="cinematographer">Cinematographer (DOP)</option>
                              <option value="editor">Editor</option>
                              <option value="composer">Composer (Music)</option>
                              <option value="sound recordist">Sound Recordist</option>
                              <option value="production designer">Production Designer</option>
                              <option value="art director">Art Director</option>
                              <option value="makeup artist">Makeup Artist</option>
                              <option value="costume designer">Costume Designer</option>
                              <option value="gaffer">Gaffer</option>
                              <option value="continuity">Continuity</option>
                              <option value="production manager">Production Manager</option>
                              <option value="assistant director">Assistant Director</option>
                              <option value="colorist">Colorist</option>
                              <option value="vfx">VFX</option>
                              <option value="stunts">Stunts</option>
                              <option value="casting director">Casting Director</option>
                              <option value="location manager">Location Manager</option>
                              {customRoles.map(r => (
                                <option key={r} value={r}>{r}</option>
                              ))}
                              <option value="custom_role" className="text-brand font-black">+ Add Custom Role...</option>
                            </select>
                          )}
                          {(!credit.isCustomRole && credit.role === 'actor') && (
                            <input
                              placeholder="Role name..."
                              value={credit.character_name || ''}
                              onChange={(e) => setCredits(prev => prev.map((c, i) => i === idx ? { ...c, character_name: e.target.value } : c))}
                              className="bg-transparent border-b border-border text-[10px] text-text-primary font-medium px-2 py-1 outline-none focus:border-brand flex-1"
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

