import { supabase } from './lib/db';

async function findPeople() {
  const { data: hubert } = await supabase.from('people').select('id, name, slug').ilike('name', '%hubert%');
  const { data: olu } = await supabase.from('people').select('id, name, slug').ilike('name', '%jacobs%');
  console.log("Hubert matches:", hubert);
  console.log("Jacobs matches:", olu);

  // Check if any stage_credits exist for Hubert or Olu
  if (hubert && hubert.length > 0) {
    for (const h of hubert) {
      const { data: creds } = await supabase.from('stage_credits').select('id, role, character_name, plays(title, year)').eq('person_id', h.id);
      console.log(`Stage credits for ${h.name} (${h.id}):`, creds);
    }
  }

  if (olu && olu.length > 0) {
    for (const o of olu) {
      const { data: creds } = await supabase.from('stage_credits').select('id, role, character_name, plays(title, year)').eq('person_id', o.id);
      console.log(`Stage credits for ${o.name} (${o.id}):`, creds);
    }
  }
}

findPeople().catch(console.error);
