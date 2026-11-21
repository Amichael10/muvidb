import { supabase } from './supabase.js';
import { extractInstagramMedia, cleanInstagramUrl } from './instagram_downloader.js';
import { extractFacebookMedia, cleanFacebookUrl } from './facebook_downloader.js';
import { extractThreadsMedia, isThreadsUrl } from './threads_downloader.js';
import { resolveCaptionMentionsDetailed, resolveHandlesToRealNames } from './instagram_name_resolver.js';
import { generateAIContent, generateAIVisionContent, parseJSON } from './ai_service.js';
import { attachGenresBatch } from './film_enrichment.js';

export interface IntakeMediaItem {
  url: string;
  type: 'image' | 'video';
  isPrimary?: boolean;
}

export interface IntakeOcrResult {
  rawText: string;
  cast: Array<{ name: string; character_name?: string }>;
  crew: Array<{ role: string; name: string }>;
}

export interface StructuredFilmSuggestion {
  title: string;
  year: number | null;
  release_date: string | null;
  synopsis: string;
  genres: string[];
  runtime_minutes: number | null;
  director: string | null;
  cast: Array<{ name: string; character_name?: string }>;
  platform: string | null;
  content_type: 'movie' | 'series';
  poster_url?: string | null;
  backdrop_url?: string | null;
}

export interface StructuredPlaySuggestion {
  title: string;
  venue: string | null;
  city: string;
  country: string;
  run_start_date: string | null;
  run_end_date: string | null;
  performance_time: string | null;
  playwright: string | null;
  director: string | null;
  producer: string | null;
  genre: string | null;
  synopsis: string;
  status: 'upcoming' | 'currently_running' | 'archived';
  source_url?: string | null;
  poster_url?: string | null;
}

export interface StructuredReviewSuggestion {
  film_title: string;
  film_id?: string | null;
  play_id?: string | null;
  critic_name: string;
  publication: string | null;
  quote: string;
  rating: number | null;
  rating_scale: number;
  review_url: string | null;
}

export interface StructuredSocialSuggestion {
  headline: string;
  instagram_caption: string;
  facebook_caption: string;
  threads_post: string;
}

export interface SocialIntakeResult {
  success: boolean;
  platform: 'instagram' | 'facebook' | 'threads' | 'youtube' | 'manual';
  sourceUrl: string;
  caption: string;
  authorName: string | null;
  authorUsername: string | null;
  media: IntakeMediaItem[];
  mentions: any[];
  ocr: IntakeOcrResult | null;
  suggestions: {
    film: StructuredFilmSuggestion;
    play: StructuredPlaySuggestion;
    review: StructuredReviewSuggestion;
    social: StructuredSocialSuggestion;
  };
}

function cleanString(val: any, max = 5000): string {
  if (typeof val !== 'string') return '';
  return val.trim().slice(0, max);
}

function slugify(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 90) || `entry-${Date.now()}`;
}

async function uniqueSlug(table: 'films' | 'plays', baseName: string, year?: number | null): Promise<string> {
  const base = slugify(`${baseName}${year ? `-${year}` : ''}`);
  let candidate = base;
  for (let suffix = 2; suffix < 60; suffix += 1) {
    const { data } = await supabase.from(table).select('id').eq('slug', candidate).maybeSingle();
    if (!data) return candidate;
    candidate = `${base}-${suffix}`;
  }
  return `${base}-${Date.now()}`;
}

/**
 * Extracts media, caption, mentions, and structured candidates from any social URL or manual input.
 */
export async function extractSocialIntake(input: {
  url?: string;
  caption?: string;
  images?: string[];
  runOcr?: boolean;
}): Promise<SocialIntakeResult> {
  const rawUrl = (input.url || '').trim();
  let platform: SocialIntakeResult['platform'] = 'manual';
  let caption = (input.caption || '').trim();
  let authorName: string | null = null;
  let authorUsername: string | null = null;
  const mediaItems: IntakeMediaItem[] = [];

  // 1. Process URL if provided
  if (rawUrl) {
    if (/instagram\.com/i.test(rawUrl)) {
      platform = 'instagram';
      try {
        const ig = await extractInstagramMedia(rawUrl);
        if (ig.caption && !caption) caption = ig.caption;
        authorName = ig.authorName;
        authorUsername = ig.authorUsername;

        if (Array.isArray(ig.slides) && ig.slides.length) {
          let firstImageMarked = false;
          ig.slides.forEach((slide) => {
            if (slide.type === 'image') {
              mediaItems.push({ url: slide.url, type: 'image', isPrimary: !firstImageMarked });
              firstImageMarked = true;
            } else {
              mediaItems.push({ url: slide.url, type: 'video' });
            }
          });
        } else if (Array.isArray(ig.images) && ig.images.length) {
          ig.images.forEach((img, idx) => {
            mediaItems.push({ url: img, type: 'image', isPrimary: idx === 0 });
          });
          if (ig.videoUrl) {
            mediaItems.push({ url: ig.videoUrl, type: 'video' });
          }
        } else {
          if (ig.imageUrl) {
            mediaItems.push({ url: ig.imageUrl, type: 'image', isPrimary: true });
          }
          if (ig.videoUrl) {
            mediaItems.push({ url: ig.videoUrl, type: 'video' });
          }
        }
      } catch (err: any) {
        console.warn('[social_intake_engine] Instagram extraction error:', err.message);
      }
    } else if (/facebook\.com|fb\.watch/i.test(rawUrl)) {
      platform = 'facebook';
      try {
        const fb = await extractFacebookMedia(rawUrl);
        if (fb.caption && !caption) caption = fb.caption;
        authorName = fb.authorName;
        if (fb.imageUrl) mediaItems.push({ url: fb.imageUrl, type: 'image', isPrimary: true });
        if (fb.videoUrl) mediaItems.push({ url: fb.videoUrl, type: 'video' });
      } catch (err: any) {
        console.warn('[social_intake_engine] Facebook extraction error:', err.message);
      }
    } else if (isThreadsUrl(rawUrl)) {
      platform = 'threads';
      try {
        const th = await extractThreadsMedia(rawUrl);
        if (th.caption && !caption) caption = th.caption;
        authorName = th.authorName;
        authorUsername = th.authorUsername;
        if (th.imageUrl) mediaItems.push({ url: th.imageUrl, type: 'image', isPrimary: true });
        if (th.videoUrl) mediaItems.push({ url: th.videoUrl, type: 'video' });
      } catch (err: any) {
        console.warn('[social_intake_engine] Threads extraction error:', err.message);
      }
    } else if (/youtu(?:\.be|be\.com)/i.test(rawUrl)) {
      platform = 'youtube';
      try {
        const oembedRes = await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(rawUrl)}&format=json`);
        if (oembedRes.ok) {
          const ytData = await oembedRes.json();
          if (!caption) caption = ytData.title || '';
          authorName = ytData.author_name || 'YouTube';
          if (ytData.thumbnail_url) {
            mediaItems.push({ url: ytData.thumbnail_url, type: 'image', isPrimary: true });
          }
        }
      } catch (err: any) {
        console.warn('[social_intake_engine] YouTube extraction error:', err.message);
      }
    }
  }

  // 2. Add manual images if provided
  if (Array.isArray(input.images)) {
    for (const img of input.images) {
      if (img && typeof img === 'string' && !mediaItems.some(m => m.url === img)) {
        mediaItems.push({ url: img, type: 'image', isPrimary: mediaItems.length === 0 });
      }
    }
  }

  // Ensure at least one primary item exists if we have any media
  if (mediaItems.length > 0 && !mediaItems.some(m => m.isPrimary)) {
    mediaItems[0].isPrimary = true;
  }

  // 3. Resolve all @mentions in caption
  const mentions = await resolveCaptionMentionsDetailed(caption);
  const resolvedNameMap: Record<string, string> = {};
  for (const m of mentions) {
    resolvedNameMap[m.handle.toLowerCase()] = m.resolvedName;
    resolvedNameMap[m.cleanHandle.toLowerCase()] = m.resolvedName;
  }

  // 4. Optional OCR on primary image
  let ocrResult: IntakeOcrResult | null = null;
  const primaryImg = mediaItems.find(m => m.type === 'image' && m.isPrimary)?.url || mediaItems.find(m => m.type === 'image')?.url;
  if (input.runOcr && primaryImg) {
    try {
      ocrResult = await runIntakeOcr({ imageUrl: primaryImg });
    } catch (ocrErr: any) {
      console.warn('[social_intake_engine] OCR on primary image error:', ocrErr.message);
    }
  }

  // 5. AI structured extraction for all destinations
  const contextLines = [
    `Caption: ${caption || 'No caption provided'}`,
    authorName ? `Author: ${authorName}` : '',
    rawUrl ? `Source URL: ${rawUrl}` : '',
    mentions.length ? `Detected Mentions:\n${mentions.map(m => `- ${m.handle} -> "${m.resolvedName}" (Role: ${m.primaryRole || 'Talent'})`).join('\n')}` : '',
    ocrResult?.rawText ? `Poster Billing Block OCR Text:\n${ocrResult.rawText}` : '',
  ].filter(Boolean).join('\n\n');

  const prompt = `You are the lead Nollywood and African cinema & theatre archivist for MuviDB.
Analyze the following social post content and extract clean, structured candidate entities for four destinations: Film, Stage Play, Critic Review, and Social Post.

${contextLines}

CRITICAL RULES:
1. RESOLVE @HANDLES: Whenever an actor, director, or playwright is mentioned with an '@' handle (e.g. @deyemitheactor, @iniedo, @timini), you MUST output their real full name (e.g. "Deyemi Okanlawon", "Ini Edo", "Timini Egbuson"). Never output '@' handles in cast, director, or playwright fields.
2. TITLE: Clean movie/play titles (remove hashtag signs '#', 'OUT NOW', 'CINEMA RELEASE', etc.).
3. GENRES: Return 2-4 standard cinematic genres (e.g. ["Drama", "Comedy", "Thriller", "Action", "Romance"]).
4. SYNOPSIS: Write an engaging, well-written synopsis (at least 2-3 sentences).
5. CAST: In the film section, return an array of objects: [{"name": "Actor Full Name", "character_name": "Character Name if known or null"}].
6. CRITIC REVIEW: If the post is a review or contains a review quote and rating (e.g. 4/5 stars or 8/10), extract the quote, rating, scale, and critic name.

Return ONLY a single valid JSON object strictly matching this schema:
{
  "film": {
    "title": "Clean Film Title",
    "year": 2026,
    "release_date": "YYYY-MM-DD or null",
    "synopsis": "Engaging synopsis",
    "genres": ["Drama", "Thriller"],
    "runtime_minutes": null,
    "director": "Director Full Name or null",
    "cast": [
      { "name": "Actor Real Name", "character_name": "Character Name or null" }
    ],
    "platform": "Cinema|Prime Video|Netflix|YouTube|null",
    "content_type": "movie"
  },
  "play": {
    "title": "Clean Stage Play Title",
    "venue": "Venue name or null",
    "city": "Lagos",
    "country": "Nigeria",
    "run_start_date": "YYYY-MM-DD or null",
    "run_end_date": "YYYY-MM-DD or null",
    "performance_time": "Time or null (e.g. 3:00 PM & 7:00 PM)",
    "playwright": "Playwright Real Name or null",
    "director": "Director Real Name or null",
    "producer": "Producer Real Name or null",
    "genre": "Drama|Musical|Comedy|Folklore|null",
    "synopsis": "Stage play synopsis or story description",
    "status": "upcoming"
  },
  "review": {
    "film_title": "Film or Play Title",
    "critic_name": "Critic or Channel Name",
    "publication": "Publication or Platform Name",
    "quote": "Memorable review quote",
    "rating": 8.0,
    "rating_scale": 10,
    "review_url": "${rawUrl}"
  },
  "social": {
    "headline": "Short punchy social headline",
    "instagram_caption": "Instagram caption formatted with 2-3 hashtags",
    "facebook_caption": "Facebook post caption",
    "threads_post": "Threads post text"
  }
}`;

  let suggestions: any = null;
  try {
    const aiRes = await generateAIContent(prompt, { preferredProvider: 'groq' });
    suggestions = parseJSON(aiRes.text);
  } catch (err: any) {
    console.warn('[social_intake_engine] AI generation error:', err.message);
  }

  // Fallback defaults if AI failed or missed fields
  const currentYear = new Date().getFullYear();
  const defaultFilm: StructuredFilmSuggestion = {
    title: suggestions?.film?.title || cleanString(caption.split('\n')[0], 120) || 'Untitled Film',
    year: suggestions?.film?.year || currentYear,
    release_date: suggestions?.film?.release_date || null,
    synopsis: suggestions?.film?.synopsis || caption || 'No synopsis provided.',
    genres: Array.isArray(suggestions?.film?.genres) && suggestions.film.genres.length ? suggestions.film.genres : ['Drama'],
    runtime_minutes: suggestions?.film?.runtime_minutes || null,
    director: suggestions?.film?.director || null,
    cast: Array.isArray(suggestions?.film?.cast) ? suggestions.film.cast : [],
    platform: suggestions?.film?.platform || 'Cinema',
    content_type: suggestions?.film?.content_type === 'series' ? 'series' : 'movie',
    poster_url: primaryImg || null,
    backdrop_url: mediaItems.find(m => m.type === 'image' && m.url !== primaryImg)?.url || null,
  };

  const defaultPlay: StructuredPlaySuggestion = {
    title: suggestions?.play?.title || cleanString(caption.split('\n')[0], 120) || 'Untitled Stage Play',
    venue: suggestions?.play?.venue || 'Terra Kulture, Lagos',
    city: suggestions?.play?.city || 'Lagos',
    country: suggestions?.play?.country || 'Nigeria',
    run_start_date: suggestions?.play?.run_start_date || null,
    run_end_date: suggestions?.play?.run_end_date || null,
    performance_time: suggestions?.play?.performance_time || null,
    playwright: suggestions?.play?.playwright || null,
    director: suggestions?.play?.director || null,
    producer: suggestions?.play?.producer || null,
    genre: suggestions?.play?.genre || 'Drama',
    synopsis: suggestions?.play?.synopsis || caption || 'Stage production.',
    status: suggestions?.play?.status || 'upcoming',
    source_url: rawUrl || null,
    poster_url: primaryImg || null,
  };

  const defaultReview: StructuredReviewSuggestion = {
    film_title: suggestions?.review?.film_title || defaultFilm.title,
    critic_name: suggestions?.review?.critic_name || authorName || 'MuviDB Reviewer',
    publication: suggestions?.review?.publication || authorUsername || 'Social Review',
    quote: suggestions?.review?.quote || caption.slice(0, 300),
    rating: suggestions?.review?.rating ?? null,
    rating_scale: suggestions?.review?.rating_scale || 10,
    review_url: rawUrl || null,
  };

  const defaultSocial: StructuredSocialSuggestion = {
    headline: suggestions?.social?.headline || defaultFilm.title,
    instagram_caption: suggestions?.social?.instagram_caption || caption,
    facebook_caption: suggestions?.social?.facebook_caption || caption,
    threads_post: suggestions?.social?.threads_post || caption.slice(0, 480),
  };

  // Ensure handles in cast/director are resolved
  if (Array.isArray(defaultFilm.cast)) {
    defaultFilm.cast = defaultFilm.cast.map(c => {
      const name = typeof c === 'string' ? c : c.name;
      const charName = typeof c === 'object' ? c.character_name : null;
      const clean = name ? name.trim() : '';
      const lower = clean.replace(/^@+/, '').toLowerCase();
      const resolved = resolvedNameMap[lower] || clean.replace(/^@+/, '');
      return { name: resolved, character_name: charName || null };
    });
  }

  if (defaultFilm.director && defaultFilm.director.startsWith('@')) {
    const lower = defaultFilm.director.replace(/^@+/, '').toLowerCase();
    defaultFilm.director = resolvedNameMap[lower] || defaultFilm.director.replace(/^@+/, '');
  }

  return {
    success: true,
    platform,
    sourceUrl: rawUrl,
    caption,
    authorName,
    authorUsername,
    media: mediaItems,
    mentions,
    ocr: ocrResult,
    suggestions: {
      film: defaultFilm,
      play: defaultPlay,
      review: defaultReview,
      social: defaultSocial,
    },
  };
}

/**
 * Runs Vision AI OCR on an image to extract high-accuracy billing block credits.
 */
export async function runIntakeOcr(input: {
  imageUrl?: string;
  imageBase64?: string;
  mimeType?: string;
}): Promise<IntakeOcrResult> {
  let base64Data = '';
  let mimeType = input.mimeType || 'image/jpeg';

  if (input.imageBase64) {
    const match = input.imageBase64.match(/^data:(image\/[a-zA-Z0-9.-]+);base64,(.+)$/);
    if (match) {
      mimeType = match[1];
      base64Data = match[2];
    } else {
      base64Data = input.imageBase64.replace(/^data:[^;]+;base64,/, '');
    }
  } else if (input.imageUrl) {
    const res = await fetch(input.imageUrl, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) throw new Error(`Could not fetch image for OCR (${res.status})`);
    const arrayBuffer = await res.arrayBuffer();
    base64Data = Buffer.from(arrayBuffer).toString('base64');
    const headerMime = res.headers.get('content-type');
    if (headerMime && headerMime.startsWith('image/')) mimeType = headerMime;
  } else {
    throw new Error('Either imageUrl or imageBase64 is required for OCR.');
  }

  const prompt = `You are an expert Nollywood film & stage play billing-block OCR scanner.
Analyze the uploaded image (movie poster, flyer, or credit slide) and extract the full billing block.

RULES:
1. Extract ALL Cast Members (actors) and their character names.
2. If dots or hyphens separate names (e.g. "Murphy Afolabi..........Oba"), cleanly split into Actor Name ("Murphy Afolabi") and Character Name ("Oba").
3. Standardize Crew roles: "Director", "Producer", "Executive Producer", "Screenplay", "Director of Photography", "Editor", "Music", "Costume", "Makeup", "Production Company".
4. Clean names to Title Case. Remove stray artifacts.

Return ONLY a single valid JSON object strictly matching:
{
  "rawText": "Complete readable text from the billing block or flyer",
  "cast": [
    { "name": "Actor Full Name", "character_name": "Character Name or null" }
  ],
  "crew": [
    { "role": "Director|Producer|Screenplay|DOP|etc", "name": "Crew Full Name" }
  ]
}`;

  const { text } = await generateAIVisionContent(prompt, base64Data, mimeType);
  const parsed = parseJSON(text);

  return {
    rawText: parsed?.rawText || text || '',
    cast: Array.isArray(parsed?.cast) ? parsed.cast : [],
    crew: Array.isArray(parsed?.crew) ? parsed.crew : [],
  };
}

/**
 * Publishes/creates the entity in Supabase with zero duplicate issues.
 */
export async function publishIntakeEntity(input: {
  entityType: 'film' | 'play' | 'critic_review' | 'social_post';
  payload: Record<string, any>;
  actorId: string;
}): Promise<Record<string, any>> {
  const { entityType, payload, actorId } = input;

  if (entityType === 'film') {
    const title = cleanString(payload.title, 250);
    const synopsis = cleanString(payload.synopsis, 8000);
    if (!title) throw Object.assign(new Error('Film title is required.'), { status: 400 });
    if (!synopsis || synopsis.length < 25) {
      throw Object.assign(new Error('Please provide a proper synopsis of at least 25 characters.'), { status: 400 });
    }

    const year = payload.year ? Number(payload.year) : new Date().getFullYear();
    const runtime = payload.runtime_minutes ? Number(payload.runtime_minutes) : null;
    const genres: string[] = Array.isArray(payload.genres)
      ? payload.genres.map((g: any) => cleanString(g, 50)).filter(Boolean)
      : String(payload.genres || '').split(',').map(s => s.trim()).filter(Boolean);

    // Check for exact duplicate
    const { data: existingFilms } = await supabase
      .from('films')
      .select('id, title, year, slug')
      .ilike('title', title)
      .limit(5);

    const exactMatch = (existingFilms || []).find(
      f => f.title.trim().toLowerCase() === title.toLowerCase() && (!year || !f.year || f.year === year)
    );

    let filmId: string;
    let filmSlug: string;

    // Auto-mirror external poster and backdrop images to Supabase storage
    let posterUrl = cleanString(payload.poster_url, 2000) || null;
    let backdropUrl = cleanString(payload.backdrop_url, 2000) || null;

    if (posterUrl && !posterUrl.includes('supabase.co')) {
      try {
        const { mirrorIfExternal } = await import('./image_mirror.js');
        const mirrored = await mirrorIfExternal(posterUrl, 'posters', `poster-${slugify(title)}-${Date.now()}`);
        if (mirrored) posterUrl = mirrored;
      } catch (err: any) {
        console.warn('[social_intake_engine] Poster mirror warning:', err?.message);
      }
    }
    if (backdropUrl && !backdropUrl.includes('supabase.co')) {
      try {
        const { mirrorIfExternal } = await import('./image_mirror.js');
        const mirrored = await mirrorIfExternal(backdropUrl, 'backdrops', `backdrop-${slugify(title)}-${Date.now()}`);
        if (mirrored) backdropUrl = mirrored;
      } catch (err: any) {
        console.warn('[social_intake_engine] Backdrop mirror warning:', err?.message);
      }
    }

    const filmData: Record<string, any> = {
      title,
      synopsis,
      year,
      runtime_minutes: runtime,
      duration: runtime,
      genres,
      poster_url: posterUrl,
      backdrop_url: backdropUrl,
      release_date: cleanString(payload.release_date, 30) || null,
      status: ['released', 'upcoming', 'announced', 'filming', 'in_production', 'post-production'].includes(payload.status)
        ? payload.status
        : 'upcoming',
      content_type: cleanString(payload.content_type, 50) || 'movie',
      countries: Array.isArray(payload.countries) ? payload.countries.slice(0, 5) : ['Nigeria'],
      source: 'admin_intake',
      trailer_external_url: cleanString(payload.trailer_external_url, 2000) || null,
      is_published: true,
      needs_review: false,
      updated_at: new Date().toISOString(),
    };

    if (payload.update_existing_film_id || exactMatch) {
      filmId = payload.update_existing_film_id || exactMatch!.id;
      filmSlug = exactMatch?.slug || slugify(title);
      const { error: updateError } = await supabase
        .from('films')
        .update(filmData)
        .eq('id', filmId);
      if (updateError) throw updateError;
    } else {
      filmSlug = await uniqueSlug('films', title, year);
      const { data: createdFilm, error: createError } = await supabase
        .from('films')
        .insert({ ...filmData, slug: filmSlug })
        .select('id, slug')
        .single();
      if (createError) throw createError;
      filmId = createdFilm.id;
      filmSlug = createdFilm.slug;
    }

    // Attach genres
    if (genres.length > 0) {
      try {
        await attachGenresBatch([{ filmId, genres }]);
      } catch (gErr: any) {
        console.warn('[social_intake_engine] attachGenresBatch warning:', gErr?.message);
      }
    }

    // Handle Director & Cast Credits with Zero Duplicate Guarantee
    const creditsToInsert: Array<{
      film_id: string;
      person_id: string;
      role: string;
      character_name: string | null;
      billing_order: number;
    }> = [];

    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    // Director
    if (payload.director && typeof payload.director === 'string' && payload.director.trim()) {
      const dirName = payload.director.replace(/^@+/, '').trim();
      let dirId: string | null =
        typeof payload.director_person_id === 'string' && UUID_RE.test(payload.director_person_id.trim())
          ? payload.director_person_id.trim()
          : null;
      if (!dirId) {
        const { data: upsertedDirId } = await supabase.rpc('upsert_person_by_name', {
          p_name: dirName,
          p_extra: { nationality: 'Nigerian', source: 'admin_intake' },
        });
        dirId = (upsertedDirId as unknown as string) || null;
      }
      if (dirId) {
        creditsToInsert.push({
          film_id: filmId,
          person_id: dirId,
          role: 'director',
          character_name: null,
          billing_order: 0,
        });
      }
    }

    // Cast
    if (Array.isArray(payload.cast)) {
      let order = 1;
      for (const actor of payload.cast) {
        const actorName = typeof actor === 'string' ? actor.trim() : (actor?.name || '').trim();
        if (!actorName) continue;
        const cleanName = actorName.replace(/^@+/, '').trim();
        const characterName = typeof actor === 'object' && actor.character_name ? String(actor.character_name).trim() : null;
        let pId: string | null =
          typeof actor === 'object' && typeof actor?.person_id === 'string' && UUID_RE.test(actor.person_id.trim())
            ? actor.person_id.trim()
            : null;

        if (!pId) {
          const { data: upsertedId } = await supabase.rpc('upsert_person_by_name', {
            p_name: cleanName,
            p_extra: { nationality: 'Nigerian', source: 'admin_intake' },
          });
          pId = (upsertedId as unknown as string) || null;
        }

        if (pId) {
          creditsToInsert.push({
            film_id: filmId,
            person_id: pId,
            role: 'actor',
            character_name: characterName,
            billing_order: order++,
          });
        }
      }
    }

    // Crew (Producers, Writers, Cinematographers, Editors, Sound, etc.)
    if (Array.isArray(payload.crew)) {
      for (const crewMember of payload.crew) {
        const crewName = typeof crewMember === 'string' ? crewMember.trim() : (crewMember?.name || '').trim();
        if (!crewName) continue;
        const cleanName = crewName.replace(/^@+/, '').trim();
        const role = typeof crewMember === 'object' && crewMember?.role ? String(crewMember.role).trim().toLowerCase() : 'crew';
        let pId: string | null =
          typeof crewMember === 'object' && typeof crewMember?.person_id === 'string' && UUID_RE.test(crewMember.person_id.trim())
            ? crewMember.person_id.trim()
            : null;

        if (!pId) {
          const { data: upsertedId } = await supabase.rpc('upsert_person_by_name', {
            p_name: cleanName,
            p_extra: { nationality: 'Nigerian', source: 'admin_intake' },
          });
          pId = (upsertedId as unknown as string) || null;
        }

        if (pId) {
          creditsToInsert.push({
            film_id: filmId,
            person_id: pId,
            role: role || 'crew',
            character_name: null,
            billing_order: 0,
          });
        }
      }
    }

    // Insert new credits & update existing actor rows in-place (Zero-Duplicate Actor Guarantee)
    if (creditsToInsert.length > 0) {
      const { data: existingCredits } = await supabase
        .from('credits')
        .select('id, person_id, role, character_name')
        .eq('film_id', filmId);

      const existingMap = new Map<string, { id: string; character_name: string | null }>();
      for (const c of existingCredits || []) {
        existingMap.set(`${c.person_id}-${c.role}`, { id: c.id, character_name: c.character_name });
      }

      const seenBatch = new Set<string>();
      const newCredits: typeof creditsToInsert = [];

      for (const c of creditsToInsert) {
        const key = `${c.person_id}-${c.role}`;
        if (seenBatch.has(key)) continue;
        seenBatch.add(key);

        const existing = existingMap.get(key);
        if (existing) {
          // Enrich existing row in-place if a clearer character name is supplied
          if (c.character_name && !existing.character_name) {
            await supabase
              .from('credits')
              .update({ character_name: c.character_name })
              .eq('id', existing.id);
          }
        } else {
          newCredits.push(c);
        }
      }

      if (newCredits.length > 0) {
        const { error: credErr } = await supabase.from('credits').insert(newCredits as any);
        if (credErr) console.warn('[social_intake_engine] Credits insert warning:', credErr.message);
      }
    }

    return {
      success: true,
      entityType: 'film',
      id: filmId,
      slug: filmSlug,
      title,
      viewUrl: `/film/${filmSlug}`,
      adminUrl: `/admin/films?search=${encodeURIComponent(title)}`,
    };
  }

  if (entityType === 'play') {
    const title = cleanString(payload.title, 250);
    if (!title) throw Object.assign(new Error('Stage play title is required.'), { status: 400 });

    const year = payload.year ? Number(payload.year) : new Date().getFullYear();
    const playSlug = payload.slug || (await uniqueSlug('plays', title, year));

    let posterUrl = cleanString(payload.poster_url, 2000) || null;
    let bannerUrl = cleanString(payload.banner_url, 2000) || null;

    if (posterUrl && !posterUrl.includes('supabase.co')) {
      try {
        const { mirrorIfExternal } = await import('./image_mirror.js');
        const mirrored = await mirrorIfExternal(posterUrl, 'posters', `play-${playSlug}-${Date.now()}`);
        if (mirrored) posterUrl = mirrored;
      } catch (err: any) {
        console.warn('[social_intake_engine] Play poster mirror warning:', err?.message);
      }
    }
    if (bannerUrl && !bannerUrl.includes('supabase.co')) {
      try {
        const { mirrorIfExternal } = await import('./image_mirror.js');
        const mirrored = await mirrorIfExternal(bannerUrl, 'backdrops', `play-banner-${playSlug}-${Date.now()}`);
        if (mirrored) bannerUrl = mirrored;
      } catch (err: any) {
        console.warn('[social_intake_engine] Play banner mirror warning:', err?.message);
      }
    }

    const playData: Record<string, any> = {
      title,
      slug: playSlug,
      playwright: cleanString(payload.playwright, 250) || null,
      director: cleanString(payload.director, 250) || null,
      producer: cleanString(payload.producer, 250) || null,
      venue: cleanString(payload.venue, 250) || null,
      city: cleanString(payload.city, 100) || 'Lagos',
      country: cleanString(payload.country, 100) || 'Nigeria',
      poster_url: posterUrl,
      banner_url: bannerUrl,
      synopsis: cleanString(payload.synopsis, 8000) || 'Stage production.',
      genre: cleanString(payload.genre, 100) || 'Drama',
      year,
      run_start_date: cleanString(payload.run_start_date, 30) || null,
      run_end_date: cleanString(payload.run_end_date, 30) || null,
      performance_time: cleanString(payload.performance_time, 100) || null,
      source_url: cleanString(payload.source_url, 2000) || null,
      status: ['upcoming', 'currently_running', 'archived'].includes(payload.status) ? payload.status : 'upcoming',
      updated_at: new Date().toISOString(),
    };

    let playId: string;
    if (payload.id) {
      const { data: updated, error: updErr } = await supabase
        .from('plays')
        .update(playData)
        .eq('id', payload.id)
        .select('id')
        .single();
      if (updErr) throw updErr;
      playId = updated.id;
    } else {
      const { data: created, error: crtErr } = await supabase
        .from('plays')
        .upsert(playData, { onConflict: 'slug' })
        .select('id')
        .single();
      if (crtErr) throw crtErr;
      playId = created.id;
    }

    // Insert into stage_credits for cast & crew
    const stageCreditsToInsert: Array<{
      play_id: string;
      person_id: string;
      role: string;
      character_name: string | null;
      billing_order: number;
    }> = [];

    const STAGE_UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    // Cast
    if (Array.isArray(payload.cast)) {
      let order = 1;
      for (const actor of payload.cast) {
        const actorName = typeof actor === 'string' ? actor.trim() : (actor?.name || '').trim();
        if (!actorName) continue;
        const cleanName = actorName.replace(/^@+/, '').trim();
        const characterName = typeof actor === 'object' && actor.character_name ? String(actor.character_name).trim() : null;
        let pId: string | null =
          typeof actor === 'object' && typeof actor?.person_id === 'string' && STAGE_UUID_RE.test(actor.person_id.trim())
            ? actor.person_id.trim()
            : null;

        if (!pId) {
          const { data: upsertedId } = await supabase.rpc('upsert_person_by_name', {
            p_name: cleanName,
            p_extra: { nationality: 'Nigerian', source: 'admin_intake' },
          });
          pId = (upsertedId as unknown as string) || null;
        }

        if (pId) {
          stageCreditsToInsert.push({
            play_id: playId,
            person_id: pId,
            role: 'actor',
            character_name: characterName,
            billing_order: order++,
          });
        }
      }
    }

    // Crew
    if (Array.isArray(payload.crew)) {
      for (const crewMember of payload.crew) {
        const crewName = typeof crewMember === 'string' ? crewMember.trim() : (crewMember?.name || '').trim();
        if (!crewName) continue;
        const cleanName = crewName.replace(/^@+/, '').trim();
        const role = typeof crewMember === 'object' && crewMember?.role ? String(crewMember.role).trim().toLowerCase() : 'crew';
        let pId: string | null =
          typeof crewMember === 'object' && typeof crewMember?.person_id === 'string' && STAGE_UUID_RE.test(crewMember.person_id.trim())
            ? crewMember.person_id.trim()
            : null;

        if (!pId) {
          const { data: upsertedId } = await supabase.rpc('upsert_person_by_name', {
            p_name: cleanName,
            p_extra: { nationality: 'Nigerian', source: 'admin_intake' },
          });
          pId = (upsertedId as unknown as string) || null;
        }

        if (pId) {
          stageCreditsToInsert.push({
            play_id: playId,
            person_id: pId,
            role: role || 'crew',
            character_name: null,
            billing_order: 0,
          });
        }
      }
    }

    if (stageCreditsToInsert.length > 0) {
      const { data: existingCredits } = await supabase
        .from('stage_credits')
        .select('id, person_id, role, character_name')
        .eq('play_id', playId);

      const existingMap = new Map<string, { id: string; character_name: string | null }>();
      for (const c of existingCredits || []) {
        existingMap.set(`${c.person_id}-${c.role}`, { id: c.id, character_name: c.character_name });
      }

      const seenBatch = new Set<string>();
      const newCredits: typeof stageCreditsToInsert = [];

      for (const c of stageCreditsToInsert) {
        const key = `${c.person_id}-${c.role}`;
        if (seenBatch.has(key)) continue;
        seenBatch.add(key);

        const existing = existingMap.get(key);
        if (existing) {
          if (c.character_name && !existing.character_name) {
            await supabase
              .from('stage_credits')
              .update({ character_name: c.character_name })
              .eq('id', existing.id);
          }
        } else {
          newCredits.push(c);
        }
      }

      if (newCredits.length > 0) {
        const { error: credErr } = await supabase.from('stage_credits').insert(newCredits as any);
        if (credErr) console.warn('[social_intake_engine] Stage credits insert warning:', credErr.message);
      }
    }

    return {
      success: true,
      entityType: 'play',
      id: playId,
      slug: playSlug,
      title,
      viewUrl: `/theatre/${playSlug}`,
      adminUrl: `/admin/plays`,
    };
  }

  if (entityType === 'critic_review') {
    const quote = cleanString(payload.quote, 5000);
    const criticName = cleanString(payload.critic_name, 200);
    const filmId = cleanString(payload.film_id, 80) || null;
    const playId = cleanString(payload.play_id, 80) || null;

    if (!quote) throw Object.assign(new Error('Review quote is required.'), { status: 400 });
    if (!criticName && !payload.is_anonymous) throw Object.assign(new Error('Critic name is required.'), { status: 400 });
    if (!filmId && !playId && !payload.film_title) {
      throw Object.assign(new Error('Review must be linked to a film or stage play.'), { status: 400 });
    }

    let targetFilmId = filmId;
    if (!targetFilmId && !playId && payload.film_title) {
      const { data: matched } = await supabase
        .from('films')
        .select('id')
        .ilike('title', payload.film_title)
        .limit(1)
        .maybeSingle();
      if (matched?.id) targetFilmId = matched.id;
    }

    const rawRating = payload.rating != null ? Number(payload.rating) : null;
    const ratingScale = payload.rating_scale ? Number(payload.rating_scale) : 10;
    const rating = rawRating != null ? Math.round(Math.min(10, (rawRating / ratingScale) * 10) * 10) / 10 : null;

    const { data: createdReview, error: revErr } = await supabase
      .from('critic_reviews')
      .insert({
        film_id: targetFilmId,
        play_id: playId,
        critic_name: payload.is_anonymous ? null : criticName,
        critic_title: cleanString(payload.publication || payload.critic_title, 250) || null,
        quote,
        rating,
        review_url: cleanString(payload.review_url, 2000) || null,
        is_anonymous: Boolean(payload.is_anonymous),
        is_featured: payload.is_featured !== false,
      })
      .select('id')
      .single();

    if (revErr) throw revErr;

    return {
      success: true,
      entityType: 'critic_review',
      id: createdReview.id,
      adminUrl: `/admin/critics`,
    };
  }

  if (entityType === 'social_post') {
    const title = cleanString(payload.headline || payload.title, 200) || 'Admin Social Intake Post';
    const sourceSnapshot = {
      kind: 'admin_intake',
      capturedAt: new Date().toISOString(),
      title,
      description: cleanString(payload.caption || payload.description, 8000),
      sourceUrl: cleanString(payload.source_url, 2000),
      imageUrl: cleanString(payload.imageUrl || payload.poster_url, 2000),
    };

    const { data: contentItem, error: itemError } = await supabase
      .from('social_content_items')
      .insert({
        content_type: 'social_intake',
        title,
        source_entity_type: 'social_news_event',
        source_snapshot: sourceSnapshot,
        status: 'draft',
        generation_method: 'admin_intake',
        created_by: actorId || null,
      })
      .select('id')
      .single();

    if (itemError) throw itemError;

    // Attach asset if image exists
    let assetId: string | null = null;
    if (sourceSnapshot.imageUrl) {
      const { data: asset } = await supabase
        .from('social_assets')
        .insert({
          content_item_id: contentItem.id,
          format: 'portrait_4_5',
          storage_bucket: 'external',
          storage_path: sourceSnapshot.imageUrl,
          public_url: sourceSnapshot.imageUrl,
          mime_type: 'image/jpeg',
          width: 1080,
          height: 1350,
          file_size_bytes: 0,
        })
        .select('id')
        .maybeSingle();

      if (asset?.id) assetId = asset.id;
    }

    const captions = payload.captions || {};
    const platforms = ['instagram', 'facebook', 'threads'];
    const variants = platforms.map(platform => ({
      content_item_id: contentItem.id,
      platform,
      status: 'draft',
      caption: cleanString(captions[platform] || payload.caption, 2200),
      title: platform === 'facebook' ? title : null,
      hashtags: [],
      mentions: [],
      selected_asset_id: assetId,
      platform_options: {
        source_url: sourceSnapshot.sourceUrl || null,
      },
    }));

    await supabase.from('social_platform_variants').insert(variants);

    return {
      success: true,
      entityType: 'social_post',
      id: contentItem.id,
      title,
      adminUrl: `/admin/social`,
    };
  }

  throw Object.assign(new Error(`Unknown entity type: ${entityType}`), { status: 400 });
}
