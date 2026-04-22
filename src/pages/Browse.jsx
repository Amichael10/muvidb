import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import FilmCard from '../components/film/FilmCard';

export default function Browse() {
  const [searchParams] = useSearchParams();
  const initialGenre = searchParams.get('genre') || '';
  const initialSort = searchParams.get('sort') || 'views';

  const [isMobileFiltersOpen, setIsMobileFiltersOpen] = useState(false);
  const [films, setFilms] = useState([]);
  const [dbGenres, setDbGenres] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Filters state
  const [selectedGenres, setSelectedGenres] = useState(initialGenre ? [initialGenre] : []);
  const [yearRange, setYearRange] = useState(2000);
  const [selectedRatings, setSelectedRatings] = useState([]);
  const [language, setLanguage] = useState('');
  const [sortBy, setSortBy] = useState(initialSort);

  useEffect(() => {
    document.title = "Lumi | Browse";
    fetchGenres();
  }, []);

  useEffect(() => {
    setError(null);
    fetchFilms();
  }, [selectedGenres, yearRange, selectedRatings, language, sortBy]);

  const fetchGenres = async () => {
    try {
      const { data, error } = await supabase
        .from('genres')
        .select('name')
        .order('name');
      if (error) throw error;
      setDbGenres((data || []).map(g => g.name));
    } catch (err) {
      console.error('Error fetching genres:', err);
    }
  };
  
  const fetchFilms = async () => {
    setLoading(true);
    try {
      // PRO TIP: We go direct to Supabase here because 'npm run dev' (Vite) 
      // doesn't execute /api/ serverless functions locally.
      let query = supabase.from('films').select(`
        id, title, poster_url, backdrop_url, year, language, 
        runtime_minutes, view_count, average_rating, nfvcb_rating,
        film_genres!left(genres(name))
      `);

      // 1. Genre Filtering (Inner Join logic)
      if (selectedGenres.length > 0) {
        // We use !inner here to force filtering by genre
        query = supabase.from('films').select(`
          id, title, poster_url, backdrop_url, year, language, 
          runtime_minutes, view_count, average_rating, nfvcb_rating,
          film_genres!inner(genres!inner(name))
        `);
        query = query.in('film_genres.genres.name', selectedGenres);
      }

      // 2. Metadata Filters
      if (yearRange > 1990) query = query.gte('year', yearRange);
      if (language) query = query.eq('language', language);
      if (selectedRatings.length > 0) query = query.in('nfvcb_rating', selectedRatings);

      // 3. Sorting & Range
      const sortMap = {
        'views': { column: 'view_count', ascending: false },
        'rating': { column: 'average_rating', ascending: false },
        'newest': { column: 'year', ascending: false },
        'oldest': { column: 'year', ascending: true }
      };
      
      const config = sortMap[sortBy] || sortMap.views;
      query = query.order(config.column, { ascending: config.ascending });
      query = query.range(0, 49);

      const { data, error: dbError } = await query;
      
      if (dbError) throw dbError;

      // Transform result to match the expected FilmCard structure
      const transformed = (data || []).map(f => ({
        ...f,
        genres: f.film_genres?.map(fg => fg.genres?.name).filter(Boolean) || []
      }));

      setFilms(transformed);
    } catch (err) {
      console.error('Fetch error:', err);
      // Fallback for local dev if API folder exists but is unreachable
      setError('Could not connect to the movie database. Re-verifying credentials...');
    } finally {
      setLoading(false);
    }
  };

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

  return (
    <div className="w-full bg-bg min-h-screen pt-24 pb-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-end justify-between mb-8 border-b border-border pb-6">
          <h1 className="font-heading font-bold text-3xl md:text-4xl text-text-primary">
            Browse Nollywood Films
          </h1>
          <button 
            className="md:hidden flex items-center justify-center gap-2 bg-surface-2 px-4 py-2 rounded-lg text-text-primary font-medium border border-border"
            onClick={() => setIsMobileFiltersOpen(!isMobileFiltersOpen)}
          >
            Filters
          </button>
        </div>

        <div className="flex flex-col md:flex-row gap-8">
          <div className={`md:w-64 shrink-0 space-y-8 ${isMobileFiltersOpen ? 'block' : 'hidden md:block'}`}>
            <div className="flex items-center justify-between">
              <h3 className="font-heading font-bold text-xl text-text-primary">Filters</h3>
              <button onClick={clearAll} className="text-sm text-brand hover:underline">Clear All</button>
            </div>

            <div>
              <h4 className="font-bold text-text-primary mb-3 text-xs uppercase tracking-widest">Sort By</h4>
              <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="w-full bg-surface border border-border text-text-primary rounded-lg p-2.5 outline-none focus:border-brand">
                <option value="views">Most Viewed</option>
                <option value="rating">Top Rated</option>
                <option value="newest">Newest</option>
                <option value="oldest">Oldest</option>
              </select>
            </div>

            <div>
              <h4 className="font-bold text-text-primary mb-3 text-xs uppercase tracking-widest">Genres</h4>
              <div className="space-y-2 max-h-64 overflow-y-auto pr-2 custom-scrollbar">
                {dbGenres.length === 0 && <p className="text-xs text-text-muted italic">Connecting genres...</p>}
                {dbGenres.map(genre => (
                  <label key={genre} className="flex items-center gap-3 cursor-pointer group" onClick={() => toggleGenre(genre)}>
                    <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${selectedGenres.includes(genre) ? 'bg-brand border-brand' : 'border-border bg-surface group-hover:border-brand/50'}`}>
                      {selectedGenres.includes(genre) && <div className="w-2 h-2 rounded-full bg-white shadow-sm" />}
                    </div>
                    <span className={`text-sm ${selectedGenres.includes(genre) ? 'text-text-primary font-medium' : 'text-text-muted group-hover:text-text-primary'}`}>{genre}</span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <div className="flex justify-between mb-3">
                <h4 className="font-bold text-text-primary text-xs uppercase tracking-widest">Release Year</h4>
                <span className="text-sm text-brand font-medium">{yearRange}+</span>
              </div>
              <input type="range" min="1990" max="2025" value={yearRange} onChange={(e) => setYearRange(parseInt(e.target.value))} className="w-full h-2 bg-surface-2 rounded-lg appearance-none cursor-pointer accent-brand" />
            </div>

            <div>
              <h4 className="font-bold text-text-primary mb-3 text-xs uppercase tracking-widest">Rating</h4>
              <div className="flex flex-wrap gap-2">
                {nfvcbRatings.map(r => (
                  <button key={r} onClick={() => toggleRating(r)} className={`px-3 py-1 rounded-md text-xs font-bold border ${selectedRatings.includes(r) ? 'bg-brand border-brand text-white' : 'border-border text-text-muted'}`}>
                    {r}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex-1">
            {loading ? (
              <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {[...Array(8)].map((_, i) => <div key={i} className="aspect-[2/3] bg-surface-2 animate-pulse rounded-2xl" />)}
              </div>
            ) : films.length > 0 ? (
              <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {films.map(film => <FilmCard key={film.id} film={film} />)}
              </div>
            ) : (
              <div className="bg-surface border border-border rounded-2xl p-12 text-center">
                <p className="text-text-muted mb-4">No matching films found.</p>
                <button onClick={clearAll} className="text-brand font-bold">Clear Filters</button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
