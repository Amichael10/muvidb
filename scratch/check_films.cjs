require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkFilms() {
  const { data, error } = await supabase
    .from('films')
    .select('title, countries, source')
    .limit(50);
    
  if (error) {
    console.error(error);
    return;
  }
  
  console.log(JSON.stringify(data, null, 2));
}

checkFilms();
