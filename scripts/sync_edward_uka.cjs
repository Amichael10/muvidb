const fs = require('fs');
const dotenv = require('dotenv');
const { createClient } = require('@supabase/supabase-js');

const envLocal = fs.existsSync('.env.local') ? dotenv.parse(fs.readFileSync('.env.local')) : {};
const env = fs.existsSync('.env') ? dotenv.parse(fs.readFileSync('.env')) : {};
const all = { ...env, ...envLocal };

const supabase = createClient(all.VITE_SUPABASE_URL || all.SUPABASE_URL, all.SUPABASE_SERVICE_ROLE_KEY);

function slugify(text) {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w\-]+/g, '')
    .replace(/\-\-+/g, '-');
}

const TITLES_METADATA = {
  'tt32731790': {
    title: 'School Run',
    year: 2023,
    runtime_minutes: null,
    genres: ['Drama'],
    synopsis: 'A dramatic exploration of the everyday struggles and emotional tension of urban life as parents navigate familial obligations, work, and the urgent safety of their children during the school commute in Nigeria.'
  },
  'tt27627814': {
    title: 'King Mabutu',
    year: 2023,
    runtime_minutes: null,
    genres: ['Drama'],
    synopsis: 'A plague Mabutu became to his people when he became King. The season of the locust his subjects tagged his reign as fear, greed, and unrest descend upon the kingdom.'
  },
  'tt21352098': {
    title: 'Andauotu',
    year: 2021,
    runtime_minutes: null,
    genres: ['Drama', 'Action'],
    synopsis: "Kinta's sons escape from an invasion, but in the chaos, they separate from each other, and decades pass before they know what happened to one another."
  },
  'tt10073630': {
    title: 'Kuvana',
    year: 2019,
    runtime_minutes: 78,
    genres: ['Drama', 'Action'],
    synopsis: "The king's most loyal warrior finds his loyalty questioned after refusing to follow a royal decree that conflicts with ancestral customs and his moral conscience."
  },
  'tt17720506': {
    title: 'Black Day',
    year: 2018,
    runtime_minutes: 93,
    genres: ['Drama'],
    synopsis: 'A Youth Corp member, or a corper as Nigerians prefer to call them, arrives at a new locality on their National Youth Service assignment, only to encounter unexpected trials.'
  },
  'tt19115984': {
    title: 'The Hustle Is Real',
    year: 2018,
    runtime_minutes: 89,
    genres: ['Drama', 'Comedy'],
    synopsis: 'The movie explores the diverse and often challenging ways people navigate life, survival, and success in Lagos, focusing on the relentless hustle to make ends meet and achieve ambition in the face of adversity.'
  },
  'tt26759568': {
    title: 'Fair Lady',
    year: 2018,
    runtime_minutes: 105,
    genres: ['Drama', 'Romance'],
    synopsis: "Toun inherits a multibillion-dollar company from her father. She then faces challenges with her family, particularly her mother's relationship with her father and the threats posed by her uncle and his son."
  },
  'tt8346640': {
    title: 'The Plot',
    year: 2018,
    runtime_minutes: null,
    genres: ['Drama', 'Thriller'],
    synopsis: "A woman married to a multi millionaire, is accused of her husband's death and subsequently tried in court, unraveling a web of deceit, greed, and hidden motives."
  },
  'tt27182312': {
    title: 'Heart Trending',
    year: 2018,
    runtime_minutes: null,
    genres: ['Drama', 'Romance'],
    synopsis: 'A contemporary Nigerian romance drama exploring modern relationships, social media culture, and emotional trials among urban young professionals in Lagos.'
  },
  'tt8368458': {
    title: 'Next Door',
    year: 2017,
    runtime_minutes: null,
    genres: ['Drama', 'Comedy'],
    synopsis: 'An honest and hardworking taxi driver finds a huge sum of money in his taxi and not trusting his roommate with the money hides it with the next door neighbor, triggering comical complications.'
  },
  'tt6783708': {
    title: '25th Birthday',
    year: 2016,
    runtime_minutes: 70,
    genres: ['Drama'],
    synopsis: 'A young man preparing to celebrate his milestone 25th birthday finds his friendships, romances, and future challenged by hidden secrets and unexpected revelations.'
  },
  'tt8367562': {
    title: 'Hotel Choco',
    year: 2016,
    runtime_minutes: null,
    genres: ['Drama'],
    synopsis: 'Two sisters living in the water slums in Lagos jump at the opportunity to go to the city after repeated misfortune, however when they reach their destination further misfortune awaits.'
  },
  'tt40331387': {
    title: 'Rumuokani',
    year: 2013,
    runtime_minutes: null,
    genres: ['Drama'],
    synopsis: 'An epic Nollywood communal drama delving into tradition, chieftaincy succession, and betrayal within an ancient Niger Delta kingdom.'
  }
};

function parseCreditsMarkdown(md) {
  const credits = [];
  const lines = md.split('\n').map(l => l.trim()).filter(Boolean);
  let currentCategory = 'Cast';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    const catMatch = line.match(/\[\*\*([^*]+)\*\*\]/) || line.match(/^##\s+([A-Za-z\s&]+)$/);
    if (catMatch) {
      const cat = catMatch[1].trim();
      if (['Director', 'Directors', 'Writer', 'Writers', 'Cast', 'Producer', 'Producers', 'Cinematographer', 'Cinematographers', 'Composer', 'Music by', 'Editor', 'Film Editing by', 'Production Designer'].some(c => cat.toLowerCase().includes(c.toLowerCase()))) {
        currentCategory = cat;
        continue;
      }
    }

    const personMatch = line.match(/\[([^\]]+)\]\(https:\/\/www\.imdb\.com\/name\/(nm\d+)\/[^)]*\)/);
    if (personMatch) {
      const rawName = personMatch[1].trim();
      const nmId = personMatch[2];

      if (rawName.startsWith('Go to ') || rawName.startsWith('See ') || rawName.startsWith('Learn ') || rawName.includes('IMDbPro') || rawName.includes('Back') || rawName.includes('Edit')) {
        continue;
      }

      let characterName = null;
      if (currentCategory.toLowerCase().includes('cast')) {
        for (let j = 1; j <= 4 && (i + j) < lines.length; j++) {
          const nextLine = lines[i + j];
          const charMatch = nextLine.match(/\[([^\]]+)\]\(https:\/\/www\.imdb\.com\/title\/tt\d+\/characters\/nm\d+[^)]*\)/);
          if (charMatch) {
            characterName = charMatch[1].trim();
            break;
          }
        }
      }

      let role = 'actor';
      const catLower = currentCategory.toLowerCase();
      if (catLower.includes('direct')) role = 'director';
      else if (catLower.includes('writ')) role = 'writer';
      else if (catLower.includes('produc')) role = 'producer';
      else if (catLower.includes('cinema')) role = 'cinematographer';
      else if (catLower.includes('compos') || catLower.includes('music')) role = 'composer';
      else if (catLower.includes('edit')) role = 'editor';

      credits.push({
        name: rawName,
        imdb_id: nmId,
        role,
        character_name: characterName
      });
    }
  }

  // Deduplicate
  const seen = new Set();
  const deduped = [];
  for (const c of credits) {
    const key = `${c.name}|${c.imdb_id}|${c.role}|${c.character_name || ''}`;
    if (!seen.has(key)) {
      seen.add(key);
      deduped.push(c);
    }
  }
  return deduped;
}

const localPersonCache = new Map();

async function resolvePeopleBatch(names) {
  const resolved = new Map();
  const missing = [];

  for (const name of names) {
    const key = name.toLowerCase().trim();
    if (localPersonCache.has(key)) {
      resolved.set(name, localPersonCache.get(key));
    } else {
      missing.push(name);
    }
  }

  if (missing.length === 0) return resolved;

  // Search DB for existing people by name
  const uniqueMissing = Array.from(new Set(missing));
  // Query in chunks of 50
  for (let i = 0; i < uniqueMissing.length; i += 50) {
    const chunk = uniqueMissing.slice(i, i + 50);
    const { data: found } = await supabase
      .from('people')
      .select('id, name')
      .in('name', chunk);

    if (found) {
      for (const p of found) {
        localPersonCache.set(p.name.toLowerCase().trim(), p.id);
        resolved.set(p.name, p.id);
      }
    }
  }

  // Find who is still missing
  const toCreate = uniqueMissing.filter(n => !localPersonCache.has(n.toLowerCase().trim()));
  if (toCreate.length > 0) {
    const insertPayload = toCreate.map(n => ({
      name: n,
      slug: slugify(n) + '-' + Math.floor(Math.random() * 899 + 100),
      nationality: 'Nigerian',
      source: 'imdb',
      is_verified: true
    }));

    const { data: created, error } = await supabase
      .from('people')
      .insert(insertPayload)
      .select('id, name');

    if (error) {
      // Create one by one
      for (const n of toCreate) {
        const altSlug = slugify(n) + '-' + Date.now().toString().slice(-4) + Math.floor(Math.random() * 99);
        const { data: singleP } = await supabase
          .from('people')
          .insert({
            name: n,
            slug: altSlug,
            nationality: 'Nigerian',
            source: 'imdb',
            is_verified: true
          })
          .select('id')
          .single();
        if (singleP) {
          localPersonCache.set(n.toLowerCase().trim(), singleP.id);
          resolved.set(n, singleP.id);
        }
      }
    } else if (created) {
      for (const p of created) {
        localPersonCache.set(p.name.toLowerCase().trim(), p.id);
        resolved.set(p.name, p.id);
      }
    }
  }

  return resolved;
}

async function main() {
  console.log('================================================================');
  console.log('🚀 ENRICHING EDWARD UKA & COMPLETE FILMOGRAPHY WITH ENSEMBLES');
  console.log('================================================================');

  // 1. Create or update Edward Uka in `people`
  console.log('\n👤 Ensuring Edward Uka in `people` table...');
  let edwardId = null;

  const { data: existingEdward } = await supabase
    .from('people')
    .select('id, name')
    .or('name.ilike.Edward Uka,name.ilike.Eddy Bongo Uka')
    .maybeSingle();

  const edwardBio = "Edward Uka (also credited as Eddy Bongo Uka) is a prominent Nigerian film director, screenwriter, and producer working actively in Nollywood. Known for directing compelling dramatic features and television productions, his notable directorial credits include the historical drama Andauotu (2021), King Mabutu (2023), Kuvana (2019), Black Day (2018), The Hustle Is Real (2018, co-directed with Uche Jombo), Hotel Choco (2016), Next Door (2017), Fair Lady (2018), and Rumuokani (2013). Renowned for his versatility behind the camera, he has collaborated with premier Nollywood talent including Uche Jombo, Eucharia Anunobi, Jibola Dabo, Tamara Eteimo, and Olaniyi Afonja.";

  if (existingEdward) {
    edwardId = existingEdward.id;
    await supabase.from('people').update({
      name: 'Edward Uka',
      bio: edwardBio,
      nationality: 'Nigerian',
      gender: 'male',
      known_for_department: 'Directing',
      source: 'imdb',
      is_verified: true,
      updated_at: new Date().toISOString()
    }).eq('id', edwardId);
    console.log(`  ✅ Updated existing Edward Uka [${edwardId}]`);
  } else {
    const { data: createdEdward, error: cErr } = await supabase
      .from('people')
      .insert({
        name: 'Edward Uka',
        slug: 'edward-uka',
        bio: edwardBio,
        nationality: 'Nigerian',
        gender: 'male',
        known_for_department: 'Directing',
        source: 'imdb',
        is_verified: true
      })
      .select('id')
      .single();

    if (cErr) {
      console.error('  ❌ Error creating Edward Uka:', cErr);
      return;
    }
    edwardId = createdEdward.id;
    console.log(`  ✅ Created new Edward Uka [${edwardId}]`);
  }

  localPersonCache.set('edward uka', edwardId);
  localPersonCache.set('eddy bongo uka', edwardId);

  // 2. Process all 13 titles
  const tts = Object.keys(TITLES_METADATA);
  console.log(`\n🎬 Syncing ${tts.length} titles for Edward Uka...`);

  let totalCreditsInserted = 0;

  for (let i = 0; i < tts.length; i++) {
    const tt = tts[i];
    const meta = TITLES_METADATA[tt];

    // Read title overview JSON for poster
    let posterUrl = null;
    const titleFile = `scratch/title_${tt}.json`;
    if (fs.existsSync(titleFile)) {
      const obj = JSON.parse(fs.readFileSync(titleFile));
      if (obj.metadata?.ogImage && !obj.metadata.ogImage.includes('imdb_logo')) {
        posterUrl = obj.metadata.ogImage;
      }
      if (!posterUrl) {
        const pMatch = (obj.markdown || '').match(/!\[.*?\]\((https:\/\/m\.media-amazon\.com\/images\/M\/[^)]+)\)/);
        if (pMatch) posterUrl = pMatch[1];
      }
    }

    // Read full credits JSON
    let ensemble = [];
    const creditsFile = `scratch/credits_${tt}.json`;
    if (fs.existsSync(creditsFile)) {
      const obj = JSON.parse(fs.readFileSync(creditsFile));
      ensemble = parseCreditsMarkdown(obj.markdown || '');
    }

    console.log(`\n[${i + 1}/${tts.length}] "${meta.title}" (${meta.year}) [${tt}] - ${ensemble.length} ensemble members`);

    // A. Check if film exists
    let filmId = null;

    const { data: byImdb } = await supabase
      .from('films')
      .select('id, title, year, poster_url, synopsis, runtime_minutes')
      .eq('imdb_id', tt)
      .maybeSingle();

    if (byImdb) {
      filmId = byImdb.id;
      await supabase.from('films').update({
        is_nollywood: true,
        countries: ['Nigeria'],
        ...(posterUrl && !byImdb.poster_url ? { poster_url: posterUrl } : {}),
        ...(meta.synopsis && (!byImdb.synopsis || byImdb.synopsis.length < 20) ? { synopsis: meta.synopsis } : {}),
        ...(meta.runtime_minutes && !byImdb.runtime_minutes ? { runtime_minutes: meta.runtime_minutes } : {}),
        ...(meta.genres ? { genres: meta.genres } : {}),
        ...(meta.year && !byImdb.year ? { year: meta.year } : {})
      }).eq('id', filmId);
      console.log(`  Updated existing film by IMDb ID: ${filmId}`);
    } else {
      const { data: byTitle } = await supabase
        .from('films')
        .select('id, title, year, poster_url, synopsis, runtime_minutes')
        .ilike('title', meta.title)
        .limit(1);

      if (byTitle && byTitle.length > 0) {
        filmId = byTitle[0].id;
        await supabase.from('films').update({
          imdb_id: tt,
          year: meta.year,
          is_nollywood: true,
          countries: ['Nigeria'],
          genres: meta.genres,
          ...(posterUrl && !byTitle[0].poster_url ? { poster_url: posterUrl } : {}),
          ...(meta.synopsis && (!byTitle[0].synopsis || byTitle[0].synopsis.length < 20) ? { synopsis: meta.synopsis } : {}),
          ...(meta.runtime_minutes && !byTitle[0].runtime_minutes ? { runtime_minutes: meta.runtime_minutes } : {})
        }).eq('id', filmId);
        console.log(`  Linked existing film by Title: ${filmId}`);
      } else {
        const baseSlug = slugify(meta.title) + (meta.year ? `-${meta.year}` : '');
        const { data: newF, error: nErr } = await supabase
          .from('films')
          .insert({
            title: meta.title,
            year: meta.year,
            imdb_id: tt,
            content_type: 'feature_film',
            synopsis: meta.synopsis,
            runtime_minutes: meta.runtime_minutes,
            genres: meta.genres,
            poster_url: posterUrl,
            is_nollywood: true,
            countries: ['Nigeria'],
            source: 'imdb',
            slug: baseSlug
          })
          .select('id')
          .single();

        if (nErr) {
          const altSlug = `${baseSlug}-${Math.floor(Math.random() * 899 + 100)}`;
          const { data: retryF, error: rErr } = await supabase
            .from('films')
            .insert({
              title: meta.title,
              year: meta.year,
              imdb_id: tt,
              content_type: 'feature_film',
              synopsis: meta.synopsis,
              runtime_minutes: meta.runtime_minutes,
              genres: meta.genres,
              poster_url: posterUrl,
              is_nollywood: true,
              countries: ['Nigeria'],
              source: 'imdb',
              slug: altSlug
            })
            .select('id')
            .single();

          if (rErr) {
            console.error(`  ❌ Failed to create film "${meta.title}":`, rErr.message);
            continue;
          }
          filmId = retryF.id;
        } else {
          filmId = newF.id;
        }
        console.log(`  Created new film: ${filmId}`);
      }
    }

    // B. Fetch existing credits for this film
    const { data: existingCredits } = await supabase
      .from('credits')
      .select('person_id, role, character_name')
      .eq('film_id', filmId);

    const existingSet = new Set(
      (existingCredits || []).map(c => `${c.person_id}|${c.role}|${c.character_name || ''}`)
    );

    // C. Ensure Edward Uka himself is in ensemble
    let edwardInEnsemble = ensemble.some(e => e.name.toLowerCase().includes('edward uka') || e.name.toLowerCase().includes('eddy bongo'));
    if (!edwardInEnsemble) {
      ensemble.unshift({
        name: 'Edward Uka',
        role: 'director',
        character_name: null
      });
    }

    // Specific writer check for Edward Uka
    const WRITER_TITLES = ['tt21352098', 'tt10073630', 'tt17720506', 'tt19115984', 'tt8346640', 'tt8367562', 'tt40331387'];
    if (WRITER_TITLES.includes(tt)) {
      const hasWriter = ensemble.some(e => (e.name.toLowerCase().includes('edward uka') || e.name.toLowerCase().includes('eddy bongo')) && e.role === 'writer');
      if (!hasWriter) {
        ensemble.push({
          name: 'Edward Uka',
          role: 'writer',
          character_name: null
        });
      }
    }

    // Specific actor check for Kuvana (King Zer)
    if (tt === 'tt10073630') {
      const hasActor = ensemble.some(e => (e.name.toLowerCase().includes('edward uka') || e.name.toLowerCase().includes('eddy bongo')) && e.role === 'actor');
      if (!hasActor) {
        ensemble.push({
          name: 'Edward Uka',
          role: 'actor',
          character_name: 'King Zer'
        });
      }
    }

    // Resolve all people names in this film
    const memberNames = ensemble.map(m => m.name);
    const resolvedPeople = await resolvePeopleBatch(memberNames);

    const creditsToInsert = [];
    for (const member of ensemble) {
      let pId = null;
      if (member.name.toLowerCase().includes('edward uka') || member.name.toLowerCase().includes('eddy bongo')) {
        pId = edwardId;
      } else {
        pId = resolvedPeople.get(member.name);
      }

      if (!pId) continue;

      const credKey = `${pId}|${member.role}|${member.character_name || ''}`;
      if (!existingSet.has(credKey)) {
        existingSet.add(credKey);
        creditsToInsert.push({
          film_id: filmId,
          person_id: pId,
          role: member.role,
          character_name: member.character_name
        });
      }
    }

    if (creditsToInsert.length > 0) {
      const { error: insErr } = await supabase
        .from('credits')
        .insert(creditsToInsert);

      if (insErr) {
        console.warn(`  ⚠️ Bulk insert error, inserting one by one:`, insErr.message);
        for (const c of creditsToInsert) {
          await supabase.from('credits').insert(c);
        }
      }
      totalCreditsInserted += creditsToInsert.length;
      console.log(`  ✅ Added ${creditsToInsert.length} credits (Total ensemble for film: ${existingSet.size})`);
    } else {
      console.log(`  All ${existingSet.size} credits already in place.`);
    }
  }

  // 3. Update Edward Uka film count
  const { data: distinctFilms } = await supabase
    .from('credits')
    .select('film_id')
    .eq('person_id', edwardId);
  const uniqueFilmIds = new Set((distinctFilms || []).map(d => d.film_id));

  await supabase
    .from('people')
    .update({ film_count: uniqueFilmIds.size })
    .eq('id', edwardId);

  console.log('\n================================================================');
  console.log(`🎉 SYNC COMPLETE!`);
  console.log(`👤 Edward Uka Verified Film Count: ${uniqueFilmIds.size}`);
  console.log(`⭐ Total New Credits Inserted Across All Films: ${totalCreditsInserted}`);
  console.log('================================================================');
}

main().catch(console.error);
