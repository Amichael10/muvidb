import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import FilmCard from '../components/film/FilmCard';
// import { genres } from '../data/mockData';

export default function Browse() {
  const [searchParams] = useSearchParams();
  const initialGenre = searchParams.get('genre') || '';
  const initialSort = searchParams.get('sort') || 'views';

  const [isMobileFiltersOpen, setIsMobileFiltersOpen] = useState(false);
  const [films, setFilms] = useState([]);
  const [dbGenres, setDbGenres] = useState([]);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    document.title = "FilmDba | Browse";
    fetchFilms();
    fetchGenres();
  }, []);

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
  
  const fetchFilms = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/films?limit=50');
      if (!res.ok) throw new Error(`Failed to fetch films: ${res.status}`);
      const { films } = await res.json();
      setFilms(films || []);
    } catch (error) {
      console.error('Error fetching films:', error);
    } finally {
      setLoading(false);
    }
  };

  // Filters state
  const [selectedGenres, setSelectedGenres] = useState(initialGenre ? [initialGenre] : []);
  const [yearRange, setYearRange] = useState(2000);
  const [selectedRatings, setSelectedRatings] = useState([]);
  const [language, setLanguage] = useState('');
  const [sortBy, setSortBy] = useState(initialSort);

  const nfvcbRatings = ['PG', '12', '15', '18'];
  const languages = ['English', 'Yoruba', 'Igbo', 'Hausa', 'Pidgin'];

  const toggleGenre = (genre) => {
    setSelectedGenres(prev => 
      prev.includes(genre) ? prev.filter(g => g !== genre) : [...prev, genre]
    );
  };

  const toggleRating = (rating) => {
    setSelectedRatings(prev => 
      prev.includes(rating) ? prev.filter(r => r !== rating) : [...prev, rating]
    );
  };

  const clearAll = () => {
    setSelectedGenres([]);
    setYearRange(2000);
    setSelectedRatings([]);
    setLanguage('');
    setSortBy('views');
  };

  // Filter and sort logic
  let filteredFilms = films.filter(f => {
    const filmGenres = f.genres || [];
    const matchesGenre = selectedGenres.length === 0 || filmGenres.some(g => selectedGenres.includes(g));
    const matchesYear = (f.year || 0) >= yearRange;
    const matchesRating = selectedRatings.length === 0 || selectedRatings.includes(f.nfvcb_rating);
    const matchesLanguage = !language || (f.language && f.language.includes(language));
    return matchesGenre && matchesYear && matchesRating && matchesLanguage;
  });

  filteredFilms.sort((a, b) => {
    if (sortBy === 'views') return (b.view_count || 0) - (a.view_count || 0);
    if (sortBy === 'rating') return (b.rating || 0) - (a.rating || 0);
    if (sortBy === 'newest') return (b.year || 0) - (a.year || 0);
    if (sortBy === 'oldest') return (a.year || 0) - (b.year || 0);
    return 0;
  });

  return (
    <div className="w-full bg-bg min-h-screen pt-24 pb-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        <div className="flex items-end justify-between mb-8 border-b border-border pb-6">
          <h1 className="font-heading font-bold text-3xl md:text-4xl text-text-primary">
            Browse Nollywood Films
          </h1>
          <button 
            className="md:hidden flex items-center justify-center gap-2 bg-surface-2 px-4 py-2 rounded-lg text-text-primary font-medium border border-border active:scale-95 transition-all duration-300 min-h-[44px]"
            onClick={() => setIsMobileFiltersOpen(!isMobileFiltersOpen)}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>
            </svg>
            Filters
          </button>
        </div>

        <div className="flex flex-col md:flex-row gap-8">
          
          {/* Sidebar Filters */}
          <div className={`md:w-64 shrink-0 space-y-8 ${isMobileFiltersOpen ? 'block' : 'hidden md:block'}`}>
            <div className="flex items-center justify-between">
              <h3 className="font-heading font-bold text-xl text-text-primary">Filters</h3>
              <button onClick={clearAll} className="text-sm text-gold hover:underline">Clear All</button>
            </div>

            {/* Sort */}
            <div>
              <h4 className="font-bold text-text-primary mb-3">Sort By</h4>
              <select 
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="w-full bg-surface border border-border text-text-primary rounded-lg p-2.5 outline-none focus:border-gold"
              >
                <option value="views">Most Viewed</option>
                <option value="rating">Top Rated</option>
                <option value="newest">Newest</option>
                <option value="oldest">Oldest</option>
              </select>
            </div>

            {/* Genres */}
            <div>
              <h4 className="font-bold text-text-primary mb-3">Genres</h4>
              <div className="space-y-2 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                {dbGenres.map(genre => (
                  <label key={genre} className="flex items-center gap-3 cursor-pointer group">
                    <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${selectedGenres.includes(genre) ? 'bg-gold border-gold' : 'border-border bg-surface group-hover:border-gold/50'}`}>
                      {selectedGenres.includes(genre) && (
                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--color-bg)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12"/>
                        </svg>
                      )}
                    </div>
                    <span className={`text-sm ${selectedGenres.includes(genre) ? 'text-text-primary font-medium' : 'text-text-muted group-hover:text-text-primary'}`}>
                      {genre}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            {/* Year Range */}
            <div>
              <div className="flex justify-between mb-3">
                <h4 className="font-bold text-text-primary">Release Year</h4>
                <span className="text-sm text-gold font-medium">{yearRange} - 2025</span>
              </div>
              <input 
                type="range" 
                min="1990" 
                max="2025" 
                value={yearRange}
                onChange={(e) => setYearRange(parseInt(e.target.value))}
                className="w-full h-2 bg-surface-2 rounded-lg appearance-none cursor-pointer accent-gold"
              />
            </div>

            {/* NFVCB Rating */}
            <div>
              <h4 className="font-bold text-text-primary mb-3">NFVCB Rating</h4>
              <div className="flex flex-wrap gap-2">
                {nfvcbRatings.map(rating => (
                  <button
                    key={rating}
                    onClick={() => toggleRating(rating)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-bold border transition-colors ${selectedRatings.includes(rating) ? 'bg-gold border-gold text-bg' : 'bg-surface border-border text-text-muted hover:border-gold/50 hover:text-text-primary'}`}
                  >
                    {rating}
                  </button>
                ))}
              </div>
            </div>

            {/* Language */}
            <div>
              <h4 className="font-bold text-text-primary mb-3">Language</h4>
              <select 
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="w-full bg-surface border border-border text-text-primary rounded-lg p-2.5 outline-none focus:border-gold"
              >
                <option value="">All Languages</option>
                {languages.map(lang => (
                  <option key={lang} value={lang}>{lang}</option>
                ))}
              </select>
            </div>

            <button 
              onClick={() => setIsMobileFiltersOpen(false)}
              className="w-full bg-gold text-bg font-bold py-3 rounded-xl hover:scale-[1.02] active:scale-95 transition-all duration-300 shadow-[0_0_15px_rgba(212,160,23,0.2)] min-h-[44px]"
            >
              Apply Filters
            </button>
          </div>

          {/* Results Grid */}
          <div className="flex-1">
            <div className="mb-6 text-text-muted text-sm font-medium">
              Showing {filteredFilms.length} of {films.length} films
            </div>
            
            {filteredFilms.length > 0 ? (
              <>
                <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
                  {filteredFilms.map(film => (
                    <div key={film.id} className="flex justify-center">
                      <FilmCard film={film} size="md" />
                    </div>
                  ))}
                </div>

                {/* Pagination */}
                <div className="mt-12 flex items-center justify-center gap-2">
                  <button className="w-10 h-10 rounded-lg bg-surface border border-border flex items-center justify-center text-text-muted hover:text-gold hover:border-gold transition-colors disabled:opacity-50 disabled:cursor-not-allowed" disabled>
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="15 18 9 12 15 6"/>
                    </svg>
                  </button>
                  <button className="w-10 h-10 rounded-lg bg-gold text-bg font-bold flex items-center justify-center">
                    1
                  </button>
                  <button className="w-10 h-10 rounded-lg bg-surface border border-border flex items-center justify-center text-text-muted hover:text-gold hover:border-gold transition-colors">
                    2
                  </button>
                  <button className="w-10 h-10 rounded-lg bg-surface border border-border flex items-center justify-center text-text-muted hover:text-gold hover:border-gold transition-colors">
                    3
                  </button>
                  <span className="text-text-muted px-2">...</span>
                  <button className="w-10 h-10 rounded-lg bg-surface border border-border flex items-center justify-center text-text-muted hover:text-gold hover:border-gold transition-colors">
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="9 18 15 12 9 6"/>
                    </svg>
                  </button>
                </div>
              </>
            ) : (
              <div className="bg-surface border border-border rounded-2xl p-12 text-center flex flex-col items-center">
                <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-border mb-4">
                  <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>
                </svg>
                <h3 className="font-heading font-bold text-xl text-text-primary mb-2">No films match your filters</h3>
                <p className="text-text-muted max-w-md mb-6">Try adjusting your selected genres, year range, or ratings to see more results.</p>
                <button onClick={clearAll} className="bg-transparent border border-gold text-gold hover:bg-gold hover:text-bg px-6 py-2 rounded-full font-medium transition-all duration-300 active:scale-95 min-h-[44px]">
                  Clear Filters
                </button>
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
