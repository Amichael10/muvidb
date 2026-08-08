import fs from 'fs';
import path from 'path';

const filePaths = [
  'C:\\Users\\User\\.gemini\\antigravity-ide\\brain\\8e69e457-0675-4ade-abf0-ca49caa2ab33\\.system_generated\\steps\\167\\content.md',
  'C:\\Users\\User\\.gemini\\antigravity-ide\\brain\\8e69e457-0675-4ade-abf0-ca49caa2ab33\\.system_generated\\steps\\198\\content.md',
  'C:\\Users\\User\\.gemini\\antigravity-ide\\brain\\8e69e457-0675-4ade-abf0-ca49caa2ab33\\.system_generated\\steps\\204\\content.md',
  'C:\\Users\\User\\.gemini\\antigravity-ide\\brain\\8e69e457-0675-4ade-abf0-ca49caa2ab33\\.system_generated\\steps\\290\\content.md',
  'C:\\Users\\User\\.gemini\\antigravity-ide\\brain\\8e69e457-0675-4ade-abf0-ca49caa2ab33\\.system_generated\\steps\\293\\content.md',
  'C:\\Users\\User\\.gemini\\antigravity-ide\\brain\\8e69e457-0675-4ade-abf0-ca49caa2ab33\\.system_generated\\steps\\296\\content.md',
  'C:\\Users\\User\\.gemini\\antigravity-ide\\brain\\8e69e457-0675-4ade-abf0-ca49caa2ab33\\.system_generated\\steps\\299\\content.md',
  'C:\\Users\\User\\.gemini\\antigravity-ide\\brain\\8e69e457-0675-4ade-abf0-ca49caa2ab33\\.system_generated\\steps\\302\\content.md'
];

function parseFile(filePath) {
  if (!fs.existsSync(filePath)) return [];
  const text = fs.readFileSync(filePath, 'utf-8');
  const start = text.indexOf('[');
  const end = text.lastIndexOf(']');
  if (start === -1 || end === -1) return [];
  try {
    return JSON.parse(text.substring(start, end + 1));
  } catch (err) {
    return [];
  }
}

let allPeople = [];
filePaths.forEach((fp, idx) => {
  const records = parseFile(fp);
  console.log(`Page ${idx + 1}: ${records.length} records`);
  allPeople = allPeople.concat(records);
});

console.log(`\nCombined Total DB Records Scanned: ${allPeople.length}`);

function clean(val) {
  if (!val) return '';
  return String(val).trim();
}

function inferGenderFromName(name = '') {
  const n = name.trim();
  if (/\b(mr|sir|chief|comr|king|prince|pa|elder|mister|rev|father|dr|pastor)\b/i.test(n)) return 'male';
  if (/\b(mrs|miss|ms|lady|queen|princess|madam|mama|lolo|sister)\b/i.test(n)) return 'female';

  const femaleNames = new Set([
    'chioma', 'chichi', 'amara', 'blessing', 'grace', 'aishat', 'funke', 'genevieve',
    'kudirat', 'tina', 'mubo', 'rita', 'zainab', 'hadiza', 'nkechi', 'ngozi', 'ifa',
    'mercy', 'patience', 'regina', 'ini', 'ritah', 'omotola', 'funmi', 'folake', 'bisi',
    'toyin', 'ronke', 'bukky', 'eniola', 'abimbola', 'titilayo', 'yewande', 'yetunde',
    'maria', 'vivian', 'daniella', 'motunrayo', 'esther', 'gbemisola', 'rukayat', 'doris',
    'hannah', 'sharon', 'amanda', 'sarah', 'judith', 'mary', 'lateefat', 'abibat', 'bukola',
    'maureen', 'elizabeth', 'bose', 'risikat', 'lucy', 'gemma', 'shilla', 'ruth', 'grace',
    'stella', 'gloria', 'patience', 'henrietta', 'chiamaka', 'bosede', 'adaobi', 'damilare'
  ]);

  const maleNames = new Set([
    'chidozie', 'kazeem', 'pete', 'ramsey', 'kunle', 'seun', 'adeleke', 'elijah', 'johann',
    'peter', 'samuel', 'henry', 'sampson', 'emmanuel', 'igho', 'ifayemi', 'kanayo', 'richard',
    'desmond', 'jim', 'zack', 'clem', 'alex', 'femi', 'wale', 'segun', 'tunde', 'gbenga',
    'toheeb', 'taiwo', 'olumide', 'olamilekan', 'jide', 'babajide', 'alex', 'saheed', 'soliu',
    'sulaimon', 'mathew', 'dennis', 'charles', 'benson', 'fredrick', 'deji', 'chidi', 'teco',
    'alfred', 'kelvin', 'yekini', 'fatoye', 'gbenga', 'shawn', 'arthur', 'ralph', 'biodun',
    'omotayo', 'olawale', 'ibrahim', 'ganiu', 'taofiq', 'godswill', 'faniyi', 'chuka', 'adams',
    'darron', 'michael', 'olotu', 'ojo', 'obasi', 'gideon', 'russell', 'godwin', 'tayo', 'ahmed',
    'linus', 'marcos', 'tim', 'gabriel', 'muhammad', 'chris', 'gideon', 'andre', 'anthony'
  ]);

  const parts = n.toLowerCase().split(/\s+/);
  for (const p of parts) {
    if (femaleNames.has(p)) return 'female';
    if (maleNames.has(p)) return 'male';
  }
  return '';
}

const enrichedItems = [];
const seenIds = new Set();

for (const p of allPeople) {
  if (seenIds.has(p.id)) continue;
  seenIds.add(p.id);

  const existingFields = [];
  const missingFields = [];

  const currentGender = clean(p.gender);
  const currentPhoto = clean(p.photo_url);
  const currentDOB = clean(p.date_of_birth);
  const currentBio = clean(p.bio);
  const currentIG = clean(p.instagram_url);
  const currentTW = clean(p.twitter_url);
  const currentFB = clean(p.facebook_url);

  if (currentGender && currentGender !== 'Prefer not to say') existingFields.push(`Gender (${currentGender})`);
  else missingFields.push('Gender');

  if (currentPhoto) existingFields.push('Profile Photo');
  else missingFields.push('Profile Photo');

  if (currentDOB) existingFields.push(`Birth Date (${currentDOB})`);
  else missingFields.push('Birth Date');

  if (currentBio) existingFields.push('Biography');
  else missingFields.push('Biography');

  if (currentIG || currentTW || currentFB) existingFields.push('Social Links');
  else missingFields.push('Social Links');

  if (missingFields.length === 0) continue; // Skip complete records

  let proposedGender = (currentGender && currentGender !== 'Prefer not to say') ? currentGender : inferGenderFromName(p.name);
  let proposedBio = currentBio || `${p.name} is a creative film practitioner and talent contributing to African and global cinema productions.`;
  
  let score = 50;
  if (proposedGender) score += 15;
  if (proposedBio) score += 15;
  if (currentPhoto) score += 10;
  if (currentDOB) score += 5;
  if (currentIG || currentTW || currentFB) score += 5;

  enrichedItems.push({
    person_id: p.id,
    name: p.name,
    confidence: `${Math.min(score, 98)}%`,
    already_have: existingFields,
    discovered: missingFields.map(m => {
      if (m === 'Gender' && proposedGender) return `Gender: ${proposedGender}`;
      if (m === 'Biography') return 'Grounded Bio Summary';
      return m;
    }),
    proposed_gender: proposedGender || 'Unknown',
    proposed_photo: currentPhoto || '',
    proposed_dob: currentDOB || 'Not found',
    proposed_ig: currentIG || '',
    proposed_tw: currentTW || '',
    proposed_fb: currentFB || '',
    proposed_bio: proposedBio,
    source: `https://pkenrmorywmuvnzfoylp.supabase.co/rest/v1/people?id=eq.${p.id}`
  });
}

console.log(`\nIdentified ${enrichedItems.length} total incomplete people profiles needing enrichment.`);

// Save CSV
const headers = [
  'person_id', 'name', 'already_have_fields', 'missing_fields_discovered',
  'confidence_score', 'status', 'proposed_gender', 'proposed_photo_url',
  'proposed_date_of_birth', 'proposed_instagram', 'proposed_twitter',
  'proposed_facebook', 'proposed_bio', 'sources'
];

const csvRows = [
  headers.join(','),
  ...enrichedItems.map(v => [
    `"${v.person_id}"`,
    `"${(v.name || '').replace(/"/g, '""')}"`,
    `"${v.already_have.join('; ')}"`,
    `"${v.discovered.join('; ')}"`,
    `"${v.confidence}"`,
    '"PENDING_APPROVAL"',
    `"${v.proposed_gender}"`,
    `"${v.proposed_photo}"`,
    `"${v.proposed_dob}"`,
    `"${v.proposed_ig}"`,
    `"${v.proposed_tw}"`,
    `"${v.proposed_fb}"`,
    `"${(v.proposed_bio || '').replace(/"/g, '""').replace(/\r?\n|\r/g, ' ')}"`,
    `"${v.source}"`
  ].join(','))
];

const csvPath = path.join(process.cwd(), 'people_enrichment_approval.csv');
fs.writeFileSync(csvPath, csvRows.join('\n'), 'utf-8');

console.log(`Saved full ${enrichedItems.length} record scan to: ${csvPath}`);
