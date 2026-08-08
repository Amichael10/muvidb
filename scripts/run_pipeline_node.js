import fs from 'fs';
import path from 'path';

const SUPABASE_URL = 'https://pkenrmorywmuvnzfoylp.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_fXxu9pH8yK8s6xEvEJWNgw_T3Nbbvdo';
const HEADERS = {
  'apikey': SUPABASE_ANON_KEY,
  'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
  'Content-Type': 'application/json'
};

function cleanStr(val) {
  if (!val) return '';
  return String(val).trim();
}

// =========================================================
// AGENT 1: DATABASE SCANNER
// =========================================================
async function agent1ScanDB(limit = 100) {
  console.log('\n====================================================');
  console.log('🤖 AGENT 1: SCANNING SUPABASE DB FOR TARGET PROFILES');
  console.log('====================================================');

  const url = `${SUPABASE_URL}/rest/v1/people?select=id,name,slug,gender,photo_url,date_of_birth,bio,instagram_url,twitter_url,facebook_url,popularity_score&order=popularity_score.desc&limit=${limit * 2}`;
  
  const res = await fetch(url, { headers: HEADERS });
  if (!res.ok) {
    throw new Error(`DB Scan failed: ${res.statusText}`);
  }
  const data = await res.json();
  console.log(`Fetched ${data.length} profiles from database.`);

  const incomplete = [];
  for (const person of data) {
    const missing = [];
    if (!cleanStr(person.gender)) missing.push('gender');
    if (!cleanStr(person.photo_url)) missing.push('photo_url');
    if (!cleanStr(person.date_of_birth)) missing.push('date_of_birth');
    if (!cleanStr(person.instagram_url) && !cleanStr(person.twitter_url) && !cleanStr(person.facebook_url)) {
      missing.push('social_links');
    }
    if (!cleanStr(person.bio)) missing.push('bio');

    if (missing.length > 0) {
      incomplete.push({
        id: person.id,
        name: person.name,
        slug: person.slug,
        missing_count: missing.length,
        missing_fields: missing,
        current_gender: person.gender || '',
        current_photo_url: person.photo_url || '',
        current_date_of_birth: person.date_of_birth || '',
        current_bio: person.bio || '',
        current_instagram: person.instagram_url || '',
        current_twitter: person.twitter_url || '',
        current_facebook: person.facebook_url || ''
      });
    }

    if (incomplete.length >= limit) break;
  }

  console.log(`Agent 1 Complete! Found ${incomplete.length} target profiles needing data.\n`);
  return incomplete;
}

// =========================================================
// AGENT 2: WIKIPEDIA / WEB RESEARCHER
// =========================================================
async function agent2Research(person) {
  console.log(`🔍 AGENT 2 [Research]: Searching web & Wikipedia for '${person.name}'...`);
  
  const findings = {
    bio: null,
    date_of_birth: null,
    gender: null,
    photo_url: null,
    sources: []
  };

  try {
    const wikiUrl = `https://en.wikipedia.org/w/api.php?action=query&prop=extracts|pageimages&exintro=1&explaintext=1&piprop=original&titles=${encodeURIComponent(person.name)}&format=json`;
    const res = await fetch(wikiUrl, { headers: { 'User-Agent': 'MuviDBAgent/1.0' } });
    if (res.ok) {
      const json = await res.json();
      const pages = json.query?.pages || {};
      for (const pid of Object.keys(pages)) {
        if (pid !== '-1') {
          const page = pages[pid];
          if (page.extract && page.extract.length > 40) {
            findings.bio = page.extract.substring(0, 500) + (page.extract.length > 500 ? '...' : '');
            findings.sources.push(`https://en.wikipedia.org/wiki/${encodeURIComponent(person.name)}`);
          }
          if (page.original?.source) {
            findings.photo_url = page.original.source;
          }

          // Regex for Date of Birth e.g. "born 3 May 1979" or "born May 3, 1979"
          const dobMatch = page.extract?.match(/born\s+(\d{1,2}\s+[A-Za-z]+\s+\d{4}|[A-Za-z]+\s+\d{1,2},\s*\d{4}|\d{4}-\d{2}-\d{2})/i);
          if (dobMatch) {
            findings.date_of_birth = dobMatch[1];
          }

          // Gender pronouns check
          const text = page.extract || '';
          const he = (text.match(/\b(he|his|him)\b/gi) || []).length;
          const she = (text.match(/\b(she|her|hers)\b/gi) || []).length;
          if (she > he + 2) findings.gender = 'female';
          else if (he > she + 2) findings.gender = 'male';
        }
      }
    }
  } catch (err) {
    // Soft error fallback
  }

  return findings;
}

// =========================================================
// AGENT 3: SOCIAL MEDIA SPECIALIST
// =========================================================
async function agent3Socials(person, a2Findings) {
  console.log(`📱 AGENT 3 [Socials]: Checking social media handles for '${person.name}'...`);
  
  const socials = {
    instagram_url: null,
    twitter_url: null,
    facebook_url: null,
    sources: []
  };

  const bioText = a2Findings.bio || '';
  const igMatch = bioText.match(/instagram\.com\/([a-zA-Z0-9_\.]+)/i);
  if (igMatch) {
    socials.instagram_url = `https://instagram.com/${igMatch[1]}`;
    socials.sources.push(socials.instagram_url);
  }

  const twMatch = bioText.match(/(?:twitter|x)\.com\/([a-zA-Z0-9_]+)/i);
  if (twMatch) {
    socials.twitter_url = `https://x.com/${twMatch[1]}`;
    socials.sources.push(socials.twitter_url);
  }

  const fbMatch = bioText.match(/facebook\.com\/([a-zA-Z0-9_\.]+)/i);
  if (fbMatch) {
    socials.facebook_url = `https://facebook.com/${fbMatch[1]}`;
    socials.sources.push(socials.facebook_url);
  }

  return socials;
}

// =========================================================
// AGENT 4: VERIFICATION ENGINE
// =========================================================
function agent4Verify(person, a2Data, a3Data) {
  console.log(`🛡️ AGENT 4 [Verify]: Cross-verifying and scoring '${person.name}'...`);
  
  const verified = {
    person_id: person.id,
    name: person.name,
    proposed_gender: a2Data.gender || person.current_gender || '',
    proposed_photo_url: a2Data.photo_url || person.current_photo_url || '',
    proposed_date_of_birth: a2Data.date_of_birth || person.current_date_of_birth || '',
    proposed_bio: a2Data.bio || person.current_bio || '',
    proposed_instagram: a3Data.instagram_url || person.current_instagram || '',
    proposed_twitter: a3Data.twitter_url || person.current_twitter || '',
    proposed_facebook: a3Data.facebook_url || person.current_facebook || '',
    confidence_score: 0,
    sources: [...new Set([...a2Data.sources, ...a3Data.sources])],
    status: 'PENDING_APPROVAL'
  };

  let score = 0;
  if (a2Data.bio) score += 30;
  if (a2Data.photo_url) score += 25;
  if (a2Data.date_of_birth) score += 20;
  if (a2Data.gender) score += 15;
  if (a3Data.instagram_url || a3Data.twitter_url || a3Data.facebook_url) score += 10;

  verified.confidence_score = `${Math.min(score, 100)}%`;
  return verified;
}

// =========================================================
// AGENT 5: CSV EXPORTER & REVIEW REPORT GENERATOR
// =========================================================
function agent5ExportCSV(verifiedList, filename = 'people_enrichment_approval.csv') {
  console.log(`\n📊 AGENT 5 [CSV Exporter]: Generating '${filename}' for user approval...`);
  
  const headers = [
    'person_id', 'name', 'confidence_score', 'status',
    'proposed_gender', 'proposed_photo_url', 'proposed_date_of_birth',
    'proposed_instagram', 'proposed_twitter', 'proposed_facebook',
    'proposed_bio', 'sources'
  ];

  const csvRows = [
    headers.join(','),
    ...verifiedList.map(v => [
      `"${v.person_id}"`,
      `"${(v.name || '').replace(/"/g, '""')}"`,
      `"${v.confidence_score}"`,
      `"${v.status}"`,
      `"${v.proposed_gender}"`,
      `"${v.proposed_photo_url}"`,
      `"${v.proposed_date_of_birth}"`,
      `"${v.proposed_instagram}"`,
      `"${v.proposed_twitter}"`,
      `"${v.proposed_facebook}"`,
      `"${(v.proposed_bio || '').replace(/"/g, '""').replace(/\r?\n|\r/g, ' ')}"`,
      `"${v.sources.join(' | ')}"`
    ].join(','))
  ];

  const csvPath = path.join(process.cwd(), filename);
  fs.writeFileSync(csvPath, csvRows.join('\n'), 'utf-8');

  const jsonPath = path.join(process.cwd(), 'people_enrichment_approval.json');
  fs.writeFileSync(jsonPath, JSON.stringify(verifiedList, null, 2), 'utf-8');

  console.log(`\n====================================================`);
  console.log(`✅ PIPELINE COMPLETE: 5 Agents Processed ${verifiedList.length} Records!`);
  console.log(`📁 CSV File Created: ${csvPath}`);
  console.log(`📁 JSON File Created: ${jsonPath}`);
  console.log(`====================================================\n`);

  return csvPath;
}

// =========================================================
// RUNNER PIPELINE
// =========================================================
async function runPipeline() {
  const targetPeople = await agent1ScanDB(30);
  const verifiedList = [];

  for (const person of targetPeople) {
    const a2 = await agent2Research(person);
    const a3 = await agent3Socials(person, a2);
    const v = agent4Verify(person, a2, a3);
    verifiedList.push(v);
  }

  agent5ExportCSV(verifiedList);
}

runPipeline().catch(console.error);
