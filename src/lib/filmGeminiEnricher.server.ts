import { supabaseServer } from './supabase.server';

const GEMINI_KEY = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;
const YOUTUBE_KEY = process.env.YOUTUBE_API_KEY || process.env.VITE_YOUTUBE_API_KEY;

// Existing DB Genres
export const ALLOWED_GENRES = [
  'Drama',
  'Romance',
  'Action',
  'Comedy',
  'Horror',
  'Nollywood Epic',
  'Thriller',
  'Family',
  'Crime',
  'Sci-Fi',
  'Documentary',
  'Adventure',
  'Fantasy',
  'Mystery',
];

// Standard DB Age Ratings
export const ALLOWED_AGE_RATINGS = ['18+', '16+', '13+', 'PG', 'G'];

export function extractYoutubeVideoId(film: any): string | null {
  if (film.trailer_youtube_id) return film.trailer_youtube_id;
  if (film.source_video_id) return film.source_video_id;
  if (film.youtube_watch_url) {
    const match = film.youtube_watch_url.match(/(?:v=|\/embed\/|\/watch\?v=|\/v\/|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
    if (match) return match[1];
  }
  return null;
}

export async function fetchYoutubeMetadata(videoId: string) {
  if (!YOUTUBE_KEY) return { title: '', description: '', channel: '' };
  try {
    const res = await fetch(`https://www.googleapis.com/youtube/v3/videos?part=snippet&id=${videoId}&key=${YOUTUBE_KEY}`);
    if (!res.ok) return { title: '', description: '', channel: '' };
    const data = await res.json();
    const item = data.items?.[0]?.snippet;
    if (!item) return { title: '', description: '', channel: '' };
    return {
      title: item.title || '',
      description: item.description || '',
      channel: item.channelTitle || '',
    };
  } catch {
    return { title: '', description: '', channel: '' };
  }
}

export function mapToClosestGenre(suggested: string): string {
  if (!suggested) return 'Drama';
  const clean = suggested.trim().toLowerCase();
  for (const g of ALLOWED_GENRES) {
    if (g.toLowerCase() === clean || clean.includes(g.toLowerCase())) return g;
  }
  if (clean.includes('epic') || clean.includes('cultural') || clean.includes('tribal')) return 'Nollywood Epic';
  if (clean.includes('love') || clean.includes('romantic')) return 'Romance';
  if (clean.includes('funny') || clean.includes('humor')) return 'Comedy';
  if (clean.includes('action') || clean.includes('fight')) return 'Action';
  if (clean.includes('scary') || clean.includes('spooky') || clean.includes('witch')) return 'Horror';
  if (clean.includes('suspense') || clean.includes('mystery')) return 'Thriller';
  return 'Drama';
}

export function mapToClosestAgeRating(suggested: string): string {
  if (!suggested) return '13+';
  const clean = suggested.trim().toUpperCase();
  if (clean.includes('18') || clean.includes('R') || clean.includes('ADULT') || clean.includes('NC-17')) return '18+';
  if (clean.includes('16')) return '16+';
  if (clean.includes('13') || clean.includes('PG-13') || clean.includes('TEEN')) return '13+';
  if (clean.includes('PG')) return 'PG';
  if (clean.includes('G') || clean.includes('ALL') || clean.includes('KIDS')) return 'G';
  return '13+';
}

export async function enrichFilmWithGemini(film: any) {
  const videoId = extractYoutubeVideoId(film);
  let ytTitle = '';
  let ytDesc = '';
  let ytChannel = '';

  if (videoId) {
    const ytMeta = await fetchYoutubeMetadata(videoId);
    ytTitle = ytMeta.title;
    ytDesc = ytMeta.description;
    ytChannel = ytMeta.channel;
  }

  if (!GEMINI_KEY) {
    throw new Error('GEMINI_API_KEY is not configured in environment');
  }

  const prompt = `You are an expert film editor for MuviDB, the premier African and Nollywood film database.
Given the following movie information from YouTube/Database, write a clean, high-quality, professional synopsis for MuviDB and recommend the single best matching Genre and Age Rating.

USER INSTRUCTION:
"write me a muvidb worthy synopsis for this movie and get the genre and age rating of people that can watch this."

RULES FOR SYNOPSIS:
- Write a 2 to 4 sentence professional, engaging synopsis.
- Do NOT include promotional links, YouTube channel names, "Subscribe", actor casts, hashtags, or social handles.
- Focus on the plot, main conflict, and themes of the movie.

ALLOWED GENRES (Choose the single best one):
Drama, Romance, Action, Comedy, Horror, Nollywood Epic, Thriller, Family, Crime, Sci-Fi, Documentary

ALLOWED AGE RATINGS (Choose the single best one):
18+, 16+, 13+, PG, G

MOVIE DATA:
Title: ${film.title || ''}
Year: ${film.year || ''}
YouTube Video Title: ${ytTitle}
YouTube Channel: ${ytChannel}
Raw Description: ${ytDesc.slice(0, 1500)}

Respond strictly with valid JSON only in this format:
{
  "synopsis": "The clean MuviDB-worthy synopsis text here...",
  "genre": "Drama",
  "age_rating": "16+"
}`;

  const geminiRes = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: 'application/json' },
      }),
    }
  );

  if (!geminiRes.ok) {
    const errText = await geminiRes.text();
    throw new Error(`Gemini API HTTP ${geminiRes.status}: ${errText}`);
  }

  const geminiData = await geminiRes.json();
  const rawText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
  const parsed = JSON.parse(rawText);

  const cleanSynopsis = (parsed.synopsis || '').trim();
  const rawGenre = (parsed.genre || '').trim();
  const rawRating = (parsed.age_rating || '').trim();

  const mappedGenre = mapToClosestGenre(rawGenre);
  const mappedAgeRating = mapToClosestAgeRating(rawRating);

  return {
    synopsis: cleanSynopsis,
    genre: mappedGenre,
    age_rating: mappedAgeRating,
    yt_title: ytTitle,
  };
}

export async function applyFilmEnrichmentToDb(filmId: string, enrichment: { synopsis: string; genre: string; age_rating: string }) {
  const { synopsis, genre, age_rating } = enrichment;

  // 1. Update films table
  const { error: filmErr } = await supabaseServer
    .from('films')
    .update({
      synopsis: synopsis,
      genres: [genre],
      maturity_rating: age_rating,
    })
    .eq('id', filmId);

  if (filmErr) throw filmErr;

  // 2. Ensure genre exists in genres table and link in film_genres
  let { data: dbGenre } = await supabaseServer
    .from('genres')
    .select('id')
    .ilike('name', genre)
    .maybeSingle();

  if (!dbGenre) {
    const { data: newG } = await supabaseServer
      .from('genres')
      .insert({ name: genre })
      .select('id')
      .single();
    dbGenre = newG;
  }

  if (dbGenre?.id) {
    await supabaseServer
      .from('film_genres')
      .upsert({ film_id: filmId, genre_id: dbGenre.id }, { onConflict: 'film_id,genre_id', ignoreDuplicates: true });
  }
}
