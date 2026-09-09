import dotenv from 'dotenv';
dotenv.config();
import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'https://pkenrmorywmuvnzfoylp.supabase.co';
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY!;

const supabase = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false }
});

const FAITHIA_ID = 'c912ad43-c7f3-493a-86f7-a30290c0ae93'; // Faithia Balogun / Williams

async function findOrCreatePerson(name: string) {
  const cleanName = name.trim();
  if (!cleanName || cleanName.length < 2) return null;

  const { data: existing } = await supabase
    .from('people')
    .select('id, name')
    .ilike('name', cleanName)
    .limit(1);

  if (existing && existing.length > 0) {
    return existing[0];
  }

  const { data: created, error } = await supabase
    .from('people')
    .insert({
      name: cleanName,
      slug: cleanName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''),
      known_for_department: 'Acting',
    })
    .select('id, name')
    .single();

  if (error) {
    console.error(`Error creating person ${cleanName}:`, error.message);
    return null;
  }
  return created;
}

const FILM_CREDITS_DATA: Record<string, { producer?: string[]; actors: string[]; director?: string }> = {
  'ABEBI OLOUNJE': {
    producer: ['Faithia Williams'],
    actors: ['Faithia Williams', 'Bolanle Ninalowo', 'Ayo Olaiya'],
  },
  'ANU OMO': {
    producer: ['Faithia Williams'],
    actors: ['Faithia Williams', 'Eniola Ajao', 'Habeeb Alagbe', 'Nike Hamzat'],
  },
  'THE MARKET PLACE (AJE OJA)': {
    producer: ['Faithia Williams'],
    actors: ['Faithia Williams', 'Sola Sobowale', 'Lateef Adedimeji', 'Odunlade Adekola', 'Femi Adebayo'],
  },
  'AJE OJA (The Market Place) PART 2': {
    producer: ['Faithia Williams'],
    actors: ['Faithia Williams', 'Sola Sobowale', 'Lateef Adedimeji', 'Odunlade Adekola', 'Femi Adebayo'],
  },
  'MORIRE': {
    producer: ['Faithia Williams'],
    actors: ['Faithia Williams', 'Akin Olaiya', 'Bose Joseph', 'Juliet Jato', 'Sola Gaji'],
  },
  'OPEN MARRAGE': {
    producer: ['Faithia Williams'],
    actors: ['Faithia Williams', 'Ayo Olaiya', 'Wunmi Ajiboye'],
  },
  'BEYOND TRUST': {
    producer: ['Faithia Williams'],
    actors: ['Faithia Williams', 'Chioma Akpotha', 'Seun Akindele'],
  },
  'INTRUDER': {
    producer: ['Faithia Williams'],
    actors: ['Faithia Williams', 'Ejiro Okurame', 'Kelechi Udeagbe'],
  },
  'ORE OJOKAN': {
    producer: ['Faithia Williams'],
    actors: ['Faithia Williams', 'Bolanle Ninalowo'],
  },
  'ARA MI': {
    producer: ['Faithia Williams'],
    actors: ['Faithia Williams', 'Ibrahim Chatta', 'Eniola Ajao'],
  },
  'ASEGUN': {
    producer: ['Faithia Williams'],
    actors: ['Faithia Williams', 'Odunlade Adekola', 'Femi Adebayo'],
  },
};

async function main() {
  console.log('=== POPULATING CREDITS FOR FB NOLLY TV FILMS WITH SERVICE ROLE ===');

  // Fetch all films belonging to FB NOLLY TV
  const { data: cvs } = await supabase
    .from('channel_videos')
    .select('video_id, film_id, title')
    .eq('channel_id', '003f3344-74bc-403f-8759-9c612dedc957')
    .not('film_id', 'is', null);

  console.log(`Found ${cvs?.length || 0} linked film entries in channel_videos.`);

  let totalCreditsInserted = 0;

  for (const cv of cvs || []) {
    const filmId = cv.film_id;
    const { data: film } = await supabase.from('films').select('id, title').eq('id', filmId).single();
    if (!film) continue;

    console.log(`\n🎬 Processing credits for "${film.title}" (${filmId})...`);

    // Match film against data config
    let configKey = Object.keys(FILM_CREDITS_DATA).find(k => film.title.toUpperCase().includes(k.toUpperCase()) || cv.title.toUpperCase().includes(k.toUpperCase()));
    const config = configKey ? FILM_CREDITS_DATA[configKey] : { producer: ['Faithia Williams'], actors: ['Faithia Williams'] };

    // Clean existing credits for this film to ensure fresh clean state
    await supabase.from('credits').delete().eq('film_id', filmId);

    // 1. Add Producer credits
    const producers = config.producer || ['Faithia Williams'];
    for (const pName of producers) {
      const person = pName.includes('Faithia') ? { id: FAITHIA_ID, name: 'Faithia Balogun' } : await findOrCreatePerson(pName);
      if (person) {
        const { error: pErr } = await supabase.from('credits').insert({
          film_id: filmId,
          person_id: person.id,
          role: 'producer',
          billing_order: 1,
          source: 'youtube_fbnolly_sync',
        });
        if (pErr) console.error('  -> Producer credit error:', pErr);
        else {
          totalCreditsInserted++;
          console.log(`  + [producer] ${person.name}`);
        }
      }
    }

    // 2. Add Cast / Actor credits
    let order = 1;
    for (const aName of config.actors) {
      const person = aName.includes('Faithia') ? { id: FAITHIA_ID, name: 'Faithia Balogun' } : await findOrCreatePerson(aName);
      if (person) {
        const { error: aErr } = await supabase.from('credits').insert({
          film_id: filmId,
          person_id: person.id,
          role: 'actor',
          billing_order: order++,
          source: 'youtube_fbnolly_sync',
        });
        if (aErr) console.error('  -> Actor credit error:', aErr);
        else {
          totalCreditsInserted++;
          console.log(`  + [actor] ${person.name} (order: ${order - 1})`);
        }
      }
    }
  }

  console.log(`\n🎉 Total credits successfully populated: ${totalCreditsInserted}`);
}

main().catch(console.error);
