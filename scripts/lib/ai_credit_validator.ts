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

/**
 * Validates candidate credits using the AI Validation Gate (Groq / Gemini / Cohere).
 */
export async function validateCreditsWithAi(
  filmTitle: string,
  candidates: Array<{ raw: string; role: string; creditType: 'actor' | 'crew' }>
): Promise<AiValidationResult[]> {
  if (!candidates.length) return [];

  // 1. Instant regex pre-filter to reject obvious junk without burning AI calls
  const prefiltered: Array<{ item: { raw: string; role: string; creditType: 'actor' | 'crew' }; autoRejectReason?: string }> = [];

  for (const c of candidates) {
    const raw = (c.raw || '').trim();
    if (raw.length < 3) {
      prefiltered.push({ item: c, autoRejectReason: 'Too short' });
      continue;
    }

    const words = raw.split(/\s+/);
    if (words.length > 4) {
      prefiltered.push({ item: c, autoRejectReason: 'Too many words (mashed multiple people or title)' });
      continue;
    }

    if (/^(sound\s+man|prop\s+ser|ass\s+rf\s+gaffer|camera\s+asst|full\s+movie|part\s+\d+|the\s+end)$/i.test(raw)) {
      prefiltered.push({ item: c, autoRejectReason: 'Known role/title phrase' });
      continue;
    }

    if (/\b(produc|scripty|wardrop|gaffer|sound\s+design|camera\s+operator|focus\s+puller)\b/i.test(raw)) {
      prefiltered.push({ item: c, autoRejectReason: 'Role keyword embedded in name' });
      continue;
    }

    prefiltered.push({ item: c });
  }

  const toAskAi = prefiltered.filter(p => !p.autoRejectReason).map(p => p.item);
  const aiResultsMap = new Map<string, AiValidationResult>();

  // Chunk AI validation into batches of 15 to avoid token limits or dropped candidates
  const BATCH_SIZE = 15;
  for (let i = 0; i < toAskAi.length; i += BATCH_SIZE) {
    const batch = toAskAi.slice(i, i + BATCH_SIZE);
    const prompt = `${SYSTEM_PROMPT}\n\nFilm Title: "${filmTitle}"\nCandidates to validate:\n${JSON.stringify(batch.map(c => ({ raw: c.raw, role: c.role })), null, 2)}`;
    try {
      console.log(`      ⚡ Consulting AI (${batch.length} candidates, batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(toAskAi.length / BATCH_SIZE)})...`);
      const aiResponse = await generateAIContent(prompt, { preferredProvider: 'cohere' });
      const parsed = parseJSON(aiResponse.text);
      const list: any[] = Array.isArray(parsed) ? parsed : (parsed?.results || parsed?.candidates || parsed?.credits || []);
      console.log(`      🤖 AI Gate [${aiResponse.telemetry?.engine || 'Active Model'}] responded: processed ${list.length} validations`);

      for (const item of list) {
        if (item && item.raw) {
          aiResultsMap.set(item.raw.toLowerCase(), {
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
      console.warn(`      ⚠️ [AI Gate] Batch validation call failed: ${err.message}.`);
    }
  }

  // Combine pre-filtered rejections and AI results
  const finalResults: AiValidationResult[] = [];

  for (const entry of prefiltered) {
    if (entry.autoRejectReason) {
      finalResults.push({
        raw: entry.item.raw,
        isValidHumanName: false,
        cleanName: null,
        normalizedRole: null,
        rejectionReason: entry.autoRejectReason,
        confidence: 0,
      });
      continue;
    }

    const aiRes = aiResultsMap.get(entry.item.raw.toLowerCase());
    if (aiRes) {
      finalResults.push(aiRes);
    } else {
      // If AI didn't return an entry for this item, fail safe (skip)
      finalResults.push({
        raw: entry.item.raw,
        isValidHumanName: false,
        cleanName: null,
        normalizedRole: null,
        rejectionReason: 'Not confirmed by AI gate',
        confidence: 0,
      });
    }
  }

  return finalResults;
}
