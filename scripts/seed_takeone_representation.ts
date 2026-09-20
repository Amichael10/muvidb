import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { Agent, setGlobalDispatcher } from 'undici';

setGlobalDispatcher(new Agent({
  connect: { timeout: 60000 },
  headersTimeout: 60000,
  bodyTimeout: 60000,
}));

dotenv.config({ path: '.env.local' });
dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: { persistSession: false },
    global: {
      fetch: (url, options) => fetch(url, { ...options, signal: AbortSignal.timeout(60000) }),
    },
  }
);

async function main() {
  console.log('🚀 Step 1: Checking talent_representations table...');
  const { data: testCheck, error: checkErr } = await supabase.from('talent_representations').select('id').limit(1);
  if (checkErr) {
    console.error('❌ Table talent_representations not available yet:', checkErr.message);
    return;
  }
  console.log('✅ Table talent_representations is ready.');

  // Step 2: Update Take One Company profile
  const takeoneId = '0b3e1d81-3220-41ec-ab4c-d58ecef83226';
  console.log('\n🏢 Step 2: Updating Take One Company Details in companies table...');
  const { error: compErr } = await supabase
    .from('companies')
    .update({
      name: 'Take One Concept',
      company_type: 'talent_agency',
      website: 'https://takeoneconcept.com/',
      headquarters: '59 Nuru Oniwo Street, Aguda, Surulere, Lagos, Nigeria',
      instagram_url: 'https://www.instagram.com/takeone.talent',
      description: 'Take One is a creative ecosystem designed to discover, develop, and position exceptional African talent while producing stories that resonate deeply with audiences and culture. Operating across talent management, film production, and actor development.',
    })
    .eq('id', takeoneId);

  if (compErr) {
    console.error('Error updating Take One company:', compErr.message);
  } else {
    console.log('✅ Take One company profile updated with official contact details and agency type.');
  }

  // Step 3: Ensure all 8 talents exist
  console.log('\n🎭 Step 3: Verifying & Creating Represented Talents in people table...');
  const talents = [
    { name: 'Imotunde Adeyemo', slug: 'imotunde-adeyemo' },
    { name: 'Favour Etim', slug: 'favour-etim' },
    { name: 'Patrick Diabuah', slug: 'patrick-diabuah' },
    { name: 'Princess Obuseh', slug: 'princess-obuseh' },
    { name: 'Toluwani George', slug: 'toluwani-george' },
    { name: 'Seun Ajayi', slug: 'seun-ajayi' },
    { name: 'Uche Chika Elumelu', slug: 'uche-chika-elumelu' },
    {
      name: 'Tosan Ugbeye',
      slug: 'tosan-ugbeye',
      bio: 'Tosan Edremoda-Ugbeye is a Nigerian actress known for her work in film and television, including Flower Girl, Isoken, and MTV Shuga. Represented by Take One Talents.',
      photo_url: 'https://takeoneconcept.com/img/talents/1775604774_IMG_9808.jpeg',
      gender: 'female',
      known_for_department: 'Acting',
    }
  ];

  const resolvedTalents: Array<{ id: string; name: string }> = [];

  for (const t of talents) {
    const { data: existing } = await supabase
      .from('people')
      .select('id, name')
      .ilike('name', t.name)
      .limit(1);

    if (existing && existing.length > 0) {
      resolvedTalents.push({ id: existing[0].id, name: existing[0].name });
      console.log(`✅ Found actor in DB: "${existing[0].name}" (${existing[0].id})`);
    } else {
      // Create missing talent (e.g. Tosan Ugbeye)
      const { data: created, error: cErr } = await supabase
        .from('people')
        .insert({
          name: t.name,
          slug: t.slug,
          bio: t.bio,
          photo_url: t.photo_url,
          gender: t.gender,
          known_for_department: t.known_for_department || 'Acting',
          nationality: 'Nigerian',
        })
        .select('id, name')
        .single();

      if (cErr) {
        console.error(`Error creating actor ${t.name}:`, cErr.message);
      } else {
        resolvedTalents.push({ id: created.id, name: created.name });
        console.log(`✨ Created actor in DB: "${created.name}" (${created.id})`);
      }
    }
  }

  // Step 4: Seed talent_representations
  console.log('\n🔗 Step 4: Linking Talents to Take One Concept Representation...');
  for (const talent of resolvedTalents) {
    const payload = {
      person_id: talent.id,
      company_id: takeoneId,
      representation_type: 'Talent Management',
      agent_name: 'Take One Talents',
      contact_email: 'enquiries@takeone.ng',
      contact_phone: '+234-907-618-3040',
      booking_url: 'https://takeoneconcept.com/contact.php',
      is_primary: true,
      notes: 'Official represented talent roster at Take One Concept.',
    };

    let linked = false;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const { error: linkErr } = await supabase
          .from('talent_representations')
          .upsert(payload, { onConflict: 'person_id,company_id,representation_type' });

        if (linkErr) {
          console.error(`Error linking ${talent.name} (attempt ${attempt}):`, linkErr.message);
        } else {
          console.log(`✅ Linked representation: "${talent.name}" -> Take One Concept`);
          linked = true;
          break;
        }
      } catch (e: any) {
        console.warn(`Retry ${attempt}/3 for ${talent.name}:`, e.message);
        await new Promise(r => setTimeout(r, 2000));
      }
    }
    if (!linked) {
      console.error(`❌ Failed to link ${talent.name} after 3 attempts`);
    }
  }

  console.log('\n🎉 Representation seeding complete!');
}

main().catch(console.error);
