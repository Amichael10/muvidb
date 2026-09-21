import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config();

import { generateAIContent, parseJSON } from '../../api/_lib/ai_service.js';

export type AiValidationResult = {
  raw: string;
  isValidHumanName: boolean;
  cleanName: string | null;
  normalizedRole: string | null;
  rejectionReason?: string;
  confidence: number; // 0 to 100
};

const SYSTEM_PROMPT = `You are an expert film metadata verification agent specializing in Nollywood and African cinema.
Review the following extracted raw credit candidates from film video OCR and descriptions.

ACCEPTANCE RULES (Mark isValidHumanName = true):
1. ACCEPT genuine, authentic real-world human personal names (e.g. "Femi Adebayo", "Boluwatife Elizabeth", "Lateef Adedimeji", "Okiki Afolayan", "Wunmi Toriola", "Mitchell Okoro", "Joshua Akinade", "Zubby Michael", "Mercy Johnson", "Ayodeji Oladipo", "Quadry Abimbola Grace").
2. Note that Nigerian and African names frequently have 2 or 3 parts (Surname + First Name + Middle/Native Name, e.g. "Quadry Abimbola Grace", "Quadry Kabirat Desire", "Blessing George Ogechukwu"). These are 100% valid single human names.
3. CORRECT common OCR typos of Nollywood stars in "cleanName":
   - "Adunlade Adekola" -> "Odunlade Adekola"
   - "Ofunlade Adekola" -> "Odunlade Adekola"
   - "Zubby Miceal" -> "Zubby Michael"
   - "Akeek Adeyemi" -> "Akeem Adeyemi"
   - "Monsuru Ljayegbemi" -> "Monsuru Ijayegbemi"
4. RESOLVE known Nollywood stage names / aliases in "cleanName":
   - "Erekere" -> "Michael Olalekan Adeyemi"
   - "MC Lively" -> "Michael Sani Amanesi"
   - "Apa" -> "Sanusi Izihaq"
   - "Itele" -> "Ibrahim Yekini"
   - "Mr Macaroni" -> "Debo Adedayo"
5. Set "confidence" between 85 and 100 for valid human names.

CRITICAL REJECTION RULES (Mark isValidHumanName = false):
1. REJECT character roles or titles: e.g. "Brother Sam", "Sister Rebeka", "Omo Elemosho", "Police Officer", "Olori Ebi", "Elegbon Adugbo", "Gate Man", "Sound Man", "Prop Ser", "Ass RF Gaffer", "Camera Asst", "Full Movie", "Produc", "Scripty", "Wardrop", "Gaffer", "Focus Puller", "Set Designer", "Media & Graphics".
2. REJECT agencies, companies, studios, and businesses: e.g. "Baggy Land Agency", "ATS Glamourstudio", "Ijele Props/Set", "Jenny & Jessy Pharmacy".
3. REJECT mashed MULTIPLE DIFFERENT celebrities on one line: e.g. "Mercy Johnson Jerry Isaac", "Rita Dominic Zubby Michael".
4. REJECT scrambled OCR gibberish or non-names: e.g. "Nwiii Fgii Tkenna", "Kdzeem Snonerdn", "Ayouc I Uiaadlpoo", "Whiimmi Tarinlas", "Sug Doty", "Nude Loa", "Fume Uiaucte".
5. REJECT general words or movie titles: e.g. "Full Movie", "Part 2", "The End", "Special Thanks", "Episode".

Return a JSON object with a "results" array matching this exact schema:
{
  "results": [
    {
      "raw": "string",
      "isValidHumanName": boolean,
      "cleanName": "Clean Name" or null,
      "normalizedRole": "actor" | "director" | "producer" | "writer" | "cinematographer" | "editor" | "sound" | "costume" | "makeup" | "crew" or null,
      "rejectionReason": "reason string" or null,
      "confidence": number
    }
  ]
}`;

import { NOISE_WORDS, normalizePersonName } from './credit_consensus_verifier';

const CHARACTER_NAME_PREFIXES = /^(?:brother|bro|sister|sis|uncle|aunty|aunt|mama|baba|papa|pappy|pastor|alfa|imam|alhaji|alhaj|chief|king|queen|prince|princess|doctor|doc|nurse|officer|police|inspector|sergeant|gateman|gate\s+man|driver|landlord|landlady|maid|chairman|madam|elder|omo|elegbon|olori|board|members?|extras?|guests?|dancers?|artist|artsist|crew|cast|tattoo|ghost|big\s+fish)\b/i;
const CORPORATE_WORDS = /\b(?:agency|ventures|enterprises|properties|limited|ltd|holdings|services|company|consult|logistics|foundation|studio|studios|production|productions|entertainment|props?|costumes|glamour|media(?:\s*pro|\s*mind)?|visuals?|concepts?|pictures|channel|network|tv|board\s*members?|ity\s*guests?|city\s*guests?|props?\s*sets?|set\s*props?)\b/i;

export function isCleanHumanNameHeuristic(raw: string): { isValid: boolean; cleanName: string | null } {
  if (!raw) return { isValid: false, cleanName: null };
  const clean = normalizePersonName(raw);
  if (!clean || clean.length < 3 || clean.length > 50) return { isValid: false, cleanName: null };

  const words = clean.split(' ');
  if (words.length < 2 || words.length > 4) return { isValid: false, cleanName: null };

  // Reject if matches noise words, character role prefixes, or corporate words
  const containsNoise = NOISE_WORDS.some(nw => clean.toUpperCase().includes(nw));
  if (containsNoise) return { isValid: false, cleanName: null };
  if (CHARACTER_NAME_PREFIXES.test(clean)) return { isValid: false, cleanName: null };
  if (CORPORATE_WORDS.test(clean)) return { isValid: false, cleanName: null };

  if (/\b(sound\s+man|props?\s*sets?|set\s*props?|props?|gaffer|camera|movie|production|studio|pictures|director|producer|writer|editor|special\s+thanks|receptionist|photographer|stillphotographer|bestboy|best\s+boy|secretary|doctor|police|warder|officer|costumier|costume|continuity|focus\s+puller|spark|welfare|security|media(?:\s*pro)?|visuals?|board\s*members?|ity\s*guests?|city\s*guests?|extras?|tattoo|ghost)\b/i.test(clean)) {
    return { isValid: false, cleanName: null };
  }

  // Check that each word starts with a capital letter and consists of valid letters
  const isAllValidWords = words.every(w => /^[A-Z][a-zA-Z'’-]{1,25}$/.test(w));
  if (!isAllValidWords) return { isValid: false, cleanName: null };

  return { isValid: true, cleanName: clean };
}

/**
 * Validates candidate credits using Fast Local Heuristics + AI Validation Gate fallback.
 */
export async function validateCreditsWithAi(
  filmTitle: string,
  candidates: Array<{ raw: string; role: string; creditType: 'actor' | 'crew' }>
): Promise<AiValidationResult[]> {
  if (!candidates.length) return [];

  const results: AiValidationResult[] = [];
  const toAskAi: Array<{ raw: string; role: string; creditType: 'actor' | 'crew' }> = [];

  for (const c of candidates) {
    const raw = (c.raw || '').trim();
    const heuristic = isCleanHumanNameHeuristic(raw);

    if (heuristic.isValid && heuristic.cleanName) {
      // ⚡ FAST PASS: Clean 2-4 word human name validated locally without burning API calls
      results.push({
        raw,
        isValidHumanName: true,
        cleanName: heuristic.cleanName,
        normalizedRole: c.role || (c.creditType === 'actor' ? 'actor' : 'crew'),
        confidence: 92,
      });
    } else {
      // Obvious junk or candidate needing AI inspection
      if (raw.length < 3 || raw.split(/\s+/).length > 4 || /\b(sound\s+man|props?\s*sets?|set\s*props?|props?|gaffer|movie|part\s+\d+|the\s+end|media(?:\s*pro)?|visuals?|board\s*members?|ity\s*guests?|city\s*guests?)\b/i.test(raw)) {
        results.push({
          raw,
          isValidHumanName: false,
          cleanName: null,
          normalizedRole: null,
          rejectionReason: 'Known role/noise or invalid format',
          confidence: 0,
        });
      } else {
        toAskAi.push(c);
      }
    }
  }

  if (!toAskAi.length) {
    return results;
  }

  // AI Gate for remaining ambiguous candidates (with 20-second timeout)
  const BATCH_SIZE = 15;
  for (let i = 0; i < toAskAi.length; i += BATCH_SIZE) {
    const batch = toAskAi.slice(i, i + BATCH_SIZE);
    const prompt = `${SYSTEM_PROMPT}\n\nFilm Title: "${filmTitle}"\nCandidates to validate:\n${JSON.stringify(batch.map(c => ({ raw: c.raw, role: c.role })), null, 2)}`;
    try {
      console.log(`      ⚡ Consulting Cohere AI Gate for ${batch.length} ambiguous candidate(s)...`);
      const aiPromise = generateAIContent(prompt, { preferredProvider: 'cohere' });
      const timeoutPromise = new Promise<never>((_, reject) => setTimeout(() => reject(new Error('AI Gate timeout (20s)')), 20000));
      
      const aiResponse: any = await Promise.race([aiPromise, timeoutPromise]);
      const parsed = parseJSON(aiResponse.text);
      const list: any[] = Array.isArray(parsed) ? parsed : (parsed?.results || parsed?.candidates || parsed?.credits || []);

      for (const item of list) {
        if (item && item.raw) {
          results.push({
            raw: item.raw,
            isValidHumanName: Boolean(item.isValidHumanName),
            cleanName: item.cleanName || null,
            normalizedRole: item.normalizedRole || null,
            rejectionReason: item.rejectionReason || (item.isValidHumanName ? undefined : 'AI rejected'),
            confidence: Number(item.confidence || 0),
          });
        }
      }
    } catch (err: any) {
      console.warn(`      ⚠️ AI Gate skipped/timed out (${err.message}). Defaulting to safe rejection for unverified candidates.`);
      for (const c of batch) {
        results.push({
          raw: c.raw,
          isValidHumanName: false,
          cleanName: null,
          normalizedRole: null,
          rejectionReason: `AI Gate unavailable (${err.message})`,
          confidence: 0,
        });
      }
    }
  }

  return results;
}
