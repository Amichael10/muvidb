/**
 * Seed Ozone Cinemas and KADA Cinemas into the cinemas table.
 * Both use scrape_adapter = 'reach_cinema' — same Fusion Intel platform as Viva,
 * but with per-chain API bases and JWTs.
 *
 * OZONE — confirmed working:
 *   cinemaId:  ozo-a4239533   ("Ozone Cinemas", Yaba/Lagos)
 *   apiBase:   https://max-api.fusionintel.io/api/v1
 *   JWT:       extracted from ozone.reachcinema.io JS bundle (exp: 2027)
 *
 * KADA — NOT YET CONFIRMED:
 *   KADA Cinema Kaduna does not appear to have an active online booking system
 *   as of April 2026. The row is seeded with scrape_enabled=false so it won't
 *   run until the cinemaId + JWT are confirmed via DevTools inspection of
 *   whatever booking site they eventually launch.
 *
 * Usage:
 *   node scripts/seed-ozone-kada-cinemas.mjs
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

// Public JWT from ozone.reachcinema.io JS bundle — no secrets, publicly visible
const OZONE_JWT =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9' +
  '.eyJyb2xlIjoiQ2luZW1hQXBpIiwiQ2luZW1hSWQiOiJvem8tYTQyMzk1MzMiLCJuYmYiOjE3NzUwNDYwMjgsImV4cCI6MTgwNjU4MjAyOCwiaWF0IjoxNzc1MDQ2MDI4LCJpc3MiOiJodHRwczovL2Z1c2lvbmludGVsLmlvIiwiYXVkIjoiVXNlciJ9' +
  '.XVMBsqqs5546TXmupwOGb8vIPk1avihRKT16rLawJ_A';

const CINEMAS = [
  {
    name:           'Ozone Cinemas',
    chain:          'Ozone',
    city:           'Lagos',
    state:          'Lagos',
    address:        'Yaba, Lagos',  // Update with exact address if known
    booking_url:    'https://ozone.reachcinema.io',
    scrape_adapter: 'reach_cinema',
    scrape_enabled: true,
    scrape_config: {
      externalCinemaId: 'ozo-a4239533',
      apiBase:          'https://max-api.fusionintel.io/api/v1',
      bookingBaseUrl:   'https://ozone.reachcinema.io',
      jwt:              OZONE_JWT,
    },
  },
  {
    // KADA Cinema — disabled until cinemaId + JWT confirmed
    // To activate: set scrape_enabled=true once externalCinemaId is found via
    // DevTools inspection of the KADA booking app. The reach_cinema adapter
    // supports any Fusion Intel circuit, just needs the right cinemaId + JWT.
    name:           'KADA Cinema Kaduna',
    chain:          'KADA',
    city:           'Kaduna',
    state:          'Kaduna',
    address:        'Kaduna',
    booking_url:    null,
    scrape_adapter: 'reach_cinema',
    scrape_enabled: false,    // ← disabled — needs cinemaId confirmed
    scrape_config: {
      externalCinemaId: null, // TODO: find via DevTools on KADA booking site
      apiBase:          'https://max-api.fusionintel.io/api/v1',
      bookingBaseUrl:   null,
      jwt:              null,
    },
  },
];

console.log(`Seeding ${CINEMAS.length} Ozone/KADA cinema(s)…\n`);

let inserted = 0, updated = 0, errored = 0;

for (const cinema of CINEMAS) {
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
    else        { console.log(`  ✓ ${cinema.name.padEnd(46)}  inserted (id=${row.id})  enabled=${cinema.scrape_enabled}`); inserted++; }
  }
}

console.log(`\nDone. ${inserted} inserted · ${updated} updated · ${errored} errors.`);
console.log('\nNext: run scripts/run-scrape-all.mjs to test Ozone scraping.');
