import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const sb = createClient(process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '', process.env.SUPABASE_SERVICE_ROLE_KEY || '');

async function run() {
  const { count: totalFilms } = await sb.from('films').select('*', { count: 'exact', head: true });
  const { count: nullSyn } = await sb.from('films').select('*', { count: 'exact', head: true }).is('synopsis', null);
  const { count: emptySyn } = await sb.from('films').select('*', { count: 'exact', head: true }).eq('synopsis', '');

  const missingSyn = (nullSyn || 0) + (emptySyn || 0);
  const filledSyn = (totalFilms || 0) - missingSyn;

  const { count: totalPeople } = await sb.from('people').select('*', { count: 'exact', head: true });
  const { count: nullBio } = await sb.from('people').select('*', { count: 'exact', head: true }).is('bio', null);
  const { count: emptyBio } = await sb.from('people').select('*', { count: 'exact', head: true }).eq('bio', '');

  const missingBio = (nullBio || 0) + (emptyBio || 0);
  const filledBio = (totalPeople || 0) - missingBio;

  console.log('📊 --- LIVE DATABASE BACKFILL PROGRESS ---');
  console.log(`🎬 Total Films             : ${totalFilms?.toLocaleString()}`);
  console.log(`✅ Films WITH Synopsis     : ${filledSyn?.toLocaleString()} (${((filledSyn / (totalFilms || 1)) * 100).toFixed(1)}%)`);
  console.log(`⏳ Films MISSING Synopsis  : ${missingSyn?.toLocaleString()}`);
  console.log('-------------------------------------------');
  console.log(`👤 Total People            : ${totalPeople?.toLocaleString()}`);
  console.log(`✅ People WITH Bio         : ${filledBio?.toLocaleString()} (${((filledBio / (totalPeople || 1)) * 100).toFixed(1)}%)`);
  console.log(`⏳ People MISSING Bio      : ${missingBio?.toLocaleString()}`);
}

run().catch(console.error);
