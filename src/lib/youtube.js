const YOUTUBE_API_KEY = import.meta.env.VITE_YOUTUBE_API_KEY;
const BASE_URL = 'https://www.googleapis.com/youtube/v3';

/**
 * Extracts Video ID from various YouTube URL formats
 */
export const extractYoutubeId = (url) => {
  if (!url) return null;
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
  const match = url.match(regExp);
  return (match && match[2].length === 11) ? match[2] : null;
};

/**
 * Extracts Channel ID or Handle from a YouTube URL
 */
export const extractChannelIdentifier = (url) => {
  if (!url) return null;
  // Handle /channel/UC...
  const channelMatch = url.match(/\/channel\/(UC[\w-]+)/);
  if (channelMatch) return { type: 'id', value: channelMatch[1] };
  
  // Handle /@handle or /c/handle or /user/handle
  const handleMatch = url.match(/\/(?:@|c\/|user\/)([\w-]+)/);
  if (handleMatch) return { type: 'handle', value: handleMatch[1] };

  // Just return the value if it's already an ID or Handle
  if (url.startsWith('UC')) return { type: 'id', value: url };
  if (url.startsWith('@')) return { type: 'handle', value: url.substring(1) };
  
  return { type: 'handle', value: url };
};

/**
 * Fetches subscriber count, video count, thumbnail, and banner for a channel
 */
export const fetchChannelData = async (identifier) => {
  if (!YOUTUBE_API_KEY || YOUTUBE_API_KEY === 'your_youtube_api_key') {
    throw new Error('YouTube API Key not configured');
  }

  try {
    let channelId = identifier.value;

    // If it's a handle, we first need to search for the channel ID
    if (identifier.type === 'handle') {
      const searchUrl = `${BASE_URL}/search?part=snippet&type=channel&q=${identifier.value}&key=${YOUTUBE_API_KEY}`;
      const searchRes = await fetch(searchUrl);
      const searchData = await searchRes.json();
      
      if (!searchData.items || searchData.items.length === 0) {
        throw new Error('Channel not found');
      }
      channelId = searchData.items[0].id.channelId;
    }

    // Now fetch full stats and branding
    const detailUrl = `${BASE_URL}/channels?part=snippet,statistics,brandingSettings&id=${channelId}&key=${YOUTUBE_API_KEY}`;
    const detailRes = await fetch(detailUrl);
    const detailData = await detailRes.json();

    if (!detailData.items || detailData.items.length === 0) {
      throw new Error('Channel details not found');
    }

    const channel = detailData.items[0];
    return {
      channelId: channel.id,
      handle: channel.snippet.customUrl,
      title: channel.snippet.title,
      thumbnail: channel.snippet.thumbnails.high?.url || channel.snippet.thumbnails.default?.url,
      banner: channel.brandingSettings.image?.bannerExternalUrl,
      subscribers: channel.statistics.subscriberCount,
      videos: channel.statistics.videoCount,
      lastUpdated: new Date().toISOString()
    };
  } catch (err) {
    console.error('YouTube API Error:', err);
    throw err;
  }
};
