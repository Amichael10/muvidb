const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const { createClient } = require('@supabase/supabase-js');

const envLocal = fs.existsSync('.env.local') ? dotenv.parse(fs.readFileSync('.env.local')) : {};
const env = fs.existsSync('.env') ? dotenv.parse(fs.readFileSync('.env')) : {};
const all = { ...env, ...envLocal };

const supabase = createClient(all.VITE_SUPABASE_URL || all.SUPABASE_URL, all.SUPABASE_SERVICE_ROLE_KEY);

const ZYNNELL_PERSON_ID = '908589d5-b65b-4c51-9faa-1c7cf9533110';
const ZYNNELL_NM_ID = 'nm5931748';

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
  'zynnell zuh': 'Zynnell Zuh',
  'zynell zuh': 'Zynnell Zuh',
  'zynel lydia': 'Zynnell Zuh',
  'zynnell lydia zuh': 'Zynnell Zuh',
  'zynel lydia zuh': 'Zynnell Zuh',
  'chris attoh': 'Chris Attoh',
  'juliet ibrahim': 'Juliet Ibrahim',
  'kate henshaw': 'Kate Henshaw',
  'kate henshaw-nuttal': 'Kate Henshaw',
  'john dumelo': 'John Dumelo',
  'majid michel': 'Majid Michel',
  'yvonne nelson': 'Yvonne Nelson',
  'nadia buari': 'Nadia Buari',
  'ramsey nouah': 'Ramsey Nouah',
  'jim iyke': 'Jim Iyke',
  'blossom chukwujekwu': 'Blossom Chukwujekwu',
  'kofi adjorlolo': 'Kofi Adjorlolo',
  'gloria osei sarfo': 'Gloria Sarfo',
  'pascal amanfo': 'Pascal Amanfo',
  'frank rajah aras': 'Frank Rajah Aras',
  'shirley frimpong-manso': 'Shirley Frimpong-Manso'
};

function normalizeName(name) {
  const clean = name.replace(/\s+/g, ' ').trim();
  const lower = clean.toLowerCase();
  if (ALIAS_MAP[lower]) return ALIAS_MAP[lower];
  return clean;
}

function isZynnell(name, nmId) {
  if (nmId === ZYNNELL_NM_ID) return true;
  const norm = normalizeName(name).toLowerCase();
  return (
    norm === 'zynnell zuh' ||
    norm === 'zynell zuh' ||
    norm === 'zynel lydia' ||
    norm === 'zynnell lydia zuh' ||
    norm === 'zynel lydia zuh'
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
            characterName = charMatch[1].trim();
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
  // Ensure Zynnell Zuh is mapped
  personCache.set('zynnell zuh', ZYNNELL_PERSON_ID);
  personCache.set('zynnell-zuh', ZYNNELL_PERSON_ID);
  personCache.set('zynell zuh', ZYNNELL_PERSON_ID);
  personCache.set('zynel lydia', ZYNNELL_PERSON_ID);
  personCache.set('zynnell lydia zuh', ZYNNELL_PERSON_ID);
  console.log(`  Cached ${personCache.size} existing people identifiers.`);
}

async function bulkResolvePeople(names) {
  const resolved = new Map();
  const toInsert = [];

  for (const name of names) {
    const key = name.toLowerCase().trim();
    if (isZynnell(name, '')) {
      resolved.set(name, ZYNNELL_PERSON_ID);
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

async function syncAllZynnellTitles() {
  await preloadExistingPeople();

  const zynnellTitles = JSON.parse(fs.readFileSync('scratch/zynnell_clean_titles.json'));
  console.log(`🎬 Syncing ${zynnellTitles.length} Zynnell Zuh titles with complete filmography & ensembles...`);

  let filmsCreated = 0;
  let filmsUpdated = 0;
  let creditsAddedTotal = 0;
  const touchedPersonIds = new Set([ZYNNELL_PERSON_ID]);

  for (let i = 0; i < zynnellTitles.length; i++) {
    const t = zynnellTitles[i];
    const tt = t.imdbId;
    console.log(`\n[${i + 1}/${zynnellTitles.length}] Processing ${tt}: "${t.cleanTitle}" (${t.year || 'N/A'})...`);

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
        poster_url: genuinePoster // Genuine or null
      };
      if (!existingByImdb.synopsis && t.synopsis) updates.synopsis = t.synopsis;
      if (filmYear && !existingByImdb.year) updates.year = filmYear;
      await supabase.from('films').update(updates).eq('id', filmId);
      filmsUpdated++;
    } else {
      const { data: existingByTitle } = await supabase
        .from('films')
        .select('id, title, year, poster_url, synopsis, imdb_id')
        .ilike('title', t.cleanTitle)
        .limit(2);

      const matched = (existingByTitle || []).find(f => !filmYear || !f.year || f.year === filmYear);
      if (matched) {
        filmId = matched.id;
        const updates = {
          imdb_id: tt,
          is_nollywood: true,
          poster_url: genuinePoster
        };
        if (!matched.synopsis && t.synopsis) updates.synopsis = t.synopsis;
        if (filmYear && !matched.year) updates.year = filmYear;
        await supabase.from('films').update(updates).eq('id', filmId);
        filmsUpdated++;
      } else {
        const baseSlug = slugify(t.cleanTitle) + (filmYear ? `-${filmYear}` : '');
        let newSlug = baseSlug;
        const contentType = (t.titleType === 'TV Series' || t.titleType === 'TV Mini Series') ? 'series' : 'movie';

        const { data: newFilm, error } = await supabase
          .from('films')
          .insert({
            title: t.cleanTitle,
            year: filmYear,
            imdb_id: tt,
            synopsis: t.synopsis,
            poster_url: genuinePoster,
            content_type: contentType,
            is_nollywood: true,
            countries: ['Ghana', 'Nigeria'],
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
              title: t.cleanTitle,
              year: filmYear,
              imdb_id: tt,
              synopsis: t.synopsis,
              poster_url: genuinePoster,
              content_type: contentType,
              is_nollywood: true,
              countries: ['Ghana', 'Nigeria'],
              source: 'imdb',
              slug: newSlug
            })
            .select('id')
            .single();

          if (retryErr) {
            console.error(`  ❌ Failed to create film "${t.cleanTitle}":`, retryErr.message);
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

    // 2. Ensure Zynnell Zuh's credits are present
    const zynnellInEnsemble = ensemble.filter(e => isZynnell(e.name, e.nmId));
    if (zynnellInEnsemble.length === 0) {
      ensemble.unshift({
        nmId: ZYNNELL_NM_ID,
        name: 'Zynnell Zuh',
        role: t.role || 'actor',
        characterName: t.character || null
      });
    } else {
      for (const ze of zynnellInEnsemble) {
        ze.name = 'Zynnell Zuh';
        if (!ze.characterName && t.character && ze.role === 'actor') {
          ze.characterName = t.character;
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
      const pId = isZynnell(mem.name, mem.nmId) ? ZYNNELL_PERSON_ID : resolvedPeople.get(mem.name);
      if (!pId) continue;

      touchedPersonIds.add(pId);
      const creditKey = `${pId}|${mem.role.toLowerCase()}`;
      if (!creditSet.has(creditKey)) {
        creditSet.add(creditKey);
        toInsertCredits.push({
          film_id: filmId,
          person_id: pId,
          role: mem.role,
          character_name: mem.characterName || null,
          billing_order: b + 1,
          source: 'imdb'
        });
      }
    }

    if (toInsertCredits.length > 0) {
      const { error: credErr } = await supabase.from('credits').insert(toInsertCredits);
      if (credErr) {
        console.error(`  ⚠️ Credits insert error for ${t.cleanTitle}:`, credErr.message);
      } else {
        creditsAddedTotal += toInsertCredits.length;
        console.log(`  ✅ Added ${toInsertCredits.length} credits (Film now has ${creditSet.size} credits)`);
      }
    } else {
      console.log(`  👌 All ${creditSet.size} credits already present.`);
    }
  }

  console.log(`\n======================================================`);
  console.log(`🎉 Films & Credits Sync Complete for Zynnell Zuh!`);
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

syncAllZynnellTitles().catch(console.error);
