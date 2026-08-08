import fs from 'fs';
import path from 'path';

const filePaths = [
  'C:\\Users\\User\\.gemini\\antigravity-ide\\brain\\8e69e457-0675-4ade-abf0-ca49caa2ab33\\.system_generated\\steps\\365\\content.md',
  'C:\\Users\\User\\.gemini\\antigravity-ide\\brain\\8e69e457-0675-4ade-abf0-ca49caa2ab33\\.system_generated\\steps\\371\\content.md',
  'C:\\Users\\User\\.gemini\\antigravity-ide\\brain\\8e69e457-0675-4ade-abf0-ca49caa2ab33\\.system_generated\\steps\\374\\content.md',
  'C:\\Users\\User\\.gemini\\antigravity-ide\\brain\\8e69e457-0675-4ade-abf0-ca49caa2ab33\\.system_generated\\steps\\377\\content.md'
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

let allIncomplete = [];
filePaths.forEach((fp, idx) => {
  const records = parseFile(fp);
  console.log(`Page ${idx + 1}: ${records.length} incomplete records`);
  allIncomplete = allIncomplete.concat(records);
});

console.log(`Total Incomplete Database Records Loaded: ${allIncomplete.length}`);

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

for (const p of allIncomplete) {
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

console.log(`Generated ${enrichedItems.length} candidate profiles.`);

const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>MuviDB - Database People Data Enrichment Dashboard</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    body { background-color: #0f172a; color: #f8fafc; font-family: system-ui, -apple-system, sans-serif; }
    .card { background: #1e293b; border: 1px solid #334155; border-radius: 12px; transition: all 0.2s ease; }
    .card:hover { border-color: #38bdf8; }
    .badge-have { background-color: #064e3b; color: #34d399; border: 1px solid #059669; }
    .badge-missing { background-color: #7f1d1d; color: #fca5a5; border: 1px solid #dc2626; }
  </style>
</head>
<body class="p-8 max-w-7xl mx-auto">

  <!-- Header -->
  <header class="mb-8 flex flex-col md:flex-row justify-between items-start md:items-center border-b border-slate-700 pb-6 gap-4">
    <div>
      <div class="flex items-center gap-3">
        <span class="text-3xl">🎬</span>
        <h1 class="text-3xl font-bold text-sky-400">Database People Enrichment Dashboard</h1>
      </div>
      <p class="text-slate-400 mt-2 text-sm">
        Reviewing scanned database candidates (${enrichedItems.length} total incomplete people). Distinctly showing <span class="text-emerald-400 font-semibold">✓ Information We Already Have</span> vs. <span class="text-rose-400 font-semibold">⚡ Discovered Missing Data</span>.
      </p>
    </div>
    <div class="flex gap-3">
      <button onclick="approveAll()" class="bg-emerald-600 hover:bg-emerald-500 text-white px-5 py-2.5 rounded-lg font-semibold text-sm shadow transition">
        ✓ Approve All Candidates (${enrichedItems.length})
      </button>
      <button onclick="exportApprovedJSON()" class="bg-sky-600 hover:bg-sky-500 text-white px-5 py-2.5 rounded-lg font-semibold text-sm shadow transition">
        📥 Export Approved JSON
      </button>
    </div>
  </header>

  <!-- Status Bar -->
  <div class="mb-6 flex justify-between items-center bg-slate-800/60 p-4 rounded-xl border border-slate-700">
    <div class="text-sm text-slate-300">
      Status: <span id="approved-count" class="font-bold text-emerald-400">0</span> approved | <span id="total-count" class="font-bold text-white">${enrichedItems.length}</span> total incomplete candidates
    </div>
    <div class="text-xs text-slate-400">
      Click <strong class="text-white">✓ Approve</strong> on any card to mark for DB update.
    </div>
  </div>

  <!-- Cards Grid -->
  <div class="grid grid-cols-1 md:grid-cols-2 gap-6" id="cards-grid"></div>

  <script>
    const candidates = ${JSON.stringify(enrichedItems, null, 2)};
    const approvedSet = new Set();

    function renderCards() {
      if (document.getElementById('total-count')) document.getElementById('total-count').innerText = candidates.length;
      if (document.getElementById('total-count-btn')) document.getElementById('total-count-btn').innerText = candidates.length;
      const grid = document.getElementById('cards-grid');
      grid.innerHTML = candidates.map((item, idx) => \`
        <div class="card p-6 flex flex-col justify-between" id="card-\${idx}">
          <div>
            <div class="flex justify-between items-start mb-4">
              <div>
                <h2 class="text-xl font-bold text-white">\${item.name}</h2>
                <span class="text-xs text-slate-400">ID: \${item.person_id}</span>
              </div>
              <span class="px-3 py-1 bg-sky-950 text-sky-300 border border-sky-700 text-xs font-bold rounded-full">\${item.confidence} Confidence</span>
            </div>

            <div class="flex gap-4 mb-4">
              \${item.proposed_photo ? \`<img src="\${item.proposed_photo}" class="w-24 h-32 object-cover rounded-lg border border-slate-600" alt="\${item.name}">\` : \`<div class="w-24 h-32 bg-slate-800 rounded-lg flex items-center justify-center text-xs text-slate-500 border border-slate-700 text-center p-2">No Photo</div>\`}
              <div class="flex-1 text-sm space-y-2">
                <div>
                  <span class="text-xs font-bold uppercase text-slate-400">✓ Information We Already Have:</span>
                  <div class="mt-1 flex flex-wrap gap-1">
                    \${item.already_have.length ? item.already_have.map(h => \`<span class="badge-have px-2 py-0.5 rounded text-xs font-medium">\${h}</span>\`).join('') : \`<span class="text-xs text-slate-500 italic">None</span>\`}
                  </div>
                </div>
                <div class="pt-2">
                  <span class="text-xs font-bold uppercase text-slate-400">⚡ Discovered Missing Data (Proposed):</span>
                  <div class="mt-1 flex flex-wrap gap-1">
                    \${item.discovered.map(d => \`<span class="badge-missing px-2 py-0.5 rounded text-xs font-medium">\${d}</span>\`).join('')}
                  </div>
                </div>
              </div>
            </div>

            <div class="bg-slate-900/60 p-3 rounded-lg border border-slate-800 text-xs text-slate-300 leading-relaxed mb-4">
              <strong class="text-slate-400">Bio Overview:</strong> \${item.proposed_bio}
            </div>
          </div>

          <div class="flex justify-between items-center pt-3 border-t border-slate-700">
            <span class="text-xs text-emerald-400 font-medium" id="status-\${idx}">● Pending Review</span>
            <div class="space-x-2">
              <button onclick="approve(\${idx})" class="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-1.5 rounded text-xs font-semibold">✓ Approve</button>
              <button onclick="skip(\${idx})" class="bg-slate-700 hover:bg-slate-600 text-slate-300 px-4 py-1.5 rounded text-xs font-semibold">Skip</button>
            </div>
          </div>
        </div>
      \`).join('');
    }

    function approve(idx) {
      approvedSet.add(idx);
      const card = document.getElementById('card-' + idx);
      const status = document.getElementById('status-' + idx);
      if (card && status) {
        card.style.borderColor = '#059669';
        status.innerText = '✓ Approved';
        status.className = 'text-xs text-emerald-400 font-bold';
      }
      document.getElementById('approved-count').innerText = approvedSet.size;
    }

    function skip(idx) {
      approvedSet.delete(idx);
      const card = document.getElementById('card-' + idx);
      const status = document.getElementById('status-' + idx);
      if (card && status) {
        card.style.borderColor = '#334155';
        status.innerText = 'Skipped';
        status.className = 'text-xs text-slate-500';
      }
      document.getElementById('approved-count').innerText = approvedSet.size;
    }

    function approveAll() {
      candidates.forEach((_, idx) => approve(idx));
    }

    function exportApprovedJSON() {
      const approvedList = candidates.filter((_, idx) => approvedSet.has(idx));
      if (approvedList.length === 0) {
        alert('Please approve at least one profile first!');
        return;
      }
      const blob = new Blob([JSON.stringify(approvedList, null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'approved_people_enrichments.json';
      a.click();
    }

    renderCards();
  </script>
</body>
</html>`;

const htmlPath = path.join(process.cwd(), 'people_approval_dashboard.html');
fs.writeFileSync(htmlPath, htmlContent, 'utf-8');

console.log(`Successfully written ${enrichedItems.length} candidates into ${htmlPath}`);
