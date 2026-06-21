import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import { Icon } from '@iconify/react';
import { toast } from 'react-hot-toast';

export default function AdminCountries() {
  const [countries, setCountries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterActive, setFilterActive] = useState('all'); // all, active, inactive
  const [updatingMap, setUpdatingMap] = useState({});

  useEffect(() => {
    fetchCountries();
  }, []);

  const fetchCountries = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('countries')
        .select('*')
        .order('name', { ascending: true });

      if (error) throw error;
      setCountries(data || []);
    } catch (err) {
      toast.error('Failed to load countries: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = async (country, field) => {
    const key = `${country.id}-${field}`;
    const currentValue = country[field];
    const newValue = !currentValue;

    // Optimistic Update
    setCountries(prev =>
      prev.map(c => (c.id === country.id ? { ...c, [field]: newValue } : c))
    );
    setUpdatingMap(prev => ({ ...prev, [key]: true }));

    try {
      const { error } = await supabase
        .from('countries')
        .update({ [field]: newValue })
        .eq('id', country.id);

      if (error) throw error;
      toast.success(`${country.name}: ${field.replace('_', ' ').toUpperCase()} updated`);
    } catch (err) {
      // Rollback on error
      setCountries(prev =>
        prev.map(c => (c.id === country.id ? { ...c, [field]: currentValue } : c))
      );
      toast.error(`Failed to update ${country.name}: ${err.message}`);
    } finally {
      setUpdatingMap(prev => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    }
  };

  // Filter & Search Logic
  const filteredCountries = useMemo(() => {
    return countries.filter(c => {
      const matchesSearch = c.name.toLowerCase().includes(search.toLowerCase()) || 
                            (c.code && c.code.toLowerCase().includes(search.toLowerCase())) ||
                            (c.continent && c.continent.toLowerCase().includes(search.toLowerCase()));
      
      if (filterActive === 'active') {
        return matchesSearch && c.is_active;
      }
      if (filterActive === 'inactive') {
        return matchesSearch && !c.is_active;
      }
      return matchesSearch;
    });
  }, [countries, search, filterActive]);

  // Statistics
  const stats = useMemo(() => {
    const total = countries.length;
    const active = countries.filter(c => c.is_active).length;
    const inactive = total - active;
    return { total, active, inactive };
  }, [countries]);

  return (
    <div className="p-6 max-w-7xl mx-auto pb-32">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 mb-12 border-b border-border pb-10">
        <div>
          <p className="text-brand text-[10px] font-black uppercase tracking-widest mb-2">Regional Controls</p>
          <h1 className="text-4xl font-bold text-text-primary tracking-tighter mb-2">Manage Countries</h1>
          <p className="text-text-muted text-sm max-w-2xl">
            Configure visibility for films, channels, and artists on a country-by-country basis. Hiding a country or resource applies instant Row Level Security filters across the public app.
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
        <div className="bg-surface border border-border rounded-2xl p-6 shadow-xl relative overflow-hidden group hover:border-brand/20 transition-all duration-300">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-text-muted text-xs font-black uppercase tracking-widest mb-1">Total Countries</p>
              <h3 className="text-3xl font-bold text-text-primary">{stats.total}</h3>
            </div>
            <div className="w-12 h-12 rounded-xl bg-surface-2 flex items-center justify-center text-text-secondary">
              <Icon icon="solar:global-linear" width="24" />
            </div>
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-border group-hover:bg-brand/40 transition-colors" />
        </div>

        <div className="bg-surface border border-border rounded-2xl p-6 shadow-xl relative overflow-hidden group hover:border-emerald-500/20 transition-all duration-300">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-text-muted text-xs font-black uppercase tracking-widest mb-1">Active Countries</p>
              <h3 className="text-3xl font-bold text-emerald-500">{stats.active}</h3>
            </div>
            <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-500">
              <Icon icon="solar:check-circle-linear" width="24" />
            </div>
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-border group-hover:bg-emerald-500/40 transition-colors" />
        </div>

        <div className="bg-surface border border-border rounded-2xl p-6 shadow-xl relative overflow-hidden group hover:border-rose-500/20 transition-all duration-300">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-text-muted text-xs font-black uppercase tracking-widest mb-1">Hidden Countries</p>
              <h3 className="text-3xl font-bold text-rose-500">{stats.inactive}</h3>
            </div>
            <div className="w-12 h-12 rounded-xl bg-rose-500/10 flex items-center justify-center text-rose-500">
              <Icon icon="solar:eye-closed-linear" width="24" />
            </div>
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-border group-hover:bg-rose-500/40 transition-colors" />
        </div>
      </div>

      {/* Filter and Search Controls */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mb-8 items-center">
        <div className="lg:col-span-8 flex gap-4">
          <div className="relative group w-48">
            <select
              value={filterActive}
              onChange={(e) => setFilterActive(e.target.value)}
              className="w-full h-12 bg-surface border border-border rounded-xl px-4 text-text-primary text-xs font-bold focus:border-brand focus:outline-none appearance-none cursor-pointer shadow-xl transition-all"
            >
              <option value="all">All Countries</option>
              <option value="active">Active Only</option>
              <option value="inactive">Hidden Only</option>
            </select>
            <div className="absolute inset-y-0 right-4 flex items-center pointer-events-none text-text-muted text-xs">▼</div>
          </div>
        </div>

        <div className="lg:col-span-4 relative group">
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search countries or codes..."
            className="w-full h-12 bg-surface border border-border rounded-xl px-5 pl-11 text-text-primary text-sm focus:border-brand focus:outline-none transition-all shadow-xl"
          />
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted opacity-50">🔍</span>
        </div>
      </div>

      {/* Table Container */}
      <div className="bg-surface border border-border rounded-2xl shadow-2xl overflow-hidden">
        {loading ? (
          <div className="p-20 flex flex-col items-center justify-center gap-4 text-text-muted">
            <Icon icon="solar:spinner-linear" width="40" className="animate-spin text-brand" />
            <p className="text-sm font-medium">Loading countries catalog...</p>
          </div>
        ) : filteredCountries.length === 0 ? (
          <div className="p-20 text-center text-text-muted">
            <Icon icon="solar:map-linear" width="48" className="mx-auto mb-4 opacity-30" />
            <p className="text-sm font-medium">No countries matched your search criteria.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-border bg-surface-2/50 text-[10px] font-black uppercase tracking-widest text-text-muted">
                  <th className="py-4 px-6">Country</th>
                  <th className="py-4 px-6">Code</th>
                  <th className="py-4 px-6">Continent</th>
                  <th className="py-4 px-6 text-center">Active Status</th>
                  <th className="py-4 px-6 text-center">Films Visible</th>
                  <th className="py-4 px-6 text-center">Channels Visible</th>
                  <th className="py-4 px-6 text-center">People Visible</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {filteredCountries.map(country => {
                  const isCountryDisabled = !country.is_active;
                  
                  return (
                    <tr 
                      key={country.id} 
                      className={`hover:bg-surface-2/30 transition-colors ${isCountryDisabled ? 'bg-surface-2/10' : ''}`}
                    >
                      {/* Name with Flag */}
                      <td className="py-4 px-6 font-bold text-text-primary">
                        <div className="flex items-center gap-3">
                          <Icon 
                            icon={`circle-flags:${country.code?.toLowerCase() || 'un'}`} 
                            className="w-7 h-7 rounded-full shadow-md object-cover border border-border" 
                          />
                          <span>{country.name}</span>
                        </div>
                      </td>

                      {/* Code */}
                      <td className="py-4 px-6 text-xs text-text-secondary font-mono">
                        {country.code || '—'}
                      </td>

                      {/* Continent */}
                      <td className="py-4 px-6 text-xs text-text-secondary font-semibold">
                        {country.continent || '—'}
                      </td>

                      {/* Toggle: Country Active */}
                      <td className="py-4 px-6 text-center">
                        <div className="flex justify-center">
                          <ToggleSwitch
                            checked={country.is_active}
                            onChange={() => handleToggle(country, 'is_active')}
                            disabled={updatingMap[`${country.id}-is_active`]}
                            activeColor="bg-brand"
                          />
                        </div>
                      </td>

                      {/* Toggle: Films Visible */}
                      <td className="py-4 px-6 text-center">
                        <div className="flex flex-col items-center justify-center">
                          <ToggleSwitch
                            checked={country.films_visible}
                            onChange={() => handleToggle(country, 'films_visible')}
                            disabled={updatingMap[`${country.id}-films_visible`]}
                            activeColor="bg-brand"
                            overridden={isCountryDisabled}
                          />
                          {isCountryDisabled && (
                            <span className="text-[9px] text-rose-500 font-bold uppercase tracking-wider mt-1 opacity-70">
                              Overridden
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Toggle: Channels Visible */}
                      <td className="py-4 px-6 text-center">
                        <div className="flex flex-col items-center justify-center">
                          <ToggleSwitch
                            checked={country.channels_visible}
                            onChange={() => handleToggle(country, 'channels_visible')}
                            disabled={updatingMap[`${country.id}-channels_visible`]}
                            activeColor="bg-brand"
                            overridden={isCountryDisabled}
                          />
                          {isCountryDisabled && (
                            <span className="text-[9px] text-rose-500 font-bold uppercase tracking-wider mt-1 opacity-70">
                              Overridden
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Toggle: People Visible */}
                      <td className="py-4 px-6 text-center">
                        <div className="flex flex-col items-center justify-center">
                          <ToggleSwitch
                            checked={country.people_visible}
                            onChange={() => handleToggle(country, 'people_visible')}
                            disabled={updatingMap[`${country.id}-people_visible`]}
                            activeColor="bg-brand"
                            overridden={isCountryDisabled}
                          />
                          {isCountryDisabled && (
                            <span className="text-[9px] text-rose-500 font-bold uppercase tracking-wider mt-1 opacity-70">
                              Overridden
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// Toggle Switch Subcomponent
function ToggleSwitch({ checked, onChange, disabled, activeColor = 'bg-brand', overridden = false }) {
  return (
    <button
      type="button"
      onClick={onChange}
      disabled={disabled}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-all focus:outline-none ${
        overridden 
          ? 'bg-surface-3 opacity-40 cursor-not-allowed' 
          : checked 
            ? activeColor 
            : 'bg-surface-3 hover:bg-surface-3/80'
      } ${disabled ? 'opacity-50 cursor-wait' : 'cursor-pointer'}`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-md transition-transform ${
          overridden
            ? 'translate-x-1'
            : checked 
              ? 'translate-x-6' 
              : 'translate-x-1'
        }`}
      />
    </button>
  );
}
