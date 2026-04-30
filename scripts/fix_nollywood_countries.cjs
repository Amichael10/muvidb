const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

async function fixCountryAssociations() {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing Supabase credentials');
    return;
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  console.log('🔍 Fetching Nigeria country ID...');
  const { data: countryRow } = await supabase
    .from('countries')
    .select('id')
    .ilike('name', 'Nigeria')
    .single();

  if (!countryRow) {
    console.error('❌ Nigeria country record not found');
    return;
  }

  const nigeriaId = countryRow.id;
  console.log(`✅ Nigeria ID: ${nigeriaId}`);

  console.log('🔍 Fetching Nollywood films without country associations...');
  const { data: films, error } = await supabase
    .from('films')
    .select('id, title')
    .eq('is_nollywood', true);

  if (error) {
    console.error('❌ Error fetching films:', error.message);
    return;
  }

  console.log(`🎬 Found ${films.length} Nollywood films.`);

  let linkedCount = 0;
  for (const film of films) {
    const { error: linkError } = await supabase
      .from('film_countries')
      .upsert({
        film_id: film.id,
        country_id: nigeriaId
      }, { onConflict: 'film_id,country_id' });

    if (!linkError) {
      linkedCount++;
    }
    
    if (linkedCount % 100 === 0) {
      console.log(`⏳ Linked ${linkedCount} films...`);
    }
  }

  console.log(`🎉 Finished! Linked ${linkedCount} films to Nigeria.`);
}

fixCountryAssociations().catch(console.error);
