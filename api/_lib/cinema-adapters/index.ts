/**
 * Adapter registry — maps cinemas.scrape_adapter → the function that fetches
 * showtimes for that platform. New adapters just register here.
 */

import type { CinemaAdapter } from './types.js';
import { reachCinemaAdapter } from './reach-cinema.js';
import { veeziAdapter } from './veezi.js';
import { cinesyncAdapter } from './cinesync.js';
import { bluepicturesAdapter } from './bluepictures.js';
import { firecrawlAdapter } from './firecrawl.js';
import { genesisAdapter } from './genesis.js';
import { filmhouseAdapter } from './filmhouse.js';

export const ADAPTERS: Record<string, CinemaAdapter> = {
  reach_cinema: reachCinemaAdapter,   // Viva / Ozone / KADA (Reach Cinema / Fusion Intel)
  veezi:        veeziAdapter,         // Silverbird
  cinesync:     cinesyncAdapter,      // Filmhouse (needs DevTools recon — see cinesync.ts)
  bluepictures: bluepicturesAdapter,  // Blue Pictures
  firecrawl:    firecrawlAdapter,
  genesis:      genesisAdapter,    // Genesis Cinemas (Jacro WP plugin — deterministic HTML, no AI)     // Genesis + any geo-blocked sites
  filmhouse:    filmhouseAdapter,  // Filmhouse (Next.js server-rendered — run from a Nigerian IP)
};

export * from './types.js';
export { upsertShowtimes, sweepStaleCinemas } from './upsert.js';
