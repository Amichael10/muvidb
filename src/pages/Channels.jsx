import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { formatViewCount } from '../utils/youtube';
import { Skeleton } from '../components/ui/Skeleton';
import { Icon } from '@iconify/react';

const CATEGORIES = [
  'All', 'Movies', 'Comedy', 'Series', 'Yoruba', 'Faith',
  'Celebrity', 'Network', 'Music', 'Studio', 'Skit Makers',
];

const CATEGORY_LABELS = {
  skit_maker: 'Skit Makers',
  'Skit Makers': 'Skit Makers',
  movie_channel: 'Movie Channels',
  Movies: 'Movies',
  Comedy: 'Comedy',
  Series: 'Series',
  Faith: 'Faith',
  Yoruba: 'Yoruba',
  Celebrity: 'Celebrity',
  Network: 'Network',
  Music: 'Music',
  Studio: 'Studio',
  actor: 'Actors',
};

function ChannelCard({ channel }) {
  return (
    <Link
      to={`/channels/${channel.id}`}
      className="group block bg-surface rounded-lg overflow-hidden border border-border hover:border-brand transition-all duration-500 shadow-sm"
    >
      {/* Banner */}
      <div className="h-20 w-full overflow-hidden bg-surface-2/10 relative">
        <div className="absolute inset-0 grid-bg opacity-10 pointer-events-none"></div>
        {channel.banner_url ? (
          <img
            src={channel.banner_url}
            alt=""
            className="w-full h-full object-cover opacity-60 group-hover:opacity-100 transition-all duration-700"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-brand/10 via-transparent to-bg" />
        )}
      </div>

      {/* Content */}
      <div className="px-4 pb-5 relative">
        {/* Avatar */}
        <div className="absolute -top-8 left-4">
          <div className="relative">
             <div className="absolute -inset-1 bg-brand/20 blur-lg rounded-full opacity-0 group-hover:opacity-100 transition-opacity"></div>
            {channel.thumbnail_url ? (
              <img
                src={channel.thumbnail_url}
                alt={channel.name}
                className="relative w-16 h-16 rounded-xl border-4 border-surface object-cover shadow-xl group-hover:scale-105 transition-transform duration-500"
              />
            ) : (
              <div className="relative w-16 h-16 rounded-xl border-4 border-surface bg-surface-2 flex items-center justify-center shadow-xl">
                <span className="text-brand font-bold text-2xl font-heading">{channel.name?.charAt(0)}</span>
              </div>
            )}
          </div>
        </div>

        <div className="pt-10">
          <div className="flex items-start justify-between gap-2 mb-2">
            <h3 className="text-text-primary font-bold text-sm leading-tight line-clamp-1 group-hover:text-brand transition-colors font-heading">
              {channel.name}
            </h3>
            {channel.is_featured && (
               <div className="w-1.5 h-1.5 rounded-full bg-brand animate-pulse shadow-[0_0_8px_var(--brand)]"></div>
            )}
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {channel.category && (
              <span className="text-[10px] font-bold text-text-muted bg-surface-2 px-2 py-0.5 rounded border border-border">
                {CATEGORY_LABELS[channel.category] || channel.category}
              </span>
            )}
            {channel.subscriber_count > 0 && (
              <span className="text-[10px] font-bold text-text-muted">
                {formatViewCount(channel.subscriber_count)}
              </span>
            )}
          </div>

          {channel.description && (
            <p className="text-text-muted text-[10px] mt-3 line-clamp-2 leading-relaxed italic opacity-80">
              {channel.description}
            </p>
          )}

          {channel.owner_name && (
            <p className="text-brand text-[10px] font-bold mt-3 truncate">
              {channel.owner_name}
            </p>
          )}
        </div>
      </div>
    </Link>
  );
}

function ChannelSkeleton() {
  return (
    <div className="bg-surface rounded-lg overflow-hidden border border-border">
      <div className="h-20 bg-surface-2 animate-shimmer" />
      <div className="px-4 pb-5 pt-10 space-y-4 relative">
        <div className="absolute -top-8 left-4">
           <div className="w-16 h-16 rounded-xl border-4 border-surface bg-surface-2 animate-shimmer shadow-lg" />
        </div>
        <div className="space-y-2">
          <div className="h-4 w-3/4 bg-surface-2 rounded-md animate-shimmer" />
          <div className="h-3 w-1/2 bg-surface-2 rounded-md animate-shimmer opacity-60" />
        </div>
        <div className="pt-2 space-y-2">
          <div className="h-2 w-full bg-surface-2 rounded-full animate-shimmer opacity-40" />
          <div className="h-2 w-5/6 bg-surface-2 rounded-full animate-shimmer opacity-40" />
        </div>
        <div className="h-4 w-20 bg-surface-2 rounded animate-shimmer" />
      </div>
    </div>
  );
}

export default function Channels() {
  const [channels, setChannels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');
  const [searchInput, setSearchInput] = useState('');

  useEffect(() => {
    document.title = 'Lumi | YouTube Channels';
    fetchChannels();
  }, [search, activeCategory]);

  const fetchChannels = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('channels')
        .select('*')
        .order('subscriber_count', { ascending: false, nullsFirst: false })
        .limit(96);

      if (search) {
        query = query.ilike('name', `%${search}%`);
      }

      if (activeCategory !== 'All') {
        const catVal = activeCategory === 'Skit Makers' ? 'skit_maker' : activeCategory;
        query = query.eq('category', catVal);
      }

      const { data, error } = await query;
      if (error) throw error;
      setChannels(data || []);
    } catch (err) {
      console.error('channels fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    setSearch(searchInput.trim());
  };

  const featured = channels.filter(c => c.is_featured);
  const rest = channels.filter(c => !c.is_featured);

  return (
    <div className="min-h-screen bg-bg">
      {/* Header */}
      <div className="bg-surface-2/10 border-b border-border relative overflow-hidden">
        <div className="absolute inset-0 grid-bg opacity-20 pointer-events-none"></div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 pt-32 border-x border-border relative z-10">
          <h1 className="font-heading font-bold text-4xl md:text-6xl text-text-primary mb-4 tracking-tighter">
            Creators & Studios
          </h1>
          <p className="text-text-muted text-sm max-w-xl italic border-l-2 border-brand pl-6 mb-8">
            The beating heart of Nollywood. Discover the visionary creators, independent studios, and global networks shaping the future of African entertainment.
          </p>

          {/* Search */}
          <form onSubmit={handleSearch} className="flex gap-2 max-w-lg">
            <div className="relative flex-1">
              <input
                type="text"
                value={searchInput}
                onChange={e => setSearchInput(e.target.value)}
                placeholder="SEARCH ARCHIVE..."
                className="w-full bg-surface border border-border rounded-lg px-6 py-4 pl-12 text-[10px] font-black tracking-widest text-text-primary placeholder-text-muted focus:outline-none focus:border-brand transition-all"
              />
              <Icon icon="solar:magnifer-linear" className="absolute left-4 top-1/2 -translate-y-1/2 opacity-30 text-text-primary" width="20" />
            </div>
            <button
              type="submit"
              className="bg-brand text-white font-bold px-8 py-4 rounded-lg hover:shadow-brand/20 hover:scale-[1.02] transition-all text-xs"
            >
              Search Hubs
            </button>
          </form>
        </div>
      </div>

      <div className="max-w-7xl mx-auto border-x border-border min-h-[600px] pb-20">
        {/* Category tabs */}
        <div className="p-8 md:p-12 border-b border-border bg-surface-2/5">
          <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2">
            {CATEGORIES.map(cat => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`px-6 py-2 rounded-md text-xs font-bold transition-all whitespace-nowrap ${
                  activeCategory === cat
                    ? 'bg-brand text-white shadow-lg shadow-brand/20'
                    : 'bg-surface border border-border text-text-muted hover:text-text-primary hover:border-brand/40'
                }`}
              >
                {CATEGORY_LABELS[cat] || cat}
              </button>
            ))}
          </div>
        </div>

        <div className="p-8 md:p-12">
          {loading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
              {Array.from({ length: 12 }).map((_, i) => (
                <ChannelSkeleton key={i} />
              ))}
            </div>
          ) : channels.length === 0 ? (
            <div className="text-center py-32 bg-surface-2/10 rounded-xl border-2 border-dashed border-border">
              <Icon icon="solar:videocamera-record-linear" className="text-4xl mx-auto mb-4 opacity-20 text-brand" />
              <h3 className="text-text-muted font-black uppercase tracking-widest text-xs">No hubs found matching your filters</h3>
            </div>
          ) : (
            <div className="space-y-16">
              {/* Featured section */}
              {featured.length > 0 && activeCategory === 'All' && !search && (
                <div>
                  <h2 className="text-text-primary font-bold text-xl mb-8 font-heading tracking-tighter uppercase italic flex items-center gap-3">
                    <span className="w-8 h-px bg-brand"></span>
                    Featured Hubs
                  </h2>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
                    {featured.map(c => <ChannelCard key={c.id} channel={c} />)}
                  </div>
                </div>
              )}

              {/* All/rest */}
              {(rest.length > 0 || search || activeCategory !== 'All') && (
                <div>
                  {featured.length > 0 && activeCategory === 'All' && !search && (
                    <h2 className="text-text-primary font-bold text-xl mb-8 font-heading tracking-tighter uppercase italic flex items-center gap-3">
                       <span className="w-8 h-px bg-brand"></span>
                       Industry Archive
                    </h2>
                  )}
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
                    {(search || activeCategory !== 'All' ? channels : rest).map(c => (
                      <ChannelCard key={c.id} channel={c} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
