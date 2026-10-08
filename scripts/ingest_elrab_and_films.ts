import { supabase } from './lib/db';

interface PersonCredit {
  name: string;
  imdbId?: string;
  role: string;
  characterName?: string | null;
  photoUrl?: string | null;
  billingOrder?: number;
}

interface CompanyCredit {
  name: string;
  role: 'production' | 'distribution';
}

interface FilmData {
  title: string;
  year: number;
  imdbId: string;
  posterUrl: string;
  synopsis: string;
  runtimeMinutes?: number;
  imdbRating?: number;
  imdbVoteCount?: number;
  genres: string[];
  companies: CompanyCredit[];
  credits: PersonCredit[];
}

function makeSlug(text: string): string {
  return (text || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80) || 'untitled';
}

// In-memory caches to eliminate repeated sequential table scans
const companyCache = new Map<string, { id: string; name: string }>();
const personByImdb = new Map<string, any>();
const personByName = new Map<string, any>();

async function preloadCompanies(names: string[]) {
  console.log(`🔍 Preloading ${names.length} companies...`);
  const { data } = await supabase.from('companies').select('id, name, slug').in('name', names);
  for (const c of data || []) {
    companyCache.set(c.name.toLowerCase().trim(), c);
  }
}

async function getOrCreateCompany(name: string, type: 'production' | 'distribution'): Promise<string> {
  const key = name.toLowerCase().trim();
  if (companyCache.has(key)) {
    return companyCache.get(key)!.id;
  }

  // Try single query if not in cache
  const { data: existing } = await supabase.from('companies').select('id, name, slug').ilike('name', name.trim()).maybeSingle();
  if (existing) {
    companyCache.set(key, existing);
    return existing.id;
  }

  const baseSlug = makeSlug(name);
  const slug = `${baseSlug}-${Date.now().toString(36)}`;
  const { data: created, error } = await supabase
    .from('companies')
    .insert({
      name: name.trim(),
      slug,
      company_type: type,
    })
    .select('id, name, slug')
    .single();

  if (error) {
    console.error(`  ⚠️ Error creating company "${name}":`, error.message);
    throw error;
  }
  console.log(`  🏢 Created company: "${name}" (${created.id})`);
  companyCache.set(key, created);
  return created.id;
}

async function preloadPeople(allCredits: PersonCredit[]) {
  const imdbIds = [...new Set(allCredits.map(c => c.imdbId).filter(Boolean) as string[])];
  const names = [...new Set(allCredits.map(c => c.name.trim()))];

  console.log(`🔍 Preloading ${imdbIds.length} people by IMDb ID...`);
  if (imdbIds.length > 0) {
    // Supabase .in() in chunks of 50
    for (let i = 0; i < imdbIds.length; i += 50) {
      const chunk = imdbIds.slice(i, i + 50);
      const { data } = await supabase.from('people').select('id, name, imdb_id, photo_url, known_for_department').in('imdb_id', chunk);
      for (const p of data || []) {
        if (p.imdb_id) personByImdb.set(p.imdb_id, p);
        personByName.set(p.name.toLowerCase().trim(), p);
      }
    }
  }

  console.log(`🔍 Preloading people by exact name...`);
  // For remaining names not found by imdb_id
  const remainingNames = names.filter(n => !personByName.has(n.toLowerCase()));
  for (let i = 0; i < remainingNames.length; i += 50) {
    const chunk = remainingNames.slice(i, i + 50);
    const { data } = await supabase.from('people').select('id, name, imdb_id, photo_url, known_for_department').in('name', chunk);
    for (const p of data || []) {
      if (p.imdb_id) personByImdb.set(p.imdb_id, p);
      personByName.set(p.name.toLowerCase().trim(), p);
    }
  }

  console.log(`✅ Loaded ${personByImdb.size} people by IMDb ID and ${personByName.size} by name into memory cache.`);
}

async function getOrCreatePerson(c: PersonCredit): Promise<string> {
  const cleanName = c.name.trim();
  const nameKey = cleanName.toLowerCase();

  // 1. Check in-memory cache
  if (c.imdbId && personByImdb.has(c.imdbId)) {
    const p = personByImdb.get(c.imdbId)!;
    // Enrich photo or department if needed
    const patch: Record<string, any> = {};
    if (!p.photo_url && c.photoUrl) patch.photo_url = c.photoUrl;
    if (!p.known_for_department && c.role) {
      patch.known_for_department = c.role === 'director' ? 'Directing' : c.role === 'actor' ? 'Acting' : 'Production';
    }
    if (Object.keys(patch).length > 0) {
      await supabase.from('people').update(patch).eq('id', p.id);
      Object.assign(p, patch);
    }
    return p.id;
  }

  if (personByName.has(nameKey)) {
    const p = personByName.get(nameKey)!;
    const patch: Record<string, any> = {};
    if (!p.imdb_id && c.imdbId) patch.imdb_id = c.imdbId;
    if (!p.photo_url && c.photoUrl) patch.photo_url = c.photoUrl;
    if (!p.known_for_department && c.role) {
      patch.known_for_department = c.role === 'director' ? 'Directing' : c.role === 'actor' ? 'Acting' : 'Production';
    }
    if (Object.keys(patch).length > 0) {
      await supabase.from('people').update(patch).eq('id', p.id);
      Object.assign(p, patch);
    }
    if (c.imdbId) personByImdb.set(c.imdbId, p);
    return p.id;
  }

  // 2. Not in DB - create new person cleanly
  const slug = `${makeSlug(cleanName)}-${Date.now().toString(36)}`;
  const { data: created, error } = await supabase
    .from('people')
    .insert({
      name: cleanName,
      slug,
      imdb_id: c.imdbId || null,
      photo_url: c.photoUrl || null,
      nationality: 'Nigerian',
      known_for_department: c.role === 'director' ? 'Directing' : c.role === 'actor' ? 'Acting' : 'Production',
      source: 'imdb',
      is_verified: true,
      needs_review: false,
    })
    .select('id, name, imdb_id, photo_url, known_for_department')
    .single();

  if (error) {
    console.error(`  ⚠️ Error creating person "${cleanName}":`, error.message);
    throw error;
  }
  console.log(`  👤 Created person: "${cleanName}" (${created.id})`);
  if (c.imdbId) personByImdb.set(c.imdbId, created);
  personByName.set(nameKey, created);
  return created.id;
}

// 4 Films Data Definition
const FILMS_DATA: FilmData[] = [
  // 1. No Fury (2024)
  {
    title: 'No Fury',
    year: 2024,
    imdbId: 'tt28575620',
    posterUrl: 'https://m.media-amazon.com/images/M/MV5BMWJkZDJkZmItMzZmNC00YmVhLWFmOGYtZDkxMDQxZDc4Yjc4XkEyXkFqcGc@._V1_SX1200.jpg',
    genres: ['Drama', 'Romance', 'Thriller'],
    synopsis: "A once-enviable couple's perfect life unravels when a hidden betrayal is exposed, driving the betrayed wife to seek revenge, igniting a fiery battle that threatens to burn down the bridges connecting their families, forcing her to confront whether love can overcome the ashes of deceit.",
    companies: [
      { name: 'Bossteewo Studio', role: 'production' },
      { name: 'Cinemax Entertainment', role: 'distribution' },
    ],
    credits: [
      { name: 'Akay Mason', imdbId: 'nm9085723', role: 'director' },
      { name: 'Tenyin Ikpe Etim', imdbId: 'nm10645599', role: 'writer' },
      { name: 'Uyaiedu Ikpe-Etim', imdbId: 'nm11740838', role: 'writer' },
      { name: 'Prisca Okeke', imdbId: 'nm12992980', role: 'writer' },
      { name: 'Taiwo Adebayo', imdbId: 'nm3534815', role: 'producer' },
      { name: 'Elrab', imdbId: 'nm12450827', role: 'executive producer' },
      { name: 'Mark S. Grandy', imdbId: 'nm12639103', role: 'editor' },
      { name: 'Julius Joel', imdbId: 'nm14266501', role: 'production coordinator' },
      { name: 'Kameel Audu', imdbId: 'nm12238768', role: 'actor', billingOrder: 1 },
      { name: 'Jide Awobona', imdbId: 'nm10319268', role: 'actor', billingOrder: 2 },
      { name: 'Aderinoye Babatunde', imdbId: 'nm12896716', role: 'actor', billingOrder: 3 },
      { name: 'Lilian Esoro', imdbId: 'nm3954495', role: 'actor', billingOrder: 4 },
      { name: 'Gift Godwin', imdbId: 'nm14593580', role: 'actor', billingOrder: 5 },
      { name: 'Nse Ikpe-Etim', imdbId: 'nm4133510', role: 'actor', billingOrder: 6 },
      { name: 'Jim Iyke', imdbId: 'nm1651104', role: 'actor', billingOrder: 7 },
      { name: 'Tina Mba', imdbId: 'nm3339311', role: 'actor', billingOrder: 8 },
      { name: 'Iya Mufu', imdbId: 'nm15117566', role: 'actor', billingOrder: 9 },
      { name: 'Eric Obinna', imdbId: 'nm8560408', role: 'actor', billingOrder: 10 },
      { name: 'Akeem Ogara', imdbId: 'nm13263038', role: 'actor', billingOrder: 11 },
      { name: 'Nosa Rex', imdbId: 'nm9218133', role: 'actor', billingOrder: 12 },
    ],
  },

  // 2. Special Assistant (2023)
  {
    title: 'Special Assistant',
    year: 2023,
    imdbId: 'tt23787352',
    posterUrl: 'https://m.media-amazon.com/images/M/MV5BN2E4NGFkOTMtMzUzNC00MmJjLWJmODAtZWJjY2FkMDFkY2M1XkEyXkFqcGc@._V1_SX1200.jpg',
    genres: ['Drama', 'Romance'],
    synopsis: "A man falls for his boss but refuses her advances due to his long-distance girlfriend. His boss rehires him, they date, but his girlfriend reappears. He must choose between them.",
    companies: [
      { name: 'Bossteewo Studio', role: 'production' },
      { name: 'Ibaka TV', role: 'distribution' },
    ],
    credits: [
      { name: 'Great Valentine Edochie', imdbId: 'nm13187473', role: 'director' },
      { name: 'Chris Bonnie', imdbId: 'nm12531322', role: 'writer' },
      { name: 'Taiwo Adebayo', imdbId: 'nm3534815', role: 'producer' },
      { name: 'Elrab', imdbId: 'nm12450827', role: 'executive producer' },
      { name: 'Ladipo Abiola', imdbId: 'nm9940286', role: 'cinematographer' },
      { name: 'Goriola Gbolahan', imdbId: 'nm12807614', role: 'cinematographer' },
      { name: 'Muyiwa Idowu', imdbId: 'nm12580648', role: 'production manager' },
      { name: 'Aminat Bisiriyu', imdbId: 'nm14266502', role: 'assistant production manager' },
      { name: 'Julius Joel', imdbId: 'nm14266501', role: 'production coordinator' },
      { name: 'Jide Kene Achufusi', imdbId: 'nm7975075', role: 'actor', characterName: 'Joel', billingOrder: 1 },
      { name: 'Kameel Audu', imdbId: 'nm12238768', role: 'actor', characterName: 'Frank', billingOrder: 2 },
      { name: 'Aderinoye Babatunde', imdbId: 'nm12896716', role: 'actor', characterName: 'Nelson', billingOrder: 3 },
      { name: 'Mofe Duncan', imdbId: 'nm8972134', role: 'actor', characterName: 'Dickson', billingOrder: 4 },
      { name: 'Lilian Esoro', imdbId: 'nm3954495', role: 'actor', characterName: 'Vanessa', billingOrder: 5 },
      { name: 'Emem Inwang', imdbId: 'nm8722667', role: 'actor', characterName: 'Sharon', billingOrder: 6 },
      { name: 'Ornella Opah', imdbId: 'nm13540413', role: 'actor', characterName: 'Yvonne', billingOrder: 7 },
    ],
  },

  // 3. Dream Job (2021)
  {
    title: 'Dream Job',
    year: 2021,
    imdbId: 'tt14362042',
    runtimeMinutes: 95,
    posterUrl: 'https://m.media-amazon.com/images/M/MV5BZDYwZDQyNDgtNzE5OC00ZTMyLWJhZDYtNTlkZTFjZjNjMDU1XkEyXkFqcGc@._V1_SX1200.jpg',
    genres: ['Comedy', 'Drama'],
    synopsis: "After years of unemployment and a recent painful breakup, Uche is determined to change his fate by securing a space in the corporate world, hoping get back his girl. Suddenly all his wishes are coming true. Has his luck finally changed?",
    companies: [
      { name: 'Elrab Entertainment', role: 'production' },
      { name: 'Blue Pictures', role: 'distribution' },
    ],
    credits: [
      { name: 'Kayode Peters', imdbId: 'nm9264577', role: 'director' },
      { name: 'Pearl Agwu', imdbId: 'nm12450826', role: 'writer' },
      { name: 'Kayode Peters', imdbId: 'nm9264577', role: 'producer' },
      { name: 'Elrab', imdbId: 'nm12450827', role: 'executive producer' },
      { name: 'Richard Mabiaku', imdbId: 'nm2509364', role: 'cinematographer' },
      { name: 'Mark S. Grandy', imdbId: 'nm12639103', role: 'editor' },
      { name: 'Olagunju Dayo', imdbId: 'nm12302899', role: 'art director' },
      { name: 'Tolade Anibaba', imdbId: 'nm12572179', role: 'makeup' },
      { name: 'Folorunsho Olayemi', imdbId: 'nm12748473', role: 'art department' },
      { name: 'Qudus Oshin', imdbId: 'nm12484683', role: 'sound' },
      { name: 'Owosheni Akorede', imdbId: 'nm12748474', role: 'camera and electrical' },
      { name: 'Adebayo Kelvin', imdbId: 'nm12748475', role: 'costume designer' },
      { name: 'Salem Isaac', imdbId: 'nm12748476', role: 'script supervisor' },
      { name: 'Uchemba Williams', imdbId: 'nm2145803', role: 'actor', characterName: 'Uche Okafor', billingOrder: 1 },
      { name: 'Sophie Alakija', imdbId: 'nm11629532', role: 'actor', characterName: 'Mabel', billingOrder: 2 },
      { name: 'Timini Egbuson', imdbId: 'nm6170424', role: 'actor', characterName: 'Deji', billingOrder: 3 },
      { name: 'Funny Bone', imdbId: 'nm8403810', role: 'actor', characterName: 'George', billingOrder: 4 },
      { name: 'Uche Montana', imdbId: 'nm9711972', role: 'actor', characterName: 'Nkechi Okafor', billingOrder: 5 },
      { name: 'Ngozi Nwosu', imdbId: 'nm2096818', role: 'actor', characterName: 'Mrs. Okafor', billingOrder: 6 },
      { name: 'Yemi Solade', imdbId: 'nm2167232', role: 'actor', characterName: 'Mr. Okafor', billingOrder: 7 },
      { name: 'Pearl Agwu', imdbId: 'nm12450826', role: 'actor', characterName: 'Receptionist', billingOrder: 8 },
      { name: 'Toney Beshel', imdbId: 'nm12450823', role: 'actor', characterName: 'Interviewer', billingOrder: 9 },
      { name: 'Adedayo Davies', imdbId: 'nm12006259', role: 'actor', characterName: 'Okoye', billingOrder: 10 },
      { name: 'Olagunju Dayo', imdbId: 'nm12302899', role: 'actor', characterName: 'Job Applicant 1', billingOrder: 11 },
      { name: 'Muyiwa Idowu', imdbId: 'nm12580648', role: 'actor', characterName: 'Job Applicant 2', billingOrder: 12 },
      { name: 'Bello Khabir', imdbId: 'nm12450825', role: 'actor', characterName: 'Gateman', billingOrder: 13 },
      { name: 'Michael Sani', imdbId: 'nm12450822', role: 'actor', characterName: 'Pastor', billingOrder: 14 },
      { name: 'Chesan Nze', imdbId: 'nm13574953', role: 'actor', characterName: 'Lady at Bar', billingOrder: 15 },
      { name: 'Alicia Tega', imdbId: 'nm13209433', role: 'actor', characterName: 'Boat Extra', billingOrder: 16 },
      { name: 'Ty Firegyal', imdbId: 'nm16325532', role: 'actor', characterName: 'Miss Stephanie', billingOrder: 17 },
      { name: 'Ndidi Lynda Abiazem', imdbId: 'nm13162383', role: 'actor', characterName: 'Beggar', billingOrder: 18 },
    ],
  },

  // 4. Crazy Grannies (2021)
  {
    title: 'Crazy Grannies',
    year: 2021,
    imdbId: 'tt15001678',
    runtimeMinutes: 111,
    imdbRating: 4.7,
    imdbVoteCount: 31,
    posterUrl: 'https://m.media-amazon.com/images/M/MV5BZTQ4N2NmYTQtYmQxMS00MDBmLTkzNTAtYzUzZTY0MDljZWZlXkEyXkFqcGc@._V1_SX1200.jpg',
    genres: ['Comedy', 'Drama'],
    synopsis: "This comedy/drama movie follows the hilarious adventures of three grandmas who decide to take a much-needed all-girls trip to a resort where they have the adventures of their lives.",
    companies: [
      { name: 'Elrab Entertainment', role: 'production' },
      { name: 'Blue Pictures', role: 'distribution' },
    ],
    credits: [
      { name: 'Tope Alake', imdbId: 'nm8056868', role: 'director' },
      { name: 'Kayode Peters', imdbId: 'nm9264577', role: 'director' },
      { name: 'Joy Elumelu', imdbId: 'nm8971372', role: 'writer' },
      { name: 'Kayode Peters', imdbId: 'nm9264577', role: 'writer' },
      { name: 'Kayode Peters', imdbId: 'nm9264577', role: 'producer' },
      { name: 'Elrab', imdbId: 'nm12450827', role: 'executive producer' },
      { name: 'Joe Kenny', imdbId: 'nm12512131', role: 'composer' },
      { name: 'Mayowa Lawrence', imdbId: 'nm9940276', role: 'cinematographer' },
      { name: 'Richard Mabiaku', imdbId: 'nm2509364', role: 'cinematographer' },
      { name: 'Mark S. Grandy', imdbId: 'nm12639103', role: 'editor' },
      { name: 'Okunlola Abisola', imdbId: 'nm13162386', role: 'makeup' },
      { name: 'Jadesola Bankole', imdbId: 'nm9940291', role: 'makeup' },
      { name: 'Muyiwa Idowu', imdbId: 'nm12580648', role: 'production manager' },
      { name: 'Ndidi Lynda Abiazem', imdbId: 'nm13162383', role: 'second unit or assistant director' },
      { name: 'Akande Abdullahi', imdbId: 'nm12986682', role: 'sound' },
      { name: 'Titilope Afolabi', imdbId: 'nm9348983', role: 'sound' },
      { name: 'Qudus Oshin', imdbId: 'nm12484683', role: 'sound' },
      { name: 'Kazeem Abdulkareem', imdbId: 'nm11458013', role: 'camera and electrical' },
      { name: 'Vivian Aronu', imdbId: 'nm13155349', role: 'camera and electrical' },
      { name: 'Azeez Idris', imdbId: 'nm13409446', role: 'camera and electrical' },
      { name: 'Adebayo Kelvin', imdbId: 'nm12748475', role: 'costume designer' },
      { name: 'Salem Isaac', imdbId: 'nm12748476', role: 'script supervisor' },
      { name: 'Pearl Agwu', imdbId: 'nm12450826', role: 'production coordinator' },
      { name: 'Toba Ezekiel', imdbId: 'nm13162387', role: 'production assistant' },
      { name: 'Rosemary Abazie', imdbId: 'nm11026580', role: 'actor', characterName: 'Doctor', billingOrder: 1 },
      { name: 'Debo Adedayo', imdbId: 'nm12354481', role: 'actor', characterName: 'Pastor Igbalode', billingOrder: 2 },
      { name: 'Princess Damilola Adekoya', imdbId: 'nm12735185', role: 'actor', characterName: 'Ere', billingOrder: 3 },
      { name: 'Pearl Agwu', imdbId: 'nm12450826', role: 'actor', characterName: 'Extra', billingOrder: 4 },
      { name: 'Mercy Aigbe', imdbId: 'nm3443150', role: 'actor', characterName: 'Ewa', billingOrder: 5 },
      { name: 'Chinonso Arubayi', imdbId: 'nm12738209', role: 'actor', characterName: 'Chidinma', billingOrder: 6 },
      { name: 'Shaffy Bello', imdbId: 'nm6823397', role: 'actor', characterName: 'Omodele', billingOrder: 7 },
      { name: 'Marvellous Dominion', imdbId: 'nm12738211', role: 'actor', characterName: 'Extra', billingOrder: 8 },
      { name: 'Patience Emmanuel', imdbId: 'nm3351118', role: 'actor', characterName: 'Extra', billingOrder: 9 },
      { name: 'Modella Gabriella', imdbId: 'nm12738210', role: 'actor', characterName: 'Cast', billingOrder: 10 },
      { name: 'Kolawole Iremide', imdbId: 'nm13753895', role: 'actor', characterName: 'Baby', billingOrder: 11 },
      { name: 'Bayray McNwizu', imdbId: 'nm4521181', role: 'actor', characterName: 'Munachi', billingOrder: 12 },
      { name: 'Bolanle Ninalowo', imdbId: 'nm7970787', role: 'actor', characterName: 'Kayode', billingOrder: 13 },
      { name: 'Ngozi Nwosu', imdbId: 'nm2096818', role: 'actor', characterName: 'Cheta', billingOrder: 14 },
      { name: 'Jimmy Odukoya', imdbId: 'nm9805459', role: 'actor', characterName: 'Adam', billingOrder: 15 },
      { name: 'Onyebuchi Ojieh', imdbId: 'nm11908068', role: 'actor', characterName: 'Austel', billingOrder: 16 },
      { name: 'Kayode Peters', imdbId: 'nm9264577', role: 'actor', characterName: 'Femi', billingOrder: 17 },
      { name: 'Jay Rammal', imdbId: 'nm12738212', role: 'actor', characterName: 'Chaperon', billingOrder: 18 },
    ],
  },
];

async function main() {
  console.log('🚀 Starting optimized ingestion for Elrab (nm12450827) and all 4 films...');

  // 1. Gather all companies and people across all films to batch preload
  const allCompanyNames = [...new Set(FILMS_DATA.flatMap(f => f.companies.map(c => c.name)))];
  await preloadCompanies(allCompanyNames);

  const allCredits = [
    { name: 'Elrab', imdbId: 'nm12450827', role: 'producer' },
    ...FILMS_DATA.flatMap(f => f.credits),
  ];
  await preloadPeople(allCredits);

  // 2. Ensure / Ingest Elrab profile
  console.log('\n================ Ingesting / Updating Elrab ================');
  const elrabId = await getOrCreatePerson({
    name: 'Elrab',
    imdbId: 'nm12450827',
    role: 'producer',
  });
  await supabase.from('people').update({
    nationality: 'Nigerian',
    known_for_department: 'Producer',
    bio: 'Elrab is a Nigerian film producer and executive producer known for No Fury (2024), Special Assistant (2023), Dream Job (2021), and Crazy Grannies (2021).',
  }).eq('id', elrabId);
  console.log(`✅ Elrab profile confirmed (id: ${elrabId})`);

  // 3. Preload all 4 films
  const filmImdbIds = FILMS_DATA.map(f => f.imdbId);
  const { data: existingFilms } = await supabase.from('films').select('id, title, year, imdb_id').in('imdb_id', filmImdbIds);
  const filmMap = new Map<string, string>();
  for (const f of existingFilms || []) {
    if (f.imdb_id) filmMap.set(f.imdb_id, f.id);
  }

  // 4. Ingest each film
  for (const film of FILMS_DATA) {
    console.log(`\n================ Ingesting: ${film.title} (${film.year}) ================`);
    let filmId = filmMap.get(film.imdbId);

    if (filmId) {
      console.log(`  🎬 Film "${film.title}" found in DB (id: ${filmId}). Updating metadata...`);
      await supabase.from('films').update({
        title: film.title,
        year: film.year,
        poster_url: film.posterUrl,
        synopsis: film.synopsis,
        runtime_minutes: film.runtimeMinutes || null,
        imdb_rating: film.imdbRating || null,
        imdb_vote_count: film.imdbVoteCount || null,
        genres: film.genres,
        status: 'released',
        is_nollywood: true,
        is_published: true,
        countries: ['Nigeria'],
        source: 'imdb',
      }).eq('id', filmId);
    } else {
      const slug = `${makeSlug(film.title)}-${film.year}-${Date.now().toString(36)}`;
      const { data: created, error } = await supabase
        .from('films')
        .insert({
          title: film.title,
          slug,
          year: film.year,
          imdb_id: film.imdbId,
          poster_url: film.posterUrl,
          synopsis: film.synopsis,
          runtime_minutes: film.runtimeMinutes || null,
          imdb_rating: film.imdbRating || null,
          imdb_vote_count: film.imdbVoteCount || null,
          genres: film.genres,
          status: 'released',
          is_nollywood: true,
          is_published: true,
          countries: ['Nigeria'],
          source: 'imdb',
        })
        .select('id')
        .single();

      if (error) {
        console.error(`  ⚠️ Error creating film "${film.title}":`, error.message);
        throw error;
      }
      filmId = created.id;
      filmMap.set(film.imdbId, filmId);
      console.log(`  🎉 Created film: "${film.title}" (${filmId})`);
    }

    // Attach companies
    console.log(`  🏢 Attaching companies for ${film.title}...`);
    let primaryDistributor: string | null = null;
    let primaryProductionId: string | null = null;

    for (const comp of film.companies) {
      const compId = await getOrCreateCompany(comp.name, comp.role);
      if (comp.role === 'distribution' && !primaryDistributor) primaryDistributor = comp.name;
      if (comp.role === 'production' && !primaryProductionId) primaryProductionId = compId;

      const { data: link } = await supabase
        .from('film_companies')
        .select('film_id, company_id')
        .eq('film_id', filmId)
        .eq('company_id', compId)
        .maybeSingle();

      if (!link) {
        await supabase.from('film_companies').insert({
          film_id: filmId,
          company_id: compId,
          role: comp.role,
        });
        console.log(`    🔗 Linked "${comp.name}" as ${comp.role}`);
      }
    }

    if (primaryDistributor) {
      await supabase.from('films').update({ distributor: primaryDistributor }).eq('id', filmId);
    }

    // Attach credits with Zero-Duplicate guarantee
    console.log(`  🎭 Attaching ${film.credits.length} credits for ${film.title}...`);
    const { data: existingCredits } = await supabase
      .from('credits')
      .select('id, film_id, person_id, role, character_name, billing_order')
      .eq('film_id', filmId);

    const existingByPerson = new Map<string, any[]>();
    for (const c of existingCredits || []) {
      const list = existingByPerson.get(c.person_id) || [];
      list.push(c);
      existingByPerson.set(c.person_id, list);
    }

    for (const cred of film.credits) {
      const personId = await getOrCreatePerson(cred);
      const existing = existingByPerson.get(personId);

      if (cred.role === 'actor') {
        const existingActorCredit = existing?.find(e => e.role === 'actor');
        if (existingActorCredit) {
          // Zero duplicate: update in place
          const patch: Record<string, any> = {};
          if (cred.characterName && (!existingActorCredit.character_name || existingActorCredit.character_name !== cred.characterName)) {
            patch.character_name = cred.characterName;
          }
          if (cred.billingOrder && (!existingActorCredit.billing_order || existingActorCredit.billing_order > cred.billingOrder)) {
            patch.billing_order = cred.billingOrder;
          }
          if (Object.keys(patch).length > 0) {
            await supabase.from('credits').update(patch).eq('id', existingActorCredit.id);
            console.log(`    ↻ Updated actor credit in-place for ${cred.name} (${cred.characterName || 'actor'})`);
          }
          continue;
        }
      } else {
        const existingSameRole = existing?.find(e => e.role === cred.role);
        if (existingSameRole) {
          if (cred.characterName && !existingSameRole.character_name) {
            await supabase.from('credits').update({ character_name: cred.characterName }).eq('id', existingSameRole.id);
          }
          continue;
        }
      }

      // Insert new credit row
      const { data: inserted, error } = await supabase
        .from('credits')
        .insert({
          film_id: filmId,
          person_id: personId,
          role: cred.role,
          character_name: cred.characterName || null,
          billing_order: cred.billingOrder || null,
          source: 'imdb',
        })
        .select('id')
        .single();

      if (error) {
        console.error(`    ⚠️ Error inserting credit for ${cred.name} (${cred.role}):`, error.message);
      } else {
        const list = existingByPerson.get(personId) || [];
        list.push({ id: inserted.id, film_id: filmId, person_id: personId, role: cred.role });
        existingByPerson.set(personId, list);
      }
    }

    console.log(`  ✅ Finished ${film.title}!`);
  }

  console.log('\n🎉 ALL INGESTION COMPLETED WITH 100% SUCCESS!');
}

main().catch((err) => {
  console.error('Fatal error during ingestion:', err);
  process.exit(1);
});
