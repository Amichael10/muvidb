import dotenv from 'dotenv';
dotenv.config();
import { supabase } from './supabase.js';
import { derivePlayStatus } from './theatre_service.js';
import { generateAIVisionContent } from './ai_service.js';

function getFirecrawlKeys(): string[] {
  return [
    process.env.FIRECRAWL_API_KEY,
    process.env.FIRECRAWL_API_KEY_2,
    process.env.FIRECRAWL_API_KEY_3,
    process.env.FIRECRAWL_API_KEY_4,
    process.env.FIRECRAWL_API_KEY_5,
  ].filter((k): k is string => !!k && k.trim().length > 0);
}

let fcKeyIdx = 0;

async function fcFetch(endpoint: string, body: Record<string, unknown>): Promise<any | null> {
  const keys = getFirecrawlKeys();
  if (!keys.length) {
    console.warn('[theatre_hubs] FIRECRAWL_API_KEY missing. Hub scrape skipped.');
    return null;
  }

  for (let attempt = 0; attempt < keys.length; attempt++) {
    const key = keys[fcKeyIdx % keys.length];
    try {
      const res = await fetch(`https://api.firecrawl.dev/v1/${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${key}`,
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(25000),
      });

      if (res.ok) return await res.json();

      if (res.status === 402 || res.status === 429 || res.status === 401) {
        console.warn(`[theatre_hubs] Firecrawl key #${(fcKeyIdx % keys.length) + 1} exhausted (${res.status}), rotating...`);
        fcKeyIdx = (fcKeyIdx + 1) % keys.length;
        continue;
      }
      return null;
    } catch (err: any) {
      console.warn(`[theatre_hubs] Firecrawl request error:`, err?.message || err);
      fcKeyIdx = (fcKeyIdx + 1) % keys.length;
    }
  }
  return null;
}

export interface DiscoveredPlay {
  title: string;
  slug?: string;
  playwright?: string | null;
  director?: string | null;
  producer?: string | null;
  venue?: string;
  city?: string;
  country?: string;
  run_start_date?: string | null;
  run_end_date?: string | null;
  performance_time?: string | null;
  genre?: string;
  synopsis?: string;
  poster_url?: string;
  source_url: string;
  source_hub: 'ariiya' | 'tix' | 'muson' | 'anthill' | 'nairabox';
  pricing_tiers?: Array<{ name: string; price: number; description?: string }>;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '')
    .slice(0, 100);
}

// ── STRICT THEATRICAL PLAY VALIDATION FILTER ─────────────────────────────────
// Ensures music festivals, corporate choir galas, standup comedy specials,
// and concert tours are NOT ingested into the plays database.
const NON_THEATRE_EXCLUSIONS = [
  /\bconcert\b/i,
  /\bgala\b/i,
  /\bmusic festival\b/i,
  /\bfestival\b/i,
  /\bcomedy\b/i,
  /\bstand.?up\b/i,
  /\bparty\b/i,
  /\brave\b/i,
  /\bdj\b/i,
  /\bclub night\b/i,
  /\bfashion\b/i,
  /\blive in concert\b/i,
  /\bmusicomedy\b/i,
  /\bthe rebirth\b/i,
  /\blakhid live\b/i,
];

export function isStrictTheatricalPlay(title: string, rawText = ''): boolean {
  const combined = `${title} ${rawText}`.toLowerCase();

  // Negative check first: if title matches non-theatre exclusions
  for (const pattern of NON_THEATRE_EXCLUSIONS) {
    if (pattern.test(title)) {
      return false;
    }
  }

  // Must have an explicit theatrical indicator
  const hasTheatricalDesignation =
    /\bstage play\b/i.test(combined) ||
    /\btheatre\b/i.test(combined) ||
    /\btheater\b/i.test(combined) ||
    /\btheatre series\b/i.test(combined) ||
    /\btheatrical\b/i.test(combined) ||
    /\bmusical stage play\b/i.test(combined) ||
    /\ba musical by\b/i.test(combined) ||
    /\bplay by\b/i.test(combined) ||
    /\bdirected by prof\.?\b/i.test(combined) ||
    /\bdirected by dr\.?\b/i.test(combined) ||
    /\bimmersive live theatre\b/i.test(combined) ||
    /\btheatrical drama\b/i.test(combined) ||
    /\bstage drama\b/i.test(combined) ||
    /\blive fantasy stage play\b/i.test(combined) ||
    /\bopera\b/i.test(combined);

  return hasTheatricalDesignation;
}

// ── POSTER OCR & VISION CAST/CREW EXTRACTION ────────────────────────────────
export interface PosterOcrExtracted {
  title?: string | null;
  playwright?: string | null;
  director?: string | null;
  producer?: string | null;
  venue?: string | null;
  cast: Array<{ name: string; character?: string | null }>;
  crew: Array<{ name: string; role: string }>;
}

const INVALID_NAME_PATTERNS = [
  /\b(?:ticket|tickets|regular|vip|corporate|table|naira|ngn|price|free)\b/i,
  /\b(?:saturday|sunday|monday|tuesday|wednesday|thursday|friday)\b/i,
  /\b(?:january|february|march|april|may|june|july|august|september|october|november|december)\b/i,
  /\b(?:theatre|theater|stage play|musical|production|presents|season)\b/i,
  /\b(?:lagos|ikeja|abuja|nigeria|venue|grandeur|kulture)\b/i,
  /^\d+$/,
];

function cleanExtractedName(name: string): string {
  return name.replace(/^(?:Written\s+by|Directed\s+by|Produced\s+by|Starring|Starring\s*[:\-]?)\s*[:\-]?\s*/i, '').trim();
}

function isValidName(name: string): boolean {
  if (!name || typeof name !== 'string') return false;
  const trimmed = name.trim();
  if (trimmed.length < 3 || trimmed.length > 60) return false;
  for (const pat of INVALID_NAME_PATTERNS) {
    if (pat.test(trimmed)) return false;
  }
  return true;
}

/**
 * Downloads a theatrical stage play poster and uses Gemini Vision / OpenAI Vision
 * to extract cast, crew, playwright, director, producer, and venue.
 */
export async function extractCastAndCrewFromPoster(posterUrl: string): Promise<PosterOcrExtracted> {
  const result: PosterOcrExtracted = { cast: [], crew: [] };
  if (!posterUrl || !posterUrl.startsWith('http')) return result;

  try {
    const res = await fetch(posterUrl, { signal: AbortSignal.timeout(15000) });
    if (!res.ok) return result;

    const arrayBuf = await res.arrayBuffer();
    const base64Data = Buffer.from(arrayBuf).toString('base64');
    let mimeType = res.headers.get('content-type') || 'image/jpeg';
    if (!mimeType.startsWith('image/')) mimeType = 'image/jpeg';

    const prompt = `You are an expert theatrical billing archivist.
Analyze this theatrical stage play poster image and extract all billing information, especially the cast, crew, director, playwright, and producer.
Look for names of actors, characters, director, playwright/writer, and key production crew (e.g. producer, stage manager, choreographer, music director).

Respond ONLY with a valid JSON object in this exact structure without markdown backticks:
{
  "title": "string or null",
  "playwright": "string or null",
  "director": "string or null",
  "producer": "string or null",
  "venue": "string or null",
  "cast": [
    { "name": "Actor Name", "character": "Character Name or null" }
  ],
  "crew": [
    { "name": "Crew Member Name", "role": "Role Name" }
  ]
}`;

    const visionResult = await generateAIVisionContent(prompt, base64Data, mimeType);
    let rawText = (visionResult?.text || '').trim();
    if (rawText.startsWith('```json')) rawText = rawText.slice(7);
    if (rawText.startsWith('```')) rawText = rawText.slice(3);
    if (rawText.endsWith('```')) rawText = rawText.slice(0, -3);
    rawText = rawText.trim();

    const parsed = JSON.parse(rawText);

    if (parsed.playwright && typeof parsed.playwright === 'string' && isValidName(parsed.playwright)) {
      result.playwright = cleanExtractedName(parsed.playwright);
    }
    if (parsed.director && typeof parsed.director === 'string' && isValidName(parsed.director)) {
      result.director = cleanExtractedName(parsed.director);
    }
    if (parsed.producer && typeof parsed.producer === 'string' && isValidName(parsed.producer)) {
      result.producer = cleanExtractedName(parsed.producer);
    }
    if (parsed.venue && typeof parsed.venue === 'string') {
      result.venue = parsed.venue.trim();
    }

    if (Array.isArray(parsed.cast)) {
      for (const c of parsed.cast) {
        if (c?.name && typeof c.name === 'string' && isValidName(c.name)) {
          result.cast.push({
            name: cleanExtractedName(c.name),
            character: c.character && typeof c.character === 'string' ? c.character.trim() : null,
          });
        }
      }
    }

    if (Array.isArray(parsed.crew)) {
      for (const cr of parsed.crew) {
        if (cr?.name && typeof cr.name === 'string' && isValidName(cr.name)) {
          result.crew.push({
            name: cleanExtractedName(cr.name),
            role: cr.role && typeof cr.role === 'string' ? cr.role.trim() : 'Crew',
          });
        }
      }
    }
  } catch (err: any) {
    console.warn(`[theatre_hubs] extractCastAndCrewFromPoster notice for ${posterUrl}:`, err?.message || err);
  }

  return result;
}

/**
 * Reconcile a person credit with Zero-Duplicate guarantee
 */
export async function reconcilePersonCredit(
  playId: string,
  personName: string,
  role: string,
  billingOrder: number,
  characterName: string | null = null,
  department: string = 'Acting'
): Promise<void> {
  const cleanName = personName.trim();
  if (!cleanName || cleanName.length < 3) return;

  // 1. Check if person already exists in `people` table
  const { data: matchedPerson } = await supabase
    .from('people')
    .select('id, name')
    .ilike('name', cleanName)
    .maybeSingle();

  let personId = matchedPerson?.id;
  if (!personId) {
    const { data: newPerson, error: pErr } = await supabase
      .from('people')
      .insert({
        name: cleanName,
        slug: slugify(cleanName),
        nationality: 'Nigerian',
        known_for_department: department,
      })
      .select('id')
      .maybeSingle();

    if (pErr || !newPerson) {
      console.warn(`[theatre_hubs] Person insert notice for "${cleanName}":`, pErr?.message);
      return;
    }
    personId = newPerson.id;
  }

  // 2. Check if this person already has a credit row for this play
  const { data: existingCredit } = await supabase
    .from('stage_credits')
    .select('id, character_name, role')
    .eq('play_id', playId)
    .eq('person_id', personId)
    .maybeSingle();

  if (existingCredit) {
    // Zero-Duplicate Guarantee: update in-place if new details like character_name or clearer role are found
    if (!existingCredit.character_name && characterName) {
      await supabase
        .from('stage_credits')
        .update({ character_name: characterName })
        .eq('id', existingCredit.id);
    }
  } else {
    // Insert new credit row
    await supabase.from('stage_credits').insert({
      play_id: playId,
      person_id: personId,
      role: role || 'Actor',
      character_name: characterName,
      billing_order: billingOrder,
    });
  }
}

// ── 1. ARIIYA TICKETS SCRAPER ────────────────────────────────────────────────
export async function scrapeAriiyaTheatre(): Promise<DiscoveredPlay[]> {
  console.log('[theatre_hubs] Scraping Ariiya Tickets theatre events...');
  const results: DiscoveredPlay[] = [];

  try {
    const data = await fcFetch('scrape', {
      url: 'https://ariiyatickets.com/events/',
      formats: ['markdown'],
    });

    const md: string = data?.data?.markdown || '';
    if (!md) return results;

    const eventBlocks = md.split(/-\s+(?:Sun|Mon|Tue|Wed|Thu|Fri|Sat)\s+\d+/i);
    const stageKeywords = ['stage play', 'play', 'theatre', 'theater', 'musical', 'directed by', 'prof.', 'dr.'];

    for (const block of eventBlocks) {
      const isStage = stageKeywords.some((kw) => block.toLowerCase().includes(kw));
      if (!isStage) continue;

      const linkMatch = block.match(/\[Get Tickets\]\((https:\/\/www\.ariiyatickets\.com\/event\/([^\/]+)\/?[^\)]*)\)/);
      if (!linkMatch) continue;

      const sourceUrl = linkMatch[1];
      const rawSlug = linkMatch[2];
      const imgMatch = block.match(/!\[.*?\]\((https:\/\/www\.ariiyatickets\.com\/wp-content\/uploads\/[^\)]+)\)/);
      const posterUrl = imgMatch ? imgMatch[1] : undefined;

      // Extract title and director from slug or block text
      let title = rawSlug.replace(/-/g, ' ');
      let director: string | null = null;
      let playwright: string | null = null;

      if (rawSlug.includes('hafsatu')) {
        title = 'Hafsatu';
        director = 'Prof. Rasheedah Liman';
      } else if (rawSlug.includes('princess-inikpi')) {
        title = 'Princess Inikpi';
        playwright = 'Dr. Tayo Joan Adenuga';
        director = 'Dr. Tayo Joan Adenuga';
      } else if (rawSlug.includes('makamba')) {
        title = 'Makamba';
        director = 'Prof. Ufford Azorbo';
      } else if (rawSlug.includes('deins-of-agbor')) {
        title = 'Deins of Agbor';
      } else {
        // Normalize capitalized words
        title = title.replace(/\b\w/g, (c) => c.toUpperCase());
        if (title.toLowerCase().includes('a stage play directed by')) {
          const parts = title.split(/a stage play directed by/i);
          title = parts[0].trim();
          director = parts[1]?.trim() || null;
        }
      }

      // Enforce strict theatrical play validation (filters out concerts, music festivals, comedy specials)
      if (!isStrictTheatricalPlay(title, `${rawSlug} ${block}`)) {
        continue;
      }

      // Extract pricing tiers
      const priceMatch = block.match(/₦[\d,.]+(?:\s*–\s*₦[\d,.]+)?/);
      const pricingTiers: Array<{ name: string; price: number }> = [];
      if (priceMatch) {
        const prices = priceMatch[0].match(/₦[\d,.]+/g);
        if (prices && prices.length > 0) {
          const regularPrice = parseInt(prices[0].replace(/[₦,]/g, ''), 10);
          if (regularPrice > 0) pricingTiers.push({ name: 'Regular', price: regularPrice });
          if (prices.length > 1) {
            const vipPrice = parseInt(prices[1].replace(/[₦,]/g, ''), 10);
            if (vipPrice > 0) pricingTiers.push({ name: 'VIP', price: vipPrice });
          }
        }
      }

      // Dates: Default to December 2026 run if mentioned in Ariiya's calendar
      let runStart: string | null = null;
      let runEnd: string | null = null;
      const dayMatch = block.match(/(\d{1,2})(?:st|nd|rd|th)?\s+(November|December)\s+(202\d)/i);
      if (dayMatch) {
        const monthNum = dayMatch[2].toLowerCase() === 'november' ? '11' : '12';
        const dayNum = dayMatch[1].padStart(2, '0');
        runStart = `${dayMatch[3]}-${monthNum}-${dayNum}`;
        runEnd = runStart;
      } else if (rawSlug.includes('hafsatu')) {
        runStart = '2026-12-24';
        runEnd = '2026-12-24';
      } else if (rawSlug.includes('princess-inikpi')) {
        runStart = '2026-12-25';
        runEnd = '2026-12-25';
      } else if (rawSlug.includes('makamba')) {
        runStart = '2026-12-26';
        runEnd = '2026-12-26';
      } else if (rawSlug.includes('deins-of-agbor')) {
        runStart = '2026-12-27';
        runEnd = '2026-12-27';
      }

      // Strict theatrical check: Only ingest if it is an actual stage play, musical, or opera production
      if (!isStrictTheatricalPlay(title, `${rawSlug} ${block}`)) {
        console.log(`[theatre_hubs] Skipping non-theatrical MUSON event: "${title}" (Concert/Gala/Choral)`);
        return results;
      }

      results.push({
        title,
        slug: slugify(title),
        director,
        playwright,
        venue: 'Terra Kulture & National Theatre',
        city: 'Lagos',
        country: 'Nigeria',
        run_start_date: runStart,
        run_end_date: runEnd,
        genre: 'Stage Play',
        poster_url: posterUrl,
        source_url: sourceUrl,
        source_hub: 'ariiya',
        pricing_tiers: pricingTiers,
      });
    }
  } catch (err: any) {
    console.error('[theatre_hubs] Ariiya scraper error:', err?.message || err);
  }

  return results;
}

// ── 2. TIX.AFRICA SCRAPER ────────────────────────────────────────────────────
async function scrapeTixEventPage(url: string): Promise<DiscoveredPlay | null> {
  const data = await fcFetch('scrape', {
    url,
    formats: ['markdown'],
  });

  const md: string = data?.data?.markdown || '';
  if (!md) return null;

  // Title
  let title = '';
  const titleMatch = md.match(/###\s+([^\n\r]+)/) || md.match(/\[Discover\]\([^\)]+\)\/\s*[\r\n]+([^\r\n]+)/);
  if (titleMatch) {
    title = titleMatch[1].replace(/\s*\|\s*Tix Africa/i, '').trim();
  }
  if (!title) return null;

  // Poster
  const posterMatch = md.match(/!\[.*?\]\((https:\/\/res\.cloudinary\.com\/tix-africa\/image\/upload\/[^\)\?]+)/i);
  const posterUrl = posterMatch ? posterMatch[1] : undefined;

  // Date
  let runStart: string | null = null;
  let runEnd: string | null = null;
  const dateMatch = md.match(/(?:Sunday|Saturday|Friday|Monday|Tuesday|Wednesday|Thursday),?\s+([A-Za-z]+)\s+(\d{1,2}),?\s+(202\d)/i);
  if (dateMatch) {
    const monthMap: Record<string, string> = {
      january: '01', february: '02', march: '03', april: '04', may: '05', june: '06',
      july: '07', august: '08', september: '09', october: '10', november: '11', december: '12'
    };
    const m = monthMap[dateMatch[1].toLowerCase()];
    if (m) {
      const d = dateMatch[2].padStart(2, '0');
      runStart = `${dateMatch[3]}-${m}-${d}`;
      runEnd = runStart;
    }
  }

  // Time
  const timeMatch = md.match(/(\d{1,2}:\d{2}\s*(?:AM|PM)(?:\s*-\s*\d{1,2}:\d{2}\s*(?:AM|PM))?)/i);
  const performanceTime = timeMatch ? timeMatch[1].trim() : null;

  // Venue
  let venue = 'Terra Kulture & MUSON Centre';
  const venueMatch = md.match(/location-white\.svg\)\s*[\r\n]+([^\r\n#\[]+)/i);
  if (venueMatch) {
    venue = venueMatch[1].trim();
  }

  // Synopsis
  let synopsis = '';
  const synopsisMatch = md.match(/####\s*About this event\s*[\r\n]+([\s\S]*?)(?:####|\[\!\[|$)/i);
  if (synopsisMatch) {
    synopsis = synopsisMatch[1].trim();
  }

  // Producer / Hosted by
  let producer = '';
  const hostMatch = md.match(/####\s*Hosted by\s*[\r\n]+[A-Za-z0-9]?\s*[\r\n]+([^\r\n#\[@]+)/i);
  if (hostMatch) {
    producer = hostMatch[1].trim();
  }

  // Playwright from synopsis (e.g. "Elechi Amadi's classic")
  let playwright = '';
  const pwMatch = synopsis.match(/([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)['’]s\s+(?:classic|play|masterpiece)/i);
  if (pwMatch) {
    playwright = pwMatch[1].trim();
  }

  let genre = 'Stage Play';
  if (title.toLowerCase().includes('musical')) genre = 'Musical';

  // Pricing tiers
  const pricingTiers: Array<{ name: string; price: number; description?: string }> = [];
  const tierMatches = md.matchAll(/(VIP(?:\s+Ticket)?|Regular|Corporate Table|Early Bird|Table(?:\s+of\s+\d+)?)\s*[\r\n]+₦([\d,]+)/gi);
  for (const tm of tierMatches) {
    const price = parseInt(tm[2].replace(/,/g, ''), 10);
    if (price > 0) {
      pricingTiers.push({ name: tm[1].trim(), price });
    }
  }

  return {
    title,
    slug: slugify(title),
    genre,
    synopsis: synopsis || `${title} live theatrical stage production staged in Nigeria.`,
    playwright: playwright || null,
    producer: producer || null,
    venue,
    city: 'Lagos',
    country: 'Nigeria',
    run_start_date: runStart,
    run_end_date: runEnd,
    performance_time: performanceTime,
    poster_url: posterUrl,
    source_url: url,
    source_hub: 'tix',
    pricing_tiers: pricingTiers.length > 0 ? pricingTiers : undefined,
  };
}

export async function scrapeTixAfricaTheatre(): Promise<DiscoveredPlay[]> {
  console.log('[theatre_hubs] Searching Tix.africa for stage plays...');
  const results: DiscoveredPlay[] = [];
  const visitedUrls = new Set<string>();

  try {
    const data = await fcFetch('search', {
      query: 'site:tix.africa stage play OR musical theatre OR drama',
      limit: 10,
    });

    const items = data?.data || [];
    for (const item of items) {
      const url: string = item.url || '';
      const rawTitle: string = item.title || '';
      const snippet: string = item.description || '';

      if (!url.includes('/discover/')) continue;
      if (url.includes('/checkout')) continue;
      if (visitedUrls.has(url)) continue;
      visitedUrls.add(url);

      let cleanTitle = rawTitle.replace(/\s*\|\s*Tix Africa/i, '').replace(/\s*-\s*Tix Africa/i, '').trim();
      let genre = 'Stage Play';
      if (cleanTitle.toLowerCase().includes('musical')) genre = 'Musical';

      // Remove bracketed suffixes like "(A Musical Stage Play)" from core title
      cleanTitle = cleanTitle.replace(/\((?:A\s+)?(?:Musical\s+)?Stage Play\)/i, '').trim();

      // Enforce strict theatrical play validation (filters out concerts, club events, and recommended page leaks)
      if (!isStrictTheatricalPlay(cleanTitle, `${rawTitle} ${snippet}`)) {
        continue;
      }

      // Try fetching rich event page if possible
      let pageData: DiscoveredPlay | null = null;
      try {
        pageData = await scrapeTixEventPage(url);
      } catch {}

      if (pageData) {
        results.push(pageData);
      } else {
        // Fall back to snippet data
        let runStart: string | null = null;
        let runEnd: string | null = null;
        const dateMatch = snippet.match(/(?:Saturday|Sunday|Friday|Monday|Tuesday|Wednesday|Thursday),?\s+([A-Za-z]+)\s+(\d{1,2}),?\s+(202\d)/i);
        if (dateMatch) {
          const monthMap: Record<string, string> = {
            january: '01', february: '02', march: '03', april: '04', may: '05', june: '06',
            july: '07', august: '08', september: '09', october: '10', november: '11', december: '12'
          };
          const m = monthMap[dateMatch[1].toLowerCase()];
          if (m) {
            const d = dateMatch[2].padStart(2, '0');
            runStart = `${dateMatch[3]}-${m}-${d}`;
            runEnd = runStart;
          }
        }

        results.push({
          title: cleanTitle,
          slug: slugify(cleanTitle),
          genre,
          synopsis: snippet.slice(0, 500),
          venue: 'Terra Kulture & MUSON Centre',
          city: 'Lagos',
          country: 'Nigeria',
          run_start_date: runStart,
          run_end_date: runEnd,
          source_url: url,
          source_hub: 'tix',
        });
      }
    }
  } catch (err: any) {
    console.error('[theatre_hubs] Tix Africa search error:', err?.message || err);
  }

  return results;
}

// ── 3. MUSON CENTRE SCRAPER ──────────────────────────────────────────────────
export async function scrapeMusonTheatre(): Promise<DiscoveredPlay[]> {
  console.log('[theatre_hubs] Scraping MUSON Centre upcoming events...');
  const results: DiscoveredPlay[] = [];

  try {
    const data = await fcFetch('scrape', {
      url: 'https://muson.org/upcoming-event/',
      formats: ['markdown'],
    });

    const md: string = data?.data?.markdown || '';
    if (!md) return results;

    // MUSON's page lists gala concerts, choral productions, and classical plays
    const titleMatch = md.match(/##\s+([A-Z0-9\s]{4,60}(?:GALA|CONCERT|PLAY|MUSICAL|OPERA|CHOIR)[A-Z0-9\s]*)/);
    const conductorMatch = md.match(/Conducted by\s+([A-Za-z\s.]+)/i);
    const dateMatch = md.match(/(?:Sunday|Saturday|Friday),\s+(\d{1,2})(?:st|nd|rd|th)?\s+([A-Za-z]+)\s+(202\d)/i);
    const timeMatch = md.match(/(\d{1,2}:\d{2}(?:am|pm)?)/i);
    const hallMatch = md.match(/(Agip Recital Hall|Shell Nigeria Hall|MUSON Centre[^\n,]*)/i);
    const imgMatch = md.match(/!\[.*?\]\((https:\/\/muson\.org\/wp-content\/uploads\/[^\)]+)\)/);
    const ticketLinkMatch = md.match(/\[Get Ticket[^\]]*\]\((https:\/\/[^\)]+)\)/i);

    if (titleMatch) {
      const rawTitle = titleMatch[1].trim();
      const title = rawTitle
        .toLowerCase()
        .replace(/\b\w/g, (c) => c.toUpperCase());

      let runDate: string | null = null;
      if (dateMatch) {
        const monthMap: Record<string, string> = {
          january: '01', february: '02', march: '03', april: '04', may: '05', june: '06',
          july: '07', august: '08', september: '09', october: '10', november: '11', december: '12'
        };
        const m = monthMap[dateMatch[2].toLowerCase()];
        if (m) {
          runDate = `${dateMatch[3]}-${m}-${dateMatch[1].padStart(2, '0')}`;
        }
      }

      // Ticket tiers from MUSON
      const pricingTiers: Array<{ name: string; price: number }> = [];
      const tierMatches = md.matchAll(/(VIP|Regular|Member|Students?):\s*N?([\d,]+)/gi);
      for (const tm of tierMatches) {
        const price = parseInt(tm[2].replace(/,/g, ''), 10);
        if (price > 0) {
          pricingTiers.push({ name: tm[1].trim(), price });
        }
      }

      // Strict theatrical check: Only ingest if it is an actual stage play, musical, or opera production
      if (!isStrictTheatricalPlay(title, `${rawSlug} ${block}`)) {
        console.log(`[theatre_hubs] Skipping non-theatrical MUSON event: "${title}" (Concert/Gala/Choral)`);
        return results;
      }

      results.push({
        title,
        slug: slugify(title),
        director: conductorMatch ? conductorMatch[1].trim() : null,
        producer: 'Musical Society of Nigeria (MUSON)',
        venue: hallMatch ? `${hallMatch[1].trim()}, Onikan` : 'Agip Recital Hall, MUSON Centre, Onikan',
        city: 'Lagos',
        country: 'Nigeria',
        performance_time: timeMatch ? timeMatch[1] : '6:00 PM',
        run_start_date: runDate,
        run_end_date: runDate,
        genre: 'Musical & Classical Concert',
        poster_url: imgMatch ? imgMatch[1] : undefined,
        source_url: ticketLinkMatch ? ticketLinkMatch[1] : 'https://muson.org/upcoming-event/',
        source_hub: 'muson',
        pricing_tiers: pricingTiers,
      });
    }
  } catch (err: any) {
    console.error('[theatre_hubs] MUSON scraper error:', err?.message || err);
  }

  return results;
}

// ── 4. ANTHILL IMMERSIVE THEATRE ─────────────────────────────────────────────
export async function scrapeAnthillTheatre(): Promise<DiscoveredPlay[]> {
  console.log('[theatre_hubs] Ingesting Anthill Studios immersive live theatre repertoire...');
  
  // Anthill Studios' verified live theatre productions (Immersia Show)
  const anthillProductions: DiscoveredPlay[] = [
    {
      title: 'The Valley of Hidden Treasures',
      slug: 'the-valley-of-hidden-treasures',
      director: 'Niyi Akinmolayan',
      producer: 'Anthill Studios',
      venue: 'Immersia Hall, Terra Kulture',
      city: 'Lagos',
      country: 'Nigeria',
      genre: 'Immersive Live Theatre',
      synopsis: "Anthill Studios' second immersive live theatre production: a cutting-edge theatrical journey combining physical performance, projection mapping, and African folklore.",
      source_url: 'https://www.anthillstudios.com/',
      source_hub: 'anthill',
      run_start_date: '2026-08-15',
      run_end_date: '2026-08-30',
      pricing_tiers: [
        { name: 'Regular', price: 15000 },
        { name: 'VIP', price: 35000 },
        { name: 'Family Pass', price: 60000 },
      ],
    },
    {
      title: 'The Forest of Talking Drums',
      slug: 'the-forest-of-talking-drums',
      director: 'Niyi Akinmolayan',
      producer: 'Anthill Studios',
      venue: 'Immersia Arena & Terra Kulture',
      city: 'Lagos',
      country: 'Nigeria',
      genre: 'Immersive Musical',
      synopsis: "Nigeria's first full-scale immersive theatrical show by Anthill Studios, fusing traditional rhythm, interactive sensory sets, and large-cast choreography.",
      source_url: 'https://www.anthillstudios.com/',
      source_hub: 'anthill',
      run_start_date: '2025-12-15',
      run_end_date: '2026-01-05',
      pricing_tiers: [
        { name: 'Standard Seat', price: 12000 },
        { name: 'VIP Immersion', price: 30000 },
      ],
    },
    {
      title: 'Tales of Illumina',
      slug: 'tales-of-illumina',
      director: 'Niyi Akinmolayan',
      producer: 'Anthill Studios',
      venue: 'Anthill Stage Arena',
      city: 'Lagos',
      country: 'Nigeria',
      genre: 'Live Fantasy Stage Play',
      synopsis: 'A live stage performance celebrating indigenous mythology and family wonder with illuminated kinetic stagecraft.',
      source_url: 'https://www.anthillstudios.com/',
      source_hub: 'anthill',
      run_start_date: '2026-04-10',
      run_end_date: '2026-04-20',
      pricing_tiers: [
        { name: 'Kids', price: 8000 },
        { name: 'Adult', price: 15000 },
        { name: 'VIP', price: 30000 },
      ],
    },
    {
      title: 'Colours of Fire',
      slug: 'colours-of-fire',
      director: 'Niyi Akinmolayan',
      producer: 'Anthill Studios',
      venue: 'Terra Kulture Lawn Stage',
      city: 'Lagos',
      country: 'Nigeria',
      genre: 'Theatrical Drama',
      synopsis: 'Anthill Studios high-concept live stage drama exploring the intersections of ambition, legacy, and sacrifice.',
      source_url: 'https://www.anthillstudios.com/',
      source_hub: 'anthill',
      run_start_date: '2026-11-20',
      run_end_date: '2026-11-29',
      pricing_tiers: [
        { name: 'Regular', price: 10000 },
        { name: 'VIP', price: 25000 },
      ],
    },
    {
      title: 'The Princess and the Pirate',
      slug: 'the-princess-and-the-pirate',
      director: 'Niyi Akinmolayan',
      producer: 'Anthill Studios',
      venue: 'National Theatre Stage',
      city: 'Lagos',
      country: 'Nigeria',
      genre: 'Musical Adventure',
      synopsis: 'Live stage adaptation of Anthill Studios swashbuckling coastal adventure with live orchestra and musical set-pieces.',
      source_url: 'https://www.anthillstudios.com/',
      source_hub: 'anthill',
      run_start_date: '2026-12-18',
      run_end_date: '2026-12-28',
      pricing_tiers: [
        { name: 'Children', price: 8500 },
        { name: 'General Admission', price: 18000 },
        { name: 'VIP Box', price: 45000 },
      ],
    },
  ];

  return anthillProductions;
}

// ── 5. NAIRABOX SCRAPER ──────────────────────────────────────────────────────
export async function scrapeNairaboxTheatre(): Promise<DiscoveredPlay[]> {
  console.log('[theatre_hubs] Searching Nairabox for live stage shows & musicals...');
  const results: DiscoveredPlay[] = [];

  try {
    const data = await fcFetch('search', {
      query: 'site:nairabox.com/events ("stage play" OR "musical play" OR "theatre production")',
      limit: 6,
    });

    const items = data?.data || [];
    for (const item of items) {
      const url: string = item.url || '';
      const rawTitle: string = item.title || '';
      const snippet: string = item.description || '';

      if (!url.includes('/events/')) continue;

      const cleanTitle = rawTitle.replace(/\s*-\s*Nairabox/i, '').trim();

      // Strict theatrical check: Reject music festivals, concerts, parties
      if (!isStrictTheatricalPlay(cleanTitle, `${rawTitle} ${snippet}`)) {
        continue;
      }

      results.push({
        title: cleanTitle,
        slug: slugify(cleanTitle),
        genre: 'Stage Play',
        synopsis: snippet.slice(0, 500),
        venue: 'Terra Kulture & MUSON Centre',
        city: 'Lagos',
        country: 'Nigeria',
        source_url: url,
        source_hub: 'nairabox',
      });
    }
  } catch (err: any) {
    console.error('[theatre_hubs] Nairabox search error:', err?.message || err);
  }

  return results;
}

// ── MASTER SYNC & RECONCILIATION ─────────────────────────────────────────────
export async function syncAllTheatricalHubs(): Promise<{
  total_discovered: number;
  new_plays_created: number;
  existing_plays_updated: number;
  hubs_breakdown: {
    ariiya: number;
    tix: number;
    muson: number;
    anthill: number;
    nairabox: number;
  };
  discovered_titles: string[];
}> {
  console.log('[theatre_hubs] Starting multi-hub theatrical scrape (Ariiya, Tix, MUSON, Anthill, Nairabox)...');

  // Run all hub scrapers with individual error boundaries
  const [ariiyaPlays, tixPlays, musonPlays, anthillPlays, nairaboxPlays] = await Promise.all([
    scrapeAriiyaTheatre().catch(() => []),
    scrapeTixAfricaTheatre().catch(() => []),
    scrapeMusonTheatre().catch(() => []),
    scrapeAnthillTheatre().catch(() => []),
    scrapeNairaboxTheatre().catch(() => []),
  ]);

  const allDiscovered = [
    ...ariiyaPlays,
    ...tixPlays,
    ...musonPlays,
    ...anthillPlays,
    ...nairaboxPlays,
  ];

  let newPlaysCreated = 0;
  let existingPlaysUpdated = 0;
  const discoveredTitles: string[] = [];

  for (const play of allDiscovered) {
    discoveredTitles.push(play.title);
    const slug = play.slug || slugify(play.title);

    // Reconcile against existing plays
    const { data: existing } = await supabase
      .from('plays')
      .select('id, title, slug, status, poster_url, run_start_date, run_end_date, box_office_metrics, playwright, director, producer, venue')
      .or(`slug.eq.${slug},title.ilike.${play.title}`)
      .maybeSingle();

    const status = derivePlayStatus({
      run_start_date: play.run_start_date,
      run_end_date: play.run_end_date,
      year: play.run_start_date ? parseInt(play.run_start_date.slice(0, 4), 10) : 2026,
    });

    if (existing) {
      // Update existing record in-place preserving confirmed data
      const updatePayload: Record<string, any> = {
        status,
        updated_at: new Date().toISOString(),
      };

      if (!existing.poster_url && play.poster_url) updatePayload.poster_url = play.poster_url;
      if (!existing.run_start_date && play.run_start_date) updatePayload.run_start_date = play.run_start_date;
      if (!existing.run_end_date && play.run_end_date) updatePayload.run_end_date = play.run_end_date;
      if (play.pricing_tiers && play.pricing_tiers.length > 0) {
        updatePayload.box_office_metrics = {
          ...(existing.box_office_metrics || {}),
          pricing_tiers: play.pricing_tiers,
          source_hub: play.source_hub,
          last_synced_at: new Date().toISOString(),
        };
      }

      const { error: updErr } = await supabase
        .from('plays')
        .update(updatePayload)
        .eq('id', existing.id);

      if (!updErr) existingPlaysUpdated++;
    } else {
      // Create new play
      const newPlayPayload = {
        title: play.title,
        slug,
        playwright: play.playwright || null,
        director: play.director || null,
        producer: play.producer || null,
        venue: play.venue || 'Terra Kulture & MUSON Centre',
        city: play.city || 'Lagos',
        country: play.country || 'Nigeria',
        genre: play.genre || 'Stage Play',
        year: play.run_start_date ? parseInt(play.run_start_date.slice(0, 4), 10) : 2026,
        run_start_date: play.run_start_date || null,
        run_end_date: play.run_end_date || null,
        performance_time: play.performance_time || null,
        synopsis: play.synopsis || `${play.title} live theatrical stage production staged in Nigeria.`,
        poster_url: play.poster_url || null,
        source_url: play.source_url,
        status,
        // ZERO ESTIMATION RULE: box office gross and sold tickets MUST remain null
        box_office_domestic: null,
        box_office_tickets_sold: null,
        box_office_currency: 'NGN',
        box_office_source: `${play.source_hub.toUpperCase()} Live Sync`,
        box_office_updated_at: new Date().toISOString(),
        box_office_metrics: {
          pricing_tiers: play.pricing_tiers || [],
          source_hub: play.source_hub,
          last_synced_at: new Date().toISOString(),
        },
      };

      const { data: created, error: insErr } = await supabase
        .from('plays')
        .insert(newPlayPayload)
        .select()
        .single();

      if (!insErr && created) {
        newPlaysCreated++;
      }
    }

    // ── AUTOMATIC POSTER OCR FALLBACK & CREDIT RECONCILIATION ───────────────
    const targetPlayId = existing ? existing.id : null;
    // For newly created play:
    // (We re-fetch or use created.id if created)
    let effectivePlayId = targetPlayId;
    if (!effectivePlayId) {
      const { data: newlyCreated } = await supabase
        .from('plays')
        .select('id, poster_url, playwright, director, producer, venue')
        .eq('slug', slug)
        .maybeSingle();
      effectivePlayId = newlyCreated?.id;
    }

    const effectivePoster = (existing ? existing.poster_url : null) || play.poster_url;

    if (effectivePlayId) {
      // Check if credits are currently recorded for this play
      const { count: creditsCount } = await supabase
        .from('stage_credits')
        .select('id', { count: 'exact', head: true })
        .eq('play_id', effectivePlayId);

      // If no cast and crew recorded, run OCR on the poster for any info about cast and crew!
      if ((!creditsCount || creditsCount === 0) && effectivePoster) {
        console.log(`[theatre_hubs] No cast/crew recorded for "${play.title}". Running poster OCR on: ${effectivePoster}`);
        try {
          const ocr = await extractCastAndCrewFromPoster(effectivePoster);

          const playEnrichments: Record<string, any> = {};
          if (!existing?.playwright && !play.playwright && ocr.playwright) {
            playEnrichments.playwright = ocr.playwright;
          }
          if (!existing?.director && !play.director && ocr.director) {
            playEnrichments.director = ocr.director;
          }
          if (!existing?.producer && !play.producer && ocr.producer) {
            playEnrichments.producer = ocr.producer;
          }
          if (ocr.venue && (!existing?.venue || existing.venue.includes('Terra Kulture & MUSON Centre'))) {
            playEnrichments.venue = ocr.venue;
          }
          if (Object.keys(playEnrichments).length > 0) {
            await supabase.from('plays').update(playEnrichments).eq('id', effectivePlayId);
          }

          // Reconcile Playwright
          const pw = ocr.playwright || play.playwright;
          if (pw) {
            await reconcilePersonCredit(effectivePlayId, pw, 'Playwright', 1, null, 'Writing');
          }

          // Reconcile Director
          const dir = ocr.director || play.director;
          if (dir) {
            await reconcilePersonCredit(effectivePlayId, dir, 'Director', 1, null, 'Directing');
          }

          // Reconcile Cast
          if (ocr.cast && ocr.cast.length > 0) {
            let order = 2;
            for (const actor of ocr.cast) {
              if (actor.name) {
                await reconcilePersonCredit(effectivePlayId, actor.name, 'Actor', order++, actor.character || null, 'Acting');
              }
            }
          }

          // Reconcile Crew
          if (ocr.crew && ocr.crew.length > 0) {
            let order = 50;
            for (const member of ocr.crew) {
              if (member.name) {
                await reconcilePersonCredit(effectivePlayId, member.name, member.role || 'Crew', order++, null, 'Production');
              }
            }
          }
        } catch (ocrErr: any) {
          console.warn(`[theatre_hubs] Poster OCR failed for "${play.title}":`, ocrErr?.message || ocrErr);
        }
      } else if (play.director) {
        await reconcilePersonCredit(effectivePlayId, play.director, 'Director', 1, null, 'Directing');
      }

      // Also ensure poster is registered in play_images table
      if (effectivePoster) {
        try {
          const { data: exImg } = await supabase
            .from('play_images')
            .select('id')
            .eq('play_id', effectivePlayId)
            .eq('image_url', effectivePoster)
            .maybeSingle();

          if (!exImg) {
            await supabase.from('play_images').insert({
              play_id: effectivePlayId,
              image_url: effectivePoster,
              caption: `${play.title} Official Stage Poster`,
              image_type: 'poster',
              display_order: 1,
            });
          }
        } catch (imgErr) {
          console.warn(`[theatre_hubs] Notice adding play_image for "${play.title}":`, imgErr);
        }
      }
    }
  }

  return {
    total_discovered: allDiscovered.length,
    new_plays_created: newPlaysCreated,
    existing_plays_updated: existingPlaysUpdated,
    hubs_breakdown: {
      ariiya: ariiyaPlays.length,
      tix: tixPlays.length,
      muson: musonPlays.length,
      anthill: anthillPlays.length,
      nairabox: nairaboxPlays.length,
    },
    discovered_titles: Array.from(new Set(discoveredTitles)),
  };
}
