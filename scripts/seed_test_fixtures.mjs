import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config();

const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error('Missing Supabase URL or Service Role Key in environment');
  process.exit(1);
}

const supabase = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false }
});

async function seed() {
  console.log('Seeding dummy test fixtures for Studio & Talent testing...\n');

  // 1. Create or update Company: Apex Prime Studios
  console.log('1. Setting up dummy company: Apex Prime Studios (slug: apex-prime-studios-test)...');
  const { data: company, error: compErr } = await supabase
    .from('companies')
    .upsert(
      {
        slug: 'apex-prime-studios-test',
        name: 'Apex Prime Studios',
        company_type: 'Production & Talent Management',
        description: 'Leading independent Nollywood production company, finance house, and talent management agency based in Lagos.',
        headquarters: 'Lekki Phase 1, Lagos, Nigeria',
        website: 'https://apexprime.test',
        contact_email: 'contact@apexprimestudios.test',
        contact_phone: '+234 1 234 5678',
        instagram_url: 'https://instagram.com/apexprimestudios',
        twitter_url: 'https://x.com/apexprimestudios',
        founded_year: 2021,
        claimed: true,
        verified: true,
        verified_via: 'instagram_dm',
        verification_code: 'MUV-CO-APEX'
      },
      { onConflict: 'slug' }
    )
    .select()
    .single();

  if (compErr) {
    console.error('Failed to upsert company:', compErr.message);
    process.exit(1);
  }
  console.log(`   Company ready: ${company.name} (ID: ${company.id})`);

  // 2. Create dummy Films: Lagos Heatwave & The Gold Coast Heist
  console.log('\n2. Setting up dummy films...');
  const { data: film1, error: f1Err } = await supabase
    .from('films')
    .upsert(
      {
        slug: 'lagos-heatwave-test',
        title: 'Lagos Heatwave',
        year: 2025,
        synopsis: 'An undercover detective races against the clock to expose a syndicate executing a multi-billion naira heist during Lagos Fashion Week.',
        release_type: 'cinema',
        is_in_cinemas: true,
        box_office_domestic: 185000000,
        box_office_currency: 'NGN',
        box_office_source: 'CEAN',
        runtime_minutes: 115,
        status: 'released',
        is_published: true
      },
      { onConflict: 'slug' }
    )
    .select()
    .single();

  if (f1Err) {
    console.error('Failed to upsert film1:', f1Err.message);
    process.exit(1);
  }

  const { data: film2, error: f2Err } = await supabase
    .from('films')
    .upsert(
      {
        slug: 'gold-coast-heist-test',
        title: 'The Gold Coast Heist',
        year: 2024,
        synopsis: 'A crew of retired safe-crackers is forced to pull off an impossible job between Accra and Lagos.',
        release_type: 'netflix',
        runtime_minutes: 108,
        status: 'released',
        is_published: true
      },
      { onConflict: 'slug' }
    )
    .select()
    .single();

  if (f2Err) {
    console.error('Failed to upsert film2:', f2Err.message);
    process.exit(1);
  }
  console.log(`   Films ready: "${film1.title}" (ID: ${film1.id}) and "${film2.title}" (ID: ${film2.id})`);

  // Link Films to Company in film_companies
  await supabase.from('film_companies').upsert([
    { film_id: film1.id, company_id: company.id, role: 'Production Company' },
    { film_id: film2.id, company_id: company.id, role: 'Production Company' }
  ], { onConflict: 'film_id,company_id,role' });
  console.log('   Linked films to Apex Prime Studios in film_companies.');

  // 3. Create dummy Talents
  console.log('\n3. Setting up dummy talents...');
  
  // Talent 1: Korede Vance (Talent Pro)
  const { data: korede, error: kErr } = await supabase
    .from('people')
    .upsert(
      {
        slug: 'korede-vance-test',
        name: 'Korede Vance',
        known_for_department: 'Acting',
        bio: 'Award-winning leading Nollywood screen and stage actor acclaimed for intense dramatic and high-octane thriller performances.',
        nationality: 'Nigerian',
        is_pro: true,
        pro_plan: 'talent_pro',
        availability_status: 'available',
        availability_note: 'Open for lead theatrical & high-end series roles Q4 2026',
        booking_email: 'bookings@koredevance.com',
        booking_phone: '+2348012345678',
        booking_whatsapp: '+2348012345678',
        instagram_url: 'https://instagram.com/koredevance',
        twitter_url: 'https://x.com/koredevance',
        is_verified: true
      },
      { onConflict: 'slug' }
    )
    .select()
    .single();

  if (kErr) {
    console.error('Failed to upsert Korede Vance:', kErr.message);
    process.exit(1);
  }

  // Talent 2: Amara Okon (In production)
  const { data: amara, error: aErr } = await supabase
    .from('people')
    .upsert(
      {
        slug: 'amara-okon-test',
        name: 'Amara Okon',
        known_for_department: 'Acting',
        bio: 'Dynamic method actress with leading roles in box office hits and acclaimed streaming originals.',
        nationality: 'Nigerian',
        is_pro: false,
        availability_status: 'on_project',
        booking_email: 'agency@apexprimestudios.test',
        booking_phone: '+2348099887766'
      },
      { onConflict: 'slug' }
    )
    .select()
    .single();

  if (aErr) {
    console.error('Failed to upsert Amara Okon:', aErr.message);
    process.exit(1);
  }

  // Talent 3: Tunde Balogun (Wrapping soon)
  const { data: tunde, error: tErr } = await supabase
    .from('people')
    .upsert(
      {
        slug: 'tunde-balogun-test',
        name: 'Tunde Balogun',
        known_for_department: 'Directing',
        bio: 'Visionary commercial and feature film director known for sharp visual storytelling and bold sound design.',
        nationality: 'Nigerian',
        is_pro: false,
        availability_status: 'wrapping_soon',
        booking_email: 'agency@apexprimestudios.test'
      },
      { onConflict: 'slug' }
    )
    .select()
    .single();

  if (tErr) {
    console.error('Failed to upsert Tunde Balogun:', tErr.message);
    process.exit(1);
  }

  // Talent 4: Ngozi Adeleke (Unlinked - ready for testing adding 4th talent to trigger paywall!)
  const { data: ngozi, error: nErr } = await supabase
    .from('people')
    .upsert(
      {
        slug: 'ngozi-adeleke-test',
        name: 'Ngozi Adeleke',
        known_for_department: 'Acting',
        bio: 'Rising talent specializing in romance and psychological thrillers.',
        nationality: 'Nigerian',
        is_pro: false,
        availability_status: 'available'
      },
      { onConflict: 'slug' }
    )
    .select()
    .single();

  if (nErr) {
    console.error('Failed to upsert Ngozi Adeleke:', nErr.message);
    process.exit(1);
  }

  console.log(`   Talents created:
   - Korede Vance (Pro: true, Available, Direct Booking) (ID: ${korede.id})
   - Amara Okon (In Production) (ID: ${amara.id})
   - Tunde Balogun (Wrapping Soon) (ID: ${tunde.id})
   - Ngozi Adeleke (Standby for 4th talent paywall test) (ID: ${ngozi.id})`);

  // 4. Link Talents 1, 2, 3 to Apex Prime Studios in talent_representations (free quota: 3/3 used)
  console.log('\n4. Linking 3 talents to Apex Prime Studios roster...');
  
  // Clean existing reps for test to avoid duplicate rows
  await supabase
    .from('talent_representations')
    .delete()
    .eq('company_id', company.id);

  const { error: repErr } = await supabase
    .from('talent_representations')
    .insert([
      {
        company_id: company.id,
        person_id: korede.id,
        representation_type: 'Theatrical & Commercial',
        agent_name: 'Bimbo Thomas',
        contact_email: 'bimbo@apexprimestudios.test',
        contact_phone: '+234 1 234 5678',
        is_primary: true
      },
      {
        company_id: company.id,
        person_id: amara.id,
        representation_type: 'Exclusive Management',
        agent_name: 'Bimbo Thomas',
        contact_email: 'bimbo@apexprimestudios.test',
        is_primary: true
      },
      {
        company_id: company.id,
        person_id: tunde.id,
        representation_type: 'Directorial Representation',
        agent_name: 'Femi Coker',
        contact_email: 'femi@apexprimestudios.test',
        is_primary: true
      }
    ]);

  if (repErr) {
    console.error('Failed to link talent representations:', repErr.message);
  } else {
    console.log('   Successfully linked 3 talents (Korede, Amara, Tunde) to Apex Prime Studios roster.');
  }

  // 5. Add Credits for Korede Vance and Amara Okon in Lagos Heatwave
  console.log('\n5. Setting up credits in Lagos Heatwave...');
  await supabase
    .from('credits')
    .delete()
    .eq('film_id', film1.id);

  await supabase
    .from('credits')
    .insert([
      {
        film_id: film1.id,
        person_id: korede.id,
        role: 'actor',
        character_name: 'Inspector Daniel',
        billing_order: 1
      },
      {
        film_id: film1.id,
        person_id: amara.id,
        role: 'actor',
        character_name: 'Zainab Cole',
        billing_order: 2
      }
    ]);
  console.log('   Credits linked.');

  console.log('\n======================================================');
  console.log(' DUMMY TEST FIXTURES READY FOR TESTING!');
  console.log('======================================================');
  console.log('1. Company Page:');
  console.log('   http://localhost:3001/companies/apex-prime-studios-test');
  console.log('2. Actor Detail (Talent Pro + Direct Booking Modal):');
  console.log('   http://localhost:3001/people/korede-vance-test');
  console.log('3. Company Claim Flow:');
  console.log('   http://localhost:3001/claim/company?company=apex-prime-studios-test');
  console.log('4. Studio Dashboard:');
  console.log('   http://localhost:3001/company/dashboard');
  console.log('   (Roster currently has 3/3 free seats. Adding 4th triggers OPay Studio Pro upgrade)');
  console.log('======================================================\n');
}

seed().catch(err => {
  console.error('Seed script error:', err);
  process.exit(1);
});
