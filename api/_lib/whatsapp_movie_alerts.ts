/**
 * WhatsApp Movie Alert Engine with Multi-Actor Deduplicator
 * 
 * Ensures:
 * 1. Users following multiple actors who appear in the same film get EXACTLY ONE message.
 * 2. Uses Meta WhatsApp Cloud API with image header (film poster/backdrop) & action links.
 * 3. Idempotent tracking via whatsapp_movie_alert_log.
 */

import { supabase } from './supabase.js';
import { sendMetaWhatsAppTemplate, isWhatsAppConfigured, normalizeWhatsAppNumber } from './meta_whatsapp.js';

export interface AlertDispatchResult {
  totalEligibleUsers: number;
  sentCount: number;
  skippedAlreadyNotified: number;
  failedCount: number;
  errors: Array<{ userId: string; error: string }>;
}

export interface FilmAlertContext {
  filmId: string;
  title: string;
  slug?: string;
  posterUrl?: string;
  releaseType?: string; // cinema, streaming, youtube, etc.
  customPlatformName?: string; // e.g. "In Cinemas", "YouTube", "Netflix"
}

/**
 * Deduplicated WhatsApp Notification Dispatcher:
 * For a given film, finds all cast/crew members, looks up users who follow those people
 * and have WhatsApp alerts enabled, groups them by user, and sends a single notification.
 */
export async function dispatchMovieWhatsAppAlerts(
  filmCtx: FilmAlertContext
): Promise<AlertDispatchResult> {
  const result: AlertDispatchResult = {
    totalEligibleUsers: 0,
    sentCount: 0,
    skippedAlreadyNotified: 0,
    failedCount: 0,
    errors: [],
  };

  if (!isWhatsAppConfigured()) {
    console.warn('[WhatsApp Alert] Meta WhatsApp API is not configured. Skipping alert dispatch.');
    return result;
  }

  const { filmId, title, slug, posterUrl, releaseType, customPlatformName } = filmCtx;

  // 1. Fetch credits for this film to find all involved people
  const { data: credits, error: creditErr } = await supabase
    .from('credits')
    .select('person_id, people(id, name, slug)')
    .eq('film_id', filmId);

  if (creditErr || !credits || credits.length === 0) {
    console.log('[WhatsApp Alert] No credits found for film:', filmId);
    return result;
  }

  // Map personId -> person name
  const personMap = new Map<string, string>();
  for (const c of credits) {
    if (c.person_id && (c as any).people?.name) {
      personMap.set(c.person_id, (c as any).people.name);
    }
  }

  const personIds = Array.from(personMap.keys());
  if (personIds.length === 0) return result;

  // 2. Fetch all followers for these people who have WhatsApp notifications enabled
  const { data: followRows, error: followErr } = await supabase
    .from('follows')
    .select('user_id, person_id, notify_whatsapp')
    .in('person_id', personIds);

  if (followErr || !followRows || followRows.length === 0) {
    console.log('[WhatsApp Alert] No followers found for cast of film:', filmId);
    return result;
  }

  // 3. Group by user_id and collect unique followed actors in this film
  // Filter out any follows where notify_whatsapp is explicitly false
  const userToFollowedPeople = new Map<string, Set<string>>();
  for (const f of followRows) {
    if (f.notify_whatsapp === false) continue;
    const actorName = personMap.get(f.person_id);
    if (!actorName) continue;

    if (!userToFollowedPeople.has(f.user_id)) {
      userToFollowedPeople.set(f.user_id, new Set<string>());
    }
    userToFollowedPeople.get(f.user_id)!.add(actorName);
  }

  const userIds = Array.from(userToFollowedPeople.keys());
  if (userIds.length === 0) return result;

  result.totalEligibleUsers = userIds.length;

  // 4. Fetch user details: whatsapp_phone and whatsapp_enabled
  const { data: users, error: userErr } = await supabase
    .from('users')
    .select('id, name, whatsapp_phone, whatsapp_enabled')
    .in('id', userIds);

  if (userErr || !users || users.length === 0) {
    console.error('[WhatsApp Alert] Error fetching user phone records:', userErr);
    return result;
  }

  // 5. Query whatsapp_movie_alert_log for existing notifications for this film to guarantee idempotency
  let alreadyNotifiedUserIds = new Set<string>();
  try {
    const { data: existingLogs } = await supabase
      .from('whatsapp_movie_alert_log')
      .select('user_id')
      .eq('film_id', filmId)
      .in('user_id', userIds);

    if (existingLogs) {
      alreadyNotifiedUserIds = new Set(existingLogs.map((l) => l.user_id));
    }
  } catch (err) {
    // If the table is brand new or not yet cached, proceed cautiously
    console.warn('[WhatsApp Alert] Could not read existing alert logs:', err);
  }

  // Determine watch platform label
  let platformLabel = customPlatformName || 'MuviDB';
  if (!customPlatformName) {
    if (releaseType === 'theatrical') platformLabel = 'In Cinemas';
    else if (releaseType === 'youtube') platformLabel = 'on YouTube';
    else if (releaseType === 'streaming') platformLabel = 'on Streaming';
  }

  const filmUrl = `https://muvidb.com/film/${slug || filmId}`;
  const poster = posterUrl || 'https://muvidb.com/images/og-default.jpg';

  // 6. Iterate through each unique user, synthesize actor summary, and send ONE message
  for (const userRow of users) {
    const uId = userRow.id;

    // Check if already notified for this movie
    if (alreadyNotifiedUserIds.has(uId)) {
      result.skippedAlreadyNotified++;
      continue;
    }

    // Check if user disabled WhatsApp or has no phone
    if (!userRow.whatsapp_enabled || !userRow.whatsapp_phone) {
      continue;
    }

    const phone = normalizeWhatsAppNumber(userRow.whatsapp_phone);
    if (!phone || phone.length < 9) {
      continue;
    }

    // Build the deduplicated actor string
    // e.g. "Lateef Olofin", "Lateef Olofin & Funke Akindele", or "Lateef Olofin, Funke Akindele, and 2 others"
    const actorNames = Array.from(userToFollowedPeople.get(uId) || []);
    let actorsSummary = '';
    if (actorNames.length === 1) {
      actorsSummary = actorNames[0];
    } else if (actorNames.length === 2) {
      actorsSummary = `${actorNames[0]} & ${actorNames[1]}`;
    } else if (actorNames.length > 2) {
      actorsSummary = `${actorNames[0]}, ${actorNames[1]}, and ${actorNames.length - 2} other(s)`;
    } else {
      actorsSummary = 'Filmmakers you follow';
    }

    // Send Meta Cloud API Template Message
    // Template name: "movie_release_alert"
    // Parameters:
    // {{1}} = Followed Actor(s) (e.g., "Lateef Olofin")
    // {{2}} = Movie Title (e.g., "Jagun Jagun")
    // {{3}} = Where to watch (e.g., "In Cinemas")
    // {{4}} = Film Page Link (e.g., "https://muvidb.com/film/jagun-jagun")
    const sendRes = await sendMetaWhatsAppTemplate({
      to: phone,
      templateName: process.env.WHATSAPP_MOVIE_ALERT_TEMPLATE || 'movie_release_alert',
      headerImageUrl: poster,
      bodyParameters: [actorsSummary, title, platformLabel, filmUrl],
    });

    if (sendRes.ok) {
      result.sentCount++;
      // Log to whatsapp_movie_alert_log
      try {
        await supabase.from('whatsapp_movie_alert_log').insert({
          user_id: uId,
          film_id: filmId,
          phone,
          followed_people_names: actorNames,
          message_id: sendRes.messageId || null,
          status: 'sent',
        });
      } catch (logErr) {
        console.warn('[WhatsApp Alert] Failed to log alert success:', logErr);
      }
    } else {
      result.failedCount++;
      result.errors.push({ userId: uId, error: sendRes.error || 'Failed to send' });
      console.error(`[WhatsApp Alert] Failed sending to user ${uId}:`, sendRes.error);
    }
  }

  return result;
}
