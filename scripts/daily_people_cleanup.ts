import fs from 'fs';
import path from 'path';
import { supabase } from './lib/db';
import { NOLLYWOOD_ALIASES } from './lib/nollywood_aliases';

// Protected names that must never be treated as garbage or stripped
const PROTECTED_NAMES = new Set([
  'sound sultan', 'officer woos', 'mr macaroni', 'debo adedayo', 'adebowale debo adedayo mr macaroni',
  'bimbo ademoye', 'femi adebayo', 'odunlade adekola', 'mercy aigbe', 'toyin abraham',
  'funke akindele', 'yemi elesho', 'yemi elesho booda nuru', 'chinedu ozuruigbo aba marley',
  'olaide ayodele abraham cross', 'oyebade adebimpe adedimeji ayanfe'
]);

// Non-person noise, LLM refusals, headers, role placeholders, and corporate/vendor entities to PURGE
const GARBAGE_NAME_EXACT = new Set([
  'family member', 'family members', 'olori ebi', 'elegbon adugbo', 'omo ita',
  'police officer', 'police student', 'police officers', 'police ipo',
  'security guard', 'security', 'warder', 'armed robber', 'robber',
  'doctor', 'nurse', 'female doctor', 'witch doctor', 'native doctor', 'babalawo', 'herbalist',
  'driver', 'bus driver', 'ober driver', 'uber driver', 'okada rider', 'gate man', 'gateman',
  'landlord', 'tenant', 'villager', 'villagers', 'elder', 'elders',
  'customer', 'customers', 'waiter', 'waitress', 'guest', 'guests', 'student', 'students',
  'dancer', 'dancers', 'crowd', 'extra', 'extras', 'heaven extras', 'ward extras',
  'cast', 'crew', 'sound man', 'camera man', 'props', 'prop set', 'props set', 'set props', 'costumier',
  'receptionist', 'decedtionist', 'pastor', 'priest',
  'voice over', 'narrator', 'delivery man', 'delivery boy', 'spark', 'best boy',
  'asst. editor', 'asst. costumier', 'sound engr', 'film credits', 'season 2',
  'movie mac tv', 'movie mac', 'chukwudubem tv', '---', '...', 'this is a must',
  'de gifted mind', 'ijele props/set', 'ats glamourstudio', 'starboard entertainment',
  'rest of cast listed alphabetically', 'there are no visible cast members in the provided text',
  'crew supervising producer written', 'cast marector ueno mra', '‘colorist/sound score',
  'exec producer showing now', 'the 11th commandment', 'jagun jagun: the warrior',
  'jenny & jessy pharmacy', 'toyin abraham film academy', 'academy award',
  'ben o ben films', 'snowberry films', 'heritage studio', 'the7eventh studio',
  'parables film productions', 'film avenue production', 'scenic studios',
  'etinosa digital film studios', 'remedy studio', 'h.d.r studio', 'a3 media studio',
  'kinos sound & visual studios', "b'nit production", 'topcrown studio omole lagos',
  'ubani concept', 'harmony studios', 'tayo faniran studios', 'canaan concept enugu',
  'trove empire', 'parables productions', '13 films', 'diamond concept',
  'toni concept', 'capitalfamefilms / chinaza',
  'brother sam', 'baggy land agency', 'nwiii fgii tkenna', 'kdzeem snonerdn',
  'omo elemosho', 'ejime alakara', 'ogboluke iteledicon',
  'yankid media pro', 'joyvisual', 'board members', 'board member', 'ity guests', 'city guests',
  'ghost', 'big fish'
]);

const KNOWN_NAME_TYPOS: Record<string, string> = {
  'adunlade adekola': 'Odunlade Adekola',
  'ofunlade adekola': 'Odunlade Adekola',
  'akeek adeyemi': 'Akeem Adeyemi',
  'monsuru ljayegbemi': 'Monsuru Ijayegbemi',
  'isiaq sanusi': 'Sanusi Izihaq',
  'fmeka fzeugwu': 'Emeka Ezeugwu',
};

const GARBAGE_PATTERNS = [
  /^(?:There are no visible|Rest of cast|Film Credits|Season \d+|Part \d+|Episode \d+)/i,
  /^(?:We Would For You To Stay|Till Death|Voice Over Artstists|Bts Still Photos|Second Unit Camraman)/i,
  /^(?:Police Student|Ast Gaffer|Asst Makeup Artist|Data Wrangler|Executive Producers|Grandish Global)/i,
  /^(?:Nollywoodmovies|Nigerianmovies|Host Of Others|And Many More|And Unexpected|And Intense|And Strong|Hidden Battles)/i,
  /^(?:Props?\s*Sets?|Set\s*Props?|Prop\s*Set|Camera\s*Asst|Focus\s*Puller|Full\s*Movie|Watch\s*Part|Subscribe|Board\s*Members?|Ity\s*Guests?|City\s*Guests?|Big\s*Fish)/i,
  /^(?:Edited\s*By|Directed\s*By|Produced\s*By|Executive\s*Produced\s*By|Written\s*By|Screenplay|Director|Producer|Editor|Cinematographer|Costumier|Costume\s*Designer|Sound\s*Designer|Still\s*Photographer|Camera\s*Operator|Gaffer|Best\s*Boy|Key\s*Grip|Production\s*Manager|Continuity|Script\s*Supervisor)$/i,
  /^(?:Street\s*Boys?|Village\s*Boys?|Village\s*Girls?|Thugs?|Kidnappers?|Crowd|Villagers?|Extras?|Dancers?|Guests?|Customers?|Board\s*Members?|Ity\s*Guests?|City\s*Guests?)$/i,
  /^(?:Decedtionist|Tamitana Ovafaca)/i,
  /\b(?:agency|ventures|enterprises|properties|limited|ltd|holdings|services|company|consult|logistics|foundation|studio|studios|production|productions|entertainment|props?|costumes|glamour|media\s*mind|media\s*pro|props\/set|visuals?)\b/i,
  /^[a-zA-Z]+visuals?$/i,
  /^[^a-zA-Z\s]+$/,
  /^\s*[-:–\.,\/\\_]+\s*$/,
];

// YouTube channels and distributor watermark tags to strip
const CHANNEL_WATERMARK_SUFFIXES = /\s+[-:–]?\s*(?:Apatatv|Apata\s*TV|Yorubahood|Sceneone(?:\s*TV)?|iBakaTV|Ibakatv|NollywoodPicturestv|Realnolly(?:\s*TV)?|Uche\s*Nancy\s*TV|Ruth\s*Kadiri(?:\s*247)?|PressPlay(?:\s*TV)?|Filmonly|Chukwudubem\s*TV|Movie\s*Mac\s*Tv|YT|YouTube|TV|Television|Channel)$/i;
const CHANNEL_WATERMARK_PREFIXES = /^(?:Apatatv|Apata\s*TV|Yorubahood|Sceneone(?:\s*TV)?|iBakaTV|Ibakatv|NollywoodPicturestv|Realnolly(?:\s*TV)?|Uche\s*Nancy\s*TV|Ruth\s*Kadiri(?:\s*247)?|PressPlay(?:\s*TV)?|Filmonly|Chukwudubem\s*TV|Movie\s*Mac\s*Tv)\s*[-:–]?\s+/i;

// Glued role prefixes & suffixes to strip
const ROLE_PREFIXES = /^(?:Receptionist|Decedtionist|Stillphotographer|Still\s+Photographer|Bestboy|Best\s+Boy|Second\s+Unit(?:\s+Cameraman)?|Delivery\s+Man|Warder|Officer|Police(?:\s+Officer)?|Big\s+Lion|Armed\s+Robber|Dit|Subtitle|Costumier(?:\s+Assist\.?)?|Costume\s+Assts?|Costumer|Makeup(?:\s+Asst)?|Special\s+Effects|Cam\s+Tech|Props?\s+Sets?|Welfare|Security|Sound(?:\s*man|\s+Recordist|\s+Operator|\s+Engr)?|Production\s+Driver|Head\s+Of\s+Lights|Focus\s+Puller|Script(?:\s*supervisor)?|Ass\s+Rf\s+Gaffer|Gaffer|Screenplay|Director|Editor|Producer|Artsist|Artist|Actor|Actress|Cast|Crew|Tattoo\s+Guy|Mama\s+Blessing|Board\s+Members?|City\s+Guests?|Ity\s+Guests?)\s*[-:–]?\s+/i;
const ROLE_SUFFIXES = /\s+[-:–]?\s*(?:Scriptwriter|Script\s+Supervisor|Delivery\s+Man|Police\s+Officer|Stoneboy|Receptionist|Makeup|Set\s+Designer|Video\s+Bts|Spark|Costumier|Prop|Location|Continuity|Sound|Lights|Focus\s+Puller|Cam\s+Asst|Passenger|Gaffer)$/i;

function cleanBoundaryPunctuation(str: string): string {
  let s = str.trim();
  s = s.replace(/^[“"'‘’`\s\-:–\.,]+|[“"'‘’`\s\-:–\.,]+$/g, '').trim();
  if (s.startsWith('(') && !s.includes(')')) s = s.slice(1).trim();
  if (s.endsWith(')') && !s.includes('(')) s = s.slice(0, -1).trim();
  if (s.startsWith('(') && s.endsWith(')')) {
    const inside = s.slice(1, -1).trim();
    if (!inside.includes('(') && !inside.includes(')')) s = inside;
  }
  return s.replace(/^[“"'‘’`\s\-:–\.,]+|[“"'‘’`\s\-:–\.,]+$/g, '').trim();
}

function normalize(name: string): string {
  return (name || '').toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim();
}

function cleanNameString(raw: string): { clean: string; detectedRole: string | null; strippedWatermark: boolean } {
  let name = cleanBoundaryPunctuation(raw);
  const norm = normalize(name);
  if (PROTECTED_NAMES.has(norm)) {
    return { clean: name, detectedRole: null, strippedWatermark: false };
  }

  let detectedRole: string | null = null;
  let strippedWatermark = false;

  if (CHANNEL_WATERMARK_SUFFIXES.test(name)) {
    name = name.replace(CHANNEL_WATERMARK_SUFFIXES, '').trim();
    strippedWatermark = true;
  }
  if (CHANNEL_WATERMARK_PREFIXES.test(name)) {
    name = name.replace(CHANNEL_WATERMARK_PREFIXES, '').trim();
    strippedWatermark = true;
  }

  name = cleanBoundaryPunctuation(name);

  const preMatch = name.match(ROLE_PREFIXES);
  if (preMatch) {
    detectedRole = preMatch[0].replace(/[-:–\s]+$/, '').trim();
    name = name.replace(ROLE_PREFIXES, '').trim();
  }

  const sufMatch = name.match(ROLE_SUFFIXES);
  if (sufMatch) {
    detectedRole = detectedRole || sufMatch[0].replace(/^[-:–\s]+/, '').trim();
    name = name.replace(ROLE_SUFFIXES, '').trim();
  }

  name = cleanBoundaryPunctuation(name);

  // Title case only if a prefix/watermark/quote was stripped AND the resulting clean name is all UPPERCASE
  const wasStripped = strippedWatermark || detectedRole !== null || cleanBoundaryPunctuation(raw) !== raw;
  if (wasStripped && name === name.toUpperCase() && name.length > 3 && /[A-Z]/.test(name)) {
    name = name.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
  }

  return { clean: name, detectedRole, strippedWatermark };
}

function isGarbagePerson(name: string): boolean {
  const norm = normalize(name);
  if (PROTECTED_NAMES.has(norm)) return false;
  if (GARBAGE_NAME_EXACT.has(norm) || GARBAGE_NAME_EXACT.has(name.toLowerCase().trim())) return true;
  if (name.trim().length < 2) return true;
  return GARBAGE_PATTERNS.some(rx => rx.test(name));
}

const prevRow = new Int32Array(256);
const currRow = new Int32Array(256);

function fastLevenshtein(s1: string, s2: string): number {
  const l1 = s1.length;
  const l2 = s2.length;
  if (s1 === s2) return 0;
  if (l1 === 0) return l2;
  if (l2 === 0) return l1;
  if (l2 >= 255) return levenshteinSimilarity(s1, s2); // fallback if extremely long string

  for (let j = 0; j <= l2; j++) prevRow[j] = j;
  for (let i = 1; i <= l1; i++) {
    currRow[0] = i;
    const c1 = s1.charCodeAt(i - 1);
    for (let j = 1; j <= l2; j++) {
      const cost = c1 === s2.charCodeAt(j - 1) ? 0 : 1;
      currRow[j] = Math.min(prevRow[j] + 1, currRow[j - 1] + 1, prevRow[j - 1] + cost);
    }
    for (let j = 0; j <= l2; j++) prevRow[j] = currRow[j];
  }
  return prevRow[l2];
}

function fastLevenshteinSimilarity(a: string, b: string): number {
  const an = a.length;
  const bn = b.length;
  if (an === 0) return bn === 0 ? 1 : 0;
  if (bn === 0) return 0;
  const maxLen = Math.max(an, bn);
  const dist = fastLevenshtein(a, b);
  return 1 - dist / maxLen;
}

function levenshteinSimilarity(a: string, b: string): number {
  const an = a.length;
  const bn = b.length;
  if (an === 0) return bn === 0 ? 1 : 0;
  if (bn === 0) return 0;
  const d: number[][] = [];
  for (let i = 0; i <= an; i++) d[i] = [i];
  for (let j = 0; j <= bn; j++) d[0][j] = j;

  for (let i = 1; i <= an; i++) {
    for (let j = 1; j <= bn; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
    }
  }
  return 1 - d[an][bn] / Math.max(an, bn);
}

function isDuplicateOnSameFilm(nameA: string, nameB: string): boolean {
  const normA = normalize(nameA);
  const normB = normalize(nameB);
  if (!normA || !normB) return false;
  if (normA === normB) return true;

  const lev = fastLevenshteinSimilarity(normA, normB);
  if (lev >= 0.88) return true;

  const wordsA = normA.split(/\s+/).filter(w => w.length >= 3);
  const wordsB = normB.split(/\s+/).filter(w => w.length >= 3);
  if (wordsA.length === 0 || wordsB.length === 0) return false;

  // Single word fragment match against multi-word name (e.g. "Adolphus" on same film as "Urenna Juliet Adolphus")
  if ((wordsA.length === 1 && wordsB.length >= 2) || (wordsB.length === 1 && wordsA.length >= 2)) {
    const single = wordsA.length === 1 ? wordsA[0] : wordsB[0];
    const multi = wordsA.length === 1 ? wordsB : wordsA;
    if (single.length >= 6 && multi.includes(single)) {
      return true;
    }
  }

  let matchingTokens = 0;
  for (const wa of wordsA) {
    if (wordsB.some(wb => wb === wa || (wa.length >= 5 && wb.length >= 5 && fastLevenshteinSimilarity(wa, wb) >= 0.80) || (wa.length >= 4 && wb.length >= 6 && (wb.startsWith(wa) || wa.startsWith(wb))))) {
      matchingTokens++;
    }
  }

  // Require AT LEAST 2 matching tokens (never match on 1 token alone)
  if (matchingTokens >= 2) {
    const minTokens = Math.min(wordsA.length, wordsB.length);
    if (matchingTokens >= minTokens || matchingTokens / minTokens >= 0.65) {
      return true;
    }
  }

  return false;
}

async function mergePersonCredits(sourceId: string, targetId: string, charName?: string | null, role?: string | null) {
  const { data: sCreds, error: sErr } = await supabase.from('credits').select('id, film_id, character_name, role').eq('person_id', sourceId);
  if (sErr || !sCreds || sCreds.length === 0) {
    await supabase.from('people').delete().eq('id', sourceId);
    return;
  }

  const filmIds = sCreds.map(c => c.film_id).filter(Boolean);
  const { data: tCreds } = await supabase
    .from('credits')
    .select('id, film_id, character_name')
    .eq('person_id', targetId)
    .in('film_id', filmIds);

  const targetFilmMap = new Map<string, any>();
  for (const tc of tCreds || []) {
    targetFilmMap.set(tc.film_id, tc);
  }

  for (const sc of sCreds) {
    const existingTargetCredit = targetFilmMap.get(sc.film_id);
    if (existingTargetCredit) {
      if ((charName || sc.character_name) && !existingTargetCredit.character_name) {
        await supabase.from('credits').update({ character_name: charName || sc.character_name }).eq('id', existingTargetCredit.id);
      }
      await supabase.from('credits').delete().eq('id', sc.id);
    } else {
      const up: any = { person_id: targetId };
      if (charName) up.character_name = charName;
      if (role && sc.role === 'actor' && role !== 'actor') up.role = role;
      await supabase.from('credits').update(up).eq('id', sc.id);
    }
  }

  const { error: delErr } = await supabase.from('people').delete().eq('id', sourceId);
  if (delErr) {
    console.warn(`   ⚠️ Warning deleting person ${sourceId}:`, delErr.message);
  }
}

export async function runDailyPeopleCleanup(options: { deep?: boolean } = {}) {
  const startedAt = new Date();
  const isDeep = Boolean(options.deep || process.argv.includes('--deep'));
  const logs: string[] = [];
  let aliasMergedCount = 0;
  let purgedCount = 0;
  let roleCleanedCount = 0;
  let coCreditMergedCount = 0;
  let fuzzyMergedCount = 0;

  const log = (msg: string) => {
    console.log(msg);
    logs.push(`[${new Date().toISOString()}] ${msg}`);
  };

  log(`🚀 Starting People Consensus & Deduplication Pipeline (Mode: ${isDeep ? '🔥 DEEP FULL-DB SCAN' : '⚡ DAILY'})…`);

  try {
    const maxPasses = isDeep ? 3 : 1;
    let pass = 1;

    while (pass <= maxPasses) {
      if (maxPasses > 1) {
        log(`\n=================== PASS ${pass} of ${maxPasses} ===================`);
      }
      let passMergesBefore = aliasMergedCount + coCreditMergedCount + fuzzyMergedCount + purgedCount + roleCleanedCount;

      // -------------------------------------------------------------
      // FULL DIRECTORY KEYSET SCAN
      // -------------------------------------------------------------
      log('--- Scanning Directory (Keyset Pagination) ---');
      let lastId: string | null = null;
      const allPeople: { id: string; name: string; film_count?: number; photo_url?: string }[] = [];

      while (true) {
        let query = supabase.from('people').select('id, name, film_count, photo_url').order('id', { ascending: true }).limit(1000);
        if (lastId) query = query.gt('id', lastId);
        const { data, error } = await query;
        if (error || !data || data.length === 0) break;
        allPeople.push(...data);
        lastId = data[data.length - 1].id;
        if (data.length < 1000) break;
      }
      log(`📊 Loaded ${allPeople.length} people records in directory.`);

      // -------------------------------------------------------------
      // PHASE 1: ALIAS & KNOWN TYPO RESOLUTION (Erekere, Adunlade, Itele, Apa, Lalude, etc.)
      // -------------------------------------------------------------
      log('--- Phase 1: Resolving Known Aliases & OCR Star Typos ---');
      const processedIds = new Set<string>();

      for (const ap of allPeople) {
        if (processedIds.has(ap.id)) continue;
        const rawNorm = ap.name.trim().toLowerCase();
        const canonicalTarget = NOLLYWOOD_ALIASES[rawNorm] || KNOWN_NAME_TYPOS[rawNorm];

        if (canonicalTarget) {
          const canonical = allPeople
            .filter(p => p.id !== ap.id && p.name.trim().toLowerCase() === canonicalTarget.toLowerCase())
            .sort((a, b) => ((b.photo_url ? 10 : 0) + (b.film_count || 0)) - ((a.photo_url ? 10 : 0) + (a.film_count || 0)))[0];

          let targetId = canonical?.id;
          if (!targetId) {
            const { data: dbCanonicals } = await supabase
              .from('people')
              .select('id, name, film_count')
              .ilike('name', canonicalTarget)
              .order('film_count', { ascending: false, nullsFirst: false })
              .limit(1);
            if (dbCanonicals && dbCanonicals.length > 0 && dbCanonicals[0].id !== ap.id) {
              targetId = dbCanonicals[0].id;
            }
          }

          if (targetId) {
            log(`🎭 Alias/Typo Match: Merging "${ap.name}" into canonical "${canonicalTarget}"...`);
            await mergePersonCredits(ap.id, targetId);
            processedIds.add(ap.id);
            aliasMergedCount++;
          }
        }
      }

      // -------------------------------------------------------------
      // PHASE 2: EXACT NAME DUPLICATE CONSOLIDATION & GARBAGE PURGE
      // -------------------------------------------------------------
      log('--- Phase 2: Consolidating Exact Name Duplicates & Purging Garbage ---');
      // 1. Group by exact normalized name to merge duplicates (e.g. 2 records for Patience Ozokwor)
      const exactNameMap = new Map<string, typeof allPeople>();
      for (const p of allPeople) {
        if (processedIds.has(p.id)) continue;
        const norm = normalize(p.name);
        if (!norm || norm.length < 3) continue;
        const list = exactNameMap.get(norm) || [];
        list.push(p);
        exactNameMap.set(norm, list);
      }

      for (const [normName, group] of exactNameMap.entries()) {
        if (group.length > 1) {
          // Sort best profile first
          group.sort((a, b) => ((b.photo_url ? 10 : 0) + (b.film_count || 0)) - ((a.photo_url ? 10 : 0) + (a.film_count || 0)));
          const primary = group[0];
          for (let i = 1; i < group.length; i++) {
            const dupe = group[i];
            log(`👥 Consolidating duplicate profile: "${dupe.name}" (${dupe.film_count || 0} films) -> "${primary.name}" (${primary.film_count || 0} films)`);
            await mergePersonCredits(dupe.id, primary.id);
            processedIds.add(dupe.id);
            aliasMergedCount++;
          }
        }
      }

      // 2. Identify garbage & role strings to strip
      const garbageIds: string[] = [];
      const renames: { id: string; oldName: string; clean: string; detectedRole: string | null }[] = [];

      for (const p of allPeople) {
        if (processedIds.has(p.id)) continue;
        const norm = normalize(p.name);
        if (PROTECTED_NAMES.has(norm)) continue;

        const { clean, detectedRole } = cleanNameString(p.name);
        if (isGarbagePerson(clean)) {
          garbageIds.push(p.id);
        } else if (clean !== p.name && clean.split(' ').length >= 2) {
          renames.push({ id: p.id, oldName: p.name, clean, detectedRole });
        }
      }

      if (garbageIds.length > 0) {
        log(`🗑️ Inspecting ${garbageIds.length} candidate garbage records for inverted credits...`);
        for (let i = 0; i < garbageIds.length; i += 100) {
          const chunk = garbageIds.slice(i, i + 100);
          const { data: gCreds } = await supabase
            .from('credits')
            .select('id, person_id, film_id, role, character_name')
            .in('person_id', chunk);

          for (const gc of gCreds || []) {
            if (gc.character_name && gc.character_name.trim().length >= 3) {
              const charClean = cleanNameString(gc.character_name).clean;
              const charWords = charClean.split(' ');
              if (charWords.length >= 2 && charWords.length <= 4 && !isGarbagePerson(charClean) && /^[A-Z]/.test(charClean)) {
                log(`🔄 Recovering inverted credit on film ${gc.film_id}: character "${charClean}" -> assigning to real person profile...`);
                let { data: targetPerson } = await supabase.from('people').select('id, name').ilike('name', charClean).limit(1).maybeSingle();
                if (!targetPerson) {
                  const slug = charClean.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
                  const { data: newP } = await supabase.from('people').insert({ name: charClean, slug }).select('id, name').single();
                  if (newP) targetPerson = newP;
                }
                if (targetPerson) {
                  await supabase.from('credits').update({
                    person_id: targetPerson.id,
                    character_name: null,
                  }).eq('id', gc.id);
                  log(`   Assigned credit to "${targetPerson.name}" (${targetPerson.id})`);
                }
              }
            }
          }
        }

        log(`🗑️ Purging ${garbageIds.length} non-person garbage records & remaining phantom credits...`);
        for (let i = 0; i < garbageIds.length; i += 100) {
          const chunk = garbageIds.slice(i, i + 100);
          await supabase.from('credits').delete().in('person_id', chunk);
          await supabase.from('people').delete().in('id', chunk);
        }
        purgedCount += garbageIds.length;
      }

      for (const r of renames) {
        const { data: existing } = await supabase.from('people').select('id, name').ilike('name', r.clean).limit(1);
        if (existing && existing.length > 0 && existing[0].id !== r.id) {
          log(`✂️ Merging "${r.oldName}" into existing canonical "${existing[0].name}"`);
          await mergePersonCredits(r.id, existing[0].id, r.detectedRole);
          roleCleanedCount++;
        } else {
          log(`✂️ Cleaning "${r.oldName}" -> "${r.clean}"`);
          await supabase.from('people').update({ name: r.clean }).eq('id', r.id);
          if (r.detectedRole) {
            await supabase.from('credits').update({ character_name: r.detectedRole }).eq('person_id', r.id);
          }
          roleCleanedCount++;
        }
      }

      // -------------------------------------------------------------
      // PHASE 3: FILM CO-CREDIT RECONCILIATION (PHANTOM CHARACTERS & SAME-FILM DUPES)
      // -------------------------------------------------------------
      log(`--- Phase 3: Film-Level Co-Credit & OCR Duplication Reconciliation (${isDeep ? 'Deep: 500 films' : 'Standard: 100 films'}) ---`);
      const filmLimit = isDeep ? 500 : 100;
      const { data: recentFilms } = await supabase
        .from('films')
        .select('id, title')
        .order('updated_at', { ascending: false })
        .limit(filmLimit);

      const filmIds = recentFilms?.map(f => f.id) || [];
      const creditsByFilm = new Map<string, any[]>();
      
      for (let i = 0; i < filmIds.length; i += 100) {
        const batchFilmIds = filmIds.slice(i, i + 100);
        const { data: batchCredits } = await supabase
          .from('credits')
          .select('id, film_id, person_id, role, character_name, people(id, name, photo_url, film_count)')
          .in('film_id', batchFilmIds);

        for (const c of batchCredits || []) {
          const list = creditsByFilm.get(c.film_id) || [];
          list.push(c);
          creditsByFilm.set(c.film_id, list);
        }
      }

      for (const f of recentFilms || []) {
        const fCreds = creditsByFilm.get(f.id) || [];
        if (fCreds.length === 0) continue;

        // 0. Remove multiple identical credits for the exact same person on the same film
        const seenPersonRole = new Set<string>();
        for (const c of fCreds) {
          const key = `${c.person_id}:${c.role}`;
          if (seenPersonRole.has(key)) {
            log(`🧹 Deduplicating duplicate credit for "${(c.people as any)?.name || c.person_id}" on "${f.title}"`);
            await supabase.from('credits').delete().eq('id', c.id);
          } else {
            seenPersonRole.add(key);
          }
        }

        // 1. Detect phantom persons whose names match an actor's character name on the same film
        const actorChars = new Map<string, string>();
        for (const c of fCreds) {
          if (c.role === 'actor' && c.character_name) {
            actorChars.set(c.character_name.toLowerCase().trim(), (c.people as any)?.name);
          }
        }

        for (const c of fCreds) {
          const p = c.people as any;
          if (!p?.name) continue;
          if (actorChars.has(p.name.toLowerCase().trim())) {
            const realActor = actorChars.get(p.name.toLowerCase().trim());
            log(`🎬 Phantom Credit on "${f.title}": "${p.name}" matches character of "${realActor}". Removing credit...`);
            await supabase.from('credits').delete().eq('id', c.id);
            const { count } = await supabase.from('credits').select('*', { count: 'exact', head: true }).eq('person_id', p.id);
            if ((count || 0) === 0) {
              log(`   Purging orphaned phantom person "${p.name}"`);
              await supabase.from('people').delete().eq('id', p.id);
              purgedCount++;
            }
          }
        }

        // 2. Detect same-film duplicates / OCR corruptions across ALL roles
        const roleGroups = new Map<string, typeof fCreds>();
        for (const c of fCreds) {
          const r = c.role || 'crew';
          if (!roleGroups.has(r)) roleGroups.set(r, []);
          roleGroups.get(r)!.push(c);
        }

        for (const [rName, credList] of roleGroups.entries()) {
          for (let i = 0; i < credList.length; i++) {
            const c1 = credList[i];
            const p1 = c1.people as any;
            if (!p1?.name) continue;

            for (let j = i + 1; j < credList.length; j++) {
              const c2 = credList[j];
              const p2 = c2.people as any;
              if (!p2?.name || p1.id === p2.id) continue;

              if (isDuplicateOnSameFilm(p1.name, p2.name)) {
                const p1Score = (p1.photo_url ? 10 : 0) + (p1.film_count || 1);
                const p2Score = (p2.photo_url ? 10 : 0) + (p2.film_count || 1);
                const canonical = p1Score >= p2Score ? p1 : p2;
                const duplicate = canonical.id === p1.id ? p2 : p1;

                log(`🤝 Same-Film Duplicate on "${f.title}" (${rName}): Merging "${duplicate.name}" -> "${canonical.name}"`);
                await mergePersonCredits(duplicate.id, canonical.id);
                coCreditMergedCount++;
              }
            }
          }
        }
      }

      // -------------------------------------------------------------
      // PHASE 4: FULL-DIRECTORY TOKEN-INDEXED FUZZY DEDUPLICATION (ALL PEOPLE)
      // -------------------------------------------------------------
      log(`--- Phase 4: Token-Indexed 90%–100% Fuzzy Deduplication across ALL ${allPeople.length} People ---`);
      const peopleMap = new Map(allPeople.map(p => [p.id, p]));
      const tokenBuckets = new Map<string, typeof allPeople>();

      // Index all people by distinctive tokens and bi-token prefixes
      for (const p of allPeople) {
        if (processedIds.has(p.id)) continue;
        const norm = normalize(p.name);
        if (!norm || norm.length < 4) continue;
        const words = norm.split(' ').filter(w => w.length >= 3);
        if (words.length < 2) continue; // Skip single names to prevent dangerous false positive merges

        for (const w of words) {
          if (w.length >= 4) {
            const prefix = w.slice(0, 4);
            if (!tokenBuckets.has(prefix)) tokenBuckets.set(prefix, []);
            tokenBuckets.get(prefix)!.push(p);
          }
        }

        // Bi-token key: first 3 letters of first word + first 3 letters of second word (e.g. "odunlade adekola" -> "odu:ade")
        if (words.length >= 2 && words[0].length >= 3 && words[1].length >= 3) {
          const biKey = `${words[0].slice(0, 3)}:${words[1].slice(0, 3)}`;
          if (!tokenBuckets.has(biKey)) tokenBuckets.set(biKey, []);
          tokenBuckets.get(biKey)!.push(p);
        }
      }

      // Collect candidate pairs to check
      const candidatePairs = new Set<string>();
      for (const [key, bucket] of tokenBuckets.entries()) {
        // Skip excessively large generic buckets (e.g. generic noise with > 250 records)
        if (bucket.length > 250) continue;
        for (let i = 0; i < bucket.length; i++) {
          for (let j = i + 1; j < bucket.length; j++) {
            const idA = bucket[i].id;
            const idB = bucket[j].id;
            if (idA !== idB && !processedIds.has(idA) && !processedIds.has(idB)) {
              candidatePairs.add(idA < idB ? `${idA}:${idB}` : `${idB}:${idA}`);
            }
          }
        }
      }

      log(`   🔍 Evaluating ${candidatePairs.size} candidate pairs for 90%+ similarity...`);
      const mergedInFuzzy = new Set<string>();

      for (const pair of candidatePairs) {
        const [idA, idB] = pair.split(':');
        if (mergedInFuzzy.has(idA) || mergedInFuzzy.has(idB)) continue;

        const p1 = peopleMap.get(idA);
        const p2 = peopleMap.get(idB);
        if (!p1 || !p2) continue;

        const norm1 = normalize(p1.name);
        const norm2 = normalize(p2.name);
        if (norm1.length < 4 || norm2.length < 4) continue;

        // Length difference filter: 90% similarity requires lengths to be very close
        const lenDiff = Math.abs(norm1.length - norm2.length);
        const isSubstring = (norm1.includes(norm2) || norm2.includes(norm1)) && lenDiff <= 10;
        if (!isSubstring && lenDiff > 3) continue;

        // Fast character precheck: first or second character must match
        if (!isSubstring && norm1[0] !== norm2[0] && norm1[1] !== norm2[1]) continue;

        const sim = fastLevenshteinSimilarity(norm1, norm2);

        if (sim >= 0.90 || (isSubstring && sim >= 0.85)) {
          const p1Score = (p1.photo_url ? 10 : 0) + (p1.film_count || 1);
          const p2Score = (p2.photo_url ? 10 : 0) + (p2.film_count || 1);
          const canonical = p1Score >= p2Score ? p1 : p2;
          const duplicate = canonical.id === p1.id ? p2 : p1;

          log(`🔄 Merging 90%+ match: "${duplicate.name}" -> "${canonical.name}" (${(sim * 100).toFixed(1)}%)`);
          await mergePersonCredits(duplicate.id, canonical.id);
          mergedInFuzzy.add(duplicate.id);
          processedIds.add(duplicate.id);
          fuzzyMergedCount++;
        }
      }

      const passMergesAfter = aliasMergedCount + coCreditMergedCount + fuzzyMergedCount + purgedCount + roleCleanedCount;
      const passTotal = passMergesAfter - passMergesBefore;
      log(`📊 Pass ${pass} finished with ${passTotal} total action(s).`);

      // If no new actions were taken or single-pass mode, terminate loop
      if (passTotal === 0 || !isDeep) break;
      pass++;
    }

    // -------------------------------------------------------------
    // PHASE 5: PERSIST AUDIT LOGS
    // -------------------------------------------------------------
    const completedAt = new Date();
    const totalMerged = aliasMergedCount + coCreditMergedCount + fuzzyMergedCount;
    const summary = `Aliases Merged: ${aliasMergedCount}, Purged: ${purgedCount}, Roles/Watermarks Cleaned: ${roleCleanedCount}, Same-Film Merged: ${coCreditMergedCount}, Fuzzy Merged: ${fuzzyMergedCount}`;
    log(`✅ Daily Cleanup Completed in ${((completedAt.getTime() - startedAt.getTime()) / 1000).toFixed(1)}s.`);
    log(`📊 ${summary}`);

    try {
      await supabase.from('cron_logs').insert({
        job_name: 'daily_people_consensus_and_cleanup',
        status: 'success',
        started_at: startedAt.toISOString(),
        completed_at: completedAt.toISOString(),
        purged_count: purgedCount,
        merged_count: totalMerged,
        cleaned_count: roleCleanedCount,
        details: { summary, logs: logs.slice(-30) },
      });
    } catch {
      // Ignored if table not created
    }

    const logDir = path.resolve('logs');
    if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
    fs.writeFileSync(path.join(logDir, `cleanup_${startedAt.toISOString().slice(0, 10)}.log`), logs.join('\n'));

    return { success: true, aliasMergedCount, purgedCount, roleCleanedCount, coCreditMergedCount, fuzzyMergedCount, summary };
  } catch (err: any) {
    console.error('❌ Cleanup Failed:', err.message);
    throw err;
  }
}

if (process.argv[1]?.includes('daily_people_cleanup')) {
  runDailyPeopleCleanup().catch(console.error);
}
