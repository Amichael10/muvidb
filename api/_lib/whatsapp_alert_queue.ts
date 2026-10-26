import { supabase } from './supabase.js';
import { dispatchMovieWhatsAppAlerts } from './whatsapp_movie_alerts.js';

/**
 * How long to keep waiting for a film's credits before giving up on its alert.
 * Credits arrive from the harvester hours or days after a YouTube film is
 * published, so the queue has to tolerate a long gap -- but not forever, or
 * films that never get credited accumulate as permanently deferred jobs.
 */
const CREDIT_WAIT_MS = Number(process.env.WHATSAPP_ALERT_CREDIT_WAIT_DAYS || 7) * 86_400_000;

/**
 * Only films that entered the catalogue recently are eligible. Without a window
 * the first scan would enqueue the entire back catalogue and alert followers
 * about films released years ago.
 */
const LOOKBACK_MS = Number(process.env.WHATSAPP_ALERT_LOOKBACK_DAYS || 14) * 86_400_000;

/** Ceiling per scan, so one pass cannot flood the queue. */
const BACKFILL_LIMIT = Number(process.env.WHATSAPP_ALERT_BACKFILL_LIMIT || 25);

export async function enqueueMovieWhatsAppAlert(filmId: string) {
  const { error } = await supabase.from('whatsapp_movie_alert_queue').upsert({
    film_id: filmId, queued_at: new Date().toISOString(), available_at: new Date().toISOString(),
  }, { onConflict: 'film_id' });
  if (error) throw new Error(`Cannot queue WhatsApp alert: ${error.message}`);
}

export interface AlertBackfillResult {
  followedPeople: number;
  candidateFilms: number;
  enqueued: number;
  alreadyQueued: number;
  alreadyAlerted: number;
}

/**
 * Finds films that should have produced a follower alert and never did, then
 * queues them.
 *
 * WHY THIS EXISTS
 * Nothing in the publishing pipeline calls enqueueMovieWhatsAppAlert -- not the
 * YouTube sync, not the filmography sync, not an admin publishing a film. The
 * only producer was an admin-only `trigger-alert` endpoint that no code path
 * ever hit, so the drain below ran every five minutes against a permanently
 * empty queue and followers were only ever notified by hand.
 *
 * The scan is driven from `follows` rather than from `films`: the work is then
 * proportional to how many people are actually followed, instead of to the size
 * of the catalogue, and a film nobody follows is never considered at all.
 */
export async function backfillMovieWhatsAppAlertQueue(): Promise<AlertBackfillResult> {
  const result: AlertBackfillResult = {
    followedPeople: 0, candidateFilms: 0, enqueued: 0, alreadyQueued: 0, alreadyAlerted: 0,
  };

  // 1. Who is followed, by someone who still wants WhatsApp for that follow.
  const { data: follows, error: followError } = await supabase
    .from('follows')
    .select('user_id, person_id, notify_whatsapp');
  if (followError) throw new Error(`Cannot read follows: ${followError.message}`);

  const wanted = (follows || []).filter((f: any) => f.notify_whatsapp !== false && f.person_id && f.user_id);
  if (!wanted.length) return result;

  // 2. Keep only followers who could actually receive a message. Without this
  //    the scan would queue films for users the dispatcher will skip anyway.
  const followerIds = [...new Set(wanted.map((f: any) => f.user_id as string))];
  const reachable = new Set<string>();
  for (let i = 0; i < followerIds.length; i += 200) {
    const { data, error } = await supabase
      .from('users')
      .select('id, whatsapp_enabled, whatsapp_phone')
      .in('id', followerIds.slice(i, i + 200));
    if (error) throw new Error(`Cannot read WhatsApp preferences: ${error.message}`);
    for (const u of data || []) {
      if (u.whatsapp_enabled && u.whatsapp_phone) reachable.add(u.id);
    }
  }
  if (!reachable.size) return result;

  const personToUsers = new Map<string, Set<string>>();
  for (const f of wanted) {
    if (!reachable.has(f.user_id)) continue;
    if (!personToUsers.has(f.person_id)) personToUsers.set(f.person_id, new Set());
    personToUsers.get(f.person_id)!.add(f.user_id);
  }
  const personIds = [...personToUsers.keys()];
  result.followedPeople = personIds.length;
  if (!personIds.length) return result;

  // 3. Films those people are credited on. A film with no credits yet cannot
  //    appear here, which is exactly right -- it becomes eligible the moment
  //    the harvester credits it.
  const filmToUsers = new Map<string, Set<string>>();
  for (let i = 0; i < personIds.length; i += 100) {
    const { data, error } = await supabase
      .from('credits')
      .select('film_id, person_id')
      .in('person_id', personIds.slice(i, i + 100));
    if (error) throw new Error(`Cannot read credits: ${error.message}`);
    for (const c of data || []) {
      if (!c.film_id) continue;
      if (!filmToUsers.has(c.film_id)) filmToUsers.set(c.film_id, new Set());
      for (const u of personToUsers.get(c.person_id) || []) filmToUsers.get(c.film_id)!.add(u);
    }
  }
  if (!filmToUsers.size) return result;

  // 4. Narrow to films that are actually live and recent.
  const since = new Date(Date.now() - LOOKBACK_MS).toISOString();
  const filmIds = [...filmToUsers.keys()];
  const live: string[] = [];
  for (let i = 0; i < filmIds.length; i += 100) {
    const { data, error } = await supabase
      .from('films')
      .select('id, content_type, is_published, is_in_cinemas, created_at')
      .in('id', filmIds.slice(i, i + 100))
      .gte('created_at', since);
    if (error) throw new Error(`Cannot read films: ${error.message}`);
    for (const f of data || []) {
      if (f.content_type !== 'series' && (f.is_published || f.is_in_cinemas)) live.push(f.id);
    }
  }
  result.candidateFilms = live.length;
  if (!live.length) return result;

  // 5. Drop films where every eligible follower has already been logged. Per
  //    (user, film) rather than per film, so a NEW follower on an existing film
  //    still gets queued while nobody is messaged twice.
  const logged = new Map<string, Set<string>>();
  for (let i = 0; i < live.length; i += 100) {
    const { data, error } = await supabase
      .from('whatsapp_movie_alert_log')
      .select('film_id, user_id')
      .in('film_id', live.slice(i, i + 100));
    if (error) throw new Error(`Cannot read alert history: ${error.message}`);
    for (const row of data || []) {
      if (!logged.has(row.film_id)) logged.set(row.film_id, new Set());
      logged.get(row.film_id)!.add(row.user_id);
    }
  }

  const outstanding = live.filter((filmId) => {
    const done = logged.get(filmId);
    const owed = [...(filmToUsers.get(filmId) || [])];
    const pending = owed.filter((u) => !done?.has(u));
    if (!pending.length) result.alreadyAlerted++;
    return pending.length > 0;
  });
  if (!outstanding.length) return result;

  // 6. Skip anything already waiting in the queue, so a deferred job keeps its
  //    original queued_at and the claim lease is not disturbed.
  const queued = new Set<string>();
  for (let i = 0; i < outstanding.length; i += 100) {
    const { data, error } = await supabase
      .from('whatsapp_movie_alert_queue')
      .select('film_id')
      .in('film_id', outstanding.slice(i, i + 100));
    if (error) throw new Error(`Cannot read alert queue: ${error.message}`);
    for (const row of data || []) queued.add(row.film_id);
  }

  for (const filmId of outstanding) {
    if (queued.has(filmId)) { result.alreadyQueued++; continue; }
    if (result.enqueued >= BACKFILL_LIMIT) break;
    await enqueueMovieWhatsAppAlert(filmId);
    result.enqueued++;
  }

  return result;
}

export async function runWhatsAppAlertQueue() {
  // suppressedFilms is recorded, not just logged: the job is deleted without
  // writing an alert-log row, so a movie mislabelled as a series would
  // otherwise lose its alert with nothing to trace it by. The cron stores this
  // result in sync_logs.details.
  const result = { processed: 0, sent: 0, failed: 0, deferred: 0, suppressed: 0, suppressedFilms: [] as string[] };
  const deadline = Date.now() + 200_000;
  while (result.processed < 20 && Date.now() < deadline) {
    const { data, error } = await supabase.rpc('claim_whatsapp_movie_alert');
    if (error) throw new Error(`Cannot claim WhatsApp alert: ${error.message}`);
    const job = data?.[0];
    if (!job) break;
    result.processed++;
    let retryError: string | null = null;
    let retryDelay = 5 * 60_000;
    try {
      const { data: film, error: filmError } = await supabase.from('films')
        .select('id,title,slug,poster_url,release_type,content_type,is_published,is_in_cinemas')
        .eq('id', job.film_id).single();
      if (filmError) throw new Error(filmError.message);
      // Episodic alerts quickly exhaust Meta's recipient-level marketing
      // allowance and prevent actual movie releases from being delivered.
      if (film.content_type === 'series') {
        console.log('[WhatsApp Alert] Suppressing episodic alert:', film.id, film.title);
        result.suppressed++;
        result.suppressedFilms.push(`${film.title || 'Untitled'} (${film.id})`);
      } else if (!film.is_published && !film.is_in_cinemas) {
        result.deferred++;
        retryDelay = 60 * 60_000;
        retryError = 'Waiting for film publication';
      } else {
        const dispatch = await dispatchMovieWhatsAppAlerts({
          filmId: film.id, title: film.title, slug: film.slug,
          posterUrl: film.poster_url, releaseType: film.release_type,
        });
        result.sent += dispatch.sentCount;
        // No credits yet means nobody could be matched against the cast.
        // Completing here would delete the job and lose the alert for good,
        // which is what happened to every film published before the credit
        // harvester reached it. Wait instead, up to CREDIT_WAIT_MS.
        const waitedTooLong = Date.now() - Date.parse(job.queued_at) > CREDIT_WAIT_MS;
        if (dispatch.creditsMissing && !waitedTooLong) {
          result.deferred++;
          retryDelay = 30 * 60_000;
          retryError = 'Waiting for credits to be harvested';
        } else if (dispatch.failedCount) {
          throw new Error(dispatch.errors.map(e => e.error).join('; '));
        }
      }
    } catch (error) {
      result.failed++;
      retryError = error instanceof Error ? error.message : String(error);
    }
    if (retryError) {
      const { error } = await supabase.from('whatsapp_movie_alert_queue').update({
        locked_until: null, available_at: new Date(Date.now() + retryDelay).toISOString(),
        last_error: retryError,
      }).eq('film_id', job.film_id).eq('locked_until', job.locked_until);
      if (error) throw new Error(error.message);
    } else {
      // A credit arriving during delivery must survive for the next pass.
      const { error } = await supabase.from('whatsapp_movie_alert_queue').delete()
        .eq('film_id', job.film_id).eq('queued_at', job.queued_at);
      if (error) throw new Error(error.message);
      const { error: unlockError } = await supabase.from('whatsapp_movie_alert_queue')
        .update({ locked_until: null }).eq('film_id', job.film_id).eq('locked_until', job.locked_until);
      if (unlockError) throw new Error(unlockError.message);
    }
  }
  return result;
}
