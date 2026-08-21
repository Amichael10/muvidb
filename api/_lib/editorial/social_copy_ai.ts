import { generateAIContent, parseJSON } from '../ai_service.js';

export type AICopyRequest = {
  candidate: {
    id: string;
    type?: 'movie' | 'person' | 'play' | 'critic';
    name: string;
    subtext?: string;
    imageUrl?: string;
    category?: string;
    data?: any;
  };
  series?: {
    id?: string;
    name?: string;
    slug?: string;
    category?: string;
    description?: string;
  };
  tone?: 'dramatic' | 'debate' | 'streaming' | 'celebratory' | 'funny' | 'default';
  preferredProvider?: 'cohere' | 'gemini' | 'groq' | 'openai';
};

export type AICopyResult = {
  instagram: string;
  threads: string;
  facebook: string;
  tiktok: string;
  engine?: string;
};

/**
 * Builds the copywriting prompt tailored to Nollywood & African entertainment standards
 */
function buildCopyPrompt(req: AICopyRequest): string {
  const { candidate, series, tone } = req;
  const data = candidate.data || {};
  const isPerson = candidate.type === 'person';
  const seriesName = series?.name || 'Nollywood Spotlight';
  const seriesSlug = series?.slug || '';

  // Extract metadata
  const title = candidate.name;
  const synopsis = data.synopsis || candidate.subtext || '';
  const tagline = data.tagline || '';
  const year = data.year || '';
  const releaseDate = data.release_date || '';
  const releaseType = data.release_type || '';
  const isCinemas = data.is_in_cinemas || false;
  const topCast = (data.topCast || []).map((c: any) => `${c.name}${c.handle ? ` (${c.handle})` : ''}`).join(', ');
  const directors = (data.directors || []).map((d: any) => `${d.name}${d.handle ? ` (${d.handle})` : ''}`).join(', ');
  const criticQuote = data.criticReview?.quote || data.quote || '';
  const criticName = data.criticReview?.criticName || data.criticName || '';
  const criticPub = data.criticReview?.publication || data.publication || '';
  const rating = data.criticReview?.rating || (data.liked_percent ? `${(data.liked_percent / 10).toFixed(1)}/10` : '');
  const knownFor = (data.knownFor || []).map((k: any) => `${k.title} (${k.year || ''})`).join(', ');
  const bio = data.bio || '';

  let contextDescription = '';
  if (isPerson) {
    contextDescription = `
FEATURE TYPE: Actor/Filmmaker Spotlight (${seriesName})
- Name: ${title}
- Handle: ${data.handle || ''}
- Department: ${data.department || data.known_for_department || 'Actor/Filmmaker'}
- Known For Filmography: ${knownFor || 'Acclaimed Nollywood works'}
- Bio Summary: ${bio || synopsis}
- Focus: Highlight their artistic craft, versatility, impact on African cinema, and prompt the audience for their favorite role.`;
  } else if (criticQuote || seriesSlug.includes('critic')) {
    contextDescription = `
FEATURE TYPE: Film Criticism & Review Debate (${seriesName})
- Film Title: ${title} (${year})
- Synopsis: ${synopsis}
- Tagline: ${tagline}
- Critic Review Quote: "${criticQuote}" by ${criticName} (${criticPub})
- Rating: ${rating}
- Cast: ${topCast}
- Director: ${directors}
- Focus: Hook readers with the critic's verdict/rating, present the central plot conflict, and ask whether the audience agrees with the review.`;
  } else {
    contextDescription = `
FEATURE TYPE: Nollywood Movie Feature (${seriesName})
- Title: ${title} (${year})
- Synopsis: ${synopsis}
- Tagline: ${tagline}
- Release Info: ${releaseType ? `Streaming on ${releaseType}` : (isCinemas ? 'In Cinemas Nationwide' : (releaseDate ? `Releasing ${releaseDate}` : 'Now Available'))}
- Top Cast: ${topCast || 'Nollywood stars'}
- Director: ${directors || 'Acclaimed Filmmaker'}
- Focus: Build suspense and curiosity around the storyline conflict. Do NOT start every post with "New Poster". Use an intriguing narrative hook, platform anchor, cast @handles, and discussion CTA.`;
  }

  const toneGuidance = tone && tone !== 'default'
    ? `TONE REQUIREMENT: Adopt a ${tone.toUpperCase()} tone (e.g. ${tone === 'debate' ? 'spark intense debate/opinion' : tone === 'dramatic' ? 'high drama & suspense' : tone === 'funny' ? 'humorous & relatable' : 'exciting & energetic'}).`
    : `TONE: High-engagement, authentic Nigerian entertainment voice (Partyjollof TV, Filmone, Pulse Nigeria style).`;

  return `You are the lead social media strategist for MuviDB (the IMDb for African Cinema).
Write 4 platform-tailored social media captions for this feature.

${contextDescription}

${toneGuidance}

STRICT PLATFORM REQUIREMENTS:
1. "instagram":
   - Line 1: Compelling, story-driven opening hook (tailored to the plot or subject. Do NOT write "New Poster for..." unless it's explicitly a poster drop).
   - Line 2: Platform/Cinemas/Release date anchor (e.g. "Only on Prime Video August 15" or "Streaming on Netflix" or "In Cinemas Nationwide").
   - Paragraph: Transform the story conflict into 2-3 provocative, curiosity-inducing questions.
   - Cast List: "Starring:" followed by cast members with their @handles on separate lines.
   - Director: "Directed by @handle"
   - CTA: A question that urges followers to comment (e.g., "What would you do in this situation? Let's talk in the comments! 👇").
   - Hashtags: 4-6 targeted hashtags (#Nollywood #MuviDB #AfricanCinema #[TitleTag]).

2. "threads":
   - Conversational, provocative, under 480 characters.
   - Starts directly with the dilemma or debate question.
   - Includes 2-3 key tags.

3. "facebook":
   - Engaging storytelling format with paragraph breaks, plot context, watch availability, and community discussion question.

4. "tiktok":
   - Punchy, high-energy hook suitable for short-form video/slides, watch info, and trending tags.

OUTPUT REQUIREMENT:
Return ONLY a valid JSON object matching this structure:
{
  "instagram": "...",
  "threads": "...",
  "facebook": "...",
  "tiktok": "..."
}
Do NOT include markdown backticks or commentary outside the JSON.`;
}

/**
 * Generates platform-specific social copy using Cohere with multi-provider fallback
 */
export async function generateAICaptions(req: AICopyRequest): Promise<AICopyResult> {
  const prompt = buildCopyPrompt(req);
  const preferred = req.preferredProvider || 'cohere';

  try {
    const aiRes = await generateAIContent(prompt, { preferredProvider: preferred });
    const parsed = parseJSON(aiRes.text);

    if (parsed && (parsed.instagram || parsed.threads || parsed.facebook || parsed.tiktok)) {
      return {
        instagram: parsed.instagram || '',
        threads: parsed.threads || '',
        facebook: parsed.facebook || '',
        tiktok: parsed.tiktok || '',
        engine: aiRes.telemetry?.engine || 'cohere',
      };
    }
  } catch (err) {
    console.warn('[social_copy_ai] AI generation failed, falling back to rule builder:', (err as Error)?.message);
  }

  // Fallback if AI fails
  const name = req.candidate.name;
  return {
    instagram: `Spotlight on ${name}! 🎬\n\nDiscover the story and full credits on MuviDB.\n\n#Nollywood #MuviDB #AfricanCinema`,
    threads: `What's your take on ${name}? Join the discussion on MuviDB! ✨ #Nollywood`,
    facebook: `🎬 Feature Spotlight: ${name}\n\nExplore full cast, crew, and verified reviews on MuviDB!`,
    tiktok: `Watch this! Spotlight on ${name} 🌟 #Nollywood #MuviDB`,
    engine: 'rule_fallback',
  };
}
