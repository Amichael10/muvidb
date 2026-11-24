import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import dns from 'dns';

dns.setDefaultResultOrder('ipv4first');
dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY
);

async function upsertCompany(payload) {
  const { data: existing } = await supabase
    .from('companies')
    .select('id, name, slug')
    .ilike('name', payload.name.trim())
    .limit(1);

  if (existing && existing.length > 0) {
    const { data: updated, error } = await supabase
      .from('companies')
      .update({
        ...payload,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existing[0].id)
      .select('id, name, slug')
      .single();
    if (error) console.error('Error updating company:', error.message);
    return updated || existing[0];
  }

  const { data: created, error } = await supabase
    .from('companies')
    .insert(payload)
    .select('id, name, slug')
    .single();

  if (error) {
    console.error(`Error creating company ${payload.name}:`, error.message);
    return null;
  }
  return created;
}

async function upsertPerson(name, extra = {}) {
  const clean = name.trim();
  const { data: existing } = await supabase
    .from('people')
    .select('id, name')
    .ilike('name', clean)
    .limit(1);

  if (existing && existing.length > 0) return existing[0].id;

  const { data: rpcId, error: rpcErr } = await supabase.rpc('upsert_person_by_name', {
    p_name: clean,
    p_extra: { nationality: 'Ghanaian', source: 'admin_intake', ...extra },
  });

  if (!rpcErr && rpcId) return rpcId;

  const slug = clean.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  const { data: inserted, error: insErr } = await supabase
    .from('people')
    .insert({
      name: clean,
      slug: `${slug}-${Date.now().toString(36).slice(-4)}`,
      nationality: 'Ghanaian',
      bio: extra.bio || null,
      primary_role: extra.primary_role || null,
      source: 'admin_intake',
    })
    .select('id')
    .single();

  if (insErr) {
    console.error(`Failed to insert person ${clean}:`, insErr.message);
    return null;
  }
  return inserted.id;
}

async function upsertPlay(item) {
  const { cast, crew, ...playPayload } = item;
  const { data: existing } = await supabase
    .from('plays')
    .select('id, slug')
    .eq('slug', playPayload.slug)
    .limit(1);

  let playId;
  if (existing && existing.length > 0) {
    playId = existing[0].id;
    await supabase.from('plays').update({
      ...playPayload,
      updated_at: new Date().toISOString(),
    }).eq('id', playId);
    console.log(`Updated play: ${playPayload.title} (${playId})`);
  } else {
    const { data: created, error } = await supabase
      .from('plays')
      .insert(playPayload)
      .select('id')
      .single();
    if (error) {
      console.error(`Error inserting play ${playPayload.title}:`, error.message);
      return;
    }
    playId = created.id;
    console.log(`Created play: ${playPayload.title} (${playId})`);
  }

  // Credits
  if (playId) {
    let order = 1;
    for (const actor of cast || []) {
      const pId = await upsertPerson(actor.name, { primary_role: 'Actor' });
      if (pId) {
        const { data: existingCredit } = await supabase
          .from('stage_credits')
          .select('id')
          .eq('play_id', playId)
          .eq('person_id', pId)
          .eq('role', 'actor')
          .limit(1);

        if (!existingCredit || existingCredit.length === 0) {
          await supabase.from('stage_credits').insert({
            play_id: playId,
            person_id: pId,
            role: 'actor',
            character_name: actor.character_name || null,
            billing_order: order++,
          });
        }
      }
    }

    for (const c of crew || []) {
      const pId = await upsertPerson(c.name, { primary_role: c.role });
      if (pId) {
        const { data: existingCredit } = await supabase
          .from('stage_credits')
          .select('id')
          .eq('play_id', playId)
          .eq('person_id', pId)
          .eq('role', c.role)
          .limit(1);

        if (!existingCredit || existingCredit.length === 0) {
          await supabase.from('stage_credits').insert({
            play_id: playId,
            person_id: pId,
            role: c.role,
            character_name: null,
            billing_order: 0,
          });
        }
      }
    }
  }
}

async function main() {
  console.log('=== Ingesting Theatre Production Companies & Plays ===');

  // 1. Roverman Productions
  const roverman = await upsertCompany({
    name: 'Roverman Productions',
    slug: 'roverman-productions',
    description: `Ghana's premier theatre and live stage production company, founded by celebrated playwright and director James Ebo Whyte ("Uncle Ebo Whyte"). With over 66 original stage plays staged at the National Theatre of Ghana, Roverman has pioneered commercial theatrical entertainment in West Africa.`,
    website: 'https://rovermanproductions.com/',
    logo_url: 'https://korba-website-assets.s3.eu-west-1.amazonaws.com/projects/roverman/roverman_logo.png',
    headquarters: 'Accra, Ghana',
    founded_year: 2008,
    company_type: 'production',
    focus: 'Live Theatre, Stage Plays, Entertainment',
    contact_email: 'info@rovermanproductions.com',
    contact_phone: '+233 50 554 6010',
    verified: true,
  });
  console.log('Roverman Productions:', roverman);

  // 2. Image Bureau Gh. Ltd
  const imageBureau = await upsertCompany({
    name: 'Image Bureau Gh. Ltd',
    slug: 'image-bureau-ghana',
    description: `Premier Ghanaian events, communications, and live theatre production agency headed by celebrated media practitioner, playwright, and director George Quaye. Renowned for landmark theatrical blockbusters including Gayina's Pound of Flesh, The Legend of Aku Sika, and The Dilemma of a Ghost at the National Theatre of Ghana.`,
    website: 'https://www.imagebureaugh.com/',
    logo_url: 'https://www.imagebureaugh.com/images/logo-white.webp',
    headquarters: 'Accra, Ghana',
    founded_year: 2020,
    company_type: 'production',
    focus: 'Live Theatre, Events, Audiovisual Production, PR',
    contact_email: 'info@imagebureaugh.com',
    contact_phone: '+233 24 476 9434',
    verified: true,
  });
  console.log('Image Bureau:', imageBureau);

  // 3. Person: George Quaye
  const gqId = await upsertPerson('George Quaye', {
    primary_role: 'Playwright & Director',
    bio: `George Quaye is an acclaimed Ghanaian actor, playwright, director, and CEO of Image Bureau Ghana. A veteran of the Ghanaian stage and screen, he is known for adapting and directing major theatrical productions such as Gayina's Pound of Flesh, The Legend of Aku Sika, and The Gods Are Not to Blame at the National Theatre of Ghana.`,
  });
  console.log('George Quaye Person ID:', gqId);

  // 4. Plays from VeeTickets
  await upsertPlay({
    title: "Gayina's Pound of Flesh",
    slug: 'gayinas-pound-of-flesh-2026',
    year: 2026,
    playwright: 'George Quaye',
    director: 'George Quaye',
    producer: 'Image Bureau Gh. Ltd',
    venue: 'National Theatre, Accra, Ghana',
    city: 'Accra',
    country: 'Ghana',
    genre: 'African Adaptation / Drama',
    status: 'upcoming',
    performance_time: '4:00 PM & 8:00 PM',
    run_start_date: '2026-08-01',
    run_end_date: '2026-08-10',
    synopsis: `Adapted for the African stage by George Quaye, inspired by William Shakespeare's timeless classic The Merchant of Venice, this powerful reimagining brings one of literature's most celebrated stories to life through an authentic African lens. Blending rich cultural traditions, vibrant music, captivating performances, and contemporary African storytelling, the production explores enduring themes of justice, love, friendship, mercy, prejudice, and sacrifice.`,
    source_url: 'https://www.veetickets.com/events/gayinas-pound-of-flesh',
    poster_url: 'https://res.cloudinary.com/dg8kkh3xx/image/upload/v1786096697/events/dlaqqsw5j1axg0f94xbp.jpg',
    box_office_domestic: null,
    box_office_tickets_sold: null,
    box_office_currency: 'GHS',
    box_office_source: null,
    box_office_metrics: {
      ticket_tiers: [
        { tier: 'Regular', price: 100, currency: 'GHS' },
        { tier: 'VIP', price: 200, currency: 'GHS' }
      ]
    },
    cast: [
      { name: 'George Quaye', character_name: 'Lead Performer' }
    ],
    crew: [
      { name: 'George Quaye', role: 'director' },
      { name: 'George Quaye', role: 'playwright' },
      { name: 'Image Bureau Gh. Ltd', role: 'producer' }
    ]
  });

  await upsertPlay({
    title: 'Love We Go Chop?',
    slug: 'love-we-go-chop-2026',
    year: 2026,
    playwright: 'The High Court of Poetry',
    director: 'The High Court of Poetry',
    producer: 'The High Court of Poetry',
    venue: 'Radach Lodge and Conference Center, Tamale, Ghana',
    city: 'Tamale',
    country: 'Ghana',
    genre: 'Poetic Drama',
    status: 'upcoming',
    performance_time: '5:30 PM (17:30 - 23:00)',
    run_start_date: '2026-12-26',
    run_end_date: '2026-12-26',
    synopsis: `Anthesis: Our Transcended Love is a poetic stage play that explores the beauty, intensity, and trials of young love as it blossoms, matures, and faces moral and emotional tests in contemporary Ghana.`,
    source_url: 'https://www.veetickets.com/events/lovewegochop',
    poster_url: 'https://res.cloudinary.com/dg8kkh3xx/image/upload/v1793777258/events/flnwue8h2ws6h1bf09sh.jpg',
    box_office_domestic: null,
    box_office_tickets_sold: null,
    box_office_currency: 'GHS',
    box_office_source: null,
    box_office_metrics: {
      ticket_tiers: [
        { tier: 'Regular', price: 80, currency: 'GHS' },
        { tier: 'VIP', price: 150, currency: 'GHS' }
      ]
    },
    cast: [],
    crew: [
      { name: 'The High Court of Poetry', role: 'producer' }
    ]
  });

  console.log('=== Ingestion Complete Successfully ===');
}

main().catch(console.error);
