import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function checkTotalStats() {
  const supabase = createClient(supabaseUrl, supabaseKey);
  
  console.log('--- SYSTEM CHECK ---');
  
  // 1. Total Count
  const { count: total } = await supabase.from('films').select('*', { count: 'exact', head: true });
  console.log(`Total Films in DB: ${total}`);

  // 2. Count by source (specifically checking for Mubi)
  const sources = ['mubi', 'youtube', 'manual', null];
  for (const s of sources) {
    const { count } = s 
      ? await supabase.from('films').select('*', { count: 'exact', head: true }).eq('source', s)
      : await supabase.from('films').select('*', { count: 'exact', head: true }).is('source', null);
    console.log(`Source [${s}]: ${count}`);
  }

  // 3. Check for films updated TODAY
  const today = new Date().toISOString().split('T')[0];
  const { count: updatedToday } = await supabase
    .from('films')
    .select('*', { count: 'exact', head: true })
    .gte('updated_at', today);
  
  console.log(`Films updated/added today (${today}): ${updatedToday}`);

  // 4. Sample a few "mubi" films to see when they were actually updated
  const { data: samples } = await supabase
    .from('films')
    .select('title, source, updated_at')
    .eq('source', 'mubi')
    .order('updated_at', { ascending: false })
    .limit(5);

  console.log('\n--- RECENT MUBI UPDATES (BY UPDATED_AT) ---');
  samples?.forEach(s => console.log(`[${s.updated_at}] ${s.title}`));
}

checkTotalStats();
