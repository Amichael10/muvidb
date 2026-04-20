/**
 * Seed Blue Pictures Cinema into the cinemas table.
 * scrape_adapter = 'bluepictures' — parses /now-showing/ HTML directly.
 *
 * Usage:
 *   node scripts/seed-bluepictures-cinema.mjs
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

const BLUE_PICTURES_CINEMAS = [
  {
    name:           'Blue Pictures Cinema',
    chain:          'Blue Pictures',
    city:           'Lagos',
    state:          'Lagos',
    address:        'Blenco Mall, 16 Murtala Mohammed International Airport Road, Ikeja, Lagos',
    booking_url:    'https://bluepicturesng.com/value/blockbuster-ticket/',
    scrape_adapter: 'bluepictures',
    scrape_enabled: true,
    scrape_config: {
      nowShowingUrl: 'https://bluepicturesng.com/now-showing/',
      ticketUrl:     'https://bluepicturesng.com/value/blockbuster-ticket/',
    },
  },
];

console.log(`Seeding ${BLUE_PICTURES_CINEMAS.length} Blue Pictures cinema(s)…\n`);

let inserted = 0, updated = 0, errored = 0;

for (const cinema of BLUE_PICTURES_CINEMAS) {
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
