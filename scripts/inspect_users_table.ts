import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

async function inspect() {
  console.log('Inspecting public.users table columns...');
  // We can query postgres pg_attribute or information_schema via RPC if possible?
  // Since we don't have SQL execution RPC, wait! We can inspect what fields are in a dummy select:
  const { data, error } = await supabase.from('users').select('*').limit(1);
  if (error) {
    console.error('Error fetching users:', error);
  } else {
    console.log('Sample user record keys:', data.length > 0 ? Object.keys(data[0]) : 'No records');
    console.log('Full sample record:', data[0]);
  }
}

inspect().catch(console.error);
