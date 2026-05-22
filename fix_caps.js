import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

function toTitleCase(str) {
  if (!str) return str;
  return str.toLowerCase().replace(/(?:^|[\s-'])\w/g, function(match) {
    return match.toUpperCase();
  });
}

async function fixPeople() {
  console.log('Fetching people...');
  const { data: people, error } = await supabase.from('people').select('id, name');
  if (error) {
    console.error('Error fetching people:', error);
    return;
  }

  console.log(Found $ people. Checking for format issues...);
  
  let updatedCount = 0;
  for (const person of people) {
    const newName = toTitleCase(person.name);
    if (newName !== person.name) {
      console.log(Updating "$" -> "$");
      const { error: updateError } = await supabase.from('people').update({ name: newName }).eq('id', person.id);
      if (updateError) {
        console.error(Error updating person $:, updateError);
      } else {
        updatedCount++;
      }
    }
  }
  console.log(Updated $ people.);
}

async function fixCredits() {
  console.log('Fetching credits...');
  const { data: credits, error } = await supabase.from('credits').select('id, role, character_name');
  if (error) {
    console.error('Error fetching credits:', error);
    return;
  }

  console.log(Found $ credits. Checking for format issues...);
  
  let updatedCount = 0;
  for (const credit of credits) {
    let changed = false;
    const payload = {};
    
    if (credit.role) {
      const newRole = toTitleCase(credit.role);
      if (newRole !== credit.role) {
        payload.role = newRole;
        changed = true;
      }
    }
    
    if (credit.character_name) {
      const newChar = toTitleCase(credit.character_name);
      if (newChar !== credit.character_name) {
        payload.character_name = newChar;
        changed = true;
      }
    }
    
    if (changed) {
      console.log(Updating credit $: role "$" -> "$", char "$" -> "$");
      const { error: updateError } = await supabase.from('credits').update(payload).eq('id', credit.id);
      if (updateError) {
        console.error(Error updating credit $:, updateError);
      } else {
        updatedCount++;
      }
    }
  }
  console.log(Updated $ credits.);
}

async function main() {
  await fixPeople();
  await fixCredits();
}

main();
