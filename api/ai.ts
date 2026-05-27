import type { VercelRequest, VercelResponse } from '@vercel/node';
import { generateAIContent, parseJSON, generateAIVisionContent } from './_lib/ai_service.js';
import { supabase } from './_lib/supabase.js';

export const maxDuration = 60;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') return res.status(204).end();
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
      default: return res.status(400).json({ error: 'Invalid task' });
    }
  } catch (err: any) {
    console.error('AI Service Error:', err);
    return res.status(500).json({ error: err.message });
  }
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

  // Fetch people with missing photos OR missing biographies
  const { data: people } = await supabase.from('people')
    .select('id, name, biography, photo_url')
    .or('photo_url.is.null,photo_url.eq."",biography.is.null,biography.eq.""')
    .limit(5);

  // Fetch companies with missing logos
  const { data: companies } = await supabase.from('companies')
    .select('id, name, logo_url, description')
    .or('logo_url.is.null,logo_url.eq."",description.is.null,description.eq.""')
    .limit(5);

  const missingData = { films: filmsToEnrich, people, companies };
  const prompt = `
    Enrich this Nollywood metadata. 
    - Films: factual, detailed synopsis (min 200 chars). Use sources like TMDB, IMDb, and kava.tv.
    - People: Detailed biography, a REAL high-quality photo URL, and date of birth (YYYY-MM-DD format if available).
    - Companies: Logo URL and full description.
    - If no photo/logo found, use: https://ui-avatars.com/api/?name=NAME&background=random
    
    Return ONLY JSON: [{"type": "film/person/company", "id": "...", "name": "...", "synopsis": "...", "biography": "...", "date_of_birth": "...", "image_url": "..."}]
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

  const prompt = `
    Research 20 NEW and UPCOMING actors from the ${region} film industry (Nollywood). 
    Focus on rising stars seen in recent YouTube releases, kava.tv, or recent cinema hits.
    
    CRITICAL: Do NOT suggest these actors as they are already in the database:
    ${existingSample?.map(p => p.name).join(', ')}
    
    Return ONLY JSON: [{"name": "...", "biography": "...", "date_of_birth": "...", "image_url": "...", "notable_movies": [], "type": "person"}]
  `;

  const { text, telemetry } = await generateAIContent(prompt);
  let aiResults = parseJSON(text);

  if (!Array.isArray(aiResults)) aiResults = [];

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
  // Set to 800 to stay within most limits while maintaining high coverage
  const { data: items } = await supabase.from('people').select('id, name').order('name').limit(800);
  if (!items) return res.json({ results: [] });

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

  return res.json({ results: mappedResults, telemetry });
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
            const { data: newPerson, error: pErr } = await supabase
              .from('people')
              .insert({ name: actorName, nationality: 'Nigerian', created_at: new Date().toISOString() })
              .select('id')
              .single();
            if (pErr) throw pErr;
            personId = newPerson.id;
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
