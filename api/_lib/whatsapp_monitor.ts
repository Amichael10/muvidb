import { supabase } from './supabase.js';
import { sendTelegramMessage, telegramConfigured } from './telegram.js';
import { enqueueMovieWhatsAppAlert } from './whatsapp_alert_queue.js';
import { MAX_WHATSAPP_ATTEMPTS, UNCONFIRMED_AFTER_MS } from './whatsapp_retry_policy.js';

export async function getWhatsAppHealth() {
  const cutoff = new Date(Date.now() - UNCONFIRMED_AFTER_MS).toISOString();
  const fields = 'id,film_id,status,error_message,error_code,attempts,last_attempt_at,next_retry_at,films(title)';
  const results = await Promise.all([
    supabase.from('whatsapp_movie_alert_log').select(fields, { count: 'exact' }).eq('status', 'failed').order('last_attempt_at', { ascending: false }).limit(50),
    supabase.from('whatsapp_movie_alert_log').select(fields, { count: 'exact' }).eq('status', 'sent').lt('last_attempt_at', cutoff).order('last_attempt_at').limit(50),
    supabase.from('whatsapp_movie_alert_queue').select('film_id,last_error,available_at,films(title)', { count: 'exact' }).not('last_error', 'is', null).neq('last_error', 'Waiting for film publication').limit(20),
    supabase.from('whatsapp_movie_alert_log').select(fields).order('last_attempt_at', { ascending: false }).limit(20),
  ]);
  for (const result of results) if (result.error) throw new Error(result.error.message);
  return {
    failedCount: results[0].count || 0, unconfirmedCount: results[1].count || 0,
    queueErrorCount: results[2].count || 0,
    failed: results[0].data || [], unconfirmed: results[1].data || [],
    queueErrors: results[2].data || [], recent: results[3].data || [],
    notificationsConfigured: telegramConfigured(), checkedAt: new Date().toISOString(),
  };
}

export async function monitorWhatsAppAlerts() {
  const deadline = Date.now() + 45_000;
  const now = new Date().toISOString();
  const { data: retries, error } = await supabase.from('whatsapp_movie_alert_log')
    .select('film_id').eq('status', 'failed').lt('attempts', MAX_WHATSAPP_ATTEMPTS)
    .lte('next_retry_at', now).limit(100);
  if (error) throw new Error(error.message);
  for (const filmId of new Set((retries || []).map(row => row.film_id))) await enqueueMovieWhatsAppAlert(filmId);

  if (!telegramConfigured()) return { retryCandidates: retries?.length || 0, notificationsConfigured: false };
  const cutoff = new Date(Date.now() - UNCONFIRMED_AFTER_MS).toISOString();
  const { data: issues, error: issueError } = await supabase.from('whatsapp_movie_alert_log')
    .select('id,film_id,status,error_message,attempts,next_retry_at,last_attempt_at,films(title)')
    .is('issue_notified_at', null)
    .or(`status.eq.failed,and(status.eq.sent,last_attempt_at.lt.${cutoff})`)
    .order('last_attempt_at').limit(20);
  if (issueError) throw new Error(issueError.message);
  const { data: queueIssues, error: queueError } = await supabase.from('whatsapp_movie_alert_queue')
    .select('film_id,last_error,films(title)').is('issue_notified_at', null)
    .not('last_error', 'is', null).neq('last_error', 'Waiting for film publication').limit(20);
  if (queueError) throw new Error(queueError.message);
  let notified = 0;
  for (const [table, rows, key] of [
    ['whatsapp_movie_alert_log', issues || [], 'id'],
    ['whatsapp_movie_alert_queue', queueIssues || [], 'film_id'],
  ] as const) {
    for (const row of rows as any[]) {
      if (Date.now() >= deadline) return { retryCandidates: retries?.length || 0, notified, notificationsConfigured: true };
      // Claim notification atomically to avoid repeats from overlapping cron runs.
      let claim = supabase.from(table).update({ issue_notified_at: now })
        .eq(key, row[key]).is('issue_notified_at', null);
      if (table === 'whatsapp_movie_alert_log') {
        claim = claim.eq('status', row.status).eq('last_attempt_at', row.last_attempt_at);
      }
      const { data: claimed, error: claimError } = await claim.select(key);
      if (claimError) throw new Error(claimError.message);
      if (!claimed?.length) continue;
      const detail = row.status === 'sent' ? 'No delivery confirmation after 30 minutes. Not resent automatically.'
        : (row.error_message || row.last_error || 'Delivery failed');
      const text = `WhatsApp alert needs attention\n${row.films?.title || row.film_id}\n${detail}\n${row.next_retry_at ? `Retry scheduled: ${row.next_retry_at}` : 'Check the admin overview.'}\nhttps://muvidb.com/admin`;
      const sent = await sendTelegramMessage(text);
      if (!sent.ok) {
        const { error: resetError } = await supabase.from(table).update({ issue_notified_at: null }).eq(key, row[key]).eq('issue_notified_at', now);
        if (resetError) throw new Error(resetError.message);
        throw new Error(`WhatsApp monitoring notification failed: ${sent.error}`);
      }
      notified++;
    }
  }
  return { retryCandidates: retries?.length || 0, notified, notificationsConfigured: true };
}
