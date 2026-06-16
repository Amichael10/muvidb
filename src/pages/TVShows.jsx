import { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Icon } from '@iconify/react';
import FilmCard from '../components/film/FilmCard';
import SkeletonCard from '../components/ui/SkeletonCard';
import { Skeleton } from '../components/ui/Skeleton';
import { getShowName } from '../utils/series';

const PLATFORM_OPTIONS = [
  { value: '', label: 'All Platforms' },
  { value: 'netflix', label: 'Netflix', icon: 'simple-icons:netflix', color: '#E50914' },
  { value: 'prime_video', label: 'Prime Video', icon: 'simple-icons:primevideo', color: '#00A8E1' },
  { value: 'showmax', label: 'Showmax', icon: 'solar:tv-linear', color: '#E10098' },
  { value: 'youtube', label: 'YouTube', icon: 'simple-icons:youtube', color: '#FF0000' },
  { value: 'kava', label: 'Kava', icon: 'solar:play-circle-bold', color: '#FF5C00' },
  { value: 'mubi', label: 'MUBI', icon: 'solar:film-linear', color: '#E6C619' },
  { value: 'ebonylife', label: 'EbonyLife', icon: 'solar:tv-bold', color: '#C2A45E' },
];

// SeriesCard removed - using global FilmCard instead

export default function TVShows() {
  const [searchParams] = useSearchParams();
  const [shows, setShows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedPlatform, setSelectedPlatform] = useState(searchParams.get('platform') || '');
  const [sortBy, setSortBy] = useState('newest');
  const [isMobileFiltersOpen, setIsMobileFiltersOpen] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 48;

  useEffect(() => {
    document.title = 'MuviDB | TV Shows';
  }, []);

  useEffect(() => {
    setPage(0);
    fetchShows(0);
  }, [selectedPlatform, sortBy]);

  const fetchShows = async (pageNum = 0) => {
    setLoading(true);
    setError(null);
    try {
      let query = supabase
        .from('films')
        .select(`
          id, title, poster_url, backdrop_url, year, source, release_type,
          streaming_links, youtube_watch_url, view_count, average_rating,
          season_count, episode_count, content_type, slug
        `, { count: 'exact' })
        .eq('content_type', 'series')
        .is('series_id', null); // Only parent series records, not individual episodes

      // Platform filter
      if (selectedPlatform === 'youtube') {
        query = query.eq('source', 'youtube');
      } else if (selectedPlatform) {
        query = query.eq('release_type', selectedPlatform);
      }

      // Sort
      const sortMap = {
        newest: { column: 'created_at', ascending: false },
        popular: { column: 'view_count', ascending: false },
        rating: { column: 'average_rating', ascending: false },
        year: { column: 'year', ascending: false },
      };
      const sortConfig = sortMap[sortBy] || sortMap.newest;
      query = query.order(sortConfig.column, { ascending: sortConfig.ascending });
      query = query.range(pageNum * PAGE_SIZE, (pageNum + 1) * PAGE_SIZE - 1);

      const { data, error: dbError, count } = await query;
      if (dbError) throw dbError;

      let rawData = data || [];
      
      // Grouping Logic
      const groupedShows = {};
      const getPrefixMatch = (str1, str2) => {
        const words1 = str1.split(/[\s:-]+/);
        const words2 = str2.split(/[\s:-]+/);
        let prefix = [];
        for (let i = 0; i < Math.min(words1.length, words2.length); i++) {
          if (words1[i].toLowerCase() === words2[i].toLowerCase()) {
            prefix.push(words1[i]);
          } else {
            break;
          }
        }
        return prefix.join(' ');
      };

      // If pageNum > 0, we can just group the new page independently, 
      // or we group the whole list. Since we only have `rawData` here, let's group it.
      // (If some episodes of the same show are on different pages, they might appear as separate groups 
      // per page, but for sorting by newest/popular, they usually cluster together).
      rawData.forEach(film => {
        let showName = getShowName(film.title);

        let foundGroup = false;
        if (!groupedShows[showName]) {
          for (const existingShowName in groupedShows) {
            const prefix = getPrefixMatch(existingShowName, showName);
            if (prefix.length >= 6 && prefix.split(' ').length >= 1) {
              if (prefix.length / existingShowName.length >= 0.4 && prefix.length / showName.length >= 0.4) {
                const group = groupedShows[existingShowName];
                group.episodes_list.push(film);
                group.title = prefix;
                if (prefix !== existingShowName) {
                  groupedShows[prefix] = group;
                  delete groupedShows[existingShowName];
                }
                foundGroup = true;
                break;
              }
            }
          }
        } else {
          groupedShows[showName].episodes_list.push(film);
          foundGroup = true;
        }

        if (!foundGroup) {
          groupedShows[showName] = { 
            ...film, 
            title: showName, 
            original_title: film.title, 
            episodes_list: [film] 
          };
        }
      });

      let transformed = Object.values(groupedShows).map(group => ({
        ...group,
        is_series_group: true,
        episodes_count: group.episodes_list.length
      }));

      if (pageNum === 0) {
        setShows(transformed);
      } else {
        setShows(prev => [...prev, ...transformed]);
      }
      setTotalCount(count || 0);
    } catch (err) {
      console.error('TV Shows fetch error:', err);
      setError('Could not load TV shows.');
    } finally {
      setLoading(false);
    }
  };

  const loadMore = () => {
    const nextPage = page + 1;
    setPage(nextPage);
    fetchShows(nextPage);
  };

  const hasMore = shows.length < totalCount;

  return (
    <div className="min-h-screen bg-bg">
      {/* Header */}
      <div className="bg-surface-2/10 border-b border-border relative overflow-hidden">
        <div className="absolute inset-0 grid-bg opacity-20 pointer-events-none" />
        <div className="max-w-7xl mx-auto px-4 py-16 pt-32 border-x border-border relative z-10">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-brand/15 border border-brand/30 flex items-center justify-center">
                  <Icon icon="solar:tv-bold" className="text-brand text-lg" />
                </div>
                <h1 className="text-4xl md:text-6xl font-heading font-bold text-text-primary tracking-tighter">
                  TV Shows
                </h1>
              </div>
              <p className="text-text-muted text-sm max-w-xl border-l-2 border-brand pl-6">
                Nigerian series, Nollywood drama anthologies, YouTube episodes — all in one place.
              </p>
              {totalCount > 0 && (
                <p className="text-text-muted text-xs pl-6">
                  <span className="text-brand font-bold">{totalCount}</span> series available
                </p>
              )}
            </div>
            <button
              className="md:hidden flex items-center justify-center gap-2 bg-surface border border-border px-6 py-3 rounded-lg text-xs font-bold text-text-primary"
              onClick={() => setIsMobileFiltersOpen(!isMobileFiltersOpen)}
            >
              <Icon icon="solar:filter-linear" width="16" />
              Filters
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto border-x border-border min-h-screen">
        <div className="flex flex-col md:flex-row divide-y md:divide-y-0 md:divide-x divide-border">
          {/* Sidebar */}
          <div className={`md:w-72 shrink-0 p-8 space-y-10 bg-surface-2/5 ${isMobileFiltersOpen ? 'block' : 'hidden md:block'}`}>
            <div className="flex items-center justify-between border-b border-border pb-4">
              <h3 className="font-heading font-bold text-sm text-text-primary">Filters</h3>
              <button
                onClick={() => { setSelectedPlatform(''); setSortBy('newest'); }}
                className="text-[9px] font-bold text-brand hover:underline"
              >
                Clear All
              </button>
            </div>

            {/* Sort */}
            <div className="space-y-4">
              <h4 className="font-bold text-text-muted text-[10px] tracking-wider">Sort By</h4>
              <select
                value={sortBy}
                onChange={e => setSortBy(e.target.value)}
                className="w-full bg-surface border border-border text-text-primary rounded-lg p-4 text-[10px] font-bold tracking-wider outline-none focus:border-brand transition-all"
              >
                <option value="newest">Newest</option>
                <option value="popular">Most Viewed</option>
                <option value="rating">Top Rated</option>
                <option value="year">By Year</option>
              </select>
            </div>

            {/* Platform */}
            <div className="space-y-4">
              <h4 className="font-bold text-text-muted text-[10px] tracking-wider">Streaming Platform</h4>
              <div className="space-y-2">
                {PLATFORM_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => setSelectedPlatform(opt.value)}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-[11px] font-bold border transition-all ${
                      selectedPlatform === opt.value
                        ? 'bg-brand/10 border-brand text-brand'
                        : 'border-border text-text-muted hover:border-brand/40 hover:text-text-primary bg-transparent'
                    }`}
                  >
                    {opt.icon && (
                      <Icon icon={opt.icon} className="text-sm" style={{ color: selectedPlatform === opt.value ? undefined : opt.color }} />
                    )}
                    {opt.label}
                    {selectedPlatform === opt.value && (
                      <Icon icon="solar:check-circle-bold" className="ml-auto text-brand text-sm" />
                    )}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Grid */}
          <div className="flex-1 p-8 md:p-12">
            {loading && shows.length === 0 ? (
              <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
                {[...Array(12)].map((_, i) => (
                  <div key={i} className="flex justify-center">
                    <SkeletonCard size="md" />
                  </div>
                ))}
              </div>
            ) : error ? (
              <div className="text-center py-32">
                <Icon icon="solar:tv-off-linear" className="text-4xl text-text-muted mx-auto mb-4" />
                <p className="text-text-muted text-sm">{error}</p>
              </div>
            ) : shows.length > 0 ? (
              <>
                <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
                  {shows.map(show => (
                    <div key={show.id} className="flex justify-center">
                      <FilmCard film={show} />
                    </div>
                  ))}
                </div>

                {hasMore && (
                  <div className="flex justify-center mt-12">
                    <button
                      onClick={loadMore}
                      disabled={loading}
                      className="px-8 py-3 bg-surface border border-border hover:border-brand text-text-primary text-xs font-bold rounded-full transition-all hover:bg-brand hover:text-white disabled:opacity-50"
                    >
                      {loading ? 'Loading...' : `Load More (${totalCount - shows.length} remaining)`}
                    </button>
                  </div>
                )}
              </>
            ) : (
              <div className="bg-surface-2/10 border-2 border-dashed border-border rounded-xl p-32 text-center">
                <Icon icon="solar:tv-linear" className="text-4xl text-text-muted mx-auto mb-4" />
                <p className="text-text-muted text-xs font-bold mb-6">No TV shows found for these filters.</p>
                <button
                  onClick={() => { setSelectedPlatform(''); setSortBy('newest'); }}
                  className="bg-brand text-white text-[10px] font-bold px-8 py-3 rounded-lg transition-all hover:shadow-lg"
                >
                  Reset Filters
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
