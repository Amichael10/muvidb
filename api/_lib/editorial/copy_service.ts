import { generateAIContent, parseJSON } from '../ai_service.js';
import type { FactPack } from './fact_pack_service';

export interface EditorialAngle {
  id: string;
  title: string;
  reason: string;
  confidence: number;
}

export interface MultiPlatformCopy {
  headline: string;
  subheadline: string;
  design_copy: {
    cover: string;
    slides: Array<{ position: number; type: string; title: string; supporting_text: string }>;
  };
  instagram: { caption: string; cta: string; hashtags: string[] };
  threads: { text: string };
  x: { text: string };
  tiktok: { caption: string };
  fact_ids_used: string[];
}

/**
 * Generates 3-5 grounded editorial angles using ONLY verified FactPack data.
 */
export async function generateEditorialAngles(factPack: FactPack): Promise<EditorialAngle[]> {
  const prompt = `
Given ONLY these verified database facts for ${factPack.entity.name} (${factPack.entity.type}):
${JSON.stringify(factPack, null, 2)}

Identify 3 to 5 distinct, compelling editorial angles for a social media feature.
STRICT RULES:
- Do NOT introduce external facts, unverified awards, or hype.
- Do NOT assume acclaim or popularity unless explicitly present in facts.
- Output strict JSON array of objects with keys: "id", "title", "reason", "confidence".
`;

  try {
    const res = await generateAIContent(prompt, { preferredProvider: 'cohere' });
    const parsed = parseJSON(res.text);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.error('[generateEditorialAngles] Failed:', err);
    return [
      {
        id: 'career_spotlight',
        title: `Career Spotlight: ${factPack.entity.name}`,
        reason: 'Highlight verified filmography credits and artistic trajectory.',
        confidence: 0.9,
      },
    ];
  }
}

/**
 * Generates multi-platform copy (Instagram, Threads, X, TikTok) + Figma slide text.
 */
export async function generateEditorialCopy(
  factPack: FactPack,
  chosenAngle: EditorialAngle,
  figmaTemplateKey = 'people-filmography'
): Promise<MultiPlatformCopy> {
  const prompt = `
You are the lead editor for MuviDB, the premier African cinema database.
Entity: ${factPack.entity.name}
Chosen Angle: ${chosenAngle.title} (${chosenAngle.reason})
Figma Template: ${figmaTemplateKey}

FACT PACK (STRICT TRUTH SOURCE):
${JSON.stringify(factPack, null, 2)}

Instructions:
Write informative, film-loving editorial copy.
DO NOT use buzzwords ("thrilled", "banger", "legendary", "iconic").
DO NOT make claims not supported by the FACT PACK.

Return strict JSON object matching this schema:
{
  "headline": "...",
  "subheadline": "...",
  "design_copy": {
    "cover": "...",
    "slides": [
      { "position": 1, "type": "credit", "title": "...", "supporting_text": "..." }
    ]
  },
  "instagram": { "caption": "...", "cta": "...", "hashtags": ["#MuviDB", "#AfricanCinema"] },
  "threads": { "text": "..." },
  "x": { "text": "..." },
  "tiktok": { "caption": "..." },
  "fact_ids_used": ${JSON.stringify(factPack.fact_ids)}
}
`;

  try {
    const res = await generateAIContent(prompt, { preferredProvider: 'cohere' });
    const parsed = parseJSON(res.text);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed;
    }
  } catch (err) {
    console.error('[generateEditorialCopy] Failed:', err);
  }

  // Fallback Copy Structure
  return {
    headline: `${factPack.entity.name}`,
    subheadline: `A closer look at ${factPack.entity.name}'s credits on MuviDB.`,
    design_copy: {
      cover: factPack.entity.name,
      slides: (factPack.credits || []).slice(0, 4).map((c, i) => ({
        position: i + 1,
        type: 'credit',
        title: c.film || c.name || 'Credit',
        supporting_text: c.role ? `${c.role} ${c.character ? `as ${c.character}` : ''}` : '',
      })),
    },
    instagram: {
      caption: `Exploring the career and credits of ${factPack.entity.name} on MuviDB.\n\nDiscover full filmographies, reviews, and showtimes at muvidb.com`,
      cta: 'Link in bio to view full profile on MuviDB.',
      hashtags: ['#MuviDB', '#AfricanCinema', '#Nollywood'],
    },
    threads: {
      text: `Exploring the credits of ${factPack.entity.name} on MuviDB. What is your favourite performance?`,
    },
    x: {
      text: `Career spotlight: ${factPack.entity.name}. Full credits & profile on MuviDB: https://muvidb.com`,
    },
    tiktok: {
      caption: `Spotlight on ${factPack.entity.name} #MuviDB #AfricanCinema`,
    },
    fact_ids_used: factPack.fact_ids,
  };
}
