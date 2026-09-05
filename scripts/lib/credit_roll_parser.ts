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
  'SPECIAL THANKS',
  'SPECIAL THANK',
  'APPRECIATION',
  'ACKNOWLEDGEMENT',
  'ACKNOWLEDGEMENTS',
  'ALHAMDULILLAH',
  'ALHAMDULILAH',
  'THANKS TO',
];

const NOISE_PATTERNS = [
  /^(THE END|END|CAST|CREW|CREDITS?)$/,
  /^(THANKS?|THANK YOU)( FOR WATCHING)?$/,
  /^(?:SPECIAL THANKS|SPECIAL THANK|MANY THANKS|THANKS TO|APPRECIATION|ACKNOWLEDGEMENTS?|ALHAMDULILLAH|ALHAMDULILAH|ALLAHU AKBAR)(?: TO)?$/i,
  /^(?:SPECIAL THANKS|APPRECIATION|ACKNOWLEDGEMENTS?|THANKS TO)\b/i,
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
  [/^(?:STORYI?SCREEN ?PLAY|STORY SCREEN ?PLAY|STORV SCREEN ?PLAY|SCREEN ?PLAY STORY|STORY & SCREEN ?PLAY|STORY AND SCREEN ?PLAY)(?: BY)?$/, 'Story/Screenplay'],
  [/^(?:WRITTEN|WRITER)(?: BY)?$/, 'Writer'],
  [/^ALL SONGS WRITTEN AND PERFORMED BY$/, 'Songs written and performed by'],
  [/^(?:SONGS?|MUSIC) (?:WRITTEN|PERFORMED) BY$/, 'Music'],
  [/^(?:MUSIC|SCORE|ORIGINAL SCORE|MUSIC DIRECTOR)(?: BY)?$/, 'Music'],
  [/^COMPOSER$/, 'Composer'],
  [/^(?:DIRECTED BY|DIRECTOR|CO-?DIRECTOR)$/, 'Director'],
  [/^(?:PRODUCED BY|PRODUCER)$/, 'Producer'],
  [/^(?:EXECUTIVE PRODUCED BY|EXECUTIVE PRODUCER|EXEC(?:UTIVE)? PRODUCER|EXEC\.? ?PRODUCER|EXT\.? ?PRODUCER|EX\.? ?PRODUCER)$/i, 'Executive Producer'],
  [/^(?:ASSOCIATE|CO) PRODUCER$/, 'Associate Producer'],
  [/^(?:LINE PRODUCER|PRODUCTION MANAGER|SUPERVISING PRODUCER|PM)$/, 'Production Manager'],
  [/^(?:UNIT MANAGER|UNIT PRODUCTION MANAGER|UPM)$/, 'Unit Manager'],
  [/^(?:PRODUCTION COORDINATOR|PRODUCTION CORDINATOR|PRODUCTION SUPERVISOR|PRODUCTION SECRETARY)$/, 'Production Coordinator'],
  [/^(?:PRODUCTION ASSISTANTS?|PRODUCTION ASST(?: \d+)?|PROD ASST|SET PA|OFFICE PA)$/, 'Production Assistant'],
  [/^(?:PRODUCTION DESIGNER|PRODUCTION DESIGN)$/, 'Production Designer'],
  [/^(?:ASSISTANT DIRECTOR|FIRST ASSISTANT DIRECTOR|1ST ASSISTANT DIRECTOR|1ST AD)$/, 'Assistant Director'],
  [/^(?:SECOND ASSISTANT DIRECTOR|2ND ASSISTANT DIRECTOR|2ND AD)$/, 'Second Assistant Director'],
  [/^(?:DIRECTOR OF PHOTOGRAPHY|CINEMATOGRAPHER|CINEMATOGRAPHY|HEAD OF PHOTOGRAPHY|D ?O ?P(?: S)?|BOP|POP)$/, 'Director of Photography'],
  [/^(?:CAMERA(?: OPERATOR)?|CAMERAMAN)$/, 'Camera Operator'],
  [/^(?:CAMERA ASSISTANTS?|CAMERA ASST|CAMERA ASS?T(?: \d+)?)$/, 'Camera Assistant'],
  [/^(?:CAMERA TECH|CAMERA TECHNICIAN)$/, 'Camera Technician'],
  [/^(?:1ST AC|FIRST AC|1ST ASSISTANT CAMERA|FIRST ASSISTANT CAMERA|FOCUS PULLER)$/, 'First Assistant Camera'],
  [/^(?:2ND AC|SECOND AC|2ND ASSISTANT CAMERA|SECOND ASSISTANT CAMERA)$/, 'Second Assistant Camera'],
  [/^(?:SECOND UNIT OPERATOR|SECOND CAMERA|2ND CAMERA)$/, 'Second Unit Operator'],
  [/^(?:DRONE|DRONE OPERATOR|DRONE PILOT|AERIAL CAMERA|GIMBAL OPERATOR|STEADICAM OPERATOR)$/, 'Drone Operator'],
  [/^(?:BTS|B ?T ?S|BEHIND THE SCENES|BTS CAMERA|BTS VIDEO)$/, 'BTS'],
  [/^(?:STILL PHOTOGRAPHER|STILL PHOTO|STILL PHOTOGRAPHY|PHOTOGRAPHY|STILLS)$/, 'Still Photographer'],
  [/^(?:EDITED BY|EDITOR|FILM EDITOR|LEAD EDITOR|ONLINE EDITOR|OFFLINE EDITOR)$/, 'Editor'],
  [/^(?:ASSISTANT EDITOR|ASSIST(?:ANT)? FILM EDITOR)$/, 'Assistant Editor'],
  [/^(?:COLORIST|COLOURIST|COLOR GRADING|DI COLORIST)$/, 'Colorist'],
  [/^(?:POST PRODUCTION|POST PRODUCTION SUPERVISOR|POST PRODUCTION COORDINATOR)$/, 'Post Production'],
  [/^(?:CASTING|CASTING DIRECTOR|CASTING ASSOCIATE)$/, 'Casting Director'],
  [/^(?:MAKE ?UP|MAKE ?UP ARTIST|MAKE-?UP ARTIST)$/, 'Makeup'],
  [/^(?:ASSISTANT MAKE ?UP|MAKE ?UP ASSISTANT)$/, 'Assistant Makeup'],
  [/^(?:HOD HAIR AND MAKE ?UP|HEAD OF HAIR AND MAKE ?UP|HAIR AND MAKE ?UP HOD|HAIR STYLIST|HAIRDRESSER)$/, 'Head of Hair and Makeup'],
  [/^(?:COSTUME|COSTUMIER|COSTUMIERS|COSTUME DESIGNER|WARDROBE|WARDROBE SUPERVISOR)$/, 'Costume'],
  [/^(?:ASSIST(?:ANT)? COSTUME|ASSIST(?:ANT)? COSTUMIER|WARDROBE ASSISTANT)$/, 'Assistant Costume'],
  [/^(?:ART DIRECTOR|ART DIRECTION)$/, 'Art Director'],
  [/^(?:PROPERTIES|PROPS)(?: SET DESIGN)?$/, 'Properties/Set Design'],
  [/^(?:PROPS MASTER|PROP MASTER)$/, 'Props Master'],
  [/^(?:PROPS ASSISTANT|PROP ASSISTANT|PROPERTIES ASSISTANT)$/, 'Props Assistant'],
  [/^(?:SET DESIGN|SET DESIGNER|SET DRESSER)$/, 'Set Design'],
  [/^(?:SET MAN|SET ASSISTANTS?|SET CONSTRUCTION)$/, 'Set Assistant'],
  [/^(?:SOUND RECORDIST|LOCATION SOUND|SOUND MAN|SOUND MIXER|AUDIO ENGINEER)$/, 'Sound Recordist'],
  [/^(?:SOUND DESIGN|SOUND DESIGNER)$/, 'Sound Designer'],
  [/^(?:SOUND|AUDIO)(?: ENGINEER)?$/, 'Sound'],
  [/^(?:SOUND TRACK|SOUNDTRACK)$/, 'Soundtrack'],
  [/^(?:BOOM OPERATOR|BOOM|BOOM SWINGER)$/, 'Boom Operator'],
  [/^(?:GAFFER|LIGHTING|LIGHTS?|LIGHTING TECH(?:NICIAN)?|LIGHT MAN|LIGHTMAN|KEY GRIP|GRIP|ELECTRICIAN|SPARK)$/, 'Gaffer'],
  [/^(?:BEST BOY|BEST BOY ELECTRIC|BEST BOY GRIP)$/, 'Best Boy'],
  [/^(?:LOCATIONS?|LOCATION MANAGER|LOCATION SCOUT|LOCATION COORDINATOR)$/, 'Locations'],
  [/^(?:LOCATION ASSISTANTS?)$/, 'Location Assistant'],
  [/^(?:ASSISTANTS?|PRODUCTION ASSISTANTS?|GENERAL ASSISTANTS?)$/, 'Assistant'],
  [/^(?:CONTINUITY|SCRIPT SUPERVISOR|SCRIPT CONTINUITY)$/, 'Continuity'],
  [/^(?:CONTINUITY MANAGER|CONTINUITY ASSISTANT)$/, 'Continuity'],
  [/^(?:DIALOGUE|DIALOG)$/, 'Dialogue'],
  [/^(?:SUBTITLES?|SUBTITLER|CAPTIONS?)$/, 'Subtitler'],
  [/^(?:VFX|VISUAL EFFECTS|VFX ARTIST)$/, 'Visual Effects'],
  [/^(?:GRAPHICS?|GRAPHIC DESIGNER|MOTION GRAPHICS)$/, 'Graphics'],
  [/^(?:PUBLICITY|MEDIA|SOCIAL MEDIA|PUBLICIST|PR)$/, 'Publicity'],
  [/^(?:CHOREOGRAPHER|CHOREOGRAPHY|DANCE INSTRUCTOR)$/, 'Choreographer'],
  [/^(?:STUNTS?|STUNT COORDINATOR|STUNT DIRECTOR)$/, 'Stunts'],
  [/^(?:SECURITY|SECURITY TEAM|CHIEF SECURITY OFFICER|CSO)$/, 'Security'],
  [/^(?:TRANSPORTATION|TRANSPORT|TRANSPORT MANAGER|CHIEF DRIVER|LOGISTICS)$/, 'Transportation'],
  [/^(?:RENTAL|EQUIPMENT RENTAL|EQUIPMENT)$/, 'Equipment Rental'],
  [/^(?:CATERING|CATERER|CRAFT SERVICES)$/, 'Catering'],
  [/^(?:WELFARE|WELFARE MANAGER|WELFARE ASSISTANT)$/, 'Welfare'],
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
    .replace(/\bMAKEUP\b/g, 'MAKE UP')
    .replace(/\bSCREEN PLAY\b/g, 'SCREENPLAY')
    .replace(/\bSET DESIGNER\b/g, 'SET DESIGN')
    .replace(/\bCOSTUME DESIGNER\b/g, 'COSTUME')
    .replace(/\bD O P S?\b/g, 'DOP');
  for (const [pattern, role] of ROLE_PATTERNS) {
    if (pattern.test(key)) return role;
  }
  return null;
}

function isCastCreditRole(role: string): boolean {
  return /^(?:Extra|Cameo|Special Appearance|Supporting Cast|Actor)$/i.test(role.trim());
}

function isCrewSectionHeading(value: string): boolean {
  const key = normalizeKey(value);
  return /^(?:CREW|CREWS|THE CREW|CREW LIST|CREW MEMBERS|PRODUCTION CREW|TECHNICAL CREW|BEHIND THE CAMERA|CREW CREDITS)$/.test(key);
}

function canonicalCastGroup(value: string): string | null {
  const key = normalizeKey(value)
    .replace(/\bEXTARS?\b/g, 'EXTRAS')
    .replace(/\bEXTERS?\b/g, 'EXTRAS');
  if (/^(?:CAST|CASTS|CAST LIST|CAST MEMBERS|STARRING|MAIN CAST|LEAD CAST|ACTORS?|ARTISTES?|ARTISTS?|STARRING CAST|FEATURING|FEATURED CAST)$/.test(key)) return 'Actor';
  if (/^(?:SUPPORTING CAST|SUPPORTING ACTORS?|SUPPORTING ROLES?|SUPPORTING ARTISTES?|SUPPORTING ARTISTS?|SUPPORTING)$/.test(key)) return 'Supporting Cast';
  if (/^(?:GUEST CAST|GUEST APPEARANCES?|SPECIAL APPEARANCES?|SPECIAL GUESTS?)$/.test(key)) return 'Special Appearance';
  if (/^(?:ADDITIONAL CAST|OTHER CAST)$/.test(key)) return 'Actor';
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
    .replace(/(['’])S\b/g, '$1s');
}

function personCandidateText(value: string): string {
  const text = lettersAndSpaces(
    value
      .replace(/^[^A-Z]{8,}(?=[A-Z])/g, '')
      .replace(/\[[^\]]{1,40}\]/g, ' ')
      .replace(/\s*\[[^\]]{1,40}$/g, ' ')
      .replace(/\{[^}]{1,40}\}/g, ' ')
      .replace(/\s*\{[^}]{1,40}$/g, ' ')
      .replace(/\([^)]{1,40}\)/g, ' ')
      .replace(/\s*\([^)]{1,40}$/g, ' ')
      .replace(/\|\./g, ' I ')
      .replace(/["“”'‘’`]/g, ' ')
      .replace(/[|[\]{}]/g, ' ')
      .replace(/(^|\s)\.([A-Z])\.(?=\s|$)/g, '$1$2')
      .replace(/(^|\s)([A-Z])\.(?=\s|$)/g, '$1$2')
      .replace(/\.(?=\s*$)/, ''),
  );
  const words = text.split(' ').filter(Boolean);
  if (
    words.length >= 3
    && /^[A-Z]$/i.test(words[0])
    && words[1].replace(/[^\p{L}]/gu, '').length >= 4
  ) {
    return words.slice(1).join(' ');
  }
  return words.join(' ');
}

function personTextLooksValid(text: string, allowSingleWord = false): boolean {
  if (text.length < (allowSingleWord ? 3 : 5) || text.length > 60) return false;
  if (/\d/.test(text) || canonicalRole(text) || isNoiseLine(text)) return false;
  const shape = allowSingleWord
    ? /^[\p{L}][\p{L}.'’/-]*(?: [\p{L}][\p{L}.'’/-]*)*$/u
    : /^[\p{L}][\p{L}.'’/-]*(?: [\p{L}][\p{L}.'’/-]*)+$/u;
  if (!shape.test(text)) return false;

  const words = text.split(' ').filter(Boolean);
  if (words.length < (allowSingleWord ? 1 : 2) || words.length > 5) return false;
  if (allowSingleWord && words.length === 1 && words[0].replace(/[.'’/-]/g, '').length < 3) return false;
  if (words.some((word) => word.replace(/[.'’/-]/g, '').length === 0)) return false;
  if (words.every((word) => canonicalRole(word)) || (words.length === 1 && canonicalRole(words[0]))) return false;
  if (words.some((word) => {
    const key = normalizeKey(word);
    return key.length > 1 && DIALOGUE_WORDS.has(key);
  })) return false;

  const letterLengths = words.map((word) => word.replace(/[^\p{L}]/gu, '').length);
  const averageLength = letterLengths.reduce((sum, length) => sum + length, 0) / letterLengths.length;
  if (words.length > 1 && averageLength < 3) return false;
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
  const text = lettersAndSpaces(
    value
      .replace(/\[[^\]]{1,40}\]/g, ' ')
      .replace(/\{[^}]{1,40}\}/g, ' ')
      .replace(/\([^)]{1,40}\)/g, ' ')
  ).replace(/\.(?=\s*$)/, '');
  if (!text || text.length > 60 || /\d/.test(text) || isNoiseLine(text)) return null;
  if (isExclusiveCrewRole(text)) return null;
  if (!/^[\p{L}][\p{L}.'’/-]*(?: [\p{L}][\p{L}.'’/-]*){0,5}$/u.test(text)) return null;
  return smartTitle(text);
}

function isExclusiveCrewRole(value: string): boolean {
  const role = canonicalRole(value);
  if (!role) return false;
  return !/^(?:Extra|Cameo|Special Appearance|Supporting Cast|Actor)$/i.test(role);
}

function cleanCreditCharacter(value: string): string | null {
  const text = lettersAndSpaces(
    value
      .replace(/\[[^\]]{1,40}\]/g, ' ')
      .replace(/\{[^}]{1,40}\}/g, ' ')
      .replace(/\([^)]{1,40}\)/g, ' ')
  ).replace(/\.(?=\s*$)/, '');
  if (text.length < 2 || text.length > 60 || isNoiseLine(text)) return null;
  if (isExclusiveCrewRole(text)) return null;
  if (/\d/.test(text)) {
    const digits = text.match(/\d/g) ?? [];
    if (digits.length > 2 || !/\b\d{1,2}$/.test(text)) return null;
  }
  if (!/^[\p{L}][\p{L}\p{N}.'’/-]*(?: [\p{L}\p{N}][\p{L}\p{N}.'’/-]*){0,5}$/u.test(text)) return null;
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
    const text = normalizeSpace(rawText);
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

  const lines = [...grouped.values()]
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
  return alignOcrRows(lines);
}

// Auto/sparse segmentation often puts each column in a separate OCR block.
// Pair by baseline before interpreting names or roles, never by block order.
export function alignOcrRows(lines: OcrLine[]): OcrLine[] {
  const rows: OcrLine[] = [];
  for (const line of [...lines].sort((a, b) => a.top - b.top || a.left - b.left)) {
    const row = rows.find((candidate) => {
      const height = Math.min(candidate.bottom - candidate.top, line.bottom - line.top);
      const maxHeight = Math.max(candidate.bottom - candidate.top, line.bottom - line.top);
      const overlap = Math.min(candidate.bottom, line.bottom) - Math.max(candidate.top, line.top);
      const centerDistance = Math.abs((candidate.top + candidate.bottom - line.top - line.bottom) / 2);
      const topDistance = Math.abs(candidate.top - line.top);
      const isHorizontallySeparate = (candidate.right <= line.left + 10 || line.right <= candidate.left + 10);
      const onSameLine = (height > 0 && overlap >= height * 0.35 && centerDistance <= maxHeight * 0.6)
        || (topDistance <= maxHeight * 0.45 && overlap > 0);
      return isHorizontallySeparate && onSameLine;
    });
    if (!row) {
      rows.push({ ...line, words: [...line.words] });
      continue;
    }
    row.words.push(...line.words);
    row.words.sort((a, b) => a.left - b.left);
    row.text = textForWords(row.words);
    row.left = Math.min(row.left, line.left);
    row.top = Math.min(row.top, line.top);
    row.right = Math.max(row.right, line.right);
    row.bottom = Math.max(row.bottom, line.bottom);
  }
  return rows.sort((a, b) => a.top - b.top || a.left - b.left);
}

function findCastSeparator(lines: OcrLine[]): number | null {
  const gaps: Array<{ start: number; end: number; lineIndex: number }> = [];
  for (const [lineIndex, line] of lines.entries()) {
    for (let i = 0; i < line.words.length - 1; i++) {
      const current = line.words[i];
      const next = line.words[i + 1];
      const gap = next.left - (current.left + current.width);
      const threshold = Math.max(18, Math.max(current.height, next.height) * 1.35);
      if (gap >= threshold) {
        gaps.push({ start: current.left + current.width, end: next.left, lineIndex });
      }
    }
  }

  let best: { midpoint: number; support: number } | null = null;
  for (const gap of gaps) {
    for (const point of [gap.start + 1, (gap.start + gap.end) / 2, gap.end - 1]) {
      const nearby = gaps.filter((candidate) => candidate.start < point && candidate.end > point);
      const support = new Set(nearby.map((candidate) => candidate.lineIndex)).size;
      if (!best || support > best.support) {
        best = {
          midpoint: (Math.max(...nearby.map((candidate) => candidate.start))
            + Math.min(...nearby.map((candidate) => candidate.end))) / 2,
          support,
        };
      }
    }
  }
  return best && best.support >= 3 ? best.midpoint : null;
}

function splitAtSeparator(line: OcrLine, separatorX: number): [OcrWord[], OcrWord[]] | null {
  for (let i = 0; i < line.words.length - 1; i++) {
    const current = line.words[i];
    const next = line.words[i + 1];
    const gap = next.left - (current.left + current.width);
    if (gap >= 18 && current.left + current.width <= separatorX && next.left >= separatorX) {
      return [line.words.slice(0, i + 1), line.words.slice(i + 1)];
    }
  }
  return null;
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

function splitTwoColumnLine(
  line: OcrLine,
  separatorX: number,
  actorSide?: 'left' | 'right',
): {
  name: string;
  roleOrCharacter: string;
  creditType: CreditType;
  words: OcrWord[];
  mode: 'two-column-cast' | 'role-then-name';
} | null {
  let split = splitAtSeparator(line, separatorX);
  if (!split) {
    for (let i = line.words.length - 1; i >= 1; i--) {
      const leftW = line.words.slice(0, i);
      const rightW = line.words.slice(i);
      const gap = rightW[0].left - (leftW[leftW.length - 1].left + leftW[leftW.length - 1].width);
      if (gap >= 8) {
        const leftT = textForWords(leftW);
        const rightT = textForWords(rightW);
        const lRole = canonicalRole(leftT);
        const rRole = canonicalRole(rightT);
        if ((lRole && !isCastCreditRole(lRole)) || (rRole && !isCastCreditRole(rRole))) {
          split = [leftW, rightW];
          break;
        }
      }
    }
  }
  if (!split) return null;
  const [leftWords, rightWords] = split;
  const leftText = textForWords(leftWords);
  const rightText = textForWords(rightWords);

  // 1. Crew role on Left, Crew person on Right
  const leftRole = canonicalRole(leftText);
  const rightRole = canonicalRole(rightText);

  if (leftRole && !isCastCreditRole(leftRole)) {
    const person = cleanCrewPersonName(rightText, averageConfidence(rightWords));
    if (person) {
      return {
        name: person,
        roleOrCharacter: leftRole,
        creditType: 'crew',
        words: rightWords,
        mode: 'role-then-name',
      };
    }
  }

  // 2. Crew person on Left, Crew role on Right
  if (rightRole && !isCastCreditRole(rightRole)) {
    const person = cleanCrewPersonName(leftText, averageConfidence(leftWords));
    if (person) {
      return {
        name: person,
        roleOrCharacter: rightRole,
        creditType: 'crew',
        words: leftWords,
        mode: 'role-then-name',
      };
    }
  }

  // 3. Two column cast: Character and Actor
  const leftPerson = cleanPersonName(leftText);
  const rightPerson = cleanPersonName(rightText);
  const leftCharacter = cleanCreditCharacter(leftText);
  const rightCharacter = cleanCreditCharacter(rightText);
  const leftLooksPerson = !!leftPerson;
  const rightLooksPerson = !!rightPerson;
  const actorOnLeft = leftLooksPerson && !!rightCharacter && !leftRole;
  const actorOnRight = rightLooksPerson && !!leftCharacter && !rightRole;

  if (actorSide === 'left') {
    return actorOnLeft ? {
      name: leftPerson!,
      roleOrCharacter: rightCharacter!,
      creditType: 'actor',
      words: leftWords,
      mode: 'two-column-cast',
    } : null;
  }
  if (actorSide === 'right') {
    return actorOnRight ? {
      name: rightPerson!,
      roleOrCharacter: leftCharacter!,
      creditType: 'actor',
      words: rightWords,
      mode: 'two-column-cast',
    } : null;
  }

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

  if (actorOnRight && !actorOnLeft) {
    return {
      name: rightPerson!,
      roleOrCharacter: leftCharacter!,
      creditType: 'actor',
      words: rightWords,
      mode: 'two-column-cast',
    };
  }

  if (actorOnLeft && !actorOnRight) {
    return {
      name: leftPerson!,
      roleOrCharacter: rightCharacter!,
      creditType: 'actor',
      words: leftWords,
      mode: 'two-column-cast',
    };
  }

  if (actorOnLeft && actorOnRight) {
    const leftScore = characterScore(leftCharacter ?? '');
    const rightScore = characterScore(rightCharacter ?? '');
    if (rightScore >= leftScore + 2) {
      return {
        name: leftPerson!,
        roleOrCharacter: rightCharacter!,
        creditType: 'actor',
        words: leftWords,
        mode: 'two-column-cast',
      };
    }
    if (leftScore >= rightScore + 2) {
      return {
        name: rightPerson!,
        roleOrCharacter: leftCharacter!,
        creditType: 'actor',
        words: rightWords,
        mode: 'two-column-cast',
      };
    }
    return null;
  }

  return null;
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
    if (section === 'CREW' || isCrewSectionHeading(line.text) || canonicalRole(line.text) || canonicalCastGroup(line.text)) break;
    if (!looksLikePerson(line.text)) break;
    count++;
  }
  return count;
}

const CHARACTER_GROUP_KEYWORDS = /\b(?:FRIENDS?|BOYFRIEND|GIRLFRIEND|HUSBAND|WIFE|WIVES|FAMILY|BROTHERS?|SISTERS?|ELDERS?|GUARDS?|MAIDS?|VILLAGERS?|STUDENTS?|CHILDREN|GUESTS?|WORKERS?|OFFICERS?|MEMBERS?|CUSTOMERS?|GIRLS?|BOYS?|WOMEN|MEN|EXTRAS?|DANCERS?|KIDNAPPERS?|THUGS?|NURSES?|DOCTORS?|PATIENTS?|COUPLE|CROWD)\b/i;

function castCharacterHeading(
  line: OcrLine,
  followingLines: OcrLine[],
  inCastContext: boolean,
): string | null {
  if (canonicalCastGroup(line.text) || isCrewSectionHeading(line.text) || canonicalRole(line.text) || isNoiseLine(line.text)) return null;
  const character = cleanCharacter(line.text);
  if (!character) return null;

  const key = normalizeKey(line.text);
  const words = key.split(' ').filter(Boolean);
  if (words.length > 5) return null;

  const possessive = /(?:'|’|')S\b/i.test(line.text);
  const hasGroupKeyword = CHARACTER_GROUP_KEYWORDS.test(key);

  if (!possessive && !hasGroupKeyword) return null;

  const followingPeople = consecutivePersonLines(followingLines);
  if (followingPeople < (inCastContext ? 1 : 2)) return null;

  return character;
}

function sameLineRoleAndName(line: OcrLine): { role: string; name: string; words: OcrWord[] } | null {
  for (let i = line.words.length - 1; i >= 1; i--) {
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

  const candidateRows = usable.filter((line) => !isNoiseLine(line.text));
  const separatorX = findCastSeparator(candidateRows);
  const handledRows = new Set<OcrLine>();
  const explicitCreditSignal = usable.some((line) => {
    const section = normalizeKey(line.text);
    return section === 'CAST' || section === 'CREW' || section === 'CREDITS'
      || isCrewSectionHeading(line.text)
      || !!canonicalCastGroup(line.text)
      || !!canonicalRole(line.text);
  });

  if (separatorX !== null) {
    const castVotes = candidateRows.flatMap((line) => {
      const parsed = splitTwoColumnLine(line, separatorX);
      if (parsed && parsed.creditType === 'actor') {
        return [parsed.words[0].left < separatorX ? 'left' : 'right'];
      }
      return [];
    });
    const leftVotes = castVotes.filter((side) => side === 'left').length;
    const rightVotes = castVotes.length - leftVotes;
    const actorSide = rightVotes >= 2 && rightVotes > leftVotes * 2 ? 'right'
      : leftVotes >= 2 && leftVotes > rightVotes * 2 ? 'left' : undefined;

    const twoColumnLines = candidateRows
      .map((line) => ({ line, item: splitTwoColumnLine(line, separatorX, actorSide) }))
      .filter((entry): entry is { line: OcrLine; item: NonNullable<ReturnType<typeof splitTwoColumnLine>> } => !!entry.item);

    if (twoColumnLines.length >= 3 || (explicitCreditSignal && twoColumnLines.length >= 2)) {
      let previous: { line: OcrLine; character: string } | null = null;
      for (const line of candidateRows) {
        const paired = twoColumnLines.find((entry) => entry.line === line)?.item;
        const onPersonSide = actorSide === 'right' ? line.left > separatorX
          : actorSide === 'left' ? line.right < separatorX : false;
        const continuation = !paired && onPersonSide && previous
          && /\b(?:birds|friends|guards|extras|villagers|children|students|guests|workers|couple|crowd)\b/i.test(previous.character)
          && line.top - previous.line.bottom <= Math.max(14, previous.line.bottom - previous.line.top) * 4
          ? cleanPersonName(line.text) : null;
        const result = paired ?? (continuation && previous
          ? {
            name: continuation,
            roleOrCharacter: previous.character,
            creditType: 'actor' as CreditType,
            words: line.words,
            mode: 'two-column-cast' as const,
          } : null);

        if (line.left < separatorX && line.right > separatorX) handledRows.add(line);
        if (!result) {
          previous = null;
          continue;
        }
        handledRows.add(line);
        previous = result.creditType === 'actor' ? { line, character: result.roleOrCharacter } : null;
        observations.push({
          name: result.name,
          roleOrCharacter: result.roleOrCharacter,
          creditType: result.creditType,
          frameIndex,
          frameSec,
          videoSec,
          ocrConfidence: averageConfidence(result.words),
          evidenceText: line.text,
          layout: {
            mode: result.mode,
            personBox: boxFor(result.words),
            separatorX: Math.round(separatorX),
          },
        });
      }
    }
  }

  let currentRole: string | null = null;
  let currentCastCharacter: string | null = null;
  let previousRoleLine: OcrLine | null = null;
  for (let lineIndex = 0; lineIndex < usable.length; lineIndex++) {
    const line = usable[lineIndex];
    if (handledRows.has(line)) continue;
    if (currentRole && previousRoleLine
      && line.top - previousRoleLine.bottom > Math.max(28, (previousRoleLine.bottom - previousRoleLine.top) * 2.5)) {
      currentRole = null;
    }
    previousRoleLine = line;
    const castGroup = canonicalCastGroup(line.text);
    if (castGroup) {
      currentRole = null;
      currentCastCharacter = castGroup;
      continue;
    }
    if (isCrewSectionHeading(line.text)) {
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
    if (separatorX === null && findLineSeparator(line) === null) {
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
        const twoCol = splitTwoColumnLine(line, contextualSeparator);
        if (twoCol && currentCastCharacter === 'Actor') {
          if (separatorX !== null) continue;
          observations.push({
            name: twoCol.name,
            roleOrCharacter: twoCol.roleOrCharacter,
            creditType: twoCol.creditType,
            frameIndex,
            frameSec,
            videoSec,
            ocrConfidence: averageConfidence(twoCol.words),
            evidenceText: line.text,
            layout: {
              mode: twoCol.mode,
              personBox: boxFor(twoCol.words),
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
