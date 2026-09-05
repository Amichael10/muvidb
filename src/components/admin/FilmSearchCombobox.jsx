import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { Icon } from '@iconify/react';

export default function FilmSearchCombobox({
  value,
  onChange,
  films = [],
  placeholder = 'Search film by title or year…',
  disabled = false,
  className = '',
}) {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedFilm, setSelectedFilm] = useState(null);
  const containerRef = useRef(null);
  const searchInputRef = useRef(null);

  // Sync selected film object from either local films list or fetch from DB
  useEffect(() => {
    if (!value) {
      setSelectedFilm(null);
      return;
    }
    const localMatch = films.find(f => f.id === value);
    if (localMatch) {
      setSelectedFilm(localMatch);
      return;
    }
    // Otherwise fetch film by ID
    let isMounted = true;
    (async () => {
      try {
        const { data, error } = await supabase
          .from('films')
          .select('id, title, year, release_date, poster_url, trailer_youtube_id, trailer_external_url, youtube_watch_url')
          .eq('id', value)
          .single();
        if (!error && data && isMounted) {
          setSelectedFilm(data);
        }
      } catch (err) {
        console.error('Error fetching selected film in combobox:', err);
      }
    })();
    return () => { isMounted = false; };
  }, [value, films]);

  // Handle outside click to close dropdown
  useEffect(() => {
    function handleClickOutside(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Focus input when opened
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      setTimeout(() => searchInputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Debounced search on query
  useEffect(() => {
    if (!isOpen) return;

    if (!query.trim()) {
      if (films.length > 0) {
        setSearchResults(films.slice(0, 30));
      } else {
        fetchDefaultFilms();
      }
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const cleanQuery = query.trim();
        const { data, error } = await supabase
          .from('films')
          .select('id, title, year, release_date, poster_url, trailer_youtube_id, trailer_external_url, youtube_watch_url')
          .ilike('title', `%${cleanQuery}%`)
          .order('release_date', { ascending: false, nullsLast: true })
          .limit(25);

        if (!error && data) {
          setSearchResults(data);
        }
      } catch (err) {
        console.error('Error searching films:', err);
      } finally {
        setIsSearching(false);
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [query, isOpen, films]);

  const fetchDefaultFilms = async () => {
    setIsSearching(true);
    try {
      const { data, error } = await supabase
        .from('films')
        .select('id, title, year, release_date, poster_url, trailer_youtube_id, trailer_external_url, youtube_watch_url')
        .order('release_date', { ascending: false, nullsLast: true })
        .limit(30);
      if (!error && data) {
        setSearchResults(data);
      }
    } catch (err) {
      console.error('Error loading default films:', err);
    } finally {
      setIsSearching(false);
    }
  };

  const handleSelect = (film) => {
    setSelectedFilm(film);
    setIsOpen(false);
    setQuery('');
    if (onChange) {
      onChange(film.id, film);
    }
  };

  const handleClear = (e) => {
    e.stopPropagation();
    setSelectedFilm(null);
    setQuery('');
    if (onChange) {
      onChange('', null);
    }
  };

  const hasYouTube = (f) => !!(f?.trailer_youtube_id || f?.youtube_watch_url || (f?.trailer_external_url && f.trailer_external_url.includes('youtu')));

  const getDisplayYear = (f) => {
    if (!f) return null;
    if (f.year) return f.year;
    if (f.release_date) {
      try {
        return new Date(f.release_date).getFullYear() || f.release_date.slice(0, 4);
      } catch {
        return null;
      }
    }
    return null;
  };

  return (
    <div className={`relative w-full ${className}`} ref={containerRef}>
      {/* Combobox Trigger Button */}
      <div
        onClick={() => {
          if (!disabled) {
            const next = !isOpen;
            setIsOpen(next);
            if (next && !searchResults.length) fetchDefaultFilms();
          }
        }}
        className={`w-full min-h-[38px] px-3 py-1.5 bg-surface border rounded-xl flex items-center justify-between gap-2 cursor-pointer transition-all duration-200 ${
          isOpen
            ? 'border-brand shadow-[0_0_12px_rgba(255,90,31,0.25)] ring-1 ring-brand'
            : 'border-white/10 hover:border-white/25 hover:bg-surface-2'
        } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          {selectedFilm?.poster_url ? (
            <img
              src={selectedFilm.poster_url}
              alt=""
              className="w-5 h-7 rounded object-cover flex-shrink-0 border border-white/10"
              onError={(e) => { e.currentTarget.style.display = 'none'; }}
            />
          ) : (
            <div className="w-5 h-7 rounded bg-white/5 border border-white/10 flex items-center justify-center flex-shrink-0 text-white/40">
              <Icon icon="solar:clapperboard-linear" width="14" />
            </div>
          )}

          <div className="min-w-0 flex-1">
            {selectedFilm ? (
              <div className="flex items-center gap-1.5 truncate">
                <span className="text-xs font-bold text-white truncate">
                  {selectedFilm.title}
                </span>
                {getDisplayYear(selectedFilm) && (
                  <span className="text-[10px] text-text-muted flex-shrink-0 font-mono">
                    ({getDisplayYear(selectedFilm)})
                  </span>
                )}
                {hasYouTube(selectedFilm) && (
                  <span className="inline-flex items-center gap-0.5 px-1 py-0.2 rounded text-[8px] font-black uppercase bg-red-500/20 text-red-400 border border-red-500/30 flex-shrink-0">
                    <Icon icon="mdi:youtube" width="10" /> YT
                  </span>
                )}
              </div>
            ) : (
              <span className="text-xs text-text-muted truncate">
                {placeholder}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1.5 flex-shrink-0">
          {selectedFilm && !disabled && (
            <button
              type="button"
              onClick={handleClear}
              className="p-1 hover:bg-white/10 rounded-lg text-text-muted hover:text-white transition-colors"
              title="Clear selection"
            >
              <Icon icon="solar:close-circle-bold" width="14" />
            </button>
          )}
          <Icon icon="solar:magnifer-linear" className={`text-text-muted ${isOpen ? 'text-brand' : ''}`} width="14" />
        </div>
      </div>

      {/* Dropdown Panel */}
      {isOpen && (
        <div className="absolute left-0 top-full mt-1.5 w-full min-w-[280px] z-50 bg-[#16161c] border border-white/15 rounded-xl shadow-[0_16px_40px_rgba(0,0,0,0.85)] overflow-hidden backdrop-blur-xl">
          {/* Live Search Input */}
          <div className="p-2.5 border-b border-white/10 bg-[#111116] flex items-center gap-2">
            <Icon icon="solar:magnifer-linear" className="text-brand flex-shrink-0" width="16" />
            <input
              ref={searchInputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Type film title or year…"
              className="w-full bg-transparent text-xs text-white placeholder-text-muted focus:outline-none"
            />
            {isSearching ? (
              <Icon icon="solar:spinner-linear" className="text-brand animate-spin flex-shrink-0" width="16" />
            ) : query ? (
              <button
                type="button"
                onClick={() => setQuery('')}
                className="text-text-muted hover:text-white"
              >
                <Icon icon="solar:close-circle-linear" width="14" />
              </button>
            ) : null}
          </div>

          {/* Film List */}
          <div className="max-h-64 overflow-y-auto divide-y divide-white/5 py-1">
            {searchResults.length === 0 ? (
              <div className="px-4 py-6 text-center text-xs text-text-muted">
                {isSearching ? 'Searching database…' : 'No films found matching your search'}
              </div>
            ) : (
              searchResults.map((film) => {
                const isSelected = selectedFilm?.id === film.id;
                const ytReady = hasYouTube(film);
                const yearStr = getDisplayYear(film);

                return (
                  <div
                    key={film.id}
                    onClick={() => handleSelect(film)}
                    className={`px-3 py-2 flex items-center gap-2.5 cursor-pointer transition-colors ${
                      isSelected
                        ? 'bg-brand/15 text-white'
                        : 'hover:bg-white/5 text-text-secondary hover:text-white'
                    }`}
                  >
                    {film.poster_url ? (
                      <img
                        src={film.poster_url}
                        alt=""
                        className="w-6 h-8 rounded object-cover flex-shrink-0 border border-white/10"
                        onError={(e) => { e.currentTarget.style.display = 'none'; }}
                      />
                    ) : (
                      <div className="w-6 h-8 rounded bg-white/5 border border-white/10 flex items-center justify-center flex-shrink-0 text-text-muted">
                        <Icon icon="solar:clapperboard-linear" width="14" />
                      </div>
                    )}

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold truncate text-white">
                          {film.title}
                        </span>
                        {yearStr && (
                          <span className="text-[10px] text-text-muted flex-shrink-0 font-mono">
                            ({yearStr})
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        {ytReady ? (
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded text-[8px] font-bold bg-red-500/15 text-red-400 border border-red-500/30">
                            <Icon icon="mdi:youtube" width="10" /> YouTube Ready
                          </span>
                        ) : (
                          <span className="text-[9px] text-text-muted">
                            Catalogue Entry
                          </span>
                        )}
                      </div>
                    </div>

                    {isSelected && (
                      <Icon icon="solar:check-circle-bold" className="text-brand flex-shrink-0" width="16" />
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
