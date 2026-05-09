import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function listEmpty() {
  const { data } = await supabase.from('films')
    .select('title, source, created_at')
    .or('synopsis.is.null,synopsis.eq.""')
    .order('created_at', { ascending: false })
    .limit(20);

  console.log('Recent empty films:', data);
}

listEmpty();
