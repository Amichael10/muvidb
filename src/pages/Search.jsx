import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import FilmCard from '../components/film/FilmCard';
import PersonCard from '../components/person/PersonCard';
// import { genres } from '../data/mockData';

export default function Search() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialQuery = searchParams.get('q') || '';
  
  const [query, setQuery] = useState(initialQuery);
  const [activeTab, setActiveTab] = useState('films'); // 'films' | 'people'
  const [films, setFilms] = useState([]);
  const [people, setPeople] = useState([]);
  const [dbGenres, setDbGenres] = useState([]);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    document.title = "FilmDba | Search";
    fetchGenres();
    if (initialQuery) {
      fetchAll();
    } else {
      setLoading(false);
    }
  }, [initialQuery]);

  const fetchGenres = async () => {
    try {
      const { data, error } = await supabase
        .from('genres')
        .select('name')
        .order('name');
      if (error) throw error;
      setDbGenres(data.map(g => g.name) || []);
    } catch (err) {
      console.error(err);
    }
  };
  
  const fetchAll = async () => {
    setLoading(true);
    try {
      // 1. Fetch Films
      const res = await fetch(`/api/films?search=${encodeURIComponent(initialQuery)}&limit=50`);
      if (!res.ok) throw new Error(`Failed to fetch films: ${res.status}`);
      const { films: filmData } = await res.json();
      setFilms(filmData || []);

      // 2. Fetch People
      const { data: peopleData, error: peopleError } = await supabase
        .from('people')
        .select('*')
        .ilike('name', `%${initialQuery}%`);

      if (peopleError) throw peopleError;
      setPeople(peopleData || []);

    } catch (error) {
      console.error('Error searching:', error);
    } finally {
      setLoading(false);
    }
  };

  // Filters for films
  const [selectedGenre, setSelectedGenre] = useState('');
  const [yearRange, setYearRange] = useState(2000);
  const [minRating, setMinRating] = useState(0);

  // Update URL when query changes (debounced or on submit)
  const handleSearch = (e) => {
    e.preventDefault();
    if (query) {
      setSearchParams({ q: query });
    } else {
      setSearchParams({});
    }
  };

  // Filter logic
  const filteredFilms = films.filter(f => {
    const filmGenres = f.genres || [];
    const matchesGenre = selectedGenre ? filmGenres.includes(selectedGenre) : true;
    const matchesYear = (f.year || 0) >= yearRange;
    const matchesRating = (f.tmdb_rating || f.rating || 0) >= minRating;
    return matchesGenre && matchesYear && matchesRating;
  });

  const filteredPeople = people;

  return (
    <div className="w-full bg-bg min-h-screen pt-24 pb-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Search Bar */}
        <div className="max-w-3xl mx-auto mb-12">
          <form onSubmit={handleSearch} className="relative w-full">
            <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gold">
                <circle cx="11" cy="11" r="8"/>
                <line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
            </div>
            <input 
              type="text" 
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search films, people..." 
              className="w-full bg-surface border-2 border-border rounded-full py-4 pl-14 pr-32 text-lg text-text-primary placeholder-text-muted focus:outline-none focus:border-gold focus:ring-1 focus:ring-gold transition-all shadow-lg"
            />
            <button type="submit" className="absolute inset-y-2 right-2 bg-gold text-bg px-6 rounded-full font-bold hover:scale-105 active:scale-95 transition-all duration-300 min-h-[44px]">
              Search
            </button>
          </form>
        </div>

        {/* Tabs */}
        <div className="flex justify-center border-b border-border mb-8">
          <button 
            onClick={() => setActiveTab('films')}
            className={`px-8 py-4 font-heading font-bold text-lg transition-colors relative ${activeTab === 'films' ? 'text-gold' : 'text-text-muted hover:text-text-primary'}`}
          >
            Films
            {activeTab === 'films' && (
              <div className="absolute bottom-0 left-0 w-full h-1 bg-gold rounded-t-full"></div>
            )}
          </button>
          <button 
            onClick={() => setActiveTab('people')}
            className={`px-8 py-4 font-heading font-bold text-lg transition-colors relative ${activeTab === 'people' ? 'text-gold' : 'text-text-muted hover:text-text-primary'}`}
          >
            People
            {activeTab === 'people' && (
              <div className="absolute bottom-0 left-0 w-full h-1 bg-gold rounded-t-full"></div>
            )}
          </button>
        </div>

        {/* Filters (Films Only) */}
        {activeTab === 'films' && (
          <div className="bg-surface p-4 rounded-2xl border border-border flex flex-wrap items-center gap-6 mb-8">
            <div className="flex items-center gap-3">
              <label className="text-sm text-text-muted font-medium">Genre:</label>
              <select 
                value={selectedGenre}
                onChange={(e) => setSelectedGenre(e.target.value)}
                className="bg-surface-2 border border-border text-text-primary text-sm rounded-lg focus:ring-gold focus:border-gold block p-2 outline-none"
              >
                <option value="">All Genres</option>
                {dbGenres.map(g => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>
            
            <div className="flex items-center gap-3 flex-1 min-w-[200px]">
              <label className="text-sm text-text-muted font-medium whitespace-nowrap">Year: {yearRange}+</label>
              <input 
                type="range" 
                min="2000" 
                max="2025" 
                value={yearRange}
                onChange={(e) => setYearRange(parseInt(e.target.value))}
                className="w-full h-2 bg-surface-2 rounded-lg appearance-none cursor-pointer accent-gold"
              />
            </div>

            <div className="flex items-center gap-3">
              <label className="text-sm text-text-muted font-medium whitespace-nowrap">Min Rating: {minRating}</label>
              <input 
                type="range" 
                min="0" 
                max="10" 
                step="0.5"
                value={minRating}
                onChange={(e) => setMinRating(parseFloat(e.target.value))}
                className="w-32 h-2 bg-surface-2 rounded-lg appearance-none cursor-pointer accent-gold"
              />
            </div>
          </div>
        )}

        {/* Results */}
        {activeTab === 'films' ? (
          filteredFilms.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
              {filteredFilms.map(film => (
                <div key={film.id} className="flex justify-center">
                  <FilmCard film={film} size="md" />
                </div>
              ))}
            </div>
          ) : (
            <EmptyState query={initialQuery} />
          )
        ) : (
          filteredPeople.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-6">
              {filteredPeople.map(person => (
                <PersonCard key={person.id} person={person} variant="compact" />
              ))}
            </div>
          ) : (
            <EmptyState query={initialQuery} />
          )
        )}

      </div>
    </div>
  );
}

function EmptyState({ query }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" className="text-gold/50 mb-6">
        <rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18"/>
        <line x1="7" y1="2" x2="7" y2="22"/>
        <line x1="17" y1="2" x2="17" y2="22"/>
        <line x1="2" y1="12" x2="22" y2="12"/>
        <line x1="2" y1="7" x2="7" y2="7"/>
        <line x1="2" y1="17" x2="7" y2="17"/>
        <line x1="17" y1="17" x2="22" y2="17"/>
        <line x1="17" y1="7" x2="22" y2="7"/>
      </svg>
      <h3 className="font-heading font-bold text-2xl text-text-primary mb-2">
        No results found
      </h3>
      <p className="text-text-muted text-lg max-w-md">
        We couldn't find anything matching "{query}". Try adjusting your search or filters.
      </p>
    </div>
  );
}
