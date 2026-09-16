/**
 * Utilities for formatting, parsing, and classifying IMDb-style Person Media
 */

export const PERSON_MEDIA_CATEGORIES = {
  // Videos
  showreel: { label: 'Showreel', type: 'video' },
  monologue: { label: 'Monologue', type: 'video' },
  scene_clip: { label: 'Scene Clip', type: 'video' },
  interview: { label: 'Interview', type: 'video' },
  // Photos
  headshot: { label: 'Headshot', type: 'photo' },
  production_still: { label: 'Production Still', type: 'photo' },
  red_carpet: { label: 'Red Carpet / Premiere', type: 'photo' },
  behind_the_scenes: { label: 'Behind the Scenes', type: 'photo' },
};

/**
 * Format duration in seconds to "MM:SS" or "H:MM:SS"
 */
export function formatMediaDuration(seconds) {
  if (!seconds || seconds <= 0) return null;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  return `${m}:${String(s).padStart(2, '0')}`;
}

/**
 * Parse video URL to identify provider and ID
 */
export function parseVideoUrl(url) {
  if (!url || typeof url !== 'string') return { provider: 'unknown', id: null };
  const trimmed = url.trim();

  // YouTube
  if (trimmed.includes('youtube.com') || trimmed.includes('youtu.be')) {
    const match = trimmed.match(/(?:v=|youtu\.be\/|embed\/)([^&?#/]+)/);
    return {
      provider: 'youtube',
      id: match ? match[1] : null,
      thumbnailUrl: match ? `https://img.youtube.com/vi/${match[1]}/hqdefault.jpg` : null,
      embedUrl: match ? `https://www.youtube-nocookie.com/embed/${match[1]}?autoplay=1` : null,
    };
  }

  // Vimeo
  if (trimmed.includes('vimeo.com')) {
    const match = trimmed.match(/vimeo\.com\/(\d+)/);
    return {
      provider: 'vimeo',
      id: match ? match[1] : null,
      thumbnailUrl: null,
      embedUrl: match ? `https://player.vimeo.com/video/${match[1]}?autoplay=1` : null,
    };
  }

  return {
    provider: 'direct',
    id: null,
    thumbnailUrl: null,
    embedUrl: trimmed,
  };
}

/**
 * Categorize and sort person media list
 */
export function processPersonMedia(mediaList = []) {
  if (!Array.isArray(mediaList)) {
    return { videos: [], photos: [], hasMedia: false, primaryShowreel: null, primaryHeadshot: null };
  }

  const approved = mediaList.filter((m) => m && m.status === 'approved');

  const videos = approved
    .filter((m) => m.media_type === 'video')
    .sort((a, b) => (b.is_primary ? 1 : 0) - (a.is_primary ? 1 : 0) || (a.sort_order ?? 0) - (b.sort_order ?? 0));

  const photos = approved
    .filter((m) => m.media_type === 'photo')
    .sort((a, b) => (b.is_primary ? 1 : 0) - (a.is_primary ? 1 : 0) || (a.sort_order ?? 0) - (b.sort_order ?? 0));

  const primaryShowreel = videos.find((v) => v.is_primary || v.category === 'showreel') || videos[0] || null;
  const primaryHeadshot = photos.find((p) => p.is_primary || p.category === 'headshot') || photos[0] || null;

  return {
    videos,
    photos,
    hasMedia: videos.length > 0 || photos.length > 0,
    primaryShowreel,
    primaryHeadshot,
  };
}
