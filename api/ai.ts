import type { VercelRequest, VercelResponse } from '@vercel/node';
import { generateAIContent, parseJSON } from './_lib/ai_service';
import { supabase } from './_lib/supabase';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') return res.status(204).end();
  const { task, data } = req.body;

  try {
    switch (task) {
      case 'cleanup_films': return await cleanupFilms(res);
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
  // Fetch a larger batch searching for potential leaks
  const { data: films } = await supabase.from('films').select('id, title, synopsis').limit(50);
  if (!films) return res.json({ results: [] });

  const prompt = `
    Analyze these 50 films. Identify which ones are International/Hollywood/Foreign 
    and DO NOT Belong in a dedicated Nollywood/African database.
    
    Films: ${JSON.stringify(films)}
    
    Return EXACT JSON format:
    [{"id": "...", "title": "...", "is_african": false, "reason": "..."}]
  `;
  const { text, telemetry } = await generateAIContent(prompt);
  return res.json({ results: parseJSON(text), telemetry });
}

async function enrichMetadata(res: VercelResponse) {
  const { data: films } = await supabase.from('films').select('id, title').or('synopsis.is.null,synopsis.eq.""').limit(5);
  const { data: people } = await supabase.from('people').select('id, name').or('photo_url.is.null,photo_url.eq.""').limit(5);
  const { data: companies } = await supabase.from('companies').select('id, name').or('logo_url.is.null,logo_url.eq.""').limit(5);

  const missingData = { films, people, companies };
  const prompt = `
    Enrich this Nollywood metadata. 
    - Films: factual synopsis. Use sources like TMDB, IMDb, and kava.tv.
    - People/Companies: REAL photo/logo URL.
    - If no photo, use: https://ui-avatars.com/api/?name=NAME&background=random
    
    Return ONLY JSON: [{"type": "film/person/company", "id": "...", "name": "...", "synopsis": "...", "image_url": "..."}]
    Data: ${JSON.stringify(missingData)}
  `;

  const { text, telemetry } = await generateAIContent(prompt);
  return res.json({ results: parseJSON(text), telemetry });
}

async function discoverActors(data: any, res: VercelResponse) {
  const { region = 'Yoruba' } = data;
  const { data: existing } = await supabase.from('people').select('name').limit(1000);

  const prompt = `
    Research 20 UPCOMING actors from ${region} Nollywood. 
    Research across YouTube, social media, and kava.tv for recent releases.
    Exclude: ${JSON.stringify(existing)}.
    Return ONLY JSON: [{"name": "...", "bio": "...", "image_url": "...", "notable_movies": [], "type": "person"}]
  `;

  const { text, telemetry } = await generateAIContent(prompt);
  return res.json({ results: parseJSON(text), telemetry });
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
