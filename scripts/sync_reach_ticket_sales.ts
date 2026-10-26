/**
 * Daily Stealth Ticket Ingestion Engine: Reach Cinema (Fusion Intel)
 *
 * Pulls yesterday's completed showtimes across all 25 Reach Cinema branches,
 * extracting live ticket admissions (seatsSold), estimated revenue, and hall occupancy.
 *
 * Safety / Anti-Ban:
 * - Runs once daily.
 * - Jittered 600ms - 900ms delay between branch requests.
 * - Entire nationwide scan takes under 25 seconds.
 */

import dns from 'dns';
import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();
dns.setDefaultResultOrder('ipv4first');

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

const JWT =
  process.env.REACH_CINEMA_JWT ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiQ2luZW1hQXBpIiwiQ2luZW1hSWQiOiJ2aXYtMjdmZDQxZGMiLCJuYmYiOjE3NzAzOTkwNjAsImV4cCI6MTgwMTkzNTA2MCwiaWF0IjoxNzcwMzk5MDYwLCJpc3MiOiJodHRwczovL2Z1c2lvbmludGVsLmlvIiwiYXVkIjoiVXNlciJ9.BivgaldX_3fh-iwGNlbGeIHcC4TF9QmlT7-nGfjHoEs';

const BASE = 'https://max-api-readonly.fusionintel.io/api/v1';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function getTargetDateRange(): { dateFrom: string; dateTo: string; yesterdayStr: string } {
  // Query yesterday through today in WAT (UTC+1)
  const now = new Date();
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const pad = (n: number) => String(n).padStart(2, '0');

  const yesterdayStr = `${yesterday.getFullYear()}-${pad(yesterday.getMonth() + 1)}-${pad(yesterday.getDate())}`;
  const todayStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;

  return {
    dateFrom: yesterdayStr,
    dateTo: todayStr,
    yesterdayStr,
  };
}

export async function syncReachTicketSales() {
  console.log('---------------------------------------------------------');
  console.log('🎟️ REACH CINEMA DAILY TICKET & ADMISSION SYNC 🇳🇬');
  console.log(`Started at: ${new Date().toISOString()}`);
  console.log('---------------------------------------------------------');

  const { dateFrom, dateTo, yesterdayStr } = getTargetDateRange();
  console.log(`Auditing ticket sales window: ${dateFrom} to ${dateTo}...`);

  // Load mapped branches
  const catPath = path.join(process.cwd(), 'scratch', 'reach-catalogue.json');
  if (!fs.existsSync(catPath)) {
    console.error('❌ scratch/reach-catalogue.json not found!');
    return;
  }

  const cat = JSON.parse(fs.readFileSync(catPath, 'utf8'));
  const branches: Array<{ id: string; name: string }> = [];
  for (const [_, v] of Object.entries<any>(cat)) {
    if (v.branches) {
      for (const b of v.branches) {
        if (b.id && b.isActive !== false) {
          branches.push({ id: b.id, name: b.name });
        }
      }
    }
  }

  console.log(`Loaded ${branches.length} active Reach branches.`);

  interface FilmDailyAggregate {
    filmTitle: string;
    ticketsSold: number;
    totalCapacity: number;
    estimatedRevenue: number;
    screeningsCount: number;
    activeBranches: Set<string>;
    avgTicketPrice: number;
  }

  const filmMap = new Map<string, FilmDailyAggregate>();

  let successfulBranches = 0;

  for (const branch of branches) {
    const url = `${BASE}/Showtimes/get-showtimes?cinemaId=${encodeURIComponent(
      branch.id
    )}&DateFrom=${dateFrom}&DateTo=${dateTo}`;

    try {
      const res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${JWT}`,
          Accept: 'application/json',
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        },
        signal: AbortSignal.timeout(12000),
      });

      if (res.ok) {
        const json = await res.json();
        const rows: any[] = json.data || [];

        for (const row of rows) {
          const rawFilm = (row.film || '').trim();
          if (!rawFilm) continue;

          const sold = Number(row.seatsSold || 0);
          const capacity = Number(row.totalSeats || 0);

          // Get minimum ticket price
          const tickets: any[] = row.priceCard?.tickets || [];
          const prices = tickets
            .map((t) => Number(t.price))
            .filter((p) => !isNaN(p) && p > 0);
          const basePrice = prices.length > 0 ? Math.min(...prices) : 5000;

          if (!filmMap.has(rawFilm)) {
            filmMap.set(rawFilm, {
              filmTitle: rawFilm,
              ticketsSold: 0,
              totalCapacity: 0,
              estimatedRevenue: 0,
              screeningsCount: 0,
              activeBranches: new Set(),
              avgTicketPrice: basePrice,
            });
          }

          const entry = filmMap.get(rawFilm)!;
          entry.screeningsCount++;
          entry.ticketsSold += sold;
          entry.totalCapacity += capacity;
          entry.estimatedRevenue += sold * basePrice;
          if (sold > 0) {
            entry.activeBranches.add(branch.name);
          }
        }
        successfulBranches++;
      }
    } catch {
      // Silently proceed
    }

    // Stealth jitter delay: 600ms - 900ms
    await sleep(600 + Math.random() * 300);
  }

  console.log(`\nCompleted scan across ${successfulBranches}/${branches.length} branches.`);

  // Save/Update in Database
  let updatedFilms = 0;

  for (const [rawTitle, stats] of filmMap.entries()) {
    if (stats.ticketsSold === 0) continue;

    // Fuzzy look up in films
    const cleanSearch = rawTitle.replace(/^(agbara\s*nla).*/i, '$1').trim();
    const { data: matchedFilms } = await supabase
      .from('films')
      .select('id, title, year, streaming_links')
      .ilike('title', `%${cleanSearch}%`)
      .limit(1);

    if (!matchedFilms || matchedFilms.length === 0) continue;

    const film = matchedFilms[0];
    const currentLinks = film.streaming_links || {};
    const bo = currentLinks.box_office || {};

    // Get reach metrics
    const reachData = bo.reach_metrics || {
      cumulative_reach_tickets: 0,
      cumulative_reach_revenue: 0,
      daily_history: [],
    };

    const occupancyRate =
      stats.totalCapacity > 0
        ? parseFloat(((stats.ticketsSold / stats.totalCapacity) * 100).toFixed(1))
        : 0;

    const dailyEntry = {
      date: yesterdayStr,
      ticketsSold: stats.ticketsSold,
      estimatedRevenue: stats.estimatedRevenue,
      screeningsCount: stats.screeningsCount,
      activeLocations: stats.activeBranches.size,
      occupancyRate,
    };

    // Deduplicate daily history by date
    const hist = reachData.daily_history || [];
    const existingIdx = hist.findIndex((h: any) => h.date === yesterdayStr);
    if (existingIdx >= 0) {
      hist[existingIdx] = dailyEntry;
    } else {
      hist.push(dailyEntry);
    }

    // Recalculate cumulative reach ticket counts & revenue
    let totalReachTickets = 0;
    let totalReachRevenue = 0;
    for (const h of hist) {
      totalReachTickets += h.ticketsSold || 0;
      totalReachRevenue += h.estimatedRevenue || 0;
    }

    reachData.cumulative_reach_tickets = totalReachTickets;
    reachData.cumulative_reach_revenue = totalReachRevenue;
    reachData.daily_history = hist.slice(-30); // Keep last 30 days
    reachData.latest_occupancy = occupancyRate;
    reachData.updated_at = new Date().toISOString();

    const updatedLinks = {
      ...currentLinks,
      box_office: {
        ...bo,
        reach_metrics: reachData,
      },
    };

    const { error: updErr } = await supabase
      .from('films')
      .update({
        streaming_links: updatedLinks,
        updated_at: new Date().toISOString(),
      })
      .eq('id', film.id);

    if (!updErr) {
      updatedFilms++;
      console.log(
        `  ✓ ${film.title}: +${stats.ticketsSold} tickets sold (₦${stats.estimatedRevenue.toLocaleString()} est. revenue, ${occupancyRate}% occupancy)`
      );
    }
  }

  console.log(`\n🎉 Finished! Synced Reach ticket metrics for ${updatedFilms} films.`);
}

if (process.argv[1]?.includes('sync_reach_ticket_sales')) {
  syncReachTicketSales().catch((err) => {
    console.error('Fatal error:', err);
  });
}
