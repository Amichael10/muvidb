import dns from 'node:dns';
dns.setDefaultResultOrder('ipv4first');
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config();
import { getSupabase } from '../api/_lib/supabase.js';

const supabase = getSupabase();

async function checkFilmsSchema() {
  const { data: film } = await supabase
    .from('films')
    .select('*')
    .ilike('title', '%Saamu Alajo%')
    .limit(1);
  console.log('Saamu Alajo film keys:', film ? Object.keys(film[0]) : 'none');
  console.log('Saamu Alajo film sample data:', film ? film[0] : null);

  // Check if Tosin Olaniyan has actor claims or credits
  const { data: claims } = await supabase
    .from('actor_claims')
    .select('*')
    .ilike('actor_name', '%Tosin%');
  console.log('Actor claims for Tosin:', claims);

  // Check all cast in film_cast for Tosin Olaniyan (id: 364457c8-e535-43d7-aa5a-0d59055c2bbb)
  const { data: tosinCast } = await supabase
    .from('film_cast')
    .select('id, film_id, role, character_name, films(id, title)')
    .eq('person_id', '364457c8-e535-43d7-aa5a-0d59055c2bbb');
  console.log('Tosin Olaniyan all cast:', tosinCast);
}

checkFilmsSchema().catch(console.error);
