import React, { useEffect, useRef, useState } from 'react';
import { Icon } from '@iconify/react';
import { fetchCritics, upsertCritic, deleteCritic, upsertCriticReview, deleteCriticReview } from '../../lib/critics';
import { supabase } from '../../lib/supabase';
import ImageField from '../../components/admin/ImageField';
import SEO from '../../components/SEO';

const BLANK_FORM = {
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
  const [editing, setEditing] = useState(null);
  const [formData, setFormData] = useState(BLANK_FORM);
  const [formMsg, setFormMsg] = useState(null);
  const [saving, setSaving] = useState(false);

  // -- Review link -----------------------------------------------------------
  const [reviewForm, setReviewForm] = useState(BLANK_REVIEW);
  const [reviewMsg, setReviewMsg] = useState(null);
  const [savingReview, setSavingReview] = useState(false);
  const [existingReviews, setExistingReviews] = useState([]);
  const [loadingReviews, setLoadingReviews] = useState(false);

  // -- Film search for review panel -----------------------------------------
  const [filmSearch, setFilmSearch] = useState('');
  const [filmResults, setFilmResults] = useState([]);
  const [isSearchingFilms, setIsSearchingFilms] = useState(false);
  const [showFilmDropdown, setShowFilmDropdown] = useState(false);
  const [selectedFilm, setSelectedFilm] = useState(null);
  const filmSearchTimeout = useRef(null);
  const filmDropdownRef = useRef(null);

  // -- Critic search for review panel ----------------------------------------
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

  // Close dropdowns on outside click
  useEffect(() => {
    function handler(e) {
      if (filmDropdownRef.current && !filmDropdownRef.current.contains(e.target)) setShowFilmDropdown(false);
      if (criticDropdownRef.current && !criticDropdownRef.current.contains(e.target)) setShowCriticDropdown(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Load reviews for selected critic in review panel
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

  // ---- Film search ---------------------------------------------------------
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

  // ---- Critic search (for review panel) ------------------------------------
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

  // ---- Critic form ---------------------------------------------------------
  function handleEdit(critic) {
    setEditing(critic);
    setFormData({
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
    setFormMsg(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function handleReset() {
    setEditing(null);
    setFormData(BLANK_FORM);
    setFormMsg(null);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!formData.name.trim()) {
      setFormMsg({ type: 'error', text: 'Name is required.' });
      return;
    }
    setSaving(true);
    setFormMsg(null);
    try {
      const payload = editing ? { ...formData, id: editing.id } : formData;
      await upsertCritic(payload);
      setFormMsg({ type: 'success', text: editing ? 'Critic updated!' : 'Critic created!' });
      handleReset();
      loadData();
    } catch (err) {
      setFormMsg({ type: 'error', text: 'Failed to save critic: ' + err.message });
    } finally {
      setSaving(false);
      setTimeout(() => setFormMsg(null), 4000);
    }
  }

  async function handleDelete(critic) {
    if (!window.confirm(`Delete critic "${critic.name}"?`)) return;
    try {
      await deleteCritic(critic.id);
      loadData();
    } catch (err) {
      setFormMsg({ type: 'error', text: 'Failed to delete critic: ' + err.message });
    }
  }

  // ---- Review form ---------------------------------------------------------
  async function handleReviewSubmit(e) {
    e.preventDefault();
    if (!reviewForm.critic_id) {
      setReviewMsg({ type: 'error', text: 'Select a critic first.' });
      return;
    }
    if (!reviewForm.film_id) {
      setReviewMsg({ type: 'error', text: 'Select a film first.' });
      return;
    }
    if (!reviewForm.quote?.trim()) {
      setReviewMsg({ type: 'error', text: 'A review quote is required.' });
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
      setReviewMsg({ type: 'success', text: 'Review linked!' });
      setReviewForm(prev => ({ ...prev, quote: '', rating: '', review_url: '' }));
      setSelectedFilm(null);
      setFilmSearch('');
      loadExistingReviews(reviewForm.critic_id);
      loadData();
    } catch (err) {
      setReviewMsg({ type: 'error', text: 'Failed to link review: ' + err.message });
    } finally {
      setSavingReview(false);
      setTimeout(() => setReviewMsg(null), 4000);
    }
  }

  async function handleDeleteReview(review) {
    if (!window.confirm('Remove this review?')) return;
    try {
      await deleteCriticReview(review.id);
      loadExistingReviews(reviewForm.critic_id);
    } catch (err) {
      setReviewMsg({ type: 'error', text: 'Failed to remove review: ' + err.message });
    }
  }

  // ---- Render --------------------------------------------------------------
  return (
    <div className="min-h-screen bg-bg text-text-primary p-6 md:p-10 max-w-7xl mx-auto">
      <SEO title="Manage Film Critics | MuviDB Admin" />

      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-extrabold text-text-primary flex items-center gap-2">
            <Icon icon="solar:pen-new-square-bold" className="text-brand w-8 h-8" />
            Manage Film Critics
          </h1>
          <p className="text-xs text-text-muted mt-1">Add, update, or edit verified film critic profiles and link their reviews.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

        {/* ── Left: Critic Form ───────────────────────────────────────────── */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-surface border border-border p-6 rounded-2xl">
            <h2 className="text-lg font-bold text-text-primary mb-5">
              {editing ? `Editing: ${editing.name}` : 'Add New Critic'}
            </h2>

            <form onSubmit={handleSubmit} className="space-y-4 text-xs">
              {/* Name */}
              <div>
                <label className="text-text-muted font-bold block mb-1">Critic Full Name *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
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
                  value={formData.slug}
                  onChange={e => setFormData({ ...formData, slug: e.target.value })}
                  placeholder="e.g. tolu-fagbure"
                  className="w-full bg-bg border border-border rounded-xl px-3 py-2 text-text-primary focus:border-brand outline-none"
                />
              </div>

              {/* Professional Title */}
              <div>
                <label className="text-text-muted font-bold block mb-1">Professional Title</label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={e => setFormData({ ...formData, title: e.target.value })}
                  placeholder="e.g. Film Critic & Culture Analyst"
                  className="w-full bg-bg border border-border rounded-xl px-3 py-2 text-text-primary focus:border-brand outline-none"
                />
              </div>

              {/* Publication */}
              <div>
                <label className="text-text-muted font-bold block mb-1">Publication / Outlet</label>
                <input
                  type="text"
                  value={formData.publication}
                  onChange={e => setFormData({ ...formData, publication: e.target.value })}
                  placeholder="e.g. Film Efiko / Melody FM"
                  className="w-full bg-bg border border-border rounded-xl px-3 py-2 text-text-primary focus:border-brand outline-none"
                />
              </div>

              {/* Avatar */}
              <ImageField
                label="Profile Photo"
                value={formData.avatar_url}
                onChange={url => setFormData(prev => ({ ...prev, avatar_url: url }))}
                bucket="film-images"
                aspect="square"
                hint="Recommended: square headshot"
              />

              {/* Platform + Handle */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-text-muted font-bold block mb-1">Primary Platform</label>
                  <input
                    type="text"
                    value={formData.platform}
                    onChange={e => setFormData({ ...formData, platform: e.target.value })}
                    placeholder="YouTube / X"
                    className="w-full bg-bg border border-border rounded-xl px-3 py-2 text-text-primary focus:border-brand outline-none"
                  />
                </div>
                <div>
                  <label className="text-text-muted font-bold block mb-1">Social Handle</label>
                  <input
                    type="text"
                    value={formData.handle}
                    onChange={e => setFormData({ ...formData, handle: e.target.value })}
                    placeholder="@handle"
                    className="w-full bg-bg border border-border rounded-xl px-3 py-2 text-text-primary focus:border-brand outline-none"
                  />
                </div>
              </div>

              {/* Profile URL */}
              <div>
                <label className="text-text-muted font-bold block mb-1">Profile / Website URL</label>
                <input
                  type="url"
                  value={formData.profile_url}
                  onChange={e => setFormData({ ...formData, profile_url: e.target.value })}
                  placeholder="https://..."
                  className="w-full bg-bg border border-border rounded-xl px-3 py-2 text-text-primary focus:border-brand outline-none"
                />
              </div>

              {/* Bio */}
              <div>
                <label className="text-text-muted font-bold block mb-1">Biography</label>
                <textarea
                  rows={3}
                  value={formData.bio}
                  onChange={e => setFormData({ ...formData, bio: e.target.value })}
                  placeholder="Brief bio..."
                  className="w-full bg-bg border border-border rounded-xl px-3 py-2 text-text-primary focus:border-brand outline-none resize-none"
                />
              </div>

              {/* Verified checkbox */}
              <label className="flex items-center gap-2.5 cursor-pointer group">
                <div className="relative">
                  <input
                    type="checkbox"
                    checked={formData.is_verified}
                    onChange={e => setFormData({ ...formData, is_verified: e.target.checked })}
                    className="sr-only"
                  />
                  <div className={`w-10 h-5 rounded-full transition-all ${formData.is_verified ? 'bg-brand' : 'bg-surface-2 border border-border'}`} />
                  <div className={`absolute top-1 w-3 h-3 rounded-full transition-all ${formData.is_verified ? 'left-6 bg-white' : 'left-1 bg-text-muted'}`} />
                </div>
                <span className="text-xs font-bold text-text-primary group-hover:text-brand transition-colors">Verified Critic Badge</span>
              </label>

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
                  {saving ? 'Saving…' : editing ? 'Update Critic' : 'Create Critic'}
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

        {/* ── Right: Critics List + Review Linker ─────────────────────────── */}
        <div className="lg:col-span-2 space-y-8">

          {/* Critics Directory */}
          <div>
            <h2 className="text-lg font-bold text-text-primary mb-4">
              Critics Directory ({critics.length})
            </h2>
            {loading ? (
              <div className="py-12 text-center">
                <div className="w-8 h-8 border-2 border-brand border-t-transparent rounded-full animate-spin mx-auto" />
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {critics.map(critic => (
                  <div
                    key={critic.id}
                    className={`bg-surface border rounded-xl p-4 flex gap-4 items-center justify-between transition-all ${editing?.id === critic.id ? 'border-brand/60 shadow-lg shadow-brand/5' : 'border-border'}`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-12 h-12 rounded-full overflow-hidden border border-border flex-shrink-0 bg-surface-2">
                        {critic.avatar_url
                          ? <img src={critic.avatar_url} alt={critic.name} className="w-full h-full object-cover" />
                          : <div className="w-full h-full flex items-center justify-center"><Icon icon="solar:user-bold" className="w-5 h-5 text-text-muted opacity-50" /></div>
                        }
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-sm font-bold text-text-primary truncate flex items-center gap-1.5">
                          {critic.name}
                          {critic.is_verified && (
                            <Icon icon="solar:verified-check-bold" className="w-3.5 h-3.5 text-brand flex-shrink-0" />
                          )}
                        </h3>
                        <span className="text-[11px] text-brand font-semibold">{critic.publication || 'Critic'}</span>
                        <span className="text-[10px] text-text-muted block">{critic.review_count} Reviews</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button
                        onClick={() => handleEdit(critic)}
                        className="p-2 rounded-lg bg-surface-2 text-text-muted hover:text-brand transition-colors"
                        title="Edit Critic"
                      >
                        <Icon icon="solar:pen-bold" className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(critic)}
                        className="p-2 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors"
                        title="Delete Critic"
                      >
                        <Icon icon="solar:trash-bin-trash-bold" className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── Review Linker ─────────────────────────────────────────────── */}
          <div className="bg-surface border border-border p-6 rounded-2xl">
            <h3 className="text-base font-bold text-text-primary mb-1 flex items-center gap-2">
              <Icon icon="solar:star-bold" className="text-brand w-5 h-5" />
              Link a Film Review to a Critic
            </h3>
            <p className="text-[11px] text-text-muted mb-5">
              Connect a critic's published review to a film — adds it to their profile page.
            </p>

            <form onSubmit={handleReviewSubmit} className="space-y-4 text-xs">

              {/* Critic search */}
              <div ref={criticDropdownRef} className="relative">
                <label className="text-text-muted font-bold block mb-1">Select Critic *</label>
                <div className="flex items-center gap-2 bg-bg border border-border rounded-xl px-3 py-2 focus-within:border-brand transition-colors">
                  <Icon icon="solar:pen-new-square-linear" className="w-4 h-4 text-text-muted flex-shrink-0" />
                  <input
                    type="text"
                    value={reviewCriticSearch}
                    onChange={e => handleReviewCriticSearch(e.target.value)}
                    onFocus={() => reviewCriticSearch && setShowCriticDropdown(true)}
                    placeholder="Type critic name…"
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

              {/* Film search */}
              <div ref={filmDropdownRef} className="relative">
                <label className="text-text-muted font-bold block mb-1">Select Film *</label>
                <div className="flex items-center gap-2 bg-bg border border-border rounded-xl px-3 py-2 focus-within:border-brand transition-colors">
                  <Icon icon="solar:videocamera-record-linear" className="w-4 h-4 text-text-muted flex-shrink-0" />
                  <input
                    type="text"
                    value={filmSearch}
                    onChange={e => handleFilmSearch(e.target.value)}
                    onFocus={() => filmSearch.length >= 2 && setShowFilmDropdown(true)}
                    placeholder="Search film title…"
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

              {/* Review quote */}
              <div>
                <label className="text-text-muted font-bold block mb-1">Review Quote *</label>
                <textarea
                  rows={3}
                  value={reviewForm.quote}
                  onChange={e => setReviewForm(prev => ({ ...prev, quote: e.target.value }))}
                  placeholder="Paste the key pull-quote from the review…"
                  className="w-full bg-bg border border-border rounded-xl px-3 py-2 text-text-primary focus:border-brand outline-none resize-none"
                  required
                />
              </div>

              {/* Rating + Source publication */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-text-muted font-bold block mb-1">Star Rating (out of 5)</label>
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

              {/* Review URL */}
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
                className="w-full bg-brand text-on-brand font-bold py-2.5 rounded-xl hover:bg-brand-hover transition-colors text-xs disabled:opacity-60"
              >
                {savingReview ? 'Linking…' : 'Link Review to Critic'}
              </button>
            </form>

            {/* Existing reviews for selected critic */}
            {selectedCritic && (
              <div className="mt-6 pt-5 border-t border-border">
                <h4 className="text-xs font-bold text-text-muted uppercase tracking-wider mb-3">
                  {selectedCritic.name}'s Reviews ({existingReviews.length})
                </h4>
                {loadingReviews ? (
                  <div className="py-6 text-center">
                    <div className="w-5 h-5 border-2 border-brand border-t-transparent rounded-full animate-spin mx-auto" />
                  </div>
                ) : existingReviews.length === 0 ? (
                  <p className="text-xs text-text-muted text-center py-4">No reviews linked yet.</p>
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
                            className="p-1.5 rounded-lg text-red-400 hover:bg-red-500/10 transition-colors flex-shrink-0"
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
        </div>
      </div>
    </div>
  );
}
