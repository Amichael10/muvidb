/**
 * Scrape AMAA winners + nominations from ama-awards.com.
 *
 * Primary source: year tabs on https://ama-awards.com/amaa-winners/
 * Extra: scratch/amaa/raw-nom-*.txt (or live nomination pages).
 *
 * Output: scratch/amaa/entries.json
 * Run: npx tsx scripts/scrape_amaa.ts
 *      npx tsx scripts/scrape_amaa.ts --from-panels
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as cheerio from 'cheerio';
import { chromium } from 'playwright';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.resolve(__dirname, '..', 'scratch', 'amaa');
const PANELS_DIR = path.join(OUT_DIR, 'panels');

export type AmaaEntry = {
  season: number;
  year: number;
  category: string;
  work: string | null;
  people: string[];
  won: boolean;
  country: string | null;
  source: string;
};

const COUNTRIES = [
  'Trinidad & Tobago', 'United Kingdom', 'United States', 'South Africa', 'Burkina Faso',
  'Ivory Coast', "Cote d'Ivoire", "Côte d'Ivoire", 'Cote De Voire', "Cote D'Ivoire",
  'Sierra Leone', 'Mozambique', 'Mauritania', 'Cameroon', 'Cameroun', 'Ethiopia',
  'Nigeria', 'Kenya', 'Uganda', 'Ghana', 'Senegal', 'Rwanda', 'Namibia', 'Angola',
  'Egypt', 'Tanzania', 'Zimbabwe', 'Botswana', 'Morocco', 'Morroco', 'Tunisia',
  'Algeria', 'Somalia', 'DRC', 'Congo', 'Togo', 'Benin', 'Mali', 'Niger', 'Chad',
  'Gabon', 'Liberia', 'Gambia', 'Jamaica', 'Brazil', 'Belgium', 'Canada', 'USA',
  'UK', 'US', 'S. Africa', 'Guinea', 'Lesotho', 'Sudan', 'Haiti', 'Switzerland',
  'Peru', 'Bahamas', 'Mauritius', 'Equatorial Guinea', 'Iceland', 'Martinique',
  'Australia', 'Barbados', 'Germany', 'France', 'Denmark',
].sort((a, b) => b.length - a.length);

const PERSON_CATEGORY =
  /ACTOR|ACTRESS|\bACT\b|DIRECTOR|PROMISING|YOUNG|CHILD|UP-?COMING|UPCOMING|DEBUT|FIRST FEATURE|ARTISTE|PERFORMANCE BY|SUPPORTING ACTRESS|SUPPORTING ACTOR/i;

function seasonFromYear(year: number) {
  return Math.max(1, year - 2004);
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function clean(s: string) {
  return (s || '')
    .replace(/\u00a0/g, ' ')
    .replace(/[•·▪◦]/g, '•')
    .replace(/\s+/g, ' ')
    .trim();
}

function splitCleanLines(text: string): string[] {
  return text.split(/\n+/).map(clean).filter(Boolean);
}

function loadHtmlRoot(html: string) {
  return cheerio.load(`<div id="root">${html}</div>`);
}

function normalizeCountry(c: string) {
  const x = c.trim();
  if (/^S\.\s*Africa$/i.test(x)) return 'South Africa';
  if (/^(US|USA)$/i.test(x)) return 'United States';
  if (/^UK$/i.test(x)) return 'United Kingdom';
  if (/^Cameroun$/i.test(x)) return 'Cameroon';
  return x;
}

function stripCountry(raw: string): { text: string; country: string | null } {
  let text = clean(raw)
    .replace(/\s*[–—-]\s*WINNER\s*$/i, '')
    .replace(/\s*[\(\[]\s*WINNER\s*[\)\]]\s*$/i, '')
    .replace(/\s+WINNER\s*$/i, '')
    .trim();
  let country: string | null = null;
  for (const c of COUNTRIES) {
    const re = new RegExp(
      `(?:[–—-]|\\(|\\s)\\s*${escapeRegex(c)}(?:\\/[A-Za-z &]+)?\\)?\\s*$`,
      'i',
    );
    if (re.test(text)) {
      country = normalizeCountry(c);
      text = text.replace(re, '').replace(/[()]$/, '').trim();
      break;
    }
  }
  return { text, country };
}

function hasWinnerMark(raw: string) {
  // Note: site often jams "WINNER5." so \bWINNER\b fails before digits
  return /\[?\(?\s*WINNER\s*\)?\]?/i.test(raw);
}

function markWinner(raw: string): { text: string; won: boolean } {
  const won = hasWinnerMark(raw);
  const text = raw
    .replace(/\s*[\(\[]\s*WINNER\s*[\)\]]/gi, '')
    .replace(/\s*[–—-]\s*WINNER(?=\d|\W|$)/gi, '')
    .replace(/\s*WINNER(?=\d|\W|$)/gi, '')
    .trim();
  return { text, won };
}

function normalizeCategory(raw: string) {
  return clean(raw)
    .replace(/^\d+\.\s*/, '')
    .replace(/^[A-Z]\.\s*/, '')
    .replace(/^AMAA\s+\d{4}\s*[-–—]?\s*/i, '')
    .replace(/^WINNER\s+FOR\s+/i, '')
    .replace(/^AWARD FOR\s+/i, '')
    .replace(/^PRIZE FOR\s+/i, '')
    .replace(/^FOR\s+/i, '')
    .replace(/^BEST\s+ACHIEVEMENT\s+IN\s+/i, 'ACHIEVEMENT IN ')
    .replace(/^AWARD FOR BEST ACHIEVEMENT IN\s+/i, 'ACHIEVEMENT IN ')
    .replace(/ADIRECTOR/i, 'A DIRECTOR')
    .replace(/SCREEN PLAY/i, 'SCREENPLAY')
    .replace(/VISUAL EFFECT$/i, 'VISUAL EFFECTS')
    .replace(/MALAFIA/i, 'MALAIFIA')
    .replace(/^-\s*/, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
}

function isCategoryish(line: string) {
  const l = clean(line);
  if (!l || l.length < 4 || l.length > 240) return false;
  if (/^(AMAA\s+)?20\d{2}\s+WINNERS?/i.test(l)) return false;
  if (/share:|leave a reply|authored by|date released|recent posts|comments|skip to content|advertisement|no comments/i.test(l)) {
    return false;
  }
  return /award for|prize for|best |achievement in|efere ozako|jubril|ousmane sembene|michael anyiam|nfvcb|national film|lagos state|tony elumelu|debut|first feature|special (jury|recognition|achievement)|lifetime|heart of africa|madiba|most promising|performance by/i.test(
    l,
  );
}

function looksLikeFilmTitle(s: string) {
  const t = clean(s);
  if (!t) return false;
  if (/^(the|a|an)\s+/i.test(t) && t.split(/\s+/).length >= 2) return true;
  if (/queen of|gone too far|timbuktu|october|triangle|fevers|supremacy|njinga/i.test(t)) return true;
  if (/,/.test(t) && t.split(/\s+/).length >= 3) return true;
  return false;
}

function splitPersonWork(raw: string, category: string) {
  const { text, country } = stripCountry(raw);
  if (!text) return { people: [] as string[], work: null as string | null, country };

  const isPersonCat = PERSON_CATEGORY.test(category);
  // Only split on en/em dash or spaced hyphen — never bare hyphens (Kate Henshaw-Nuttal)
  const parts = text
    .split(/\s*[–—]\s*|\s+-\s+/)
    .map(clean)
    .filter(Boolean);

  if (parts.length >= 2) {
    if (isPersonCat) {
      if (/DEBUT|FIRST FEATURE/i.test(category) && parts[0] === parts[0].toUpperCase() && parts[0].length > 8) {
        return { people: [parts.slice(1).join(' – ')], work: parts[0], country };
      }
      if (/DIRECTOR/i.test(category) && !/DEBUT|FIRST/i.test(category)) {
        // "Destiny Ekaragha Gone Too Far" sometimes lacks a dash — handled below
        const work = parts.slice(1).join(' – ').replace(/^\(|\)$/g, '').trim();
        return { people: [parts[0]], work: work || null, country };
      }
      return { people: [parts[0]], work: parts.slice(1).join(' – '), country };
    }
    return { people: [] as string[], work: parts[0], country };
  }

  // Close truncated parens: "Samson Tadese (Triangle Going to America,"
  const fixedParen = text.replace(/\(([^)]+)$/, '($1)');
  const paren = fixedParen.match(/^(.+?)\s*\((.+)\)$/);
  if (paren && isPersonCat) {
    return { people: [clean(paren[1])], work: clean(paren[2]).replace(/,\s*$/, ''), country };
  }

  // "Destiny Ekaragha Gone Too Far" (director + film, no dash) — max 2-token name
  if (isPersonCat && /DIRECTOR|DEBUT|FIRST FEATURE/i.test(category)) {
    const m = text.match(/^([A-Z][a-z]+(?:\s+[A-Z][a-z.]+)?)\s+([A-Z][\w'’].{2,})$/);
    if (m && !/\band\b/i.test(m[1])) {
      return { people: [clean(m[1])], work: clean(m[2]), country };
    }
  }

  // Joint nominees with films: "A (Film) and B (Film)"
  if (isPersonCat && /\band\b/i.test(text) && /\([^)]+\)/.test(text)) {
    const bits = text.split(/\s+and\s+/i).map(clean).filter(Boolean);
    if (bits.length >= 2 && bits.every((b) => /\([^)]+\)/.test(b))) {
      // Caller only accepts one row — use first; second recovered via push in parseParagraph if needed
      const p0 = bits[0].match(/^(.+?)\s*\((.+)\)$/);
      if (p0) return { people: [clean(p0[1])], work: clean(p0[2]), country };
    }
  }

  // Joint child actors: "Name and Name FilmTitle"
  if (isPersonCat && /\band\b/i.test(text)) {
    const tailFilm = text.match(/^(.+?)\s+and\s+(.+)\s+(\S+)$/i);
    if (tailFilm && looksLikeFilmTitle(tailFilm[3])) {
      return { people: [clean(tailFilm[1]), clean(tailFilm[2])], work: clean(tailFilm[3]), country };
    }
    const joint = text.match(/^(.+?)\s+and\s+(.+?)\s+([A-Z][\w'’][\w'’ -]{2,})$/i);
    if (joint && looksLikeFilmTitle(joint[3])) {
      return { people: [clean(joint[1]), clean(joint[2])], work: clean(joint[3]), country };
    }
  }

  // Source listed a film under an acting category (e.g. "Njinga, Queen of Angola")
  if (isPersonCat && looksLikeFilmTitle(text) && !/^[A-Z][a-z]+\s+[A-Z][a-z]+$/.test(text)) {
    return { people: [] as string[], work: text, country };
  }

  if (isPersonCat) return { people: [text], work: null, country };
  return { people: [] as string[], work: text, country };
}

function pushEntry(
  entries: AmaaEntry[],
  year: number,
  category: string,
  value: string,
  defaultWon: boolean,
  source: string,
) {
  const { text, won: marked } = markWinner(value);
  if (!text || text.length < 2) return;
  if (/^(joint winners|other awards|we wish|special recognition africa magic)/i.test(text)) return;
  const cat = normalizeCategory(category);
  if (!cat || cat.length < 4) return;
  if (/^WINNERS?$/i.test(cat)) return;

  const parsed = splitPersonWork(text, cat);
  if (!parsed.work && !parsed.people.length) return;
  if (parsed.work === '•' || parsed.people[0] === '•') return;

  entries.push({
    season: seasonFromYear(year),
    year,
    category: cat,
    work: parsed.work,
    people: parsed.people
      .map((p) => p.replace(/^\.+/, '').trim())
      .filter((p) => p && p.length > 1),
    won: marked || defaultWon,
    country: parsed.country,
    source,
  });
}

/** Push "A (Film) and B (Film2)" as separate entries when every part looks valid. */
function pushAndSeparatedParts(
  entries: AmaaEntry[],
  year: number,
  category: string,
  value: string,
  source: string,
  partOk: (part: string) => boolean,
): boolean {
  if (!/\band\b/i.test(value)) return false;
  const parts = value.split(/\s+and\s+/i).map(clean).filter(Boolean);
  if (parts.length < 2 || !parts.every(partOk)) return false;
  for (const part of parts) pushEntry(entries, year, category, part, true, source);
  return true;
}

/** Split jammed text before common category anchors. */
function splitBeforeCategories(text: string): string {
  let t = text.replace(/\r/g, '');
  t = t.replace(/•/g, '\n• ');
  // "WINNER5." / "WINNERAMAA" → break after WINNER
  t = t.replace(/WINNER(?=\d|[A-Z])/gi, 'WINNER\n');
  t = t.replace(/(?<=\S)(?=\d{1,2}[.,]\s+)/g, '\n');
  t = t.replace(/(?<=\S)(?=[A-Z]\.\s+[A-Za-z])/g, '\n');
  t = t.replace(
    /(?<=\S)(?=(?:AMAA\s+20\d{2}|EFERE\s+OZAKO|JUBRIL\s+MALA|OUSMANE\s+SEMBENE|MICHAEL\s+ANYIAM|NATIONAL\s+FILM|NFVCB|Best\s+(?:Film|Director|Actor|Actress|Documentary|Animation|Short|Nigerian|Diaspora|Young|Child|Supporting|Achievement|Indigenous|Picture|Edit|Sound|Costume|Visual|Production|Make|Screenplay|Cinematography|Promising|Performance|Original|Effect|Music|Art|Feature|Comedy)|Achievement\s+in|Winner\s+for|Most\s+Promising|Heart\s+of\s+Africa|Lifetime|Special\s+(?:Jury|Recognition|Achievement)|MADIBA|Posthumous|Lagos\s+state|Tony\s+Elumelu))/gi,
    '\n',
  );
  // After a country, next Title Case film often starts immediately
  const countryAlt = COUNTRIES.map(escapeRegex).join('|');
  t = t.replace(new RegExp(`(?<=(?:${countryAlt}))(?=[A-Z][a-zA-Z])`, 'g'), '\n');
  return t;
}

function parsePairsFromExpanded(
  text: string,
  year: number,
  source: string,
  opts: { defaultWon: boolean; requireWinnerMarks?: boolean },
): AmaaEntry[] {
  const lines = splitCleanLines(splitBeforeCategories(text));
  const entries: AmaaEntry[] = [];
  let category: string | null = null;
  const hasMarks = hasWinnerMark(text);
  const defaultWon = opts.requireWinnerMarks ? false : opts.defaultWon;

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i].replace(/^•\s*/, '');
    if (!line || /^(AMAA\s+)?20\d{2}\s+WINNERS?/i.test(line)) continue;
    if (/^\*\*\*|^\d{4} AFRICA MOVIE/i.test(line)) continue;

    // "Category: value" on one line
    const colon = line.match(/^(.{6,160}?):\s*(.+)$/);
    if (colon && isCategoryish(colon[1]) && !/^\d+\./.test(colon[1])) {
      pushEntry(entries, year, colon[1], colon[2], defaultWon, source);
      category = colon[1];
      continue;
    }

    if (line.endsWith(':') && isCategoryish(line.slice(0, -1))) {
      category = line.slice(0, -1);
      continue;
    }

    if ((/^\d+\.\s+/.test(line) || /^[A-Z]\.\s+/.test(line)) && isCategoryish(line)) {
      category = line;
      continue;
    }

    if (isCategoryish(line) && !/^\d+\.\s/.test(line)) {
      const bits = [line];
      while (i + 1 < lines.length) {
        const next = lines[i + 1].replace(/^•\s*/, '');
        if (
          /^(BY AN AFRICAN|FEATURE|AFRICAN-BORN|NARRATIVE|\(NFVCB\)|LIVING ABROAD|DIRECTOR|ROLE:)/i.test(next)
          || (next.length < 55 && !/[–—-]/.test(next) && !/^\d+\./.test(next) && !isCategoryish(next) && !/\bWINNER\b/i.test(next) && !/^[A-Z][a-z]/.test(next))
        ) {
          bits.push(next);
          i++;
          continue;
        }
        break;
      }
      category = bits.join(' ');
      continue;
    }

    if (!category) continue;
    pushEntry(entries, year, category, line.replace(/^\d+\.\s*/, ''), defaultWon, source);
  }

  if (opts.defaultWon && !hasMarks) {
    for (const e of entries) e.won = true;
  }
  return entries;
}

/** 2011: Best Film-Viva RivaBest Director-... */
function parseHyphenWinners(text: string, year: number, source: string): AmaaEntry[] {
  const entries: AmaaEntry[] = [];
  const re = /(Best [A-Za-z /()]+?|Achievement In [A-Za-z /]+?)-([^B]+?)(?=Best |Achievement In |$)/gi;
  let m: RegExpExecArray | null;
  const flat = clean(text);
  while ((m = re.exec(flat))) {
    pushEntry(entries, year, m[1], m[2], true, source);
  }
  return entries;
}

/** 2022/2023 style: CATEGORYValue – CountryCATEGORY... with optional • */
function parseInlineWinnerList(text: string, year: number, source: string): AmaaEntry[] {
  const entries: AmaaEntry[] = [];
  let t = text.replace(/\r/g, '').replace(/•/g, '\n• ');

  // Break before each award header
  t = t.replace(
    /(?=(?:Efere\s+Ozako|Jubril\s+Mala|Ousmane\s+Sembene|Michael\s+Anyiam|National\s+Film|AMAA\s+20\d{2}|Best\s+(?:Documentary|Diaspora|Achievement|Young|Actor|Actress|Director|Film|Animation|Short|Debut|First)|Debut\s+Feature|First\s+Debut))/gi,
    '\n',
  );

  const catTail =
    /^(.*?(?:SHORT\s*FILM|ANIMATION|DOCUMENTARY|AFRICAN\s*LANGUAGE|LIVING\s*ABROAD|DIASPORA\s*SHORT(?:\s*FILM)?|DIASPORA\s*DOCUMENTARY|DIASPORA\s*NARRATIVE\s*FEATURE|PRODUCTION\s*DESIGN|COSTUME\s*DESIGN|MAKE-?UP|SOUNDTRACK|VISUAL\s*EFFECTS?|SOUND|CINEMATOGRAPHY|EDITING|SCREEN\s*PLAY|SCREENPLAY|NIGERIAN\s*FILM|YOUNG\/?\s*PROMISING\s*ACTOR|ACTOR\s*IN\s*A\s*SUPPORTING\s*ROLE|ACTRESS\s*IN\s*A\s*SUPPORTING\s*ROLE|ACTOR\s*IN\s*A\s*LEADING\s*ROLE|ACTRESS\s*IN\s*A\s*LEADING\s*ROLE|FIRST\s*FEATURE\s*BY\s*A\s*DIRECTOR|BEST\s*DIRECTOR|BEST\s*FILM|BEST\s*ACHIEVEMENT\s*IN\s*[A-Z ]+))\s*(.+)$/i;

  for (const line of splitCleanLines(t)) {
    const bullet = line.match(/^(.+?)\s*•\s*(.+)$/);
    if (bullet && isCategoryish(bullet[1])) {
      pushEntry(entries, year, bullet[1], bullet[2], true, source);
      continue;
    }

    const m = line.match(catTail);
    if (m && isCategoryish(m[1]) && m[2] && !isCategoryish(m[2])) {
      pushEntry(entries, year, m[1], m[2].replace(/^8/, ''), true, source);
      continue;
    }

    // Soft split: last ALLCAPS/category-ish chunk vs Title Case value
    const soft = line.match(/^(.{12,140}?(?:FILM|ANIMATION|DOCUMENTARY|DESIGN|MAKE-UP|SOUNDTRACK|EFFECTS|SOUND|CINEMATOGRAPHY|EDITING|SCREENPLAY|ACTOR|ACTRESS|DIRECTOR|LANGUAGE|ABROAD|FEATURE))([A-Z].{2,})$/i);
    if (soft && isCategoryish(soft[1])) {
      pushEntry(entries, year, soft[1], soft[2], true, source);
    }
  }
  return entries;
}

/** 2009/2010 dash or colon winners */
function parseSimpleDashWinners(text: string, year: number, source: string): AmaaEntry[] {
  const entries: AmaaEntry[] = [];
  for (const line of splitCleanLines(splitBeforeCategories(text))) {
    const dash = line.match(/^(.{8,120}?)\s*[–—]\s*(.+)$/);
    if (dash && isCategoryish(dash[1])) {
      pushEntry(entries, year, dash[1], dash[2], true, source);
      continue;
    }
    const colon = line.match(/^(.{8,120}?):\s*(.+)$/);
    if (colon && isCategoryish(colon[1])) {
      pushEntry(entries, year, colon[1], colon[2], true, source);
    }
  }
  return entries;
}

/**
 * 2010 jammed one-liner: AMAA BEST …: WINNER (FILM)AMAA BEST …: …
 * Also covers 2013 "AMAA 2013 Prize For …: value" when splitBeforeCategories under-splits.
 */
function parseAmaaColonWinners(text: string, year: number, source: string): AmaaEntry[] {
  const entries: AmaaEntry[] = [];
  const flat = clean(text)
    .replace(/\s+/g, ' ')
    // Fix common jam typos before splitting
    .replace(/LEADINGROLE/gi, 'LEADING ROLE')
    .replace(/MAKE:\s*UP/gi, 'MAKE-UP')
    .replace(/PICTURES(?=\s)/gi, 'PICTURE');

  // Split before each AMAA / Lifetime / Special header
  const chunks = flat
    .split(/(?=(?:AMAA\s+(?:20\d{2}\s+)?(?:BEST|ACHIEVEMENT|MOST|HEART|PRIZE)|Lifetime\s+Achievement|Special\s+(?:Jury|Recognition)))/i)
    .map(clean)
    .filter((c) => c.length > 8);

  for (const chunk of chunks) {
    const m = chunk.match(
      /^(?:AMAA\s+(?:20\d{2}\s+)?)?(?:Prize\s+For\s+)?(.+?)\s*:\s*(.+)$/i,
    );
    if (!m) continue;
    let category = m[1].replace(/^AMAA\s+/i, '').trim();
    let value = m[2].trim();
    // Stop value at next jammed AMAA header if split missed it
    value = value.replace(/\s*AMAA\s+(?:20\d{2}\s+)?(?:BEST|ACHIEVEMENT|MOST|HEART|PRIZE).*$/i, '').trim();
    if (!category || !value || value.length < 2) continue;
    if (/^(Lifetime|Special)/i.test(chunk) && !/Prize|Best|Achievement/i.test(category)) {
      category = chunk.split(':')[0];
      value = m[2];
    }
    // "PERSON (FILM) AND PERSON2 (FILM2)" → push each; joint awards stay one row with both names when no second film
    if (
      pushAndSeparatedParts(
        entries,
        year,
        category,
        value,
        source,
        (p) => /\([^)]+\)/.test(p) || /[–—]/.test(p),
      )
    ) {
      continue;
    }
    pushEntry(entries, year, category, value, true, source);
  }
  return entries;
}

/** 2015: "Best Animation TitleBest Child Actor Name …" winners-only jam */
function parse2015Winners(text: string, year: number, source: string): AmaaEntry[] {
  const entries: AmaaEntry[] = [];
  let t = clean(text)
    .replace(/[''′]/g, "'")
    .replace(/[""]/g, '"');

  t = t.replace(
    /(?=(?:Best\s+(?:Animation|Child\s+Actor|Nigerian\s+[Ff]ilm|Documentary|Diaspora|Short\s+Film|Film\/?Picture|Film\s+By|visual\s+effect|Comedy\s+Film|Actor|Actress|Act\s+in|supporting\s+actress|Promising|First\s+Feature)|Winner\s+for\s+Achievement|Achievement\s+[Ii]n|Special\s+Jury|Life\s+achievement|Posthumous|Other\s+awards|Tony\s+Elumelu))/g,
    '\n',
  );

  for (const line of splitCleanLines(t)) {
    if (/^(Other awards|Tony Elumelu|Special recognition)/i.test(line)) continue;
    const m = line.match(
      /^(Best\s+.+?|Winner\s+for\s+Achievement\s+[Ii]n\s+.+?|Achievement\s+[Ii]n\s+.+?|Special\s+Jury\s+Prize|Life\s+achievement\s+award|Posthumous\s+award)\s+(.+)$/i,
    );
    if (!m) continue;
    const category = m[1];
    const value = m[2].replace(/["\u201C\u201D]+$/g, '').trim();
    if (/Life achievement|Posthumous/i.test(category)) continue;
    pushEntry(entries, year, category, value, true, source);
  }
  return entries;
}

/**
 * 2008: two-column Elementor flatten — category headers then "Name – Film" rows.
 * No WINNER marks on the site; treat Name–Film rows as nominations only.
 * Film-only blocks under Best Picture / craft categories stay as nominations too.
 */
function parse2008NomList(text: string, year: number, source: string): AmaaEntry[] {
  const entries: AmaaEntry[] = [];
  const CATEGORY_HEADERS = [
    'Best Picture',
    'Best Director',
    'Best Actress in a leading role',
    'Best Actor in a leading role',
    'Best Actress in a Supporting Role',
    'Best Actor in a Supporting Role',
    'Best Upcoming Actress',
    'Best Upcoming Actor',
    'Best Child Actor',
    'Best Indigenous Film',
    'Most Outstanding Actress Indigenous',
    'Most Outstanding Actor Indigenous',
    'Best Effect',
    'Best Music',
    'Best Costume',
    'Heart of Africa',
    'Best Feature Documentary',
    'Best Short Documentary',
    'Best Art Direction',
    'Best Screenplay',
    'Best Editing',
    'Best Sound',
    'Best Cinematography',
    'Best Make-up',
  ].sort((a, b) => b.length - a.length);

  function startsWithHeader(line: string, header: string): boolean {
    return new RegExp(`^${escapeRegex(header)}`, 'i').test(line);
  }
  function isExactHeader(line: string, header: string): boolean {
    return new RegExp(`^${escapeRegex(header)}$`, 'i').test(line);
  }

  let t = clean(text);
  for (const h of CATEGORY_HEADERS) {
    t = t.replace(new RegExp(`(?=${escapeRegex(h)})`, 'i'), '\n');
  }

  let category: string | null = null;
  for (const line of splitCleanLines(t)) {
    const header = CATEGORY_HEADERS.find((h) => isExactHeader(line, h));
    if (header) {
      category = header;
      continue;
    }
    // Two headers jammed on one line without body yet
    const dual = CATEGORY_HEADERS.find((h) => startsWithHeader(line, h));
    if (dual && line.length <= dual.length + 2) {
      category = dual;
      continue;
    }
    if (!category) continue;

    // Split jammed "Name – FilmName2 – Film2"
    const pieces = line.split(/(?<=\S)(?=[A-Z][a-zA-Z].{0,40}?\s*[–—]\s*)/).map(clean).filter(Boolean);
    const rows = pieces.length > 1 ? pieces : [line];
    for (const row of rows) {
      if (CATEGORY_HEADERS.some((h) => startsWithHeader(row, h))) continue;
      pushEntry(entries, year, category, row, false, source);
    }
  }
  return entries;
}

function parseHtmlPairs(html: string, year: number, source: string): AmaaEntry[] {
  const $ = loadHtmlRoot(html);
  const entries: AmaaEntry[] = [];
  let category: string | null = null;

  $('#root').find('li, p').each((_, el) => {
    const tag = (el as any).tagName?.toLowerCase?.();
    const text = clean($(el).text());
    if (!text) return;

    if (tag === 'li' && isCategoryish(text)) {
      category = text;
      return;
    }
    if (tag === 'p' && category) {
      if (isCategoryish(text) && text.length < 90 && !/[–—-]/.test(text)) {
        category = `${category} ${text}`;
        return;
      }
      pushEntry(entries, year, category, text, true, source);
    }
  });
  return entries;
}

/**
 * 2008 (and similar): Wikipedia wikitable with two category columns.
 * Bold top-level items are winners; nested <li> are nominees.
 */
function parseWikitablePanel(html: string, year: number, source: string): AmaaEntry[] {
  const $ = loadHtmlRoot(html);
  const table = $('#root table.wikitable').first();
  if (!table.length) return [];

  const entries: AmaaEntry[] = [];

  table.find('tr').each((_, tr) => {
    const ths = $(tr).children('th');
    if (ths.length) return; // header row — categories live with following td row via prev()

    const tds = $(tr).children('td');
    if (!tds.length) return;

    const headerRow = $(tr).prev('tr');
    const headers = headerRow.children('th').toArray().map((th) => clean($(th).text()));

    tds.each((col, td) => {
      const category = headers[col];
      if (!category) return;

      const topLis = $(td).children('ul').children('li');
      topLis.each((__, li) => {
        const $li = $(li);
        // Direct text/links of this li (exclude nested ul text for the winner line)
        const clone = $li.clone();
        clone.find('ul').remove();
        const winnerLine = clean(clone.text());
        if (winnerLine) pushEntry(entries, year, category, winnerLine, true, source);

        $li.find('> ul > li').each((___, nom) => {
          const nomLine = clean($(nom).text());
          if (nomLine) pushEntry(entries, year, category, nomLine, false, source);
        });
      });
    });
  });

  return entries;
}

/** 2015: one <p>Best Category Value</p> per award */
function parseParagraphAwardLines(html: string, year: number, source: string): AmaaEntry[] {
  const $ = loadHtmlRoot(html);
  const paragraphs = $('#root p')
    .toArray()
    .map((p) => clean($(p).text()))
    .filter(Boolean);
  if (paragraphs.length < 8) return [];

  const entries: AmaaEntry[] = [];
  const catPrefixes = [
    'Winner for Achievement In Costume Design',
    'Winner for Achievement In Make-up',
    'Best First Feature Film By A Director',
    'Best Actor in a Supporting Role',
    'Best Actress in a leading role',
    'Best actor in a leading role',
    'Best Act in a supporting role',
    'Best supporting actress',
    'Best Promising Actor',
    'Best achievement in soundtrack',
    'Best Film By An African Living Abroad',
    'Best Comedy Film',
    'Best Nigerian film',
    'Best visual effect',
    'Best Short Film',
    'Best Film/Picture',
    'Best Documentary',
    'Best Child Actor',
    'Best Animation',
    'Best Diaspora',
    'Achievement In Screenplay',
    'Achievement in editing',
    'Achievement in sound',
    'Special Jury Prize',
  ].sort((a, b) => b.length - a.length);

  for (const line of paragraphs) {
    if (/^(Life achievement|Posthumous|Other awards|Special recognition|Tony Elumelu)/i.test(line)) continue;
    const prefix = catPrefixes.find((c) => new RegExp(`^${escapeRegex(c)}`, 'i').test(line));
    if (!prefix) continue;
    const value = clean(line.slice(prefix.length)).replace(/^Joint award\s+/i, '').replace(/["”]+$/g, '');
    if (!value) continue;
    // Joint "A (Film) and B (Film2)"
    if (
      (value.match(/\([^)]+\)/g) || []).length >= 2
      && pushAndSeparatedParts(entries, year, prefix, value, source, () => true)
    ) {
      continue;
    }
    pushEntry(entries, year, prefix, value, true, source);
  }
  return entries;
}

/** Recover winners when jammed lists leave WINNER marks under-parsed. */
function extractMarkedWinners(text: string, year: number, source: string): AmaaEntry[] {
  const entries: AmaaEntry[] = [];
  const lines = splitCleanLines(splitBeforeCategories(text));
  let category: string | null = null;
  for (const raw of lines) {
    const line = raw.replace(/^•\s*/, '').replace(/^\d+[.,]\s*/, '');
    if (isCategoryish(line) && !hasWinnerMark(line)) {
      category = line;
      continue;
    }
    if (hasWinnerMark(line) && category) {
      pushEntry(entries, year, category, line, true, `${source}-winner-mark`);
    }
  }
  return entries;
}

function parsePanel(year: number, text: string, html: string, source: string): AmaaEntry[] {
  const hasWinnerMarks = hasWinnerMark(text);
  const bulletCount = (text.match(/•/g) || []).length;
  const winnerMarkCount = (text.match(/WINNER/gi) || []).length;

  // 2008 Wikipedia wikitable (winners in <b>, nominees nested)
  if (html && /table\.wikitable|class="wikitable"/i.test(html)) {
    const wiki = parseWikitablePanel(html, year, `${source}-wikitable`);
    if (wiki.length >= 20) return wiki;
  }

  // 2015 paragraph-per-award HTML
  if (year === 2015 && html && /<p>/i.test(html)) {
    const paras = parseParagraphAwardLines(html, year, `${source}-p`);
    if (paras.length >= 10) return paras;
  }

  // 2024 Elementor HTML
  if (html && /<ol[\s>]/i.test(html) && !hasWinnerMarks) {
    const fromHtml = parseHtmlPairs(html, year, `${source}-html`);
    if (fromHtml.length >= 10) return fromHtml;
  }

  // 2011 hyphen-jammed
  if (year === 2011 || (/Best Film-/i.test(text) && /Best Director-/i.test(text))) {
    const h = parseHyphenWinners(text, year, source);
    if (h.length >= 10) return h;
  }

  // 2010 / 2013 jammed "AMAA …: value" colon prizes
  if (year === 2010 || year === 2013) {
    const colon = parseAmaaColonWinners(text, year, source);
    if (colon.length >= 8) return colon;
    const dash = parseSimpleDashWinners(text, year, source);
    if (dash.length >= 8) return dash;
    return parsePairsFromExpanded(text, year, source, { defaultWon: true });
  }

  // 2009 dash winners
  if (year === 2009) {
    return parseSimpleDashWinners(text, year, source);
  }

  // 2008 text fallback
  if (year === 2008) {
    const n08 = parse2008NomList(text, year, source);
    if (n08.length >= 20) return n08;
  }

  // 2022/2023 winners-only inline (or bullet)
  if ((year === 2022 || year === 2023) && !hasWinnerMarks) {
    const inline = parseInlineWinnerList(text, year, source);
    if (inline.length >= 8) return inline.map((e) => ({ ...e, won: true }));
  }

  // 2017 colon winners
  if (year === 2017) {
    return parsePairsFromExpanded(text.replace(/:\s*/g, ':\n'), year, source, { defaultWon: true });
  }

  // 2015 text fallback
  if (year === 2015) {
    const y15 = parse2015Winners(text, year, source);
    if (y15.length >= 10) return y15;
    return parsePairsFromExpanded(text, year, source, { defaultWon: true });
  }

  // Nomination lists with (WINNER) markers (2007, 2012, 2014, 2016, 2018-2021)
  if (hasWinnerMarks || /^\s*\d+\.\s/m.test(text) || bulletCount >= 3) {
    const list = parsePairsFromExpanded(text, year, source, {
      defaultWon: false,
      requireWinnerMarks: hasWinnerMarks,
    });
    // If almost no winners marked but looks like winners-only bullets (2023)
    if (!hasWinnerMarks && bulletCount >= 3 && list.filter((e) => e.won).length === 0 && list.length <= 40) {
      return list.map((e) => ({ ...e, won: true }));
    }
    const wins = list.filter((e) => e.won).length;
    if (winnerMarkCount >= 8 && wins < Math.floor(winnerMarkCount * 0.6)) {
      const recovered = extractMarkedWinners(text, year, source);
      return dedupe([...list, ...recovered]);
    }
    return list;
  }

  // Default: treat as winners-only
  return parsePairsFromExpanded(text, year, source, { defaultWon: true });
}

function parseNominationPage(text: string, year: number, source: string): AmaaEntry[] {
  if (/security verification|verify you are not a bot/i.test(text) && text.length < 2500) return [];
  const start = Math.max(
    0,
    text.search(
      /\d+\.\s+Efere|Efere Ozako|Jubril|AMAA\s+20\d{2}\s+AWARD|AMAA\s+20\d{2}\s+OUSMANE|2022 AFRICA MOVIE|AMAA Nominees List|AMAA 2020 AWARD/i,
    ),
  );
  const endMatch = text.slice(start).search(/\nShare:|\nLeave a Reply|\nRecent Posts|\nRecent Comments/i);
  const chunk = text.slice(start, endMatch > -1 ? start + endMatch : undefined);
  return parsePairsFromExpanded(chunk, year, source, { defaultWon: false }).map((e) => ({
    ...e,
    won: false,
  }));
}

function dedupe(entries: AmaaEntry[]) {
  const map = new Map<string, AmaaEntry>();
  for (const e of entries) {
    const key = [
      e.year,
      e.category.toLowerCase(),
      (e.work || '').toLowerCase(),
      e.people.join(',').toLowerCase(),
    ].join('|');
    const prev = map.get(key);
    if (!prev) {
      map.set(key, e);
      continue;
    }
    if (e.won && !prev.won) map.set(key, e);
  }
  return [...map.values()].sort((a, b) => b.year - a.year || a.category.localeCompare(b.category));
}

const NOMINATION_URLS = [
  'https://ama-awards.com/amaa-2023-nominations-list/',
  'https://ama-awards.com/amaa-2022-nominees-list/',
  'https://ama-awards.com/amaa-2021-nominees-list/',
  'https://ama-awards.com/amaa-nominees-list-2020/',
];

async function scrapeWinnerPanels(page: any) {
  await page.goto('https://ama-awards.com/amaa-winners/', {
    waitUntil: 'domcontentloaded',
    timeout: 90000,
  });
  await page.waitForSelector('button.e-n-tab-title, .e-n-tabs-content', { timeout: 45000 });
  await page.waitForTimeout(2000);

  const count = await page.locator('button.e-n-tab-title').count();
  for (let i = 0; i < count; i++) {
    await page.locator('button.e-n-tab-title').nth(i).click({ force: true }).catch(() => {});
    await page.waitForTimeout(150);
  }

  const panels = await page.evaluate(() => {
    const titles = [...document.querySelectorAll('button.e-n-tab-title')].map((n) =>
      (n.textContent || '').trim(),
    );
    const children = [...(document.querySelector('.e-n-tabs-content')?.children || [])] as HTMLElement[];
    return children
      .map((el, i) => {
        const title = titles[i] || '';
        const year = Number((title.match(/20\d{2}/) || [])[0] || 0);
        return { year, title, text: el.innerText || '', html: el.innerHTML || '' };
      })
      .filter((p) => p.year && p.text.trim().length > 40);
  });

  fs.mkdirSync(PANELS_DIR, { recursive: true });
  for (const p of panels) {
    fs.writeFileSync(path.join(PANELS_DIR, `${p.year}.txt`), p.text);
    fs.writeFileSync(path.join(PANELS_DIR, `${p.year}.html`), p.html);
  }
  return panels;
}

function loadSavedPanels() {
  if (!fs.existsSync(PANELS_DIR)) return [];
  return fs
    .readdirSync(PANELS_DIR)
    .filter((f) => f.endsWith('.txt'))
    .map((f) => {
      const year = Number(f.replace('.txt', ''));
      const text = fs.readFileSync(path.join(PANELS_DIR, f), 'utf8');
      const htmlPath = path.join(PANELS_DIR, `${year}.html`);
      const html = fs.existsSync(htmlPath) ? fs.readFileSync(htmlPath, 'utf8') : '';
      return { year, text, html };
    })
    .filter((p) => p.year);
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const fromPanelsOnly = process.argv.includes('--from-panels');
  let panels = loadSavedPanels();
  let entries: AmaaEntry[] = [];

  if (!fromPanelsOnly) {
    let browser;
    try {
      browser = await chromium.launch({
        headless: false,
        channel: 'chrome',
        args: ['--disable-blink-features=AutomationControlled'],
      });
    } catch {
      browser = await chromium.launch({
        headless: true,
        args: ['--disable-blink-features=AutomationControlled'],
      });
    }
    const context = await browser.newContext({
      userAgent:
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      locale: 'en-US',
    });
    await context.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
    });
    const page = await context.newPage();

    console.log('Scraping AMAA winner tabs...');
    try {
      panels = await scrapeWinnerPanels(page);
      console.log(`  Saved ${panels.length} panels`);
    } catch (err: any) {
      console.warn(`  winners page failed: ${err?.message || err}`);
      if (!panels.length) panels = loadSavedPanels();
    }

    console.log('Scraping nomination pages...');
    for (const url of NOMINATION_URLS) {
      try {
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 90000 });
        await page.waitForTimeout(2500);
        const text = await page.evaluate(() => document.body.innerText || '');
        const year = Number((url.match(/20\d{2}/) || [])[0] || 0);
        if (!year) continue;
        fs.writeFileSync(path.join(OUT_DIR, `raw-nom-${year}.txt`), text);
        if (/security verification/i.test(text) && text.length < 2500) {
          console.warn(`  cloudflare: ${url}`);
          continue;
        }
        const parsed = parseNominationPage(text, year, url);
        console.log(`  ✓ noms ${year}: ${parsed.length}`);
        entries.push(...parsed);
      } catch (err: any) {
        console.warn(`  fail ${url}: ${err?.message || err}`);
      }
    }

    await browser.close();
  } else {
    console.log(`Reparsing ${panels.length} saved panels + raw noms...`);
  }

  for (const panel of panels) {
    const parsed = parsePanel(panel.year, panel.text, panel.html, `amaa-winners-tab-${panel.year}`);
    const wins = parsed.filter((e) => e.won).length;
    const noms = parsed.filter((e) => !e.won).length;
    console.log(`  ✓ ${panel.year}: ${parsed.length} rows (${wins} wins / ${noms} noms)`);
    entries.push(...parsed);
  }

  for (const f of fs.readdirSync(OUT_DIR).filter((x) => /^raw-nom-\d{4}\.txt$/.test(x))) {
    const year = Number(f.match(/\d{4}/)![0]);
    const text = fs.readFileSync(path.join(OUT_DIR, f), 'utf8');
    const parsed = parseNominationPage(text, year, f);
    console.log(`  ✓ saved noms ${year}: ${parsed.length}`);
    entries.push(...parsed);
  }

  const unique = dedupe(entries);
  const wins = unique.filter((e) => e.won).length;
  const noms = unique.filter((e) => !e.won).length;
  const byYear: Record<string, { wins: number; noms: number }> = {};
  for (const e of unique) {
    const k = String(e.year);
    byYear[k] ||= { wins: 0, noms: 0 };
    if (e.won) byYear[k].wins++;
    else byYear[k].noms++;
  }

  const out = {
    scrapedAt: new Date().toISOString(),
    source: 'https://ama-awards.com/amaa-winners/',
    counts: { total: unique.length, wins, nominations: noms },
    byYear,
    entries: unique,
  };

  const outPath = path.join(OUT_DIR, 'entries.json');
  fs.writeFileSync(outPath, JSON.stringify(out, null, 2));
  console.log(`\nWrote ${unique.length} entries (${wins} wins / ${noms} noms)`);
  console.log(`→ ${outPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
