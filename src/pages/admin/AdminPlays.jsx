import React, { useEffect, useRef, useState } from 'react';
import { Icon } from '@iconify/react';
import { fetchPlays, getPlayDateLabel, upsertPlay, upsertStageCredit, deleteStageCredit } from '../../lib/plays';
import { supabase } from '../../lib/supabase';
import { authHeaders } from '../../lib/apiAuth';
import ImageField from '../../components/admin/ImageField';
import Drawer from '../../components/admin/Drawer';
import SEO from '../../components/SEO';

const BLANK_INSTAGRAM_IMPORT = {
  url: '',
  caption: '',
  image: '',
};

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
  run_start_date: '',
  run_end_date: '',
  performance_time: '',
  source_url: '',
  status: 'archived',
};

const ALL_PLAY_GENRES = [
  'Drama', 'Musical', 'Tragedy', 'Comedy', 'Historical',
  'Satire', 'Folklore', 'Dance Drama', 'Opera', 'Experimental'
];

export default function AdminPlays() {
  const [plays, setPlays] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // Drawer state
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [editingPlay, setEditingPlay] = useState(null);
  const [formData, setFormData] = useState(BLANK_FORM);
  const [formMsg, setFormMsg] = useState(null);
  const [saving, setSaving] = useState(false);
  const [instagramImport, setInstagramImport] = useState(BLANK_INSTAGRAM_IMPORT);
  const [instagramImageName, setInstagramImageName] = useState('');
  const [instagramImportMsg, setInstagramImportMsg] = useState(null);
  const [importingInstagram, setImportingInstagram] = useState(false);

  // -- Stage credits inside drawer ------------------------------------------
  const [credits, setCredits] = useState([]); // pending staged credits
  const [savedCredits, setSavedCredits] = useState([]); // credits already in DB
  const [loadingCredits, setLoadingCredits] = useState(false);

  // -- People search ---------------------------------------------------------
  const [peopleSearch, setPeopleSearch] = useState('');
  const [peopleResults, setPeopleResults] = useState([]);
  const [isSearchingPeople, setIsSearchingPeople] = useState(false);
  const [showPeopleDropdown, setShowPeopleDropdown] = useState(false);
  const searchTimeout = useRef(null);
  const searchRef = useRef(null);

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

  // Close search dropdown on outside click
  useEffect(() => {
    function onClickOutside(e) {
      if (searchRef.current && !searchRef.current.contains(e.target)) {
        setShowPeopleDropdown(false);
      }
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  // Open drawer for creating or editing
  const handleOpenDrawer = (play = null) => {
    setFormMsg(null);
    setCreditMsg(null);
    setCredits([]);
    setPeopleSearch('');
    setPeopleResults([]);
    setShowPeopleDropdown(false);
    setInstagramImport(play?.source_url ? { ...BLANK_INSTAGRAM_IMPORT, url: play.source_url } : BLANK_INSTAGRAM_IMPORT);
    setInstagramImageName('');
    setInstagramImportMsg(null);

    if (play) {
      setEditingPlay(play);
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
        run_start_date: play.run_start_date || '',
        run_end_date: play.run_end_date || '',
        performance_time: play.performance_time || '',
        source_url: play.source_url || '',
        status: play.status || 'archived',
      });
      loadSavedCredits(play.id);
    } else {
      setEditingPlay(null);
      setFormData(BLANK_FORM);
      setSavedCredits([]);
    }
    setIsDrawerOpen(true);
  };

  const handleCloseDrawer = () => {
    setIsDrawerOpen(false);
    setEditingPlay(null);
    setFormData(BLANK_FORM);
    setCredits([]);
    setSavedCredits([]);
    setFormMsg(null);
    setCreditMsg(null);
    setInstagramImport(BLANK_INSTAGRAM_IMPORT);
    setInstagramImageName('');
    setInstagramImportMsg(null);
  };

  // Load credits from DB
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

  function readFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  async function fileToCompressedDataUrl(file) {
    const dataUrl = await readFileAsDataUrl(file);
    const img = await new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = reject;
      image.src = dataUrl;
    });

    const maxSide = 1400;
    const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
    const width = Math.max(1, Math.round(img.width * scale));
    const height = Math.max(1, Math.round(img.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas is not available.');
    ctx.drawImage(img, 0, 0, width, height);
    return canvas.toDataURL('image/jpeg', 0.84);
  }

  async function handleInstagramFlyerChange(e) {
    const file = e.target.files?.[0];
    if (!file) {
      setInstagramImageName('');
      setInstagramImport(prev => ({ ...prev, image: '' }));
      return;
    }
    if (!file.type.startsWith('image/')) {
      setInstagramImportMsg({ type: 'error', text: 'Please choose an image file.' });
      return;
    }

    try {
      setInstagramImageName(file.name);
      const image = await fileToCompressedDataUrl(file);
      setInstagramImport(prev => ({ ...prev, image }));
      setInstagramImportMsg(null);
    } catch {
      setInstagramImageName('');
      setInstagramImport(prev => ({ ...prev, image: '' }));
      setInstagramImportMsg({ type: 'error', text: 'Could not read the flyer image.' });
    }
  }

  async function handleInstagramImport() {
    if (!instagramImport.url.trim()) {
      setInstagramImportMsg({ type: 'error', text: 'Instagram URL is required.' });
      return;
    }

    setImportingInstagram(true);
    setInstagramImportMsg(null);
    try {
      const response = await fetch('/api/ai', {
        method: 'POST',
        headers: await authHeaders(),
        body: JSON.stringify({
          task: 'extract_play_from_instagram',
          data: instagramImport,
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'Instagram import failed.');

      const imported = payload.play || {};
      const fields = [
        'title',
        'playwright',
        'director',
        'producer',
        'venue',
        'city',
        'country',
        'poster_url',
        'banner_url',
        'synopsis',
        'genre',
        'run_start_date',
        'run_end_date',
        'performance_time',
        'source_url',
        'status',
      ];

      setFormData(prev => {
        const next = { ...prev };
        fields.forEach(field => {
          const value = imported[field];
          if (value !== undefined && value !== null && String(value).trim() !== '') {
            next[field] = value;
          }
        });
        if (imported.year) next.year = Number(imported.year);
        return next;
      });

      const warnings = Array.isArray(payload.warnings) ? payload.warnings.filter(Boolean) : [];
      setInstagramImportMsg({
        type: 'success',
        text: warnings.length ? `Imported available details. ${warnings[0]}` : 'Imported available details.',
      });
    } catch (err) {
      setInstagramImportMsg({ type: 'error', text: err.message || 'Instagram import failed.' });
    } finally {
      setImportingInstagram(false);
    }
  }

  // ---- People search inside drawer -----------------------------------------
  function handlePeopleSearch(query) {
    setPeopleSearch(query);
    setShowPeopleDropdown(true);
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
    if (credits.some(c => c.person_id === person.id) || savedCredits.some(c => c.person_id === person.id)) {
      setCreditMsg({ type: 'error', text: `${person.name} is already added.` });
      setTimeout(() => setCreditMsg(null), 3000);
      return;
    }
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
    setShowPeopleDropdown(false);
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
      setCreditMsg({ type: 'success', text: `Created profile for "${name}"` });
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
      setCreditMsg({ type: 'success', text: `Removed credit for ${credit.person?.name}` });
      setTimeout(() => setCreditMsg(null), 3000);
    } catch (err) {
      setCreditMsg({ type: 'error', text: 'Failed to remove credit: ' + err.message });
    }
  }

  async function saveCredits() {
    if (!editingPlay) {
      setCreditMsg({ type: 'error', text: 'Please save the play details first.' });
      return;
    }
    if (credits.length === 0) return;
    setSaving(true);
    try {
      for (const c of credits) {
        await upsertStageCredit({
          play_id: editingPlay.id,
          person_id: c.person_id,
          role: c.role || 'Actor',
          character_name: c.character_name?.trim() || null,
          billing_order: c.billing_order,
        });
      }
      setCreditMsg({ type: 'success', text: `Saved ${credits.length} credit(s)!` });
      setCredits([]);
      loadSavedCredits(editingPlay.id);
    } catch (err) {
      setCreditMsg({ type: 'error', text: 'Failed to save credits: ' + err.message });
    } finally {
      setSaving(false);
      setTimeout(() => setCreditMsg(null), 3500);
    }
  }

  // ---- Save Play -----------------------------------------------------------
  async function handleSubmit(e) {
    e.preventDefault();
    if (!formData.title.trim()) {
      setFormMsg({ type: 'error', text: 'Play title is required.' });
      return;
    }
    if (formData.run_start_date && formData.run_end_date && formData.run_end_date < formData.run_start_date) {
      setFormMsg({ type: 'error', text: 'End date cannot be before the start date.' });
      return;
    }
    setSaving(true);
    setFormMsg(null);
    try {
      const payload = editingPlay ? { ...formData, id: editingPlay.id } : formData;
      const saved = await upsertPlay(payload);
      setFormMsg({ type: 'success', text: editingPlay ? 'Play updated successfully!' : 'Play created successfully!' });
      if (!editingPlay) {
        setEditingPlay(saved);
        loadSavedCredits(saved.id);
      }
      loadData();
    } catch (err) {
      setFormMsg({ type: 'error', text: 'Failed to save play: ' + err.message });
    } finally {
      setSaving(false);
    }
  }

  // ---- Filtering -----------------------------------------------------------
  const filteredPlays = plays.filter(play => {
    const matchesSearch = !searchQuery.trim() ||
      play.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      play.playwright?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      play.venue?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || play.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const runningCount = plays.filter(p => p.status === 'currently_running').length;
  const upcomingCount = plays.filter(p => p.status === 'upcoming').length;
  const archivedCount = plays.filter(p => p.status === 'archived').length;

  return (
    <div className="min-h-screen bg-bg text-text-primary p-6 md:p-10 max-w-7xl mx-auto">
      <SEO title="Manage Theatre Plays | MuviDB Admin" />

      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-extrabold text-text-primary flex items-center gap-2">
            <Icon icon="solar:masks-bold" className="text-brand w-8 h-8" />
            Theatre Plays & Stage Catalog
          </h1>
          <p className="text-xs text-text-muted mt-1">Manage stage productions, venues, playwrights, and ensemble cast credits.</p>
        </div>

        <button
          onClick={() => handleOpenDrawer()}
          className="inline-flex items-center gap-2 bg-brand text-on-brand font-bold px-5 py-2.5 rounded-xl hover:bg-brand-hover transition-all shadow-lg shadow-brand/20 text-xs self-start md:self-auto"
        >
          <Icon icon="solar:add-circle-bold" className="w-5 h-5" />
          Add New Play
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        <div className="bg-surface border border-border p-4 rounded-xl text-center">
          <span className="text-[10px] text-text-muted uppercase font-bold tracking-wider">Total Plays</span>
          <p className="text-2xl font-extrabold text-text-primary mt-1">{plays.length}</p>
        </div>
        <div className="bg-surface border border-border p-4 rounded-xl text-center">
          <span className="text-[10px] text-green-500 uppercase font-bold tracking-wider">Currently Running</span>
          <p className="text-2xl font-extrabold text-green-500 mt-1">{runningCount}</p>
        </div>
        <div className="bg-surface border border-border p-4 rounded-xl text-center">
          <span className="text-[10px] text-blue-400 uppercase font-bold tracking-wider">Upcoming Shows</span>
          <p className="text-2xl font-extrabold text-blue-400 mt-1">{upcomingCount}</p>
        </div>
        <div className="bg-surface border border-border p-4 rounded-xl text-center">
          <span className="text-[10px] text-text-muted uppercase font-bold tracking-wider">Stage Archive</span>
          <p className="text-2xl font-extrabold text-text-muted mt-1">{archivedCount}</p>
        </div>
      </div>

      {/* Search & Status Filter */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-6 bg-surface border border-border p-4 rounded-xl">
        <div className="relative flex-1 w-full">
          <Icon icon="solar:magnifer-linear" className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search by play title, playwright, or venue..."
            className="w-full bg-bg border border-border rounded-xl pl-10 pr-4 py-2 text-xs text-text-primary focus:border-brand outline-none"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto">
          {[
            { id: 'all', label: 'All Plays' },
            { id: 'currently_running', label: 'Running' },
            { id: 'upcoming', label: 'Upcoming' },
            { id: 'archived', label: 'Archived' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setStatusFilter(tab.id)}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all ${
                statusFilter === tab.id
                  ? 'bg-brand text-on-brand shadow-sm'
                  : 'bg-surface-2 text-text-muted hover:text-text-primary'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Main Catalog View */}
      {loading ? (
        <div className="py-24 text-center">
          <div className="w-10 h-10 border-4 border-brand border-t-transparent rounded-full animate-spin mx-auto mb-2" />
          <p className="text-xs text-text-muted font-bold">Loading plays catalog...</p>
        </div>
      ) : filteredPlays.length === 0 ? (
        <div className="bg-surface border border-border rounded-2xl p-12 text-center">
          <Icon icon="solar:masks-line-duotone" className="w-16 h-16 text-text-muted mx-auto mb-3 opacity-40" />
          <h3 className="text-lg font-bold text-text-primary mb-1">No stage plays found</h3>
          <p className="text-xs text-text-muted mb-4">No productions match your current search filter.</p>
          <button
            onClick={() => handleOpenDrawer()}
            className="inline-flex items-center gap-2 bg-brand text-on-brand font-bold px-4 py-2 rounded-xl hover:bg-brand-hover transition-colors text-xs"
          >
            <Icon icon="solar:add-circle-bold" className="w-4 h-4" />
            Add First Play
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredPlays.map(play => (
            <div
              key={play.id}
              className="group bg-surface border border-border hover:border-brand/40 rounded-2xl overflow-hidden transition-all flex flex-col justify-between"
            >
              <div className="p-5 flex gap-4 items-start">
                <div className="w-20 h-28 rounded-xl overflow-hidden border border-border bg-surface-2 flex-shrink-0 shadow-md">
                  {play.poster_url ? (
                    <img src={play.poster_url} alt={play.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Icon icon="solar:masks-line-duotone" className="w-8 h-8 text-text-muted opacity-40" />
                    </div>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="text-[10px] font-bold text-brand uppercase tracking-wider truncate">
                      {play.genre || 'Stage Play'} • {getPlayDateLabel(play, 'N/A')}
                    </span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-tight flex-shrink-0 ${
                      play.status === 'currently_running'
                        ? 'bg-green-500/15 text-green-500 border border-green-500/30'
                        : play.status === 'upcoming'
                        ? 'bg-blue-500/15 text-blue-400 border border-blue-500/30'
                        : 'bg-surface-2 text-text-muted border border-border'
                    }`}>
                      {play.status === 'currently_running' ? 'Running' : play.status === 'upcoming' ? 'Upcoming' : 'Archive'}
                    </span>
                  </div>

                  <h3 className="text-base font-bold text-text-primary line-clamp-1 group-hover:text-brand transition-colors">
                    {play.title}
                  </h3>

                  {play.playwright && (
                    <p className="text-xs text-text-muted font-semibold mt-0.5">
                      By {play.playwright}
                    </p>
                  )}

                  <div className="mt-3 text-[11px] text-text-muted space-y-1">
                    {play.venue && (
                      <p className="flex items-center gap-1.5 truncate">
                        <Icon icon="solar:map-point-bold" className="w-3.5 h-3.5 text-brand flex-shrink-0" />
                        <span className="truncate">{play.venue}{play.city ? `, ${play.city}` : ''}</span>
                      </p>
                    )}
                    {play.director && (
                      <p className="flex items-center gap-1.5 truncate">
                        <Icon icon="solar:user-bold" className="w-3.5 h-3.5 text-text-muted flex-shrink-0" />
                        <span className="truncate">Dir: {play.director}</span>
                      </p>
                    )}
                  </div>
                </div>
              </div>

              <div className="px-5 py-3 bg-surface-2/60 border-t border-border flex items-center justify-between">
                <a
                  href={`/plays/${play.slug}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[11px] text-text-muted hover:text-brand font-semibold flex items-center gap-1 transition-colors"
                >
                  <Icon icon="solar:link-circle-bold" className="w-3.5 h-3.5" />
                  View Public Page
                </a>

                <button
                  onClick={() => handleOpenDrawer(play)}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-brand/10 text-brand font-bold hover:bg-brand hover:text-on-brand transition-all text-xs"
                >
                  <Icon icon="solar:pen-bold" className="w-3.5 h-3.5" />
                  Edit Play
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Wide Side Panel Drawer (Matching Edit Movie Profile) ──────────── */}
      <Drawer
        isOpen={isDrawerOpen}
        onClose={handleCloseDrawer}
        title={editingPlay ? 'Edit Play Profile' : 'Add New Stage Play'}
        width="820px"
      >
        <form onSubmit={handleSubmit} className="space-y-10">
          <section className="rounded-lg border border-border bg-surface-2/50 p-4 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <h4 className="text-xs font-bold text-text-muted uppercase tracking-wider flex items-center gap-2">
                <Icon icon="mdi:instagram" className="w-4 h-4 text-pink-400" />
                Instagram Import
              </h4>
              <button
                type="button"
                onClick={handleInstagramImport}
                disabled={importingInstagram || !instagramImport.url.trim()}
                className="inline-flex items-center gap-2 bg-brand text-on-brand px-3 py-2 rounded-md text-xs font-bold hover:bg-brand-hover transition-colors disabled:opacity-60"
              >
                <Icon icon={importingInstagram ? 'solar:refresh-bold' : 'solar:magic-stick-3-bold'} className={`w-4 h-4 ${importingInstagram ? 'animate-spin' : ''}`} />
                {importingInstagram ? 'Fetching...' : 'Fetch Details'}
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3">
              <div>
                <label className="block text-[10px] font-bold text-text-muted uppercase mb-1">Instagram URL</label>
                <input
                  type="url"
                  value={instagramImport.url}
                  onChange={e => setInstagramImport(prev => ({ ...prev, url: e.target.value }))}
                  className="w-full bg-surface border border-border rounded-md px-3 py-2 text-xs text-text-primary focus:border-brand outline-none"
                  placeholder="https://www.instagram.com/p/..."
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-text-muted uppercase mb-1">Flyer</label>
                <label className="h-[34px] inline-flex items-center gap-2 bg-surface border border-border rounded-md px-3 text-xs text-text-primary cursor-pointer hover:border-brand/60 transition-colors">
                  <Icon icon="solar:upload-minimalistic-bold" className="w-4 h-4 text-text-muted" />
                  <span className="max-w-[150px] truncate">{instagramImageName || 'Image'}</span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleInstagramFlyerChange}
                  />
                </label>
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-text-muted uppercase mb-1">Caption</label>
              <textarea
                rows={3}
                value={instagramImport.caption}
                onChange={e => setInstagramImport(prev => ({ ...prev, caption: e.target.value }))}
                className="w-full bg-surface border border-border rounded-md px-3 py-2 text-xs text-text-primary focus:border-brand outline-none resize-none leading-relaxed"
                placeholder="Paste caption text when available"
              />
            </div>

            {instagramImportMsg && (
              <div className={`p-2.5 rounded-lg text-xs font-bold ${instagramImportMsg.type === 'success' ? 'bg-green-500/10 text-green-500 border border-green-500/30' : 'bg-red-500/10 text-red-400 border border-red-500/30'}`}>
                {instagramImportMsg.text}
              </div>
            )}
          </section>

          {/* Two Column Layout: Core Information vs Media & Presentation */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
            {/* Left Column: Core Information */}
            <section className="space-y-5">
              <div className="flex items-center justify-between pb-2 border-b border-border">
                <h4 className="text-xs font-bold text-text-muted uppercase tracking-wider">Core Information</h4>
              </div>

              <div className="space-y-4">
                {/* Title */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-bold text-text-primary">Play Title *</label>
                    <span className="text-[10px] font-bold text-brand bg-brand/10 border border-brand/20 px-2 py-0.5 rounded-full flex items-center gap-1">
                      <Icon icon="solar:magic-stick-bold" className="w-3 h-3" />
                      AI Polish
                    </span>
                  </div>
                  <input
                    required
                    type="text"
                    value={formData.title}
                    onChange={e => setFormData({ ...formData, title: e.target.value })}
                    className="w-full bg-surface-2 border border-border rounded-md px-3.5 py-2.5 text-sm text-text-primary focus:border-brand outline-none transition-all"
                    placeholder="e.g. Saro The Musical"
                  />
                </div>

                {/* Slug */}
                <div>
                  <label className="block text-xs font-bold text-text-primary mb-1.5">URL Slug (Optional)</label>
                  <input
                    type="text"
                    value={formData.slug}
                    onChange={e => setFormData({ ...formData, slug: e.target.value })}
                    className="w-full bg-surface-2 border border-border rounded-md px-3.5 py-2 text-xs text-text-primary focus:border-brand outline-none"
                    placeholder="e.g. saro-the-musical"
                  />
                </div>

                {/* Playwright & Director */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-text-primary mb-1.5">Playwright</label>
                    <input
                      type="text"
                      value={formData.playwright}
                      onChange={e => setFormData({ ...formData, playwright: e.target.value })}
                      className="w-full bg-surface-2 border border-border rounded-md px-3.5 py-2 text-xs text-text-primary focus:border-brand outline-none"
                      placeholder="e.g. Wole Soyinka"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-text-primary mb-1.5">Director</label>
                    <input
                      type="text"
                      value={formData.director}
                      onChange={e => setFormData({ ...formData, director: e.target.value })}
                      className="w-full bg-surface-2 border border-border rounded-md px-3.5 py-2 text-xs text-text-primary focus:border-brand outline-none"
                      placeholder="e.g. Bolanle Austen-Peters"
                    />
                  </div>
                </div>

                {/* Producer & Venue */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-text-primary mb-1.5">Producer</label>
                    <input
                      type="text"
                      value={formData.producer}
                      onChange={e => setFormData({ ...formData, producer: e.target.value })}
                      className="w-full bg-surface-2 border border-border rounded-md px-3.5 py-2 text-xs text-text-primary focus:border-brand outline-none"
                      placeholder="e.g. Terra Kulture"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-text-primary mb-1.5">Venue</label>
                    <input
                      type="text"
                      value={formData.venue}
                      onChange={e => setFormData({ ...formData, venue: e.target.value })}
                      className="w-full bg-surface-2 border border-border rounded-md px-3.5 py-2 text-xs text-text-primary focus:border-brand outline-none"
                      placeholder="e.g. Muson Centre"
                    />
                  </div>
                </div>

                {/* Run Dates */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-text-primary mb-1.5">Start Date</label>
                    <input
                      type="date"
                      value={formData.run_start_date}
                      onChange={e => {
                        const run_start_date = e.target.value;
                        setFormData({
                          ...formData,
                          run_start_date,
                          year: run_start_date ? Number(run_start_date.slice(0, 4)) : formData.year,
                        });
                      }}
                      className="w-full bg-surface-2 border border-border rounded-md px-3 py-2 text-xs text-text-primary focus:border-brand outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-text-primary mb-1.5">End Date</label>
                    <input
                      type="date"
                      value={formData.run_end_date}
                      onChange={e => setFormData({ ...formData, run_end_date: e.target.value })}
                      className="w-full bg-surface-2 border border-border rounded-md px-3 py-2 text-xs text-text-primary focus:border-brand outline-none"
                    />
                  </div>
                </div>

                {/* Time & Source */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-text-primary mb-1.5">Performance Time</label>
                    <input
                      type="text"
                      value={formData.performance_time}
                      onChange={e => setFormData({ ...formData, performance_time: e.target.value })}
                      className="w-full bg-surface-2 border border-border rounded-md px-3 py-2 text-xs text-text-primary focus:border-brand outline-none"
                      placeholder="e.g. 6:00 PM"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-text-primary mb-1.5">Source URL</label>
                    <input
                      type="url"
                      value={formData.source_url}
                      onChange={e => setFormData({ ...formData, source_url: e.target.value })}
                      className="w-full bg-surface-2 border border-border rounded-md px-3 py-2 text-xs text-text-primary focus:border-brand outline-none"
                      placeholder="https://..."
                    />
                  </div>
                </div>

                {/* Year, City, Status */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-text-primary mb-1.5">Year</label>
                    <input
                      type="number"
                      value={formData.year}
                      onChange={e => setFormData({ ...formData, year: Number(e.target.value) })}
                      className="w-full bg-surface-2 border border-border rounded-md px-3 py-2 text-xs text-text-primary focus:border-brand outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-text-primary mb-1.5">City</label>
                    <input
                      type="text"
                      value={formData.city}
                      onChange={e => setFormData({ ...formData, city: e.target.value })}
                      className="w-full bg-surface-2 border border-border rounded-md px-3 py-2 text-xs text-text-primary focus:border-brand outline-none"
                      placeholder="Lagos"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-text-primary mb-1.5">Status</label>
                    <select
                      value={formData.status}
                      onChange={e => setFormData({ ...formData, status: e.target.value })}
                      className="w-full bg-surface-2 border border-border rounded-md px-2 py-2 text-xs text-text-primary focus:border-brand outline-none cursor-pointer"
                    >
                      <option value="archived">Archived</option>
                      <option value="currently_running">Running</option>
                      <option value="upcoming">Upcoming</option>
                    </select>
                  </div>
                </div>
                {/* Synopsis */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-bold text-text-primary">Story Synopsis</label>
                    <span className="text-[10px] font-bold text-white bg-brand border border-brand/20 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                      <Icon icon="solar:stars-minimalistic-bold" className="w-3 h-3" />
                      AI Summarize
                    </span>
                  </div>
                  <textarea
                    rows={4}
                    value={formData.synopsis}
                    onChange={e => setFormData({ ...formData, synopsis: e.target.value })}
                    className="w-full bg-surface-2 border border-border rounded-md px-3.5 py-2.5 text-xs text-text-primary focus:border-brand outline-none resize-none leading-relaxed"
                    placeholder="Enter synopsis of the stage production..."
                  />
                </div>

                {/* Intelligence Box */}
                <div className="p-4 bg-surface-2/60 border border-border rounded-lg space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]"></span>
                    <h5 className="text-[10px] font-bold text-blue-400 uppercase tracking-widest">PRODUCTION INTELLIGENCE</h5>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-bold text-text-muted uppercase mb-1">Country</label>
                      <input
                        type="text"
                        value={formData.country}
                        onChange={e => setFormData({ ...formData, country: e.target.value })}
                        className="w-full bg-surface border border-border rounded-lg px-2.5 py-1.5 text-xs text-text-primary outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-text-muted uppercase mb-1">Genre Category</label>
                      <input
                        type="text"
                        value={formData.genre}
                        onChange={e => setFormData({ ...formData, genre: e.target.value })}
                        className="w-full bg-surface border border-border rounded-lg px-2.5 py-1.5 text-xs text-text-primary outline-none"
                        placeholder="e.g. Musical"
                      />
                    </div>
                  </div>
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
                  label="Poster Asset"
                  value={formData.poster_url}
                  onChange={url => setFormData(prev => ({ ...prev, poster_url: url }))}
                  bucket="film-images"
                  aspect="poster"
                />

                <ImageField
                  label="Landscape Backdrop"
                  value={formData.banner_url}
                  onChange={url => setFormData(prev => ({ ...prev, banner_url: url }))}
                  bucket="film-images"
                  aspect="backdrop"
                />
              </div>

              {/* Classification Genres Checkbox Grid */}
              <div className="p-4 bg-surface-2/60 border border-border rounded-lg space-y-3">
                <label className="block text-[10px] font-bold text-text-muted uppercase tracking-widest">CLASSIFICATION GENRES</label>
                <div className="grid grid-cols-2 gap-2">
                  {ALL_PLAY_GENRES.map(g => {
                    const isChecked = formData.genre?.toLowerCase().includes(g.toLowerCase());
                    return (
                      <label key={g} className="flex items-center gap-2 cursor-pointer group">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={e => {
                            if (e.target.checked) {
                              setFormData(prev => ({ ...prev, genre: prev.genre ? `${prev.genre}, ${g}` : g }));
                            } else {
                              setFormData(prev => ({ ...prev, genre: prev.genre.replace(g, '').replace(/^,\s*|,\s*$/g, '') }));
                            }
                          }}
                          className="w-3.5 h-3.5 rounded border-border text-brand bg-surface focus:ring-brand/30 accent-brand"
                        />
                        <span className="text-xs text-text-muted group-hover:text-text-primary transition-colors">{g}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            </section>
          </div>

          {/* Save Button for Play Form */}
          {formMsg && (
            <div className={`p-3 rounded-xl text-xs font-bold ${formMsg.type === 'success' ? 'bg-green-500/10 text-green-500 border border-green-500/30' : 'bg-red-500/10 text-red-400 border border-red-500/30'}`}>
              {formMsg.text}
            </div>
          )}

          <button
            type="submit"
            disabled={saving}
            className="w-full bg-brand text-on-brand font-bold py-3 rounded-xl hover:bg-brand-hover transition-colors disabled:opacity-60 text-xs shadow-lg shadow-brand/20"
          >
            {saving ? 'Saving Play Profile…' : editingPlay ? 'Update Play Profile' : 'Save Play Profile'}
          </button>

          {/* Full Width Bottom Section: Stage Performers & Crew */}
          <div className="pt-8 border-t border-border space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-bold text-text-primary flex items-center gap-2">
                  <Icon icon="solar:users-group-two-rounded-bold" className="text-brand w-4 h-4" />
                  Stage Performers & Crew
                </h4>
                <p className="text-[11px] text-text-muted mt-0.5">
                  {editingPlay ? `Cast credits attached to "${editingPlay.title}"` : 'Save play profile first to attach ensemble cast credits.'}
                </p>
              </div>
            </div>

            {/* People search input */}
            <div className="relative" ref={searchRef}>
              <div className="flex items-center gap-2 bg-surface-2 border border-border rounded-xl px-3.5 py-2.5 focus-within:border-brand transition-colors">
                <Icon icon="solar:magnifer-linear" className="w-4 h-4 text-text-muted flex-shrink-0" />
                <input
                  type="text"
                  value={peopleSearch}
                  onChange={e => handlePeopleSearch(e.target.value)}
                  onFocus={() => peopleSearch.length >= 2 && setShowPeopleDropdown(true)}
                  placeholder="Search actor or crew member by name..."
                  disabled={!editingPlay}
                  className="flex-1 bg-transparent outline-none text-xs text-text-primary placeholder-text-muted disabled:opacity-50"
                />
                {isSearchingPeople && (
                  <div className="w-4 h-4 border-2 border-brand border-t-transparent rounded-full animate-spin flex-shrink-0" />
                )}
              </div>

              {/* Search dropdown */}
              {showPeopleDropdown && peopleSearch.trim().length >= 2 && (
                <div className="absolute left-0 right-0 top-full mt-1 bg-surface border border-border rounded-xl shadow-2xl z-30 overflow-hidden">
                  {isSearchingPeople ? (
                    <div className="p-6 text-center text-xs text-text-muted">Searching directory...</div>
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
                            <p className="text-[10px] text-text-muted font-semibold uppercase tracking-tight">Existing Person</p>
                          </div>
                        </button>
                      ))}
                      {peopleSearch.trim() && !peopleResults.some(p => p.name.toLowerCase() === peopleSearch.trim().toLowerCase()) && (
                        <button
                          type="button"
                          onClick={() => createAndAddPerson(peopleSearch.trim())}
                          className="w-full flex items-center gap-3 px-4 py-3 bg-brand/5 hover:bg-brand/10 transition-colors text-left group"
                        >
                          <div className="w-8 h-8 rounded-full bg-brand text-white flex items-center justify-center group-hover:scale-110 transition-transform shadow-md flex-shrink-0">
                            <Icon icon="solar:plus-bold" className="w-4 h-4" />
                          </div>
                          <div>
                            <p className="text-[10px] font-black text-brand uppercase tracking-widest leading-none mb-0.5">New Person</p>
                            <p className="text-xs font-bold text-text-primary">Create profile for "{peopleSearch.trim()}"</p>
                          </div>
                        </button>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Pending credits */}
            {credits.length > 0 && (
              <div className="space-y-3">
                <p className="text-[10px] font-bold text-text-muted uppercase tracking-wider">Pending Credits ({credits.length})</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {credits.map((c, idx) => (
                    <div key={idx} className="flex items-start gap-3 bg-brand/5 border border-brand/20 rounded-xl p-3">
                      <div className="w-9 h-9 rounded-full bg-surface-2 overflow-hidden border border-border flex-shrink-0 mt-0.5">
                        {c.photo_url && <img src={c.photo_url} alt="" className="w-full h-full object-cover" />}
                      </div>
                      <div className="flex-1 space-y-2 min-w-0">
                        <p className="text-xs font-bold text-text-primary truncate">{c.name}</p>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-[9px] text-text-muted font-bold block mb-0.5">Role</label>
                            <input
                              type="text"
                              value={c.role}
                              onChange={e => setCredits(prev => prev.map((cr, i) => i === idx ? { ...cr, role: e.target.value } : cr))}
                              placeholder="Actor"
                              className="w-full bg-bg border border-border rounded-lg px-2 py-1 text-xs text-text-primary outline-none"
                            />
                          </div>
                          <div>
                            <label className="text-[9px] text-text-muted font-bold block mb-0.5">Character Name</label>
                            <input
                              type="text"
                              value={c.character_name}
                              onChange={e => setCredits(prev => prev.map((cr, i) => i === idx ? { ...cr, character_name: e.target.value } : cr))}
                              placeholder="e.g. Lead"
                              className="w-full bg-bg border border-border rounded-lg px-2 py-1 text-xs text-text-primary outline-none"
                            />
                          </div>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeCredit(idx)}
                        className="p-1.5 rounded-lg text-red-400 hover:bg-red-500/10 transition-colors flex-shrink-0"
                        title="Remove"
                      >
                        <Icon icon="solar:trash-bin-trash-bold" className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={saveCredits}
                  disabled={saving}
                  className="w-full bg-brand text-on-brand font-bold py-2 rounded-xl hover:bg-brand-hover transition-colors text-xs disabled:opacity-60"
                >
                  {saving ? 'Saving…' : `Save ${credits.length} Pending Credit(s)`}
                </button>
              </div>
            )}

            {/* Saved credits */}
            {editingPlay && (
              <div>
                {loadingCredits ? (
                  <div className="py-4 text-center">
                    <div className="w-5 h-5 border-2 border-brand border-t-transparent rounded-full animate-spin mx-auto" />
                  </div>
                ) : savedCredits.length > 0 ? (
                  <div className="space-y-2">
                    <p className="text-[10px] font-bold text-text-muted uppercase tracking-wider mb-2">Saved Performers ({savedCredits.length})</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {savedCredits.map(c => {
                        const person = c.person || {};
                        return (
                          <div key={c.id} className="flex items-center justify-between gap-3 bg-surface-2 border border-border rounded-xl p-3">
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="w-9 h-9 rounded-full bg-surface overflow-hidden border border-border flex-shrink-0">
                                {person.photo_url && <img src={person.photo_url} alt="" className="w-full h-full object-cover" />}
                              </div>
                              <div className="min-w-0">
                                <p className="text-xs font-bold text-text-primary truncate">{person.name}</p>
                                <p className="text-[10px] text-brand font-semibold">
                                  {c.role}{c.character_name ? ` as ${c.character_name}` : ''}
                                </p>
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => removeSavedCredit(c)}
                              className="p-1.5 rounded-lg text-red-400 hover:bg-red-500/10 transition-colors flex-shrink-0"
                              title="Remove credit"
                            >
                              <Icon icon="solar:trash-bin-trash-bold" className="w-4 h-4" />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <p className="text-[11px] text-text-muted text-center py-4 border border-dashed border-border rounded-xl">
                    No performers attached yet — search above to add cast credits.
                  </p>
                )}
              </div>
            )}

            {creditMsg && (
              <div className={`p-3 rounded-xl text-xs font-bold ${creditMsg.type === 'success' ? 'bg-green-500/10 text-green-500 border border-green-500/30' : 'bg-red-500/10 text-red-400 border border-red-500/30'}`}>
                {creditMsg.text}
              </div>
            )}
          </div>
        </form>
      </Drawer>
    </div>
  );
}
