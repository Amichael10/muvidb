import { useEffect, useMemo, useRef, useState } from 'react';
import { Icon } from '@iconify/react';
import { supabase } from '../../lib/supabase';
import { ALL_ROLES, formatRole } from '../../lib/creditRoles';

// Base canonical list of primary roles for Nollywood talents & creators
const DEFAULT_PRIMARY_ROLES = [
  'Actor',
  'Director',
  'Producer',
  'Executive producer',
  'Writer',
  'Cinematographer',
  'Editor',
  'Composer',
  'Sound recordist',
  'Production designer',
  'Art director',
  'Costume designer',
  'Makeup artist',
  'Gaffer',
  'Skit Maker',
  'Production manager',
  'Assistant director',
  'Colorist',
  'VFX',
  'Stunts',
  'Casting director',
  'Location manager',
  'Production assistant',
  'Camera assistant',
  'Other'
];

export default function SearchableRolePicker({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(value || 'Actor');
  const [dbRoles, setDbRoles] = useState([]);
  const wrapRef = useRef(null);

  useEffect(() => {
    setQuery(value || 'Actor');
  }, [value]);

  // Load distinct existing roles from DB so any previously created custom roles are available
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await supabase
          .from('people')
          .select('known_for_department')
          .not('known_for_department', 'is', null)
          .limit(200);
        if (!cancelled && data) {
          const unique = [...new Set(data.map((r) => r.known_for_department).filter(Boolean))];
          setDbRoles(unique);
        }
      } catch (err) {
        console.warn('Could not fetch existing roles from DB:', err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    const onDoc = (e) => {
      if (!wrapRef.current?.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  // Combine default roles, ALL_ROLES from credit system, and DB roles
  const allAvailableRoles = useMemo(() => {
    const set = new Set(DEFAULT_PRIMARY_ROLES);
    // Add all roles from creditRoles
    for (const r of ALL_ROLES) {
      if (r.label) set.add(r.label);
      const formatted = formatRole(r.value);
      if (formatted) set.add(formatted);
    }
    // Add all distinct roles found in DB
    for (const r of dbRoles) {
      if (r) set.add(r);
    }
    if (value) set.add(value);
    return Array.from(set);
  }, [dbRoles, value]);

  const filteredRoles = useMemo(() => {
    const q = (query || '').trim().toLowerCase();
    if (!q) return allAvailableRoles;
    return allAvailableRoles.filter((r) => r.toLowerCase().includes(q));
  }, [allAvailableRoles, query]);

  const exactMatch = allAvailableRoles.some(
    (r) => r.toLowerCase() === (query || '').trim().toLowerCase()
  );

  return (
    <div className="relative" ref={wrapRef}>
      <div className="flex items-center gap-1.5">
        <div className="relative flex-1">
          <input
            type="text"
            placeholder="Search role (e.g. Sound recordist, Gaffer, Actor)..."
            value={query}
            onChange={(e) => {
              const val = e.target.value;
              setQuery(val);
              onChange(val);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            className="w-full bg-surface-2 border border-border p-3 pr-8 rounded-lg text-sm font-medium focus:border-brand outline-none transition-colors"
          />
          <button
            type="button"
            tabIndex={-1}
            onClick={() => setOpen(!open)}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary"
          >
            <Icon icon={open ? 'solar:alt-arrow-up-linear' : 'solar:alt-arrow-down-linear'} width="16" />
          </button>
        </div>

        <button
          type="button"
          onClick={() => {
            const trimmed = query.trim();
            if (trimmed) {
              onChange(trimmed);
              setOpen(false);
            } else {
              setOpen(true);
            }
          }}
          className="p-3 rounded-lg bg-surface-2 border border-border hover:border-brand/50 text-text-muted hover:text-brand transition-all flex items-center gap-1 text-xs font-bold"
          title="Create or set this role"
        >
          <Icon icon="solar:add-circle-bold" width="18" />
        </button>
      </div>

      {open && (
        <div className="absolute z-50 left-0 right-0 top-full mt-1 max-h-60 overflow-y-auto rounded-xl border border-border bg-surface shadow-2xl backdrop-blur-md">
          {query.trim() && !exactMatch && (
            <button
              type="button"
              onClick={() => {
                const custom = query.trim();
                onChange(custom);
                setQuery(custom);
                setOpen(false);
              }}
              className="w-full flex items-center gap-2 px-4 py-2.5 text-left bg-brand/10 hover:bg-brand/20 text-brand border-b border-border text-xs font-bold transition-colors"
            >
              <Icon icon="solar:add-circle-linear" width="16" />
              <span>Create new role: &quot;{query.trim()}&quot;</span>
            </button>
          )}

          {filteredRoles.map((role) => {
            const isSelected = value && value.toLowerCase() === role.toLowerCase();
            return (
              <button
                key={role}
                type="button"
                onClick={() => {
                  onChange(role);
                  setQuery(role);
                  setOpen(false);
                }}
                className={`w-full flex items-center justify-between px-4 py-2.5 text-left border-b border-border/40 hover:bg-surface-2 transition-colors ${
                  isSelected ? 'bg-brand/15 text-brand font-bold' : 'text-text-primary text-xs'
                }`}
              >
                <span>{role}</span>
                {isSelected && <Icon icon="solar:check-read-linear" className="text-brand" width="16" />}
              </button>
            );
          })}

          {filteredRoles.length === 0 && !query.trim() && (
            <p className="px-4 py-3 text-xs text-text-muted italic">Type to search or define a role</p>
          )}
        </div>
      )}
    </div>
  );
}
