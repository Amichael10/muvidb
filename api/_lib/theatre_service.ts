import { supabase } from './supabase.js';

export type PlayStatus = 'upcoming' | 'currently_running' | 'archived';

/**
 * Derive date-accurate status for a play
 */
export function derivePlayStatus(
  play: { run_start_date?: string | null; run_end_date?: string | null; year?: number | null; status?: string | null },
  refDate: Date = new Date()
): PlayStatus {
  const todayStr = refDate.toISOString().slice(0, 10);
  const currentYear = refDate.getFullYear();

  const start = play?.run_start_date ? String(play.run_start_date).slice(0, 10) : null;
  const end = play?.run_end_date ? String(play.run_end_date).slice(0, 10) : null;

  if (start && end) {
    if (end < todayStr) return 'archived';
    if (start <= todayStr && end >= todayStr) return 'currently_running';
    return 'upcoming';
  }

  if (start && !end) {
    if (start < todayStr) return 'archived';
    if (start === todayStr) return 'currently_running';
    return 'upcoming';
  }

  if (!start && end) {
    if (end < todayStr) return 'archived';
    return 'currently_running';
  }

  if (play?.year && Number(play.year) < currentYear) {
    return 'archived';
  }

  return (play?.status as PlayStatus) || 'archived';
}

/**
 * Sweep and update all plays in the database to ensure their `status` column
 * matches their run dates. Moves plays from `upcoming` -> `archived` or `currently_running`
 * when their dates arrive or pass.
 */
export async function sweepAndUpdatePlayStatuses(): Promise<{
  total: number;
  updated: number;
  archived: number;
  running: number;
  upcoming: number;
}> {
  const { data: plays, error } = await supabase
    .from('plays')
    .select('id, title, slug, run_start_date, run_end_date, year, status');

  if (error) {
    console.error('[theatre_service] Error fetching plays for status sweep:', error.message);
    throw error;
  }

  let updatedCount = 0;
  let archivedCount = 0;
  let runningCount = 0;
  let upcomingCount = 0;

  const now = new Date();
  const playsToUpdate: { id: string; title: string; slug: string; oldStatus: string; newStatus: string }[] = [];

  for (const play of plays || []) {
    const derived = derivePlayStatus(play, now);

    if (derived === 'archived') archivedCount++;
    else if (derived === 'currently_running') runningCount++;
    else if (derived === 'upcoming') upcomingCount++;

    if (play.status !== derived) {
      playsToUpdate.push({
        id: play.id,
        title: play.title,
        slug: play.slug,
        oldStatus: play.status,
        newStatus: derived,
      });
    }
  }

  // Update in parallel batches of 10 for speed
  const BATCH_SIZE = 10;
  for (let i = 0; i < playsToUpdate.length; i += BATCH_SIZE) {
    const batch = playsToUpdate.slice(i, i + BATCH_SIZE);
    await Promise.allSettled(
      batch.map(async (item) => {
        const { error: updErr } = await supabase
          .from('plays')
          .update({ status: item.newStatus, updated_at: now.toISOString() })
          .eq('id', item.id);

        if (!updErr) {
          updatedCount++;
          console.log(`[theatre_service] Transitioned play "${item.title}" (${item.slug}): ${item.oldStatus} -> ${item.newStatus}`);
        } else {
          console.error(`[theatre_service] Failed to update play status for "${item.title}":`, updErr.message);
        }
      })
    );
  }

  return {
    total: (plays || []).length,
    updated: updatedCount,
    archived: archivedCount,
    running: runningCount,
    upcoming: upcomingCount,
  };
}

/**
 * Sync Utopia Theatre productions and verify status & box office records
 */
export async function syncUtopiaTheatreProductions(): Promise<{
  success: boolean;
  total_productions: number;
  updated_count: number;
  productions: string[];
}> {
  const { data: plays, error } = await supabase
    .from('plays')
    .select('id, title, slug, run_start_date, run_end_date, year, status, box_office_domestic, box_office_currency')
    .or('producer.ilike.%utopia%,venue.ilike.%crucible%,venue.ilike.%belgrade%');

  if (error) {
    console.error('[theatre_service] Failed to query Utopia Theatre productions:', error.message);
    throw error;
  }

  const now = new Date();
  let updatedCount = 0;
  const productionTitles: string[] = [];

  for (const play of plays || []) {
    productionTitles.push(play.title);
    const derivedStatus = derivePlayStatus(play, now);
    if (play.status !== derivedStatus) {
      const { error: updErr } = await supabase
        .from('plays')
        .update({ status: derivedStatus, updated_at: now.toISOString() })
        .eq('id', play.id);

      if (!updErr) {
        updatedCount++;
        console.log(`[theatre_service] Updated Utopia play "${play.title}": ${play.status} -> ${derivedStatus}`);
      }
    }
  }

  return {
    success: true,
    total_productions: (plays || []).length,
    updated_count: updatedCount,
    productions: productionTitles,
  };
}

/**
 * Sync PartyVerse / PVRsvp live ticketing box office and admissions
 */
export async function syncPartyVerseTicketingBoxOffice(): Promise<{
  synced: number;
  results: { slug: string; tickets_sold: number; gross: number }[];
}> {
  const { data: plays, error } = await supabase
    .from('plays')
    .select('id, title, slug, source_url, box_office_metrics, venue')
    .ilike('source_url', '%pv.rsvp%');

  if (error || !plays) return { synced: 0, results: [] };

  const results: { slug: string; tickets_sold: number; gross: number }[] = [];

  for (const play of plays) {
    try {
      let eventId = play.box_office_metrics?.event_id;
      if (!eventId) {
        const match = (play.source_url || '').match(/pv\.rsvp\/([a-zA-Z0-9_-]+)/);
        if (match) {
          const detailRes = await fetch(`https://pv.rsvp/api/getEventDetails?eventSlug=${match[1]}`);
          if (detailRes.ok) {
            const detailJson = await detailRes.json();
            eventId = detailJson.data?.id;
          }
        }
      }

      if (!eventId) continue;

      const shopRes = await fetch(`https://pv.rsvp/api/getShopItems?eventId=${eventId}`);
      if (!shopRes.ok) continue;

      const shopJson = await shopRes.json();
      const items = shopJson?.data?.items || [];
      if (!items.length) continue;

      // Only record verified platform data — NEVER invent gross or sales figures from assumptions
      await supabase
        .from('plays')
        .update({
          box_office_metrics: {
            ...(play.box_office_metrics || {}),
            source: 'PartyVerse (pv.rsvp)',
            event_id: eventId,
            tier_pricing: items.reduce((acc: any, it: any) => {
              acc[it.name] = { price: Number(it.price || 0) };
              return acc;
            }, {}),
            raw_inventory: {
              total_capacity_stated: play.box_office_metrics?.total_capacity || 800,
              quantity_available: items.reduce((acc: any, it: any) => {
                acc[it.name] = Number(it.quantityAvailable || 0);
                return acc;
              }, {})
            },
            last_synced_at: new Date().toISOString(),
            note: 'Platform does not publish direct total sales amounts. Figures left unconfirmed.'
          }
        })
        .eq('id', play.id);

      results.push({ slug: play.slug, tickets_sold: 0, gross: 0 });
    } catch (e: any) {
      console.error(`[theatre_service] Error syncing play ${play.slug}:`, e.message);
    }
  }

  return { synced: results.length, results };
}
