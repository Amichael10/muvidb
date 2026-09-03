import { supabase } from '../lib/supabase.js';
import { parseDuration, formatViewCount } from '../utils/youtube.js';

export const COUNTRY_LOOKUP = {
  NG: { code: 'NG', name: 'Nigeria', flag: '🇳🇬' },
  GH: { code: 'GH', name: 'Ghana', flag: '🇬🇭' },
  ZA: { code: 'ZA', name: 'South Africa', flag: '🇿🇦' },
  KE: { code: 'KE', name: 'Kenya', flag: '🇰🇪' },
  GB: { code: 'GB', name: 'United Kingdom', flag: '🇬🇧' },
  US: { code: 'US', name: 'United States', flag: '🇺🇸' },
  CA: { code: 'CA', name: 'Canada', flag: '🇨🇦' },
};

export function getCountryInfo(rawCountry) {
  if (!rawCountry) return { code: 'NG', name: 'Nigeria', flag: '🇳🇬' };
  const trimmed = String(rawCountry).trim().toUpperCase();
  if (COUNTRY_LOOKUP[trimmed]) return COUNTRY_LOOKUP[trimmed];
  const lower = String(rawCountry).toLowerCase().trim();
  if (lower.includes('nigeria')) return { code: 'NG', name: 'Nigeria', flag: '🇳🇬' };
  if (lower.includes('ghana')) return { code: 'GH', name: 'Ghana', flag: '🇬🇭' };
  if (lower.includes('south africa')) return { code: 'ZA', name: 'South Africa', flag: '🇿🇦' };
  if (lower.includes('kenya')) return { code: 'KE', name: 'Kenya', flag: '🇰🇪' };
  if (lower.includes('kingdom') || lower.includes('uk')) return { code: 'GB', name: 'United Kingdom', flag: '🇬🇧' };
  if (lower.includes('state') || lower.includes('usa') || lower.includes('america')) return { code: 'US', name: 'United States', flag: '🇺🇸' };
  return { code: trimmed.slice(0, 2) || 'AF', name: rawCountry, flag: '🌍' };
}

/**
 * YouTube proxy fetch helper
 */
async function fetchYouTube(endpoint, params = {}) {
  const searchParams = new URLSearchParams({ provider: 'youtube', endpoint });
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      searchParams.set(key, String(value));
    }
  });

  try {
    const res = await fetch(`/api/external?${searchParams}`);
    if (!res.ok) {
      return { items: [], error: `YouTube API returned ${res.status}` };
    }
    const data = await res.json();
    return data || { items: [] };
  } catch (err) {
    console.error('YouTube Title Search Error:', err);
    return { items: [], error: err.message };
  }
}

/**
 * Normalize string for title comparison
 */
function normalizeTitle(str) {
  if (!str) return '';
  return str
    .toLowerCase()
    .replace(/^(the|a|an)\s+/i, '')
    .replace(/[^\w\s]/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Clean query helper
 */
function sanitizeQuery(str) {
  if (!str) return '';
  return str.trim();
}

/**
 * Search local MuviDB database for matching films
 */
async function searchDatabaseFilms(query) {
  const clean = sanitizeQuery(query);
  if (!clean) return [];

  try {
    // 1. Exact match search
    const { data: exactFilms, error: exactErr } = await supabase
      .from('films')
      .select(`
        id,
        title,
        slug,
        release_year,
        country,
        poster_url,
        backdrop_url,
        synopsis,
        views_count,
        channel_videos (
          channel:channels (
            id,
            name,
            country,
            thumbnail_url
          )
        ),
        credits (
          role,
          person:people (
            id,
            name
          )
        )
      `)
      .ilike('title', clean)
      .limit(15);

    // 2. Partial match search
    const { data: partialFilms, error: partialErr } = await supabase
      .from('films')
      .select(`
        id,
        title,
        slug,
        release_year,
        country,
        poster_url,
        backdrop_url,
        synopsis,
        views_count,
        channel_videos (
          channel:channels (
            id,
            name,
            country,
            thumbnail_url
          )
        ),
        credits (
          role,
          person:people (
            id,
            name
          )
        )
      `)
      .ilike('title', `%${clean}%`)
      .limit(25);

    if (exactErr && partialErr) return [];

    // Deduplicate
    const combined = [...(exactFilms || []), ...(partialFilms || [])];
    const seen = new Set();
    const unique = [];

    const normQuery = normalizeTitle(clean);

    for (const film of combined) {
      if (!film || seen.has(film.id)) continue;
      seen.add(film.id);

      const normFilmTitle = normalizeTitle(film.title);
      const isExact = normFilmTitle === normQuery || film.title.toLowerCase() === clean.toLowerCase();

      // Extract director / key cast
      const keyCast = (film.credits || [])
        .filter(c => c?.person?.name)
        .slice(0, 3)
        .map(c => c.person.name);

      const channel = film.channel_videos?.[0]?.channel || null;
      const filmCountry = film.country || channel?.country || 'Nigeria';

      unique.push({
        id: film.id,
        title: film.title,
        slug: film.slug,
        release_year: film.release_year,
        releaseYear: film.release_year,
        country: filmCountry,
        countryInfo: getCountryInfo(filmCountry),
        poster_url: film.poster_url || film.backdrop_url,
        synopsis: film.synopsis,
        views_count: film.views_count,
        channel: channel ? { id: channel.id, name: channel.name, thumbnail_url: channel.thumbnail_url } : null,
        cast: keyCast,
        isExactMatch: isExact,
        videoType: 'FULL_MOVIE',
        videoTypeLabel: 'Full Movie',
        duration: 'Feature Film',
        source: 'database'
      });
    }

    return unique;
  } catch (err) {
    console.error('Database Title Search Error:', err);
    return [];
  }
}

/**
 * Search YouTube for live uploads matching the title
 */
async function searchYouTubeVideos(query) {
  const clean = sanitizeQuery(query);
  if (!clean) return [];

  try {
    // Search YouTube for Nollywood movies with this title
    const searchData = await fetchYouTube('search', {
      q: `"${clean}" nollywood movie`,
      part: 'snippet',
      type: 'video',
      maxResults: 25,
      relevanceLanguage: 'en',
    });

    const items = searchData?.items || [];
    if (!items.length) return [];

    // Extract video IDs to get full stats and duration
    const videoIds = items.map(item => item.id?.videoId).filter(Boolean);
    if (!videoIds.length) return [];

    const videosData = await fetchYouTube('videos', {
      id: videoIds.join(','),
      part: 'snippet,contentDetails,statistics',
    });

    const videoDetailsList = videosData?.items || [];
    const normQuery = normalizeTitle(clean);

    // Extract unique channel IDs to query country & avatar
    const channelIds = Array.from(new Set(videoDetailsList.map(v => v.snippet?.channelId).filter(Boolean)));
    const channelMetaMap = {};

    if (channelIds.length > 0) {
      try {
        const channelsData = await fetchYouTube('channels', {
          id: channelIds.slice(0, 40).join(','),
          part: 'snippet',
        });
        (channelsData?.items || []).forEach(ch => {
          channelMetaMap[ch.id] = {
            country: ch.snippet?.country || 'NG',
            avatar: ch.snippet?.thumbnails?.default?.url || ch.snippet?.thumbnails?.medium?.url,
            customUrl: ch.snippet?.customUrl,
          };
        });
      } catch (chErr) {
        console.warn('Failed to fetch channel details:', chErr);
      }
    }

    return videoDetailsList.map(v => {
      const title = v.snippet?.title || '';
      const normTitle = normalizeTitle(title);
      const desc = (v.snippet?.description || '').toLowerCase();
      
      const durationInfo = parseDuration(v.contentDetails?.duration || '');
      const rawViews = parseInt(v.statistics?.viewCount || 0, 10);
      const publishDate = v.snippet?.publishedAt || '';
      const totalSec = durationInfo.totalSeconds || 0;
      const releaseYear = publishDate ? new Date(publishDate).getFullYear() : null;

      // Classify video type
      let videoType = 'CLIP';
      let videoTypeLabel = 'Clip / Part';
      const lowerTitle = title.toLowerCase();

      if (totalSec >= 2700) {
        // 45+ minutes is a full movie / feature length
        videoType = 'FULL_MOVIE';
        videoTypeLabel = 'Full Movie';
      } else if (
        totalSec <= 360 &&
        (lowerTitle.includes('trailer') || lowerTitle.includes('teaser') || desc.includes('trailer') || desc.includes('teaser'))
      ) {
        // Under 6 mins and mentions trailer/teaser
        videoType = 'TRAILER';
        videoTypeLabel = 'Official Trailer';
      } else if (totalSec <= 300) {
        videoType = 'TRAILER';
        videoTypeLabel = 'Trailer / Teaser';
      } else {
        videoType = 'CLIP';
        videoTypeLabel = 'Short / Clip';
      }

      // Format readable duration (e.g., "1h 48m" or "2m 15s")
      let readableDuration = durationInfo.formatted || '0:00';
      const h = Math.floor(totalSec / 3600);
      const m = Math.floor((totalSec % 3600) / 60);
      const s = totalSec % 60;
      if (h > 0) {
        readableDuration = `${h}h ${m}m`;
      } else if (m > 0) {
        readableDuration = s > 0 ? `${m}m ${s}s` : `${m}m`;
      } else if (s > 0) {
        readableDuration = `${s}s`;
      }

      // Check match strength
      const isExact = normTitle.includes(normQuery) || title.toLowerCase().includes(clean.toLowerCase());
      const isFeatureLength = totalSec >= 2700;

      const chId = v.snippet?.channelId;
      const rawChannelCountry = channelMetaMap[chId]?.country || 'NG';
      const countryInfo = getCountryInfo(rawChannelCountry);

      return {
        id: v.id,
        title: title,
        description: v.snippet?.description || '',
        publishedAt: publishDate,
        releaseYear,
        formattedDate: publishDate ? new Date(publishDate).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : '',
        channelId: chId,
        channelTitle: v.snippet?.channelTitle || 'Unknown Channel',
        channelAvatar: channelMetaMap[chId]?.avatar || null,
        channelCountry: rawChannelCountry,
        countryInfo,
        country: countryInfo.name,
        thumbnail: v.snippet?.thumbnails?.maxres?.url || v.snippet?.thumbnails?.high?.url || v.snippet?.thumbnails?.medium?.url,
        viewCount: rawViews,
        formattedViews: formatViewCount(rawViews),
        duration: readableDuration,
        rawDuration: durationInfo.formatted,
        totalSeconds: totalSec,
        videoType,
        videoTypeLabel,
        isFeatureLength,
        isExactMatch: isExact,
        url: `https://www.youtube.com/watch?v=${v.id}`,
        source: 'youtube'
      };
    }).sort((a, b) => b.viewCount - a.viewCount);
  } catch (err) {
    console.error('YouTube Live Search Error:', err);
    return [];
  }
}

/**
 * Main Title Clearance & Collision Radar Evaluator
 */
export async function checkTitleAvailability(query) {
  const trimmed = sanitizeQuery(query);
  if (!trimmed || trimmed.length < 2) {
    return {
      query: trimmed,
      verdict: 'EMPTY',
      riskScore: 0,
      riskLevel: 'CLEAR',
      summary: 'Please enter a valid title to check.',
      databaseMatches: [],
      youtubeMatches: [],
      totalMatches: 0,
      totalViews: 0,
      topCompetingChannel: null,
    };
  }

  // Run DB search and YouTube search in parallel
  const [databaseMatches, youtubeMatches] = await Promise.all([
    searchDatabaseFilms(trimmed),
    searchYouTubeVideos(trimmed),
  ]);

  const normQuery = normalizeTitle(trimmed);

  // Exact matches
  const exactDbMatches = databaseMatches.filter(m => m.isExactMatch);
  const exactYtMatches = youtubeMatches.filter(m => m.isExactMatch);
  const highViewYtMatches = youtubeMatches.filter(m => m.viewCount >= 100_000);
  const totalViews = youtubeMatches.reduce((acc, curr) => acc + (curr.viewCount || 0), 0);

  // Determine top competing channel
  const channelFrequency = {};
  youtubeMatches.forEach(v => {
    if (v.channelTitle) {
      channelFrequency[v.channelTitle] = (channelFrequency[v.channelTitle] || 0) + v.viewCount;
    }
  });
  let topCompetingChannel = null;
  let maxChannelViews = 0;
  for (const [ch, vCount] of Object.entries(channelFrequency)) {
    if (vCount > maxChannelViews) {
      maxChannelViews = vCount;
      topCompetingChannel = ch;
    }
  }

  // Calculate Risk Score (0 to 100)
  let riskScore = 0;

  if (exactDbMatches.length > 0) riskScore += 50;
  if (exactYtMatches.length > 0) riskScore += 35;
  if (highViewYtMatches.length > 0) riskScore += 25;
  if (databaseMatches.length > 0) riskScore += 15;
  if (youtubeMatches.length >= 5) riskScore += 15;

  riskScore = Math.min(100, riskScore);

  let riskLevel = 'CLEAR';
  let verdictTitle = 'Title Available & Unique';
  let verdictMessage = 'No high-collision movies or saturated YouTube uploads found with this exact title.';

  if (riskScore >= 70) {
    riskLevel = 'HIGH';
    verdictTitle = 'High Title Collision';
    verdictMessage = `An existing movie or popular production already exists with this exact or very similar title (${formatViewCount(totalViews)} total views on YouTube). We recommend choosing a distinct variation.`;
  } else if (riskScore >= 30) {
    riskLevel = 'MODERATE';
    verdictTitle = 'Moderate Collision / Similar Titles Exist';
    verdictMessage = `Some movies or video uploads have similar words or partial matches. Review existing productions before registering.`;
  }

  return {
    query: trimmed,
    normalizedQuery: normQuery,
    riskScore,
    riskLevel,
    verdictTitle,
    verdictMessage,
    databaseMatches,
    youtubeMatches,
    totalMatches: databaseMatches.length + youtubeMatches.length,
    exactMatchesCount: exactDbMatches.length + exactYtMatches.length,
    totalViews,
    formattedTotalViews: formatViewCount(totalViews),
    topCompetingChannel,
    timestamp: new Date().toISOString()
  };
}
