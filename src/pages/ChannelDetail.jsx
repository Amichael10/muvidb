import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { formatViewCount, parseDuration } from '../utils/youtube';
import { Skeleton } from '../components/ui/Skeleton';
import { Icon } from '@iconify/react';

const CATEGORY_LABELS = {
  skit_maker: 'Skit Makers', movie_channel: 'Movie Channel',
  Movies: 'Movies', Comedy: 'Comedy', Series: 'Series',
  Faith: 'Faith', Yoruba: 'Yoruba', Celebrity: 'Celebrity',
  Network: 'Network', Music: 'Music', Studio: 'Studio', actor: 'Actor',
};

function FlagModal({ channelId, onClose }) {
  const { user } = useAuth();
  const [reason, setReason] = useState('');
  const [details, setDetails] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const REASONS = [
    'Inappropriate content',
    'Spam or misleading',
    'Channel no longer exists',
    'Duplicate entry',
    'Wrong category',
    'Other',
  ];

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!reason) return;
    setSubmitting(true);
    const { error } = await supabase.from('channel_flags').insert({
      channel_id: channelId,
      user_id: user?.id || null,
      reason,
      details: details.trim() || null,
    });
    setSubmitting(false);
    if (!error) setDone(true);
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-bg/95 backdrop-blur-md px-4" onClick={onClose}>
      <div className="bg-surface border border-border rounded-xl p-8 w-full max-w-md relative overflow-hidden shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="absolute inset-0 grid-bg opacity-10 pointer-events-none"></div>
        {done ? (
          <div className="relative z-10 text-center py-6">
            <Icon icon="solar:check-circle-bold" className="text-5xl text-green-500 mx-auto mb-4" />
            <h3 className="text-text-primary font-heading font-bold text-xl mb-3">Report submitted</h3>
            <p className="text-text-muted text-xs font-bold mb-8">Our security team will review this report shortly.</p>
            <button onClick={onClose} className="w-full bg-brand text-white font-bold py-4 rounded-lg text-xs">
              Close
            </button>
          </div>
        ) : (
          <div className="relative z-10">
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-text-primary font-heading font-bold text-xl">Flag this channel</h3>
              <button onClick={onClose} className="text-text-muted hover:text-text-primary transition-colors">✕</button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-4">
                <label className="text-text-muted text-xs font-bold block pl-1">Select Reason</label>
                <div className="space-y-3">
                  {REASONS.map(r => (
                    <label key={r} className="flex items-center gap-3 cursor-pointer group">
                      <div className={`w-4 h-4 rounded-full border-2 transition-all ${reason === r ? 'border-brand bg-brand shadow-[0_0_8px_var(--brand)]' : 'border-border group-hover:border-brand/50'}`} />
                      <input type="radio" name="reason" value={r} onChange={() => setReason(r)} className="sr-only" />
                      <span className={`text-xs font-bold transition-colors ${reason === r ? 'text-brand' : 'text-text-primary'}`}>{r}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-text-muted text-xs font-bold block pl-1">Additional Details</label>
                <textarea
                  value={details}
                  onChange={e => setDetails(e.target.value)}
                  rows={3}
                  placeholder="Provide context..."
                  className="w-full bg-surface-2 border border-border rounded-lg px-4 py-3 text-xs font-bold text-text-primary placeholder-text-muted/30 focus:outline-none focus:border-brand resize-none transition-all"
                />
              </div>
              <div className="flex gap-3 pt-4">
                <button type="submit" disabled={!reason || submitting}
                  className="w-full bg-red-500 hover:bg-red-600 disabled:opacity-40 text-white font-bold py-4 rounded-lg text-xs transition-all shadow-lg shadow-red-500/20">
                  {submitting ? 'Processing...' : 'Submit Report'}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}

function VideoCard({ video }) {
  const duration = video.duration_seconds ? parseDuration(`PT${Math.floor(video.duration_seconds / 60)}M${video.duration_seconds % 60}S`) : null;
  const youtubeUrl = `https://www.youtube.com/watch?v=${video.video_id}`;

  return (
    <a href={youtubeUrl} target="_blank" rel="noopener noreferrer"
      className="group block bg-surface rounded-lg overflow-hidden border border-border hover:border-brand transition-all duration-500 shadow-sm">
      <div className="relative aspect-video bg-surface-2/10 overflow-hidden">
        {video.thumbnail_url ? (
          <img src={video.thumbnail_url} alt={video.title}
            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <svg className="w-10 h-10 text-brand/20" fill="currentColor" viewBox="0 0 24 24">
              <path d="M19.615 3.184c-3.604-.246-11.631-.245-15.23 0-3.897.266-4.356 2.62-4.385 8.816.029 6.185.484 8.549 4.385 8.816 3.6.245 11.626.246 15.23 0 3.897-.266 4.356-2.62 4.385-8.816-.029-6.185-.484-8.549-4.385-8.816zm-10.615 12.816v-8l8 3.993-8 4.007z"/>
            </svg>
          </div>
        )}
        {duration && (
          <span className="absolute bottom-2 right-2 bg-black/80 backdrop-blur-md text-white text-[9px] font-black px-2 py-0.5 rounded border border-white/10 uppercase tracking-widest">
            {duration.formatted}
          </span>
        )}
        {video.film_id && (
          <span className="absolute top-2 left-2 bg-brand text-white text-[8px] font-black px-2 py-0.5 rounded border border-brand/20 uppercase tracking-widest shadow-lg">
            FILM
          </span>
        )}
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-500 bg-black/20 backdrop-blur-[2px]">
          <div className="w-12 h-12 bg-brand text-white rounded-full flex items-center justify-center shadow-2xl scale-75 group-hover:scale-100 transition-transform">
            <svg className="w-5 h-5 ml-0.5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z"/>
            </svg>
          </div>
        </div>
      </div>
      <div className="p-4">
        <p className="text-text-primary text-[11px] font-bold uppercase tracking-tight line-clamp-2 leading-tight group-hover:text-brand transition-colors">
          {video.title}
        </p>
        {video.published_at && (
          <p className="text-[9px] text-text-muted mt-2 font-bold uppercase tracking-widest opacity-60">
            {new Date(video.published_at).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' })}
          </p>
        )}
      </div>
    </a>
  );
}

const ChannelDetailSkeleton = () => (
    <div className="min-h-screen bg-bg">
        <div className="relative h-52 md:h-72 bg-surface-2/10 border-b border-border overflow-hidden">
            <div className="absolute inset-0 bg-surface-2 animate-shimmer opacity-20" />
        </div>
        <div className="max-w-7xl mx-auto border-x border-border -mt-12 px-4 sm:px-6 lg:px-8 pb-12 relative z-10">
            <div className="flex flex-col md:flex-row gap-8 items-end md:items-start">
                <div className="w-32 h-32 md:w-40 md:h-40 rounded-xl border-4 border-bg bg-surface-2 animate-shimmer shrink-0" />
                <div className="flex-1 pt-4 md:pt-16 space-y-4 w-full">
                    <div className="h-10 w-1/3 bg-surface-2 rounded-lg animate-shimmer" />
                    <div className="h-4 w-1/4 bg-surface-2 rounded-md animate-shimmer" />
                </div>
            </div>
        </div>
        <div className="max-w-7xl mx-auto border-x border-border border-t border-border">
            <div className="grid grid-cols-1 lg:grid-cols-4 divide-y lg:divide-y-0 lg:divide-x divide-border">
                <div className="lg:col-span-3 p-8 md:p-12 space-y-8">
                    <div className="h-8 w-48 bg-surface-2 rounded-md animate-shimmer" />
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-6">
                        {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
                            <div key={i} className="space-y-3">
                                <div className="aspect-video bg-surface-2 rounded-lg border border-border animate-shimmer" />
                                <div className="h-3 w-full bg-surface-2 rounded animate-shimmer" />
                                <div className="h-2 w-1/2 bg-surface-2 rounded animate-shimmer opacity-60" />
                            </div>
                        ))}
                    </div>
                </div>
                <div className="lg:col-span-1 p-8 space-y-8">
                    <div className="space-y-4">
                        <div className="h-4 w-24 bg-surface-2 rounded animate-shimmer" />
                        <div className="h-48 w-full bg-surface-2 rounded-xl border border-border animate-shimmer" />
                    </div>
                    <div className="space-y-4">
                        <div className="h-4 w-32 bg-surface-2 rounded animate-shimmer" />
                        <div className="h-12 w-full bg-surface-2 rounded-lg border border-border animate-shimmer" />
                        <div className="h-12 w-full bg-surface-2 rounded-lg border border-border animate-shimmer" />
                    </div>
                </div>
            </div>
        </div>
    </div>
)

const Description = ({ text }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const isLong = text.length > 280;
  const displayText = isExpanded ? text : text.slice(0, 280) + (isLong ? '...' : '');

  return (
    <div className="space-y-4">
      <p className="text-text-muted text-sm leading-relaxed max-w-3xl italic opacity-80 border-l-2 border-border pl-6">
        {displayText}
      </p>
      {isLong && (
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="text-brand text-xs font-bold hover:underline ml-7 transition-all"
        >
          {isExpanded ? 'Read Less ↑' : 'Read Full Description ↓'}
        </button>
      )}
    </div>
  );
};

export default function ChannelDetail() {

  const { id } = useParams();
  const navigate = useNavigate();
  const [channel, setChannel] = useState(null);
  const [videos, setVideos] = useState([]);
  const [owner, setOwner] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showFlag, setShowFlag] = useState(false);
  
  const [search, setSearch] = useState('');
  const [onlyMovies, setOnlyMovies] = useState(false);

  useEffect(() => {
    fetchChannel();
  }, [id]);

  const fetchChannel = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: ch, error: chErr } = await supabase
        .from('channels')
        .select('*')
        .eq('id', id)
        .single();
      
      if (chErr || !ch) throw new Error('Channel not found');
      setChannel(ch);
      document.title = `Lumi | ${ch.name}`;

      if (ch.owner_person_id) {
        const { data: p } = await supabase
          .from('people')
          .select('id, name, photo_url, known_for_department')
          .eq('id', ch.owner_person_id)
          .single();
        setOwner(p);
      }

      const { data: vids } = await supabase
        .from('channel_videos')
        .select('id, video_id, title, thumbnail_url, published_at, duration_seconds, film_id, match_status')
        .eq('channel_id', id)
        .order('published_at', { ascending: false });
      setVideos(vids || []);

    } catch (err) {
      setError(err.message === 'Channel not found' ? 'Channel not found' : 'Failed to load channel');
    } finally {
      setLoading(false);
    }
  };

  const filteredVideos = videos.filter(v => {
    if (search.trim() && !v.title.toLowerCase().includes(search.toLowerCase())) return false;
    if (onlyMovies && v.duration_seconds && v.duration_seconds < 60) return false;
    return true;
  });

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
    <div className="min-h-screen bg-bg">
      {showFlag && <FlagModal channelId={id} onClose={() => setShowFlag(false)} />}
      
      <div className="relative border-b border-border bg-surface-2/10 overflow-hidden">
        <div className="absolute inset-0 grid-bg opacity-20 pointer-events-none"></div>
        <div className="relative h-52 md:h-72 overflow-hidden border-b border-border">
          {channel.banner_url ? (
            <img src={channel.banner_url} alt="" className="w-full h-full object-cover opacity-60" />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-brand/20 via-transparent to-bg" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-bg via-bg/20 to-transparent" />
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 border-x border-white/5 h-full relative">
            <button onClick={() => navigate('/channels')}
              className="absolute top-24 left-4 md:left-8 flex items-center gap-2 text-text-primary text-xs font-bold bg-bg/60 hover:bg-brand hover:text-white backdrop-blur-sm px-4 py-2 rounded-lg border border-white/10 transition-all z-20">
              Back to Channels
            </button>
          </div>
        </div>

        <div className="max-w-7xl mx-auto border-x border-border relative z-10 px-4 sm:px-6 lg:px-8 -mt-12 pb-12">
          <div className="flex flex-col md:flex-row gap-8 items-end md:items-start">
            <div className="flex-shrink-0 relative">
              <div className="absolute -inset-1 bg-brand/20 blur-xl rounded-full"></div>
              {channel.thumbnail_url ? (
                <img src={channel.thumbnail_url} alt={channel.name}
                  className="relative w-32 h-32 md:w-40 md:h-40 rounded-xl border-4 border-bg object-cover shadow-2xl" />
              ) : (
                <div className="relative w-32 h-32 md:w-40 md:h-40 rounded-xl border-4 border-bg bg-surface flex items-center justify-center shadow-2xl">
                  <span className="text-brand font-bold text-5xl font-heading">{channel.name?.charAt(0)}</span>
                </div>
              )}
            </div>

            <div className="flex-1 pt-4 md:pt-16">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                <div>
                  <div className="flex items-center gap-3 flex-wrap mb-2">
                    <h1 className="text-3xl md:text-5xl font-heading font-bold text-text-primary tracking-tighter">{channel.name}</h1>
                    {channel.is_featured && (
                      <span className="text-[10px] font-bold text-brand bg-brand/10 px-3 py-1 rounded-lg border border-brand/20">
                        Featured Channel
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-4 flex-wrap">
                    {channel.channel_handle && (
                      <span className="text-text-muted text-xs font-bold uppercase tracking-widest">{channel.channel_handle}</span>
                    )}
                    <span className="w-1 h-1 rounded-full bg-border"></span>
                    {channel.category && (
                      <span className="text-[10px] font-black uppercase tracking-widest text-text-primary bg-surface-2 px-3 py-1 rounded-md border border-border">
                        {CATEGORY_LABELS[channel.category] || channel.category}
                      </span>
                    )}
                  </div>
                  {channel.subscriber_count > 0 && (
                    <p className="text-brand font-bold text-xl mt-4 font-heading">
                      {formatViewCount(channel.subscriber_count)}
                      <span className="text-text-muted font-bold text-xs ml-2">Subscribers</span>
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-4 flex-wrap">
                  <a href={channel.channel_url} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-2 bg-[#FF0000] hover:bg-[#FF0000]/90 text-white font-bold text-xs px-8 py-4 rounded-lg transition-all shadow-xl hover:scale-[1.02]">
                    Subscribe
                  </a>
                  <button onClick={() => setShowFlag(true)}
                    className="flex items-center gap-2 border border-border bg-surface text-text-muted hover:text-red-400 hover:border-red-400/50 font-bold text-xs px-6 py-4 rounded-lg transition-all">
                    Report
                  </button>
                </div>
              </div>

              {channel.description && (
                <Description text={channel.description} />
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto border-x border-border">
        <div className="grid grid-cols-1 lg:grid-cols-4 divide-y lg:divide-y-0 lg:divide-x divide-border">
          <div className="lg:col-span-3">
            <div className="p-8 md:p-12 border-b border-border bg-surface-2/5 relative overflow-hidden">
               <div className="absolute inset-0 grid-bg opacity-10 pointer-events-none"></div>
               <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
                  <h2 className="text-text-primary font-bold text-2xl font-heading tracking-tighter">
                    Media Library
                    <span className="ml-4 text-xs font-bold text-text-muted bg-surface px-3 py-1 rounded-full border border-border">
                      {filteredVideos.length} items
                    </span>
                  </h2>
                  <div className="flex items-center gap-4 flex-wrap">
                    <div className="relative">
                      <input
                        type="text"
                        placeholder="Search videos..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        className="bg-surface border border-border text-text-primary rounded-lg px-6 py-2 pl-12 text-xs font-bold focus:border-brand focus:outline-none w-full md:w-64 transition-all"
                      />
                      <Icon icon="solar:magnifer-linear" className="absolute left-4 top-1/2 -translate-y-1/2 opacity-30 text-text-primary" width="20" />
                    </div>
                    <button
                      onClick={() => setOnlyMovies(!onlyMovies)}
                      className={`text-xs font-bold px-6 py-2.5 rounded-lg border transition-all flex items-center gap-3 ${
                        onlyMovies 
                          ? 'bg-brand text-white border-brand shadow-lg shadow-brand/20' 
                          : 'bg-surface border-border text-text-muted hover:text-text-primary'
                      }`}
                    >
                      <div className={`w-1.5 h-1.5 rounded-full ${onlyMovies ? 'bg-white animate-pulse' : 'bg-text-muted'}`} />
                      Movies Only
                    </button>
                  </div>
               </div>
            </div>

            <div className="p-8 md:p-12 min-h-[400px]">
              {filteredVideos.length === 0 ? (
                <div className="text-center py-24 bg-surface-2/10 rounded-xl border-2 border-dashed border-border">
                  <Icon icon="solar:clapperboard-play-linear" className="text-4xl mx-auto mb-4 opacity-20 text-brand" />
                  <p className="text-text-muted font-bold text-xs">No media matching your library filters</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-6">
                  {filteredVideos.map((video) => (
                    <VideoCard key={video.video_id} video={video} />
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="lg:col-span-1 divide-y divide-border">
            {owner && (
              <div className="p-8">
                <h3 className="text-text-muted text-xs font-bold mb-6">Owner</h3>
                <Link to={`/people/${owner.id}`} className="group flex flex-col items-center text-center p-6 bg-surface-2/20 rounded-xl border border-border hover:border-brand transition-all duration-300">
                  {owner.photo_url ? (
                    <img src={owner.photo_url} alt={owner.name}
                      className="w-20 h-20 rounded-xl object-cover border border-border mb-4 group-hover:scale-105 transition-transform" />
                  ) : (
                    <div className="w-20 h-20 rounded-xl bg-surface flex items-center justify-center border border-border mb-4">
                      <span className="text-brand font-bold text-2xl font-heading">{owner.name?.charAt(0)}</span>
                    </div>
                  )}
                  <p className="text-text-primary font-bold uppercase tracking-tight group-hover:text-brand transition-colors">{owner.name}</p>
                  {owner.known_for_department && (
                    <p className="text-text-muted text-xs font-bold mt-1">{owner.known_for_department}</p>
                  )}
                  <div className="mt-6 w-full border-t border-border pt-4 text-[10px] font-bold text-brand transition-all">
                    View Profile →
                  </div>
                </Link>
              </div>
            )}

            <div className="p-8">
               <h3 className="text-text-muted text-xs font-bold mb-6">External Links</h3>
               <div className="space-y-3">
                  {channel.channel_url && (
                    <a href={channel.channel_url} target="_blank" rel="noopener noreferrer"
                      className="flex items-center justify-between p-4 bg-surface rounded-lg border border-border hover:border-brand group transition-all">
                      <span className="text-xs font-bold text-text-primary group-hover:text-brand">YouTube</span>
                      <span className="text-text-muted group-hover:translate-x-1 transition-transform">↗</span>
                    </a>
                  )}
                  {channel.channel_url && (
                    <a href={`${channel.channel_url}/videos`} target="_blank" rel="noopener noreferrer"
                      className="flex items-center justify-between p-4 bg-surface rounded-lg border border-border hover:border-brand group transition-all">
                      <span className="text-xs font-bold text-text-primary group-hover:text-brand">Full Library</span>
                      <span className="text-text-muted group-hover:translate-x-1 transition-transform">↗</span>
                    </a>
                  )}
               </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
