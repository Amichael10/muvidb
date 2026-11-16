/**
 * Bundle entry point for Rewind renders only.
 *
 * The default entry (src/index.ts) registers every composition in the project,
 * and src/actor-alert/lib/fonts.ts calls @remotion/google-fonts at module
 * scope — roughly a hundred requests to fonts.gstatic.com evaluated on EVERY
 * render, for fonts Rewind never uses. In a 782-actor batch that is both dead
 * weight and a failure mode: two actors in a three-actor test run died on
 * ERR_NAME_NOT_RESOLVED from that CDN while their own renders were fine.
 *
 * Rewind loads Anton and DM Sans from @fontsource, which are bundled, so a
 * bundle built from here reaches the network only for posters and portraits.
 *
 *   npx remotion bundle --entry-point=src/rewind-entry.ts
 */
import { registerRoot } from 'remotion';
import { RewindCompositions } from './rewind/Root';

registerRoot(RewindCompositions);
