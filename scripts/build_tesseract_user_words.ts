import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { supabase } from './lib/db';

const TESSDATA_DIR = join(process.cwd(), 'tessdata');
if (!existsSync(TESSDATA_DIR)) {
  mkdirSync(TESSDATA_DIR, { recursive: true });
}

// Noise / Role words that must NEVER be included as user words
const DISALLOWED_WORDS = new Set([
  'PRODUCER', 'DIRECTOR', 'WRITER', 'CINEMATOGRAPHER', 'EDITOR', 'SOUND', 'COSTUME',
  'MAKEUP', 'GAFFER', 'ASSISTANT', 'CAMERA', 'MOVIE', 'FULL', 'PART', 'PRODUCTION',
  'STUDIO', 'LIMITED', 'PICTURES', 'FILMS', 'ENTERTAINMENT', 'THANKS', 'LOCATION',
  'LOGISTICS', 'CATERING', 'SECURITY', 'WELFARE', 'GRAPHICS', 'MEDIA', 'CHANNEL',
  'TV', 'OFFICIAL', 'VIDEO', 'CLIP', 'SERIES', 'COPYRIGHT', 'RIGHTS', 'RESERVED',
  'EXECUTIVE', 'ASSOCIATE', 'CO-DIRECTOR', 'PRESENTATION', 'THE', 'END', 'STARRING',
  'CAST', 'CREW', 'EPISODE', 'SPECIAL', 'TRAILER', 'COMING', 'SOON', 'SUBSCRIBE',
  'LIKE', 'SHARE', 'BELL', 'ICON', 'NOTIFICATION', 'WATCH', 'CLICK', 'LINK', 'PAGE',
  'FACEBOOK', 'INSTAGRAM', 'YOUTUBE', 'TWITTER', 'TIKTOK', 'NIGERIAN', 'NOLLYWOOD',
  'YORUBA', 'IGBO', 'HAUSA', 'AFRICAN', 'CINEMA', 'ACTOR', 'ACTRESS', 'ROLE', 'CHARACTER',
  'HERO', 'VILLAIN', 'GUEST', 'CAMEO', 'EXTRAS', 'BACKGROUND', 'MUSIC', 'SCORE',
]);

// High-confidence Yoruba, Igbo, and Northern Nigerian common name vocabulary
const SEED_NIGERIAN_NAMES = [
  // Yoruba Names
  'Adebayo', 'Adedimeji', 'Afolayan', 'Toriola', 'Okiki', 'Ogundele', 'Olayinka',
  'Boluwatife', 'Oluwaseun', 'Babajide', 'Femi', 'Odunlade', 'Adekoya', 'Abimbola',
  'Adegbola', 'Akintola', 'Akindele', 'Opeyemi', 'Adesina', 'Funke', 'Adekuns',
  'Biodun', 'Toyin', 'Abraham', 'Mercy', 'Lateef', 'Wunmi', 'Sola', 'Sobowale',
  'Mustapha', 'Sharafadeen', 'Olayemi', 'Ayomide', 'Oluwatobi', 'Adeniyi', 'Adeola',
  'Bamidele', 'Eniola', 'Folake', 'Gboyega', 'Idowu', 'Kehinde', 'Taiwo', 'Yomi',
  'Muyiwa', 'Adewale', 'Adetola', 'Adeyemi', 'Akin', 'Akingbade', 'Alabi', 'Fashola',
  'Olabisi', 'Olumide', 'Omotola', 'Ropo', 'Ebun', 'Segun', 'Tunde', 'Kunle',

  // Igbo Names
  'Edochie', 'Michael', 'Okafor', 'Nnamdi', 'Chidimma', 'Chukwu', 'Oguike', 'Okocha',
  'Okonkwo', 'Eze', 'Nwosu', 'Okoro', 'Obi', 'Ifeanyi', 'Emeka', 'Chukwudi', 'Nneka',
  'Onyinye', 'Zubby', 'Genevieve', 'Nnaji', 'Pete', 'Kanayo', 'Yul', 'Chioma',
  'Chukwuka', 'Ken', 'Erics', 'Regina', 'Daniels', 'Destiny', 'Etiko', 'Nkem',
  'Owoh', 'Osita', 'Iheme', 'Chinedu', 'Ikedieze', 'John', 'Okafor', 'Racheal',
  'Okonkwo', 'Ngozi', 'Ezeonu', 'Ebele', 'Okaro', 'Patience', 'Ozokwor', 'Ignatius',

  // Hausa & Northern Names
  'Dan-Jumbo', 'Bello', 'Sani', 'Garba', 'Usman', 'Danladi', 'Shehu', 'Yakubu',
  'Ali', 'Nuhu', 'Rahama', 'Sadau', 'Adam', 'Zango', 'Hadiza', 'Gabon', 'Halima',
  'Atiku', 'Abubakar', 'Ibrahim', 'Kabiru', 'Mustapha', 'Suleiman', 'Balarabe',
];

export function cleanAndValidateName(raw: string): { isValid: boolean; cleanName?: string; tokens: string[] } {
  if (!raw) return { isValid: false, tokens: [] };
  let s = raw.trim();

  // Basic sanity check: length and valid characters (no numbers, URLs, brackets)
  if (s.length < 3 || s.length > 50) return { isValid: false, tokens: [] };
  if (/[0-9@#$%\^&\*\(\)=\+\[\]\{\}<>\/\\|:;"]/.test(s)) return { isValid: false, tokens: [] };

  // Strip common honorifics
  s = s.replace(/^(?:Chief|Alhaja|Alhaji|Dr\.?|Doctor|Prof\.?|Professor|Pastor|Evang\.?|Evangelist|Otunba|Prince|Princess|King|Queen|Sir|Lady|Engr\.?|Amb\.?|Hon\.?)\s+/i, '').trim();

  const words = s.split(/\s+/).filter(Boolean);
  if (words.length < 2) {
    // Single word name: reject unless it's a known single-word actor or clean token
    return { isValid: false, tokens: [] };
  }

  const validTokens: string[] = [];
  for (const w of words) {
    const cleanWord = w.replace(/^[^\p{L}]+|[^\p{L}]+$/gu, '');
    const upperWord = cleanWord.toUpperCase();
    if (cleanWord.length >= 2 && !DISALLOWED_WORDS.has(upperWord)) {
      validTokens.push(cleanWord);
    }
  }

  if (validTokens.length < 2) {
    return { isValid: false, tokens: [] };
  }

  const cleanName = validTokens.map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
  return { isValid: true, cleanName, tokens: validTokens };
}

async function main() {
  console.log('🔍 Querying Supabase `people` table to build Tesseract user-words dictionary...');

  const allPeople: Array<{ name: string }> = [];
  const PAGE_SIZE = 1000;
  let page = 0;
  let fetchedMore = true;

  while (fetchedMore) {
    const from = page * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;
    const { data, error } = await supabase
      .from('people')
      .select('name')
      .not('name', 'is', null)
      .range(from, to);

    if (error) {
      console.error('❌ Error fetching people from Supabase:', error.message);
      process.exit(1);
    }

    if (data && data.length > 0) {
      allPeople.push(...data);
      if (data.length < PAGE_SIZE) {
        fetchedMore = false;
      } else {
        page++;
      }
    } else {
      fetchedMore = false;
    }
  }

  console.log(`📊 Fetched ${allPeople.length} total records from \`people\` table.`);

  const wordSet = new Set<string>();
  const phraseSet = new Set<string>();

  // 1. Add Seed Names
  for (const seed of SEED_NIGERIAN_NAMES) {
    wordSet.add(seed);
  }

  // 2. Filter & Process Database People Names
  let validPeopleCount = 0;
  for (const row of allPeople) {
    const { isValid, cleanName, tokens } = cleanAndValidateName(row.name || '');
    if (!isValid || !cleanName) continue;

    validPeopleCount++;
    phraseSet.add(cleanName);

    for (const token of tokens) {
      if (token.length >= 3) {
        wordSet.add(token);
      }
    }
  }

  console.log(`✅ Validated ${validPeopleCount} high-confidence multi-word human names.`);
  console.log(`🔤 Total unique name word tokens: ${wordSet.size}`);
  console.log(`📝 Total full name phrases: ${phraseSet.size}`);

  const userWordsList = [...wordSet, ...phraseSet].sort((a, b) => a.localeCompare(b));

  const userWordsFile = join(TESSDATA_DIR, 'nollywood.user-words');
  const engUserWordsFile = join(TESSDATA_DIR, 'eng.user-words');
  const userPatternsFile = join(TESSDATA_DIR, 'user-patterns');

  writeFileSync(userWordsFile, userWordsList.join('\n'), 'utf-8');
  writeFileSync(engUserWordsFile, userWordsList.join('\n'), 'utf-8');

  // Define patterns for Tesseract: e.g. 2-word, 3-word capitalised names
  const patterns = [
    '\\A\\w+ \\w+\\z',
    '\\A\\w+ \\w+ \\w+\\z',
    '\\A\\w+ \\w+ \\w+ \\w+\\z',
  ];
  writeFileSync(userPatternsFile, patterns.join('\n'), 'utf-8');

  console.log(`💾 Saved Tesseract user-words to:\n   - ${userWordsFile}\n   - ${engUserWordsFile}`);
  console.log(`💾 Saved Tesseract patterns to:\n   - ${userPatternsFile}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
