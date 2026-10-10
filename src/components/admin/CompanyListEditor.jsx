import React, { useState, useRef, useEffect } from 'react';
import { Icon } from '@iconify/react';
import { supabase } from '../../lib/supabase';
import { toast } from 'react-hot-toast';

/**
 * Multi-company editor for Production Companies and Distribution Partners.
 * Allows adding multiple rows with autocomplete, instant company creation,
 * and deletion of individual rows.
 */
export default function CompanyListEditor({
  label = 'Companies',
  role = 'production', // 'production' | 'distribution'
  companies = [],
  onChange,
  placeholder = 'Search or add company...',
  addLabel = 'Add Company'
}) {
  // Ensure we have at least one row if empty
  const items = Array.isArray(companies) && companies.length > 0
    ? companies
    : [{ id: null, name: '', logo_url: null }];

  const [activeSearchIndex, setActiveSearchIndex] = useState(null);
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isCreatingIndex, setIsCreatingIndex] = useState(null);
  const searchTimeout = useRef(null);
  const containerRef = useRef(null);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setActiveSearchIndex(null);
        setSearchResults([]);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleTextChange = (index, value) => {
    const updated = items.map((item, i) => {
      if (i === index) {
        return { ...item, name: value, id: item.name === value ? item.id : null };
      }
      return item;
    });
    onChange(updated);

    if (!value || !value.trim()) {
      setActiveSearchIndex(null);
      setSearchResults([]);
      return;
    }

    setActiveSearchIndex(index);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);

    searchTimeout.current = setTimeout(async () => {
      setIsSearching(true);
      try {
        const { data } = await supabase
          .from('companies')
          .select('id, name, logo_url, website, company_type')
          .ilike('name', `%${value.trim()}%`)
          .limit(6);

        setSearchResults(data || []);

        // If exact match found, auto-link id
        const exactMatch = (data || []).find(
          c => c.name.toLowerCase() === value.trim().toLowerCase()
        );
        if (exactMatch) {
          const autoLinked = updated.map((item, i) => {
            if (i === index) {
              return {
                ...item,
                id: exactMatch.id,
                name: exactMatch.name,
                logo_url: exactMatch.logo_url
              };
            }
            return item;
          });
          onChange(autoLinked);
        }
      } catch (err) {
        console.error('Error searching companies:', err);
      } finally {
        setIsSearching(false);
      }
    }, 250);
  };

  const handleSelectCompany = (index, company) => {
    const updated = items.map((item, i) => {
      if (i === index) {
        return {
          id: company.id,
          name: company.name,
          logo_url: company.logo_url
        };
      }
      return item;
    });
    onChange(updated);
    setActiveSearchIndex(null);
    setSearchResults([]);
  };

  const handleCreateCompany = async (index, nameToCreate) => {
    const trimmed = (nameToCreate || '').trim();
    if (!trimmed) return;

    setIsCreatingIndex(index);
    try {
      const { data, error } = await supabase
        .from('companies')
        .insert([{
          name: trimmed,
          company_type: role === 'distribution' ? 'distributor' : 'production',
          description: '.',
          website: '.',
          logo_url: null
        }])
        .select()
        .single();

      if (error) throw error;

      const updated = items.map((item, i) => {
        if (i === index) {
          return {
            id: data.id,
            name: data.name,
            logo_url: data.logo_url
          };
        }
        return item;
      });
      onChange(updated);
      setActiveSearchIndex(null);
      setSearchResults([]);
      toast.success(`${role === 'distribution' ? 'Distributor' : 'Production company'} "${trimmed}" created and linked`);
    } catch (err) {
      console.error('Error creating company:', err);
      toast.error('Failed to create company');
    } finally {
      setIsCreatingIndex(null);
    }
  };

  const handleAddRow = () => {
    const updated = [...items, { id: null, name: '', logo_url: null }];
    onChange(updated);
  };

  const handleRemoveRow = (index) => {
    if (items.length <= 1) {
      // Clear the single row rather than removing it completely
      onChange([{ id: null, name: '', logo_url: null }]);
      return;
    }
    const updated = items.filter((_, i) => i !== index);
    onChange(updated);
    if (activeSearchIndex === index) {
      setActiveSearchIndex(null);
      setSearchResults([]);
    }
  };

  return (
    <div ref={containerRef} className="space-y-2.5">
      <div className="flex items-center justify-between">
        <label className="block text-xs font-bold text-text-primary">
          {label}
        </label>
        <button
          type="button"
          onClick={handleAddRow}
          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold rounded-md bg-brand/10 text-brand hover:bg-brand/20 border border-brand/20 transition-all shadow-sm"
          title={`Add another ${role === 'distribution' ? 'distributor' : 'company'}`}
        >
          <Icon icon="solar:add-circle-bold" className="w-3.5 h-3.5" />
          <span>{addLabel}</span>
        </button>
      </div>

      <div className="space-y-2">
        {items.map((item, index) => {
          const isSelected = Boolean(item.id);
          const isSearchingThis = activeSearchIndex === index && isSearching;
          const isCreatingThis = isCreatingIndex === index;
          const hasDropdownOpen = activeSearchIndex === index && searchResults.length > 0;

          return (
            <div key={index} className="relative group">
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <input
                    type="text"
                    value={item.name || ''}
                    onChange={(e) => handleTextChange(index, e.target.value)}
                    onFocus={() => {
                      if (item.name && item.name.trim()) {
                        handleTextChange(index, item.name);
                      }
                    }}
                    placeholder={placeholder}
                    className={`w-full bg-surface-2 border rounded-md px-3.5 py-2 text-sm text-text-primary focus:border-brand focus:ring-4 focus:ring-brand/5 outline-none transition-all pr-12 ${
                      isSelected ? 'border-brand/40 bg-brand/[0.02]' : 'border-border'
                    }`}
                  />

                  {/* Status & Action Icons inside input */}
                  <div className="absolute right-3 top-2.5 flex items-center gap-1.5">
                    {isSearchingThis || isCreatingThis ? (
                      <div className="w-4 h-4 border-2 border-brand/20 border-t-brand rounded-full animate-spin" />
                    ) : item.name && !isSelected ? (
                      <button
                        type="button"
                        onClick={() => handleCreateCompany(index, item.name)}
                        className="p-0.5 hover:bg-brand/10 rounded-full text-brand transition-all"
                        title="Create and link this new company"
                      >
                        <Icon icon="solar:add-circle-bold" className="w-5 h-5" />
                      </button>
                    ) : null}

                    {isSelected && (
                      <span title="Linked to database record">
                        <Icon icon="solar:check-circle-bold" className="w-4 h-4 text-green-500" />
                      </span>
                    )}

                    {!item.name && (
                      <Icon
                        icon={role === 'distribution' ? 'solar:routing-2-linear' : 'solar:buildings-linear'}
                        className="w-4 h-4 text-text-muted opacity-60"
                      />
                    )}
                  </div>

                  {/* Autocomplete Dropdown */}
                  {hasDropdownOpen && (
                    <div className="absolute left-0 top-full mt-1.5 w-full bg-surface border border-border rounded-lg shadow-2xl z-50 overflow-hidden ring-1 ring-black/10 animate-in fade-in slide-in-from-top-2">
                      <div className="py-1 max-h-56 overflow-y-auto divide-y divide-border/40">
                        {searchResults.map((company) => (
                          <button
                            key={company.id}
                            type="button"
                            onClick={() => handleSelectCompany(index, company)}
                            className="w-full flex items-center gap-3 p-2.5 hover:bg-surface-2 transition-colors text-left"
                          >
                            <div className="w-7 h-7 rounded-md bg-surface-2 overflow-hidden border border-border flex items-center justify-center shrink-0">
                              {company.logo_url ? (
                                <img src={company.logo_url} alt="" className="w-full h-full object-contain p-0.5" />
                              ) : (
                                <span className="text-[10px] font-bold text-brand">
                                  {company.name?.charAt(0)?.toUpperCase()}
                                </span>
                              )}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-xs font-bold text-text-primary truncate">{company.name}</p>
                              {company.website && (
                                <p className="text-[10px] text-text-muted truncate">
                                  {company.website.replace(/^https?:\/\//, '')}
                                </p>
                              )}
                            </div>
                            <Icon icon="solar:arrow-right-linear" className="w-3.5 h-3.5 text-text-muted shrink-0" />
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Add new row button */}
                <button
                  type="button"
                  onClick={handleAddRow}
                  className="p-2 text-text-muted hover:text-brand hover:bg-brand/10 rounded-md transition-all shrink-0 border border-border/50 hover:border-brand/30"
                  title="Add another company row"
                >
                  <Icon icon="solar:add-circle-bold" className="w-4 h-4 text-brand" />
                </button>

                {/* Remove button */}
                <button
                  type="button"
                  onClick={() => handleRemoveRow(index)}
                  className="p-2 text-text-muted hover:text-red-500 hover:bg-red-500/10 rounded-md transition-all shrink-0 border border-transparent hover:border-red-500/20"
                  title="Remove this row"
                >
                  <Icon icon="solar:trash-bin-minimalistic-linear" className="w-4 h-4" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
