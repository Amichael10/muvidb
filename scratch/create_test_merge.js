import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function createTestData() {
  console.log('Creating test people...');
  
  const { data: p1, error: e1 } = await supabase.from('people').insert([{
    name: 'Test Merge A',
    bio: 'Bio from A',
    nationality: 'Nigerian'
  }]).select().single();

  if (e1) { console.error(e1); return; }

  const { data: p2, error: e2 } = await supabase.from('people').insert([{
    name: 'Test Merge B',
    bio: 'Bio from B',
    nationality: 'Ghanian'
  }]).select().single();

  if (e2) { console.error(e2); return; }

  console.log('Created:', p1.id, p2.id);
  console.log('Now go to http://localhost:3000/admin/people to test merging these two.');
}

createTestData();
