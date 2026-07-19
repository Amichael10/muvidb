import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Link, useSearchParams } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import Drawer from '../../components/admin/Drawer';
import ConfirmModal from '../../components/admin/ConfirmModal';
import SkeletonRow from '../../components/admin/SkeletonRow';
import { extractChannelIdentifier, fetchChannelData, getPersonYoutubeChannelUrl } from '../../lib/youtube';
import MergeModal from '../../components/admin/MergeModal';
import ImageField from '../../components/admin/ImageField';
import AddCreditModal from '../../components/admin/AddCreditModal';
import AwardsEditor from '../../components/admin/AwardsEditor';
import { formatRole } from '../../lib/creditRoles';
import { Icon } from '@iconify/react';
import { useAuth } from '../../context/AuthContext';
import { logAdminAction } from '../../lib/adminLogger';
import { toTitleCase, toSentenceCase, formatPersonName } from '../../utils/format';
import { useLocalStorageDraft } from '../../hooks/useLocalStorageDraft';
import { useMemo } from 'react';
import { getFriendlyErrorMessage } from '../../utils/errors';
import { ErrorBoundary } from '../../components/ErrorBoundary';

export default function AdminPeople() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const [people, setPeople] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const pageSize = 25;
  const initialSearch = searchParams.get('search') || '';
  const [search, setSearch] = useState(initialSearch);
  const [debouncedSearch, setDebouncedSearch] = useState(initialSearch);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
    }, search ? 400 : 0);
    return () => clearTimeout(timer);
  }, [search]);

  const [verifiedFilter, setVerifiedFilter] = useState('All'); 
  const [spotlightFilter, setSpotlightFilter] = useState('All'); 
  const [profileStatus, setProfileStatus] = useState('All'); 
  const [sortBy, setSortBy] = useState('Recently Added'); 

  // Modals/Drawers state
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [editingPerson, setEditingPerson] = useState(null);
  const [deletingPerson, setDeletingPerson] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [selectedPersonIds, setSelectedPersonIds] = useState([]);
  const [personBatchDeleteIds, setPersonBatchDeleteIds] = useState(null);
  const [isBatchDeletingPeople, setIsBatchDeletingPeople] = useState(false);
  const [personCredits, setPersonCredits] = useState([]);
  const [showAddCredit, setShowAddCredit] = useState(false);

  // Shared by the drawer's initial load and the add-credit modal's save.
  const refetchCredits = async (personId) => {
    const { data } = await supabase
      .from('credits')
      .select(`
        id, role, character_name, billing_order,
        films(id, title, year, poster_url)
      `)
      .eq('person_id', personId)
      .order('billing_order');

    setPersonCredits(data || []);
  };
  const [youtubeFilmography, setYoutubeFilmography] = useState([]);
  const [isMergeModalOpen, setIsMergeModalOpen] = useState(false);
  const [isMerging, setIsMerging] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    biography: '',
    photo_url: '',
    date_of_birth: '',
    gender: 'Prefer not to say',
    nationality: 'Nigerian',
    is_verified: false,
    is_spotlight: false,
    popularity_score: 0,
    known_for_department: 'Actor', // Actor, Skit Maker, Producer, etc.
    youtube_channel_id: '',
    youtube_handle: '',
    youtube_stats: { subscribers: '0', videos: '0', thumbnail: null, banner: null },
    instagram_url: '',
    facebook_url: '',
    twitter_url: '',
    awards: [] // [{ organization, year, season, category, work, film_id, won }]
  });

  const [isSaving, setIsSaving] = useState(false);
  const [isRecalculating, setIsRecalculating] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [youtubeChannelInput, setYoutubeChannelInput] = useState('');

  const draftKey = isDrawerOpen ? (editingPerson ? `MuviDB_draft_person_${editingPerson.id}` : 'MuviDB_draft_person_new') : null;
  const draftData = useMemo(() => ({ ...formData, youtube_channel_id: youtubeChannelInput || formData.youtube_channel_id || formData.youtube_handle }), [formData, youtubeChannelInput]);
  const { clearDraft } = useLocalStorageDraft(draftKey, draftData, isDrawerOpen);
  const [draftRestoredMessage, setDraftRestoredMessage] = useState('');

  // Server-Side Fetching
  const fetchPeople = async () => {
    setIsLoading(true);
    try {
      // 1. Get exact total count for the current filters
      let countQuery = supabase
        .from('people')
        .select('*', { count: 'exact', head: true });

      if (debouncedSearch.trim()) {
        countQuery = countQuery.ilike('name', `%${debouncedSearch}%`);
      }
      if (profileStatus === 'Incomplete') {
        // OR logic for incomplete profiles (missing bio OR missing photo)
        countQuery = countQuery.or('bio.is.null,photo_url.is.null,bio.eq.,photo_url.eq.');
      } else if (profileStatus === 'Complete') {
        // Implicit AND logic for complete profiles (must have both bio AND photo)
        countQuery = countQuery
          .not('bio', 'is', null)
          .not('photo_url', 'is', null)
          .neq('bio', '')
          .neq('photo_url', '');
      }

      const { count, error: countError } = await countQuery;
      if (countError) throw countError;
      setTotalCount(count || 0);

      // 2. Fetch data using RPC
      const sortConfigs = {
        'Most Popular': { col: 'popularity_score', asc: false },
        'Recently Added': { col: 'created_at', asc: false },
        'Newest': { col: 'created_at', asc: false },
        'A-Z': { col: 'name', asc: true },
        'Z-A': { col: 'name', asc: false },
        'Oldest': { col: 'created_at', asc: true }
      };
      
      const sort = sortConfigs[sortBy] || sortConfigs['Most Popular'];
      
      const { data, error } = await supabase.rpc('get_people_with_counts', {
        p_search: debouncedSearch,
        p_verified: verifiedFilter.toLowerCase(),
        p_spotlight: spotlightFilter.toLowerCase(),
        p_sort_col: sort.col,
        p_sort_asc: sort.asc,
        p_offset: (page - 1) * pageSize,
        p_limit: pageSize,
        p_status: profileStatus.toLowerCase()
      });

      if (error) throw error;
      setPeople(data || []);
    } catch (error) {
      console.error('Error fetching people:', error);
      // Fixed id so a flurry of failed searches/filters shows ONE snackbar, not a stack.
      toast.error(getFriendlyErrorMessage(error), { id: 'admin-people-fetch' });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    setPage(1);
    setSelectedPersonIds([]);
  }, [debouncedSearch, verifiedFilter, spotlightFilter, profileStatus, sortBy]);

  useEffect(() => {
    fetchPeople();
  }, [page, debouncedSearch, sortBy, profileStatus, spotlightFilter, verifiedFilter]);

  const handleToggleVerify = async (person) => {
    try {
      const newStatus = !person.is_verified;
      const { error } = await supabase
        .from('people')
        .update({ is_verified: newStatus })
        .eq('id', person.id);

      if (error) throw error;
      
      await logAdminAction(user, 'update', 'person', person.id, person.name, { is_verified: newStatus, field: 'verified' });
      
      setPeople(people.map(p => p.id === person.id ? { ...p, is_verified: newStatus } : p));
      toast.success(newStatus ? 'Profile verified ✓' : 'Verification removed');
    } catch (error) {
      console.error('Error toggling verification:', error);
      toast.error(getFriendlyErrorMessage(error));
    }
  };

  const handleToggleSpotlight = async (person) => {
    try {
      const newStatus = !person.is_spotlight;
      const { error } = await supabase
        .from('people')
        .update({ is_spotlight: newStatus })
        .eq('id', person.id);

      if (error) throw error;
      
      await logAdminAction(user, 'update', 'person', person.id, person.name, { is_spotlight: newStatus, field: 'spotlight' });
      
      setPeople(people.map(p => p.id === person.id ? { ...p, is_spotlight: newStatus } : p));
      toast.success(newStatus ? 'Added to Spotlight ★' : 'Removed from Spotlight');
    } catch (error) {
      console.error('Error toggling spotlight:', error);
      toast.error(getFriendlyErrorMessage(error));
    }
  };

  const handleDelete = async () => {
    if (!deletingPerson) return;
    setIsDeleting(true);
    try {
      // 1. Delete credits first to avoid FK constraints
      await supabase.from('credits').delete().eq('person_id', deletingPerson.id);
      
      // 2. Unlink any channels owned by this person
      await supabase.from('channels').update({ owner_person_id: null }).eq('owner_person_id', deletingPerson.id);

      // 3. Unlink any user accounts linked to this person
      await supabase.from('users').update({ linked_profile_id: null }).eq('linked_profile_id', deletingPerson.id);

      // 4. Delete from people
      const { error } = await supabase
        .from('people')
        .delete()
        .eq('id', deletingPerson.id);

      if (error) throw error;

      await logAdminAction(user, 'delete', 'person', deletingPerson.id, deletingPerson.name);

      setPeople(people.filter(p => p.id !== deletingPerson.id));
      setSelectedPersonIds((prev) => prev.filter((id) => id !== deletingPerson.id));
      toast.success('Person deleted successfully');
      setDeletingPerson(null);
    } catch (error) {
      console.error('Error deleting person:', error);
      toast.error(`Deletion Failed: ${getFriendlyErrorMessage(error)}`);
    } finally {
      setIsDeleting(false);
    }
  };

  const openAddDrawer = (ignoreDraft = false) => {
    let draft = null;
    if (!ignoreDraft) {
      try {
        const stored = localStorage.getItem('MuviDB_draft_person_new');
        if (stored) draft = JSON.parse(stored);
      } catch (e) {}
    }
    setDraftRestoredMessage(draft ? 'Unsaved changes restored from draft.' : '');

    setEditingPerson(null);
    setYoutubeChannelInput('');
    setFormData(draft || {
      name: '',
      biography: '',
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
      youtube_stats: { subscribers: '0', videos: '0', thumbnail: null, banner: null },
      instagram_url: '',
      facebook_url: '',
      twitter_url: '',
      awards: []
    });
    setIsDrawerOpen(true);
  };

  const openEditDrawer = async (person, ignoreDraft = false) => {
    let draft = null;
    if (!ignoreDraft) {
      try {
        const stored = localStorage.getItem(`MuviDB_draft_person_${person.id}`);
        if (stored) draft = JSON.parse(stored);
      } catch (e) {}
    }
    setDraftRestoredMessage(draft ? 'Unsaved changes restored from draft.' : '');

    setEditingPerson(person);

    // Fetch full person details since get_people_with_counts omits heavy fields
    const { data: fullPerson } = await supabase
      .from('people')
      .select('*')
      .eq('id', person.id)
      .single();
    
    const p = fullPerson || person;

    const baseForm = {
      name: p.name || '',
      biography: p.biography || p.bio || '',
      photo_url: p.photo_url || '',
      date_of_birth: p.date_of_birth || '',
      gender: p.gender || 'Prefer not to say',
      nationality: p.nationality || 'Nigerian',
      is_verified: p.is_verified || false,
      is_spotlight: p.is_spotlight || false,
      popularity_score: p.popularity_score || 0,
      tmdb_id: p.tmdb_id || '',
      youtube_channel_id: p.youtube_channel_id || '',
      youtube_handle: p.youtube_handle || '',
      youtube_stats: p.youtube_stats || { subscribers: '0', videos: '0', thumbnail: null, banner: null },
      instagram_url: p.instagram_url || '',
      facebook_url: p.facebook_url || '',
      twitter_url: p.twitter_url || '',
      awards: Array.isArray(p.awards) ? p.awards : []
    };
    // Merge over the base rather than replacing it: a draft saved before a field
    // existed on this form has no key for it, and save would then write the
    // empty default over real data (awards would be wiped).
    setFormData(draft ? { ...baseForm, ...draft, awards: Array.isArray(draft.awards) ? draft.awards : baseForm.awards } : baseForm);
    setYoutubeChannelInput(draft?.youtube_channel_id || draft?.youtube_handle || getPersonYoutubeChannelUrl(p) || '');
    
    await refetchCredits(person.id);

    // Fetch qualifying YT videos
    if (person.youtube_channel_id) {
       const minDuration = person.known_for_department === 'Actor' ? 2100 : 900; // 35m or 15m
       const { data: ytVideos } = await supabase
         .from('channel_videos')
         .select('*')
         .eq('channel_id', person.youtube_channel_id)
         .gte('duration_seconds', minDuration)
         .order('published_at', { ascending: false });
       setYoutubeFilmography(ytVideos || []);
    } else {
       setYoutubeFilmography([]);
    }

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
      toast.error(getFriendlyErrorMessage(err), { id: t });
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

      const { biography: _omitBiography, ...restFormData } = formData;
      const dataToSave = {
        ...restFormData,
        name: toTitleCase(formData.name),
        bio: formData.biography ? toSentenceCase(formData.biography) : null,
        date_of_birth: formData.date_of_birth || null,
        photo_url: formData.photo_url || null,
        popularity_score: parseInt(formData.popularity_score) || 0,
        tmdb_id: formData.tmdb_id || null,
        slug: formData.slug || (formData.name ? formData.name.toLowerCase().replace(/[^a-zA-Z0-9\s]/g, '').trim().replace(/\s+/g, '-') : null),
        mubi_slug: formData.mubi_slug || formData.slug || (formData.name ? formData.name.toLowerCase().replace(/[^a-zA-Z0-9\s]/g, '').trim().replace(/\s+/g, '-') : null),
        youtube_channel_id,
        youtube_handle,
        youtube_stats,
        instagram_url: formData.instagram_url?.trim() || null,
        facebook_url: formData.facebook_url?.trim() || null,
        twitter_url: formData.twitter_url?.trim() || null,
        // Awards / nominations (jsonb). Drop blank rows and coerce year/season so
        // the person page's sorting and "N wins & N nominations" tally stay sane.
        awards: (formData.awards || [])
          .filter((a) => (a.organization || '').trim() || (a.category || '').trim())
          .map((a) => ({
            organization: (a.organization || '').trim() || 'AMVCA',
            year: a.year ? parseInt(a.year, 10) : null,
            season: a.season ? parseInt(a.season, 10) : null,
            category: (a.category || '').trim() || null,
            work: (a.work || '').trim() || null,
            film_id: a.film_id || null,
            won: a.won === true,
          }))
      };

      if (editingPerson) {
        const { data: updateData, error } = await supabase
          .from('people')
          .update(dataToSave)
          .eq('id', editingPerson.id)
          .select();
        if (error) throw error;
        if (!updateData || updateData.length === 0) {
          throw new Error('Save failed: No permissions or record not found.');
        }
        await logAdminAction(user, 'update', 'person', editingPerson.id, dataToSave.name);
        toast.success('Profile updated');
      } else {
        const { data, error } = await supabase
          .from('people')
          .insert([dataToSave])
          .select();
        if (error) throw error;
        const newPersonId = data?.[0]?.id;
        await logAdminAction(user, 'create', 'person', newPersonId, dataToSave.name);
        toast.success('Person added');
      }
      clearDraft();
      setIsDrawerOpen(false);
      fetchPeople();
    } catch (error) {
      console.error('Error saving person:', error);
      toast.error(getFriendlyErrorMessage(error));
    } finally {
      setIsSaving(false);
    }
  };

  useEffect(() => {
    if (isDrawerOpen) {
      const handler = setTimeout(() => {
        const key = editingPerson ? `MuviDB_draft_person_${editingPerson.id}` : 'MuviDB_draft_person_new';
        localStorage.setItem(key, JSON.stringify({ ...formData, youtube_channel_id: youtubeChannelInput }));
      }, 1000);
      return () => clearTimeout(handler);
    }
  }, [formData, youtubeChannelInput, isDrawerOpen, editingPerson]);

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
      toast.error(getFriendlyErrorMessage(error));
    } finally {
      setIsRecalculating(false);
    }
  };

  const togglePersonSelect = (id) => {
    setSelectedPersonIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleBatchDelete = async () => {
    if (!personBatchDeleteIds || personBatchDeleteIds.length === 0) return;
    setIsBatchDeletingPeople(true);
    const t = toast.loading(`Deleting ${personBatchDeleteIds.length} profiles...`);
    try {
      await supabase.from('credits').delete().in('person_id', personBatchDeleteIds);
      await supabase.from('channels').update({ owner_person_id: null }).in('owner_person_id', personBatchDeleteIds);
      await supabase.from('users').update({ linked_profile_id: null }).in('linked_profile_id', personBatchDeleteIds);
      const { error } = await supabase.from('people').delete().in('id', personBatchDeleteIds);
      if (error) throw error;
      
      for (const id of personBatchDeleteIds) {
        await logAdminAction(user, 'delete', 'person', id, `Batch deleted person ID: ${id}`);
      }
      
      toast.success(`Deleted ${personBatchDeleteIds.length} profiles`, { id: t });
      setPeople(people.filter(p => !personBatchDeleteIds.includes(p.id)));
      setSelectedPersonIds([]);
      setPersonBatchDeleteIds(null);
    } catch (err) {
      console.error(err);
      toast.error(`Batch delete failed: ${getFriendlyErrorMessage(err)}`, { id: t });
    } finally {
      setIsBatchDeletingPeople(false);
    }
  };


  const toggleSelectAllFilteredPeople = () => {
    if (people.length > 0 && people.every(p => selectedPersonIds.includes(p.id))) {
      setSelectedPersonIds([]);
    } else {
      setSelectedPersonIds(people.map(p => p.id));
    }
  };

  const handleMerge = async (primaryId, secondaryIds, enrichedData = null) => {
    const t = toast.loading('Executing intelligent merge...');
    setIsMerging(true);
    try {
      // 1. Perform relational merge for each secondary
      for (const secId of secondaryIds) {
        const { error } = await supabase.rpc('merge_people', { 
          p_primary_id: primaryId, 
          p_secondary_id: secId,
          p_metadata: enrichedData // Pass metadata directly to the RPC
        });
        if (error) throw error;
      }
      
      await logAdminAction(user, 'update', 'person', primaryId, `Merged secondary ID(s) into person profile`, { secondaryIds });
      
      toast.success('Merge successful: Data enriched & relations moved', { id: t });
      setIsMergeModalOpen(false);
      setSelectedPersonIds([]);
      fetchPeople();
    } catch (error) {
      console.error('Merge error:', error);
      toast.error(`Merge failed: ${getFriendlyErrorMessage(error)}`, { id: t });
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
          <select value={profileStatus} onChange={(e) => setProfileStatus(e.target.value)} className="bg-surface-2 border border-border rounded-md px-4 py-2 text-sm text-text-primary cursor-pointer">
            <option value="All">All Status</option>
            <option value="Incomplete">Incomplete</option>
            <option value="Complete">Complete</option>
          </select>
          <select value={spotlightFilter} onChange={(e) => setSpotlightFilter(e.target.value)} className="bg-surface-2 border border-border rounded-md px-4 py-2 text-sm text-text-primary cursor-pointer">
            <option value="All">Any Spotlight</option>
            <option value="Spotlight">Spotlight Only</option>
            <option value="Regular">Regular Only</option>
          </select>
          <select value={verifiedFilter} onChange={(e) => setVerifiedFilter(e.target.value)} className="bg-surface-2 border border-border rounded-md px-4 py-2 text-sm text-text-primary cursor-pointer">
            <option value="All">Any Verification</option>
            <option value="Verified">Verified Only</option>
            <option value="Member">Members Only</option>
          </select>
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="bg-surface-2 border border-border rounded-md px-4 py-2 text-sm text-text-primary cursor-pointer">
            <option value="Recently Added">Recently Added</option>
            <option value="Most Popular">Most Popular</option>
            <option value="A-Z">Alphabetical (A-Z)</option>
            <option value="Z-A">Alphabetical (Z-A)</option>
            <option value="Oldest">Oldest First</option>
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
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-text-primary block leading-tight">{formatPersonName(p.name)}</span>
                        {p.is_spotlight && (
                          <Icon icon="solar:star-bold" className="w-3 h-3 text-brand" />
                        )}
                      </div>
                      <span className="text-[10px] text-text-muted font-mono">{p.id.slice(0, 8)}</span>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="flex flex-col gap-1 text-xs font-bold">
                    <div className="flex items-center gap-2">
                      <span className="text-brand">🎬</span>
                      <span className="text-text-primary">{p.total_filmography_count || 0}</span>
                      <span className="text-[10px] text-text-muted font-medium">
                        ({p.traditional_credits_count || 0} films + {p.youtube_filmography_count || 0} YT)
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-brand">👁</span>
                      <span className="text-text-primary">{formatNumber(p.popularity_score)}</span>
                      <span className="text-[10px] text-text-muted font-medium uppercase tracking-widest">{p.known_for_department}</span>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 text-center">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-lg border ${p.is_verified ? 'bg-brand/10 text-brand border-brand/20' : 'bg-surface-2 text-text-muted border-border'}`}>
                    {p.is_verified ? 'Verified' : 'Member'}
                  </span>
                </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end gap-2">
                      <button 
                        onClick={() => handleToggleSpotlight(p)} 
                        className={`p-2 rounded-lg transition-all border border-transparent hover:border-border hover:shadow-sm ${p.is_spotlight ? 'bg-brand/10 text-brand' : 'bg-surface-2 text-text-muted hover:text-brand'}`}
                        title={p.is_spotlight ? 'Remove from Spotlight' : 'Add to Spotlight'}
                      >
                        <Icon icon={p.is_spotlight ? "solar:star-bold" : "solar:star-linear"} className="w-4 h-4" />
                      </button>
                      <button onClick={() => openEditDrawer(p)} className="p-2 bg-surface-2 rounded-lg hover:bg-brand hover:text-white transition-all text-sm">✎</button>
                      <button onClick={() => setDeletingPerson(p)} className="p-2 bg-surface-2 text-red-500 rounded-lg hover:bg-red-500 hover:text-white transition-all text-sm">✖</button>
                    </div>
                  </td>
              </tr>
            ))}
          </tbody>
        </table>

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
                    disabled={page === 1 || isLoading}
                    className="px-3 py-2 text-xs font-bold text-text-primary rounded-md hover:bg-surface-2 disabled:opacity-30 disabled:cursor-not-allowed transition-all flex items-center gap-1"
                  >
                    <Icon icon="solar:double-alt-arrow-left-linear" width="16" />
                    First
                  </button>
                  <button
                    onClick={() => setPage(prev => Math.max(1, prev - 1))}
                    disabled={page === 1 || isLoading}
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
                    disabled={page === totalPages || isLoading}
                    className="px-3 py-2 text-xs font-bold text-text-primary rounded-md hover:bg-surface-2 disabled:opacity-30 disabled:cursor-not-allowed transition-all flex items-center gap-1"
                  >
                    Next
                    <Icon icon="solar:alt-arrow-right-linear" width="16" />
                  </button>
                  <button
                    onClick={() => setPage(totalPages)}
                    disabled={page === totalPages || isLoading}
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
        items={people.filter(p => selectedPersonIds.includes(p.id))}
        onConfirm={handleMerge}
        type="person"
      />

      <Drawer isOpen={isDrawerOpen} onClose={() => setIsDrawerOpen(false)} title={editingPerson ? 'Edit Record' : 'Add New Record'}>
        <div className="h-full flex flex-col">
          {draftRestoredMessage && (
            <div className="bg-amber-500/10 border-b border-amber-500/20 px-6 py-3 flex items-center justify-between">
              <div className="flex items-center gap-2 text-amber-500">
                <Icon icon="lucide:history" className="w-4 h-4" />
                <span className="text-sm font-medium">{draftRestoredMessage}</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  clearDraft();
                  setDraftRestoredMessage('');
                  setIsDrawerOpen(false);
                  setTimeout(() => {
                    if (editingPerson) openEditDrawer(editingPerson, true);
                    else openAddDrawer(true);
                  }, 100);
                }}
                className="text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 py-1.5 rounded-lg transition-colors border border-slate-700 hover:border-slate-600"
              >
                Discard Draft
              </button>
            </div>
          )}
        <ErrorBoundary>
        <form onSubmit={handleSave} className="p-8 space-y-10 flex-1 overflow-y-auto">
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
                  onBlur={e => setFormData({...formData, name: toTitleCase(e.target.value)})}
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
                  <label className="block text-xs font-bold text-text-primary mb-2">Primary Role</label>
                  <select 
                    value={formData.known_for_department} 
                    onChange={e => setFormData({...formData, known_for_department: e.target.value})} 
                    className="w-full bg-surface-2 border border-border p-3 rounded-lg text-sm focus:border-brand outline-none appearance-none cursor-pointer"
                  >
                    <option>Actor</option>
                    <option>Skit Maker</option>
                    <option>Producer</option>
                    <option>Director</option>
                    <option>Cinematographer</option>
                    <option>Editor</option>
                    <option>Other</option>
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
                <ImageField
                  label="Profile Image"
                  value={formData.photo_url}
                  onChange={url => setFormData({ ...formData, photo_url: url })}
                  bucket="people"
                  aspect="square"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-text-primary mb-2">Biography</label>
                <textarea 
                  value={formData.biography} 
                  onChange={e => setFormData({...formData, biography: e.target.value})} 
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

          {editingPerson && (
            <section className="space-y-6">
              <div className="flex items-center justify-between pb-2 border-b border-border">
                <div className="flex items-center gap-2">
                  <span className="text-xl">🎞️</span>
                  <h4 className="text-xs font-bold text-text-muted">Film Credits</h4>
                  {personCredits.length > 0 && (
                    <span className="text-[10px] font-black bg-brand/10 text-brand border border-brand/20 rounded-full px-2 py-0.5">
                      {personCredits.length}
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setShowAddCredit(true)}
                  className="flex items-center gap-1.5 text-xs font-bold text-brand hover:underline"
                >
                  <Icon icon="solar:add-circle-linear" width="16" /> Add credit
                </button>
              </div>

              {personCredits.length === 0 && (
                <p className="text-xs text-text-muted italic">
                  No credits yet. Click &quot;Add credit&quot; to attach this person to a film.
                </p>
              )}

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
                        <span>{formatRole(credit.role)}</span>
                        {credit.character_name && ` as ${credit.character_name}`}
                        {credit.films?.year && ` (${credit.films.year})`}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {editingPerson && youtubeFilmography.length > 0 && (
            <section className="space-y-6">
              <div className="flex items-center gap-2 pb-2 border-b border-border">
                <span className="text-xl">📺</span>
                <h4 className="text-xs font-bold text-text-muted">YouTube Filmography</h4>
              </div>
              <div className="grid grid-cols-1 gap-3">
                {youtubeFilmography.map(video => (
                  <div key={video.video_id} className="flex items-center gap-4 p-3 bg-surface-2 border border-border rounded-lg group hover:border-brand/30 transition-all">
                    <div className="w-20 aspect-video bg-surface rounded border border-border overflow-hidden flex-shrink-0">
                      {video.thumbnail_url ? (
                        <img src={video.thumbnail_url} className="w-full h-full object-cover" alt="" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-[8px] bg-surface-3 text-text-muted">NO THUMB</div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-bold text-text-primary truncate">{video.title}</div>
                      <div className="text-[10px] text-text-muted mt-0.5 font-medium">
                        {Math.floor(video.duration_seconds / 60)}m {video.duration_seconds % 60}s • {new Date(video.published_at).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          <section className="space-y-6">
            <div className="flex items-center gap-2 pb-2 border-b border-border">
              <span className="text-xl">🔗</span>
              <h4 className="text-xs font-bold text-text-muted">Social Profiles</h4>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-text-primary mb-2">Instagram URL</label>
                <input 
                  value={formData.instagram_url || ''} 
                  onChange={e => setFormData({...formData, instagram_url: e.target.value})} 
                  placeholder="https://instagram.com/username"
                  className="w-full bg-surface-2 border border-border p-3 rounded-lg text-sm focus:border-brand outline-none" 
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-text-primary mb-2">Facebook URL</label>
                <input 
                  value={formData.facebook_url || ''} 
                  onChange={e => setFormData({...formData, facebook_url: e.target.value})} 
                  placeholder="https://facebook.com/username"
                  className="w-full bg-surface-2 border border-border p-3 rounded-lg text-sm focus:border-brand outline-none" 
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-text-primary mb-2">X (Twitter) URL</label>
                <input 
                  value={formData.twitter_url || ''} 
                  onChange={e => setFormData({...formData, twitter_url: e.target.value})} 
                  placeholder="https://x.com/username"
                  className="w-full bg-surface-2 border border-border p-3 rounded-lg text-sm focus:border-brand outline-none" 
                />
              </div>
            </div>
          </section>

          {/* Awards & nominations -> people.awards (jsonb). Renders on the
              person page grouped by organisation, IMDb-style. */}
          <AwardsEditor
            variant="person"
            value={formData.awards}
            onChange={(awards) => setFormData({ ...formData, awards })}
          />

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
        </ErrorBoundary>
        </div>
      </Drawer>
      {showAddCredit && editingPerson && (
        <AddCreditModal
          person={editingPerson}
          existingCredits={personCredits}
          onClose={() => setShowAddCredit(false)}
          onSaved={() => refetchCredits(editingPerson.id)}
        />
      )}
      {deletingPerson && (
        <ConfirmModal
          onCancel={() => !isDeleting && setDeletingPerson(null)}
          onConfirm={handleDelete}
          title="Delete Person"
          message={`Are you sure you want to delete "${formatPersonName(deletingPerson.name)}"? This will permanently remove them from the database.`}
          confirmLabel="Delete Person"
          isProcessing={isDeleting}
        />
      )}
      {personBatchDeleteIds && (
        <ConfirmModal
          onCancel={() => !isBatchDeletingPeople && setPersonBatchDeleteIds(null)}
          onConfirm={handleBatchDelete}
          title="Delete Multiple Profiles"
          message={`Are you sure you want to permanently delete ${personBatchDeleteIds.length} profiles? This action cannot be undone.`}
          confirmLabel="Delete All Selected"
          isProcessing={isBatchDeletingPeople}
        />
      )}
    </div>
  );
}

