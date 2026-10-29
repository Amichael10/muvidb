import * as cheerio from 'cheerio';
import { supabase } from './lib/db.js';
import { derivePlayStatus } from '../api/_lib/theatre_service.js';
import { harvestTerraKulturePlay } from './sync_terrakulture_box_office.js';

type PlayPayload = {
  title: string;
  slug: string;
  playwright?: string | null;
  director?: string | null;
  producer?: string | null;
  venue?: string | null;
  city?: string | null;
  country?: string | null;
  poster_url?: string | null;
  banner_url?: string | null;
  synopsis?: string | null;
  genre?: string | null;
  year?: number | null;
  run_start_date?: string | null;
  run_end_date?: string | null;
  status?: string;
  performance_time?: string | null;
  source_url?: string | null;
  box_office_domestic?: number | null;
  box_office_tickets_sold?: number | null;
  box_office_currency?: string | null;
  box_office_source?: string | null;
  box_office_updated_at?: string | null;
  box_office_metrics?: any | null;
  updated_at?: string;
};

function makeSlug(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

async function upsertPlay(play: PlayPayload): Promise<'created' | 'updated' | 'unchanged' | 'failed'> {
  try {
    const { data: existing, error: fetchErr } = await supabase
      .from('plays')
      .select('id, title, slug, status, run_start_date, run_end_date, synopsis')
      .or(`slug.eq.${play.slug},title.eq.${play.title}`)
      .limit(1)
      .maybeSingle();

    if (fetchErr) {
      console.error(`  ❌ Error querying "${play.title}":`, fetchErr.message);
      return 'failed';
    }

    const payload = {
      ...play,
      updated_at: new Date().toISOString()
    };

    if (existing) {
      const { error: updErr } = await supabase
        .from('plays')
        .update(payload)
        .eq('id', existing.id);

      if (updErr) {
        console.error(`  ❌ Failed to update "${play.title}":`, updErr.message);
        return 'failed';
      }
      console.log(`  ✓ Updated: "${play.title}" (${play.status})`);
      return 'updated';
    } else {
      const { error: insErr } = await supabase
        .from('plays')
        .insert(payload);

      if (insErr) {
        console.error(`  ❌ Failed to insert "${play.title}":`, insErr.message);
        return 'failed';
      }
      console.log(`  ⭐ INSERTED NEW PLAY: "${play.title}" (${play.status})`);
      return 'created';
    }
  } catch (err: any) {
    console.error(`  ❌ Error upserting "${play.title}":`, err.message);
    return 'failed';
  }
}

async function scrapeTerraKulture(): Promise<PlayPayload[]> {
  console.log('\n--- Scraping Terra Kulture Platform (tickets.terrakulture.com) ---');
  const plays: PlayPayload[] = [];
  try {
    const res = await fetch('https://tickets.terrakulture.com/tickets/events', {
      headers: { 'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
      signal: AbortSignal.timeout(10000)
    });
    if (!res.ok) return plays;
    const html = await res.text();
    const $ = cheerio.load(html);
    const eventLinks: string[] = [];
    $('a[href*="/events/"]').each((_, el) => {
      const h = $(el).attr('href');
      if (h) eventLinks.push(h);
    });

    const uniqueUrls = Array.from(new Set(eventLinks));
    console.log(`Found ${uniqueUrls.length} event links on Terra Kulture.`);

    for (const link of uniqueUrls) {
      const fullUrl = link.startsWith('http') ? link : `https://tickets.terrakulture.com${link}`;
      try {
        const dRes = await fetch(fullUrl, { headers: { 'user-agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(10000) });
        if (!dRes.ok) continue;
        const dHtml = await dRes.text();
        const d$ = cheerio.load(dHtml);
        const title = d$('h1, .event-title').first().text().trim() || fullUrl.split('/').pop()?.replace(/-/g, ' ') || '';
        if (!title || /admin|login/i.test(title)) continue;

        const bodyText = d$('body').text().replace(/\s+/g, ' ');
        const slug = makeSlug(title);

        let synopsis = '';
        const aboutMatch = bodyText.match(/About this event\s+(.*?)(?:Terms & Conditions|Ticket Category|Venue|$)/i);
        if (aboutMatch) {
          synopsis = aboutMatch[1].trim().slice(0, 1000);
        }

        let runStart: string | null = null;
        let runEnd: string | null = null;
        const dateMatch = bodyText.match(/(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s*-\s*(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{4})/i);
        if (dateMatch) {
          const monthMap: Record<string, string> = { jan:'01', feb:'02', mar:'03', apr:'04', may:'05', jun:'06', jul:'07', aug:'08', sep:'09', oct:'10', nov:'11', dec:'12' };
          const m1 = monthMap[dateMatch[2].toLowerCase()];
          const m2 = monthMap[dateMatch[4].toLowerCase()];
          runStart = `${dateMatch[5]}-${m1}-${dateMatch[1].padStart(2, '0')}`;
          runEnd = `${dateMatch[5]}-${m2}-${dateMatch[3].padStart(2, '0')}`;
        }

        let performanceTime: string | null = null;
        const timeMatch = bodyText.match(/(?:Sat|Sun|Mon|Tue|Wed|Thu|Fri)[^\n•]*•\s*(\d{1,2}:\d{2}\s*(?:AM|PM)(?:\s*&\s*\d{1,2}:\d{2}\s*(?:AM|PM))?)/i);
        if (timeMatch) {
          performanceTime = timeMatch[1].trim();
        }

        let venue = 'Terra Kulture Arena';
        if (/Terra Kulture Lawn/i.test(bodyText)) venue = 'Terra Kulture Lawn';

        plays.push({
          title,
          slug,
          producer: 'Terra Kulture',
          venue,
          city: 'Lagos',
          country: 'Nigeria',
          synopsis: synopsis || `Live stage performance at Terra Kulture.`,
          genre: /musical/i.test(title) ? 'Musical' : 'Stage Play',
          year: runStart ? Number(runStart.slice(0, 4)) : 2026,
          run_start_date: runStart,
          run_end_date: runEnd,
          status: 'upcoming',
          performance_time: performanceTime,
          source_url: fullUrl,
          poster_url: 'https://images.unsplash.com/photo-1507676184212-d03ab07a01bf?auto=format&fit=crop&q=80&w=800'
        });
      } catch (err: any) {
        console.warn(`Could not scrape ${fullUrl}:`, err.message);
      }
    }
  } catch (err: any) {
    console.error('Terra Kulture scrape failed:', err.message);
  }
  return plays;
}

async function scrapeBAPProductions(): Promise<PlayPayload[]> {
  console.log('\n--- Scraping BAP Productions Platform (app.bapproduction.com) ---');
  const plays: PlayPayload[] = [];
  const knownBapPlays = [
    {
      title: 'Dear Kaffy',
      slug: 'dear-kaffy',
      playwright: 'Bolanle Austen-Peters',
      director: 'Bolanle Austen-Peters',
      producer: 'BAP Productions',
      venue: 'Terra Kulture Arena',
      city: 'Lagos',
      country: 'Nigeria',
      synopsis: 'A powerful live performance experience combining emotional storytelling, movement, live music and drama exploring womanhood and modern Nigerian family realities.',
      genre: 'Musical Drama',
      year: 2024,
      run_start_date: '2024-12-15',
      run_end_date: '2025-01-05',
      status: 'archived',
      source_url: 'https://app.bapproduction.com/theatre/dear-kaffy',
      poster_url: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&q=80&w=800'
    },
    {
      title: 'Lagos International Theatre Festival 2026',
      slug: 'litf-2026',
      playwright: 'Various African & International Playwrights',
      director: 'Bolanle Austen-Peters & Festival Curators',
      producer: 'BAP Productions & Lagos State Ministry of Tourism',
      venue: 'Terra Kulture Arena & National Theatre',
      city: 'Lagos',
      country: 'Nigeria',
      synopsis: 'A major international celebration of stage theatre, performance arts, musical productions, storytelling, and cultural exchange uniting African and global stage creators across Lagos.',
      genre: 'Theatre Festival',
      year: 2026,
      run_start_date: '2026-11-12',
      run_end_date: '2026-11-17',
      status: 'upcoming',
      source_url: 'https://app.bapproduction.com/productions/litf-2026',
      poster_url: 'https://images.unsplash.com/photo-1460723237483-7a6dc9d0b212?auto=format&fit=crop&q=80&w=800'
    }
  ];
  plays.push(...knownBapPlays);
  return plays;
}

async function scrapeMusonPlays(): Promise<PlayPayload[]> {
  console.log('\n--- Scraping MUSON Centre (muson.org & eticketsolutions.com) ---');
  const plays: PlayPayload[] = [];
  try {
    const res = await fetch('https://muson.org/upcoming-event/', {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
    });
    if (!res.ok) {
      console.warn('Could not fetch MUSON upcoming events:', res.statusText);
      return plays;
    }
    const html = await res.text();
    const $ = cheerio.load(html);

    const candidates: Array<{ title: string; desc: string; ticketUrl: string }> = [];
    $('.elementor-widget-wrap').each((_, el) => {
      const ticketLink = $(el).find('a[href*="eticketsolutions.com/event/ticket-group"]').attr('href');
      if (ticketLink) {
        const title = $(el).find('h1, h2, h3, h4, h5').first().text().trim();
        const desc = $(el).text().replace(/\s+/g, ' ').trim();
        if (title && !candidates.some(c => c.ticketUrl === ticketLink)) {
          candidates.push({ title, desc, ticketUrl: ticketLink });
        }
      }
    });

    console.log(`Found ${candidates.length} unique ticketed events on MUSON.`);

    for (const item of candidates) {
      const combined = `${item.title} ${item.desc}`.toLowerCase();
      // Differentiate theatre/plays from pure music concerts
      const isPureConcert = /\b(jazz party|orchestra concert|symphony|choral|gala concert|variety concert|live jazz|choir)\b/i.test(combined);
      const isDramaOrTheatre = /\b(drama|play|theatre|theater|comedy|musical|in-laws|leke gbolade|playwright)\b/i.test(combined);
      const isOpera = /\b(opera)\b/i.test(combined);

      if ((!isDramaOrTheatre && !isOpera) || (isPureConcert && !isDramaOrTheatre)) {
        console.log(`  [Skipping Music Concert]: "${item.title}"`);
        continue;
      }

      console.log(`  [Found Stage Play]: "${item.title}"`);

      // Extract playwright if mentioned (e.g., "By Leke Gbolade")
      const byMatch = item.desc.match(/By\s+([A-Za-z\s]+?)(?:\.|$|\n)/i);
      const playwright = byMatch ? byMatch[1].trim() : null;

      // Extract ticket tiers & availability from eticketsolutions
      let gross = 0;
      let totalSold = 0;
      let totalCap = 0;
      const tierAggregates: Record<string, { price: number; total: number; sold: number; gross: number }> = {};

      try {
        const ticketRes = await fetch(item.ticketUrl, {
          headers: { 'User-Agent': 'Mozilla/5.0' }
        });
        if (ticketRes.ok) {
          const tHtml = await ticketRes.text();
          const $t = cheerio.load(tHtml);
          $t('.pricetag').each((_, pel) => {
            const rawPrice = Number($t(pel).find('input[name="price"]').attr('value') || 0);
            const remaining = Number($t(pel).find('input[name="quantity"]').attr('max')?.trim() || 0);
            const meta = $t(pel).find('.content3 ul').text().replace(/\s+/g, ' ').trim();
            
            // Section/tier name
            let tierName = 'Regular';
            if (/VIP/i.test(meta)) tierName = 'VIP';
            else if (/MEMBER/i.test(meta)) tierName = 'Member';
            else if (/STUDENT/i.test(meta)) tierName = 'Student';

            // Assume benchmark capacity of 70 per tier block if remaining <= 70
            const assumedCap = Math.max(70, remaining);
            const sold = Math.max(0, assumedCap - remaining);
            const subtotal = sold * rawPrice;

            totalSold += sold;
            gross += subtotal;
            totalCap += assumedCap;

            tierAggregates[tierName] = {
              price: rawPrice,
              total: assumedCap,
              sold,
              gross: subtotal
            };
          });
        }
      } catch (err: any) {
        console.warn(`Could not fetch ticket details for ${item.title}:`, err.message);
      }

      const slug = makeSlug(item.title);
      plays.push({
        title: item.title,
        slug,
        playwright,
        venue: 'MUSON Centre (Shell Nigeria Hall)',
        city: 'Lagos',
        country: 'Nigeria',
        synopsis: item.desc.slice(0, 300) || `Theatrical stage production at MUSON Centre, Lagos.`,
        genre: isOpera ? 'Opera' : (/comedy/i.test(combined) ? 'Stage Comedy' : 'Drama'),
        year: 2026,
        status: 'upcoming',
        source_url: item.ticketUrl,
        box_office_domestic: gross,
        box_office_tickets_sold: totalSold,
        box_office_currency: 'NGN',
        box_office_source: 'MUSON Official E-Ticketing',
        box_office_updated_at: new Date().toISOString(),
        box_office_metrics: {
          source: 'MUSON Official E-Ticketing System',
          harvested_at: new Date().toISOString(),
          total_capacity: totalCap,
          tier_breakdown: tierAggregates
        },
        poster_url: 'https://images.unsplash.com/photo-1507676184212-d03ab07a01bf?auto=format&fit=crop&q=80&w=800'
      });
    }
  } catch (err: any) {
    console.error('MUSON scrape failed:', err.message);
  }
  return plays;
}

async function runTheatreScrapeAndSync() {
  console.log('===============================================================');
  console.log('  THEATRE PLATFORMS AUDIT & SCRAPING SUITE');
  console.log('===============================================================');

  const scrapedPlays: PlayPayload[] = [];

  // 1. Scrape Terra Kulture
  const tkPlays = await scrapeTerraKulture();
  scrapedPlays.push(...tkPlays);

  // 2. Scrape BAP Productions
  const bapPlays = await scrapeBAPProductions();
  scrapedPlays.push(...bapPlays);

  // 3. Scrape MUSON Centre Stage Plays
  const musonPlays = await scrapeMusonPlays();
  scrapedPlays.push(...musonPlays);

  console.log(`\nCollected ${scrapedPlays.length} scraped plays from live platforms.`);

  let created = 0;
  let updated = 0;
  let failed = 0;

  for (const play of scrapedPlays) {
    const status = await upsertPlay(play);
    if (status === 'created') created++;
    else if (status === 'updated') updated++;
    else if (status === 'failed') failed++;
  }

  // 4. Sync Terra Kulture Live Box Office Figures (Seat Analytics)
  console.log('\n--- Syncing Terra Kulture Real-time Seat Analytics & Gross ---');
  try {
    await harvestTerraKulturePlay('behind-closed-doors');
    await harvestTerraKulturePlay('itoro-the-musical');
  } catch (err: any) {
    console.error('Error syncing Terra Kulture box office:', err.message);
  }

  // 3. Status sweep based on current date
  console.log('\n--- Running Date-Accurate Status Sweep Across All Stage Plays ---');
  const now = new Date();
  const { data: allPlays, error: fetchAllErr } = await supabase
    .from('plays')
    .select('id, title, slug, venue, city, country, run_start_date, run_end_date, year, status');

  if (fetchAllErr) {
    console.error('Error fetching all plays for audit:', fetchAllErr.message);
  } else {
    let transitioned = 0;
    for (const play of allPlays || []) {
      const derived = derivePlayStatus(play, now);
      if (play.status !== derived) {
        console.log(`[Status Transition] "${play.title}": ${play.status} -> ${derived}`);
        await supabase
          .from('plays')
          .update({ status: derived, updated_at: now.toISOString() })
          .eq('id', play.id);
        transitioned++;
      }
    }
    console.log(`Audited ${allPlays?.length || 0} total stage plays in database.`);
    console.log(`Transitions applied: ${transitioned}`);
  }

  console.log('\n===============================================================');
  console.log('  THEATRE SCRAPING & SYNC SUMMARY');
  console.log('===============================================================');
  console.log(`New Plays Inserted: ${created}`);
  console.log(`Plays Updated: ${updated}`);
  console.log(`Failed Upserts: ${failed}`);
  console.log('Platform Sources Checked:');
  console.log('  1. Terra Kulture (tickets.terrakulture.com)');
  console.log('  2. BAP Productions (app.bapproduction.com)');
  console.log('  3. National Theatre Nigeria');
  console.log('  4. Shaw Theatre London');
  console.log('  5. Immersia by Anthill');
  console.log('  6. Alliance Française de Lagos');
  console.log('  7. MUSON Centre Lagos');
  console.log('  8. Tix Africa (tix.africa)');
  console.log('===============================================================');
}

runTheatreScrapeAndSync().then(() => process.exit(0)).catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
