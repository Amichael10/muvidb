import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY!
);

const RMD_ID = '676620ec-5004-41df-944f-e39b3ee62e54';

// Titles where RMD was incorrectly credited as 'director' or 'producer' by automated scripts
// while being purely an actor in the cast:
const FALSE_DIRECTOR_TITLES = [
  'the wedding party',
  'the wedding party 2',
  '30 days in atlanta',
  'gold statue',
  'palava',
  'fine wine',
  'the stand up',
  'conversations in transit',
  'the new normal',
  'radio voice',
  'suspicion',
  'four four forty four',
  'four four forty-four',
  "okafor's law",
  'okafors law',
  'namaste wahala',
  'god calling',
  'a land apart',
  'the black book 2 - old scores',
  'the black book 2: old scores',
  'phoenix fury',
  'made in heaven',
  'christmas in lagos'
];

async function main() {
  console.log('=== Step 1: Cleaning false director/producer credits for RMD ===');
  const { data: rmdCredits } = await supabase
    .from('credits')
    .select('id, role, film_id, films(title)')
    .eq('person_id', RMD_ID)
    .in('role', ['director', 'producer']);

  const falseCreditsToDelete: string[] = [];
  for (const c of (rmdCredits || [])) {
    const title = ((c.films as any)?.title || '').toLowerCase().trim();
    if (c.role === 'director' && FALSE_DIRECTOR_TITLES.some(t => title.includes(t) || t.includes(title))) {
      console.log(`Found false director credit for RMD: [${c.id}] in "${(c.films as any)?.title}"`);
      falseCreditsToDelete.push(c.id);
    }
  }

  if (falseCreditsToDelete.length > 0) {
    console.log(`Deleting ${falseCreditsToDelete.length} false director credits for RMD...`);
    const { error: delErr } = await supabase
      .from('credits')
      .delete()
      .in('id', falseCreditsToDelete);
    if (delErr) console.error('Error deleting credits:', delErr);
    else console.log('Successfully deleted false director credits!');
  } else {
    console.log('No false director credits found.');
  }
}

main().catch(console.error);
