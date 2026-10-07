import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY!
);

async function main() {
  console.log('=== Step 1: Restoring 1992 Classic "Living in Bondage" ===');

  // Check if 1992 classic exists
  const { data: existing1992 } = await supabase
    .from('films')
    .select('id, title, year')
    .ilike('title', 'Living in Bondage')
    .eq('year', 1992);

  let classic1992Id = existing1992?.[0]?.id;

  if (!classic1992Id) {
    const { data: new1992, error: insErr } = await supabase
      .from('films')
      .insert({
        title: 'Living in Bondage',
        year: 1992,
        release_date: '1992-01-01',
        release_type: 'video',
        source: 'manual',
        synopsis: 'Desperate for wealth and success, Andy Okeke is persuaded by a friend to join a secret cult that demands the ritual sacrifice of his loyal wife Merit. The decision brings him unimaginable riches, but the haunting ghost of his wife drives him into madness and retribution.',
        poster_url: 'https://upload.wikimedia.org/wikipedia/en/3/30/Living_in_Bondage_poster.jpg',
        is_nollywood: true,
        language: 'Igbo',
        status: 'released',
        content_type: 'movie',
        box_office_domestic: null,
        box_office_worldwide: null,
        box_office_source: null
      })
      .select('id')
      .single();

    if (insErr) {
      console.error('Error inserting 1992 film:', insErr);
      return;
    }
    classic1992Id = new1992.id;
    console.log(`Created 1992 Classic film record: ${classic1992Id}`);
  } else {
    // Update it to have 0/null box office and clear synopsis
    await supabase.from('films').update({
      box_office_domestic: null,
      box_office_worldwide: null,
      box_office_source: null,
      release_type: 'video',
      year: 1992
    }).eq('id', classic1992Id);
    console.log(`Updated 1992 classic record: ${classic1992Id}`);
  }

  // 2. Identify the 2019 Sequel: "Living in Bondage: Breaking Free"
  const BREAKING_FREE_ID = 'ea531942-ad87-4faa-8b31-24bf5160be33';
  await supabase.from('films').update({
    title: 'Living in Bondage: Breaking Free',
    year: 2019,
    box_office_domestic: 158889369,
    box_office_source: 'FilmOne',
    release_type: 'cinema',
    is_in_cinemas: false
  }).eq('id', BREAKING_FREE_ID);

  // 3. Move Kenneth Okonkwo (Andy Okeke) credit to the 1992 classic!
  const KENNETH_OKONKWO_CREDIT_ID = '71ce3479-4957-4603-89a8-013375e514f0';
  await supabase.from('credits').update({
    film_id: classic1992Id,
    character_name: 'Andy Okeke',
    role: 'actor',
    billing_order: 1
  }).eq('id', KENNETH_OKONKWO_CREDIT_ID);
  console.log(`Assigned Kenneth Okonkwo to 1992 Classic [${classic1992Id}]`);

  // Move the 2019 credits (Swanky JKA, Nancy Isime, Shawn Faqua, Ramsey Nouah) from the conflated record 'ea4afcd0...' to BREAKING_FREE_ID
  const CONFLATED_ID = 'ea4afcd0-f8d3-424a-836a-8fb1b9201255';
  if (CONFLATED_ID !== classic1992Id) {
    const { data: conflatedCreds } = await supabase
      .from('credits')
      .select('id, person_id, role, character_name')
      .eq('film_id', CONFLATED_ID);

    // Re-link 2019 credits to BREAKING_FREE_ID
    if (conflatedCreds && conflatedCreds.length > 0) {
      const ids = conflatedCreds.map(c => c.id).filter(id => id !== KENNETH_OKONKWO_CREDIT_ID);
      if (ids.length > 0) {
        await supabase.from('credits').update({ film_id: BREAKING_FREE_ID }).in('id', ids);
      }
    }
    // Delete the conflated Kava copy
    await supabase.from('films').delete().eq('id', CONFLATED_ID);
    console.log(`Deleted conflated duplicate film [${CONFLATED_ID}]`);
  }

  console.log('✅ Living in Bondage (1992) and Living in Bondage: Breaking Free (2019) are now completely separate, accurate, and preserved!');
}

main().catch(console.error);
