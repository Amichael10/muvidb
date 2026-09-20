import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { Agent, setGlobalDispatcher } from 'undici';
import { NOLLYWOOD_ALIASES } from './lib/nollywood_aliases';

setGlobalDispatcher(new Agent({
  connect: { timeout: 60000 },
  headersTimeout: 60000,
  bodyTimeout: 60000,
}));

dotenv.config({ path: '.env.local' });
dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: { persistSession: false },
    global: {
      fetch: (url, options) => fetch(url, { ...options, signal: AbortSignal.timeout(60000) }),
    },
  }
);

// Non-person garbage phrases and OCR hallucinations
const GARBAGE_PATTERNS = [
  /^(?:We Would For You To Stay|Till Death|Voice Over Artstists|Bts Still Photos|Second Unit Camraman)/i,
  /^(?:Police Student|Ast Gaffer|Asst Makeup Artist|Data Wrangler|Executive Producers|Grandish Global)/i,
  /^(?:Nollywoodmovies|Nigerianmovies|Host Of Others|And Many More|And Unexpected|And Intense|And Strong|Hidden Battles)/i,
  /^(?:Props Sets?|Set Props|Camera Asst|Focus Puller|Sound Man|Full Movie|Watch Part|Subscribe)/i,
  /^(?:Decedtionist|Tamitana Ovafaca)/i,
];

// Role prefixes & suffixes to strip
const ROLE_PREFIXES = /^(?:Receptionist|Decedtionist|Stillphotographer|Still\s+Photographer|Bestboy|Best\s+Boy|Second\s+Unit(?:\s+Cameraman)?|Delivery\s+Man|Warder|Officer|Police(?:\s+Officer)?|Big\s+Lion|Armed\s+Robber|Dit|Subtitle|Costumier|Costume\s+Assts?|Costumer|Makeup(?:\s+Asst)?|Special\s+Effects|Cam\s+Tech|Props?\s+Sets?|Welfare|Security|Sound(?:\s+Recordist)?|Head\s+Of\s+Lights|Focus\s+Puller|Script(?:\s*supervisor)?)\s*[-:–]?\s+/i;
const ROLE_SUFFIXES = /\s+[-:–]?\s*(?:Scriptwriter|Script\s+Supervisor|Delivery\s+Man|Police\s+Officer|Stoneboy|Receptionist|Makeup|Set\s+Designer|Video\s+Bts|Spark|Costumier|Prop|Location|Continuity|Sound|Lights|Focus\s+Puller|Cam\s+Asst)$/i;

function normalize(name: string): string {
  return (name || '').toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim();
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

export async function runDailyPeopleCleanup() {
  const startedAt = new Date();
  const logs: string[] = [];
  let aliasMergedCount = 0;
  let purgedCount = 0;
  let roleCleanedCount = 0;
  let fuzzyMergedCount = 0;

  const log = (msg: string) => {
    console.log(msg);
    logs.push(`[${new Date().toISOString()}] ${msg}`);
  };

  log('🚀 Starting Daily People Consensus & Deduplication Pipeline...');

  try {
    // -------------------------------------------------------------
    // PHASE 1: ALIAS & STAGE NAME RESOLUTION (Itele, Apa, Lalude, Kiekie, Kemity, etc.)
    // -------------------------------------------------------------
    log('--- Phase 1: Resolving Known Aliases & Stage Names ---');
    for (const [alias, canonicalName] of Object.entries(NOLLYWOOD_ALIASES)) {
      const { data: aliasPeople } = await supabase
        .from('people')
        .select('id, name')
        .ilike('name', alias);

      if (!aliasPeople || aliasPeople.length === 0) continue;

      const { data: canonicals } = await supabase
        .from('people')
        .select('id, name')
        .ilike('name', canonicalName)
        .limit(1);

      if (canonicals && canonicals.length > 0) {
        const canonical = canonicals[0];
        for (const ap of aliasPeople) {
          if (ap.id === canonical.id) continue;
          log(`🎭 Alias Match: Merging "${ap.name}" into canonical "${canonical.name}"...`);
          await mergePersonCredits(ap.id, canonical.id);
          aliasMergedCount++;
        }
      }
    }

    // -------------------------------------------------------------
    // PHASE 2: PURGE GARBAGE & HALLUCINATIONS
    // -------------------------------------------------------------
    log('--- Phase 2: Purging Non-Person Noise & Hallucinations ---');
    const { data: recentPeople } = await supabase
      .from('people')
      .select('id, name')
      .order('created_at', { ascending: false })
      .limit(600);

    for (const p of recentPeople || []) {
      const isGarbage = GARBAGE_PATTERNS.some((rx) => rx.test(p.name));
      if (isGarbage) {
        log(`🗑️ Purging non-person garbage: "${p.name}"`);
        await supabase.from('credits').delete().eq('person_id', p.id);
        await supabase.from('people').delete().eq('id', p.id);
        purgedCount++;
      }
    }

    // -------------------------------------------------------------
    // PHASE 3: STRIP GLUED ROLES & UPDATE CREDITS
    // -------------------------------------------------------------
    log('--- Phase 3: Stripping Glued Roles from Names ---');
    for (const p of recentPeople || []) {
      let clean = p.name;
      let detectedRole: string | null = null;

      const prefixMatch = p.name.match(ROLE_PREFIXES);
      if (prefixMatch) {
        detectedRole = prefixMatch[0].replace(/[-:–\s]+$/, '');
        clean = clean.replace(ROLE_PREFIXES, '').trim();
      }

      const suffixMatch = clean.match(ROLE_SUFFIXES);
      if (suffixMatch) {
        detectedRole = detectedRole || suffixMatch[0].replace(/^[-:–\s]+/, '');
        clean = clean.replace(ROLE_SUFFIXES, '').trim();
      }

      if (clean !== p.name && clean.split(' ').length >= 2) {
        log(`✂️ Stripping role from "${p.name}" -> "${clean}" (Role: ${detectedRole})`);
        const { data: existing } = await supabase.from('people').select('id, name').ilike('name', clean);
        if (existing && existing.length > 0 && existing[0].id !== p.id) {
          await mergePersonCredits(p.id, existing[0].id, detectedRole);
          roleCleanedCount++;
        } else {
          await supabase.from('people').update({ name: clean }).eq('id', p.id);
          if (detectedRole) {
            await supabase.from('credits').update({ character_name: detectedRole }).eq('person_id', p.id);
          }
          roleCleanedCount++;
        }
      }
    }

    // -------------------------------------------------------------
    // PHASE 4: 90%–100% IN-MEMORY FUZZY SIMILARITY DEDUPLICATION
    // -------------------------------------------------------------
    log('--- Phase 4: Checking 90%–100% Name Similarity Matches ---');
    const { data: candidatePeople } = await supabase
      .from('people')
      .select('id, name, photo_url')
      .order('created_at', { ascending: false })
      .limit(500);

    const peopleList = candidatePeople || [];
    const mergedIds = new Set<string>();

    for (let i = 0; i < peopleList.length; i++) {
      const p1 = peopleList[i];
      if (mergedIds.has(p1.id)) continue;

      const norm1 = normalize(p1.name);
      if (norm1.length < 4 || norm1.split(' ').length < 2) continue;

      for (let j = i + 1; j < peopleList.length; j++) {
        const p2 = peopleList[j];
        if (mergedIds.has(p2.id)) continue;

        const norm2 = normalize(p2.name);
        if (norm2.length < 4 || norm2.split(' ').length < 2) continue;

        // Compare first names or full string
        const p1First = norm1.split(' ')[0];
        const p2First = norm2.split(' ')[0];
        if (p1First !== p2First && !norm1.startsWith(p2First) && !norm2.startsWith(p1First)) {
          continue;
        }

        const sim = levenshteinSimilarity(norm1, norm2);
        const isSubstring = (norm1.includes(norm2) || norm2.includes(norm1)) && Math.abs(norm1.length - norm2.length) <= 10;

        if (sim >= 0.90 || (isSubstring && sim >= 0.85)) {
          const canonical = p2.photo_url || norm2.split(' ').length <= norm1.split(' ').length ? p2 : p1;
          const duplicate = canonical.id === p1.id ? p2 : p1;

          log(`🔄 Merging 90%+ match: "${duplicate.name}" -> "${canonical.name}" (${(sim * 100).toFixed(1)}%)`);
          await mergePersonCredits(duplicate.id, canonical.id);
          mergedIds.add(duplicate.id);
          fuzzyMergedCount++;
        }
      }
    }

    // -------------------------------------------------------------
    // PHASE 5: PERSIST AUDIT LOGS
    // -------------------------------------------------------------
    const completedAt = new Date();
    const summary = `Aliases Merged: ${aliasMergedCount}, Purged: ${purgedCount}, Roles Cleaned: ${roleCleanedCount}, Fuzzy Merged: ${fuzzyMergedCount}`;
    log(`✅ Daily Cleanup Completed in ${((completedAt.getTime() - startedAt.getTime()) / 1000).toFixed(1)}s.`);
    log(`📊 ${summary}`);

    // Try logging to cron_logs table if present
    try {
      await supabase.from('cron_logs').insert({
        job_name: 'daily_people_consensus_and_cleanup',
        status: 'success',
        started_at: startedAt.toISOString(),
        completed_at: completedAt.toISOString(),
        purged_count: purgedCount,
        merged_count: aliasMergedCount + fuzzyMergedCount,
        cleaned_count: roleCleanedCount,
        details: { summary, logs: logs.slice(-20) },
      });
    } catch {
      // Ignored if table not created
    }

    // Write file log
    const logDir = path.resolve('logs');
    if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
    fs.writeFileSync(path.join(logDir, `cleanup_${startedAt.toISOString().slice(0, 10)}.log`), logs.join('\n'));

    return { success: true, aliasMergedCount, purgedCount, roleCleanedCount, fuzzyMergedCount, summary };
  } catch (err: any) {
    console.error('❌ Cleanup Failed:', err.message);
    throw err;
  }
}

if (process.argv[1]?.includes('daily_people_cleanup')) {
  runDailyPeopleCleanup().catch(console.error);
}
