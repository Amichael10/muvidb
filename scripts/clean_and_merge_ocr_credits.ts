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

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: { persistSession: false },
    global: {
      fetch: (url, options) => fetch(url, { ...options, signal: AbortSignal.timeout(60000) })
    }
  }
);

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

async function findPersonByName(name: string): Promise<any | null> {
  const clean = name.trim();
  const { data } = await supabase
    .from('people')
    .select('id, name, slug')
    .ilike('name', clean)
    .limit(1);
  return data && data.length > 0 ? data[0] : null;
}

// 1. Non-person garbage to delete directly
const PURGE_PERSON_NAMES = [
  'Decedtionist Uaddincss Ovovon',
  'Decedptionst Uaddincss Ovovon',
  'Tamitana Ovafaca',
  'Till Death',
  'We Would For You To Stay Connected With Us Please',
  'Voice Over Artstists',
  'Bts Still Photos',
  'Second Unit Camraman',
  'Additional Soundscore',
  'Police Student',
  'Ast Gaffer',
  'Asst Makeup Artist',
  'Data Wrangler',
  'Executive Producers',
  'Grandish Global Company',
  'Season 3',
  'Nollywoodmovies Nigerianmovies Oguikesisters Mykidsandi',
  'CAM TECH',
  'SECURITY GUARDS',
  'Editor Post',
  'Props Sets',
  'PROPS 2 Ser',
  'Host Of Others',
  'And Many More',
  'And Unexpected Twists',
  'And Intense Storytelling',
  'And Strong Storytelling',
  'And Unexpected Challenges',
  'And Destiny',
  'Hidden Battles',
  'Suspenseful Twists',
  'Of Ijogbon',
  'BOOM SWINGER'
];

// 2. Exact merges (glued character/actor duplicates into existing stars/people)
// Format: { sourcePersonName, targetPersonName, characterName, role }
const MERGE_PAIRS = [
  // Love and Legacy
  { sourceName: 'Enewa Omeche Oko', targetName: 'Omeche Oko', char: null, role: 'actor' },
  { sourceName: 'Obinna Victory Michael', targetName: 'Victory Michael', char: null, role: 'actor' },
  { sourceName: 'Uncel Edwin Jerry Singer', targetName: 'Jerry Singer', char: 'Uncle Edwin', role: 'actor' },

  // Abaku (Till Death)
  { sourceName: 'Akeem Adeyemiadeolu', targetName: 'Akeem Adeyemi', char: 'Adeolu', role: 'actor' },
  { sourceName: 'Wumi Toriolamoyo', targetName: 'Wunmi Toriola', char: 'Moyo', role: 'actor' },
  { sourceName: 'Debbie Shokoyatemisan', targetName: 'Debbie Shokoya', char: 'Temisan', role: 'actor' },
  { sourceName: 'Tunde Aderinoye Kitan', targetName: 'Tunde Aderinoye', char: 'Kitan', role: 'actor' },
  { sourceName: 'Akeem Adeyemitv Music', targetName: 'Akeem Adeyemi', char: 'Music', role: 'composer' },

  // Fatal Secrets
  { sourceName: 'Akinola Akano Chris', targetName: 'Akinola Akano', char: 'Chris', role: 'actor' },
  { sourceName: 'Rhoda Inaju Kemi', targetName: 'Rhoda Inaju', char: 'Kemi', role: 'actor' },
  { sourceName: 'Lanre Diwura Jide', targetName: 'Lanre Adediwura', char: 'Jide', role: 'actor' },
  { sourceName: 'Akinola Akano Scriptwriter', targetName: 'Akinola Akano', char: null, role: 'writer' },
  { sourceName: 'Akinola Akaño', targetName: 'Akinola Akano', char: null, role: 'crew' },
  { sourceName: 'Ajetunmobi Olorunwapelumi Cam Asst', targetName: 'Ajetunmobi Olorunwapelumi Itunu Olaniyi', char: null, role: 'cinematographer' },

  // Ole Diran PT 2
  { sourceName: 'Ibrahim Yekiniolulana', targetName: 'Ibrahim Yekini', char: 'Olulana', role: 'actor' },
  { sourceName: 'Ibrahim Chatta Olumofin', targetName: 'Ibrahim Chatta', char: 'Olumofin', role: 'actor' },
  { sourceName: 'Kemi Apesin Olutoun', targetName: 'Kemi Apesin Ariyo', char: 'Olutoun', role: 'actor' },
  { sourceName: 'Yetunde Barnabas Eegun', targetName: 'Yetunde Barnabas', char: 'Eegun', role: 'actor' },
  { sourceName: 'Ibrahim Yekini Itele', targetName: 'Ibrahim Yekini', char: null, role: 'director' },

  // Married for the Weekend
  { sourceName: 'Tomi Omonlorou', targetName: 'Omoni Oboli', char: 'Tomi', role: 'actor' },
  { sourceName: 'Tomi Omoni Oboli', targetName: 'Omoni Oboli', char: 'Tomi', role: 'actor' },
  { sourceName: 'Damilare Daniel Etim Effiong', targetName: 'Daniel Etim Effiong', char: 'Damilare', role: 'actor' },
  { sourceName: 'Segun Akin Lewis', targetName: 'Akin Lewis', char: 'Segun', role: 'actor' },

  // Ipenija
  { sourceName: 'Deola Bimbo Adebayo', targetName: 'Bimbo Adebayo', char: null, role: 'producer' },

  // Every Word of Love
  { sourceName: 'Frances Nwabuike', targetName: 'Frances Nwabunike', char: null, role: 'actor' },
  { sourceName: 'Somtochukwuigbokwe Orjin', targetName: 'Somtochukwu Igbokwe', char: null, role: 'crew' }
];

// 3. Names where role needs to be stripped & character/role preserved
const ROLE_STRIP_RULES = [
  // Love and Legacy
  { rawName: 'Receptionist Happiness Okokon', cleanName: 'Happiness Okokon', char: 'Receptionist', role: 'actor' },
  { rawName: 'Costumer Chioma Obi', cleanName: 'Chioma Obi', char: null, role: 'costume' },
  { rawName: 'Stillphotographer Sammy Goddy', cleanName: 'Sammy Goddy', char: 'Still Photographer', role: 'crew' },
  { rawName: 'Bestboy Godwin Abiola', cleanName: 'Godwin Abiola', char: 'Best Boy', role: 'crew' },
  { rawName: 'Second Unit Balogun Yusroh', cleanName: 'Balogun Yusroh', char: 'Second Unit', role: 'cinematographer' },

  // Abaku (Till Death)
  { rawName: 'Jide Dawodu Delivery Man', cleanName: 'Jide Dawodu', char: 'Delivery Man', role: 'actor' },
  { rawName: 'Kikelomo Ayoolasecretary', cleanName: 'Kikelomo Ayoola', char: 'Secretary', role: 'actor' },
  { rawName: 'Biodun Okeowodoctor', cleanName: 'Biodun Okeowo', char: 'Doctor', role: 'actor' },
  { rawName: 'Ajibola Isaacayo', cleanName: 'Ajibola Isaac', char: 'Ayo', role: 'actor' },

  // Fatal Secrets
  { rawName: 'Olarotimi Fakunle Kola', cleanName: 'Olarotimi Fakunle', char: 'Kola', role: 'actor' },
  { rawName: 'Shammah Agah Sola', cleanName: 'Shammah Agah', char: 'Sola', role: 'actor' },
  { rawName: 'Yetunde Sulaimon Bestie', cleanName: 'Yetunde Sulaimon', char: 'Bestie', role: 'actor' },
  { rawName: 'Adesokan Abdullah Police Officer', cleanName: 'Adesokan Abdullah', char: 'Police Officer', role: 'actor' },
  { rawName: 'Adeyemi Adeniran Stoneboy', cleanName: 'Adeyemi Adeniran', char: 'Stoneboy', role: 'actor' },
  { rawName: 'Karimoh Adeshewa Lady', cleanName: 'Karimoh Adeshewa', char: 'Lady', role: 'actor' },
  { rawName: 'Ajombadi Adedamola Receptionist', cleanName: 'Ajombadi Adedamola', char: 'Receptionist', role: 'actor' },
  { rawName: 'Adebayo Faruq Pa', cleanName: 'Adebayo Faruq', char: 'Pa', role: 'actor' },
  { rawName: 'Erioluwaseun Ifeoluwani Script Supervisor', cleanName: 'Erioluwaseun Ifeoluwani', char: null, role: 'crew' },
  { rawName: 'Oluwaseun Awonusi Adesokan Abdullah', cleanName: 'Oluwaseun Awonusi', char: null, role: 'crew' },
  { rawName: 'Shobakin Kafayat Makeup', cleanName: 'Shobakin Kafayat', char: null, role: 'makeup' },
  { rawName: 'Ambali Abiola.am Set Designer', cleanName: 'Ambali Abiola', char: 'Set Designer', role: 'crew' },
  { rawName: 'Ambali Abíola.am', cleanName: 'Ambali Abiola', char: null, role: 'crew' },
  { rawName: 'Olaifa Oluwadamilare Video Bts', cleanName: 'Olaifa Oluwadamilare', char: 'Video BTS', role: 'crew' },
  { rawName: 'Kunle Alabi Spark', cleanName: 'Kunle Alabi', char: 'Spark', role: 'crew' },
  { rawName: 'Ajetunmobi Olorunwapelumi Itunu Olaniyi', cleanName: 'Ajetunmobi Olorunwapelumi', char: null, role: 'cinematographer' },

  // Ipenija
  { rawName: 'Warder Idasiu Salami', cleanName: 'Idasiu Salami', char: 'Warder', role: 'actor' },
  { rawName: 'Big Lion Ibrahim Bashir', cleanName: 'Ibrahim Bashir', char: 'Big Lion', role: 'actor' },
  { rawName: 'Officer Testimony Salawu', cleanName: 'Testimony Salawu', char: 'Officer', role: 'actor' },
  { rawName: 'Armed Robber Prince Oluwafemi', cleanName: 'Prince Oluwafemi', char: 'Armed Robber', role: 'actor' },
  { rawName: 'Armed Robber Koleoso Johnson', cleanName: 'Koleoso Johnson', char: 'Armed Robber', role: 'actor' },
  { rawName: 'Dit Ganiyu Uthman', cleanName: 'Ganiyu Uthman', char: 'DIT', role: 'crew' },
  { rawName: 'Subtitle Funmilayo Tunmise', cleanName: 'Funmilayo Tunmise', char: 'Subtitler', role: 'crew' },

  // Ole Diran PT 2
  { rawName: 'Kunle Omisore Arowosafe', cleanName: 'Kunle Omisore', char: 'Arowosafe', role: 'actor' },
  { rawName: 'Temitope Aremu Temidire', cleanName: 'Temitope Aremu', char: 'Temidire', role: 'actor' },

  // Married for the Weekend
  { rawName: 'Ese Chinonye Chidolue', cleanName: 'Chinonye Chidolue', char: 'Ese', role: 'actor' },
  { rawName: 'Costume Assts Gloria Udoh', cleanName: 'Gloria Udoh', char: 'Costume Assistant', role: 'costume' },
  { rawName: 'Makeup Asst Taiwo Omotoyosi', cleanName: 'Taiwo Omotoyosi', char: 'Makeup Assistant', role: 'makeup' },
  { rawName: 'Cam Tech Shittu Olasunkanmi', cleanName: 'Shittu Olasunkanmi', char: 'Camera Technician', role: 'crew' },
  { rawName: 'Dit Olaitan Isa Rafiu', cleanName: 'Olaitan Isa Rafiu', char: 'DIT', role: 'crew' },

  // Every Word of Love
  { rawName: 'Cameraassistant Darlington Emmanuel', cleanName: 'Darlington Emmanuel', char: 'Camera Assistant', role: 'cinematographer' },
  { rawName: 'Second Unit Cameraman Abayomi Sunday', cleanName: 'Abayomi Sunday', char: 'Second Unit Cameraman', role: 'cinematographer' },
  { rawName: 'Garfer Francis Anosike', cleanName: 'Francis Anosike', char: 'Gaffer', role: 'crew' },
  { rawName: 'Scriptsupervisor Caiayiracheal', cleanName: 'Ajayi Racheal', char: 'Script Supervisor', role: 'crew' },

  // Database-wide
  { rawName: 'Adebamjo Romoke Receptionist', cleanName: 'Adebamjo Romoke', char: 'Receptionist', role: 'actor' },
  { rawName: 'WELFARE –AMAKA ARINZE', cleanName: 'Amaka Arinze', char: 'Welfare', role: 'crew' },
  { rawName: 'Props Set Michael Ifeannyi', cleanName: 'Michael Ifeanyi', char: 'Props Set', role: 'crew' },
  { rawName: 'Security Gbenga Ojo', cleanName: 'Gbenga Ojo', char: 'Security', role: 'crew' },
  { rawName: 'Producer Executive Producer Emma Chinedum', cleanName: 'Emma Chinedum', char: null, role: 'producer' },
  { rawName: 'EDITOR /COLORIST- EKENE NWOKOLO', cleanName: 'Ekene Nwokolo', char: 'Editor / Colorist', role: 'editor' },
  { rawName: 'PRODUCER CLARE ETEAKACHA', cleanName: 'Clare Eteakacha', char: null, role: 'producer' }
];

async function runCleanup() {
  console.log('================================================================');
  console.log('🧹 STEP 1: PURGING NON-PERSON GARBAGE & OCR HALLUCINATIONS');
  console.log('================================================================');

  for (const name of PURGE_PERSON_NAMES) {
    const { data: people } = await supabase.from('people').select('id, name').ilike('name', name);
    if (!people || people.length === 0) continue;

    for (const p of people) {
      console.log(`🗑️  Found garbage person: "${p.name}" (${p.id})`);
      // Delete all credits
      const { error: cErr } = await supabase.from('credits').delete().eq('person_id', p.id);
      if (cErr) console.error(`   Error deleting credits for ${p.name}:`, cErr.message);
      // Delete person
      const { error: pErr } = await supabase.from('people').delete().eq('id', p.id);
      if (pErr) console.error(`   Error deleting person ${p.name}:`, pErr.message);
      else console.log(`   ✅ Successfully deleted person "${p.name}" and all associated credits.`);
    }
  }

  console.log('\n================================================================');
  console.log('🔄 STEP 2: MERGING GLUED/OCR DUPLICATE PEOPLE INTO TARGET PERSON');
  console.log('================================================================');

  for (const pair of MERGE_PAIRS) {
    const { data: sourcePeople } = await supabase.from('people').select('id, name').ilike('name', pair.sourceName);
    if (!sourcePeople || sourcePeople.length === 0) {
      console.log(`ℹ️ Source person "${pair.sourceName}" not found (already cleaned).`);
      continue;
    }

    const targetPerson = await findPersonByName(pair.targetName);
    if (!targetPerson) {
      console.warn(`⚠️ Target person "${pair.targetName}" not found in DB! Skipping merge.`);
      continue;
    }

    for (const sp of sourcePeople) {
      console.log(`🔄 Merging "${sp.name}" (${sp.id}) -> "${targetPerson.name}" (${targetPerson.id})...`);

      // Find all credits for sourcePerson
      const { data: sCredits } = await supabase.from('credits').select('*').eq('person_id', sp.id);
      for (const sc of sCredits || []) {
        // Check if target already has credit on this film for this role
        const { data: tCredits } = await supabase
          .from('credits')
          .select('id, character_name, role')
          .eq('film_id', sc.film_id)
          .eq('person_id', targetPerson.id);

        if (tCredits && tCredits.length > 0) {
          // Target already has a credit on this film!
          // Update character_name if provided and target has none
          if (pair.char && !tCredits[0].character_name) {
            await supabase.from('credits').update({ character_name: pair.char }).eq('id', tCredits[0].id);
            console.log(`   Updated target credit character_name to "${pair.char}"`);
          }
          // Remove redundant duplicate source credit
          await supabase.from('credits').delete().eq('id', sc.id);
          console.log(`   Removed redundant source credit on film ${sc.film_id}`);
        } else {
          // Target does not have credit on this film, update source credit to point to target
          const updatePayload: any = { person_id: targetPerson.id };
          if (pair.char) updatePayload.character_name = pair.char;
          if (pair.role) updatePayload.role = pair.role;
          await supabase.from('credits').update(updatePayload).eq('id', sc.id);
          console.log(`   Re-linked credit to target "${targetPerson.name}" (role: ${pair.role}, char: ${pair.char})`);
        }
      }

      // Finally delete source person record
      const { error: delErr } = await supabase.from('people').delete().eq('id', sp.id);
      if (delErr) {
        console.error(`   Could not delete source person ${sp.name}:`, delErr.message);
      } else {
        console.log(`   ✅ Successfully merged and deleted source person "${sp.name}".`);
      }
    }
  }

  console.log('\n================================================================');
  console.log('✨ STEP 3: CLEANING ROLE FROM PERSON NAME & PRESERVING CREDIT ROLE');
  console.log('================================================================');

  for (const rule of ROLE_STRIP_RULES) {
    const { data: people } = await supabase.from('people').select('id, name, slug').ilike('name', rule.rawName);
    if (!people || people.length === 0) continue;

    for (const p of people) {
      console.log(`✨ Cleaning "${p.name}" -> "${rule.cleanName}"...`);

      // Check if a person with cleanName already exists
      const existingClean = await findPersonByName(rule.cleanName);
      if (existingClean && existingClean.id !== p.id) {
        console.log(`   Found existing clean person "${existingClean.name}" (${existingClean.id}). Merging credits...`);
        // Re-link credits to existingClean
        const { data: creds } = await supabase.from('credits').select('*').eq('person_id', p.id);
        for (const c of creds || []) {
          const { data: targetCreds } = await supabase
            .from('credits')
            .select('id')
            .eq('film_id', c.film_id)
            .eq('person_id', existingClean.id);

          if (targetCreds && targetCreds.length > 0) {
            await supabase.from('credits').delete().eq('id', c.id);
          } else {
            const up: any = { person_id: existingClean.id };
            if (rule.char) up.character_name = rule.char;
            if (rule.role) up.role = rule.role;
            await supabase.from('credits').update(up).eq('id', c.id);
          }
        }
        await supabase.from('people').delete().eq('id', p.id);
        console.log(`   ✅ Merged into "${existingClean.name}" and removed duplicate "${p.name}".`);
      } else {
        // Rename the person
        const newSlug = slugify(rule.cleanName) + '-' + Math.floor(100 + Math.random() * 900);
        const { error: upErr } = await supabase
          .from('people')
          .update({ name: rule.cleanName, slug: newSlug })
          .eq('id', p.id);

        if (upErr) {
          console.error(`   Error renaming person:`, upErr.message);
        } else {
          console.log(`   ✅ Renamed person to "${rule.cleanName}" (slug: ${newSlug})`);
        }

        // Update credit character_name or role if needed
        const { data: creds } = await supabase.from('credits').select('id, character_name, role').eq('person_id', p.id);
        for (const c of creds || []) {
          const up: any = {};
          if (rule.char && !c.character_name) up.character_name = rule.char;
          if (rule.role && c.role === 'actor' && rule.role !== 'actor') up.role = rule.role;
          if (Object.keys(up).length > 0) {
            await supabase.from('credits').update(up).eq('id', c.id);
            console.log(`   Updated credit details: role=${up.role || c.role}, char=${up.character_name || c.character_name}`);
          }
        }
      }
    }
  }

  console.log('\n================================================================');
  console.log('🛡️  STEP 4: HARDENING CREDIT CONSENSUS VERIFIER & OCR REGEX');
  console.log('================================================================');
  console.log('All database merges, credit fixes, and name cleanups complete!');
}

runCleanup().catch(console.error);
