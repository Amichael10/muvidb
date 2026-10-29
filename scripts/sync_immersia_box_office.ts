/**
 * Immersia Stage Play & Box Office Synchronization Engine
 *
 * Scrapes live box office, admissions, ticket tiers, and performance schedules
 * from the Immersia API (Anthill Studios Immersive Theatre Circuit, Lagos)
 * and updates public.plays in MuviDB.
 *
 * Run:
 *   npx tsx scripts/sync_immersia_box_office.ts
 *   npx tsx scripts/sync_immersia_box_office.ts --dry-run
 */

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config();

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || 'https://pkenrmorywmuvnzfoylp.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

if (!SUPABASE_KEY) {
  console.error('❌ Missing SUPABASE_SERVICE_ROLE_KEY or VITE_SUPABASE_ANON_KEY');
  process.exit(1);
}

// Direct fetch client with backend User-Agent
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
  global: {
    headers: {
      'User-Agent': 'MuviDB-Backend/1.0',
    },
  },
});

const IMMERSIA_API_BASE = 'https://immersia-api.onrender.com';
const IMMERSIA_WEB_BASE = 'https://www.immersia.show';
const DRY_RUN = process.argv.includes('--dry-run');

function slugify(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/\b(the|live|edition|interactive show)\b/gi, '')
    .replace(/[^a-z0-9]/gi, '')
    .trim();
}

function formatTimeSlot(time: string): string {
  if (!time) return '';
  const match = time.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return time;
  const hour = parseInt(match[1], 10);
  const min = match[2];
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour % 12 || 12;
  return `${displayHour}:${min} ${ampm}`;
}

export type ImmersiaTicketType = {
  _id?: string;
  type: string;
  price: number; // in kobo
  available?: boolean;
  sold?: number;
  groupSize?: number;
  discountPercent?: number;
  benefits?: string;
};

export type ImmersiaTimeSlot = {
  time: string;
  label?: string;
  available?: boolean;
  capacity?: number;
  sold?: number;
};

export type ImmersiaDate = {
  date: string;
  timeSlots?: ImmersiaTimeSlot[];
};

export type ImmersiaShow = {
  _id: string;
  publicId?: string;
  title: string;
  description?: string;
  venue?: string;
  dates?: ImmersiaDate[];
  ticketTypes?: ImmersiaTicketType[];
  thumbnailUrl?: string;
  bannerUrl?: string;
  mobileThumbnailUrl?: string;
  status?: string;
  trailerUrl?: string;
};

export async function fetchImmersiaShows(): Promise<ImmersiaShow[]> {
  console.log(`📡 Fetching shows from ${IMMERSIA_API_BASE}/api/show/public...`);
  
  let attempts = 0;
  const maxAttempts = 3;
  
  while (attempts < maxAttempts) {
    attempts++;
    try {
      const res = await fetch(`${IMMERSIA_API_BASE}/api/show/public`, {
        headers: {
          'Origin': IMMERSIA_WEB_BASE,
          'Referer': `${IMMERSIA_WEB_BASE}/`,
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }

      const data = await res.json();
      return (data.shows || []) as ImmersiaShow[];
    } catch (err: any) {
      console.warn(`  Attempt ${attempts}/${maxAttempts} failed: ${err.message}. Waiting 4s for Render wake up...`);
      if (attempts >= maxAttempts) throw err;
      await new Promise((r) => setTimeout(r, 4000));
    }
  }

  return [];
}

export function parseImmersiaShowMetrics(show: ImmersiaShow) {
  let grossDomesticNgn = 0;
  let ticketsSold = 0;
  const tierBreakdown: Array<{
    type: string;
    priceNgn: number;
    priceKobo: number;
    sold: number;
    grossNgn: number;
    groupSize: number;
  }> = [];

  for (const tt of show.ticketTypes || []) {
    const priceNgn = (tt.price || 0) / 100;
    const sold = tt.sold || 0;
    const subtotal = priceNgn * sold;
    grossDomesticNgn += subtotal;
    ticketsSold += sold;

    tierBreakdown.push({
      type: tt.type,
      priceNgn,
      priceKobo: tt.price,
      sold,
      grossNgn: subtotal,
      groupSize: tt.groupSize || 1,
    });
  }

  // Aggregate schedule dates and slots
  const validDates: string[] = [];
  const timesSet = new Set<string>();
  let totalCapacity = 0;
  let totalSlotSeatsSold = 0;
  let performanceSlotsCount = 0;

  for (const d of show.dates || []) {
    if (d.date) {
      const datePart = d.date.slice(0, 10);
      validDates.push(datePart);
    }
    for (const slot of d.timeSlots || []) {
      performanceSlotsCount++;
      totalCapacity += (slot.capacity || 0);
      totalSlotSeatsSold += (slot.sold || 0);
      if (slot.time) {
        timesSet.add(formatTimeSlot(slot.time));
      }
    }
  }

  validDates.sort();
  const runStartDate = validDates[0] || null;
  const runEndDate = validDates[validDates.length - 1] || null;

  const todayStr = new Date().toISOString().slice(0, 10);
  let status = 'archived';
  if (runStartDate && runEndDate) {
    if (runEndDate < todayStr) status = 'archived';
    else if (runStartDate <= todayStr && runEndDate >= todayStr) status = 'currently_running';
    else status = 'upcoming';
  } else if (runStartDate) {
    if (runStartDate < todayStr) status = 'archived';
    else if (runStartDate === todayStr) status = 'currently_running';
    else status = 'upcoming';
  }

  const occupancyRate = totalCapacity > 0 ? parseFloat(((totalSlotSeatsSold / totalCapacity) * 100).toFixed(1)) : 0;
  const performanceTime = Array.from(timesSet).join(' & ') || null;

  const sourceUrl = show.publicId 
    ? `${IMMERSIA_WEB_BASE}/show-details.html?id=${show.publicId}`
    : IMMERSIA_WEB_BASE;

  const boxOfficeMetrics = {
    source: 'Immersia',
    public_id: show.publicId || show._id,
    tickets_sold: ticketsSold,
    gross_domestic_ngn: grossDomesticNgn,
    total_capacity: totalCapacity,
    total_slot_seats_sold: totalSlotSeatsSold,
    occupancy_rate_percent: occupancyRate,
    performance_slots_count: performanceSlotsCount,
    distinct_dates_count: validDates.length,
    tier_breakdown: tierBreakdown,
    updated_at: new Date().toISOString(),
  };

  return {
    grossDomesticNgn,
    ticketsSold,
    runStartDate,
    runEndDate,
    performanceTime,
    status,
    occupancyRate,
    sourceUrl,
    boxOfficeMetrics,
  };
}

export async function syncImmersiaBoxOffice() {
  console.log('===========================================================');
  console.log('🎭 IMMERSIA THEATRE BOX OFFICE & ADMISSION SYNC 🇳🇬');
  console.log(`Started at: ${new Date().toISOString()}`);
  console.log(`Dry Run Mode: ${DRY_RUN}`);
  console.log('===========================================================\n');

  const shows = await fetchImmersiaShows();
  console.log(`Found ${shows.length} shows on Immersia.\n`);

  // Fetch existing plays from Supabase to match
  const { data: existingPlays, error: fetchErr } = await supabase
    .from('plays')
    .select('id, title, slug, source_url, box_office_domestic, box_office_tickets_sold');

  if (fetchErr) {
    console.error('❌ Error fetching existing plays:', fetchErr.message);
    return;
  }

  console.log(`Loaded ${existingPlays?.length || 0} existing plays from MuviDB.\n`);

  let updatedCount = 0;
  let createdCount = 0;
  let totalRevenueTracked = 0;
  let totalTicketsTracked = 0;

  for (const show of shows) {
    const title = show.title?.trim();
    if (!title || title.toLowerCase() === 'test show') {
      console.log(`⏭️  Skipping placeholder/test show: "${title}"`);
      continue;
    }

    const metrics = parseImmersiaShowMetrics(show);
    totalRevenueTracked += metrics.grossDomesticNgn;
    totalTicketsTracked += metrics.ticketsSold;

    const baseSlug = slugify(title);
    const normalized = normalizeTitle(title);

    // Try matching existing play
    const existing = existingPlays?.find((p) => {
      if (p.source_url && show.publicId && p.source_url.includes(show.publicId)) return true;
      if (p.slug === baseSlug) return true;
      if (p.title?.toLowerCase() === title.toLowerCase()) return true;
      if (normalizeTitle(p.title || '') === normalized) return true;
      return false;
    });

    const venue = show.venue?.trim() || 'Anthill Immersia Theater, Lagos';
    const city = 'Lagos';
    const country = 'Nigeria';
    const year = metrics.runStartDate ? parseInt(metrics.runStartDate.slice(0, 4), 10) : new Date().getFullYear();

    const posterUrl = show.thumbnailUrl || show.mobileThumbnailUrl || null;
    const bannerUrl = show.bannerUrl || show.thumbnailUrl || null;

    if (existing) {
      console.log(`🔄 Updating existing play: "${existing.title}" (${existing.slug})`);
      console.log(`   Box Office: ₦${metrics.grossDomesticNgn.toLocaleString()} | Tickets: ${metrics.ticketsSold} | Status: ${metrics.status}`);

      if (!DRY_RUN) {
        const updatePayload: Record<string, any> = {
          box_office_domestic: metrics.grossDomesticNgn,
          box_office_tickets_sold: metrics.ticketsSold,
          box_office_currency: 'NGN',
          box_office_source: 'Immersia',
          box_office_updated_at: new Date().toISOString(),
          box_office_metrics: metrics.boxOfficeMetrics,
          status: metrics.status,
          updated_at: new Date().toISOString(),
        };

        if (metrics.runStartDate) updatePayload.run_start_date = metrics.runStartDate;
        if (metrics.runEndDate) updatePayload.run_end_date = metrics.runEndDate;
        if (metrics.performanceTime) updatePayload.performance_time = metrics.performanceTime;
        if (venue) updatePayload.venue = venue;
        if (posterUrl) updatePayload.poster_url = posterUrl;
        if (bannerUrl) updatePayload.banner_url = bannerUrl;
        if (metrics.sourceUrl) updatePayload.source_url = metrics.sourceUrl;

        const { error: updErr } = await supabase
          .from('plays')
          .update(updatePayload)
          .eq('id', existing.id);

        if (updErr) {
          console.error(`   ❌ Failed to update play ${existing.title}:`, updErr.message);
        } else {
          updatedCount++;
          console.log(`   ✓ Successfully updated.`);
        }
      } else {
        updatedCount++;
      }
    } else {
      console.log(`✨ Creating new play: "${title}" (${baseSlug})`);
      console.log(`   Box Office: ₦${metrics.grossDomesticNgn.toLocaleString()} | Tickets: ${metrics.ticketsSold} | Status: ${metrics.status}`);

      const insertPayload: Record<string, any> = {
        title,
        slug: baseSlug,
        synopsis: show.description?.trim() || null,
        producer: 'Anthill Studios',
        venue,
        city,
        country,
        genre: 'Immersive Theatre',
        year,
        run_start_date: metrics.runStartDate,
        run_end_date: metrics.runEndDate,
        performance_time: metrics.performanceTime,
        status: metrics.status,
        poster_url: posterUrl,
        banner_url: bannerUrl,
        source_url: metrics.sourceUrl,
        box_office_domestic: metrics.grossDomesticNgn,
        box_office_tickets_sold: metrics.ticketsSold,
        box_office_currency: 'NGN',
        box_office_source: 'Immersia',
        box_office_updated_at: new Date().toISOString(),
        box_office_metrics: metrics.boxOfficeMetrics,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      if (!DRY_RUN) {
        const { error: insErr } = await supabase
          .from('plays')
          .insert(insertPayload);

        if (insErr) {
          console.error(`   ❌ Failed to insert play ${title}:`, insErr.message);
        } else {
          createdCount++;
          console.log(`   ✓ Successfully inserted.`);
        }
      } else {
        createdCount++;
      }
    }
  }

  console.log('\n===========================================================');
  console.log('🎉 IMMERSIA SYNC COMPLETE SUMMARY');
  console.log(`Total Plays Created: ${createdCount}`);
  console.log(`Total Plays Updated: ${updatedCount}`);
  console.log(`Total Admissions Tracked: ${totalTicketsTracked.toLocaleString()} tickets`);
  console.log(`Total Box Office Gross Tracked: ₦${totalRevenueTracked.toLocaleString()} NGN`);
  console.log('===========================================================');
}

if (process.argv[1]?.includes('sync_immersia_box_office')) {
  syncImmersiaBoxOffice().catch((err) => {
    console.error('Fatal sync error:', err);
    process.exit(1);
  });
}
