import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../../.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase credentials in .env");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

function toTitleCase(str) {
  if (!str) return str;
  return str.toLowerCase().replace(/(?:^|[\s-'])\w/g, function(match) {
    return match.toUpperCase();
  });
}

async function formatNames() {
  console.log("Fetching people...");
  const { data: people, error: peopleError } = await supabase.from('people').select('id, name');
  if (peopleError) {
    console.error("Error fetching people:", peopleError);
    return;
  }

  let updatedPeopleCount = 0;
  for (const person of people) {
    if (!person.name) continue;
    const formatted = toTitleCase(person.name);
    if (formatted !== person.name) {
      const { error } = await supabase.from('people').update({ name: formatted }).eq('id', person.id);
      if (error) console.error(`Error updating person ${person.id}:`, error);
      else {
        console.log(`Updated person: ${person.name} -> ${formatted}`);
        updatedPeopleCount++;
      }
    }
  }

  console.log("Fetching credits...");
  const { data: credits, error: creditsError } = await supabase.from('credits').select('id, role, character_name');
  if (creditsError) {
    console.error("Error fetching credits:", creditsError);
    return;
  }

  let updatedCreditsCount = 0;
  for (const credit of credits) {
    let updatePayload = {};
    if (credit.role) {
      const formattedRole = toTitleCase(credit.role);
      if (formattedRole !== credit.role) updatePayload.role = formattedRole;
    }
    if (credit.character_name) {
      const formattedChar = toTitleCase(credit.character_name);
      if (formattedChar !== credit.character_name) updatePayload.character_name = formattedChar;
    }

    if (Object.keys(updatePayload).length > 0) {
      const { error } = await supabase.from('credits').update(updatePayload).eq('id', credit.id);
      if (error) console.error(`Error updating credit ${credit.id}:`, error);
      else {
        console.log(`Updated credit ${credit.id}:`, updatePayload);
        updatedCreditsCount++;
      }
    }
  }

  console.log(`Done! Updated ${updatedPeopleCount} people and ${updatedCreditsCount} credits.`);
}

formatNames();
