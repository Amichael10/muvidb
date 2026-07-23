import { supabase } from './supabase.js';
import { generateAIContent, parseJSON } from './ai_service.js';

/**
 * Modularized AI Maintenance logic to keep sync.ts lean.
 */

export async function runCastExtraction() {
  console.log('[AI Maintenance] Starting cast extraction...');
  
  // Find films whose titles likely contain embedded cast names
  const { data: starringFilms } = await supabase
    .from('films')
    .select('id, title')
    .or('title.ilike.%starring%,title.ilike.%feat%,title.ilike.%ft.%,title.ilike.%ft %')
    .order('created_at', { ascending: false })
    .limit(30);

  const { data: pipeFilms } = await supabase
    .from('films')
    .select('id, title')
    .ilike('title', '%|%')
    .order('created_at', { ascending: false })
    .limit(20);

  // Merge and deduplicate
  const allCastFilms = [...(starringFilms || [])];
  const seenIds = new Set(allCastFilms.map(f => f.id));
  for (const f of (pipeFilms || [])) {
    if (!seenIds.has(f.id)) {
      allCastFilms.push(f);
      seenIds.add(f.id);
    }
  }

  if (allCastFilms.length === 0) {
    return { analyzed: 0, message: 'No films with embedded cast patterns found' };
  }

  console.log(`[AI Maintenance] Analyzing ${allCastFilms.length} titles for embedded cast...`);

  const castPrompt = `
    You are a Nollywood database editor. These YouTube video titles contain actor/cast names embedded in them.
    
    Your job:
    1. EXTRACT the clean movie title (remove all marketing noise, years, category labels).
    2. EXTRACT all actor/cast names embedded in the title.
    
    Common patterns to detect:
    - "Ago(cage) Starring Aishat Lawal Muyiwa Ademola, Lalude" → title: "Ago (Cage)", cast: ["Aishat Lawal", "Muyiwa Ademola", "Lalude"]
    - "ALAKO | MIDE MARTINS | DAMILOLA OMOTOSO" → title: "Alako", cast: ["Mide Martins", "Damilola Omotoso"]
    - "OKO ASEWO ft Odunlade Adekola, Mercy Aigbe" → title: "Oko Asewo", cast: ["Odunlade Adekola", "Mercy Aigbe"]
    
    Rules:
    - Proper Case all names.
    - Each cast entry must be a FULL PERSON NAME. Single words like "ozain" should be kept as-is if that's their known stage name.
    - If the title has NO embedded cast, return an empty cast array.
    - ONLY return entries where you found at least 1 cast member.
    
    Return ONLY JSON: [{"id": "...", "old_title": "...", "new_title": "...", "cast": ["Name One", "Name Two"]}]
    
    Titles: ${JSON.stringify(allCastFilms)}
  `;

  const { text: castText } = await generateAIContent(castPrompt);
  const castParsed = parseJSON(castText);

  // Build lookup for cross-reference
  const filmLookup = new Map(allCastFilms.map(f => [f.id, f.title]));
  
  const castExtracted = castParsed
    .map((f: any) => ({
      id: f.id,
      old_title: filmLookup.get(f.id) || f.old_title || '',
      new_title: f.new_title || f.clean_title || filmLookup.get(f.id) || '',
      cast: Array.isArray(f.cast) ? f.cast : (Array.isArray(f.actors) ? f.actors : []),
    }))
    .filter((f: any) => f.id && f.cast.length > 0);

  // 1. Collect all unique actor names
  const allActorNames = Array.from(new Set(castExtracted.flatMap((f: any) => f.cast)));
  const personIds = new Map();

  // 2. Resolve or create each actor
  for (const actorName of allActorNames) {
    try {
      // Tier 1: Exact match
      let { data: person } = await supabase
        .from('people').select('id, name').ilike('name', actorName).maybeSingle();

      // Tier 2: Partial match
      if (!person) {
        const { data: partial } = await supabase
          .from('people').select('id, name').ilike('name', `%${actorName}%`).limit(1).maybeSingle();
        if (partial) {
          person = partial;
          console.log(`[AI Maintenance] Fuzzy: "${actorName}" → "${partial.name}"`);
        }
      }

      // Tier 3: Create new person
      let personId = person?.id;
      if (!personId) {
        // // Shared matcher (migration 20260723112408): exact name, else
  // people.name_key (order-insensitive + honorific-stripped), so
  // "Kosoko Jide" / "Prince Jide Kosoko" resolve to the existing person.
        const { data: rpcId } = await supabase.rpc('upsert_person_by_name', {
          p_name: actorName,
          p_extra: { nationality: 'Nigerian', source: 'ai-maintenance' },
        });
        personId = rpcId as unknown as string;
      }
      if (personId) {
        personIds.set(actorName, personId);
      }
    } catch (e: any) {
      console.warn(`[AI Maintenance] Cast resolve error for "${actorName}":`, e.message);
    }
  }

  // 3. Gather updates
  const updatePromises = [];
  const creditsToInsert = [];

  for (const item of castExtracted) {
    if (item.new_title && item.new_title !== item.old_title) {
      updatePromises.push(supabase.from('films').update({ title: item.new_title }).eq('id', item.id));
    }

    for (const actorName of item.cast) {
      const personId = personIds.get(actorName);
      if (personId) {
        creditsToInsert.push({
          film_id: item.id, person_id: personId, role: 'actor', character_name: '', billing_order: 1
        });
      }
    }
  }

  // 4. Execute
  if (updatePromises.length > 0) {
    await Promise.all(updatePromises);
  }

  const uniqueCredits = [];
  const seenCredits = new Set();
  for (const c of creditsToInsert) {
    const key = `${c.film_id}-${c.person_id}`;
    if (!seenCredits.has(key)) {
      seenCredits.add(key);
      uniqueCredits.push(c);
    }
  }

  if (uniqueCredits.length > 0) {
    const filmIds = Array.from(new Set(uniqueCredits.map(c => c.film_id)));
    const { data: existingCredits } = await supabase
      .from('credits').select('film_id, person_id').in('film_id', filmIds);
      
    const existingSet = new Set((existingCredits || []).map((c: any) => `${c.film_id}-${c.person_id}`));
    const newCredits = uniqueCredits.filter(c => !existingSet.has(`${c.film_id}-${c.person_id}`));
    
    if (newCredits.length > 0) {
      await supabase.from('credits').insert(newCredits);
    }
  }

  return {
    analyzed: allCastFilms.length,
    extracted: castExtracted.length,
    applied: castExtracted.length,
    extracted_items: castExtracted.map((item: any) => ({
      film_id: item.id,
      old_title: item.old_title,
      new_title: item.new_title !== item.old_title ? item.new_title : undefined,
      extracted_cast: item.cast
    }))
  };
}

export async function runTitleCleanup() {
  console.log('[AI Maintenance] Starting title cleanup...');
  
  const { data: messyFilms } = await supabase
    .from('films')
    .select('id, title')
    .or('title.ilike.%|%,title.ilike.%YORUBA%,title.ilike.%MOVIE%,title.ilike.%PART%,title.ilike.%2024%,title.ilike.%2025%,title.ilike.%FULL%,title.ilike.%NIGERIAN%,title.ilike.%(%,title.ilike.%[%,title.ilike.%-%,title.ilike.%LATEST%')
    .order('created_at', { ascending: false })
    .limit(40);

  if (!messyFilms || messyFilms.length === 0) {
    return { analyzed: 0, message: 'No messy titles found' };
  }

  console.log(`[AI Maintenance] Cleaning ${messyFilms.length} messy titles...`);

  const titlePrompt = `
    You are a Nollywood database editor. 
    Clean up these movie titles by removing common YouTube marketing noise, years, and category labels.
    
    Rules:
    1. EXTRACT ONLY the actual movie title. 
    2. DISCARD all marketing buzzwords: "LATEST", "YORUBA MOVIE", "NIGERIAN MOVIE", "2024", "2025", "FULL MOVIE", "HD", "APA", "PART 1", etc.
    3. DISCARD all actor/cast lists separated by |, /, or hyphens.
    4. Proper Case: Convert ALL CAPS to Proper Case.
    5. If the title contains a pipe (|), remove the pipe and everything after it.
    
    Return ONLY JSON: [{"id": "...", "old_title": "...", "new_title": "..."}]
    
    Titles to clean: ${JSON.stringify(messyFilms)}
  `;

  const { text: titleText } = await generateAIContent(titlePrompt);
  const titleParsed = parseJSON(titleText);
  const titleChanges = titleParsed.filter((f: any) => f.old_title && f.new_title && f.old_title.trim() !== f.new_title.trim());

  let titlesApplied = 0;
  const titleUpdatePromises = titleChanges.map((item: any) => 
    supabase.from('films').update({ title: item.new_title }).eq('id', item.id)
  );

  if (titleUpdatePromises.length > 0) {
    const updateResults = await Promise.all(titleUpdatePromises);
    titlesApplied = updateResults.filter((res: any) => !res.error).length;
  }
  
  return {
    analyzed: messyFilms.length,
    changes: titleChanges.length,
    applied: titlesApplied,
    cleaned_items: titleChanges.map((item: any) => ({
      film_id: item.id,
      old_title: item.old_title,
      new_title: item.new_title
    }))
  };
}
