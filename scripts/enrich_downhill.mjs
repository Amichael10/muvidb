import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || 'https://pkenrmorywmuvnzfoylp.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function enrichDownhillCredits() {
  const filmId = 'd7181682-e0f8-434a-b4ed-e9b35c725be7';
  console.log('Enriching Downhill credits...');

  const cast = [
    { name: 'Bimbo Ademoye', role: 'actor', billing: 1 },
    { name: 'Blossom Chukwujekwu', role: 'actor', billing: 2 },
    { name: 'Deyemi Okanlawon', role: 'actor', billing: 3 },
    { name: 'Ovi Odiette', role: 'actor', billing: 4 },
    { name: 'Florence Sunday', role: 'actor', billing: 5 },
    { name: 'Stephen Damian', role: 'actor', billing: 6 },
    { name: 'Michael Akinrogunde', role: 'director', billing: 0 },
  ];

  // Remove existing rough credits
  await supabase.from('credits').delete().eq('film_id', filmId);

  for (const c of cast) {
    // Find or create person
    let { data: person } = await supabase
      .from('people')
      .select('id, name')
      .ilike('name', c.name)
      .maybeSingle();

    if (!person) {
      const { data: newPerson, error } = await supabase
        .from('people')
        .insert({
          name: c.name,
          primary_role: c.role,
        })
        .select('id, name')
        .single();
      person = newPerson;
      console.log(`Created person: ${c.name} (${person?.id})`);
    } else {
      console.log(`Found person: ${c.name} (${person.id})`);
    }

    if (person) {
      await supabase.from('credits').insert({
        film_id: filmId,
        person_id: person.id,
        role: c.role,
        billing_order: c.billing,
      });
      console.log(`Linked credit: [${c.role.toUpperCase()}] ${c.name}`);
    }
  }

  // Also update film year / metadata
  await supabase.from('films').update({
    year: 2024,
    needs_review: false,
    content_type: 'movie',
    release_type: 'nollistream',
  }).eq('id', filmId);

  console.log('🎉 Downhill enriched successfully!');
}

enrichDownhillCredits();
