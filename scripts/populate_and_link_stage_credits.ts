import { supabase } from './lib/db';

async function populateStageCredits() {
  console.log("=== 1. FETCHING ALL PLAYS ===");
  const { data: plays } = await supabase.from('plays').select('id, title, slug, playwright, director, producer, year');
  console.log(`Loaded ${plays?.length || 0} plays from DB.`);

  const playMap = new Map();
  for (const p of (plays || [])) {
    playMap.set(p.slug, p);
    playMap.set(p.title.toLowerCase().trim(), p);
  }

  const creditsToInsert = [];

  // 1. CHIEF HUBERT OGUNDE
  const OGUNDE_ID = '25ac2ceb-e46e-4227-bde9-5a9698399f4a';
  const ogundePlays = (plays || []).filter(p => 
    (p.playwright && p.playwright.includes('Ogunde')) ||
    (p.director && p.director.includes('Ogunde')) ||
    (p.producer && p.producer.includes('Ogunde'))
  );
  console.log(`Found ${ogundePlays.length} plays for Chief Hubert Ogunde.`);
  for (const p of ogundePlays) {
    creditsToInsert.push({
      play_id: p.id,
      person_id: OGUNDE_ID,
      role: 'Playwright & Director',
      character_name: 'Lead / Director',
      billing_order: 1
    });
  }

  // 2. OLU JACOBS
  const OLU_JACOBS_ID = 'f3cb56bc-381d-4f90-862c-0ffdf33ede8f';
  const oluPlayMappings = [
    { slug: 'murderous-angels-a-political-tragedy-and-comedy-in-black-and-white', role: 'Actor', character: 'Diallo' },
    { slug: 'richard-s-cork-leg', role: 'Actor', character: 'Hero' },
    { slug: 'a-taste-of-honey', role: 'Actor', character: 'Boy' },
    { slug: 'black-man-s-country', role: 'Actor', character: 'Father Michael' },
    { slug: 'the-lion-and-the-jewel', role: 'Actor', character: 'Baroka (Bale of Ilujinle)' },
    { slug: 'julius-caesar', role: 'Actor', character: 'Cinna / Roman Soldier' },
    { slug: 'old-movies', role: 'Actor', character: 'Cast' },
    { slug: 'the-gods-are-not-to-blame', role: 'Actor', character: 'King Odewale' },
    { slug: 'night-and-day', role: 'Actor', character: 'President Mageeba' },
    { slug: 'the-black-jacobins', role: 'Actor', character: 'Cast' },
    { slug: 'ovonramwen-nogbaisi', role: 'Actor', character: 'Oba Ovonramwen' },
    { slug: 'holy-child', role: 'Director & Lead Actor', character: 'Joseph' }
  ];

  for (const m of oluPlayMappings) {
    const play = playMap.get(m.slug) || (plays || []).find(p => p.slug.includes(m.slug.slice(0, 15)));
    if (play) {
      creditsToInsert.push({
        play_id: play.id,
        person_id: OLU_JACOBS_ID,
        role: m.role,
        character_name: m.character,
        billing_order: 1
      });
    } else {
      console.warn(`Could not find play with slug: ${m.slug}`);
    }
  }

  // 3. JOKE SILVA
  const JOKE_SILVA_ID = 'b1d86b0c-0864-460a-b538-2eb569ef0a98';
  const jokePlayMappings = [
    { slug: 'holy-child', role: 'Playwright & Lead Actress', character: 'Mary' },
    { slug: 'song-of-a-goat', role: 'Actor', character: 'Orukorere' },
    { slug: 'secret-lives-of-baba-segis-wives', role: 'Lead Actress', character: 'Iya Segi' }
  ];
  for (const m of jokePlayMappings) {
    const play = playMap.get(m.slug) || (plays || []).find(p => p.slug.includes(m.slug.slice(0, 15)));
    if (play) {
      creditsToInsert.push({
        play_id: play.id,
        person_id: JOKE_SILVA_ID,
        role: m.role,
        character_name: m.character,
        billing_order: 1
      });
    }
  }

  // 4. PETE EDOCHIE
  const PETE_EDOCHIE_ID = 'f3da5846-7d71-4ed6-a65b-aceb2a69b218';
  const petePlayMappings = [
    { slug: 'the-mayor-of-casterbridge', role: 'Director & Lead Actor', character: 'Michael Henchard' },
    { slug: 'sons-and-daughters', role: 'Director', character: 'Director' },
    { slug: 'the-dilemma-of-a-ghost', role: 'Director', character: 'Director' },
    { slug: 'things-fall-apart', role: 'Lead Actor', character: 'Okonkwo' }
  ];
  for (const m of petePlayMappings) {
    const play = playMap.get(m.slug) || (plays || []).find(p => p.slug.includes(m.slug.slice(0, 15)));
    if (play) {
      creditsToInsert.push({
        play_id: play.id,
        person_id: PETE_EDOCHIE_ID,
        role: m.role,
        character_name: m.character,
        billing_order: 1
      });
    }
  }

  // 5. WOLE SOYINKA
  const WOLE_SOYINKA_ID = '8ad5236f-8ae2-4b53-bf15-34ef21b6aae8';
  const soyinkaPlays = (plays || []).filter(p => p.playwright && p.playwright.includes('Soyinka'));
  for (const p of soyinkaPlays) {
    creditsToInsert.push({
      play_id: p.id,
      person_id: WOLE_SOYINKA_ID,
      role: 'Playwright & Director',
      character_name: 'Playwright',
      billing_order: 1
    });
  }

  // 6. BOLANLE AUSTEN-PETERS
  const BAP_ID = 'ac5709bc-67e0-41be-aa61-b5cda3a50048';
  const bapPlays = (plays || []).filter(p => 
    (p.playwright && p.playwright.includes('Austen-Peters')) || 
    (p.director && p.director.includes('Austen-Peters')) ||
    (p.producer && p.producer.includes('BAP'))
  );
  for (const p of bapPlays) {
    creditsToInsert.push({
      play_id: p.id,
      person_id: BAP_ID,
      role: 'Director & Producer',
      character_name: 'Director / Producer',
      billing_order: 1
    });
  }

  // 7. TAIWO AJAI-LYCETT
  const TAIWO_ID = '4d914ea2-9df4-43ee-8dfc-fbb583b70876';
  const taiwoPlayMappings = [
    { slug: 'song-of-a-goat', role: 'Actor', character: 'Cast' },
    { slug: 'the-lion-and-the-jewel', role: 'Actor', character: 'Sandi' },
    { slug: 'a-taste-of-honey', role: 'Actor', character: 'Cast' }
  ];
  for (const m of taiwoPlayMappings) {
    const play = playMap.get(m.slug) || (plays || []).find(p => p.slug.includes(m.slug.slice(0, 15)));
    if (play) {
      creditsToInsert.push({
        play_id: play.id,
        person_id: TAIWO_ID,
        role: m.role,
        character_name: m.character,
        billing_order: 2
      });
    }
  }

  // 8. CHINUA ACHEBE
  const ACHEBE_ID = 'f10c87db-ede9-4cca-88ea-ab321d32f7c4';
  const tfaPlay = (plays || []).find(p => p.title.toLowerCase().includes('things fall apart'));
  if (tfaPlay) {
    creditsToInsert.push({
      play_id: tfaPlay.id,
      person_id: ACHEBE_ID,
      role: 'Original Author / Novelist',
      character_name: 'Author',
      billing_order: 1
    });
  }

  // 9. WALE OGUNYEMI
  const OGUNYEMI_ID = '7bb0c1f9-a52c-48fd-a1f1-be280411d679';
  const langbodoPlay = (plays || []).find(p => p.title.toLowerCase().includes('langbodo'));
  if (langbodoPlay) {
    creditsToInsert.push({
      play_id: langbodoPlay.id,
      person_id: OGUNYEMI_ID,
      role: 'Playwright',
      character_name: 'Playwright',
      billing_order: 1
    });
  }

  console.log(`\n=== 2. UPSERTING ${creditsToInsert.length} STAGE CREDITS ===`);
  
  let inserted = 0;
  for (const cred of creditsToInsert) {
    const { error } = await supabase.from('stage_credits').upsert(cred, { onConflict: 'play_id,person_id,role' });
    if (error) {
      console.error(`Error inserting credit for ${cred.person_id} in play ${cred.play_id}:`, error.message);
    } else {
      inserted++;
    }
  }

  console.log(`🎉 Successfully linked ${inserted} stage credits!`);
}

populateStageCredits().catch(console.error);
