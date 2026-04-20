import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { formatViewCount } from '../utils/youtube';

const CATEGORIES = [
  'All', 'Movies', 'Comedy', 'Series', 'Yoruba', 'Faith',
  'Celebrity', 'Network', 'Music', 'Studio', 'skit_maker',
];

const CATEGORY_LABELS = {
  skit_maker: 'Skit Makers',
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
      className="group block bg-[#13192B] rounded-2xl overflow-hidden border border-[#252D45] hover:border-[#D4A017]/50 transition-all duration-300 hover:shadow-lg hover:shadow-[#D4A017]/5 hover:-translate-y-0.5"
    >
      {/* Banner */}
      <div className="h-20 w-full overflow-hidden bg-[#0A0F1E]">
        {channel.banner_url ? (
          <img
            src={channel.banner_url}
            alt=""
            className="w-full h-full object-cover opacity-70 group-hover:opacity-100 transition-opacity"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-r from-[#D4A017]/20 via-[#C1440E]/10 to-transparent" />
        )}
      </div>

      {/* Content */}
      <div className="px-4 pb-4 relative">
        {/* Avatar */}
        <div className="absolute -top-7 left-4">
          {channel.thumbnail_url ? (
            <img
              src={channel.thumbnail_url}
              alt={channel.name}
              className="w-14 h-14 rounded-full border-2 border-[#13192B] object-cover shadow-xl group-hover:scale-105 transition-transform duration-300"
            />
          ) : (
            <div className="w-14 h-14 rounded-full border-2 border-[#13192B] bg-[#1C2440] flex items-center justify-center shadow-xl">
              <span className="text-[#D4A017] font-bold text-xl">{channel.name?.charAt(0)}</span>
            </div>
          )}
        </div>

        <div className="pt-9">
          <div className="flex items-start justify-between gap-2">
            <h3 className="text-[#F5F0E8] font-bold text-sm leading-tight line-clamp-1 group-hover:text-[#D4A017] transition-colors">
              {channel.name}
            </h3>
            {channel.is_featured && (
              <span className="shrink-0 text-[9px] font-black uppercase tracking-widest text-[#D4A017] bg-[#D4A017]/10 px-2 py-0.5 rounded-full">
                Featured
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 mt-1 flex-wrap">
            {channel.category && (
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#7A8099] bg-[#1C2440] px-2 py-0.5 rounded-full">
                {CATEGORY_LABELS[channel.category] || channel.category}
              </span>
            )}
            {channel.subscriber_count > 0 && (
              <span className="text-[10px] text-[#7A8099]">
                {formatViewCount(channel.subscriber_count)} subscribers
              </span>
            )}
          </div>

          {channel.description && (
            <p className="text-[#7A8099] text-xs mt-2 line-clamp-2 leading-relaxed">
              {channel.description}
            </p>
          )}

          {channel.owner_name && (
            <p className="text-[#D4A017] text-xs mt-2 font-medium truncate">
              {channel.owner_name}
            </p>
          )}
        </div>
      </div>
    </Link>
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
      const params = new URLSearchParams({ limit: '96' });
      if (search) params.set('search', search);
      if (activeCategory !== 'All') params.set('category', activeCategory);

      const res = await fetch(`/api/channels?${params}`);
      if (!res.ok) throw new Error(`${res.status}`);
      const { channels: data } = await res.json();
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
    <div className="min-h-screen bg-[#0A0F1E] pt-20 pb-20">
      {/* Header */}
      <div className="bg-[#13192B] border-b border-[#252D45]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <h1 className="font-heading font-bold text-3xl md:text-4xl text-[#F5F0E8] mb-2">
            Nollywood YouTube Channels
          </h1>
          <p className="text-[#7A8099] text-sm">
            Discover the creators, studios, and networks behind Nigerian film and entertainment
          </p>

          {/* Search */}
          <form onSubmit={handleSearch} className="mt-6 flex gap-2 max-w-md">
            <input
              type="text"
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              placeholder="Search channels…"
              className="flex-1 bg-[#0A0F1E] border border-[#252D45] rounded-xl px-4 py-2.5 text-[#F5F0E8] placeholder-[#7A8099] text-sm focus:outline-none focus:border-[#D4A017] transition-colors"
            />
            <button
              type="submit"
              className="bg-[#D4A017] text-black font-bold px-5 py-2.5 rounded-xl hover:bg-[#D4A017]/90 transition-colors text-sm"
            >
              Search
            </button>
            {search && (
              <button
                type="button"
                onClick={() => { setSearch(''); setSearchInput(''); }}
                className="px-3 py-2.5 rounded-xl border border-[#252D45] text-[#7A8099] hover:text-[#F5F0E8] text-sm transition-colors"
              >
                ✕
              </button>
            )}
          </form>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Category tabs */}
        <div className="flex gap-2 flex-wrap mb-8">
          {CATEGORIES.map(cat => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${
                activeCategory === cat
                  ? 'bg-[#D4A017] text-black'
                  : 'bg-[#13192B] border border-[#252D45] text-[#7A8099] hover:text-[#F5F0E8] hover:border-[#D4A017]/40'
              }`}
            >
              {CATEGORY_LABELS[cat] || cat}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="animate-pulse bg-[#13192B] rounded-2xl overflow-hidden border border-[#252D45]">
                <div className="h-20 bg-[#1C2440]" />
                <div className="px-4 pb-4 pt-10 space-y-2">
                  <div className="h-4 bg-[#1C2440] rounded w-3/4" />
                  <div className="h-3 bg-[#1C2440] rounded w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : channels.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-5xl mb-4">📺</p>
            <h3 className="text-[#F5F0E8] font-bold text-xl mb-2">No channels found</h3>
            <p className="text-[#7A8099]">Try a different search or category</p>
          </div>
        ) : (
          <>
            {/* Featured section */}
            {featured.length > 0 && activeCategory === 'All' && !search && (
              <div className="mb-10">
                <h2 className="text-[#F5F0E8] font-bold text-lg mb-4 flex items-center gap-2">
                  <span className="text-[#D4A017]">★</span> Featured Channels
                </h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                  {featured.map(c => <ChannelCard key={c.id} channel={c} />)}
                </div>
              </div>
            )}

            {/* All/rest */}
            {(rest.length > 0 || search || activeCategory !== 'All') && (
              <>
                {featured.length > 0 && activeCategory === 'All' && !search && (
                  <h2 className="text-[#F5F0E8] font-bold text-lg mb-4">All Channels</h2>
                )}
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                  {(search || activeCategory !== 'All' ? channels : rest).map(c => (
                    <ChannelCard key={c.id} channel={c} />
                  ))}
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
