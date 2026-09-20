import { useState, useEffect } from 'react';
import { Icon } from '@iconify/react';
import { supabase } from '../../lib/supabase';
import { toast } from 'react-hot-toast';
import { Link } from 'react-router';
import ImageWithFallback from '../ui/ImageWithFallback';

const REPRESENTATION_TYPES = [
  { value: 'Talent Management', label: 'Talent Management' },
  { value: 'Talent Agency', label: 'Talent Agency' },
  { value: 'Publicist', label: 'Publicist / PR' },
  { value: 'Legal Representation', label: 'Legal Representation' },
  { value: 'Commercial / Voice Agent', label: 'Commercial & Voice Agency' },
  { value: 'Digital Management', label: 'Digital & Influencer Management' }
];

export default function PersonRepresentationEditor({ personId, personName, onRepresentationChanged }) {
  const [representations, setRepresentations] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  // Available agencies from companies table
  const [availableCompanies, setAvailableCompanies] = useState([]);
  const [isSearchingCompanies, setIsSearchingCompanies] = useState(false);
  const [isCreatingNewCompany, setIsCreatingNewCompany] = useState(false);
  const [newCompanyName, setNewCompanyName] = useState('');
  const [newCompanyWebsite, setNewCompanyWebsite] = useState('');

  // Form State
  const [formData, setFormData] = useState({
    company_id: '',
    representation_type: 'Talent Management',
    agent_name: '',
    contact_email: '',
    contact_phone: '',
    booking_url: '',
    is_primary: true,
    notes: ''
  });

  const fetchRepresentations = async () => {
    if (!personId) return;
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('talent_representations')
        .select(`
          id,
          person_id,
          company_id,
          representation_type,
          agent_name,
          contact_email,
          contact_phone,
          booking_url,
          is_primary,
          notes,
          companies(
            id,
            name,
            slug,
            logo_url,
            company_type,
            website,
            headquarters
          )
        `)
        .eq('person_id', personId)
        .order('is_primary', { ascending: false })
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Error fetching talent representations:', error);
      } else {
        setRepresentations(data || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchCompanies = async () => {
    setIsSearchingCompanies(true);
    try {
      const { data, error } = await supabase
        .from('companies')
        .select('id, name, slug, logo_url, company_type, website')
        .order('name', { ascending: true })
        .limit(100);

      if (!error && data) {
        setAvailableCompanies(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsSearchingCompanies(false);
    }
  };

  useEffect(() => {
    fetchRepresentations();
    fetchCompanies();
  }, [personId]);

  const resetForm = () => {
    setFormData({
      company_id: availableCompanies[0]?.id || '',
      representation_type: 'Talent Management',
      agent_name: '',
      contact_email: '',
      contact_phone: '',
      booking_url: '',
      is_primary: representations.length === 0,
      notes: ''
    });
    setEditingItem(null);
    setIsCreatingNewCompany(false);
    setNewCompanyName('');
    setNewCompanyWebsite('');
  };

  const handleOpenAdd = () => {
    resetForm();
    setShowModal(true);
  };

  const handleOpenEdit = (item) => {
    setEditingItem(item);
    setFormData({
      company_id: item.company_id,
      representation_type: item.representation_type || 'Talent Management',
      agent_name: item.agent_name || '',
      contact_email: item.contact_email || '',
      contact_phone: item.contact_phone || '',
      booking_url: item.booking_url || '',
      is_primary: Boolean(item.is_primary),
      notes: item.notes || ''
    });
    setIsCreatingNewCompany(false);
    setShowModal(true);
  };

  const handleCompanySelect = (compId) => {
    setFormData(prev => {
      const selected = availableCompanies.find(c => c.id === compId);
      return {
        ...prev,
        company_id: compId,
        booking_url: prev.booking_url || selected?.website || '',
        agent_name: prev.agent_name || selected?.name || ''
      };
    });
  };

  const handleSave = async (e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }

    let targetCompanyId = formData.company_id;

    if (isCreatingNewCompany) {
      if (!newCompanyName.trim()) {
        return toast.error('Please enter the agency name');
      }
      setIsSaving(true);
      try {
        const slug = newCompanyName
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/(^-|-$)+/g, '');

        const { data: newComp, error: compErr } = await supabase
          .from('companies')
          .insert({
            name: newCompanyName.trim(),
            slug: `${slug}-${Math.floor(Math.random() * 1000)}`,
            company_type: 'Talent Agency & Management',
            website: newCompanyWebsite.trim() || null
          })
          .select()
          .single();

        if (compErr) throw compErr;
        targetCompanyId = newComp.id;
        setAvailableCompanies(prev => [newComp, ...prev]);
      } catch (err) {
        setIsSaving(false);
        return toast.error('Failed to create company: ' + err.message);
      }
    }

    if (!targetCompanyId) {
      return toast.error('Please select or create an agency');
    }

    setIsSaving(true);
    try {
      // If primary, toggle other representations
      if (formData.is_primary) {
        try {
          await supabase
            .from('talent_representations')
            .update({ is_primary: false })
            .eq('person_id', personId);
        } catch (err) {
          console.warn('Could not reset existing primary representation:', err);
        }
      }

      const payload = {
        person_id: personId,
        company_id: targetCompanyId,
        representation_type: formData.representation_type,
        agent_name: formData.agent_name.trim() || null,
        contact_email: formData.contact_email.trim() || null,
        contact_phone: formData.contact_phone.trim() || null,
        booking_url: formData.booking_url.trim() || null,
        is_primary: formData.is_primary,
        notes: formData.notes.trim() || null,
        updated_at: new Date().toISOString()
      };

      if (editingItem) {
        const { error } = await supabase
          .from('talent_representations')
          .update(payload)
          .eq('id', editingItem.id);
        if (error) throw error;
        toast.success('Representation updated successfully');
      } else {
        const { error } = await supabase
          .from('talent_representations')
          .insert(payload);
        if (error) throw error;
        toast.success('Agency representation linked successfully');
      }

      setShowModal(false);
      resetForm();
      await fetchRepresentations();
      onRepresentationChanged?.();
    } catch (err) {
      console.error('Error saving talent representation:', err);
      toast.error(err.message || 'Failed to save representation');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id, agencyName) => {
    if (!window.confirm(`Remove ${agencyName || 'this agency'} from ${personName || 'this talent'}'s representation roster?`)) {
      return;
    }
    setDeletingId(id);
    try {
      const { error } = await supabase
        .from('talent_representations')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast.success('Agency representation removed');
      setRepresentations(prev => prev.filter(r => r.id !== id));
      onRepresentationChanged?.();
    } catch (err) {
      toast.error('Failed to remove: ' + err.message);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <section className="space-y-4">
      {/* Section Header */}
      <div className="flex items-center justify-between pb-3 border-b border-border">
        <div className="flex items-center gap-2">
          <span className="text-xl">💼</span>
          <div>
            <h4 className="text-xs font-bold text-text-primary uppercase tracking-wider">
              Talent Agency & Management
            </h4>
            <p className="text-[11px] text-text-muted">
              Associate this person with their managing agency, agents, and booking details
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={handleOpenAdd}
          className="px-3 py-1.5 rounded-xl bg-brand/10 border border-brand/20 text-brand text-xs font-bold hover:bg-brand hover:text-white transition-all flex items-center gap-1.5 shadow-sm"
        >
          <Icon icon="solar:add-circle-linear" width="16" />
          <span>Add Agency</span>
        </button>
      </div>

      {/* Representation List */}
      {isLoading ? (
        <div className="py-8 flex items-center justify-center gap-2 text-xs text-text-muted">
          <Icon icon="solar:spinner-line" className="animate-spin text-brand text-base" />
          <span>Loading representation data...</span>
        </div>
      ) : representations.length === 0 ? (
        <div className="p-5 border border-dashed border-border rounded-xl text-center space-y-2 bg-surface-2/30">
          <Icon icon="solar:shield-warning-linear" className="mx-auto text-2xl text-text-muted" />
          <p className="text-xs font-medium text-text-secondary">
            No talent agency or management representation linked yet.
          </p>
          <p className="text-[11px] text-text-muted max-w-sm mx-auto">
            Linking an agency displays their official representation card, contact info, and booking channels on their public profile.
          </p>
          <button
            type="button"
            onClick={handleOpenAdd}
            className="mt-2 inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-surface-2 border border-border hover:border-brand/50 text-text-primary hover:text-brand rounded-lg text-xs font-bold transition-all"
          >
            <Icon icon="solar:link-circle-linear" width="16" />
            <span>Link Talent Agency</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {representations.map((rep) => {
            const company = rep.companies || {};
            const agencyName = company.name || 'Agency';

            return (
              <div
                key={rep.id}
                className="p-4 rounded-xl border border-border bg-surface-2/60 hover:border-border-hover transition-all flex flex-col justify-between gap-3 relative group"
              >
                <div className="flex items-start gap-3">
                  <div className="w-12 h-12 rounded-lg bg-black/40 border border-border overflow-hidden shrink-0 flex items-center justify-center">
                    <ImageWithFallback
                      src={company.logo_url}
                      alt={agencyName}
                      fallbackType="company"
                      name={agencyName}
                      className="w-full h-full object-cover"
                    />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-[10px] font-black uppercase tracking-wider text-brand bg-brand/10 px-1.5 py-0.5 rounded border border-brand/20">
                        {rep.representation_type || 'Management'}
                      </span>
                      {rep.is_primary && (
                        <span className="text-[9px] font-bold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                          Primary
                        </span>
                      )}
                    </div>
                    <Link
                      to={company.slug ? `/companies/${company.slug}` : '#'}
                      className="text-sm font-bold text-text-primary hover:text-brand transition-colors truncate block mt-0.5"
                    >
                      {agencyName}
                    </Link>
                    {rep.agent_name && (
                      <p className="text-[11px] text-text-muted truncate">
                        Agent: <span className="text-text-secondary font-medium">{rep.agent_name}</span>
                      </p>
                    )}
                  </div>
                </div>

                {/* Contact and Links */}
                <div className="text-[11px] text-text-muted space-y-1 pt-2 border-t border-border/60">
                  {rep.contact_email && (
                    <div className="flex items-center gap-1.5 truncate">
                      <Icon icon="solar:letter-linear" className="text-brand shrink-0" />
                      <span className="truncate">{rep.contact_email}</span>
                    </div>
                  )}
                  {rep.contact_phone && (
                    <div className="flex items-center gap-1.5 truncate">
                      <Icon icon="solar:phone-linear" className="text-brand shrink-0" />
                      <span>{rep.contact_phone}</span>
                    </div>
                  )}
                  {rep.booking_url && (
                    <div className="flex items-center gap-1.5 truncate">
                      <Icon icon="solar:link-minimalistic-2-linear" className="text-brand shrink-0" />
                      <a
                        href={rep.booking_url}
                        target="_blank"
                        rel="noreferrer"
                        className="truncate hover:text-brand transition-colors underline"
                      >
                        {rep.booking_url}
                      </a>
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/40">
                  <button
                    type="button"
                    onClick={() => handleOpenEdit(rep)}
                    className="p-1.5 rounded-lg text-text-muted hover:text-brand hover:bg-surface transition-all text-xs font-semibold flex items-center gap-1"
                    title="Edit Representation"
                  >
                    <Icon icon="solar:pen-linear" width="14" />
                    <span>Edit</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(rep.id, agencyName)}
                    disabled={deletingId === rep.id}
                    className="p-1.5 rounded-lg text-text-muted hover:text-red-500 hover:bg-red-500/10 transition-all text-xs font-semibold flex items-center gap-1 disabled:opacity-50"
                    title="Remove Representation"
                  >
                    {deletingId === rep.id ? (
                      <Icon icon="solar:spinner-line" className="animate-spin text-sm" />
                    ) : (
                      <Icon icon="solar:trash-bin-trash-linear" width="14" />
                    )}
                    <span>Remove</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add / Edit Representation Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface border border-border rounded-2xl w-full max-w-xl max-h-[90vh] shadow-2xl overflow-hidden flex flex-col animate-scale-up">
            {/* Modal Header */}
            <div className="p-4 border-b border-border flex items-center justify-between bg-surface-2/50">
              <div className="flex items-center gap-2">
                <span className="text-xl">🏢</span>
                <h3 className="text-sm font-bold text-text-primary">
                  {editingItem ? 'Edit Agency Representation' : 'Associate Talent with Agency'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="p-1 rounded-lg text-text-muted hover:text-text-primary hover:bg-surface-2 transition-all"
              >
                <Icon icon="solar:close-circle-bold" width="20" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSave} className="p-5 space-y-4 overflow-y-auto custom-scrollbar flex-1 flex flex-col">
              {/* Agency Selection */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-bold text-text-primary">
                    Select Talent Agency / Company *
                  </label>
                  <button
                    type="button"
                    onClick={() => setIsCreatingNewCompany(!isCreatingNewCompany)}
                    className="text-[11px] font-bold text-brand hover:underline flex items-center gap-1"
                  >
                    <Icon icon={isCreatingNewCompany ? "solar:list-linear" : "solar:add-circle-linear"} />
                    <span>{isCreatingNewCompany ? 'Choose from list' : '+ Create new agency'}</span>
                  </button>
                </div>

                {!isCreatingNewCompany ? (
                  <select
                    value={formData.company_id}
                    onChange={(e) => handleCompanySelect(e.target.value)}
                    className="w-full bg-surface-2 border border-border p-2.5 rounded-lg text-xs font-semibold focus:border-brand outline-none"
                    required
                  >
                    <option value="">-- Choose Agency / Management Firm --</option>
                    {availableCompanies.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.name} {c.company_type ? `(${c.company_type})` : ''}
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="p-3 rounded-lg border border-brand/30 bg-brand/5 space-y-2">
                    <div>
                      <label className="block text-[11px] font-bold text-text-primary mb-1">New Agency Name *</label>
                      <input
                        type="text"
                        placeholder="e.g., Guguru Media"
                        value={newCompanyName}
                        onChange={(e) => setNewCompanyName(e.target.value)}
                        className="w-full bg-surface border border-border p-2 rounded-lg text-xs focus:border-brand outline-none"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-text-muted mb-1">Agency Website (Optional)</label>
                      <input
                        type="url"
                        placeholder="https://..."
                        value={newCompanyWebsite}
                        onChange={(e) => setNewCompanyWebsite(e.target.value)}
                        className="w-full bg-surface border border-border p-2 rounded-lg text-xs focus:border-brand outline-none"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Representation Type */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-text-primary mb-1.5">Representation Type</label>
                  <select
                    value={formData.representation_type}
                    onChange={(e) => setFormData(prev => ({ ...prev, representation_type: e.target.value }))}
                    className="w-full bg-surface-2 border border-border p-2.5 rounded-lg text-xs font-semibold focus:border-brand outline-none"
                  >
                    {REPRESENTATION_TYPES.map(t => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-text-primary mb-1.5">Agent / Rep Name</label>
                  <input
                    type="text"
                    placeholder="e.g., Guguru Media or Agent Name"
                    value={formData.agent_name}
                    onChange={(e) => setFormData(prev => ({ ...prev, agent_name: e.target.value }))}
                    className="w-full bg-surface-2 border border-border p-2.5 rounded-lg text-xs focus:border-brand outline-none"
                  />
                </div>
              </div>

              {/* Contact Email & Phone */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-text-muted mb-1.5">Booking / Contact Email</label>
                  <input
                    type="email"
                    placeholder="e.g., booking@agency.com"
                    value={formData.contact_email}
                    onChange={(e) => setFormData(prev => ({ ...prev, contact_email: e.target.value }))}
                    className="w-full bg-surface-2 border border-border p-2.5 rounded-lg text-xs focus:border-brand outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-text-muted mb-1.5">Contact Phone</label>
                  <input
                    type="tel"
                    placeholder="e.g., +234 802 000 0000"
                    value={formData.contact_phone}
                    onChange={(e) => setFormData(prev => ({ ...prev, contact_phone: e.target.value }))}
                    className="w-full bg-surface-2 border border-border p-2.5 rounded-lg text-xs focus:border-brand outline-none"
                  />
                </div>
              </div>

              {/* Booking URL */}
              <div>
                <label className="block text-xs font-bold text-text-muted mb-1.5">Official Booking / Agency URL</label>
                <input
                  type="url"
                  placeholder="https://gugurumedia.com/"
                  value={formData.booking_url}
                  onChange={(e) => setFormData(prev => ({ ...prev, booking_url: e.target.value }))}
                  className="w-full bg-surface-2 border border-border p-2.5 rounded-lg text-xs focus:border-brand outline-none"
                />
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-bold text-text-muted mb-1.5">Notes (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g., Exclusive theatrical & commercial representation"
                  value={formData.notes}
                  onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                  className="w-full bg-surface-2 border border-border p-2.5 rounded-lg text-xs focus:border-brand outline-none"
                />
              </div>

              {/* Is Primary Checkbox */}
              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="rep_is_primary"
                  checked={formData.is_primary}
                  onChange={(e) => setFormData(prev => ({ ...prev, is_primary: e.target.checked }))}
                  className="rounded border-border text-brand focus:ring-brand accent-brand cursor-pointer"
                />
                <label htmlFor="rep_is_primary" className="text-xs font-semibold text-text-primary cursor-pointer">
                  Mark as Primary Representation on Profile
                </label>
              </div>

              {/* Actions */}
              <div className="pt-4 border-t border-border flex items-center justify-end gap-3 mt-auto">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-text-muted hover:text-text-primary hover:bg-surface-2 transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-brand text-white hover:bg-brand/90 transition-all flex items-center gap-1.5 shadow-sm disabled:opacity-50"
                >
                  {isSaving && <Icon icon="solar:spinner-line" className="animate-spin" />}
                  <span>{editingItem ? 'Update Representation' : 'Save Representation'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}
