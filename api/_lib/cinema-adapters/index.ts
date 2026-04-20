/**
 * Adapter registry — maps cinemas.scrape_adapter → the function that fetches
 * showtimes for that platform. New adapters just register here.
 */

import type { CinemaAdapter } from './types';
import { reachCinemaAdapter } from './reach-cinema';
import { veeziAdapter } from './veezi';
import { cinesyncAdapter } from './cinesync';
import { bluepicturesAdapter } from './bluepictures';
import { firecrawlAdapter } from './firecrawl';

export const ADAPTERS: Record<string, CinemaAdapter> = {
  reach_cinema: reachCinemaAdapter,   // Viva / Ozone / KADA (Reach Cinema / Fusion Intel)
  veezi:        veeziAdapter,         // Silverbird
  cinesync:     cinesyncAdapter,      // Filmhouse (needs DevTools recon — see cinesync.ts)
  bluepictures: bluepicturesAdapter,  // Blue Pictures
  firecrawl:    firecrawlAdapter,     // Genesis + any geo-blocked sites
};

export * from './types';
export { upsertShowtimes } from './upsert';
