import { generateAIContent, parseJSON } from '../ai_service.js';
import type { FactPack } from './fact_pack_service';
import { selectCaptionBankStarters } from './caption_bank.js';
import { extractInstagramHandle } from '../social-studio/content/snapshots.js';

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
  const vaultCandidate = {
    id: factPack.entity.id,
    type: factPack.entity.type,
    name: factPack.entity.name,
    country: factPack.facts?.country,
    data: {
      ...factPack.facts,
      platformDisplayName: factPack.watchLinks?.[0]?.distributor,
      knownFor: (factPack.credits || []).map(credit => ({ title: credit.film || credit.name, year: credit.year })),
      topCast: factPack.entity.type === 'movie'
        ? (factPack.credits || []).filter(credit => credit.role === 'actor').map(credit => ({ name: credit.name, handle: extractInstagramHandle(credit) }))
        : [],
      directors: factPack.entity.type === 'movie'
        ? (factPack.credits || []).filter(credit => credit.role === 'director').map(credit => ({ name: credit.name, handle: extractInstagramHandle(credit) }))
        : [],
      creditedPeople: factPack.entity.type === 'movie'
        ? (factPack.credits || []).map(credit => ({ name: credit.name, role: credit.role, handle: extractInstagramHandle(credit) })).filter(credit => credit.handle)
        : [],
      youtubeChannelName: factPack.facts?.youtube_channel_name,
      criticReview: factPack.reviews?.[0]
        ? {
            quote: factPack.reviews[0].quote,
            rating: factPack.reviews[0].rating,
            criticName: factPack.reviews[0].critic_name,
            publication: factPack.reviews[0].publication,
          }
        : undefined,
    },
  };
  const captionVault = selectCaptionBankStarters({
    seriesSlug: figmaTemplateKey,
    candidate: vaultCandidate,
    limit: 8,
  });
  const captionVaultExamples = captionVault.starters.length
    ? captionVault.starters.map((starter, index) => `${index + 1}. ${starter}`).join('\n')
    : 'No fully verifiable starter is available. Write directly from the fact pack.';

  const prompt = `
You are the lead editor for MuviDB, the premier African cinema database.
Entity: ${factPack.entity.name}
Chosen Angle: ${chosenAngle.title} (${chosenAngle.reason})
Figma Template: ${figmaTemplateKey}

FACT PACK (STRICT TRUTH SOURCE):
${JSON.stringify(factPack, null, 2)}

APPROVED MUVIDB COPY VAULT STRUCTURES (${captionVault.category}):
${captionVaultExamples}

Instructions:
Write informative, film-loving editorial copy.
DO NOT use buzzwords ("thrilled", "banger", "legendary", "iconic").
DO NOT make claims not supported by the FACT PACK.
Use no more than one resolved Copy Vault structure per platform. Never introduce a placeholder or infer a missing metric, platform, date, credit, person, or venue.

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

  const fallbackStarter = captionVault.starters[0];
  const fallbackLead = fallbackStarter ? `${fallbackStarter}\n\n` : '';

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
      caption: `${fallbackLead}Exploring the career and credits of ${factPack.entity.name} on MuviDB.\n\nDiscover full filmographies, reviews, and showtimes at muvidb.com`,
      cta: 'Link in bio to view full profile on MuviDB.',
      hashtags: ['#MuviDB', '#AfricanCinema', '#Nollywood'],
    },
    threads: {
      text: `${fallbackLead}Exploring the credits of ${factPack.entity.name} on MuviDB. What is your favourite performance?`.slice(0, 480).trim(),
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
