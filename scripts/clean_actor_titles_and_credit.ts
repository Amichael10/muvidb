import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

function toSentenceCase(str: string): string {
  if (!str) return '';
  const s = str.trim();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function toTitleCase(str: string): string {
  if (!str) return '';
  return str
    .toLowerCase()
    .split(/\s+/)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .trim()
    .replace(/\s+/g, '-');
}

const NOISE_RE = /[\s\-\|:~=*\#]*(?:(?:nigerian|nollywood)?\s*(?:love\s*)?(?:movie|film|drama|blockbuster|series|season|episode|cinema|full\s*movie|latest\s*movie|new\s*movie|brand\s*new|202[0-9]|\bhd\b|\b4k\b))[\s\-\|:~=*\#]*/gi;

const NON_NAME_VERBS = new Set([
  'nothing', 'could', 'satisfy', 'korean', 'mafia', 'boss', 'caregiver', 'african',
  'night', 'years', 'story', 'secret', 'house', 'village', 'return', 'part', 'season',
  'episode', 'comedy', 'series', 'movie', 'film', 'drama', 'video', 'official', 'trailer',
  'husband', 'wife', 'brother', 'sister', 'mother', 'father', 'daughter', 'son', 'family',
  'royal', 'palace', 'kingdom', 'prince', 'princess', 'king', 'queen', 'love', 'scars',
  'desire', 'sacrifice', 'beast', 'ghetto', 'dirty', 'sacred', 'blood', 'heart', 'soul'
]);

const KNOWN_ACTORS_LIST = [
  'Odunlade Adekola', 'Funke Akindele', 'Femi Adebayo', 'Lateef Adedimeji', 'Adedimeji Lateef',
  'Mercy Johnson', 'Mercy Johnson Okojie', 'Toyin Abraham', 'Toyin Aimakhu', 'Zubby Michael',
  'Destiny Etiko', 'Ibrahim Chatta', 'Bolanle Ninalowo', 'Regina Daniels', 'Ray Emodi',
  'Maurice Sam', 'Ken Erics', 'Yul Edochie', 'Nkem Owoh', 'Pete Edochie', 'Fredrick Leonard',
  'Frederick Leonard', 'Bimbo Ademoye', 'Bimbo Oyebade', 'Mo Bimbo', 'Fisayomi Abebi',
  'Kehinde Bankole', 'Kehinde Olowo', 'Laide Bakare', 'Ebele Okaro', 'Ngozi Ezeonu',
  'Queen Nwokoye', 'Patience Ozokwor', 'Nosa Rex', 'Noxa Rex', 'Nosarex', 'Peace Onuoha',
  'Onyi Alex', 'Bolaji Amusan', 'Mr Latin', 'Anike Ami', 'Ebube Obio', 'Ebube Nwagbo',
  'Chizzy Alichi', 'Uche Nancy', 'Sonia Uche', 'Luchy Donalds', 'Maleek Milton',
  'Chioma Akpotha', 'Chioma Chukwuka', 'Ini Edo', 'Falz', 'Timini Egbuson', 'Uzor Arukwe',
  'Wunmi Toriola', 'Chidi Mokeme', 'Kanayo O. Kanayo', 'Kanayo O Kanayo', 'Ify Eze',
  'Uche Montana', 'Shaznay Okawa', 'Ruth Kadiri', 'Mercy Aigbe', 'Mide Martins',
  'Nkechi Blessing', 'Iyabo Ojo', 'Nkechi Nnaji', 'Adunni Ade', 'Lilian Esoro',
  'Sharon Ooja', 'Nancy Isime', 'Bimbo Manuel', 'Shaffy Bello', 'Sola Sobowale',
  'Tina Mba', 'Jide Kosoko', 'Taiwo Hassan', 'Yinka Quadri', 'Adebayo Salami',
  'Saidi Balogun', 'Kunle Afolayan', 'Gabriel Afolayan', 'Ramsey Nouah', 'Jim Iyke',
  'Mike Ezuruonye', 'Nonso Diobi', 'Oge Okoye', 'Chacha Eke', 'Ini Dima-Okojie',
  'Tobi Bakre', 'Alexx Ekubo', 'IK Ogbonna', 'Blossom Chukwujekwu', 'Stan Nze',
  'Deyemi Okanlawon', 'Daniel Etim Effiong', 'Eyinna Nwigwe', 'Mr Macaroni',
  'Broda Shaggi', 'Sabinus', 'Phyna', 'Tonto Dikeh', 'Rita Dominic', 'Uche Jombo',
  'Omoni Oboli', 'Afeez Owo', 'Sotayo Gaga', 'Eniola Badmus', 'Ronke Odusanya',
  'Muyiwa Ademola', 'Ibrahim Yekini', 'Itele D Icon', 'Lizzy Gold', 'Chinonso Arubayi',
  'Chioma Nwosu', 'Doris Ifeka', 'Uchechi Treasure', 'Ugezu J Ugezu', 'Genevieve Nnaji',
  'Omotola Jalade', 'Richard Mofe Damijo', 'RMD', 'Sam Dede', 'Segun Arinze',
  'Sandra Okunzuwa', 'Daniel Etim', 'Daniel Rocky', 'Wole Ojo', 'Lolade Okunsanya',
  'Christian Ochiaga', 'Anthony Woods', 'Pearl Watts', 'Mike Godson', 'Linda Osifo'
];

async function cleanTitlesAndCreditActors() {
  console.log('🚀 Precision scanning full DB to clean titles & credit actors...');

  // 1. Fetch people from DB
  let allPeople: { id: string; name: string }[] = [];
  let pPage = 0;
  const pPageSize = 1000;

  while (true) {
    const { data: pBatch, error: pErr } = await supabase
      .from('people')
      .select('id, name')
      .range(pPage * pPageSize, (pPage + 1) * pPageSize - 1);

    if (pErr) {
      console.error('Error fetching people:', pErr.message);
      break;
    }
    if (!pBatch || pBatch.length === 0) break;
    allPeople = allPeople.concat(pBatch);
    if (pBatch.length < pPageSize) break;
    pPage++;
  }

  console.log(`Loaded ${allPeople.length} people records from Supabase.`);

  const personNameToIdMap = new Map<string, string>();
  for (const p of allPeople) {
    if (p.name) {
      personNameToIdMap.set(p.name.toLowerCase().trim(), p.id);
    }
  }

  const knownActorLowerSet = new Set([
    ...KNOWN_ACTORS_LIST.map(a => a.toLowerCase().trim()),
    ...allPeople
      .filter(p => p.name && p.name.trim().split(/\s+/).length >= 2 && p.name.trim().length >= 4)
      .map(p => p.name.toLowerCase().trim())
  ]);

  function sanitizeActorName(rawName: string): string | null {
    if (!rawName) return null;
    let name = rawName
      .replace(/[\(\)\[\]\{\}\~\=\*\#]/g, '')
      .replace(/\b(?:movie|film|drama|full|latest|new|brand|official|trailer|series|part|hd|4k)\b/gi, '')
      .replace(/[^a-zA-Z\s\.'\-]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    const lower = name.toLowerCase();
    if (!name || name.length < 3) return null;

    // Check if any word in candidate name is a non-name verb
    const words = lower.split(/\s+/);
    for (const w of words) {
      if (NON_NAME_VERBS.has(w)) return null;
    }

    if (words.length < 2) {
      if (!knownActorLowerSet.has(lower)) return null;
    }

    // Must be in known set or look like a clean 2-3 word human name
    if (!knownActorLowerSet.has(lower)) {
      if (words.length > 3) return null;
    }

    return toTitleCase(name);
  }

  async function getOrCreatePerson(rawActorName: string): Promise<string | null> {
    const sanitized = sanitizeActorName(rawActorName);
    if (!sanitized) return null;

    const norm = sanitized.toLowerCase();
    if (personNameToIdMap.has(norm)) {
      return personNameToIdMap.get(norm)!;
    }

    // DB lookup
    const { data: existing } = await supabase
      .from('people')
      .select('id, name')
      .ilike('name', sanitized)
      .maybeSingle();

    if (existing) {
      personNameToIdMap.set(existing.name.toLowerCase(), existing.id);
      return existing.id;
    }

    // Create stub
    const { data: created, error } = await supabase
      .from('people')
      .insert([{
        name: sanitized,
        nationality: 'Nigerian',
        gender: 'Prefer not to say'
      }])
      .select('id, name')
      .single();

    if (error || !created) {
      console.error(`Failed to create person for "${sanitized}":`, error?.message);
      return null;
    }

    console.log(`  ✨ Created person stub: "${created.name}" (${created.id})`);
    personNameToIdMap.set(norm, created.id);
    return created.id;
  }

  // 2. Iterate through all films
  let filmPage = 0;
  const filmPageSize = 500;
  let totalCleanedCount = 0;
  let totalCreditsAdded = 0;

  while (true) {
    const { data: films, error: fErr } = await supabase
      .from('films')
      .select('id, title, slug')
      .range(filmPage * filmPageSize, (filmPage + 1) * filmPageSize - 1);

    if (fErr) {
      console.error('Error fetching films:', fErr.message);
      break;
    }

    if (!films || films.length === 0) break;

    for (const film of films) {
      if (!film.title) continue;
      const originalTitle = film.title;
      let workingTitle = originalTitle;
      const detectedActors = new Set<string>();

      // Step A: Strip obvious YouTube noise phrases at the end of title first
      workingTitle = workingTitle.replace(NOISE_RE, ' ').trim();

      // Step B: Handle Parenthesized Actor lists e.g. "(lolade Okunsanya, Christian Ochiaga)"
      const parenMatch = workingTitle.match(/\(([^)]+)\)/);
      if (parenMatch) {
        const insideParen = parenMatch[1].trim();
        const lowerParen = insideParen.toLowerCase();

        if (!lowerParen.includes('part') && !lowerParen.includes('season') && !lowerParen.includes('episode') && !lowerParen.includes('official') && !lowerParen.includes('hd')) {
          const parts = insideParen.split(/[,&]/).map(s => s.trim()).filter(Boolean);
          let containsValidActor = false;

          for (const p of parts) {
            const cleanP = sanitizeActorName(p);
            if (cleanP && (knownActorLowerSet.has(cleanP.toLowerCase()) || cleanP.split(/\s+/).length === 2)) {
              containsValidActor = true;
              detectedActors.add(cleanP);
            }
          }

          if (containsValidActor) {
            workingTitle = workingTitle.replace(/\([^)]+\)/g, ' ').trim();
          }
        }
      }

      // Step C: Handle "- Drama Actor1, Actor2" or "~ Actor1, Actor2" or "- Actor1, Actor2" after dash/colon/tilde
      if (workingTitle.match(/[\-\—\–:\~=\*\#][a-zA-Z\s,]+$/)) {
        const dashMatch = workingTitle.match(/^(.+?)\s*[\-\—\–:\~=\*\#]\s*(.+)$/);
        if (dashMatch) {
          const prefix = dashMatch[1].trim();
          const suffix = dashMatch[2].trim().replace(/^Drama\s+/i, '');
          const parts = suffix.split(/[,&]/).map(s => s.trim()).filter(Boolean);

          let foundKnownActor = false;
          for (const p of parts) {
            // Check if suffix contains multiple known actors strung together without commas
            let matchedInString = false;
            for (const actorName of KNOWN_ACTORS_LIST) {
              if (p.toLowerCase().includes(actorName.toLowerCase())) {
                foundKnownActor = true;
                matchedInString = true;
                detectedActors.add(actorName);
              }
            }

            if (!matchedInString) {
              const cleanP = sanitizeActorName(p);
              if (cleanP && (knownActorLowerSet.has(cleanP.toLowerCase()) || cleanP.split(/\s+/).length === 2)) {
                foundKnownActor = true;
                detectedActors.add(cleanP);
              }
            }
          }

          if (foundKnownActor && prefix.length >= 3) {
            workingTitle = prefix;
          }
        }
      }

      // Step D: Handle trailing comma-separated names attached directly to title e.g. "Forever Scars Ify Eze, Queen Nwokoye,ken Erics"
      if (workingTitle.includes(',')) {
        const commaParts = workingTitle.split(',').map(s => s.trim());
        if (commaParts.length > 1) {
          let mainTitlePart = commaParts[0];
          let foundActor = false;

          for (let i = 1; i < commaParts.length; i++) {
            const cleanP = sanitizeActorName(commaParts[i]);
            if (cleanP && (knownActorLowerSet.has(cleanP.toLowerCase()) || cleanP.split(/\s+/).length === 2)) {
              foundActor = true;
              detectedActors.add(cleanP);
            } else {
              mainTitlePart += ', ' + commaParts[i];
            }
          }

          if (foundActor) {
            for (const actorName of KNOWN_ACTORS_LIST) {
              const lowerAct = actorName.toLowerCase();
              if (mainTitlePart.toLowerCase().endsWith(lowerAct)) {
                mainTitlePart = mainTitlePart.substring(0, mainTitlePart.length - lowerAct.length).trim();
                detectedActors.add(actorName);
                break;
              }
            }
            workingTitle = mainTitlePart;
          }
        }
      }

      // Step E: Clean trailing & leading non-alphanumeric punctuation
      workingTitle = workingTitle
        .replace(/\/(mrlatintv|yorubahood|nollywood|apatatv|parayba)\//gi, ' ')
        .replace(/[\s\-\|,;:\(\)\~\=\*\#]+$/, '')
        .replace(/^[\s\-\|,;:\(\)\~\=\*\#]+/, '')
        .trim();

      // Step F: Casing normalization
      if (workingTitle.toUpperCase() === workingTitle) {
        workingTitle = toTitleCase(workingTitle);
      } else {
        workingTitle = toSentenceCase(workingTitle);
      }

      const isTitleChanged = workingTitle !== originalTitle && workingTitle.length >= 2;
      const actorList = Array.from(detectedActors).filter(Boolean);

      if (isTitleChanged || actorList.length > 0) {
        console.log(`\n----------------------------------------`);
        console.log(`🎬 Original Title: "${originalTitle}"`);
        if (isTitleChanged) console.log(`✨ Cleaned Title:  "${workingTitle}"`);
        if (actorList.length > 0) console.log(`👥 Extracted Actors:`, actorList);

        // 1. Update Title & Slug in DB
        if (isTitleChanged) {
          let newSlug = generateSlug(workingTitle);
          let { error: updateErr } = await supabase
            .from('films')
            .update({
              title: workingTitle,
              slug: newSlug
            })
            .eq('id', film.id);

          // Handle slug collision gracefully
          if (updateErr && updateErr.message.includes('films_slug_key')) {
            newSlug = `${newSlug}-${film.id.substring(0, 5)}`;
            const { error: retryErr } = await supabase
              .from('films')
              .update({
                title: workingTitle,
                slug: newSlug
              })
              .eq('id', film.id);

            if (!retryErr) updateErr = null;
          }

          if (updateErr) {
            console.error(`Error updating title for film ${film.id}:`, updateErr.message);
          } else {
            totalCleanedCount++;
          }
        }

        // 2. Add Credits for detected actors
        for (const rawActorName of actorList) {
          const personId = await getOrCreatePerson(rawActorName);
          if (!personId) continue;

          // Check existing credit
          const { data: existingCredit } = await supabase
            .from('credits')
            .select('id')
            .eq('film_id', film.id)
            .eq('person_id', personId)
            .maybeSingle();

          if (!existingCredit) {
            const { error: creditErr } = await supabase
              .from('credits')
              .insert([{
                film_id: film.id,
                person_id: personId,
                role: 'actor',
                billing_order: 1
              }]);

            if (creditErr) {
              console.error(`Error adding credit for "${rawActorName}":`, creditErr.message);
            } else {
              totalCreditsAdded++;
              console.log(`  ➕ Credited "${rawActorName}" to "${workingTitle}"`);
            }
          }
        }
      }
    }

    console.log(`Processed page batch ${filmPage + 1}...`);
    if (films.length < filmPageSize) break;
    filmPage++;
  }

  console.log(`\n========================================`);
  console.log(`🎉 FULL DB SCAN & CLEANUP COMPLETE!`);
  console.log(`- Cleaned ${totalCleanedCount} film titles.`);
  console.log(`- Added ${totalCreditsAdded} actor credit records.`);
  console.log(`========================================`);
}

cleanTitlesAndCreditActors();
