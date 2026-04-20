/**
 * Seed script — mark all Viva cinemas for scraping via the reach_cinema adapter.
 *
 * Matches cinemas by chain='Viva' (from the master spreadsheet) and fills in:
 *   scrape_adapter = 'reach_cinema'
 *   scrape_config.externalCinemaId = the viv-xxxxxx id
 *   scrape_config.bookingBaseUrl = 'https://web.vivacinemas.com'
 *   scrape_enabled = true
 *
 * Usage: npx tsx scripts/seed-reach-cinema-cinemas.mjs
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

// Mapping from city/area hint → Viva's external cinema ID
// These came from /api/v1/Cinemas/ListAllByCircuit?circuitId=circuit-4b010751
const VIVA = [
  { match: 'ikeja',   externalCinemaId: 'viv-27fd41dc' },
  { match: 'ibadan',  externalCinemaId: 'viv-353d0dd9' },
  { match: 'ota',     externalCinemaId: 'viv-f55b99bf' },
  { match: 'enugu',   externalCinemaId: 'viv-a3972994' },
  { match: 'ilorin',  externalCinemaId: 'viv-8a416f84' },
  { match: 'lekki',   externalCinemaId: 'viv-6ac91519' },
];

// Fetch all Viva cinemas
const { data: cinemas, error } = await supabase
  .from('cinemas')
  .select('id, name, city, chain, address')
  .ilike('name', '%viva%');

if (error) throw error;

console.log(`Found ${cinemas.length} Viva-matching cinemas:`);
cinemas.forEach(c => console.log(`  • ${c.name} (${c.city})`));

const updates = [];
for (const c of cinemas) {
  const blob = `${c.name} ${c.city ?? ''} ${c.address ?? ''}`.toLowerCase();
  const match = VIVA.find(v => blob.includes(v.match));
  if (!match) {
    console.warn(`  ! no Viva external-id match for "${c.name}" (${c.city}) — skipping`);
    continue;
  }
  updates.push({ id: c.id, name: c.name, externalCinemaId: match.externalCinemaId });
}

console.log(`\nApplying scrape config to ${updates.length} Viva cinemas…`);

for (const u of updates) {
  const { error: upErr } = await supabase
    .from('cinemas')
    .update({
      chain: 'Viva',
      scrape_enabled: true,
      scrape_adapter: 'reach_cinema',
      scrape_config: {
        externalCinemaId: u.externalCinemaId,
        bookingBaseUrl:   'https://web.vivacinemas.com',
        circuitId:        'circuit-4b010751',
      },
      scrape_failure_count: 0,
      scrape_last_error: null,
    })
    .eq('id', u.id);
  if (upErr) {
    console.error(`  ✗ ${u.name}: ${upErr.message}`);
  } else {
    console.log(`  ✓ ${u.name} → ${u.externalCinemaId}`);
  }
}

console.log('\n✅ Seed complete.');
