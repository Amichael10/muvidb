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
  let clean = urlOrHandle.trim();
  clean = clean.replace(/\?.*$/, '').replace(/\/$/, '');
  const match = clean.match(/(?:instagram\.com\/|@)?([a-zA-Z0-9._]+)$/i);
  if (match && match[1]) {
    const handle = match[1];
    return handle.startsWith('@') ? handle : `@${handle}`;
  }
  return clean.startsWith('@') ? clean : `@${clean}`;
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
  const { name, department, highlightFilms, profileUrl, claimUrl } = params;
  const firstName = name.split(' ')[0] || name;
  const craft = department || 'filmmaking / acting';
  const filmsMention = highlightFilms.length > 0
    ? highlightFilms.map(f => `"${f}"`).join(' and ')
    : 'your latest projects';

  const prompt = `You are writing a warm, authentic, professional Instagram Direct Message (DM) to an African cinema creator (actor/crew) on behalf of MuviDB (the African cinema & Nollywood database).

Recipient Name: ${name} (Call them ${firstName})
Their Craft/Role: ${craft}
Films they worked on: ${filmsMention}
Their Live Profile URL: ${profileUrl}
Their 1-Click Profile Claim URL: ${claimUrl}

Write a natural, concise Instagram DM (3-5 short sentences max):
1. Greet them warmly and genuinely appreciate their work on ${filmsMention}.
2. Let them know their verified filmography is already indexed and live on MuviDB (${profileUrl}).
3. Invite them to claim their page for free (${claimUrl}) so they can customize their bio, headshot, and receive direct production/casting inquiries.
4. Keep the tone friendly, respectful, and celebratory of African cinema creators. Use 1 or 2 relevant emojis. Do not sound spammy or corporate.

Output ONLY the final DM text.`;

  try {
    const aiResponse = await generateAIContent(prompt, {
      temperature: 0.7,
      maxTokens: 300,
    });

    let message = (typeof aiResponse === 'string' ? aiResponse : JSON.stringify(aiResponse)).trim().replace(/^["']|["']$/g, '');
    if (!message || message.length < 20) {
      throw new Error('AI generated empty response');
    }
    return message;
  } catch (err) {
    // Fallback template if AI router is offline
    const mentions = highlightFilms.length > 0
      ? `your work on ${filmsMention}`
      : 'your work in Nollywood';

    return `Hi ${firstName}! 👋 Big fan of ${mentions}. We’ve indexed your filmography on MuviDB, the African cinema database: ${profileUrl}\n\nYou can claim your official page here to update your bio and headshot: ${claimUrl}\n\nKeep creating amazing work! 🎬✨`;
  }
}

/**
 * Build candidate list from DB
 */
export async function fetchOutreachCandidates(limit = 25, offset = 0): Promise<OutreachCandidate[]> {
  // 1. Fetch people with instagram_url who haven't been claimed
  const { data: people, error } = await serviceSupabase
    .from('people')
    .select('id, name, slug, instagram_url, known_for_department, film_count, claimed_by')
    .not('instagram_url', 'is', null)
    .is('claimed_by', null)
    .order('film_count', { ascending: true })
    .range(offset, offset + limit * 3 - 1);

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
export async function generateQueueBatch(count = 25): Promise<{ queued: number; candidates: OutreachCandidate[] }> {
  const candidates = await fetchOutreachCandidates(count);
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
