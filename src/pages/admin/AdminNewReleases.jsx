import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Icon } from '@iconify/react';
import toast from 'react-hot-toast';
import { PLATFORMS, platformFilter } from '../../lib/platforms';

// Platforms that get a "New to Stream" tab on the homepage.
const STREAM_PLATFORMS = PLATFORMS.filter((p) =>
  ['netflix', 'prime_video', 'kava', 'docuth'].includes(p.id)
);

export default function AdminNewReleases() {
  const [platform, setPlatform] = useState(STREAM_PLATFORMS[0].id);
  const [items, setItems] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [filmSearch, setFilmSearch] = useState('');
  const [filmResults, setFilmResults] = useState([]);

  useEffect(() => { fetchItems(); }, [platform]);

  useEffect(() => {
    if (filmSearch.length > 2) {
      const t = setTimeout(() => searchFilms(filmSearch), 400);
      return () => clearTimeout(t);
    }
    setFilmResults([]);
  }, [filmSearch]);

  const fetchItems = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('platform_new_releases')
        .select('id, film_id, created_at, films(id, title, poster_url, year, release_type)')
        .eq('platform', platform)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setItems(data || []);
    } catch (err) {
      toast.error('Failed to load list: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  // Search only films that are actually on the selected platform.
  const searchFilms = async (query) => {
    try {
      const { data, error } = await supabase
        .from('films')
        .select('id, title, poster_url, year, release_type')
        .or(platformFilter(platform))
        .ilike('title', `%${query}%`)
        .limit(12);
      if (error) throw error;
      setFilmResults(data || []);
    } catch (err) {
      console.error('Search error:', err);
    }
  };

  const addFilm = async (film) => {
    if (items.some((i) => i.film_id === film.id)) {
      toast.error('Already in this list');
      return;
    }
    try {
      const { error } = await supabase
        .from('platform_new_releases')
        .insert({ platform, film_id: film.id });
      if (error) throw error;
      toast.success(`Added to New on ${platformLabel}`);
      setIsModalOpen(false);
      setFilmSearch('');
      fetchItems();
    } catch (err) {
      toast.error('Failed to add: ' + err.message);
    }
  };

  const removeFilm = async (id) => {
    try {
      const { error } = await supabase.from('platform_new_releases').delete().eq('id', id);
      if (error) throw error;
      setItems((prev) => prev.filter((i) => i.id !== id));
      toast.success('Removed');
    } catch (err) {
      toast.error('Failed to remove: ' + err.message);
    }
  };

  const platformLabel = STREAM_PLATFORMS.find((p) => p.id === platform)?.name || platform;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-text-primary">New to Stream</h1>
        <p className="text-text-muted text-sm mt-1">
          Hand-pick the films shown under each platform tab on the homepage. Search is limited to titles already tagged with that platform.
        </p>
      </div>

      {/* Platform selector */}
      <div className="flex flex-wrap gap-2">
        {STREAM_PLATFORMS.map((p) => (
          <button
            key={p.id}
            onClick={() => setPlatform(p.id)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold border transition-all ${
              platform === p.id
                ? 'bg-brand text-white border-brand'
                : 'bg-surface border-border text-text-secondary hover:border-brand/40'
            }`}
          >
            <Icon icon={p.icon} className="text-base" style={{ color: platform === p.id ? '#fff' : p.color }} />
            {p.name}
          </button>
        ))}
      </div>

      <div className="flex items-center justify-between">
        <p className="text-text-muted text-xs font-bold uppercase tracking-widest">
          {items.length} curated for {platformLabel}
        </p>
        <button
          onClick={() => { setFilmSearch(''); setFilmResults([]); setIsModalOpen(true); }}
          className="bg-brand text-white font-bold px-5 py-2.5 rounded-lg text-xs hover:opacity-90 flex items-center gap-2"
        >
          <Icon icon="solar:add-circle-linear" width="16" />
          Add film
        </button>
      </div>

      {/* Curated grid */}
      {isLoading ? (
        <div className="py-12 text-center text-text-muted">
          <Icon icon="solar:spinner-linear" className="w-6 h-6 animate-spin mx-auto" />
        </div>
      ) : items.length === 0 ? (
        <div className="py-16 text-center border border-dashed border-border rounded-2xl text-text-muted text-sm">
          Nothing curated for {platformLabel} yet. The homepage tab falls back to most-recent titles until you add some.
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {items.map((item) => (
            <div key={item.id} className="bg-surface rounded-xl border border-border overflow-hidden group relative">
              <div className="aspect-[2/3] bg-surface-2 relative">
                {item.films?.poster_url && (
                  <img src={item.films.poster_url} alt="" className="w-full h-full object-cover" />
                )}
                <button
                  onClick={() => removeFilm(item.id)}
                  className="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/70 text-white hover:bg-red-500 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all"
                  title="Remove"
                >
                  <Icon icon="solar:trash-bin-trash-linear" width="16" />
                </button>
              </div>
              <div className="p-2.5">
                <p className="text-text-primary text-xs font-bold line-clamp-1">{item.films?.title}</p>
                <p className="text-text-muted text-[10px]">{item.films?.year}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Search modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-surface border border-border rounded-xl w-full max-w-lg flex flex-col h-[600px] max-h-[90vh]">
            <div className="flex items-center justify-between p-6 border-b border-border">
              <h2 className="text-lg font-bold text-text-primary">Add to New on {platformLabel}</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-text-muted hover:text-text-primary">
                <Icon icon="solar:close-circle-linear" width="24" />
              </button>
            </div>
            <div className="p-6 border-b border-border bg-surface-2/30">
              <div className="relative">
                <Icon icon="solar:magnifer-linear" className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
                <input
                  type="text"
                  autoFocus
                  placeholder={`Search ${platformLabel} titles…`}
                  value={filmSearch}
                  onChange={(e) => setFilmSearch(e.target.value)}
                  className="w-full bg-surface-2 border border-border rounded-lg pl-10 pr-4 py-3 text-text-primary focus:border-brand outline-none"
                />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              {filmSearch.length <= 2 ? (
                <div className="text-center text-text-muted py-8 italic">Type at least 3 characters…</div>
              ) : filmResults.length === 0 ? (
                <div className="text-center text-text-muted py-8">No matching {platformLabel} titles found.</div>
              ) : (
                <div className="space-y-2">
                  {filmResults.map((film) => (
                    <button
                      key={film.id}
                      onClick={() => addFilm(film)}
                      className="w-full flex items-center gap-4 p-3 rounded-lg hover:bg-surface-2 border border-transparent hover:border-border transition-all text-left"
                    >
                      <img src={film.poster_url || ''} alt="" className="w-12 h-16 object-cover rounded bg-surface-2" />
                      <div className="flex-1 min-w-0">
                        <h4 className="font-bold text-text-primary text-sm line-clamp-1">{film.title}</h4>
                        <p className="text-xs text-text-muted">{film.year}</p>
                      </div>
                      <Icon icon="solar:add-circle-bold" width="22" className="text-brand" />
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
