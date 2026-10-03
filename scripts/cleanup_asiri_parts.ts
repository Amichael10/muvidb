import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

async function main() {
  const part1Survivor = '819c4a6d-78af-4798-9769-f6d0f7715820';
  const part1Victim = '776a1df9-2875-4f85-a879-4db3e58337b3';
  const part2Id = '312f9b2d-451e-4a21-9d2b-65ada71b4d0f';

  // Merge victim credits into survivor
  const { data: credits } = await supabase.from('credits').select('*').eq('film_id', part1Victim);
  for (const c of credits || []) {
    await supabase.from('credits').upsert({
      film_id: part1Survivor,
      person_id: c.person_id,
      role: c.role,
      character_name: c.character_name,
    }, { onConflict: 'film_id,person_id,role' });
  }
  await supabase.from('credits').delete().eq('film_id', part1Victim);
  await supabase.from('film_genres').delete().eq('film_id', part1Victim);
  await supabase.from('platform_new_releases').delete().eq('film_id', part1Victim);
  await supabase.from('films').delete().eq('id', part1Victim);

  // Update titles to include Part 1 and Part 2
  await supabase.from('films').update({ title: 'Asiri Ilu Awan Osu Part 1' }).eq('id', part1Survivor);
  await supabase.from('films').update({ title: 'Asiri Ilu Awan Osu Part 2' }).eq('id', part2Id);

  console.log('✅ Asiri Ilu Awan Osu parts cleaned up and renamed correctly!');
}

main().catch(console.error);
