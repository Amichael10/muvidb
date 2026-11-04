import { supabase } from './supabase.js';

/**
 * Common verified Nollywood actors and filmmakers with known Instagram handles.
 * Allows instant sub-millisecond local resolution without external API network overhead.
 */
export const KNOWN_NOLLYWOOD_HANDLES: Record<string, string> = {
  funkejenifaakindele: 'Funke Akindele',
  iniedo: 'Ini Edo',
  deyemitheactor: 'Deyemi Okanlawon',
  timini: 'Timini Egbuson',
  bimboademoye: 'Bimbo Ademoye',
  stan_nze: 'Stan Nze',
  stannze: 'Stan Nze',
  brodashaggi: 'Samuel Perry (Broda Shaggi)',
  kunleafo: 'Kunle Afolayan',
  kayodekasum: 'Kayode Kasum',
  realmercyaigbe: 'Mercy Aigbe',
  iyaboojofespris: 'Iyabo Ojo',
  toyin_abraham: 'Toyin Abraham',
  odunomoadekola: 'Odunlade Adekola',
  lateefadedimeji: 'Lateef Adedimeji',
  adedimejilateef: 'Lateef Adedimeji',
  femiadebayosalami: 'Femi Adebayo',
  omonioboli: 'Omoni Oboli',
  genevievengaji: 'Genevieve Nnaji',
  omosexy: 'Omotola Jalade-Ekeinde',
  shaffybello: 'Shaffy Bello',
  iamshaffybello: 'Shaffy Bello',
  solaallyson: 'Sola Allyson',
  tanaadelana: 'Tana Adelana',
  estherene: 'Esther Ene Audu',
  uchejombo: 'Uche Jombo',
  chinenyennebe: 'Chinenye Nnebe',
  uchenancy: 'Uche Nancy',
  ruthkadiri: 'Ruth Kadiri',
  blossomchukwujekwu: 'Blossom Chukwujekwu',
  etimeffiong: 'Daniel Etim Effiong',
  daniel_etim_effiong: 'Daniel Etim Effiong',
  nancyisimeofficial: 'Nancy Isime',
  ritadominic: 'Rita Dominic',
  dakoreea: 'Dakore Akande',
  moabudu: 'Mo Abudu',
  kemiadetiba: 'Kemi Adetiba',
  jadeosiberu: 'Jade Osiberu',
  ramseynouah: 'Ramsey Nouah',
  alexxekubo: 'Alexx Ekubo',
  stella_damasus: 'Stella Damasus',
  adesuaetomi: 'Adesua Etomi-Wellington',
  bankywellington: 'Banky W',
  falzthebahdguy: 'Folarin Falana (Falz)',
  tokemakinwa: 'Toke Makinwa',
  chiomakpotha: 'Chioma Chukwuka Akpotha',
  nkemowoh_osuofia: 'Nkem Owoh',
  zubbymichael: 'Zubby Michael',
  realwarripikin: 'Anita Asuoha (Real Warri Pikin)',
  sabinus: 'Emmanuel Ejekwu (Sabinus)',
  mrfunny1_: 'Emmanuel Ejekwu (Sabinus)',
  kie_kie__: 'Bukunmi Adeaga-Ilori (Kiekie)',
  kie_kie: 'Bukunmi Adeaga-Ilori (Kiekie)',
  iamnkechiblessing: 'Nkechi Blessing Sunday',
  destinyetikoofficial: 'Destiny Etiko',
  'regina.daniels': 'Regina Daniels',
  'kanayo.o.kanayo': 'Kanayo O. Kanayo',
  peteedochie: 'Pete Edochie',
};

/**
 * Resolves Instagram @ handles (e.g. @funkejenifaakindele or @deyemitheactor)
 * into real person names.
 *
 * Priority order:
 * 1. Pre-populated Nollywood star dictionary (0ms)
 * 2. Database lookup in `people` by instagram_url (fast indexing)
 * 3. Instagram Business Profile Discovery (via Meta Graph API if active)
 * 4. Humanized Title Case fallback (e.g. @timini_egbuson -> Timini Egbuson)
 */
export async function resolveHandlesToRealNames(names: string[] | string): Promise<string[]> {
  const list = (Array.isArray(names) ? names : [names]).filter(Boolean);
  if (!list.length) return [];
  const results: string[] = [];

  for (const rawName of list) {
    const trimmed = String(rawName || '').trim();
    if (!trimmed) continue;

    // If it's already a clean human name without '@', preserve it
    if (!trimmed.startsWith('@')) {
      results.push(trimmed);
      continue;
    }

    const cleanHandle = trimmed.replace(/^@+/, '').replace(/\/+$/, '').trim();
    if (!cleanHandle) continue;

    const lower = cleanHandle.toLowerCase();

    // 1. Instant check in verified Nollywood dictionary
    if (KNOWN_NOLLYWOOD_HANDLES[lower]) {
      results.push(KNOWN_NOLLYWOOD_HANDLES[lower]);
      continue;
    }

    // 2. Query people table in database
    try {
      const { data: matchedPerson } = await supabase
        .from('people')
        .select('name')
        .or(`instagram_url.ilike.%/${cleanHandle},instagram_url.ilike.%/${cleanHandle}/%`)
        .limit(1)
        .maybeSingle();

      if (matchedPerson?.name) {
        results.push(matchedPerson.name);
        continue;
      }
    } catch {}

    // 3. Instagram Business Profile Discovery (if configured)
    try {
      const { discoverInstagramProfile, nameLooksUsable } = await import('./instagram_person_lookup.js');
      const profile = await discoverInstagramProfile(cleanHandle);
      if (profile?.name && nameLooksUsable(profile.name)) {
        results.push(profile.name);
        continue;
      }
    } catch {}

    // 4. Fallback: Humanize handle into Title Case (e.g. "funke_akindele" -> "Funke Akindele")
    const humanized = cleanHandle
      .replace(/[._-]+/g, ' ')
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .split(' ')
      .filter(Boolean)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(' ')
      .trim();

    results.push(humanized.length > 2 ? humanized : trimmed);
  }

  return results;
}
