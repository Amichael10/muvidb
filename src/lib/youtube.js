// YouTube API calls are proxied through /api/youtube so the key
// is never included in the client bundle.

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
/**
 * Public profile / links: open the best URL for a person’s channel.
 * Prefer stable channel ID URL when we have it; otherwise /@handle.
 */
export const getPersonYoutubeChannelUrl = (person) => {
  if (!person) return null;
  if (person.youtube_channel_id) {
    return `https://www.youtube.com/channel/${person.youtube_channel_id}`;
  }
  if (person.youtube_handle) {
    const h = String(person.youtube_handle).replace(/^@/, '');
    return `https://www.youtube.com/@${h}`;
  }
  return null;
};

export const extractChannelIdentifier = (url) => {
  if (!url) return null;
  // Handle /channel/UC...
  const channelMatch = url.match(/\/channel\/(UC[\w-]+)/);
  if (channelMatch) return { type: 'id', value: channelMatch[1] };
  
  // Handle /@handle or /c/handle or /user/handle (handles can contain dots)
  const handleMatch = url.match(/\/(?:@|c\/|user\/)([\w.-]+)/);
  if (handleMatch) return { type: 'handle', value: handleMatch[1] };

  // Just return the value if it's already an ID or Handle
  if (url.startsWith('UC')) return { type: 'id', value: url };
  if (url.startsWith('@')) return { type: 'handle', value: url.substring(1) };
  
  return { type: 'handle', value: url };
};

/**
 * Fetches subscriber count, video count, thumbnail, and banner for a channel.
 * Routes through /api/youtube so the API key stays server-side.
 */
export const fetchChannelData = async (identifier) => {
  try {
    let url;
    if (identifier.type === 'id') {
      url = `/api/youtube?endpoint=channels&part=snippet,statistics,brandingSettings&id=${encodeURIComponent(identifier.value)}`;
    } else {
      url = `/api/youtube?endpoint=channels&part=snippet,statistics,brandingSettings&forHandle=${encodeURIComponent(identifier.value)}`;
    }

    const detailRes = await fetch(url);
    
    if (!detailRes.ok) {
      let errorMsg = `YouTube details returned status ${detailRes.status}`;
      const text = await detailRes.text();
      try {
        const errorData = JSON.parse(text);
        if (errorData.error) {
          if (typeof errorData.error === 'object') {
            errorMsg = errorData.error.message || JSON.stringify(errorData.error);
          } else {
            errorMsg = errorData.error;
          }
        } else if (errorData.message) {
          errorMsg = errorData.message;
        }
      } catch (e) {
        if (text) errorMsg += `: ${text.substring(0, 100)}`;
      }
      console.error('YouTube Details Failed:', detailRes.status, errorMsg);
      throw new Error(errorMsg);
    }

    const detailData = await detailRes.json();
    if (!detailData.items || detailData.items.length === 0) {
      throw new Error('Channel details not found');
    }

    const channel = detailData.items[0];
    return {
      channelId: channel.id,
      handle: channel.snippet.customUrl,
      title: channel.snippet.title,
      thumbnail: channel.snippet.thumbnails?.high?.url || channel.snippet.thumbnails?.default?.url,
      banner: channel.brandingSettings?.image?.bannerExternalUrl,
      subscribers: channel.statistics?.subscriberCount || '0',
      videos: channel.statistics?.videoCount || '0',
      lastUpdated: new Date().toISOString()
    };
  } catch (err) {
    console.error('YouTube API Error:', err);
    throw err;
  }
};
