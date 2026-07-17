/**
 * Apply AMVCA winners + nominations from scratch/amvca/entries.json:
 *  1. Create missing films (poster + synopsis from DStv nomination cards)
 *  2. Create missing people (role from category; photo when available)
 *  3. Link credits (person ↔ film + role)
 *  4. Append awards to people.awards / films.awards (won: true|false)
 *
 * Run:
 *   npx tsx scripts/apply_amvca_awards.ts
 *   npx tsx scripts/apply_amvca_awards.ts --dry-run
 *   npx tsx scripts/apply_amvca_awards.ts --no-create   # awards only, no new rows
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ENTRIES_PATH = path.resolve(__dirname, '..', 'scratch', 'amvca', 'entries.json');
const FALLBACK_WINS = path.resolve(__dirname, '..', 'scratch', 'amvca', 'winners.json');
const REPORT_PATH = path.resolve(__dirname, '..', 'scratch', 'amvca', 'apply-report.json');

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ Missing Supabase credentials');
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
  organization: 'AMVCA';
  year: number;
  season: number;
  won: boolean;
  work?: string | null;
  recipients?: string[];
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

function isJunkPersonName(name: string) {
  const n = normalizeName(name);
  if (!n || n.length < 2) return true;
  if (/^(hausa|igbo|yoruba|swahili|africa|movie|tv series|n a)$/.test(n)) return true;
  if (/^\(.*\)$/.test(name.trim())) return true;
  // Titles that leaked into person field
  if (/^(breath of life|anikulapo|brotherhood|shanty town|her dark past)$/.test(n)) return true;
  return false;
}

function isJunkWorkTitle(work: string) {
  const n = normalizeName(work);
  if (!n || n.length < 2) return true;
  // Person names wrongly placed as work
  if (/^(wale ojo|samuel perry|loukman ali)$/.test(n)) return true;
  return false;
}

/** Map AMVCA category → credit role + known_for_department */
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

function awardKey(a: AwardEntry) {
  return [a.organization, a.season, a.category, a.work || '', a.title, a.won ? 'W' : 'N']
    .join('|')
    .toLowerCase();
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
      // Upgrade nomination → win if needed; never downgrade
      if (a.won && !list[idx].won) list[idx] = { ...list[idx], ...a, won: true };
      continue;
    }
    list.push(a);
    byBase.set(base, list.length - 1);
  }
  return list;
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
        Referer: 'https://www.dstv.com/',
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
  const entries = loadEntries();
  if (!entries.length) {
    console.error('❌ No entries — run: npx tsx scripts/scrape_amvca.ts');
    process.exit(1);
  }

  console.log(`📦 ${entries.length} AMVCA entries (${entries.filter((e) => e.won).length} wins / ${entries.filter((e) => !e.won).length} noms)`);
  console.log(`   dry-run=${DRY} create=${!NO_CREATE}`);

  console.log('📥 Loading people + films...');
  const people = await loadAll('people', 'id, name, awards, photo_url, bio, known_for_department, slug');
  let films = await loadAll('films', 'id, title, awards, poster_url, synopsis, slug, year');
  console.log(`   people=${people.length} films=${films.length}`);

  const peopleByName = new Map<string, any[]>();
  for (const p of people) {
    const k = normalizeName(p.name);
    if (!k) continue;
    if (!peopleByName.has(k)) peopleByName.set(k, []);
    peopleByName.get(k)!.push(p);
  }
  const filmsByTitle = new Map<string, any[]>();
  for (const f of films) {
    const k = normalizeName(f.title);
    if (!k) continue;
    if (!filmsByTitle.has(k)) filmsByTitle.set(k, []);
    filmsByTitle.get(k)!.push(f);
  }

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

  // ── Create missing films ──────────────────────────────────────
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
      if (poster) poster = (await mirrorToStorage(poster, 'posters', `amvca-${makeSlug(meta.title)}`)) || poster;
      const slug = await uniqueSlug('films', makeSlug(meta.title));
      const { data, error } = await db
        .from('films')
        .insert({
          title: meta.title,
          slug,
          year: meta.year || null,
          synopsis: meta.synopsis,
          poster_url: poster,
          source: 'amvca',
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
      console.log(`  🎬 created ${meta.title}`);
    }
  }

  // ── Create missing people ─────────────────────────────────────
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
      if (photo) photo = (await mirrorToStorage(photo, 'people', `amvca-${makeSlug(meta.name)}`)) || photo;
      const slug = await uniqueSlug('people', makeSlug(meta.name));
      const bioBits = [
        meta.work ? `AMVCA-nominated for ${meta.category} (${meta.work}).` : `AMVCA-nominated for ${meta.category}.`,
        'Profile seeded from Africa Magic / DStv AMVCA listings.',
      ];
      const { data, error } = await db
        .from('people')
        .insert({
          name: meta.name,
          slug,
          photo_url: photo,
          bio: bioBits.join(' '),
          known_for_department: dept,
          source: 'amvca',
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
      console.log(`  👤 created ${meta.name}`);
    }
  }

  // ── Awards + credits ──────────────────────────────────────────
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
      const matches = filmsByTitle.get(normalizeName(e.work)) || [];
      filmRow = matches[0] || null;
      if (!filmRow) unmatchedFilms.push({ work: e.work, category: e.category, season: e.season, won: e.won });
    } else if (e.work) {
      stats.skippedJunkFilms++;
    }

    for (const pname of peopleNames) {
      const matches = peopleByName.get(normalizeName(pname)) || [];
      const person = matches[0];
      if (!person) {
        unmatchedPeople.push({ name: pname, category: e.category, season: e.season, work: e.work, won: e.won });
        continue;
      }
      const entry: AwardEntry = {
        title: e.work || e.category,
        category: e.category,
        organization: 'AMVCA',
        year: e.year,
        season: e.season,
        won: e.won,
        work: e.work,
      };
      if (!personUpdates.has(person.id)) personUpdates.set(person.id, { row: person, add: [] });
      personUpdates.get(person.id)!.add.push(entry);

      if (filmRow) creditJobs.push({ filmId: filmRow.id, personId: person.id, role });
    }

    if (filmRow) {
      const entry: AwardEntry = {
        title: e.category,
        category: e.category,
        organization: 'AMVCA',
        year: e.year,
        season: e.season,
        won: e.won,
        work: e.work,
        recipients: peopleNames,
      };
      if (!filmUpdates.has(filmRow.id)) filmUpdates.set(filmRow.id, { row: filmRow, add: [] });
      filmUpdates.get(filmRow.id)!.add.push(entry);

      // Enrich empty poster/synopsis on existing films
      if (!NO_CREATE && !DRY && e.imageUrl && !filmRow.poster_url) {
        const poster = await mirrorToStorage(e.imageUrl, 'posters', `amvca-${filmRow.id}`);
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
      console.log(`  👤 awards ${row.name} +${add.length}`);
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
      console.log(`  🎬 awards ${row.title} +${add.length}`);
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
