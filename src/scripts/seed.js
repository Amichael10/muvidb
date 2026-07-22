import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import Papa from 'papaparse';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../../.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase credentials in .env");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const dataDir = path.join(__dirname, '../../src/data');
const logFile = path.join(dataDir, 'import_report.txt');

const logs = {
  inserted: [],
  skipped: [],
  updated: [],
  errors: []
};

// Relation maps in case an existing DB record matches by Name/Title but has a different ID
const filmIdMap = {};
const personIdMap = {};

function mapPersonFields(csvPerson) {
  const p = { ...csvPerson };
  if (p.biography !== undefined) {
    p.bio = p.biography;
    delete p.biography;
  }
  if (p.birth_date !== undefined) {
    p.date_of_birth = p.birth_date;
    delete p.birth_date;
  }
  
  // Drop known invalid columns that exported from TMDB/elsewhere
  delete p.known_for_department;
  delete p.birthplace;
  delete p.gender; // Or map it if we know the numeric codes, but better safe
  
  if (p.popularity_score !== undefined && p.popularity_score !== null) {
    p.popularity_score = Math.round(parseFloat(p.popularity_score)) || 0;
  }
  
  return p;
}

function mapFilmFields(csvFilm) {
  const f = { ...csvFilm };
  delete f.is_trending; // not in schema based on error probability
  
  if (f.tmdb_rating !== undefined && f.tmdb_rating !== null) {
    f.tmdb_rating = parseFloat(f.tmdb_rating) || 0;
  }
  
  return f;
}

function logEvent(category, msg) {
  logs[category].push(msg);
  console.log(`[${category.toUpperCase()}] ${msg}`);
}

async function parseCSV(fileName) {
  const filePath = path.join(dataDir, fileName);
  if (!fs.existsSync(filePath)) {
    console.log(`File not found, skipping: ${fileName}`);
    return [];
  }
  const fileContent = fs.readFileSync(filePath, 'utf8');
  return new Promise((resolve) => {
    Papa.parse(fileContent, {
      header: true,
      skipEmptyLines: true,
      dynamicTyping: true,
      complete: (results) => resolve(results.data),
      error: (err) => {
        logEvent('errors', `Failed to parse ${fileName}: ${err.message}`);
        resolve([]);
      }
    });
  });
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

async function processPeople() {
  console.log('\n--- Processing People ---');
  const people = await parseCSV('people.csv');
  if (!people.length) return;

  const { data: existingPeople } = await supabase.from('people').select('*');
  const existingMap = new Map();
  const existingNameMap = new Map();
  
  (existingPeople || []).forEach(p => {
    existingMap.set(p.id, p);
    if (p.name) existingNameMap.set(p.name.trim().toLowerCase(), p);
  });

  for (let person of people) {
    if (!person.name) continue;
    person = mapPersonFields(person);

    let match = existingMap.get(person.id) || existingNameMap.get(person.name.trim().toLowerCase());

    if (match) {
      personIdMap[person.id] = match.id; // Correct map for credits
      
      const { merged, needsUpdate } = mergeData(match, person);
      
      if (needsUpdate) {
        const { error } = await supabase.from('people').update(merged).eq('id', match.id);
        if (error) {
          logEvent('errors', `Person Update Error (${person.name}): ${error.message}`);
        } else {
          logEvent('updated', `Person: ${person.name} (Added more information)`);
        }
      } else {
        logEvent('skipped', `Person: ${person.name} (Already exists, no new info)`);
      }
    } else {
      personIdMap[person.id] = person.id;
      const { error } = await supabase.from('people').insert([person]);
      if (error) {
        logEvent('errors', `Person Insert Error (${person.name}): ${error.message}`);
      } else {
        logEvent('inserted', `Person: ${person.name}`);
      }
    }
  }
}

async function processFilms() {
  console.log('\n--- Processing Films ---');
  const films = await parseCSV('films.csv');
  if (!films.length) return;

  const { data: existingFilms } = await supabase.from('films').select('*');
  const existingMap = new Map();
  const existingTitleMap = new Map();
  
  (existingFilms || []).forEach(f => {
    existingMap.set(f.id, f);
    if (f.title) existingTitleMap.set(f.title.trim().toLowerCase(), f);
  });

  for (let film of films) {
    if (!film.title) continue;
    film = mapFilmFields(film);

    // Convert string booleans to actual booleans to prevent type errors
    if (film.is_featured === 't' || film.is_featured === 'true') film.is_featured = true;
    if (film.is_featured === 'f' || film.is_featured === 'false') film.is_featured = false;

    let match = existingMap.get(film.id) || existingTitleMap.get(film.title.trim().toLowerCase());

    if (match) {
      filmIdMap[film.id] = match.id; // Store re-mapping for relations
      
      const { merged, needsUpdate } = mergeData(match, film);
      
      if (needsUpdate) {
        const { error } = await supabase.from('films').update(merged).eq('id', match.id);
        if (error) {
          logEvent('errors', `Film Update Error (${film.title}): ${error.message}`);
        } else {
          logEvent('updated', `Film: ${film.title} (Added more information)`);
        }
      } else {
        logEvent('skipped', `Film: ${film.title} (Already exists, no new info)`);
      }
    } else {
      filmIdMap[film.id] = film.id;
      const { error } = await supabase.from('films').insert([film]);
      if (error) {
        logEvent('errors', `Film Insert Error (${film.title}): ${error.message}`);
      } else {
        logEvent('inserted', `Film: ${film.title}`);
      }
    }
  }
}

async function processCinemas() {
  console.log('\n--- Processing Cinemas ---');
  const cinemas = await parseCSV('cinemas.csv');
  if (!cinemas.length) return;

  const { data: existing } = await supabase.from('cinemas').select('*');
  const existingMap = new Map();
  (existing || []).forEach(c => existingMap.set(c.name.trim().toLowerCase(), c));

  for (const c of cinemas) {
    if (!c.name) continue;
    
    // String boolean conversion
    if (c.is_active === 't' || c.is_active === 'true') c.is_active = true;
    if (c.is_active === 'f' || c.is_active === 'false') c.is_active = false;

    if (existingMap.has(c.name.trim().toLowerCase())) {
      logEvent('skipped', `Cinema: ${c.name}`);
    } else {
      const { error } = await supabase.from('cinemas').insert([c]);
      if (error) logEvent('errors', `Cinema Insert Error (${c.name}): ${error.message}`);
      else logEvent('inserted', `Cinema: ${c.name}`);
    }
  }
}

async function processCredits() {
  console.log('\n--- Processing Credits ---');
  const credits = await parseCSV('credits.csv');
  if (!credits.length) return;

  const { data: existingCredits } = await supabase.from('credits').select('film_id, person_id, role');
  const existingSet = new Set((existingCredits || []).map(c => `${c.film_id}_${c.person_id}_${c.role}`));

  // To prevent batching limits we will insert individually or in small chunks, but individually is safer for error handling here
  for (const credit of credits) {
    if (!credit.film_id || !credit.person_id) continue;

    // Use our re-mapping in case the script found an existing film/person with a different UUID
    const mappedFilmId = filmIdMap[credit.film_id] || credit.film_id;
    const mappedPersonId = personIdMap[credit.person_id] || credit.person_id;
    
    credit.film_id = mappedFilmId;
    credit.person_id = mappedPersonId;
    credit.billing_order = credit.billing_order !== null && credit.billing_order !== undefined && credit.billing_order !== '' 
      ? credit.billing_order 
      : 999;
    
    const signature = `${credit.film_id}_${credit.person_id}_${credit.role}`;
    
    if (existingSet.has(signature)) {
      // already exists
      continue;
    }

    const { error } = await supabase.from('credits').insert([credit]);
    if (error) {
      logEvent('errors', `Credit Insert Error (Film: ${credit.film_id}): ${error.message}`);
    } else {
      existingSet.add(signature);
      logEvent('inserted', `Credit mapping (Role: ${credit.role})`);
    }
  }
}

async function processGenres() {
  console.log('\n--- Processing Genres ---');
  const genres = await parseCSV('genres.csv');
  if (!genres.length) return;

  const { data: existing } = await supabase.from('genres').select('*');
  const existingMap = new Map();
  (existing || []).forEach(g => {
    if (g.name) existingMap.set(g.name.trim().toLowerCase(), g);
  });

  for (const g of genres) {
    if (!g.name) continue;
    if (existingMap.has(g.name.trim().toLowerCase())) {
      logEvent('skipped', `Genre: ${g.name}`);
    } else {
      const { error } = await supabase.from('genres').insert([g]);
      if (error) logEvent('errors', `Genre Insert Error: ${error.message}`);
      else logEvent('inserted', `Genre: ${g.name}`);
    }
  }
}

async function runSeed() {
  console.log("Starting Migration... Reading from " + dataDir);

  await processPeople();
  await processFilms();
  await processCinemas();
  await processGenres();
  await processCredits();

  // Write report
  let report = `=== MUVIDB BATCH IMPORT REPORT ===\n\n`;
  report += `INSERTED: ${logs.inserted.length}\n`;
  report += `UPDATED (Merged more info): ${logs.updated.length}\n`;
  report += `SKIPPED (Already existed): ${logs.skipped.length}\n`;
  report += `ERRORS: ${logs.errors.length}\n\n`;
  
  if (logs.updated.length > 0) report += `--- UPDATED ITEMS ---\n${logs.updated.join('\n')}\n\n`;
  if (logs.skipped.length > 0) report += `--- SKIPPED ITEMS ---\n${logs.skipped.join('\n')}\n\n`;
  if (logs.errors.length > 0) report += `--- ERRORS ---\n${logs.errors.join('\n')}\n\n`;

  fs.writeFileSync(logFile, report);
  console.log('\nMigration Complete. Report written to: ', logFile);
}

runSeed();
