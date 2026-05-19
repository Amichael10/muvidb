import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { toast } from 'react-hot-toast';
import { Icon } from '@iconify/react';
import Drawer from '../../components/admin/Drawer';
import ConfirmModal from '../../components/admin/ConfirmModal';
import SkeletonRow from '../../components/admin/SkeletonRow';
import { useAuth } from '../../context/AuthContext';
import { logAdminAction } from '../../lib/adminLogger';

export default function AdminCompanies() {
  const { user } = useAuth();
  const [companies, setCompanies] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Modals/Drawers state
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [editingCompany, setEditingCompany] = useState(null);
  const [deletingCompany, setDeletingCompany] = useState(null);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    logo_url: '',
    website_url: '',
    founded_year: ''
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
      founded_year: ''
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
      founded_year: company.founded_year || ''
    });
    setIsDrawerOpen(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const dataToSave = {
        name: formData.name,
        description: formData.description || null,
        logo_url: formData.logo_url || null,
        website: formData.website_url || null,
        founded_year: formData.founded_year ? parseInt(formData.founded_year, 10) : null,
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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <p className="text-brand text-xs font-bold mb-1">Administration</p>
          <h1 className="text-3xl font-bold text-text-primary tracking-tight">Companies</h1>
        </div>
        <button
          onClick={openAddDrawer}
          className="bg-brand text-white font-bold px-6 py-2 rounded-lg text-xs hover:scale-[1.02] active:scale-[0.98] transition-all"
        >
          Add company record
        </button>
      </div>

      {/* Data Table */}
      <div className="bg-surface rounded-lg border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-text-muted uppercase bg-surface-2/50 border-b border-border">
              <tr>
                <th className="px-6 py-4 font-medium">Logo</th>
                <th className="px-6 py-4 font-medium">Name</th>
                <th className="px-6 py-4 font-medium">Website</th>
                <th className="px-6 py-4 font-medium">Founded</th>
                <th className="px-6 py-4 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading ? (
                Array(5).fill(0).map((_, i) => <SkeletonRow key={i} columns={5} />)
              ) : companies.length === 0 ? (
                <tr>
                  <td colSpan="5" className="px-6 py-8 text-center text-text-muted">
                    No companies found.
                  </td>
                </tr>
              ) : (
                companies.map((company) => (
                  <tr key={company.id} className="hover:bg-surface-2/50 transition-colors group">
                    <td className="px-6 py-4">
                      {company.logo_url ? (
                        <img src={company.logo_url} alt={company.name} className="w-10 h-10 rounded-lg object-cover bg-white" />
                      ) : (
                        <div className="w-10 h-10 rounded-lg bg-brand flex items-center justify-center text-white font-bold text-lg">
                          {getInitials(company.name)}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 font-bold text-text-primary">
                      {company.name}
                    </td>
                    <td className="px-6 py-4">
                      {company.website ? (
                        <a 
                          href={company.website} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-brand hover:underline truncate max-w-[200px] inline-block align-bottom font-bold"
                        >
                          {company.website.replace(/^https?:\/\//, '')}
                        </a>
                      ) : (
                        <span className="text-text-muted">—</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-text-muted">
                      {company.founded_year || '—'}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => openEditDrawer(company)}
                          className="p-2 text-text-muted hover:text-brand hover:bg-surface-2 rounded-lg transition-colors"
                          title="Edit"
                        >
                          <Icon icon="solar:pen-new-square-linear" className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setDeletingCompany(company)}
                          className="p-2 text-text-muted hover:text-red-500 hover:bg-surface-2 rounded-lg transition-colors"
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
      </div>

      {/* Add/Edit Drawer */}
      <Drawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        title={editingCompany ? "Edit Company" : "Add Company"}
      >
        <form onSubmit={handleSave} className="space-y-6">
          {/* Logo Preview */}
          <div className="flex flex-col items-center gap-4">
            {formData.logo_url ? (
              <img src={formData.logo_url} alt="Preview" className="w-20 h-20 rounded-lg object-cover border-2 border-border bg-white" />
            ) : (
              <div className="w-20 h-20 rounded-lg bg-brand flex items-center justify-center text-white font-bold text-3xl">
                {formData.name ? getInitials(formData.name) : '?'}
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-text-muted mb-1">Company Name *</label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full bg-bg border border-border text-text-primary rounded-md px-4 py-2 text-sm focus:border-gold focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-text-muted mb-1">Logo URL</label>
            <input
              type="url"
              value={formData.logo_url}
              onChange={(e) => setFormData({ ...formData, logo_url: e.target.value })}
              className="w-full bg-bg border border-border text-text-primary rounded-md px-4 py-2 text-sm focus:border-gold focus:outline-none"
              placeholder="https://..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-text-muted mb-1">Website URL</label>
            <input
              type="url"
              value={formData.website_url}
              onChange={(e) => setFormData({ ...formData, website_url: e.target.value })}
              className="w-full bg-bg border border-border text-text-primary rounded-md px-4 py-2 text-sm focus:border-gold focus:outline-none"
              placeholder="https://..."
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

          <div>
            <label className="block text-sm font-medium text-text-muted mb-1">Description</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={3}
              className="w-full bg-bg border border-border text-text-primary rounded-md px-4 py-2 text-sm focus:border-gold focus:outline-none resize-none"
            />
          </div>

          <div className="pt-4 flex flex-col gap-3">
            <button
              type="submit"
              disabled={isSaving}
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
    </div>
  );
}
