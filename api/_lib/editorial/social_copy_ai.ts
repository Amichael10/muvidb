import { generateAIContent, parseJSON } from '../ai_service.js';

import { selectCaptionBankStarters } from './caption_bank.js';

export type SocialAngle =
  | 'streaming_alert'
  | 'discovery'
  | 'dynamic_story'
  | 'high_drama'
  | 'critic_debate'
  | 'character_question'
  | 'behind_the_film'
  | 'credit_connection'
  | 'audience_debate'
  | 'fun_relatable';

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
  angle?: SocialAngle;
  preferredProvider?: 'cohere' | 'gemini' | 'groq' | 'openai';
};

export type PlatformCaptions = {
  instagram: string;
  threads: string;
  facebook: string;
  tiktok: string;
};

export type AICopyVariation = {
  key: 'A' | 'B' | 'C';
  label: 'Informative' | 'Editorial' | 'Conversational';
  captions: PlatformCaptions;
};

export type AICopyResponse = {
  success: boolean;
  variations: AICopyVariation[];
  selectedVariation: 'A' | 'B' | 'C';
  instagram: string;
  threads: string;
  facebook: string;
  tiktok: string;
  engine?: string;
};

async function withGenerationTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_resolve, reject) => {
        timeout = setTimeout(() => reject(new Error('AI copy generation timed out')), timeoutMs);
      }),
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

/**
 * Returns specific rules for the active editorial series / content type
 */
function getContentTypeInstructions(seriesSlug: string, isPerson: boolean): string {
  if (seriesSlug.includes('upcoming') || seriesSlug.includes('coming_soon') || seriesSlug.includes('announcement')) {
    return `
CONTENT TYPE: VERIFIED UPCOMING RELEASE
Goal: A precise release announcement, never a streaming claim.
- State the film title and verified release date when supplied.
- Use "coming soon" or "upcoming"; NEVER say "now streaming", "now showing", "available now", or name a viewing platform.
- If no exact release date is supplied, say the title is upcoming without inventing a date.
- Use synopsis, trailer, cast or crew facts only when supplied in source data.
- Ask a specific question grounded in the film, not generic excitement.`;
  }

  if (seriesSlug.includes('watch') || seriesSlug.includes('streaming') || seriesSlug === 'where_to_watch') {
    return `
CONTENT TYPE: WHERE TO WATCH / STREAMING ALERT
Goal: Utility-first discovery.
- Lead with the film title and viewing destination immediately.
- The first two lines MUST answer: 1. What film? 2. Where can I watch it?
- Then optionally use synopsis or cast details to give the reader a concrete reason to care.
- Do NOT call a film "new" unless explicitly indicated in data.
- Example structure:
  Now streaming: [Film Title] 📺
  You can currently watch [Film Title] on [Platform].
  Starring [selected cast with @handles].
  [1 factual sentence about the premise].
  Have you seen it already, or is this going on your watchlist?
  Find more places to watch on MuviDB.
  #MuviDB #AfricanCinema #[FilmTitle]`;
  }

  if (seriesSlug.includes('critic') || seriesSlug === 'critics_say' || seriesSlug === 'the_critic') {
    return `
CONTENT TYPE: WHAT THE CRITICS SAY
Goal: Frame the critical observation, debate, or review without marketing fluff.
- The critic's perspective is the subject. Do NOT turn criticism into promotional marketing copy.
- Accurately represent praise and criticisms from the data.
- Attribute the opinion clearly to the reviewer/publication.
- Example structure:
  What the critics are saying about [Film Title].
  [Critic/Pub] describes the film as "[short quote/paraphrase]".
  Their review highlights [theme/performance].
  Have you seen the film? Did you come away with the same impression?
  Read more critic reviews on MuviDB.
  #MuviDB #AfricanCinema #[FilmTitle]`;
  }

  if (seriesSlug.includes('behind') || seriesSlug === 'behind_the_camera' || (isPerson && seriesSlug.includes('crew'))) {
    return `
CONTENT TYPE: BEHIND THE CAMERA / CREW
Goal: "Every Film. Every Credit." Spotlight directors, cinematographers, writers, and editors.
- Highlight the person's specific craft (e.g. framing, lighting, editing, directing).
- Connect their known credits.
- Example structure:
  You know the film. Meet the person behind the camera.
  [Person] worked as [Role] on [Film].
  Their other credits across African cinema include [Film 2], [Film 3] and [Film 4].
  Explore the filmmakers behind African cinema on MuviDB.
  #MuviDB #AfricanCinema #[PersonName]`;
  }

  if (isPerson || seriesSlug.includes('filmography') || seriesSlug === 'you_know_the_face') {
    return `
CONTENT TYPE: THE FILMOGRAPHY / ACTOR SPOTLIGHT
Goal: Database-led credit discovery.
- Avoid generic celebration like "Celebrating the incredible journey of...".
- Start from the person's most recognisable credit and lead the reader into deeper discovery of other projects.
- Example structure:
  You know [Person] from [Popular Film]. But their filmography goes much further.
  From [Film 2] to [Film 3] and [Film 4], here are a few credits from their work across African cinema.
  Which performance do you know them from?
  Explore the full filmography on MuviDB.
  #MuviDB #AfricanCinema #[PersonName]`;
  }

  if (seriesSlug.includes('stage') || seriesSlug.includes('theatre')) {
    return `
CONTENT TYPE: WHAT'S ON STAGE / THEATRE
Goal: Entertainment guide for African live theatre.
- State production, venue 📍, dates 📅, and what the play explores.
- Example structure:
  On stage this weekend: [Production Name] 🎭
  [Short factual description].
  📍 [Venue]
  📅 [Date]
  If live theatre is on your weekend agenda, put this one on your radar.
  Find more theatre events on MuviDB.
  #MuviDB #AfricanTheatre #[ProductionName]`;
  }

  if (seriesSlug.includes('weekend') || seriesSlug === 'weekend_watchlist') {
    return `
CONTENT TYPE: WEEKEND WATCHLIST
Goal: Thoughtful recommendation, not an advertisement.
- Example structure:
  Looking for something to watch this weekend?
  Put [Film Title] on your radar.
  [Short intriguing premise sentence without spoilers].
  Available on [Platform].
  Would you add this to your weekend list?
  #MuviDB #AfricanCinema #[FilmTitle]`;
  }

  return `
CONTENT TYPE: FILM CONVERSATION / DEBATE
Goal: Make someone want to reply with an authentic opinion. NOT promotional.
- The question is the content.
- Example structure:
  [Film Title] leaves you with an interesting question:
  [Thematic/moral dilemma from the story].
  Where do you stand?
  #MuviDB #AfricanCinema #[FilmTitle]`;
}

/**
 * Returns instructions for the chosen editorial angle
 */
function getAngleInstructions(angle: SocialAngle): string {
  switch (angle) {
    case 'streaming_alert':
      return 'ANGLE: STREAMING ALERT -> Lead with TITLE + PLATFORM + DATE/availability. Utility and discovery first.';
    case 'discovery':
      return 'ANGLE: DISCOVERY -> Teach the audience a fascinating fact or credit connection they probably did not know.';
    case 'high_drama':
      return 'ANGLE: HIGH DRAMA -> Lead with the real stakes and moral conflict in the actual storyline. Never invent artificial drama.';
    case 'critic_debate':
      return 'ANGLE: CRITIC DEBATE -> Frame the critical reception, praise, or point of contention. Ask whether audiences agree.';
    case 'character_question':
      return 'ANGLE: CHARACTER QUESTION -> Center the post on a tough character decision, moral dilemma, or turning point.';
    case 'behind_the_film':
      return 'ANGLE: BEHIND THE FILM -> Focus on director/cinematographer/writer craft and visual language.';
    case 'credit_connection':
      return 'ANGLE: CREDIT CONNECTION -> Connect multiple films through a shared actor, director, or key crew member.';
    case 'audience_debate':
      return 'ANGLE: AUDIENCE DEBATE -> Ask a specific, thought-provoking opinion question grounded in the film.';
    case 'fun_relatable':
      return 'ANGLE: FUN & RELATABLE -> Conversational observation based on the premise or character dynamic. No forced slang.';
    case 'dynamic_story':
    default:
      return 'ANGLE: DYNAMIC STORY -> Lead with an intriguing narrative hook and premise progression.';
  }
}

/**
 * Builds prompt following strict MuviDB guidelines
 */
function buildMuviDBPrompt(req: AICopyRequest): string {
  const { candidate, series, angle = 'streaming_alert' } = req;
  const data = candidate.data || {};
  const isPerson = candidate.type === 'person';
  const seriesSlug = series?.slug || '';
  const seriesName = series?.name || 'African Cinema Spotlight';

  const title = candidate.name;
  const synopsis = data.synopsis || candidate.subtext || '';
  const tagline = data.tagline || '';
  const year = data.year ? `${data.year}` : '';
  const releaseDate = data.release_date || '';
  const releaseType = data.release_type || '';
  const lifecycle = data.lifecycle || (data.coming_soon ? 'upcoming' : 'unknown');
  const platform = data.platformDisplayName || (data.streaming_links?.prime_video ? 'Prime Video' : data.streaming_links?.netflix ? 'Netflix' : data.is_in_cinemas ? 'Cinemas Nationwide' : (releaseType || (lifecycle === 'upcoming' ? 'Not announced' : 'Streaming Platforms')));
  const isCinemas = data.is_in_cinemas || false;

  const topCastRows = Array.isArray(data.topCast) ? data.topCast : [];
  const directorRows = Array.isArray(data.directors) ? data.directors : [];
  const creditedRows = Array.isArray(data.creditedPeople) ? data.creditedPeople : [];
  const topCast = topCastRows.map((c: any) => `${c.name}${c.handle ? ` (${c.handle})` : ''}`).join(', ');
  const directors = directorRows.map((d: any) => `${d.name}${d.handle ? ` (${d.handle})` : ''}`).join(', ');
  const creditedPeople = creditedRows.map((credit: any) => `${credit.name} — ${credit.role || 'credit'} (${credit.handle})`).join(', ');
  const youtubeChannel = data.youtubeChannelName || '';
  const criticQuote = data.criticReview?.quote || data.quote || '';
  const criticName = data.criticReview?.criticName || data.criticName || '';
  const criticPub = data.criticReview?.publication || data.publication || '';
  const rating = data.criticReview?.rating || (data.liked_percent ? `${(data.liked_percent / 10).toFixed(1)}/10` : '');
  const knownFor = (data.knownFor || []).map((k: any) => `${k.title}${k.year ? ` (${k.year})` : ''}`).join(', ');
  const bio = data.bio || '';
  const venue = data.venue || '';

  const contentTypeRules = getContentTypeInstructions(seriesSlug, isPerson);
  const angleRules = getAngleInstructions(angle);
  const captionVault = selectCaptionBankStarters({ seriesSlug, candidate, limit: 8 });
  const captionVaultExamples = captionVault.starters.length
    ? captionVault.starters.map((starter, index) => `${index + 1}. ${starter}`).join('\n')
    : 'No fully verifiable starter is available for this candidate. Write directly from source data.';

  return `You are the social copywriter for MuviDB (muvidb.com), the definitive discovery database and publication for African Cinema.
You are NOT an influencer and you are NOT writing generic social media hype.

CORE RULES:
1. Lead with the most interesting or useful factual information.
2. NEVER write generic social media hype or cliché marketing sludge:
   - STRICTLY FORBIDDEN: "Are you ready?", "Are you seated?", "This one is a must-watch", "You don't want to miss this", "Grab your popcorn", "Drop a 🍿", "Who else is excited?", "Get ready", "Tag a friend", "Celebrating the incredible journey of...".
3. Do not invent excitement or drama. Let the real story, facts, or critical perspective create interest.
4. Do not invent plot facts, cast, release dates, streaming services, or credits not in SOURCE DATA.
5. Maximum 1-2 emoji (e.g. 📺, 🎬, 🎭, 📍, 📅).
6. Do not embed hashtags in the middle of sentences. Place 3-5 clean hashtags at the very bottom (#MuviDB #AfricanCinema #[Tag]).
7. Tone: Knowledgeable, curious, conversational, culturally aware. Write as MuviDB.

${contentTypeRules}

${angleRules}

APPROVED MUVIDB COPY VAULT STRUCTURES (${captionVault.category}):
${captionVaultExamples}

COPY VAULT RULES:
- Use at most one starter structure per variation and adapt it naturally; do not paste several together.
- Every value in these resolved starters came from the source candidate. Do not add a date, platform, metric, credit, quote, venue, or person that is absent from SOURCE DATA.
- The starters are openings and structures, not permission to change the verified lifecycle.

SOURCE DATA:
- TITLE / SUBJECT: ${title} ${year ? `(${year})` : ''}
- TYPE: ${isPerson ? 'Talent / Filmmaker' : 'Film / Stage'}
- SERIES CONTEXT: ${seriesName}
- PLATFORM / AVAILABILITY: ${platform} ${isCinemas ? '(In Cinemas)' : ''}
- YOUTUBE CHANNEL: ${youtubeChannel || 'N/A'}
- VERIFIED LIFECYCLE: ${lifecycle}
- RELEASE DATE: ${releaseDate}
- SYNOPSIS: ${synopsis}
- TAGLINE: ${tagline}
- CAST: ${topCast}
- DIRECTOR / CREW: ${directors}
- VERIFIED INSTAGRAM CREDIT TAGS: ${creditedPeople || 'N/A'}
- CRITIC DATA: ${criticQuote ? `"${criticQuote}" by ${criticName} (${criticPub}) [Rating: ${rating}]` : (rating ? `Rated ${rating} on MuviDB` : 'N/A')}
- KNOWN FOR / CREDITS: ${knownFor}
- BIO / CONTEXT: ${bio}
- VENUE / DATES: ${venue}

TASK:
Generate 3 DISTINCT copy variations:
- Variation A (Informative / Utility-First): Clean, factual, answers what & where immediately, credit clarity.
- Variation B (Editorial / Storytelling): Engaging premise hook, thematic depth, credit connection.
- Variation C (Conversational / Discussion): Direct thought-provoking question, cultural context, authentic discussion.

For EACH variation, provide tailored text for:
- "instagram": Full caption with clean formatting, every supplied verified cast/crew @handle, and 3-5 hashtags at the bottom.
- When YOUTUBE CHANNEL is supplied, name it in every platform's copy. Never replace it with generic "YouTube" wording.
- "threads": Punchy, conversation-first post strictly under 480 characters.
- "facebook": Engaging storytelling paragraph with watch info and community discussion question.
- "tiktok": Concise hook with key details and hashtags for video/slides.

OUTPUT FORMAT: Return ONLY a valid JSON object matching this schema without markdown code blocks outside:
{
  "variations": [
    {
      "key": "A",
      "label": "Informative",
      "captions": {
        "instagram": "...",
        "threads": "...",
        "facebook": "...",
        "tiktok": "..."
      }
    },
    {
      "key": "B",
      "label": "Editorial",
      "captions": {
        "instagram": "...",
        "threads": "...",
        "facebook": "...",
        "tiktok": "..."
      }
    },
    {
      "key": "C",
      "label": "Conversational",
      "captions": {
        "instagram": "...",
        "threads": "...",
        "facebook": "...",
        "tiktok": "..."
      }
    }
  ]
}`;
}

const COPY_LIMITS: Record<keyof PlatformCaptions, number> = {
  instagram: 2200,
  threads: 500,
  facebook: 2000,
  tiktok: 2200,
};

function verifiedInstagramHandles(data: any): string[] {
  const rows = Array.isArray(data?.creditedPeople) ? data.creditedPeople : [];
  const fallbackRows = [
    ...(Array.isArray(data?.topCast) ? data.topCast : []),
    ...(Array.isArray(data?.directors) ? data.directors : []),
  ];
  const seen = new Set<string>();
  const handles: string[] = [];

  for (const row of [...rows, ...fallbackRows]) {
    const raw = String(row?.handle || row?.instagramHandle || '').trim();
    if (!/^@[a-zA-Z0-9._]+$/.test(raw)) continue;
    const key = raw.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    handles.push(raw);
  }

  return handles;
}

function appendBeforeHashtags(text: string, additions: string[], limit: number): string {
  const cleanAdditions = additions.filter(Boolean);
  if (!cleanAdditions.length) return text.slice(0, limit).trim();

  const lines = String(text || '').trim().split('\n');
  const hashtagIndex = lines.findIndex(line => line.trim().startsWith('#'));
  const body = (hashtagIndex >= 0 ? lines.slice(0, hashtagIndex) : lines).join('\n').trim();
  const hashtags = (hashtagIndex >= 0 ? lines.slice(hashtagIndex) : []).join('\n').trim();
  const suffix = cleanAdditions.join('\n\n');
  const reserved = suffix.length + (hashtags ? hashtags.length + 2 : 0) + 2;
  const bodyLimit = Math.max(0, limit - reserved);
  const shortenedBody = body.length <= bodyLimit
    ? body
    : `${body.slice(0, Math.max(0, bodyLimit - 1)).replace(/\s+\S*$/, '').trim()}…`;
  return [shortenedBody, suffix, hashtags].filter(Boolean).join('\n\n').slice(0, limit).trim();
}

/** Enforce verified attribution even when the model or fallback omits it. */
function applyVerifiedMovieAttribution(req: AICopyRequest, variations: AICopyVariation[]): AICopyVariation[] {
  if (req.candidate?.type !== 'movie') return variations;
  const data = req.candidate.data || {};
  const channelName = String(data.youtubeChannelName || '').trim();
  const handles = verifiedInstagramHandles(data);

  return variations.map(variation => {
    const captions = { ...variation.captions };
    for (const platform of Object.keys(captions) as Array<keyof PlatformCaptions>) {
      const additions: string[] = [];
      if (channelName && !captions[platform].toLowerCase().includes(channelName.toLowerCase())) {
        additions.push(`Watch on YouTube via ${channelName}.`);
      }
      if (platform === 'instagram' && handles.length) {
        const missingHandles = handles.filter(handle => !captions.instagram.toLowerCase().includes(handle.toLowerCase()));
        if (missingHandles.length) additions.push(`Cast & crew: ${missingHandles.join(' ')}`);
      }
      captions[platform] = appendBeforeHashtags(captions[platform], additions, COPY_LIMITS[platform]);
    }
    return { ...variation, captions };
  });
}

/**
 * Clean fallback variations in case AI is unreachable
 */
function buildCleanFallbackVariations(req: AICopyRequest): AICopyVariation[] {
  const { candidate, series } = req;
  const data = candidate.data || {};
  const isPerson = candidate.type === 'person';
  const name = String(candidate.name || 'MuviDB feature');
  const year = data.year ? ` (${data.year})` : '';
  const platform = String(data.platformDisplayName || (data.streaming_links?.prime_video ? 'Prime Video' : data.streaming_links?.netflix ? 'Netflix' : 'Streaming Platforms'));
  const cleanTag = name.replace(/[^a-zA-Z0-9]/g, '');
  const synopsis = typeof data.synopsis === 'string'
    ? data.synopsis
    : (typeof candidate.subtext === 'string' ? candidate.subtext : '');

  if (data.lifecycle === 'upcoming' || data.coming_soon) {
    const releaseLine = data.release_date ? `Releases ${data.release_date}.` : 'Coming soon.';
    return [
      {
        key: 'A',
        label: 'Informative',
        captions: {
          instagram: `${name}${year} is upcoming.\n\n${releaseLine}${synopsis ? `\n\n${synopsis.slice(0, 180)}…` : ''}\n\nFollow the film on MuviDB for verified release information.\n\n#MuviDB #AfricanCinema #ComingSoon #${cleanTag}`,
          threads: `${name}${year} is coming soon. ${releaseLine} Follow its release details on MuviDB. #AfricanCinema`,
          facebook: `Upcoming release: ${name}${year}\n\n${releaseLine}${synopsis ? `\n\n${synopsis.slice(0, 200)}…` : ''}\n\nSee cast, crew and verified release information on MuviDB.`,
          tiktok: `${name} is coming soon. Track the release on MuviDB. #AfricanCinema #ComingSoon #${cleanTag}`,
        },
      },
      {
        key: 'B',
        label: 'Editorial',
        captions: {
          instagram: `${name}${year} is on the way.\n\n${synopsis ? `${synopsis.slice(0, 200)}…\n\n` : ''}${releaseLine}\n\nExplore the film and its credits on MuviDB.\n\n#MuviDB #AfricanCinema #ComingSoon #${cleanTag}`,
          threads: `${name} is an upcoming African film. ${releaseLine} What part of its story has your attention? #MuviDB`,
          facebook: `${name}${year} is upcoming. ${releaseLine}${synopsis ? `\n\n${synopsis.slice(0, 220)}…` : ''}\n\nExplore the project on MuviDB.`,
          tiktok: `Upcoming: ${name}. ${releaseLine} #MuviDB #ComingSoon #${cleanTag}`,
        },
      },
      {
        key: 'C',
        label: 'Conversational',
        captions: {
          instagram: `${name}${year} is coming soon.\n\n${synopsis ? `${synopsis.slice(0, 180)}…\n\n` : ''}What about this story has your attention?\n\n#MuviDB #AfricanCinema #ComingSoon #${cleanTag}`,
          threads: `${name} is coming soon. What about the story has your attention so far? #MuviDB #AfricanCinema`,
          facebook: `${name}${year} is an upcoming release. What are you most interested to learn about the film?\n\n${releaseLine}`,
          tiktok: `${name} is coming soon. What do you want to know about it? #MuviDB #${cleanTag}`,
        },
      },
    ];
  }

  if (isPerson) {
    const knownFor = Array.isArray(data.knownFor) ? data.knownFor : [];
    const known = knownFor.slice(0, 3).map((k: any) => `🎬 ${k.title}${k.year ? ` (${k.year})` : ''}`).join('\n');
    return [
      {
        key: 'A',
        label: 'Informative',
        captions: {
          instagram: `The Filmography: ${name} 🌟\n\nNotable credits across African cinema:\n${known || name}\n\nExplore the full verified credits on MuviDB.\n\n#MuviDB #AfricanCinema #${cleanTag}`,
          threads: `Exploring the filmography of ${name} on MuviDB. Which of their performances do you know best? #MuviDB #AfricanCinema`,
          facebook: `The Filmography: ${name}\n\nFrom standout performances to memorable roles, explore ${name}'s verified credits and filmography on MuviDB!`,
          tiktok: `Spotlight on ${name} 🌟 Discover their full filmography on MuviDB! #AfricanCinema #${cleanTag}`,
        },
      },
      {
        key: 'B',
        label: 'Editorial',
        captions: {
          instagram: `You may know ${name} from their acclaimed roles, but their work across African cinema goes deeper.\n\nKey credits include:\n${known}\n\nFollow their full filmography on MuviDB.\n\n#MuviDB #AfricanCinema #${cleanTag}`,
          threads: `You know ${name}, but how many of their films have you seen? Check out their full credit history on MuviDB. #AfricanCinema`,
          facebook: `You may know ${name} from recent roles, but their filmography spans several key African productions.\n\nExplore every film and every credit on MuviDB.`,
          tiktok: `One actor, multiple memorable roles. Explore ${name}'s filmography on MuviDB! #MuviDB #${cleanTag}`,
        },
      },
      {
        key: 'C',
        label: 'Conversational',
        captions: {
          instagram: `A great performance makes you remember the character long after the credits roll.\n\nWhat is your favorite ${name} role so far?\n\nExplore their full work on MuviDB.\n\n#MuviDB #AfricanCinema #${cleanTag}`,
          threads: `What is the first film that comes to mind when you think of ${name}? Let's talk in the replies! 👇 #MuviDB`,
          facebook: `Which performance made you a fan of ${name}? Share your favorite project below and explore their full credits on MuviDB.`,
          tiktok: `Favorite ${name} role of all time? Drop your pick below! 👇 #MuviDB #${cleanTag}`,
        },
      },
    ];
  }

  return [
    {
      key: 'A',
      label: 'Informative',
      captions: {
        instagram: `Now streaming: ${name}${year} 📺\n\nYou can currently watch ${name} on ${platform}.\n\n${synopsis ? `${synopsis.slice(0, 180)}…` : ''}\n\nFind more viewing information on MuviDB.\n\n#MuviDB #AfricanCinema #${cleanTag}`,
        threads: `${name}${year} is currently streaming on ${platform}. Have you seen it yet? Find more on MuviDB. #AfricanCinema`,
        facebook: `Streaming Alert: ${name}${year}\n\nAvailable to watch on ${platform}.\n\n${synopsis ? `${synopsis.slice(0, 200)}…` : ''}\n\nExplore cast, crew, and reviews on MuviDB.`,
        tiktok: `Now streaming: ${name} on ${platform} 📺 Check it out on MuviDB! #MuviDB #${cleanTag}`,
      },
    },
    {
      key: 'B',
      label: 'Editorial',
      captions: {
        instagram: `Looking for something to watch? Put ${name}${year} on your radar.\n\n${synopsis ? `${synopsis.slice(0, 200)}…` : ''}\n\nCurrently available on ${platform}.\n\nExplore full cast and crew details on MuviDB.\n\n#MuviDB #AfricanCinema #${cleanTag}`,
        threads: `Put ${name} on your watchlist. Currently streaming on ${platform}. Explore credits on MuviDB. #AfricanCinema`,
        facebook: `Looking for your next watch? ${name}${year} is available on ${platform}.\n\n${synopsis ? `${synopsis.slice(0, 220)}…` : ''}\n\nFind more African films on MuviDB.`,
        tiktok: `Looking for a compelling African film? ${name} is streaming on ${platform}. #MuviDB #${cleanTag}`,
      },
    },
    {
      key: 'C',
      label: 'Conversational',
      captions: {
        instagram: `Have you seen ${name}${year} yet, or is this going on your watchlist?\n\n${synopsis ? `${synopsis.slice(0, 180)}…` : ''}\n\nCurrently streaming on ${platform}.\n\nShare your thoughts and discover more on MuviDB.\n\n#MuviDB #AfricanCinema #${cleanTag}`,
        threads: `${name}: Currently streaming on ${platform}. If you've seen it, what did you think? 👇 #MuviDB #AfricanCinema`,
        facebook: `Have you watched ${name}${year} yet? It's currently available on ${platform}.\n\nLet us know your review and discover more on MuviDB!`,
        tiktok: `Have you watched ${name} on ${platform}? Drop your review below! 👇 #MuviDB #${cleanTag}`,
      },
    },
  ];
}

function applyCaptionBankToFallback(variations: AICopyVariation[], req: AICopyRequest): AICopyVariation[] {
  const { starters } = selectCaptionBankStarters({
    seriesSlug: req.series?.slug || '',
    candidate: req.candidate,
    limit: 3,
  });
  if (!starters.length) return variations;

  return variations.map((variation, index) => {
    const starter = starters[index % starters.length];
    const captions = Object.fromEntries(
      Object.entries(variation.captions).map(([platform, caption]) => {
        if (!caption || caption.toLowerCase().includes(starter.toLowerCase())) return [platform, caption];
        const combined = `${starter}\n\n${caption}`;
        return [platform, platform === 'threads' ? combined.slice(0, 480).trim() : combined];
      }),
    ) as PlatformCaptions;
    return { ...variation, captions };
  });
}

export function generateGroundedFallbackCaptions(req: AICopyRequest): AICopyVariation[] {
  return applyVerifiedMovieAttribution(req, applyCaptionBankToFallback(buildCleanFallbackVariations(req), req));
}

export function areGeneratedVariationsGrounded(req: AICopyRequest, variations: AICopyVariation[]): boolean {
  if (!variations.length) return false;
  const lifecycle = req.candidate?.data?.lifecycle;
  const seriesSlug = (req.series?.slug || '').toLowerCase();
  const platform = req.candidate?.data?.platformDisplayName;
  const youtubeChannelName = String(req.candidate?.data?.youtubeChannelName || '').trim();
  const requiredInstagramHandles = verifiedInstagramHandles(req.candidate?.data || {});
  const allCaptions = variations.flatMap(variation => Object.values(variation.captions));

  if (allCaptions.some(caption => /\[[^\]]+\]/.test(caption))) return false;
  if (lifecycle === 'upcoming' && allCaptions.some(caption => /\b(now streaming|currently streaming|available now|now showing|in cinemas now)\b/i.test(caption))) {
    return false;
  }
  if (lifecycle === 'now_streaming' && allCaptions.some(caption => /\b(coming soon|upcoming release|releases on)\b/i.test(caption))) {
    return false;
  }
  if (seriesSlug === 'where_to_watch' && platform) {
    const normalizedPlatform = String(platform).toLowerCase();
    if (allCaptions.some(caption => !caption.toLowerCase().includes(normalizedPlatform))) return false;
  }
  if (youtubeChannelName && allCaptions.some(caption => !caption.toLowerCase().includes(youtubeChannelName.toLowerCase()))) return false;
  if (requiredInstagramHandles.length && variations.some(variation => requiredInstagramHandles.some(handle => !variation.captions.instagram.toLowerCase().includes(handle.toLowerCase())))) return false;
  return true;
}

/**
 * Generates 3 intelligent, brand-aligned copy variations using Cohere / AI fallback
 */
export async function generateAICaptions(req: AICopyRequest): Promise<AICopyResponse> {
  const preferred = req.preferredProvider || 'cohere';

  try {
    const prompt = buildMuviDBPrompt(req);
    const aiRes = await withGenerationTimeout(
      generateAIContent(prompt, { preferredProvider: preferred }),
      25_000,
    );
    const parsed = parseJSON(aiRes.text);

    let variations: AICopyVariation[] = [];

    if (Array.isArray(parsed?.variations) && parsed.variations.length > 0) {
      variations = parsed.variations.map((v: any, i: number) => ({
        key: (v.key || ['A', 'B', 'C'][i] || 'A') as 'A' | 'B' | 'C',
        label: (v.label || ['Informative', 'Editorial', 'Conversational'][i] || 'Informative') as 'Informative' | 'Editorial' | 'Conversational',
        captions: {
          instagram: v.captions?.instagram || v.instagram || '',
          threads: v.captions?.threads || v.threads || '',
          facebook: v.captions?.facebook || v.facebook || '',
          tiktok: v.captions?.tiktok || v.tiktok || '',
        },
      }));
    } else if (parsed?.variationA || parsed?.variationB || parsed?.variationC) {
      const map = [
        { key: 'A' as const, label: 'Informative' as const, raw: parsed.variationA },
        { key: 'B' as const, label: 'Editorial' as const, raw: parsed.variationB },
        { key: 'C' as const, label: 'Conversational' as const, raw: parsed.variationC },
      ];
      variations = map.filter(m => m.raw).map(m => ({
        key: m.key,
        label: m.label,
        captions: {
          instagram: m.raw.instagram || '',
          threads: m.raw.threads || '',
          facebook: m.raw.facebook || '',
          tiktok: m.raw.tiktok || '',
        },
      }));
    } else if (parsed?.instagram || parsed?.threads) {
      variations = [
        {
          key: 'A',
          label: 'Informative',
          captions: {
            instagram: parsed.instagram || '',
            threads: parsed.threads || '',
            facebook: parsed.facebook || '',
            tiktok: parsed.tiktok || '',
          },
        },
      ];
    }

    variations = applyVerifiedMovieAttribution(req, variations);

    if (areGeneratedVariationsGrounded(req, variations)) {
      const primary = variations[0].captions;
      return {
        success: true,
        variations,
        selectedVariation: 'A',
        instagram: primary.instagram,
        threads: primary.threads,
        facebook: primary.facebook,
        tiktok: primary.tiktok,
        engine: aiRes.telemetry?.engine || 'cohere',
      };
    }
  } catch (err) {
    console.warn('[social_copy_ai] AI generation failed, using clean MuviDB fallbacks:', (err as Error)?.message);
  }

  const fallbackVars = generateGroundedFallbackCaptions(req);
  return {
    success: true,
    variations: fallbackVars,
    selectedVariation: 'A',
    instagram: fallbackVars[0].captions.instagram,
    threads: fallbackVars[0].captions.threads,
    facebook: fallbackVars[0].captions.facebook,
    tiktok: fallbackVars[0].captions.tiktok,
    engine: 'muvidb_clean_fallback',
  };
}
