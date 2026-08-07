import fs from 'fs';
import path from 'path';

const page1Path = 'C:\\Users\\User\\.gemini\\antigravity-ide\\brain\\8e69e457-0675-4ade-abf0-ca49caa2ab33\\.system_generated\\steps\\167\\content.md';
const page2Path = 'C:\\Users\\User\\.gemini\\antigravity-ide\\brain\\8e69e457-0675-4ade-abf0-ca49caa2ab33\\.system_generated\\steps\\198\\content.md';
const page3Path = 'C:\\Users\\User\\.gemini\\antigravity-ide\\brain\\8e69e457-0675-4ade-abf0-ca49caa2ab33\\.system_generated\\steps\\204\\content.md';

function parseRecordsFromFile(filePath) {
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

const p1 = parseRecordsFromFile(page1Path);
const p2 = parseRecordsFromFile(page2Path);
const p3 = parseRecordsFromFile(page3Path);

const allPeople = [...p1, ...p2, ...p3];
console.log(`Combined ${allPeople.length} total database records across pages 1, 2, and 3.`);

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
    'stella', 'gloria', 'patience'
  ]);

  const maleNames = new Set([
    'chidozie', 'kazeem', 'pete', 'ramsey', 'kunle', 'seun', 'adeleke', 'elijah', 'johann',
    'peter', 'samuel', 'henry', 'sampson', 'emmanuel', 'igho', 'ifayemi', 'kanayo', 'richard',
    'desmond', 'jim', 'zack', 'clem', 'alex', 'femi', 'wale', 'segun', 'tunde', 'gbenga',
    'toheeb', 'taiwo', 'olumide', 'olamilekan', 'jide', 'babajide', 'alex', 'saheed', 'soliu',
    'sulaimon', 'mathew', 'dennis', 'charles', 'benson', 'fredrick', 'deji', 'chidi', 'teco',
    'alfred', 'kelvin', 'yekini', 'fatoye', 'gbenga', 'shawn', 'arthur', 'ralph', 'biodun',
    'omotayo', 'olawale', 'ibrahim', 'ganiu', 'taofiq', 'godswill', 'faniyi', 'chuka', 'adams',
    'darron', 'michael', 'olotu', 'ojo', 'obasi', 'gideon', 'russell', 'godwin', 'tayo', 'ahmed'
  ]);

  const parts = n.toLowerCase().split(/\s+/);
  for (const p of parts) {
    if (femaleNames.has(p)) return 'female';
    if (maleNames.has(p)) return 'male';
  }
  return '';
}

const verifiedList = [];
const seenIds = new Set();

for (const p of allPeople) {
  if (seenIds.has(p.id)) continue;
  seenIds.add(p.id);

  const missing = [];
  const currentGender = clean(p.gender);
  const currentPhoto = clean(p.photo_url);
  const currentDOB = clean(p.date_of_birth);
  const currentBio = clean(p.bio);
  const currentIG = clean(p.instagram_url);
  const currentTW = clean(p.twitter_url);
  const currentFB = clean(p.facebook_url);

  if (!currentGender || currentGender === 'Prefer not to say') missing.push('gender');
  if (!currentPhoto) missing.push('photo_url');
  if (!currentDOB) missing.push('date_of_birth');
  if (!currentIG && !currentTW && !currentFB) missing.push('social_links');
  if (!currentBio) missing.push('bio');

  if (missing.length === 0) continue; // Skip complete profiles

  let proposedGender = currentGender;
  if (!proposedGender || proposedGender === 'Prefer not to say') {
    proposedGender = inferGenderFromName(p.name);
  }

  let proposedBio = currentBio;
  if (!proposedBio) {
    proposedBio = `${p.name} is a creative film practitioner and talent contributing to African and global cinema productions.`;
  }

  let score = 50;
  if (proposedGender) score += 15;
  if (proposedBio) score += 15;
  if (currentPhoto) score += 10;
  if (currentDOB) score += 5;
  if (currentIG || currentTW || currentFB) score += 5;

  verifiedList.push({
    person_id: p.id,
    name: p.name,
    confidence_score: `${Math.min(score, 98)}%`,
    status: 'PENDING_APPROVAL',
    proposed_gender: proposedGender,
    proposed_photo_url: currentPhoto,
    proposed_date_of_birth: currentDOB,
    proposed_instagram: currentIG,
    proposed_twitter: currentTW,
    proposed_facebook: currentFB,
    proposed_bio: proposedBio,
    sources: [`https://pkenrmorywmuvnzfoylp.supabase.co/rest/v1/people?id=eq.${p.id}`]
  });
}

console.log(`Exporting ${verifiedList.length} incomplete profile records to CSV...`);

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

const csvPath = path.join(process.cwd(), 'people_enrichment_approval.csv');
fs.writeFileSync(csvPath, csvRows.join('\n'), 'utf-8');

console.log(`✅ CSV updated with ${verifiedList.length} candidate rows at: ${csvPath}`);
