import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function checkSpecificColumns() {
  const table = 'films';
  const columnsToTest = [
    'poster_url', 'backdrop_url', 'runtime_minutes', 'synopsis', 
    'cast', 'cast_members', 'credits', 
    'is_showing_in_cinema', 'cinema_id', 'showing_date', 'showing_time'
  ];
  
  console.log(`--- Checking columns in "${table}" ---`);
  for (const col of columnsToTest) {
    const { error } = await supabase.from(table).select(col).limit(1);
    if (error) {
      console.log(`[ ] ${col.padEnd(25)}: ❌ MISSING (${error.message})`);
    } else {
      console.log(`[x] ${col.padEnd(25)}: ✅ EXISTS`);
    }
  }
}

checkSpecificColumns();
