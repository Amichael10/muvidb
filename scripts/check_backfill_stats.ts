import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const sb = createClient(process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '', process.env.SUPABASE_SERVICE_ROLE_KEY || '');

async function run() {
  const { count: missingSyn } = await sb
    .from('films')
    .select('*', { count: 'exact', head: true })
    .or('synopsis.is.null,synopsis.eq.');

  const { count: filledSyn } = await sb
    .from('films')
    .select('*', { count: 'exact', head: true })
    .not('synopsis', 'is', null)
    .neq('synopsis', '');

  const { count: missingBio } = await sb
    .from('people')
    .select('*', { count: 'exact', head: true })
    .or('bio.is.null,bio.eq.');

  const { count: filledBio } = await sb
    .from('people')
    .select('*', { count: 'exact', head: true })
    .not('bio', 'is', null)
    .neq('bio', '');

  console.log('📊 --- CURRENT BACKFILL DATABASE STATS ---');
  console.log(`🎬 Films with Synopsis    : ${filledSyn}`);
  console.log(`🎬 Films missing Synopsis : ${missingSyn}`);
  console.log(`👤 People with Bio        : ${filledBio}`);
  console.log(`👤 People missing Bio     : ${missingBio}`);
}

run().catch(console.error);
