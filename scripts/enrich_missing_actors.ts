import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import * as dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const XAI_API_KEY = process.env.XAI_API_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY || !XAI_API_KEY) {
  console.error("Missing API keys in .env.local");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const openai = new OpenAI({
  apiKey: XAI_API_KEY,
  baseURL: "https://api.x.ai/v1",
});

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function enrichActors() {
  console.log("🕵️‍♂️ Starting AI Actor Enrichment script...");

  // 1. Fetch up to 20 actors missing a bio or profile_image
  const { data: people, error } = await supabase
    .from('people')
    .select('id, name')
    .or('bio.is.null,photo_url.is.null')
    .limit(20);

  if (error) {
    console.error("Error fetching people:", error.message);
    return;
  }

  if (!people || people.length === 0) {
    console.log("🎉 No actors with missing details found! Database is fully enriched.");
    return;
  }

  console.log(`Found ${people.length} actors missing details. Beginning enrichment...`);

  for (const person of people) {
    console.log(`\n================================`);
    console.log(`👤 Processing: ${person.name}`);
    
    try {
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

      console.log(`🧠 Asking Grok to extract data...`);
      let responseText = "";
      let retries = 3;
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
          break; // Success
        } catch (err: any) {
          if (err.status === 429 || err.status === 503) {
            console.log(`   ⏳ xAI servers busy or rate limited. Retrying in 3 seconds...`);
            await sleep(3000);
            retries--;
          } else {
            throw err;
          }
        }
      }
      
      // Clean up markdown if the AI accidentally adds it
      responseText = responseText.replace(/\`\`\`json/g, '').replace(/\`\`\`/g, '').trim();
      
      let extractedData;
      try {
        extractedData = JSON.parse(responseText);
      } catch (jsonErr) {
        console.log(`   ⚠️ Gemini didn't return valid JSON. Assuming no info found.`);
        // Default to safe empty values
        extractedData = {
          bio: responseText.length > 50 ? responseText : null, // Save text as bio if it gave a paragraph explanation
          date_of_birth: null,
          birthplace: null,
          photo_url: null
        };
      }
      
      console.log(`✅ Extracted Data:`);
      console.log(extractedData);

      // 4. Update the database
      const { error: updateError } = await supabase
        .from('people')
        .update({
          bio: extractedData.bio,
          date_of_birth: extractedData.date_of_birth,
          birthplace: extractedData.birthplace,
          photo_url: extractedData.photo_url,
          updated_at: new Date().toISOString()
        })
        .eq('id', person.id);

      if (updateError) {
        console.error(`❌ Failed to update ${person.name} in DB:`, updateError.message);
      } else {
        console.log(`💾 Successfully saved details for ${person.name} to the database!`);
      }
      
    } catch (err: any) {
      console.error(`❌ Error processing ${person.name}:`, err.message);
    }

    // Rate limiting delay
    await sleep(2000);
  }
  
  console.log(`\n🎉 Script finished processing this batch of ${people.length} actors!`);
}

enrichActors().catch(console.error);
