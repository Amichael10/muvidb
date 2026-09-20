const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const { createClient } = require('@supabase/supabase-js');

const envLocal = fs.existsSync('.env.local') ? dotenv.parse(fs.readFileSync('.env.local')) : {};
const env = fs.existsSync('.env') ? dotenv.parse(fs.readFileSync('.env')) : {};
const all = { ...env, ...envLocal };

const supabase = createClient(all.VITE_SUPABASE_URL || all.SUPABASE_URL, all.SUPABASE_SERVICE_ROLE_KEY);

const OGE_OKOYE_ID = '197f3858-f333-4e10-9cfc-3eeea60c5c0c';
const OGE_NM_ID = 'nm2121456';

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
  'ade-love': 'Adeyemi Afolayan',
  'ade love': 'Adeyemi Afolayan',
  'ajileye olumo charles': 'Charles Olumo',
  'charles olumo': 'Charles Olumo',
  'chief lere paimo': 'Lere Paimo',
  'eda onileola': 'Lere Paimo',
  'sunday omobolanle': 'Sunday Omobolanle',
  'papi luwe': 'Sunday Omobolanle',
  'aluwe': 'Sunday Omobolanle',
  'lasun ray': 'Lasun Ray-Eyiwumi',
  'lasun ray-eyiwumi': 'Lasun Ray-Eyiwumi',
  'muka ray': 'Muka Ray Eyiwumi',
  'muka ray eyiwumi': 'Muka Ray Eyiwumi',
  'mama ray': 'Mama Ray-Eyiwumi',
  'mama ray-eyiwumi': 'Mama Ray-Eyiwumi',
  'abigail eyiwunmi': 'Mama Ray-Eyiwumi',
  'pa ray eyiwunmi': 'Ray Eyiwumi',
  'ray eyiwunmi': 'Ray Eyiwumi',
  'eyitemi afolayan': 'Eyiyemi Afolayan',
  'eyiyemi afolayan': 'Eyiyemi Afolayan',
  'chief jimoh aliu': 'Jimoh Aliu',
  'aworo': 'Jimoh Aliu',
  'baba wande': 'Kareem Adepoju',
  'oga bello': 'Adebayo Salami',
  'baba sala': 'Moses Olaiya',
  'oge okoye': 'Oge Okoye'
};

function normalizeName(name) {
  const clean = name.replace(/\s+/g, ' ').trim();
  const lower = clean.toLowerCase();
  if (ALIAS_MAP[lower]) return ALIAS_MAP[lower];
  return clean;
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
      if (['Director', 'Directors', 'Writer', 'Writers', 'Cast', 'Producer', 'Producers', 'Cinematographer', 'Cinematographers', 'Composer', 'Composers', 'Editor', 'Editors', 'Production Designer'].some(c => cat.toLowerCase().startsWith(c.toLowerCase()))) {
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

      const norm = normalizeName(rawName);
      const existing = credits.find(c => c.nmId === nmId && c.role === role);
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

// In-memory cache for person name -> id
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
      if (p.name) {
        personCache.set(p.name.toLowerCase().trim(), p.id);
      }
      if (p.slug) {
        personCache.set(p.slug.toLowerCase().trim(), p.id);
      }
    }
    if (data.length < pageSize) break;
    offset += pageSize;
  }
  // Ensure Oge Okoye is explicitly mapped
  personCache.set('oge okoye', OGE_OKOYE_ID);
  personCache.set('oge-okoye', OGE_OKOYE_ID);
  console.log(`  Cached ${personCache.size} existing people identifiers.`);
}

async function bulkResolvePeople(names) {
  const resolved = new Map();
  const toInsert = [];

  for (const name of names) {
    const key = name.toLowerCase().trim();
    if (key === 'oge okoye' || key === 'oge-okoye') {
      resolved.set(name, OGE_OKOYE_ID);
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
        nationality: 'Nigerian',
        source: 'imdb',
        is_verified: true
      };
    });

    const { data: inserted, error } = await supabase
      .from('people')
      .insert(insertPayload)
      .select('id, name');

    if (error) {
      // Fallback: one by one
      for (const n of uniqueToInsert) {
        const slug = slugify(n) + '-' + Date.now().toString().slice(-4) + Math.floor(Math.random() * 99);
        const { data: singleP } = await supabase
          .from('people')
          .insert({ name: n, slug, nationality: 'Nigerian', source: 'imdb', is_verified: true })
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

async function syncAllOgeTitles() {
  await preloadExistingPeople();

  const ogeTitles = JSON.parse(fs.readFileSync('scratch/all_oge_titles.json'));
  console.log(`🎬 Syncing ${ogeTitles.length} Oge Okoye titles with complete filmography & ensembles...`);

  let filmsCreated = 0;
  let filmsUpdated = 0;
  let creditsAddedTotal = 0;
  const touchedPersonIds = new Set([OGE_OKOYE_ID]);

  for (let i = 0; i < ogeTitles.length; i++) {
    const t = ogeTitles[i];
    const tt = t.imdbId;
    console.log(`\n[${i + 1}/${ogeTitles.length}] Processing ${tt}: "${t.title}" (${t.year || 'N/A'})...`);

    // 1. Resolve / Create Film
    let filmId = null;
    const { data: existingByImdb } = await supabase
      .from('films')
      .select('id, title, year, poster_url, synopsis, imdb_id')
      .eq('imdb_id', tt)
      .maybeSingle();

    if (existingByImdb) {
      filmId = existingByImdb.id;
      const updates = {};
      if (!existingByImdb.poster_url && t.posterUrl) updates.poster_url = t.posterUrl;
      if (!existingByImdb.synopsis && t.synopsis) updates.synopsis = t.synopsis;
      if (t.year && !existingByImdb.year) updates.year = t.year;
      updates.is_nollywood = true;
      if (Object.keys(updates).length > 0) {
        await supabase.from('films').update(updates).eq('id', filmId);
        filmsUpdated++;
      }
    } else {
      const { data: existingByTitle } = await supabase
        .from('films')
        .select('id, title, year, poster_url, synopsis, imdb_id')
        .ilike('title', t.title)
        .limit(2);

      const matched = (existingByTitle || []).find(f => !t.year || !f.year || f.year === t.year);
      if (matched) {
        filmId = matched.id;
        const updates = {
          imdb_id: tt,
          is_nollywood: true,
          countries: ['Nigeria']
        };
        if (!matched.poster_url && t.posterUrl) updates.poster_url = t.posterUrl;
        if (!matched.synopsis && t.synopsis) updates.synopsis = t.synopsis;
        if (t.year && !matched.year) updates.year = t.year;
        await supabase.from('films').update(updates).eq('id', filmId);
        filmsUpdated++;
      } else {
        const baseSlug = slugify(t.title) + (t.year ? `-${t.year}` : '');
        let newSlug = baseSlug;
        const contentType = (t.titleType === 'TV Series' || t.titleType === 'TV Mini Series') ? 'series' : 'movie';
        
        const { data: newFilm, error } = await supabase
          .from('films')
          .insert({
            title: t.title,
            year: t.year,
            imdb_id: tt,
            synopsis: t.synopsis,
            poster_url: t.posterUrl,
            runtime_minutes: t.runtimeMinutes,
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
              year: t.year,
              imdb_id: tt,
              synopsis: t.synopsis,
              poster_url: t.posterUrl,
              runtime_minutes: t.runtimeMinutes,
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

    if (!filmId) {
      console.warn(`  ⚠️ Could not find or create filmId for ${tt}`);
      continue;
    }

    // 2. Parse Ensemble
    const creditsFile = `scratch/credits_${tt}.json`;
    let ensemble = [];
    if (fs.existsSync(creditsFile)) {
      try {
        const credData = JSON.parse(fs.readFileSync(creditsFile));
        ensemble = parseCreditsMarkdown(credData.markdown || '');
      } catch (err) {
        console.warn(`  ⚠️ Error parsing credits file for ${tt}:`, err.message);
      }
    }

    // 3. Ensure Oge Okoye is in the ensemble
    let ogeInEnsemble = ensemble.find(e => 
      e.nmId === OGE_NM_ID || 
      normalizeName(e.name).toLowerCase() === 'oge okoye'
    );

    if (ogeInEnsemble) {
      if (!ogeInEnsemble.characterName && t.character) {
        ogeInEnsemble.characterName = t.character;
      }
      ogeInEnsemble.name = 'Oge Okoye';
    } else {
      ensemble.unshift({
        nmId: OGE_NM_ID,
        name: 'Oge Okoye',
        role: 'actor',
        characterName: t.character || null
      });
    }

    console.log(`  Ensemble members to link: ${ensemble.length}`);

    // 4. Bulk resolve people
    const names = ensemble.map(e => e.name);
    const resolvedPeople = await bulkResolvePeople(names);

    // 5. Fetch existing credits for film
    const { data: existingCredits } = await supabase
      .from('credits')
      .select('person_id, role, character_name')
      .eq('film_id', filmId);

    const creditSet = new Set((existingCredits || []).map(c => `${c.person_id}|${c.role.toLowerCase()}`));

    // 6. Insert missing credits
    const toInsertCredits = [];
    for (let b = 0; b < ensemble.length; b++) {
      const mem = ensemble[b];
      const pId = resolvedPeople.get(mem.name) || (mem.name === 'Oge Okoye' ? OGE_OKOYE_ID : null);
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
  console.log(`🎉 Films & Credits Sync Phase Complete!`);
  console.log(`Films Created: ${filmsCreated}`);
  console.log(`Films Updated: ${filmsUpdated}`);
  console.log(`Credits Added: ${creditsAddedTotal}`);
  console.log(`Unique People Involved: ${touchedPersonIds.size}`);
  console.log(`======================================================`);

  // 7. Recalculate film_count for touched people
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
      } catch (err) {
        // silent catch
      }
    }));
    if ((i + 50) % 250 === 0 || (i + 50) >= touchedArr.length) {
      console.log(`  Updated film_count for ${Math.min(i + 50, touchedArr.length)}/${touchedArr.length} people...`);
    }
  }

  // 8. Verification query for Oge Okoye
  const { data: ogeProfile } = await supabase
    .from('people')
    .select('id, name, slug, film_count')
    .eq('id', OGE_OKOYE_ID)
    .single();

  const { count: ogeCreditCount } = await supabase
    .from('credits')
    .select('*', { count: 'exact', head: true })
    .eq('person_id', OGE_OKOYE_ID);

  console.log('\n🌟 Oge Okoye Final Verification:');
  console.log(`  Name: ${ogeProfile?.name}`);
  console.log(`  Slug: ${ogeProfile?.slug}`);
  console.log(`  film_count in DB: ${ogeProfile?.film_count}`);
  console.log(`  Exact credits count in DB: ${ogeCreditCount}`);
}

syncAllOgeTitles().catch(console.error);
