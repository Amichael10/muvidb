import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY!
);

const CLASSIC_1992_ID = 'ea4afcd0-f8d3-424a-836a-8fb1b9201255';
const SEQUEL_2019_ID = 'ea531942-ad87-4faa-8b31-24bf5160be33';

async function cleanupCredits() {
  console.log('Cleaning up Living in Bondage 1992 vs 2019 credits...');

  // 1. Fetch credits for 1992
  const { data: creds1992 } = await supabase
    .from('credits')
    .select('id, person_id, role, character_name, people(id, name)')
    .eq('film_id', CLASSIC_1992_ID);

  // Modern 2019 actors who were NOT in 1992
  const modernActorNames = [
    'Nancy Isime',
    'Shawn Faqua',
    'Jideofor Kenechukwu Achufusi',
    'Jide Kene Achufusi',
    'Munachi Abii',
    'Enyinna Nwigwe'
  ];

  for (const c of creds1992 || []) {
    const personName = (c as any).people?.name;
    if (personName && modernActorNames.some(m => personName.toLowerCase().includes(m.toLowerCase()))) {
      console.log(`Moving credit for ${personName} from 1992 to 2019 sequel...`);
      // Check if already in 2019
      const { data: existingIn2019 } = await supabase
        .from('credits')
        .select('id')
        .eq('film_id', SEQUEL_2019_ID)
        .eq('person_id', c.person_id);

      if (existingIn2019 && existingIn2019.length > 0) {
        // Just delete the duplicate from 1992
        await supabase.from('credits').delete().eq('id', c.id);
        console.log(`Deleted misplaced 1992 credit for ${personName} (already present in 2019)`);
      } else {
        // Reassign to 2019
        await supabase.from('credits').update({ film_id: SEQUEL_2019_ID }).eq('id', c.id);
        console.log(`Reassigned ${personName} to 2019 sequel`);
      }
    }
  }

  // Deduplicate any repeated credits on 1992
  const { data: final1992 } = await supabase
    .from('credits')
    .select('id, person_id, role, character_name, people(name)')
    .eq('film_id', CLASSIC_1992_ID);

  const seen1992 = new Set<string>();
  for (const c of final1992 || []) {
    const key = `${c.person_id}`;
    if (seen1992.has(key)) {
      await supabase.from('credits').delete().eq('id', c.id);
      console.log(`Removed duplicate credit row in 1992 for ${(c as any).people?.name}`);
    } else {
      seen1992.add(key);
    }
  }

  // Remove Ramsey Nouah from 1992 classic (he was not in the 1992 film)
  const { data: ramsey } = await supabase.from('people').select('id').eq('name', 'Ramsey Nouah').single();
  if (ramsey) {
    await supabase.from('credits').delete().eq('film_id', CLASSIC_1992_ID).eq('person_id', ramsey.id);
    console.log('Removed Ramsey Nouah from 1992 classic');
  }

  // Update Kanayo O. Kanayo on 1992 to Chief Omego
  const { data: kok } = await supabase.from('people').select('id').eq('name', 'Kanayo O. Kanayo').single();
  if (kok) {
    await supabase.from('credits').update({ character_name: 'Chief Omego' }).eq('film_id', CLASSIC_1992_ID).eq('person_id', kok.id);
  }

  console.log('Finished Living in Bondage credit separation!');
}

cleanupCredits().catch(console.error);
