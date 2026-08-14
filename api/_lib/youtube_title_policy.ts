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

const STRONG_CLICKBAIT = /(not knowing|you won'?t believe|will shock|shocked everyone|made everyone cry|real tears|i (?:ask|urge|beg) (?:every|everyone)|leaving everyone in tears|turned out to be a (?:billionaire|prince|princess|ceo)|for true love|jaw.?dropping|see what happened next|changed (?:his|her) life forever|fell in love with (?:a|the|d) (?:poor|humble|maid|garbage|local|village|orphan)|kicked out to suffer|poor (?:village|orphan|helpless)|billionaire (?:lady|ceo|daughter)|in disguise|mocked (?:and|&) (?:rejected|humiliated)|how (?:a|an|the) (?:king|prince|princess|billionaire|ceo|man|lady|woman|girl|maid|orphan|husband|wife)|(?:marry|marries|married|marrying) (?:a|the) (?:poor|local|village|humble|maid|orphan|helpless|destitute)|(?:became|got) pregnant for|impregnated (?:a|the) (?:poor|local|village|maid)|disowned (?:his|her) (?:son|daughter|wife)|chased out (?:a|the) (?:poor|village|wife|maid|orphan))/i;

const EMOTIONAL_PROMO = /(watch (?:this|dis|it|for|to)|watch it for|it'?s amazing|don'?t (?:skip|watch)|dn'?t (?:skip|watch)|do not (?:skip|watch)|must watch|will (?:make you|shock you|blow your mind)|cry (?:like a baby|real|hot|many|tears)|cried .*tears|control (?:ur|your|my) tears|not to skip|smile at end|touching (?:&|and) interesting|true life story|interesting family|family drama|mind.?blow|life.?changing|learn a (?:life )?lesson|keep .* aside|drop whatever|you will (?:laugh|cry)|you'?ll (?:cry|laugh|regret)|no one will .*watch|no matter .*watch|what happened next)/i;

const SUBJECT = /\b(he|she|they|her|his|him|my|i|you|everyone|everylady|girl|lady|man|woman|wife|husband|mother|father|maid|orphan|billionaire|ceo|prince|princess|king|queen)\b/i;

const PLOT_VERB = /(?:fell|falls|falling|fall) (?:deeply )?(?:in|for) love|not knowing|never knew|never expected|pretend|disguis|maltreat|humiliat|reject|abandon|threw|throw|chased out|treated .*trash|married|marry|marries|marrying|saved|rescued|killed|destroyed|betrayed|cheat|chose|picked|hired|helped|used|sacrific|changed .*life|came back|returned|found out|thought .*poor|thinking .*poor|searching for (?:true )?love|looking for (?:true )?love/i;

const SENSATIONAL_VOCAB = /\b(poor|wicked|evil|shock(?:ing|ed)?|mind.?blow|emotional|tears?|billionaire|orphan|maid|humble|helpless|worthless|betray|revenge|pregnan|ghost|disown|crippl|blind|beggar|homeless|heartbroken|jealous|abused|mistreated)\b/i;

const STORY_VERB = /\b(is|was|were|has|had|came|went|got|gave|made|met|found|saw|told|admits|reveals|cries|refused|left|loved|hated|wanted|wants)\b/i;

const NOISE = /(latest|new[- ]?(?:nigerian|nollywood|yoruba|african)?\s*(?:movie|movies|film)|full\s+(?:movie|film|video)|complete\s+(?:movie|film|season)|nigerian\s+(?:movie|movies)|nollywood|yoruba\s+(?:movie|movies)|african\s+(?:movie|movies)|\b20\d{2}\b|starring|featuring|\bfeat\.?\b|\bft\.?\b|\bbest of\b)/i;

const BAD_PREFIX = /^(please|watch|you will|you must|you'?ll|you (?:cannot|can'?t|should|shall|would|could)|our |my |your |don'?t|dn'?t|do not|every(?:one|body|lady|woman|man)|i (?:ask|urge|beg)|if (?:you|u)|just released|new released|new movie alert|latest movie|this (?:movie|story)|keep |drop |no matter|be the first|how |why |what happened|the day |the moment |the story of |a story of |when a |where a )\b/i;

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
  if (STRONG_CLICKBAIT.test(title) || EMOTIONAL_PROMO.test(title) || BAD_PREFIX.test(title)) return true;

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
  const title = cleanTitle(normalize(raw)).replace(/[\s:;|/\-]+$/g, '').trim();
  const words = wordCount(title);

  if (title.length < 2 || title.length > 70 || words > 9) return false;
  if (BAD_PREFIX.test(title) || EMOTIONAL_PROMO.test(title) || STRONG_CLICKBAIT.test(title)) return false;
  if (/^(?:pt|part|episode|season)\s*\d+$/i.test(title)) return false;
  if (/\b(latest|movie|movies|film|films|telenovela|nollywood|20\d{2})\b/i.test(title)) return false;
  if (words >= 4 && SUBJECT.test(title) && PLOT_VERB.test(title)) return false;
  if (words >= 6 && SENSATIONAL_VOCAB.test(title) && SUBJECT.test(title)) return false;
  if (words >= 5 && /^the most\b/i.test(title)) return false;
  if (!/[\p{L}\p{N}]/u.test(title)) return false;
  return true;
}

function suffixLooksLikeUploadNoise(suffix: string): boolean {
  return suffix.length >= 4
    && (isSensationalizedYouTubeTitle(suffix) || NOISE.test(suffix) || (SUBJECT.test(suffix) && PLOT_VERB.test(suffix)) || /^[\{\[]/.test(suffix) || /^-\s*(?:NG|Nollywood|African)/i.test(suffix));
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

  for (const separator of [':', ';', '|']) {
    const index = title.indexOf(separator);
    if (index >= 0) add(index, separator.length);
  }

  const spacedDash = title.search(/\s[\-\u2013\u2014]\s/);
  if (spacedDash >= 0) add(spacedDash, 3);

  const tightTrailingDash = title.search(/-(?=\s)/);
  if (tightTrailingDash >= 0) add(tightTrailingDash, 1);

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
    return candidate;
  }

  return null;
}

export function curateYouTubeTitle(raw: string): YouTubeTitleDecision {
  const original = normalize(raw);
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
