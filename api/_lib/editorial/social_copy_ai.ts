import { generateAIContent, parseJSON } from '../ai_service.js';
import { namesOnlyCaption } from '../social-studio/content/names-only.js';

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
  | 'trivia_quiz'
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
  label: 'Career Story' | 'Why Now' | 'Discovery' | 'Informative' | 'Editorial' | 'Conversational' | string;
  captions: PlatformCaptions;
  graphic?: {
    eyebrow: string;
    headline: string;
    supportLine: string;
    contextLine: string;
    evidenceLine?: string;
  };
};

export type AICopyResponse = {
  success: boolean;
  reason?: string;
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
- The exact first line MUST be: "Now streaming on [verified platform or channel]."
- Put the film title and editorial body in the following paragraph.
- Then optionally use synopsis or cast details to give the reader a concrete reason to care.
- Do NOT call a film "new" unless explicitly indicated in data.
- Example structure:
  Now streaming on [Platform].

  [Film Title] [factual, spoiler-free reason to watch].
  Starring [selected cast names without @ handles].
  [1 factual sentence about the premise].
  Have you seen it already, or is this going on your watchlist?
  Find more places to watch on MuviDB.
  #MuviDB #AfricanCinema #[FilmTitle]`;
  }

  if (seriesSlug.includes('critic') || seriesSlug === 'critics_say' || seriesSlug === 'the_critic') {
    return `
CONTENT TYPE: THE CRITIC'S TAKE
Goal: Surface an exact, clearly attributed critical observation and send readers to its original source.
- Start with the supplied quote verbatim. Never paraphrase, shorten, combine, or improve text inside quotation marks.
- Attribute it to the critic and publication.
- Link readers to the critic/publication for the full review; never say the full review is on MuviDB.
- A rating may appear only when explicitly supplied and must never replace the critic's idea.
- Ask whether the audience agrees or disagrees with the take.`;
  }

  if (isPerson || seriesSlug.includes('behind') || seriesSlug === 'behind_the_camera' || seriesSlug.includes('filmography') || seriesSlug === 'you_know_the_face' || seriesSlug.includes('spotlight') || seriesSlug.includes('actor') || seriesSlug.includes('craft')) {
    return `
CONTENT TYPE: ACTOR / CRAFT SPOTLIGHT (TALENT PROFILE)
Goal: Document a creative career through verified database evidence.
Guiding philosophy: "IMDb gives you the credits; MuviDB helps you notice the career behind them."

EDITORIAL REQUIREMENTS:
1. Every caption must answer three questions:
   - Who is this person?
   - What pattern can we see in their work?
   - Why are they worth noticing now?
2. The PERSON, not the movie titles, must remain the primary subject of the story.
3. NEVER summarize or dump their complete filmography. Select at most 2–3 relevant titles as narrative evidence to explain a pattern, progression, recent momentum, collaboration, genre, role, or career moment.
4. STRICTLY BANNED CMS LANGUAGE: Do NOT write "Editing credit spotlight:", "The Filmography:", "Notable credits across African cinema:", or bulleted lists with emojis (e.g. "🎬 Title (Year)"). Output fluid, thoughtful editorial prose.
5. GROUNDED HONESTY: If a person has only a few credits (e.g. 3–6), do NOT invent fake hyperbole like "one of Nollywood's fastest-rising icons/directors". Frame it honestly as an early chapter or a creative record steadily taking shape and documented on MuviDB.
6. DETECT THE STORY ANGLE:
   - Breakthrough / Why Now: Connected to a recent/trending project that brought them into focus.
   - Momentum: Several credits in a short period (e.g. 2025–2026).
   - Early Career: Small but growing verified body of work.
   - Collaboration: Repeated work with a filmmaker, producer, or studio.
   - Franchise / Story World: Multiple related productions (e.g. sequels, connected films).
   - Behind the Camera: Spotlighting craft (directing, cinematography, editing, costume, sound).
   - Range: Meaningful movement between genres or craft departments.
   - Longevity: Career spanning many years.

THREE DISTINCT EDITORIAL VARIATIONS:
- Variation A · Career Story: Focus on the person's journey and progression. Trace a growing body of work across 2–3 chronological projects.
- Variation B · Why Now: Anchored in the project or context that triggered the spotlight (e.g., "You may have come across [Name] through [Recent Project]. But the credit doesn't end there...").
- Variation C · Discovery: Conversational, social-first radar hook (e.g., "One name you might want to remember: [Name]. 🎬 ... We're keeping track.").`;
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

/** A distinct editorial job for every recurring MuviDB series. */
function getSeriesStoryContract(seriesSlug: string): string {
  const slug = seriesSlug.toLowerCase().replace(/-/g, '_');
  const contracts: Record<string, string> = {
    behind_the_camera: `STORY CONTRACT — BEHIND THE CAMERA
- Subject: a specific creative decision or craft contribution, not a résumé.
- Story movement: name the maker → identify the work → explain what their craft changes for the audience.
- Graphic: maker's name + craft-led thesis. Credits belong only in a small evidence line.`,
    film_conversation: `STORY CONTRACT — FILM CONVERSATION
- Subject: one defensible tension, choice, theme, or unresolved question inside the film.
- Story movement: establish the dilemma → offer two credible readings → invite a specific opinion.
- Graphic: the question is the headline. Do not use “What did you think?” as the main idea.`,
    muvidb_by_the_numbers: `STORY CONTRACT — MUVIDB BY THE NUMBERS
- Subject: what a verified pattern reveals about African screen culture.
- Story movement: lead with the finding → explain the comparison/context → state why it matters.
- Graphic: a number may lead only here, but it must be paired with its meaning, scope, and timeframe.`,
    by_the_numbers: `STORY CONTRACT — MUVIDB BY THE NUMBERS
- Subject: what a verified pattern reveals about African screen culture.
- Story movement: lead with the finding → explain the comparison/context → state why it matters.
- Graphic: a number may lead only here, but it must be paired with its meaning, scope, and timeframe.`,
    new_and_upcoming: `STORY CONTRACT — NEW & UPCOMING
- Subject: the specific promise of an upcoming film, not generic anticipation.
- Story movement: title/release context → premise or creative reason to notice → verified date/status.
- Graphic: title and premise hook dominate; date/status is utility text, never the emotional headline.`,
    new_upcoming: `STORY CONTRACT — NEW & UPCOMING
- Subject: the specific promise of an upcoming film, not generic anticipation.
- Story movement: title/release context → premise or creative reason to notice → verified date/status.
- Graphic: title and premise hook dominate; date/status is utility text, never the emotional headline.`,
    one_film_two_takes: `STORY CONTRACT — ONE FILM, TWO TAKES
- Subject: a genuine critical disagreement about the same film.
- Story movement: shared point of reference → Take One → Take Two → precise audience question.
- Graphic: two short contrasting interpretations; never fabricate a second view when only one is supplied.`,
    stage_to_screen: `STORY CONTRACT — STAGE TO SCREEN
- Subject: what changes when a story crosses between theatre and film.
- Story movement: identify both versions → compare one meaningful adaptation choice → explain its effect.
- Graphic: transformation or contrast is the headline; “stage and film” is only a label.`,
    the_critic: `STORY CONTRACT — THE CRITIC
- Subject: the critic's way of seeing cinema, not their follower count or review total.
- Story movement: introduce the critical voice → identify a recurring lens or concern → show it through one verified review.
- Graphic: critic's name + critical perspective. Metrics are supporting evidence only.`,
    critic_spotlight: `STORY CONTRACT — THE CRITIC
- Subject: the critic's way of seeing cinema, not their follower count or review total.
- Story movement: introduce the critical voice → identify a recurring lens or concern → show it through one verified review.
- Graphic: critic's name + critical perspective. Metrics are supporting evidence only.`,
    filmography: `STORY CONTRACT — THE FILMOGRAPHY
- Subject: the shape, progression, range, or longevity of a career.
- Story movement: human career thesis → 2–3 representative works as evidence → why the body of work matters.
- Graphic: person's name + career thesis + roles. Credit count is tiny evidence, never the headline.`,
    weekend_watchlist: `STORY CONTRACT — WEEKEND WATCHLIST
- Subject: why this film suits a particular weekend mood or viewer.
- Story movement: viewing mood → spoiler-free premise → where to watch → taste-based question.
- Graphic: title + one specific viewing promise; availability remains secondary utility text.`,
    critics_say: `STORY CONTRACT — THE CRITIC'S TAKE
- Subject: one exact, clearly attributed critical claim about the film.
- Story movement: verbatim quote → source attribution → outbound full-review direction → agree/disagree question.
- Graphic: the verified quote + attribution. Never paraphrase it and never make the rating the headline.`,
    whats_on_stage: `STORY CONTRACT — WHAT'S ON STAGE
- Subject: why the live production is worth leaving home for.
- Story movement: dramatic premise or theatrical draw → venue/date utility → audience invitation.
- Graphic: production title + live-experience hook; venue and dates are compact supporting details.`,
    on_stage: `STORY CONTRACT — WHAT'S ON STAGE
- Subject: why the live production is worth leaving home for.
- Story movement: dramatic premise or theatrical draw → venue/date utility → audience invitation.
- Graphic: production title + live-experience hook; venue and dates are compact supporting details.`,
    where_to_watch: `STORY CONTRACT — WHERE TO WATCH
- Subject: useful discovery with a reason to press play.
- Story movement: title + exact verified destination → spoiler-free reason to watch → availability caveat if needed.
- Graphic: film title and platform are immediately legible; the premise hook prevents it becoming a directory listing.`,
    you_know_the_face: `STORY CONTRACT — YOU KNOW THE FACE
- Subject: recognition—connecting a familiar face to the roles and projects audiences remember.
- Story movement: recognition hook → 2–3 carefully chosen credits → reveal/name the performer → invite memory.
- Graphic: face and name dominate; do not lead with a credit count or generic “actor spotlight”.`,
  };
  return contracts[slug] || `STORY CONTRACT — EDITORIAL FEATURE
- Find one human, cultural, critical, or craft-led idea in the verified facts.
- Build a beginning, development, and payoff around that idea.
- Metadata supports the story; it is not the story.`;
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
    case 'trivia_quiz':
      return 'ANGLE: TRIVIA & QUIZ POLL -> Create an engaging, verified Nollywood trivia question with 4 multiple choice options (A, B, C, D) and ask the audience to guess in the comments.';
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
  const isPerson = candidate.type === 'person' || candidate.type === 'critic';
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
  const storyContract = getSeriesStoryContract(seriesSlug);
  const angleRules = getAngleInstructions(angle);
  const captionVault = selectCaptionBankStarters({ seriesSlug, candidate, limit: 3 });
  const captionVaultExamples = captionVault.starters.length
    ? captionVault.starters.map((starter, index) => `${index + 1}. ${starter}`).join('\n')
    : 'No fully verifiable starter is available for this candidate. Write directly from source data.';

  const whyNow = data.why_now || data.whyNow || (req.candidate as any)?.assessment?.whyNow || '';
  const primaryCraft = data.primary_craft || data.known_for_department || data.department || data.role || (seriesSlug.includes('crew') ? 'Crew / Behind the Camera' : 'Actor / Performer');
  const country = data.country || data.nationality || 'African cinema';
  const verifiedCreditCount = data.film_count || data.verified_credits_count || (Array.isArray(data.knownFor) ? data.knownFor.length : 'Multiple verified credits');
  const recentProject = data.recent_project || data.spotlight_project || (Array.isArray(data.knownFor) && data.knownFor[0]?.title) || '';

  const personSection = isPerson ? `
STRUCTURED TALENT & CAREER DATA:
- PERSON NAME: ${title}
- PRIMARY CRAFT / ROLE: ${primaryCraft}
- COUNTRY / REGION: ${country}
- VERIFIED CREDIT COUNT: ${verifiedCreditCount}
- REASON FOR SPOTLIGHT / WHY NOW: ${whyNow || 'Documenting verified creative work on MuviDB'}
- RECENT / NOTABLE CREDITS (select 2–3 maximum as narrative evidence): ${knownFor || 'N/A'}
- BIO / CONTEXT: ${bio || 'N/A'}
` : '';

  const taskInstructions = isPerson
    ? `TASK:
Generate 3 DISTINCT editorial copy variations for ${title}:
- Variation A (Career Story): Focus on the creative journey and progression. Hook the reader on a career taking shape, weave at most 2–3 chronological credits into the prose as narrative evidence, and frame every film as adding another piece to their verified record on MuviDB.
- Variation B (Why Now): Grounded in the recent project (${recentProject || 'their recent work'}) or the reason they are surfacing right now. Use that project as the entry point, acknowledge their broader verified credits, and emphasize that MuviDB is documenting the journey as it develops.
- Variation C (Discovery): Conversational radar hook ("One name you might want to remember: ${title}..."). Highlight the satisfaction of seeing verified credits add up and encourage the audience to discover their complete profile on MuviDB.`
    : `TASK:
Generate 3 DISTINCT copy variations:
- Variation A (Informative / Utility-First): Clean, factual, answers what & where immediately, credit clarity.
- Variation B (Editorial / Storytelling): Engaging premise hook, thematic depth, credit connection.
- Variation C (Conversational / Discussion): Direct thought-provoking question, cultural context, authentic discussion.`;

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

${storyContract}

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
- VERIFIED CAST & CREW: ${topCast || 'N/A'}
- CRITIC DATA: ${criticQuote ? `"${criticQuote}" by ${criticName} (${criticPub}) [Rating: ${rating}]` : (rating ? `Rated ${rating} on MuviDB` : 'N/A')}
- KNOWN FOR / CREDITS: ${knownFor}
- BIO / CONTEXT: ${bio}
- VENUE / DATES: ${venue}
${personSection}

${taskInstructions}

For EACH variation, provide tailored text for:
- "instagram": Full caption with clean formatting, listing cast/crew names cleanly without @ handles (e.g. Starring: Name 1, Name 2), and 3-5 hashtags at the bottom.
- When YOUTUBE CHANNEL is supplied, name it in every platform's copy. Never replace it with generic "YouTube" wording.
- "threads": Punchy, conversation-first post strictly under 480 characters.
- "facebook": Engaging storytelling paragraph with watch info and community discussion question.
- "tiktok": Concise hook with key details and hashtags for video/slides.
- "graphic": The exact concise on-image hierarchy. The headline must carry the editorial idea, not merely repeat a number, date, rating, platform, job title, or credit count.

OUTPUT FORMAT: Return ONLY a valid JSON object matching this schema without markdown code blocks outside:
{
  "variations": [
    {
      "key": "A",
      "label": "${isPerson ? 'Career Story' : 'Informative'}",
      "captions": {
        "instagram": "...",
        "threads": "...",
        "facebook": "...",
        "tiktok": "..."
      },
      "graphic": { "eyebrow": "...", "headline": "...", "supportLine": "...", "contextLine": "...", "evidenceLine": "..." }
    },
    {
      "key": "B",
      "label": "${isPerson ? 'Why Now' : 'Editorial'}",
      "captions": {
        "instagram": "...",
        "threads": "...",
        "facebook": "...",
        "tiktok": "..."
      },
      "graphic": { "eyebrow": "...", "headline": "...", "supportLine": "...", "contextLine": "...", "evidenceLine": "..." }
    },
    {
      "key": "C",
      "label": "${isPerson ? 'Discovery' : 'Conversational'}",
      "captions": {
        "instagram": "...",
        "threads": "...",
        "facebook": "...",
        "tiktok": "..."
      },
      "graphic": { "eyebrow": "...", "headline": "...", "supportLine": "...", "contextLine": "...", "evidenceLine": "..." }
    }
  ]
}`;
}

function parseVariations(parsed: any, defaultLabels: string[]): AICopyVariation[] {
  if (Array.isArray(parsed?.variations) && parsed.variations.length > 0) {
    return parsed.variations.map((v: any, i: number) => ({
      key: (v.key || ['A', 'B', 'C'][i] || 'A') as 'A' | 'B' | 'C',
      label: String(v.label || defaultLabels[i] || defaultLabels[0]),
      captions: {
        instagram: v.captions?.instagram || v.instagram || '',
        threads: v.captions?.threads || v.threads || '',
        facebook: v.captions?.facebook || v.facebook || '',
        tiktok: v.captions?.tiktok || v.tiktok || '',
      },
      graphic: v.graphic ? {
        eyebrow: String(v.graphic.eyebrow || ''),
        headline: String(v.graphic.headline || ''),
        supportLine: String(v.graphic.supportLine || ''),
        contextLine: String(v.graphic.contextLine || ''),
        evidenceLine: v.graphic.evidenceLine ? String(v.graphic.evidenceLine) : undefined,
      } : undefined,
    }));
  }

  if (parsed?.variationA || parsed?.variationB || parsed?.variationC) {
    const map = [
      { key: 'A' as const, label: defaultLabels[0], raw: parsed.variationA },
      { key: 'B' as const, label: defaultLabels[1], raw: parsed.variationB },
      { key: 'C' as const, label: defaultLabels[2], raw: parsed.variationC },
    ];
    return map.filter(m => m.raw).map(m => ({
      key: m.key,
      label: m.label,
      captions: {
        instagram: m.raw.instagram || '',
        threads: m.raw.threads || '',
        facebook: m.raw.facebook || '',
        tiktok: m.raw.tiktok || '',
      },
      graphic: m.raw.graphic,
    }));
  }

  if (parsed?.instagram || parsed?.threads) {
    return [{
      key: 'A',
      label: defaultLabels[0],
      captions: {
        instagram: parsed.instagram || '',
        threads: parsed.threads || '',
        facebook: parsed.facebook || '',
        tiktok: parsed.tiktok || '',
      },
      graphic: parsed.graphic,
    }];
  }
  return [];
}

function buildGeminiEditorialReviewPrompt(req: AICopyRequest, cohereDraft: AICopyVariation[]): string {
  const seriesSlug = req.series?.slug || '';
  return `You are the senior editor at MuviDB. Cohere has submitted first drafts. Edit them; do not merely score them.

${getSeriesStoryContract(seriesSlug)}

NON-NEGOTIABLE EDIT:
1. Use only facts present in SOURCE CANDIDATE. Delete every unsupported claim.
2. The story must be a human, creative, cultural, critical, thematic, or utility-led idea—not a database row rewritten as prose.
3. A number, rating, credit count, release date, platform, venue, or job title may lead only when the series contract explicitly requires it. Otherwise demote it to evidence or utility text.
4. Reject generic openings, empty praise, promotional hype, résumé dumps, synopsis dumps, and questions that could apply to any film.
5. Every Instagram/Facebook draft needs a clear hook, developed observation, MuviDB discovery CTA, and a specific answerable question.
6. Keep platform versions genuinely adapted. Preserve lifecycle and availability exactly.
7. On-graphic copy must be concise: eyebrow, editorial headline, one support line, one context line, optional evidence line.
8. For The Filmography, model the hierarchy as: PERSON NAME → career thesis → roles → quiet documented-credit evidence.
9. Keep each Instagram caption under 180 words, Facebook under 140 words, Threads under 350 characters, and TikTok under 220 characters. Keep graphic headlines under 9 words.

SOURCE CANDIDATE:
${JSON.stringify(req.candidate)}

SERIES:
${JSON.stringify(req.series || {})}

COHERE DRAFTS:
${JSON.stringify(cohereDraft)}

Return ONLY valid JSON:
{
  "variations": [
    {
      "key": "A|B|C",
      "label": "...",
      "captions": { "instagram": "...", "threads": "...", "facebook": "...", "tiktok": "..." },
      "graphic": { "eyebrow": "...", "headline": "...", "supportLine": "...", "contextLine": "...", "evidenceLine": "..." }
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
  const data = req.candidate.data || {};
  const channelName = String(data.youtubeChannelName || '').trim();
  const seriesSlug = String(req.series?.slug || '').toLowerCase().replace(/-/g, '_');
  const destination = channelName || String(data.platformDisplayName || '').trim();

  return variations.map(variation => {
    const captions = { ...variation.captions };
    for (const platform of Object.keys(captions) as Array<keyof PlatformCaptions>) {
      const additions: string[] = [];
      captions[platform] = namesOnlyCaption(captions[platform], data);
      if (seriesSlug === 'where_to_watch' && destination) {
        const firstLine = `Now streaming on ${destination}.`;
        captions[platform] = `${firstLine}\n\n${captions[platform]
          .replace(/^Now streaming[^\n]*\n*/i, '')
          .replace(/^Looking for something to watch\?\s*/i, '')
          .trim()}`;
      }
      if (channelName && !captions[platform].toLowerCase().includes(channelName.toLowerCase())) {
        additions.push(`Watch on YouTube via ${channelName}.`);
      }
      const castNames = Array.isArray(data.topCast)
        ? data.topCast.slice(0, 4).map((c: any) => typeof c === 'string' ? c : c?.name).filter(Boolean)
        : [];
      if (castNames.length && !captions[platform].toLowerCase().includes('starring:') && !captions[platform].toLowerCase().includes('starring')) {
        additions.push(`Starring: ${castNames.join(', ')}`);
      }
      const crewNames = Array.isArray(data.creditedPeople)
        ? data.creditedPeople.filter((c: any) => c?.role && c.role !== 'actor' && c.name).map((c: any) => c.name)
        : [];
      if (crewNames.length && !captions[platform].includes('Crew:')) additions.push(`Crew: ${[...new Set(crewNames)].join(', ')}`);
      captions[platform] = appendBeforeHashtags(captions[platform], additions, COPY_LIMITS[platform]);
    }
    return { ...variation, captions };
  });
}

function buildCriticTakeVariations(req: AICopyRequest): AICopyVariation[] {
  const data = req.candidate.data || {};
  const review = data.criticReview || data;
  const quote = String(review.quote || '').trim().replace(/^[“"]|[”"]$/g, '');
  const critic = String(review.criticName || review.critic_name || 'The critic').trim();
  const publication = String(review.publication || '').trim();
  const handle = String(review.socialHandle || review.social_handle || '').trim();
  const reviewType = String(review.reviewType || review.review_type || 'article');
  const source = handle || publication || critic;
  const action = reviewType === 'video' ? 'Watch' : 'Read';
  const title = String(req.candidate.name || data.title || 'the film').trim();
  const cleanTag = title.replace(/[^a-zA-Z0-9]/g, '');
  const attribution = [critic, publication && publication !== critic ? publication : ''].filter(Boolean).join(', ');
  const body = `“${quote}”\n\nThat’s one of the standout observations from ${attribution}’s review of ${title}. We pulled this line because it raises an interesting question about the film, but there’s more to the critic’s argument.\n\n${action} the full review on ${source}.\n\nAgree or disagree with this take?`;
  const captions: PlatformCaptions = {
    instagram: `${body}\n\n#MuviDB #AfricanCinema #FilmCriticism #${cleanTag}`,
    threads: body,
    facebook: body,
    tiktok: `${body}\n\n#MuviDB #FilmTok #${cleanTag}`,
  };
  const labels = ['Informative', 'Editorial', 'Conversational'];
  return (['A', 'B', 'C'] as const).map((key, index) => ({
    key,
    label: labels[index],
    captions: { ...captions },
    graphic: {
      eyebrow: 'THE CRITIC’S TAKE',
      headline: quote,
      supportLine: critic,
      contextLine: publication || 'Film Critic',
      evidenceLine: `FULL REVIEW → ${source}`,
    },
  }));
}

/**
 * Generates grounded, editorial story variations for Actor/Craft Spotlights
 * when AI is unavailable. Follows the 3 distinct storytelling angles:
 * Option A · Career Story (journey & progression)
 * Option B · Why Now (catalyst project hook)
 * Option C · Discovery (conversational social radar)
 */
function buildPersonStoryFallbackVariations(req: AICopyRequest): AICopyVariation[] {
  const { candidate } = req;
  const data = candidate.data || {};
  const name = String(candidate.name || 'This creator').trim();
  const cleanTag = name.replace(/[^a-zA-Z0-9]/g, '');
  const rawCount = Number(data.film_count || data.verified_credits_count || 0);
  const knownFor: Array<{ title: string; year?: number }> = Array.isArray(data.knownFor) ? data.knownFor : [];
  const creditCount = rawCount || knownFor.length || 0;
  const countStr = creditCount > 0
    ? `${creditCount} verified credit${creditCount === 1 ? '' : 's'}`
    : 'verified credits';

  // Find recent / trigger project
  const whyNowText = String(data.why_now || data.whyNow || (candidate as any)?.assessment?.whyNow || '');
  const whyNowMatch = whyNowText.match(/project\s+([^,.]+)/i);
  const recentProject = whyNowMatch ? whyNowMatch[1].trim() : (knownFor[0]?.title || 'recent productions');

  // Select 2-3 representative titles as evidence
  const titles = knownFor.slice(0, 3);
  let progressionSentence = '';
  let titlesListSentence = '';
  let remainingSentence = '';

  if (titles.length >= 3) {
    const t0 = `${titles[0].title}${titles[0].year ? ` in ${titles[0].year}` : ''}`;
    const t1 = titles[1].title;
    const t2 = `${titles[2].title}${titles[2].year ? ` in ${titles[2].year}` : ''}`;
    progressionSentence = `From ${t0} to ${t1} and ${t2}, their recent work shows a creative career that is steadily taking shape.`;
    titlesListSentence = `${titles[0].title}, ${titles[1].title} and ${titles[2].title}`;
    remainingSentence = `${titles[1].title} and ${titles[2].title}`;
  } else if (titles.length === 2) {
    const t0 = `${titles[0].title}${titles[0].year ? ` in ${titles[0].year}` : ''}`;
    const t1 = `${titles[1].title}${titles[1].year ? ` in ${titles[1].year}` : ''}`;
    progressionSentence = `From ${t0} to ${t1}, their work traces a creative career that is steadily taking shape.`;
    titlesListSentence = `${titles[0].title} and ${titles[1].title}`;
    remainingSentence = titles[1].title;
  } else if (titles.length === 1) {
    const t0 = `${titles[0].title}${titles[0].year ? ` in ${titles[0].year}` : ''}`;
    progressionSentence = `Anchored by work on ${t0}, their credits trace a creative career that is steadily taking shape.`;
    titlesListSentence = titles[0].title;
    remainingSentence = titles[0].title;
  } else {
    progressionSentence = `Their verified credits trace a creative career that is steadily taking shape across African cinema.`;
    titlesListSentence = 'their latest productions';
    remainingSentence = 'their recent productions';
  }

  return [
    {
      key: 'A',
      label: 'Career Story',
      captions: {
        instagram: `${name} is building their credits one project at a time. 🎬\n\n${progressionSentence}\n\nWith ${countStr} currently documented on MuviDB, every film adds another piece to the record.\n\nDiscover ${name}'s credits and the productions they have worked on at MuviDB.\n\n#MuviDB #AfricanCinema #${cleanTag}`,
        threads: `${name} is building credits one project at a time. ${progressionSentence} Explore their verified body of work on MuviDB. #AfricanCinema`,
        facebook: `A creative career taking shape.\n\n${name}'s recent work traces a growing body of work across African cinema. ${progressionSentence}\n\nWith ${countStr} currently documented on MuviDB, every film adds another piece to the record.\n\nExplore their growing body of work on MuviDB.`,
        tiktok: `${name} is building credits one project at a time 🎬 Follow their journey on MuviDB! #MuviDB #AfricanCinema #${cleanTag}`,
      },
    },
    {
      key: 'B',
      label: 'Why Now',
      captions: {
        instagram: `You may have come across ${name} through ${recentProject}. But the credit doesn't end there.\n\nTheir work now spans several productions documented on MuviDB, including ${remainingSentence}.\n\nBehind every title is a growing creative record, and we're documenting that journey as it develops.\n\nSee ${name}'s verified credits on MuviDB.\n\n#MuviDB #AfricanCinema #${cleanTag}`,
        threads: `You may have come across ${name} through ${recentProject}, but the credit doesn't end there. Explore their verified credits and productions on MuviDB. #AfricanCinema`,
        facebook: `You may have come across ${name} through ${recentProject}, but their creative record goes deeper.\n\nTheir work spans several productions documented on MuviDB, including ${remainingSentence}.\n\nBehind every title is a growing creative record, and we're documenting that journey as it develops. See ${name}'s verified credits on MuviDB.`,
        tiktok: `You know ${name} from ${recentProject}, but the credits don't stop there. Explore their verified profile on MuviDB! #MuviDB #${cleanTag}`,
      },
    },
    {
      key: 'C',
      label: 'Discovery',
      captions: {
        instagram: `One name you might want to remember: ${name}. 🎬\n\nTheir credits include ${titlesListSentence}, with ${countStr} currently connected to their MuviDB profile.\n\nSome careers are easier to appreciate when you can actually see the work adding up.\n\nWe're keeping track.\n\nDiscover their profile on MuviDB.\n\n#MuviDB #AfricanCinema #${cleanTag}`,
        threads: `One name you might want to remember: ${name}. 🎬 With credits including ${titlesListSentence}, see their work adding up on MuviDB. #AfricanCinema`,
        facebook: `One name you might want to remember: ${name}.\n\nWith verified credits including ${titlesListSentence}, their creative record is actively taking shape. Explore their profile on MuviDB.`,
        tiktok: `One name you might want to remember: ${name} 🎬 See their verified credits on MuviDB! #MuviDB #${cleanTag}`,
      },
    },
  ];
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

  const isPlay = candidate.type === 'play' || (series?.slug || '').includes('stage') || (series?.slug || '').includes('theatre');

  if (isPlay) {
    const venue = String(data.venue || [data.venue, data.city].filter(Boolean).join(', ') || 'Theatre venue TBA');
    const dateStr = data.run_start_date && data.run_end_date && data.run_start_date !== data.run_end_date
      ? `${data.run_start_date} – ${data.run_end_date}`
      : (data.run_start_date || data.run_end_date || data.date || (data.year ? String(data.year) : 'Dates TBA'));
    const timeStr = data.performance_time || data.time || '';

    return [
      {
        key: 'A',
        label: 'Informative',
        captions: {
          instagram: `On stage: ${name} 🎭\n\n📍 ${venue}\n📅 ${dateStr}${timeStr ? `\n⏰ ${timeStr}` : ''}\n\n${synopsis ? `${synopsis.slice(0, 180)}…\n\n` : ''}Find full cast, crew, and stage production details on MuviDB.\n\n#MuviDB #AfricanTheatre #LiveTheatre #${cleanTag}`,
          threads: `Live on stage: ${name} at ${venue} (${dateStr}). Save the date and discover the production on MuviDB. #AfricanTheatre`,
          facebook: `What's On Stage: ${name}\n\n📍 Venue: ${venue}\n📅 Dates: ${dateStr}\n\n${synopsis ? `${synopsis.slice(0, 200)}…\n\n` : ''}Explore live African theatre on MuviDB.`,
          tiktok: `On stage now: ${name} at ${venue} 🎭 Find dates & details on MuviDB! #MuviDB #AfricanTheatre #${cleanTag}`,
        },
      },
      {
        key: 'B',
        label: 'Editorial',
        captions: {
          instagram: `Looking for live theatre this week? Put ${name} on your radar.\n\n${synopsis ? `${synopsis.slice(0, 200)}…\n\n` : ''}📍 ${venue}\n📅 ${dateStr}\n\nExplore full stage credits and dates on MuviDB.\n\n#MuviDB #AfricanTheatre #StagePlay #${cleanTag}`,
          threads: `Put ${name} on your radar. Live on stage at ${venue} (${dateStr}). Explore credits on MuviDB. #AfricanTheatre`,
          facebook: `Spotlight on Live Theatre: ${name}\n\n${synopsis ? `${synopsis.slice(0, 220)}…\n\n` : ''}Catch it live at ${venue} (${dateStr}). Find more on MuviDB.`,
          tiktok: `If live African theatre is on your radar, don't miss ${name} at ${venue}. #MuviDB #AfricanTheatre #${cleanTag}`,
        },
      },
      {
        key: 'C',
        label: 'Conversational',
        captions: {
          instagram: `Are you catching any live theatre soon? ${name} is taking the stage.\n\n${synopsis ? `${synopsis.slice(0, 180)}…\n\n` : ''}📍 ${venue}\n📅 ${dateStr}\n\nPlan your visit and explore more stage productions on MuviDB.\n\n#MuviDB #AfricanTheatre #StagePlay #${cleanTag}`,
          threads: `Are you seeing any stage plays this month? ${name} is live at ${venue} (${dateStr}). Let us know if you're attending! 👇 #AfricanTheatre`,
          facebook: `Have you planned your next theatre night? ${name} is live at ${venue} (${dateStr}).\n\nDiscover the cast and crew on MuviDB!`,
          tiktok: `Who's pulling up for ${name} at ${venue}? Drop a 🎭 below! #MuviDB #AfricanTheatre #${cleanTag}`,
        },
      },
    ];
  }

  if (isPerson) {
    return buildPersonStoryFallbackVariations(req);
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
  if (req.candidate?.type === 'person') {
    // For person profiles, the variations already have complete, bespoke editorial story hooks.
    // Prepending a generic starter creates disjointed, duplicate text.
    return variations;
  }
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
  const allCaptions = variations.flatMap(variation => Object.values(variation.captions));

  if (allCaptions.some(caption => /\[[^\]]+\]/.test(caption))) return false;
  if (req.candidate?.type === 'person') {
    if (allCaptions.some(caption => /\b(the filmography:|editing credit spotlight:|notable credits across)\b/i.test(caption))) {
      return false;
    }
  }
  if (lifecycle === 'upcoming' && allCaptions.some(caption => /\b(now streaming|currently streaming|available now|now showing|in cinemas now)\b/i.test(caption))) {
    return false;
  }
  if (lifecycle === 'now_streaming' && allCaptions.some(caption => /\b(coming soon|upcoming release|releases on)\b/i.test(caption))) {
    return false;
  }
  const isPlay = req.candidate?.type === 'play' || seriesSlug.includes('stage') || seriesSlug.includes('theatre');
  if (isPlay && allCaptions.some(caption => /\b(streaming|stream on|now streaming|currently streaming|available on streaming)\b/i.test(caption))) {
    return false;
  }
  if (seriesSlug === 'where_to_watch' && platform) {
    const normalizedPlatform = String(platform).toLowerCase();
    if (allCaptions.some(caption => !caption.toLowerCase().includes(normalizedPlatform))) return false;
  }
  if (youtubeChannelName && allCaptions.some(caption => !caption.toLowerCase().includes(youtubeChannelName.toLowerCase()))) return false;
  if (seriesSlug !== 'critics_say' && allCaptions.some(caption => /(^|\s)@[a-zA-Z0-9._]+/.test(caption))) return false;
  return true;
}

/**
 * Generates 3 intelligent, brand-aligned copy variations using Cohere / AI fallback
 */
export async function generateAICaptions(req: AICopyRequest): Promise<AICopyResponse> {
  const seriesSlug = String(req.series?.slug || '').toLowerCase().replace(/-/g, '_');
  const data = req.candidate?.data || {};
  if (seriesSlug === 'critics_say') {
    const quote = String(data?.criticReview?.quote || data?.quote || '').trim();
    if (!quote) {
      return { success: false, reason: 'The Critic’s Take requires a verified verbatim review excerpt.', variations: [], selectedVariation: 'A', instagram: '', threads: '', facebook: '', tiktok: '', engine: 'muvidb_exact_quote_guard' };
    }
    const variations = buildCriticTakeVariations(req);
    const primary = variations[1].captions;
    return { success: true, variations, selectedVariation: 'B', ...primary, engine: 'muvidb_exact_quote_template' };
  }
  if (seriesSlug === 'one_film_two_takes' && (!Array.isArray(data.criticReviews) || data.criticReviews.length < 2)) {
    return {
      success: false,
      reason: 'One Film, Two Takes requires two distinct verified reviews or audience perspectives.',
      variations: [], selectedVariation: 'A', instagram: '', threads: '', facebook: '', tiktok: '',
      engine: 'muvidb_editorial_guard',
    };
  }
  if (seriesSlug === 'stage_to_screen' && !(data.stageVersion && data.screenVersion)) {
    return {
      success: false,
      reason: 'Stage To Screen requires a verified relationship between a stage production and a screen adaptation.',
      variations: [], selectedVariation: 'A', instagram: '', threads: '', facebook: '', tiktok: '',
      engine: 'muvidb_editorial_guard',
    };
  }

  const isPerson = req.candidate?.type === 'person' || req.candidate?.type === 'critic';
  const defaultLabels = isPerson
    ? ['Career Story', 'Why Now', 'Discovery']
    : ['Informative', 'Editorial', 'Conversational'];

  try {
    const prompt = buildMuviDBPrompt(req);
    // Pass 1 — Cohere is the writer. strictProvider prevents the generic AI
    // fallback pool from silently replacing it and breaking the requested order.
    const cohereRes = await withGenerationTimeout(
      generateAIContent(prompt, { preferredProvider: 'cohere', strictProvider: true }),
      120_000,
    );
    const cohereDraft = parseVariations(parseJSON(cohereRes.text), defaultLabels);
    if (!cohereDraft.length) throw new Error('Cohere returned no usable editorial variations');

    // Pass 2 — Gemini is the editor. It receives the verified source and the
    // Cohere draft, then returns publishable copy plus explicit graphic copy.
    let variations: AICopyVariation[] = [];
    let engine = `${cohereRes.telemetry?.engine || 'cohere'} → gemini`;
    try {
      const reviewPrompt = buildGeminiEditorialReviewPrompt(req, cohereDraft);
      const geminiRes = await withGenerationTimeout(
        generateAIContent(reviewPrompt, { preferredProvider: 'gemini', strictProvider: true }),
        120_000,
      );
      variations = parseVariations(parseJSON(geminiRes.text), defaultLabels);
      engine = `${cohereRes.telemetry?.engine || 'cohere'} → ${geminiRes.telemetry?.engine || 'gemini'}`;
    } catch (reviewErr) {
      console.warn('[social_copy_ai] Gemini editorial pass failed; retaining grounded Cohere draft:', (reviewErr as Error)?.message);
      variations = cohereDraft;
      engine = `${cohereRes.telemetry?.engine || 'cohere'} → gemini_unavailable`;
    }

    variations = applyVerifiedMovieAttribution(req, variations);
    if (areGeneratedVariationsGrounded(req, variations)) {
      // Default to Variation B (Editorial) if present, else first variation
      const editorialVar = variations.find(v => v.key === 'B') || variations[0];
      const primary = editorialVar.captions;
      return {
        success: true,
        variations,
        selectedVariation: editorialVar.key,
        instagram: primary.instagram,
        threads: primary.threads,
        facebook: primary.facebook,
        tiktok: primary.tiktok,
        engine,
      };
    }
  } catch (err) {
    console.warn('[social_copy_ai] AI generation failed, using clean MuviDB fallbacks:', (err as Error)?.message);
  }

  const fallbackVars = generateGroundedFallbackCaptions(req);
  const editorialFallback = fallbackVars.find(v => v.key === 'B') || fallbackVars[0];
  return {
    success: true,
    variations: fallbackVars,
    selectedVariation: editorialFallback.key,
    instagram: editorialFallback.captions.instagram,
    threads: editorialFallback.captions.threads,
    facebook: editorialFallback.captions.facebook,
    tiktok: editorialFallback.captions.tiktok,
    engine: 'muvidb_clean_fallback',
  };
}

export interface TriviaPollResult {
  question: string;
  options: { key: 'A' | 'B' | 'C' | 'D'; text: string; isCorrect: boolean }[];
  explanation: string;
  hook: string;
  captions: PlatformCaptions;
}

/**
 * Generates an interactive trivia poll grounded strictly on the movie's metadata and synopsis.
 */
export async function generateTriviaPollAI(
  film: { id: string; title: string; synopsis?: string | null; year?: number | null; cast?: string[] },
): Promise<TriviaPollResult | null> {
  const prompt = `You are an African cinema editorial writer for MuviDB.
Create an engaging 4-choice trivia poll question based strictly on this film:
Title: ${film.title}
Year: ${film.year || 'Nollywood'}
Synopsis: ${film.synopsis || 'African Cinema Film'}
Cast: ${(film.cast || []).slice(0, 8).join(', ')}

Rules:
1. Ground the question ONLY on the provided synopsis, title, year, or cast facts.
2. Provide exactly 4 options (A, B, C, D) with exactly ONE correct answer.
3. Keep the tone fun, interactive, and community-driven.
4. Output formatted social media copy for Instagram, Threads, Facebook, and TikTok.

Return ONLY a JSON object:
{
  "question": "Trivia question text?",
  "options": [
    { "key": "A", "text": "Option 1", "isCorrect": false },
    { "key": "B", "text": "Option 2", "isCorrect": true },
    { "key": "C", "text": "Option 3", "isCorrect": false },
    { "key": "D", "text": "Option 4", "isCorrect": false }
  ],
  "explanation": "Brief 1-sentence explanation of the correct answer.",
  "hook": "Opening social hook line",
  "captions": {
    "instagram": "Full Instagram post caption with question, options A-D, call to drop answer below, and #MuviDB #AfricanCinema hashtags",
    "threads": "Engaging short Threads post with poll question and options",
    "facebook": "Facebook post with the trivia challenge",
    "tiktok": "TikTok caption prompting comments"
  }
}`;

  try {
    const { text } = await generateAIContent(prompt, { preferredProvider: 'cohere' });
    const parsed = parseJSON(text);
    if (parsed?.question && Array.isArray(parsed?.options) && parsed?.captions) {
      return parsed as TriviaPollResult;
    }
  } catch (err: any) {
    console.warn('[generateTriviaPollAI] Failed to generate trivia poll:', err?.message);
  }
  return null;
}
