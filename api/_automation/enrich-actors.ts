import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from '../_lib/supabase';
import OpenAI from 'openai';

const XAI_API_KEY = process.env.XAI_API_KEY;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Only allow POST (for manual trigger) or Vercel Cron
  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!XAI_API_KEY) {
    await supabase.from('automation_jobs').upsert({
      id: 'actor_enricher',
      status: 'error',
      last_message: 'XAI_API_KEY is missing',
      last_run: new Date().toISOString()
    });
    return res.status(500).json({ error: 'Missing XAI_API_KEY' });
  }

  // Update status to running
  await supabase.from('automation_jobs').upsert({
    id: 'actor_enricher',
    status: 'running',
    last_message: 'Starting micro-batch...',
    last_run: new Date().toISOString()
  });

  const openai = new OpenAI({
    apiKey: XAI_API_KEY,
    baseURL: "https://api.x.ai/v1",
  });

  try {
    // 1. Fetch exactly 5 actors to avoid Vercel timeouts (10s hobby, 60s pro)
    const { data: people, error } = await supabase
      .from('people')
      .select('id, name')
      .or('bio.is.null,photo_url.is.null')
      .limit(5);

    if (error) throw error;

    if (!people || people.length === 0) {
      await supabase.from('automation_jobs').upsert({
        id: 'actor_enricher',
        status: 'idle',
        last_message: 'Finished: No actors missing details.',
        last_run: new Date().toISOString()
      });
      return res.status(200).json({ message: 'No actors missing details.' });
    }

    let processedCount = 0;
    let errorsCount = 0;

    for (const person of people) {
      const prompt = `You are an expert Nollywood film historian.
Your task is to provide accurate biographical details about the Nollywood actor/filmmaker "${person.name}".
Rules:
- Write a compelling, 2-3 paragraph professional biography based on your knowledge.
- Do NOT hallucinate. Only use facts you are certain about.
- If you know an image URL representing them online (e.g. from Wikipedia, IMDb, or a news article), provide it.
- If a field cannot be reliably determined, return null.

IMPORTANT: You must return ONLY raw JSON matching this structure:
{
  "bio": "string or null",
  "date_of_birth": "YYYY-MM-DD or null",
  "birthplace": "string or null",
  "photo_url": "string or null"
}
Do NOT include markdown formatting or backticks around the JSON.`;

      let responseText = "";
      let retries = 2; // Reduced retries for serverless context
      while (retries > 0) {
        try {
          const completion = await openai.chat.completions.create({
            model: "grok-2-latest",
            messages: [
              { role: "system", content: "You are a helpful assistant that outputs strict JSON without markdown." },
              { role: "user", content: prompt }
            ],
            temperature: 0.1,
          });
          responseText = completion.choices[0].message.content || "";
          break;
        } catch (err: any) {
          if ((err.status === 429 || err.status === 503) && retries > 1) {
            // Wait 1.5 seconds instead of 3 to save execution time
            await new Promise(resolve => setTimeout(resolve, 1500));
            retries--;
          } else {
            throw err;
          }
        }
      }

      responseText = responseText.replace(/\`\`\`json/g, '').replace(/\`\`\`/g, '').trim();

      let extractedData;
      try {
        extractedData = JSON.parse(responseText);
      } catch (jsonErr) {
        extractedData = {
          bio: responseText.length > 50 ? responseText : null,
          date_of_birth: null,
          birthplace: null,
          photo_url: null
        };
      }

      const { error: updateError } = await supabase
        .from('people')
        .update({
          bio: extractedData.bio || null,
          date_of_birth: extractedData.date_of_birth || null,
          birthplace: extractedData.birthplace || null,
          photo_url: extractedData.photo_url || null,
          updated_at: new Date().toISOString()
        })
        .eq('id', person.id);

      if (updateError) {
        errorsCount++;
      } else {
        processedCount++;
      }
    }

    await supabase.from('automation_jobs').upsert({
      id: 'actor_enricher',
      status: 'idle',
      last_message: `Success: Processed ${processedCount} actors (${errorsCount} errors)`,
      last_run: new Date().toISOString()
    });

    return res.status(200).json({ message: `Processed ${processedCount} actors.` });

  } catch (error: any) {
    console.error(error);
    await supabase.from('automation_jobs').upsert({
      id: 'actor_enricher',
      status: 'error',
      last_message: `Error: ${error.message}`,
      last_run: new Date().toISOString()
    });
    return res.status(500).json({ error: error.message });
  }
}
