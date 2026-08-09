import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey);

async function testTable() {
  const { data, error } = await supabase.from('person_box_office_rankings').select('*').limit(1);
  if (error) {
    console.log('person_box_office_rankings error:', error.message);
  } else {
    console.log('person_box_office_rankings exists! Rows:', data?.length);
  }

  // Check companies awards column
  const { data: comp, error: compErr } = await supabase.from('companies').select('id, name, awards').limit(1);
  if (compErr) {
    console.log('companies awards column error:', compErr.message);
  } else {
    console.log('companies awards column exists! Sample:', comp);
  }
}

testTable();
