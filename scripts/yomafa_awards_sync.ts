/**
 * Import Yomafa Global Awards nominees (and leaders by vote count) into people.awards.
 *
 * Source: https://yomafaglobal.com/ (Season 18, 2026 categories live now).
 *
 *   npx tsx scripts/yomafa_awards_sync.ts --dry-run
 *   npx tsx scripts/yomafa_awards_sync.ts --apply
 *
 * Options:
 *   --season=18       Award season (default 18 from site)
 *   --year=2026       Calendar year (parsed from category when present)
 *   --only-film       Skip non film/TV person categories
 */
import * as dotenv from 'dotenv';
import { supabase } from './lib/db.js';

dotenv.config({ path: '.env.local' });
dotenv.config();

const BASE = 'https://yomafaglobal.com';
const ORG = 'YOMAFA';
const dryRun = process.argv.includes('--dry-run');
const apply = process.argv.includes('--apply');
const onlyFilm = process.argv.includes('--only-film');
const seasonArg = process.argv.find((a) => a.startsWith('--season='));
const SEASON = seasonArg ? Number(seasonArg.split('=')[1]) : 18;

const FILM_CAT_RE =
  /actor|actress|star|director|filmmaker|movie|film|nollywood|drama|producer|editor|continuity|sound|art director|production/i;

function decodeHtml(s: string) {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#039;/g, "'")
    .trim();
}

async function fetchHtml(path: string) {
  const res = await fetch(`${BASE}/${path.replace(/^\//, '')}`, {
    headers: { 'User-Agent': 'MuviDB/1.0 (+https://muvidb.com)' },
    signal: AbortSignal.timeout(45_000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${path}`);
  return res.text();
}

function parseCategories(html: string) {
  const re = /href="nominees\.php\?id=(\d+)&cat=([^"]+)"/g;
  const map = new Map<string, { id: string; category: string }>();
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const id = m[1];
    const category = decodeURIComponent(m[2].replace(/\+/g, ' '));
    map.set(id, { id, category });
  }
  return [...map.values()];
}

function parseYear(category: string) {
  const m = category.match(/\b(20\d{2})\b/);
  return m ? Number(m[1]) : new Date().getFullYear();
}

function parseNominees(html: string, category: string) {
  const year = parseYear(category);
  const blocks = html.split('card-body text-center');
  const nominees: { name: string; votes: number; category: string; year: number }[] = [];

  for (const block of blocks) {
    const nameM = block.match(/card-title font-weight-bold">\s*([^<]+?)\s*<\/h5>/);
    if (!nameM) continue;
    const name = decodeHtml(nameM[1]).replace(/\s+/g, ' ').trim();
    if (!name || name.length < 2) continue;
    const voteM = block.match(/Vote Result:[\s\S]*?<span[^>]*>\s*(\d+)\s*<\/span>/);
    const votes = voteM ? Number(voteM[1]) : 0;
    nominees.push({ name, votes, category, year });
  }
  return nominees;
}

function awardKey(a: { organization: string; year: number; season: number; category: string }) {
  return [a.organization, a.year, a.season, a.category].join('|').toLowerCase();
}

async function matchPerson(name: string) {
  const { data, error } = await supabase.rpc('match_people_by_name', {
    p_name: name,
    p_limit: 5,
  });
  if (error) {
    console.warn(`  match failed for "${name}":`, error.message);
    return null;
  }
  const rows = data || [];
  if (!rows.length) return null;
  // Prefer exact name_key / exact match kinds when present
  const exact = rows.find((r: any) => r.match_kind === 'exact' || r.match_kind === 'name_key');
  return exact || rows[0];
}

async function main() {
  if (!dryRun && !apply) {
    console.error('Pass --dry-run or --apply');
    process.exit(1);
  }

  console.log(`Fetching Yomafa categories (${onlyFilm ? 'film/TV only' : 'all'})…`);
  const catHtml = await fetchHtml('category.php');
  let categories = parseCategories(catHtml);
  if (onlyFilm) categories = categories.filter((c) => FILM_CAT_RE.test(c.category));
  console.log(`Found ${categories.length} categories`);

  type Row = {
    name: string;
    votes: number;
    category: string;
    year: number;
    won: boolean;
  };
  const all: Row[] = [];

  for (const cat of categories) {
    const html = await fetchHtml(`nominees.php?id=${cat.id}&cat=${encodeURIComponent(cat.category)}`);
    const nominees = parseNominees(html, cat.category);
    if (!nominees.length) continue;

    const maxVotes = Math.max(...nominees.map((n) => n.votes));
    for (const n of nominees) {
      // Site rule: 2000+ votes to qualify as winner; mark leader when threshold met.
      const won = n.votes >= 2000 && n.votes === maxVotes && maxVotes > 0;
      all.push({ ...n, won });
    }
    await new Promise((r) => setTimeout(r, 400));
  }

  console.log(`Parsed ${all.length} nominee rows`);

  let matched = 0;
  let updated = 0;
  let skipped = 0;
  const unmatched: string[] = [];

  for (const row of all) {
    const person = await matchPerson(row.name);
    if (!person?.id) {
      unmatched.push(`${row.name} — ${row.category}`);
      continue;
    }
    matched += 1;

    const entry = {
      organization: ORG,
      year: row.year,
      season: SEASON,
      category: row.category.replace(/\s+\d{4}$/, '').trim() || row.category,
      won: row.won,
      work: null,
      film_id: null,
    };

    const { data: existing, error: fetchErr } = await supabase
      .from('people')
      .select('id, name, awards')
      .eq('id', person.id)
      .maybeSingle();
    if (fetchErr || !existing) continue;

    const awards = Array.isArray(existing.awards) ? [...existing.awards] : [];
    const dup = awards.some(
      (a: any) =>
        String(a.organization || '').toUpperCase().includes('YOMAFA')
        && Number(a.year) === entry.year
        && Number(a.season || SEASON) === SEASON
        && String(a.category || '').toLowerCase() === entry.category.toLowerCase(),
    );
    if (dup) {
      skipped += 1;
      continue;
    }

    awards.push(entry);

    if (dryRun) {
      console.log(
        `[dry-run] ${existing.name} ← ${entry.won ? 'WIN' : 'NOM'} ${entry.category} (${entry.year}, S${SEASON})`,
      );
      continue;
    }

    const { error: upErr } = await supabase
      .from('people')
      .update({ awards })
      .eq('id', existing.id);
    if (upErr) {
      console.warn(`  update failed ${existing.name}:`, upErr.message);
    } else {
      updated += 1;
    }
  }

  console.log('\nSummary');
  console.log('  matched people:', matched);
  console.log('  updated:', apply ? updated : `(dry-run, would update ~${matched - skipped})`);
  console.log('  skipped duplicates:', skipped);
  console.log('  unmatched:', unmatched.length);
  if (unmatched.length) {
    console.log('\nUnmatched sample (create people or fix names):');
    unmatched.slice(0, 25).forEach((u) => console.log('  •', u));
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
