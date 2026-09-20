/**
 * Canonical Nollywood Mononyms, Stage Names, and Nicknames
 */
export const NOLLYWOOD_ALIASES: Record<string, string> = {
  // Common mononyms / aliases
  'itele': 'Ibrahim Yekini',
  'itele d icon': 'Ibrahim Yekini',
  'apa': 'Sanusi Izihaq',
  'sanusi isiaka': 'Sanusi Izihaq',
  'lalude': 'Fatai Odua',
  'fatai odua lalude': 'Fatai Odua',
  'kiekie': 'Bukunmi Adeaga-Ilori',
  'kie kie': 'Bukunmi Adeaga-Ilori',
  'kemity': 'Kemi Apesin Ariyo',
  'kemi apesin': 'Kemi Apesin Ariyo',

  // Common Nollywood comedy & industry icons
  'mr latin': 'Bolaji Amusan',
  'latin': 'Bolaji Amusan',
  'sanyeri': 'Olaniyi Afonja',
  'golugo': 'Fatai Adekunle Adetayo',
  'okele': 'Tunde Usman',
  'ijebu': 'Olatayo Amokade',
  'alapini': 'Fatai Olayiwola',
  'alapini oosa': 'Fatai Olayiwola',
  'dagunro': 'Fasasi Olabanke',
  'koledowo': 'Gbolagade Akinpelu',
  'madam saje': 'Fausat Balogun',
  'iya rainbow': 'Idowu Philips',
  'baba suwe': 'Babatunde Omidina',
  'dejo tunfulu': 'Kunle Adetokunbo',
  'saka': 'Afeez Oyetoro',
  'broda shaggi': 'Samuel Animashaun Perry',
  'shaggi': 'Samuel Animashaun Perry',
  'sabinus': 'Emmanuel Chukwuemeka Ejekwu',
  'mr funny': 'Emmanuel Chukwuemeka Ejekwu',
  'taaooma': 'Maryam Apaokagi',
  'lasisi elenu': 'Nosa Afolabi',
  'mr macaroni': 'Debo Adedayo',
  'macaroni': 'Debo Adedayo',
  'brain jotter': 'Chukwuebuka Emmanuel Amuzie',
  'eleniyan': 'Akinola Akano',
};

export function resolveKnownAlias(rawName: string): string | null {
  if (!rawName) return null;
  const clean = rawName.trim().toLowerCase().replace(/['"’]/g, '');
  return NOLLYWOOD_ALIASES[clean] || null;
}
