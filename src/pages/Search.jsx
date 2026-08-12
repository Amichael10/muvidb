import { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { Icon } from '@iconify/react';
import { supabase } from '../lib/supabase';
import FilmCard from '../components/film/FilmCard';
import PersonCard from '../components/person/PersonCard';
import SkeletonCard from '../components/ui/SkeletonCard';
import { toTitleCase } from '../utils/format';
import { searchAll } from '../lib/search';
import ImageWithFallback from '../components/ui/ImageWithFallback';
import { getCompanyLogoStrict } from '../lib/companyImages';
import { collapseSeriesFilms } from '../utils/series';
import { getPlayDateLabel } from '../lib/plays';

export default function Search() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialQuery = searchParams.get('q') || '';
  
  const [query, setQuery] = useState(initialQuery);
  const [activeTab, setActiveTab] = useState('films'); // 'films' | 'people' | 'companies' | 'plays'
  const [films, setFilms] = useState([]);
  const [people, setPeople] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [plays, setPlays] = useState([]);
  const [dbGenres, setDbGenres] = useState([]);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    // Title comes from the route's `meta` export now — setting it here too would
    // overwrite the server-rendered one after hydration.
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
      const { films: filmResults, people: peopleResults, companies: companyResults, plays: playResults = [] } =
        await searchAll(initialQuery);

      // De-dupe films by title so re-uploads don't clutter results, then
      // collapse series episodes into a single folder-style card.
      const uniqueFilms = [];
      const titles = new Set();
      filmResults.forEach((f) => {
        const key = f.title?.toLowerCase();
        if (!titles.has(key)) { uniqueFilms.push(f); titles.add(key); }
      });

      setFilms(collapseSeriesFilms(uniqueFilms));
      setPeople(peopleResults);
      setCompanies(companyResults);
      setPlays(playResults);

      // Jump to whichever category actually has results so a valid search never
      // looks empty (e.g. searching an actor lands on People, not empty Movies).
      const counts = { films: uniqueFilms.length, people: peopleResults.length, companies: companyResults.length, plays: playResults.length };
      const topScores = {
        films: uniqueFilms[0]?._score || 0,
        people: peopleResults[0]?._score || 0,
        companies: companyResults[0]?._score || 0,
        plays: playResults[0]?._score || 0,
      };
      const best = ['films', 'people', 'companies', 'plays'].reduce((a, b) => {
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
                <Icon icon="solar:magnifer-linear" className="w-5 h-5 text-text-muted group-focus-within:text-brand transition-colors" />
              </div>
              <input 
                type="text" 
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search movies, people, studios, theatre..."
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
            { id: 'companies', label: 'Studios', count: companies.length },
            { id: 'plays', label: 'Theatre', count: plays.length }
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
            ) : activeTab === 'plays' ? (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-6 md:gap-8">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="bg-surface border border-border rounded-xl overflow-hidden animate-shimmer shadow-sm">
                    <div className="grid grid-cols-[104px_1fr] min-h-[170px]">
                      <div className="bg-surface-2 border-r border-border"></div>
                      <div className="p-5 space-y-3">
                        <div className="h-3 w-24 bg-surface-2 rounded"></div>
                        <div className="h-5 w-2/3 bg-surface-2 rounded"></div>
                        <div className="h-3 w-full bg-surface-2 rounded opacity-70"></div>
                        <div className="h-3 w-3/4 bg-surface-2 rounded opacity-60"></div>
                      </div>
                    </div>
                  </div>
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
                         <div className={`w-14 h-14 rounded-lg flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform border border-border/50 overflow-hidden ${getCompanyLogoStrict(company) ? 'bg-white' : 'bg-surface-2'}`}>
                            <ImageWithFallback
                              src={company.logo_url}
                              alt={toTitleCase(company.name)}
                              fallbackType="company"
                              name={toTitleCase(company.name)}
                              className={`w-full h-full ${getCompanyLogoStrict(company) ? 'object-contain p-2' : 'object-cover'}`}
                              width={112}
                              sizes="56px"
                              loading="lazy"
                            />
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

              {activeTab === 'plays' && (
                plays.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-6 md:gap-8">
                    {plays.map(play => (
                      <Link
                        key={play.id}
                        to={`/plays/${play.slug || play.id}`}
                        className="group bg-surface border border-border rounded-xl overflow-hidden hover:border-brand transition-all shadow-sm hover:shadow-xl hover:shadow-brand/5"
                      >
                        <div className="grid grid-cols-[112px_1fr] sm:grid-cols-[132px_1fr] min-h-[190px]">
                          <div className="relative bg-surface-2 overflow-hidden">
                            <ImageWithFallback
                              src={play.poster_url || play.banner_url}
                              alt={play.title}
                              fallbackType="film"
                              name={play.title}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                              width={300}
                              sizes="132px"
                              loading="lazy"
                            />
                            <span className={`absolute left-2 top-2 px-2 py-0.5 text-[8px] font-black uppercase tracking-widest border backdrop-blur ${
                              play.status === 'currently_running'
                                ? 'bg-green-500/20 text-green-300 border-green-500/40'
                                : play.status === 'upcoming'
                                  ? 'bg-blue-500/20 text-blue-300 border-blue-500/40'
                                  : 'bg-bg/75 text-text-muted border-border'
                            }`}>
                              {play.status === 'currently_running' ? 'Running' : play.status === 'upcoming' ? 'Upcoming' : 'Theatre'}
                            </span>
                          </div>
                          <div className="p-4 min-w-0 flex flex-col justify-between">
                            <div>
                              <p className="text-[9px] font-black uppercase tracking-[0.2em] text-brand mb-2">
                                {play.genre || 'Stage Play'}
                              </p>
                              <h3 className="font-heading font-black text-xl text-text-primary group-hover:text-brand transition-colors tracking-tight line-clamp-2 leading-tight">
                                {play.title}
                              </h3>
                              <p className="mt-2 text-xs text-text-muted leading-relaxed line-clamp-2">
                                {play.synopsis || 'Production details, stage dates, venue, and cast credits.'}
                              </p>
                            </div>
                            <div className="pt-4 space-y-2 text-[10px] text-text-muted">
                              <div className="flex items-start gap-2">
                                <Icon icon="solar:calendar-minimalistic-bold" className="text-brand text-sm shrink-0 mt-0.5" />
                                <span className="font-bold leading-relaxed">{getPlayDateLabel(play, 'Date TBA')}</span>
                              </div>
                              <div className="flex items-start gap-2">
                                <Icon icon="solar:map-point-bold" className="text-brand text-sm shrink-0 mt-0.5" />
                                <span className="line-clamp-1">{play.venue || play.city || 'Venue TBA'}</span>
                              </div>
                            </div>
                          </div>
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
