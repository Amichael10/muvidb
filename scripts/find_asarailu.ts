import { supabase } from './lib/db';

async function main() {
  const { data: films } = await supabase
    .from('films')
    .select('id, title, year')
    .or('title.ilike.%asara%,title.ilike.%asarailu%');

  console.log('Films with asara:', films);

  // If not found, let's create Asarailu or check AKIN KOLAPO's record
  const { data: akin } = await supabase
    .from('people')
    .select('id, name, awards')
    .ilike('name', '%Akin Kolapo%')
    .single();

  console.log('Akin Kolapo awards:', JSON.stringify(akin?.awards, null, 2));
}

main().catch(console.error);
