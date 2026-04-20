import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { formatViewCount, parseDuration } from '../utils/youtube';

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4" onClick={onClose}>
      <div className="bg-[#13192B] border border-[#252D45] rounded-2xl p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
        {done ? (
          <div className="text-center py-4">
            <p className="text-4xl mb-3">✅</p>
            <h3 className="text-[#F5F0E8] font-bold text-lg mb-2">Report submitted</h3>
            <p className="text-[#7A8099] text-sm mb-4">Our team will review this channel.</p>
            <button onClick={onClose} className="bg-[#D4A017] text-black font-bold px-6 py-2 rounded-xl text-sm">
              Close
            </button>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-[#F5F0E8] font-bold text-lg">Flag this channel</h3>
              <button onClick={onClose} className="text-[#7A8099] hover:text-[#F5F0E8] text-xl">✕</button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-[#7A8099] text-xs font-bold uppercase tracking-wider block mb-2">Reason *</label>
                <div className="space-y-2">
                  {REASONS.map(r => (
                    <label key={r} className="flex items-center gap-3 cursor-pointer group">
                      <div className={`w-4 h-4 rounded-full border-2 flex-shrink-0 ${reason === r ? 'border-[#D4A017] bg-[#D4A017]' : 'border-[#252D45] group-hover:border-[#D4A017]/50'}`} />
                      <input type="radio" name="reason" value={r} onChange={() => setReason(r)} className="sr-only" />
                      <span className="text-sm text-[#F5F0E8]">{r}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-[#7A8099] text-xs font-bold uppercase tracking-wider block mb-2">Additional details (optional)</label>
                <textarea
                  value={details}
                  onChange={e => setDetails(e.target.value)}
                  rows={3}
                  placeholder="Tell us more…"
                  className="w-full bg-[#0A0F1E] border border-[#252D45] rounded-xl px-3 py-2 text-[#F5F0E8] text-sm placeholder-[#7A8099] focus:outline-none focus:border-[#D4A017] resize-none"
                />
              </div>
              <div className="flex gap-3 pt-1">
                <button type="button" onClick={onClose}
                  className="flex-1 border border-[#252D45] text-[#7A8099] hover:text-[#F5F0E8] rounded-xl py-2.5 text-sm font-medium transition-colors">
                  Cancel
                </button>
                <button type="submit" disabled={!reason || submitting}
                  className="flex-1 bg-red-600/80 hover:bg-red-600 disabled:opacity-40 text-white font-bold rounded-xl py-2.5 text-sm transition-colors">
                  {submitting ? 'Submitting…' : 'Submit Report'}
                </button>
              </div>
            </form>
          </>
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
      className="group block bg-[#13192B] rounded-xl overflow-hidden border border-[#252D45] hover:border-[#D4A017]/40 transition-all duration-200">
      <div className="relative aspect-video bg-[#0A0F1E] overflow-hidden">
        {video.thumbnail_url ? (
          <img src={video.thumbnail_url} alt={video.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <svg className="w-12 h-12 text-[#D4A017]/30" fill="currentColor" viewBox="0 0 24 24">
              <path d="M19.615 3.184c-3.604-.246-11.631-.245-15.23 0-3.897.266-4.356 2.62-4.385 8.816.029 6.185.484 8.549 4.385 8.816 3.6.245 11.626.246 15.23 0 3.897-.266 4.356-2.62 4.385-8.816-.029-6.185-.484-8.549-4.385-8.816zm-10.615 12.816v-8l8 3.993-8 4.007z"/>
            </svg>
          </div>
        )}
        {duration && (
          <span className="absolute bottom-1.5 right-1.5 bg-black/80 text-white text-[10px] font-mono px-1.5 py-0.5 rounded">
            {duration.formatted}
          </span>
        )}
        {video.film_id && (
          <span className="absolute top-1.5 left-1.5 bg-[#D4A017] text-black text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-wide">
            Film
          </span>
        )}
        {/* Play overlay */}
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/30">
          <div className="w-12 h-12 bg-[#D4A017] rounded-full flex items-center justify-center shadow-lg">
            <svg className="w-5 h-5 text-black ml-0.5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z"/>
            </svg>
          </div>
        </div>
      </div>
      <div className="p-3">
        <p className="text-[#F5F0E8] text-xs font-medium line-clamp-2 leading-snug group-hover:text-[#D4A017] transition-colors">
          {video.title}
        </p>
        {video.published_at && (
          <p className="text-[#7A8099] text-[10px] mt-1">
            {new Date(video.published_at).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' })}
          </p>
        )}
      </div>
    </a>
  );
}

export default function ChannelDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showFlag, setShowFlag] = useState(false);
  const [liveVideos, setLiveVideos] = useState([]);
  const [videosLoading, setVideosLoading] = useState(false);

  useEffect(() => {
    fetchChannel();
  }, [id]);

  const fetchChannel = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/channel/${id}`);
      if (res.status === 404) { setError('Channel not found'); setLoading(false); return; }
      if (!res.ok) throw new Error(`${res.status}`);
      const json = await res.json();
      setData(json);
      document.title = `Lumi | ${json.channel?.name || 'Channel'}`;

      // If we have a channel_handle, try fetching live videos from YouTube API
      if (json.channel?.channel_handle || json.channel?.channel_url) {
        fetchLiveVideos(json.channel);
      }
    } catch (err) {
      setError('Failed to load channel');
    } finally {
      setLoading(false);
    }
  };

  const fetchLiveVideos = async (channel) => {
    setVideosLoading(true);
    try {
      // Extract handle from channel_handle or channel_url
      const handle = channel.channel_handle?.replace('@', '') ||
        channel.channel_url?.match(/\/@([\w-]+)/)?.[1];
      if (!handle) return;

      // Search for channel ID by handle
      const searchRes = await fetch(
        `/api/youtube?endpoint=channels&part=id,statistics,contentDetails&forHandle=@${encodeURIComponent(handle)}`
      );
      const searchData = await searchRes.json();
      if (!searchData.items?.length) return;

      const ytChannel = searchData.items[0];
      const uploadsId = ytChannel.contentDetails?.relatedPlaylists?.uploads;
      if (!uploadsId) return;

      const playlistRes = await fetch(
        `/api/youtube?endpoint=playlistItems&part=snippet&playlistId=${uploadsId}&maxResults=24`
      );
      const playlistData = await playlistRes.json();
      if (!playlistData.items?.length) return;

      const videoIds = playlistData.items.map(i => i.snippet.resourceId.videoId).join(',');
      const detailRes = await fetch(
        `/api/youtube?endpoint=videos&part=snippet,contentDetails,statistics&id=${videoIds}`
      );
      const detailData = await detailRes.json();

      setLiveVideos(
        (detailData.items || []).map(v => ({
          video_id: v.id,
          title: v.snippet?.title,
          thumbnail_url: v.snippet?.thumbnails?.medium?.url || v.snippet?.thumbnails?.default?.url,
          published_at: v.snippet?.publishedAt,
          duration_seconds: (() => {
            const d = parseDuration(v.contentDetails?.duration);
            return d.totalSeconds;
          })(),
          film_id: null,
        }))
      );
    } catch (err) {
      console.error('live videos fetch error:', err);
    } finally {
      setVideosLoading(false);
    }
  };

  if (loading) return (
    <div className="min-h-screen bg-[#0A0F1E] pt-20 animate-pulse">
      <div className="h-52 bg-[#13192B]" />
      <div className="max-w-6xl mx-auto px-4 py-8 space-y-4">
        <div className="h-8 bg-[#13192B] rounded w-64" />
        <div className="h-4 bg-[#13192B] rounded w-96" />
      </div>
    </div>
  );

  if (error || !data) return (
    <div className="min-h-screen bg-[#0A0F1E] pt-20 flex items-center justify-center">
      <div className="text-center">
        <p className="text-5xl mb-4">📺</p>
        <p className="text-[#F5F0E8] text-lg font-bold mb-2">{error || 'Channel not found'}</p>
        <button onClick={() => navigate('/channels')} className="text-[#D4A017] hover:underline text-sm">
          ← Back to Channels
        </button>
      </div>
    </div>
  );

  const { channel, videos: savedVideos, owner } = data;
  const displayVideos = liveVideos.length > 0 ? liveVideos : savedVideos;

  return (
    <div className="min-h-screen bg-[#0A0F1E] pb-20">
      {/* Banner */}
      <div className="relative h-52 md:h-64 bg-[#13192B] overflow-hidden">
        {channel.banner_url ? (
          <img src={channel.banner_url} alt="" className="w-full h-full object-cover opacity-80" />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-[#D4A017]/20 via-[#C1440E]/10 to-[#0A0F1E]" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-[#0A0F1E] via-[#0A0F1E]/20 to-transparent" />

        {/* Back button */}
        <button onClick={() => navigate('/channels')}
          className="absolute top-4 left-4 flex items-center gap-2 text-[#F5F0E8] text-sm bg-black/40 hover:bg-black/60 backdrop-blur-sm px-3 py-1.5 rounded-lg transition-colors mt-16">
          ← Channels
        </button>
      </div>

      {/* Profile section */}
      <div className="max-w-6xl mx-auto px-4">
        <div className="flex flex-col sm:flex-row gap-5 -mt-12 relative z-10">
          {/* Avatar */}
          <div className="flex-shrink-0">
            {channel.thumbnail_url ? (
              <img src={channel.thumbnail_url} alt={channel.name}
                className="w-24 h-24 md:w-28 md:h-28 rounded-full border-4 border-[#0A0F1E] object-cover shadow-2xl" />
            ) : (
              <div className="w-24 h-24 md:w-28 md:h-28 rounded-full border-4 border-[#0A0F1E] bg-[#1C2440] flex items-center justify-center shadow-2xl">
                <span className="text-[#D4A017] font-bold text-4xl">{channel.name?.charAt(0)}</span>
              </div>
            )}
          </div>

          {/* Info */}
          <div className="flex-1 pt-2 sm:pt-6">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
              <div>
                <div className="flex items-center gap-3 flex-wrap">
                  <h1 className="text-[#F5F0E8] font-bold text-2xl md:text-3xl">{channel.name}</h1>
                  {channel.is_featured && (
                    <span className="text-[10px] font-black uppercase tracking-widest text-[#D4A017] bg-[#D4A017]/10 px-2 py-1 rounded-full">
                      Featured
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3 mt-1 flex-wrap">
                  {channel.channel_handle && (
                    <span className="text-[#7A8099] text-sm">{channel.channel_handle}</span>
                  )}
                  {channel.category && (
                    <span className="text-xs font-bold uppercase tracking-wider text-[#7A8099] bg-[#1C2440] px-2 py-0.5 rounded-full">
                      {CATEGORY_LABELS[channel.category] || channel.category}
                    </span>
                  )}
                </div>
                {channel.subscriber_count > 0 && (
                  <p className="text-[#D4A017] font-bold text-lg mt-1">
                    {formatViewCount(channel.subscriber_count)}
                    <span className="text-[#7A8099] font-normal text-sm ml-1">subscribers</span>
                  </p>
                )}
              </div>

              {/* Action buttons */}
              <div className="flex items-center gap-3 flex-wrap">
                {channel.channel_url && (
                  <a href={channel.channel_url} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-2 bg-[#FF0000] hover:bg-[#FF0000]/90 text-white font-bold px-5 py-2.5 rounded-full text-sm transition-colors shadow-lg">
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M19.615 3.184c-3.604-.246-11.631-.245-15.23 0-3.897.266-4.356 2.62-4.385 8.816.029 6.185.484 8.549 4.385 8.816 3.6.245 11.626.246 15.23 0 3.897-.266 4.356-2.62 4.385-8.816-.029-6.185-.484-8.549-4.385-8.816zm-10.615 12.816v-8l8 3.993-8 4.007z"/>
                    </svg>
                    Subscribe
                  </a>
                )}
                <button onClick={() => setShowFlag(true)}
                  className="flex items-center gap-2 border border-[#252D45] hover:border-red-500/50 text-[#7A8099] hover:text-red-400 font-medium px-4 py-2.5 rounded-full text-sm transition-all">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 21V4m0 0l6-1 5 1 5-1v13l-5 1-5-1-6 1V4z" />
                  </svg>
                  Flag Channel
                </button>
              </div>
            </div>

            {/* Description */}
            {channel.description && (
              <p className="text-[#7A8099] text-sm mt-4 leading-relaxed max-w-2xl line-clamp-3">
                {channel.description}
              </p>
            )}
          </div>
        </div>

        {/* Owner person card */}
        {owner && (
          <div className="mt-8 bg-[#13192B] border border-[#252D45] rounded-2xl p-5 flex items-center gap-4">
            <Link to={`/people/${owner.id}`} className="flex items-center gap-4 group flex-1">
              {owner.photo_url ? (
                <img src={owner.photo_url} alt={owner.name}
                  className="w-12 h-12 rounded-full object-cover group-hover:ring-2 group-hover:ring-[#D4A017] transition-all" />
              ) : (
                <div className="w-12 h-12 rounded-full bg-[#1C2440] flex items-center justify-center">
                  <span className="text-[#D4A017] font-bold">{owner.name?.charAt(0)}</span>
                </div>
              )}
              <div>
                <p className="text-[#7A8099] text-xs uppercase tracking-wider font-bold mb-0.5">Channel Owner</p>
                <p className="text-[#F5F0E8] font-bold group-hover:text-[#D4A017] transition-colors">{owner.name}</p>
                {owner.known_for_department && (
                  <p className="text-[#7A8099] text-xs">{owner.known_for_department}</p>
                )}
              </div>
            </Link>
            <Link to={`/people/${owner.id}`}
              className="text-[#D4A017] text-sm font-medium hover:underline shrink-0">
              View Profile →
            </Link>
          </div>
        )}

        {/* Videos section */}
        <div className="mt-10">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-[#F5F0E8] font-bold text-xl">
              Videos
              {videosLoading && (
                <span className="ml-3 text-xs text-[#7A8099] font-normal animate-pulse">Loading latest…</span>
              )}
            </h2>
            {channel.channel_url && (
              <a href={`${channel.channel_url}/videos`} target="_blank" rel="noopener noreferrer"
                className="text-[#D4A017] text-sm hover:underline">
                View all on YouTube →
              </a>
            )}
          </div>

          {displayVideos.length === 0 && !videosLoading ? (
            <div className="text-center py-16 bg-[#13192B] rounded-2xl border border-[#252D45]">
              <p className="text-4xl mb-3">🎬</p>
              <p className="text-[#F5F0E8] font-medium mb-1">No videos found</p>
              <p className="text-[#7A8099] text-sm">Videos will appear once the channel is synced</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
              {(videosLoading && displayVideos.length === 0
                ? Array.from({ length: 12 })
                : displayVideos
              ).map((video, i) =>
                video ? (
                  <VideoCard key={video.video_id || i} video={video} />
                ) : (
                  <div key={i} className="animate-pulse bg-[#13192B] rounded-xl overflow-hidden border border-[#252D45]">
                    <div className="aspect-video bg-[#1C2440]" />
                    <div className="p-3 space-y-1.5">
                      <div className="h-3 bg-[#1C2440] rounded w-full" />
                      <div className="h-2 bg-[#1C2440] rounded w-2/3" />
                    </div>
                  </div>
                )
              )}
            </div>
          )}
        </div>
      </div>

      {showFlag && <FlagModal channelId={id} onClose={() => setShowFlag(false)} />}
    </div>
  );
}
