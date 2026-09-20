const fs = require('fs');
const path = require('path');
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
  'baba sala': 'Moses Olaiya'
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
      if (['Director', 'Writer', 'Cast', 'Producer', 'Cinematographer', 'Composer', 'Editor', 'Production Designer'].includes(cat)) {
        currentCategory = cat;
        continue;
      }
    }

    const personMatch = line.match(/\[([^\]]+)\]\(https:\/\/www\.imdb\.com\/name\/(nm\d+)\/[^)]*\)/);
    if (personMatch) {
      const rawName = personMatch[1].trim();
      const nmId = personMatch[2];

      if (rawName.startsWith('Go to ') || rawName.startsWith('See ') || rawName.startsWith('Learn ') || rawName.includes('IMDbPro')) {
        continue;
      }

      let characterName = null;
      if (currentCategory === 'Cast') {
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
      if (currentCategory === 'Director') role = 'director';
      else if (currentCategory === 'Writer') role = 'writer';
      else if (currentCategory === 'Producer') role = 'producer';
      else if (currentCategory === 'Cinematographer') role = 'cinematographer';
      else if (currentCategory === 'Composer') role = 'composer';
      else if (currentCategory === 'Editor') role = 'editor';

      const norm = normalizeName(rawName);
      const existing = credits.find(c => c.name.toLowerCase() === norm.toLowerCase() && c.role === role);
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

function parseTitleAndMetadata(tt, md, defaultTitle) {
  let title = defaultTitle ? defaultTitle.replace(/\s*\(\d{4}\).*$/, '').trim() : '';
  const headerMatch = md.match(/##\s+([^\n]+)/);
  if (headerMatch && !headerMatch[1].includes('cast') && !headerMatch[1].includes('crew') && !headerMatch[1].includes('Topics')) {
    title = headerMatch[1].trim();
  }

  let year = null;
  const yearMatch = md.match(/!\[.*?\((\d{4})\)\]/) || md.match(/\((\d{4})\)/) || (defaultTitle && defaultTitle.match(/\((\d{4})\)/));
  if (yearMatch) {
    year = parseInt(yearMatch[1], 10);
  }

  let posterUrl = null;
  const posterMatch = md.match(/!\[.*?\]\((https:\/\/m\.media-amazon\.com\/images\/M\/[^)]+\.jpg)\)/);
  if (posterMatch) {
    posterUrl = posterMatch[1];
  }

  return { title, year, posterUrl };
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
      .select('id, name')
      .range(offset, offset + pageSize - 1);
    if (error || !data || data.length === 0) break;
    for (const p of data) {
      if (p.name) {
        personCache.set(p.name.toLowerCase().trim(), p.id);
      }
    }
    if (data.length < pageSize) break;
    offset += pageSize;
  }
  console.log(`  Cached ${personCache.size} existing people.`);
}

async function bulkResolvePeople(names) {
  const resolved = new Map();
  const toInsert = [];

  for (const name of names) {
    const key = name.toLowerCase().trim();
    if (personCache.has(key)) {
      resolved.set(name, personCache.get(key));
    } else {
      toInsert.push(name);
    }
  }

  if (toInsert.length > 0) {
    const uniqueToInsert = Array.from(new Set(toInsert));
    const insertPayload = uniqueToInsert.map(n => {
      const slug = slugify(n) + '-' + Math.floor(Math.random() * 899 + 100);
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
      // Fallback to one by one if conflict
      for (const n of uniqueToInsert) {
        const slug = slugify(n) + '-' + Date.now().toString().slice(-4);
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

async function syncFilm(tt, data, defaultTitle) {
  const md = data.markdown || '';
  const meta = parseTitleAndMetadata(tt, md, defaultTitle);
  const ensemble = parseCreditsMarkdown(md);

  console.log(`🎬 Syncing ${tt}: "${meta.title}" (${meta.year || 'N/A'}) - ${ensemble.length} ensemble members`);

  // 1. Find or create film
  let filmId = null;

  const { data: existingByImdb } = await supabase
    .from('films')
    .select('id, title, year, poster_url')
    .eq('imdb_id', tt)
    .maybeSingle();

  if (existingByImdb) {
    filmId = existingByImdb.id;
    if (!existingByImdb.poster_url && meta.posterUrl) {
      await supabase.from('films').update({ poster_url: meta.posterUrl }).eq('id', filmId);
    }
  } else {
    const { data: existingByTitle } = await supabase
      .from('films')
      .select('id, title, year, imdb_id, poster_url')
      .ilike('title', meta.title)
      .limit(1);

    if (existingByTitle && existingByTitle.length > 0) {
      filmId = existingByTitle[0].id;
      await supabase.from('films').update({
        imdb_id: tt,
        is_nollywood: true,
        countries: ['Nigeria'],
        ...(meta.posterUrl && !existingByTitle[0].poster_url ? { poster_url: meta.posterUrl } : {}),
        ...(meta.year && !existingByTitle[0].year ? { year: meta.year } : {})
      }).eq('id', filmId);
    } else {
      const baseSlug = slugify(meta.title) + (meta.year ? `-${meta.year}` : '');
      const { data: newFilm, error } = await supabase
        .from('films')
        .insert({
          title: meta.title,
          year: meta.year,
          imdb_id: tt,
          content_type: 'feature_film',
          is_nollywood: true,
          countries: ['Nigeria'],
          source: 'imdb',
          poster_url: meta.posterUrl,
          slug: baseSlug
        })
        .select('id')
        .single();

      if (error) {
        const altSlug = `${baseSlug}-${Math.floor(Math.random() * 899 + 100)}`;
        const { data: retryFilm, error: retryErr } = await supabase
          .from('films')
          .insert({
            title: meta.title,
            year: meta.year,
            imdb_id: tt,
            content_type: 'feature_film',
            is_nollywood: true,
            countries: ['Nigeria'],
            source: 'imdb',
            poster_url: meta.posterUrl,
            slug: altSlug
          })
          .select('id')
          .single();

        if (retryErr) {
          console.error(`  ❌ Failed to create film "${meta.title}":`, retryErr.message);
          return;
        }
        filmId = retryFilm.id;
      } else {
        filmId = newFilm.id;
      }
    }
  }

  if (!filmId) return;

  // 2. Bulk resolve people for this ensemble
  const memberNames = ensemble.map(e => e.name);
  const resolvedPeople = await bulkResolvePeople(memberNames);

  // 3. Fetch existing credits
  const { data: existingCredits } = await supabase
    .from('credits')
    .select('person_id, role')
    .eq('film_id', filmId);

  const creditSet = new Set((existingCredits || []).map(c => `${c.person_id}|${c.role.toLowerCase()}`));

  // 4. Prepare credits to insert
  const toInsertCredits = [];
  for (let b = 0; b < ensemble.length; b++) {
    const mem = ensemble[b];
    const pId = resolvedPeople.get(mem.name);
    if (!pId) continue;

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
      console.error(`  ⚠️ Credits insert error for ${meta.title}:`, credErr.message);
    } else {
      console.log(`  ✅ Added ${toInsertCredits.length} credits (Total now: ${creditSet.size})`);
    }
  } else {
    console.log(`  👌 All ${creditSet.size} credits already present.`);
  }
}

async function run() {
  await preloadExistingPeople();

  const titlesObj = JSON.parse(fs.readFileSync('scratch/all_titles_to_fetch.json'));
  const files = fs.readdirSync('scratch').filter(f => f.startsWith('credits_') && f.endsWith('.json'));

  console.log(`Found ${files.length} fetched credit files in scratch/ ready for fast bulk sync.`);

  for (let i = 0; i < files.length; i++) {
    const f = files[i];
    const tt = f.replace('credits_', '').replace('.json', '');
    const data = JSON.parse(fs.readFileSync(`scratch/${f}`));
    const defaultTitle = titlesObj[tt]?.title || tt;
    console.log(`[${i + 1}/${files.length}]`);
    await syncFilm(tt, data, defaultTitle);
  }

  console.log('\n🔄 Recalculating film counts across all people in DB...');
  const { data: allCredits } = await supabase.from('credits').select('person_id');
  const countMap = {};
  for (const c of allCredits || []) {
    if (c.person_id) countMap[c.person_id] = (countMap[c.person_id] || 0) + 1;
  }

  const pIds = Object.keys(countMap);
  console.log(`Updating film_count for ${pIds.length} people...`);
  for (let i = 0; i < pIds.length; i += 50) {
    const batch = pIds.slice(i, i + 50);
    await Promise.all(
      batch.map(id =>
        supabase.from('people').update({ film_count: countMap[id] }).eq('id', id)
      )
    );
  }

  console.log('🎉 ALL AVAILABLE FILMS, CREDITS, AND ENSEMBLES FULLY SYNCED!');
}

run().catch(console.error);
