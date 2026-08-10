import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

async function checkFilmOneCompany() {
  const { data: companies, error } = await supabase
    .from('companies')
    .select('id, name, slug')
    .ilike('name', '%FilmOne%');

  if (error) {
    console.error('Error fetching companies:', error.message);
  } else {
    console.log('FilmOne Companies in DB:', companies);
  }
}

checkFilmOneCompany();
