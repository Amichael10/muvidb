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

const supabase = createClient(process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

// Known prefixes/roles in end credits
const PREFIX_ROLES = [
  'receptionist', 'decedtionist', 'decedptionst', 'deceptionist',
  'costumer', 'stillphotographer', 'still photographer', 'still photo',
  'bestboy', 'best boy', 'second unit', 'secondunit', '2nd unit',
  'gaffer', 'garfer', 'sound recordist', 'sound engineer', 'camera operator',
  'cameraman', 'cam tech', 'cinematographer', 'director', 'producer',
  'assistant director', 'continuity', 'set designer', 'makeup', 'make up',
  'hair stylist', 'production manager', 'production assistant', 'editor',
  'script supervisor', 'welfare', 'driver', 'security', 'props', 'light man',
  'sound mixer', 'boom operator', 'dit', 'focus puller', 'grip', 'location manager',
  'wardrobe', 'clapper loader', 'caterer', 'transport'
];

async function main() {
  console.log('--- 1. Finding People whose names start with or contain roles ---');
  
  // Fetch all people created in last 7 days or all people with source = 'manual' or 'harvest'
  // Or fetch all people by pagination (let's get all people in DB, ~10,000-20,000 max)
  let allPeople: any[] = [];
  let page = 0;
  const pageSize = 1000;
  while (true) {
    const { data, error } = await supabase
      .from('people')
      .select('id, name, slug, created_at, source')
      .range(page * pageSize, (page + 1) * pageSize - 1);
    if (error || !data || data.length === 0) break;
    allPeople = allPeople.concat(data);
    if (data.length < pageSize) break;
    page++;
  }
  console.log(`Loaded ${allPeople.length} people from database.`);

  const roleNameMatches: { person: any; rolePrefix: string; cleanedName: string }[] = [];
  for (const p of allPeople) {
    const name = (p.name || '').trim();
    const lower = name.toLowerCase();

    for (const r of PREFIX_ROLES) {
      const reg = new RegExp(`^${r}[:\\s-]+(.*)$`, 'i');
      const m = lower.match(reg);
      if (m) {
        // e.g. "Receptionist Happiness Okokon" -> cleaned: "Happiness Okokon"
        const cleaned = name.slice(name.length - m[1].length).trim();
        roleNameMatches.push({ person: p, rolePrefix: r, cleanedName: cleaned });
        break;
      }
    }
  }

  console.log(`\nFound ${roleNameMatches.length} people whose names start with a role:`);
  for (const m of roleNameMatches) {
    console.log(`  - [${m.rolePrefix}] "${m.person.name}" -> cleaned: "${m.cleanedName}" (ID: ${m.person.id})`);
  }

  console.log('\n--- 2. Checking recent films for duplicate credits / OCR pairs ---');
  // Look at films that have harvest_consensus or created recently
  const { data: harvestCredits } = await supabase
    .from('credits')
    .select('id, film_id, person_id, role, character_name, billing_order, source, created_at, people(id, name), films(id, title)')
    .order('film_id')
    .order('billing_order', { ascending: true });

  const filmCreditsMap = new Map<string, any[]>();
  for (const c of harvestCredits || []) {
    if (!filmCreditsMap.has(c.film_id)) filmCreditsMap.set(c.film_id, []);
    filmCreditsMap.get(c.film_id)!.push(c);
  }

  const suspiciousPairs: any[] = [];
  for (const [filmId, creds] of filmCreditsMap.entries()) {
    const filmTitle = creds[0]?.films?.title || filmId;

    // Check adjacent billing orders or identical roles
    for (let i = 0; i < creds.length; i++) {
      for (let j = i + 1; j < creds.length; j++) {
        const c1 = creds[i];
        const c2 = creds[j];
        const n1 = (c1.people?.name || '').trim().toLowerCase();
        const n2 = (c2.people?.name || '').trim().toLowerCase();

        if (!n1 || !n2 || n1 === n2) continue;

        // If same role and adjacent billing order or very similar name or obvious OCR glitch
        // Check word overlap or substring or length similarity with same word count
        const words1 = n1.split(/\s+/);
        const words2 = n2.split(/\s+/);

        const isAdjacent = Math.abs(c1.billing_order - c2.billing_order) <= 2;
        const sameRole = c1.role === c2.role;

        // Check if one contains the other (e.g. "Yomi Fash Lanso" and "Yomi Fash", "Enewa Omeche Oko" and "Omeche Oko")
        const isSubstring = (n1.includes(n2) || n2.includes(n1)) && (words1.length > 1 || words2.length > 1);

        // Check character length and word count match with OCR distortion (e.g. "Receptionist Happiness Okokon" (3 words, ~30 chars) and "Decedtionist Uaddincss Ovovon" (3 words, ~29 chars))
        const sameWordCount = words1.length === words2.length && words1.length >= 2;
        let wordLenMatch = false;
        if (sameWordCount && isAdjacent && sameRole) {
          // Check if lengths of individual words match within 1 char
          wordLenMatch = words1.every((w, idx) => Math.abs(w.length - words2[idx].length) <= 2);
        }

        if (isSubstring || (sameWordCount && wordLenMatch && isAdjacent && sameRole)) {
          suspiciousPairs.push({
            filmId,
            filmTitle,
            credit1: { id: c1.id, billing: c1.billing_order, role: c1.role, personId: c1.person_id, name: c1.people?.name },
            credit2: { id: c2.id, billing: c2.billing_order, role: c2.role, personId: c2.person_id, name: c2.people?.name },
            reason: isSubstring ? 'substring/overlap' : 'adjacent OCR word-length pattern'
          });
        }
      }
    }
  }

  console.log(`\nFound ${suspiciousPairs.length} suspicious duplicate / OCR credit pairs across films:`);
  for (const p of suspiciousPairs) {
    console.log(`🎬 "${p.filmTitle}":`);
    console.log(`   [#${p.credit1.billing}] ${p.credit1.role}: "${p.credit1.name}" (${p.credit1.personId})`);
    console.log(`   [#${p.credit2.billing}] ${p.credit2.role}: "${p.credit2.name}" (${p.credit2.personId})`);
    console.log(`   Reason: ${p.reason}\n`);
  }
}

main().catch(console.error);
