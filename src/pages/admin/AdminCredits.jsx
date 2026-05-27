import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { toast } from 'react-hot-toast';
import Drawer from '../../components/admin/Drawer';
import ConfirmModal from '../../components/admin/ConfirmModal';
import SkeletonRow from '../../components/admin/SkeletonRow';
import { useAuth } from '../../context/AuthContext';
import { logAdminAction } from '../../lib/adminLogger';

// Custom Searchable Dropdown Component
function SearchableDropdown({ options, value, onChange, placeholder, type = 'person' }) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const wrapperRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredOptions = options.filter(opt => 
    opt.label.toLowerCase().includes(search.toLowerCase())
  );

  const selectedOption = options.find(opt => opt.value === value);

  return (
    <div className="relative" ref={wrapperRef}>
      <div 
        className="w-full bg-surface-2 border border-border text-text-primary rounded-md px-4 py-2.5 text-sm focus-within:border-brand/50 focus-within:ring-2 focus-within:ring-brand/10 cursor-pointer flex items-center justify-between transition-all"
        onClick={() => setIsOpen(!isOpen)}
      >
        {selectedOption ? (
          <div className="flex items-center gap-3">
            {selectedOption.image ? (
              <img src={selectedOption.image} alt="" className={`w-7 h-7 object-cover bg-surface-2 ${type === 'film' ? 'rounded-lg' : 'rounded-full'}`} />
            ) : (
              <div className={`w-7 h-7 bg-surface-2 flex items-center justify-center text-[10px] font-black ${type === 'film' ? 'rounded-lg' : 'rounded-full'}`}>
                {selectedOption.label.charAt(0).toUpperCase()}
              </div>
            )}
            <span className="font-bold truncate">{selectedOption.label}</span>
          </div>
        ) : (
          <span className="text-text-muted font-medium">{placeholder}</span>
        )}
        <svg className={`w-4 h-4 text-text-muted transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
        </svg>
      </div>

      {isOpen && (
        <div className="absolute z-50 w-full mt-2 bg-surface border border-border rounded-lg shadow-xl max-h-72 flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
          <div className="p-3 border-b border-border bg-surface-2/30">
            <input
              type="text"
              className="w-full bg-surface-2 border border-border text-text-primary rounded-md px-3 py-2 text-sm focus:border-brand focus:outline-none transition-all"
              placeholder="Search assets..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onClick={(e) => e.stopPropagation()}
              autoFocus
            />
          </div>
          <div className="overflow-y-auto flex-1 p-1.5 custom-scrollbar">
            {filteredOptions.length === 0 ? (
              <div className="p-8 text-center text-sm text-text-muted font-medium">No results found</div>
            ) : (
              filteredOptions.map(opt => (
                <div
                  key={opt.value}
                  className={`p-2.5 rounded-md cursor-pointer flex items-center gap-3 hover:bg-surface-2 transition-all group ${value === opt.value ? 'bg-brand/5' : ''}`}
                  onClick={() => {
                    onChange(opt.value);
                    setIsOpen(false);
                    setSearch('');
                  }}
                >
                  {opt.image ? (
                    <img src={opt.image} alt="" className={`w-9 h-9 object-cover bg-surface-2 group-hover:scale-105 transition-transform ${type === 'film' ? 'rounded-lg' : 'rounded-full'}`} />
                  ) : (
                    <div className={`w-9 h-9 bg-surface-2 flex items-center justify-center text-xs font-black ${type === 'film' ? 'rounded-lg' : 'rounded-full'}`}>
                      {opt.label.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className={`text-sm font-bold truncate ${value === opt.value ? 'text-brand' : 'text-text-primary'}`}>{opt.label}</p>
                    {type === 'film' && <p className="text-[10px] text-text-muted font-bold uppercase tracking-widest leading-none mt-1">Film Asset</p>}
                    {type === 'person' && <p className="text-[10px] text-text-muted font-bold uppercase tracking-widest leading-none mt-1">Talent Profile</p>}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function AdminCredits() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [credits, setCredits] = useState([]);
  const [allPeople, setAllPeople] = useState([]);
  const [allFilms, setAllFilms] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('All');

  // Modals/Drawers state
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [editingCredit, setEditingCredit] = useState(null);
  const [deletingCredit, setDeletingCredit] = useState(null);
  const [selectedCreditIds, setSelectedCreditIds] = useState([]);
  const [creditBatchDeleteIds, setCreditBatchDeleteIds] = useState(null);
  const [isBatchDeletingCredits, setIsBatchDeletingCredits] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    person_id: '',
    film_id: '',
    role: 'actor',
    character_name: '',
    billing_order: 99
  });
  const [isCustomRole, setIsCustomRole] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [creditsRes, peopleRes, filmsRes] = await Promise.all([
        supabase
          .from('credits')
          .select(`
            *,
            people(id, name, photo_url),
            films(id, title, poster_url)
          `)
          .order('created_at', { ascending: false }),
        supabase
          .from('people')
          .select('id, name, photo_url')
          .order('name'),
        supabase
          .from('films')
          .select('id, title, poster_url')
          .order('title')
      ]);

      if (creditsRes.error) throw creditsRes.error;
      if (peopleRes.error) throw peopleRes.error;
      if (filmsRes.error) throw filmsRes.error;

      setCredits(creditsRes.data || []);
      setAllPeople(peopleRes.data || []);
      setAllFilms(filmsRes.data || []);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Failed to load data');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    setSelectedCreditIds([]);
  }, [search, roleFilter]);

  // Filtering
  const filteredCredits = credits.filter(c => {
    const personName = c.people?.name?.toLowerCase() || '';
    const filmTitle = c.films?.title?.toLowerCase() || '';
    const searchLower = search.toLowerCase();
    
    const matchesSearch = personName.includes(searchLower) || filmTitle.includes(searchLower);
    const matchesRole = roleFilter === 'All' || c.role.toLowerCase() === roleFilter.toLowerCase();
    
    return matchesSearch && matchesRole;
  });

  const handleDelete = async () => {
    if (!deletingCredit) return;
    try {
      const { error } = await supabase
        .from('credits')
        .delete()
        .eq('id', deletingCredit.id);

      if (error) throw error;

      await logAdminAction(user, 'delete', 'credit', deletingCredit.id, `${deletingCredit.people?.name} as ${deletingCredit.role} in ${deletingCredit.films?.title}`);

      setCredits(credits.filter(c => c.id !== deletingCredit.id));
      setSelectedCreditIds((prev) => prev.filter((id) => id !== deletingCredit.id));
      toast.success('Credit removed');
      setDeletingCredit(null);
    } catch (error) {
      console.error('Error deleting credit:', error);
      toast.error('Failed to remove credit');
    }
  };

  const openAddDrawer = () => {
    setEditingCredit(null);
    setFormData({
      person_id: '',
      film_id: '',
      role: 'actor',
      character_name: '',
      billing_order: 99
    });
    setIsCustomRole(false);
    setIsDrawerOpen(true);
  };

  const openEditDrawer = (credit) => {
    setEditingCredit(credit);
    
    const roleValue = credit.role || 'actor';
    const standardRoles = ['actor', 'director', 'writer', 'producer', 'cinematographer', 'editor', 'composer', 'costume_designer'];
    setIsCustomRole(!standardRoles.includes(roleValue.toLowerCase()));
    
    setFormData({
      person_id: credit.person_id || '',
      film_id: credit.film_id || '',
      role: roleValue,
      character_name: credit.character_name || '',
      billing_order: credit.billing_order || 99
    });
    setIsDrawerOpen(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    
    if (!formData.person_id || !formData.film_id || !formData.role) {
      toast.error('Please fill in all required fields');
      return;
    }

    setIsSaving(true);
    try {
      const dataToSave = {
        person_id: formData.person_id,
        film_id: formData.film_id,
        role: formData.role,
        character_name: formData.role === 'actor' ? formData.character_name : null,
        billing_order: parseInt(formData.billing_order, 10) || 99
      };

      if (!editingCredit) {
        // Check for duplicate
        const { data: existing } = await supabase
          .from('credits')
          .select('id')
          .eq('person_id', formData.person_id)
          .eq('film_id', formData.film_id)
          .eq('role', formData.role);

        if (existing && existing.length > 0) {
          toast.error('This credit already exists.');
          setIsSaving(false);
          return;
        }

        const { data, error } = await supabase
          .from('credits')
          .insert([dataToSave])
          .select();
        if (error) throw error;
        const newCreditId = data?.[0]?.id;
        const personName = allPeople.find(p => p.id === formData.person_id)?.name || formData.person_id;
        const filmTitle = allFilms.find(f => f.id === formData.film_id)?.title || formData.film_id;
        await logAdminAction(user, 'create', 'credit', newCreditId, `${personName} as ${formData.role} in ${filmTitle}`, { person_id: formData.person_id, film_id: formData.film_id, role: formData.role });
        toast.success('Credit added');
      } else {
        const { error } = await supabase
          .from('credits')
          .update(dataToSave)
          .eq('id', editingCredit.id);
        if (error) throw error;
        const personName = allPeople.find(p => p.id === formData.person_id)?.name || formData.person_id;
        const filmTitle = allFilms.find(f => f.id === formData.film_id)?.title || formData.film_id;
        await logAdminAction(user, 'update', 'credit', editingCredit.id, `${personName} as ${formData.role} in ${filmTitle}`, { person_id: formData.person_id, film_id: formData.film_id, role: formData.role });
        toast.success('Credit updated');
      }
      setIsDrawerOpen(false);
      fetchData();
    } catch (error) {
      console.error('Error saving credit:', error);
      toast.error('Failed to save credit');
    } finally {
      setIsSaving(false);
    }
  };

  const getRoleBadgeColor = (role) => {
    switch(role.toLowerCase()) {
      case 'actor': return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
      case 'director': return 'bg-brand/10 text-brand border-brand/20';
      case 'writer': return 'bg-green-500/10 text-green-500 border-green-500/20';
      case 'producer': return 'bg-purple-500/10 text-purple-500 border-purple-500/20';
      default: return 'bg-surface-2 text-text-muted border-border';
    }
  };

  const getInitials = (name) => {
    if (!name) return '?';
    return name.charAt(0).toUpperCase();
  };

  // Format options for dropdowns
  const peopleOptions = allPeople.map(p => ({ value: p.id, label: p.name, image: p.photo_url }));
  const filmOptions = allFilms.map(f => ({ value: f.id, label: f.title, image: f.poster_url }));

  const toggleCreditSelect = (id) => {
    setSelectedCreditIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const allFilteredCreditsSelected =
    filteredCredits.length > 0 && filteredCredits.every((c) => selectedCreditIds.includes(c.id));

  const toggleSelectAllFilteredCredits = () => {
    if (allFilteredCreditsSelected) {
      const filteredIds = new Set(filteredCredits.map((c) => c.id));
      setSelectedCreditIds((prev) => prev.filter((id) => !filteredIds.has(id)));
    } else {
      setSelectedCreditIds((prev) => {
        const next = new Set([...prev, ...filteredCredits.map((c) => c.id)]);
        return [...next];
      });
    }
  };

  const handleConfirmBatchDeleteCredits = async () => {
    if (!creditBatchDeleteIds?.length) return;
    setIsBatchDeletingCredits(true);
    try {
      const { error } = await supabase.from('credits').delete().in('id', creditBatchDeleteIds);
      if (error) throw error;
      
      for (const id of creditBatchDeleteIds) {
        await logAdminAction(user, 'delete', 'credit', id, `Batch deleted credit ID: ${id}`);
      }
      
      setCredits((prev) => prev.filter((c) => !creditBatchDeleteIds.includes(c.id)));
      setSelectedCreditIds((prev) => prev.filter((id) => !creditBatchDeleteIds.includes(id)));
      toast.success(`Removed ${creditBatchDeleteIds.length} credit${creditBatchDeleteIds.length === 1 ? '' : 's'}`);
      setCreditBatchDeleteIds(null);
    } catch (error) {
      console.error('Error batch deleting credits:', error);
      toast.error('Batch delete failed');
    } finally {
      setIsBatchDeletingCredits(false);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Modernized Header */}
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <p className="text-brand text-[10px] font-black uppercase tracking-[0.3em] mb-1 italic">Production Index</p>
          <h1 className="text-3xl font-black text-text-primary tracking-tight">Credits Management</h1>
          <p className="text-text-muted text-sm mt-1 max-w-xl font-medium leading-relaxed opacity-80">
            Global attribution engine for the Ensembla ecosystem. Linking talent to production assets.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={() => navigate('/admin/credits/extractor')}
            className="bg-surface-2 border border-border hover:border-brand/30 text-text-muted hover:text-text-primary font-black px-6 py-3.5 rounded-lg text-sm hover:scale-[1.02] active:scale-[0.98] transition-all shadow-sm flex items-center gap-2"
          >
            📷 Launch Credits OCR Extractor
          </button>
          <button
            onClick={openAddDrawer}
            className="bg-brand text-white font-black px-8 py-3.5 rounded-lg text-sm hover:scale-[1.02] active:scale-[0.98] transition-all shadow-xl shadow-brand/20 flex items-center gap-2"
          >
            <span className="text-lg leading-none">＋</span> Create New Attribution
          </button>
        </div>
      </header>

      {/* Filter Bar with SaaS Styling */}
      <div className="card-cal p-2 overflow-hidden flex flex-col md:flex-row items-center divide-y md:divide-y-0 md:divide-x divide-border">
        <div className="relative flex-1 w-full">
          <span className="absolute left-6 top-1/2 -translate-y-1/2 text-text-muted">🔍</span>
          <input
            type="text"
            placeholder="Search by talent, film production, or character..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-transparent border-none py-5 pl-14 pr-6 text-text-primary text-sm font-bold focus:ring-0 placeholder:text-text-muted/50"
          />
        </div>
        
        <div className="w-full md:w-72 relative bg-surface-2/30">
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="w-full bg-transparent border-none py-5 px-8 text-text-primary text-sm font-black uppercase tracking-widest focus:ring-0 cursor-pointer appearance-none"
          >
            <option value="All">All Departments</option>
            <option value="Actor">Actors / Cast</option>
            <option value="Director">Directors</option>
            <option value="Writer">Writers</option>
            <option value="Producer">Producers</option>
            <option value="Cinematographer">Cinematography</option>
            <option value="Editor">Editing</option>
          </select>
          <span className="absolute right-6 top-1/2 -translate-y-1/2 pointer-events-none text-text-muted">↓</span>
        </div>
      </div>

      {/* Batch Actions Bar */}
      {selectedCreditIds.length > 0 && (
        <div className="flex items-center justify-between p-4 bg-brand/5 border border-brand/20 rounded-lg animate-in slide-in-from-top-2 duration-300">
          <div className="flex items-center gap-4 pl-2">
            <div className="w-10 h-10 bg-brand rounded-md flex items-center justify-center text-white shadow-lg shadow-brand/20">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" /></svg>
            </div>
            <div>
              <p className="text-sm font-black text-text-primary">{selectedCreditIds.length} Assets Selected</p>
              <p className="text-[10px] text-text-muted font-bold uppercase tracking-widest">Global batch operations active</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setCreditBatchDeleteIds([...selectedCreditIds])}
            className="bg-red-500 text-white font-black text-[10px] uppercase tracking-[0.2em] px-6 py-3 rounded-md hover:bg-red-600 transition-all shadow-lg shadow-red-500/20"
          >
            Purge Selected Records
          </button>
        </div>
      )}

      {/* Modernized Data Table */}
      <div className="card-cal overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead>
              <tr className="border-b border-border bg-surface-2/30 text-text-muted text-[10px] font-black uppercase tracking-[0.2em]">
                <th className="pl-8 pr-2 py-4 w-12">
                  <input
                    type="checkbox"
                    checked={allFilteredCreditsSelected}
                    onChange={toggleSelectAllFilteredCredits}
                    disabled={isLoading || filteredCredits.length === 0}
                    className="w-4 h-4 rounded border-border bg-surface-2 accent-brand cursor-pointer focus:ring-brand/20"
                  />
                </th>
                <th className="px-6 py-4">Talent Identity</th>
                <th className="px-6 py-4">Production Asset</th>
                <th className="px-6 py-4">Department / Role</th>
                <th className="px-6 py-4">Attribution Info</th>
                <th className="px-8 py-4 text-right">Settings</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {isLoading ? (
                Array(5).fill(0).map((_, i) => <SkeletonRow key={i} columns={6} />)
              ) : filteredCredits.length === 0 ? (
                <tr>
                  <td colSpan="6" className="px-6 py-24 text-center">
                    <div className="flex flex-col items-center gap-4">
                      <span className="text-4xl opacity-20">🎭</span>
                      <p className="text-text-muted font-bold text-lg">No attribution records found.</p>
                      <button onClick={openAddDrawer} className="text-brand font-black text-[10px] uppercase tracking-widest hover:underline">Register New Credit</button>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredCredits.map((credit) => (
                  <tr 
                    key={credit.id} 
                    className="group transition-all duration-200 hover:bg-surface-2/50"
                  >
                    <td className="pl-8 pr-2 py-5">
                      <input
                        type="checkbox"
                        checked={selectedCreditIds.includes(credit.id)}
                        onChange={() => toggleCreditSelect(credit.id)}
                        className="w-4 h-4 rounded border-border bg-surface-2 accent-brand cursor-pointer focus:ring-brand/20"
                      />
                    </td>
                    <td className="px-6 py-5">
                      <div className="flex items-center gap-4">
                        <div className="w-11 h-11 rounded-full bg-surface-2 border border-border overflow-hidden flex-shrink-0 shadow-sm transition-transform group-hover:scale-105">
                          {credit.people?.photo_url ? (
                            <img src={credit.people.photo_url} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-brand font-black text-xs">
                              {getInitials(credit.people?.name)}
                            </div>
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="font-black text-text-primary text-sm truncate">{credit.people?.name || 'Anonymous'}</p>
                          <p className="text-[10px] text-text-muted font-bold uppercase tracking-widest mt-0.5 leading-none">Talent Profile</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <div className="flex items-center gap-4">
                        <div className="w-8 h-12 rounded-lg bg-surface-2 border border-border overflow-hidden flex-shrink-0 shadow-sm transition-transform group-hover:scale-105">
                          {credit.films?.poster_url ? (
                            <img src={credit.films.poster_url} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-brand font-black text-[10px]">
                              {getInitials(credit.films?.title)}
                            </div>
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="font-black text-text-primary text-sm truncate">{credit.films?.title || 'Unknown'}</p>
                          <p className="text-[10px] text-text-muted font-bold uppercase tracking-widest mt-0.5 leading-none">Film Production</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest border ${getRoleBadgeColor(credit.role)}`}>
                        {credit.role.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-6 py-5">
                      <div className="space-y-1">
                        <p className="text-text-primary font-black text-sm">
                          {credit.role === 'actor' ? (credit.character_name || 'Cast Member') : 'Department Chief'}
                        </p>
                        <p className="text-[10px] text-text-muted font-bold uppercase tracking-widest">Billing Order #{credit.billing_order}</p>
                      </div>
                    </td>
                    <td className="px-8 py-5 text-right">
                      <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => openEditDrawer(credit)}
                          className="p-2.5 bg-surface-2 border border-border text-text-muted rounded-md hover:text-brand hover:border-brand/30 transition-all shadow-sm"
                          title="Edit Attribution"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                        </button>
                        <button
                          onClick={() => setDeletingCredit(credit)}
                          className="p-2.5 bg-surface-2 border border-border text-text-muted rounded-md hover:text-red-500 hover:border-red-500/30 transition-all shadow-sm"
                          title="Purge Record"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-4v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
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

      {/* Refactored Drawer Form */}
      <Drawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        title={editingCredit ? "Edit Attribution" : "Add Attribution"}
      >
        <form onSubmit={handleSave} className="flex flex-col h-full">
          <div className="flex-1 space-y-8 p-1">
            <section>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-brand mb-4">Core Mapping</p>
              <div className="space-y-6">
                <div>
                  <label className="block text-[11px] font-black text-text-muted uppercase tracking-[0.1em] mb-2 pl-1">Talent Profile *</label>
                  <SearchableDropdown
                    options={peopleOptions}
                    value={formData.person_id}
                    onChange={(val) => setFormData({ ...formData, person_id: val })}
                    placeholder="Search talent registry..."
                    type="person"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-black text-text-muted uppercase tracking-[0.1em] mb-2 pl-1">Film production *</label>
                  <SearchableDropdown
                    options={filmOptions}
                    value={formData.film_id}
                    onChange={(val) => setFormData({ ...formData, film_id: val })}
                    placeholder="Search film library..."
                    type="film"
                  />
                </div>
              </div>
            </section>

            <section>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-brand mb-4">Attribution Depth</p>
              <div className="grid grid-cols-2 gap-6">
                <div className="col-span-2">
                  <label className="block text-[11px] font-black text-text-muted uppercase tracking-[0.1em] mb-2 pl-1">Department Head / Role *</label>
                  {isCustomRole ? (
                    <div className="flex gap-2">
                      <input
                        autoFocus
                        value={formData.role}
                        onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                        className="w-full bg-surface-2 border border-brand text-text-primary rounded-md px-4 py-3 text-sm font-bold focus:border-brand focus:outline-none transition-all"
                        placeholder="Enter custom role..."
                      />
                      <button 
                        type="button"
                        onClick={() => {
                          setIsCustomRole(false);
                          setFormData({ ...formData, role: 'actor' });
                        }}
                        className="px-4 bg-surface-2 border border-border text-text-muted rounded-md hover:text-red-500 transition-colors"
                        title="Back to standard roles"
                      >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                      </button>
                    </div>
                  ) : (
                    <select
                      value={formData.role}
                      onChange={(e) => {
                        if (e.target.value === 'custom_role') {
                          setIsCustomRole(true);
                          setFormData({ ...formData, role: '' });
                        } else {
                          setFormData({ ...formData, role: e.target.value });
                        }
                      }}
                      className="w-full bg-surface-2 border border-border text-text-primary rounded-md px-4 py-3 text-sm font-bold focus:border-brand focus:outline-none transition-all appearance-none"
                    >
                      <option value="actor">Actor</option>
                      <option value="director">Director</option>
                      <option value="writer">Writer</option>
                      <option value="producer">Producer</option>
                      <option value="cinematographer">Cinematographer</option>
                      <option value="editor">Editor</option>
                      <option value="composer">Composer</option>
                      <option value="costume_designer">Costume Designer</option>
                      <option value="custom_role" className="text-brand font-black">+ Add Custom Role...</option>
                    </select>
                  )}
                </div>

                {formData.role === 'actor' && (
                  <div className="col-span-2">
                    <label className="block text-[11px] font-black text-text-muted uppercase tracking-[0.1em] mb-2 pl-1">Character Persona</label>
                    <input
                      type="text"
                      value={formData.character_name}
                      onChange={(e) => setFormData({ ...formData, character_name: e.target.value })}
                      className="w-full bg-surface-2 border border-border text-text-primary rounded-md px-4 py-3 text-sm font-bold focus:border-brand focus:outline-none transition-all placeholder:text-text-muted/50"
                      placeholder="e.g. Inspector Danladi"
                    />
                  </div>
                )}

                <div className="col-span-2">
                  <label className="block text-[11px] font-black text-text-muted uppercase tracking-[0.1em] mb-2 pl-1">Billing Sequence</label>
                  <input
                    type="number"
                    min="1"
                    value={formData.billing_order}
                    onChange={(e) => setFormData({ ...formData, billing_order: e.target.value })}
                    className="w-full bg-surface-2 border border-border text-text-primary rounded-md px-4 py-3 text-sm font-bold focus:border-brand focus:outline-none transition-all"
                  />
                  <p className="mt-2 text-[10px] text-text-muted font-medium italic">Priority rank (1 = Primary Billing)</p>
                </div>
              </div>
            </section>
          </div>

          <div className="pt-8 border-t border-border mt-8 flex flex-col gap-3">
            <button
              type="submit"
              disabled={isSaving}
              className="w-full bg-brand text-white font-black py-4 rounded-lg hover:scale-[1.02] active:scale-[0.98] transition-all shadow-xl shadow-brand/20 disabled:opacity-50"
            >
              {isSaving ? 'Synchronizing...' : (editingCredit ? 'Finalize Attribution' : 'Register Credit')}
            </button>
            <button
              type="button"
              onClick={() => setIsDrawerOpen(false)}
              className="w-full text-text-muted font-black text-[10px] uppercase tracking-widest py-3 hover:text-text-primary transition-colors"
            >
              Abort Changes
            </button>
          </div>
        </form>
      </Drawer>

      {/* Modals */}
      {deletingCredit && (
        <ConfirmModal
          title="Purge Attribution"
          message={`Remove ${deletingCredit.people?.name} as ${deletingCredit.role.replace('_', ' ')} in ${deletingCredit.films?.title}? This action cannot be reversed.`}
          confirmLabel="Purge Record"
          confirmColor="bg-red-500 hover:bg-red-600"
          onConfirm={handleDelete}
          onCancel={() => setDeletingCredit(null)}
        />
      )}

      {creditBatchDeleteIds && (
        <ConfirmModal
          title="Purge Selection"
          message={`Are you sure you want to permanently delete these ${creditBatchDeleteIds.length} production records?`}
          confirmLabel="Execute Purge"
          confirmColor="bg-red-500 hover:bg-red-600"
          onConfirm={handleConfirmBatchDeleteCredits}
          onCancel={() => !isBatchDeletingCredits && setCreditBatchDeleteIds(null)}
          isProcessing={isBatchDeletingCredits}
        />
      )}
    </div>
  );
}
