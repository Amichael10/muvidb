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
