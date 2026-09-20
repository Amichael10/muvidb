const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const { createClient } = require('@supabase/supabase-js');

const envLocal = fs.existsSync('.env.local') ? dotenv.parse(fs.readFileSync('.env.local')) : {};
const env = fs.existsSync('.env') ? dotenv.parse(fs.readFileSync('.env')) : {};
const all = { ...env, ...envLocal };

const supabase = createClient(all.VITE_SUPABASE_URL || all.SUPABASE_URL, all.SUPABASE_SERVICE_ROLE_KEY);

const SOLA_PERSON_ID = '49e94e57-7990-47fc-9867-23209b5011ed';
const SOLA_NM_ID = 'nm2535409';

function slugify(text) {
  const s = text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w\-]+/g, '')
    .replace(/\-\-+/g, '-');
  return s || ('person-' + Math.floor(Math.random() * 10000));
}

const ALIAS_MAP = {
  'sola kosoko': 'Sola Kosoko',
  'shola kosoko': 'Sola Kosoko',
  'sola kosoko-abina': 'Sola Kosoko',
  'shola kosoko abina': 'Sola Kosoko',
  'sola kosoko abinna': 'Sola Kosoko',
  'shola kosoko-abinna': 'Sola Kosoko',
  'jide kosoko': 'Jide Kosoko',
  'prince jide kosoko': 'Jide Kosoko',
  'bidemi kosoko': 'Bidemi Kosoko',
  'henrieta kosoko': 'Henrieta Kosoko',
  'henrietta kosoko': 'Henrieta Kosoko',
  'adebayo salami': 'Adebayo Salami',
  'oga bello': 'Adebayo Salami',
  'femi adebayo': 'Femi Adebayo',
  'odunlade adekola': 'Odunlade Adekola',
  'taiwo hassan': 'Taiwo Hassan',
  'ogogo': 'Taiwo Hassan',
  'yinka quadri': 'Yinka Quadri',
  'saheed balogun': 'Saidi Balogun',
  'saidi balogun': 'Saidi Balogun',
  'faithia balogun': 'Faithia Williams',
  'faithia williams': 'Faithia Williams',
  'mercy aigbe': 'Mercy Aigbe',
  'iyabo ojo': 'Iyabo Ojo',
  'toyin aimakhu': 'Toyin Abraham',
  'toyin abraham': 'Toyin Abraham',
  'sunday omobolanle': 'Sunday Omobolanle',
  'papi luwe': 'Sunday Omobolanle',
  'aluwe': 'Sunday Omobolanle',
  'peju ogunmola': 'Peju Ogunmola',
  'bimbo oshin': 'Bimbo Oshin',
  'ronke ojo': 'Ronke Ojo',
  'ronke oshodi oke': 'Ronke Ojo',
  'lanre hassan': 'Lanre Hassan',
  'iya awero': 'Lanre Hassan',
  'idowu philips': 'Idowu Philips',
  'iya rainbow': 'Idowu Philips',
  'babatunde omidina': 'Babatunde Omidina',
  'baba suwe': 'Babatunde Omidina',
  'bolaji amusan': 'Bolaji Amusan',
  'mr latin': 'Bolaji Amusan'
};

function normalizeName(name) {
  const clean = name.replace(/\s+/g, ' ').trim();
  const lower = clean.toLowerCase();
  if (ALIAS_MAP[lower]) return ALIAS_MAP[lower];
  return clean;
}

function isSola(name, nmId) {
  if (nmId === SOLA_NM_ID) return true;
  const norm = normalizeName(name).toLowerCase();
  return (
    norm === 'sola kosoko' ||
    norm === 'shola kosoko' ||
    norm === 'sola kosoko-abina' ||
    norm === 'shola kosoko abina' ||
    norm === 'sola kosoko abinna' ||
    norm === 'shola kosoko-abinna'
  );
}

// Strict poster rule: Genuine movie posters only; if missing or default IMDb thumbnail, leave null (bland)
function extractPoster(credData) {
  if (!credData) return null;
  const ogImage = credData.metadata ? (credData.metadata['og:image'] || credData.metadata['ogImage']) : null;
  if (
    ogImage &&
    ogImage.includes('/images/M/') &&
    !ogImage.includes('imdb_logo') &&
    !ogImage.includes('nopicture') &&
    !ogImage.includes('title-poster') &&
    !ogImage.includes('/images/G/')
  ) {
    return ogImage;
  }
  return null;
}

function cleanCharacter(char) {
  if (!char) return null;
  const c = char.trim();
  if (c.startsWith('![') || c.includes('media-amazon.com') || c.match(/^\d+h\s*\d*m?$/) || c.match(/^\d+m$/)) {
    return null;
  }
  return c;
}

function parseCreditsMarkdown(md) {
  const credits = [];
  const lines = md.split('\n').map(l => l.trim()).filter(Boolean);
  let currentCategory = 'Cast';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    const catMatch = line.match(/\[\*\*([^*]+)\*\*\]/) || line.match(/^##\s+([A-Za-z\s&]+)$/);
    if (catMatch) {
      const cat = catMatch[1].trim();
      if (['Director', 'Directors', 'Writer', 'Writers', 'Cast', 'Producer', 'Producers', 'Cinematographer', 'Cinematographers', 'Composer', 'Composers', 'Editor', 'Editors', 'Production Designer', 'Production Management', 'Costume Designer'].some(c => cat.toLowerCase().startsWith(c.toLowerCase()))) {
        currentCategory = cat;
        continue;
      }
    }

    const personMatch = line.match(/\[([^\]]+)\]\(https:\/\/www\.imdb\.com\/name\/(nm\d+)\/[^)]*\)/);
    if (personMatch) {
      const rawName = personMatch[1].trim();
      const nmId = personMatch[2];

      if (rawName.startsWith('Go to ') || rawName.startsWith('See ') || rawName.startsWith('Learn ') || rawName.includes('IMDbPro') || rawName.includes('topics')) {
        continue;
      }

      let characterName = null;
      if (currentCategory.toLowerCase().includes('cast')) {
        for (let j = 1; j <= 4 && (i + j) < lines.length; j++) {
          const nextLine = lines[i + j];
          const charMatch = nextLine.match(/\[([^\]]+)\]\(https:\/\/www\.imdb\.com\/title\/tt\d+\/characters\/nm\d+[^)]*\)/);
          if (charMatch) {
            characterName = cleanCharacter(charMatch[1]);
            break;
          }
        }
      }

      let role = 'actor';
      const catLow = currentCategory.toLowerCase();
      if (catLow.includes('director')) role = 'director';
      else if (catLow.includes('writer')) role = 'writer';
      else if (catLow.includes('producer')) role = 'producer';
      else if (catLow.includes('cinematographer')) role = 'cinematographer';
      else if (catLow.includes('composer')) role = 'composer';
      else if (catLow.includes('editor')) role = 'editor';
      else if (catLow.includes('production designer')) role = 'production_designer';
      else if (catLow.includes('production management')) role = 'producer';
      else if (catLow.includes('costume designer')) role = 'costume_designer';

      const norm = normalizeName(rawName);
      const existing = credits.find(c => (c.nmId === nmId || c.name.toLowerCase() === norm.toLowerCase()) && c.role === role);
      if (!existing) {
        credits.push({
          nmId,
          name: norm,
          role,
          characterName: characterName || null
        });
      }
    }
  }

  return credits;
}

const personCache = new Map();

async function preloadExistingPeople() {
  console.log('⚡ Preloading all existing people from DB into memory cache...');
  let offset = 0;
  const pageSize = 1000;
  while (true) {
    const { data, error } = await supabase
      .from('people')
      .select('id, name, slug')
      .range(offset, offset + pageSize - 1);
    if (error || !data || data.length === 0) break;
    for (const p of data) {
      if (p.name) personCache.set(p.name.toLowerCase().trim(), p.id);
      if (p.slug) personCache.set(p.slug.toLowerCase().trim(), p.id);
    }
    if (data.length < pageSize) break;
    offset += pageSize;
  }
  // Ensure Sola Kosoko is mapped
  personCache.set('sola kosoko', SOLA_PERSON_ID);
  personCache.set('sola-kosoko', SOLA_PERSON_ID);
  personCache.set('shola kosoko', SOLA_PERSON_ID);
  personCache.set('sola kosoko-abina', SOLA_PERSON_ID);
  personCache.set('shola kosoko abina', SOLA_PERSON_ID);
  console.log(`  Cached ${personCache.size} existing people identifiers.`);
}

async function bulkResolvePeople(names) {
  const resolved = new Map();
  const toInsert = [];

  for (const name of names) {
    const key = name.toLowerCase().trim();
    if (isSola(name, '')) {
      resolved.set(name, SOLA_PERSON_ID);
      continue;
    }
    if (personCache.has(key)) {
      resolved.set(name, personCache.get(key));
    } else {
      toInsert.push(name);
    }
  }

  if (toInsert.length > 0) {
    const uniqueToInsert = Array.from(new Set(toInsert));
    const insertPayload = uniqueToInsert.map(n => {
      const slug = slugify(n) + '-' + Math.floor(Math.random() * 8999 + 1000);
      return {
        name: n,
        slug,
        source: 'imdb',
        is_verified: true
      };
    });

    const { data: inserted, error } = await supabase
      .from('people')
      .insert(insertPayload)
      .select('id, name');

    if (error) {
      for (const n of uniqueToInsert) {
        const slug = slugify(n) + '-' + Date.now().toString().slice(-4) + Math.floor(Math.random() * 99);
        const { data: singleP } = await supabase
          .from('people')
          .insert({ name: n, slug, source: 'imdb', is_verified: true })
          .select('id')
          .single();
        if (singleP) {
          personCache.set(n.toLowerCase().trim(), singleP.id);
          resolved.set(n, singleP.id);
        }
      }
    } else if (inserted) {
      for (const p of inserted) {
        personCache.set(p.name.toLowerCase().trim(), p.id);
        resolved.set(p.name, p.id);
      }
    }
  }

  return resolved;
}

async function syncAllSolaTitles() {
  await preloadExistingPeople();

  const solaTitles = JSON.parse(fs.readFileSync('scratch/all_sola_titles.json'));
  console.log(`🎬 Syncing ${solaTitles.length} Sola Kosoko titles with complete filmography & ensembles...`);

  let filmsCreated = 0;
  let filmsUpdated = 0;
  let creditsAddedTotal = 0;
  const touchedPersonIds = new Set([SOLA_PERSON_ID]);

  for (let i = 0; i < solaTitles.length; i++) {
    const t = solaTitles[i];
    const tt = t.imdbId;
    console.log(`\n[${i + 1}/${solaTitles.length}] Processing ${tt}: "${t.title}" (${t.year || 'N/A'})...`);

    // Parse fullcredits file
    const creditsFile = `scratch/credits_${tt}.json`;
    let md = '';
    let ensemble = [];
    let credData = null;
    if (fs.existsSync(creditsFile)) {
      try {
        credData = JSON.parse(fs.readFileSync(creditsFile));
        md = credData.markdown || '';
        ensemble = parseCreditsMarkdown(md);
      } catch (err) {
        console.warn(`  ⚠️ Error parsing credits file for ${tt}:`, err.message);
      }
    }

    // Determine Year if missing
    let filmYear = t.year;
    if (!filmYear && credData?.metadata?.title) {
      const ym = credData.metadata.title.match(/\b(19\d\d|20\d\d)\b/);
      if (ym) filmYear = parseInt(ym[1], 10);
    }

    // Determine Poster URL: Only genuine posters; otherwise NULL (leaving it bland for Lumi default thumbnail)
    const genuinePoster = extractPoster(credData);
    console.log(`  Year: ${filmYear || 'N/A'} | Poster: ${genuinePoster ? 'GENUINE (' + genuinePoster.slice(0, 50) + '...)' : 'BLAND (null - Lumi thumbnail)'}`);

    // 1. Resolve or Create Film
    let filmId = null;
    const { data: existingByImdb } = await supabase
      .from('films')
      .select('id, title, year, poster_url, synopsis, imdb_id')
      .eq('imdb_id', tt)
      .maybeSingle();

    if (existingByImdb) {
      filmId = existingByImdb.id;
      const updates = {
        is_nollywood: true,
        poster_url: genuinePoster
      };
      if (!existingByImdb.synopsis && t.synopsis) updates.synopsis = t.synopsis;
      if (filmYear && !existingByImdb.year) updates.year = filmYear;
      await supabase.from('films').update(updates).eq('id', filmId);
      filmsUpdated++;
    } else {
      const { data: existingByTitle } = await supabase
        .from('films')
        .select('id, title, year, poster_url, synopsis, imdb_id')
        .ilike('title', t.title)
        .limit(2);

      const matched = (existingByTitle || []).find(f => !filmYear || !f.year || f.year === filmYear);
      if (matched) {
        filmId = matched.id;
        const updates = {
          imdb_id: tt,
          is_nollywood: true,
          countries: ['Nigeria'],
          poster_url: genuinePoster
        };
        if (!matched.synopsis && t.synopsis) updates.synopsis = t.synopsis;
        if (filmYear && !matched.year) updates.year = filmYear;
        await supabase.from('films').update(updates).eq('id', filmId);
        filmsUpdated++;
      } else {
        const baseSlug = slugify(t.title) + (filmYear ? `-${filmYear}` : '');
        let newSlug = baseSlug;
        const contentType = (t.titleType === 'TV Series' || t.titleType === 'TV Mini Series') ? 'series' : 'movie';

        const { data: newFilm, error } = await supabase
          .from('films')
          .insert({
            title: t.title,
            year: filmYear,
            imdb_id: tt,
            synopsis: t.synopsis,
            poster_url: genuinePoster,
            content_type: contentType,
            is_nollywood: true,
            countries: ['Nigeria'],
            source: 'imdb',
            slug: newSlug
          })
          .select('id')
          .single();

        if (error) {
          newSlug = `${baseSlug}-${Math.floor(Math.random() * 8999 + 1000)}`;
          const { data: retryFilm, error: retryErr } = await supabase
            .from('films')
            .insert({
              title: t.title,
              year: filmYear,
              imdb_id: tt,
              synopsis: t.synopsis,
              poster_url: genuinePoster,
              content_type: contentType,
              is_nollywood: true,
              countries: ['Nigeria'],
              source: 'imdb',
              slug: newSlug
            })
            .select('id')
            .single();

          if (retryErr) {
            console.error(`  ❌ Failed to create film "${t.title}":`, retryErr.message);
            continue;
          }
          filmId = retryFilm.id;
        } else {
          filmId = newFilm.id;
        }
        filmsCreated++;
      }
    }

    if (!filmId) continue;

    // 2. Ensure Sola Kosoko's credits are present
    const solaInEnsemble = ensemble.filter(e => isSola(e.name, e.nmId));
    const cleanTChar = cleanCharacter(t.character);
    if (solaInEnsemble.length === 0) {
      ensemble.unshift({
        nmId: SOLA_NM_ID,
        name: 'Sola Kosoko',
        role: t.role || 'actor',
        characterName: cleanTChar || null
      });
    } else {
      for (const se of solaInEnsemble) {
        se.name = 'Sola Kosoko';
        if (!se.characterName && cleanTChar && se.role === 'actor') {
          se.characterName = cleanTChar;
        }
      }
    }

    console.log(`  Ensemble members to link: ${ensemble.length}`);

    // 3. Bulk resolve people
    const names = ensemble.map(e => e.name);
    const resolvedPeople = await bulkResolvePeople(names);

    // 4. Fetch existing credits for film
    const { data: existingCredits } = await supabase
      .from('credits')
      .select('person_id, role, character_name')
      .eq('film_id', filmId);

    const creditSet = new Set((existingCredits || []).map(c => `${c.person_id}|${c.role.toLowerCase()}`));

    // 5. Insert missing credits
    const toInsertCredits = [];
    for (let b = 0; b < ensemble.length; b++) {
      const mem = ensemble[b];
      const pId = isSola(mem.name, mem.nmId) ? SOLA_PERSON_ID : resolvedPeople.get(mem.name);
      if (!pId) continue;

      touchedPersonIds.add(pId);
      const creditKey = `${pId}|${mem.role.toLowerCase()}`;
      if (!creditSet.has(creditKey)) {
        creditSet.add(creditKey);
        toInsertCredits.push({
          film_id: filmId,
          person_id: pId,
          role: mem.role,
          character_name: cleanCharacter(mem.characterName) || null,
          billing_order: b + 1,
          source: 'imdb'
        });
      }
    }

    if (toInsertCredits.length > 0) {
      const { error: credErr } = await supabase.from('credits').insert(toInsertCredits);
      if (credErr) {
        console.error(`  ⚠️ Credits insert error for ${t.title}:`, credErr.message);
      } else {
        creditsAddedTotal += toInsertCredits.length;
        console.log(`  ✅ Added ${toInsertCredits.length} credits (Film now has ${creditSet.size} credits)`);
      }
    } else {
      console.log(`  👌 All ${creditSet.size} credits already present.`);
    }
  }

  console.log(`\n======================================================`);
  console.log(`🎉 Films & Credits Sync Complete for Sola Kosoko!`);
  console.log(`Films Created: ${filmsCreated}`);
  console.log(`Films Updated: ${filmsUpdated}`);
  console.log(`Credits Added: ${creditsAddedTotal}`);
  console.log(`Unique People Involved: ${touchedPersonIds.size}`);
  console.log(`======================================================`);

  // 6. Recalculate film_count
  console.log(`\n🔄 Recalculating film_count for ${touchedPersonIds.size} people...`);
  const touchedArr = Array.from(touchedPersonIds);
  for (let i = 0; i < touchedArr.length; i += 50) {
    const batch = touchedArr.slice(i, i + 50);
    await Promise.all(batch.map(async (pId) => {
      try {
        const { count } = await supabase
          .from('credits')
          .select('*', { count: 'exact', head: true })
          .eq('person_id', pId);
        if (count !== null && count !== undefined) {
          await supabase.from('people').update({ film_count: count }).eq('id', pId);
        }
      } catch (err) {}
    }));
  }

  console.log(`\n✨ Done updating film counts!`);
}

syncAllSolaTitles().catch(console.error);
