import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { Icon } from '@iconify/react';

export default function FilmSearchCombobox({
  value,
  onChange,
  films = [],
  placeholder = 'Search any Nollywood film by title or year…',
  disabled = false,
  className = '',
}) {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedFilm, setSelectedFilm] = useState(null);
  const containerRef = useRef(null);
  const inputRef = useRef(null);

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
          .maybeSingle();
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

  const fetchDefaultFilms = async () => {
    setIsSearching(true);
    try {
      const { data, error } = await supabase
        .from('films')
        .select('id, title, year, release_date, poster_url, trailer_youtube_id, trailer_external_url, youtube_watch_url')
        .not('youtube_watch_url', 'is', null)
        .order('release_date', { ascending: false, nullsLast: true })
        .limit(40);
      if (!error && data) {
        setSearchResults(data);
      } else if (films.length > 0) {
        setSearchResults(films.slice(0, 40));
      }
    } catch (err) {
      console.error('Error loading default films:', err);
      if (films.length > 0) setSearchResults(films.slice(0, 40));
    } finally {
      setIsSearching(false);
    }
  };

  // Debounced search on query
  useEffect(() => {
    if (!isOpen) return;

    const trimmed = query.trim();
    if (!trimmed) {
      fetchDefaultFilms();
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        let queryBuilder = supabase
          .from('films')
          .select('id, title, year, release_date, poster_url, trailer_youtube_id, trailer_external_url, youtube_watch_url');

        // Check if query is a YouTube URL
        if (trimmed.includes('youtube.com') || trimmed.includes('youtu.be')) {
          queryBuilder = queryBuilder.ilike('youtube_watch_url', `%${trimmed}%`);
        } else {
          queryBuilder = queryBuilder.ilike('title', `%${trimmed}%`);
        }

        const { data, error } = await queryBuilder
          .order('release_date', { ascending: false, nullsLast: true })
          .limit(30);

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
  }, [query, isOpen]);

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
    setTimeout(() => {
      inputRef.current?.focus();
      setIsOpen(true);
    }, 50);
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
      {/* Combobox Search Input Bar */}
      <div
        className={`w-full min-h-[38px] px-3 py-1 bg-surface border rounded-xl flex items-center justify-between gap-2 transition-all duration-200 ${
          isOpen
            ? 'border-brand shadow-[0_0_12px_rgba(255,90,31,0.25)] ring-1 ring-brand bg-surface-2'
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

          {/* When a film is selected and dropdown is closed, show selected title badge */}
          {selectedFilm && !isOpen ? (
            <div
              onClick={() => {
                if (!disabled) {
                  setIsOpen(true);
                  setTimeout(() => inputRef.current?.focus(), 50);
                }
              }}
              className="flex items-center gap-1.5 truncate cursor-pointer flex-1"
            >
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
            /* Otherwise show direct search input */
            <input
              ref={inputRef}
              type="text"
              disabled={disabled}
              value={query}
              onFocus={() => {
                setIsOpen(true);
                if (!searchResults.length) fetchDefaultFilms();
              }}
              onChange={(e) => {
                setQuery(e.target.value);
                setIsOpen(true);
              }}
              placeholder={selectedFilm ? `Current: ${selectedFilm.title} (Type to search another…)` : placeholder}
              className="w-full bg-transparent text-xs font-bold text-white placeholder-text-muted focus:outline-none py-1"
            />
          )}
        </div>

        {/* Action icons */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {isSearching && (
            <Icon icon="solar:spinner-linear" className="text-brand animate-spin" width="15" />
          )}

          {selectedFilm && !disabled && (
            <button
              type="button"
              onClick={handleClear}
              className="p-1 hover:bg-white/10 rounded-lg text-text-muted hover:text-white transition-colors"
              title="Clear selection and search another film"
            >
              <Icon icon="solar:close-circle-bold" width="15" />
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              if (!disabled) {
                setIsOpen(prev => !prev);
                if (!isOpen) {
                  setTimeout(() => inputRef.current?.focus(), 50);
                  if (!searchResults.length) fetchDefaultFilms();
                }
              }
            }}
            className="p-1 hover:bg-white/10 rounded-lg text-text-muted hover:text-white transition-colors"
          >
            <Icon icon="solar:magnifer-linear" className={isOpen ? 'text-brand' : ''} width="15" />
          </button>
        </div>
      </div>

      {/* Dropdown Live Results Panel */}
      {isOpen && (
        <div className="absolute left-0 top-full mt-1.5 w-full min-w-[320px] max-w-[500px] z-50 bg-[#16161c] border border-white/15 rounded-xl shadow-[0_16px_40px_rgba(0,0,0,0.85)] overflow-hidden backdrop-blur-xl animate-fade-in">
          <div className="px-3 py-2 border-b border-white/10 bg-[#111116] flex items-center justify-between text-[10px] text-text-muted">
            <span className="font-bold uppercase tracking-wider">
              {query ? `Searching "${query}"` : 'Latest Verified Nollywood Films'}
            </span>
            <span>{searchResults.length} results</span>
          </div>

          {/* Film List */}
          <div className="max-h-72 overflow-y-auto divide-y divide-white/5 py-1">
            {searchResults.length === 0 ? (
              <div className="px-4 py-8 text-center text-xs text-text-muted">
                {isSearching ? (
                  <div className="flex items-center justify-center gap-2 text-brand">
                    <Icon icon="solar:spinner-linear" className="animate-spin" width="16" />
                    <span>Searching database…</span>
                  </div>
                ) : (
                  <div>
                    <p className="font-bold text-white/70">No films found matching "{query}"</p>
                    <p className="text-[10px] mt-1 text-text-muted">Try typing a different keyword or year</p>
                  </div>
                )}
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
                    className={`px-3 py-2.5 flex items-center gap-3 cursor-pointer transition-colors ${
                      isSelected
                        ? 'bg-brand/15 text-white'
                        : 'hover:bg-white/5 text-text-secondary hover:text-white'
                    }`}
                  >
                    {film.poster_url ? (
                      <img
                        src={film.poster_url}
                        alt=""
                        className="w-7 h-9 rounded object-cover flex-shrink-0 border border-white/10 shadow-sm"
                        onError={(e) => { e.currentTarget.style.display = 'none'; }}
                      />
                    ) : (
                      <div className="w-7 h-9 rounded bg-white/5 border border-white/10 flex items-center justify-center flex-shrink-0 text-text-muted">
                        <Icon icon="solar:clapperboard-linear" width="16" />
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
                      <div className="flex items-center gap-2 mt-1">
                        {ytReady ? (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[8px] font-bold bg-red-500/15 text-red-400 border border-red-500/30">
                            <Icon icon="mdi:youtube" width="11" /> YouTube Video Ready
                          </span>
                        ) : (
                          <span className="text-[9px] text-text-muted">
                            Catalogue Entry
                          </span>
                        )}
                      </div>
                    </div>

                    {isSelected && (
                      <Icon icon="solar:check-circle-bold" className="text-brand flex-shrink-0" width="18" />
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
