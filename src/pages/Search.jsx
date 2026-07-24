import { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import FilmCard from '../components/film/FilmCard';
import PersonCard from '../components/person/PersonCard';
import SkeletonCard from '../components/ui/SkeletonCard';
import { toTitleCase } from '../utils/format';
import { searchAll } from '../lib/search';

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
    document.title = "MuviDB | Search";
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
      // Ranked, forgiving search: matches by word (any order), finds films by
      // cast, and ranks exact matches above "similar" ones. See lib/search.js.
      const { films: filmResults, people: peopleResults, companies: companyResults } =
        await searchAll(initialQuery);

      // De-dupe films by title so re-uploads don't clutter results.
      const uniqueFilms = [];
      const titles = new Set();
      filmResults.forEach((f) => {
        const key = f.title?.toLowerCase();
        if (!titles.has(key)) { uniqueFilms.push(f); titles.add(key); }
      });

      setFilms(uniqueFilms);
      setPeople(peopleResults);
      setCompanies(companyResults);

      // Jump to whichever category actually has results so a valid search never
      // looks empty (e.g. searching an actor lands on People, not empty Movies).
      const counts = { films: uniqueFilms.length, people: peopleResults.length, companies: companyResults.length };
      const topScores = {
        films: uniqueFilms[0]?._score || 0,
        people: peopleResults[0]?._score || 0,
        companies: companyResults[0]?._score || 0,
      };
      const best = ['films', 'people', 'companies'].reduce((a, b) => {
        if (topScores[b] !== topScores[a]) return topScores[b] > topScores[a] ? b : a;
        return counts[b] > counts[a] ? b : a;
      }, 'films');
      if (counts[best] > 0) setActiveTab(best);
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
        <div className="flex justify-start md:justify-center border-b border-border bg-surface-2/5 divide-x divide-border overflow-x-auto scrollbar-hide">
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
        <div className="p-4 md:p-8 lg:p-12">
          {loading ? (
            activeTab === 'films' ? (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 sm:gap-6 md:gap-8">
                {[...Array(10)].map((_, i) => (
                  <SkeletonCard key={i} />
                ))}
              </div>
            ) : activeTab === 'people' ? (
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 sm:gap-6 md:gap-8">
                {[...Array(12)].map((_, i) => (
                  <PersonCard key={i} isLoading variant="compact" />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 md:gap-8">
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
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 sm:gap-6 md:gap-8">
                    {films.map(film => <FilmCard key={film.id} film={film} />)}
                  </div>
                ) : <EmptyState query={initialQuery} />
              )}

              {activeTab === 'people' && (
                people.length > 0 ? (
                  <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 sm:gap-6 md:gap-8">
                    {people.map(person => <PersonCard key={person.id} person={person} variant="compact" />)}
                  </div>
                ) : <EmptyState query={initialQuery} />
              )}

              {activeTab === 'companies' && (
                companies.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 md:gap-8">
                    {companies.map(company => (
                       <div key={company.id} className="bg-surface border border-border p-8 rounded-xl flex items-center gap-6 group hover:border-brand transition-all shadow-sm">
                         <div className="w-14 h-14 bg-surface-2 rounded-lg flex items-center justify-center text-brand font-heading font-bold text-xl shrink-0 group-hover:scale-110 transition-transform border border-border/50">
                            {company.logo_url ? <img src={company.logo_url} className="w-full h-full object-contain p-2" /> : toTitleCase(company.name).charAt(0)}
                         </div>
                         <div className="min-w-0">
                             <h3 className="font-bold text-sm text-text-primary group-hover:text-brand transition-colors tracking-tight truncate leading-tight">{toTitleCase(company.name)}</h3>
                             <p className="text-[10px] font-bold text-text-muted mt-1 opacity-60">{company.country || 'International'}</p>
                         </div>
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
