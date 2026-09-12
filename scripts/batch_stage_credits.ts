import { supabase } from './lib/db';

async function batchStageCredits() {
  console.log("=== 1. FETCHING ALL PLAYS ===");
  const { data: plays, error } = await supabase.from('plays').select('id, title, slug, playwright, director, producer, year');
  if (error) {
    console.error("Error fetching plays:", error);
    return;
  }
  console.log(`Loaded ${plays?.length || 0} plays from DB.`);

  function norm(s) {
    return (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  }

  const playMap = new Map();
  for (const p of plays) {
    playMap.set(norm(p.slug), p);
    playMap.set(norm(p.title), p);
  }

  const credits = [];

  // 1. CHIEF HUBERT OGUNDE
  const OGUNDE_ID = '25ac2ceb-e46e-4227-bde9-5a9698399f4a';
  const ogundePlays = plays.filter(p => 
    (p.playwright && p.playwright.includes('Ogunde')) ||
    (p.director && p.director.includes('Ogunde')) ||
    (p.producer && p.producer.includes('Ogunde'))
  );
  console.log(`Found ${ogundePlays.length} plays for Chief Hubert Ogunde.`);
  for (const p of ogundePlays) {
    credits.push({
      play_id: p.id,
      person_id: OGUNDE_ID,
      role: 'Playwright & Director',
      character_name: 'Lead / Director',
      billing_order: 1
    });
  }

  // 2. OLU JACOBS
  const OLU_JACOBS_ID = 'f3cb56bc-381d-4f90-862c-0ffdf33ede8f';
  const oluPlayQueries = [
    { title: 'Murderous Angels', role: 'Actor', character: 'Diallo' },
    { title: 'Richard', role: 'Actor', character: 'Hero' },
    { title: 'Taste of Honey', role: 'Actor', character: 'Boy' },
    { title: 'Black Man', role: 'Actor', character: 'Father Michael' },
    { title: 'Lion and the Jewel', role: 'Actor', character: 'Baroka (Bale of Ilujinle)' },
    { title: 'Julius Caesar', role: 'Actor', character: 'Cinna / Roman Soldier' },
    { title: 'Old Movies', role: 'Actor', character: 'Cast' },
    { title: 'Gods Are Not to Blame', role: 'Actor', character: 'King Odewale' },
    { title: 'Night and Day', role: 'Actor', character: 'President Mageeba' },
    { title: 'Black Jacobins', role: 'Actor', character: 'Cast' },
    { title: 'Ovonramwen Nogbaisi', role: 'Actor', character: 'Oba Ovonramwen' },
    { title: 'Holy Child', role: 'Director & Lead Actor', character: 'Joseph' }
  ];

  for (const q of oluPlayQueries) {
    const play = plays.find(p => p.title.toLowerCase().includes(q.title.toLowerCase()) || p.slug.toLowerCase().includes(q.title.toLowerCase()));
    if (play) {
      credits.push({
        play_id: play.id,
        person_id: OLU_JACOBS_ID,
        role: q.role,
        character_name: q.character,
        billing_order: 1
      });
      console.log(`Matched Olu Jacobs -> "${play.title}" (${q.role})`);
    } else {
      console.warn(`Could not match Olu play: "${q.title}"`);
    }
  }

  // 3. JOKE SILVA
  const JOKE_SILVA_ID = 'b1d86b0c-0864-460a-b538-2eb569ef0a98';
  const jokePlayQueries = [
    { title: 'Holy Child', role: 'Playwright & Lead Actress', character: 'Mary' },
    { title: 'Song of a Goat', role: 'Actor', character: 'Orukorere' },
    { title: 'Baba Segi', role: 'Lead Actress', character: 'Iya Segi' }
  ];
  for (const q of jokePlayQueries) {
    const play = plays.find(p => p.title.toLowerCase().includes(q.title.toLowerCase()) || p.slug.toLowerCase().includes(q.title.toLowerCase()));
    if (play) {
      credits.push({
        play_id: play.id,
        person_id: JOKE_SILVA_ID,
        role: q.role,
        character_name: q.character,
        billing_order: 1
      });
      console.log(`Matched Joke Silva -> "${play.title}"`);
    }
  }

  // 4. PETE EDOCHIE
  const PETE_EDOCHIE_ID = 'f3da5846-7d71-4ed6-a65b-aceb2a69b218';
  const petePlayQueries = [
    { title: 'Mayor of Casterbridge', role: 'Director & Lead Actor', character: 'Michael Henchard' },
    { title: 'Sons and Daughters', role: 'Director', character: 'Director' },
    { title: 'Dilemma of a Ghost', role: 'Director', character: 'Director' },
    { title: 'Things Fall Apart', role: 'Lead Actor', character: 'Okonkwo' }
  ];
  for (const q of petePlayQueries) {
    const play = plays.find(p => p.title.toLowerCase().includes(q.title.toLowerCase()) || p.slug.toLowerCase().includes(q.title.toLowerCase()));
    if (play) {
      credits.push({
        play_id: play.id,
        person_id: PETE_EDOCHIE_ID,
        role: q.role,
        character_name: q.character,
        billing_order: 1
      });
      console.log(`Matched Pete Edochie -> "${play.title}"`);
    }
  }

  // 5. WOLE SOYINKA
  const WOLE_SOYINKA_ID = '8ad5236f-8ae2-4b53-bf15-34ef21b6aae8';
  const soyinkaPlays = plays.filter(p => p.playwright && p.playwright.includes('Soyinka'));
  for (const p of soyinkaPlays) {
    credits.push({
      play_id: p.id,
      person_id: WOLE_SOYINKA_ID,
      role: 'Playwright & Director',
      character_name: 'Playwright',
      billing_order: 1
    });
  }

  // 6. BOLANLE AUSTEN-PETERS
  const BAP_ID = 'ac5709bc-67e0-41be-aa61-b5cda3a50048';
  const bapPlays = plays.filter(p => 
    (p.playwright && p.playwright.includes('Austen-Peters')) || 
    (p.director && p.director.includes('Austen-Peters')) ||
    (p.producer && p.producer.includes('BAP'))
  );
  for (const p of bapPlays) {
    credits.push({
      play_id: p.id,
      person_id: BAP_ID,
      role: 'Director & Producer',
      character_name: 'Director / Producer',
      billing_order: 1
    });
  }

  // 7. TAIWO AJAI-LYCETT
  const TAIWO_ID = '4d914ea2-9df4-43ee-8dfc-fbb583b70876';
  const taiwoPlayQueries = [
    { title: 'Song of a Goat', role: 'Actor', character: 'Cast' },
    { title: 'Lion and the Jewel', role: 'Actor', character: 'Sandi' },
    { title: 'Taste of Honey', role: 'Actor', character: 'Cast' }
  ];
  for (const q of taiwoPlayQueries) {
    const play = plays.find(p => p.title.toLowerCase().includes(q.title.toLowerCase()) || p.slug.toLowerCase().includes(q.title.toLowerCase()));
    if (play) {
      credits.push({
        play_id: play.id,
        person_id: TAIWO_ID,
        role: q.role,
        character_name: q.character,
        billing_order: 2
      });
      console.log(`Matched Taiwo Ajai-Lycett -> "${play.title}"`);
    }
  }

  // 8. CHINUA ACHEBE
  const ACHEBE_ID = 'f10c87db-ede9-4cca-88ea-ab321d32f7c4';
  const tfaPlay = plays.find(p => p.title.toLowerCase().includes('things fall apart'));
  if (tfaPlay) {
    credits.push({
      play_id: tfaPlay.id,
      person_id: ACHEBE_ID,
      role: 'Original Author / Novelist',
      character_name: 'Author',
      billing_order: 1
    });
  }

  // 9. WALE OGUNYEMI
  const OGUNYEMI_ID = '7bb0c1f9-a52c-48fd-a1f1-be280411d679';
  const langbodoPlay = plays.find(p => p.title.toLowerCase().includes('langbodo'));
  if (langbodoPlay) {
    credits.push({
      play_id: langbodoPlay.id,
      person_id: OGUNYEMI_ID,
      role: 'Playwright',
      character_name: 'Playwright',
      billing_order: 1
    });
  }

  console.log(`\n=== 2. BATCH UPSERTING ${credits.length} STAGE CREDITS ===`);

  // Batch insert in chunks of 50
  for (let i = 0; i < credits.length; i += 50) {
    const chunk = credits.slice(i, i + 50);
    const { error: upsertErr } = await supabase.from('stage_credits').upsert(chunk, { onConflict: 'play_id,person_id,role' });
    if (upsertErr) {
      console.error(`Chunk ${i} error:`, upsertErr);
    } else {
      console.log(`Chunk ${i} to ${i + chunk.length} upserted successfully!`);
    }
  }

  console.log("\n=== 3. VERIFYING PERSON STAGE CREDITS ===");
  const testPeople = [
    { name: 'Chief Hubert Ogunde', id: OGUNDE_ID },
    { name: 'Olu Jacobs', id: OLU_JACOBS_ID },
    { name: 'Joke Silva', id: JOKE_SILVA_ID },
    { name: 'Pete Edochie', id: PETE_EDOCHIE_ID },
    { name: 'Wole Soyinka', id: WOLE_SOYINKA_ID },
    { name: 'Bolanle Austen-Peters', id: BAP_ID },
    { name: 'Taiwo Ajai-Lycett', id: TAIWO_ID }
  ];

  for (const tp of testPeople) {
    const { data: userCredits } = await supabase.from('stage_credits').select('id, role, character_name, plays(title, year, venue)').eq('person_id', tp.id);
    console.log(`🎭 ${tp.name}: ${userCredits?.length || 0} stage credits linked!`);
    for (const c of (userCredits || []).slice(0, 3)) {
      console.log(`   • [${c.plays?.year || 'N/A'}] "${c.plays?.title}" (${c.role})`);
    }
  }
}

batchStageCredits().catch(console.error);
