import dns from 'dns';
try {
  dns.setDefaultResultOrder('ipv4first');
  dns.setServers(['1.1.1.1', '8.8.8.8']);
} catch {}

import { Agent, setGlobalDispatcher } from 'undici';
try {
  setGlobalDispatcher(
    new Agent({
      connect: { timeout: 60_000 },
      headersTimeout: 300_000,
      bodyTimeout: 300_000,
    })
  );
} catch {}

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials!');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false, autoRefreshToken: false }
});

function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-');
}

async function retryOp(fn, retries = 4, delay = 1000) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (attempt === retries) throw err;
      console.warn(`Attempt ${attempt} failed (${err.message}). Retrying in ${delay}ms...`);
      await new Promise(r => setTimeout(r, delay));
      delay *= 1.5;
    }
  }
}

const personCache = new Map();

async function getOrCreatePerson(personData) {
  const cleanName = personData.name.trim();
  if (personCache.has(cleanName)) {
    return personCache.get(cleanName);
  }

  const existing = await retryOp(async () => {
    const { data, error } = await supabase
      .from('people')
      .select('id, name, bio, photo_url, slug')
      .ilike('name', cleanName)
      .limit(1);
    if (error) throw error;
    return data;
  });

  if (existing && existing.length > 0) {
    const person = existing[0];
    console.log(`Found existing person: "${person.name}" (${person.id})`);
    const updatePayload = {};
    if ((!person.bio || person.bio.includes('IMDbPro') || person.bio.length < 20) && personData.bio) {
      updatePayload.bio = personData.bio;
    }
    if (!person.photo_url && personData.photo_url) {
      updatePayload.photo_url = personData.photo_url;
    }
    if (Object.keys(updatePayload).length > 0) {
      await retryOp(async () => {
        const { error: updErr } = await supabase.from('people').update(updatePayload).eq('id', person.id);
        if (updErr) throw updErr;
      });
      console.log(`Enriched person "${person.name}" with photo/bio.`);
    }
    personCache.set(cleanName, person.id);
    return person.id;
  }

  const baseSlug = slugify(cleanName);
  const insertPayload = {
    name: cleanName,
    slug: baseSlug,
    bio: personData.bio || null,
    photo_url: personData.photo_url || null,
    nationality: 'Nigerian'
  };

  const inserted = await retryOp(async () => {
    const { data, error } = await supabase
      .from('people')
      .insert(insertPayload)
      .select('id, name')
      .single();
    if (error) {
      // Check if it already exists
      const { data: fallback } = await supabase.from('people').select('id').ilike('name', cleanName).limit(1);
      if (fallback && fallback[0]) return fallback[0];
      throw error;
    }
    return data;
  });

  console.log(`Created person: "${inserted.name}" (${inserted.id})`);
  personCache.set(cleanName, inserted.id);
  return inserted.id;
}

async function main() {
  console.log('=== RESUMING / COMPLETING BEAUTIFUL FEET MOVIE INGESTION ===\n');

  // Verify Film exists
  const { data: films } = await retryOp(() =>
    supabase.from('films').select('id, title, slug').ilike('title', 'Beautiful Feet').limit(1)
  );

  if (!films || films.length === 0) {
    console.error('Film "Beautiful Feet" not found!');
    return;
  }

  const filmId = films[0].id;
  console.log(`Working with Film: "${films[0].title}" (${filmId})`);

  // Verify CAP Studios Company exists and is linked
  const { data: companies } = await retryOp(() =>
    supabase.from('companies').select('id, name, slug').ilike('name', 'CAP Studios').limit(1)
  );
  if (companies && companies.length > 0) {
    const companyId = companies[0].id;
    console.log(`Verified Company: "${companies[0].name}" (${companyId})`);

    const { data: existingLink } = await retryOp(() =>
      supabase.from('film_companies').select('*').eq('film_id', filmId).eq('company_id', companyId)
    );
    if (!existingLink || existingLink.length === 0) {
      await retryOp(() =>
        supabase.from('film_companies').insert({ film_id: filmId, company_id: companyId, role: 'production' })
      );
      console.log('Linked company in film_companies.');
    } else {
      console.log('Company already linked in film_companies.');
    }
  }

  // Cast and Crew Data
  const castAndCrew = [
    // Crew (Director / Writer / Producer)
    {
      name: 'Chim Onyebilanma',
      role: 'director',
      billing_order: 1,
      bio: 'Chim Onyebilanma is an award-winning filmmaker, director, and producer of TREASURE HUNT, which premiered at the Oscar-qualifying American Black Film Festival in Miami and screened in South African cinemas in 2025. A veteran missionary dedicated to reaching unreached peoples across Africa and beyond, Chim served as a leader with CAPRO for over 30 years. This story is deeply personal, drawing from real-life experiences he and his team have faced over the past three decades.',
      photo_url: 'https://res.cloudinary.com/daxqedwet/image/upload/v1791310121/chim_edited_byhufn.png'
    },
    {
      name: 'Chim Onyebilanma',
      role: 'writer',
      billing_order: 1,
      bio: 'Chim Onyebilanma is an award-winning filmmaker, director, and producer of TREASURE HUNT.',
      photo_url: 'https://res.cloudinary.com/daxqedwet/image/upload/v1791310121/chim_edited_byhufn.png'
    },
    {
      name: 'Chim Onyebilanma',
      role: 'producer',
      billing_order: 1,
      bio: 'Chim Onyebilanma is an award-winning filmmaker, director, and producer of TREASURE HUNT.',
      photo_url: 'https://res.cloudinary.com/daxqedwet/image/upload/v1791310121/chim_edited_byhufn.png'
    },
    // Cast
    {
      name: 'Tuke Morgan',
      role: 'actor',
      character_name: 'Lead Specialist Doctor',
      billing_order: 1,
      bio: 'Actor, Saxophonist, Photographer & Content Creator. Known for Live Music Performances as a Solo Artist or with her Talented Band at Birthday Parties, Weddings, Corporate Events & Social Functions like TEDxGbagada. She stars in web series The Wives (2025) & Visa on Arrival (2025).',
      photo_url: 'https://res.cloudinary.com/daxqedwet/image/upload/v1791419999/WhatsApp_Image_2026-10-07_at_8.31.25_PM_jrbyxd.jpg'
    },
    {
      name: 'Nathaniel Bassey',
      role: 'actor',
      character_name: null,
      billing_order: 2,
      bio: 'Pastor Nathaniel Bassey is the globally celebrated worship leader and gospel singer whose music carries spiritual depth and conviction. Beautiful Feet marks his debut acting in any film.',
      photo_url: 'https://res.cloudinary.com/daxqedwet/image/upload/v1791309650/nathaniel_1_jxmr33.jpg'
    },
    {
      name: 'Kate Adepegba',
      role: 'actor',
      character_name: null,
      billing_order: 3,
      bio: 'Actor and television veteran; known for The Figurine and Slum King.',
      photo_url: 'https://res.cloudinary.com/daxqedwet/image/upload/v1791309827/Kate_adepegba_hrfgrg.jpg'
    },
    {
      name: 'Opadele Joseph',
      role: 'actor',
      character_name: null,
      billing_order: 4,
      bio: 'Actor, filmmaker, drama minister, and theatre practitioner with over two decades of experience in stage performance, teaching, and film production. His notable film and stage credits include Land of Fury, Shackles, Tales of Sharon, and The Plan.',
      photo_url: 'https://res.cloudinary.com/daxqedwet/image/upload/v1791309321/opadelejoseph_vo7qya.jpg'
    },
    {
      name: 'Timmy Adebola',
      role: 'actor',
      character_name: null,
      billing_order: 5,
      bio: 'Actor and creative professional. He is best known for his roles in notable screen productions, including She Builds, ROT and Holy Scamtrimony.',
      photo_url: 'https://res.cloudinary.com/daxqedwet/image/upload/v1791307249/tmmy_adebola_glruul.jpg'
    },
    {
      name: 'Seun Adejumobi',
      role: 'actor',
      character_name: null,
      billing_order: 6,
      bio: 'Actor and filmmaker. Famous for portraying Mike Bamiloye in Mount Zion’s hit The Train, his movie credits also include Abattoir, Exposed, Dark Corner, DNA, Wait, and Indelible.',
      photo_url: 'https://res.cloudinary.com/daxqedwet/image/upload/v1791309424/SEUN-ADEJUMOBI_kwsaoe.jpg'
    },
    {
      name: 'Moromoluwatiketike Abolaji-Adeola',
      role: 'actor',
      character_name: null,
      billing_order: 7,
      bio: 'Actor, voice artist, event compere, and Christian content creator. Known for her engaging digital storytelling and screen performances. Her film credits include: The Corridor, The JAR, 30 Pieces.',
      photo_url: 'https://res.cloudinary.com/daxqedwet/image/upload/v1791308937/MOROMOTIKEITIKE_us8qbv.png'
    },
    {
      name: 'Chidinma Umeh',
      role: 'actor',
      character_name: null,
      billing_order: 8,
      bio: 'Actor, creative performer and journalist. Beyond her screen appearances, she is recognized for her creative talents, storytelling, and contribution to digital and performance art.',
      photo_url: 'https://res.cloudinary.com/daxqedwet/image/upload/v1791309748/CHIDINMA-UMEH_eee5md.jpg'
    }
  ];

  console.log('\n--- Ingesting Cast and Crew & Credits ---');
  for (const personItem of castAndCrew) {
    const personId = await getOrCreatePerson(personItem);

    // Look up existing credit row
    const existingCredits = await retryOp(async () => {
      const { data, error } = await supabase
        .from('credits')
        .select('id, role, character_name, billing_order')
        .eq('film_id', filmId)
        .eq('person_id', personId);
      if (error) throw error;
      return data;
    });

    const matchingCredit = existingCredits?.find(c => c.role === personItem.role);

    if (matchingCredit) {
      await retryOp(async () => {
        const { error } = await supabase
          .from('credits')
          .update({
            character_name: personItem.character_name || matchingCredit.character_name,
            billing_order: personItem.billing_order || matchingCredit.billing_order
          })
          .eq('id', matchingCredit.id);
        if (error) throw error;
      });
      console.log(`Updated credit in-place for "${personItem.name}" [${personItem.role}]`);
    } else {
      await retryOp(async () => {
        const { error } = await supabase
          .from('credits')
          .insert({
            film_id: filmId,
            person_id: personId,
            role: personItem.role,
            character_name: personItem.character_name || null,
            billing_order: personItem.billing_order || null
          });
        if (error) throw error;
      });
      console.log(`Inserted credit for "${personItem.name}" [${personItem.role}]`);
    }
  }

  console.log('\n🎉 ALL DONE! Beautiful Feet movie and all associations successfully created and updated.');
}

main().catch(err => {
  console.error('Fatal error during execution:', err);
  process.exit(1);
});
