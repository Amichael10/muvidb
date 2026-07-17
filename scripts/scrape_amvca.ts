/**
 * Scrape AMVCA winners + nominations from DStv Africa Magic (seasons 12 → 2).
 *
 * - S11–S12: winners.json → category_nominations (winner true/false)
 * - S9–S10:  nominees.json → category_nominations; winners also in HTML bodies
 * - S2–S8:   often unavailable on DStv
 *
 * Output: scratch/amvca/entries.json
 *
 * Run: npx tsx scripts/scrape_amvca.ts
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as cheerio from 'cheerio';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.resolve(__dirname, '..', 'scratch', 'amvca');
const API = 'https://africamagic-api.dstv.com/africamagic/en-ng/show/amvca/season';
const CDN = 'https://cdn-africamagic.dstv.com';

const SEASON_YEAR: Record<number, number> = {
  12: 2026, 11: 2025, 10: 2024, 9: 2023, 8: 2022, 7: 2020,
  6: 2018, 5: 2017, 4: 2016, 3: 2015, 2: 2014,
};

export type AmvcaEntry = {
  season: number;
  year: number;
  category: string;
  work: string | null;
  people: string[];
  won: boolean;
  synopsis: string | null;
  imageUrl: string | null;
  source: 'cdn-json' | 'html-table' | 'html-paragraph';
};

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchJSON(url: string, timeoutMs = 12000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const r = await fetch(url, {
      signal: ctrl.signal,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: 'application/json,text/html,*/*',
      },
      redirect: 'follow',
    });
    const text = await r.text();
    if (!r.ok) throw new Error(`HTTP ${r.status} ${url}`);
    if (!text.trim().startsWith('{') && !text.trim().startsWith('[')) {
      throw new Error(`Not JSON: ${url}`);
    }
    return JSON.parse(text);
  } finally {
    clearTimeout(t);
  }
}

function splitPeople(raw: string): string[] {
  if (!raw) return [];
  const parts: string[] = [];
  let buf = '';
  let depth = 0;
  const s = raw.replace(/\u00a0/g, ' ');
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch === '(') depth++;
    if (ch === ')') depth = Math.max(0, depth - 1);
    if (depth === 0 && (ch === ',' || ch === '&' || ch === '/' || ch === '–' || ch === '—')) {
      if (buf.trim()) parts.push(buf.trim());
      buf = '';
      continue;
    }
    if (depth === 0 && /\s/.test(ch) && s.slice(i, i + 5).toLowerCase() === ' and ') {
      if (buf.trim()) parts.push(buf.trim());
      buf = '';
      i += 4;
      continue;
    }
    buf += ch;
  }
  if (buf.trim()) parts.push(buf.trim());
  return parts
    .map((p) => p.replace(/\s+/g, ' ').trim())
    .filter((p) => p.length > 1 && !/^(n\/a|na|tbc|-)$/i.test(p));
}

function clean(s: string) {
  return (s || '')
    .replace(/\u00a0/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&ndash;/gi, '–')
    .replace(/&mdash;/gi, '—')
    .replace(/\s+/g, ' ')
    .trim();
}

function findCategoryUrls(obj: any, out: string[] = []): string[] {
  if (!obj || typeof obj !== 'object') return out;
  if (typeof obj === 'string' && /category_nominations\/\d+\.json/.test(obj)) {
    out.push(obj.startsWith('http') ? obj : `${CDN}${obj.startsWith('/') ? '' : '/'}${obj}`);
    return out;
  }
  if (obj.url && typeof obj.url === 'string' && /category_nominations/.test(obj.url)) {
    out.push(obj.url.startsWith('http') ? obj.url : `${CDN}${obj.url}`);
  }
  if (Array.isArray(obj)) obj.forEach((x) => findCategoryUrls(x, out));
  else Object.values(obj).forEach((v) => findCategoryUrls(v, out));
  return [...new Set(out)];
}

function findHtmlBodies(obj: any, out: string[] = []): string[] {
  if (obj == null) return out;
  if (typeof obj === 'string') {
    if (obj.length > 300 && /BEST |Voting categories|winners/i.test(obj) && obj.includes('<')) {
      out.push(obj);
    }
    return out;
  }
  if (typeof obj !== 'object') return out;
  if (Array.isArray(obj)) obj.forEach((x) => findHtmlBodies(x, out));
  else Object.values(obj).forEach((v) => findHtmlBodies(v, out));
  return out;
}

function entryKey(e: AmvcaEntry) {
  return [e.season, e.category, e.work || '', e.people.join('|'), e.won ? 'W' : 'N'].join('::').toLowerCase();
}

function preferImage(img: any): string | null {
  if (!img) return null;
  const url = img.normal || img.webp || null;
  if (!url) return null;
  // Drop resize params for fuller asset when possible
  try {
    const u = new URL(url);
    u.searchParams.delete('w');
    u.searchParams.delete('h');
    return u.toString();
  } catch {
    return url;
  }
}

async function scrapeJsonCategories(season: number, urls: string[]): Promise<AmvcaEntry[]> {
  const year = SEASON_YEAR[season];
  const entries: AmvcaEntry[] = [];
  let fails = 0;

  for (const url of urls) {
    // Older seasons often 500 on CDN — bail after a few consecutive failures
    if (fails >= 4 && entries.length === 0) {
      console.warn(`  ⚠ skipping remaining ${urls.length} category URLs (CDN dead for this season)`);
      break;
    }
    try {
      const data = await fetchJSON(url, 8000);
      fails = 0;
      for (const item of data.items || []) {
        const category = clean(item.award || item.sub_title || '');
        if (!category) continue;
        entries.push({
          season,
          year,
          category,
          work: clean(item.title || '') || null,
          people: splitPeople(clean(item.name || '')),
          won: Boolean(item.winner),
          synopsis: clean(item.synopsis || '') || null,
          imageUrl: preferImage(item.image),
          source: 'cdn-json',
        });
      }
      await sleep(80);
    } catch (e: any) {
      fails++;
      console.warn(`  ⚠ category fail: ${e.message}`);
    }
  }
  return entries;
}

function parseHtmlTables(season: number, html: string): AmvcaEntry[] {
  const $ = cheerio.load(html);
  const year = SEASON_YEAR[season];
  const entries: AmvcaEntry[] = [];

  $('table tr').each((_, tr) => {
    const cells = $(tr)
      .find('td,th')
      .map((__, td) => clean($(td).text()))
      .get();
    if (cells.length < 2) return;
    const [c0, c1, c2] = cells;
    if (/movie categories|series\/film|^winner$/i.test(c0) && /series|winner/i.test(c1 || '')) return;
    if (!/^BEST |INDUSTRY|TRAILBLAZER|LIFETIME|MULTICHOICE/i.test(c0)) return;

    let work: string | null = null;
    let peopleRaw = '';
    if (c2) {
      work = c1 || null;
      peopleRaw = c2;
    } else peopleRaw = c1 || '';

    entries.push({
      season,
      year,
      category: c0,
      work,
      people: splitPeople(peopleRaw),
      won: true,
      synopsis: null,
      imageUrl: null,
      source: 'html-table',
    });
  });
  return entries;
}

function parseHtmlParagraphs(season: number, html: string): AmvcaEntry[] {
  const $ = cheerio.load(html);
  const year = SEASON_YEAR[season];
  const entries: AmvcaEntry[] = [];

  $('p')
    .map((_, p) => clean($(p).text()))
    .get()
    .forEach((line) => {
      if (!/BEST |INDUSTRY MERIT|TRAILBLAZER|LIFETIME/i.test(line)) return;
      const m = line.match(
        /^(BEST[\w\s()'\/\-]+?|INDUSTRY MERIT AWARD|TRAILBLAZER AWARDS?|LIFETIME ACHIEVEMENT(?: AWARD)?)\s*[-–—]\s*(.+)$/i
      );
      if (!m) return;
      const category = clean(m[1]);
      const rest = clean(m[2]);
      const parts = rest.split(/\s*[-–—]\s*/).map(clean).filter(Boolean);
      let people: string[] = [];
      let work: string | null = null;
      if (parts.length >= 2) {
        work = parts[parts.length - 1];
        people = splitPeople(parts.slice(0, -1).join(' & '));
      } else {
        people = splitPeople(rest);
      }
      entries.push({
        season,
        year,
        category,
        work,
        people,
        won: true,
        synopsis: null,
        imageUrl: null,
        source: 'html-paragraph',
      });
    });
  return entries;
}

async function scrapeSeason(season: number): Promise<{ entries: AmvcaEntry[]; note?: string }> {
  const pages: any[] = [];
  for (const path of ['winners', 'nominees']) {
    try {
      const page = await fetchJSON(`${API}/${season}/${path}.json`);
      if (!page.redirect_url) pages.push(page);
    } catch {
      /* missing page ok */
    }
  }
  if (!pages.length) return { entries: [], note: 'no winners/nominees pages' };

  const urls = [...new Set(pages.flatMap((p) => findCategoryUrls(p)))];
  const byKey = new Map<string, AmvcaEntry>();

  if (urls.length) {
    const fromJson = await scrapeJsonCategories(season, urls);
    for (const e of fromJson) byKey.set(entryKey(e), e);
  }

  // HTML winner bodies (S9/S10 winners pages) — only add if not already present as win
  for (const page of pages) {
    const bodies = findHtmlBodies(page);
    const htmlEntries = [
      ...bodies.flatMap((b) => parseHtmlTables(season, b)),
      ...bodies.flatMap((b) => parseHtmlParagraphs(season, b)),
    ];
    for (const e of htmlEntries) {
      const k = entryKey(e);
      if (!byKey.has(k)) byKey.set(k, e);
    }
  }

  const entries = [...byKey.values()];
  const wins = entries.filter((e) => e.won).length;
  const noms = entries.filter((e) => !e.won).length;
  return {
    entries,
    note: `cats=${urls.length} wins=${wins} noms=${noms}`,
  };
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const all: AmvcaEntry[] = [];
  const report: Record<string, any> = {};

  // Seasons 2–8 category CDN endpoints are largely dead (HTTP 500).
  // Focus on 9–12 where winners/noms are available.
  const fromIdx = process.argv.indexOf('--from');
  const from = fromIdx >= 0 ? Number(process.argv[fromIdx + 1]) || 9 : 9;
  for (let season = 12; season >= from; season--) {
    console.log(`\n══ Season ${season} (${SEASON_YEAR[season]}) ══`);
    const { entries, note } = await scrapeSeason(season);
    report[season] = {
      year: SEASON_YEAR[season],
      total: entries.length,
      wins: entries.filter((e) => e.won).length,
      noms: entries.filter((e) => !e.won).length,
      note,
    };
    console.log(`  ${entries.length} entries · ${note || ''}`);
    all.push(...entries);
    await sleep(200);
  }

  const outPath = path.join(OUT_DIR, 'entries.json');
  // Keep winners.json alias for older scripts
  const payload = {
    scrapedAt: new Date().toISOString(),
    total: all.length,
    wins: all.filter((e) => e.won).length,
    nominations: all.filter((e) => !e.won).length,
    bySeason: report,
    entries: all,
  };
  fs.writeFileSync(outPath, JSON.stringify(payload, null, 2));
  fs.writeFileSync(path.join(OUT_DIR, 'winners.json'), JSON.stringify({
    ...payload,
    wins: all.filter((e) => e.won),
  }, null, 2));

  console.log(`\n✅ ${all.length} entries (${payload.wins} wins / ${payload.nominations} noms) → ${outPath}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
