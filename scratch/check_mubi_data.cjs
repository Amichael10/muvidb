const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkData() {
  const { data: films, error } = await supabase
    .from('films')
    .select('id, mubi_id, mubi_slug')
    .not('mubi_id', 'is', null)
    .limit(5);

  if (error) {
    console.error('❌ Error fetching films:', error.message);
  } else {
    console.log(`📊 Found ${films.length} films with mubi_id (sample):`);
    console.log(films);
  }

  const { data: people, error: pError } = await supabase
    .from('people')
    .select('id, name, mubi_slug')
    .not('mubi_slug', 'is', null)
    .limit(5);

  if (pError) {
    console.error('❌ Error fetching people:', pError.message);
  } else {
    console.log(`👤 Found ${people.length} people with mubi_slug (sample):`);
    console.log(people);
  }
}

checkData();
