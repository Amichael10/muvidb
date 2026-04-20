/**
 * Seed Genesis Cinemas into the cinemas table.
 * scrape_adapter = 'firecrawl' — uses Firecrawl to bypass geo-blocks.
 *
 * Genesis operates 7 locations. Each gets its own per-location movies page URL
 * in scrape_config.url so Firecrawl extracts only that cinema's schedule.
 *
 * NOTE: The URL paths below are best guesses based on common Genesis site patterns.
 * If they 404, inspect https://genesiscinemas.com.ng in your browser and find the
 * per-cinema movies page, then update scrape_config.url here.
 *
 * Usage:
 *   FIRECRAWL_API_KEY=fc-... node scripts/seed-genesis-cinemas.mjs
 *   (or just ensure .env has FIRECRAWL_API_KEY set)
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

const GENESIS_CINEMAS = [
  {
    name:           'Genesis Cinemas The Palms',
    chain:          'Genesis',
    city:           'Lagos',
    state:          'Lagos',
    address:        'The Palms Shopping Mall, Bisola Durosinmi-Etti Drive, Lekki Phase 1, Lagos',
    booking_url:    'https://genesiscinemas.com.ng',
    scrape_adapter: 'firecrawl',
    scrape_enabled: true,
    scrape_config: {
      url: 'https://genesiscinemas.com.ng/movies?cinema=lekki',
      ticketBaseUrl: 'https://genesiscinemas.com.ng',
    },
  },
  {
    name:           'Genesis Cinemas Port Harcourt',
    chain:          'Genesis',
    city:           'Port Harcourt',
    state:          'Rivers',
    address:        'Genesis Hub, 1 Peter Odili Road, Port Harcourt, Rivers State',
    booking_url:    'https://genesiscinemas.com.ng',
    scrape_adapter: 'firecrawl',
    scrape_enabled: true,
    scrape_config: {
      url: 'https://genesiscinemas.com.ng/movies?cinema=port-harcourt',
      ticketBaseUrl: 'https://genesiscinemas.com.ng',
    },
  },
  {
    name:           'Genesis Cinemas Abuja',
    chain:          'Genesis',
    city:           'Abuja',
    state:          'FCT',
    address:        'Ceddi Plaza, Central Business District, Abuja',
    booking_url:    'https://genesiscinemas.com.ng',
    scrape_adapter: 'firecrawl',
    scrape_enabled: true,
    scrape_config: {
      url: 'https://genesiscinemas.com.ng/movies?cinema=abuja',
      ticketBaseUrl: 'https://genesiscinemas.com.ng',
    },
  },
  {
    name:           'Genesis Cinemas Enugu',
    chain:          'Genesis',
    city:           'Enugu',
    state:          'Enugu',
    address:        'Garden Avenue, GRA, Enugu',
    booking_url:    'https://genesiscinemas.com.ng',
    scrape_adapter: 'firecrawl',
    scrape_enabled: true,
    scrape_config: {
      url: 'https://genesiscinemas.com.ng/movies?cinema=enugu',
      ticketBaseUrl: 'https://genesiscinemas.com.ng',
    },
  },
];

console.log(`Seeding ${GENESIS_CINEMAS.length} Genesis cinema(s)…\n`);

let inserted = 0, updated = 0, errored = 0;

for (const cinema of GENESIS_CINEMAS) {
  const { data: existing } = await supabase
    .from('cinemas')
    .select('id, name')
    .eq('name', cinema.name)
    .eq('chain', cinema.chain)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from('cinemas')
      .update({
        scrape_adapter: cinema.scrape_adapter,
        scrape_enabled: cinema.scrape_enabled,
        scrape_config:  cinema.scrape_config,
        booking_url:    cinema.booking_url,
      })
      .eq('id', existing.id);

    if (error) { console.error(`  ✗ ${cinema.name}: ${error.message}`); errored++; }
    else        { console.log(`  ↺ ${cinema.name.padEnd(46)}  updated  (id=${existing.id})`); updated++; }
  } else {
    const { data: row, error } = await supabase
      .from('cinemas')
      .insert(cinema)
      .select('id')
      .single();

    if (error) { console.error(`  ✗ ${cinema.name}: ${error.message}`); errored++; }
    else        { console.log(`  ✓ ${cinema.name.padEnd(46)}  inserted (id=${row.id})`); inserted++; }
  }
}

console.log(`\nDone. ${inserted} inserted · ${updated} updated · ${errored} errors.`);
console.log('\nReminder: Genesis uses the firecrawl adapter — set FIRECRAWL_API_KEY in .env');
