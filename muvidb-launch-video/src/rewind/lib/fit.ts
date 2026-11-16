/**
 * Text that shrinks to fit instead of clipping.
 *
 * The reference sets the actor name at a hard 250px. Real names reach 38
 * characters ("Yusuf Omoshalewa Adeola (Basira Beree)"), which at 250px is
 * roughly three times the frame width. Guessing a character ratio is not good
 * enough for a name an actor is about to post to Instagram, so these measure
 * the real glyphs via @remotion/layout-utils.
 */
import { fitText, fitTextOnNLines } from '@remotion/layout-utils';
import { DISPLAY } from './fonts';

/**
 * Largest size at which `text` fits on at most `maxLines` lines inside
 * `maxBoxWidth`, together with the lines the breaker chose.
 *
 * `validateFontIsLoaded` makes a measurement taken before Anton is ready a
 * loud error rather than a silently mis-sized frame.
 */
export function fitDisplayLines(
  text: string,
  maxBoxWidth: number,
  maxFontSize: number,
  maxLines = 2
): { fontSize: number; lines: string[] } {
  const safe = String(text ?? '').replace(/\s+/g, ' ').trim();
  if (!safe) return { fontSize: maxFontSize, lines: [''] };

  const { fontSize, lines } = fitTextOnNLines({
    text: safe,
    maxLines,
    maxBoxWidth,
    fontFamily: DISPLAY,
    fontWeight: 400,
    textTransform: 'uppercase',
    validateFontIsLoaded: true,
    maxFontSize,
  });
  return { fontSize, lines };
}

/** Largest size at which `text` fits on ONE line inside `withinWidth`. */
export function fitDisplayLine(
  text: string,
  withinWidth: number,
  maxFontSize: number,
  fontFamily: string = DISPLAY,
  fontWeight: number = 400
): number {
  const safe = String(text ?? '').replace(/\s+/g, ' ').trim();
  if (!safe) return maxFontSize;

  const { fontSize } = fitText({
    text: safe,
    withinWidth,
    fontFamily,
    fontWeight,
    textTransform: fontFamily === DISPLAY ? 'uppercase' : 'none',
    validateFontIsLoaded: true,
  });
  return Math.min(maxFontSize, fontSize);
}
