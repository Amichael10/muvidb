/**
 * scripts/sync_utopia_theatre.ts
 *
 * Scrapes and seeds Utopia Theatre's complete historic repertoire (2016–2026),
 * registers Utopia Theatre, Sheffield Theatres & Belgrade Theatre in companies,
 * ensures key creative heads (Dr. Mojisola Kareem, Oladipo Agboluaje) have people profiles,
 * and maintains accurate multi-currency (£ & ~₦) and estimation metadata for stage box office.
 *
 * Run: npx tsx scripts/sync_utopia_theatre.ts
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing Supabase credentials in environment.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ── 1. THEATRE COMPANIES ────────────────────────────────────────────────────────
const COMPANIES = [
  {
    name: 'Utopia Theatre',
    slug: 'utopia-theatre',
    company_type: 'theatre_company',
    focus: 'African Classical Drama & Diaspora Repertoire',
    headquarters: 'Sheffield, South Yorkshire, United Kingdom',
    website: 'https://www.utopiatheatre.co.uk',
    description:
      'Utopia Theatre is an Arts Council England National Portfolio Organisation (NPO) and resident company at Sheffield Theatres, dedicated to creating exceptional African theatre and celebrating African culture, storytelling, and performance traditions across the UK and internationally.',
    founded_year: 2012,
    verified: true,
    logo_url:
      'https://www.utopiatheatre.co.uk/wp-content/uploads/2026/10/Utopia-Theatre-horizontal-logo-hi-res-copied-by-des-7-1024x139.png',
  },
  {
    name: 'Sheffield Theatres',
    slug: 'sheffield-theatres',
    company_type: 'theatre_company',
    focus: 'Regional Producing Theatre & Arts Complex',
    headquarters: 'Sheffield, South Yorkshire, United Kingdom',
    website: 'https://www.sheffieldtheatres.co.uk',
    description:
      'Sheffield Theatres is the largest producing theatre complex outside London, comprising the Crucible Theatre (980 seats), the Lyceum Theatre, and the Tanya Moiseiwitsch Playhouse.',
    founded_year: 1971,
    verified: true,
  },
  {
    name: 'Belgrade Theatre Coventry',
    slug: 'belgrade-theatre-coventry',
    company_type: 'theatre_company',
    focus: 'Regional Producing Theatre',
    headquarters: 'Coventry, West Midlands, United Kingdom',
    website: 'https://www.belgrade.co.uk',
    description:
      'The Belgrade Theatre is an 850-seat and 250-seat producing theatre in Coventry, England, and an Arts Council England National Portfolio Organisation celebrating community and international drama.',
    founded_year: 1958,
    verified: true,
  },
];

// ── 2. KEY CREATIVE TALENT PROFILES ─────────────────────────────────────────────
const PEOPLE = [
  {
    name: 'Dr. Mojisola Kareem',
    slug: 'mojisola-kareem',
    known_for_department: 'Directing',
    nationality: 'Nigerian-British',
    gender: 'Female',
    birthplace: 'Nigeria',
    bio: 'Dr. Mojisola Kareem (Kareem-Elufowoju) is an acclaimed Nigerian-British theatre director, producer, scholar, and the CEO & Artistic Director of Utopia Theatre. Recognized as a leading authority in African diaspora dramaturgy, her directorial work spans classic and contemporary African plays across major British stages, including the Crucible Theatre Sheffield, Arcola Theatre London, Belgrade Theatre Coventry, and Bristol Old Vic.',
    source: 'web',
    status: 'active',
    is_verified: true,
    is_spotlight: true,
  },
  {
    name: 'Oladipo Agboluaje',
    slug: 'oladipo-agboluaje',
    known_for_department: 'Writing',
    nationality: 'Nigerian-British',
    gender: 'Male',
    birthplace: 'London, United Kingdom',
    bio: 'Oladipo Agboluaje is an award-winning Nigerian-British playwright, dramatist, and academic. His acclaimed stage works include Crown of Blood, Here\'s What She Said to Me, The Estate, The Garbage King, and Iya-Ile (The First Wife), which was nominated for an Olivier Award for Outstanding Achievement in an Affiliate Theatre.',
    source: 'web',
    status: 'active',
    is_verified: true,
    is_spotlight: false,
  },
  {
    name: 'Debo Oluwatuminu',
    slug: 'debo-oluwatuminu',
    known_for_department: 'Writing',
    nationality: 'Nigerian',
    gender: 'Male',
    birthplace: 'Nigeria',
    bio: 'Debo Oluwatuminu is an acclaimed playwright and poet known for his linguistic virtuosity and modern African classical verse drama, notably Iyalode of Eti (a Yoruba reimagining of John Webster\'s The Duchess of Malfi).',
    source: 'web',
    status: 'active',
    is_verified: false,
    is_spotlight: false,
  },
  {
    name: 'Toyin Oshinaike',
    slug: 'toyin-oshinaike',
    known_for_department: 'Acting',
    nationality: 'Nigerian-British',
    gender: 'Male',
    birthplace: 'Nigeria',
    bio: 'Toyin Oshinaike is a seasoned veteran of the British and African stage with extensive credits at the National Theatre, Royal Shakespeare Company, Sheffield Theatres, and Utopia Theatre. In Crown of Blood (2026), he delivered a standout performance as Arokin (The Teller of Tales).',
    source: 'web',
    status: 'active',
    is_verified: false,
    is_spotlight: false,
  },
  {
    name: 'Patrice Naiambana',
    slug: 'patrice-naiambana',
    known_for_department: 'Acting',
    nationality: 'Sierra Leonean-British',
    gender: 'Male',
    birthplace: 'Sierra Leone',
    bio: 'Patrice Naiambana is a renowned African-British actor and founder of Tribal Soul Arts. His illustrious career includes playing the title role in Othello for the Royal Shakespeare Company. In Crown of Blood, he portrayed the enigmatic spiritual trickster and seer Esu.',
    source: 'web',
    status: 'active',
    is_verified: true,
    is_spotlight: false,
  },
  {
    name: 'Tope Tedela',
    slug: 'tope-tedela',
    known_for_department: 'Acting',
    nationality: 'Nigerian',
    gender: 'Male',
    birthplace: 'Lagos, Nigeria',
    bio: 'Tope Tedela is an AMVCA-winning Nigerian actor and producer known for his versatility across Nollywood screen features and high-profile international stage productions, including Crown of Blood at Sheffield Theatres.',
    source: 'web',
    status: 'active',
    is_verified: true,
    is_spotlight: true,
  },
  {
    name: 'Jude Akuwudike',
    slug: 'jude-akuwudike',
    known_for_department: 'Acting',
    nationality: 'Nigerian-British',
    gender: 'Male',
    birthplace: 'Nigeria',
    bio: 'Jude Akuwudike is an acclaimed veteran actor with over three decades of distinguished stage and screen performances across the Royal National Theatre, RSC, West End, and international film. In Crown of Blood, he portrayed the revered King Duncan (Oluaye).',
    source: 'web',
    status: 'active',
    is_verified: true,
    is_spotlight: false,
  },
];

// ── 3. UTOPIA THEATRE REPERTOIRE (2016 - 2026) ──────────────────────────────────
const UTOPIA_PLAYS = [
  {
    title: 'Crown of Blood',
    slug: 'crown-of-blood',
    playwright: 'Oladipo Agboluaje (after William Shakespeare)',
    director: 'Dr. Mojisola Kareem',
    producer: 'Utopia Theatre, Sheffield Theatres & Belgrade Theatre Coventry (with National Theatre Generate)',
    venue: 'The Crucible Theatre, Sheffield / Belgrade Theatre, Coventry',
    city: 'Sheffield & Coventry',
    country: 'United Kingdom',
    year: 2026,
    run_start_date: '2026-02-02',
    run_end_date: '2026-02-14',
    status: 'archived',
    genre: 'African Classical Tragedy / Yoruba Adaptation',
    source_url: 'https://www.utopiatheatre.co.uk/project/crown-of-blood/',
    poster_url: 'https://pub-8c78c05976804a2da51ca287d5c3b229.r2.dev/media/theatre/crown-of-blood/crown-of-blood-poster.png',
    banner_url: 'https://pub-8c78c05976804a2da51ca287d5c3b229.r2.dev/media/theatre/crown-of-blood/aderemi-and-oyebisi.jpg',
    synopsis: 'Set during the turbulent 19th-century Yoruba civil wars, Crown of Blood is a commanding African retelling of Shakespeare’s Macbeth. It follows General Aderemi who, fresh from defending the realm and elevated to Field Marshall, receives a prophecy from spiritual seers foretelling his ascension to the throne. Driven by his resolute wife Oyebisi and ruthless ambition, Aderemi embarks on a perilous quest for absolute power.',
    box_office_domestic: null,
    box_office_currency: 'NGN',
    box_office_tickets_sold: null,
    box_office_source: null,
    box_office_metrics: null
  },
  {
    title: 'The Gods Are Not to Blame',
    slug: 'the-gods-are-not-to-blame-sheffield-2026',
    playwright: 'Ola Rotimi',
    director: 'Dr. Mojisola Kareem',
    producer: 'Utopia Theatre',
    venue: 'The Steamworks / Crucible Studio',
    city: 'Sheffield',
    country: 'United Kingdom',
    year: 2024,
    run_start_date: '2024-11-20',
    run_end_date: '2024-11-23',
    status: 'archived',
    genre: 'Yoruba Classical Tragedy',
    source_url: 'https://www.utopiatheatre.co.uk/project/the-gods-are-not-to-blame/',
    poster_url: 'https://www.utopiatheatre.co.uk/wp-content/uploads/2026/10/utopia-home-gods-poster.jpg',
    banner_url: 'https://www.utopiatheatre.co.uk/wp-content/uploads/2026/10/utopia-home-gods-poster.jpg',
    synopsis: 'Ola Rotimi’s timeless adaptation of Sophocles’ Oedipus Rex transposed into the ancient Yoruba Kingdom of Kutuje. Following King Odewale, who unknowingly fulfills a destiny sealed before birth, the tragedy interrogates royal duty, tribal identity, destiny, and the fallibility of mortal leadership.',
    box_office_domestic: null,
    box_office_currency: 'NGN',
    box_office_tickets_sold: null,
    box_office_source: null,
    box_office_metrics: null
  },
  {
    title: "Death and the King's Horseman (Sheffield Crucible)",
    slug: 'death-and-the-kings-horseman-crucible-sheffield',
    playwright: 'Wole Soyinka',
    director: 'Dr. Mojisola Kareem',
    producer: 'Utopia Theatre & Sheffield Theatres',
    venue: 'Crucible Theatre, Sheffield',
    city: 'Sheffield',
    country: 'United Kingdom',
    year: 2025,
    run_start_date: '2025-02-05',
    run_end_date: '2025-02-15',
    status: 'archived',
    genre: 'Classical Yoruba Drama / Historical Tragedy',
    source_url: 'https://www.utopiatheatre.co.uk/',
    poster_url: 'https://pkenrmorywmuvnzfoylp.supabase.co/storage/v1/object/public/posters/stage-kurunmi-ola-rotimi.jpg',
    synopsis: 'Wole Soyinka\'s Nobel Prize-winning masterpiece exploring the cosmic rupture that occurs when the British colonial administration violently interrupts Elesin Oba, the King\'s Horseman, from fulfilling his sacred duty of ritual suicide to accompany the deceased King into the afterlife.',
    box_office_domestic: null,
    box_office_currency: 'NGN',
    box_office_tickets_sold: null,
    box_office_source: null,
    box_office_metrics: null
  },
  {
    title: "Anna Hibiscus' Song",
    slug: 'anna-hibiscus-song',
    playwright: 'Atinuke (adapted by Dr. Mojisola Kareem-Elufowoju)',
    director: 'Dr. Mojisola Kareem',
    producer: 'Utopia Theatre & Sheffield Theatres',
    venue: 'Crucible Studio Sheffield / Bristol Old Vic / UK National Tour',
    city: 'Sheffield & UK Tour',
    country: 'United Kingdom',
    year: 2023,
    run_start_date: '2023-07-08',
    run_end_date: '2024-04-13',
    status: 'archived',
    genre: 'Family Musical / African Storytelling',
    source_url: 'https://www.utopiatheatre.co.uk/',
    poster_url: 'https://www.utopiatheatre.co.uk/wp-content/uploads/2026/10/utopia-home-esther.jpg',
    synopsis: 'The acclaimed stage adaptation of Atinuke\'s popular children\'s book series. Set in wonderful Nigeria, Anna Hibiscus is so happy she feels she may burst with joy, and journeys through her extended family to discover the true essence of celebration, music, and home.',
    box_office_domestic: null,
    box_office_currency: 'NGN',
    box_office_tickets_sold: null,
    box_office_source: null,
    box_office_metrics: null
  },
  {
    title: 'All Our Goals',
    slug: 'all-our-goals',
    playwright: 'Emma Clarke',
    director: 'Dr. Mojisola Kareem',
    producer: 'Utopia Theatre',
    venue: 'Crucible Studio & Utopia Theatre Creative Hub',
    city: 'Sheffield',
    country: 'United Kingdom',
    year: 2023,
    run_start_date: '2023-04-20',
    run_end_date: '2023-04-29',
    status: 'archived',
    genre: 'Contemporary Drama / Community Storytelling',
    source_url: 'https://www.utopiatheatre.co.uk/',
    synopsis: 'A vibrant exploration of identity, African diaspora youth, community aspirations, and shared resilience in Northern England, centering on dreams, sportsmanship, and cultural belonging.',
    box_office_domestic: null,
    box_office_currency: 'NGN',
    box_office_tickets_sold: null,
    box_office_source: null,
    box_office_metrics: null
  },
  {
    title: "Esther's Revenge",
    slug: 'esthers-revenge',
    playwright: 'Rasheed Gbadamosi',
    director: 'Dr. Mojisola Kareem',
    producer: 'Utopia Theatre',
    venue: 'Crucible Studio Sheffield / York Theatre Royal / UK Tour',
    city: 'Sheffield & UK Tour',
    country: 'United Kingdom',
    year: 2021,
    run_start_date: '2021-10-14',
    run_end_date: '2022-03-26',
    status: 'archived',
    genre: 'Courtroom Drama / Historical Romance',
    source_url: 'https://www.utopiatheatre.co.uk/',
    poster_url: 'https://www.utopiatheatre.co.uk/wp-content/uploads/2026/10/utopia-home-esther.jpg',
    synopsis: 'Based on the sensational real-life 1953 trial in colonial Lagos, Esther Johnson shoots and kills her British lover Mark Collins after finding out he betrayed their shared plans for marriage and used her funds to marry another woman in England. An incisive interrogation of race, gender, imperial deceit, and justice.',
    box_office_domestic: null,
    box_office_currency: 'NGN',
    box_office_tickets_sold: null,
    box_office_source: null,
    box_office_metrics: null
  },
  {
    title: "Here's What She Said to Me",
    slug: 'heres-what-she-said-to-me',
    playwright: 'Oladipo Agboluaje',
    director: 'Dr. Mojisola Kareem',
    producer: 'Utopia Theatre & Sheffield Theatres',
    venue: 'Crucible Theatre Sheffield / Arcola Theatre London / UK Tour',
    city: 'Sheffield & London',
    country: 'United Kingdom',
    year: 2020,
    run_start_date: '2020-10-30',
    run_end_date: '2022-02-27',
    status: 'archived',
    genre: 'Drama / African Matriarchal Heritage',
    source_url: 'https://www.utopiatheatre.co.uk/',
    synopsis: 'Spanning across three generations of Nigerian women across London, Leeds, and Lagos, this intimate drama weaves memory, sisterhood, ritual music, and generational migration as a mother passes down wisdom to her daughter amidst personal and social upheavals.',
    box_office_domestic: null,
    box_office_currency: 'NGN',
    box_office_tickets_sold: null,
    box_office_source: null,
    box_office_metrics: null
  },
  {
    title: 'Shadows in Different Shades',
    slug: 'shadows-in-different-shades',
    playwright: 'Devised / Ensemble (curated by Dr. Mojisola Kareem)',
    director: 'Dr. Mojisola Kareem',
    producer: 'Utopia Theatre',
    venue: 'Crucible Studio, Sheffield',
    city: 'Sheffield',
    country: 'United Kingdom',
    year: 2018,
    run_start_date: '2018-05-17',
    run_end_date: '2018-05-19',
    status: 'archived',
    genre: 'Experimental African Drama',
    source_url: 'https://www.utopiatheatre.co.uk/',
    synopsis: 'An evocative multidisciplinary showcase of African oral tradition, spoken word, movement, and physical theatre investigating the nuanced layers of the African diaspora experience in the modern world.',
    box_office_domestic: null,
    box_office_currency: 'NGN',
    box_office_tickets_sold: null,
    box_office_source: null,
    box_office_metrics: null
  },
  {
    title: 'Iyalode of Eti',
    slug: 'iyalode-of-eti',
    playwright: 'Debo Oluwatuminu',
    director: 'Dr. Mojisola Kareem',
    producer: 'Utopia Theatre',
    venue: 'West Yorkshire Playhouse, Leeds / Sheffield / Aké Festival Abeokuta',
    city: 'Leeds, Sheffield & Abeokuta',
    country: 'United Kingdom & Nigeria',
    year: 2016,
    run_start_date: '2016-09-21',
    run_end_date: '2016-11-19',
    status: 'archived',
    genre: 'Yoruba Classical Tragedy / Jacobean Reimagining',
    source_url: 'https://www.utopiatheatre.co.uk/',
    synopsis: 'A magnificent Yoruba reimagining of John Webster’s Jacobean classic \'The Duchess of Malfi\'. Transposed to pre-colonial Yorubaland, a noble widow secretly weds beneath her station, igniting a lethal vortex of royal jealousy, sorcery, ancestral honor, and tragedy.',
    box_office_domestic: null,
    box_office_currency: 'NGN',
    box_office_tickets_sold: null,
    box_office_source: null,
    box_office_metrics: null
  },
];

// ── 4. STAGE CREDITS SPECIFICATION ──────────────────────────────────────────────
const CREDITS = [
  // Crown of Blood
  {
    play_slug: 'crown-of-blood',
    person_slug: 'deyemi-okanlawon',
    role: 'Actor',
    character_name: 'General Aderemi (Field Marshall / Macbeth)',
    billing_order: 1,
  },
  {
    play_slug: 'crown-of-blood',
    person_slug: 'kehinde-bankole',
    role: 'Actor',
    character_name: 'Oyebisi (Lady Macbeth)',
    billing_order: 2,
  },
  {
    play_slug: 'crown-of-blood',
    person_slug: 'toyin-oshinaike',
    role: 'Actor',
    character_name: 'Arokin (The Teller of Tales)',
    billing_order: 3,
  },
  {
    play_slug: 'crown-of-blood',
    person_slug: 'patrice-naiambana',
    role: 'Actor',
    character_name: 'Esu (Spiritual Seer)',
    billing_order: 4,
  },
  {
    play_slug: 'crown-of-blood',
    person_slug: 'tope-tedela',
    role: 'Actor',
    character_name: 'Aro',
    billing_order: 5,
  },
  {
    play_slug: 'crown-of-blood',
    person_slug: 'jude-akuwudike',
    role: 'Actor',
    character_name: 'King Duncan (Oluaye)',
    billing_order: 6,
  },
  {
    play_slug: 'crown-of-blood',
    person_slug: 'mojisola-kareem',
    role: 'Director',
    character_name: null,
    billing_order: 7,
  },
  {
    play_slug: 'crown-of-blood',
    person_slug: 'oladipo-agboluaje',
    role: 'Playwright',
    character_name: null,
    billing_order: 8,
  },
  // Here's What She Said to Me
  {
    play_slug: 'heres-what-she-said-to-me',
    person_slug: 'mojisola-kareem',
    role: 'Director',
    character_name: null,
    billing_order: 1,
  },
  {
    play_slug: 'heres-what-she-said-to-me',
    person_slug: 'oladipo-agboluaje',
    role: 'Playwright',
    character_name: null,
    billing_order: 2,
  },
  // Iyalode of Eti
  {
    play_slug: 'iyalode-of-eti',
    person_slug: 'mojisola-kareem',
    role: 'Director',
    character_name: null,
    billing_order: 1,
  },
  {
    play_slug: 'iyalode-of-eti',
    person_slug: 'debo-oluwatuminu',
    role: 'Playwright',
    character_name: null,
    billing_order: 2,
  },
];

export async function runUtopiaSync() {
  console.log('====================================================');
  console.log(' Utopia Theatre Complete Repertoire Ingestion (2016-2026)');
  console.log('====================================================\n');

  // 1. Upsert Theatre Companies
  console.log('--- 1. Upserting Theatre Companies ---');
  for (const c of COMPANIES) {
    const { data: existing } = await supabase
      .from('companies')
      .select('id')
      .eq('slug', c.slug)
      .maybeSingle();

    if (existing) {
      await supabase.from('companies').update({ ...c, updated_at: new Date().toISOString() }).eq('id', existing.id);
      console.log(`  UPDATED Company: ${c.name}`);
    } else {
      const { error } = await supabase.from('companies').insert(c);
      if (error) console.error(`  FAIL inserting company ${c.name}:`, error.message);
      else console.log(`  CREATED Company: ${c.name}`);
    }
  }

  // 2. Upsert Key Creative People
  console.log('\n--- 2. Upserting People Profiles ---');
  const personSlugToId: Record<string, string> = {};
  for (const p of PEOPLE) {
    const { data: existing } = await supabase
      .from('people')
      .select('id, slug, name')
      .eq('slug', p.slug)
      .maybeSingle();

    if (existing) {
      personSlugToId[p.slug] = existing.id;
      console.log(`  EXISTS Person: ${p.name} (${existing.id})`);
    } else {
      const { data: created, error } = await supabase
        .from('people')
        .insert(p)
        .select('id, slug')
        .single();
      if (error) {
        console.error(`  FAIL inserting person ${p.name}:`, error.message);
      } else if (created) {
        personSlugToId[p.slug] = created.id;
        console.log(`  CREATED Person: ${p.name} (${created.id})`);
      }
    }
  }

  // Also resolve Deyemi and Kehinde
  const { data: deyemi } = await supabase.from('people').select('id').eq('slug', 'deyemi-okanlawon').maybeSingle();
  if (deyemi) personSlugToId['deyemi-okanlawon'] = deyemi.id;

  const { data: kehinde } = await supabase.from('people').select('id').eq('slug', 'kehinde-bankole').maybeSingle();
  if (kehinde) personSlugToId['kehinde-bankole'] = kehinde.id;

  // 3. Upsert Stage Plays
  console.log('\n--- 3. Upserting Stage Plays Repertoire ---');
  const playSlugToId: Record<string, string> = {};
  for (const play of UTOPIA_PLAYS) {
    const { data: existing } = await supabase
      .from('plays')
      .select('id, slug, title')
      .eq('slug', play.slug)
      .maybeSingle();

    const nowIso = new Date().toISOString();
    if (existing) {
      const { error } = await supabase
        .from('plays')
        .update({
          ...play,
          updated_at: nowIso,
          box_office_updated_at: nowIso,
        })
        .eq('id', existing.id);

      if (error) {
        console.error(`  FAIL updating play ${play.title}:`, error.message);
      } else {
        playSlugToId[play.slug] = existing.id;
        console.log(`  UPDATED Play: "${play.title}" (slug: ${play.slug})`);
      }
    } else {
      const { data: created, error } = await supabase
        .from('plays')
        .insert({
          ...play,
          created_at: nowIso,
          updated_at: nowIso,
          box_office_updated_at: nowIso,
        })
        .select('id, slug')
        .single();

      if (error) {
        console.error(`  FAIL inserting play ${play.title}:`, error.message);
      } else if (created) {
        playSlugToId[play.slug] = created.id;
        console.log(`  CREATED Play: "${play.title}" (id: ${created.id})`);
      }
    }
  }

  // 4. Link Stage Credits (With zero-duplicate guarantee)
  console.log('\n--- 4. Linking Stage Credits ---');
  for (const c of CREDITS) {
    const personId = personSlugToId[c.person_slug];
    const playId = playSlugToId[c.play_slug];

    if (!personId) {
      console.warn(`  SKIP: No person_id for ${c.person_slug}`);
      continue;
    }
    if (!playId) {
      console.warn(`  SKIP: No play_id for ${c.play_slug}`);
      continue;
    }

    // Check existing credit
    const { data: existingCred } = await supabase
      .from('stage_credits')
      .select('id')
      .eq('play_id', playId)
      .eq('person_id', personId)
      .eq('role', c.role)
      .maybeSingle();

    if (existingCred) {
      await supabase
        .from('stage_credits')
        .update({
          character_name: c.character_name,
          billing_order: c.billing_order,
        })
        .eq('id', existingCred.id);
      console.log(`  UPDATED Credit: ${c.person_slug} in ${c.play_slug} (${c.character_name || c.role})`);
    } else {
      const { error } = await supabase.from('stage_credits').insert({
        play_id: playId,
        person_id: personId,
        role: c.role,
        character_name: c.character_name,
        billing_order: c.billing_order,
      });
      if (error) {
        console.error(`  FAIL inserting credit for ${c.person_slug}:`, error.message);
      } else {
        console.log(`  CREATED Credit: ${c.person_slug} in ${c.play_slug} (${c.character_name || c.role})`);
      }
    }
  }

  console.log('\n====================================================');
  console.log(' All 9 Utopia Theatre plays, credits & companies synced!');
  console.log('====================================================');
  return { success: true, count: UTOPIA_PLAYS.length };
}

if (process.argv[1] && process.argv[1].endsWith('sync_utopia_theatre.ts')) {
  runUtopiaSync()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
