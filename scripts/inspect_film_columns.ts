import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

async function inspectFilmColumns() {
  const { data, error } = await supabase.from('films').select('*').limit(1);
  if (error) {
    console.error('Error fetching film sample:', error.message);
  } else if (data && data.length > 0) {
    console.log('Films Table Columns:', Object.keys(data[0]));
    console.log('Sample Film distributor property:', data[0].distributor);
  }
}

inspectFilmColumns();
