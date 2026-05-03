import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkSchema() {
  const { data: tables, error } = await supabase
    .from('showtimes')
    .select('*')
    .limit(1);

  if (error) {
    console.error('Error fetching showtimes:', error);
  } else {
    console.log('Showtimes sample data:', tables[0]);
    // Also check column names by inspecting the keys of the first row
    if (tables[0]) {
      console.log('Columns:', Object.keys(tables[0]));
    }
  }

  const { data: films, error: filmError } = await supabase
    .from('films')
    .select('*')
    .limit(1);
    
  if (filmError) {
    console.error('Error fetching films:', filmError);
  } else {
    console.log('Films sample data:', films[0]);
    if (films[0]) {
      console.log('Film Columns:', Object.keys(films[0]));
    }
  }

  const { data: cinemas, error: cinemaError } = await supabase
    .from('cinemas')
    .select('id, name');
    
  if (cinemaError) {
    console.error('Error fetching cinemas:', cinemaError);
  } else {
    console.log('Cinemas:', cinemas);
  }
}

checkSchema();
