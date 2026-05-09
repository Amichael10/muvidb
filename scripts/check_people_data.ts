
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase environment variables.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkPeopleData() {
  const { count: missingPhoto, error } = await supabase
    .from('people')
    .select('*', { count: 'exact', head: true })
    .is('photo_url', null);
    
  console.log(`People missing photo_url: ${missingPhoto}`);

  const { data: recentPeople } = await supabase
    .from('people')
    .select('name, created_at')
    .order('created_at', { ascending: false })
    .limit(10);
    
  console.log('Recent people:', recentPeople);
}

checkPeopleData();
