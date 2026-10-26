/**
 * WhatsApp Movie Alert Engine with Multi-Actor Deduplicator
 * 
 * Ensures:
 * 1. Users following multiple actors who appear in the same film get EXACTLY ONE message.
 * 2. Uses Meta WhatsApp Cloud API with image header (film poster/backdrop) & action links.
 * 3. Idempotent tracking via whatsapp_movie_alert_log.
 */

import { whatsappRetryAt, MAX_WHATSAPP_ATTEMPTS } from './whatsapp_retry_policy.js';
import { supabase } from './supabase.js';
import { sendMetaWhatsAppTemplate, isWhatsAppConfigured, normalizeWhatsAppNumber } from './meta_whatsapp.js';

/**
 * Writes an alert-log row, retrying briefly.
 *
 * This row is the only record that a user has been messaged: the queue backfill
 * and the idempotency check both read it. If the write is lost, that user looks
 * un-alerted and will be messaged again. The send has already left, so failing
 * loudly cannot undo it -- the useful thing is to try hard, then report.
 */
async function writeAlertLog(payload: Record<string, unknown>): Promise<string | null> {
  let last = '';
  for (let attempt = 1; attempt <= 3; attempt++) {
    const { error } = await supabase
      .from('whatsapp_movie_alert_log')
      .upsert(payload, { onConflict: 'user_id,film_id' });
    if (!error) return null;
    last = error.message;
    if (attempt < 3) await new Promise((r) => setTimeout(r, attempt * 250));
  }
  return last;
}

export interface AlertDispatchResult {
  totalEligibleUsers: number;
  sentCount: number;
  skippedAlreadyNotified: number;
  failedCount: number;
  /**
   * True when the film has no credits yet, so there was nobody to match
   * followers against. This is NOT the same as "no followers": YouTube films
   * are published the moment they are synced but only get credits once the
   * harvester reaches them, so the caller must wait rather than treat the
   * alert as delivered.
   */
  creditsMissing: boolean;
  /** Users skipped because WhatsApp is off, or the number is absent/too short. */
  skippedNotReachable: number;
  /**
   * Messages that went out but whose log row could not be written. These are
   * the only cases that can produce a duplicate on a later pass, so they are
   * reported separately rather than folded into failedCount -- counting them
   * as failures would make the queue retry the whole film and resend.
   */
  unloggedSends: number;
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
    creditsMissing: false,
    skippedNotReachable: 0,
    unloggedSends: 0,
    errors: [],
  };

  if (!isWhatsAppConfigured()) {
    throw new Error('Meta WhatsApp API is not configured');
  }

  const { filmId, title, slug, posterUrl, releaseType, customPlatformName } = filmCtx;

  // 1. Fetch credits for this film to find all involved people
  const { data: credits, error: creditErr } = await supabase
    .from('credits')
    .select('person_id, people(id, name, slug)')
    .eq('film_id', filmId);

  if (creditErr) throw new Error(`Cannot read film credits: ${creditErr.message}`);
  if (!credits || credits.length === 0) {
    console.log('[WhatsApp Alert] No credits found for film:', filmId);
    result.creditsMissing = true;
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

  if (followErr) throw new Error(`Cannot read follows: ${followErr.message}`);
  if (!followRows || followRows.length === 0) {
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

  if (userErr) throw new Error(`Cannot read WhatsApp preferences: ${userErr.message}`);
  if (!users || users.length === 0) return result;

  // 5. Query whatsapp_movie_alert_log for existing notifications for this film to guarantee idempotency
  let alreadyNotifiedUserIds = new Set<string>();
  const { data: existingLogs, error: logReadError } = await supabase
    .from('whatsapp_movie_alert_log')
    .select('user_id,status,attempts,next_retry_at,created_at')
    .eq('film_id', filmId)
    .in('user_id', userIds);

  if (logReadError) throw new Error(`Cannot read alert history: ${logReadError.message}`);

  if (existingLogs) {
    alreadyNotifiedUserIds = new Set(existingLogs.filter(log => {
      if (['sent', 'delivered', 'read'].includes(log.status)) return true;
      return log.status === 'failed' && (!log.next_retry_at
        || Date.parse(log.next_retry_at) > Date.now() || log.attempts >= MAX_WHATSAPP_ATTEMPTS);
    }).map(log => log.user_id));
  }

  // Determine watch platform label
  let platformLabel = customPlatformName || 'MuviDB';
  if (!customPlatformName) {
    if (releaseType === 'theatrical') platformLabel = 'In Cinemas';
    else if (releaseType === 'youtube') platformLabel = 'on YouTube';
    else if (releaseType === 'streaming') platformLabel = 'on Streaming';
  }

  const filmUrl = `https://muvidb.com/film/${slug || filmId}`;
  const poster = posterUrl || 'https://muvidb.com/images/MuviDB%20Brand/Wordmark.png';

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
      result.skippedNotReachable++;
      continue;
    }

    const phone = normalizeWhatsAppNumber(userRow.whatsapp_phone);
    if (!phone || phone.length < 9) {
      result.skippedNotReachable++;
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
    const existingLog = existingLogs?.find(l => l.user_id === uId);
    const attempts = (existingLog?.attempts || 0) + 1;
    const attemptedAt = new Date().toISOString();
    const sendRes = await sendMetaWhatsAppTemplate({
      to: phone,
      templateName: process.env.WHATSAPP_MOVIE_ALERT_TEMPLATE || 'movie_release_alert',
      headerImageUrl: poster,
      bodyParameters: [actorsSummary, title, platformLabel, filmUrl],
      buttonUrlPayload: slug || filmId,
    });

    if (sendRes.ok) {
      result.sentCount++;
      const logError = await writeAlertLog({
        user_id: uId,
        film_id: filmId,
        phone,
        followed_people_names: actorNames,
        message_id: sendRes.messageId || null,
        status: 'sent', attempts, last_attempt_at: attemptedAt,
        next_retry_at: null, error_code: null, issue_notified_at: null,
        error_message: null,
      });
      if (logError) {
        // Keep going. Aborting here stranded every remaining follower without
        // undoing the message that already went out.
        result.unloggedSends++;
        result.errors.push({ userId: uId, error: `Message sent but alert history could not be saved: ${logError}` });
        console.error(`[WhatsApp Alert] Sent to ${uId} but could not record it:`, logError);
      }
    } else {
      result.failedCount++;
      result.errors.push({ userId: uId, error: sendRes.error || 'Failed to send' });
      console.error(`[WhatsApp Alert] Failed sending to user ${uId}:`, sendRes.error);
      const logError = await writeAlertLog({
        user_id: uId, film_id: filmId, phone, followed_people_names: actorNames,
        status: 'failed', message_id: null, error_message: sendRes.error || 'Failed to send',
        attempts, last_attempt_at: attemptedAt, error_code: sendRes.details?.code || null,
        next_retry_at: whatsappRetryAt(sendRes.details?.code, attempts, Date.now(), existingLog?.created_at),
        issue_notified_at: null,
      });
      if (logError) {
        result.errors.push({ userId: uId, error: `Cannot save alert failure: ${logError}` });
        console.error(`[WhatsApp Alert] Could not record failure for ${uId}:`, logError);
      }
    }
  }

  return result;
}
