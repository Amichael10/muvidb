import type { VercelRequest, VercelResponse } from '@vercel/node';
import { generateAIContent, parseJSON } from './_lib/ai_service';
import { supabase } from './_lib/supabase';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') return res.status(204).end();
  const { task, data } = req.body;

  try {
    switch (task) {
      case 'cleanup_films': return await cleanupFilms(res);
      case 'cleanup_people': return await cleanupPeople(res);
      case 'enrich_metadata': return await enrichMetadata(res);
      case 'discover_actors': return await discoverActors(data, res);
      case 'deduplicate': return await mergeDuplicates(data, res);
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
    - People: Detailed biography and a REAL high-quality photo URL.
    - Companies: Logo URL and full description.
    - If no photo/logo found, use: https://ui-avatars.com/api/?name=NAME&background=random
    
    Return ONLY JSON: [{"type": "film/person/company", "id": "...", "name": "...", "synopsis": "...", "bio": "...", "image_url": "..."}]
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
    
    Return ONLY JSON: [{"name": "...", "bio": "...", "image_url": "...", "notable_movies": [], "type": "person"}]
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
