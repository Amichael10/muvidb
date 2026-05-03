import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const africanCountries = [
  'Algeria', 'Angola', 'Benin', 'Botswana', 'Burkina Faso', 'Burundi', 'Cabo Verde', 'Cameroon', 'Central African Republic',
  'Chad', 'Comoros', 'Congo', 'Cote d\'Ivoire', 'Ivory Coast', 'Djibouti', 'Egypt', 'Equatorial Guinea', 'Eritrea', 'Eswatini', 'Ethiopia',
  'Gabon', 'Gambia', 'Ghana', 'Guinea', 'Guinea-Bissau', 'Kenya', 'Lesotho', 'Liberia', 'Libya', 'Madagascar', 'Malawi', 'Mali',
  'Mauritania', 'Mauritius', 'Morocco', 'Mozambique', 'Namibia', 'Niger', 'Nigeria', 'Rwanda', 'Sao Tome and Principe', 'Senegal',
  'Seychelles', 'Sierra Leone', 'Somalia', 'South Africa', 'South Sudan', 'Sudan', 'Tanzania', 'Togo', 'Tunisia', 'Uganda', 'Zambia', 'Zimbabwe'
];

async function cleanupNonAfrican() {
  console.log('🧹 Cleaning up non-African films...');
  
  const { data: films, error } = await supabase
    .from('films')
    .select('id, title, countries, mubi_slug');

  if (error) {
    console.error('Error fetching films:', error);
    return;
  }

  const toDelete = films.filter(film => {
    if (!film.countries || film.countries.length === 0) return false; // Keep untagged for now
    
    const hasAfrican = film.countries.some(c => africanCountries.includes(c));
    return !hasAfrican;
  });

  console.log(`Found ${toDelete.length} non-African films.`);

  for (const film of toDelete) {
    console.log(`🗑️ Deleting ${film.title} (Countries: ${film.countries.join(', ')})`);
    const { error: delError } = await supabase
      .from('films')
      .delete()
      .match({ id: film.id });
    
    if (delError) console.error(`  ❌ Failed to delete ${film.title}:`, delError.message);
  }

  console.log('✨ Cleanup complete.');
}

cleanupNonAfrican();
