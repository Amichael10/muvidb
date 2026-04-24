import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Link } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import Drawer from '../../components/admin/Drawer';
import ConfirmModal from '../../components/admin/ConfirmModal';
import SkeletonRow from '../../components/admin/SkeletonRow';
import { extractChannelIdentifier, fetchChannelData, getPersonYoutubeChannelUrl } from '../../lib/youtube';
import MergeModal from '../../components/admin/MergeModal';
import { Icon } from '@iconify/react';

export default function AdminPeople() {
  const [people, setPeople] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const pageSize = 25;
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
  const [isMergeModalOpen, setIsMergeModalOpen] = useState(false);
  const [isMerging, setIsMerging] = useState(false);

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
  const [youtubeChannelInput, setYoutubeChannelInput] = useState('');

  // Server-Side Fetching
  const fetchPeople = async () => {
    setIsLoading(true);
    try {
      // 1. Get exact total count for the current filters
      let countQuery = supabase
        .from('people')
        .select('*', { count: 'exact', head: true });

      if (search.trim()) {
        countQuery = countQuery.ilike('name', `%${search}%`);
      }
      if (verifiedFilter !== 'all') {
        countQuery = countQuery.eq('is_verified', verifiedFilter === 'verified');
      }

      const { count } = await countQuery;
      setTotalCount(count || 0);

      // 2. Fetch the current page of data
      let query = supabase
        .from('people')
        .select('*');

      // 1. Server-side Search
      if (search.trim()) {
        query = query.ilike('name', `%${search.trim()}%`);
      }

      // 2. Server-side Verification Filter
      if (verifiedFilter === 'Verified') {
        query = query.eq('is_verified', true);
      } else if (verifiedFilter === 'Unverified') {
        query = query.eq('is_verified', false);
      }

      // 3. Server-side Sorting
      const sortConfigs = {
        'Most Popular': { column: 'popularity_score', ascending: false },
        'A-Z': { column: 'name', ascending: true },
        'Newest': { column: 'created_at', ascending: false }
      };
      
      const config = sortConfigs[sortBy] || sortConfigs['Most Popular'];
      query = query.order(config.column, { ascending: config.ascending });
      
      // Limit to 100 for better performance, but ensure search works across whole DB
      query = query.limit(search ? 100 : 50);

      // Pagination
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;
      query = query.range(from, to);

      const { data, error } = await query;
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
    setPage(1);
    setSelectedPersonIds([]);
  }, [search, verifiedFilter, sortBy]);

  useEffect(() => {
    // Debounced search to avoid spamming the DB
    const timer = setTimeout(() => {
      fetchPeople();
    }, search ? 400 : 0);

    return () => clearTimeout(timer);
  }, [page, search, verifiedFilter, sortBy]);

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

  const handleSave = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      let youtube_channel_id = formData.youtube_channel_id;
      let youtube_handle = formData.youtube_handle;
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
      }

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

  const togglePersonSelect = (id) => {
    setSelectedPersonIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const toggleSelectAllFilteredPeople = () => {
    if (people.length > 0 && people.every(p => selectedPersonIds.includes(p.id))) {
      setSelectedPersonIds([]);
    } else {
      setSelectedPersonIds(people.map(p => p.id));
    }
  };

  const handleMergePeople = async (primaryId, secondaryIds) => {
    setIsMerging(true);
    const t = toast.loading('Merging records...');
    try {
      for (const secId of secondaryIds) {
        const { error } = await supabase.rpc('merge_people', { 
          primary_id: primaryId, 
          secondary_id: secId 
        });
        if (error) throw error;
      }
      toast.success('Merge successful', { id: t });
      setIsMergeModalOpen(false);
      setSelectedPersonIds([]);
      fetchPeople();
    } catch (error) {
      console.error('Merge error:', error);
      toast.error(`Merge failed: ${error.message}`, { id: t });
    } finally {
      setIsMerging(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <p className="text-brand text-xs font-bold mb-1">Database</p>
          <h1 className="text-3xl font-bold text-text-primary tracking-tight">People</h1>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={handleRecalculateScores} disabled={isRecalculating} className="bg-surface-2 border border-border px-4 py-2 rounded-lg text-xs font-bold text-text-primary hover:bg-surface-3 transition-colors">
            {isRecalculating ? 'Updating...' : 'Synchronize popularity'}
          </button>
          <button onClick={openAddDrawer} className="bg-brand text-white font-black px-6 py-2.5 rounded-xl text-xs hover:scale-[1.05] active:scale-[0.95] transition-all flex items-center gap-2 shadow-lg shadow-brand/20">
            <Icon icon="solar:plus-linear" className="text-lg" />
            Add New Actor
          </button>
        </div>
      </div>

      <div className="card-cal p-5">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="md:col-span-2 relative">
            <input
              type="text"
              placeholder="Search records..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-surface-2 border border-border rounded-md px-4 py-2 text-sm text-text-primary outline-none focus:border-brand transition-colors"
            />
          </div>
          <select value={verifiedFilter} onChange={(e) => setVerifiedFilter(e.target.value)} className="bg-surface-2 border border-border rounded-md px-4 py-2 text-sm text-text-primary cursor-pointer">
            <option value="All">All statuses</option>
            <option value="Verified">Verified</option>
            <option value="Unverified">Unverified</option>
          </select>
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="bg-surface-2 border border-border rounded-md px-4 py-2 text-sm text-text-primary cursor-pointer">
            <option value="Most Popular">Popularity</option>
            <option value="A-Z">Alphabetical</option>
            <option value="Newest">Recently added</option>
          </select>
        </div>
      </div>

      {selectedPersonIds.length > 0 && (
        <div className="flex items-center justify-between p-4 bg-brand/5 border border-brand/20 rounded-lg animate-in slide-in-from-top-2">
          <span className="text-sm font-bold text-brand">{selectedPersonIds.length} profiles selected</span>
          <div className="flex gap-2">
            {selectedPersonIds.length >= 2 && (
              <button onClick={() => setIsMergeModalOpen(true)} className="bg-brand text-white px-4 py-1.5 rounded text-xs font-bold hover:scale-[1.02] transition-all">Merge</button>
            )}
            <button onClick={() => setPersonBatchDeleteIds([...selectedPersonIds])} className="bg-red-500 text-white px-4 py-1.5 rounded text-xs font-bold hover:bg-red-600 transition-colors">Delete</button>
          </div>
        </div>
      )}

      <div className="card-cal p-0 overflow-hidden">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-border text-[10px] font-bold text-text-muted bg-surface-2/30 uppercase tracking-wider">
              <th className="px-6 py-5 w-12"><input type="checkbox" onChange={toggleSelectAllFilteredPeople} checked={people.length > 0 && people.every(p => selectedPersonIds.includes(p.id))} className="rounded border-border bg-surface-3 text-brand focus:ring-brand accent-brand" /></th>
              <th className="px-6 py-5">Profile</th>
              <th className="px-6 py-5">Statistics</th>
              <th className="px-6 py-5 text-center">Status</th>
              <th className="px-6 py-5 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {isLoading ? Array(5).fill(0).map((_, i) => (
              <tr key={i}>
                <td colSpan="5">
                  <SkeletonRow />
                </td>
              </tr>
            )) : people.length === 0 ? (
              <tr><td colSpan="5" className="px-6 py-10 text-center text-text-muted">No records found.</td></tr>
            ) : people.map(p => (
              <tr key={p.id} className={`group hover:bg-surface-2/50 transition-colors ${selectedPersonIds.includes(p.id) ? 'bg-brand/5' : ''}`}>
                <td className="px-6 py-4"><input type="checkbox" checked={selectedPersonIds.includes(p.id)} onChange={() => togglePersonSelect(p.id)} className="rounded border-border bg-surface-3 text-brand focus:ring-brand accent-brand" /></td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    {p.photo_url ? <img src={p.photo_url} className="w-10 h-10 rounded object-cover shadow-sm grayscale group-hover:grayscale-0 transition-all" /> : <div className="w-10 h-10 rounded bg-surface-2 flex items-center justify-center text-[10px] font-bold text-text-muted">?</div>}
                    <div>
                      <span className="font-bold text-text-primary block leading-tight">{p.name}</span>
                      <span className="text-[10px] text-text-muted font-mono">{p.id.slice(0, 8)}</span>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="flex gap-4 text-xs font-bold text-text-primary">
                    <span title="Total Credits">🎬 {p.credits?.[0]?.count || 0}</span>
                    <span title="Popularity Score">👁 {formatNumber(p.popularity_score)}</span>
                  </div>
                </td>
                <td className="px-6 py-4 text-center">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-lg border ${p.is_verified ? 'bg-brand/10 text-brand border-brand/20' : 'bg-surface-2 text-text-muted border-border'}`}>
                    {p.is_verified ? 'Verified' : 'Member'}
                  </span>
                </td>
                <td className="px-6 py-4 text-right">
                  <div className="flex justify-end gap-2">
                    <button onClick={() => openEditDrawer(p)} className="p-2 bg-surface-2 rounded-lg hover:bg-brand hover:text-white transition-all">✎</button>
                    <button onClick={() => setDeletingPerson(p)} className="p-2 bg-surface-2 text-red-500 rounded-lg hover:bg-red-500 hover:text-white transition-all">✖</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Drawer isOpen={isDrawerOpen} onClose={() => setIsDrawerOpen(false)} title={editingPerson ? 'Edit Record' : 'Add New Record'}>
        <form onSubmit={handleSave} className="p-8 space-y-10">
          <section className="space-y-6">
            <div className="flex items-center gap-2 pb-2 border-b border-border">
              <span className="text-xl">👤</span>
              <h4 className="text-xs font-bold text-text-muted">Personal Details</h4>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-text-primary mb-2">Full Name</label>
                <input 
                  required 
                  value={formData.name} 
                  onChange={e => setFormData({...formData, name: e.target.value})} 
                  className="w-full bg-surface-2 border border-border p-3 rounded-lg text-sm focus:border-brand outline-none transition-colors" 
                  placeholder="e.g. Funke Akindele" 
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-text-primary mb-2">Gender</label>
                  <select 
                    value={formData.gender} 
                    onChange={e => setFormData({...formData, gender: e.target.value})} 
                    className="w-full bg-surface-2 border border-border p-3 rounded-lg text-sm focus:border-brand outline-none appearance-none cursor-pointer"
                  >
                    <option>Female</option>
                    <option>Male</option>
                    <option>Non-binary</option>
                    <option>Prefer not to say</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-text-primary mb-2">Nationality</label>
                  <input 
                    value={formData.nationality} 
                    onChange={e => setFormData({...formData, nationality: e.target.value})} 
                    className="w-full bg-surface-2 border border-border p-3 rounded-lg text-sm focus:border-brand outline-none" 
                    placeholder="e.g. Nigerian" 
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-text-primary mb-2">Date of Birth</label>
                <input 
                  type="date" 
                  value={formData.date_of_birth} 
                  onChange={e => setFormData({...formData, date_of_birth: e.target.value})} 
                  className="w-full bg-surface-2 border border-border p-3 rounded-lg text-sm focus:border-brand outline-none" 
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-text-primary mb-2">Photo URL</label>
                <input 
                  value={formData.photo_url} 
                  onChange={e => setFormData({...formData, photo_url: e.target.value})} 
                  className="w-full bg-surface-2 border border-border p-3 rounded-lg text-sm focus:border-brand outline-none" 
                  placeholder="https://..." 
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-text-primary mb-2">Biography</label>
                <textarea 
                  value={formData.bio} 
                  onChange={e => setFormData({...formData, bio: e.target.value})} 
                  className="w-full bg-surface-2 border border-border p-3 rounded-lg text-sm focus:border-brand outline-none h-32 resize-none leading-relaxed custom-scrollbar" 
                  placeholder="Professional biography..." 
                />
              </div>
            </div>
          </section>

          <section className="space-y-6">
            <div className="flex items-center justify-between pb-2 border-b border-border">
              <div className="flex items-center gap-2">
                <span className="text-xl">📺</span>
                <h4 className="text-xs font-bold text-text-muted">YouTube Data</h4>
              </div>
              <button
                type="button"
                onClick={handleFetchYoutube}
                className="text-[10px] font-bold text-brand bg-brand/5 border border-brand/20 px-3 py-1 rounded-full hover:bg-brand/10 transition-all flex items-center gap-1.5"
              >
                Refresh Stats
              </button>
            </div>
            <div className="p-4 bg-surface-2 border border-border rounded-lg space-y-4">
              <div>
                <label className="block text-xs font-bold text-text-muted mb-1.5">Channel URL or ID</label>
                <input 
                  value={youtubeChannelInput} 
                  onChange={e => setYoutubeChannelInput(e.target.value)} 
                  className="w-full bg-surface border border-border p-3 rounded-lg text-xs focus:border-brand outline-none" 
                  placeholder="https://youtube.com/@handle" 
                />
              </div>
              {formData.youtube_stats && (
                <div className="grid grid-cols-2 gap-4 pt-2">
                  <div className="bg-surface p-3 rounded-lg border border-border/50 text-center">
                    <div className="text-xs font-bold text-text-primary">{(formData.youtube_stats.subscribers || 0).toLocaleString()}</div>
                    <div className="text-[9px] font-bold text-text-muted">Subscribers</div>
                  </div>
                  <div className="bg-surface p-3 rounded-lg border border-border/50 text-center">
                    <div className="text-xs font-bold text-text-primary">{(formData.youtube_stats.videos || 0).toLocaleString()}</div>
                    <div className="text-[9px] font-bold text-text-muted">Videos</div>
                  </div>
                </div>
              )}
            </div>
          </section>

          {editingPerson && personCredits.length > 0 && (
            <section className="space-y-6">
              <div className="flex items-center gap-2 pb-2 border-b border-border">
                <span className="text-xl">🎞️</span>
                <h4 className="text-xs font-bold text-text-muted">Credits</h4>
              </div>
              <div className="space-y-3">
                {personCredits.map(credit => (
                  <div key={credit.id} className="flex items-center gap-4 p-3 bg-surface-2 border border-border rounded-lg group hover:border-brand/30 transition-all">
                    <div className="w-10 h-14 bg-surface rounded border border-border overflow-hidden flex-shrink-0">
                      {credit.films?.poster_url ? (
                        <img src={credit.films.poster_url} className="w-full h-full object-cover" alt="" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-[8px] bg-surface-3 text-text-muted">NO POSTER</div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-bold text-text-primary truncate">{credit.films?.title}</div>
                      <div className="text-[10px] text-text-muted mt-0.5 font-medium">
                        <span className="capitalize">{credit.role}</span>
                        {credit.character_name && ` as ${credit.character_name}`}
                        {credit.films?.year && ` (${credit.films.year})`}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          <section className="space-y-6">
            <div className="flex items-center gap-2 pb-2 border-b border-border">
              <span className="text-xl">⚙️</span>
              <h4 className="text-xs font-bold text-text-muted">Settings</h4>
            </div>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-text-primary mb-2">TMDB ID</label>
                  <input 
                    value={formData.tmdb_id || ''} 
                    onChange={e => setFormData({...formData, tmdb_id: e.target.value})} 
                    className="w-full bg-surface-2 border border-border p-3 rounded-lg text-sm focus:border-brand outline-none" 
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-text-primary mb-2">Popularity Score</label>
                  <input 
                    type="number" 
                    value={formData.popularity_score} 
                    onChange={e => setFormData({...formData, popularity_score: e.target.value})} 
                    className="w-full bg-surface-2 border border-border p-3 rounded-lg text-sm focus:border-brand outline-none" 
                  />
                </div>
              </div>
              
              <div className="flex items-center justify-between p-4 bg-surface-2 border border-border rounded-lg hover:border-brand/20 transition-all">
                <div>
                  <h4 className="text-sm font-bold text-text-primary">Verified Profile</h4>
                  <p className="text-[10px] text-text-muted font-bold">Display verification badge.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, is_verified: !formData.is_verified })}
                  className={`relative w-10 h-5 rounded-full transition-colors duration-200 ${
                    formData.is_verified ? 'bg-brand shadow-lg shadow-brand/20' : 'bg-border'
                  }`}
                >
                  <div className={`absolute top-1 left-1 w-3 h-3 rounded-full bg-white transition-transform duration-200 ${
                    formData.is_verified ? 'translate-x-5' : 'translate-x-0'
                  }`} />
                </button>
              </div>

              <div className="flex items-center justify-between p-4 bg-surface-2 border border-border rounded-lg hover:border-brand/20 transition-all">
                <div>
                  <h4 className="text-sm font-bold text-text-primary">Spotlight</h4>
                  <p className="text-[10px] text-text-muted font-bold">Feature on landing page.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, is_spotlight: !formData.is_spotlight })}
                  className={`relative w-10 h-5 rounded-full transition-colors duration-200 ${
                    formData.is_spotlight ? 'bg-brand shadow-lg shadow-brand/20' : 'bg-border'
                  }`}
                >
                  <div className={`absolute top-1 left-1 w-3 h-3 rounded-full bg-white transition-transform duration-200 ${
                    formData.is_spotlight ? 'translate-x-5' : 'translate-x-0'
                  }`} />
                </button>
              </div>
            </div>
          </section>

          <div className="sticky bottom-0 bg-surface pt-4 pb-2 border-t border-border">
            <button 
              type="submit" 
              disabled={isSaving} 
              className="w-full bg-brand text-white p-4 rounded-xl font-bold hover:scale-[1.02] active:scale-[0.98] transition-all shadow-xl shadow-brand/20 disabled:opacity-50"
            >
              {isSaving ? 'Saving...' : editingPerson ? 'Update' : 'Add Profile'}
            </button>
          </div>
        </form>
      </Drawer>
    </div>
  );
}
