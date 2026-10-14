import { supabase } from './supabase.js';
import { dispatchMovieWhatsAppAlerts } from './whatsapp_movie_alerts.js';

export async function enqueueMovieWhatsAppAlert(filmId: string) {
  const { error } = await supabase.from('whatsapp_movie_alert_queue').upsert({
    film_id: filmId, queued_at: new Date().toISOString(), available_at: new Date().toISOString(),
  }, { onConflict: 'film_id' });
  if (error) throw new Error(`Cannot queue WhatsApp alert: ${error.message}`);
}

export async function runWhatsAppAlertQueue() {
  const result = { processed: 0, sent: 0, failed: 0, deferred: 0 };
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
        .select('id,title,slug,poster_url,release_type,is_published,is_in_cinemas')
        .eq('id', job.film_id).single();
      if (filmError) throw new Error(filmError.message);
      if (!film.is_published && !film.is_in_cinemas) {
        result.deferred++;
        retryDelay = 60 * 60_000;
        retryError = 'Waiting for film publication';
      } else {
        const dispatch = await dispatchMovieWhatsAppAlerts({
          filmId: film.id, title: film.title, slug: film.slug,
          posterUrl: film.poster_url, releaseType: film.release_type,
        });
        result.sent += dispatch.sentCount;
        if (dispatch.failedCount) throw new Error(dispatch.errors.map(e => e.error).join('; '));
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
