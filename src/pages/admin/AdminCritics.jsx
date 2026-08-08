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

  // -- Review Linker state inside drawer -------------------------------------
  const [reviewForm, setReviewForm] = useState(BLANK_REVIEW);
  const [reviewMsg, setReviewMsg] = useState(null);
  const [savingReview, setSavingReview] = useState(false);
  const [existingReviews, setExistingReviews] = useState([]);
  const [loadingReviews, setLoadingReviews] = useState(false);

  // -- Film search for review section ---------------------------------------
  const [filmSearch, setFilmSearch] = useState('');
  const [filmResults, setFilmResults] = useState([]);
  const [isSearchingFilms, setIsSearchingFilms] = useState(false);
  const [showFilmDropdown, setShowFilmDropdown] = useState(false);
  const [selectedFilm, setSelectedFilm] = useState(null);
  const filmSearchTimeout = useRef(null);
  const filmDropdownRef = useRef(null);

  async function loadData() {
    setLoading(true);
    const data = await fetchCritics();
    setCritics(data);
    setLoading(false);
  }

  useEffect(() => {
    loadData();
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    function handler(e) {
      if (filmDropdownRef.current && !filmDropdownRef.current.contains(e.target)) setShowFilmDropdown(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Open Critic Drawer
  const handleOpenCriticDrawer = (critic = null) => {
    setCriticFormMsg(null);
    setReviewMsg(null);
    setReviewForm(BLANK_REVIEW);
    setSelectedFilm(null);
    setFilmSearch('');
    setFilmResults([]);
    setShowFilmDropdown(false);

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
      setReviewForm(prev => ({ ...prev, critic_id: critic.id, source_publication: critic.publication || '' }));
      loadExistingReviews(critic.id);
    } else {
      setEditingCritic(null);
      setCriticFormData(BLANK_CRITIC);
      setExistingReviews([]);
    }
    setIsCriticDrawerOpen(true);
  };

  const handleCloseCriticDrawer = () => {
    setIsCriticDrawerOpen(false);
    setEditingCritic(null);
    setCriticFormData(BLANK_CRITIC);
    setCriticFormMsg(null);
    setReviewForm(BLANK_REVIEW);
    setSelectedFilm(null);
    setFilmSearch('');
    setExistingReviews([]);
    setReviewMsg(null);
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
      const saved = await upsertCritic(payload);
      setCriticFormMsg({ type: 'success', text: editingCritic ? 'Critic profile updated!' : 'Critic created!' });
      if (!editingCritic) {
        setEditingCritic(saved);
        setReviewForm(prev => ({ ...prev, critic_id: saved.id, source_publication: saved.publication || '' }));
      }
      loadData();
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
    const criticId = editingCritic?.id || reviewForm.critic_id;
    if (!criticId) {
      setReviewMsg({ type: 'error', text: 'Please save the critic profile first.' });
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
        critic_id: criticId,
        film_id: reviewForm.film_id,
        quote: reviewForm.quote.trim(),
        rating: reviewForm.rating !== '' ? Number(reviewForm.rating) : null,
        review_url: reviewForm.review_url?.trim() || null,
        source_publication: reviewForm.source_publication?.trim() || criticFormData.publication || null,
        critic_name: criticFormData.name || '',
      };
      await upsertCriticReview(payload);
      setReviewMsg({ type: 'success', text: 'Film review linked successfully!' });
      setReviewForm(prev => ({ ...prev, quote: '', rating: '', review_url: '' }));
      setSelectedFilm(null);
      setFilmSearch('');
      loadExistingReviews(criticId);
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
      loadExistingReviews(editingCritic?.id);
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

        <button
          onClick={() => handleOpenCriticDrawer()}
          className="inline-flex items-center gap-2 bg-brand text-on-brand font-bold px-5 py-2.5 rounded-xl hover:bg-brand-hover transition-all shadow-lg shadow-brand/20 text-xs self-start md:self-auto"
        >
          <Icon icon="solar:add-circle-bold" className="w-5 h-5" />
          Add New Critic
        </button>
      </div>

      {/* KPI Cards */}
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

      {/* Main Critics Grid */}
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
                      onClick={() => handleOpenCriticDrawer(critic)}
                      className="p-1.5 rounded-lg bg-surface-2 text-text-muted hover:text-brand transition-colors"
                      title="Edit Critic & Reviews"
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

      {/* ── Wide Side Panel Drawer (Matching Edit Movie Profile) ──────────── */}
      <Drawer
        isOpen={isCriticDrawerOpen}
        onClose={handleCloseCriticDrawer}
        title={editingCritic ? 'Edit Critic Profile' : 'Add New Film Critic'}
        width="820px"
      >
        <form onSubmit={handleCriticSubmit} className="space-y-10">

          {/* Two Column Layout: Core Information vs Media & Presentation */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
            {/* Left Column: Core Information */}
            <section className="space-y-5">
              <div className="flex items-center justify-between pb-2 border-b border-border">
                <h4 className="text-xs font-bold text-text-muted uppercase tracking-wider">Core Information</h4>
              </div>

              <div className="space-y-4">
                {/* Full Name */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-bold text-text-primary">Critic Full Name *</label>
                    <span className="text-[10px] font-bold text-brand bg-brand/10 border border-brand/20 px-2 py-0.5 rounded-full flex items-center gap-1">
                      <Icon icon="solar:magic-stick-bold" className="w-3 h-3" />
                      AI Polish
                    </span>
                  </div>
                  <input
                    required
                    type="text"
                    value={criticFormData.name}
                    onChange={e => setCriticFormData({ ...criticFormData, name: e.target.value })}
                    className="w-full bg-surface-2 border border-border rounded-md px-3.5 py-2.5 text-sm text-text-primary focus:border-brand outline-none transition-all"
                    placeholder="e.g. Tolu Fagbure"
                  />
                </div>

                {/* Slug */}
                <div>
                  <label className="block text-xs font-bold text-text-primary mb-1.5">URL Slug (Optional)</label>
                  <input
                    type="text"
                    value={criticFormData.slug}
                    onChange={e => setCriticFormData({ ...criticFormData, slug: e.target.value })}
                    className="w-full bg-surface-2 border border-border rounded-md px-3.5 py-2 text-xs text-text-primary focus:border-brand outline-none"
                    placeholder="e.g. tolu-fagbure"
                  />
                </div>

                {/* Professional Title & Publication */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-text-primary mb-1.5">Professional Title</label>
                    <input
                      type="text"
                      value={criticFormData.title}
                      onChange={e => setCriticFormData({ ...criticFormData, title: e.target.value })}
                      className="w-full bg-surface-2 border border-border rounded-md px-3.5 py-2 text-xs text-text-primary focus:border-brand outline-none"
                      placeholder="Senior Film Critic"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-text-primary mb-1.5">Publication / Outlet</label>
                    <input
                      type="text"
                      value={criticFormData.publication}
                      onChange={e => setCriticFormData({ ...criticFormData, publication: e.target.value })}
                      className="w-full bg-surface-2 border border-border rounded-md px-3.5 py-2 text-xs text-text-primary focus:border-brand outline-none"
                      placeholder="e.g. Film Efiko"
                    />
                  </div>
                </div>

                {/* Platform & Social Handle */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-text-primary mb-1.5">Primary Platform</label>
                    <input
                      type="text"
                      value={criticFormData.platform}
                      onChange={e => setCriticFormData({ ...criticFormData, platform: e.target.value })}
                      className="w-full bg-surface-2 border border-border rounded-md px-3.5 py-2 text-xs text-text-primary focus:border-brand outline-none"
                      placeholder="YouTube / X"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-text-primary mb-1.5">Social Handle</label>
                    <input
                      type="text"
                      value={criticFormData.handle}
                      onChange={e => setCriticFormData({ ...criticFormData, handle: e.target.value })}
                      className="w-full bg-surface-2 border border-border rounded-md px-3.5 py-2 text-xs text-text-primary focus:border-brand outline-none"
                      placeholder="@handle"
                    />
                  </div>
                </div>

                {/* Biography */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-bold text-text-primary">Biography</label>
                    <span className="text-[10px] font-bold text-white bg-brand border border-brand/20 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                      <Icon icon="solar:stars-minimalistic-bold" className="w-3 h-3" />
                      AI Summarize
                    </span>
                  </div>
                  <textarea
                    rows={4}
                    value={criticFormData.bio}
                    onChange={e => setCriticFormData({ ...criticFormData, bio: e.target.value })}
                    className="w-full bg-surface-2 border border-border rounded-md px-3.5 py-2.5 text-xs text-text-primary focus:border-brand outline-none resize-none leading-relaxed"
                    placeholder="Enter critic bio..."
                  />
                </div>

                {/* Verified toggle switch */}
                <div className="p-4 bg-surface-2/60 border border-border rounded-lg flex items-center justify-between">
                  <div>
                    <h5 className="text-xs font-bold text-text-primary">Verified Critic Status</h5>
                    <p className="text-[11px] text-text-muted mt-0.5">Displays verified checkmark on profile and reviews.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setCriticFormData({ ...criticFormData, is_verified: !criticFormData.is_verified })}
                    className={`relative w-11 h-6 rounded-full transition-colors duration-200 outline-none focus:ring-2 focus:ring-brand/20 ${
                      criticFormData.is_verified ? 'bg-brand' : 'bg-slate-200 dark:bg-slate-800'
                    }`}
                  >
                    <span className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white shadow-sm transition-transform duration-200 ${
                      criticFormData.is_verified ? 'translate-x-5' : 'translate-x-0'
                    }`} />
                  </button>
                </div>
              </div>
            </section>

            {/* Right Column: Media & Presentation */}
            <section className="space-y-6">
              <div className="pb-2 border-b border-border">
                <h4 className="text-xs font-bold text-text-muted uppercase tracking-wider">Media & Presentation</h4>
              </div>

              <div className="space-y-5">
                <ImageField
                  label="Profile Headshot"
                  value={criticFormData.avatar_url}
                  onChange={url => setCriticFormData(prev => ({ ...prev, avatar_url: url }))}
                  bucket="film-images"
                  aspect="square"
                  hint="Upload or paste image link (square format)"
                />

                <div>
                  <label className="block text-xs font-bold text-text-primary mb-1.5">Official Outlet Website</label>
                  <input
                    type="url"
                    value={criticFormData.profile_url}
                    onChange={e => setCriticFormData({ ...criticFormData, profile_url: e.target.value })}
                    className="w-full bg-surface-2 border border-border rounded-md px-3.5 py-2.5 text-xs text-text-primary focus:border-brand outline-none"
                    placeholder="https://..."
                  />
                </div>
              </div>
            </section>
          </div>

          {/* Form Save Button */}
          {criticFormMsg && (
            <div className={`p-3 rounded-xl text-xs font-bold ${criticFormMsg.type === 'success' ? 'bg-green-500/10 text-green-500 border border-green-500/30' : 'bg-red-500/10 text-red-400 border border-red-500/30'}`}>
              {criticFormMsg.text}
            </div>
          )}

          <button
            type="submit"
            disabled={savingCritic}
            className="w-full bg-brand text-on-brand font-bold py-3 rounded-xl hover:bg-brand-hover transition-colors disabled:opacity-60 text-xs shadow-lg shadow-brand/20"
          >
            {savingCritic ? 'Saving Critic Profile…' : editingCritic ? 'Update Critic Profile' : 'Save Critic Profile'}
          </button>

          {/* Full Width Bottom Section: Linked Film Reviews */}
          <div className="pt-8 border-t border-border space-y-4 text-xs">
            <div>
              <h4 className="text-sm font-bold text-text-primary flex items-center gap-2">
                <Icon icon="solar:star-bold" className="text-brand w-4 h-4" />
                Linked Film Reviews
              </h4>
              <p className="text-[11px] text-text-muted mt-0.5">
                {editingCritic ? `Attach published film reviews to ${editingCritic.name}` : 'Save critic profile first to attach film reviews.'}
              </p>
            </div>

            {/* Film Search & Add Review Form */}
            <div className="p-4 bg-surface-2/40 border border-border rounded-xl space-y-4">
              <div ref={filmDropdownRef} className="relative">
                <label className="block text-xs font-bold text-text-primary mb-1">Select Film to Review *</label>
                <div className="flex items-center gap-2 bg-surface border border-border rounded-xl px-3.5 py-2.5 focus-within:border-brand transition-colors">
                  <Icon icon="solar:videocamera-record-linear" className="w-4 h-4 text-text-muted flex-shrink-0" />
                  <input
                    type="text"
                    value={filmSearch}
                    onChange={e => handleFilmSearch(e.target.value)}
                    onFocus={() => filmSearch.length >= 2 && setShowFilmDropdown(true)}
                    placeholder="Search film title..."
                    disabled={!editingCritic}
                    className="flex-1 bg-transparent outline-none text-xs text-text-primary placeholder-text-muted disabled:opacity-50"
                  />
                  {isSearchingFilms && (
                    <div className="w-4 h-4 border-2 border-brand border-t-transparent rounded-full animate-spin flex-shrink-0" />
                  )}
                  {selectedFilm && !isSearchingFilms && (
                    <Icon icon="solar:check-circle-bold" className="w-4 h-4 text-green-500 flex-shrink-0" />
                  )}
                </div>

                {showFilmDropdown && filmSearch.trim().length >= 2 && filmResults.length > 0 && (
                  <div className="absolute left-0 right-0 top-full mt-1 bg-surface border border-border rounded-xl shadow-2xl z-30 overflow-hidden">
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
                <label className="block text-xs font-bold text-text-primary mb-1">Review Quote *</label>
                <textarea
                  rows={3}
                  value={reviewForm.quote}
                  onChange={e => setReviewForm(prev => ({ ...prev, quote: e.target.value }))}
                  placeholder="Paste key pull-quote from the review..."
                  disabled={!editingCritic}
                  className="w-full bg-surface border border-border rounded-xl px-3.5 py-2.5 text-xs text-text-primary focus:border-brand outline-none resize-none leading-relaxed disabled:opacity-50"
                />
              </div>

              {/* Rating + Source URL */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-text-primary mb-1">Star Rating (1–5)</label>
                  <select
                    value={reviewForm.rating}
                    onChange={e => setReviewForm(prev => ({ ...prev, rating: e.target.value }))}
                    disabled={!editingCritic}
                    className="w-full bg-surface border border-border rounded-xl px-3 py-2 text-xs text-text-primary focus:border-brand outline-none disabled:opacity-50"
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
                  <label className="block text-xs font-bold text-text-primary mb-1">Original Review URL</label>
                  <input
                    type="url"
                    value={reviewForm.review_url}
                    onChange={e => setReviewForm(prev => ({ ...prev, review_url: e.target.value }))}
                    placeholder="https://..."
                    disabled={!editingCritic}
                    className="w-full bg-surface border border-border rounded-xl px-3.5 py-2 text-xs text-text-primary focus:border-brand outline-none disabled:opacity-50"
                  />
                </div>
              </div>

              {reviewMsg && (
                <div className={`p-3 rounded-xl text-xs font-bold ${reviewMsg.type === 'success' ? 'bg-green-500/10 text-green-500 border border-green-500/30' : 'bg-red-500/10 text-red-400 border border-red-500/30'}`}>
                  {reviewMsg.text}
                </div>
              )}

              <button
                type="button"
                onClick={handleReviewSubmit}
                disabled={savingReview || !editingCritic}
                className="w-full bg-brand text-on-brand font-bold py-2.5 rounded-xl hover:bg-brand-hover transition-colors text-xs disabled:opacity-50"
              >
                {savingReview ? 'Linking Review…' : 'Link Review to Critic'}
              </button>
            </div>

            {/* List of existing linked reviews */}
            {editingCritic && (
              <div>
                {loadingReviews ? (
                  <div className="py-4 text-center">
                    <div className="w-5 h-5 border-2 border-brand border-t-transparent rounded-full animate-spin mx-auto" />
                  </div>
                ) : existingReviews.length > 0 ? (
                  <div className="space-y-3">
                    <p className="text-[10px] font-bold text-text-muted uppercase tracking-wider">Linked Film Reviews ({existingReviews.length})</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
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
                              className="p-1.5 rounded-lg text-red-400 hover:bg-red-500/10 transition-colors flex-shrink-0"
                              title="Delete review"
                            >
                              <Icon icon="solar:trash-bin-trash-bold" className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <p className="text-[11px] text-text-muted text-center py-4 border border-dashed border-border rounded-xl">
                    No film reviews attached yet — search above to link reviews.
                  </p>
                )}
              </div>
            )}
          </div>
        </form>
      </Drawer>
    </div>
  );
}
