import { interpolate, Easing } from "remotion";

/**
 * The house easing curve: cubic-bezier(0.22, 1, 0.36, 1).
 *
 * Everything decelerates into place with it, which is what makes the motion
 * read as product UI rather than as a slideshow. Linear movement is never used
 * for anything the eye tracks.
 */
export const easeOutExpoish = Easing.bezier(0.22, 1, 0.36, 1);

/** Softer curve for things that both enter and leave. */
export const easeInOut = Easing.bezier(0.4, 0, 0.2, 1);

export interface RangeOptions {
  /** Frames, relative to the start of the enclosing Sequence. */
  from: number;
  duration: number;
  easing?: (n: number) => number;
}

/** Normalised 0..1 progress across a frame window, clamped at both ends. */
export const progress = (
  frame: number,
  { from, duration, easing = easeOutExpoish }: RangeOptions,
): number =>
  interpolate(frame, [from, from + duration], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing,
  });

/** Interpolate one value across a frame window with the house easing. */
export const animate = (
  frame: number,
  opts: RangeOptions & { to: [number, number] },
): number => interpolate(progress(frame, opts), [0, 1], opts.to);

/**
 * Standard text entrance: rises a few pixels while fading in.
 * Returns style props rather than a component so callers keep layout control.
 */
export const riseIn = (
  frame: number,
  from: number,
  duration = 18,
  distance = 26,
) => {
  const p = progress(frame, { from, duration });
  return {
    opacity: p,
    transform: `translateY(${(1 - p) * distance}px)`,
  };
};

/** Fade a block out again, for text that must clear before the next beat. */
export const fadeOut = (frame: number, from: number, duration = 12) =>
  1 - progress(frame, { from, duration, easing: easeInOut });

/**
 * Combined enter/exit opacity for on-screen captions.
 * `hold` is how long the caption stays at full opacity after entering.
 */
export const captionOpacity = (
  frame: number,
  from: number,
  hold: number,
  enter = 16,
  exit = 12,
) => {
  const inP = progress(frame, { from, duration: enter });
  const outP = progress(frame, { from: from + enter + hold, duration: exit, easing: easeInOut });
  return inP * (1 - outP);
};

/**
 * A finger press. Returns the scale to apply to the pressed control and the
 * opacity of the touch ripple, so a tap always reads as one gesture.
 */
export const tap = (frame: number, at: number) => {
  const down = progress(frame, { from: at, duration: 5, easing: easeInOut });
  const up = progress(frame, { from: at + 5, duration: 10 });
  const press = down - up; // 0 -> 1 -> 0

  // The ripple must be silent until the finger actually lands. Deriving it
  // from (1 - progress) alone leaves it at full strength for every frame
  // before `at`, which paints a permanent highlight over the control.
  const spread = progress(frame, { from: at, duration: 24 });
  const live = frame >= at;

  return {
    scale: 1 - press * 0.045,
    rippleOpacity: live ? (1 - spread) * 0.5 : 0,
    rippleScale: live ? 0.4 + spread * 1.6 : 0.4,
    /** True once the press has completed, for flipping state. */
    done: frame >= at + 6,
  };
};
