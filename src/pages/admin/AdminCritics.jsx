import React, { useEffect, useRef, useState } from 'react';
import { Icon } from '@iconify/react';
import { fetchCritics, upsertCritic, deleteCritic, upsertCriticReview, deleteCriticReview } from '../../lib/critics';
import { supabase } from '../../lib/supabase';
import ImageField from '../../components/admin/ImageField';
import Drawer from '../../components/admin/Drawer';
import SEO from '../../components/SEO';

const BLANK_CRITIC = {
  name: '',
  slug: '',
  title: '',
  publication: '',
  bio: '',
  avatar_url: '',
  platform: '',
  handle: '',
  profile_url: '',
  is_verified: true,
};

const BLANK_REVIEW = {
  critic_id: '',
  film_id: '',
  quote: '',
  rating: '',
  review_url: '',
  source_publication: '',
};

export default function AdminCritics() {
  const [critics, setCritics] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [verifiedFilter, setVerifiedFilter] = useState('all');

  // -- Critic Drawer state ----------------------------------------------------
  const [isCriticDrawerOpen, setIsCriticDrawerOpen] = useState(false);
  const [editingCritic, setEditingCritic] = useState(null);
  const [criticFormData, setCriticFormData] = useState(BLANK_CRITIC);
  const [criticFormMsg, setCriticFormMsg] = useState(null);
  const [savingCritic, setSavingCritic] = useState(false);

  // -- Review Linker Drawer state --------------------------------------------
  const [isReviewDrawerOpen, setIsReviewDrawerOpen] = useState(false);
  const [reviewForm, setReviewForm] = useState(BLANK_REVIEW);
  const [reviewMsg, setReviewMsg] = useState(null);
  const [savingReview, setSavingReview] = useState(false);
  const [existingReviews, setExistingReviews] = useState([]);
  const [loadingReviews, setLoadingReviews] = useState(false);

  // -- Film search for review drawer ----------------------------------------
  const [filmSearch, setFilmSearch] = useState('');
  const [filmResults, setFilmResults] = useState([]);
  const [isSearchingFilms, setIsSearchingFilms] = useState(false);
  const [showFilmDropdown, setShowFilmDropdown] = useState(false);
  const [selectedFilm, setSelectedFilm] = useState(null);
  const filmSearchTimeout = useRef(null);
  const filmDropdownRef = useRef(null);

  // -- Critic search for review drawer ---------------------------------------
  const [reviewCriticSearch, setReviewCriticSearch] = useState('');
  const [reviewCriticResults, setReviewCriticResults] = useState([]);
  const [showCriticDropdown, setShowCriticDropdown] = useState(false);
  const [selectedCritic, setSelectedCritic] = useState(null);
  const criticDropdownRef = useRef(null);

  async function loadData() {
    setLoading(true);
    const data = await fetchCritics();
    setCritics(data);
    setLoading(false);
  }

  useEffect(() => {
    loadData();
  }, []);

  // Close search dropdowns on outside click
  useEffect(() => {
    function handler(e) {
      if (filmDropdownRef.current && !filmDropdownRef.current.contains(e.target)) setShowFilmDropdown(false);
      if (criticDropdownRef.current && !criticDropdownRef.current.contains(e.target)) setShowCriticDropdown(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Open Critic Drawer
  const handleOpenCriticDrawer = (critic = null) => {
    setCriticFormMsg(null);
    if (critic) {
      setEditingCritic(critic);
      setCriticFormData({
        name: critic.name || '',
        slug: critic.slug || '',
        title: critic.title || '',
        publication: critic.publication || '',
        bio: critic.bio || '',
        avatar_url: critic.avatar_url || '',
        platform: critic.platform || '',
        handle: critic.handle || '',
        profile_url: critic.profile_url || '',
        is_verified: critic.is_verified ?? true,
      });
    } else {
      setEditingCritic(null);
      setCriticFormData(BLANK_CRITIC);
    }
    setIsCriticDrawerOpen(true);
  };

  const handleCloseCriticDrawer = () => {
    setIsCriticDrawerOpen(false);
    setEditingCritic(null);
    setCriticFormData(BLANK_CRITIC);
    setCriticFormMsg(null);
  };

  // Open Review Linker Drawer
  const handleOpenReviewDrawer = (critic = null) => {
    setReviewMsg(null);
    setReviewForm(BLANK_REVIEW);
    setSelectedFilm(null);
    setFilmSearch('');
    setFilmResults([]);
    setShowFilmDropdown(false);

    if (critic) {
      setSelectedCritic(critic);
      setReviewCriticSearch(critic.name);
      setReviewForm(prev => ({ ...prev, critic_id: critic.id, source_publication: critic.publication || '' }));
      loadExistingReviews(critic.id);
    } else {
      setSelectedCritic(null);
      setReviewCriticSearch('');
      setExistingReviews([]);
    }
    setIsReviewDrawerOpen(true);
  };

  const handleCloseReviewDrawer = () => {
    setIsReviewDrawerOpen(false);
    setReviewForm(BLANK_REVIEW);
    setSelectedCritic(null);
    setSelectedFilm(null);
    setReviewCriticSearch('');
    setFilmSearch('');
    setReviewMsg(null);
    setExistingReviews([]);
  };

  // Load reviews linked to a critic
  async function loadExistingReviews(criticId) {
    if (!criticId) { setExistingReviews([]); return; }
    setLoadingReviews(true);
    const { data } = await supabase
      .from('critic_reviews')
      .select('*, film:films(id, title, year, poster_url)')
      .eq('critic_id', criticId)
      .order('created_at', { ascending: false });
    setExistingReviews(data || []);
    setLoadingReviews(false);
  }

  // ---- Film Search ---------------------------------------------------------
  function handleFilmSearch(query) {
    setFilmSearch(query);
    setShowFilmDropdown(true);
    setSelectedFilm(null);
    setReviewForm(prev => ({ ...prev, film_id: '' }));
    if (query.trim().length < 2) { setFilmResults([]); return; }
    if (filmSearchTimeout.current) clearTimeout(filmSearchTimeout.current);
    filmSearchTimeout.current = setTimeout(async () => {
      setIsSearchingFilms(true);
      const { data } = await supabase
        .from('films')
        .select('id, title, year, poster_url')
        .ilike('title', `%${query}%`)
        .limit(8);
      setFilmResults(data || []);
      setIsSearchingFilms(false);
    }, 300);
  }

  function selectFilm(film) {
    setSelectedFilm(film);
    setFilmSearch(film.title + (film.year ? ` (${film.year})` : ''));
    setReviewForm(prev => ({ ...prev, film_id: film.id }));
    setFilmResults([]);
    setShowFilmDropdown(false);
  }

  // ---- Critic Search (Review Drawer) ---------------------------------------
  function handleReviewCriticSearch(query) {
    setReviewCriticSearch(query);
    setShowCriticDropdown(true);
    setSelectedCritic(null);
    setReviewForm(prev => ({ ...prev, critic_id: '' }));
    const q = query.trim().toLowerCase();
    setReviewCriticResults(critics.filter(c => c.name.toLowerCase().includes(q)).slice(0, 6));
  }

  function selectCritic(c) {
    setSelectedCritic(c);
    setReviewCriticSearch(c.name);
    setReviewForm(prev => ({ ...prev, critic_id: c.id, source_publication: prev.source_publication || c.publication || '' }));
    setReviewCriticResults([]);
    setShowCriticDropdown(false);
    loadExistingReviews(c.id);
  }

  // ---- Save Critic ---------------------------------------------------------
  async function handleCriticSubmit(e) {
    e.preventDefault();
    if (!criticFormData.name.trim()) {
      setCriticFormMsg({ type: 'error', text: 'Critic name is required.' });
      return;
    }
    setSavingCritic(true);
    setCriticFormMsg(null);
    try {
      const payload = editingCritic ? { ...criticFormData, id: editingCritic.id } : criticFormData;
      await upsertCritic(payload);
      setCriticFormMsg({ type: 'success', text: editingCritic ? 'Critic profile updated!' : 'Critic created!' });
      loadData();
      setTimeout(() => handleCloseCriticDrawer(), 1200);
    } catch (err) {
      setCriticFormMsg({ type: 'error', text: 'Failed to save critic: ' + err.message });
    } finally {
      setSavingCritic(false);
    }
  }

  async function handleDeleteCritic(critic) {
    if (!window.confirm(`Delete critic "${critic.name}"?`)) return;
    try {
      await deleteCritic(critic.id);
      loadData();
    } catch (err) {
      alert('Failed to delete critic: ' + err.message);
    }
  }

  // ---- Save Review ---------------------------------------------------------
  async function handleReviewSubmit(e) {
    e.preventDefault();
    if (!reviewForm.critic_id) {
      setReviewMsg({ type: 'error', text: 'Please select a critic.' });
      return;
    }
    if (!reviewForm.film_id) {
      setReviewMsg({ type: 'error', text: 'Please select a film.' });
      return;
    }
    if (!reviewForm.quote?.trim()) {
      setReviewMsg({ type: 'error', text: 'Review quote is required.' });
      return;
    }
    setSavingReview(true);
    setReviewMsg(null);
    try {
      const payload = {
        critic_id: reviewForm.critic_id,
        film_id: reviewForm.film_id,
        quote: reviewForm.quote.trim(),
        rating: reviewForm.rating !== '' ? Number(reviewForm.rating) : null,
        review_url: reviewForm.review_url?.trim() || null,
        source_publication: reviewForm.source_publication?.trim() || null,
        critic_name: selectedCritic?.name || '',
      };
      await upsertCriticReview(payload);
      setReviewMsg({ type: 'success', text: 'Film review linked successfully!' });
      setReviewForm(prev => ({ ...prev, quote: '', rating: '', review_url: '' }));
      setSelectedFilm(null);
      setFilmSearch('');
      loadExistingReviews(reviewForm.critic_id);
      loadData();
    } catch (err) {
      setReviewMsg({ type: 'error', text: 'Failed to link review: ' + err.message });
    } finally {
      setSavingReview(false);
      setTimeout(() => setReviewMsg(null), 3500);
    }
  }

  async function handleDeleteReview(review) {
    if (!window.confirm('Delete this review?')) return;
    try {
      await deleteCriticReview(review.id);
      loadExistingReviews(reviewForm.critic_id);
      loadData();
    } catch (err) {
      setReviewMsg({ type: 'error', text: 'Failed to delete review: ' + err.message });
    }
  }

  // ---- Filter Critics ------------------------------------------------------
  const filteredCritics = critics.filter(critic => {
    const matchesSearch = !searchQuery.trim() ||
      critic.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      critic.publication?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      critic.handle?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesVerified = verifiedFilter === 'all' ||
      (verifiedFilter === 'verified' && critic.is_verified) ||
      (verifiedFilter === 'unverified' && !critic.is_verified);
    return matchesSearch && matchesVerified;
  });

  const verifiedCount = critics.filter(c => c.is_verified).length;
  const totalReviewsCount = critics.reduce((sum, c) => sum + (c.review_count || 0), 0);

  return (
    <div className="min-h-screen bg-bg text-text-primary p-6 md:p-10 max-w-7xl mx-auto">
      <SEO title="Manage Film Critics | MuviDB Admin" />

      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-extrabold text-text-primary flex items-center gap-2">
            <Icon icon="solar:pen-new-square-bold" className="text-brand w-8 h-8" />
            Film Critics & Cultural Analysts
          </h1>
          <p className="text-xs text-text-muted mt-1">Manage verified film critic profiles, publications, and linked film reviews.</p>
        </div>

        <div className="flex items-center gap-3 self-start md:self-auto">
          <button
            onClick={() => handleOpenReviewDrawer()}
            className="inline-flex items-center gap-2 bg-surface border border-border hover:border-brand text-text-primary font-bold px-4 py-2.5 rounded-xl transition-all text-xs"
          >
            <Icon icon="solar:star-bold" className="text-brand w-4 h-4" />
            Link Film Review
          </button>

          <button
            onClick={() => handleOpenCriticDrawer()}
            className="inline-flex items-center gap-2 bg-brand text-on-brand font-bold px-5 py-2.5 rounded-xl hover:bg-brand-hover transition-all shadow-lg shadow-brand/20 text-xs"
          >
            <Icon icon="solar:add-circle-bold" className="w-5 h-5" />
            Add New Critic
          </button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="bg-surface border border-border p-4 rounded-xl text-center">
          <span className="text-[10px] text-text-muted uppercase font-bold tracking-wider">Total Critics</span>
          <p className="text-2xl font-extrabold text-text-primary mt-1">{critics.length}</p>
        </div>
        <div className="bg-surface border border-border p-4 rounded-xl text-center">
          <span className="text-[10px] text-green-500 uppercase font-bold tracking-wider">Verified Critics</span>
          <p className="text-2xl font-extrabold text-green-500 mt-1">{verifiedCount}</p>
        </div>
        <div className="bg-surface border border-border p-4 rounded-xl text-center">
          <span className="text-[10px] text-brand uppercase font-bold tracking-wider">Indexed Film Reviews</span>
          <p className="text-2xl font-extrabold text-brand mt-1">{totalReviewsCount}</p>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-6 bg-surface border border-border p-4 rounded-xl">
        <div className="relative flex-1 w-full">
          <Icon icon="solar:magnifer-linear" className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search by critic name, publication, or handle..."
            className="w-full bg-bg border border-border rounded-xl pl-10 pr-4 py-2 text-xs text-text-primary focus:border-brand outline-none"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          {[
            { id: 'all', label: 'All Critics' },
            { id: 'verified', label: 'Verified Only' },
            { id: 'unverified', label: 'Unverified' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setVerifiedFilter(tab.id)}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all ${
                verifiedFilter === tab.id
                  ? 'bg-brand text-on-brand shadow-sm'
                  : 'bg-surface-2 text-text-muted hover:text-text-primary'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Main Critics Catalog Grid */}
      {loading ? (
        <div className="py-24 text-center">
          <div className="w-10 h-10 border-4 border-brand border-t-transparent rounded-full animate-spin mx-auto mb-2" />
          <p className="text-xs text-text-muted font-bold">Loading critics directory...</p>
        </div>
      ) : filteredCritics.length === 0 ? (
        <div className="bg-surface border border-border rounded-2xl p-12 text-center">
          <Icon icon="solar:user-block-line-duotone" className="w-16 h-16 text-text-muted mx-auto mb-3 opacity-40" />
          <h3 className="text-lg font-bold text-text-primary mb-1">No film critics found</h3>
          <p className="text-xs text-text-muted mb-4">No critic profiles match your search criteria.</p>
          <button
            onClick={() => handleOpenCriticDrawer()}
            className="inline-flex items-center gap-2 bg-brand text-on-brand font-bold px-4 py-2 rounded-xl hover:bg-brand-hover transition-colors text-xs"
          >
            <Icon icon="solar:add-circle-bold" className="w-4 h-4" />
            Add First Critic
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredCritics.map(critic => (
            <div
              key={critic.id}
              className="group bg-surface border border-border hover:border-brand/40 rounded-2xl p-5 flex flex-col justify-between transition-all"
            >
              <div>
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-center gap-3.5">
                    <div className="w-14 h-14 rounded-full overflow-hidden border-2 border-border group-hover:border-brand/60 flex-shrink-0 bg-surface-2 transition-colors">
                      {critic.avatar_url ? (
                        <img src={critic.avatar_url} alt={critic.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Icon icon="solar:user-bold" className="w-6 h-6 text-text-muted opacity-40" />
                        </div>
                      )}
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-text-primary line-clamp-1 flex items-center gap-1.5">
                        {critic.name}
                        {critic.is_verified && (
                          <Icon icon="solar:verified-check-bold" className="w-4 h-4 text-brand flex-shrink-0" />
                        )}
                      </h3>
                      <p className="text-xs text-brand font-semibold line-clamp-1">{critic.publication || 'Independent Critic'}</p>
                      {critic.title && <p className="text-[11px] text-text-muted line-clamp-1">{critic.title}</p>}
                    </div>
                  </div>
                </div>

                {critic.bio && (
                  <p className="text-xs text-text-muted line-clamp-2 leading-relaxed mb-4">
                    {critic.bio}
                  </p>
                )}
              </div>

              <div>
                <div className="flex items-center justify-between pt-3 border-t border-border/60 text-xs">
                  <span className="text-[11px] font-semibold text-text-muted flex items-center gap-1">
                    <Icon icon="solar:document-text-bold" className="w-3.5 h-3.5 text-brand" />
                    {critic.review_count || 0} Reviews Linked
                  </span>

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => handleOpenReviewDrawer(critic)}
                      className="p-1.5 rounded-lg bg-surface-2 text-text-muted hover:text-brand transition-colors"
                      title="Link Review for this Critic"
                    >
                      <Icon icon="solar:star-bold" className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleOpenCriticDrawer(critic)}
                      className="p-1.5 rounded-lg bg-surface-2 text-text-muted hover:text-brand transition-colors"
                      title="Edit Critic"
                    >
                      <Icon icon="solar:pen-bold" className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteCritic(critic)}
                      className="p-1.5 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors"
                      title="Delete Critic"
                    >
                      <Icon icon="solar:trash-bin-trash-bold" className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Critic Edit/Add Drawer Side Panel ──────────────────────────── */}
      <Drawer
        isOpen={isCriticDrawerOpen}
        onClose={handleCloseCriticDrawer}
        title={editingCritic ? `Edit Critic: ${editingCritic.name}` : 'Add New Film Critic'}
        width="560px"
      >
        <form onSubmit={handleCriticSubmit} className="space-y-4 text-xs">
          {/* Full Name */}
          <div>
            <label className="text-text-muted font-bold block mb-1">Critic Full Name *</label>
            <input
              type="text"
              value={criticFormData.name}
              onChange={e => setCriticFormData({ ...criticFormData, name: e.target.value })}
              placeholder="e.g. Tolu Fagbure"
              className="w-full bg-bg border border-border rounded-xl px-3 py-2 text-text-primary focus:border-brand outline-none"
              required
            />
          </div>

          {/* Slug */}
          <div>
            <label className="text-text-muted font-bold block mb-1">URL Slug (Optional)</label>
            <input
              type="text"
              value={criticFormData.slug}
              onChange={e => setCriticFormData({ ...criticFormData, slug: e.target.value })}
              placeholder="e.g. tolu-fagbure"
              className="w-full bg-bg border border-border rounded-xl px-3 py-2 text-text-primary focus:border-brand outline-none"
            />
          </div>

          {/* Title */}
          <div>
            <label className="text-text-muted font-bold block mb-1">Professional Title</label>
            <input
              type="text"
              value={criticFormData.title}
              onChange={e => setCriticFormData({ ...criticFormData, title: e.target.value })}
              placeholder="e.g. Senior Film Critic & Culture Journalist"
              className="w-full bg-bg border border-border rounded-xl px-3 py-2 text-text-primary focus:border-brand outline-none"
            />
          </div>

          {/* Publication */}
          <div>
            <label className="text-text-muted font-bold block mb-1">Publication / Outlet</label>
            <input
              type="text"
              value={criticFormData.publication}
              onChange={e => setCriticFormData({ ...criticFormData, publication: e.target.value })}
              placeholder="e.g. Film Efiko / Melody FM"
              className="w-full bg-bg border border-border rounded-xl px-3 py-2 text-text-primary focus:border-brand outline-none"
            />
          </div>

          {/* Profile Photo */}
          <ImageField
            label="Profile Headshot"
            value={criticFormData.avatar_url}
            onChange={url => setCriticFormData(prev => ({ ...prev, avatar_url: url }))}
            bucket="film-images"
            aspect="square"
            hint="Upload or paste link (square portrait)"
          />

          {/* Platform + Handle */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-text-muted font-bold block mb-1">Primary Platform</label>
              <input
                type="text"
                value={criticFormData.platform}
                onChange={e => setCriticFormData({ ...criticFormData, platform: e.target.value })}
                placeholder="YouTube / X"
                className="w-full bg-bg border border-border rounded-xl px-3 py-2 text-text-primary focus:border-brand outline-none"
              />
            </div>
            <div>
              <label className="text-text-muted font-bold block mb-1">Social Handle</label>
              <input
                type="text"
                value={criticFormData.handle}
                onChange={e => setCriticFormData({ ...criticFormData, handle: e.target.value })}
                placeholder="@handle"
                className="w-full bg-bg border border-border rounded-xl px-3 py-2 text-text-primary focus:border-brand outline-none"
              />
            </div>
          </div>

          {/* Profile URL */}
          <div>
            <label className="text-text-muted font-bold block mb-1">Official Outlet URL</label>
            <input
              type="url"
              value={criticFormData.profile_url}
              onChange={e => setCriticFormData({ ...criticFormData, profile_url: e.target.value })}
              placeholder="https://..."
              className="w-full bg-bg border border-border rounded-xl px-3 py-2 text-text-primary focus:border-brand outline-none"
            />
          </div>

          {/* Bio */}
          <div>
            <label className="text-text-muted font-bold block mb-1">Biography</label>
            <textarea
              rows={3}
              value={criticFormData.bio}
              onChange={e => setCriticFormData({ ...criticFormData, bio: e.target.value })}
              placeholder="Brief critic bio..."
              className="w-full bg-bg border border-border rounded-xl px-3 py-2 text-text-primary focus:border-brand outline-none resize-none"
            />
          </div>

          {/* Verified toggle */}
          <label className="flex items-center gap-3 cursor-pointer py-1">
            <div className="relative">
              <input
                type="checkbox"
                checked={criticFormData.is_verified}
                onChange={e => setCriticFormData({ ...criticFormData, is_verified: e.target.checked })}
                className="sr-only"
              />
              <div className={`w-10 h-5 rounded-full transition-all ${criticFormData.is_verified ? 'bg-brand' : 'bg-surface-2 border border-border'}`} />
              <div className={`absolute top-1 w-3 h-3 rounded-full transition-all ${criticFormData.is_verified ? 'left-6 bg-white' : 'left-1 bg-text-muted'}`} />
            </div>
            <span className="text-xs font-bold text-text-primary">Verified Critic Badge</span>
          </label>

          {/* Feedback message */}
          {criticFormMsg && (
            <div className={`p-3 rounded-xl text-xs font-bold ${criticFormMsg.type === 'success' ? 'bg-green-500/10 text-green-500 border border-green-500/30' : 'bg-red-500/10 text-red-400 border border-red-500/30'}`}>
              {criticFormMsg.text}
            </div>
          )}

          <button
            type="submit"
            disabled={savingCritic}
            className="w-full bg-brand text-on-brand font-bold py-2.5 rounded-xl hover:bg-brand-hover transition-colors disabled:opacity-60 text-xs shadow-md"
          >
            {savingCritic ? 'Saving Critic…' : editingCritic ? 'Update Critic Profile' : 'Save Critic Profile'}
          </button>
        </form>
      </Drawer>

      {/* ── Review Linker Drawer Side Panel ──────────────────────────────── */}
      <Drawer
        isOpen={isReviewDrawerOpen}
        onClose={handleCloseReviewDrawer}
        title={selectedCritic ? `Link Review: ${selectedCritic.name}` : 'Link Film Review to Critic'}
        width="580px"
      >
        <div className="space-y-6 text-xs">
          <form onSubmit={handleReviewSubmit} className="space-y-4">
            {/* Critic Search / Select */}
            <div ref={criticDropdownRef} className="relative">
              <label className="text-text-muted font-bold block mb-1">Select Critic *</label>
              <div className="flex items-center gap-2 bg-bg border border-border rounded-xl px-3 py-2 focus-within:border-brand transition-colors">
                <Icon icon="solar:pen-new-square-linear" className="w-4 h-4 text-text-muted flex-shrink-0" />
                <input
                  type="text"
                  value={reviewCriticSearch}
                  onChange={e => handleReviewCriticSearch(e.target.value)}
                  onFocus={() => reviewCriticSearch && setShowCriticDropdown(true)}
                  placeholder="Search critic name..."
                  className="flex-1 bg-transparent outline-none text-xs text-text-primary placeholder-text-muted"
                />
                {selectedCritic && (
                  <Icon icon="solar:check-circle-bold" className="w-4 h-4 text-green-500 flex-shrink-0" />
                )}
              </div>
              {showCriticDropdown && reviewCriticResults.length > 0 && (
                <div className="absolute left-0 right-0 top-full mt-1 bg-surface border border-border rounded-xl shadow-2xl z-20 overflow-hidden">
                  {reviewCriticResults.map(c => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => selectCritic(c)}
                      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-surface-2 transition-colors text-left border-b border-border/50 last:border-0"
                    >
                      <div className="w-8 h-8 rounded-full bg-surface-2 overflow-hidden border border-border flex-shrink-0">
                        {c.avatar_url && <img src={c.avatar_url} alt="" className="w-full h-full object-cover" />}
                      </div>
                      <div>
                        <p className="text-xs font-bold text-text-primary">{c.name}</p>
                        <p className="text-[10px] text-text-muted">{c.publication || 'Critic'}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Film Search */}
            <div ref={filmDropdownRef} className="relative">
              <label className="text-text-muted font-bold block mb-1">Select Film *</label>
              <div className="flex items-center gap-2 bg-bg border border-border rounded-xl px-3 py-2 focus-within:border-brand transition-colors">
                <Icon icon="solar:videocamera-record-linear" className="w-4 h-4 text-text-muted flex-shrink-0" />
                <input
                  type="text"
                  value={filmSearch}
                  onChange={e => handleFilmSearch(e.target.value)}
                  onFocus={() => filmSearch.length >= 2 && setShowFilmDropdown(true)}
                  placeholder="Search film title..."
                  className="flex-1 bg-transparent outline-none text-xs text-text-primary placeholder-text-muted"
                />
                {isSearchingFilms && (
                  <div className="w-4 h-4 border-2 border-brand border-t-transparent rounded-full animate-spin flex-shrink-0" />
                )}
                {selectedFilm && !isSearchingFilms && (
                  <Icon icon="solar:check-circle-bold" className="w-4 h-4 text-green-500 flex-shrink-0" />
                )}
              </div>
              {showFilmDropdown && filmSearch.trim().length >= 2 && filmResults.length > 0 && (
                <div className="absolute left-0 right-0 top-full mt-1 bg-surface border border-border rounded-xl shadow-2xl z-20 overflow-hidden">
                  {filmResults.map(f => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => selectFilm(f)}
                      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-surface-2 transition-colors text-left border-b border-border/50 last:border-0"
                    >
                      <div className="w-8 h-12 rounded-md bg-surface-2 overflow-hidden border border-border flex-shrink-0">
                        {f.poster_url && <img src={f.poster_url} alt="" className="w-full h-full object-cover" />}
                      </div>
                      <div>
                        <p className="text-xs font-bold text-text-primary">{f.title}</p>
                        <p className="text-[10px] text-text-muted">{f.year}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Review Quote */}
            <div>
              <label className="text-text-muted font-bold block mb-1">Review Quote *</label>
              <textarea
                rows={3}
                value={reviewForm.quote}
                onChange={e => setReviewForm(prev => ({ ...prev, quote: e.target.value }))}
                placeholder="Paste the key pull-quote from the critic's review..."
                className="w-full bg-bg border border-border rounded-xl px-3 py-2 text-text-primary focus:border-brand outline-none resize-none"
                required
              />
            </div>

            {/* Rating + Source Publication */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-text-muted font-bold block mb-1">Star Rating (1–5)</label>
                <select
                  value={reviewForm.rating}
                  onChange={e => setReviewForm(prev => ({ ...prev, rating: e.target.value }))}
                  className="w-full bg-bg border border-border rounded-xl px-3 py-2 text-text-primary focus:border-brand outline-none"
                >
                  <option value="">— No Rating —</option>
                  <option value="1">1 ★</option>
                  <option value="2">2 ★★</option>
                  <option value="3">3 ★★★</option>
                  <option value="4">4 ★★★★</option>
                  <option value="5">5 ★★★★★</option>
                </select>
              </div>

              <div>
                <label className="text-text-muted font-bold block mb-1">Source Publication</label>
                <input
                  type="text"
                  value={reviewForm.source_publication}
                  onChange={e => setReviewForm(prev => ({ ...prev, source_publication: e.target.value }))}
                  placeholder="e.g. Film Efiko"
                  className="w-full bg-bg border border-border rounded-xl px-3 py-2 text-text-primary focus:border-brand outline-none"
                />
              </div>
            </div>

            {/* Original Review Link */}
            <div>
              <label className="text-text-muted font-bold block mb-1">Link to Original Review</label>
              <input
                type="url"
                value={reviewForm.review_url}
                onChange={e => setReviewForm(prev => ({ ...prev, review_url: e.target.value }))}
                placeholder="https://..."
                className="w-full bg-bg border border-border rounded-xl px-3 py-2 text-text-primary focus:border-brand outline-none"
              />
            </div>

            {/* Review feedback */}
            {reviewMsg && (
              <div className={`p-3 rounded-xl text-xs font-bold ${reviewMsg.type === 'success' ? 'bg-green-500/10 text-green-500 border border-green-500/30' : 'bg-red-500/10 text-red-400 border border-red-500/30'}`}>
                {reviewMsg.text}
              </div>
            )}

            <button
              type="submit"
              disabled={savingReview}
              className="w-full bg-brand text-on-brand font-bold py-2.5 rounded-xl hover:bg-brand-hover transition-colors disabled:opacity-60 text-xs shadow-md"
            >
              {savingReview ? 'Linking Review…' : 'Link Review to Critic'}
            </button>
          </form>

          {/* List of existing linked reviews for selected critic */}
          {selectedCritic && (
            <div className="pt-5 border-t border-border">
              <h4 className="text-xs font-bold text-text-muted uppercase tracking-wider mb-3">
                Reviews by {selectedCritic.name} ({existingReviews.length})
              </h4>
              {loadingReviews ? (
                <div className="py-6 text-center">
                  <div className="w-5 h-5 border-2 border-brand border-t-transparent rounded-full animate-spin mx-auto" />
                </div>
              ) : existingReviews.length === 0 ? (
                <p className="text-xs text-text-muted text-center py-4 border border-dashed border-border rounded-xl">
                  No film reviews linked yet for this critic.
                </p>
              ) : (
                <div className="space-y-3">
                  {existingReviews.map(rev => {
                    const film = rev.film || {};
                    return (
                      <div key={rev.id} className="flex items-start gap-3 bg-surface-2 border border-border rounded-xl p-3">
                        {film.poster_url && (
                          <img src={film.poster_url} alt={film.title} className="w-8 h-12 rounded-md object-cover border border-border flex-shrink-0" />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold text-text-primary truncate">{film.title} {film.year && `(${film.year})`}</p>
                          {rev.rating && (
                            <p className="text-[10px] text-brand font-bold">{'★'.repeat(rev.rating)} {rev.rating}/5</p>
                          )}
                          <p className="text-[10px] text-text-muted italic line-clamp-2 mt-0.5">"{rev.quote}"</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleDeleteReview(rev)}
                          className="p-1 rounded-lg text-red-400 hover:bg-red-500/10 transition-colors flex-shrink-0"
                          title="Remove review"
                        >
                          <Icon icon="solar:trash-bin-trash-bold" className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </Drawer>
    </div>
  );
}
