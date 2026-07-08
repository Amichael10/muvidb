import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { formatViewCount, parseDuration, resolveChannelId, fetchRecentVideosFromChannel } from '../utils/youtube';
import { Skeleton } from '../components/ui/Skeleton';
import ShareAction from '../components/ui/ShareAction';
import { Icon } from '@iconify/react';
import ImageWithFallback from '../components/ui/ImageWithFallback';
import { toTitleCase, toSentenceCase } from '../utils/format';

const CATEGORY_LABELS = {
  skit_maker: 'Skit Makers', movie_channel: 'Movie Channel',
  Movies: 'Movies', Comedy: 'Comedy', Series: 'Series',
  Faith: 'Faith', Yoruba: 'Yoruba', Celebrity: 'Celebrity',
  Network: 'Network', Music: 'Music', Studio: 'Studio', actor: 'Actor',
};

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

function VideoCard({ video, variant = 'default' }) {
  const youtubeUrl = `https://www.youtube.com/watch?v=${video.videoId}`;
  
  if (variant === 'featured') {
    return (
      <a href={youtubeUrl} target="_blank" rel="noopener noreferrer"
        className="group relative block rounded-xl overflow-hidden border border-border hover:border-brand transition-all duration-500 shadow-sm shrink-0 w-[280px] sm:w-[320px] aspect-[16/9]">
        <ImageWithFallback
          src={video.thumbnail}
          alt={toSentenceCase(video.title)}
          fallbackType="video"
          name={toSentenceCase(video.title)}
          className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent opacity-90" />
        
        {video.film_id && (
           <span className="absolute top-3 left-3 bg-brand text-white text-[9px] font-black px-2 py-0.5 rounded border border-brand/20 uppercase tracking-widest shadow-lg">
             CHANNEL PREMIERE
           </span>
        )}
        <div className="absolute bottom-3 left-3 right-3">
           <h3 className="text-white font-bold text-sm sm:text-base leading-tight mb-1 line-clamp-2">{toSentenceCase(video.title)}</h3>
           <div className="flex items-center gap-2 text-white/70 text-[10px] font-bold">
              {video.film_genres && <span>{video.film_genres}</span>}
              {video.film_genres && <span>•</span>}
              <span>{new Date(video.publishedAt).getFullYear()}</span>
              <span>•</span>
              <span>{video.duration}</span>
           </div>
        </div>
        <div className="absolute bottom-3 right-3 w-8 h-8 rounded-full bg-black/50 border border-white/20 flex items-center justify-center backdrop-blur-md">
           <Icon icon="solar:play-bold" className="text-white text-sm" />
        </div>
      </a>
    );
  }

  return (
    <a href={youtubeUrl} target="_blank" rel="noopener noreferrer"
      className="group block rounded-xl overflow-hidden shrink-0 w-[220px] sm:w-[260px]">
      <div className="relative aspect-video bg-surface-2 overflow-hidden rounded-xl border border-border group-hover:border-brand transition-all duration-500 shadow-sm mb-3">
        <ImageWithFallback
          src={video.thumbnail}
          alt={toSentenceCase(video.title)}
          fallbackType="video"
          name={toSentenceCase(video.title)}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
        />
        {video.duration && (
          <span className="absolute bottom-2 right-2 bg-black/80 backdrop-blur-md text-white text-[9px] font-black px-1.5 py-0.5 rounded uppercase tracking-widest">
            {video.duration}
          </span>
        )}
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-500 bg-black/20 backdrop-blur-[2px]">
          <div className="w-10 h-10 bg-brand text-white rounded-full flex items-center justify-center shadow-2xl scale-75 group-hover:scale-100 transition-transform">
            <svg className="w-4 h-4 ml-0.5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z"/>
            </svg>
          </div>
        </div>
      </div>
      <div>
        <h3 className="text-text-primary text-xs font-bold leading-tight group-hover:text-brand transition-colors line-clamp-2 mb-1.5">
          {toSentenceCase(video.title)}
        </h3>
        <div className="flex items-center gap-2 text-[10px] text-text-muted font-bold">
          <span>{formatViewCount(video.viewCount)} views</span>
          <span className="w-1 h-1 rounded-full bg-border"></span>
          <span>{formatRelativeTime(video.publishedAt)}</span>
        </div>
      </div>
    </a>
  );
}

const ChannelDetailSkeleton = () => (
    <div className="min-h-screen bg-bg">
        <div className="relative h-64 md:h-[400px] bg-surface-2/10 border-b border-border overflow-hidden">
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
)

const Description = ({ text }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const isLong = text && text.length > 120;
  const displayText = isExpanded ? text : text?.slice(0, 120) + (isLong ? '...' : '');

  if (!text) return null;

  return (
    <div className="text-text-muted text-[11px] max-w-2xl leading-relaxed mt-3">
      {displayText}
      {isLong && (
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="text-text-primary hover:text-brand font-bold ml-2 transition-colors"
        >
          {isExpanded ? 'less' : 'more'}
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
  const [featuredVideos, setFeaturedVideos] = useState([]);
  const [popularVideos, setPopularVideos] = useState([]);
  const [latestVideos, setLatestVideos] = useState([]);
  
  const [owner, setOwner] = useState(null);
  const [relatedChannels, setRelatedChannels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchChannelData();
  }, [slug]);

  const fetchChannelData = async () => {
    setLoading(true);
    setError(null);
    try {
      // 1. Fetch channel from DB
      let query = supabase.from('channels').select('*');
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      if (uuidRegex.test(slug)) {
        query = query.eq('id', slug);
      } else {
        query = query.eq('slug', slug);
      }
      const { data: ch, error: chErr } = await query.single();
      
      if (chErr || !ch) throw new Error('Channel not found');
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
        .select('id, name, channel_handle, thumbnail_url, subscriber_count')
        .neq('id', ch.id)
        .limit(3);
      setRelatedChannels(related || []);

      // 4. Fetch DB mapped videos
      const { data: dbVideos } = await supabase
        .from('channel_videos')
        .select('video_id, film_id')
        .eq('channel_id', ch.id)
        .not('film_id', 'is', null);

      const dbVideoMap = (dbVideos || []).reduce((acc, v) => {
         acc[v.video_id] = v.film_id;
         return acc;
      }, {});

      // 5. Fetch YouTube Stats & Videos
      let channelId = null;
      if (ch.channel_handle || ch.channel_url) {
        const handleOrUrl = ch.channel_handle || ch.channel_url;
        const ytInfo = await resolveChannelId(handleOrUrl);
        if (ytInfo && !ytInfo.error) {
           setYtStats({
              subscriberCount: ytInfo.subscriberCount,
              videoCount: ytInfo.videoCount,
              viewCount: ytInfo.viewCount,
              joined: ytInfo.publishedAt
           });
           channelId = ytInfo.channelId;
        }
      }

      if (channelId) {
         const ytVideos = await fetchRecentVideosFromChannel(channelId, 50);
         
         // Merge DB film mapping
         const mergedVideos = ytVideos.map(v => ({
            ...v,
            film_id: dbVideoMap[v.videoId] || null
         }));

         // Featured: Has film_id OR top 3 most viewed
         const mapped = mergedVideos.filter(v => v.film_id);
         let featured = [];
         if (mapped.length >= 3) {
            featured = mapped.slice(0, 5);
         } else {
            featured = [...mergedVideos].sort((a, b) => b.viewCount - a.viewCount).slice(0, 5);
         }
         
         // Popular: Sorted by views
         const popular = [...mergedVideos]
            .filter(v => !featured.find(f => f.videoId === v.videoId)) // Exclude featured
            .sort((a, b) => b.viewCount - a.viewCount)
            .slice(0, 10);
            
         // Latest: Sorted by date (already sorted by fetchRecentVideosFromChannel generally)
         const latest = [...mergedVideos]
            .filter(v => !featured.find(f => f.videoId === v.videoId) && !popular.find(p => p.videoId === v.videoId))
            .slice(0, 10);

         setFeaturedVideos(featured);
         setPopularVideos(popular);
         setLatestVideos(latest);
      }
    } catch (err) {
      setError(err.message === 'Channel not found' ? 'Channel not found' : 'Failed to load channel');
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <ChannelDetailSkeleton />;

  if (error || !channel) return (
    <div className="min-h-screen bg-bg flex items-center justify-center">
      <div className="max-w-7xl mx-auto px-4 border-x border-border py-32 text-center w-full">
        <Icon icon="solar:videocamera-record-linear" className="text-4xl mx-auto mb-4 opacity-20 text-brand" />
        <p className="text-text-primary font-heading font-bold text-xl mb-8">{error || 'Channel not found'}</p>
        <button onClick={() => navigate('/channels')} className="bg-brand text-white font-bold px-8 py-4 rounded-lg hover:shadow-brand/20 transition-all">
          Back to Channels
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#0A0A0A]">
      {/* HEADER BANNER */}
      <div className="relative border-b border-border/50">
        <div className="absolute inset-0 h-[300px] md:h-[400px]">
          <ImageWithFallback
            src={channel.banner_url}
            alt=""
            fallbackType="banner"
            name={toTitleCase(channel.name)}
            className="w-full h-full object-cover opacity-40"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0A0A0A] via-[#0A0A0A]/80 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-r from-[#0A0A0A] via-transparent to-transparent opacity-80" />
        </div>

        <div className="max-w-[1400px] mx-auto px-4 sm:px-8 relative z-10 pt-20 md:pt-32 pb-8">
          <div className="flex flex-col md:flex-row gap-6 md:gap-8 items-start justify-between">
            
            {/* Left Info */}
            <div className="flex gap-6 items-start">
              <ImageWithFallback
                src={channel.thumbnail_url}
                alt={toTitleCase(channel.name)}
                fallbackType="avatar"
                name={toTitleCase(channel.name)}
                className="w-24 h-24 md:w-32 md:h-32 rounded-full border border-border/50 object-cover shadow-2xl shrink-0"
              />
              <div className="pt-2">
                <div className="flex items-center gap-2 mb-1">
                  <h1 className="text-2xl md:text-4xl font-heading font-bold text-white tracking-tight">{toTitleCase(channel.name)}</h1>
                  <Icon icon="solar:verified-check-bold" className="text-[#FFD700] text-xl" />
                </div>
                
                <div className="flex items-center gap-3 text-text-muted text-[11px] font-bold">
                  {channel.channel_handle && <span>{channel.channel_handle}</span>}
                  {channel.channel_handle && <span>•</span>}
                  <span>{formatViewCount(ytStats?.subscriberCount || channel.subscriber_count)} subscribers</span>
                  <span>•</span>
                  <div className="flex items-center gap-1.5">
                    <img src="https://flagcdn.com/w20/ng.png" alt="Nigeria" className="w-3 rounded-sm opacity-80" />
                    <span>Nigeria</span>
                  </div>
                </div>

                <Description text={toSentenceCase(channel.description)} />

                <div className="flex items-center gap-3 mt-5">
                  <a href={channel.channel_url} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-2 bg-[#FFD700] hover:bg-[#FFD700]/90 text-black font-bold text-[11px] px-6 py-2.5 rounded-lg transition-all shadow-lg hover:scale-[1.02]">
                    <Icon icon="solar:play-bold" className="text-sm" />
                    Visit Channel <Icon icon="solar:arrow-right-up-linear" className="text-sm" />
                  </a>
                  <button className="flex items-center gap-2 border border-border/50 bg-surface/50 hover:bg-surface text-text-primary font-bold text-[11px] px-6 py-2.5 rounded-lg transition-all">
                    <Icon icon="solar:add-square-linear" className="text-sm" />
                    Follow
                  </button>
                  <button className="flex items-center justify-center border border-border/50 bg-surface/50 hover:bg-surface text-text-primary w-10 h-10 rounded-lg transition-all">
                    <Icon icon="solar:bell-linear" className="text-lg" />
                  </button>
                </div>
              </div>
            </div>

            {/* Right Stats */}
            <div className="flex items-center gap-8 md:gap-12 md:pr-12 pt-4 md:pt-6">
              <div className="flex flex-col items-center">
                <div className="flex items-center gap-1.5 text-[#FFD700] mb-1">
                  <Icon icon="solar:clapperboard-play-bold" className="text-base" />
                  <span className="text-white font-heading font-bold text-lg">{formatViewCount(ytStats?.videoCount || 0)}+</span>
                </div>
                <span className="text-[10px] text-text-muted font-bold uppercase tracking-wider">Uploads</span>
              </div>
              <div className="flex flex-col items-center">
                <div className="flex items-center gap-1.5 text-[#FFD700] mb-1">
                  <Icon icon="solar:users-group-rounded-bold" className="text-base" />
                  <span className="text-white font-heading font-bold text-lg">{formatViewCount(ytStats?.subscriberCount || channel.subscriber_count)}</span>
                </div>
                <span className="text-[10px] text-text-muted font-bold uppercase tracking-wider">Subscribers</span>
              </div>
              <div className="flex flex-col items-center">
                <div className="flex items-center gap-1.5 text-[#FFD700] mb-1">
                  <Icon icon="solar:chart-square-bold" className="text-base" />
                  <span className="text-white font-heading font-bold text-lg">{formatViewCount(ytStats?.viewCount || 0)}+</span>
                </div>
                <span className="text-[10px] text-text-muted font-bold uppercase tracking-wider">Total Views</span>
              </div>
              <div className="flex flex-col items-center">
                <div className="flex items-center gap-1.5 text-[#FFD700] mb-1">
                  <Icon icon="solar:calendar-bold" className="text-base" />
                  <span className="text-white font-heading font-bold text-lg">
                    {ytStats?.joined ? new Date(ytStats.joined).getFullYear() : '2018'}
                  </span>
                </div>
                <span className="text-[10px] text-text-muted font-bold uppercase tracking-wider">Joined</span>
              </div>
            </div>

          </div>
        </div>
      </div>

      {/* MAIN CONTENT */}
      <div className="max-w-[1400px] mx-auto px-4 sm:px-8 py-10">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-12">
          
          {/* Left Column - Video Rails */}
          <div className="space-y-12 overflow-hidden">
            
            {/* Featured */}
            {featuredVideos.length > 0 && (
              <section>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-[#FFD700] text-sm font-bold font-heading flex items-center gap-2">
                    Featured on the Channel
                    <Icon icon="solar:alt-arrow-right-linear" />
                  </h2>
                </div>
                <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide -mx-4 px-4 sm:mx-0 sm:px-0">
                  {featuredVideos.map(video => (
                    <VideoCard key={video.videoId} video={video} variant="featured" />
                  ))}
                  <div className="shrink-0 w-12 flex items-center justify-center">
                    <button className="w-8 h-8 rounded-full bg-surface-2 border border-border flex items-center justify-center hover:border-brand transition-colors text-text-muted">
                      <Icon icon="solar:alt-arrow-right-linear" />
                    </button>
                  </div>
                </div>
              </section>
            )}

            {/* Popular */}
            {popularVideos.length > 0 && (
              <section>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-[#FFD700] text-sm font-bold font-heading flex items-center gap-2">
                    Popular Uploads
                    <Icon icon="solar:alt-arrow-right-linear" />
                  </h2>
                </div>
                <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide -mx-4 px-4 sm:mx-0 sm:px-0">
                  {popularVideos.map(video => (
                    <VideoCard key={video.videoId} video={video} />
                  ))}
                  <div className="shrink-0 w-12 flex items-center justify-center">
                    <button className="w-8 h-8 rounded-full bg-surface-2 border border-border flex items-center justify-center hover:border-brand transition-colors text-text-muted">
                      <Icon icon="solar:alt-arrow-right-linear" />
                    </button>
                  </div>
                </div>
              </section>
            )}

            {/* Latest */}
            {latestVideos.length > 0 && (
              <section>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-[#FFD700] text-sm font-bold font-heading flex items-center gap-2">
                    Latest Uploads
                    <Icon icon="solar:alt-arrow-right-linear" />
                  </h2>
                </div>
                <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide -mx-4 px-4 sm:mx-0 sm:px-0">
                  {latestVideos.map(video => (
                    <VideoCard key={video.videoId} video={video} />
                  ))}
                  <div className="shrink-0 w-12 flex items-center justify-center">
                    <button className="w-8 h-8 rounded-full bg-surface-2 border border-border flex items-center justify-center hover:border-brand transition-colors text-text-muted">
                      <Icon icon="solar:alt-arrow-right-linear" />
                    </button>
                  </div>
                </div>
              </section>
            )}

          </div>

          {/* Right Sidebar */}
          <div className="space-y-6">
            
            {/* Genres */}
            <div className="bg-surface-2/20 border border-border/50 rounded-xl p-5">
              <h3 className="text-text-primary text-sm font-bold mb-4 font-heading">Genres on this Channel</h3>
              <div className="flex flex-wrap gap-2 mb-4">
                {['Drama', 'Thriller', 'Romance', 'Comedy', 'Action', 'Family'].map(genre => (
                  <span key={genre} className="text-[10px] font-bold text-text-muted border border-border/50 rounded-md px-3 py-1.5 flex items-center gap-1.5 bg-surface/30">
                    <Icon icon="solar:clapperboard-play-linear" className="opacity-50" />
                    {genre}
                  </span>
                ))}
              </div>
              <button className="text-[10px] font-bold text-text-muted hover:text-white transition-colors flex items-center gap-1">
                View all genres (12) <Icon icon="solar:alt-arrow-right-linear" />
              </button>
            </div>

            {/* Languages */}
            <div className="bg-surface-2/20 border border-border/50 rounded-xl p-5">
              <h3 className="text-text-primary text-sm font-bold mb-4 font-heading">Languages</h3>
              <div className="flex flex-wrap gap-2 mb-4">
                {['English', 'Yoruba', 'Igbo', 'Pidgin'].map(lang => (
                  <span key={lang} className="text-[10px] font-bold text-text-muted border border-border/50 rounded-md px-3 py-1.5 bg-surface/30">
                    {lang}
                  </span>
                ))}
              </div>
              <button className="text-[10px] font-bold text-text-muted hover:text-white transition-colors flex items-center gap-1">
                View all languages (4) <Icon icon="solar:alt-arrow-right-linear" />
              </button>
            </div>

            {/* Related Channels */}
            {relatedChannels.length > 0 && (
              <div className="bg-surface-2/20 border border-border/50 rounded-xl p-5">
                <h3 className="text-text-primary text-sm font-bold mb-4 font-heading">Related Channels</h3>
                <div className="space-y-4 mb-4">
                  {relatedChannels.map(rc => (
                    <div key={rc.id} className="flex items-center justify-between group">
                      <Link to={`/channels/${rc.id}`} className="flex items-center gap-3 flex-1 overflow-hidden">
                        <ImageWithFallback src={rc.thumbnail_url} alt={rc.name} fallbackType="avatar" name={rc.name} className="w-8 h-8 rounded-full border border-border/50 shrink-0" />
                        <div className="overflow-hidden">
                          <h4 className="text-white text-[11px] font-bold group-hover:text-brand transition-colors line-clamp-1">{rc.name}</h4>
                          <div className="flex items-center gap-1.5 text-[9px] text-text-muted">
                            <span className="truncate">{rc.channel_handle || `@${rc.name.replace(/\s+/g,'').toLowerCase()}`}</span>
                            <span>•</span>
                            <span className="shrink-0">{formatViewCount(rc.subscriber_count)} subscribers</span>
                          </div>
                        </div>
                      </Link>
                      <button className="text-[9px] font-bold border border-border/50 px-3 py-1.5 rounded text-text-muted hover:text-white hover:bg-surface transition-all shrink-0 ml-2">
                        Follow
                      </button>
                    </div>
                  ))}
                </div>
                <button className="text-[10px] font-bold text-text-muted hover:text-white transition-colors flex items-center gap-1">
                  View more channels <Icon icon="solar:alt-arrow-right-linear" />
                </button>
              </div>
            )}

            {/* People & Partners */}
            {owner && (
              <div className="bg-surface-2/20 border border-border/50 rounded-xl p-5">
                <h3 className="text-text-primary text-sm font-bold mb-4 font-heading">People & Production Partners</h3>
                <div className="flex flex-wrap gap-x-6 gap-y-4 mb-4">
                  
                  <Link to={`/people/${owner.slug || owner.id}`} className="flex items-center gap-3 group">
                    <ImageWithFallback src={owner.photo_url} alt={owner.name} fallbackType="avatar" name={owner.name} className="w-10 h-10 rounded-full border border-border/50 object-cover" />
                    <div>
                      <h4 className="text-white text-[11px] font-bold group-hover:text-brand transition-colors">{owner.name}</h4>
                      <p className="text-[9px] text-[#FFD700]">{owner.known_for_department || 'Producer'}</p>
                    </div>
                  </Link>
                  
                  {/* Mock partners to fill space */}
                  <div className="flex items-center gap-3 group cursor-pointer">
                    <img src="https://images.unsplash.com/photo-1531123897727-8f129e1bf98c?w=100&h=100&fit=crop" alt="Partner" className="w-10 h-10 rounded-full border border-border/50 object-cover" />
                    <div>
                      <h4 className="text-white text-[11px] font-bold group-hover:text-brand transition-colors">Bimbo Ademoye</h4>
                      <p className="text-[9px] text-text-muted">Actress</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 group cursor-pointer">
                    <img src="https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=100&h=100&fit=crop" alt="Partner" className="w-10 h-10 rounded-full border border-border/50 object-cover" />
                    <div>
                      <h4 className="text-white text-[11px] font-bold group-hover:text-brand transition-colors">Kunle Remi</h4>
                      <p className="text-[9px] text-text-muted">Actor</p>
                    </div>
                  </div>

                </div>
                <button className="text-[10px] font-bold text-text-muted hover:text-white transition-colors flex items-center gap-1">
                  View all (28) <Icon icon="solar:alt-arrow-right-linear" />
                </button>
              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  );
}
