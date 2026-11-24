import { useState, useEffect, useRef, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import { toast } from 'react-hot-toast';
import { Icon } from '@iconify/react';
import Drawer from '../../components/admin/Drawer';
import ConfirmModal from '../../components/admin/ConfirmModal';
import SkeletonRow from '../../components/admin/SkeletonRow';
import { useAuth } from '../../context/AuthContext';
import { logAdminAction } from '../../lib/adminLogger';
import { toTitleCase, toSentenceCase } from '../../utils/format';
import { uploadAdminImage } from '../../lib/imageUpload';
import {
  getCampaigns,
  updateCampaign,
  toggleCampaign,
  deleteCampaign,
  saveCampaigns,
} from '../../lib/adSettings';

export default function AdminCompanies() {
  const { user } = useAuth();
  const [companies, setCompanies] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeTab, setTypeTab] = useState('all'); // all | production | academy | agency | distribution
  const [logoFilter, setLogoFilter] = useState('all'); // all | has | missing
  const [websiteFilter, setWebsiteFilter] = useState('all'); // all | has | missing
  const [sortBy, setSortBy] = useState('az'); // az | za | founded_new | founded_old | newest
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 25;

  // Modals/Drawers state
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [editingCompany, setEditingCompany] = useState(null);
  const [deletingCompany, setDeletingCompany] = useState(null);

  // Logo upload state
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [isDraggingLogo, setIsDraggingLogo] = useState(false);
  const fileInputRef = useRef(null);

  // Merge state: ids of selected duplicates + the chosen primary for confirmation
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [mergePlan, setMergePlan] = useState(null); // { primary, duplicates: [...] }
  const [isMerging, setIsMerging] = useState(false);

  // Campaigns & Ad Manager State
  const [campaigns, setCampaigns] = useState(getCampaigns);
  const [isAdDrawerOpen, setIsAdDrawerOpen] = useState(false);
  const [editingAd, setEditingAd] = useState(null);
  const [adFormData, setAdFormData] = useState({
    id: '',
    title: '',
    eyebrow: '',
    badge: '',
    description: '',
    ctaText: 'Apply Now',
    ctaUrl: '',
    mediaType: 'image',
    mediaUrl: '',
    format: 'rectangle',
    location: 'Lagos, Nigeria',
    tags: '',
  });

  const handleToggleCampaign = (id, currentStatus) => {
    const updated = toggleCampaign(id, !currentStatus);
    setCampaigns(updated);
    toast.success(`Campaign ${!currentStatus ? 'activated' : 'paused'} on homepage`);
  };

  const openAddAdModal = () => {
    setEditingAd(null);
    setAdFormData({
      id: `ad-${Date.now()}`,
      title: '',
      eyebrow: 'Sponsored Campaign',
      badge: 'Open Now',
      description: '',
      ctaText: 'Learn More',
      ctaUrl: '',
      mediaType: 'image',
      mediaUrl: '',
      format: 'rectangle',
      location: 'Lagos, Nigeria',
      tags: 'Directing, Production, Acting',
    });
    setIsAdDrawerOpen(true);
  };

  const openEditAdModal = (camp) => {
    setEditingAd(camp);
    setAdFormData({
      id: camp.id,
      title: camp.title || '',
      eyebrow: camp.eyebrow || '',
      badge: camp.badge || '',
      description: camp.description || '',
      ctaText: camp.ctaText || 'Learn More',
      ctaUrl: camp.ctaUrl || '',
      mediaType: camp.mediaType || 'image',
      mediaUrl: camp.mediaUrl || camp.posterUrl || '',
      format: camp.format || 'rectangle',
      location: camp.location || '',
      tags: Array.isArray(camp.tags) ? camp.tags.join(', ') : (camp.tags || ''),
    });
    setIsAdDrawerOpen(true);
  };

  const handleSaveAd = (e) => {
    e.preventDefault();
    if (!adFormData.title.trim() || !adFormData.ctaUrl.trim()) {
      toast.error('Title and Destination URL are required');
      return;
    }
    const tagsArray = adFormData.tags
      ? adFormData.tags.split(',').map((t) => t.trim()).filter(Boolean)
      : [];

    const payload = {
      ...adFormData,
      tags: tagsArray,
      isActive: editingAd ? editingAd.isActive : true,
    };
    const updated = updateCampaign(payload);
    setCampaigns(updated);
    toast.success(editingAd ? 'Campaign updated' : 'Campaign created');
    setIsAdDrawerOpen(false);
  };

  const handleDeleteAd = (id) => {
    if (!confirm('Delete this sponsored ad campaign?')) return;
    const updated = deleteCampaign(id);
    setCampaigns(updated);
    toast.success('Campaign removed');
  };

  const findPotentialDuplicates = () => {
    const nameMap = new Map();
    const dupes = new Set();
    companies.forEach((c) => {
      const norm = (c.name || '')
        .toLowerCase()
        .replace(/^(the|a)\s+/, '')
        .replace(/\b(studios?|productions?|pictures?|films?|entertainment|media|ltd|limited|group)\b/g, '')
        .replace(/[^a-z0-9]/g, '');
      if (!norm || norm.length < 3) return;
      if (nameMap.has(norm)) {
        dupes.add(c.id);
        dupes.add(nameMap.get(norm));
      } else {
        nameMap.set(norm, c.id);
      }
    });
    if (dupes.size === 0) {
      toast.info('No potential duplicate company names detected.');
    } else {
      setSelectedIds(dupes);
      toast.success(`Found and selected ${dupes.size} potential duplicate companies for deduplication review!`);
    }
  };

  const toggleSelect = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const q = search.trim().toLowerCase();
  const filteredCompanies = useMemo(() => {
    return companies
      .filter((c) => {
        if (q && !(c.name || '').toLowerCase().includes(q) && !(c.description || '').toLowerCase().includes(q)) {
          return false;
        }
        if (typeTab !== 'all') {
          const type = (c.company_type || '').toLowerCase();
          const name = (c.name || '').toLowerCase();
          if (typeTab === 'academy') {
            if (!type.includes('academy') && !type.includes('institute') && !name.includes('academy') && !name.includes('institute')) {
              return false;
            }
          } else if (typeTab === 'agency') {
            if (!type.includes('agency') && !type.includes('management') && !name.includes('agency')) {
              return false;
            }
          } else if (typeTab === 'distribution') {
            if (!type.includes('distribut') && !name.includes('distribut')) {
              return false;
            }
          } else if (typeTab === 'production') {
            if (type.includes('academy') || type.includes('agency')) return false;
          }
        }
        if (logoFilter === 'has' && !c.logo_url) return false;
        if (logoFilter === 'missing' && c.logo_url) return false;
        if (websiteFilter === 'has' && !c.website) return false;
        if (websiteFilter === 'missing' && c.website) return false;
        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'za') return (b.name || '').localeCompare(a.name || '');
        if (sortBy === 'founded_new') return (b.founded_year || 0) - (a.founded_year || 0);
        if (sortBy === 'founded_old') return (a.founded_year || 9999) - (b.founded_year || 9999);
        if (sortBy === 'newest') return new Date(b.created_at || 0) - new Date(a.created_at || 0);
        return (a.name || '').localeCompare(b.name || '');
      });
  }, [companies, q, typeTab, logoFilter, websiteFilter, sortBy]);

  const totalPages = Math.ceil(filteredCompanies.length / pageSize) || 1;
  const paginatedCompanies = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredCompanies.slice(start, start + pageSize);
  }, [filteredCompanies, currentPage, pageSize]);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, typeTab, logoFilter, websiteFilter, sortBy]);

  const selectedCompanies = companies.filter((c) => selectedIds.has(c.id));

  const toggleSelectAllFiltered = () => {
    const allSelected = filteredCompanies.length > 0 && filteredCompanies.every((c) => selectedIds.has(c.id));
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allSelected) {
        filteredCompanies.forEach((c) => next.delete(c.id));
      } else {
        filteredCompanies.forEach((c) => next.add(c.id));
      }
      return next;
    });
  };

  // Default the survivor to the richest record so films aren't lost visually.
  const openMerge = () => {
    if (selectedCompanies.length < 2) return;
    const primary = [...selectedCompanies].sort(
      (a, b) =>
        (b.tmdb_id ? 1 : 0) - (a.tmdb_id ? 1 : 0) ||
        (b.logo_url ? 1 : 0) - (a.logo_url ? 1 : 0) ||
        new Date(a.created_at) - new Date(b.created_at),
    )[0];
    setMergePlan({ primary, duplicates: selectedCompanies.filter((c) => c.id !== primary.id) });
  };

  const confirmMerge = async () => {
    if (!mergePlan) return;
    setIsMerging(true);
    try {
      const { error } = await supabase.rpc('merge_companies_group', {
        p_master_id: mergePlan.primary.id,
        p_duplicate_ids: mergePlan.duplicates.map((c) => c.id),
        p_metadata: {},
      });
      if (error) throw error;
      await logAdminAction(user, 'merge', 'company', mergePlan.primary.id, mergePlan.primary.name, {
        absorbed: mergePlan.duplicates.map((c) => c.name),
      });
      toast.success(`Merged ${mergePlan.duplicates.length + 1} companies into "${mergePlan.primary.name}"`);
      setMergePlan(null);
      setSelectedIds(new Set());
      fetchCompanies();
    } catch (err) {
      console.error('Company merge failed:', err);
      toast.error(err.message || 'Merge failed');
    } finally {
      setIsMerging(false);
    }
  };

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    logo_url: '',
    website_url: '',
    founded_year: '',
    company_type: '',
    headquarters: '',
    instagram_url: '',
    contact_email: '',
    contact_phone: '',
    booking_url: '',
  });
  const [isSaving, setIsSaving] = useState(false);

  const fetchCompanies = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('companies')
        .select('*')
        .order('name');

      if (error) throw error;
      setCompanies(data || []);
    } catch (error) {
      console.error('Error fetching companies:', error);
      toast.error('Failed to load companies');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCompanies();
  }, []);

  const handleDelete = async () => {
    if (!deletingCompany) return;
    try {
      const { error } = await supabase
        .from('companies')
        .delete()
        .eq('id', deletingCompany.id);

      if (error) throw error;

      await logAdminAction(user, 'delete', 'company', deletingCompany.id, deletingCompany.name);

      setCompanies(companies.filter(c => c.id !== deletingCompany.id));
      toast.success('Company deleted');
      setDeletingCompany(null);
    } catch (error) {
      console.error('Error deleting company:', error);
      toast.error('Failed to delete company');
    }
  };

  const openAddDrawer = () => {
    setEditingCompany(null);
    setFormData({
      name: '',
      description: '',
      logo_url: '',
      website_url: '',
      founded_year: '',
      company_type: '',
      headquarters: '',
      instagram_url: '',
      contact_email: '',
      contact_phone: '',
      booking_url: '',
    });
    setIsDrawerOpen(true);
  };

  const openEditDrawer = (company) => {
    setEditingCompany(company);
    setFormData({
      name: company.name || '',
      description: company.description || '',
      logo_url: company.logo_url || '',
      website_url: company.website || '',
      founded_year: company.founded_year || '',
      company_type: company.company_type || '',
      headquarters: company.headquarters || '',
      instagram_url: company.instagram_url || '',
      contact_email: company.contact_email || '',
      contact_phone: company.contact_phone || '',
      booking_url: company.booking_url || '',
    });
    setIsDrawerOpen(true);
  };

  const handleLogoFile = async (file) => {
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      toast.error('Image size must be less than 10MB');
      return;
    }

    setIsUploadingLogo(true);
    const toastId = toast.loading('Uploading and optimizing logo…');
    try {
      const res = await uploadAdminImage(file, 'film-images');
      if (res.error) {
        toast.error(res.error, { id: toastId });
        return;
      }
      if (res.url) {
        setFormData((prev) => ({ ...prev, logo_url: res.url }));
        toast.success('Company logo uploaded successfully!', { id: toastId });
      }
    } catch (err) {
      console.error('Logo upload error:', err);
      toast.error(err.message || 'Failed to upload logo', { id: toastId });
    } finally {
      setIsUploadingLogo(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleFileInputChange = (e) => {
    const file = e.target.files?.[0];
    if (file) handleLogoFile(file);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDraggingLogo(false);
    const file = e.dataTransfer?.files?.[0];
    if (file) handleLogoFile(file);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const dataToSave = {
        name: toTitleCase(formData.name),
        description: formData.description ? toSentenceCase(formData.description) : null,
        logo_url: formData.logo_url || null,
        website: formData.website_url || null,
        founded_year: formData.founded_year ? parseInt(formData.founded_year, 10) : null,
        company_type: formData.company_type ? formData.company_type.trim() : null,
        headquarters: formData.headquarters ? formData.headquarters.trim() : null,
        instagram_url: formData.instagram_url ? formData.instagram_url.trim() : null,
        contact_email: formData.contact_email ? formData.contact_email.trim() : null,
        contact_phone: formData.contact_phone ? formData.contact_phone.trim() : null,
        booking_url: formData.booking_url ? formData.booking_url.trim() : null,
      };

      if (editingCompany) {
        const { error } = await supabase
          .from('companies')
          .update(dataToSave)
          .eq('id', editingCompany.id);
        if (error) throw error;
        await logAdminAction(user, 'update', 'company', editingCompany.id, dataToSave.name);
        toast.success('Company updated');
      } else {
        const { data, error } = await supabase
          .from('companies')
          .insert([dataToSave])
          .select();
        if (error) throw error;
        const newCompanyId = data?.[0]?.id;
        await logAdminAction(user, 'create', 'company', newCompanyId, dataToSave.name);
        toast.success('Company added');
      }
      setIsDrawerOpen(false);
      fetchCompanies();
    } catch (error) {
      console.error('Error saving company:', error);
      toast.error('Failed to save company');
    } finally {
      setIsSaving(false);
    }
  };

  const getInitials = (name) => {
    if (!name) return '?';
    return name.charAt(0).toUpperCase();
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <p className="text-brand text-xs font-bold mb-1">Database</p>
          <h1 className="text-3xl font-bold text-text-primary tracking-tight">Companies</h1>
          <p className="text-text-muted text-sm mt-1">
            {isLoading
              ? 'Loading…'
              : `${filteredCompanies.length} of ${companies.length} records`}
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <button
            type="button"
            onClick={findPotentialDuplicates}
            className="bg-surface-2 border border-border hover:border-amber-500/50 text-text-primary font-bold px-4 py-2.5 rounded-xl text-xs transition-all flex items-center gap-2 cursor-pointer"
            title="Scan database for companies sharing normalized names"
          >
            <Icon icon="solar:magnifer-bug-bold" className="text-amber-400 text-base" />
            <span>Find Duplicates</span>
          </button>

          {selectedIds.size >= 2 && (
            <button
              onClick={openMerge}
              className="bg-amber-500 hover:bg-amber-600 text-white font-bold px-5 py-2.5 rounded-xl text-xs hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center gap-2 shadow-md cursor-pointer"
            >
              <Icon icon="solar:posts-carousel-vertical-linear" className="w-4 h-4" />
              <span>Merge {selectedIds.size} Selected</span>
            </button>
          )}

          {selectedIds.size > 0 && (
            <button
              onClick={() => setSelectedIds(new Set())}
              className="text-text-muted hover:text-text-primary font-medium text-xs px-2 cursor-pointer"
            >
              Clear Selection
            </button>
          )}

          <button
            onClick={openAddDrawer}
            className="bg-brand text-black font-black px-6 py-2.5 rounded-xl text-xs hover:scale-[1.05] active:scale-[0.95] transition-all flex items-center gap-2 shadow-lg cursor-pointer"
          >
            <Icon icon="solar:plus-linear" className="text-lg" />
            <span>Add Company</span>
          </button>
        </div>
      </div>

      {/* ─── SPONSORED SCHOOL ADS & MONETIZATION CAMPAIGNS MANAGER ─── */}
      <div className="rounded-2xl border border-border/80 bg-surface/80 p-5 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border/70">
          <div>
            <span className="text-[10px] font-black uppercase tracking-widest text-brand">Marketing &amp; Monetization CMS</span>
            <h3 className="font-heading font-black text-base text-text-primary">Sponsored Homepage Campaigns &amp; School Ads</h3>
            <p className="text-xs text-text-muted mt-0.5">Configure institutional banners, video reels, format ratios, and links rotating live on the homepage</p>
          </div>
          <button
            type="button"
            onClick={openAddAdModal}
            className="px-4 py-2 rounded-xl bg-surface-2 border border-border hover:border-brand text-xs font-bold text-text-primary hover:text-brand inline-flex items-center gap-1.5 transition-colors cursor-pointer self-start sm:self-auto"
          >
            <Icon icon="solar:add-circle-bold" className="text-brand text-sm" />
            <span>New Ad Campaign</span>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {campaigns.map((camp) => (
            <div
              key={camp.id}
              className={`p-4 rounded-xl border flex flex-col justify-between gap-3.5 transition-all ${
                camp.isActive
                  ? 'border-brand/40 bg-surface shadow-xs'
                  : 'border-border/60 bg-surface-2/40 opacity-70'
              }`}
            >
              <div className="space-y-1.5 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-surface-2 border border-border text-brand truncate">
                    {camp.format?.toUpperCase() || 'RECTANGLE'}
                  </span>
                  <span className={`text-[10px] font-bold ${camp.isActive ? 'text-emerald-400' : 'text-text-muted'}`}>
                    {camp.isActive ? '● Live on Homepage' : '○ Paused'}
                  </span>
                </div>
                <h4 className="font-heading font-bold text-xs text-text-primary line-clamp-1">
                  {camp.title}
                </h4>
                <p className="text-[11px] text-text-muted line-clamp-2 leading-relaxed">
                  {camp.description}
                </p>
                <div className="pt-1 flex items-center gap-1.5 text-[10px] text-text-muted truncate">
                  <Icon icon="solar:link-bold" className="text-brand shrink-0" />
                  <span className="truncate">{camp.ctaUrl}</span>
                </div>
              </div>

              <div className="pt-2 border-t border-hairline flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => handleToggleCampaign(camp.id, camp.isActive)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                    camp.isActive
                      ? 'bg-brand/15 text-brand border border-brand/40 hover:bg-brand/25'
                      : 'bg-surface-2 text-text-muted border border-border hover:border-brand/40'
                  }`}
                >
                  <Icon icon={camp.isActive ? 'solar:eye-bold' : 'solar:eye-closed-bold'} className="w-3.5 h-3.5" />
                  <span>{camp.isActive ? 'Turn Off' : 'Turn On'}</span>
                </button>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => openEditAdModal(camp)}
                    className="p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-surface-2 transition-colors cursor-pointer"
                    title="Edit Campaign"
                  >
                    <Icon icon="solar:pen-new-square-linear" className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteAd(camp.id)}
                    className="p-1.5 rounded-lg text-text-muted hover:text-red-400 hover:bg-surface-2 transition-colors cursor-pointer"
                    title="Delete Campaign"
                  >
                    <Icon icon="solar:trash-bin-trash-linear" className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ─── COMPANY TYPE FILTER TABS & SEARCH BAR ─── */}
      <div className="space-y-4">
        {/* Type Filter Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar text-xs font-bold">
          <button
            type="button"
            onClick={() => setTypeTab('all')}
            className={`px-3.5 py-2 rounded-xl border transition-all shrink-0 cursor-pointer ${
              typeTab === 'all'
                ? 'bg-surface border-brand text-brand shadow-xs'
                : 'bg-surface/50 border-border text-text-muted hover:text-text-primary'
            }`}
          >
            All Companies ({companies.length})
          </button>
          <button
            type="button"
            onClick={() => setTypeTab('production')}
            className={`px-3.5 py-2 rounded-xl border transition-all shrink-0 cursor-pointer ${
              typeTab === 'production'
                ? 'bg-surface border-brand text-brand shadow-xs'
                : 'bg-surface/50 border-border text-text-muted hover:text-text-primary'
            }`}
          >
            Production Studios
          </button>
          <button
            type="button"
            onClick={() => setTypeTab('academy')}
            className={`px-3.5 py-2 rounded-xl border transition-all shrink-0 flex items-center gap-1.5 cursor-pointer ${
              typeTab === 'academy'
                ? 'bg-surface border-brand text-brand shadow-xs'
                : 'bg-surface/50 border-border text-text-muted hover:text-brand'
            }`}
          >
            <Icon icon="solar:diploma-bold" className="text-brand text-sm" />
            <span>Film Academies</span>
          </button>
          <button
            type="button"
            onClick={() => setTypeTab('agency')}
            className={`px-3.5 py-2 rounded-xl border transition-all shrink-0 cursor-pointer ${
              typeTab === 'agency'
                ? 'bg-surface border-brand text-brand shadow-xs'
                : 'bg-surface/50 border-border text-text-muted hover:text-text-primary'
            }`}
          >
            Talent Agencies
          </button>
          <button
            type="button"
            onClick={() => setTypeTab('distribution')}
            className={`px-3.5 py-2 rounded-xl border transition-all shrink-0 cursor-pointer ${
              typeTab === 'distribution'
                ? 'bg-surface border-brand text-brand shadow-xs'
                : 'bg-surface/50 border-border text-text-muted hover:text-text-primary'
            }`}
          >
            Theatrical Distributors
          </button>
        </div>

        {/* Search + secondary filters */}
        <div className="card-cal p-5">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="md:col-span-2 relative">
              <Icon
                icon="solar:magnifer-linear"
                className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted text-lg pointer-events-none"
              />
              <input
                type="search"
                placeholder="Search by company name, headquarters or description…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-surface-2 border border-border rounded-md pl-10 pr-4 py-2 text-sm text-text-primary outline-none focus:border-brand transition-colors"
              />
            </div>
            <select
              value={logoFilter}
              onChange={(e) => setLogoFilter(e.target.value)}
              className="bg-surface-2 border border-border rounded-md px-4 py-2 text-sm text-text-primary cursor-pointer"
            >
              <option value="all">Any logo</option>
              <option value="has">Has logo</option>
              <option value="missing">Missing logo</option>
            </select>
            <select
              value={websiteFilter}
              onChange={(e) => setWebsiteFilter(e.target.value)}
              className="bg-surface-2 border border-border rounded-md px-4 py-2 text-sm text-text-primary cursor-pointer"
            >
              <option value="all">Any website</option>
              <option value="has">Has website</option>
              <option value="missing">Missing website</option>
            </select>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="bg-surface-2 border border-border rounded-md px-4 py-2 text-sm text-text-primary cursor-pointer md:col-span-1"
            >
              <option value="az">Name A–Z</option>
              <option value="za">Name Z–A</option>
              <option value="founded_new">Founded (newest)</option>
              <option value="founded_old">Founded (oldest)</option>
              <option value="newest">Recently added</option>
            </select>
          </div>
        </div>
      </div>

      {selectedIds.size > 0 && (
        <div className="flex items-center justify-between p-4 bg-brand/10 border border-brand/30 rounded-xl shadow-xs">
          <div className="flex items-center gap-2">
            <Icon icon="solar:check-circle-bold" className="text-brand text-lg" />
            <span className="text-sm font-bold text-text-primary">{selectedIds.size} companies selected for action</span>
          </div>
          <div className="flex gap-2">
            {selectedIds.size >= 2 && (
              <button
                onClick={openMerge}
                className="bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <Icon icon="solar:posts-carousel-vertical-linear" className="w-4 h-4" />
                <span>Merge Selected</span>
              </button>
            )}
            <button
              onClick={() => setSelectedIds(new Set())}
              className="bg-surface border border-border hover:border-brand text-text-primary px-4 py-2 rounded-lg text-xs font-bold cursor-pointer"
            >
              Clear Selection
            </button>
          </div>
        </div>
      )}

      {/* Data Table */}
      <div className="card-cal p-0 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead>
              <tr className="border-b border-border text-[10px] font-bold text-text-muted bg-surface-2/30 uppercase tracking-wider">
                <th className="px-4 py-4 w-12">
                  <input
                    type="checkbox"
                    checked={filteredCompanies.length > 0 && filteredCompanies.every((c) => selectedIds.has(c.id))}
                    onChange={toggleSelectAllFiltered}
                    className="w-4 h-4 rounded border-border accent-brand cursor-pointer"
                    title="Select all filtered"
                  />
                </th>
                <th className="px-6 py-4">Company</th>
                <th className="px-6 py-4">Type</th>
                <th className="px-6 py-4">Website</th>
                <th className="px-6 py-4">Founded</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading ? (
                Array(5).fill(0).map((_, i) => <SkeletonRow key={i} columns={6} />)
              ) : filteredCompanies.length === 0 ? (
                <tr>
                  <td colSpan="6" className="px-6 py-12 text-center text-text-muted">
                    {companies.length === 0 ? 'No companies found.' : 'No companies match your search or filters.'}
                    {(search || typeTab !== 'all' || logoFilter !== 'all' || websiteFilter !== 'all') && (
                      <button
                        type="button"
                        onClick={() => {
                          setSearch('');
                          setTypeTab('all');
                          setLogoFilter('all');
                          setWebsiteFilter('all');
                        }}
                        className="block mx-auto mt-3 text-xs font-bold uppercase tracking-widest text-brand hover:underline cursor-pointer"
                      >
                        Clear filters
                      </button>
                    )}
                  </td>
                </tr>
              ) : (
                paginatedCompanies.map((company) => (
                  <tr
                    key={company.id}
                    className={`transition-colors group ${selectedIds.has(company.id) ? 'bg-amber-500/10' : 'hover:bg-surface-2/50'}`}
                  >
                    <td className="px-4 py-3.5">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(company.id)}
                        onChange={() => toggleSelect(company.id)}
                        className="w-4 h-4 rounded border-border accent-amber-500 cursor-pointer"
                        title="Select to merge"
                      />
                    </td>
                    <td className="px-6 py-3.5">
                      <div className="flex items-center gap-3 min-w-0">
                        {company.logo_url ? (
                          <img src={company.logo_url} alt="" className="w-10 h-10 rounded-lg object-cover bg-black border border-border shrink-0" />
                        ) : (
                          <div className="w-10 h-10 rounded-lg bg-brand/15 text-brand flex items-center justify-center font-bold text-lg shrink-0 border border-brand/20">
                            {getInitials(company.name)}
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="font-bold text-text-primary truncate">{company.name}</p>
                          {company.description ? (
                            <p className="text-[11px] text-text-muted truncate max-w-xs">{company.description}</p>
                          ) : (
                            <p className="text-[11px] text-text-muted/60">No description</p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-3.5 whitespace-nowrap">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-surface-2 border border-border text-text-secondary capitalize">
                        {company.company_type || 'Studio'}
                      </span>
                    </td>
                    <td className="px-6 py-3.5">
                      {company.website ? (
                        <a 
                          href={company.website} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-brand hover:underline truncate max-w-[180px] inline-block align-bottom font-bold text-xs"
                        >
                          {company.website.replace(/^https?:\/\//, '')}
                        </a>
                      ) : (
                        <span className="text-text-muted">—</span>
                      )}
                    </td>
                    <td className="px-6 py-3.5 text-text-muted font-medium whitespace-nowrap">
                      {company.founded_year || '—'}
                    </td>
                    <td className="px-6 py-3.5 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1 md:opacity-70 md:group-hover:opacity-100 transition-opacity">
                        <a
                          href={`/companies/${company.slug || company.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1.5 text-text-muted hover:text-text-primary hover:bg-surface-2 rounded-lg transition-colors"
                          title="View Public Profile"
                        >
                          <Icon icon="solar:arrow-right-up-linear" className="w-4 h-4" />
                        </a>
                        <button
                          onClick={() => openEditDrawer(company)}
                          className="p-1.5 text-text-muted hover:text-brand hover:bg-surface-2 rounded-lg transition-colors cursor-pointer"
                          title="Edit"
                        >
                          <Icon icon="solar:pen-new-square-linear" className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setDeletingCompany(company)}
                          className="p-1.5 text-text-muted hover:text-red-500 hover:bg-surface-2 rounded-lg transition-colors cursor-pointer"
                          title="Delete"
                        >
                          <Icon icon="solar:trash-bin-trash-linear" className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* ─── PAGINATION BAR ─── */}
        {!isLoading && filteredCompanies.length > 0 && (
          <div className="p-4 border-t border-border bg-surface-2/30 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-text-muted">
            <div>
              Showing <span className="font-bold text-text-primary">{(currentPage - 1) * pageSize + 1}</span> to{' '}
              <span className="font-bold text-text-primary">{Math.min(currentPage * pageSize, filteredCompanies.length)}</span> of{' '}
              <span className="font-bold text-text-primary">{filteredCompanies.length}</span> companies
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-3 py-1.5 rounded-lg border border-border bg-surface hover:border-brand disabled:opacity-40 disabled:hover:border-border text-text-primary font-bold transition-colors cursor-pointer"
              >
                Previous
              </button>

              <span className="px-3 py-1.5 font-bold text-text-primary">
                Page {currentPage} of {totalPages}
              </span>

              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="px-3 py-1.5 rounded-lg border border-border bg-surface hover:border-brand disabled:opacity-40 disabled:hover:border-border text-text-primary font-bold transition-colors cursor-pointer"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Add/Edit Drawer */}
      <Drawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        title={editingCompany ? "Edit Company" : "Add Company"}
      >
        <form onSubmit={handleSave} className="space-y-6">
          {/* Logo & Profile Picture Section */}
          <div className="bg-surface-2/60 border border-border rounded-xl p-4 space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-text-primary uppercase tracking-wider flex items-center gap-1.5">
                <Icon icon="solar:camera-bold" className="text-brand w-4 h-4" />
                Company Profile Picture / Logo
              </label>
              {formData.logo_url && (
                <button
                  type="button"
                  onClick={() => setFormData(prev => ({ ...prev, logo_url: '' }))}
                  className="text-[11px] font-bold text-red-400 hover:text-red-300 flex items-center gap-1 transition-colors"
                >
                  <Icon icon="solar:trash-bin-minimalistic-bold" className="w-3.5 h-3.5" />
                  Remove
                </button>
              )}
            </div>

            {/* Logo Preview & Dropzone */}
            <div className="flex flex-col sm:flex-row items-center gap-4">
              <div className="relative group shrink-0">
                <div className="w-24 h-24 rounded-2xl border-2 border-border overflow-hidden bg-white/95 flex items-center justify-center shadow-lg transition-transform group-hover:scale-105">
                  {formData.logo_url ? (
                    <img
                      src={formData.logo_url}
                      alt="Logo preview"
                      className="w-full h-full object-contain p-1"
                      onError={(e) => {
                        e.target.style.display = 'none';
                      }}
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-brand/20 to-amber-500/20 flex flex-col items-center justify-center text-brand">
                      <span className="font-heading font-black text-3xl">
                        {formData.name ? getInitials(formData.name) : '?'}
                      </span>
                    </div>
                  )}

                  {isUploadingLogo && (
                    <div className="absolute inset-0 bg-black/70 backdrop-blur-xs flex flex-col items-center justify-center text-white gap-1 z-20">
                      <Icon icon="solar:refresh-circle-bold" className="w-6 h-6 animate-spin text-brand" />
                      <span className="text-[10px] font-bold">Uploading…</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Upload Drop Area */}
              <div
                onDragOver={(e) => { e.preventDefault(); setIsDraggingLogo(true); }}
                onDragLeave={() => setIsDraggingLogo(false)}
                onDrop={handleDrop}
                onClick={() => !isUploadingLogo && fileInputRef.current?.click()}
                className={`flex-1 w-full border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-1.5 ${
                  isDraggingLogo
                    ? 'border-brand bg-brand/10 scale-[1.01]'
                    : 'border-border hover:border-brand/60 hover:bg-surface-3/50'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/jpg"
                  onChange={handleFileInputChange}
                  className="hidden"
                />
                <div className="p-2 rounded-full bg-brand/10 text-brand">
                  <Icon icon="solar:upload-track-bold" className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs font-bold text-text-primary">
                    {isUploadingLogo ? 'Processing image…' : 'Upload from device'}
                  </p>
                  <p className="text-[10px] text-text-muted mt-0.5">
                    Click to browse or drag & drop (PNG, JPG, WebP up to 10MB)
                  </p>
                </div>
              </div>
            </div>

            {/* Direct Image URL Input */}
            <div className="pt-1">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] font-bold text-text-muted flex items-center gap-1">
                  <Icon icon="solar:link-bold" className="w-3.5 h-3.5" />
                  Or paste Image URL
                </span>
                {formData.logo_url && (
                  <a
                    href={formData.logo_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[10px] text-brand hover:underline font-bold flex items-center gap-0.5"
                  >
                    Open link <Icon icon="solar:arrow-right-up-linear" className="w-3 h-3" />
                  </a>
                )}
              </div>
              <div className="relative">
                <input
                  type="url"
                  value={formData.logo_url}
                  onChange={(e) => setFormData({ ...formData, logo_url: e.target.value })}
                  className="w-full bg-bg border border-border text-text-primary rounded-lg pl-3 pr-8 py-2 text-xs focus:border-brand focus:outline-none transition-colors"
                  placeholder="https://example.com/company-logo.png"
                />
                {formData.logo_url && (
                  <button
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, logo_url: '' }))}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary p-0.5"
                  >
                    <Icon icon="solar:close-circle-bold" className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-text-muted mb-1">Company Name *</label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full bg-bg border border-border text-text-primary rounded-md px-4 py-2 text-sm focus:border-gold focus:outline-none"
              placeholder="e.g. EbonyLife Films"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-text-muted uppercase mb-1">Company Type</label>
              <select
                value={formData.company_type}
                onChange={(e) => setFormData({ ...formData, company_type: e.target.value })}
                className="w-full bg-bg border border-border text-text-primary rounded-md px-3 py-2 text-xs focus:border-gold focus:outline-none"
              >
                <option value="">Select type...</option>
                <option value="Production Company">Production Company</option>
                <option value="Studio">Studio</option>
                <option value="academy">Film Academy / Institution</option>
                <option value="talent_agency">Talent Agency &amp; Management</option>
                <option value="stage_theatre">Stage &amp; Theatre House</option>
                <option value="Distribution">Distributor</option>
                <option value="Streaming Platform">Streaming Platform</option>
                <option value="Broadcaster">Broadcaster</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-text-muted uppercase mb-1">Headquarters</label>
              <input
                type="text"
                value={formData.headquarters}
                onChange={(e) => setFormData({ ...formData, headquarters: e.target.value })}
                className="w-full bg-bg border border-border text-text-primary rounded-md px-3 py-2 text-xs focus:border-gold focus:outline-none"
                placeholder="e.g. Lagos, Nigeria"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-text-muted mb-1">Website URL</label>
              <input
                type="url"
                value={formData.website_url}
                onChange={(e) => setFormData({ ...formData, website_url: e.target.value })}
                className="w-full bg-bg border border-border text-text-primary rounded-md px-4 py-2 text-sm focus:border-gold focus:outline-none"
                placeholder="https://... (leave blank if none)"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-text-muted mb-1">Founded Year</label>
              <input
                type="number"
                min="1800"
                max={new Date().getFullYear()}
                value={formData.founded_year}
                onChange={(e) => setFormData({ ...formData, founded_year: e.target.value })}
                className="w-full bg-bg border border-border text-text-primary rounded-md px-4 py-2 text-sm focus:border-gold focus:outline-none"
                placeholder="e.g. 2010"
              />
            </div>
          </div>

          {/* Social & Contact Channels (Crucial for Academies & Agencies with no website) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-text-muted mb-1">Official Instagram</label>
              <input
                type="url"
                value={formData.instagram_url}
                onChange={(e) => setFormData({ ...formData, instagram_url: e.target.value })}
                className="w-full bg-bg border border-border text-text-primary rounded-md px-4 py-2 text-sm focus:border-gold focus:outline-none"
                placeholder="https://instagram.com/..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-text-muted mb-1">Admissions / Booking URL</label>
              <input
                type="url"
                value={formData.booking_url}
                onChange={(e) => setFormData({ ...formData, booking_url: e.target.value })}
                className="w-full bg-bg border border-border text-text-primary rounded-md px-4 py-2 text-sm focus:border-gold focus:outline-none"
                placeholder="https://... (portal or cohort form)"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-text-muted mb-1">Official Contact Email</label>
              <input
                type="email"
                value={formData.contact_email}
                onChange={(e) => setFormData({ ...formData, contact_email: e.target.value })}
                className="w-full bg-bg border border-border text-text-primary rounded-md px-4 py-2 text-sm focus:border-gold focus:outline-none"
                placeholder="admissions@... or info@..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-text-muted mb-1">Official Contact Phone</label>
              <input
                type="tel"
                value={formData.contact_phone}
                onChange={(e) => setFormData({ ...formData, contact_phone: e.target.value })}
                className="w-full bg-bg border border-border text-text-primary rounded-md px-4 py-2 text-sm focus:border-gold focus:outline-none"
                placeholder="+234..."
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-text-muted mb-1">Description</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={3}
              className="w-full bg-bg border border-border text-text-primary rounded-md px-4 py-2 text-sm focus:border-gold focus:outline-none resize-none"
              placeholder="Overview of the company's productions, distribution footprint, and history..."
            />
          </div>

          <div className="pt-4 flex flex-col gap-3">
            <button
              type="submit"
              disabled={isSaving || isUploadingLogo}
              className="w-full bg-brand text-white font-bold py-3.5 rounded-lg hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 shadow-lg shadow-brand/20"
            >
              {isSaving ? 'Saving...' : 'Save changes'}
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

      {/* ─── AD CAMPAIGN DRAWER (CUSTOMIZABLE TITLE, FORMAT, IMAGE, LINK) ─── */}
      <Drawer
        isOpen={isAdDrawerOpen}
        onClose={() => setIsAdDrawerOpen(false)}
        title={editingAd ? "Edit Ad Campaign" : "New Ad Campaign"}
      >
        <form onSubmit={handleSaveAd} className="space-y-5">
          <div>
            <label className="block text-xs font-bold text-text-muted uppercase mb-1">Campaign Headline / Title *</label>
            <input
              type="text"
              required
              value={adFormData.title}
              onChange={(e) => setAdFormData({ ...adFormData, title: e.target.value })}
              className="w-full bg-bg border border-border text-text-primary rounded-md px-3 py-2 text-xs focus:border-brand focus:outline-none"
              placeholder="e.g. Del-York Creative Academy: Master Modern Filmmaking"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-text-muted uppercase mb-1">Eyebrow / Category</label>
              <input
                type="text"
                value={adFormData.eyebrow}
                onChange={(e) => setAdFormData({ ...adFormData, eyebrow: e.target.value })}
                className="w-full bg-bg border border-border text-text-primary rounded-md px-3 py-2 text-xs focus:border-brand focus:outline-none"
                placeholder="e.g. Africa's Premier Film School"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-text-muted uppercase mb-1">Badge Tag</label>
              <input
                type="text"
                value={adFormData.badge}
                onChange={(e) => setAdFormData({ ...adFormData, badge: e.target.value })}
                className="w-full bg-bg border border-border text-text-primary rounded-md px-3 py-2 text-xs focus:border-brand focus:outline-none"
                placeholder="e.g. Cohort 2026 Admissions"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-text-muted uppercase mb-1">Banner Layout Format</label>
              <select
                value={adFormData.format}
                onChange={(e) => setAdFormData({ ...adFormData, format: e.target.value })}
                className="w-full bg-bg border border-border text-text-primary rounded-md px-3 py-2 text-xs focus:border-brand focus:outline-none"
              >
                <option value="rectangle">Rectangle (Bento 2-Column with Media)</option>
                <option value="panorama">Panorama (Wide Slim Ribbon)</option>
                <option value="square">Square (Compact Spotlight Card)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-text-muted uppercase mb-1">Destination URL (Link) *</label>
              <input
                type="url"
                required
                value={adFormData.ctaUrl}
                onChange={(e) => setAdFormData({ ...adFormData, ctaUrl: e.target.value })}
                className="w-full bg-bg border border-border text-text-primary rounded-md px-3 py-2 text-xs focus:border-brand focus:outline-none"
                placeholder="https://..."
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-text-muted uppercase mb-1">CTA Button Text</label>
              <input
                type="text"
                value={adFormData.ctaText}
                onChange={(e) => setAdFormData({ ...adFormData, ctaText: e.target.value })}
                className="w-full bg-bg border border-border text-text-primary rounded-md px-3 py-2 text-xs focus:border-brand focus:outline-none"
                placeholder="e.g. Apply for Next Cohort"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-text-muted uppercase mb-1">Campus / Location</label>
              <input
                type="text"
                value={adFormData.location}
                onChange={(e) => setAdFormData({ ...adFormData, location: e.target.value })}
                className="w-full bg-bg border border-border text-text-primary rounded-md px-3 py-2 text-xs focus:border-brand focus:outline-none"
                placeholder="e.g. Victoria Island, Lagos"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-text-muted uppercase mb-1">Media Type</label>
              <select
                value={adFormData.mediaType}
                onChange={(e) => setAdFormData({ ...adFormData, mediaType: e.target.value })}
                className="w-full bg-bg border border-border text-text-primary rounded-md px-3 py-2 text-xs focus:border-brand focus:outline-none"
              >
                <option value="image">Still Image</option>
                <option value="video">MP4 Video Reel</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-text-muted uppercase mb-1">Image or Video URL</label>
              <input
                type="text"
                value={adFormData.mediaUrl}
                onChange={(e) => setAdFormData({ ...adFormData, mediaUrl: e.target.value })}
                className="w-full bg-bg border border-border text-text-primary rounded-md px-3 py-2 text-xs focus:border-brand focus:outline-none"
                placeholder="/media/delyork_promo.mp4 or https://..."
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-text-muted uppercase mb-1">Disciplines / Tags (Comma-separated)</label>
            <input
              type="text"
              value={adFormData.tags}
              onChange={(e) => setAdFormData({ ...adFormData, tags: e.target.value })}
              className="w-full bg-bg border border-border text-text-primary rounded-md px-3 py-2 text-xs focus:border-brand focus:outline-none"
              placeholder="Directing & Producing, 3D Animation, Cinematography, Screen Acting"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-text-muted uppercase mb-1">Campaign Description</label>
            <textarea
              rows={3}
              value={adFormData.description}
              onChange={(e) => setAdFormData({ ...adFormData, description: e.target.value })}
              className="w-full bg-bg border border-border text-text-primary rounded-md px-3 py-2 text-xs focus:border-brand focus:outline-none resize-none"
              placeholder="Overview of the studio program, scholarship details, and faculty highlights..."
            />
          </div>

          <div className="pt-3 flex flex-col gap-2.5">
            <button
              type="submit"
              className="w-full bg-brand text-black font-black py-3 rounded-lg hover:scale-[1.01] active:scale-[0.99] transition-all shadow-md cursor-pointer text-xs uppercase tracking-wider"
            >
              {editingAd ? 'Save Campaign Changes' : 'Create Campaign'}
            </button>
            <button
              type="button"
              onClick={() => setIsAdDrawerOpen(false)}
              className="w-full text-text-muted hover:text-text-primary font-medium py-1.5 transition-colors text-xs cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </form>
      </Drawer>

      {/* Delete Confirmation Modal */}
      {deletingCompany && (
        <ConfirmModal
          title="Delete Company"
          message={`Delete ${deletingCompany.name}?`}
          confirmLabel="Delete"
          confirmColor="bg-red-500 hover:bg-red-600"
          onConfirm={handleDelete}
          onCancel={() => setDeletingCompany(null)}
        />
      )}

      {/* Merge Confirmation — pick the record to KEEP */}
      {mergePlan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => !isMerging && setMergePlan(null)}>
          <div className="bg-surface rounded-xl border border-border w-full max-w-md p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-text-primary">Merge companies</h2>
            <p className="text-sm text-text-muted">
              Choose the record to <strong className="text-text-primary">keep</strong>. Every film and channel from the others moves onto it, and the duplicates are deleted. This cannot be undone.
            </p>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {selectedCompanies.map((c) => (
                <label
                  key={c.id}
                  className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${mergePlan.primary.id === c.id ? 'border-amber-500 bg-amber-500/10' : 'border-border hover:bg-surface-2/50'}`}
                >
                  <input
                    type="radio"
                    name="mergePrimary"
                    checked={mergePlan.primary.id === c.id}
                    onChange={() => setMergePlan({ primary: c, duplicates: selectedCompanies.filter((x) => x.id !== c.id) })}
                    className="accent-amber-500"
                  />
                  <span className="flex-1 min-w-0">
                    <span className="block font-bold text-text-primary truncate">{c.name}</span>
                    <span className="block text-[11px] text-text-muted">
                      {mergePlan.primary.id === c.id ? 'KEEP — others merge into this' : 'will be merged & deleted'}
                      {c.founded_year ? ` · ${c.founded_year}` : ''}{c.tmdb_id ? ' · TMDB' : ''}
                    </span>
                  </span>
                </label>
              ))}
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button onClick={() => setMergePlan(null)} disabled={isMerging} className="px-4 py-2 text-sm font-medium text-text-muted hover:text-text-primary disabled:opacity-50">
                Cancel
              </button>
              <button onClick={confirmMerge} disabled={isMerging} className="px-5 py-2 text-sm font-bold text-white bg-amber-500 hover:bg-amber-600 rounded-lg disabled:opacity-60">
                {isMerging ? 'Merging…' : `Merge ${selectedCompanies.length} → 1`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
