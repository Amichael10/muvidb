/**
 * Turns an Instagram @handle into a real person, without ever guessing.
 *
 * Order of attack, cheapest and most trustworthy first:
 *   1. Do we already store this handle? Then we are done — no API call.
 *   2. Ask Instagram Business Discovery for the account's full name.
 *   3. Does a person with that name already exist? Then propose linking the
 *      handle to them.
 *   4. Otherwise propose creating a new person.
 *
 * Nothing here writes to `people`. Steps 3 and 4 produce a *proposal* that is
 * staged for a human to approve in Telegram, because a wrong match silently
 * becoming a real person is far more expensive than a missing one.
 *
 * Business Discovery only resolves Business/Creator accounts; a personal
 * account returns error 110. That is an ordinary outcome, not a failure — we
 * leave the handle alone rather than invent a name for it.
 */
import { supabase } from './supabase.js';
import { decryptThreadsToken } from './threads_oauth.js';

const GRAPH = 'https://graph.facebook.com/v21.0';

export interface DiscoveredProfile {
  username: string;
  name: string;
  followers?: number | null;
  profilePictureUrl?: string | null;
}

export type InstagramLookup =
  | { status: 'known'; handle: string; person: PersonRef }
  | { status: 'match'; handle: string; person: PersonRef; profile: DiscoveredProfile }
  | { status: 'new'; handle: string; profile: DiscoveredProfile }
  | { status: 'unresolved'; handle: string; reason: string };

export interface PersonRef {
  id: string;
  name: string;
  slug: string | null;
  instagram_url: string | null;
}

/**
 * Accepts anything an admin might paste — `@name`, a profile URL, a URL with
 * query junk — and returns the bare handle, or null if there isn't one.
 */
export function normalizeInstagramHandle(input?: string | null): string | null {
  let raw = String(input || '').trim();
  if (!raw) return null;

  if (/instagram\.com/i.test(raw)) {
    try {
      const url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
      raw = url.pathname.split('/').filter(Boolean)[0] || '';
    } catch {
      return null;
    }
  }

  raw = raw.split('?')[0].split('#')[0].replace(/^@/, '').replace(/\/+$/, '').trim();
  // Instagram allows letters, numbers, dots and underscores, max 30 chars.
  if (!/^[a-zA-Z0-9._]{1,30}$/.test(raw)) return null;
  return raw.toLowerCase();
}

/**
 * Would this be an embarrassing name to put in the catalogue? Display names are
 * free text, so they arrive as "🔥BOOKINGS DM🔥" as often as "Olufunke Akindele".
 */
export function nameLooksUsable(name?: string | null): boolean {
  const raw = String(name || '').trim();
  if (raw.length < 3 || raw.length > 60) return false;
  // Needs at least two letter-runs, i.e. something resembling a first and last name.
  const words = raw.split(/\s+/).filter((w) => /\p{L}/u.test(w));
  if (words.length < 2) return false;
  // Reject promo copy rather than a person.
  if (/\b(dm|book|booking|enquir|promo|official page|manager|contact|link in bio|ceo|brand)\b/i.test(raw)) return false;
  // Mostly symbols or emoji is not a name.
  const letters = (raw.match(/\p{L}/gu) || []).length;
  return letters / raw.length >= 0.6;
}

/** The IG business account we query *through*, plus its decrypted token. */
async function getInstagramCaller(): Promise<{ igId: string; token: string } | null> {
  const { data, error } = await supabase
    .from('social_connections')
    .select('*')
    .eq('platform', 'instagram')
    .eq('status', 'connected')
    .limit(1)
    .maybeSingle();
  if (error || !data?.external_account_id) return null;

  try {
    const { accessToken } = decryptThreadsToken(data);
    if (!accessToken) return null;
    return { igId: String(data.external_account_id), token: accessToken };
  } catch {
    return null;
  }
}

/** Ask Instagram for an account's public profile. Null when it cannot be resolved. */
export async function discoverInstagramProfile(handle: string): Promise<DiscoveredProfile | null> {
  const caller = await getInstagramCaller();
  if (!caller) return null;

  const fields = `business_discovery.username(${handle})%7Busername,name,followers_count,profile_picture_url%7D`;
  const url = `${GRAPH}/${caller.igId}?fields=${fields}&access_token=${encodeURIComponent(caller.token)}`;

  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
    const body: any = await res.json().catch(() => ({}));
    const found = body?.business_discovery;
    if (!res.ok || !found) return null;
    return {
      username: String(found.username || handle),
      name: String(found.name || '').trim(),
      followers: found.followers_count ?? null,
      profilePictureUrl: found.profile_picture_url || null,
    };
  } catch {
    return null;
  }
}

/**
 * Anyone already carrying this handle.
 *
 * The SQL filter is only a cheap prefilter and is deliberately not trusted: a
 * LIKE of `%/handle%` matches far too much -- searching for "instagram" hits
 * every row, because every stored value contains "instagram.com/". Each
 * candidate is therefore normalised and compared exactly.
 */
async function findPersonByHandle(handle: string): Promise<PersonRef | null> {
  const { data } = await supabase
    .from('people')
    .select('id,name,slug,instagram_url')
    .ilike('instagram_url', `%${handle}%`)
    .limit(50);

  for (const row of (data || []) as PersonRef[]) {
    if (normalizeInstagramHandle(row.instagram_url) === handle) return row;
  }
  return null;
}

/** Anyone already going by this name. */
async function findPersonByName(name: string): Promise<PersonRef | null> {
  const { data } = await supabase
    .from('people')
    .select('id,name,slug,instagram_url')
    .ilike('name', name)
    .limit(1)
    .maybeSingle();
  return (data as PersonRef) || null;
}

export async function resolveInstagramHandle(input: string): Promise<InstagramLookup> {
  const handle = normalizeInstagramHandle(input);
  if (!handle) return { status: 'unresolved', handle: String(input || ''), reason: 'Not a usable Instagram handle' };

  // 1. Already known — free, and the strongest answer available.
  const existing = await findPersonByHandle(handle);
  if (existing) return { status: 'known', handle, person: existing };

  // 2. Ask Instagram.
  const profile = await discoverInstagramProfile(handle);
  if (!profile) {
    return {
      status: 'unresolved',
      handle,
      reason: 'Instagram did not return a profile. Personal accounts cannot be looked up — only Business or Creator ones.',
    };
  }
  if (!nameLooksUsable(profile.name)) {
    return {
      status: 'unresolved',
      handle,
      reason: `Instagram returned "${profile.name || '(blank)'}", which does not read like a person's name.`,
    };
  }

  // 3. Known under that name? Then this is a link, not a new person.
  const byName = await findPersonByName(profile.name);
  if (byName) return { status: 'match', handle, person: byName, profile };

  // 4. Genuinely new.
  return { status: 'new', handle, profile };
}

/**
 * Writes the proposal into the same intake table the Telegram person wizard
 * already reads, so approval happens with the buttons admins know rather than
 * a new screen. Returns the event id to show a card for.
 */
export async function stageInstagramPerson(
  lookup: InstagramLookup,
  context: { chatId?: string | number | null; sourceUrl?: string | null } = {},
): Promise<{ eventId: string } | null> {
  if (lookup.status !== 'new' && lookup.status !== 'match') return null;

  const name = lookup.status === 'match' ? lookup.person.name : lookup.profile.name;
  const linkingTo = lookup.status === 'match' ? lookup.person.id : null;

  const { data, error } = await supabase
    .from('social_news_events')
    .insert({
      event_type: 'talent_intake',
      title: `Instagram: @${lookup.handle} -> ${name}`,
      description: lookup.status === 'match'
        ? `Proposed: attach @${lookup.handle} to the existing person "${name}".`
        : `Proposed: create "${name}" from @${lookup.handle}.`,
      source_type: 'telegram_bot',
      source_url: context.sourceUrl || `https://instagram.com/${lookup.handle}`,
      urgency: 'normal',
      status: 'pending',
      metadata: {
        intake_kind: 'person',
        workflow_status: 'awaiting_review',
        origin: 'instagram_business_discovery',
        instagram_handle: lookup.handle,
        // Set when we are attaching to someone who already exists, so the
        // approve step updates rather than creating a duplicate.
        link_to_person_id: linkingTo,
        followers: lookup.profile.followers ?? null,
        image_url: lookup.profile.profilePictureUrl || null,
        extracted_payload: {
          name,
          primary_role: 'actor',
          instagram_handle: lookup.handle,
          bio: null,
        },
      },
    })
    .select('id')
    .single();

  if (error || !data) return null;
  return { eventId: data.id };
}
