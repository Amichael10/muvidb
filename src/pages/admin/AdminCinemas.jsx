import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { toast } from 'react-hot-toast';
import Drawer from '../../components/admin/Drawer';
import { toTitleCase, toSentenceCase } from '../../utils/format';

export default function AdminCinemas() {
  const [cinemas, setCinemas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [editingCinema, setEditingCinema] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [expandedRow, setExpandedRow] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState({
    chain: 'All',
    city: 'All',
    status: 'All'
  });

  const initialFormState = {
    name: '',
    chain: '',
    city: '',
    state: '',
    address: '',
    description: '',
    logo_url: '',
    website: '',
    google_maps_url: '',
    screens_count: '',
    seating_capacity: '',
    is_active: true
  };

  const [formData, setFormData] = useState(initialFormState);

  const chains = ['Filmhouse', 'Genesis', 'Silverbird', 'Ozone', 'Blu Star', 'Kada', 'Other'];
  const cities = ['Lagos', 'Abuja', 'Port Harcourt', 'Other'];

  useEffect(() => {
    fetchCinemas();
  }, []);

  const fetchCinemas = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('cinemas')
        .select('*')
        .order('city', { ascending: true });

      if (error) throw error;
      setCinemas(data || []);
    } catch (error) {
      console.error('Error fetching cinemas:', error);
      toast.error('Failed to load cinemas');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDrawer = (cinema = null) => {
    if (cinema) {
      setEditingCinema(cinema);
      setFormData({
        ...cinema,
        screens_count: cinema.screens_count || '',
        seating_capacity: cinema.seating_capacity || ''
      });
    } else {
      setEditingCinema(null);
      setFormData(initialFormState);
    }
    setIsDrawerOpen(true);
  };

  const handleCloseDrawer = () => {
    setIsDrawerOpen(false);
    setEditingCinema(null);
    setFormData(initialFormState);
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleLogoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 1024 * 1024) {
      toast.error('File size must be less than 1MB');
      return;
    }

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `cinemas/cinema_${Date.now()}.${fileExt}`;
      
      const { data: uploadData, error: uploadError } = await supabase
        .storage
        .from('film-images')
        .upload(fileName, file, { upsert: true });
      
      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase
        .storage
        .from('film-images')
        .getPublicUrl(uploadData.path);
      
      setFormData(prev => ({
        ...prev,
        logo_url: publicUrl
      }));
      toast.success('Logo uploaded successfuly');
    } catch (error) {
        console.error('Upload error:', error);
        toast.error('Failed to upload logo');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const payload = {
        ...formData,
        name: formData.name ? toTitleCase(formData.name.trim()) : '',
        chain: formData.chain ? toTitleCase(formData.chain.trim()) : '',
        city: formData.city ? toTitleCase(formData.city.trim()) : '',
        state: formData.state ? toTitleCase(formData.state.trim()) : '',
        address: formData.address ? toSentenceCase(formData.address.trim()) : '',
        description: formData.description ? toSentenceCase(formData.description.trim()) : '',
        screens_count: formData.screens_count ? parseInt(formData.screens_count) : null,
        seating_capacity: formData.seating_capacity ? parseInt(formData.seating_capacity) : null,
      };

      if (editingCinema) {
        const { error } = await supabase
          .from('cinemas')
          .update(payload)
          .eq('id', editingCinema.id);
        if (error) throw error;
        toast.success('Cinema updated successfully');
      } else {
        const { error } = await supabase
          .from('cinemas')
          .insert([payload]);
        if (error) throw error;
        toast.success('Cinema added successfully');
      }
      
      handleCloseDrawer();
      fetchCinemas();
    } catch (error) {
      console.error('Error saving cinema:', error);
      toast.error('Failed to save cinema');
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleActive = async (cinema) => {
    try {
      const { error } = await supabase
        .from('cinemas')
        .update({ is_active: !cinema.is_active })
        .eq('id', cinema.id);

      if (error) throw error;
      
      setCinemas(prev => prev.map(c => 
        c.id === cinema.id ? { ...c, is_active: !c.is_active } : c
      ));
      
      toast.success(cinema.is_active ? 'Cinema deactivated' : 'Cinema activated');
    } catch (error) {
      toast.error('Failed to toggle status');
    }
  };

  const handleDelete = async (cinema) => {
    if (!window.confirm(`Are you sure you want to delete ${cinema.name}? This will also remove all showtimes at this location.`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from('cinemas')
        .delete()
        .eq('id', cinema.id);

      if (error) throw error;
      toast.success('Cinema deleted');
      fetchCinemas();
    } catch (error) {
      toast.error('Failed to delete cinema');
    }
  };

  const filteredCinemas = cinemas.filter(cinema => {
    const matchesSearch = cinema.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          cinema.city.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesChain = filters.chain === 'All' || cinema.chain === filters.chain;
    const matchesCity = filters.city === 'All' || cinema.city === filters.city;
    const matchesStatus = filters.status === 'All' || 
                          (filters.status === 'Active' ? cinema.is_active : !cinema.is_active);
    
    return matchesSearch && matchesChain && matchesCity && matchesStatus;
  });

  const getChainBadgeColor = (chain) => {
    switch (chain) {
      case 'Filmhouse': return 'bg-brand/20 text-brand border-brand/30';
      case 'Genesis': return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      case 'Silverbird': return 'bg-purple-500/20 text-purple-400 border-purple-500/30';
      case 'Ozone': return 'bg-green-500/20 text-green-400 border-green-500/30';
      case 'Blu Star': return 'bg-orange-500/20 text-orange-400 border-orange-500/30';
      case 'Kada': return 'bg-teal-500/20 text-teal-400 border-teal-500/30';
      default: return 'bg-surface-3 text-text-muted border-border';
    }
  };

  return (
    <div className="p-6 max-w-[1600px] mx-auto pb-24">
      {/* Premium Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
        <div>
          <p className="text-brand text-[10px] font-black uppercase tracking-[0.4em] mb-2 italic">Facility Management</p>
          <h1 className="text-4xl font-black text-text-primary tracking-tight mb-2">Theater Directory</h1>
          <div className="flex items-center gap-3">
             <span className="px-3 py-1 rounded-full bg-surface-2 border border-border text-[10px] font-black text-text-muted uppercase tracking-widest">
              {filteredCinemas.length} Locations Registered
            </span>
          </div>
        </div>
        <button
          onClick={() => handleOpenDrawer()}
          className="group relative px-10 py-5 bg-brand text-white rounded-md text-[10px] font-black uppercase tracking-[0.2em] shadow-2xl shadow-brand/20 hover:scale-105 active:scale-95 transition-all duration-300"
        >
          <span className="relative z-10 flex items-center gap-3 font-black">
             <span className="text-lg">⊕</span> Add New Location
          </span>
          <div className="absolute inset-0 bg-white/10 rounded-md opacity-0 group-hover:opacity-100 transition-opacity" />
        </button>
      </div>

      {/* Modern Filter Card */}
      <div className="card-cal p-8 mb-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 items-end">
          <div className="lg:col-span-2 relative">
            <label className="block text-text-muted text-[10px] font-black uppercase tracking-[0.2em] mb-3 px-1">Industry Search</label>
            <div className="relative group">
              <input
                type="text"
                placeholder="Search by theater name, city, or chain..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-14 bg-surface-2 border border-border rounded-lg px-6 pl-14 text-text-primary text-sm focus:border-brand focus:outline-none transition-all placeholder:text-text-muted/30 group-hover:border-border-hover shadow-inner"
              />
              <span className="absolute left-6 top-1/2 -translate-y-1/2 text-text-muted opacity-50 text-xl">🔍</span>
            </div>
          </div>
          
          <div className="grid grid-cols-3 gap-4 lg:col-span-2">
            <div>
              <label className="block text-text-muted text-[10px] font-black uppercase tracking-[0.2em] mb-3 px-1">Chain</label>
              <select
                value={filters.chain}
                onChange={(e) => setFilters(prev => ({ ...prev, chain: e.target.value }))}
                className="w-full h-14 bg-surface-2 border border-border rounded-lg px-5 text-text-primary text-[10px] font-black uppercase tracking-widest focus:border-brand focus:outline-none appearance-none cursor-pointer hover:border-border-hover transition-colors"
              >
                <option value="All">All Chains</option>
                {chains.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-text-muted text-[10px] font-black uppercase tracking-[0.2em] mb-3 px-1">Region</label>
              <select
                value={filters.city}
                onChange={(e) => setFilters(prev => ({ ...prev, city: e.target.value }))}
                className="w-full h-14 bg-surface-2 border border-border rounded-lg px-5 text-text-primary text-[10px] font-black uppercase tracking-widest focus:border-brand focus:outline-none appearance-none cursor-pointer hover:border-border-hover transition-colors"
              >
                <option value="All">All Cities</option>
                {cities.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-text-muted text-[10px] font-black uppercase tracking-[0.2em] mb-3 px-1">Availability</label>
              <select
                value={filters.status}
                onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
                className="w-full h-14 bg-surface-2 border border-border rounded-lg px-5 text-text-primary text-[10px] font-black uppercase tracking-widest focus:border-brand focus:outline-none appearance-none cursor-pointer hover:border-border-hover transition-colors"
              >
                <option value="All">Life Cycle</option>
                <option value="Active">Operational</option>
                <option value="Inactive">Offline</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Data Table Container */}
      <div className="card-cal overflow-hidden mb-12 shadow-[0_32px_64px_-16px_rgba(0,0,0,0.5)]">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-border text-text-muted text-[10px] font-black uppercase tracking-[0.3em] bg-surface-2/50">
                <th className="px-10 py-6">Facility / Chain</th>
                <th className="px-10 py-6 border-l border-border/10">Operations Hub</th>
                <th className="px-10 py-6 border-l border-border/10 text-center">Status</th>
                <th className="px-10 py-6 text-right border-l border-border/10">Control Access</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr>
                  <td colSpan="4" className="px-10 py-32 text-center">
                    <div className="flex flex-col items-center gap-4">
                      <div className="w-12 h-12 border-4 border-brand/20 border-t-brand rounded-full animate-spin" />
                      <p className="text-[10px] font-black text-brand uppercase tracking-widest animate-pulse">Syncing Directories...</p>
                    </div>
                  </td>
                </tr>
              ) : filteredCinemas.length === 0 ? (
                <tr>
                  <td colSpan="4" className="px-10 py-32 text-center text-text-muted italic font-medium">
                    <div className="max-w-xs mx-auto">
                       <p className="text-3xl mb-4 opacity-20">📍</p>
                       <p className="text-xs uppercase font-black tracking-widest mb-1">Grid Empty</p>
                       <p className="text-[10px] opacity-60">No theater locations found matching your filter criteria.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredCinemas.map((cinema, i) => (
                  <React.Fragment key={cinema.id}>
                    <tr 
                      className={`group transition-all duration-300 cursor-pointer overflow-hidden relative ${
                        expandedRow === cinema.id ? 'bg-surface-2' : 'hover:bg-surface-2/50'
                      }`}
                      onClick={() => setExpandedRow(expandedRow === cinema.id ? null : cinema.id)}
                    >
                      <td className="px-10 py-8">
                        <div className="flex items-center gap-6">
                          <div className="relative group/logo">
                            <div className="absolute inset-0 bg-brand/10 blur-xl opacity-0 group-hover/logo:opacity-100 transition-opacity" />
                            <div className="relative w-16 h-16 rounded-lg bg-white border border-border p-3 flex items-center justify-center overflow-hidden shadow-lg transition-transform duration-500 group-hover:scale-110 group-hover:rotate-3">
                              {cinema.logo_url ? (
                                <img src={cinema.logo_url} alt="" className="w-full h-full object-contain" />
                              ) : (
                                <div className="text-2xl font-black text-dark/20">{cinema.name.charAt(0)}</div>
                              )}
                            </div>
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-3 mb-1.5">
                              <h3 className="font-black text-text-primary text-xl tracking-tight group-hover:text-brand transition-colors">{cinema.name}</h3>
                              <span className={`px-2.5 py-1 rounded-lg border text-[8px] font-black uppercase tracking-widest ${getChainBadgeColor(cinema.chain)} shadow-sm`}>
                                {cinema.chain}
                              </span>
                            </div>
                            <p className="text-[10px] text-text-muted font-bold uppercase tracking-widest opacity-70 group-hover:opacity-100 transition-opacity flex items-center gap-2">
                              📍 {cinema.address || 'UNDEFINED LOCATION'}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-10 py-8 border-l border-border/10">
                        <div className="flex flex-col gap-1">
                          <p className="text-text-primary font-black text-base tracking-tight uppercase">{cinema.city}</p>
                          <p className="text-[10px] text-text-muted font-black uppercase tracking-[0.2em] italic opacity-60">{cinema.state}</p>
                        </div>
                      </td>
                      <td className="px-10 py-8 border-l border-border/10 text-center">
                        <div className="flex flex-col items-center gap-1.5">
                          <span className={`inline-flex items-center px-5 py-2 rounded-full text-[9px] font-black uppercase tracking-[0.15em] border shadow-sm transition-all duration-300 ${
                            cinema.is_active 
                              ? 'bg-green-500/10 text-green-400 border-green-500/20' 
                              : 'bg-red-500/10 text-red-500 border-red-500/20 opacity-50'
                          }`}>
                            {cinema.is_active ? (
                              <><span className="w-1.5 h-1.5 rounded-full bg-green-400 mr-2 animate-pulse" /> OPERATIONAL</>
                            ) : (
                              <><span className="w-1.5 h-1.5 rounded-full bg-red-400 mr-2" /> OFFLINE</>
                            )}
                          </span>
                        </div>
                      </td>
                      <td className="px-10 py-8 text-right border-l border-border/10">
                        <div className="flex items-center justify-end gap-3" onClick={e => e.stopPropagation()}>
                          <button
                            onClick={() => handleOpenDrawer(cinema)}
                            className="w-11 h-11 flex items-center justify-center bg-surface border border-border text-text-muted hover:text-brand hover:border-brand/50 rounded-lg transition-all shadow-sm group/btn active:scale-90"
                            title="Refine Metadata"
                          >
                            <span className="text-base group-hover/btn:scale-125 transition-transform">✏️</span>
                          </button>
                          <button
                            onClick={() => toggleActive(cinema)}
                            className={`w-11 h-11 flex items-center justify-center border rounded-lg transition-all shadow-sm group/btn active:scale-90 ${
                              cinema.is_active 
                                ? 'bg-orange-500/10 border-orange-500/20 text-orange-500 hover:bg-orange-500 hover:text-white' 
                                : 'bg-green-500/10 border-green-500/20 text-green-500 hover:bg-green-500 hover:text-white'
                            }`}
                            title={cinema.is_active ? 'Pause Operations' : 'Resume Operations'}
                          >
                            <span className="text-base group-hover/btn:scale-125 transition-transform">{cinema.is_active ? '⏸' : '▶'}</span>
                          </button>
                          <button
                            onClick={() => handleDelete(cinema)}
                            className="w-11 h-11 flex items-center justify-center bg-red-500/10 border border-red-500/20 text-red-500 hover:bg-red-500 hover:text-white rounded-lg transition-all shadow-sm group/btn active:scale-90"
                            title="Dismantle Facility"
                          >
                            <span className="text-base group-hover/btn:scale-125 transition-transform">🗑️</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                    {expandedRow === cinema.id && (
                      <tr className="bg-surface-2 border-l-8 border-brand shadow-[inset_0_0_80px_rgba(0,0,0,0.4)] animate-in slide-in-from-top-4 duration-500">
                        <td colSpan="4" className="p-12">
                          <div className="flex flex-col xl:flex-row gap-12 items-start">
                            <div className="relative group/expanded flex-shrink-0">
                              <div className="absolute inset-0 bg-brand/10 blur-[80px] opacity-10" />
                              <div className="relative w-48 h-48 rounded-md bg-white border-2 border-border p-8 flex items-center justify-center overflow-hidden shadow-2xl transition-transform duration-700 group-hover/expanded:scale-105">
                                {cinema.logo_url ? (
                                  <img src={cinema.logo_url} alt="" className="w-full h-full object-contain" />
                                ) : (
                                  <span className="text-7xl font-black text-dark/20">{cinema.name.charAt(0)}</span>
                                )}
                              </div>
                            </div>
                            <div className="flex-1 space-y-8">
                              <div>
                                <div className="flex flex-wrap items-center gap-4 mb-3">
                                  <h3 className="text-4xl font-black text-text-primary tracking-tight">{cinema.name}</h3>
                                  <span className={`px-4 py-1.5 rounded-md border text-[10px] font-black uppercase tracking-widest ${getChainBadgeColor(cinema.chain)} shadow-lg`}>
                                    {cinema.chain} Infrastructure
                                  </span>
                                </div>
                                <p className="text-text-muted text-sm font-bold uppercase tracking-widest opacity-80 flex items-center gap-2">
                                  📍 {cinema.address || 'Lagos, Nigeria'}
                                </p>
                              </div>

                              <div className="bg-surface-3 border border-border rounded-md p-8 backdrop-blur-md relative overflow-hidden">
                                <div className="absolute top-0 right-0 p-4 opacity-5 text-4xl">INFO</div>
                                <p className="text-text-primary leading-relaxed text-sm opacity-90 font-medium">
                                  {cinema.description || 'System Audit: No localized description provided for this facility currently.'}
                                </p>
                              </div>
                              
                              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
                                <div className="space-y-2">
                                  <p className="text-[10px] font-black text-brand uppercase tracking-[0.3em]">Operational Status</p>
                                  <div className="flex items-center gap-3 bg-surface border border-border px-4 py-3 rounded-lg shadow-inner">
                                    <div className={`w-3 h-3 rounded-full ${cinema.is_active ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
                                    <p className="text-text-primary text-xs font-black uppercase tracking-widest">{cinema.is_active ? 'Actively Serving' : 'Offline'}</p>
                                  </div>
                                </div>
                                <div className="space-y-2">
                                  <p className="text-[10px] font-black text-brand uppercase tracking-[0.3em]">Scale / Capacity</p>
                                  <div className="flex items-center gap-3 bg-surface border border-border px-4 py-3 rounded-lg shadow-inner">
                                    <span className="text-lg opacity-40">🎬</span>
                                    <p className="text-text-primary text-xs font-black uppercase tracking-widest">
                                      {cinema.screens_count || '?' } screens • {cinema.seating_capacity || '?' } seats
                                    </p>
                                  </div>
                                </div>
                                <div className="space-y-2">
                                  <p className="text-[10px] font-black text-brand uppercase tracking-[0.3em]">Booking Portal</p>
                                  {cinema.website ? (
                                    <a href={cinema.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 bg-brand/10 border border-brand/20 px-4 py-3 rounded-lg text-brand hover:bg-brand hover:text-white transition-all shadow-lg active:scale-95">
                                      <span className="text-xs font-black uppercase tracking-widest">Launch Platform</span>
                                      <span className="text-sm">↗</span>
                                    </a>
                                  ) : (
                                    <div className="px-4 py-3 bg-surface-3 border border-border rounded-lg text-text-muted text-xs font-black uppercase tracking-widest italic opacity-50">No Link</div>
                                  )}
                                </div>
                                <div className="space-y-2">
                                  <p className="text-[10px] font-black text-brand uppercase tracking-[0.3em]">Navigational data</p>
                                  {cinema.google_maps_url ? (
                                    <a href={cinema.google_maps_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 bg-red-500/10 border border-red-500/20 px-4 py-3 rounded-lg text-red-500 hover:bg-red-500 hover:text-white transition-all shadow-lg active:scale-95">
                                      <span className="text-xs font-black uppercase tracking-widest">Map Coordinates</span>
                                      <span className="text-sm">📍</span>
                                    </a>
                                  ) : (
                                    <div className="px-4 py-3 bg-surface-3 border border-border rounded-lg text-text-muted text-xs font-black uppercase tracking-widest italic opacity-50">Undiscovered</div>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add/Edit Drawer */}
      <Drawer
        isOpen={isDrawerOpen}
        onClose={handleCloseDrawer}
        title={editingCinema ? 'Refine Facility Config' : 'Initialize New Facility'}
        width="600px"
      >
        <form onSubmit={handleSubmit} className="space-y-10 pb-24 px-2">
          {/* Section: Basic Info */}
          <div className="space-y-6">
            <div className="flex items-center gap-4 mb-4">
               <div className="h-px bg-border flex-1" />
               <h4 className="text-[10px] font-black text-brand uppercase tracking-[0.4em] italic">Infrastructure Matrix</h4>
               <div className="h-px bg-border flex-1" />
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="md:col-span-2">
                <label className="block text-[10px] font-black text-text-muted uppercase tracking-widest mb-2.5 px-1">Cinema Facility Name *</label>
                <input
                  required
                  type="text"
                  name="name"
                  placeholder="e.g. Filmhouse IMAX Lekki"
                  value={formData.name}
                  onChange={handleChange}
                  className="w-full h-12 bg-surface-2 border border-border rounded-lg px-5 text-text-primary text-sm focus:border-brand focus:outline-none transition-all shadow-inner"
                />
              </div>
              <div>
                <label className="block text-[10px] font-black text-text-muted uppercase tracking-widest mb-2.5 px-1">Network Chain *</label>
                <select
                  required
                  name="chain"
                  value={formData.chain}
                  onChange={handleChange}
                  className="w-full h-12 bg-surface-2 border border-border rounded-lg px-5 text-text-primary text-sm focus:border-brand focus:outline-none appearance-none cursor-pointer"
                >
                  <option value="">Select Protocol</option>
                  {chains.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-1 gap-6">
                <div>
                   <label className="block text-[10px] font-black text-text-muted uppercase tracking-widest mb-2.5 px-1">Region Hub *</label>
                   <input
                    required
                    type="text"
                    name="city"
                    placeholder="Lagos"
                    value={formData.city}
                    onChange={handleChange}
                    className="w-full h-12 bg-surface-2 border border-border rounded-lg px-5 text-text-primary text-sm focus:border-brand focus:outline-none transition-all shadow-inner"
                  />
                </div>
              </div>
              <div className="md:col-span-2">
                <label className="block text-[10px] font-black text-text-muted uppercase tracking-widest mb-2.5 px-1">Geographic State *</label>
                <input
                  required
                  type="text"
                  name="state"
                  placeholder="Lagos State"
                  value={formData.state}
                  onChange={handleChange}
                  className="w-full h-12 bg-surface-2 border border-border rounded-lg px-5 text-text-primary text-sm focus:border-brand focus:outline-none transition-all shadow-inner"
                />
              </div>
            </div>
            
            <div>
              <label className="block text-[10px] font-black text-text-muted uppercase tracking-widest mb-2.5 px-1">Physical Address Registry</label>
              <textarea
                name="address"
                rows="3"
                placeholder="No. 1 Bisway Street, Maroko, Lekki Phase 1..."
                value={formData.address}
                onChange={handleChange}
                className="w-full bg-surface-2 border border-border rounded-lg px-5 py-4 text-text-primary text-sm focus:border-brand focus:outline-none transition-all min-h-[100px] shadow-inner"
              />
            </div>
          </div>

          {/* Section: Identity */}
          <div className="space-y-6">
            <div className="flex items-center gap-4 mb-4">
               <div className="h-px bg-border flex-1" />
               <h4 className="text-[10px] font-black text-blue-400 uppercase tracking-[0.4em] italic">Identity & Branding</h4>
               <div className="h-px bg-border flex-1" />
            </div>
            
            <div className="flex flex-col sm:flex-row items-center gap-8 bg-surface-3 p-6 rounded-md border border-border shadow-inner">
              <div className="relative group/upload cursor-pointer">
                <div className="w-32 h-32 rounded-md bg-white border border-border flex items-center justify-center overflow-hidden flex-shrink-0 shadow-2xl transition-all group-hover/upload:scale-105">
                  {formData.logo_url ? (
                    <img src={formData.logo_url} alt="Preview" className="w-full h-full object-contain" />
                  ) : (
                    <span className="text-brand/10 text-6xl font-black rotate-12 group-hover/upload:rotate-0 transition-transform">?</span>
                  )}
                </div>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleLogoUpload}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                />
              </div>
              <div className="flex-1 text-center sm:text-left">
                <p className="text-text-primary text-sm font-black mb-1 uppercase tracking-widest">Asset Repository</p>
                <p className="text-[10px] text-text-muted uppercase font-bold tracking-widest mb-4">PNG, JPG or SVG — Max 1MB Payload</p>
                {formData.logo_url && (
                   <button 
                    type="button" 
                    onClick={() => setFormData(prev => ({ ...prev, logo_url: '' }))}
                    className="px-4 py-2 bg-red-500/10 text-red-500 text-[10px] font-black uppercase tracking-widest rounded-md hover:bg-red-500 hover:text-white transition-all shadow-md group"
                  >
                    🗑️ Flush Asset
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Section: Desc */}
          <div className="space-y-4">
             <label className="block text-[10px] font-black text-text-muted uppercase tracking-widest mb-2.5 px-1">Atmospheric Bio</label>
             <textarea
                name="description"
                rows="4"
                placeholder="Primary characteristic traits of this cinema hub..."
                value={formData.description}
                onChange={handleChange}
                className="w-full bg-surface-2 border border-border rounded-lg px-5 py-4 text-text-primary text-sm focus:border-brand focus:outline-none transition-all shadow-inner"
              />
          </div>

          {/* Section: Capacity */}
          <div className="space-y-6">
            <div className="flex items-center gap-4 mb-4">
               <div className="h-px bg-border flex-1" />
               <h4 className="text-[10px] font-black text-green-400 font-black uppercase tracking-[0.4em] italic">Capacity & Specs</h4>
               <div className="h-px bg-border flex-1" />
            </div>
            <div className="grid grid-cols-2 gap-6">
              <div>
                <label className="block text-[10px] font-black text-text-muted uppercase tracking-widest mb-2.5 px-1">Available Screens</label>
                <input
                  type="number"
                  name="screens_count"
                  value={formData.screens_count}
                  onChange={handleChange}
                  placeholder="0"
                  className="w-full h-12 bg-surface-2 border border-border rounded-lg px-5 text-text-primary text-sm focus:border-brand focus:outline-none transition-all shadow-inner"
                />
              </div>
              <div>
                <label className="block text-[10px] font-black text-text-muted uppercase tracking-widest mb-2.5 px-1">Seat Threshold</label>
                <input
                  type="number"
                  name="seating_capacity"
                  value={formData.seating_capacity}
                  onChange={handleChange}
                  placeholder="0"
                  className="w-full h-12 bg-surface-2 border border-border rounded-lg px-5 text-text-primary text-sm focus:border-brand focus:outline-none transition-all shadow-inner"
                />
              </div>
            </div>
          </div>

          {/* Section: Status */}
          <div className="pt-8 border-t border-border">
            <label className="flex items-center gap-6 cursor-pointer group p-6 bg-surface-2/50 rounded-md border border-border/50 hover:bg-surface-2 transition-all shadow-sm">
              <div className="relative">
                <input
                  type="checkbox"
                  name="is_active"
                  checked={formData.is_active}
                  onChange={handleChange}
                  className="sr-only"
                />
                <div className={`w-14 h-8 rounded-full transition-all duration-300 ${formData.is_active ? 'bg-green-500 shadow-[0_0_15px_rgba(34,197,94,0.4)]' : 'bg-surface-3'}`} />
                <div className={`absolute top-1.5 left-1.5 w-5 h-5 bg-white rounded-full transition-transform duration-300 flex items-center justify-center ${formData.is_active ? 'translate-x-6' : 'translate-x-0'}`}>
                   <div className={`w-1.5 h-1.5 rounded-full ${formData.is_active ? 'bg-green-500' : 'bg-text-muted'}`} />
                </div>
              </div>
              <div className="flex-1">
                <span className="text-sm font-black text-text-primary group-hover:text-brand transition-colors uppercase tracking-widest italic">Facility Operational State</span>
                <p className="text-[9px] text-text-muted font-black uppercase tracking-widest mt-1 opacity-60 group-hover:opacity-100 transition-opacity">Inactive hubs are decoupled from showtime processing pipelines.</p>
              </div>
            </label>
          </div>

          {/* Action Footer */}
          <div className="sticky bottom-0 bg-surface border-t border-border pt-8 mt-12 pb-2 shadow-[0_-20px_40px_rgba(0,0,0,0.4)] z-20 -mx-2 px-2">
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-5 bg-brand text-white font-black rounded-lg text-xs uppercase tracking-[0.2em] shadow-2xl shadow-brand/20 hover:scale-[1.02] active:scale-95 transition-all duration-300 disabled:opacity-50"
            >
              {isSubmitting ? 'Processing Sync...' : editingCinema ? 'Synchronize Record' : 'Initialize Command'}
            </button>
            <button
              type="button"
              onClick={handleCloseDrawer}
              className="w-full py-4 mt-2 text-[10px] font-black text-text-muted hover:text-text-primary transition-colors uppercase tracking-[0.2em]"
            >
              Terminate Session
            </button>
          </div>
        </form>
      </Drawer>
    </div>
  );
}
