import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  const { data, error } = await supabase.from('users').select('role');
  if (error) {
    console.error('Error fetching users:', error);
  } else {
    const roles = Array.from(new Set(data.map(u => u.role)));
    console.log('Distinct roles in public.users:', roles);
  }

  // Check if admin_actions table exists by selecting 1 row
  const { data: actions, error: actionsError } = await supabase.from('admin_actions').select('*').limit(1);
  if (actionsError) {
    console.error('Error fetching from admin_actions:', actionsError.message);
  } else {
    console.log('Successfully queried admin_actions table. Rows:', actions);
  }
}

check().catch(console.error);
