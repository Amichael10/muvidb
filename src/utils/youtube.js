// All YouTube Data API calls are routed through the /api/youtube server-side
// proxy so the API key is never included in the client bundle.

// ─────────────────────────────────────────
// INTERNAL: Proxy fetch helper
// Sends all YouTube requests through /api/youtube
// ─────────────────────────────────────────
const youtubeFetch = async (endpoint, params = {}) => {
  const searchParams = new URLSearchParams({ endpoint })
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      searchParams.set(key, String(value))
    }
  })
  const res = await fetch(`/api/youtube?${searchParams}`)
  return res.json()
}

// ─────────────────────────────────────────
// HELPER: Format large numbers nicely
// 1200 → "1.2K" | 4200000 → "4.2M"
// ─────────────────────────────────────────
export const formatViewCount = (num) => {
  if (!num) return '0'
  const n = parseInt(num)
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return n.toString()
}

// ─────────────────────────────────────────
// HELPER: Parse ISO 8601 duration to minutes
// "PT2M30S" → "2:30"
// ─────────────────────────────────────────
export const parseDuration = (iso) => {
  if (!iso) return { formatted: null, totalSeconds: 0 }
  const match = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/)
  if (!match) return { formatted: '0:00', totalSeconds: 0 }
  const hours = parseInt(match[1] || 0)
  const minutes = parseInt(match[2] || 0)
  const seconds = parseInt(match[3] || 0)
  const totalSeconds = (hours * 3600) + (minutes * 60) + seconds

  let formatted = ''
  if (hours > 0) {
    formatted = `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
  } else {
    formatted = `${minutes}:${String(seconds).padStart(2, '0')}`
  }

  return { formatted, totalSeconds }
}

// ─────────────────────────────────────────
// HELPER: Check if a video is likely a trailer
// Returns a confidence score 0-100
// ─────────────────────────────────────────
export const trailerConfidenceScore = (video) => {
  const title = (video.snippet?.title || '').toLowerCase()
  const description = (video.snippet?.description || '').toLowerCase()
  const duration = video.contentDetails?.duration || ''

  let score = 0

  // Title keywords
  if (title.includes('official trailer')) score += 40
  else if (title.includes('official teaser')) score += 35
  else if (title.includes('trailer')) score += 25
  else if (title.includes('teaser')) score += 20

  // Description keywords
  if (description.includes('trailer')) score += 10
  if (description.includes('in cinemas') ||
      description.includes('now showing') ||
      description.includes('coming soon')) score += 10

  // Duration check — trailers are 30 seconds to 3.5 minutes
  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/)
  if (match) {
    const hours = parseInt(match[1] || 0)
    const minutes = parseInt(match[2] || 0)
    const seconds = parseInt(match[3] || 0)
    const totalSeconds = (hours * 3600) + (minutes * 60) + seconds

    if (hours === 0 && minutes <= 3 && minutes >= 1) score += 30
    else if (hours === 0 && seconds >= 30 && minutes === 0) score += 20
    else if (hours === 0 && minutes <= 5) score += 10
    else score -= 20 // too long, likely a full movie or interview
  }

  return Math.min(score, 100)
}

// ─────────────────────────────────────────
// FUNCTION 1: Search for a film's trailer
// Returns top 5 candidates with confidence scores
// NEVER auto-saves — always sends to admin review
// ─────────────────────────────────────────
export const searchTrailer = async (filmTitle, channelId = null) => {
  try {
    const searchParams = {
      part: 'snippet,contentDetails,statistics',
      q: `${filmTitle} official trailer nollywood`,
      type: 'video',
      videoDuration: 'short',
      videoDefinition: 'any',
      order: 'relevance',
      maxResults: 5,
      regionCode: 'NG',
    }
    if (channelId) searchParams.channelId = channelId

    const searchData = await youtubeFetch('search', searchParams)

    if (!searchData.items || searchData.items.length === 0) {
      return []
    }

    // Get full details for each result (stats + duration)
    const videoIds = searchData.items.map(item => item.id.videoId).join(',')
    const detailData = await youtubeFetch('videos', {
      part: 'snippet,contentDetails,statistics',
      id: videoIds,
    })

    // Score each result and return sorted by confidence
    const scored = (detailData.items || []).map(video => {
      const durationInfo = parseDuration(video.contentDetails?.duration)
      return {
        videoId: video.id,
        title: video.snippet?.title || 'Unknown Title',
        channelTitle: video.snippet?.channelTitle || '',
        thumbnail: video.snippet?.thumbnails?.medium?.url || video.snippet?.thumbnails?.default?.url || '',
        duration: durationInfo.formatted,
        totalSeconds: durationInfo.totalSeconds,
        rawDuration: video.contentDetails?.duration,
        viewCount: parseInt(video.statistics?.viewCount || 0),
        publishedAt: video.snippet?.publishedAt || new Date().toISOString(),
        confidence: trailerConfidenceScore(video)
      }
    })

    return scored
      .filter(v => v.confidence > 20)
      .sort((a, b) => b.confidence - a.confidence)

  } catch (error) {
    console.error('searchTrailer error:', error)
    return []
  }
}

// ─────────────────────────────────────────
// FUNCTION 2: Get stats for a known video ID
// Used when you already have the YouTube ID saved
// Costs 1 quota unit (very cheap)
// ─────────────────────────────────────────
export const fetchVideoStats = async (videoId) => {
  try {
    const data = await youtubeFetch('videos', {
      part: 'statistics,contentDetails',
      id: videoId,
    })

    if (!data.items || data.items.length === 0) {
      return null
    }

    const video = data.items[0]
    const durationInfo = parseDuration(video.contentDetails?.duration)
    return {
      videoId,
      viewCount: parseInt(video.statistics?.viewCount || 0),
      likeCount: parseInt(video.statistics?.likeCount || 0),
      commentCount: parseInt(video.statistics?.commentCount || 0),
      duration: durationInfo.formatted,
      totalSeconds: durationInfo.totalSeconds
    }
  } catch (error) {
    console.error('fetchVideoStats error:', error)
    return null
  }
}

// ─────────────────────────────────────────
// FUNCTION 3: Batch fetch stats for multiple videos
// YouTube allows up to 50 IDs per call
// Costs 1 quota unit total for up to 50 films
// ─────────────────────────────────────────
export const batchFetchVideoStats = async (videoIds) => {
  try {
    // Split into chunks of 50 (YouTube API limit)
    const chunks = []
    for (let i = 0; i < videoIds.length; i += 50) {
      chunks.push(videoIds.slice(i, i + 50))
    }

    const results = {}

    for (const chunk of chunks) {
      const data = await youtubeFetch('videos', {
        part: 'statistics',
        id: chunk.join(','),
      })

      for (const video of (data.items || [])) {
        results[video.id] = {
          viewCount: parseInt(video.statistics?.viewCount || 0),
          likeCount: parseInt(video.statistics?.likeCount || 0),
          commentCount: parseInt(video.statistics?.commentCount || 0)
        }
      }

      // Respect rate limits — wait 200ms between chunks
      if (chunks.length > 1) {
        await new Promise(resolve => setTimeout(resolve, 200))
      }
    }

    return results
  } catch (error) {
    console.error('batchFetchVideoStats error:', error)
    return {}
  }
}

// ─────────────────────────────────────────
// FUNCTION 4: Resolve a YouTube channel URL
// to a channel ID. Used in admin "Add Channel"
// ─────────────────────────────────────────
export const resolveChannelId = async (handleOrUrl) => {
  try {
    let input = handleOrUrl.trim()
    let channelId = null
    let username = null
    let handle = null

    if (input.includes('youtube.com/channel/')) {
      channelId = input.split('youtube.com/channel/')[1].split('/')[0].split('?')[0]
    } else if (input.includes('youtube.com/c/')) {
      username = input.split('youtube.com/c/')[1].split('/')[0].split('?')[0]
    } else if (input.includes('youtube.com/user/')) {
      username = input.split('youtube.com/user/')[1].split('/')[0].split('?')[0]
    } else if (input.includes('youtube.com/@')) {
      handle = input.split('youtube.com/@')[1].split('/')[0].split('?')[0]
    } else if (input.startsWith('@')) {
      handle = input.slice(1)
    } else {
      handle = input
    }

    const channelParams = { part: 'id,snippet,statistics' }
    if (channelId) channelParams.id = channelId
    else if (username) channelParams.forUsername = username
    else if (handle) channelParams.forHandle = `@${handle}`

    let data
    try {
      data = await youtubeFetch('channels', channelParams)
    } catch (err) {
      // If the request fails (e.g. invalid handle format), fall through to search
      data = { items: [] }
    }

    if (data.error) {
      console.error('YouTube API Error:', data.error)
      return { error: `YouTube API Error: ${data.error.message}` }
    }

    // Fallback: search by query if direct lookup returns nothing
    if (!data.items || data.items.length === 0) {
      const searchQuery = channelId || username || handle || input
      const searchData = await youtubeFetch('search', {
        part: 'snippet',
        type: 'channel',
        q: searchQuery,
        maxResults: 1,
      })

      if (searchData.error) {
        console.error('YouTube Search API Error:', searchData.error)
        return { error: `YouTube API Error: ${searchData.error.message}` }
      }

      if (searchData.items && searchData.items.length > 0) {
        const foundChannelId = searchData.items[0].snippet.channelId
        data = await youtubeFetch('channels', {
          part: 'id,snippet,statistics',
          id: foundChannelId,
        })
      }
    }

    if (!data.items || data.items.length === 0) {
      return { error: 'Channel not found' }
    }

    const channel = data.items[0]
    return {
      channelId: channel.id,
      name: channel.snippet.title,
      thumbnail: channel.snippet.thumbnails.default?.url,
      subscriberCount: channel.statistics.subscriberCount,
      videoCount: channel.statistics.videoCount,
      viewCount: channel.statistics.viewCount,
      publishedAt: channel.snippet.publishedAt,
      resolvedFrom: channelId ? 'url' : 'search'
    }
  } catch (error) {
    console.error('resolveChannelId error:', error)
    return { error: error.message }
  }
}

// ─────────────────────────────────────────
// FUNCTION 6: Fetch recent videos from a channel
// Used to auto-sync new trailers from trusted channels
// ─────────────────────────────────────────
export const fetchRecentVideosFromChannel = async (channelId, maxResults = 50) => {
  try {
    // Get the uploads playlist ID for the channel
    const channelData = await youtubeFetch('channels', {
      part: 'contentDetails',
      id: channelId,
    })

    if (channelData.error) {
      console.error(`YouTube API error for channel ${channelId}:`, channelData.error)
      return []
    }
    if (!channelData.items || channelData.items.length === 0) return []

    const uploadsPlaylistId = channelData.items[0].contentDetails?.relatedPlaylists?.uploads
    if (!uploadsPlaylistId) return []

    let allVideoItems = []
    let nextPageToken = ''
    const maxScanDepth = Math.min(maxResults, 100)

    // Pagination loop
    do {
      const playlistData = await youtubeFetch('playlistItems', {
        part: 'snippet',
        playlistId: uploadsPlaylistId,
        maxResults: 50,
        pageToken: nextPageToken,
      })

      if (playlistData.error) {
        console.error(`YouTube API error fetching playlist ${uploadsPlaylistId}:`, playlistData.error)
        break
      }
      if (!playlistData.items || playlistData.items.length === 0) break

      allVideoItems = [...allVideoItems, ...playlistData.items]
      nextPageToken = playlistData.nextPageToken
    } while (nextPageToken && allVideoItems.length < maxScanDepth)

    if (allVideoItems.length === 0) return []

    const videoIds = allVideoItems
      .slice(0, maxScanDepth)
      .map(item => item.snippet.resourceId.videoId)
      .filter(Boolean)

    if (videoIds.length === 0) return []

    // Batch fetch details (up to 50 IDs per call)
    const detailedVideos = []
    for (let i = 0; i < videoIds.length; i += 50) {
      const detailData = await youtubeFetch('videos', {
        part: 'snippet,contentDetails,statistics',
        id: videoIds.slice(i, i + 50).join(','),
      })
      if (detailData.items) {
        detailedVideos.push(...detailData.items)
      }
    }

    return detailedVideos.map(video => {
      const durationInfo = parseDuration(video.contentDetails?.duration)
      return {
        videoId: video.id,
        title: video.snippet?.title || 'Unknown Title',
        description: video.snippet?.description || '',
        thumbnail: video.snippet?.thumbnails?.maxres?.url ||
                   video.snippet?.thumbnails?.high?.url ||
                   video.snippet?.thumbnails?.medium?.url ||
                   video.snippet?.thumbnails?.default?.url || '',
        publishedAt: video.snippet?.publishedAt || new Date().toISOString(),
        duration: durationInfo.formatted,
        totalSeconds: durationInfo.totalSeconds,
        viewCount: parseInt(video.statistics?.viewCount || 0)
      }
    })
  } catch (error) {
    console.error('fetchRecentVideosFromChannel error:', error)
    return []
  }
}

export const fetchTrailerComments = async (videoId, maxResults = 10) => {
  try {
    const data = await youtubeFetch('commentThreads', {
      part: 'snippet',
      videoId,
      order: 'relevance',
      maxResults,
    })

    // Comments may be disabled on some videos
    if (data.error?.code === 403) {
      return { disabled: true, comments: [] }
    }

    const comments = (data.items || []).map(item => {
      const c = item.snippet.topLevelComment.snippet
      return {
        id: item.id,
        text: c.textDisplay,
        author: c.authorDisplayName,
        authorPhoto: c.authorProfileImageUrl,
        likeCount: c.likeCount,
        publishedAt: c.publishedAt,
        replyCount: item.snippet.totalReplyCount
      }
    })

    return { disabled: false, comments }
  } catch (error) {
    console.error('fetchTrailerComments error:', error)
    return { disabled: true, comments: [] }
  }
}
