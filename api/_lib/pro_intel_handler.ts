import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from './supabase.js';
import { generateAIContent, parseJSON, hasCohere } from './ai_service.js';

export async function handleProIntelQuery(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { query, history = [] } = req.body || {};
  const q = String(query || '').trim();

  if (!q || q.length < 3) {
    return res.status(400).json({ error: 'Query is too short' });
  }

  try {
    // 1. Retrieve relevant entities from database based on keywords in query
    const keywords = q
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length >= 3)
      .slice(0, 6);

    let retrievedFilms: any[] = [];
    let retrievedPeople: any[] = [];
    let retrievedBoxOffice: any[] = [];

    if (keywords.length > 0) {
      const orFilter = keywords.map((k) => `title.ilike.%${k}%`).join(',');
      const peopleOrFilter = keywords.map((k) => `name.ilike.%${k}%`).join(',');

      const [filmRes, peopleRes, boRes] = await Promise.all([
        supabase
          .from('films')
          .select('id, title, year, synopsis, language, release_type, view_count, average_rating, tmdb_rating')
          .or(orFilter)
          .limit(10),
        supabase
          .from('people')
          .select('id, name, known_for_department, film_count, popularity_score, bio')
          .or(peopleOrFilter)
          .limit(10),
        supabase
          .from('films')
          .select('title, year, view_count, liked_percent')
          .order('view_count', { ascending: false, nullsFirst: false })
          .limit(10),
      ]);

      retrievedFilms = filmRes.data || [];
      retrievedPeople = peopleRes.data || [];
      retrievedBoxOffice = boRes.data || [];
    }

    // Fetch credits for retrieved people
    let peopleCredits: { person: string; film: string; role: string; year?: number }[] = [];
    if (retrievedPeople.length > 0) {
      const pIds = retrievedPeople.map((p) => p.id);
      const { data: creditsData } = await supabase
        .from('credits')
        .select('role, people(name), films(title, year)')
        .in('person_id', pIds)
        .limit(30);

      if (creditsData) {
        peopleCredits = creditsData.map((c: any) => ({
          person: c.people?.name || 'Unknown',
          film: c.films?.title || 'Unknown',
          role: c.role,
          year: c.films?.year,
        }));
      }
    }

    // 2. Build Grounded Context FactPack
    const contextFactPack = {
      matchedFilms: retrievedFilms.map((f) => ({
        title: f.title,
        year: f.year,
        language: f.language,
        release_type: f.release_type,
        synopsis: f.synopsis ? f.synopsis.slice(0, 300) : 'N/A',
        views: f.view_count,
        rating: f.average_rating || f.tmdb_rating,
      })),
      matchedPeople: retrievedPeople.map((p) => ({
        name: p.name,
        department: p.known_for_department,
        film_count: p.film_count,
        popularity: p.popularity_score,
      })),
      verifiedCredits: peopleCredits.slice(0, 25),
      topCatalogHighlights: retrievedBoxOffice.slice(0, 5).map((b) => ({
        title: b.title,
        year: b.year,
        views: b.view_count,
      })),
    };

    // 3. Grounded Cohere Prompt
    const systemPrompt = `You are the MuviDB Pro Intelligence Analyst, an expert on African Cinema, Nollywood, streaming distribution, and industry talent intelligence.
You provide precise, professional, executive-grade answers to industry inquiries grounded strictly in verified data.

Verified Database Context:
${JSON.stringify(contextFactPack, null, 2)}

User Question: "${q}"

Instructions:
1. Provide a comprehensive, insightful answer in clean Markdown.
2. Ground all specific claims, credits, and release details in the verified context provided above or widely verified Nollywood history.
3. If comparing talent, format the comparison clearly with bullet points or a markdown table.
4. Include 2-3 helpful follow-up discovery questions at the end under a "### Suggested Inquiries" section.

Return a JSON object:
{
  "answer": "Comprehensive markdown response",
  "entities": [
    { "name": "Entity Name", "type": "person" | "film" }
  ],
  "suggestedQueries": ["Follow-up question 1", "Follow-up question 2"]
}`;

    const { text, telemetry } = await generateAIContent(systemPrompt, {
      preferredProvider: 'cohere',
    });

    const parsed = parseJSON(text);

    return res.status(200).json({
      success: true,
      answer: parsed?.answer || text,
      entities: parsed?.entities || [],
      suggestedQueries: parsed?.suggestedQueries || [],
      engine: telemetry?.engine || 'cohere-command-r-plus',
    });
  } catch (err: any) {
    console.error('[pro-intel] Query execution error:', err?.message || err);
    return res.status(500).json({
      error: err?.message || 'Pro Intelligence analysis failed',
    });
  }
}
