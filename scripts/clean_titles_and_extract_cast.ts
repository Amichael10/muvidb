/**
 * scripts/clean_titles_and_extract_cast.ts
 * ----------------------------------------
 * Production title cleaner + cast and crew extractor from titles and descriptions/synopses.
 *
 * Capabilities:
 *  1. Cleans YouTube and distributor title noise (buzzwords, marketing, channel tags, years).
 *  2. Extracts embedded actors from titles (delimiters, parens, dashes, trailing names).
 *  3. Preserves franchise and series markers (Episode, Part, Season, Volume, Pt, EP).
 *  4. Extracts cast & crew from descriptions/synopses (Starring, Cast, Directed by, Produced by, Written by).
 *  5. Cleans promotional spam, cast dumps, links, and hashtags out of film synopses.
 *  6. Resolves people via aliases & DB, creating verified stubs only when necessary.
 *  7. Idempotent: safe to run continuously.
 *
 * Usage:
 *   npx tsx scripts/clean_titles_and_extract_cast.ts --dry-run
 *   npx tsx scripts/clean_titles_and_extract_cast.ts --apply
 *   npx tsx scripts/clean_titles_and_extract_cast.ts --apply --recent-only   # last 14 days
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const DRY_RUN = !process.argv.includes('--apply');
const RECENT_ONLY = process.argv.includes('--recent-only');
const LIMIT = Number(process.argv.find(a => a.startsWith('--limit='))?.split('=')[1] || 0);

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

// ─── Non-name Dictionary & Known Seed ────────────────────────────────────────

const NON_NAME_WORDS = new Set([
  'nothing','could','satisfy','korean','mafia','boss','caregiver','african',
  'night','years','story','secret','house','village','return','part','season',
  'episode','comedy','series','movie','film','drama','video','official','trailer',
  'husband','wife','brother','sister','mother','father','daughter','son','family',
  'royal','palace','kingdom','prince','princess','king','queen','love','scars',
  'desire','sacrifice','beast','ghetto','dirty','sacred','blood','heart','soul',
  'latest','new','hot','full','nollywood','nigerian','yoruba','igbo','african',
  'action','epic','complete','watch','starring','featuring','cast','production',
  'entertainment','studio','studios','tv','television','channel','network',
  'volume','vol','money','power','revenge','betrayal','war','death','life',
  'rich','poor','evil','good','bad','dangerous','special','divine','holy',
  'romantic','drama','movies','films','edition','shorts','nollywoodmovies',
  'nollywoodfilm','yorubaactresses','oldmovies','yorubamovie','canada',
  'zambia','nigeria','live','stream','versus','vs','etc','international',
  'first','interesting','funny','very','released','today','laughing','while',
  'watching','this','that','silent','mistake','right','wrong','enough','never',
  'always','sweat','my','balloon','pop','version','english','subtitles','with',
  'sub','mount','zion','faith','mountzion','bestie','glass','journey','double',
  'trouble','when','care','cares','three','thieves','brouhaha','inside','street',
  'making','conversation','behind','scenes','pampered','wait','four','letter','word',
  'powered','showing','written','producer','director','writer','exec','executive',
  'man','one','now','here','exclusive','online','cinemas','cinema','media','pictures',
  'filmworks','broadcast','play','release','releases','subscribe','present','presents'
]);

const KNOWN_ACTORS_SEED = [
  'Odunlade Adekola','Funke Akindele','Femi Adebayo','Lateef Adedimeji',
  'Adedimeji Lateef','Mercy Johnson','Mercy Johnson Okojie','Toyin Abraham',
  'Toyin Aimakhu','Zubby Michael','Destiny Etiko','Ibrahim Chatta',
  'Bolanle Ninalowo','Regina Daniels','Ray Emodi','Maurice Sam','Ken Erics',
  'Yul Edochie','Nkem Owoh','Pete Edochie','Fredrick Leonard','Frederick Leonard',
  'Bimbo Ademoye','Bimbo Oyebade','Kehinde Bankole','Laide Bakare','Ebele Okaro',
  'Ngozi Ezeonu','Queen Nwokoye','Patience Ozokwor','Nosa Rex','Peace Onuoha',
  'Onyi Alex','Bolaji Amusan','Mr Latin','Anike Ami','Ebube Obio','Ebube Nwagbo',
  'Chizzy Alichi','Uche Nancy','Sonia Uche','Luchy Donalds','Maleek Milton',
  'Chioma Akpotha','Chioma Chukwuka','Ini Edo','Falz','Timini Egbuson',
  'Uzor Arukwe','Wunmi Toriola','Chidi Mokeme','Kanayo O Kanayo','Ify Eze',
  'Uche Montana','Ruth Kadiri','Mercy Aigbe','Mide Martins','Nkechi Blessing',
  'Iyabo Ojo','Adunni Ade','Lilian Esoro','Sharon Ooja','Nancy Isime',
  'Bimbo Manuel','Shaffy Bello','Sola Sobowale','Tina Mba','Jide Kosoko',
  'Taiwo Hassan','Yinka Quadri','Adebayo Salami','Saidi Balogun',
  'Kunle Afolayan','Gabriel Afolayan','Ramsey Nouah','Jim Iyke',
  'Mike Ezuruonye','Nonso Diobi','Oge Okoye','Chacha Eke','Ini Dima-Okojie',
  'Tobi Bakre','Alexx Ekubo','IK Ogbonna','Blossom Chukwujekwu','Stan Nze',
  'Deyemi Okanlawon','Daniel Etim Effiong','Eyinna Nwigwe','Mr Macaroni',
  'Broda Shaggi','Sabinus','Tonto Dikeh','Rita Dominic','Uche Jombo',
  'Omoni Oboli','Afeez Owo','Sotayo Gaga','Eniola Badmus','Ronke Odusanya',
  'Muyiwa Ademola','Ibrahim Yekini','Itele D Icon','Lizzy Gold',
  'Chinonso Arubayi','Chioma Nwosu','Doris Ifeka','Uchechi Treasure',
  'Ugezu J Ugezu','Genevieve Nnaji','Omotola Jalade','Richard Mofe Damijo',
  'RMD','Sam Dede','Segun Arinze','Daniel Etim','Daniel Rocky',
  'Wole Ojo','Lolade Okunsanya','Christian Ochiaga','Anthony Woods',
  'Mike Godson','Linda Osifo','Nkechi Nnaji','Akin Lewis','Fathia Williams',
  'Kemi Afolabi','Yinka Salau','Jaiye Kuti','Aisha Hart','Aishat Lawal',
  'Omotunde Adebowale','Juliet Ibrahim','Joseph Benjamin','Juliet Jatto',
  'Emeka Ike','Yemi Sholade','Emeka Enyiocha','Saheed Osupa','Okele',
  'Yetunde Barnabas','Debbie Shokoya','Akeem Adeyemi','Femi Adekanye',
  'Joke Muyiwa','Feranmi Oyalowo','Funmi Awelewa','Ogboluke','Abeni Agbon',
  'Baba Tee','Jide Awobona','Rotimi Salami','Bimbo Oshin','Akinola Akano',
  'Funsho Adeolu','Temitope Aremu','Oreoluwa Sobowale','Habeeb Alagbe',
  'Mimisola Daniel','Peju Ogunmola','Chisom Oguike','Chike Daniels',
  'Stephen Odimgbe','Deza the Great','Eddie Watson','Van Vicker',
  'Victoria Adeboye','Lalude','Mustapha Jayeola','Lanre Adediwura',
  'Diva Gold','Mosun Filani','Ayo Olaiya','Niyi Johnson','Olamilekan Yusuf',
  'Biola Fowosire','Ajanbadan Ojo','Taye Cellular','Saliu Ogboluke',
  'Tokunbo Malvins','Chinenye Nnebe','Sophie Alakija','Omowunmi Dada',
  'Chioma Nwaoha','Chidi Dike','Felix Omokhodion','Georgina Ibeh',
  'Ernest Obi','Uchenna Mbunabo','Adebayo Tijani','Robert O. Peters',
  'Nnamdi E. Odunze','Baaj Adebule','Abimbola Esther','Ibinabo Fiberesima',
  'Jide Kene Achufusi','Tracy Brakemi Obahor','Adeyemi Olanrewaju',
  'Susan Ajibade','Gloria Anozie-Young','Rhoda Inaju','Clinton Joshua',
  'Precious Akaeze','Charity Onah','Omowunmi Ajiboye','Lola Idije',
  'Adeoye Adewale','Olajumoke Asabi','Michael Dappa','Ekama Etim Inyang',
  'Prisma James','Soliu Ogboluke'
];

const SORTED_KNOWN_ACTORS = [...KNOWN_ACTORS_SEED].sort((a, b) => b.length - a.length);

function toTitleCase(str: string): string {
  const MINOR = new Set(['a','an','the','and','but','or','for','nor','on','at','to','by','of','in','with','from','as','mi']);
  return str
    .toLowerCase()
    .split(/\s+/)
    .map((w, i) => (i === 0 || !MINOR.has(w)) ? w.charAt(0).toUpperCase() + w.slice(1) : w)
    .join(' ');
}

function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 120);
}

function sanitizeName(raw: string, knownLower?: Set<string>): string | null {
  if (!raw) return null;
  let name = raw
    .replace(/[()[\]{}\~=*#@]/g, '')
    .replace(/\b(?:movie|film|drama|full|latest|new|brand|official|trailer|series|part|hd|4k|nollywood|nigerian|yoruba|igbo|african|movies|edition|shorts|romantic|nollywoodmovies)\b/gi, '')
    .replace(/[^a-zA-Z\s.'\-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!name || name.length < 3 || name.length > 40) return null;
  const words = name.toLowerCase().split(/\s+/);
  if (words.length < 1 || words.length > 4) return null;
  if (words.some(w => NON_NAME_WORDS.has(w))) return null;
  if (words.length === 1 && words[0].length < 4) return null;
  if (words.length === 1 && knownLower && !knownLower.has(words[0])) return null;
  return toTitleCase(name);
}

// ─── Extract Series / Episode / Part Markers ─────────────────────────────────

export function extractSeriesMarkers(title: string): string[] {
  const markers: string[] = [];
  const re = /\b(EPISODE|EPS|EP\.|EP|SEASON|PART|PT|VOLUME|VOL)\s*:?\s*(\d+)\b/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(title)) !== null) {
    const type = m[1].toUpperCase().replace(/\./g, '');
    let normType = type;
    if (type === 'EP' || type === 'EPS') normType = 'Episode';
    else if (type === 'PT') normType = 'Part';
    else if (type === 'S') normType = 'Season';
    else normType = type.charAt(0) + type.slice(1).toLowerCase();
    markers.push(`${normType} ${m[2]}`);
  }
  return markers;
}

// ─── Should Clean Film Title? ────────────────────────────────────────────────

export function shouldCleanFilmTitle(title: string, source: string | null): boolean {
  if (!title) return false;
  if (source && (source.startsWith('imdb') || source === 'docuth_sync')) return false;
  if (source === 'youtube') return true;

  // Title has explicit YouTube / distributor delimiters or buzzwords
  if (/\s*(?:\|\||\||\/\/)\s*/.test(title)) return true;
  if (/@[\w]+/.test(title)) return true;
  if (/^['"][\s\S]+['"]$/.test(title)) return true;
  if (/\b(?:starring|featuring|feat\.?|ft\.?|cast[:\s])\b/i.test(title)) return true;
  if (/\b(?:brand\s+new|latest|hot|trending)\s+(?:yoruba|igbo|nigerian|nollywood|african)?\s*(?:epic\s+)?(?:drama\s+)?(?:movie|film)s?\b/i.test(title)) return true;
  if (/\b(?:yoruba|nigerian|nollywood|african)\s+(?:latest\s+)?(?:movie|film)s?\s*(?:202[0-9])?\b/i.test(title)) return true;
  if (/\b(?:full\s+movies?|full\s+film|official\s+trailer)\b/i.test(title)) return true;

  // Check if ends with known actor from seed
  for (const actor of KNOWN_ACTORS_SEED) {
    if (title.toLowerCase().endsWith(actor.toLowerCase())) return true;
  }

  return false;
}

import { isBloggerOrNonFilm } from '../api/_lib/youtube_title_policy.js';
export { isBloggerOrNonFilm };

// ─── Unified Title Cleaning & Cast Extraction ────────────────────────────────

export interface CleanResult {
  cleanedTitle: string;
  isTitleChanged: boolean;
  extractedActors: string[];
}

export function cleanTitleAndExtractActors(
  rawTitle: string,
  knownLower: Set<string>
): CleanResult {
  const originalTitle = rawTitle.trim();
  let t = originalTitle;
  const extractedActors = new Set<string>();

  // 1. Extract and preserve series markers
  const seriesMarkers = extractSeriesMarkers(t);

  // 2. Decode HTML entities
  t = t
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n)))
    .replace(/\s*&\s*/g, ' & ');

  // Strip matched quotes: e.g. "'when Love Walked Away'" -> "when Love Walked Away"
  if ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'"))) {
    t = t.slice(1, -1).trim();
  }

  // 3. Extract actors before stripping delimiters

  // A. Check for starring / featuring / ft
  const starringMatch = t.match(/\b(?:starring|featuring|feat\.?|ft\.?|cast[:\s])\s*[;:]?\s*(.+)$/i);
  if (starringMatch) {
    const castChunk = starringMatch[1];
    castChunk.split(/[,&/|]/).map(s => s.trim()).forEach(cand => {
      const clean = sanitizeName(cand, knownLower);
      if (clean) extractedActors.add(clean);
    });
    t = t.replace(starringMatch[0], ' ');
  }

  // B. Delimited segments: behind ||, |, //
  const splitSeparators = /\s*(?:\|\||\||\/\/)\s*/;
  if (splitSeparators.test(t)) {
    const segments = t.split(splitSeparators).map(s => s.trim()).filter(Boolean);
    if (segments.length >= 2) {
      t = segments[0];
      for (let i = 1; i < segments.length; i++) {
        const seg = segments[i];
        const isList = /[,&/]/.test(seg);
        const parts = seg.split(/[,&/]/).map(s => s.trim()).filter(Boolean);
        for (const cand of parts) {
          const clean = sanitizeName(cand, knownLower);
          if (clean) {
            const isKnown = knownLower.has(clean.toLowerCase());
            // Only add if explicitly known, or if it was part of a multi-actor comma list
            if (isKnown || (isList && parts.length >= 2 && clean.split(/\s+/).length >= 2)) {
              extractedActors.add(clean);
            }
          }
        }
      }
    }
  }

  // C. Parenthesized Actor lists ONLY if multiple comma/& separated or in knownLower
  const parenMatches = t.match(/\(([^)]+)\)/g);
  if (parenMatches) {
    for (const pm of parenMatches) {
      const inner = pm.slice(1, -1).trim();
      if (!/(part|season|episode|official|hd|4k|\d{4})/i.test(inner)) {
        const hasList = /[,&/]/.test(inner);
        const parts = inner.split(/[,&/]/).map(s => s.trim()).filter(Boolean);
        let hadActor = false;
        for (const p of parts) {
          const clean = sanitizeName(p, knownLower);
          if (clean) {
            const isKnown = knownLower.has(clean.toLowerCase());
            if (isKnown || (hasList && parts.length >= 2 && clean.split(/\s+/).length >= 2)) {
              extractedActors.add(clean);
              hadActor = true;
            }
          }
        }
        if (hadActor) {
          t = t.replace(pm, ' ');
        }
      }
    }
  }

  // D. Dash-separated trailing actor list (handles whitespace or no whitespace around dash)
  const dashMatch = t.match(/^(.+?)\s*[\-\—\–]\s*(.+)$/);
  if (dashMatch) {
    const prefix = dashMatch[1].trim();
    const suffix = dashMatch[2].trim();
    const cleanedSuffix = suffix.replace(/[\s,]+(?:202[0-9]|201[5-9])\s*$/g, '').trim();
    const parts = cleanedSuffix.split(/[,&/]/).map(s => s.trim()).filter(Boolean);
    let foundActors = 0;
    for (const p of parts) {
      const clean = sanitizeName(p, knownLower);
      if (clean && (knownLower.has(clean.toLowerCase()) || (parts.length > 1 && clean.split(/\s+/).length >= 2))) {
        extractedActors.add(clean);
        foundActors++;
      }
    }
    if (foundActors > 0 && prefix.length >= 3) {
      t = prefix;
    } else if (foundActors === 0 && suffix.length >= 2 && suffix.length <= 40) {
      const prefixHasMarketing = /\b(?:latest|brand new|funny|movie|movies|nigerian|nollywood|yoruba|watch out|part|season)\b/i.test(prefix);
      const prefixHasKnownActor = Array.from(knownLower).some(actor => actor.length > 5 && prefix.toLowerCase().includes(actor));
      if (prefixHasMarketing || prefixHasKnownActor) {
        t = suffix;
      }
    }
  }

  // E. Trailing actor pair with ampersand: e.g. "I DID IT for Love Cynthia Clarke & Anthony Woode", "Colors of Trouble Mercy Johnson Okojie & ekenne Umenwa"
  const ampersandIdx = t.lastIndexOf('&');
  if (ampersandIdx !== -1) {
    const after = t.slice(ampersandIdx + 1).trim();
    const before = t.slice(0, ampersandIdx).trim();
    const afterName = sanitizeName(after, knownLower);
    if (afterName) {
      const beforeWords = before.split(/\s+/);
      let matched = false;
      if (beforeWords.length >= 4) {
        const cand3 = beforeWords.slice(-3).join(' ');
        const cand3Clean = sanitizeName(cand3, knownLower);
        if (cand3Clean && (knownLower.has(cand3Clean.toLowerCase()) || cand3Clean.split(/\s+/).length === 3)) {
          const titlePart = beforeWords.slice(0, -3).join(' ');
          if (titlePart.length >= 3) {
            extractedActors.add(cand3Clean);
            extractedActors.add(afterName);
            t = titlePart;
            matched = true;
          }
        }
      }
      if (!matched && beforeWords.length >= 3) {
        const cand2 = beforeWords.slice(-2).join(' ');
        const cand2Clean = sanitizeName(cand2, knownLower);
        if (cand2Clean && (knownLower.has(cand2Clean.toLowerCase()) || cand2Clean.split(/\s+/).length === 2)) {
          const titlePart = beforeWords.slice(0, -2).join(' ');
          if (titlePart.length >= 3) {
            extractedActors.add(cand2Clean);
            extractedActors.add(afterName);
            t = titlePart;
          }
        }
      }
    }
  }

  // F. Trailing comma-separated actor list: e.g. "Isuochi and the Third Night Curse 1&2 Rosabelle Andrew , OBI Okoli ,rita Arum"
  const firstCommaIdx = t.indexOf(',');
  if (firstCommaIdx !== -1) {
    const beforeComma = t.slice(0, firstCommaIdx).trim();
    const afterComma = t.slice(firstCommaIdx + 1).trim();
    const afterParts = afterComma.split(/[,&/]/).map(s => s.trim()).filter(Boolean);
    if (afterParts.length >= 1) {
      const validAfter = afterParts.map(p => sanitizeName(p, knownLower)).filter(Boolean) as string[];
      if (validAfter.length === afterParts.length && validAfter.length >= 1) {
        const beforeWords = beforeComma.split(/\s+/);
        if (beforeWords.length >= 3) {
          const cand2 = beforeWords.slice(-2).join(' ');
          const cand2Clean = sanitizeName(cand2, knownLower);
          if (cand2Clean && (knownLower.has(cand2Clean.toLowerCase()) || cand2Clean.split(/\s+/).length === 2)) {
            const titlePart = beforeWords.slice(0, -2).join(' ');
            if (titlePart.length >= 3) {
              extractedActors.add(cand2Clean);
              for (const va of validAfter) extractedActors.add(va);
              t = titlePart;
            }
          }
        }
      }
    }
  }

  // F. Full scan for known actors in title (e.g. "Lover BOY Ray Emodi", "Better Tomorrow Sonia Uche")
  for (const seed of SORTED_KNOWN_ACTORS) {
    const lowerSeed = seed.toLowerCase();
    const idx = t.toLowerCase().indexOf(lowerSeed);
    if (idx !== -1) {
      extractedActors.add(seed);
      const reg = new RegExp(`\\b${seed.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
      t = t.replace(reg, ' ');
    }
  }

  // 4. Strip Channel Watermarks & Noise
  const CHANNEL_WATERMARKS = [
    /\b(?:mr\.?\s*latin(?:'?s?)?\s*tv)\b/gi,
    /\bmrlatintv\b/gi,
    /\bbolaji\s*amusan\s*tv\b/gi,
    /@[\w]+/g,
    /\/?yorubahood\/?/gi,
    /\/?apata\s*tv\/?/gi,
    /\/?parayba\s*tv\/?/gi,
    /\/?nollywood\s*planet\/?/gi,
    /\/?nollyplus\/?/gi,
    /\/?asaba\s*movies\/?/gi,
    /\/?brainstorm\s*productions?\/?/gi,
    /\/?mount\s*zion\s*(?:film\s*)?productions?\/?/gi,
    /\bochenancy\s*movies?\b/gi,
    /\buchenancy\s*movies?\b/gi,
  ];
  for (const cw of CHANNEL_WATERMARKS) {
    t = t.replace(cw, ' ');
  }

  // 5. Strip Marketing / Nollywood Buzzwords AT THE END or AS PREFIX
  t = t.replace(/^(?:LATEST|NEW|HOT|TRENDING|TOP|BEST|AWARD WINNING|EPIC|DRAMA)\s+(?:LATEST|NEW|HOT|TRENDING|TOP|BEST|AWARD WINNING|EPIC|DRAMA|NIGERIAN|NOLLYWOOD|AFRICAN|YORUBA|IGBO)?\s*(?:MOVIE|FILM|MOVIES|FILMS|NOLLYWOOD|NIGERIAN|AFRICAN)?\s*(?:\d{4})?\s*[-–—:]\s*/i, '');

  const SUFFIX_NOISE_PATTERNS = [
    /\s*[-–—|:]*\s*(?:brand\s+new\s+)?(?:latest|new|hot|trending|epic)\s+(?:yoruba|igbo|nigerian|nollywood|african|hausa)?\s*(?:epic\s+)?(?:drama\s+)?(?:action\s+)?(?:comedy\s+)?(?:movie|film|full\s+movie)s?\s*(?:202[0-9])?.*$/gi,
    /\s*[-–—|:]*\s*(?:nigerian|nollywood|yoruba|igbo|african|hausa)\s+(?:latest\s+)?(?:epic\s+)?(?:drama\s+)?(?:movie|film|full\s+movie)s?\s*(?:202[0-9])?.*$/gi,
    /\s*[-–—|:]*\s*(?:latest|new)\s+(?:nollywood|nigerian|yoruba|igbo|african)?\s*(?:movies?|films?|full\s+movies?).*$/gi,
    /\s*[-–—|:]*\s*full\s+(?:movie|film)s?.*$/gi,
    /\s*[-–—|:]*\s*official\s+(?:trailer|teaser).*$/gi,
    /\s*[-–—|:]*\s*(?:202[0-9]|201[5-9])\s+(?:latest|new|movie|film|drama).*$/gi,
    /\s*[-–—|:]*\s*(?:yoruba|nigerian|nollywood)\s+(?:movie|film|drama)\s*(?:202[0-9])?.*$/gi,
    /\s*[-–—|:]*\s*(?:movie|film)\s*(?:202[0-9])\s*(?:drama|comedy|epic)?.*$/gi,
    /\s*[\|\-\~=\#]+\s*TV(?:\s+Series|\s+Show)?\s*$/gi,
    /\s+[-–—|:]+\s*(?:hd|4k|720p|1080p)\s*$/gi,
    /\s+[-–—|:]+\s*(?:202[0-9]|201[5-9])\s*$/g,
    /\s*[-–—|:]+\s*(?:drama|comedy|action|romance|thriller)\s*$/gi,
    /\s*[-–—|:]*\s*(?:latest|new)\s+(?:yoruba|nigerian|nollywood|african|ghanaian)\s*$/gi
  ];

  for (const snp of SUFFIX_NOISE_PATTERNS) {
    t = t.replace(snp, '');
  }

  // 6. Clean punctuation, slashes, dangling commas and dashes
  t = t
    .replace(/[\|\/\\~=#*_+]+/g, ' ')
    .replace(/,\s*,+/g, ',')
    .replace(/[\s,\-\—\–|:]+\s*(?:202[0-9]|201[5-9])\s*$/g, '')
    .replace(/[\s\-\—\–,;:\.]+$/, '')
    .replace(/^[\s\-\—\–,;:\.]+/, '')
    .replace(/\s{2,}/g, ' ')
    .trim();

  // 7. Re-attach series markers if lost
  if (seriesMarkers.length > 0) {
    for (const marker of seriesMarkers) {
      const num = marker.match(/\d+/)?.[0];
      const type = marker.split(/\s+/)[0].toLowerCase();
      let typePattern = `${type}|${type.slice(0, 2)}|${type.charAt(0)}`;
      if (type === 'part') typePattern = 'part|pt|p';
      else if (type === 'episode') typePattern = 'episode|ep|eps|e';
      else if (type === 'season') typePattern = 'season|sn|s';
      else if (type === 'volume') typePattern = 'volume|vol|v';

      const hasMarker = num && (
        new RegExp(`\\b(?:${typePattern})\\s*:?\\s*${num}\\b`, 'i').test(t) ||
        new RegExp(`\\b${num}$`, 'i').test(t)
      );
      if (!hasMarker) {
        t = `${t} ${marker}`;
      }
    }
  }

  // 8. Normalise Casing
  if (t.length > 2) {
    t = toTitleCase(t);
  }

  // Fallback guard: ensure title is not just marketing words or a person's name
  const words = t.toLowerCase().split(/\s+/).filter(Boolean);
  const isAllBuzzwords = words.every(w => 
    NON_NAME_WORDS.has(w) || 
    ['latest','new','hot','trending','movie','film','movies','films','nollywood','nigerian','yoruba','igbo','african','this','brand','drama','epic','video','hd','4k','full'].includes(w)
  );
  const isPersonName = knownLower.has(t.toLowerCase());

  if (isAllBuzzwords || isPersonName || t.length < 2) {
    t = originalTitle;
  }

  return {
    cleanedTitle: t,
    isTitleChanged: t.toLowerCase() !== originalTitle.toLowerCase(),
    extractedActors: Array.from(extractedActors)
  };
}

// ─── Extract Credits From Description / Synopsis ─────────────────────────────

export interface ExtractedCredit {
  name: string;
  role: 'actor' | 'director' | 'producer' | 'writer';
}

export function extractCreditsFromDescription(text: string | null | undefined): ExtractedCredit[] {
  if (!text) return [];
  const credits: ExtractedCredit[] = [];
  const seen = new Set<string>();

  const add = (raw: string, role: 'actor' | 'director' | 'producer' | 'writer') => {
    const clean = sanitizeName(raw);
    if (!clean) return;
    const key = `${clean.toLowerCase()}:${role}`;
    if (!seen.has(key)) {
      seen.add(key);
      credits.push({ name: clean, role });
    }
  };

  // A. Starring / Cast / Featuring
  const starMatches = text.match(/(?:starring|cast|featuring|with)\s*:\s*([^\n\.\-\|]+)/gi);
  if (starMatches) {
    for (const sm of starMatches) {
      const line = sm.replace(/^(?:starring|cast|featuring|with)\s*:\s*/i, '');
      line.split(/[,&/|]/).map(s => s.trim()).forEach(cand => add(cand, 'actor'));
    }
  }

  // B. Directed by
  const dirMatches = text.match(/(?:directed\s*by|director)\s*:\s*([^\n\.\-\|]+)/gi);
  if (dirMatches) {
    for (const dm of dirMatches) {
      const line = dm.replace(/^(?:directed\s*by|director)\s*:\s*/i, '');
      line.split(/[,&/|]/).map(s => s.trim()).forEach(cand => add(cand, 'director'));
    }
  }

  // C. Produced by
  const prodMatches = text.match(/(?:produced\s*by|producer)\s*:\s*([^\n\.\-\|]+)/gi);
  if (prodMatches) {
    for (const pm of prodMatches) {
      const line = pm.replace(/^(?:produced\s*by|producer)\s*:\s*/i, '');
      line.split(/[,&/|]/).map(s => s.trim()).forEach(cand => add(cand, 'producer'));
    }
  }

  // D. Written by
  const writeMatches = text.match(/(?:written\s*by|writer)\s*:\s*([^\n\.\-\|]+)/gi);
  if (writeMatches) {
    for (const wm of writeMatches) {
      const line = wm.replace(/^(?:written\s*by|writer)\s*:\s*/i, '');
      line.split(/[,&/|]/).map(s => s.trim()).forEach(cand => add(cand, 'writer'));
    }
  }

  return credits;
}

export function cleanSynopsis(synopsis: string | null | undefined): string | null {
  if (!synopsis) return null;
  let s = synopsis.trim();

  // Strip leading YouTube title echoes: "TITLE | CAST | LATEST NOLLYWOOD MOVIE Description: ..."
  s = s.replace(/^[A-Z0-9\s\-\|,'’]+(?:Description|Synopsis)\s*:\s*/i, '');

  // Strip Starring/Cast/Produced/Directed blocks
  s = s.replace(/(?:starring|cast|featuring|produced\s*by|directed\s*by|written\s*by)\s*:[^\n\.]*(?:\.|\n|$)/gi, ' ');

  // Strip YouTube / social links, hashtags, emojis
  s = s.replace(/https?:\/\/\S+/gi, '');
  s = s.replace(/#\w+/g, '');
  s = s.replace(/[\u{1F300}-\u{1F9FF}]/gu, ''); // emojis
  s = s.replace(/\b(?:subscribe\s+to\s+our\s+channel|watch\s+full\s+movie|click\s+here\s+to\s+subscribe|like\s+and\s+share)\b[^\n\.]*/gi, '');

  s = s.replace(/\s{2,}/g, ' ').trim();
  if (s.length < 20) return null;
  return s;
}

// ─── Main Execution Pipeline ─────────────────────────────────────────────────

async function main() {
  console.log(`\n======================================================`);
  console.log(`🎬 Lumi Title Cleaner & Cast/Crew Extractor`);
  console.log(`   Mode: ${DRY_RUN ? '🔍 DRY RUN (Preview only)' : '🚀 APPLY (Writing to DB)'}`);
  console.log(`   Scope: ${RECENT_ONLY ? '🕒 Last 14 days' : '🌐 Entire Database'}`);
  console.log(`======================================================\n`);

  // Step 1: Preload people map (name -> id)
  console.log('Loading people lookup & aliases from DB...');
  const personMap = new Map<string, string>();
  let pPage = 0;
  while (true) {
    const { data: pBatch, error: pErr } = await supabase
      .from('people')
      .select('id, name')
      .range(pPage * 1000, (pPage + 1) * 1000 - 1);
    if (pErr || !pBatch?.length) break;
    for (const p of pBatch) {
      if (p.name) personMap.set(p.name.toLowerCase().trim(), p.id);
    }
    if (pBatch.length < 1000) break;
    pPage++;
  }

  // Preload person aliases
  let aPage = 0;
  while (true) {
    const { data: aBatch, error: aErr } = await supabase
      .from('person_aliases')
      .select('person_id, alias')
      .range(aPage * 1000, (aPage + 1) * 1000 - 1);
    if (aErr || !aBatch?.length) break;
    for (const a of aBatch) {
      if (a.alias && a.person_id) personMap.set(a.alias.toLowerCase().trim(), a.person_id);
    }
    if (aBatch.length < 1000) break;
    aPage++;
  }
  console.log(`Loaded ${personMap.size} known people & aliases.\n`);

  const knownLower = new Set([
    ...KNOWN_ACTORS_SEED.map(a => a.toLowerCase()),
    ...Array.from(personMap.keys())
  ]);

  async function resolveOrCreatePerson(name: string): Promise<string | null> {
    const norm = name.toLowerCase().trim();
    if (personMap.has(norm)) return personMap.get(norm)!;

    // Guard against creating non-people
    const words = name.toLowerCase().split(/\s+/);
    if (words.length < 2 || words.length > 4) return null;
    if (words.some(w => NON_NAME_WORDS.has(w))) return null;

    if (DRY_RUN) return 'mock-person-id';

    const { data: id, error } = await supabase.rpc('upsert_person_by_name', {
      p_name: name,
      p_extra: { nationality: 'Nigerian', source: 'cleaner_extractor' }
    });

    if (error || !id) {
      console.warn(`  ✗ Failed to resolve person for "${name}": ${error?.message}`);
      return null;
    }
    personMap.set(norm, id as unknown as string);
    return id as unknown as string;
  }

  // Step 2: Fetch Films
  let totalScanned = 0;
  let titlesChanged = 0;
  let creditsAdded = 0;
  let synopsesCleaned = 0;
  let filmsDeleted = 0;
  let filmPage = 0;
  const PAGE_SIZE = 250;

  const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();

  while (true) {
    let query = supabase
      .from('films')
      .select('id, title, slug, synopsis, source, created_at')
      .order('created_at', { ascending: false })
      .range(filmPage * PAGE_SIZE, (filmPage + 1) * PAGE_SIZE - 1);

    if (RECENT_ONLY) {
      query = query.gte('created_at', fourteenDaysAgo);
    }

    const { data: films, error: fErr } = await query;
    if (fErr) {
      console.error(`Fetch error at page ${filmPage}:`, fErr.message);
      break;
    }
    if (!films || films.length === 0) break;

    for (const film of films) {
      totalScanned++;
      if (LIMIT > 0 && totalScanned > LIMIT) break;

      // Skip IMDB, TMDB syncs and documentary syncs completely
      if (film.source && (film.source.startsWith('imdb') || film.source.startsWith('tmdb') || film.source === 'docuth_sync')) {
        continue;
      }

      const rawTitle = film.title || '';
      const rawSynopsis = film.synopsis || '';

      // Auto-delete blogger / gossip / compilation / non-film entries
      if (isBloggerOrNonFilm(rawTitle)) {
        console.log(`🗑️ Deleting blogger/non-film entry: "${rawTitle}" (${film.id})`);
        if (!DRY_RUN) {
          await supabase.from('credits').delete().eq('film_id', film.id);
          await supabase.from('comments').delete().eq('film_id', film.id);
          await supabase.from('watchlists').delete().eq('film_id', film.id);
          await supabase.from('films').delete().eq('id', film.id);
        }
        filmsDeleted++;
        continue;
      }

      const needsTitleClean = shouldCleanFilmTitle(rawTitle, film.source);

      // Clean Title + Extract Title Actors
      const titleRes = needsTitleClean
        ? cleanTitleAndExtractActors(rawTitle, knownLower)
        : { cleanedTitle: rawTitle, isTitleChanged: false, extractedActors: [] };

      // Extract Credits from Description/Synopsis
      const descCredits = extractCreditsFromDescription(rawSynopsis);

      // Clean Synopsis (only if it contains cast dump or promo garbage)
      const hasPromoInSyn = /(?:starring|cast|featuring|produced\s*by|directed\s*by|written\s*by)\s*:/i.test(rawSynopsis)
        || /https?:\/\/|#\w+|\b(?:subscribe\s+to|watch\s+full\s+movie)\b/i.test(rawSynopsis);

      const cleanedSyn = hasPromoInSyn ? cleanSynopsis(rawSynopsis) : null;
      const isSynChanged = cleanedSyn !== null && cleanedSyn !== rawSynopsis;

      // Combine all extracted people
      const combinedCredits: ExtractedCredit[] = [];
      const seenPersonKey = new Set<string>();

      for (const actorName of titleRes.extractedActors) {
        const key = `${actorName.toLowerCase()}:actor`;
        if (!seenPersonKey.has(key)) {
          seenPersonKey.add(key);
          combinedCredits.push({ name: actorName, role: 'actor' });
        }
      }

      for (const cred of descCredits) {
        const key = `${cred.name.toLowerCase()}:${cred.role}`;
        if (!seenPersonKey.has(key)) {
          seenPersonKey.add(key);
          combinedCredits.push(cred);
        }
      }

      const hasWork = titleRes.isTitleChanged || combinedCredits.length > 0 || isSynChanged;

      if (hasWork) {
        console.log(`------------------------------------------------------`);
        console.log(`🎬 [${film.source || 'db'}] "${rawTitle}"`);
        if (titleRes.isTitleChanged) {
          console.log(`✨ Clean Title: "${titleRes.cleanedTitle}"`);
        }
        if (combinedCredits.length > 0) {
          console.log(`👥 Extracted Credits (${combinedCredits.length}): ${combinedCredits.map(c => `${c.name} [${c.role}]`).join(', ')}`);
        }
        if (isSynChanged) {
          console.log(`📝 Clean Synopsis: "${cleanedSyn?.slice(0, 90)}..."`);
        }

        if (!DRY_RUN) {
          // 1. Update Title & Slug
          if (titleRes.isTitleChanged) {
            let newSlug = generateSlug(titleRes.cleanedTitle);
            let { error: uErr } = await supabase
              .from('films')
              .update({
                title: titleRes.cleanedTitle,
                slug: newSlug,
                ...(isSynChanged ? { synopsis: cleanedSyn } : {})
              })
              .eq('id', film.id);

            if (uErr && uErr.message.includes('films_slug_key')) {
              newSlug = `${newSlug}-${film.id.substring(0, 5)}`;
              const { error: retryErr } = await supabase
                .from('films')
                .update({
                  title: titleRes.cleanedTitle,
                  slug: newSlug,
                  ...(isSynChanged ? { synopsis: cleanedSyn } : {})
                })
                .eq('id', film.id);
              if (!retryErr) uErr = null;
            }

            if (!uErr) {
              titlesChanged++;
              if (isSynChanged) synopsesCleaned++;
            } else {
              console.warn(`  ✗ Title update failed: ${uErr.message}`);
            }
          } else if (isSynChanged) {
            const { error: synErr } = await supabase
              .from('films')
              .update({ synopsis: cleanedSyn })
              .eq('id', film.id);
            if (!synErr) synopsesCleaned++;
          }

          // 2. Insert Credits
          if (combinedCredits.length > 0) {
            for (let i = 0; i < combinedCredits.length; i++) {
              const item = combinedCredits[i];
              const personId = await resolveOrCreatePerson(item.name);
              if (!personId) continue;

              const { data: existing } = await supabase
                .from('credits')
                .select('id')
                .eq('film_id', film.id)
                .eq('person_id', personId)
                .eq('role', item.role)
                .maybeSingle();

              if (!existing) {
                const { error: credErr } = await supabase
                  .from('credits')
                  .insert([{
                    film_id: film.id,
                    person_id: personId,
                    role: item.role,
                    billing_order: item.role === 'director' ? 0 : i + 1,
                    source: 'cleaner_extractor'
                  }]);

                if (!credErr) {
                  creditsAdded++;
                }
              }
            }
          }
        }
      }
    }

    if (LIMIT > 0 && totalScanned >= LIMIT) break;
    if (films.length < PAGE_SIZE) break;
    filmPage++;
  }

  console.log(`\n======================================================`);
  console.log(`🎉 RUN COMPLETE! — Mode: ${DRY_RUN ? 'DRY RUN' : 'APPLIED'}`);
  console.log(`   Films Scanned    : ${totalScanned}`);
  console.log(`   Titles Cleaned   : ${titlesChanged}`);
  console.log(`   Credits Added    : ${creditsAdded}`);
  console.log(`   Synopses Cleaned : ${synopsesCleaned}`);
  console.log(`   Films Deleted    : ${filmsDeleted}`);
  console.log(`======================================================\n`);
}

main().catch(console.error);
