import { cleanTitle } from './yt_service.js';

export type YouTubeTitleDecision =
  | {
      action: 'accept';
      title: string;
      originalTitle: null;
      castSourceText: string;
      reason: 'normal-title';
    }
  | {
      action: 'clean';
      title: string;
      originalTitle: string;
      castSourceText: string;
      reason: 'embedded-title';
    }
  | {
      action: 'skip';
      title: null;
      originalTitle: string;
      castSourceText: string;
      reason: 'sensational-title-without-film-title';
    };

const STRONG_CLICKBAIT = /(not knowing|you won'?t believe|will shock|shocked everyone|made everyone cry|real tears|i (?:ask|urge|beg) (?:every|everyone)|leaving everyone in tears|turned out to be a (?:billionaire|prince|princess|ceo)|for true love|jaw.?dropping|see what happened next|changed (?:his|her) life forever|fell in love with (?:a|the|d) (?:poor|humble|maid|garbage|local|village|orphan)|kicked out to suffer|poor (?:village|orphan|helpless)|billionaire (?:lady|ceo|daughter)|in disguise|mocked (?:and|&) (?:rejected|humiliated)|how (?:a|an|the) (?:king|prince|princess|billionaire|ceo|man|lady|woman|girl|maid|orphan|husband|wife)|(?:marry|marries|married|marrying) (?:a|the) (?:poor|local|village|humble|maid|orphan|helpless|destitute)|(?:became|got) pregnant for|impregnated (?:a|the) (?:poor|local|village|maid)|disowned (?:his|her) (?:son|daughter|wife)|chased out (?:a|the) (?:poor|village|wife|maid|orphan)|took in (?:a|the|his|her) (?:homeless|poor|orphan|pregnant|single)|homeless single mom)/i;

const EMOTIONAL_PROMO = /(watch (?:this|dis|it|for|to)|watch it for|it'?s amazing|don'?t (?:skip|watch)|dn'?t (?:skip|watch)|do not (?:skip|watch)|must watch|will (?:make you|shock you|blow your mind)|cry (?:like a baby|real|hot|many|tears)|cried .*tears|control (?:ur|your|my) tears|not to skip|smile at end|touching (?:&|and) interesting|true life story|interesting family|family drama|mind.?blow|life.?changing|learn a (?:life )?lesson|keep .* aside|drop whatever|you will (?:laugh|cry)|you'?ll (?:cry|laugh|regret)|no one will .*watch|no matter .*watch|what happened next)/i;

const SUBJECT = /\b(he|she|they|her|his|him|my|i|you|everyone|everylady|girl|lady|man|woman|wife|husband|mother|father|maid|orphan|billionaire|ceo|prince|princess|king|queen)\b/i;

const PLOT_VERB = /(?:fell|falls|falling|fall) (?:deeply )?(?:in|for) love|not knowing|never knew|never expected|pretend|disguis|maltreat|humiliat|reject|abandon|regret|threw|throw|chased out|treated .*trash|married|marry|marries|marrying|saved|rescued|killed|destroyed|betrayed|cheat|chose|picked|hired|helped|used|sacrific|changed .*life|came back|returned|found out|thought .*poor|thinking .*poor|searching for (?:true )?love|looking for (?:true )?love|took in/i;

const SENSATIONAL_VOCAB = /\b(poor|wicked|evil|shock(?:ing|ed)?|mind.?blow|emotional|tears?|billionaire|orphan|maid|humble|helpless|worthless|betray|revenge|pregnan|ghost|disown|crippl|blind|beggar|homeless|heartbroken|jealous|abused|mistreated)\b/i;

const STORY_VERB = /\b(is|was|were|has|had|came|went|got|gave|made|met|found|saw|told|admits|reveals|cries|refused|left|loved|hated|wanted|wants)\b/i;

const NOISE = /(latest|new[- ]?(?:nigerian|nollywood|yoruba|african)?\s*(?:movie|movies|film)|full\s+(?:movie|film|video)|complete\s+(?:movie|film|season)|nigerian\s+(?:movie|movies)|nollywood|yoruba\s+(?:movie|movies)|african\s+(?:movie|movies)|classics\s+(?:movie|movies)|uchenna\s+mbunabo|\b20\d{2}\b|starring|featuring|\bfeat\.?\b|\bft\.?\b|\bbest of\b)/i;

const BAD_PREFIX = /^(please|watch|you will|you must|you'?ll|you (?:cannot|can'?t|should|shall|would|could)|don'?t|dn'?t|do not|every(?:one|body|lady|woman|man)|i (?:ask|urge|beg)|if (?:you|u)|just released|new released|new movie alert|latest movie|this (?:movie|story)|keep |drop |no matter|be the first|how |why |what happened|the day |the moment |the story of |a story of |when a |where a )\b/i;

function hasSensationalPossessiveOpening(title: string): boolean {
  if (!/^(?:my|our|your)\s+/i.test(title)) return false;
  const words = wordCount(title);
  if (words >= 6) return true;
  if (words >= 4 && (PLOT_VERB.test(title) || STORY_VERB.test(title) || SENSATIONAL_VOCAB.test(title))) {
    return true;
  }
  return false;
}

export const BLOGGER_NON_FILM_PATTERNS = [
  // Birthday / Personal parties
  /\b(?:birthday\s+(?:party|celebration|bash)|celebrates?\s+(?:her|his|their)?\s*birthday|happy\s+birthday|birthday\s+of)\b/i,
  // Premiere / Red carpet / Press conference
  /\b(?:premiere\s+of|movie\s+premiere\s+of|red\s+carpet|press\s+conference|press\s+briefing)\b/i,
  // Gossip / Social media feuds & drama
  /\b(?:takes\s+beef|beef\s+with|fight(?:ing)?\s+with|feud\s+with)\b/i,
  /\b(?:said\s+this|speaks\s+(?:on|about)|reacts?\s+to|breaks?\s+silence|cries\s+out|calls?\s+out|blasts?\s+|shades?\s+at|opens?\s+up\s+on)\b/i,
  /\b(?:leaked\s+(?:video|audio|tape)|scandal\s+exposed|caught\s+(?:on\s+camera|red[- ]handed))\b/i,
  /\b(?:is\s+a\s+single\s+mother|gives\s+birth\s+to|confession\s+of|secret\s+revealed\s+about)\b/i,
  // Lifestyle / Wealth / Celebrity vlogs
  /\b(?:house\s+warming|buys?\s+(?:a\s+)?new\s+car|mansions?\s+and\s+cars|net\s*worth\s+of|biography\s+of|lifestyle\s+of)\b/i,
  /\b(?:wedding\s+ceremony\s+of|traditional\s+wedding\s+of|burial\s+ceremony\s+of)\b/i,
  // BTS / Bloopers / Compilations
  /\b(?:behind\s+the\s+scenes?|the\s+making\s+of|blooper(?:s)?|funny\s+moments\s+on\s+set)\b/i,
  /\b(?:the\s+best\s+of|greatest\s+scenes\s+of|top\s+\d+\s+scenes\s+of)\s+[A-Z]/i,
  // Interviews & talk shows
  /\b(?:full\s+interview\s+with|exclusive\s+interview\s+with|sit[- ]down\s+with|in\s+conversation\s+with)\b/i,
  /\b(?:step\s+out\s+with\s+full\s+energy|threats\s+don'?t\s+move\s+them)\b/i,
  /\bshade\s+corner\b/i
];

export function isBloggerOrNonFilm(raw: string): boolean {
  const t = normalize(raw);
  return BLOGGER_NON_FILM_PATTERNS.some(re => re.test(t));
}

function normalize(raw: string): string {
  return (raw || '')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/\bdis\b/gi, 'this')
    .replace(/\bdat\b/gi, 'that')
    .replace(/\bdn'?t\b/gi, "don't")
    .replace(/\bu\b/gi, 'you')
    .replace(/\bur\b/gi, 'your')
    .replace(/\beverylady\b/gi, 'every lady')
    .replace(/\beveryman\b/gi, 'every man')
    .replace(/\beverywoman\b/gi, 'every woman')
    .replace(/\s+/g, ' ')
    .trim();
}

function wordCount(value: string): number {
  return value.trim().split(/\s+/).filter(Boolean).length;
}

export function isSensationalizedYouTubeTitle(raw: string): boolean {
  const title = normalize(raw);
  if (!title) return false;
  if (isBloggerOrNonFilm(title)) return true;
  if (STRONG_CLICKBAIT.test(title) || EMOTIONAL_PROMO.test(title) || BAD_PREFIX.test(title) || hasSensationalPossessiveOpening(title)) return true;

  // Catch sentence plot headlines starting with How/Why/What/When/The Day/The Moment/A Story Of
  if (/^(?:how|why|what|when|the day|the moment|the story of|a story of)\s+(?:a|an|the|i|she|he|we|my|our|everyone|any|this|rich|poor)\b/i.test(title)) {
    return true;
  }

  // Catch sentence plot patterns like "Isioma the Beauty from Waters and Her Earth Husband"
  if (/\b[a-z0-9_-]+\s+the\s+[a-z0-9_-]+\s+(?:from|in|of)\s+.*\s+(?:and|&)\s+(?:his|her|my|your|their)\b/i.test(title)) {
    return true;
  }

  const words = wordCount(title);
  // Any sentence-like title with a subject + plot verb or sensational word regardless of total length
  if (words >= 4 && SUBJECT.test(title) && PLOT_VERB.test(title)) return true;
  if (words >= 5 && SUBJECT.test(title) && SENSATIONAL_VOCAB.test(title)) return true;

  if (title.length >= 35 && words >= 7 && SUBJECT.test(title) && PLOT_VERB.test(title)) return true;
  return title.length >= 45
    && words >= 8
    && SUBJECT.test(title)
    && (SENSATIONAL_VOCAB.test(title) || STORY_VERB.test(title));
}

function isPlausibleFilmTitle(raw: string): boolean {
  const title = cleanTitle(normalize(raw)).replace(/[\s.:;|/\-~]+$/g, '').trim();
  const words = wordCount(title);

  if (title.length < 2 || title.length > 70 || words > 9) return false;
  if (BAD_PREFIX.test(title) || hasSensationalPossessiveOpening(title) || EMOTIONAL_PROMO.test(title) || STRONG_CLICKBAIT.test(title)) return false;
  if (/^(?:pt|part|episode|season)\s*\d+$/i.test(title)) return false;
  if (/\b(latest|movie|movies|film|films|telenovela|nollywood|20\d{2})\b/i.test(title)) return false;
  if (words >= 4 && SUBJECT.test(title) && PLOT_VERB.test(title)) return false;
  if (words >= 6 && SENSATIONAL_VOCAB.test(title) && SUBJECT.test(title)) return false;
  if (words >= 5 && /^the most\b/i.test(title)) return false;
  if (!/[\p{L}\p{N}]/u.test(title)) return false;
  return true;
}

function suffixLooksLikeUploadNoise(suffix: string): boolean {
  if (suffix.length < 4) return false;
  if (isSensationalizedYouTubeTitle(suffix) || NOISE.test(suffix) || (SUBJECT.test(suffix) && PLOT_VERB.test(suffix)) || /^[\{\[]/.test(suffix) || /^-\s*(?:NG|Nollywood|African)/i.test(suffix)) {
    return true;
  }
  // Known Nollywood channel / distributor / genre noise
  if (/(?:full\s+)?(?:romance|drama|comedy|action|epic|family|crime)\s+movie/i.test(suffix)) return true;
  if (/\b(?:uchenancy|yorubahood|mrlatintv|apata\s*tv|ruthtv|nigeria\s+movies?)\b/i.test(suffix)) return true;
  // Prominent star billing after title (e.g. Ruth Kadiri, Stephen Odimgbe, Deza the Great, Van Vicker)
  if (/\b(?:ruth kadiri|stephen odimgbe|deza the great|eddie watson|van vicker|anton jefta|chizzy alichi|frederick leonard|bolaji ogunmola|eniola ajao|muyiwa ademola|mercy johnson|destiny etiko|zubby michael|maurice sam)\b/i.test(suffix)) return true;
  // Space-separated or comma-separated multi-actor chains (3+ capitalized words)
  const words = suffix.split(/\s+/).filter(Boolean);
  if (words.length >= 3 && words.length <= 10 && words.every(w => /^[A-Z]/.test(w) || ['the', 'and', 'van', 'de', 'boy'].includes(w.toLowerCase()))) {
    return true;
  }
  return false;
}

type EmbeddedTitle = { prefix: string; suffix: string };

/**
 * Find a defensible movie-title prefix before YouTube marketing, a cast list,
 * or a sensational plot sentence. This is intentionally conservative: if the
 * prefix still reads like a plot headline, the upload is not salvageable.
 */
export function extractEmbeddedFilmTitle(raw: string): EmbeddedTitle | null {
  const title = normalize(raw);
  if (!title) return null;

  const candidates: EmbeddedTitle[] = [];
  const add = (index: number, separatorLength: number) => {
    if (index <= 0) return;
    const prefix = title.slice(0, index).trim();
    const suffix = title.slice(index + separatorLength).trim();
    if (prefix && suffix) candidates.push({ prefix, suffix });
  };

  if (title.includes('|')) {
    const pipeParts = title.split(/\|+/).map(p => p.trim()).filter(Boolean);
    if (pipeParts.length > 1) {
      const stripPartNoise = (part: string) => {
        let s = part.trim();
        // Leading channel / promotional markers including Flashback
        s = s.replace(/^(?:[A-Za-z0-9_\s]{2,20}\s+[-–—:]\s*)?(?:FLASHBACK\s+(?:MOVIE|FILM)?|FLASHBACK)\s*[-–—:]\s*/i, '');
        s = s.replace(/^(?:LATEST|NEW|HOT|TRENDING|TOP|BEST|AWARD WINNING|EPIC|DRAMA)\s+(?:LATEST|NEW|HOT|TRENDING|TOP|BEST|AWARD WINNING|EPIC|DRAMA|NIGERIAN|NOLLYWOOD|AFRICAN|YORUBA|IGBO)?\s*(?:MOVIE|FILM|MOVIES|FILMS|NOLLYWOOD|NIGERIAN|AFRICAN)?\s*(?:\d{4})?\s*[-–—:]\s*/i, '');
        // Trailing dash with noise / year / metadata
        s = s.replace(/\s*[-–—:]\s*(?:Full|Latest|New|Nigerian|Nollywood|Yoruba|African|Watch|Movie|\d{4}).*/i, '');
        // Trailing genre/film noise with or without Latest/New/Full
        s = s.replace(/\s*[-–—:]?\s*(?:(?:Latest|New|Hot|Trending|Full|Complete)\s+)?(?:Nigerian|Nollywood|Yoruba|Igbo|African|Hausa|Ghanaian)?\s*(?:Epic|Drama|Comedy|Action|Romance|Thriller)?\s*(?:Movie|Movies|Film|Films|Series|Comedy Series)(?:\s*20\d{2})?.*$/i, '');
        // Trailing year
        s = s.replace(/\s*[-–—:]?\s*\b20\d{2}\b.*$/i, '');
        // Opening brackets or parens
        s = s.replace(/\s*[\(\[\{].*$/, '');
        return s.replace(/^[–—\-:, ]+|[–—\-:, ]+$/g, '').trim();
      };

      const candidate0 = stripPartNoise(pipeParts[0]);
      const candidate1 = stripPartNoise(pipeParts[1]);

      const isTeaser0 = isSensationalizedYouTubeTitle(pipeParts[0]) || /\b(?:starring|featuring|ft\.?|vanishes|disappears|betrays|cries|shocked)\b/i.test(pipeParts[0]);
      const hasMovieTag1 = /\b(?:full\s+(?:nollywood|nigerian|yoruba)?\s*movie|latest\s+(?:nollywood|nigerian|yoruba)?\s*movie|complete\s+movie)\b/i.test(pipeParts[1]);

      // If part 0 is a teaser or part 1 explicitly has a movie tag, prefer part 1
      if ((isTeaser0 || hasMovieTag1) && candidate1 && isPlausibleFilmTitle(candidate1) && !isSensationalizedYouTubeTitle(candidate1)) {
        return { prefix: candidate1, suffix: [pipeParts[0], ...pipeParts.slice(2)].join(' | ') };
      }

      // Standard Nollywood pipe format: Part 0 is the movie title, subsequent parts are cast/actors
      if (candidate0 && isPlausibleFilmTitle(candidate0) && !isSensationalizedYouTubeTitle(candidate0)) {
        return { prefix: candidate0, suffix: pipeParts.slice(1).join(' | ') };
      }
    }
  }

  for (const separator of [':', ';']) {
    const index = title.indexOf(separator);
    if (index >= 0) add(index, separator.length);
  }

  const spacedDash = title.search(/\s[\-\u2013\u2014]\s/);
  if (spacedDash >= 0) add(spacedDash, 3);

  const tightTrailingDash = title.search(/-(?=\s)/);
  if (tightTrailingDash >= 0) add(tightTrailingDash, 1);

  const tightLeadingDash = title.search(/\s[\-\u2013\u2014](?=\S)/);
  if (tightLeadingDash >= 0) add(tightLeadingDash, 2);

  const tildeSep = title.search(/\s*~\s*/);
  if (tildeSep > 0) {
    const m = title.match(/\s*~\s*/);
    add(tildeSep, m ? m[0].length : 1);
  }

  const starringSep = title.search(/(?:\.\s*|\s+)(?:starring|featuring|feat\.?|ft\.?)\b/i);
  if (starringSep > 0) add(starringSep, 0);

  const castParen = title.search(/\s*\([^)]+,[^)]+\)\s*(?:nigerian|nollywood|yoruba|african|latest|new|20\d{2})\b/i);
  if (castParen > 0) add(castParen, 0);

  const slash = title.search(/\s\/\s/);
  if (slash >= 0) add(slash, 3);

  const bracketIndex = title.search(/\s*[\{\[]/);
  if (bracketIndex > 0) add(bracketIndex, 0);

  const countryTag = title.search(/\s*[-–—:]\s*(?:NG|Nollywood|African Movies?)\s*$/i);
  if (countryTag > 0) add(countryTag, 0);

  const noisyParen = title.search(/\s*\((?:full|new|latest|complete|starring|featuring|20\d{2})\b/i);
  if (noisyParen >= 0) add(noisyParen, 0);

  const metadata = title.search(/\b(?:full\s+(?:movie|film|video)|complete\s+(?:movie|film|season)|latest\s+(?:nigerian|nollywood|yoruba|african)?\s*(?:movie|movies|film)|20\d{2}\s+latest)\b/i);
  if (metadata > 0) add(metadata, 0);

  const trailingMetadata = title.match(/\s+((?:(?:new|latest|action|epic|comedy|drama|romance|thriller|yoruba|igbo|african|nigerian|nollywood|ghanaian|full|complete|20\d{2})[\s-]+)+(?:movie|movies|film|films)(?:[\s-]+20\d{2})?)$/i);
  if (trailingMetadata?.index != null) add(trailingMetadata.index, 0);

  candidates.sort((a, b) => a.prefix.length - b.prefix.length);
  for (const candidate of candidates) {
    if (!suffixLooksLikeUploadNoise(candidate.suffix)) continue;
    if (!isPlausibleFilmTitle(candidate.prefix)) continue;
    return {
      prefix: candidate.prefix.replace(/[\s.:;|/\-~]+$/g, '').trim(),
      suffix: candidate.suffix,
    };
  }

  return null;
}

export function curateYouTubeTitle(raw: string): YouTubeTitleDecision {
  const original = normalize(raw);
  if (isBloggerOrNonFilm(original)) {
    return {
      action: 'skip',
      title: null,
      originalTitle: original,
      castSourceText: original,
      reason: 'sensational-title-without-film-title',
    };
  }
  const sensational = isSensationalizedYouTubeTitle(original);
  const embedded = extractEmbeddedFilmTitle(original);

  if (embedded && !isSensationalizedYouTubeTitle(embedded.prefix)) {
    return {
      action: 'clean',
      title: cleanTitle(embedded.prefix),
      originalTitle: original,
      castSourceText: embedded.suffix,
      reason: 'embedded-title',
    };
  }

  if (sensational) {
    return {
      action: 'skip',
      title: null,
      originalTitle: original,
      castSourceText: original,
      reason: 'sensational-title-without-film-title',
    };
  }

  return {
    action: 'accept',
    title: cleanTitle(original),
    originalTitle: null,
    castSourceText: original,
    reason: 'normal-title',
  };
}

/**
 * Validate whether an AI-proposed title is valid and safe to use over the
 * deterministic titlePolicy.title.
 *
 * Guarantees:
 * 1. AI title must NEVER match an actor name in the cast list or cast source text.
 * 2. When titlePolicy already cleanly extracted an embedded title prefix,
 *    AI can only refine that prefix (e.g. casing/punctuation), NOT replace it
 *    with a completely different substring from the cast or marketing suffix.
 * 3. AI title must not be extracted solely from pipe-separated actor segments.
 */
export function isValidEnrichedTitle(
  aiTitle: string | undefined | null,
  titlePolicy: YouTubeTitleDecision | null | undefined,
  rawTitle: string,
  castList: string[] = []
): boolean {
  if (!aiTitle) return false;
  const trimmed = aiTitle.trim();
  if (trimmed.length < 2 || trimmed.length > 70) return false;
  if (isSensationalizedYouTubeTitle(trimmed)) return false;

  const trimmedLower = trimmed.toLowerCase();
  const rawLower = (rawTitle || '').toLowerCase();
  if (!rawLower.includes(trimmedLower)) return false;

  // 1. aiTitle must NEVER match an actor in castList
  if (castList.some(actor => {
    const a = actor.trim().toLowerCase();
    if (!a) return false;
    return a === trimmedLower || (a.length > 3 && (trimmedLower === a || trimmedLower.startsWith(a + ' ') || trimmedLower.endsWith(' ' + a)));
  })) {
    return false;
  }

  // 2. If titlePolicy cleanly extracted an embedded title prefix,
  // the AI title MUST overlap with that deterministic title.
  if (titlePolicy && titlePolicy.action === 'clean' && titlePolicy.title) {
    const detLower = titlePolicy.title.toLowerCase();
    const overlaps = detLower.includes(trimmedLower) || trimmedLower.includes(detLower);
    if (!overlaps) {
      return false;
    }
  }

  // 3. If titlePolicy has castSourceText, aiTitle must NOT come from the cast/noise text
  // unless it was also part of the deterministic title prefix.
  if (titlePolicy?.castSourceText) {
    const castSourceLower = titlePolicy.castSourceText.toLowerCase();
    const detLower = (titlePolicy.title || '').toLowerCase();
    if (castSourceLower.includes(trimmedLower) && !detLower.includes(trimmedLower)) {
      return false;
    }
  }

  // 4. If rawTitle contains pipes (|), actors are listed after the first pipe.
  // If aiTitle is not in the first pipe segment, reject it.
  if (rawTitle.includes('|')) {
    const pipeParts = rawTitle.split('|').map(p => p.trim().toLowerCase());
    const firstPart = pipeParts[0] || '';
    if (!firstPart.includes(trimmedLower)) {
      return false;
    }
  }

  return true;
}
