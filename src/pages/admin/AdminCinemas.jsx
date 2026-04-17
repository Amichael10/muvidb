import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { toast } from 'react-hot-toast';
import Drawer from '../../components/admin/Drawer';

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
      case 'Filmhouse': return 'bg-gold/20 text-gold border-gold/30';
      case 'Genesis': return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      case 'Silverbird': return 'bg-purple-500/20 text-purple-400 border-purple-500/30';
      case 'Ozone': return 'bg-green-500/20 text-green-400 border-green-500/30';
      case 'Blu Star': return 'bg-orange-500/20 text-orange-400 border-orange-500/30';
      case 'Kada': return 'bg-teal-500/20 text-teal-400 border-teal-500/30';
      default: return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-surface p-6 rounded-2xl border border-border">
        <div>
          <h2 className="text-2xl font-bold text-text-primary flex items-center gap-3">
            Cinemas
            <span className="px-2.5 py-0.5 rounded-full bg-surface-2 border border-border text-xs font-semibold text-text-muted">
              {filteredCinemas.length} Total
            </span>
          </h2>
          <p className="text-text-muted mt-1 text-sm tracking-tight">Manage theater locations and chains</p>
        </div>
        <button
          onClick={() => handleOpenDrawer()}
          className="flex items-center justify-center gap-2 px-6 py-3 bg-gold hover:bg-gold/90 text-dark font-bold rounded-xl transition-all shadow-[0_8px_20px_-6px_rgba(212,160,23,0.4)] active:scale-95"
        >
          <span className="text-xl leading-none">+</span>
          Add Cinema
        </button>
      </div>

      {/* Filter Bar */}
      <div className="bg-surface p-4 rounded-2xl border border-border flex flex-col lg:flex-row gap-4 items-center">
        <div className="relative flex-1 w-full">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted">🔍</span>
          <input
            type="text"
            placeholder="Search by name or city..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-11 pr-4 py-2.5 bg-surface-2 border border-border rounded-xl text-sm focus:outline-none focus:border-gold transition-colors"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
          <select
            value={filters.chain}
            onChange={(e) => setFilters(prev => ({ ...prev, chain: e.target.value }))}
            className="px-4 py-2 bg-surface-2 border border-border rounded-xl text-sm focus:outline-none focus:border-gold transition-colors text-text-primary"
          >
            <option value="All">All Chains</option>
            {chains.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <select
            value={filters.city}
            onChange={(e) => setFilters(prev => ({ ...prev, city: e.target.value }))}
            className="px-4 py-2 bg-surface-2 border border-border rounded-xl text-sm focus:outline-none focus:border-gold transition-colors text-text-primary"
          >
            <option value="All">All Cities</option>
            {cities.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <select
            value={filters.status}
            onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
            className="px-4 py-2 bg-surface-2 border border-border rounded-xl text-sm focus:outline-none focus:border-gold transition-colors text-text-primary"
          >
            <option value="All">All Status</option>
            <option value="Active">Active</option>
            <option value="Inactive">Inactive</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-surface rounded-2xl border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-surface-2 border-b border-border text-text-muted uppercase text-[10px] font-black tracking-widest">
                <th className="px-6 py-4">Cinema</th>
                <th className="px-6 py-4">Chain</th>
                <th className="px-6 py-4">Location</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {loading ? (
                <tr>
                  <td colSpan="5" className="px-6 py-12 text-center text-text-muted">Loading cinemas...</td>
                </tr>
              ) : filteredCinemas.length === 0 ? (
                <tr>
                  <td colSpan="5" className="px-6 py-12 text-center text-text-muted">No cinemas found</td>
                </tr>
              ) : (
                filteredCinemas.map((cinema) => (
                  <React.Fragment key={cinema.id}>
                    <tr 
                      className={`hover:bg-surface-2 transition-colors cursor-pointer group ${expandedRow === cinema.id ? 'bg-surface-2' : ''}`}
                      onClick={() => setExpandedRow(expandedRow === cinema.id ? null : cinema.id)}
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 rounded-xl bg-white p-1 flex items-center justify-center overflow-hidden border border-border flex-shrink-0 shadow-sm">
                            {cinema.logo_url ? (
                              <img src={cinema.logo_url} alt={cinema.name} className="w-full h-full object-contain" />
                            ) : (
                              <div className={`w-full h-full rounded-lg flex items-center justify-center text-xl font-bold bg-gold/10 text-gold`}>
                                {cinema.chain.charAt(0)}
                              </div>
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="font-bold text-text-primary text-base truncate">{cinema.name}</p>
                            <p className="text-xs text-text-muted truncate">{cinema.address || 'No address set'}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2.5 py-1 rounded-lg border text-xs font-semibold ${getChainBadgeColor(cinema.chain)}`}>
                          {cinema.chain}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-text-primary font-medium">{cinema.city}</p>
                        <p className="text-xs text-text-muted">{cinema.state}</p>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold ${cinema.is_active ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'}`}>
                          {cinema.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2 md:opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenDrawer(cinema);
                            }}
                            className="p-2 text-text-muted hover:text-gold rounded-lg hover:bg-surface transition-all"
                            title="Edit"
                          >
                            ✏️
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleActive(cinema);
                            }}
                            className={`p-2 rounded-lg hover:bg-surface transition-all ${cinema.is_active ? 'text-text-muted hover:text-red-500' : 'text-text-muted hover:text-green-500'}`}
                            title={cinema.is_active ? 'Deactivate' : 'Activate'}
                          >
                            {cinema.is_active ? '⏸️' : '▶️'}
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDelete(cinema);
                            }}
                            className="p-2 text-text-muted hover:text-red-500 rounded-lg hover:bg-surface transition-all"
                            title="Delete"
                          >
                            🗑️
                          </button>
                        </div>
                      </td>
                    </tr>
                    {expandedRow === cinema.id && (
                      <tr className="bg-[#0D1326] border-l-4 border-gold">
                        <td colSpan="5" className="p-8">
                          <div className="flex flex-col md:flex-row gap-8 items-start animate-fade-in">
                            <div className="w-32 h-32 rounded-2xl bg-white p-4 flex items-center justify-center overflow-hidden border border-border shadow-xl flex-shrink-0">
                              {cinema.logo_url ? (
                                <img src={cinema.logo_url} alt={cinema.name} className="w-full h-full object-contain" />
                              ) : (
                                <span className="text-4xl font-bold text-dark">{cinema.name.charAt(0)}</span>
                              )}
                            </div>
                            <div className="flex-1 space-y-4">
                              <div className="flex items-center gap-3">
                                <h3 className="text-2xl font-bold text-text-primary">{cinema.name}</h3>
                                <span className={`px-3 py-1 rounded-lg border text-sm font-semibold ${getChainBadgeColor(cinema.chain)}`}>
                                  {cinema.chain}
                                </span>
                              </div>
                              <p className="text-text-muted leading-relaxed max-w-2xl">{cinema.description || 'No description provided.'}</p>
                              
                              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 pt-4">
                                <div>
                                  <p className="text-xs font-bold text-text-muted uppercase tracking-widest mb-1">Full Address</p>
                                  <p className="text-text-primary text-sm font-medium">{cinema.address || 'N/A'}, {cinema.city}, {cinema.state}</p>
                                </div>
                                {(cinema.screens_count || cinema.seating_capacity) && (
                                  <div>
                                    <p className="text-xs font-bold text-text-muted uppercase tracking-widest mb-1">Capacity</p>
                                    <p className="text-text-primary text-sm font-medium">
                                      {cinema.screens_count ? `${cinema.screens_count} Screens` : ''} 
                                      {cinema.screens_count && cinema.seating_capacity ? ' • ' : ''}
                                      {cinema.seating_capacity ? `${cinema.seating_capacity} Seats` : ''}
                                    </p>
                                  </div>
                                )}
                                {cinema.website && (
                                  <div>
                                    <p className="text-xs font-bold text-text-muted uppercase tracking-widest mb-1">Website</p>
                                    <a href={cinema.website} target="_blank" rel="noopener noreferrer" className="text-gold hover:underline text-sm font-semibold inline-flex items-center gap-1.5">
                                      Visit Website ↗
                                    </a>
                                  </div>
                                )}
                                {cinema.google_maps_url && (
                                  <div>
                                    <p className="text-xs font-bold text-text-muted uppercase tracking-widest mb-1">Navigation</p>
                                    <a href={cinema.google_maps_url} target="_blank" rel="noopener noreferrer" className="text-gold hover:underline text-sm font-semibold inline-flex items-center gap-1.5">
                                      📍 Get Directions
                                    </a>
                                  </div>
                                )}
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
        title={editingCinema ? 'Edit Cinema Location' : 'Save New Cinema Location'}
        width="540px"
      >
        <form onSubmit={handleSubmit} className="space-y-8 pb-20">
          {/* Basic Info */}
          <div className="space-y-4">
            <h4 className="text-xs font-black text-gold uppercase tracking-[0.2em] mb-2">Basic Information</h4>
            <div>
              <label className="block text-sm text-text-muted mb-1.5 font-medium">Cinema Name *</label>
              <input
                required
                type="text"
                name="name"
                placeholder="e.g. Filmhouse IMAX Lekki"
                value={formData.name}
                onChange={handleChange}
                className="w-full bg-surface-2 border border-border rounded-xl px-4 py-2.5 text-text-primary focus:outline-none focus:border-gold transition-colors"
              />
            </div>
            <div>
              <label className="block text-sm text-text-muted mb-1.5 font-medium">Chain *</label>
              <select
                required
                name="chain"
                value={formData.chain}
                onChange={handleChange}
                className="w-full bg-surface-2 border border-border rounded-xl px-4 py-2.5 text-text-primary focus:outline-none focus:border-gold transition-colors"
              >
                <option value="">Select Chain</option>
                {chains.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-text-muted mb-1.5 font-medium">City *</label>
                <input
                  required
                  type="text"
                  name="city"
                  placeholder="Lagos"
                  value={formData.city}
                  onChange={handleChange}
                  className="w-full bg-surface-2 border border-border rounded-xl px-4 py-2.5 text-text-primary focus:outline-none focus:border-gold transition-colors"
                />
              </div>
              <div>
                <label className="block text-sm text-text-muted mb-1.5 font-medium">State *</label>
                <input
                  required
                  type="text"
                  name="state"
                  placeholder="Lagos State"
                  value={formData.state}
                  onChange={handleChange}
                  className="w-full bg-surface-2 border border-border rounded-xl px-4 py-2.5 text-text-primary focus:outline-none focus:border-gold transition-colors"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm text-text-muted mb-1.5 font-medium">Full Address</label>
              <textarea
                name="address"
                rows="2"
                placeholder="No. 1 Bisway Street, Maroko, Lekki"
                value={formData.address}
                onChange={handleChange}
                className="w-full bg-surface-2 border border-border rounded-xl px-4 py-2.5 text-text-primary focus:outline-none focus:border-gold transition-colors resize-none"
              />
            </div>
          </div>

          {/* Logo Upload */}
          <div className="space-y-4">
            <h4 className="text-xs font-black text-gold uppercase tracking-[0.2em] mb-2">Identity & Branding</h4>
            <div className="flex items-start gap-6">
              <div className="w-24 h-24 rounded-2xl bg-white border border-border flex items-center justify-center overflow-hidden flex-shrink-0 shadow-inner">
                {formData.logo_url ? (
                  <img src={formData.logo_url} alt="Preview" className="w-full h-full object-contain" />
                ) : (
                  <span className="text-gold/10 text-5xl font-black">?</span>
                )}
              </div>
              <div className="flex-1">
                <div className="relative group">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleLogoUpload}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                  />
                  <div className="w-full border-2 border-dashed border-border rounded-xl px-4 py-5 text-center group-hover:border-gold transition-colors">
                    <p className="text-sm font-bold text-text-muted group-hover:text-gold transition-colors">Click to upload cinema logo</p>
                    <p className="text-[10px] text-text-muted/60 mt-1 uppercase font-black tracking-widest">PNG, JPG or SVG — Max 1MB</p>
                  </div>
                </div>
                {formData.logo_url && (
                  <button 
                    type="button" 
                    onClick={() => setFormData(prev => ({ ...prev, logo_url: '' }))}
                    className="mt-3 text-xs font-black text-red-500 hover:text-red-400 flex items-center gap-2 transition-colors uppercase tracking-wider"
                  >
                    🗑️ Remove Logo
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* About */}
          <div className="space-y-4">
            <h4 className="text-xs font-black text-gold uppercase tracking-[0.2em] mb-2">Location Description</h4>
            <div>
              <textarea
                name="description"
                rows="3"
                placeholder="About this cinema location..."
                value={formData.description}
                onChange={handleChange}
                className="w-full bg-surface-2 border border-border rounded-xl px-4 py-2.5 text-text-primary focus:outline-none focus:border-gold transition-colors resize-none"
              />
            </div>
          </div>

          {/* Links */}
          <div className="space-y-4">
            <h4 className="text-xs font-black text-gold uppercase tracking-[0.2em] mb-2">Booking & Navigation</h4>
            <div>
              <label className="block text-sm text-text-muted mb-1.5 font-medium">Official Website</label>
              <input
                type="url"
                name="website"
                placeholder="https://filmhousecinemas.com"
                value={formData.website}
                onChange={handleChange}
                className="w-full bg-surface-2 border border-border rounded-xl px-4 py-2.5 text-text-primary focus:outline-none focus:border-gold transition-colors"
              />
            </div>
            <div>
              <label className="block text-sm text-text-muted mb-1.5 font-medium">Google Maps URL</label>
              <input
                type="url"
                name="google_maps_url"
                placeholder="https://maps.google.com/..."
                value={formData.google_maps_url}
                onChange={handleChange}
                className="w-full bg-surface-2 border border-border rounded-xl px-4 py-2.5 text-text-primary focus:outline-none focus:border-gold transition-colors"
              />
            </div>
          </div>

          {/* Capacity */}
          <div className="space-y-4">
            <h4 className="text-xs font-black text-gold uppercase tracking-[0.2em] mb-2">Technical Specs</h4>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-text-muted mb-1.5 font-medium">Screens Count</label>
                <input
                  type="number"
                  name="screens_count"
                  value={formData.screens_count}
                  onChange={handleChange}
                  className="w-full bg-surface-2 border border-border rounded-xl px-4 py-2.5 text-text-primary focus:outline-none focus:border-gold transition-colors"
                />
              </div>
              <div>
                <label className="block text-sm text-text-muted mb-1.5 font-medium">Seating Capacity</label>
                <input
                  type="number"
                  name="seating_capacity"
                  value={formData.seating_capacity}
                  onChange={handleChange}
                  className="w-full bg-surface-2 border border-border rounded-xl px-4 py-2.5 text-text-primary focus:outline-none focus:border-gold transition-colors"
                />
              </div>
            </div>
          </div>

          {/* Settings */}
          <div className="space-y-4 pt-6 border-t border-border">
            <label className="flex items-center gap-4 cursor-pointer group p-3 bg-surface-2 rounded-2xl border border-border/50">
              <div className="relative">
                <input
                  type="checkbox"
                  name="is_active"
                  checked={formData.is_active}
                  onChange={handleChange}
                  className="sr-only"
                />
                <div className={`w-12 h-6 rounded-full transition-colors ${formData.is_active ? 'bg-gold' : 'bg-border'}`} />
                <div className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform duration-200 ${formData.is_active ? 'translate-x-6' : 'translate-x-0'}`} />
              </div>
              <div>
                <span className="text-sm font-black text-text-primary group-hover:text-gold transition-colors italic">CINEMA IS ACTIVE</span>
                <p className="text-[10px] text-text-muted/60 font-black uppercase tracking-wider mt-0.5">Inactive theaters won't appear in showtime selections.</p>
              </div>
            </label>
          </div>

          <div className="sticky bottom-0 pt-6 mt-12 bg-[#13192B] border-t border-border -mx-6 px-6 pb-6 shadow-[0_-12px_30px_rgba(0,0,0,0.5)] z-20">
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-4 bg-gold hover:bg-gold/90 text-dark font-black rounded-2xl transition-all shadow-[0_12px_24px_-8px_rgba(212,160,23,0.6)] active:scale-[0.98] disabled:opacity-50 uppercase tracking-widest text-sm"
            >
              {isSubmitting ? 'PROCESSING DATA...' : editingCinema ? 'UPDATE CINEMA LOCATION' : 'SAVE NEW CINEMA LOCATION'}
            </button>
            <button
              type="button"
              onClick={handleCloseDrawer}
              className="w-full py-3 mt-2 text-xs font-black text-text-muted hover:text-text-primary transition-colors italic uppercase tracking-widest"
            >
              Cancel and Discard Changes
            </button>
          </div>
        </form>
      </Drawer>
    </div>
  );
}
