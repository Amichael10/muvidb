import { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { Icon } from '@iconify/react';
import toast from 'react-hot-toast';

export default function AdminTop10() {
  const [top10, setTop10] = useState(Array(10).fill(null));
  const [isLoading, setIsLoading] = useState(true);

  // Search state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentRank, setCurrentRank] = useState(null);
  const [filmSearch, setFilmSearch] = useState('');
  const [filmResults, setFilmResults] = useState([]);

  // Drag-to-reorder state
  const dragIndex = useRef(null);
  const [dragOverIndex, setDragOverIndex] = useState(null);

  useEffect(() => {
    fetchTop10();
  }, []);

  useEffect(() => {
    if (filmSearch.length > 2) {
      const delaySearch = setTimeout(() => {
        searchFilms(filmSearch);
      }, 500);
      return () => clearTimeout(delaySearch);
    } else {
      setFilmResults([]);
    }
  }, [filmSearch]);

  const fetchTop10 = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('top_10_films')
        .select('id, rank, film_id, films(id, title, poster_url, release_type, year)')
        .order('rank', { ascending: true });

      if (error) throw error;
      
      const slots = Array(10).fill(null);
      data.forEach(item => {
        if (item.rank >= 1 && item.rank <= 10) {
          slots[item.rank - 1] = item;
        }
      });
      setTop10(slots);
    } catch (err) {
      toast.error('Failed to load Top 10: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const searchFilms = async (query) => {
    try {
      const { data, error } = await supabase
        .from('films')
        .select('id, title, poster_url, release_type, year')
        .ilike('title', `%${query}%`)
        .limit(10);
      
      if (error) throw error;
      setFilmResults(data || []);
    } catch (err) {
      console.error('Error searching films:', err);
    }
  };

  const handleOpenSearch = (rank) => {
    setCurrentRank(rank);
    setFilmSearch('');
    setFilmResults([]);
    setIsModalOpen(true);
  };

  const selectFilm = async (film) => {
    try {
      // Check if film is already in Top 10
      const existing = top10.find(item => item && item.film_id === film.id);
      if (existing) {
        toast.error('Film is already in the Top 10');
        return;
      }

      const existingAtRank = top10[currentRank - 1];

      if (existingAtRank) {
        // Update
        const { error } = await supabase
          .from('top_10_films')
          .update({ film_id: film.id })
          .eq('id', existingAtRank.id);
        if (error) throw error;
      } else {
        // Insert
        const { error } = await supabase
          .from('top_10_films')
          .insert([{ rank: currentRank, film_id: film.id }]);
        if (error) throw error;
      }

      toast.success(`Film set to Rank ${currentRank}`);
      setIsModalOpen(false);
      fetchTop10();
    } catch (err) {
      toast.error('Failed to save Top 10: ' + err.message);
    }
  };

  // Rewrite the whole list atomically-ish (rank has a UNIQUE constraint, so we
  // can't swap two rows in place). Delete all + re-insert with fresh ranks;
  // restore the snapshot if anything fails.
  const rewriteRanks = async (slots) => {
    const rows = slots
      .map((it, i) => (it ? { film_id: it.film_id, rank: i + 1 } : null))
      .filter(Boolean);
    await supabase.from('top_10_films').delete().gte('rank', 1);
    if (rows.length) {
      const { error } = await supabase.from('top_10_films').insert(rows);
      if (error) throw error;
    }
  };

  const handleDrop = async () => {
    const from = dragIndex.current;
    const to = dragOverIndex;
    dragIndex.current = null;
    setDragOverIndex(null);
    if (from === null || to === null || from === to) return;
    if (!top10[from]) return; // can't drag an empty slot

    const snapshot = top10;
    const next = [...top10];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    setTop10(next); // optimistic

    try {
      await rewriteRanks(next);
      toast.success('Order updated');
    } catch (err) {
      toast.error('Failed to save order: ' + err.message);
      try { await rewriteRanks(snapshot); } catch (e) { /* best effort */ }
    } finally {
      fetchTop10();
    }
  };

  const handleRemove = async (id) => {
    if (!window.confirm('Are you sure you want to remove this film from the Top 10?')) return;
    try {
      const { error } = await supabase.from('top_10_films').delete().eq('id', id);
      if (error) throw error;
      toast.success('Film removed from Top 10');
      fetchTop10();
    } catch (err) {
      toast.error('Failed to remove film: ' + err.message);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Top 10 Management</h1>
          <p className="text-text-muted text-sm mt-1">Manage the Top 10 films on the home page. Drag cards to reorder their rank.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        {isLoading ? (
          <div className="col-span-full p-8 text-center text-text-muted">
            <Icon icon="solar:spinner-linear" className="w-6 h-6 animate-spin mx-auto mb-2" />
            Loading Top 10...
          </div>
        ) : (
          top10.map((item, index) => {
            const rank = index + 1;
            return (
              <div
                key={rank}
                draggable={!!item}
                onDragStart={() => { if (item) dragIndex.current = index; }}
                onDragEnter={() => setDragOverIndex(index)}
                onDragOver={(e) => e.preventDefault()}
                onDragEnd={handleDrop}
                className={`bg-surface rounded-xl border overflow-hidden flex flex-col transition-all ${item ? 'cursor-grab active:cursor-grabbing' : ''} ${
                  dragOverIndex === index ? 'border-brand ring-2 ring-brand/50' : 'border-border'
                }`}
              >
                <div className="bg-surface-2/50 border-b border-border p-3 flex justify-between items-center">
                  <span className="font-bold text-lg text-text-primary flex items-center gap-1.5">
                    {item && <Icon icon="solar:hamburger-menu-linear" className="text-text-muted" width="16" />}
                    #{rank}
                  </span>
                  {item && (
                    <button
                      onClick={() => handleRemove(item.id)}
                      className="text-text-muted hover:text-red-500 transition-colors p-1"
                      title="Remove"
                    >
                      <Icon icon="solar:trash-bin-trash-linear" width="18" />
                    </button>
                  )}
                </div>
                
                <div className="p-4 flex-1 flex flex-col justify-center items-center relative group min-h-[200px]">
                  {item && item.films ? (
                    <>
                      <img
                        src={item.films.poster_url || 'https://images.unsplash.com/photo-1594909122845-11baa439b7bf?q=80&w=300'}
                        alt={item.films.title}
                        draggable={false}
                        className="absolute inset-0 w-full h-full object-cover opacity-50 group-hover:opacity-30 transition-opacity pointer-events-none"
                      />
                      <div className="relative z-10 flex flex-col items-center text-center">
                        <h3 className="font-bold text-white text-lg drop-shadow-md mb-1">{item.films.title}</h3>
                        <p className="text-xs text-white/80 font-medium">{item.films.year}</p>
                      </div>
                      
                      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-20 bg-black/40">
                        <button
                          onClick={() => handleOpenSearch(rank)}
                          className="bg-brand hover:bg-brand-hover text-white px-4 py-2 rounded-lg font-medium shadow-lg flex items-center gap-2 transition-transform transform scale-95 group-hover:scale-100"
                        >
                          <Icon icon="solar:pen-linear" />
                          Change
                        </button>
                      </div>
                    </>
                  ) : (
                    <button
                      onClick={() => handleOpenSearch(rank)}
                      className="flex flex-col items-center justify-center w-full h-full text-text-muted hover:text-brand transition-colors gap-2"
                    >
                      <div className="w-12 h-12 rounded-full border-2 border-dashed border-border flex items-center justify-center">
                        <Icon icon="solar:add-circle-linear" width="24" />
                      </div>
                      <span className="font-medium text-sm">Add Film</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-surface border border-border rounded-xl w-full max-w-lg flex flex-col h-[600px] max-h-[90vh]">
            <div className="flex items-center justify-between p-6 border-b border-border">
              <h2 className="text-xl font-bold text-text-primary">
                Select Film for Rank #{currentRank}
              </h2>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="text-text-muted hover:text-text-primary transition-colors"
              >
                <Icon icon="solar:close-circle-linear" width="24" />
              </button>
            </div>
            
            <div className="p-6 border-b border-border bg-surface-2/30">
              <div className="relative">
                <Icon icon="solar:magnifer-linear" className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
                <input
                  type="text"
                  placeholder="Search by title..."
                  value={filmSearch}
                  onChange={(e) => setFilmSearch(e.target.value)}
                  autoFocus
                  className="w-full bg-surface-2 border border-border rounded-lg pl-10 pr-4 py-3 text-text-primary focus:border-brand focus:ring-1 focus:ring-brand outline-none transition-all"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              {filmSearch.length <= 2 ? (
                <div className="text-center text-text-muted py-8 italic">
                  Type at least 3 characters to search...
                </div>
              ) : filmResults.length === 0 ? (
                <div className="text-center text-text-muted py-8">
                  No films found.
                </div>
              ) : (
                <div className="space-y-2">
                  {filmResults.map(film => (
                    <button
                      key={film.id}
                      onClick={() => selectFilm(film)}
                      className="w-full flex items-center gap-4 p-3 rounded-lg hover:bg-surface-2 border border-transparent hover:border-border transition-all text-left group"
                    >
                      <img 
                        src={film.poster_url || 'https://images.unsplash.com/photo-1594909122845-11baa439b7bf?q=80&w=150'} 
                        alt=""
                        className="w-12 h-16 object-cover rounded shadow-sm group-hover:shadow-md transition-shadow"
                      />
                      <div className="flex-1 min-w-0">
                        <h4 className="font-bold text-text-primary text-sm line-clamp-1">{film.title}</h4>
                        <div className="flex items-center gap-2 mt-1 text-xs text-text-muted font-medium">
                          <span>{film.year}</span>
                          {film.release_type && (
                            <>
                              <span className="w-1 h-1 rounded-full bg-border"></span>
                              <span className="text-brand/80">{film.release_type}</span>
                            </>
                          )}
                        </div>
                      </div>
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity pr-2">
                        <Icon icon="solar:alt-arrow-right-line-duotone" width="24" className="text-brand" />
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
