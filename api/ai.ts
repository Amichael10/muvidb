import type { VercelRequest, VercelResponse } from '@vercel/node';
import { generateAIContent, parseJSON, generateAIVisionContent } from './_lib/ai_service.js';
import { supabase } from './_lib/supabase.js';
import { isValidAuth } from './_lib/auth.js';
import { searchActorBio, searchDiscoverList } from './_lib/firecrawl_search.js';

export const maxDuration = 60;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') return res.status(204).end();

  const op = (req.query?.op || req.body?.op || req.query?.task || req.body?.task || '').toString();
  const pathname = (req.url || '').split('?')[0];

  if (op === 'semantic-search' || op === 'semantic_search' || pathname.includes('/semantic-search')) {
    const { handleSemanticSearch } = await import('./_lib/semantic_search_handler.js');
    return handleSemanticSearch(req, res);
  }

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // This endpoint performs privileged, service-role DB writes (renaming
  // films, inserting people/credits) and burns paid AI quota. Require an
  // authenticated admin/cron caller.
  const authCheck = await isValidAuth(req);
  if (!authCheck.valid) {
    return res.status(401).json({ error: `Unauthorized - debug info: authHeader=${req.headers['authorization'] ? 'present' : 'missing'}, reason=${authCheck.reason}` });
  }

  const { task, data } = req.body;

  try {
    switch (task) {
      case 'cleanup_films': return await cleanupFilms(res);
      case 'cleanup_people': return await cleanupPeople(res);
      case 'enrich_metadata': return await enrichMetadata(res);
      case 'cleanup_titles': return await cleanupTitles(res);
      case 'extract_cast': return await extractCastFromTitles(res);
      case 'polish_title': return await polishTitle(data, res);
      case 'summarize_film': return await summarizeFilm(data, res);
      case 'discover_actors': return await discoverActors(data, res);
      case 'deduplicate': return await mergeDuplicates(data, res);
      case 'extract_credits_from_image': return await extractCreditsFromImage(data, res);
      case 'extract_play_from_instagram': return await extractPlayFromInstagram(data, res);
      case 'people_enrichment_gemini': return await peopleEnrichmentGemini(data, res);
      case 'people_enrichment_gemini_batch': return await peopleEnrichmentGeminiBatch(data, res);
      case 'enrich_film_gemini': return await enrichFilmGeminiTask(data, res);
      case 'enrich_people_strict': return await enrichPeopleStrictTask(data, res);
      case 'generate_missing_synopses': return await generateMissingSynopses(data, res);
      case 'generate_missing_bios': return await generateMissingBios(data, res);
      case 'detect_duplicate_films': return await detectDuplicateFilms(data, res);
      case 'generate_social_teaser': return await generateSocialTeaser(data, res);
      default: return res.status(400).json({ error: 'Invalid task' });
    }
  } catch (err: any) {
    console.error('AI Service Error:', err);
    return res.status(500).json({ error: err.message });
  }
}

function normalizeInstagramUrl(value: unknown) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const withProtocol = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  const url = new URL(withProtocol);
  const host = url.hostname.toLowerCase().replace(/^www\./, '').replace(/^m\./, '');
  if (host !== 'instagram.com') {
    throw new Error('Please paste a valid Instagram link.');
  }
  url.hash = '';
  return url.toString();
}

function getInstagramAccessToken() {
  if (process.env.INSTAGRAM_OEMBED_ACCESS_TOKEN) return process.env.INSTAGRAM_OEMBED_ACCESS_TOKEN;
  if (process.env.FACEBOOK_APP_ACCESS_TOKEN) return process.env.FACEBOOK_APP_ACCESS_TOKEN;
  if (process.env.FACEBOOK_APP_ID && process.env.FACEBOOK_CLIENT_TOKEN) {
    return `${process.env.FACEBOOK_APP_ID}|${process.env.FACEBOOK_CLIENT_TOKEN}`;
  }
  return '';
}

async function fetchInstagramOembed(instagramUrl: string) {
  const accessToken = getInstagramAccessToken();
  if (!accessToken) {
    return {
      oembed: null,
      warning: 'Instagram oEmbed token is not configured; using the URL, caption, and uploaded flyer only.',
    };
  }

  const graphVersion = process.env.FACEBOOK_GRAPH_VERSION || 'v20.0';
  const endpoint = new URL(`https://graph.facebook.com/${graphVersion}/instagram_oembed`);
  endpoint.searchParams.set('url', instagramUrl);
  endpoint.searchParams.set('access_token', accessToken);
  endpoint.searchParams.set('fields', 'thumbnail_url,author_name,provider_name,provider_url,html');

  const response = await fetch(endpoint.toString());
  const json = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = json?.error?.message || `Instagram oEmbed failed with status ${response.status}`;
    return { oembed: null, warning: message };
  }
  return { oembed: json, warning: null };
}

function parseDataUrlImage(value: unknown) {
  const image = String(value || '').trim();
  if (!image) return null;

  const match = image.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (!match) return null;
  return { mimeType: match[1], base64Data: match[2] };
}

function parseAIObject(text: string) {
  const cleaned = text.replace(/```json/g, '').replace(/```/g, '').trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start !== -1 && end > start) {
      return JSON.parse(cleaned.substring(start, end + 1));
    }
  }
  throw new Error('AI response did not contain a valid JSON object.');
}

function cleanString(value: unknown, maxLength = 2000) {
  return String(value || '').trim().slice(0, maxLength);
}

function cleanDate(value: unknown) {
  const raw = String(value || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null;
  const date = new Date(`${raw}T12:00:00Z`);
  return Number.isNaN(date.getTime()) ? null : raw;
}

function derivePlayStatus(startDate: string | null, endDate: string | null, aiStatus: unknown) {
  const status = cleanString(aiStatus, 40);
  if (['upcoming', 'currently_running', 'archived'].includes(status)) return status;

  const today = new Date().toISOString().slice(0, 10);
  if (startDate && startDate > today) return 'upcoming';
  if (startDate && startDate <= today && (!endDate || endDate >= today)) return 'currently_running';
  return 'archived';
}

function normalizePlayExtraction(raw: any, instagramUrl: string, oembed: any) {
  const runStartDate = cleanDate(raw?.run_start_date);
  const runEndDate = cleanDate(raw?.run_end_date);
  const safeEndDate = runStartDate && runEndDate && runEndDate < runStartDate ? null : runEndDate;

  return {
    title: cleanString(raw?.title, 220),
    slug: '',
    playwright: cleanString(raw?.playwright, 220),
    director: cleanString(raw?.director, 220),
    producer: cleanString(raw?.producer, 220),
    venue: cleanString(raw?.venue, 220),
    city: cleanString(raw?.city, 120),
    country: cleanString(raw?.country, 120) || 'Nigeria',
    synopsis: cleanString(raw?.synopsis || raw?.description, 5000),
    genre: cleanString(raw?.genre, 220),
    run_start_date: runStartDate || '',
    run_end_date: safeEndDate || '',
    performance_time: cleanString(raw?.performance_time || raw?.time, 120),
    poster_url: cleanString(raw?.poster_url || oembed?.thumbnail_url, 2000),
    banner_url: '',
    source_url: cleanString(raw?.source_url, 2000) || instagramUrl,
    year: runStartDate ? Number(runStartDate.slice(0, 4)) : new Date().getFullYear(),
    status: derivePlayStatus(runStartDate, safeEndDate, raw?.status),
  };
}

async function extractPlayFromInstagram(data: any, res: VercelResponse) {
  const instagramUrl = normalizeInstagramUrl(data?.url);
  const caption = cleanString(data?.caption, 6000);
  const parsedImage = parseDataUrlImage(data?.image);
  const warnings: string[] = [];
  const { oembed, warning } = await fetchInstagramOembed(instagramUrl);
  if (warning) warnings.push(warning);

  const today = new Date().toISOString().slice(0, 10);
  const sourceContext = {
    instagramUrl,
    caption,
    oembed,
    today,
    locale: 'Nigeria/Africa theatre listings',
  };

  const prompt = `
You extract theatre play/event details for a Nollywood/African cinema database admin form.
Today is ${today}. Treat dates as Nigerian local dates.

Source context:
${JSON.stringify(sourceContext, null, 2)}

Return ONLY one valid JSON object with this shape:
{
  "title": "",
  "playwright": "",
  "director": "",
  "producer": "",
  "venue": "",
  "city": "",
  "country": "Nigeria",
  "synopsis": "",
  "genre": "",
  "run_start_date": "YYYY-MM-DD or null",
  "run_end_date": "YYYY-MM-DD or null",
  "performance_time": "",
  "poster_url": "",
  "source_url": "${instagramUrl}",
  "status": "upcoming|currently_running|archived",
  "confidence": 0,
  "notes": []
}

Rules:
- Extract only facts visible in the source context or uploaded flyer image.
- Do not invent missing names, venues, dates, or times.
- If the flyer gives a day and month but no year, infer the next plausible Nigerian local date relative to ${today}; otherwise use null.
- Use ISO dates only. Put the event time in performance_time, not in the date fields.
- Use a concise public-facing synopsis from the caption/flyer text when available.
`;

  let text = '';
  let telemetry = null;
  if (parsedImage) {
    const result = await generateAIVisionContent(prompt, parsedImage.base64Data, parsedImage.mimeType);
    text = result.text;
    telemetry = result.telemetry;
  } else {
    const result = await generateAIContent(prompt);
    text = result.text;
    telemetry = result.telemetry;
  }

  const extracted = parseAIObject(text);
  const play = normalizePlayExtraction(extracted, instagramUrl, oembed);

  return res.json({
    play,
    raw: extracted,
    oembed,
    warnings,
    telemetry,
  });
}

async function cleanupFilms(res: VercelResponse) {
  // Increase batch size and search for potential Hollywood leaks
  // We prioritize films that have many words or sound "Western" or are in a large batch
  const { data: films } = await supabase
    .from('films')
    .select('id, title, synopsis, release_type')
    .order('created_at', { ascending: false }) // Prioritize recently added (like from cinema scraper)
    .limit(100);

  if (!films) return res.json({ results: [] });

  const prompt = `
    You are a Nollywood/African Cinema expert. 
    Analyze these 100 films. Identify which ones are International/Hollywood/Foreign 
    and DEFINITELY DO NOT belong in a database dedicated ONLY to African (Nollywood/Ghollywood/etc) cinema.
    
    Example of what to REMOVE: "Project Hail Mary", "Avengers", "Dune", "Civil War", "Gladiator II".
    Example of what to KEEP: "A Tribe Called Judah", "Anikulapo", "King of Boys".
    
    Films: ${JSON.stringify(films)}
    
    Return ONLY JSON: [{"id": "...", "title": "...", "is_african": false, "reason": "...", "type": "film"}]
  `;
  const { text, telemetry } = await generateAIContent(prompt);
  const results = parseJSON(text).filter((f: any) => f.is_african === false);
  return res.json({ results, telemetry });
}

async function cleanupPeople(res: VercelResponse) {
  // Fetch a batch of people, focusing on those with non-Nigerian names or high popularity
  const { data: people } = await supabase
    .from('people')
    .select('id, name, biography, nationality')
    .order('created_at', { ascending: false })
    .limit(100);

  if (!people) return res.json({ results: [] });

  const prompt = `
    Analyze these 100 entertainment industry profiles. 
    Identify which ones are Hollywood/Western/International celebrities who have NEVER appeared in or contributed to a Nollywood or African film production.
    
    Example to REMOVE: "Brad Pitt", "Zendaya", "Tom Holland" (unless they acted in a Nollywood movie).
    Example to KEEP: "Genevieve Nnaji", "John Boyega", "Richard Mofe-Damijo".
    
    Profiles: ${JSON.stringify(people)}
    
    Return ONLY JSON: [{"id": "...", "name": "...", "is_nollywood_relevant": false, "reason": "...", "type": "person"}]
  `;
  const { text, telemetry } = await generateAIContent(prompt);
  const results = parseJSON(text).filter((p: any) => p.is_nollywood_relevant === false);
  return res.json({ results, telemetry });
}

async function enrichMetadata(res: VercelResponse) {
  // Fetch films with missing or very short synopses (< 50 chars)
  const { data: films } = await supabase.from('films')
    .select('id, title, synopsis')
    .limit(20);
    
  const filmsToEnrich = films?.filter(f => !f.synopsis || f.synopsis.length < 50).slice(0, 5) || [];

  // Fetch people with missing photos, biographies, or social links
  const { data: people } = await supabase.from('people')
    .select('id, name, biography, photo_url, instagram_url, facebook_url')
    .or('photo_url.is.null,photo_url.eq."",biography.is.null,biography.eq."",instagram_url.is.null,facebook_url.is.null')
    .limit(5);

  // Fetch search contexts for people
  const peopleWithContext = [];
  if (people && people.length > 0) {
    for (const p of people) {
      const searchContext = await searchActorBio(p.name);
      peopleWithContext.push({
        ...p,
        searchContext
      });
    }
  }

  // Fetch companies with missing logos
  const { data: companies } = await supabase.from('companies')
    .select('id, name, logo_url, description')
    .or('logo_url.is.null,logo_url.eq."",description.is.null,description.eq.""')
    .limit(5);

  const missingData = { films: filmsToEnrich, people: peopleWithContext, companies };
  const prompt = `
    Enrich this Nollywood metadata. 
    - Films: factual, detailed synopsis (min 200 chars). Use sources like TMDB, IMDb, and kava.tv.
    - People: Provide a detailed biography. Use the provided "searchContext" (which contains real Google results) to extract the most accurate biography, their Instagram URL, and Facebook URL. Provide a REAL high-quality photo URL, and date of birth (YYYY-MM-DD format if available).
    - Companies: Logo URL and full description.
    - If no photo/logo found, use: https://ui-avatars.com/api/?name=NAME&background=random
    
    Return ONLY JSON: [{"type": "film/person/company", "id": "...", "name": "...", "synopsis": "...", "biography": "...", "date_of_birth": "...", "image_url": "...", "instagram_url": "...", "facebook_url": "..."}]
    Data: ${JSON.stringify(missingData)}
  `;

  const { text, telemetry } = await generateAIContent(prompt);
  return res.json({ results: parseJSON(text), telemetry });
}

async function discoverActors(data: any, res: VercelResponse) {
  const { region = 'Yoruba' } = data;
  
  // 1. Fetch a larger sample of existing names to guide the AI
  const { data: existingSample } = await supabase.from('people')
    .select('name')
    .ilike('nationality', 'Nigerian')
    .limit(400);

  // Search google for list of upcoming actors
  const listContext = await searchDiscoverList(region);

  const prompt = `
    Research 20 NEW and UPCOMING actors from the ${region} film industry (Nollywood). 
    Focus on rising stars seen in recent YouTube releases, kava.tv, or recent cinema hits.
    
    CRITICAL: Do NOT suggest these actors as they are already in the database:
    ${existingSample?.map(p => p.name).join(', ')}

    Use this real Google search context to find accurate upcoming actors, their biographies, and social links:
    ${listContext}
    
    Return ONLY JSON: [{"name": "...", "biography": "...", "date_of_birth": "...", "image_url": "...", "instagram_url": "...", "facebook_url": "...", "notable_movies": [], "type": "person"}]
  `;

  const { text, telemetry } = await generateAIContent(prompt);
  let aiResults = parseJSON(text);

  if (!Array.isArray(aiResults)) aiResults = [];

  // Deep dive search for each found new actor to guarantee bio and links
  for (let i = 0; i < aiResults.length; i++) {
    if (aiResults[i].name) {
      const bioContext = await searchActorBio(aiResults[i].name);
      
      if (bioContext) {
        const refinePrompt = `
          Extract a detailed biography, instagram_url, and facebook_url for the actor "${aiResults[i].name}" based strictly on this search data:
          ${bioContext}
          
          Return ONLY JSON: {"biography": "...", "instagram_url": "...", "facebook_url": "..."}
        `;
        try {
          const { text: refinedText } = await generateAIContent(refinePrompt);
          const refinedData = parseJSON(refinedText);
          if (!Array.isArray(refinedData) && typeof refinedData === 'object') {
            aiResults[i].biography = refinedData.biography || aiResults[i].biography;
            aiResults[i].instagram_url = refinedData.instagram_url || aiResults[i].instagram_url;
            aiResults[i].facebook_url = refinedData.facebook_url || aiResults[i].facebook_url;
          }
        } catch (e) {
          console.warn('Failed to refine actor bio', e);
        }
      }
    }
  }

  // 2. SERVER-SIDE FILTER: Actually check the database for these names to ensure zero duplicates
  const namesToCheck = aiResults.map((r: any) => r.name).filter(Boolean);
  const { data: duplicates } = await supabase
    .from('people')
    .select('name')
    .in('name', namesToCheck);

  const duplicateNames = new Set(duplicates?.map(d => d.name.toLowerCase()));
  const filteredResults = aiResults.filter((r: any) => !duplicateNames.has(r.name.toLowerCase()));

  return res.json({ 
    results: filteredResults, 
    telemetry,
    filtered_out: aiResults.length - filteredResults.length 
  });
}

async function mergeDuplicates(data: any, res: VercelResponse) {
  const { offset = 0, limit = 800 } = data;

  // Set to 800 to stay within most limits while maintaining high coverage
  const { data: items, count } = await supabase.from('people')
    .select('id, name', { count: 'exact' })
    .order('name')
    .range(offset, offset + limit - 1);
    
  if (!items || items.length === 0) return res.json({ results: [], totalCount: count || 0 });

  // Extremely compact format to maximize the 12k token window
  const compactData = items.map(i => `${i.id.slice(0,8)}:${i.name}`).join('|');
  
  const prompt = `
    Find duplicate profiles in this Nollywood talent list.
    Entries are ID_PREFIX:NAME. Look for:
    - Reversed names (Funke Akindele / Akindele Funke)
    - Typographical errors
    - Name variations (Sola S. / Sola Sobowale)
    
    Data: ${compactData}
    
    Return ONLY JSON: [{"master_id_prefix": "...", "master_name": "...", "duplicate_id_prefixes": ["..."], "reason": "..."}]
  `;
  const { text, telemetry } = await generateAIContent(prompt);
  const aiResults = parseJSON(text);

  // Re-map prefixes back to full IDs
  const mappedResults = aiResults.map((res: any) => {
    const master = items.find(i => i.id.startsWith(res.master_id_prefix));
    const duplicates = res.duplicate_id_prefixes.map((pref: string) => items.find(i => i.id.startsWith(pref))?.id).filter(Boolean);
    return {
      ...res,
      master_id: master?.id,
      duplicate_ids: duplicates
    };
  }).filter((r: any) => r.master_id && r.duplicate_ids.length > 0);

  return res.json({ results: mappedResults, telemetry, totalCount: count || 0, analyzedCount: items.length });
}

async function summarizeFilm(data: any, res: VercelResponse) {
  const { title, description } = data;
  
  if (!title) return res.status(400).json({ error: 'Title is required for summarization' });

  const prompt = `
    Write a professional and compelling movie synopsis for an African film titled "${title}".
    
    Context from YouTube description:
    ${description || 'No description provided.'}
    
    Rules:
    1. Keep it to exactly 3 sentences.
    2. Focus on the plot and drama/emotions.
    3. Remove any YouTube marketing jargon (links, "subscribe", "produced by", etc.).
    4. Ensure it sounds like a high-end cinematic description.
    5. Do NOT include spoilers unless they are part of the basic premise.
    
    Return ONLY the synopsis text.
  `;

  const { text, telemetry } = await generateAIContent(prompt);
  return res.json({ synopsis: text.trim(), telemetry });
}

async function cleanupTitles(res: VercelResponse) {
  // Deep scan: Prioritize titles with pipes (|) and common noise
  const { data: films, error: dbError } = await supabase
    .from('films')
    .select('id, title')
    .or('title.ilike.%|%,title.ilike.%YORUBA%,title.ilike.%MOVIE%,title.ilike.%PART%,title.ilike.%2024%,title.ilike.%2025%,title.ilike.%FULL%,title.ilike.%NIGERIAN%,title.ilike.%(%,title.ilike.%[%,title.ilike.%-%,title.ilike.%LATEST%')
    .order('created_at', { ascending: false })
    .limit(40); // Reduced batch size to 40 to avoid token rate limits (429)

  if (dbError) {
    console.error('DB Error in cleanupTitles:', dbError);
    return res.status(500).json({ error: dbError.message });
  }

  if (!films || films.length === 0) {
    console.log('No messy titles found in current batch');
    return res.json({ results: [] });
  }

  console.log(`Analyzing ${films.length} titles for cleanup...`);

  const prompt = `
    You are a Nollywood database editor. 
    Clean up these movie titles by removing common YouTube marketing noise, years, and category labels.
    
    Rules:
    1. EXTRACT ONLY the actual movie title. 
    2. DISCARD all marketing buzzwords: "LATEST", "YORUBA MOVIE", "NIGERIAN MOVIE", "2024", "2025", "FULL MOVIE", "HD", "APA", "PART 1", etc.
    3. DISCARD all actor/cast lists separated by |, /, or hyphens.
    4. Proper Case: Convert ALL CAPS to Proper Case (e.g., "NKAN ASIRI" -> "Nkan Asiri").
    5. Be Aggressive: If a title has noise at the start (e.g., "YORUBA MOVIES 2025 LATEST: TITANIC"), remove the noise.
    6. CRITICAL (NO COMPROMISE): If the title contains a pipe (|), YOU MUST remove the pipe and everything after it.
    7. NO REPEATS: If the output title is the same as the input title, you have failed the task. Every title in this list is MESSY. Clean it.
    
    Return ONLY JSON: [{"id": "...", "old_title": "...", "new_title": "...", "type": "title_cleanup"}]
    
    Titles to clean: ${JSON.stringify(films)}
  `;

  console.log(`Sending ${films.length} titles to AI for cleanup...`);
  const { text, telemetry } = await generateAIContent(prompt);
  console.log('AI Response received.');
  
  const parsed = parseJSON(text);
  if (parsed.length === 0 && films.length > 0) {
    console.warn('AI returned 0 results or invalid JSON for non-empty input.');
  }

  const results = parsed.filter((f: any) => f.old_title && f.new_title && f.old_title.trim() !== f.new_title.trim());
  console.log(`Cleanup complete. ${results.length} items modified.`);
  return res.json({ results, telemetry, analyzedCount: films.length });
}

async function extractCastFromTitles(res: VercelResponse) {
  // Find films whose titles likely contain embedded cast names
  const { data: films, error: dbError } = await supabase
    .from('films')
    .select('id, title')
    .or('title.ilike.%starring%,title.ilike.%feat%,title.ilike.%ft.%,title.ilike.%ft %')
    .order('created_at', { ascending: false })
    .limit(30);

  if (dbError) {
    console.error('DB Error in extractCastFromTitles:', dbError);
    return res.status(500).json({ error: dbError.message });
  }

  // Also grab films with pipe-separated names (very common YouTube pattern)
  const { data: pipeFilms } = await supabase
    .from('films')
    .select('id, title')
    .ilike('title', '%|%')
    .order('created_at', { ascending: false })
    .limit(20);

  // Merge and deduplicate
  const allFilms = [...(films || [])];
  const seenIds = new Set(allFilms.map(f => f.id));
  for (const f of (pipeFilms || [])) {
    if (!seenIds.has(f.id)) {
      allFilms.push(f);
      seenIds.add(f.id);
    }
  }

  if (allFilms.length === 0) {
    return res.json({ results: [], analyzedCount: 0, applied: 0 });
  }

  console.log(`Analyzing ${allFilms.length} titles for embedded cast names...`);

  const prompt = `
    You are a Nollywood database editor. These YouTube video titles contain actor/cast names embedded in them.
    
    Your job:
    1. EXTRACT the clean movie title (remove all marketing noise, years, category labels).
    2. EXTRACT all actor/cast names embedded in the title.
    
    Common patterns to detect:
    - "Ago(cage) Starring Aishat Lawal Muyiwa Ademola, Lalude" → title: "Ago (Cage)", cast: ["Aishat Lawal", "Muyiwa Ademola", "Lalude"]
    - "ALAKO | MIDE MARTINS | DAMILOLA OMOTOSO" → title: "Alako", cast: ["Mide Martins", "Damilola Omotoso"]
    - "OKO ASEWO ft Odunlade Adekola, Mercy Aigbe" → title: "Oko Asewo", cast: ["Odunlade Adekola", "Mercy Aigbe"]
    - "IBINU - Starring Femi Adebayo, Bimbo Oshin" → title: "Ibinu", cast: ["Femi Adebayo", "Bimbo Oshin"]
    
    Rules:
    - Proper Case all names (e.g. "MIDE MARTINS" → "Mide Martins").
    - Each cast entry must be a FULL PERSON NAME (first + last minimum). Single words like "ozain" should be kept as-is if that's their known stage name.
    - Separate concatenated names: "biolafowosere" → "Biola Fowosere", "ejidealakara" → "Ejide Alakara".
    - If a name is clearly a character name (not an actor), skip it.
    - If the title has NO embedded cast, return an empty cast array.
    - ONLY return entries where you found at least 1 cast member.
    
    Return ONLY JSON: [{"id": "...", "old_title": "...", "new_title": "...", "cast": ["Name One", "Name Two"]}]
    
    Titles: ${JSON.stringify(allFilms)}
  `;

  const { text, telemetry } = await generateAIContent(prompt);
  console.log('Raw AI cast extraction response (first 500 chars):', text.substring(0, 500));
  const parsed = parseJSON(text);
  console.log(`Parsed ${parsed.length} items from AI response`);
  
  // Build a lookup from original film data for cross-referencing
  const filmLookup = new Map(allFilms.map(f => [f.id, f.title]));

  // Normalize AI response fields
  const normalized = parsed.map((f: any) => {
    const originalTitle = filmLookup.get(f.id) || f.old_title || f.title || '';
    return {
      id: f.id,
      old_title: originalTitle,
      new_title: f.new_title || f.clean_title || f.cleaned_title || originalTitle,
      cast: Array.isArray(f.cast) ? f.cast : (Array.isArray(f.actors) ? f.actors : []),
    };
  });

  // Filter to only items that have cast extracted
  const extracted = normalized.filter((f: any) => 
    f.id && f.cast.length > 0 && f.old_title
  );

  console.log(`Cast extraction found ${extracted.length} films with embedded cast (from ${parsed.length} AI results).`);

  if (extracted.length === 0) {
    return res.json({ 
      results: [], telemetry, analyzedCount: allFilms.length, applied: 0,
      _debug: {
        rawPreview: text.substring(0, 300),
        parsedCount: parsed.length,
        sampleKeys: parsed.length > 0 ? Object.keys(parsed[0]) : [],
      }
    });
  }

  // ========== AUTO-APPLY: Do everything server-side ==========
  const applied: any[] = [];
  const errors: string[] = [];

  for (const item of extracted) {
    try {
      // 1. Update film title
      if (item.new_title && item.new_title !== item.old_title) {
        await supabase.from('films').update({ title: item.new_title }).eq('id', item.id);
        console.log(`Title: "${item.old_title}" → "${item.new_title}"`);
      }

      // 2. Upsert cast members
      let castLinked = 0;
      const linkedNames: string[] = [];

      for (const actorName of item.cast) {
        try {
          // Tier 1: Exact name match (case-insensitive)
          let { data: existingPerson } = await supabase
            .from('people')
            .select('id, name')
            .ilike('name', actorName)
            .maybeSingle();

          // Tier 2: Partial match (e.g. "Lalude" matches "Fatai Adekunle Adetayo (Lalude)")
          if (!existingPerson) {
            const { data: partialMatch } = await supabase
              .from('people')
              .select('id, name')
              .ilike('name', `%${actorName}%`)
              .limit(1)
              .maybeSingle();
            if (partialMatch) {
              existingPerson = partialMatch;
              console.log(`Fuzzy match: "${actorName}" → "${partialMatch.name}"`);
            }
          }

          let personId = existingPerson?.id;

          // Create if not found
          if (!personId) {
            // // Shared matcher (migration 20260723112408): exact name, else
  // people.name_key (order-insensitive + honorific-stripped), so
  // "Kosoko Jide" / "Prince Jide Kosoko" resolve to the existing person.
            const { data: rpcId, error: pErr } = await supabase.rpc('upsert_person_by_name', {
              p_name: actorName,
              p_extra: { nationality: 'Nigerian', source: 'ai' },
            });
            if (pErr) throw pErr;
            personId = rpcId as unknown as string;
            console.log(`Created new person: "${actorName}"`);
          }

          // 3. Link credit (skip if already exists)
          const { data: existingCredit } = await supabase
            .from('credits')
            .select('id')
            .eq('film_id', item.id)
            .eq('person_id', personId)
            .maybeSingle();

          if (!existingCredit) {
            await supabase.from('credits').insert({
              film_id: item.id,
              person_id: personId,
              role: 'actor',
              character_name: '',
              billing_order: castLinked + 1,
            });
          }

          castLinked++;
          linkedNames.push(existingPerson?.name || actorName);
        } catch (castErr: any) {
          console.warn(`Cast link error for "${actorName}":`, castErr.message);
        }
      }

      applied.push({
        id: item.id,
        old_title: item.old_title,
        new_title: item.new_title,
        cast: linkedNames,
        castLinked,
      });
    } catch (err: any) {
      errors.push(`Film ${item.id}: ${err.message}`);
      console.error(`Error processing film ${item.id}:`, err.message);
    }
  }

  console.log(`Auto-applied: ${applied.length} films updated, ${errors.length} errors.`);
  return res.json({ 
    results: applied, 
    telemetry, 
    analyzedCount: allFilms.length, 
    applied: applied.length,
    errors: errors.length > 0 ? errors : undefined,
  });
}

async function polishTitle(data: any, res: VercelResponse) {
  const { title } = data;
  if (!title) return res.status(400).json({ error: 'Title is required' });

  const prompt = `
    Rules:
    1. EXTRACT ONLY the actual movie title.
    2. DISCARD all marketing buzzwords (LATEST, 2024, YORUBA MOVIE, etc.)
    3. DISCARD all actor names or cast lists separated by |, /, or hyphens.
    4. Proper Case: Convert ALL CAPS to Proper Case.
    5. Return ONLY the cleaned title string.
    
    Examples:
    - "LATEST YORUBA MOVIE 2024 - NKAN ASIRI" -> "Nkan Asiri"
    - "NKAN ASIRI PART 1" -> "Nkan Asiri"
    - "ALAKO Latest Yoruba Movie 2024 | MIDE MARTINS | DAMILOLA OMOTOSO" -> "Alako"
    
    Title to clean: "${title}"
  `;

  const { text, telemetry } = await generateAIContent(prompt);
  return res.json({ title: text.trim().replace(/^"|"$/g, ''), telemetry });
}

async function extractCreditsFromImage(data: any, res: VercelResponse) {
  const { image, creditType = 'cast' } = data;

  if (!image) {
    return res.status(400).json({ error: 'Image base64 data is required' });
  }

  // Parse mimeType and clean base64 data
  const matches = image.match(/^data:(image\/[a-zA-Z0-9.-]+);base64,(.+)$/);
  if (!matches) {
    return res.status(400).json({ error: 'Invalid image format. Must be a base64 data URL.' });
  }

  const mimeType = matches[1];
  const base64Data = matches[2];

  let prompt = '';
  if (creditType === 'cast') {
    prompt = `
      You are an expert Nollywood credit extractor.
      Perform high-accuracy OCR on the uploaded screenshot of opening or closing movie credits.
      Extract all Cast Members (actors) and their matching character names.

      Rules:
      1. Extract ALL actor names and character names listed.
      2. Ignore any headers like "Awon Osere", "Cast", "Starring", etc.
      3. Clean up the actor names: Proper Case them (e.g. "Murphy Afolabi", "Taofeeq Adewale").
      4. If dots or lines are used between names (e.g., "Murphy Afolabi.........Oba"), split them cleanly into Actor Name ("Murphy Afolabi") and Character Name ("Oba").
      5. Return ONLY a valid JSON array matching this schema:
      [
        {
          "name": "Actor Full Name",
          "role_or_character": "Character Name"
        }
      ]
    `;
  } else {
    prompt = `
      You are an expert Nollywood credit extractor.
      Perform high-accuracy OCR on the uploaded screenshot of opening or closing movie credits.
      Extract all Crew Members and their specific functions/roles.

      Rules:
      1. Extract ALL crew names and their specific functions/roles listed (e.g., "Director", "Producer", "Makeup Artist", "Gaffer", "Lighting", "Editor", "Screenplay").
      2. Clean up the names: Proper Case them (e.g. "Emem Inlobong Monday").
      3. Clean up the roles: Standardize them to professional crew functions (e.g. "Makeup Artist", "Cinematographer", "Producer", "Director").
      4. Return ONLY a valid JSON array matching this schema:
      [
        {
          "name": "Crew Member Full Name",
          "role_or_character": "Specific Role/Function"
        }
      ]
    `;
  }

  try {
    const { text, telemetry } = await generateAIVisionContent(prompt, base64Data, mimeType);
    const parsed = parseJSON(text);
    return res.json({ results: parsed, telemetry });
  } catch (err: any) {
    console.error('Vision API Error:', err);
    return res.status(500).json({ error: err.message });
  }
}

/** Grounded Gemini people research — kept on /api/ai so /api/automation stays light. */
async function peopleEnrichmentGemini(data: any, res: VercelResponse) {
  const queueId = String(data?.queueId || '');
  if (!queueId) return res.status(400).json({ error: 'queueId is required' });

  const { data: row, error } = await supabase
    .from('people_enrichment_queue')
    .select('id,person_id,attempt_count,missing_fields,status')
    .eq('id', queueId)
    .single();
  if (error) throw error;
  if (!row) return res.status(404).json({ error: 'Queue row not found' });

  await supabase
    .from('people_enrichment_queue')
    .update({
      status: 'fetching',
      attempt_count: Number(row.attempt_count || 0) + 1,
      last_attempt_at: new Date().toISOString(),
    })
    .eq('id', row.id);

  const { researchPersonWithGemini } = await import('./_lib/gemini_people_enrichment.js');
  const result = await researchPersonWithGemini({
    queueId: row.id,
    personId: row.person_id,
    missingFields: row.missing_fields || [],
    force: Boolean(data?.force ?? true),
  });

  if (result.preserveExistingProposal && row.status && row.status !== 'fetching') {
    await supabase
      .from('people_enrichment_queue')
      .update({ status: row.status })
      .eq('id', row.id);
  }

  return res.status(200).json({ success: true, result });
}

async function peopleEnrichmentGeminiBatch(data: any, res: VercelResponse) {
  const queueIds = Array.isArray(data?.queueIds)
    ? [...new Set(data.queueIds.filter((id: unknown): id is string => typeof id === 'string' && Boolean(id)))]
      .slice(0, 5)
    : [];
  if (!queueIds.length) return res.status(400).json({ error: 'Select up to 5 queue rows' });

  const { data: rows, error } = await supabase
    .from('people_enrichment_queue')
    .select('id,person_id,attempt_count,missing_fields,status')
    .in('id', queueIds);
  if (error) throw error;

  const { researchPersonWithGemini } = await import('./_lib/gemini_people_enrichment.js');
  const results = [];
  for (const row of rows || []) {
    await supabase
      .from('people_enrichment_queue')
      .update({
        status: 'fetching',
        attempt_count: Number(row.attempt_count || 0) + 1,
        last_attempt_at: new Date().toISOString(),
      })
      .eq('id', row.id);

    const result = await researchPersonWithGemini({
      queueId: row.id,
      personId: row.person_id,
      missingFields: row.missing_fields || [],
      force: true,
    });

    if (result.preserveExistingProposal && row.status && row.status !== 'fetching') {
      await supabase
        .from('people_enrichment_queue')
        .update({ status: row.status })
        .eq('id', row.id);
    }
    results.push(result);
  }

  return res.status(200).json({ success: true, results });
}

async function enrichFilmGeminiTask(data: any, res: VercelResponse) {
  const filmId = data?.filmId;
  const limit = Math.min(Number(data?.limit || 20), 50);

  let targetFilms: any[] = [];

  if (filmId) {
    const { data: film } = await supabase
      .from('films')
      .select('id, title, year, synopsis, genres, maturity_rating, youtube_watch_url, trailer_youtube_id, source_video_id')
      .eq('id', filmId)
      .single();
    if (film) targetFilms = [film];
  } else {
    const { data: films } = await supabase
      .from('films')
      .select('id, title, year, synopsis, genres, maturity_rating, youtube_watch_url, trailer_youtube_id, source_video_id')
      .or('synopsis.is.null,synopsis.eq.,genres.is.null,maturity_rating.is.null')
      .order('created_at', { ascending: false })
      .limit(limit);
    targetFilms = films || [];
  }

  if (!targetFilms.length) {
    return res.json({ success: true, message: 'No films requiring Gemini enrichment', results: [] });
  }

  const { enrichFilmWithGemini, applyFilmEnrichmentToDb } = await import('../src/lib/filmGeminiEnricher.server.js');

  const results: any[] = [];

  for (const film of targetFilms) {
    try {
      const enrichment = await enrichFilmWithGemini(film);
      if (enrichment.synopsis) {
        await applyFilmEnrichmentToDb(film.id, enrichment);
        results.push({
          filmId: film.id,
          title: film.title,
          synopsis: enrichment.synopsis,
          genre: enrichment.genre,
          age_rating: enrichment.age_rating,
          status: 'ENRICHED',
        });
      }
    } catch (e: any) {
      results.push({
        filmId: film.id,
        title: film.title,
        error: e.message,
        status: 'FAILED',
      });
    }
  }

  return res.json({ success: true, count: results.length, results });
}

async function enrichPeopleStrictTask(data: any, res: VercelResponse) {
  const personId = data?.personId;
  const limit = Math.min(Number(data?.limit || 20), 50);

  let targetPeople: any[] = [];

  if (personId) {
    const { data: person } = await supabase
      .from('people')
      .select('id, name, bio, photo_url, date_of_birth, gender, tmdb_id, instagram_url, twitter_url, facebook_url, tiktok_url, youtube_handle')
      .eq('id', personId)
      .single();
    if (person) targetPeople = [person];
  } else {
    const { data: people } = await supabase
      .from('people')
      .select('id, name, bio, photo_url, date_of_birth, gender, tmdb_id, instagram_url, twitter_url, facebook_url, tiktok_url, youtube_handle')
      .or('bio.is.null,photo_url.is.null,instagram_url.is.null')
      .order('popularity_score', { ascending: false })
      .limit(limit);
    targetPeople = people || [];
  }

  if (!targetPeople.length) {
    return res.json({ success: true, message: 'No people requiring strict enrichment', results: [] });
  }

  const { enrichPersonStrict, applyPersonStrictEnrichment } = await import('../src/lib/strictPeopleEnricher.server.js');

  const results: any[] = [];

  for (const person of targetPeople) {
    try {
      const enrichment = await enrichPersonStrict(person);
      if (enrichment.verified) {
        await applyPersonStrictEnrichment(person.id, enrichment.data);
        results.push({
          personId: person.id,
          name: person.name,
          enriched_fields: Object.keys(enrichment.data),
          sources: enrichment.sources,
          status: 'ENRICHED',
        });
      } else {
        results.push({
          personId: person.id,
          name: person.name,
          status: 'SKIPPED_NO_GROUNDED_MATCH',
        });
      }
    } catch (e: any) {
      results.push({
        personId: person.id,
        name: person.name,
        error: e.message,
        status: 'FAILED',
      });
    }
  }

  return res.json({ success: true, count: results.length, results });
}

async function generateMissingSynopses(data: any, res: VercelResponse) {
  const limit = Math.min(Number(data?.limit || 20), 50);

  const { data: films, error } = await supabase
    .from('films')
    .select('id, title, year, synopsis')
    .or('synopsis.is.null,synopsis.eq.')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) return res.status(500).json({ error: error.message });
  if (!films || films.length === 0) {
    return res.json({ success: true, message: 'No films missing synopses found', results: [] });
  }

  const prompt = `
    You are a Nollywood database editor. Write a concise, 2-sentence factual movie logline for each film below.
    Base the summary ONLY on the title and context (e.g. genre implied by title). Do NOT make up specific character names unless evident. Keep tone cinematic.

    Return ONLY JSON: [{"id": "...", "title": "...", "synopsis": "..."}]

    Films: ${JSON.stringify(films.map(f => ({ id: f.id, title: f.title, year: f.year })))}
  `;

  const { text, telemetry } = await generateAIContent(prompt);
  const parsed = parseJSON(text);

  let updatedCount = 0;
  if (Array.isArray(parsed)) {
    for (const item of parsed) {
      if (item.id && item.synopsis && item.synopsis.length > 20) {
        const { error: uErr } = await supabase
          .from('films')
          .update({ synopsis: item.synopsis.trim() })
          .eq('id', item.id);
        if (!uErr) updatedCount++;
      }
    }
  }

  return res.json({ success: true, analyzedCount: films.length, updatedCount, results: parsed, telemetry });
}

async function generateMissingBios(data: any, res: VercelResponse) {
  const limit = Math.min(Number(data?.limit || 15), 30);

  const { data: people, error } = await supabase
    .from('people')
    .select('id, name, bio')
    .or('bio.is.null,bio.eq.')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) return res.status(500).json({ error: error.message });
  if (!people || people.length === 0) {
    return res.json({ success: true, message: 'No people missing bios found', results: [] });
  }

  // Fetch top credit film titles for each person to give rich context
  const personContexts = [];
  for (const p of people) {
    const { data: credits } = await supabase
      .from('credits')
      .select('films(title)')
      .eq('person_id', p.id)
      .limit(5);

    const movieTitles = (credits || []).map((c: any) => c.films?.title).filter(Boolean);
    personContexts.push({
      id: p.id,
      name: p.name,
      knownForMovies: movieTitles,
    });
  }

  const prompt = `
    You are a Nollywood database biographer. Write a 2-3 sentence professional biography for each person below.
    Highlight their contributions to African cinema and mention their notable movie appearances if listed.

    Return ONLY JSON: [{"id": "...", "name": "...", "biography": "..."}]

    People: ${JSON.stringify(personContexts)}
  `;

  const { text, telemetry } = await generateAIContent(prompt);
  const parsed = parseJSON(text);

  let updatedCount = 0;
  if (Array.isArray(parsed)) {
    for (const item of parsed) {
      if (item.id && item.biography && item.biography.length > 20) {
        const { error: uErr } = await supabase
          .from('people')
          .update({ bio: item.biography.trim() })
          .eq('id', item.id);
        if (!uErr) updatedCount++;
      }
    }
  }

  return res.json({ success: true, analyzedCount: people.length, updatedCount, results: parsed, telemetry });
}

async function detectDuplicateFilms(data: any, res: VercelResponse) {
  const limit = Math.min(Number(data?.limit || 100), 200);

  const { data: films, error } = await supabase
    .from('films')
    .select('id, title, year')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) return res.status(500).json({ error: error.message });
  if (!films || films.length < 2) {
    return res.json({ success: true, duplicates: [] });
  }

  const prompt = `
    You are a database deduplication auditor for a Nollywood film database.
    Analyze these film titles and identify pairs that are VERY LIKELY the exact same film re-uploaded or typed differently.
    (e.g., "Alakada (Part 1)" vs "Alakada Pt 1", "Osuofia in London" vs "Osuofia in London 1").

    Return ONLY JSON: [{"original_id": "...", "original_title": "...", "duplicate_id": "...", "duplicate_title": "...", "confidence": 0.95, "reason": "..."}]

    Films: ${JSON.stringify(films)}
  `;

  const { text, telemetry } = await generateAIContent(prompt);
  const duplicates = parseJSON(text);

  return res.json({ success: true, scannedCount: films.length, duplicates, telemetry });
}

async function generateSocialTeaser(data: any, res: VercelResponse) {
  const { filmId } = data;
  if (!filmId) return res.status(400).json({ error: 'filmId is required' });

  const { data: film, error } = await supabase
    .from('films')
    .select('id, title, year, synopsis')
    .eq('id', filmId)
    .single();

  if (error || !film) return res.status(404).json({ error: 'Film not found' });

  const prompt = `
    You are a social media marketing expert for Nollywood cinema.
    Generate promotional captions for the film "${film.title}" (${film.year || 'Nollywood'}).
    Synopsis: ${film.synopsis || 'An exciting Nollywood release.'}

    Output captions for 3 platforms:
    1. instagram: Engaging caption with line breaks, emojis, and hashtags.
    2. twitter: Punchy tweet under 280 characters with 3 hashtags.
    3. whatsapp: Casual broadcast message to send to movie groups.

    Return ONLY JSON: {"instagram": "...", "twitter": "...", "whatsapp": "..."}
  `;

  const { text, telemetry } = await generateAIContent(prompt);
  const teaser = parseJSON(text);

  return res.json({ success: true, film: { id: film.id, title: film.title }, teaser, telemetry });
}
