import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { formatViewCount, resolveChannelId, fetchRecentVideosFromChannel } from '../utils/youtube';
import { Icon } from '@iconify/react';
import ImageWithFallback from '../components/ui/ImageWithFallback';
import { toTitleCase, toSentenceCase } from '../utils/format';
import SEO from '../components/SEO';

function formatRelativeTime(dateString) {
  if (!dateString) return '';
  const date = new Date(dateString);
  const now = new Date();
  const diffInSeconds = Math.floor((now - date) / 1000);
  
  if (diffInSeconds < 60) return 'Just now';
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} mins ago`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} hours ago`;
  if (diffInSeconds < 604800) {
    const days = Math.floor(diffInSeconds / 86400);
    return `${days} day${days > 1 ? 's' : ''} ago`;
  }
  if (diffInSeconds < 2592000) {
    const weeks = Math.floor(diffInSeconds / 604800);
    return `${weeks} week${weeks > 1 ? 's' : ''} ago`;
  }
  if (diffInSeconds < 31536000) {
    const months = Math.floor(diffInSeconds / 2592000);
    return `${months} month${months > 1 ? 's' : ''} ago`;
  }
  const years = Math.floor(diffInSeconds / 31536000);
  return `${years} year${years > 1 ? 's' : ''} ago`;
}

function VideoGridCard({ video }) {
  const youtubeUrl = `https://www.youtube.com/watch?v=${video.videoId}`;

  return (
    <a
      href={youtubeUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="group bg-surface border border-border hover:border-brand/60 rounded-2xl overflow-hidden transition-all duration-300 hover:shadow-xl hover:shadow-brand/5 flex flex-col justify-between"
    >
      <div>
        {/* Video Thumbnail Box */}
        <div className="relative aspect-video bg-surface-2 overflow-hidden">
          <ImageWithFallback
            src={video.thumbnail}
            alt={toSentenceCase(video.title)}
            fallbackType="video"
            name={toSentenceCase(video.title)}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
          
          {video.film_id && (
            <span className="absolute top-2.5 left-2.5 bg-brand text-on-brand text-[9px] font-black px-2 py-0.5 rounded-md border border-brand/20 uppercase tracking-widest shadow-lg z-10">
              CHANNEL PREMIERE
            </span>
          )}

          {video.duration && (
            <span className="absolute bottom-2.5 right-2.5 bg-black/80 backdrop-blur-md text-white text-[10px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider z-10">
              {video.duration}
            </span>
          )}

          {/* Hover Play Button Overlay */}
          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300 bg-black/30 backdrop-blur-[2px]">
            <div className="w-12 h-12 bg-brand text-on-brand rounded-full flex items-center justify-center shadow-2xl scale-90 group-hover:scale-100 transition-transform">
              <Icon icon="solar:play-bold" className="w-5 h-5 ml-0.5" />
            </div>
          </div>
        </div>

        {/* Video Details */}
        <div className="p-4">
          <h3 className="text-text-primary text-sm font-bold leading-snug group-hover:text-brand transition-colors line-clamp-2 mb-2" title={toSentenceCase(video.title)}>
            {toSentenceCase(video.title)}
          </h3>

          <div className="flex items-center gap-2 text-xs text-text-muted font-semibold">
            {video.viewCount > 0 && <span>{formatViewCount(video.viewCount)} views</span>}
            {video.viewCount > 0 && video.publishedAt && <span>•</span>}
            {video.publishedAt && <span>{formatRelativeTime(video.publishedAt)}</span>}
          </div>
        </div>
      </div>
    </a>
  );
}

const ChannelDetailSkeleton = () => (
    <div className="min-h-screen bg-bg">
        <div className="relative h-64 md:h-[350px] bg-surface-2/10 border-b border-border overflow-hidden">
            <div className="absolute inset-0 bg-surface-2 animate-shimmer opacity-20" />
        </div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <div className="flex gap-6">
                <div className="w-24 h-24 rounded-full bg-surface-2 animate-shimmer shrink-0" />
                <div className="flex-1 space-y-4 pt-2">
                    <div className="h-8 w-1/3 bg-surface-2 rounded-lg animate-shimmer" />
                    <div className="h-4 w-1/4 bg-surface-2 rounded-md animate-shimmer" />
                </div>
            </div>
        </div>
    </div>
);

const Description = ({ text }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const isLong = text && text.length > 140;
  const displayText = isExpanded ? text : text?.slice(0, 140) + (isLong ? '...' : '');

  if (!text) return null;

  return (
    <div className="text-text-muted text-xs max-w-2xl leading-relaxed mt-3">
      {displayText}
      {isLong && (
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="text-brand hover:underline font-bold ml-2 transition-colors"
        >
          {isExpanded ? 'Show less' : 'Read more'}
        </button>
      )}
    </div>
  );
};

export default function ChannelDetail() {
  const { slug } = useParams();
  const navigate = useNavigate();
  
  const [channel, setChannel] = useState(null);
  const [ytStats, setYtStats] = useState(null);
  const [allVideos, setAllVideos] = useState([]);
  
  const [owner, setOwner] = useState(null);
  const [relatedChannels, setRelatedChannels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filter & Pagination States
  const [activeTab, setActiveTab] = useState('all'); // 'all', 'premieres', 'popular', 'latest'
  const [searchQuery, setSearchQuery] = useState('');
  const [visibleCount, setVisibleCount] = useState(18);

  useEffect(() => {
    fetchChannelData();
  }, [slug]);

  const fetchChannelData = async () => {
    setLoading(true);
    setError(null);
    try {
      // 1. Fetch channel from DB
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      let channelData = null;

      if (uuidRegex.test(slug)) {
        const { data } = await supabase.from('channels').select('*').eq('id', slug).maybeSingle();
        channelData = data;
      } else {
        const cleanSlug = slug.toLowerCase().trim();
        const { data } = await supabase
          .from('channels')
          .select('*')
          .or(`slug.eq.${cleanSlug},mubi_slug.eq.${cleanSlug},channel_handle.eq.@${cleanSlug}`)
          .maybeSingle();
        channelData = data;
      }

      if (!channelData) {
        const { data: fallback } = await supabase
          .from('channels')
          .select('*')
          .ilike('name', `%${slug.replace(/-/g, ' ')}%`)
          .limit(1);
        channelData = fallback?.[0] || null;
      }
      
      if (!channelData) throw new Error('Channel not found');
      const ch = channelData;
      setChannel(ch);
      document.title = `MuviDB | ${toTitleCase(ch.name)}`;

      // 2. Fetch owner if exists
      if (ch.owner_person_id) {
        const { data: p } = await supabase
          .from('people')
          .select('id, name, photo_url, known_for_department, slug')
          .eq('id', ch.owner_person_id)
          .single();
        setOwner(p);
      }

      // 3. Fetch related channels
      const { data: related } = await supabase
        .from('channels')
        .select('id, name, channel_handle, thumbnail_url, subscriber_count, slug')
        .neq('id', ch.id)
        .limit(3);
      setRelatedChannels(related || []);

      // 4. Query DB channel_videos table directly
      const { data: dbVideos } = await supabase
        .from('channel_videos')
        .select('id, video_id, title, thumbnail_url, published_at, duration_seconds, film_id')
        .eq('channel_id', ch.id)
        .order('published_at', { ascending: false });

      const formattedDbVideos = (dbVideos || []).map(v => {
        const totalSecs = v.duration_seconds || 0;
        const mins = Math.floor(totalSecs / 60);
        const secs = totalSecs % 60;
        const durationStr = totalSecs ? `${mins}:${secs < 10 ? '0' : ''}${secs}` : '';
        return {
          videoId: v.video_id,
          title: v.title || 'Untitled Video',
          thumbnail: v.thumbnail_url || `https://i.ytimg.com/vi/${v.video_id}/mqdefault.jpg`,
          publishedAt: v.published_at,
          duration: durationStr,
          viewCount: 0,
          film_id: v.film_id
        };
      });

      // 5. Fetch live YouTube Stats & Videos if possible
      let liveYtVideos = [];
      if (ch.channel_handle || ch.channel_url || ch.channel_id) {
        const handleOrUrl = ch.channel_handle || ch.channel_url || ch.channel_id;
        const ytInfo = await resolveChannelId(handleOrUrl);
        if (ytInfo && !ytInfo.error) {
           setYtStats({
              subscriberCount: ytInfo.subscriberCount,
              videoCount: ytInfo.videoCount,
              viewCount: ytInfo.viewCount,
              joined: ytInfo.publishedAt
           });
           if (ytInfo.channelId) {
             liveYtVideos = await fetchRecentVideosFromChannel(ytInfo.channelId, 50);
           }
        }
      }

      // Merge DB & YouTube videos
      const dbMapByVideoId = (formattedDbVideos || []).reduce((acc, v) => {
        acc[v.videoId] = v;
        return acc;
      }, {});

      const combinedMap = { ...dbMapByVideoId };
      (liveYtVideos || []).forEach(v => {
        if (combinedMap[v.videoId]) {
          combinedMap[v.videoId] = {
            ...combinedMap[v.videoId],
            viewCount: v.viewCount || combinedMap[v.videoId].viewCount,
            publishedAt: v.publishedAt || combinedMap[v.videoId].publishedAt,
            duration: v.duration || combinedMap[v.videoId].duration
          };
        } else {
          combinedMap[v.videoId] = v;
        }
      });

      setAllVideos(Object.values(combinedMap));

    } catch (err) {
      setError(err.message === 'Channel not found' ? 'Channel not found' : 'Failed to load channel');
    } finally {
      setLoading(false);
    }
  };

  // Filtered and Sorted Videos Computation
  const filteredVideos = useMemo(() => {
    let result = [...allVideos];

    // 1. Text Search Filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      result = result.filter(v => v.title?.toLowerCase().includes(query));
    }

    // 2. Tab Filter
    if (activeTab === 'premieres') {
      result = result.filter(v => v.film_id);
    } else if (activeTab === 'popular') {
      result.sort((a, b) => (b.viewCount || 0) - (a.viewCount || 0));
    } else if (activeTab === 'latest') {
      result.sort((a, b) => new Date(b.publishedAt || 0) - new Date(a.publishedAt || 0));
    }

    return result;
  }, [allVideos, activeTab, searchQuery]);

  const displayedVideos = useMemo(() => {
    return filteredVideos.slice(0, visibleCount);
  }, [filteredVideos, visibleCount]);

  if (loading) return <ChannelDetailSkeleton />;

  if (error || !channel) return (
    <div className="min-h-screen bg-bg flex items-center justify-center">
      <div className="max-w-7xl mx-auto px-4 border-x border-border py-32 text-center w-full">
        <Icon icon="solar:videocamera-record-linear" className="text-4xl mx-auto mb-4 opacity-20 text-brand" />
        <p className="text-text-primary font-heading font-bold text-xl mb-8">{error || 'Channel not found'}</p>
        <button onClick={() => navigate('/channels')} className="bg-brand text-on-brand font-bold px-8 py-4 rounded-lg hover:bg-brand-hover transition-all">
          Back to Channels
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-bg text-text-primary pb-20">
      <SEO 
        title={`${toTitleCase(channel.name)} - YouTube Movies & Channel Info | MuviDB`}
        description={channel.description || `Explore ${channel.name} Nollywood movies, uploads, statistics, and production details on MuviDB.`}
      />

      {/* HEADER BANNER */}
      <div className="relative border-b border-border bg-surface/30">
        <div className="absolute inset-0 h-[280px] md:h-[360px]">
          <ImageWithFallback
            src={channel.banner_url}
            alt=""
            fallbackType="banner"
            name={toTitleCase(channel.name)}
            className="w-full h-full object-cover opacity-30"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-bg via-bg/80 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-r from-bg via-transparent to-transparent opacity-80" />
        </div>

        <div className="max-w-[1400px] mx-auto px-4 sm:px-8 relative z-10 pt-16 md:pt-28 pb-8">
          <div className="flex flex-col md:flex-row gap-6 md:gap-8 items-start justify-between">
            
            {/* Left Info */}
            <div className="flex gap-6 items-start">
              <ImageWithFallback
                src={channel.thumbnail_url}
                alt={toTitleCase(channel.name)}
                fallbackType="avatar"
                name={toTitleCase(channel.name)}
                className="w-24 h-24 md:w-32 md:h-32 rounded-full border-2 border-border object-cover shadow-2xl shrink-0"
              />
              <div className="pt-2">
                <div className="flex items-center gap-2 mb-1">
                  <h1 className="text-2xl md:text-4xl font-heading font-bold text-text-primary tracking-tight">{toTitleCase(channel.name)}</h1>
                  <Icon icon="solar:verified-check-bold" className="text-brand text-xl" />
                </div>
                
                <div className="flex items-center gap-3 text-text-muted text-[11px] font-bold">
                  {channel.channel_handle && <span>{channel.channel_handle}</span>}
                  {channel.channel_handle && <span>•</span>}
                  <span>{formatViewCount(ytStats?.subscriberCount || channel.subscriber_count)} subscribers</span>
                  <span>•</span>
                  <div className="flex items-center gap-1.5">
                    <img src="https://flagcdn.com/w20/ng.png" alt="Nigeria" className="w-3 rounded-sm opacity-80" />
                    <span>{channel.country || 'Nigeria'}</span>
                  </div>
                </div>

                <Description text={toSentenceCase(channel.description)} />

                <div className="flex items-center gap-3 mt-5">
                  <a href={channel.channel_url} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-2 bg-brand hover:bg-brand-hover text-on-brand font-bold text-[11px] px-6 py-2.5 rounded-lg transition-all shadow-lg hover:scale-[1.02]">
                    <Icon icon="solar:play-bold" className="text-sm" />
                    Visit Channel <Icon icon="solar:arrow-right-up-linear" className="text-sm" />
                  </a>
                  <button className="flex items-center gap-2 border border-border bg-surface hover:bg-surface-2 text-text-primary font-bold text-[11px] px-6 py-2.5 rounded-lg transition-all">
                    <Icon icon="solar:add-square-linear" className="text-sm" />
                    Follow
                  </button>
                </div>
              </div>
            </div>

            {/* Right Stats */}
            <div className="flex items-center gap-8 md:gap-12 md:pr-12 pt-4 md:pt-6">
              <div className="flex flex-col items-center">
                <div className="flex items-center gap-1.5 text-brand mb-1">
                  <Icon icon="solar:clapperboard-play-bold" className="text-base" />
                  <span className="text-text-primary font-heading font-bold text-lg">{formatViewCount(ytStats?.videoCount || allVideos.length)}+</span>
                </div>
                <span className="text-[10px] text-text-muted font-bold uppercase tracking-wider">Uploads</span>
              </div>
              <div className="flex flex-col items-center">
                <div className="flex items-center gap-1.5 text-brand mb-1">
                  <Icon icon="solar:users-group-rounded-bold" className="text-base" />
                  <span className="text-text-primary font-heading font-bold text-lg">{formatViewCount(ytStats?.subscriberCount || channel.subscriber_count)}</span>
                </div>
                <span className="text-[10px] text-text-muted font-bold uppercase tracking-wider">Subscribers</span>
              </div>
              <div className="flex flex-col items-center">
                <div className="flex items-center gap-1.5 text-brand mb-1">
                  <Icon icon="solar:chart-square-bold" className="text-base" />
                  <span className="text-text-primary font-heading font-bold text-lg">{formatViewCount(ytStats?.viewCount || 0)}+</span>
                </div>
                <span className="text-[10px] text-text-muted font-bold uppercase tracking-wider">Total Views</span>
              </div>
            </div>

          </div>
        </div>
      </div>

      {/* MAIN CONTENT */}
      <div className="max-w-[1400px] mx-auto px-4 sm:px-8 py-10">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-12">
          
          {/* Left Main Column - Scannable Grid */}
          <div>
            
            {/* Filter & Control Bar */}
            <div className="bg-surface border border-border p-4 rounded-2xl mb-8 flex flex-col md:flex-row items-center justify-between gap-4 shadow-sm">
              {/* Category Filter Tabs */}
              <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
                {[
                  { id: 'all', label: `All Movies & Uploads (${allVideos.length})` },
                  { id: 'premieres', label: `Movie Premieres ⭐ (${allVideos.filter(v => v.film_id).length})` },
                  { id: 'popular', label: 'Most Popular' },
                  { id: 'latest', label: 'Latest Uploads' }
                ].map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => {
                      setActiveTab(tab.id);
                      setVisibleCount(18);
                    }}
                    className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
                      activeTab === tab.id
                        ? 'bg-brand text-on-brand shadow-md'
                        : 'bg-surface-2 border border-border text-text-muted hover:text-text-primary hover:border-brand/40'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Instant Search Bar */}
              <div className="relative w-full md:w-64">
                <Icon icon="solar:magnifer-linear" className="absolute left-3 top-2.5 text-text-muted w-4 h-4" />
                <input
                  type="text"
                  placeholder="Search in channel..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setVisibleCount(18);
                  }}
                  className="w-full pl-9 pr-3 py-2 bg-bg border border-border rounded-xl text-xs text-text-primary placeholder-text-muted focus:outline-none focus:border-brand transition-colors"
                />
              </div>
            </div>

            {/* Video Grid */}
            {displayedVideos.length === 0 ? (
              <div className="bg-surface border border-border p-16 rounded-2xl text-center">
                <Icon icon="solar:videocamera-record-line-duotone" className="w-16 h-16 text-text-muted mx-auto mb-3 opacity-40" />
                <h3 className="text-lg font-bold text-text-primary mb-1">No videos found</h3>
                <p className="text-xs text-text-muted">No uploads match your selected filter or search term.</p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {displayedVideos.map(video => (
                    <VideoGridCard key={video.videoId} video={video} />
                  ))}
                </div>

                {/* Load More Button */}
                {filteredVideos.length > visibleCount && (
                  <div className="mt-12 text-center">
                    <button
                      onClick={() => setVisibleCount(prev => prev + 18)}
                      className="px-8 py-3.5 bg-surface border border-border hover:border-brand/50 text-text-primary font-bold text-xs rounded-xl shadow-md hover:bg-surface-2 transition-all inline-flex items-center gap-2"
                    >
                      <span>Load More Movies ({filteredVideos.length - visibleCount} remaining)</span>
                      <Icon icon="solar:alt-arrow-down-linear" className="w-4 h-4 text-brand" />
                    </button>
                  </div>
                )}
              </>
            )}

          </div>

          {/* Right Sidebar */}
          <div className="space-y-6">
            
            {/* Genres */}
            <div className="bg-surface border border-border rounded-2xl p-5 shadow-sm">
              <h3 className="text-text-primary text-sm font-bold mb-4 font-heading">Genres on this Channel</h3>
              <div className="flex flex-wrap gap-2">
                {['Drama', 'Thriller', 'Romance', 'Comedy', 'Action', 'Family'].map(genre => (
                  <span key={genre} className="text-[10px] font-bold text-text-muted border border-border rounded-lg px-3 py-1.5 flex items-center gap-1.5 bg-surface-2">
                    <Icon icon="solar:clapperboard-play-linear" className="opacity-50" />
                    {genre}
                  </span>
                ))}
              </div>
            </div>

            {/* Languages */}
            <div className="bg-surface border border-border rounded-2xl p-5 shadow-sm">
              <h3 className="text-text-primary text-sm font-bold mb-4 font-heading">Languages</h3>
              <div className="flex flex-wrap gap-2">
                {['English', 'Yoruba', 'Igbo', 'Pidgin'].map(lang => (
                  <span key={lang} className="text-[10px] font-bold text-text-muted border border-border rounded-lg px-3 py-1.5 bg-surface-2">
                    {lang}
                  </span>
                ))}
              </div>
            </div>

            {/* Related Channels */}
            {relatedChannels.length > 0 && (
              <div className="bg-surface border border-border rounded-2xl p-5 shadow-sm">
                <h3 className="text-text-primary text-sm font-bold mb-4 font-heading">Related Channels</h3>
                <div className="space-y-4">
                  {relatedChannels.map(rc => (
                    <div key={rc.id} className="flex items-center justify-between group">
                      <Link to={`/channels/${rc.slug || rc.id}`} className="flex items-center gap-3 flex-1 overflow-hidden">
                        <ImageWithFallback src={rc.thumbnail_url} alt={rc.name} fallbackType="avatar" name={rc.name} className="w-9 h-9 rounded-full border border-border shrink-0" />
                        <div className="overflow-hidden">
                          <h4 className="text-text-primary text-xs font-bold group-hover:text-brand transition-colors line-clamp-1">{rc.name}</h4>
                          <div className="flex items-center gap-1.5 text-[10px] text-text-muted">
                            <span className="truncate">{rc.channel_handle || `@${rc.name.replace(/\s+/g,'').toLowerCase()}`}</span>
                            <span>•</span>
                            <span className="shrink-0">{formatViewCount(rc.subscriber_count)} subs</span>
                          </div>
                        </div>
                      </Link>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* People & Partners */}
            {owner && (
              <div className="bg-surface border border-border rounded-2xl p-5 shadow-sm">
                <h3 className="text-text-primary text-sm font-bold mb-4 font-heading">People & Production Partners</h3>
                <div className="flex flex-wrap gap-x-6 gap-y-4">
                  
                  <Link to={`/people/${owner.slug || owner.id}`} className="flex items-center gap-3 group">
                    <ImageWithFallback src={owner.photo_url} alt={owner.name} fallbackType="avatar" name={owner.name} className="w-10 h-10 rounded-full border border-border object-cover" />
                    <div>
                      <h4 className="text-text-primary text-xs font-bold group-hover:text-brand transition-colors">{owner.name}</h4>
                      <p className="text-[10px] text-brand font-bold">{owner.known_for_department || 'Producer'}</p>
                    </div>
                  </Link>

                </div>
              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  );
}
