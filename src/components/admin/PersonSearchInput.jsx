import React, { useEffect, useRef, useState } from 'react';
import { Icon } from '@iconify/react';
import toast from 'react-hot-toast';
import { searchPeopleByName } from '../../lib/peopleSearch';
import { supabase } from '../../lib/supabase';

/**
 * Searchable Person combobox with live Supabase lookup + inline "+ Create new profile".
 * Keeps `person_id` linked cleanly so credits never duplicate existing actors/crew.
 */
export default function PersonSearchInput({
  value = '',
  personId = null,
  onChange,
  placeholder = 'Search or type name…',
  defaultDepartment = 'Acting',
  className = '',
  inputClassName = '',
}) {
  const [query, setQuery] = useState(value || '');
  const [results, setResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);
  const timerRef = useRef(null);

  // Sync external value changes (e.g., when extraction or mention-click updates the row)
  useEffect(() => {
    setQuery(value || '');
  }, [value]);

  // Close dropdown on click outside
  useEffect(() => {
    const handleOutsideClick = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  // Cleanup debounce timer on unmount
  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  const runSearch = (text) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    const trimmed = String(text || '').trim();
    if (trimmed.length < 2) {
      setResults([]);
      setIsSearching(false);
      return;
    }
    setIsSearching(true);
    timerRef.current = setTimeout(async () => {
      try {
        const matches = await searchPeopleByName(trimmed, {
          limit: 8,
          useCohere: false,
          select: 'id, name, slug, photo_url, known_for_department, film_count, is_verified',
        });
        setResults(Array.isArray(matches) ? matches : []);
      } catch (err) {
        console.warn('[PersonSearchInput] search failed:', err);
        setResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 220);
  };

  const handleInputChange = (e) => {
    const next = e.target.value;
    setQuery(next);
    setIsOpen(true);
    // Typing edits the name — clear any stale person_id until the user picks/creates one
    onChange?.({ name: next, person_id: null, photo_url: null });
    runSearch(next);
  };

  const handleSelectPerson = (person) => {
    setQuery(person.name);
    setIsOpen(false);
    setResults([]);
    onChange?.({
      name: person.name,
      person_id: person.id,
      photo_url: person.photo_url || null,
      slug: person.slug || null,
    });
  };

  const handleCreatePerson = async () => {
    const trimmed = query.trim();
    if (!trimmed || isCreating) return;
    setIsCreating(true);
    try {
      const insertPayload = {
        name: trimmed,
        nationality: 'Nigerian',
        gender: 'Prefer not to say',
        known_for_department: defaultDepartment || 'Acting',
      };
      const { data, error } = await supabase
        .from('people')
        .insert([insertPayload])
        .select('id, name, slug, photo_url, known_for_department')
        .single();
      if (error) throw error;

      setQuery(data.name);
      setIsOpen(false);
      setResults([]);
      onChange?.({
        name: data.name,
        person_id: data.id,
        photo_url: data.photo_url || null,
        slug: data.slug || null,
      });
      toast.success(`Created new profile for "${data.name}"`);
    } catch (err) {
      toast.error(err?.message || 'Failed to create person profile');
    } finally {
      setIsCreating(false);
    }
  };

  const trimmedQuery = query.trim();
  const hasExactMatch = results.some(
    (p) => (p.name || '').trim().toLowerCase() === trimmedQuery.toLowerCase(),
  );

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <div className="relative flex items-center">
        <input
          type="text"
          value={query}
          onChange={handleInputChange}
          onFocus={() => {
            if (trimmedQuery.length >= 2) {
              setIsOpen(true);
              if (results.length === 0) runSearch(trimmedQuery);
            }
          }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') setIsOpen(false);
          }}
          placeholder={placeholder}
          className={
            inputClassName ||
            `w-full rounded border bg-surface-2 px-2.5 py-1.5 pr-16 text-xs text-text-primary outline-none transition-colors ${
              personId
                ? 'border-emerald-500/50 focus:border-emerald-400'
                : 'border-border focus:border-brand'
            }`
          }
        />

        <div className="pointer-events-none absolute right-2 flex items-center gap-1">
          {isSearching && (
            <Icon icon="solar:spinner-linear" className="animate-spin text-brand" width="13" />
          )}
          {!isSearching && personId && (
            <span
              className="inline-flex items-center gap-0.5 rounded bg-emerald-500/15 px-1.5 py-0.5 text-[9px] font-bold text-emerald-400"
              title="Linked to existing MuviDB person profile"
            >
              <Icon icon="solar:check-circle-bold" width="11" />
              DB
            </span>
          )}
        </div>
      </div>

      {isOpen && trimmedQuery.length >= 2 && (
        <div className="absolute left-0 right-0 top-full z-40 mt-1 max-h-64 overflow-y-auto rounded-xl border border-border bg-surface p-1.5 shadow-2xl">
          {isSearching && results.length === 0 ? (
            <div className="flex items-center gap-2 px-2.5 py-2 text-xs text-text-muted">
              <Icon icon="solar:spinner-linear" className="animate-spin text-brand" width="14" />
              <span>Checking MuviDB directory…</span>
            </div>
          ) : results.length > 0 ? (
            <div className="space-y-0.5">
              {results.map((person) => (
                <button
                  key={person.id}
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    handleSelectPerson(person);
                  }}
                  className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-surface-2"
                >
                  {person.photo_url ? (
                    <img
                      src={person.photo_url}
                      alt=""
                      className="h-7 w-7 shrink-0 rounded-full border border-border object-cover"
                    />
                  ) : (
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand/10 text-[11px] font-black text-brand">
                      {(person.name || '?').charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1">
                      <span className="truncate text-xs font-bold text-text-primary">
                        {person.name}
                      </span>
                      {person.is_verified && (
                        <Icon icon="solar:verified-check-bold" className="shrink-0 text-emerald-400" width="12" />
                      )}
                    </div>
                    <p className="truncate text-[10px] text-text-muted">
                      {person.known_for_department || 'Talent'}
                      {person.film_count ? ` · ${person.film_count} credits` : ''}
                    </p>
                  </div>
                  <span className="shrink-0 rounded bg-brand/10 px-1.5 py-0.5 text-[9px] font-bold uppercase text-brand">
                    Select
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <p className="px-2.5 py-1.5 text-[11px] text-text-muted">
              No existing profile matches &ldquo;{trimmedQuery}&rdquo;.
            </p>
          )}

          {!hasExactMatch && (
            <div className="mt-1 border-t border-border/50 pt-1">
              <button
                type="button"
                disabled={isCreating}
                onMouseDown={(e) => {
                  e.preventDefault();
                  handleCreatePerson();
                }}
                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs font-bold text-brand transition-colors hover:bg-brand/10 disabled:opacity-50"
              >
                <Icon
                  icon={isCreating ? 'solar:spinner-linear' : 'solar:user-plus-bold'}
                  className={isCreating ? 'animate-spin' : ''}
                  width="14"
                />
                <span>
                  {isCreating
                    ? `Creating "${trimmedQuery}"…`
                    : `+ Create new person "${trimmedQuery}"`}
                </span>
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
