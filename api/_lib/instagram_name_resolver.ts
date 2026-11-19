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
  chidi_mokeme: 'Chidi Mokeme',
  uzor_arukwe: 'Uzor Arukwe',
  uzorarukwe: 'Uzor Arukwe',
  'uzor.arukwe': 'Uzor Arukwe',
  kelechiudegbe: 'Kelechi Udegbe',
  uchemontana: 'Uche Montana',
  bolanleaustenpeters: 'Bolanle Austen-Peters',
  bbssashore: 'Bolanle Austen-Peters',
  bap_productions: 'Bolanle Austen-Peters Productions',
  tope_alake: 'Tope Alake',
  topeolowoniyan: 'Tope Olowoniyan',
  sharonooja: 'Sharon Ooja',
  jemimaosunde: 'Jemima Osunde',
  bisolaaiyeola: 'Bisola Aiyeola',
  gabrielafolayan: 'Gabriel Afolayan',
  somkele_i: 'Somkele Iyamah-Idhalama',
  beverlynaya: 'Beverly Naya',
  beverly_osu: 'Beverly Osu',
  enioluwaofficial: 'Enioluwa Adeoluwa',
  officialchineduikedieze: 'Chinedu Ikedieze',
  ositaiheme: 'Osita Iheme',
  macaronii: 'Debo Adedayo (Mr Macaroni)',
  mrmacaronii: 'Debo Adedayo (Mr Macaroni)',
  taaooma: 'Maryam Apaokagi (Taaooma)',
  layiwasabi: 'Isaac Olayiwola (Layi Wasabi)',
  nasboi: 'Nasir Lawal (Nasboi)',
  judithaudu: 'Judith Audu',
  gennyuzoma: 'Genny Uzoma',
  maurice_sam: 'Maurice Sam',
  rayemodi: 'Ray Emodi',
  terrakulture: 'Terra Kulture',
  musoncentre: 'MUSON Centre',
  filmoneng: 'FilmOne',
  silverbirdfilm: 'Silverbird',
  inkblotwp: 'Inkblot Productions',
  anthillstudios_: 'Anthill Studios',
  greohstudios: 'Greoh Studios',
};

export interface ResolvedMentionDetail {
  handle: string;
  cleanHandle: string;
  resolvedName: string;
  personId?: string | null;
  slug?: string | null;
  photoUrl?: string | null;
  primaryRole?: string | null;
  matched: boolean;
}

/**
 * Parses all @mentions from a caption and resolves each into a real Nollywood talent name,
 * matching against the Supabase `people` table to retrieve their profile thumbnail and id.
 */
export async function resolveCaptionMentionsDetailed(caption: string): Promise<ResolvedMentionDetail[]> {
  if (!caption || typeof caption !== 'string') return [];
  const rawMatches = caption.match(/@[a-zA-Z0-9._]+/g);
  if (!rawMatches || !rawMatches.length) return [];

  // Deduplicate case-insensitively
  const seen = new Set<string>();
  const uniqueHandles: string[] = [];
  for (const match of rawMatches) {
    const clean = match.replace(/^@+/, '').replace(/\/+$/, '').trim();
    const lower = clean.toLowerCase();
    if (clean && !seen.has(lower) && clean.length > 1) {
      seen.add(lower);
      uniqueHandles.push(clean);
    }
  }

  const results: ResolvedMentionDetail[] = [];

  for (const cleanHandle of uniqueHandles) {
    const handleTag = `@${cleanHandle}`;
    const lower = cleanHandle.toLowerCase();

    let candidateName = KNOWN_NOLLYWOOD_HANDLES[lower] || null;

    if (!candidateName) {
      // Humanize handle into proper Title Case
      candidateName = cleanHandle
        .replace(/[._-]+/g, ' ')
        .replace(/([a-z])([A-Z])/g, '$1 $2')
        .split(' ')
        .filter(Boolean)
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
        .join(' ')
        .trim();
    }

    let personId: string | null = null;
    let slug: string | null = null;
    let photoUrl: string | null = null;
    let primaryRole: string | null = null;
    let matched = false;

    try {
      // 1. Try matching by instagram_url handle
      const { data: byInsta } = await supabase
        .from('people')
        .select('id, name, slug, photo_url, known_for_department')
        .or(`instagram_url.ilike.%/${cleanHandle},instagram_url.ilike.%/${cleanHandle}/%`)
        .limit(1)
        .maybeSingle();

      if (byInsta?.id) {
        personId = byInsta.id;
        candidateName = byInsta.name;
        slug = byInsta.slug;
        photoUrl = byInsta.photo_url;
        primaryRole = byInsta.known_for_department;
        matched = true;
      } else if (candidateName) {
        // 2. Try matching by person name
        const { data: byName } = await supabase
          .from('people')
          .select('id, name, slug, photo_url, known_for_department')
          .ilike('name', candidateName)
          .limit(1)
          .maybeSingle();

        if (byName?.id) {
          personId = byName.id;
          candidateName = byName.name;
          slug = byName.slug;
          photoUrl = byName.photo_url;
          primaryRole = byName.known_for_department;
          matched = true;
        }
      }
    } catch (e: any) {
      console.warn(`[instagram_name_resolver] DB lookup error for ${cleanHandle}:`, e?.message);
    }

    results.push({
      handle: handleTag,
      cleanHandle,
      resolvedName: candidateName || cleanHandle,
      personId,
      slug,
      photoUrl,
      primaryRole,
      matched,
    });
  }

  return results;
}

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
