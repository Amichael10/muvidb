import { spring } from "remotion";
import gsap from "gsap";

/**
 * The film's motion vocabulary.
 *
 * Two rules keep this frame-accurate:
 *
 *  1. Physics comes from Remotion's `spring()`, which is a pure function of
 *     the frame number. Nothing here reads a wall clock.
 *  2. GSAP is used for its easing curves ONLY, via `gsap.parseEase()`, which
 *     returns a pure `(t: number) => number`. GSAP timelines are driven by
 *     requestAnimationFrame and would render differently on every pass, so a
 *     `gsap.timeline()` must never appear in a composition. The curves are the
 *     valuable part anyway -- `expo.out`, `back.out`, `elastic.out` and
 *     `circ.inOut` are hard to hand-roll and are what give the edit its snap.
 */

/** GSAP easing curves as pure functions, safe to call per frame. */
export const ease = {
  expoOut: gsap.parseEase("expo.out"),
  expoInOut: gsap.parseEase("expo.inOut"),
  circOut: gsap.parseEase("circ.out"),
  circInOut: gsap.parseEase("circ.inOut"),
  backOut: gsap.parseEase("back.out(2.2)"),
  backOutSoft: gsap.parseEase("back.out(1.3)"),
  elasticOut: gsap.parseEase("elastic.out(1, 0.45)"),
  power2Out: gsap.parseEase("power2.out"),
  power3Out: gsap.parseEase("power3.out"),
  power4Out: gsap.parseEase("power4.out"),
  power2InOut: gsap.parseEase("power2.inOut"),
} as const;

export type EaseName = keyof typeof ease;

/** 0..1 over a window, shaped by a GSAP curve. */
export const curve = (
  frame: number,
  from: number,
  duration: number,
  name: EaseName = "expoOut",
): number => {
  const t = Math.min(1, Math.max(0, (frame - from) / duration));
  return ease[name](t);
};

/** Spring presets. `overshoot` ones deliberately cross 1 and settle back. */
export const SPRINGS = {
  /** Fast, barely overshoots. UI state changes. */
  snappy: { damping: 16, mass: 0.5, stiffness: 180 },
  /** Clear overshoot. Things arriving. */
  pop: { damping: 10, mass: 0.6, stiffness: 150 },
  /** Loose and rubbery. The notification drop. */
  rubber: { damping: 7.5, mass: 0.9, stiffness: 120 },
  /** Weighty, settles slowly. Big objects. */
  heavy: { damping: 20, mass: 1.6, stiffness: 95 },
  /** No overshoot at all, for anything that must not wobble. */
  firm: { damping: 26, mass: 0.8, stiffness: 160 },
} as const;

export type SpringName = keyof typeof SPRINGS;

export const sp = (
  frame: number,
  fps: number,
  from: number,
  name: SpringName = "pop",
  durationInFrames?: number,
): number =>
  spring({
    frame: frame - from,
    fps,
    config: SPRINGS[name],
    durationInFrames,
  });

/**
 * Staggered index timing. Returns the frame a given item should start on,
 * with an optional ease so later items bunch up rather than marching.
 */
export const staggerStart = (
  index: number,
  count: number,
  from: number,
  spread: number,
  shape: EaseName = "power2InOut",
): number => {
  if (count <= 1) return from;
  const t = index / (count - 1);
  return from + ease[shape](t) * spread;
};

/**
 * Squash and stretch derived from vertical velocity.
 *
 * This is what makes a falling object read as having mass: it stretches along
 * its travel, then compresses on impact and wobbles out. Returns scaleX/scaleY
 * multipliers to apply on top of whatever else the element is doing.
 */
export const squashStretch = (
  frame: number,
  fps: number,
  impactFrame: number,
  intensity = 0.26,
): { scaleX: number; scaleY: number } => {
  const since = frame - impactFrame;
  // Anticipation: stretch slightly while still travelling.
  if (since < 0) {
    const t = Math.min(1, -since / 10);
    const s = t * intensity * 0.5;
    return { scaleX: 1 - s * 0.6, scaleY: 1 + s };
  }
  // Impact: compress, then a decaying wobble back to rest.
  const decay = Math.exp(-since / (fps * 0.22));
  const wobble = Math.cos((since / fps) * Math.PI * 2 * 4.2) * decay;
  const s = wobble * intensity;
  return { scaleX: 1 + s * 0.75, scaleY: 1 - s };
};

/**
 * Scroll with momentum and a rubber-band settle, instead of a linear slide.
 * Real thumbs overshoot slightly and the list snaps back.
 */
export const momentumScroll = (
  frame: number,
  fps: number,
  from: number,
  distance: number,
  durationInFrames = 46,
): number => {
  const s = sp(frame, fps, from, "snappy", durationInFrames);
  // A touch of overshoot early on, pulled back as the spring settles.
  const over = Math.sin(Math.min(1, (frame - from) / durationInFrames) * Math.PI) * 14;
  return s * distance + (frame >= from ? over : 0);
};

export const t01 = (frame: number, from: number, duration: number): number =>
  Math.min(1, Math.max(0, (frame - from) / duration));

/**
 * A value that rises then falls, for one-shot flashes and sweeps.
 * Peaks at `peak` (0..1) through the window.
 */
export const pulse = (
  frame: number,
  from: number,
  duration: number,
  peak = 0.3,
): number => {
  const t = t01(frame, from, duration);
  if (t <= 0 || t >= 1) return 0;
  return t < peak
    ? ease.circOut(t / peak)
    : ease.circOut(1 - (t - peak) / (1 - peak));
};

