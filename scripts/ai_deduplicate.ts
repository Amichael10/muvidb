import { createClient } from '@supabase/supabase-js';
import { GoogleGenerativeAI } from '@google/generative-ai';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY || !GEMINI_API_KEY) {
  console.error("Missing API keys in .env");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

const OUTPUT_FILE = path.resolve(__dirname, '../duplicates_to_approve.json');

async function generateDuplicatesList() {
  console.log('🔍 Fetching people and their credit counts...');
  
  // We fetch people and the number of credits to prioritize the survivor (the one with more credits)
  const { data: people, error } = await supabase
    .from('people')
    .select('id, name, credits(count)');

  if (error || !people) {
    console.error("Error fetching people:", error?.message);
    return;
  }

  // Filter out those with no credits to make it cleaner, or keep all.
  // The user mentioned "cast that appear more than 5 times" but we can check all of them,
  // or at least prioritize the ones with >= 5 credits as the "correct" name.
  console.log(`Fetched ${people.length} people.`);
  
  const names = people.map(p => p.name);
  
  // We can pass the list of names to Gemini
  console.log(`🤖 Asking Gemini to find fuzzy duplicates among ${names.length} names...`);
  console.log('This might take a minute depending on the number of names.');

  const prompt = `You are a data cleaner for a Nollywood film database. 
I am going to provide you with a list of actor names. 
Many of these names are slight typos or variations of the same person. 
Your task is to identify names that are fuzzy duplicates of each other. 
Usually, the more correctly spelled or standard name should be the "survivor".

Return a raw JSON array of objects with this exact structure:
[
  {
    "survivor": "Correct Name",
    "duplicates": ["Typo Name 1", "Typo Name 2"]
  }
]

Do not include any markdown formatting, backticks, or explanation. ONLY return the JSON array.
Only group names if you are highly confident they refer to the same person.
Only use names that EXACTLY appear in the list provided.

Here is the list of names:
${names.join('\n')}
`;

  try {
    const result = await model.generateContent(prompt);
    let text = result.response.text();
    text = text.replace(/\`\`\`json/g, '').replace(/\`\`\`/g, '').trim();
    
    const parsed = JSON.parse(text);
    console.log(`✅ Gemini identified ${parsed.length} groups of potential duplicates.`);
    
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(parsed, null, 2));
    console.log(`💾 Saved potential duplicates to ${OUTPUT_FILE}`);
    console.log(`Please review the file. Then run this script with --apply to merge them.`);

  } catch (err: any) {
    console.error('❌ Error calling Gemini or parsing JSON:', err.message);
  }
}

async function applyDuplicates() {
  if (!fs.existsSync(OUTPUT_FILE)) {
    console.error(`❌ Could not find ${OUTPUT_FILE}. Please run without --apply first to generate it.`);
    return;
  }

  const groups = JSON.parse(fs.readFileSync(OUTPUT_FILE, 'utf-8'));
  console.log(`🚀 Applying ${groups.length} duplicate groups...`);

  let mergedCount = 0;

  for (const group of groups) {
    const survivorName = group.survivor;
    const duplicateNames = group.duplicates;

    if (!survivorName || !duplicateNames || duplicateNames.length === 0) continue;

    console.log(`\n👤 Processing Group: Survivor -> ${survivorName}`);
    
    // Find survivor in DB
    const { data: survivorRecords } = await supabase.from('people').select('id, name, photo_url').ilike('name', survivorName).limit(1);
    let survivor = survivorRecords?.[0];

    if (!survivor) {
      console.log(`  ⚠️ Survivor '${survivorName}' not found in DB. Skipping group.`);
      continue;
    }

    for (const dupName of duplicateNames) {
      // Find duplicate in DB
      const { data: dupRecords } = await supabase.from('people').select('id, name').ilike('name', dupName);
      
      if (!dupRecords || dupRecords.length === 0) {
        console.log(`  ⚠️ Duplicate '${dupName}' not found in DB. Skipping.`);
        continue;
      }

      for (const dup of dupRecords) {
        if (dup.id === survivor.id) continue;

        console.log(`  🔗 Merging '${dup.name}' (${dup.id}) into '${survivor.name}' (${survivor.id})`);

        // Move credits
        const { data: dupCredits } = await supabase.from('credits').select('*').eq('person_id', dup.id);
        if (dupCredits) {
          for (const credit of dupCredits) {
            await supabase.from('credits').update({ person_id: survivor.id }).match({ film_id: credit.film_id, person_id: dup.id, role: credit.role });
            await supabase.from('credits').delete().match({ film_id: credit.film_id, person_id: dup.id, role: credit.role });
          }
        }

        // Delete duplicate
        const { error: deleteError } = await supabase.from('people').delete().eq('id', dup.id);
        if (deleteError) {
          console.error(`  ❌ Failed to delete ${dup.name}:`, deleteError.message);
        } else {
          mergedCount++;
        }
      }
    }
  }

  console.log(`\n✅ Finished! Merged ${mergedCount} duplicate records.`);
}

const isApply = process.argv.includes('--apply');

if (isApply) {
  applyDuplicates().catch(console.error);
} else {
  generateDuplicatesList().catch(console.error);
}
