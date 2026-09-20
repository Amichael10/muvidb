import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { Agent, setGlobalDispatcher } from 'undici';

setGlobalDispatcher(new Agent({
  connect: { timeout: 60000 },
  headersTimeout: 60000,
  bodyTimeout: 60000
}));

dotenv.config({ path: '.env.local' });
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false },
  global: {
    fetch: (url, options) => fetch(url, { ...options, signal: AbortSignal.timeout(60000) })
  }
});

// Known non-person phrases to purge completely
export const NON_PERSON_PATTERNS = [
  /^we would for you to stay/i,
  /^nollywoodmovies nigerianmovies/i,
  /^season \d+$/i,
  /^episode \d+$/i,
  /^till death$/i,
  /^executive producers?$/i,
  /^grandish global/i,
  /^voice over artst?ists?$/i,
  /^bts still photos?$/i,
  /^second unit camr?aman$/i,
  /^additional soundscore$/i,
  /^police student$/i,
  /^ast gaffer$/i,
  /^asst makeup artist$/i,
  /^data wrangler$/i,
  /^security guards?$/i,
  /^editor post$/i,
  /^props sets?$/i,
  /^props 2 ser$/i,
  /^cam tech$/i,
  /^host of others$/i,
  /^and many more$/i,
  /^and unexpected twists$/i,
  /^and intense storytelling$/i,
  /^and strong storytelling$/i,
  /^and unexpected challenges$/i,
  /^and destiny$/i,
  /^hidden battles$/i,
  /^suspenseful twists$/i,
  /^of ijogbon$/i
];

// Role prefixes to strip
export const ROLE_PREFIXES = [
  { prefix: /^receptionist\s+/i, role: 'actor', character: 'Receptionist' },
  { prefix: /^deced[pt]?[io]n?st\s+/i, role: 'actor', character: 'Receptionist', isGarbage: true },
  { prefix: /^costumer\s+/i, role: 'costume', character: null },
  { prefix: /^costume assts?\s+/i, role: 'costume', character: 'Costume Assistant' },
  { prefix: /^stillphotographer\s+/i, role: 'crew', character: 'Still Photographer' },
  { prefix: /^still photographer\s+/i, role: 'crew', character: 'Still Photographer' },
  { prefix: /^bestboy\s+/i, role: 'crew', character: 'Best Boy' },
  { prefix: /^best boy\s+/i, role: 'crew', character: 'Best Boy' },
  { prefix: /^second unit\s+/i, role: 'cinematographer', character: 'Second Unit' },
  { prefix: /^2nd unit\s+/i, role: 'cinematographer', character: 'Second Unit' },
  { prefix: /^second unit cameraman\s+/i, role: 'cinematographer', character: 'Second Unit Cameraman' },
  { prefix: /^cameraassistant\s+/i, role: 'cinematographer', character: 'Camera Assistant' },
  { prefix: /^camera assistant\s+/i, role: 'cinematographer', character: 'Camera Assistant' },
  { prefix: /^gaffer\s+/i, role: 'crew', character: 'Gaffer' },
  { prefix: /^garfer\s+/i, role: 'crew', character: 'Gaffer' },
  { prefix: /^dit\s+/i, role: 'crew', character: 'DIT' },
  { prefix: /^cam tech\s+/i, role: 'crew', character: 'Camera Technician' },
  { prefix: /^makeup asst\s+/i, role: 'makeup', character: 'Makeup Assistant' },
  { prefix: /^asst makeup\s+/i, role: 'makeup', character: 'Makeup Assistant' },
  { prefix: /^producer executive producer\s+/i, role: 'producer', character: null },
  { prefix: /^producer\s+/i, role: 'producer', character: null },
  { prefix: /^editor\s*\/colorist\s*[-:]?\s*/i, role: 'editor', character: 'Editor / Colorist' },
  { prefix: /^editor\s+/i, role: 'editor', character: null },
  { prefix: /^welfare\s*[-–]?\s*/i, role: 'crew', character: 'Welfare' },
  { prefix: /^props set\s+/i, role: 'crew', character: 'Props' },
  { prefix: /^security\s+/i, role: 'crew', character: 'Security' },
  { prefix: /^warder\s+/i, role: 'actor', character: 'Warder' },
  { prefix: /^officer\s+/i, role: 'actor', character: 'Officer' },
  { prefix: /^armed robber\s+/i, role: 'actor', character: 'Armed Robber' },
  { prefix: /^subtitle\s+/i, role: 'crew', character: 'Subtitler' },
  { prefix: /^scriptsupervisor\s+/i, role: 'crew', character: 'Script Supervisor' },
  { prefix: /^script supervisor\s+/i, role: 'crew', character: 'Script Supervisor' },
  { prefix: /^uncle\s+/i, role: 'actor', character: 'Uncle' },
  { prefix: /^uncel\s+/i, role: 'actor', character: 'Uncle' }
];

// Role suffixes to strip
export const ROLE_SUFFIXES = [
  { suffix: /\s+receptionist$/i, role: 'actor', character: 'Receptionist' },
  { suffix: /\s+police officer$/i, role: 'actor', character: 'Police Officer' },
  { suffix: /\s+scriptwriter$/i, role: 'writer', character: null },
  { suffix: /\s+script supervisor$/i, role: 'crew', character: 'Script Supervisor' },
  { suffix: /\s+makeup$/i, role: 'makeup', character: null },
  { suffix: /\s+set designer$/i, role: 'crew', character: 'Set Designer' },
  { suffix: /\s+video bts$/i, role: 'crew', character: 'Video BTS' },
  { suffix: /\s+spark$/i, role: 'crew', character: 'Spark' },
  { suffix: /\s+cam asst$/i, role: 'cinematographer', character: 'Camera Assistant' },
  { suffix: /\s+delivery man$/i, role: 'actor', character: 'Delivery Man' },
  { suffix: /\s+secretary$/i, role: 'actor', character: 'Secretary' },
  { suffix: /\s+doctor$/i, role: 'actor', character: 'Doctor' },
  { suffix: /\s+music$/i, role: 'composer', character: 'Music' }
];

async function scan() {
  console.log('Loading all people from database...');
  let allPeople: any[] = [];
  let page = 0;
  const pageSize = 1000;
  while (true) {
    const { data, error } = await supabase
      .from('people')
      .select('id, name, slug, created_at, source')
      .order('id')
      .range(page * pageSize, (page + 1) * pageSize - 1);
    if (error || !data || data.length === 0) break;
    allPeople = allPeople.concat(data);
    if (data.length < pageSize) break;
    page++;
  }
  console.log(`Loaded ${allPeople.length} people.`);

  const nameToPersonMap = new Map<string, any>();
  allPeople.forEach(p => {
    nameToPersonMap.set(p.name.trim().toLowerCase(), p);
  });

  const purgeList: { person: any; reason: string }[] = [];
  const cleanAndMergeList: {
    person: any;
    targetName: string;
    existingTargetPerson: any | null;
    extractedRole: string | null;
    extractedChar: string | null;
    action: 'merge' | 'clean_name';
  }[] = [];

  // Special known cases like OCR garbage:
  // "Decedtionist Uaddincss Ovovon" -> purge / merge into "Happiness Okokon"
  // "Tamitana Ovafaca" -> merge into "Temitope Oyefeso"

  for (const p of allPeople) {
    const rawName = (p.name || '').trim();
    const lower = rawName.toLowerCase();

    // 1. Check if non-person garbage
    let isNonPerson = false;
    for (const pat of NON_PERSON_PATTERNS) {
      if (pat.test(lower)) {
        purgeList.push({ person: p, reason: `Matches non-person pattern: ${pat}` });
        isNonPerson = true;
        break;
      }
    }
    if (isNonPerson) continue;

    // Specific OCR garbage
    if (lower === 'decedtionist uaddincss ovovon' || lower === 'decedptionst uaddincss ovovon') {
      purgeList.push({ person: p, reason: 'OCR garbage duplicate of Happiness Okokon' });
      continue;
    }
    if (lower === 'tamitana ovafaca') {
      const target = nameToPersonMap.get('temitope oyefeso');
      cleanAndMergeList.push({
        person: p,
        targetName: 'Temitope Oyefeso',
        existingTargetPerson: target,
        extractedRole: 'director',
        extractedChar: null,
        action: 'merge'
      });
      continue;
    }

    // 2. Check role prefixes
    let prefixMatched = false;
    for (const rp of ROLE_PREFIXES) {
      if (rp.prefix.test(rawName)) {
        prefixMatched = true;
        let cleaned = rawName.replace(rp.prefix, '').trim();
        // Clean special characters at beginning like "–"
        cleaned = cleaned.replace(/^[-–—:\s]+/, '').trim();

        // Check if cleaned name exists in DB
        const target = nameToPersonMap.get(cleaned.toLowerCase());
        cleanAndMergeList.push({
          person: p,
          targetName: cleaned,
          existingTargetPerson: target,
          extractedRole: rp.role,
          extractedChar: rp.character,
          action: target ? 'merge' : 'clean_name'
        });
        break;
      }
    }
    if (prefixMatched) continue;

    // 3. Check role suffixes
    let suffixMatched = false;
    for (const rs of ROLE_SUFFIXES) {
      if (rs.suffix.test(rawName)) {
        suffixMatched = true;
        const cleaned = rawName.replace(rs.suffix, '').trim();
        const target = nameToPersonMap.get(cleaned.toLowerCase());
        cleanAndMergeList.push({
          person: p,
          targetName: cleaned,
          existingTargetPerson: target,
          extractedRole: rs.role,
          extractedChar: rs.character,
          action: target ? 'merge' : 'clean_name'
        });
        break;
      }
    }
    if (suffixMatched) continue;

    // 4. Check known character names glued to existing actors in recent harvest:
    // e.g. "Akinola Akano Chris" -> "Akinola Akano", char: "Chris"
    // "Rhoda Inaju Kemi" -> "Rhoda Inaju", char: "Kemi"
    // "Lanre Diwura Jide" -> "Lanre Adediwura", char: "Jide"
    // "Olarotimi Fakunle Kola" -> "Olarotimi Fakunle", char: "Kola"
    // "Shammah Agah Sola" -> "Shammah Agah", char: "Sola"
    // "Yetunde Sulaimon Bestie" -> "Yetunde Sulaimon", char: "Bestie"
    // "Adeyemi Adeniran Stoneboy" -> "Adeyemi Adeniran", char: "Stoneboy"
    // "Karimoh Adeshewa Lady" -> "Karimoh Adeshewa", char: "Lady"
    // "Adebayo Faruq Pa" -> "Adebayo Faruq", char: "Pa"
    // "Akeem Adeyemiadeolu" -> "Akeem Adeyemi", char: "Adeolu"
    // "Wumi Toriolamoyo" -> "Wunmi Toriola", char: "Moyo"
    // "Debbie Shokoyatemisan" -> "Debbie Shokoya", char: "Temisan"
    // "Tunde Aderinoye Kitan" -> "Tunde Aderinoye", char: "Kitan"
    // "Ibrahim Yekiniolulana" -> "Ibrahim Yekini", char: "Olulana"
    // "Ibrahim Chatta Olumofin" -> "Ibrahim Chatta", char: "Olumofin"
    // "Kemi Apesin Olutoun" -> "Kemi Apesin Ariyo", char: "Olutoun"
    // "Yetunde Barnabas Eegun" -> "Yetunde Barnabas", char: "Eegun"
    // "Kunle Omisore Arowosafe" -> "Kunle Omisore", char: "Arowosafe"
    // "Temitope Aremu Temidire" -> "Temitope Aremu", char: "Temidire"
    // "Tomi Omoni Oboli" -> "Omoni Oboli", char: "Tomi"
    // "Damilare Daniel Etim Effiong" -> "Daniel Etim Effiong", char: "Damilare"
    // "Segun Akin Lewis" -> "Akin Lewis", char: "Segun"
    // "Uncel Edwin Jerry Singer" -> "Jerry Singer", char: "Uncle Edwin"
    const knownGluedCharacters = [
      { raw: 'Uncel Edwin Jerry Singer', target: 'Jerry Singer', char: 'Uncle Edwin' },
      { raw: 'Akinola Akano Chris', target: 'Akinola Akano', char: 'Chris' },
      { raw: 'Rhoda Inaju Kemi', target: 'Rhoda Inaju', char: 'Kemi' },
      { raw: 'Lanre Diwura Jide', target: 'Lanre Adediwura', char: 'Jide' },
      { raw: 'Olarotimi Fakunle Kola', target: 'Olarotimi Fakunle', char: 'Kola' },
      { raw: 'Shammah Agah Sola', target: 'Shammah Agah', char: 'Sola' },
      { raw: 'Yetunde Sulaimon Bestie', target: 'Yetunde Sulaimon', char: 'Bestie' },
      { raw: 'Adeyemi Adeniran Stoneboy', target: 'Adeyemi Adeniran', char: 'Stoneboy' },
      { raw: 'Karimoh Adeshewa Lady', target: 'Karimoh Adeshewa', char: 'Lady' },
      { raw: 'Adebayo Faruq Pa', target: 'Adebayo Faruq', char: 'Pa' },
      { raw: 'Akeem Adeyemiadeolu', target: 'Akeem Adeyemi', char: 'Adeolu' },
      { raw: 'Wumi Toriolamoyo', target: 'Wunmi Toriola', char: 'Moyo' },
      { raw: 'Debbie Shokoyatemisan', target: 'Debbie Shokoya', char: 'Temisan' },
      { raw: 'Tunde Aderinoye Kitan', target: 'Tunde Aderinoye', char: 'Kitan' },
      { raw: 'Ibrahim Yekiniolulana', target: 'Ibrahim Yekini', char: 'Olulana' },
      { raw: 'Ibrahim Chatta Olumofin', target: 'Ibrahim Chatta', char: 'Olumofin' },
      { raw: 'Kemi Apesin Olutoun', target: 'Kemi Apesin Ariyo', char: 'Olutoun' },
      { raw: 'Yetunde Barnabas Eegun', target: 'Yetunde Barnabas', char: 'Eegun' },
      { raw: 'Kunle Omisore Arowosafe', target: 'Kunle Omisore', char: 'Arowosafe' },
      { raw: 'Temitope Aremu Temidire', target: 'Temitope Aremu', char: 'Temidire' },
      { raw: 'Tomi Omoni Oboli', target: 'Omoni Oboli', char: 'Tomi' },
      { raw: 'Tomi Omonlorou', target: 'Omoni Oboli', char: 'Tomi' },
      { raw: 'Damilare Daniel Etim Effiong', target: 'Daniel Etim Effiong', char: 'Damilare' },
      { raw: 'Segun Akin Lewis', target: 'Akin Lewis', char: 'Segun' },
      { raw: 'Ese Chinonye Chidolue', target: 'Chinonye Chidolue', char: 'Ese' },
      { raw: 'Ajetunmobi Olorunwapelumi Itunu Olaniyi', target: 'Ajetunmobi Olorunwapelumi', char: null },
      { raw: 'Oluwaseun Awonusi Adesokan Abdullah', target: 'Oluwaseun Awonusi', char: null },
      { raw: 'Deola Bimbo Adebayo', target: 'Bimbo Adebayo', char: null },
      { raw: 'Ibrahim Yekini Itele', target: 'Ibrahim Yekini', char: null },
      { raw: 'Enewa Omeche Oko', target: 'Omeche Oko', char: null },
      { raw: 'Obinna Victory Michael', target: 'Victory Michael', char: null }
    ];

    const matchGlued = knownGluedCharacters.find(k => k.raw.toLowerCase() === lower);
    if (matchGlued) {
      const target = nameToPersonMap.get(matchGlued.target.toLowerCase());
      cleanAndMergeList.push({
        person: p,
        targetName: matchGlued.target,
        existingTargetPerson: target,
        extractedRole: 'actor',
        extractedChar: matchGlued.char,
        action: target ? 'merge' : 'clean_name'
      });
    }
  }

  console.log(`\n=== SUMMARY OF PLANNED ACTIONS ===`);
  console.log(`1. Purge List (Non-persons / Pure OCR garbage): ${purgeList.length}`);
  purgeList.forEach(item => {
    console.log(`   🗑️  "${item.person.name}" (ID: ${item.person.id}) -> ${item.reason}`);
  });

  console.log(`\n2. Clean & Merge List: ${cleanAndMergeList.length}`);
  cleanAndMergeList.forEach(item => {
    console.log(`   🔄 "${item.person.name}" (ID: ${item.person.id}) -> [${item.action.toUpperCase()}] target: "${item.targetName}" (${item.existingTargetPerson?.id || 'NEW_NAME'}), role: ${item.extractedRole}, char: "${item.extractedChar}"`);
  });
}

scan().catch(console.error);
