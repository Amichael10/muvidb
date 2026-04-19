import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import Drawer from '../../components/admin/Drawer';
import ConfirmModal from '../../components/admin/ConfirmModal';
import SkeletonRow from '../../components/admin/SkeletonRow';
import { extractChannelIdentifier, fetchChannelData, getPersonYoutubeChannelUrl } from '../../lib/youtube';

export default function AdminPeople() {
  const [people, setPeople] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [verifiedFilter, setVerifiedFilter] = useState('All'); // All, Verified, Unverified
  const [sortBy, setSortBy] = useState('Most Popular'); // Most Popular, Most Credits, A-Z, Newest

  // Modals/Drawers state
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [editingPerson, setEditingPerson] = useState(null);
  const [deletingPerson, setDeletingPerson] = useState(null);
  const [selectedPersonIds, setSelectedPersonIds] = useState([]);
  const [personBatchDeleteIds, setPersonBatchDeleteIds] = useState(null);
  const [isBatchDeletingPeople, setIsBatchDeletingPeople] = useState(false);
  const [personCredits, setPersonCredits] = useState([]);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    bio: '',
    photo_url: '',
    date_of_birth: '',
    gender: 'Prefer not to say',
    nationality: 'Nigerian',
    is_verified: false,
    is_spotlight: false,
    popularity_score: 0,
    youtube_channel_id: '',
    youtube_handle: '',
    youtube_stats: { subscribers: '0', videos: '0', thumbnail: null, banner: null }
  });
  const [isSaving, setIsSaving] = useState(false);
  const [isRecalculating, setIsRecalculating] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  /** Single field: paste channel URL, @handle, or UC… id (parsed on save / fetch) */
  const [youtubeChannelInput, setYoutubeChannelInput] = useState('');

  const fetchPeople = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('people')
        .select(`*, credits(count)`)
        .order('popularity_score', { ascending: false });

      if (error) throw error;
      setPeople(data || []);
    } catch (error) {
      console.error('Error fetching people:', error);
      toast.error('Failed to load people');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPeople();
  }, []);

  useEffect(() => {
    setSelectedPersonIds([]);
  }, [search, verifiedFilter, sortBy]);

  // Filtering and Sorting
  let filteredPeople = people.filter(p => 
    p.name.toLowerCase().includes(search.toLowerCase())
  );

  if (verifiedFilter === 'Verified') {
    filteredPeople = filteredPeople.filter(p => p.is_verified);
  } else if (verifiedFilter === 'Unverified') {
    filteredPeople = filteredPeople.filter(p => !p.is_verified);
  }

  filteredPeople.sort((a, b) => {
    if (sortBy === 'Most Popular') {
      return (b.popularity_score || 0) - (a.popularity_score || 0);
    } else if (sortBy === 'Most Credits') {
      return (b.credits?.[0]?.count || 0) - (a.credits?.[0]?.count || 0);
    } else if (sortBy === 'A-Z') {
      return a.name.localeCompare(b.name);
    } else if (sortBy === 'Newest') {
      return new Date(b.created_at) - new Date(a.created_at);
    }
    return 0;
  });

  const handleToggleVerify = async (person) => {
    try {
      const newStatus = !person.is_verified;
      const { error } = await supabase
        .from('people')
        .update({ is_verified: newStatus })
        .eq('id', person.id);

      if (error) throw error;
      
      setPeople(people.map(p => p.id === person.id ? { ...p, is_verified: newStatus } : p));
      toast.success(newStatus ? 'Profile verified ✓' : 'Verification removed');
    } catch (error) {
      console.error('Error toggling verification:', error);
      toast.error('Failed to update verification status');
    }
  };

  const handleDelete = async () => {
    if (!deletingPerson) return;
    try {
      const { error } = await supabase
        .from('people')
        .delete()
        .eq('id', deletingPerson.id);

      if (error) throw error;

      setPeople(people.filter(p => p.id !== deletingPerson.id));
      setSelectedPersonIds((prev) => prev.filter((id) => id !== deletingPerson.id));
      toast.success('Person deleted');
      setDeletingPerson(null);
    } catch (error) {
      console.error('Error deleting person:', error);
      toast.error('Failed to delete person');
    }
  };

  const openAddDrawer = () => {
    setEditingPerson(null);
    setYoutubeChannelInput('');
    setFormData({
      name: '',
      bio: '',
      photo_url: '',
      date_of_birth: '',
      gender: 'Prefer not to say',
      nationality: 'Nigerian',
      is_verified: false,
      is_spotlight: false,
      popularity_score: 0,
      tmdb_id: '',
      youtube_channel_id: '',
      youtube_handle: '',
      youtube_stats: { subscribers: '0', videos: '0', thumbnail: null, banner: null }
    });
    setIsDrawerOpen(true);
  };

  const openEditDrawer = async (person) => {
    setEditingPerson(person);
    setFormData({
      name: person.name || '',
      bio: person.bio || '',
      photo_url: person.photo_url || '',
      date_of_birth: person.date_of_birth || '',
      gender: person.gender || 'Prefer not to say',
      nationality: person.nationality || 'Nigerian',
      is_verified: person.is_verified || false,
      is_spotlight: person.is_spotlight || false,
      popularity_score: person.popularity_score || 0,
      tmdb_id: person.tmdb_id || '',
      youtube_channel_id: person.youtube_channel_id || '',
      youtube_handle: person.youtube_handle || '',
      youtube_stats: person.youtube_stats || { subscribers: '0', videos: '0', thumbnail: null, banner: null }
    });
    setYoutubeChannelInput(getPersonYoutubeChannelUrl(person) || '');
    
    // Fetch credits for this person
    const { data: credits } = await supabase
      .from('credits')
      .select(`
        id, role, character_name, billing_order,
        films(id, title, year, poster_url)
      `)
      .eq('person_id', person.id)
      .order('billing_order');
      
    setPersonCredits(credits || []);
    setIsDrawerOpen(true);
  };

  const refreshFromTmdb = async () => {
    if (!formData.tmdb_id) {
      toast.error('No TMDB ID linked to this profile');
      return;
    }

    const tmdbId = formData.tmdb_id;
    setIsRefreshing(true);
    toast.loading('Refreshing profile data...', { id: 'refresh-profile' });

    try {
      // 1. Refresh TMDB Metadata
      const res = await fetch(`/api/tmdb?endpoint=/person/${tmdbId}&language=en-US`);
      if (!res.ok) throw new Error('TMDB fetch failed');
      const data = await res.json();

      setFormData(prev => ({
        ...prev,
        bio: data.biography || prev.bio,
        photo_url: data.profile_path ? `https://image.tmdb.org/t/p/w520${data.profile_path}` : prev.photo_url,
      }));

      // 2. Try to refresh YouTube stats if they have a channel linked
      if (formData.youtube_channel_id || formData.youtube_handle) {
        try {
          const ident = { 
            type: formData.youtube_channel_id ? 'id' : 'handle', 
            value: formData.youtube_channel_id || formData.youtube_handle 
          };
          const ytData = await fetchChannelData(ident);
          setFormData(prev => ({
            ...prev,
            youtube_stats: {
              subscribers: ytData.subscribers,
              videos: ytData.videos,
              thumbnail: ytData.thumbnail,
              banner: ytData.banner,
              last_updated: ytData.lastUpdated
            }
          }));
        } catch (ytErr) {
          console.warn('YouTube refresh failed during TMDB sync:', ytErr);
        }
      }

      toast.success('Profile Refreshed Successfully', { id: 'refresh-profile' });
    } catch (error) {
      console.error('Refresh Error:', error);
      toast.error('Failed to refresh from TMDB', { id: 'refresh-profile' });
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleFetchYoutube = async () => {
    const identifierRaw =
      youtubeChannelInput.trim() || formData.youtube_channel_id || formData.youtube_handle;
    if (!identifierRaw) {
      toast.error('Enter a channel URL, @handle, or channel ID first');
      return;
    }

    const t = toast.loading('Connecting to YouTube API...');
    try {
      const ident = extractChannelIdentifier(identifierRaw.trim());
      const ytData = await fetchChannelData(ident);

      setFormData(prev => ({
        ...prev,
        youtube_channel_id: ytData.channelId,
        youtube_handle: ytData.handle || prev.youtube_handle,
        youtube_stats: {
          subscribers: ytData.subscribers,
          videos: ytData.videos,
          thumbnail: ytData.thumbnail,
          banner: ytData.banner,
          last_updated: ytData.lastUpdated
        }
      }));
      setYoutubeChannelInput(`https://www.youtube.com/channel/${ytData.channelId}`);
      toast.success(`Fetched: ${ytData.title}`, { id: t });
    } catch (err) {
      toast.error(err.message || 'YouTube Fetch Failed', { id: t });
    }
  };

  const handleRemoveCredit = async (creditId) => {
    try {
      const { error } = await supabase
        .from('credits')
        .delete()
        .eq('id', creditId);
        
      if (error) throw error;
      
      setPersonCredits(personCredits.filter(c => c.id !== creditId));
      toast.success('Credit removed');
    } catch (error) {
      console.error('Error removing credit:', error);
      toast.error('Failed to remove credit');
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      let youtube_channel_id = null;
      let youtube_handle = null;
      let youtube_stats = formData.youtube_stats;

      if (youtubeChannelInput.trim()) {
        const ident = extractChannelIdentifier(youtubeChannelInput.trim());
        if (ident?.type === 'id') {
          youtube_channel_id = ident.value;
          youtube_handle = null;
        } else if (ident?.type === 'handle') {
          youtube_handle = String(ident.value).replace(/^@/, '');
          youtube_channel_id = null;
        }
      } else {
        youtube_stats = null;
      }

      // Clean empty strings to null where appropriate
      const dataToSave = {
        ...formData,
        date_of_birth: formData.date_of_birth || null,
        photo_url: formData.photo_url || null,
        popularity_score: parseInt(formData.popularity_score) || 0,
        tmdb_id: formData.tmdb_id || null,
        youtube_channel_id,
        youtube_handle,
        youtube_stats
      };

      if (editingPerson) {
        const { error } = await supabase
          .from('people')
          .update(dataToSave)
          .eq('id', editingPerson.id);
        if (error) throw error;
        toast.success('Profile updated');
      } else {
        const { error } = await supabase
          .from('people')
          .insert([dataToSave]);
        if (error) throw error;
        toast.success('Person added');
      }
      setIsDrawerOpen(false);
      fetchPeople();
    } catch (error) {
      console.error('Error saving person:', error);
      toast.error('Failed to save person');
    } finally {
      setIsSaving(false);
    }
  };

  const formatNumber = (num) => {
    if (!num) return '0';
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
  };

  const handleRecalculateScores = async () => {
    setIsRecalculating(true);
    try {
      const { error } = await supabase.rpc('refresh_all_popularity_scores');
      if (error) throw error;
      toast.success('Popularity scores updated');
      await fetchPeople();
    } catch (error) {
      console.error('Error recalculating scores:', error);
      toast.error('Failed to update scores');
    } finally {
      setIsRecalculating(false);
    }
  };

  const getInitials = (name) => {
    if (!name) return '?';
    return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
  };

  const togglePersonSelect = (id) => {
    setSelectedPersonIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const allFilteredPeopleSelected =
    filteredPeople.length > 0 && filteredPeople.every((p) => selectedPersonIds.includes(p.id));

  const toggleSelectAllFilteredPeople = () => {
    if (allFilteredPeopleSelected) {
      const filteredIds = new Set(filteredPeople.map((p) => p.id));
      setSelectedPersonIds((prev) => prev.filter((id) => !filteredIds.has(id)));
    } else {
      setSelectedPersonIds((prev) => {
        const next = new Set([...prev, ...filteredPeople.map((p) => p.id)]);
        return [...next];
      });
    }
  };

  const handleConfirmBatchDeletePeople = async () => {
    if (!personBatchDeleteIds?.length) return;
    setIsBatchDeletingPeople(true);
    try {
      const { error } = await supabase.from('people').delete().in('id', personBatchDeleteIds);
      if (error) throw error;
      setPeople((prev) => prev.filter((p) => !personBatchDeleteIds.includes(p.id)));
      setSelectedPersonIds((prev) => prev.filter((id) => !personBatchDeleteIds.includes(id)));
      toast.success(`Deleted ${personBatchDeleteIds.length} people`);
      setPersonBatchDeleteIds(null);
    } catch (error) {
      console.error('Error batch deleting people:', error);
      toast.error('Batch delete failed');
    } finally {
      setIsBatchDeletingPeople(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-text-primary">People</h1>
          <span className="bg-surface-2 text-text-muted px-3 py-1 rounded-full text-sm font-medium">
            {people.length}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleRecalculateScores}
            disabled={isRecalculating}
            className="flex items-center gap-2 bg-surface text-text-primary border border-border px-4 py-2 rounded-xl hover:bg-surface-2 transition-colors disabled:opacity-50"
          >
            {isRecalculating ? (
              <>
                <svg className="animate-spin h-4 w-4 text-gold" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span>Calculating...</span>
              </>
            ) : (
              <>
                <svg className="w-4 h-4 text-gold" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                <span>Recalculate Scores</span>
              </>
            )}
          </button>
          <button
            onClick={openAddDrawer}
            className="bg-gold text-dark font-semibold px-4 py-2 rounded-xl hover:bg-gold/90 transition-colors"
          >
            + Add Person
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-[#13192B] p-4 rounded-2xl flex flex-col md:flex-row gap-4 items-center justify-between border border-border">
        <div className="relative w-full md:w-96">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Search people..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-bg border border-border text-text-primary rounded-xl pl-10 pr-4 py-2 text-sm focus:border-gold focus:outline-none"
          />
        </div>
        
        <div className="flex items-center gap-4 w-full md:w-auto">
          <select
            value={verifiedFilter}
            onChange={(e) => setVerifiedFilter(e.target.value)}
            className="bg-bg border border-border text-text-primary rounded-xl px-4 py-2 text-sm focus:border-gold focus:outline-none flex-1 md:flex-none"
          >
            <option value="All">All Status</option>
            <option value="Verified">Verified</option>
            <option value="Unverified">Unverified</option>
          </select>
          
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="bg-bg border border-border text-text-primary rounded-xl px-4 py-2 text-sm focus:border-gold focus:outline-none flex-1 md:flex-none"
          >
            <option value="Most Popular">Most Popular</option>
            <option value="Most Credits">Most Credits</option>
            <option value="A-Z">A-Z</option>
            <option value="Newest">Newest</option>
          </select>
        </div>
      </div>

      {selectedPersonIds.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-2xl bg-surface-2 border border-border">
          <span className="text-sm text-text-primary font-bold">
            {selectedPersonIds.length} selected
          </span>
          <button
            type="button"
            onClick={() => setPersonBatchDeleteIds([...selectedPersonIds])}
            className="text-sm font-semibold px-4 py-2 rounded-xl bg-red-500/15 text-red-400 border border-red-500/30 hover:bg-red-500/25 transition-colors"
          >
            Delete selected
          </button>
        </div>
      )}

      {/* Data Table */}
      <div className="bg-[#13192B] rounded-2xl border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-text-muted uppercase bg-surface-2/50 border-b border-border">
              <tr>
                <th className="pl-6 pr-2 py-4 w-12">
                  <input
                    type="checkbox"
                    checked={allFilteredPeopleSelected}
                    onChange={toggleSelectAllFilteredPeople}
                    disabled={isLoading || filteredPeople.length === 0}
                    className="w-4 h-4 rounded border-border text-gold bg-bg focus:ring-gold accent-gold cursor-pointer disabled:opacity-40"
                    title="Select all in this view"
                  />
                </th>
                <th className="px-6 py-4 font-medium">Person</th>
                <th className="px-6 py-4 font-medium">Nationality</th>
                <th className="px-6 py-4 font-medium">Credits</th>
                <th className="px-6 py-4 font-medium">Popularity</th>
                <th className="px-6 py-4 font-medium">Verified</th>
                <th className="px-6 py-4 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading ? (
                Array(5).fill(0).map((_, i) => <SkeletonRow key={i} columns={6} />)
              ) : filteredPeople.length === 0 ? (
                <tr>
                  <td colSpan="7" className="px-6 py-8 text-center text-text-muted">
                    No people found matching your criteria.
                  </td>
                </tr>
              ) : (
                filteredPeople.map((person) => (
                  <tr key={person.id} className="hover:bg-surface-2/50 transition-colors group">
                    <td className="pl-6 pr-2 py-4 align-middle">
                      <input
                        type="checkbox"
                        checked={selectedPersonIds.includes(person.id)}
                        onChange={() => togglePersonSelect(person.id)}
                        className="w-4 h-4 rounded border-border text-gold bg-bg focus:ring-gold accent-gold cursor-pointer"
                        aria-label={`Select ${person.name}`}
                      />
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        {person.photo_url ? (
                          <img src={person.photo_url} alt={person.name} className="w-10 h-10 rounded-full object-cover" />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-gold flex items-center justify-center text-dark font-bold">
                            {getInitials(person.name)}
                          </div>
                        )}
                        <Link to={`/people/${person.id}`} className="font-bold text-text-primary hover:text-gold transition-colors">
                          {person.name}
                        </Link>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-text-muted">
                      {person.nationality || '—'}
                    </td>
                    <td className="px-6 py-4 text-text-primary">
                      {person.credits?.[0]?.count || 0}
                    </td>
                    <td className="px-6 py-4 text-text-primary">
                      {formatNumber(person.popularity_score)}
                    </td>
                    <td className="px-6 py-4">
                      {person.is_verified ? (
                        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-gold/20 text-gold" title="Verified">
                          ✓
                        </span>
                      ) : (
                        <span className="text-text-muted">—</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => handleToggleVerify(person)}
                          className="p-2 text-text-muted hover:text-gold hover:bg-surface rounded-lg transition-colors"
                          title={person.is_verified ? "Remove Verification" : "Verify Profile"}
                        >
                          ✓
                        </button>
                        <button
                          onClick={() => openEditDrawer(person)}
                          className="p-2 text-text-muted hover:text-blue-400 hover:bg-surface rounded-lg transition-colors"
                          title="Edit"
                        >
                          ✏️
                        </button>
                        <button
                          onClick={() => setDeletingPerson(person)}
                          className="p-2 text-text-muted hover:text-red-400 hover:bg-surface rounded-lg transition-colors"
                          title="Delete"
                        >
                          🗑️
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

      {/* Add/Edit Drawer */}
      <Drawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        title={editingPerson ? "Edit Person" : "Add Person"}
      >
        <form onSubmit={handleSave} className="space-y-6">
          <div className="flex items-center justify-between border-b border-gold/10 pb-4">
            <h3 className="text-xs font-black text-gold uppercase tracking-[0.2em]">Personal Information</h3>
            {editingPerson && formData.tmdb_id && (
              <button
                type="button"
                onClick={() => refreshFromTmdb(formData.tmdb_id)}
                disabled={isRefreshing}
                className="text-[10px] font-black bg-blue-500/10 text-blue-400 border border-blue-500/20 px-3 py-1 rounded-full hover:bg-blue-500/20 transition-all flex items-center gap-1.5"
              >
                {isRefreshing ? 'REFRESHING...' : '✨ REFRESH FROM TMDB'}
              </button>
            )}
          </div>

          {/* Photo Preview */}
          <div className="flex flex-col items-center gap-4">
            {formData.photo_url ? (
              <img src={formData.photo_url} alt="Preview" className="w-20 h-20 rounded-full object-cover border-2 border-border" />
            ) : (
              <div className="w-20 h-20 rounded-full bg-gold flex items-center justify-center text-dark font-bold text-2xl">
                {formData.name ? getInitials(formData.name) : '?'}
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-text-muted mb-1">Full Name *</label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full bg-bg border border-border text-text-primary rounded-xl px-4 py-2 text-sm focus:border-gold focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-text-muted mb-1">Photo URL</label>
            <input
              type="url"
              value={formData.photo_url}
              onChange={(e) => setFormData({ ...formData, photo_url: e.target.value })}
              className="w-full bg-bg border border-border text-text-primary rounded-xl px-4 py-2 text-sm focus:border-gold focus:outline-none"
              placeholder="https://..."
            />
          </div>

          <div>
            <div className="flex justify-between mb-1">
              <label className="block text-sm font-medium text-text-muted">Bio</label>
              <span className={`text-xs ${formData.bio.length > 500 ? 'text-red-400' : 'text-text-muted'}`}>
                {formData.bio.length}/500
              </span>
            </div>
            <textarea
              value={formData.bio}
              onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
              maxLength={500}
              rows={4}
              className="w-full bg-bg border border-border text-text-primary rounded-xl px-4 py-2 text-sm focus:border-gold focus:outline-none resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-text-muted mb-1">Date of Birth</label>
              <input
                type="date"
                value={formData.date_of_birth}
                onChange={(e) => setFormData({ ...formData, date_of_birth: e.target.value })}
                className="w-full bg-bg border border-border text-text-primary rounded-xl px-4 py-2 text-sm focus:border-gold focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-text-muted mb-1">Gender</label>
              <select
                value={formData.gender}
                onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                className="w-full bg-bg border border-border text-text-primary rounded-xl px-4 py-2 text-sm focus:border-gold focus:outline-none"
              >
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Non-binary">Non-binary</option>
                <option value="Prefer not to say">Prefer not to say</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-text-muted mb-1">Nationality</label>
            <input
              type="text"
              value={formData.nationality}
              onChange={(e) => setFormData({ ...formData, nationality: e.target.value })}
              className="w-full bg-bg border border-border text-text-primary rounded-xl px-4 py-2 text-sm focus:border-gold focus:outline-none"
            />
          </div>

          <div className="space-y-3 p-4 rounded-2xl border border-border bg-surface-2/80">
            <div>
              <h3 className="text-xs font-black text-gold uppercase tracking-[0.2em] mb-1">YouTube channel</h3>
              <p className="text-[11px] text-text-muted leading-relaxed mb-3">
                Link this person’s official channel. Paste a full URL, <span className="text-text-primary/90">@handle</span>, or a{' '}
                <span className="font-mono text-[10px]">UC…</span> channel ID. Saves to the database; “Fetch stats” uses your YouTube API key to pull subscribers and artwork.
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-text-muted mb-1">Channel URL, @handle, or ID</label>
              <input
                type="text"
                value={youtubeChannelInput}
                onChange={(e) => setYoutubeChannelInput(e.target.value)}
                placeholder="https://www.youtube.com/@… or youtube.com/channel/UC…"
                className="w-full bg-bg border border-border text-text-primary rounded-xl px-4 py-2 text-sm focus:border-gold focus:outline-none font-mono text-[13px]"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleFetchYoutube}
                className="text-xs font-bold px-4 py-2 rounded-xl bg-[#FF0000]/15 text-[#ff4444] border border-[#FF0000]/25 hover:bg-[#FF0000]/25 transition-colors"
              >
                Fetch channel stats
              </button>
              {getPersonYoutubeChannelUrl({
                youtube_channel_id: formData.youtube_channel_id,
                youtube_handle: formData.youtube_handle
              }) && (
                <a
                  href={
                    getPersonYoutubeChannelUrl({
                      youtube_channel_id: formData.youtube_channel_id,
                      youtube_handle: formData.youtube_handle
                    })
                  }
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs font-bold px-4 py-2 rounded-xl border border-border text-text-muted hover:text-gold hover:border-gold/40 transition-colors inline-flex items-center gap-1"
                >
                  Open in YouTube ↗
                </a>
              )}
            </div>
            {(formData.youtube_stats?.subscribers || formData.youtube_stats?.videos) && (
              <p className="text-xs text-text-muted">
                <span className="text-text-primary font-semibold">
                  {formData.youtube_stats?.subscribers != null &&
                    `${Number(formData.youtube_stats.subscribers).toLocaleString()} subscribers`}
                </span>
                {formData.youtube_stats?.videos != null && (
                  <span className="ml-2">· {Number(formData.youtube_stats.videos).toLocaleString()} videos</span>
                )}
              </p>
            )}
          </div>

          <div className="flex flex-col gap-4 bg-surface-2 p-4 rounded-2xl border border-border">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-text-primary">Verified Profile</p>
                <p className="text-xs text-text-muted italic">Show gold verification badge</p>
              </div>
              <button
                type="button"
                onClick={() => setFormData({ ...formData, is_verified: !formData.is_verified })}
                className={`relative w-12 h-6 rounded-full transition-colors ${
                  formData.is_verified ? 'bg-gold' : 'bg-surface'
                }`}
              >
                <span className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${
                  formData.is_verified ? 'translate-x-7' : 'translate-x-1'
                }`} />
              </button>
            </div>

            <div className="pt-4 border-t border-border/50 flex items-center justify-between">
              <div>
                <p className="text-sm font-extrabold text-gold uppercase tracking-tight">Spotlight Filmmaker</p>
                <p className="text-xs text-text-muted italic">Feature on homepage spotlight</p>
              </div>
              <button
                type="button"
                onClick={() => setFormData({ ...formData, is_spotlight: !formData.is_spotlight })}
                className={`relative w-12 h-6 rounded-full transition-colors ${
                  formData.is_spotlight ? 'bg-gold' : 'bg-surface'
                }`}
              >
                <span className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${
                  formData.is_spotlight ? 'translate-x-7' : 'translate-x-1'
                }`} />
              </button>
            </div>
          </div>

          {/* Filmography Section */}
          {editingPerson && (
            <div className="space-y-4 pt-4 border-t border-border">
              <h3 className="text-sm font-bold text-text-primary uppercase tracking-wider">Filmography</h3>
              {personCredits.length === 0 ? (
                <p className="text-xs text-text-muted italic">No credits found for this person.</p>
              ) : (
                <div className="space-y-2">
                  {personCredits.map((credit) => (
                    <div key={credit.id} className="flex items-center gap-3 bg-surface p-2 rounded-xl border border-border group/credit">
                      <img 
                        src={credit.films?.poster_url || 'https://via.placeholder.com/40x60?text=No+Poster'} 
                        alt="" 
                        className="w-10 h-14 rounded object-cover bg-surface-2" 
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-text-primary truncate">
                          {credit.films?.title} <span className="text-text-muted font-normal">({credit.films?.year})</span>
                        </p>
                        <p className="text-[10px] text-text-muted uppercase font-black tracking-tighter">
                          {credit.role} {credit.character_name && `as ${credit.character_name}`}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveCredit(credit.id)}
                        className="p-2 text-text-muted hover:text-red-500 opacity-0 group-hover/credit:opacity-100 transition-all"
                        title="Remove Credit"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <p className="text-[10px] text-text-muted italic">
                * To add credits, use the Film Library tab.
              </p>
            </div>
          )}

          <div className="pt-4 flex flex-col gap-3">
            <button
              type="submit"
              disabled={isSaving || formData.bio.length > 500}
              className="w-full bg-gold text-dark font-semibold py-3 rounded-xl hover:bg-gold/90 transition-colors disabled:opacity-50"
            >
              {isSaving ? 'Saving...' : 'Save'}
            </button>
            <button
              type="button"
              onClick={() => setIsDrawerOpen(false)}
              className="w-full text-text-muted hover:text-text-primary font-medium py-2 transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      </Drawer>

      {/* Delete Confirmation Modal */}
      {deletingPerson && (
        <ConfirmModal
          title="Delete Person"
          message={`Are you sure you want to delete ${deletingPerson.name}? This will also remove all their credits.`}
          confirmLabel="Delete"
          confirmColor="bg-red-500 hover:bg-red-600"
          onConfirm={handleDelete}
          onCancel={() => setDeletingPerson(null)}
        />
      )}

      {personBatchDeleteIds && (
        <ConfirmModal
          title="Delete people"
          message={`Delete ${personBatchDeleteIds.length} ${personBatchDeleteIds.length === 1 ? 'person' : 'people'}? Their credits will be removed if your database allows it (e.g. cascade).`}
          confirmLabel="Delete selected"
          confirmColor="bg-red-500 hover:bg-red-600"
          onConfirm={handleConfirmBatchDeletePeople}
          onCancel={() => !isBatchDeletingPeople && setPersonBatchDeleteIds(null)}
          isProcessing={isBatchDeletingPeople}
        />
      )}
    </div>
  );
}
