import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import FilmCard from '../components/film/FilmCard';
import PersonCard from '../components/person/PersonCard';

export default function Search() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialQuery = searchParams.get('q') || '';
  
  const [query, setQuery] = useState(initialQuery);
  const [activeTab, setActiveTab] = useState('films'); // 'films' | 'people' | 'companies'
  const [films, setFilms] = useState([]);
  const [people, setPeople] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [dbGenres, setDbGenres] = useState([]);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    document.title = "Lumi | Search";
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
      setDbGenres((data || []).map(g => g.name));
    } catch (err) {
      console.error(err);
    }
  };
  
  const fetchAll = async () => {
    setLoading(true);
    try {
      // 1. Fetch Films (Direct Supabase)
      const { data: filmData, error: filmError } = await supabase
        .from('films')
        .select(`
          id, title, poster_url, backdrop_url, year, language, 
          runtime_minutes, view_count, average_rating, nfvcb_rating,
          film_genres!left(genres(name))
        `)
        .ilike('title', `%${initialQuery}%`)
        .limit(40);

      if (filmError) throw filmError;
      
      const transformedFilms = (filmData || []).map(f => ({
        ...f,
        genres: f.film_genres?.map(fg => fg.genres?.name).filter(Boolean) || []
      }));
      setFilms(transformedFilms);

      // 2. Fetch People
      const { data: peopleData, error: peopleError } = await supabase
        .from('people')
        .select('*')
        .ilike('name', `%${initialQuery}%`)
        .limit(20);

      if (peopleError) throw peopleError;
      setPeople(peopleData || []);

      // 3. Fetch Companies
      const { data: companyData, error: companyError } = await supabase
        .from('companies')
        .select('*')
        .ilike('name', `%${initialQuery}%`)
        .limit(20);
      
      if (companyError) throw companyError;
      setCompanies(companyData || []);

    } catch (error) {
      console.error('Error searching:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    if (query) {
      setSearchParams({ q: query });
    } else {
      setSearchParams({});
    }
  };

  return (
    <div className="w-full bg-bg min-h-screen pt-24 pb-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Search Input Area */}
        <div className="max-w-3xl mx-auto mb-12">
          <form onSubmit={handleSearch} className="relative group">
            <div className="absolute inset-y-0 left-0 pl-6 flex items-center pointer-events-none">
              <svg className="w-5 h-5 text-text-muted group-focus-within:text-brand transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <input 
              type="text" 
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search films, people, or studios..." 
              className="w-full bg-surface border-2 border-border rounded-2xl py-5 pl-14 pr-32 text-xl text-text-primary placeholder-text-muted focus:outline-none focus:border-brand transition-all shadow-xl"
            />
            <button type="submit" className="absolute inset-y-3 right-3 bg-brand text-white px-8 rounded-xl font-bold hover:scale-105 active:scale-95 transition-all shadow-lg shadow-brand/20">
              Search
            </button>
          </form>
          {initialQuery && (
            <p className="mt-4 text-center text-text-muted">
              Results and insights for <span className="text-brand font-bold">"{initialQuery}"</span>
            </p>
          )}
        </div>

        {/* Categories Tabs */}
        <div className="flex justify-center flex-wrap gap-2 mb-10">
          {[
            { id: 'films', label: 'Films', count: films.length },
            { id: 'people', label: 'People', count: people.length },
            { id: 'companies', label: 'Companies', count: companies.length }
          ].map(tab => (
            <button 
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-6 py-2.5 rounded-full text-sm font-bold transition-all ${
                activeTab === tab.id 
                  ? 'bg-brand text-white shadow-lg shadow-brand/20' 
                  : 'bg-surface-2 text-text-muted hover:text-text-primary border border-border'
              }`}
            >
              {tab.label} <span className="ml-1 opacity-60">({tab.count})</span>
            </button>
          ))}
        </div>

        {/* Results Body */}
        <div className="min-h-[400px]">
          {loading ? (
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-6">
              {[...Array(10)].map((_, i) => (
                <div key={i} className="aspect-[2/3] bg-surface-2 rounded-2xl animate-pulse" />
              ))}
            </div>
          ) : (
            <>
              {activeTab === 'films' && (
                films.length > 0 ? (
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
                    {films.map(film => <FilmCard key={film.id} film={film} />)}
                  </div>
                ) : <EmptyState query={initialQuery} />
              )}

              {activeTab === 'people' && (
                people.length > 0 ? (
                  <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
                    {people.map(person => <PersonCard key={person.id} person={person} variant="compact" />)}
                  </div>
                ) : <EmptyState query={initialQuery} />
              )}

              {activeTab === 'companies' && (
                companies.length > 0 ? (
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                    {companies.map(company => (
                      <div key={company.id} className="bg-surface border border-border p-6 rounded-2xl flex flex-col items-center text-center group hover:border-brand/40 transition-all">
                        <div className="w-16 h-16 bg-brand/10 rounded-xl flex items-center justify-center text-brand mb-4 group-hover:scale-110 transition-transform">
                          <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                          </svg>
                        </div>
                        <h3 className="font-heading font-bold text-lg text-text-primary group-hover:text-brand transition-colors">{company.name}</h3>
                        <p className="text-sm text-text-muted mt-1">{company.country || 'International'}</p>
                      </div>
                    ))}
                  </div>
                ) : <EmptyState query={initialQuery} />
              )}
            </>
          )}
        </div>

      </div>
    </div>
  );
}

function EmptyState({ query }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="w-20 h-20 bg-surface-2 rounded-full flex items-center justify-center mb-6">
        <svg className="w-10 h-10 text-text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
      </div>
      <h3 className="font-heading font-bold text-2xl text-text-primary mb-2">No matching content</h3>
      <p className="text-text-muted max-w-md">
        We couldn't find matches for "{query}". Try searching for specific names, film titles, or production houses.
      </p>
    </div>
  );
}
