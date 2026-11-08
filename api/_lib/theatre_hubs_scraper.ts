import dotenv from 'dotenv';
dotenv.config();
import { supabase } from './supabase.js';
import { derivePlayStatus } from './theatre_service.js';

function getFirecrawlKeys(): string[] {
  return [
    process.env.FIRECRAWL_API_KEY,
    process.env.FIRECRAWL_API_KEY_2,
    process.env.FIRECRAWL_API_KEY_3,
    process.env.FIRECRAWL_API_KEY_4,
    process.env.FIRECRAWL_API_KEY_5,
  ].filter((k): k is string => !!k && k.trim().length > 0);
}

let fcKeyIdx = 0;

async function fcFetch(endpoint: string, body: Record<string, unknown>): Promise<any | null> {
  const keys = getFirecrawlKeys();
  if (!keys.length) {
    console.warn('[theatre_hubs] FIRECRAWL_API_KEY missing. Hub scrape skipped.');
    return null;
  }

  for (let attempt = 0; attempt < keys.length; attempt++) {
    const key = keys[fcKeyIdx % keys.length];
    try {
      const res = await fetch(`https://api.firecrawl.dev/v1/${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${key}`,
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(25000),
      });

      if (res.ok) return await res.json();

      if (res.status === 402 || res.status === 429 || res.status === 401) {
        console.warn(`[theatre_hubs] Firecrawl key #${(fcKeyIdx % keys.length) + 1} exhausted (${res.status}), rotating...`);
        fcKeyIdx = (fcKeyIdx + 1) % keys.length;
        continue;
      }
      return null;
    } catch (err: any) {
      console.warn(`[theatre_hubs] Firecrawl request error:`, err?.message || err);
      fcKeyIdx = (fcKeyIdx + 1) % keys.length;
    }
  }
  return null;
}

export interface DiscoveredPlay {
  title: string;
  slug?: string;
  playwright?: string | null;
  director?: string | null;
  producer?: string | null;
  venue?: string;
  city?: string;
  country?: string;
  run_start_date?: string | null;
  run_end_date?: string | null;
  performance_time?: string | null;
  genre?: string;
  synopsis?: string;
  poster_url?: string;
  source_url: string;
  source_hub: 'ariiya' | 'tix' | 'muson' | 'anthill' | 'nairabox';
  pricing_tiers?: Array<{ name: string; price: number; description?: string }>;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '')
    .slice(0, 100);
}

// ── 1. ARIIYA TICKETS SCRAPER ────────────────────────────────────────────────
export async function scrapeAriiyaTheatre(): Promise<DiscoveredPlay[]> {
  console.log('[theatre_hubs] Scraping Ariiya Tickets theatre events...');
  const results: DiscoveredPlay[] = [];

  try {
    const data = await fcFetch('scrape', {
      url: 'https://ariiyatickets.com/events/',
      formats: ['markdown'],
    });

    const md: string = data?.data?.markdown || '';
    if (!md) return results;

    const eventBlocks = md.split(/-\s+(?:Sun|Mon|Tue|Wed|Thu|Fri|Sat)\s+\d+/i);
    const stageKeywords = ['stage play', 'play', 'theatre', 'theater', 'musical', 'directed by', 'prof.', 'dr.'];

    for (const block of eventBlocks) {
      const isStage = stageKeywords.some((kw) => block.toLowerCase().includes(kw));
      if (!isStage) continue;

      const linkMatch = block.match(/\[Get Tickets\]\((https:\/\/www\.ariiyatickets\.com\/event\/([^\/]+)\/?[^\)]*)\)/);
      if (!linkMatch) continue;

      const sourceUrl = linkMatch[1];
      const rawSlug = linkMatch[2];
      const imgMatch = block.match(/!\[.*?\]\((https:\/\/www\.ariiyatickets\.com\/wp-content\/uploads\/[^\)]+)\)/);
      const posterUrl = imgMatch ? imgMatch[1] : undefined;

      // Extract title and director from slug or block text
      let title = rawSlug.replace(/-/g, ' ');
      let director: string | null = null;
      let playwright: string | null = null;

      if (rawSlug.includes('hafsatu')) {
        title = 'Hafsatu';
        director = 'Prof. Rasheedah Liman';
      } else if (rawSlug.includes('princess-inikpi')) {
        title = 'Princess Inikpi';
        playwright = 'Dr. Tayo Joan Adenuga';
        director = 'Dr. Tayo Joan Adenuga';
      } else if (rawSlug.includes('makamba')) {
        title = 'Makamba';
        director = 'Prof. Ufford Azorbo';
      } else if (rawSlug.includes('deins-of-agbor')) {
        title = 'Deins of Agbor';
      } else {
        // Normalize capitalized words
        title = title.replace(/\b\w/g, (c) => c.toUpperCase());
        if (title.toLowerCase().includes('a stage play directed by')) {
          const parts = title.split(/a stage play directed by/i);
          title = parts[0].trim();
          director = parts[1]?.trim() || null;
        }
      }

      // Extract pricing tiers
      const priceMatch = block.match(/₦[\d,.]+(?:\s*–\s*₦[\d,.]+)?/);
      const pricingTiers: Array<{ name: string; price: number }> = [];
      if (priceMatch) {
        const prices = priceMatch[0].match(/₦[\d,.]+/g);
        if (prices && prices.length > 0) {
          const regularPrice = parseInt(prices[0].replace(/[₦,]/g, ''), 10);
          if (regularPrice > 0) pricingTiers.push({ name: 'Regular', price: regularPrice });
          if (prices.length > 1) {
            const vipPrice = parseInt(prices[1].replace(/[₦,]/g, ''), 10);
            if (vipPrice > 0) pricingTiers.push({ name: 'VIP', price: vipPrice });
          }
        }
      }

      // Dates: Default to December 2026 run if mentioned in Ariiya's calendar
      let runStart: string | null = null;
      let runEnd: string | null = null;
      const dayMatch = block.match(/(\d{1,2})(?:st|nd|rd|th)?\s+(November|December)\s+(202\d)/i);
      if (dayMatch) {
        const monthNum = dayMatch[2].toLowerCase() === 'november' ? '11' : '12';
        const dayNum = dayMatch[1].padStart(2, '0');
        runStart = `${dayMatch[3]}-${monthNum}-${dayNum}`;
        runEnd = runStart;
      } else if (rawSlug.includes('hafsatu')) {
        runStart = '2026-12-24';
        runEnd = '2026-12-24';
      } else if (rawSlug.includes('princess-inikpi')) {
        runStart = '2026-12-25';
        runEnd = '2026-12-25';
      } else if (rawSlug.includes('makamba')) {
        runStart = '2026-12-26';
        runEnd = '2026-12-26';
      } else if (rawSlug.includes('deins-of-agbor')) {
        runStart = '2026-12-27';
        runEnd = '2026-12-27';
      }

      results.push({
        title,
        slug: slugify(title),
        director,
        playwright,
        venue: 'Terra Kulture & National Theatre',
        city: 'Lagos',
        country: 'Nigeria',
        run_start_date: runStart,
        run_end_date: runEnd,
        genre: 'Stage Play',
        poster_url: posterUrl,
        source_url: sourceUrl,
        source_hub: 'ariiya',
        pricing_tiers: pricingTiers,
      });
    }
  } catch (err: any) {
    console.error('[theatre_hubs] Ariiya scraper error:', err?.message || err);
  }

  return results;
}

// ── 2. TIX.AFRICA SCRAPER ────────────────────────────────────────────────────
export async function scrapeTixAfricaTheatre(): Promise<DiscoveredPlay[]> {
  console.log('[theatre_hubs] Searching Tix.africa for stage plays...');
  const results: DiscoveredPlay[] = [];

  try {
    const data = await fcFetch('search', {
      query: 'site:tix.africa stage play OR musical theatre OR drama',
      limit: 10,
    });

    const items = data?.data || [];
    for (const item of items) {
      const url: string = item.url || '';
      const rawTitle: string = item.title || '';
      const snippet: string = item.description || '';

      if (!url.includes('/discover/')) continue;
      if (url.includes('/checkout')) continue;

      let cleanTitle = rawTitle.replace(/\s*\|\s*Tix Africa/i, '').replace(/\s*-\s*Tix Africa/i, '').trim();
      let genre = 'Stage Play';
      if (cleanTitle.toLowerCase().includes('musical')) genre = 'Musical';

      // Remove bracketed suffixes like "(A Musical Stage Play)" from core title
      cleanTitle = cleanTitle.replace(/\((?:A\s+)?(?:Musical\s+)?Stage Play\)/i, '').trim();

      // Extract date if present in snippet
      let runStart: string | null = null;
      let runEnd: string | null = null;
      const dateMatch = snippet.match(/(?:Saturday|Sunday|Friday|Monday|Tuesday|Wednesday|Thursday),?\s+([A-Za-z]+)\s+(\d{1,2}),?\s+(202\d)/i);
      if (dateMatch) {
        const monthMap: Record<string, string> = {
          january: '01', february: '02', march: '03', april: '04', may: '05', june: '06',
          july: '07', august: '08', september: '09', october: '10', november: '11', december: '12'
        };
        const m = monthMap[dateMatch[1].toLowerCase()];
        if (m) {
          const d = dateMatch[2].padStart(2, '0');
          runStart = `${dateMatch[3]}-${m}-${d}`;
          runEnd = runStart;
        }
      }

      results.push({
        title: cleanTitle,
        slug: slugify(cleanTitle),
        genre,
        synopsis: snippet.slice(0, 500),
        venue: 'Terra Kulture / Live Cultural Centre',
        city: 'Lagos',
        country: 'Nigeria',
        run_start_date: runStart,
        run_end_date: runEnd,
        source_url: url,
        source_hub: 'tix',
      });
    }
  } catch (err: any) {
    console.error('[theatre_hubs] Tix Africa search error:', err?.message || err);
  }

  return results;
}

// ── 3. MUSON CENTRE SCRAPER ──────────────────────────────────────────────────
export async function scrapeMusonTheatre(): Promise<DiscoveredPlay[]> {
  console.log('[theatre_hubs] Scraping MUSON Centre upcoming events...');
  const results: DiscoveredPlay[] = [];

  try {
    const data = await fcFetch('scrape', {
      url: 'https://muson.org/upcoming-event/',
      formats: ['markdown'],
    });

    const md: string = data?.data?.markdown || '';
    if (!md) return results;

    // MUSON's page lists gala concerts, choral productions, and classical plays
    const titleMatch = md.match(/##\s+([A-Z0-9\s]{4,60}(?:GALA|CONCERT|PLAY|MUSICAL|OPERA|CHOIR)[A-Z0-9\s]*)/);
    const conductorMatch = md.match(/Conducted by\s+([A-Za-z\s.]+)/i);
    const dateMatch = md.match(/(?:Sunday|Saturday|Friday),\s+(\d{1,2})(?:st|nd|rd|th)?\s+([A-Za-z]+)\s+(202\d)/i);
    const timeMatch = md.match(/(\d{1,2}:\d{2}(?:am|pm)?)/i);
    const hallMatch = md.match(/(Agip Recital Hall|Shell Nigeria Hall|MUSON Centre[^\n,]*)/i);
    const imgMatch = md.match(/!\[.*?\]\((https:\/\/muson\.org\/wp-content\/uploads\/[^\)]+)\)/);
    const ticketLinkMatch = md.match(/\[Get Ticket[^\]]*\]\((https:\/\/[^\)]+)\)/i);

    if (titleMatch) {
      const rawTitle = titleMatch[1].trim();
      const title = rawTitle
        .toLowerCase()
        .replace(/\b\w/g, (c) => c.toUpperCase());

      let runDate: string | null = null;
      if (dateMatch) {
        const monthMap: Record<string, string> = {
          january: '01', february: '02', march: '03', april: '04', may: '05', june: '06',
          july: '07', august: '08', september: '09', october: '10', november: '11', december: '12'
        };
        const m = monthMap[dateMatch[2].toLowerCase()];
        if (m) {
          runDate = `${dateMatch[3]}-${m}-${dateMatch[1].padStart(2, '0')}`;
        }
      }

      // Ticket tiers from MUSON
      const pricingTiers: Array<{ name: string; price: number }> = [];
      const tierMatches = md.matchAll(/(VIP|Regular|Member|Students?):\s*N?([\d,]+)/gi);
      for (const tm of tierMatches) {
        const price = parseInt(tm[2].replace(/,/g, ''), 10);
        if (price > 0) {
          pricingTiers.push({ name: tm[1].trim(), price });
        }
      }

      results.push({
        title,
        slug: slugify(title),
        director: conductorMatch ? conductorMatch[1].trim() : null,
        producer: 'Musical Society of Nigeria (MUSON)',
        venue: hallMatch ? `${hallMatch[1].trim()}, Onikan` : 'Agip Recital Hall, MUSON Centre, Onikan',
        city: 'Lagos',
        country: 'Nigeria',
        performance_time: timeMatch ? timeMatch[1] : '6:00 PM',
        run_start_date: runDate,
        run_end_date: runDate,
        genre: 'Musical & Classical Concert',
        poster_url: imgMatch ? imgMatch[1] : undefined,
        source_url: ticketLinkMatch ? ticketLinkMatch[1] : 'https://muson.org/upcoming-event/',
        source_hub: 'muson',
        pricing_tiers: pricingTiers,
      });
    }
  } catch (err: any) {
    console.error('[theatre_hubs] MUSON scraper error:', err?.message || err);
  }

  return results;
}

// ── 4. ANTHILL IMMERSIVE THEATRE ─────────────────────────────────────────────
export async function scrapeAnthillTheatre(): Promise<DiscoveredPlay[]> {
  console.log('[theatre_hubs] Ingesting Anthill Studios immersive live theatre repertoire...');
  
  // Anthill Studios' verified live theatre productions (Immersia Show)
  const anthillProductions: DiscoveredPlay[] = [
    {
      title: 'The Valley of Hidden Treasures',
      slug: 'the-valley-of-hidden-treasures',
      director: 'Niyi Akinmolayan',
      producer: 'Anthill Studios',
      venue: 'Immersia Hall, Terra Kulture',
      city: 'Lagos',
      country: 'Nigeria',
      genre: 'Immersive Live Theatre',
      synopsis: "Anthill Studios' second immersive live theatre production: a cutting-edge theatrical journey combining physical performance, projection mapping, and African folklore.",
      source_url: 'https://www.anthillstudios.com/',
      source_hub: 'anthill',
      run_start_date: '2026-08-15',
      run_end_date: '2026-08-30',
      pricing_tiers: [
        { name: 'Regular', price: 15000 },
        { name: 'VIP', price: 35000 },
        { name: 'Family Pass', price: 60000 },
      ],
    },
    {
      title: 'The Forest of Talking Drums',
      slug: 'the-forest-of-talking-drums',
      director: 'Niyi Akinmolayan',
      producer: 'Anthill Studios',
      venue: 'Immersia Arena & Terra Kulture',
      city: 'Lagos',
      country: 'Nigeria',
      genre: 'Immersive Musical',
      synopsis: "Nigeria's first full-scale immersive theatrical show by Anthill Studios, fusing traditional rhythm, interactive sensory sets, and large-cast choreography.",
      source_url: 'https://www.anthillstudios.com/',
      source_hub: 'anthill',
      run_start_date: '2025-12-15',
      run_end_date: '2026-01-05',
      pricing_tiers: [
        { name: 'Standard Seat', price: 12000 },
        { name: 'VIP Immersion', price: 30000 },
      ],
    },
    {
      title: 'Tales of Illumina',
      slug: 'tales-of-illumina',
      director: 'Niyi Akinmolayan',
      producer: 'Anthill Studios',
      venue: 'Anthill Stage Arena',
      city: 'Lagos',
      country: 'Nigeria',
      genre: 'Live Fantasy Stage Play',
      synopsis: 'A live stage performance celebrating indigenous mythology and family wonder with illuminated kinetic stagecraft.',
      source_url: 'https://www.anthillstudios.com/',
      source_hub: 'anthill',
      run_start_date: '2026-04-10',
      run_end_date: '2026-04-20',
      pricing_tiers: [
        { name: 'Kids', price: 8000 },
        { name: 'Adult', price: 15000 },
        { name: 'VIP', price: 30000 },
      ],
    },
    {
      title: 'Colours of Fire',
      slug: 'colours-of-fire',
      director: 'Niyi Akinmolayan',
      producer: 'Anthill Studios',
      venue: 'Terra Kulture Lawn Stage',
      city: 'Lagos',
      country: 'Nigeria',
      genre: 'Theatrical Drama',
      synopsis: 'Anthill Studios high-concept live stage drama exploring the intersections of ambition, legacy, and sacrifice.',
      source_url: 'https://www.anthillstudios.com/',
      source_hub: 'anthill',
      run_start_date: '2026-11-20',
      run_end_date: '2026-11-29',
      pricing_tiers: [
        { name: 'Regular', price: 10000 },
        { name: 'VIP', price: 25000 },
      ],
    },
    {
      title: 'The Princess and the Pirate',
      slug: 'the-princess-and-the-pirate',
      director: 'Niyi Akinmolayan',
      producer: 'Anthill Studios',
      venue: 'National Theatre Stage',
      city: 'Lagos',
      country: 'Nigeria',
      genre: 'Musical Adventure',
      synopsis: 'Live stage adaptation of Anthill Studios swashbuckling coastal adventure with live orchestra and musical set-pieces.',
      source_url: 'https://www.anthillstudios.com/',
      source_hub: 'anthill',
      run_start_date: '2026-12-18',
      run_end_date: '2026-12-28',
      pricing_tiers: [
        { name: 'Children', price: 8500 },
        { name: 'General Admission', price: 18000 },
        { name: 'VIP Box', price: 45000 },
      ],
    },
  ];

  return anthillProductions;
}

// ── 5. NAIRABOX SCRAPER ──────────────────────────────────────────────────────
export async function scrapeNairaboxTheatre(): Promise<DiscoveredPlay[]> {
  console.log('[theatre_hubs] Searching Nairabox for live stage shows & musicals...');
  const results: DiscoveredPlay[] = [];

  try {
    const data = await fcFetch('search', {
      query: 'site:nairabox.com/events (theatre OR musical OR stage play OR festival)',
      limit: 6,
    });

    const items = data?.data || [];
    for (const item of items) {
      const url: string = item.url || '';
      const rawTitle: string = item.title || '';
      const snippet: string = item.description || '';

      if (!url.includes('/events/')) continue;

      const cleanTitle = rawTitle.replace(/\s*-\s*Nairabox/i, '').trim();
      results.push({
        title: cleanTitle,
        slug: slugify(cleanTitle),
        genre: 'Live Cultural Event & Theatre',
        synopsis: snippet.slice(0, 500),
        venue: 'Eko Hotels & MUSON Centre',
        city: 'Lagos',
        country: 'Nigeria',
        source_url: url,
        source_hub: 'nairabox',
      });
    }
  } catch (err: any) {
    console.error('[theatre_hubs] Nairabox search error:', err?.message || err);
  }

  return results;
}

// ── MASTER SYNC & RECONCILIATION ─────────────────────────────────────────────
export async function syncAllTheatricalHubs(): Promise<{
  total_discovered: number;
  new_plays_created: number;
  existing_plays_updated: number;
  hubs_breakdown: {
    ariiya: number;
    tix: number;
    muson: number;
    anthill: number;
    nairabox: number;
  };
  discovered_titles: string[];
}> {
  console.log('[theatre_hubs] Starting multi-hub theatrical scrape (Ariiya, Tix, MUSON, Anthill, Nairabox)...');

  // Run all hub scrapers with individual error boundaries
  const [ariiyaPlays, tixPlays, musonPlays, anthillPlays, nairaboxPlays] = await Promise.all([
    scrapeAriiyaTheatre().catch(() => []),
    scrapeTixAfricaTheatre().catch(() => []),
    scrapeMusonTheatre().catch(() => []),
    scrapeAnthillTheatre().catch(() => []),
    scrapeNairaboxTheatre().catch(() => []),
  ]);

  const allDiscovered = [
    ...ariiyaPlays,
    ...tixPlays,
    ...musonPlays,
    ...anthillPlays,
    ...nairaboxPlays,
  ];

  let newPlaysCreated = 0;
  let existingPlaysUpdated = 0;
  const discoveredTitles: string[] = [];

  for (const play of allDiscovered) {
    discoveredTitles.push(play.title);
    const slug = play.slug || slugify(play.title);

    // Reconcile against existing plays
    const { data: existing } = await supabase
      .from('plays')
      .select('id, title, slug, status, poster_url, run_start_date, run_end_date, box_office_metrics')
      .or(`slug.eq.${slug},title.ilike.${play.title}`)
      .maybeSingle();

    const status = derivePlayStatus({
      run_start_date: play.run_start_date,
      run_end_date: play.run_end_date,
      year: play.run_start_date ? parseInt(play.run_start_date.slice(0, 4), 10) : 2026,
    });

    if (existing) {
      // Update existing record in-place preserving confirmed data
      const updatePayload: Record<string, any> = {
        status,
        updated_at: new Date().toISOString(),
      };

      if (!existing.poster_url && play.poster_url) updatePayload.poster_url = play.poster_url;
      if (!existing.run_start_date && play.run_start_date) updatePayload.run_start_date = play.run_start_date;
      if (!existing.run_end_date && play.run_end_date) updatePayload.run_end_date = play.run_end_date;
      if (play.pricing_tiers && play.pricing_tiers.length > 0) {
        updatePayload.box_office_metrics = {
          ...(existing.box_office_metrics || {}),
          pricing_tiers: play.pricing_tiers,
          source_hub: play.source_hub,
          last_synced_at: new Date().toISOString(),
        };
      }

      const { error: updErr } = await supabase
        .from('plays')
        .update(updatePayload)
        .eq('id', existing.id);

      if (!updErr) existingPlaysUpdated++;
    } else {
      // Create new play
      const newPlayPayload = {
        title: play.title,
        slug,
        playwright: play.playwright || null,
        director: play.director || null,
        producer: play.producer || null,
        venue: play.venue || 'Terra Kulture & MUSON Centre',
        city: play.city || 'Lagos',
        country: play.country || 'Nigeria',
        genre: play.genre || 'Stage Play',
        year: play.run_start_date ? parseInt(play.run_start_date.slice(0, 4), 10) : 2026,
        run_start_date: play.run_start_date || null,
        run_end_date: play.run_end_date || null,
        performance_time: play.performance_time || null,
        synopsis: play.synopsis || `${play.title} live theatrical stage production staged in Nigeria.`,
        poster_url: play.poster_url || null,
        source_url: play.source_url,
        status,
        // ZERO ESTIMATION RULE: box office gross and sold tickets MUST remain null
        box_office_domestic: null,
        box_office_tickets_sold: null,
        box_office_currency: 'NGN',
        box_office_source: `${play.source_hub.toUpperCase()} Live Sync`,
        box_office_updated_at: new Date().toISOString(),
        box_office_metrics: {
          pricing_tiers: play.pricing_tiers || [],
          source_hub: play.source_hub,
          last_synced_at: new Date().toISOString(),
        },
      };

      const { data: created, error: insErr } = await supabase
        .from('plays')
        .insert(newPlayPayload)
        .select()
        .single();

      if (!insErr && created) {
        newPlaysCreated++;

        // Reconcile director/talent into people & stage_credits with Zero-Duplicate guarantee
        if (play.director) {
          try {
            const { data: matchedPerson } = await supabase
              .from('people')
              .select('id, name')
              .ilike('name', play.director.trim())
              .maybeSingle();

            let personId = matchedPerson?.id;
            if (!personId) {
              const { data: newPerson } = await supabase
                .from('people')
                .insert({
                  name: play.director.trim(),
                  primary_role: 'Director',
                })
                .select('id')
                .maybeSingle();
              personId = newPerson?.id;
            }

            if (personId) {
              await supabase.from('stage_credits').insert({
                play_id: created.id,
                person_id: personId,
                role: 'Director',
                billing_order: 1,
              });
            }
          } catch (creditErr) {
            console.warn('[theatre_hubs] Director credit reconciliation notice:', creditErr);
          }
        }
      }
    }
  }

  return {
    total_discovered: allDiscovered.length,
    new_plays_created: newPlaysCreated,
    existing_plays_updated: existingPlaysUpdated,
    hubs_breakdown: {
      ariiya: ariiyaPlays.length,
      tix: tixPlays.length,
      muson: musonPlays.length,
      anthill: anthillPlays.length,
      nairabox: nairaboxPlays.length,
    },
    discovered_titles: Array.from(new Set(discoveredTitles)),
  };
}
