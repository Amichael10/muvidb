import { authHeaders } from './apiAuth';

export const FILM_MEDIA_CATEGORIES = {
  poster: { label: 'Poster', type: 'photo' },
  backdrop: { label: 'Backdrop / Wallpaper', type: 'photo' },
  production_still: { label: 'Production Still', type: 'photo' },
  behind_the_scenes: { label: 'Behind the Scenes', type: 'photo' },
  premiere: { label: 'Premiere / Red Carpet', type: 'photo' },
  screencap: { label: 'Screen Capture', type: 'photo' },
  trailer: { label: 'Trailer', type: 'video' },
  teaser: { label: 'Teaser', type: 'video' },
  clip: { label: 'Scene Clip', type: 'video' },
  interview: { label: 'Interview', type: 'video' }
};

export async function getFilmMedia(filmId) {
  if (!filmId) return [];
  const res = await fetch(`/api/film-media?filmId=${encodeURIComponent(filmId)}`);
  if (!res.ok) return [];
  const json = await res.json();
  return json.data || [];
}

export async function saveFilmMedia(payload, method = 'POST') {
  const response = await fetch('/api/film-media', {
    method,
    headers: await authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload)
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'Unable to save film media');
  return result.data;
}

export async function uploadFilmMediaFile(file, filmId) {
  if (!file || file.size > 20 * 1024 * 1024) {
    throw new Error('Please choose a file up to 20 MB.');
  }

  // Convert file to base64 for safe upload endpoint handling
  const reader = new FileReader();
  const fileBase64 = await new Promise((resolve, reject) => {
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

  const headers = await authHeaders({ 'Content-Type': 'application/json' });
  const response = await fetch('/api/film-media?action=upload', {
    method: 'POST',
    headers,
    body: JSON.stringify({ filmId, fileBase64 })
  });

  const result = await response.json();
  if (!response.ok || !result.url) {
    throw new Error(result.error || 'Failed to upload film image');
  }

  return { url: result.url, key: result.key };
}
