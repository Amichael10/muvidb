
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkEmptyPeople() {
  const { count: emptyPeople, error } = await supabase
    .from('people')
    .select('*', { count: 'exact', head: true })
    .is('photo_url', null)
    .is('biography', null);
    
  console.log(`People missing photo AND bio: ${emptyPeople}`);
}

checkEmptyPeople();
