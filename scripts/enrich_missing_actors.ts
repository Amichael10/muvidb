import { createClient } from '@supabase/supabase-js';
import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';

dotenv.config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY || !GEMINI_API_KEY) {
  console.error("Missing API keys in .env");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

// We will use gemini-2.5-flash as it is fast and supports JSON responseSchema
const model = genAI.getGenerativeModel({ 
  model: "gemini-2.5-flash",
  tools: [
    { googleSearch: {} } // Enable native Google Search Grounding
  ]
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
      // We'll instruct Gemini to use its native Google Search tool to find the information
      const prompt = `You are an expert Nollywood film historian with access to Google Search.
Your task is to search the web for accurate biographical details about the Nollywood actor/filmmaker "${person.name}".
Use your Google Search tool to find recent and accurate information, then extract their details and return it as a structured JSON object.
Rules:
- Write a compelling, 2-3 paragraph professional biography based on what you find online.
- Do NOT hallucinate. Only use facts present in your search results or from your deep knowledge of famous Nollywood actors.
- If you find an image URL representing them online (e.g. from Wikipedia, IMDb, or a news article), provide it.
- If a field cannot be reliably determined from your searches, return null.

IMPORTANT: You must return ONLY raw JSON matching this structure:
{
  "bio": "string or null",
  "date_of_birth": "YYYY-MM-DD or null",
  "birthplace": "string or null",
  "photo_url": "string or null"
}
Do NOT include markdown formatting or backticks around the JSON.

Please execute a search for: "${person.name} Nollywood actor biography date of birth"
`;

      console.log(`🧠 Asking Gemini to search Google and extract data...`);
      let responseText = "";
      let retries = 3;
      while (retries > 0) {
        try {
          const result = await model.generateContent(prompt);
          responseText = result.response.text();
          break; // Success
        } catch (err: any) {
          if (err.message?.includes('503') && retries > 1) {
            console.log(`   ⏳ Google servers busy (503). Retrying in 3 seconds...`);
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
