import fs from 'fs';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
  dotenv.config({ path: '.env' });
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const dataFile = 'scripts/data/dca_alumni.json';
if (!fs.existsSync(dataFile)) {
  console.log(`[match_eligible_dca] ${dataFile} not found. Run fetch_dca_alumni.js first.`);
  process.exit(0);
}
const raw = JSON.parse(fs.readFileSync(dataFile, 'utf8'));

// Filter eligible
const eligible = raw.filter(item => {
  const hasAv = !!(item.avatar?.image || item.avatar?.thumb);
  const hasCo = !!(item.course?.title || (item.courses && item.courses.length > 0) || (item.education && item.education.some(e => (e.name || '').toUpperCase().includes('DEL'))));
  const hasPo = !!(item.portfolios && item.portfolios.length > 0);
  const hasEx = !!(item.experience && item.experience.length > 0);
  const hasPr = !!(item.profession?.title);
  const hasSo = !!(item.instagram_link || item.twitter_link || item.linkedin_link);
  return hasAv || hasCo || hasPo || hasEx || hasPr || hasSo;
});

console.log(`Analyzing ${eligible.length} eligible candidates...`);

// Clean names
function cleanFullName(item) {
  let fn = (item.first_name || '').trim();
  let mn = (item.middle_name || '').trim();
  let ln = (item.last_name || '').trim();

  // If fn already contains mn, avoid repeating
  if (mn && fn.toLowerCase().includes(mn.toLowerCase())) {
    mn = '';
  }
  return `${fn} ${mn ? mn + ' ' : ''}${ln}`.replace(/\s+/g, ' ').trim();
}

async function run() {
  // Collect all full names and short names to batch query
  const nameMap = new Map();
  for (const item of eligible) {
    const fullName = cleanFullName(item);
    const shortName = `${(item.first_name || '').trim()} ${(item.last_name || '').trim()}`.replace(/\s+/g, ' ').trim();
    if (fullName) nameMap.set(fullName, item);
    if (shortName && shortName !== fullName) nameMap.set(shortName, item);
  }

  const allNames = Array.from(nameMap.keys());
  console.log(`Querying DB for ${allNames.length} names across batches...`);

  const matchedPeople = new Map();
  // Batch in chunks of 50
  for (let i = 0; i < allNames.length; i += 50) {
    const slice = allNames.slice(i, i + 50);
    const { data, error } = await supabase
      .from('people')
      .select('id, name, slug, photo_url, film_count, bio, instagram_url')
      .in('name', slice);
    if (data) {
      for (const p of data) {
        matchedPeople.set(p.name.toLowerCase(), p);
      }
    }
  }

  // Also load all aliases
  const { data: aliases } = await supabase.from('person_aliases').select('alias, person_id');
  const aliasMap = new Map();
  if (aliases) {
    for (const a of aliases) {
      aliasMap.set(a.alias.toLowerCase(), a.person_id);
    }
  }

  console.log(`Found ${matchedPeople.size} direct name matches and ${aliasMap.size} aliases in DB`);

  const matches = [];
  const unmatched = [];

  for (const item of eligible) {
    const fullName = cleanFullName(item);
    const shortName = `${(item.first_name || '').trim()} ${(item.last_name || '').trim()}`.replace(/\s+/g, ' ').trim();

    let matched = matchedPeople.get(fullName.toLowerCase()) || (shortName ? matchedPeople.get(shortName.toLowerCase()) : null);

    if (!matched && aliasMap.has(fullName.toLowerCase())) {
      const pId = aliasMap.get(fullName.toLowerCase());
      const { data: p } = await supabase.from('people').select('id, name, slug, photo_url, film_count, bio, instagram_url').eq('id', pId).single();
      if (p) matched = p;
    }

    if (matched) {
      matches.push({ candidate: item, fullName, dbPerson: matched });
    } else {
      unmatched.push({ candidate: item, fullName });
    }
  }

  console.log('\n=== MATCH RESULTS ===');
  console.log(`Matched Existing in DB: ${matches.length}`);
  for (const m of matches) {
    console.log(`  ⭐ Matched: "${m.fullName}" -> "${m.dbPerson.name}" (${m.dbPerson.slug}, ${m.dbPerson.film_count || 0} films)`);
  }

  console.log(`\nNew Community Talents to Ingest: ${unmatched.length}`);
  for (const u of unmatched.slice(0, 15)) {
    console.log(`  🎬 New: "${u.fullName}" | Prof: ${u.candidate.profession?.title || 'Creative'} | Headshot: ${!!u.candidate.avatar?.image}`);
  }
}

run().catch(console.error);
