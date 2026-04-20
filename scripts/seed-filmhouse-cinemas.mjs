/**
 * Seed Filmhouse Cinema locations into the cinemas table.
 *
 * Filmhouse uses the Cinesync platform (filmhouseng.com) but their API encrypts
 * payloads server-side — not scrapeable directly. We use the 'firecrawl' adapter
 * instead, which uses Firecrawl's LLM extraction to parse the per-location
 * movies page at filmhouseng.com/en/cinemas/<slug>/movies.
 *
 * Requires: FIRECRAWL_API_KEY in .env
 *
 * Usage:
 *   node scripts/seed-filmhouse-cinemas.mjs
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

const BASE = 'https://www.filmhouseng.com';

const FILMHOUSE_CINEMAS = [
  {
    name:           'Filmhouse Cinemas Lekki',
    chain:          'Filmhouse',
    city:           'Lagos',
    state:          'Lagos',
    address:        'The Palms Shopping Mall, Bisola Durosinmi-Etti Drive, Lekki Phase 1, Lagos',
    booking_url:    `${BASE}/en/cinemas/lekki`,
    scrape_adapter: 'firecrawl',
    scrape_enabled: true,
    scrape_config:  { url: `${BASE}/en/cinemas/lekki/movies`, ticketBaseUrl: BASE },
  },
  {
    name:           'Filmhouse Cinemas Ikeja',
    chain:          'Filmhouse',
    city:           'Lagos',
    state:          'Lagos',
    address:        'Ikeja City Mall, Obafemi Awolowo Way, Alausa, Ikeja, Lagos',
    booking_url:    `${BASE}/en/cinemas/ikeja`,
    scrape_adapter: 'firecrawl',
    scrape_enabled: true,
    scrape_config:  { url: `${BASE}/en/cinemas/ikeja/movies`, ticketBaseUrl: BASE },
  },
  {
    name:           'Filmhouse Cinemas Surulere',
    chain:          'Filmhouse',
    city:           'Lagos',
    state:          'Lagos',
    address:        'Leisure Mall, Adeniran Ogunsanya Street, Surulere, Lagos',
    booking_url:    `${BASE}/en/cinemas/surulere`,
    scrape_adapter: 'firecrawl',
    scrape_enabled: true,
    scrape_config:  { url: `${BASE}/en/cinemas/surulere/movies`, ticketBaseUrl: BASE },
  },
  {
    name:           'Filmhouse Cinemas Abuja',
    chain:          'Filmhouse',
    city:           'Abuja',
    state:          'FCT',
    address:        'Jabi Lake Mall, Cadastral Zone B01, Jabi, Abuja',
    booking_url:    `${BASE}/en/cinemas/jabi`,
    scrape_adapter: 'firecrawl',
    scrape_enabled: true,
    scrape_config:  { url: `${BASE}/en/cinemas/jabi/movies`, ticketBaseUrl: BASE },
  },
  {
    name:           'Filmhouse Cinemas Port Harcourt',
    chain:          'Filmhouse',
    city:           'Port Harcourt',
    state:          'Rivers',
    address:        'Port Harcourt Mall, Woji Road, GRA Phase 2, Port Harcourt, Rivers State',
    booking_url:    `${BASE}/en/cinemas/port-harcourt`,
    scrape_adapter: 'firecrawl',
    scrape_enabled: true,
    scrape_config:  { url: `${BASE}/en/cinemas/port-harcourt/movies`, ticketBaseUrl: BASE },
  },
  {
    name:           'Filmhouse Cinemas Kano',
    chain:          'Filmhouse',
    city:           'Kano',
    state:          'Kano',
    address:        'Kano City Mall, Kano',
    booking_url:    `${BASE}/en/cinemas/kano`,
    scrape_adapter: 'firecrawl',
    scrape_enabled: true,
    scrape_config:  { url: `${BASE}/en/cinemas/kano/movies`, ticketBaseUrl: BASE },
  },
];

console.log(`Seeding ${FILMHOUSE_CINEMAS.length} Filmhouse cinema(s)…\n`);

let inserted = 0, updated = 0, errored = 0;

for (const cinema of FILMHOUSE_CINEMAS) {
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
console.log('\nNote: Filmhouse uses the firecrawl adapter. Add FIRECRAWL_API_KEY to .env to activate.');
console.log('URL slugs above are best guesses — verify at https://www.filmhouseng.com/en/cinemas');
