/**
 * Apply AMAA winners + nominations from scratch/amaa/entries.json:
 *  1. Create missing films
 *  2. Create missing people (role from category)
 *  3. Link credits (person ↔ film + role)
 *  4. Append awards to people.awards / films.awards (won: true|false)
 *
 * Run:
 *   npx tsx scripts/apply_amaa_awards.ts
 *   npx tsx scripts/apply_amaa_awards.ts --dry-run
 *   npx tsx scripts/apply_amaa_awards.ts --no-create
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ENTRIES_PATH = path.resolve(__dirname, '..', 'scratch', 'amaa', 'entries.json');
const FALLBACK_WINS = path.resolve(__dirname, '..', 'scratch', 'amaa', 'winners.json');
const REPORT_PATH = path.resolve(__dirname, '..', 'scratch', 'amaa', 'apply-report.json');

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const db = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } });
const DRY = process.argv.includes('--dry-run');
const NO_CREATE = process.argv.includes('--no-create');

type Entry = {
  season: number;
  year: number;
  category: string;
  work: string | null;
  people: string[];
  won: boolean;
  synopsis?: string | null;
  imageUrl?: string | null;
  source: string;
};

type AwardEntry = {
  title: string;
  category: string;
  organization: 'AMAA';
  year: number;
  season: number;
  won: boolean;
  work?: string | null;
  recipients?: string[];
};

/** Site spelling variants → canonical DB names */
const NAME_ALIASES: Record<string, string> = {
  'ramsey noah': 'ramsey nouah',
  'ramsey noah jnr': 'ramsey nouah jnr',
  'jackie apia': 'jackie appiah',
  'jackie aygemang': 'jackie appiah',
  'jackie agyemang': 'jackie appiah',
  'jackie agyemani': 'jackie appiah',
  'kate henshaw nuttal': 'kate henshaw',
  'kate henshaw-nuttal': 'kate henshaw',
  'shirley frimpong': 'shirley frimpong-manso',
  'shirley frimpong manso': 'shirley frimpong-manso',
};

function normalizeName(s: string) {
  let n = (s || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\([^)]*\)/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\b(the|a|an|jr|sr|ii|iii)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return NAME_ALIASES[n] || n;
}

function makeSlug(text: string) {
  return (text || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80) || 'untitled';
}

async function uniqueSlug(table: 'people' | 'films', base: string) {
  let slug = base;
  for (let i = 0; i < 20; i++) {
    const { data } = await db.from(table).select('id').eq('slug', slug).maybeSingle();
    if (!data) return slug;
    slug = `${base}-${i + 2}`.slice(0, 80);
  }
  return `${base}-${Date.now().toString(36)}`.slice(0, 80);
}

function isJunkPersonName(name: string) {
  const raw = (name || '').trim();
  const n = normalizeName(raw);
  if (!n || n.length < 2 || n.length > 70) return true;
  if (raw.length > 80) return true;
  if (/red carpet|unnamed|unknown/i.test(raw)) return true;
  if (/^(hausa|igbo|yoruba|swahili|africa|movie|tv series|n a)$/.test(n)) return true;
  if (/^\(.*\)$/.test(raw)) return true;
  // Category / list text leaked into person field
  if (/amaa|award for|prize for|achievement in|best (film|director|actor|actress|documentary|animation|short|nigerian|diaspora)|national film|nfvcb|winners?/i.test(raw)) {
    return true;
  }
  // Jammed multi-name garbage (too many capitals runs or ampersand clusters)
  if ((raw.match(/[A-Z]{3,}/g) || []).length >= 4) return true;
  if ((raw.match(/\bAMAA\b/gi) || []).length >= 1) return true;
  // Titles that leaked into person field
  if (/^(breath of life|anikulapo|brotherhood|shanty town|her dark past|viva riva|of good report|accident|hoodrush|elelwani|kokomma|rugged priest|man on ground|otelo burning|state of violence|how to steal 2 million|ties that bind|adesuwa|phone swap)$/.test(n)) {
    return true;
  }
  // Jammed titles / missing spaces between words ("FilmTitleNext")
  if (/[a-z]{3,}[A-Z]/.test(raw)) return true;
  if (/mission to no where|best indigenous|princess tyra/i.test(raw)) return true;
  return false;
}

function isJunkWorkTitle(work: string) {
  const raw = (work || '').trim();
  const n = normalizeName(raw);
  if (!n || n.length < 2) return true;
  if (raw.length > 100) return true;
  if (/amaa\s+20\d{2}|award for best|prize for|achievement in/i.test(raw)) return true;
  if (/[a-z]{3,}[A-Z]/.test(raw)) return true; // jammed CamelCase titles
  if ((raw.match(/[–—]/g) || []).length >= 2 && raw.length > 40) return true;
  // Person names wrongly placed as work
  if (/^(wale ojo|samuel perry|loukman ali|hilda dokubo|ama amphofo)$/.test(n)) return true;
  return false;
}

function cleanPersonName(name: string) {
  return (name || '')
    .replace(/^\.+/, '')
    .replace(/\s*\([^)]*$/g, '') // unclosed parenthesis junk
    .replace(/\s*\((?:the )?president.?s daughter\)/gi, '')
    .replace(/\s*\(beyonce\)/gi, '')
    .replace(/\s*republic of\s*$/i, '')
    .replace(/\s*boukina faso\s*$/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function looksLikePersonName(name: string) {
  const raw = cleanPersonName(name);
  if (!raw || raw.length < 3 || raw.length > 55) return false;
  if (isJunkPersonName(raw)) return false;
  // Prefer 2–4 tokens; allow initials
  const tokens = raw.split(/\s+/).filter(Boolean);
  if (tokens.length < 2 || tokens.length > 5) return false;
  if (/^(the|a|an)\b/i.test(raw)) return false;
  return true;
}

function isUsableEntry(e: Entry) {
  e.people = e.people.map(cleanPersonName).filter(Boolean);

  // AMAA sometimes lists Best Director as "Film – Director"
  if (
    /DIRECTOR/i.test(e.category)
    && !/DEBUT|FIRST FEATURE|PROMISING/i.test(e.category)
    && e.people[0]
    && e.work
    && !looksLikePersonName(e.people[0])
    && looksLikePersonName(e.work)
  ) {
    const film = e.people[0];
    e.people = [e.work];
    e.work = film;
  }

  if (e.people.some((p) => isJunkPersonName(p))) {
    // keep film-only awards if work is clean and people were junk
    if (!e.work || isJunkWorkTitle(e.work)) return false;
    e.people = e.people.filter((p) => !isJunkPersonName(p));
  }
  if (e.work && isJunkWorkTitle(e.work)) e.work = null;
  return !!(e.work || e.people.length);
}

/** Map AMAA category → credit role + known_for_department */
function roleFromCategory(category: string): { role: string; dept: string; isCast: boolean } {
  const c = (category || '').toUpperCase();
  if (/LEAD ACTOR|LEAD ACTRESS|SUPPORTING ACTOR|SUPPORTING ACTRESS|BEST ACTOR|BEST ACTRESS|SUPPORT ACTRESS|SUPPORT ACTOR|ACTOR IN A COMEDY|ACTRESS IN A COMEDY/.test(c)) {
    return { role: 'actor', dept: 'Acting', isCast: true };
  }
  if (/DIRECTOR/.test(c)) return { role: 'director', dept: 'Directing', isCast: false };
  if (/WRITING|WRITER|SCRIPT/.test(c)) return { role: 'writer', dept: 'Writing', isCast: false };
  if (/CINEMATOGRAPH|LIGHTING/.test(c)) return { role: 'cinematographer', dept: 'Camera', isCast: false };
  if (/EDITING|EDITOR/.test(c)) return { role: 'editor', dept: 'Editing', isCast: false };
  if (/COSTUME/.test(c)) return { role: 'costume_designer', dept: 'Costume & Make-Up', isCast: false };
  if (/MAKE.?UP/.test(c)) return { role: 'makeup_artist', dept: 'Costume & Make-Up', isCast: false };
  if (/SCORE|MUSIC|COMPOSER/.test(c)) return { role: 'composer', dept: 'Sound', isCast: false };
  if (/SOUND/.test(c)) return { role: 'sound_designer', dept: 'Sound', isCast: false };
  if (/ART DIRECT/.test(c)) return { role: 'art_director', dept: 'Art', isCast: false };
  if (/DIGITAL CONTENT|ONLINE SOCIAL|CONTENT CREATOR/.test(c)) {
    return { role: 'creator', dept: 'Creator', isCast: false };
  }
  // Series/movie category winners are often producers/creators
  if (/BEST MOVIE|BEST SERIES|BEST SHORT|BEST DOCUMENTARY|INDIGENOUS|M-NET|MULTICHOICE|ORIGINAL/.test(c)) {
    return { role: 'producer', dept: 'Production', isCast: false };
  }
  return { role: 'crew', dept: 'Crew', isCast: false };
}

function awardBaseKey(a: Pick<AwardEntry, 'organization' | 'season' | 'category' | 'work' | 'title'>): string {
  return [a.organization, a.season, a.category, a.work || '', a.title].join('|').toLowerCase();
}

function mergeAwards(existing: any, incoming: AwardEntry[]): AwardEntry[] {
  const list: AwardEntry[] = Array.isArray(existing) ? existing.map((x) => ({ ...x })) : [];
  const byBase = new Map<string, number>();
  list.forEach((a, i) => byBase.set(awardBaseKey(a), i));

  for (const a of incoming) {
    const base = awardBaseKey(a);
    const idx = byBase.get(base);
    if (idx != null) {
      // Upgrade nomination → win if needed; never downgrade
      if (a.won && !list[idx].won) list[idx] = { ...list[idx], ...a, won: true };
      continue;
    }
    list.push(a);
    byBase.set(base, list.length - 1);
  }
  return list;
}

function indexByNormalizedName<T extends Record<string, any>>(
  rows: T[],
  nameField: 'name' | 'title',
): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const row of rows) {
    const k = normalizeName(row[nameField]);
    if (!k) continue;
    const list = map.get(k);
    if (list) list.push(row);
    else map.set(k, [row]);
  }
  return map;
}

function personScore(p: any): number {
  let s = 0;
  if (p.photo_url) s += 20;
  if (p.bio && String(p.bio).length > 40) s += 8;
  if (!p.needs_review) s += 10;
  if (p.source && p.source !== 'AMAA') s += 5;
  const n = String(p.name || '');
  if (/red carpet|unnamed|unknown|\(winner\)/i.test(n)) s -= 50;
  if (/[a-z]{3,}[A-Z]/.test(n) || n.length > 45) s -= 20;
  // Prefer canonical short names over hyphenated/all-caps site spellings
  s -= Math.max(0, n.length - 25);
  return s;
}

function filmScore(f: any): number {
  let s = 0;
  if (f.poster_url) s += 10;
  if (f.synopsis) s += 5;
  s -= Math.max(0, String(f.title || '').length - 40);
  return s;
}

function pickBest<T>(matches: T[] | undefined, score: (row: T) => number): T | null {
  if (!matches?.length) return null;
  return [...matches].sort((a, b) => score(b) - score(a))[0];
}

function toPersonAward(e: Entry): AwardEntry {
  return {
    title: e.work || e.category,
    category: e.category,
    organization: 'AMAA',
    year: e.year,
    season: e.season,
    won: e.won,
    work: e.work,
  };
}

function toFilmAward(e: Entry, recipients: string[]): AwardEntry {
  return {
    title: e.category,
    category: e.category,
    organization: 'AMAA',
    year: e.year,
    season: e.season,
    won: e.won,
    work: e.work,
    recipients,
  };
}

function queueAward(
  updates: Map<string, { row: any; add: AwardEntry[] }>,
  row: any,
  award: AwardEntry,
): void {
  let bucket = updates.get(row.id);
  if (!bucket) {
    bucket = { row, add: [] };
    updates.set(row.id, bucket);
  }
  bucket.add.push(award);
}

async function loadAll(table: 'people' | 'films', cols: string) {
  const pageSize = 1000;
  let from = 0;
  const all: any[] = [];
  for (;;) {
    const { data, error } = await db.from(table).select(cols).range(from, from + pageSize - 1);
    if (error) throw error;
    if (!data?.length) break;
    all.push(...data);
    if (data.length < pageSize) break;
    from += pageSize;
  }
  return all;
}

async function mirrorToStorage(url: string, bucket: 'posters' | 'people', filename: string): Promise<string | null> {
  try {
    const r = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0',
        Accept: 'image/*',
        Referer: 'https://ama-awards.com/',
      },
    });
    if (!r.ok) return null;
    const buf = Buffer.from(await r.arrayBuffer());
    if (buf.byteLength < 500) return null;
    const isJpeg = buf[0] === 0xff && buf[1] === 0xd8;
    const isPng = buf[0] === 0x89 && buf[1] === 0x50;
    const isWebp = buf[8] === 0x57 && buf[9] === 0x45;
    const ext = isPng ? 'png' : isWebp ? 'webp' : isJpeg ? 'jpg' : 'jpg';
    const ct = isPng ? 'image/png' : isWebp ? 'image/webp' : 'image/jpeg';
    const name = `${filename}.${ext}`;
    const { error } = await db.storage.from(bucket).upload(name, buf, {
      contentType: ct,
      upsert: true,
      cacheControl: '31536000',
    });
    if (error) return url; // fall back to hotlink
    return `${SUPABASE_URL}/storage/v1/object/public/${bucket}/${name}`;
  } catch {
    return url;
  }
}

function loadEntries(): Entry[] {
  if (fs.existsSync(ENTRIES_PATH)) {
    const p = JSON.parse(fs.readFileSync(ENTRIES_PATH, 'utf8'));
    return p.entries || [];
  }
  if (fs.existsSync(FALLBACK_WINS)) {
    const p = JSON.parse(fs.readFileSync(FALLBACK_WINS, 'utf8'));
    const wins = p.wins || p.entries || [];
    return wins.map((w: any) => ({ ...w, won: w.won !== false }));
  }
  return [];
}

async function main() {
  const loaded = loadEntries();
  const entries = loaded.filter(isUsableEntry);
  if (!entries.length) {
    console.error('No entries — run: npx tsx scripts/scrape_amaa.ts');
    process.exit(1);
  }

  console.log(`${entries.length} AMAA entries after cleanup (from ${loaded.length}; ${entries.filter((e) => e.won).length} wins / ${entries.filter((e) => !e.won).length} noms)`);
  console.log(`   dry-run=${DRY} create=${!NO_CREATE}`);

  console.log('Loading people + films...');
  const people = await loadAll('people', 'id, name, awards, photo_url, bio, known_for_department, slug');
  let films = await loadAll('films', 'id, title, awards, poster_url, synopsis, slug, year');
  console.log(`   people=${people.length} films=${films.length}`);

  const peopleByName = indexByNormalizedName(people, 'name');
  const filmsByTitle = indexByNormalizedName(films, 'title');

  const pickPerson = (matches: any[]) => pickBest(matches, personScore);
  const pickFilm = (matches: any[]) => pickBest(matches, filmScore);

  const stats = {
    peopleCreated: 0,
    filmsCreated: 0,
    peopleUpdated: 0,
    filmsUpdated: 0,
    creditsLinked: 0,
    skippedJunkPeople: 0,
    skippedJunkFilms: 0,
  };

  // Best metadata per work / person from CDN cards
  const workMeta = new Map<string, { title: string; synopsis: string | null; imageUrl: string | null; year: number }>();
  const personMeta = new Map<string, { name: string; imageUrl: string | null; category: string; work: string | null }>();

  for (const e of entries) {
    if (e.work && !isJunkWorkTitle(e.work)) {
      const k = normalizeName(e.work);
      const prev = workMeta.get(k);
      if (!prev || (e.imageUrl && !prev.imageUrl) || (e.synopsis && !prev.synopsis)) {
        workMeta.set(k, {
          title: e.work,
          synopsis: e.synopsis || prev?.synopsis || null,
          imageUrl: e.imageUrl || prev?.imageUrl || null,
          year: e.year,
        });
      }
    }
    for (const pname of e.people) {
      if (isJunkPersonName(pname)) continue;
      const k = normalizeName(pname);
      const { isCast } = roleFromCategory(e.category);
      const prev = personMeta.get(k);
      // Prefer cast images; otherwise first available
      if (!prev || (isCast && e.imageUrl) || (!prev.imageUrl && e.imageUrl)) {
        personMeta.set(k, {
          name: pname,
          imageUrl: e.imageUrl || prev?.imageUrl || null,
          category: e.category,
          work: e.work,
        });
      }
    }
  }

  // --- Create missing films ---
  if (!NO_CREATE) {
    for (const [, meta] of workMeta) {
      const k = normalizeName(meta.title);
      if (filmsByTitle.has(k)) continue;
      stats.filmsCreated++;
      if (DRY) {
        console.log(`  +film ${meta.title}`);
        continue;
      }
      let poster = meta.imageUrl;
      if (poster) poster = (await mirrorToStorage(poster, 'posters', `AMAA-${makeSlug(meta.title)}`)) || poster;
      const slug = await uniqueSlug('films', makeSlug(meta.title));
      const { data, error } = await db
        .from('films')
        .insert({
          title: meta.title,
          slug,
          year: meta.year || null,
          synopsis: meta.synopsis,
          poster_url: poster,
          source: 'AMAA',
          status: 'released',
          awards: [],
          needs_review: true,
        })
        .select('id, title, awards, poster_url, synopsis, slug, year')
        .single();
      if (error) {
        console.warn(`  film create fail ${meta.title}: ${error.message}`);
        stats.filmsCreated--;
        continue;
      }
      films.push(data);
      filmsByTitle.set(k, [data]);
      console.log(`  + created film ${meta.title}`);
    }
  }

  // --- Create missing people ---
  if (!NO_CREATE) {
    for (const [, meta] of personMeta) {
      const k = normalizeName(meta.name);
      if (peopleByName.has(k)) continue;
      if (isJunkPersonName(meta.name)) {
        stats.skippedJunkPeople++;
        continue;
      }
      const { dept } = roleFromCategory(meta.category);
      stats.peopleCreated++;
      if (DRY) {
        console.log(`  +person ${meta.name} (${dept})`);
        continue;
      }
      let photo = meta.imageUrl;
      if (photo) photo = (await mirrorToStorage(photo, 'people', `AMAA-${makeSlug(meta.name)}`)) || photo;
      const slug = await uniqueSlug('people', makeSlug(meta.name));
      const bioBits = [
        meta.work ? `AMAA-nominated for ${meta.category} (${meta.work}).` : `AMAA-nominated for ${meta.category}.`,
        'Profile seeded from Africa Movie Academy Awards (ama-awards.com) listings.',
      ];
      const { data, error } = await db
        .from('people')
        .insert({
          name: meta.name,
          slug,
          photo_url: photo,
          bio: bioBits.join(' '),
          known_for_department: dept,
          source: 'AMAA',
          awards: [],
          needs_review: true,
        })
        .select('id, name, awards, photo_url, bio, known_for_department, slug')
        .single();
      if (error) {
        console.warn(`  person create fail ${meta.name}: ${error.message}`);
        stats.peopleCreated--;
        continue;
      }
      people.push(data);
      peopleByName.set(k, [data]);
      console.log(`  + created person ${meta.name}`);
    }
  }

  // --- Awards + credits ---
  const personUpdates = new Map<string, { row: any; add: AwardEntry[] }>();
  const filmUpdates = new Map<string, { row: any; add: AwardEntry[] }>();
  const creditJobs: Array<{ filmId: string; personId: string; role: string }> = [];
  const unmatchedPeople: any[] = [];
  const unmatchedFilms: any[] = [];

  for (const e of entries) {
    const { role } = roleFromCategory(e.category);
    const peopleNames = e.people.filter((p) => !isJunkPersonName(p));
    if (e.people.length && !peopleNames.length) stats.skippedJunkPeople += e.people.length;

    let filmRow: any = null;
    if (e.work && !isJunkWorkTitle(e.work)) {
      filmRow = pickFilm(filmsByTitle.get(normalizeName(e.work)) || []);
      if (!filmRow) unmatchedFilms.push({ work: e.work, category: e.category, season: e.season, won: e.won });
    } else if (e.work) {
      stats.skippedJunkFilms++;
    }

    for (const pname of peopleNames) {
      const person = pickPerson(peopleByName.get(normalizeName(pname)) || []);
      if (!person) {
        unmatchedPeople.push({ name: pname, category: e.category, season: e.season, work: e.work, won: e.won });
        continue;
      }
      queueAward(personUpdates, person, toPersonAward(e));
      if (filmRow) creditJobs.push({ filmId: filmRow.id, personId: person.id, role });
    }

    if (filmRow) {
      queueAward(filmUpdates, filmRow, toFilmAward(e, peopleNames));

      // Enrich empty poster/synopsis on existing films
      if (!NO_CREATE && !DRY && e.imageUrl && !filmRow.poster_url) {
        const poster = await mirrorToStorage(e.imageUrl, 'posters', `AMAA-${filmRow.id}`);
        if (poster) {
          await db.from('films').update({ poster_url: poster }).eq('id', filmRow.id);
          filmRow.poster_url = poster;
        }
      }
      if (!NO_CREATE && !DRY && e.synopsis && !filmRow.synopsis) {
        await db.from('films').update({ synopsis: e.synopsis }).eq('id', filmRow.id);
        filmRow.synopsis = e.synopsis;
      }
    }
  }

  for (const [id, { row, add }] of personUpdates) {
    const next = mergeAwards(row.awards, add);
    if (DRY) {
      stats.peopleUpdated++;
      continue;
    }
    const { error } = await db.from('people').update({ awards: next }).eq('id', id);
    if (error) console.warn(`  person awards ${row.name}: ${error.message}`);
    else {
      stats.peopleUpdated++;
      console.log(`  person awards ${row.name} +${add.length}`);
    }
  }

  for (const [id, { row, add }] of filmUpdates) {
    const next = mergeAwards(row.awards, add);
    if (DRY) {
      stats.filmsUpdated++;
      continue;
    }
    const { error } = await db.from('films').update({ awards: next }).eq('id', id);
    if (error) console.warn(`  film awards ${row.title}: ${error.message}`);
    else {
      stats.filmsUpdated++;
      console.log(`  film awards ${row.title} +${add.length}`);
    }
  }

  // Credits
  if (!NO_CREATE) {
    const seenCredit = new Set<string>();
    for (const job of creditJobs) {
      const key = `${job.filmId}|${job.personId}|${job.role}`;
      if (seenCredit.has(key)) continue;
      seenCredit.add(key);
      if (DRY) {
        stats.creditsLinked++;
        continue;
      }
      const { data: existing } = await db
        .from('credits')
        .select('id')
        .eq('film_id', job.filmId)
        .eq('person_id', job.personId)
        .eq('role', job.role)
        .maybeSingle();
      if (existing) continue;
      const { error } = await db.from('credits').insert({
        film_id: job.filmId,
        person_id: job.personId,
        role: job.role,
      });
      if (!error) stats.creditsLinked++;
    }
  }

  const uniqPeople = [...new Map(unmatchedPeople.map((x) => [normalizeName(x.name), x])).values()];
  const uniqFilms = [...new Map(unmatchedFilms.map((x) => [normalizeName(x.work), x])).values()];

  const report = {
    generatedAt: new Date().toISOString(),
    dryRun: DRY,
    noCreate: NO_CREATE,
    stats: { ...stats, unmatchedPeople: uniqPeople.length, unmatchedFilms: uniqFilms.length },
    unmatchedPeople: uniqPeople,
    unmatchedFilms: uniqFilms,
  };
  fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2));

  console.log('\n----------------------------------------');
  console.log(`People created:  ${stats.peopleCreated}${DRY ? ' (dry-run)' : ''}`);
  console.log(`Films created:   ${stats.filmsCreated}${DRY ? ' (dry-run)' : ''}`);
  console.log(`People awards:   ${stats.peopleUpdated}`);
  console.log(`Films awards:    ${stats.filmsUpdated}`);
  console.log(`Credits linked:  ${stats.creditsLinked}`);
  console.log(`Still unmatched people: ${uniqPeople.length}`);
  console.log(`Still unmatched films:  ${uniqFilms.length}`);
  console.log(`Report: ${REPORT_PATH}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

