/**
 * Seed the 5 Silverbird cinema locations into the cinemas table, setting
 * scrape_adapter = 'veezi' and scrape_config = { siteToken: '...' }.
 *
 * Site tokens were extracted from the Veezi ticketing widget embed codes on
 * each cinema's booking page (publicly visible, no auth required).
 *
 * Usage:
 *   cd /path/to/project
 *   node scripts/seed-silverbird-cinemas.mjs
 *
 * The script is idempotent — it uses upsert on (name, chain) so re-running
 * won't create duplicates. If a row already exists it updates the scrape config.
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

// Verified site tokens from https://ticketing.eu.veezi.com/sessions/?siteToken=<TOKEN>
// Each token renders a complete multi-day schedule for that location.
const SILVERBIRD_CINEMAS = [
  {
    name:            'Silverbird Cinemas Galleria',
    chain:           'Silverbird',
    city:            'Lagos',
    state:           'Lagos',
    address:         '1 Ozumba Mbadiwe Ave, Victoria Island, Lagos',
    booking_url:     'https://ticketing.eu.veezi.com/sessions/?siteToken=4x3z2wcre0rek2beab5w344ae0',
    scrape_adapter:  'veezi',
    scrape_enabled:  true,
    scrape_config:   { siteToken: '4x3z2wcre0rek2beab5w344ae0' },
  },
  {
    name:            'Silverbird Cinemas Ikeja',
    chain:           'Silverbird',
    city:            'Lagos',
    state:           'Lagos',
    address:         'Ikeja City Mall, Obafemi Awolowo Way, Alausa, Ikeja, Lagos',
    booking_url:     'https://ticketing.eu.veezi.com/sessions/?siteToken=9chn7w68550a7sxgexpdng2ndm',
    scrape_adapter:  'veezi',
    scrape_enabled:  true,
    scrape_config:   { siteToken: '9chn7w68550a7sxgexpdng2ndm' },
  },
  {
    name:            'Silverbird Entertainment Centre Abuja',
    chain:           'Silverbird',
    city:            'Abuja',
    state:           'FCT',
    address:         '2A Aminu Kano Crescent, Wuse 2, Abuja',
    booking_url:     'https://ticketing.eu.veezi.com/sessions/?siteToken=ntfpkgyc0phrmzxb2ctk828vd4',
    scrape_adapter:  'veezi',
    scrape_enabled:  true,
    scrape_config:   { siteToken: 'ntfpkgyc0phrmzxb2ctk828vd4' },
  },
  {
    name:            'Silverbird Cinemas Jabi Lake',
    chain:           'Silverbird',
    city:            'Abuja',
    state:           'FCT',
    address:         'Jabi Lake Mall, Cadastral Zone B01, Jabi, Abuja',
    booking_url:     'https://ticketing.eu.veezi.com/sessions/?siteToken=ypr75qx9nh88brqya85qtg3wqc',
    scrape_adapter:  'veezi',
    scrape_enabled:  true,
    scrape_config:   { siteToken: 'ypr75qx9nh88brqya85qtg3wqc' },
  },
  {
    name:            'Silverbird Cinema Galaxy Mall Kaduna',
    chain:           'Silverbird',
    city:            'Kaduna',
    state:           'Kaduna',
    address:         'Galaxy Mall, Independence Way, Kaduna',
    booking_url:     'https://ticketing.eu.veezi.com/sessions/?siteToken=p2gfjfgyfxmt9hja0jzwvh162w',
    scrape_adapter:  'veezi',
    scrape_enabled:  true,
    scrape_config:   { siteToken: 'p2gfjfgyfxmt9hja0jzwvh162w' },
  },
];

console.log(`Seeding ${SILVERBIRD_CINEMAS.length} Silverbird cinema(s)…\n`);

let inserted = 0, updated = 0, errored = 0;

for (const cinema of SILVERBIRD_CINEMAS) {
  // Check if row already exists by name + chain
  const { data: existing } = await supabase
    .from('cinemas')
    .select('id, name, scrape_adapter')
    .eq('name', cinema.name)
    .eq('chain', cinema.chain)
    .maybeSingle();

  if (existing) {
    // Update scrape config only — don't clobber name/address/etc
    const { error } = await supabase
      .from('cinemas')
      .update({
        scrape_adapter: cinema.scrape_adapter,
        scrape_enabled: cinema.scrape_enabled,
        scrape_config:  cinema.scrape_config,
        booking_url:    cinema.booking_url,
      })
      .eq('id', existing.id);

    if (error) {
      console.error(`  ✗ ${cinema.name}: ${error.message}`);
      errored++;
    } else {
      console.log(`  ↺ ${cinema.name.padEnd(46)}  updated  (id=${existing.id})`);
      updated++;
    }
  } else {
    // Insert new row
    const { data: row, error } = await supabase
      .from('cinemas')
      .insert(cinema)
      .select('id')
      .single();

    if (error) {
      console.error(`  ✗ ${cinema.name}: ${error.message}`);
      errored++;
    } else {
      console.log(`  ✓ ${cinema.name.padEnd(46)}  inserted (id=${row.id})`);
      inserted++;
    }
  }
}

console.log(`\nDone. ${inserted} inserted · ${updated} updated · ${errored} errors.`);
console.log('\nNext step: run scripts/run-scrape-all.mjs to do a test scrape.');
