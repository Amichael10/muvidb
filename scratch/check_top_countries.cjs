require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

async function main() {
  const { data, error } = await supabase
    .from('film_countries')
    .select('country_id, countries(name)')
    
  if (error) {
    console.error(error);
    return;
  }
  
  const counts = {};
  data.forEach(row => {
    if (row.countries && row.countries.name) {
      counts[row.countries.name] = (counts[row.countries.name] || 0) + 1;
    }
  });
  
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  console.log("Movie Count per Country:");
  sorted.forEach(([name, count]) => {
    console.log(`${name}: ${count}`);
  });
}

main();
