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
3. Output the clean, properly capitalized full name in "cleanName" (e.g. fix OCR typos like "Zubby Miceal" -> "Zubby Michael").
4. Set "confidence" between 85 and 100 for valid human names.

CRITICAL REJECTION RULES (Mark isValidHumanName = false):
1. REJECT role names turned into people: e.g. "Sound Man", "Prop Ser", "Ass RF Gaffer", "Camera Asst", "Full Movie", "Produc", "Scripty", "Wardrop", "Gaffer", "Focus Puller", "Set Designer", "Media & Graphics".
2. REJECT mashed MULTIPLE DIFFERENT celebrities on one line: e.g. "Mercy Johnson Jerry Isaac", "Rita Dominic Zubby Michael".
3. REJECT scrambled OCR gibberish or non-names: e.g. "Ayouc I Uiaadlpoo", "Whiimmi Tarinlas", "Sug Doty", "Nude Loa", "Fume Uiaucte".
4. REJECT general words or movie titles: e.g. "Full Movie", "Part 2", "The End", "Special Thanks", "Episode".

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

export function isCleanHumanNameHeuristic(raw: string): { isValid: boolean; cleanName: string | null } {
  if (!raw) return { isValid: false, cleanName: null };
  const clean = normalizePersonName(raw);
  if (!clean || clean.length < 3 || clean.length > 50) return { isValid: false, cleanName: null };

  const words = clean.split(' ');
  if (words.length < 2 || words.length > 4) return { isValid: false, cleanName: null };

  // Reject if any word contains noise words or role keywords
  const containsNoise = NOISE_WORDS.some(nw => clean.toUpperCase().includes(nw));
  if (containsNoise) return { isValid: false, cleanName: null };

  if (/\b(sound\s+man|prop\s+ser|gaffer|camera|movie|production|studio|pictures|director|producer|writer|editor|special\s+thanks)\b/i.test(clean)) {
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
      // Obvious junk or ambiguous candidate
      if (raw.length < 3 || raw.split(/\s+/).length > 4 || /\b(sound\s+man|prop\s+ser|gaffer|movie|part\s+\d+|the\s+end)\b/i.test(raw)) {
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

  // Optional AI Gate for remaining ambiguous candidates (with strict 5-second timeout)
  const BATCH_SIZE = 15;
  for (let i = 0; i < toAskAi.length; i += BATCH_SIZE) {
    const batch = toAskAi.slice(i, i + BATCH_SIZE);
    const prompt = `${SYSTEM_PROMPT}\n\nFilm Title: "${filmTitle}"\nCandidates to validate:\n${JSON.stringify(batch.map(c => ({ raw: c.raw, role: c.role })), null, 2)}`;
    try {
      console.log(`      ⚡ Consulting AI Gate for ${batch.length} ambiguous candidates...`);
      const aiPromise = generateAIContent(prompt, { preferredProvider: 'cohere' });
      const timeoutPromise = new Promise<never>((_, reject) => setTimeout(() => reject(new Error('AI Gate timeout (5s)')), 5000));
      
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
      console.warn(`      ⚠️ AI Gate skipped/timed out (${err.message}). Using local name heuristics.`);
      for (const c of batch) {
        const norm = normalizePersonName(c.raw);
        const valid = norm.length > 3 && norm.split(' ').length >= 2 && !NOISE_WORDS.some(nw => norm.toUpperCase().includes(nw));
        results.push({
          raw: c.raw,
          isValidHumanName: valid,
          cleanName: valid ? norm : null,
          normalizedRole: c.role,
          confidence: valid ? 85 : 0,
        });
      }
    }
  }

  return results;
}
