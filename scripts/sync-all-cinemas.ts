/**
 * Complete Cinema Showtime & High-Res Poster Sync Runner.
 *
 * Runs locally from Nigeria or via Proxy to sync showtimes and enrich posters.
 *
 * Usage:
 *   npm run sync:cinemas
 *   npx tsx scripts/sync-all-cinemas.ts
 *   npx tsx scripts/sync-all-cinemas.ts --chain=silverbird
 *   npx tsx scripts/sync-all-cinemas.ts --chain=filmhouse
 *   npx tsx scripts/sync-all-cinemas.ts --chain=genesis
 *   npx tsx scripts/sync-all-cinemas.ts --dry-run
 */

import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config();

import { createClient } from '@supabase/supabase-js';
import { ADAPTERS, upsertShowtimes } from '../api/_lib/cinema-adapters/index.js';
import type { CinemaRow } from '../api/_lib/cinema-adapters/types.js';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

const supabase = (SUPABASE_URL && SUPABASE_KEY)
  ? createClient(SUPABASE_URL, SUPABASE_KEY)
  : null;

// Known siteTokens and config mappings for Nigerian Cinema chains
const KNOWN_TOKENS: Record<string, { adapter: string; config: Record<string, any> }> = {
  'ikeja': { adapter: 'veezi', config: { siteToken: '4x3z2wcre0rek2beab5w344ae0' } },
  'jabi': { adapter: 'veezi', config: { siteToken: 'ntfpkgyc0phrmzxb2ctk828vd4' } },
  'abuja': { adapter: 'veezi', config: { siteToken: 'ntfpkgyc0phrmzxb2ctk828vd4' } },
  'galleria': { adapter: 'veezi', config: { siteToken: '9z2w1vcre0rek2beab5w344ae1' } },
  'victoria island': { adapter: 'veezi', config: { siteToken: '9z2w1vcre0rek2beab5w344ae1' } },
};

// Default top cinema configurations in Nigeria
const DEFAULT_CINEMAS: Partial<CinemaRow>[] = [
  // ── SILVERBIRD CINEMAS ──
  {
    name: 'Silverbird Cinemas Ikeja City Mall',
    chain: 'Silverbird',
    scrape_adapter: 'veezi',
    scrape_config: { siteToken: '4x3z2wcre0rek2beab5w344ae0' },
  },
  {
    name: 'Silverbird Cinemas Jabi Lake Abuja',
    chain: 'Silverbird',
    scrape_adapter: 'veezi',
    scrape_config: { siteToken: 'ntfpkgyc0phrmzxb2ctk828vd4' },
  },
  {
    name: 'Silverbird Cinemas Galleria VI',
    chain: 'Silverbird',
    scrape_adapter: 'veezi',
    scrape_config: { siteToken: '9z2w1vcre0rek2beab5w344ae1' },
  },

  // ── FILMHOUSE CINEMAS ──
  {
    name: 'Filmhouse Cinema Lekki',
    chain: 'Filmhouse',
    scrape_adapter: 'filmhouse',
    scrape_config: { url: 'https://www.filmhouseng.com/en/cinemas/lekki/movies', cinemaSlug: 'lekki' },
  },
  {
    name: 'Filmhouse IMAX Lekki',
    chain: 'Filmhouse',
    scrape_adapter: 'filmhouse',
    scrape_config: { url: 'https://www.filmhouseng.com/en/cinemas/imax-lekki/movies', cinemaSlug: 'imax-lekki' },
  },
  {
    name: 'Filmhouse Cinema Surulere',
    chain: 'Filmhouse',
    scrape_adapter: 'filmhouse',
    scrape_config: { url: 'https://www.filmhouseng.com/en/cinemas/surulere/movies', cinemaSlug: 'surulere' },
  },
  {
    name: 'Filmhouse Cinema Landmark',
    chain: 'Filmhouse',
    scrape_adapter: 'filmhouse',
    scrape_config: { url: 'https://www.filmhouseng.com/en/cinemas/landmark/movies', cinemaSlug: 'landmark' },
  },

  // ── GENESIS CINEMAS ──
  {
    name: 'Genesis Cinemas Palms Lekki',
    chain: 'Genesis',
    scrape_adapter: 'genesis',
    scrape_config: { siteId: '1001', url: 'https://genesiscinemas.com/freedom-way-lekki/' },
  },
  {
    name: 'Genesis Cinemas Abuja',
    chain: 'Genesis',
    scrape_adapter: 'genesis',
    scrape_config: { siteId: '1002', url: 'https://genesiscinemas.com/ceddi-plaza-abuja/' },
  },
  {
    name: 'Genesis Cinemas Port Harcourt',
    chain: 'Genesis',
    scrape_adapter: 'genesis',
    scrape_config: { siteId: '1003', url: 'https://genesiscinemas.com/genesis-center-port-harcourt/' },
  },

  // ── BLUE PICTURES CINEMA ──
  {
    name: 'Blue Pictures Cinema Onikan',
    chain: 'Blue Pictures',
    scrape_adapter: 'bluepictures',
    scrape_config: { url: 'https://bluepicturesng.com/now-showing/' },
  },

  // ── VIVA CINEMAS ──
  {
    name: 'Viva Cinemas Ikeja',
    chain: 'Viva',
    scrape_adapter: 'reach_cinema',
    scrape_config: { externalCinemaId: 'viv-27fd41dc', bookingBaseUrl: 'https://web.vivacinemas.com' },
  },
  {
    name: 'Viva Cinemas Abuja',
    chain: 'Viva',
    scrape_adapter: 'reach_cinema',
    scrape_config: { externalCinemaId: 'viv-27fd41dc', bookingBaseUrl: 'https://web.vivacinemas.com' },
  },
  {
    name: 'Viva Cinemas Ibadan',
    chain: 'Viva',
    scrape_adapter: 'reach_cinema',
    scrape_config: { externalCinemaId: 'viv-27fd41dc', bookingBaseUrl: 'https://web.vivacinemas.com' },
  },
  {
    name: 'Viva Cinemas Ilorin',
    chain: 'Viva',
    scrape_adapter: 'reach_cinema',
    scrape_config: { externalCinemaId: 'viv-27fd41dc', bookingBaseUrl: 'https://web.vivacinemas.com' },
  },
  {
    name: 'Viva Cinemas Ota',
    chain: 'Viva',
    scrape_adapter: 'reach_cinema',
    scrape_config: { externalCinemaId: 'viv-27fd41dc', bookingBaseUrl: 'https://web.vivacinemas.com' },
  },

  // ── KADA CINEMAS ──
  {
    name: 'KADA Cinema Kaduna',
    chain: 'Kada',
    scrape_adapter: 'reach_cinema',
    scrape_config: { externalCinemaId: 'kad-65087c1a', bookingBaseUrl: 'https://kadacinemas.com' },
  },
  {
    name: 'Kada Cinemas Benin',
    chain: 'Kada',
    scrape_adapter: 'reach_cinema',
    scrape_config: { externalCinemaId: 'kad-65087c1a', bookingBaseUrl: 'https://kadacinemas.com' },
  },
  {
    name: 'Kada Calabar',
    chain: 'Kada',
    scrape_adapter: 'reach_cinema',
    scrape_config: { externalCinemaId: 'kad-65087c1a', bookingBaseUrl: 'https://kadacinemas.com' },
  },

  // ── BOX OFFICE CINEMAS ──
  {
    name: 'Box Office Cinemas Garden City',
    chain: 'Box Office',
    scrape_adapter: 'reach_cinema',
    scrape_config: { externalCinemaId: 'fil-98ff968e', bookingBaseUrl: 'https://boxofficecinemas.ng' },
  },
  {
    name: 'Box Office Cinemas Pleasure Park',
    chain: 'Box Office',
    scrape_adapter: 'reach_cinema',
    scrape_config: { externalCinemaId: 'box-62fe38ce', bookingBaseUrl: 'https://boxofficecinemas.ng' },
  },

  // ── NILE & NOVA CINEMAS ──
  {
    name: 'Nile Cinemas',
    chain: 'Nile',
    scrape_adapter: 'reach_cinema',
    scrape_config: { externalCinemaId: 'thc-e7ff5df1', bookingBaseUrl: 'https://nilecinemas.com' },
  },
  {
    name: 'Nova Cinema Abuja',
    chain: 'Nova',
    scrape_adapter: 'reach_cinema',
    scrape_config: { externalCinemaId: 'nov-f76e616e', bookingBaseUrl: 'https://novacinemang.com' },
  },
];

async function sync() {
  console.log(`\n======================================================`);
  console.log(`🎬 MUVIDB CINEMA SHOWTIME & POSTER ENRICHMENT RUNNER`);
  console.log(`======================================================\n`);

  const isDryRun = process.argv.includes('--dry-run');
  const includeAll = process.argv.includes('--all');

  let dbCinemas: any[] | null = null;
  if (supabase && !isDryRun) {
    try {
      const { data } = await supabase
        .from('cinemas')
        .select('id, name, chain, city, booking_url, scrape_adapter, scrape_config, scrape_enabled')
        .order('name');
      dbCinemas = data;
    } catch {
      console.log('⚠️ Could not connect to Supabase. Running in standalone extraction mode.\n');
    }
  }

  const rawList = (dbCinemas && dbCinemas.length > 0) ? dbCinemas : DEFAULT_CINEMAS;

  const targetCinemas: any[] = rawList
    .map(c => {
      let adapter = c.scrape_adapter;
      let config = c.scrape_config || {};

      // Match known tokens if missing
      const nameLower = (c.name || '').toLowerCase();
      for (const [key, mapping] of Object.entries(KNOWN_TOKENS)) {
        if (nameLower.includes(key) && (c.chain?.toLowerCase() === 'silverbird' || !c.chain)) {
          if (!config.siteToken && mapping.config.siteToken) {
            config = { ...config, ...mapping.config };
            adapter = adapter || mapping.adapter;
          }
        }
      }

      // Check fallback list
      const fallback = DEFAULT_CINEMAS.find(d => d.name?.toLowerCase() === nameLower);
      if (fallback) {
        adapter = adapter || fallback.scrape_adapter;
        config = Object.keys(config).length ? config : fallback.scrape_config;
      }

      return {
        ...c,
        scrape_adapter: adapter,
        scrape_config: config,
      };
    })
    .filter(c => {
      // Unless --all is specified, skip disabled or unconfigured rows
      if (!includeAll && c.scrape_enabled === false) return false;
      if (c.scrape_adapter === 'veezi' && !c.scrape_config?.siteToken) return false;
      if (c.scrape_adapter === 'reach_cinema' && !c.scrape_config?.externalCinemaId) return false;
      return true;
    });

  // CLI Filters
  const chainArg = process.argv.find(a => a.startsWith('--chain='))?.slice('--chain='.length).toLowerCase();
  const cinemaArg = process.argv.find(a => a.startsWith('--cinema='))?.slice('--cinema='.length).toLowerCase();

  const filtered = targetCinemas.filter(c => {
    if (chainArg && c.chain?.toLowerCase() !== chainArg) return false;
    if (cinemaArg && !c.name?.toLowerCase().includes(cinemaArg)) return false;
    return true;
  });

  console.log(`Found ${filtered.length} active cinema targets to process...\n`);

  let totalShowtimes = 0;
  let totalMatched = 0;
  let totalUnmatched = 0;
  let successCount = 0;
  let failCount = 0;

  for (const cinema of filtered) {
    const adapter = (ADAPTERS as any)[cinema.scrape_adapter];
    if (!adapter) {
      console.log(`  ✗ [${cinema.chain || 'Other'}] ${cinema.name}: No adapter '${cinema.scrape_adapter}'`);
      failCount++;
      continue;
    }

    const t0 = Date.now();
    try {
      console.log(`Fetching [${cinema.chain || 'Other'}] ${cinema.name}...`);
      const res = await adapter(cinema);
      if (res.error) throw new Error(res.error);

      const rawShowtimes = res.showtimes || [];
      if (rawShowtimes.length === 0) {
        console.log(`  ⚠ ${cinema.name}: 0 showtimes returned (${Date.now() - t0}ms)`);
        continue;
      }

      // Extract unique films and posters
      const films = new Map<string, string | undefined>();
      rawShowtimes.forEach((s: any) => {
        if (!films.has(s.filmTitle)) {
          films.set(s.filmTitle, s.filmMeta?.posterUrl);
        }
      });

      // Upsert into Supabase with poster enrichment if available
      let stats = { matched_showtimes: rawShowtimes.length, unmatched_titles: 0 };
      if (supabase && cinema.id && !cinema.id.startsWith('cinema-') && !isDryRun) {
        try {
          stats = await upsertShowtimes(cinema.id, rawShowtimes, cinema.scrape_adapter);
          await supabase
            .from('cinemas')
            .update({
              showtimes_last_fetched_at: new Date().toISOString(),
              scrape_failure_count: 0,
              scrape_last_error: null,
            })
            .eq('id', cinema.id);
        } catch (dbErr: any) {
          console.log(`  ⚠️ DB upsert skipped: ${dbErr.message}`);
        }
      }

      totalShowtimes += rawShowtimes.length;
      totalMatched += stats.matched_showtimes;
      totalUnmatched += stats.unmatched_titles;
      successCount++;

      console.log(
        `  ✓ ${cinema.name.padEnd(35)} → ${rawShowtimes.length} showtimes across ${films.size} films (${Date.now() - t0}ms)`
      );
      // Log sample posters
      for (const [title, poster] of Array.from(films.entries()).slice(0, 3)) {
        if (poster) console.log(`      • "${title}": ${poster}`);
      }
    } catch (err: any) {
      failCount++;
      console.log(`  ✗ ${cinema.name.padEnd(35)} → ERROR: ${err.message}`);
    }
  }

  console.log(`\n======================================================`);
  console.log(`📊 SYNC SUMMARY`);
  console.log(`======================================================`);
  console.log(`Cinemas Successful: ${successCount}`);
  console.log(`Cinemas Failed:     ${failCount}`);
  console.log(`Total Showtimes:    ${totalShowtimes}`);
  console.log(`Nollywood Matched:  ${totalMatched}`);
  console.log(`======================================================\n`);
}

sync();
