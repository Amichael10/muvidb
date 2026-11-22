import React, { useState, useEffect, useRef } from 'react';
import { Icon } from '@iconify/react';
import toast from 'react-hot-toast';
import { Link } from 'react-router-dom';
import SEO from '../../components/SEO';
import PersonSearchInput from '../../components/admin/PersonSearchInput';
import { authHeaders } from '../../lib/apiAuth';
import { supabase } from '../../lib/supabase';
import { uploadAdminImage } from '../../lib/imageUpload';
import { extractCreditsWithLocalOCR, extractRawTextWithLocalOCR } from '../../utils/localCreditOcr';

const DESTINATIONS = [
  { id: 'film', label: 'Film / Movie', icon: 'solar:clapperboard-play-linear' },
  { id: 'play', label: 'Stage Play', icon: 'solar:mask-hamsa-linear' },
  { id: 'critic_review', label: 'Critic Review', icon: 'solar:chat-round-bold-linear' },
  { id: 'social_post', label: 'Social Draft', icon: 'solar:magic-stick-3-linear' },
];

const STANDARD_GENRES = [
  'Drama', 'Comedy', 'Thriller', 'Action', 'Romance', 'Horror', 'Crime',
  'Family', 'Epic', 'Mystery', 'Sci-Fi', 'Documentary', 'Animation'
];

const PLAY_GENRES = [
  'Drama', 'Musical', 'Tragedy', 'Comedy', 'Historical', 'Satire', 'Folklore', 'Dance Drama'
];

const FILM_CREW_ROLES = [
  { id: 'director', label: 'Director' },
  { id: 'producer', label: 'Producer' },
  { id: 'executive_producer', label: 'Executive Producer' },
  { id: 'writer', label: 'Writer / Screenplay' },
  { id: 'cinematographer', label: 'Cinematographer (DOP)' },
  { id: 'editor', label: 'Editor' },
  { id: 'sound', label: 'Sound Designer' },
  { id: 'costume', label: 'Costume Designer' },
  { id: 'production_designer', label: 'Production Designer' },
  { id: 'composer', label: 'Music Composer' },
  { id: 'casting', label: 'Casting Director' },
  { id: 'crew', label: 'Other Crew' },
];

const STAGE_CREW_ROLES = [
  { id: 'director', label: 'Stage Director' },
  { id: 'playwright', label: 'Playwright / Writer' },
  { id: 'producer', label: 'Producer / Company' },
  { id: 'stage_manager', label: 'Stage Manager' },
  { id: 'lighting', label: 'Lighting Designer' },
  { id: 'choreographer', label: 'Choreographer' },
  { id: 'costume', label: 'Costume & Wardrobe' },
  { id: 'sound', label: 'Sound & Music' },
  { id: 'crew', label: 'Stage Crew' },
];

// Helper to reliably preview images in browser without Instagram hotlinking blocks
export function getSafePreviewUrl(rawUrl) {
  if (!rawUrl) return '';
  if (rawUrl.startsWith('data:') || rawUrl.startsWith('blob:') || rawUrl.includes('supabase.co')) {
    return rawUrl;
  }
  if (/cdninstagram\.com|fbcdn\.net|instagram\.f/i.test(rawUrl)) {
    return `/api/media?url=${encodeURIComponent(rawUrl)}`;
  }
  return rawUrl;
}

export default function AdminIntake() {
  // Input & state
  const [url, setUrl] = useState('');
  const [manualCaption, setManualCaption] = useState('');
  const [showManualInput, setShowManualInput] = useState(false);
  const [isFetching, setIsFetching] = useState(false);

  // Extracted data
  const [postData, setPostData] = useState(null);
  const [selectedSlideIdx, setSelectedSlideIdx] = useState(0);
  const [showAddSlideUrlInput, setShowAddSlideUrlInput] = useState(false);
  const [newSlideUrl, setNewSlideUrl] = useState('');

  // Active destination tab
  const [activeTab, setActiveTab] = useState('film');

  // Mode for linking to existing film or creating new
  const [filmMode, setFilmMode] = useState('new'); // 'new' | 'link'
  const [linkedFilm, setLinkedFilm] = useState(null);
  const [filmSearchQuery, setFilmSearchQuery] = useState('');
  const [filmSearchResults, setFilmSearchResults] = useState([]);
  const [isSearchingFilms, setIsSearchingFilms] = useState(false);

  // Mode for linking to existing stage play
  const [playMode, setPlayMode] = useState('new'); // 'new' | 'link'
  const [linkedPlay, setLinkedPlay] = useState(null);
  const [playSearchQuery, setPlaySearchQuery] = useState('');
  const [playSearchResults, setPlaySearchResults] = useState([]);
  const [isSearchingPlays, setIsSearchingPlays] = useState(false);

  // Mention active crew dropdown index
  const [activeMentionDropdown, setActiveMentionDropdown] = useState(null);

  // Image upload / mirror states
  const [isMirroringPoster, setIsMirroringPoster] = useState(false);
  const [isMirroringBackdrop, setIsMirroringBackdrop] = useState(false);
  const [isUploadingPoster, setIsUploadingPoster] = useState(false);
  const [isUploadingBackdrop, setIsUploadingBackdrop] = useState(false);

  // OCR state
  const [isOcrProcessing, setIsOcrProcessing] = useState(false);
  const [ocrEngine, setOcrEngine] = useState('ai'); // 'ai' | 'local'
  const [ocrResult, setOcrResult] = useState(null);
  const [showOcrPanel, setShowOcrPanel] = useState(false);

  // Forms
  const [filmForm, setFilmForm] = useState({
    title: '',
    year: new Date().getFullYear(),
    release_date: '',
    synopsis: '',
    genres: ['Drama'],
    runtime_minutes: '',
    director: '',
    director_person_id: null,
    cast: [],
    crew: [],
    platform: 'Cinema',
    content_type: 'movie',
    poster_url: '',
    backdrop_url: '',
    trailer_external_url: '',
    status: 'upcoming',
    update_existing_film_id: null,
  });

  // Telegram Approval Inbox (shared with Social Studio)
  const [showTelegramInbox, setShowTelegramInbox] = useState(false);
  const [telegramItems, setTelegramItems] = useState([]);
  const [loadingTelegram, setLoadingTelegram] = useState(false);
  const [telegramFilter, setTelegramFilter] = useState('open'); // 'open' | 'all' | 'applied' | 'rejected'
  const [telegramSearch, setTelegramSearch] = useState('');
  const [activeTelegramItem, setActiveTelegramItem] = useState(null);

  const loadTelegramInbox = async () => {
    setLoadingTelegram(true);
    try {
      const headers = await authHeaders();
      const res = await fetch('/api/social?task=intake_list', { headers });
      const data = await res.json().catch(() => []);
      if (res.ok && Array.isArray(data)) {
        setTelegramItems(data);
      }
    } catch (err) {
      console.warn('Could not load Telegram inbox:', err);
    } finally {
      setLoadingTelegram(false);
    }
  };

  useEffect(() => {
    loadTelegramInbox();
  }, []);

  const openTelegramCount = telegramItems.filter(
    (item) => !['applied', 'approved', 'rejected'].includes(item.workflow_status)
  ).length;

  const filteredTelegramItems = telegramItems.filter((item) => {
    const statusOk =
      telegramFilter === 'all' ||
      (telegramFilter === 'open' && !['applied', 'approved', 'rejected'].includes(item.workflow_status)) ||
      item.workflow_status === telegramFilter;
    if (!statusOk) return false;
    if (!telegramSearch.trim()) return true;
    const q = telegramSearch.trim().toLowerCase();
    return (
      (item.title || '').toLowerCase().includes(q) ||
      (item.description || '').toLowerCase().includes(q) ||
      (item.source_url || '').toLowerCase().includes(q) ||
      (item.metadata?.from_user || '').toLowerCase().includes(q)
    );
  });

  const handleLoadTelegramItem = (item) => {
    const payload = item.extracted_payload || item.metadata?.extracted_payload || {};
    const itemUrl = item.source_url || '';
    const caption = item.description || item.metadata?.raw_text || '';
    const imageUrl = item.metadata?.image_url || '';

    setActiveTelegramItem(item);
    setUrl(itemUrl);
    setManualCaption(caption);
    if (caption) setShowManualInput(true);
    setPublishResult(null);

    const mediaList = imageUrl
      ? [{ url: imageUrl, type: 'image', isPrimary: true }]
      : [];

    setPostData({
      success: true,
      platform: /instagram\.com/i.test(itemUrl)
        ? 'instagram'
        : /facebook\.com|fb\.watch/i.test(itemUrl)
          ? 'facebook'
          : /youtu/i.test(itemUrl)
            ? 'youtube'
            : 'telegram',
      sourceUrl: itemUrl,
      caption,
      authorName: item.metadata?.author_name || item.metadata?.from_user || '',
      authorUsername: item.metadata?.author_name || '',
      media: mediaList,
      mentions: [],
    });
    setSelectedSlideIdx(0);

    const parsedCast = Array.isArray(payload.cast)
      ? payload.cast.map((c) =>
          typeof c === 'string'
            ? { name: c, character_name: '', person_id: null }
            : { name: c?.name || '', character_name: c?.character_name || '', person_id: c?.person_id || null }
        ).filter((c) => c.name)
      : [];

    const parsedCrew = [];
    if (payload.director) {
      parsedCrew.push({ name: payload.director, role: 'director', person_id: null });
    }
    if (Array.isArray(payload.crew)) {
      payload.crew.forEach((c) => {
        if (c?.name) parsedCrew.push({ name: c.name, role: c.role || 'crew', person_id: c.person_id || null });
      });
    }

    setFilmForm((prev) => ({
      ...prev,
      title: payload.title || item.title?.replace(/\s+on\s+Instagram.*$/i, '') || '',
      year: payload.year || new Date().getFullYear(),
      release_date: payload.release_date || '',
      synopsis: payload.synopsis || caption || '',
      genres: Array.isArray(payload.genres) && payload.genres.length ? payload.genres : ['Drama'],
      runtime_minutes: payload.runtime_minutes || '',
      director: payload.director || '',
      director_person_id: null,
      cast: parsedCast,
      crew: parsedCrew,
      platform: payload.platform || 'Cinema',
      content_type: payload.content_type || 'movie',
      poster_url: imageUrl || '',
      backdrop_url: '',
      trailer_external_url: /youtu(?:\.be|be\.com)/i.test(itemUrl) ? itemUrl : '',
      status: 'upcoming',
      update_existing_film_id: null,
    }));

    setPlayForm((prev) => ({
      ...prev,
      id: null,
      title: payload.title || '',
      year: payload.year || new Date().getFullYear(),
      director: payload.director || '',
      synopsis: payload.synopsis || caption || '',
      poster_url: imageUrl || '',
      banner_url: '',
      source_url: itemUrl,
      cast: parsedCast,
      crew: parsedCrew,
    }));

    setReviewForm((prev) => ({
      ...prev,
      film_title: payload.film_title || payload.title || '',
      critic_name: payload.critic_name || item.metadata?.author_name || '',
      publication: payload.publication || '',
      quote: payload.quote || caption.slice(0, 300),
      rating: payload.rating ?? 8,
      review_url: itemUrl,
    }));

    setSocialForm({
      headline: payload.title || item.title || '',
      instagram_caption: caption,
      facebook_caption: caption,
      threads_post: caption.slice(0, 480),
      imageUrl: imageUrl || '',
    });

    const detectedKind = item.intake_kind || item.metadata?.extracted_kind || 'film';
    if (detectedKind === 'critic_review') setActiveTab('critic_review');
    else if (detectedKind === 'social_post' || detectedKind === 'news') setActiveTab('social_post');
    else setActiveTab('film');

    setShowTelegramInbox(false);
    toast.success('Loaded Telegram item into Creator! Click "Fetch Post" if you also want to re-scrape carousel slides.');
  };

  const handleRejectTelegramItem = async (item) => {
    try {
      const headers = await authHeaders();
      const res = await fetch('/api/social?task=intake_reject', {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ intakeId: item.id, reason: 'Dismissed from Social Intake' }),
      });
      if (!res.ok) throw new Error('Could not reject item');
      toast.success('Telegram item dismissed');
      if (activeTelegramItem?.id === item.id) setActiveTelegramItem(null);
      await loadTelegramInbox();
    } catch (err) {
      toast.error(err.message || 'Could not reject Telegram item');
    }
  };

  const [playForm, setPlayForm] = useState({
    id: null,
    title: '',
    year: new Date().getFullYear(),
    venue: 'Terra Kulture, Victoria Island',
    city: 'Lagos',
    country: 'Nigeria',
    run_start_date: '',
    run_end_date: '',
    performance_time: '3:00 PM & 7:00 PM',
    playwright: '',
    director: '',
    producer: '',
    genre: 'Drama',
    synopsis: '',
    status: 'upcoming',
    poster_url: '',
    banner_url: '',
    source_url: '',
    cast: [],
    crew: [],
  });

  const [reviewForm, setReviewForm] = useState({
    targetType: 'film', // 'film' | 'play'
    film_title: '',
    film_id: '',
    play_id: '',
    critic_name: '',
    publication: '',
    quote: '',
    rating: 8,
    rating_scale: 10,
    review_url: '',
    is_anonymous: false,
    is_featured: true,
  });

  const [socialForm, setSocialForm] = useState({
    headline: '',
    instagram_caption: '',
    facebook_caption: '',
    threads_post: '',
    imageUrl: '',
  });

  // Publishing state
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishResult, setPublishResult] = useState(null);

  // Instagram scout session state
  const [igSessionStatus, setIgSessionStatus] = useState(null);
  const [isCheckingIgSession, setIsCheckingIgSession] = useState(false);

  const checkIgSession = async () => {
    setIsCheckingIgSession(true);
    try {
      const headers = await authHeaders();
      const res = await fetch('/api/social?task=instagram_session_status', { headers });
      if (res.ok) {
        const data = await res.json();
        setIgSessionStatus(data);
      }
    } catch (err) {
      console.warn('Could not check IG session:', err);
    } finally {
      setIsCheckingIgSession(false);
    }
  };

  useEffect(() => {
    checkIgSession();
  }, []);

  // Live person lookup for director / cast
  const [personSearchQuery, setPersonSearchQuery] = useState('');
  const [personSearchResults, setPersonSearchResults] = useState([]);
  const [isSearchingPeople, setIsSearchingPeople] = useState(false);
  const [activePersonField, setActivePersonField] = useState(null); // 'director' | 'cast_add'

  // Live search existing film in MuviDB to link / enrich
  useEffect(() => {
    if (!filmSearchQuery.trim() || filmSearchQuery.trim().length < 2) {
      setFilmSearchResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setIsSearchingFilms(true);
      try {
        const { data } = await supabase
          .from('films')
          .select('id, title, year, poster_url, backdrop_url, synopsis, runtime_minutes, genres, slug')
          .ilike('title', `%${filmSearchQuery.trim()}%`)
          .limit(8);
        setFilmSearchResults(data || []);
      } catch (err) {
        console.warn('Search films error:', err);
      } finally {
        setIsSearchingFilms(false);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [filmSearchQuery]);

  const handleSelectExistingFilm = async (film) => {
    setLinkedFilm(film);
    setFilmForm(prev => ({
      ...prev,
      title: film.title,
      year: film.year || prev.year,
      synopsis: prev.synopsis || film.synopsis || '',
      genres: film.genres?.length ? film.genres : prev.genres,
      runtime_minutes: film.runtime_minutes || prev.runtime_minutes,
      poster_url: prev.poster_url || film.poster_url || '',
      backdrop_url: prev.backdrop_url || film.backdrop_url || '',
      update_existing_film_id: film.id,
    }));
    setFilmSearchResults([]);
    setFilmSearchQuery('');

    // Fetch existing credits from DB so user can see and enrich
    try {
      const { data: creds } = await supabase
        .from('credits')
        .select('id, role, character_name, people(id, name)')
        .eq('film_id', film.id);

      if (creds && creds.length > 0) {
        const existingCast = creds.filter(c => c.role === 'actor').map(c => ({
          name: c.people?.name || '',
          person_id: c.people?.id || null,
          character_name: c.character_name || '',
          isExisting: true,
        })).filter(c => c.name);

        const existingCrew = creds.filter(c => c.role !== 'actor').map(c => ({
          name: c.people?.name || '',
          person_id: c.people?.id || null,
          role: c.role || 'crew',
          isExisting: true,
        })).filter(c => c.name);

        setFilmForm(prev => {
          const castMap = new Map();
          (prev.cast || []).forEach(c => {
            const name = typeof c === 'string' ? c : c.name;
            if (name) castMap.set(name.toLowerCase(), typeof c === 'string' ? { name, character_name: '' } : c);
          });
          existingCast.forEach(c => {
            if (!castMap.has(c.name.toLowerCase())) {
              castMap.set(c.name.toLowerCase(), c);
            }
          });

          const crewMap = new Map();
          (prev.crew || []).forEach(c => {
            if (c.name) crewMap.set(`${c.name.toLowerCase()}-${c.role}`, c);
          });
          existingCrew.forEach(c => {
            const key = `${c.name.toLowerCase()}-${c.role}`;
            if (!crewMap.has(key)) crewMap.set(key, c);
          });

          return {
            ...prev,
            cast: Array.from(castMap.values()),
            crew: Array.from(crewMap.values()),
          };
        });
        toast.success(`Linked to existing film "${film.title}"! Loaded credits.`);
      } else {
        toast.success(`Linked to existing film "${film.title}"!`);
      }
    } catch (err) {
      console.warn('Could not load existing credits:', err);
      toast.success(`Linked to existing film "${film.title}"!`);
    }
  };

  const handleUnlinkFilm = () => {
    setLinkedFilm(null);
    setFilmForm(prev => ({ ...prev, update_existing_film_id: null }));
    toast('Unlinked. In new film mode.');
  };

  // Live search existing stage play in MuviDB
  useEffect(() => {
    if (!playSearchQuery.trim() || playSearchQuery.trim().length < 2) {
      setPlaySearchResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setIsSearchingPlays(true);
      try {
        const { data } = await supabase
          .from('plays')
          .select('id, title, year, venue, city, country, poster_url, banner_url, playwright, director, producer, synopsis, genre, run_start_date, run_end_date, status, slug')
          .ilike('title', `%${playSearchQuery.trim()}%`)
          .limit(8);
        setPlaySearchResults(data || []);
      } catch (err) {
        console.warn('Search plays error:', err);
      } finally {
        setIsSearchingPlays(false);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [playSearchQuery]);

  const handleSelectExistingPlay = async (play) => {
    setLinkedPlay(play);
    setPlayForm(prev => ({
      ...prev,
      id: play.id,
      title: play.title,
      year: play.year || prev.year,
      venue: play.venue || prev.venue,
      city: play.city || prev.city,
      country: play.country || prev.country,
      playwright: play.playwright || prev.playwright,
      director: play.director || prev.director,
      producer: play.producer || prev.producer,
      genre: play.genre || prev.genre,
      synopsis: prev.synopsis || play.synopsis || '',
      status: play.status || prev.status,
      run_start_date: play.run_start_date || prev.run_start_date,
      run_end_date: play.run_end_date || prev.run_end_date,
      poster_url: prev.poster_url || play.poster_url || '',
      banner_url: prev.banner_url || play.banner_url || '',
    }));
    setPlaySearchResults([]);
    setPlaySearchQuery('');

    try {
      const { data: creds } = await supabase
        .from('stage_credits')
        .select('id, role, character_name, people(id, name)')
        .eq('play_id', play.id);

      if (creds && creds.length > 0) {
        const existingCast = creds.filter(c => c.role === 'actor').map(c => ({
          name: c.people?.name || '',
          person_id: c.people?.id || null,
          character_name: c.character_name || '',
          isExisting: true,
        })).filter(c => c.name);

        const existingCrew = creds.filter(c => c.role !== 'actor').map(c => ({
          name: c.people?.name || '',
          person_id: c.people?.id || null,
          role: c.role || 'crew',
          isExisting: true,
        })).filter(c => c.name);

        setPlayForm(prev => ({
          ...prev,
          cast: [...(prev.cast || []), ...existingCast],
          crew: [...(prev.crew || []), ...existingCrew],
        }));
        toast.success(`Linked to stage play "${play.title}"!`);
      } else {
        toast.success(`Linked to stage play "${play.title}"!`);
      }
    } catch (err) {
      console.warn('Could not load stage credits:', err);
      toast.success(`Linked to stage play "${play.title}"!`);
    }
  };

  const handleUnlinkPlay = () => {
    setLinkedPlay(null);
    setPlayForm(prev => ({ ...prev, id: null }));
    toast('Unlinked from stage play.');
  };

  // Reset all
  const handleReset = () => {
    setUrl('');
    setManualCaption('');
    setPostData(null);
    setSelectedSlideIdx(0);
    setOcrResult(null);
    setShowOcrPanel(false);
    setPublishResult(null);
    setLinkedFilm(null);
    setLinkedPlay(null);
    setFilmMode('new');
    setPlayMode('new');
    setActiveMentionDropdown(null);
    setFilmForm({
      title: '',
      year: new Date().getFullYear(),
      release_date: '',
      synopsis: '',
      genres: ['Drama'],
      runtime_minutes: '',
      director: '',
      cast: [],
      crew: [],
      platform: 'Cinema',
      content_type: 'movie',
      poster_url: '',
      backdrop_url: '',
      trailer_external_url: '',
      status: 'upcoming',
      update_existing_film_id: null,
    });
    setPlayForm({
      id: null,
      title: '',
      year: new Date().getFullYear(),
      venue: 'Terra Kulture, Victoria Island',
      city: 'Lagos',
      country: 'Nigeria',
      run_start_date: '',
      run_end_date: '',
      performance_time: '3:00 PM & 7:00 PM',
      playwright: '',
      director: '',
      producer: '',
      genre: 'Drama',
      synopsis: '',
      status: 'upcoming',
      poster_url: '',
      banner_url: '',
      source_url: '',
      cast: [],
      crew: [],
    });
    setReviewForm({
      targetType: 'film',
      film_title: '',
      film_id: '',
      play_id: '',
      critic_name: '',
      publication: '',
      quote: '',
      rating: 8,
      rating_scale: 10,
      review_url: '',
      is_anonymous: false,
      is_featured: true,
    });
  };

  // Set as Poster with server-side mirror for ephemeral social links
  const handleSetAsPoster = async (slideUrl) => {
    if (!slideUrl) return;
    if (/cdninstagram\.com|fbcdn\.net|instagram\.f/i.test(slideUrl)) {
      setIsMirroringPoster(true);
      const toastId = toast.loading('Mirroring & saving poster to Supabase Storage…');
      try {
        const headers = await authHeaders();
        const res = await fetch('/api/social?task=mirror_social_image', {
          method: 'POST',
          headers,
          body: JSON.stringify({ url: slideUrl, bucket: 'posters' }),
        });
        const data = await res.json();
        if (res.ok && data.url) {
          setFilmForm(prev => ({ ...prev, poster_url: data.url }));
          setPlayForm(prev => ({ ...prev, poster_url: data.url }));
          setSocialForm(prev => ({ ...prev, imageUrl: data.url }));
          toast.success('Poster saved permanently to Supabase Storage!', { id: toastId });
          return;
        }
      } catch (err) {
        console.warn('Immediate mirror failed:', err);
      } finally {
        setIsMirroringPoster(false);
      }
      toast.dismiss(toastId);
    }
    setFilmForm(prev => ({ ...prev, poster_url: slideUrl }));
    setPlayForm(prev => ({ ...prev, poster_url: slideUrl }));
    setSocialForm(prev => ({ ...prev, imageUrl: slideUrl }));
    toast.success(`Slide ${selectedSlideIdx + 1} set as Poster!`);
  };

  // Set as Backdrop with server-side mirror
  const handleSetAsBackdrop = async (slideUrl) => {
    if (!slideUrl) return;
    if (/cdninstagram\.com|fbcdn\.net|instagram\.f/i.test(slideUrl)) {
      setIsMirroringBackdrop(true);
      const toastId = toast.loading('Mirroring & saving backdrop to Supabase Storage…');
      try {
        const headers = await authHeaders();
        const res = await fetch('/api/social?task=mirror_social_image', {
          method: 'POST',
          headers,
          body: JSON.stringify({ url: slideUrl, bucket: 'backdrops' }),
        });
        const data = await res.json();
        if (res.ok && data.url) {
          setFilmForm(prev => ({ ...prev, backdrop_url: data.url }));
          setPlayForm(prev => ({ ...prev, banner_url: data.url }));
          toast.success('Backdrop saved permanently to Supabase Storage!', { id: toastId });
          return;
        }
      } catch (err) {
        console.warn('Immediate mirror failed:', err);
      } finally {
        setIsMirroringBackdrop(false);
      }
      toast.dismiss(toastId);
    }
    setFilmForm(prev => ({ ...prev, backdrop_url: slideUrl }));
    setPlayForm(prev => ({ ...prev, banner_url: slideUrl }));
    toast.success(`Slide ${selectedSlideIdx + 1} set as Backdrop!`);
  };

  // Direct upload custom poster from local device
  const handleCustomPosterUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploadingPoster(true);
    const toastId = toast.loading('Uploading custom poster to Supabase…');
    try {
      const { url: publicUrl, error } = await uploadAdminImage(file, 'posters');
      if (error) throw new Error(error);
      setFilmForm(prev => ({ ...prev, poster_url: publicUrl }));
      setPlayForm(prev => ({ ...prev, poster_url: publicUrl }));
      setSocialForm(prev => ({ ...prev, imageUrl: publicUrl }));
      toast.success('Custom poster uploaded to Supabase Storage!', { id: toastId });
    } catch (err) {
      toast.error(err.message || 'Poster upload failed', { id: toastId });
    } finally {
      setIsUploadingPoster(false);
      e.target.value = '';
    }
  };

  // Direct upload custom backdrop from local device
  const handleCustomBackdropUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploadingBackdrop(true);
    const toastId = toast.loading('Uploading custom backdrop to Supabase…');
    try {
      const { url: publicUrl, error } = await uploadAdminImage(file, 'backdrops');
      if (error) throw new Error(error);
      setFilmForm(prev => ({ ...prev, backdrop_url: publicUrl }));
      setPlayForm(prev => ({ ...prev, banner_url: publicUrl }));
      toast.success('Custom backdrop uploaded to Supabase Storage!', { id: toastId });
    } catch (err) {
      toast.error(err.message || 'Backdrop upload failed', { id: toastId });
    } finally {
      setIsUploadingBackdrop(false);
      e.target.value = '';
    }
  };

  // Fetch post media & caption
  const handleFetchPost = async () => {
    if (!url.trim() && !manualCaption.trim()) {
      toast.error('Please enter a post URL or paste a caption.');
      return;
    }

    setIsFetching(true);
    setPublishResult(null);

    try {
      const headers = await authHeaders();
      const res = await fetch('/api/social?task=social_intake_extract', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          url: url.trim(),
          caption: manualCaption.trim() || undefined,
          runOcr: false,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to extract post details.');

      setPostData(data);
      setSelectedSlideIdx(0);

      // Populate film form
      const filmSug = data.suggestions?.film || {};
      const primaryPoster = data.media?.find(m => m.type === 'image' && m.isPrimary)?.url || data.media?.find(m => m.type === 'image')?.url || '';
      const secondaryBackdrop = data.media?.filter(m => m.type === 'image')?.[1]?.url || '';

      const detectedCrew = [];
      if (filmSug.director) detectedCrew.push({ name: filmSug.director, role: 'director' });
      if (Array.isArray(filmSug.crew)) {
        filmSug.crew.forEach(c => {
          if (c.name && !detectedCrew.some(x => x.name.toLowerCase() === c.name.toLowerCase() && x.role === c.role)) {
            detectedCrew.push({ name: c.name, role: c.role || 'crew' });
          }
        });
      }

      setFilmForm({
        title: filmSug.title || '',
        year: filmSug.year || new Date().getFullYear(),
        release_date: filmSug.release_date || '',
        synopsis: filmSug.synopsis || data.caption || '',
        genres: filmSug.genres?.length ? filmSug.genres : ['Drama'],
        runtime_minutes: filmSug.runtime_minutes || '',
        director: filmSug.director || '',
        cast: Array.isArray(filmSug.cast) ? filmSug.cast : [],
        crew: detectedCrew,
        platform: filmSug.platform || 'Cinema',
        content_type: filmSug.content_type || 'movie',
        poster_url: primaryPoster,
        backdrop_url: secondaryBackdrop,
        trailer_external_url: /youtu(?:\.be|be\.com)/i.test(url) ? url : '',
        status: 'upcoming',
        update_existing_film_id: null,
      });

      // Populate stage play form
      const playSug = data.suggestions?.play || {};
      const stageCrew = [];
      if (playSug.director) stageCrew.push({ name: playSug.director, role: 'director' });
      if (playSug.playwright) stageCrew.push({ name: playSug.playwright, role: 'playwright' });
      if (playSug.producer) stageCrew.push({ name: playSug.producer, role: 'producer' });

      setPlayForm({
        id: null,
        title: playSug.title || filmSug.title || '',
        year: playSug.year || new Date().getFullYear(),
        venue: playSug.venue || 'Terra Kulture, Victoria Island',
        city: playSug.city || 'Lagos',
        country: playSug.country || 'Nigeria',
        run_start_date: playSug.run_start_date || '',
        run_end_date: playSug.run_end_date || '',
        performance_time: playSug.performance_time || '3:00 PM & 7:00 PM',
        playwright: playSug.playwright || '',
        director: playSug.director || filmSug.director || '',
        producer: playSug.producer || '',
        genre: playSug.genre || 'Drama',
        synopsis: playSug.synopsis || data.caption || '',
        status: playSug.status || 'upcoming',
        poster_url: primaryPoster,
        banner_url: secondaryBackdrop,
        source_url: url || '',
        cast: [],
        crew: stageCrew,
      });

      // Populate review form
      const revSug = data.suggestions?.review || {};
      setReviewForm(prev => ({
        ...prev,
        film_title: revSug.film_title || filmSug.title || '',
        critic_name: revSug.critic_name || data.authorName || '',
        publication: revSug.publication || data.authorUsername || '',
        quote: revSug.quote || (data.caption ? data.caption.slice(0, 300) : ''),
        rating: revSug.rating ?? 8,
        rating_scale: revSug.rating_scale || 10,
        review_url: url || '',
      }));

      // Populate social form
      const socSug = data.suggestions?.social || {};
      setSocialForm({
        headline: socSug.headline || filmSug.title || '',
        instagram_caption: socSug.instagram_caption || data.caption || '',
        facebook_caption: socSug.facebook_caption || data.caption || '',
        threads_post: socSug.threads_post || (data.caption ? data.caption.slice(0, 480) : ''),
        imageUrl: primaryPoster,
      });

      toast.success(`Fetched post with ${data.media?.length || 0} media assets and ${data.mentions?.length || 0} resolved mentions!`);
    } catch (err) {
      console.error(err);
      toast.error(err.message || 'Error extracting post details.');
    } finally {
      setIsFetching(false);
    }
  };

  // Run OCR on current selected slide
  const handleRunOcrOnSlide = async (slideUrl) => {
    const targetUrl = slideUrl || postData?.media?.[selectedSlideIdx]?.url;
    if (!targetUrl) {
      toast.error('No slide image available to scan.');
      return;
    }

    setIsOcrProcessing(true);
    setShowOcrPanel(true);

    try {
      if (ocrEngine === 'local') {
        // Run client-side Tesseract.js
        toast.loading('Running Free Local OCR in browser…', { id: 'ocr-run' });
        const credits = await extractCreditsWithLocalOCR(targetUrl, 'cast');
        const rawText = await extractRawTextWithLocalOCR(targetUrl);
        const result = {
          rawText: rawText || 'Extracted via Local OCR',
          cast: credits.map(c => ({ name: c.name, character_name: c.role_or_character })),
          crew: [],
        };
        setOcrResult(result);
        toast.success(`Local OCR complete! Found ${credits.length} cast names.`, { id: 'ocr-run' });
      } else {
        // Run Server AI Vision OCR
        toast.loading('Scanning poster with AI Vision…', { id: 'ocr-run' });
        const headers = await authHeaders();
        const res = await fetch('/api/social?task=social_intake_ocr', {
          method: 'POST',
          headers,
          body: JSON.stringify({ imageUrl: targetUrl }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Vision OCR failed.');

        setOcrResult(data);
        toast.success(`AI Vision OCR complete! Extracted ${data.cast?.length || 0} cast and ${data.crew?.length || 0} crew members.`, { id: 'ocr-run' });
      }
    } catch (err) {
      console.error('OCR Error:', err);
      toast.error(err.message || 'OCR extraction failed.', { id: 'ocr-run' });
    } finally {
      setIsOcrProcessing(false);
    }
  };

  // Merge OCR cast into the film cast
  const handleApplyOcrToCast = () => {
    if (!ocrResult?.cast?.length) {
      toast.error('No cast items found in OCR result.');
      return;
    }

    const currentCast = [...(filmForm.cast || [])];
    const existingNames = new Set(currentCast.map(c => (typeof c === 'string' ? c : c.name).toLowerCase().trim()));

    let addedCount = 0;
    for (const item of ocrResult.cast) {
      if (!item.name || !item.name.trim()) continue;
      const lower = item.name.toLowerCase().trim();
      if (!existingNames.has(lower)) {
        currentCast.push({
          name: item.name.trim(),
          character_name: item.character_name ? item.character_name.trim() : null,
        });
        existingNames.add(lower);
        addedCount++;
      }
    }

    // Also check crew for Director
    const directorEntry = ocrResult.crew?.find(c => /director/i.test(c.role));
    if (directorEntry?.name && !filmForm.director) {
      setFilmForm(prev => ({ ...prev, director: directorEntry.name.trim() }));
    }

    setFilmForm(prev => ({ ...prev, cast: currentCast }));
    toast.success(`Merged ${addedCount} new cast members from OCR billing block!`);
  };

  // Add mention directly to cast
  const handleAddMentionToCast = (mention) => {
    const nameToAdd = (mention.resolvedName || mention.handle.replace(/^@+/, '')).trim();
    if (!nameToAdd) return;
    const personId = mention.personId || null;
    const currentCast = [...(filmForm.cast || [])];
    const exists = currentCast.some(
      (c) =>
        (personId && c.person_id && c.person_id === personId) ||
        (typeof c === 'string' ? c : c.name).toLowerCase() === nameToAdd.toLowerCase()
    );

    if (exists) {
      toast.error(`${nameToAdd} is already in the cast list.`);
      return;
    }

    currentCast.push({ name: nameToAdd, person_id: personId, character_name: '' });
    setFilmForm(prev => ({ ...prev, cast: currentCast }));
    toast.success(`Added ${nameToAdd} to Cast!`);
  };

  // Set mention as director
  const handleSetMentionAsDirector = (mention) => {
    const name = (mention.resolvedName || mention.handle.replace(/^@+/, '')).trim();
    if (!name) return;
    const personId = mention.personId || null;
    setFilmForm(prev => {
      const crew = [...(prev.crew || [])];
      if (!crew.some(c => c.name.toLowerCase() === name.toLowerCase() && c.role === 'director')) {
        crew.push({ name, person_id: personId, role: 'director' });
      }
      return { ...prev, director: name, director_person_id: personId, crew };
    });
    setPlayForm(prev => {
      const crew = [...(prev.crew || [])];
      if (!crew.some(c => c.name.toLowerCase() === name.toLowerCase() && c.role === 'director')) {
        crew.push({ name, person_id: personId, role: 'director' });
      }
      return { ...prev, director: name, crew };
    });
    toast.success(`Set ${name} as Director!`);
  };

  // Set mention as playwright
  const handleSetMentionAsPlaywright = (mention) => {
    const name = (mention.resolvedName || mention.handle.replace(/^@+/, '')).trim();
    if (!name) return;
    const personId = mention.personId || null;
    setPlayForm(prev => {
      const crew = [...(prev.crew || [])];
      if (!crew.some(c => c.name.toLowerCase() === name.toLowerCase() && c.role === 'playwright')) {
        crew.push({ name, person_id: personId, role: 'playwright' });
      }
      return { ...prev, playwright: name, crew };
    });
    toast.success(`Set ${name} as Playwright!`);
  };

  // Generic mention role assignment
  const handleAddMentionToRole = (mention, roleId) => {
    const name = (mention.resolvedName || mention.handle.replace(/^@+/, '')).trim();
    if (!name) return;
    const personId = mention.personId || null;

    if (activeTab === 'play') {
      if (roleId === 'actor') {
        const currentCast = [...(playForm.cast || [])];
        if (currentCast.some(c => (personId && c.person_id === personId) || (c.name || '').toLowerCase() === name.toLowerCase())) {
          toast.error(`${name} is already in stage cast.`);
          return;
        }
        setPlayForm(prev => ({
          ...prev,
          cast: [...(prev.cast || []), { name, person_id: personId, character_name: '' }],
        }));
        toast.success(`Added ${name} to Stage Cast!`);
      } else {
        if (roleId === 'director') setPlayForm(prev => ({ ...prev, director: name }));
        if (roleId === 'playwright') setPlayForm(prev => ({ ...prev, playwright: name }));
        if (roleId === 'producer') setPlayForm(prev => ({ ...prev, producer: name }));

        const currentCrew = [...(playForm.crew || [])];
        if (!currentCrew.some(c => (c.name || '').toLowerCase() === name.toLowerCase() && c.role === roleId)) {
          setPlayForm(prev => ({
            ...prev,
            crew: [...(prev.crew || []), { name, person_id: personId, role: roleId }],
          }));
        }
        const label = STAGE_CREW_ROLES.find(r => r.id === roleId)?.label || roleId;
        toast.success(`Assigned ${name} as ${label}!`);
      }
    } else {
      // Film
      if (roleId === 'actor') {
        handleAddMentionToCast(mention);
      } else {
        if (roleId === 'director') setFilmForm(prev => ({ ...prev, director: name, director_person_id: personId }));
        const currentCrew = [...(filmForm.crew || [])];
        if (!currentCrew.some(c => (c.name || '').toLowerCase() === name.toLowerCase() && c.role === roleId)) {
          setFilmForm(prev => ({
            ...prev,
            crew: [...(prev.crew || []), { name, person_id: personId, role: roleId }],
          }));
        }
        const label = FILM_CREW_ROLES.find(r => r.id === roleId)?.label || roleId;
        toast.success(`Assigned ${name} as ${label}!`);
      }
    }
    setActiveMentionDropdown(null);
  };

  // Add manual cast row (Film)
  const handleAddManualCastRow = () => {
    setFilmForm(prev => ({
      ...prev,
      cast: [...(prev.cast || []), { name: '', person_id: null, character_name: '' }],
    }));
  };

  // Remove cast row (Film)
  const handleRemoveCastRow = (index) => {
    setFilmForm(prev => ({
      ...prev,
      cast: (prev.cast || []).filter((_, idx) => idx !== index),
    }));
  };

  // Update cast row (Film)
  const handleUpdateCastRow = (index, field, value) => {
    setFilmForm(prev => ({
      ...prev,
      cast: (prev.cast || []).map((item, idx) => {
        if (idx !== index) return item;
        const base = typeof item === 'string' ? { name: item, character_name: '', person_id: null } : item;
        return typeof field === 'object' ? { ...base, ...field } : { ...base, [field]: value };
      }),
    }));
  };

  // Add manual crew row (Film)
  const handleAddManualCrewRow = () => {
    setFilmForm(prev => ({
      ...prev,
      crew: [...(prev.crew || []), { name: '', person_id: null, role: 'producer' }],
    }));
  };

  // Remove crew row (Film)
  const handleRemoveCrewRow = (index) => {
    setFilmForm(prev => ({
      ...prev,
      crew: (prev.crew || []).filter((_, idx) => idx !== index),
    }));
  };

  // Update crew row (Film)
  const handleUpdateCrewRow = (index, field, value) => {
    setFilmForm(prev => ({
      ...prev,
      crew: (prev.crew || []).map((item, idx) => {
        if (idx !== index) return item;
        return typeof field === 'object' ? { ...item, ...field } : { ...item, [field]: value };
      }),
    }));
  };

  // Play Cast handlers
  const handleAddPlayCastRow = () => {
    setPlayForm(prev => ({
      ...prev,
      cast: [...(prev.cast || []), { name: '', person_id: null, character_name: '' }],
    }));
  };

  const handleRemovePlayCastRow = (index) => {
    setPlayForm(prev => ({
      ...prev,
      cast: (prev.cast || []).filter((_, idx) => idx !== index),
    }));
  };

  const handleUpdatePlayCastRow = (index, field, value) => {
    setPlayForm(prev => ({
      ...prev,
      cast: (prev.cast || []).map((item, idx) => {
        if (idx !== index) return item;
        return typeof field === 'object' ? { ...item, ...field } : { ...item, [field]: value };
      }),
    }));
  };

  // Play Crew handlers
  const handleAddPlayCrewRow = () => {
    setPlayForm(prev => ({
      ...prev,
      crew: [...(prev.crew || []), { name: '', person_id: null, role: 'stage_manager' }],
    }));
  };

  const handleRemovePlayCrewRow = (index) => {
    setPlayForm(prev => ({
      ...prev,
      crew: (prev.crew || []).filter((_, idx) => idx !== index),
    }));
  };

  const handleUpdatePlayCrewRow = (index, field, value) => {
    setPlayForm(prev => ({
      ...prev,
      crew: (prev.crew || []).map((item, idx) => {
        if (idx !== index) return item;
        return typeof field === 'object' ? { ...item, ...field } : { ...item, [field]: value };
      }),
    }));
  };

  // Toggle Genre
  const handleToggleGenre = (g) => {
    setFilmForm(prev => {
      const exists = prev.genres.includes(g);
      const next = exists ? prev.genres.filter(x => x !== g) : [...prev.genres, g];
      return { ...prev, genres: next.length ? next : [g] };
    });
  };

  // File upload handler
  const handleFileUpload = (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const dataUrl = event.target?.result;
        if (dataUrl) {
          setPostData(prev => {
            const currentMedia = prev?.media ? [...prev.media] : [];
            currentMedia.push({ url: dataUrl, type: 'image', isPrimary: currentMedia.length === 0 });
            return {
              ...(prev || { success: true, platform: 'manual', sourceUrl: '', caption: '', media: [], mentions: [] }),
              media: currentMedia,
            };
          });
          if (!filmForm.poster_url) setFilmForm(prev => ({ ...prev, poster_url: dataUrl }));
          if (!playForm.poster_url) setPlayForm(prev => ({ ...prev, poster_url: dataUrl }));
          toast.success(`Uploaded ${file.name}`);
        }
      };
      reader.readAsDataURL(file);
    });
  };

  const handleAddSlideByUrl = () => {
    const trimmed = newSlideUrl.trim();
    if (!trimmed) return;
    setPostData(prev => {
      const currentMedia = prev?.media ? [...prev.media] : [];
      currentMedia.push({ url: trimmed, type: 'image', isPrimary: currentMedia.length === 0 });
      return {
        ...(prev || { success: true, platform: 'manual', sourceUrl: '', caption: '', media: [], mentions: [] }),
        media: currentMedia,
      };
    });
    setNewSlideUrl('');
    setShowAddSlideUrlInput(false);
    toast.success('Added new slide!');
  };

  const handleRemoveSlide = (slideIndex) => {
    setPostData(prev => {
      if (!prev?.media) return prev;
      const updated = prev.media.filter((_, i) => i !== slideIndex);
      return { ...prev, media: updated };
    });
    if (selectedSlideIdx >= slideIndex && selectedSlideIdx > 0) {
      setSelectedSlideIdx(prev => prev - 1);
    }
    toast.success('Removed slide');
  };

  // Instant Publish / Create handler
  const handlePublish = async () => {
    setIsPublishing(true);
    setPublishResult(null);

    try {
      const headers = await authHeaders();
      let payload = {};

      if (activeTab === 'film') {
        if (!filmForm.title.trim()) throw new Error('Film Title is required.');
        if (!filmForm.synopsis.trim() || filmForm.synopsis.trim().length < 20) {
          throw new Error('Please provide a synopsis of at least 20 characters.');
        }
        payload = { ...filmForm };
      } else if (activeTab === 'play') {
        if (!playForm.title.trim()) throw new Error('Stage Play Title is required.');
        payload = { ...playForm };
      } else if (activeTab === 'critic_review') {
        if (!reviewForm.quote.trim()) throw new Error('Review quote is required.');
        if (!reviewForm.film_title.trim() && !reviewForm.film_id && !reviewForm.play_id) {
          throw new Error('Please match or enter a film/play title for this review.');
        }
        payload = { ...reviewForm };
      } else if (activeTab === 'social_post') {
        payload = {
          ...socialForm,
          source_url: url || postData?.sourceUrl || '',
          captions: {
            instagram: socialForm.instagram_caption,
            facebook: socialForm.facebook_caption,
            threads: socialForm.threads_post,
          },
        };
      }

      const res = await fetch('/api/social?task=social_intake_publish', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          entityType: activeTab,
          payload,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Publishing failed.');

      setPublishResult(data);
      const label = activeTab === 'film' ? 'Film created' : activeTab === 'play' ? 'Stage Play created' : activeTab === 'critic_review' ? 'Review published' : 'Social Draft created';
      toast.success(`✓ ${label} successfully!`);

      // Mark linked Telegram inbox item as applied so it leaves the open queue
      if (activeTelegramItem?.id) {
        try {
          await fetch('/api/social?task=intake_update', {
            method: 'POST',
            headers: { ...headers, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              intakeId: activeTelegramItem.id,
              workflowStatus: 'applied',
              adminNotes: `Published via Social Intake as ${activeTab} (${data.id || ''})`,
            }),
          });
          setActiveTelegramItem(null);
          loadTelegramInbox();
        } catch (tgErr) {
          console.warn('Could not mark Telegram item applied:', tgErr);
        }
      }
    } catch (err) {
      console.error(err);
      toast.error(err.message || 'Failed to publish intake entity.');
    } finally {
      setIsPublishing(false);
    }
  };

  const currentMedia = postData?.media || [];
  const activeSlide = currentMedia[selectedSlideIdx] || currentMedia[0];

  return (
    <div className="space-y-6 pb-20 max-w-7xl mx-auto px-4 sm:px-6">
      <SEO title="Admin Social Intake | MuviDB" description="Ingest social media posts into Films, Stage Plays, and Reviews." />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border/60 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand/10 text-brand">
              <Icon icon="solar:import-linear" width="20" />
            </span>
            <h1 className="text-xl sm:text-2xl font-black text-text-primary tracking-tight">
              Social Intake & Instant Creator
            </h1>
          </div>
          <p className="mt-1 text-xs sm:text-sm text-text-muted">
            Fetch Instagram, Facebook & Threads posts or carousels. Resolve @handles to real Nollywood stars, run OCR on flyers, and publish in 1 click.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* IG Session Status Badge */}
          {igSessionStatus && (
            <div
              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold rounded-lg border transition-all ${
                igSessionStatus.hasSession
                  ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
                  : 'border-border bg-surface-2/70 text-text-muted hover:border-amber-500/40'
              }`}
              title={
                igSessionStatus.hasSession
                  ? `Instagram Scout Session Active (Source: ${igSessionStatus.source}). Bypasses login gates & rate limits.`
                  : "Instagram Session: Anonymous (oEmbed fallbacks). To enable zero-limit authenticated scraping, run 'npm run ig:login' or set IG_COOKIE in .env."
              }
            >
              {igSessionStatus.hasSession ? (
                <>
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </span>
                  <Icon icon="ri:instagram-line" className="text-emerald-400" />
                  <span>IG Scout: Active</span>
                </>
              ) : (
                <>
                  <span className="h-2 w-2 rounded-full bg-amber-400/80"></span>
                  <Icon icon="ri:instagram-line" className="text-text-muted" />
                  <span>IG: Anonymous</span>
                  <button
                    type="button"
                    onClick={checkIgSession}
                    disabled={isCheckingIgSession}
                    className="ml-1 text-text-muted hover:text-text-primary p-0.5 rounded transition-colors"
                    title="Refresh IG session status"
                  >
                    <Icon icon="solar:refresh-linear" className={isCheckingIgSession ? 'animate-spin' : ''} width="12" />
                  </button>
                </>
              )}
            </div>
          )}

          {postData && (
            <button
              onClick={handleReset}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg border border-border text-text-muted hover:text-text-primary hover:bg-surface-2 transition-colors"
            >
              <Icon icon="solar:refresh-linear" />
              Reset All
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              const next = !showTelegramInbox;
              setShowTelegramInbox(next);
              if (next) loadTelegramInbox();
            }}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg border transition-colors ${
              showTelegramInbox
                ? 'border-sky-500 bg-sky-500 text-white shadow-sm'
                : 'border-sky-500/30 bg-sky-500/10 text-sky-400 hover:bg-sky-500/20'
            }`}
          >
            <Icon icon="ic:baseline-telegram" width="15" />
            <span>Telegram Inbox</span>
            {openTelegramCount > 0 && (
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                showTelegramInbox ? 'bg-white/20 text-white' : 'bg-sky-500 text-white'
              }`}>
                {openTelegramCount}
              </span>
            )}
          </button>
          <Link
            to="/admin/social"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg border border-brand/30 bg-brand/5 text-brand hover:bg-brand/10 transition-colors"
          >
            <Icon icon="solar:magic-stick-3-linear" />
            Open Social Studio
          </Link>
        </div>
      </div>

      {/* ── TELEGRAM INTAKE INBOX (Shared with Social Studio Bot) ── */}
      {showTelegramInbox && (
        <div className="rounded-2xl border border-sky-500/30 bg-surface p-5 shadow-sm space-y-4 animate-fadeIn">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-border/50 pb-3">
            <div>
              <div className="flex items-center gap-2">
                <Icon icon="ic:baseline-telegram" className="text-sky-400" width="20" />
                <h2 className="text-sm font-black uppercase tracking-wider text-text-primary">
                  Telegram Forwarded Inbox ({filteredTelegramItems.length})
                </h2>
              </div>
              <p className="text-xs text-text-muted mt-0.5">
                Forward Instagram, Facebook, Threads, or YouTube posts to the MuviDB Telegram bot — click &ldquo;Load into Creator&rdquo; to populate all fields here.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="text"
                value={telegramSearch}
                onChange={(e) => setTelegramSearch(e.target.value)}
                placeholder="Filter inbox…"
                className="rounded-lg border border-border bg-surface-2 px-3 py-1.5 text-xs text-text-primary outline-none focus:border-sky-400 w-40"
              />
              <select
                value={telegramFilter}
                onChange={(e) => setTelegramFilter(e.target.value)}
                className="rounded-lg border border-border bg-surface-2 px-2.5 py-1.5 text-xs font-bold text-text-primary outline-none"
              >
                <option value="open">Open ({openTelegramCount})</option>
                <option value="all">All ({telegramItems.length})</option>
                <option value="applied">Applied</option>
                <option value="rejected">Rejected</option>
              </select>
              <button
                type="button"
                onClick={loadTelegramInbox}
                disabled={loadingTelegram}
                className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-xs font-bold text-text-muted hover:text-text-primary"
              >
                <Icon icon="solar:refresh-linear" className={loadingTelegram ? 'animate-spin' : ''} width="14" />
                Refresh
              </button>
              <button
                type="button"
                onClick={() => setShowTelegramInbox(false)}
                className="rounded-lg border border-border px-2.5 py-1.5 text-xs font-bold text-text-muted hover:text-text-primary"
              >
                Close
              </button>
            </div>
          </div>

          {loadingTelegram && telegramItems.length === 0 ? (
            <div className="py-8 text-center text-xs text-text-muted">
              <Icon icon="solar:spinner-linear" className="mx-auto animate-spin text-sky-400 mb-2" width="24" />
              Loading Telegram inbox…
            </div>
          ) : filteredTelegramItems.length === 0 ? (
            <p className="py-8 text-center text-xs text-text-muted">
              No Telegram inbox items match this filter. Forward a post link or flyer to the MuviDB Telegram bot to see it here.
            </p>
          ) : (
            <div className="grid gap-3 md:grid-cols-2 max-h-[440px] overflow-y-auto pr-1 scrollbar-thin">
              {filteredTelegramItems.map((item) => {
                const isLoaded = activeTelegramItem?.id === item.id;
                const thumb = item.metadata?.image_url || '';
                const extractedTitle = item.extracted_payload?.title || item.metadata?.extracted_payload?.title;
                return (
                  <div
                    key={item.id}
                    className={`flex gap-3 rounded-xl border p-3 transition-all ${
                      isLoaded
                        ? 'border-sky-500 bg-sky-500/10'
                        : 'border-border bg-surface-2/60 hover:border-sky-500/40'
                    }`}
                  >
                    <div className="h-20 w-16 shrink-0 overflow-hidden rounded-lg border border-border bg-surface flex items-center justify-center">
                      {thumb ? (
                        <img
                          src={getSafePreviewUrl(thumb)}
                          referrerPolicy="no-referrer"
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <Icon icon="ic:baseline-telegram" className="text-sky-400/70" width="24" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1 flex flex-col justify-between gap-1.5">
                      <div>
                        <div className="flex items-center justify-between gap-2">
                          <p className="truncate text-xs font-black text-text-primary">
                            {extractedTitle || item.title || 'Forwarded Telegram Post'}
                          </p>
                          <span className="shrink-0 rounded bg-surface px-1.5 py-0.5 text-[9px] font-bold uppercase text-text-muted border border-border">
                            {item.intake_kind || item.metadata?.extracted_kind || 'unclassified'}
                          </span>
                        </div>
                        <p className="mt-1 line-clamp-2 text-[11px] text-text-muted leading-snug">
                          {item.description || item.source_url || 'No caption'}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                        <span className="text-[10px] text-text-muted">
                          {item.metadata?.from_user ? `From ${item.metadata.from_user} · ` : ''}
                          {new Date(item.detected_at || item.created_at).toLocaleDateString()}
                        </span>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleLoadTelegramItem(item)}
                            className="inline-flex items-center gap-1 rounded-lg bg-brand px-2.5 py-1 text-[11px] font-bold text-white hover:brightness-110 transition-all"
                          >
                            <Icon icon="solar:import-linear" width="12" />
                            Load into Creator
                          </button>
                          {!['applied', 'approved', 'rejected'].includes(item.workflow_status) && (
                            <button
                              type="button"
                              onClick={() => handleRejectTelegramItem(item)}
                              className="rounded-lg border border-border px-2 py-1 text-[10px] font-bold text-text-muted hover:text-red-400 hover:border-red-500/40 transition-colors"
                              title="Dismiss from inbox"
                            >
                              Dismiss
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {activeTelegramItem && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-sky-500/30 bg-sky-500/10 px-4 py-2.5 text-xs">
          <div className="flex items-center gap-2 text-sky-300">
            <Icon icon="ic:baseline-telegram" width="16" />
            <span>
              Working from Telegram forward: <strong className="text-text-primary">{activeTelegramItem.title}</strong> — publishing will automatically mark this inbox item as applied.
            </span>
          </div>
          <button
            type="button"
            onClick={() => setActiveTelegramItem(null)}
            className="text-[11px] font-bold text-text-muted hover:text-text-primary"
          >
            Unlink
          </button>
        </div>
      )}

      {/* Telegram Forwarded Items Alert Banner */}
      {openTelegramCount > 0 && !showTelegramInbox && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-sky-500/10 border border-sky-500/30 rounded-2xl px-4 py-3.5 animate-fadeIn">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-sky-500/20 text-sky-400">
              <Icon icon="ic:baseline-telegram" width="22" />
            </div>
            <div>
              <p className="text-xs font-bold text-text-primary">
                {openTelegramCount} Forwarded Post{openTelegramCount > 1 ? 's' : ''} in Telegram Inbox (@muvidb_bot)
              </p>
              <p className="text-[11px] text-text-muted mt-0.5">
                Posts forwarded from @amichael.design & @muvidb_ are waiting for 1-click import into Films or Plays.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setShowTelegramInbox(true)}
            className="px-3.5 py-1.5 rounded-xl bg-sky-500 text-white font-bold text-xs hover:bg-sky-400 transition-colors shrink-0 flex items-center justify-center gap-1.5 shadow"
          >
            <span>Review Forwarded Posts ({openTelegramCount})</span>
            <Icon icon="solar:arrow-right-linear" width="14" />
          </button>
        </div>
      )}

      {/* ── STEP 1: URL Input & Fetcher ── */}
      <div className="rounded-2xl border border-border bg-surface p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <label className="text-[11px] font-black uppercase tracking-wider text-text-muted flex items-center gap-2">
            <Icon icon="solar:link-circle-linear" className="text-brand" width="16" />
            Post URL (Instagram, Facebook, Threads, YouTube)
          </label>
          <div className="flex items-center gap-2 text-text-muted text-xs">
            <Icon icon="ri:instagram-line" width="16" className="text-pink-500" />
            <Icon icon="ri:facebook-fill" width="16" className="text-blue-500" />
            <Icon icon="ri:threads-fill" width="16" className="text-white" />
            <Icon icon="ri:youtube-fill" width="16" className="text-red-500" />
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <input
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleFetchPost()}
            placeholder="https://www.instagram.com/p/DBxyz/ or Facebook/Threads link..."
            className="flex-1 rounded-xl border border-border bg-surface-2 px-4 py-3 text-sm text-text-primary placeholder:text-text-muted/50 outline-none focus:border-brand transition-colors font-mono"
          />
          <button
            onClick={handleFetchPost}
            disabled={isFetching || (!url.trim() && !manualCaption.trim())}
            className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-brand text-white font-black text-sm hover:brightness-110 active:scale-95 disabled:opacity-50 transition-all shadow-lg shadow-brand/20 shrink-0"
          >
            {isFetching ? (
              <>
                <Icon icon="solar:spinner-linear" className="animate-spin" width="18" />
                <span>Extracting with AI…</span>
              </>
            ) : (
              <>
                <Icon icon="solar:magnifer-linear" width="18" />
                <span>Fetch Post</span>
              </>
            )}
          </button>
        </div>

        {/* Dynamic Scout Session Advice for Instagram Links */}
        {url.includes('instagram.com') && (
          <div className="flex items-center gap-2 text-[11px] text-text-muted bg-surface-2/60 px-3.5 py-2 rounded-xl border border-border/50">
            <Icon
              icon="ri:instagram-line"
              className={igSessionStatus?.hasSession ? 'text-emerald-400 shrink-0' : 'text-pink-500 shrink-0'}
              width="14"
            />
            {igSessionStatus?.hasSession ? (
              <span className="text-emerald-400 font-medium">
                Instagram scout session active ({igSessionStatus.source === 'env' ? 'Environment variable' : 'scratch/ig_session.json'}): full carousel & HD stream extraction enabled without login walls.
              </span>
            ) : (
              <span>
                Anonymous mode: using public oEmbed and embed fallback scraping. For 100% carousel reliability without login redirects, run <code className="text-brand font-mono font-bold">npm run ig:login</code> or set <code className="text-brand font-mono font-bold">IG_COOKIE</code> in .env.
              </span>
            )}
          </div>
        )}

        {/* Manual caption / upload collapsible */}
        <div className="border-t border-border/40 pt-3">
          <button
            type="button"
            onClick={() => setShowManualInput(!showManualInput)}
            className="text-xs font-bold text-text-muted hover:text-text-primary flex items-center gap-1.5 transition-colors"
          >
            <Icon icon={showManualInput ? 'solar:alt-arrow-up-linear' : 'solar:alt-arrow-down-linear'} />
            {showManualInput ? 'Hide manual text & upload tools' : 'Paste caption or upload flyers manually instead'}
          </button>

          {showManualInput && (
            <div className="mt-3 grid gap-3 sm:grid-cols-2 pt-2 animate-fadeIn">
              <div>
                <label className="text-[10px] font-black uppercase text-text-muted block mb-1">
                  Manual Post Caption / Announcement Text
                </label>
                <textarea
                  value={manualCaption}
                  onChange={(e) => setManualCaption(e.target.value)}
                  rows={4}
                  placeholder="Paste Instagram/Facebook caption here (with @mentions, release dates, cinema tags)..."
                  className="w-full rounded-xl border border-border bg-surface-2 p-3 text-xs text-text-primary outline-none focus:border-brand transition-colors"
                />
              </div>

              <div>
                <label className="text-[10px] font-black uppercase text-text-muted block mb-1">
                  Upload Flyer / Poster Screenshots
                </label>
                <div className="border-2 border-dashed border-border rounded-xl p-4 text-center hover:border-brand/60 transition-colors bg-surface-2/40">
                  <input
                    type="file"
                    id="flyer-upload"
                    multiple
                    accept="image/*"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                  <label htmlFor="flyer-upload" className="cursor-pointer block">
                    <Icon icon="solar:gallery-wide-linear" className="mx-auto text-text-muted mb-1" width="28" />
                    <p className="text-xs font-bold text-text-primary">Click to select poster images</p>
                    <p className="text-[10px] text-text-muted mt-0.5">PNG, JPG, WebP supported</p>
                  </label>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── STEP 2: Extracted Carousel & Media Gallery ── */}
      {currentMedia.length > 0 && (
        <div className="rounded-2xl border border-border bg-surface p-5 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-border/50 pb-3">
            <div className="flex items-center gap-2">
              <Icon icon="solar:gallery-linear" className="text-brand" width="18" />
              <h2 className="text-sm font-black uppercase tracking-wider text-text-primary">
                Extracted Media Slides ({currentMedia.length})
              </h2>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-xs text-text-muted mr-1">
                Slide {selectedSlideIdx + 1} of {currentMedia.length}
              </p>
              <button
                type="button"
                onClick={() => setShowAddSlideUrlInput(!showAddSlideUrlInput)}
                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold rounded-lg border border-border bg-surface-2 text-text-primary hover:border-brand transition-colors"
                title="Add another carousel slide by direct image link"
              >
                <Icon icon="solar:link-circle-linear" width="14" className="text-brand" />
                <span>+ Add Slide URL</span>
              </button>
              <label
                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold rounded-lg border border-border bg-surface-2 text-text-primary hover:border-brand transition-colors cursor-pointer"
                title="Upload local slide flyer or photo"
              >
                <Icon icon="solar:upload-linear" width="14" className="text-brand" />
                <span>+ Upload Slide</span>
                <input
                  type="file"
                  multiple
                  accept="image/*"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>
            </div>
          </div>

          {showAddSlideUrlInput && (
            <div className="flex items-center gap-2 bg-surface-2 p-2.5 rounded-xl border border-brand/50 animate-fadeIn">
              <input
                type="text"
                value={newSlideUrl}
                onChange={(e) => setNewSlideUrl(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddSlideByUrl()}
                placeholder="Paste direct Instagram slide image URL (or image link)..."
                className="flex-1 bg-surface px-3 py-1.5 rounded-lg border border-border text-xs text-text-primary outline-none focus:border-brand font-mono"
              />
              <button
                type="button"
                onClick={handleAddSlideByUrl}
                disabled={!newSlideUrl.trim()}
                className="px-3 py-1.5 rounded-lg bg-brand text-white font-bold text-xs hover:brightness-110 disabled:opacity-50 transition-all shrink-0"
              >
                Add Slide
              </button>
              <button
                type="button"
                onClick={() => { setShowAddSlideUrlInput(false); setNewSlideUrl(''); }}
                className="px-2.5 py-1.5 text-xs font-bold text-text-muted hover:text-text-primary transition-colors shrink-0"
              >
                Cancel
              </button>
            </div>
          )}

          <div className="grid gap-5 lg:grid-cols-[280px_minmax(0,1fr)]">
            {/* Horizontal / Grid Thumbnail Strip */}
            <div className="flex lg:flex-col gap-3 overflow-x-auto pb-2 lg:pb-0 max-h-[460px] scrollbar-thin">
              {currentMedia.map((media, idx) => {
                const isSelected = selectedSlideIdx === idx;
                const isPoster = filmForm.poster_url === media.url || playForm.poster_url === media.url;
                const isBackdrop = filmForm.backdrop_url === media.url || playForm.banner_url === media.url;

                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setSelectedSlideIdx(idx)}
                    className={`relative shrink-0 rounded-xl overflow-hidden border-2 text-left transition-all p-1 bg-surface-2 ${
                      isSelected ? 'border-brand ring-2 ring-brand/20 shadow-md' : 'border-border hover:border-brand/40'
                    }`}
                  >
                    <div className="relative aspect-[4/5] w-24 lg:w-full bg-black/20 rounded-lg overflow-hidden">
                      {media.type === 'video' ? (
                        <div className="h-full w-full flex items-center justify-center bg-black/40 text-white">
                          <Icon icon="solar:videocamera-record-bold" width="28" />
                        </div>
                      ) : (
                        <img
                          src={getSafePreviewUrl(media.url)}
                          alt=""
                          referrerPolicy="no-referrer"
                          className="h-full w-full object-cover"
                        />
                      )}

                      <span className="absolute bottom-1.5 left-1.5 bg-black/70 backdrop-blur-sm px-1.5 py-0.5 rounded text-[9px] font-black text-white">
                        Slide {idx + 1}
                      </span>

                      {isPoster && (
                        <span className="absolute top-1.5 left-1.5 bg-brand text-white px-1.5 py-0.5 rounded text-[8px] font-black uppercase shadow">
                          Poster
                        </span>
                      )}
                      {currentMedia.length > 1 && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRemoveSlide(idx);
                          }}
                          className="absolute top-1.5 right-1.5 z-10 p-1 rounded-full bg-black/70 text-white/80 hover:text-red-400 hover:bg-black transition-colors"
                          title="Remove slide"
                        >
                          <Icon icon="solar:trash-bin-trash-linear" width="12" />
                        </button>
                      )}
                      {isBackdrop && !currentMedia.length && (
                        <span className="absolute top-1.5 right-1.5 bg-purple-600 text-white px-1.5 py-0.5 rounded text-[8px] font-black uppercase shadow">
                          Backdrop
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Active Slide Preview & Slide Quick Actions */}
            {activeSlide && (
              <div className="flex flex-col sm:flex-row gap-5 items-start bg-surface-2/40 rounded-xl p-4 border border-border/40">
                <div className="w-full sm:w-56 shrink-0 rounded-xl overflow-hidden border border-border bg-black/40 shadow-md aspect-[4/5] relative">
                  {activeSlide.type === 'video' ? (
                    <video src={activeSlide.url} controls className="w-full h-full object-contain" />
                  ) : (
                    <img
                      src={getSafePreviewUrl(activeSlide.url)}
                      alt="Slide preview"
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-contain"
                    />
                  )}
                </div>

                <div className="flex-1 space-y-3">
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-wider text-brand">
                      Active Slide {selectedSlideIdx + 1} of {currentMedia.length}
                    </span>
                    <h3 className="text-sm font-bold text-text-primary mt-0.5">
                      Assign Artwork & Perform OCR
                    </h3>
                    <p className="text-xs text-text-muted mt-1 leading-relaxed">
                      Use this slide as the primary portrait poster, backdrop banner, or scan its billing block text.
                    </p>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-wrap gap-2 pt-1">
                    <button
                      type="button"
                      disabled={isMirroringPoster}
                      onClick={() => handleSetAsPoster(activeSlide.url)}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-brand text-white text-xs font-bold shadow-sm hover:brightness-110 active:scale-95 disabled:opacity-60 transition-all"
                    >
                      <Icon icon={isMirroringPoster ? 'solar:spinner-linear' : 'solar:star-bold'} className={isMirroringPoster ? 'animate-spin' : ''} />
                      {isMirroringPoster ? 'Mirroring Poster…' : 'Set as Poster'}
                    </button>

                    <button
                      type="button"
                      disabled={isMirroringBackdrop}
                      onClick={() => handleSetAsBackdrop(activeSlide.url)}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-purple-500/30 bg-purple-500/10 text-purple-400 text-xs font-bold hover:bg-purple-500/20 active:scale-95 disabled:opacity-60 transition-all"
                    >
                      <Icon icon={isMirroringBackdrop ? 'solar:spinner-linear' : 'solar:gallery-wide-linear'} className={isMirroringBackdrop ? 'animate-spin' : ''} />
                      {isMirroringBackdrop ? 'Mirroring Backdrop…' : 'Set as Backdrop'}
                    </button>

                    <button
                      type="button"
                      onClick={() => handleRunOcrOnSlide(activeSlide.url)}
                      disabled={isOcrProcessing || activeSlide.type === 'video'}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border bg-surface text-text-primary text-xs font-bold hover:border-brand active:scale-95 transition-all disabled:opacity-50"
                    >
                      <Icon icon={isOcrProcessing ? 'solar:spinner-linear' : 'solar:scanner-linear'} className={isOcrProcessing ? 'animate-spin text-brand' : ''} />
                      {isOcrProcessing ? 'Scanning Slide…' : 'Run OCR on Slide'}
                    </button>
                  </div>

                  {/* OCR Engine selector */}
                  <div className="flex items-center gap-3 pt-2 text-xs">
                    <span className="text-[10px] font-bold text-text-muted uppercase">OCR Engine:</span>
                    <label className="flex items-center gap-1.5 cursor-pointer text-text-muted hover:text-text-primary">
                      <input
                        type="radio"
                        name="ocrEngine"
                        checked={ocrEngine === 'ai'}
                        onChange={() => setOcrEngine('ai')}
                        className="text-brand focus:ring-0"
                      />
                      <span>AI Vision (Gemini)</span>
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer text-text-muted hover:text-text-primary">
                      <input
                        type="radio"
                        name="ocrEngine"
                        checked={ocrEngine === 'local'}
                        onChange={() => setOcrEngine('local')}
                        className="text-brand focus:ring-0"
                      />
                      <span>Local Free OCR (Browser)</span>
                    </label>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── STEP 3: Resolved Mentions Strip ── */}
      {postData?.mentions && postData.mentions.length > 0 && (
        <div className="rounded-2xl border border-border bg-surface p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between border-b border-border/40 pb-2">
            <div className="flex items-center gap-2">
              <Icon icon="solar:users-group-rounded-linear" className="text-brand" width="18" />
              <h2 className="text-xs font-black uppercase tracking-wider text-text-primary">
                Resolved Social @Mentions ({postData.mentions.length})
              </h2>
            </div>
            <p className="text-[11px] text-text-muted">
              Auto-resolved to Nollywood database profiles. Assign to cast or specific crew departments.
            </p>
          </div>

          <div className="flex flex-wrap gap-2.5">
            {postData.mentions.map((mention, idx) => {
              const isOpen = activeMentionDropdown === idx;
              const crewRoles = activeTab === 'play' ? STAGE_CREW_ROLES : FILM_CREW_ROLES;

              return (
                <div
                  key={idx}
                  className="relative inline-flex items-center gap-2 rounded-xl border border-border bg-surface-2 px-3 py-2 text-xs transition-all hover:border-brand/40 shadow-sm"
                >
                  {mention.photoUrl ? (
                    <img src={getSafePreviewUrl(mention.photoUrl)} referrerPolicy="no-referrer" alt="" className="h-6 w-6 rounded-full object-cover border border-border" />
                  ) : (
                    <div className="h-6 w-6 rounded-full bg-brand/10 text-brand flex items-center justify-center font-black text-[10px]">
                      {mention.resolvedName?.charAt(0) || '@'}
                    </div>
                  )}

                  <div>
                    <div className="flex items-center gap-1">
                      <span className="font-bold text-text-primary">{mention.resolvedName}</span>
                      {mention.matched && (
                        <Icon icon="solar:check-circle-bold" className="text-emerald-400" width="13" title="Verified in database" />
                      )}
                    </div>
                    <span className="text-[10px] text-text-muted font-mono">{mention.handle}</span>
                  </div>

                  <div className="flex items-center gap-1 ml-1 border-l border-border/60 pl-2">
                    <button
                      type="button"
                      onClick={() => handleAddMentionToRole(mention, 'actor')}
                      className="px-1.5 py-0.5 rounded hover:bg-brand/10 text-text-muted hover:text-brand transition-colors text-[10px] font-bold"
                      title="Add to Cast list"
                    >
                      + Cast
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAddMentionToRole(mention, 'director')}
                      className="px-1.5 py-0.5 rounded hover:bg-purple-500/10 text-text-muted hover:text-purple-400 transition-colors text-[10px] font-bold"
                      title="Set as Director"
                    >
                      + Dir
                    </button>
                    {activeTab === 'play' ? (
                      <>
                        <button
                          type="button"
                          onClick={() => handleAddMentionToRole(mention, 'playwright')}
                          className="px-1.5 py-0.5 rounded hover:bg-blue-500/10 text-text-muted hover:text-blue-400 transition-colors text-[10px] font-bold"
                          title="Set as Playwright"
                        >
                          + Playwright
                        </button>
                        <button
                          type="button"
                          onClick={() => handleAddMentionToRole(mention, 'producer')}
                          className="px-1.5 py-0.5 rounded hover:bg-amber-500/10 text-text-muted hover:text-amber-400 transition-colors text-[10px] font-bold"
                          title="Add as Producer"
                        >
                          + Prod
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => handleAddMentionToRole(mention, 'producer')}
                          className="px-1.5 py-0.5 rounded hover:bg-amber-500/10 text-text-muted hover:text-amber-400 transition-colors text-[10px] font-bold"
                          title="Add as Producer"
                        >
                          + Prod
                        </button>
                        <button
                          type="button"
                          onClick={() => handleAddMentionToRole(mention, 'writer')}
                          className="px-1.5 py-0.5 rounded hover:bg-blue-500/10 text-text-muted hover:text-blue-400 transition-colors text-[10px] font-bold"
                          title="Add as Writer"
                        >
                          + Writer
                        </button>
                      </>
                    )}

                    {/* Dropdown for other crew roles */}
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setActiveMentionDropdown(isOpen ? null : idx)}
                        className={`px-1.5 py-0.5 rounded text-[10px] font-bold flex items-center gap-0.5 transition-colors ${
                          isOpen ? 'bg-brand text-white' : 'text-text-muted hover:text-text-primary hover:bg-surface'
                        }`}
                        title="Assign to specific crew role"
                      >
                        <span>Crew</span>
                        <Icon icon="solar:alt-arrow-down-linear" width="10" />
                      </button>

                      {isOpen && (
                        <div className="absolute right-0 top-full mt-1.5 z-30 w-44 rounded-xl border border-border bg-surface p-1.5 shadow-2xl space-y-0.5 animate-fadeIn">
                          <div className="px-2 py-1 text-[9px] font-black uppercase tracking-wider text-text-muted border-b border-border/40 mb-1">
                            Assign {mention.resolvedName?.split(' ')[0]} to:
                          </div>
                          {crewRoles.map(r => (
                            <button
                              key={r.id}
                              type="button"
                              onClick={() => handleAddMentionToRole(mention, r.id)}
                              className="w-full text-left px-2 py-1 rounded text-xs text-text-primary hover:bg-brand/10 hover:text-brand transition-colors font-medium"
                            >
                              {r.label}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── STEP 4: OCR Extraction Results (Collapsible) ── */}
      {ocrResult && (
        <div className="rounded-2xl border border-border bg-surface p-5 shadow-sm space-y-4 animate-fadeIn">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-border/50 pb-3">
            <div className="flex items-center gap-2">
              <Icon icon="solar:document-text-bold" className="text-brand" width="18" />
              <h2 className="text-xs font-black uppercase tracking-wider text-text-primary">
                OCR Billing Block Extraction
              </h2>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleApplyOcrToCast}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-bold hover:brightness-110 active:scale-95 transition-all shadow-sm"
              >
                <Icon icon="solar:check-circle-bold" />
                Merge {ocrResult.cast?.length || 0} Actors into Cast Table
              </button>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl border border-border bg-surface-2 p-3 space-y-2">
              <span className="text-[10px] font-black uppercase text-text-muted">Detected Cast & Characters</span>
              {ocrResult.cast?.length ? (
                <div className="space-y-1.5 max-h-56 overflow-y-auto scrollbar-thin">
                  {ocrResult.cast.map((c, i) => (
                    <div key={i} className="flex items-center justify-between text-xs py-1 px-2 rounded bg-surface border border-border/40">
                      <span className="font-bold text-text-primary">{c.name}</span>
                      <span className="text-text-muted italic">{c.character_name || 'No character'}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-text-muted italic">No cast rows identified in this pass.</p>
              )}
            </div>

            <div className="rounded-xl border border-border bg-surface-2 p-3 space-y-2">
              <span className="text-[10px] font-black uppercase text-text-muted">Detected Crew Roles</span>
              {ocrResult.crew?.length ? (
                <div className="space-y-1.5 max-h-56 overflow-y-auto scrollbar-thin">
                  {ocrResult.crew.map((c, i) => (
                    <div key={i} className="flex items-center justify-between text-xs py-1 px-2 rounded bg-surface border border-border/40">
                      <span className="text-brand font-bold uppercase text-[10px]">{c.role}</span>
                      <span className="text-text-primary font-medium">{c.name}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-text-muted italic">No standardized crew roles identified.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── STEP 5: Destination Selector Tabs ── */}
      <div className="flex flex-wrap items-center gap-2 border-b border-border/60 pb-3">
        <span className="text-[11px] font-black uppercase tracking-wider text-text-muted mr-2">
          Select Destination:
        </span>
        {DESTINATIONS.map(dest => (
          <button
            key={dest.id}
            type="button"
            onClick={() => setActiveTab(dest.id)}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition-all ${
              activeTab === dest.id
                ? 'bg-brand text-white shadow-md shadow-brand/20 scale-105'
                : 'bg-surface-2 text-text-muted hover:text-text-primary border border-border'
            }`}
          >
            <Icon icon={dest.icon} width="16" />
            <span>{dest.label}</span>
          </button>
        ))}
      </div>

      {/* ── STEP 6: Interactive Pre-filled Form ── */}
      <div className="rounded-2xl border border-border bg-surface p-6 shadow-sm space-y-6">

        {/* 🎬 FILM FORM */}
        {activeTab === 'film' && (
          <div className="space-y-6 animate-fadeIn">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-border/40 pb-3">
              <div>
                <h3 className="text-sm font-black uppercase tracking-wider text-brand">
                  1. Film Specifications & Credits
                </h3>
                <p className="text-xs text-text-muted">Review, refine, or link to enrich an existing Nollywood movie.</p>
              </div>
              <span className="text-xs font-bold text-text-muted">
                Zero-Duplicate Actor Guarantee Active
              </span>
            </div>

            {/* Mode Switch: Create New Film vs Link & Enrich Existing Film */}
            <div className="p-3.5 rounded-xl bg-surface-2/60 border border-border space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setFilmMode('new');
                      handleUnlinkFilm();
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                      filmMode === 'new' && !linkedFilm
                        ? 'bg-brand text-white shadow-sm'
                        : 'bg-surface text-text-muted hover:text-text-primary border border-border'
                    }`}
                  >
                    <Icon icon="solar:clapperboard-play-linear" width="14" />
                    <span>+ Create New Film</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilmMode('link')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                      filmMode === 'link' || linkedFilm
                        ? 'bg-brand text-white shadow-sm'
                        : 'bg-surface text-text-muted hover:text-text-primary border border-border'
                    }`}
                  >
                    <Icon icon="solar:link-circle-linear" width="14" />
                    <span>Link & Enrich Existing Film</span>
                  </button>
                </div>

                {linkedFilm && (
                  <div className="flex items-center gap-2 text-xs bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 px-3 py-1 rounded-lg">
                    <Icon icon="solar:check-circle-bold" width="15" />
                    <span>Enriching: <strong>{linkedFilm.title} ({linkedFilm.year})</strong></span>
                    <button
                      type="button"
                      onClick={handleUnlinkFilm}
                      className="ml-2 text-text-muted hover:text-red-400 p-0.5 transition-colors"
                      title="Unlink and revert to new film"
                    >
                      <Icon icon="solar:close-circle-linear" width="16" />
                    </button>
                  </div>
                )}
              </div>

              {filmMode === 'link' && !linkedFilm && (
                <div className="relative pt-1 animate-fadeIn">
                  <div className="relative">
                    <Icon icon="solar:magnifer-linear" className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" width="16" />
                    <input
                      type="text"
                      value={filmSearchQuery}
                      onChange={(e) => setFilmSearchQuery(e.target.value)}
                      placeholder="Type movie title to search and enrich existing film in MuviDB..."
                      className="w-full rounded-xl border border-border bg-surface pl-9 pr-8 py-2.5 text-xs text-text-primary outline-none focus:border-brand font-medium placeholder:text-text-muted/50"
                    />
                    {isSearchingFilms && (
                      <Icon icon="solar:spinner-linear" className="animate-spin absolute right-3 top-1/2 -translate-y-1/2 text-brand" width="16" />
                    )}
                  </div>

                  {filmSearchResults.length > 0 && (
                    <div className="absolute z-20 mt-1.5 w-full rounded-xl border border-border bg-surface p-2 shadow-2xl max-h-60 overflow-y-auto space-y-1">
                      {filmSearchResults.map(f => (
                        <button
                          key={f.id}
                          type="button"
                          onClick={() => handleSelectExistingFilm(f)}
                          className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-surface-2 text-left transition-colors"
                        >
                          {f.poster_url ? (
                            <img src={getSafePreviewUrl(f.poster_url)} referrerPolicy="no-referrer" alt="" className="h-10 w-7 rounded object-cover border border-border" />
                          ) : (
                            <div className="h-10 w-7 rounded bg-surface-2 border border-border flex items-center justify-center text-[10px] text-text-muted">
                              🎬
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-bold text-text-primary truncate">{f.title}</p>
                            <p className="text-[10px] text-text-muted">{f.year} • {f.genres?.join(', ') || 'Nollywood'}</p>
                          </div>
                          <span className="text-[10px] font-bold text-brand uppercase bg-brand/10 px-2.5 py-1 rounded-md">
                            Select & Link
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Poster & Backdrop URLs with Upload File option */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="text-[10px] font-black uppercase tracking-wider text-text-muted block mb-1">
                  Poster URL
                </label>
                <div className="flex gap-2 items-center">
                  <input
                    type="text"
                    value={filmForm.poster_url}
                    onChange={(e) => setFilmForm(prev => ({ ...prev, poster_url: e.target.value }))}
                    placeholder="https://..."
                    className="flex-1 rounded-lg border border-border bg-surface-2 px-3 py-2 text-xs text-text-primary outline-none focus:border-brand font-mono"
                  />
                  {filmForm.poster_url && (
                    <img
                      src={getSafePreviewUrl(filmForm.poster_url)}
                      referrerPolicy="no-referrer"
                      alt=""
                      className="h-8 w-6 rounded object-cover border border-border shrink-0"
                    />
                  )}
                  <label className="inline-flex items-center gap-1 px-2.5 py-2 rounded-lg border border-border bg-surface text-xs font-bold text-text-muted hover:text-text-primary hover:border-brand cursor-pointer shrink-0 transition-colors">
                    <Icon icon={isUploadingPoster ? 'solar:spinner-linear' : 'solar:upload-linear'} className={isUploadingPoster ? 'animate-spin text-brand' : ''} />
                    <span>{isUploadingPoster ? 'Uploading…' : 'Upload'}</span>
                    <input type="file" accept="image/*" onChange={handleCustomPosterUpload} disabled={isUploadingPoster} className="hidden" />
                  </label>
                </div>
              </div>

              <div>
                <label className="text-[10px] font-black uppercase tracking-wider text-text-muted block mb-1">
                  Backdrop / Banner URL
                </label>
                <div className="flex gap-2 items-center">
                  <input
                    type="text"
                    value={filmForm.backdrop_url}
                    onChange={(e) => setFilmForm(prev => ({ ...prev, backdrop_url: e.target.value }))}
                    placeholder="https://..."
                    className="flex-1 rounded-lg border border-border bg-surface-2 px-3 py-2 text-xs text-text-primary outline-none focus:border-brand font-mono"
                  />
                  {filmForm.backdrop_url && (
                    <img
                      src={getSafePreviewUrl(filmForm.backdrop_url)}
                      referrerPolicy="no-referrer"
                      alt=""
                      className="h-8 w-12 rounded object-cover border border-border shrink-0"
                    />
                  )}
                  <label className="inline-flex items-center gap-1 px-2.5 py-2 rounded-lg border border-border bg-surface text-xs font-bold text-text-muted hover:text-text-primary hover:border-brand cursor-pointer shrink-0 transition-colors">
                    <Icon icon={isUploadingBackdrop ? 'solar:spinner-linear' : 'solar:upload-linear'} className={isUploadingBackdrop ? 'animate-spin text-brand' : ''} />
                    <span>{isUploadingBackdrop ? 'Uploading…' : 'Upload'}</span>
                    <input type="file" accept="image/*" onChange={handleCustomBackdropUpload} disabled={isUploadingBackdrop} className="hidden" />
                  </label>
                </div>
              </div>
            </div>

            {/* Title, Year, Release Date */}
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="sm:col-span-1">
                <label className="text-[10px] font-black uppercase tracking-wider text-text-muted block mb-1">
                  Title *
                </label>
                <input
                  type="text"
                  value={filmForm.title}
                  onChange={(e) => setFilmForm(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="Official Movie Title"
                  className="w-full rounded-lg border border-border bg-surface-2 px-3 py-2.5 text-sm font-bold text-text-primary outline-none focus:border-brand"
                />
              </div>

              <div>
                <label className="text-[10px] font-black uppercase tracking-wider text-text-muted block mb-1">
                  Year
                </label>
                <input
                  type="number"
                  value={filmForm.year}
                  onChange={(e) => setFilmForm(prev => ({ ...prev, year: Number(e.target.value) }))}
                  className="w-full rounded-lg border border-border bg-surface-2 px-3 py-2.5 text-sm text-text-primary outline-none focus:border-brand"
                />
              </div>

              <div>
                <label className="text-[10px] font-black uppercase tracking-wider text-text-muted block mb-1">
                  Release Date (YYYY-MM-DD)
                </label>
                <input
                  type="date"
                  value={filmForm.release_date || ''}
                  onChange={(e) => setFilmForm(prev => ({ ...prev, release_date: e.target.value }))}
                  className="w-full rounded-lg border border-border bg-surface-2 px-3 py-2 text-xs text-text-primary outline-none focus:border-brand"
                />
              </div>
            </div>

            {/* Director, Platform, Content Type */}
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <label className="text-[10px] font-black uppercase tracking-wider text-text-muted block mb-1">
                  Director (Real Name)
                </label>
                <PersonSearchInput
                  value={filmForm.director}
                  personId={filmForm.director_person_id}
                  defaultDepartment="Directing"
                  placeholder="Search or create director (e.g. Kunle Afolayan)"
                  inputClassName={`w-full rounded-lg border bg-surface-2 px-3 py-2.5 pr-14 text-sm text-text-primary outline-none transition-colors ${
                    filmForm.director_person_id ? 'border-emerald-500/50 focus:border-emerald-400' : 'border-border focus:border-brand'
                  }`}
                  onChange={({ name, person_id }) =>
                    setFilmForm(prev => ({ ...prev, director: name, director_person_id: person_id }))
                  }
                />
              </div>

              <div>
                <label className="text-[10px] font-black uppercase tracking-wider text-text-muted block mb-1">
                  Primary Platform
                </label>
                <select
                  value={filmForm.platform}
                  onChange={(e) => setFilmForm(prev => ({ ...prev, platform: e.target.value }))}
                  className="w-full rounded-lg border border-border bg-surface-2 px-3 py-2.5 text-xs font-bold text-text-primary outline-none focus:border-brand"
                >
                  <option value="Cinema">Cinema</option>
                  <option value="Prime Video">Prime Video</option>
                  <option value="Netflix">Netflix</option>
                  <option value="YouTube">YouTube</option>
                  <option value="Showmax">Showmax</option>
                  <option value="Festival">Film Festival</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] font-black uppercase tracking-wider text-text-muted block mb-1">
                  Content Type
                </label>
                <select
                  value={filmForm.content_type}
                  onChange={(e) => setFilmForm(prev => ({ ...prev, content_type: e.target.value }))}
                  className="w-full rounded-lg border border-border bg-surface-2 px-3 py-2.5 text-xs font-bold text-text-primary outline-none focus:border-brand"
                >
                  <option value="movie">Feature Film (Movie)</option>
                  <option value="series">TV / Web Series</option>
                  <option value="short">Short Film</option>
                </select>
              </div>
            </div>

            {/* Synopsis */}
            <div>
              <label className="text-[10px] font-black uppercase tracking-wider text-text-muted block mb-1">
                Synopsis *
              </label>
              <textarea
                value={filmForm.synopsis}
                onChange={(e) => setFilmForm(prev => ({ ...prev, synopsis: e.target.value }))}
                rows={4}
                placeholder="Full synopsis of the film..."
                className="w-full rounded-xl border border-border bg-surface-2 p-3 text-xs leading-relaxed text-text-primary outline-none focus:border-brand"
              />
            </div>

            {/* Genres selector */}
            <div>
              <label className="text-[10px] font-black uppercase tracking-wider text-text-muted block mb-1.5">
                Genres
              </label>
              <div className="flex flex-wrap gap-1.5">
                {STANDARD_GENRES.map(g => {
                  const isSelected = filmForm.genres.includes(g);
                  return (
                    <button
                      key={g}
                      type="button"
                      onClick={() => handleToggleGenre(g)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                        isSelected
                          ? 'bg-brand text-white'
                          : 'bg-surface-2 text-text-muted border border-border hover:border-brand/40'
                      }`}
                    >
                      {g}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Cast Table */}
            <div className="rounded-xl border border-border bg-surface-2/40 p-4 space-y-3">
              <div className="flex items-center justify-between border-b border-border/40 pb-2">
                <div>
                  <h4 className="text-xs font-black uppercase tracking-wider text-text-primary">
                    Cast Ensemble ({filmForm.cast?.length || 0})
                  </h4>
                  <p className="text-[10px] text-text-muted">
                    Linked in-place to person profiles. Actors will not be duplicated.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleAddManualCastRow}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-border bg-surface text-xs font-bold text-text-primary hover:border-brand"
                >
                  <Icon icon="solar:user-plus-linear" />
                  Add Row
                </button>
              </div>

              {filmForm.cast?.length === 0 ? (
                <p className="text-xs text-text-muted italic py-3 text-center">
                  No cast members added yet. Quick-add from @mentions above or click "Add Row".
                </p>
              ) : (
                <div className="space-y-2">
                  {filmForm.cast.map((c, idx) => {
                    const actorName = typeof c === 'string' ? c : (c.name || '');
                    const charName = typeof c === 'object' ? (c.character_name || '') : '';

                    return (
                      <div key={idx} className="flex items-center gap-2 bg-surface p-2 rounded-lg border border-border/60">
                        <span className="text-[10px] font-black text-text-muted w-5 text-center">
                          #{idx + 1}
                        </span>
                        <PersonSearchInput
                          className="flex-1"
                          value={actorName}
                          personId={typeof c === 'object' ? (c.person_id || null) : null}
                          defaultDepartment="Acting"
                          placeholder="Search or create actor (e.g. Deyemi Okanlawon)"
                          onChange={({ name, person_id }) =>
                            handleUpdateCastRow(idx, { name, person_id })
                          }
                        />
                        <input
                          type="text"
                          value={charName}
                          onChange={(e) => handleUpdateCastRow(idx, 'character_name', e.target.value)}
                          placeholder="Character (e.g. Oba)"
                          className="w-40 rounded border border-border bg-surface-2 px-2.5 py-1.5 text-xs text-text-primary outline-none focus:border-brand"
                        />
                        <button
                          type="button"
                          onClick={() => handleRemoveCastRow(idx)}
                          className="p-1.5 text-text-muted hover:text-red-400 transition-colors"
                          title="Remove row"
                        >
                          <Icon icon="solar:trash-bin-trash-linear" width="16" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Crew & Production Ensemble */}
            <div className="rounded-xl border border-border bg-surface-2/40 p-4 space-y-3">
              <div className="flex items-center justify-between border-b border-border/40 pb-2">
                <div>
                  <h4 className="text-xs font-black uppercase tracking-wider text-text-primary">
                    Crew & Production Ensemble ({filmForm.crew?.length || 0})
                  </h4>
                  <p className="text-[10px] text-text-muted">
                    Directors, Producers, Writers, DOPs, Editors & Key Heads.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleAddManualCrewRow}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-border bg-surface text-xs font-bold text-text-primary hover:border-brand transition-colors"
                >
                  <Icon icon="solar:user-plus-linear" />
                  Add Row
                </button>
              </div>

              {filmForm.crew?.length === 0 ? (
                <p className="text-xs text-text-muted italic py-3 text-center">
                  No crew members added yet. Quick-assign from @mentions above (+ Dir, + Prod, + Writer) or click "Add Row".
                </p>
              ) : (
                <div className="space-y-2">
                  {filmForm.crew.map((c, idx) => (
                    <div key={idx} className="flex items-center gap-2 bg-surface p-2 rounded-lg border border-border/60">
                      <span className="text-[10px] font-black text-text-muted w-5 text-center">
                        #{idx + 1}
                      </span>
                      <PersonSearchInput
                        className="flex-1"
                        value={c.name || ''}
                        personId={c.person_id || null}
                        defaultDepartment="Production"
                        placeholder="Search or create crew (e.g. Jade Osiberu)"
                        onChange={({ name, person_id }) =>
                          handleUpdateCrewRow(idx, { name, person_id })
                        }
                      />
                      <select
                        value={c.role || 'producer'}
                        onChange={(e) => handleUpdateCrewRow(idx, 'role', e.target.value)}
                        className="w-48 rounded border border-border bg-surface-2 px-2.5 py-1.5 text-xs font-bold text-text-primary outline-none focus:border-brand"
                      >
                        {FILM_CREW_ROLES.map(r => (
                          <option key={r.id} value={r.id}>{r.label}</option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => handleRemoveCrewRow(idx)}
                        className="p-1.5 text-text-muted hover:text-red-400 transition-colors"
                        title="Remove crew row"
                      >
                        <Icon icon="solar:trash-bin-trash-linear" width="16" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* 🎭 STAGE PLAY FORM */}
        {activeTab === 'play' && (
          <div className="space-y-6 animate-fadeIn">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-border/40 pb-3">
              <div>
                <h3 className="text-sm font-black uppercase tracking-wider text-brand">
                  1. Stage Play / Theatre Details
                </h3>
                <p className="text-xs text-text-muted">Extract and list theatre productions, stage performances, and creative teams.</p>
              </div>
              <span className="text-xs font-bold text-text-muted">
                Live Theatre & Stage Play Hub
              </span>
            </div>

            {/* Mode Switch: Create New Stage Play vs Link & Enrich Existing Play */}
            <div className="p-3.5 rounded-xl bg-surface-2/60 border border-border space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setPlayMode('new');
                      handleUnlinkPlay();
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                      playMode === 'new' && !linkedPlay
                        ? 'bg-brand text-white shadow-sm'
                        : 'bg-surface text-text-muted hover:text-text-primary border border-border'
                    }`}
                  >
                    <Icon icon="solar:mask-hamsa-linear" width="14" />
                    <span>+ Create New Stage Play</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPlayMode('link')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                      playMode === 'link' || linkedPlay
                        ? 'bg-brand text-white shadow-sm'
                        : 'bg-surface text-text-muted hover:text-text-primary border border-border'
                    }`}
                  >
                    <Icon icon="solar:link-circle-linear" width="14" />
                    <span>Link & Enrich Existing Play</span>
                  </button>
                </div>

                {linkedPlay && (
                  <div className="flex items-center gap-2 text-xs bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 px-3 py-1 rounded-lg">
                    <Icon icon="solar:check-circle-bold" width="15" />
                    <span>Enriching: <strong>{linkedPlay.title} ({linkedPlay.venue})</strong></span>
                    <button
                      type="button"
                      onClick={handleUnlinkPlay}
                      className="ml-2 text-text-muted hover:text-red-400 p-0.5 transition-colors"
                      title="Unlink and revert to new stage play"
                    >
                      <Icon icon="solar:close-circle-linear" width="16" />
                    </button>
                  </div>
                )}
              </div>

              {playMode === 'link' && !linkedPlay && (
                <div className="relative pt-1 animate-fadeIn">
                  <div className="relative">
                    <Icon icon="solar:magnifer-linear" className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" width="16" />
                    <input
                      type="text"
                      value={playSearchQuery}
                      onChange={(e) => setPlaySearchQuery(e.target.value)}
                      placeholder="Type play title to search and enrich existing theatre production in MuviDB..."
                      className="w-full rounded-xl border border-border bg-surface pl-9 pr-8 py-2.5 text-xs text-text-primary outline-none focus:border-brand font-medium placeholder:text-text-muted/50"
                    />
                    {isSearchingPlays && (
                      <Icon icon="solar:spinner-linear" className="animate-spin absolute right-3 top-1/2 -translate-y-1/2 text-brand" width="16" />
                    )}
                  </div>

                  {playSearchResults.length > 0 && (
                    <div className="absolute z-20 mt-1.5 w-full rounded-xl border border-border bg-surface p-2 shadow-2xl max-h-60 overflow-y-auto space-y-1">
                      {playSearchResults.map(p => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => handleSelectExistingPlay(p)}
                          className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-surface-2 text-left transition-colors"
                        >
                          {p.poster_url ? (
                            <img src={getSafePreviewUrl(p.poster_url)} referrerPolicy="no-referrer" alt="" className="h-10 w-7 rounded object-cover border border-border" />
                          ) : (
                            <div className="h-10 w-7 rounded bg-surface-2 border border-border flex items-center justify-center text-[10px] text-text-muted">
                              🎭
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-bold text-text-primary truncate">{p.title}</p>
                            <p className="text-[10px] text-text-muted">{p.venue} • {p.city || 'Lagos'}</p>
                          </div>
                          <span className="text-[10px] font-bold text-brand uppercase bg-brand/10 px-2.5 py-1 rounded-md">
                            Select & Link
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Poster Flyer & Banner URLs with Upload File option */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="text-[10px] font-black uppercase tracking-wider text-text-muted block mb-1">
                  Poster Flyer URL
                </label>
                <div className="flex gap-2 items-center">
                  <input
                    type="text"
                    value={playForm.poster_url}
                    onChange={(e) => setPlayForm(prev => ({ ...prev, poster_url: e.target.value }))}
                    placeholder="https://..."
                    className="flex-1 rounded-lg border border-border bg-surface-2 px-3 py-2 text-xs text-text-primary outline-none focus:border-brand font-mono"
                  />
                  {playForm.poster_url && (
                    <img
                      src={getSafePreviewUrl(playForm.poster_url)}
                      referrerPolicy="no-referrer"
                      alt=""
                      className="h-8 w-6 rounded object-cover border border-border shrink-0"
                    />
                  )}
                  <label className="inline-flex items-center gap-1 px-2.5 py-2 rounded-lg border border-border bg-surface text-xs font-bold text-text-muted hover:text-text-primary hover:border-brand cursor-pointer shrink-0 transition-colors">
                    <Icon icon={isUploadingPoster ? 'solar:spinner-linear' : 'solar:upload-linear'} className={isUploadingPoster ? 'animate-spin text-brand' : ''} />
                    <span>{isUploadingPoster ? 'Uploading…' : 'Upload'}</span>
                    <input type="file" accept="image/*" onChange={handleCustomPosterUpload} disabled={isUploadingPoster} className="hidden" />
                  </label>
                </div>
              </div>

              <div>
                <label className="text-[10px] font-black uppercase tracking-wider text-text-muted block mb-1">
                  Banner / Venue Artwork URL
                </label>
                <div className="flex gap-2 items-center">
                  <input
                    type="text"
                    value={playForm.banner_url}
                    onChange={(e) => setPlayForm(prev => ({ ...prev, banner_url: e.target.value }))}
                    placeholder="https://..."
                    className="flex-1 rounded-lg border border-border bg-surface-2 px-3 py-2 text-xs text-text-primary outline-none focus:border-brand font-mono"
                  />
                  {playForm.banner_url && (
                    <img
                      src={getSafePreviewUrl(playForm.banner_url)}
                      referrerPolicy="no-referrer"
                      alt=""
                      className="h-8 w-12 rounded object-cover border border-border shrink-0"
                    />
                  )}
                  <label className="inline-flex items-center gap-1 px-2.5 py-2 rounded-lg border border-border bg-surface text-xs font-bold text-text-muted hover:text-text-primary hover:border-brand cursor-pointer shrink-0 transition-colors">
                    <Icon icon={isUploadingBackdrop ? 'solar:spinner-linear' : 'solar:upload-linear'} className={isUploadingBackdrop ? 'animate-spin text-brand' : ''} />
                    <span>{isUploadingBackdrop ? 'Uploading…' : 'Upload'}</span>
                    <input type="file" accept="image/*" onChange={handleCustomBackdropUpload} disabled={isUploadingBackdrop} className="hidden" />
                  </label>
                </div>
              </div>
            </div>

            {/* Title, Year, Status */}
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="sm:col-span-1">
                <label className="text-[10px] font-black uppercase tracking-wider text-text-muted block mb-1">
                  Stage Play Title *
                </label>
                <input
                  type="text"
                  value={playForm.title}
                  onChange={(e) => setPlayForm(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="e.g. Saro The Musical"
                  className="w-full rounded-lg border border-border bg-surface-2 px-3 py-2.5 text-sm font-bold text-text-primary outline-none focus:border-brand"
                />
              </div>

              <div>
                <label className="text-[10px] font-black uppercase tracking-wider text-text-muted block mb-1">
                  Year
                </label>
                <input
                  type="number"
                  value={playForm.year}
                  onChange={(e) => setPlayForm(prev => ({ ...prev, year: Number(e.target.value) }))}
                  className="w-full rounded-lg border border-border bg-surface-2 px-3 py-2.5 text-sm text-text-primary outline-none focus:border-brand"
                />
              </div>

              <div>
                <label className="text-[10px] font-black uppercase tracking-wider text-text-muted block mb-1">
                  Status
                </label>
                <select
                  value={playForm.status}
                  onChange={(e) => setPlayForm(prev => ({ ...prev, status: e.target.value }))}
                  className="w-full rounded-lg border border-border bg-surface-2 px-3 py-2.5 text-xs font-bold text-text-primary outline-none focus:border-brand"
                >
                  <option value="upcoming">Upcoming</option>
                  <option value="currently_running">Currently Running</option>
                  <option value="archived">Archived / Past Production</option>
                </select>
              </div>
            </div>

            {/* Venue, City, Country */}
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <label className="text-[10px] font-black uppercase tracking-wider text-text-muted block mb-1">
                  Venue Name
                </label>
                <input
                  type="text"
                  value={playForm.venue}
                  onChange={(e) => setPlayForm(prev => ({ ...prev, venue: e.target.value }))}
                  placeholder="e.g. Terra Kulture, Muson Centre"
                  className="w-full rounded-lg border border-border bg-surface-2 px-3 py-2 text-xs text-text-primary outline-none focus:border-brand"
                />
              </div>

              <div>
                <label className="text-[10px] font-black uppercase tracking-wider text-text-muted block mb-1">
                  City
                </label>
                <input
                  type="text"
                  value={playForm.city}
                  onChange={(e) => setPlayForm(prev => ({ ...prev, city: e.target.value }))}
                  placeholder="Lagos"
                  className="w-full rounded-lg border border-border bg-surface-2 px-3 py-2 text-xs text-text-primary outline-none focus:border-brand"
                />
              </div>

              <div>
                <label className="text-[10px] font-black uppercase tracking-wider text-text-muted block mb-1">
                  Performance Time
                </label>
                <input
                  type="text"
                  value={playForm.performance_time}
                  onChange={(e) => setPlayForm(prev => ({ ...prev, performance_time: e.target.value }))}
                  placeholder="e.g. 3:00 PM & 7:00 PM"
                  className="w-full rounded-lg border border-border bg-surface-2 px-3 py-2 text-xs text-text-primary outline-none focus:border-brand"
                />
              </div>
            </div>

            {/* Dates */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="text-[10px] font-black uppercase tracking-wider text-text-muted block mb-1">
                  Run Start Date
                </label>
                <input
                  type="date"
                  value={playForm.run_start_date || ''}
                  onChange={(e) => setPlayForm(prev => ({ ...prev, run_start_date: e.target.value }))}
                  className="w-full rounded-lg border border-border bg-surface-2 px-3 py-2 text-xs text-text-primary outline-none focus:border-brand"
                />
              </div>

              <div>
                <label className="text-[10px] font-black uppercase tracking-wider text-text-muted block mb-1">
                  Run End Date
                </label>
                <input
                  type="date"
                  value={playForm.run_end_date || ''}
                  onChange={(e) => setPlayForm(prev => ({ ...prev, run_end_date: e.target.value }))}
                  className="w-full rounded-lg border border-border bg-surface-2 px-3 py-2 text-xs text-text-primary outline-none focus:border-brand"
                />
              </div>
            </div>

            {/* Playwright, Director, Producer */}
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <label className="text-[10px] font-black uppercase tracking-wider text-text-muted block mb-1">
                  Playwright (Writer)
                </label>
                <PersonSearchInput
                  value={playForm.playwright}
                  defaultDepartment="Writing"
                  placeholder="Search or create playwright (e.g. Wole Soyinka)"
                  inputClassName="w-full rounded-lg border border-border bg-surface-2 px-3 py-2 pr-14 text-xs text-text-primary outline-none focus:border-brand"
                  onChange={({ name, person_id }) =>
                    setPlayForm(prev => {
                      const crew = [...(prev.crew || [])];
                      if (person_id && name) {
                        const existingIdx = crew.findIndex(c => c.role === 'playwright' && (c.person_id === person_id || (c.name || '').toLowerCase() === name.toLowerCase()));
                        if (existingIdx >= 0) crew[existingIdx] = { ...crew[existingIdx], name, person_id };
                        else crew.push({ name, person_id, role: 'playwright' });
                      }
                      return { ...prev, playwright: name, crew };
                    })
                  }
                />
              </div>

              <div>
                <label className="text-[10px] font-black uppercase tracking-wider text-text-muted block mb-1">
                  Stage Director
                </label>
                <PersonSearchInput
                  value={playForm.director}
                  defaultDepartment="Directing"
                  placeholder="Search or create director (e.g. Bolanle Austen-Peters)"
                  inputClassName="w-full rounded-lg border border-border bg-surface-2 px-3 py-2 pr-14 text-xs text-text-primary outline-none focus:border-brand"
                  onChange={({ name, person_id }) =>
                    setPlayForm(prev => {
                      const crew = [...(prev.crew || [])];
                      if (person_id && name) {
                        const existingIdx = crew.findIndex(c => c.role === 'director' && (c.person_id === person_id || (c.name || '').toLowerCase() === name.toLowerCase()));
                        if (existingIdx >= 0) crew[existingIdx] = { ...crew[existingIdx], name, person_id };
                        else crew.push({ name, person_id, role: 'director' });
                      }
                      return { ...prev, director: name, crew };
                    })
                  }
                />
              </div>

              <div>
                <label className="text-[10px] font-black uppercase tracking-wider text-text-muted block mb-1">
                  Producer / Production House
                </label>
                <PersonSearchInput
                  value={playForm.producer}
                  defaultDepartment="Production"
                  placeholder="Search or type producer / house"
                  inputClassName="w-full rounded-lg border border-border bg-surface-2 px-3 py-2 pr-14 text-xs text-text-primary outline-none focus:border-brand"
                  onChange={({ name }) => setPlayForm(prev => ({ ...prev, producer: name }))}
                />
              </div>
            </div>

            {/* Synopsis */}
            <div>
              <label className="text-[10px] font-black uppercase tracking-wider text-text-muted block mb-1">
                Stage Synopsis
              </label>
              <textarea
                value={playForm.synopsis}
                onChange={(e) => setPlayForm(prev => ({ ...prev, synopsis: e.target.value }))}
                rows={3}
                placeholder="Storyline of the stage play..."
                className="w-full rounded-xl border border-border bg-surface-2 p-3 text-xs leading-relaxed text-text-primary outline-none focus:border-brand"
              />
            </div>

            {/* Stage Cast Ensemble Table */}
            <div className="rounded-xl border border-border bg-surface-2/40 p-4 space-y-3">
              <div className="flex items-center justify-between border-b border-border/40 pb-2">
                <div>
                  <h4 className="text-xs font-black uppercase tracking-wider text-text-primary">
                    Stage Cast Ensemble ({playForm.cast?.length || 0})
                  </h4>
                  <p className="text-[10px] text-text-muted">
                    Actors performing on stage in this theatre run.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleAddPlayCastRow}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-border bg-surface text-xs font-bold text-text-primary hover:border-brand transition-colors"
                >
                  <Icon icon="solar:user-plus-linear" />
                  Add Row
                </button>
              </div>

              {playForm.cast?.length === 0 ? (
                <p className="text-xs text-text-muted italic py-3 text-center">
                  No stage cast added yet. Quick-add from @mentions above or click "Add Row".
                </p>
              ) : (
                <div className="space-y-2">
                  {playForm.cast.map((c, idx) => (
                    <div key={idx} className="flex items-center gap-2 bg-surface p-2 rounded-lg border border-border/60">
                      <span className="text-[10px] font-black text-text-muted w-5 text-center">
                        #{idx + 1}
                      </span>
                      <PersonSearchInput
                        className="flex-1"
                        value={c.name || ''}
                        personId={c.person_id || null}
                        defaultDepartment="Acting"
                        placeholder="Search or create stage actor (e.g. Bimbo Manuel)"
                        onChange={({ name, person_id }) =>
                          handleUpdatePlayCastRow(idx, { name, person_id })
                        }
                      />
                      <input
                        type="text"
                        value={c.character_name || ''}
                        onChange={(e) => handleUpdatePlayCastRow(idx, 'character_name', e.target.value)}
                        placeholder="Role / Character"
                        className="w-40 rounded border border-border bg-surface-2 px-2.5 py-1.5 text-xs text-text-primary outline-none focus:border-brand"
                      />
                      <button
                        type="button"
                        onClick={() => handleRemovePlayCastRow(idx)}
                        className="p-1.5 text-text-muted hover:text-red-400 transition-colors"
                        title="Remove actor"
                      >
                        <Icon icon="solar:trash-bin-trash-linear" width="16" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Stage Crew & Creatives Table */}
            <div className="rounded-xl border border-border bg-surface-2/40 p-4 space-y-3">
              <div className="flex items-center justify-between border-b border-border/40 pb-2">
                <div>
                  <h4 className="text-xs font-black uppercase tracking-wider text-text-primary">
                    Stage Crew & Creatives ({playForm.crew?.length || 0})
                  </h4>
                  <p className="text-[10px] text-text-muted">
                    Stage directors, playwrights, producers, lighting, costume, and crew.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleAddPlayCrewRow}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-border bg-surface text-xs font-bold text-text-primary hover:border-brand transition-colors"
                >
                  <Icon icon="solar:user-plus-linear" />
                  Add Row
                </button>
              </div>

              {playForm.crew?.length === 0 ? (
                <p className="text-xs text-text-muted italic py-3 text-center">
                  No stage crew added yet. Quick-assign from @mentions above or click "Add Row".
                </p>
              ) : (
                <div className="space-y-2">
                  {playForm.crew.map((c, idx) => (
                    <div key={idx} className="flex items-center gap-2 bg-surface p-2 rounded-lg border border-border/60">
                      <span className="text-[10px] font-black text-text-muted w-5 text-center">
                        #{idx + 1}
                      </span>
                      <PersonSearchInput
                        className="flex-1"
                        value={c.name || ''}
                        personId={c.person_id || null}
                        defaultDepartment="Crew"
                        placeholder="Search or create creative / crew"
                        onChange={({ name, person_id }) =>
                          handleUpdatePlayCrewRow(idx, { name, person_id })
                        }
                      />
                      <select
                        value={c.role || 'stage_manager'}
                        onChange={(e) => handleUpdatePlayCrewRow(idx, 'role', e.target.value)}
                        className="w-48 rounded border border-border bg-surface-2 px-2.5 py-1.5 text-xs font-bold text-text-primary outline-none focus:border-brand"
                      >
                        {STAGE_CREW_ROLES.map(r => (
                          <option key={r.id} value={r.id}>{r.label}</option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => handleRemovePlayCrewRow(idx)}
                        className="p-1.5 text-text-muted hover:text-red-400 transition-colors"
                        title="Remove crew row"
                      >
                        <Icon icon="solar:trash-bin-trash-linear" width="16" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ⭐ CRITIC REVIEW FORM */}
        {activeTab === 'critic_review' && (
          <div className="space-y-6 animate-fadeIn">
            <div className="border-b border-border/40 pb-3">
              <h3 className="text-sm font-black uppercase tracking-wider text-brand">
                1. Critic Review Details
              </h3>
              <p className="text-xs text-text-muted">Link a verified press or social review quote to a film or play.</p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="text-[10px] font-black uppercase tracking-wider text-text-muted block mb-1">
                  Film or Stage Play Title *
                </label>
                <input
                  type="text"
                  value={reviewForm.film_title}
                  onChange={(e) => setReviewForm(prev => ({ ...prev, film_title: e.target.value }))}
                  placeholder="Enter film title to match..."
                  className="w-full rounded-lg border border-border bg-surface-2 px-3 py-2.5 text-sm font-bold text-text-primary outline-none focus:border-brand"
                />
              </div>

              <div>
                <label className="text-[10px] font-black uppercase tracking-wider text-text-muted block mb-1">
                  Critic / Reviewer Name *
                </label>
                <input
                  type="text"
                  value={reviewForm.critic_name}
                  onChange={(e) => setReviewForm(prev => ({ ...prev, critic_name: e.target.value }))}
                  placeholder="e.g. CinemaPointer, In Nollywood"
                  className="w-full rounded-lg border border-border bg-surface-2 px-3 py-2.5 text-sm text-text-primary outline-none focus:border-brand"
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <label className="text-[10px] font-black uppercase tracking-wider text-text-muted block mb-1">
                  Publication / Channel
                </label>
                <input
                  type="text"
                  value={reviewForm.publication}
                  onChange={(e) => setReviewForm(prev => ({ ...prev, publication: e.target.value }))}
                  placeholder="e.g. Pulse Nigeria, What Kept Me Up"
                  className="w-full rounded-lg border border-border bg-surface-2 px-3 py-2 text-xs text-text-primary outline-none focus:border-brand"
                />
              </div>

              <div>
                <label className="text-[10px] font-black uppercase tracking-wider text-text-muted block mb-1">
                  Rating ({reviewForm.rating} / {reviewForm.rating_scale})
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min="1"
                    max={reviewForm.rating_scale}
                    step="0.5"
                    value={reviewForm.rating || 0}
                    onChange={(e) => setReviewForm(prev => ({ ...prev, rating: Number(e.target.value) }))}
                    className="flex-1 accent-brand"
                  />
                  <span className="font-bold text-xs text-text-primary w-8">{reviewForm.rating}</span>
                </div>
              </div>

              <div>
                <label className="text-[10px] font-black uppercase tracking-wider text-text-muted block mb-1">
                  Rating Scale
                </label>
                <select
                  value={reviewForm.rating_scale}
                  onChange={(e) => setReviewForm(prev => ({ ...prev, rating_scale: Number(e.target.value) }))}
                  className="w-full rounded-lg border border-border bg-surface-2 px-3 py-2 text-xs font-bold text-text-primary outline-none focus:border-brand"
                >
                  <option value="10">Out of 10</option>
                  <option value="5">Out of 5</option>
                  <option value="100">Out of 100%</option>
                </select>
              </div>
            </div>

            <div>
              <label className="text-[10px] font-black uppercase tracking-wider text-text-muted block mb-1">
                Review Pull-Quote *
              </label>
              <textarea
                value={reviewForm.quote}
                onChange={(e) => setReviewForm(prev => ({ ...prev, quote: e.target.value }))}
                rows={4}
                placeholder="The punchy verdict or review summary..."
                className="w-full rounded-xl border border-border bg-surface-2 p-3 text-xs leading-relaxed text-text-primary outline-none focus:border-brand"
              />
            </div>

            <div>
              <label className="text-[10px] font-black uppercase tracking-wider text-text-muted block mb-1">
                Full Review Link / Source URL
              </label>
              <input
                type="text"
                value={reviewForm.review_url}
                onChange={(e) => setReviewForm(prev => ({ ...prev, review_url: e.target.value }))}
                placeholder="https://..."
                className="w-full rounded-lg border border-border bg-surface-2 px-3 py-2 text-xs text-text-primary outline-none focus:border-brand font-mono"
              />
            </div>
          </div>
        )}

        {/* 📱 SOCIAL STUDIO DRAFT FORM */}
        {activeTab === 'social_post' && (
          <div className="space-y-6 animate-fadeIn">
            <div className="border-b border-border/40 pb-3">
              <h3 className="text-sm font-black uppercase tracking-wider text-brand">
                1. Social Studio Draft
              </h3>
              <p className="text-xs text-text-muted">Prepare a multi-platform editorial draft for Social Studio.</p>
            </div>

            <div>
              <label className="text-[10px] font-black uppercase tracking-wider text-text-muted block mb-1">
                Post Headline / Topic
              </label>
              <input
                type="text"
                value={socialForm.headline}
                onChange={(e) => setSocialForm(prev => ({ ...prev, headline: e.target.value }))}
                placeholder="Punchy editorial headline..."
                className="w-full rounded-lg border border-border bg-surface-2 px-3 py-2.5 text-sm font-bold text-text-primary outline-none focus:border-brand"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="text-[10px] font-black uppercase tracking-wider text-text-muted block mb-1">
                  Instagram Caption
                </label>
                <textarea
                  value={socialForm.instagram_caption}
                  onChange={(e) => setSocialForm(prev => ({ ...prev, instagram_caption: e.target.value }))}
                  rows={5}
                  className="w-full rounded-xl border border-border bg-surface-2 p-3 text-xs leading-relaxed text-text-primary outline-none focus:border-brand"
                />
              </div>

              <div>
                <label className="text-[10px] font-black uppercase tracking-wider text-text-muted block mb-1">
                  Facebook Caption
                </label>
                <textarea
                  value={socialForm.facebook_caption}
                  onChange={(e) => setSocialForm(prev => ({ ...prev, facebook_caption: e.target.value }))}
                  rows={5}
                  className="w-full rounded-xl border border-border bg-surface-2 p-3 text-xs leading-relaxed text-text-primary outline-none focus:border-brand"
                />
              </div>
            </div>

            <div>
              <label className="text-[10px] font-black uppercase tracking-wider text-text-muted block mb-1">
                Threads / X Short Post
              </label>
              <textarea
                value={socialForm.threads_post}
                onChange={(e) => setSocialForm(prev => ({ ...prev, threads_post: e.target.value }))}
                rows={3}
                className="w-full rounded-xl border border-border bg-surface-2 p-3 text-xs leading-relaxed text-text-primary outline-none focus:border-brand"
              />
            </div>
          </div>
        )}

        {/* ── Publish / Action Button ── */}
        <div className="border-t border-border/50 pt-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <p className="text-xs text-text-muted">
            All records pass through the MuviDB deduplication & credit integrity gate.
          </p>

          <button
            type="button"
            onClick={handlePublish}
            disabled={isPublishing}
            className="inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-xl bg-brand text-white font-black text-sm hover:brightness-110 active:scale-95 disabled:opacity-50 transition-all shadow-xl shadow-brand/20"
          >
            {isPublishing ? (
              <>
                <Icon icon="solar:spinner-linear" className="animate-spin" width="20" />
                <span>Creating Record…</span>
              </>
            ) : (
              <>
                <Icon
                  icon={
                    activeTab === 'film'
                      ? 'solar:clapperboard-play-bold'
                      : activeTab === 'play'
                      ? 'solar:mask-hamsa-bold'
                      : activeTab === 'critic_review'
                      ? 'solar:chat-round-bold'
                      : 'solar:magic-stick-3-bold'
                  }
                  width="20"
                />
                <span>
                  {activeTab === 'film'
                    ? 'Create Film in MuviDB'
                    : activeTab === 'play'
                    ? 'Create Stage Play in MuviDB'
                    : activeTab === 'critic_review'
                    ? 'Publish Critic Review'
                    : 'Create Social Studio Draft'}
                </span>
              </>
            )}
          </button>
        </div>

        {/* Success Card */}
        {publishResult && (
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 space-y-2 animate-fadeIn">
            <div className="flex items-center gap-2 text-emerald-400 font-black text-sm">
              <Icon icon="solar:check-circle-bold" width="20" />
              <span>Created Successfully!</span>
            </div>
            <p className="text-xs text-text-muted">
              {publishResult.title ? `"${publishResult.title}" has been saved.` : 'Record created in database.'}
            </p>
            <div className="flex flex-wrap gap-3 pt-2">
              {publishResult.viewUrl && (
                <a
                  href={publishResult.viewUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-bold shadow hover:brightness-110 transition-all"
                >
                  <Icon icon="solar:link-circle-linear" />
                  View Public Page
                </a>
              )}
              {publishResult.adminUrl && (
                <Link
                  to={publishResult.adminUrl}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-surface text-text-primary text-xs font-bold hover:border-brand transition-all"
                >
                  <Icon icon="solar:pen-new-square-linear" />
                  Manage in Admin
                </Link>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
