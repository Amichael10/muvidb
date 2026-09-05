export type CreditType = 'actor' | 'crew';

export type OcrWord = {
  text: string;
  left: number;
  top: number;
  width: number;
  height: number;
  confidence: number;
  lineKey: string;
};

export type OcrLine = {
  text: string;
  words: OcrWord[];
  left: number;
  top: number;
  right: number;
  bottom: number;
  confidence: number;
};

export type CreditObservation = {
  name: string;
  roleOrCharacter: string;
  creditType: CreditType;
  frameIndex: number;
  frameSec: number;
  videoSec: number;
  ocrConfidence: number;
  evidenceText: string;
  layout: {
    mode: 'two-column-cast' | 'grouped-cast' | 'role-then-name';
    personBox: [number, number, number, number];
    separatorX?: number;
  };
};

export type ParsedCredit = {
  name: string;
  roleOrCharacter: string;
  creditType: CreditType;
  frameIndex: number;
  frameSec: number;
  videoSec: number;
  ocrConfidence: number;
  evidenceText: string;
  layout: CreditObservation['layout'];
  frameSupport: number;
};

const STOP_MARKERS = [
  'COMING SOON',
  'NEXT WEEK',
  'NEXT ON',
  'WATCH PART',
  'PART 2 LOADING',
  'TO BE CONTINUED',
  'SUBSCRIBE',
  'LIKE AND SHARE',
  'CLICK THE LINK',
  'BELL ICON',
  'TURN ON NOTIFICATION',
  'NOW SHOWING',
  'STAY TUNED',
  'UP NEXT',
  'TRAILER',
];

const NOISE_PATTERNS = [
  /^(THE END|END|CAST|CREW|CREDITS?)$/,
  /^(THANKS?|THANK YOU)( FOR WATCHING)?$/,
  /^(COPYRIGHT|ALL RIGHTS RESERVED)/,
  /^(WWW\.|HTTP|YOUTUBE|INSTAGRAM|FACEBOOK|TWITTER|TIKTOK)/,
  /^RO(?:YAL|TA|TVAL) ?ARTS(?: TV| T)?$/,
  /^(A |AN )?(FILM|MOVIE|PRODUCTION|PRESENTATION) BY$/,
  /\b(PRODUCTIONS?|ENTERTAINMENT|STUDIOS?|PICTURES|FILMS?|LIMITED|LTD|INC|TV|CHANNEL|NETWORK|RENTALS?|SERVICES?|CONCEPT|DIRECTION|ZONE)\b/,
];

const DIALOGUE_WORDS = new Set([
  'A', 'AM', 'AN', 'AND', 'ARE', 'AS', 'AT', 'BE', 'BECAUSE', 'BEEN', 'BUT',
  'COME', 'DID', 'DO', 'DOES', 'DONT', 'DON', 'FOR', 'FORGIVE', 'GET', 'GO',
  'HAD', 'HAS', 'HAVE', 'HE', 'HELLO', 'HER', 'HERE', 'HIM', 'HIS', 'HOW',
  'I', 'IF', 'IM', 'IN', 'IS', 'IT', 'ME', 'MY', 'NO', 'NOT', 'NOW', 'OF',
  'OH', 'OK', 'OKAY', 'OUR', 'PLEASE', 'SAY', 'SHE', 'SIR', 'SO', 'SORRY',
  'THANK', 'THANKS', 'THAT', 'THE', 'THEIR', 'THEM', 'THEN', 'THERE', 'THESE',
  'THEY', 'THIS', 'THOSE', 'TO', 'US', 'WANT', 'WAS', 'WE', 'WERE', 'WHAT',
  'WHEN', 'WHERE', 'WHO', 'WHY', 'WILL', 'WITH', 'YES', 'YOU', 'YOUR',
]);

const ROLE_PATTERNS: Array<[RegExp, string]> = [
  [/^(?:EXTRAS?|BACKGROUND(?: ARTISTS?| CAST)?)(?: BY)?$/, 'Extra'],
  [/^(?:CAMEO|CAMEO APPEARANCE|SPECIAL APPEARANCE)$/, 'Cameo'],
  [/^STORY(?: BY)?$/, 'Story'],
  [/^(?:SCREEN ?PLAY|SCRIPT)(?: BY)?$/, 'Screenplay'],
  [/^(?:STORYI?SCREEN ?PLAY|STORY SCREEN ?PLAY|STORV SCREEN ?PLAY|SCREEN ?PLAY STORY)(?: BY)?$/, 'Story/Screenplay'],
  [/^(?:WRITTEN|WRITER)(?: BY)?$/, 'Writer'],
  [/^ALL SONGS WRITTEN AND PERFORMED BY$/, 'Songs written and performed by'],
  [/^(?:SONGS?|MUSIC) (?:WRITTEN|PERFORMED) BY$/, 'Music'],
  [/^(?:MUSIC|SCORE)(?: BY)?$/, 'Music'],
  [/^COMPOSER$/, 'Composer'],
  [/^(?:DIRECTED BY|DIRECTOR)$/, 'Director'],
  [/^(?:PRODUCED BY|PRODUCER)$/, 'Producer'],
  [/^(?:EXECUTIVE PRODUCED BY|EXECUTIVE PRODUCER)$/, 'Executive Producer'],
  [/^(?:ASSOCIATE|CO) PRODUCER$/, 'Associate Producer'],
  [/^(?:LINE PRODUCER|PRODUCTION MANAGER)$/, 'Production Manager'],
  [/^(?:UNIT MANAGER|UNIT PRODUCTION MANAGER)$/, 'Unit Manager'],
  [/^(?:PRODUCTION COORDINATOR|PRODUCTION CORDINATOR|PRODUCTION SUPERVISOR)$/, 'Production Coordinator'],
  [/^(?:PRODUCTION ASSISTANTS?|PRODUCTION ASST(?: \d+)?)$/, 'Production Assistant'],
  [/^(?:PRODUCTION DESIGNER|PRODUCTION DESIGN)$/, 'Production Designer'],
  [/^(?:ASSISTANT DIRECTOR|FIRST ASSISTANT DIRECTOR|1ST ASSISTANT DIRECTOR)$/, 'Assistant Director'],
  [/^(?:SECOND ASSISTANT DIRECTOR|2ND ASSISTANT DIRECTOR)$/, 'Second Assistant Director'],
  [/^(?:DIRECTOR OF PHOTOGRAPHY|CINEMATOGRAPHER|D ?O ?P S?|BOP|POP)$/, 'Director of Photography'],
  [/^(?:CAMERA(?: OPERATOR)?|CAMERAMAN)$/, 'Camera Operator'],
  [/^(?:CAMERA ASSISTANTS?|CAMERA ASST|CAMERA ASS?T(?: \d+)?)$/, 'Camera Assistant'],
  [/^(?:CAMERA TECH|CAMERA TECHNICIAN)$/, 'Camera Technician'],
  [/^(?:1ST AC|FIRST AC|1ST ASSISTANT CAMERA|FIRST ASSISTANT CAMERA)$/, 'First Assistant Camera'],
  [/^(?:2ND AC|SECOND AC|2ND ASSISTANT CAMERA|SECOND ASSISTANT CAMERA)$/, 'Second Assistant Camera'],
  [/^(?:SECOND UNIT OPERATOR|SECOND CAMERA|2ND CAMERA)$/, 'Second Unit Operator'],
  [/^(?:DRONE|DRONE OPERATOR|AERIAL CAMERA)$/, 'Drone Operator'],
  [/^(?:BTS|B ?T ?S|BEHIND THE SCENES)$/, 'BTS'],
  [/^(?:STILL PHOTOGRAPHER|STILL PHOTO|STILL PHOTOGRAPHY|PHOTOGRAPHY)$/, 'Still Photographer'],
  [/^(?:EDITED BY|EDITOR|FILM EDITOR)$/, 'Editor'],
  [/^(?:ASSISTANT EDITOR|ASSIST(?:ANT)? FILM EDITOR)$/, 'Assistant Editor'],
  [/^(?:COLORIST|COLOURIST|COLOR GRADING)$/, 'Colorist'],
  [/^(?:POST PRODUCTION|POST PRODUCTION SUPERVISOR)$/, 'Post Production'],
  [/^(?:CASTING|CASTING DIRECTOR)$/, 'Casting Director'],
  [/^(?:MAKE ?UP|MAKE ?UP ARTIST)$/, 'Makeup'],
  [/^(?:ASSISTANT MAKE ?UP|MAKE ?UP ASSISTANT)$/, 'Assistant Makeup'],
  [/^(?:HOD HAIR AND MAKE ?UP|HEAD OF HAIR AND MAKE ?UP|HAIR AND MAKE ?UP HOD)$/, 'Head of Hair and Makeup'],
  [/^(?:COSTUME|COSTUMIER|WARDROBE)$/, 'Costume'],
  [/^(?:ASSIST(?:ANT)? COSTUME|ASSIST(?:ANT)? COSTUMIER|WARDROBE ASSISTANT)$/, 'Assistant Costume'],
  [/^(?:ART DIRECTOR|ART DIRECTION)$/, 'Art Director'],
  [/^(?:PROPERTIES|PROPS)(?: SET DESIGN)?$/, 'Properties/Set Design'],
  [/^(?:PROPS MASTER|PROP MASTER)$/, 'Props Master'],
  [/^(?:PROPS ASSISTANT|PROP ASSISTANT|PROPERTIES ASSISTANT)$/, 'Props Assistant'],
  [/^(?:SET DESIGN|SET DESIGNER)$/, 'Set Design'],
  [/^(?:SET MAN|SET ASSISTANTS?)$/, 'Set Assistant'],
  [/^(?:SOUND RECORDIST|LOCATION SOUND|SOUND MAN)$/, 'Sound Recordist'],
  [/^(?:SOUND DESIGN|SOUND DESIGNER)$/, 'Sound Designer'],
  [/^(?:SOUND|AUDIO)(?: ENGINEER)?$/, 'Sound'],
  [/^(?:SOUND TRACK|SOUNDTRACK)$/, 'Soundtrack'],
  [/^(?:BOOM OPERATOR|BOOM)$/, 'Boom Operator'],
  [/^(?:GAFFER|LIGHTING|LIGHTS?|LIGHTING TECH(?:NICIAN)?|LIGHT MAN|LIGHTMAN)$/, 'Gaffer'],
  [/^(?:BEST BOY|BEST BOY ELECTRIC|BEST BOY GRIP)$/, 'Best Boy'],
  [/^(?:LOCATIONS?|LOCATION MANAGER)$/, 'Locations'],
  [/^(?:LOCATION ASSISTANTS?)$/, 'Location Assistant'],
  [/^ASSISTANTS?$/, 'Assistant'],
  [/^(?:CONTINUITY|SCRIPT SUPERVISOR)$/, 'Continuity'],
  [/^CONTINUITY MANAGER$/, 'Continuity'],
  [/^(?:DIALOGUE|DIALOG)$/, 'Dialogue'],
  [/^(?:SUBTITLES?|SUBTITLER|CAPTIONS?)$/, 'Subtitler'],
  [/^(?:VFX|VISUAL EFFECTS)$/, 'Visual Effects'],
  [/^(?:GRAPHICS?|GRAPHIC DESIGNER)$/, 'Graphics'],
  [/^(?:PUBLICITY|MEDIA|SOCIAL MEDIA)$/, 'Publicity'],
  [/^(?:CHOREOGRAPHER|CHOREOGRAPHY)$/, 'Choreographer'],
  [/^(?:STUNTS?|STUNT COORDINATOR)$/, 'Stunts'],
  [/^SECURITY$/, 'Security'],
  [/^(?:TRANSPORTATION|TRANSPORT|DRIVERS?)$/, 'Transportation'],
  [/^(?:RENTAL|EQUIPMENT RENTAL)$/, 'Equipment Rental'],
  [/^(?:CATERING|CATERER)$/, 'Catering'],
  [/^(?:WELFARE|WELFARE MANAGER)$/, 'Welfare'],
];

function normalizeSpace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function lettersAndSpaces(value: string): string {
  return normalizeSpace(
    value
      .replace(/^[^\p{L}\p{N}]+/gu, '')
      .replace(/[^\p{L}\p{N}.'’/-]+$/gu, ''),
  );
}

function normalizeKey(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, ' ')
    .trim();
}

function canonicalRole(value: string): string | null {
  const key = normalizeKey(value)
    .replace(/\bASSISTANTS\b/g, 'ASSISTANTS')
    .replace(/\bMAKEUP\b/g, 'MAKE UP');
  for (const [pattern, role] of ROLE_PATTERNS) {
    if (pattern.test(key)) return role;
  }
  return null;
}

function isCastCreditRole(role: string): boolean {
  return /^(?:Extra|Cameo|Special Appearance|Supporting Cast|Actor)$/i.test(role.trim());
}

function canonicalCastGroup(value: string): string | null {
  const key = normalizeKey(value)
    .replace(/\bEXTARS?\b/g, 'EXTRAS')
    .replace(/\bEXTERS?\b/g, 'EXTRAS');
  if (/^(?:CAST|CASTS|CAST LIST|CAST MEMBERS|STARRING|MAIN CAST|LEAD CAST|ACTORS?|ARTISTES?|ARTISTS?)$/.test(key)) return 'Actor';
  if (/^(?:SUPPORTING CAST|SUPPORTING ACTORS?|SUPPORTING ROLES?|SUPPORTING ARTISTES?|SUPPORTING ARTISTS?|SUPPORTING)$/.test(key)) return 'Supporting Cast';
  if (/^(?:GUEST CAST|GUEST APPEARANCES?|SPECIAL APPEARANCES?|SPECIAL GUESTS?)$/.test(key)) return 'Special Appearance';
  if (/^(?:ADDITIONAL CAST|OTHER CAST|FEATURED CAST|FEATURING)$/.test(key)) return 'Actor';
  const extras = key.match(/^(?:(.+?) )?(?:EXTRAS?|EXTRA CAST|BACKGROUND CAST|BACKGROUND ARTISTES?|BACKGROUND ARTISTS?)$/);
  if (extras) {
    const prefix = extras[1]?.trim();
    return prefix && !/^(?:EXTRA|BACKGROUND)$/.test(prefix) ? `${smartTitle(prefix)} Extra` : 'Extra';
  }
  if (/^(?:CAMEOS?|CAMEO APPEARANCES?)$/.test(key)) return 'Cameo';
  if (/\bCAST$/.test(key) && !/^(?:BROADCAST|PODCAST)$/.test(key)) return smartTitle(value);
  return null;
}

function isStopLine(value: string): boolean {
  const key = normalizeKey(value);
  return STOP_MARKERS.some((marker) => key.includes(marker));
}

function isNoiseLine(value: string): boolean {
  const key = normalizeKey(value);
  return !key || NOISE_PATTERNS.some((pattern) => pattern.test(key));
}

function smartTitle(value: string): string {
  const input = normalizeSpace(value);
  if (!input || input !== input.toUpperCase()) return input;
  return input
    .split(' ')
    .map((word) => {
      if (/^[A-Z]\.?$/.test(word) || /^[A-Z]{2}$/.test(word)) return word;
      return word
        .toLowerCase()
        .replace(/(^|[-'’])\p{L}/gu, (letter) => letter.toUpperCase());
    })
    .join(' ')
    .replace(/(['â€™])S\b/g, '$1s');
}

function personCandidateText(value: string): string {
  const text = lettersAndSpaces(
    value
      .replace(/^[^A-Z]{8,}(?=[A-Z])/g, '')
      .replace(/\([^)]{1,40}\)/g, ' ')
      .replace(/\s*\([^)]{1,40}$/g, ' ')
      .replace(/\|\./g, ' I ')
      .replace(/["“”]/g, ' ')
      .replace(/\|/g, ' ')
      .replace(/(^|\s)\.([A-Z])\.(?=\s|$)/g, '$1$2')
      .replace(/(^|\s)([A-Z])\.(?=\s|$)/g, '$1$2')
      .replace(/\.(?=\s*$)/, ''),
  );
  const words = text.split(' ');
  if (
    words.length >= 3
    && /^[A-Z]$/i.test(words[0])
    && words[1].replace(/[^\p{L}]/gu, '').length >= 4
  ) {
    return words.slice(1).join(' ');
  }
  return text;
}

function personTextLooksValid(text: string, allowSingleWord = false): boolean {
  if (text.length < 5 || text.length > 60) return false;
  if (/\d/.test(text) || canonicalRole(text) || isNoiseLine(text)) return false;
  const shape = allowSingleWord
    ? /^[\p{L}][\p{L}.'’/-]*(?: [\p{L}][\p{L}.'’/-]*)*$/u
    : /^[\p{L}][\p{L}.'’/-]*(?: [\p{L}][\p{L}.'’/-]*)+$/u;
  if (!shape.test(text)) return false;

  const words = text.split(' ');
  if (words.length < (allowSingleWord ? 1 : 2) || words.length > 5) return false;
  if (allowSingleWord && words.length === 1 && words[0].replace(/[.'’/-]/g, '').length < 5) return false;
  if (words.some((word) => word.replace(/[.'’/-]/g, '').length === 0)) return false;
  if (words.some((word) => canonicalRole(word))) return false;
  if (words.some((word) => {
    const key = normalizeKey(word);
    return key.length > 1 && DIALOGUE_WORDS.has(key);
  })) return false;

  const letterLengths = words.map((word) => word.replace(/[^\p{L}]/gu, '').length);
  const averageLength = letterLengths.reduce((sum, length) => sum + length, 0) / letterLengths.length;
  if (averageLength < 3) return false;
  return true;
}

function looksLikePerson(value: string): boolean {
  return personTextLooksValid(personCandidateText(value));
}

function cleanPersonName(value: string): string | null {
  const text = personCandidateText(value);
  if (!personTextLooksValid(text)) return null;
  return smartTitle(text);
}

export function cleanCreditPersonName(value: string): string | null {
  return cleanPersonName(value);
}

function cleanCrewPersonName(value: string, confidence = 1): string | null {
  const text = personCandidateText(value);
  if (personTextLooksValid(text)) return smartTitle(text);
  if (confidence < 0.65 || !personTextLooksValid(text, true)) return null;
  return smartTitle(text);
}

function cleanCharacter(value: string): string | null {
  const text = lettersAndSpaces(value).replace(/\.(?=\s*$)/, '');
  if (!text || text.length > 60 || /\d/.test(text) || canonicalRole(text) || isNoiseLine(text)) return null;
  if (!/^[\p{L}][\p{L}.'’/-]*(?: [\p{L}][\p{L}.'’/-]*){0,5}$/u.test(text)) return null;
  return smartTitle(text);
}

function cleanCreditCharacter(value: string): string | null {
  const text = lettersAndSpaces(value).replace(/\.(?=\s*$)/, '');
  if (!text || text.length > 60 || canonicalRole(text) || isNoiseLine(text)) return null;
  if (/\d/.test(text)) {
    const digits = text.match(/\d/g) ?? [];
    if (digits.length > 2 || !/\b\d{1,2}$/.test(text)) return null;
  }
  if (!/^[\p{L}][\p{L}\p{N}.'â€™/-]*(?: [\p{L}\p{N}][\p{L}\p{N}.'â€™/-]*){0,5}$/u.test(text)) return null;
  return smartTitle(text);
}

function averageConfidence(words: OcrWord[]): number {
  const useful = words.filter((word) => word.confidence >= 0);
  if (!useful.length) return 0;
  const weighted = useful.reduce(
    (state, word) => {
      const weight = Math.max(1, word.text.replace(/[^\p{L}\p{N}]/gu, '').length);
      return {
        total: state.total + word.confidence * weight,
        weight: state.weight + weight,
      };
    },
    { total: 0, weight: 0 },
  );
  return Math.max(0, Math.min(1, weighted.total / weighted.weight / 100));
}

function boxFor(words: OcrWord[]): [number, number, number, number] {
  const left = Math.min(...words.map((word) => word.left));
  const top = Math.min(...words.map((word) => word.top));
  const right = Math.max(...words.map((word) => word.left + word.width));
  const bottom = Math.max(...words.map((word) => word.top + word.height));
  return [left, top, right - left, bottom - top];
}

export function parseTesseractTsv(tsv: string): OcrLine[] {
  const rows = tsv.split(/\r?\n/);
  if (rows.length < 2) return [];
  const header = rows[0].split('\t');
  const index = Object.fromEntries(header.map((name, position) => [name, position]));
  const grouped = new Map<string, OcrWord[]>();

  for (const row of rows.slice(1)) {
    if (!row.trim()) continue;
    const columns = row.split('\t');
    if (columns[index.level] !== '5') continue;
    const rawText = columns.slice(index.text).join('\t');
    const text = lettersAndSpaces(rawText);
    if (!text || !/\p{L}|\p{N}/u.test(text)) continue;
    const confidence = Number(columns[index.conf]);
    if (!Number.isFinite(confidence) || confidence < 0) continue;
    const lineKey = [
      columns[index.page_num],
      columns[index.block_num],
      columns[index.par_num],
      columns[index.line_num],
    ].join('.');
    const word: OcrWord = {
      text,
      left: Number(columns[index.left]),
      top: Number(columns[index.top]),
      width: Number(columns[index.width]),
      height: Number(columns[index.height]),
      confidence,
      lineKey,
    };
    if (![word.left, word.top, word.width, word.height].every(Number.isFinite)) continue;
    const words = grouped.get(lineKey) ?? [];
    words.push(word);
    grouped.set(lineKey, words);
  }

  return [...grouped.values()]
    .map((words) => {
      words.sort((a, b) => a.left - b.left);
      const left = Math.min(...words.map((word) => word.left));
      const top = Math.min(...words.map((word) => word.top));
      const right = Math.max(...words.map((word) => word.left + word.width));
      const bottom = Math.max(...words.map((word) => word.top + word.height));
      return {
        text: normalizeSpace(words.map((word) => word.text).join(' ')),
        words,
        left,
        top,
        right,
        bottom,
        confidence: averageConfidence(words),
      };
    })
    .sort((a, b) => a.top - b.top || a.left - b.left);
}

function findCastSeparator(lines: OcrLine[]): number | null {
  const gaps: Array<{ midpoint: number; lineKey: string }> = [];
  for (const line of lines) {
    for (let i = 0; i < line.words.length - 1; i++) {
      const current = line.words[i];
      const next = line.words[i + 1];
      const gap = next.left - (current.left + current.width);
      const threshold = Math.max(18, Math.max(current.height, next.height) * 1.35);
      if (gap >= threshold) {
        gaps.push({ midpoint: current.left + current.width + gap / 2, lineKey: current.lineKey });
      }
    }
  }

  let best: { midpoint: number; support: number } | null = null;
  for (const gap of gaps) {
    const nearby = gaps.filter((candidate) => Math.abs(candidate.midpoint - gap.midpoint) <= 24);
    const support = new Set(nearby.map((candidate) => candidate.lineKey)).size;
    if (!best || support > best.support) {
      best = {
        midpoint: nearby.reduce((sum, candidate) => sum + candidate.midpoint, 0) / nearby.length,
        support,
      };
    }
  }
  return best && best.support >= 3 ? best.midpoint : null;
}

function splitAtSeparator(line: OcrLine, separatorX: number): [OcrWord[], OcrWord[]] | null {
  let bestIndex = -1;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (let i = 0; i < line.words.length - 1; i++) {
    const current = line.words[i];
    const next = line.words[i + 1];
    const gap = next.left - (current.left + current.width);
    const midpoint = current.left + current.width + gap / 2;
    if (gap >= 18 && Math.abs(midpoint - separatorX) < bestDistance) {
      bestDistance = Math.abs(midpoint - separatorX);
      bestIndex = i;
    }
  }
  if (bestIndex < 0 || bestDistance > 32) return null;
  return [line.words.slice(0, bestIndex + 1), line.words.slice(bestIndex + 1)];
}

const CHARACTER_HINT = /\b(?:MR|MRS|MISS|MS|DR|DOCTOR|PROF|PROFESSOR|PRINCIPAL|TEACHER|KING|QUEEN|CHIEF|PRINCE|PRINCESS|PASTOR|IMAM|ALFA|BABA|MAMA|MOTHER|FATHER|OFFICER|POLICE|INSPECTOR|LAWYER|BARRISTER|NURSE|JUDGE|ELDER|LANDLORD|LANDLADY|CHAIRMAN|MADAM|SIR|MAID|GUARD|GATEMAN|GATE MAN|BOSS|DRIVER|WIFE|HUSBAND|SON|DAUGHTER|FRIEND|NEIGHBOUR|NEIGHBOR|CUSTOMER|VENDOR|VILLAGER|CHILD)\b/;

function characterScore(value: string): number {
  const key = normalizeKey(value);
  if (!key) return -1;
  const words = key.split(' ').filter(Boolean);
  let score = 0;
  if (CHARACTER_HINT.test(key)) score += 3;
  if (/^(?:YOUNG|OLD|LITTLE|SMALL|ELDERLY)\b/.test(key)) score += 1;
  if (words.length === 1) score += 2;
  else if (words.length <= 3) score += 1;
  return score;
}

function textForWords(words: OcrWord[]): string {
  return words.map((word) => word.text).join(' ');
}

const LEADER_SEPARATOR_PATTERN = /(?:[.:;,+_=~]\s*){2,}[^A-Z]{0,64}(?=[A-Z])/g;
const LEADER_SPLIT_MARKER = '\x1f';

function creditSideText(value: string): string {
  return lettersAndSpaces(value)
    .replace(/\.(?=\s*$)/, '')
    .replace(/^[|:;,+_=~\s-]+/, '')
    .replace(/[|:;,+_=~\s-]+$/, '')
    .trim();
}

function leaderRightText(value: string): string {
  return normalizeSpace(value)
    .replace(/^[|:;,+_=~\s-]+/, '')
    .replace(/[|:;,+_=~\s-]+$/, '')
    .trim();
}

function splitLeaderText(value: string): { left: string; right: string } | null {
  const marked = normalizeSpace(value).replace(LEADER_SEPARATOR_PATTERN, ` ${LEADER_SPLIT_MARKER} `);
  if (!marked.includes(LEADER_SPLIT_MARKER)) return null;
  const [leftPart, ...rightParts] = marked.split(LEADER_SPLIT_MARKER);
  const left = creditSideText(leftPart);
  const right = leaderRightText(rightParts.join(' '));
  if (!left || !right) return null;
  return { left, right };
}

function roleFromLeaderLeft(value: string, currentRole: string | null): string | null {
  const role = canonicalRole(value);
  if (role) return role;
  const key = normalizeKey(value);
  if (/^(?:ASST|ASSISTANT) \d+$/.test(key) && currentRole) return currentRole;
  return null;
}

function splitLeaderCreditLine(
  line: OcrLine,
  currentRole: string | null,
): { role: string | null; observation: Omit<CreditObservation, 'frameIndex' | 'frameSec' | 'videoSec'> | null } | null {
  const split = splitLeaderText(line.text);
  if (!split) return null;

  const role = roleFromLeaderLeft(split.left, currentRole);
  if (role) {
    const person = isCastCreditRole(role)
      ? cleanPersonName(split.right)
      : cleanCrewPersonName(split.right, line.confidence);
    return {
      role,
      observation: person
        ? {
          name: person,
          roleOrCharacter: role,
          creditType: isCastCreditRole(role) ? 'actor' : 'crew',
          ocrConfidence: line.confidence,
          evidenceText: line.text,
          layout: { mode: 'role-then-name', personBox: boxFor(line.words) },
        }
        : null,
    };
  }

  const character = cleanCreditCharacter(split.left);
  const person = cleanPersonName(split.right);
  if (!character || !person) return null;
  return {
    role: null,
    observation: {
      name: person,
      roleOrCharacter: character,
      creditType: 'actor',
      ocrConfidence: line.confidence,
      evidenceText: line.text,
      layout: { mode: 'two-column-cast', personBox: boxFor(line.words) },
    },
  };
}

function splitCastLine(
  line: OcrLine,
  separatorX: number,
): { name: string; character: string; words: OcrWord[] } | null {
  const split = splitAtSeparator(line, separatorX);
  if (!split) return null;
  const [leftWords, rightWords] = split;
  const leftText = textForWords(leftWords);
  const rightText = textForWords(rightWords);
  const leftPerson = cleanPersonName(leftText);
  const rightPerson = cleanPersonName(rightText);
  const leftCharacter = cleanCreditCharacter(leftText);
  const rightCharacter = cleanCreditCharacter(rightText);
  const leftLooksPerson = !!leftPerson;
  const rightLooksPerson = !!rightPerson;
  const actorOnLeft = leftLooksPerson && !!rightCharacter;
  const actorOnRight = rightLooksPerson && !!leftCharacter;

  if (!actorOnLeft && !actorOnRight) return null;
  if (
    actorOnLeft
    && !actorOnRight
    && !mostlyUppercase(leftText)
    && mostlyUppercase(rightText)
    && rightWords.length <= 2
  ) {
    return null;
  }

  if (actorOnLeft && actorOnRight) {
    const leftCharacterScore = characterScore(leftCharacter ?? '');
    const rightCharacterScore = characterScore(rightCharacter ?? '');
    if (rightCharacterScore >= leftCharacterScore + 2) {
      return { name: leftPerson, character: rightCharacter!, words: leftWords };
    }
    if (leftCharacterScore >= rightCharacterScore + 2) {
      return { name: rightPerson, character: leftCharacter!, words: rightWords };
    }
    return null;
  }

  if (actorOnLeft) return { name: leftPerson, character: rightCharacter!, words: leftWords };
  return { name: rightPerson!, character: leftCharacter!, words: rightWords };
}

function findLineSeparator(line: OcrLine): number | null {
  let best: { gap: number; midpoint: number } | null = null;
  for (let i = 0; i < line.words.length - 1; i++) {
    const current = line.words[i];
    const next = line.words[i + 1];
    const gap = next.left - (current.left + current.width);
    const midpoint = current.left + current.width + gap / 2;
    if (gap >= Math.max(48, Math.max(current.height, next.height) * 3) && (!best || gap > best.gap)) {
      best = { gap, midpoint };
    }
  }
  return best?.midpoint ?? null;
}

function splitPeopleColumns(
  line: OcrLine,
  separatorX: number | null,
  allowSingleWord = false,
): Array<{ name: string; words: OcrWord[] }> {
  const split = separatorX === null
    ? null
    : splitAtSeparator(line, separatorX);
  const fallbackSeparator = split ? null : findLineSeparator(line);
  const resolvedSplit = split ?? (fallbackSeparator === null ? null : splitAtSeparator(line, fallbackSeparator));
  if (!resolvedSplit) return [];
  const people: Array<{ name: string; words: OcrWord[] }> = [];
  for (const words of resolvedSplit) {
    const person = allowSingleWord
      ? cleanCrewPersonName(textForWords(words), averageConfidence(words))
      : cleanPersonName(textForWords(words));
    if (person) people.push({ name: person, words });
  }

  const seen = new Set<string>();
  return people.filter((person) => {
    const key = normalizeKey(person.name);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function mostlyUppercase(value: string): boolean {
  const letters = [...value].filter((char) => /\p{L}/u.test(char));
  if (letters.length < 3) return false;
  const uppercase = letters.filter((char) => char === char.toUpperCase()).length;
  return uppercase / letters.length >= 0.72;
}

function wordLooksUppercase(value: string): boolean {
  const letters = [...value].filter((char) => /\p{L}/u.test(char));
  if (!letters.length) return false;
  const uppercase = letters.filter((char) => char === char.toUpperCase()).length;
  return uppercase / letters.length >= 0.75;
}

function splitMergedActorCharacter(line: OcrLine): { name: string; character: string; words: OcrWord[] } | null {
  if (line.words.length < 3 || line.words.length > 6) return null;
  for (let splitIndex = 2; splitIndex < line.words.length; splitIndex++) {
    const nameWords = line.words.slice(0, splitIndex);
    const characterWords = line.words.slice(splitIndex);
    if (nameWords.length > 4 || characterWords.length > 3) continue;
    if (!nameWords.every((word) => wordLooksUppercase(word.text))) continue;

    const name = cleanPersonName(textForWords(nameWords));
    const character = cleanCreditCharacter(textForWords(characterWords));
    if (!character || !name) continue;

    const characterHasLowercase = characterWords.some((word) => /[a-z]/.test(word.text));
    if (!characterHasLowercase && characterScore(character) < 3) continue;

    return {
      name,
      character,
      words: nameWords,
    };
  }
  return null;
}

function consecutivePersonLines(lines: OcrLine[], maxLines = 8): number {
  let count = 0;
  for (const line of lines.slice(0, maxLines)) {
    const section = normalizeKey(line.text);
    if (section === 'CREW' || canonicalRole(line.text) || canonicalCastGroup(line.text)) break;
    if (!looksLikePerson(line.text)) break;
    count++;
  }
  return count;
}

function castCharacterHeading(
  line: OcrLine,
  followingLines: OcrLine[],
  inCastContext: boolean,
): string | null {
  if (canonicalCastGroup(line.text) || canonicalRole(line.text) || isNoiseLine(line.text)) return null;
  const character = cleanCharacter(line.text);
  if (!character) return null;

  const key = normalizeKey(line.text);
  const words = key.split(' ').filter(Boolean);
  if (words.length > 5) return null;

  const followingPeople = consecutivePersonLines(followingLines);
  if (followingPeople < (inCastContext ? 1 : 2)) return null;

  const possessive = /(?:'|â€™)S\b/i.test(line.text);
  const characterish = characterScore(character) >= 3 || possessive;
  const personLike = looksLikePerson(line.text);
  const creditStyled = mostlyUppercase(line.text);

  if (characterish) return character;
  if (!personLike && creditStyled && followingPeople >= 3 && words.length <= 4) return character;
  if (inCastContext && !personLike && creditStyled) return character;
  return null;
}

function sameLineRoleAndName(line: OcrLine): { role: string; name: string; words: OcrWord[] } | null {
  for (let i = 1; i < line.words.length; i++) {
    const left = line.words.slice(0, i);
    const right = line.words.slice(i);
    const role = canonicalRole(left.map((word) => word.text).join(' '));
    const name = role && isCastCreditRole(role)
      ? cleanPersonName(right.map((word) => word.text).join(' '))
      : cleanCrewPersonName(right.map((word) => word.text).join(' '), averageConfidence(right));
    if (role && name) return { role, name, words: right };
  }
  return null;
}

export function parseCreditFrame(
  lines: OcrLine[],
  frameIndex: number,
  frameSec: number,
  videoSec: number,
): CreditObservation[] {
  const observations: CreditObservation[] = [];
  const stopIndex = lines.findIndex((line) => isStopLine(line.text));
  const usable = stopIndex >= 0 ? lines.slice(0, stopIndex) : lines;
  const separatorX = findCastSeparator(usable);
  const explicitCreditSignal = usable.some((line) => {
    const section = normalizeKey(line.text);
    return section === 'CAST' || section === 'CREW' || section === 'CREDITS'
      || !!canonicalCastGroup(line.text)
      || !!canonicalRole(line.text);
  });

  if (separatorX !== null) {
    const castLines = usable
      .map((line) => ({ line, castLine: splitCastLine(line, separatorX) }))
      .filter((item): item is { line: OcrLine; castLine: { name: string; character: string; words: OcrWord[] } } => !!item.castLine);
    if (castLines.length >= 3 || (explicitCreditSignal && castLines.length >= 2)) {
      for (const { line, castLine } of castLines) {
        observations.push({
          name: castLine.name,
          roleOrCharacter: castLine.character,
          creditType: 'actor',
          frameIndex,
          frameSec,
          videoSec,
          ocrConfidence: averageConfidence(castLine.words),
          evidenceText: line.text,
          layout: {
            mode: 'two-column-cast',
            personBox: boxFor(castLine.words),
            separatorX: Math.round(separatorX),
          },
        });
      }
    }
  }

  let currentRole: string | null = null;
  let currentCastCharacter: string | null = null;
  for (let lineIndex = 0; lineIndex < usable.length; lineIndex++) {
    const line = usable[lineIndex];
    const castGroup = canonicalCastGroup(line.text);
    if (castGroup) {
      currentRole = null;
      currentCastCharacter = castGroup;
      continue;
    }
    const section = normalizeKey(line.text);
    if (section === 'CREW') {
      currentRole = null;
      currentCastCharacter = null;
      continue;
    }

    const role = canonicalRole(line.text);
    if (role) {
      currentRole = role;
      currentCastCharacter = null;
      continue;
    }

    const leader = splitLeaderCreditLine(line, currentRole);
    if (leader) {
      if (leader.observation) {
        observations.push({
          ...leader.observation,
          frameIndex,
          frameSec,
          videoSec,
        });
      }
      currentRole = leader.role;
      currentCastCharacter = null;
      continue;
    }

    if (isNoiseLine(line.text)) {
      currentRole = null;
      continue;
    }

    const inline = sameLineRoleAndName(line);
    if (inline) {
      observations.push({
        name: inline.name,
        roleOrCharacter: inline.role,
        creditType: isCastCreditRole(inline.role) ? 'actor' : 'crew',
        frameIndex,
        frameSec,
        videoSec,
        ocrConfidence: averageConfidence(inline.words),
        evidenceText: line.text,
        layout: { mode: 'role-then-name', personBox: boxFor(inline.words) },
      });
      currentRole = inline.role;
      currentCastCharacter = null;
      continue;
    }
    if (separatorX === null) {
      const groupHeading = castCharacterHeading(
        line,
        usable.slice(lineIndex + 1),
        currentCastCharacter !== null,
      );
      if (groupHeading) {
        currentRole = null;
        currentCastCharacter = groupHeading;
        continue;
      }
    }
    if (currentRole) {
      const people = splitPeopleColumns(line, separatorX, !isCastCreditRole(currentRole));
      if (people.length) {
        for (const person of people) {
          observations.push({
            name: person.name,
            roleOrCharacter: currentRole,
            creditType: isCastCreditRole(currentRole) ? 'actor' : 'crew',
            frameIndex,
            frameSec,
            videoSec,
            ocrConfidence: averageConfidence(person.words),
            evidenceText: line.text,
            layout: {
              mode: 'role-then-name',
              personBox: boxFor(person.words),
              ...(separatorX === null ? {} : { separatorX: Math.round(separatorX) }),
            },
          });
        }
        continue;
      }
    }
    if (currentCastCharacter) {
      const contextualSeparator = separatorX ?? findLineSeparator(line);
      if (contextualSeparator !== null) {
        const castLine = splitCastLine(line, contextualSeparator);
        if (castLine && currentCastCharacter === 'Actor') {
          if (separatorX !== null) continue;
          observations.push({
            name: castLine.name,
            roleOrCharacter: castLine.character,
            creditType: 'actor',
            frameIndex,
            frameSec,
            videoSec,
            ocrConfidence: averageConfidence(castLine.words),
            evidenceText: line.text,
            layout: {
              mode: 'two-column-cast',
              personBox: boxFor(castLine.words),
              separatorX: Math.round(contextualSeparator),
            },
          });
          continue;
        }
      }
      const people = splitPeopleColumns(line, separatorX);
      if (people.length) {
        for (const person of people) {
          observations.push({
            name: person.name,
            roleOrCharacter: currentCastCharacter,
            creditType: 'actor',
            frameIndex,
            frameSec,
            videoSec,
            ocrConfidence: averageConfidence(person.words),
            evidenceText: line.text,
            layout: {
              mode: 'grouped-cast',
              personBox: boxFor(person.words),
              ...(separatorX === null ? {} : { separatorX: Math.round(separatorX) }),
            },
          });
        }
        continue;
      }
    }
    if (currentCastCharacter && !isNoiseLine(line.text)) {
      const merged = currentCastCharacter === 'Actor' ? splitMergedActorCharacter(line) : null;
      if (merged) {
        observations.push({
          name: merged.name,
          roleOrCharacter: merged.character,
          creditType: 'actor',
          frameIndex,
          frameSec,
          videoSec,
          ocrConfidence: averageConfidence(merged.words),
          evidenceText: line.text,
          layout: { mode: 'two-column-cast', personBox: boxFor(merged.words) },
        });
        continue;
      }
      const person = cleanPersonName(line.text);
      if (!person) continue;
      observations.push({
        name: person,
        roleOrCharacter: currentCastCharacter,
        creditType: 'actor',
        frameIndex,
        frameSec,
        videoSec,
        ocrConfidence: line.confidence,
        evidenceText: line.text,
        layout: { mode: 'grouped-cast', personBox: boxFor(line.words) },
      });
      continue;
    }
    if (!currentRole || isNoiseLine(line.text)) continue;
    const person = cleanCrewPersonName(
      line.text,
      line.confidence,
    );
    if (!person) continue;

    observations.push({
      name: person,
      roleOrCharacter: currentRole,
      creditType: isCastCreditRole(currentRole) ? 'actor' : 'crew',
      frameIndex,
      frameSec,
      videoSec,
      ocrConfidence: line.confidence,
      evidenceText: line.text,
      layout: { mode: 'role-then-name', personBox: boxFor(line.words) },
    });
  }

  return observations;
}

function editDistance(a: string, b: string): number {
  const previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i++) {
    let diagonal = previous[0];
    previous[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const old = previous[j];
      previous[j] = Math.min(
        previous[j] + 1,
        previous[j - 1] + 1,
        diagonal + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
      diagonal = old;
    }
  }
  return previous[b.length];
}

function nameTokens(value: string): string[] {
  return normalizeKey(value)
    .split(/\s+/)
    .filter((token) => token.length > 1 && !/^\d+$/.test(token));
}

function sortedNameKey(value: string): string | null {
  const tokens = nameTokens(value);
  if (tokens.length < 2) return null;
  return `${tokens.length}:${[...tokens].sort().join('|')}`;
}

function tokenNamesAreNear(a: string, b: string): boolean {
  const leftTokens = nameTokens(a);
  const rightTokens = nameTokens(b);
  if (leftTokens.length < 2 || rightTokens.length < 2) return false;
  if (Math.abs(leftTokens.length - rightTokens.length) > 1) return false;

  const unused = [...rightTokens];
  let typoSlots = 0;
  for (const token of leftTokens) {
    const exactIndex = unused.indexOf(token);
    if (exactIndex >= 0) {
      unused.splice(exactIndex, 1);
      continue;
    }

    let bestIndex = -1;
    let bestDistance = Infinity;
    for (let index = 0; index < unused.length; index++) {
      const other = unused[index];
      if (token.length < 4 || other.length < 4) continue;
      if (Math.abs(token.length - other.length) > 2) continue;
      const distance = editDistance(token, other);
      if (distance < bestDistance) {
        bestDistance = distance;
        bestIndex = index;
      }
    }

    if (bestIndex >= 0 && bestDistance > 0 && bestDistance <= 2) {
      typoSlots++;
      if (typoSlots > 1) return false;
      unused.splice(bestIndex, 1);
      continue;
    }

    return false;
  }

  return unused.length <= 1 && typoSlots <= 1;
}

function namesAreNear(a: string, b: string): boolean {
  const leftKey = sortedNameKey(a);
  const rightKey = sortedNameKey(b);
  if (leftKey && rightKey && leftKey === rightKey) return true;
  if (tokenNamesAreNear(a, b)) return true;

  const left = normalizeKey(a).replace(/ /g, '');
  const right = normalizeKey(b).replace(/ /g, '');
  if (left === right) return true;
  if (left[0] !== right[0] || Math.min(left.length, right.length) < 8) return false;
  const allowance = Math.max(left.length, right.length) >= 14 ? 2 : 1;
  return editDistance(left, right) <= allowance;
}

function isGenericActorRole(value: string): boolean {
  return normalizeKey(value) === 'ACTOR';
}

export function consolidateCreditObservations(observations: CreditObservation[]): ParsedCredit[] {
  const groups: CreditObservation[][] = [];
  for (const observation of observations) {
    const roleKey = normalizeKey(observation.roleOrCharacter);
    const existing = groups.find((group) => {
      const first = group[0];
      const sameActorWithGenericRole = first.creditType === 'actor'
        && observation.creditType === 'actor'
        && (isGenericActorRole(first.roleOrCharacter) || isGenericActorRole(observation.roleOrCharacter));
      return first.creditType === observation.creditType
        && (normalizeKey(first.roleOrCharacter) === roleKey || sameActorWithGenericRole)
        && namesAreNear(first.name, observation.name);
    });
    if (existing) existing.push(observation);
    else groups.push([observation]);
  }

  return groups.map((group) => {
    const variants = new Map<string, { name: string; count: number; confidence: number }>();
    for (const item of group) {
      const key = normalizeKey(item.name);
      const variant = variants.get(key) ?? { name: item.name, count: 0, confidence: 0 };
      variant.count++;
      variant.confidence += item.ocrConfidence;
      variants.set(key, variant);
    }
    const roleSpecificItems = group.filter((item) => (
      item.creditType !== 'actor' || !isGenericActorRole(item.roleOrCharacter)
    ));
    const variantKeys = new Set((roleSpecificItems.length ? roleSpecificItems : group)
      .map((item) => normalizeKey(item.name)));
    const bestVariant = [...variants.values()]
      .filter((variant) => variantKeys.has(normalizeKey(variant.name)))
      .sort(
      (a, b) => b.count - a.count || b.confidence - a.confidence,
    )[0];
    const matching = group.filter((item) => normalizeKey(item.name) === normalizeKey(bestVariant.name));
    const bestEvidence = [...matching].sort((a, b) => b.ocrConfidence - a.ocrConfidence)[0] ?? group[0];
    const bestRoleEvidence = [...matching].sort((a, b) => {
      const aGenericActor = a.creditType === 'actor' && isGenericActorRole(a.roleOrCharacter) ? 1 : 0;
      const bGenericActor = b.creditType === 'actor' && isGenericActorRole(b.roleOrCharacter) ? 1 : 0;
      return aGenericActor - bGenericActor || b.ocrConfidence - a.ocrConfidence;
    })[0] ?? bestEvidence;
    const frames = new Set(group.map((item) => item.frameIndex));
    return {
      name: bestVariant.name,
      roleOrCharacter: bestRoleEvidence.roleOrCharacter,
      creditType: bestEvidence.creditType,
      frameIndex: bestEvidence.frameIndex,
      frameSec: bestEvidence.frameSec,
      videoSec: bestEvidence.videoSec,
      ocrConfidence: group.reduce((sum, item) => sum + item.ocrConfidence, 0) / group.length,
      evidenceText: bestEvidence.evidenceText,
      layout: bestEvidence.layout,
      frameSupport: frames.size,
    };
  });
}
