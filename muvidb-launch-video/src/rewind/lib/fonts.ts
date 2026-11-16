/**
 * Fonts for Rewind, from @fontsource packages rather than a CDN.
 *
 * A CDN would make every GitHub Actions render depend on fonts.googleapis.com
 * being up and would silently fall back to Impact/Arial when it is not --
 * producing a video that looks wrong but renders without error. These are
 * installed, bundled and measurable.
 */
import '@fontsource/anton/400.css';
import '@fontsource/dm-sans/400.css';
import '@fontsource/dm-sans/500.css';
import '@fontsource/dm-sans/700.css';

/** Display face. Condensed, uppercase, carries every big number. */
export const DISPLAY = 'Anton';

/** Body face. 400/500/700 are the only weights the reference uses. */
export const BODY = 'DM Sans';

export const displayStyle = {
  fontFamily: DISPLAY,
  textTransform: 'uppercase',
} as const;
