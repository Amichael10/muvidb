import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import path from 'path';
import { generateAIContent } from '../api/_lib/ai_service';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const cohereKey = process.env.COHERE_API_KEY || process.env.COHERE_API_KEY_1;
const cohereModel = process.env.COHERE_CHAT_MODEL || 'command-r-plus-08-2024';

async function generateWithCohereRest(prompt: string): Promise<string | null> {
  if (!cohereKey) return null;
  try {
    const res = await fetch('https://api.cohere.com/v2/chat', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${cohereKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: cohereModel,
        messages: [{ role: 'user', content: prompt }],
      }),
    });
    if (!res.ok) {
      console.warn(`[Cohere API] ${res.status} ${res.statusText}`);
      return null;
    }
    const data: any = await res.json();
    const text = data?.message?.content?.[0]?.text || data?.text;
    return text ? text.trim() : null;
  } catch (err: any) {
    console.warn(`[Cohere REST] Error: ${err.message}`);
    return null;
  }
}

async function generateSynopsis(title: string, year?: number | null, description?: string | null): Promise<string | null> {
  const prompt = `You are a film editor for MuviDB, the premier African and Nollywood film database.
Write a clean, compelling 2-4 sentence plot synopsis for the movie titled "${title}"${year ? ` (${year})` : ''}.
${description ? `Source description: ${description.slice(0, 800)}` : ''}

Strict Rules:
1. Focus strictly on the movie's plot and story arc.
2. Do NOT include cast lists, actor names, director names, social media links, hashtags, or channel promotion.
3. Return ONLY the synopsis text, with no introduction or markdown quotes.`;

  // 1. Attempt Cohere REST API directly if key available
  let synopsis = await generateWithCohereRest(prompt);

  // 2. Fallback to unified AI service (Gemini / Groq / OpenAI)
  if (!synopsis) {
    try {
      const res = await generateAIContent(prompt);
      if (res?.text && res.text.trim().length > 20) {
        synopsis = res.text.trim();
      }
    } catch (err: any) {
      console.error(`[AI Service] Error for "${title}": ${err.message}`);
    }
  }

  return synopsis && synopsis.length > 20 ? synopsis : null;
}

async function main() {
  console.log('🚀 STARTING COHERE MOVIE SYNOPSIS BACKFILL (RECENT FIRST)...');
  if (cohereKey) {
    console.log(`ℹ️  Using Cohere REST API directly (${cohereModel}).`);
  } else {
    console.log(`ℹ️  Cohere API key not set in env; using multi-provider AI service (Gemini/Groq/OpenAI).`);
  }

  const BATCH_SIZE = 50;
  let totalProcessed = 0;
  let totalEnriched = 0;
  let hasMore = true;
  let page = 0;

  while (hasMore) {
    console.log(`\nFetching batch ${page + 1} of films needing synopsis (ordered by created_at DESC)...`);

    const { data: films, error } = await supabase
      .from('films')
      .select('id, title, year, synopsis, youtube_watch_url, created_at')
      .or('synopsis.is.null,synopsis.eq.')
      .order('created_at', { ascending: false })
      .range(page * BATCH_SIZE, (page + 1) * BATCH_SIZE - 1);

    if (error) {
      console.error('❌ Error querying films:', error);
      break;
    }

    if (!films || films.length === 0) {
      console.log('✅ No more films found requiring synopsis enrichment.');
      hasMore = false;
      break;
    }

    console.log(`Processing ${films.length} films in current batch...`);

    for (let i = 0; i < films.length; i++) {
      const film = films[i];
      totalProcessed++;
      console.log(`\n[${totalProcessed}] "${film.title}" (${film.year || 'N/A'}) [Created: ${film.created_at || 'N/A'}]`);

      const synopsis = await generateSynopsis(film.title, film.year);

      if (synopsis) {
        const { error: updateErr } = await supabase
          .from('films')
          .update({ synopsis, needs_review: false })
          .eq('id', film.id);

        if (updateErr) {
          console.error(`  ❌ Failed to update DB for "${film.title}":`, updateErr.message);
        } else {
          console.log(`  ✅ ENRICHED SYNOPSIS: ${synopsis.slice(0, 120)}...`);
          totalEnriched++;
        }
      } else {
        console.log(`  ⚠️ Could not generate synopsis for "${film.title}"`);
      }

      // Small pacing delay to avoid aggressive rate-limiting
      await new Promise(r => setTimeout(r, 600));
    }

    page++;
    if (films.length < BATCH_SIZE) {
      hasMore = false;
    }
  }

  console.log(`\n🎉 BACKFILL COMPLETE! Processed ${totalProcessed} films, successfully enriched ${totalEnriched} synopses.`);
}

main().catch(console.error);
