import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

function toTitleCase(str: string): string {
  if (!str) return str;
  return str.toLowerCase().replace(/(?:^|[\s-'])\w/g, function(match) {
    return match.toUpperCase();
  });
}

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL!,
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function run() {
  const { data: people, error } = await supabase.from('people').select('id, name');
  if (error) {
    console.error('Error fetching people:', error);
    return;
  }

  let updatedCount = 0;
  for (const person of people) {
    if (person.name) {
      const fixedName = toTitleCase(person.name);
      if (person.name !== fixedName) {
        // Double check it's all caps or improperly cased
        console.log(`Fixing: ${person.name} -> ${fixedName}`);
        const { error: updateError } = await supabase
          .from('people')
          .update({ name: fixedName })
          .eq('id', person.id);
        
        if (updateError) {
          console.error(`Error updating ${person.id}:`, updateError);
        } else {
          updatedCount++;
        }
      }
    }
  }

  console.log(`Updated ${updatedCount} people names.`);
}

run();
