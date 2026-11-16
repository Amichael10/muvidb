/**
 * Easing helpers ported verbatim from docs/rewind/rewind-sample-template.html.
 *
 * The reference drives everything from a single render(t) in seconds, so the
 * compositions below convert frame -> seconds once and then use exactly these
 * curves. Keeping the maths identical is the whole point: the HTML file is the
 * approved look, and anything re-derived here would drift from it.
 */

export const clamp = (x: number): number => Math.max(0, Math.min(1, x));

/** Normalised progress of `t` through the window [a, b]. */
export const p = (t: number, a: number, b: number): number => clamp((t - a) / (b - a));

/** Cubic ease-out. */
export const out = (x: number): number => 1 - Math.pow(1 - x, 3);

/** Cubic ease-in. */
export const inn = (x: number): number => x * x * x;

/** Overshooting ease-out, for the card drop. */
export const back = (x: number): number => {
  const c = 1.70158;
  return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2);
};

export const lerp = (a: number, b: number, x: number): number => a + (b - a) * x;
