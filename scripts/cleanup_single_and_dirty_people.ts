import { serviceSupabase } from './lib/credit_consensus_verifier';

// Legitimate stage mononyms in African cinema/entertainment to preserve
const PROTECTED_MONONYMS = new Set([
  'falz', 'sabinus', 'phyna', 'sanyeri', 'saje', 'saka', 'latin', 'ogogo',
  'pawpaw', 'aki', 'alibaba', 'phyno', 'vector', 'waje', 'kalybos', 'akrobeto',
  'rmd', 'kok', 'mzvee', 'chigul', 'nasboi', 'funnybone', 'iteledicon',
  'alapini', 'alapinni', 'lalude', 'dejo', 'digboluja', 'lanko', 'okele',
  'okunnu', 'omoloye', 'omobanke', 'ojopagogo', 'ojoopagogo', 'wayoosi',
  'qdot', 'sheggz', 'liquorose', 'denrele', 'elozonam', 'kaakie', 'efya'
]);

// Explicit junk / non-people tokens to purge
const JUNK_NAMES = new Set([
  '---', '...', '2aj', '39/40', '@muqtarolamilekan', 'efaea', 'eoooeoee—s',
  'prooucan', 'proovas', 'd.o.p', 'wardrobe/costumier', 'coordinator', 'doctor',
  'gateman', 'ghallywood', 'babalawo', 'agbero', 'nanny', 'driver', 'bts',
  'c-confion', 'ceejay', 'morldlexx', 'soquet', 'auayllida', 'rotuaioshua',
  'adlageoones', 'apakufor', 'apakunfor', 'ayecase', 'ayenmay', 'biolafowosere'
]);

// Known glued / concatenated mapping overrides
const GLUED_NAME_OVERRIDES: Record<string, string> = {
  angelunigwe: 'Angel Unigwe',
  afeezowo: 'Afeez Owo',
  brodashaggi: 'Broda Shaggi',
  brodashagi: 'Broda Shaggi',
  chinenyeuba: 'Chinenye Uba',
  ritaedochie: 'Rita Edochie',
  tanaadelana: 'Tana Adelana',
  woleojo: 'Wole Ojo',
  wumitoriola: 'Wunmi Toriola',
  yetundebarnabas: 'Yetunde Barnabas',
  harrybanyanwu: 'Harry B. Anyanwu',
  'harry.b.anyanwu': 'Harry B. Anyanwu',
  'promise.e.onyemnazor': 'Promise E. Onyemnazor',
  promiseeonyemnazor: 'Promise E. Onyemnazor',
  moyolawaldavidmckenzie: 'Moyo Lawal',
  adakirikiri: 'Ada Kirikiri',
  aminapapapa: 'Amina Papapa',
  ejidealakara: 'Ejide Alakara',
  ibrahimbashir: 'Ibrahim Bashir',
  onyiicindyumeh: 'Onyii Cindy Umeh',
  peacejapheth: 'Peace Japheth',
  barbarasoky: 'Barbara Soky',
  mobimbe: 'Mo Bimbo',
  chiefepeyjr: 'Chief Epey Jr',
  tanaadelana: 'Tana Adelana',
};

function toTitleCase(str: string): string {
  if (!str) return '';
  return str
    .toLowerCase()
    .split(/\s+/)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

// Split CamelCase words if name looks glued, e.g. "AngelUnigwe" -> "Angel Unigwe"
function unglueCamelCase(name: string): string | null {
  const norm = name.toLowerCase().trim();
  if (GLUED_NAME_OVERRIDES[norm]) return GLUED_NAME_OVERRIDES[norm];

  // Regex matching PascalCase / CamelCase with 2 or 3 capitalized tokens: e.g. "AngelUnigwe" or "RitaEdochie"
  if (/^[A-Z][a-z]{2,}[A-Z][a-z]{2,}([A-Z][a-z]{2,})?$/.test(name)) {
    const unglued = name.replace(/([a-z])([A-Z])/g, '$1 $2').trim();
    if (unglued.split(/\s+/).length >= 2) {
      return unglued;
    }
  }
  return null;
}

async function mergePerson(sourceId: string, targetId: string, sourceName: string, targetName: string) {
  if (sourceId === targetId) return;

  // 1. Move credits
  const { data: sourceCredits } = await serviceSupabase
    .from('credits')
    .select('*')
    .eq('person_id', sourceId);

  if (sourceCredits && sourceCredits.length > 0) {
    for (const cred of sourceCredits) {
      // Check if target already has credit for this film and role
      const { data: existing } = await serviceSupabase
        .from('credits')
        .select('id')
        .eq('film_id', cred.film_id)
        .eq('person_id', targetId)
        .eq('role', cred.role)
        .maybeSingle();

      if (existing) {
        // Delete redundant duplicate credit from source
        await serviceSupabase.from('credits').delete().eq('id', cred.id);
      } else {
        // Transfer credit to target person
        await serviceSupabase
          .from('credits')
          .update({ person_id: targetId })
          .eq('id', cred.id);
      }
    }
  }

  // 2. Move awards if any
  try {
    await serviceSupabase
      .from('awards')
      .update({ person_id: targetId })
      .eq('person_id', sourceId);
  } catch {}

  // 3. Move social content items if any
  try {
    await serviceSupabase
      .from('social_content_items')
      .update({ person_id: targetId })
      .eq('person_id', sourceId);
  } catch {}

  // 4. Delete source person record
  const { error: delErr } = await serviceSupabase
    .from('people')
    .delete()
    .eq('id', sourceId);

  if (!delErr) {
    console.log(`  🔀 Merged "${sourceName}" (${sourceId}) -> "${targetName}" (${targetId})`);
  } else {
    console.error(`  ⚠️ Failed to delete source "${sourceName}":`, delErr.message);
  }
}

async function runCleanup() {
  console.log('🧹 Starting cleanup of single-word, glued, and junk people records...');

  // 1. Fetch all people
  let allPeople: { id: string; name: string; film_count?: number }[] = [];
  let page = 0;
  while (true) {
    const { data, error } = await serviceSupabase
      .from('people')
      .select('id, name, film_count')
      .range(page * 1000, (page + 1) * 1000 - 1);

    if (error) {
      console.error('Error fetching people:', error);
      break;
    }
    if (!data || data.length === 0) break;
    allPeople = allPeople.concat(data);
    if (data.length < 1000) break;
    page++;
  }

  console.log(`Total people loaded: ${allPeople.length}`);

  // Create lookup by lower-cased name
  const nameToPersonMap = new Map<string, typeof allPeople[0]>();
  for (const p of allPeople) {
    if (p.name) nameToPersonMap.set(p.name.toLowerCase().trim(), p);
  }

  let junkDeleted = 0;
  let gluedMerged = 0;
  let namesRenamed = 0;

  // 2. Process each person
  for (const person of allPeople) {
    if (!person.name) continue;
    const rawName = person.name.trim();
    const lower = rawName.toLowerCase();

    // A. Check Junk / Roles / OCR Artifacts
    if (JUNK_NAMES.has(lower) || /^[-\.\@\d\/\=\_\#]+$/.test(lower) || lower.length <= 1) {
      // Delete credits
      await serviceSupabase.from('credits').delete().eq('person_id', person.id);
      // Delete person
      const { error: delErr } = await serviceSupabase.from('people').delete().eq('id', person.id);
      if (!delErr) {
        junkDeleted++;
        console.log(`  🗑️ Purged junk record: "${person.name}" (${person.id})`);
      }
      continue;
    }

    // B. Check Glued Names
    const ungluedTarget = unglueCamelCase(rawName);
    if (ungluedTarget && ungluedTarget.toLowerCase() !== lower) {
      const targetLower = ungluedTarget.toLowerCase();
      const existingTarget = nameToPersonMap.get(targetLower);

      if (existingTarget && existingTarget.id !== person.id) {
        // Merge into existing proper person profile
        await mergePerson(person.id, existingTarget.id, rawName, existingTarget.name);
        gluedMerged++;
      } else {
        // Rename this record to proper unglued title case
        const properName = toTitleCase(ungluedTarget);
        const { error: upErr } = await serviceSupabase
          .from('people')
          .update({ name: properName })
          .eq('id', person.id);

        if (!upErr) {
          nameToPersonMap.set(properName.toLowerCase(), { ...person, name: properName });
          namesRenamed++;
          console.log(`  ✏️ Fixed glued name: "${rawName}" -> "${properName}" (${person.id})`);
        }
      }
      continue;
    }
  }

  console.log('\n================ SUMMARY ================');
  console.log(`🗑️ Junk & OCR tokens deleted: ${junkDeleted}`);
  console.log(`🔀 Glued records merged into proper profiles: ${gluedMerged}`);
  console.log(`✏️ Glued records renamed with proper spaces: ${namesRenamed}`);
  console.log('✅ People table cleanup complete!');
}

runCleanup().catch(console.error);
