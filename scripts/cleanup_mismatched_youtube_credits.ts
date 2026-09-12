import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config();
import { supabase } from './lib/db';

async function cleanupMismatchedCredits() {
  console.log('🧹 Identifying and cleaning up mismatched credits on YouTube films...\n');

  const mismatchedCreditIds = [
    'ff710688-a1aa-48b5-a60e-a8d3066ad156', // Jim Anderson on Love and Anger
    '4b087a69-8623-4041-8f1b-ca2d241bcb4f', // Ellie Foumbi on Home
    'ef3f237d-798f-462b-8068-abe15244865c', // Chris Jarman on RUN
    '1adadec3-2b1f-46ef-ae1a-754411e51dc8', // Judy on The Wedding Planner
    'aa4fdfa5-83c9-4b35-9737-9215768b8b12', // Judy on Love Happens
    '798537be-70bb-4159-b028-8a1aa9380536', // PETER PAUL on Double Trouble
    '58b50bd6-517f-4483-af1c-217f178900ac', // Mawar Eva De Jongh on Sin
    '713e0194-85f4-437d-941d-1291bf7dddb0', // Wole Ojo on The Plot
    '08a578b6-e5c0-4f7e-9bda-ffe1c8b7e0b5', // Shola Giwa on The Visit (foreign match)
  ];

  for (const id of mismatchedCreditIds) {
    const { data: credit } = await supabase
      .from('credits')
      .select('id, film_id, person_id, role, character_name, source, films(title), people(name)')
      .eq('id', id)
      .single();

    if (credit) {
      console.log(`Deleting mismatched credit: "${(credit as any).people?.name}" on film "${(credit as any).films?.title}" (ID: ${id})`);
      const { error: delErr } = await supabase.from('credits').delete().eq('id', id);
      if (delErr) {
        console.error(`  ❌ Error deleting credit ${id}:`, delErr);
      } else {
        console.log(`  ✅ Successfully removed.`);
      }
    }
  }

  console.log('\n🎉 Cleanup of mismatched credits complete!');
}

cleanupMismatchedCredits().catch(console.error);
