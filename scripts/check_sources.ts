import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkSources() {
  const { data: sources } = await supabase.from('films').select('source').or('synopsis.is.null,synopsis.eq.""');
  const sourceCounts = sources?.reduce((acc, f) => {
    acc[f.source || 'unknown'] = (acc[f.source || 'unknown'] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  console.log('Empty synopsis counts by source:', sourceCounts);
}

checkSources();
