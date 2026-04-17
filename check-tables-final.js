import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function checkTables() {
  const tables = ['films', 'cinemas', 'people', 'credits', 'showtimes', 'genres', 'film_genres', 'film_companies', 'companies'];
  console.log('--- Verifying Table Existence ---');
  for (const table of tables) {
    const { error } = await supabase.from(table).select('*', { count: 'exact', head: true }).limit(1);
    if (error) {
      console.log(`[ ] ${table.padEnd(20)}: ❌ ${error.code === '42P01' ? 'DOES NOT EXIST' : error.message}`);
    } else {
      console.log(`[x] ${table.padEnd(20)}: ✅ EXISTS`);
    }
  }
}

checkTables();
