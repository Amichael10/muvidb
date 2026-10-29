import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

interface TicketType {
  id: number;
  name: string;
  price: number;
  quantity_total: number;
  remaining_for_session: number;
  effective_remaining: number;
  is_sold_out: boolean;
}

interface SessionData {
  session: {
    id: number;
    display_name: string;
    capacity: number;
    remaining_capacity: number;
    is_sold_out: boolean;
  };
  ticket_types: TicketType[];
}

export async function harvestTerraKulturePlay(slug: string) {
  const url = `https://tickets.terrakulture.com/tickets/events/${slug}`;
  console.log(`\n======================================================`);
  console.log(`[TERRA HARVESTER] Fetching event: ${slug} (${url})`);
  console.log(`======================================================`);

  const res = await fetch(url);
  if (!res.ok) {
    console.error(`Failed to fetch event page for ${slug}: ${res.statusText}`);
    return null;
  }
  const html = await res.text();

  // Extract sessions
  const sessionMatches = [...html.matchAll(/<option[^>]*value="(\d+)"[^>]*>(.*?)<\/option>/gs)];
  const sessions = sessionMatches
    .map(m => ({ id: m[1], name: m[2].trim() }))
    .filter(s => s.id && s.id !== '');

  console.log(`Found ${sessions.length} sessions for ${slug}.`);

  let totalGross = 0;
  let totalSold = 0;
  let totalCapacity = 0;
  const tierAggregates: Record<string, { price: number; total: number; sold: number; gross: number }> = {};
  const sessionBreakdown: Array<{
    session_id: number;
    display_name: string;
    capacity: number;
    tickets_sold: number;
    gross: number;
    tiers: Array<{ name: string; price: number; sold: number; gross: number }>;
  }> = [];

  for (const session of sessions) {
    try {
      const seatRes = await fetch(`https://tickets.terrakulture.com/tickets/events/${slug}/seats?event_session_id=${session.id}`);
      if (!seatRes.ok) continue;
      const data: SessionData = await seatRes.json();
      
      let sessionSold = 0;
      let sessionGross = 0;
      const sessionTiers: Array<{ name: string; price: number; sold: number; gross: number }> = [];

      for (const t of data.ticket_types || []) {
        const remaining = t.remaining_for_session ?? t.effective_remaining ?? 0;
        const total = t.quantity_total || 0;
        const sold = Math.max(0, total - remaining);
        const gross = sold * (t.price || 0);

        sessionSold += sold;
        sessionGross += gross;

        sessionTiers.push({
          name: t.name,
          price: t.price,
          sold,
          gross
        });

        if (!tierAggregates[t.name]) {
          tierAggregates[t.name] = { price: t.price, total: 0, sold: 0, gross: 0 };
        }
        tierAggregates[t.name].total += total;
        tierAggregates[t.name].sold += sold;
        tierAggregates[t.name].gross += gross;
      }

      totalGross += sessionGross;
      totalSold += sessionSold;
      totalCapacity += (data.session?.capacity || 0);

      sessionBreakdown.push({
        session_id: Number(session.id),
        display_name: data.session?.display_name || session.name,
        capacity: data.session?.capacity || 0,
        tickets_sold: sessionSold,
        gross: sessionGross,
        tiers: sessionTiers
      });

      console.log(`- Session ${session.id}: ${sessionSold} tickets sold | ₦${sessionGross.toLocaleString()}`);
    } catch (err: any) {
      console.error(`Error querying session ${session.id}:`, err.message);
    }
  }

  console.log(`\n[SUMMARY for ${slug}]:`);
  console.log(`- Total Shows: ${sessions.length}`);
  console.log(`- Total Capacity: ${totalCapacity.toLocaleString()}`);
  console.log(`- Total Tickets Sold: ${totalSold.toLocaleString()}`);
  console.log(`- Total Gross: ₦${totalGross.toLocaleString()}`);
  console.log(`- Tiers Breakdown:`, tierAggregates);

  // Sync to public.plays
  const { data: matchedPlay, error: findError } = await supabase
    .from('plays')
    .select('id, title, slug')
    .eq('slug', slug)
    .maybeSingle();

  if (findError) {
    console.error('Error finding play:', findError);
  }

  const metrics = {
    source: 'Terra Kulture Official Ticketing System',
    harvested_at: new Date().toISOString(),
    total_shows: sessions.length,
    total_capacity: totalCapacity,
    occupancy_rate: totalCapacity > 0 ? Number(((totalSold / totalCapacity) * 100).toFixed(1)) : 0,
    tier_breakdown: tierAggregates,
    session_breakdown: sessionBreakdown
  };

  if (matchedPlay) {
    console.log(`Updating existing play record: [${matchedPlay.id}] ${matchedPlay.title}`);
    const { error: updateError } = await supabase
      .from('plays')
      .update({
        box_office_domestic: totalGross,
        box_office_tickets_sold: totalSold,
        box_office_currency: 'NGN',
        box_office_source: 'Terra Kulture Official Tickets',
        box_office_updated_at: new Date().toISOString(),
        box_office_metrics: metrics,
        venue: 'Terra Kulture, Victoria Island, Lagos'
      })
      .eq('id', matchedPlay.id);

    if (updateError) {
      console.error('Failed to update play:', updateError);
    } else {
      console.log(`Successfully synced Box Office for "${matchedPlay.title}"!`);
    }
  } else {
    console.log(`Play "${slug}" not found in database. Searching by title approximation...`);
  }

  return {
    slug,
    totalGross,
    totalSold,
    totalCapacity,
    tierAggregates,
    sessionBreakdown
  };
}

async function main() {
  const events = ['behind-closed-doors', 'itoro-the-musical'];
  for (const slug of events) {
    await harvestTerraKulturePlay(slug);
  }
}

if (process.argv[1]?.endsWith('sync_terrakulture_box_office.ts')) {
  main().then(() => process.exit(0)).catch(err => {
    console.error(err);
    process.exit(1);
  });
}
