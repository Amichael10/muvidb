// The credit role vocabulary, shared by the film drawer (AdminFilms) and the
// add-credit flow on the person drawer (AdminPeople). It lived inline in
// AdminFilms as a hardcoded <select>; both screens write to the same
// credits.role column, so a single list is the only way they stay in step.
//
// Roles are stored LOWERCASE and rendered Sentence case by formatRole(). A
// trigger (20260717122831_normalize_credit_roles.sql) lowercases on write, so
// every reader can compare against the plain lowercase value.
//
// Synonyms (costumier, make-up, D.O.P., screenplay, …) are folded to the
// canonical values below via canonicalizeRole() so the ensemble reads as one
// educated vocabulary — filters, OCR extract, and admin drawers all share it.

export const CAST_ROLE = 'actor';

export const CREW_ROLES = [
  { value: 'director', label: 'Director' },
  { value: 'producer', label: 'Producer' },
  { value: 'executive producer', label: 'Executive producer' },
  { value: 'writer', label: 'Writer' },
  { value: 'cinematographer', label: 'Cinematographer (DOP)' },
  { value: 'editor', label: 'Editor' },
  { value: 'composer', label: 'Composer (music)' },
  { value: 'sound recordist', label: 'Sound recordist' },
  { value: 'production designer', label: 'Production designer' },
  { value: 'art director', label: 'Art director' },
  { value: 'makeup artist', label: 'Makeup artist' },
  { value: 'costume designer', label: 'Costume designer' },
  { value: 'gaffer', label: 'Gaffer' },
  { value: 'continuity', label: 'Continuity' },
  { value: 'production manager', label: 'Production manager' },
  { value: 'assistant director', label: 'Assistant director' },
  { value: 'colorist', label: 'Colorist' },
  { value: 'vfx', label: 'VFX' },
  { value: 'stunts', label: 'Stunts' },
  { value: 'casting director', label: 'Casting director' },
  { value: 'location manager', label: 'Location manager' },
  { value: 'production assistant', label: 'Production assistant' },
  { value: 'camera assistant', label: 'Camera assistant' },
];

// Every role the film drawer's <select> offers, cast first.
export const ALL_ROLES = [{ value: CAST_ROLE, label: 'Actor' }, ...CREW_ROLES];

// People directory filter chips — canonical ensemble departments.
export const PEOPLE_ROLE_FILTERS = [
  'All',
  'Actor',
  'Director',
  'Writer',
  'Producer',
  'Executive producer',
  'Cinematographer',
  'Editor',
  'Composer',
  'Sound recordist',
  'Costume designer',
  'Makeup artist',
  'Gaffer',
  'Art director',
  'Production designer',
  'Assistant director',
  'Casting director',
];

/** Map filter chip label → credits.role / known_for_department value. */
export const PEOPLE_FILTER_TO_ROLE = {
  Actor: 'actor',
  Director: 'director',
  Writer: 'writer',
  Producer: 'producer',
  'Executive producer': 'executive producer',
  Cinematographer: 'cinematographer',
  Editor: 'editor',
  Composer: 'composer',
  'Sound recordist': 'sound recordist',
  'Costume designer': 'costume designer',
  'Makeup artist': 'makeup artist',
  Gaffer: 'gaffer',
  'Art director': 'art director',
  'Production designer': 'production designer',
  'Assistant director': 'assistant director',
  'Casting director': 'casting director',
};

export function normalizeRole(role) {
  return (role || '')
    .trim()
    .toLowerCase()
    .replace(/[_/]+/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/^[-–—]+\s*/, '')
    .replace(/\s*[-–—]+$/, '');
}

/**
 * Fold industry synonyms onto the canonical vocabulary.
 * Unknown roles pass through normalized (lowercased) so we never invent junk.
 */
export function canonicalizeRole(role) {
  const key = normalizeRole(role);
  if (!key) return key;

  // Already canonical
  if (LABEL_BY_VALUE.has(key)) return key;

  const aliased = ROLE_ALIASES[key];
  if (aliased) return aliased;

  // Soft patterns for things like "1st assistant director", "2nd unit camera"
  for (const { test, value } of ROLE_PATTERNS) {
    if (test(key)) return value;
  }

  return key;
}

export function isCastRole(role) {
  return canonicalizeRole(role) === CAST_ROLE;
}

// Stored lowercase, shown Sentence case. Known roles use their label so
// acronyms survive (a naive capitalise would render "vfx" as "Vfx").
const LABEL_BY_VALUE = new Map(
  [{ value: CAST_ROLE, label: 'Actor' }, ...CREW_ROLES].map((r) => [r.value, r.label]),
);

export function formatRole(role) {
  const key = canonicalizeRole(role);
  if (!key) return '';
  const known = LABEL_BY_VALUE.get(key);
  if (known) return known;
  // Dotted initialisms ("d.o.p.", "b.t.s", "p.a")
  if (/^[a-z](\.[a-z])+\.?$/.test(key)) return key.toUpperCase();
  return key.charAt(0).toUpperCase() + key.slice(1);
}

/** known_for_department display / storage — short ensemble labels. */
export function formatDepartment(roleOrDept) {
  const raw = normalizeRole(roleOrDept);
  if (!raw) return '';
  const fromDept = DEPT_ALIASES[raw];
  const key = canonicalizeRole(fromDept || roleOrDept);
  if (!key) return '';
  // Only emit labels for the known vocabulary — never promote OCR junk
  if (!LABEL_BY_VALUE.has(key)) return '';
  return DEPARTMENT_LABELS[key] || LABEL_BY_VALUE.get(key) || '';
}

/** Short labels for people cards / filters (no "(DOP)" / "(music)" suffixes). */
const DEPARTMENT_LABELS = {
  actor: 'Actor',
  director: 'Director',
  producer: 'Producer',
  'executive producer': 'Executive producer',
  writer: 'Writer',
  cinematographer: 'Cinematographer',
  editor: 'Editor',
  composer: 'Composer',
  'sound recordist': 'Sound recordist',
  'production designer': 'Production designer',
  'art director': 'Art director',
  'makeup artist': 'Makeup artist',
  'costume designer': 'Costume designer',
  gaffer: 'Gaffer',
  continuity: 'Continuity',
  'production manager': 'Production manager',
  'assistant director': 'Assistant director',
  colorist: 'Colorist',
  vfx: 'VFX',
  stunts: 'Stunts',
  'casting director': 'Casting director',
  'location manager': 'Location manager',
  'production assistant': 'Production assistant',
  'camera assistant': 'Camera assistant',
};

// ---------------------------------------------------------------------------
// Alias tables — meaning-based, not spelling-only.
// ---------------------------------------------------------------------------

const ROLE_ALIASES = {
  // Cast
  cast: 'actor',
  acting: 'actor',
  actress: 'actor',
  extra: 'actor',
  extras: 'actor',
  'court extras': 'actor',
  talent: 'actor',

  // Director
  directing: 'director',
  'dialogue director': 'director',
  'artistic director': 'director',

  // Producer family
  producers: 'producer',
  producing: 'producer',
  production: 'producer',
  'associate producer': 'producer',
  'assistant producer': 'producer',
  'line producer': 'producer',
  'co producer': 'producer',
  'co-producer': 'producer',
  coproducer: 'producer',
  'producer executive producer': 'executive producer',
  'producer/executive producer': 'executive producer',
  executive_producer: 'executive producer',
  'exec producer': 'executive producer',
  'exec. producer': 'executive producer',
  'executive producers': 'executive producer',

  // Writing
  writing: 'writer',
  screenplay: 'writer',
  screenwriter: 'writer',
  'screen play': 'writer',
  story: 'writer',
  'story by': 'writer',
  'story writer': 'writer',
  'story screenplay': 'writer',
  'story/screenplay': 'writer',
  'story / screenplay': 'writer',
  script: 'writer',
  scripts: 'writer',
  'script writer': 'writer',
  'scriptwriter': 'writer',
  creator: 'writer',

  // Camera / DOP
  dop: 'cinematographer',
  'd.o.p': 'cinematographer',
  'd.o.p.': 'cinematographer',
  'director of photography': 'cinematographer',
  director_of_photography: 'cinematographer',
  photography: 'cinematographer',
  camera: 'cinematographer',
  'camera and electrical department': 'cinematographer',
  'camera operator': 'cinematographer',
  'camera man': 'cinematographer',
  cameraman: 'cinematographer',
  'second unit camera': 'cinematographer',
  '2nd unit camera': 'cinematographer',
  'second unit cameraman': 'cinematographer',
  'camera unit 2': 'cinematographer',

  // Camera support
  'camera assistant': 'camera assistant',
  camera_assistant: 'camera assistant',
  'cam assistant': 'camera assistant',
  'cam tech': 'camera assistant',
  'camera tech': 'camera assistant',
  'camera technician': 'camera assistant',
  camera_technician: 'camera assistant',
  'camera asst': 'camera assistant',
  'camera assist': 'camera assistant',
  'assistant camera': 'camera assistant',
  'focus puller': 'camera assistant',
  'clapper loader': 'camera assistant',
  clapper: 'camera assistant',
  '1st ac': 'camera assistant',
  '2nd ac': 'camera assistant',

  // Editing
  editing: 'editor',
  'film editor': 'editor',
  'movie editor': 'editor',
  'supervising editor': 'editor',
  'assistant editor': 'editor',
  assistant_editor: 'editor',
  'assistant film editor': 'editor',
  'editor/colorist': 'editor',
  'editor colorist': 'editor',

  // Color
  colourist: 'colorist',
  color: 'colorist',
  colour: 'colorist',

  // Music
  music: 'composer',
  soundtrack: 'composer',
  'sound track': 'composer',
  'sound score': 'composer',
  soundscore: 'composer',
  'original music composer': 'composer',
  'soundtrack composer': 'composer',
  'mood sound producer': 'composer',
  score: 'composer',

  // Sound
  sound: 'sound recordist',
  'sound man': 'sound recordist',
  soundman: 'sound recordist',
  sound_recordist: 'sound recordist',
  'sound engineer': 'sound recordist',
  'sound mixer': 'sound recordist',
  'sound assistant': 'sound recordist',
  'sound department': 'sound recordist',
  'sound designer': 'sound recordist',
  sound_designer: 'sound recordist',
  'boom operator': 'sound recordist',
  'boom swinger': 'sound recordist',
  'light & sound': 'sound recordist',
  'light/sound': 'sound recordist',
  'light sound': 'sound recordist',
  'sound and graphics': 'sound recordist',

  // Lighting / gaffer
  spark: 'gaffer',
  lighting: 'gaffer',
  light: 'gaffer',
  'light man': 'gaffer',
  'best boy': 'gaffer',
  best_boy: 'gaffer',
  'assistant gaffer': 'gaffer',
  electrician: 'gaffer',

  // Makeup
  makeup: 'makeup artist',
  'make up': 'makeup artist',
  'make-up': 'makeup artist',
  makeup_artist: 'makeup artist',
  'make-up artist': 'makeup artist',
  'make up artist': 'makeup artist',
  'makeup department': 'makeup artist',
  'costume & makeup': 'makeup artist',
  'costume and makeup': 'makeup artist',
  'assistant makeup artist': 'makeup artist',
  'makeup assistant': 'makeup artist',
  'make up assistant': 'makeup artist',
  'assistant make up': 'makeup artist',
  'assistant makeup': 'makeup artist',
  'assistant make-up': 'makeup artist',
  'make-up asst': 'makeup artist',
  'make up asst': 'makeup artist',
  'makeup artist assistant': 'makeup artist',
  'hair stylist': 'makeup artist',
  hairstylist: 'makeup artist',
  'hair stylist assistant': 'makeup artist',
  stylist: 'makeup artist',
  'music composer': 'composer',
  'property set manager': 'art director',
  'properties set design': 'art director',
  'pops sett': 'art director',
  'digital imaging technician': 'camera assistant',
  'audio post supervisor': 'sound recordist',
  'bts still photo': 'camera assistant',
  'key grip': 'gaffer',
  '2nd unit camera operator': 'cinematographer',
  grip: 'gaffer',

  // Costume / wardrobe
  costumier: 'costume designer',
  costume: 'costume designer',
  costumer: 'costume designer',
  costume_designer: 'costume designer',
  'costume design': 'costume designer',
  wardrobe: 'costume designer',
  'wardrobe designer': 'costume designer',
  'wardrobe stylist': 'costume designer',
  'wardrobe manager': 'costume designer',
  'wardrobe department': 'costume designer',
  'costume and wardrobe department': 'costume designer',
  'costume & make-up': 'costume designer',
  'assistant costumier': 'costume designer',
  'costumier assistant': 'costume designer',
  'costume assistant': 'costume designer',
  'assistant costume': 'costume designer',
  'assistant costumer': 'costume designer',
  'assistant wardrobe': 'costume designer',
  'wardrobe assistant': 'costume designer',
  'costume manager': 'costume designer',

  // Continuity / script supervisor
  'script supervisor': 'continuity',
  script_supervisor: 'continuity',
  'script and continuity department': 'continuity',
  'continuity manager': 'continuity',
  'continuity supervisor': 'continuity',
  continuity_supervisor: 'continuity',
  'assistant continuity': 'continuity',
  'ad/script supervisor': 'continuity',
  'ad script supervisor': 'continuity',

  // Art / set / props → art director (ensemble meaning: look of the world)
  'set designer': 'art director',
  'art designer': 'art director',
  'art department': 'art director',
  art: 'art director',
  props: 'art director',
  'props master': 'art director',
  'props & set': 'art director',
  'props/set': 'art director',
  'props and set': 'art director',
  'set/props': 'art director',
  'set & props': 'art director',
  'set and props': 'art director',
  'props & set designer': 'art director',
  setman: 'art director',
  'set man': 'art director',
  'set dresser': 'art director',
  set_dresser: 'art director',
  'set decorator': 'art director',
  'set assistant': 'art director',
  'set member': 'art director',
  'assistant props': 'art director',
  'assistant props/set': 'art director',
  'props assistant': 'art director',
  'props & set assistant': 'art director',
  'property manager': 'art director',
  'assistant art director': 'art director',

  // Production design
  'production design': 'production designer',

  // Production office
  production_manager: 'production manager',
  'production management': 'production manager',
  'production supervisor': 'production manager',
  'production coordinator': 'production manager',
  'production co-ordinator': 'production manager',
  'production co ordinator': 'production manager',
  coordinator: 'production manager',
  'assistant production manager': 'production manager',
  'production manager 2': 'production manager',
  production_assistant: 'production assistant',
  'prod assistant': 'production assistant',
  'prod. assistant': 'production assistant',
  pa: 'production assistant',
  'p.a': 'production assistant',
  'p.a.': 'production assistant',
  assistant: 'production assistant',
  asst: 'production assistant',
  assistance: 'production assistant',

  // AD
  '1st assistant director': 'assistant director',
  '2nd assistant director': 'assistant director',
  'first assistant director': 'assistant director',
  'second assistant director': 'assistant director',
  '3rd assistant director': 'assistant director',
  ad: 'assistant director',
  'a.d': 'assistant director',
  'a.d.': 'assistant director',

  // Locations
  location_manager: 'location manager',
  'location management': 'location manager',
  location: 'location manager',
  'location scout': 'location manager',
  'location driver': 'location manager',

  // Casting
  casting: 'casting director',

  // VFX / SFX
  'visual effects': 'vfx',
  'special effects': 'vfx',
  'special effects & prosthetics': 'vfx',
  special_effects_assistant: 'vfx',
  'v.f.x': 'vfx',
  'v.f.x.': 'vfx',
  graphics: 'vfx',

  // Stunts
  stunt: 'stunts',
  'stunt coordinator': 'stunts',
  'stunt double': 'stunts',

  // Still photo → often BTS; fold to camera assistant? or leave.
  // Map to cinematographer department loosely — stills are camera dept.
  'still photo': 'camera assistant',
  'still photographer': 'camera assistant',
  'set photographer': 'camera assistant',
  photographer: 'camera assistant',
  bts: 'camera assistant',
  'b.t.s': 'camera assistant',
  'b.t.s.': 'camera assistant',
};

const ROLE_PATTERNS = [
  { test: (k) => /\b(director of phot|cinematograph|dir\.?\s*of\s*phot)/.test(k), value: 'cinematographer' },
  { test: (k) => (/\bassistant director\b/.test(k) || /^[123](st|nd|rd|th)?\s*a\.?d\.?$/.test(k)) && !/\bphot/.test(k), value: 'assistant director' },
  { test: (k) => /\b(make[\s-]?up|hair\s*stylist)/.test(k), value: 'makeup artist' },
  { test: (k) => /\b(costume|costumier|wardrobe)\b/.test(k), value: 'costume designer' },
  { test: (k) => /\b(screenplay|screenwriter|story)\b/.test(k), value: 'writer' },
  { test: (k) => /\b(executive\s*producer|exec\.?\s*producer)\b/.test(k), value: 'executive producer' },
  { test: (k) => /\bproducer\b/.test(k) && !/\bexecutive\b/.test(k), value: 'producer' },
  { test: (k) => /\b(sound|boom|audio)\b/.test(k), value: 'sound recordist' },
  { test: (k) => /\b(edit|editor)\b/.test(k), value: 'editor' },
  { test: (k) => /\b(gaffer|spark|light(ing)?|grip)\b/.test(k), value: 'gaffer' },
  { test: (k) => /\b(continuity|script supervisor)\b/.test(k), value: 'continuity' },
  { test: (k) => /\b(props?|propert|set dresser|set man|setman|pops)\b/.test(k), value: 'art director' },
  { test: (k) => /\b(camera assist|focus puller|clapper|still photo|bts)\b/.test(k), value: 'camera assistant' },
  { test: (k) => /\b(production assistant|\bp\.?a\.?\b)/.test(k), value: 'production assistant' },
  { test: (k) => /\b(vfx|visual effects|special effects)\b/.test(k), value: 'vfx' },
  { test: (k) => /\bstunt/.test(k), value: 'stunts' },
  { test: (k) => /\bcomposer\b|\bmusic\b/.test(k), value: 'composer' },
  { test: (k) => /\bdirector\b/.test(k) && !/\bphot/.test(k) && !/\bassistant\b/.test(k) && !/\bcamera\b/.test(k), value: 'director' },
];

// TMDB / enrichment department strings → credit role
const DEPT_ALIASES = {
  acting: 'actor',
  directing: 'director',
  production: 'producer',
  writing: 'writer',
  editing: 'editor',
  'camera and electrical department': 'cinematographer',
  camera: 'cinematographer',
  sound: 'sound recordist',
  'sound department': 'sound recordist',
  'costume & make-up': 'costume designer',
  'costume and make-up': 'costume designer',
  'costume design': 'costume designer',
  'makeup department': 'makeup artist',
  'script and continuity department': 'continuity',
  'production management': 'production manager',
  'location management': 'location manager',
  'visual effects': 'vfx',
  'original music composer': 'composer',
  crew: 'production assistant',
  other: '',
  producers: 'producer',
};
