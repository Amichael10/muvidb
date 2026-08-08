/**
 * Apply TINFF winners + nominations from scratch/tinff/entries.json:
 *  1. Create missing films (poster + synopsis when available)
 *  2. Create missing people (role from category; photo when available)
 *  3. Link credits (person ↔ film + role)
 *  4. Append awards to people.awards / films.awards (won: true|false)
 *
 * Run:
 *   npx tsx scripts/apply_tinff_awards.ts
 *   npx tsx scripts/apply_tinff_awards.ts --dry-run
 *   npx tsx scripts/apply_tinff_awards.ts --no-create   # awards only, no new rows
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { supabase as db } from './lib/db';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ENTRIES_PATH = path.resolve(__dirname, '..', 'scratch', 'tinff', 'entries.json');
const FALLBACK_WINS = path.resolve(__dirname, '..', 'scratch', 'tinff', 'winners.json');
const REPORT_PATH = path.resolve(__dirname, '..', 'scratch', 'tinff', 'apply-report.json');

const SUPABASE_URL = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').trim();

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
  organization: 'TINFF';
  year: number;
  season: number;
  won: boolean;
  work?: string | null;
  film_id?: string | null;
  recipients?: string[];
};

type PersonRow = {
  id: string;
  name: string;
  awards: any;
  photo_url: string | null;
  bio: string | null;
  known_for_department: string | null;
  slug: string;
};

type FilmRow = {
  id: string;
  title: string;
  awards: any;
  poster_url: string | null;
  synopsis: string | null;
  slug: string;
  year: number | null;
};

function normalizeName(s: string) {
  return (s || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\([^)]*\)/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\b(the|a|an|jr|sr|ii|iii)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
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

function cleanPersonName(name: string) {
  return (name || '')
    .replace(/\s*[—–]\s*.+$/, '') // "Yuri Lai — Film Title" → "Yuri Lai" (em/en dash only)
    .replace(/\s+et\s+al\.?\s*$/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Split jammed multi-recipient strings into individual names. */
function expandPeople(names: string[]): string[] {
  const out: string[] = [];
  for (const raw of names || []) {
    const cleaned = cleanPersonName(raw);
    if (!cleaned) continue;
    const parts = cleaned
      .split(/\s*(?:,|&|\/|\band\b)\s*/i)
      .map((p) => cleanPersonName(p))
      .filter(Boolean);
    if (parts.length > 1) out.push(...parts);
    else out.push(cleaned);
  }
  return [...new Set(out)];
}

function isJunkPersonName(name: string) {
  const raw = cleanPersonName(name);
  const n = normalizeName(raw);
  if (!n || n.length < 2 || n.length > 70) return true;
  if (raw.length > 80) return true;
  if (/red carpet|unnamed|unknown/i.test(raw)) return true;
  if (/^(hausa|igbo|yoruba|swahili|africa|movie|tv series|n a|n\/a|tba|tbd)$/.test(n)) return true;
  if (/^\(.*\)$/.test(raw)) return true;
  if (/tinff|award for|prize for|achievement in|best (film|feature|director|actor|actress|documentary|animation|short|nigerian|diaspora)|winners?/i.test(raw)) {
    return true;
  }
  if ((raw.match(/\bTINFF\b/gi) || []).length >= 1) return true;
  // Film / category titles wrongly placed as people
  if (/^(the rhythm of ancestors|breath of life|anikulapo|brotherhood|shanty town|her dark past)$/.test(n)) return true;
  const tokens = raw.split(/\s+/).filter(Boolean);
  if (tokens.length < 2 || tokens.length > 5) return true;
  return false;
}

function isJunkWorkTitle(work: string) {
  const raw = (work || '').trim();
  const n = normalizeName(raw);
  if (!n || n.length < 2) return true;
  if (raw.length > 100) return true;
  if (/tinff\s+20\d{2}|award for best|prize for|achievement in/i.test(raw)) return true;
  // Category labels leaked into work field
  if (/^best (actress|actor|film|feature|director|documentary|short|cinematography)/i.test(raw)) return true;
  if (/^written by\b/i.test(raw)) return true;
  if (/filmmaker$/i.test(raw) && /^best\b/i.test(raw)) return true;
  if (/^(wale ojo|samuel perry|loukman ali)$/.test(n)) return true;
  return false;
}

/** Map TINFF category → credit role + known_for_department */
function roleFromCategory(category: string): { role: string; dept: string; isCast: boolean } {
  const c = (category || '').toUpperCase();
  if (/LEAD ACTOR|LEAD ACTRESS|SUPPORTING ACTOR|SUPPORTING ACTRESS|BEST ACTOR|BEST ACTRESS|SUPPORT ACTRESS|SUPPORT ACTOR|ACTOR IN A COMEDY|ACTRESS IN A COMEDY|PERFORMANCE/.test(c)) {
    return { role: 'actor', dept: 'Acting', isCast: true };
  }
  if (/PHOTOGRAPHY|CINEMATOGRAPH|\bDOP\b/.test(c)) return { role: 'cinematographer', dept: 'Camera', isCast: false };
  if (/DIRECTOR/.test(c)) return { role: 'director', dept: 'Directing', isCast: false };
  if (/WRITING|WRITER|SCRIPT|SCREENPLAY/.test(c)) return { role: 'writer', dept: 'Writing', isCast: false };
  if (/EDITING|EDITOR/.test(c)) return { role: 'editor', dept: 'Editing', isCast: false };
  if (/COSTUME/.test(c)) return { role: 'costume_designer', dept: 'Costume & Make-Up', isCast: false };
  if (/MAKE.?UP/.test(c)) return { role: 'makeup_artist', dept: 'Costume & Make-Up', isCast: false };
  if (/SCORE|MUSIC|COMPOSER|SOUNDTRACK/.test(c)) return { role: 'composer', dept: 'Sound', isCast: false };
  if (/SOUND/.test(c)) return { role: 'sound_designer', dept: 'Sound', isCast: false };
  if (/ART DIRECT|PRODUCTION DESIGN/.test(c)) return { role: 'art_director', dept: 'Art', isCast: false };
  if (/DIGITAL CONTENT|ONLINE SOCIAL|CONTENT CREATOR/.test(c)) {
    return { role: 'creator', dept: 'Creator', isCast: false };
  }
  if (/BEST (FEATURE|FILM|MOVIE|SERIES|SHORT|DOCUMENTARY|NOLLYWOOD)|AUDIENCE|JURY|GRAND (PRIZE|AWARD)|GOLDEN/.test(c)) {
    return { role: 'producer', dept: 'Production', isCast: false };
  }
  return { role: 'crew', dept: 'Crew', isCast: false };
}

function mergeAwards(existing: any, incoming: AwardEntry[]): AwardEntry[] {
  const list: AwardEntry[] = Array.isArray(existing) ? existing.map((x) => ({ ...x })) : [];
  const byBase = new Map<string, number>();
  list.forEach((a, i) => {
    const base = [a.organization, a.season, a.category, a.work || '', a.title].join('|').toLowerCase();
    byBase.set(base, i);
  });

  for (const a of incoming) {
    const base = [a.organization, a.season, a.category, a.work || '', a.title].join('|').toLowerCase();
    const idx = byBase.get(base);
    if (idx != null) {
      const prev = list[idx];
      list[idx] = {
        ...prev,
        ...a,
        won: a.won || prev.won,
        film_id: a.film_id || prev.film_id || null,
      };
      continue;
    }
    list.push(a);
    byBase.set(base, list.length - 1);
  }
  return list;
}

/** Lightweight index: id + name/title only (avoids loading huge awards jsonb). */
async function loadNameIndex(table: 'people' | 'films') {
  const pageSize = 1000;
  let from = 0;
  const byNorm = new Map<string, { id: string; label: string }[]>();
  const nameField = table === 'people' ? 'name' : 'title';
  for (;;) {
    const { data, error } = await db.from(table).select(`id,${nameField}`).range(from, from + pageSize - 1);
    if (error) throw error;
    if (!data?.length) break;
    for (const row of data as any[]) {
      const label = row[nameField] as string;
      const k = normalizeName(label);
      if (!k) continue;
      if (!byNorm.has(k)) byNorm.set(k, []);
      byNorm.get(k)!.push({ id: row.id, label });
    }
    if (data.length < pageSize) break;
    from += pageSize;
  }
  return byNorm;
}

async function fetchPerson(id: string): Promise<PersonRow | null> {
  const { data, error } = await db
    .from('people')
    .select('id, name, awards, photo_url, bio, known_for_department, slug')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return data as PersonRow | null;
}

async function fetchFilm(id: string): Promise<FilmRow | null> {
  const { data, error } = await db
    .from('films')
    .select('id, title, awards, poster_url, synopsis, slug, year')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return data as FilmRow | null;
}

async function mirrorToStorage(url: string, bucket: 'posters' | 'people', filename: string): Promise<string | null> {
  try {
    const r = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0',
        Accept: 'image/*',
        Referer: 'https://www.tinff.net/',
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
    if (error) return url;
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
  const entries = loadEntries();
  if (!entries.length) {
    console.error('❌ No entries — waiting for Agent 1: scratch/tinff/entries.json');
    process.exit(1);
  }

  fs.mkdirSync(path.dirname(REPORT_PATH), { recursive: true });

  console.log(`📦 ${entries.length} TINFF entries (${entries.filter((e) => e.won).length} wins / ${entries.filter((e) => !e.won).length} noms)`);
  console.log(`   dry-run=${DRY} create=${!NO_CREATE}`);

  console.log('📥 Loading people + film name indexes...');
  const peopleByName = await loadNameIndex('people');
  const filmsByTitle = await loadNameIndex('films');
  console.log(`   people keys=${peopleByName.size} film keys=${filmsByTitle.size}`);

  // Cache full rows only for matched / created entities
  const peopleCache = new Map<string, PersonRow>();
  const filmsCache = new Map<string, FilmRow>();

  const stats = {
    peopleCreated: 0,
    filmsCreated: 0,
    peopleUpdated: 0,
    filmsUpdated: 0,
    creditsLinked: 0,
    skippedJunkPeople: 0,
    skippedJunkFilms: 0,
  };

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
    for (const pname of expandPeople(e.people || [])) {
      if (isJunkPersonName(pname)) continue;
      const k = normalizeName(pname);
      const { isCast } = roleFromCategory(e.category);
      const prev = personMeta.get(k);
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

  // ── Create missing films ──────────────────────────────────────
  if (!NO_CREATE) {
    for (const [k, meta] of workMeta) {
      if (filmsByTitle.has(k)) continue;
      stats.filmsCreated++;
      if (DRY) {
        console.log(`  +film ${meta.title}`);
        continue;
      }
      let poster = meta.imageUrl;
      if (poster) poster = (await mirrorToStorage(poster, 'posters', `tinff-${makeSlug(meta.title)}`)) || poster;
      const slug = await uniqueSlug('films', makeSlug(meta.title));
      const { data, error } = await db
        .from('films')
        .insert({
          title: meta.title,
          slug,
          year: meta.year || null,
          synopsis: meta.synopsis,
          poster_url: poster,
          source: 'tinff',
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
      const row = data as FilmRow;
      filmsCache.set(row.id, row);
      filmsByTitle.set(k, [{ id: row.id, label: row.title }]);
      console.log(`  🎬 created ${meta.title}`);
    }
  }

  // ── Create missing people ─────────────────────────────────────
  if (!NO_CREATE) {
    for (const [k, meta] of personMeta) {
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
      if (photo) photo = (await mirrorToStorage(photo, 'people', `tinff-${makeSlug(meta.name)}`)) || photo;
      const slug = await uniqueSlug('people', makeSlug(meta.name));
      const bioBits = [
        meta.work ? `TINFF-nominated for ${meta.category} (${meta.work}).` : `TINFF-nominated for ${meta.category}.`,
        'Profile seeded from Toronto International Nollywood Film Festival listings.',
      ];
      const { data, error } = await db
        .from('people')
        .insert({
          name: meta.name,
          slug,
          photo_url: photo,
          bio: bioBits.join(' '),
          known_for_department: dept,
          source: 'tinff',
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
      const row = data as PersonRow;
      peopleCache.set(row.id, row);
      peopleByName.set(k, [{ id: row.id, label: row.name }]);
      console.log(`  👤 created ${meta.name}`);
    }
  }

  // ── Awards + credits ──────────────────────────────────────────
  const personUpdates = new Map<string, AwardEntry[]>();
  const filmUpdates = new Map<string, AwardEntry[]>();
  const creditJobs: Array<{ filmId: string; personId: string; role: string }> = [];
  const unmatchedPeople: any[] = [];
  const unmatchedFilms: any[] = [];

  async function resolvePerson(pname: string): Promise<PersonRow | null> {
    const matches = peopleByName.get(normalizeName(pname)) || [];
    if (!matches.length) return null;
    const id = matches[0].id;
    if (!peopleCache.has(id)) {
      const row = await fetchPerson(id);
      if (row) peopleCache.set(id, row);
    }
    return peopleCache.get(id) || null;
  }

  async function resolveFilm(work: string): Promise<FilmRow | null> {
    const matches = filmsByTitle.get(normalizeName(work)) || [];
    if (!matches.length) return null;
    const id = matches[0].id;
    if (!filmsCache.has(id)) {
      const row = await fetchFilm(id);
      if (row) filmsCache.set(id, row);
    }
    return filmsCache.get(id) || null;
  }

  for (const e of entries) {
    const { role } = roleFromCategory(e.category);
    const peopleNames = expandPeople(e.people || []).filter((p) => !isJunkPersonName(p));
    if ((e.people || []).length && !peopleNames.length) stats.skippedJunkPeople += (e.people || []).length;

    let filmRow: FilmRow | null = null;
    if (e.work && !isJunkWorkTitle(e.work)) {
      filmRow = await resolveFilm(e.work);
      if (!filmRow) unmatchedFilms.push({ work: e.work, category: e.category, season: e.season, won: e.won });
    } else if (e.work) {
      stats.skippedJunkFilms++;
    }

    for (const pname of peopleNames) {
      const person = await resolvePerson(pname);
      if (!person) {
        unmatchedPeople.push({ name: pname, category: e.category, season: e.season, work: e.work, won: e.won });
        continue;
      }
      const entry: AwardEntry = {
        title: e.work || e.category,
        category: e.category,
        organization: 'TINFF',
        year: e.year,
        season: e.season,
        won: e.won,
        work: e.work,
        film_id: filmRow?.id ?? null,
      };
      if (!personUpdates.has(person.id)) personUpdates.set(person.id, []);
      personUpdates.get(person.id)!.push(entry);

      if (filmRow) creditJobs.push({ filmId: filmRow.id, personId: person.id, role });
    }

    if (filmRow) {
      const entry: AwardEntry = {
        title: e.category,
        category: e.category,
        organization: 'TINFF',
        year: e.year,
        season: e.season,
        won: e.won,
        work: e.work,
        recipients: peopleNames,
      };
      if (!filmUpdates.has(filmRow.id)) filmUpdates.set(filmRow.id, []);
      filmUpdates.get(filmRow.id)!.push(entry);

      if (!NO_CREATE && !DRY && e.imageUrl && !filmRow.poster_url) {
        const poster = await mirrorToStorage(e.imageUrl, 'posters', `tinff-${filmRow.id}`);
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

  for (const [id, add] of personUpdates) {
    const row = peopleCache.get(id) || (await fetchPerson(id));
    if (!row) continue;
    const next = mergeAwards(row.awards, add);
    if (DRY) {
      stats.peopleUpdated++;
      continue;
    }
    const { error } = await db.from('people').update({ awards: next }).eq('id', id);
    if (error) console.warn(`  person awards ${row.name}: ${error.message}`);
    else {
      stats.peopleUpdated++;
      console.log(`  👤 awards ${row.name} +${add.length}`);
    }
  }

  for (const [id, add] of filmUpdates) {
    const row = filmsCache.get(id) || (await fetchFilm(id));
    if (!row) continue;
    const next = mergeAwards(row.awards, add);
    if (DRY) {
      stats.filmsUpdated++;
      continue;
    }
    const { error } = await db.from('films').update({ awards: next }).eq('id', id);
    if (error) console.warn(`  film awards ${row.title}: ${error.message}`);
    else {
      stats.filmsUpdated++;
      console.log(`  🎬 awards ${row.title} +${add.length}`);
    }
  }

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
    organization: 'TINFF',
    entryCount: entries.length,
    stats: { ...stats, unmatchedPeople: uniqPeople.length, unmatchedFilms: uniqFilms.length },
    unmatchedPeople: uniqPeople,
    unmatchedFilms: uniqFilms,
  };
  fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2));

  console.log('\n────────────────────────────────────────');
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
