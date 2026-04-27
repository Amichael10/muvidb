import { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import FilmCard from '../components/film/FilmCard';
import PersonCard from '../components/person/PersonCard';
import SkeletonCard from '../components/ui/SkeletonCard';

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
      // 1. Fetch Films
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
      
      const uniqueFilms = [];
      const titles = new Set();
      (filmData || []).forEach(f => {
        if (!titles.has(f.title?.toLowerCase())) {
          uniqueFilms.push({
            ...f,
            genres: f.film_genres?.map(fg => fg.genres?.name).filter(Boolean) || []
          });
          titles.add(f.title?.toLowerCase());
        }
      });
      setFilms(uniqueFilms);

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
    <div className="min-h-screen bg-bg">
      {/* Search Header */}
      <div className="bg-surface-2/10 border-b border-border relative overflow-hidden">
        <div className="absolute inset-0 grid-bg opacity-20 pointer-events-none"></div>
        <div className="max-w-7xl mx-auto px-4 py-20 pt-32 border-x border-border relative z-10">
          <div className="max-w-3xl mx-auto">
            <form onSubmit={handleSearch} className="relative group">
              <div className="absolute inset-y-0 left-0 pl-6 flex items-center pointer-events-none">
                <svg className="w-5 h-5 text-text-muted group-focus-within:text-brand transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <input 
                type="text" 
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search movies, people, studios..." 
                className="w-full bg-surface border border-border rounded-xl py-6 pl-16 pr-32 text-xs font-black uppercase tracking-widest text-text-primary placeholder-text-muted focus:outline-none focus:border-brand transition-all shadow-sm"
              />
              <button type="submit" className="absolute inset-y-3 right-3 bg-brand text-white px-8 rounded-lg text-xs font-bold hover:scale-[1.02] active:scale-95 transition-all shadow-lg shadow-brand/20">
                Search
              </button>
            </form>
            {initialQuery && (
              <p className="mt-6 text-center text-xs font-bold text-text-muted opacity-60">
                Results for <span className="text-brand">"{initialQuery}"</span>
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto border-x border-border min-h-screen pb-20">
        {/* Categories Tabs */}
        <div className="flex justify-center border-b border-border bg-surface-2/5 divide-x divide-border overflow-x-auto">
          {[
            { id: 'films', label: 'Movies', count: films.length },
            { id: 'people', label: 'People', count: people.length },
            { id: 'companies', label: 'Studios', count: companies.length }
          ].map(tab => (
            <button 
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-12 py-6 text-xs font-bold transition-all relative shrink-0 ${
                activeTab === tab.id 
                  ? 'text-brand' 
                  : 'text-text-muted hover:text-text-primary'
              }`}
            >
              {tab.label} <span className="ml-2 opacity-40">({tab.count})</span>
              {activeTab === tab.id && (
                <div className="absolute bottom-0 left-0 w-full h-1 bg-brand" />
              )}
            </button>
          ))}
        </div>

        {/* Results Body */}
        <div className="p-8 md:p-12">
          {loading ? (
            activeTab === 'films' ? (
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-8">
                {[...Array(10)].map((_, i) => (
                  <SkeletonCard key={i} />
                ))}
              </div>
            ) : activeTab === 'people' ? (
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-8">
                {[...Array(12)].map((_, i) => (
                  <PersonCard key={i} isLoading variant="compact" />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="bg-surface border border-border p-8 rounded-xl flex items-center gap-6 animate-shimmer shadow-sm">
                    <div className="w-14 h-14 bg-surface-2 rounded-lg shrink-0 border border-border/50"></div>
                    <div className="flex-1 space-y-2">
                        <div className="h-4 w-2/3 bg-surface-2 rounded"></div>
                        <div className="h-3 w-1/3 bg-surface-2 rounded opacity-60"></div>
                    </div>
                  </div>
                ))}
              </div>
            )
          ) : (
            <>
              {activeTab === 'films' && (
                films.length > 0 ? (
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-8">
                    {films.map(film => <FilmCard key={film.id} film={film} />)}
                  </div>
                ) : <EmptyState query={initialQuery} />
              )}

              {activeTab === 'people' && (
                people.length > 0 ? (
                  <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-8">
                    {people.map(person => <PersonCard key={person.id} person={person} variant="compact" />)}
                  </div>
                ) : <EmptyState query={initialQuery} />
              )}

              {activeTab === 'companies' && (
                companies.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {companies.map(company => (
                      <Link key={company.id} to={`/companies/${company.id}`} className="bg-surface border border-border p-8 rounded-xl flex items-center gap-6 group hover:border-brand transition-all shadow-sm">
                        <div className="w-14 h-14 bg-surface-2 rounded-lg flex items-center justify-center text-brand font-heading font-bold text-xl shrink-0 group-hover:scale-110 transition-transform border border-border/50">
                           {company.logo_url ? <img src={company.logo_url} className="w-full h-full object-contain p-2" /> : company.name.charAt(0)}
                        </div>
                        <div className="min-w-0">
                            <h3 className="font-bold text-sm text-text-primary group-hover:text-brand transition-colors tracking-tight truncate leading-tight">{company.name}</h3>
                            <p className="text-[10px] font-bold text-text-muted mt-1 opacity-60">{company.country || 'International'}</p>
                        </div>
                      </Link>
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
    <div className="flex flex-col items-center justify-center py-32 text-center bg-surface-2/10 rounded-xl border-2 border-dashed border-border">
      <div className="w-20 h-20 bg-surface border border-border rounded-full flex items-center justify-center mb-8 shadow-sm">
        <svg className="w-8 h-8 text-text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
      </div>
      <h3 className="font-heading font-bold text-2xl text-text-primary mb-4 tracking-tighter">No results found</h3>
      <p className="text-text-muted text-xs font-bold max-w-sm leading-relaxed opacity-60">
        No matches found for "{query}". Please adjust your search and try again.
      </p>
    </div>
  );
}
