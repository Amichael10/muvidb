import { supabase as serviceSupabase } from './supabase.js';
import { generateAIContent } from './ai_service.js';

export interface OutreachCandidate {
  id: string;
  person_id: string;
  name: string;
  instagram_url: string;
  instagram_handle: string;
  known_for_department: string;
  film_count: number;
  highlight_films: string[];
  profile_url: string;
  claim_url: string;
  message: string;
  status: 'pending' | 'queued' | 'sent' | 'replied' | 'skipped';
  contacted_at?: string | null;
  created_at?: string;
}

/**
 * Extract clean Instagram handle from URL or raw handle string
 */
export function extractInstagramHandle(urlOrHandle: string): string {
  if (!urlOrHandle) return '';
  let clean = urlOrHandle.trim().replace(/[?#].*$/, '').replace(/\/+$/, '');
  if (!clean) return '';

  const igIndex = clean.toLowerCase().indexOf('instagram.com/');
  if (igIndex !== -1) {
    clean = clean.substring(igIndex + 'instagram.com/'.length);
  }

  const segments = clean.split('/').map((s) => s.trim()).filter(Boolean);
  let candidate = segments[0] || '';
  candidate = candidate.replace(/^@/, '').trim();

  const reserved = ['p', 'reel', 'reels', 'stories', 'explore', 'direct', 'accounts'];
  if (reserved.includes(candidate.toLowerCase()) && segments[1]) {
    candidate = segments[1].replace(/^@/, '').trim();
  }

  if (
    /^[a-zA-Z0-9._]{1,30}$/.test(candidate) &&
    candidate.toLowerCase() !== 'instagram.com' &&
    !candidate.startsWith('http')
  ) {
    return `@${candidate}`;
  }
  return '';
}

/**
 * Fetch top 1-2 film titles a person has credits for
 */
export async function getHighlightFilms(personId: string): Promise<string[]> {
  const { data: credits, error } = await serviceSupabase
    .from('credits')
    .select('film_id, role, films(id, title, year)')
    .eq('person_id', personId)
    .limit(4);

  if (error || !credits || credits.length === 0) return [];

  const titles: string[] = [];
  for (const c of credits) {
    const film = c.films as any;
    if (film?.title && !titles.includes(film.title)) {
      titles.push(film.title);
      if (titles.length >= 2) break;
    }
  }
  return titles;
}

/**
 * Generate a personalized, human-feeling Instagram DM
 */
export async function generatePersonalizedPitch(params: {
  name: string;
  department?: string | null;
  highlightFilms: string[];
  profileUrl: string;
  claimUrl: string;
}): Promise<string> {
  const { name, highlightFilms, profileUrl, claimUrl } = params;
  const firstName = name.split(' ')[0] || name;
  const filmMention = highlightFilms.length > 0
    ? highlightFilms.map(f => f.trim()).join(' and ')
    : 'Nollywood projects';

  const prompt = `You are writing a warm, authentic, personal Instagram Direct Message (DM) to an African cinema creator on behalf of MuviDB (the African cinema database).

Recipient Name: ${name} (Call them ${firstName})
Films they worked on: ${filmMention}
Profile Link: ${profileUrl}
Claim Link: ${claimUrl}

Write a natural DM following this exact structure and tone:
"Hi ${firstName} 👋
I came across your work while we were documenting the cast and credits for ${filmMention}, and I realised you already have quite a body of work behind you.
We’re building MuviDB to properly document African films and the people who make them, especially work that often gets missed because it lives on YouTube and other platforms.
We’ve started putting your filmography together here: ${profileUrl}
If you notice anything missing or incorrect, I’d genuinely love for you to tell us. You can also claim the page whenever you want, which lets you update your photo and profile directly: ${claimUrl}
Keep going. We’re looking forward to documenting more of your work 🎬"

Output ONLY the final DM text. Do not wrap in extra quotes.`;

  try {
    const aiResponse = await generateAIContent(prompt);
    const rawText = (aiResponse as any)?.text || (typeof aiResponse === 'string' ? aiResponse : '');
    let message = rawText.trim().replace(/^["']|["']$/g, '');
    if (!message || message.length < 20) {
      throw new Error('AI generated empty response');
    }
    return message;
  } catch (err) {
    return `Hi ${firstName} 👋\nI came across your work while we were documenting the cast and credits for ${filmMention}, and I realised you already have quite a body of work behind you.\nWe’re building MuviDB to properly document African films and the people who make them, especially work that often gets missed because it lives on YouTube and other platforms.\nWe’ve started putting your filmography together here: ${profileUrl}\nIf you notice anything missing or incorrect, I’d genuinely love for you to tell us. You can also claim the page whenever you want, which lets you update your photo and profile directly: ${claimUrl}\nKeep going. We’re looking forward to documenting more of your work 🎬`;
  }
}

export interface FetchCandidatesOptions {
  limit?: number;
  offset?: number;
  minFilms?: number;
  maxFilms?: number;
  craft?: string | null;
}

/**
 * Build candidate list from DB with optional film count and craft filters
 */
export async function fetchOutreachCandidates(options?: FetchCandidatesOptions | number): Promise<OutreachCandidate[]> {
  const opts: FetchCandidatesOptions = typeof options === 'number' ? { limit: options } : (options || {});
  const limit = opts.limit ?? 25;
  const offset = opts.offset ?? 0;
  const minFilms = opts.minFilms ?? 1;
  const maxFilms = opts.maxFilms ?? 10;
  const craft = opts.craft && opts.craft !== 'all' ? opts.craft.trim() : null;

  // 1. Fetch people with instagram_url who haven't been claimed
  let query = serviceSupabase
    .from('people')
    .select('id, name, slug, instagram_url, known_for_department, film_count, claimed_by')
    .not('instagram_url', 'is', null)
    .neq('instagram_url', '')
    .is('claimed_by', null)
    .gte('film_count', minFilms);

  if (maxFilms) {
    query = query.lte('film_count', maxFilms);
  }
  if (craft) {
    query = query.ilike('known_for_department', `%${craft}%`);
  }

  const { data: people, error } = await query
    .order('film_count', { ascending: true })
    .range(offset, offset + limit * 4 - 1);

  if (error || !people) {
    console.error('Error fetching outreach candidates:', error);
    return [];
  }

  // 2. Fetch existing outreach statuses from artist_outreach
  const personIds = people.map(p => p.id);
  const { data: existingRecords } = await serviceSupabase
    .from('artist_outreach')
    .select('person_id, status, last_message, contacted_at, created_at')
    .in('person_id', personIds);

  const existingMap = new Map((existingRecords || []).map(r => [r.person_id, r]));

  // 3. Filter out already sent or skipped
  const candidates: OutreachCandidate[] = [];

  for (const p of people) {
    const existing = existingMap.get(p.id);
    if (existing && (existing.status === 'sent' || existing.status === 'skipped' || existing.status === 'replied')) {
      continue;
    }

    const igHandle = extractInstagramHandle(p.instagram_url);
    if (!igHandle || igHandle === '@') continue;

    const personSlug = p.slug || p.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const profileUrl = `https://muvidb.com/people/${personSlug}`;
    const claimUrl = `https://muvidb.com/claim/${personSlug}`;

    candidates.push({
      id: p.id,
      person_id: p.id,
      name: p.name,
      instagram_url: p.instagram_url,
      instagram_handle: igHandle,
      known_for_department: p.known_for_department || 'Crew / Actor',
      film_count: p.film_count || 0,
      highlight_films: [],
      profile_url: profileUrl,
      claim_url: claimUrl,
      message: existing?.last_message || '',
      status: (existing?.status as any) || 'pending',
      contacted_at: existing?.contacted_at || null,
      created_at: existing?.created_at || new Date().toISOString(),
    });

    if (candidates.length >= limit) break;
  }

  return candidates;
}

/**
 * Generate queue batch with personalized AI messages and store in DB
 */
export async function generateQueueBatch(options?: FetchCandidatesOptions | number): Promise<{ queued: number; candidates: OutreachCandidate[] }> {
  const candidates = await fetchOutreachCandidates(options);
  const results: OutreachCandidate[] = [];

  for (const candidate of candidates) {
    // 1. Fetch highlight films
    const highlightFilms = await getHighlightFilms(candidate.person_id);
    candidate.highlight_films = highlightFilms;

    // 2. Generate personalized AI pitch if not already generated
    if (!candidate.message || candidate.status === 'pending') {
      const pitch = await generatePersonalizedPitch({
        name: candidate.name,
        department: candidate.known_for_department,
        highlightFilms,
        profileUrl: candidate.profile_url,
        claimUrl: candidate.claim_url,
      });
      candidate.message = pitch;
    }

    candidate.status = 'queued';

    // 3. Upsert into artist_outreach table
    await serviceSupabase
      .from('artist_outreach')
      .upsert({
        person_id: candidate.person_id,
        status: 'queued',
        last_message: candidate.message,
        notes: `Target: ${candidate.known_for_department} (${candidate.film_count} credits)`,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'person_id' });

    results.push(candidate);
  }

  return { queued: results.length, candidates: results };
}
