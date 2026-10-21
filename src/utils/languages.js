// Language normalization + multi-language support.
//
// The DB `language` field is a single string in mixed formats — full names
// ("English", "Yoruba"), ISO codes ("yo", "ig", "ha"), and delimited multiples
// ("English, Yoruba", "Yoruba/Pidgin"). This normalizes all of that into a
// clean array of display names, so films can carry one OR several languages.

const LANG_MAP = {
  en: 'English', yo: 'Yoruba', ig: 'Igbo', ha: 'Hausa', pcm: 'Pidgin',
  fr: 'French', sw: 'Swahili', ak: 'Akan', tw: 'Twi', ee: 'Ewe', gaa: 'Ga',
  wo: 'Wolof', zu: 'Zulu', xh: 'Xhosa', af: 'Afrikaans', st: 'Sotho',
  tn: 'Tswana', sn: 'Shona', ny: 'Chichewa', am: 'Amharic', so: 'Somali',
  rw: 'Kinyarwanda', lg: 'Luganda', ln: 'Lingala', kg: 'Kikongo', ff: 'Fulani',
  bm: 'Bambara', ar: 'Arabic', pt: 'Portuguese', es: 'Spanish', de: 'German',
  ru: 'Russian', ja: 'Japanese', uk: 'Ukrainian', it: 'Italian', nl: 'Dutch',
  zh: 'Chinese', hi: 'Hindi',
};

/** One raw token ("yo", "English", "yoruba ") -> a display name, or null. */
export function normalizeLanguage(raw) {
  const t = String(raw ?? '').trim();
  if (!t) return null;
  const key = t.toLowerCase();
  if (LANG_MAP[key]) return LANG_MAP[key];
  // Unknown short token → assume a code, upper-case it; otherwise title-case.
  return t.length <= 3 && t === key ? t.toUpperCase() : t.charAt(0).toUpperCase() + t.slice(1);
}

/** A delimited string -> a de-duped array of display names. */
export function parseLanguages(str) {
  if (!str) return [];
  const out = [];
  for (const part of String(str).split(/[,/&|;]+/)) {
    const n = normalizeLanguage(part);
    if (n && !out.includes(n)) out.push(n);
  }
  return out;
}

/** The canonical languages for a film: the `languages` array if set, else parsed
 *  from the legacy `language` string. Always returns an array (possibly empty). */
export function getFilmLanguages(film) {
  if (Array.isArray(film?.languages) && film.languages.length) return film.languages;
  return parseLanguages(film?.language);
}

/**
 * Curated list of African (and Africa-relevant) languages for the film edit
 * dropdown. Ordered by how common they are in this catalogue — Nigerian tongues
 * first, then wider West/East/Southern Africa, then the colonial linguae francae,
 * then a small tail of non-African languages that still occur in the data.
 *
 * Every entry is a display name that matches normalizeLanguage()'s output, so a
 * value picked here round-trips cleanly through parseLanguages().
 */
export const AFRICAN_LANGUAGES = [
  // Nigeria (the bulk of the catalogue)
  'English', 'Pidgin', 'Yoruba', 'Igbo', 'Hausa', 'Fulani', 'Edo', 'Ibibio',
  'Efik', 'Tiv', 'Kanuri', 'Nupe', 'Ijaw', 'Urhobo', 'Igala',
  // Ghana / wider West Africa
  'Twi', 'Akan', 'Ewe', 'Ga', 'Fante', 'Dagbani', 'Wolof', 'Bambara', 'Mandinka',
  'Krio', 'Mossi', 'Fon',
  // Central Africa
  'Lingala', 'Kikongo', 'Tshiluba', 'Sango',
  // East Africa
  'Swahili', 'Amharic', 'Oromo', 'Tigrinya', 'Somali', 'Kinyarwanda', 'Kirundi',
  'Luganda', 'Kikuyu', 'Luo',
  // Southern Africa
  'Zulu', 'Xhosa', 'Afrikaans', 'Sotho', 'Tswana', 'Shona', 'Ndebele', 'Swazi',
  'Tsonga', 'Venda', 'Chichewa', 'Bemba',
  // North Africa / diaspora linguae francae
  'Arabic', 'French', 'Portuguese', 'Spanish',
];

/**
 * How speakers name their own language. Only languages whose endonym actually
 * differs from the English exonym appear here — for Hausa, Twi, Wolof and
 * others the two are the same, so they fall through and the English name is
 * used as-is.
 *
 * The Bantu entries keep their noun-class prefix (isiZulu, Kiswahili, Sesotho)
 * because that prefix is part of the name, not decoration.
 */
const LANGUAGE_ENDONYMS = {
  // Nigeria
  Yoruba: 'Yorùbá',
  Igbo: 'Ìgbò',
  Pidgin: 'Naijá',
  'Nigerian Pidgin': 'Naijá',
  Fulani: 'Fulfulde',
  Edo: 'Ẹ̀dó',
  Efik: 'Efịk',
  Ijaw: 'Ìzon',
  // Ghana / wider West Africa
  Ewe: 'Eʋegbe',
  Ga: 'Gã',
  Fante: 'Mfantse',
  Bambara: 'Bamanankan',
  // Central Africa
  Lingala: 'Lingála',
  // East Africa
  Swahili: 'Kiswahili',
  Kinyarwanda: 'Ikinyarwanda',
  Kirundi: 'Ikirundi',
  Luganda: 'Oluganda',
  Kikuyu: 'Gĩkũyũ',
  Somali: 'Soomaali',
  Oromo: 'Afaan Oromoo',
  // Southern Africa
  Zulu: 'isiZulu',
  Xhosa: 'isiXhosa',
  Sotho: 'Sesotho',
  Tswana: 'Setswana',
  Shona: 'chiShona',
  Ndebele: 'isiNdebele',
  Tsonga: 'Xitsonga',
  Venda: 'Tshivenḓa',
  Bemba: 'Ichibemba',
  // Linguae francae
  French: 'Français',
  Portuguese: 'Português',
  Spanish: 'Español',
};

/**
 * A display name -> how its own speakers write it, plus the English name to
 * keep alongside it. `endonym` is null when the two are identical, which lets
 * callers skip the redundant "Hausa (Hausa)".
 */
export function getLanguageEndonym(language) {
  const name = normalizeLanguage(language);
  if (!name) return null;
  const endonym = LANGUAGE_ENDONYMS[name] || null;
  return { name, endonym, label: endonym || name };
}
