const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const dotenv = require('dotenv');

const envLocal = fs.existsSync('.env.local') ? dotenv.parse(fs.readFileSync('.env.local')) : {};
const envDefault = fs.existsSync('.env') ? dotenv.parse(fs.readFileSync('.env')) : {};
const env = { ...envDefault, ...envLocal, ...process.env };

const supabaseUrl = env.VITE_SUPABASE_URL || env.SUPABASE_URL;
const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase credentials in .env");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const AFRICAN_COUNTRIES = [
  'Nigeria', 'Algeria', 'Angola', 'Benin', 'Botswana',
  'Burkina Faso', 'Burundi', 'Cabo Verde', 'Cameroon',
  'Central African Republic', 'Chad', 'Comoros', 'Congo',
  'Congo (DRC)', 'Djibouti', 'Egypt', 'Equatorial Guinea',
  'Eritrea', 'Eswatini', 'Ethiopia', 'Gabon', 'Gambia',
  'Ghana', 'Guinea', 'Guinea-Bissau', 'Ivory Coast',
  'Kenya', 'Lesotho', 'Liberia', 'Libya', 'Madagascar',
  'Malawi', 'Mali', 'Mauritania', 'Mauritius', 'Morocco',
  'Mozambique', 'Namibia', 'Niger', 'Rwanda',
  'Sao Tome and Principe', 'Senegal', 'Seychelles', 'Sierra Leone',
  'Somalia', 'South Africa', 'South Sudan', 'Sudan',
  'Tanzania', 'Togo', 'Tunisia', 'Uganda', 'Zambia', 'Zimbabwe'
];

async function run() {
  // 1. Check how many Mubi movies exist
  const { count: mubiCount, error: mubiErr } = await supabase
    .from('films')
    .select('id', { count: 'exact', head: true })
    .eq('source', 'mubi');
    
  console.log(`Total Mubi films in database: ${mubiCount}`);

  // 2. Fetch some recent Mubi movies to show user what was scraped
  const { data: recentMubi } = await supabase
    .from('films')
    .select('title, countries')
    .eq('source', 'mubi')
    .order('created_at', { ascending: false })
    .limit(5);
    
  console.log(`Recent Mubi films:`, recentMubi);

  // 3. Find non-African films to clean up
  const { data: allFilms } = await supabase
    .from('films')
    .select('id, title, countries, source');
    
  const toDelete = [];
  
  for (const film of allFilms) {
    if (!film.countries || film.countries.length === 0) continue;
    
    // Check if it has AT LEAST ONE African country
    const hasAfricanCountry = film.countries.some(c => AFRICAN_COUNTRIES.includes(c));
    
    if (!hasAfricanCountry) {
      toDelete.push(film);
    }
  }
  
  console.log(`\nFound ${toDelete.length} non-African films to delete.`);
  if (toDelete.length > 0) {
    console.log(`Examples to delete:`, toDelete.slice(0, 5).map(f => `${f.title} (${f.countries}) - ${f.source}`));
    
    // Perform deletion
    const idsToDelete = toDelete.map(f => f.id);
    const { error: delError } = await supabase
      .from('films')
      .delete()
      .in('id', idsToDelete);
      
    if (delError) {
      console.error('Failed to delete:', delError);
    } else {
      console.log(`Successfully deleted ${toDelete.length} non-African films.`);
    }
  }
}

run().catch(console.error);
