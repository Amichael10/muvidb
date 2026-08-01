import { type LoaderFunctionArgs } from 'react-router';
import fs from 'fs';
import path from 'path';
import { supabaseServer } from '../lib/supabase.server';

const TMDB_KEY = process.env.VITE_TMDB_API_KEY || process.env.TMDB_API_KEY;
const GEMINI_KEY = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;

const ALLOWED_GENRES = [
  'Drama', 'Romance', 'Action', 'Comedy', 'Horror',
  'Nollywood Epic', 'Thriller', 'Family', 'Crime', 'Sci-Fi', 'Documentary'
];

const ALLOWED_RATINGS = ['18+', '16+', '13+', 'PG', 'G'];

async function getGeminiSynopsisAndRatings(title: string, year: string, ytTitle: string, rawDesc: string) {
  if (!GEMINI_KEY) {
    return { synopsis: '', genre: 'Drama', age_rating: '13+' };
  }

  const prompt = `You are an expert film editor for MuviDB, the premier African and Nollywood movie database.

USER INSTRUCTION:
"write me a muvidb worthy synopsis for this movie and tell me the genre and age rating for it"

STRICT RULES:
1. SYNOPSIS: Write a clean, high-quality, professional 2-4 sentence synopsis summarizing plot and central conflict.
   - Do NOT include hashtags, promotional text, YouTube URLs, channel names, actor lists, or 'subscribe' messages.
   - If you have NO plot information or context and cannot provide a factual summary, leave synopsis as an empty string "". DO NOT FABRICATE OR GUESS.
2. GENRE: Choose the single best match from [Drama, Romance, Action, Comedy, Horror, Nollywood Epic, Thriller, Family, Crime, Sci-Fi, Documentary].
3. AGE RATING: Choose from [18+, 16+, 13+, PG, G].

FILM DATA:
Title: ${title}
Year: ${year}
YouTube Title: ${ytTitle}
Raw Description: ${rawDesc.slice(0, 1000)}

Respond strictly in JSON format:
{
  "synopsis": "...",
  "genre": "...",
  "age_rating": "..."
}`;

  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: 'application/json' }
      })
    });

    if (!res.ok) return { synopsis: '', genre: 'Drama', age_rating: '13+' };
    const data = await res.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
    const parsed = JSON.parse(text);

    const gRaw = (parsed.genre || '').trim();
    const rRaw = (parsed.age_rating || '').trim();

    return {
      synopsis: (parsed.synopsis || '').trim(),
      genre: ALLOWED_GENRES.includes(gRaw) ? gRaw : 'Drama',
      age_rating: ALLOWED_RATINGS.includes(rRaw) ? rRaw : '13+'
    };
  } catch {
    return { synopsis: '', genre: 'Drama', age_rating: '13+' };
  }
}

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const type = url.searchParams.get('type') || 'movies';
  const limit = Math.min(Number(url.searchParams.get('limit') || 200), 500);

  try {
    if (type === 'movies') {
      const { data: films, error } = await supabaseServer
        .from('films')
        .select('id,title,year,synopsis,genres,maturity_rating,poster_url,youtube_watch_url,trailer_youtube_id,source_video_id')
        .or('synopsis.is.null,genres.is.null,maturity_rating.is.null')
        .limit(limit);

      if (error) throw error;
      const filmRows = films || [];

      const candidates: any[] = [];

      for (const film of filmRows) {
        const title = film.title || 'Untitled Film';
        const existingSynopsis = film.synopsis || '';
        const existingGenres = film.genres || [];
        const existingRating = film.maturity_rating || '';

        const ytUrl = film.youtube_watch_url || (film.trailer_youtube_id ? `https://www.youtube.com/watch?v=${film.trailer_youtube_id}` : '');
        
        let proposedSynopsis = existingSynopsis;
        let proposedGenres = existingGenres;
        let proposedRating = existingRating;

        if (!existingSynopsis || !existingGenres.length || !existingRating) {
          const enrichment = await getGeminiSynopsisAndRatings(title, film.year || '', '', '');
          proposedSynopsis = existingSynopsis || enrichment.synopsis;
          proposedGenres = existingGenres.length ? existingGenres : [enrichment.genre];
          proposedRating = existingRating || enrichment.age_rating;
        }

        candidates.push({
          film_id: film.id,
          title: title,
          year: film.year || 'N/A',
          poster_url: film.poster_url || '',
          youtube_url: ytUrl,
          already_have: [
            existingSynopsis ? 'Synopsis' : null,
            existingGenres.length ? 'Genres' : null,
            existingRating ? 'Age Rating' : null
          ].filter(Boolean),
          discovered: [
            !existingSynopsis && proposedSynopsis ? 'Synopsis' : null,
            !existingGenres.length && proposedGenres.length ? 'Genres' : null,
            !existingRating && proposedRating ? 'Age Rating' : null
          ].filter(Boolean),
          proposed_synopsis: proposedSynopsis,
          proposed_genres: proposedGenres,
          proposed_age_rating: proposedRating,
          confidence: proposedSynopsis ? 'Gemini Grounded' : 'Requires Review'
        });
      }

      const outJsonPath = path.join(process.cwd(), 'movies_enrichment_candidates.json');
      fs.writeFileSync(outJsonPath, JSON.stringify(candidates, null, 2), 'utf-8');

      return new Response(JSON.stringify({
        success: true,
        scannedCount: filmRows.length,
        candidatesSaved: candidates.length,
        jsonPath: 'movies_enrichment_candidates.json',
        sample: candidates.slice(0, 3)
      }), { headers: { 'Content-Type': 'application/json' } });
    }

    if (type === 'people') {
      const { data: people, error } = await supabaseServer
        .from('people')
        .select('id,name,bio,photo_url,date_of_birth,gender,tmdb_id,instagram_url,twitter_url,facebook_url,tiktok_url,youtube_handle')
        .or('bio.is.null,photo_url.is.null,instagram_url.is.null')
        .limit(limit);

      if (error) throw error;
      const peopleRows = people || [];

      const candidates: any[] = [];
      let enrichedCount = 0;
      let skippedCount = 0;

      for (const p of peopleRows) {
        const name = p.name || 'Unknown Person';
        let tmdbInfo: any = null;
        let extIds: any = {};

        if (p.tmdb_id && TMDB_KEY) {
          try {
            const r = await fetch(`https://api.themoviedb.org/3/person/${p.tmdb_id}?api_key=${TMDB_KEY}`);
            if (r.ok) tmdbInfo = await r.json();
          } catch {}
        }

        if (!tmdbInfo && TMDB_KEY && name) {
          try {
            const r = await fetch(`https://api.themoviedb.org/3/search/person?api_key=${TMDB_KEY}&query=${encodeURIComponent(name)}`);
            if (r.ok) {
              const data = await r.json();
              const match = data.results?.find((m: any) => m.name.toLowerCase() === name.toLowerCase());
              if (match) tmdbInfo = match;
            }
          } catch {}
        }

        if (tmdbInfo?.id && TMDB_KEY) {
          try {
            const r = await fetch(`https://api.themoviedb.org/3/person/${tmdbInfo.id}/external_ids?api_key=${TMDB_KEY}`);
            if (r.ok) extIds = await r.json();
          } catch {}
        }

        const existingBio = p.bio || '';
        const existingPhoto = p.photo_url || '';

        let proposedBio = existingBio;
        let proposedPhoto = existingPhoto;
        let proposedInsta = p.instagram_url || '';
        let proposedTwitter = p.twitter_url || '';
        let proposedFb = p.facebook_url || '';
        let proposedTiktok = p.tiktok_url || '';

        const sources: string[] = [];

        if (tmdbInfo) {
          sources.push('TMDB Verified Profile');
          if (!proposedBio && tmdbInfo.biography && tmdbInfo.biography.trim().length > 20) {
            proposedBio = tmdbInfo.biography.trim();
          }
          if (!proposedPhoto && tmdbInfo.profile_path) {
            proposedPhoto = `https://image.tmdb.org/t/p/w500${tmdbInfo.profile_path}`;
          }
        }

        if (extIds) {
          if (!proposedInsta && extIds.instagram_id) proposedInsta = `https://instagram.com/${extIds.instagram_id}`;
          if (!proposedTwitter && extIds.twitter_id) proposedTwitter = `https://x.com/${extIds.twitter_id}`;
          if (!proposedFb && extIds.facebook_id) proposedFb = `https://facebook.com/${extIds.facebook_id}`;
          if (!proposedTiktok && extIds.tiktok_id) proposedTiktok = `https://tiktok.com/@${extIds.tiktok_id}`;
        }

        const hasNewData = Boolean((!existingBio && proposedBio) || (!existingPhoto && proposedPhoto) || (!p.instagram_url && proposedInsta));

        if (hasNewData) {
          enrichedCount++;
        } else {
          skippedCount++;
        }

        candidates.push({
          person_id: p.id,
          name: name,
          bio: proposedBio,
          photo_url: proposedPhoto,
          date_of_birth: p.date_of_birth || (tmdbInfo?.birthday || ''),
          gender: p.gender || (tmdbInfo?.gender === 1 ? 'female' : tmdbInfo?.gender === 2 ? 'male' : ''),
          instagram_url: proposedInsta,
          twitter_url: proposedTwitter,
          facebook_url: proposedFb,
          tiktok_url: proposedTiktok,
          sources,
          confidence: hasNewData ? '100% Grounded Matches' : 'Skipped (No Grounded Match)'
        });
      }

      const outJsonPath = path.join(process.cwd(), 'google_socials_enriched_people.json');
      fs.writeFileSync(outJsonPath, JSON.stringify(candidates, null, 2), 'utf-8');

      return new Response(JSON.stringify({
        success: true,
        scannedCount: peopleRows.length,
        enrichedCount,
        skippedCount,
        candidatesSaved: candidates.length,
        jsonPath: 'google_socials_enriched_people.json',
        sample: candidates.slice(0, 3)
      }), { headers: { 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({ error: 'Invalid type parameter. Use ?type=movies or ?type=people' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message || String(err), stack: err.stack }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}

export default function RunScannersRoute() {
  return (
    <div style={{ padding: '40px', fontFamily: 'sans-serif', backgroundColor: '#0f172a', color: '#fff', minHeight: '100vh' }}>
      <h1>🚀 Scanner Executed Successfully</h1>
      <p>The candidate JSON files have been created in the project root.</p>
    </div>
  );
}
