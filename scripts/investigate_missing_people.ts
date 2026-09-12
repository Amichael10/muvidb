import 'dotenv/config';
import { supabase } from './lib/db';

async function investigate() {
  console.log('🔍 Investigating missing people records...\n');

  const terms = ['Hakeem', 'Onilogbo', 'Effect', 'Thelma', 'Bamgboye', 'Adeola'];

  for (const term of terms) {
    console.log(`=== SEARCHING: "${term}" ===`);
    
    // 1. Search in `people` table
    const { data: people, error: pErr } = await supabase
      .from('people')
      .select('id, name, slug, created_at, updated_at, bio, photo_url, tmdb_id, imdb_id')
      .or(`name.ilike.%${term}%,slug.ilike.%${term}%,bio.ilike.%${term}%`);

    console.log(`[people table] (${people?.length || 0} matches):`);
    for (const p of people || []) {
      console.log(`  - ID: ${p.id} | Name: "${p.name}" | Slug: "${p.slug}" | Created: ${p.created_at}`);
    }

    // 2. Search in `credits` table by person_name
    const { data: credits, error: cErr } = await supabase
      .from('credits')
      .select('id, person_name, person_id, role, department, film_id')
      .ilike('person_name', `%${term}%`)
      .limit(10);

    console.log(`[credits table by person_name] (${credits?.length || 0} matches):`);
    for (const c of credits || []) {
      console.log(`  - Credit: "${c.person_name}" | Role: ${c.role} | person_id: ${c.person_id}`);
    }

    // 3. Search in `profiles` / `users`
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name, email, role, created_at')
      .or(`full_name.ilike.%${term}%,email.ilike.%${term}%`);

    if (profiles && profiles.length > 0) {
      console.log(`[profiles table] (${profiles.length} matches):`);
      for (const pr of profiles) {
        console.log(`  - Profile ID: ${pr.id} | Full Name: "${pr.full_name}" | Email: ${pr.email}`);
      }
    }

    console.log('');
  }
}

investigate().catch(console.error);
