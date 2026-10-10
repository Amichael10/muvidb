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
  let clean = String(url).trim();
  if (!clean) return null;

  // 1. Direct channel ID pattern: /channel/UC...
  const channelMatch = clean.match(/\/channel\/(UC[\w-]+)/i);
  if (channelMatch) return { type: 'id', value: channelMatch[1] };

  // 2. Direct standalone UC... ID (24 characters)
  if (/^UC[\w-]{22}$/i.test(clean)) {
    return { type: 'id', value: clean };
  }

  // 3. Strip URL protocol and YouTube domain if present
  clean = clean.replace(/^(?:https?:\/\/)?(?:www\.)?youtube\.com\//i, '');
  clean = clean.replace(/^(?:https?:\/\/)?youtu\.be\//i, '');

  // Strip query strings, hash, and subpages like /videos, /featured, /about
  clean = clean.split(/[?#]/)[0];
  clean = clean.replace(/\/(?:videos|featured|playlists|community|channels|about|live|shorts)\/?$/i, '');
  clean = clean.replace(/\/+$/, '');

  // 4. Check for channel/ prefix remaining
  if (clean.toLowerCase().startsWith('channel/')) {
    const id = clean.slice(8);
    if (id) return { type: 'id', value: id };
  }

  // 5. Handle /c/, /user/, /@ prefixes
  clean = clean.replace(/^(?:@|c\/|user\/)/i, '');

  // If there's still a value, it's a handle, username, or vanity slug
  if (clean) {
    return { type: 'handle', value: clean };
  }

  return null;
};

/**
 * Fetches subscriber count, video count, thumbnail, and banner for a channel.
 * Routes through /api/external so the API key stays server-side.
 */
export const fetchChannelData = async (identifier) => {
  if (!identifier || !identifier.value) {
    throw new Error('Please enter a valid YouTube channel URL, handle, or ID');
  }

  try {
    let items = [];

    const fetchEndpoint = async (url) => {
      const detailRes = await fetch(url);
      if (!detailRes.ok) {
        let errorMsg = `YouTube details returned status ${detailRes.status}`;
        const text = await detailRes.text();
        try {
          const errorData = JSON.parse(text);
          if (errorData.error) {
            errorMsg =
              typeof errorData.error === 'object'
                ? errorData.error.message || JSON.stringify(errorData.error)
                : errorData.error;
          } else if (errorData.message) {
            errorMsg = errorData.message;
          }
        } catch {
          if (text) errorMsg += `: ${text.substring(0, 100)}`;
        }
        throw new Error(errorMsg);
      }
      return await detailRes.json();
    };

    if (identifier.type === 'id') {
      const data = await fetchEndpoint(
        `/api/external?provider=youtube&endpoint=channels&part=snippet,statistics,brandingSettings&id=${encodeURIComponent(identifier.value)}`
      );
      items = data.items || [];
    } else {
      const rawVal = identifier.value.replace(/^@/, '');

      // Attempt 1: forHandle with @ (standard YouTube handle query)
      try {
        const data = await fetchEndpoint(
          `/api/external?provider=youtube&endpoint=channels&part=snippet,statistics,brandingSettings&forHandle=${encodeURIComponent('@' + rawVal)}`
        );
        items = data.items || [];
      } catch (e) {
        if (e.message?.includes('quota') || e.message?.includes('disabled')) throw e;
      }

      // Attempt 2: forHandle without @
      if (!items.length) {
        try {
          const data = await fetchEndpoint(
            `/api/external?provider=youtube&endpoint=channels&part=snippet,statistics,brandingSettings&forHandle=${encodeURIComponent(rawVal)}`
          );
          items = data.items || [];
        } catch (e) {
          if (e.message?.includes('quota') || e.message?.includes('disabled')) throw e;
        }
      }

      // Attempt 3: forUsername (legacy custom /user/ URLs)
      if (!items.length) {
        try {
          const data = await fetchEndpoint(
            `/api/external?provider=youtube&endpoint=channels&part=snippet,statistics,brandingSettings&forUsername=${encodeURIComponent(rawVal)}`
          );
          items = data.items || [];
        } catch (e) {
          if (e.message?.includes('quota') || e.message?.includes('disabled')) throw e;
        }
      }

      // Attempt 4: Search fallback (if channel vanity slug doesn't match handle directly)
      if (!items.length) {
        try {
          const searchData = await fetchEndpoint(
            `/api/external?provider=youtube&endpoint=search&part=snippet&type=channel&maxResults=1&q=${encodeURIComponent(rawVal)}`
          );
          if (searchData.items && searchData.items.length > 0) {
            const foundId = searchData.items[0].snippet?.channelId;
            if (foundId) {
              const chData = await fetchEndpoint(
                `/api/external?provider=youtube&endpoint=channels&part=snippet,statistics,brandingSettings&id=${encodeURIComponent(foundId)}`
              );
              items = chData.items || [];
            }
          }
        } catch (e) {
          if (e.message?.includes('quota') || e.message?.includes('disabled')) throw e;
        }
      }
    }

    if (!items || items.length === 0) {
      throw new Error('Channel details not found. Please verify the URL or channel handle.');
    }

    const channel = items[0];
    return {
      channelId: channel.id,
      handle: channel.snippet.customUrl,
      title: channel.snippet.title,
      thumbnail: channel.snippet.thumbnails?.high?.url || channel.snippet.thumbnails?.default?.url,
      banner: channel.brandingSettings?.image?.bannerExternalUrl,
      subscribers: channel.statistics?.subscriberCount || '0',
      views: channel.statistics?.viewCount || '0',
      videos: channel.statistics?.videoCount || '0',
      lastUpdated: new Date().toISOString()
    };
  } catch (err) {
    console.error('YouTube API Error:', err);
    throw err;
  }
};
