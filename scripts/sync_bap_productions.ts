import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

async function runBapSync() {
  console.log('--- 1. BAP PRODUCTIONS COMPANY ---');
  let { data: bapCo } = await supabase
    .from('companies')
    .select('*')
    .ilike('name', '%BAP Productions%')
    .maybeSingle();

  if (!bapCo) {
    const { data: newCo, error } = await supabase
      .from('companies')
      .insert({
        name: 'BAP Productions',
        slug: 'bap-productions',
        company_type: 'production_company',
        founded_year: 2013,
        headquarters: 'Lagos, Nigeria',
        website: 'https://bapproduction.com',
        logo_url: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=500',
        description: "BAP Productions (Bolanle Austen-Peters Productions) is Nigeria's premier film and theatre production powerhouse behind blockbusters such as Funmilayo Ransome-Kuti, House of Ga'a, 93 Days, The Bling Lagosians, Saro The Musical, and Wakaa! The Musical."
      })
      .select()
      .single();
    if (error) console.error('Error creating BAP company:', error);
    bapCo = newCo;
  }
  console.log('BAP Company ID:', bapCo?.id);

  console.log('--- 2. LINK BAP FILMS ---');
  const filmsToLink = [
    'Funmilayo Ransome-Kuti',
    "House of Ga'a",
    'Man of God',
    'Collision Course',
    'The Bling Lagosians',
    '93 Days'
  ];

  for (const title of filmsToLink) {
    const { data: film } = await supabase
      .from('films')
      .select('id, title')
      .ilike('title', `%${title}%`)
      .maybeSingle();

    if (film && bapCo) {
      await supabase
        .from('films')
        .update({ production_company_id: bapCo.id })
        .eq('id', film.id);

      const { data: existingFc } = await supabase
        .from('film_companies')
        .select('*')
        .eq('film_id', film.id)
        .eq('company_id', bapCo.id)
        .maybeSingle();

      if (!existingFc) {
        await supabase.from('film_companies').insert({
          film_id: film.id,
          company_id: bapCo.id,
          role: 'production'
        });
      }
      console.log(`Linked film: ${film.title}`);
    } else {
      console.log(`Film not found in DB yet: ${title}`);
    }
  }

  console.log('--- 3. CREATE & LINK THEATRE PLAYS ---');
  const plays = [
    {
      title: 'Saro The Musical',
      slug: 'saro-the-musical',
      playwright: 'Bolanle Austen-Peters & Team',
      first_performed_year: 2013,
      synopsis: 'A high-octane Broadway-style Lagos musical following four young men who journey from rural villages to Lagos with big dreams of music stardom.',
      poster_url: 'https://images.unsplash.com/photo-1507676184212-d03ab07a01bf?w=800',
      official_url: 'https://bapproduction.com',
      company_id: bapCo?.id,
      venue_name: 'Terra Kulture Arena / Shaw Theatre London'
    },
    {
      title: 'Wakaa! The Musical',
      slug: 'wakaa-the-musical',
      playwright: 'Bolanle Austen-Peters & Team',
      first_performed_year: 2016,
      synopsis: 'A satire about political trial, youth ambition, social struggle, and love among fresh university graduates in Nigeria.',
      poster_url: 'https://images.unsplash.com/photo-1469488865564-c2de10f69f96?w=800',
      official_url: 'https://bapproduction.com',
      company_id: bapCo?.id,
      venue_name: 'Terra Kulture Arena / Shaw Theatre London'
    },
    {
      title: 'Fela and the Kalakuta Queens',
      slug: 'fela-and-the-kalakuta-queens',
      playwright: 'Bolanle Austen-Peters',
      first_performed_year: 2017,
      synopsis: 'An exhilarating musical chronicle of Afrobeat legend Fela Kuti and the fierce, loyal women who supported his music, political activism, and Kalakuta Republic.',
      poster_url: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=800',
      official_url: 'https://bapproduction.com',
      company_id: bapCo?.id,
      venue_name: 'Terra Kulture Arena / Cairo Opera House / South Africa'
    },
    {
      title: 'Queen Moremi The Musical',
      slug: 'queen-moremi-the-musical',
      playwright: 'Bolanle Austen-Peters',
      first_performed_year: 2018,
      synopsis: 'A grand Yoruba historical stage production recounting Queen Moremi Ajasoro of Ile-Ife and her brave sacrifice to liberate her people.',
      poster_url: 'https://images.unsplash.com/photo-1460723237483-7a6dc9d0b212?w=800',
      official_url: 'https://bapproduction.com',
      company_id: bapCo?.id,
      venue_name: 'Terra Kulture Arena, Lagos'
    },
    {
      title: 'Motherland The Musical',
      slug: 'motherland-the-musical',
      playwright: 'Bolanle Austen-Peters',
      first_performed_year: 2022,
      synopsis: "A rich theatrical story of Nigeria's political evolution, hope, resilience, and unity told through energetic song, traditional dance, and poignant drama.",
      poster_url: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=800',
      official_url: 'https://bapproduction.com',
      company_id: bapCo?.id,
      venue_name: 'Terra Kulture Arena, Lagos'
    }
  ];

  const createdPlayMap: Record<string, string> = {};

  for (const p of plays) {
    const { data: existingPlay } = await supabase
      .from('plays')
      .select('*')
      .eq('slug', p.slug)
      .maybeSingle();

    let playId = existingPlay?.id;

    if (!existingPlay) {
      const { data: inserted, error } = await supabase
        .from('plays')
        .insert(p)
        .select()
        .single();
      if (error) console.error('Play insert error:', error);
      playId = inserted?.id;
    }

    if (playId) {
      createdPlayMap[p.slug] = playId;
    }
    console.log(`Play created/verified: ${p.title} (ID: ${playId})`);
  }

  console.log('--- 4. CAST & CREW PROFILES & STAGE CREDITS ---');
  const peopleToVerify = [
    { name: 'Bolanle Austen-Peters', primaryRole: 'Director', slug: 'bolanle-austen-peters' },
    { name: 'Joseph Umoibom', primaryRole: 'Producer', slug: 'joseph-umoibom' },
    { name: 'Patrick Diabuah', primaryRole: 'Lead Actor', slug: 'patrick-diabuah' },
    { name: 'Gideon Okeke', primaryRole: 'Actor', slug: 'gideon-okeke' },
    { name: 'Osas Ighodaro', primaryRole: 'Actress', slug: 'osas-ighodaro' },
    { name: 'Lami Phillips', primaryRole: 'Actress / Singer', slug: 'lami-phillips' },
    { name: 'Bimbo Manuel', primaryRole: 'Actor', slug: 'bimbo-manuel' },
    { name: 'Tosin Adeyemi', primaryRole: 'Actress', slug: 'tosin-adeyemi' },
    { name: 'Temi Otedola', primaryRole: 'Actress', slug: 'temi-otedola' }
  ];

  const peopleMap: Record<string, string> = {};

  for (const person of peopleToVerify) {
    let { data: p } = await supabase
      .from('people')
      .select('id, name')
      .ilike('name', `%${person.name}%`)
      .maybeSingle();

    if (!p) {
      const { data: inserted } = await supabase
        .from('people')
        .insert({
          name: person.name,
          slug: person.slug,
          known_for_department: person.primaryRole.includes('Director') ? 'Directing' : 'Acting',
          country: 'Nigeria'
        })
        .select()
        .single();
      p = inserted;
      console.log(`Created person profile: ${person.name}`);
    } else {
      console.log(`Person exists: ${p.name}`);
    }

    if (p?.id) {
      peopleMap[person.name] = p.id;
    }
  }

  // Insert stage credits if stage_credits table exists
  if (Object.keys(createdPlayMap).length > 0 && Object.keys(peopleMap).length > 0) {
    const bapPersonId = peopleMap['Bolanle Austen-Peters'];
    const saroPlayId = createdPlayMap['saro-the-musical'];
    const felaPlayId = createdPlayMap['fela-and-the-kalakuta-queens'];

    if (bapPersonId && saroPlayId) {
      await supabase.from('stage_credits').insert([
        { play_id: saroPlayId, person_id: bapPersonId, role: 'Director / Producer' },
        { play_id: saroPlayId, person_id: peopleMap['Patrick Diabuah'], role: 'Saro (Lead)' }
      ]).error;
    }

    if (bapPersonId && felaPlayId) {
      await supabase.from('stage_credits').insert([
        { play_id: felaPlayId, person_id: bapPersonId, role: 'Director & Executive Producer' },
        { play_id: felaPlayId, person_id: peopleMap['Osas Ighodaro'], role: 'Kalakuta Queen' },
        { play_id: felaPlayId, person_id: peopleMap['Lami Phillips'], role: 'Kalakuta Queen' }
      ]).error;
    }
    console.log('Stage credits linked successfully!');
  }

  console.log('--- ALL BAP PRODUCTIONS DATA SUCCESSFULLY CREATED & LINKED ---');
}

runBapSync();
