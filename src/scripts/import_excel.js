import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import xlsx from 'xlsx';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../../.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const dataDir = path.join(__dirname, '../../src/data');
const logFile = path.join(dataDir, 'excel_import_report.txt');

const logs = { inserted: [], skipped: [], updated: [], errors: [] };

function logEvent(category, msg) {
  logs[category].push(msg);
  console.log(`[${category.toUpperCase()}] ${msg}`);
}

function mergeData(existing, incoming) {
  let needsUpdate = false;
  const merged = { ...existing };
  for (const key in incoming) {
    if (incoming[key] !== null && incoming[key] !== '' && incoming[key] !== undefined) {
      if (existing[key] === null || existing[key] === '' || existing[key] === undefined) {
        merged[key] = incoming[key];
        needsUpdate = true;
      }
    }
  }
  return { merged, needsUpdate };
}

// Memory caches
const filmTitleToId = new Map();
const personNameToId = new Map();

async function preFetchDatabase() {
  console.log("Pre-fetching database IDs...");
  
  // Films
  const { data: films, error: fError } = await supabase.from('films').select('id, title');
  if (fError) {
    logEvent('errors', 'Failed to pre-fetch films');
    return;
  }
  (films || []).forEach(f => {
    if (f.title) filmTitleToId.set(f.title.trim().toLowerCase(), f.id);
  });

  // People
  const { data: people, error: pError } = await supabase.from('people').select('id, name');
  if (pError) {
    logEvent('errors', 'Failed to pre-fetch people');
    return;
  }
  (people || []).forEach(p => {
    if (p.name) personNameToId.set(p.name.trim().toLowerCase(), p.id);
  });
}

function readSheet(filePath, sheetName) {
  if (!fs.existsSync(filePath)) return [];
  const workbook = xlsx.readFile(filePath);
  if (!workbook.SheetNames.includes(sheetName)) return [];
  return xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]) || [];
}

async function getOrInsertPerson(personData) {
  if (!personData.name) return null;
  const nameKey = personData.name.trim().toLowerCase();
  
  if (personNameToId.has(nameKey)) {
    return personNameToId.get(nameKey);
  }

  // Insert novel person
  delete personData.known_for_department;
  delete personData.birthplace;
  
  if (personData.biography !== undefined) {
    personData.bio = personData.biography;
    delete personData.biography;
  }
  
  const { data, error } = await supabase.from('people').insert([personData]).select('id').single();
  if (error) {
    logEvent('errors', `Failed generating person inline: ${personData.name} - ${error.message}`);
    return null;
  }
  personNameToId.set(nameKey, data.id);
  logEvent('inserted', `Person (Inline): ${personData.name}`);
  return data.id;
}

async function processPeopleSheet(filePath) {
  const people = readSheet(filePath, 'People');
  for (const p of people) {
    if (!p.name) continue;
    const nameKey = p.name.trim().toLowerCase();
    
    let dbPayload = { ...p };
    // Strip empty-string values
    for (const key of Object.keys(dbPayload)) {
      if (dbPayload[key] === '') delete dbPayload[key];
    }
    delete dbPayload.known_for_department;
    delete dbPayload.birthplace;
    if (dbPayload.biography !== undefined) {
      dbPayload.bio = dbPayload.biography;
      delete dbPayload.biography;
    }
    // Drop columns that don't exist in the people DB schema
    delete dbPayload.id;
    delete dbPayload.birth_date;
    delete dbPayload.popularity_score;
    delete dbPayload.is_spotlight;
    delete dbPayload.created_at;
    delete dbPayload.updated_at;

    if (personNameToId.has(nameKey)) {
      const pid = personNameToId.get(nameKey);
      const { data: existing } = await supabase.from('people').select('*').eq('id', pid).single();
      if (existing) {
        const { merged, needsUpdate } = mergeData(existing, dbPayload);
        if (needsUpdate) {
          const { error } = await supabase.from('people').update(merged).eq('id', pid);
          if (!error) logEvent('updated', `Person: ${p.name} (Added more info)`);
          else logEvent('errors', `Person Update: ${p.name} - ${error.message}`);
        } else {
          logEvent('skipped', `Person: ${p.name} (No new info)`);
        }
      }
    } else {
      const { data, error } = await supabase.from('people').insert([dbPayload]).select('id').single();
      if (!error && data) {
        personNameToId.set(nameKey, data.id);
        logEvent('inserted', `Person: ${p.name}`);
      } else {
        logEvent('errors', `Person Insert: ${p.name} - ${error?.message}`);
      }
    }
  }
}

async function processFilmsSheet(filePath, sheetName) {
  const films = readSheet(filePath, sheetName);
  for (const f of films) {
    if (!f.title) continue;
    const titleKey = f.title.trim().toLowerCase();
    
    // Strip empty-string values so Supabase uses column defaults
    for (const key of Object.keys(f)) {
      if (f[key] === '') delete f[key];
    }

    // AMDB/NollyData use 'film_id' as PK column — rename to 'id'
    if (f.film_id && !f.id) {
      f.id = f.film_id;
    }
    delete f.film_id;

    // Nollydata maps runtime_min to runtime_minutes
    if (f.runtime_min) {
      f.runtime_minutes = f.runtime_min;
      delete f.runtime_min;
    }

    // Drop tracking slugs and amdb metadata that doesn't fit standard schema
    delete f.nollydata_url;
    delete f.nollydata_slug;
    delete f.nd_title;
    delete f.nd_release_date;
    delete f.nd_year;
    delete f.amdb_url;
    delete f.amdb_slug;
    delete f.country;
    delete f.partyjollof_url;
    delete f.partyjollof_slug;
    // Columns that don't exist in the films DB schema
    delete f.genres;
    delete f.languages;
    delete f.type;
    delete f.rating_avg;
    delete f.rating_count;
    delete f.release_date;
    delete f.fetched_at;
    delete f.watch_link_count;
    delete f.nd_genre;
    delete f.nd_type;
    delete f.nd_runtime_min;
    delete f.nd_overview;
    delete f.nd_poster_url;
    delete f.nd_distributors;

    if (filmTitleToId.has(titleKey)) {
      const fid = filmTitleToId.get(titleKey);
      const { data: existing } = await supabase.from('films').select('*').eq('id', fid).single();
      if (existing) {
        const { merged, needsUpdate } = mergeData(existing, f);
        if (needsUpdate) {
          const { error } = await supabase.from('films').update(merged).eq('id', fid);
          if (!error) logEvent('updated', `Film: ${f.title} (Added info)`);
          else logEvent('errors', `Film Update: ${f.title} - ${error.message}`);
        } else {
          logEvent('skipped', `Film: ${f.title} (No new info)`);
        }
      }
    } else {
      const { data, error } = await supabase.from('films').insert([f]).select('id').single();
      if (!error && data) {
        filmTitleToId.set(titleKey, data.id);
        logEvent('inserted', `Film: ${f.title}`);
      } else {
        logEvent('errors', `Film Insert: ${f.title} - ${error?.message}`);
      }
    }
  }
}

async function processCredits(filePath, castSheet, crewSheet) {
  const cast = readSheet(filePath, castSheet);
  const crew = readSheet(filePath, crewSheet);

  for (const c of cast) {
    if (!c.film_title || !c.person_name) continue;
    const fId = filmTitleToId.get(c.film_title.trim().toLowerCase());
    if (!fId) { logEvent('errors', `Cast link failed: missing film ${c.film_title}`); continue; }
    
    let pId = await getOrInsertPerson({ name: c.person_name, photo_url: c.photo_url });
    if (!pId) continue;

    const payload = {
      film_id: fId,
      person_id: pId,
      role: 'actor',
      character_name: c.character_name || c.character,
      billing_order: (c.billing_order !== undefined && c.billing_order !== '') ? Number(c.billing_order) : 999
    };
    
    const { error } = await supabase.from('credits').insert([payload]);
    if (!error) logEvent('inserted', `Cast Credit: ${c.person_name} in ${c.film_title}`);
  }

  for (const c of crew) {
    if (!c.film_title || !c.person_name) continue;
    const fId = filmTitleToId.get(c.film_title.trim().toLowerCase());
    if (!fId) { logEvent('errors', `Crew link failed: missing film ${c.film_title}`); continue; }

    let pId = await getOrInsertPerson({ name: c.person_name, photo_url: c.photo_url });
    if (!pId) continue;

    const payload = {
      film_id: fId,
      person_id: pId,
      role: (c.role || 'crew').toLowerCase(),
      billing_order: 999
    };

    const { error } = await supabase.from('credits').insert([payload]);
    if (!error) logEvent('inserted', `Crew Credit: ${c.person_name} (${c.role}) in ${c.film_title}`);
  }
}

async function processPartyJollofCredits(filePath) {
  const credits = readSheet(filePath, 'Credits');

  for (const c of credits) {
    if (!c.film_title || !c.person_name) continue;

    const fId = filmTitleToId.get(c.film_title.trim().toLowerCase());
    if (!fId) {
      logEvent('errors', `Credit link failed: missing film "${c.film_title}"`);
      continue;
    }

    let pId = personNameToId.get(c.person_name.trim().toLowerCase());
    if (!pId) {
      logEvent('errors', `Credit link failed: missing person "${c.person_name}"`);
      continue;
    }

    const billingOrder = (c.billing_order !== undefined && c.billing_order !== '') ? Number(c.billing_order) : 999;
    const payload = {
      film_id: fId,
      person_id: pId,
      role: (c.role || 'actor').toLowerCase(),
      character_name: c.character_name || null,
      billing_order: isNaN(billingOrder) ? 999 : billingOrder
    };

    const { error } = await supabase.from('credits').insert([payload]);
    if (!error) logEvent('inserted', `Credit: ${c.person_name} (${c.role}) in ${c.film_title}`);
    else if (error.message.includes('duplicate key')) logEvent('skipped', `Credit exists: ${c.person_name} in ${c.film_title}`);
    else logEvent('errors', `Credit insert failed: ${c.person_name} in ${c.film_title} - ${error.message}`);
  }
}

async function processWatchLinks(filePath, linksSheet) {
  const links = readSheet(filePath, linksSheet);
  
  for (const link of links) {
    if (!link.film_title || !link.url) continue;
    
    // Also Nollydata uses film_id column which breaks my id mapping, ensure film_title lookup
    const fId = filmTitleToId.get(link.film_title.trim().toLowerCase());
    if (!fId) {
      logEvent('errors', `WatchLink fail: missing film ${link.film_title}`);
      continue;
    }

    const { data: existingMap } = await supabase.from('films').select('year, release_type').eq('id', fId).single();
    if (!existingMap) continue;

    let payload = { youtube_watch_url: link.url };

    const distributorMap = {
      'netflix': 'netflix',
      'youtube': 'youtube',
      'amazon': 'prime_video',
      'prime video': 'prime_video',
      'showmax': 'showmax',
      'kaba': 'kaba'
    };
    
    let distKey = link.distributor ? distributorMap[link.distributor.toLowerCase()] || link.distributor.toLowerCase() : null;
    
    // The user's exact instruction:
    // Change from cinema to Netflix UNLESS movie is 2026 production
    if (distKey) {
      if (existingMap.release_type === 'cinema' && existingMap.year === 2026) {
        // Exempt year 2026 from overriding 'cinema' status
        logEvent('skipped', `Override protected: ${link.film_title} retained cinema status for 2026`);
      } else {
        payload.release_type = distKey;
      }
    }

    const { error } = await supabase.from('films').update(payload).eq('id', fId);
    if (!error) logEvent('updated', `Film Link: Attached ${distKey || 'url'} to ${link.film_title}`);
    else logEvent('errors', `Link Update fail: ${link.film_title} - ${error.message}`);
  }
}

async function runImporter() {
  console.log("=== STARTING SPREADSHEET IMPORTER ===");
  await preFetchDatabase();

  const amdbFilePath = path.join(dataDir, 'africanmoviedb_only.xlsx');
  const ndFilePath = path.join(dataDir, 'nollydata_only.xlsx');
  const pjFilePath = path.join(dataDir, 'partyjollof_only.xlsx');

  // Process African Movie DB
  console.log("\n-> Ingesting AfricanMovieDB...");
  await processFilmsSheet(amdbFilePath, 'Films');
  await processPeopleSheet(amdbFilePath, 'People');
  await processCredits(amdbFilePath, 'Cast', 'Crew');
  await processWatchLinks(amdbFilePath, 'Watch Links');

  // Process NollyData
  console.log("\n-> Ingesting NollyData...");
  await processFilmsSheet(ndFilePath, 'nollydata_films');
  await processWatchLinks(ndFilePath, 'nollydata_watch_links');
  // Nollydata cast & crew sheets are currently returned empty, but just in case we hit them
  await processCredits(ndFilePath, 'nollydata_cast', 'nollydata_crew');

  // Process PartyJollof
  console.log("\n-> Ingesting PartyJollof...");
  await processFilmsSheet(pjFilePath, 'Films');
  await processPeopleSheet(pjFilePath, 'People');
  await processPartyJollofCredits(pjFilePath);

  // Write report
  let report = `=== EXCEL BATCH IMPORT REPORT ===\n\n`;
  report += `INSERTED: ${logs.inserted.length}\n`;
  report += `UPDATED: ${logs.updated.length}\n`;
  report += `SKIPPED: ${logs.skipped.length}\n`;
  report += `ERRORS: ${logs.errors.length}\n\n`;
  
  if (logs.updated.length > 0) report += `--- UPDATED ITEMS ---\n${logs.updated.join('\n')}\n\n`;
  if (logs.skipped.length > 0) report += `--- SKIPPED ITEMS ---\n${logs.skipped.join('\n')}\n\n`;
  if (logs.errors.length > 0) report += `--- ERRORS ---\n${logs.errors.join('\n')}\n\n`;

  fs.writeFileSync(logFile, report);
  console.log('\nMigration Complete. Report written to: ', logFile);
}

runImporter();
